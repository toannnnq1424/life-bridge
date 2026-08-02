# P7-S2 pre-code review — durable replay, reconciliation and recovery

Date: 2026-08-02

Base: `origin/dev@20361386a918d731b18ada5c7fbf16496cbfd171`

Scope: P7-S2 only

## Frozen topology and ownership

| Boundary           | Truth at slice start                                                          | P7-S2 rule                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Source write       | Care owns its PostgreSQL aggregate, audit and transactional outbox            | Source mutation and immutable event intent commit together or neither commits                                     |
| Transport          | Care polls its outbox and calls Notification over authenticated internal HTTP | Keep the brokerless HTTP transport; do not introduce or imply a broker                                            |
| Consumer           | Notification owns its PostgreSQL inbox and durable Notification result        | One immutable source-event identity produces at most one durable result                                           |
| Community          | Community outbox is `suppressed_not_configured`                               | Treat it as source evidence only; do not invent delivery or replay                                                |
| Reconciliation     | No cross-owner query surface exists                                           | Compare bounded owner-local evidence through least-privilege APIs/tooling, never cross-service SQL or credentials |
| Terminal attention | Care owns Care-event delivery intent and attempts                             | Care owns terminal-attention and operator replay state; Notification remains owner of receipt/result truth        |

The immutable business idempotency identity is the source `event_id` plus its
canonical payload digest. Aggregate ID/version and event type/version define
ordering and compatibility evidence but never replace the event identity.

## Independent review reconciliation

Three read-only reviews covered (A) outbox/inbox/reconciliation and crash
consistency, (B) ownership, least privilege, privacy and operations, and (C)
failure injection, concurrency, mixed versions, CI and rollback. They
converged on these blocking gaps:

1. Care's five-second claim lease has no claim token or attempt fence.
   A stale worker can acknowledge or fail after another worker has reclaimed
   the event and can therefore regress a durable `delivered` result.
2. Claims are globally ordered but not serialized per aggregate. Overlapping
   dispatcher calls can deliver aggregate version N+1 before N, and an older
   appointment intent can overwrite a newer Notification-owned result.
3. Retry count is not enforced when claiming after a crash. `failed` conflates
   terminal attention with an ordinary attempt and has no immutable attempt or
   operator recovery audit.
4. Consumer commit followed by lost acknowledgement is structurally safe
   through inbox deduplication, but deterministic crash/concurrency proof is
   missing. Unsupported/malformed events are not classified as bounded poison.
5. Reconciliation and operator replay have no service-owned, redacted,
   least-privilege surface. Existing direct-SQL test recovery is not an
   operational contract.
6. The accepted docs-only classifier needs negative coverage so security,
   workflow, contracts, topology, source, migration and test changes always
   take the heavy path while closeout/status Markdown remains bounded.

No external research or architecture decision is open. The repository already
selects PostgreSQL 17.5, the owner-isolated ledgers, authenticated HTTP and the
current/previous contract policy. No new datastore, broker, shared credential
or ADR is required.

## Frozen implementation plan

1. Add additive owner migrations for an explicit Care outbox state machine,
   immutable claim token/generation, bounded lease/attempt/terminal timestamps,
   payload digest and owner-local attempt/recovery audit. Add Notification
   receipt ordering/result evidence without copying Care business truth.
2. Fence acknowledgement/failure with compare-and-set on claim token and
   expected attempt. A stale worker records no state change. Claim only eligible
   events below the attempt bound and prevent a higher aggregate version from
   passing a lower non-terminal event.
3. Make dispatcher execution single-flight per process while retaining
   database concurrency safety across processes. Persist bounded exponential
   backoff; keep the two-second HTTP timeout, 64 KiB request, 16 KiB response,
   bulkhead and circuit controls.
4. Classify permanent contract/schema/hash/order failures as terminal poison
   with bounded error codes and one clear Care owner. Never retry an
   unsupported version or immutable-event hash conflict blindly.
5. Provide bounded owner-local evidence/recovery APIs and a project-tracked
   operator command. Reconciliation is read-only by default and joins only
   opaque event IDs/digests/state evidence. Mutation requires a distinct
   recovery scope, explicit event IDs, dry-run, reason, compare-and-set,
   batch/time/concurrency ceilings and atomic audit.
6. Prove crash-before/after source intent, claim, publish, consumer commit and
   acknowledgement; duplicate/delayed/out-of-order/poison; producer/consumer
   outage; restart; concurrent dispatch/replay; and partial recovery. Assert
   exactly one durable Notification where required and unchanged Care/
   Community source truth.
7. Add architecture/negative fitness for cross-owner SQL/import/credentials,
   mutable event identity, unbounded retry/replay, raw payload/error output and
   classifier regressions. Add one exact-head P7-S2 PostgreSQL failure job and
   make the always-reported cumulative aggregator require it.

## Recovery, rollback and compensation boundary

Application rollback may use the additive P7-S2 schema and current/previous
contract window. Schema reversal, deletion of a confirmed Notification and
rollback of Care/Community source truth are not claimed. Recovery changes only
owned delivery/recovery state through fenced commands. A bad recovery is
corrected by an audited owner-local roll-forward or compensation record/event;
retention, backup lifecycle, RPO/RTO and deletion remain P7-S3.

## Redacted evidence contract

Operator and telemetry evidence may contain only event ID/type/version, opaque
aggregate ID/version, payload digest/size, state, bounded attempt/error class,
correlation/causation IDs, timestamps, pseudonymous operator ID, reason code
and before/after/result. It must not contain raw payload JSON, care titles or
context, recipient content, tokens, database URLs, response bodies or stack
traces.

## Explicit non-goals

No UI/Stitch, broker, new datastore/service, cross-service table access,
shared credentials, Community delivery enablement, P7-S3 retention/backup/DR,
P8/DATA-S1, deployment, release, tag or promotion to `test`/`main`.
