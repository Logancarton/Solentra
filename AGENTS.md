# Solentra — Agent Instructions
# Read by: OpenAI Codex, Devin, and other AI coding agents

## Project
Solentra is an AI-first EHR built on Medplum v5.1.6 (FHIR-compliant).
Stack: React, TypeScript, Mantine v8, react-rnd, @tabler/icons-react.
Owner: Logan Carton, Psychiatric NP. Real clinical practice — HIPAA compliance required.

## Repo Structure
```
packages/
  app/
    src/
      solentra/           ← All Solentra-specific code lives here
        ProviderDashboard.tsx   — floating-window dashboard
        PatientChart.tsx        — full patient chart with tabs
        VisitNote.tsx           — visit note writer
        clinicalAlerts.ts       — BPA rules engine
        dashboardData.ts        — FHIR dashboard data hook
        patientData.ts          — FHIR patient record hook
      AppRoutes.tsx             — route definitions
  server/                 ← Medplum backend (do not modify unless instructed)
  react/                  ← Medplum React components (do not modify unless instructed)
```

## Before You Start
1. Run `npx tsc --noEmit -p packages/app/tsconfig.json` — know the baseline error state.
2. Read the relevant existing files before writing any code. Understand what's already there.
3. Never assume a file needs to be created — check if the right file already exists.

## Coding Rules

### No Bloat — The Most Important Rule
- **Never create a new file if an existing file is the right place for the code.**
  - Adding a new tab to PatientChart? Edit `PatientChart.tsx`.
  - Adding a new dashboard panel? Edit `ProviderDashboard.tsx`.
  - Adding a new alert rule? Edit `clinicalAlerts.ts`.
  - Only create a new file for a genuinely new concern (new page, new independent hook, new data layer).
- **When replacing or changing a feature, delete the old code.** Do not leave old implementations, old types, old constants, or old mock data sitting unused. Remove them entirely.
- **Never stack new code below old code to override it.** Find the old code, replace it in place, delete what's no longer needed.
- **No duplicate type definitions.** If a type already exists in one file, import it — don't redefine it.
- **No single-use helpers or abstractions.** Three similar lines of code is better than a premature abstraction.

### TypeScript
- Strict mode — no `any`, no `@ts-ignore` without explanation.
- All errors must be resolved before committing.
- Run `npx tsc --noEmit -p packages/app/tsconfig.json` to verify.

### React / UI
- Mantine v8 for all UI components — no other UI libraries.
- @tabler/icons-react for all icons — no other icon libraries.
- react-router v6 for routing.
- No inline styles when a Mantine prop exists. No new CSS files unless adding to an existing `.module.css`.

### FHIR / Data
- Use Medplum hooks: `useSearchResources`, `useSearchOne` from `@medplum/react`.
- All dashboard data flows through `useSolentraDashboardData()` in `dashboardData.ts`.
- All patient chart data flows through `useLivePatientRecord()` in `patientData.ts`.
- **Always maintain the demo data fallback.** The app must work without a live Medplum server. When live FHIR data is unavailable, fall back to the demo constants already defined in `dashboardData.ts`.

### Security
- No secrets, API keys, or .env values in code.
- No patient data logged to console.
- All FHIR queries scoped to authenticated user's context.

## On Completion
1. Run `npx tsc --noEmit -p packages/app/tsconfig.json` — fix all errors.
2. Stage only relevant files — never `git add -A` blindly.
3. Commit with a meaningful message describing what changed and why.
4. Push to `origin main`.
5. Update `C:\Users\Logan\.claude\projects\C--Users-Logan-Solentra\memory\project_build_progress.md` — mark completed items, note what was done.
