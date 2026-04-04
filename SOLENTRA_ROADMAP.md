# Solentra - Product Roadmap

## Current Snapshot - 2026-04-03
Solentra is in Phase 1. The working product is now a provider dashboard, patient chart, and visit-note flow on top of Medplum with demo fallback.

### Built now
- Dashboard shell with schedule, inbox, care gaps, billing, prior auth, and AI panels
- Patient chart with overview, notes, medications, labs, assessments, history, prior auth, and billing tabs
- Visit note flow that creates and updates `Composition` resources tied to an `Encounter`
- Draft-resume behavior for today's unsigned note
- PHQ-9 / GAD-7 score persistence as `Observation`
- Assessment send actions backed by `Task`
- Claim creation on sign
- Storyboard-style chart sidebar, structured history tab, live vitals, and next-appointment support

### Immediate priorities
1. Make visit signing idempotent so repeated sign actions do not create duplicate `Observation` or `Claim` resources
2. Convert patient-data ordering to raw timestamps instead of formatted date strings
3. Finish wiring live chart/dashboard data before pushing deeper into AI behavior
4. Tighten empty states and workflow polish so sparse live data still feels intentional

### Not building yet
- Ambient scribe
- In-visit AI prompting
- Autonomous AI chart actions
- Phase 5 assistant behavior beyond passive shell/prototype UI

---

## Phase 1 - EHR Functional
Finish line: run a real clinical week without opening Tebra.

### Completed or mostly working
- [x] Medplum-based Solentra app shell running locally
- [x] GitHub repo pushed and active
- [x] Local startup script
- [x] Provider dashboard route and patient chart route
- [x] Draft/final note persistence with `Composition` + `Encounter`
- [x] PHQ-9 / GAD-7 trend data sourced from `Observation`
- [x] Assessment sending workflow using `Task`
- [x] Basic claim creation from signed note

### Still needed
- [ ] Idempotent note signing and claim generation
- [ ] Deterministic timestamp-based ordering in patient-data aggregation
- [ ] Live schedule/inbox behavior polished enough for day-to-day use
- [ ] DoseSpot wired for real prescribing
- [ ] Billing export path (`Claim/$export` or equivalent workflow)
- [ ] Remaining structured history / med-trial live mapping
- [ ] Full branding cleanup across app shell and docs

---

## Phase 2 - Workflow Polish
Finish line: less annoying than Tebra.

- [ ] Faster patient lookup and chart navigation
- [ ] Cleaner empty states for schedule, inbox, and dashboard panes
- [ ] Better shortcut flows for refills, screenings, and follow-up scheduling
- [ ] Template cleanup and favorite actions
- [ ] Instrumentation for note-close time, refill turnaround, assessment completion, and billing failures

---

## Phase 3 - Scribe Foundation
Finish line: audio in, usable draft out.

- [ ] Transcript capture and storage
- [ ] Diarization and patient/visit separation
- [ ] Structured draft note output mapped to Solentra note sections
- [ ] Missing-data honesty and confidence handling
- [ ] Transcript kept separate from editable note draft

---

## Phase 4 - Scribe + EHR Integration
Finish line: scribe saves time without creating trust problems.

- [ ] Pipe draft content into `VisitNote` as review-required sections
- [ ] Provenance labels for copied-forward, clinician-entered, and generated text
- [ ] Tie scribe draft strictly to active `Encounter`
- [ ] Accept/reject or diff-style review workflow

---

## Phase 5 - Interactive AI Assistant
Finish line: feels like a sharp clinical assistant, not an unsupervised intern.

### Build order
1. Chart Q&A
2. Note-start and note-draft commands
3. Missing-topic detection
4. In-visit prompting with visible evidence
5. Optional side-panel suggestions

### Guardrails
- [ ] Read-heavy, write-light behavior
- [ ] Transparent reasoning with chart evidence
- [ ] Narrow, defensible prompt categories
- [ ] No autonomous actions

---

## Phase 6 - Patient Portal and Outreach
- [ ] Patient portal
- [ ] Questionnaire delivery and completion tracking
- [ ] Secure messaging
- [ ] Automated outreach and check-ins
- [ ] Daily symptom monitoring

---

## Phase 7 - Billing and Revenue Operations
- [ ] Insurance and ID intake OCR
- [ ] Eligibility checks
- [ ] Expected patient-responsibility estimates
- [ ] Claim tracking, denials, and remittance workflows
- [ ] Front-desk collection support

---

## Phase 8 - Medications and External Integrations
- [ ] DoseSpot prescribing
- [ ] Refill workflow
- [ ] Health Gorilla / lab ordering integration
- [ ] Sonora Quest / LabCorp result ingestion
- [ ] Pharmacy connectivity

---

## Phase 9 - Mobile and Web Presence
- [ ] Provider mobile app
- [ ] Patient mobile app
- [ ] Practice website builder
- [ ] Portal login and scheduling from public website

---

## Canonical FHIR Resource Map
| Concern | FHIR Resource |
|---|---|
| Scheduled slot | `Appointment` |
| Actual visit | `Encounter` |
| Clinical note | `Composition` |
| Patient assessments | `Questionnaire` / `QuestionnaireResponse` |
| Extracted scores | `Observation` |
| Workflow tracking | `Task` |
| Billing output | `Claim` / `ChargeItem` |
| Medications | `MedicationRequest` |
| Labs | `DiagnosticReport` / `Observation` |

Key rule: `Appointment` is the scheduled slot. `Encounter` is the visit anchor. Notes, billing, and orders attach to `Encounter`.
