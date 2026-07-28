# Repository Map

Verified: 2026-07-28
Integrated base: accepted live
`origin/dev@7690a7c584891fbd2bd62de600a5b11bb58a8be7`
Active product slice: none in this docs-only closeout; exact next is P4-S3
only after fresh controller dispatch.

This map reflects the accepted P1/P2/P3/P4-S1/P4-S2 tree. P4-S3 and DATA-S1
are not started.
It excludes generated and local-only state such as `node_modules/`, `.next/`, `dist/`,
`.lifebridge-local/`, Playwright output, coverage, and private design/research
inputs.

## Top-level layout

| Path                          | Responsibility                                                                                         | Key entry points                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `apps/web/`                   | Native Next.js UI plus encrypted shell-only offline plan copy, VI/EN and accessibility/recovery states | `app/`, `src/EmergencyReadinessApp.tsx`, `src/emergency-offline-store.ts`, `public/`    |
| `apps/gateway/`               | Public BFF, secure Identity cookie/origin/CSRF boundary, legacy fixture guard, dependency composition  | `src/main.ts`, `src/server.ts`                                                          |
| `services/identity-consent/`  | Account, household, consent, governed-read, privacy and redacted-audit authority                       | `src/consent-service.ts`, `src/household-service.ts`, `src/server.ts`                   |
| `services/care-coordination/` | Task/planning plus Care-owned emergency aggregate, immutable versions, audit and content-free outbox   | `src/emergency-readiness-service.ts`, `migrations/006_emergency_readiness.sql`          |
| `services/notification/`      | Generic delivery attempts/evidence and immutable seen-only medication acknowledgement                  | `src/medication-reminder-service.ts`, `migrations/003_medication_reminder_delivery.sql` |
| `packages/contracts/`         | Frozen P1 through P4-S2 authority/contact/plan/offline/event schemas                                   | `src/index.ts`, `src/emergency-readiness-contract.test.ts`                              |
| `packages/config/`            | Required runtime configuration and production fixture guard                                            | `src/index.ts`                                                                          |
| `packages/observability/`     | Allow-listed structured logging, metrics, traces and correlation IDs                                   | `src/index.ts`                                                                          |
| `packages/test-fixtures/`     | Deterministic synthetic household, actors and time facts                                               | `src/index.ts`                                                                          |
| `tests/integration/`          | Real PostgreSQL ownership, concurrency, outbox/inbox and restart acceptance                            | `p1-s1.test.ts`                                                                         |
| `tests/browser/`              | Artifact-disabled VI/EN keyboard/focus/reflow/axe plus real online/offline runtime acceptance          | `p4-s2.spec.ts`, `p4-s2-runtime.spec.ts`                                                |
| `infra/p1/`                   | Slice-owned local PostgreSQL container definition pinned by digest                                     | `docker-compose.yml`                                                                    |
| `scripts/`                    | Windows bootstrap, demo and cumulative validation entry points                                         | `start-p1.ps1`, `validate-p4-s2.ps1`                                                    |
| `tools/quality/`              | Repository validators plus owner-isolated migration helpers                                            | `src/p4-s2-migration.ts`                                                                |
| `.github/`                    | PR/issue contracts and exact-head Windows/PostgreSQL/browser CI                                        | `workflows/ci.yml`                                                                      |
| `docs/`                       | Canonical product, architecture, contracts, design, quality, security, deployment and memory           | documents listed below                                                                  |

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
  → task/timeline/handoff OR appointment OR support-plan draft/version/history + audit + versioned outbox
      → HTTP dispatcher with bounded retry
          → notification inbox/dedup + recipient notification OR reminder-intent receipt
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

P4-S1 adds Care migration `005_medication_reminders.sql`, Notification
migration `003_medication_reminder_delivery.sql`, owner-local schedule and
delivery/seen services, fresh Gateway authority composition, and native
`MedicationReminderApp` routes. The redacted design/security authorities are
`docs/design/reviews/P4_S1_STITCH_HANDOFF.md` and
`docs/security/P4_S1_THREAT_MODEL.md`. `p4-s1-migration.ts` proves separate
owner rollback/reapply/no-backfill; artifact-disabled mocked/real Chromium
coverage lives in `tests/browser/p4-s1*.spec.ts`; `validate-p4-s1.ps1` owns the
single cumulative campaign and exact cleanup.

P4-S2 adds Care migration `006_emergency_readiness.sql`, the Care-owned
`EmergencyReadinessService`, eight fresh Gateway/Identity authority paths,
native LB-020/LB-021 routes and the required read-only LB-032 offline shell.
The redacted design/security authorities are
`docs/design/reviews/P4_S2_STITCH_HANDOFF.md`, ADR-025 and
`docs/security/P4_S2_THREAT_MODEL.md`. `emergency-offline-store.ts` writes one
verified AES-GCM ciphertext envelope to IndexedDB after passphrase opt-in;
`public/emergency-offline-*` is the network-isolated shell and narrow service
worker for its three exact assets plus plan navigation. `p4-s2-migration.ts`
proves Care rollback, reapply, preservation and no backfill; artifact-disabled mocked/real Chromium
coverage lives in `tests/browser/p4-s2*.spec.ts`; `validate-p4-s2.ps1` owns the
single cumulative campaign and exact cleanup.

P4-S3 adds Identity migration `004_document_vault_scope.sql`, Care migration
`007_document_vault.sql`, the Care-owned `DocumentVaultService`, five fresh
Gateway/Identity permission paths, and native LB-023 at
`apps/web/src/DocumentVaultApp.tsx`. ADR-026,
`docs/design/reviews/P4_S3_STITCH_HANDOFF.md` and
`docs/security/P4_S3_THREAT_MODEL.md` are the redacted authority.
`p4-s3-migration.ts` proves both owner migrations rollback/reapply/no-backfill;
`p4-s3-backup-restore.ts` rehearses owner-local pre-delete restore and
post-delete non-resurrection; artifact-disabled mocked/real Chromium lives in
`tests/browser/p4-s3*.spec.ts`; `validate-p4-s3.ps1` owns the one cumulative
campaign and exact cleanup.

## Commands and generated state

| Command                                     | Behavior                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm.cmd run demo:p1`                      | Builds and runs the synthetic P1 loop on local ports `3000`, `3001`, `3101`, `3102`, and PostgreSQL `55432`     |
| `pnpm.cmd run validate:p1-s1`               | One isolated Level C campaign with PostgreSQL, build/runtime, Chromium, accessibility and security evidence     |
| `pnpm.cmd run test:p1:integration`          | Targeted real-PostgreSQL service acceptance; requires provisioned database URLs                                 |
| `pnpm.cmd run test:p1:browser`              | Targeted browser acceptance; requires an already running built stack                                            |
| `pnpm.cmd run test:p2:identity-integration` | Targeted P2 Identity PostgreSQL Level B; requires a provisioned Identity-owned database                         |
| `pnpm.cmd run test:p2:browser`              | Artifact-disabled P2 UI/accessibility/security browser campaign against a running production web build          |
| `pnpm.cmd run validate:p2-s1`               | Single cumulative P2 Level C including P1 regression, Identity PostgreSQL, P2 browser and security gates        |
| `pnpm.cmd run test:p2-s2:browser`           | LB-008–LB-010 browser/accessibility/privacy campaign; real runtime path is enabled by the Level C runner        |
| `pnpm.cmd run validate:p2-s2`               | Cumulative P2-S2 Level C with P1/P2-S1 regression, PostgreSQL, built runtime, Chromium and security             |
| `pnpm.cmd run test:p2-s3:migration`         | Disposable P2-S2 → P2-S3 migration/reapply/no-backfill/preservation check                                       |
| `pnpm.cmd run test:p2-s3:browser`           | LB-028–LB-031 browser/accessibility/privacy campaign; real runtime path is enabled by the Level C runner        |
| `pnpm.cmd run validate:p2-s3`               | Single cumulative P2-S3 Level C with regressions, migration/PostgreSQL, built runtime, Chromium and privacy     |
| `pnpm.cmd run test:p3-s1:migration`         | Disposable P1 → P3-S1 Care migration rollback/reapply/no-backfill/preservation check                            |
| `pnpm.cmd run test:p3-s1:integration`       | Real Identity/Care PostgreSQL authority, chronology, race, idempotency and atomicity evidence                   |
| `pnpm.cmd run test:p3-s1:browser`           | Artifact-disabled LB-012/LB-014 browser campaign; real path enabled by the Level C runner                       |
| `pnpm.cmd run validate:p3-s1`               | Single cumulative P3-S1 Level C with P1/P2 regressions, owned PostgreSQL, built runtime and privacy/a11y        |
| `pnpm.cmd run test:p4-s1:integration`       | Care/Notification PostgreSQL authority, recurrence, delivery, concurrency, idempotency and rollback proof       |
| `pnpm.cmd run test:p4-s1:migration`         | Separate Care/Notification rollback, reapply, preservation and no-backfill proof                                |
| `pnpm.cmd run test:p4-s1:browser`           | Artifact-disabled mocked and real LB-018/minimum-LB-019 Chromium acceptance                                     |
| `pnpm.cmd run validate:p4-s1`               | Exactly one cumulative P4-S1 Level C with owned PostgreSQL, runtime, privacy, accessibility and regressions     |
| `pnpm.cmd run test:p4-s2:integration`       | Care PostgreSQL authority, ordering, review/version, snapshot, concurrency, idempotency and rollback proof      |
| `pnpm.cmd run test:p4-s2:migration`         | Care migration 006 rollback, repeat apply, preservation and no-backfill proof                                   |
| `pnpm.cmd run test:p4-s2:browser`           | Artifact-disabled mocked/real LB-020/LB-021/required-LB-032 Chromium acceptance                                 |
| `pnpm.cmd run validate:p4-s2`               | Exactly one cumulative P4-S2 Level C with owned PostgreSQL, real offline runtime, privacy/a11y and regressions  |
| `pnpm.cmd run test:p4-s3:integration`       | Care PostgreSQL upload/list/download/delete, authority, validation, integrity, replay and atomic rollback proof |
| `pnpm.cmd run test:p4-s3:migration`         | Identity 004 and Care 007 rollback, repeat apply, preservation and explicit no-backfill proof                   |
| `pnpm.cmd run test:p4-s3:backup-restore`    | Owner-local pre-delete byte/binding restore and post-delete non-resurrection rehearsal                          |
| `pnpm.cmd run test:p4-s3:browser`           | Artifact-disabled mocked/real LB-023 Chromium, accessibility, privacy and failure-state acceptance              |
| `pnpm.cmd run validate:p4-s3`               | Single-use cumulative P4-S3 Level C with owned PostgreSQL, restore, runtime, privacy/a11y and regressions       |

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
- P4-S2 Care integration:
  `services/care-coordination/src/emergency-readiness-service.integration.test.ts`.
- P4-S2 migration and browser:
  `tools/quality/src/p4-s2-migration.ts` and artifact-disabled
  `tests/browser/p4-s2*.spec.ts`.
- P4-S3 Care integration:
  `services/care-coordination/src/document-vault-service.integration.test.ts`.
- P4-S3 migrations, restore and browser:
  `tools/quality/src/p4-s3-migration.ts`,
  `tools/quality/src/p4-s3-backup-restore.ts`, and artifact-disabled
  `tests/browser/p4-s3*.spec.ts`.
- CI aggregate gate: `.github/workflows/ci.yml`.
- Legacy foundation validator: `tools/quality/src/phase0.ts`.

## Update triggers

Update this map only when a package/service boundary, canonical command,
dependency direction, test location or generated-state rule changes. Routine
edits inside a mapped boundary do not require a map rewrite.
