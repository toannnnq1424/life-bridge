# LifeBridge Implementation Plan

## Plan control

- Active plan ID: `PLAN-2026-07-26-PRODUCTION`
- Previous baseline: `PLAN-2026-07-25` (`P0`–`P6` compact roadmap)
- Change authority: `CHG-2026-004`
- Active plan date: 2026-07-26
- Current phase: `P0 — Foundation` (validated)
- Current scope: Phase 0 closeout only
- Next product slice after Phase 0: `P1-S1 — Accountable care-task loop`
- GitHub execution:
  [P1-S1 #5](https://github.com/toannnnq1424/life-bridge/issues/5);
  production UI gate
  [#3](https://github.com/toannnnq1424/life-bridge/issues/3); separate
  `init/research` task
  [DATA-S1 #4](https://github.com/toannnnq1424/life-bridge/issues/4)
- Integration gate:
  guarded workflow bootstrap
  [PR #41](https://github.com/toannnnq1424/life-bridge/pull/41) registered
  hosted CI on default `main`; require the full green check on the final commit
  in [PR #21](https://github.com/toannnnq1424/life-bridge/pull/21) before merge
  or P1 implementation
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

| Phase                                 | Objective                                                                      | Planned slices                                 | Dependencies                               | Actual status   |
| ------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------ | --------------- |
| `P0` Foundation                       | Reproducible, governed, secure Windows repository                              | One foundation phase with parallel workstreams | Existing repository and user-approved plan | Validated       |
| `P1` Daily task MVP                   | Prove create/assign/complete/notify/dashboard end to end                       | `P1-S1`                                        | P0 gate; issue #3 before production UI     | Ready; UI gated |
| `P2` Trust and household              | Replace fixture identity with real access, household, consent, and audit flows | `P2-S1`–`P2-S3`                                | P1 contracts and security review           | Planned         |
| `P3` Care planning                    | Add handoff timeline, appointments, and care-plan coordination                 | `P3-S1`–`P3-S3`                                | P2 roles/consent                           | Planned         |
| `P4` Safety and records               | Add reminder, emergency-plan, and document flows without clinical advice       | `P4-S1`–`P4-S3`                                | P2 consent; P3 time model                  | Planned         |
| `P5` Community support                | Add consented help requests, matching, organization, and moderation            | `P5-S1`–`P5-S3`                                | P2 trust/audit; reviewed source evidence   | Planned         |
| `P6` Microservice platform            | Prove independent runtime ownership, versioned compatibility, and isolation    | `P6-S1`–`P6-S3`                                | Accepted P1–P5 service boundaries          | Planned         |
| `P7` Data and event reliability       | Prove migrations, event recovery, backup/restore, retention, and deletion      | `P7-S1`–`P7-S3`                                | P6 contracts and service ownership         | Planned         |
| `P8` Security and privacy hardening   | Prove isolation, privacy lifecycle, abuse controls, secrets, and supply chain  | `P8-S1`–`P8-S3`                                | P2 trust; P6/P7 boundaries                 | Planned         |
| `P9` SLO, resilience, incident and DR | Prove redacted observability, SLOs, degradation, incident response, and DR     | `P9-S1`–`P9-S3`                                | Accepted release journeys                  | Planned         |
| `P10` Performance, capacity, and cost | Prove budgets, scale, backpressure, soak/spike behavior, and cost guardrails   | `P10-S1`–`P10-S3`                              | P9 telemetry and workload model            | Planned         |
| `P11` Production rollout and release  | Reproduce production, stage rollout, pilot safely, rollback, and release       | `P11-S1`–`P11-S3`                              | P6–P10 gates; zero deploy-blocking debt    | Planned         |
| `P12` Post-launch operations          | Operate, patch, recover, learn, and govern the next production roadmap         | `P12-S1`–`P12-S3`                              | Accepted P11 release                       | Planned         |

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

Validation checkpoint: Level C slice validation only. Phase-wide release validation remains deferred.

Explicitly deferred: recurrence, cancellation, attachments, real authentication, push/SMS/email delivery, automatic escalation, offline mutation queue, public deployment.

## P2 — Trust and household

### `P2-S1 — Account access and accessible onboarding`

Outcome: a user can register/sign in, complete the required factor/recovery path, choose language/accessibility preferences, and enter an authorized session without account enumeration.

Screens: `LB-001`–`LB-007`.

Acceptance:

- secure session lifecycle, rate limits, generic recovery responses, MFA/recovery handling;
- fixture login disabled in public/production configuration;
- accessibility/language preferences persist without gating access;
- denied/locked/expired/offline-safe states and audit evidence are tested;
- threat model, credential/session operations, integration/browser tests, and production build pass.

Dependencies: P1 gateway/config baseline; accepted identity architecture ADR if an external provider is introduced.

Deferred: enterprise SSO and delegated organization administration.

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
- security/privacy/integration/browser tests pass.

Dependencies: P2 consent; research source review; community service boundary.

### `P5-S2 — Volunteer match and organization coordination`

Outcome: a volunteer/coordinator accepts an approved match and records progress using only minimum necessary household data.

Screens: `LB-025`, `LB-026`.

Acceptance:

- eligibility/permission, approval/revocation, assignment, capacity and status are explicit;
- unrelated household fields are inaccessible;
- concurrent/revoked match and audit behavior are tested;
- organization-scoped contract/integration/browser/security checks pass.

Dependencies: `P5-S1`; P2 roles/audit.

### `P5-S3 — Moderation resolution`

Outcome: a scoped moderator reviews and resolves a community safety report with redacted evidence and an auditable decision.

Screen: `LB-027`.

Acceptance:

- least-privilege queue/detail access and safe destructive confirmation;
- decision reason, actor, time, result, retention and redaction are auditable;
- denied access never reveals case existence/details;
- integration/browser/security tests pass.

Dependencies: `P5-S2`; moderation policy and retention decision.

## P6 — Microservice platform and contracts

### `P6-S1 — Versioned contracts and rolling compatibility`

Outcome: the primary user journey remains correct while compatible service
versions are rolled independently.

Acceptance:

- current and previous supported API/event versions pass provider/consumer tests;
- breaking changes fail CI and deprecation/migration policy is explicit;
- the primary flow passes during a mixed-version rolling upgrade.

### `P6-S2 — Independently runnable service artifacts and ownership`

Outcome: every deployable can build, start, report health/readiness, and upgrade
without another service's source tree or datastore credential.

Acceptance:

- every deployable has an owned build/start/config/health contract and artifact;
- one service can be upgraded independently;
- no cross-service business import, table access, credential, or shared ownership
  exists; architecture fitness checks enforce the boundary.

### `P6-S3 — Authenticated service communication and dependency isolation`

Outcome: an unavailable secondary service cannot corrupt confirmed core state,
and internal calls use explicit least-privilege identities outside local mode.

Acceptance:

- service identity and transport protection are documented and tested;
- timeouts, retry, idempotency, rate, circuit/bulkhead, and payload bounds apply;
- Notification or Community failure produces truthful degradation without
  corrupting the care-task source of truth.

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

| Change ID      | State                           | Effect on baseline                                                                   |
| -------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| `CHG-2026-001` | Implemented in Phase 0          | Windows + Codex App replace legacy mixed-platform/tool delivery paths                |
| `CHG-2026-002` | Baseline implemented; lane due  | Adds bilingual 2016–2026 research and `init/research → data → dev` promotion control |
| `CHG-2026-003` | Partially superseded            | Research/runbook overlay remains; its compact P0–P6 roadmap limit is superseded      |
| `CHG-2026-004` | Implemented in docs/GitHub      | Preserves P0–P5 and expands production maturity through P6–P12                       |
| `CHG-2026-005` | Accepted; debt gate active      | Required MCP unavailable after 180 seconds becomes tracked deploy-blocking debt      |
| `CHG-2026-006` | Bounded design session complete | Authorizes one disposable non-production Stitch session; handoff remains not frozen  |
| `CHG-2026-007` | CI bootstrap implemented        | One guarded workflow-only PR registered hosted CI on default `main`                  |

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

First resolve `KI-012`, obtain a visible required hosted-CI result, and review
the exact commit in
[PR #21](https://github.com/toannnnq1424/life-bridge/pull/21). Do not merge or
write directly to `main` to bypass this bootstrap gate.

After the foundation is integrated, open one new conversation for
[`P1-S1 — Accountable care-task loop` issue #5](https://github.com/toannnnq1424/life-bridge/issues/5).
Begin with the P1 research gate, current task/event contract, and required
Stitch handoff for `LB-011`, `LB-013`, `LB-014`, applicable `LB-019`, and shared
state patterns. Production UI implementation remains blocked until
[`GATE-P1` issue #3](https://github.com/toannnnq1424/life-bridge/issues/3)
freezes the reviewed Stitch handoff.

The independent research lane may instead open one separate conversation for
[`DATA-S1` issue #4](https://github.com/toannnnq1424/life-bridge/issues/4) on
`init/research`; do not combine it with `P1-S1`.
