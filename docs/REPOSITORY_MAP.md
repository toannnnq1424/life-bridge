# Repository Map

Verified: 2026-07-26
Integrated base: `P2-S3 — Consent, privacy, audit, and settings`
(`dev@cd58229794e6e8bf562a49879de494515c262db5`)
Active slice: `P3-S1 — Daily timeline and handoff`
(`phase/3-daily-timeline-handoff`; candidate validation/promotion pending)

This map reflects the integrated P1/P2 tree plus the P3-S1 candidate structure.
P3-S2 is expected next only after P3-S1 acceptance.
It excludes generated and local-only state such as `node_modules/`, `.next/`, `dist/`,
`.lifebridge-local/`, Playwright output, coverage, and private design/research
inputs.

## Top-level layout

| Path                          | Responsibility                                                                                           | Key entry points                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/web/`                   | Native Next.js UI from reviewed Stitch handoffs, VI/EN localization, responsive/accessibility states     | `app/`, `src/CoordinationApp.tsx`, `src/ConsentPrivacyApp.tsx`                               |
| `apps/gateway/`               | Public BFF, secure Identity cookie/origin/CSRF boundary, legacy fixture guard, dependency composition    | `src/main.ts`, `src/server.ts`                                                               |
| `services/identity-consent/`  | Account, household, consent, governed-read, privacy and redacted-audit authority                         | `src/consent-service.ts`, `src/household-service.ts`, `src/server.ts`                        |
| `services/care-coordination/` | Task/assignment, daily timeline, handoff, optimistic concurrency, audit and transactional outbox         | `src/coordination-service.ts`, `src/service.ts`, `migrations/002_daily_timeline_handoff.sql` |
| `services/notification/`      | Completion/handoff event inbox/deduplication and recipient-scoped notification store                     | `src/service.ts`, `migrations/001_initial.sql`                                               |
| `packages/contracts/`         | Frozen P1, P2 and P3-S1 authority/timeline/handoff/event schemas                                         | `src/index.ts`                                                                               |
| `packages/config/`            | Required runtime configuration and production fixture guard                                              | `src/index.ts`                                                                               |
| `packages/observability/`     | Allow-listed structured logging, metrics, traces and correlation IDs                                     | `src/index.ts`                                                                               |
| `packages/test-fixtures/`     | Deterministic synthetic household, actors and time facts                                                 | `src/index.ts`                                                                               |
| `tests/integration/`          | Real PostgreSQL ownership, concurrency, outbox/inbox and restart acceptance                              | `p1-s1.test.ts`                                                                              |
| `tests/browser/`              | P1 runtime plus artifact-disabled P2/P3 VI/EN, keyboard/focus, reflow, axe and security-state acceptance | `p3-s1.spec.ts`, `p3-s1-runtime.spec.ts`                                                     |
| `infra/p1/`                   | Slice-owned local PostgreSQL container definition pinned by digest                                       | `docker-compose.yml`                                                                         |
| `scripts/`                    | Windows bootstrap, demo and cumulative validation entry points                                           | `start-p1.ps1`, `validate-p2-s3.ps1`, `validate-p3-s1.ps1`                                   |
| `tools/quality/`              | Repository validators plus owned database and migration helpers                                          | `src/p2-database.ts`, `src/p2-s3-migration.ts`, `src/p3-s1-migration.ts`                     |
| `.github/`                    | PR/issue contracts and exact-head Windows/PostgreSQL/browser CI                                          | `workflows/ci.yml`                                                                           |
| `docs/`                       | Canonical product, architecture, contracts, design, quality, security, deployment and memory             | documents listed below                                                                       |

The existing `.ai-orchestrator/`, `.codex/`, `.vscode/`, `data/`, and
`docs/research/` boundaries remain governed by the Phase 0 rules. P1-S1 does
not add DATA-S1 inputs or modify the private Stitch control plane.

## Runtime dependency direction

```text
browser
  → apps/web
      → apps/gateway
          → services/identity-consent  → owned PostgreSQL database
          → services/care-coordination → owned PostgreSQL database
          → services/notification      → owned PostgreSQL database

care-coordination local transaction
  → task/assignment + timeline/handoff + audit + versioned outbox
      → HTTP dispatcher with bounded retry
          → notification inbox/dedup + recipient notification
```

The three services may share one local PostgreSQL engine, but use different
databases, owners and credentials. No service imports or writes another
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

P2-S1 adds ADR-018, `docs/security/P2_S1_THREAT_MODEL.md`, the historical local
wireframe input and Frozen `docs/design/reviews/P2_S1_STITCH_HANDOFF.md`. Native
routes `/`, `/login`, `/register`, `/mfa`, `/recover`, `/onboarding` and
`/onboarding/accessibility` live in `apps/web`; generated Stitch source is not
present.

P2-S2 adds Identity migration `002_household_authorization.sql`,
`services/identity-consent/src/household-service.ts` and
`docs/security/P2_S2_THREAT_MODEL.md`. Its redacted design authority is
`docs/design/reviews/P2_S2_STITCH_HANDOFF.md`. Native routes are composed by
`apps/web/src/HouseholdAccessApp.tsx` with parity-checked copy in
`household-i18n.ts`; artifact-disabled browser coverage lives in
`tests/browser/p2-s2*.spec.ts`. `scripts/validate-p2-s2.ps1` owns the single
cumulative candidate command and exact task-resource cleanup.

P2-S3 adds Identity migration `003_consent_privacy_audit.sql`,
`services/identity-consent/src/consent-service.ts`, the LB-028–LB-031 routes
under `apps/web/app/households/[householdId]/` and `apps/web/app/settings/`,
`apps/web/src/ConsentPrivacyApp.tsx`, the redacted
`docs/design/reviews/P2_S3_STITCH_HANDOFF.md` and
`docs/security/P2_S3_THREAT_MODEL.md`. Artifact-disabled browser coverage lives
in `tests/browser/p2-s3*.spec.ts`; `playwright.p2-s3.config.ts` disables
artifacts. `tools/quality/src/p2-s3-migration.ts` proves an upgrade from
synthetic P2-S2 state, and `scripts/validate-p2-s3.ps1` owns the one cumulative
candidate campaign and exact task-resource cleanup.

P3-S1 adds Care migration `002_daily_timeline_handoff.sql`,
`services/care-coordination/src/coordination-service.ts`, Identity's fresh
coordination decision, Gateway composition routes and
`apps/web/src/CoordinationApp.tsx` with native timeline/task routes.
`docs/design/reviews/P3_S1_STITCH_HANDOFF.md` and
`docs/security/P3_S1_THREAT_MODEL.md` are the redacted design/security
authority. Artifact-disabled browser coverage lives in
`tests/browser/p3-s1*.spec.ts`; `tools/quality/src/p3-s1-migration.ts` proves
rollback/reapply/preservation/no-backfill, and `scripts/validate-p3-s1.ps1`
owns the one cumulative candidate campaign and exact cleanup.

## Commands and generated state

| Command                                     | Behavior                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd run demo:p1`                      | Builds and runs the synthetic P1 loop on local ports `3000`, `3001`, `3101`, `3102`, and PostgreSQL `55432` |
| `pnpm.cmd run validate:p1-s1`               | One isolated Level C campaign with PostgreSQL, build/runtime, Chromium, accessibility and security evidence |
| `pnpm.cmd run test:p1:integration`          | Targeted real-PostgreSQL service acceptance; requires provisioned database URLs                             |
| `pnpm.cmd run test:p1:browser`              | Targeted browser acceptance; requires an already running built stack                                        |
| `pnpm.cmd run test:p2:identity-integration` | Targeted P2 Identity PostgreSQL Level B; requires a provisioned Identity-owned database                     |
| `pnpm.cmd run test:p2:browser`              | Artifact-disabled P2 UI/accessibility/security browser campaign against a running production web build      |
| `pnpm.cmd run validate:p2-s1`               | Single cumulative P2 Level C including P1 regression, Identity PostgreSQL, P2 browser and security gates    |
| `pnpm.cmd run test:p2-s2:browser`           | LB-008–LB-010 browser/accessibility/privacy campaign; real runtime path is enabled by the Level C runner    |
| `pnpm.cmd run validate:p2-s2`               | Cumulative P2-S2 Level C with P1/P2-S1 regression, PostgreSQL, built runtime, Chromium and security         |
| `pnpm.cmd run test:p2-s3:migration`         | Disposable P2-S2 → P2-S3 migration/reapply/no-backfill/preservation check                                   |
| `pnpm.cmd run test:p2-s3:browser`           | LB-028–LB-031 browser/accessibility/privacy campaign; real runtime path is enabled by the Level C runner    |
| `pnpm.cmd run validate:p2-s3`               | Single cumulative P2-S3 Level C with regressions, migration/PostgreSQL, built runtime, Chromium and privacy |
| `pnpm.cmd run test:p3-s1:migration`         | Disposable P1 → P3-S1 Care migration rollback/reapply/no-backfill/preservation check                        |
| `pnpm.cmd run test:p3-s1:integration`       | Real Identity/Care PostgreSQL authority, chronology, race, idempotency and atomicity evidence               |
| `pnpm.cmd run test:p3-s1:browser`           | Artifact-disabled LB-012/LB-014 browser campaign; real path enabled by the Level C runner                   |
| `pnpm.cmd run validate:p3-s1`               | Single cumulative P3-S1 Level C with P1/P2 regressions, owned PostgreSQL, built runtime and privacy/a11y    |

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
- P2 Identity integration: `services/identity-consent/src/service.integration.test.ts`.
- Browser/accessibility: `tests/browser/p1-s1.spec.ts`, `p2-s1.spec.ts` and
  artifact-disabled `p2-s2*.spec.ts` / `p2-s3*.spec.ts`.
- P2-S3 migration upgrade: `tools/quality/src/p2-s3-migration.ts`.
- P3-S1 Care/Identity integration:
  `services/care-coordination/src/coordination-service.integration.test.ts`
  and `services/identity-consent/src/service.integration.test.ts`.
- P3-S1 migration upgrade: `tools/quality/src/p3-s1-migration.ts`.
- P3 browser/accessibility: artifact-disabled `p3-s1*.spec.ts`.
- CI aggregate gate: `.github/workflows/ci.yml`.
- Legacy foundation validator: `tools/quality/src/phase0.ts`.

## Update triggers

Update this map only when a package/service boundary, canonical command,
dependency direction, test location or generated-state rule changes. Routine
edits inside a mapped boundary do not require a map rewrite.
