# LifeBridge Test Strategy

## Purpose

LifeBridge validates coherent changes at the smallest useful scope. The project does not run the full suite after every edit. Tests must prove user-visible vertical slices, shared contracts, failure handling, and safe behavior without wasting local or CI time.

## Validation levels

### Level A — Local static validation

Run after a small coherent group of edits:

```powershell
pnpm.cmd run format:check
pnpm.cmd run lint
pnpm.cmd run typecheck
```

Prefer package-scoped equivalents once application packages exist. Format only intended files before the final check.

### Level B — Targeted defect validation

For a specific bug:

1. Identify or add the smallest reproducing test.
2. Run only that test and its immediate module tests.
3. Make one coherent fix.
4. Rerun the reproducer and affected static validation.
5. Defer unrelated tests to the slice checkpoint.

After two failed hypotheses, stop blind iteration and record evidence and the next diagnostic action in `docs/SESSION_LOG.md`.

### Level C — Vertical-slice validation

At the end of a slice, run:

- affected-package format, lint, and type check;
- related unit tests;
- the slice integration test;
- the affected build target;
- one end-to-end smoke path;
- documentation and secret-hygiene validation.

Every slice must exercise its success path, relevant denied/invalid input, dependency failure, and truthful error presentation.

### Level D — Phase or release validation

Run once at the end of a phase, before merge, release, or submission:

```powershell
pnpm.cmd run validate:phase0
pnpm.cmd run security:deps
```

As product packages are added, the phase command must include repository-wide format, lint, type check, unit tests, integration tests, production builds, and primary smoke tests.

## Phase 0 harness

| Command                         | Scope                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| `pnpm.cmd run doctor`           | Classify mandatory and optional Windows prerequisites               |
| `pnpm.cmd run format:check`     | Check formatting of Phase 0-owned source/config/docs                |
| `pnpm.cmd run lint`             | Lint the TypeScript quality harness and ESLint config               |
| `pnpm.cmd run typecheck`        | Type-check harness and unit tests                                   |
| `pnpm.cmd run test:unit`        | Run quality-harness unit tests                                      |
| `pnpm.cmd run test:integration` | Validate docs, configuration, and secret hygiene together           |
| `pnpm.cmd run validate:docs`    | Verify required useful Phase 0 documents and bilingual README       |
| `pnpm.cmd run validate:config`  | Verify pinned runtime, scripts, configs, CI, and MCP secret hygiene |
| `pnpm.cmd run validate:secrets` | Scan tracked/unignored text without printing detected values        |
| `pnpm.cmd run build`            | Compile-check non-test Phase 0 TypeScript                           |
| `pnpm.cmd run validate:phase0`  | Run the complete offline Phase 0 validation sequence                |
| `pnpm.cmd run security:deps`    | Query dependency advisories; network-dependent                      |

The secret validator is a fast repository hygiene gate, not a substitute for provider-side key rotation, GitHub secret scanning, incident review, or a release-time history scan with an approved dedicated scanner.

pnpm lifecycle scripts are denied unless explicitly allowlisted. The workspace
permits only `esbuild`, the MIT-licensed platform binary required by the pinned
tsx/Vitest and service bundle toolchain. Because P1-S1 has no image pipeline,
Next's optional `sharp` is excluded from resolution and remains explicitly
lifecycle-denied. A parent-scoped override moves only Next 16.2.11's PostCSS
edge to advisory-patched 8.5.18. Frozen install, audit, production Next build,
and real Chromium runtime prove this narrow graph; no advisory ignore or global
script approval is allowed. New build-script packages require a separate review
and configuration change; wildcard approval is prohibited.

## Test placement

Phase 0 harness tests live beside the validator under `tools/quality/src/*.test.ts`. Future package tests belong with the package they exercise. Cross-service tests must live in a clearly named integration workspace and use deterministic fixtures by default.

## Determinism and data safety

- Unit and integration tests use synthetic fixtures only.
- No real care-recipient, volunteer, credential, private link, or production identifier enters a fixture, snapshot, prompt, screenshot, or log.
- Time, random identifiers, external responses, and retry behavior are controlled in tests.
- Fixture mode and real adapters must satisfy the same internal contract.
- Vietnamese and English UI behavior require representative fixtures and localization tests.

## CI

The primary workflow is Windows-first and uses Node `22.22.3` plus pnpm
`11.9.0`. GitHub Actions are pinned to immutable commit SHAs. P1 CI checks out
the literal candidate SHA, installs the frozen lockfile under the narrow
lifecycle policy, and runs Windows static/unit/build/security plus an Ubuntu
PostgreSQL/Chromium acceptance job and one aggregate gate.

Cross-platform repository validators select `git.exe` only on Windows and
`git` on Unix, tolerate empty/Buffer child-process output, and have a targeted
regression for that boundary. CI-generated disposable database passwords are
masked before export to `GITHUB_ENV`; synthetic scope does not permit plaintext
credential-shaped values in hosted logs.

Docker, GitHub CLI, PowerShell 7, and Python are optional in Phase 0. A future slice may make a tool mandatory only when its acceptance criteria require it and the doctor documentation is updated in the same change.

## P1-S1 Level C contract

The one stable-candidate command is:

```powershell
pnpm.cmd run validate:p1-s1
```

It must execute, in one campaign:

1. affected format, lint, and TypeScript checks;
2. unit and frozen API/event consumer contract tests;
3. PostgreSQL integration with independently owned Care and Notification
   databases;
4. atomic completion/outbox, idempotent create/complete, optimistic conflict,
   duplicate/redelivered event, self-suppression, outage/retry, crash-after-
   consumer-commit, restart durability, time-zone, authorization, audit, and
   log-redaction cases;
5. affected production builds;
6. Playwright against the real gateway/service contracts for the complete
   Lan-create/Minh-complete/Lan-notified flow in both `vi-VN` and `en`;
7. keyboard/focus, semantic accessibility, 320 px and critical responsive
   checks;
8. documentation, configuration, generated-artifact, private Stitch locator,
   secret, and dependency advisory checks.

Hosted CI checks out the literal pull-request head SHA. A Windows job proves
the supported static/unit/production-build path; an Ubuntu PostgreSQL
service-container job proves owned database integration and Chromium browser
acceptance. The same browser campaign is also run locally on Windows before
push. One aggregate check depends on both.
Because branch protection is unavailable, the reviewer manually records that
local HEAD, remote branch head, PR head, and successful run head are identical.

Manual P1 acceptance evidence records keyboard-only flow, NVDA with Chrome or
Firefox, Narrator with Edge, 200% zoom, 400% reflow, text spacing, forced
colors, reduced motion, target size, and measured contrast. An unsupported row
is a named limitation, never an implicit pass.

## Failure classification

Classify a failure before editing:

- implementation defect;
- test defect;
- environment or permission issue;
- dependency issue;
- unrelated pre-existing failure.

Fix only failures caused by or blocking the active slice. Record deferred validation and unresolved issues in persistent project documentation.

## Research and risk validation

- Validate research/source/assumption schemas and provenance offline.
- Do not scrape live links in CI or treat HTTP success as evidence freshness.
- Before release, trace every public numerical claim to source, date, geography,
  limitation, and recorded re-check trigger.
- For each slice, select applicable rows from the shared risk catalog in
  `docs/RUNBOOK_ADOPTION.md`; do not run a generic matrix of irrelevant cases.
- Cross-cutting security/accessibility/offline controls begin with the first
  affected slice. P6–P12 verify them across progressively broader production
  scope; they do not postpone them.

## Production-maturity validation campaigns

| Phase | Required additional evidence                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6    | Provider/consumer compatibility, mixed-version primary flow, independent artifact/start/health, architecture fitness, dependency isolation                  |
| P7    | `N-1 -> N` migrations, replay/reconciliation/dead-letter recovery, duplicate/loss checks, backup/restore, retention/deletion, RPO/RTO                       |
| P8    | Authorization/isolation matrix, consent revocation, secret rotation, SBOM/provenance, dependency/container scan, abuse and response exercise                |
| P9    | Redacted telemetry journey, SLI/SLO/error budget, injected-alert/runbook test, degraded/offline/conflict states, incident and DR rehearsal                  |
| P10   | Representative load, spike and soak, backpressure/saturation, correctness under scale, capacity and cost thresholds                                         |
| P11   | Clean install, full CI/security/performance/DR evidence, immutable production build, migration/rollback, staged rollout, smoke, demo, and release rehearsal |
| P12   | Alert-to-resolution/postmortem, patch/vulnerability/credential cadence, backup/restore recheck, SLO review, privacy-safe feedback governance                |

Each campaign:

1. freeze the exact commit, schemas, fixtures, and journey inventory;
2. run static/build/unit/contract validation;
3. run integration and end-to-end validation;
4. run security/privacy/accessibility validation;
5. run performance/resilience/recovery validation;
6. batch fixes by root cause, use targeted retests, then run one final Level D
   validation.

## P2-S1 validation contract

Backend implementation while Stitch is blocked uses only package-scoped Level
A and targeted Level B. No partial command/result is labeled P2 Level C.

The eventual one stable-candidate command is:

```powershell
pnpm.cmd run validate:p2-s1
```

It must run after seven `LB-001`–`LB-007` handoffs are Frozen and include:

1. frozen install, P2 footprint format, affected lint/type/unit/contract/build;
2. Identity-owned PostgreSQL migration, restart, duplicate/race, rate-limit,
   TOTP replay, recovery single-use, session rotation/revoke/idle/absolute
   expiry, preference version/non-gating, audit and no-cross-write integration;
3. Gateway actor-header stripping, cookie flags, CSRF/origin/Fetch Metadata,
   fixture public/production rejection and non-disclosing household denial;
4. real register → factor → recovery-code acknowledgement → sign-in → factor →
   onboarding/preferences → authorized account browser journeys in VI/EN;
5. unknown/wrong/locked/disabled/duplicate/invalid/expired/used equivalence,
   offline blocked behavior and no secret in URL/history/web storage;
6. password-manager/autocomplete/paste, keyboard/focus, axe on material states,
   320 px/reflow/long strings/reduced motion/forced-colors automation plus
   honest manual NVDA/Narrator/zoom/text-spacing rows;
7. docs/config/secrets/generated junk/private Stitch locator/log redaction,
   dependency audit, `git diff --check`, and exact task-owned cleanup.

P2 browser runs must disable trace, video and screenshots for credential/TOTP/
recovery-code flows unless an accepted redaction design proves artifacts safe;
raw authentication artifacts are never uploaded. Hosted CI retains literal
head checkout, Node 22, Windows static/unit/build/security, Ubuntu PostgreSQL +
Chromium, and one P2 aggregate gate.

The Frozen handoff and artifact-disabled P2 browser project now satisfy the
preconditions to run the single Level C. Merge-as-complete and issue #6 closure
remain deferred until that command and exact-head hosted CI pass.

## P2-S2 validation contract

The one stable-candidate command is:

```powershell
pnpm.cmd run validate:p2-s2
```

It cumulatively covers P1/P2-S1 regression; affected format/lint/type, unit and
contracts; Identity-owned real PostgreSQL invitation lifecycle, decoy
equivalence, concurrency, idempotency, membership and context conflicts;
production build; built web → Gateway → Identity → PostgreSQL; artifact-disabled
LB-008–LB-010 and P2-S1 browser/axe/keyboard/reflow/offline/security paths;
docs/config/secrets/dependency/diff checks; and PID-scoped resource cleanup.

The 2026-07-26 campaign invoked that command once. After P1 static, unit 38/38,
contracts 8/8, PostgreSQL 5/5 and build passed, a P1 fixture-readiness
compatibility defect stopped the command. Targeted Level B passed after the
fixture-safe correction. Already-green inputs were not rerun; P1 browser 4/4
and all remaining P2 gates resumed in the same campaign and passed: aggregate
unit 46/46, contracts 8/8, P2-S2 PostgreSQL 7/7, real-plus-mocked P2-S2 browser
7/7, P2-S1 browser 4/4, build/security/docs/config/secrets/diff and exact
cleanup. No second Level C command was issued.

Hosted CI must check out the literal PR head and run
`scripts/validate-p2-s2.ps1 -UseExistingDatabase -SkipInstall` before a merge
commit. The resulting `dev` merge SHA must pass the same hosted workflow.

An MCP becoming callable does not satisfy a test gate by itself. Close required
MCP debt only after secret handling, least-privilege/data-egress and complete
tool-schema review, one synthetic canary, and the affected slice validation are
recorded. Any open deploy-blocking MCP debt fails P11 release validation.
