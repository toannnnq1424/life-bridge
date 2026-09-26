# P5-S3 contract, data, authority and moderation-policy review

## Review control

- Review: `P5-S3-R1`
- Date: 2026-07-29
- Status: **PASS WITH ASSUMPTIONS — freeze candidate for reconciliation**
- Scope: one moderator reviews and resolves one Community safety report on
  `LB-027` `/admin/moderation`
- Baseline: accepted `origin/dev@ed328f6806f1ed082708e7c84367eda6bb1bb2da`,
  P2 Identity & Consent authority, P5-S2 Community owner, ADR-019 and
  `CHG-2026-011`
- Data: bounded synthetic fields only; no real report, identity, care, medical
  or free-form evidence

This independent pre-code review freezes the minimum candidate for
reconciliation with the design/privacy/accessibility and test/CI/operations
reviews. It does not claim implementation, legal sufficiency or policy
approval. The operational retention values below extend the accepted P5
minimization baseline; they are product limits, not statements of law.

## Authority and ownership freeze

Identity & Consent remains the sole owner of subject authority. Gateway must
obtain a new request-bound P2 decision for every protected queue read, detail
read, resolution, and reconciliation request. The decision expires ten seconds
after issuance and is bound to the exact HTTP method, internal route and
recursively sorted/minified JSON request digest. It may not be cached, widened
or reused.

Introduce the purpose `community_moderation_resolution` with separate,
single-scope grants and no backfill:

- `community_moderation.queue.read`
- `community_moderation.case.read`
- `community_moderation.case.resolve`
- `community_moderation.case.reconcile`

The authorization projection is the existing bounded P2 shape: `decisionId`,
purpose, one permission, opaque `actorRef`, opaque `recipientContextId`,
`subjectVersion`, `grantId`/`grantVersion`, `privacyVersion`, `decidedAt`,
`expiresAt`, `correlationId`, and `requestDigest`. A moderator, administrator,
organizer, volunteer or member label creates neither consent nor subject
authority.

Community remains sole owner of reports, cases, redacted evidence,
moderator-enrollment evidence, policy evaluation, resolutions, tombstones,
idempotency, audit and transactional outbox. It must independently verify an
active, unexpired moderator enrollment and exact bounded policy permission in
the same transaction as a protected read or write. Gateway owns no moderation
state and must never fabricate a success from request intent. Identity,
Gateway, Care and Notification receive no Community database credentials and
perform no cross-service SQL.

The three evidence planes are independent and all must be current at the
Community evaluation instant:

| Evidence            | Owner              | Minimum Community input                                                                    | Deny when                                                                        |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Subject authority   | Identity & Consent | exact projection above                                                                     | missing, denied, expired, revoked, wrong actor/context/purpose/permission/digest |
| Moderator authority | Community          | opaque enrollment ID, actor digest, role `moderator`, status/version, policy scope, expiry | absent, inactive, expired, wrong actor or scope                                  |
| Case authority      | Community          | report/case ID and version, current state, policy version, retention/redaction versions    | inaccessible, withdrawn, expired, resolved, purged, stale or policy mismatch     |

## Policy and bounded decision vocabulary

Every case pins a versioned `moderationPolicyVersion`, `redactionPolicyVersion`
and `retentionPolicyVersion`. Policy content must be repository-reviewed and
bilingual before activation. Code must fail closed on an unknown version; it
must not invent a rule from report text or UI labels. No automated decision,
ranking, escalation, suspension or external enforcement is permitted.

Resolution outcomes are limited to:

- `no_change` — no Community visibility or participation change;
- `content_visibility_restricted` — the exact reported Community aggregate is
  hidden from ordinary Community projections;
- `community_participation_restricted` — the exact Community-owned actor
  enrollment loses Community posting/responding actions only.

Resolution reasons are neutral policy references, not findings of guilt,
danger, diagnosis or abuse validity:

- `insufficient_authoritative_evidence`
- `duplicate_report`
- `outside_moderation_scope`
- `policy_content_boundary`
- `policy_privacy_boundary`
- `policy_contact_boundary`

`no_change` permits only the first three reasons. Restrictive outcomes permit
only the final three and require explicit confirmation of outcome, affected
Community aggregate/enrollment, reason, policy version, expected case version,
and the statement that the effect is limited to LifeBridge Community. The
server revalidates the combination. There is no free-form reason, note,
comment, transcript or attachment field.

Appeal and reopening are not implemented in P5-S3. A later accepted slice may
create a new case with an opaque predecessor digest; it must never mutate the
old resolution. The UI may state that the current slice has no in-product
appeal workflow, but must not promise external review or enforcement.

## Minimum Community-owned model and disclosure

Extend Community-owned PostgreSQL/Flyway with bounded records equivalent to:

- report: opaque ID, reported aggregate type/ID digest, report category enum,
  submitted-at, lifecycle state/version, provenance digest;
- case: opaque ID, report ID, state/version, pinned policy/redaction/retention
  versions, assigned moderator-enrollment digest and timestamps;
- evidence item: opaque ID, evidence kind enum, redacted value enum/digest,
  source aggregate version, provenance type, observed-at, redacted-at;
- resolution: case/version, outcome and reason enums, exact affected aggregate
  digest, actor digest, policy versions, decided-at, result state;
- existing Community idempotency, audit, tombstone and outbox records extended
  with P5-S3 aggregate/event types.

Allowed report categories are `content_boundary`, `privacy_boundary`,
`contact_boundary`, `other_bounded`. They classify the reporter selection only
and do not assert truth. Allowed evidence kinds are
`reported_aggregate_snapshot`, `community_state_transition`, and
`prior_report_link`. Evidence exposes only category, bounded state, UTC time,
opaque provenance digest and redaction marker. It excludes names, contact
details, precise location, household/care/medical data, free text, media,
credentials, IP/device data and external-source assertions.

Queue results are capped at 25, deterministically ordered by submitted time
then opaque ID, with sealed keyset continuation and no totals or hidden counts.
Each row contains only `caseId`, category, state, version, submitted-at,
retention deadline and minimum-disclosure marker. Detail adds the bounded
evidence items, policy versions, current allowed outcomes/reasons,
`confirmedAt`, `serverTime`, and `evidenceCutoffAt`. It does not disclose the
reporter or subject identity. Missing and inaccessible use the same
non-enumerating shape, status and timing class.

## Frozen `P5-S3-v1` operations

All operations are internal Gateway-to-Community JSON APIs with
`additionalProperties:false`. Reads use POST so the authorization digest can
bind the complete bounded query. Mutations require `Idempotency-Key`, a
pre-generated `submissionReference`, and `expectedVersion`.

| Operation | Method/path                                                        | Permission       | Minimum input/result                                                                                             |
| --------- | ------------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| Queue     | `POST /internal/v1/community/moderation/cases/query`               | `queue.read`     | state filter, sealed cursor; bounded redacted rows                                                               |
| Detail    | `POST /internal/v1/community/moderation/cases/{caseId}/query`      | `case.read`      | expected projection version; one redacted authoritative case                                                     |
| Resolve   | `POST /internal/v1/community/moderation/cases/{caseId}/resolution` | `case.resolve`   | outcome, reason, policy versions, expected version, affected ref, confirmation boolean; committed resolution     |
| Reconcile | `POST /internal/v1/community/moderation/cases/reconcile`           | `case.reconcile` | submission reference and operation `resolve`; confirmed current result, non-enumerating absent, or still unknown |

The full permission strings use the `community_moderation.*` prefix listed
above. Result fields include `caseId`, state, version, outcome/reason when
committed, `decidedAt`, opaque actor digest, policy/redaction/retention
versions, `confirmedAt`, `serverTime`, and `minimumDisclosure`. A response is
authoritative only after schema validation and Community confirmation.

## Lifecycle, concurrency and uncertain delivery

```text
open -> in_review -> resolved
  |         |          |
  +-> withdrawn        +-> retained_tombstone -> purged
  +-> expired
```

- Withdrawn or expired reports cannot be resolved. Already-resolved replay is
  successful only for the same actor/operation/key/intent; otherwise it is a
  state or version conflict.
- Resolve locks the report, case, affected Community aggregate/enrollment,
  moderator enrollment, idempotency, audit and outbox in deterministic order.
  It verifies all three evidence planes and expected version before effect.
- A unique resolution per case and unique outbox tuple
  `(aggregate, version, eventType)` enforce one committed winner. Concurrent
  different decisions return version conflict and never overwrite.
- Store only the idempotency-key digest, actor/route/operation/intent digest,
  aggregate link and replay result for at most 24 hours. Same key and intent
  replays; changed intent is `IDEMPOTENCY_CONFLICT`.
- Offline before dispatch is blocked and never queued. Loss after dispatch is
  `COMMUNITY_MODERATION_RESULT_UNKNOWN`; do not retry resolution. Reconcile
  with fresh exact authority. Revoked authority prevents reconciliation from
  disclosing protected state.
- Audit or outbox insertion failure rolls back the case resolution and its
  restrictive effect. No success may be returned.

## Retention, deletion and immutable evidence

Open/in-review evidence is retained only until withdrawal/expiry/resolution.
Protected case projections and idempotent replay bodies purge within 30 days
of terminal state. Explicit subject deletion or authority revocation
immediately suppresses protected reads, invalidates replay bodies and
schedules the same purge. Content-free tombstone, audit and outbox evidence is
capped at 365 days and contains only opaque digests, enum action/outcome/reason,
policy versions, aggregate version, correlation/causation IDs and UTC times.

Deletion never rewrites a committed decision. It removes/suppresses protected
content while leaving the minimum time-bounded integrity evidence. No claim is
made about production backups, legal holds, regulatory retention or external
erasure; those require separately accepted production policy. Flyway proof
must cover rollback/reapply, no backfill or mutation of P5-S1/P5-S2 rows, and
Community-only ownership.

Transactional events are:

- `community.moderation.case_resolved.v1`
- `community.moderation.case_withdrawn.v1`
- `community.moderation.case_expired.v1`
- `community.moderation.protected_data_purged.v1`

The payload is limited to event ID/type/version, producer `community`, case
digest and version, outcome/reason when applicable, policy versions, result
state, occurred-at, correlation/causation IDs and delivery state
`suppressed_not_configured`. Notification or external enforcement delivery is
not configured and must not be claimed. Audit/outbox/logs exclude evidence
values, raw IDs, identity context, tokens, idempotency keys and failure bodies.

## Stable failure contract

| Code                                      | Truth and recovery                                             |
| ----------------------------------------- | -------------------------------------------------------------- |
| `COMMUNITY_MODERATION_VALIDATION_FAILED`  | bounded field/combination invalid; correct locally             |
| `COMMUNITY_MODERATION_NOT_FOUND`          | absent or inaccessible; non-enumerating                        |
| `COMMUNITY_MODERATION_AUTHORITY_REQUIRED` | exact fresh P2 or moderator evidence missing/denied            |
| `COMMUNITY_MODERATION_REPORT_WITHDRAWN`   | authoritative terminal state; refresh successor                |
| `COMMUNITY_MODERATION_REPORT_EXPIRED`     | authoritative terminal state; refresh successor                |
| `COMMUNITY_MODERATION_ALREADY_RESOLVED`   | authoritative resolution exists; do not overwrite              |
| `COMMUNITY_MODERATION_VERSION_CONFLICT`   | stale/concurrent version; refresh authoritative detail         |
| `COMMUNITY_MODERATION_POLICY_CONFLICT`    | policy/redaction/retention version unknown or changed          |
| `COMMUNITY_MODERATION_REDACTION_CONFLICT` | requested projection cannot meet current redaction policy      |
| `COMMUNITY_MODERATION_RETENTION_CONFLICT` | evidence expired/purged or retention invariant prevents action |
| `COMMUNITY_MODERATION_RESULT_UNKNOWN`     | dispatch may have committed; reconcile, never repeat           |
| `IDENTITY_SERVICE_UNAVAILABLE`            | no fresh decision; unavailable is not denied/empty             |
| `COMMUNITY_SERVICE_UNAVAILABLE`           | no authoritative result before dispatch or reconcile           |
| `COMMUNITY_MODERATION_AUDIT_FAILED`       | transaction rolled back; no resolution/effect committed        |
| `COMMUNITY_MODERATION_OUTBOX_FAILED`      | transaction rolled back; no resolution/effect committed        |
| `IDEMPOTENCY_KEY_REQUIRED`                | mutation omitted key                                           |
| `IDEMPOTENCY_CONFLICT`                    | key reused with different intent                               |
| `INTERNAL_CONTRACT_INVALID`               | frozen cross-runtime schema failed; do not infer success       |

Failures expose only code, localized message key, retryable boolean and
correlation ID. Denial, missing and cross-scope guesses never expose existence,
reporter, category, count, policy match or reason. Loading, empty, unavailable,
denied, conflict and uncertain are distinct truths.

## Threat controls and mandatory proof

| Threat                                  | Mandatory control/proof                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Role label grants authority             | fresh exact P2 negative matrix plus independent Community moderator check                         |
| Case/subject enumeration                | identical absent/inaccessible envelope, bounded no-total queue, cross-scope timing/error tests    |
| Sensitive payload in evidence/log/event | allowlist schemas, no free text, runtime/database sentinel scans                                  |
| Stale policy or redaction               | pinned versions, fail closed, policy/redaction race tests                                         |
| Concurrent or duplicate decisions       | row locks, expected version, unique resolution/outbox, replay/conflict tests                      |
| Restriction targets wrong aggregate     | confirmation binds affected digest and intent; Community rechecks ownership in transaction        |
| Gateway fabricates outcome              | provider/consumer schema proof; UI success only from authoritative Community response             |
| Offline client repeats action           | protected routes excluded from service worker queue; uncertain reconcile browser proof            |
| Deletion resurrects replay/evidence     | aggregate-linked invalidation, purge scheduler locks, retention/replay tests                      |
| Audit/outbox fails after state change   | one PostgreSQL transaction and injected-failure rollback tests                                    |
| Cross-service ownership bypass          | database-role/config/import scans and migration owner-isolation proof                             |
| Decision language implies guilt/safety  | enum/copy scan in VI/EN; no diagnosis, urgency, danger, abuse-validity or external-outcome claims |

## Reconciliation conditions before Java or native UI

The canonical task must reconcile this candidate with the other two reviews
and freeze `P5-S3-v1` OpenAPI/JSON Schemas, fixed Node/Java digest vectors,
provider/consumer proof, exact role-redaction matrix and bilingual policy copy.
It must explicitly accept the three outcomes, six reasons, 10-second authority
TTL, 24-hour replay limit, 30-day protected-data purge and 365-day
content-free evidence cap. Any broader outcome, appeal/reopen workflow,
free-form evidence, automated moderation/escalation, external enforcement,
new service or storage engine is outside P5-S3 and requires change control.
