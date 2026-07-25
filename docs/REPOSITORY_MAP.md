# Repository Map

Verified: 2026-07-25
Phase: P0 Foundation
Repository: `C:\Users\Admin\LifeBridge`

This map reflects the Phase 0 working tree. It intentionally excludes
`node_modules/`, `.pnpm-store/`, `.git/`, ignored `.security-review/` evidence,
and future directories that do not yet exist.

## Top-level layout

| Path                | Responsibility                                                                                                        | Important entry points                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `.ai-orchestrator/` | Compact operational state, risks, safety, tickets, handoff/report contracts                                           | `PROJECT_STATE.md`, `RISK_REGISTER.md`, `tasks/TASK-000-phase0-foundation.md` |
| `.codex/`           | Trusted-repository Codex configuration                                                                                | `config.toml` defines disabled-by-default Stitch MCP                          |
| `.github/`          | Pull-request/issue contracts and Windows CI                                                                           | `workflows/ci.yml`, PR template, `ISSUE_TEMPLATE/`                            |
| `.vscode/`          | Inert VS Code MCP marker; not an active delivery path                                                                 | `mcp.json` has no configured server or credential input                       |
| `data/`             | Governed fixture/reference-data boundary                                                                              | `README.md`, `fixtures/README.md`                                             |
| `docs/`             | Canonical product, architecture, plan, contracts, quality, security, deployment, design, research, and session memory | See document map below                                                        |
| `scripts/`          | Windows PowerShell 5.1 entry points                                                                                   | `bootstrap.ps1`, `doctor.ps1`, `validate-phase0.ps1`                          |
| `tools/quality/`    | Executable Phase 0 validators and unit tests                                                                          | `src/phase0.ts`, `src/validation.ts`, `src/validation.test.ts`                |
| repository root     | Workspace/package/format/type configuration and durable agent rules                                                   | `README.md`, `CODEX.md`, `AGENTS.md`, `CONTRIBUTING.md`, `package.json`       |

No `apps/`, `services/`, or `packages/` implementation directory exists yet.
They are planned, not implemented. The first executable product slice creates
only the minimum packages required by `P1-S1`.

## Canonical documentation

| Document                      | Purpose                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `README.md`                   | Bilingual project entry point and canonical commands                              |
| `CODEX.md`                    | Durable orchestration, vertical-slice, validation, Git, and change-control rules  |
| `AGENTS.md`                   | Concise repository instructions for all agents                                    |
| `docs/PRODUCT_SPEC.md`        | Product identity, users, MVP outcome, requirements, non-goals                     |
| `docs/ARCHITECTURE.md`        | Planned/actual topology, service boundaries, events, persistence, Stitch boundary |
| `docs/IMPLEMENTATION_PLAN.md` | P0–P6 phases, exact slices, dependencies, acceptance, deferrals, next action      |
| `docs/RUNBOOK_ADOPTION.md`    | External-runbook provenance, adoption decisions, and P0–P15 to P0–P6 crosswalk    |
| `docs/GITHUB_ISSUE_PLAN.md`   | GitHub labels, milestones, and accepted-slice issue catalog                       |
| `docs/WORKSTREAM_BOARD.md`    | Status, owner, dependencies, gates, exact handoffs                                |
| `docs/CHANGE_CONTROL.md`      | Mandatory plan-delta process and change-record template                           |
| `docs/DECISIONS.md`           | Authoritative ADR log                                                             |
| `docs/INTEGRATION_LOG.md`     | Branch, contract, data, service, and environment convergence                      |
| `docs/SESSION_LOG.md`         | Persistent task/phase handoff; created/updated at every session close             |
| `docs/KNOWN_ISSUES.md`        | Open/mitigated blockers and exact next actions                                    |
| `docs/API_CONTRACTS.md`       | Planned HTTP/event/health contracts for the first slice                           |
| `docs/DATA_MODEL.md`          | Service-owned data, classification, initial entities, database engine gate        |
| `docs/TEST_STRATEGY.md`       | Validation levels, commands, CI, and test ownership                               |
| `docs/SECURITY.md`            | Threat boundaries, secrets, authorization, logging, supply chain, incidents       |
| `docs/DEPLOYMENT.md`          | Planned environment/promotion/config/recovery contract                            |
| `docs/AGENT_DESIGN.md`        | Codex role, ticket, evidence, and context rules                                   |
| `docs/DEMO_SCRIPT.md`         | Truthful future P1-S1 demo target                                                 |
| `docs/DEVPOST_SUBMISSION.md`  | Evidence-gated submission draft                                                   |
| `docs/RELEASE_CHECKLIST.md`   | Release/materialization/validation/security/deployment gates                      |

## Documentation subtrees

### `docs/design/`

Existing product-wide design inputs:

- `DESIGN_BRIEF.md`
- `DESIGN_SYSTEM.md`
- `SCREEN_INVENTORY.md`
- `USER_FLOWS.md`
- `RESPONSIVE_RULES.md`
- `ACCESSIBILITY_REQUIREMENTS.md`
- `DESIGN_IMPLEMENTATION_MAP.md`
- `STITCH_PROJECTS.md`
- `reviews/SCREEN_HANDOFF_TEMPLATE.md`

`assets/`, `screenshots/`, and `exports/` contain only tracked `.gitkeep` markers
in Phase 0. The 35-screen inventory is backlog, not implemented scope.

### `docs/research/`

- `README.md`: evidence labels, window, safety, and update protocol.
- `DATA_SOURCE_REGISTER.md`: DS-01–DS-19 plus governance sources.
- `DATASET_EVALUATION_MATRIX.md`: freshness/license/use scoring and go/no-go.
- `DATA_GOVERNANCE.md`: classification, legal-review inputs, ingestion and
  synthetic-data gates.
- `DOMAIN_GLOSSARY.vi-en.md`: reviewed Vietnamese/English domain language.
- `RESEARCH_LOG.md`: method, facts, inferences, missing evidence, next slice.
- `RESEARCH_PROTOCOL.md`: risk-tiered phase/slice research gate and stop rule.
- `ASSUMPTION_REGISTER.md`: unvalidated product/market assumptions and planned
  validation.

Research window is 2016–2026 with preference for 2021–2026 evidence. Raw
microdata and unreviewed downloads never enter Git.

### `docs/orchestration/`

- `WINDOWS_ENVIRONMENT.md`: supported toolchain, `.cmd` shim and
  process-scoped-script guidance.
- `STITCH_CODEX_APP_OPERATIONS.md`: active Windows + Codex App runbook.
- `reports/STITCH_CODEX_APP_CANARY.md`: current blocked canary record.
- `STITCH_MCP_OPERATIONS.md`: marked historical VS Code/Cline runbook.
- `reports/STITCH_MCP_SECURITY_REVIEW.md`: retained package/provenance evidence.
- `reports/STITCH_MCP_CANARY.md`: historical incident/canary record with a
  pre-existing uncommitted edit that must remain unstaged without approval.

## Tooling and entry points

### Root package

`package.json` pins:

- Node `>=22 <23`;
- pnpm `11.9.0`;
- TypeScript/ESLint/Prettier/Vitest/tsx Phase 0 development tooling;
- `smol-toml` for standards-based, read-only validation of the repository Codex
  MCP configuration.

`pnpm-lock.yaml` is the dependency source of truth. `pnpm-workspace.yaml`
reserves `apps/*`, `services/*`, `packages/*`, and `tools/*`; only
`tools/quality` exists in Phase 0.

### Windows scripts

| Command                        | Behavior                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `pnpm.cmd run doctor`          | Read-only environment classification; mandatory failures vs optional warnings |
| `pnpm.cmd run bootstrap`       | Locked project-local dependency materialization; safe to run repeatedly       |
| `pnpm.cmd run validate:phase0` | Doctor plus format, lint, type, unit, docs/config/secret checks, build        |
| `pnpm.cmd run security:deps`   | Dependency advisory audit                                                     |

On a host that blocks `.ps1` files, the npm scripts invoke
`powershell.exe -NoProfile -ExecutionPolicy Bypass` for that process only. No
user/machine policy or Registry setting is changed.

### Quality validator dependency flow

```text
package.json scripts
  → scripts/*.ps1
      → pnpm scripts
          → tools/quality/src/phase0.ts
              → tools/quality/src/validation.ts
                  → repository docs/config/working-tree checks
                  → smol-toml parses .codex/config.toml before contract checks

tools/quality/src/validation.test.ts
  → validation.ts
```

The validator reads repository files; it does not mutate system configuration,
authenticate external services, or invoke Stitch.

## Planned runtime dependency direction

The following is an architectural plan, not a current file tree:

```text
apps/web
  → services/api-gateway
      → services/identity-consent
      → services/care-coordination
      → services/notification

care-coordination
  → owned PostgreSQL database
  → transactional outbox
      → notification

services never import another service's persistence layer
packages/contracts contains the future shared API/event schemas
```

Community and audit/read-model packages are added only by their planned slices.
New database engines require the gate in `docs/DATA_MODEL.md` and ADR-004.

## Configuration and generated/local state

| Path                                       | Tracked | Rule                                        |
| ------------------------------------------ | ------: | ------------------------------------------- |
| `.env.example`, `.env.stitch.example`      |     yes | names/empty values only                     |
| `.env`, `.env.*.local`                     |      no | secrets/local configuration                 |
| `.codex/config.toml`                       |     yes | no literal secret; Stitch disabled          |
| `.vscode/mcp.json`                         |     yes | inert, secret-free; no configured server    |
| `node_modules/`, `.pnpm-store/`            |      no | reproducible local dependencies/cache       |
| `dist/`, `coverage/`, test/browser reports |      no | generated                                   |
| `data/raw/`, `data/private/`               |      no | local research inputs; never PII            |
| `.security-review/`                        |      no | local package/incident evidence and backups |

## Test locations

- Unit: `tools/quality/src/validation.test.ts`.
- Phase 0 integration-style validation:
  `tools/quality/src/phase0.ts` against repository docs/config.
- CI: `.github/workflows/ci.yml`.
- No application unit, service integration, contract, database, browser, or
  deployment test exists yet; those begin with their owning vertical slice.

## Files requiring special care

- Never stage or overwrite the pre-existing dirty
  `docs/orchestration/reports/STITCH_MCP_CANARY.md` without explicit approval.
- Keep `.security-review/` ignored and unscanned during normal repository work.
- Do not put credentials into `.codex/config.toml`, `.vscode/mcp.json`,
  environment examples, Markdown, fixtures, or logs.
- Do not treat design exports or external dataset downloads as trusted source.

## Update triggers

Update this map only when:

- a major directory/package/service is created, moved, or removed;
- entry points, canonical commands, shared contracts, or dependency direction
  change;
- the map is proven materially inaccurate;
- a new architecture phase introduces a new repository boundary.

Routine edits inside a mapped package do not require rewriting this document.
