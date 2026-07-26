# LifeBridge Implementation Plan

## Plan control

- Active plan ID: `PLAN-2026-07-26-PRODUCTION`
- Previous baseline: `PLAN-2026-07-25` (`P0`–`P6` compact roadmap)
- Change authority: `CHG-2026-004`
- Active plan date: 2026-07-26
- Current phase: `P2 — Trust and household`
- Most recently integrated slice: `P2-S1 — Account access and accessible
onboarding`; validated and merged at `dev@e20ecdbe`
- Next eligible product slice: `P2-S2 — Household, invitation, and
care-recipient context`, only in a fresh task
- GitHub execution:
  completed [P1-S1 #5](https://github.com/toannnnq1424/life-bridge/issues/5);
  P1 design record [#3](https://github.com/toannnnq1424/life-bridge/issues/3);
  separate
  `init/research` task
  [DATA-S1 #4](https://github.com/toannnnq1424/life-bridge/issues/4)
- Integration gate: [PR #42](https://github.com/toannnnq1424/life-bridge/pull/42)
  accepted exact feature head `6ec1be3` after hosted run `30183168519`
  succeeded. Merge commit `cea4f83` is on `dev`, post-merge run `30183280672`
  succeeded, and issue #5 is closed completed.
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
| `P2` Trust and household              | Replace fixture identity with real access, household, consent, and audit flows | `P2-S1`–`P2-S3`                                | P1 contracts and security review           | Planned       |
| `P3` Care planning                    | Add handoff timeline, appointments, and care-plan coordination                 | `P3-S1`–`P3-S3`                                | P2 roles/consent                           | Planned       |
| `P4` Safety and records               | Add reminder, emergency-plan, and document flows without clinical advice       | `P4-S1`–`P4-S3`                                | P2 consent; P3 time model                  | Planned       |
| `P5` Community support                | Add consented help requests, matching, organization, and moderation            | `P5-S1`–`P5-S3`                                | P2 trust/audit; reviewed source evidence   | Planned       |
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
`dev` CI remain; P2-S3 remains unstarted.

### `P2-S3 — Consent, privacy, audit, and settings`

Outcome: an authorized care recipient/account owner can review, grant/narrow/revoke sharing, adjust privacy/settings, and inspect redacted access history.

Screens: `LB-028`–`LB-031`.

Acceptance:

- the effect, recipient, data scope, and effective time are shown before a consent change;
- revocation blocks new access and creates audit evidence;
- audit read model is redaction-aware and cannot grant access;
- export/irreversible actions are explicitly bounded or deferred;
- permission, conflict, partial-save, offline-safe, integration/browser/security tests pass.

Dependencies: `P2-S2`; versioned consent/audit events.

Deferred: regulatory export automation and enterprise policy packs.

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

### `P3-S2 — Calendar and appointment coordination`

Outcome: an authorized member creates/updates an appointment and sees it in an accessible calendar and equivalent agenda.

Screens: `LB-015`, `LB-016`.

Acceptance:

- time zone, recurrence boundary, change/cancellation, reminder intent, and conflicts are explicit;
- agenda is fully keyboard operable and contains all critical calendar information;
- stale-write, denied, unavailable, and deterministic time tests pass.

Dependencies: `P3-S1`; shared versioned time contract.

### `P3-S3 — Care-plan review`

Outcome: authorized participants create/version a care plan with goals, preferences, responsibilities, and review date without clinical recommendations.

Screen: `LB-017`.

Acceptance:

- draft/current/version/review state is clear;
- consent and concurrent edits are enforced;
- product copy avoids diagnosis/treatment advice;
- history, integration, browser, accessibility, and security tests pass.

Dependencies: P2 consent; P3 timeline/time contracts.

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

### `P4-S3 — Access-controlled document vault`

Outcome: an authorized user uploads, lists, retrieves, and removes a permitted synthetic document with retention/access feedback.

Screen: `LB-023`.

Acceptance:

- type/size validation, malware-processing state, retention, access and deletion are explicit;
- object bytes and metadata have one documented owner and authorization path;
- generated/external files are never executed;
- denied, failed processing, unavailable, audit, backup/restore and browser tests pass.

Dependencies: P2 consent/audit; accepted polyglot/object-storage ADR before adding an engine.

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

Outcome: the primary user journey remains correct while compatible service
versions are rolled independently.

Acceptance:

- current and previous supported API/event versions pass provider/consumer tests;
- breaking changes fail CI and deprecation/migration policy is explicit;
- the primary flow passes during a mixed Node/Spring version rolling upgrade;
- Gateway/Community compatibility is proven from language-neutral contracts,
  not shared generated business code.

### `P6-S2 — Independently runnable service artifacts and ownership`

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

Acceptance:

- `N-1 -> N` schema evolution works with mixed runtime versions;
- migrations are owner-scoped, repeat-safe, observable, and forward-compatible;
- rollback uses an evidenced roll-forward or compensation plan.

### `P7-S2 — Durable event replay, reconciliation, and dead-letter recovery`

Outcome: an operator recovers delayed or poison events without losing or
duplicating the business result.

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

## P8 — Security, privacy, abuse, and supply-chain hardening

### `P8-S1 — Household isolation and consent enforcement`

Outcome: an authorized user can access only the accepted household/resource
scope, while denied users cannot enumerate protected records.

Acceptance:

- authorization matrix and cross-household isolation tests pass;
- consent revocation changes subsequent access deterministically;
- privileged operations are least-privilege and auditable.

### `P8-S2 — Secrets, encryption, runtime, and supply-chain hardening`

Outcome: an operator rotates secrets and deploys traceable artifacts without
placing long-lived credentials in source or logs.

Acceptance:

- secret rotation and encryption-boundary drills pass;
- least-privilege runtime, SBOM, artifact provenance, dependency/container scans,
  and exception ownership are evidenced;
- debug/local credentials cannot enter production builds.

### `P8-S3 — Abuse safeguards, privacy lifecycle, and security response`

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

- State: Accepted architecture direction; implementation deferred to P5-S1
- Raised in phase/slice: governance-only amendment during `P2-S1`
- Planned baseline: Community was a future independently deployable service,
  while the repository operating baseline described a practical TypeScript
  monorepo and did not require a second backend runtime.
- Proposed/actual implementation: LifeBridge is a polyglot microservice system.
  The first Spring Boot service is the greenfield Community boundary beginning
  at P5-S1/issue #15 and extended through P5-S2/P5-S3. Existing Gateway,
  Identity & Consent, Care Coordination and Notification remain Node services;
  no rewrite is authorized. No Java source, wrapper or toolchain is added now.
- Reason/evidence: the project owner requires at least one bounded Spring Boot
  backend. Community is future, cohesive and independently owned, so it proves
  cross-runtime contracts without destabilizing accepted P1/P2 boundaries.
- Impact:
  - Product/UI: P2 scope/order and `MCP-DEBT-2026-002` are unchanged; no P5
    behavior or screen begins in this task.
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
  - Tests/operations: the P5 research gate must verify official supported JDK,
    Spring Boot, Maven plugin and checksum sources, then pin a repository-owned
    Windows wrapper, preferably `mvnw.cmd`. P6 must prove mixed-version
    compatibility, independent artifact/upgrade, dependency isolation,
    health/readiness, observability, SBOM/supply-chain, container and rollback.
  - Phase order/schedule: unchanged; P5 and P6 remain planned behind P2–P4.
- Validation required: changed-document format/config/docs/secrets/diff now;
  official dependency/toolchain research and provider/consumer/build/container
  evidence only when P5-S1 begins; cumulative mixed-runtime proof in P6.
- Follow-up owner and exact phase/slice: P5-S1 owner updates existing issue #15,
  runs the official-source research gate, freezes exact toolchain and contract
  pins, then implements Community. P5-S2/P5-S3 extend it; P6 owns platform-wide
  compatibility and operations proof.
- Related ADR/integration/session entries: ADR-019, `INT-2026-013`, issue #15,
  and the P2-S1 governance amendment session entry.

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

## Exact next action

P2-S1 promotion is complete: PR #44 merged as `0cb14e2`, its exact-head and
post-merge hosted runs passed, issue #6 is closed, and PR #45 merged the
canonical closeout as `dev@e20ecdbe`. The final post-merge run `30191971782`
passed. `MCP-DEBT-2026-002`/KI-017 is resolved; KI-016 keeps manual
assistive-technology evidence honestly deferred before pilot/release.

The exact next action is a fresh P2-S2 task from integrated `dev`: freeze the
household creation, invitation lifecycle, care-recipient context,
authorization/consent and anti-enumeration contracts for `LB-008`–`LB-010`
before implementation. DATA-S1 and P5 remain separate and unstarted.
