# P3-S1 Daily Timeline and Handoff Threat Model

Status: Frozen for implementation; local Level C and hosted promotion evidence
are recorded separately.

Date: 2026-07-26

Scope: `P3-S1-v1`, LB-012 `/households/:id/timeline`, and the minimum LB-014
task-detail handoff extension. LifeBridge remains a non-clinical coordination
product.

## Assets and owners

| Asset                                                                               | Sole authority / writer | Boundary                                                              |
| ----------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------- |
| Account, membership, consent subject, grant, privacy version, coordination decision | Identity & Consent      | Owned PostgreSQL and versioned internal API                           |
| Task, accountable assignee, handoff, timeline, audit, idempotency, outbox           | Care Coordination       | Owned PostgreSQL and versioned internal API/event                     |
| Public composition                                                                  | Gateway                 | May relay and compose; cannot infer authority or fabricate Care state |
| Handoff notification                                                                | Notification            | Idempotent inbox and recipient-scoped notification store              |

No service imports, queries, or writes another service's tables. A shared local
PostgreSQL engine does not imply shared ownership or credentials.

## Trust and authority rules

1. The browser supplies a household, local date, display zone, filter, task,
   proposed actor reference, expected task version, enumerated reason, and
   idempotency key. It never chooses or asserts authority.
2. Gateway binds the exact normalized intent to a SHA-256 request digest and
   asks Identity for a fresh, purpose-scoped decision. A selected handoff
   target requires the existing session, synchronizer CSRF token, exact Origin,
   and Fetch Metadata checks.
3. Identity re-evaluates active household membership and the P2 subject,
   active `household_coordination` grant with basic-label scope, and subject
   coordination-visibility version. Organizer or member status alone never
   implies consent. Eligible handoff targets pass the same governed boundary.
4. Care accepts a decision only for the same correlation ID, request digest,
   household, permission, and a tightly bounded server time. It independently
   verifies task household, recipient context, current assignee, open state,
   version, from/to actors, and different target.
5. A missing, cross-household, unauthorized, completed, stale, or otherwise
   invalid task is never broadened by the handoff route. Inaccessible and
   absent resources share the generic not-found shape.

Decisions are request evidence, not durable grants or cacheable consent.
Events and Gateway state are never authorization sources.

## Time, chronology, and inference controls

- Occurrence and effective time are server-created UTC instants. Handoff is
  immediate only after the Care transaction commits.
- Display zones must be valid IANA identifiers. PostgreSQL computes the local
  day `[start, end)` so 23-hour and 25-hour DST days remain explicit.
- Timeline order is ascending `(occurred_at, event_ref)`. A snapshot sequence
  excludes later inserts, including later-recorded facts with backward clock
  values.
- The HMAC-sealed keyset cursor binds actor, household, recipient context,
  subject/grant/privacy versions, local date, zone, filter, limit, snapshot,
  continuation, and expiry. Invalid, stale, tampered, or differently scoped
  cursors fail closed.
- Pages are bounded to 50 items and expose no total, hidden count, or
  membership/recipient inference. Empty day, empty filter, denied, and
  unavailable are distinct without revealing protected facts.

## Mutation, replay, and atomicity controls

The handoff command contains no free-form text. It includes task/household
scope, expected task version and from-actor reference, proposed actor
reference, one enumerated reason, immediate effective semantics, and an
idempotency key.

Care hashes the idempotency key and canonical intent, serializes replays with a
transaction advisory lock, and row-locks the task. Same-key/same-intent returns
the original durable response; same-key/changed-intent fails. One transaction
updates the assignee/version and writes handoff evidence, timeline fact, audit,
outbox, and idempotency response. Failure commits none. Notification delivery
is separate and idempotent; the UI confirms only the returned Care state and
labels notification delivery independently.

## Data minimization, retention, and telemetry

- Timeline may display the authorized task title from the Care read model.
  The title is not copied into the handoff command, event, audit, outbox,
  notification, log, metric, or trace.
- Handoff context is an enumerated reason code only. No description, comment,
  health fact, diagnosis, treatment, or contact detail is accepted.
- Public actors use subject-bound opaque references and safe display keys.
  Internal account IDs remain service-to-service evidence.
- `care.task.handed_off.v1` carries opaque household, recipient, task, actor
  IDs, reason/outcome/effective time, and recipient routing only. Notification
  stores only the task ID message parameter.
- Operational telemetry is allow-listed to operation, result, correlation,
  duration, bounded error, event type/version, and retry facts. Headers,
  cookies, tokens, decisions, cursors, payloads, titles, actor references,
  reason values, idempotency material, and raw errors are prohibited.
- Handoff idempotency expires after 24 hours. Timeline, handoff, audit, and
  delivered outbox evidence currently follow the owning product-record
  lifecycle; physical purge/legal hold/account deletion proof remains P7/P8.
  This is an engineering default, not a legal-compliance claim.

Migration 002 starts timeline coverage at application time and performs no
historical backfill. The UI labels pre-coverage days as potentially incomplete.

## Availability, offline, and recovery

Gateway never converts an Identity or Care failure into an authoritative empty
timeline. An already displayed page may remain visible with stale/offline
labeling. Offline handoff is disabled, never queued, and never submitted on
reconnect. A 5xx/transport failure after mutation is an uncertain result:
the UI does not blindly retry and instead reloads the current task. A version
conflict discards the proposal and requires a new review from current state.

Care readiness requires schema marker version 2. The migration is additive,
transactional, repeatable, rollback-tested, and preserves P1 task behavior.

## Verification and residual limitations

Required evidence includes contract/provider-consumer tests, real PostgreSQL
DST/order/keyset/tamper/race/idempotency/atomicity/no-backfill tests, a built
web-to-Gateway-to-Identity-to-Care-to-Notification journey, privacy-safe log
scans, generic denial/unavailable behavior, and artifact-disabled browser
keyboard/focus/axe/320 px/offline/conflict/uncertain/success states.

KI-001 still blocks deployment. KI-016 retains manual NVDA/Narrator,
physical-device, text-spacing, forced-colors, and 200%/400% assistive-
technology evidence. KI-019 retains independent inspection of private Stitch
renders before any visual-conformance claim. These limitations do not permit
weaker native semantics or privacy controls.
