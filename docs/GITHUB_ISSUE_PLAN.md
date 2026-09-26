# GitHub Milestone, Label, and Issue Plan

## Control

- Repository: `toannnnq1424/life-bridge`
- Planning changes: `CHG-2026-003`, `CHG-2026-004`
- Canonical slice acceptance: `docs/IMPLEMENTATION_PLAN.md`
- Rule: one accepted slice equals one primary implementation issue.
- Detailed work packages remain checklists/subtasks unless they independently
  produce a user-visible end-to-end outcome.

The applied GitHub history below records the original P0–P6 publication under
`CHG-2026-003`. `CHG-2026-004` preserves P0–P5 and expands the overloaded
production campaign into P6–P12. The production catalog was applied and audited
on 2026-07-26; future state changes still require the same Change IDs and
canonical acceptance links.

Do not import the external 85-slice runbook as the issue backlog. Any later
expansion or resequencing requires Change Control. Future issues are not
`ready` merely because they are planned; apply `ready` only after dependencies
and the research gate pass. Apply `blocked` only for a real external or
decision gate, not for ordinary future sequencing.

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
| `reliability`   | `0f766e` | SLO, resilience, recovery, event reliability    |
| `performance`   | `f59e0b` | Load, latency, capacity, scaling, and cost      |
| `mcp-debt`      | `b60205` | Required MCP debt that blocks production deploy |

These are the only new labels required by `CHG-2026-004`. Reuse `backend`,
`data`, `security`, and `operations` instead of creating overlapping
`architecture`, `observability`, `release`, or generic `tech-debt` labels.

## Milestones

| ID       | Title                                                                             | Outcome                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MS-P0`  | P0 — Foundation                                                                   | Reproducible governed Windows baseline                                                                                                                         |
| `MS-P1`  | P1 — Daily task MVP                                                               | Accountable task loop works end to end                                                                                                                         |
| `MS-P2`  | P2 — Trust and household                                                          | Real access, household, consent, and audit                                                                                                                     |
| `MS-P3`  | P3 — Care planning                                                                | Timeline, appointment, and care-plan coordination                                                                                                              |
| `MS-P4`  | P4 — Safety and records                                                           | Safe reminders, emergency plan, and document vault                                                                                                             |
| `MS-P5`  | P5 — Community support                                                            | Consented help, matching, and moderation                                                                                                                       |
| `MS-P6`  | P6 — Service platform and contracts / Nền tảng dịch vụ và hợp đồng                | Independently deployable services, versioned contracts, and safe local/CI topology / Dịch vụ triển khai độc lập, hợp đồng phiên bản, topology local/CI an toàn |
| `MS-P7`  | P7 — Durable data and events / Dữ liệu và sự kiện bền vững                        | Service-owned migrations, reliable events, lifecycle, and recovery / Migration theo owner, sự kiện tin cậy, vòng đời và phục hồi                               |
| `MS-P8`  | P8 — Security and privacy assurance / Bảo đảm bảo mật và quyền riêng tư           | Trust boundaries, privacy lifecycle, abuse, and supply-chain assurance / Trust boundary, vòng đời riêng tư, chống lạm dụng và chuỗi cung ứng                   |
| `MS-P9`  | P9 — Observability and resilience / Quan sát hệ thống và khả năng phục hồi        | Measured SLOs, truthful degradation, incident and DR evidence / SLO đo được, suy giảm trung thực, bằng chứng incident và DR                                    |
| `MS-P10` | P10 — Performance, capacity, and cost / Hiệu năng, năng lực và chi phí            | Measured workload, scalability, capacity, and cost guardrails / Workload, mở rộng, năng lực và rào chắn chi phí đo được                                        |
| `MS-P11` | P11 — Production rollout and release / Triển khai production và phát hành         | Staged, reversible, evidence-backed production release / Phát hành production theo giai đoạn, rollback được và có bằng chứng                                   |
| `MS-P12` | P12 — Post-launch operations and improvement / Vận hành sau phát hành và cải tiến | Sustainable operations, patching, continuity, and evidence-driven improvement / Vận hành bền vững, vá lỗi, continuity và cải tiến từ bằng chứng                |

No due date is invented. A milestone receives a date only after capacity and
external gates are known.

## Provisioning result

- Applied: 2026-07-26 through authenticated GitHub API access; no credential
  value was written to an issue, document, log, or command output.
- Labels: [13 project labels](https://github.com/toannnnq1424/life-bridge/labels)
  are present, including `reliability`, `performance`, and `mcp-debt`, without
  removing GitHub defaults.
- Milestones:
  [P0](https://github.com/toannnnq1424/life-bridge/milestone/1),
  [P1](https://github.com/toannnnq1424/life-bridge/milestone/2),
  [P2](https://github.com/toannnnq1424/life-bridge/milestone/3),
  [P3](https://github.com/toannnnq1424/life-bridge/milestone/4),
  [P4](https://github.com/toannnnq1424/life-bridge/milestone/5),
  [P5](https://github.com/toannnnq1424/life-bridge/milestone/6),
  [P6](https://github.com/toannnnq1424/life-bridge/milestone/7),
  [P7](https://github.com/toannnnq1424/life-bridge/milestone/8),
  [P8](https://github.com/toannnnq1424/life-bridge/milestone/9),
  [P9](https://github.com/toannnnq1424/life-bridge/milestone/10),
  [P10](https://github.com/toannnnq1424/life-bridge/milestone/11),
  [P11](https://github.com/toannnnq1424/life-bridge/milestone/12), and
  [P12](https://github.com/toannnnq1424/life-bridge/milestone/13).
- Audit: all 21 P6–P12 slice issues match the planned title, label set, and
  milestone. This comprises 18 new issues plus preserved/remapped #18–#20.
  P6–P10 and P12 each contain three open slice issues; P11 contains three open
  slices plus the standing [zero-MCP-debt gate #40](https://github.com/toannnnq1424/life-bridge/issues/40).
  No milestone due date was invented.
- History: #18, #19, and #20 retain their former P6 bodies under `Previous
baseline / Baseline trước đây` and link `CHG-2026-004`; #20 no longer carries
  `ready`.
- MCP debt: [P1 gate #3](https://github.com/toannnnq1424/life-bridge/issues/3)
  now carries `mcp-debt` and records Design review—not Frozen—without a
  credential value or private Stitch identifier.
- Integration review:
  [PR #21, `phase/0-foundation` → `dev`](https://github.com/toannnnq1424/life-bridge/pull/21).
  Hosted-CI/merge evidence is updated at final P0 closeout; GitHub object
  provisioning does not waive `KI-012`.

### Applied P6–P12 slice mapping

| Slice    | GitHub                                                       | Slice    | GitHub                                                       | Slice    | GitHub                                                       |
| -------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------ |
| `P6-S1`  | [#22](https://github.com/toannnnq1424/life-bridge/issues/22) | `P6-S2`  | [#23](https://github.com/toannnnq1424/life-bridge/issues/23) | `P6-S3`  | [#24](https://github.com/toannnnq1424/life-bridge/issues/24) |
| `P7-S1`  | [#25](https://github.com/toannnnq1424/life-bridge/issues/25) | `P7-S2`  | [#26](https://github.com/toannnnq1424/life-bridge/issues/26) | `P7-S3`  | [#27](https://github.com/toannnnq1424/life-bridge/issues/27) |
| `P8-S1`  | [#28](https://github.com/toannnnq1424/life-bridge/issues/28) | `P8-S2`  | [#29](https://github.com/toannnnq1424/life-bridge/issues/29) | `P8-S3`  | [#30](https://github.com/toannnnq1424/life-bridge/issues/30) |
| `P9-S1`  | [#31](https://github.com/toannnnq1424/life-bridge/issues/31) | `P9-S2`  | [#18](https://github.com/toannnnq1424/life-bridge/issues/18) | `P9-S3`  | [#32](https://github.com/toannnnq1424/life-bridge/issues/32) |
| `P10-S1` | [#33](https://github.com/toannnnq1424/life-bridge/issues/33) | `P10-S2` | [#34](https://github.com/toannnnq1424/life-bridge/issues/34) | `P10-S3` | [#35](https://github.com/toannnnq1424/life-bridge/issues/35) |
| `P11-S1` | [#19](https://github.com/toannnnq1424/life-bridge/issues/19) | `P11-S2` | [#36](https://github.com/toannnnq1424/life-bridge/issues/36) | `P11-S3` | [#20](https://github.com/toannnnq1424/life-bridge/issues/20) |
| `P12-S1` | [#37](https://github.com/toannnnq1424/life-bridge/issues/37) | `P12-S2` | [#38](https://github.com/toannnnq1424/life-bridge/issues/38) | `P12-S3` | [#39](https://github.com/toannnnq1424/life-bridge/issues/39) |

## Applied issue catalog before `CHG-2026-004`

| ID       | Title                                                       | Milestone | Labels                                               | Dependency                                              | GitHub                                                             |
| -------- | ----------------------------------------------------------- | --------- | ---------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `GH-001` | `[P0] Establish governed Windows foundation`                | P0        | `operations`, `data`, `accessibility`                | None; completed baseline                                | [#2 closed](https://github.com/toannnnq1424/life-bridge/issues/2)  |
| `GH-002` | `[GATE-P1] Activate Stitch MCP and freeze P1 handoff`       | P1        | `design`, `security`, `accessibility`, `blocked`     | Credential owner and read-only canary                   | [#3 blocked](https://github.com/toannnnq1424/life-bridge/issues/3) |
| `GH-003` | `[DATA-S1] Pin aggregate context fixture with provenance`   | P1        | `research`, `data`, `ready`                          | `init/research` lane                                    | [#4](https://github.com/toannnnq1424/life-bridge/issues/4)         |
| `GH-004` | `[P1-S1] Accountable care-task loop`                        | P1        | `frontend`, `backend`, `accessibility`, `ready`      | P0; GH-002 before production UI                         | [#5](https://github.com/toannnnq1424/life-bridge/issues/5)         |
| `GH-005` | `[P2-S1] Account access and accessible onboarding`          | P2        | `frontend`, `backend`, `security`, `accessibility`   | P1 contracts                                            | [#6](https://github.com/toannnnq1424/life-bridge/issues/6)         |
| `GH-006` | `[P2-S2] Household, invitation, and care-recipient context` | P2        | `frontend`, `backend`, `security`                    | P2-S1                                                   | [#7](https://github.com/toannnnq1424/life-bridge/issues/7)         |
| `GH-007` | `[P2-S3] Consent, privacy, audit, and settings`             | P2        | `frontend`, `backend`, `security`                    | P2-S2                                                   | [#8](https://github.com/toannnnq1424/life-bridge/issues/8)         |
| `GH-008` | `[P3-S1] Daily timeline and handoff`                        | P3        | `frontend`, `backend`, `accessibility`               | P1 task; P2 roles/consent                               | [#9](https://github.com/toannnnq1424/life-bridge/issues/9)         |
| `GH-009` | `[P3-S2] Calendar and appointment coordination`             | P3        | `frontend`, `backend`, `accessibility`               | P3-S1 time contract                                     | [#10](https://github.com/toannnnq1424/life-bridge/issues/10)       |
| `GH-010` | `[P3-S3] Care-plan review`                                  | P3        | `frontend`, `backend`, `security`                    | P2 consent; P3 time                                     | [#11](https://github.com/toannnnq1424/life-bridge/issues/11)       |
| `GH-011` | `[P4-S1] Medication reminder acknowledgement`               | P4        | `frontend`, `backend`, `security`, `accessibility`   | P3 time; notification                                   | [#12](https://github.com/toannnnq1424/life-bridge/issues/12)       |
| `GH-012` | `[P4-S2] Emergency contacts and offline-readable plan`      | P4        | `frontend`, `security`, `accessibility`              | Consent and offline threat review                       | [#13](https://github.com/toannnnq1424/life-bridge/issues/13)       |
| `GH-013` | `[P4-S3] Access-controlled document vault`                  | P4        | `frontend`, `backend`, `data`, `security`            | Storage/scanner ADR and consent                         | [#14](https://github.com/toannnnq1424/life-bridge/issues/14)       |
| `GH-014` | `[P5-S1] Consented help request and directory`              | P5        | `frontend`, `backend`, `research`, `security`        | P2 consent; ADR-019; official Spring toolchain research | [#15](https://github.com/toannnnq1424/life-bridge/issues/15)       |
| `GH-015` | `[P5-S2] Volunteer match and organization coordination`     | P5        | `frontend`, `backend`, `security`                    | P5-S1 and safeguarding                                  | [#16](https://github.com/toannnnq1424/life-bridge/issues/16)       |
| `GH-016` | `[P5-S3] Moderation resolution`                             | P5        | `frontend`, `backend`, `security`                    | P5-S2 and moderation policy                             | [#17](https://github.com/toannnnq1424/life-bridge/issues/17)       |
| `GH-017` | `[P6-S1] Offline, conflict, and reusable-state hardening`   | P6        | `frontend`, `backend`, `accessibility`, `operations` | Release flow inventory                                  | [#18](https://github.com/toannnnq1424/life-bridge/issues/18)       |
| `GH-018` | `[P6-S2] Production deployment and operations`              | P6        | `backend`, `data`, `security`, `operations`          | Accepted release scope/platform                         | [#19](https://github.com/toannnnq1424/life-bridge/issues/19)       |
| `GH-019` | `[P6-S3] Demo, submission, and release`                     | P6        | `accessibility`, `operations`, `ready`               | P6-S1 and P6-S2                                         | [#20](https://github.com/toannnnq1424/life-bridge/issues/20)       |

This table is retained as publication history. It is not the post-change
execution baseline.

### `CHG-2026-011` amendment to existing issue #15

Do not create a duplicate P5-S1 issue. Existing issue #15 is the implementation
owner for the first Spring Boot Community boundary. Its acceptance must retain
the consented request/directory outcome and add:

- one greenfield Community service extended through P5-S2/P5-S3; no rewrite of
  Gateway, Identity & Consent, Care Coordination or Notification;
- Community-owned PostgreSQL role/database/migrations/outbox/audit with no
  cross-service SQL, credential or business-code import;
- Node Gateway ↔ Spring versioned OpenAPI/JSON Schema provider/consumer tests,
  with Identity & Consent authoritative and minimum context only;
- PostgreSQL search first; no Elasticsearch, Redis, broker or object storage
  without later measured evidence and an accepted ADR;
- a P5 official-source gate that pins the supported JDK distribution/version,
  Spring Boot version, Maven plugins/checksums and repository-owned Windows
  wrapper, preferably `mvnw.cmd`, before Java source exists;
- P6 mixed-version, independent artifact/upgrade, dependency isolation,
  health/readiness, observability, SBOM/supply-chain, container and rollback
  evidence.

## Accepted P6–P12 issue catalog

### Catalog-wide gate

Before each phase, record the gate required by
`docs/research/RESEARCH_PROTOCOL.md`. Before each slice, run the bounded
research micro-cycle. A production-impacting slice requires `PASS`;
`PASS WITH ASSUMPTIONS` is allowed only for a reversible pre-production
experiment with named assumptions. `BLOCKED` stops dependent work.
`NOT APPLICABLE` requires a written rationale. Prefer current official sources;
for privacy, public claims, and Vietnam-specific decisions, record applicability
and the local evidence gap explicitly.

Every phase close must reconcile planned versus actual work, record any
deviation under the same Change ID, run its Level D checkpoint once, and
publish the exact next phase objective, slices, dependencies, research gates,
and first action in repository docs and GitHub. Do not begin that next phase in
the closing task.

### P6 — Service platform and contracts

#### `GH-020` — new issue

- Exact title: `[P6-S1] Deployable service boundaries / Ranh giới dịch vụ triển khai độc lập`
- Labels: `backend`, `operations`, `reliability`
- Dependencies: accepted P1–P5 release scope and working hosted CI.
- Research gate: `PASS`; current service-boundary and runtime evidence.
- Outcome VI: Mỗi service build, start, health-check và triển khai độc lập,
  không truy cập business implementation hoặc database của service khác.
- Outcome EN: Each service builds, starts, reports health, and deploys
  independently without accessing another service's business implementation or
  database.
- Acceptance summary: separate entrypoint/config/build/health; explicit owner;
  no cross-service SQL or business import; one correlated gateway-to-service
  path; architecture fitness, contract, integration, and failure tests.

#### `GH-021` — new issue

- Exact title: `[P6-S2] Versioned API and event contracts / Hợp đồng API và sự kiện có phiên bản`
- Labels: `backend`, `data`, `operations`, `reliability`
- Dependencies: `P6-S1` and the P1–P5 contract inventory.
- Research gate: `PASS`; current OpenAPI, schema, and event-compatibility
  evidence.
- Outcome VI: Producer và consumer nâng cấp độc lập trong compatibility window
  đã công bố.
- Outcome EN: Producers and consumers evolve independently within a documented
  compatibility window.
- Acceptance summary: versioned HTTP/event envelopes; compatibility and
  deprecation policy; consumer fixtures; breaking-change gate; idempotency,
  correlation, minimum-data, and generated-contract drift checks.

#### `GH-022` — new issue

- Exact title: `[P6-S3] Secure local and CI microservice topology / Topology microservice an toàn cho local và CI`
- Labels: `backend`, `data`, `security`, `operations`, `reliability`
- Dependencies: `P6-S1`, `P6-S2`, and a Docker doctor result that clears or
  safely classifies `KI-004`.
- Research gate: `PASS`; official container, network, configuration, and health
  evidence.
- Outcome VI: Windows local và CI khởi động cùng topology production-like bằng
  dữ liệu tổng hợp.
- Outcome EN: Windows local and CI start the same production-like topology
  using synthetic data.
- Acceptance summary: service-owned databases, credentials, and networks;
  liveness/readiness/start order; one cross-service smoke path; truthful
  dependency degradation; secret/image checks; idempotent bootstrap; no
  machine-wide Docker or Windows configuration mutation.

### P7 — Durable data and events

#### `GH-023` — new issue

- Exact title: `[P7-S1] Service-owned schema migration safety / An toàn migration schema do service sở hữu`
- Labels: `backend`, `data`, `operations`, `reliability`
- Dependencies: `P6-S3` and a frozen schema inventory.
- Research gate: `PASS`; exact database and migration-tool version evidence.
- Outcome VI: Mỗi service nâng cấp schema mà không tạo shared ownership hoặc
  downtime ngoài ngân sách.
- Outcome EN: Each service evolves its schema without shared ownership or
  unbudgeted downtime.
- Acceptance summary: owner-specific migration ledger;
  expand-migrate-contract; upgrade and rollback/compensation rehearsal;
  concurrent-version test; credential isolation; pre-migration recovery point.

#### `GH-024` — new issue

- Exact title: `[P7-S2] Reliable event delivery and replay / Phân phối và phát lại sự kiện tin cậy`
- Labels: `backend`, `data`, `operations`, `reliability`
- Dependencies: `P6-S2` and `P7-S1`.
- Research gate: `PASS`; transport/outbox semantics for the selected technology,
  not an assumed broker.
- Outcome VI: Event không bị mất hoặc tạo hiệu ứng trùng qua timeout, retry,
  crash và replay.
- Outcome EN: Events are not lost and do not duplicate effects across timeout,
  retry, crash, and replay.
- Acceptance summary: atomic outbox; inbox deduplication; bounded
  retry/backoff; visible terminal-attention state; ordering/version rules;
  deterministic replay; safe telemetry.

#### `GH-025` — new issue

- Exact title: `[P7-S3] Data lifecycle, recovery, and persistence decisions / Vòng đời, phục hồi và quyết định lưu trữ dữ liệu`
- Labels: `data`, `security`, `operations`, `reliability`
- Dependencies: `P7-S1`, `P7-S2`, and P2 consent/privacy contracts.
- Research gate: `PASS`; applicable privacy/retention and exact datastore
  recovery evidence; `BLOCKED` if applicability is unresolved.
- Outcome VI: Mọi datastore có owner, source of truth, retention, deletion,
  export và recovery đã kiểm chứng.
- Outcome EN: Every datastore has a verified owner, source of truth, retention,
  deletion, export, and recovery path.
- Acceptance summary: service-level restore and measured RPO/RTO; encryption
  and access; retention/delete/export tests; PostgreSQL-only decision or an
  accepted polyglot ADR; no cross-service ownership.

### P8 — Security and privacy assurance

#### `GH-026` — new issue

- Exact title: `[P8-S1] Threat model and authorization isolation / Mô hình đe dọa và cô lập phân quyền`
- Labels: `backend`, `security`, `operations`
- Dependencies: `P6-S3` and P2 identity/consent.
- Research gate: `PASS`; current OWASP/NIST, applicable Vietnamese
  requirements, and specialist review where required.
- Outcome VI: Actor, household, service và datastore bị giới hạn theo least
  privilege.
- Outcome EN: Actors, households, services, and datastores are constrained by
  least privilege.
- Acceptance summary: threat/data-flow model; service identity; credential
  rotation; cross-household and non-disclosure tests; deny by default; fixture
  identity cannot activate in production.

#### `GH-027` — new issue

- Exact title: `[P8-S2] Privacy lifecycle and auditable rights / Vòng đời quyền riêng tư và quyền có thể kiểm toán`
- Labels: `backend`, `data`, `security`, `operations`
- Dependencies: `P8-S1` and `P7-S3`.
- Research gate: `PASS`; applicable official privacy guidance and qualified
  review before public claims.
- Outcome VI: Consent, revocation, access, export, retention và deletion hoạt
  động nhất quán, có kiểm toán.
- Outcome EN: Consent, revocation, access, export, retention, and deletion
  behave consistently and audibly.
- Acceptance summary: minimum-data inventory; revocation propagation;
  export/delete/retention tests; redacted audit evidence; bilingual privacy
  copy; log and event privacy checks.

#### `GH-028` — new issue

- Exact title: `[P8-S3] Abuse, secrets, and software supply-chain hardening / Gia cố chống lạm dụng, bí mật và chuỗi cung ứng phần mềm`
- Labels: `security`, `operations`, `reliability`
- Dependencies: `P8-S1`, `P8-S2`, and hosted CI.
- Research gate: `PASS`; current standards, advisories, and provider security
  guidance.
- Outcome VI: Abuse, credential leak và compromised dependency được ngăn chặn
  hoặc phát hiện trước release.
- Outcome EN: Abuse, credential leakage, and compromised dependencies are
  prevented or detected before release.
- Acceptance summary: abuse/rate-limit cases; secret and history scanning;
  pinned dependencies/actions; SBOM and artifact provenance; vulnerability
  triage threshold; no unresolved release-threshold finding.

### P9 — Observability and resilience

#### `GH-029` — new issue

- Exact title: `[P9-S1] End-to-end observability and SLO baseline / Quan sát xuyên suốt và đường cơ sở SLO`
- Labels: `backend`, `operations`, `reliability`
- Dependencies: `P6-S3`, `P7-S2`, and P8 telemetry/privacy controls.
- Research gate: `PASS`; measured baseline, not invented reliability targets.
- Outcome VI: Operator xác định service, dependency và user journey đang lỗi mà
  không lộ dữ liệu nhạy cảm.
- Outcome EN: Operators can identify the failing service, dependency, and user
  journey without exposing sensitive data.
- Acceptance summary: correlation and traces; redacted structured logs; golden
  signals; journey SLI/SLO/error budgets; actionable alerts; dashboard and
  telemetry-schema tests.

#### `GH-017` — remap existing issue #18

- Exact title: `[P9-S2] Offline, conflict, and graceful degradation / Ngoại tuyến, xung đột và suy giảm an toàn`
- Labels: `frontend`, `backend`, `accessibility`, `operations`, `reliability`
- Dependencies: `P9-S1` and the frozen release-journey inventory.
- Research gate: `PASS`; current browser/platform evidence and actual flow
  inventory.
- Outcome VI: UI phân biệt đúng queued, stale, conflict, rejected,
  dependency-failed và confirmed.
- Outcome EN: The UI truthfully distinguishes queued, stale, conflicted,
  rejected, dependency-failed, and confirmed states.
- Acceptance summary: deterministic reconnect/reconciliation; partial
  dependency fallback; no false saved state; keyboard/screen-reader
  transitions; reflow/forced-color/long VI-EN text; cross-flow browser tests.

#### `GH-030` — new issue

- Exact title: `[P9-S3] Incident response and disaster-recovery game day / Diễn tập ứng phó sự cố và khôi phục thảm họa`
- Labels: `data`, `security`, `operations`, `reliability`
- Dependencies: `P7-S3`, `P8-S3`, `P9-S1`, and `P9-S2`.
- Research gate: `PASS`; approved RTO/RPO and current provider/database
  recovery evidence.
- Outcome VI: Team phát hiện, cô lập, phục hồi và giải thích một sự cố giả lập
  trong mục tiêu đã duyệt.
- Outcome EN: The team detects, contains, recovers from, and explains a
  simulated incident within approved objectives.
- Acceptance summary: bounded failure injection; roles and runbooks; full
  restore/replay; measured RTO/RPO; safe communication; postmortem; no blind
  destructive recovery command.

### P10 — Performance, capacity, and cost

#### `GH-031` — new issue

- Exact title: `[P10-S1] Representative workloads and performance budgets / Workload đại diện và ngân sách hiệu năng`
- Labels: `backend`, `data`, `operations`, `performance`
- Dependencies: `P9-S1` and the release-journey inventory.
- Research gate: `PASS`; fixture or pilot-backed workload assumptions, not
  fabricated production traffic.
- Outcome VI: Mỗi critical journey có workload, latency và resource budget đo
  được.
- Outcome EN: Every critical journey has a measurable workload, latency, and
  resource budget.
- Acceptance summary: synthetic bilingual data; concurrency/data-volume model;
  p50/p95/p99/error baseline; hot-path profile; named assumptions and recheck
  triggers.

#### `GH-032` — new issue

- Exact title: `[P10-S2] Load, soak, backpressure, and scaling validation / Kiểm chứng tải, soak, backpressure và mở rộng`
- Labels: `backend`, `operations`, `performance`, `reliability`
- Dependencies: `P10-S1` and `P9-S3`.
- Research gate: `PASS`; reproducible measurements against the exact commit.
- Outcome VI: Hệ thống giữ dữ liệu đúng và suy giảm có kiểm soát khi tải cao
  hoặc queue bão hòa.
- Outcome EN: The system preserves correctness and degrades safely under high
  load or queue saturation.
- Acceptance summary: load and soak; rate limits/backpressure; queue
  saturation/recovery; no lost or duplicate effect; scaling evidence;
  performance regression test.

#### `GH-033` — new issue

- Exact title: `[P10-S3] Capacity, autoscaling, and cost guardrails / Rào chắn năng lực, autoscaling và chi phí`
- Labels: `data`, `operations`, `performance`, `reliability`
- Dependencies: `P10-S2` and the selected hosting platform.
- Research gate: `PASS`; timestamped provider quotas/pricing and explicit
  recheck trigger.
- Outcome VI: Release có capacity envelope, scaling policy và cost ceiling có
  cảnh báo.
- Outcome EN: The release has an evidence-backed capacity envelope, scaling
  policy, and alerted cost ceiling.
- Acceptance summary: resource model; min/max scaling; quota behavior;
  cost-by-workload; budget alerts; dated assumptions and rollback.

### P11 — Production rollout and release

#### `GH-018` — remap existing issue #19

- Exact title: `[P11-S1] Reproducible production environment and protected promotion / Môi trường production tái lập và promotion được bảo vệ`
- Labels: `backend`, `data`, `security`, `operations`, `reliability`
- Dependencies: P6–P10 phase gates, external platform credentials, and zero
  open `mcp-debt`.
- Research gate: `PASS`; current provider/security evidence and environment
  applicability.
- Outcome VI: Exact commit build, migrate, start và smoke-test trên production
  mà không dùng fixture auth hoặc secret trong Git.
- Outcome EN: The exact commit builds, migrates, starts, and passes production
  smoke tests without fixture authentication or repository secrets.
- Acceptance summary: immutable artifacts and reproducible configuration;
  injected secrets; service-owned credentials/datastores; health/readiness;
  backup/restore evidence; protected promotion; deployment and rollback docs.

#### `GH-034` — new issue

- Exact title: `[P11-S2] Staged rollout, rollback, and pilot readiness / Triển khai theo giai đoạn, rollback và sẵn sàng pilot`
- Labels: `security`, `operations`, `reliability`
- Dependencies: `P11-S1` and accepted P9/P10 evidence.
- Research gate: `PASS`; provider rollout evidence and named pilot
  consent/support owner.
- Outcome VI: Release triển khai theo cohort, quan sát được và rollback mà không
  phá data contract.
- Outcome EN: The release rolls out by observable cohort and rolls back without
  violating data contracts.
- Acceptance summary: staged/canary plan; go/no-go metrics; compatibility
  window; rollback triggers and rehearsal; pilot support, privacy, and incident
  path.

#### `GH-019` — remap existing issue #20

- Exact title: `[P11-S3] Release candidate, demo, and truthful public launch / Release candidate, demo và phát hành công khai trung thực`
- Labels: `accessibility`, `operations`, `reliability`
- Dependencies: `P11-S2`, zero release blockers, and zero open `mcp-debt`.
- Research gate: `PASS`; every public claim is traceable and no required
  legal/security review remains unresolved.
- Outcome VI: Reviewer cài đặt, chạy và xem đúng những gì repository thực sự hỗ
  trợ.
- Outcome EN: A reviewer can install, run, and observe only behavior the
  repository actually supports.
- Acceptance summary: clean install; full CI/build/deployment smoke/demo
  rehearsal; synthetic media; synchronized README/demo/submission/limitations;
  tagged exact candidate; PR/check evidence.

### P12 — Post-launch operations and improvement

#### `GH-035` — new issue

- Exact title: `[P12-S1] Production monitoring and incident operations / Giám sát production và vận hành sự cố`
- Labels: `security`, `operations`, `reliability`
- Dependencies: `P11-S3` and named operator ownership.
- Research gate: `PASS`; actual telemetry and support model, not invented
  uptime.
- Outcome VI: Mỗi alert có owner, escalation, communication và closure
  evidence.
- Outcome EN: Every production alert has ownership, escalation,
  communication, and closure evidence.
- Acceptance summary: on-call/owner rota; alert routing; SLO/error-budget
  review; incident/status procedure; privileged-access audit; post-incident
  GitHub follow-up.

#### `GH-036` — new issue

- Exact title: `[P12-S2] Patch, backup, and continuity maintenance / Bảo trì vá lỗi, sao lưu và tính liên tục`
- Labels: `data`, `security`, `operations`, `reliability`
- Dependencies: `P12-S1`.
- Research gate: `PASS`; current advisories, runtime/provider EOL, and restore
  evidence.
- Outcome VI: Dependency, runtime, secret và backup được bảo trì theo lịch và
  kiểm chứng.
- Outcome EN: Dependencies, runtimes, secrets, and backups are maintained on a
  verified schedule.
- Acceptance summary: patch/EOL register; emergency patch path; key rotation;
  recurring restore/replay drill; maintenance window; rollback; supply-chain
  revalidation.

#### `GH-037` — new issue

- Exact title: `[P12-S3] Privacy-safe product evidence and roadmap improvement / Bằng chứng sản phẩm an toàn quyền riêng tư và cải tiến roadmap`
- Labels: `research`, `data`, `accessibility`, `operations`
- Dependencies: `P12-S1`, `P12-S2`, and approved privacy-safe metrics.
- Research gate: `PASS`; aggregate/product/user evidence with consent and no
  medical inference.
- Outcome VI: Roadmap tiếp theo được quyết định từ outcome, incident,
  accessibility, cost và user evidence thật.
- Outcome EN: The next roadmap is decided from real outcome, incident,
  accessibility, cost, and user evidence.
- Acceptance summary: privacy-safe metrics; feedback/research safeguards;
  planned-versus-actual review; a `CHG-*` for every deviation; exact next phase
  objective, slices, dependencies, gates, and first action published.

## Controlled mapping for existing issues #18–#20

| Existing issue                                               | Accepted action                                                                   | Historical acceptance disposition                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [#18](https://github.com/toannnnq1424/life-bridge/issues/18) | Retitle and move to `P9-S2`; do not close                                         | Preserve offline, conflict, accessibility, and truthful-state acceptance; the old `P6-S1` identity is superseded by `CHG-2026-004`        |
| [#19](https://github.com/toannnnq1424/life-bridge/issues/19) | Retitle and move to `P11-S1`; do not close                                        | Split platform, data, security, resilience, and performance prerequisites into P6–P10; #19 retains actual production deployment ownership |
| [#20](https://github.com/toannnnq1424/life-bridge/issues/20) | Retitle and move to `P11-S3`; remove `ready` until entry gates pass; do not close | Preserve truthful demo/release acceptance; move post-launch operation to P12                                                              |

Each remapped body must retain a `Previous baseline / Baseline trước đây`
section linked to `CHG-2026-004`. Never delete or rewrite the old acceptance to
make the change look original.

## MCP debt and standing production gate

Create one additional gate issue:

- ID: `GH-038`
- Exact title: `[GATE-P11] Clear required MCP debt before production deployment / Xử lý MCP debt bắt buộc trước khi deploy production`
- Milestone: P11
- Labels: `mcp-debt`, `operations`, `security`, `blocked`
- Dependency: every open issue carrying `mcp-debt`.
- Research gate: `NOT APPLICABLE`; record that this is capability and credential
  verification, not domain research.
- Outcome VI: Không còn MCP bắt buộc bị thiếu, chưa xác minh hoặc dùng
  credential không phù hợp trước production deploy.
- Outcome EN: No required MCP capability is missing, unverified, or using an
  unsuitable credential before production deployment.
- Acceptance summary: GitHub query `is:issue is:open label:mcp-debt` returns
  zero; every required MCP has schema review, least privilege, approved secret
  storage, and a canary, or an accepted Change ID proves it is no longer
  required; no credential value is copied to an issue, document, log, or commit.

When an active task requests a required MCP, record the capability, slice,
least privilege, reason, and request time. If no user response arrives within
180 seconds, do not infer permission or edit global configuration. Create or
mark `[MCP-DEBT][<slice>] <capability> / <năng lực>`, continue only with a safe
fallback that still satisfies the current acceptance, and carry the issue as a
production blocker. Close it only after verified integration or an accepted
de-scope. Existing Stitch gate #3 receives `mcp-debt` until its credential,
canary, and reviewed handoff pass; never copy a disclosed credential value into
GitHub.

Local/CI container validation may continue around unrelated MCP debt. External
production deployment, `test` → `main`, and `P11-S3` are prohibited while the
standing gate is open.

## PR-only GitHub Network topology

```text
init/research
    | pull request + merge commit: bilingual research/provenance validation
    v
data
    | pull request + merge commit: source/schema/fixture/migration contract
    v
dev <-------- phase/<phase-or-slice>
    |              |
    |              +-- branch from dev; one task; Level C; PR + merge commit
    |
    | pull request + merge commit: completed phase and Level D evidence
    v
test
    | pull request + merge commit: release/security/deployment gates
    v
main
    +-- immutable production release and tag
```

| Branch          | Ownership and merge rule                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`          | Release-only and protected; accept PRs from `test` only; no direct push; exact commit receives required CI/security/deployment evidence and release tag |
| `test`          | Integrated release candidate; accept PRs from `dev` only after the phase Level D gate                                                                   |
| `dev`           | Integration trunk; accept reviewed PRs from `phase/*` and `data`                                                                                        |
| `data`          | Reviewed source, provenance, schema, fixture, and migration lane; accept PRs from `init/research`; never store raw sensitive microdata                  |
| `init/research` | Bilingual 2016–2026 investigation and source cards; no secrets, PII, or production care records                                                         |
| `phase/*`       | Short-lived branch from `dev`; exactly one phase or vertical slice; target `dev`; never use `codex/*`                                                   |

Every cross-lane promotion is PR-only and uses GitHub's **Create a merge
commit** strategy. Do not squash, rebase-merge, cherry-pick around a gate, or
push directly to a long-lived branch. This preserves ancestry and makes the
governed flow visible in GitHub Network. A change to the topology or merge
strategy requires Change Control and an integration-log entry.

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
10. exact handoff/next action;
11. bilingual planned-versus-actual status;
12. phase-exit evidence and the exact next-phase direction when applicable;
13. branch source, PR target, and merge-commit evidence.

The P0 issue is created as historical evidence and closed only after its commit,
validation, and branch links are recorded. `GH-002` remains blocked and carries
`mcp-debt` until the credential, canary, and reviewed handoff conditions pass.
No issue, label, milestone, mapping, or live URL in the accepted target catalog
may be reported as provisioned until it has been applied and audited against
GitHub.
