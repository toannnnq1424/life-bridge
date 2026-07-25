# LifeBridge Implementation Plan

## Plan control

- Baseline ID: `PLAN-2026-07-25`
- Baseline date: 2026-07-25
- Current phase: `P0 — Foundation` (validated)
- Current scope: Phase 0 closeout only
- Next product slice after Phase 0: `P1-S1 — Accountable care-task loop`
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

| Phase                       | Objective                                                                      | Planned slices                                 | Dependencies                               | Actual status |
| --------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------ | ------------- |
| `P0` Foundation             | Reproducible, governed, secure Windows repository                              | One foundation phase with parallel workstreams | Existing repository and user-approved plan | Validated     |
| `P1` Daily task MVP         | Prove create/assign/complete/notify/dashboard end to end                       | `P1-S1`                                        | P0 gate; approved Stitch handoffs          | Planned       |
| `P2` Trust and household    | Replace fixture identity with real access, household, consent, and audit flows | `P2-S1`–`P2-S3`                                | P1 contracts and security review           | Planned       |
| `P3` Care planning          | Add handoff timeline, appointments, and care-plan coordination                 | `P3-S1`–`P3-S3`                                | P2 roles/consent                           | Planned       |
| `P4` Safety and records     | Add reminder, emergency-plan, and document flows without clinical advice       | `P4-S1`–`P4-S3`                                | P2 consent; P3 time model                  | Planned       |
| `P5` Community support      | Add consented help requests, matching, organization, and moderation            | `P5-S1`–`P5-S3`                                | P2 trust/audit; reviewed source evidence   | Planned       |
| `P6` Resilience and release | Harden offline/conflict behavior, deploy, and prepare a truthful demo/release  | `P6-S1`–`P6-S3`                                | Required prior slices                      | Planned       |

Future phases are planning commitments only. At each phase start, confirm evidence and log any accepted change before implementation.

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

## P6 — Resilience and release

### `P6-S1 — Offline, conflict, and reusable-state hardening`

Outcome: implemented core flows truthfully distinguish stale, queued, blocked, conflicted, rejected, and confirmed state while preserving safe recovery.

Screens: `LB-032`–`LB-035` across implemented routes.

Acceptance:

- each mutation declares blocked/queued behavior; no false “saved” state;
- reconnect/conflict reconciliation is deterministic and tested;
- keyboard/focus/screen-reader state transitions pass;
- 320 CSS px, zoom/reflow, reduced-motion, forced-color, long Vietnamese/English text checks pass.

Dependencies: all product flows selected for release.

### `P6-S2 — Production deployment and operations`

Outcome: the selected release scope builds, migrates, starts, reports health, backs up/restores, and runs a fixture smoke test in a reproducible production-like environment.

Acceptance:

- typed startup validation and secret injection;
- per-service migrations/credentials/health/readiness;
- production build/start, backup/restore rehearsal, fixture smoke, redacted telemetry;
- deployment and rollback documentation;
- no fixture authentication or private credential in public production.

Dependencies: accepted release scope; platform credentials require explicit user action.

### `P6-S3 — Demo, submission, and release`

Outcome: a reviewer can reproduce and watch only implemented behavior with truthful claims, disclosed limitations, and a tagged release candidate.

Acceptance:

- clean install, full CI, production build, deployment smoke and demo rehearsal pass;
- README, demo script, submission copy, known issues and release checklist match repository evidence;
- screenshots/video contain synthetic data only;
- branch promotion and PR/CI status are recorded; release tag follows acceptance.

Dependencies: `P6-S1`, `P6-S2`.

## Screen-to-phase control

| Screen IDs                                      | Planned phase                     | Notes                        |
| ----------------------------------------------- | --------------------------------- | ---------------------------- |
| `LB-011`, `LB-013`, `LB-014`, relevant `LB-019` | P1                                | First MVP only               |
| `LB-001`–`LB-010`, `LB-028`–`LB-031`            | P2                                | Trust, household, consent    |
| `LB-012`, `LB-015`–`LB-017`                     | P3                                | Planning and handoff         |
| `LB-018`, `LB-020`, `LB-021`, `LB-023`          | P4                                | Reminder, emergency, records |
| `LB-022`, `LB-024`–`LB-027`                     | P5                                | Community                    |
| `LB-032`–`LB-035`                               | Applied per slice; hardened in P6 | Cross-cutting patterns       |

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

| Change ID      | State                          | Effect on baseline                                                                   |
| -------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `CHG-2026-001` | Implemented in Phase 0         | Windows + Codex App replace legacy mixed-platform/tool delivery paths                |
| `CHG-2026-002` | Baseline implemented; lane due | Adds bilingual 2016–2026 research and `init/research → data → dev` promotion control |
| `CHG-2026-003` | Planning overlay implemented   | Adds risk-tiered research gates and runbook crosswalk without reordering P0–P6       |

The initial research governance/register is intentionally included in the
coherent Phase 0 foundation commit because the governed branches do not exist
until this phase closes. It contains no raw dataset or product fixture. All
post-baseline research changes must start on `init/research`; this bootstrap
exception may not be reused.

When delivery starts, update each phase/slice with actual files, contracts, validation, and status. If a new phase/slice is added, state which planned item moved, why it cannot be absorbed safely, and what downstream acceptance/validation changes.

## Exact next action

Open one new conversation for `P1-S1 — Accountable care-task loop`. Begin with
the P1 research gate, current task/event contract, and required Stitch handoff
for `LB-011`, `LB-013`, `LB-014`, applicable `LB-019`, and shared state
patterns. Production UI implementation remains blocked until the reviewed
Stitch handoff is frozen.

The independent research lane may instead open one separate conversation for
`research/aggregate-context-fixture` on `init/research`; do not combine it with
`P1-S1`.
