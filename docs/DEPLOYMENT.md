# Deployment

## P7-S2 operator recovery

Provision independent `CARE_RECOVERY_INTERNAL_TOKEN` and
`NOTIFICATION_RECOVERY_INTERNAL_TOKEN` values only to the operator and owning
service. Reconcile before mutation. Replay remains dry-run unless `--execute`
is explicit and requires operator/reason evidence. Rollback keeps additive
schemas and confirmed results; corrections use audited roll-forward.

## P7-S1 schema upgrade runbook

Verify the owner ledger and a bounded pre-migration recovery point, then run
only the owner migrator credential. Drift, gap, lock timeout, insufficient
credential, database unavailability and uncertainty fail closed. Reconcile an
uncertain commit from a fresh connection. Keep N-1/N inside the declared
window; application rollback leaves the expanded schema and data correction is
an idempotent forward compensation. Flyway clean/automatic repair and down
migration are forbidden. Retention, PITR, RPO/RTO and DR remain P7-S3.

## Current status

P1-S1 provides a production-built local runtime for synthetic acceptance:
Next.js web, Fastify gateway, Care Coordination, Notification, and one local
PostgreSQL engine with two owner-isolated databases. This is local/CI evidence,
not a public or production deployment.

P2-S1 and P2-S2 are integrated local/CI evidence. P2-S3 extends the same
Identity boundary with a stable consent/privacy/audit candidate. None of these
slices creates a public endpoint, production credential, platform resource or
deployment. KI-001 and the later P8–P11 gates still block every pilot or
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
  digest keys. The existing data-encryption key also authenticates short-lived
  P2-S3 audit cursors; it is never exposed to the browser or logs. Production
  gateway cookies use the `__Host-` prefix,
  `HttpOnly`, `Secure`, `SameSite=Strict`, path `/`, and no `Domain`.
- Care requires a separate `CARE_CURSOR_KEY` for P3 HMAC-sealed timeline
  cursors. It must not reuse the Care internal-service token or enter logs,
  browser state, checked-in environment files, audit, outbox or telemetry.
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

Migration 003 is additive and forward-compatible with the accepted P2-S2
runtime. It creates no subject/grant backfill and therefore cannot silently
authorize existing rows. Before any future rollout, snapshot/backup evidence
and the migration marker must be verified. If application rollout fails before
P2-S3 writes, roll back the application and leave the unused additive objects
in place. After any P2-S3 write, do not down-migrate or drop consent/audit
evidence; roll the application forward or deploy the prior compatible binary
while preserving tables, then follow an approved data-compensation plan.
Validation applies 001/002 to synthetic P2-S2 state, applies 003 twice, proves
preservation/no backfill/readiness, and drops only the disposable test
database—not production state.

## External deployment gate

Creating cloud resources, changing DNS, enabling public access, adding
production credentials, or deploying requires the accepted P11 slice and
applicable platform authorization. Phase 0 performs none of these actions.
Authorization never bypasses safety, validation, or debt gates. A development
credential disclosed in chat is not an approved deployment secret and must be
revoked rather than persisted.

P2-S1 adds no deployment. `validate:p2-s1` is a local/CI acceptance topology:
it provisions owned PostgreSQL databases, starts the real Identity dependency,
preserves the P1 regression campaign, runs the artifact-disabled P2 browser
campaign, and removes only its task-owned processes and Compose resources.

P2-S2 also adds no deployment or public infrastructure. Its local/CI topology
extends the same Identity-owned PostgreSQL database with owner-scoped
migrations, starts built Identity, Gateway and web processes on loopback, runs
artifact-disabled household/invitation/context browser paths, and deletes only
its PID-scoped Compose/process/log resources. Promotion to `dev` is evidence of
integration only; KI-001, KI-016 and the later P8–P11 security, accessibility,
rollback and rollout gates still block any pilot or deployment claim.

P2-S3 adds no deployment or public infrastructure. Its local/CI topology
applies additive Identity migration 003, starts built Identity, Gateway and web
processes on loopback, runs real grant/narrow/revoke/governed-read/audit and
atomic-privacy journeys plus mocked failure/accessibility paths, scans logs for
synthetic sensitive values and removes only its PID-scoped Compose/process/log
resources. Identity readiness now requires schema marker version 3. Promotion
to `dev` proves integration only; KI-001, KI-016, KI-019 and the later P8–P11
security, accessibility, recovery, rollback and rollout gates still block any
pilot or deployment claim.

P3-S1 also adds no deployment or public infrastructure. Care migration 002 is
applied by the Care process with its own credential and requires readiness
marker version 2. Validation upgrades synthetic P1 state, forces a transaction
rollback, reapplies twice, preserves tasks/audit and proves zero historical
timeline/handoff backfill.

If rollout fails before a P3 write, the prior compatible P1 binary may run
while additive tables remain dormant; do not drop them. After any P3 handoff,
preserve assignment, timeline, audit, outbox and idempotency evidence and use a
roll-forward correction or an approved data-compensation plan. Destructive
down-migration is not an operational shortcut.

The local/CI topology starts built Notification, Care, Identity, Gateway and
web processes on loopback, uses separate database owners/credentials, runs
real and mocked artifact-disabled Chromium journeys, and removes only the
PID-scoped processes, logs and disposable Compose project/volume it created.
Promotion to `dev` proves integration only. KI-001, KI-016, KI-019 and P8–P11
still block pilot, deployment or release claims.

# P6-S2 artifact build and runtime

`artifacts/<name>/artifact.json` is the canonical per-deployable contract and
`artifacts/<name>/Dockerfile` is its isolated multi-stage image build. Node
services ship bundled application output plus only their production dependency
closure and owned migrations; Web ships Next standalone output; Community ships
its executable JAR. Final stages run as non-root and do not copy repository
source, tests, credentials or another owner's migrations.

Run focused proof with `pnpm.cmd run test:p6-s2:fitness` and generate artifact
inventories with `pnpm.cmd run sbom:p6-s2`. Run the slice campaign with
`pnpm.cmd run validate:p6-s2`; `-SkipContainers` is truthful only when Docker is
unavailable and never satisfies container or upgrade acceptance. Runtime
orchestration must inject each manifest's allowlisted variables separately and
must never inject admin/bootstrap credentials.

# P6-S3 credential rotation and rollback

Production injects each caller-to-audience key only into that caller and
receiver. Gateway and Care never share the Notification event key. Dependency
URLs must use HTTPS; only explicit local/test loopback may use HTTP. Rotation is
provider current+previous, caller current, authenticated smoke/failure recovery,
old-caller drain, then previous-key removal. Rollback is consumer-first during
overlap. Stop on successful wrong-scope access, secret leakage, changed Care
confirmation during secondary outage, or duplicate Notification inbox result.
