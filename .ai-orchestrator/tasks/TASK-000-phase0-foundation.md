# TASK-000 — Phase 0 Foundation

## Goal

Create a reproducible, documented, secure Windows foundation without implementing
broad product functionality.

## Allowed paths

- repository documentation and orchestration files;
- root project/tooling configuration;
- `scripts/`, `tools/quality/`, `.github/workflows/`;
- `.codex/config.toml`;
- research registry and synthetic fixture documentation.

## Forbidden paths and actions

- system configuration, Registry, service or firewall mutation;
- secret entry or credential storage;
- live Stitch/design-generation calls;
- production data or migration;
- recursive deletion, Git history rewrite, branch deletion, force push;
- staging the pre-existing dirty Stitch canary file without explicit approval.

## Acceptance criteria

- [x] Product identity, microservice boundaries, data ownership, phases, slices,
      and change control are documented.
- [x] README and data-facing material support Vietnamese and English.
- [x] Repository map and session memory are accurate.
- [x] Windows doctor/bootstrap are idempotent and avoid Execution Policy changes.
- [x] Format, lint, type check, unit/integration validation, build, CI, and secret
      hygiene are configured.
- [x] Recent-data sources from 2016–2026 are evaluated with provenance and
      limitations.
- [x] Codex App Stitch configuration is secret-free, disabled, and guarded.
- [x] Phase 0 validation passes or every external blocker is classified.
- [x] Intended files are reviewed and committed coherently.

## Validation

Use `scripts/validate-phase0.ps1` plus fresh-worktree materialization after the
tooling workstream lands. Do not invoke live Stitch or deploy.

## Completion evidence

- Closed: 2026-07-26.
- Final Phase 0 validation: pass with 9 unit tests.
- Dependency audit: no known vulnerability at the configured high threshold.
- Fresh detached worktree: bootstrap/validation passed twice from the coherent
  foundation commit; the verified temporary worktree was then removed.
- Local branches established at the baseline: `phase/0-foundation`, `dev`,
  `test`, `data`, and `init/research`.
- Preserved user work: the pre-existing Stitch canary edit remains unstaged.
