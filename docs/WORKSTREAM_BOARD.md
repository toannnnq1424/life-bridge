# LifeBridge Workstream Board

## Board control

- Updated: 2026-07-26
- Active scope: none; P1-S1 is accepted and P2-S1 has not started
- Most recent integrated product branch: `phase/1-accountable-task-loop -> dev`
- Next product item: `P2-S1 — Account access and accessible onboarding` in a
  fresh task; not started
- Rule: one conversation owns one phase or one slice

Status on this board is operational intent. Validation evidence belongs in `docs/SESSION_LOG.md`; integration/branch evidence belongs in `docs/INTEGRATION_LOG.md`.

## Phase 0 board

| Workstream                | Current outcome                                                 | Owner role         | Status            | Dependency/gate                                 | Exit evidence                                         |
| ------------------------- | --------------------------------------------------------------- | ------------------ | ----------------- | ----------------------------------------------- | ----------------------------------------------------- |
| Governance and product    | Repository-specific rules, product, architecture, roadmap, ADRs | Lead orchestration | Validated         | Cross-document consistency                      | Docs validation and reviewed diff                     |
| Repository map and memory | Accurate map, session/known-issue continuity                    | Repository steward | Validated         | Actual file/tooling layout                      | Map validation and exact next step                    |
| Windows bootstrap/doctor  | Idempotent safe setup on PowerShell 5.1+                        | Platform           | Validated         | Installed Node/Git/pnpm; environment visibility | Two fresh-worktree bootstrap runs; doctor pass        |
| Quality and CI            | Format, lint, type, unit baseline, build, secret scanning       | Quality/platform   | Validated         | Tooling scaffold                                | `pnpm.cmd validate:phase0` pass                       |
| Research/data governance  | Bilingual register/glossary and 2016–2026 evidence policy       | Data/research      | Validated         | Public source metadata and terms                | Register/matrix validation; no raw microdata          |
| Design and Stitch         | Governed screen backlog, canary, and P1 review handoff          | Design/security    | P1 handoff Frozen | Deployment credential review remains KI-001     | Handoff v1.0, redacted provenance, no imported source |
| Integration readiness     | Branch flow, GitHub catalog, promotion, fresh-worktree evidence | Integration        | Validated         | PR-only exact-head checks                       | P0 and P1 merge/check evidence                        |

No owner role may mark another row complete without its evidence/handoff. Parallel work preserves unrelated dirty files.

## Known environment/external gates

| Gate                                    | Classification                   | Current handling                                                                                   | Prohibited shortcut                                                              | Exact acceptance action                                                    |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Docker host versus sandbox visibility   | Environment isolation, mitigated | Current task reaches client/server 27.5.1; restricted contexts may warn                            | Do not elevate or edit services/Registry/firewall/Docker config automatically    | Recheck in the first Docker-owning slice and classify by execution context |
| PowerShell blocks package `*.ps1` shims | Environment policy, mitigated    | Use `npm.cmd`, `npx.cmd`, `pnpm.cmd`                                                               | Do not change machine-wide Execution Policy                                      | Canonical commands succeed through `.cmd`                                  |
| `MCP-DEBT-2026-001` deployment gate     | Security/integration debt        | P1 handoff v1.0 is Frozen; credential retirement/usage review remains unconfirmed                  | Do not reuse/log/persist the credential or claim deployment-ready                | Confirm provider retirement/usage review before deployment                 |
| Branch protection unavailable           | Platform limitation, controlled  | Hosted CI is registered; P1 exact-head and post-merge runs passed while enforcement remains manual | Do not bypass PR/check review, direct-push protected lanes, or claim enforcement | Reassess plan/visibility and retain manual exact-SHA/check review          |

Gates block only dependent validation/work. They do not authorize broad system repair and do not make unrelated Phase 0 documentation fail.

## Roadmap queue

| Priority | Item                                    | Status           | Starts only when                         | Completion handoff                           |
| -------- | --------------------------------------- | ---------------- | ---------------------------------------- | -------------------------------------------- |
| 0        | `P0` Foundation                         | Validated        | Approved plan                            | Validated foundation commit; exact P1 action |
| 1        | `P1-S1` Accountable care-task loop      | Validated/merged | PR #42; exact-head and post-merge CI     | Issue #5 closed completed                    |
| 2        | `P2-S1` Account access/onboarding       | Planned          | Fresh task from current integrated `dev` | Auth/accessibility flow                      |
| 3        | `P2-S2` Household/invitation/context    | Planned          | P2-S1 passes                             | Household authorization flow                 |
| 4        | `P2-S3` Consent/privacy/audit/settings  | Planned          | P2-S2 passes                             | Consent/revocation/audit flow                |
| 5        | `P3-S1` Timeline/handoff                | Planned          | P2 trust boundary passes                 | Timeline/handoff flow                        |
| 6        | `P3-S2` Calendar/appointment            | Planned          | P3-S1/time contract                      | Calendar/agenda flow                         |
| 7        | `P3-S3` Care-plan review                | Planned          | P2 consent + P3 time                     | Versioned care-plan flow                     |
| 8        | `P4-S1` Medication reminder             | Planned          | P3 time + Notification reliability       | Non-clinical reminder flow                   |
| 9        | `P4-S2` Emergency plan                  | Planned          | Consent + offline threat review          | Offline-readable configured plan             |
| 10       | `P4-S3` Document vault                  | Planned          | Consent/audit + storage ADR              | Synthetic document flow                      |
| 11       | `P5-S1` Help request/directory          | Planned          | Research + consent + community boundary  | Consented request/search                     |
| 12       | `P5-S2` Match/organization              | Planned          | P5-S1                                    | Minimum-data match flow                      |
| 13       | `P5-S3` Moderation                      | Planned          | P5-S2 + policy                           | Auditable resolution flow                    |
| 14       | `P6-S1` Contract rolling compatibility  | Planned          | P1–P5 service inventory accepted         | Mixed-version primary flow                   |
| 15       | `P6-S2` Independent artifacts/ownership | Planned          | P6-S1                                    | Independently runnable services              |
| 16       | `P6-S3` Service auth/failure isolation  | Planned          | P6-S1/S2                                 | Protected, bounded dependency behavior       |
| 17       | `P7-S1` Owned migrations                | Planned          | P6 gate                                  | Compatible schema upgrade                    |
| 18       | `P7-S2` Event replay/reconciliation     | Planned          | P7-S1                                    | Recoverable idempotent delivery              |
| 19       | `P7-S3` Data lifecycle/recovery         | Planned          | P7-S1/S2; P2 consent                     | Restore/retention/deletion evidence          |
| 20       | `P8-S1` Isolation/consent enforcement   | Planned          | P2; P6/P7                                | Authorization isolation matrix               |
| 21       | `P8-S2` Secrets/runtime/supply chain    | Planned          | P8-S1; hosted CI                         | Rotation/SBOM/provenance evidence            |
| 22       | `P8-S3` Abuse/privacy response          | Planned          | P8-S1/S2                                 | Safeguards and tabletop evidence             |
| 23       | `P9-S1` Observability/SLO baseline      | Planned          | P6–P8 release journeys                   | Redacted journey telemetry/SLO               |
| 24       | `P9-S2` Offline/conflict/degradation    | Planned          | P9-S1; frozen journey list               | Truthful reusable failure states             |
| 25       | `P9-S3` Incident/DR game day            | Planned          | P7-S3; P8-S3; P9-S1/S2                   | Alert/runbook/restore/postmortem             |
| 26       | `P10-S1` Workload/performance budgets   | Planned          | P9 telemetry                             | Measurable representative baseline           |
| 27       | `P10-S2` Load/soak/backpressure/scale   | Planned          | P10-S1; P9-S3                            | Correct bounded behavior under load          |
| 28       | `P10-S3` Capacity/cost guardrails       | Planned          | P10-S2; target platform                  | Capacity and alerted cost envelope           |
| 29       | `P11-S1` Production deploy/rollback     | Planned          | P6–P10; zero deploy debt                 | Reproducible protected environment           |
| 30       | `P11-S2` Staged rollout/pilot           | Planned          | P11-S1                                   | Rehearsed canary and rollback                |
| 31       | `P11-S3` Evidence-backed release        | Planned          | P11-S2; zero release blockers            | Truthful tagged release                      |
| 32       | `P12-S1` Live operations/postmortem     | Planned          | P11 release                              | Alert-to-resolution ownership                |
| 33       | `P12-S2` Patch/rotation/restore cadence | Planned          | P12-S1                                   | Exercised maintenance continuity             |
| 34       | `P12-S3` Feedback/next roadmap          | Planned          | P12-S1/S2; privacy-safe evidence         | Governed successor roadmap                   |

Only the first eligible item may move to In progress in a new conversation.

## Integration lanes

```text
Public bilingual research
  init/research -> data

Reviewed data contracts/fixtures
  data -> dev

Product/tooling phase work
  phase/* -> dev

Integrated phase candidate
  dev -> test

Validated release
  test -> main
```

Promotion requirements:

- source and target purpose match;
- required validation is current after the last relevant change;
- change/ADR/integration/session records agree;
- no secret, PII, raw microdata, local environment, or unrelated dirty file is staged;
- migrations/contracts have owner and compatibility/rollback evidence;
- UI has redacted design handoff/screenshots where relevant.
- every arrow is a pull request; cross-lane promotions use merge commits so
  GitHub Network retains ancestry and convergence;
- no decorative/stale branch or unreconciled production hotfix remains.

## Handoff contract

Every row leaving In progress must record:

- objective and acceptance status;
- planned versus actual;
- files/contracts/migrations changed;
- decisions and Change IDs;
- commands/results and deferred checks;
- environment/external blockers;
- integration target and merge order;
- known limitations;
- exact next phase/slice and first action.

## Change queue

For every new proposal, add a stable `CHG-YYYY-NNN` row before implementation:

| Change ID      | State                                | Planned baseline                                           | Proposed/actual                                                         | Reason/evidence                                            | Downstream impact                                                     | Validation                                                | Follow-up                                                                           |
| -------------- | ------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `CHG-2026-001` | Implemented                          | Mixed Windows/macOS and legacy delivery tools              | Windows + Codex App only                                                | Project-owner direction and actual host                    | All phases use one supported control plane                            | Windows CI/doctor and offline Codex config validation     | Credential and read-only Stitch canary gates                                        |
| `CHG-2026-002` | Baseline implemented; lane pending   | No dedicated research branch                               | Bilingual 2016–2026 register; `init/research → data → dev`              | Project-owner requirement for recent evidence              | Provenance/fixture gates apply to data-dependent slices               | Source/license/privacy review; branch promotion evidence  | Create branches, then start `research/aggregate-context-fixture` on `init/research` |
| `CHG-2026-003` | Implemented                          | Compact P0–P6 plan without formal research overlay         | Runbook crosswalk, protocol, assumptions, risk catalog, and GitHub plan | Project-owner supplied ultra runbook                       | All future phases/slices gain bounded evidence gates; order unchanged | Targeted docs/schema review; 19/19 GitHub metadata audit  | Use issue #5 for P1-S1 or separate issue #4 on `init/research`                      |
| `CHG-2026-004` | Implemented in docs/GitHub           | One overloaded production P6                               | Preserve P0–P5; expand cumulative production proof through P6–P12       | Production microservice requirement                        | Adds contract/data/security/SLO/performance/rollout/operations gates  | 21-slice GitHub audit and phase-specific Level D          | Retain exact P1-S1 next action                                                      |
| `CHG-2026-005` | Accepted; debt open                  | External MCP blocker without universal timer               | Required MCP becomes `MCP-DEBT-*` after 180 seconds                     | Project-owner operating rule                               | Dependent work blocked; unrelated safe work continues; P11 blocked    | Safe secret, schema/egress review, synthetic canary       | Close `MCP-DEBT-2026-001` before Stitch UI/P11 deployment                           |
| `CHG-2026-006` | Bounded design session complete      | Chat-disclosed keys rejected from every call               | One disposable non-production Stitch session in memory only             | Explicit owner authorization                               | P1 handoff v1.0 Frozen; credential retirement remains a deploy gate   | Redacted handoff, secret/history scans, P1 hosted CI      | Retire/review the credential before deployment                                      |
| `CHG-2026-007` | CI bootstrap operational             | `main` receives only normal release promotion              | One guarded workflow-only PR #41 registered default-branch CI           | Zero workflows after PR #21 reopen                         | Hosted exact-head gates now run; branch enforcement remains manual    | PR #21 and P1 PR #42 hosted evidence                      | Require green exact-head checks for later PRs; never reuse for product code         |
| `CHG-2026-008` | Integrated; hosted validation passed | P1 draft did not fix the one notification trigger/audience | Completion notifies distinct creator; self-completion is suppressed     | Issue #5 accountable cross-user outcome and contract audit | API/event/data/UI/tests; phase order unchanged                        | PostgreSQL 5/5; browser 4/4; Level C and hosted CI passed | Revisit real audience/preferences only in P2 or a later accepted slice              |
| `CHG-2026-009` | Integrated; hosted validation passed | Next build with deny-by-default lifecycle policy           | Exclude unused Sharp; scope PostCSS 8.5.18 override to Next 16.2.11     | Reviewed high advisories and Next registry ranges          | Supply chain/build only; product/API/data/order unchanged             | Audit/build/runtime/browser, Level C and hosted CI passed | Reopen on image pipeline; retire override on a natively patched Next release        |

Mirror accepted changes in `docs/IMPLEMENTATION_PLAN.md`; add an ADR for architecture/product policy, an integration-log entry for contract/promotion impact, and a session-log entry for evidence.

## Exact next handoff

P1-S1 is accepted: feature head `6ec1be3` passed exact-head hosted run
`30183168519`, PR #42 merged as `cea4f83`, post-merge `dev` run `30183280672`
passed, and issue #5 is closed completed. The earlier hosted portability and
masking failures remain in the integration/session evidence.

Open one fresh task from current integrated `dev` for `P2-S1 — Account access
and accessible onboarding`. First freeze real identity, session, household
authorization, recovery, language, and accessibility-preference contracts.
Do not start UI code before that gate. [`DATA-S1` issue #4](https://github.com/toannnnq1424/life-bridge/issues/4)
remains a separate `init/research` lane; never combine it with P2-S1. The P1
closeout did not start either scope.
