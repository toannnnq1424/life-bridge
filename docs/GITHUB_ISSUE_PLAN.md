# GitHub Milestone, Label, and Issue Plan

## Control

- Repository: `toannnnq1424/life-bridge`
- Planning change: `CHG-2026-003`
- Canonical slice acceptance: `docs/IMPLEMENTATION_PLAN.md`
- Rule: one accepted slice equals one primary implementation issue.
- Detailed work packages remain checklists/subtasks unless they independently
  produce a user-visible end-to-end outcome.

This plan intentionally creates issues for the accepted P0–P6 roadmap, not all
85 slices in the external runbook. Expanding the issue set requires Change
Control.

## Labels

| Label           | Color    | Use                                             |
| --------------- | -------- | ----------------------------------------------- |
| `research`      | `6f42c1` | Source, assumption, or user-research work       |
| `design`        | `d4c5f9` | Stitch and design-handoff work                  |
| `frontend`      | `1d76db` | Web UI behavior                                 |
| `backend`       | `0052cc` | API/service/event behavior                      |
| `data`          | `0e8a16` | Provenance, fixture, schema, migration, storage |
| `security`      | `b60205` | Authorization, privacy, abuse, threat controls  |
| `accessibility` | `fbca04` | WCAG, keyboard, screen reader, language/reflow  |
| `operations`    | `5319e7` | CI, deployment, health, recovery, release       |
| `blocked`       | `d73a4a` | External/decision gate prevents progress        |
| `ready`         | `2da44e` | Entry criteria satisfied for the next action    |

## Milestones

| ID      | Title                       | Outcome                                            |
| ------- | --------------------------- | -------------------------------------------------- |
| `MS-P0` | P0 — Foundation             | Reproducible governed Windows baseline             |
| `MS-P1` | P1 — Daily task MVP         | Accountable task loop works end to end             |
| `MS-P2` | P2 — Trust and household    | Real access, household, consent, and audit         |
| `MS-P3` | P3 — Care planning          | Timeline, appointment, and care-plan coordination  |
| `MS-P4` | P4 — Safety and records     | Safe reminders, emergency plan, and document vault |
| `MS-P5` | P5 — Community support      | Consented help, matching, and moderation           |
| `MS-P6` | P6 — Resilience and release | Hardened, deployed, truthful release               |

No due date is invented. A milestone receives a date only after capacity and
external gates are known.

## Issue catalog

| ID       | Title                                                       | Milestone | Labels                                               | Dependency                            | GitHub  |
| -------- | ----------------------------------------------------------- | --------- | ---------------------------------------------------- | ------------------------------------- | ------- |
| `GH-001` | `[P0] Establish governed Windows foundation`                | P0        | `operations`, `data`, `accessibility`                | None; completed baseline              | Pending |
| `GH-002` | `[GATE-P1] Activate Stitch MCP and freeze P1 handoff`       | P1        | `design`, `security`, `accessibility`, `blocked`     | Credential owner and read-only canary | Pending |
| `GH-003` | `[DATA-S1] Pin aggregate context fixture with provenance`   | P1        | `research`, `data`, `ready`                          | `init/research` lane                  | Pending |
| `GH-004` | `[P1-S1] Accountable care-task loop`                        | P1        | `frontend`, `backend`, `accessibility`, `ready`      | P0; GH-002 before production UI       | Pending |
| `GH-005` | `[P2-S1] Account access and accessible onboarding`          | P2        | `frontend`, `backend`, `security`, `accessibility`   | P1 contracts                          | Pending |
| `GH-006` | `[P2-S2] Household, invitation, and care-recipient context` | P2        | `frontend`, `backend`, `security`                    | P2-S1                                 | Pending |
| `GH-007` | `[P2-S3] Consent, privacy, audit, and settings`             | P2        | `frontend`, `backend`, `security`                    | P2-S2                                 | Pending |
| `GH-008` | `[P3-S1] Daily timeline and handoff`                        | P3        | `frontend`, `backend`, `accessibility`               | P1 task; P2 roles/consent             | Pending |
| `GH-009` | `[P3-S2] Calendar and appointment coordination`             | P3        | `frontend`, `backend`, `accessibility`               | P3-S1 time contract                   | Pending |
| `GH-010` | `[P3-S3] Care-plan review`                                  | P3        | `frontend`, `backend`, `security`                    | P2 consent; P3 time                   | Pending |
| `GH-011` | `[P4-S1] Medication reminder acknowledgement`               | P4        | `frontend`, `backend`, `security`, `accessibility`   | P3 time; notification                 | Pending |
| `GH-012` | `[P4-S2] Emergency contacts and offline-readable plan`      | P4        | `frontend`, `security`, `accessibility`              | Consent and offline threat review     | Pending |
| `GH-013` | `[P4-S3] Access-controlled document vault`                  | P4        | `frontend`, `backend`, `data`, `security`            | Storage/scanner ADR and consent       | Pending |
| `GH-014` | `[P5-S1] Consented help request and directory`              | P5        | `frontend`, `backend`, `research`, `security`        | Reviewed source and consent           | Pending |
| `GH-015` | `[P5-S2] Volunteer match and organization coordination`     | P5        | `frontend`, `backend`, `security`                    | P5-S1 and safeguarding                | Pending |
| `GH-016` | `[P5-S3] Moderation resolution`                             | P5        | `frontend`, `backend`, `security`                    | P5-S2 and moderation policy           | Pending |
| `GH-017` | `[P6-S1] Offline, conflict, and reusable-state hardening`   | P6        | `frontend`, `backend`, `accessibility`, `operations` | Release flow inventory                | Pending |
| `GH-018` | `[P6-S2] Production deployment and operations`              | P6        | `backend`, `data`, `security`, `operations`          | Accepted release scope/platform       | Pending |
| `GH-019` | `[P6-S3] Demo, submission, and release`                     | P6        | `accessibility`, `operations`, `ready`               | P6-S1 and P6-S2                       | Pending |

## Required issue body

Every slice issue contains:

1. bilingual user-visible outcome;
2. current research gate and evidence/assumption IDs;
3. in-scope and explicit non-goals;
4. minimum UI/API/service/data/event path;
5. acceptance criteria copied or linked from the canonical plan;
6. dependencies and external gates;
7. applicable risk-catalog rows;
8. Level C validation commands;
9. documentation/change-control obligations;
10. exact handoff/next action.

The P0 issue is created as historical evidence and closed only after its commit,
validation, and branch links are recorded. `GH-002` remains blocked until the
credential-owner conditions are satisfied.
