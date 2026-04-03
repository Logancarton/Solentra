// Solentra Visit Note Writer
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconMicrophone,
  IconPencil,
  IconRobot,
  IconSignature,
  IconTrash,
} from '@tabler/icons-react';
import { getReferenceString } from '@medplum/core';
import type { Composition, Encounter, Observation } from '@medplum/fhirtypes';
import { Loading, useMedplum } from '@medplum/react';
import type { JSX, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PATIENTS } from './PatientChart';
import { stripXhtml, useLivePatientRecord } from './patientData';
import classes from './VisitNote.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type NoteTemplate = 'follow-up' | 'new-patient' | 'med-management' | 'crisis';

interface MedChange {
  medication: string; dose: string; change: string; reason: string;
}

interface NoteState {
  template: NoteTemplate;
  chiefComplaint: string;
  intervalHistory: string;
  // Subjective symptom ratings
  moodRating: number | string;
  sleepHours: number | string;
  sleepQuality: string;
  appetite: string;
  energy: string;
  concentration: string;
  anxiety: string;
  siHi: string;
  siDetail: string;
  // MSE quick-click selections
  mse: Record<string, string>;
  // Assessment & Plan
  diagnoses: string[];
  medChanges: MedChange[];
  planNotes: string;
  followUpWeeks: number | string;
  safetyPlan: boolean;
  labsOrdered: string;
  // Assessment scores
  phq9Score: number | string;
  gad7Score: number | string;
  // Billing
  cptCode: string;
  timeSpent: number | string;
  complexity: string;
  // Meta
  status: 'draft' | 'signed';
}

// ── MSE quick-click options ───────────────────────────────────────────────────

const MSE_FIELDS: { key: string; label: string; options: string[] }[] = [
  { key: 'appearance',     label: 'Appearance',      options: ['Well-groomed', 'Appropriate', 'Disheveled', 'Unkempt'] },
  { key: 'behavior',       label: 'Behavior',        options: ['Cooperative', 'Guarded', 'Agitated', 'Psychomotor slowing', 'Psychomotor agitation'] },
  { key: 'eyeContact',     label: 'Eye Contact',     options: ['Normal', 'Avoidant', 'Intense', 'Poor'] },
  { key: 'speech',         label: 'Speech',          options: ['Normal rate/rhythm', 'Pressured', 'Slowed', 'Soft', 'Loud', 'Monotone'] },
  { key: 'mood',           label: 'Mood (reported)', options: ['Euthymic', 'Depressed', 'Anxious', 'Elevated', 'Irritable', 'Mixed', 'Labile'] },
  { key: 'affect',         label: 'Affect',          options: ['Congruent', 'Blunted', 'Flat', 'Labile', 'Restricted', 'Bright', 'Dysphoric'] },
  { key: 'thoughtProcess', label: 'Thought Process', options: ['Logical/Linear', 'Tangential', 'Circumstantial', 'Disorganized', 'Flight of ideas', 'Thought blocking'] },
  { key: 'thoughtContent', label: 'Thought Content', options: ['No SI', 'Passive SI', 'Active SI w/o plan', 'Active SI w/ plan', 'No HI', 'HI present'] },
  { key: 'perception',     label: 'Perception',      options: ['No AVH', 'Auditory hallucinations', 'Visual hallucinations', 'Paranoid ideation'] },
  { key: 'cognition',      label: 'Cognition',       options: ['Grossly intact', 'Mildly impaired', 'Moderately impaired'] },
  { key: 'insight',        label: 'Insight',         options: ['Good', 'Fair', 'Poor', 'Absent'] },
  { key: 'judgment',       label: 'Judgment',        options: ['Good', 'Fair', 'Poor'] },
];

const NORMAL_MSE: Record<string, string> = {
  appearance: 'Well-groomed', behavior: 'Cooperative', eyeContact: 'Normal',
  speech: 'Normal rate/rhythm', mood: 'Euthymic', affect: 'Congruent',
  thoughtProcess: 'Logical/Linear', thoughtContent: 'No SI', perception: 'No AVH',
  cognition: 'Grossly intact', insight: 'Good', judgment: 'Good',
};

const CPT_OPTIONS = [
  { value: '90792', label: '90792 — Psychiatric Diagnostic Eval w/ Medical Services' },
  { value: '90791', label: '90791 — Psychiatric Diagnostic Evaluation' },
  { value: '90833', label: '90833 — Psychotherapy add-on (16–37 min) w/ E&M' },
  { value: '90836', label: '90836 — Psychotherapy add-on (38–52 min) w/ E&M' },
  { value: '90838', label: '90838 — Psychotherapy add-on (53+ min) w/ E&M' },
  { value: '99213', label: '99213 — E&M Office Visit, Low Complexity' },
  { value: '99214', label: '99214 — E&M Office Visit, Moderate Complexity' },
  { value: '99215', label: '99215 — E&M Office Visit, High Complexity' },
];

const TEMPLATE_LABELS: Record<NoteTemplate, string> = {
  'follow-up':      'Follow-up',
  'new-patient':    'New Patient Evaluation',
  'med-management': 'Med Management',
  'crisis':         'Crisis Assessment',
};

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, badge, defaultOpen = true, children }: {
  title: string; badge?: string; defaultOpen?: boolean; children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box className={classes.section}>
      <Box className={classes.sectionHeader} onClick={() => setOpen(!open)}>
        <Group justify="space-between">
          <Group gap={8}>
            <Text size="sm" fw={700}>{title}</Text>
            {badge && <Badge size="xs" color="blue" variant="light">{badge}</Badge>}
          </Group>
          {open ? <IconChevronUp size={14} color="#adb5bd" /> : <IconChevronDown size={14} color="#adb5bd" />}
        </Group>
      </Box>
      {open && <Box className={classes.sectionBody}>{children}</Box>}
    </Box>
  );
}

// ── AI fill button ────────────────────────────────────────────────────────────

function AiFill({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <Tooltip label={`AI: Fill ${label}`} position="right">
      <ActionIcon size="sm" variant="light" color="blue" onClick={onClick}>
        <IconRobot size={13} />
      </ActionIcon>
    </Tooltip>
  );
}

// ── MSE Quick-click grid ──────────────────────────────────────────────────────

function MseGrid({ mse, onChange }: {
  mse: Record<string, string>;
  onChange: (key: string, val: string) => void;
}): JSX.Element {
  return (
    <Stack gap={8}>
      <Group gap={6} mb={2}>
        <Button size="xs" variant="light" color="green"
          onClick={() => MSE_FIELDS.forEach((f) => onChange(f.key, NORMAL_MSE[f.key]))}>
          ✓ Fill All Normal
        </Button>
        <Button size="xs" variant="light" color="gray"
          onClick={() => MSE_FIELDS.forEach((f) => onChange(f.key, ''))}>
          Clear All
        </Button>
      </Group>
      {MSE_FIELDS.map((field) => (
        <Box key={field.key}>
          <Text size="xs" fw={600} c="dimmed" mb={4}>{field.label}</Text>
          <Group gap={4} wrap="wrap">
            {field.options.map((opt) => {
              const selected = mse[field.key] === opt;
              const isAlert = opt.includes('SI') || opt.includes('HI') || opt.includes('hallucin') || opt.includes('Paranoid');
              return (
                <Box
                  key={opt}
                  className={`${classes.mseChip} ${selected ? (isAlert ? classes.mseChipAlert : classes.mseChipSelected) : ''}`}
                  onClick={() => onChange(field.key, selected ? '' : opt)}
                >
                  {opt}
                </Box>
              );
            })}
          </Group>
        </Box>
      ))}
    </Stack>
  );
}

// ── MSE narrative builder ─────────────────────────────────────────────────────

function buildMseNarrative(mse: Record<string, string>): string {
  const parts = MSE_FIELDS
    .map((f) => mse[f.key])
    .filter(Boolean);
  if (parts.length === 0) return '';
  return `Patient presents as ${mse.appearance?.toLowerCase() ?? 'appropriately dressed'}. Behavior is ${mse.behavior?.toLowerCase() ?? 'cooperative'} with ${mse.eyeContact?.toLowerCase() ?? 'normal'} eye contact. Speech is ${mse.speech?.toLowerCase() ?? 'normal'}. Mood is ${mse.mood?.toLowerCase() ?? 'euthymic'} with ${mse.affect?.toLowerCase() ?? 'congruent'} affect. Thought process is ${mse.thoughtProcess?.toLowerCase() ?? 'logical and linear'}. Thought content: ${mse.thoughtContent ?? 'no SI/HI'}. Perception: ${mse.perception ?? 'no AVH'}. Cognition ${mse.cognition?.toLowerCase() ?? 'grossly intact'}. Insight ${mse.insight?.toLowerCase() ?? 'good'}, judgment ${mse.judgment?.toLowerCase() ?? 'good'}.`;
}

// ── Main VisitNote component ──────────────────────────────────────────────────

// ── FHIR helpers ─────────────────────────────────────────────────────────────

function escapeNarrativeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function xhtml(text: string): string {
  return `<div xmlns="http://www.w3.org/1999/xhtml">${escapeNarrativeText(text).replace(/\n/g, '<br/>')}</div>`;
}

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildComposition(
  note: NoteState,
  patientRef: string,
  encounterRef: string,
  existingId?: string
): Composition {
  const templateLabel = TEMPLATE_LABELS[note.template];
  const sections: Composition['section'] = [
    { title: 'Chief Complaint',   text: { status: 'generated', div: xhtml(note.chiefComplaint   || '(not documented)') } },
    { title: 'Interval History',  text: { status: 'generated', div: xhtml(note.intervalHistory   || '(not documented)') } },
    {
      title: 'Symptoms',
      text: {
        status: 'generated',
        div: xhtml(
          `Mood: ${note.moodRating || 'not rated'}/10 | Sleep: ${note.sleepHours || '?'} hrs (${note.sleepQuality || '?'}) | ` +
          `Appetite: ${note.appetite || '?'} | Energy: ${note.energy || '?'} | Concentration: ${note.concentration || '?'} | ` +
          `Anxiety: ${note.anxiety || '?'} | SI/HI: ${note.siHi}${note.siDetail ? ' — ' + note.siDetail : ''}`
        ),
      },
    },
    { title: 'Mental Status Exam', text: { status: 'generated', div: xhtml(buildMseNarrative(note.mse) || '(not documented)') } },
    {
      title: 'Assessment',
      text: {
        status: 'generated',
        div: xhtml('Diagnoses:\n' + (note.diagnoses.length > 0 ? note.diagnoses.join('\n') : '(none listed)')),
      },
    },
    {
      title: 'Plan',
      text: {
        status: 'generated',
        div: xhtml(
          [
            note.planNotes,
            note.medChanges.length > 0
              ? 'Medication changes:\n' + note.medChanges.map((m) => `${m.change} ${m.medication} ${m.dose} — ${m.reason}`).join('\n')
              : '',
            note.labsOrdered ? `Labs ordered: ${note.labsOrdered}` : '',
            note.safetyPlan ? 'Safety plan reviewed and updated.' : '',
            `Follow up in ${note.followUpWeeks} weeks.`,
          ]
            .filter(Boolean)
            .join('\n')
        ),
      },
    },
    {
      title: 'Billing',
      text: {
        status: 'generated',
        div: xhtml(`CPT: ${note.cptCode} | Time: ${note.timeSpent} min | Complexity: ${note.complexity}`),
      },
    },
  ];

  return {
    ...(existingId ? { id: existingId } : {}),
    resourceType: 'Composition',
    status: note.status === 'signed' ? 'final' : 'preliminary',
    type: {
      coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }],
      text: templateLabel,
    },
    subject: { reference: patientRef },
    encounter: { reference: encounterRef },
    date: new Date().toISOString(),
    author: [{ display: 'Dr. Logan Carton, NP' }],
    title: `${templateLabel} — ${new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}`,
    section: sections,
  };
}

export function VisitNote(): JSX.Element {
  const { patientSlug } = useParams<{ patientSlug: string }>();
  const navigate = useNavigate();
  const medplum = useMedplum();
  const mockPatient = patientSlug ? PATIENTS[patientSlug] : null;
  const { patient: livePatient, loading, patientResource } = useLivePatientRecord(mockPatient ? undefined : patientSlug);
  const patient = livePatient ?? mockPatient;

  // FHIR Encounter + Composition refs — survive re-renders without triggering them
  const encounterRef = useRef<string | null>(null);
  const compositionId = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const isFhirPatient = Boolean(patientResource?.id);

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const [note, setNote] = useState<NoteState>({
    template: 'follow-up',
    chiefComplaint: '',
    intervalHistory: '',
    moodRating: '',
    sleepHours: '',
    sleepQuality: '',
    appetite: '',
    energy: '',
    concentration: '',
    anxiety: '',
    siHi: 'Denies SI/HI',
    siDetail: '',
    mse: {},
    diagnoses: patient?.diagnoses ?? [],
    medChanges: [],
    planNotes: '',
    followUpWeeks: 4,
    safetyPlan: false,
    labsOrdered: '',
    phq9Score: '',
    gad7Score: '',
    cptCode: '90833',
    timeSpent: 30,
    complexity: 'Moderate',
    status: 'draft',
  });

  const set = (patch: Partial<NoteState>): void => setNote((prev) => ({ ...prev, ...patch }));
  const setMse = (key: string, val: string): void => set({ mse: { ...note.mse, [key]: val } });

  const mseNarrative = buildMseNarrative(note.mse);
  const hasSiFlag = note.mse.thoughtContent?.includes('SI') && !note.mse.thoughtContent?.includes('No SI');

  useEffect(() => {
    if (patient && note.diagnoses.length === 0) {
      set({ diagnoses: patient.diagnoses });
    }
  }, [note.diagnoses.length, patient]);

  // On mount with a live patient: resume today's draft Composition if one exists
  useEffect(() => {
    if (!patientResource?.id) return;
    const patRef = `Patient/${patientResource.id}`;
    const todayStr = formatLocalDate(new Date());
    medplum
      .searchResources('Composition', {
        subject: patRef,
        date: `ge${todayStr}`,
        status: 'preliminary',
        _count: 1,
        _sort: '-date',
      })
      .then((results) => {
        if (results.length === 0 || !results[0].id) return;
        const comp = results[0];
        compositionId.current = comp.id as string;
        if (comp.encounter?.reference) {
          encounterRef.current = comp.encounter.reference;
        }
        const getSection = (title: string) => comp.section?.find((s) => s.title === title);
        const cc = stripXhtml(getSection('Chief Complaint')?.text?.div);
        const hpi = stripXhtml(getSection('Interval History')?.text?.div);
        const rawAssessment = stripXhtml(getSection('Assessment')?.text?.div);
        const rawPlan = stripXhtml(getSection('Plan')?.text?.div);
        const diagLines = rawAssessment
          .replace(/^Diagnoses:\s*/i, '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        // Take plan text up to first "Medication changes:" line
        const planNotes = rawPlan.split(/\nMedication changes:/i)[0].trim();
        set({
          ...(cc && cc !== '(not documented)' ? { chiefComplaint: cc } : {}),
          ...(hpi && hpi !== '(not documented)' ? { intervalHistory: hpi } : {}),
          ...(diagLines.length > 0 ? { diagnoses: diagLines } : {}),
          ...(planNotes ? { planNotes } : {}),
        });
      })
      .catch(() => { /* silent — demo mode or no draft */ });
  }, [patientResource?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Find or create today's Encounter for this patient
  const getOrCreateEncounter = async (): Promise<string | null> => {
    if (!patientResource?.id) return null;
    if (encounterRef.current) return encounterRef.current;

    const patRef = getReferenceString(patientResource);
    const todayStr = formatLocalDate(new Date());

    const existing = await medplum.searchResources('Encounter', {
      patient: patRef,
      date: `ge${todayStr}`,
      status: 'in-progress',
      _count: 1,
      _sort: '-date',
    });

    let ref: string;
    if (existing.length > 0 && existing[0].id) {
      ref = getReferenceString(existing[0] as Encounter & { id: string });
    } else {
      const enc = await medplum.createResource<Encounter>({
        resourceType: 'Encounter',
        status: 'in-progress',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
        type: [{ text: TEMPLATE_LABELS[note.template] }],
        subject: { reference: patRef },
        period: { start: new Date().toISOString() },
      });
      ref = getReferenceString(enc as Encounter & { id: string });
    }

    encounterRef.current = ref;
    return ref;
  };

  const saveDraft = async (): Promise<void> => {
    if (!patientResource?.id) return; // demo mode — no-op
    setSaving(true);
    setSaveError(null);
    try {
      const encRef = await getOrCreateEncounter();
      if (!encRef || !patientResource?.id) return;
      const patRef = `Patient/${patientResource.id}`;
      const composition = buildComposition({ ...note, status: 'draft' }, patRef, encRef, compositionId.current ?? undefined);
      if (compositionId.current) {
        await medplum.updateResource({ ...composition, id: compositionId.current });
      } else {
        const saved = await medplum.createResource<Composition>(composition);
        compositionId.current = saved.id ?? null;
      }
      set({ status: 'draft' });
    } catch (err) {
      setSaveError('Save failed — check connection.');
    } finally {
      setSaving(false);
    }
  };

  const signNote = async (): Promise<void> => {
    if (!patientResource?.id) {
      // Demo mode — just navigate back
      set({ status: 'signed' });
      navigate(`/chart/${patientSlug}`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const encRef = await getOrCreateEncounter();
      if (!encRef || !patientResource?.id) return;
      const patRef = `Patient/${patientResource.id}`;
      const composition = buildComposition({ ...note, status: 'signed' }, patRef, encRef, compositionId.current ?? undefined);
      if (compositionId.current) {
        await medplum.updateResource({ ...composition, id: compositionId.current, status: 'final' });
      } else {
        await medplum.createResource<Composition>({ ...composition, status: 'final' });
      }
      // Save PHQ-9 / GAD-7 as canonical FHIR Observations
      const scoreEntries: { score: number; loinc: string; display: string }[] = [
        ...(typeof note.phq9Score === 'number' ? [{ score: note.phq9Score, loinc: '44261-6', display: 'PHQ-9 total score' }] : []),
        ...(typeof note.gad7Score === 'number' ? [{ score: note.gad7Score, loinc: '70274-6', display: 'GAD-7 total score' }] : []),
      ];
      await Promise.all(
        scoreEntries.map((entry) =>
          medplum.createResource<Observation>({
            resourceType: 'Observation',
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: entry.loinc, display: entry.display }],
              text: entry.display,
            },
            subject: { reference: patRef },
            encounter: { reference: encRef },
            effectiveDateTime: new Date().toISOString(),
            valueInteger: entry.score,
          })
        )
      );
      // Mark encounter finished
      const encId = encRef.split('/')[1];
      const encounter = await medplum.readResource('Encounter', encId);
      await medplum.updateResource<Encounter>({ ...encounter, status: 'finished', period: { ...encounter.period, end: new Date().toISOString() } });
      set({ status: 'signed' });
      navigate(`/chart/${patientSlug}`);
    } catch (err) {
      setSaveError('Sign failed — check connection.');
    } finally {
      setSaving(false);
    }
  };

  // AI stub fills
  const aiFill = (field: keyof NoteState): void => {
    const fills: Partial<NoteState> = {
      intervalHistory: `Patient reports ${note.moodRating ? `mood at ${note.moodRating}/10` : 'variable mood'} over the past ${note.followUpWeeks} weeks. Sleep ${note.sleepHours ? `averaging ${note.sleepHours} hours/night` : 'disrupted'}. ${note.anxiety === 'Severe' ? 'Anxiety significantly impacting daily functioning.' : 'Anxiety manageable.'} No medication side effects reported.`,
      planNotes: `Continue current medication regimen. ${hasSiFlag ? 'Safety plan reviewed and updated. ' : ''}Monitor symptom response. Patient instructed to contact office if symptoms worsen. Follow up in ${note.followUpWeeks} weeks.`,
      chiefComplaint: `Follow-up for ${patient?.diagnoses[0]?.split('—')[1]?.trim() ?? 'psychiatric management'}.`,
    };
    if (fills[field]) set({ [field]: fills[field] } as Partial<NoteState>);
  };

  if (loading && !patient) {
    return <Loading />;
  }

  if (!patient) {
    return (
      <Box p="xl">
        <Button variant="subtle" leftSection={<IconArrowLeft size={14} />}
          onClick={() => navigate(-1)}>Back</Button>
        <Text mt="md" c="dimmed">Patient not found.</Text>
      </Box>
    );
  }

  return (
    <Box className={classes.page}>
      {/* Header */}
      <Box className={classes.header}>
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ActionIcon variant="subtle" onClick={() => navigate(`/chart/${patientSlug}`)}>
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Box>
              <Group gap={8}>
                <Title order={4}>{patient.name}</Title>
                <Badge size="sm" variant="outline" color="gray">{patient.mrn}</Badge>
                <Badge size="sm" variant="light" color="blue">DOB {patient.dob}</Badge>
                {patient.flags.map((f) => (
                  <Badge key={f} size="sm" color="red" variant="filled">{f}</Badge>
                ))}
              </Group>
              <Text size="xs" c="dimmed" mt={2}>Visit Note · {today} · Dr. Carton</Text>
            </Box>
          </Group>
          <Group gap="sm">
            <Select
              size="sm"
              w={220}
              value={note.template}
              onChange={(v) => v && set({ template: v as NoteTemplate })}
              data={Object.entries(TEMPLATE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              leftSection={<IconPencil size={13} />}
            />
            <Button size="sm" variant="light" leftSection={<IconMicrophone size={13} />} color="red">
              Scribe
            </Button>
            <Button size="sm" variant="light" leftSection={<IconDeviceFloppy size={13} />}
              onClick={saveDraft} loading={saving}>
              Save Draft
            </Button>
            <Button size="sm" color="blue" leftSection={<IconSignature size={13} />}
              onClick={signNote} loading={saving}>
              Sign &amp; Close
            </Button>
          </Group>
        </Group>
      </Box>

      {/* Body */}
      <ScrollArea className={classes.body}>
        <Box className={classes.noteContent}>
          <Stack gap="sm">

            {/* Chief Complaint */}
            <Section title="Chief Complaint">
              <Group gap="xs" align="flex-start">
                <Textarea
                  flex={1}
                  placeholder="Reason for visit…"
                  autosize minRows={2}
                  value={note.chiefComplaint}
                  onChange={(e) => set({ chiefComplaint: e.currentTarget.value })}
                />
                <AiFill label="Chief Complaint" onClick={() => aiFill('chiefComplaint')} />
              </Group>
            </Section>

            {/* Interval History */}
            <Section title="Interval History / Subjective">
              <Stack gap="sm">
                <Group gap="xs" align="flex-start">
                  <Textarea
                    flex={1}
                    placeholder="How has the patient been since the last visit? Changes in symptoms, life events, medication response…"
                    autosize minRows={3}
                    value={note.intervalHistory}
                    onChange={(e) => set({ intervalHistory: e.currentTarget.value })}
                  />
                  <AiFill label="Interval History" onClick={() => aiFill('intervalHistory')} />
                </Group>

                {/* Symptom quick-capture */}
                <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Mood (1–10)', key: 'moodRating', type: 'number', placeholder: '1–10' },
                    { label: 'Sleep (hrs)', key: 'sleepHours', type: 'number', placeholder: 'Avg hrs' },
                  ].map(({ label, key, placeholder }) => (
                    <Box key={key}>
                      <Text size="xs" c="dimmed" mb={2}>{label}</Text>
                      <NumberInput
                        size="xs"
                        placeholder={placeholder}
                        value={note[key as keyof NoteState] as number}
                        onChange={(v) => set({ [key]: v } as Partial<NoteState>)}
                        min={key === 'moodRating' ? 1 : 0}
                        max={key === 'moodRating' ? 10 : 24}
                      />
                    </Box>
                  ))}
                  {[
                    { label: 'Sleep Quality', key: 'sleepQuality', opts: ['Good', 'Fair', 'Poor', 'Insomnia'] },
                    { label: 'Appetite',       key: 'appetite',    opts: ['Normal', 'Decreased', 'Increased', 'Poor'] },
                    { label: 'Energy',         key: 'energy',      opts: ['Normal', 'Low', 'High', 'Fatigue'] },
                    { label: 'Concentration',  key: 'concentration', opts: ['Normal', 'Mildly impaired', 'Impaired'] },
                    { label: 'Anxiety',        key: 'anxiety',     opts: ['None', 'Mild', 'Moderate', 'Severe'] },
                    { label: 'SI / HI',        key: 'siHi',        opts: ['Denies SI/HI', 'Passive SI', 'Active SI', 'HI present'] },
                  ].map(({ label, key, opts }) => (
                    <Box key={key}>
                      <Text size="xs" c="dimmed" mb={2}>{label}</Text>
                      <Select
                        size="xs"
                        placeholder="Select…"
                        data={opts}
                        value={note[key as keyof NoteState] as string}
                        onChange={(v) => v && set({ [key]: v } as Partial<NoteState>)}
                        styles={{ input: { color: key === 'siHi' && note.siHi !== 'Denies SI/HI' ? 'red' : undefined } }}
                      />
                    </Box>
                  ))}
                </Box>

                {note.siHi !== 'Denies SI/HI' && (
                  <Box style={{ background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: 8, padding: 10 }}>
                    <Text size="xs" fw={700} c="red" mb={4}>⚠ SI/HI Detail Required</Text>
                    <Textarea
                      size="xs"
                      placeholder="Describe ideation: frequency, intensity, plan, intent, means, protective factors…"
                      autosize minRows={2}
                      value={note.siDetail}
                      onChange={(e) => set({ siDetail: e.currentTarget.value })}
                    />
                  </Box>
                )}
              </Stack>
            </Section>

            {/* Mental Status Exam */}
            <Section title="Mental Status Exam" badge={Object.values(note.mse).filter(Boolean).length + ' fields'}>
              <Stack gap="md">
                <MseGrid mse={note.mse} onChange={setMse} />
                {mseNarrative && (
                  <Box>
                    <Divider my="xs" label="Generated narrative (editable)" labelPosition="left" />
                    <Textarea
                      size="xs"
                      autosize
                      minRows={3}
                      value={mseNarrative}
                      onChange={() => {/* allow free editing */}}
                      styles={{ input: { fontStyle: 'italic', color: '#495057' } }}
                    />
                  </Box>
                )}
              </Stack>
            </Section>

            {/* Assessment */}
            <Section title="Assessment">
              <Stack gap={6}>
                <Text size="xs" c="dimmed" mb={2}>Active diagnoses (edit as needed)</Text>
                {note.diagnoses.map((dx, i) => (
                  <Group key={i} gap={6} wrap="nowrap">
                    <Badge size="sm" variant="outline" color="violet" style={{ flexShrink: 0 }}>Dx {i + 1}</Badge>
                    <Textarea
                      flex={1}
                      size="xs"
                      autosize
                      minRows={1}
                      value={dx}
                      onChange={(e) => {
                        const updated = [...note.diagnoses];
                        updated[i] = e.currentTarget.value;
                        set({ diagnoses: updated });
                      }}
                    />
                    <ActionIcon size="sm" color="red" variant="subtle"
                      onClick={() => set({ diagnoses: note.diagnoses.filter((_, j) => j !== i) })}>
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                ))}
                <Button size="xs" variant="light" onClick={() => set({ diagnoses: [...note.diagnoses, ''] })}>
                  + Add Diagnosis
                </Button>
                {/* PHQ-9 / GAD-7 score capture — saved as FHIR Observations on sign */}
                <Box mt={6} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>PHQ-9 Score (0–27)</Text>
                    <NumberInput
                      size="xs"
                      placeholder="Enter if administered"
                      min={0}
                      max={27}
                      value={note.phq9Score as number}
                      onChange={(v) => set({ phq9Score: v })}
                    />
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>GAD-7 Score (0–21)</Text>
                    <NumberInput
                      size="xs"
                      placeholder="Enter if administered"
                      min={0}
                      max={21}
                      value={note.gad7Score as number}
                      onChange={(v) => set({ gad7Score: v })}
                    />
                  </Box>
                </Box>
              </Stack>
            </Section>

            {/* Plan */}
            <Section title="Plan">
              <Stack gap="sm">
                {/* Medication changes */}
                <Box>
                  <Text size="xs" fw={600} c="dimmed" mb={6}>MEDICATION CHANGES</Text>
                  {note.medChanges.length === 0 && (
                    <Text size="xs" c="dimmed" mb={4}>No medication changes — continuing current regimen.</Text>
                  )}
                  {note.medChanges.map((mc, i) => (
                    <Box key={i} style={{ border: '1px solid #e9ecef', borderRadius: 8, padding: 8, marginBottom: 6, background: '#fafafa' }}>
                      <Group gap={6} wrap="wrap">
                        <Textarea size="xs" placeholder="Medication" flex={1} minRows={1} autosize
                          value={mc.medication} onChange={(e) => {
                            const u = [...note.medChanges]; u[i].medication = e.currentTarget.value; set({ medChanges: u });
                          }} />
                        <Textarea size="xs" placeholder="Dose" w={80} minRows={1} autosize
                          value={mc.dose} onChange={(e) => {
                            const u = [...note.medChanges]; u[i].dose = e.currentTarget.value; set({ medChanges: u });
                          }} />
                        <Select size="xs" w={130} placeholder="Change"
                          data={['Start', 'Increase', 'Decrease', 'Continue', 'Discontinue', 'Hold']}
                          value={mc.change} onChange={(v) => {
                            const u = [...note.medChanges]; u[i].change = v ?? ''; set({ medChanges: u });
                          }} />
                        <Textarea size="xs" placeholder="Reason" flex={1} minRows={1} autosize
                          value={mc.reason} onChange={(e) => {
                            const u = [...note.medChanges]; u[i].reason = e.currentTarget.value; set({ medChanges: u });
                          }} />
                        <ActionIcon size="sm" color="red" variant="subtle"
                          onClick={() => set({ medChanges: note.medChanges.filter((_, j) => j !== i) })}>
                          <IconTrash size={12} />
                        </ActionIcon>
                      </Group>
                    </Box>
                  ))}
                  <Button size="xs" variant="light" color="teal"
                    onClick={() => set({ medChanges: [...note.medChanges, { medication: '', dose: '', change: '', reason: '' }] })}>
                    + Medication Change
                  </Button>
                </Box>

                {/* Plan notes */}
                <Box>
                  <Group gap={6} mb={4} align="center">
                    <Text size="xs" fw={600} c="dimmed">PLAN NOTES</Text>
                    <AiFill label="Plan" onClick={() => aiFill('planNotes')} />
                  </Group>
                  <Textarea
                    placeholder="Patient education, referrals, labs ordered, safety plan, other instructions…"
                    autosize minRows={3}
                    value={note.planNotes}
                    onChange={(e) => set({ planNotes: e.currentTarget.value })}
                  />
                </Box>

                {/* Follow-up + safety plan */}
                <Group gap="xl">
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>Follow-up in (weeks)</Text>
                    <NumberInput size="xs" w={100} min={1} max={52}
                      value={note.followUpWeeks as number}
                      onChange={(v) => set({ followUpWeeks: v })} />
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>Labs ordered</Text>
                    <Textarea size="xs" w={240} autosize minRows={1}
                      placeholder="e.g. Lithium level, CMP, CBC…"
                      value={note.labsOrdered}
                      onChange={(e) => set({ labsOrdered: e.currentTarget.value })} />
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed" mb={6}>Safety Plan</Text>
                    <Button
                      size="xs"
                      color={note.safetyPlan ? 'green' : 'gray'}
                      variant={note.safetyPlan ? 'filled' : 'light'}
                      leftSection={note.safetyPlan ? <IconCheck size={12} /> : undefined}
                      onClick={() => set({ safetyPlan: !note.safetyPlan })}
                    >
                      {note.safetyPlan ? 'Reviewed & Updated' : 'Mark as Reviewed'}
                    </Button>
                  </Box>
                </Group>
              </Stack>
            </Section>

            {/* Billing */}
            <Section title="Billing & Coding">
              <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <Box>
                  <Text size="xs" c="dimmed" mb={4}>CPT Code</Text>
                  <Select
                    size="sm"
                    value={note.cptCode}
                    onChange={(v) => v && set({ cptCode: v })}
                    data={CPT_OPTIONS}
                  />
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" mb={4}>Time Spent (minutes)</Text>
                  <NumberInput size="sm" min={5} max={120}
                    value={note.timeSpent as number}
                    onChange={(v) => set({ timeSpent: v })} />
                </Box>
                <Box>
                  <Text size="xs" c="dimmed" mb={4}>Medical Decision Complexity</Text>
                  <Select
                    size="sm"
                    value={note.complexity}
                    onChange={(v) => v && set({ complexity: v })}
                    data={['Straightforward', 'Low', 'Moderate', 'High']}
                  />
                </Box>
              </Box>
              <Box mt="sm" style={{ background: '#f0f4ff', borderRadius: 8, padding: '8px 12px' }}>
                <Text size="xs" c="dimmed">
                  Selected: <Text span fw={700} c="blue">{note.cptCode}</Text> ·{' '}
                  {CPT_OPTIONS.find((o) => o.value === note.cptCode)?.label.split('—')[1]?.trim()} ·{' '}
                  {note.timeSpent} min · {note.complexity} complexity
                </Text>
              </Box>
            </Section>

            {/* Sign bar */}
            <Box style={{ background: 'white', border: '1px solid #e9ecef', borderRadius: 12, padding: '12px 16px' }}>
              <Group justify="space-between">
                <Box>
                  <Text size="xs" c="dimmed">Provider</Text>
                  <Text size="sm" fw={600}>Dr. Logan Carton, NP</Text>
                </Box>
                <Box ta="center">
                  <Text size="xs" c="dimmed">Date</Text>
                  <Text size="sm" fw={600}>{today}</Text>
                </Box>
                <Group gap="sm">
                  {saveError && <Text size="xs" c="red">{saveError}</Text>}
                  {!isFhirPatient && (
                    <Text size="xs" c="dimmed">Demo mode — notes not saved to FHIR</Text>
                  )}
                  <Button variant="light" leftSection={<IconDeviceFloppy size={14} />}
                    onClick={saveDraft} loading={saving}>
                    Save Draft
                  </Button>
                  <Button color="blue" leftSection={<IconSignature size={14} />}
                    onClick={signNote} loading={saving}>
                    Sign &amp; Lock Note
                  </Button>
                </Group>
              </Group>
            </Box>

          </Stack>
        </Box>
      </ScrollArea>
    </Box>
  );
}
