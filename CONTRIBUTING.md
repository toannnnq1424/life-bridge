# Contributing to LifeBridge

## Supported development environment

LifeBridge development is supported on Windows with Codex in the ChatGPT desktop app.

Required baseline:

- Git;
- Node.js 22.x;
- pnpm 11.9.0;
- PowerShell 5.1 or newer;
- Docker Desktop only for workflows that require local integration services.

Start with:

```powershell
pnpm.cmd bootstrap
pnpm.cmd doctor
```

The Windows doctor reports missing tools, an unavailable Docker daemon, unreadable Docker user configuration, or other environment issues. It must not change Execution Policy, Registry, firewall, services, Docker configuration, or credentials. Use `npm.cmd`, `npx.cmd`, and `pnpm.cmd` instead of PowerShell shims when policy blocks `*.ps1`.

## Choose one unit of work

One branch and one Codex conversation should own one phase or one vertical slice.
The active roadmap is the cumulative production plan `P0`–`P12`. Production
quality is applied in each relevant product slice and then proven across the
release scope in `P6`–`P12`; it is not deferred until deployment. The exact next
product slice remains `P1-S1 — Accountable care-task loop`.

Before implementation:

1. identify the phase/slice ID from `docs/IMPLEMENTATION_PLAN.md`;
2. confirm its user-visible outcome and acceptance criteria;
3. inspect the current contract, direct dependencies, tests, design handoff, and known issues;
4. list the minimum files and validation commands;
5. record dependencies, blockers, and deferred work on `docs/WORKSTREAM_BOARD.md`.

Do not add the next slice because the current one finished early. Hand it off explicitly.

## Branch and promotion model

```text
init/research -> data -> dev -> test -> main
                         ^
                         |
                      phase/*
```

| Branch          | Purpose                                                               | PR-only convergence                         |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| `main`          | Stable, releasable history                                            | receives accepted `test`                    |
| `test`          | Release candidate and phase-level QA                                  | receives `dev`; promotes to `main`          |
| `dev`           | Integrated, accepted slices                                           | receives `phase/*` and `data`               |
| `data`          | Reviewed research metadata, schemas, fixtures, migrations, provenance | receives `init/research`; promotes to `dev` |
| `init/research` | Vietnamese/English real-world source investigation                    | promotes reviewed evidence to `data`        |
| `phase/<name>`  | One short-lived phase or vertical slice from current `dev`            | returns to `dev`                            |

Use `init/research`; Git does not allow `/init`. Do not commit directly to
long-lived branches. Every promotion uses a reviewed pull request and required
checks. Use merge history that keeps real divergence and convergence visible in
GitHub Network. Do not create empty, decorative, duplicate, or permanently
divergent branches. Do not use `codex/*`.

Never force-push or rewrite public history. A `hotfix/*` branch may start from
`main` only for an accepted production incident; after its reviewed release it
must merge back through `test` and `dev`. Do not merge until acceptance and
required CI pass.

## Vertical-slice pull requests

A product slice must include the minimum UI, API, service, persistence, event, error handling, and tests needed for one demonstrable outcome. It must not mix unrelated cleanup.

A PR description must include:

- phase/slice ID and objective;
- planned versus actual behavior;
- implemented path and affected contracts;
- important decisions and Change/ADR IDs;
- validation commands and results;
- screenshots or a redacted design/demo reference when UI changed;
- privacy, security, data, migration, and rollback impact;
- known limitations and deferred work;
- exact next slice.

## Phase-close orientation

Closing a phase or slice must append a next-phase orientation based on repository
evidence, not aspiration:

- planned versus actual behavior and architecture;
- code, contract, migration, and test evidence now available;
- new or retired dependencies and integration/MCP debt;
- acceptance and validation changes for the next slice;
- the exact next slice and its first action.

This handoff may refine the plan through Change Control. It does not authorize
implementing the next phase/slice in the same conversation.

## UI design workflow

Every production UI flow follows:

```text
requirement
-> flow/permission contract
-> Google Stitch MCP design input
-> product + accessibility + privacy + security review
-> frozen handoff
-> semantic implementation
-> consolidated tests
```

Use `docs/design/reviews/SCREEN_HANDOFF_TEMPLATE.md`. Never copy generated HTML, CSS, scripts, tracking code, CDN dependencies, or business logic into production. Never send credentials, real care data, PII, private links, or signed URLs to Stitch.

## Validation policy

Do not run the full suite after every edit.

| Checkpoint          | Required validation                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Coherent edit group | Changed-file formatting, affected lint, scoped type check                                                              |
| Specific bug        | Reproducing test, directly adjacent tests, affected static checks                                                      |
| Completed slice     | Affected lint/type check, unit/contract tests, slice integration test, browser flow when applicable, affected build    |
| Phase/merge/release | Repository format/lint/type check, full unit/integration, production build, smoke test, checkpoint-specific evaluation |

Phase 0 has a canonical aggregate:

```powershell
pnpm.cmd validate:phase0
```

Do not rerun a successful unchanged command. Classify failures before editing and record intentionally deferred validation.

## Data contributions

Research uses an evidence window of 2016–2026 and prioritizes 2021–2026 publications/reference years. Older sources require a still-current baseline/standard rationale.

Every registered source must identify:

- publisher and geography;
- publication/reference year and retrieval date;
- stable URL;
- license or terms;
- intended use and fixture/background classification;
- limitations, sensitivity, privacy, and freshness.

Do not copy raw microdata into Git. Fixtures must be synthetic or safely de-identified, deterministic, documented, and free of real care-recipient information. Keep Vietnamese/English terms aligned with `docs/research/DOMAIN_GLOSSARY.vi-en.md`.

## Architecture contributions

- Respect service ownership and versioned API/event contracts.
- A service writes only its own PostgreSQL database/schema.
- Do not introduce cross-service SQL joins or table writes.
- PostgreSQL is the default, not a mandate to share data.
- A new engine requires an accepted ADR covering access pattern, owner, consistency, backup/restore, retention, migration, cost, and failure mode.
- Redis may cache but is never source of truth.
- Use transactional outbox/inbox and idempotency for durable cross-service work.

## Commits

Use conventional commits:

```text
feat: complete assigned care task
fix: reject duplicate task completion
test: cover notification outbox retry
docs: record Phase 2 sequence change
refactor: isolate task status transition
chore: pin Windows toolchain
ci: validate phase branch
```

Before committing:

1. inspect `git status`;
2. inspect staged and unstaged diffs;
3. preserve unrelated dirty work;
4. confirm required validation passed after the last relevant edit;
5. confirm docs and design handoff are current;
6. scan for secrets, PII, debug code, local files, and generated junk;
7. stage only the coherent unit.

## Roadmap changes

Do not silently reorder or expand phases. Create a stable Change ID and record:

- planned baseline;
- proposed/actual implementation;
- reason and evidence;
- downstream product/API/data/UI/security/test/delivery impact;
- validation needed;
- follow-up owner and exact target slice;
- state: proposed, accepted, implemented, rejected, or superseded.

Update `docs/IMPLEMENTATION_PLAN.md`, `docs/WORKSTREAM_BOARD.md`, `docs/SESSION_LOG.md`, and—when relevant—`docs/DECISIONS.md` and `docs/INTEGRATION_LOG.md`.

## Safety and responsible disclosure

LifeBridge coordinates care; it does not diagnose or automate emergency response. Use synthetic identities and scenarios in code, screenshots, logs, demos, and tests.

Report a suspected secret or sensitive-data exposure without reproducing its value. Stop external calls, preserve redacted evidence, and follow `docs/SECURITY.md`. Do not “fix” an environment blocker with broad privileges or destructive cleanup.
