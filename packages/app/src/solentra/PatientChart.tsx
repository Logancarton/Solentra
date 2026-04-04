// Solentra Patient Chart
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Progress,
  RingProgress,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconActivity,
  IconAlertTriangle,
  IconArrowLeft,
  IconBrain,
  IconBuilding,
  IconCalendar,
  IconChartLine,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconCircleX,
  IconClipboardList,
  IconClockHour4,
  IconCurrencyDollar,
  IconDroplet,
  IconEdit,
  IconExternalLink,
  IconFileInvoice,
  IconFlask,
  IconHeart,
  IconMedicalCross,
  IconMicrophone,
  IconNotes,
  IconPill,
  IconPhone,
  IconReceipt,
  IconRefresh,
  IconSend,
  IconShieldCheck,
  IconTrendingUp,
  IconUser,
  IconWeight,
} from '@tabler/icons-react';
import type { Patient as FhirPatient, Task } from '@medplum/fhirtypes';
import { Loading, useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { computeAlerts } from './clinicalAlerts';
import type { ClinicalAlert } from './clinicalAlerts';
import { useLivePatientRecord } from './patientData';
import classes from './PatientChart.module.css';

// ── Mock Patient Database ──────────────────────────────────────────────────────

export interface Medication {
  name: string; dose: string; sig: string; prescriber: string;
  startDate: string; lastFilled: string; refillsLeft: number; status: 'active' | 'hold' | 'discontinued';
}
interface Lab {
  name: string; value: string; unit: string; range: string;
  date: string; status: 'normal' | 'high' | 'low' | 'critical';
}
interface Note {
  date: string; type: string; summary: string; provider: string;
  diagnoses: string[]; plan: string[];
}
interface Assessment {
  tool: string; date: string; score: number; maxScore: number;
  severity: string; color: string;
}
export interface MedTrial {
  name: string; dose: string; startDate: string; endDate: string;
  reason: string; outcome: string;
}
export interface Vital {
  date: string; weight?: string; bmi?: string; bp?: string; hr?: string;
}
export interface Patient {
  name: string; dob: string; age: number; mrn: string;
  pronouns: string; phone: string; insurance: string; pcp: string;
  diagnoses: string[]; allergies: string[]; flags: string[];
  meds: Medication[]; labs: Lab[]; notes: Note[]; assessments: Assessment[];
  vitals: Vital[];
  medTrials: MedTrial[];
  pmh: string[];
  psh: string[];
  psychiatricHistory: string[];
  substanceUse: string[];
  socialHistory: string[]; familyHistory: string[];
  hospitalizations: string[];
  safetyPlanOnFile: boolean;
  nextAppointment?: string;
}

export const PATIENTS: Record<string, Patient> = {
  'sara-mitchell': {
    name: 'Sara Mitchell',
    dob: '05/30/1988',
    age: 35,
    mrn: 'SOL-00421',
    pronouns: 'she/her',
    phone: '(617) 555-0192',
    insurance: 'BCBS of MA',
    pcp: 'Dr. Alan Foster',
    diagnoses: [
      'F33.2 — Major Depressive Disorder, Recurrent, Severe',
      'F41.1 — Generalized Anxiety Disorder',
      'Z91.51 — Personal history of suicidal ideation',
    ],
    allergies: ['Bupropion (seizure threshold)', 'Penicillin (rash)'],
    flags: ['SI flagged last visit', 'PHQ-9 due today'],
    meds: [
      { name: 'Sertraline', dose: '100mg', sig: 'Once daily in the morning', prescriber: 'Dr. Carton', startDate: '03/10/2023', lastFilled: '03/01/2026', refillsLeft: 2, status: 'active' },
      { name: 'Trazodone', dose: '50mg', sig: 'At bedtime as needed for sleep', prescriber: 'Dr. Carton', startDate: '06/15/2024', lastFilled: '02/15/2026', refillsLeft: 1, status: 'active' },
      { name: 'Lorazepam', dose: '0.5mg', sig: 'BID PRN anxiety (max 3 days/wk)', prescriber: 'Dr. Carton', startDate: '09/01/2025', lastFilled: '01/10/2026', refillsLeft: 0, status: 'hold' },
    ],
    labs: [
      { name: 'CMP — Sodium',       value: '139',  unit: 'mEq/L', range: '136–145',  date: '02/12/2026', status: 'normal' },
      { name: 'CMP — Creatinine',   value: '0.8',  unit: 'mg/dL', range: '0.5–1.1',  date: '02/12/2026', status: 'normal' },
      { name: 'TSH',                value: '2.1',  unit: 'mIU/L', range: '0.4–4.0',  date: '02/12/2026', status: 'normal' },
      { name: 'CBC — WBC',          value: '6.4',  unit: 'K/uL',  range: '4.0–11.0', date: '02/12/2026', status: 'normal' },
      { name: 'Urine Drug Screen',  value: 'NEG',  unit: '',       range: 'Negative',  date: '01/08/2026', status: 'normal' },
    ],
    notes: [
      {
        date: '02/15/2026',
        type: 'Follow-up',
        provider: 'Dr. Carton',
        summary: 'Pt reports improved sleep with Trazodone but persistent low mood. PHQ-9: 16 (moderate-severe). Denies active SI but endorses passive ideation "life would be easier if I wasn\'t here." Safety plan reviewed.',
        diagnoses: ['F33.2 — MDD, Recurrent, Severe', 'F41.1 — GAD'],
        plan: [
          'Continue Sertraline 100mg daily',
          'Continue Trazodone 50mg QHS',
          'Hold Lorazepam pending reassessment',
          'PHQ-9 in 2 weeks via portal',
          'RTC 6 weeks or sooner PRN',
          'Safety plan on file — reviewed today',
        ],
      },
      {
        date: '01/08/2026',
        type: 'Follow-up',
        provider: 'Dr. Carton',
        summary: 'Pt doing somewhat better. PHQ-9: 12 (moderate). Sleep remains poor. Denied SI. Started Trazodone 50mg QHS for insomnia.',
        diagnoses: ['F33.2 — MDD, Recurrent, Moderate'],
        plan: ['Start Trazodone 50mg QHS', 'RTC 6 weeks'],
      },
      {
        date: '11/20/2025',
        type: 'Med Management',
        provider: 'Dr. Carton',
        summary: 'PHQ-9: 18 (severe). Reports worsening depression following breakup. Increased Sertraline from 50mg to 100mg.',
        diagnoses: ['F33.2 — MDD, Recurrent, Severe'],
        plan: ['Increase Sertraline 50mg → 100mg', 'RTC 6 weeks', 'Referred to therapist'],
      },
    ],
    assessments: [
      { tool: 'PHQ-9',   date: '02/15/2026', score: 16, maxScore: 27, severity: 'Moderate-Severe', color: 'orange' },
      { tool: 'PHQ-9',   date: '01/08/2026', score: 12, maxScore: 27, severity: 'Moderate',        color: 'yellow' },
      { tool: 'PHQ-9',   date: '11/20/2025', score: 18, maxScore: 27, severity: 'Severe',           color: 'red'    },
      { tool: 'GAD-7',   date: '02/15/2026', score: 11, maxScore: 21, severity: 'Moderate',         color: 'yellow' },
      { tool: 'GAD-7',   date: '01/08/2026', score: 8,  maxScore: 21, severity: 'Mild',             color: 'green'  },
      { tool: 'C-SSRS',  date: '02/15/2026', score: 2,  maxScore: 5,  severity: 'Passive ideation', color: 'orange' },
    ],
    vitals: [
      { date: '02/15/2026', weight: '138 lbs', bmi: '23.1', bp: '118/74', hr: '72 bpm' },
      { date: '11/20/2025', weight: '141 lbs', bmi: '23.6', bp: '122/78', hr: '76 bpm' },
    ],
    medTrials: [
      { name: 'Fluoxetine', dose: '20mg', startDate: '01/2021', endDate: '08/2021', reason: 'MDD', outcome: 'Partial response; discontinued due to sexual side effects' },
      { name: 'Escitalopram', dose: '10mg', startDate: '09/2021', endDate: '02/2023', reason: 'MDD + GAD', outcome: 'Inadequate response after 4 months; switched to Sertraline' },
      { name: 'Bupropion', dose: '150mg', startDate: '03/2022', endDate: '03/2022', reason: 'Augmentation trial', outcome: 'STOPPED — lowered seizure threshold, single brief seizure episode. ALLERGY DOCUMENTED.' },
    ],
    pmh: ['Migraines (managed with sumatriptan PRN)', 'Iron-deficiency anemia (2020, resolved)'],
    psh: ['Appendectomy 2014 (uncomplicated)'],
    psychiatricHistory: [
      'First depressive episode age 22 (college, following bereavement)',
      'Previous provider: Dr. Susan Holt, NP (2019–2022, Boston)',
      'Outpatient therapy: CBT with therapist Lisa Monroe, LCSW (ongoing)',
      'No prior ECT or TMS',
      'No prior partial or intensive outpatient programs',
    ],
    substanceUse: [
      'Alcohol: 1–2 drinks/week (social); no history of misuse or withdrawal',
      'Cannabis: Denies current or past use',
      'Tobacco: Never smoker',
      'Illicit substances: Denies',
      'Caffeine: 2 cups coffee/day',
      'CAGE score: 0 (last screened 02/2026)',
    ],
    socialHistory: [
      'Lives alone in apartment; supportive sister nearby',
      'Works as a graphic designer (remote, stable employment)',
      'Single; ended long-term relationship November 2025',
      'Graduated UMass Boston 2010 (BFA Graphic Design)',
      'No legal history',
    ],
    familyHistory: [
      'Mother: MDD, treated with fluoxetine — good response',
      'Father: Alcohol use disorder, estranged',
      'Maternal aunt: Bipolar I, hospitalized x2',
      'No known family history of suicide completion',
    ],
    hospitalizations: [
      '2019 — Inpatient psychiatric, 5-day stay post-overdose (Tylenol, non-lethal). McLean Hospital, Belmont MA. Discharged with outpatient follow-up.',
    ],
    safetyPlanOnFile: true,
    nextAppointment: '05/12/2026 · 2:00 PM · Dr. Carton',
  },

  'thomas-reed': {
    name: 'Thomas Reed',
    dob: '09/12/1965',
    age: 60,
    mrn: 'SOL-00187',
    pronouns: 'he/him',
    phone: '(617) 555-0344',
    insurance: 'Medicare Part B',
    pcp: 'Dr. Mina Patel',
    diagnoses: [
      'F31.2 — Bipolar I Disorder, Most Recent Episode Manic',
      'G40.309 — Epilepsy, unspecified (remote history)',
    ],
    allergies: ['Valproate (hepatotoxicity)'],
    flags: ['Lithium level HIGH — 1.4 mEq/L'],
    meds: [
      { name: 'Lithium Carbonate', dose: '600mg', sig: 'BID (morning and evening)', prescriber: 'Dr. Carton', startDate: '01/15/2022', lastFilled: '03/01/2026', refillsLeft: 1, status: 'active' },
      { name: 'Quetiapine',        dose: '200mg', sig: 'At bedtime',               prescriber: 'Dr. Carton', startDate: '03/01/2023', lastFilled: '02/20/2026', refillsLeft: 2, status: 'active' },
    ],
    labs: [
      { name: 'Lithium Level',     value: '1.4',  unit: 'mEq/L', range: '0.6–1.2',  date: '04/02/2026', status: 'high'   },
      { name: 'Creatinine',        value: '1.1',  unit: 'mg/dL', range: '0.7–1.3',  date: '04/02/2026', status: 'normal' },
      { name: 'TSH',               value: '3.8',  unit: 'mIU/L', range: '0.4–4.0',  date: '04/02/2026', status: 'normal' },
      { name: 'Sodium',            value: '141',  unit: 'mEq/L', range: '136–145',  date: '04/02/2026', status: 'normal' },
    ],
    notes: [
      {
        date: '02/01/2026',
        type: 'Med Management',
        provider: 'Dr. Carton',
        summary: 'Mood stable on current regimen. Lithium level 1.0 mEq/L at last draw. Sleep good, no manic features. Continued current plan.',
        diagnoses: ['F31.2 — Bipolar I, stable on lithium'],
        plan: ['Continue Lithium 600mg BID', 'Lithium level in 3 months', 'RTC 3 months'],
      },
    ],
    assessments: [
      { tool: 'YMRS',  date: '02/01/2026', score: 4,  maxScore: 60, severity: 'Minimal', color: 'green' },
      { tool: 'PHQ-9', date: '02/01/2026', score: 5,  maxScore: 27, severity: 'Minimal', color: 'green' },
    ],
    vitals: [
      { date: '04/02/2026', weight: '198 lbs', bmi: '28.4', bp: '134/82', hr: '68 bpm' },
      { date: '02/01/2026', weight: '196 lbs', bmi: '28.1', bp: '130/80', hr: '70 bpm' },
    ],
    medTrials: [
      { name: 'Valproate', dose: '500mg BID', startDate: '09/2018', endDate: '01/2019', reason: 'Bipolar I', outcome: 'STOPPED — elevated LFTs (hepatotoxicity). ALLERGY DOCUMENTED.' },
      { name: 'Olanzapine', dose: '10mg QHS', startDate: '02/2019', endDate: '11/2020', reason: 'Bipolar I — acute mania', outcome: 'Effective for acute episode; discontinued due to 22 lb weight gain, metabolic concerns' },
      { name: 'Lamotrigine', dose: '100mg', startDate: '12/2020', endDate: '08/2021', reason: 'Bipolar I maintenance', outcome: 'Ineffective for manic episodes; rash at 75mg dose (not severe, re-titrated)' },
    ],
    pmh: ['Hypertension (Stage 1, diet-controlled)', 'Hypothyroidism (on Levothyroxine 50mcg)', 'Epilepsy — remote, no seizures since 2009, no longer on AED'],
    psh: ['Knee arthroscopy 2010 (right, sports injury)', 'Cholecystectomy 2017'],
    psychiatricHistory: [
      'First manic episode age 34 (2003), hospitalized 10 days, diagnosed Bipolar I',
      'Previous provider: Dr. James Wolfe, MD (2003–2021, Hartford CT)',
      'No history of psychotherapy (patient declined referrals)',
      'No prior ECT or TMS trials',
      '3 total psychiatric hospitalizations (2003, 2018, 2021)',
    ],
    substanceUse: [
      'Alcohol: Denies current use; remote history of heavy use in 30s (self-reported)',
      'Cannabis: Denies',
      'Tobacco: Quit 2015, 20 pack-year history',
      'Illicit substances: Denies',
      'AUDIT score: 2 (low risk, last screened 02/2026)',
    ],
    socialHistory: [
      'Retired high school history teacher (2024)',
      'Married 32 years; wife Laura is primary support person',
      '2 adult children (daughter in Boston, son in Seattle)',
      'Active in church community; reports good social support',
      'No legal history',
    ],
    familyHistory: [
      'Father: Bipolar I, completed suicide 1998',
      'Brother: MDD, on medication',
      'No other known psychiatric history',
    ],
    hospitalizations: [
      '2003 — First manic episode, inpatient 10 days, Hartford Hospital',
      '2018 — Manic episode (medication noncompliance), inpatient 7 days',
      '2021 — Manic episode triggered by sleep deprivation, inpatient 7 days',
    ],
    safetyPlanOnFile: true,
    nextAppointment: '05/05/2026 · 10:00 AM · Dr. Carton',
  },

  'devon-williams': {
    name: 'Devon Williams',
    dob: '11/05/1990',
    age: 33,
    mrn: 'SOL-00512',
    pronouns: 'they/them',
    phone: '(617) 555-0788',
    insurance: 'Aetna',
    pcp: 'Dr. Rachel Kim',
    diagnoses: ['Intake evaluation — diagnoses pending'],
    allergies: ['NKDA'],
    flags: [],
    meds: [],
    labs: [
      { name: 'CBC', value: 'WNL', unit: '', range: 'All within normal limits', date: '04/02/2026', status: 'normal' },
    ],
    notes: [],
    assessments: [
      { tool: 'PHQ-9', date: '04/02/2026', score: 14, maxScore: 27, severity: 'Moderate', color: 'yellow' },
      { tool: 'GAD-7', date: '04/02/2026', score: 13, maxScore: 21, severity: 'Moderate', color: 'yellow' },
    ],
    vitals: [
      { date: '04/02/2026', weight: '162 lbs', bmi: '24.7', bp: '116/70', hr: '78 bpm' },
    ],
    medTrials: [],
    pmh: ['Asthma (mild intermittent, albuterol PRN)', 'Seasonal allergies'],
    psh: [],
    psychiatricHistory: [
      'Presenting for initial psychiatric evaluation — no prior psychiatric treatment',
      'Longstanding anxiety symptoms since adolescence, not previously treated',
      'Self-referred following increased difficulty functioning at work',
    ],
    substanceUse: [
      'Cannabis: 2–3 times/week (recreational, evenings); uses to help with anxiety and sleep',
      'Alcohol: 2–3 drinks/week; no history of misuse',
      'Tobacco: Never',
      'Other substances: Denies',
      'DAST-10: 3 (low risk, screened 04/02/2026)',
    ],
    socialHistory: [
      'Software engineer at tech startup (remote)',
      'Single; lives with roommate in Cambridge',
      'Identifies as non-binary (they/them); supportive friend network',
      'No legal history',
      'Good housing stability',
    ],
    familyHistory: [
      'Mother: GAD, managed with therapy only',
      'Father: No known psychiatric history',
      'Maternal grandfather: Depression',
    ],
    hospitalizations: [],
    safetyPlanOnFile: false,
    nextAppointment: '04/30/2026 · 3:30 PM · Dr. Carton',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function getPatient(slug: string): Patient | null {
  return PATIENTS[slug] ?? null;
}

// ── Storyboard Sidebar ────────────────────────────────────────────────────────

function Storyboard({ patient }: { patient: Patient }): JSX.Element {
  const latestPHQ   = patient.assessments.filter((a) => a.tool === 'PHQ-9').sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestGAD   = patient.assessments.filter((a) => a.tool === 'GAD-7').sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestCSSRS = patient.assessments.filter((a) => a.tool === 'C-SSRS').sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestVital = patient.vitals[0];
  const activeMeds  = patient.meds.filter((m) => m.status !== 'discontinued');

  return (
    <Box className={classes.storyboard}>
      {/* ALLERGIES — always pinned at top in red per Epic convention */}
      <Box style={{ background: '#fff5f5', borderBottom: '2px solid #ffc9c9', padding: '8px 12px' }}>
        <Group gap={5} mb={4}>
          <IconAlertTriangle size={12} color="#e03131" />
          <Text size="10px" fw={800} c="red" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>Allergies</Text>
        </Group>
        <Stack gap={3}>
          {patient.allergies.map((a, i) => (
            <Text key={i} size="xs" c="red" fw={600}>⚠ {a}</Text>
          ))}
        </Stack>
      </Box>

      {/* PROBLEM LIST */}
      <Box className={classes.sbSection}>
        <Text className={classes.sbLabel}>Problem List</Text>
        <Stack gap={4}>
          {patient.diagnoses.map((d, i) => (
            <Group key={i} gap={5} wrap="nowrap" align="flex-start">
              <Text size="xs" fw={700} c="violet" style={{ flexShrink: 0, lineHeight: 1.4 }}>{i + 1}.</Text>
              <Text size="xs" style={{ lineHeight: 1.4 }}>{d}</Text>
            </Group>
          ))}
          {patient.diagnoses.length === 0 && <Text size="xs" c="dimmed">No active diagnoses</Text>}
        </Stack>
      </Box>

      {/* MEDICATIONS */}
      <Box className={classes.sbSection}>
        <Text className={classes.sbLabel}>Medications</Text>
        {activeMeds.length === 0
          ? <Text size="xs" c="dimmed">No active medications</Text>
          : activeMeds.map((m, i) => (
            <Box key={i} mb={5}>
              <Group gap={4} wrap="nowrap" align="center">
                <Text size="xs" fw={600} style={{ flex: 1, lineHeight: 1.3 }}>{m.name} {m.dose}</Text>
                {m.status === 'hold' && <Badge size="xs" color="orange" variant="filled" style={{ flexShrink: 0 }}>hold</Badge>}
                {m.refillsLeft === 0 && m.status === 'active' && <Badge size="xs" color="red" variant="light" style={{ flexShrink: 0 }}>0 refills</Badge>}
              </Group>
              <Text size="10px" c="dimmed">{m.sig}</Text>
            </Box>
          ))
        }
      </Box>

      {/* ASSESSMENT SCORES */}
      {(latestPHQ || latestGAD || latestCSSRS) && (
        <Box className={classes.sbSection}>
          <Text className={classes.sbLabel}>Assessment Scores</Text>
          <Stack gap={6}>
            {[latestPHQ, latestGAD, latestCSSRS].filter(Boolean).map((a) => (
              <Box key={a!.tool}>
                <Group justify="space-between" mb={2}>
                  <Text size="xs" fw={600}>{a!.tool}</Text>
                  <Badge size="xs" color={a!.color}>{a!.score}/{a!.maxScore} — {a!.severity}</Badge>
                </Group>
                <Progress value={(a!.score / a!.maxScore) * 100} color={a!.color} size="xs" radius="xl" />
                <Text size="10px" c="dimmed" mt={1}>{a!.date}</Text>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {/* SAFETY */}
      <Box className={classes.sbSection}>
        <Text className={classes.sbLabel}>Safety</Text>
        <Stack gap={3}>
          {patient.safetyPlanOnFile
            ? <Group gap={4}><IconCheck size={12} color="#2f9e44" /><Text size="xs" c="green" fw={600}>Safety plan on file</Text></Group>
            : <Group gap={4}><IconAlertTriangle size={12} color="#e8590c" /><Text size="xs" c="orange">No safety plan on file</Text></Group>
          }
          {patient.hospitalizations.length > 0 && (
            <Group gap={4} align="flex-start" wrap="nowrap">
              <IconBuilding size={11} color="#868e96" style={{ flexShrink: 0, marginTop: 2 }} />
              <Text size="10px" c="dimmed">{patient.hospitalizations.length} prior hospitalization{patient.hospitalizations.length > 1 ? 's' : ''}</Text>
            </Group>
          )}
          {patient.flags.map((f, i) => (
            <Group key={i} gap={4} wrap="nowrap" align="flex-start">
              <IconAlertTriangle size={11} color="#e8590c" style={{ flexShrink: 0, marginTop: 2 }} />
              <Text size="10px" c="orange">{f}</Text>
            </Group>
          ))}
        </Stack>
      </Box>

      {/* VITALS */}
      {latestVital && (
        <Box className={classes.sbSection}>
          <Text className={classes.sbLabel}>Vitals</Text>
          <Stack gap={2}>
            {latestVital.weight && (
              <Group gap={5}><IconWeight size={11} color="#868e96" /><Text size="xs">Weight: <Text span fw={600}>{latestVital.weight}</Text></Text></Group>
            )}
            {latestVital.bmi && (
              <Group gap={5}><IconActivity size={11} color="#868e96" /><Text size="xs">BMI: <Text span fw={600}>{latestVital.bmi}</Text></Text></Group>
            )}
            {latestVital.bp && (
              <Group gap={5}><IconHeart size={11} color="#868e96" /><Text size="xs">BP: <Text span fw={600}>{latestVital.bp}</Text></Text></Group>
            )}
            {latestVital.hr && (
              <Group gap={5}><IconActivity size={11} color="#868e96" /><Text size="xs">HR: <Text span fw={600}>{latestVital.hr}</Text></Text></Group>
            )}
            <Text size="10px" c="dimmed">{latestVital.date}</Text>
          </Stack>
        </Box>
      )}

      {/* NEXT APPOINTMENT */}
      {patient.nextAppointment && (
        <Box className={classes.sbSection}>
          <Text className={classes.sbLabel}>Next Visit</Text>
          <Group gap={5} wrap="nowrap">
            <IconCalendar size={12} color="#1971c2" />
            <Text size="xs" fw={600} c="blue">{patient.nextAppointment}</Text>
          </Group>
        </Box>
      )}
    </Box>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ patient }: { patient: Patient }): JSX.Element {
  const latestNote  = patient.notes[0];
  const latestVital = patient.vitals[0];
  const abnormalLabs = patient.labs.filter((l) => l.status !== 'normal');
  const refillAlerts = patient.meds.filter((m) => m.status === 'active' && m.refillsLeft === 0);

  return (
    <Stack gap="sm" p="md">
      {/* Row 1: Problems + Meds */}
      <Group gap="sm" align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
        {/* Active Problem List */}
        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb={8}>
            <ThemeIcon size="sm" color="violet" variant="light"><IconClipboardList size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Problem List</Text>
          </Group>
          <Stack gap={5}>
            {patient.diagnoses.map((d, i) => (
              <Group key={i} gap={8} wrap="nowrap" align="flex-start">
                <Text size="xs" fw={700} c="violet" style={{ flexShrink: 0 }}>{i + 1}.</Text>
                <Text size="xs">{d}</Text>
              </Group>
            ))}
            {patient.diagnoses.length === 0 && <Text size="xs" c="dimmed">No active diagnoses on file</Text>}
          </Stack>
        </Card>

        {/* Active Medications */}
        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb={8} justify="space-between">
            <Group gap={6}>
              <ThemeIcon size="sm" color="teal" variant="light"><IconPill size={13} /></ThemeIcon>
              <Text size="sm" fw={700}>Medications</Text>
              <Badge size="xs" color="teal" variant="light">{patient.meds.filter((m) => m.status === 'active').length} active</Badge>
            </Group>
            {refillAlerts.length > 0 && (
              <Badge size="xs" color="red" variant="filled">{refillAlerts.length} refill{refillAlerts.length > 1 ? 's' : ''} needed</Badge>
            )}
          </Group>
          <Stack gap={5}>
            {patient.meds.filter((m) => m.status !== 'discontinued').map((m, i) => (
              <Group key={i} gap={6} wrap="nowrap" justify="space-between">
                <Box style={{ minWidth: 0 }}>
                  <Text size="xs" fw={600}>{m.name} {m.dose}</Text>
                  <Text size="10px" c="dimmed">{m.sig}</Text>
                </Box>
                <Group gap={4} style={{ flexShrink: 0 }}>
                  {m.status === 'hold' && <Badge size="xs" color="orange">Hold</Badge>}
                  {m.refillsLeft === 0 && m.status === 'active' && <Badge size="xs" color="red" variant="light">0 refills</Badge>}
                  {m.refillsLeft > 0 && <Text size="10px" c="dimmed">{m.refillsLeft} refill{m.refillsLeft > 1 ? 's' : ''}</Text>}
                </Group>
              </Group>
            ))}
            {patient.meds.length === 0 && <Text size="xs" c="dimmed">No medications on file</Text>}
          </Stack>
        </Card>
      </Group>

      {/* Row 2: Labs + Vitals */}
      <Group gap="sm" align="flex-start" wrap="nowrap">
        {/* Labs — highlight abnormals */}
        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb={8}>
            <ThemeIcon size="sm" color={abnormalLabs.length > 0 ? 'orange' : 'blue'} variant="light"><IconFlask size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Recent Labs</Text>
            {abnormalLabs.length > 0 && <Badge size="xs" color="orange">! {abnormalLabs.length} abnormal</Badge>}
          </Group>
          {patient.labs.length === 0
            ? <Text size="xs" c="dimmed">No results on file</Text>
            : <Stack gap={3}>
                {patient.labs.slice(0, 6).map((lab, i) => (
                  <Group key={i} justify="space-between" wrap="nowrap">
                    <Text size="xs" fw={lab.status !== 'normal' ? 700 : 400} c={lab.status === 'critical' ? 'red' : lab.status === 'high' ? 'orange' : lab.status === 'low' ? 'blue' : undefined}>
                      {lab.name}
                    </Text>
                    <Group gap={4}>
                      <Text size="xs" fw={600}>{lab.value} {lab.unit}</Text>
                      {lab.status !== 'normal' && <Badge size="xs" color={lab.status === 'critical' ? 'red' : lab.status === 'high' ? 'orange' : 'blue'} variant="light">{lab.status === 'high' ? '↑' : lab.status === 'low' ? '↓' : '!!'}</Badge>}
                    </Group>
                  </Group>
                ))}
              </Stack>
          }
        </Card>

        {/* Vitals */}
        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb={8}>
            <ThemeIcon size="sm" color="pink" variant="light"><IconHeart size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Vitals</Text>
            {latestVital && <Text size="xs" c="dimmed">{latestVital.date}</Text>}
          </Group>
          {!latestVital
            ? <Text size="xs" c="dimmed">No vitals recorded</Text>
            : <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                {latestVital.weight && <Box><Text size="10px" c="dimmed" tt="uppercase" fw={600}>Weight</Text><Text size="sm" fw={700}>{latestVital.weight}</Text></Box>}
                {latestVital.bmi && <Box><Text size="10px" c="dimmed" tt="uppercase" fw={600}>BMI</Text><Text size="sm" fw={700}>{latestVital.bmi}</Text></Box>}
                {latestVital.bp && <Box><Text size="10px" c="dimmed" tt="uppercase" fw={600}>Blood Pressure</Text><Text size="sm" fw={700}>{latestVital.bp}</Text></Box>}
                {latestVital.hr && <Box><Text size="10px" c="dimmed" tt="uppercase" fw={600}>Heart Rate</Text><Text size="sm" fw={700}>{latestVital.hr}</Text></Box>}
              </Box>
          }
        </Card>
      </Group>

      {/* Row 3: Last Note */}
      {latestNote && (
        <Card withBorder p="sm">
          <Group gap={6} mb={8} justify="space-between">
            <Group gap={6}>
              <ThemeIcon size="sm" color="gray" variant="light"><IconNotes size={13} /></ThemeIcon>
              <Text size="sm" fw={700}>Last Note</Text>
            </Group>
            <Text size="xs" c="dimmed">{latestNote.date} · {latestNote.type} · {latestNote.provider}</Text>
          </Group>
          <Text size="xs" mb="xs" lineClamp={3}>{latestNote.summary}</Text>
          {latestNote.plan.length > 0 && (
            <>
              <Divider my={6} label="Plan" labelPosition="left" />
              <Stack gap={2}>
                {latestNote.plan.map((p, i) => (
                  <Group key={i} gap={5} wrap="nowrap">
                    <IconCheck size={11} color="#2f9e44" style={{ flexShrink: 0 }} />
                    <Text size="xs">{p}</Text>
                  </Group>
                ))}
              </Stack>
            </>
          )}
        </Card>
      )}
    </Stack>
  );
}

// ── Notes Tab ─────────────────────────────────────────────────────────────────

function NotesTab({ patient }: { patient: Patient }): JSX.Element {
  if (patient.notes.length === 0) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <Text c="dimmed" size="sm">No notes yet — start a visit to create the first note.</Text>
      </Box>
    );
  }
  return (
    <Stack gap={0} p="md">
      <Timeline active={0} bulletSize={20} lineWidth={2}>
        {patient.notes.map((note, i) => (
          <Timeline.Item
            key={i}
            bullet={<IconNotes size={11} />}
            title={
              <Group gap="xs">
                <Text size="sm" fw={700}>{note.type}</Text>
                <Text size="xs" c="dimmed">{note.date} · {note.provider}</Text>
              </Group>
            }
          >
            <Card withBorder mt={4} mb="sm" p="sm">
              <Text size="xs" mb="xs">{note.summary}</Text>
              <Divider my="xs" label="Diagnoses" labelPosition="left" />
              <Group gap={6} mb="xs">
                {note.diagnoses.map((d, j) => <Badge key={j} size="xs" variant="outline" color="violet">{d}</Badge>)}
              </Group>
              <Divider my="xs" label="Plan" labelPosition="left" />
              <Stack gap={2}>
                {note.plan.map((p, j) => (
                  <Group key={j} gap={6}>
                    <IconCheck size={11} color="green" />
                    <Text size="xs">{p}</Text>
                  </Group>
                ))}
              </Stack>
            </Card>
          </Timeline.Item>
        ))}
      </Timeline>
    </Stack>
  );
}

// ── Medications Tab ───────────────────────────────────────────────────────────

function MedsTab({ patient }: { patient: Patient }): JSX.Element {
  const statusColor: Record<string, string> = { active: 'teal', hold: 'orange', discontinued: 'red' };
  const activeMeds = patient.meds.filter((m) => m.status !== 'discontinued');
  const discMeds   = patient.meds.filter((m) => m.status === 'discontinued');

  return (
    <Stack gap={0} p="md">
      {/* Active & On Hold */}
      <Group gap={8} mb="xs" align="center">
        <ThemeIcon size="sm" color="teal" variant="light"><IconPill size={13} /></ThemeIcon>
        <Text size="sm" fw={700}>Current Medications</Text>
        <Badge size="xs" color="teal" variant="light">{activeMeds.filter((m) => m.status === 'active').length} active</Badge>
        {activeMeds.some((m) => m.status === 'hold') && (
          <Badge size="xs" color="orange" variant="light">{activeMeds.filter((m) => m.status === 'hold').length} on hold</Badge>
        )}
      </Group>

      {activeMeds.length === 0
        ? <Text size="xs" c="dimmed" mb="md">No current medications.</Text>
        : <Table highlightOnHover withTableBorder withColumnBorders mb="xl">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Medication</Table.Th>
                <Table.Th>Dose</Table.Th>
                <Table.Th>Instructions</Table.Th>
                <Table.Th>Started</Table.Th>
                <Table.Th>Last Filled</Table.Th>
                <Table.Th>Refills</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {activeMeds.map((med, i) => (
                <Table.Tr key={i} style={med.refillsLeft === 0 && med.status === 'active' ? { background: '#fff8f0' } : {}}>
                  <Table.Td><Text size="sm" fw={600}>{med.name}</Text></Table.Td>
                  <Table.Td><Text size="sm">{med.dose}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{med.sig}</Text></Table.Td>
                  <Table.Td><Text size="xs">{med.startDate}</Text></Table.Td>
                  <Table.Td><Text size="xs">{med.lastFilled}</Text></Table.Td>
                  <Table.Td>
                    <Badge size="xs" color={med.refillsLeft === 0 ? 'red' : 'green'}>
                      {med.refillsLeft === 0 ? '0 — renewal needed' : med.refillsLeft}
                    </Badge>
                  </Table.Td>
                  <Table.Td><Badge size="xs" color={statusColor[med.status]}>{med.status}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
      }

      {/* Previous Medication Trials */}
      {(discMeds.length > 0 || patient.medTrials.length > 0) && (
        <>
          <Divider my="sm" />
          <Group gap={8} mb="xs" align="center">
            <ThemeIcon size="sm" color="gray" variant="light"><IconMedicalCross size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Medication Trial History</Text>
            <Badge size="xs" color="gray" variant="light">{discMeds.length + patient.medTrials.length} entries</Badge>
          </Group>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Medication</Table.Th>
                <Table.Th>Dose</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Indication</Table.Th>
                <Table.Th>Outcome / Reason Stopped</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {patient.medTrials.map((t, i) => (
                <Table.Tr key={`trial-${i}`} style={t.outcome.toUpperCase().includes('STOP') || t.outcome.toUpperCase().includes('ALLERGY') ? { background: '#fff5f5' } : {}}>
                  <Table.Td><Text size="sm" fw={600}>{t.name}</Text></Table.Td>
                  <Table.Td><Text size="sm">{t.dose}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{t.startDate} → {t.endDate}</Text></Table.Td>
                  <Table.Td><Text size="xs">{t.reason}</Text></Table.Td>
                  <Table.Td>
                    <Text size="xs" c={t.outcome.toUpperCase().includes('STOP') || t.outcome.toUpperCase().includes('ALLERGY') ? 'red' : 'dark'}>
                      {t.outcome}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
              {discMeds.map((med, i) => (
                <Table.Tr key={`disc-${i}`}>
                  <Table.Td><Text size="sm" fw={600}>{med.name}</Text></Table.Td>
                  <Table.Td><Text size="sm">{med.dose}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{med.startDate} → —</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">—</Text></Table.Td>
                  <Table.Td><Badge size="xs" color="red" variant="light">Discontinued</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

// ── Labs Tab ──────────────────────────────────────────────────────────────────

function HistoryTab({ patient }: { patient: Patient }): JSX.Element {
  const renderItems = (items: string[], emptyText: string): JSX.Element =>
    items.length === 0 ? (
      <Text size="xs" c="dimmed">{emptyText}</Text>
    ) : (
      <Stack gap={4}>
        {items.map((item, i) => (
          <Text key={i} size="xs">- {item}</Text>
        ))}
      </Stack>
    );

  return (
    <Stack gap="sm" p="md">
      <Card withBorder p="sm">
        <Group gap={6} mb="xs">
          <ThemeIcon size="sm" color="violet" variant="light"><IconBrain size={13} /></ThemeIcon>
          <Text size="sm" fw={700}>Psychiatric History</Text>
        </Group>
        {renderItems(patient.psychiatricHistory, 'No psychiatric history on file.')}
      </Card>

      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="blue" variant="light"><IconMedicalCross size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Past Medical History</Text>
          </Group>
          {renderItems(patient.pmh, 'No PMH on file.')}
        </Card>

        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="grape" variant="light"><IconMedicalCross size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Past Surgical History</Text>
          </Group>
          {renderItems(patient.psh, 'No surgical history on file.')}
        </Card>
      </Group>

      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="teal" variant="light"><IconBuilding size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Social History</Text>
          </Group>
          {renderItems(patient.socialHistory, 'No social history on file.')}
        </Card>

        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="cyan" variant="light"><IconDroplet size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Substance Use</Text>
          </Group>
          {renderItems(patient.substanceUse, 'No substance use history on file.')}
        </Card>
      </Group>

      <Group gap="sm" align="flex-start" wrap="nowrap">
        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="pink" variant="light"><IconHeart size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Family History</Text>
          </Group>
          {renderItems(patient.familyHistory, 'No family history on file.')}
        </Card>

        <Card withBorder p="sm" style={{ flex: '1 1 0', minWidth: 0 }}>
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="orange" variant="light"><IconBuilding size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Hospitalizations / Crisis</Text>
          </Group>
          {renderItems(patient.hospitalizations, 'No hospitalizations on file.')}
        </Card>
      </Group>
    </Stack>
  );
}

function LabsTab({ patient }: { patient: Patient }): JSX.Element {
  if (patient.labs.length === 0) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <Text c="dimmed" size="sm">No lab results on file.</Text>
      </Box>
    );
  }
  const statusColor: Record<string, string> = { normal: 'green', high: 'orange', low: 'blue', critical: 'red' };
  const statusIcon: Record<string, string> = { normal: '✓', high: '↑', low: '↓', critical: '‼' };
  return (
    <Box p="md">
      <Table highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Test</Table.Th>
            <Table.Th>Result</Table.Th>
            <Table.Th>Units</Table.Th>
            <Table.Th>Reference Range</Table.Th>
            <Table.Th>Date</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {patient.labs.map((lab, i) => (
            <Table.Tr key={i} style={lab.status === 'critical' ? { background: '#fff5f5' } : {}}>
              <Table.Td><Text size="sm">{lab.name}</Text></Table.Td>
              <Table.Td>
                <Text size="sm" fw={lab.status !== 'normal' ? 700 : 400} c={lab.status !== 'normal' ? statusColor[lab.status] : undefined}>
                  {lab.value}
                </Text>
              </Table.Td>
              <Table.Td><Text size="xs" c="dimmed">{lab.unit}</Text></Table.Td>
              <Table.Td><Text size="xs" c="dimmed">{lab.range}</Text></Table.Td>
              <Table.Td><Text size="xs">{lab.date}</Text></Table.Td>
              <Table.Td>
                <Badge size="xs" color={statusColor[lab.status]}>
                  {statusIcon[lab.status]} {lab.status}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

// ── Assessments Tab ───────────────────────────────────────────────────────────

function AssessmentsTab({ patient, patientResource }: { patient: Patient; patientResource?: FhirPatient }): JSX.Element {
  const medplum = useMedplum();
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const sendAssessment = async (tool: string, loinc: string): Promise<void> => {
    if (!patientResource?.id) return;
    setSending((s) => ({ ...s, [tool]: true }));
    try {
      await medplum.createResource<Task>({
        resourceType: 'Task',
        status: 'requested',
        intent: 'order',
        code: {
          coding: [{ system: 'http://loinc.org', code: loinc, display: `${tool} total score` }],
          text: `${tool} questionnaire`,
        },
        description: `${tool} patient self-report questionnaire`,
        for: { reference: `Patient/${patientResource.id}` },
        authoredOn: new Date().toISOString(),
        requester: { display: 'Dr. Logan Carton, NP' },
      });
      setSent((s) => ({ ...s, [tool]: true }));
    } catch {
      // swallow — demo fallback shows nothing
    } finally {
      setSending((s) => ({ ...s, [tool]: false }));
    }
  };

  const SEND_TOOLS: { tool: string; loinc: string }[] = [
    { tool: 'PHQ-9', loinc: '44261-6' },
    { tool: 'GAD-7', loinc: '70274-6' },
    { tool: 'C-SSRS', loinc: '89204-2' },
  ];

  const tools = [...new Set(patient.assessments.map((a) => a.tool))];
  return (
    <Stack gap="lg" p="md">
      {/* Send assessment to patient */}
      <Card withBorder p="sm">
        <Group justify="space-between" mb={8}>
          <Text size="sm" fw={700}>Send Assessment to Patient</Text>
          {!patientResource && <Badge size="xs" color="gray" variant="light">Demo — not saved</Badge>}
        </Group>
        <Group gap="xs">
          {SEND_TOOLS.map(({ tool, loinc }) => (
            <Button
              key={tool}
              size="xs"
              variant={sent[tool] ? 'filled' : 'light'}
              color={sent[tool] ? 'green' : 'blue'}
              leftSection={sent[tool] ? <IconCheck size={12} /> : <IconSend size={12} />}
              loading={sending[tool]}
              disabled={sent[tool]}
              onClick={() => sendAssessment(tool, loinc)}
            >
              {sent[tool] ? `${tool} Sent` : `Send ${tool}`}
            </Button>
          ))}
        </Group>
      </Card>
      {tools.length === 0 && (
        <Box p="xl" style={{ textAlign: 'center' }}>
          <Text c="dimmed" size="sm">No assessments on file.</Text>
        </Box>
      )}
      {tools.map((tool) => {
        const history = patient.assessments
          .filter((a) => a.tool === tool)
          .sort((a, b) => b.date.localeCompare(a.date));
        const latest = history[0];
        return (
          <Card key={tool} withBorder p="sm">
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <ThemeIcon size="sm" color="blue" variant="light"><IconActivity size={13} /></ThemeIcon>
                <Text size="sm" fw={700}>{tool}</Text>
              </Group>
              <Badge color={latest.color} size="sm">{latest.severity}</Badge>
            </Group>
            {/* Score bar */}
            <Box mb="xs">
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">Latest: {latest.date}</Text>
                <Text size="xs" fw={600}>{latest.score} / {latest.maxScore}</Text>
              </Group>
              <Progress value={(latest.score / latest.maxScore) * 100} color={latest.color} size="md" radius="xl" />
            </Box>
            {/* Sparkline trend */}
            {history.length > 1 && (() => {
              const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
              const W = 320, H = 56, padX = 16, padY = 10;
              const innerW = W - padX * 2, innerH = H - padY * 2;
              const colorHex: Record<string, string> = { green: '#2f9e44', yellow: '#e67700', orange: '#e8590c', red: '#e03131', gray: '#868e96' };
              const pts = sorted.map((a, i) => ({
                x: padX + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW),
                y: padY + innerH - (a.score / a.maxScore) * innerH,
                a,
              }));
              return (
                <Box mb="xs">
                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
                    <polyline
                      points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#dee2e6"
                      strokeWidth={2}
                    />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r={4} fill={colorHex[p.a.color] ?? '#868e96'} />
                        <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={9} fill="#868e96" fontFamily="sans-serif">{p.a.score}</text>
                      </g>
                    ))}
                  </svg>
                </Box>
              );
            })()}
            {/* History table */}
            {history.length > 1 && (
              <>
                <Divider my="xs" label="Score history" labelPosition="left" />
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Score</Table.Th>
                      <Table.Th>Severity</Table.Th>
                      <Table.Th>Trend</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {history.map((a, i) => {
                      const prev = history[i + 1];
                      const trend = prev ? (a.score < prev.score ? '↓ Improved' : a.score > prev.score ? '↑ Worsened' : '→ Same') : '—';
                      const trendColor = prev ? (a.score < prev.score ? 'green' : a.score > prev.score ? 'red' : 'gray') : 'gray';
                      return (
                        <Table.Tr key={i}>
                          <Table.Td><Text size="xs">{a.date}</Text></Table.Td>
                          <Table.Td><Text size="xs" fw={600}>{a.score}</Text></Table.Td>
                          <Table.Td><Badge size="xs" color={a.color}>{a.severity}</Badge></Table.Td>
                          <Table.Td><Text size="xs" c={trendColor}>{trend}</Text></Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </>
            )}
          </Card>
        );
      })}
    </Stack>
  );
}

// ── Prior Auth Tab ────────────────────────────────────────────────────────────

type PAStatus = 'approved' | 'pending' | 'denied' | 'expired' | 'not_started';

interface PriorAuth {
  id: string; patient: string; medication: string; dose: string;
  insurance: string; status: PAStatus; submittedDate: string;
  expiryDate?: string; denialReason?: string; cptCodes: string[]; urgent: boolean;
}

const ALL_PRIOR_AUTHS: PriorAuth[] = [
  { id: 'pa-001', patient: 'Sara Mitchell',  medication: 'Vyvanse',       dose: '40mg',  insurance: 'BCBS of MA', status: 'approved',    submittedDate: '03/01/2026', expiryDate: '03/01/2027', cptCodes: ['90833'], urgent: false },
  { id: 'pa-002', patient: 'Kevin Park',     medication: 'Adderall XR',   dose: '20mg',  insurance: 'Aetna',      status: 'pending',     submittedDate: '03/28/2026',                           cptCodes: ['90792'], urgent: false },
  { id: 'pa-003', patient: 'Thomas Reed',    medication: 'Abilify',        dose: '10mg',  insurance: 'Medicare B', status: 'pending',     submittedDate: '03/25/2026',                           cptCodes: ['90833'], urgent: true  },
  { id: 'pa-004', patient: 'Angela Torres',  medication: 'Latuda',         dose: '60mg',  insurance: 'Blue Cross', status: 'denied',      submittedDate: '03/10/2026', denialReason: 'Step therapy required — try Risperidone first', cptCodes: ['90833'], urgent: true },
  { id: 'pa-005', patient: 'Priya Nair',     medication: 'Trintellix',     dose: '10mg',  insurance: 'Aetna',      status: 'approved',    submittedDate: '01/15/2026', expiryDate: '01/15/2027', cptCodes: ['90833'], urgent: false },
  { id: 'pa-006', patient: 'Robert Chen',    medication: 'Strattera',      dose: '80mg',  insurance: 'Medicare B', status: 'expired',     submittedDate: '04/01/2025', expiryDate: '04/01/2026', cptCodes: ['90833'], urgent: true  },
  { id: 'pa-007', patient: 'Maria Lopez',    medication: 'Spravato',       dose: '56mg',  insurance: 'BCBS of MA', status: 'not_started', submittedDate: '',                                     cptCodes: ['90867'], urgent: false },
  { id: 'pa-008', patient: 'Devon Williams', medication: 'Wellbutrin XL',  dose: '300mg', insurance: 'Aetna',      status: 'pending',     submittedDate: '04/01/2026',                           cptCodes: ['90792'], urgent: false },
];

function PriorAuthTab({ patient }: { patient: Patient }): JSX.Element {
  const pas = ALL_PRIOR_AUTHS.filter((pa) => pa.patient === patient.name);

  const statusConfig: Record<PAStatus, { color: string; icon: JSX.Element; label: string }> = {
    approved:    { color: 'green',  icon: <IconCircleCheck size={14} />,   label: 'Approved'    },
    pending:     { color: 'yellow', icon: <IconClockHour4 size={14} />,    label: 'Pending'     },
    denied:      { color: 'red',    icon: <IconCircleX size={14} />,       label: 'Denied'      },
    expired:     { color: 'orange', icon: <IconAlertTriangle size={14} />, label: 'Expired'     },
    not_started: { color: 'gray',   icon: <IconFileInvoice size={14} />,   label: 'Not Started' },
  };

  const groups: { status: PAStatus; label: string }[] = [
    { status: 'denied',      label: 'Denied — Action Required'  },
    { status: 'expired',     label: 'Expired — Renewal Required' },
    { status: 'pending',     label: 'Pending Review'             },
    { status: 'not_started', label: 'Not Started'                },
    { status: 'approved',    label: 'Active Approvals'           },
  ];

  if (pas.length === 0) {
    return (
      <Stack gap="md" p="md" align="center" pt="xl">
        <ThemeIcon size="xl" color="gray" variant="light"><IconShieldCheck size={24} /></ThemeIcon>
        <Text c="dimmed" size="sm">No prior authorizations on file for {patient.name}.</Text>
        <Button size="sm" variant="light" color="teal" leftSection={<IconShieldCheck size={14} />}>
          Start New Prior Auth
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap={0} p="md">
      {/* Summary row */}
      <Group gap="xs" mb="md" wrap="wrap">
        {(['approved', 'pending', 'denied', 'expired', 'not_started'] as PAStatus[]).map((s) => {
          const count = pas.filter((pa) => pa.status === s).length;
          if (count === 0) return null;
          const cfg = statusConfig[s];
          return (
            <Badge key={s} size="sm" color={cfg.color} variant="light" leftSection={cfg.icon}>
              {cfg.label}: {count}
            </Badge>
          );
        })}
      </Group>

      {groups.map(({ status, label }) => {
        const items = pas.filter((pa) => pa.status === status);
        if (items.length === 0) return null;
        const cfg = statusConfig[status];
        return (
          <Box key={status} mb="sm">
            <Group gap={6} px="xs" py={6} style={{ background: '#f8f9fa', borderRadius: 8 }} mb={4}>
              <ThemeIcon size="xs" color={cfg.color} variant="light">{cfg.icon}</ThemeIcon>
              <Text size="xs" fw={700} c={cfg.color}>{label}</Text>
              <Badge size="xs" color={cfg.color} variant="filled">{items.length}</Badge>
            </Group>
            <Stack gap={0}>
              {items.map((pa) => (
                <Card key={pa.id} withBorder p="sm" mb={6} style={{ borderLeft: `3px solid var(--mantine-color-${cfg.color}-5)` }}>
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Box>
                      <Group gap={6} mb={4}>
                        <Text size="sm" fw={700}>{pa.medication} {pa.dose}</Text>
                        {pa.urgent && <Badge size="xs" color="red" variant="filled">Urgent</Badge>}
                        <Badge size="xs" color={cfg.color} variant="light">{cfg.label}</Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mb={2}>{pa.insurance} · CPT: {pa.cptCodes.join(', ')}</Text>
                      {pa.submittedDate && <Text size="xs" c="dimmed">Submitted: {pa.submittedDate}</Text>}
                      {pa.expiryDate && status === 'approved' && <Text size="xs" c="green">Valid through: {pa.expiryDate}</Text>}
                      {pa.expiryDate && status === 'expired'  && <Text size="xs" c="orange">Expired: {pa.expiryDate}</Text>}
                      {pa.denialReason && <Text size="xs" c="red" mt={4}>Reason: {pa.denialReason}</Text>}
                    </Box>
                    <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                      {(status === 'denied' || status === 'expired') && (
                        <Button size="xs" variant="light" color="blue" leftSection={<IconRefresh size={10} />}>
                          Re-submit
                        </Button>
                      )}
                      {status === 'not_started' && (
                        <Button size="xs" variant="light" color="teal" leftSection={<IconShieldCheck size={10} />}>
                          Start PA
                        </Button>
                      )}
                      {status === 'pending' && (
                        <Button size="xs" variant="light" color="yellow" leftSection={<IconClockHour4 size={10} />}>
                          Check Status
                        </Button>
                      )}
                    </Stack>
                  </Group>
                </Card>
              ))}
            </Stack>
          </Box>
        );
      })}

      <Divider my="xs" />
      <Button variant="light" color="teal" size="sm" leftSection={<IconShieldCheck size={14} />} style={{ alignSelf: 'flex-start' }}>
        + New Prior Auth
      </Button>
    </Stack>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

interface Claim {
  patient: string; date: string; cpt: string; description: string;
  amount: number; status: 'paid' | 'pending' | 'denied' | 'unbilled'; payer: string;
}

const ALL_CLAIMS: Claim[] = [
  { patient: 'James Carter',   date: '04/02/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'unbilled', payer: 'United'     },
  { patient: 'Maria Lopez',    date: '04/02/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'unbilled', payer: 'BCBS'       },
  { patient: 'Devon Williams', date: '04/02/2026', cpt: '90792', description: 'Psychiatric Eval',      amount: 320, status: 'unbilled', payer: 'Aetna'      },
  { patient: 'Sara Mitchell',  date: '04/01/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'pending',  payer: 'BCBS'       },
  { patient: 'Thomas Reed',    date: '04/01/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'pending',  payer: 'Medicare'   },
  { patient: 'Priya Nair',     date: '03/28/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'pending',  payer: 'Aetna'      },
  { patient: 'Angela Torres',  date: '03/22/2026', cpt: '99214', description: 'E&M Moderate',          amount: 165, status: 'paid',     payer: 'Blue Cross' },
  { patient: 'Kevin Park',     date: '03/22/2026', cpt: '90792', description: 'Psychiatric Eval',      amount: 320, status: 'paid',     payer: 'Aetna'      },
  { patient: 'Robert Chen',    date: '03/15/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'paid',     payer: 'Medicare'   },
  { patient: 'Linda Hayes',    date: '03/15/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'denied',   payer: 'BCBS'       },
  { patient: 'Marcus Bell',    date: '03/08/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'paid',     payer: 'United'     },
  { patient: 'Sheila Okafor',  date: '03/08/2026', cpt: '99213', description: 'E&M Low Complexity',   amount: 120, status: 'paid',     payer: 'Medicaid'   },
  { patient: 'Sara Mitchell',  date: '03/15/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'paid',     payer: 'BCBS'       },
  { patient: 'Sara Mitchell',  date: '02/15/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'paid',     payer: 'BCBS'       },
  { patient: 'Thomas Reed',    date: '03/01/2026', cpt: '90833', description: 'Psychotherapy w/ E&M',  amount: 185, status: 'paid',     payer: 'Medicare'   },
  { patient: 'Devon Williams', date: '03/10/2026', cpt: '90792', description: 'Psychiatric Eval',      amount: 320, status: 'denied',   payer: 'Aetna'      },
];

function BillingTab({ patient }: { patient: Patient }): JSX.Element {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const claims = ALL_CLAIMS.filter((c) => c.patient === patient.name);

  const unbilled = claims.filter((c) => c.status === 'unbilled');
  const pending  = claims.filter((c) => c.status === 'pending');
  const paid     = claims.filter((c) => c.status === 'paid');
  const denied   = claims.filter((c) => c.status === 'denied');

  const totalUnbilled = unbilled.reduce((s, c) => s + c.amount, 0);
  const totalPending  = pending.reduce((s, c) => s + c.amount, 0);
  const totalPaid     = paid.reduce((s, c) => s + c.amount, 0);
  const totalDenied   = denied.reduce((s, c) => s + c.amount, 0);
  const totalAll      = totalPaid + totalPending + totalUnbilled + totalDenied;

  const statusColor: Record<string, string> = { paid: 'green', pending: 'yellow', denied: 'red', unbilled: 'orange' };

  const ClaimRow = ({ claim }: { claim: Claim }): JSX.Element => (
    <Box style={{ padding: '10px 14px', borderBottom: '1px solid #f1f3f5' }}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap={8} wrap="nowrap">
          <ThemeIcon size="sm" color={statusColor[claim.status]} variant="light">
            <IconCurrencyDollar size={12} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600}>{claim.cpt} · {claim.description}</Text>
            <Text size="xs" c="dimmed">{claim.date} · {claim.payer}</Text>
          </Box>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={700} c={statusColor[claim.status]}>${claim.amount}</Text>
          <Badge size="xs" color={statusColor[claim.status]} variant="light">{claim.status}</Badge>
          {claim.status === 'denied' && (
            <Button size="xs" variant="light" color="red" leftSection={<IconRefresh size={10} />}>Appeal</Button>
          )}
          {claim.status === 'unbilled' && (
            <Button size="xs" variant="light" color="orange" leftSection={<IconReceipt size={10} />}>Submit</Button>
          )}
        </Group>
      </Group>
    </Box>
  );

  if (claims.length === 0) {
    return (
      <Stack gap="md" p="md" align="center" pt="xl">
        <ThemeIcon size="xl" color="gray" variant="light"><IconReceipt size={24} /></ThemeIcon>
        <Text c="dimmed" size="sm">No billing history on file for {patient.name}.</Text>
      </Stack>
    );
  }

  return (
    <Tabs value={activeTab} onChange={(v) => v && setActiveTab(v)}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs.List px="xs" pt={4}>
        <Tabs.Tab value="overview" leftSection={<IconTrendingUp size={12} />}>Overview</Tabs.Tab>
        <Tabs.Tab value="unbilled" leftSection={<IconFileInvoice size={12} />}>
          Unbilled {unbilled.length > 0 && <Badge size="xs" color="orange" ml={4}>{unbilled.length}</Badge>}
        </Tabs.Tab>
        <Tabs.Tab value="pending">
          Pending {pending.length > 0 && <Badge size="xs" color="yellow" ml={4}>{pending.length}</Badge>}
        </Tabs.Tab>
        <Tabs.Tab value="denied">
          Denied {denied.length > 0 && <Badge size="xs" color="red" ml={4}>{denied.length}</Badge>}
        </Tabs.Tab>
        <Tabs.Tab value="paid" leftSection={<IconCircleCheck size={12} />}>
          Paid {paid.length > 0 && <Badge size="xs" color="green" ml={4}>{paid.length}</Badge>}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="overview" style={{ flex: 1, overflow: 'auto' }}>
        <Stack gap="sm" p="md">
          {totalAll > 0 && (
            <Box style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <RingProgress
                size={160}
                thickness={16}
                roundCaps
                sections={[
                  { value: totalAll > 0 ? (totalPaid     / totalAll) * 100 : 0, color: 'green',  tooltip: `Paid: $${totalPaid}`     },
                  { value: totalAll > 0 ? (totalPending  / totalAll) * 100 : 0, color: 'yellow', tooltip: `Pending: $${totalPending}` },
                  { value: totalAll > 0 ? (totalUnbilled / totalAll) * 100 : 0, color: 'orange', tooltip: `Unbilled: $${totalUnbilled}` },
                  { value: totalAll > 0 ? (totalDenied   / totalAll) * 100 : 0, color: 'red',    tooltip: `Denied: $${totalDenied}` },
                ]}
                label={
                  <Box style={{ textAlign: 'center' }}>
                    <Text size="xs" c="dimmed">Revenue</Text>
                    <Text size="lg" fw={800} c="blue">${totalAll.toLocaleString()}</Text>
                    <Text size="xs" c="dimmed">{claims.length} claims</Text>
                  </Box>
                }
              />
            </Box>
          )}

          <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Paid',     amount: totalPaid,     count: paid.length,     color: 'green'  },
              { label: 'Pending',  amount: totalPending,  count: pending.length,  color: 'yellow' },
              { label: 'Unbilled', amount: totalUnbilled, count: unbilled.length, color: 'orange' },
              { label: 'Denied',   amount: totalDenied,   count: denied.length,   color: 'red'    },
            ].map(({ label, amount, count, color }) => (
              <Box key={label} style={{ background: 'white', border: '1px solid #e9ecef', borderRadius: 10, padding: '10px 12px',
                borderTop: `3px solid var(--mantine-color-${color}-5)` }}>
                <Text size="xs" c="dimmed">{label}</Text>
                <Text size="lg" fw={800} c={color}>${amount.toLocaleString()}</Text>
                <Text size="xs" c="dimmed">{count} claim{count !== 1 ? 's' : ''}</Text>
              </Box>
            ))}
          </Box>

          <Divider label="All Claims" labelPosition="center" />
          <Stack gap={0}>
            {claims.map((c, i) => <ClaimRow key={i} claim={c} />)}
          </Stack>
        </Stack>
      </Tabs.Panel>

      {(['unbilled', 'pending', 'denied', 'paid'] as const).map((status) => (
        <Tabs.Panel key={status} value={status} style={{ flex: 1, overflow: 'auto' }}>
          <Stack gap={0}>
            {status === 'unbilled' && unbilled.length > 0 && (
              <Box px="sm" py="xs" style={{ background: '#fff8f0', borderBottom: '1px solid #ffd8a8' }}>
                <Group justify="space-between">
                  <Text size="xs" c="orange" fw={600}>${totalUnbilled} not yet submitted</Text>
                  <Button size="xs" color="orange" variant="light">Submit All</Button>
                </Group>
              </Box>
            )}
            {status === 'denied' && denied.length > 0 && (
              <Box px="sm" py="xs" style={{ background: '#fff5f5', borderBottom: '1px solid #ffc9c9' }}>
                <Group justify="space-between">
                  <Text size="xs" c="red" fw={600}>${totalDenied} denied — appeal within 90 days</Text>
                  <Button size="xs" color="red" variant="light">Appeal All</Button>
                </Group>
              </Box>
            )}
            {claims.filter((c) => c.status === status).length === 0
              ? <Text size="sm" c="dimmed" p="md">No {status} claims for this patient.</Text>
              : claims.filter((c) => c.status === status).map((c, i) => <ClaimRow key={i} claim={c} />)
            }
          </Stack>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

// ── Main Chart Component ──────────────────────────────────────────────────────

export function PatientChart(): JSX.Element {
  const { patientSlug } = useParams<{ patientSlug: string }>();
  const navigate = useNavigate();
  const [alertsOpen, setAlertsOpen] = useState(true);

  const mockPatient = patientSlug ? getPatient(patientSlug) : null;
  const { patient: livePatient, loading, patientResource } = useLivePatientRecord(mockPatient ? undefined : patientSlug);
  const patient = livePatient ?? mockPatient;

  if (loading && !patient) {
    return <Loading />;
  }

  if (!patient) {
    return (
      <Box p="xl">
        <Button variant="subtle" leftSection={<IconArrowLeft size={14} />} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
        <Text mt="md" c="dimmed">Patient not found.</Text>
      </Box>
    );
  }

  const alerts = computeAlerts(patient);
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts  = alerts.filter((a) => a.severity === 'warning');


  const alertColor = criticalAlerts.length > 0 ? 'red' : warningAlerts.length > 0 ? 'orange' : 'blue';
  const alertBg    = criticalAlerts.length > 0 ? '#fff5f5' : warningAlerts.length > 0 ? '#fff8f0' : '#f0f4ff';
  const alertBorder = criticalAlerts.length > 0 ? '#ffc9c9' : warningAlerts.length > 0 ? '#ffd8a8' : '#bac8ff';

  return (
    <Box className={classes.chart}>
      {/* Patient Header */}
      <Box className={classes.header}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group align="flex-start" gap="md" wrap="nowrap">
            <ActionIcon variant="subtle" size="md" onClick={() => navigate('/dashboard')}>
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Box>
              <Group gap="xs" align="center" mb={2}>
                <Title order={3}>{patient.name}</Title>
                <Text size="sm" c="dimmed">{patient.pronouns}</Text>
                {patient.flags.map((f) => (
                  <Badge key={f} size="sm" color="red" variant="filled" leftSection={<IconAlertTriangle size={10} />}>{f}</Badge>
                ))}
              </Group>
              <Group gap="xl" wrap="wrap">
                <Text size="xs" c="dimmed">DOB: <Text span fw={600} c="dark">{patient.dob}</Text></Text>
                <Text size="xs" c="dimmed">Age: <Text span fw={600} c="dark">{patient.age}</Text></Text>
                <Text size="xs" c="dimmed">MRN: <Text span fw={600} c="dark">{patient.mrn}</Text></Text>
                <Text size="xs" c="dimmed">Insurance: <Text span fw={600} c="dark">{patient.insurance}</Text></Text>
                <Text size="xs" c="dimmed">PCP: <Text span fw={600} c="dark">{patient.pcp}</Text></Text>
                <Group gap={4}>
                  <IconPhone size={12} color="#868e96" />
                  <Text size="xs" c="dimmed">{patient.phone}</Text>
                </Group>
              </Group>
            </Box>
          </Group>

          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label="Send Message">
              <ActionIcon variant="light" size="md"><IconExternalLink size={15} /></ActionIcon>
            </Tooltip>
            <Tooltip label="Send Questionnaire">
              <ActionIcon variant="light" size="md" color="violet"><IconClipboardList size={15} /></ActionIcon>
            </Tooltip>
            <Button
              size="sm"
              variant="light"
              color="blue"
              leftSection={<IconEdit size={14} />}
              onClick={() => navigate(`/chart/${patientSlug}/note`)}
            >
              New Note
            </Button>
            <Button
              size="sm"
              color="red"
              leftSection={<IconMicrophone size={14} />}
            >
              Start Visit
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Clinical Alerts Banner */}
      {alerts.length > 0 && (
        <Box style={{ background: alertBg, borderBottom: `1px solid ${alertBorder}`, flexShrink: 0 }}>
          <Box
            style={{ padding: '6px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={() => setAlertsOpen((o) => !o)}
          >
            <Group gap={8}>
              <IconAlertTriangle size={14} color={alertColor === 'red' ? '#e03131' : alertColor === 'orange' ? '#e8590c' : '#1971c2'} />
              <Text size="xs" fw={700} c={alertColor}>
                {alerts.length} Clinical Alert{alerts.length !== 1 ? 's' : ''}
                {criticalAlerts.length > 0 && ` · ${criticalAlerts.length} critical`}
                {warningAlerts.length > 0 && ` · ${warningAlerts.length} warnings`}
              </Text>
            </Group>
            {alertsOpen ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
          </Box>
          <Collapse in={alertsOpen}>
            <Stack gap={0} pb={6}>
              {alerts.map((alert: ClinicalAlert) => (
                <Group key={alert.id} gap="xs" px="xl" py={4} wrap="nowrap"
                  style={{ borderTop: `1px solid ${alertBorder}` }}>
                  <Badge size="xs" color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue'}
                    variant="filled" style={{ flexShrink: 0, textTransform: 'uppercase' }}>
                    {alert.severity}
                  </Badge>
                  <Text size="xs" fw={600} style={{ flexShrink: 0 }}>{alert.title}</Text>
                  <Text size="xs" c="dimmed">— {alert.detail}</Text>
                  <Badge size="xs" color="gray" variant="outline" style={{ flexShrink: 0, marginLeft: 'auto' }}>
                    {alert.action}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </Collapse>
        </Box>
      )}

      <Box className={classes.body}>
        <Box className={classes.main}>
      {/* Chart Tabs */}
      <Tabs defaultValue="overview" className={classes.tabs}>
        <Tabs.List className={classes.tabList}>
          <Tabs.Tab value="overview"     leftSection={<IconUser size={13} />}>Overview</Tabs.Tab>
          <Tabs.Tab value="notes"        leftSection={<IconNotes size={13} />}>
            Notes
            {patient.notes.length > 0 && <Badge size="xs" ml={6} variant="light">{patient.notes.length}</Badge>}
          </Tabs.Tab>
          <Tabs.Tab value="medications"  leftSection={<IconPill size={13} />}>
            Medications
            {patient.meds.filter((m) => m.status === 'active').length > 0 && (
              <Badge size="xs" ml={6} color="teal" variant="light">
                {patient.meds.filter((m) => m.status === 'active').length} active
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="labs"         leftSection={<IconFlask size={13} />}>
            Labs
            {patient.labs.some((l) => l.status !== 'normal') && (
              <Badge size="xs" ml={6} color="orange" variant="light">!</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="assessments"  leftSection={<IconChartLine size={13} />}>Assessments</Tabs.Tab>
          <Tabs.Tab value="history"      leftSection={<IconCalendar size={13} />}>History</Tabs.Tab>
          <Tabs.Tab value="priorauth"    leftSection={<IconShieldCheck size={13} />}>
            Prior Auth
            {ALL_PRIOR_AUTHS.filter((pa) => pa.patient === patient.name && (pa.status === 'denied' || pa.status === 'expired')).length > 0 && (
              <Badge size="xs" ml={6} color="red" variant="filled">!</Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="billing"      leftSection={<IconReceipt size={13} />}>
            Billing
            {ALL_CLAIMS.filter((c) => c.patient === patient.name && c.status === 'unbilled').length > 0 && (
              <Badge size="xs" ml={6} color="orange" variant="filled">
                {ALL_CLAIMS.filter((c) => c.patient === patient.name && c.status === 'unbilled').length}
              </Badge>
            )}
          </Tabs.Tab>
        </Tabs.List>

        <Box className={classes.tabContent}>
          <Tabs.Panel value="overview">
            <ScrollArea h="100%"><OverviewTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="notes">
            <ScrollArea h="100%"><NotesTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="medications">
            <ScrollArea h="100%"><MedsTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="labs">
            <ScrollArea h="100%"><LabsTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="assessments">
            <ScrollArea h="100%"><AssessmentsTab patient={patient} patientResource={patientResource} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="priorauth">
            <ScrollArea h="100%"><PriorAuthTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="billing">
            <BillingTab patient={patient} />
          </Tabs.Panel>
          <Tabs.Panel value="history">
            <ScrollArea h="100%"><HistoryTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
        </Box>
      </Tabs>
        </Box>
        <Storyboard patient={patient} />
      </Box>
    </Box>
  );
}

// Export slug helper for use in dashboard
export { nameToSlug };


