# P5-S2 volunteer match and organization coordination threat model

## Control

- Version: `P5-S2-TM-v1`
- Date: 2026-07-29
- State: **pre-code freeze candidate**
- Boundary: Browser → Node Gateway → Identity & Consent and Spring Community →
  Community-owned PostgreSQL/audit/outbox
- Excluded: P5-S3 moderation, contact exchange, automated dispatch/scoring,
  new service/engine, deployment and release

## Protected assets and trust rules

Protected assets are the existence of a request/match, recipient context,
minimum request fields, volunteer participation, organization membership and
capacity, approval/offer/assignment/progress state, authority provenance,
idempotency evidence, audit and outbox records.

The browser and role labels are untrusted. Gateway may authenticate a session
but cannot authorize a protected Community action itself. Identity & Consent
must produce a fresh exact-purpose, permission and request-digest-bound
decision. Community independently verifies organization role, approval and
capacity evidence inside the same authoritative transaction. Deny on any
mismatch, expiry, revocation or unavailable dependency.

## Threats and mandatory mitigations

| Threat                                                                 | Control                                                                                                                                                   | Required proof                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Organizer/coordinator/volunteer label becomes care-recipient authority | New `community_match_coordination` purpose; exact permission; no grant backfill; three evidence planes evaluated independently                            | Identity negative matrix and Community integration tests |
| Consent is fresh at Gateway but revoked before commit                  | Community validates decision expiry/digest and current revocation provenance at transaction boundary; revocation locks match and wins a monotonic version | revoke-versus-accept/assign/progress race tests          |
| Organization approval is inferred from a pending P5-S1 request         | Explicit versioned approval aggregate; only `approved` and unexpired permits offer                                                                        | lifecycle/provider tests                                 |
| Capacity is oversubscribed by concurrent offers/accepts                | database uniqueness, deterministic locks and atomic reservation/assignment                                                                                | concurrent multi-actor PostgreSQL tests                  |
| Two volunteers accept the same offer or assignment                     | offer is bound to one enrollment and expected version; one committed transition; replay versus conflict distinguished                                     | concurrent accept test                                   |
| Reassignment leaves two active volunteers or leaks old access          | atomic release/new reservation/assignment; old volunteer loses read/action immediately; immutable history                                                 | reassignment conflict and post-reassignment denial tests |
| Stale offer/version overwrites newer state                             | expected aggregate and subordinate versions on every mutation                                                                                             | stale offer/match/progress contract tests                |
| Closed/revoked match accepts progress                                  | terminal-state lock/check inside transaction; minimum failure envelope                                                                                    | close/revoke race tests                                  |
| Request, household or recipient is enumerated through denial           | inaccessible and absent share non-enumerating response; bounded list has no total/hidden count                                                            | cross-organization and timing/error-shape tests          |
| Minimum disclosure is widened by coordinator queue                     | role-specific schemas; fixed allowlist; volunteer and coordinator projections omit unrelated fields                                                       | schema negative fixtures and runtime response scan       |
| Free-form text exfiltrates sensitive content                           | enum-only commands/progress/reasons; `additionalProperties:false`; payload/log sentinel scans                                                             | schema/provider/browser security tests                   |
| Gateway fabricates accepted/assigned/progress state                    | UI success only from valid Community response; no Gateway persistence; invalid/lost response is unknown                                                   | consumer contract and response-corruption tests          |
| Offline client queues or repeats a mutation                            | service worker excludes protected routes; offline blocks; uncertain dispatch reconciles instead of retrying                                               | browser network/storage tests                            |
| Idempotency key collision/reuse changes intent                         | store digest only; serialize first use; actor/operation/route/intent binding; 24h limit                                                                   | replay, changed-intent and concurrent-first-use tests    |
| Deleted/revoked content survives in replay/audit/outbox                | aggregate-linked replay invalidation; active purge; content-free evidence; scheduled locked retention                                                     | deletion/retention/replay resurrection tests             |
| Audit/outbox leaks household, location, capacity or actor identity     | opaque digests plus enum outcome only; schema forbids protected fields                                                                                    | database serialization and log/event sentinel tests      |
| Cross-service SQL or credentials bypass owners                         | Community-only role/schema; Gateway/Identity have no Community DB privilege; no imports                                                                   | migration owner-isolation and config scans               |
| Organization/Identity/Community outage is shown as empty/denied        | stable separate unavailable failures; no cached authority                                                                                                 | dependency failure matrix                                |
| Match state is used as endorsement or outcome                          | neutral localized copy and enums; no score/rank/quality/safety/clinical fields                                                                            | contract string scan and browser assertions              |

## Abuse and privacy cases

- A coordinator may access only their active organization and only matches
  approved for it. Guessing another organization or match ID must not reveal
  existence.
- A volunteer sees only an offer addressed to their active enrollment and only
  consented fields. They never see other volunteers, capacity totals,
  household identifiers or coordinator queue data.
- A care-recipient consent revocation suppresses future reads and actions even
  when organization approval and capacity remain valid.
- Organization revocation or volunteer removal suppresses access even while
  care-recipient consent remains valid.
- Capacity never proves availability, willingness or suitability. It is only a
  bounded organization-owned reservation fact.
- Progress checkpoint `support_completed` proves only that an authorized actor
  recorded that coordination checkpoint; it does not prove benefit, quality,
  receipt of care or a clinical outcome.

## Failure and recovery truth

Known validation, denial, expiry, no-capacity, state and version conflicts are
not uncertain. A request blocked before dispatch is not persisted or queued.
Loss or invalid response after dispatch becomes
`COMMUNITY_MATCH_RESULT_UNKNOWN`; only a new fresh-authority reconciliation
may establish whether it committed. Reconciliation must not expose an
aggregate to an actor whose authority was revoked after the original command.

The UI must preserve user-entered bounded selections after recoverable
validation but clear protected projections on revoke, scoped denial or
organization removal. Stale/offline data is labeled with last-confirmed time
and cannot enable mutation.

## Audit, observability and retention

Security logs contain correlation ID, route template, result category,
latency bucket and service dependency state only. They exclude raw IDs where a
digest suffices, request bodies, authority context, tokens, idempotency keys,
location and capacity values.

Community commits lifecycle mutation, audit and outbox atomically. Every
record has a monotonic aggregate version. Active protected match fields,
offers, reservations and replay bodies purge no later than 30 days after
terminal state; content-free evidence is capped at 365 days. Exact production
backup erasure/legal-hold behavior remains unclaimed.

## Security acceptance gate

P5-S2 is not ready for code until the reconciled contract fixes exact purpose,
permissions, role-redaction matrix, capacity slot shape, expiry limits and
close authority. It is not ready for acceptance until provider/consumer,
PostgreSQL race/revocation/retention, cross-organization isolation,
schema-negative, runtime privacy sentinel and browser offline/uncertain tests
pass against the frozen contract.
