# Codex Orchestration Design

## Scope

This document governs development agents. LifeBridge does not currently include
an end-user AI agent, diagnosis engine, or autonomous care decision-maker.

Codex App is the primary architect, implementer, reviewer, and integration
controller. Cline, 9Router, and macOS are outside the active workflow.

## Conversation boundary

One Codex task contains exactly one phase or one vertical slice.

At task start, read:

1. `CODEX.md`;
2. `docs/PRODUCT_SPEC.md`;
3. `docs/REPOSITORY_MAP.md`;
4. `docs/IMPLEMENTATION_PLAN.md`;
5. latest `docs/SESSION_LOG.md` entries;
6. `docs/KNOWN_ISSUES.md`;
7. only files and direct dependencies for the active slice.

Do not rescan the repository unless structure changed materially or the
repository map is proven stale.

## Roles

| Role                 | Default access          | Responsibility                                                    |
| -------------------- | ----------------------- | ----------------------------------------------------------------- |
| Primary orchestrator | workspace write         | scope, dependencies, integration, documentation, final validation |
| Repository analyst   | read-only               | map relevant code and contracts                                   |
| Research analyst     | named research paths    | source provenance, freshness, license, limitations                |
| Implementer          | explicit file allowlist | one bounded ticket                                                |
| Test/reviewer        | read-only by default    | reproduce, validate, classify findings                            |
| Safety reviewer      | read-only               | paths, secrets, destructive actions, external effects             |

Parallel writers must never own the same file. Subagents do not commit, push,
merge, alter global configuration, handle credentials, or broaden scope unless
the primary task explicitly authorizes it.

## Ticket contract

Every implementation ticket records:

- goal and user-visible outcome;
- dependencies;
- allowed and forbidden paths;
- required changes and non-goals;
- acceptance criteria;
- validation level and exact commands;
- data/security impact;
- rollback or compensation;
- expected handoff.

Tickets live under `.ai-orchestrator/tasks/`.

## Evidence language

Agent reports distinguish:

- **Fact:** observed in repository, runtime, tool, test, or cited source.
- **Inference:** conclusion derived from named facts.
- **Missing:** unavailable evidence.
- **Recommendation:** proposed next action with trade-off.

No agent may claim a GUI action, remote mutation, test, deployment, MCP call, or
credential operation succeeded without direct evidence.

## Change control

If evidence changes a future phase or slice:

1. stop scope expansion in the current slice;
2. create a change record using `docs/CHANGE_CONTROL.md`;
3. update planned versus actual scope in `docs/IMPLEMENTATION_PLAN.md`;
4. update status/ownership in `docs/WORKSTREAM_BOARD.md`;
5. record integration impact in `docs/INTEGRATION_LOG.md`;
6. create an ADR when architecture, contract, data ownership, security, or
   product scope changes;
7. append the exact next action to `docs/SESSION_LOG.md`.

Only blockers required for current acceptance criteria are fixed in the current
slice. Other changes become a later slice.

## Validation economy

- Level A: changed-file formatting, affected lint, affected type check.
- Level B: reproducing and adjacent tests for a bug.
- Level C: affected lint/type/unit/integration/build and slice smoke.
- Level D: repository-wide validation only at phase close, merge, release, or
  submission.

Successful unchanged commands are not rerun.
