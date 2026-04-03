// Solentra Provider Dashboard
import { Badge, Box, Button, Divider, Group, Menu, Progress, RingProgress, ScrollArea, Stack, Tabs, Text, TextInput, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconArrowUp,
  IconBookmark,
  IconBuildingStore,
  IconCalendar,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconClipboardList,
  IconFlask,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconMaximize,
  IconMessage,
  IconMicrophone,
  IconMinus,
  IconNotes,
  IconPin,
  IconPinnedOff,
  IconPill,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconCircleCheck,
  IconCircleX,
  IconClockHour4,
  IconCurrencyDollar,
  IconFileInvoice,
  IconRefresh,
  IconShieldCheck,
  IconStethoscope,
  IconTrendingUp,
  IconUserCheck,
  IconX,
} from '@tabler/icons-react';
import type { JSX } from 'react';
import { createContext, useContext, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { useNavigate } from 'react-router';
import { nameToSlug, PATIENTS } from './PatientChart';
import { computeAllAlerts } from './clinicalAlerts';
import type { ClinicalAlert } from './clinicalAlerts';
import { useSolentraDashboardData } from './dashboardData';
import type { DashboardData } from './dashboardData';
import { useLivePatientRecord } from './patientData';
import classes from './ProviderDashboard.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Appointment {
  patientKey: string;
  time: string; name: string; type: string;
  status: 'upcoming' | 'checked-in' | 'in-progress' | 'completed';
  dob: string; flags?: string[];
}
interface InboxItem {
  patientKey?: string;
  type: 'lab' | 'message' | 'task' | 'alert' | 'refill';
  patient: string; summary: string; urgent: boolean; time: string;
}
interface ChatMessage { role: 'user' | 'ai'; text: string; time: string; }
interface WindowState {
  x: number; y: number; w: number; h: number;
  minimized: boolean; closed: boolean; pinned: boolean; zIndex: number;
  prevX?: number; prevY?: number; prevW?: number; prevH?: number;
}

const DashboardDataContext = createContext<DashboardData | undefined>(undefined);

function useDashboardData(): DashboardData {
  const value = useContext(DashboardDataContext);
  if (!value) {
    throw new Error('Dashboard data context not found');
  }
  return value;
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const TODAY_APTS: Appointment[] = [
  { patientKey: 'james-carter', time: '9:00 AM',  name: 'James Carter',   type: 'Follow-up',      status: 'completed',   dob: '03/14/1982' },
  { patientKey: 'maria-lopez', time: '9:30 AM',  name: 'Maria Lopez',    type: 'Med Management', status: 'completed',   dob: '07/22/1975', flags: ['PHQ-9 due'] },
  { patientKey: 'devon-williams', time: '10:00 AM', name: 'Devon Williams', type: 'New Patient',    status: 'in-progress', dob: '11/05/1990' },
  { patientKey: 'sara-mitchell', time: '10:45 AM', name: 'Sara Mitchell',  type: 'Follow-up',      status: 'checked-in',  dob: '05/30/1988', flags: ['SI flagged last visit'] },
  { patientKey: 'thomas-reed', time: '11:30 AM', name: 'Thomas Reed',    type: 'Med Management', status: 'upcoming',    dob: '09/12/1965' },
  { patientKey: 'priya-nair', time: '1:00 PM',  name: 'Priya Nair',     type: 'Follow-up',      status: 'upcoming',    dob: '02/18/1993' },
  { patientKey: 'kevin-park', time: '1:45 PM',  name: 'Kevin Park',     type: 'New Patient',    status: 'upcoming',    dob: '06/04/2001' },
  { patientKey: 'angela-torres', time: '2:30 PM',  name: 'Angela Torres',  type: 'Follow-up',      status: 'upcoming',    dob: '12/09/1979', flags: ['BP elevated last visit'] },
  { patientKey: 'robert-chen', time: '3:15 PM',  name: 'Robert Chen',    type: 'Med Management', status: 'upcoming',    dob: '08/27/1958' },
];
const TOMORROW_APTS: Appointment[] = [
  { patientKey: 'linda-hayes', time: '9:00 AM',  name: 'Linda Hayes',   type: 'New Patient',    status: 'upcoming', dob: '04/11/1985' },
  { patientKey: 'marcus-bell', time: '10:00 AM', name: 'Marcus Bell',   type: 'Follow-up',      status: 'upcoming', dob: '01/30/1972' },
  { patientKey: 'sheila-okafor', time: '11:00 AM', name: 'Sheila Okafor', type: 'Med Management', status: 'upcoming', dob: '09/08/1994' },
];
const INBOX: InboxItem[] = [
  { type: 'alert',   patient: 'Sara Mitchell',  summary: 'Daily PHQ-9: Marked positive SI today',               urgent: true,  time: '8:42 AM' },
  { type: 'lab',     patient: 'Thomas Reed',    summary: 'Lithium level: 1.4 mEq/L (HIGH) — review required',   urgent: true,  time: '7:15 AM' },
  { type: 'message', patient: 'Priya Nair',     summary: 'Portal: Medication side effects, requesting callback', urgent: false, time: '9:05 AM' },
  { type: 'task',    patient: 'Maria Lopez',    summary: 'PHQ-9 sent — not yet completed',                       urgent: false, time: 'Yesterday' },
  { type: 'refill',  patient: 'Angela Torres',  summary: 'Refill: Sertraline 100mg, 30 day supply',              urgent: false, time: '8:00 AM' },
  { type: 'lab',     patient: 'Devon Williams', summary: 'CBC results received — within normal limits',          urgent: false, time: '6:30 AM' },
];
// ── Inbox extended mock data ──────────────────────────────────────────────────

interface OpenNote {
  patient: string; date: string; type: string;
  status: 'unsigned' | 'unbilled'; provider: string; cpt?: string;
}
interface PendingMed {
  patient: string; med: string; dose: string;
  status: 'not_sent' | 'pharmacy_request'; pharmacy: string; time: string; urgent?: boolean;
}

const OPEN_NOTES: OpenNote[] = [
  { patient: 'Devon Williams', date: '04/02/2026', type: 'New Patient Eval',   status: 'unsigned', provider: 'Dr. Carton' },
  { patient: 'Sara Mitchell',  date: '02/15/2026', type: 'Follow-up',          status: 'unsigned', provider: 'Dr. Carton' },
];
const UNBILLED_NOTES: OpenNote[] = [
  { patient: 'James Carter',  date: '04/02/2026', type: 'Follow-up',      status: 'unbilled', provider: 'Dr. Carton', cpt: '90833' },
  { patient: 'Maria Lopez',   date: '04/02/2026', type: 'Med Management', status: 'unbilled', provider: 'Dr. Carton', cpt: '90833' },
  { patient: 'Robert Chen',   date: '03/28/2026', type: 'Med Management', status: 'unbilled', provider: 'Dr. Carton', cpt: '99213' },
  { patient: 'Priya Nair',    date: '03/22/2026', type: 'Follow-up',      status: 'unbilled', provider: 'Dr. Carton', cpt: '90833' },
];
const PENDING_MEDS: PendingMed[] = [
  { patient: 'Sara Mitchell', med: 'Sertraline',  dose: '100mg #30',  status: 'not_sent',         pharmacy: 'CVS Pharmacy #1204',   time: 'Today' },
  { patient: 'Thomas Reed',   med: 'Lithium',     dose: '600mg #60',  status: 'not_sent',         pharmacy: 'Walgreens #8812',      time: 'Today',    urgent: true },
];
const PHARMACY_REQUESTS: PendingMed[] = [
  { patient: 'Angela Torres', med: 'Sertraline',  dose: '100mg #30',  status: 'pharmacy_request', pharmacy: 'CVS Pharmacy #1204',   time: '8:00 AM' },
  { patient: 'Kevin Park',    med: 'Quetiapine',  dose: '50mg #30',   status: 'pharmacy_request', pharmacy: 'Rite Aid #334',        time: '7:45 AM' },
  { patient: 'Marcus Bell',   med: 'Lamotrigine', dose: '200mg #30',  status: 'pharmacy_request', pharmacy: 'Walgreens #8812',      time: 'Yesterday' },
];

const INITIAL_MSGS: ChatMessage[] = [
  { role: 'ai', text: "Good morning! Sara Mitchell marked positive SI on her check-in — she's at 10:45 AM. Thomas Reed's lithium came back high. Want me to pull up either chart?", time: '8:45 AM' },
];

// Week / Month / Year mock data (April 2026)
const WEEK_DAYS = [
  { label: 'Mon, Mar 30', count: 7,  key: 'mon', apts: TOMORROW_APTS },
  { label: 'Tue, Mar 31', count: 8,  key: 'tue', apts: TOMORROW_APTS },
  { label: 'Wed, Apr 1',  count: 6,  key: 'wed', apts: TOMORROW_APTS },
  { label: 'Thu, Apr 2',  count: 9,  key: 'thu', apts: TODAY_APTS,    isToday: true },
  { label: 'Fri, Apr 3',  count: 5,  key: 'fri', apts: TOMORROW_APTS },
  { label: 'Sat, Apr 4',  count: 0,  key: 'sat', apts: [] },
  { label: 'Sun, Apr 5',  count: 0,  key: 'sun', apts: [] },
];

// Days in April 2026 that have appointments (1-indexed)
const MONTH_APT_DAYS: Record<number, number> = {
  1: 8, 2: 9, 3: 7, 4: 6, 7: 5, 8: 8, 9: 7, 10: 9,
  14: 6, 15: 8, 16: 7, 17: 5, 21: 9, 22: 8, 23: 6, 24: 7,
  28: 8, 29: 5, 30: 7,
};

const YEAR_MONTHS = [
  { name: 'Jan', total: 142 }, { name: 'Feb', total: 128 }, { name: 'Mar', total: 156 },
  { name: 'Apr', total: 89,  current: true },
  { name: 'May', total: 0 },  { name: 'Jun', total: 0 },
  { name: 'Jul', total: 0 },  { name: 'Aug', total: 0 },
  { name: 'Sep', total: 0 },  { name: 'Oct', total: 0 },
  { name: 'Nov', total: 0 },  { name: 'Dec', total: 0 },
];

const LEGACY_MOCK_DATA = { TODAY_APTS, TOMORROW_APTS, INBOX, INITIAL_MSGS, WEEK_DAYS, MONTH_APT_DAYS, YEAR_MONTHS };
void LEGACY_MOCK_DATA;

// ── Schedule sub-views ────────────────────────────────────────────────────────

function WeekView({ onPatientClick }: { onPatientClick: (slug: string) => void }): JSX.Element {
  const { weekDays } = useDashboardData();
  const [expanded, setExpanded] = useState<string>(weekDays.find((day) => day.isToday)?.key ?? weekDays[0]?.key ?? '');
  return (
    <ScrollArea h="100%">
      <Stack gap={0}>
        {weekDays.map((day) => (
          <Box key={day.key}>
            <Box
              onClick={() => setExpanded(expanded === day.key ? '' : day.key)}
              style={{
                padding: '8px 14px', borderBottom: '1px solid #e9ecef',
                background: day.isToday ? '#f0f4ff' : expanded === day.key ? '#f8f9fa' : 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <Group gap={8}>
                {day.isToday && <Badge size="xs" color="blue">Today</Badge>}
                <Text size="sm" fw={day.isToday ? 700 : 400} c={day.count === 0 ? 'dimmed' : undefined}>{day.label}</Text>
              </Group>
              <Group gap={6}>
                {day.count > 0
                  ? <Badge size="xs" variant="light" color="blue">{day.count}</Badge>
                  : <Text size="xs" c="dimmed">Off</Text>
                }
                <IconChevronDown size={12} color="#adb5bd"
                  style={{ transform: expanded === day.key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </Group>
            </Box>
            {expanded === day.key && (
              <Stack gap={0} style={{ background: '#fafbfc', borderBottom: '1px solid #e9ecef' }}>
                {day.appointments.length > 0
                  ? day.appointments
                      .slice(0, day.count)
                      .map((a, i) => <ApptRow key={i} appt={a} onClick={() => onPatientClick(a.patientKey)} />)
                  : <Box px="md" py="sm"><Text size="xs" c="dimmed">No appointments scheduled</Text></Box>
                }
              </Stack>
            )}
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  );
}

function MonthView({ onPatientClick }: { onPatientClick: (slug: string) => void }): JSX.Element {
  const { monthAppointmentsByDay } = useDashboardData();
  const now = new Date();
  const today = now.getDate();
  const [selectedDay, setSelectedDay] = useState<number | null>(today);
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedAppointments = selectedDay ? (monthAppointmentsByDay[selectedDay] ?? []) : [];
  const selectedApts = selectedAppointments.length;

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box p="xs">
        <Text size="sm" fw={700} ta="center" mb="xs">
          {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        {/* Header row */}
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {DAY_HEADERS.map((d, i) => (
            <Text key={i} size="xs" fw={700} c="dimmed" ta="center">{d}</Text>
          ))}
        </Box>
        {/* Calendar grid */}
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {cells.map((day, i) => {
            const apts = day ? (monthAppointmentsByDay[day]?.length ?? 0) : 0;
            const isToday = day === today;
            const isSelected = day === selectedDay;
            const isWeekend = (i % 7) >= 5;
            return (
              <Box
                key={i}
                onClick={() => day && setSelectedDay(day === selectedDay ? null : day)}
                style={{
                  border: `1.5px solid ${isSelected ? '#0f6cbd' : isToday ? '#74b4f0' : '#e9ecef'}`,
                  borderRadius: 6, padding: '3px 2px',
                  background: isSelected ? '#0f6cbd' : isToday ? '#e8f0fe' : isWeekend ? '#fafafa' : 'white',
                  minHeight: 38, cursor: day ? 'pointer' : 'default',
                  opacity: day ? 1 : 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}
              >
                {day && (
                  <>
                    <Text size="xs" fw={isToday || isSelected ? 700 : 400}
                      c={isSelected ? 'white' : isToday ? 'blue' : isWeekend ? 'dimmed' : undefined}>
                      {day}
                    </Text>
                    {apts > 0 && (
                      <Box style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', marginTop: 2 }}>
                        {Array.from({ length: Math.min(apts, 3) }).map((_, j) => (
                          <Box key={j} style={{ width: 5, height: 5, borderRadius: '50%',
                            background: isSelected ? 'rgba(255,255,255,0.8)' : '#0f6cbd' }} />
                        ))}
                        {apts > 3 && <Text size="xs" lh={1} c={isSelected ? 'white' : 'blue'}>+{apts - 3}</Text>}
                      </Box>
                    )}
                  </>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
      {/* Selected day detail */}
      {selectedDay && (
        <Box style={{ borderTop: '1px solid #e9ecef', flex: 1, overflow: 'auto' }}>
          <Box px="sm" py="xs" style={{ background: '#f0f4ff', borderBottom: '1px solid #e9ecef' }}>
            <Text size="xs" fw={700}>Apr {selectedDay} · {selectedApts} appointment{selectedApts !== 1 ? 's' : ''}</Text>
          </Box>
          <Stack gap={0}>
            {selectedApts > 0
              ? selectedAppointments.map((a, i) => (
                  <Box key={i} style={{ padding: '6px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }}
                    onClick={() => onPatientClick(a.patientKey)}>
                    <Group justify="space-between">
                      <Group gap={6}>
                        <Text size="xs" c="dimmed" w={55}>{a.time}</Text>
                        <Text size="xs" fw={600}>{a.name}</Text>
                      </Group>
                      <Text size="xs" c="dimmed">{a.type}</Text>
                    </Group>
                  </Box>
                ))
              : <Box p="sm"><Text size="xs" c="dimmed">No appointments</Text></Box>
            }
          </Stack>
        </Box>
      )}
    </Box>
  );
}

function YearView(): JSX.Element {
  const { yearMonths } = useDashboardData();
  const maxTotal = Math.max(...yearMonths.map((m) => m.total), 1);
  return (
    <ScrollArea h="100%">
      <Box p="sm">
        <Text size="sm" fw={700} ta="center" mb="sm">{new Date().getFullYear()} Overview</Text>
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {yearMonths.map((month) => (
            <Box
              key={month.name}
              style={{
                border: `1.5px solid ${month.current ? '#0f6cbd' : '#e9ecef'}`,
                borderRadius: 8, padding: '8px 10px',
                background: month.current ? '#e8f0fe' : 'white',
              }}
            >
              <Text size="xs" fw={month.current ? 700 : 400} c={month.current ? 'blue' : 'dimmed'}>{month.name}</Text>
              {month.total > 0 ? (
                <>
                  <Text size="lg" fw={700} lh={1.2} c={month.current ? 'blue' : undefined}>{month.total}</Text>
                  <Text size="xs" c="dimmed" mb={4}>visits</Text>
                  <Progress value={(month.total / maxTotal) * 100} size="xs" color={month.current ? 'blue' : 'gray'} />
                </>
              ) : (
                <Text size="sm" c="dimmed" mt={2}>—</Text>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    </ScrollArea>
  );
}

function getMockResponse(input: string): string {
  const l = input.toLowerCase();
  if (l.includes('sara') || l.includes('mitchell'))
    return "Sara Mitchell, DOB 05/30/1988. PHQ-9 score 16 last visit (moderate-severe). SI was passive, no plan. Meds: Sertraline 100mg, Trazodone 50mg QHS. Want her last note?";
  if (l.includes('thomas') || l.includes('lithium'))
    return "Thomas Reed's lithium is 1.4 mEq/L — above range (0.6–1.2). Recommend holding evening dose, recheck in 48hrs. Draft a note?";
  if (l.includes('schedule') || l.includes('today'))
    return "9 patients today. 2 completed, 1 in progress, 6 upcoming. Next: Sara Mitchell at 10:45 AM.";
  if (l.includes('template'))
    return "Which template? Follow-up, New Patient, Med Management, Crisis Assessment, or Therapy Note.";
  return "I can pull up charts, labs, medications, and templates. What do you need?";
}

// ── Row components ────────────────────────────────────────────────────────────

function ApptRow({ appt, onClick }: { appt: Appointment; onClick: () => void }): JSX.Element {
  const c: Record<string, string> = { upcoming: 'gray', 'checked-in': 'blue', 'in-progress': 'teal', completed: 'green' };
  return (
    <Box className={classes.appointmentRow} onClick={onClick}>
      <Group justify="space-between" wrap="nowrap">
        <Group wrap="nowrap" gap="sm">
          <Text size="sm" fw={600} c="dimmed" w={65}>{appt.time}</Text>
          <Box>
            <Group gap={6}>
              <Text size="sm" fw={600}>{appt.name}</Text>
              {appt.flags?.map((f) => <Badge key={f} size="xs" color="orange" variant="light">{f}</Badge>)}
            </Group>
            <Text size="xs" c="dimmed">{appt.type} · DOB {appt.dob}</Text>
          </Box>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" color={c[appt.status]} variant="light">{appt.status.replace('-', ' ')}</Badge>
          <IconChevronRight size={14} color="gray" />
        </Group>
      </Group>
    </Box>
  );
}

function InboxRow({ item }: { item: InboxItem }): JSX.Element {
  const icons: Record<string, JSX.Element> = {
    lab: <IconFlask size={15} />, message: <IconMessage size={15} />,
    task: <IconClipboardList size={15} />, alert: <IconAlertTriangle size={15} />, refill: <IconPill size={15} />,
  };
  const colors: Record<string, string> = { lab: 'blue', message: 'teal', task: 'violet', alert: 'red', refill: 'orange' };
  return (
    <Box className={`${classes.inboxRow} ${item.urgent ? classes.urgent : ''}`}>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group wrap="nowrap" align="flex-start" gap="sm">
          <ThemeIcon size="sm" variant="light" color={colors[item.type]} mt={2}>{icons[item.type]}</ThemeIcon>
          <Box>
            <Text size="sm" fw={600}>{item.patient}</Text>
            <Text size="xs" c={item.urgent ? 'red' : 'dimmed'}>{item.summary}</Text>
          </Box>
        </Group>
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{item.time}</Text>
      </Group>
    </Box>
  );
}

// ── Window Chrome ─────────────────────────────────────────────────────────────

function WindowChrome({ id, title, icon, badge, state, onMinimize, onMaximize, onClose, onPin, onFocus, containerH, children }: {
  id: string; title: string; icon: JSX.Element; badge?: JSX.Element;
  state: WindowState;
  onMinimize: () => void; onMaximize: () => void; onClose: () => void; onPin: () => void; onFocus: () => void;
  containerH: number;
  children: JSX.Element;
}): JSX.Element {
  const isAi = id === 'ai';
  return (
    <Box
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 14, border: '1px solid #c0c0c0', boxShadow: `0 4px 20px rgba(0,0,0,${state.zIndex > 1 ? '0.20' : '0.10'})`, background: 'white' }}
      onMouseDown={onFocus}
    >
      {/* Title bar */}
      <Box
        className={`${classes.windowBar} ${isAi ? classes.windowBarAi : ''}`}
        style={{ cursor: state.pinned ? 'default' : 'grab' }}
        data-drag-handle={state.pinned ? undefined : 'true'}
      >
        <Box className={classes.trafficLights}>
          <Tooltip label="Close" openDelay={600}>
            <button className={`${classes.dot} ${classes.dotClose}`} onClick={(e) => { e.stopPropagation(); onClose(); }} />
          </Tooltip>
          <Tooltip label="Minimize" openDelay={600}>
            <button className={`${classes.dot} ${classes.dotMin}`} onClick={(e) => { e.stopPropagation(); onMinimize(); }} />
          </Tooltip>
          <Tooltip label="Maximize" openDelay={600}>
            <button className={`${classes.dot} ${classes.dotMax}`} onClick={(e) => { e.stopPropagation(); onMaximize(); }} />
          </Tooltip>
        </Box>
        <Box className={`${classes.windowTitle} ${isAi ? classes.windowTitleAi : ''}`}>
          <Group gap={6} justify="center" wrap="nowrap">{icon}{title}{badge}</Group>
        </Box>
        <Tooltip label={state.pinned ? 'Unpin' : 'Pin in place'} openDelay={400}>
          <button
            className={classes.pinBtn}
            style={{ color: state.pinned ? (isAi ? '#90caf9' : '#0f6cbd') : (isAi ? 'rgba(255,255,255,0.5)' : '#adb5bd') }}
            onClick={(e) => { e.stopPropagation(); onPin(); }}
          >
            {state.pinned ? <IconPin size={12} /> : <IconPinnedOff size={12} />}
          </button>
        </Tooltip>
      </Box>

      {/* Content */}
      {!state.minimized && (
        <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

// ── Panel contents ────────────────────────────────────────────────────────────

function ScheduleContent({ onPatientClick }: { onPatientClick: (slug: string) => void }): JSX.Element {
  const { todayAppointments, tomorrowAppointments } = useDashboardData();
  const navigate = useNavigate();
  const handleClick = (patientKey: string): void => {
    if (PATIENTS[patientKey]) {
      onPatientClick(patientKey);
    } else {
      navigate(`/chart/${patientKey}`);
    }
  };
  return (
    <Tabs defaultValue="today" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs.List px="xs" pt={4}>
        <Tabs.Tab value="today"     leftSection={<IconCalendar size={12} />}>Today</Tabs.Tab>
        <Tabs.Tab value="tomorrow">Tomorrow</Tabs.Tab>
        <Tabs.Tab value="week">Week</Tabs.Tab>
        <Tabs.Tab value="month">Month</Tabs.Tab>
        <Tabs.Tab value="year">Year</Tabs.Tab>
        <Tabs.Tab value="completed" leftSection={<IconCheck size={12} />}>Done</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="today" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{todayAppointments.filter((a) => a.status !== 'completed').map((a, i) => <ApptRow key={i} appt={a} onClick={() => handleClick(a.patientKey)} />)}</Stack></ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="tomorrow" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{tomorrowAppointments.map((a, i) => <ApptRow key={i} appt={a} onClick={() => handleClick(a.patientKey)} />)}</Stack></ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="week" style={{ flex: 1, overflow: 'hidden' }}>
        <WeekView onPatientClick={handleClick} />
      </Tabs.Panel>
      <Tabs.Panel value="month" style={{ flex: 1, overflow: 'hidden' }}>
        <MonthView onPatientClick={handleClick} />
      </Tabs.Panel>
      <Tabs.Panel value="year" style={{ flex: 1, overflow: 'hidden' }}>
        <YearView />
      </Tabs.Panel>
      <Tabs.Panel value="completed" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{todayAppointments.filter((a) => a.status === 'completed').map((a, i) => <ApptRow key={i} appt={a} onClick={() => handleClick(a.patientKey)} />)}</Stack></ScrollArea>
      </Tabs.Panel>
    </Tabs>
  );
}

function SectionHeader({ label, count, color }: { label: string; count?: number; color?: string }): JSX.Element {
  return (
    <Box style={{ padding: '6px 14px 4px', background: '#f8f9fa', borderBottom: '1px solid #e9ecef', borderTop: '1px solid #e9ecef' }}>
      <Group gap={6}>
        <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Text>
        {count !== undefined && <Badge size="xs" color={color ?? 'gray'} variant="light">{count}</Badge>}
      </Group>
    </Box>
  );
}

function NotesTab(): JSX.Element {
  return (
    <ScrollArea h="100%">
      <Stack gap={0}>
        <SectionHeader label="Unsigned / Open" count={OPEN_NOTES.length} color="orange" />
        {OPEN_NOTES.map((n, i) => (
          <Box key={i} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer', background: '#fffbf0' }}
            className={classes.inboxRow}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <ThemeIcon size="sm" color="orange" variant="light"><IconNotes size={13} /></ThemeIcon>
                <Box>
                  <Text size="sm" fw={600}>{n.patient}</Text>
                  <Text size="xs" c="dimmed">{n.type} · {n.date}</Text>
                </Box>
              </Group>
              <Badge size="xs" color="orange" variant="filled">Unsigned</Badge>
            </Group>
          </Box>
        ))}

        <SectionHeader label="Not Billed" count={UNBILLED_NOTES.length} color="red" />
        {UNBILLED_NOTES.map((n, i) => (
          <Box key={i} className={classes.inboxRow} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <ThemeIcon size="sm" color="red" variant="light"><IconReceipt size={13} /></ThemeIcon>
                <Box>
                  <Text size="sm" fw={600}>{n.patient}</Text>
                  <Text size="xs" c="dimmed">{n.type} · {n.date}</Text>
                </Box>
              </Group>
              <Group gap={4}>
                {n.cpt && <Badge size="xs" variant="outline" color="gray">{n.cpt}</Badge>}
                <Badge size="xs" color="red" variant="light">Unbilled</Badge>
              </Group>
            </Group>
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  );
}

function MedsTab(): JSX.Element {
  return (
    <ScrollArea h="100%">
      <Stack gap={0}>
        <SectionHeader label="Pending — Not Sent to Pharmacy" count={PENDING_MEDS.length} color="orange" />
        {PENDING_MEDS.map((m, i) => (
          <Box key={i} className={`${classes.inboxRow} ${m.urgent ? classes.urgent : ''}`}
            style={{ padding: '10px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <ThemeIcon size="sm" color={m.urgent ? 'red' : 'orange'} variant="light"><IconPill size={13} /></ThemeIcon>
                <Box>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>{m.patient}</Text>
                    {m.urgent && <Badge size="xs" color="red" variant="filled">Urgent</Badge>}
                  </Group>
                  <Text size="xs" c="dimmed">{m.med} {m.dose} · {m.pharmacy}</Text>
                </Box>
              </Group>
              <Group gap={6}>
                <Badge size="xs" color="orange" variant="light">Not sent</Badge>
                <Button size="xs" variant="light" color="blue" >Send</Button>
              </Group>
            </Group>
          </Box>
        ))}

        <SectionHeader label="Pharmacy Refill Requests" count={PHARMACY_REQUESTS.length} color="blue" />
        {PHARMACY_REQUESTS.map((m, i) => (
          <Box key={i} className={classes.inboxRow} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap={8} wrap="nowrap">
                <ThemeIcon size="sm" color="blue" variant="light"><IconBuildingStore size={13} /></ThemeIcon>
                <Box>
                  <Text size="sm" fw={600}>{m.patient}</Text>
                  <Text size="xs" c="dimmed">{m.med} {m.dose} · {m.pharmacy}</Text>
                </Box>
              </Group>
              <Group gap={4}>
                <Text size="xs" c="dimmed">{m.time}</Text>
                <Button size="xs" variant="light" color="green">Approve</Button>
                <Button size="xs" variant="light" color="red">Deny</Button>
              </Group>
            </Group>
          </Box>
        ))}
      </Stack>
    </ScrollArea>
  );
}

function InboxContent(): JSX.Element {
  const { inbox } = useDashboardData();
  const urgentCount = inbox.filter((i) => i.urgent).length;
  const unsignedCount = OPEN_NOTES.length;
  const unbilledCount = UNBILLED_NOTES.length;
  const pendingMedsCount = PENDING_MEDS.length + PHARMACY_REQUESTS.length;

  return (
    <Tabs defaultValue="all" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs.List px="xs" pt={4}>
        <Tabs.Tab value="all">All</Tabs.Tab>
        <Tabs.Tab value="urgent" leftSection={<IconAlertTriangle size={12} />}>
          Urgent {urgentCount > 0 && <Badge size="xs" color="red" ml={4}>{urgentCount}</Badge>}
        </Tabs.Tab>
        <Tabs.Tab value="labs" leftSection={<IconFlask size={12} />}>Labs</Tabs.Tab>
        <Tabs.Tab value="notes" leftSection={<IconNotes size={12} />}>
          Notes {(unsignedCount + unbilledCount) > 0 && <Badge size="xs" color="orange" ml={4}>{unsignedCount + unbilledCount}</Badge>}
        </Tabs.Tab>
        <Tabs.Tab value="meds" leftSection={<IconPill size={12} />}>
          Meds {pendingMedsCount > 0 && <Badge size="xs" color="blue" ml={4}>{pendingMedsCount}</Badge>}
        </Tabs.Tab>
        <Tabs.Tab value="messages" leftSection={<IconMessage size={12} />}>Messages</Tabs.Tab>
        <Tabs.Tab value="tasks" leftSection={<IconClipboardList size={12} />}>Tasks</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="all" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{inbox.map((item, i) => <InboxRow key={i} item={item} />)}</Stack></ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="urgent" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{inbox.filter((i) => i.urgent).map((item, i) => <InboxRow key={i} item={item} />)}</Stack></ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="labs" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{inbox.filter((i) => i.type === 'lab' || i.type === 'alert').map((item, i) => <InboxRow key={i} item={item} />)}</Stack></ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="notes" style={{ flex: 1, overflow: 'hidden' }}>
        <NotesTab />
      </Tabs.Panel>
      <Tabs.Panel value="meds" style={{ flex: 1, overflow: 'hidden' }}>
        <MedsTab />
      </Tabs.Panel>
      <Tabs.Panel value="messages" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{inbox.filter((i) => i.type === 'message').map((item, i) => <InboxRow key={i} item={item} />)}</Stack></ScrollArea>
      </Tabs.Panel>
      <Tabs.Panel value="tasks" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%"><Stack gap={0}>{inbox.filter((i) => i.type === 'task').map((item, i) => <InboxRow key={i} item={item} />)}</Stack></ScrollArea>
      </Tabs.Panel>
    </Tabs>
  );
}

function AiContent(): JSX.Element {
  const { aiGreeting } = useDashboardData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'ai',
      text: aiGreeting,
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const viewport = useRef<HTMLDivElement>(null);

  const send = (): void => {
    if (!input.trim()) return;
    const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text: input, time: now }, { role: 'ai', text: getMockResponse(input), time: now }]);
    setInput('');
    setTimeout(() => viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' }), 50);
  };

  return (
    <>
      <ScrollArea flex={1} viewportRef={viewport} p="xs">
        <Stack gap="xs">
          {messages.map((msg, i) => (
            <Box key={i} className={msg.role === 'ai' ? classes.aiMessage : classes.userMessage}>
              <Text size="xs" c="dimmed" mb={2}>{msg.role === 'ai' ? 'Solentra' : 'You'} · {msg.time}</Text>
              <Text size="sm">{msg.text}</Text>
            </Box>
          ))}
        </Stack>
      </ScrollArea>
      <Box p="xs" style={{ borderTop: '1px solid #eee' }}>
        <Button color="red" leftSection={<IconMicrophone size={13} />} fullWidth size="xs" mb="xs" variant="light">
          Start Visit Scribe
        </Button>
        <Group gap="xs">
          <TextInput flex={1} size="xs" placeholder="Ask Solentra..." value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()} />
          <Button size="xs" onClick={send}>Send</Button>
        </Group>
      </Box>
    </>
  );
}

// ── Patient Preview panel ─────────────────────────────────────────────────────

function PatientPreviewContent({ patientKey, onOpenChart }: { patientKey: string; onOpenChart: () => void }): JSX.Element {
  const mockPatient = PATIENTS[patientKey];
  const { patient: livePatient, loading } = useLivePatientRecord(mockPatient ? undefined : patientKey);
  const patient = livePatient ?? mockPatient;

  if (loading && !patient) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          Loading patient preview...
        </Text>
      </Box>
    );
  }

  if (!patient) {
    return (
      <Box p="md">
        <Text size="sm" c="dimmed">
          Patient preview is not available for this record yet.
        </Text>
      </Box>
    );
  }

  const latestPHQ = patient.assessments.filter((a) => a.tool === 'PHQ-9').sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestGAD = patient.assessments.filter((a) => a.tool === 'GAD-7').sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastNote = patient.notes[0];
  const activeMeds = patient.meds.filter((m) => m.status === 'active');

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Quick actions */}
      <Box style={{ padding: '8px 12px', borderBottom: '1px solid #e9ecef', background: '#fafafa', flexShrink: 0 }}>
        <Group gap={6}>
          <Button size="xs" color="red"  leftSection={<IconMicrophone size={12} />}>Start Visit</Button>
          <Button size="xs" color="blue" variant="light" leftSection={<IconNotes size={12} />} onClick={onOpenChart}>Full Chart →</Button>
          <Button size="xs" variant="light" leftSection={<IconMessage size={12} />}>Message</Button>
          <Button size="xs" variant="light" leftSection={<IconClipboardList size={12} />}>Send PHQ-9</Button>
        </Group>
      </Box>

      <ScrollArea flex={1} p="sm">
        <Stack gap="sm">
          {/* Patient header */}
          <Box>
            <Group gap={8} mb={4}>
              <Text size="sm" fw={700}>{patient.name}</Text>
              <Text size="xs" c="dimmed">{patient.pronouns}</Text>
              <Badge size="xs" variant="outline" color="gray">{patient.mrn}</Badge>
            </Group>
            <Group gap="lg">
              <Text size="xs" c="dimmed">DOB <Text span fw={600} c="dark">{patient.dob}</Text></Text>
              <Text size="xs" c="dimmed">Age <Text span fw={600} c="dark">{patient.age}</Text></Text>
              <Text size="xs" c="dimmed">{patient.insurance}</Text>
            </Group>
          </Box>

          {/* Flags */}
          {patient.flags.length > 0 && (
            <Box style={{ background: '#fff5f5', border: '1px solid #ffc9c9', borderRadius: 8, padding: '8px 10px' }}>
              <Group gap={6} wrap="wrap">
                <IconAlertTriangle size={13} color="#e03131" />
                {patient.flags.map((f) => <Badge key={f} size="xs" color="red" variant="light">{f}</Badge>)}
              </Group>
            </Box>
          )}

          {/* Allergies */}
          {patient.allergies.length > 0 && patient.allergies[0] !== 'NKDA' && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" mb={4}>ALLERGIES</Text>
              <Group gap={4} wrap="wrap">
                {patient.allergies.map((a) => <Badge key={a} size="xs" color="red" variant="outline">{a}</Badge>)}
              </Group>
            </Box>
          )}

          {/* Diagnoses */}
          {patient.diagnoses.length > 0 && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" mb={4}>DIAGNOSES</Text>
              <Stack gap={2}>
                {patient.diagnoses.map((d, i) => (
                  <Group key={i} gap={6} wrap="nowrap">
                    <Box style={{ width: 5, height: 5, borderRadius: '50%', background: '#7950f2', flexShrink: 0, marginTop: 2 }} />
                    <Text size="xs">{d}</Text>
                  </Group>
                ))}
              </Stack>
            </Box>
          )}

          {/* Medications */}
          {activeMeds.length > 0 && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" mb={4}>ACTIVE MEDICATIONS</Text>
              <Group gap={4} wrap="wrap">
                {activeMeds.map((m, i) => (
                  <Badge key={i} size="sm" variant="outline" color="teal">{m.name} {m.dose}</Badge>
                ))}
              </Group>
            </Box>
          )}

          {/* Latest scores */}
          {(latestPHQ || latestGAD) && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" mb={6}>LATEST SCORES</Text>
              <Stack gap={6}>
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
            </Box>
          )}

          {/* Last note */}
          {lastNote && (
            <Box>
              <Text size="xs" fw={700} c="dimmed" mb={4}>LAST NOTE — {lastNote.date}</Text>
              <Box style={{ background: '#f8f9fa', borderRadius: 8, padding: '8px 10px', borderLeft: '3px solid #dee2e6' }}>
                <Text size="xs" c="dimmed" mb={2}>{lastNote.type} · {lastNote.provider}</Text>
                <Text size="xs" lineClamp={3}>{lastNote.summary}</Text>
              </Box>
            </Box>
          )}
        </Stack>
      </ScrollArea>
    </Box>
  );
}

// ── Prior Auth mock data & panel ─────────────────────────────────────────────

type PAStatus = 'approved' | 'pending' | 'denied' | 'expired' | 'not_started';

interface PriorAuth {
  id: string;
  patient: string;
  medication: string;
  dose: string;
  insurance: string;
  status: PAStatus;
  submittedDate: string;
  expiryDate?: string;
  denialReason?: string;
  cptCodes: string[];
  urgent: boolean;
}

const PRIOR_AUTHS: PriorAuth[] = [
  { id: 'pa-001', patient: 'Sara Mitchell',  medication: 'Vyvanse',        dose: '40mg', insurance: 'BCBS of MA',   status: 'approved',    submittedDate: '03/01/2026', expiryDate: '03/01/2027', cptCodes: ['90833'],       urgent: false },
  { id: 'pa-002', patient: 'Kevin Park',     medication: 'Adderall XR',    dose: '20mg', insurance: 'Aetna',        status: 'pending',     submittedDate: '03/28/2026',                           cptCodes: ['90792'],       urgent: false },
  { id: 'pa-003', patient: 'Thomas Reed',    medication: 'Abilify',        dose: '10mg', insurance: 'Medicare B',   status: 'pending',     submittedDate: '03/25/2026',                           cptCodes: ['90833'],       urgent: true  },
  { id: 'pa-004', patient: 'Angela Torres',  medication: 'Latuda',         dose: '60mg', insurance: 'Blue Cross',   status: 'denied',      submittedDate: '03/10/2026', denialReason: 'Step therapy required — try Risperidone first', cptCodes: ['90833'], urgent: true },
  { id: 'pa-005', patient: 'Priya Nair',     medication: 'Trintellix',     dose: '10mg', insurance: 'Aetna',        status: 'approved',    submittedDate: '01/15/2026', expiryDate: '01/15/2027', cptCodes: ['90833'],       urgent: false },
  { id: 'pa-006', patient: 'Robert Chen',    medication: 'Strattera',      dose: '80mg', insurance: 'Medicare B',   status: 'expired',     submittedDate: '04/01/2025', expiryDate: '04/01/2026', cptCodes: ['90833'],       urgent: true  },
  { id: 'pa-007', patient: 'Maria Lopez',    medication: 'Spravato',       dose: '56mg', insurance: 'BCBS of MA',   status: 'not_started', submittedDate: '',                                     cptCodes: ['90867'],       urgent: false },
  { id: 'pa-008', patient: 'Devon Williams', medication: 'Wellbutrin XL',  dose: '300mg',insurance: 'Aetna',        status: 'pending',     submittedDate: '04/01/2026',                           cptCodes: ['90792'],       urgent: false },
];

function PriorAuthContent(): JSX.Element {
  const navigate = useNavigate();
  const statusConfig: Record<PAStatus, { color: string; icon: JSX.Element; label: string }> = {
    approved:    { color: 'green',  icon: <IconCircleCheck size={14} />,   label: 'Approved'    },
    pending:     { color: 'yellow', icon: <IconClockHour4 size={14} />,    label: 'Pending'     },
    denied:      { color: 'red',    icon: <IconCircleX size={14} />,       label: 'Denied'      },
    expired:     { color: 'orange', icon: <IconAlertTriangle size={14} />, label: 'Expired'     },
    not_started: { color: 'gray',   icon: <IconFileInvoice size={14} />,   label: 'Not Started' },
  };

  const groups: { status: PAStatus; label: string }[] = [
    { status: 'denied',      label: 'Denied — Action Required' },
    { status: 'expired',     label: 'Expired — Renewal Required' },
    { status: 'pending',     label: 'Pending Review' },
    { status: 'not_started', label: 'Not Started' },
    { status: 'approved',    label: 'Active Approvals' },
  ];

  return (
    <ScrollArea h="100%">
      <Stack gap={0}>
        {groups.map(({ status, label }) => {
          const items = PRIOR_AUTHS.filter((pa) => pa.status === status);
          if (items.length === 0) return null;
          const cfg = statusConfig[status];
          return (
            <Box key={status}>
              <SectionHeader
                label={label}
                count={items.length}
                color={cfg.color}
              />
              {items.map((pa) => (
                <Box
                  key={pa.id}
                  className={`${classes.inboxRow} ${pa.urgent ? classes.urgent : ''}`}
                  style={{ padding: '10px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }}
                  onClick={() => navigate(`/chart/${nameToSlug(pa.patient)}`)}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap={8} wrap="nowrap" align="flex-start">
                      <ThemeIcon size="sm" color={cfg.color} variant="light" style={{ flexShrink: 0, marginTop: 2 }}>
                        {cfg.icon}
                      </ThemeIcon>
                      <Box>
                        <Group gap={6} mb={2}>
                          <Text size="sm" fw={600}>{pa.patient}</Text>
                          {pa.urgent && <Badge size="xs" color="red" variant="filled">Urgent</Badge>}
                        </Group>
                        <Text size="xs" fw={500}>{pa.medication} {pa.dose} · {pa.insurance}</Text>
                        {pa.denialReason && (
                          <Text size="xs" c="red" mt={2}>Denied: {pa.denialReason}</Text>
                        )}
                        {pa.expiryDate && status === 'approved' && (
                          <Text size="xs" c="dimmed">Expires: {pa.expiryDate}</Text>
                        )}
                        {pa.submittedDate && status === 'pending' && (
                          <Text size="xs" c="dimmed">Submitted: {pa.submittedDate}</Text>
                        )}
                      </Box>
                    </Group>
                    <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
                      <Badge size="xs" color={cfg.color} variant="light">{cfg.label}</Badge>
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
                    </Stack>
                  </Group>
                </Box>
              ))}
            </Box>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}

// ── Billing Dashboard panel ───────────────────────────────────────────────────

interface Claim {
  patient: string; date: string; cpt: string; description: string;
  amount: number; status: 'paid' | 'pending' | 'denied' | 'unbilled';
  payer: string;
}

const CLAIMS: Claim[] = [
  { patient: 'James Carter',   date: '04/02/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'unbilled', payer: 'United' },
  { patient: 'Maria Lopez',    date: '04/02/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'unbilled', payer: 'BCBS' },
  { patient: 'Devon Williams', date: '04/02/2026', cpt: '90792', description: 'Psychiatric Eval',     amount: 320, status: 'unbilled', payer: 'Aetna' },
  { patient: 'Sara Mitchell',  date: '04/01/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'pending',  payer: 'BCBS' },
  { patient: 'Thomas Reed',    date: '04/01/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'pending',  payer: 'Medicare' },
  { patient: 'Priya Nair',     date: '03/28/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'pending',  payer: 'Aetna' },
  { patient: 'Angela Torres',  date: '03/22/2026', cpt: '99214', description: 'E&M Moderate',         amount: 165, status: 'paid',     payer: 'Blue Cross' },
  { patient: 'Kevin Park',     date: '03/22/2026', cpt: '90792', description: 'Psychiatric Eval',     amount: 320, status: 'paid',     payer: 'Aetna' },
  { patient: 'Robert Chen',    date: '03/15/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'paid',     payer: 'Medicare' },
  { patient: 'Linda Hayes',    date: '03/15/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'denied',   payer: 'BCBS' },
  { patient: 'Marcus Bell',    date: '03/08/2026', cpt: '90833', description: 'Psychotherapy w/ E&M', amount: 185, status: 'paid',     payer: 'United' },
  { patient: 'Sheila Okafor',  date: '03/08/2026', cpt: '99213', description: 'E&M Low Complexity',   amount: 120, status: 'paid',     payer: 'Medicaid' },
];

function BillingContent(): JSX.Element {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');

  const unbilled = CLAIMS.filter((c) => c.status === 'unbilled');
  const pending  = CLAIMS.filter((c) => c.status === 'pending');
  const paid     = CLAIMS.filter((c) => c.status === 'paid');
  const denied   = CLAIMS.filter((c) => c.status === 'denied');

  const totalUnbilled = unbilled.reduce((s, c) => s + c.amount, 0);
  const totalPending  = pending.reduce((s, c) => s + c.amount, 0);
  const totalPaid     = paid.reduce((s, c) => s + c.amount, 0);
  const totalDenied   = denied.reduce((s, c) => s + c.amount, 0);


  // Weekly estimate
  const weeklyTarget = 80 * 185; // 80 claims × avg $185
  const weeklyActual = CLAIMS.filter((c) => c.status === 'paid' || c.status === 'pending')
    .reduce((s, c) => s + c.amount, 0);

  const statusColor: Record<string, string> = { paid: 'green', pending: 'yellow', denied: 'red', unbilled: 'orange' };

  const ClaimRow = ({ claim }: { claim: Claim }): JSX.Element => (
    <Box className={classes.inboxRow}
      style={{ padding: '8px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer' }}
      onClick={() => navigate(`/chart/${nameToSlug(claim.patient)}`)}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap={8} wrap="nowrap">
          <ThemeIcon size="sm" color={statusColor[claim.status]} variant="light">
            <IconCurrencyDollar size={12} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={600}>{claim.patient}</Text>
            <Text size="xs" c="dimmed">{claim.cpt} · {claim.description} · {claim.date}</Text>
          </Box>
        </Group>
        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw={700} c={statusColor[claim.status]}>${claim.amount}</Text>
          <Badge size="xs" color={statusColor[claim.status]} variant="light">{claim.status}</Badge>
        </Group>
      </Group>
    </Box>
  );

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
        <Tabs.Tab value="paid" leftSection={<IconCircleCheck size={12} />}>Paid</Tabs.Tab>
      </Tabs.List>

      {/* Overview */}
      <Tabs.Panel value="overview" style={{ flex: 1, overflow: 'hidden' }}>
        <ScrollArea h="100%">
          <Stack gap="sm" p="sm">
            {/* Revenue ring */}
            <Box style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <RingProgress
                size={140}
                thickness={14}
                roundCaps
                sections={[
                  { value: (totalPaid / (totalPaid + totalPending + totalDenied + totalUnbilled)) * 100, color: 'green',  tooltip: `Paid: $${totalPaid}` },
                  { value: (totalPending / (totalPaid + totalPending + totalDenied + totalUnbilled)) * 100, color: 'yellow', tooltip: `Pending: $${totalPending}` },
                  { value: (totalUnbilled / (totalPaid + totalPending + totalDenied + totalUnbilled)) * 100, color: 'orange', tooltip: `Unbilled: $${totalUnbilled}` },
                  { value: (totalDenied / (totalPaid + totalPending + totalDenied + totalUnbilled)) * 100, color: 'red',    tooltip: `Denied: $${totalDenied}` },
                ]}
                label={
                  <Box style={{ textAlign: 'center' }}>
                    <Text size="xs" c="dimmed">Total</Text>
                    <Text size="lg" fw={800} c="blue">${(totalPaid + totalPending + totalUnbilled).toLocaleString()}</Text>
                  </Box>
                }
              />
            </Box>

            {/* Stat cards */}
            <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Paid',     amount: totalPaid,     count: paid.length,     color: 'green' },
                { label: 'Pending',  amount: totalPending,  count: pending.length,  color: 'yellow' },
                { label: 'Unbilled', amount: totalUnbilled, count: unbilled.length, color: 'orange' },
                { label: 'Denied',   amount: totalDenied,   count: denied.length,   color: 'red' },
              ].map(({ label, amount, count, color }) => (
                <Box key={label} style={{ background: 'white', border: '1px solid #e9ecef', borderRadius: 10, padding: '10px 12px',
                  borderTop: `3px solid var(--mantine-color-${color}-5)` }}>
                  <Text size="xs" c="dimmed">{label}</Text>
                  <Text size="lg" fw={800} c={color}>${amount.toLocaleString()}</Text>
                  <Text size="xs" c="dimmed">{count} claim{count !== 1 ? 's' : ''}</Text>
                </Box>
              ))}
            </Box>

            <Divider label="Weekly Pace" labelPosition="center" />
            <Box>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">vs. target (80 visits/wk)</Text>
                <Text size="xs" fw={600}>${weeklyActual.toLocaleString()} / ${weeklyTarget.toLocaleString()}</Text>
              </Group>
              <Progress value={Math.min((weeklyActual / weeklyTarget) * 100, 100)}
                color={weeklyActual >= weeklyTarget ? 'green' : 'blue'} size="md" radius="xl" />
            </Box>

            <Divider label="Recent Activity" labelPosition="center" />
            <Stack gap={0}>
              {CLAIMS.slice(0, 5).map((c, i) => <ClaimRow key={i} claim={c} />)}
            </Stack>
          </Stack>
        </ScrollArea>
      </Tabs.Panel>

      {/* Per-status tabs */}
      {(['unbilled', 'pending', 'denied', 'paid'] as const).map((status) => (
        <Tabs.Panel key={status} value={status} style={{ flex: 1, overflow: 'hidden' }}>
          <ScrollArea h="100%">
            <Stack gap={0}>
              {status === 'unbilled' && (
                <Box px="sm" py="xs" style={{ background: '#fff8f0', borderBottom: '1px solid #ffd8a8' }}>
                  <Group justify="space-between">
                    <Text size="xs" c="orange" fw={600}>${totalUnbilled} at risk of not being billed</Text>
                    <Button size="xs" color="orange" variant="light">Submit All</Button>
                  </Group>
                </Box>
              )}
              {status === 'denied' && (
                <Box px="sm" py="xs" style={{ background: '#fff5f5', borderBottom: '1px solid #ffc9c9' }}>
                  <Group justify="space-between">
                    <Text size="xs" c="red" fw={600}>${totalDenied} in denied claims — appeal within 90 days</Text>
                    <Button size="xs" color="red" variant="light">Appeal All</Button>
                  </Group>
                </Box>
              )}
              {CLAIMS.filter((c) => c.status === status).map((c, i) => <ClaimRow key={i} claim={c} />)}
            </Stack>
          </ScrollArea>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}

// ── Care Gaps / Clinical Alerts panel ────────────────────────────────────────

function CareGapsContent(): JSX.Element {
  const navigate = useNavigate();
  const allAlerts = computeAllAlerts(PATIENTS);
  const critical  = allAlerts.filter((a) => a.severity === 'critical');
  const warnings  = allAlerts.filter((a) => a.severity === 'warning');
  const info      = allAlerts.filter((a) => a.severity === 'info');

  const severityColor: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' };
  const categoryIcon: Record<string, JSX.Element> = {
    safety:     <IconAlertTriangle size={13} />,
    screening:  <IconClipboardList size={13} />,
    labs:       <IconFlask size={13} />,
    medication: <IconPill size={13} />,
    visit:      <IconCalendar size={13} />,
    billing:    <IconReceipt size={13} />,
  };

  const AlertRow = ({ alert }: { alert: ClinicalAlert }): JSX.Element => (
    <Box
      className={`${classes.inboxRow} ${alert.severity === 'critical' ? classes.urgent : ''}`}
      style={{ padding: '9px 14px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer',
        background: alert.severity === 'critical' ? '#fff5f5' : alert.severity === 'warning' ? '#fffbf0' : 'white' }}
      onClick={() => navigate(`/chart/${alert.patientSlug}`)}
    >
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap={8} wrap="nowrap" align="flex-start">
          <ThemeIcon size="sm" color={severityColor[alert.severity]} variant="light" style={{ flexShrink: 0, marginTop: 1 }}>
            {categoryIcon[alert.category] ?? <IconAlertTriangle size={13} />}
          </ThemeIcon>
          <Box>
            <Group gap={6} mb={1}>
              <Text size="sm" fw={600}>{alert.patientName}</Text>
              <Badge size="xs" color={severityColor[alert.severity]} variant="light">{alert.category}</Badge>
            </Group>
            <Text size="xs" fw={500}>{alert.title}</Text>
            <Text size="xs" c="dimmed" lineClamp={1}>{alert.action}</Text>
          </Box>
        </Group>
        {alert.daysOverdue !== undefined && (
          <Badge size="xs" color={severityColor[alert.severity]} variant="outline" style={{ flexShrink: 0 }}>
            +{alert.daysOverdue}d
          </Badge>
        )}
      </Group>
    </Box>
  );

  if (allAlerts.length === 0) {
    return (
      <Box p="xl" style={{ textAlign: 'center' }}>
        <IconCheck size={32} color="green" />
        <Text size="sm" fw={600} mt="sm">No care gaps — all patients up to date</Text>
      </Box>
    );
  }

  return (
    <ScrollArea h="100%">
      <Stack gap={0}>
        {critical.length > 0 && (
          <>
            <SectionHeader label="Critical" count={critical.length} color="red" />
            {critical.map((a) => <AlertRow key={a.id} alert={a} />)}
          </>
        )}
        {warnings.length > 0 && (
          <>
            <SectionHeader label="Warnings" count={warnings.length} color="orange" />
            {warnings.map((a) => <AlertRow key={a.id} alert={a} />)}
          </>
        )}
        {info.length > 0 && (
          <>
            <SectionHeader label="Informational" count={info.length} color="blue" />
            {info.map((a) => <AlertRow key={a.id} alert={a} />)}
          </>
        )}
      </Stack>
    </ScrollArea>
  );
}

// ── Outstanding Items panel ───────────────────────────────────────────────────

interface OutstandingItem {
  label: string; count: number; color: string; icon: JSX.Element; urgent?: boolean;
}

function OutstandingContent(): JSX.Element {
  const { inbox, todayAppointments } = useDashboardData();
  const items: OutstandingItem[] = [
    { label: 'eRx Requests',          count: PENDING_MEDS.length,                             color: 'orange', icon: <IconPill size={14} />,          urgent: PENDING_MEDS.length > 0 },
    { label: 'Pharmacy Requests',     count: PHARMACY_REQUESTS.length,                        color: 'blue',   icon: <IconBuildingStore size={14} /> },
    { label: 'Labs / Studies',        count: inbox.filter((i) => i.type === 'lab' || i.type === 'alert').length,    color: inbox.some((i) => (i.type === 'lab' || i.type === 'alert') && i.urgent) ? 'red' : 'blue', icon: <IconFlask size={14} />, urgent: inbox.some((i) => (i.type === 'lab' || i.type === 'alert') && i.urgent) },
    { label: 'Flagged Messages',      count: inbox.filter((i) => i.urgent && i.type === 'message').length, color: 'red', icon: <IconMessage size={14} /> },
    { label: 'Open Notes (unsigned)', count: OPEN_NOTES.length,                               color: 'orange', icon: <IconNotes size={14} /> },
    { label: 'Notes Not Billed',      count: UNBILLED_NOTES.length,                           color: 'red',    icon: <IconReceipt size={14} />,       urgent: UNBILLED_NOTES.length > 2 },
    { label: 'Urgent Alerts',         count: inbox.filter((i) => i.urgent).length,            color: 'red',    icon: <IconAlertTriangle size={14} />, urgent: true },
    { label: 'Patient Messages',      count: inbox.filter((i) => i.type === 'message').length,color: 'teal',   icon: <IconMessage size={14} /> },
    { label: 'Open Tasks',            count: inbox.filter((i) => i.type === 'task').length,   color: 'violet', icon: <IconClipboardList size={14} /> },
    { label: 'Today Scheduled',       count: todayAppointments.filter((a) => a.status === 'upcoming' || a.status === 'checked-in').length, color: 'blue', icon: <IconCalendar size={14} /> },
    { label: 'Completed Today',       count: todayAppointments.filter((a) => a.status === 'completed').length, color: 'green', icon: <IconCheck size={14} /> },
  ];

  const urgentItems = items.filter((i) => i.urgent && i.count > 0);
  const otherItems  = items.filter((i) => !i.urgent);

  const Row = ({ item }: { item: OutstandingItem }): JSX.Element => (
    <Box
      className={classes.inboxRow}
      style={{ padding: '9px 16px', borderBottom: '1px solid #f1f3f5', cursor: 'pointer',
        background: item.urgent && item.count > 0 ? '#fff8f8' : 'white' }}
    >
      <Group justify="space-between" align="center">
        <Group gap={8}>
          <ThemeIcon size="sm" color={item.color} variant="light">{item.icon}</ThemeIcon>
          <Text size="sm">{item.label}</Text>
        </Group>
        <Badge
          size="sm"
          color={item.count > 0 ? item.color : 'gray'}
          variant={item.count > 0 ? 'filled' : 'light'}
          style={{ minWidth: 28, textAlign: 'center' }}
        >
          {item.count}
        </Badge>
      </Group>
    </Box>
  );

  return (
    <ScrollArea h="100%">
      <Stack gap={0}>
        {urgentItems.length > 0 && (
          <>
            <SectionHeader label="Needs Attention" count={urgentItems.reduce((s, i) => s + i.count, 0)} color="red" />
            {urgentItems.map((item, i) => <Row key={i} item={item} />)}
          </>
        )}
        <SectionHeader label="All Items" />
        {otherItems.map((item, i) => <Row key={i} item={item} />)}
      </Stack>
    </ScrollArea>
  );
}

// ── Patient Queue panel ───────────────────────────────────────────────────────

function QueueContent(): JSX.Element {
  const { todayAppointments } = useDashboardData();
  const statusOrder: Appointment['status'][] = ['in-progress', 'checked-in', 'upcoming', 'completed'];
  const statusLabel: Record<string, string> = {
    'in-progress': 'With Provider',
    'checked-in':  'Checked In — Waiting',
    'upcoming':    'Scheduled',
    'completed':   'Completed',
  };
  const statusColor: Record<string, string> = {
    'in-progress': 'teal',
    'checked-in':  'blue',
    'upcoming':    'gray',
    'completed':   'green',
  };

  return (
    <ScrollArea h="100%">
      <Box p="sm">
        {/* Summary bar */}
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
          {statusOrder.map((s) => {
            const count = todayAppointments.filter((a) => a.status === s).length;
            return (
              <Box key={s} style={{ textAlign: 'center', padding: '6px 4px', background: 'white',
                border: `1.5px solid ${count > 0 ? '#dee2e6' : '#f1f3f5'}`, borderRadius: 8 }}>
                <Text size="lg" fw={700} c={count > 0 ? statusColor[s] : 'dimmed'}>{count}</Text>
                <Text size="xs" c="dimmed" lh={1.2}>{statusLabel[s].split(' ')[0]}</Text>
              </Box>
            );
          })}
        </Box>

        <Stack gap={6}>
          {statusOrder.map((s) => {
            const apts = todayAppointments.filter((a) => a.status === s);
            if (apts.length === 0) return null;
            return (
              <Box key={s}>
                <Group gap={6} mb={4}>
                  <Box style={{ width: 8, height: 8, borderRadius: '50%',
                    background: s === 'in-progress' ? '#12b886' : s === 'checked-in' ? '#228be6' : s === 'completed' ? '#40c057' : '#adb5bd' }} />
                  <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {statusLabel[s]}
                  </Text>
                </Group>
                <Stack gap={4}>
                  {apts.map((a, i) => (
                    <Box key={i} style={{ background: 'white', border: '1px solid #e9ecef', borderRadius: 8,
                      padding: '8px 12px', borderLeft: `3px solid ${s === 'in-progress' ? '#12b886' : s === 'checked-in' ? '#228be6' : s === 'completed' ? '#40c057' : '#dee2e6'}` }}>
                      <Group justify="space-between" wrap="nowrap">
                        <Box>
                          <Text size="sm" fw={600}>{a.name}</Text>
                          <Text size="xs" c="dimmed">{a.time} · {a.type}</Text>
                          {a.flags?.map((f) => <Badge key={f} size="xs" color="orange" variant="light" mt={2}>{f}</Badge>)}
                        </Box>
                        <Badge size="xs" color={statusColor[s]} variant="light">{a.status.replace('-', ' ')}</Badge>
                      </Group>
                    </Box>
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </ScrollArea>
  );
}

// ── Favorites ─────────────────────────────────────────────────────────────────

type WinMap = Record<string, WindowState>;
const STORAGE_KEY = 'solentra-win-layouts';

function loadLayouts(): Record<number, { wins: WinMap; label: string }> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); } catch { return {}; }
}

function FavoriteSlots({ wins, onLoad }: { wins: WinMap; onLoad: (w: WinMap) => void }): JSX.Element {
  const [saved, setSaved] = useState(loadLayouts);
  const [active, setActive] = useState<number | null>(null);

  const save = (slot: number): void => {
    const next = { ...saved, [slot]: { wins, label: `Layout ${slot}` } };
    setSaved(next); setActive(slot);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const load = (slot: number): void => {
    if (saved[slot]) { onLoad(saved[slot].wins); setActive(slot); }
  };

  return (
    <Group gap={6} align="center">
      <IconBookmark size={14} color="#868e96" />
      <Text size="xs" c="dimmed">Layouts:</Text>
      {[1, 2, 3, 4].map((slot) => (
        <Tooltip key={slot} label={saved[slot] ? `Load (right-click to save)` : `Right-click to save`}>
          <Box
            className={`${classes.favoriteSlot} ${active === slot ? classes.favoriteSlotActive : ''} ${saved[slot] && active !== slot ? classes.favoriteSlotSaved : ''}`}
            onClick={() => load(slot)}
            onContextMenu={(e) => { e.preventDefault(); save(slot); }}
          >{slot}</Box>
        </Tooltip>
      ))}
      <Menu shadow="md" width={160}>
        <Menu.Target>
          <Box style={{ cursor: 'pointer' }}><IconChevronDown size={14} color="#868e96" /></Box>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Saved Layouts</Menu.Label>
          {Object.entries(saved).length === 0 && <Menu.Item disabled>None saved yet</Menu.Item>}
          {Object.entries(saved).map(([s, { label }]) => (
            <Menu.Item key={s} leftSection={<IconBookmark size={13} />} onClick={() => load(Number(s))}>{label}</Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item color="red" onClick={() => { setSaved({}); setActive(null); localStorage.removeItem(STORAGE_KEY); }}>Clear all</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}

// ── Window Pills ──────────────────────────────────────────────────────────────

const PILL_META: Record<string, { title: string; icon: JSX.Element }> = {
  schedule:    { title: 'Schedule',    icon: <IconCalendar size={11} /> },
  inbox:       { title: 'Inbox',       icon: <IconClipboardList size={11} /> },
  outstanding: { title: 'Outstanding', icon: <IconLayoutGrid size={11} /> },
  caregaps:    { title: 'Care Gaps',   icon: <IconAlertTriangle size={11} /> },
  queue:       { title: 'Queue',       icon: <IconUserCheck size={11} /> },
  ai:          { title: 'AI',          icon: <IconMicrophone size={11} /> },
  priorauth:   { title: 'Prior Auth',  icon: <IconShieldCheck size={11} /> },
  billing:     { title: 'Billing',     icon: <IconReceipt size={11} /> },
};

function WindowPills({ wins, onMinimize, onMaximize, onClose, onOpen }: {
  wins: WinMap;
  onMinimize: (id: string) => void;
  onMaximize: (id: string) => void;
  onClose: (id: string) => void;
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <Group gap={6} align="center">
      <Box className={classes.pillDivider} />
      {Object.entries(PILL_META).map(([id, meta]) => {
        const state = wins[id];
        const isClosed = !state || state.closed;
        const isMin = state?.minimized && !state.closed;
        return (
          <Tooltip
            key={id}
            label={isClosed ? `Open ${meta.title}` : isMin ? `${meta.title} (minimized)` : meta.title}
            openDelay={600}
          >
            <Box
              className={`${classes.windowPill} ${isClosed ? classes.windowPillClosed : isMin ? classes.windowPillMinimized : ''}`}
              onClick={isMin ? () => onMinimize(id) : undefined}
              style={isMin ? { cursor: 'pointer' } : undefined}
            >
              {meta.icon}
              <Text size="xs" fw={600} mx={2} style={{ color: 'inherit' }}>{meta.title}</Text>

              {isClosed ? (
                <button className={classes.pillBtn} onClick={() => onOpen(id)} title="Open">
                  <IconPlus size={10} />
                </button>
              ) : isMin ? (
                <button className={classes.pillBtn} onClick={(e) => { e.stopPropagation(); onMinimize(id); }} title="Restore">
                  <IconArrowUp size={10} />
                </button>
              ) : (
                <>
                  <button
                    className={classes.pillBtn}
                    onClick={() => onMinimize(id)}
                    title="Minimize"
                  >
                    <IconMinus size={10} />
                  </button>
                  <button
                    className={classes.pillBtn}
                    onClick={() => onMaximize(id)}
                    title="Maximize"
                  >
                    <IconMaximize size={10} />
                  </button>
                  <button
                    className={`${classes.pillBtn} ${classes.pillBtnClose}`}
                    onClick={() => onClose(id)}
                    title="Close"
                  >
                    <IconX size={10} />
                  </button>
                </>
              )}
            </Box>
          </Tooltip>
        );
      })}
      <Box className={classes.pillDivider} />
    </Group>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

function defaultWins(w: number, h: number): WinMap {
  const col1 = Math.floor(w * 0.35);
  const col2 = Math.floor(w * 0.30);
  const col3 = Math.floor(w * 0.20);
  const col4 = Math.floor(w * 0.15) - 10;
  return {
    schedule:    { x: 0,                    y: 0, w: col1,     h, minimized: false, closed: false, pinned: false, zIndex: 1 },
    inbox:       { x: col1 + 8,             y: 0, w: col2,     h, minimized: false, closed: false, pinned: false, zIndex: 1 },
    ai:          { x: col1 + col2 + 16,     y: 0, w: col3,     h, minimized: false, closed: false, pinned: false, zIndex: 1 },
    outstanding: { x: col1 + col2 + col3 + 24, y: 0, w: col4, h, minimized: false, closed: false, pinned: false, zIndex: 1 },
    // these start closed — open via Panels menu
    caregaps:    { x: 20, y: 20, w: Math.floor(w * 0.35), h: Math.floor(h * 0.80), minimized: false, closed: true, pinned: false, zIndex: 1 },
    queue:       { x: 60, y: 20, w: Math.floor(w * 0.35), h: Math.floor(h * 0.75), minimized: false, closed: true, pinned: false, zIndex: 1 },
    priorauth:   { x: 80, y: 20, w: Math.floor(w * 0.30), h: Math.floor(h * 0.85), minimized: false, closed: true, pinned: false, zIndex: 1 },
    billing:     { x: 100, y: 20, w: Math.floor(w * 0.32), h: Math.floor(h * 0.90), minimized: false, closed: true, pinned: false, zIndex: 1 },
  };
}

let topZ = 10;

export function ProviderDashboard(): JSX.Element {
  const dashboardData = useSolentraDashboardData();
  const { todayAppointments, inbox } = dashboardData;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const completed = todayAppointments.filter((a) => a.status === 'completed').length;
  const urgentCount = inbox.filter((i) => i.urgent).length;

  // containerRef goes on the outer scroll viewport so cW/cH = visible area
  const { ref: containerRef, width: cW, height: cH } = useElementSize();
  const [wins, setWins] = useState<WinMap>({});
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const navigate = useNavigate();

  // Init windows once container size is known
  const initialized = useRef(false);
  if (cW > 0 && cH > 0 && !initialized.current) {
    initialized.current = true;
    setWins(defaultWins(cW, cH));
  }

  const update = (id: string, patch: Partial<WindowState>): void =>
    setWins((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const focus = (id: string): void => {
    topZ++;
    update(id, { zIndex: topZ });
  };

  const minimize = (id: string): void => {
    const w = wins[id];
    if (!w) return;
    if (w.minimized) {
      // Restore to saved position
      update(id, {
        minimized: false,
        x: w.prevX ?? w.x, y: w.prevY ?? w.y,
        w: w.prevW ?? w.w, h: w.prevH ?? cH,
      });
    } else {
      // Save position and hide from canvas
      update(id, { minimized: true, prevX: w.x, prevY: w.y, prevW: w.w, prevH: w.h });
    }
  };

  const openPreview = (slug: string): void => {
    setPreviewSlug(slug);
    topZ++;
    const previewW = 360;
    const previewH = Math.floor(cH * 0.80);
    const existing = wins['preview'];
    update('preview', {
      closed: false, minimized: false, zIndex: topZ,
      x: existing?.x ?? Math.floor(cW * 0.35) + 20,
      y: existing?.y ?? 20,
      w: existing?.w ?? previewW,
      h: existing?.h ?? previewH,
    });
  };

  const maximize = (id: string): void => {
    const w = wins[id];
    if (!w) return;
    const isMaxed = w.w >= cW * 0.95 && w.h >= cH * 0.95 && !w.minimized;
    if (isMaxed) {
      // Restore to saved position
      update(id, {
        minimized: false,
        x: w.prevX ?? 0, y: w.prevY ?? 0,
        w: w.prevW ?? Math.floor(cW * 0.4), h: w.prevH ?? cH,
      });
    } else {
      // Save position and maximize
      update(id, {
        minimized: false,
        prevX: w.x, prevY: w.y, prevW: w.w, prevH: w.h,
        x: 0, y: 0, w: cW, h: cH,
      });
    }
  };

  const outstandingCount = PENDING_MEDS.length + inbox.filter((i) => i.urgent).length + OPEN_NOTES.length;
  const inProgressCount = todayAppointments.filter((a) => a.status === 'in-progress' || a.status === 'checked-in').length;

  const PANEL_META: Record<string, { title: string; icon: JSX.Element; badge?: JSX.Element; content: JSX.Element }> = {
    schedule: {
      title: 'Schedule',
      icon: <IconCalendar size={13} color="#555" />,
      badge: <Badge size="xs" variant="light" color="blue">{todayAppointments.length} today</Badge>,
      content: <ScheduleContent onPatientClick={openPreview} />,
    },
    inbox: {
      title: 'Clinical Inbox',
      icon: <IconClipboardList size={13} color="#555" />,
      badge: urgentCount > 0 ? <Badge size="xs" color="red" variant="filled">{urgentCount} urgent</Badge> : undefined,
      content: <InboxContent />,
    },
    ai: {
      title: 'Solentra AI',
      icon: <IconMicrophone size={13} color="white" />,
      badge: <Badge size="xs" color="green" variant="filled">● Live</Badge>,
      content: <AiContent />,
    },
    outstanding: {
      title: 'Outstanding Items',
      icon: <IconLayoutGrid size={13} color="#555" />,
      badge: outstandingCount > 0 ? <Badge size="xs" color="red" variant="filled">{outstandingCount}</Badge> : undefined,
      content: <OutstandingContent />,
    },
    queue: {
      title: 'Patient Queue',
      icon: <IconUserCheck size={13} color="#555" />,
      badge: inProgressCount > 0 ? <Badge size="xs" color="teal" variant="filled">{inProgressCount} active</Badge> : undefined,
      content: <QueueContent />,
    },
    caregaps: {
      title: 'Care Gaps',
      icon: <IconAlertTriangle size={13} color="#555" />,
      badge: (() => {
        const allA = computeAllAlerts(PATIENTS);
        const crit = allA.filter((a) => a.severity === 'critical').length;
        const warn = allA.filter((a) => a.severity === 'warning').length;
        return crit > 0
          ? <Badge size="xs" color="red" variant="filled">{crit} critical</Badge>
          : warn > 0
          ? <Badge size="xs" color="orange" variant="filled">{warn} warnings</Badge>
          : undefined;
      })(),
      content: <CareGapsContent />,
    },
    priorauth: {
      title: 'Prior Auth Tracker',
      icon: <IconShieldCheck size={13} color="#555" />,
      badge: (() => {
        const urgent = PRIOR_AUTHS.filter((pa) => pa.status === 'denied' || pa.status === 'expired').length;
        return urgent > 0 ? <Badge size="xs" color="red" variant="filled">{urgent} action needed</Badge> : undefined;
      })(),
      content: <PriorAuthContent />,
    },
    billing: {
      title: 'Billing',
      icon: <IconReceipt size={13} color="#555" />,
      badge: (() => {
        const unbilledCount = CLAIMS.filter((c) => c.status === 'unbilled').length;
        return unbilledCount > 0 ? <Badge size="xs" color="orange" variant="filled">{unbilledCount} unbilled</Badge> : undefined;
      })(),
      content: <BillingContent />,
    },
  };

  return (
    <DashboardDataContext.Provider value={dashboardData}>
      <Box style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh / 0.9)', width: 'calc(100vw / 0.9)', background: '#f4f6f8', zoom: 0.9 }}>
      {/* Top Bar */}
      <Box className={classes.topBar}>
        <Group justify="space-between" align="center">
          <Box>
            <Text size="xs" c="dimmed">{dateStr}</Text>
            <Title order={4}>{greeting}, Dr. Carton</Title>
          </Box>
          <Group gap="sm">
            <TextInput placeholder="Search patients..." leftSection={<IconSearch size={14} />} size="sm" w={220} />
            <Menu shadow="md" width={220}>
              <Menu.Target>
                <Button size="sm" variant="light" leftSection={<IconLayoutGrid size={14} />} rightSection={<IconChevronDown size={12} />}>
                  Panels
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Open / Close Panels</Menu.Label>
                {Object.entries(PANEL_META).map(([id, meta]) => {
                  const state = wins[id];
                  const isClosed = !state || state.closed;
                  const isMin = state?.minimized;
                  return (
                    <Menu.Item
                      key={id}
                      leftSection={meta.icon}
                      rightSection={
                        isClosed ? <Badge size="xs" color="gray" variant="outline">Closed</Badge>
                        : isMin   ? <Badge size="xs" color="blue" variant="light">Minimized</Badge>
                                  : <Badge size="xs" color="green" variant="light">Open</Badge>
                      }
                      onClick={() => {
                        if (isClosed) update(id, { closed: false, minimized: false });
                        else if (isMin) minimize(id);
                        else update(id, { closed: true });
                      }}
                    >
                      {meta.title}
                    </Menu.Item>
                  );
                })}
                <Menu.Divider />
                <Menu.Item leftSection={<IconStethoscope size={13} />} disabled>More panels coming soon...</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button size="sm" color="red" leftSection={<IconMicrophone size={14} />}>Start Scribe</Button>
          </Group>
        </Group>
      </Box>

      {/* Stat Bar */}
      <Box className={classes.statBar}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xl" wrap="nowrap">
            <Group gap={6}><IconLayoutDashboard size={16} color="#0f6cbd" /><Text size="sm"><Text span fw={700}>{todayAppointments.length}</Text> today</Text></Group>
            <Group gap={6}><IconCheck size={16} color="green" /><Text size="sm"><Text span fw={700}>{completed}</Text> completed</Text></Group>
            <Group gap={6}>
              <IconAlertTriangle size={16} color={urgentCount > 0 ? 'red' : 'gray'} />
              <Text size="sm" c={urgentCount > 0 ? 'red' : undefined}><Text span fw={700}>{urgentCount}</Text> urgent</Text>
            </Group>
            <WindowPills
              wins={wins}
              onMinimize={(id) => minimize(id)}
              onMaximize={(id) => maximize(id)}
              onClose={(id) => update(id, { closed: true })}
              onOpen={(id) => update(id, { closed: false, minimized: false })}
            />
          </Group>
          <FavoriteSlots wins={wins} onLoad={(w) => setWins(w)} />
        </Group>
      </Box>

      {/* Window canvas — outer box = scroll viewport, inner box = infinite canvas */}
      <Box ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#e0e5ec' }}>
      <Box style={{ position: 'relative', minWidth: '100%', minHeight: '100%', width: Math.max(cW, 800), height: Math.max(cH, 600) }}>
        {cW > 0 && Object.entries(wins).map(([id, state]) => {
          if (state.closed || state.minimized) return null;
          const meta = PANEL_META[id];
          if (!meta) return null;
          return (
            <Rnd
              key={id}
              position={{ x: state.x, y: state.y }}
              size={{ width: state.w, height: state.minimized ? 34 : state.h }}
              onDragStop={(_e, d) => { if (!state.pinned) update(id, { x: d.x, y: d.y }); }}
              onResizeStop={(_e, _dir, _ref, delta, pos) => {
                update(id, { w: state.w + delta.width, h: state.h + delta.height, x: pos.x, y: pos.y });
              }}
              disableDragging={state.pinned}
              enableResizing={!state.pinned && !state.minimized}
              dragHandleClassName={classes.windowBar}
              minWidth={220}
              minHeight={34}
              style={{ zIndex: state.zIndex }}
              resizeHandleStyles={{
                bottomRight: { width: 16, height: 16, right: 0, bottom: 0, cursor: 'se-resize' },
                right:       { width: 6,  cursor: 'e-resize' },
                bottom:      { height: 6, cursor: 's-resize' },
              }}
            >
              <WindowChrome
                id={id} title={meta.title} icon={meta.icon} badge={meta.badge}
                state={state}
                onFocus={() => focus(id)}
                onMinimize={() => minimize(id)}
                onMaximize={() => maximize(id)}
                onClose={() => update(id, { closed: true })}
                onPin={() => update(id, { pinned: !state.pinned })}
                containerH={cH}
              >
                {meta.content}
              </WindowChrome>
            </Rnd>
          );
        })}

        {/* Patient Preview window — rendered separately since title/content are dynamic */}
        {cW > 0 && (() => {
          const state = wins['preview'];
          if (!state || state.closed || state.minimized) return null;
          if (!previewSlug) return null;
          const patient = PATIENTS[previewSlug];
          return (
            <Rnd
              key="preview"
              position={{ x: state.x, y: state.y }}
              size={{ width: state.w, height: state.h }}
              onDragStop={(_e, d) => { if (!state.pinned) update('preview', { x: d.x, y: d.y }); }}
              onResizeStop={(_e, _dir, _ref, delta, pos) => {
                update('preview', { w: state.w + delta.width, h: state.h + delta.height, x: pos.x, y: pos.y });
              }}
              disableDragging={state.pinned}
              enableResizing={!state.pinned}
              dragHandleClassName={classes.windowBar}
              minWidth={300}
              minHeight={200}
              style={{ zIndex: state.zIndex }}
              resizeHandleStyles={{
                bottomRight: { width: 16, height: 16, right: 0, bottom: 0, cursor: 'se-resize' },
                right: { width: 6, cursor: 'e-resize' },
                bottom: { height: 6, cursor: 's-resize' },
              }}
            >
              <WindowChrome
                id="preview"
                title={patient?.name ?? 'Patient Preview'}
                icon={<IconUserCheck size={13} color="#555" />}
                badge={patient?.flags.length ? <Badge size="xs" color="red" variant="filled">!</Badge> : undefined}
                state={state}
                onFocus={() => focus('preview')}
                onMinimize={() => minimize('preview')}
                onMaximize={() => maximize('preview')}
                onClose={() => update('preview', { closed: true })}
                onPin={() => update('preview', { pinned: !state.pinned })}
                containerH={cH}
              >
                <PatientPreviewContent
                  patientKey={previewSlug}
                  onOpenChart={() => navigate(`/chart/${previewSlug}`)}
                />
              </WindowChrome>
            </Rnd>
          );
        })()}
      </Box>
      </Box>
      </Box>
    </DashboardDataContext.Provider>
  );
}
