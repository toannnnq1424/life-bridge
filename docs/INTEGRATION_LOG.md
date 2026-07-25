# Integration Log

This file records how branches, contracts, services, data, design artifacts, and
environments are intended to converge. It is not a substitute for Git history.

## Entry template

```md
## INT-YYYY-NNN — Title

- Date:
- Status:
- Source:
- Target:
- Scope:
- Contracts/data affected:
- Validation:
- Conflicts/risks:
- Decision/change references:
- Follow-up:
```

## INT-2026-001 — Adopt the existing Stitch/design baseline

- Date: 2026-07-25
- Status: In progress
- Source: `ai/lifebridge/stitch-mcp-integration` at `74c5b31`
- Target: `phase/0-foundation`
- Scope: preserve existing design, accessibility, Stitch package review, and
  incident evidence while replacing the active delivery path with Windows +
  Codex App
- Contracts/data affected: no executable application contract exists at source
- Validation: tracked-file inventory, diff inspection, config parsing, heuristic
  secret scan
- Conflicts/risks: pre-existing uncommitted change in
  `docs/orchestration/reports/STITCH_MCP_CANARY.md` remains user-owned
- Decision/change references: `CHG-2026-001`
- Follow-up: keep the dirty file unstaged; validate the new Codex configuration
  offline

## INT-2026-002 — Establish the research promotion lane

- Date: 2026-07-25
- Status: Baseline seeded; local promotion branches established
- Source: `init/research`
- Target: `data`, then `dev`
- Scope: bilingual research register, provenance, evaluation, and synthetic
  fixture specification based on 2016–2026 sources
- Contracts/data affected: fixture metadata and source-attribution contract
- Validation: freshness, publisher, geography, license/terms, limitations,
  sensitivity, and intended-use review
- Conflicts/risks: public sources may not permit redistribution; raw PII is
  prohibited
- Bootstrap exception: Phase 0 seeds governance/register documents on
  `phase/0-foundation` before the governed branches exist. It contains no raw
  dataset or product fixture and cannot be reused after branch creation.
- Decision/change references: `CHG-2026-002`
- Follow-up: create/push promotion branches only after Phase 0 validation

## INT-2026-003 — Validate the Phase 0 integration baseline

- Date: 2026-07-26
- Status: Validated locally
- Source: `phase/0-foundation`
- Target: `dev`
- Scope: governance, Windows tooling, CI, recent-data controls, service/data
  boundaries, and Codex App Stitch gates
- Contracts/data affected: documentation and validation contracts only; no
  executable product service, migration, raw dataset, or product fixture
- Validation: Phase 0 validator passed with 9 unit tests; dependency audit found
  no known high-severity vulnerability; a clean detached worktree materialized
  dependencies and passed bootstrap/validation twice
- Conflicts/risks: the pre-existing user-owned
  `docs/orchestration/reports/STITCH_MCP_CANARY.md` edit remains excluded
- Decision/change references: ADR-001 through ADR-010, `CHG-2026-001`,
  `CHG-2026-002`
- Follow-up: publish the validated branch baseline, then start exactly one new
  `P1-S1` or research conversation

## Promotion rules

- No direct feature commit to `main`, `test`, `dev`, or `data`.
- `phase/*` integrates to `dev` through review and required checks.
- `dev` promotes the exact tested commit to `test`; `test` promotes the exact
  release candidate to `main`.
- `init/research` may add research evidence only. Approved schemas/fixtures move
  through `data`, then forward into `dev`.
- Back-merges and conflict resolution are explicit; never choose an entire side
  without contract review.
