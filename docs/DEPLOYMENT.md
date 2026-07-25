# Deployment

## Current status

No LifeBridge service is implemented or deployed in Phase 0. This document
defines the intended reproducible path and must not be read as deployment
evidence.

## Environments

| Environment | Branch/source                                      | Purpose                             | Data                         |
| ----------- | -------------------------------------------------- | ----------------------------------- | ---------------------------- |
| Local       | active `phase/*` or `dev`                          | development and slice validation    | synthetic only               |
| CI          | pull-request commit                                | deterministic validation            | generated synthetic fixtures |
| Test        | promoted `test` commit                             | integrated release candidate        | synthetic/non-production     |
| Production  | immutable artifact promoted through `test -> main` | bounded approved production release | minimum approved data        |

Development, test, and production credentials must be distinct.

## Planned topology

```text
Web client
  → API Gateway/BFF
      → Identity and Consent service
      → Care Coordination service
      → Notification service
      → Community Matching service (deferred)

Service-owned databases
Event transport / transactional outbox
Object storage and search only after separate ADR approval
```

Local deployment may use one container engine and one PostgreSQL instance with
isolated databases. Production topology must preserve service ownership even if
infrastructure is consolidated for cost.

## Configuration contract

- `.env.example` lists variable names and safe descriptions only.
- Startup validates required variables and rejects unknown production defaults.
- Secrets are injected by the target platform; never built into images.
- Fixture mode is explicit and cannot silently activate in production.
- Each service exposes liveness, readiness, and build-version endpoints.
- Logs are structured and follow `docs/SECURITY.md`.

## Planned commands

Canonical commands will be implemented by the relevant slices:

```powershell
.\scripts\bootstrap.ps1
.\scripts\doctor.ps1
.\scripts\validate-phase0.ps1
pnpm.cmd run build
pnpm.cmd run test
```

Application start, migration, smoke, and deployment commands will be added only
when the first executable service slice exists. Do not publish invented commands.

## Promotion

```text
phase/* → dev → test → main
init/research → data → dev
```

Promotion requires:

- required validation for the source phase;
- immutable lockfile and generated contract consistency;
- migration and rollback/compensation review;
- no unresolved release blocker;
- zero open required MCP/integration debt marked `blocks deploy: yes`;
- documentation and session log current;
- environment-specific secrets configured outside Git;
- smoke result recorded against the exact commit and immutable artifact digest.

Every arrow is a reviewed pull request. Cross-lane promotions use merge commits
so GitHub Network preserves ancestry and convergence. Short-lived `phase/*`
branches start from the accepted owning lane and are deleted only after their
commits are reachable from the target. A production `hotfix/*` starts from
`main`, reaches `main` by pull request, then is forward-merged by pull requests
through `test` and `dev`.

## Production rollout stages

- P6 proves independent deployables, versioned rolling compatibility, service
  identity, and dependency isolation.
- P7 proves migrations, replay/reconciliation, backup/restore, retention, and
  deletion.
- P8 proves release security/privacy/supply-chain controls.
- P9 proves SLOs, alerting, degradation, incident response, and DR.
- P10 proves workload, capacity, scale, backpressure, and cost budgets.
- P11 builds immutable artifacts, rehearses migration/rollback, performs a
  staged consented pilot, and releases only after all gates pass.
- P12 owns live support, patch/rotation/restore cadence, post-incident learning,
  and the next governed roadmap.

## Rollback and recovery

- Application rollback selects a previously verified immutable artifact.
- Database changes are forward-compatible where possible and include a tested
  compensation path.
- Each service owns backup/restore evidence for its database.
- Event consumers are idempotent and tolerate replay.
- A failed deployment must not trigger blind cache, volume, or database deletion.

## External deployment gate

Creating cloud resources, changing DNS, enabling public access, adding
production credentials, or deploying requires the accepted P11 slice and
applicable platform authorization. Phase 0 performs none of these actions.
Authorization never bypasses safety, validation, or debt gates. A development
credential disclosed in chat is not an approved deployment secret and must be
revoked rather than persisted.
