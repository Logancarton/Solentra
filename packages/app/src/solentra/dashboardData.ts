import { formatHumanName, getDisplayString, resolveId } from '@medplum/core';
import type {
  Appointment as FhirAppointment,
  Communication,
  DiagnosticReport,
  MedicationRequest,
  Patient as FhirPatient,
  Reference,
  Task,
} from '@medplum/fhirtypes';
import { useSearchResources } from '@medplum/react';
import { useMemo } from 'react';
import { PATIENTS, nameToSlug } from './PatientChart';

export interface DashboardAppointment {
  patientKey: string;
  time: string;
  name: string;
  type: string;
  status: 'upcoming' | 'checked-in' | 'in-progress' | 'completed';
  dob: string;
  flags?: string[];
}

export interface DashboardInboxItem {
  patientKey?: string;
  type: 'lab' | 'message' | 'task' | 'alert' | 'refill';
  patient: string;
  summary: string;
  urgent: boolean;
  time: string;
  sortDate: string;
}

export interface DashboardWeekDay {
  label: string;
  count: number;
  key: string;
  appointments: DashboardAppointment[];
  isToday?: boolean;
}

export interface DashboardYearMonth {
  name: string;
  total: number;
  current?: boolean;
}

export interface DashboardData {
  todayAppointments: DashboardAppointment[];
  tomorrowAppointments: DashboardAppointment[];
  inbox: DashboardInboxItem[];
  weekDays: DashboardWeekDay[];
  monthAppointmentsByDay: Record<number, DashboardAppointment[]>;
  yearMonths: DashboardYearMonth[];
  aiGreeting: string;
  loading: boolean;
  usingDemoData: boolean;
}

const DEMO_TODAY_APTS: DashboardAppointment[] = [
  { patientKey: 'james-carter', time: '9:00 AM', name: 'James Carter', type: 'Follow-up', status: 'completed', dob: '03/14/1982' },
  { patientKey: 'maria-lopez', time: '9:30 AM', name: 'Maria Lopez', type: 'Med Management', status: 'completed', dob: '07/22/1975', flags: ['PHQ-9 due'] },
  { patientKey: 'devon-williams', time: '10:00 AM', name: 'Devon Williams', type: 'New Patient', status: 'in-progress', dob: '11/05/1990' },
  { patientKey: 'sara-mitchell', time: '10:45 AM', name: 'Sara Mitchell', type: 'Follow-up', status: 'checked-in', dob: '05/30/1988', flags: ['SI flagged last visit'] },
  { patientKey: 'thomas-reed', time: '11:30 AM', name: 'Thomas Reed', type: 'Med Management', status: 'upcoming', dob: '09/12/1965' },
  { patientKey: 'priya-nair', time: '1:00 PM', name: 'Priya Nair', type: 'Follow-up', status: 'upcoming', dob: '02/18/1993' },
  { patientKey: 'kevin-park', time: '1:45 PM', name: 'Kevin Park', type: 'New Patient', status: 'upcoming', dob: '06/04/2001' },
  { patientKey: 'angela-torres', time: '2:30 PM', name: 'Angela Torres', type: 'Follow-up', status: 'upcoming', dob: '12/09/1979', flags: ['BP elevated last visit'] },
  { patientKey: 'robert-chen', time: '3:15 PM', name: 'Robert Chen', type: 'Med Management', status: 'upcoming', dob: '08/27/1958' },
];

const DEMO_TOMORROW_APTS: DashboardAppointment[] = [
  { patientKey: 'linda-hayes', time: '9:00 AM', name: 'Linda Hayes', type: 'New Patient', status: 'upcoming', dob: '04/11/1985' },
  { patientKey: 'marcus-bell', time: '10:00 AM', name: 'Marcus Bell', type: 'Follow-up', status: 'upcoming', dob: '01/30/1972' },
  { patientKey: 'sheila-okafor', time: '11:00 AM', name: 'Sheila Okafor', type: 'Med Management', status: 'upcoming', dob: '09/08/1994' },
];

const DEMO_INBOX: DashboardInboxItem[] = [
  {
    patientKey: 'sara-mitchell',
    type: 'alert',
    patient: 'Sara Mitchell',
    summary: 'Daily PHQ-9: Marked positive SI today',
    urgent: true,
    time: '8:42 AM',
    sortDate: '2026-04-02T08:42:00',
  },
  {
    patientKey: 'thomas-reed',
    type: 'lab',
    patient: 'Thomas Reed',
    summary: 'Lithium level: 1.4 mEq/L (HIGH) - review required',
    urgent: true,
    time: '7:15 AM',
    sortDate: '2026-04-02T07:15:00',
  },
  {
    patientKey: 'priya-nair',
    type: 'message',
    patient: 'Priya Nair',
    summary: 'Portal: Medication side effects, requesting callback',
    urgent: false,
    time: '9:05 AM',
    sortDate: '2026-04-02T09:05:00',
  },
  {
    patientKey: 'maria-lopez',
    type: 'task',
    patient: 'Maria Lopez',
    summary: 'PHQ-9 sent - not yet completed',
    urgent: false,
    time: 'Yesterday',
    sortDate: '2026-04-01T12:00:00',
  },
  {
    patientKey: 'angela-torres',
    type: 'refill',
    patient: 'Angela Torres',
    summary: 'Refill: Sertraline 100mg, 30 day supply',
    urgent: false,
    time: '8:00 AM',
    sortDate: '2026-04-02T08:00:00',
  },
  {
    patientKey: 'devon-williams',
    type: 'lab',
    patient: 'Devon Williams',
    summary: 'CBC results received - within normal limits',
    urgent: false,
    time: '6:30 AM',
    sortDate: '2026-04-02T06:30:00',
  },
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getNextMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function getYearStart(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function getNextYearStart(date: Date): Date {
  return new Date(date.getFullYear() + 1, 0, 1);
}

function getWeekStart(date: Date): Date {
  const currentDay = date.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  return addDays(startOfDay(date), diff);
}

function formatSearchDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatClock(dateString: string | undefined): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDob(dateString: string | undefined): string {
  if (!dateString) {
    return 'Unknown';
  }
  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) {
    return 'Recently';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isSameDay(value: string | undefined, date: Date): boolean {
  if (!value) {
    return false;
  }
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getFullYear() === date.getFullYear() &&
    parsed.getMonth() === date.getMonth() &&
    parsed.getDate() === date.getDate()
  );
}

function getPatientName(patient: FhirPatient | undefined, fallbackDisplay: string | undefined): string {
  const name = patient?.name?.[0];
  const formatted = name ? formatHumanName(name) : undefined;
  return formatted || fallbackDisplay || 'Unknown Patient';
}

function getPatientKey(patient: FhirPatient | undefined, fallbackDisplay: string | undefined): string {
  return patient?.id ?? nameToSlug(getPatientName(patient, fallbackDisplay));
}

function getPatientFromReference(
  reference: Reference<FhirPatient> | undefined,
  patientLookup: Map<string, FhirPatient>
): FhirPatient | undefined {
  const id = resolveId(reference);
  return id ? patientLookup.get(id) : undefined;
}

function getAppointmentPatientReference(appointment: FhirAppointment): Reference<FhirPatient> | undefined {
  return appointment.participant?.find((participant) => participant.actor?.reference?.startsWith('Patient/'))?.actor as
    | Reference<FhirPatient>
    | undefined;
}

function getAppointmentDate(appointment: FhirAppointment): string | undefined {
  return appointment.start ?? appointment.requestedPeriod?.[0]?.start;
}

function mapAppointmentStatus(appointment: FhirAppointment): DashboardAppointment['status'] {
  if (appointment.status === 'fulfilled') {
    return 'completed';
  }
  if (appointment.status === 'checked-in' || appointment.status === 'arrived') {
    return 'checked-in';
  }
  const start = appointment.start ? new Date(appointment.start) : undefined;
  const end = appointment.end ? new Date(appointment.end) : undefined;
  const now = new Date();
  if (start && end && start <= now && now <= end) {
    return 'in-progress';
  }
  return 'upcoming';
}

function mapAppointment(
  appointment: FhirAppointment,
  patientLookup: Map<string, FhirPatient>
): DashboardAppointment | undefined {
  const patientRef = getAppointmentPatientReference(appointment);
  const patient = getPatientFromReference(patientRef, patientLookup);
  const name = getPatientName(patient, patientRef?.display);
  const patientKey = getPatientKey(patient, patientRef?.display);
  const mockPatient = PATIENTS[nameToSlug(name)];

  return {
    patientKey,
    time: formatClock(appointment.start ?? appointment.requestedPeriod?.[0]?.start),
    name,
    type:
      appointment.serviceType?.[0]?.text ||
      appointment.appointmentType?.text ||
      appointment.description ||
      'Visit',
    status: mapAppointmentStatus(appointment),
    dob: formatDob(patient?.birthDate),
    flags: mockPatient?.flags?.slice(0, 2),
  };
}

function getInboxUrgency(summary: string, priority: string | undefined): boolean {
  return (
    priority === 'stat' ||
    priority === 'asap' ||
    priority === 'urgent' ||
    /critical|high|abnormal|positive|urgent|denied|review required/i.test(summary)
  );
}

function mapReportToInboxItem(
  report: DiagnosticReport,
  patientLookup: Map<string, FhirPatient>
): DashboardInboxItem | undefined {
  const patient = getPatientFromReference(report.subject as Reference<FhirPatient> | undefined, patientLookup);
  const name = getPatientName(patient, report.subject?.display);
  const summary = [getDisplayString(report), report.conclusion].filter(Boolean).join(' - ') || 'Diagnostic report available';

  return {
    patientKey: getPatientKey(patient, report.subject?.display),
    type: getInboxUrgency(summary, report.status) ? 'alert' : 'lab',
    patient: name,
    summary,
    urgent: getInboxUrgency(summary, report.status),
    time: formatRelativeTime(report.issued ?? report.meta?.lastUpdated),
    sortDate: report.issued ?? report.meta?.lastUpdated ?? '',
  };
}

function mapCommunicationToInboxItem(
  communication: Communication,
  patientLookup: Map<string, FhirPatient>
): DashboardInboxItem | undefined {
  const patient = getPatientFromReference(communication.subject as Reference<FhirPatient> | undefined, patientLookup);
  const name = getPatientName(patient, communication.subject?.display);
  const summary =
    communication.payload?.find((payload) => payload.contentString)?.contentString ||
    communication.topic?.text ||
    communication.status ||
    'New patient message';

  return {
    patientKey: getPatientKey(patient, communication.subject?.display),
    type: 'message',
    patient: name,
    summary,
    urgent: getInboxUrgency(summary, communication.priority),
    time: formatRelativeTime(communication.sent ?? communication.meta?.lastUpdated),
    sortDate: communication.sent ?? communication.meta?.lastUpdated ?? '',
  };
}

function mapTaskToInboxItem(task: Task, patientLookup: Map<string, FhirPatient>): DashboardInboxItem | undefined {
  const patient = getPatientFromReference(task.for as Reference<FhirPatient> | undefined, patientLookup);
  const name = getPatientName(patient, task.for?.display);
  const summary = task.description || task.code?.text || task.status || 'New task';

  return {
    patientKey: getPatientKey(patient, task.for?.display),
    type: 'task',
    patient: name,
    summary,
    urgent: getInboxUrgency(summary, task.priority),
    time: formatRelativeTime(task.authoredOn ?? task.meta?.lastUpdated),
    sortDate: task.authoredOn ?? task.meta?.lastUpdated ?? '',
  };
}

function mapMedicationToInboxItem(
  medicationRequest: MedicationRequest,
  patientLookup: Map<string, FhirPatient>
): DashboardInboxItem | undefined {
  const patient = getPatientFromReference(medicationRequest.subject as Reference<FhirPatient> | undefined, patientLookup);
  const name = getPatientName(patient, medicationRequest.subject?.display);
  const medicationName = getDisplayString(medicationRequest);
  const summary = `Medication request: ${medicationName}`;

  return {
    patientKey: getPatientKey(patient, medicationRequest.subject?.display),
    type: 'refill',
    patient: name,
    summary,
    urgent: getInboxUrgency(summary, medicationRequest.priority),
    time: formatRelativeTime(medicationRequest.authoredOn ?? medicationRequest.meta?.lastUpdated),
    sortDate: medicationRequest.authoredOn ?? medicationRequest.meta?.lastUpdated ?? '',
  };
}

function buildWeekDays(
  today: Date,
  monthAppointments: DashboardAppointment[],
  monthAppointmentSource: FhirAppointment[] | undefined
): DashboardWeekDay[] {
  if (!monthAppointmentSource) {
    return [
      { label: 'Mon, Mar 30', count: 7, key: 'mon', appointments: DEMO_TOMORROW_APTS },
      { label: 'Tue, Mar 31', count: 8, key: 'tue', appointments: DEMO_TOMORROW_APTS },
      { label: 'Wed, Apr 1', count: 6, key: 'wed', appointments: DEMO_TOMORROW_APTS },
      { label: 'Thu, Apr 2', count: 9, key: 'thu', appointments: DEMO_TODAY_APTS, isToday: true },
      { label: 'Fri, Apr 3', count: 5, key: 'fri', appointments: DEMO_TOMORROW_APTS },
      { label: 'Sat, Apr 4', count: 0, key: 'sat', appointments: [] },
      { label: 'Sun, Apr 5', count: 0, key: 'sun', appointments: [] },
    ];
  }

  const weekStart = getWeekStart(today);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const dayAppointments = monthAppointmentSource.flatMap((appointment, appointmentIndex) =>
      isSameDay(getAppointmentDate(appointment), day) && monthAppointments[appointmentIndex]
        ? [monthAppointments[appointmentIndex]]
        : []
    );

    return {
      label: formatWeekLabel(day),
      count: dayAppointments.length,
      key: day.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase(),
      appointments: dayAppointments,
      isToday: isSameDay(day.toISOString(), startOfDay(today)),
    };
  });
}

function buildMonthAppointmentsByDay(
  monthResources: FhirAppointment[] | undefined,
  monthAppointments: DashboardAppointment[]
): Record<number, DashboardAppointment[]> {
  if (!monthResources) {
    return {
      1: DEMO_TODAY_APTS,
      2: DEMO_TODAY_APTS,
      3: DEMO_TOMORROW_APTS,
      4: DEMO_TOMORROW_APTS,
    };
  }

  const result: Record<number, DashboardAppointment[]> = {};
  monthResources.forEach((appointment, index) => {
    const sourceDate = appointment.start ?? appointment.requestedPeriod?.[0]?.start;
    if (!sourceDate) {
      return;
    }
    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }
    const day = parsed.getDate();
    result[day] ??= [];
    if (monthAppointments[index]) {
      result[day].push(monthAppointments[index]);
    }
  });
  return result;
}

function buildYearMonths(today: Date, yearResources: FhirAppointment[] | undefined): DashboardYearMonth[] {
  const currentMonth = today.getMonth();
  const totals = Array.from({ length: 12 }, () => 0);

  if (yearResources) {
    yearResources.forEach((appointment) => {
      const sourceDate = appointment.start ?? appointment.requestedPeriod?.[0]?.start;
      if (!sourceDate) {
        return;
      }
      const parsed = new Date(sourceDate);
      if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() === today.getFullYear()) {
        totals[parsed.getMonth()] += 1;
      }
    });
  } else {
    totals[0] = 142;
    totals[1] = 128;
    totals[2] = 156;
    totals[3] = 89;
  }

  return Array.from({ length: 12 }, (_, index) => ({
    name: new Date(today.getFullYear(), index, 1).toLocaleDateString('en-US', { month: 'short' }),
    total: totals[index],
    current: index === currentMonth,
  }));
}

function buildAiGreeting(todayAppointments: DashboardAppointment[], inbox: DashboardInboxItem[]): string {
  const urgentItems = inbox.filter((item) => item.urgent);
  const nextAppointment = todayAppointments.find((appointment) => appointment.status !== 'completed');
  if (urgentItems.length > 0 && nextAppointment) {
    return `${urgentItems[0].patient}: ${urgentItems[0].summary}. Next patient is ${nextAppointment.name} at ${nextAppointment.time}.`;
  }
  if (nextAppointment) {
    return `Next patient is ${nextAppointment.name} at ${nextAppointment.time}. ${todayAppointments.length} appointments are on your schedule today.`;
  }
  return 'No live schedule items are loaded yet. You can still use Solentra to search records and draft notes.';
}

export function useSolentraDashboardData(): DashboardData {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = getMonthStart(now);
  const nextMonthStart = getNextMonthStart(now);
  const yearStart = getYearStart(now);
  const nextYearStart = getNextYearStart(now);

  const monthQuery = `date=ge${formatSearchDate(monthStart)}&date=lt${formatSearchDate(
    nextMonthStart
  )}&_count=500&_sort=date`;
  const yearQuery = `date=ge${formatSearchDate(yearStart)}&date=lt${formatSearchDate(
    nextYearStart
  )}&_count=1000&_sort=date`;

  const [patients, patientsLoading] = useSearchResources('Patient', { _count: 200, _sort: '-_lastUpdated' });
  const [monthAppointments, monthAppointmentsLoading] = useSearchResources('Appointment', monthQuery);
  const [yearAppointments, yearAppointmentsLoading] = useSearchResources('Appointment', yearQuery);
  const [communications, communicationsLoading] = useSearchResources('Communication', {
    _count: 20,
    _sort: '-_lastUpdated',
  });
  const [tasks, tasksLoading] = useSearchResources('Task', { _count: 20, _sort: '-_lastUpdated' });
  const [reports, reportsLoading] = useSearchResources('DiagnosticReport', {
    _count: 20,
    _sort: '-_lastUpdated',
  });
  const [medicationRequests, medicationRequestsLoading] = useSearchResources('MedicationRequest', {
    _count: 20,
    _sort: '-_lastUpdated',
  });

  const patientLookup = useMemo(
    () => new Map((patients ?? []).map((patient) => [patient.id as string, patient as FhirPatient])),
    [patients]
  );

  const liveMonthAppointments = useMemo(
    () => monthAppointments?.map((appointment) => mapAppointment(appointment, patientLookup)).filter(Boolean) as
      | DashboardAppointment[]
      | undefined,
    [monthAppointments, patientLookup]
  );

  const todayAppointments = useMemo(() => {
    if (!monthAppointments || !liveMonthAppointments) {
      return DEMO_TODAY_APTS;
    }
    return liveMonthAppointments.filter((_appointment, index) =>
      isSameDay(monthAppointments[index]?.start ?? monthAppointments[index]?.requestedPeriod?.[0]?.start, todayStart)
    );
  }, [liveMonthAppointments, monthAppointments, todayStart]);

  const tomorrowAppointments = useMemo(() => {
    if (!monthAppointments || !liveMonthAppointments) {
      return DEMO_TOMORROW_APTS;
    }
    const tomorrow = addDays(todayStart, 1);
    return liveMonthAppointments.filter((_appointment, index) =>
      isSameDay(monthAppointments[index]?.start ?? monthAppointments[index]?.requestedPeriod?.[0]?.start, tomorrow)
    );
  }, [liveMonthAppointments, monthAppointments, todayStart]);

  const inbox = useMemo(() => {
    if (!communications || !tasks || !reports || !medicationRequests) {
      return DEMO_INBOX;
    }
    return [
      ...reports.map((report) => mapReportToInboxItem(report, patientLookup)),
      ...communications.map((communication) => mapCommunicationToInboxItem(communication, patientLookup)),
      ...tasks.map((task) => mapTaskToInboxItem(task, patientLookup)),
      ...medicationRequests.map((request) => mapMedicationToInboxItem(request, patientLookup)),
    ]
      .filter((item): item is DashboardInboxItem => Boolean(item))
      .sort((a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime())
      .slice(0, 20);
  }, [communications, medicationRequests, patientLookup, reports, tasks]);

  const weekDays = useMemo(
    () => buildWeekDays(now, liveMonthAppointments ?? DEMO_TODAY_APTS, monthAppointments),
    [liveMonthAppointments, monthAppointments, now]
  );

  const monthAppointmentsByDay = useMemo(
    () => buildMonthAppointmentsByDay(monthAppointments, liveMonthAppointments ?? DEMO_TODAY_APTS),
    [liveMonthAppointments, monthAppointments]
  );

  const yearMonths = useMemo(() => buildYearMonths(now, yearAppointments), [now, yearAppointments]);

  const loading =
    patientsLoading ||
    monthAppointmentsLoading ||
    yearAppointmentsLoading ||
    communicationsLoading ||
    tasksLoading ||
    reportsLoading ||
    medicationRequestsLoading;

  return {
    todayAppointments,
    tomorrowAppointments,
    inbox,
    weekDays,
    monthAppointmentsByDay,
    yearMonths,
    aiGreeting: buildAiGreeting(todayAppointments, inbox),
    loading,
    usingDemoData:
      !monthAppointments || !yearAppointments || !communications || !tasks || !reports || !medicationRequests,
  };
}
