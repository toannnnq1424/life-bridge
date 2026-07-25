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

- Status: Accepted
- Date: 2026-07-26
- Change ID: `CHG-2026-003`
- Context: The supplied 4.9 MB execution runbook contains useful research,
  accessibility, safety, operations, and decomposition detail, but its 16-phase
  order delays the first complete task loop, repeats generic checklists, and
  reports a stale P0 state.
- Decision: Keep the validated P0–P6 roadmap and adopt a compact overlay:
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
- Actual: No phase/slice is reordered. New protocol, crosswalk, assumption, and
  GitHub issue-plan documents implement the overlay.
- Evidence IDs: external runbook hash in `docs/RUNBOOK_ADOPTION.md`;
  `CHG-2026-003`.
- Limitations: The external source list and its “checked” dates were not adopted
  as verified evidence. Legal, safety, market, and tool claims still require
  targeted primary review.
- Review trigger: evidence forces a slice reorder/split, the runbook hash
  changes, or the accepted release scope changes.

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
