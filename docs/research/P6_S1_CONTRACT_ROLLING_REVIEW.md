# P6-S1 contract and rolling-compatibility freeze

State: Frozen before product code on 2026-07-29.

## Reconciled independent review

Three independent read-only reviews covered language-neutral contracts and
authority, mixed Node/Spring rollout, and local test/operations. They agree
that `P5-S1-v1`, `P5-S2-v1`, and `P5-S3-v1` are disjoint feature contracts,
not successive compatibility generations. P6-S1 therefore introduces one
Community release line with:

- `community-v2` as current;
- `community-v1` as previous;
- both versions served concurrently by current Community and understood by
  current Gateway;
- explicit `x-lifebridge-contract-version` selection and response evidence;
- `406 COMMUNITY_CONTRACT_VERSION_UNSUPPORTED` before command dispatch when a
  requested version is unsupported.

The versions preserve the same minimum-authority and business semantics.
`community-v2` may add only optional response/event metadata. It may not
weaken authorization, request digest, idempotency, optimistic concurrency,
failure truth, disclosure, retention, or ownership.

## Compatibility and support policy

Previous remains supported for at least 90 days after current is accepted and
through one independently evidenced rollout and rollback cycle. Retirement
requires an accepted change, a published removal date, consumer inventory of
zero, migration evidence, and current/previous provider/consumer proof. An
emergency removal requires its own accepted change and incident evidence.

Compatible changes are optional additive response/event fields, new endpoints,
and broader response enums when old consumers demonstrably ignore unknown
values. Request additions are compatible only when optional and every previous
provider tolerates them. Removing or adding required fields, narrowing types or
enums, changing paths/methods/statuses, changing meaning, canonical digest,
idempotency, authorization, retryability, or ambiguous-write behavior is
breaking and must fail validation.

Events retain distinct `eventVersion` schemas. Consumers accept current and
previous and normalize locally. Producers switch to current only after the
consumer inventory is compatible. Unknown newer events are quarantined for
operator attention, never acknowledged as processed, dropped, or fabricated.
No dual publish is allowed without a separate deduplication design.

## Rolling and rollback sequence

1. Expand Community first so every new instance serves current and previous.
2. Roll Community old to mixed to new while Gateway remains on previous wire.
3. Roll Gateway old to mixed to new, still selecting previous until all
   Community instances report both capabilities.
4. Activate current wire, observe the primary journey, then retain previous for
   the support window.
5. Roll back Gateway/current selection first, then Community. Never remove
   previous while an old Gateway remains and never use a destructive database
   downgrade. P6-S1 adds no migration.

The required matrix is Gateway previous/current by Community previous/current.
Current Gateway defaults to previous wire until provider convergence, so all
four cells preserve the primary help-request journey. An ambiguous mutation
timeout is `COMMUNITY_REQUEST_RESULT_UNKNOWN` and requires reconciliation;
there is no silent cross-version replay or fallback.

## Authority, data, credentials, and failure truth

Identity & Consent remains sole decision authority. Gateway obtains a fresh
exact-purpose decision and forwards only the minimum projection. Community
owns its PostgreSQL, Flyway, audit, and outbox. Gateway owns public BFF
translation. No cross-service SQL, datastore credential, source import, or
shared generated business code is permitted; OpenAPI, JSON Schema, manifests,
and synthetic fixtures are the language-neutral boundary.

Identity failure before dispatch is retryable dependency unavailability.
Community read failure is truthful operation unavailability. Mutation timeout
after dispatch is non-retryable unknown-result truth pending reconcile.
Unsupported version or schema mismatch is a rollout incompatibility, not a
generic retryable outage. Logs contain only version, correlation, operation,
and outcome metadata.

## Frozen implementation and validation boundary

P6-S1 corrects the discovered P5-S3 route mismatch to the frozen
`/internal/v1/community/moderation/cases/.../resolution` contract and replaces
the stale single-string Community version response with truthful supported
capabilities. It adds machine-readable policy/matrix, negative breaking-change
fixtures, Node consumers, Spring providers, current/previous event fixtures,
and a real mixed-runtime matrix. It does not add UI, a service, database,
migration, broker, cache, artifact-isolation work, service-auth redesign, or
P6-S2/P6-S3 scope.

Exactly one local `pnpm.cmd run validate:p6-s1` Level C is required. A retained
failure permits only classified targeted recovery, never a second full
invocation. Hosted exact-head and post-merge gates remain deferred under the
owner's local-only hold.
