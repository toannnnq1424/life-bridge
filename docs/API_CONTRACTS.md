# API Contracts

## Status

Phase 0 contract baseline. No endpoint in this document is implemented yet.
Contract changes require the process in `docs/CHANGE_CONTROL.md`.

## Conventions

- Public prefix: `/api/v1`.
- JSON uses UTF-8 and ISO 8601 timestamps with an explicit offset.
- Identifiers are opaque strings; clients must not infer type or ownership from
  their shape.
- `Accept-Language` supports `vi-VN` and `en`; unsupported values fall back to
  `en`.
- Mutating requests accept `Idempotency-Key`.
- Every response includes a correlation identifier.
- Authorization is denied by default and checked against household role and
  consent.
- Protected-resource errors do not reveal whether an inaccessible record exists.
- User-facing text is rendered from localization keys, not returned as a
  hard-coded backend sentence.

## Shared envelopes

Successful collection:

```json
{
  "data": [],
  "meta": {
    "correlationId": "opaque",
    "nextCursor": null
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
    "correlationId": "opaque"
  }
}
```

No stack trace, SQL detail, credential, token, private hostname, or sensitive
record content may enter the public error envelope.

## Slice 1 — daily care task

### `GET /api/v1/households/{householdId}/tasks`

Returns tasks visible to the authenticated household member.

Query:

- `status`: optional `open | in_progress | completed`.
- `assigneeId`: optional opaque account identifier.
- `cursor`: optional opaque pagination cursor.

Acceptance:

- empty result is `200` with `data: []`;
- permission failure is non-enumerating;
- ordering is deterministic: due time, urgency, creation time, identifier;
- no care-recipient field outside the task projection is returned.

### `POST /api/v1/households/{householdId}/tasks`

Request:

```json
{
  "title": "Prepare transport for appointment",
  "description": "Synthetic demonstration text",
  "assigneeId": "account-demo-02",
  "careRecipientId": "person-demo-01",
  "dueAt": "2026-08-03T09:00:00+07:00",
  "urgency": "normal"
}
```

Result:

- creates one task;
- appends one audit entry;
- writes one transactional-outbox event;
- returns `201` and the task projection;
- replaying the same idempotency key returns the original result.

Expected errors include validation, permission/consent denial, unknown assignee
within the authorized household boundary, conflict, and service unavailable.

### `PATCH /api/v1/tasks/{taskId}`

Slice 1 permits only:

```json
{
  "operation": "complete",
  "expectedVersion": 3
}
```

Optimistic concurrency rejects a stale version with `409 TASK_VERSION_CONFLICT`.
Completion records actor, timestamp, new version, audit entry, and outbox event.

## Dashboard projection

### `GET /api/v1/households/{householdId}/dashboard`

Returns the minimum first-slice projection:

- open-task count;
- overdue-task count;
- the next five visible tasks;
- last confirmed update time;
- stale/offline-safe metadata.

Partial downstream failure must be explicit. The gateway must not fabricate an
empty state when the care service is unavailable.

## Service-to-service events

Event envelope:

```json
{
  "eventId": "opaque",
  "eventType": "care.task.created.v1",
  "occurredAt": "2026-08-01T10:30:00+07:00",
  "correlationId": "opaque",
  "producer": "care-coordination",
  "subjectId": "task-demo-01",
  "payload": {}
}
```

Initial event contracts:

| Event                    | Producer          | Consumers                      | Minimum payload                                       |
| ------------------------ | ----------------- | ------------------------------ | ----------------------------------------------------- |
| `care.task.created.v1`   | Care Coordination | Notification, Audit read model | task ID, household ID, assignee ID, due time, urgency |
| `care.task.assigned.v1`  | Care Coordination | Notification, Audit read model | task ID, previous/new assignee ID                     |
| `care.task.completed.v1` | Care Coordination | Notification, Audit read model | task ID, actor ID, completion time                    |

Events carry references and minimum delivery fields, not full care-recipient
profiles, documents, medication notes, or emergency-plan content.

## Health endpoints

Every deployable service will expose:

- `/health/live`: process is responsive; no dependency query.
- `/health/ready`: required dependencies and migrations are ready.
- `/version`: build identifier and contract version, without environment secrets.

## Contract governance

- `packages/contracts` becomes the executable source of truth once scaffolded.
- OpenAPI and event schemas are generated or validated from the same source.
- Breaking changes require a new API/event version and an ADR.
- Consumer contract tests are slice-level validation.
- Planned endpoints outside the current slice remain documentation-only and must
  not be reported as implemented.
