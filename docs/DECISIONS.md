# LifeBridge Architecture and Product Decisions

## ADR policy

Use an ADR for durable product, architecture, data, security, integration, or operating-policy decisions—not trivial code details. Preserve planned versus actual. A changed decision is superseded by a new ADR and linked Change ID; do not rewrite history.

## ADR-001 — Windows and Codex desktop are the supported workflow

- Status: Accepted
- Date: 2026-07-25
- Change ID: `CHG-2026-001`
- Context: Repository guidance contained irrelevant cross-platform/tool references, while the actual project is operated on Windows through Codex in the ChatGPT desktop app. PowerShell blocks some `*.ps1` package shims.
- Decision: Support Windows and Codex desktop only. Use PowerShell 5.1-compatible scripts and `npm.cmd`/`npx.cmd`/`pnpm.cmd`. Do not change machine-wide Execution Policy or automatically edit Windows/Docker system configuration.
- Alternatives considered: split-platform ownership; tool-specific secondary orchestration; changing Execution Policy; automatic Administrator repair.
- Consequences: Setup and doctor must be safe/idempotent and report environment issues. Other platforms may work but are not validated or documented as supported.
- Planned baseline: Phase 0 establishes the Windows workflow.
- Actual: Policy is recorded; command/runtime evidence belongs in Phase 0 validation.

## ADR-002 — Build one accountable care-task vertical slice first

- Status: Accepted
- Date: 2026-07-25
- Context: The 35-screen backlog is too broad for a reliable first delivery.
- Decision: `P1-S1` is create task, assign member, complete task, emit exactly one persistent notification, and show confirmed dashboard/task-board state with errors and end-to-end tests.
- Alternatives considered: backend-first construction; all dashboard screens; authentication-first public product; broad CRUD scaffold.
- Consequences: Phase 1 uses synthetic local fixture identity and only the required screen states. Fixture authentication cannot be publicly deployed. Later screens remain governed backlog.
- Planned baseline: One product slice after Phase 0.
- Actual: Product code is not implemented at the Phase 0 baseline.

## ADR-003 — Practical TypeScript microservice monorepo

- Status: Accepted
- Date: 2026-07-25
- Context: LifeBridge needs service ownership and independent evolution without excessive initial repository/operational overhead.
- Decision: Use Node.js 22.x, pnpm 11.9.0, TypeScript, Next.js/React web, Fastify gateway/services, Zod/OpenAPI contracts, Vitest and Playwright in one monorepo. Deployable services remain independently runnable.
- Alternatives considered: one undifferentiated monolith; one repository per service; multiple backend languages in Phase 1.
- Consequences: Shared tooling/contracts are efficient, but shared packages cannot become shared business ownership. Service boundaries require fitness checks.
- Planned baseline: Web, gateway, Identity/Consent, Care Coordination, Notification, later Community.
- Actual: Foundation tooling is being established; runtime services are not yet implemented.

## ADR-004 — Service-owned PostgreSQL by default; polyglot only by evidence

- Status: Accepted
- Date: 2026-07-25
- Context: Microservices need data autonomy, while one datastore per workload would add avoidable operating cost.
- Decision: Default to PostgreSQL with a distinct database/schema and credential owned by each service. Prohibit cross-service table writes, joins, foreign keys, and shared ownership. Permit a new engine only through an ADR covering objective/access pattern, owner, source of truth/consistency, backup/restore, retention/deletion, migration/rollback, cost/operations, security, and failure modes.
- Alternatives considered: shared application database; mandatory polyglot persistence; separate PostgreSQL server for every service from day one.
- Consequences: A local shared PostgreSQL server is allowed only with logical/credential isolation. Object storage, a search index, or Redis remain examples, not approved implementations; Redis can never be authoritative.
- Planned baseline: Coordination, Notification, and later service stores use owned PostgreSQL boundaries.
- Actual: No service datastore is provisioned yet.

## ADR-005 — Transactional outbox and idempotent notification delivery

- Status: Accepted
- Date: 2026-07-25
- Context: Task completion must remain durable when Notification is unavailable, without a cross-service database transaction.
- Decision: Care Coordination commits state and an owned outbox event atomically. Its dispatcher delivers a versioned event through an internal contract. Notification persists inbox/deduplication and its notification atomically. UI distinguishes completed work from pending/failed delivery.
- Alternatives considered: dual database writes; Notification reading Coordination tables; synchronous rollback on notification failure; introducing a broker immediately.
- Consequences: Eventual consistency is visible and retryable. An external broker may be adopted later only with evidence/ADR while preserving event semantics.
- Planned baseline: Implement in `P1-S1`.
- Actual: Not implemented.

## ADR-006 — Google Stitch MCP is a gated design input

- Status: Accepted
- Date: 2026-07-25
- Change ID: `CHG-2026-001`
- Context: UI must be designed through Google Stitch MCP, but generated artifacts and external credentials create privacy, security, accessibility, and provenance risks.
- Decision: Require product/flow contracts, Stitch concept, accessibility/privacy/security/implementation review, and frozen Git handoff before production UI. Treat output as untrusted; never copy generated scripts/business logic or send secrets/real care data. Write/cost-bearing calls require explicit approval.
- Alternatives considered: direct generated-code import; local-only design without Stitch; unrestricted auto-approval.
- Consequences: UI work can be gated by credential/canary status. Non-UI contract work and local handoff preparation may continue without falsely claiming design approval.
- Planned baseline: `P1-S1` handoffs cover Dashboard, Task Board, Task Detail, notification/state patterns.
- Actual: Design governance exists; those production handoffs are not frozen.

## ADR-007 — Controlled branch promotion

- Status: Accepted
- Date: 2026-07-25
- Change ID: `CHG-2026-002`
- Context: The user requires distinct research, data, development, test, and release stages and explicitly rejects new `codex/*` work branches.
- Decision: Promote `init/research -> data -> dev -> test -> main`; merge `phase/* -> dev`. `/init` is invalid and is replaced with valid `init/research`. Use conventional commits and protected long-lived branches.
- Alternatives considered: GitHub Flow directly to main; `codex/*`; an invalid `/init`; committing directly to data/dev/test.
- Consequences: Research/data and code have explicit review gates. Integration log must record promotions. No force-push or automatic branch deletion.
- Planned baseline: Phase 0 documents and validates workflow; branch creation/push depends on Git/remote state.
- Actual: Current branch evidence is recorded in session/integration logs, not assumed here.

## ADR-008 — Evidence window and bilingual data governance

- Status: Accepted
- Date: 2026-07-25
- Change ID: `CHG-2026-002`
- Context: Product language and scenarios should reflect recent, reviewable real-world evidence without importing sensitive datasets.
- Decision: Review 2016–2026 evidence, prioritize 2021–2026, and require rationale for older baselines/standards. Register provenance, geography, year, retrieval date, terms, intended use, limitations, sensitivity, freshness, and fixture/background class. Maintain Vietnamese/English glossary and data guidance. Commit only synthetic or safely de-identified fixtures.
- Alternatives considered: unrestricted web facts; latest-year-only evidence; copying public microdata into Git; English-only terminology.
- Consequences: Numerical claims require registered sources. Research may shape requirements but cannot infer medical risk. Source freshness is reviewable.
- Planned baseline: Established on `init/research`, reviewed into `data`.
- Actual: Phase 0 research artifacts are being established.

## ADR-009 — Documentation is persistent memory with explicit change control

- Status: Accepted
- Date: 2026-07-25
- Context: Long-running work across Codex conversations loses context if decisions and deviations remain only in chat.
- Decision: One conversation owns one phase/slice. Repository map prevents repeated rescans. Each roadmap deviation records a Change ID, planned baseline, proposed/actual state, reason/evidence, impacts, validation, follow-up, and status across plan/board/decision/integration/session documents as applicable.
- Alternatives considered: chat-only coordination; rewriting plans to current state; one conversation for many slices.
- Consequences: Documentation updates are part of Definition of Done. Historical plan and actual outcome remain auditable.
- Planned baseline: Effective from Phase 0.
- Actual: Core Phase 0 documents implement the policy; future sessions must supply execution evidence.

## ADR-010 — Token-efficient validation levels

- Status: Accepted
- Date: 2026-07-25
- Context: Full-suite runs after every edit waste time/tokens and obscure local failure diagnosis.
- Decision: Use changed-file/static checks for coherent edits, reproducing tests for bugs, affected integration/build tests at slice completion, and full repository validation only at phase/merge/release checkpoints. Classify failures before editing and do not rerun unchanged successful commands.
- Alternatives considered: full suite after every file; manual-only verification; no phase-level regression.
- Consequences: Session logs must record performed/deferred validation. A completed slice still requires its full Level C evidence; Phase 0 uses `pnpm.cmd validate:phase0`.
- Planned baseline: Effective from Phase 0.
- Actual: Commands and evidence are recorded by each session; no result is claimed in this ADR.

## ADR-011 — Risk-tiered research gates overlay the compact roadmap

- Status: Partially Superseded by ADR-012; research controls remain Accepted
- Date: 2026-07-26
- Change ID: `CHG-2026-003`
- Context: The supplied 4.9 MB execution runbook contains useful research,
  accessibility, safety, operations, and decomposition detail, but its 16-phase
  order delays the first complete task loop, repeats generic checklists, and
  reports a stale P0 state.
- Decision: Keep the then-validated P0–P6 roadmap and adopt a compact overlay:
  phase research gate, slice research micro-cycle, evidence-to-action
  traceability, assumption register, trigger-based source review, shared
  slice-filtered risk catalog, and roadmap crosswalk. Treat runbook source rows
  as candidates until independently verified.
- Alternatives considered: replace the roadmap with P0–P15; copy the monolithic
  file into Git; ignore the runbook; create every detailed work package as a
  vertical slice.
- Consequences: Future work gets stronger evidence and risk controls without
  losing the early end-to-end demo. Each phase/slice must explicitly record gate
  state and assumptions. Detailed work packages split a slice only through
  Change Control and only if each split remains user-visible end to end.
- Planned baseline: P0–P6 with `P1-S1` as the exact next product slice.
- Actual: New protocol, crosswalk, assumption, and GitHub issue-plan documents
  implement the overlay. `CHG-2026-004`/ADR-012 later supersede only the P0–P6
  roadmap limit; the research and risk controls remain active through P12.
- Evidence IDs: external runbook hash in `docs/RUNBOOK_ADOPTION.md`;
  `CHG-2026-003`.
- Limitations: The external source list and its “checked” dates were not adopted
  as verified evidence. Legal, safety, market, and tool claims still require
  targeted primary review.
- Review trigger: evidence forces a slice reorder/split, the runbook hash
  changes, or the accepted release scope changes.

## ADR-012 — Production readiness is cumulative and staged through P12

- Status: Accepted
- Date: 2026-07-26
- Change ID: `CHG-2026-004`
- Context: The compact roadmap placed microservice hardening, offline/conflict
  behavior, deployment, operations, and release into one P6. That can produce a
  strong demo but cannot provide enough independent evidence for a
  production-quality microservice system.
- Decision: Preserve validated P0, exact P1-S1, and P2–P5. Split the former P6
  responsibility into P6 contracts/platform, P7 data/event reliability, P8
  security/privacy, P9 SLO/resilience/incident/DR, P10
  performance/capacity/cost, P11 production rollout/release, and P12
  post-launch operations. Applicable production controls remain part of every
  earlier slice Definition of Done; later phases verify them across the frozen
  release scope.
- Alternatives considered: keep one overloaded P6; replace the roadmap with
  the supplied 85 work packages; call the end-to-end MVP production-ready;
  implement platform components before any user-visible slice.
- Consequences: The project keeps early vertical value while gaining explicit
  rolling-compatibility, recovery, security, SLO, capacity, rollout, and
  operations gates. The roadmap is longer, and P11 cannot deploy merely because
  a demo passes.
- Planned baseline: `PLAN-2026-07-25` P0–P6 compact roadmap.
- Actual implementation/evidence: `PLAN-2026-07-26-PRODUCTION` is accepted;
  P0–P5 are unchanged and P6–P12 remain planned.
- Validation and follow-up: sync GitHub milestones/issues and verify cross-doc
  consistency; implementation still begins with exact P1-S1 after P0 CI closes.

## ADR-013 — Required MCP absence is deploy-blocking integration debt

- Status: Accepted
- Date: 2026-07-26
- Change ID: `CHG-2026-005`
- Context: External MCP availability can block a dependent slice while other
  contracts, research, or backend work remain safe. Waiting indefinitely loses
  momentum; bypassing the integration or persisting a disclosed credential
  creates hidden risk.
- Decision: When an accepted slice requires an MCP, request the exact safe
  integration once. If it is not callable within 180 seconds, record stable
  `MCP-DEBT-*` debt and continue only independent truthful work. Required MCP
  debt blocks dependent acceptance and all P11 public deployment/release until
  least-privilege credential handling, schema/side-effect/data-egress review,
  and a synthetic canary pass.
- Alternatives considered: wait indefinitely; remove the requirement; hardcode
  a development key; treat tool installation as informal backlog; auto-close
  debt when a connector appears.
- Consequences: Progress continues without hiding blocked acceptance. GitHub,
  known-issue, integration, and session state must agree. Keys disclosed in
  chat remain unusable regardless of environment tier.
- Planned baseline: external gates tracked without a universal timer/debt type.
- Actual implementation/evidence: Stitch remains `MCP-DEBT-2026-001`; the
  official canary, schema review, and bounded design generation passed under
  `CHG-2026-006`, while the committed config remains secret-free/disabled. The
  P1 handoff is Design review—not Frozen—and provider retirement/usage review
  is not confirmed.
- Validation and follow-up: keep GitHub issue #3 and standing P11 gate #40 open
  until the handoff/dependent acceptance and credential-retirement evidence are
  complete, or an accepted Change ID removes the dependency.

## ADR-014 — Disposable Stitch key may be used only for the bounded P1 handoff

- Status: Accepted one-time exception
- Date: 2026-07-26
- Change ID: `CHG-2026-006`
- Context: The owner supplied and explicitly authorized a non-production
  disposable key through chat so mandatory Stitch-originated P1 UI work could
  proceed, and clarified that it must not survive into Git or deployment.
- Decision: Use the key only in process memory against the official Stitch MCP
  endpoint for schema discovery and one private synthetic LifeBridge design
  project. Never persist, echo, hand off, or commit it. Stop using it before
  diff/commit review, scan repository/history, and require provider-side
  retirement before deployment.
- Alternatives considered: reject all use; persist it in Codex configuration;
  skip Stitch; defer all P1 UI.
- Consequences: The P1 design gate can progress without repository credential
  material. The key remains unsuitable for production or future unbounded use,
  and Stitch artifacts remain untrusted until reviewed/frozen.
- Planned baseline: chat-disclosed credentials were rejected from every call.
- Actual implementation/evidence: official stateless MCP handshake, complete
  tool-schema review, synthetic listing canary, and bounded generation/review
  passed for `LB-011`, `LB-013`, `LB-014`, applicable `LB-019`, and mobile
  variants. The redacted handoff is Design review—not Frozen; no generated code
  or private remote identifier entered the repository.
- Validation and follow-up: complete the correction list, repository-owned
  contracts, localization, and manual accessibility/privacy/security review in
  P1-S1 before freeze. Retire the key and review usage before deployment.

## ADR-015 — Default-branch CI discovery receives one guarded bootstrap PR

- Status: Accepted and implemented
- Date: 2026-07-26
- Change ID: `CHG-2026-007`
- Context: Actions was enabled, the workflow existed on `dev` and the Phase 0
  branch, but GitHub registered zero workflows and close/reopen of PR #21 still
  produced no run because default `main` contained only the initial README.
- Decision: Merge a one-file, short-lived bootstrap PR #41 into `main`. The
  workflow allows only the resulting `push` to README-only `main` to omit
  package validation; a pull request missing the Phase 0 baseline fails.
- Alternatives considered: direct push; empty commit; merge PR #21 without CI;
  promote the foundation directly to `main`; leave CI permanently local-only.
- Consequences: GitHub registers the workflow without accepting product code or
  changing the release sequence. Bootstrap branch failures demonstrate the
  guard is fail-closed outside the exact main push; the final PR #21 commit must
  still pass the complete Windows job.
- Planned baseline: `test -> main` is the only normal release promotion.
- Actual implementation/evidence: PR #41 merged one workflow file with a merge
  commit; the workflow became active and reopening PR #21 created a hosted run.
- Validation and follow-up: require the final PR #21 head check to pass, then
  merge only to `dev`; never reuse this exception for application content.

## ADR-016 — Completion notifies the accountable creator, not the completer

- Status: Accepted
- Date: 2026-07-26
- Change ID: `CHG-2026-008`
- Context: The Phase 0 draft listed task-created, assigned, and completed events
  without fixing which one produced issue #5's exactly-one notification or
  naming a useful recipient. A default completion-to-assignee policy would
  notify the actor about their own action.
- Decision: P1 create/assign is one command and produces no notification.
  Authorized completion atomically appends one `care.task.completed.v1` outbox
  event. Care Coordination resolves `notify_creator_if_other_actor`: deliver to
  the creator/coordinator when different from the completer, otherwise emit a
  `suppress_self` disposition. Notification durably inbox-deduplicates both and
  creates no row for suppression. The primary deterministic fixture is Lan
  creator/coordinator and Minh assignee/completer.
- Alternatives considered: notify the assignee on assignment; notify the
  assignee on their own completion; broadcast to the household; create
  notifications for both creation and completion; omit the outbox for
  self-completion.
- Consequences: The primary two-actor journey creates one useful persistent
  cross-user signal and duplicate completion/event delivery remains harmless.
  A legitimate self-completion creates one task transition, outbox, and durable
  suppression result but zero notification rows. Care owns pending/retry/failed
  delivery intent; Notification owns inbox and stored items. P2 must version
  this policy before real membership, revocation, or preferences replace the
  immutable fixture.
- Planned baseline: P1-S1 exactly one persistent notification after the
  accountable completion loop; recipient unspecified.
- Actual implementation/evidence: `P1-S1-v1` contracts and data ownership freeze
  the audience and minimum event payload. Runtime/test evidence is due in the
  P1-S1 session record.
- Validation and follow-up: contract, concurrency, duplicate/redelivery,
  self-suppression, recipient-scope, notification-outage, safe-log, VI/EN
  browser, and exact-head hosted CI tests. Revisit only in P2 or a separately
  accepted notification-audience slice.

## ADR-017 — Exclude unused Sharp and narrowly patch Next's PostCSS edge

- Status: Accepted
- Date: 2026-07-26
- Change ID: `CHG-2026-009`
- Context: the P1 candidate dependency audit found reviewed high advisories
  [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj)
  in Next 16.2.11's optional Sharp 0.34.5 and
  [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)
  in required PostCSS 8.4.31. Sharp is patched only from 0.35.0, outside Next
  16.2.11/16.2.12's declared `^0.34.5`; PostCSS is fully patched from 8.5.18
  and has no patched 8.4 line. pnpm's official project settings document both
  [skipping an optional dependency and parent-scoped overrides](https://pnpm.io/settings).
- Decision: do not enable or force-upgrade Sharp. Exclude that unused optional
  dependency with project-local pnpm `ignoredOptionalDependencies` and retain
  `allowBuilds.sharp: false`. Scope the PostCSS 8.5.18 override to the single
  `next@16.2.11>postcss` edge. Keep Next 16.2.11 because 16.2.12 declares the
  same vulnerable edges and is inside the 24-hour release-age quarantine.
- Alternatives considered: audit-ignore; globally enable scripts; force Sharp
  0.35 outside Next's range; accept vulnerable optional code; upgrade to the
  too-new Next patch with no dependency fix; broad PostCSS override.
- Consequences: the P1 lock/install graph contains no Sharp package and only
  the Next PostCSS edge changes. Image optimization remains unavailable by
  design. A later accepted image feature must select a Next-supported patched
  path; a natively patched Next upgrade should retire the PostCSS override.
- Planned baseline: production Next build under deny-by-default lifecycle
  policy with only demonstrably required native build tooling enabled.
- Actual implementation/evidence: frozen pnpm install passes the supply-chain
  age policy, dependency audit reports no known vulnerabilities, lifecycle
  report keeps Sharp denied, no P1 source imports `next/image`/Sharp, production
  build/runtime passes, and all four Playwright cases pass.
- Validation and follow-up: final P1 Level C plus exact-head hosted CI remain
  required. Reopen KI-015 before any `next/image` or server image processing.

## ADR-018 — Own first-party account sessions without granting household access

- Status: Accepted for P2-S1 contracts/backend; production UI remains blocked
- Date: 2026-07-26
- Change ID: `CHG-2026-010`
- Context: P2-S1 must replace fixture login with registration, required factor,
  recovery, preferences, and a secure authorized session. The baseline did not
  choose an external provider, login identifier, recovery proof, session model,
  or boundary between account access and P2-S2 household membership. Stitch is
  unavailable for the seven P2 screens after the governed 180-second gate.
- Decision: Add a first-party Identity & Consent service with an independently
  owned PostgreSQL database on the existing engine. Use a non-email login name,
  Argon2id password plus required standards-based TOTP, saved one-time recovery
  codes, opaque server-side cookie sessions, synchronizer CSRF tokens, exact
  origin/Fetch Metadata checks, atomic PostgreSQL rate limits, and minimum-data
  VI/EN/accessibility preferences. Password recovery requires TOTP plus one
  recovery code; factor recovery requires password plus one recovery code and
  re-enrollment. No external IdP, email/SMS provider, JWT, Redis, broker, or new
  persistence engine is introduced. The session is account-scoped and grants
  no household capability before P2-S2.
- Alternatives considered: external identity provider; email/SMS recovery;
  JWT/localStorage sessions; fixture identity as public auth; password-only;
  recovery questions; automatic recovery after total factor loss; starting
  production UI without a P2 Stitch reference.
- Consequences: the service owns credential/session complexity and requires
  carefully reviewed maintained crypto/TOTP libraries plus Windows/Ubuntu
  supply-chain evidence. A user who loses all factors and recovery codes cannot
  self-recover in this slice. TOTP is not phishing-resistant; passkeys remain a
  later separately accepted option. Local wireframes and backend work may
  proceed, but `MCP-DEBT-2026-002` blocks production UI, full P2-S1 acceptance,
  merge as completed work, and deployment.
- Planned baseline: P2-S1 required real account/session/MFA/recovery and an ADR
  only if an external provider was selected; P2-S2 separately owned household
  invitations and roles.
- Actual implementation/evidence: the frozen contract and threat model are in
  `docs/security/P2_S1_THREAT_MODEL.md`; local wireframes and MCP debt are in
  `docs/design/reviews/P2_S1_LOCAL_WIREFRAME.md`. Runtime evidence is due after
  implementation and no UI/design acceptance is claimed.
- Validation and follow-up: package-scoped Level A and targeted Level B may run
  for backend work. The one full `pnpm.cmd run validate:p2-s1` Level C campaign
  waits for seven Frozen handoffs and production frontend/browser coverage.
  P2-S2 remains exact next only after P2-S1 is fully accepted.

## ADR-019 — Introduce Spring Boot at the greenfield Community boundary

- Status: Accepted architecture direction; implementation deferred to P5-S1
- Date: 2026-07-26
- Change ID: `CHG-2026-011`
- Context: LifeBridge must demonstrate a bounded Spring Boot backend without
  rewriting accepted Node.js Gateway, Identity & Consent, Care Coordination or
  Notification services merely for language diversity. Community begins later
  at P5 and already has cohesive directory, request, matching and moderation
  ownership.
- Decision: Treat LifeBridge as a polyglot microservice system. Implement the
  greenfield Community service in Spring Boot beginning at P5-S1/issue #15 and
  extend the same boundary through P5-S2/P5-S3. Community owns its PostgreSQL
  database/role/migrations, transactional outbox and audit. Node Gateway and
  Spring Community integrate only through versioned language-neutral
  OpenAPI/JSON Schema contracts with provider/consumer tests. Identity &
  Consent remains the authority; only authorized minimum context enters
  Community. Start search on PostgreSQL. Require a later ADR and measured
  access-pattern evidence before Elasticsearch, Redis, a broker, object
  storage or another engine.
- Alternatives considered: rewrite an accepted Node service in Java; create an
  artificial Spring facade; split Community across Node and Spring; share
  schemas, credentials or SQL; select an additional engine before evidence;
  guess current JDK/Spring/Maven versions during P2.
- Consequences: Community provides a real bounded cross-runtime proof without
  destabilizing P1/P2. Its P5 research gate must verify official sources and
  pin the supported JDK distribution/version, Spring Boot version, Maven
  plugins, checksums and repository-owned Windows wrapper, preferably
  `mvnw.cmd`. No Java file, toolchain or implementation exists yet. P6 must
  validate mixed-version compatibility, independent artifact/upgrade,
  dependency isolation, health/readiness, observability, SBOM/supply-chain,
  container and rollback across Node and Spring.
- Planned baseline: Community was a later service in a practical TypeScript
  monorepo; P5 product order and P6 platform proof were already planned.
- Actual implementation/evidence: governance documents and existing issue #15
  record the accepted direction only. P2 scope/order and
  `MCP-DEBT-2026-002` remain unchanged; P5 and Java implementation have not
  started.
- Validation and follow-up: run changed-doc format/config/docs/secrets/diff and
  exact-head hosted CI for this governance amendment. At P5-S1, run the
  official-source toolchain research gate before creating `mvnw.cmd`, Java
  sources, pins or containers; extend the boundary through P5-S3 and execute
  the cumulative mixed-runtime proof in P6.

## ADR-020 — Require explicit self-established consent authority

- Status: Accepted for P2-S3; local validation passed, promotion pending
- Date: 2026-07-26
- Change ID: `CHG-2026-012`
- Context: P2-S2 proves account authentication, household membership,
  organizer capability and a minimum recipient context, but none of those
  proves that an account may consent for the care recipient. P2-S3 must allow
  useful grant/narrow/revoke behavior without silently converting household
  administration into consent authority or adding an unverified legal proxy
  model.
- Decision: keep consent inside Identity & Consent and its owned PostgreSQL
  database. Permit only the active member who originally created an eligible
  recipient context to explicitly bind their own account as that context's
  subject when no subject exists. The bound subject alone may grant, strictly
  narrow, revoke and inspect that subject's redacted history. Organizer and
  membership roles never imply this authority. Delegation, guardianship,
  proxy proof and authority transfer are not implemented. Governed recipient
  reads require either the subject or an active exact-scope grant evaluated at
  the server UTC decision instant.
- Alternatives considered: organizer-as-consenter; any member self-binding;
  automatic creator backfill; delegated/proxy authority without evidence;
  shared household consent; a new consent service/database; client-only
  enforcement.
- Consequences: existing P2-S2 contexts receive no automatic consent subject,
  so no migration broadens access. A non-creator care recipient needs a future
  verified authority/transfer path. Grant/narrow/revoke and their outbox,
  audit and idempotency evidence commit atomically. Revocation denies new
  governed reads at its effective boundary; redacted history remains under the
  documented 90-day boundary. Errors are generic for inaccessible resources
  and audit pages expose no totals.
- Planned baseline: P2-S3 required an authorized care recipient/account owner
  and versioned consent changes but left establishment and delegation
  undefined.
- Actual implementation/evidence: `P2-S3-v1` contracts, migration 003,
  `ConsentService`, Gateway/native UI, the Frozen corrected handoff and
  `docs/security/P2_S3_THREAT_MODEL.md` implement this narrow proof. No new
  service, engine, cross-service SQL, credential or imported Stitch source is
  present.
- Validation and follow-up: the one local Level C invocation plus targeted
  P2-S1 Level B recovery passed; exact-head hosted CI, merge commit, post-merge
  `dev` CI and issue #8 closure remain required.
  Manual assistive-technology evidence and independent visual inspection of
  the private generated renders remain explicit limitations. Any delegation
  or subject-transfer model requires a separate accepted policy, proof model,
  threat review and migration.

## ADR-021 — Keep governed timeline and handoff in Care Coordination

- Status: Accepted for P3-S1 candidate; promotion pending
- Date: 2026-07-26
- Change ID: `CHG-2026-013`
- Context: P3-S1 must expose an accountable daily chronology and change task
  assignment without letting the browser, Gateway, membership role, stale
  consent event, or another service become authority. Local dates cross DST
  and concurrent events can share UTC timestamps.
- Decision: Identity & Consent remains the only P2 governed-access authority
  and issues a fresh purpose/request-digest-scoped decision. Gateway composes
  only. Extend the existing Care service and owned PostgreSQL with additive
  timeline/handoff tables. Care independently validates task scope, assignee,
  open state and version, and atomically updates assignment plus handoff,
  timeline, audit, outbox and digest-only replay evidence. Use server UTC,
  validated IANA display zones, PostgreSQL local-day boundaries, stable
  `(occurred_at, event_ref)` order, snapshot sequence and sealed keyset
  cursors without totals. Accept enumerated handoff reason only.
- Alternatives considered: browser-selected authority; organizer-as-authority;
  Gateway-generated timeline; events as authorization cache; cross-service
  SQL; a new timeline service/database; offset-only zones; count pagination;
  free-form handoff notes; offline mutation queue; historical backfill.
- Consequences: pre-P3 history is explicitly incomplete rather than invented.
  A handoff can target only currently governed actors and only the current
  assignee can initiate it. Notification is truthful but separately delivered.
  Cursor pages expire and must be reloaded after consent/privacy version
  change. Later calendar work may reuse the time representation only through a
  separately frozen P3-S2 contract.
- Planned baseline: P3-S1 named timeline ordering, time zone, ownership and
  concurrency but did not freeze decision freshness, snapshot/cursor binding,
  no-total inference control, no-backfill or structured context.
- Actual implementation/evidence: `P3-S1-v1` schemas and docs, Care migration
  002 and coordination service, Identity decision endpoint, Gateway routes,
  native LB-012/LB-014 extension, handoff event/Notification handling,
  `docs/security/P3_S1_THREAT_MODEL.md` and artifact-disabled tests implement
  the decision without a new service, engine or cross-owner persistence.
- Validation and follow-up: local Level C, exact-head hosted CI, merge-commit
  promotion, post-merge `dev` CI and issue #9 closeout remain required before
  accepted integration is claimed. KI-001/KI-016/KI-019 remain explicit. P3-S2
  must begin in a fresh task only after this evidence is immutable.

## ADR-022 — Materialize finite governed appointment occurrences in Care

- Status: Accepted and implemented in P3-S2
- Date: 2026-07-27
- Change ID: `CHG-2026-014`
- Context: P3-S2 must create/change/cancel appointments and expose a truthful
  calendar/agenda across IANA/DST boundaries without treating membership,
  Gateway state, implicit database DST resolution, an arbitrary recurrence
  rule or Notification as appointment authority.
- Decision: extend the existing Care Coordination boundary and owned
  PostgreSQL. Identity issues one fresh action/request-digest decision using
  the accepted P2 subject/grant/privacy boundary; Gateway composes only. Care
  materializes 1–12 finite concrete occurrences with canonical UTC plus source
  local/IANA/offset facts, serializes half-open conflict checks, and supports
  optimistic/idempotent occurrence-only change/cancel. Appointment,
  transition, audit, outbox and replay evidence commit atomically.
  Notification receives only `care.appointment.reminder_intent.v1` with opaque
  appointment/recipient references, schedule/cancel disposition, UTC trigger/
  start and a fixed message key.
- Alternatives considered: organizer/member-as-authority; browser/Gateway time
  resolution; PostgreSQL's implicit DST gap/overlap choice; offset-only time;
  infinite or arbitrary RRULE; dynamic recurrence expansion; “this and
  following” series split; silent conflict overwrite; destructive cancellation;
  free-form title/location/note; browser-selected reminder audience; shared
  tables; a new calendar service, broker or persistence engine.
- Consequences: P3-S2 logistics are structured enums and v1 series definition
  is immutable after creation. Series-wide mutation, external calendar sync
  and actual reminder delivery are deferred. Confirmed occurrences do not move
  silently after runtime tzdb changes; cancelled occurrences remain visible.
  Notification can schedule/cancel minimum intent without reading Care data.
- Planned baseline: P3-S2 required explicit time zone, recurrence boundary,
  change/cancellation, reminder intent, conflicts, equivalent agenda,
  stale-write/denied/unavailable and deterministic time tests, but did not
  freeze action permissions, DST disambiguation, finite recurrence shape,
  mutation scope, conflict locking or reminder payload.
- Actual implementation/evidence: `P3-S2-v1`, Care migration 003, Notification
  migration 002, LB-015/LB-016 handoff/native UI and the P3-S2 threat/test
  evidence implement the narrower boundary without a new service, engine,
  cross-service SQL or clinical scope.
- Validation and follow-up: focused Level A/B, exactly one local P3-S2 Level C
  plus classified targeted continuation if needed, exact-head hosted CI,
  merge-commit promotion, post-merge `dev` CI and issue #10 closeout. KI-001,
  KI-016 and KI-019 remain. P3-S3 begins only in a fresh task.

## ADR-023 — Keep versioned support plans in Care Coordination

- Status: Accepted and integrated for P3-S3
- Date: 2026-07-27–28
- Change ID: `CHG-2026-015`
- Context: P3-S3 must let authorized participants prepare and confirm a shared
  support plan without turning membership, Gateway state, stale consent, or
  free-form clinical content into authority. Draft and current truth must stay
  distinct under concurrent edits, and a review date is a local calendar day,
  not an appointment instant.
- Decision: extend the existing Care Coordination service and owned PostgreSQL
  with one aggregate per governed recipient, at most one shared draft, and an
  immutable sequence of confirmed versions. Identity & Consent issues a fresh
  action- and digest-scoped P2 decision for every read and command; Gateway
  only composes. Care validates every responsibility actor against that
  decision, uses optimistic aggregate/draft/base revisions plus 24-hour
  idempotency, and commits version, transition, audit, replay, and a
  content-free suppressed outbox event atomically. Store the selected local
  review date and IANA zone with Care-resolved inclusive/exclusive UTC day
  bounds; derive due/overdue from server time without mutating history.
- Alternatives considered: organizer/member implied authority; subject-only
  confirmation; per-user drafts; last-write-wins; cached authority; Gateway
  persistence; browser UTC conversion; offset-only dates; free-form clinical
  fields; reminder delivery; Notification integration; a new service or
  persistence engine; destructive version replacement or backfill.
- Consequences: draft revision, aggregate revision, base current version, and
  confirmed plan version are different facts. History contains confirmed
  versions only and exposes no totals. Structured coordination statements stay
  only in authorized Care reads; audit, event, outbox, errors, cursors, logs,
  metrics, and traces contain none of that text. Revocation denies the next
  request, and newly ineligible responsibility actors are redacted on reads and
  block reconfirmation until a fresh draft is saved.
- Planned baseline: P3-S3 required goals, preferences, responsibilities,
  review state, consent, concurrency, history, accessibility, and non-clinical
  copy but did not freeze authority reuse, draft topology, counters, local-day
  bounds, event disposition, or history inference controls.
- Actual implementation/evidence: Care migration 004, Identity decisions,
  Gateway composition, native VI/EN LB-017 and cumulative tests implement the
  decision. One Level C command plus classified retained-evidence recovery
  proves unit 57/57, contracts 24/24, cumulative integration/migrations, mocked
  LB-017 3/3, real P3-S3 1/1, cumulative browsers, accessibility, security,
  privacy-safe logs and cleanup. No new service, engine, cross-service SQL,
  shared writer, Notification claim, or clinical field is authorized.
- Validation and follow-up: prove direct and delegated authority/revocation,
  stale/future/wrong-digest decisions, idempotency and all concurrent command
  pairs, PostgreSQL rollback/reapply/no-backfill, 23/24/25-hour and skipped-day
  boundaries, immutable bounded history/cursors, atomic failure injection,
  privacy-safe evidence, VI/EN native browser paths, accessibility, and exact
  hosted promotion. Local evidence, exact-head runs
  `30329456918`/`30329530973`, PR #56 merge
  `f3576f40779617f0d7bd519ac44b178ccf269e3e`, post-merge run `30329752886`
  and issue #11 closeout are complete. KI-001, KI-016, and KI-019 remain
  explicit; P4-S1 begins only in a fresh task after docs-only closeout.

## ADR-024 — Split medication schedule, delivery evidence, and seen acknowledgement by owner

- Status: Accepted for P4-S1 candidate; implementation pending
- Date: 2026-07-28
- Change ID: `CHG-2026-016`
- Context: P4-S1 must repeat user-provided medication reminder facts without
  prescribing, inferencing adherence, or converting Notification intent receipt
  into a delivery claim. Accepted P2 authority and P3 time boundaries must be
  consumed without a new service, engine, shared database or Gateway-owned
  state.
- Decision: Care Coordination owns the Care-only medication label, exact
  user-entered amount/unit and finite local/IANA/offset recurrence plus
  schedule lifecycle. Notification receives no label/amount/unit and owns only
  generic structured occurrence intent, server-time delivery attempts,
  atomically persisted in-app evidence and an immutable acknowledgement that
  the reminder was seen. Identity & Consent issues a fresh exact-purpose
  decision for every owner operation. Gateway binds the complete request digest
  and composes authoritative reads only. Intent, pending/uncertain/delivered/
  failed/missed/cancelled delivery, and unacknowledged/seen states remain
  distinct. Acknowledgement never represents taken, skipped or adherence.
- Alternatives considered: store all reminder state in Care; let Notification
  receive medication content; treat outbox consumption as delivery; store
  reminder state in Gateway; use organizer/member status; accept arbitrary
  RRULE/free-form units; infer a default unit/offset; acknowledge taken/skipped;
  queue offline mutations; add a scheduler service or broker.
- Consequences: Care and Notification receive additive owner-local migrations
  and atomic audit/idempotency/outbox evidence. The event boundary contains
  only opaque scope/recipient/occurrence identifiers, trigger UTC, source
  local/IANA/offset and a fixed message key. Finite materialization rejects DST
  gaps and requires explicit overlap resolution. Notification can truthfully
  expose failed, missed and uncertain state without a clinical implication.
  In-app delivery uses a fixed product delivery window and injected server clock;
  external channels, dosage advice, adherence and escalation remain non-goals.
- Planned baseline: P4-S1 required explicit units/time zone, user-provided
  schedule facts, delivery/acknowledgement truth and P2/P3/Notification
  dependencies, but did not assign schedule-versus-delivery ownership or define
  acknowledgement meaning.
- Actual implementation/evidence: three independent pre-implementation reviews
  converged on owner separation, exact-purpose authority and evidence-gated
  delivery. The UI/privacy and test reviewers required seen-only
  acknowledgement and removal of medication amount/unit from Notification;
  those stricter decisions supersede the contract reviewer's broader
  taken/skipped and Notification-payload suggestions. `P4-S1-v1`,
  `docs/security/P4_S1_THREAT_MODEL.md` and the bounded research entry freeze
  the candidate before code. Stitch/native/runtime evidence remains pending.
- Validation and follow-up: generate/read back the four synthetic LB-018/LB-019
  references, freeze the redacted handoff, implement one vertical slice, invoke
  exactly one local `validate:p4-s1` campaign, then require exact-head and
  post-merge hosted CI. Preserve KI-001/KI-016/KI-019 and do not start P4-S2.

## Decision-change template

```md
## ADR-NNN — Decision title

- Status: Proposed | Accepted | Superseded | Rejected
- Date:
- Change ID:
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Planned baseline:
- Actual implementation/evidence:
- Validation and follow-up:
```
