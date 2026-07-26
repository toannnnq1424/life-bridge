# Repository Map

Verified: 2026-07-26
Active slice: `P1-S1 — Accountable care-task loop`

This map reflects the P1-S1 implementation tree. It excludes generated and
local-only state such as `node_modules/`, `.next/`, `dist/`,
`.lifebridge-local/`, Playwright output, coverage, and private design/research
inputs.

## Top-level layout

| Path                          | Responsibility                                                                               | P1-S1 entry points                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/`                   | Stitch-derived Next.js UI, VI/EN localization, responsive and accessible states              | `app/`, `src/CareApp.tsx`, `src/i18n.ts`                            |
| `apps/gateway/`               | Public BFF, fixture-identity boundary, dependency composition and honest degradation         | `src/main.ts`, `src/server.ts`                                      |
| `services/care-coordination/` | Task authority, authorization, optimistic concurrency, audit and transactional outbox        | `src/service.ts`, `src/dispatcher.ts`, `migrations/001_initial.sql` |
| `services/notification/`      | Completion-event inbox/deduplication and recipient-scoped notification store                 | `src/service.ts`, `migrations/001_initial.sql`                      |
| `packages/contracts/`         | Frozen `P1-S1-v1` Zod HTTP/event/projection schemas                                          | `src/index.ts`                                                      |
| `packages/config/`            | Required runtime configuration and production fixture guard                                  | `src/index.ts`                                                      |
| `packages/observability/`     | Allow-listed structured safe logging and correlation IDs                                     | `src/index.ts`                                                      |
| `packages/test-fixtures/`     | Deterministic synthetic household, actors and time facts                                     | `src/index.ts`                                                      |
| `tests/integration/`          | Real PostgreSQL ownership, concurrency, outbox/inbox and restart acceptance                  | `p1-s1.test.ts`                                                     |
| `tests/browser/`              | Real-runtime VI/EN, keyboard/focus, reflow, axe and failure-state acceptance                 | `p1-s1.spec.ts`                                                     |
| `infra/p1/`                   | Slice-owned local PostgreSQL container definition pinned by digest                           | `docker-compose.yml`                                                |
| `scripts/`                    | Windows bootstrap, demo and validation entry points                                          | `start-p1.ps1`, `validate-p1-s1.ps1`                                |
| `tools/quality/`              | Repository validators plus P1 database provisioning/reset helpers                            | `src/phase0.ts`, `src/p1-database.ts`, `src/p1-reset.ts`            |
| `.github/`                    | PR/issue contracts and exact-head Windows/PostgreSQL/browser CI                              | `workflows/ci.yml`                                                  |
| `docs/`                       | Canonical product, architecture, contracts, design, quality, security, deployment and memory | documents listed below                                              |

The existing `.ai-orchestrator/`, `.codex/`, `.vscode/`, `data/`, and
`docs/research/` boundaries remain governed by the Phase 0 rules. P1-S1 does
not add DATA-S1 inputs or modify the private Stitch control plane.

## Runtime dependency direction

```text
browser
  → apps/web
      → apps/gateway
          → services/care-coordination → owned PostgreSQL database
          → services/notification      → owned PostgreSQL database

care-coordination local transaction
  → task + audit + completion outbox
      → HTTP dispatcher with bounded retry
          → notification inbox/dedup + recipient notification
```

The two services may share one local PostgreSQL engine, but use different
databases, owners and credentials. Neither service imports or writes the other
service's persistence. Gateway composes projections and never fabricates an
empty Notification success when that dependency is unavailable.

## Canonical P1-S1 memory

| Document                                               | Purpose                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `docs/PRODUCT_SPEC.md`                                 | User outcome and completion-to-creator audience                 |
| `docs/API_CONTRACTS.md`                                | Frozen `P1-S1-v1` HTTP, event and error contracts               |
| `docs/DATA_MODEL.md`                                   | Care/Notification ownership, tables and consistency             |
| `docs/ARCHITECTURE.md`                                 | Actual boundaries and interaction flow                          |
| `docs/design/reviews/P1_S1_STITCH_HANDOFF.md`          | Frozen design provenance and production corrections             |
| `docs/TEST_STRATEGY.md`                                | Level A/C commands and exact-head CI matrix                     |
| `docs/SECURITY.md`                                     | Fixture, privacy, authorization, logging and supply-chain rules |
| `docs/DEPLOYMENT.md`                                   | Local demo/validation topology and future deployment gate       |
| `docs/IMPLEMENTATION_PLAN.md`                          | Planned-versus-actual footprint and next slice                  |
| `docs/SESSION_LOG.md`                                  | Closeout evidence and handoff                                   |
| `docs/KNOWN_ISSUES.md`                                 | Controlled limitations and follow-up triggers                   |
| `docs/WORKSTREAM_BOARD.md` / `docs/INTEGRATION_LOG.md` | Slice and promotion state                                       |

## Commands and generated state

| Command                            | Behavior                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd run demo:p1`             | Builds and runs the synthetic P1 loop on local ports `3000`, `3001`, `3101`, `3102`, and PostgreSQL `55432` |
| `pnpm.cmd run validate:p1-s1`      | One isolated Level C campaign with PostgreSQL, build/runtime, Chromium, accessibility and security evidence |
| `pnpm.cmd run test:p1:integration` | Targeted real-PostgreSQL service acceptance; requires provisioned database URLs                             |
| `pnpm.cmd run test:p1:browser`     | Targeted browser acceptance; requires an already running built stack                                        |

Local credentials and logs live only under ignored `.lifebridge-local/`. The
validation runner creates a PID-scoped Compose project and removes only that
project and its volume. The demo runner retains its named local database volume
across stops.

`pnpm-workspace.yaml` permits only the required `esbuild` lifecycle and
explicitly denies `sharp`. P1-S1 contains no `next/image` or Sharp pipeline;
generated `.next/`, `dist/`, `*.tsbuildinfo`, browser reports and local
databases are ignored.

## Test locations

- Package/service unit and contract tests: colocated `src/*.test.ts`.
- PostgreSQL integration: `tests/integration/p1-s1.test.ts`.
- Browser/accessibility: `tests/browser/p1-s1.spec.ts`.
- CI aggregate gate: `.github/workflows/ci.yml`.
- Legacy foundation validator: `tools/quality/src/phase0.ts`.

## Update triggers

Update this map only when a package/service boundary, canonical command,
dependency direction, test location or generated-state rule changes. Routine
edits inside a mapped boundary do not require a map rewrite.
