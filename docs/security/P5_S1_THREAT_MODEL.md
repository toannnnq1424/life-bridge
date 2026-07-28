# P5-S1 Consented Help Request and Community Directory Threat Model

- Status: Frozen for implementation candidate; Level C and promotion pending
- Contract: `P5-S1-v1`
- Scope: native VI/EN LB-022 at `/help/new` and LB-024 at `/community`
- Change/decision: `CHG-2026-011` / ADR-019

## Assets and ownership

Community is the sole owner of its PostgreSQL role, database, Flyway
migrations, structured public directory listings and indexes, protected help
requests, idempotency records, deletion tombstones, privacy-safe audit and
transactional outbox. Identity & Consent owns current subject/grant/privacy
state and issues one fresh request-bound decision for each protected action.
Gateway composes those decisions with Community and owns no Community state.
The public directory is deliberately identity-free. Care and Notification are
not involved.

P5-S1 introduces one greenfield Spring Boot service under ADR-019. It does not
introduce Elasticsearch, Redis, a broker, object storage, a second Community
service, shared SQL or credentials. PostgreSQL structured search is the only
search implementation.

## Authority boundary

P5-S1 adds the purpose/scope pair below without broadening or backfilling any
existing grant:

```text
purpose: community_support
scope: community_help_request.access
```

The self-established subject may act for their own recipient context. Another
active household account needs a current grant containing that exact purpose,
scope and subject-permitted visibility. Household organizer, caregiver or
member status, a previous decision, an opaque request ID, browser state or an
outbox/audit fact grants nothing.

Every protected operation consumes one new Identity decision valid for at
most ten seconds and containing exactly one permission:

```text
community.help_request.list
community.help_request.submit
community.help_request.reconcile
community.help_request.close
community.help_request.delete
```

The decision binds the opaque actor, household, recipient context, purpose,
permission, current subject/grant/privacy versions, correlation ID and the
exact request digest. Community revalidates every fact before reading or
writing a protected row.

The digest is lowercase SHA-256 over UTF-8 bytes of
`UPPERCASE_METHOD + "\n" + exact_internal_path + "\n" + canonical_body`.
Canonical JSON is minified, recursively sorts object keys, preserves array
order and uses `{}` for a bodyless operation. Node and Java share fixed vectors
from the frozen review so platform newline or serializer drift fails closed.

## Trust boundaries

1. Browser to Gateway public read: no cookie, CSRF, household, grant, subject,
   request or protected filter is forwarded to Community.
2. Browser to Gateway protected action: opaque session, same-origin/fetch-
   metadata and CSRF mutation controls, strict command and idempotency input.
3. Gateway to Identity: exact permission, target, purpose, canonical request
   digest and correlation for one fresh decision.
4. Gateway to Spring Community: only the minimum decision projection plus one
   schema-valid read or command over the configured internal boundary;
   Community requires its internal service token, which is never exposed to
   the browser, logs, audit, outbox or contract fixture. No Identity token or
   membership object crosses.
5. Community to its PostgreSQL owner: parameterized structured search or one
   atomic request/audit/idempotency/outbox transaction.
6. Browser cache: at most one identity-free public directory response in
   `sessionStorage` for 24 hours; no protected request or household context.

## Minimum data and truthful state

A request accepts only an opaque submission reference, one of six bounded
support categories, province/city code, optional broad day part and the exact
`P5-S1-v1` disclosure confirmation. It accepts no title, narrative, diagnosis,
treatment, medication, urgency, eligibility reason, precise time/address/GPS,
file, organization or match preference, or arbitrary field.

The authoritative request lifecycle is `pending -> closed -> deleted`.
`submitted` is only a confirmed command outcome. `pending` means Community
durably owns one open request; it does not mean reviewed, queued for matching,
matched, accepted, available, delivered, safe, eligible or completed.
Matching is `unavailable_in_p5_s1`.

Public listings expose only reviewed organization-published metadata,
province/city service area, bounded categories/contact/provenance facts and
explicit `availabilityState=not_verified`,
`eligibilityState=not_determined`, and `endorsementState=none`. No result means
only that no reviewed listing matched the selected filters.

## Threats and required controls

| Threat                                                            | Control                                                                                                                                                          | Required evidence                                     |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Household role becomes consent or subject authority               | Additive purpose/scope with no backfill; fresh exact decisions; downstream revalidation before lookup                                                            | Identity/Gateway/Community denial and migration tests |
| Public directory leaks protected context                          | Separate unauthenticated route; no Identity call; no cookie/session/household/request forwarding or cache key                                                    | Consumer and runtime browser/privacy proof            |
| Form captures sensitive narrative or precise location             | Strict additional-property rejection; bounded category/day part; reviewed province/city allowlist; no free text or GPS                                           | Schema/provider/UI tests                              |
| Submission or matching is falsely confirmed                       | Show success only after committed Community response; keep command outcome, lifecycle and matching boundary distinct                                             | Transaction and browser failure-state tests           |
| Timeout duplicates a request                                      | Digest-bound 24-hour idempotency, same-key transaction advisory lock and submission-reference reconciliation; never retry an uncertain dispatch blindly          | Replay, same-key race and reconciliation proof        |
| Concurrent command loses an update                                | Row/advisory serialization and exact expected version; one winner and one bounded conflict                                                                       | PostgreSQL race tests                                 |
| Duplicate pending need is created                                 | One pending recipient/category/province-city/day-part tuple; return authorized existing aggregate without a second transition                                    | Duplicate and concurrency tests                       |
| Search injects input or infers eligibility                        | Allowlisted structured filters, parameterized PostgreSQL query, maximum 25, deterministic ordering, no rank/personalization                                      | Query and provider tests                              |
| Public source URL becomes SSRF/open redirect or unreviewed import | Source URLs are reviewed display metadata only; Community never fetches, resolves, crawls, redirects through or imports them                                     | Provider/static/runtime network proof                 |
| Stale directory facts appear current                              | Persist authoritative review dates; expose current/stale/offline cache truth and source time                                                                     | Provider and desktop/mobile browser tests             |
| Audit, events or logs expose request/location/identity facts      | Enumerated actions/outcomes and opaque digests only; allowlisted telemetry; no body, authority, location or contact                                              | Database serialization and runtime scans              |
| Delete or retention resurrects protected data                     | Aggregate-linked replay invalidation, immediate active purge, digest-only tombstone and owned locked 30-day close/purge scheduler                                | Retention/delete/replay/version tests                 |
| Migration crosses owners or invents data                          | Community-only role/database/Flyway V1; rollback/reapply/checksum/no-backfill and privilege proof                                                                | Migration campaign                                    |
| Internal token or database credential crosses a boundary          | Token is required only Gateway→Community and excluded from responses/evidence; Community alone receives its DB credential; other roles have zero table privilege | Configuration/secret/log and owner-isolation tests    |
| Toolchain silently substitutes a local runtime                    | Exact Temurin/Maven checksums, repository wrapper, Maven enforcer and immutable CI setup                                                                         | Bootstrap, wrapper, package and reproducibility gates |
| Offline UI invents a queue                                        | Protected submission is blocked offline; no service-worker/background queue or protected browser persistence                                                     | Browser network/storage assertions                    |

## Idempotency, retention and deletion

Submit, close and delete require `Idempotency-Key`; only its digest is stored.
Same actor/operation/key/route/intent within 24 hours replays the original
authoritative result. Changed intent returns `IDEMPOTENCY_CONFLICT`.
`submissionReference` is used only for fresh-authority reconciliation after an
uncertain submit. First use is serialized before the replay lookup. Delete or
retention purge invalidates earlier aggregate-linked submit/close responses;
only the new minimal explicit-delete response may remain replayable.

Pending requests auto-close after 30 days. Closed protected fields are purged
within 30 additional days. Explicit delete immediately purges active fields.
Content-free audit, tombstone and outbox evidence may remain for at most 365
days. The Community-owned scheduler uses row locks with `SKIP LOCKED`, and
delete/purge evidence consumes the next aggregate version. These rules do not
claim historical production-backup erasure, legal-hold handling, RPO/RTO or
regulatory compliance.

## Stable failure truth

Stable failures are `COMMUNITY_REQUEST_VALIDATION_FAILED`,
`COMMUNITY_REQUEST_DUPLICATE`, `COMMUNITY_REQUEST_VERSION_CONFLICT`,
`COMMUNITY_REQUEST_STATE_CONFLICT`, `COMMUNITY_REQUEST_RESULT_UNKNOWN`,
`COMMUNITY_RESOURCE_NOT_FOUND`, `COMMUNITY_AUTHORITY_REQUIRED`,
`COMMUNITY_CONSENT_REVOKED`, `IDEMPOTENCY_KEY_REQUIRED`,
`IDEMPOTENCY_CONFLICT`, `DIRECTORY_VALIDATION_FAILED`,
`DIRECTORY_SEARCH_UNAVAILABLE`, `IDENTITY_SERVICE_UNAVAILABLE`,
`COMMUNITY_SERVICE_UNAVAILABLE` and `INTERNAL_CONTRACT_INVALID`.

Raw Identity codes do not cross Gateway. Exact Community revocation is the only
path to `COMMUNITY_CONSENT_REVOKED`; other authority denials are normalized to
`COMMUNITY_AUTHORITY_REQUIRED`, while non-authority Identity failures are
`IDENTITY_SERVICE_UNAVAILABLE`.

Unavailable search is not an empty result. Denied and missing protected
resources are non-enumerating. Known validation/duplicate/conflict responses
are not uncertain. An invalid response or connection loss after dispatch is
unknown until a new exact-authority reconciliation read succeeds.

## Residual risk and gates

P5-S1 does not prove organization matching, availability, eligibility,
safeguarding, moderation, production backup erasure, deployment, pilot or
release. KI-001 still blocks deployment credential claims. KI-016 retains
manual assistive-technology/device evidence. KI-019 retains independent
private-pixel review; the Frozen Stitch handoff is native semantic input, not
standalone visual approval. KI-020 remains limited to P4-S3 document-vault
deployment controls and is neither changed nor resolved by Community.

The exactly-one local P5-S1 Level C campaign, exact-head hosted CI, merge-
commit promotion, post-merge `dev` CI and issue #15 closeout remain required
before this candidate is accepted. P5-S2 may begin only in a new task after
those gates pass.
