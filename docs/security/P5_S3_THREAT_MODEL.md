# P5-S3 reconciled contract and threat model

Status: **Frozen — P5-S3-v1**

Date: 2026-07-29

Accepted base: `origin/dev@ed328f6806f1ed082708e7c84367eda6bb1bb2da`

This record reconciles the three mandatory independent pre-code reviews:

- `docs/research/P5_S3_CONTRACT_DATA_AUTHORITY_REVIEW.md`;
- `docs/design/reviews/P5_S3_STITCH_HANDOFF.md`;
- `docs/testing/P5_S3_TEST_CI_OPERATIONS_REVIEW.md`.

There is no unresolved conflict between them. Production code may implement
only the frozen boundary below.

## Frozen authority, policy, and ownership

Every queue read, case read, resolution, and reconciliation requires a fresh
P2 decision for purpose `community_moderation_resolution`, one exact
`community_moderation.*` permission, the exact request digest, and a maximum
ten-second lifetime. Role labels never grant authority. Community separately
verifies its moderator enrollment and owns all report, case, evidence,
resolution, idempotency, audit, outbox, redaction, and retention state.

`P5-S3-v1` accepts three outcomes (`no_change`,
`content_visibility_restricted`, `community_participation_restricted`) and six
neutral reasons (`insufficient_authoritative_evidence`, `duplicate_report`,
`outside_moderation_scope`, `policy_content_boundary`,
`policy_privacy_boundary`, `policy_contact_boundary`). The server rejects
invalid pairs. No free-form moderation payload is accepted or persisted.

The pinned policy values are technical product limits, not legal claims:
idempotent replay is capped at 24 hours, protected terminal projections purge
within 30 days, and content-free integrity evidence is capped at 365 days.
Appeal/reopen, automatic resolution/escalation/suspension, external
enforcement, and any finding of guilt, danger, diagnosis, urgency, abuse
validity, eligibility, safety, or endorsement are outside this slice.

## Frozen contract and failure truth

The language-neutral surface contains queue, detail, resolve, and reconcile
commands/results; a resolved event; immutable privileged-read and resolution
audit evidence; and the stable failures enumerated by the contract review.
All schemas are closed and all protected failures are non-cacheable. Missing
and inaccessible cases share one anti-enumerating envelope.

Resolve is version-bound and idempotent. One PostgreSQL transaction commits
the case transition, bounded Community restriction, idempotency result, audit,
and outbox; any required write failure rolls all of them back. Concurrent
different decisions produce one winner and one conflict. A lost response after
dispatch is uncertain and may only be reconciled with fresh exact authority;
the command is never blindly repeated.

## Frozen UI and threat controls

Only `/admin/moderation` (`LB-027`) is implemented. It shows a capped redacted
queue and minimum evidence/provenance, uses an explicit confirmation for a
restrictive outcome, and moves focus to a safe successor or persistent result
after resolution. Loading, empty, denied/missing, withdrawn, expired, already
resolved, stale/concurrent, invalid pair, redaction/retention conflict,
Identity/Community unavailable, audit/outbox failure, offline-blocked, and
uncertain reconciliation remain distinct in VI/EN.

Required proof covers altered authority bindings, anti-enumeration, schema
digests, provider/consumer parity, Flyway V3 rollback/reapply/no-backfill and
owner isolation, deterministic concurrency, transactional fault injection,
privacy sentinel scans, browser runtime truth, keyboard/focus/reflow/contrast,
forced colors, reduced motion, and axe. KI-016 and KI-019 remain open; the
Stitch reference is design input and is not a standalone visual-conformance
claim.
