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

## INT-2026-004 — Integrate the external research-driven runbook

- Date: 2026-07-26
- Status: Planning overlay accepted
- Source: external runbook identified by SHA-256 in
  `docs/RUNBOOK_ADOPTION.md`
- Target: canonical repository planning/research/GitHub controls
- Scope: research gates, evidence levels, assumption tracking, re-check
  triggers, user-research safeguards, shared risk catalog, and phase crosswalk
- Contracts/data affected: documentation contracts only; external source rows
  are not imported as verified dataset records
- Validation: three scoped independent reviews plus targeted repository
  documentation/schema checks
- Conflicts/risks: external P0 status is stale; P0–P15 order conflicts with the
  early vertical-slice MVP; repeated edge matrices contain irrelevant rows
- Decision/change references: `CHG-2026-003`, ADR-011
- Follow-up: use GitHub milestones/issues for accepted P0–P6 slices and re-verify
  candidate sources only when their phase/slice opens

## INT-2026-005 — Publish governed GitHub execution objects

- Date: 2026-07-26
- Status: Published; integration review open; hosted CI not registered
- Source: `phase/0-foundation`
- Target: `dev`
- Scope: 10 project labels, 7 undated milestones, 19 bilingual controlled
  issues, and the Phase 0 integration pull request
- Contracts/data affected: execution metadata only; no product contract,
  migration, source dataset, or fixture value
- Validation: 19/19 issue titles, label sets, and milestones matched
  `docs/GITHUB_ISSUE_PLAN.md`; P0 has one closed issue; P1–P6 each have three
  open issues
- Conflicts/risks: [issue #3](https://github.com/toannnnq1424/life-bridge/issues/3)
  remains the external Stitch credential/canary gate; the user-owned canary
  diff remains excluded; `KI-012` records the initial GitHub Actions bootstrap
  gate
- Decision/change references: `CHG-2026-003`, ADR-011
- Review:
  [PR #21](https://github.com/toannnnq1424/life-bridge/pull/21),
  `phase/0-foundation` → `dev`; two commits, no base conflict, zero registered
  checks after the latest push; do not merge until required review/checks pass
- Follow-up: open either
  [P1-S1 #5](https://github.com/toannnnq1424/life-bridge/issues/5) or the
  separate [DATA-S1 #4](https://github.com/toannnnq1424/life-bridge/issues/4)
  in a new dedicated conversation

## INT-2026-006 — Expand production execution topology and debt gates

- Date: 2026-07-26
- Status: Canonical docs and GitHub execution objects synchronized
- Source: project-owner production-quality, MCP-debt, and GitHub Network
  requirements
- Target: active roadmap and GitHub milestones/issues/branch policy
- Scope: preserve P0–P5, split former P6 into P6–P12, add 18 production issues,
  remap open issues #18–#20, and make required MCP debt deploy-blocking
- Contracts/data affected: no runtime contract or dataset yet; future gates now
  require rolling compatibility, owned migrations, replay/recovery, security,
  SLO/DR, performance/cost, rollout, and live-operations evidence
- Validation: targeted cross-document checks followed by GitHub 1:1 audit;
  each implementation phase retains its own Level C/D evidence
- GitHub evidence: three new labels; P6 retitled; P7–P12 created; 18 new slice
  issues #22–#39; #18→P9-S2, #19→P11-S1, #20→P11-S3; standing P11 gate #40;
  P1 Stitch gate #3 carries `mcp-debt`
- Conflicts/risks: Stitch remains `MCP-DEBT-2026-001`; repository branch
  protection is unavailable on the current private GitHub plan, so PR-only and
  merge-commit topology are documented/manual controls
- Decision/change references: `CHG-2026-004`, `CHG-2026-005`, ADR-012,
  ADR-013
- Network policy: PR-only
  `init/research -> data -> dev -> test -> main`; short-lived `phase/* -> dev`;
  merge commits preserve convergence; production hotfixes forward-merge
  `main -> test -> dev`; no direct push, force-push, or decorative branch
- Follow-up: resolve KI-012, obtain hosted CI, and keep exact P1-S1 as the next
  product slice

## INT-2026-007 — Reclassify local Docker and Stitch evidence

- Date: 2026-07-26
- Status: Historical sandbox isolation classified; host Docker available;
  Stitch debt open; no system mutation
- Source: read-only Windows host and repository configuration audit
- Target: Phase 0 environment truth and future slice runners
- Scope: Docker Desktop/daemon visibility, sandbox permissions, repository
  Stitch registration, current task tool discovery, and credential hygiene
- Contracts/data affected: none
- Validation at the time: host Docker client/server both reported 27.5.1 while
  one restricted sandbox could not access `docker_engine`; repository Stitch
  TOML parsed, remained disabled, and contained only the environment variable
  name
- Conflicts/risks: doctor warning is a sandbox false-negative for host daemon
  availability; a key disclosed in chat cannot satisfy safe provisioning
- Decision/change references: `CHG-2026-005`, ADR-013,
  `MCP-DEBT-2026-001`, KI-001/KI-002/KI-004
- Follow-up: do not alter Docker services/Registry/ACLs. A later host-capable P0
  task reconfirmed client/server 27.5.1; Docker-backed product testing remains
  owned by the first slice that introduces a containerized runtime.

## INT-2026-008 — Activate official Stitch MCP and establish the P1 review set

- Date: 2026-07-26
- Status: Bounded MCP session complete; handoff in Design review—not Frozen
- Source: official `stitch.googleapis.com/mcp` endpoint through the Codex
  ChatGPT desktop app on Windows
- Target: private LifeBridge Stitch project, private design system, and redacted
  P1 review references for `LB-011`, `LB-013`, `LB-014`, and `LB-019`
- Scope: official MCP handshake, complete tool-schema discovery, private project
  listing, bounded project/design-system creation, desktop/mobile P1 generation,
  and visual review using synthetic non-sensitive content
- Contracts/data affected: design input only; no production UI code, real care
  data, credential value, private project identifier, or signed project URL was
  written to the repository
- Validation: handshake, authentication, schema discovery, project listing, and
  bounded generation succeeded; every listed review reference was visually
  audited; the repository contains only redacted local aliases and extracted
  intent
- Conflicts/risks: the P1 correction list, task/event/API contracts,
  localization, and manual accessibility/privacy/security evidence remain open;
  production UI is not ready and the handoff is not Frozen
- Decision/change references: `CHG-2026-006`, KI-001, KI-002, GitHub issue #3;
  this entry supersedes only the Stitch-availability evidence in
  `INT-2026-007`, whose historical Docker evidence remains unchanged
- Credential control: the user authorized a one-time exception for a disposable
  non-production key. Its value stayed in session memory and was never written
  to Git, repository configuration, issues, logs, or task handoffs. It must be
  retired/revoked and usage-reviewed before any deployment
- Follow-up: complete the P1 correction and review gates before handoff freeze;
  retire the disposable credential before clearing the deployment gate

## INT-2026-009 — Synchronize the P6–P12 GitHub execution catalog

- Date: 2026-07-26
- Status: Applied and audited
- Source: `docs/GITHUB_ISSUE_PLAN.md` under `CHG-2026-004` and
  `CHG-2026-005`
- Target: GitHub labels, milestones, issues, and standing deployment gate
- Scope: add `reliability`, `performance`, and `mcp-debt`; retitle P6; create
  P7–P12; create 18 slice issues; remap #18–#20 without deleting old bodies;
  create standing gate #40 and update P1 gate #3
- Contracts/data affected: execution metadata only; no application code,
  migration, fixture, private Stitch identifier, or credential
- Validation: all 21 P6–P12 slice titles, exact label sets, milestone mappings,
  and historical-body markers matched the canonical plan; issue-body secret
  shape scan returned zero findings
- Conflicts/risks: GitHub branch protection is unavailable for this private
  repository on the current plan; PR-only and merge-commit rules remain manual
  governance until platform support changes
- Decision/change references: `CHG-2026-004`, `CHG-2026-005`, ADR-012,
  ADR-013; [gate #40](https://github.com/toannnnq1424/life-bridge/issues/40)
- Follow-up: finish local P0 validation and restore hosted CI on PR #21 before
  merge; do not begin P1 in this task

## INT-2026-010 — Register hosted CI through the guarded default-branch bootstrap

- Date: 2026-07-26
- Status: Workflow registered; final PR #21 head still requires a green run
- Source: `phase/0-ci-bootstrap` at `1a40b5d`
- Target: `main` through [PR #41](https://github.com/toannnnq1424/life-bridge/pull/41)
- Scope: `.github/workflows/ci.yml` only under `CHG-2026-007`
- Contracts/data affected: CI registration only; no product/runtime/data change
- Validation: PR file audit confirmed one workflow file; bootstrap branch and
  bootstrap PR runs failed closed because the Phase 0 baseline was absent;
  merge commit `b3095cc` registered the active workflow; reopening PR #21 then
  created a full hosted run
- Conflicts/risks: branch protection remains unavailable on the current private
  plan; PR/check policy is manually enforced
- Decision/change references: `CHG-2026-007`, ADR-015, KI-012
- Follow-up: delete the bootstrap branch after reachability, then require the
  full Windows validation on the final PR #21 commit before merge to `dev`

## INT-2026-011 — Implement P1-S1 contracts, audience, and design handoff

- Date: 2026-07-26
- Status: Integrated and accepted
- Source: `phase/1-accountable-task-loop` from `dev@4b633755`; accepted final
  head `6ec1be362ce3512a8eba8b312cbe129f866d0aae`
- Target: `dev`; merged through PR #42 as
  `cea4f83fe7c0ff79a560e6bc14853a2f7f725133`
- Scope: issue #5 create/assign/complete loop, completion outbox, cross-user
  notification, confirmed dashboard/task/notification state, and VI/EN
  Stitch-derived UI
- Contracts/data affected: `P1-S1-v1` public task/dashboard/notification APIs,
  `care.task.completed.v1`, Care idempotency/audit/outbox ownership,
  Notification inbox/item ownership, and two owner-isolated PostgreSQL
  databases
- Validation: package Level A checks pass; real PostgreSQL integration is 5/5
  for concurrency/idempotency, cross-user delivery, self-suppression,
  authorization/conflict, outage/retry, restart and time zone. Dependency audit
  first exposed high Sharp/PostCSS advisories; `CHG-2026-009` excludes unused
  Sharp and applies the narrow patched PostCSS edge. Frozen install, zero-high
  audit, production build/runtime and browser 4/4 then passed. The changed
  candidate completed Level C with unit 19/19, contract 4/4, PostgreSQL 5/5,
  browser 4/4, build/static/docs/security gates, and exact cleanup of its
  Compose resources. Initial hosted push run `30182938417` then exposed a
  Linux-only `git.exe` secret-validator defect and missing explicit masks for
  disposable database passwords. The targeted portable process-output test is
  10/10 and secrets/config/diff checks pass after adding pre-export masks.
  The next PR run passed those gates and audit, then found Ubuntu lacks the
  external `rg` used only by the no-image assertion. That assertion now uses
  native PowerShell enumeration/search; parser and targeted reproducer pass.
  Final feature head `6ec1be362ce3512a8eba8b312cbe129f866d0aae`
  passed exact-head PR run `30183168519`. PR #42 merged to `dev` as merge
  commit `cea4f83fe7c0ff79a560e6bc14853a2f7f725133`, whose parents preserve the
  `4b633755` base and `6ec1be3` feature convergence. Post-merge `dev` run
  `30183280672` passed and issue #5 was closed completed.
- Conflicts/risks: Phase 0 draft did not name the one notification trigger or
  recipient. `CHG-2026-008` selects creator-if-distinct and durable
  self-suppression. Branch protection remains unavailable, so SHA/check review
  is manual.
- Design: six reviewed remote Stitch aliases remain the provenance. Handoff
  version 1.0 freezes native semantic, localization, responsive, failure-state,
  privacy, and accessibility corrections without importing generated source or
  private locators.
- Decision/change references: `CHG-2026-008`, `CHG-2026-009`, ADR-016,
  ADR-017, issue #5
- Follow-up: P1 promotion is complete. Start only a fresh task from current
  integrated `dev` for P2-S1; freeze real identity/session/household access,
  recovery, language, and accessibility-preference contracts before code.
  DATA-S1 remains separate and neither next scope starts in this closeout.
