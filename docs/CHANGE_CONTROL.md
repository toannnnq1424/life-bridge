# Phase and Slice Change Control

## Purpose

Plans are expected to evolve as research and implementation produce evidence.
No planned change may exist only in a chat. This document defines how LifeBridge
records additions, removals, reordering, replacement, and deferral.

## Change triggers

Create a record when any of the following occurs:

- a phase or slice is added, removed, split, combined, reordered, or deferred;
- acceptance criteria or validation level changes;
- a service boundary, API/event contract, data owner, or dependency changes;
- a research source changes intended behavior or invalidates an assumption;
- security, privacy, accessibility, deployment, or credential evidence changes
  the plan;
- implementation reveals work that belongs to another phase.

Minor wording fixes and implementation details within approved acceptance
criteria do not need a change record.

## Required update sequence

1. Append a change record below.
2. Update `docs/IMPLEMENTATION_PLAN.md` with both the previous and revised plan.
3. Update `docs/WORKSTREAM_BOARD.md`.
4. Update `docs/INTEGRATION_LOG.md` when branches, contracts, services, data, or
   environments are affected.
5. Add or supersede an ADR in `docs/DECISIONS.md` for durable decisions.
6. Update `docs/KNOWN_ISSUES.md` for new risks or blockers.
7. Append `docs/SESSION_LOG.md` with completed validation and exact next action.
8. Update `docs/REPOSITORY_MAP.md` only if repository structure changed.

Never rewrite history by silently replacing the old plan. Mark it superseded and
link the change identifier.

## Record template

```md
## CHG-YYYY-NNN — Short title

- Date:
- Status: proposed | approved | implemented | rejected | superseded
- Requested by:
- Evidence:
- Previous plan:
- Revised plan:
- Reason:
- Affected phases/slices:
- API/data/service impact:
- Security/privacy/accessibility impact:
- Validation impact:
- Migration/rollback:
- Documentation updated:
- Exact follow-up:
```

## Phase 0 records

### CHG-2026-001 — Windows and Codex App become the only active delivery path

- Date: 2026-07-25
- Status: implemented in Phase 0 documentation
- Requested by: project owner
- Evidence: explicit project instruction
- Previous plan: mixed Windows/macOS ownership and VS Code/Cline/9Router tooling
- Revised plan: Windows with Codex ChatGPT desktop app; Stitch through
  repository-scoped Codex MCP configuration
- Reason: align the delivery path with the actual project environment
- Affected phases/slices: all
- API/data/service impact: none
- Security/privacy/accessibility impact: Windows accessibility matrix retained;
  legacy credential incident remains historical evidence
- Validation impact: CI and doctor are Windows-first
- Migration/rollback: historical documents are preserved and marked
- Documentation updated: active foundation and Stitch runbooks
- Exact follow-up: pass offline configuration validation, then complete the
  credential and read-only canary gates

### CHG-2026-002 — Add bilingual recent-data research lane

- Date: 2026-07-25
- Status: implemented for the Phase 0 baseline; promotion branches pending
- Requested by: project owner
- Evidence: explicit requirement to evaluate data from the last five to ten years
- Previous plan: fixture design without a dedicated research branch
- Revised plan: `init/research → data → dev`, with a 2016–2026 evidence window
  and priority on 2021–2026 sources
- Reason: ground product and fixture decisions in recent, traceable evidence
- Affected phases/slices: Phase 0 research baseline and later data-dependent slices
- API/data/service impact: source provenance and fixture metadata become required
- Security/privacy/accessibility impact: no raw PII; public does not imply
  redistributable
- Validation impact: source freshness, license, geography, limitations, and
  intended use must be checked
- Migration/rollback: research findings may be superseded, never silently erased
- Documentation updated: `docs/research/`, `data/`, roadmap and branch policy
- Bootstrap exception: the initial research governance/register documents are
  part of the single coherent `phase/0-foundation` commit because the governed
  branches did not exist before Phase 0. This exception contains no raw dataset
  or product fixture. After the baseline branches are created, every new
  research artifact starts on `init/research` and reaches product work only
  through review into `data`, then `dev`.
- Exact follow-up: promote only approved synthetic/licensed artifacts from
  `init/research` into `data`
