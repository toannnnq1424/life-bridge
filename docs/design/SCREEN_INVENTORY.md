# LifeBridge Screen Inventory

## Shared screen contract

Every screen and state pattern inherits this contract. Exceptions must be documented in its handoff.

| Area              | Contract                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mobile            | Support 320 CSS px onward; use a one-column priority flow; retain every critical capability; provide adequately sized targets                    |
| Tablet            | Reflow into one or two contextual regions; preserve logical reading and focus order; require no hover interaction                                |
| Desktop           | Add persistent navigation or contextual panels only when they improve coordination; constrain reading width                                      |
| Keyboard          | Make every action reachable in visible logical order; provide no keyboard trap; prefer native controls; restore focus after dialogs              |
| Screen reader     | Provide a page title, one visible `h1`, named landmarks, accessible control names, semantic relationships, and urgency-appropriate announcements |
| Focus             | Keep focus visible and unobscured; move it to a heading or error summary after relevant context changes; restore it after modal closure          |
| Loading           | Identify scope; show truthful structure or progress; do not fabricate data or block unrelated work                                               |
| Empty             | Explain the cause, expected content, applicable filters, and one permitted next action                                                           |
| Error             | Identify the failed action, retained data, and safe recovery without exposing sensitive implementation detail                                    |
| Permission denied | Explain the role or consent boundary without revealing protected data or whether a protected resource exists                                     |
| Offline           | Distinguish stale, queued, blocked, conflicted, and confirmed state; provide retry or conflict guidance where applicable                         |
| Privacy           | Use synthetic data only; exclude credentials, tokens, signed URLs, private links, and real care-recipient information                            |
| Review            | Require product, design, accessibility, privacy, and implementation approval before design freeze                                                |

A state may be marked not applicable only when the handoff explains why the screen has no corresponding data or operation.

P2-S3 status on 2026-07-26: LB-028–LB-031 each have one synthetic Stitch
reference and a Frozen redacted handoff with mandatory native corrections.
Native VI/EN routes and targeted browser/PostgreSQL evidence exist. Generated
private renders are not standalone visual approval (KI-019); full slice status
still requires exact-head hosted promotion.

P3-S1 candidate status on 2026-07-26: desktop/mobile LB-012 and the minimum
LB-014 handoff extension were generated once with synthetic aliases and read
back individually. `docs/design/reviews/P3_S1_STITCH_HANDOFF.md` is Frozen for
corrected native implementation. Native VI/EN routes and automated evidence
are candidate-complete; local Level C and hosted promotion remain. KI-019
prevents a private-render visual-conformance claim.

P3-S3 accepted status on 2026-07-28: four synthetic LB-017 current/history,
draft/review, overdue, and recovery references were generated/read back once.
The independently corrected `P3_S3_STITCH_HANDOFF.md` is Frozen for native
semantic implementation only. Product copy uses Support plan / Kế hoạch hỗ
trợ. Native VI/EN, local/hosted browser and integration evidence passed through
PR #56 and `dev@f3576f40779617f0d7bd519ac44b178ccf269e3e`. Private pixels
remain unapproved under KI-019; manual AT remains KI-016.

P4-S1 candidate status on 2026-07-28: four synthetic LB-018/minimum LB-019
desktop/mobile references were generated and read back once. The independently
corrected `P4_S1_STITCH_HANDOFF.md` is Frozen for native semantic
implementation only. Generated source is rejected, private pixels remain
unapproved under KI-019, and manual AT remains KI-016.

P4-S3 candidate status on 2026-07-28: four synthetic LB-023 upload,
validation, access/deletion and recovery desktop/mobile references were
generated and read back once. `P4_S3_STITCH_HANDOFF.md` is Frozen for native
semantic implementation only. Care/PostgreSQL ownership, strict text-only
acceptance and unscanned processing truth replace the former storage/scanner
TBD. Generated source is rejected, private pixels remain unapproved under
KI-019, and manual AT remains KI-016.

P5-S1 candidate status on 2026-07-29: four bounded synthetic LB-022/LB-024
desktop/mobile references were generated once and read back once. The
independently corrected `P5_S1_STITCH_HANDOFF.md` is Frozen for native
semantic implementation only; generated source and invented organization/
submission facts are rejected. Native VI/EN routes and focused desktop/mobile
plus mixed-runtime evidence are complete. The only full local Level C static
failure and its guarded same-ledger passing continuation are retained; hosted
promotion remains. KI-016 and KI-019 are retained.

## Screen register

| ID       | Screen                       | Primary role                      | Route concept                                                       | Purpose and critical requirements                                                                                                                                                                                                                                                            |
| -------- | ---------------------------- | --------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LB-001` | Landing page                 | Public visitor                    | `/`                                                                 | Explain value, safety, supported roles, and entry routes. Public-content failure needs a usable fallback; async sections expose loading; empty dynamic sections do not create dead ends.                                                                                                     |
| `LB-002` | Login                        | Existing user                     | `/login`                                                            | Authenticate and expose safe recovery. Support validation, throttling, locked state, MFA transition, offline failure, password managers, paste, and non-enumerating errors.                                                                                                                  |
| `LB-003` | Registration                 | New user                          | `/register`                                                         | Create an account and communicate consent and terms. Preserve safe input through validation, duplicate-account, service, and offline failures.                                                                                                                                               |
| `LB-004` | MFA                          | Authenticating user               | `/mfa`                                                              | Complete a second factor. Handle invalid or expired codes, resend cooldown, alternate method, recovery, locked state, and offline failure; focus the actionable error.                                                                                                                       |
| `LB-005` | Account recovery             | Locked-out user                   | `/recover`                                                          | Recover access without account enumeration. Use generic confirmation; handle rate limits, expired links, invalid links, service errors, and offline state.                                                                                                                                   |
| `LB-006` | Onboarding                   | New account                       | `/onboarding`                                                       | Establish role, household path, and first safe action. Support save/resume, validation, permitted skipping, progress announcements, and safe backward navigation.                                                                                                                            |
| `LB-007` | Accessibility onboarding     | Any user                          | `/onboarding/accessibility`                                         | Capture optional text, contrast, motion, language, and assistive preferences without gating access. Provide preview, defaults, reset, saved, failed, and offline states.                                                                                                                     |
| `LB-008` | Household creation           | Organizer                         | `/households/new`                                                   | Atomically create a household and explain the bounded organizer role without legal or consent implications. Handle validation, conflict/rate/service errors, confirmed success, and blocked offline behavior with no queue or auto-submit.                                                   |
| `LB-009` | Household invitation         | Organizer or invitee              | `/households/:id/invitations`; `/invitations`                       | Invite one caregiver/member or accept/decline under the intended verified account. Expose pending, accepted, declined, expired, revoked, resend-limited, conflict, offline-blocked, and denied states without account or household leakage.                                                  |
| `LB-010` | Care-recipient context       | Authorized household user         | `/households/:id/recipient-context`                                 | View minimum safe display and neutral relationship labels; organizer may version-update them. No medical inference, clinical data, legal authority, or consent mutation. Handle empty, validation, conflict, offline-blocked, service, and denied states.                                    |
| `LB-011` | Family dashboard             | Household user                    | `/households/:id`                                                   | Prioritize urgent care, due work, task ownership, and timeline events. Support first-use empty, partial error, stale/offline, permission-denied, and dense loading states; urgency is never color-only.                                                                                      |
| `LB-012` | Daily care timeline          | Governed household user           | `/households/:id/timeline`                                          | Review accepted chronological task facts for one explicit local date, IANA zone, UTC boundary and filter. Use stable keyset order with no totals; handle pre-coverage, empty/filter-empty, generic denial, unavailable, stale cursor and offline read-only state.                            |
| `LB-013` | Task board                   | Household user                    | `/households/:id/tasks`                                             | Organize and update care tasks. Provide a complete keyboard-operable list alternative to dragging; handle empty, filtered, assignment-denied, conflict, and offline-queue states.                                                                                                            |
| `LB-014` | Task detail                  | Governed current assignee         | `/households/:id/tasks/:taskId`                                     | Review task, accountable actor, eligible proposed actor, expected version, enumerated reason and server-effective semantics before handoff. Handle generic missing/denied, completed, conflict, uncertain-result check, unavailable, recovery, success and offline no-queue states.          |
| `LB-015` | Calendar                     | Purpose-authorized household user | `/households/:id/calendar`                                          | Inspect structured appointments in a calendar plus fact-complete keyboard agenda; expose UTC/local/offset/IANA and recurrence boundaries; handle empty, filtered empty, denied, unavailable, conflict, stale and offline states.                                                             |
| `LB-016` | Appointment detail           | Action-authorized household user  | `/appointments/:appointmentId`                                      | Create, change, review and cancel one occurrence with structured logistics/reminder intent, explicit DST/recurrence facts, optimistic concurrency, denied/unavailable/conflict/cancelled/offline recovery, and no implied delivery.                                                          |
| `LB-017` | Care plan                    | Authorized household user         | `/households/:id/care-plan`                                         | Maintain goals, preferences, responsibilities, version, and review date. Handle no plan, draft, overdue review, consent limits, conflicts, and stale/offline state.                                                                                                                          |
| `LB-018` | Medication reminder schedule | Authorized household user         | `/households/:id/medication-reminders`; `/medication-reminders/:id` | Store only user-provided label/amount/explicit unit/local time/IANA/offset/finite recurrence; separate schedule intent from delivery and seen acknowledgement; handle empty, invalid, conflict, denied, unavailable, uncertain and offline-no-queue states without clinical advice.          |
| `LB-019` | Notification center          | Authenticated user                | `/notifications`; `/notifications/medication-reminders`             | Minimum P4-S1 extension shows generic intent/delivery/failed/missed/uncertain/cancelled truth and immutable seen-only acknowledgement. It receives no medication label, amount or unit; critical information never exists only in a toast.                                                   |
| `LB-020` | Emergency contact list       | Exact-purpose authorized user     | `/households/:id/emergency-contacts`                                | Maintain the complete configured order and one phone method per contact. Handle empty, invalid, minimum/consent-limited, denied, unavailable, conflict, uncertain, confirmed, and offline-blocked states without implying availability, consent, authority, urgency, contact, or dispatch.   |
| `LB-021` | Emergency plan               | Exact-purpose authorized user     | `/households/:id/emergency-plan`                                    | Present participant-reviewed, server-confirmed structured guidance and configured contacts. Support no-plan, draft, review-required, denied, conflict, unavailable, timestamped offline recent/stale/expired/purged/recovery states; never imply diagnosis, treatment, contact, or dispatch. |
| `LB-022` | Help request                 | Purpose-authorized requester      | `/help/new`                                                         | Explain purpose, fields, visibility, retention/delete and no-match before a bounded request. Handle draft, validation, denied/revoked, duplicate, uncertain reconcile, conflict, pending/closed/deleted, unavailable and offline blocked/no queue.                                           |
| `LB-023` | Document vault               | Authorized household user         | `/households/:id/documents`                                         | Store and find documents with retention and access controls. Provide a file-picker alternative to drag/drop; announce upload, scan/process, failure, unavailable, denied, empty, and offline states.                                                                                         |
| `LB-024` | Community directory          | Public or authenticated user      | `/community`                                                        | Find reviewed public listings without eligibility inference or protected context. Handle bounded filters, no results, location denial, current/stale provenance, search/Community failure and identity-free stale/offline cache with minimum data.                                           |
| `LB-025` | Volunteer matching           | Volunteer or coordinator          | `/matching`                                                         | Match approved requests and record status. Show only consented fields; handle no match, pending approval, revoked match, error, denied access, and offline state.                                                                                                                            |
| `LB-026` | Organization dashboard       | Organization coordinator          | `/organization`                                                     | Monitor capacity, referrals, matching, and exceptions within organization scope. Handle aggregate loading, empty queue, partial error, stale/offline data, and scoped denial.                                                                                                                |
| `LB-027` | Admin moderation             | Moderator or administrator        | `/admin/moderation`                                                 | Review and resolve community safety reports. Protect sensitive details; handle empty queue, loading/action failure, stale state, denied access, auditable decisions, and safe destructive confirmation.                                                                                      |
| `LB-028` | Consent management           | Explicitly bound care recipient   | `/households/:id/consent`                                           | Establish self-authority when eligible; grant, strictly narrow, review, or revoke sharing. Show pseudonymous recipient, exact scope, effect, authority and live server UTC/IANA time before change; handle empty, conflict, denied, unavailable and offline-with-no-queue states.            |
| `LB-029` | Privacy controls             | Account owner                     | `/settings/privacy`                                                 | Atomically control profile discovery, household visibility, and access-alert preference with explicit review. Avoid hidden opt-in; handle defaults, validation/conflict/failure reset, denied, offline, success, and truthful deferred export/deletion.                                      |
| `LB-030` | Audit history                | Explicitly bound care recipient   | `/households/:id/audit`                                             | Inspect a read-only, redacted, 90-day bounded history with validated IANA display zone, safe category filter and sealed keyset pagination. Expose no protected value, grant action, total or inference through denial/error states.                                                          |
| `LB-031` | Settings                     | Authenticated account owner       | `/settings`                                                         | Navigate to separately owned settings sections and show only a safe last-confirmed UTC/IANA instant. The hub has no global save or implied cross-section atomicity and handles unavailable state without reproducing preference values.                                                      |
| `LB-032` | Offline state                | Any user                          | Route-preserving state                                              | Explain connectivity, stale data, queued work, blocked actions, conflicts, last confirmed sync, retry, and recovery. Never claim unconfirmed persistence.                                                                                                                                    |
| `LB-033` | Empty-state pattern          | Any user                          | Originating route                                                   | Explain absence, filtering, or permission-safe cause and provide one permitted next action. Preserve originating route semantics and keyboard discoverability.                                                                                                                               |
| `LB-034` | Error-state pattern          | Any user                          | Originating route                                                   | Explain error scope, retained data, safe recovery, and a non-sensitive support reference when useful. Focus a linked error summary after failed submission.                                                                                                                                  |
| `LB-035` | Loading-state pattern        | Any user                          | Originating route                                                   | Communicate truthful structural loading or progress without false content or unnecessary blocking. Announce meaningful prolonged progress and available cancel/retry actions.                                                                                                                |

## Cross-screen exceptions

| Screen IDs                            | Additional contract                                                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LB-002`–`LB-005`                     | Allow password and one-time-code paste where applicable; do not disclose account existence or sensitive authentication state.                                                                 |
| `LB-006`–`LB-009`                     | Announce progress descriptively; never rely on color; explain role, invitation, ownership, and consent consequences before commitment.                                                        |
| `LB-010`, `LB-017`, `LB-028`–`LB-030` | Keep sensitive details redacted until authorization is established; confirm consent, privacy, and audit actions without reproducing protected data.                                           |
| `LB-011`–`LB-016`                     | Boards and calendars require keyboard-equivalent list or agenda views; desktop density must preserve every mobile workflow.                                                                   |
| `LB-018`, `LB-020`, `LB-021`          | Make source/time facts explicit using text, icon, and color together; make only the participant-reviewed/server-confirmed minimum emergency plan readable within the approved offline window. |
| `LB-022`–`LB-027`                     | Apply minimum-necessary disclosure; matching, organization, and moderation actions require explicit permission and audit context.                                                             |
| `LB-023`                              | Explain accepted files, limits, progress, processing, retention, access, and recovery; drag-and-drop is never the only input.                                                                 |
| `LB-032`–`LB-035`                     | Preserve the originating route, context, valid user input, navigation, and available recovery actions.                                                                                        |

## Review status

| Status                 | Meaning                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `Not started`          | No screen design or contract review                                      |
| `Flow drafted`         | Journey, route, and permission context identified                        |
| `Design review`        | Visual and interaction review pending or active                          |
| `Accessibility review` | Accessibility evidence pending or active                                 |
| `Frozen`               | Product, design, accessibility, privacy, and implementation gates passed |
| `Implemented`          | Production source and consolidated tests complete                        |

All screens begin at `Not started`.

Create one handoff per screen at:

```text
docs/design/reviews/<SCREEN-ID>.md
```

Use `docs/design/reviews/SCREEN_HANDOFF_TEMPLATE.md`. No screen may enter frontend implementation or reach `Frozen` status until its handoff is complete.
