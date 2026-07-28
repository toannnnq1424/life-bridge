# P3-S3 threat model — Versioned support-plan review

Status: Frozen with `P3-S3-v1` on 2026-07-27.

Identity & Consent alone decides fresh governed access. Gateway composes and
forwards; Care Coordination alone owns the aggregate, draft, immutable
versions, history, audit, replay, and outbox evidence. Protected facts include
plan existence/content, participant responsibility, review facts, counters,
history depth, authority versions, and concurrency outcomes.

## Required controls and tests

- Deny organizer/member-only, inactive, hidden, revoked, narrowed,
  cross-household, wrong-recipient, wrong-permission/digest/correlation,
  over-ten-second, and over-two-second-future decisions generically.
  Reauthorize every read, history page, detail, save, and confirmation.
- Reject mass assignment, extra fields, control characters, oversize arrays or
  statements, markup objects, invalid responsibility actors, and clinical or
  medication fields. Render synthetic stored strings as text, never markup.
- Keep plan content, actor references, review facts, authority decisions,
  idempotency material, cursor plaintext, and raw errors out of events, outbox,
  Notification, audit metadata, logs, metrics, and traces.
- Serialize two initial drafts, save/save, save/confirm, and confirm/confirm.
  Same-key/same-intent replays; changed intent conflicts; stale counters never
  overwrite. Injected failure proves zero partial evidence.
- Resolve Bangkok ordinary days, New York 23/25-hour days, invalid zones/dates,
  skipped zero-length dates, and exact start/end review transitions on the
  server. Browser clocks cannot decide due state.
- Keep versions immutable and reverse-version ordered. Seal cursors to viewer,
  P2 versions, view, snapshot, limit, and expiry; expose no totals.
- Migration proves empty and v3 upgrade, rollback/reapply, legacy 002/003
  reapply, readiness v4, preservation, and no backfill.
- Browser/integration paths cover no-plan, current plus draft, history,
  overdue, denied, unavailable, offline read-only, conflict, uncertain result,
  recovery, VI/EN, keyboard/focus, 320px reflow, axe, forced colours, and
  reduced motion.

## Explicitly rejected

Role-implied consent, cached authority, Gateway-created state, cross-service
SQL/imports/credentials/shared ownership, a new service or engine, sensitive
event/notification/log payloads, clinical advice, offline queues, blind retry,
last-write-wins, destructive history, backfill, reminder delivery, and visual
claims without private-pixel inspection.
