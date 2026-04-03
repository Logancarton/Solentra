import {
  calculateAge,
  formatHumanName,
  getAllQuestionnaireAnswers,
  getDisplayString,
  getReferenceString,
} from '@medplum/core';
import type {
  AllergyIntolerance,
  Composition,
  Condition,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  MedicationRequest,
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

function stripXhtml(div: string | undefined): string {
  return (div ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
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
  compositions: Composition[] | undefined
): Patient {
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
  const assessments = (questionnaireResponses ?? [])
    .map(mapAssessment)
    .filter((assessment): assessment is Patient['assessments'][number] => Boolean(assessment))
    .slice(0, 20);

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
    socialHistory: [],
    familyHistory: [],
    hospitalizations: [],
  };
}

export function useLivePatientRecord(patientKey: string | undefined): LivePatientRecordResult {
  const [patientResource, patientLoading] = useSearchOne('Patient', patientKey ? { _id: patientKey } : undefined, {
    enabled: Boolean(patientKey),
  });

  const patientRef = patientResource ? getReferenceString(patientResource) : undefined;
  const searchOptions = { enabled: Boolean(patientRef) };

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
            compositions
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
      compositionsLoading,
  };
}
