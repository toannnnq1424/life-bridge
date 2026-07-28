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

## INT-2026-012 — Build the P2-S1 backend candidate behind the Stitch gate

- Date: 2026-07-26
- Status: In progress; backend candidate validated locally and preserved in
  draft PR #44, production UI and promotion blocked
- Source: `phase/2-account-access-onboarding` from `dev@a3e9fc2`
- Target: `dev` by PR only; no merge or issue #6 closure is permitted while
  `MCP-DEBT-2026-002` remains open
- Scope: first-party registration, password plus required TOTP, saved recovery
  artifacts, password/factor recovery, opaque server sessions, optional VI/EN
  and accessibility preferences, account-only onboarding and gateway boundary
- Contracts/data affected: `P2-S1-v1`, Identity-owned PostgreSQL migration,
  digest-only session/challenge/recovery storage, encrypted TOTP seed,
  service-owned audit, gateway cookie/origin/CSRF contract; no Care or
  Notification database write and no household capability
- Validation: contract/config/crypto/internal/gateway Level A checks and
  Identity PostgreSQL Level B are green. The 5/5 database cases cover
  registration/factor/recovery acknowledgement, response equivalence, atomic
  rate buckets, one-winner TOTP replay, recovery single-use, password/factor
  recovery, preference persistence, session rotation/revoke/idle/absolute
  expiry and audit evidence. CI is extended only with exact-head P2 backend
  checks; P1 browser acceptance remains unchanged. The first hosted push run
  `30187900426` failed before the P2 campaign because the workflow exported
  `IDENTITY_DATABASE_URL` before provisioning and the preceding P1 unit
  command therefore discovered the P2 integration suite. The classified CI
  ordering/scope fix localizes that URL to the dedicated P2 campaign; a
  replacement exact-head run is required. Replacement PR run `30188080211`
  confirmed 32 aggregate units passed with all five database cases skipped,
  then exposed that the cumulative P1 runtime launcher neither configured nor
  started the newly required Identity readiness dependency. This second CI
  orchestration defect is fixed by provisioning and running the real built
  Identity service with masked ephemeral keys only around P1 runtime
  acceptance, while keeping its database URL unset during aggregate unit
  discovery. Another exact-head run is required.
- Conflicts/risks: Stitch MCP inventory was empty at
  `2026-07-26T02:09:54.193Z` and again after 180 seconds at
  `2026-07-26T02:13:03.970Z`. No credential, locator, signed URL, remote ID or
  generated Stitch source was inspected or persisted. Local Node 24.14 is
  outside the pinned Node 22 range, so hosted Node 22 remains decisive.
- Design: `docs/design/reviews/P2_S1_LOCAL_WIREFRAME.md` is a semantic local
  wireframe and frozen backend handoff input only. It is not production UI or
  a Stitch approval.
- Decision/change references: issue #6, `CHG-2026-010`, ADR-018,
  `MCP-DEBT-2026-002`, KI-017
- Follow-up: restore the approved Stitch MCP/secret path, perform the bounded
  synthetic reference session plus schema/data-egress/security/accessibility
  review, freeze the redacted `LB-001`–`LB-007` handoff, then implement the UI
  and run exactly one `pnpm.cmd run validate:p2-s1`. Do not start P2-S2 or
  DATA-S1.

## INT-2026-013 — Accept the future Node/Spring Community contract boundary

- Date: 2026-07-26
- Status: Accepted governance direction; implementation deferred
- Source: project-owner change request recorded on the active P2-S1 branch
- Target: P5-S1/issue #15 for implementation; P6 for cumulative proof
- Scope: Community becomes the first Spring Boot service at P5-S1 and remains
  the same bounded service through P5-S2/P5-S3; no current Node service rewrite
- Contracts/data affected: planned Node Gateway ↔ Spring Community versioned
  OpenAPI/JSON Schema with provider/consumer tests; Community-owned PostgreSQL
  role/database/migrations/outbox/audit; Identity & Consent remains authority
  and supplies only minimum authorized context
- Validation: documentation format/config/docs/secrets/diff and exact-head
  hosted CI now. Official JDK/Spring Boot/Maven/plugin/checksum and
  repository-owned Windows wrapper research is deferred to the P5 gate and
  must precede Java files. P6 must validate mixed-version compatibility,
  independent artifact/upgrade, dependency isolation, health/readiness,
  observability, SBOM/supply-chain, containers and rollback.
- Conflicts/risks: no Java source, wrapper, toolchain or container exists yet.
  PostgreSQL search is the accepted start; Elasticsearch, Redis, broker, object
  storage or a new engine requires measured evidence and a later ADR. P2
  scope/order and `MCP-DEBT-2026-002` remain unchanged.
- Decision/change references: `CHG-2026-011`, ADR-019, issue #15
- Follow-up: do not start P5 here. When P5-S1 is eligible, run its
  official-source research gate, pin the exact supported toolchain/wrapper and
  freeze the language-neutral provider/consumer contract before code.

## INT-2026-014 — Activate the official Stitch namespace for the P2 handoff gate

- Date: 2026-07-26
- Status: Validated, merged and closed
- Source: project-owner-authorized local Stitch activation on the existing
  `phase/2-account-access-onboarding` task
- Target: P2-S1 `LB-001`–`LB-007` design gate only
- Scope: enable the repository-scoped official Stitch MCP stanza while
  retaining environment-backed authentication, prompt approvals,
  `required = false`, and secret-free tracked configuration
- Validation: the read-only direct MCP canary returned HTTP
  200 for initialization and tool discovery, negotiated protocol `2025-06-18`,
  and exposed 15 project/screen/design-system tools without project mutation.
  The task then classified all 15 schemas, reused the single safe-display-name
  LifeBridge project and completed exactly seven additive synthetic generations.
  No secret, locator, signed URL or generated source was persisted.
- Conflicts/risks: Stitch references remain untrusted input. P2 browser
  artifacts are disabled; manual assistive-technology evidence remains honest.
- Decision/change references: issue #6, `MCP-DEBT-2026-002`, KI-017
- Validation: the single `pnpm.cmd run validate:p2-s1` passed P1 regression,
  Identity PostgreSQL 5/5, aggregate unit 37/37, contracts 6/6, P2 browser 4/4,
  format/lint/type/build/docs/config/secrets/audit/diff and exact cleanup.
- Promotion: exact-head commit `969e6e9`, PR run `30191477589` and push run
  `30191476390` passed. PR #44 merged to `dev` as merge commit `0cb14e2`;
  post-merge run `30191620201` passed and issue #6 closed.
- Follow-up: start P2-S2 only in a fresh task from integrated `dev`; P5 remains
  planned and was not started here.

## INT-2026-015 — P2-S2 integration and Stitch UI resolution

- Date: 2026-07-26
- Status: Validated, merged and closed
- Source: `phase/2-household-authorization` from verified
  `dev@7e260c0315bb08a4f07b37c7604d416d999cb3e9`
- Scope: Identity-owned household/membership/invitation/minimum-context
  contracts, PostgreSQL migration, Gateway boundary, audit/logging, Frozen
  LB-008–LB-010 handoff, native VI/EN UI and cumulative acceptance tooling
- Ownership: no cross-service SQL/credentials and no new service/engine/ADR
- Validation: targeted server/contracts/validator 35/35, PostgreSQL lifecycle
  7/7, mocked browser 6/6, real built web-to-Gateway-to-Identity-to-PostgreSQL
  browser 1/1, and the single cumulative local Level C campaign pass. Final
  campaign evidence includes aggregate unit 46/46, contracts 8/8, P2-S2
  PostgreSQL 7/7, P1 browser 4/4, real-plus-mocked P2-S2 browser 7/7, P2-S1
  browser 4/4, production build, docs/config/secrets/dependency/diff checks and
  exact task-owned cleanup.
- Gate: local design/acceptance and hosted promotion portions of
  `MCP-DEBT-2026-003` are resolved. Deployment remains separately blocked by
  KI-001 and manual assistive-technology evidence remains KI-016.
- Promotion: initial candidate `d74faf2` exposed one pull-request-run LB-008
  locale race while the parallel push run passed. Targeted fix head
  `af6a75f4fcf54a70b2185a903f4bcb330e837b31` then passed exact-head runs
  `30202003327` and `30202004747`. PR #47 merged to `dev` as
  `82a8c833ec15e01dacecbcde7285d5a63a307bbd`; post-merge run
  `30202144955` passed. Issue #7 closed completed with canonical closeout
  evidence at
  https://github.com/toannnnq1424/life-bridge/issues/7#issuecomment-5083484971.
- Follow-up: P2-S3 is the exact next product slice only after this docs-only
  canonical closeout and controller dispatch. Its first action is to freeze
  versioned consent grant/narrow/revoke and audit-history read contracts for
  LB-028–LB-031, explicitly separating care-recipient consent from organizer
  membership. No P2-S3 work started here.

### User-authorized Stitch approval policy

The repository-scoped `.codex/config.toml` changes only
`default_tools_approval_mode` from `prompt` to `approve`, matching the
controller-level authorization for all Stitch tools in future trusted
LifeBridge worktrees. No credential, header, endpoint, tool allow/deny list,
sandbox, network or OS setting changed.

After reset, authenticated project reads passed. The first authorized
synthetic LB-008 generation then exceeded the 60-second MCP call timeout; ten
30-second read-only screen reconciliations found no new artifact. The write was
not retried and LB-009/LB-010 were not issued. `MCP-DEBT-2026-003` now tracks a
generation-capable MCP timeout/session rather than authentication.

Controller diagnosis confirmed the repository override was the active
60-second limit. User-authorized project policy now sets only
`tool_timeout_sec = 600`, and the direct validator freezes that bounded
generation window. No credential, endpoint, header, allow/deny list,
sandbox/network or other server changed. The still-loaded runtime was not
retried; one MCP restart is required before an absence check and any new write.

After that restart, one read-only screen reconciliation confirmed LB-008 was
absent. Exactly one bounded LB-008 retry and one LB-009/LB-010 generation
succeeded in the existing project. Independent review rejected generated
partial-save/offline queueing, account-existence disclosure, membership-removal
scope, clinical/legal/consent content and generated source. The redacted Frozen
handoff records aliases only; no credential, locator, remote ID, signed URL or
generated source is persisted.

Native routes are `/households/new`, `/households/{id}/invitations`,
`/invitations`, and `/households/{id}/recipient-context`. The runtime path
proves two verified accounts, bounded invite acceptance and authorized context
view through the built web, Gateway, Identity and service-owned PostgreSQL.

The single `pnpm.cmd run validate:p2-s2` invocation was interrupted after its
P1 build by a cumulative fixture-readiness defect: Gateway correctly required
Identity in normal mode but the safe loopback P1 fixture campaign does not run
Identity. A targeted Level B made readiness skip that dependency only when the
existing fixture-safe guard is active and passed Gateway format/lint/type plus
13/13 unit tests. Per the one-campaign guard, already-green P1 checks were not
repeated; P1 browser and every remaining P2-S2 phase were resumed at the
smallest missing boundary and passed. One wrapper-only PowerShell parameter
collision was classified without product edits before the runtime-only resume.
The host interruption and wrapper collision were environment/orchestration
failures, not product failures.

## INT-2026-016 — P2-S3 consent, privacy and redacted audit candidate

- Date: 2026-07-26
- Status: Integrated; exact-head and post-merge hosted validation passed
- Source: `phase/2-consent-privacy-audit` from verified
  `dev@22157b10a9cdd479d7bb0a439a74fc18dccfaf67`
- Scope: `P2-S3-v1` subject establishment, grant/strict-narrow/revoke,
  governed recipient-context reads, atomic privacy preferences, redacted
  bounded audit history, migration 003, Gateway routes, native
  LB-028–LB-031 VI/EN UI and cumulative validation tooling
- Ownership: Identity & Consent and its PostgreSQL database remain sole owner;
  no service, engine, cross-service SQL, shared-table write, broker,
  credential coupling or generated Stitch source was introduced
- Contract: organizer/member status is not consent authority. Only the
  eligible context creator may explicitly self-bind as subject; the subject
  owns consent mutation and audit authority. Exact-scope governed reads are
  evaluated at a server UTC instant; revoke denies at its effective boundary.
  Commands are optimistic-versioned, digest-idempotent, row-locked and atomic.
- Privacy/audit: retained transition and audit rows are redacted, scoped to the
  subject, bounded to 90 days and keyset-paginated without totals. Sealed
  cursors bind viewer, subject and filter. Logs/metrics/traces expose only
  allow-listed operation/result/correlation/duration fields.
- Design: four synthetic references were created exactly once in the existing
  project. The Frozen redacted handoff rejects placeholder timestamps,
  non-IANA `ICT`, offline queueing, hidden totals, missing confirmations and
  generated source. Independent private-render inspection was unavailable, so
  KI-019 blocks claims that the generated visuals alone were approved; native
  automated evidence is mandatory.
- Validation: the single cumulative command passed P1 browser 4/4, affected
  unit 54/54, contracts 12/12, Identity PostgreSQL 9/9, transactional
  migration rollback/reapply, production build, real-plus-mocked P2-S3 browser
  8/8, P2-S2 browser 6/6, docs/config/secrets/dependency checks and exact
  Compose/process cleanup. It then stopped on a P2-S1 strict locator after the
  truthful preference-status correction. Targeted Level B traced and removed
  a stale pre-factor announcement; affected format/lint, production web build
  and P2-S1 browser 5/5 passed. No second Level C command was issued. Hosted
  exact-head CI must run the coherent script from scratch; its runtime
  sensitive-log scan now runs immediately after P2-S3 browser evidence.
- Hosted deviation: push run `30208198696` passed static/security and all
  P2-S3 browser checks 8/8, then failed when Linux PowerShell represented an
  empty runtime log as `$null`. The scanner now normalizes null raw content to
  an empty string before prohibited-value matching. This is tooling-only;
  contracts, migrations and runtime behavior are unchanged. Targeted
  parser/scan checks passed, followed by replacement push run `30208540352`
  and PR run `30208541672`. Rewriting the pushed feature commit was prohibited,
  so the recovery is a second small conventional commit rather than a
  force-push.
- Decision/change references: issue #8, `CHG-2026-012`, ADR-020,
  `docs/security/P2_S3_THREAT_MODEL.md`, KI-019
- Promotion: feature commit `f0ba524` plus portability recovery `cd7f0a8`
  passed replacement exact-head push/PR runs `30208540352`/`30208541672`.
  PR #49 merged into `dev` as
  `bca04d1aff000abcedeed939dbfc9d7186cf1966`; post-merge run `30208723836`
  passed; issue #8 closed completed with bilingual evidence.
- Follow-up: P3-S1 is exact next. It begins with an authorized,
  time-zone-explicit timeline projection and versioned handoff command against
  the accepted P2 governed-read boundary. No P3, DATA, P5, deployment or
  release work starts here.

## INT-2026-017 — P3-S1 daily timeline and accountable handoff

- Date: 2026-07-26
- Promotion date: 2026-07-27
- Status: Integrated; exact-head and post-merge hosted validation passed;
  issue #9 closed
- Source: `phase/3-daily-timeline-handoff` from verified
  `dev@cd58229794e6e8bf562a49879de494515c262db5`
- Owning work: GitHub issue #9 (`GH-008`)
- Scope: `P3-S1-v1` fresh coordination authority decision, bounded daily
  timeline, handoff review/command/result, `care.task.handed_off.v1`, Care
  migration 002, Gateway/native VI/EN LB-012 and LB-014 extension,
  Notification consumption and cumulative validation tooling
- Ownership: Identity & Consent alone evaluates current P2 governed access.
  Gateway composes without fabrication. Care Coordination alone writes task,
  handoff, timeline, audit, outbox and idempotency rows in its PostgreSQL
  database. Notification owns only its inbox/store. No new service, engine,
  shared table, cross-service SQL or credential coupling exists.
- Contract: decisions bind permission, household, request digest, correlation,
  current subject/grant/privacy versions and a short server time. Care also
  checks recipient, assignee, open state, expected version and target. UTC
  occurrence plus event reference is stable order; IANA local-day bounds,
  snapshot sequence and sealed keyset cursor cover DST, clock skew and
  continuation with no total.
- Mutation/evidence: handoff accepts one enumerated reason and immediate
  server-time semantics. Idempotency is digest-only; one transaction updates
  assignment/version and writes handoff, timeline, audit, outbox and replay
  response. UI confirms only returned durable state and labels notification
  separately. Offline mutation is blocked/no-queue; uncertain result requires
  current-state check.
- Privacy: task title exists only in the authorized Care read model. It and any
  free-form content are absent from handoff command/event/audit/outbox/
  Notification/telemetry. Pages expose no total or hidden count. Migration
  starts an honest coverage boundary and backfills no history.
- Design: the existing private LifeBridge project/design system was inspected.
  Four synthetic desktop/mobile LB-012/LB-014 references were generated once
  and read back individually; no credential, locator, remote ID, URL or
  generated source was persisted. The Frozen redacted handoff rejects
  placeholder times/zones, medical claims, free text, totals, false success
  and offline queueing. KI-019 retains unavailable independent pixel review.
- Planned versus actual: `CHG-2026-013` adds fresh decision binding, snapshot
  chronology, no-total inference controls, explicit no-backfill and structured
  context that the baseline left open. Reason is convergence of three audits
  and the bounded official-source research cycle. Impact is P3-S1 only; phase
  order, runtime boundaries and non-clinical scope are unchanged.
- Validation: the single `pnpm.cmd run validate:p3-s1` invocation stopped at
  its first formatting gate. Targeted recovery, without a second Level C,
  completed affected lint/type, unit 52/52, contracts 16/16, P1 PostgreSQL
  6/6, P3 Identity/Care PostgreSQL 14/14, migration rollback/reapply/
  no-backfill, all builds, P1 browser 4/4, P3 mocked 6/6 plus real 1/1, and P2
  mocked regressions 18/18. Docs/config/secrets/dependencies, privacy-safe
  runtime logs and exact cleanup passed. Recovery corrected clean-host owner
  provisioning/reset, focus and VI/EN selectors, and a real Gateway
  correlation re-resolution defect; the no-header boundary passes 19/19.
  Exact feature head `909c64542ccd4f3db6951e737dd83ef393cdf701`
  passed push run `30216046313` and PR run `30216124915`. PR #51 merged through
  a merge commit as `dev@2314ee99eec61ffa1532fead4e5bda3bc6bbae63`;
  post-merge run `30216314035` passed all three gates and bilingual issue #9
  closeout was posted before the issue closed completed.
- Promotion transport deviation: planned GitHub App PR/issue/check operations
  could not see the private repository and returned `404`; `gh` was absent.
  The already-authorized signed-in GitHub browser session created ready PR
  #51, verified exact SHA/run state, merged with the checked merge-commit
  method and closed issue #9. Impact was transport-only: no source, contract,
  validation, credential or branch-topology change. Direct PR/run/commit/issue
  evidence validates the fallback; KI-006 retains the optional-tool limitation
  and no Change ID is required.
- Decision/change references: issue #9, `CHG-2026-013`, ADR-021,
  `docs/security/P3_S1_THREAT_MODEL.md`, KI-001/KI-016/KI-019
- Follow-up: actual code/contracts/tests confirm P3-S2 as exact next. A fresh
  task must freeze its own appointment/calendar semantics against the accepted
  P3-S1 time contract. P3-S2, P3-S3, DATA, P5, deployment and release are not
  started here.

## INT-2026-018 — P3-S2 calendar and appointment coordination

- Date: 2026-07-27
- Status: Integrated; exact-head and post-merge hosted validation passed
- Source: `phase/3-calendar-appointment` from verified
  `dev@83bfe45006241d160db7359eb61fafc4286de58b`
- Owning work: GitHub issue #10
- Scope: `P3-S2-v1` fresh action authority, calendar/detail projections,
  finite structured create/change/cancel commands,
  `care.appointment.reminder_intent.v1`, Care migration 003, Notification
  migration 002, Gateway/native VI/EN LB-015/LB-016 and cumulative validation
  tooling
- Ownership: Identity & Consent evaluates the current accepted P2 governed
  boundary for each action. Gateway composes only. Care owns appointment,
  transition, audit, idempotency and outbox state in its PostgreSQL database.
  Notification owns only inbox and structured reminder-intent receipt. There
  is no new service, engine, shared table, cross-service SQL, credential or
  direct import.
- Contract/time: canonical millisecond `Z`, source local minute, numeric offset
  and IANA zone are explicit. Care rejects DST gaps, requires explicit
  earlier/later overlap policy plus matching first offset, preserves weekly
  wall time, materializes at most 12 occurrences and supports only
  occurrence-only mutation. Conflicts are half-open, serialized per recipient
  context and ordered by UTC/opaque ID.
- Mutation/evidence: one Care transaction writes durable occurrence state,
  immutable transition, privacy-minimized audit, digest-only idempotency and
  minimum reminder outbox intent. Stale/state/time conflicts preserve unsent
  intent and require fresh review. Cancellation remains visible history.
  Notification acknowledges schedule/cancel intent without claiming delivery.
- UI/design: four private synthetic LB-015/LB-016 references were generated and
  read back once; no locator, remote ID, signed URL or generated source was
  persisted. The independent reviewer could not inspect private pixels, so
  `KI-019` remains and no visual conformance is claimed. Native UI provides a
  complete semantic agenda, calendar enhancement, explicit time/recurrence/
  reminder facts, VI/EN, keyboard/focus, 320 px reflow, axe, denied,
  unavailable, offline, stale, conflict, cancellation and recovery states.
- Planned versus actual: `CHG-2026-014` planned one Level C after coherent
  implementation. The single wrapper invocation continued after the desktop
  shell detached, then exited with its output unavailable. Visible targeted
  continuation retained classified green gates rather than issuing a second
  full campaign. It found and fixed one legacy migration-reapply default,
  browser locator ambiguity and two native recovery-state defects. Initial
  hosted push run `30220557513` then passed P3-S2 itself but exposed a real
  cumulative P2-S3 alert-focus race. The host `systemError` preserved the
  smallest shared fix uncommitted; recovery verified worktree/index/remote/PR
  state before continuing. A render-committed announcement sequence replaced
  the racing animation-frame focus, and only the failed P2-S3 conflict/focus
  path plus affected static scope were validated. Product scope, contracts,
  data ownership, service boundaries and phase order did not change.
- Validation: four format scopes; lint/type; unit 55 passed with 19
  environment-skipped; contracts 19/19; P1 PostgreSQL 6/6; P3-S1
  Identity/Care PostgreSQL 14/14; P3-S2 Care/Notification PostgreSQL 5/5;
  P3-S1 and P3-S2 rollback/reapply/no-backfill scripts; dependency/docs/
  config/secrets; all builds; retained P3-S2 mocked 6/6 plus real 1/1;
  cumulative P3-S1 mocked 6/6 and P2 mocked 18/18; privacy-safe runtime logs,
  `git diff --check` and exact PID-scoped cleanup.
- Promotion: feature commit
  `f37077fa90cf3740a004a617839dd447fb9b91df` plus cumulative accessibility
  fix `e21334c2631f3617d79d827480be4563c34b31a2` passed exact-head push run
  `30230392943` and pull-request run `30230394014`. Ready PR #53 merged through
  a merge commit as `dev@142096516533aea7561b1b13a2187047dc726a71`;
  post-merge run `30230627085` passed all required jobs. Issue #10 closed
  completed with bilingual evidence at
  https://github.com/toannnnq1424/life-bridge/issues/10#issuecomment-5086517596.
- Decision/change references: issue #10, `CHG-2026-014`, ADR-022,
  `docs/security/P3_S2_THREAT_MODEL.md`, KI-001/KI-016/KI-019
- Follow-up: after this docs-only canonical closeout merges, P3-S3 is exact
  next only in a fresh task. Its first action is to freeze versioned care-plan
  review authority, command/read/event and time semantics against the accepted
  P2 authority and P3-S2 appointment boundary. This task does not begin it.

## INT-2026-019 — P3-S3 versioned support-plan review acceptance

- Date: 2026-07-27–28
- Source: `phase/3-care-plan-review` from verified clean
  `origin/dev@875ffc61b33f9eec250689fb3f8ce6ec8fd9d811`
- Canonical issue: #11 verified open with matching bilingual scope; no duplicate
  branch, task, issue, or open PR existed before mutation.
- Scope: `P3-S3-v1`, ADR-023/`CHG-2026-015`, Care migration 004 and one shared
  draft/current aggregate, fresh Identity decisions, Gateway composition,
  immutable confirmed history, content-free suppressed event, native LB-017,
  and cumulative test/CI wiring.
- Independent reviews: contract/data/authority/time/threat, Stitch
  privacy/accessibility, and test/CI/operations completed independently and
  were reconciled before code. Four synthetic private references were generated
  and read back once; independent pixels remained unavailable, so KI-019 and the
  corrected native-only handoff remain.
- Planned versus actual: the planned private-pixel approval was unavailable;
  generated source remained rejected and stricter native requirements govern.
  A first mocked browser pass found only a duplicate-text locator; the failed
  scenario and two not-yet-run scenarios passed classified targeted recovery.
- Level C actual: the one `pnpm.cmd run validate:p3-s3` invocation stopped before
  a gate while Docker's Linux engine was unavailable. Direct classified
  continuations then retained green results and recovered only unproven or
  dependency-affected gates. Final evidence is format 5/5, unit 57/57,
  contracts 24/24, P1/P3-S1/P3-S2/P3-S3 integration 6/6 + 14/14 + 5/5 + 2/2,
  cumulative P3 migrations, mocked LB-017 3/3, real P3-S3 browser 1/1, and
  cumulative mocked browser P3-S2 5/5 + P3-S1 6/6 + P2-S3 7/7 + P2-S2 6/6 +
  P2-S1 5/5. Lint/type/docs/config/secrets/audit/build/diff/log-scan and cleanup
  also passed. No second Level C command was issued.
- Final review correction: draft reads now redact a newly ineligible responsible
  actor as `authorization_changed` and block confirmation until an eligible
  replacement is saved. Affected formatter/lint, contracts 24/24, Gateway unit
  21/21, typecheck, Care/web builds, P3-S3 integration 2/2, real browser 1/1 and
  mocked LB-017 3/3 passed; cumulative migrations and older browsers were
  retained and not rerun.
- Promotion: feature `9bfd2263625e25e2f4c3bbf7b1d0257a002591c8` passed exact-head
  push/PR runs `30329456918`/`30329530973`; ready PR #56 merged by merge commit
  as `dev@f3576f40779617f0d7bd519ac44b178ccf269e3e`; post-merge run
  `30329752886` passed all three jobs. Issue #11 closed with bilingual evidence.
  Only the same-branch docs-only canonical closeout remains.
- Non-goals preserved: no DATA-S1, P4/P5, Spring, deployment, release, new
  service/engine, cross-service SQL, clinical advice, reminder delivery, real
  care record, or canary mutation.
- Follow-up: after docs-only closeout, P4-S1 is exact next only in a fresh task;
  freeze non-clinical reminder authority, unit/time-zone, event, Notification
  and failure truth before implementation.

## INT-2026-020 — P4-S1 medication reminder

- Date: 2026-07-28
- Status: Integrated; hosted validation passed
- Source: `phase/4-medication-reminder-acknowledgement` from accepted
  `dev@aaf6113540925b3132a323afc6e1922a902a3e29`
- Target: `dev`
- Scope: P4-S1 only; LB-018 plus minimum LB-019
- Contracts/data affected: frozen `P4-S1-v1`; fresh six-permission Identity
  decisions; Care-owned exact schedule/migration 005; minimum-data intent;
  Notification-owned delivery/seen/migration 003; Gateway composition only
- Validation: independent three-review freeze, four one-time synthetic Stitch
  read-backs, Frozen native-only handoff, 65 unit and 40 contract tests, all
  cumulative static/build/security gates, 8 P4 PostgreSQL integration tests,
  owner-isolated rollback/reapply/no-backfill and cumulative integrations
  passed in the single Level C. That invocation stopped at Notification
  readiness because startup replayed migration 002 over valid P4 inbox rows.
  A version-aware migration-runner fix then passed targeted P4 integration,
  runtime readiness, 4/4 P4 browser paths and all cumulative P2/P3 browser
  suites; log scan, diff and cleanup passed.
- Hosted promotion: initial exact-head push run `30342664176` passed all three
  jobs.
  PR run `30342757032` exposed a commit-timing race in the LB-019 duplicate
  status focus while the same rendered state passed on push. Focus now follows
  committed React state; lint/type/build and five repeated affected
  browser/accessibility paths passed. Replacement exact-head push/PR runs
  `30343304775`/`30343308183` passed on
  `9a2b7fe9683f548a006c63fc673d294aedd39031`. PR #59 merged into `dev` as
  `d58660cebd91f46b2deab38a38e7187ec7870804`; post-merge run `30343682227`
  passed all three jobs. Issue #12 closed completed with bilingual evidence.
- Conflicts/risks: KI-001/KI-016/KI-019 remain; project-list metadata lag and
  private pixels are not visual approval; no blind Stitch retry
- Decision/change references: ADR-024 / `CHG-2026-016`
- Follow-up: merge only this same-task docs-only canonical closeout. P4-S2 may
  start only in a fresh task and must first freeze purpose-specific authority,
  ordered-contact, reviewed-plan, offline-copy freshness and minimum-disclosure
  contracts. Do not invoke another local Level C or start P4-S2 here.

## 2026-07-28 — P4-S2 emergency readiness

- Scope/change: `P4-S2` / `CHG-2026-017`.
- Status: Integrated; exact-head and post-merge hosted validation passed;
  issue #13 closed completed.
- Base/branch: verified live
  `dev@f0b9163058c57a30f14f6eebd022c0a5ba98264e` to
  `phase/4-emergency-contacts-offline-plan`; canonical issue #13 was verified
  before mutation and no duplicate branch/task/PR existed.
- Contract: `P4-S2-v1` and `P4-S2-offline-v1`; Care owns the aggregate and
  migration 006. Identity issues fresh exact-purpose decisions and Gateway
  forwards only authoritative Care results. Notification is uninvolved.
- Design/security: three independent reviews, ADR-025, the P4-S2 threat model,
  four bounded synthetic Stitch references with one direct read-back each,
  and the Frozen redacted native-only handoff precede UI implementation.
- Delivered paths: LB-020 ordered contacts, LB-021 reviewed plan and only the
  required read-only LB-032 encrypted offline behavior. The service worker is
  limited to the three exact shell assets and emergency-plan navigation;
  online APIs are `no-store`; offline mutations are blocked and never queued.
- Validation: exactly one local `validate:p4-s2` campaign ran.
  Static/unit/contract/docs/config/secrets/audit/build and cumulative
  integrations through P4-S1 passed before the P4-S2 Care suite exposed an
  explicit timestamptz binding defect and PostgreSQL-integer history
  sentinel. Classified targeted recovery—not a second Level C—proved the
  corrected Care 6/6 suite, migration 006 rollback/reapply/no-backfill, the
  real production-runtime/offline/purge journey, three mocked P4-S2 paths and
  all cumulative P2–P4-S1 browser regressions.
- Promotion: feature commit `1b28a16` passed push run `30356925555`. PR run
  `30357031265` then exposed a test-only no-op ciphertext mutation;
  deterministic recovery `ea5acf7` passed exact-head PR run `30358335589`.
  PR #62 merged as `dev@7690a7c584891fbd2bd62de600a5b11bb58a8be7`;
  post-merge run `30359250442` passed all three jobs. Issue #13 received
  bilingual evidence and closed completed.
- Deferred: no P4-S3, DATA-S1, P5, Spring, deployment, release, new service or
  new persistence engine. KI-001/KI-016/KI-019 remain.
- Follow-up: P4-S3 may start only in a fresh task. Freeze document authority,
  minimum disclosure, retention/deletion, integrity and storage ownership
  before implementing LB-023.

## INT-2026-022 — P4-S3 document vault

- Date: 2026-07-28
- Status: integrated; exact-head and post-merge hosted validation passed;
  issue #14 closed completed
- Source: verified clean `phase/4-document-vault` from accepted live
  `dev@1010aeabf7ae87737019477cb1961404299bf0a8`
- Target: `dev`
- Canonical issue: #14 was verified as the existing P4-S3 issue; no duplicate
  task, branch, issue or PR existed before mutation.
- Contract/authority: frozen `P4-S3-v1` adds only
  `document_vault.access`. Gateway requests a fresh request-bound P2 decision
  for every list, upload, metadata, download and delete; household role,
  offline state and browser-local state grant no document authority.
- Ownership/data: Care owns bounded metadata and strict UTF-8 `.txt` bytes in
  owner-local PostgreSQL migration 007, plus audit, outbox, tombstone,
  idempotency and optimistic concurrency. Identity owns only scope/grant
  decision state under migration 004. Gateway stores and fabricates nothing.
- Processing/security: accepted content remains truthfully
  `ready_unscanned`/`not_configured`/`not_scanned`; no clean or safe claim is
  made. Digest/object binding is checked before attachment-only octet-stream
  retrieval. Delete atomically purges active bytes/metadata and invalidates
  the original upload replay so an old key cannot resurrect content.
- Design: four exact synthetic LB-023 states were created once and read back
  once. The independent reviewer could not inspect private pixels, so KI-019
  remains. Generated source was rejected; the Frozen redacted native-only
  handoff governs VI/EN implementation, keyboard file input, progress,
  recovery, reflow, forced-colors and reduced-motion behavior.
- Planned versus actual: the accepted baseline allowed an object store or
  scanner only after research and ADR acceptance. Bounded P4-S3 needs neither,
  so ADR-026 retains PostgreSQL ownership and explicitly unscanned truth.
  KI-020 records the deployment gate for production storage encryption,
  historical-backup retirement, deletion reconciliation, scanner/stale
  processing controls and RPO/RTO.
- Local validation: exactly one `pnpm.cmd run validate:p4-s3` campaign ran and
  passed without recovery: all cumulative format/lint/type/unit/contract/docs/
  config/secrets/audit/build gates; P1 through P4-S3 integrations; P3/P4
  migration checks; P4-S3 rollback/reapply/no-backfill; owner-local pre-delete
  restore and post-delete non-resurrection; real Web→Gateway→Identity→Care→
  PostgreSQL Chromium path 1/1; mocked LB-023 3/3; and all cumulative P2–P4-S2
  browser regressions. The PID-scoped container, volume and network were
  removed.
- Non-goals: no object store, scanner service/engine, crypto scheme, cache,
  new service, cross-service SQL/import/credential, real document, P5,
  DATA-S1, Spring, deployment or release.
- Decision/change references: issue #14, `CHG-2026-018`, ADR-026,
  `docs/security/P4_S3_THREAT_MODEL.md`, KI-001/KI-016/KI-019/KI-020.
- Promotion: feature commit
  `3eb4bab7751a5e311a285adac17b999994f72c99` passed exact-head push/PR
  runs `30375655611`/`30375846902`, each with all three jobs green. Sole ready
  feature PR #64 merged by merge commit as
  `dev@7b10d62d0cd1857e9d63e57d34bfd068040a8fd6`; post-merge run
  `30376359437` passed all three jobs. Canonical issue #14 received verified
  VI/EN evidence at comment `5106678490` and closed as completed.
- Follow-up: merge only this same-task docs-only canonical closeout. P5-S1 may
  start only in a fresh task with official toolchain research and frozen
  Community authority/data/API/event/failure boundaries. Do not start it here.
