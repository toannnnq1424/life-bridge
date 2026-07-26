# API Contracts

## Status

- Contract set: `P1-S1-v1`
- State: **Frozen for implementation**
- Frozen: 2026-07-26
- Change: `CHG-2026-008`
- Executable source: `packages/contracts`

The schemas in `packages/contracts` must remain equivalent to this contract.
Breaking semantics require a new API/event version and accepted change record.

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
