# API Contracts

## P7-S2 internal recovery contract

`GET /internal/v1/event-recovery/events/{eventId}` requires the
`recovery-operator` identity. Care uses `event.recovery`; Notification uses
read-only `event.reconciliation`. Responses contain bounded opaque evidence,
never raw event or care content.

Care alone exposes `POST .../{eventId}/replay`. It requires one explicit event
ID, operator ID and reason, defaults to dry-run and may CAS only
`attention_required` to `pending`. Event identity, payload, source truth and
consumer rows are immutable. Schema/hash/order poison is permanently rejected.

## Status

- Contract set: `P1-S1-v1`
- State: **Frozen for implementation**
- Frozen: 2026-07-26
- Change: `CHG-2026-008`
- Executable source: `packages/contracts`

The schemas in `packages/contracts` must remain equivalent to this contract.
Breaking semantics require a new API/event version and accepted change record.

## P6-S1 Gateway to Community compatibility release line

The machine-readable authority is
`contracts/community/p6-s1/compatibility-policy.json`. The current release is
`community-v2` and the previous supported release is `community-v1`. Gateway
selects one explicitly with `x-lifebridge-contract-version`; current Community
serves both and returns the selected value in the same header. A headerless
previous Gateway is treated as `community-v1`. Unsupported values fail before
dispatch with HTTP 406 and `COMMUNITY_CONTRACT_VERSION_UNSUPPORTED`.

Both versions preserve the P5 language-neutral OpenAPI/JSON Schema command,
authority, idempotency, digest, optimistic concurrency, minimum-disclosure and
failure semantics. Event v2 is additive to event v1. Previous is supported for
at least 90 days and through one rollout/rollback cycle; removal requires an
accepted change, published date, zero consumer inventory and migration proof.
Ambiguous mutations never fall back across versions and remain unknown until
reconciled.

## Conventions

- Public prefix: `/api/v1`.
- JSON is UTF-8. Timestamps are ISO 8601 instants and due context also carries a
  valid IANA time-zone identifier.
- Identifiers are opaque strings. Clients do not infer type or ownership from
  their shape.
- UI default locale is `vi-VN`; its persisted selector supports `vi-VN` and
  `en`. Backend messages remain localization keys. HTTP `Accept-Language`
  negotiation is deferred because P1 responses contain no localized prose.
- Every mutation requires `Idempotency-Key` with 8–128 visible ASCII
  characters. Reusing a key with a different canonical request hash returns
  `409 IDEMPOTENCY_KEY_REUSED`.
- Every mutable aggregate has a positive integer `version`.
- Every response contains `meta.correlationId`. An invalid inbound correlation
  identifier is replaced rather than reflected.
- Authorization is denied by default and checked at the gateway and owning
  service against fixture actor, household, resource, and action.
- Protected-resource denial and not-found share the public
  `404 TASK_NOT_FOUND` response.
- The local-only fixture adapter accepts `X-Fixture-Actor-Id`. Startup fails if
  fixture identity is enabled outside the explicit `local` or `test` runtime.
- Public errors never expose stack traces, database/service names, credentials,
  private hostnames, record contents, or raw dependency errors.

## Shared envelopes

Success:

```json
{
  "data": {},
  "meta": {
    "correlationId": "corr_opaque"
  }
}
```

Error:

```json
{
  "error": {
    "code": "TASK_VALIDATION_FAILED",
    "messageKey": "errors.task.validation",
    "fieldErrors": {
      "title": "required"
    },
    "retryable": false,
    "correlationId": "corr_opaque"
  }
}
```

## Frozen task projection

```json
{
  "taskId": "task_opaque",
  "householdId": "hh_opaque",
  "careRecipientId": "person_opaque",
  "title": "Arrange transport",
  "description": "Optional synthetic coordination detail",
  "assigneeId": "member_minh",
  "createdBy": "member_lan",
  "dueAt": "2026-08-03T02:00:00.000Z",
  "dueTimeZone": "Asia/Bangkok",
  "priority": "normal",
  "status": "open",
  "version": 1,
  "createdAt": "2026-08-01T03:30:00.000Z",
  "completedBy": null,
  "completedAt": null,
  "notificationDelivery": "not_started"
}
```

Rules:

- `title`: trimmed, 1–120 Unicode characters.
- `description`: optional, trimmed, at most 500 Unicode characters.
- `priority`: `normal | important | urgent`; it is never a clinical assessment.
- `status`: `open | completed` in P1-S1.
- `dueAt`: valid instant; `dueTimeZone`: supported IANA zone; the pair is stored
  without silently converting the user's zone context.
- `notificationDelivery`:
  `not_started | pending | retrying | failed | delivered | suppressed`.
  Care Coordination owns this delivery-intent projection from its outbox.

## Public task and dashboard HTTP

### `GET /api/v1/households/{householdId}/members`

Returns only active, eligible members visible to the current fixture actor.
This is the assignee picker contract, not a general household directory.

### `GET /api/v1/households/{householdId}/tasks`

Query:

- `status`: optional `open | completed`;
- `assigneeId`: optional opaque member ID.

Returns visible tasks ordered by due instant, priority, creation instant, and
task ID. Empty is `200` with `data: []`. Authorization failures do not disclose
another household.

### `POST /api/v1/households/{householdId}/tasks`

Request:

```json
{
  "title": "Arrange transport",
  "description": "Synthetic demonstration text",
  "assigneeId": "member_minh",
  "careRecipientId": "person_an",
  "dueAt": "2026-08-03T02:00:00.000Z",
  "dueTimeZone": "Asia/Bangkok",
  "priority": "normal"
}
```

Behavior:

- requires an authorized creator and active eligible assignee in the same
  household;
- commits one task, create audit entry, and idempotency result atomically;
- returns `201` and confirmed version `1`;
- the same key and payload returns the original `201` result;
- create emits no P1 notification event under `CHG-2026-008`.

Validation covers missing/oversized text, invalid instant/time zone/priority,
inactive or ineligible assignee, and unexpected fields.

### `GET /api/v1/tasks/{taskId}`

Returns one visible task. Missing and inaccessible tasks share
`404 TASK_NOT_FOUND`.

### `PATCH /api/v1/tasks/{taskId}`

P1-S1 accepts only:

```json
{
  "operation": "complete",
  "expectedVersion": 1
}
```

Behavior:

- only the current assignee may complete an open task;
- task completion, completion audit, idempotency result, and exactly one
  `care.task.completed.v1` outbox record commit atomically;
- the first result is `200`, task version `2`, delivery `pending`;
- the same idempotency key and payload returns the original response;
- a new idempotency key after the same actor already completed the task returns
  the current `200` result and creates no new outbox event;
- a stale `expectedVersion` on an otherwise open task returns
  `409 TASK_VERSION_CONFLICT` with the safe current task projection and recovery
  action `reload_current`;
- an unauthorized actor receives the non-disclosing public not-found response.

The primary deterministic flow has Lan create/coordinate and Minh
complete. Completion therefore produces one cross-user notification for Lan.
If creator and completer are the same actor, Notification records a deduplicated
suppression result and stores no self-notification.

### `GET /api/v1/households/{householdId}/dashboard`

Returns:

- open/completed counts;
- the next five visible tasks;
- last confirmed task update;
- task-source freshness;
- Notification dependency state;
- the current actor's latest stored notifications when available.

Care-task data remains present when Notification is unavailable. The gateway
returns dependency state `degraded` and does not fabricate an empty notification
collection or delivered notification. Task rows may show Care-owned
pending/retrying/failed delivery intent.

### `GET /api/v1/notifications`

Returns Notification-owned persistent items for the current recipient only.
An unavailable Notification service returns
`503 NOTIFICATION_UNAVAILABLE`; it never returns a fabricated empty collection.

## Internal completion event

Envelope:

```json
{
  "eventId": "evt_opaque",
  "eventType": "care.task.completed.v1",
  "eventVersion": 1,
  "occurredAt": "2026-08-03T02:05:00.000Z",
  "producer": "care-coordination",
  "aggregateId": "task_opaque",
  "aggregateVersion": 2,
  "correlationId": "corr_opaque",
  "causationId": "cmd_opaque",
  "payload": {
    "householdId": "hh_minh_an",
    "notificationDisposition": "deliver",
    "recipientId": "member_lan",
    "completedBy": "member_minh",
    "completedAt": "2026-08-03T02:05:00.000Z"
  }
}
```

Care Coordination resolves `notify_creator_if_other_actor`: the primary
two-actor flow uses disposition `deliver` and the creator recipient; a
self-completion uses disposition `suppress_self` with no recipient ID. The
event deliberately excludes title, description, care-recipient profile,
display names, contact details, medical content, and client-rendered copy.

## Internal Notification delivery

### `POST /internal/v1/events/care-task-completed`

- accepts only the frozen `care.task.completed.v1` schema;
- uses source `eventId` as the inbox idempotency key;
- commits inbox result and at most one notification in one local transaction;
- returns a durable acknowledgement only after commit;
- duplicate delivery returns the original acknowledgement;
- same event ID with a different payload hash returns
  `409 EVENT_ID_REUSED`;
- disposition `suppress_self` returns durable `suppressed_self` and no
  notification.

Notification row:

```json
{
  "notificationId": "notification_opaque",
  "recipientId": "member_lan",
  "sourceEventId": "evt_opaque",
  "messageKey": "notifications.task.completed",
  "messageParams": {
    "taskId": "task_opaque"
  },
  "read": false,
  "createdAt": "2026-08-03T02:05:00.000Z"
}
```

The outbox dispatcher applies bounded automatic retries. Care marks `delivered`
only after the durable acknowledgement. Exhausted attempts remain durably
`failed`; P1 exposes that honest state but does not add an operator retry API.
Reconciliation/operator retry is a later reliability gate. Task completion is
never rolled back.

## Audit and safe observability events

Required stable actions:

- `task.create`;
- `task.complete`;
- `task.complete.denied`;
- `task.complete.conflict`;
- `task.notification.pending`;
- `task.notification.delivered`;
- `task.notification.failed`;
- `task.notification.suppressed_self`.

Allow-listed structured fields are service, event name, operation, result,
correlation ID, bounded error code, duration, retry count, event type/version,
and opaque actor/household/resource identifiers when required. Free-form task
content, request bodies, raw errors, connection strings, credentials, and
display names are prohibited.

## Health and version endpoints

Every deployable exposes:

- `/health/live`: process responsiveness without dependency queries;
- `/health/ready`: owned database/migration readiness;
- `/version`: build and supported contract versions without environment data.

Gateway readiness reports required task dependency readiness and separately
reports Notification degradation so a notification outage cannot erase or
falsify confirmed task state.

With P2-S1 enabled, Identity readiness is also required for gateway readiness;
Notification remains the only degraded/optional dependency in this slice.

## P2-S1 account and session contract

State: **Frozen for contracts/backend implementation** on 2026-07-26 under
`CHG-2026-010`/ADR-018. Production UI and the complete P2-S1 contract set remain
blocked by `MCP-DEBT-2026-002`.

The executable schemas extend `packages/contracts` without breaking
`P1-S1-v1`. All identity responses set `Cache-Control: no-store`; public errors
contain a safe localization key and correlation ID only. Login names are never
placed in URLs, logs, audit metadata, or response copy.

### Public unauthenticated routes

| Route                                                 | Request                                       | Public result                                                                                              |
| ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/account/registrations`                  | login name, password                          | `202 REGISTRATION_ACCEPTED` with a real-or-decoy enrollment challenge of the same shape                    |
| `POST /api/v1/account/registrations/factor`           | challenge token, TOTP                         | `202 REGISTRATION_ACCEPTED`; returns real-or-decoy one-time recovery codes of the same shape               |
| `POST /api/v1/account/registrations/confirm-recovery` | challenge token, acknowledgement              | `202 REGISTRATION_ACCEPTED`; activates only a valid real flow and creates no session                       |
| `POST /api/v1/account/sessions`                       | login name, password                          | `202 AUTHENTICATION_CONTINUE` with a real-or-decoy factor challenge                                        |
| `POST /api/v1/account/sessions/factor`                | challenge token, TOTP                         | valid proof creates an opaque session; all failures use `401 AUTHENTICATION_FAILED`                        |
| `POST /api/v1/account/recoveries/password`            | login name, TOTP, recovery code, new password | generic failure; valid proof changes password, rotates codes and revokes all sessions; never auto-signs in |
| `POST /api/v1/account/recoveries/factor`              | login name, password, recovery code           | generic failure; valid proof starts purpose-bound TOTP re-enrollment                                       |
| `POST /api/v1/account/recoveries/factor/confirm`      | challenge token, TOTP                         | valid proof replaces factor/codes and revokes all sessions; never auto-signs in                            |

Registration response equivalence covers new and duplicate login names.
Authentication response equivalence covers unknown, wrong-password, locked,
disabled and unverified accounts. Recovery failure equivalence covers unknown,
invalid, expired, used and mismatched artifacts. Rate-limited responses are
based on buckets that also exist for unknown identifiers.

The gateway owns cookie serialization and never forwards public actor headers.
Identity returns a raw session token and CSRF token only across the protected
internal response; gateway converts the session token to the cookie and returns
the CSRF token in the success body. Raw tokens are never logged.

### Cookie-authenticated account routes

| Route                                      | Behavior                                                                                              |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `GET /api/v1/account/session`              | returns opaque account ID, onboarding state, preferences and CSRF token for a current account session |
| `POST /api/v1/account/session/logout`      | revokes server session and clears cookie; idempotent public result                                    |
| `PATCH /api/v1/account/preferences`        | version-checked optional locale/text/contrast/motion update; failure never revokes/gates the session  |
| `POST /api/v1/account/onboarding/complete` | records non-authoritative role intent and completion; rotates session; grants no household capability |

Cookie-authenticated mutations require `X-CSRF-Token`, exact configured
`Origin`, non-cross-site Fetch Metadata and JSON input. Missing, wrong,
cross-origin, expired, revoked or replayed session material fails before the
mutation. Preferences use optimistic `expectedVersion`; a retry cannot create a
second transition and a stale or changed intent returns a bounded version
conflict. The client retrieves the confirmed projection before retrying an
unknown result.

### Account/session projections

```json
{
  "accountId": "account_opaque",
  "onboardingState": "required",
  "authorizationScope": "account",
  "preferences": {
    "locale": "vi-VN",
    "textScale": "default",
    "contrast": "system",
    "motion": "system",
    "version": 1
  },
  "session": {
    "idleExpiresAt": "2026-07-26T03:00:00.000Z",
    "absoluteExpiresAt": "2026-07-26T14:30:00.000Z"
  },
  "csrfToken": "returned_only_to_the_authenticated_client"
}
```

`authorizationScope: account` is explicit. Gateway returns a non-disclosing
denial for household/Care routes because P2-S1 creates no membership.

### P2-S1 stable errors and audit actions

Stable public codes:

```text
REGISTRATION_ACCEPTED
AUTHENTICATION_CONTINUE
AUTHENTICATION_FAILED
AUTHENTICATION_RATE_LIMITED
RECOVERY_ACCEPTED
SESSION_REQUIRED
SESSION_EXPIRED
CSRF_REJECTED
ORIGIN_REJECTED
PREFERENCES_VERSION_CONFLICT
IDENTITY_SERVICE_UNAVAILABLE
```

Required audit actions and prohibited telemetry fields are frozen in
`docs/security/P2_S1_THREAT_MODEL.md`. Identity audit is service-owned business
evidence; safe logs do not substitute for it.

## P2-S2 frozen household backend API

All routes require the opaque account session. Mutations additionally require
CSRF and browser-origin checks. Create routes require `Idempotency-Key`.

| Route                                                                    | Contract                                                                           |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `POST /api/v1/households`                                                | create household; creator atomically becomes organizer                             |
| `GET /api/v1/households/{id}`                                            | active member reads household role/capabilities; inaccessible and absent are equal |
| `POST /api/v1/households/{id}/invitations`                               | invite one verified account as `caregiver` or `member`; raw token returned once    |
| `POST /api/v1/invitations/accept\|decline`                               | intended verified account consumes one digest-only token                           |
| `POST /api/v1/households/{id}/invitations/{invitationId}/resend\|revoke` | organizer-only, version checked and conflict/rate safe                             |
| `GET\|PUT /api/v1/households/{id}/recipient-context`                     | active member reads; organizer version-upserts minimum context                     |

Stable states are `pending|accepted|declined|expired|revoked`. Bounded errors
are `HOUSEHOLD_NOT_FOUND`, `HOUSEHOLD_CONFLICT`, `IDEMPOTENCY_CONFLICT`,
`INVITATION_ACCEPTED|DECLINED|EXPIRED|REVOKED`, and
`INVITATION_RATE_LIMITED`. Unauthorized, absent and inaccessible resources
share `404 HOUSEHOLD_NOT_FOUND`. Account scope alone is insufficient.
Unknown invitee login names receive the same pending projection backed by a
non-accepting decoy lifecycle; create and organizer management do not reveal
whether a verified account exists. Pending uniqueness is keyed by a keyed
invitee-dimension digest for both real and decoy invitations. A terminal token
may replay its result only inside its original expiry window; after that it is
indistinguishable from an inaccessible token.

## P2-S3 frozen consent, privacy, and audit API

All routes require the opaque account session. Mutations additionally require
CSRF, browser-origin checks and JSON. Grant/narrow/revoke commands require
`Idempotency-Key`; subject establishment is create-once/replay-safe under its
household lock, and privacy replacement is optimistic-versioned and atomic.
The browser supplies no internal actor identifier.

| Route                                                          | Contract                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/households/{id}/consent/subject`                 | explicitly bind the current account to a recipient context it created; never infer from organizer membership              |
| `GET /api/v1/households/{id}/consent`                          | subject-scoped overview with pseudonymous eligible recipients and current grants                                          |
| `POST /api/v1/households/{id}/consent/grants`                  | create one immediate, purpose-bound, versioned grant                                                                      |
| `POST /api/v1/households/{id}/consent/grants/{grantId}/narrow` | replace scopes with a non-empty strict subset                                                                             |
| `POST /api/v1/households/{id}/consent/grants/{grantId}/revoke` | end all new governed access at the server commit boundary                                                                 |
| `GET /api/v1/households/{id}/audit`                            | subject-scoped, redacted, bounded, read-only keyset history; no totals                                                    |
| `GET\|PATCH /api/v1/account/privacy`                           | read or atomically replace the three versioned privacy preferences                                                        |
| `GET /api/v1/households/{id}/recipient-context`                | legacy minimum projection before subject binding; after binding, the subject alone sees the complete minimum projection   |
| `GET /api/v1/households/{id}/recipient-context/scopes/{scope}` | fresh subject/grant decision for exactly one governed minimum field; collaborators receive only an actively granted scope |

The command review facts and mutation input are the same strict projection:

```json
{
  "action": "grant",
  "recipientRef": "member_pseudonymous",
  "purpose": "household_coordination",
  "scopes": ["recipient_context.basic_label"],
  "effectiveTime": {
    "mode": "immediate",
    "displayTimeZone": "Asia/Bangkok"
  },
  "expectedSubjectVersion": 1
}
```

`narrow` and `revoke` also require `expectedGrantVersion`. `narrow` accepts a
non-empty strict subset only. The server returns the actual UTC
`effectiveAt`; no client-selected backdate or scheduled time is accepted.
Commands serialize on one subject version. Same key and canonical intent
replay the original response; same key with changed intent returns
`IDEMPOTENCY_CONFLICT`. Stale versions return `CONSENT_VERSION_CONFLICT` with
recovery action `reload_current`.

Versioned transition events are
`identity.consent.granted.v1|narrowed.v1|revoked.v1`. They contain opaque IDs,
enumerated action/purpose/scopes, UTC effective time, versions, correlation and
causation only. They contain no labels, setting values, account identifiers,
idempotency material, cursors, credentials, or request copy.

The audit result contains `items` and optional `nextCursor`, never a total:

```json
{
  "items": [
    {
      "eventRef": "audit_opaque",
      "category": "consent.revoked",
      "actorAlias": "your_account",
      "redaction": "protected",
      "occurredAt": "2026-07-26T12:00:00.000Z",
      "displayTimeZone": "Asia/Bangkok",
      "outcome": "confirmed"
    }
  ],
  "nextCursor": null
}
```

The encrypted/authenticated cursor is bound to actor, subject, filters, and
boundary. The page limit is 1–25. Invalid/cross-scope cursors return
`AUDIT_CURSOR_INVALID`; absent and inaccessible household/subject/grant/audit
resources share `CONSENT_RESOURCE_NOT_FOUND`.

Privacy preferences are one atomic versioned record:

```json
{
  "profileVisibility": "private",
  "coordinationActivityVisibility": "hidden",
  "accessAlerts": true,
  "version": 1,
  "confirmedAt": "2026-07-26T12:00:00.000Z"
}
```

Stable P2-S3 codes are `CONSENT_VALIDATION_FAILED`,
`CONSENT_AUTHORITY_REQUIRED`, `CONSENT_RESOURCE_NOT_FOUND`,
`CONSENT_VERSION_CONFLICT`, `CONSENT_SCOPE_BROADENING_REJECTED`,
`IDEMPOTENCY_CONFLICT`, `AUDIT_CURSOR_INVALID`,
`PRIVACY_VERSION_CONFLICT`, and `IDENTITY_SERVICE_UNAVAILABLE`. Validation
errors no longer reuse `AUTHENTICATION_FAILED`.

## P3-S1 frozen daily timeline and handoff API

State: **Frozen for P3-S1 implementation** on 2026-07-26. P3 preserves the
accepted P2 governed-read contract; it does not infer consent from organizer or
member status and does not change any P2 consent-transition v1 event.

The real authority path is:

```text
browser session -> Gateway -> Identity fresh coordination decision
                -> Care Coordination -> Care-owned PostgreSQL
```

Identity grants `coordination.timeline.read` or
`coordination.task.handoff` directly to the established subject. A collaborator
requires active same-household membership, a current
`household_coordination` grant containing
`recipient_context.basic_label`, and the subject's
`coordinationActivityVisibility=household_only`. A handoff target must
independently satisfy that same boundary or be the subject. Role never
substitutes for consent or current assignment.

Identity's internal request-bound decision contains only opaque actor/subject/
grant/household/recipient references, permission, subject/grant/privacy
versions, decision time, correlation and request digest. Gateway validates and
forwards it; Gateway never creates authority. Care cross-checks the decision
against the locked task, household, recipient, current assignee and proposed
target.

### Daily timeline read

`GET /api/v1/households/{householdId}/timeline` accepts:

```text
localDate=YYYY-MM-DD
displayTimeZone=<validated IANA name>
filter=all|task_created|task_completed|task_handoff
limit=1..50
cursor=<optional sealed continuation>
```

The `P3-S1-v1` response returns the selected local date, validated zone,
inclusive `dayStartUtc`, exclusive `dayEndUtc`, exact filter, `snapshotAt`,
coverage start, at most the requested items and a nullable `nextCursor`.
It never returns a total, hidden count or page number. Items are ordered by
stored server UTC `occurredAt ASC`, then stable opaque `eventRef ASC`.

The authenticated cursor is bound to actor, household, recipient context,
date, zone, filter, last key and a hidden maximum timeline sequence. It expires
after 15 minutes. Continuations exclude later inserts, including
backward-clock inserts; refresh starts a new snapshot. Invalid, expired,
cross-scope or stale cursors return `TIMELINE_CURSOR_INVALID`. An unavailable
Identity or Care dependency is never represented as an authoritative empty
projection. No historical backfill is performed; dates before
`coverageStartedAt` are labelled `history_unavailable`.

Only the task title may carry human-entered text in this authorized,
`Cache-Control: no-store` read model. Descriptions and labels are excluded.
Title never enters cursor, audit, outbox, notification, log, metric or trace.

### Accountable task handoff

`GET /api/v1/households/{householdId}/tasks/{taskId}/handoff` returns the
current confirmed task/version, current accountable actor reference and a
bounded list of Identity-authorized target references with safe display keys.

`POST /api/v1/households/{householdId}/tasks/{taskId}/handoffs` requires a
browser-origin/CSRF check and `Idempotency-Key`:

```json
{
  "operation": "handoff",
  "expectedTaskVersion": 3,
  "expectedFromActorRef": "actor_current",
  "toActorRef": "actor_proposed",
  "reasonCode": "availability_changed",
  "effectiveTime": {
    "mode": "immediate",
    "displayTimeZone": "Asia/Bangkok"
  }
}
```

Reason values are `availability_changed|schedule_conflict|coverage_update|
other_coordination`; no free-form context exists. Canonical intent includes
the route household/task, from/to references, expected version, reason and
effective mode. Same key and same complete intent replays the original durable
result for 24 hours. Same key with any changed intent returns
`IDEMPOTENCY_CONFLICT`.

Care locks the task and requires: matching governed decision; matching
household/recipient; caller equals current assignee and expected from actor;
distinct authorized target; `open` state; exact task version. It rejects
cross-household, unauthorized, inactive, self/no-op, stale, completed and any
future cancelled state without broadening access. Cancellation is not a
P3-S1 command and the accepted task schema currently has no cancelled producer.

One transaction updates assignee/version and appends immutable handoff/timeline
evidence, privacy-minimized audit, idempotency result and
`care.task.handed_off.v1` outbox evidence. The event carries opaque IDs,
enumerated reason/outcome, aggregate version, server `occurredAt` and
`effectiveAt`, correlation/causation and notification disposition only. It has
no task title/description, label, free text, cursor or idempotency material.
The UI confirms only the returned durable task/handoff state. Notification
delivery is a separate truthful state.

Stable P3-S1 errors are `COORDINATION_RESOURCE_NOT_FOUND`,
`COORDINATION_AUTHORITY_REQUIRED`, `TIMELINE_VALIDATION_FAILED`,
`TIMELINE_CURSOR_INVALID`, `HANDOFF_VALIDATION_FAILED`,
`HANDOFF_VERSION_CONFLICT`, `HANDOFF_STATE_CONFLICT`,
`IDEMPOTENCY_CONFLICT`, `IDENTITY_SERVICE_UNAVAILABLE` and
`SERVICE_UNAVAILABLE`. Generic inaccessible/absent states share the same
resource response and expose no membership, recipient, actor, event or count.

## P3-S2 frozen calendar, appointment and reminder-intent API

State: **Frozen for P3-S2 implementation** on 2026-07-27. Version:
`P3-S2-v1`. This contract consumes the accepted P3-S1 UTC/IANA/local-day
representation through explicit schemas. It does not infer appointment
authority from a role, route, prior decision, event or browser state.

Identity issues a fresh request-digest/correlation-bound decision for exactly
one of:

```text
coordination.calendar.read
coordination.appointment.create
coordination.appointment.change
coordination.appointment.cancel
```

The established subject may act directly. A collaborator requires active
same-household membership, a current `household_coordination` grant containing
`recipient_context.basic_label`, and the subject's current
`coordinationActivityVisibility=household_only`. This explicit P3-S2 mapping
authorizes only the structured facts below. Organizer/member/caregiver status
never substitutes for consent. Gateway composes and propagates the normalized
intent; Care verifies the fresh decision, household, recipient context,
permission, correlation and request digest again.

All mutation routes require the accepted session, synchronizer CSRF token,
exact Origin/Fetch Metadata checks and `Idempotency-Key`. Same key plus the
same complete canonical intent replays the original durable response for 24
hours. Reuse with any changed route, operation, scope, version, schedule,
logistics or reminder value returns `IDEMPOTENCY_CONFLICT`.

### Time and recurrence contract

Commands use:

```text
localStart: YYYY-MM-DDTHH:mm
sourceTimeZone: validated IANA name
sourceUtcOffset: ±HH:MM
durationMinutes: 15..480
ambiguousTimePolicy: earlier|later
recurrence:
  { frequency: none }
  OR
  { frequency: weekly, intervalWeeks: 1..4, occurrenceCount: 2..12 }
```

Care resolves every concrete occurrence. A nonexistent spring-forward local
time is rejected. An overlap uses the explicit earlier/later policy; the
submitted offset must match the resolved first occurrence. Weekly recurrence
preserves source local wall time and IANA zone while each materialized
occurrence stores its confirmed UTC instant and numeric offset. There is no
infinite rule, `UNTIL`, arbitrary RRULE, “this and following”, implicit
series split or external-calendar synchronization in v1.

Every UTC instant returned or placed in an event is canonical millisecond
`Z`. Conflict intervals are half-open: existing and candidate appointments
overlap only when `existing.start < candidate.end` and
`candidate.start < existing.end`; adjacent appointments are allowed.

### Calendar and equivalent agenda read

`GET /api/v1/households/{householdId}/calendar` accepts:

```text
localDate=YYYY-MM-DD
displayTimeZone=<validated IANA name>
status=all|scheduled|cancelled
```

The response contains the selected local date, validated display zone,
inclusive `dayStartUtc`, exclusive `dayEndUtc`, exact filter, `snapshotAt` and
at most 100 appointments overlapping that day. A denser day returns an
explicit unavailable/density error rather than truncating or fabricating an
empty result. Items are ordered by `(startsAtUtc, appointmentId)` and expose:

- structured appointment kind and logistics mode only;
- status `scheduled|cancelled`, last change `created|changed|cancelled` and
  optimistic version;
- canonical UTC start/end, source local start, source numeric offset and source
  IANA zone;
- recurrence frequency, interval, occurrence number/count, inclusive final
  local date and the fixed `occurrence_only` change/cancel boundary;
- reminder intent `not_requested|recorded|cancelled`, enumerated lead time and
  the explicit statement that delivery is not claimed;
- created/last-confirmed server instants.

The authorized calendar and semantic agenda consume the same item projection.
There are no titles, descriptions, addresses, URLs, attendees, notes, totals,
hidden counts or browser-selected authority. Cancelled occurrences remain
visible.

`GET /api/v1/households/{householdId}/appointments/{appointmentId}` returns the
same confirmed item shape. Missing, denied and cross-scope results share
`COORDINATION_RESOURCE_NOT_FOUND`.

### Create, change and cancel

`POST /api/v1/households/{householdId}/appointments` accepts:

```json
{
  "operation": "create_appointment",
  "appointmentKind": "household_coordination",
  "logisticsMode": "unspecified",
  "schedule": {
    "localStart": "2026-11-01T09:00",
    "sourceTimeZone": "America/New_York",
    "sourceUtcOffset": "-05:00",
    "durationMinutes": 60,
    "ambiguousTimePolicy": "later",
    "recurrence": {
      "frequency": "weekly",
      "intervalWeeks": 1,
      "occurrenceCount": 4
    }
  },
  "reminder": {
    "leadMinutes": 60
  }
}
```

`PATCH /api/v1/households/{householdId}/appointments/{appointmentId}` accepts a
complete occurrence replacement with:

```text
operation=change_appointment
scope=occurrence
expectedVersion=<positive integer>
appointmentKind
logisticsMode
schedule without recurrence
reminder.leadMinutes=null|15|60|1440
```

The original series definition and other occurrences do not change.

`POST /api/v1/households/{householdId}/appointments/{appointmentId}/cancel`
accepts:

```text
operation=cancel_appointment
scope=occurrence
expectedVersion=<positive integer>
reasonCode=no_longer_needed|schedule_changed|duplicate|other_coordination
```

Cancellation is durable history, never deletion. A cancelled occurrence cannot
be changed or cancelled again. Create/change conflict checks serialize per
recipient context and reject the first deterministic conflicting interval,
ordered by `(startsAtUtc, appointmentId)`, without disclosing another
appointment's details.

One Care-owned PostgreSQL transaction writes the appointment/occurrences,
immutable transition, privacy-minimized audit, digest-only idempotency response
and any required reminder-intent outbox row. The UI confirms only the returned
durable result. A transport/5xx after mutation is uncertain: do not mint a new
key or retry blindly; read confirmed current state first.

### Notification-facing reminder intent

`care.appointment.reminder_intent.v1` is the only P3-S2 event delivered to
Notification. Each event represents one concrete appointment occurrence and
contains:

```text
event/aggregate version, occurredAt, correlation and causation
appointmentId
disposition=schedule|cancel
recipientId
remindAtUtc and startsAtUtc only for schedule
messageKey=notifications.appointment.reminder
```

It never contains household/recipient labels, appointment kind/logistics,
local time, zone, recurrence, conflict, cancellation reason, title, note,
address, URL, attendee, cursor, idempotency material or free text.
Notification stores/upserts one structured reminder intent per appointment and
returns `scheduled|cancelled|duplicate`; this is durable receipt, not a claim
that a notification was sent. A Notification outage never rolls back a
confirmed Care appointment.

Stable P3-S2 errors are `APPOINTMENT_VALIDATION_FAILED`,
`APPOINTMENT_LOCAL_TIME_INVALID`, `APPOINTMENT_RECURRENCE_INVALID`,
`CALENDAR_RANGE_TOO_DENSE`, `COORDINATION_RESOURCE_NOT_FOUND`,
`APPOINTMENT_VERSION_CONFLICT`, `APPOINTMENT_STATE_CONFLICT`,
`APPOINTMENT_TIME_CONFLICT`, `IDEMPOTENCY_KEY_REQUIRED`,
`IDEMPOTENCY_CONFLICT`, `IDENTITY_SERVICE_UNAVAILABLE`,
`APPOINTMENT_RESULT_UNKNOWN`, `SERVICE_UNAVAILABLE` and
`INTERNAL_CONTRACT_INVALID`.

## P3-S3 versioned support-plan contract (`P3-S3-v1`)

Every route is `Cache-Control: no-store`. Gateway requests a fresh Identity
decision before every read, history page, version detail, draft save, or
confirmation. The decision is bound to normalized route intent, household,
correlation, subject, and current grant/privacy versions. Permissions are
`coordination.care_plan.read`, `coordination.care_plan.history.read`,
`coordination.care_plan.draft.save`, and
`coordination.care_plan.version.confirm`. Organizer/member status alone never
authorizes access. Care accepts decisions no older than ten seconds and no more
than two seconds in the future and validates every responsibility actorRef
against the fresh eligible set.

`GET /api/v1/households/{householdId}/care-plan` returns `state=no_plan` for an
authorized absence. Otherwise it independently exposes `current|null`,
`draft|null`, `aggregateRevision`, `coverageStartedAt`, server time,
`reviewState=not_applicable|upcoming|due_today|overdue`, and `requiresReview`.
A current version may coexist with a draft. Draft revision, base current
version, and confirmed plan version are never presented as the same counter.

`PUT /api/v1/households/{householdId}/care-plan/draft` accepts a strict complete
replacement with `operation=save_care_plan_draft`, expected aggregate/draft/base
versions, zero to ten ordered goals/preferences/responsibilities, and nullable
`reviewLocalDate` plus IANA `reviewTimeZone`. Each item has a category enum and
a trimmed single-line coordination statement of at most 160 Unicode
characters; a responsibility also has one currently eligible `actorRef`.
Drafts may be incomplete and return publication readiness, never false current
state. A fresh read projects an eligible responsibility actor explicitly or
returns `authorization_changed` without the stale actorRef; reconfirmation stays
blocked until an authorized draft replacement selects an eligible actor.

`POST /api/v1/households/{householdId}/care-plan/current` accepts only
`operation=confirm_care_plan_version` plus expected aggregate, draft, and base
current counters. Confirmation requires at least one goal, one responsibility,
a valid non-past review date, and all responsibility actors to remain eligible.
It creates the next immutable plan version, advances the current pointer, and
clears the draft atomically. Mutation responses contain minimum safe facts;
the UI performs a fresh read for authoritative content.

The review date is a local calendar date. Care stores the validated IANA zone
and resolved inclusive `reviewDayStartUtc` and exclusive `reviewDayEndUtc`;
confirmed versions copy those facts so tzdb updates cannot move history. A
zero-length/skipped date is invalid. Due/overdue is derived from server time and
never mutates the version.

`GET .../care-plan/history?limit=1..25&cursor=` returns confirmed versions only
in `(planVersion DESC)` order. `GET .../care-plan/versions/{version}` returns
one authorized bounded version. Sealed cursors bind viewer, household,
recipient, P2 versions, maximum visible version, last version, limit, and
expiry; no total, hidden count, or page number is exposed. An ineligible former
responsibility is projected as `authorization_changed` without actorRef.

Only confirmation emits `care.care_plan.version_confirmed.v1`, with content-free
payload `{ outcome: confirmed, deliveryDisposition: none }`, stored as
suppressed/no-delivery evidence. Draft saves emit no cross-service event.
Stable errors are `CARE_PLAN_VALIDATION_FAILED`,
`CARE_PLAN_REVIEW_DATE_INVALID`, `CARE_PLAN_VERSION_CONFLICT`,
`CARE_PLAN_STATE_CONFLICT`, `CARE_PLAN_CURSOR_INVALID`,
`CARE_PLAN_RESULT_UNKNOWN`, `COORDINATION_RESOURCE_NOT_FOUND`,
`COORDINATION_AUTHORITY_REQUIRED`, `IDEMPOTENCY_KEY_REQUIRED`,
`IDEMPOTENCY_CONFLICT`, `IDENTITY_SERVICE_UNAVAILABLE`,
`SERVICE_UNAVAILABLE`, and `INTERNAL_CONTRACT_INVALID`. There is no offline
queue or blind retry.

V1 rejects diagnosis, condition, treatment, dosage, medication, urgency,
recommendation, address, URL, contact, attachment, HTML/Markdown objects,
arbitrary metadata, and clinical workflow. Product copy uses “Kế hoạch hỗ trợ /
Support plan”; internal routes retain `care-plan`.

## P4-S1 medication reminder acknowledgement contract (`P4-S1-v1`)

`P4-S1-v1` is a non-clinical coordination contract. Care Coordination owns
user-provided reminder schedule facts. Notification owns generic in-app
delivery evidence and immutable acknowledgement that a reminder was seen.
Identity & Consent makes a fresh decision for every operation; Gateway stores
no reminder state and composes only owner responses.

Permissions are exact and non-substitutable:

```text
coordination.medication_reminder.read
coordination.medication_reminder.create
coordination.medication_reminder.change
coordination.medication_reminder.disable
notification.medication_reminder.read
notification.medication_reminder.acknowledge
```

Membership, organizer capability, a prior decision, and client state never
authorize one of these actions. Each decision binds actor, household,
recipient context, permission, normalized request digest, correlation and the
current subject/grant/privacy versions for at most ten seconds. The
Notification recipient is the authorized creating actor in v1; the client
cannot target another account.

The strict Care command contains only:

```text
operation: create_medication_reminder | change_medication_reminder
expectedVersion: positive integer (change only)
medicationLabel: one trimmed single line, 1..80 characters, Care-only
amount: exact positive decimal string, 0.001..999.999, at most 3 decimals
unit: tablet | capsule | millilitre | drop | puff | patch | application | unit | other
otherUnitLabel: one trimmed single line, 1..24 characters, only with other
schedule.localStart: YYYY-MM-DDTHH:mm
schedule.sourceTimeZone: canonical IANA name
schedule.sourceUtcOffset: explicit +/-HH:MM
schedule.ambiguousTimePolicy: null | earlier | later
schedule.recurrence:
  { frequency: none }
  { frequency: daily, intervalDays: 1..7, occurrenceCount: 2..31 }
  { frequency: weekly, intervalWeeks: 1..4, occurrenceCount: 2..12 }
```

Disable is `{ operation: "disable_medication_reminder", expectedVersion }`.
Unknown fields are rejected. The decimal and unit are repeated exactly as
user-provided facts; they are never converted, defaulted, calculated or
described as a recommended dose. Diagnosis, indication, route, instructions,
notes, treatment, urgency, adherence, missed-dose advice and arbitrary
metadata are not contract fields.

Care resolves a finite occurrence set on the server. Gaps are invalid;
overlaps require `earlier` or `later` plus the matching explicit offset;
ordinary local times require `ambiguousTimePolicy: null`. Every occurrence
stores the source local minute, named IANA zone, resolved numeric offset,
canonical millisecond UTC instant, stable occurrence number/count and final
local date. Change creates a new schedule version and new stable occurrence
identities. Prior delivered or acknowledged Notification evidence remains
immutable.

Public operations are:

```text
GET  /api/v1/households/{householdId}/medication-reminders
GET  /api/v1/households/{householdId}/medication-reminders/{reminderId}
POST /api/v1/households/{householdId}/medication-reminders
PUT  /api/v1/households/{householdId}/medication-reminders/{reminderId}
POST /api/v1/households/{householdId}/medication-reminders/{reminderId}/disable
GET  /api/v1/notifications/medication-reminders?householdId={householdId}
POST /api/v1/notifications/medication-reminders/{occurrenceId}/acknowledgements
```

Care emits `care.medication_reminder.intent.v1` schedule/cancel intents. The
payload is minimum structured delivery input: opaque reminder, occurrence,
household, recipient-context and recipient account identifiers; occurrence
version; scheduled UTC; source local minute/IANA/offset; fixed message key;
correlation and causation. It excludes medication label, amount, unit, grant,
decision body, idempotency key and free text.

Notification projects intent and delivery separately:

```text
intentState: pending | cancelled
deliveryState: pending | uncertain | delivered | failed | missed | cancelled
deliveryEvidence: none | in_app_persisted
acknowledgementState: unacknowledged | seen
acknowledgementResult: available | recorded | duplicate
```

`delivered` requires an atomically persisted in-app item. Intent receipt is not
delivery. `missed` means the fixed delivery window expired without authoritative
delivery evidence and says nothing about medication use. `failed` and
`uncertain` are durable non-success facts. Reconciliation may resolve uncertain
state but cannot erase attempts or fabricate success. Acknowledgement is
allowed only for a delivered item and means only "reminder seen"; it never
means taken, skipped, adherent or clinically safe.

The acknowledgement command is
`{ operation: "acknowledge_medication_reminder", expectedVersion }` plus an
`Idempotency-Key`. Same key and digest returns the original result; changed
intent with a reused key is `409 IDEMPOTENCY_CONFLICT`. Concurrent attempts
produce one immutable acknowledgement. Later attempts return the original
timestamp as `duplicate` and create no second acknowledgement/audit/outbox.
Changed state/version conflicts are explicit. A client timeout or 5xx is
unknown outcome: perform a fresh read and never retry blindly or with a new
key. Offline mutation is blocked and never queued.

Owner-local state, redacted audit, digest-only idempotency and outbox evidence
commit atomically. Denied and absent resources use the same bounded response.
Lists are bounded and expose no hidden totals. Primary errors include
`MEDICATION_REMINDER_VALIDATION_FAILED`, `MEDICATION_REMINDER_LOCAL_TIME_INVALID`,
`MEDICATION_REMINDER_RECURRENCE_INVALID`, `MEDICATION_REMINDER_VERSION_CONFLICT`,
`MEDICATION_REMINDER_STATE_CONFLICT`, `MEDICATION_REMINDER_RESULT_UNKNOWN`,
`MEDICATION_NOTIFICATION_UNAVAILABLE`, `MEDICATION_DELIVERY_STATE_CONFLICT`,
`MEDICATION_ACKNOWLEDGEMENT_VERSION_CONFLICT`,
`MEDICATION_ACKNOWLEDGEMENT_STATE_CONFLICT`, `COORDINATION_AUTHORITY_REQUIRED`,
`IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `SERVICE_UNAVAILABLE` and
`INTERNAL_CONTRACT_INVALID`.

## P4-S2 emergency readiness contract (`P4-S2-v1`)

Care Coordination owns one emergency-readiness aggregate for each
household/recipient context. Identity & Consent makes a fresh exact-purpose
decision for every online operation. Gateway composes owner responses and
stores no contact, plan, consent, or offline-copy state. Notification is not
involved.

Permissions are exact and non-substitutable:

```text
coordination.emergency_contacts.read
coordination.emergency_contacts.replace
coordination.emergency_contacts.history.read
coordination.emergency_plan.read
coordination.emergency_plan.draft.save
coordination.emergency_plan.version.review
coordination.emergency_plan.history.read
coordination.emergency_plan.offline_snapshot.read
```

The mapping is frozen as `P4-S2-v1`. Organizer/member/caregiver role, route
access, an earlier decision, an event, or possession of an offline copy never
creates authority. A collaborator needs active same-household membership plus
the current P2 `household_coordination` grant containing
`recipient_context.basic_label` and `coordinationActivityVisibility =
household_only`. Each decision binds actor, household, recipient, exact
permission, normalized request digest, correlation, and current subject/grant/
privacy versions for at most ten seconds. Care revalidates every bound fact
before any read or write. Local device purge is always permitted without
online authority.

The public surface is:

```text
GET  /api/v1/households/{householdId}/emergency-contacts
PUT  /api/v1/households/{householdId}/emergency-contacts
GET  /api/v1/households/{householdId}/emergency-contacts/history
GET  /api/v1/households/{householdId}/emergency-plan
PUT  /api/v1/households/{householdId}/emergency-plan/draft
POST /api/v1/households/{householdId}/emergency-plan/reviews
GET  /api/v1/households/{householdId}/emergency-plan/history
GET  /api/v1/households/{householdId}/emergency-plan/offline-snapshot
```

Contact replacement is a complete ordered command:

```text
operation: replace_emergency_contacts
expectedListRevision: non-negative integer
contacts: 0..10 items in exact projected order
contacts[].contactId: existing opaque ID or omitted for a new item
contacts[].expectedVersion: positive integer for an existing item, otherwise omitted
contacts[].displayLabel: trimmed single line, 1..60 characters
contacts[].dialString: optional leading + followed by 3..15 digits
```

Unknown fields, duplicate IDs, non-contiguous order, control characters, markup
objects, email, address, location, notes, availability, organization,
professional/legal role, clinical data, and arbitrary metadata are rejected.
The submitted array is the whole list; create/change/reorder/remove therefore
commit as one optimistic revision or not at all. The response contains only
outcome, list revision, opaque item IDs/versions, and server-confirmed UTC.
Values are returned only by a new authorized read. History is reverse-revision
ordered, bounded 1..25, cursor-sealed, content-free, and exposes no total,
removed values, hidden count, actor, or consent body.

Plan states are `no_plan`, `draft_only`, `reviewed`, and `review_required`.
Draft save is:

```text
operation: save_emergency_plan_draft
expectedAggregateRevision: non-negative integer
expectedDraftRevision: non-negative integer
basePlanVersion: non-negative integer
contactListRevision: non-negative integer
steps: 1..8 ordered items, each a trimmed single line of 1..160 characters
```

Review is:

```text
operation: review_emergency_plan_version
expectedAggregateRevision: non-negative integer
expectedDraftRevision: positive integer
basePlanVersion: non-negative integer
contactListRevision: positive integer
displayTimeZone: canonical IANA name
```

Review requires at least one current contact and exact draft/base/contact
revisions. It creates one immutable participant-reviewed, server-confirmed
version, clears the draft, and records server UTC plus server-derived local
display, numeric offset, and IANA facts. It is not professional approval.
Later contact replacement makes the plan `review_required`; a new offline
snapshot is unavailable until the participant reviews the plan against the new
contact revision. `no_plan` is an authorized `200` state, never an error or a
dependency fallback. History is reverse-version ordered, bounded, sealed,
content-free, and exposes no total; protected steps appear only in the current
read.

The online snapshot endpoint returns one transactionally consistent projection
only when the reviewed plan remains bound to the current contact revision:

```text
contractVersion: P4-S2-offline-v1
source: care-coordination
planVersion
contactListRevision
reviewedAtUtc
lastConfirmedAtUtc
displayTimeZone
displayLocalTime
displayUtcOffset
freshUntilUtc: lastConfirmedAtUtc + 24 hours
expiresAtUtc: lastConfirmedAtUtc + 72 hours
contacts: position, displayLabel, dialString
steps: position, text
```

It excludes drafts, history, actor/grant/subject identifiers, authority bodies,
audit, item versions, hidden counts, arbitrary metadata, and any claim of live
availability. The response remains `Cache-Control: no-store`. The browser may
persist only the ADR-025 encrypted snapshot; the service worker may persist
only the non-sensitive shell. At every offline age the UI says the copy is not
live and that current permission and updates cannot be checked. Up to 24 hours
is `offline_recent`; over 24 through 72 hours is `offline_stale`; after 72
hours is `freshness_expired`, content is hidden, and ciphertext is purged.
Backward or invalid device time is `freshness_unknown` and never “recent.”
Every offline write/action is blocked, not queued, replayed, or submitted on
reconnect.

Contact replacement, draft save, and version review require an
`Idempotency-Key`. Same key and digest returns the original content-free
response; changed intent is `409 IDEMPOTENCY_CONFLICT`. Contact/plan state,
content-free transition, redacted audit, digest-only replay, and content-free
suppressed outbox evidence commit atomically. Events are:

```text
care.emergency_contacts.changed.v1
care.emergency_plan.version_reviewed.v1
```

They contain only opaque aggregate/version facts, action/outcome, correlation/
causation, and `deliveryDisposition=none`; never contact values, plan text,
contact count, consent body, passphrase, cache metadata, or idempotency
material. Notification does not consume them.

Stable errors are `EMERGENCY_CONTACT_VALIDATION_FAILED`,
`EMERGENCY_CONTACT_LIST_VERSION_CONFLICT`,
`EMERGENCY_CONTACT_VERSION_CONFLICT`, `EMERGENCY_PLAN_VALIDATION_FAILED`,
`EMERGENCY_PLAN_AGGREGATE_CONFLICT`, `EMERGENCY_PLAN_DRAFT_CONFLICT`,
`EMERGENCY_PLAN_CONTACTS_CHANGED`, `EMERGENCY_PLAN_REVIEW_REQUIRED`,
`EMERGENCY_PLAN_STATE_CONFLICT`, `EMERGENCY_RESULT_UNKNOWN`,
`COORDINATION_RESOURCE_NOT_FOUND`, `COORDINATION_AUTHORITY_REQUIRED`,
`IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`,
`IDENTITY_SERVICE_UNAVAILABLE`, `SERVICE_UNAVAILABLE`, and
`INTERNAL_CONTRACT_INVALID`. A timeout or 5xx after mutation is an unknown
outcome: perform a fresh authorized read and never retry blindly or with a new
key.

## P4-S3 access-controlled document-vault contract (`P4-S3-v1`)

### Authority

Identity & Consent owns the exact-purpose decision. `document_vault.access` is
an additive `household_coordination` consent scope and is never backfilled into
an existing grant. Household organizer/member status and
`recipient_context.basic_label` never imply document authority. The self-bound
subject may act directly; another active member needs a current matching grant
containing `document_vault.access` and current subject visibility.

Every online operation requires one fresh, request-bound decision with one of:

```text
coordination.document_vault.list
coordination.document_vault.upload
coordination.document_vault.metadata.read
coordination.document_vault.content.download
coordination.document_vault.delete
```

All decisions bind actor, household, recipient, permission, request digest,
correlation, subject/grant/privacy versions and a maximum ten-second validity.
Metadata/download/delete also bind the exact opaque `documentId`; list/upload
prohibit it. Care rejects expired, wrong-purpose, wrong-resource, stale,
unbound or malformed decisions before accessing document rows or bytes.

### Gateway commands and reads

```text
GET    /api/v1/households/:householdId/documents
POST   /api/v1/households/:householdId/documents
GET    /api/v1/households/:householdId/documents/:documentId
GET    /api/v1/households/:householdId/documents/:documentId/content
DELETE /api/v1/households/:householdId/documents/:documentId
```

Upload requires CSRF, `Idempotency-Key`, a client-generated opaque
`uploadReference`, advisory `fileName`, declared `text/plain`, exact
`decodedSizeBytes`, and canonical base64 `contentBase64`. Decoded content must
be 1–262,144 bytes, strict UTF-8 text, and use a final `.txt` extension. Care
independently sanitizes the display basename, decodes and measures content,
rejects path/control/bidi/CRLF and prohibited content controls, computes
SHA-256, generates randomized document/object IDs and persists the binding in
one transaction. Maximum active capacity is 25 documents per recipient.

Delete requires CSRF, `Idempotency-Key`, `expectedVaultVersion`, and
`expectedDocumentVersion`. Upload and delete serialize on the vault and use
optimistic versions. The same key and canonical intent replay the stored
result; a changed intent returns `IDEMPOTENCY_CONFLICT`. A stale expected
version returns a bounded conflict without applying a mutation; the browser
then obtains a new authorized vault projection before another review.

The list is a complete, bounded projection ordered by confirmation time and
opaque ID. It includes `uploadReference` for uncertain-result reconciliation.
Public metadata is limited to opaque document/upload IDs, sanitized display
name, verified type and exact byte size, processing/scanner/malware states,
access/retention policy keys, versions, and server confirmation times. It
excludes content, storage keys, digests, object bindings, raw headers,
actor/subject/grant identifiers, hidden totals and download URLs.

### Processing, retrieval and deletion

Authoritative processing states are `processing`, `ready_unscanned`,
`rejected`, `failed`, and `integrity_failed`. A successful upload is:

```text
processingState: ready_unscanned
scannerStatus: not_configured
malwareStatus: not_scanned
processingEvidence: strict_text_and_integrity_validation
accessPolicy: care_recipient_and_current_document_collaborators
retentionPolicy: retained_until_explicit_delete
```

This is not a clean, safe, reviewed, clinical-integrity or suitability claim.
Only `ready_unscanned` is downloadable. Before returning bytes, Care
recomputes the digest and verifies document/household/recipient/object/size/
version binding. A mismatch atomically removes active bytes, records
`integrity_failed` evidence and fails closed.

The content response is `application/octet-stream`, attachment-only with an
RFC 6266 sanitized advisory filename, `X-Content-Type-Options: nosniff`,
`Content-Security-Policy: sandbox`, and `Cache-Control: no-store`. It is never
inline content, preview, viewer, signed URL or trusted active render.

Deletion has no product undo, legal hold or server restore. It atomically
removes active bytes, filename, digest, binding and readable metadata. An
opaque content-free transition, tombstone, audit record, suppressed outbox
fact, invalidated content-free upload replay marker, and bounded delete replay
result remain. Reusing the deleted upload's old key conflicts and cannot
resurrect it. Recovery means selecting and re-uploading an original local
file.

### Events, failures and offline boundary

Owner-local events are `care.document.upload_accepted.v1`,
`care.document.processing_state_changed.v1`, and
`care.document.removed.v1`. Payloads contain only opaque aggregate/event IDs,
schema/version/correlation and timestamps; no bytes, filename, type, size,
digest, object key, actor, subject or grant. Notification is not a consumer.

Stable errors are `DOCUMENT_VALIDATION_FAILED`,
`DOCUMENT_TYPE_UNSUPPORTED`, `DOCUMENT_TOO_LARGE`,
`DOCUMENT_CONTENT_REJECTED`, `DOCUMENT_PROCESSING_PENDING`,
`DOCUMENT_PROCESSING_FAILED`, `DOCUMENT_INTEGRITY_FAILED`,
`DOCUMENT_VERSION_CONFLICT`, `DOCUMENT_VAULT_CONFLICT`,
`DOCUMENT_CAPACITY_REACHED`, `DOCUMENT_RESULT_UNKNOWN`,
`COORDINATION_RESOURCE_NOT_FOUND`, `COORDINATION_AUTHORITY_REQUIRED`,
`IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`,
`IDENTITY_SERVICE_UNAVAILABLE`, `DOCUMENT_STORAGE_UNAVAILABLE`,
`SERVICE_UNAVAILABLE`, and `INTERNAL_CONTRACT_INVALID`.

Denied and missing are intentionally indistinguishable before protected state
access. Storage/scanner unavailability is never an empty vault or clean claim.
A timeout, cancellation or ambiguous 5xx result is uncertain: perform a fresh
authorized list/status read with the same upload/idempotency context and never
retry blindly or with a new key. Offline mode stores and reveals no document
metadata or bytes and queues, replays or auto-submits no operation.

## P5-S1 Community request and public-directory contract (`P5-S1-v1`)

The language-neutral source is `contracts/community/p5-s1-v1/openapi.json`
plus the JSON Schemas and frozen `SHA256SUMS` beside it. Node Gateway consumer
tests and Spring Community provider tests verify the same bytes and fixed
request-digest vectors; neither language copy owns the contract.

### Public directory read

```text
GET /api/v1/community
  -> GET /internal/v1/community/directory
```

The public path accepts only optional allowlisted category, province/city code
and `public_service | nonprofit | community_group` filters. Search is
parameterized PostgreSQL, limited to 25 and ordered by public name then opaque
listing ID. Gateway does not call Identity or forward cookies, CSRF,
household, subject, grant, request or protected filter facts. A listing exposes
only its opaque ID, public organization name/type, reviewed province/city
service area, bounded categories, organization-published contact channel,
optional enumerated accessibility-contact note, source label/URL, review
times, `current | stale` provenance, `not_verified` availability,
`not_determined` eligibility and `none` endorsement. Unavailable search is not
an empty result.

Gateway may cache a public response for five minutes. The browser may retain
one identity-free response in `sessionStorage` for at most 24 hours and must
label it offline/stale with source, review and cache times. Protected request
or household state never enters that cache.

### Protected request operations

```text
POST   /api/v1/households/:householdId/community/help-requests/query
POST   /api/v1/households/:householdId/community/help-requests
POST   /api/v1/households/:householdId/community/help-requests/reconcile
POST   /api/v1/households/:householdId/community/help-requests/:requestId/close
DELETE /api/v1/households/:householdId/community/help-requests/:requestId
```

Each operation requests one fresh Identity decision for purpose
`community_support`, scope `community_help_request.access` and exactly one of
`community.help_request.list`, `submit`, `reconcile`, `close` or `delete`.
Organizer/member status never implies consent or subject authority. Decisions
bind opaque actor/subject/household/recipient/grant references, permission,
current versions, decision time, correlation ID and request digest for at most
ten seconds. Community rejects malformed, expired, future, wrong-purpose,
wrong-permission, wrong-target, wrong-correlation or wrong-digest decisions
before protected state access.

The lowercase SHA-256 request digest covers UTF-8 bytes of uppercase method,
newline, exact concrete internal path, newline and canonical body. Canonical
JSON is minified, recursively key-sorted, array-order preserving and `{}` for
bodyless input. The frozen Node/Java vectors prevent serializer or platform
newline drift.

Submit accepts only:

```text
submissionReference: opaque client reference
category: daily_living_support | transport_coordination | household_errand |
  social_connection | digital_access | accessibility_support
location: { granularity: province_city, provinceCityCode }
dayPart: flexible | morning | afternoon | evening | null
disclosure:
  purpose: community_support
  visibility: current_request_collaborators
  policyVersion: P5-S1-v1
  confirmed: true
```

No free text, diagnosis, treatment, medication, urgency, eligibility reason,
precise time/location/GPS, attachment, organization or matching preference,
or unknown field is accepted. The lifecycle is `pending -> closed -> deleted`.
`submitted` is a confirmed command outcome only; `pending` makes no review,
queue, match, acceptance, availability, delivery, safety, eligibility or
completion claim. Matching remains `unavailable_in_p5_s1`.

Submit, close and delete require `Idempotency-Key`. Community stores only its
digest for 24-hour replay. Same actor, operation, key, route and canonical
intent returns the original authoritative result; changed intent returns
`IDEMPOTENCY_CONFLICT`. `submissionReference` supports fresh-authority
reconciliation after an uncertain submit. One pending recipient/category/
province-city/day-part tuple is allowed. Close/delete require exact
`expectedVersion`; stale or changed state fails without a write.

First use of the same actor/operation/key/route is serialized by a transaction-
scoped PostgreSQL advisory lock before the replay row is read or created.
Every replay row also carries only the digest of its aggregate reference.
Explicit deletion or retention purge invalidates all earlier submit/close
replays for that aggregate before retaining only the new minimal delete replay,
so an old successful response cannot resurrect protected request fields.

Pending requests auto-close after 30 days. Closed protected fields purge
within 30 additional days; explicit delete purges them immediately and leaves
a digest-only tombstone. Content-free audit/tombstone/outbox evidence is
bounded to 365 days. Submit/close/delete commits aggregate, privacy-safe audit,
idempotency and suppressed outbox atomically. Event types are:

```text
community.help_request.submitted.v1
community.help_request.closed.v1
community.help_request.deleted.v1
```

Events contain only opaque aggregate/event references, version, enumerated
lifecycle outcome, UTC time, correlation/causation and
`suppressed_not_configured`; they never claim queueing, delivery, notification
or matching. Aggregate versions remain monotonic through explicit delete and
scheduled auto-close/purge, and `(aggregateId, aggregateVersion)` is unique in
the owned outbox.

Stable failures are `COMMUNITY_REQUEST_VALIDATION_FAILED`,
`COMMUNITY_REQUEST_DUPLICATE`, `COMMUNITY_REQUEST_VERSION_CONFLICT`,
`COMMUNITY_REQUEST_STATE_CONFLICT`, `COMMUNITY_REQUEST_RESULT_UNKNOWN`,
`COMMUNITY_RESOURCE_NOT_FOUND`, `COMMUNITY_AUTHORITY_REQUIRED`,
`COMMUNITY_CONSENT_REVOKED`, `IDEMPOTENCY_KEY_REQUIRED`,
`IDEMPOTENCY_CONFLICT`, `DIRECTORY_VALIDATION_FAILED`,
`DIRECTORY_SEARCH_UNAVAILABLE`, `IDENTITY_SERVICE_UNAVAILABLE`,
`COMMUNITY_SERVICE_UNAVAILABLE` and `INTERNAL_CONTRACT_INVALID`. Protected
offline actions are blocked and never queued or auto-submitted. Gateway never
forwards a raw Identity failure body: an exact revoked decision becomes
`COMMUNITY_CONSENT_REVOKED`, other non-enumerating 401/403/404 authority
failures become `COMMUNITY_AUTHORITY_REQUIRED`, and other Identity failures
become `IDENTITY_SERVICE_UNAVAILABLE`.

## P5-S2 Community match coordination contract (`P5-S2-v1`)

The frozen language-neutral source is `contracts/community/p5-s2-v1`. Gateway
obtains a fresh, request-digest-bound Identity decision for each protected
query or command and forwards only the strict authorization projection.
Volunteer and coordinator queries, approval/rejection, offer, accept/decline,
assignment/reassignment, append-only progress, coordinator-only close,
revocation and reconciliation use the OpenAPI paths and schemas in that tree.
Approval lasts at most 30 days; an offer at most seven days; capacity is only an
organization-local service date plus day-part. Stable failures distinguish
denial/revocation, no capacity, stale/concurrent state, closed/revoked during
action, dependency unavailable, offline blocked and post-dispatch uncertainty.

# P5-S3 moderation resolution addendum

`P5-S3-v1` is frozen under `docs/security/P5_S3_THREAT_MODEL.md`. Gateway exposes
four protected POST operations for redacted queue, redacted case detail,
version-bound resolution, and uncertain-result reconciliation. Each obtains a
fresh ten-second exact-purpose P2 decision and forwards a closed JSON command
to Spring Community. Language-neutral artifacts and fixed digest vectors live
under `contracts/community/p5-s3-v1`; Zod consumer schemas are in
`packages/contracts/src/p5-s3-community-contract.ts`.

# P6-S3 internal service identity and failure contract

Production `/internal/*` requests carry `x-lifebridge-service-identity`, a
bounded HMAC assertion containing only version, key id, caller, audience,
scope, issue/expiry times and nonce. Lifetime is at most 120 seconds. Receivers
verify signature/time/caller/audience/route scope before business parsing.
Missing, expired, wrong-audience and wrong-scope calls remain non-enumerating.
Gateway uses `identity.access`, `care.access`, `notification.read` and
`community.access`; Care alone uses `notification.events` with its own key.

Production dependency URLs require HTTPS and exclude user-info, query and
fragment. Calls have finite timeout, payload/response ceiling and per-dependency
bulkhead/circuit state. Secondary failure returns degraded or unknown truth,
never an authoritative empty projection or false confirmation. Care completion
commits independently; Notification recovery reuses the durable event identity.

# P7-S3 policy-neutral lifecycle contract

Identity owns an authenticated lifecycle request and opaque per-owner status;
each service acts only on its own store. Requests are versioned and digest-bound.
Same idempotency key plus the same intent replays the result; changed intent
returns `IDEMPOTENCY_CONFLICT`. A missing owner-approved data-class disposition
returns `POLICY_DECISION_REQUIRED` before any physical action. Partial results
remain `attention_required` and are never represented as complete. Supported
registry actions are `delete`, `pseudonymize`, `retain`, `tombstone`,
`export_include`, and `export_exclude`; synthetic fixture approvals do not
establish production policy. This is a product orchestration contract, not a
regulatory export or erasure claim.
