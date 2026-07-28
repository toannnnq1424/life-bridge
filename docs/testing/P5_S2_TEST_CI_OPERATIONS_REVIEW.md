# P5-S2 Test, CI, and Operations Review

Status: independent mandatory pre-code review complete; implementation remains
blocked until this review is reconciled with the authority/data/threat review
and the Frozen redacted `LB-025` / `LB-026` Stitch handoff.

Reviewed: 2026-07-29

Slice: `P5-S2 — Volunteer match and organization coordination`

Accepted starting point:
`origin/dev@e56df0f7d36a37f00e3c9750d112464e32cf09a1`, including P5-S1 feature PR
#66, canonical closeout PR #67, green post-merge run `30400564523`, and closed
issue #15.

## Independent conclusion

P5-S2 can extend the accepted Node Gateway ↔ Spring Community boundary without
a new service or persistence engine. The safe test shape is:

- one frozen, language-neutral `P5-S2-v1` OpenAPI/JSON Schema contract consumed
  by Gateway and provided by Community;
- a Community-owned Flyway `V2__p5_s2_volunteer_match_coordination.sql`
  migration that upgrades an existing populated V1 database without changing
  any P5-S1 row;
- fresh request-bound P2 authorization on every protected read and command,
  with organization approval, volunteer capacity, and recipient consent tested
  as separate expiring/revocable evidence;
- optimistic aggregate versions, durable idempotency, transactionally aligned
  state/audit/outbox, and deterministic same-version concurrency tests;
- browser proof for `LB-025` and `LB-026` only after the design gate freezes;
- exactly one guarded local P5-S2 Level C invocation, then exact-head hosted CI,
  merge-commit promotion to `dev`, and exact post-merge `dev` CI.

No test may infer that a volunteer is eligible, available, suitable, endorsed,
assigned, progressing, or complete. A UI/API success assertion is valid only
when authoritative Community evidence confirms the corresponding version and
state.

## Evidence inspected

This review inspected the accepted P5-S1 test/CI/operations review, root
validation scripts and workflow, Gateway Community consumer boundary, shared
Community schemas, Spring provider and PostgreSQL integration tests, Flyway V1,
P5-S1 database provisioning/migration tools, current repository map, plan,
session closeout, and KI-001/KI-016/KI-019. It did not modify Java, product UI,
or the Stitch canary.

## Contract proof to freeze before code

The reconciled contract must define commands, reads, events, and failures
separately. Suggested external Gateway routes may be renamed during
reconciliation, but their semantics and evidence requirements must not weaken.
All protected Gateway routes first obtain a fresh P2 decision bound to request
digest, actor, household/recipient context, purpose, permission, and current
time; Community receives only the minimum signed/validated authorization
context required by the frozen internal contract.

### Required command/read proof

Provider and consumer fixtures must cover:

1. organization approve/reject/revoke/expire for one candidate match;
2. volunteer offer read and decline/accept;
3. coordinator assign/reassign;
4. structured progress append/update;
5. close and revoke during action;
6. bounded list/detail reads for the authorized organization, coordinator, or
   volunteer only.

Each mutating command requires:

- `Idempotency-Key`, correlation and causation identifiers;
- actor and organization reference digests rather than display labels;
- aggregate identifier plus positive `expectedVersion`;
- a fresh P2 authority envelope with exact purpose, permission, scope,
  decision expiry, decision identifier, and request digest;
- distinct organization-approval evidence and, where applicable,
  volunteer-capacity evidence with version, expiry, and revocation state;
- structured enums and bounded identifiers/timestamps only.

The contract must reject unknown fields and must contain no household name,
address, diagnosis, treatment, narrative need, free-form progress note, phone,
email, exact location, or other sensitive text. Minimum read models should expose
only the action, broad support category, province/city granularity if authorized,
bounded schedule/day part, current lifecycle state, aggregate version, and
evidence expiry/revocation hints needed to act safely.

### State and concurrency matrix

Provider and consumer tests must share exact vectors for:

| Scenario                                | Required authoritative result                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| pending organization approval           | no volunteer offer or assignment                                               |
| approved / rejected / revoked / expired | distinct state; rejected, revoked, and expired cannot be accepted              |
| volunteer decline                       | confirmed once; retry is the same result                                       |
| volunteer accept retry                  | same key + same intent replays exactly; no second transition/audit/outbox      |
| same key, changed intent                | idempotency conflict                                                           |
| no capacity                             | no assignment and no success event                                             |
| two volunteers accept same version      | exactly one winner; loser receives version/state conflict                      |
| stale offer/version                     | conflict includes safe current version/state, not protected payload            |
| assign/reassign conflict                | exactly one version increment; no fabricated assignment                        |
| progress conflict                       | stale update rejected; previous progress remains authoritative                 |
| close/revoke during action              | linearized winner; losing command is rejected and cannot resurrect state       |
| P2 revoked/expired/denied               | no Community mutation                                                          |
| organization evidence revoked/expired   | no mutation even if P2 authority remains valid                                 |
| Community unavailable before send       | blocked, retry-safe, not persisted                                             |
| connection lost after send              | uncertain, reconcile by idempotency key/read; never auto-repeat with a new key |
| no match                                | explicit empty/not-found truth; no suggestion or automatic dispatch            |

Tests should use a start barrier and independent database connections for
concurrent accepts, reassignments, progress updates, and revoke-versus-action.
They must assert one committed aggregate version, one applicable audit record,
one applicable outbox record, and stable replay. A timing-only test without a
barrier is insufficient.

### Failure contract

Freeze stable language-neutral failure codes and HTTP mappings for at least:

- validation/unknown field;
- fresh authority required, denied, expired, and revoked;
- organization approval required/rejected/expired/revoked;
- volunteer capacity unavailable;
- idempotency required/conflict;
- stale offer/version and lifecycle conflict;
- duplicate accept/decline replay;
- resource not found or no match;
- Identity unavailable, Community unavailable, and organization evidence
  unavailable;
- offline blocked and post-send outcome uncertain.

Failures must carry correlation ID and safe reconciliation metadata only.
Gateway must preserve authoritative Community status/code and must never turn a
timeout into accepted, assigned, progressed, persisted, or closed.

### OpenAPI/JSON Schema equality

Retain the P5-S1 cross-runtime digest-vector pattern and add:

- canonical JSON vectors for every command/read/event/failure;
- Node schema parse and unknown-field rejection;
- Gateway consumer request path/method/header/body and response mapping tests;
- Spring provider MockMvc/controller tests against the same fixture bytes;
- a contract-integrity tool that compares the frozen OpenAPI/JSON Schema
  digests used by Node and Java;
- `/version` and service readiness advertising `P5-S2-v1`, without claiming a
  dependency healthy when Identity or Community readiness fails.

The Java service must not import Node business code, and Gateway must not import
Java code or Community credentials.

## Community PostgreSQL V2 acceptance

Flyway V2 must add only Community-owned match/approval/offer/assignment/progress
tables or narrowly justified columns plus idempotency, audit, and outbox
extensions. P5-S1 tables remain owned and readable by Community only. No
Identity, Care, Notification, or Gateway table/credential/import is allowed.

The migration test must provision two owner-isolated databases, apply V1,
insert synthetic sentinel rows into every relevant P5-S1 table, snapshot
row-counts and stable row digests, then:

1. force the V2 SQL to fail inside a transaction and prove no partial P5-S2
   object/version remains;
2. apply V2 successfully;
3. prove all V1 sentinel counts and digests are identical and all new P5-S2
   business tables are empty;
4. prove Flyway schema history and `community_schema_state` advance exactly to
   version 2;
5. apply the explicit test-only V2 rollback SQL, prove V1 remains intact, then
   reapply V2 and compare the resulting schema fingerprint;
6. prove no unintended backfill, synthetic default approval, offer,
   assignment, capacity, progress, audit, or outbox row exists;
7. connect as `lifebridge_identity`, `lifebridge_care`, and
   `lifebridge_notification` and require SQLSTATE `42501` for Community V1 and
   V2 tables; connect as `lifebridge_community` to each foreign service
   database and require the same denial;
8. run Flyway twice and prove the second run is a no-op.

Rollback SQL is test evidence, not an authorization to down-migrate a production
database automatically. It must live in the migration validation tool or a
test-only resource, not Flyway's forward production directory.

Database constraints must bound enums, identifier lengths, versions,
timestamps, JSON shapes where JSON is unavoidable, and uniqueness. Prefer
relational structured columns. Do not add free-form sensitive columns.

## Spring Community integration proof

PostgreSQL-backed integration tests must assert:

- approval, offer, accept/decline, assign/reassign, structured progress,
  close, revoke, and read truth;
- expiry evaluated at command time, not only at offer creation;
- request-bound P2 digest mismatch rejected before repository mutation;
- capacity consumed/released only by a confirmed authoritative transition;
- no automatic dispatch or inferred suitability/priority;
- all invalid/denied/unavailable/conflict paths leave aggregate, audit, and
  outbox unchanged;
- successful mutation commits aggregate, idempotency response, audit, and
  outbox atomically;
- audit/outbox versions are monotonic and unique per aggregate version;
- replay returns byte-equivalent authoritative response without duplicate
  records;
- retention/deletion behavior follows the reconciled contract and never
  resurrects closed/revoked state;
- outbox payloads contain bounded identifiers/state/version only and retain
  `suppressed_not_configured` unless a separately accepted delivery path
  exists.

At transaction fault-injection points after state write, audit write, outbox
write, and idempotency write, rollback must leave none of the four committed.

## Gateway consumer, security, and privacy proof

Gateway tests must prove every protected action calls P2 freshly and binds the
decision to the exact downstream command digest. Organization, coordinator,
member, or volunteer labels alone never authorize. Test altered path, body,
actor, household, recipient, purpose, permission, expired decision, revoked
decision, and replayed decision.

Also require:

- strict content type/body/identifier/idempotency limits;
- no forwarding of cookies, bearer token, passphrase, display name, contact
  details, or excess Identity response fields to Community;
- dependency timeouts and abort signals;
- safe 502/503/504 mapping with correlation ID;
- no state fabrication when the provider body is malformed or unavailable;
- privacy-safe structured telemetry with protected sentinel scans;
- authorization response and failure bodies marked non-cacheable;
- no sensitive query strings and no free-form payload/event/log.

## Browser, accessibility, and recovery proof

After the Frozen handoff, Playwright must exercise real routes confirmed by the
screen inventory for `LB-025` and `LB-026` at desktop and 320 px mobile widths
in VI and EN. Required scenarios:

- pending, approved, rejected, revoked, expired, declined, accepted,
  no-capacity, assigned/reassigned conflict, stale offer, concurrent accept,
  progress conflict, closed/revoked during action, denied/minimum disclosure,
  no match, Identity unavailable, Community unavailable, and organization
  evidence unavailable;
- offline before submit disables/blocks the command and makes no request;
- connection loss after a command is sent renders an explicit uncertain state,
  retains the same idempotency key, and offers reconciliation;
- reconciliation reads authoritative Community state before allowing another
  mutation;
- reload/back/locale switch does not convert uncertain to success or disclose
  extra fields;
- keyboard-only order, visible focus, focus restoration after errors/dialogs,
  semantic labels/status announcements, 320 px reflow, 200% automated zoom
  sanity, contrast/forced-colors, reduced motion, 44 px targets, and no
  horizontal action loss;
- axe on each major truth state and both locales;
- Chromium runtime Web → Gateway → Identity → Spring Community → PostgreSQL,
  followed by cumulative accepted P2–P5-S1 browser suites.

Browser assertions must query Community persistence/audit/outbox for runtime
truth. Mocked browser tests alone cannot prove accepted/assigned/progress/closed.
KI-016 remains open for manual screen-reader, physical-device, text-spacing, and
200%/400% sessions. KI-019 remains open if private Stitch pixel inspection is
unavailable; automation must not be described as visual approval.

## Focused implementation commands

Names below are the required command surface to implement. Use `.cmd` shims on
Windows:

```powershell
pnpm.cmd run format:p5-s2:check
pnpm.cmd run lint
pnpm.cmd run typecheck
pnpm.cmd run test:p5-s2:contracts
node --experimental-strip-types tools/quality/src/p5-s2-contract-integrity.ts
.\mvnw.cmd -B -ntp -f services/community/pom.xml -Dtest=CommunityMatchContractTest test
pnpm.cmd exec tsx tools/quality/src/p5-s2-migration.ts
.\mvnw.cmd -B -ntp -f services/community/pom.xml -Dtest=CommunityMatchServiceIntegrationTest test
pnpm.cmd exec playwright test --config=playwright.p5-s2.config.ts tests/browser/p5-s2.spec.ts
pnpm.cmd exec playwright test --config=playwright.p5-s2.config.ts tests/browser/p5-s2-runtime.spec.ts
pnpm.cmd run validate:docs
pnpm.cmd run validate:config
pnpm.cmd run validate:secrets
pnpm.cmd run security:deps
pnpm.cmd run build
.\mvnw.cmd -B -ntp -f services/community/pom.xml clean verify
```

Focused commands may be rerun while implementing. They do not count as the
single full Level C campaign. Once their affected proof is green and reviews are
reconciled, freeze the candidate and invoke Level C once.

## Exactly-one local P5-S2 Level C design

Create `scripts/validate-p5-s2.ps1` and root
`validate:p5-s2 = powershell.exe -NoProfile -ExecutionPolicy Bypass -File
scripts/validate-p5-s2.ps1`. The only normal local invocation is:

```powershell
pnpm.cmd run validate:p5-s2
```

The script must refuse a second normal local invocation through an immutable
`.lifebridge-local/p5-s2-level-c-invoked.json` marker. It must record a unique
invocation ID, exact base/head/branch, candidate diff digest (excluding only the
unowned Stitch canary), command, compose project, append-only JSONL ledger, and
transcript. Local execution must require:

- branch `phase/5-volunteer-match-organization-coordination`;
- ancestry from accepted
  `e56df0f7d36a37f00e3c9750d112464e32cf09a1`;
- no bypass flags, occupied task ports, or pre-existing evidence paths;
- exact checksummed repository JDK/Maven and locked pnpm install.

Required ordered stages:

1. toolchain and candidate identity/diff integrity;
2. P1–P5-S2 formatting, lint, typecheck, schema integrity, unit/contracts;
3. Gateway consumer and Spring provider tests;
4. docs/config/secrets/dependency audit and CycloneDX proof;
5. Node production builds plus two clean reproducible Community JAR builds;
6. isolated PostgreSQL provisioning;
7. cumulative P1–P5-S1 migrations/integration;
8. P5-S2 V2 rollback/reapply/no-backfill/owner-isolation;
9. Community concurrency/revocation/audit/outbox integration;
10. built mixed-runtime P5-S2 Chromium at desktop/mobile VI/EN;
11. every cumulative accepted P2–P5-S1 Chromium suite;
12. privacy sentinel, protected-canary absence, candidate-diff and cleanup
    checks.

Do not design a generic “continue” switch. If Level C fails or detaches, retain
the marker, ledger, transcript, logs, JAR hash, browser output, and exact failed
stage. Classify it as implementation defect, test defect, environment issue,
dependency issue, or unrelated pre-existing failure. Recovery may run only the
failed/unstarted stage and its dependencies, must append to the same invocation
ledger, and must prove previously passed immutable inputs have not changed. It
must not invoke `validate:p5-s2` again or erase evidence.

Hosted CI may call the same script once per exact checkout using narrowly
guarded `-UseExistingDatabase -SkipInstall`; hosted detached HEAD must equal
`EXPECTED_SHA`. Hosted execution does not consume or overwrite local evidence.

## Cleanup and operations

Use a unique compose project such as
`lifebridge-p5-s2-level-c-<pid>-<invocation-prefix>`, random masked
task credentials, and task-owned ports/logs/browser outputs. In `finally`:

- stop only child process IDs started by the invocation;
- remove only its compose project/volumes if it created them;
- drop only uniquely named temporary validation databases/roles after verifying
  their names and owners;
- restore process-scoped environment values;
- scan logs before removal and retain classified failure evidence;
- verify task ports are released and no task container/network/volume remains.

Never alter Docker service/configuration, Registry, firewall, global credentials,
or unrelated containers. Do not delete the Stitch project/screens or retry an
uncertain Stitch write. Do not touch, stage, or rewrite
`docs/orchestration/reports/STITCH_MCP_CANARY.md`.

## Hosted exact-head and promotion gates

Update the workflow name/job labels and terminal gate to P5-S2 while retaining:

- SHA-pinned Actions, Node `22.22.3`, pnpm `11.9.0`, accepted Temurin/Maven
  checks, locked install, exact checkout with `persist-credentials: false`;
- Windows static/unit/contracts/provider/build/security/SBOM/reproducibility;
- Ubuntu PostgreSQL owner-isolated migration, mixed-runtime and cumulative
  Chromium acceptance;
- random masked credentials and a terminal `P1 through P5-S2 full required
gate` requiring every job success.

Promotion sequence:

1. verify the canonical issue expected as #16 read-only before any mutation;
2. push the phase branch without force;
3. create exactly one ready feature PR into `dev`;
4. require hosted push/PR runs whose checked-out SHA equals the exact feature
   head and whose terminal P5-S2 gate is green;
5. merge by merge commit only;
6. require exact post-merge `dev` CI on that merge SHA and the same terminal
   gate;
7. append bilingual immutable evidence and close issue #16 only after the
   post-merge gate is green;
8. use a same-task docs-only canonical correction only if genuinely needed, with
   its own exact-head and post-merge evidence.

No force push, direct `dev` push, squash/rebase promotion, duplicate feature PR,
decorative branch, P5-S3 work, deployment, pilot, or release claim is allowed.
Branch protection remains governed manually while KI-014 applies.

## Reconciliation blockers

Java/product/UI code must not begin until the other mandatory reviewers and the
controller resolve and freeze:

1. exact P2 purpose, scope, permissions, decision envelope, expiry, and
   request-digest semantics for each role/action;
2. the organization approval, volunteer capacity, offer, assignment, progress,
   close, revoke, and retention state machines and which evidence Community
   authoritatively owns;
3. exact routes for `LB-025` and `LB-026`;
4. versioned OpenAPI/JSON Schema command/read/event/failure names and minimum
   fields;
5. whether any progress history is mutable, append-only, or correctable and its
   deletion/retention rule;
6. independent Stitch privacy/accessibility critique, single read-back, and
   Frozen redacted handoff.

If those are frozen, no test/CI/operations architecture blocker remains. KI-001
still blocks deployment, KI-016 still limits accessibility claims, and KI-019
still limits private Stitch visual-conformance claims; none should be marked
resolved by bounded P5-S2 integration.
