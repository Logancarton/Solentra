// Solentra Clinical Alerts Engine
// Computes care gaps and BPA-style alerts from patient data

import type { Patient } from './PatientChart';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'safety' | 'screening' | 'labs' | 'medication' | 'visit' | 'billing';

export interface ClinicalAlert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  detail: string;
  action: string;
  patientName: string;
  patientSlug: string;
  daysOverdue?: number;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseDate(mmddyyyy: string): Date {
  const [m, d, y] = mmddyyyy.split('/');
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function daysSince(dateStr: string): number {
  const then = parseDate(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

// ── Alert rules ───────────────────────────────────────────────────────────────

export function computeAlerts(patient: Patient): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  const slug = nameToSlug(patient.name);

  // ── Safety alerts ──────────────────────────────────────────────────────────

  const cssrs = patient.assessments.find((a) => a.tool === 'C-SSRS');
  const hasSiHistory = patient.diagnoses.some((d) => d.includes('Z91.51') || d.includes('suicid'));
  const lastNote = patient.notes[0];

  if (cssrs && cssrs.score >= 2) {
    alerts.push({
      id: `${slug}-si-active`,
      severity: 'critical',
      category: 'safety',
      title: 'Active suicidal ideation on C-SSRS',
      detail: `C-SSRS score ${cssrs.score}/5 — ${cssrs.severity} (${cssrs.date})`,
      action: 'Review safety plan, consider level of care',
      patientName: patient.name,
      patientSlug: slug,
    });
  }

  if (hasSiHistory && lastNote) {
    const daysSinceNote = daysSince(lastNote.date);
    if (daysSinceNote > 30) {
      alerts.push({
        id: `${slug}-safety-plan-due`,
        severity: 'warning',
        category: 'safety',
        title: 'Safety plan review overdue',
        detail: `SI history — last reviewed ${daysSinceNote} days ago (${lastNote.date})`,
        action: 'Review and update safety plan this visit',
        patientName: patient.name,
        patientSlug: slug,
        daysOverdue: daysSinceNote - 30,
      });
    }
  }

  // ── Screening alerts ───────────────────────────────────────────────────────

  const lastPHQ = patient.assessments.filter((a) => a.tool === 'PHQ-9')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastGAD = patient.assessments.filter((a) => a.tool === 'GAD-7')
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  const phqThreshold = hasSiHistory ? 14 : 30; // more frequent for high-risk
  if (!lastPHQ) {
    alerts.push({
      id: `${slug}-phq9-never`,
      severity: 'warning',
      category: 'screening',
      title: 'PHQ-9 never completed',
      detail: 'No PHQ-9 on file for this patient',
      action: 'Send PHQ-9 via patient portal',
      patientName: patient.name,
      patientSlug: slug,
    });
  } else {
    const phqDays = daysSince(lastPHQ.date);
    if (phqDays > phqThreshold) {
      alerts.push({
        id: `${slug}-phq9-due`,
        severity: lastPHQ.score >= 15 ? 'warning' : 'info',
        category: 'screening',
        title: `PHQ-9 overdue (${phqDays} days)`,
        detail: `Last score: ${lastPHQ.score} (${lastPHQ.severity}) on ${lastPHQ.date}`,
        action: 'Send PHQ-9 before or during visit',
        patientName: patient.name,
        patientSlug: slug,
        daysOverdue: phqDays - phqThreshold,
      });
    }
  }

  if (!lastGAD) {
    alerts.push({
      id: `${slug}-gad7-never`,
      severity: 'info',
      category: 'screening',
      title: 'GAD-7 never completed',
      detail: 'No GAD-7 on file',
      action: 'Send GAD-7 via patient portal',
      patientName: patient.name,
      patientSlug: slug,
    });
  } else {
    const gadDays = daysSince(lastGAD.date);
    if (gadDays > 60) {
      alerts.push({
        id: `${slug}-gad7-due`,
        severity: 'info',
        category: 'screening',
        title: `GAD-7 overdue (${gadDays} days)`,
        detail: `Last score: ${lastGAD.score} (${lastGAD.severity}) on ${lastGAD.date}`,
        action: 'Send GAD-7 before next visit',
        patientName: patient.name,
        patientSlug: slug,
        daysOverdue: gadDays - 60,
      });
    }
  }

  // ── Lab alerts ─────────────────────────────────────────────────────────────

  const labRules: { name: string; keyword: string; intervalDays: number; severity: AlertSeverity }[] = [
    { name: 'Lithium level',  keyword: 'Lithium',   intervalDays: 90,  severity: 'warning' },
    { name: 'CMP',            keyword: 'CMP',        intervalDays: 180, severity: 'info'    },
    { name: 'TSH',            keyword: 'TSH',        intervalDays: 365, severity: 'info'    },
    { name: 'CBC',            keyword: 'CBC',        intervalDays: 365, severity: 'info'    },
    { name: 'Metabolic panel',keyword: 'Sodium',     intervalDays: 180, severity: 'info'    },
  ];

  for (const rule of labRules) {
    const onLithium = patient.meds.some((m) => m.name.toLowerCase().includes('lithium') && m.status === 'active');
    if (rule.keyword === 'Lithium' && !onLithium) continue;

    const lab = patient.labs.find((l) => l.name.toLowerCase().includes(rule.keyword.toLowerCase()));
    if (!lab) {
      if (rule.keyword === 'Lithium' && onLithium) {
        alerts.push({
          id: `${slug}-lab-${rule.keyword}`,
          severity: 'warning',
          category: 'labs',
          title: `${rule.name} never drawn`,
          detail: `Patient is on Lithium — baseline level required`,
          action: `Order ${rule.name}`,
          patientName: patient.name,
          patientSlug: slug,
        });
      }
    } else {
      const labDays = daysSince(lab.date);
      if (labDays > rule.intervalDays) {
        alerts.push({
          id: `${slug}-lab-${rule.keyword}-due`,
          severity: rule.severity,
          category: 'labs',
          title: `${rule.name} overdue`,
          detail: `Last drawn ${labDays} days ago (${lab.date}) — interval: ${rule.intervalDays} days`,
          action: `Order ${rule.name}`,
          patientName: patient.name,
          patientSlug: slug,
          daysOverdue: labDays - rule.intervalDays,
        });
      }
      // Abnormal result still unreviewed
      if (lab.status === 'high' || lab.status === 'critical') {
        alerts.push({
          id: `${slug}-lab-${rule.keyword}-abnormal`,
          severity: lab.status === 'critical' ? 'critical' : 'warning',
          category: 'labs',
          title: `Abnormal ${rule.name} — ${lab.value} ${lab.unit}`,
          detail: `${lab.status.toUpperCase()}: ${lab.value} ${lab.unit} (ref: ${lab.range}) on ${lab.date}`,
          action: 'Review and address abnormal result',
          patientName: patient.name,
          patientSlug: slug,
        });
      }
    }
  }

  // ── Medication alerts ──────────────────────────────────────────────────────

  for (const med of patient.meds.filter((m) => m.status === 'active')) {
    const daysSinceFill = daysSince(med.lastFilled);
    // Estimate days supply (assume 30 day supply standard)
    if (daysSinceFill > 25 && med.refillsLeft === 0) {
      alerts.push({
        id: `${slug}-med-${med.name}-refill`,
        severity: 'warning',
        category: 'medication',
        title: `${med.name} refill needed — no refills remaining`,
        detail: `Last filled ${daysSinceFill} days ago. 0 refills left at pharmacy.`,
        action: 'Send new prescription to pharmacy',
        patientName: patient.name,
        patientSlug: slug,
      });
    } else if (daysSinceFill > 25 && med.refillsLeft > 0) {
      alerts.push({
        id: `${slug}-med-${med.name}-refill-soon`,
        severity: 'info',
        category: 'medication',
        title: `${med.name} refill due soon`,
        detail: `Last filled ${daysSinceFill} days ago. ${med.refillsLeft} refill(s) remaining.`,
        action: 'Refill available — patient may request',
        patientName: patient.name,
        patientSlug: slug,
      });
    }
  }

  // ── Visit overdue ──────────────────────────────────────────────────────────

  if (lastNote) {
    const visitDays = daysSince(lastNote.date);
    const threshold = hasSiHistory ? 30 : 90;
    if (visitDays > threshold) {
      alerts.push({
        id: `${slug}-visit-overdue`,
        severity: hasSiHistory ? 'warning' : 'info',
        category: 'visit',
        title: `Visit overdue — last seen ${visitDays} days ago`,
        detail: `${lastNote.type} on ${lastNote.date}. Recommended interval: ${threshold} days.`,
        action: 'Schedule follow-up appointment',
        patientName: patient.name,
        patientSlug: slug,
        daysOverdue: visitDays - threshold,
      });
    }
  }

  return alerts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// ── Compute alerts for all patients ──────────────────────────────────────────

export function computeAllAlerts(patients: Record<string, Patient>): ClinicalAlert[] {
  return Object.values(patients)
    .flatMap((p) => computeAlerts(p))
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
}
