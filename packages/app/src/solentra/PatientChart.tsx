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
  IconEdit,
  IconExternalLink,
  IconFileInvoice,
  IconFlask,
  IconMicrophone,
  IconNotes,
  IconPill,
  IconPhone,
  IconReceipt,
  IconRefresh,
  IconShieldCheck,
  IconTrendingUp,
  IconUser,
} from '@tabler/icons-react';
import { Loading } from '@medplum/react';
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
export interface Patient {
  name: string; dob: string; age: number; mrn: string;
  pronouns: string; phone: string; insurance: string; pcp: string;
  diagnoses: string[]; allergies: string[]; flags: string[];
  meds: Medication[]; labs: Lab[]; notes: Note[]; assessments: Assessment[];
  socialHistory: string[]; familyHistory: string[];
  hospitalizations: string[];
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
    socialHistory: [
      'Lives alone in apartment; supportive sister nearby',
      'Works as a graphic designer (remote)',
      'Non-smoker; occasional alcohol (1–2 drinks/week)',
      'No illicit drug use; denies cannabis',
      'Recent relationship ended November 2025',
    ],
    familyHistory: [
      'Mother: Depression, treated with Prozac',
      'Father: Alcohol use disorder',
      'Maternal aunt: Bipolar I',
    ],
    hospitalizations: [
      '2019 — Inpatient psychiatric, 5-day stay post-overdose (Tylenol, non-lethal). McLean Hospital.',
    ],
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
    socialHistory: ['Retired teacher', 'Married, 2 adult children', 'Non-smoker, no alcohol'],
    familyHistory: ['Father: Bipolar disorder'],
    hospitalizations: ['2021 — Acute manic episode, inpatient 7 days'],
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
    socialHistory: ['Works in tech (software engineering)', 'Single', 'Cannabis use occasionally'],
    familyHistory: ['Mother: Anxiety disorder', 'No known psychiatric hospitalizations'],
    hospitalizations: [],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function getPatient(slug: string): Patient | null {
  return PATIENTS[slug] ?? null;
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ patient }: { patient: Patient }): JSX.Element {
  const latestPHQ = patient.assessments.filter((a) => a.tool === 'PHQ-9').sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestGAD = patient.assessments.filter((a) => a.tool === 'GAD-7').sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestNote = patient.notes[0];

  return (
    <Stack gap="md" p="md">
      <Group gap="md" align="flex-start" wrap="wrap">
        {/* Diagnoses */}
        <Card withBorder flex={1} miw={280} p="sm">
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="violet" variant="light"><IconClipboardList size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Active Diagnoses</Text>
          </Group>
          <Stack gap={4}>
            {patient.diagnoses.map((d, i) => (
              <Group key={i} gap={6} wrap="nowrap">
                <Box w={6} h={6} style={{ borderRadius: '50%', background: '#7950f2', flexShrink: 0, marginTop: 2 }} />
                <Text size="xs">{d}</Text>
              </Group>
            ))}
            {patient.diagnoses.length === 0 && <Text size="xs" c="dimmed">No active diagnoses</Text>}
          </Stack>
        </Card>

        {/* Allergies */}
        <Card withBorder miw={200} p="sm">
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="red" variant="light"><IconAlertTriangle size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Allergies</Text>
          </Group>
          <Stack gap={4}>
            {patient.allergies.map((a, i) => <Badge key={i} size="sm" color="red" variant="light" fullWidth style={{ textAlign: 'left' }}>{a}</Badge>)}
            {patient.allergies.length === 0 && <Text size="xs" c="dimmed">NKDA</Text>}
          </Stack>
        </Card>

        {/* Scores */}
        {(latestPHQ || latestGAD) && (
          <Card withBorder miw={220} p="sm">
            <Group gap={6} mb="xs">
              <ThemeIcon size="sm" color="blue" variant="light"><IconChartLine size={13} /></ThemeIcon>
              <Text size="sm" fw={700}>Latest Scores</Text>
            </Group>
            <Stack gap={8}>
              {latestPHQ && (
                <Box>
                  <Group justify="space-between" mb={2}>
                    <Text size="xs" fw={600}>PHQ-9</Text>
                    <Badge size="xs" color={latestPHQ.color}>{latestPHQ.score} — {latestPHQ.severity}</Badge>
                  </Group>
                  <Progress value={(latestPHQ.score / latestPHQ.maxScore) * 100} color={latestPHQ.color} size="sm" />
                </Box>
              )}
              {latestGAD && (
                <Box>
                  <Group justify="space-between" mb={2}>
                    <Text size="xs" fw={600}>GAD-7</Text>
                    <Badge size="xs" color={latestGAD.color}>{latestGAD.score} — {latestGAD.severity}</Badge>
                  </Group>
                  <Progress value={(latestGAD.score / latestGAD.maxScore) * 100} color={latestGAD.color} size="sm" />
                </Box>
              )}
            </Stack>
          </Card>
        )}
      </Group>

      {/* Active Meds Summary */}
      {patient.meds.length > 0 && (
        <Card withBorder p="sm">
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="teal" variant="light"><IconPill size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Active Medications</Text>
          </Group>
          <Group gap="xs" wrap="wrap">
            {patient.meds.filter((m) => m.status === 'active').map((m, i) => (
              <Badge key={i} size="sm" variant="outline" color="teal">{m.name} {m.dose}</Badge>
            ))}
            {patient.meds.filter((m) => m.status === 'hold').map((m, i) => (
              <Badge key={i} size="sm" variant="outline" color="orange">{m.name} {m.dose} (hold)</Badge>
            ))}
          </Group>
        </Card>
      )}

      {/* Last Note Snippet */}
      {latestNote && (
        <Card withBorder p="sm">
          <Group justify="space-between" mb="xs">
            <Group gap={6}>
              <ThemeIcon size="sm" color="gray" variant="light"><IconNotes size={13} /></ThemeIcon>
              <Text size="sm" fw={700}>Last Note</Text>
              <Text size="xs" c="dimmed">{latestNote.date} · {latestNote.type} · {latestNote.provider}</Text>
            </Group>
          </Group>
          <Text size="xs" lineClamp={3}>{latestNote.summary}</Text>
          <Divider my="xs" />
          <Text size="xs" fw={600} mb={4}>Plan</Text>
          <Stack gap={2}>
            {latestNote.plan.map((p, i) => (
              <Group key={i} gap={6}>
                <IconCheck size={11} color="green" />
                <Text size="xs">{p}</Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      {/* Social & Family */}
      <Group gap="md" align="flex-start" wrap="wrap">
        <Card withBorder flex={1} miw={250} p="sm">
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="indigo" variant="light"><IconUser size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Social History</Text>
          </Group>
          <Stack gap={3}>
            {patient.socialHistory.map((s, i) => <Text key={i} size="xs">• {s}</Text>)}
          </Stack>
        </Card>
        <Card withBorder flex={1} miw={250} p="sm">
          <Group gap={6} mb="xs">
            <ThemeIcon size="sm" color="grape" variant="light"><IconShieldCheck size={13} /></ThemeIcon>
            <Text size="sm" fw={700}>Family History</Text>
          </Group>
          <Stack gap={3}>
            {patient.familyHistory.map((f, i) => <Text key={i} size="xs">• {f}</Text>)}
          </Stack>
          {patient.hospitalizations.length > 0 && (
            <>
              <Text size="xs" fw={700} mt="sm" mb={4}>Hospitalizations</Text>
              {patient.hospitalizations.map((h, i) => <Text key={i} size="xs" c="dimmed">• {h}</Text>)}
            </>
          )}
        </Card>
      </Group>
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
  if (patient.meds.length === 0) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <Text c="dimmed" size="sm">No medications on file.</Text>
      </Box>
    );
  }
  const statusColor: Record<string, string> = { active: 'teal', hold: 'orange', discontinued: 'red' };
  return (
    <Box p="md">
      <Table highlightOnHover withTableBorder withColumnBorders>
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
          {patient.meds.map((med, i) => (
            <Table.Tr key={i}>
              <Table.Td><Text size="sm" fw={600}>{med.name}</Text></Table.Td>
              <Table.Td><Text size="sm">{med.dose}</Text></Table.Td>
              <Table.Td><Text size="xs" c="dimmed">{med.sig}</Text></Table.Td>
              <Table.Td><Text size="xs">{med.startDate}</Text></Table.Td>
              <Table.Td><Text size="xs">{med.lastFilled}</Text></Table.Td>
              <Table.Td>
                <Badge size="xs" color={med.refillsLeft === 0 ? 'red' : 'green'}>
                  {med.refillsLeft === 0 ? 'None' : med.refillsLeft}
                </Badge>
              </Table.Td>
              <Table.Td><Badge size="xs" color={statusColor[med.status]}>{med.status}</Badge></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

// ── Labs Tab ──────────────────────────────────────────────────────────────────

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

function AssessmentsTab({ patient }: { patient: Patient }): JSX.Element {
  const tools = [...new Set(patient.assessments.map((a) => a.tool))];
  if (tools.length === 0) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <Text c="dimmed" size="sm">No assessments on file.</Text>
      </Box>
    );
  }
  return (
    <Stack gap="lg" p="md">
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
  const { patient: livePatient, loading } = useLivePatientRecord(mockPatient ? undefined : patientSlug);
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
            <ScrollArea h="100%"><AssessmentsTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="priorauth">
            <ScrollArea h="100%"><PriorAuthTab patient={patient} /></ScrollArea>
          </Tabs.Panel>
          <Tabs.Panel value="billing">
            <BillingTab patient={patient} />
          </Tabs.Panel>
          <Tabs.Panel value="history">
            <ScrollArea h="100%">
              <Stack gap="md" p="md">
                <Card withBorder p="sm">
                  <Text size="sm" fw={700} mb="xs">Hospitalizations / Crisis History</Text>
                  {patient.hospitalizations.length === 0
                    ? <Text size="xs" c="dimmed">No hospitalizations on file.</Text>
                    : patient.hospitalizations.map((h, i) => <Text key={i} size="xs">• {h}</Text>)
                  }
                </Card>
                <Card withBorder p="sm">
                  <Text size="sm" fw={700} mb="xs">Social History</Text>
                  {patient.socialHistory.map((s, i) => <Text key={i} size="xs">• {s}</Text>)}
                </Card>
                <Card withBorder p="sm">
                  <Text size="sm" fw={700} mb="xs">Family History</Text>
                  {patient.familyHistory.map((f, i) => <Text key={i} size="xs">• {f}</Text>)}
                </Card>
              </Stack>
            </ScrollArea>
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Box>
  );
}

// Export slug helper for use in dashboard
export { nameToSlug };
