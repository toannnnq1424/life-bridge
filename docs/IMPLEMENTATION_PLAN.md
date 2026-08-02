# LifeBridge Implementation Plan

## Plan control

- Active plan ID: `PLAN-2026-07-26-PRODUCTION`
- Previous baseline: `PLAN-2026-07-25` (`P0`–`P6` compact roadmap)
- Change authority: `CHG-2026-004`
- Active plan date: 2026-07-26
- P5-S3 status (2026-07-29): accepted through feature PR #70 and narrow
  post-merge race correction PR #71. Canonical integration is
  `origin/dev@39e5914778f779c5e2b4b19bdb6a92fc6fdfbdde`; post-merge run
  `30426581895` passed the complete required gate.
- Current phase: `P5 — Community support`; P5-S3 is accepted.
- Accepted base: `origin/dev@39e5914778f779c5e2b4b19bdb6a92fc6fdfbdde`.
- Accepted predecessor evidence: P5-S1 feature PR #66 and docs closeout PR #67
  are present; post-merge run `30400564523` is green and issue #15 is closed.
- Current action: retain the exact-next handoff only. Do not rerun P5-S3 Level
  C or begin DATA-S1, P6+, deployment, pilot or release in this task.
- GitHub execution:
  completed [P1-S1 #5](https://github.com/toannnnq1424/life-bridge/issues/5);
  P1 design record [#3](https://github.com/toannnnq1424/life-bridge/issues/3);
  separate
  `init/research` task
  [DATA-S1 #4](https://github.com/toannnnq1424/life-bridge/issues/4)
- Latest integration gate:
  [PR #64](https://github.com/toannnnq1424/life-bridge/pull/64) accepted exact
  feature head `3eb4bab7751a5e311a285adac17b999994f72c99` after push/PR runs
  `30375655611`/`30375846902` passed all three jobs. Merge commit
  `7b10d62d0cd1857e9d63e57d34bfd068040a8fd6` is on `dev`, post-merge run
  `30376359437` passed all three jobs, and issue #14 is closed completed with
  bilingual evidence at comment `5106678490`.
- Status source: this document plus `docs/WORKSTREAM_BOARD.md`
- Evidence source: `docs/SESSION_LOG.md`

This plan distinguishes approved intent from delivered reality. Never rewrite a baseline to hide a deviation.

| State       | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| Planned     | Approved future work; no implementation claim               |
| In progress | The current conversation/branch owns it                     |
| Blocked     | Acceptance depends on an explicit external/environment gate |
| Validated   | Acceptance and required validation passed                   |
| Deferred    | Intentionally outside the active scope                      |
| Superseded  | Replaced by an accepted Change ID; history retained         |

## Operating constraints

1. One Codex conversation owns one phase or one vertical slice.
2. Only the first incomplete slice is implemented; the next slice is handed off, not silently started.
3. Product work follows vertical slices across UI, API, service, data, events, error handling, and tests.
4. UI requires a reviewed Google Stitch MCP reference and frozen handoff before production implementation.
5. Windows and the Codex ChatGPT desktop app are the supported environment.
6. The 35-screen inventory is backlog; a screen enters implementation only through a listed/accepted slice.
7. Research covers 2016–2026 and prioritizes 2021–2026 sources.
8. PostgreSQL is the default with separate service ownership. Polyglot storage needs an ADR.
9. Every roadmap deviation records planned versus actual, reason, impact, validation, and follow-up.
10. Every future phase uses a risk-tiered research gate and every slice uses a
    bounded research micro-cycle from `docs/research/RESEARCH_PROTOCOL.md`.

## Roadmap summary

| Phase                                 | Objective                                                                      | Planned slices                                 | Dependencies                               | Actual status |
| ------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------ | ------------- |
| `P0` Foundation                       | Reproducible, governed, secure Windows repository                              | One foundation phase with parallel workstreams | Existing repository and user-approved plan | Validated     |
| `P1` Daily task MVP                   | Prove create/assign/complete/notify/dashboard end to end                       | `P1-S1`                                        | P0 gate; frozen P1 handoff                 | Validated     |
| `P2` Trust and household              | Replace fixture identity with real access, household, consent, and audit flows | `P2-S1`–`P2-S3`                                | P1 contracts and security review           | Validated     |
| `P3` Care planning                    | Add handoff timeline, appointments, and care-plan coordination                 | `P3-S1`–`P3-S3`                                | P2 roles/consent                           | Validated     |
| `P4` Safety and records               | Add reminder, emergency-plan, and document flows without clinical advice       | `P4-S1`–`P4-S3`                                | P2 consent; P3 time model                  | Validated     |
| `P5` Community support                | Add consented help requests, matching, organization, and moderation            | `P5-S1`–`P5-S3`                                | P2 trust/audit; reviewed source evidence   | In progress   |
| `P6` Microservice platform            | Prove independent runtime ownership, versioned compatibility, and isolation    | `P6-S1`–`P6-S3`                                | Accepted P1–P5 service boundaries          | Planned       |
| `P7` Data and event reliability       | Prove migrations, event recovery, backup/restore, retention, and deletion      | `P7-S1`–`P7-S3`                                | P6 contracts and service ownership         | Planned       |
| `P8` Security and privacy hardening   | Prove isolation, privacy lifecycle, abuse controls, secrets, and supply chain  | `P8-S1`–`P8-S3`                                | P2 trust; P6/P7 boundaries                 | Planned       |
| `P9` SLO, resilience, incident and DR | Prove redacted observability, SLOs, degradation, incident response, and DR     | `P9-S1`–`P9-S3`                                | Accepted release journeys                  | Planned       |
| `P10` Performance, capacity, and cost | Prove budgets, scale, backpressure, soak/spike behavior, and cost guardrails   | `P10-S1`–`P10-S3`                              | P9 telemetry and workload model            | Planned       |
| `P11` Production rollout and release  | Reproduce production, stage rollout, pilot safely, rollback, and release       | `P11-S1`–`P11-S3`                              | P6–P10 gates; zero deploy-blocking debt    | Planned       |
| `P12` Post-launch operations          | Operate, patch, recover, learn, and govern the next production roadmap         | `P12-S1`–`P12-S3`                              | Accepted P11 release                       | Planned       |

Future phases are planning commitments only. `CHG-2026-004` preserves validated
P0 and the exact P1–P5 product order, and splits the former overloaded P6 into
production-maturity phases P6–P12. Production concerns are cumulative: every
earlier slice implements the controls applicable to its behavior; later phases
prove them across the accepted release scope. At each phase start, confirm
evidence and log any accepted change before implementation.

## Research-driven runbook overlay

The external 16-phase/85-slice runbook is accepted through `CHG-2026-003` as a
research/risk/decomposition overlay, not as a replacement roadmap. The canonical
crosswalk and rejected conflicts are in `docs/RUNBOOK_ADOPTION.md`.

Every future phase must record:

- `PASS`, `PASS WITH ASSUMPTIONS`, `BLOCKED`, or `NOT APPLICABLE`;
- applicable official/primary and Vietnamese evidence or an explicit evidence
  gap;
- limitations and assumption IDs;
- privacy, safety, accessibility, bilingual, offline, and operational impact;
- acceptance/test changes and any Change ID.

Every future slice begins with at most five decision-driving questions and stops
research when additional sources would not change a decision. The shared risk
catalog is filtered to the slice; generic edge cards are not copied wholesale.

## P0 — Foundation

### Objective

Create a safe, reproducible foundation that a fresh Windows worktree and future Codex conversation can understand, validate, and extend without repository rediscovery or unsafe system changes.

### Scope/workstreams

| ID      | Workstream               | Required output                                                                                                          |
| ------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `P0-W1` | Repository governance    | README, Codex/agent/contribution rules, repository map, product/architecture/plan, decisions, session/known-issue memory |
| `P0-W2` | Windows bootstrap        | Idempotent bootstrap and doctor; Node 22.x/pnpm 11.9.0; `*.cmd` shims; no system Execution Policy change                 |
| `P0-W3` | Quality and CI           | Formatting, lint, type check, unit-test baseline, build, CI, secret scanning, safe logging checks                        |
| `P0-W4` | Research/data governance | Bilingual register/glossary, 2016–2026 evidence policy, provenance matrix, synthetic fixture rules                       |
| `P0-W5` | Design/Stitch governance | Screen backlog, design system/flows, MCP security/approval policy, handoff gate without credentials                      |
| `P0-W6` | Integration readiness    | Workstream board, integration log, branch/promotion model, fresh-worktree materialization                                |

These are foundation workstreams in one Phase 0 conversation, not separate product slices.

### Acceptance criteria

- Repository-specific required documents contain useful current content and cross-links.
- `docs/REPOSITORY_MAP.md` records actual directories, entry points, configs, commands, tests, contracts, and direct dependency direction.
- Bootstrap and doctor run twice idempotently from Windows without modifying machine-wide Execution Policy or requiring Administrator.
- `pnpm.cmd validate:phase0` exercises docs, format, lint, type check, unit baseline, build, and secret checks configured for Phase 0.
- Docker absent/unavailable/unreadable state is classified and reported without system mutation.
- A fresh worktree can materialize dependencies and required generated/local test state using documented commands.
- Git/CI ignore secrets, local environment, MCP credentials, local databases, browser profiles, generated junk, and research microdata.
- Stitch policy stores no credential, rejects unreviewed generated code, and leaves externally gated canary state truthful.
- Research documents enforce the 2016–2026 window, 2021–2026 priority, provenance/license/limitations, and synthetic/de-identified fixture rules.
- Branch flow is documented as `init/research -> data -> dev -> test -> main` and `phase/* -> dev`; `/init` and new `codex/*` branches are prohibited.
- Required Phase 0 validation is classified, passed or explicitly deferred with owner/action.
- Diff is reviewed; unrelated dirty files are preserved; one coherent conventional commit is created.
- Session log names `P1-S1` as the exact next product slice.

### Validation

```powershell
pnpm.cmd bootstrap
pnpm.cmd bootstrap
pnpm.cmd doctor
pnpm.cmd validate:phase0
```

Also inspect Git status/diff, run the configured secret scan, and exercise documented fresh-worktree setup. A Docker-dependent integration test may be deferred only as an environment issue with exact recovery/validation action.

### Deferred from P0

- production application features;
- production authentication;
- domain databases and migrations beyond a minimal tooling proof if needed;
- public deployment;
- Stitch write operations or real design generation before credential/security gates pass;
- claims derived from unreviewed data;
- implementation of any of the 35 screen backlog items.

## P1 — Daily task MVP

### `P1-S1 — Accountable care-task loop`

User-visible outcome: in one synthetic household, an authorized caregiver creates and assigns a care task, the assignee completes it, a persistent notification is produced exactly once, and dashboard/task board show confirmed state.

Status: **Validated and integrated**. PR #42 accepted exact feature head
`6ec1be362ce3512a8eba8b312cbe129f866d0aae` after hosted run `30183168519`
succeeded. Merge commit `cea4f83fe7c0ff79a560e6bc14853a2f7f725133`
is on `dev`, post-merge run `30183280672` succeeded, and issue #5 is closed
completed.

### P1-S1 research micro-cycle

- Gate: **PASS WITH ASSUMPTIONS**
- Timebox: one bounded repository/issue review before contract freeze; no
  competitor research because it would not change this technical slice.
- Questions:
  1. Which confirmed action creates the one useful cross-user notification,
     and who receives it?
  2. Which service owns pending, failed, and delivered notification truth?
  3. What idempotency and optimistic-concurrency results are safe to retry?
  4. What local-only identity, authorization, time-zone, and persistence
     boundaries are required?
  5. Which VI/EN, keyboard, focus, reflow, and failure states must be proven?
- Sources/evidence: GitHub issue #5; `docs/PRODUCT_SPEC.md`;
  `docs/API_CONTRACTS.md`; `docs/DATA_MODEL.md`;
  `docs/design/reviews/P1_S1_STITCH_HANDOFF.md`; registered WCAG 2.2 source
  `DS-15`; current assumption register and shared risk catalog.
- Findings:
  - Issue #5 requires one complete create/assign/complete flow, exactly one
    persistent notification, confirmed UI state, and the listed duplicate,
    conflict, permission, outage, stale-read, time-zone, accessibility, and
    log-redaction risks.
  - The Phase 0 API draft was ambiguous because create and completion events
    could both notify without naming a useful recipient.
  - `CHG-2026-008` freezes the smallest defensible cross-user behavior:
    completion notifies the task creator/coordinator when that actor differs
    from the completing assignee. The deterministic primary fixture uses Lan
    as creator/coordinator and Minh as assignee/completer. A self-completion is
    suppressed and audited rather than sending a notification to the same
    actor.
  - Care Coordination owns completion and outbox delivery intent. Notification
    owns inbox deduplication and stored notification rows. Dashboard/task
    surfaces may show Care-owned pending/failed delivery state; the
    notification center never fabricates an unavailable Notification-owned
    row.
  - Production UI needs no new Stitch call: the reviewed aliases and correction
    list are sufficient once repository-native component, localization,
    state/focus, responsive, privacy, and security requirements are frozen.
- Limitations/assumptions: `ASM-001`, `ASM-002`, and `ASM-006` remain
  unvalidated product/adoption assumptions. P1 proves deterministic technical
  behavior only and makes no adoption, accessibility-conformance, legal, or
  clinical claim.
- Acceptance/test impact: add cross-user audience, self-suppression,
  source-of-truth, duplicate event, restart, time-zone, VI/EN, keyboard/focus,
  320 px/reflow, notification-degraded, and log-redaction tests.
- Re-check trigger: real identity/consent in P2, a Stitch reference change, a
  public pilot, or any change to the notification audience.

Minimum planned surfaces:

- `LB-011` Family dashboard;
- `LB-013` Task board;
- `LB-014` Task detail/create flow;
- applicable `LB-019` Notification state;
- `LB-033`–`LB-035` state patterns used by the slice.

Dependencies:

- P0 validated;
- Stitch MCP activation/canary safe or an accepted gate resolution;
- frozen reviewed handoffs for the listed UI;
- fixture identity explicitly local-only;
- versioned task/event contracts;
- isolated Coordination and Notification stores.

Acceptance criteria:

- create validates permission/input, preserves valid input, and is idempotent;
- task stores owner, assignee, due timestamp/time zone, priority, status, and version;
- dashboard/task board render confirmed task state;
- completion is authorized, version-checked, and safe under duplicate/retry;
- task completion and outbox append are one local transaction;
- Notification deduplicates the versioned event and persists exactly one in-app notification;
- notification outage does not undo completion and is shown as pending/failed, not delivered;
- denied, not-found, validation, conflict, partial-failure, and recovery states work;
- structured logs/audit evidence contain correlation and result, not sensitive descriptions;
- deterministic fixture path works after restart;
- affected unit, contract, integration, browser, accessibility, lint/type and build checks pass;
- docs and session handoff are current; one coherent commit is created.

Frozen implementation footprint before code:

- workspace/config/CI: root package scripts and lockfile,
  `.github/workflows/ci.yml`, local Compose and PowerShell start/migration
  entry points;
- shared contracts/technical primitives: `packages/contracts`,
  `packages/config`, `packages/observability`, and deterministic
  `packages/test-fixtures`;
- runtime boundaries: `apps/web`, `apps/gateway`,
  `services/care-coordination`, and `services/notification`;
- slice validation: focused package tests, PostgreSQL integration tests, and
  one Playwright browser flow using real service contracts;
- persistent memory: affected API/data/architecture/test/security/deployment,
  design handoff, repository map, implementation/workstream/integration/known
  issues/session documents.

Planned validation commands:

```powershell
# Level A after each coherent group; do not rerun unchanged green inputs
pnpm.cmd --filter <affected-workspace> run format:check
pnpm.cmd --filter <affected-workspace> run lint
pnpm.cmd --filter <affected-workspace> run typecheck
pnpm.cmd --filter <affected-workspace> run test

# Exactly one stable-candidate Level C campaign
pnpm.cmd run validate:p1-s1
```

`validate:p1-s1` must cover affected format/lint/type checks, unit and
API/event contract tests, isolated Coordination/Notification PostgreSQL
integration, restart durability, outbox/inbox retry and deduplication,
production builds, VI/EN browser flow, keyboard/focus/accessibility checks,
documentation/configuration/secret/log-redaction checks, and dependency audit.
Hosted CI must run the exact PR head and expose an aggregate required result.

Validation checkpoint: Level C slice validation only. Phase-wide release validation remains deferred.

Campaign record: the first candidate invocation stopped at formatting because
the legacy repository-wide gate included eight unrelated pre-existing Phase 0
files, including the user-owned canary. This was a harness-scope failure; the
P1 gate now enumerates only the frozen slice footprint and passes without
modifying those files. The next invocation reached dependency audit and stopped
on reviewed Sharp/PostCSS high advisories. After the targeted `CHG-2026-009`
graph correction and affected install/audit/build/runtime/browser checks passed,
the changed candidate completed Level C: unit 19/19, contract 4/4, PostgreSQL
5/5, browser 4/4, builds, lint/type/format, docs/config/secrets, and zero-high
dependency audit. Test-owned Compose resources were removed.

Explicitly deferred: recurrence, cancellation, attachments, real authentication, push/SMS/email delivery, automatic escalation, offline mutation queue, public deployment.

#### P1-S1 planned versus actual

- Planned boundaries were implemented without expansion: Next.js web, Fastify
  gateway, Care Coordination, Notification, four small shared packages, two
  owner-isolated databases on one PostgreSQL engine, transactional outbox,
  durable inbox/deduplication, and local HTTP dispatch with bounded retry.
- Planned notification wording was refined by evidence under `CHG-2026-008`:
  create emits no notification; completion notifies the distinct creator
  (Lan in the primary fixture); creator self-completion stores one suppression
  inbox fact and no notification.
- Planned queue/broker infrastructure was not added. The workload and failure
  model do not justify it in P1; the durable database outbox remains the source
  for retry after process restart.
- Planned production UI traces to the six reviewed Stitch aliases through
  handoff v1.0. Generated Stitch code and private locators were not imported.
- Actual dependency review found Next 16.2.11's optional Sharp range cannot
  reach the advisory-patched Sharp 0.35 line. P1 uses local fonts and no
  `next/image`/server image pipeline, so `ignoredOptionalDependencies` removes
  unused Sharp from the install graph while `allowBuilds.sharp: false` remains
  fail-closed. The PostCSS advisory has no patched 8.4 release; a parent-scoped
  `next@16.2.11>postcss` override selects 8.5.18. Frozen install, zero-high
  audit, production build/runtime, and browser 4/4 pass under `CHG-2026-009`.
  A later image pipeline or Next version that natively carries patched
  dependencies must reopen `KI-015` and retire the temporary override where
  possible.
- New evidence does not add, reorder or expand a P1/P2 slice. It confirms
  `P2-S1` remains the exact next slice because real identity replaces the
  explicit local fixture boundary; broader notification audience/preferences
  remain later governed work.

## P2 — Trust and household

### `P2-S1 — Account access and accessible onboarding`

Outcome: a user can register/sign in, complete the required factor/recovery path, choose language/accessibility preferences, and enter an authorized session without account enumeration.

Status: **Validated and merged into `dev`**.
`CHG-2026-010`/ADR-018 freezes a first-party Identity & Consent backend and an
account-scoped session that grants no household access. The Frozen Stitch
handoff, `LB-001`–`LB-007` production UI, full Level C and hosted promotion
evidence passed; `MCP-DEBT-2026-002`/KI-017 is resolved. KI-016 retains the
manual assistive-technology evidence deferred before pilot/release.

Screens: `LB-001`–`LB-007`.

Acceptance:

- secure session lifecycle, rate limits, generic recovery responses, MFA/recovery handling;
- fixture login disabled in public/production configuration;
- accessibility/language preferences persist without gating access;
- denied/locked/expired/offline-safe states and audit evidence are tested;
- threat model, credential/session operations, integration/browser tests, and production build pass.

Dependencies: P1 gateway/config baseline; accepted identity architecture ADR if an external provider is introduced.

Deferred: enterprise SSO and delegated organization administration.

#### P2-S1 research micro-cycle and contract freeze

- Gate: **PASS WITH ASSUMPTIONS** for contracts/backend; **BLOCKED** for
  production UI.
- Questions: authenticator/recovery minimum; session/cookie/CSRF/rotation;
  enumeration/rate limits; credential artifact storage; accessible VI/EN
  authentication and preferences.
- Primary/official sources: NIST SP 800-63B-4 (2025), current OWASP
  Authentication/Forgot Password/Session Management/Password Storage/MFA/CSRF
  Cheat Sheets, W3C WCAG 2.2 Understanding documents, and official Fastify,
  Node.js 22, `@node-rs/argon2`, and `otpauth` documentation. Retrieved
  2026-07-26; details and engineering limitations are recorded in
  `docs/security/P2_S1_THREAT_MODEL.md`.
- Findings: require password plus TOTP; issue one-time saved recovery codes;
  use remaining factor plus one recovery code for recovery; rotate/revoke
  sessions; keep opaque tokens server-side; require synchronizer CSRF token,
  exact Origin and Fetch Metadata; keep generic public login/recovery behavior;
  allow password managers/autofill/paste; never gate access on preferences.
- Assumptions: a non-email login name and saved recovery codes are acceptable
  for this bounded slice; total-loss support recovery and phishing-resistant
  passkeys are not built; no AAL, legal, identity-proofing, or deployment claim.
- Product boundary: new accounts receive account/onboarding authority only.
  Role intent in LB-006 is non-authoritative; P2-S2 owns membership.
- Stitch gate: zero callable tools from `2026-07-26T02:09:54.193Z` through
  `02:13:03.970Z`; fallback/debt is recorded in
  `docs/design/reviews/P2_S1_LOCAL_WIREFRAME.md`.
- Frozen backend footprint: Identity service/migration; contracts, config,
  observability; gateway session boundary; P2 PostgreSQL integration; database,
  reset/start/validation/CI helpers; affected persistent docs. Web/browser files
  enter only after seven handoffs are Frozen.
- Eventual single Level C: `pnpm.cmd run validate:p2-s1`; it includes static,
  unit/contract/integration/browser/build/security/accessibility evidence and
  is not run or claimed while UI is blocked. Backend work uses Level A/B only.
- Stop rule: further sources would not change the frozen backend decision.
  Re-check on Stitch activation, authenticator/provider change, public pilot,
  passkey scope, or changed NIST/OWASP/WCAG guidance.

#### P2-S1 planned versus actual — backend candidate checkpoint

- Planned: implement `LB-001`–`LB-007` and a complete production-oriented
  register/sign-in/factor/recovery/preferences/session journey.
- Actual: external Stitch capability is unavailable, so only contracts,
  security architecture, backend, tests, and truthful local wireframes proceed.
  Production UI, browser acceptance, full Level C, merge-as-complete, and issue
  closure remain blocked rather than being relabeled complete.
- Phase order: unchanged. P2-S2 and DATA-S1 remain outside this task.

### `P2-S2 — Household, invitation, and care-recipient context`

Outcome: an organizer creates a household, invites a collaborator with a bounded role, and establishes a care-recipient profile/context visible only to authorized members.

Screens: `LB-008`–`LB-010`.

Acceptance:

- invitation token lifecycle supports pending, accepted, expired, revoked, resend-limited;
- authorization is household/role scoped and avoids protected-resource disclosure;
- duplicate/retry and concurrent membership changes are safe;
- minimum data is visible; sensitive input is never logged;
- contract/integration/browser/audit/accessibility tests pass.

Dependencies: `P2-S1`.

Deferred: organization federation, legal guardianship adjudication, and bulk import.

Actual, 2026-07-26: the contract and Identity-owned PostgreSQL path are
implemented on `phase/2-household-authorization` under the frozen
`docs/security/P2_S2_THREAT_MODEL.md`. This includes all five invitation states
including decline, digest-only expiry-bound tokens, resend limits,
row-lock/version and idempotency safety, non-disclosing access, minimum
recipient context and redacted audit/log evidence. Official synthetic
LB-008–LB-010 references were independently reviewed and frozen in
`docs/design/reviews/P2_S2_STITCH_HANDOFF.md`; native VI/EN routes implement
atomic offline-blocked household creation, bounded invitation management and
decision, and minimum-context view/edit. Real-browser Gateway-to-PostgreSQL and
targeted concurrency evidence pass. The one P2-S2 Level C campaign now passes
the cumulative P1/P2-S1 regression, affected static/unit/contracts, real
PostgreSQL integration, production build/runtime, artifact-disabled
browser/accessibility/security paths, docs/config/secrets/diff checks and exact
task-owned cleanup. Exact-head hosted CI, merge-commit promotion and post-merge
`dev` CI passed at fix head `af6a75f4fcf54a70b2185a903f4bcb330e837b31`
in runs `30202003327` and `30202004747`. PR #47 merged as
`dev@82a8c833ec15e01dacecbcde7285d5a63a307bbd`; post-merge run
`30202144955` passed and issue #7 closed completed. That accepted boundary is
the base for the active P2-S3 candidate.

### `P2-S3 — Consent, privacy, audit, and settings`

Outcome: an authorized care recipient/account owner can review, grant/narrow/revoke sharing, adjust privacy/settings, and inspect redacted access history.

Screens: `LB-028`–`LB-031`.

Actual contract:

- only the account that explicitly binds itself to an eligible
  care-recipient context may establish consent authority in this slice;
  organizer or household membership alone never grants it;
- grant, strict-subset narrow and revoke commands are versioned, idempotent,
  row-locked and transactional; server UTC instants and validated IANA zones
  replace generated placeholders and the non-IANA `ICT` label;
- governed reads require an active exact-scope grant at the decision instant;
  revocation denies at its committed effective boundary while a minimum
  redacted transition/audit record is retained;
- audit history is read-only, subject-scoped, 90-day bounded, keyset-paginated
  and omits totals; sealed cursors cannot be changed or reused across viewers
  or filters;
- account privacy preferences save atomically. Export, deletion, delegated
  authority and regulatory automation are truthful deferred non-actions.

Implementation remains inside the existing Identity & Consent service and its
owned PostgreSQL database. No service, engine, cross-service SQL, shared-table
write, broker or persistence credential was added.

Acceptance:

- the effect, recipient, data scope, and effective time are shown before a consent change;
- revocation blocks new access and creates audit evidence;
- audit read model is redaction-aware and cannot grant access;
- export/irreversible actions are explicitly bounded or deferred;
- permission, conflict, partial-save, offline-safe, integration/browser/security tests pass.

Dependencies: `P2-S2`; versioned consent/audit events.

Deferred: regulatory export automation and enterprise policy packs.

Planned versus actual: the baseline allowed a care recipient or account owner
but did not define how an account becomes the care recipient. The smallest
proof available from P2-S2 is creator-bound explicit self-establishment; the
candidate therefore rejects organizer-derived and delegated authority. This
narrows rather than broadens access and leaves a future verified delegation
model to its own accepted slice. Generated Stitch output was usable only as
untrusted direction: the Frozen redacted handoff mandates native UTC/IANA,
offline/no-queue, redaction/no-total, confirmation and accessibility
corrections. Visual inspection of private generated renders could not be
independently completed; automated native evidence and KI-019 retain that
limitation.

## P3 — Care planning

### `P3-S1 — Daily timeline and handoff`

Outcome: an authorized household member reviews chronological care work and records a task handoff with accountable actor/time/context.

Screens: `LB-012` plus task detail extension.

Acceptance:

- timeline ordering/time zone and filters are explicit;
- handoff preserves task ownership rules and optimistic concurrency;
- no free-form sensitive content enters notification/log payloads;
- empty/filter-empty/denied/conflict/error and browser/integration tests pass.

Dependencies: P1 task model; P2 roles/consent.

Actual P3-S1 candidate:

- `P3-S1-v1` freezes a permission-scoped daily projection and a versioned
  handoff command/event. Identity issues a fresh P2 purpose/request-digest
  decision; Gateway composes only; Care atomically owns assignment, handoff,
  timeline, audit, outbox and idempotency evidence.
- Server UTC, validated IANA zones, explicit local-day `[start, end)`, stable
  `(occurred_at, event_ref)` ordering, snapshot sequence and sealed keyset
  cursors cover DST, equal timestamps, backward clocks and continuation
  without totals.
- Migration 002 is additive/repeatable with a coverage marker, no historical
  backfill and no cross-service persistence. Handoff accepts an enumerated
  reason only; title/free-form content never enters event, audit, outbox,
  Notification or telemetry payloads.
- Four synthetic Stitch references were generated exactly once for desktop/
  mobile LB-012 and the LB-014 handoff extension. The redacted native handoff
  is Frozen with required corrections. Independent private-render inspection
  remained unavailable, so KI-019 still blocks a visual-conformance claim.
- Planned versus actual deviation `CHG-2026-013`: the baseline did not specify
  fresh decision binding, snapshot sequence, cursor inference controls,
  no-backfill or no-free-form context. Audits and official-source research
  required these narrower controls. Impact is P3-S1 contract/data/UI/test only;
  no service, engine, phase order or clinical scope changed.
- Validation: the single P3-S1 Level C invocation plus classified targeted
  recovery passed the complete affected campaign without rerunning unchanged
  green groups. Exact feature head
  `909c64542ccd4f3db6951e737dd83ef393cdf701` passed hosted push run
  `30216046313` and PR run `30216124915`; PR #51 merged as
  `2314ee99eec61ffa1532fead4e5bda3bc6bbae63`, post-merge `dev` run
  `30216314035` passed, and issue #9 closed completed.
- Follow-up: P3-S2 may reuse the accepted UTC/IANA representation only through
  its own versioned appointment/calendar contract in a fresh task. This task
  does not begin P3-S2, P3-S3, DATA, P5, deployment or release.

### `P3-S2 — Calendar and appointment coordination`

Outcome: an authorized member creates/updates an appointment and sees it in an accessible calendar and equivalent agenda.

Screens: `LB-015`, `LB-016`.

Acceptance:

- time zone, recurrence boundary, change/cancellation, reminder intent, and conflicts are explicit;
- agenda is fully keyboard operable and contains all critical calendar information;
- stale-write, denied, unavailable, and deterministic time tests pass.

Dependencies: `P3-S1`; shared versioned time contract.

Actual contract freeze, 2026-07-27:

- three independent audits and one bounded RFC 9557/PostgreSQL/Google Calendar/
  W3C/OWASP official-source cycle converged on `P3-S2-v1`;
- Identity issues fresh action/request-digest decisions for calendar read and
  appointment create/change/cancel. The accepted P2
  `household_coordination` basic-label grant maps only to this structured
  appointment contract; organizer/member/caregiver role remains insufficient;
- Care owns structured kind/logistics, canonical UTC plus source local/IANA/
  numeric-offset facts, finite weekly occurrence materialization, half-open
  conflict serialization, optimistic/idempotent occurrence-only change/cancel,
  cancellation history, audit and outbox;
- recurrence is `none` or 2–12 weekly occurrences at a 1–4 week interval.
  DST gaps fail, overlaps use an explicit earlier/later policy, and no infinite
  RRULE, “this and following”, implicit series split or external sync exists;
- Notification receives only a versioned structured schedule/cancel reminder
  intent with opaque appointment/recipient references, UTC trigger/start and
  fixed message key. It receives no logistics, local time, zone, recurrence,
  conflict, reason, free text or idempotency material and makes no delivery
  claim;
- LB-015/LB-016 require four bounded synthetic Stitch references, independent
  review, a Frozen redacted correction map and native semantic implementation.
  The agenda is the complete keyboard path at every width; KI-019 prevents a
  private-pixel visual-conformance claim if independent review remains
  unavailable;
- planned-versus-actual deviation `CHG-2026-014` narrows previously unspecified
  authority, DST, recurrence, mutation-scope, conflict and reminder semantics
  without adding a service, engine, phase or clinical scope.

Planned validation: focused Level A/B during implementation, then exactly one
`pnpm.cmd run validate:p3-s2` Level C campaign. Hosted exact-head, ready PR,
merge commit, post-merge `dev` CI and issue #10 closeout remain required before
acceptance.

### `P3-S3 — Care-plan review`

Outcome: authorized participants create/version a care plan with goals, preferences, responsibilities, and review date without clinical recommendations.

Screen: `LB-017`.

Acceptance:

- draft/current/version/review state is clear;
- consent and concurrent edits are enforced;
- product copy avoids diagnosis/treatment advice;
- history, integration, browser, accessibility, and security tests pass.

Dependencies: P2 consent; P3 timeline/time contracts.

Implementation freeze: `P3-S3-v1`, ADR-023 and `CHG-2026-015` keep one
Care-owned shared draft/current aggregate, immutable confirmed history, fresh
P2 action authority on every request, stored local-date/IANA UTC day bounds,
optimistic/idempotent commands and a suppressed content-free confirmation
event. Organizer/member status never implies consent. The native product term
is “Kế hoạch hỗ trợ / Support plan”; no clinical recommendation is present.
Four synthetic LB-017 Stitch references were generated/read back once and the
corrected handoff is Frozen with KI-019 retained; generated source is rejected.
The single Level C campaign completed through classified retained-evidence
continuations: unit 57/57, contracts 24/24, cumulative PostgreSQL integration
and migrations, mocked LB-017 3/3, real P3-S3 1/1, cumulative browser
regressions, accessibility, builds, privacy-safe logs and cleanup pass. Hosted
exact-head and post-merge promotion passed; docs-only canonical closeout is
accepted at `dev@98a420f17b6bee7494dd889e325e7401d9ec5068`.

## P4 — Safety and records

### `P4-S1 — Medication reminder acknowledgement`

Outcome: an authorized user configures and acknowledges a schedule reminder with explicit units/time zone and no dosage recommendation.

Screen: `LB-018`; Notification extension.

Acceptance:

- product stores user-provided schedule only and does not infer dosage/urgency;
- recurrence/time-zone and duplicate acknowledgement are deterministic;
- delivery/acknowledgement state is truthful and auditable;
- denied, invalid, missed-delivery, conflict, integration/browser tests pass.

Dependencies: P2 consent; P3 time model; Notification reliability.

### `P4-S2 — Emergency contacts and offline-readable plan`

Outcome: authorized participants configure an ordered contact list and reviewed emergency plan that remains clearly readable in a safe offline copy.

Screens: `LB-020`, `LB-021`; `LB-032` behavior.

Acceptance:

- no diagnosis or automated dispatch claim;
- stale/offline copy is timestamped and never mistaken for live state;
- contact disclosure is minimum necessary and consent scoped;
- update conflict, no-plan, denied, offline, security and browser tests pass.

Dependencies: P2 consent; accepted retention/cache threat review.

Actual accepted boundary (`CHG-2026-017`):

- Care owns one emergency-readiness aggregate, ordered contacts, working
  draft, immutable reviewed versions/history, audit and content-free
  suppressed outbox. Migration 006 has no backfill and no new service or
  persistence engine.
- Every online operation consumes one fresh exact-purpose P2 decision.
  Organizer/member status, a stored copy, or possession of contact
  information never grants authority.
- `P4-S2-v1` freezes complete-list replacement, optimistic revisions,
  idempotency, sealed authority-bound history cursors, explicit no-plan/
  review-required/conflict/denied/unavailable truth and minimum projections.
- `P4-S2-offline-v1` contains only reviewed steps, ordered label/dial facts,
  opaque source/scope/version facts and server confirmation/display-time
  facts. It is encrypted only after explicit passphrase opt-in using
  PBKDF2-HMAC-SHA-256 (600,000 iterations) and AES-256-GCM. Recent is at most
  24 hours; stale remains clearly labeled through 72 hours; expiry,
  integrity failure, online denial and superseding source versions purge or
  replace the local copy.
- The service worker caches only the static unlock shell, serves only its
  three exact shell assets, and intercepts only same-origin emergency-plan
  navigations. Offline writes are blocked and never queued or replayed.
- Four bounded synthetic Stitch references were generated once, read back
  once and recorded in the Frozen redacted native-only handoff. Generated
  source was rejected and KI-019 remains.
- Exactly one `pnpm.cmd run validate:p4-s2` campaign ran. It passed all
  format/lint/type/unit/contract/docs/config/secrets/audit/build and
  cumulative integrations through P4-S1, then stopped at two P4-S2
  PostgreSQL binding/sentinel defects. Classified targeted recovery—not a
  second Level C—proved the corrected 6/6 Care suite, migration 006, the real
  P4-S2 production-runtime Chromium journey, all three mocked P4-S2 paths and
  cumulative P2–P4-S1 browser regressions.
- Feature commit `1b28a16cd9f378de3fcc9f57f0c456b07f89b2bb`
  passed exact-head push run `30356925555`. PR run `30357031265` then exposed
  a test-only no-op ciphertext mutation; deterministic recovery
  `ea5acf761e64ac6718936e262e4b089a5e37b74c` passed exact-head PR run
  `30358335589`. PR #62 merged as
  `dev@7690a7c584891fbd2bd62de600a5b11bb58a8be7`, post-merge run
  `30359250442` passed, and issue #13 closed completed with bilingual evidence.

### `P4-S3 — Access-controlled document vault`

Outcome: an authorized user uploads, lists, retrieves, and removes a permitted synthetic document with retention/access feedback.

Screen: `LB-023`.

Acceptance:

- type/size validation, malware-processing state, retention, access and deletion are explicit;
- object bytes and metadata have one documented owner and authorization path;
- generated/external files are never executed;
- denied, failed processing, unavailable, audit, backup/restore and browser tests pass.

Dependencies: P2 consent/audit; accepted polyglot/object-storage ADR before adding an engine.

Actual implementation boundary (`CHG-2026-018`):

- ADR-026 keeps bounded metadata and strict UTF-8 `.txt` bytes together in the
  existing Care PostgreSQL owner; no object store, scanner, crypto scheme,
  cache or service is introduced.
- `P4-S3-v1` adds explicit `document_vault.access`; existing grants are not
  broadened. Every list/upload/metadata/download/delete obtains a fresh exact
  P2 decision, and household status alone grants nothing.
- Accepted files are declared `text/plain`, final `.txt`, strict UTF-8, and
  1–262,144 decoded bytes. Successful state is `ready_unscanned` with scanner
  `not_configured` and malware `not_scanned`, never a clean/safe claim.
- Downloads are attachment-only octet streams after fresh authority and
  digest/object-binding verification. Explicit delete purges active data with
  no product undo; recovery means re-uploading the user's local original.
- Four synthetic LB-023 Stitch references were created once and read back
  once. The corrected redacted handoff is Frozen, generated source is rejected
  and KI-019 remains because private pixels were unavailable.
- Exactly one local P4-S3 Level C ran after focused contract/data/UI/test
  reconciliation and passed without recovery. It proved format/lint/type/unit/
  contract/docs/config/secrets/audit/build, cumulative integrations, migration
  rollback/reapply/no-backfill, pre-delete restore, post-delete
  non-resurrection, real PostgreSQL/Chromium runtime and the complete mocked
  failure/accessibility matrix; its PID-scoped Docker resources were removed.
  Exact-head push/PR runs `30375655611`/`30375846902` passed all three jobs.
  Sole ready feature PR #64 merged by merge commit
  `7b10d62d0cd1857e9d63e57d34bfd068040a8fd6`; post-merge `dev` run
  `30376359437` passed all three jobs and issue #14 closed completed with
  bilingual evidence.

## P5 — Community support

### `P5-S1 — Consented help request and directory`

Outcome: a household submits a bounded help request and finds eligible public support without oversharing.

Screens: `LB-022`, `LB-024`.

Acceptance:

- visibility and consent are explained before submission;
- public directory uses reviewed provenance and minimum data;
- location denial, no result, duplicate request, unavailable matching, and safe recovery work;
- the greenfield Community boundary is implemented as the repository's first
  Spring Boot service, with its own PostgreSQL role/database/migrations,
  transactional outbox, and audit;
- Node Gateway ↔ Community uses versioned language-neutral OpenAPI/JSON Schema
  with provider/consumer tests; Identity & Consent remains authoritative and
  only minimum authorized context crosses the boundary;
- the P5 research gate verifies and pins an officially supported JDK
  distribution/version, Spring Boot version, Maven plugins, checksums and a
  repository-owned Windows wrapper (prefer `mvnw.cmd`); no version is assumed
  by this plan;
- PostgreSQL search is the initial implementation; Elasticsearch, Redis,
  broker or object storage requires a later accepted ADR with measured
  access-pattern evidence;
- security/privacy/integration/browser tests pass.

Dependencies: P2 consent; research source review; ADR-019 Community boundary;
P5 official toolchain/supply-chain research gate.

Actual accepted boundary (`CHG-2026-011`):

- three independent pre-code reviews reconciled the official toolchain,
  authority/data/API/event/failure contract, native Stitch handoff and one-
  shot operations plan before Java or product code;
- `P5-S1-v1` is frozen as one OpenAPI/JSON Schema tree with recorded SHA-256
  hashes and shared fixed Node/Java request-digest vectors;
- Identity adds `community_support` / `community_help_request.access` without
  backfill and issues a fresh exact decision for every protected action;
  organizer/member status still grants nothing;
- Spring Boot 4.1.0 Community exclusively owns Flyway V1, its PostgreSQL
  role/database, structured directory search, request lifecycle,
  idempotency/tombstones, privacy-safe audit and suppressed transactional
  outbox. Gateway consumes the language-neutral contract and stores no
  Community state; public search does not call Identity;
- native VI/EN `/help/new` and `/community` implement minimum disclosure,
  truthful pending/closed/delete, duplicate/conflict/uncertain recovery,
  stale provenance, unavailable/no-results/location-denied/offline-blocked and
  explicit P5-S1 matching boundary states. Synthetic geography/listings only;
- Temurin 25.0.3+9, Maven 3.9.16, Wrapper 3.3.4, Spring Boot 4.1.0 and explicit
  plugins are pinned/checksummed under a repository-scoped process-local
  bootstrap; no global Java/Maven change;
- focused frozen-integrity, Node consumer, Spring provider/unit, owner-
  isolated rollback/reapply/no-backfill, Community integration/concurrency and
  built Web→Gateway→Identity→Spring→PostgreSQL browser evidence is green;
- late review hardening aggregate-links and invalidates protected replays on
  delete/purge, serializes same-key first use, makes delete/purge evidence
  monotonic, schedules owned retention, normalizes Identity revoked/denied/
  unavailable truth and removes all UI geolocation calls. Targeted Node 18/18,
  Identity 10/10, Community 11/11, browser 6/6 and reproducible-package proof
  are green without rerunning Level C;
- exactly one local P5-S1 Level C was invoked. Its immutable static-gate
  formatting failure and successful classified targeted continuation prove all
  required local stages without a second full campaign. Final feature head
  `59f57e903ad71342e3259fce48b9de3315e7adef` passed exact-head push/PR CI,
  ready PR #66 merged as
  `dev@ac663a714b69aace443f712f1d8ee700b5e48636`, post-merge run
  `30397698495` passed every required job and issue #15 closed with bilingual
  immutable evidence. P5-S2 is not started.

### `P5-S2 — Volunteer match and organization coordination`

Outcome: a volunteer/coordinator accepts an approved match and records progress using only minimum necessary household data.

Screens: `LB-025`, `LB-026`.

Acceptance:

- eligibility/permission, approval/revocation, assignment, capacity and status are explicit;
- unrelated household fields are inaccessible;
- concurrent/revoked match and audit behavior are tested;
- matching extends the same Spring Community service and owned store rather
  than creating a second runtime or cross-service persistence path;
- organization-scoped contract/integration/browser/security checks pass.

Dependencies: `P5-S1`; P2 roles/audit.

Candidate actual (`2026-07-29`): three independent pre-code reviews reconciled
separate exact P2 scopes, Community organization approval/role and bounded
capacity evidence before code. `P5-S2-v1` and `P5-S2-UI-v1` are Frozen;
LB-025/LB-026, Identity migration 006, Community Flyway V2, Gateway consumer,
content-free audit/outbox and focused proof are implemented. Exactly-one local
Level C, hosted promotion and issue #16 closeout remain pending; P5-S3 and later
work remain unstarted.

### `P5-S3 — Moderation resolution`

Outcome: a scoped moderator reviews and resolves a community safety report with redacted evidence and an auditable decision.

Screen: `LB-027`.

Acceptance:

- least-privilege queue/detail access and safe destructive confirmation;
- decision reason, actor, time, result, retention and redaction are auditable;
- denied access never reveals case existence/details;
- moderation extends the same Spring Community boundary and preserves its
  owner-scoped audit/outbox/data contract;
- integration/browser/security tests pass.

Dependencies: `P5-S2`; moderation policy and retention decision.

## P6 — Microservice platform and contracts

### `P6-S1 — Versioned contracts and rolling compatibility`

Status: accepted on `dev` on 2026-08-02 through merge-commit PR #73 at
`f7aab7620d5fcde80c2129a54db1ac9291340489`. Three independent reviews froze
`community-v2` current plus `community-v1` previous, a 90-day minimum window,
provider-first rollout, consumer-first rollback, language-neutral breaking
rules and explicit uncertain-result truth. Literal-head push/PR gates and the
post-merge `dev` Windows, PostgreSQL/mixed-runtime/Chromium and aggregate gates
passed. P6-S2 remains unstarted and requires fresh dispatch.

Outcome: the primary user journey remains correct while compatible service
versions are rolled independently.

Acceptance:

- current and previous supported API/event versions pass provider/consumer tests;
- breaking changes fail CI and deprecation/migration policy is explicit;
- the primary flow passes during a mixed Node/Spring version rolling upgrade;
- Gateway/Community compatibility is proven from language-neutral contracts,
  not shared generated business code.

### `P6-S2 — Independently runnable service artifacts and ownership`

Status: canonical product implementation accepted on
`dev@2b4c8d46725ed91d8c733cfc8f3177ce3e727d87` through merge-commit PR #75.
Exact-head push/PR runs `30721320964` and `30721323043`, plus automatic
post-merge dev run `30721753390`, passed every required job including the six
isolated images, independent Notification upgrade and stable aggregate gate.
`CHG-2026-019` also adds subordinate fail-closed docs-only CI cost control;
its docs-only push/PR/post-merge evidence is recorded in the closeout PR.

Outcome: every deployable can build, start, report health/readiness, and upgrade
without another service's source tree or datastore credential.

Acceptance:

- every deployable has an owned build/start/config/health contract and artifact;
- one service can be upgraded independently;
- no cross-service business import, table access, credential, or shared ownership
  exists; architecture fitness checks enforce the boundary;
- Node and Spring dependencies, SBOMs, supply-chain policy and containers are
  isolated per artifact.

### `P6-S3 — Authenticated service communication and dependency isolation`

Status: local candidate validated on 2026-08-02 from exact accepted
`dev@6d7204d6272d70672a1c1f1429cdc742fd172bc0`. Three independent pre-code
reviews are reconciled in `docs/testing/P6_S3_PRECODE_REVIEW.md`; the frozen
security/failure/rollback contract is `docs/security/P6_S3_THREAT_MODEL.md`.
Issue #24 is retained and reconciled in place under `CHG-2026-020` rather than
duplicated.
The sole Level C invocation `e1a1a5cc1003405ebd44912743befe2c` passed all
static/auth, Spring, cumulative P6, security/SBOM, production-build and
integrity stages. Local Docker was truthfully classified unavailable under
KI-004; exact-head hosted container/auth/failure/rollback proof remains the
promotion gate.

Outcome: an unavailable secondary service cannot corrupt confirmed core state,
and internal calls use explicit least-privilege identities outside local mode.

Acceptance:

- service identity and transport protection are documented and tested;
- timeouts, retry, idempotency, rate, circuit/bulkhead, and payload bounds apply;
- Notification or Community failure produces truthful degradation without
  corrupting the care-task source of truth;
- health/readiness, redacted observability and rollback are validated across
  the mixed-runtime topology.

Phase gate: independent artifacts, mixed-version flow, architecture fitness,
authenticated calls, and dependency-failure tests pass.

## P7 — Data durability and event reliability

### `P7-S1 — Service-owned migrations and schema compatibility`

Outcome: an operator upgrades owned service schemas without downtime, data
ownership leakage, or an unsafe rollback claim.

Status: local candidate on 2026-08-02 from exact accepted
`dev@ae48031652fbc9e751cd0b0928deb5c01f39b5e0`. `CHG-2026-021` freezes the
four-owner ledger, separate runtime/migrator credentials, additive N schema,
Node ledger protocol, retained Flyway executor and roll-forward/compensation
contract. Hosted PostgreSQL/Flyway/mixed-runtime proof remains the gate.

Acceptance:

- `N-1 -> N` schema evolution works with mixed runtime versions;
- migrations are owner-scoped, repeat-safe, observable, and forward-compatible;
- rollback uses an evidenced roll-forward or compensation plan.

### `P7-S2 — Durable event replay, reconciliation, and dead-letter recovery`

Outcome: an operator recovers delayed or poison events without losing or
duplicating the business result.

Status: **Accepted on `dev`** through product PR #81 and merge commit
`c2c0f33516a7860dc40ec5c3376a45a06a3bf1c5`. Exact product head
`2111cd5ba2da3632c060c41bf153fe7322c5570a` passed push/PR runs
`30730747200`/`30730748657`; automatic post-merge run `30731150450` passed all
required P1 through P7-S2 gates. The frozen topology is Care
PostgreSQL outbox → authenticated bounded HTTP → Notification PostgreSQL
inbox/result. Care owns attempts/terminal attention; Notification owns receipt
and durable result. Recovery is single-event, dry-run-first and redacted.

Acceptance:

- outbox/inbox replay is idempotent and reconciliation detects drift;
- poison events, terminal retries, dead-letter ownership, and recovery are explicit;
- recovery tests prove exactly one durable notification result where required.

### `P7-S3 — Backup, restore, retention, deletion, and polyglot recovery`

Outcome: each source of truth can be restored and governed deletion can be
completed across service-owned stores.

Acceptance:

- measured restore evidence and accepted RPO/RTO exist per source of truth;
- retention/deletion propagates without cross-service table access;
- every additional engine has an accepted ADR plus rebuild, migration, and exit
  plans.

Phase gate: previous-schema upgrade, reconciliation/replay, restore,
retention/deletion, RPO/RTO, and service-ownership checks pass.

Candidate update 2026-08-02: reversible recovery and a policy-neutral lifecycle
framework are implemented on the canonical phase branch. The owner ledger drift
is corrected; the exact inventory remains PostgreSQL-only; encrypted,
provenance-bound isolated restore and lifecycle fail-closed proofs are tracked.
The product owner subsequently delegated the choice and accepted the
privacy-first engineering matrix in
`contracts/lifecycle/p7-s3-product-policy.json`: product export only, 24-hour
export artifacts, 30-day backup artifacts and bounded evidence retention up to
365 days. Unsupported legal overrides still return
`POLICY_DECISION_REQUIRED`. Level C may now proceed; P8 remains unstarted.

Accepted 2026-08-02: product head `fdaf8ed7bd9524a274886bf3609d4b5485de676f`
passed exact-head push/PR runs `30733182403`/`30733210842`, including P7-S3
encrypted isolated restore and both P1-through-P7-S3 aggregators. PR #83 merged
by merge commit `34c716d2931f14851b3b552fadbbc961ec62753b` and automatic dev run
`30733589109` passed the full heavy path in 10m09s. P7-S3 and Phase 7 are
accepted; no P8/DATA-S1/release work begins in this task.

## P8 — Security, privacy, abuse, and supply-chain hardening

### `P8-S1 — Household isolation and consent enforcement`

Accepted 2026-08-02: `CHG-2026-022`/ADR-030 adds the executable
deny-by-default matrix, current membership/consent decision binding, exact
service-key verification, two-household fixtures and production authorization
for historical task/member/dashboard/notification routes. Product head
`376b88f8eb51ebceb1ad679de2119bca7dc65a39` passed push/PR runs
`30735140477`/`30735160950`; PR #85 merged as
`4da952eb97e72dbf8d9a6103a6e83438df292848`, and automatic dev run
`30735583092` passed the full heavy path and P1-through-P8-S1 gate. P8-S2/P8-S3
are not started.

Outcome: an authorized user can access only the accepted household/resource
scope, while denied users cannot enumerate protected records.

Acceptance:

- authorization matrix and cross-household isolation tests pass;
- consent revocation changes subsequent access deterministically;
- privileged operations are least-privilege and auditable.

### `P8-S2 — Secrets, encryption, runtime, and supply-chain hardening`

Accepted 2026-08-02: `CHG-2026-023`/ADR-031 and the repository-native secret,
rotation, encryption-truth, runtime, SBOM and digest-bound provenance controls
passed sole Level C `096bf28d2bb54bc1bbd637a2b767a0d5`. Exact head
`8617f2021d84af5befcfb5582a91b5b30c90abd2` passed automatic push/PR runs
`30737326707`/`30737393207`; PR #87 merged by merge commit
`1e884b9651d6df6f2df77d25164c13ff9bfe5fc9`, and automatic dev run
`30737823547` passed the full heavy path and P1-through-P8-S2 aggregator. No
external secret manager/KMS/PKI/provider, certification or SLSA level is
introduced or claimed. P8-S3 is not started.

Outcome: an operator rotates secrets and deploys traceable artifacts without
placing long-lived credentials in source or logs.

Acceptance:

- secret rotation and encryption-boundary drills pass;
- least-privilege runtime, SBOM, artifact provenance, dependency/container scans,
  and exception ownership are evidenced;
- debug/local credentials cannot enter production builds.

### `P8-S3 — Abuse safeguards, privacy lifecycle, and security response`

Candidate 2026-08-02: `CHG-2026-024` reconciles stale issue #30. Machine
inventory freezes per-surface dimensions/budgets and independent recovery
capacity; lifecycle reconciliation treats pending, blocked, failed and policy
decision states as non-complete; the actual P5 moderation resolve/reconcile
boundary is repaired without claiming report/claim/appeal; and a synthetic
bilingual tabletop covers detection through improvement. This is engineering
evidence only, not legal advice, certification, production mutation or P9.

Accepted: head `9a62acd52f945eddbf3a890b99b17d2072ea633e` passed 26
automatic PR checks. PR #89 merged by merge commit
`adf0bad67a43d9dac73b0ce7cc540b60f7bb8ee8`; automatic dev run
`30739630918` passed the P1-through-P8-S3 / Phase 8 gate. P9 remains unstarted.

Outcome: abusive requests are bounded, privacy actions are fulfilled, and the
team can execute a security response without claiming legal certification.

Acceptance:

- rate/abuse and moderation safeguards preserve legitimate recovery paths;
- audit retention/redaction and privacy lifecycle behavior are tested;
- a security/privacy tabletop records owner, evidence, containment, and follow-up.

Phase gate: isolation matrix, rotation, SBOM/provenance, vulnerability review,
threat/privacy model, abuse controls, and response drill pass.

## P9 — Observability, SLOs, resilience, incident response, and DR

### `P9-S1 — Redacted end-to-end observability and SLO baseline`

Outcome: an operator can trace an accepted user journey across services without
exposing sensitive task, household, medication, or document content.

Acceptance:

- correlated metrics, logs, and traces cover gateway, services, data, and events;
- telemetry schemas are redacted, bounded, retained, and access-controlled;
- dashboards distinguish user error, dependency failure, and data/event lag;
- journey SLIs, initial measured SLO/error budgets, alert ownership, and
  escalation are accepted.

### `P9-S2 — Offline, conflict, and graceful degradation`

Outcome: release flows truthfully distinguish stale, queued, blocked,
conflicted, rejected, dependency-failed, and confirmed state through outage and
reconnect.

Acceptance:

- every mutation declares offline/blocked/queued behavior; no false saved state;
- conflict reconciliation and partial-dependency fallback are deterministic;
- keyboard/focus/screen-reader, reflow, forced-color, and bilingual reusable
  state tests pass.

### `P9-S3 — Incident response and disaster-recovery game day`

Outcome: the team detects, contains, recovers from, and explains a simulated
user-impacting incident within approved recovery objectives.

Acceptance:

- bounded failure injection triggers an actionable alert and executable runbook;
- incident roles, safe communication, failover, restore, and replay are tested;
- measured RTO/RPO are compared with accepted objectives;
- a redacted blameless postmortem records owned follow-up.

Phase gate: redacted telemetry, actionable alert, accepted SLO/error budget,
runbooks, degraded-state truthfulness, and DR rehearsal pass.

## P10 — Performance, scalability, capacity, and cost

### `P10-S1 — Workload model and measurable performance budgets`

Outcome: the team can reproduce a representative synthetic workload and decide
whether the release meets explicit user-journey budgets.

Acceptance:

- data sizes, concurrency, latency, throughput, and resource budgets are approved;
- fixtures contain no real personal or care data;
- measurements include correctness and error behavior, not latency alone.

### `P10-S2 — Scalability, backpressure, and bounded-resource behavior`

Outcome: scale-out and saturation preserve authorization, idempotency, and
truthful state instead of losing or duplicating work.

Acceptance:

- queues, retries, caches, indexes, connections, and autoscaling stay bounded;
- backpressure and overload responses are explicit and observable;
- correctness and household isolation survive horizontal scale.

### `P10-S3 — Soak, spike, capacity, and cost governance`

Outcome: operators know the supported capacity, regression thresholds, and cost
guardrails before public rollout.

Acceptance:

- accepted soak and spike suites pass without unbounded memory/storage/log growth;
- capacity forecast and cost guardrails cover each deployable/store;
- performance regressions block release at recorded thresholds.

Phase gate: numeric budgets, load/spike/soak evidence, correctness under load,
bounded resources, capacity, and cost plan pass.

## P11 — Production deployment, staged rollout, pilot, and release

### `P11-S1 — Reproducible production deployment and rollback`

Outcome: the accepted release builds, migrates, starts, reports health,
backs up/restores, and rolls back in a production-like environment.

Acceptance:

- versioned infrastructure/configuration and immutable artifact provenance exist;
- protected secrets/environments, per-service migration/health, backup/restore,
  fixture smoke, and redacted telemetry pass;
- rollback is rehearsed; fixture authentication and private credentials cannot
  enter public production.

### `P11-S2 — Staged rollout and consented production pilot`

Outcome: a bounded pilot moves through staging and canary/blue-green rollout
with explicit stop and rollback decisions.

Acceptance:

- test/staging/production boundaries and access are distinct;
- rollout metrics, rollback triggers, pilot consent/support, and incident ownership
  are accepted;
- no open high-risk privacy/security/reliability finding is hidden by the pilot.

### `P11-S3 — Release evidence, demo, and submission`

Outcome: a reviewer can reproduce only the behavior in the exact released
commit with truthful claims, disclosed limitations, and a tagged release.

Acceptance:

- clean install, full CI/security/performance/DR gates, production smoke, and demo
  rehearsal pass;
- README, demo/submission copy, SBOM/provenance, screenshots, and known issues
  match the release;
- every required MCP/integration debt is closed before `test -> main`.

Phase gate: immutable deployment, migration/rollback, staged pilot, full
validation, zero deploy-blocking debt, smoke, and release tag pass.

## P12 — Post-launch operations and continuous improvement

### `P12-S1 — Live operations, support, and post-incident improvement`

Outcome: service ownership and support paths take an alert through resolution,
postmortem, and tracked follow-up.

Acceptance:

- on-call/support ownership and customer-safe status communication exist;
- one alert-to-resolution exercise and blameless postmortem pass;
- corrective actions have owners, priorities, and verification.

### `P12-S2 — Patch, vulnerability, credential, and recovery maintenance`

Outcome: operators execute the recurring patch, vulnerability, secret-rotation,
backup verification, and restore cadence.

Acceptance:

- dependency/runtime/container patch policy and vulnerability SLAs are exercised;
- credential rotation and restore drills remain current;
- exceptions expire or have explicit accepted ownership and risk.

### `P12-S3 — Privacy-safe feedback and next-roadmap governance`

Outcome: consented operational/product evidence produces a governed successor
roadmap rather than chat-only scope growth.

Acceptance:

- metrics/feedback have purpose, consent, retention, access, and deletion controls;
- outcome claims distinguish facts, inferences, missing evidence, and recommendations;
- the next roadmap records planned versus actual, debt, user evidence, and
  production learning through Change Control.

Phase gate: operations/support, incident and maintenance exercises, SLO review,
privacy-safe feedback, and a successor roadmap baseline exist.

## Screen-to-phase control

| Screen IDs                                      | Planned phase                     | Notes                        |
| ----------------------------------------------- | --------------------------------- | ---------------------------- |
| `LB-011`, `LB-013`, `LB-014`, relevant `LB-019` | P1                                | First MVP only               |
| `LB-001`–`LB-010`, `LB-028`–`LB-031`            | P2                                | Trust, household, consent    |
| `LB-012`, `LB-015`–`LB-017`                     | P3                                | Planning and handoff         |
| `LB-018`, `LB-020`, `LB-021`, `LB-023`          | P4                                | Reminder, emergency, records |
| `LB-022`, `LB-024`–`LB-027`                     | P5                                | Community                    |
| `LB-032`–`LB-035`                               | Applied per slice; hardened in P9 | Cross-cutting patterns       |

No row means simultaneous implementation. Design generation/review may prepare a future slice, but production code remains gated by the active slice.

## Change-control register

### Required record

```md
## CHG-YYYY-NNN — Title

- State: Proposed | Accepted | Implemented | Rejected | Superseded
- Raised in phase/slice:
- Planned baseline:
- Proposed/actual implementation:
- Reason and evidence:
- Impact:
  - Product/UI:
  - API/events:
  - Data/migration:
  - Privacy/security:
  - Tests/operations:
  - Phase order/schedule:
- Validation required:
- Follow-up owner and exact phase/slice:
- Related ADR/integration/session entries:
```

### Current accepted changes

| Change ID      | State                                | Effect on baseline                                                                     |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| `CHG-2026-001` | Implemented in Phase 0               | Windows + Codex App replace legacy mixed-platform/tool delivery paths                  |
| `CHG-2026-002` | Baseline implemented; lane due       | Adds bilingual 2016–2026 research and `init/research → data → dev` promotion control   |
| `CHG-2026-003` | Partially superseded                 | Research/runbook overlay remains; its compact P0–P6 roadmap limit is superseded        |
| `CHG-2026-004` | Implemented in docs/GitHub           | Preserves P0–P5 and expands production maturity through P6–P12                         |
| `CHG-2026-005` | Accepted; debt gate active           | Required MCP unavailable after 180 seconds becomes tracked deploy-blocking debt        |
| `CHG-2026-006` | Bounded design session complete      | P1 handoff v1.0 is Frozen; credential retirement remains a deployment gate             |
| `CHG-2026-007` | CI bootstrap implemented             | One guarded workflow-only PR registered hosted CI on default `main`                    |
| `CHG-2026-008` | Integrated; hosted validation passed | Freeze one useful completion-to-creator notification and suppress self-notification    |
| `CHG-2026-009` | Integrated; hosted validation passed | Exclude unused vulnerable Sharp and narrowly patch Next's vulnerable PostCSS edge      |
| `CHG-2026-010` | Accepted; implementation in progress | First-party P2 account/session boundary; account scope does not grant household access |
| `CHG-2026-011` | Accepted; implementation deferred    | Select Spring Boot for greenfield Community at P5; preserve existing Node boundaries   |
| `CHG-2026-012` | Accepted; local validation passed    | Consent authority is explicit self-establishment, never organizer membership           |
| `CHG-2026-013` | Integrated; hosted validation passed | Fresh P2 decision plus Care-owned snapshot timeline and atomic structured handoff      |
| `CHG-2026-014` | Integrated; hosted validation passed | Finite Care-owned appointment occurrences and minimum Notification reminder intent     |

## CHG-2026-008 — Freeze the P1-S1 accountable notification audience

- State: Integrated; hosted validation passed
- Raised in phase/slice: `P1-S1`
- Planned baseline: the Phase 0 draft listed created, assigned, and completed
  task events without fixing which event produced the one MVP notification or
  naming its recipient.
- Proposed/actual implementation: create commits task and audit state only.
  Authorized assignee completion commits one `care.task.completed.v1` outbox
  event. Notification stores one item for the task creator/coordinator when
  that recipient differs from the completer. Self-completion is suppressed and
  audited. Care owns pending/failed delivery intent; Notification owns stored
  notification rows.
- Reason and evidence: issue #5 requires exactly one persistent notification
  and a useful accountable cross-user loop. Sending the assignee a notification
  for their own completion would add noise without accountable value.
- Impact:
  - Product/UI: the creator receives the completion signal; task completion and
    notification delivery remain separate truths.
  - API/events: only completion enters the P1 notification outbox; the event
    carries minimum opaque recipient/actor/task references and versions.
  - Data/migration: task provenance supplies the creator recipient; inbox and
    notification uniqueness remain source-event based.
  - Privacy/security: recipient is authorized within the synthetic household;
    event/log payloads contain no title, description, name, or care content.
  - Tests/operations: prove cross-user delivery, self-suppression, duplicate
    complete/event behavior, unavailable Notification recovery, and ownership
    of pending/failed/delivered state.
  - Phase order/schedule: unchanged; no DATA-S1 or P2 scope is introduced.
- Validation required: contract, unit, PostgreSQL integration, VI/EN browser,
  log-redaction, and exact-head hosted CI evidence.
- Follow-up owner and exact phase/slice: P2-S1 replaces fixture identity; any
  broader notification preference/audience model requires its own later
  accepted slice/change.
- Related ADR/integration/session entries: ADR-016,
  `INT-2026-011`, and the P1-S1 session entry.

## CHG-2026-009 — Keep the P1 web supply chain patched without an image pipeline

- State: Integrated; hosted validation passed
- Raised in phase/slice: `P1-S1`
- Planned baseline: Next production build with lifecycle scripts denied by
  default; only a proven required package may be allowlisted.
- Proposed/actual implementation: keep Next 16.2.11, exclude its unused
  optional `sharp` edge through project-local pnpm
  `ignoredOptionalDependencies`, retain `allowBuilds.sharp: false`, and apply
  only `next@16.2.11>postcss: 8.5.18`. Do not audit-ignore either advisory and
  do not force Sharp 0.35 outside Next's declared range.
- Reason and evidence: reviewed advisories mark Sharp `<0.35.0` and PostCSS
  `<=8.5.17` vulnerable. Next 16.2.11 and 16.2.12 both declare Sharp
  `^0.34.5` and PostCSS 8.4.31; 16.2.12 was also inside the workspace 24-hour
  release-age quarantine. P1 has no image consumer, while PostCSS is required
  for the production web build and 8.5.18 is the first complete patch.
- Impact:
  - Product/UI: no behavior or visual change; local fonts remain unchanged.
  - API/events: none.
  - Data/migration: none.
  - Privacy/security: vulnerable unused native image code is absent; the CSS
    build edge resolves to the reviewed patched version.
  - Tests/operations: frozen install, dependency audit, lifecycle report,
    production build/runtime and all four browser cases become affected gates.
  - Phase order/schedule: unchanged; no image feature or later slice is added.
- Validation required: lockfile policy, zero-high audit, absence of Sharp and
  `next/image`, production build/runtime/browser, final Level C, and exact-head
  hosted CI.
- Follow-up owner and exact phase/slice: the first accepted slice that needs
  `next/image` or server image processing must choose a Next-supported patched
  Sharp path before deploy; a Next upgrade that natively resolves patched
  PostCSS should remove the parent-scoped override after the same targeted
  evidence.
- Related ADR/integration/session entries: ADR-017, KI-015,
  `INT-2026-011`, and the P1-S1 session entry.

## CHG-2026-010 — Freeze the P2-S1 first-party account boundary

- State: Integrated; full slice validation and hosted promotion passed
- Raised in phase/slice: `P2-S1`
- Planned baseline: replace P1 fixture identity with registration, required
  factor/recovery, preferences, and an authorized session. Provider, identifier,
  recovery proof, and whether account authority implied household access were
  unspecified.
- Proposed/actual implementation: Identity & Consent owns accounts,
  password/TOTP/recovery artifacts, sessions, rate limits, preferences, and
  audit in its own PostgreSQL database. Login uses a non-email login name.
  Recovery requires one remaining primary factor plus a saved one-time recovery
  code. Authorized sessions are account-scoped only; P2-S2 owns household
  membership. No external provider/new engine is added.
- Reason/evidence: NIST/OWASP/WCAG and the existing service-ownership contract
  require explicit authenticator lifecycle, replay/race protection,
  non-enumeration, accessible authentication, and separation of authentication
  from authorization. Selecting the owned boundary avoids an unfrozen provider
  trust/residency/cost/exit decision.
- Impact:
  - Product/UI: required TOTP and recovery-code acknowledgement; total-loss
    automated recovery is unavailable; Frozen Stitch handoff and native UI
    passed review.
  - API/events: new `P2-S1-v1` account/challenge/session/preferences contracts;
    no cross-service event or household authorization is added.
  - Data/migration: one Identity-owned PostgreSQL database and additive initial
    migration; no Care/Notification write.
  - Privacy/security: server-side opaque cookies, CSRF/origin controls,
    Argon2id, encrypted TOTP seed, digest-only tokens/codes, generic responses,
    atomic rate/race handling, safe audit/logging.
  - Tests/operations: package Level A/B, one full P2 Level C, exact-head and
    post-merge aggregate gates passed.
  - Phase order/schedule: unchanged; P2-S2/DATA-S1/deployment remain deferred.
- Validation: frozen contract/unit/PostgreSQL/gateway/supply-chain evidence,
  seven Frozen handoffs, browser/accessibility, one complete Level C,
  exact-head hosted CI, reviewed PR merge, post-merge CI and issue #6 closure
  passed. Manual assistive-technology evidence remains KI-016.
- Follow-up owner and exact phase/slice: begin P2-S2 household authorization
  and consent only in a fresh task from integrated `dev`.
- Related ADR/integration/session entries: ADR-018,
  `docs/security/P2_S1_THREAT_MODEL.md`, and the P2-S1 session entry.

## CHG-2026-011 — Select the greenfield Spring Community boundary

- State: Integrated; local and hosted validation passed
- Raised in phase/slice: governance-only amendment during `P2-S1`
- Planned baseline: Community was a future independently deployable service,
  while the repository operating baseline described a practical TypeScript
  monorepo and did not require a second backend runtime.
- Proposed/actual implementation: LifeBridge is a polyglot microservice system.
  The first Spring Boot service is the greenfield Community boundary beginning
  at P5-S1/issue #15 and available for separately governed extension through
  P5-S2/P5-S3. Existing Gateway, Identity & Consent, Care Coordination and
  Notification remain Node services; no rewrite is authorized. P5-S1
  implements Boot 4.1.0, Community-owned PostgreSQL/Flyway,
  repository-owned Maven wrappers and the frozen language-neutral contract.
- Reason/evidence: the project owner requires at least one bounded Spring Boot
  backend. Community is future, cohesive and independently owned, so it proves
  cross-runtime contracts without destabilizing accepted P1/P2 boundaries.
- Impact:
  - Product/UI: native VI/EN LB-022/LB-024 implement only consented bounded
    request submission/status and identity-free public directory search. P5-S2
    matching and P5-S3 moderation remain unstarted.
  - API/events: Node Gateway ↔ Spring Community uses versioned
    language-neutral OpenAPI/JSON Schema plus provider/consumer tests.
    Identity & Consent remains authority and supplies minimum authorized
    context only.
  - Data/migration: Community owns one PostgreSQL role/database/migrations,
    outbox and audit; no cross-service SQL, credential or business import.
    PostgreSQL search is first; another engine/broker/storage needs evidence
    and a later accepted ADR.
  - Privacy/security: Community cannot read general household or Identity
    stores; contract fixtures and logs remain minimum-data and synthetic.
  - Tests/operations: the completed official-source gate pins Temurin
    25.0.3+9, Spring Boot 4.1.0, Maven 3.9.16, Wrapper 3.3.4 and explicit
    plugins/checksums. Focused schema/consumer/provider, migration/integration,
    reproducible build and mixed-runtime browser proof is green. The one full
    Level C invocation retained its static formatting failure; an exact-
    signature targeted continuation passed every corrected and previously
    unstarted stage without a second campaign. Exact-head feature CI,
    merge-commit promotion and post-merge `dev` CI passed. P6 retains the
    wider rolling-compatibility, artifact, authenticated transport and rollback
    proof.
  - Phase order/schedule: unchanged; P4 is validated, P5 is in progress after
    accepted P5-S1, and P6 remains planned.
- Validation actual/required: invocation
  `01d2ea18bc4845f88bf55ceddbfeea44` stopped at generated Maven SBOM
  formatting after toolchain/install passed; its cleanup passed before any
  runtime started. The guarded same-invocation targeted continuation passed
  static through cleanup, including reproducible JAR digest
  `811fcf733896383afd43a640718818d579e5c69d83308502468b3977b54d1586`,
  Community database 9/9 and P5 browser 8/8. Do not run Level C again. Final
  feature head `59f57e903ad71342e3259fce48b9de3315e7adef` passed exact-head
  push/PR runs `30396846386`/`30396851617`; PR #66 merged as
  `dev@ac663a714b69aace443f712f1d8ee700b5e48636`; post-merge run
  `30397698495` passed every required job; issue #15 closed with bilingual
  evidence.
- Follow-up owner and exact phase/slice: a fresh P5-S2 task must freeze
  match/organization authority, approval, capacity, revocation, minimum
  disclosure and audit truth before extending Community.
- Related ADR/integration/session entries: ADR-019, `INT-2026-013`, issue #15,
  and the P2-S1 governance amendment session entry.

## CHG-2026-012 — Freeze P2-S3 consent authority and governed-read boundaries

- State: Integrated; local and hosted validation passed
- Raised in phase/slice: `P2-S3`
- Planned baseline: P2-S3 required versioned consent changes and an authorized
  care recipient/account owner, but P2-S2 organizer/member state did not prove
  who could speak for the care recipient.
- Proposed/actual implementation: only the creator of an eligible recipient
  context may explicitly bind their own account as its subject. That subject
  alone may grant, narrow, revoke and read audit history in P2-S3. Organizer
  and membership roles never imply consent authority. A governed context read
  requires the subject or a current exact-scope grant at the server decision
  instant.
- Reason/evidence: least privilege and object-level authorization require an
  affirmative authority proof; treating organizer membership as consent would
  silently broaden P2-S2. Creator-bound self-establishment is the narrowest
  repository-supported proof and is denied when another subject already
  exists.
- Impact:
  - Product/UI: LB-028 reviews recipient, pseudonymous recipient, exact scope,
    action and live UTC/IANA time before mutation; LB-029 saves one atomic
    privacy preference group; LB-030 is redacted/read-only/no-total; LB-031 is
    a settings hub.
  - API/events: `P2-S3-v1` grant/narrow/revoke, governed-read, audit-history and
    privacy contracts use optimistic versions and digest-bound idempotency.
  - Data/migration: additive Identity-owned migration 003 adds subject,
    consent, transition, idempotency, outbox, audit, privacy and schema-marker
    state; it does not backfill consent authority.
  - Privacy/security: revoke denies at its effective boundary; 90-day redacted
    history and sealed bounded cursors preserve necessary evidence without
    protected payloads or inferential totals.
  - Tests/operations: real PostgreSQL migration/reapply/race/idempotency/
    boundary tests, built and mocked browser paths, axe/keyboard/reflow/offline,
    privacy-safe telemetry, cumulative regression and exact cleanup are gates.
  - Phase order/schedule: unchanged. P3-S1 is next only after acceptance;
    DATA-S1, P5, deployment and release remain separate.
- Validation: the single local `pnpm.cmd run validate:p2-s3` invocation passed
  every P1/P2-S3 gate and stopped only at a deterministic P2-S1 locator
  ambiguity after the truthful preference-status correction. Targeted Level B
  then exposed and fixed the underlying stale pre-factor announcement; affected
  format/lint, production web build and P2-S1 browser 5/5 passed. Already-green
  inputs were not rerun. Replacement exact-head push run `30208540352` and PR
  run `30208541672` executed the coherent script from scratch, including the
  now-earlier runtime log scan, and passed.
- Hosted planned versus actual: planned was one feature commit and an unchanged
  exact-head run. Actual push run `30208198696` passed static/security and
  P2-S3 browser 8/8, then exposed Linux PowerShell returning `$null` for an
  empty raw log. The reason is runner-specific shell behavior unavailable in
  the supported local Windows campaign. Impact is validation tooling only; no
  product contract/data/runtime behavior changed and no merge occurred. The
  scan now normalizes null raw content to an empty string. Targeted
  parser/privacy validation and the replacement hosted runs passed. A second
  small conventional commit was necessary because force-push/history rewriting
  is prohibited.
- Follow-up owner and exact phase/slice: P3-S1 freezes authorized timeline
  projection, time-zone ordering and handoff concurrency against the accepted
  P2 consent boundary; it must not invent delegated consent authority.
- Related ADR/integration/session entries: ADR-020,
  `docs/security/P2_S3_THREAT_MODEL.md`, `INT-2026-016`, KI-019 and the P2-S3
  session entry.

## CHG-2026-013 — Freeze P3-S1 chronology and accountable handoff

- State: Integrated; local and hosted validation passed
- Raised in phase/slice: `P3-S1`
- Planned baseline: show a time-zone-explicit daily timeline and preserve task
  ownership/concurrency during handoff, but the plan did not define authority
  decision freshness, local-day/DST boundaries, snapshot pagination,
  count-inference controls, handoff context shape or pre-P3 history.
- Proposed/actual implementation: Identity issues a fresh permission- and
  request-digest-scoped P2 decision; Gateway only composes; Care owns one
  snapshot/keyset daily projection and one optimistic/idempotent immediate
  handoff transaction. UTC occurrence plus `event_ref` is public order, IANA
  local-day bounds are explicit, pages have no totals, history is not
  backfilled and context is one enumerated reason.
- Reason/evidence: three independent audits and the bounded RFC 9557,
  PostgreSQL, WCAG 2.2 and accountable-handoff primary-source cycle converged
  on server authority/time, minimum disclosure and deterministic recovery.
- Impact:
  - Product/UI: native VI/EN LB-012 and LB-014 extension with explicit date,
    zone, boundary, filter, review, offline/stale/denied/conflict/uncertain
    states and durable-success-only confirmation.
  - API/events: `P3-S1-v1` timeline query/projection, authorization decision,
    handoff review/command/result and `care.task.handed_off.v1`.
  - Data/migration: additive Care-owned migration 002 adds coverage marker,
    immutable timeline and accepted handoff evidence with no backfill.
  - Privacy/security: no free-form handoff content or totals; title stays in
    authorized read projection; decision/cursor/idempotency/telemetry are
    bounded and minimized.
  - Tests/operations: PostgreSQL DST/order/cursor/race/atomicity/migration,
    provider-consumer, real outbox/Notification runtime, mocked UI/a11y/
    offline/recovery, logs/secrets/build and exact cleanup.
  - Phase order/schedule: unchanged. P3-S2 remains blocked until P3-S1 is
    accepted; P3-S3, DATA-S1, P5, deployment and release remain separate.
- Validation: Level A type/lint and 49 selected unit/contract/boundary tests
  passed. The first focused Care PostgreSQL pass completed 12/13 cases,
  classified an ambiguous timestamp parameter (`42P08`), and the minimal
  explicit `timestamptz` correction passed targeted handoff concurrency;
  retained migration rollback/reapply/no-backfill evidence also passed.
  Mocked browser timeline 3/3 and targeted handoff review/conflict/offline 3/3
  passed after one semantic-locator narrowing. The single Level C invocation
  later stopped at its first formatting gate. Without a second invocation,
  targeted continuation passed lint/type, unit 52/52, contracts 16/16, P1
  PostgreSQL 6/6, P3 Identity/Care PostgreSQL 14/14, migration rollback/
  reapply/no-backfill, all builds, P1 browser 4/4, P3 mocked 6/6 plus real
  runtime 1/1, P2 mocked regressions 18/18, dependency/docs/config/secrets/log
  checks and exact cleanup. Recovery fixed the format, clean-host database
  provision/reset harness, one focus transition, bounded browser waits and
  VI/EN test selectors. A real no-header path exposed and fixed Gateway
  correlation re-resolution; its contract passes 19/19 and Care now receives
  the exact Identity-bound value. Exact feature head
  `909c64542ccd4f3db6951e737dd83ef393cdf701` then passed push run
  `30216046313` and PR run `30216124915`; PR #51 merged as
  `dev@2314ee99eec61ffa1532fead4e5bda3bc6bbae63`, post-merge run
  `30216314035` passed all three gates, and issue #9 closed completed.
- Follow-up owner and exact phase/slice: a fresh P3-S2 task freezes
  appointment/calendar semantics against the accepted time representation; it
  does not reuse P3 authority implicitly.
- Related ADR/integration/session entries: ADR-021,
  `docs/security/P3_S1_THREAT_MODEL.md`, `INT-2026-017`, KI-016/KI-019 and the
  P3-S1 session entry.

## CHG-2026-014 — Freeze finite governed appointment occurrences

- State: Integrated; exact-head and post-merge hosted validation passed
- Raised in phase/slice: `P3-S2`
- Planned baseline: an authorized member creates/updates an appointment and
  sees the confirmed result in an accessible calendar and equivalent agenda.
  Time zone, recurrence boundary, change/cancellation, reminder intent and
  conflicts were required but action authority, DST disambiguation,
  recurrence shape, mutation scope, conflict serialization and reminder
  payload were unspecified.
- Proposed/actual implementation: Identity issues fresh action-specific
  calendar/appointment decisions using the accepted P2 governed boundary.
  Care materializes 1–12 structured appointment occurrences with canonical UTC
  plus source local/IANA/offset facts, rejects DST gaps, uses explicit
  earlier/later overlap policy, serializes half-open conflicts, and supports
  optimistic/idempotent occurrence-only change/cancel with retained history.
  Notification receives only a versioned structured reminder schedule/cancel
  intent and makes no delivery claim.
- Reason/evidence: the three independent audits and bounded RFC 9557,
  PostgreSQL, Google Calendar, W3C APG and OWASP micro-cycle found that implicit
  database DST resolution, unbounded recurrence, hidden “this and following”
  series splits, membership-derived authority and free-form reminder payloads
  would make state or disclosure untruthful.
- Impact:
  - Product/UI: native VI/EN LB-015/LB-016 with one lossless calendar/agenda
    projection, explicit source/display time facts, finite recurrence and
    occurrence-only consequence, retained cancellation and durable-success-only
    change/cancel/reminder-intent copy.
  - API/events: `P3-S2-v1` action decisions, calendar/detail read, strict
    create/change/cancel commands, conflict/recovery errors and
    `care.appointment.reminder_intent.v1`.
  - Data/migration: additive Care migration 003 and Notification migration 002;
    no backfill, shared table, cross-service SQL, credential, service or engine.
  - Privacy/security: structured kind/logistics only; no title, address, URL,
    attendee, note, clinical content or arbitrary reminder audience/channel.
    Reminder event and operational telemetry are minimum and allow-listed.
  - Tests/operations: deterministic IANA/DST/recurrence/order, conflict/race/
    idempotency/atomicity, migration rollback/reapply/no-backfill,
    provider-consumer, real outbox/Notification, VI/EN browser/a11y/offline/
    recovery, log/secret/build and exact cleanup.
  - Phase order/schedule: unchanged. P3-S3, DATA-S1, P4/P5, deployment and
    release remain separate.
- Validation actual/required: focused Level A/B and exactly one local P3-S2
  Level C invocation completed. The desktop shell detached its output, so
  classified targeted continuation retained every green gate and fixed one
  migration-reapply compatibility defect, browser locator defects and two
  recovery-state UI defects. Initial hosted run `30220557513` passed P3-S2 but
  found a cumulative P2-S3 alert-focus race; the smallest shared fix passed the
  failed path 1/1 and affected static scope without repeating unchanged green
  gates. Exact head `e21334c2631f3617d79d827480be4563c34b31a2` passed push/PR
  runs `30230392943`/`30230394014`; PR #53 merged as
  `dev@142096516533aea7561b1b13a2187047dc726a71`; post-merge run
  `30230627085` and issue #10 bilingual closeout passed.
- Follow-up owner and exact phase/slice: after P3-S2 acceptance, a fresh P3-S3
  task freezes versioned care-plan review. Series-wide calendar mutation,
  external synchronization and reminder delivery require later accepted scope.
- Related ADR/integration/session entries: ADR-022,
  `docs/security/P3_S2_THREAT_MODEL.md`, future P3-S2 integration/session
  entries, KI-016 and KI-019.

## CHG-2026-015 — Freeze governed shared support-plan versions

- Raised in phase/slice: `P3-S3`
- Planned: authorized participants create/version goals, preferences,
  responsibilities and a review date with clear draft/current/history state,
  consent, concurrency and no clinical recommendation.
- Actual: `P3-S3-v1` reuses the accepted P2 household-coordination/basic-label
  grant only through a narrow action mapping. Care owns one shared draft,
  immutable confirmed versions, stored local-date/IANA UTC bounds, optimistic
  aggregate/draft/base counters, idempotent commands, sealed no-total history,
  content-free evidence and suppressed confirmation event. Gateway composes;
  Notification is not involved. Native LB-017 uses Support plan terminology.
- Reason: leaving authority reuse, draft topology, version counters, review-day
  boundaries, history inference and event disposition implicit would permit
  role-implied consent, last-write-wins, silent time movement or sensitive
  cross-service payloads.
- Impact: P3-S3 contracts, migration 004, Identity decision target set,
  Gateway/Care routes, LB-017, tests, docs and CI only. No service, engine,
  shared table, cross-service SQL, reminder, clinical scope, DATA, P4/P5,
  Spring, deployment or release change.
- Validation actual/required: three independent reviews and official-source
  micro-cycle converged; four Stitch references were generated/read back once;
  KI-019 remains because private pixels were unavailable. Exactly one local
  Level C command was invoked; after its pre-gate Docker startup interruption,
  direct classified continuations proved static, unit 57/57, contracts 24/24,
  cumulative integration/migrations, mocked LB-017 3/3, real P3-S3 1/1,
  cumulative browsers, privacy-safe logs and cleanup. Exact feature head
  `9bfd2263625e25e2f4c3bbf7b1d0257a002591c8` passed push/PR runs
  `30329456918`/`30329530973`; PR #56 merged as
  `dev@f3576f40779617f0d7bd519ac44b178ccf269e3e`; post-merge run
  `30329752886` passed and issue #11 closed with bilingual evidence.
- Follow-up: retain KI-001/KI-016/KI-019. Hand off P4-S1 only to a fresh task;
  do not start it here.

The initial research governance/register is intentionally included in the
coherent Phase 0 foundation commit because the governed branches do not exist
until this phase closes. It contains no raw dataset or product fixture. All
post-baseline research changes must start on `init/research`; this bootstrap
exception may not be reused.

When delivery starts, update each phase/slice with actual files, contracts, validation, and status. If a new phase/slice is added, state which planned item moved, why it cannot be absorbed safely, and what downstream acceptance/validation changes.

Every completed slice must also append a next-phase orientation: planned versus
actual, new evidence, new or retired dependencies, integration/MCP debt,
acceptance and validation changes, and the exact first action for the next
slice. This handoff updates the plan; it does not authorize implementing the
next slice in the same conversation.

## Historical accepted handoffs through P4-S2

P3-S1 is accepted at
`dev@2314ee99eec61ffa1532fead4e5bda3bc6bbae63`. Its frozen contracts, Care
ownership, migration 002/no-backfill, Stitch/native handoff, single Level C
plus targeted recovery, exact-head runs `30216046313`/`30216124915`, PR #51
merge, post-merge run `30216314035` and issue #9 closeout are complete.
KI-001 still blocks deployment, KI-016 retains manual assistive-technology
evidence, and KI-019 retains private-render review before any
visual-conformance claim.

P3-S2 is accepted at
`dev@142096516533aea7561b1b13a2187047dc726a71`. `P3-S2-v1`, ADR-022,
`CHG-2026-014`, the P3-S2 threat model, research record and Frozen corrected
LB-015/LB-016 handoff are implemented in native semantics. Exact head
`e21334c2631f3617d79d827480be4563c34b31a2` passed push/PR runs
`30230392943`/`30230394014`; PR #53 merged with a merge commit; post-merge
`dev` run `30230627085` passed and issue #10 closed completed. KI-001 still
blocks deployment, KI-016 retains manual assistive-technology evidence, and
KI-019 retains private-render review before any visual-conformance claim.

P3-S3 is accepted. `P3-S3-v1`, ADR-023, `CHG-2026-015`, migration 004,
threat/research records, the four-reference Frozen corrected LB-017 handoff,
native VI/EN route and cumulative tests are integrated at
`dev@f3576f40779617f0d7bd519ac44b178ccf269e3e`. Feature head `9bfd226` passed
exact-head push/PR runs `30329456918`/`30329530973`; PR #56 merged, post-merge
run `30329752886` passed, and issue #11 closed with bilingual evidence.

P4-S1 feature and docs-only closeout are accepted and merged at
`dev@efad56c5fdcdbdd701ee82344e11f18bb2f08225`. Feature commits
`9392fc570ba510f4b63c2388bee94677d637541f` and
`9a2b7fe9683f548a006c63fc673d294aedd39031` passed replacement exact-head
push/PR runs `30343304775`/`30343308183`; PR #59 merged as
`dev@d58660cebd91f46b2deab38a38e7187ec7870804`; post-merge run
`30343682227` passed all three jobs and issue #12 closed with bilingual
evidence. Docs-only PR #60 and final `dev` run `30345391688` passed.

P4-S2 is accepted at
`dev@7690a7c584891fbd2bd62de600a5b11bb58a8be7`. Feature commit
`1b28a16cd9f378de3fcc9f57f0c456b07f89b2bb` and deterministic recovery
`ea5acf761e64ac6718936e262e4b089a5e37b74c` are retained in PR #62. Exact-head
PR run `30358335589`, merge-commit promotion, post-merge run `30359250442`,
and bilingual issue #13 closeout passed. Its Care-owned aggregate, fresh P2
authority, ordered contacts, reviewed plan, minimum disclosure and bounded
encrypted offline-copy contract are the accepted boundary.

P4-S3 was subsequently accepted at
`dev@7b10d62d0cd1857e9d63e57d34bfd068040a8fd6`; its exact-purpose authority,
Care/PostgreSQL ownership, unscanned truth, active purge, Frozen native handoff,
single Level C, exact-head/post-merge CI and issue #14 closeout are complete.

## Exact next action

P7-S1 is accepted at
`dev@2eac295de1fb33232023372ae974a4ce9a9354a2`. PR #79 exact head `fea1093`
passed automatic push/PR runs `30727810915`/`30727812530`; automatic
post-merge run `30728240535` passed all eight jobs including hosted P7-S1 and
the unchanged aggregate gate. Finish only this same-task docs-only closeout and
bilingual issue #25 closure. P7-S2 may start only from a fresh controller
dispatch after closeout; P7-S3, P8, DATA-S1 and release remain out of scope.

The historical handoffs below remain evidence of their accepted slices and do
not supersede this orientation.

P5-S3 is accepted at
`dev@39e5914778f779c5e2b4b19bdb6a92fc6fdfbdde`. Feature PR #70 established the
moderation slice; post-merge run `30425583410` exposed an initialization race.
The same-task narrow correction PR #71 passed 6/6 exact-head checks, merged as
`39e5914`, and post-merge run `30426581895` passed Windows, PostgreSQL/
mixed-runtime/Chromium and the aggregate gate.

Exactly one local P5-S3 Level C was invoked and retained its PowerShell 5.1
runner failure; classified targeted recovery covered every unstarted stage and
the runner was corrected without a second Level C invocation. KI-001, KI-016
and KI-019 remain; KI-020 remains scoped to P4-S3 deployment.

No subsequent slice begins here. The controller must issue a fresh dispatch
for the next approved production-plan slice. DATA-S1, P6+, deployment, pilot
and release remain outside this task.
