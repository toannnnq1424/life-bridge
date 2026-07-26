# P3-S2 Calendar and Appointment Threat Model

Status: Frozen for implementation; promotion evidence is recorded separately.

Date: 2026-07-27

Scope: `P3-S2-v1`, LB-015 `/households/:id/calendar`, LB-016 appointment
create/detail/change/cancel and the minimum structured reminder-intent path.
LifeBridge remains a non-clinical coordination product.

## Assets and owners

| Asset                                                                          | Sole authority / writer | Boundary                                                               |
| ------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------- |
| Account, membership, consent subject/grant/privacy and fresh action decision   | Identity & Consent      | Owned PostgreSQL and versioned internal API                            |
| Appointment, occurrences, transitions, conflict, audit, idempotency and outbox | Care Coordination       | Owned PostgreSQL and versioned internal API/event                      |
| Public calendar/appointment composition                                        | Gateway                 | Relays only; cannot infer authority, UTC resolution, conflict or state |
| Structured reminder intent                                                     | Notification            | Idempotent inbox and owned latest-intent projection                    |

No service imports, queries or writes another service's tables. A shared local
PostgreSQL engine does not imply shared ownership or credentials.

## Authority and request binding

1. The browser supplies structured appointment kind/logistics, source local
   time, IANA zone, numeric offset, duration, finite recurrence, occurrence
   scope, expected version, enumerated cancellation reason and reminder lead.
   It never supplies actor, recipient context, consent or durable outcome.
2. Gateway binds the exact normalized route and intent to a SHA-256 request
   digest. Mutations require the accepted session, synchronizer CSRF token,
   exact Origin and Fetch Metadata checks.
3. Identity re-evaluates active same-household membership, the established
   subject, current `household_coordination` grant containing
   `recipient_context.basic_label`, and current coordination-visibility
   preference. Subject access is direct. Organizer/member/caregiver status
   alone never grants appointment access.
4. Identity issues only one fresh action-specific decision:
   `coordination.calendar.read`, `coordination.appointment.create`,
   `coordination.appointment.change` or `coordination.appointment.cancel`.
5. Care accepts a decision only for the same permission, household,
   correlation, request digest, recipient context and tightly bounded server
   time. Change/cancel also recheck the locked appointment scope/state/version.
6. Missing, denied and cross-scope resources share
   `COORDINATION_RESOURCE_NOT_FOUND` and reveal no appointment, conflict,
   household, recipient, actor, membership or hidden count.

Decisions are request evidence, not cached authority. Gateway state and events
are never authorization sources.

## Time, recurrence and conflict controls

- Canonical millisecond `Z`, source `YYYY-MM-DDTHH:mm`, numeric offset and
  validated IANA zone are separate facts. Offset/zone/local inconsistency fails.
- Nonexistent spring-forward local time fails. Repeated fall-back time uses the
  explicit `earlier|later` policy and returns the resolved numeric offset.
- Weekly recurrence is finite: interval 1–4 weeks and 2–12 occurrences.
  Concrete UTC occurrences are materialized transactionally and retain source
  local/zone/offset evidence. There is no infinite/arbitrary RRULE.
- V1 change/cancel scope is exactly `occurrence`. There is no implicit series
  split, “this and following”, external calendar synchronization or
  reinterpretation after time-zone database change.
- Calendar day bounds are PostgreSQL-derived `[start, end)` for the requested
  display IANA zone. Items overlapping the day are ordered by
  `(starts_at_utc, appointment_id)` independently of session zone or clock tie.
- Scheduled appointments for the same governed recipient use half-open overlap.
  Adjacent intervals are valid; cancelled intervals are excluded.
- Create/change locks in this order: digest idempotency advisory lock,
  recipient scheduling advisory lock, then appointment row when applicable.
  Concurrent overlap cannot produce two winners. A title-free bounded conflict
  result exposes only the conflicting interval required for recovery.

## Mutation, replay and atomicity controls

The command accepts no title, description, address, URL, attendee, note,
clinical content, arbitrary audience/channel or free-form reason.

Care stores only a digest of the idempotency key and a canonical complete
intent hash. Same key/same intent returns the original durable response for 24
hours; changed intent fails. One transaction writes appointment/occurrences,
immutable transition, privacy-minimized audit, required reminder-intent outbox
and idempotency response. Failure commits none.

Change/cancel requires an exact current version. Cancellation changes state and
appends history; it does not delete. A 5xx/transport loss after mutation is an
uncertain result. The client does not create a new key or resubmit blindly; it
reads confirmed state and performs a fresh review.

## Reminder minimization and truthfulness

`care.appointment.reminder_intent.v1` contains only event/aggregate version,
appointment ID, `schedule|cancel`, authorized acting recipient ID, UTC reminder
and appointment start when scheduled, fixed message key, correlation and
causation. It contains no household/recipient label, appointment kind,
logistics, local time, zone, recurrence, reason, conflict, free text, cursor or
idempotency data.

Notification deduplicates the event and stores the latest structured intent.
Its acknowledgement means `scheduled`, `cancelled` or `duplicate`; it does not
mean a reminder was delivered. Notification failure leaves the Care
appointment durable and its outbox retry state truthful.

## UI, disclosure and offline controls

- The visual calendar and semantic agenda consume one Care projection. The
  agenda is complete and keyboard operable at every width.
- Critical facts include structured kind/logistics, scheduled/cancelled state,
  last change, version, UTC/source local/offset/IANA time, finite recurrence
  boundary, occurrence-only mutation scope and reminder-intent state.
- Cancelled appointments remain visible. Conflict, stale version, denied,
  unavailable, uncertain and recovery are persistent states, not toast-only.
- An unavailable Identity or Care dependency is never shown as an empty
  calendar. Already confirmed data may remain visibly stale/offline.
- Offline mutation is disabled, never queued and never submitted on reconnect.
  Success appears only from a validated durable response.
- Logs/metrics/traces are allow-listed to operation, result, correlation,
  duration, bounded error, event type/version and retry facts. Decisions,
  payloads, local/UTC schedules, appointment/recipient references, conflict
  intervals, reasons, headers, cookies and raw errors are prohibited.

## Migration and residual limitations

Care migration 003 is additive, transactional, repeatable, keeps a distinct
appointment coverage start and performs no backfill. Notification migration
002 is additive/repeatable and performs no reminder backfill. Old task,
timeline, handoff and task-notification behavior remains compatible.

Required evidence includes provider/consumer strictness; Care/Notification
migration rollback/reapply/no-backfill; real PostgreSQL DST/recurrence/order/
conflict/race/idempotency/atomicity; real outbox/Notification recovery; VI/EN
native keyboard/focus/axe/reflow/offline/conflict/cancel/recovery; privacy-safe
logs; builds; and exact task-owned cleanup.

KI-001 still blocks deployment. KI-016 retains manual NVDA/Narrator,
physical-device, text-spacing and 200%/400% assistive-technology evidence.
KI-019 retains independent private-render inspection before any
visual-conformance claim.
