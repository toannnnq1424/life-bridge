# LifeBridge Architecture and Product Decisions

## ADR-029 — Owner-local ledgers and additive compatibility windows

- Status: Accepted for P7-S1 candidate, 2026-08-02
- Change: `CHG-2026-021`

Three Node owners use owner-local immutable SHA-256 ledgers and advisory locks;
Community retains Flyway 12.4.0. Production runtime and migration credentials
are distinct. The supported window is exactly N-1 through N and all P7 schema
changes are additive. Rollback means application rollback with expanded schema
or a new idempotent forward compensation, never historical mutation, automatic
repair/clean or a production down migration.

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

- Status: Implemented and integrated; local and hosted P5-S1 validation passed
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
  destabilizing accepted Node services. The official-source gate pins
  Temurin 25.0.3+9, Spring Boot 4.1.0, Maven 3.9.16, Maven Wrapper 3.3.4,
  explicit plugins/checksums and a repository-scoped process-local toolchain.
  `contracts/community/p5-s1-v1` is the shared language-neutral boundary;
  generated business source, cross-service SQL and credentials remain
  prohibited. P6 must still validate mixed-version compatibility, independent
  artifact/upgrade, dependency isolation, authenticated service transport,
  observability, SBOM/supply-chain, container and rollback across Node and
  Spring.
- Planned baseline: Community was a later service in a practical TypeScript
  monorepo; P5 product order and P6 platform proof were already planned.
- Actual implementation/evidence: three independent pre-code reviews converged
  on the official pins, authority/data/event/failure contract, Stitch-native
  semantics and operations proof. The frozen OpenAPI/JSON Schemas and fixed
  Node/Java request-digest vectors preceded implementation. The candidate now
  includes repository `mvnw.cmd`/`mvnw`, a Boot 4.1 Community service,
  Community-only Flyway V1/PostgreSQL ownership, public structured directory,
  protected request transactions, privacy-safe audit/outbox, Gateway consumer,
  fresh Identity decisions and native VI/EN LB-022/LB-024. Focused owner-
  isolated migration, Spring provider/integration and built mixed-runtime
  browser proof are green; all data is synthetic.
- Validation and follow-up: exactly one local `validate:p5-s1` Level C
  invocation retained its first static-format failure; its same-ledger
  classified continuation and the later targeted hardening proof passed
  without a second local campaign. Final feature head
  `59f57e903ad71342e3259fce48b9de3315e7adef` passed exact-head push/PR CI,
  PR #66 merged as `dev@ac663a714b69aace443f712f1d8ee700b5e48636`,
  post-merge run `30397698495` passed the aggregate gate and issue #15 closed
  with bilingual immutable evidence. P5-S2/P5-S3 may extend the same owner only
  through separately frozen contracts; P6 retains the platform-wide mixed-
  version/operations proof.

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

## ADR-025 — Keep emergency readiness in Care and encrypt one bounded offline copy

- Status: Accepted for P4-S2 implementation
- Date: 2026-07-28
- Change ID: `CHG-2026-017`
- Context: P4-S2 must let an authorized participant configure ordered emergency
  contacts and a reviewed plan, then read a minimum safe copy when disconnected.
  Existing slices prohibit persistent care data in the browser, so a
  service-worker cache plus passphrase/KDF/AEAD/key lifecycle changes the
  accepted retention and threat boundary.
- Decision: Care Coordination owns one versioned emergency-readiness aggregate
  in its existing PostgreSQL datastore. Identity & Consent supplies a fresh
  exact-purpose `P4-S2-v1` decision for every online operation; Gateway composes
  only. A complete contact replacement and plan mutation serialize on the same
  aggregate; contact changes require re-review before snapshot issuance.
  Notification is uninvolved. With explicit per-device opt-in, a same-origin
  native client derives an AES-256-GCM key through PBKDF2-HMAC-SHA-256 with
  600,000 iterations, a random 16-byte salt, and a random 12-byte nonce from a
  separate offline passphrase. It stores one authenticated minimum snapshot in
  IndexedDB. The service worker caches only the versioned non-sensitive shell.
  Protected HTTP responses stay `no-store`.
- Alternatives considered: plaintext local/session storage; a persistently
  stored automatic browser key; Cache Storage/API-response caching; a global
  service worker; multiple independently fetched plan/contact copies; a new
  cache/crypto service; Notification ownership; Gateway state; no offline
  capability; organizer/member authority; an offline write queue.
- Consequences: The snapshot binds source/schema/scope, plan/contact revisions,
  review and server confirmation/display-time facts. It is recent through 24
  hours, explicitly stale through 72 hours, then hidden and purged. Local
  removal never needs authority. Known logout/account switch/denial/revocation,
  `no_plan`, source change, schema incompatibility, integrity failure, and
  expiry purge before render. Offline state never grants authority, claims live
  permission/currentness, or permits writes. The passphrase/key never leaves
  page memory or reaches the worker/server. Forgotten passphrase, integrity
  failure, or wrong scope requires purge and online recreation.
- Planned baseline: the roadmap required a timestamped stale-aware safe offline
  copy, minimum disclosure, accepted P2 authority, and a retained cache threat
  boundary, but did not assign ownership, freeze contact/plan version coupling,
  select storage/crypto parameters, or bound residual disclosure.
- Actual implementation/evidence: three independent pre-implementation reviews
  converged on Care ownership, exact-purpose authority, one transactionally
  consistent projection, app-shell-only service-worker caching, authenticated
  passphrase encryption, and fail-closed purge. The product retains the
  unavoidable inability to learn remote revocation offline, same-origin XSS/
  unlocked-device exposure, offline passphrase guessing, KI-016 manual AT, and
  KI-019 private-pixel review as explicit residual risk.
- Validation and follow-up: generate/read back four synthetic LB-020/LB-021/
  LB-032 references, freeze a redacted native handoff, implement the vertical
  slice, invoke exactly one local `validate:p4-s2` campaign, then require exact-
  head and post-merge hosted CI. Do not start P4-S3, DATA-S1, P5, Spring,
  deployment, or release work.

## ADR-026 — Keep bounded document bytes and metadata in Care PostgreSQL

- Status: Accepted for P4-S3 implementation
- Date: 2026-07-28
- Change ID: `CHG-2026-018`
- Context: P4-S3 must upload, list, download and delete a permitted synthetic
  document while telling the truth about authority, malware processing,
  integrity, retention, deletion, outages and uncertain results. The accepted
  architecture has no object-storage or scanner owner, and Gateway may not
  become a data owner.
- Decision: Care Coordination owns both document metadata and a maximum
  262,144-byte strict UTF-8 `.txt` body in its existing PostgreSQL datastore.
  Identity & Consent adds the explicit `document_vault.access` consent scope
  and issues one fresh request-bound `P4-S3-v1` decision for every list,
  upload, metadata read, content download and delete. Existing grants are not
  broadened or backfilled. Gateway validates and relays bounded JSON uploads
  and attachment downloads but persists or fabricates nothing. A successful
  object is `ready_unscanned`, with scanner `not_configured`, malware
  `not_scanned`, and only strict-text/digest/object-binding processing
  evidence. Care recomputes SHA-256 and verifies the randomized binding before
  every download. Explicit deletion atomically purges active bytes and
  metadata; only opaque content-free audit, tombstone and suppressed-outbox
  facts remain.
- Alternatives considered: object storage; a scanner service or fabricated
  clean state; active-content preview; Gateway ownership; shared tables or
  credentials; a new encryption scheme; browser persistence/offline queue;
  signed download URLs; multipart-parser dependency; unrestricted binary
  types; role/member authority; automatic retention expiry or product undo.
- Consequences: P4-S3 accepts only one `text/plain` `.txt` file with strict
  UTF-8 content and decoded size 1–262,144 bytes. Downloads are
  `application/octet-stream` attachments with sanitized advisory filenames,
  `nosniff`, sandbox and `no-store`; the UI never previews or actively renders
  uploaded content. JSON/base64 is bounded at the Gateway and decoded and
  independently validated by Care. XHR supplies real upload progress.
  Cancellation, timeout and ambiguous 5xx outcomes reconcile through a fresh
  authorized read using the same upload/idempotency context. Offline state
  exposes and queues nothing. PostgreSQL backup/restore rehearsal proves only
  local owner recovery and post-delete non-resurrection, not production
  encryption, RPO/RTO or historical-backup erasure.
- Planned baseline: the roadmap required one owner and authority path, explicit
  type/size/malware/retention/access/deletion truth, non-execution, failure
  handling, audit and backup/restore, but did not select storage, consent
  scope, content boundary, processing semantics, integrity binding or deletion
  residue.
- Actual implementation/evidence: three independent reviews converged on the
  bounded existing Care/PostgreSQL owner, exact P2 scope, strict text-only
  acceptance, unscanned truth, attachment-only retrieval, active-data purge,
  content-free evidence and no offline state. Four synthetic LB-023 Stitch
  references were written once and read back once; generated source was
  rejected and private pixels remain unavailable under KI-019.
- Validation and follow-up: implement only P4-S3, invoke exactly one local
  `validate:p4-s3` Level C after focused evidence, then require exact-head and
  post-merge hosted CI. KI-001/KI-016/KI-019 remain. Adding another file type,
  object storage, scanner/clean verdict, application-layer encryption, cache
  or service requires a new official-source micro-cycle and accepted ADR. Do
  not start P5-S1, DATA-S1, Spring, deployment or release work.

## ADR-026 — Serve current and previous Community contracts concurrently

- Status: Accepted for local P6-S1 candidate; hosted promotion held
- Date: 2026-07-29
- Change ID: `CHG-2026-004`
- Context: P6-S1 requires independent Node/Spring rolling compatibility, while
  the three P5 contract labels describe different features rather than
  successive versions. Review also found stale capability reporting and a
  moderation route mismatch hidden by separate provider/consumer tests.
- Decision: Introduce `community-v2` current and `community-v1` previous on one
  release line, selected explicitly by header. Current Community serves both;
  current Gateway can select both and stays on previous until providers
  converge. Support previous for at least 90 days and require accepted
  retirement evidence. Correct Spring moderation routes to the frozen
  language-neutral contract.
- Alternatives considered: relabel P5 slices as versions; silently fall back
  after writes; share generated Java/TypeScript business code; bump the public
  API path without semantic need.
- Consequences: breaking changes fail policy fixtures, ambiguous writes
  reconcile without cross-version replay, and rollout expands provider first
  while rollback switches consumer first.
- Planned baseline: current and previous API/event provider/consumer proof and
  one mixed Node/Spring primary flow.
- Actual implementation/evidence: machine-readable policy/matrix/event schemas,
  Node selection tests, Spring dual-version filter/provider tests and one-shot
  Level C runner are local only. No database or ownership boundary changes.
- Validation and follow-up: invoke exactly one local P6-S1 Level C, then stop at
  `READY_FOR_USER_CI_WAKE`; hosted exact-head/post-merge evidence and issue #22
  remain owner-controlled.

## Decision-change template

## ADR-027 — Make deployable artifacts the runtime ownership boundary

- Status: Accepted for P6-S2 candidate
- Date: 2026-08-02
- Change ID: `CHG-2026-019`
- Context: accepted contracts did not make Node outputs independently runnable,
  Web had no standalone artifact/probes, and CI spent the full mixed-runtime
  campaign on documentation-only changes.
- Decision: define six owner manifests and non-root containers; package Node
  production closures, owned migrations and Web standalone output; retain the
  Community executable JAR; generate one CycloneDX inventory per artifact; and
  enforce imports, config/database allowlists and container boundaries. CI uses
  an always-running fail-closed classifier, bounded integrity job and the
  unchanged required aggregator name.
- Alternatives considered: one monolithic runtime image; source-mounted
  containers; shared datastore credentials; a top-level `paths-ignore`; and
  treating a skipped required check as success.
- Consequences: repository-root build context remains necessary for workspace
  contract resolution, but final images contain only one artifact. Docker must
  be available for image and upgrade proof; the local Windows host currently
  lacks the Docker Desktop Linux engine, so hosted evidence is mandatory.
- Planned baseline: P6-S2 independent artifacts, one independent upgrade,
  ownership fitness and per-artifact dependency/SBOM/container isolation.
- Actual implementation/evidence: candidate implementation exists; local
  static/fitness proof is recorded in the session log and container promotion
  evidence remains pending.
- Validation and follow-up: run one Level C, exact-head hosted image/upgrade
  gates, merge-commit to dev, post-merge gate and bilingual #23 closeout. Do not
  begin P6-S3.

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

## ADR-028 — Use scoped short-lived service assertions at owner boundaries

- Status: Accepted for P6-S3 candidate
- Date: 2026-08-02
- Context: destination-wide bearer tokens could not distinguish Gateway from
  Care, constrain route scope, expire, or support safe rolling rotation.
- Decision: callers sign a maximum-120-second HMAC assertion with key id,
  caller, audience, scope, issue/expiry times and nonce. Providers verify it
  before business parsing. Gateway and Care use distinct Notification keys.
  Current/previous keys overlap only for bounded provider-first rotation;
  production rejects bearer-only calls and plaintext dependency URLs.
- Consequences: Node and Spring retain independent verifiers with shared
  behavior. Minimum unauthenticated health probes remain network-controlled.
  Platform TLS/secret-manager implementation remains P8/P11 deployment work.
- Rollback: roll consumers back during overlap, prove the authenticated smoke
  path, then remove the previous key; never restore broad credentials or HTTP.

# ADR-030 — household-scoped authorization at owner boundaries

- Date: 2026-08-02
- Change ID: `CHG-2026-022`
- Status: accepted for the P8-S1 candidate

Production requests cannot establish household or actor authority from a
fixture header or object identifier alone. Gateway obtains a fresh Identity
decision for the exact operation, household, resource and digest. Owners check
membership/consent projection versions and freshness. Object-only legacy task
routes remain local/test fixture compatibility; no new role, protocol,
datastore or shared business owner is introduced.

# ADR-031 — Repository-native P8-S2 rotation and unsigned digest-bound provenance

- Status: accepted for P8-S2 on 2026-08-02.
- Context: the repository has existing environment injection, short service assertions, owner-isolated PostgreSQL, pinned Actions/images and CycloneDX generation, but no selected production provider, KMS, PKI or signing identity.
- Decision: retain the architecture and add exact current/previous key generations, bounded overlap/revocation, key-id AES-GCM envelopes, truthful transport/at-rest inventory, orchestrator-enforced runtime policy, deterministic SBOM/artifact digests and locally verifiable unsigned provenance. Provenance explicitly records no SLSA level.
- Consequences: operators can rehearse rotation and verify exact-source artifact evidence without placing credentials in Git/logs/artifacts. Provider key custody, storage encryption, trusted signing/attestation and certification remain release-gated decisions; they cannot be inferred from this ADR.
