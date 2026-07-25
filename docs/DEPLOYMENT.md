# Deployment

## Current status

No LifeBridge service is implemented or deployed in Phase 0. This document
defines the intended reproducible path and must not be read as deployment
evidence.

## Environments

| Environment | Branch/source                       | Purpose                          | Data                         |
| ----------- | ----------------------------------- | -------------------------------- | ---------------------------- |
| Local       | active `phase/*` or `dev`           | development and slice validation | synthetic only               |
| CI          | pull-request commit                 | deterministic validation         | generated synthetic fixtures |
| Test        | promoted `test` commit              | integrated release candidate     | synthetic/non-production     |
| Production  | immutable commit promoted to `main` | approved public demo             | minimum approved data        |

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
- documentation and session log current;
- environment-specific secrets configured outside Git;
- smoke result recorded against the exact commit.

## Rollback and recovery

- Application rollback selects a previously verified immutable artifact.
- Database changes are forward-compatible where possible and include a tested
  compensation path.
- Each service owns backup/restore evidence for its database.
- Event consumers are idempotent and tolerate replay.
- A failed deployment must not trigger blind cache, volume, or database deletion.

## External deployment gate

Creating cloud resources, changing DNS, enabling public access, adding production
credentials, or deploying is a separate explicit approval. Phase 0 performs none
of these actions.
