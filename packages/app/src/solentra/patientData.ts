import {
  calculateAge,
  formatHumanName,
  getAllQuestionnaireAnswers,
  getDisplayString,
  getReferenceString,
} from '@medplum/core';
import type {
  AllergyIntolerance,
  Appointment,
  Composition,
  Condition,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  MedicationRequest,
  Observation,
  Patient as FhirPatient,
  QuestionnaireResponse,
  Task,
} from '@medplum/fhirtypes';
import { useSearchOne, useSearchResources } from '@medplum/react';
import { useMemo } from 'react';
import type { Patient } from './PatientChart';

export interface LivePatientRecordResult {
  patient: Patient | undefined;
  patientResource: FhirPatient | undefined;
  loading: boolean;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatSearchDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getAgeYears(birthDate: string | undefined): number {
  if (!birthDate) {
    return 0;
  }
  return calculateAge(birthDate).years;
}

function getPhone(patient: FhirPatient): string {
  return patient.telecom?.find((entry) => entry.system === 'phone')?.value ?? '';
}

function getMrn(patient: FhirPatient): string {
  return patient.identifier?.find((identifier) => identifier.value)?.value ?? (patient.id as string);
}

function getCoverageDisplay(coverages: Coverage[] | undefined): string {
  return (
    coverages?.[0]?.payor?.[0]?.display ||
    coverages?.[0]?.type?.text ||
    coverages?.[0]?.class?.[0]?.name ||
    'No insurance on file'
  );
}

function getGeneralPractitioner(patient: FhirPatient): string {
  return patient.generalPractitioner?.[0]?.display ?? 'No PCP on file';
}

function getPatientName(patient: FhirPatient): string {
  return formatHumanName(patient.name?.[0]) || patient.id || 'Unknown Patient';
}

function getPatientPronouns(patient: FhirPatient): string {
  return patient.gender ?? '';
}

function getConditionLabel(condition: Condition): string {
  return condition.code?.text || getDisplayString(condition) || 'Condition';
}

function getAllergyLabel(allergy: AllergyIntolerance): string {
  return allergy.code?.text || getDisplayString(allergy) || 'Allergy';
}

function mapMedicationStatus(
  status: MedicationRequest['status'] | undefined
): 'active' | 'hold' | 'discontinued' {
  if (status === 'on-hold') {
    return 'hold';
  }
  if (status === 'stopped' || status === 'cancelled' || status === 'completed' || status === 'entered-in-error') {
    return 'discontinued';
  }
  return 'active';
}

function mapMedication(request: MedicationRequest): Patient['meds'][number] {
  return {
    name: getDisplayString(request) || 'Medication',
    dose: request.dosageInstruction?.[0]?.text || '',
    sig: request.dosageInstruction?.[0]?.text || '',
    prescriber: request.requester?.display || 'Unknown prescriber',
    startDate: formatDate(request.authoredOn),
    lastFilled: formatDate(request.dispenseRequest?.validityPeriod?.start ?? request.authoredOn),
    refillsLeft: request.dispenseRequest?.numberOfRepeatsAllowed ?? 0,
    status: mapMedicationStatus(request.status),
  };
}

function inferLabStatus(summary: string): Patient['labs'][number]['status'] {
  if (/critical/i.test(summary)) {
    return 'critical';
  }
  if (/high|positive|abnormal/i.test(summary)) {
    return 'high';
  }
  if (/low/i.test(summary)) {
    return 'low';
  }
  return 'normal';
}

function mapDiagnosticReport(report: DiagnosticReport): Patient['labs'][number] {
  const summary = report.conclusion || report.status || 'Result available';
  return {
    name: getDisplayString(report) || 'Diagnostic Report',
    value: summary,
    unit: '',
    range: '',
    date: formatDate(report.issued ?? report.meta?.lastUpdated),
    status: inferLabStatus(summary),
  };
}

function decodeAttachmentData(data: string | undefined): string | undefined {
  if (!data || typeof atob !== 'function') {
    return undefined;
  }
  try {
    const bytes = Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return atob(data);
  }
}

function mapEncounter(encounter: Encounter): Patient['notes'][number] {
  return {
    date: formatDate(encounter.period?.start ?? encounter.meta?.lastUpdated),
    type: encounter.type?.[0]?.text || encounter.class?.display || 'Encounter',
    summary:
      encounter.reasonCode?.[0]?.text ||
      encounter.reasonReference?.[0]?.display ||
      'Encounter completed.',
    provider:
      encounter.participant?.find((participant) => participant.individual?.display)?.individual?.display ||
      'Unknown provider',
    diagnoses:
      encounter.diagnosis
        ?.map((entry) => entry.condition?.display)
        .filter((value): value is string => Boolean(value)) ?? [],
    plan: [],
  };
}

function mapDocumentReference(document: DocumentReference): Patient['notes'][number] {
  const content = decodeAttachmentData(document.content?.[0]?.attachment?.data);
  const summary = content?.split('\n').find((line) => line.trim().length > 0) || document.description || 'Document saved.';
  return {
    date: formatDate(document.date ?? document.meta?.lastUpdated),
    type: document.type?.text || document.description || 'Clinical note',
    summary,
    provider: document.author?.[0]?.display || 'Unknown provider',
    diagnoses: [],
    plan: [],
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function stripXhtml(div: string | undefined): string {
  const withLineBreaks = (div ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n')
    .replace(/<li>/gi, '- ');

  return decodeHtmlEntities(withLineBreaks.replace(/<[^>]+>/g, ''))
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mapComposition(composition: Composition): Patient['notes'][number] {
  const planSection = composition.section?.find((s) => s.title === 'Plan');
  const assessmentSection = composition.section?.find((s) => s.title === 'Assessment');
  const hpiSection = composition.section?.find((s) => s.title === 'Interval History' || s.title === 'Chief Complaint');

  const summary = stripXhtml(hpiSection?.text?.div) || composition.title || 'Clinical note';
  const plan = planSection ? stripXhtml(planSection.text?.div).split('\n').filter(Boolean) : [];
  const diagnoses = assessmentSection
    ? stripXhtml(assessmentSection.text?.div)
        .replace(/^Diagnoses:\s*/i, '')
        .split('\n')
        .filter(Boolean)
    : [];

  return {
    date: formatDate(composition.date ?? composition.meta?.lastUpdated),
    type: `${composition.type?.text ?? 'Clinical Note'}${composition.status === 'final' ? ' ✓' : ' (draft)'}`,
    summary,
    provider: composition.author?.[0]?.display || 'Unknown provider',
    diagnoses,
    plan,
  };
}

function inferAssessmentTool(response: QuestionnaireResponse): { tool: string; maxScore: number } | undefined {
  const questionnaire = response.questionnaire?.toLowerCase() ?? '';
  if (questionnaire.includes('phq')) {
    return { tool: 'PHQ-9', maxScore: 27 };
  }
  if (questionnaire.includes('gad')) {
    return { tool: 'GAD-7', maxScore: 21 };
  }
  if (questionnaire.includes('cssrs') || questionnaire.includes('c-ssrs')) {
    return { tool: 'C-SSRS', maxScore: 5 };
  }
  return undefined;
}

function getAssessmentSeverity(tool: string, score: number): { severity: string; color: string } {
  if (tool === 'PHQ-9') {
    if (score >= 20) {
      return { severity: 'Severe', color: 'red' };
    }
    if (score >= 15) {
      return { severity: 'Moderately Severe', color: 'orange' };
    }
    if (score >= 10) {
      return { severity: 'Moderate', color: 'yellow' };
    }
    if (score >= 5) {
      return { severity: 'Mild', color: 'green' };
    }
    return { severity: 'Minimal', color: 'green' };
  }

  if (tool === 'GAD-7') {
    if (score >= 15) {
      return { severity: 'Severe', color: 'red' };
    }
    if (score >= 10) {
      return { severity: 'Moderate', color: 'yellow' };
    }
    if (score >= 5) {
      return { severity: 'Mild', color: 'green' };
    }
    return { severity: 'Minimal', color: 'green' };
  }

  if (score >= 3) {
    return { severity: 'High Risk', color: 'red' };
  }
  if (score >= 1) {
    return { severity: 'Positive', color: 'orange' };
  }
  return { severity: 'Negative', color: 'green' };
}

function mapAssessment(response: QuestionnaireResponse): Patient['assessments'][number] | undefined {
  const toolMeta = inferAssessmentTool(response);
  if (!toolMeta) {
    return undefined;
  }
  const answers = getAllQuestionnaireAnswers(response);
  const numericValues = Object.values(answers)
    .flat()
    .flatMap((answer) => {
      if (typeof answer.valueInteger === 'number') {
        return [answer.valueInteger];
      }
      if (typeof answer.valueDecimal === 'number') {
        return [answer.valueDecimal];
      }
      return [];
    });

  if (numericValues.length === 0) {
    return undefined;
  }

  const score = numericValues.reduce((sum, value) => sum + value, 0);
  const severity = getAssessmentSeverity(toolMeta.tool, score);
  return {
    tool: toolMeta.tool,
    date: formatDate(response.authored ?? response.meta?.lastUpdated),
    score,
    maxScore: toolMeta.maxScore,
    severity: severity.severity,
    color: severity.color,
  };
}

// PHQ-9 total score: LOINC 44261-6 | GAD-7 total score: LOINC 70274-6
const SCORE_LOINC: Record<string, string> = { '44261-6': 'PHQ-9', '70274-6': 'GAD-7' };

function mapObservationToAssessment(obs: Observation): Patient['assessments'][number] | undefined {
  const code = obs.code?.coding?.find((c) => SCORE_LOINC[c.code ?? ''])?.code;
  const tool = code ? SCORE_LOINC[code] : undefined;
  if (!tool) return undefined;
  const score = obs.valueInteger ?? (typeof obs.valueQuantity?.value === 'number' ? Math.round(obs.valueQuantity.value) : undefined);
  if (score === undefined) return undefined;
  const maxScore = tool === 'PHQ-9' ? 27 : 21;
  const { severity, color } = getAssessmentSeverity(tool, score);
  return {
    tool,
    date: formatDate(obs.effectiveDateTime ?? obs.meta?.lastUpdated),
    score,
    maxScore,
    severity,
    color,
  };
}

function getObservationDate(observation: Observation): string | undefined {
  return observation.effectiveDateTime ?? observation.issued ?? observation.meta?.lastUpdated;
}

function getObservationTime(observation: Observation): number {
  const value = getObservationDate(observation);
  if (!value) {
    return 0;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function hasObservationCode(observation: Observation, code: string): boolean {
  return observation.code?.coding?.some((coding) => coding.code === code) ?? false;
}

function getObservationNumericValue(observation: Observation): number | undefined {
  if (typeof observation.valueInteger === 'number') {
    return observation.valueInteger;
  }
  if (typeof observation.valueQuantity?.value === 'number') {
    return observation.valueQuantity.value;
  }
  return undefined;
}

function formatNumericValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function normalizeUnit(unit: string | undefined): string {
  if (!unit) {
    return '';
  }
  const normalized = unit.trim().toLowerCase();
  if (normalized === '[lb_av]' || normalized === 'lbs') {
    return 'lb';
  }
  if (normalized === '/min' || normalized === 'beats/minute') {
    return 'bpm';
  }
  if (normalized === 'kg/m2' || normalized === 'kg/m^2' || normalized === '{ratio}' || normalized === '1') {
    return '';
  }
  if (normalized === 'mm[hg]' || normalized === 'mmhg') {
    return 'mmHg';
  }
  return unit;
}

function formatObservationQuantity(observation: Observation): string | undefined {
  const value = getObservationNumericValue(observation);
  if (value === undefined) {
    return undefined;
  }
  const unit = normalizeUnit(observation.valueQuantity?.unit ?? observation.valueQuantity?.code);
  return unit ? `${formatNumericValue(value)} ${unit}` : formatNumericValue(value);
}

function extractBloodPressure(observation: Observation): { systolic?: string; diastolic?: string } {
  const result: { systolic?: string; diastolic?: string } = {};

  for (const component of observation.component ?? []) {
    const code = component.code?.coding?.find((coding) => coding.code)?.code;
    const value = component.valueQuantity?.value;
    if (typeof value !== 'number') {
      continue;
    }
    if (code === '8480-6') {
      result.systolic = formatNumericValue(value);
    }
    if (code === '8462-4') {
      result.diastolic = formatNumericValue(value);
    }
  }

  if (!result.systolic && hasObservationCode(observation, '8480-6')) {
    const value = getObservationNumericValue(observation);
    if (value !== undefined) {
      result.systolic = formatNumericValue(value);
    }
  }

  if (!result.diastolic && hasObservationCode(observation, '8462-4')) {
    const value = getObservationNumericValue(observation);
    if (value !== undefined) {
      result.diastolic = formatNumericValue(value);
    }
  }

  return result;
}

function mapVitalObservations(observations: Observation[] | undefined): Patient['vitals'] {
  type VitalAccumulator = {
    date: string;
    sortTime: number;
    weight?: string;
    bmi?: string;
    hr?: string;
    systolic?: string;
    diastolic?: string;
  };

  const byDate = new Map<string, VitalAccumulator>();

  for (const observation of [...(observations ?? [])].sort((a, b) => getObservationTime(b) - getObservationTime(a))) {
    const observationDate = getObservationDate(observation);
    if (!observationDate) {
      continue;
    }

    const dateLabel = formatDate(observationDate);
    const sortTime = getObservationTime(observation);
    const existing = byDate.get(dateLabel) ?? { date: dateLabel, sortTime };
    existing.sortTime = Math.max(existing.sortTime, sortTime);

    if (hasObservationCode(observation, '29463-7')) {
      existing.weight = existing.weight ?? formatObservationQuantity(observation);
    }

    if (hasObservationCode(observation, '39156-5')) {
      const bmiValue = getObservationNumericValue(observation);
      if (bmiValue !== undefined && !existing.bmi) {
        existing.bmi = formatNumericValue(bmiValue);
      }
    }

    if (hasObservationCode(observation, '8867-4')) {
      const hrValue = getObservationNumericValue(observation);
      if (hrValue !== undefined && !existing.hr) {
        existing.hr = `${formatNumericValue(hrValue)} bpm`;
      }
    }

    if (
      hasObservationCode(observation, '85354-9') ||
      hasObservationCode(observation, '8480-6') ||
      hasObservationCode(observation, '8462-4')
    ) {
      const { systolic, diastolic } = extractBloodPressure(observation);
      existing.systolic = existing.systolic ?? systolic;
      existing.diastolic = existing.diastolic ?? diastolic;
    }

    byDate.set(dateLabel, existing);
  }

  return [...byDate.values()]
    .sort((a, b) => b.sortTime - a.sortTime)
    .map((entry) => ({
      date: entry.date,
      weight: entry.weight,
      bmi: entry.bmi,
      bp:
        entry.systolic && entry.diastolic
          ? `${entry.systolic}/${entry.diastolic}`
          : entry.systolic ?? entry.diastolic,
      hr: entry.hr,
    }))
    .filter((entry) => Boolean(entry.weight || entry.bmi || entry.bp || entry.hr))
    .slice(0, 12);
}

function getAppointmentStart(appointment: Appointment): string | undefined {
  return appointment.start ?? appointment.requestedPeriod?.[0]?.start;
}

function getAppointmentLabel(appointment: Appointment): string | undefined {
  return (
    appointment.participant?.find((participant) => participant.actor?.reference && !participant.actor.reference.startsWith('Patient/'))
      ?.actor?.display ||
    appointment.serviceType?.[0]?.text ||
    appointment.appointmentType?.text ||
    appointment.description
  );
}

function getNextAppointment(appointments: Appointment[] | undefined): string | undefined {
  const now = Date.now();
  const nextAppointment = [...(appointments ?? [])]
    .filter((appointment) => !['cancelled', 'noshow', 'entered-in-error', 'fulfilled'].includes(appointment.status ?? ''))
    .map((appointment) => ({ appointment, start: getAppointmentStart(appointment) }))
    .filter((entry): entry is { appointment: Appointment; start: string } => Boolean(entry.start))
    .filter((entry) => {
      const time = new Date(entry.start).getTime();
      return !Number.isNaN(time) && time >= now;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];

  if (!nextAppointment) {
    return undefined;
  }

  const date = new Date(nextAppointment.start);
  if (Number.isNaN(date.getTime())) {
    return nextAppointment.start;
  }

  const dateLabel = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const label = getAppointmentLabel(nextAppointment.appointment);
  return label ? `${dateLabel} | ${timeLabel} | ${label}` : `${dateLabel} | ${timeLabel}`;
}

function buildFlags(
  labs: Patient['labs'],
  tasks: Task[] | undefined,
  assessments: Patient['assessments']
): string[] {
  const flags: string[] = [];

  const abnormalLab = labs.find((lab) => lab.status !== 'normal');
  if (abnormalLab) {
    flags.push(`${abnormalLab.name} requires review`);
  }

  const urgentTask = tasks?.find((task) => task.priority === 'stat' || task.priority === 'urgent' || task.priority === 'asap');
  if (urgentTask?.description) {
    flags.push(urgentTask.description);
  }

  const severeAssessment = assessments.find((assessment) => assessment.color === 'red');
  if (severeAssessment) {
    flags.push(`${severeAssessment.tool} ${severeAssessment.severity}`);
  }

  return flags.slice(0, 3);
}

function buildLivePatient(
  patient: FhirPatient,
  allergies: AllergyIntolerance[] | undefined,
  conditions: Condition[] | undefined,
  coverages: Coverage[] | undefined,
  medicationRequests: MedicationRequest[] | undefined,
  diagnosticReports: DiagnosticReport[] | undefined,
  encounters: Encounter[] | undefined,
  documents: DocumentReference[] | undefined,
  questionnaireResponses: QuestionnaireResponse[] | undefined,
  tasks: Task[] | undefined,
  compositions: Composition[] | undefined,
  scoreObservations: Observation[] | undefined,
  vitalObservations: Observation[] | undefined,
  appointments: Appointment[] | undefined
): Patient {
  const encounterIdsWithCompositions = new Set(
    (compositions ?? [])
      .map((composition) =>
        composition.encounter?.reference?.startsWith('Encounter/')
          ? composition.encounter.reference.split('/')[1]
          : undefined
      )
      .filter((encounterId): encounterId is string => Boolean(encounterId))
  );

  const meds = (medicationRequests ?? [])
    .slice()
    .sort((a, b) => new Date(b.authoredOn ?? '').getTime() - new Date(a.authoredOn ?? '').getTime())
    .map(mapMedication);
  const labs = (diagnosticReports ?? [])
    .slice()
    .sort((a, b) => new Date(b.issued ?? b.meta?.lastUpdated ?? '').getTime() - new Date(a.issued ?? a.meta?.lastUpdated ?? '').getTime())
    .map(mapDiagnosticReport);
  const encounterNotes = (encounters ?? [])
    .slice()
    .filter((encounter) => !encounter.id || !encounterIdsWithCompositions.has(encounter.id))
    .sort((a, b) => new Date(b.period?.start ?? b.meta?.lastUpdated ?? '').getTime() - new Date(a.period?.start ?? a.meta?.lastUpdated ?? '').getTime())
    .map(mapEncounter);
  const documentNotes = (documents ?? [])
    .slice()
    .sort((a, b) => new Date(b.date ?? b.meta?.lastUpdated ?? '').getTime() - new Date(a.date ?? a.meta?.lastUpdated ?? '').getTime())
    .map(mapDocumentReference);
  // Compositions are the canonical note — shown first, then fall back to encounters/documents
  const compositionNotes = (compositions ?? [])
    .slice()
    .sort((a, b) => new Date(b.date ?? b.meta?.lastUpdated ?? '').getTime() - new Date(a.date ?? a.meta?.lastUpdated ?? '').getTime())
    .map(mapComposition);
  const notes = [...compositionNotes, ...documentNotes, ...encounterNotes]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);
  // Merge Observation-sourced scores (canonical) with QR-inferred scores, deduplicate by tool+date
  const obsAssessments = (scoreObservations ?? [])
    .map(mapObservationToAssessment)
    .filter((a): a is Patient['assessments'][number] => Boolean(a));
  const qrAssessments = (questionnaireResponses ?? [])
    .map(mapAssessment)
    .filter((a): a is Patient['assessments'][number] => Boolean(a));
  const obsKeys = new Set(obsAssessments.map((a) => `${a.tool}|${a.date}`));
  const assessments = [...obsAssessments, ...qrAssessments.filter((a) => !obsKeys.has(`${a.tool}|${a.date}`))]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 40);

  return {
    name: getPatientName(patient),
    dob: formatDate(patient.birthDate),
    age: getAgeYears(patient.birthDate),
    mrn: getMrn(patient),
    pronouns: getPatientPronouns(patient),
    phone: getPhone(patient),
    insurance: getCoverageDisplay(coverages),
    pcp: getGeneralPractitioner(patient),
    diagnoses: (conditions ?? []).map(getConditionLabel),
    allergies: (allergies ?? []).length > 0 ? (allergies ?? []).map(getAllergyLabel) : ['NKDA'],
    flags: buildFlags(labs, tasks, assessments),
    meds,
    labs,
    notes,
    assessments,
    vitals: mapVitalObservations(vitalObservations),
    medTrials: [],
    pmh: [],
    psh: [],
    psychiatricHistory: [],
    substanceUse: [],
    socialHistory: [],
    familyHistory: [],
    hospitalizations: [],
    safetyPlanOnFile: false,
    nextAppointment: getNextAppointment(appointments),
  };
}

export function useLivePatientRecord(patientKey: string | undefined): LivePatientRecordResult {
  const [patientResource, patientLoading] = useSearchOne('Patient', patientKey ? { _id: patientKey } : undefined, {
    enabled: Boolean(patientKey),
  });

  const patientRef = patientResource ? getReferenceString(patientResource) : undefined;
  const searchOptions = { enabled: Boolean(patientRef) };
  const todaySearchDate = useMemo(() => formatSearchDate(new Date()), []);

  const [allergies, allergiesLoading] = useSearchResources(
    'AllergyIntolerance',
    patientRef ? { patient: patientRef, _count: 50, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [conditions, conditionsLoading] = useSearchResources(
    'Condition',
    patientRef ? { patient: patientRef, _count: 50, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [coverages, coveragesLoading] = useSearchResources(
    'Coverage',
    patientRef ? { beneficiary: patientRef, _count: 20, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [medicationRequests, medicationRequestsLoading] = useSearchResources(
    'MedicationRequest',
    patientRef ? { subject: patientRef, _count: 50, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [diagnosticReports, diagnosticReportsLoading] = useSearchResources(
    'DiagnosticReport',
    patientRef ? { subject: patientRef, _count: 50, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [encounters, encountersLoading] = useSearchResources(
    'Encounter',
    patientRef ? { subject: patientRef, _count: 50, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [documents, documentsLoading] = useSearchResources(
    'DocumentReference',
    patientRef ? { subject: patientRef, _count: 20, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [questionnaireResponses, questionnaireResponsesLoading] = useSearchResources(
    'QuestionnaireResponse',
    patientRef ? { subject: patientRef, _count: 20, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [tasks, tasksLoading] = useSearchResources(
    'Task',
    patientRef ? { for: patientRef, _count: 20, _sort: '-_lastUpdated' } : undefined,
    searchOptions
  );
  const [compositions, compositionsLoading] = useSearchResources(
    'Composition',
    patientRef ? { subject: patientRef, _count: 50, _sort: '-date' } : undefined,
    searchOptions
  );
  const [scoreObservations, scoreObservationsLoading] = useSearchResources(
    'Observation',
    patientRef ? { subject: patientRef, code: '44261-6,70274-6', _count: 100, _sort: '-date' } : undefined,
    searchOptions
  );
  const [vitalObservations, vitalObservationsLoading] = useSearchResources(
    'Observation',
    patientRef
      ? { subject: patientRef, code: '29463-7,39156-5,85354-9,8480-6,8462-4,8867-4', _count: 100, _sort: '-date' }
      : undefined,
    searchOptions
  );
  const [appointments, appointmentsLoading] = useSearchResources(
    'Appointment',
    patientRef ? { actor: patientRef, date: `ge${todaySearchDate}`, _count: 20, _sort: 'date' } : undefined,
    searchOptions
  );

  const patient = useMemo(
    () =>
      patientResource
        ? buildLivePatient(
            patientResource,
            allergies,
            conditions,
            coverages,
            medicationRequests,
            diagnosticReports,
            encounters,
            documents,
            questionnaireResponses,
            tasks,
            compositions,
            scoreObservations,
            vitalObservations,
            appointments
          )
        : undefined,
    [
      allergies,
      compositions,
      conditions,
      coverages,
      diagnosticReports,
      documents,
      encounters,
      medicationRequests,
      patientResource,
      questionnaireResponses,
      scoreObservations,
      vitalObservations,
      appointments,
      tasks,
    ]
  );

  return {
    patient,
    patientResource,
    loading:
      patientLoading ||
      allergiesLoading ||
      conditionsLoading ||
      coveragesLoading ||
      medicationRequestsLoading ||
      diagnosticReportsLoading ||
      encountersLoading ||
      documentsLoading ||
      questionnaireResponsesLoading ||
      tasksLoading ||
      compositionsLoading ||
      scoreObservationsLoading ||
      vitalObservationsLoading ||
      appointmentsLoading,
  };
}
