# Data Model

## Status and principles

This Phase 0 document defines ownership and minimum contracts; it is not a
deployed schema.

- Each service owns its data, migrations, backup/restore contract, and retention
  behavior.
- Polyglot persistence is permitted when an access pattern justifies it; it is
  not a goal by itself.
- The Phase 0 default is PostgreSQL with a separate database or strictly isolated
  schema per service. One local PostgreSQL instance may host those development
  databases, but services never read, join, or write another service's tables.
- Cross-service references are opaque identifiers carried through APIs/events.
- Transactional outbox records event intent atomically with domain changes.
- Audit records are append-only at the application level.
- Demo fixtures are synthetic and available in `vi-VN` and `en`.
- LifeBridge stores coordination data, not diagnosis or automated medical advice.

## Bounded contexts

| Context              | Owns                                                               | Does not own                            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| Identity and Consent | account, household membership, role, invitation, consent grant     | tasks, documents, notification delivery |
| Care Coordination    | household task, assignment, status, due time, timeline projection  | password, contact channel credentials   |
| Notification         | preference, notification intent, delivery attempt, acknowledgement | source task truth                       |
| Community Matching   | organization, public service listing, help request, match          | household care record                   |
| Audit Read Model     | redacted actor/action/resource/result projection                   | mutable business truth                  |

Community Matching is deferred until its dedicated vertical slices.

## Database selection gate

A service may add another database engine only through an ADR that identifies:

- the exact workload and why the current store cannot reasonably satisfy it;
- owner, source of truth, data classification, and allowed readers/writers;
- consistency, availability, partition, and recovery expectations;
- schema/index lifecycle and migration path;
- backup, restore, retention, export, and deletion behavior;
- local/CI/production materialization;
- operational cost, monitoring, failure mode, and rollback.

Reasonable future candidates include object storage for encrypted document
content, a search index for public community discovery, and Redis for bounded
ephemeral cache or coordination. None is approved as a source of truth in Phase 0. A cache or search index must be rebuildable from its owning service.

## Slice 1 entities

### Household membership

| Field                      | Rule                                                         |
| -------------------------- | ------------------------------------------------------------ |
| `household_id`             | opaque stable identifier                                     |
| `account_id`               | opaque stable identifier                                     |
| `role`                     | organizer, caregiver, member, or care-recipient self-service |
| `status`                   | invited, active, suspended, left                             |
| `created_at`, `updated_at` | timestamp with zone                                          |

### Consent grant

| Field                                   | Rule                              |
| --------------------------------------- | --------------------------------- |
| `grant_id`                              | opaque identifier                 |
| `household_id`                          | scope                             |
| `subject_person_id`                     | person whose data is protected    |
| `grantee_account_id`                    | receiving account                 |
| `purpose`                               | enumerated approved purpose       |
| `data_scope`                            | minimum named fields/capabilities |
| `starts_at`, `expires_at`, `revoked_at` | explicit lifecycle                |
| `version`                               | optimistic concurrency            |

### Care task

| Field                          | Rule                                              |
| ------------------------------ | ------------------------------------------------- |
| `task_id`                      | opaque identifier                                 |
| `household_id`                 | authorization boundary                            |
| `care_recipient_id`            | protected reference                               |
| `title`                        | short coordination instruction                    |
| `description`                  | optional; avoid unnecessary sensitive detail      |
| `assignee_id`                  | active authorized member                          |
| `status`                       | open, in_progress, completed                      |
| `urgency`                      | normal, important, urgent; never color-only in UI |
| `due_at`                       | timestamp with explicit zone                      |
| `version`                      | monotonic optimistic-concurrency value            |
| `created_by`, `created_at`     | immutable provenance                              |
| `completed_by`, `completed_at` | present only after completion                     |

Hard deletion is not part of Slice 1. A future retention slice must define
archive/deletion rules and legal/product approval.

### Outbox record

| Field                               | Rule                                          |
| ----------------------------------- | --------------------------------------------- |
| `event_id`                          | globally unique opaque identifier             |
| `event_type`, `event_version`       | versioned contract                            |
| `aggregate_id`, `aggregate_version` | ordering and deduplication                    |
| `payload`                           | minimum necessary event data                  |
| `occurred_at`                       | domain event time                             |
| `published_at`                      | null until confirmed                          |
| `attempt_count`, `last_error_code`  | bounded retry evidence; no secret/detail dump |

### Audit entry

| Field                           | Rule                                 |
| ------------------------------- | ------------------------------------ |
| `audit_id`                      | opaque identifier                    |
| `actor_id`                      | redacted/pseudonymous where possible |
| `household_id`                  | authorization boundary               |
| `action`                        | stable named action                  |
| `resource_type`, `resource_id`  | minimum reference                    |
| `result`                        | success or named failure class       |
| `occurred_at`, `correlation_id` | traceability                         |
| `metadata`                      | allow-listed redacted fields only    |

## Classification

| Class          | Examples                                                    | Default control                                                |
| -------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| Public         | published community directory description                   | source/license record                                          |
| Internal       | feature flags, synthetic fixture identifiers                | authenticated access                                           |
| Personal       | name, contact method, household membership                  | encryption, minimum disclosure                                 |
| Sensitive care | care needs, medication reminders, emergency plan, documents | explicit consent, least privilege, audit, strict retention     |
| Secret         | API keys, tokens, cookies, signing material                 | secret store/runtime injection; never database fixtures or Git |

## Localization

Domain state is language-neutral. Human-facing fixture content uses:

```text
localization_key
locale: vi-VN | en
text
source: synthetic | approved-public-source
```

Do not duplicate mutable domain state by language. Store localized display
content or translation keys separately.

## Research and fixture boundary

- `docs/research/DATA_SOURCE_REGISTER.md` records external source provenance.
- `data/fixtures/` contains only synthetic or explicitly redistributable samples.
- Raw downloaded datasets are local-only under ignored `data/raw/`.
- A source being public does not automatically make it redistributable.
- Every fixture derives from a documented transformation and must avoid
  re-identification risk.

## Planned migrations

Migration tooling is selected in the service-scaffolding slice. No production or
real-data migration is authorized in Phase 0. A migration must be forward-only
by default, reviewed, tested on disposable data, and accompanied by a rollback
or compensating plan.
