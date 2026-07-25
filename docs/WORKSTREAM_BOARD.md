# LifeBridge Workstream Board

## Board control

- Updated: 2026-07-26
- Active scope: `P0 — Foundation` (validated/closed)
- Active branch intent: `phase/0-foundation -> dev`
- Next product item: `P1-S1 — Accountable care-task loop`
- Rule: one conversation owns one phase or one slice

Status on this board is operational intent. Validation evidence belongs in `docs/SESSION_LOG.md`; integration/branch evidence belongs in `docs/INTEGRATION_LOG.md`.

## Phase 0 board

| Workstream                | Current outcome                                                 | Owner role         | Status    | Dependency/gate                                        | Exit evidence                                  |
| ------------------------- | --------------------------------------------------------------- | ------------------ | --------- | ------------------------------------------------------ | ---------------------------------------------- |
| Governance and product    | Repository-specific rules, product, architecture, roadmap, ADRs | Lead orchestration | Validated | Cross-document consistency                             | Docs validation and reviewed diff              |
| Repository map and memory | Accurate map, session/known-issue continuity                    | Repository steward | Validated | Actual file/tooling layout                             | Map validation and exact next step             |
| Windows bootstrap/doctor  | Idempotent safe setup on PowerShell 5.1+                        | Platform           | Validated | Installed Node/Git/pnpm; environment visibility        | Two fresh-worktree bootstrap runs; doctor pass |
| Quality and CI            | Format, lint, type, unit baseline, build, secret scanning       | Quality/platform   | Validated | Tooling scaffold                                       | `pnpm.cmd validate:phase0` pass                |
| Research/data governance  | Bilingual register/glossary and 2016–2026 evidence policy       | Data/research      | Validated | Public source metadata and terms                       | Register/matrix validation; no raw microdata   |
| Design and Stitch         | Governed screen backlog, handoff and safe MCP gate              | Design/security    | Validated | Live canary remains externally blocked, truthfully     | Offline config contract and blocked canary     |
| Integration readiness     | Branch flow, promotion, fresh-worktree materialization          | Integration        | Validated | Local promotion branches share the foundation baseline | Clean detached-worktree evidence               |

No owner role may mark another row complete without its evidence/handoff. Parallel work preserves unrelated dirty files.

## Known environment/external gates

| Gate                                      | Classification                 | Current handling                                        | Prohibited shortcut                                                           | Exact acceptance action                                                                          |
| ----------------------------------------- | ------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Docker CLI present but daemon unavailable | Environment issue              | Doctor reports Docker-dependent validation unavailable  | Do not elevate or edit services/Registry/firewall/Docker config automatically | User starts/repairs Docker; rerun the one deferred Docker check                                  |
| Docker user config unreadable/restricted  | Environment/permission issue   | Report redacted path/category only                      | Do not take ownership/change ACL automatically                                | User resolves intended Docker access; rerun doctor                                               |
| PowerShell blocks package `*.ps1` shims   | Environment policy, mitigated  | Use `npm.cmd`, `npx.cmd`, `pnpm.cmd`                    | Do not change machine-wide Execution Policy                                   | Canonical commands succeed through `.cmd`                                                        |
| Stitch credential was exposed             | Security/external-account gate | Treat as compromised; no activation/write call          | Do not reuse, log, paste, or automate account/IAM changes                     | Owner revokes/reviews/replaces with restricted non-production key; one approved read-only canary |
| First hosted CI check is not registered   | Integration bootstrap gate     | PR #21 stays open; local Phase 0 evidence remains valid | Do not merge, bypass checks, write directly to `main`, or weaken branch flow  | Approve a safe first-workflow promotion path; observe the required GitHub-hosted check           |

Gates block only dependent validation/work. They do not authorize broad system repair and do not make unrelated Phase 0 documentation fail.

## Roadmap queue

| Priority | Item                                   | Status          | Starts only when                          | Completion handoff                           |
| -------- | -------------------------------------- | --------------- | ----------------------------------------- | -------------------------------------------- |
| 0        | `P0` Foundation                        | Validated       | Approved plan                             | Validated foundation commit; exact P1 action |
| 1        | `P1-S1` Accountable care-task loop     | Ready; UI gated | P0 passes; issue #3 before production UI  | E2E demo/tests/docs/commit                   |
| 2        | `P2-S1` Account access/onboarding      | Planned         | P1 passes; identity threat/contract ready | Auth/accessibility flow                      |
| 3        | `P2-S2` Household/invitation/context   | Planned         | P2-S1 passes                              | Household authorization flow                 |
| 4        | `P2-S3` Consent/privacy/audit/settings | Planned         | P2-S2 passes                              | Consent/revocation/audit flow                |
| 5        | `P3-S1` Timeline/handoff               | Planned         | P2 trust boundary passes                  | Timeline/handoff flow                        |
| 6        | `P3-S2` Calendar/appointment           | Planned         | P3-S1/time contract                       | Calendar/agenda flow                         |
| 7        | `P3-S3` Care-plan review               | Planned         | P2 consent + P3 time                      | Versioned care-plan flow                     |
| 8        | `P4-S1` Medication reminder            | Planned         | P3 time + Notification reliability        | Non-clinical reminder flow                   |
| 9        | `P4-S2` Emergency plan                 | Planned         | Consent + offline threat review           | Offline-readable configured plan             |
| 10       | `P4-S3` Document vault                 | Planned         | Consent/audit + storage ADR               | Synthetic document flow                      |
| 11       | `P5-S1` Help request/directory         | Planned         | Research + consent + community boundary   | Consented request/search                     |
| 12       | `P5-S2` Match/organization             | Planned         | P5-S1                                     | Minimum-data match flow                      |
| 13       | `P5-S3` Moderation                     | Planned         | P5-S2 + policy                            | Auditable resolution flow                    |
| 14       | `P6-S1` Offline/conflict hardening     | Planned         | Release flow list fixed                   | Cross-flow resilience evidence               |
| 15       | `P6-S2` Deployment/operations          | Planned         | Release scope passes                      | Reproducible production-like smoke           |
| 16       | `P6-S3` Demo/release                   | Planned         | P6-S1/S2 pass                             | Truthful tagged release                      |

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

| Change ID      | State                              | Planned baseline                                   | Proposed/actual                                                         | Reason/evidence                               | Downstream impact                                                     | Validation                                               | Follow-up                                                                           |
| -------------- | ---------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `CHG-2026-001` | Implemented                        | Mixed Windows/macOS and legacy delivery tools      | Windows + Codex App only                                                | Project-owner direction and actual host       | All phases use one supported control plane                            | Windows CI/doctor and offline Codex config validation    | Credential and read-only Stitch canary gates                                        |
| `CHG-2026-002` | Baseline implemented; lane pending | No dedicated research branch                       | Bilingual 2016–2026 register; `init/research → data → dev`              | Project-owner requirement for recent evidence | Provenance/fixture gates apply to data-dependent slices               | Source/license/privacy review; branch promotion evidence | Create branches, then start `research/aggregate-context-fixture` on `init/research` |
| `CHG-2026-003` | Implemented                        | Compact P0–P6 plan without formal research overlay | Runbook crosswalk, protocol, assumptions, risk catalog, and GitHub plan | Project-owner supplied ultra runbook          | All future phases/slices gain bounded evidence gates; order unchanged | Targeted docs/schema review; 19/19 GitHub metadata audit | Use issue #5 for P1-S1 or separate issue #4 on `init/research`                      |

Mirror accepted changes in `docs/IMPLEMENTATION_PLAN.md`; add an ADR for architecture/product policy, an integration-log entry for contract/promotion impact, and a session-log entry for evidence.

## Exact next handoff

Resolve `KI-012` and obtain a visible required check on
[PR #21](https://github.com/toannnnq1424/life-bridge/pull/21) before merge.
After the foundation is integrated, open a new conversation for
[`P1-S1` issue #5](https://github.com/toannnnq1424/life-bridge/issues/5),
starting with the task-flow contract and Google Stitch handoffs for `LB-011`,
`LB-013`, `LB-014`, and the relevant `LB-019`/state patterns. Production UI
remains gated by
[`GATE-P1` issue #3](https://github.com/toannnnq1424/life-bridge/issues/3).
Alternatively, open a separate research conversation for
[`DATA-S1` issue #4](https://github.com/toannnnq1424/life-bridge/issues/4) on
`init/research`; never combine the two scopes.
