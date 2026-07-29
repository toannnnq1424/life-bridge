# P5-S3 Test, CI, and Operations Review

Status: independent mandatory pre-code review complete; implementation remains
blocked until this review is reconciled with the contract/data/authority/threat
review and the Frozen redacted `LB-027` Stitch handoff.

Reviewed: 2026-07-29

Slice: `P5-S3 — Moderation resolution`

Accepted starting point:
`origin/dev@ed328f6806f1ed082708e7c84367eda6bb1bb2da`, including P5-S2 feature PR
#68, same-task documentation closeout PR #69, green exact-head and post-merge
CI, and closed issue #16.

## Independent conclusion

P5-S3 can extend the accepted Node Gateway ↔ Spring Community boundary and
Community-owned PostgreSQL without a new service, engine, broker, cache, or
cross-service data access. Before code, freeze one language-neutral `P5-S3-v1`
contract for a least-privilege moderator queue/detail read and one bounded,
auditable report resolution. Every protected read and command requires a fresh,
exact-purpose P2 authority decision; role labels never grant authority.

The proof must establish authoritative Community truth, minimum redacted
evidence, atomic decision/audit/outbox/idempotency, deterministic concurrency,
bounded retention/deletion, anti-enumerating failures, and safe uncertain-result
reconciliation. Tests must not infer or claim diagnosis, treatment, urgency,
danger, guilt, criminality, abuse validity, eligibility, safety, endorsement,
automated moderation accuracy, or external enforcement outcome.

## Evidence and ownership inspected

This review inspected the accepted P5-S2 review, frozen P5-S2 OpenAPI/JSON
Schemas and digest vectors, Gateway consumer tests, Community migration and
contract-integrity tools, validation scripts, root command surface, and current
Git identity. It did not modify Java/product UI and did not read, edit, stage,
or rewrite `docs/orchestration/reports/STITCH_MCP_CANARY.md`.

Community exclusively owns report, moderation-case, resolution, idempotency,
audit, and outbox persistence. Identity & Consent exclusively owns moderator
authority. Gateway may orchestrate fresh authority and forward only the frozen
minimum context; it must not persist or fabricate Community state. Care and
Notification ownership remains unchanged.

## Provider/consumer contract proof to freeze

Freeze versioned OpenAPI plus closed JSON Schemas (`additionalProperties:
false`) and canonical digest vectors for these independent surfaces:

- queue query/result with bounded cursor, sort, filter enums, redacted summary,
  state, version, retention/redaction indicators, and no sensitive narrative;
- report/case detail query/result with only minimum decision-relevant redacted
  evidence, provenance, authoritative state/version, permitted outcome/reason
  enums, and retention/deletion truth;
- resolve command/result with case/report ID, `expectedVersion`, bounded outcome
  and reason codes, explicit confirmation token/version where required,
  idempotency key, correlation/causation IDs, and fresh request-bound authority;
- immutable privileged-access and resolution audit/outbox events containing
  bounded opaque identifiers, actor reference/digest, purpose, policy version,
  timestamps, result/version, redaction/retention facts, and no evidence body;
- stable failures for validation, denied/fresh authority required, missing,
  stale/concurrent conflict, already resolved/withdrawn/expired, idempotency
  conflict/replay, invalid outcome/reason, redaction/retention conflict,
  Identity/Community unavailable, audit/outbox failure, offline blocked, and
  post-send outcome uncertain.

Node and Spring must consume the same fixture bytes and checksum manifest.
Required proof includes Node schema parsing and unknown-field rejection,
Gateway path/method/header/body/response mapping, Spring provider MockMvc tests,
and a contract-integrity tool comparing every OpenAPI/schema/vector digest.
`/version` may advertise `P5-S3-v1`; readiness must not claim dependencies are
healthy when they are not. Neither runtime imports the other's business code or
credentials.

Every Gateway protected request must first obtain a fresh P2 decision bound to
actor, exact method/path/body digest, purpose, permission, scope, decision ID,
expiry, and current time. Tests must alter each binding independently and prove
Community is not called. Only minimum authorized context crosses the boundary;
cookies, bearer tokens, credentials, display names, contact data, raw evidence,
free-form notes, and excess Identity fields must not cross.

Denied and missing resources must be externally indistinguishable in status,
shape, timing tolerance, cache policy, and telemetry. Correlation and safe
reconciliation metadata are allowed; existence, current assignee, evidence,
reporter, subject, or policy-sensitive details are not.

## State, concurrency, idempotency, and failure matrix

Provider, consumer, integration, and browser fixtures must share these truths:

| Scenario                                | Required authoritative result                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| authorized queue/detail read            | one privileged-access audit; minimum redacted fields only                                              |
| denied or missing                       | identical anti-enumerating response; no disclosure or state mutation                                   |
| withdrawn/expired/already resolved      | bounded terminal truth; resolution command cannot overwrite it                                         |
| valid resolution                        | exactly one version increment plus one idempotency result, audit, and outbox record in one transaction |
| retry, same key and intent              | byte-equivalent replay; no duplicate mutation/audit/outbox                                             |
| same key, changed intent                | idempotency conflict; no mutation                                                                      |
| two decisions at same version           | start barrier and independent connections; exactly one winner, one safe conflict                       |
| stale version                           | safe current state/version only; no evidence disclosure                                                |
| invalid outcome/reason/pair             | validation failure before persistence                                                                  |
| redaction or retention conflict         | block action; never restore deleted/redacted evidence                                                  |
| authority expires/revokes before action | no Community mutation                                                                                  |
| Identity unavailable                    | protected read/write fails closed without fabricated state                                             |
| Community unavailable before send       | blocked, retry-safe, not persisted                                                                     |
| connection lost after send              | uncertain; reconcile with same idempotency key/read before another command                             |
| audit/outbox/idempotency write fault    | entire decision transaction rolls back                                                                 |

Concurrency tests require a deterministic barrier rather than timing. Assert one
committed case version, one applicable immutable audit record, one applicable
outbox record, stable replay, and no automatic resolve/escalate/suspend. A
resolution result describes only the chosen bounded Community action; it cannot
claim an external enforcement outcome.

## Community PostgreSQL/Flyway V3 acceptance

Use a Community-owned forward migration such as
`V3__p5_s3_moderation_resolution.sql`. The validation tool must provision two
owner-isolated databases, apply V1 and V2, insert synthetic sentinels into all
relevant accepted tables, snapshot counts and stable row digests, then:

1. force V3 to fail transactionally and prove no partial object/version remains;
2. apply V3 and prove every V1/V2 sentinel count/digest is unchanged;
3. prove all new P5-S3 business/audit/outbox tables are empty (no backfill,
   synthetic report, default decision, inferred policy, or generated evidence);
4. prove Flyway history and `community_schema_state` advance exactly to 3;
5. apply explicit test-only rollback, prove V1/V2 remain intact, reapply V3,
   and compare schema fingerprints;
6. run Flyway again and prove a no-op;
7. prove foreign service roles receive SQLSTATE `42501` for Community tables
   and the Community role receives `42501` against foreign service databases.

Rollback SQL is test evidence only, outside forward Flyway resources. Database
constraints must bound enums, identifiers, timestamps, versions, redaction and
retention states, uniqueness, idempotency intent digests, and event payload
shape. No free-form sensitive column or JSON payload is permitted merely for
convenience. Retention/deletion tests use a controllable clock and frozen policy
version; they prove evidence minimization/deletion without deleting immutable
audit truth, and prove audit/outbox never retain the redacted payload.

## Spring, Gateway, privacy, and security proof

PostgreSQL-backed Spring tests must prove queue/detail/resolution truth,
withdrawn/expired/already-resolved behavior, policy-version enforcement,
redaction and retention conflicts, deterministic concurrency, replay, and
transactional fault injection after each state/idempotency/audit/outbox write.
Every failure before commit leaves all four stores unchanged. Privileged read
audit must itself fail closed if its required durable audit cannot commit.

Gateway tests must prove strict content type, identifier, body, cursor, and
idempotency limits; exact authority digest binding; timeouts and aborts; safe
502/503/504 mappings; no cache for protected results/failures; no sensitive
query strings; no provider-body fabrication; and privacy-safe telemetry.
Sentinel scans must cover logs, traces, metrics labels, exceptions, audit,
outbox, browser artifacts, and validation transcripts for raw evidence,
reporter/subject data, credentials, and free-form payloads.

## LB-027 browser and accessibility proof

After the Frozen handoff, Playwright must exercise `/admin/moderation` through
the built Web → Gateway → Identity → Spring Community → PostgreSQL runtime at
desktop and 320 px mobile widths in VI and EN. Cover loading, empty, denied and
anti-enumerating missing, redacted queue/detail, withdrawn, expired, already
resolved, stale/concurrent decision, replay, invalid outcome/reason,
redaction/retention conflict, Identity/Community unavailable, audit/outbox
failure, and restrictive/destructive confirmation cancellation/success.

Offline before submit blocks the action and sends no request. Post-send loss
shows an explicit uncertain state, retains the same idempotency key, and offers
reconciliation; authoritative Community state must be read before another
mutation is enabled. Reload, back, and locale changes must not turn uncertain
into success or reveal more data.

Accessibility proof requires keyboard-only order, visible focus, dialog focus
trap and restoration, safe successor focus after a resolved/removed row,
semantic table/list alternatives, labeled controls, status/error announcements,
320 px reflow, 200% automated zoom sanity, contrast and forced colors, reduced
motion, 44 px targets, and axe for every major truth state in both locales.
Runtime assertions must query Community persistence/audit/outbox; mocked UI
tests alone cannot prove resolution. Keep KI-016 open for manual assistive-tech,
physical-device, text-spacing, and 200%/400% review. Keep KI-019 open when
private Stitch pixel inspection is unavailable.

## Focused commands before the campaign

Implement focused `format:p5-s3:check`, `test:p5-s3:contracts`, contract
integrity, V3 migration, Spring provider/integration, and P5-S3 browser/runtime
commands following P5-S2 naming. During implementation these focused commands
may be rerun; they are not the one-shot campaign. Also run affected docs,
config, secrets, dependency/SBOM, build, and reproducible Community JAR checks.

## Exactly-one local P5-S3 Level C ledger and recovery

Provide `scripts/validate-p5-s3.ps1` and root `validate:p5-s3`. The sole normal
local invocation is `pnpm.cmd run validate:p5-s3`. It must refuse a second
normal invocation via immutable
`.lifebridge-local/p5-s3-level-c-invoked.json` and append to a JSONL ledger.
Record invocation ID, accepted base, exact head/branch, candidate-diff digest
(excluding only the protected unowned Stitch canary), command, checksummed
toolchain, compose project, ordered stages, transcript/artifact hashes, result,
and cleanup outcome.

Require branch `phase/5-moderation-resolution`, ancestry from
`ed328f6806f1ed082708e7c84367eda6bb1bb2da`, locked install, repository-pinned
JDK/Maven, clean task-owned evidence paths, and unoccupied task ports. Ordered
stages are: identity/diff; static/unit/contracts; Gateway consumer/Spring
provider; docs/config/secrets/dependency/SBOM; Node builds and two reproducible
Community JAR builds; isolated PostgreSQL; cumulative accepted migrations and
integration; V3 rollback/reapply/no-backfill/owner isolation; moderation
concurrency/idempotency/redaction/retention/audit/outbox; built LB-027 Chromium
desktop/mobile VI/EN; cumulative P2–P5-S2 browser suites; privacy sentinel,
protected-canary absence, diff integrity, and cleanup.

If the campaign fails or detaches, retain marker, ledger, transcript, logs,
database/JAR/browser evidence and exact failed stage. Classify as implementation
defect, test defect, environment issue, dependency issue, or unrelated existing
failure. A targeted recovery may run only the failed/unstarted stage and its
dependencies, append to the same ledger, and verify passed immutable inputs did
not change. It must never rerun `validate:p5-s3`, erase evidence, or offer a
generic continue switch. Hosted CI may use narrow existing-database/skip-install
guards once per exact checkout; detached HEAD must equal `EXPECTED_SHA` and
hosted evidence must not overwrite local evidence.

## Cleanup and promotion topology

Use a unique compose project, random masked task credentials, and task-owned
ports/processes/databases/roles/logs. In `finally`, stop only invocation child
PIDs, remove only its verified compose resources, drop only validated uniquely
named temporary databases/roles, restore process environment, scan logs before
cleanup, retain classified failure evidence, and prove ports/resources are
released. Never alter Docker/system configuration or unrelated resources.

Promotion remains `phase/5-moderation-resolution → dev` through exactly one
ready feature PR, without force push. Verify canonical issue #17 read-only
before mutation. Require exact feature-head hosted CI and terminal `P1 through
P5-S3 full required gate`, merge commit only, then exact post-merge `dev` CI on
the merge SHA. Only after that may bilingual immutable evidence close issue
#17. If canonical documentation requires a same-task docs-only correction, use
one narrow PR and repeat exact-head/post-merge proof; never amend accepted
feature history or start P6.

## Reconciliation conditions

Before Java or production UI code, reconcile and freeze: policy/version and
bounded outcomes/reasons; authority purpose/permission/digest; redacted evidence
minimum and provenance; anti-enumeration; report lifecycle and appeal/reopen
boundary; retention/deletion behavior; command/read/event/failure schemas;
transactional audit/outbox semantics; and LB-027 Frozen handoff. Any unresolved
policy/legal/safety premise remains a blocker or accepted same-slice change
control, never a fabricated test expectation.
