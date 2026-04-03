# Solentra — GitHub Copilot Instructions

## Project
Solentra is an AI-first EHR built on Medplum v5.1.6 (FHIR, React, TypeScript, Mantine v8).
Owner: Logan Carton, Psychiatric NP. Built for a real clinical practice — HIPAA applies.

## Key Files
- `packages/app/src/solentra/ProviderDashboard.tsx` — main dashboard (floating windows via react-rnd)
- `packages/app/src/solentra/PatientChart.tsx` — patient chart with tabs (Overview, Notes, Meds, Labs, Assessments, History, Prior Auth, Billing)
- `packages/app/src/solentra/VisitNote.tsx` — visit note writer with MSE quick-click
- `packages/app/src/solentra/clinicalAlerts.ts` — BPA-style clinical alerts engine
- `packages/app/src/solentra/dashboardData.ts` — FHIR dashboard data hook with demo fallback
- `packages/app/src/solentra/patientData.ts` — FHIR patient record hook
- `packages/app/src/AppRoutes.tsx` — app routes

## Coding Rules

### No Bloat
- Never create a new file if an existing file is the right place.
- When replacing code, delete the old code entirely. Do not leave it as dead code.
- Do not duplicate types or data across files.
- No single-use abstractions or passthrough wrappers.

### Code Style
- TypeScript strict — no `any`.
- Mantine v8 components only for UI.
- @tabler/icons-react only for icons.
- No comments on unchanged code.
- No speculative features — only what was explicitly requested.

### FHIR / Medplum
- Use `useSearchResources` and `useSearchOne` from `@medplum/react`.
- Always maintain demo data fallback — app must work without a live server.
- Patient data flows through `useLivePatientRecord()` in `patientData.ts`.
- Dashboard data flows through `useSolentraDashboardData()` in `dashboardData.ts`.

### Git
- No commits with TypeScript errors.
- No .env or secrets in commits.
