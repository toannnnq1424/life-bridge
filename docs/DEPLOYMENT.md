# Deployment

## Current status

P1-S1 provides a production-built local runtime for synthetic acceptance:
Next.js web, Fastify gateway, Care Coordination, Notification, and one local
PostgreSQL engine with two owner-isolated databases. This is local/CI evidence,
not a public or production deployment.

P2-S1 currently adds a production-oriented Identity backend candidate and
gateway boundary only. Its PostgreSQL migration and focused tests are local/CI
evidence; no P2 runtime deployment, public endpoint, production credential or
production UI is claimed. `MCP-DEBT-2026-002` blocks the full slice and every
deployment claim.

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
- Gateway startup rejects fixture identity when runtime is production, the
  bind host is non-loopback, or the configured public origin is non-loopback.
- Identity requires separate database/internal-service/data-encryption/rate-
  digest keys. Production gateway cookies use the `__Host-` prefix,
  `HttpOnly`, `Secure`, `SameSite=Strict`, path `/`, and no `Domain`.
- Each service exposes liveness, readiness, and build-version endpoints.
- Logs are structured and follow `docs/SECURITY.md`.

## P1-S1 local commands

```powershell
.\scripts\bootstrap.ps1
.\scripts\doctor.ps1
pnpm.cmd run demo:p1
pnpm.cmd run validate:p1-s1
```

`demo:p1` creates ignored process-local credentials if absent, starts the
digest-pinned PostgreSQL container, provisions distinct Care and Notification
owners/databases, builds the four runtime boundaries, and waits until
interrupted. It retains only its named local database volume.
`validate:p1-s1` instead uses a PID-scoped Compose project and removes exactly
its container, network and volume after the campaign.

P1-S1 exposes local health endpoints and binds only to `127.0.0.1`. Fixture
identity is explicit and startup rejects it in production mode. No cloud
resource, public endpoint, DNS, production credential, backup policy or
rollback artifact is created by this slice.

The Next build uses local fonts and no image optimization pipeline. Project
resolution excludes optional Sharp and `allowBuilds.sharp: false` remains
enforced; build plus Chromium runtime smoke is the evidence that P1 does not
require Sharp install/runtime code. The temporary parent-scoped PostCSS patch
must be reassessed on a Next upgrade. Any later `next/image` or server
image-processing work must reopen the supply-chain decision before deployment.

The P2 backend uses the existing PostgreSQL engine with a distinct
`lifebridge_identity` owner/database. `tools/quality/src/p2-database.ts` and
`p2-reset.ts` are validation helpers, not deployment automation. Identity and
gateway require configuration through the approved local/CI secret mechanism;
no example or repository file contains usable credentials, TOTP seeds,
recovery codes, cookies or tokens.

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
