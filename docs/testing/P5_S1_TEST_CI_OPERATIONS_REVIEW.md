# P5-S1 Test, CI, and Operations Review

Status: independent pre-code review complete; implementation gate is
conditional on reconciliation with the contract/data/authority/toolchain review
and the Frozen redacted Stitch handoff.

Reviewed: 2026-07-28

Slice: `P5-S1 — Consented help request and directory`

Branch/base observed at review start:
`phase/5-consented-help-request-directory` from
`origin/dev@486a5276ef43d143af8692501064e952a59a4829`, with no task-owned
working-tree change.

## Scope and evidence inspected

This review covers only test, CI, and local operations needed to prove:

- the Node Gateway consumes and the Spring Community service provides the same
  versioned language-neutral P5-S1 contract;
- Community alone owns its PostgreSQL role, database, migrations, help-request
  data, public directory data, search, audit, and transactional outbox;
- `/help/new` and `/community` present truthful VI/EN behavior without
  oversharing or unsupported matching, eligibility, safety, availability, or
  outcome claims;
- one local Level C campaign and the hosted exact-head/post-merge gates can run
  reproducibly and clean up only their own resources.

The review inspected `CODEX.md`, the active P5-S1 plan and ADR-019 /
`CHG-2026-011`, the repository map, test strategy, known issues, research
protocol, the latest P4-S3 candidate and canonical closeout, the integrated CI
workflow, root package scripts and lockfile policy, Windows bootstrap/doctor
scripts, the P4-S3 Level C runner, PostgreSQL provisioning and migration
rehearsals, Gateway dependency composition tests, contract tests, and
Playwright mocked/real-runtime accessibility and privacy patterns.

The protected
`docs/orchestration/reports/STITCH_MCP_CANARY.md` is excluded from this review
and must remain untouched.

## Independent findings

### Patterns to retain

1. `.github/workflows/ci.yml` checks out `EXPECTED_SHA`, verifies the checkout,
   pins actions by immutable commit, installs Node dependencies from
   `pnpm-lock.yaml`, and has an `if: always()` aggregate gate. P5-S1 must retain
   all of these properties.
2. `scripts/validate-p4-s3.ps1` marks the one local campaign before running a
   gate, refuses to overwrite browser artifacts, assigns a PID-scoped Compose
   project, starts hidden child processes on Windows, scans logs for synthetic
   sensitive values, and removes only resolved task-owned paths. P5-S1 should
   inherit these controls.
3. Existing migration rehearsals prove transaction rollback, idempotent
   reapply, preservation of an older row, and zero automatic grants or
   aggregates. P5-S1 needs the same evidence for a greenfield Community
   database, with stronger role/isolation assertions.
4. Existing browser suites separate fast routed synthetic failure-state proof
   from a built real-runtime path. They use axe, keyboard/focus assertions,
   320-pixel reflow, forced colors, reduced motion, offline state, and browser
   persistence inspection. Both P5-S1 screens need that split.
5. Existing runtime tests inspect owner data only as test evidence and verify
   redacted audit/outbox/log behavior. This is acceptable in a test harness;
   production Gateway, Identity, and Web code must never receive Community
   credentials or query Community tables.

### Gaps P5-S1 must close

1. Current TypeScript services can share Zod code. Spring cannot. P5-S1 needs a
   single repository-native OpenAPI/JSON Schema source consumed independently
   by Node and Java tests; duplicating DTOs in two languages without schema
   conformance tests is insufficient.
2. The current CI has no Java setup, Maven-wrapper integrity check, Spring
   build, Community-owned database, or Node-to-Spring live proof.
3. Current one-shot runners have a marker but no step ledger. A detached P5-S1
   run could leave the operator unsure which immutable evidence passed. The
   P5-S1 runner needs an append-only stage ledger and a dedicated transcript.
4. Existing browser output uses one Desktop Chrome project, with narrow
   per-test viewport changes. The P5-S1 Stitch gate explicitly requires mobile
   and desktop. The new config should define both projects and still run with
   one worker and no retries.
5. `pnpm audit` covers only Node dependencies. Java dependency provenance,
   wrapper integrity, effective plugin pins, and reproducible packaging need
   separate gates whose exact tools and accepted versions come from the
   toolchain reviewer.
6. Local inspection reported an incoherent machine toolchain: bare `java`
   resolves to Java 8, `javac` to 23, and system Maven 3.9.16 runs on JDK 23.
   None is admissible P5-S1 evidence. The slice needs an official-pin,
   checksum-verified, repository-scoped JDK and wrapper-only Maven path without
   changing global `PATH`, `JAVA_HOME`, Registry, services, or machine
   configuration.

## Preconditions and blockers

No Java, Maven, Spring Boot, test-library, plugin, action, or wrapper version is
selected by this review. Before any Java or product code:

1. the contract/data/authority/toolchain reviewer must freeze the official
   supported JDK distribution/version, Spring Boot line, Maven distribution,
   Maven Wrapper files/checksums, build/test/migration/security plugins, and
   repository checksum policy;
2. the same reviewer must freeze `P5-S1-v1` fields, purposes, permissions,
   minimum authorized context, status transitions, idempotency, concurrency,
   retention/deletion, audit/outbox, search, provenance, and failure schemas;
3. the Stitch reviewer must freeze a redacted, native-only LB-022/LB-024
   handoff after independent privacy/accessibility review;
4. contract filenames below must be reconciled with that frozen contract.

If any official pin or contract remains unsupported or ambiguous, stop the
dependent Java/CI work. Do not fill the gap with a locally installed JDK,
system Maven, transitive dependency, generated source, or an inferred field.

## Contract and cross-runtime proof

### Proposed authoritative schema files

Use one language-neutral tree:

```text
contracts/community/p5-s1-v1/
  openapi.json
  SHA256SUMS
  schemas/
    common-failure.schema.json
    public-directory-query.schema.json
    public-directory-result.schema.json
    help-request-command.schema.json
    help-request-result.schema.json
    help-request-read.schema.json
    authorization-context.schema.json
    community-outbox-event.schema.json
```

The contract reviewer may narrow or rename schemas while freezing
`P5-S1-v1`, but there must be one authoritative tree, not separate Node and
Java copies. `SHA256SUMS` must be generated from reviewed bytes and verified by
both contract lanes. Generated SDKs and generated Spring/TypeScript business
code are out of scope.

`openapi.json` must:

- use explicit versioned paths/content types and `additionalProperties: false`
  for commands, results, events, and failures;
- separate public directory reads from every protected help-request operation;
- enumerate every accepted status/code instead of using open strings;
- mark required/nullable fields accurately and define bounded sizes/patterns;
- contain no examples with real people, exact addresses, diagnosis, treatment,
  urgency, eligibility, safety, matching, availability, delivery, or outcome
  claims;
- define stale provenance and dependency/failure truth, not only successful
  responses.

### Node consumer tests

Proposed files:

- `packages/contracts/src/community-contract.test.ts`
- `apps/gateway/src/community-consumer-contract.test.ts`
- `tools/quality/src/p5-s1-contract-integrity.ts`

The contract test must parse every authoritative JSON file, verify its recorded
digest, and assert that OpenAPI request/response/event references resolve to
the checked-in schemas. If an additional JSON Schema validator is required, it
must be an explicitly pinned direct dependency accepted during reconciliation;
do not use an undeclared transitive package.

The Gateway consumer test must inject a fake `fetch` dependency and prove:

- `GET /api/v1/community` uses only the public Community read contract and
  neither calls Identity nor forwards session, cookie, CSRF, household role,
  grant, subject, or protected request data to Community;
- each protected create/read/close/delete/reconcile call requests a new,
  exact-purpose Identity decision bound to that method, normalized path,
  bounded command digest, actor, subject/recipient target, and correlation
  identity frozen by the contract;
- Gateway forwards only the minimum accepted decision projection, never an
  Identity token, database credential, household membership object, consent
  record, or fabricated authorization state;
- the client idempotency key and command digest remain stable through
  duplicate/uncertain reconciliation, while a changed command under the same
  key is rejected;
- malformed or unknown Community `2xx` payloads fail closed and never become a
  successful browser projection;
- pre-dispatch unavailability, known rejection, conflict, duplicate replay,
  consent/authority denial or revocation, post-dispatch uncertain result, and
  stale-directory/search failure map to distinct frozen client failures;
- Gateway never relabels a stored request as queued, matched, delivered,
  available, safe, eligible, or completed without the corresponding
  authoritative Community evidence.

Tests must use schema-valid synthetic fixtures produced in test code or in
`packages/test-fixtures`; fixtures must not contain free-form sensitive text.

### Spring provider tests

Proposed files, with the package name finalized by the implementation owner:

- `services/community/src/test/java/.../contract/CommunityProviderContractTest.java`
- `services/community/src/test/java/.../contract/ContractDigestTest.java`
- `services/community/src/test/java/.../web/PublicDirectoryControllerTest.java`
- `services/community/src/test/java/.../web/HelpRequestControllerTest.java`

Using the accepted Spring test stack and the same checked-in schema bytes,
MockMvc/provider tests must validate every supported status/body/header pair.
They must cover:

- public directory success, empty, location denied/omitted, stale provenance,
  invalid query, and search/database unavailable;
- protected draft validation, consent/authority denied or revoked before
  dispatch, create success, exact duplicate replay, key/payload mismatch,
  optimistic conflict, uncertain reconciliation, pending/submitted/closed
  reads, retention/deletion truth, and Community unavailable;
- strict rejection of unknown/unbounded fields and all free-form sensitive
  payload slots;
- no `Set-Cookie`, Identity credential, protected request field, actor/subject
  identifier, request location, or internal eligibility signal in public
  directory responses;
- no success response until the Community transaction containing the request,
  audit record, and outbox row has committed.

Provider tests must fail if Java DTOs/controllers drift from the language-
neutral schemas, even when their Java unit tests otherwise pass.

### Live Node-to-Spring proof

Proposed file:

- `tests/browser/p5-s1-runtime.spec.ts`

The built-runtime test must start the packaged Spring Community process before
Gateway, then exercise:

1. an unauthenticated public `/community` read through
   Web → Node Gateway → Spring Community → Community PostgreSQL;
2. an authenticated protected `/help/new` create through
   Web → Gateway → fresh Identity decision → Spring Community → Community
   PostgreSQL;
3. idempotent reconciliation of one synthetic uncertain submission;
4. a protected read/close or delete operation with a second fresh decision;
5. direct test-only database assertions that the transaction, audit, and
   outbox are present and privacy-safe;
6. browser-storage and runtime-log assertions showing that sensitive command
   content, authorized context, database credentials, and provider payloads
   were not persisted or logged.

The runtime test may inspect Community and Identity databases using isolated
test-owner connections supplied by the runner. Application processes must
receive only their own credentials.

## Community PostgreSQL proof

### Proposed files

- `tools/quality/src/p5-s1-database.ts`
- `services/community/src/test/java/.../persistence/CommunityMigrationTest.java`
- `services/community/src/test/java/.../persistence/CommunityRepositoryIntegrationTest.java`
- `services/community/src/test/java/.../persistence/CommunityConcurrencyIntegrationTest.java`
- `services/community/src/test/java/.../persistence/CommunityRetentionIntegrationTest.java`

Production migrations remain under the Community service, in the exact
location selected by the accepted Spring migration tool. Test tooling may
provision disposable roles/databases as an administrator, but it must not
apply business writes or become the production migration owner.

### Required migration assertions

Run against a fresh PID-scoped Community database owned by
`lifebridge_community`:

1. **Ownership:** Community role owns its database/schema/tables/sequences and
   can perform its required DML. Care, Identity, Notification, and Gateway
   roles have no Community table privileges. Community has no privileges on
   their databases.
2. **Apply:** the exact reviewed migration set applies through the same
   mechanism used at Community startup; the recorded schema version and
   checksums match.
3. **Transactional rollback:** execute the candidate migration plus a
   deterministic failing statement in one PostgreSQL transaction. Assert no
   partial table, index, constraint, enum, schema-state, audit, or outbox
   change remains.
4. **Reapply:** apply the unchanged migration set after rollback, then invoke
   normal migration discovery again. The second discovery is a checksum-
   verified no-op, not duplicate DDL or data.
5. **No unintended backfill:** migration alone creates zero help requests,
   directory listings, search rows, authority decisions, audit records, and
   outbox events. Reviewed synthetic directory fixtures are loaded only by the
   test fixture path after migration.
6. **Preservation:** insert a bounded synthetic row at the previous applicable
   schema state when a later P5-S1 migration exists; prove the upgrade
   preserves it without inventing consent, visibility, eligibility, location,
   or lifecycle values.
7. **Rollback cleanup:** the harness terminates only connections to its exact
   PID-scoped databases, drops only those databases, and verifies their
   absence.

### Required repository/integration assertions

- create plus audit plus outbox is one transaction; a forced outbox/audit
  failure rolls back the request;
- the same actor/key/digest returns the original authoritative result without
  a second request, audit transition, or outbox event;
- the same key with a different digest fails deterministically;
- concurrent updates with one expected version yield one commit and one
  conflict, with no lost update;
- retention/deletion changes visibility exactly as frozen, does not resurrect
  an active request on replay, and makes no claim about production backup
  erasure;
- PostgreSQL search uses bounded normalized parameters, reviewed listing
  provenance, minimum location granularity, deterministic ordering, and
  parameterized queries;
- stale provenance/cache truth is carried from authoritative stored metadata;
  no new cache engine is introduced;
- audit/outbox records use enumerated metadata and opaque references only, with
  no command description, precise location, household label, subject label,
  diagnosis, urgency, or inferred score;
- failure injection for database/search unavailability produces a truthful
  unavailable or result-unknown response and never a success/queue/match claim.

## Security and privacy proof

Proposed files:

- `services/community/src/test/java/.../security/CommunitySecurityPrivacyTest.java`
- `apps/gateway/src/community-consumer-contract.test.ts`
- `tests/browser/p5-s1.spec.ts`
- `tests/browser/p5-s1-runtime.spec.ts`
- `docs/security/P5_S1_THREAT_MODEL.md`

Required checks:

- fail closed on missing, stale, wrong-purpose, wrong-digest, wrong-target, or
  malformed protected authorization context;
- require session/origin/CSRF controls at Gateway for protected mutations and
  prove public directory reads remain intentionally separate;
- prove household organizer/member status alone cannot submit, read, close,
  reconcile, or delete a request;
- enforce request category/field and location-granularity allowlists from the
  frozen contract; no generic notes, medical text, exact address, attachment,
  or arbitrary JSON field;
- normalize and bound search terms; test injection metacharacters and Unicode
  without reflecting raw input in logs/errors;
- return generic public failures and non-enumerating protected denial;
- scan Community, Gateway, Identity, and Web logs for every synthetic sentinel
  plus field names that must never be logged;
- inspect audit/outbox payloads and metric labels for low-cardinality,
  privacy-safe values;
- prove trace/correlation IDs contain no actor, household, subject, location,
  listing, or request identifier;
- run repository secret/config validation, Node dependency audit, accepted
  Java dependency/provenance checks, and diff checks;
- make no security, freshness, endorsement, availability, matching, delivery,
  or deletion guarantee beyond the observed authoritative state.

## Browser and accessibility proof

### Proposed files

- `playwright.p5-s1.config.ts`
- `tests/browser/p5-s1.spec.ts`
- `tests/browser/p5-s1-runtime.spec.ts`

The config should define reviewed Desktop Chrome and mobile-Chromium projects,
run serially with one worker, zero retries, screenshots/video/trace disabled by
default, and a task-owned output directory. Any exact emulated device choice
must match the Frozen Stitch handoff rather than be guessed here.

Mocked schema-valid tests must cover both VI and EN:

- LB-022 `/help/new`: purpose/visibility/consent explanation before controls;
  draft and client/server validation; location omitted/denied; consent or
  authority denied/revoked; exact duplicate; conflict; result unknown and
  explicit reconciliation; submitted/pending/closed; retention/deletion
  effect; Community unavailable; offline blocked or durably queued exactly as
  the frozen contract specifies, never falsely confirmed.
- LB-024 `/community`: unauthenticated public access; authenticated access
  without protected-data broadening; loading; eligible public listing;
  minimum listing/provenance metadata; no results; location denied/omitted;
  stale provenance; Community/search unavailable; and explicit matching
  unavailable within the P5-S1 boundary.
- No screen infers need, diagnosis, treatment, urgency, eligibility, safety,
  match quality, availability, delivery, outcome, or endorsement.

For both routes and both viewports assert:

- semantic landmarks, heading order, labels, descriptions, error summary, and
  status/live-region behavior;
- complete keyboard-only operation and logical focus order;
- focus moves to validation, denial, conflict, uncertain, and confirmation
  headings without stealing focus during ordinary loading;
- no horizontal overflow at the reviewed narrow viewport and at 200% browser
  zoom/reflow where automation is reliable;
- axe has zero accepted-scope violations;
- forced-colors/contrast affordances remain perceivable without color alone;
- reduced motion removes non-essential motion;
- locale changes preserve state without mixing VI/EN labels;
- protected form values and authoritative results do not enter URL/history,
  local storage, session storage, Cache Storage, service-worker queues,
  analytics, or browser logs.

Manual NVDA/Narrator, physical-device, text-spacing, and other KI-016 evidence
remains a truthful deferred deployment/release gate unless completed in this
slice. Private Stitch pixel inspection remains KI-019 if unavailable; automated
native proof is not a visual-conformance claim.

## Package scripts and command wiring

After contracts and official pins are accepted, add these root commands:

```json
{
  "format:p5-s1:check": "prettier --check <exact P5-S1 Node, schema, CI, test, and documentation files>",
  "test:p5-s1:contracts": "vitest run packages/contracts/src/community-contract.test.ts apps/gateway/src/community-consumer-contract.test.ts",
  "test:p5-s1:browser": "playwright test --config playwright.p5-s1.config.ts",
  "validate:p5-s1": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/validate-p5-s1.ps1"
}
```

Do not place an unreviewed Maven command or version in `package.json`. The
repository-owned wrappers are invoked directly:

```powershell
.\mvnw.cmd -B -ntp -f services/community/pom.xml test
.\mvnw.cmd -B -ntp -f services/community/pom.xml verify
```

Exact additional plugin goals, profiles, and flags are added only after the
toolchain reviewer accepts their official support and pins. On hosted Linux,
CI may invoke `./mvnw` from the same checked-in wrapper distribution and
checksum metadata; Windows local use remains `mvnw.cmd`. System `mvn`, global
Maven settings, machine-wide Java changes, and copied wrapper caches are not
accepted substitutes.

## Supply-chain and reproducibility gates

### Proposed files

- `mvnw.cmd`
- `mvnw`
- `.mvn/wrapper/maven-wrapper.properties`
- the wrapper integrity artifact(s) required by the accepted official wrapper
- `services/community/pom.xml`
- `scripts/bootstrap-community-toolchain.ps1`
- `scripts/doctor.ps1`
- `scripts/bootstrap.ps1`
- `.github/workflows/ci.yml`

Required proof:

1. doctor reports the bare Java/Javac/Maven mismatch as an environment warning
   or failure, then separately reports the exact accepted repository-scoped JDK
   distribution/version, wrapper presence, wrapper checksum, Docker
   availability, Node 22.x, and pnpm 11.9.0 without modifying the machine;
2. `scripts/bootstrap-community-toolchain.ps1` obtains only the officially
   accepted JDK archive from its accepted locator, verifies its frozen digest
   before extraction, and materializes it beneath an ignored exact path such as
   `.lifebridge-local/toolchains/<accepted-id>-<digest>/`. It must refuse an
   unexpected archive, digest, executable version, or resolved path outside
   that root. It must not install a package, write Registry, alter services,
   persist global environment variables, or edit user/machine `PATH`;
3. bootstrap uses `pnpm.cmd install --frozen-lockfile`, the verified
   repository-scoped JDK, and repository `mvnw.cmd`. The Java environment is
   applied only to the current script/child process, restored in `finally`, and
   checked again inside Maven. Bootstrap does not fall back to system Maven,
   bare `java`/`javac`, or another JDK;
4. Spring Boot, every explicit Maven plugin, every direct Java dependency, and
   the wrapper distribution are pinned according to the accepted official
   evidence; ranges and floating snapshots fail validation;
5. CI Java setup actions are pinned by immutable action commit, cache keys
   include `services/community/pom.xml` and wrapper metadata, and checkout
   credentials remain disabled;
6. the accepted Java dependency/provenance scanner runs from a reviewed locked
   configuration. A network/advisory outage is classified as dependency or
   environment failure, never silently ignored;
7. two clean packages of the same exact source and accepted toolchain produce
   the same Community artifact digest, or the reviewer records and removes the
   verified nondeterministic input before acceptance;
8. the packaged artifact starts using the reviewed configuration and exposes
   liveness/readiness/version without sensitive configuration.

## Exactly one local P5-S1 Level C campaign

The only full local command is:

```powershell
pnpm.cmd run validate:p5-s1
```

Run it once, after focused contract, Java, migration, Gateway, browser, and
build proof is already green. Do not run it during contract freeze or as a
debug loop.

### Proposed runner

Create `scripts/validate-p5-s1.ps1` by extending the P4-S3 pattern. It must:

1. parse itself before side effects;
2. require the exact phase branch, record base HEAD plus a digest of the
   candidate diff, and refuse an existing one-shot marker;
3. atomically create
   `.lifebridge-local/p5-s1-level-c-invoked.json` containing UTC start,
   process ID, invocation ID, HEAD, diff digest, branch, and command;
4. create an append-only
   `.lifebridge-local/p5-s1-level-c-<invocation-id>.ledger.jsonl` and transcript;
   write stage start/pass/fail, exact command, exit code, and UTC time without
   secrets or synthetic payload values;
5. refuse to overwrite any log, ledger, Playwright, test-result, report, Maven
   output copy, or database artifact path;
6. use a PID/invocation-scoped Compose project, generated role passwords,
   localhost-only dynamic or collision-checked ports, and hidden Windows child
   processes;
7. resolve the checksum-verified repository-scoped JDK, set its Java
   environment only for the runner/child processes, verify Maven itself reports
   that exact runtime, and restore the caller's process environment in
   `finally`;
8. validate official JDK/wrapper checksums before dependency resolution and
   fail if bare/system Maven or the observed Java 8/Javac 23/JDK 23 combination
   is used;
9. use only locked Node and accepted Maven-wrapper dependencies;
10. run stages in this order:
    static/schema integrity → Node and Java unit/provider/consumer contracts →
    docs/config/secrets/dependency gates → Node and Java production builds and
    reproducibility → cumulative P1-P4 PostgreSQL integrations → Community
    migration/owner isolation/integration → built mixed-runtime LB-022/LB-024
    browser proof → cumulative browser regressions → log/privacy/diff checks;
11. write the final pass only after every required stage is proven;
12. in `finally`, stop only recorded child PIDs, scan logs before deletion,
    remove only resolved task-owned logs/browser outputs, drop only exact
    PID-scoped databases, and run Compose `down --volumes --remove-orphans`
    only for its exact project;
13. retain the invocation marker and privacy-safe ledger/transcript as ignored
    local evidence.

`-UseExistingDatabase` and `-SkipInstall` may exist for hosted CI, as in the
current runner. They must not bypass the one-shot marker locally or omit a gate.
A `-SkipCumulativeBrowser` option must not be used for the accepted local
campaign or hosted required gate.

### Detached/full-campaign safeguard

- If the shell returns while the recorded PID still exists, monitor that same
  PID and transcript; do not start another command.
- If the PID has exited, preserve the marker, ledger, transcript, service logs,
  Docker project name, and last stage before cleanup/classification.
- Never delete the marker, rename a second invocation, or call
  `validate:p5-s1` again.
- Reproduce and recover only the failed/interrupted stage with its targeted
  command. Do not rerun ledger-confirmed passing stages.
- Execute any not-yet-started required stages as explicit targeted commands
  against the corrected candidate, record them as classified continuation
  evidence in the session log, and keep the original one-shot marker. This is
  not reported as a second Level C.
- If retained evidence cannot establish the exact candidate, command, or
  result, the slice is not promotable. Do not manufacture a pass or erase the
  ambiguity.

## Failure classification and targeted recovery

| Symptom/evidence                                                           | Classification                                   | Targeted recovery only                                                                                       | Promotion effect                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Java/Node assertion exposes incorrect product behavior                     | Implementation defect                            | Fix the smallest owner; rerun that test class/file plus adjacent static/build proof                          | Block until green                                    |
| Schema-valid provider fixture is rejected, or invalid fixture was accepted | Contract/provider drift                          | Reconcile only against frozen schema; rerun Node integrity and affected Java provider class                  | Block until both consumers agree                     |
| Test expects a claim absent from the frozen contract                       | Test defect                                      | Correct test/fixture; rerun affected file and schema integrity                                               | Block until reviewed                                 |
| Docker daemon unavailable, port occupied, Java process denied, disk full   | Environment issue                                | Preserve ledger; free only task-owned resource or use a new collision-checked port for the interrupted stage | Block until missing evidence passes                  |
| Wrapper checksum mismatch or JDK/Maven/Spring pin differs                  | Dependency/toolchain issue                       | Stop; obtain official evidence/reviewed bytes, then rerun only integrity plus affected Java stages           | Hard block; never bypass                             |
| Advisory service/network unavailable                                       | Dependency/environment issue                     | Retain output; retry only the accepted advisory command when service is available                            | Block if required result absent                      |
| Hosted checkout SHA differs from `EXPECTED_SHA`                            | CI integrity failure                             | Stop run; diagnose workflow/event inputs; do not test another SHA under the same evidence                    | Hard block                                           |
| PostgreSQL forced rollback leaves any object/version row                   | Migration defect                                 | Fix migration; run migration class, owner/isolation check, and adjacent repository integration               | Hard block                                           |
| One concurrent write is lost or both conflicts commit                      | Implementation/data defect                       | Fix transaction/version boundary; rerun concurrency plus idempotency tests                                   | Hard block                                           |
| Public directory calls Identity or exposes protected/request fields        | Security/privacy defect                          | Fix Gateway/provider projection; rerun consumer/provider/browser privacy and log scans                       | Hard block                                           |
| Protected operation reuses or omits the request-bound decision             | Security/authority defect                        | Fix Gateway/Community decision binding; rerun exact consumer/provider/live tests                             | Hard block                                           |
| Timeout occurs before dispatch                                             | Environment/dependency or implementation timeout | Prove no authoritative write, then rerun only outage test                                                    | Never label result unknown if dispatch did not occur |
| Connection drops after dispatch                                            | Expected failure-path evidence or defect         | Reconcile by same idempotency identity; prove one or zero authoritative record, never duplicate              | No success until authoritative read                  |
| Browser selector races but semantic state is correct                       | Test defect after evidence                       | Narrow to stable semantic locator; repeat only affected path enough to show stability                        | Block until deterministic                            |
| Axe/reflow/focus/forced-colors failure                                     | UI/accessibility defect                          | Fix native UI; rerun affected viewport/locale plus adjacent browser path                                     | Hard block                                           |
| Forbidden sentinel appears in logs/audit/outbox/metrics                    | Privacy/security defect                          | Preserve restricted evidence, remove payload logging, rerun affected test and all privacy scans              | Hard block                                           |
| Unrelated pre-existing regression is reproducible on accepted base         | Unrelated pre-existing failure                   | Record base/candidate commands and owner; do not edit unrelated files without handoff                        | Promotion blocked if required gate remains red       |
| Shell detaches but PID is alive                                            | Execution detachment, not a test failure         | Monitor same transcript/PID                                                                                  | No new invocation                                    |
| Shell detaches and PID is gone                                             | Environment/execution issue                      | Use ledger to run only interrupted and unstarted targeted stages                                             | No second full campaign                              |
| Cleanup cannot prove a target belongs to the invocation                    | Cleanup safety issue                             | Stop cleanup and report exact path/resource for user review                                                  | Do not broaden deletion                              |

After two failed fixes in one classification, stop blind iteration and record
the error, attempts, hypothesis, and next diagnostic action.

## Local runtime topology and cleanup

The accepted runner should reuse the already pinned PostgreSQL image unless a
separate accepted change replaces it. It may extend the existing test Compose
configuration only to provision a Community database/role; it must not alter
Docker daemon, service, Registry, firewall, or global network configuration.

Required runtime order:

```text
PostgreSQL
→ Community migrations/readiness
→ Notification
→ Care
→ Identity
→ Spring Community packaged artifact
→ Node Gateway
→ built Next Web
→ Playwright
```

Community readiness must require database/migration readiness, while liveness
must not claim dependency readiness. Gateway readiness must expose Community
degradation truth without leaking endpoints or credentials.

Cleanup must:

- stop only the exact recorded PIDs and verify they are gone;
- delete only the exact invocation's temporary databases after terminating
  only connections to those database names;
- remove only the exact Compose project, volume, and network;
- verify task-owned ports no longer listen and no task-owned container remains;
- scan then remove task-owned logs and browser artifacts;
- preserve the ignored one-shot marker and privacy-safe evidence ledger;
- leave unrelated containers, volumes, networks, processes, databases, ports,
  Maven/Node caches, Docker global state, and the Stitch canary unchanged.

Cleanup failure is reported truthfully and recovered with an exact-target
command only. Never use a broad Docker prune, recursive workspace deletion, or
global Java/Maven cleanup.

## Hosted CI wiring

Update `.github/workflows/ci.yml` without weakening current gates.

### `windows-quality`

Retain exact-SHA checkout, Node 22.22.3, pnpm 11.9.0, frozen install, current
format/lint/type/unit/docs/config/secrets/build gates, and Node audit. Add:

- the officially accepted immutable Java setup action/configuration;
- JDK and wrapper checksum verification;
- `format:p5-s1:check` and schema-integrity/Node consumer tests;
- `mvnw.cmd -B -ntp -f services/community/pom.xml verify`;
- accepted Java dependency/provenance and reproducible-package gates.

This job proves the supported Windows wrapper path, not only Linux Maven.

### `postgres-community-browser`

Rename or replace the current PostgreSQL/browser job with a P5-S1 cumulative
job while retaining the accepted PostgreSQL image digest and exact-SHA check.
Add a generated masked `P5_COMMUNITY_DATABASE_PASSWORD`, provision only
`lifebridge_community`, install the officially accepted JDK, validate the same
wrapper metadata, then run:

```powershell
./scripts/validate-p5-s1.ps1 -UseExistingDatabase -SkipInstall
```

The hosted runner may use `./mvnw` internally on Linux, but it must use the same
checked-in wrapper distribution/checksum and POM as `mvnw.cmd`. The job must
prove Community migration rollback/reapply/no-backfill, owner isolation,
Spring provider/integration tests, the built public and protected
Node-to-Spring paths, both P5-S1 browser projects, privacy log scanning, and
cumulative regressions.

### Optional separate contract lane

If the cumulative PostgreSQL/browser timeout would exceed a reviewed bound,
add `community-cross-runtime-contract` rather than silently dropping tests. It
must run Node schema/consumer tests and Spring provider tests against the exact
same contract digest. Whether this is a separate job or remains in
`windows-quality` is an implementation-time CI-duration choice, not permission
to duplicate or omit proof.

### Aggregate required gate

Rename `integrated-gate` to the P1-through-P5-S1 required gate and make it
depend on every required job with `if: always()`. It must require literal
`success` for Windows quality, Community/PostgreSQL/browser, and any separated
contract lane. Cancelled, skipped, neutral, timed-out, or absent results fail
the gate.

## Promotion and canonical closeout gates

1. Before push, record the single local Level C evidence, classified recovery
   if any, exact cleanup result, diff/secrets/canary checks, and deferred
   KI-001/KI-016/KI-019/KI-020 disposition.
2. Push `phase/5-consented-help-request-directory` without force and open
   exactly one ready feature PR to `dev`.
3. Require the hosted push/PR workflow whose `head_sha` equals the exact feature
   commit. Every required job and aggregate gate must be green; a green run for
   an earlier commit is not evidence.
4. Merge only by merge commit. Verify the resulting `dev` SHA has the accepted
   previous `dev` and feature head as parents.
5. Require the post-merge `dev` workflow whose `head_sha` equals that exact
   merge commit, with every required job green.
6. Verify canonical issue #15 before any issue mutation; then add bilingual
   immutable evidence and close only after the post-merge gate passes.
7. Make only necessary same-task docs-only canonical correction/promotion.
   Application/contract/migration inputs must remain unchanged; do not repeat
   the local Level C.
8. Record exact next handoff only. Do not start P5-S2, P5-S3, DATA-S1, P6,
   deployment, pilot, or release.

## Acceptance decision

This test/CI/operations plan is **PASS WITH DEPENDENCIES**:

- the repository has reusable one-shot, PostgreSQL, privacy, browser, and
  exact-head CI patterns;
- no test/operations blocker prevents P5-S1 after reconciliation;
- Java/toolchain and contract-dependent commands remain deliberately unpinned
  here and are a hard pre-code dependency on the independent official-source
  review;
- native product UI remains blocked until the independent Stitch
  privacy/accessibility review and Frozen redacted handoff are complete.

No application/product code, runtime configuration, dependency, CI workflow,
or protected canary was changed by this review.
