# P8-S3 pre-code review — abuse, privacy lifecycle and response

Date: 2026-08-02. Scope: P8-S3 only. Base: `272a20dd953683c85a290bcfeeceedeae18797f4`.

## Objective and minimum plan

Bound abusive traffic without starving account/care recovery, make privacy work
fail closed until every frozen owner target is verifiable, preserve the actual
P5 moderation boundary, and execute one synthetic response exercise. Minimum
files are machine contracts under `contracts/security`, shared enforcement and
lifecycle validation, direct Gateway/Community corrections, focused quality
tests, one-shot Windows validation, CI, and canonical state documentation.

Acceptance is deterministic burst/bypass/recovery proof, false-completion and
policy-decision negatives, moderation provider/consumer parity, injection-safe
telemetry, and a machine-evaluated tabletop. Deferred: report ingestion,
claim/appeal UI, external gateway/provider, irreversible physical deletion,
legal retention decisions, production notification, P9 and release work.

## Independent reviews reconciled

- Abuse review found no general inbound limiter, spoof/NAT risk in the source
  dimension, unbounded public cache, moderation permission drift, and a Gateway
  reconcile route absent from Community. Recovery requires a separate bounded
  budget, never an unlimited bypass.
- Privacy review found the P7 coordinator is in-memory, per-owner digests cannot
  represent one aggregate request, reconciliation can falsely complete, and
  retention/consent propagation/residue states are not executable. Shared code
  may validate contracts but cannot own another service's data.
- Response/CI review found no executable tabletop, no full incident phase
  evidence, and no P8-S3 hosted/terminal Phase 8 gate. Evidence failures and
  pending lifecycle targets must fail closed.

## Current-source research gate

PASS WITH ASSUMPTIONS, accessed 2026-08-02. OWASP API Security Top 10 2023
API4/API6 requires endpoint-specific resource and business-flow limits; OWASP
Logging requires exclusion/masking of session, secret and sensitive-personal
fields plus CR/LF sanitization; NIST CSF 2.0 and the CISA incident playbook
support preparation, detection/analysis, containment, recovery and improvement.
These are engineering inputs, not legal approval or certification. Existing
P7-S3 product policy remains authoritative; unknown disposition stays
`POLICY_DECISION_REQUIRED`.
