# LifeBridge Architecture

## Document status

- Architecture baseline: `ARCH-2026-07-25`
- Status: Accepted Phase 0 target architecture
- Runtime implementation status: Not yet implemented
- Current phase: Foundation
- First implementation slice: `P1-S1`
- Production-maturity plan: `PLAN-2026-07-26-PRODUCTION` (`P0`–`P12`)

“Planned” below describes the approved target. “Actual” records repository/runtime evidence. Update both when implementation differs; do not rewrite the plan retroactively.

## 1. Architectural drivers

1. Deliver one reliable, user-visible vertical slice before broad platform scope.
2. Enforce household, role, and consent boundaries without a shared database shortcut.
3. Keep task completion durable even when notification delivery is delayed.
4. Run a deterministic synthetic demo without private credentials.
5. Support Windows bootstrap, test, build, and fresh-worktree reproduction.
6. Keep microservice boundaries practical for a small team/hackathon while remaining independently runnable and deployable.
7. Make accessibility, privacy, auditability, and truthful state part of each contract.
8. Avoid operational complexity unless an access pattern proves it is needed.

## 2. Planned system context

```mermaid
flowchart LR
    U["Care recipient or trusted collaborator"] --> W["LifeBridge Web"]
    W --> G["API Gateway / BFF"]
    G --> I["Identity & Consent Service"]
    G --> C["Care Coordination Service"]
    G --> N["Notification Service"]
    G --> M["Community Service (later phase)"]
    C --> CP[("Coordination PostgreSQL")]
    N --> NP[("Notification PostgreSQL")]
    I --> IP[("Identity/Consent PostgreSQL")]
    M --> MP[("Community PostgreSQL")]
    C --> D["Owned outbox dispatcher"]
    D --> N
    G --> O["Redacted telemetry"]
    I --> O
    C --> O
    N --> O
    M --> O
```

No arrow represents direct access to another service's tables. The BFF composes APIs; it does not own domain records.

## 3. Planned versus actual

| Area                   | Planned baseline                                                         | Actual evidence at Phase 0                               |
| ---------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| Workspace              | pnpm TypeScript monorepo                                                 | Foundation tooling/scaffold is being established         |
| Web                    | Next.js + React, semantic components, localization                       | No production UI implemented                             |
| Gateway/BFF            | Fastify, external HTTP contract, response composition                    | Not implemented                                          |
| Domain services        | Independently runnable Fastify processes/modules                         | Not implemented                                          |
| Contracts              | TypeScript + Zod schemas; OpenAPI for HTTP; versioned event envelope     | Not implemented                                          |
| Persistence            | PostgreSQL, separately owned database/schema per service                 | Not provisioned                                          |
| Cross-service delivery | Transactional outbox + versioned internal delivery + inbox/deduplication | Not implemented                                          |
| Testing                | Vitest unit/contract/integration; Playwright browser smoke               | Foundation commands are being established                |
| UI design              | Google Stitch MCP reference + reviewed repository handoff                | Design governance exists; product screens are not frozen |
| Deployment             | Containerized services with health/readiness checks                      | Deferred until deployable slices exist                   |

Any divergence requires a Change ID and, when architectural, an ADR.

## 4. Repository topology

Target topology:

```text
apps/
  web/                       # Next.js user interface
  gateway/                   # External API/BFF and composition
services/
  identity-consent/          # Identity, membership, role, consent
  care-coordination/         # Tasks, assignments, handoffs, care plans
  notification/              # In-app notification and delivery state
  community/                 # Help requests, directory, matching; later
packages/
  contracts/                 # Versioned HTTP/event schemas and generated types
  observability/             # Correlation, logging and metric primitives
  config/                    # Typed environment validation
  test-fixtures/             # Deterministic synthetic builders only
data/
  fixtures/                  # Reviewed fixture bundles and provenance
docs/
scripts/
```

Shared packages may provide technical primitives and schemas. They must not become a shared domain layer that lets services bypass ownership.

The actual repository map is authoritative for paths that currently exist: `docs/REPOSITORY_MAP.md`.

## 5. Service boundaries

### Web

Responsibilities:

- accessible, responsive presentation;
- client-side interaction and safe input preservation;
- localization;
- truthful rendering of confirmed, queued, failed, denied, stale, and conflict states.

It does not embed service credentials, infer permissions, or treat optimistic state as confirmed.

### API Gateway / BFF

Responsibilities:

- authenticate external requests and propagate actor/correlation context;
- enforce request size/rate boundaries;
- validate external schemas;
- route commands to the owning service;
- compose dashboard reads without cross-service database access;
- normalize safe client-facing errors.

It does not own task, identity, consent, or notification records.

### Identity & Consent

Responsibilities:

- account identity and authentication;
- household membership and roles;
- invitation lifecycle;
- care-recipient sharing/consent grants and revocation;
- authorization decision inputs and audit evidence.

Phase 1 may use a deterministic fixture adapter for an explicitly local demo. Real authentication and consent persistence begin in Phase 2. Fixture identity cannot be enabled in public production.

### Care Coordination

Responsibilities:

- care task lifecycle and assignment;
- timeline/handoff, calendar, care plan, and later care coordination features;
- authorization using trusted actor/grant context;
- optimistic concurrency and idempotent commands;
- atomic domain mutation and outbox append.

It owns task and coordination records. It never writes notification tables.

### Notification

Responsibilities:

- consume versioned events idempotently;
- render safe message keys/parameters;
- persist in-app notification/read state;
- manage channel delivery state and retries when channels are added;
- expose recipient-scoped reads.

It owns notification and inbox/deduplication records. A task can be durably completed even while notification is pending or failed.

### Community

Responsibilities, deferred to Phase 5:

- public/approved directory metadata;
- help requests;
- volunteer and organization matching;
- moderation case integration.

It receives only minimum-necessary consented data. It does not expose general household records.

### Audit/read models

Each service first records its own security/business audit evidence. A consolidated audit-history read model may be added in Phase 2 through versioned events. It is read-only with respect to source domains and cannot become the authority for permissions or task state.

## 6. `P1-S1` interaction

```mermaid
sequenceDiagram
    actor User
    participant Web
    participant Gateway
    participant Care as Care Coordination
    participant CareDB as Coordination DB
    participant Dispatch as Outbox Dispatcher
    participant Notify as Notification
    participant NotifyDB as Notification DB

    User->>Web: Create and assign task
    Web->>Gateway: POST task + idempotency key
    Gateway->>Care: Validated command + actor/correlation
    Care->>CareDB: Commit task
    Care-->>Gateway: Confirmed task/version
    Gateway-->>Web: Created task
    User->>Web: Complete task
    Web->>Gateway: Complete task + expected version
    Gateway->>Care: Authorized idempotent command
    Care->>CareDB: Atomic completion + outbox event
    Care-->>Web: Confirmed completion; delivery pending
    Dispatch->>CareDB: Read/claim owned outbox
    Dispatch->>Notify: Deliver versioned event
    Notify->>NotifyDB: Inbox dedupe + notification commit
    Notify-->>Dispatch: Durable acknowledgement
    Dispatch->>CareDB: Mark event delivered
    Web->>Gateway: Refresh dashboard/notifications
    Gateway->>Care: Read task summary
    Gateway->>Notify: Read recipient notifications
    Gateway-->>Web: Composed confirmed state
```

The dispatcher belongs to Care Coordination and reads only its owned outbox. It calls an internal Notification contract. Notification never polls or joins the coordination database.

An external broker may replace the initial transport later without changing domain event meaning. That change requires load/reliability evidence, an ADR, migration/rollback, and updated validation.

## 7. Contracts

### HTTP

- Validate at gateway and service boundaries.
- Publish versioned OpenAPI contracts from schemas.
- Use opaque IDs, explicit timestamps/time zones, and bounded strings/lists.
- Require an idempotency key for create and state-transition commands.
- Require an expected entity version for concurrent updates.
- Return stable error codes with safe messages and correlation IDs.
- Never expose stack traces, database names, secret values, or protected-resource existence.

### Events

Minimum envelope:

```text
eventId
eventType
eventVersion
occurredAt
producer
aggregateId
aggregateVersion
correlationId
causationId
payload
```

Rules:

- event IDs are globally unique;
- consumers store source event IDs for deduplication;
- additive compatible changes preserve version;
- semantic/breaking changes create a new event version;
- payloads contain minimum necessary identifiers and message parameters, not care notes;
- retry has bounded backoff and a visible terminal/attention state;
- contract fixtures prove old supported versions remain consumable.

## 8. Persistence and service ownership

### Default

PostgreSQL is the default engine to minimize Phase 0/1 operational burden. Each service owns a distinct database or schema and credentials with access only to that boundary.

Absolute rules:

- no cross-service table writes;
- no shared table ownership;
- no direct cross-service SQL joins;
- no foreign key spanning service stores;
- no consumer reading another service's outbox;
- APIs/events are the integration boundary;
- backups and migrations are tested per owner.

A shared PostgreSQL server is acceptable locally if logical ownership and credentials remain separate. “Same server” must never become “shared database ownership.”

### Polyglot persistence

Polyglot persistence is permitted, not required. A new engine needs an accepted ADR with:

1. business/technical objective and measured access pattern;
2. owning service/team;
3. source-of-truth and consistency model;
4. backup, restore, disaster-recovery test, and RPO/RTO expectations;
5. retention, deletion, export, and legal/privacy implications;
6. migration/backfill, dual-read/write risk, rollback, and exit plan;
7. operational cost, local/CI support, monitoring, and failure modes;
8. security, encryption, credential, and tenant/household isolation;
9. planned versus actual rollout evidence.

Potential examples, not approved implementations:

- object storage for encrypted document blobs while document metadata remains service-owned;
- a rebuildable search index for a public/community directory;
- Redis for bounded cache/rate-limit/idempotency acceleration, never authoritative state.

Do not add an engine only because a microservice exists.

## 9. Consistency and failure behavior

| Operation              | Consistency                                                       | Failure behavior                                                   |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Create/assign task     | Strong within Coordination                                        | Reject invalid/unauthorized request; idempotent retry              |
| Complete task + outbox | One local transaction                                             | Task and event commit together or neither commits                  |
| Notification creation  | Eventually consistent across services                             | Completion remains true; delivery shows pending/failed and retries |
| Dashboard composition  | Read-your-confirmed-write for task; bounded eventual notification | Return task section even if notification is partially unavailable  |
| Consent revocation     | Strong in Identity/Consent; propagated invalidation               | Deny new access; reconcile cached/read models and audit            |
| Search index (future)  | Rebuildable eventual view                                         | Fall back to owner API/limited mode; never become authority        |

Commands are not retried blindly after an unknown result; clients reuse the same idempotency key and reconcile against confirmed state.

## 10. Security, privacy, and consent

- Trust boundaries exist at browser, gateway, service, datastore, MCP, and external-provider edges.
- Production authentication and service-to-service authorization are mandatory before public deployment.
- Authorization is checked by the owning service with actor, household, role, and consent context.
- Least-privilege database credentials map to one service boundary.
- Encryption in transit is required outside isolated local development; sensitive storage requires encryption and retention controls.
- Logs/events use stable IDs and result categories, not task descriptions, medication details, contacts, document names, or tokens.
- Every invitation, role, consent, document, emergency-plan, export, privileged read, and destructive action is auditable as its phase arrives.
- Fixture mode uses fabricated names/content and is disabled in public production.
- Secrets are loaded from runtime environment/approved secret stores and validated at startup.

Threat analysis and response procedures belong in `docs/SECURITY.md`.

## 11. UI architecture and Stitch

Google Stitch MCP provides design concepts and responsive references. Git remains the production source of truth.

Required gate:

```text
product flow
-> API/permission/state contract
-> Stitch concept
-> accessibility/privacy/security/implementation review
-> frozen handoff
-> React component implementation
-> browser and accessibility validation
```

Generated markup and scripts are never copied directly. Approved concepts are normalized into semantic components, tokens, localization keys, responsive rules, and tests.

For `P1-S1`, implementation cannot start until handoffs cover Dashboard (`LB-011`), Task Board (`LB-013`), Task Detail (`LB-014`), the applicable Notification state (`LB-019`), and reusable state patterns used by the flow.

## 12. Observability and safe operations

Every request/event propagates a correlation ID. Structured telemetry may include:

- service, route/operation, result code, duration;
- actor/household/task opaque IDs when necessary and policy-approved;
- event type/version, outbox age, attempt count, consumer result;
- dependency health and readiness.

It must exclude secret values, authorization headers, free-form care content, contact details, full payloads, and personal browser/session artifacts.

Health model:

- liveness: process can continue;
- readiness: required owned datastore/migrations/config are ready;
- dependency status: separately reported so a notification outage does not falsely mark coordination state absent.

## 13. Build, test, and deployment boundaries

- Node.js 22.x and pnpm 11.9.0 are the baseline.
- Each application/service exposes scoped format, lint, type-check, unit, contract, build, and start commands.
- Integration tests materialize isolated owned stores and deterministic fixtures.
- Browser tests use production-like service contracts, not UI-only mocks for the primary flow.
- Containers are built per deployable; local Compose is orchestration, not a shared service boundary.
- Database migrations run per owner with forward/rollback or documented recovery.
- Phase/release validation occurs before promotion `dev -> test -> main`.

Docker availability is an environment concern. The doctor reports daemon/config issues without changing Windows services, Registry, firewall, Docker settings, or privileges.

## 14. Production architecture maturity

Production architecture is accumulated and evidenced in stages:

| Phase | Architecture proof                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| P1–P5 | Each product slice owns authorization, data, events, errors, telemetry, accessibility, and rollback applicable to its path |
| P6    | Versioned rolling compatibility, independently runnable artifacts, service identity, and dependency isolation              |
| P7    | Owner-scoped migrations, replay/reconciliation, backup/restore, retention/deletion, and polyglot exit plans                |
| P8    | Household isolation, consent enforcement, secret/encryption boundaries, artifact provenance, and abuse/privacy response    |
| P9    | Redacted end-to-end telemetry, SLO/error budget, actionable alerts, truthful degradation, incident and DR rehearsal        |
| P10   | Representative workload budgets, backpressure, bounded resources, scale correctness, capacity, and cost                    |
| P11   | Immutable deployment, protected environments, staged rollout, rollback, pilot, and released artifact evidence              |
| P12   | Operational ownership, patch/rotation/restore cadence, post-incident learning, and governed successor architecture         |

Later proof phases do not excuse an earlier slice from an applicable control.
No end-to-end demo is itself evidence that the system is production-ready.

## 15. Architecture fitness checks

At each slice/phase gate, verify:

- no service imports another service's business implementation;
- no connection string grants cross-service write access;
- contract compatibility and invalid payload tests pass;
- task/outbox atomicity and inbox deduplication are tested;
- duplicate commands/events are harmless;
- dashboard partial failure is truthful;
- logs and event fixtures contain no sensitive content;
- fixture identity cannot be enabled in a production configuration;
- design handoff and accessibility evidence exist for UI changes;
- planned versus actual technology is current.

## 16. Change process

An architecture change requires:

1. Change ID in `docs/IMPLEMENTATION_PLAN.md`;
2. ADR in `docs/DECISIONS.md`;
3. planned versus actual topology/data/contract update here;
4. integration impact in `docs/INTEGRATION_LOG.md`;
5. task/dependency update in `docs/WORKSTREAM_BOARD.md`;
6. validation, migration, rollback, and follow-up evidence in `docs/SESSION_LOG.md`.

No datastore, broker, auth provider, deployment platform, service split/merge, cross-service contract, or public trust-boundary change is accepted only through conversation.
