# Data Model

## Status and principles

The `P1-S1-v1` ownership and entity contract is frozen for implementation on
2026-07-26. PostgreSQL remains the selected engine; the migration and runtime
evidence are recorded by P1-S1.

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
- `CHG-2026-008` limits the P1 notification outbox to confirmed completion and
  targets the creator/coordinator when that actor differs from the completer.

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
| `status`                       | open or completed in P1-S1                        |
| `priority`                     | normal, important, urgent; never color-only in UI |
| `due_at`                       | timestamp with zone                               |
| `due_time_zone`                | validated IANA zone preserving user context       |
| `version`                      | monotonic optimistic-concurrency value            |
| `created_by`, `created_at`     | immutable provenance                              |
| `completed_by`, `completed_at` | present only after completion                     |

Hard deletion is not part of Slice 1. A future retention slice must define
archive/deletion rules and legal/product approval.

### Command idempotency

Care Coordination owns a command-result record keyed by operation, actor, and
idempotency key:

| Field                         | Rule                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `operation`, `actor_id`       | authorization and command scope                             |
| `idempotency_key`             | bounded opaque client key                                   |
| `request_hash`                | canonical validated request hash; never a raw request body  |
| `response_status`, `response` | safe confirmed result projection                            |
| `created_at`, `expires_at`    | explicit lifecycle; P1 keeps records for the fixture window |

The unique key is `(operation, actor_id, idempotency_key)`. The same key and
hash returns the original result; a different hash is a bounded conflict.

### Outbox record

| Field                               | Rule                                            |
| ----------------------------------- | ----------------------------------------------- |
| `event_id`                          | globally unique opaque identifier               |
| `event_type`, `event_version`       | versioned contract                              |
| `aggregate_id`, `aggregate_version` | ordering and deduplication                      |
| `payload`                           | opaque task/household/recipient/actor/time only |
| `occurred_at`                       | domain event time                               |
| `published_at`                      | null until confirmed                            |
| `attempt_count`, `last_error_code`  | bounded retry evidence; no secret/detail dump   |

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

### Notification inbox and notification

Notification owns both records in its own database:

| Record       | Essential fields                                                                                      | Uniqueness/meaning                                        |
| ------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Inbox result | source event ID, payload hash, event type/version, result, processed time                             | one durable consumer result per source event              |
| Notification | notification ID, recipient ID, source event ID, message key, bounded task-ID parameter, read, created | one stored item per source event and authorized recipient |

`suppressed_self` is a durable inbox result with no Notification row. Pending,
retrying, and failed delivery remain Care Coordination outbox truth. Only a
durable Notification acknowledgement permits the outbox state `delivered`.

## P1 physical ownership

P1 uses one local PostgreSQL server with two independently migrated databases
and credentials:

```text
lifebridge_care          <- Care Coordination only
lifebridge_notification  <- Notification only
```

Gateway and Web have no database credential. Care never reads or writes the
Notification database; Notification never reads or writes the Care database.
The internal versioned HTTP event contract is the only write boundary between
them. Test/local credentials are generated into ignored process-local state and
are never committed or printed.

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

## P1 migrations

Each owning service has a forward-only, repeat-safe migration entry point. P1
tests migrate disposable databases from empty state, restart the owning
processes without reseeding, and verify task/outbox/inbox/notification
durability. Rollback for the additive initial schema is replacement of the
slice-owned disposable local databases; no real-data destructive rollback is
claimed or authorized.

## P2-S1 Identity ownership

`CHG-2026-010` adds one independently owned PostgreSQL database on the existing
engine:

```text
lifebridge_identity <- Identity & Consent only
```

Gateway, Care Coordination and Notification receive no Identity database
credential. Identity never writes Care or Notification tables. P2-S1 adds no
broker, cache, external identity datastore, cross-service foreign key, or new
persistence engine.

The additive initial Identity migration owns:

| Table                     | Essential fields / invariant                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `identity_accounts`       | opaque account ID, unique normalized login name, Argon2id encoded password, state, authentication version, timestamps |
| `identity_authenticators` | account-scoped TOTP state, encrypted seed/key version, last accepted time step; one active factor in P2-S1            |
| `identity_recovery_codes` | account-scoped digest, created/used/revoked timestamps; conditional one-time consumption                              |
| `identity_challenges`     | digest, purpose, state/decoy flag, attempts, expiry, consumed time; never raw challenge/OTP/code                      |
| `identity_sessions`       | session/CSRF digests, auth version, idle/absolute expiry, last seen, revocation and session family                    |
| `identity_rate_limits`    | operation, HMAC-derived dimension, window and count; never raw login name/IP                                          |
| `identity_preferences`    | locale, text scale, contrast, motion, optimistic version and timestamps                                               |
| `identity_audit`          | append-only action/result/correlation and nullable opaque account reference; no request payload                       |

Login name is Personal data. Passwords, TOTP seeds/codes, recovery codes,
challenge/session/CSRF tokens and runtime encryption/rate keys are Secret.
Preference values are Personal configuration but cannot encode disability,
diagnosis, raw assistive-technology use or care information.

Challenge/session/rate/audit retention and cryptographic parameters are frozen
in `docs/security/P2_S1_THREAT_MODEL.md`. Migration/restart tests must create
only the Identity database, reconnect without reseeding, and prove no
Care/Notification cross-write.

## P2-S2 Identity-owned household data

Migration `002_household_authorization.sql` additively owns households, unique
account membership, digest-only invitations, request idempotency, minimum
care-recipient context and redacted audit dimensions. No other service receives
the Identity database credential or writes these tables.

Invitation tokens are never persisted raw. Invitee dimensions are keyed
digests, and pending uniqueness uses that same dimension for real and decoy
rows; persisted idempotency responses exclude tokens. Decoy invitations have
no account foreign key and are marked internally so public lifecycle responses
remain non-enumerating while acceptance cannot grant membership. Household-
scoped serialization prevents two first context writes from both succeeding at
version one.
Recipient context is limited to safe display and relationship-neutral labels
and cannot store clinical, medication, emergency, inferred-need or legal-
authority content. Consent grant/revoke/history remains P2-S3.

## P2-S3 Identity-owned consent, privacy, and audit data

Migration `003_consent_privacy_audit.sql` is additive. Identity & Consent is
the only writer.

| Table                          | Essential invariant                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `identity_consent_subjects`    | unique account, household and recipient-context self-binding; aggregate version serializes all consent commands |
| `identity_consent_grants`      | one current grant per subject/member/purpose; non-empty scopes; active or revoked state; optimistic version     |
| `identity_consent_transitions` | immutable grant/narrow/revoke evidence with opaque IDs, enumerated values and UTC effective time                |
| `identity_consent_idempotency` | 24-hour canonical request digest and original safe response; unique per subject/operation/key digest            |
| `identity_consent_outbox`      | versioned transition event written atomically with the command; not an authorization source                     |
| `identity_consent_audit`       | redacted consent/access/privacy evidence ordered by `(occurred_at, audit_id)`; no sensitive payload             |
| `identity_privacy_preferences` | one atomic three-value record per account with optimistic version and confirmed UTC time                        |
| `identity_schema_state`        | current schema marker used by latest-schema readiness                                                           |

`identity_recipient_contexts.created_by_account_id` records creator provenance
for new rows without backfilling legacy context ownership. The browser uses a
keyed subject-bound pseudonymous member reference so it is not linkable across
consent subjects; the internal grantee account ID never appears in the public
projection or command.

Current grants and subject bindings remain while their owning product record
exists. Transition evidence remains for the product-record lifetime.
The redacted audit projection exposes at most 90 days; idempotency facts are
replayable for 24 hours; unpublished outbox rows remain until delivered or
reconciled. Physical scheduled purge, legal hold, account deletion and erasure
proof remain P7-S3/P8 work. These are engineering defaults subject to a later
processing inventory and legal review, not compliance claims. Revocation
changes current authorization and preserves required historical evidence.

## P3-S1 Care-owned timeline and handoff data

Care Coordination migration `002_daily_timeline_handoff.sql` is additive,
transactional, repeatable, and contains no historical backfill. Care remains
the sole writer.

| Table                  | Essential invariant                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `care_schema_state`    | schema version 2 and immutable coverage start for honest pre-P3 history labeling                                               |
| `care_timeline_events` | immutable accepted facts; unique internal sequence and `(occurred_at, event_ref)` chronology; task/household/recipient scope   |
| `care_task_handoffs`   | one accepted handoff per task version with from/to actors, enumerated reason, server occurrence/effective time and correlation |
| `care_tasks`           | existing assignee and optimistic version update atomically with all P3 evidence                                                |
| `care_audit`           | success evidence with opaque resource identifiers and empty structured metadata                                                |
| `care_outbox`          | `care.task.handed_off.v1` committed with the task; no title or free-form context                                               |
| `care_idempotency`     | 24-hour digest-only key and canonical intent hash with original safe response                                                  |

Timeline facts for new P1 create/complete operations are written only after the
coverage marker exists. Existing tasks and audit rows are preserved without
invented history. Timeline/task titles remain in the authorized Care read
model but are never copied into handoff, outbox, audit, Notification, log,
metric, or trace payloads. Handoff reason is one bounded enum.

Timeline, handoff, audit and delivered outbox evidence currently follow the
owning product-record lifecycle. Physical retention purge, legal hold,
account-deletion reconciliation and restore/erasure proof remain P7-S3/P8.
Handoff idempotency expires after 24 hours. These are engineering defaults,
not legal-compliance claims.

## P3-S2 Care-owned appointment and Notification reminder-intent data

Care Coordination migration `003_calendar_appointments.sql` is additive,
transactional, repeatable and performs no appointment or reminder backfill.
It advances the Care schema marker to version 3 while keeping a distinct
`appointment_coverage_started_at`; the P3-S1 timeline coverage marker is not
reused. Care remains the sole appointment writer.

| Table                          | Essential invariant                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `care_schema_state`            | schema version 3; P3-S1 timeline coverage preserved; distinct P3-S2 appointment coverage start                                         |
| `care_appointments`            | one concrete occurrence aggregate; structured kind/logistics, source local/IANA/offset, UTC interval, status, version and series facts |
| `care_appointment_transitions` | immutable create/change/cancel evidence with prior/new UTC intervals, occurrence-only scope and enumerated action/reason               |
| `care_audit`                   | opaque appointment action/result/correlation with empty bounded metadata                                                               |
| `care_outbox`                  | one `care.appointment.reminder_intent.v1` per appointment version when schedule/cancel intent changes                                  |
| `care_idempotency`             | 24-hour digest-only key and canonical complete intent with original safe response                                                      |

Each finite weekly recurrence is materialized as 2–12 concrete
`care_appointments` rows sharing one opaque `series_id`. Every row stores its
occurrence number/count, interval weeks, final local date, confirmed source
local start, IANA zone, numeric offset, canonical UTC start/end and version.
Changing or cancelling one occurrence does not rewrite the series or another
occurrence. Cancellation sets state and appends evidence; it never deletes the
row.

Conflict checks are scoped to the governed recipient context, exclude
cancelled rows, use half-open UTC intervals and serialize through a
recipient-scheduling advisory lock. Calendar order is
`(starts_at_utc, appointment_id)`. No cross-service table, credential or
foreign-key ownership is introduced.

Appointment kind and logistics are enums. There is no title, description,
address, meeting URL, attendee, contact, note, clinical content or arbitrary
recurrence rule in P3-S2. Those values therefore cannot enter event, audit,
outbox, Notification, log, metric or trace payloads.

Notification migration `002_appointment_reminder_intents.sql` is additive,
repeatable and has no reminder backfill. Notification remains the sole writer
of:

| Table                           | Essential invariant                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `notification_inbox`            | existing source-event deduplication remains authoritative for every accepted event                                     |
| `notification_reminder_intents` | one latest structured schedule/cancel state per appointment with recipient, UTC trigger/start, message key and version |

The Notification projection contains no household/recipient label, appointment
kind/logistics, local time, zone, recurrence, reason, free text or delivery
claim. A later reminder-delivery engine, channel preference, acknowledgement,
retention purge, legal hold, account deletion and restore/erasure proof remain
future accepted work. Appointment/idempotency/transition and reminder-intent
retention are engineering defaults subject to P7/P8 policy, not legal
compliance claims.

## P3-S3 Care-owned versioned support-plan data

Care migration `004_care_plan_review.sql` advances readiness to v4 and adds
`care_plan_coverage_started_at DEFAULT CURRENT_TIMESTAMP NOT NULL` so old
migrations can reapply safely. It does not backfill plans, drafts, versions,
items, events, timeline, tasks, or appointments.

| Table                     | Essential invariant                                                                                   |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `care_plans`              | one aggregate per household/recipient with optimistic aggregate revision and nullable current pointer |
| `care_plan_drafts`        | at most one complete shared working copy with distinct draft revision and base current version        |
| `care_plan_draft_items`   | bounded ordered goal/preference/responsibility items; responsibility actor references only here       |
| `care_plan_versions`      | immutable confirmed versions with stored local-date/IANA and exact UTC day bounds                     |
| `care_plan_version_items` | immutable bounded ordered authorized content for one confirmed version                                |
| `care_plan_transitions`   | content-free draft/confirmation evidence ordered by aggregate revision                                |

Save replaces the draft/items inside one transaction after advisory
idempotency and aggregate row locks. Confirmation inserts immutable
version/items, advances current, clears the draft, and writes transition,
redacted audit, digest-only replay, and one suppressed content-free outbox event
in the same transaction. Failure writes none. Prior versions are never updated
or deleted. Cross-service SQL, foreign keys, credentials, imports, shared
writers, a new engine, and Notification plan storage are forbidden.

## P4-S1 medication reminder model

Care Coordination adds owner-local, additive structures:

| Structure                              | Minimum facts                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `care_medication_reminders`            | opaque reminder/household/recipient-context/recipient IDs; Care-only label; exact user amount/unit; local/IANA/offset/ambiguity/finite recurrence; lifecycle; version; timestamps |
| `care_medication_reminder_occurrences` | stable occurrence identity, schedule version/number/count, source local/IANA/offset, resolved UTC, current/superseded/disabled state                                              |
| `care_medication_reminder_transitions` | content-free create/change/disable evidence by reminder version                                                                                                                   |

Schedule mutation reuses `care_audit`, `care_idempotency` and `care_outbox`.
One Care transaction writes the aggregate, deterministic occurrences,
transition, redacted audit, digest-only replay and minimum structured intents;
injected failure leaves all unchanged. Change/disable never delete prior
Notification delivery or acknowledgement evidence.

Notification adds a separate owner-local schema marker and structures:

| Structure                           | Minimum facts                                                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `medication_reminder_intents`       | opaque scope/recipient/reminder/occurrence IDs, occurrence version, trigger UTC, source local/IANA/offset, fixed message key, intent/delivery state and current version |
| `medication_delivery_attempts`      | attempt number, bounded result/reason, started/completed timestamps and evidence class                                                                                  |
| `medication_reminder_notifications` | one generic in-app item per occurrence, authoritative persisted timestamp and seen acknowledgement fields                                                               |
| `notification_idempotency`          | operation, actor and key digests, request hash, bounded response and expiry                                                                                             |
| `notification_audit`                | allowlisted action/result/reason with opaque resource/version and correlation only                                                                                      |
| `notification_outbox`               | content-free acknowledgement fact for replay-safe downstream evidence                                                                                                   |

`delivered` is valid only with one in-app notification row. `seen` is valid
only with delivered evidence and one immutable server timestamp. Unique keys and
owner-local locks make event consume, delivery and acknowledgement duplicate
safe. No table stores diagnosis, recommendation, treatment, urgency, adherence,
missed-dose guidance or arbitrary notification text. Notification stores no
medication label, amount or unit. Migrations add no P4 rows for accepted P1/P3
data and must reapply safely under their own service credentials.

## P4-S2 emergency-readiness model

Care migration `006_emergency_readiness.sql` advances the Care readiness marker
to version 6 without backfill. It adds only Care-owned PostgreSQL structures:

| Structure                            | Minimum invariant                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `care_emergency_readiness`           | one household/recipient aggregate; aggregate/contact revisions, current reviewed version, state and timestamps               |
| `care_emergency_contacts`            | current minimum personal projection; unique contiguous position, opaque item ID, item version, bounded label and dial string |
| `care_emergency_contact_transitions` | content-free complete-list replacement facts by contact-list revision                                                        |
| `care_emergency_plan_drafts`         | at most one shared draft with draft/base/contact revisions                                                                   |
| `care_emergency_plan_draft_steps`    | bounded ordered participant-entered non-clinical guidance                                                                    |
| `care_emergency_plan_versions`       | immutable reviewed versions with bound contact revision and server-confirmed UTC/local/IANA/offset facts                     |
| `care_emergency_plan_version_steps`  | immutable bounded ordered guidance for one reviewed version                                                                  |
| `care_emergency_plan_transitions`    | content-free draft/review facts ordered by aggregate revision                                                                |

All contact and plan mutations lock the same aggregate. A complete contact-list
replacement therefore serializes with draft save and plan review. A contact
change makes the current reviewed plan `review_required` rather than copying
personal contact values into immutable plan rows. Snapshot issuance reads the
current reviewed version, its bound contact revision, the current contact list,
and confirmation facts inside one repeatable transaction so a browser never
receives a torn plan/contact copy.

Mutation reuses `care_audit`, `care_idempotency`, and `care_outbox`. Protected
contact values and plan steps exist only in current/authorized Care tables and
reads. Transitions, audit metadata, idempotency responses, outbox, logs,
metrics, traces, errors, and cursors are content-free. Removing a contact
deletes its current personal values; only content-free transition history
remains. No contact/plan rows are created for older P1–P4-S1 data.

ADR-025 permits exactly one client persistence exception: an explicitly saved,
passphrase-encrypted `P4-S2-offline-v1` snapshot in IndexedDB. Cache Storage
contains only a versioned non-sensitive shell. The snapshot is recent through
24 hours, stale through 72 hours, and purged at expiry, logout/account switch,
known denial/revocation, `no_plan`, incompatible schema, integrity failure,
confirmed contact change, or explicit removal. This bounded engineering
retention is not a legal-compliance claim and cannot discover remote revocation
while the device is offline.

## P4-S3 document-vault model

Identity migration 004 adds the `document_vault.access` consent scope and
raises only the allowed scope-count bound. It does not backfill or broaden any
existing grant; an existing collaborator must be explicitly revoked/regranted
with the new scope.

Care migration 007 owns:

- `care_document_vaults`: one household/recipient aggregate and monotonic vault
  version;
- `care_documents`: randomized document/upload references, sanitized minimum
  metadata, authoritative processing truth, policy keys and optimistic version;
- `care_document_blobs`: randomized object ID, bounded `bytea`, SHA-256 digest,
  exact size and document/household/recipient/version binding;
- `care_document_transitions`: structured content-free processing history;
- `care_document_tombstones`: opaque content-free deletion evidence.

Existing Care-owned audit, idempotency and outbox tables remain the only
supporting stores. No cross-service table, credential, schema, bucket, cache or
Gateway store is introduced. Upload acceptance inserts metadata and bytes and
finishes strict text/integrity validation in one owner transaction. Failed or
rejected processing leaves no temporary bytes.

`retained_until_explicit_delete` is the engineering retention policy. Delete
atomically removes all active bytes plus filename, digest/object binding and
readable metadata. There is no automatic expiry, legal hold, product undo or
server restore. Only opaque content-free transition/audit/tombstone/outbox
facts, an invalidated upload replay marker and the bounded delete replay result
survive. Delete strips the filename and other projection metadata from the
matching upload replay atomically, so its old key cannot resurrect the object.
A post-delete backup may contain historical residue; production retirement and
non-resurrection remain an explicit deployment gate, not a completed P4-S3
claim.

## P5-S1 Community-owned request and directory data

Community owns a separate PostgreSQL database/role and Flyway history. No
Gateway, Identity, Care or Notification credential can read or write its
tables, and Community has no privilege on another service database. Migration
`V1__p5_s1_community.sql` creates schema only; it inserts no request, listing,
audit, replay, tombstone or event. The guarded fixture loader is the only path
for clearly fictional `SYN-PC-*` directory data.

| Table                          | Essential invariant                                                                                                                                                                                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `community_schema_state`       | One `community` row proves owner schema version 1 for readiness; it is not product data.                                                                                                                                                                               |
| `community_directory_listings` | Reviewed public metadata only; structured category/province-city/organization-type indexes; provenance dates are authoritative and no rank/eligibility/availability/endorsement inference exists.                                                                      |
| `community_help_requests`      | Opaque request/reference binding plus recipient context, one bounded category, province/city, optional day part, exact visibility, `pending \| closed`, optimistic version and retention instants. One pending request per recipient/category/location/day-part tuple. |
| `community_idempotency`        | Digest-only key/actor/route/aggregate/intent binding and bounded authoritative response for 24-hour submit/close/delete replay; no raw key or request content. `aggregate_ref_digest` is indexed so delete/purge can invalidate protected historical responses.        |
| `community_request_tombstones` | Digest-only request/actor/submission-reference evidence prevents delete/replay resurrection for at most 365 days.                                                                                                                                                      |
| `community_audit`              | Enumerated action/outcome, opaque actor/aggregate digests, version, correlation and UTC only; no category, location, day part, listing, contact, authority body or request payload.                                                                                    |
| `community_outbox`             | Content-free submitted/closed/deleted facts with opaque aggregate/event IDs, version, lifecycle, UTC, correlation/causation and `suppressed_not_configured`; `(aggregate_id, aggregate_version)` is unique; no delivery or matching consumer.                          |

The lifecycle is `pending -> closed -> deleted`. Pending rows auto-close after
30 days. Closed protected fields purge within 30 additional days. Explicit
delete purges active fields immediately. Audit, tombstone and suppressed
outbox evidence is bounded to 365 days; replay payloads expire after 24 hours.
Deletion makes no historical production-backup erasure or legal-hold claim.

Submit/close/delete changes, their redacted audit, replay result and outbox row
commit in one Community transaction. Same digest-bound idempotent intent
returns the original result; changed intent fails. Close/delete lock the
aggregate and require exact `expectedVersion`; one concurrent mutation wins
and the stale mutation cannot overwrite it. Reconciliation by
`submissionReference` always requires a new Identity decision.

The first use of each actor/operation/key/route tuple is serialized before its
replay lookup. Explicit delete and retention purge remove every earlier replay
bound to the aggregate, then explicit delete stores only its minimal response.
Auto-close and purge run from the Community-owned scheduler as well as
opportunistically before protected operations; `FOR UPDATE SKIP LOCKED` avoids
two sweep workers processing the same aggregate. Delete/purge audit and outbox
facts use the next aggregate version, never the last protected-row version.

The public search query is parameterized and allowlisted, returns at most 25
rows and orders by `public_name`, then `listing_id`. Location granularity is
province/city only. Migration apply, forced rollback, checksum-verified
reapply, zero backfill and cross-owner privilege isolation are mandatory Level
C/hosted evidence and do not authorize any production directory import.
