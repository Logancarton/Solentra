# Solentra — Full Feature Roadmap & Build Steps

## Phase 1 — Foundation (In Progress)
Getting the base platform running locally and on GitHub.

- [x] Install Medplum codebase as foundation
- [x] Install Node.js
- [x] Install PostgreSQL
- [x] Install Redis (Memurai/Valkey)
- [x] Get server running locally at localhost:8103
- [x] Get frontend running locally at localhost:3000
- [ ] Push codebase to GitHub (private repo)
- [ ] Create a one-click startup script for daily use
- [ ] Replace Medplum branding with Solentra branding (logo, name, colors)

---

## Phase 2 — Core Clinical UI
Build the provider-facing EHR interface (replacing raw Medplum admin views).

- [ ] Provider dashboard — today's schedule as landing page
- [ ] Patient chart view — clean single-screen layout (notes, meds, labs, assessments)
- [ ] Role-based views:
  - [ ] Provider view
  - [ ] Front desk view (check-in, billing focus)
  - [ ] Admin view
- [ ] Integrated calendar / scheduling module
- [ ] Practice website with embedded patient portal and calendar (public-facing)
- [ ] Patient registration / intake form (clean, not raw FHIR form)

---

## Phase 3 — AI Visit Assistant (Core Differentiator)
The feature that sets Solentra apart from every other EHR.

- [ ] Ambient scribe — continuous audio capture (phone or desktop)
- [ ] Voice command recognition ("new patient", "pull up Joe's note", etc.)
- [ ] Patient separation — split full day recording into per-patient visits
  - [ ] Voice trigger ("new patient")
  - [ ] Button tap
  - [ ] Both (provider chooses)
- [ ] Right panel — AI-populated on command or auto:
  - [ ] Previous visit note
  - [ ] Recent labs
  - [ ] Current medications + last prescribed date
  - [ ] Visit template (auto-suggested, toggleable on/off per provider)
  - [ ] Key areas to cover today (from last note + chief complaint)
- [ ] Live checklist — bottom of screen:
  - [ ] AI generates key topics based on patient history + appointment type
  - [ ] Auto-checks items as discussed in conversation
  - [ ] Visual indicator of what's covered vs. remaining
- [ ] Morning briefing:
  - [ ] Schedule for the day
  - [ ] Incomplete tasks across all patients
  - [ ] Reminders for upcoming patients
  - [ ] Flags from previous visits

---

## Phase 4 — Provider-Configurable Flags & Clinical Triggers
Intelligent safety net and clinical prompting system.

- [ ] Per-provider, per-patient configurable flags ("pet peeves")
  - [ ] Examples: "SI not discussed today — flag", "BP not checked", etc.
  - [ ] Each flag individually toggleable
- [ ] Keyword-triggered assessments:
  - [ ] C-SSRS → suicidal ideation keywords
  - [ ] PHQ-9 → depression keywords
  - [ ] GAD-7 → anxiety keywords
  - [ ] ASRS-v1 → ADHD keywords
  - [ ] High BP → detailed follow-up prompts
  - [ ] Facial droop → stroke protocol
  - [ ] A/V/H → detailed psychosis assessment prompts
  - [ ] Each trigger individually toggleable per provider
- [ ] Serious topic detection → detailed question prompts to hone in on clinical details

---

## Phase 5 — Patient-Facing Features & Portal
Engage patients between visits and automate outreach.

- [ ] Patient portal (web)
- [ ] Daily check-in prompts (PHQ-9, GAD-7, mood tracking)
- [ ] Questionnaire sending via voice command:
  - [ ] "Solentra, send [patient] an ASRS-v1"
  - [ ] AI confirms patient identity before sending
  - [ ] Tracks questionnaire completion
- [ ] Automated alerts:
  - [ ] "Send me a prompt if any patient marks positive SI in daily check-in"
  - [ ] Immediate provider notification
- [ ] Automated motivational messages:
  - [ ] "When Sheela meets her weekly goal, send her a Good Job message"
  - [ ] Provider configures triggers and messages
- [ ] Secure patient-to-provider messaging (HIPAA compliant)
  - [ ] Routes to correct provider
  - [ ] Provider responds via app or desktop

---

## Phase 6 — Analytics & Trending
Visual clinical data across time.

- [ ] PHQ-9 trend graph across visits ("show me PHQ-9 trend over last 10 weeks")
- [ ] GAD-7 trend graph
- [ ] Medication history timeline
- [ ] CBT homework tracking and follow-up
- [ ] Outstanding items tracker across all patients
- [ ] Voice query for reports ("Solentra, show me...")

---

## Phase 7 — Care Team Coordination & Internal Messaging
Replace unsafe texts and sticky notes with HIPAA-compliant communication.

- [ ] Internal provider-to-provider messaging
- [ ] Chart-attached messages (visible when chart is opened)
  - [ ] "Send Joe Smith a note that Valorie just lost her job"
  - [ ] Shows as banner/flag when Joe opens Valorie's chart
  - [ ] Auto-archives to chart as care coordination note
- [ ] Actionable task assignments with due dates
  - [ ] "Send Jane Blair that Selena's BP is high, ask her to follow up"
  - [ ] Jane receives task, not just a message
  - [ ] Completion tracking — did they follow up?
  - [ ] Auto-reminder if not completed by due date
- [ ] Cross-discipline handoffs (NP → MD → therapist → front desk)
- [ ] Full audit trail for HIPAA compliance

---

## Phase 8 — Billing Module
Replace Tebra and cut clearinghouse markup.

- [ ] Insurance card + license OCR (photo intake)
- [ ] Insurance eligibility API integration (Availity or Waystar)
- [ ] Real-time copay / deductible / coinsurance calculation
- [ ] CPT code memory per payer per provider per service
- [ ] Front desk expected collection display before patient checks in
- [ ] Direct clearinghouse connection (Waystar ~$0.25-0.50/claim)
- [ ] Claims submission and tracking
- [ ] ERA (remittance) processing
- [ ] Denied claim management

---

## Phase 9 — Medication Management & Integrations
Leverage what's already in the Medplum codebase.

- [ ] E-prescribing via DoseSpot (already in codebase — needs configuration)
- [ ] Medication history + last prescribed date display
- [ ] Refill request workflow
- [ ] Lab orders via Health Gorilla (already in codebase — needs configuration)
  - [ ] Sonora Quest
  - [ ] LabCorp
- [ ] Lab results display + trending
- [ ] Pharmacy integration

---

## Phase 10 — Mobile App
Provider and patient mobile experience.

- [ ] Provider app:
  - [ ] Ambient scribe (primary use case — phone on desk all day)
  - [ ] Morning briefing
  - [ ] Patient chart access
  - [ ] Internal messaging
  - [ ] Syncs live to desktop (desktop optional)
- [ ] Patient app:
  - [ ] Daily check-ins (PHQ-9, GAD-7, mood)
  - [ ] Questionnaires
  - [ ] Secure messaging
  - [ ] Therapy quotes and ideas
  - [ ] Goal tracking + motivational messages
  - [ ] Appointment reminders

---

## Phase 11 — Practice Website Builder
Public-facing web presence integrated with Solentra.

- [ ] Practice website builder (customizable)
- [ ] Embedded online scheduling / calendar
- [ ] Patient portal login from website
- [ ] Insurance accepted list
- [ ] Provider bios
- [ ] Contact / intake forms that feed directly into Solentra

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Backend | Medplum server (Node.js, FHIR) |
| Database | PostgreSQL |
| Cache | Redis (Memurai/Valkey on Windows) |
| Frontend | React (Medplum app, customized) |
| AI Intelligence | Claude API (Anthropic) |
| Speech-to-Text | OpenAI Whisper or AWS Transcribe |
| E-Prescribing | DoseSpot (already in codebase) |
| Lab Integration | Health Gorilla (already in codebase) |
| Clearinghouse | Waystar or Availity API |
| Mobile | React Native (iOS + Android) |
| Cloud Hosting | AWS |
| Infrastructure | Terraform + Docker (already in codebase) |

---

## Estimated Monthly Running Costs (Small Practice, Live)

| Service | Est. Cost/mo |
|---|---|
| AWS hosting | $50–150 |
| Claude API | $20–100 |
| OpenAI Whisper | $10–50 |
| DoseSpot | $100–200 |
| Health Gorilla | $100–300 |
| Clearinghouse (320 claims/mo) | $80–160 |
| **Total** | **$360–960/mo** |

Replaces: Tebra ($300/mo) + Heidi ($700/yr) — breaks even immediately, generates revenue when licensed to other providers.
