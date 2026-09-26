# P6-S3 pre-code review and validation contract

Date: 2026-08-02

## Docs-first record

- Slice: `P6-S3 — Authenticated service communication and dependency isolation`.
- Outcome: an unavailable secondary service cannot corrupt confirmed core
  state; every non-local internal call has explicit least-privilege identity.
- Minimum files: service-auth/config/observability primitives, direct Gateway,
  Care, Notification, Identity and Community seams, their tests/manifests,
  `scripts/validate-p6-s3.ps1`, CI, and direct state/contract documents.
- Acceptance: valid/missing/expired/wrong-scope identity; fail-closed transport;
  bounded timeout/retry/idempotency/rate/circuit/bulkhead/payload behavior;
  truthful Notification/Community outage and recovery; redacted correlated
  health/failure/rollback evidence; cumulative P1–P6 phase gate.
- Validation: focused static/tests while editing, then exactly one local P6-S3
  Level C. Docker absence is classified under KI-004 and hosted CI supplies the
  required container proof.
- Dependencies: accepted `dev@6d7204d6272d70672a1c1f1429cdc742fd172bc0`,
  P6-S1 rolling contracts, P6-S2 artifact/classifier/aggregator invariants, and
  issue #24 reconciled in place.
- Deferred: UI/Stitch, P7/P8/DATA-S1, new infrastructure, public deployment,
  and machine-wide Docker/Windows changes.

## Independent reviewer reconciliation

Three read-only reviewers independently covered identity/security,
dependency-failure semantics, and mixed Node/Spring operations. All found the
same release blockers: destination-wide static tokens do not prove caller or
scope; production HTTP is accepted; retry/circuit/bulkhead and response bounds
are incomplete; Community write ambiguity is inconsistent; readiness and
telemetry do not attribute degradation uniformly; and P6-S2 CI does not prove
authenticated failure/recovery across the topology.

The reconciled design is the bounded contract in
`docs/security/P6_S3_THREAT_MODEL.md`. No official research micro-cycle is
needed: the remaining choices are repository-specific implementation and test
decisions, and another source would not alter scope or acceptance.

## Exactly-once candidate gate

`pnpm.cmd run validate:p6-s3` is the sole local Level C entry point. It must
retain a one-shot marker/ledger, classify any failure, and permit only targeted
continuation. Hosted exact-head proof additionally runs all six artifacts and
owned databases, authenticated valid/invalid vectors, dependency kill/recovery,
mixed-version rollback, probes, redaction and cumulative P1–P6 gates. The
accepted docs-only classifier and always-reported required aggregator name
remain unchanged.
