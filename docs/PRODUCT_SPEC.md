# LifeBridge Product Specification

## Document status

- Baseline: `PS-2026-07-25`
- Status: Approved Phase 0 product baseline
- Product phase: Foundation
- First product slice: `P1-S1`
- Source of roadmap truth: `docs/IMPLEMENTATION_PLAN.md`
- Screen backlog: `docs/design/SCREEN_INVENTORY.md`

This document defines what LifeBridge is intended to achieve. It does not claim that planned behavior is implemented. Planned versus actual delivery is tracked in the implementation plan and session log.

## 1. Product statement

LifeBridge is a privacy-aware family-care coordination platform. It helps a care recipient and their trusted household collaborators make work visible, assign responsibility, confirm completion, communicate important changes, and understand what still needs attention.

LifeBridge prioritizes:

1. care-recipient dignity and agency;
2. clear accountability;
3. minimum-necessary data access;
4. truthful, confirmed state;
5. accessible use under time and cognitive pressure;
6. a deterministic demonstration that does not require private credentials.

LifeBridge is a coordination product, not a clinical decision system.

### P4-S1 non-clinical medication reminder outcome

An authorized user may configure a reminder from only the medication label,
exact amount string, explicit unit, local minute, IANA time zone, numeric
offset and finite recurrence they provide. The product does not infer or
recommend dosage, treatment, diagnosis, urgency, missed-dose action or
adherence. Schedule confirmation, Notification intent, authoritative in-app
delivery, failure/missed/uncertain state and immutable acknowledgement that the
reminder was seen are separate facts. Seen never means taken or skipped.
Organizer/member status never substitutes for the care recipient's current
purpose-specific consent.

## 2. Problem and evidence posture

Care work can be distributed across relatives, paid caregivers, volunteers, and organizations. When responsibility and current state are unclear, work may be missed, duplicated, or handed off without shared context.

During Phase 0, this problem statement is a product hypothesis supported by reviewed public background sources. No numerical impact claim may be added to product copy, README, demo, or submission until it is linked to a source registered in `docs/research/DATA_SOURCE_REGISTER.md`.

Research policy:

- evidence/reference window: 2016–2026;
- priority: 2021–2026 publications or reference years;
- older sources: only still-current standards or necessary baselines with a rationale;
- required metadata: publisher, geography, year, retrieval date, URL, terms, use, limitations, sensitivity, freshness, and fixture/background class;
- fixtures: synthetic or safely de-identified only; never copied raw microdata or PII.

Research informs terminology, accessibility, scenarios, and prioritization. It must not be used to infer medical needs or rank a person's health risk.

## 3. Users and authority

| Role                     | Product need                                                           | Authority boundary                                                |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Care recipient           | See plans and work, express preferences, request help, control sharing | Owns consent choices unless a documented legal authority applies  |
| Household organizer      | Establish a household, invite collaborators, coordinate work           | Cannot bypass care-recipient consent or read unrelated households |
| Family caregiver         | Create, accept, complete, and hand off permitted work                  | Limited to household and data scopes granted to the role          |
| Household member         | See and act on assigned or shared tasks                                | Cannot access protected care/document fields without permission   |
| Volunteer                | Receive the minimum information needed for an approved request         | No general household or clinical record access                    |
| Organization coordinator | Coordinate approved referrals and volunteer capacity                   | Organization and consent scope only                               |
| Moderator                | Review community safety reports                                        | Moderation case scope only                                        |
| Administrator            | Operate policy and access controls                                     | Least privilege; privileged actions are auditable                 |

Phase 1 uses deterministic synthetic identities and one seeded household to prove coordination behavior. Fixture identity is a local demo mechanism, not production authentication and must not be exposed as a public deployment.

## 4. Core product principles

### Dignity and consent

- Describe people as participants with preferences and authority, not passive records.
- Explain what will be shared, with whom, and why before consent-sensitive actions.
- Do not reveal whether a protected resource exists to an unauthorized actor.

### Accountable state

- Every task exposes status, owner, due context, and next allowed action.
- “Saved”, “completed”, and “notified” appear only after the corresponding service confirms durable state.
- A toast is never the sole location of important information.

### Safety without medical claims

- Make configured emergency information prominent and readable.
- Never diagnose, recommend dosage/treatment, assess clinical urgency, or imply automated dispatch.
- Direct users to locally appropriate professional/emergency channels through configured, reviewed content.

### Accessible and resilient interaction

- Keyboard and screen-reader paths are first-class.
- Urgency never relies on color alone.
- Loading, empty, denied, conflict, offline, partial-failure, and recovery states are explicit.
- Mobile retains all critical capability; larger layouts improve context and density.

## 5. MVP baseline — `P1-S1`

### User-visible outcome

Within a deterministic synthetic household, an authorized caregiver can create a care task, assign it to a household member, see it on the task board/dashboard, complete it, and see a persistent notification and updated dashboard state.

### End-to-end flow

1. The caregiver opens the family dashboard or task board.
2. The caregiver enters a title, optional safe description, due date/time with time zone, priority, and assignee.
3. The UI validates input and submits one idempotent create command.
4. The gateway authenticates the synthetic fixture actor and forwards an authorized command.
5. Care Coordination stores the task and audit metadata in its own datastore;
   create/assignment emits no P1 notification.
6. Dashboard/task board reads the confirmed task.
7. The assignee completes the task with an idempotent state transition.
8. Care Coordination commits completion and an outbox event atomically.
9. The outbox dispatcher sends a versioned event with the Care-resolved
   `deliver-to-creator` or `suppress-self` disposition to Notification.
10. Notification deduplicates the event, stores one item for the distinct
    creator/coordinator (or durably suppresses self-notification), and returns a
    durable acknowledgement.
11. Dashboard and notification center show the confirmed result. Delayed notification delivery is presented separately from task completion.

### Functional requirements

| ID        | Requirement                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `MVP-001` | An authorized household actor can create a task with title, due context, priority, and one eligible assignee                       |
| `MVP-002` | Validation rejects blank/oversized input, invalid due values, and ineligible assignees without losing valid input                  |
| `MVP-003` | Task creation is idempotent and does not create duplicates after retry                                                             |
| `MVP-004` | Dashboard and task board show confirmed task status, owner, due context, priority, and next action                                 |
| `MVP-005` | Only an authorized actor can complete an open task; repeated completion is safe and produces no duplicate notification             |
| `MVP-006` | Completion and its outbox record are atomic                                                                                        |
| `MVP-007` | Notification consumes a versioned event idempotently and stores a persistent in-app item                                           |
| `MVP-008` | UI distinguishes task completion from pending/failed notification delivery                                                         |
| `MVP-009` | Create, assign, complete, denied, conflict, and delivery-failure actions produce structured, non-sensitive audit/log evidence      |
| `MVP-010` | Loading, first-use empty, validation, denied, not-found, concurrent conflict, partial service failure, and retry states are usable |
| `MVP-011` | The complete path is keyboard operable, screen-reader labeled, responsive from 320 CSS px, and does not rely on color alone        |
| `MVP-012` | Fixture mode is deterministic and contains no real person, care, medical, contact, or location data                                |

### Task lifecycle

```text
OPEN -> COMPLETED
  |        |
  |        +-> repeat completion returns the same confirmed result
  +-> update conflict returns current version and a safe recovery action
```

Cancellation, recurrence, multi-assignee work, attachments, and automatic escalation are deferred. A future lifecycle change requires a versioned contract and an accepted roadmap/ADR record.

### Acceptance criteria

`P1-S1` passes only when:

- one documented command starts the required local applications/services and deterministic fixture state;
- a synthetic authorized caregiver creates and assigns a task through the UI;
- the assignee completes the task through the UI;
- persisted task state survives a process restart;
- exactly one creator notification exists after duplicate/retried completion
  in the primary Lan-creates/Minh-completes flow; a self-completion produces a
  durable suppression result and zero notification rows;
- dashboard/task board reflect confirmed state without claiming delivery that has not happened;
- unauthorized, validation, missing-resource, concurrent-update, notification-unavailable, and recovery behavior are tested;
- API/event payloads validate against versioned schemas;
- affected lint/type checks, unit, contract, integration, browser smoke, and production builds pass;
- approved Stitch references and handoffs exist for `LB-011`, `LB-013`, `LB-014`, and the applicable `LB-019` state;
- relevant product, API, data, architecture, design, known-issue, repository-map, and session documents are current;
- no secret, PII, real care record, raw external microdata, or meaningless placeholder is tracked.

## 6. Information model for the MVP

Conceptual entities:

| Entity           | Essential fields                                                                                                                        | Owner                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Household        | stable ID, display label, status                                                                                                        | Identity/Consent context; fixture-owned in Phase 1    |
| Household member | stable ID, household ID, display label, role, active state                                                                              | Identity/Consent context; fixture-owned in Phase 1    |
| Care task        | task ID, household ID, title, safe description, assignee ID, creator ID, due timestamp/time zone, priority, status, version, timestamps | Care Coordination                                     |
| Outbox event     | event ID, aggregate/version, event type/version, safe payload, attempt state, timestamps                                                | Care Coordination                                     |
| Notification     | notification ID, recipient ID, source event ID, category, safe message key/parameters, read state, timestamps                           | Notification                                          |
| Audit evidence   | correlation ID, actor ID, action, target type/ID, result, timestamp, redacted context                                                   | Emitting service; consolidated read model is deferred |

Detailed schemas belong in `docs/DATA_MODEL.md`; API and event contracts belong in `docs/API_CONTRACTS.md`.

## 7. Quality and non-functional requirements

### Privacy and security

- Deny by default outside the current household/role/consent scope.
- Use opaque identifiers and minimize data in logs/events.
- Validate input at every trust boundary.
- Protect internal service routes; fixture identity is local demo only.
- Audit permission-, consent-, assignment-, completion-, and privileged actions.
- No secrets in Git, screenshots, Stitch prompts, logs, fixtures, or browser artifacts.

### Reliability

- Mutation endpoints accept idempotency keys.
- Versioned updates reject stale writes with a recoverable conflict.
- Cross-service effects use durable outbox/inbox semantics.
- A notification outage does not roll back a durably completed task; its delivery state remains truthful and retryable.

### Performance targets

Until measured with representative synthetic fixtures, targets are engineering budgets rather than claims:

- common local read/write interactions should provide visible feedback immediately;
- dashboard must tolerate partial notification failure without hiding task data;
- service calls, lineage, retries, and payload sizes must be bounded;
- budgets and observed results must be recorded at the relevant phase gate.

### Accessibility and localization

- Target WCAG 2.2 AA.
- Support keyboard, screen reader, zoom/reflow, reduced motion, forced colors/high contrast, touch, and long localized strings.
- User-facing strings use localization keys; Vietnamese and English are initial language targets.
- Domain terminology aligns with `docs/research/DOMAIN_GLOSSARY.vi-en.md`.

### Observability

- Propagate a correlation ID across gateway, service, outbox, and notification work.
- Structured logs record identifiers and result categories, not sensitive content.
- Health endpoints distinguish liveness and dependency readiness.
- Metrics cover command result, outbox age/retries, notification processing, and API error categories.

### P2-S1 account-access outcome

P2-S1 replaces the local fixture boundary with a first-party account scope:
registration requires password, TOTP enrollment and recovery-code
acknowledgement; sign-in requires password plus TOTP; bounded password and
factor recovery never auto-sign in. Successful proof creates an opaque,
server-revocable session. VI/EN, text scale, contrast and motion preferences
persist but never gate account access. Completing onboarding records only
non-authoritative role intent and grants no household, Care or Notification
capability; P2-S2 owns those later permissions.

Public sign-in/recovery behavior must not disclose whether an account exists.
Denied, locked, expired and offline states remain explicit without exposing
credential or account facts. The reviewed Stitch handoff, accessible production
`LB-001`–`LB-007` UI, Level C and hosted promotion evidence passed;
`MCP-DEBT-2026-002`/KI-017 is resolved. Manual assistive-technology evidence
remains deferred under KI-016 before pilot/release.

## 8. Backlog and staged scope

The 35-screen inventory is a governed backlog:

| Product stage | Primary screen groups                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Phase 1       | Dashboard, task board, task detail, relevant notification and global state patterns              |
| Phase 2       | Public access, authentication, onboarding, household, profile, consent, privacy, audit, settings |
| Phase 3       | Timeline, calendar, appointment, care plan                                                       |
| Phase 4       | Medication reminders, emergency contacts/plan, document vault                                    |
| Phase 5       | Help request, community directory, volunteer matching, organization, moderation                  |
| Phase 6       | Independently runnable services, versioned contracts, and ownership fitness                      |
| Phase 7       | Durable data changes, event recovery, backup/restore, and truthful conflict reconciliation       |
| Phase 8       | Authorization, privacy lifecycle, abuse resistance, secrets, and supply-chain hardening          |
| Phase 9       | SLOs, end-to-end telemetry, graceful degradation, incident response, and disaster recovery       |
| Phase 10      | Capacity model, load/soak evidence, scaling, latency, and cost controls                          |
| Phase 11      | Reproducible production infrastructure, staged rollout, rollback, pilot, and release             |
| Phase 12      | Post-launch operations, maintenance, feedback governance, and continuous production improvement  |

This grouping is a plan, not an implementation claim. Each screen is implemented only through its approved slice and handoff. Reordering, splitting, removing, or adding a screen follows the change-control process.

Production quality is not postponed until Phase 6. Every earlier product slice
must include the authorization, service ownership, error handling, telemetry,
data durability, accessibility, and rollback evidence applicable to its scope.
Phases 6–12 prove those properties across independently deployable boundaries
and the accepted release workload. Passing an end-to-end demo alone is never a
production-readiness claim.

### P3-S1 daily coordination outcome

An authorized household participant can review accepted task activity for one
explicit local date and record an accountable handoff of a currently assigned
open task. Access is permission-scoped through the accepted P2 consent/privacy
boundary; organizer/member status alone never grants it.

The timeline makes its IANA display zone, UTC day boundary, current filter,
snapshot and pre-coverage limitation explicit. It is chronologically stable,
bounded and exposes no total or hidden count. Handoff review names the task,
current and proposed safe actor aliases, expected version, enumerated reason
and server-effective semantics before confirmation. Success appears only from
durable Care state; notification delivery remains separate.

Denied/not-found, empty day, filter-empty, unavailable, stale continuation,
conflict, uncertain result/current-state recovery and offline read-only states
must remain truthful and non-inferential in VI/EN. Offline handoff is blocked
without queue or reconnect submission. No free-form handoff content, medical
claim, diagnosis or treatment advice is introduced.

### P3-S2 calendar and appointment outcome

An authorized household participant can create, change, and cancel a
structured appointment occurrence and see only the durable confirmed result
in `LB-015` plus the equivalent keyboard agenda and `LB-016` detail/recovery
flow. Every operation consumes a fresh permission-specific P2 governed
decision; household role never substitutes for the accepted
`household_coordination` consent and privacy boundary.

Every appointment exposes canonical UTC start/end, source local date/time,
numeric offset, validated IANA zone, duration, finite recurrence boundary,
occurrence number/count/final local date, occurrence-only mutation scope,
structured kind/logistics, optimistic version, last change, status and
reminder-intent receipt. A spring-forward gap is invalid; a fall-back overlap
requires explicit earlier/later selection and matching first-occurrence
offset. Weekly recurrence preserves wall time and materializes at most 12
concrete occurrences. Cancelled occurrences remain visible.

Conflict checks are serialized for one recipient context and use half-open
intervals with deterministic UTC/opaque-ID ordering. Stale writes preserve
unsent choices and require a fresh review; unavailable or uncertain mutations
never imply success or retry blindly. Offline changes are blocked without a
queue. Notification receives only a structured reminder schedule/cancel
intent and its durable receipt never claims delivery.

The visual calendar is an enhancement. The semantic agenda is a complete
keyboard path containing every critical appointment fact. VI/EN, visible
focus, native controls, 320 CSS px/400% reflow, forced colours, reduced
motion, denied, empty, unavailable, conflict, stale, cancelled, offline and
recovery states remain acceptance requirements.

## 9. Explicit non-goals for the initial MVP

- clinical diagnosis, treatment, dosage advice, or health-risk scoring;
- automatic emergency dispatch or surveillance;
- production medical-record integration;
- billing, insurance claims, or payments;
- generalized workflow builders;
- multi-tenancy beyond explicitly modeled household/organization scope;
- native mobile applications;
- real-time collaborative editing;
- arbitrary plugin marketplaces;
- multiple LLM providers or autonomous care decisions;
- full implementation of the 35-screen backlog;
- provisioning a separate physical database server or storage engine per service
  without evidence; logical service-owned database/schema and credential
  boundaries remain mandatory.

## 10. Success measures

MVP success is demonstrated by product behavior, not a clinical outcome claim:

- the primary synthetic flow completes without manual database edits;
- duplicated create/complete requests do not duplicate business state or notification;
- users can determine who owns a task and whether it is confirmed;
- failure states preserve valid input and offer a safe recovery;
- accessibility checks and keyboard flow pass for the implemented screens;
- fresh Windows setup and deterministic demo are reproducible;
- no secret/PII/sensitive real data is found by review and scanning.

Later outcome metrics require an ethics/privacy review, a defined collection purpose, retention rules, and an accepted ADR before telemetry is added.

## 11. Product change control

Any change to the MVP, non-goals, roles, safety boundary, screen sequencing, or acceptance criteria must:

1. receive a Change ID;
2. preserve the planned baseline;
3. state the proposed/actual behavior and evidence;
4. assess UX, consent, privacy, security, API, data, tests, delivery, and downstream phase impact;
5. define validation and follow-up;
6. update the implementation plan, workstream board, decision log when material, integration log when relevant, and session log.

Chat is not the product record. No future phase may silently redefine what an earlier phase delivered.

### P3-S3 versioned support-plan outcome

An authorized participant can maintain one shared non-clinical Support plan /
Kế hoạch hỗ trợ with bounded structured goals, preferences, responsibilities,
and a local review date. Working draft, current confirmed version, immutable
history, responsible party, change summary, review state, and recovery are
distinct. Every request uses fresh P2 consent authority; membership or
organizer status is insufficient. Concurrent edits use optimistic revisions
and idempotency. The product never diagnoses, recommends treatment, queues an
offline mutation, claims reminder delivery, exposes hidden history totals, or
persists sensitive plan content in browser storage.

### P4-S2 emergency-readiness outcome

An authorized participant can configure one complete ordered list of
non-clinical emergency contacts, maintain bounded participant-entered plan
steps, and explicitly review an immutable current version. Contact changes
make the current plan require a new review. Every online read or action uses a
fresh exact-purpose P2 authority decision; household role, possession of a
copy, or a prior decision is insufficient.

The current online view and the encrypted offline copy are visibly different
sources. The offline copy contains only reviewed steps, contact order/label/
dial facts and source/version/confirmation/display-time facts. It is recent
for at most 24 hours, stale and prominently warned through 72 hours, then
hidden and purged. It never claims current permission, current server state,
contact availability, legal/professional status, diagnosis, treatment,
urgency ranking, a placed call or automated dispatch. Offline writes are
blocked and never queued.

### P4-S3 document-vault outcome

At LB-023, an authorized person can choose one synthetic UTF-8 `.txt` file,
review its exact size/access/retention effect, upload it with real transport
progress, list authoritative processing truth, download it only as an
attachment, and delete its active copy. The native file picker is the complete
keyboard path; drag/drop is optional.

The page always explains that every action checks current document-specific
permission, household role alone grants nothing, the file is retained until
explicit deletion, deletion has no LifeBridge undo, and recovery requires the
user's local original. A successful upload is `ready_unscanned`: the scanner
is not configured and malware was not scanned. The product never says clean,
safe, reviewed or clinically valid and never previews or executes content.

Denied/missing, invalid selection, upload/cancel, processing, rejected/failed/
integrity failure, scanner/storage unavailable, conflict, offline/no queue,
uncertain result/reconciliation, deletion review/confirmation and recovery are
truthful VI/EN states. Status does not rely on color, progress is announced,
focus is preserved, and no protected metadata or bytes persist offline.

### P5-S1 consented help-request and community-directory outcome

At LB-022, the self-established care recipient or an account with a current
exact `community_support` grant can submit one bounded Community request after
reviewing purpose, minimum fields, visibility, retention/deletion and the
explicit no-match/no-outcome limitation. Household organizer/member status is
not consent or subject authority. Every list, submit, reconcile, close and
delete operation obtains a fresh request-bound Identity decision.

The form accepts only one bounded support category, province/city, optional
broad day part and explicit unselected disclosure confirmation. It accepts no
free-form narrative, diagnosis, treatment, medication, urgency, eligibility
reason, exact time/address/GPS, file, organization or match preference.
`submitted` means Community confirmed the command. `pending` means only that
Community durably owns an open request; it never means reviewed, queued for
matching, matched, accepted, available, safe, eligible, delivered or
completed. Matching is unavailable in P5-S1.

Draft/validation, authority denied or revoked, exact duplicate, optimistic
conflict, uncertain result plus fresh reconciliation, pending, closed,
deleted, Community unavailable and offline-blocked/no-queue states remain
truthful in VI/EN. Protected request fields do not enter URLs, browser storage,
telemetry or the public directory cache.

At LB-024, any public or authenticated user can filter reviewed public support
listings by bounded category, province/city and organization type without an
Identity call or household/request disclosure. Each listing shows only public
organization metadata, service area/category/contact, provenance source and
review time, with explicit stale, availability-not-verified,
eligibility-not-determined and no-endorsement truth. Location denial leaves
manual province/city selection available. No results, stale/offline cache,
search unavailable and Community unavailable are distinct. The page never
infers need, eligibility, safety, recommendation, match, response, delivery or
outcome.

The native screens follow the Frozen corrected P5-S1 Stitch handoff, not
generated source. Automated desktop/mobile keyboard, focus, reflow, axe,
forced-colors and reduced-motion proof is candidate evidence only; KI-016 and
KI-019 remain. Exactly one local Level C and hosted promotion remain before
the slice is accepted.
