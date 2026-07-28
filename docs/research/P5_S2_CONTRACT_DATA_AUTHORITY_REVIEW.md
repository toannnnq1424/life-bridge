# P5-S2 contract, data and authority review

## Review control

- Review: `P5-S2-R1`
- Date: 2026-07-29
- Status: **PASS WITH ASSUMPTIONS — freeze candidate for reconciliation**
- Scope: `P5-S2 — Volunteer match and organization coordination` only
- Screens/routes confirmed from the canonical inventory: `LB-025`
  `/matching`; `LB-026` `/organization`
- Baseline: accepted P5-S1 Community owner, `P5-S1-v1` language-neutral
  contract, P2 Identity & Consent authority, ADR-019/`CHG-2026-011`
- Data: synthetic examples only; no real household, care, volunteer or
  organization records

This review is an independent pre-code recommendation. It freezes the minimum
contract candidate that may be reconciled with the independent design and
test/operations reviews. It does not claim implementation or approval.

## Decision and non-goals

Community remains the sole owner of organization enrollment, coordinator and
volunteer organization roles, approved requests, match offers, assignments,
capacity reservations, progress, audit and transactional outbox. Identity &
Consent remains the sole authority for current care-recipient sharing
decisions. Gateway obtains a fresh request-bound decision for every protected
read or mutation and forwards only the digest-bound authorization projection.

P5-S2 does not infer eligibility, need, diagnosis, treatment, urgency, safety,
priority, suitability, match quality, availability, outcome or endorsement.
It does not automatically dispatch, rank people, add free-form content, create
a second service, share databases or introduce another storage engine.

## Three independent evidence planes

An action is allowed only when all required evidence is current at the same
server-side evaluation instant. No evidence implies another.

| Evidence                         | Owner              | Minimum projection evaluated by Community                                                                                                                  | Invalidating conditions                                                                     |
| -------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Care-recipient sharing authority | Identity & Consent | decision ID, purpose, exact permission, actor ref, recipient context ID, grant ID/version, subject/privacy version, decided-at, expires-at, request digest | missing/denied, expired, revoked, digest mismatch, wrong actor/purpose/permission/context   |
| Organization approval and role   | Community          | organization ID, enrollment ID/version, actor role (`coordinator` or `volunteer`), approval ID/version/status, approved-at, expires-at                     | inactive organization/enrollment, wrong role/scope, rejected, expired or revoked approval   |
| Capacity reservation             | Community          | organization ID, volunteer enrollment ID, capacity policy version, reservation ID/version/status, bounded slot key, expires-at                             | no available slot, expired/released/revoked reservation, organization or volunteer mismatch |

Use a new Identity purpose `community_match_coordination`; do not broaden or
reuse P5-S1 `community_support`. The only allowed scopes are exact,
single-purpose grants:

- `community_match.volunteer.read`
- `community_match.volunteer.respond`
- `community_match.coordinator.read`
- `community_match.coordinator.manage`
- `community_match.progress.record`

Identity may issue only the permission needed by the current endpoint. A role
label is input to Community's separate role check, never proof of consent or
subject authority. Existing grants receive no backfill.

Fresh means issued for the exact method, internal path and recursively
key-sorted minified JSON digest in the current request. The contract should
include `expiresAt`; reject if the Community evaluation instant is after it.
A decision must not be cached or reused across actions.

## Minimum data model

Community-owned PostgreSQL/Flyway tables should extend the P5-S1 owner:

- `community_organizations`: opaque ID, status, version, timestamps;
- `community_organization_enrollments`: organization ID, opaque actor ref,
  role enum, status, version, expiry;
- `community_match_approvals`: opaque match/request IDs, organization ID,
  recipient context digest, approval state/version/expiry, minimum disclosure
  enum set, provenance digests;
- `community_match_offers`: match ID, volunteer enrollment ID, state/version,
  offer expiry, response timestamp;
- `community_capacity_reservations`: organization/volunteer IDs, bounded slot
  enum/date, state/version/expiry;
- `community_match_progress`: match ID/version, structured checkpoint enum,
  actor role, occurred-at, evidence digest;
- existing Community audit, idempotency, tombstone and outbox tables extended
  with P5-S2 aggregate types.

Do not store household names, addresses, phone/email, care notes, diagnosis,
treatment, precise location, free-form explanation or attachments. The
recipient is an opaque context ID/digest. Allowed disclosed request fields are
the P5-S1 category, province/city code and nullable day-part plus:

- service date (`YYYY-MM-DD`) or bounded date window, if explicitly consented;
- accessibility accommodation enum (`none_disclosed`,
  `mobility_access_requested`, `communication_access_requested`) only when
  included in the grant and approval;
- contact method is never in the match contract; later contact exchange is
  out of scope.

Every response has a server time, projection version, evidence expiry and
minimum-disclosure marker. Lists are bounded to 25 with sealed keyset
continuation, deterministic ordering and no totals, scores or hidden counts.

## Lifecycle invariant

```text
pending_approval -> approved -> offered -> accepted -> assigned
        |              |          |          |          |
        +-> rejected   +-> revoked+-> declined+-> revoked+-> in_progress
        +-> expired    +-> expired+-> expired             |       |
                                                        reassigned closed
                                                           |
                                                         revoked
```

- Approval is an explicit coordinator command backed by fresh coordinator
  authority and organization evidence; it is not created by P5-S1 submission.
- An offer requires approved, unexpired consent and approval plus an available
  atomic capacity reservation. There is no automatic offer/dispatch.
- Volunteer acceptance consumes the exact current offer version. Duplicate
  same-intent replay returns the same authoritative result; a different
  intent/key or stale version conflicts.
- Acceptance does not claim assignment. Assignment is a distinct coordinator
  command with fresh evidence and the accepted volunteer.
- Reassignment atomically releases the old reservation, creates/consumes a new
  reservation and increments the match version. It never rewrites history.
- Progress is append-only structured evidence and atomically increments the
  match version. Allowed checkpoints: `arrangements_confirmed`,
  `support_started`, `support_completed`, `unable_to_proceed`. These are
  coordination facts, not care outcomes.
- Close requires the current match version and an enum reason:
  `support_completed`, `recipient_cancelled`, `organization_cancelled`,
  `unable_to_proceed`. It makes no quality or clinical claim.
- Revocation is terminal for new action, releases capacity, suppresses
  protected projections, invalidates replay bodies and emits minimal evidence.
  A concurrent action may succeed only if its transaction locked and validated
  all evidence before the authoritative revocation transaction; ordering is
  proven by committed aggregate versions.

## Proposed `P5-S2-v1` operations

All protected operations are internal Gateway-to-Community JSON APIs. Each
body includes `authorizationContext`, and mutations require
`Idempotency-Key` plus `expectedVersion`. IDs are opaque and paths are
versioned.

| Operation         | Method/path                                                               | Actor and exact permission                                        | Command or result minimum                                                                     |
| ----------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Volunteer queue   | `POST /internal/v1/community/matches/volunteer/query`                     | volunteer; `community_match.volunteer.read`                       | organization ID, sealed cursor; returns bounded offered/accepted/assigned projections         |
| Coordinator queue | `POST /internal/v1/community/matches/organization/query`                  | coordinator; `community_match.coordinator.read`                   | organization ID, state filter, sealed cursor; returns bounded exception/queue projections     |
| Match detail      | `POST /internal/v1/community/matches/{matchId}/query`                     | volunteer or coordinator exact read permission                    | returns role-redacted projection and evidence expiry                                          |
| Approve/reject    | `POST /internal/v1/community/matches/{matchId}/approval`                  | coordinator; `community_match.coordinator.manage`                 | decision enum, disclosure enum set, approval expiry, expected version                         |
| Offer             | `POST /internal/v1/community/matches/{matchId}/offers`                    | coordinator; manage                                               | volunteer enrollment ID, bounded slot, offer expiry, expected version                         |
| Accept/decline    | `POST /internal/v1/community/matches/{matchId}/offers/{offerId}/response` | offered volunteer; respond                                        | response enum, expected match and offer versions                                              |
| Assign/reassign   | `POST /internal/v1/community/matches/{matchId}/assignment`                | coordinator; manage                                               | accepted offer ID, mode enum, expected version                                                |
| Progress          | `POST /internal/v1/community/matches/{matchId}/progress`                  | assigned volunteer or coordinator; record                         | checkpoint enum, expected version                                                             |
| Close             | `POST /internal/v1/community/matches/{matchId}/close`                     | assigned volunteer or coordinator with exact permission           | close reason enum, expected version                                                           |
| Revoke            | `POST /internal/v1/community/matches/{matchId}/revoke`                    | coordinator; manage; or system application of Identity revocation | reason enum (`consent_revoked`, `approval_revoked`, `organization_revoked`), expected version |
| Reconcile         | `POST /internal/v1/community/matches/reconcile`                           | same actor and exact permission as uncertain command              | client submission reference + operation enum; fresh authority required                        |

Each command has a `submissionReference` generated before dispatch.
Reconciliation never repeats a mutation. It returns confirmed current state,
not-found/non-enumerating, or still-unknown.

### Shared projection

The common role-redacted result contains only:

`matchId`, `requestId`, `organizationId`, `category`,
`provinceCityCode`, nullable `dayPart`, consented bounded service window,
consented accommodation enum, `state`, `version`, role-specific
`nextActions`, approval/offer/assignment/progress status enums, relevant
expiry, `confirmedAt`, `serverTime`, and `minimumDisclosure`.

Volunteer projections omit coordinator queue counts, other volunteers,
capacity totals and household/recipient identifiers. Coordinator projections
use opaque volunteer aliases and bounded capacity state
`available|reserved|full|unknown`; they do not expose unrelated households or
volunteer personal data.

## Idempotency and concurrency

- Store only key digest, actor/operation/route/intent digest, aggregate link
  and replay result for at most 24 hours.
- Serialize first use of the same actor/operation/key tuple before lookup.
- Same key plus same intent replays the committed result; changed intent
  returns `IDEMPOTENCY_CONFLICT`.
- Lock match, current offer and capacity rows in a deterministic order.
- Unique constraints enforce one active assignment per match, one active
  capacity reservation per volunteer/slot and one outbox row per
  aggregate/version/event type.
- Every mutation compares both expected aggregate version and subordinate
  version where applicable. A stale write returns current safe version and
  allowed recovery; it never silently overwrites.
- Loss after dispatch is `COMMUNITY_MATCH_RESULT_UNKNOWN`. The UI must use
  fresh-authority reconcile; it must not claim persisted state or retry the
  uncertain write.

## Retention, deletion and revocation

Active match fields live only until closure/revocation plus 30 days, then an
owned locked scheduler purges protected projections and replay bodies.
Unaccepted/declined/expired offers and released reservations purge after 30
days. Explicit care-recipient deletion or grant revocation immediately
suppresses reads, invalidates replay bodies and schedules active-field purge.
Content-free tombstone, audit and outbox evidence may remain for at most 365
days. Evidence includes opaque digests, enum action/outcome, aggregate version
and timestamps only.

No claim is made about production backup erasure, legal holds or regulatory
retention. Those require a later production control. Migration must prove
rollback/reapply, no P5-S1 row mutation/backfill and Community-only privileges.

## Event and audit freeze

Transactional outbox events:

- `community.match.approved.v1`
- `community.match.rejected.v1`
- `community.match.offered.v1`
- `community.match.offer_responded.v1`
- `community.match.assigned.v1`
- `community.match.reassigned.v1`
- `community.match.progress_recorded.v1`
- `community.match.closed.v1`
- `community.match.revoked.v1`

Payload: event ID/type/version, producer `community`, match aggregate ID and
version, organization ID digest, lifecycle outcome enum, progress enum when
applicable, delivery state `suppressed_not_configured`, occurred-at,
correlation and causation IDs. Exclude request fields, recipient/volunteer
IDs, authority bodies, location and capacity values. Notification delivery is
not configured and must not be claimed.

Audit records use enumerated action/outcome, opaque actor/organization/match
digests, evidence version digests, aggregate version, correlation ID and UTC
timestamp. Never log bodies, disclosure fields, role labels tied to identity,
idempotency keys, tokens or failure details from Identity.

## Stable failure contract

| Code                                   | Truth                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `COMMUNITY_MATCH_VALIDATION_FAILED`    | bounded command invalid; never uncertain                                 |
| `COMMUNITY_MATCH_NOT_FOUND`            | non-enumerating absent/inaccessible match                                |
| `COMMUNITY_MATCH_AUTHORITY_REQUIRED`   | fresh exact Identity decision or Community role evidence denied/missing  |
| `COMMUNITY_MATCH_CONSENT_REVOKED`      | exact Identity revocation evidence                                       |
| `COMMUNITY_MATCH_APPROVAL_REQUIRED`    | approval pending/rejected/expired                                        |
| `COMMUNITY_MATCH_APPROVAL_REVOKED`     | exact Community approval revocation                                      |
| `COMMUNITY_MATCH_OFFER_EXPIRED`        | offer expired before action                                              |
| `COMMUNITY_MATCH_OFFER_STATE_CONFLICT` | decline/accept/assignment incompatible with current offer state          |
| `COMMUNITY_MATCH_NO_CAPACITY`          | authoritative capacity reservation could not be made                     |
| `COMMUNITY_MATCH_VERSION_CONFLICT`     | match/offer/progress expected version stale                              |
| `COMMUNITY_MATCH_ASSIGNMENT_CONFLICT`  | active assignment or reassignment invariant conflict                     |
| `COMMUNITY_MATCH_PROGRESS_CONFLICT`    | checkpoint invalid for current state/version                             |
| `COMMUNITY_MATCH_CLOSED`               | match closed during action                                               |
| `COMMUNITY_MATCH_REVOKED`              | match revoked during action; minimum response only                       |
| `COMMUNITY_MATCH_RESULT_UNKNOWN`       | dispatch occurred but response validity/durability cannot be established |
| `COMMUNITY_ORGANIZATION_UNAVAILABLE`   | organization evidence/read unavailable; not empty/denied                 |
| `IDENTITY_SERVICE_UNAVAILABLE`         | fresh authority decision unavailable                                     |
| `COMMUNITY_SERVICE_UNAVAILABLE`        | Community unavailable before authoritative result                        |
| `IDEMPOTENCY_KEY_REQUIRED`             | mutation omitted key                                                     |
| `IDEMPOTENCY_CONFLICT`                 | key reused with different intent                                         |
| `INTERNAL_CONTRACT_INVALID`            | cross-runtime request/response failed frozen schema                      |

Concurrent accept has exactly one committed winner; the loser receives offer
state or version conflict. Duplicate accept with the same key/intent replays
the winner result. No capacity is distinct from unavailable. Offline before
dispatch is blocked/no queue; connection loss after dispatch is uncertain and
requires reconciliation. Denied and no-match reveal no protected existence,
count or reason.

## Reconciliation blockers

Before Java or product code, the canonical task must resolve and freeze:

1. whether the care recipient can authorize all five proposed scopes under one
   strictly narrowed grant or requires separate grants; this review recommends
   separate exact scopes and no backfill;
2. the bounded capacity slot representation; this review recommends
   organization-local service date plus day-part, never general availability;
3. whether volunteers may close after `support_completed`; if product review
   does not explicitly accept it, restrict close to coordinators and allow
   volunteers only to record the checkpoint;
4. the exact approval and offer maximum expiry durations;
5. the final role-redaction matrices for LB-025 and LB-026;
6. a versioned OpenAPI/JSON Schema tree, fixed Node/Java digest vectors and
   provider/consumer proof incorporating all operations and failures above.

Any broader field, automated scoring/dispatch, contact exchange, new service
or new engine is outside P5-S2 and requires explicit change control.
