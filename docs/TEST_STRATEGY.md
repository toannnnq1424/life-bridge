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

pnpm lifecycle scripts are denied unless explicitly allowlisted. Phase 0 permits only `esbuild`, the MIT-licensed platform binary used transitively by the pinned `tsx`/Vitest toolchain. New build-script packages require a separate review and configuration change; wildcard approval is prohibited.

## Test placement

Phase 0 harness tests live beside the validator under `tools/quality/src/*.test.ts`. Future package tests belong with the package they exercise. Cross-service tests must live in a clearly named integration workspace and use deterministic fixtures by default.

## Determinism and data safety

- Unit and integration tests use synthetic fixtures only.
- No real care-recipient, volunteer, credential, private link, or production identifier enters a fixture, snapshot, prompt, screenshot, or log.
- Time, random identifiers, external responses, and retry behavior are controlled in tests.
- Fixture mode and real adapters must satisfy the same internal contract.
- Vietnamese and English UI behavior require representative fixtures and localization tests.

## CI

The primary workflow is Windows-first and uses Node `22.22.3` plus pnpm `11.9.0`. GitHub Actions are pinned to immutable commit SHAs. CI installs from `pnpm-lock.yaml`, runs the Phase 0 validation sequence, then performs a network-backed dependency advisory audit.

Docker, GitHub CLI, PowerShell 7, and Python are optional in Phase 0. A future slice may make a tool mandatory only when its acceptance criteria require it and the doctor documentation is updated in the same change.

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
  affected slice. The P6 campaign verifies them across the frozen release scope;
  it does not postpone them.

P6 stabilization follows one campaign:

1. freeze the exact commit, schemas, fixtures, and journey inventory;
2. run static/build/unit/contract validation;
3. run integration and end-to-end validation;
4. run security/privacy/accessibility validation;
5. run performance/resilience/recovery validation;
6. batch fixes by root cause, use targeted retests, then run one final Level D
   validation.
