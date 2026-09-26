# Phase and Slice Change Control

## Purpose

Plans are expected to evolve as research and implementation produce evidence.
No planned change may exist only in a chat. This document defines how LifeBridge
records additions, removals, reordering, replacement, and deferral.

## Change triggers

Create a record when any of the following occurs:

- a phase or slice is added, removed, split, combined, reordered, or deferred;
- acceptance criteria or validation level changes;
- a service boundary, API/event contract, data owner, or dependency changes;
- a research source changes intended behavior or invalidates an assumption;
- security, privacy, accessibility, deployment, or credential evidence changes
  the plan;
- implementation reveals work that belongs to another phase.

Minor wording fixes and implementation details within approved acceptance
criteria do not need a change record.

## Required update sequence

1. Append a change record below.
2. Update `docs/IMPLEMENTATION_PLAN.md` with both the previous and revised plan.
3. Update `docs/WORKSTREAM_BOARD.md`.
4. Update `docs/INTEGRATION_LOG.md` when branches, contracts, services, data, or
   environments are affected.
5. Add or supersede an ADR in `docs/DECISIONS.md` for durable decisions.
6. Update `docs/KNOWN_ISSUES.md` for new risks or blockers.
7. Append `docs/SESSION_LOG.md` with completed validation and exact next action.
8. Update `docs/REPOSITORY_MAP.md` only if repository structure changed.

Never rewrite history by silently replacing the old plan. Mark it superseded and
link the change identifier.

## Record template

```md
## CHG-YYYY-NNN — Short title

- Date:
- Status: proposed | approved | implemented | rejected | superseded
- Requested by:
- Evidence:
- Previous plan:
- Revised plan:
- Reason:
- Affected phases/slices:
- API/data/service impact:
- Security/privacy/accessibility impact:
- Validation impact:
- Migration/rollback:
- Documentation updated:
- Exact follow-up:
```

## Phase 0 records

### CHG-2026-001 — Windows and Codex App become the only active delivery path

- Date: 2026-07-25
- Status: implemented in Phase 0 documentation
- Requested by: project owner
- Evidence: explicit project instruction
- Previous plan: mixed Windows/macOS ownership and VS Code/Cline/9Router tooling
- Revised plan: Windows with Codex ChatGPT desktop app; Stitch through
  repository-scoped Codex MCP configuration
- Reason: align the delivery path with the actual project environment
- Affected phases/slices: all
- API/data/service impact: none
- Security/privacy/accessibility impact: Windows accessibility matrix retained;
  legacy credential incident remains historical evidence
- Validation impact: CI and doctor are Windows-first
- Migration/rollback: historical documents are preserved and marked
- Documentation updated: active foundation and Stitch runbooks
- Exact follow-up: pass offline configuration validation, then complete the
  credential and read-only canary gates

### CHG-2026-002 — Add bilingual recent-data research lane

- Date: 2026-07-25
- Status: implemented for the Phase 0 baseline; promotion branches pending
- Requested by: project owner
- Evidence: explicit requirement to evaluate data from the last five to ten years
- Previous plan: fixture design without a dedicated research branch
- Revised plan: `init/research → data → dev`, with a 2016–2026 evidence window
  and priority on 2021–2026 sources
- Reason: ground product and fixture decisions in recent, traceable evidence
- Affected phases/slices: Phase 0 research baseline and later data-dependent slices
- API/data/service impact: source provenance and fixture metadata become required
- Security/privacy/accessibility impact: no raw PII; public does not imply
  redistributable
- Validation impact: source freshness, license, geography, limitations, and
  intended use must be checked
- Migration/rollback: research findings may be superseded, never silently erased
- Documentation updated: `docs/research/`, `data/`, roadmap and branch policy
- Bootstrap exception: the initial research governance/register documents are
  part of the single coherent `phase/0-foundation` commit because the governed
  branches did not exist before Phase 0. This exception contains no raw dataset
  or product fixture. After the baseline branches are created, every new
  research artifact starts on `init/research` and reaches product work only
  through review into `data`, then `dev`.
- Exact follow-up: promote only approved synthetic/licensed artifacts from
  `init/research` into `data`

### CHG-2026-003 — Adopt the research-driven runbook as a planning overlay

- Date: 2026-07-26
- Status: implemented in planning/governance documentation
- Requested by: project owner
- Evidence: supplied
  `LIFEBRIDGE_RESEARCH_DRIVEN_ULTRA_EXECUTION_RUNBOOK.md`, SHA-256 recorded in
  `docs/RUNBOOK_ADOPTION.md`, plus independent scoped reviews
- Previous plan: P0–P6 roadmap with source governance but no formal phase gate,
  slice micro-cycle, assumption register, or external-runbook crosswalk
- Revised plan: keep P0–P6/P1-S1 order; add risk-tiered research gates,
  evidence-to-action traceability, trigger-based re-checks, shared risk catalog,
  assumption register, and GitHub issue/milestone plan
- Reason: gain the useful detail of the 16-phase/85-slice runbook without
  delaying the first end-to-end MVP or creating a second source of truth
- Affected phases/slices: every future phase/slice; no accepted slice ID or order
  changes
- API/data/service impact: none immediately; future source/assumption IDs become
  traceable inputs to acceptance and tests
- Security/privacy/accessibility impact: high-risk evidence and review gates are
  explicit; user research requires consent/data-handling controls
- Validation impact: docs/schema/provenance checks are offline; no CI live-link
  scraping; each slice selects only applicable edge risks
- Migration/rollback: remove the overlay documents/rules and retain the original
  P0–P6 baseline; never import the 4.9 MB external file as state
- Documentation updated: Codex rules, implementation plan, runbook crosswalk,
  research protocol/assumptions, test/release controls, GitHub planning
- Exact follow-up: create labeled/milestoned GitHub issues for the accepted
  P0–P6 slices, then start only `P1-S1` or the separate data research slice

### CHG-2026-004 — Expand the compact roadmap into production maturity phases

- Date: 2026-07-26
- Status: implemented; documentation and GitHub execution objects synchronized
- Requested by: project owner
- Evidence: explicit requirement for a real production-quality microservice
  system rather than demo-only completion, followed by approval to continue
  through the expanded phases
- Previous plan: validated P0, product phases P1–P5, and one overloaded P6 that
  combined offline/conflict hardening, operations, deployment, demo, and release
- Revised plan: preserve P0, exact `P1-S1`, and P2–P5; replace former P6 with
  P6 microservice platform, P7 data/event reliability, P8 security/privacy,
  P9 SLO/resilience/incident/DR, P10 performance/capacity/cost, P11 production
  rollout/release, and P12 post-launch operations
- Reason: a single late hardening phase cannot provide sufficient contract,
  data, security, reliability, performance, deployment, and operational proof
  for a production microservice system
- Affected phases/slices: P6–P12; existing open GitHub issues #18–#20 are
  preserved and remapped; P0–P5 identities/order do not change
- API/data/service impact: later gates now require rolling contract
  compatibility, independent artifacts, service identity, owned migrations,
  replay/reconciliation, recovery, and production fitness evidence
- Security/privacy/accessibility impact: controls remain required in every
  product slice and gain dedicated cross-release verification; no late phase is
  permission to defer an applicable early control
- Validation impact: adds mixed-version, restore, security, SLO/DR,
  load/soak/capacity, staged-rollout, and live-operations phase gates
- Migration/rollback: revert to the previous P0–P6 sequence only through a
  superseding Change ID; completed evidence is never rewritten
- Documentation updated: active plan, product/architecture/quality/operations
  controls, GitHub plan, board, decisions, integration/session state
- Exact follow-up: sync milestones/issues, resolve hosted CI, then start only
  the unchanged P1-S1 or separate DATA-S1 task

### CHG-2026-005 — Required MCP timeout becomes integration debt

- Date: 2026-07-26
- Status: accepted; first Stitch debt open
- Requested by: project owner
- Evidence: explicit rule that a required MCP not made safely callable within
  three minutes becomes technical debt that must be paid before deployment
- Previous plan: external MCP gates could remain blocked with an exact owner
  action but had no universal timer or release-wide debt class
- Revised plan: after 180 seconds, create/update an `MCP-DEBT-*` record and
  GitHub `mcp-debt` issue with owner, affected criteria, safe fallback,
  egress/schema/security review, validation, and deploy-blocking state
- Reason: keep unrelated work moving without silently deleting a required
  integration or weakening release acceptance
- Affected phases/slices: every MCP-dependent slice; all unresolved required
  MCP debt blocks P11 deployment, `test -> main`, and release
- API/data/service impact: none until a specific MCP contract is accepted
- Security/privacy/accessibility impact: a credential pasted into chat, Git,
  an issue, or a log never satisfies provisioning; least privilege, schema and
  side-effect review, synthetic canary, and redacted evidence remain mandatory
- Validation impact: supplying a server later does not close debt until safe
  configuration, discovery, canary, and affected acceptance evidence pass
- Migration/rollback: debt may be closed, superseded by an accepted non-MCP
  solution, or remain a release blocker; it is never silently deleted
- Documentation updated: operating contract, security/deployment/release,
  known issues, board, integration/session state, GitHub taxonomy
- Exact follow-up: retain Stitch production UI as blocked, revoke the key
  disclosed in chat, and inject a fresh restricted non-production replacement
  through an approved runtime secret mechanism in a new/restarted task

### CHG-2026-006 — Authorize one bounded disposable Stitch design session

- Date: 2026-07-26
- Status: implemented for the bounded design session; deployment gate remains
- Requested by: project owner
- Evidence: explicit clarification that the supplied key is non-production,
  disposable, and authorized only to create the required LifeBridge UI before
  commit
- Previous plan: every key disclosed in chat was rejected from all use
- Revised plan: use this one key in process memory only against
  `https://stitch.googleapis.com/mcp` for the private synthetic LifeBridge
  project, schema discovery, design system, and P1 handoff screens; never
  persist or echo it, and stop using it before diff/commit review
- Reason: UI is required to originate through Stitch MCP and the owner accepts
  the bounded non-production quota/exposure risk
- Affected phases/slices: `GATE-P1` and P1 UI handoff only
- API/data/service impact: none; Stitch output remains untrusted design input
- Security/privacy/accessibility impact: synthetic data only; no real
  household/care data; complete schema/side-effect review; repository/history
  secret scans; provider-side retirement required before deployment
- Validation impact: read back the created project/design/screens, review
  accessibility/privacy/truthfulness, confirm no unexpected local mutation,
  then run secret and Git diff checks
- Migration/rollback: stop calls, remove any local credential material if found,
  retire the key at the provider, preserve only redacted project/screen
  references and reviewed artifacts
- Documentation updated: operating/security/integration/session and Stitch
  canary/handoff evidence without recording the credential
- Exact follow-up: in P1-S1, freeze the repository-owned contracts, resolve the
  documented design corrections, and complete accessibility/privacy/security
  review before changing the handoff from Design review to Frozen. Provider-side
  key retirement and usage review remain required before deployment.

### CHG-2026-007 — Bootstrap default-branch workflow discovery through one PR

- Date: 2026-07-26
- Status: implemented; hosted workflow registered
- Requested by: project owner through the conditional Phase 0 CI recovery gate
- Evidence: Actions was enabled with all actions allowed, but GitHub reported
  zero workflows/runs/checks; the Actions UI remained at `Get started`; closing
  and reopening PR #21 emitted no run because default `main` had no workflow
- Previous plan: `main` receives release work only from `test`; no bootstrap
  branch was expected after the initial repository commit
- Revised plan: create one short-lived `phase/0-ci-bootstrap` branch from
  `main`, add only the guarded Phase 0 workflow, review it in PR #41, and merge
  it with a merge commit before retriggering PR #21
- Reason: GitHub requires default-branch workflow registration before the
  existing governed PR workflow can produce hosted checks
- Affected phases/slices: Phase 0 CI registration only; no product slice or
  release promotion is accepted by this exception
- API/data/service impact: none
- Security/privacy/accessibility impact: pinned actions, read-only token,
  credential persistence disabled, and no sensitive payload or product data
- Validation impact: the README-only `main` bootstrap push may skip Phase 0
  package steps; any pull request without the baseline fails closed; branches
  with `package.json` run the complete Phase 0 validation and dependency audit
- Migration/rollback: the workflow is reviewable in Git history; the short-lived
  branch is deleted only after its commit is reachable through the merge
- Documentation updated: CI/change/decision/integration/known-issue/session state
- Exact follow-up: require the full hosted check on the final PR #21 commit;
  this exception cannot be reused for product or release code

### CHG-2026-020 — Reconcile issue #24 to accepted P6-S3 scope

- Date/status: 2026-08-02; product accepted, docs-only closeout pending.
- Planned baseline: issue #24 described topology-only P6-S3 while the accepted
  plan defines authenticated communication and dependency isolation.
- Actual: retain and update #24; implement scoped assertions, protected
  transport config, bounded dependency guards and truthful recovery.
- Reason/evidence: accepted dispatch and three independent pre-code reviews.
- Impact: direct HTTP/config/auth, Care Notification dispatch, health,
  telemetry, manifests, tests and CI; no UI/data-owner/datastore changes.
- Validation: focused Node/Spring proof, one Level C, PR #77 exact head
  `8450adb` green across 14 checks, merge `08fd1c8`, and automatic `dev` run
  `30724770738` green across all seven checks.
- Follow-up: merge docs-only closeout, close #24 bilingually, derive but do not
  start P7-S1.
- Decision state: accepted.

## `CHG-2026-021` — P7-S1 executable migration ownership

- Planned baseline: service-owned migrations, N-1/N compatibility and
  roll-forward/compensation, without an executable four-owner protocol.
- Actual: machine owner ledger; Node checksum/advisory-lock protocol; retained
  Flyway validation; distinct production runtime/migrator config; additive N.
- Reason/evidence: exact dispatch, frozen inventory and three independent
  ownership, tooling and security/operations reviews.
- Impact: P7-S1 only; no UI, engine, service, shared schema, P7-S2/P7-S3 or
  release work.
- Validation: focused proof, one Level C and hosted exact-head PostgreSQL/
  Flyway/mixed-runtime gate before merge.
- Follow-up: merge-commit to dev, post-merge CI and bilingual #25 closeout;
  P7-S2 only in a fresh task.
- Decision state: accepted; candidate validation pending.

# CHG-2026-022 — household-scoped legacy task authorization

| Field                 | Decision                                                                                                                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Planned baseline      | P8-S1 hardens the existing household/resource surface without adding a role, IdP or datastore.                                                                                                                                                                             |
| Actual implementation | Production P1 task/member/dashboard/notification calls require a fresh Identity decision and household-scoped owner route. Ambiguous object-only URLs remain fixture-only.                                                                                                 |
| Reason/evidence       | Three reviews found the historical fixture actor bypass and that an object-only URL cannot authorize without disclosing or trusting its owner.                                                                                                                             |
| Impact                | Additive API paths/permissions; local fixture demo remains compatible. No UI, role, shared table, credential or engine change.                                                                                                                                             |
| Validation            | Deny-default matrix, two-household BOLA/IDOR, current decision/version binding, production fixture guard and exact service-key binding passed focused/Level C proof; exact-head runs `30735140477`/`30735160950` and dev run `30735583092` passed hosted cumulative gates. |
| Follow-up             | Bounded docs-only closeout and bilingual #28 closure; do not start P8-S2.                                                                                                                                                                                                  |
| Decision state        | Accepted at `dev@4da952eb97e72dbf8d9a6103a6e83438df292848`.                                                                                                                                                                                                                |

# CHG-2026-023 — Reconcile P8-S2 canonical ownership and executable hardening scope

<!-- P8-S3 candidate: CHG-2026-024 is recorded at the end of this document. -->

- Planned baseline: issue #29 still described the superseded privacy-lifecycle slice while the accepted P0–P12 plan assigns P8-S2 to secrets, encryption, runtime and supply chain.
- Actual implementation: retain issue #29 and reconcile it in place; implement the accepted P8-S2 inventory, bounded rotation/encryption, runtime least privilege and digest-bound SBOM/provenance/scanning gate.
- Reason/evidence: exact accepted dispatch plus three independent pre-code reviews and current official-source research.
- Impact: direct security/config/runtime/artifact/workflow/test contracts only; P8-S3, services, datastore ownership and release order are unchanged.
- Validation: focused Node/Spring/fitness proof and sole Level C `096bf28d2bb54bc1bbd637a2b767a0d5` passed; exact head `8617f2021d84af5befcfb5582a91b5b30c90abd2` passed automatic push/PR runs `30737326707`/`30737393207`; PR #87 merged as `1e884b9651d6df6f2df77d25164c13ff9bfe5fc9`, and automatic dev run `30737823547` passed the full P1-through-P8-S2 path.
- Follow-up: complete this bounded docs-only closeout, close #29 bilingually and remove the phase branch; P8-S3 remains a fresh task.
- Decision state: accepted at `dev@1e884b9651d6df6f2df77d25164c13ff9bfe5fc9`.

# CHG-2026-024 — Reconcile P8-S3 abuse, privacy lifecycle and response scope

- Planned baseline: issue #30 retained stale P8-S2 secrets/supply-chain scope.
- Actual: reconcile #30 in place; add topology-specific admission budgets,
  truthful lifecycle states/reconciliation, supported moderation recovery and a
  synthetic machine-evaluated response exercise.
- Reason/evidence: accepted dispatch, three independent reviews and current
  OWASP/NIST/CISA primary-source research.
- Impact: P8-S3 contracts, Gateway/Community boundary, shared validation, tests
  and CI. No provider, datastore, appeal/report workflow, irreversible deletion,
  legal matrix, P9 or release work.
- Validation: focused continuation passed after the sole Level C
  pre-initialization runner failure. Exact head `9a62acd` passed 26 PR checks;
  PR #89 merged as `adf0bad`; dev run `30739630918` passed Phase 8.
- Follow-up: merge docs-only closeout, close #30 and remove the phase branch.
- Decision state: accepted at `dev@adf0bad67a43d9dac73b0ce7cc540b60f7bb8ee8`.

# CHG-2026-026 — P9-S2 truthful offline/conflict/degradation contract

- Planned baseline: P9-S2 required a frozen journey inventory and truthful
  reusable outage/conflict states but did not select queue authority/storage or
  a cross-journey confirmation envelope.
- Actual: freeze every actual Gateway mutation; default block offline writes;
  allow only bounded current-tab task-create intent; add authoritative evidence,
  dispatch uncertainty and deterministic reconcile semantics; retain P7/P8/P9-S1
  boundaries and corrected Frozen Stitch native states.
- Reason/evidence: three independent reviews plus current RFC/MDN/W3C evidence
  found that connectivity hints, retryable 503s and duplicated UI states cannot
  prove dispatch, authority or confirmation.
- Impact: shared contracts/telemetry, Care task-create UI, cumulative browser
  expectation, resilience inventory/tests/runbook and state docs. No service
  owner, table, migration, provider, persistence engine or P9-S3 work.
- Validation: focused contract/fitness/type/lint/browser/build, then exactly one
  local P9-S2 Level C. Hosted evidence is intentionally deferred by owner hold.
- Follow-up: one `[skip ci]` branch push, verify no run, stop at
  `READY_FOR_USER_CI_WAKE`; later owner wake handles #18/PR/hosted gates.
- Decision state: accepted local candidate; not canonical acceptance.
