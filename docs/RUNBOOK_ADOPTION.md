# Research-Driven Runbook Adoption

## Status and authority

- Change: `CHG-2026-003`
- Decision: `ADR-011`
- Status: accepted as a planning overlay; no phase reorder
- Canonical execution state: `docs/IMPLEMENTATION_PLAN.md`,
  `docs/WORKSTREAM_BOARD.md`, and `docs/SESSION_LOG.md`

The supplied runbook is a useful planning input, not a second source of project
state. LifeBridge keeps the validated P0–P6 roadmap and uses the runbook to
improve research gates, risk coverage, user-research safeguards, and future
slice decomposition.

## Input provenance

| Field              | Value                                                                |
| ------------------ | -------------------------------------------------------------------- |
| External file      | `D:\Downloads\LIFEBRIDGE_RESEARCH_DRIVEN_ULTRA_EXECUTION_RUNBOOK.md` |
| Reviewed           | 2026-07-26                                                           |
| Size               | 4,932,614 bytes                                                      |
| Lines              | 115,507                                                              |
| Declared structure | 16 phases, 85 slices                                                 |
| SHA-256            | `07C0CB91CCA1AADDF648F643EA3A5185CF488589947247B56199D6BF8C581730`   |

The external file is not copied into Git. It is very large, repeats generic
edge/acceptance material, and contains source/status claims that have not all
been independently verified. The hash lets a later session determine whether a
different revision is being considered.

## Adoption decision

| Runbook element                        | Decision              | LifeBridge treatment                                                   |
| -------------------------------------- | --------------------- | ---------------------------------------------------------------------- |
| Research gate before each phase        | Adopt                 | Risk-tiered gate with explicit evidence and assumptions                |
| Research micro-cycle before each slice | Adopt                 | Small, bounded cycle before contract/design                            |
| Evidence levels and source priority    | Adapt                 | Preserve the repository's stronger license/privacy/freshness fields    |
| Evidence-to-decision/test traceability | Adopt                 | Every finding must change or confirm an actionable artifact            |
| Research stop rule                     | Adopt                 | Stop when added sources no longer change a decision                    |
| Competitor research                    | Adopt with limit      | Benchmark only; maximum three per scoped cycle                         |
| User-research plan                     | Adapt                 | Synthetic scenarios, explicit consent, retention/withdrawal plan first |
| Re-check calendar                      | Adopt                 | Trigger-based manual evidence; no live scraping in CI                  |
| Shared edge-state inventory            | Adapt                 | Select only slice-relevant risks; never copy every card                |
| Calm, content-first UI guidance        | Candidate             | Must still pass Stitch critique and user/accessibility review          |
| P0–P15 ordering                        | Reject as baseline    | It delays the first working care-task loop until its P5                |
| 85 slices as mandatory release scope   | Reject                | Release scope is the accepted P0–P6 plan only                          |
| P0 `NOT STARTED` state                 | Reject                | Repository evidence says P0 is validated                               |
| Source rows marked checked             | Reject until verified | Re-register through `init/research` after primary-source review        |
| Empty per-source worksheets            | Reject                | Materialize one scoped summary only when a source is active            |
| FHIR/legal/compliance claims           | Defer                 | Require an actual market/interoperability need and specialist review   |

## Roadmap crosswalk

| Supplied runbook                   | Canonical LifeBridge plan   | Treatment                                                              |
| ---------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| P0 foundation                      | P0 foundation               | Audit coverage only; do not reopen                                     |
| P1 Stitch/design foundation        | P1-S1 design gate           | Limit to P1 screens and states; no whole-product design upfront        |
| P2 identity/onboarding             | P2-S1                       | Candidate work packages inside the accepted slice                      |
| P3 care circle/membership          | P2-S2                       | Household, invite, role, and member lifecycle                          |
| P4 recipient/consent/privacy       | P2-S2, P2-S3, P4-S2         | Split by authorization/consent versus emergency semantics              |
| P5 Today/tasks/routine             | P1-S1                       | Merge create, assign, complete, notify, and dashboard end to end       |
| P6 calendar                        | P3-S2                       | Keep external sync as a boundary until separately accepted             |
| P7 care plan/medication            | P3-S3 and P4-S1             | Medication remains a higher-risk safety slice                          |
| P8 notification/check-in/emergency | P1-S1 and P4-S2             | Minimal notification first; defer check-in/escalation pending evidence |
| P9 document vault                  | P4-S3                       | Upload-to-safe-state vertical flow; storage/scanner need ADRs          |
| P10 community support              | P5-S1–P5-S3                 | Fixture directory first; moderation before public matching             |
| P11 organization/reporting         | P5-S2/P5-S3 or later change | Defer broad caseload/reporting until household/community validation    |
| P12 accessibility/i18n/offline/PWA | Every slice and P6-S1       | Cross-cutting from P1; P6 is hardening, PWA optional                   |
| P13 security/operations            | Every slice and P6-S2       | Controls travel with data; P6 rehearses the full system                |
| P14 stabilization                  | P6 validation campaign      | Quality checkpoint, not a product vertical slice                       |
| P15 staging/release                | P6-S2 and P6-S3             | Immutable candidate, smoke, UAT, rollback, release verification        |

## Why P1-S1 remains one vertical slice

The supplied runbook separates dashboard design, task creation, assignment,
completion, notification, and dashboard integration. Individually, those are
work packages rather than complete user outcomes. LifeBridge deliberately merges
them into:

```text
create task
→ assign caregiver
→ complete with optimistic concurrency
→ commit outbox event
→ persist exactly one notification
→ render confirmed dashboard/task state
```

Recurrence, broad notification preferences, real authentication, and external
delivery remain deferred. This preserves the first working demo and avoids a
backend-first or screen-first build.

## Required phase research gate

Every future phase records one of:

- `PASS`
- `PASS WITH ASSUMPTIONS`
- `BLOCKED`
- `NOT APPLICABLE`

The gate must cover:

1. the user problem, actor, current workaround, and measurable outcome;
2. applicable official/primary evidence for high-risk requirements;
3. Vietnamese evidence or an explicit local-evidence gap when market, language,
   privacy, services, or safety are affected;
4. privacy, safety, accessibility, bilingual, offline, and operational impact;
5. assumptions requiring interviews, counsel, or specialist review;
6. changes to scope/order/acceptance recorded through Change Control.

Assurance phases use current law, standards, threat, incident, SLO/RTO/RPO, and
platform evidence. They do not need irrelevant competitor or paper/Excel
questions.

## Required slice research micro-cycle

Before a slice contract or Stitch prompt:

1. write no more than five decision-driving questions;
2. reuse verified sources unless a review trigger fired;
3. open only the minimum new primary sources needed;
4. use at most three competitor products as benchmark;
5. record findings, limitations, assumptions, and affected acceptance/tests;
6. return a gate state;
7. stop when another source would not change a decision.

Use `docs/research/RESEARCH_PROTOCOL.md`. Do not create dozens of blank
worksheets.

## Shared risk catalog

Select only applicable rows for a slice:

- duplicate submit, retry after timeout, and idempotency;
- concurrent update and optimistic conflict;
- permission/consent/session change during an action;
- weak/offline network and safe reconciliation;
- dependency timeout, partial response, and graceful degradation;
- duplicate event/consumer delivery and stale read model;
- not-found versus cross-household non-disclosure;
- Vietnamese/English meaning, long text, time zone, and deterministic time;
- keyboard, screen reader, 200% zoom, narrow viewport, reduced motion;
- sensitive-log redaction, fixture migration, rollback, and recovery.

The catalog is a prompt for risk selection, not an automatic checklist for every
slice.

## Candidate future decomposition

The detailed runbook can justify splitting a canonical slice only when:

- the current slice cannot remain independently reviewable in one conversation;
- the split still yields a user-visible end-to-end outcome;
- dependencies and compatibility are explicit;
- a Change ID records planned versus actual order and downstream validation.

Organization caseload/reporting, check-in/escalation, external calendar sync,
PWA installability, FHIR interoperability, and non-Vietnam market compliance are
candidate future work, not accepted MVP scope.
