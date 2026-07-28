# P5-S1 Contract, Toolchain, Data, Authority, and Threat Review

- Status: **PASS for contract and implementation**
- Reviewed: 2026-07-28
- Contract: `P5-S1-v1`
- UI handoff: `P5-S1-UI-v1`
- Architecture: ADR-019 / `CHG-2026-011`
- Scope: `LB-022 /help/new` and `LB-024 /community`

This record reconciles the independent official-source toolchain/threat
review, the Frozen Stitch privacy/accessibility handoff, and the independent
test/CI/operations review. It freezes the inputs required before Java or
product implementation. It does not authorize P5-S2 matching, P5-S3
moderation, deployment, or a rewrite of an existing Node service.

## Research gate and official pins

Gate: **PASS**. The complete supported artifacts below exist and their
integrity evidence is sufficient for P5-S1. The host's bare Java 8, `javac`
23, and system Maven running on JDK 23 are not accepted build inputs.

| Input                  | Accepted pin and integrity basis                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JDK                    | Eclipse Temurin 25 LTS, exact Windows x64 HotSpot JDK `25.0.3+9`; archive SHA-256 `709312cd0420296d9b9de917fe6e28a5b979e875ee5ab91783fb79bcd5857235`                                 |
| Spring Boot            | `4.1.0`; official system requirements require Java 17+ and support through Java 26                                                                                                   |
| Maven                  | Apache Maven `3.9.16`; wrapper ZIP SHA-256 `5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce`, derived only after the official ZIP passed Apache's published SHA-512 |
| Maven Wrapper          | Apache Maven Wrapper `3.3.4`, `only-script`; repository owns `mvnw.cmd`, `mvnw`, and `.mvn/wrapper/maven-wrapper.properties`; no wrapper JAR                                         |
| Spring-managed runtime | PostgreSQL JDBC `42.7.11`, Flyway `12.4.0`, JUnit Jupiter `6.0.3`, Spring Framework `7.0.8`, as pinned by the official Spring Boot `4.1.0` dependency BOM                            |
| Maven plugins          | Spring Boot `4.1.0`; compiler `3.15.0`; surefire/failsafe `3.5.6`; enforcer `3.6.3`; CycloneDX `2.9.1`; all are pinned by the official Spring Boot `4.1.0` BOM or parent             |

Primary sources, accessed 2026-07-28:

- `https://spring.io/projects/spring-boot/`
- `https://docs.spring.io/spring-boot/system-requirements.html`
- `https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom`
- `https://adoptium.net/temurin/releases/`
- `https://adoptium.net/installation/ci-scripts/`
- `https://maven.apache.org/download.cgi`
- `https://maven.apache.org/docs/3.9.16/release-notes.html`
- `https://maven.apache.org/tools/wrapper/`
- `https://maven.apache.org/tools/wrapper/maven-wrapper-plugin/wrapper-mojo.html`

The complete Temurin `25.0.3+9` artifact is selected instead of the currently
incomplete `25.0.4` placeholder. Re-check when a complete official Windows x64
`25.0.4` artifact and checksum appear, and again at P11/security review.
Upgrading later is a reviewed pin change, never a floating download.

`actions/setup-java` identifies this same accepted Temurin build in its hosted
Windows catalog as `25.0.3+9.0.LTS`. That catalog alias is used only for the
pinned hosted setup action; the repository archive URL, checksum, extracted
runtime and Maven version proof remain exactly Temurin `25.0.3+9`.

The accepted bootstrap downloads only the exact JDK archive, verifies the
frozen digest before extraction, and places it under ignored
`.lifebridge-local/toolchains/`. It sets `JAVA_HOME` and `PATH` only for the
current process and children. It never uses `setx`, Registry, a package
manager, global Maven settings, system Maven, or a machine-wide configuration
change. Maven itself must report Java `25.0.3`.

## Authority freeze

### Request-bound decision digest

Every protected Gateway-to-Community operation carries a fresh P2 decision
whose `requestDigest` is the lowercase hexadecimal SHA-256 of this UTF-8 byte
sequence:

```text
UPPERCASE_HTTP_METHOD + "\n" + exact_internal_path + "\n" + canonical_body
```

`canonical_body` is minified JSON with object keys sorted lexicographically at
every nesting level and array order preserved. A bodyless operation uses `{}`.
The internal path is the exact versioned Community path after concrete path
parameters have been substituted. Both the Node consumer and Spring provider
must test the same fixed vectors. No locale-specific or platform newline
normalization is permitted.

Identity & Consent remains authoritative. P5-S1 adds, without backfill:

```text
purpose: community_support
scope: community_help_request.access
```

Existing `household_coordination` grants do not gain this purpose or scope.
The self-established subject may act for their own recipient context. Any
other active same-household account needs a current `community_support` grant
containing `community_help_request.access` and the subject's current permitted
coordination visibility. Organizer, caregiver, or member status alone grants
nothing.

Every protected operation consumes one new request-digest/correlation-bound
Identity decision, valid for at most ten seconds, with exactly one permission:

```text
community.help_request.list
community.help_request.submit
community.help_request.reconcile
community.help_request.close
community.help_request.delete
```

The decision contains only opaque actor/subject/household/recipient/grant
references, purpose, exact permission, current versions, decision time,
correlation, and request digest. Community rejects a missing, expired,
future-dated, wrong-purpose, wrong-permission, wrong-household,
wrong-recipient, wrong-request, wrong-digest, or malformed decision before
reading or writing a protected row.

Public directory reads are a separate contract. Gateway must not call Identity
or forward cookies, CSRF, household identity, grants, subject data, protected
filters, or help-request facts to public search.

## Help-request command and lifecycle freeze

The only submitted fields are:

```text
submissionReference: opaque client reference
category:
  daily_living_support
  transport_coordination
  household_errand
  social_connection
  digital_access
  accessibility_support
location:
  granularity: province_city
  provinceCityCode: reviewed allow-listed code
dayPart: flexible | morning | afternoon | evening | null
disclosure:
  purpose: community_support
  visibility: current_request_collaborators
  policyVersion: P5-S1-v1
  confirmed: true
```

There is no title, narrative, notes, diagnosis, treatment, medication,
urgency, eligibility reason, exact time, street address, coordinate, file,
organization preference, match preference, or arbitrary extension field.
Unknown fields fail validation. Location is province/city only; the browser
does not send GPS. Location permission is optional, and denial leaves manual
province/city selection available.

The visibility disclosure means the current subject and accounts holding the
current P5 request grant. A request is not public and is not disclosed to a
directory organization, volunteer, or future matcher in P5-S1.

Lifecycle is:

```text
submit command outcome: confirmed
authoritative request state: pending -> closed -> deleted
matching state: unavailable_in_p5_s1
```

`submitted` is a confirmed command outcome, not a matching or delivery state.
`pending` means only that Community durably owns an open request. It does not
mean reviewed, queued for matching, matched, accepted, available, delivered,
safe, eligible, or completed. `closed` records only authoritative closure.
Delete removes active protected request fields and has no in-product undo.

## Idempotency, duplicates, concurrency, and uncertainty

- Submit, close, and delete require `Idempotency-Key`.
- Community hashes the key; raw keys never enter tables, logs, audit, events,
  metrics, or traces.
- Replay retention is 24 hours. Same actor, operation, key, route, and
  canonical intent returns the original authoritative result without another
  transition. Changed intent returns `IDEMPOTENCY_CONFLICT`.
- `submissionReference` supports fresh-authority reconciliation after an
  uncertain submit. A timeout or connection loss after dispatch is
  `COMMUNITY_REQUEST_RESULT_UNKNOWN`; the browser never retries blindly.
- At most one pending request exists for the same recipient context, category,
  province/city, and day-part tuple. A duplicate returns the already-authorized
  current request as duplicate reconciliation, not a second request.
- Close and delete require exact `expectedVersion`. Community locks the
  aggregate and increments the version. One concurrent command wins; stale
  commands return `COMMUNITY_REQUEST_VERSION_CONFLICT`.
- A changed lifecycle returns `COMMUNITY_REQUEST_STATE_CONFLICT`.
- An explicit deletion leaves a digest-only tombstone so an expired replay or
  reused submission reference cannot resurrect the request.

## Retention and deletion freeze

- A pending request automatically closes after 30 days if the requester has
  not closed or deleted it.
- Closed protected request fields are retained for at most 30 further days,
  then purged.
- Explicit delete immediately purges the active protected request fields.
- Content-free audit, tombstone, idempotency, and outbox evidence is retained
  for at most 365 days, except the 24-hour replay projection.
- A Community-owned scheduled/on-access sweep performs these transitions and
  is idempotent. It emits only content-free lifecycle evidence.
- No product copy claims erasure from historical production backups, legal
  hold handling, production RPO/RTO, or recovery. Those remain deployment
  controls.

## Public directory and PostgreSQL search freeze

PostgreSQL is the only search implementation. Search is parameterized,
structured, bounded to 25 results, and deterministically ordered by public
name then opaque listing ID. There is no free-text query, ranking score,
personalization, Elasticsearch, Redis, broker, or second Community service.

Filters are optional allow-listed category, province/city, and organization
type:

```text
public_service | nonprofit | community_group
```

One listing may expose only:

```text
opaque listing ID
public organization name and type
reviewed province/city service area
bounded public categories
organization-published public contact channel
optional enumerated accessibility-contact note
source label and public source URL
lastReviewedAt and nextReviewAt
provenanceState: current | stale
availabilityState: not_verified
eligibilityState: not_determined
endorsementState: none
```

Directory migrations insert no listing. Deterministic clearly fictional
listings are loaded only by the guarded synthetic fixture path. Provenance
staleness comes from stored review dates; Community or Gateway never invents
freshness. No results means only that no reviewed listing matched the chosen
filters.

Gateway may cache public directory responses for five minutes. The native UI
may retain one public, identity-free response in `sessionStorage` for at most
24 hours. Any offline rendering is labelled offline and stale with its
original source/review time and cache time. Protected request fields and
household identity never enter that cache. No Redis or service-worker queue is
introduced.

## Community-owned data and transaction freeze

Community exclusively owns its PostgreSQL role, database, Flyway migrations,
request rows, listing rows, search indexes, audit, idempotency, tombstones,
retention state, and transactional outbox. Gateway, Identity, Care, and
Notification receive no Community database credential and perform no
Community table write. Community receives no credential or SQL access for
another owner.

One submit/close/delete transaction contains the aggregate change, privacy-safe
audit row, idempotency result, and outbox row. Failure of any part rolls back
the whole command. Migrations are additive and transactional, apply through
Flyway, re-discovery is a checksum-verified no-op, and migration alone creates
zero requests, listings, audit rows, idempotency rows, tombstones, or events.

Audit stores an opaque event ID, action, outcome, actor-reference digest,
aggregate-reference digest, version, UTC time, and correlation only. It stores
no category, location, day-part, label, contact, authority token, request body,
or idempotency material.

Outbox event types are:

```text
community.help_request.submitted.v1
community.help_request.closed.v1
community.help_request.deleted.v1
```

Events contain opaque aggregate/event references, aggregate version,
enumerated lifecycle outcome, UTC time, correlation and causation only. They
contain no request category, location, schedule, directory fact, person,
household, grant, consent, free text, or contact. Delivery state is
`suppressed_not_configured`; an outbox row does not claim queueing, delivery,
matching, or notification.

## Stable failure truth

```text
COMMUNITY_REQUEST_VALIDATION_FAILED
COMMUNITY_REQUEST_DUPLICATE
COMMUNITY_REQUEST_VERSION_CONFLICT
COMMUNITY_REQUEST_STATE_CONFLICT
COMMUNITY_REQUEST_RESULT_UNKNOWN
COMMUNITY_RESOURCE_NOT_FOUND
COMMUNITY_AUTHORITY_REQUIRED
COMMUNITY_CONSENT_REVOKED
IDEMPOTENCY_KEY_REQUIRED
IDEMPOTENCY_CONFLICT
DIRECTORY_VALIDATION_FAILED
DIRECTORY_SEARCH_UNAVAILABLE
IDENTITY_SERVICE_UNAVAILABLE
COMMUNITY_SERVICE_UNAVAILABLE
INTERNAL_CONTRACT_INVALID
```

Unavailable search is not an empty result. Missing and inaccessible protected
resources share a non-enumerating response. A malformed success payload fails
closed. Known validation/duplicate/conflict responses are not uncertain;
timeouts or invalid responses after dispatch are uncertain and require a fresh
authorized reconciliation read.

## Threat boundaries and required proof

| Threat                                                   | Required control and evidence                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Household role becomes consent                           | New purpose/scope with no backfill; fresh exact decisions; Identity/Gateway/Community denial tests   |
| Public directory leaks protected context                 | Separate unauthenticated route; no Identity call or protected forwarding; consumer/browser proof     |
| Payload captures sensitive narrative or precise location | Strict schemas, province/city allowlist, no free text/GPS/unknown fields; provider tests             |
| Request is falsely claimed submitted or matched          | Confirm only committed Community result; explicit P5-S1 matching boundary; failure/browser tests     |
| Timeout duplicates a request                             | Stable key/reference/digest and fresh reconciliation; concurrency and runtime disconnect tests       |
| Stale close/delete changes the wrong state               | Expected version, row lock, atomic transaction, replay and race tests                                |
| Search injection or false eligibility                    | Structured parameterized PostgreSQL filters; no rank/inference; query and copy tests                 |
| Stale provenance is shown as current                     | Stored review times and explicit current/stale/offline cache labels; browser tests                   |
| Audit/event/log leaks need or location                   | Content-free allowlists and digest-only actor/aggregate refs; database and runtime log scans         |
| Migration crosses owners or invents data                 | Separate role/database, Flyway checksum, rollback/reapply/no-backfill/privilege proof                |
| Local toolchain is substituted                           | Exact Temurin digest, wrapper-only Maven, enforcer, CI exact-version checks                          |
| Offline UI invents a queue                               | P5-S1 blocks help submission offline; no protected durable queue; browser storage/network assertions |

Residual gates: KI-001 still blocks deployment credential claims; KI-016 keeps
manual assistive-technology/device rows open; KI-019 keeps private Stitch pixel
inspection open; KI-020 remains scoped to the document-vault deployment
controls and is not resolved by Community. Production backup erasure, pilot,
release, organization matching, safeguarding, and moderation remain outside
P5-S1.

## Reconciled implementation gate

The three independent reviews agree:

1. official pins are complete and reproducible;
2. `P5-S1-v1` can be frozen as language-neutral OpenAPI/JSON Schema before
   Java DTOs or Node consumer code;
3. the Frozen Stitch handoff is sufficient for corrected native semantics
   while KI-019 remains truthful;
4. the test/operations plan can prove Node-to-Spring compatibility,
   owner-isolated migrations, security/privacy/accessibility, one-shot Level C,
   cleanup, and hosted exact-head/post-merge gates.

No dependent blocker remains. Implement only this contract and stop before
P5-S2.
