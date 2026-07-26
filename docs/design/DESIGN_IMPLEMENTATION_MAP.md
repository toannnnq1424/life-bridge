# LifeBridge Design-to-Implementation Map

## Purpose

This register converts approved design intent into production contracts and implementation work. It does not authorize frontend implementation by itself.

Stitch output is untrusted reference material only. Generated HTML, CSS, scripts, dependencies, tracking, placeholders, assets, or components must not enter production without review and conversion to project-native contracts.

P2-S1 uses the Frozen redacted handoff
`docs/design/reviews/P2_S1_STITCH_HANDOFF.md`. Its seven aliases map to native
Next.js routes and `AccountAccessApp`; no generated source, runtime, asset URL
or private locator was imported.

## Source precedence

```text
Git repository
→ design system
→ component contracts
→ application source code
→ automated tests
```

Accessibility, security, privacy, localization, resilience, authorization, consent, and service contracts take precedence over visual similarity. Record accepted design divergence in the screen handoff.

`TBD` means blocked pending repository-backed architecture evidence. It does not permit the frontend to invent routes, APIs, permissions, persistence, offline queues, audit behavior, or clinical logic.

## Implementation readiness gates

A screen may enter implementation only when all applicable evidence exists:

1. Product requirement and accountable owner.
2. Actor, role, route, entry, exit, alternate, and cancellation paths.
3. Authorization, consent, minimum-disclosure, and audit rules.
4. Frozen responsive design baseline.
5. Semantic structure and component contracts.
6. API request, response, validation, failure, conflict, idempotency, and offline contracts.
7. Loading, empty, error, denied, stale, queued, blocked, rejected, conflicted, confirmed, and applicable emergency states.
8. Localization keys and formatting rules.
9. Accessibility behavior and review evidence.
10. Synthetic fixtures.
11. Artifact provenance and secret review.
12. Product, design, accessibility, privacy, security, and implementation approvals.

A deliberately fixture-only implementation boundary must be explicit. It must never represent mocked authorization, persistence, clinical, emergency, or audit behavior as production behavior.

## Implementation layers

| Layer             | Contract                                                                                                                      | Initial posture                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Application shell | Skip link, landmarks, route title, navigation, role context, connectivity, emergency entry, route focus                       | `TBD` production path                                  |
| Design tokens     | Color, type, spacing, radius, elevation, motion, layout, focus, semantic state, contrast                                      | Project-native CSS variables or approved equivalent    |
| Native primitives | Link, button, input, textarea, select, checkbox, radio, fieldset, details, table, dialog, status                              | Native HTML first                                      |
| Layout primitives | Container, stack, cluster, grid, page header, section, responsive composition                                                 | CSS-first; source order matches reading order          |
| Feedback patterns | Loading, empty, error, denied, offline, stale, queue, conflict, confirmation                                                  | Truthful service-backed state only                     |
| Domain components | Household, care, task, calendar, reminder, emergency, consent, document, matching, moderation                                 | After screen freeze and architecture approval          |
| Data boundary     | Typed service adapters, authorization/consent state, fixture factories                                                        | `TBD`; no invented endpoint names                      |
| Test evidence     | Contract, semantic, interaction, keyboard, route/state, visual, responsive, accessibility, manual assistive-technology review | Write during implementation; run consolidated campaign |

## Shared production contracts

Component names below are provisional identifiers, not mandatory abstractions. Prefer native markup and existing project components. Create a reusable component only for repeated approved semantic behavior or one independently testable complex control.

| Contract family         | Responsibility                                                                              | Prohibited behavior                                 | Production target |
| ----------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------- |
| Application shell       | Skip link, landmarks, route title, navigation, role and connectivity context                | Hidden critical navigation; obscured focus          | `TBD`             |
| Route focus             | Main-heading focus after meaningful navigation; safe retention for in-place updates         | Unexpected focus movement                           | `TBD`             |
| Authorization boundary  | Server-enforced role/resource authorization and non-disclosing denied state                 | Revealing protected resource existence              | `TBD`             |
| Consent boundary        | Server-backed consent scope, audience, purpose, duration, and effective timing              | Local UI consent inference                          | `TBD`             |
| Status presentation     | Loading, stale, queued, blocked, rejected, conflict, failed, confirmed, urgent state        | Color-only meaning; false persistence               | `TBD`             |
| Form field              | Visible label, hint, units, required/invalid state, error relationship, retained safe value | Placeholder-only labels; sensitive-value disclosure | `TBD`             |
| Error summary           | Persistent linked errors and safe focus behavior                                            | Implementation-detail or protected-data leakage     | `TBD`             |
| Confirmation            | Target, consequence, safe cancel, duplicate-submission prevention                           | Preselected destructive or consent action           | `TBD`             |
| Dialog or sheet         | Label, initial focus, containment, scrolling, dismissal, restoration                        | Focus traps or obscured controls                    | `TBD`             |
| Offline and queue state | Connectivity, freshness, last sync, retry, blocked/queued/conflict state                    | Queued work represented as complete                 | `TBD`             |
| Date and time           | Locale, semantic time, source time zone, recurrence                                         | Hidden time zone or inferred urgency                | `TBD`             |
| Responsive data view    | Semantic table/list relationships, sort/filter state, accessible alternative                | Layout-only tables; inaccessible virtualization     | `TBD`             |
| Upload control          | File picker, constraints, progress, processing, access, retention, recovery                 | Mandatory drag-and-drop                             | `TBD`             |
| Audit record            | Redacted actor, action, time, result, and retention context                                 | Duplicating protected values                        | `TBD`             |
| Localization            | Keys, pluralization, dates, time zones, units, long strings, bidirectional behavior         | Hardcoded Stitch copy; concatenated sentences       | `TBD`             |
| Synthetic fixtures      | Users, households, care records, roles, permissions, failures, state transitions            | Real personal or credential data                    | `TBD`             |

## Feature implementation sequence

| Order | Feature                                                   | Preconditions                                                   | Production gate                                                                               |
| ----- | --------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1     | Tokens, shell, semantic primitives, global state patterns | Design system, responsive, and accessibility contracts approved | App architecture and route contracts approved                                                 |
| 2     | Access and onboarding                                     | F-01 and F-02 handoffs frozen                                   | Authentication, MFA, recovery, invitation contracts approved                                  |
| 3     | Household, profile, and consent                           | Access foundation complete                                      | Authorization, consent, audit, and conflict contracts approved                                |
| 4     | Daily coordination                                        | Household context approved                                      | Task, timeline, assignment, sync, and conflict contracts approved                             |
| 5     | Calendar, care plan, medication, notifications            | Coordination patterns approved                                  | Time-zone, recurrence, notification, and non-clinical boundary approved                       |
| 6     | Emergency readiness                                       | Consent and offline policy approved                             | Emergency-plan, contact, cache, and freshness contracts approved                              |
| 7     | Documents, privacy, audit, and settings                   | Consent policy approved                                         | Upload, retention, export, deletion, and audit contracts approved                             |
| 8     | Community, matching, organization, moderation             | Minimum-disclosure policy approved                              | Eligibility, disclosure, organization, and moderation contracts approved                      |
| 9     | Consolidated frontend campaign                            | Feature source and tests complete                               | Automated, manual, visual, responsive, security, privacy, and accessibility evidence complete |

## Screen map

| ID       | Screen                       | Flow                | Route concept                        | Required production composition                             | API or service dependency            | Permission and consent boundary                  |
| -------- | ---------------------------- | ------------------- | ------------------------------------ | ----------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `LB-001` | Landing page                 | F-01                | `/`                                  | Public shell, content sections, safe fallback               | Static public shell; no private API  | Public; no private data                          |
| `LB-002` | Login                        | F-01                | `/login`                             | Auth form, error summary, password-manager support          | P2 account sessions/factor API       | Anonymous; non-enumerating                       |
| `LB-003` | Registration                 | F-01                | `/register`                          | Account form, terms and consent disclosure                  | P2 registrations/factor/recovery ack | Anonymous; minimum account data                  |
| `LB-004` | MFA                          | F-01                | `/mfa`                               | Code input, recovery transition, expired/locked states      | P2 challenge-scoped factor APIs      | Challenge-scoped; non-enumerating                |
| `LB-005` | Account recovery             | F-01                | `/recover`                           | Generic recovery, password/factor paths, safe transition    | P2 password and factor recovery APIs | Anonymous; artifacts never exposed in logs       |
| `LB-006` | Onboarding                   | F-01/F-02           | `/onboarding`                        | Progress and non-authoritative role intent                  | P2 account-only session/onboarding   | Authenticated account scope; no household grant  |
| `LB-007` | Accessibility onboarding     | F-02/F-09           | `/onboarding/accessibility`          | Optional preference form, preview, reset                    | P2 versioned preferences API         | Account owner; never an access gate              |
| `LB-008` | Household creation           | F-02                | `/households/new`                    | Household form, ownership and responsibility disclosure     | `TBD: households`                    | Eligible organizer; explicit ownership           |
| `LB-009` | Household invitation         | F-02                | `/households/:id/invitations`        | Invite, accept, revoke, expired, and denied states          | `TBD: invitations`                   | Role-scoped; no household leakage                |
| `LB-010` | Care recipient profile       | F-02/F-05/F-09      | `/households/:id/people/:personId`   | Profile sections, redaction, edit, conflict                 | `TBD: profiles and consent`          | Household role plus consent                      |
| `LB-011` | Family dashboard             | F-02/F-03/F-04/F-06 | `/households/:id`                    | Priority dashboard, urgent state, partial failure           | `TBD: household aggregation`         | Household role plus scoped consent               |
| `LB-012` | Daily care timeline          | F-03/F-04           | `/households/:id/timeline`           | Semantic timeline, date and filter controls                 | `TBD: care events`                   | Household role plus scoped consent               |
| `LB-013` | Task board                   | F-03                | `/households/:id/tasks`              | List-first board, filters, complete non-drag actions        | `TBD: tasks`                         | Assignment and action-specific role              |
| `LB-014` | Task detail                  | F-03                | `/tasks/:taskId`                     | Task editor, ownership, handoff, conflict resolution        | `TBD: tasks`                         | Resource and action scoped                       |
| `LB-015` | Calendar                     | F-04                | `/households/:id/calendar`           | Complete agenda plus optional keyboard calendar             | `TBD: calendar`                      | Household role plus scoped consent               |
| `LB-016` | Appointment detail           | F-04                | `/appointments/:appointmentId`       | Logistics, reminders, cancel confirmation                   | `TBD: appointments`                  | Resource and action scoped                       |
| `LB-017` | Care plan                    | F-05                | `/households/:id/care-plan`          | Versioned plan, goals, review, conflict                     | `TBD: care plan`                     | Authorized role plus consent                     |
| `LB-018` | Medication reminder schedule | F-05                | `/households/:id/medications`        | User-supplied schedule, recurrence, reminder states         | `TBD: reminders`                     | Authorized role plus consent; no clinical advice |
| `LB-019` | Notification center          | F-03/F-04/F-05      | `/notifications`                     | Notification list, filters, preferences, delivery states    | `TBD: notifications`                 | Account and resource scoped                      |
| `LB-020` | Emergency contact list       | F-06                | `/households/:id/emergency-contacts` | Ordered contacts, freshness, destructive confirmation       | `TBD: emergency contacts`            | Authorized role plus consent                     |
| `LB-021` | Emergency plan               | F-06                | `/households/:id/emergency-plan`     | Approved plan, stale/offline labels, configured contacts    | `TBD: emergency plan and cache`      | Authorized role plus consent                     |
| `LB-022` | Help request                 | F-07                | `/help/new`                          | Visibility preview, consent, request lifecycle              | `TBD: help requests`                 | Requester; explicit disclosure consent           |
| `LB-023` | Document vault               | F-08                | `/households/:id/documents`          | File picker, upload progress, processing, access, deletion  | `TBD: document storage and scanning` | Document and action scoped                       |
| `LB-024` | Community directory          | F-07                | `/community`                         | Search, filters, minimum-data listings                      | `TBD: directory`                     | Public or account-scoped listing                 |
| `LB-025` | Volunteer matching           | F-07/F-10           | `/matching`                          | Match queue/detail and consented disclosure                 | `TBD: matching`                      | Approved volunteer or coordinator scope          |
| `LB-026` | Organization dashboard       | F-07/F-10           | `/organization`                      | Scoped queue, capacity, partial errors                      | `TBD: organization aggregation`      | Organization membership and role                 |
| `LB-027` | Admin moderation             | F-10                | `/admin/moderation`                  | Report queue, rationale, confirmation, safe successor focus | `TBD: moderation`                    | Moderator/admin; minimum disclosure              |
| `LB-028` | Consent management           | F-02/F-09           | `/households/:id/consent`            | Grant, narrow, revoke, effect review, conflict              | `TBD: consent policy`                | Care recipient or delegated authority            |
| `LB-029` | Privacy controls             | F-09                | `/settings/privacy`                  | Privacy settings, export and deletion requests              | `TBD: privacy and export`            | Account owner; section-specific scope            |
| `LB-030` | Audit history                | F-09/F-10           | `/households/:id/audit`              | Redacted audit list/table, filters, retention               | `TBD: audit`                         | Explicit audit permission                        |
| `LB-031` | Settings                     | F-09                | `/settings`                          | Grouped settings, partial save, sign-out                    | `TBD: account settings`              | Account owner plus scoped household settings     |
| `LB-032` | Offline state                | Global              | Route-preserving                     | Connectivity, freshness, queue, conflict, recovery          | `TBD: sync and cache policy`         | Inherits originating route                       |
| `LB-033` | Empty-state pattern          | Global              | Route-preserving                     | Cause and one permitted next action                         | Originating service                  | Inherits originating route                       |
| `LB-034` | Error-state pattern          | Global              | Route-preserving                     | Error scope, retained data, safe recovery                   | Originating service                  | Inherits originating route                       |
| `LB-035` | Loading-state pattern        | Global              | Route-preserving                     | Scoped progress and truthful structure                      | Originating service                  | Inherits originating route                       |

## Component specification contract

Each approved component specification records:

```text
Component:
Purpose:
Consumers:
Native semantic basis:
Inputs:
Outputs and events:
Accessible name and description:
States:
Keyboard behavior:
Focus behavior:
Responsive behavior:
Localization behavior:
Permission and consent assumptions:
Error and persistence semantics:
Data classification:
Synthetic fixtures:
Automated checks:
Manual checks:
Known limits:
Owner:
```

Do not add a component library, state framework, gesture library, generated Stitch runtime, wrapper hierarchy, or custom control unless accepted architecture and repeated semantic behavior require it.

## API dependency contract

Every screen handoff must resolve applicable service fields before implementation:

```text
Service owner:
Operation:
Request contract:
Response contract:
Authorization enforcement:
Consent enforcement:
Data classification:
Pagination, filter, and sort:
Validation:
Rate-limit behavior:
Not-found and denied disclosure:
Conflict and version behavior:
Idempotency:
Offline, cache, and queue behavior:
Audit event:
Timeout and retry behavior:
Synthetic fixture:
Contract version:
```

The client must not infer permission, consent, persistence, medication status, emergency dispatch, delivery, or audit completion from local UI state.

## Localization contract

Map all visible and assistive copy to localization keys before implementation:

- Titles, headings, labels, hints, units, errors, statuses, dialogs, live-region text, empty states, and recovery.
- Pluralization, gender-neutral language, dates, times, time zones, numbers, and units.
- Long-string, text-spacing, and bidirectional behavior.
- No concatenated translated sentences.
- No hardcoded Stitch-generated production copy.

## Test mapping

Tests are written during implementation and run in the consolidated frontend campaign.

| Layer            | Required coverage                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Contract         | Route, API schema, authorization, consent, validation, conflict, idempotency, and offline semantics                                      |
| Component        | Semantic HTML, labels, state, keyboard, focus, localization, and token usage                                                             |
| Screen           | Loading, empty, error, denied, stale, queued, blocked, rejected, conflict, success, and responsive fixtures                              |
| Flow             | Authentication, household, daily care, calendar, care plan, reminders, emergency, community, documents, consent, privacy, and moderation |
| Visual           | Frozen baseline at critical widths and states; approved accessible divergence                                                            |
| Accessibility    | Automated scan plus keyboard, screen reader, zoom/reflow, contrast, reduced motion, and forced colors                                    |
| Security/privacy | Non-enumeration, minimum disclosure, redaction, secret scan, unsafe URL, metadata, and artifact checks                                   |

Every implemented route records:

```text
Screen ID:
Route:
Fixture provenance:
Role:
Permission and consent case:
Viewport:
Zoom and reflow:
Input method:
Browser and assistive technology:
State:
Expected result:
Automated result:
Manual result:
Visual baseline:
Defects:
Exception reference:
Reviewer:
Date:
```

## Stitch import procedure

For every Stitch-derived image, code export, HTML reference, or prototype:

1. Read the tool name, description, schema, side effects, outbound data, and approval policy.
2. Use synthetic prompt and fixture data only.
3. Download only to an approved design or prototype path.
4. Record provenance, retrieval timestamp, redacted project/screen reference, artifact type, and reviewer.
5. Inspect content and metadata for credentials, private URLs, identifiers, tracking, scripts, dependencies, licenses, and external assets.
6. Treat HTML, CSS, scripts, images, and dependencies as untrusted external input.
7. Extract only approved intent, tokens, layout rules, semantic contracts, states, and localization needs.
8. Reimplement through project-native components and architecture contracts.
9. Record every accepted divergence.
10. Never execute generated scripts before review.
11. Never overwrite production application paths.
12. Never deploy a Stitch prototype as production.

Approved destinations:

```text
docs/design/assets/
docs/design/screenshots/
docs/design/exports/
docs/design/reviews/
prototypes/stitch/<redacted-project-id>/
```

## Definition of ready

A screen is ready for frontend implementation only when:

- Its handoff is complete and has no unresolved blocker.
- Product, route, role, permission, consent, minimum-data, and owner fields are approved.
- State and persistence semantics are explicit.
- Responsive and accessibility acceptance evidence is complete.
- Component, token, localization, and synthetic-fixture decisions are documented.
- Required service contracts are approved.
- Artifact provenance is recorded and secret-free.
- Product, design, accessibility, privacy, security, and implementation gates pass.

## Definition of implemented

A screen is implemented only when:

- Production source uses approved project components and tokens.
- No unreviewed Stitch code, script, CDN dependency, tracking, placeholder, or generated runtime remains.
- Required state, authorization, consent, audit, responsive, localization, and accessibility behavior exists.
- Tests were written during implementation.
- Consolidated frontend testing passes.
- Design divergence is documented and approved.
- Blocker and high-severity accessibility, security, privacy, and data-integrity defects are closed.

## Current status

Most screen mappings are:

```text
Blocked: architecture and service contracts missing
```

A reviewed P1 exception now exists:

```text
LB-011, LB-013, LB-014, LB-019
→ Stitch design direction reviewed
→ production implementation still blocked
→ freeze task/event/API contracts and
  docs/design/reviews/P1_S1_STITCH_HANDOFF.md first
```

A screen changes to `Ready for implementation` only after its handoff reaches `Frozen` and every required `TBD` is resolved with repository evidence.
