# Security and Privacy

## P7-S2 recovery controls

Recovery uses dedicated per-service keys/scopes, never Gateway read or Care
publisher credentials. Evidence is content-free and bounded; mutation is
Care-only, single-event, dry-run-first, audited and fenced. Logs/tool output
exclude payloads, recipient content, tokens, database URLs, response bodies and
stacks. See `docs/security/P7_S2_THREAT_MODEL.md`.

## Security objectives

LifeBridge handles household relationships and potentially sensitive care
coordination. The project prioritizes:

1. confidentiality and minimum necessary disclosure;
2. explicit consent and least privilege;
3. integrity and accountability of care tasks;
4. availability and truthful offline/stale state;
5. safe recovery without leaking protected data.

This document is an engineering baseline, not a legal-compliance certification
or medical-safety assessment.

## Trust boundaries

| Boundary                 | Main risks                                                | Required controls                                                                     |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Browser ↔ API gateway    | session theft, injection, enumeration                     | secure session, CSRF strategy, validation, throttling, non-enumerating errors         |
| Gateway ↔ services       | confused deputy, over-broad service identity              | service identity, explicit scopes, timeout, allow-listed routes                       |
| Service ↔ owned database | injection, excessive retention, operator access           | parameterized access, migrations, encryption, least privilege, audit                  |
| Event transport          | tampering, replay, sensitive payloads                     | authenticated transport, versioned envelope, idempotent consumer, minimum payload     |
| Stitch MCP               | secret leakage, external data egress, untrusted artifacts | synthetic prompts, disabled-by-default MCP, per-call approval, artifact review        |
| Research/data import     | license violation, PII, stale evidence                    | provenance register, classification, local raw-data ignore, review before fixture use |
| CI/deployment            | secret exposure, supply-chain compromise                  | pinned lockfile, minimal token scopes, secret scan, protected environments            |

## Identity, authorization, and consent

- Authentication does not imply household authorization.
- Every protected request checks role, household boundary, current consent, and
  minimum required capability.
- Administrative and moderation roles are separate from household roles.
- Consent has purpose, scope, lifecycle, version, and audit evidence.
- Revocation changes future access; any retention obligation must be explicit.
- Error behavior must not reveal the existence of an inaccessible person,
  household, document, invitation, or task.
- P1 fixture identity is an explicit local/test adapter. The production build
  rejects fixture mode. The owning service still verifies actor, household,
  active assignment, resource, and action rather than trusting UI role text.
- Under `CHG-2026-008`, the completion audience is the distinct task
  creator/coordinator. Care resolves delivery versus self-suppression before
  emitting the minimum event; Notification enforces recipient-scoped reads.

## Sensitive data rules

- Collect the least data required for the active slice.
- Do not place protected data in URLs, logs, events, analytics, exception text,
  screenshots, design prompts, or test snapshots.
- Production secrets never enter Git, fixtures, Markdown, issue text, chat,
  command arguments, or client bundles.
- Demo and automated-test identities are obviously synthetic.
- Medication reminders are coordination records; LifeBridge does not prescribe,
  diagnose, or infer dosage.
- Emergency plans present user-configured information and do not claim automatic
  dispatch or medical authority.

## Logging

Every structured log may include:

- timestamp, level, service, stable event name;
- correlation and trace identifiers;
- redacted/pseudonymous actor or resource reference;
- result and bounded error code;
- duration and retry count.

Logs must not include:

- authorization headers, cookies, passwords, tokens, keys, session material;
- complete request/response bodies by default;
- names, contact details, care notes, medication text, document contents;
- database connection strings or stack traces in client responses.
- task titles/descriptions, event/request payload bodies, fixture display names,
  or raw thrown-error messages.

Redaction is allow-list based. A logging change touching shared middleware
requires adjacent tests and phase-level secret scanning.

P1 local PostgreSQL passwords are generated into ignored local state, passed by
process environment, and never printed. Committed Compose/workflow files contain
no reusable credential. CI databases are disposable and isolated to the run.
GitHub workflow-generated owner passwords are masked before they are exported
to later steps; synthetic/transient scope is not an exception to log hygiene.

## Dependency and supply-chain policy

- Project-local dependencies only; no global install for repository operation.
- Lockfile is committed and frozen in CI.
- New dependencies require purpose, maintenance/provenance review, license
  review, and smallest reasonable scope.
- Install scripts are inspected when risk is material.
- `pnpm-workspace.yaml` uses explicit `allowBuilds`: required `esbuild` is
  allowed and `sharp` is denied. Because P1-S1 has no `next/image` or server
  image pipeline, the vulnerable optional Sharp edge is excluded rather than
  forced outside Next's declared range. Only Next 16.2.11's required PostCSS
  edge is overridden to reviewed patched 8.5.18. A later image feature must
  reopen the review before enabling or replacing Sharp.
- Known vulnerabilities are classified by exploitability and exposure, not
  hidden by blanket ignores.
- The rejected `@_davideast/stitch-mcp@0.9.0` package must not be executed.

## Stitch and external tools

Follow `docs/orchestration/STITCH_CODEX_APP_OPERATIONS.md`.

- Remote MCP is disabled by default.
- `STITCH_API_KEY` is referenced by name only.
- Only synthetic, non-sensitive content may be sent.
- Tool schemas and side effects are reviewed before use.
- Generated code/images are untrusted imports.
- Write, delete, export, build, browser, bulk, or material-cost operations
  require explicit approval.
- A required MCP that remains unavailable after 180 seconds becomes
  `MCP-DEBT-*`; dependent acceptance stays blocked while unrelated safe work may
  continue.
- Required MCP debt closes only after approved runtime secret handling,
  least-privilege and data-egress review, complete tool-schema/side-effect
  review, a synthetic canary, and recorded affected validation.
- Any key pasted into chat is treated as disclosed and cannot be a production
  secret. `CHG-2026-006` is a one-time exception for the project-owner-approved
  disposable Stitch key: use it only in process memory against the official
  endpoint for the bounded private synthetic design session; never persist,
  echo, hand off, or commit it; stop before diff/commit review and require
  provider-side retirement before deployment.

## Security validation

Phase/slice checks:

- working-tree and staged secret-pattern scan;
- dependency lockfile integrity;
- authorization/error contract tests for affected paths;
- log-redaction tests for changed middleware;
- configuration parse and allowed-host checks;
- no debug endpoints or local credentials in production build.

Before release:

- full secret scan including tracked history;
- dependency audit and SBOM;
- authorization matrix and tenant/household isolation tests;
- backup/restore rehearsal for each source of truth;
- deployment configuration review;
- incident-response and credential-rotation rehearsal.
- artifact provenance, container/dependency scans, and owned exceptions;
- zero unresolved required MCP/integration debt;
- successful P8 security/privacy/abuse/supply-chain gate and current P9
  incident/DR evidence.

## Incident response

1. Stop the affected action and preserve redacted evidence.
2. Do not repeat or print a suspected secret.
3. Disable the narrow integration or credential.
4. Confirm scope through logs and repository history.
5. Rotate/revoke through the credential owner.
6. Apply the smallest safe remediation and targeted test.
7. Record impact and follow-up in `KNOWN_ISSUES`, `DECISIONS`,
   `INTEGRATION_LOG`, and `SESSION_LOG` as applicable.
8. Never rewrite public Git history without explicit authorization and a
   coordinated incident plan.

## P2-S1 identity threat-model control

The frozen account/session/recovery/preferences threat model is
`docs/security/P2_S1_THREAT_MODEL.md` under `CHG-2026-010`/ADR-018. It requires:

- first-party Identity-owned PostgreSQL and no cross-service table access;
- Argon2id password storage with documented parameters, encrypted TOTP seed,
  TOTP replay CAS, digest-only one-time recovery/challenge/session artifacts;
- generic account/recovery responses and dummy password work for unknown users;
- atomic account/request-source rate limits using HMAC-derived dimensions;
- opaque server-side host-only cookie sessions, rotation/revocation, idle and
  absolute expiry, synchronizer CSRF, exact Origin and Fetch Metadata checks;
- public actor-header stripping and account-only authorization before P2-S2;
- no credential mutation offline queue and no secrets in browser storage;
- allow-listed logs and Identity-owned audit that exclude login names,
  passwords, OTP/seeds, recovery/session/CSRF/challenge tokens, raw IP,
  cookies, headers, bodies, database URLs and raw errors.

The selected libraries are `@node-rs/argon2` and `otpauth`, pinned exactly and
reviewed through the lockfile/lifecycle/dependency gate. TOTP is not
phishing-resistant and the project makes no NIST AAL or compliance claim.
Production UI is separately blocked by `MCP-DEBT-2026-002`.

The P2 native account UI uses no generated Stitch source and persists no
password, factor, recovery or challenge value in browser storage/history.
Its dedicated Playwright project disables trace, screenshots and video.
Account onboarding remains `account` scope and cannot authorize household
resources. Final acceptance requires the full P2 Level C and exact-head CI.

## P2-S2 household authorization control

The frozen backend control is
`docs/security/P2_S2_THREAT_MODEL.md`. Identity & Consent remains sole
authority/PostgreSQL owner. Authentication is necessary but never sufficient;
each resource access evaluates active membership and a server-owned capability.
Inaccessible and absent resources share one envelope. Invitation secrets are
CSPRNG, digest-only, expiry-bound, rotated on resend and consumed under row
lock. Logs/audit exclude invitee/contact identifiers, tokens and recipient content.
Approved opaque household, invitation, membership and recipient-context target
IDs may be used for authorization audit correlation; invitee login/contact
identifiers, raw or digested tokens, recipient labels and care content are
prohibited. Success logs emit only after commit. Denied/conflict evidence uses
a protected placeholder and never confirms resource existence.

## P2-S3 consent, privacy, and audit control

The frozen control is `docs/security/P2_S3_THREAT_MODEL.md`. Organizer
membership is never consent authority. Only an explicit verified self-binding
for a context created by the same account can establish the subject; legacy
unproven contexts are not claimable or backfilled.

Grant, narrow and revoke are immediate, versioned, idempotent and serialized.
Narrow accepts a non-empty strict subset only. Revocation denies new governed
access at or after its UTC commit boundary while retaining redacted historical
evidence. Every governed read re-evaluates the current Identity-owned grant;
events and caches are not authorization sources.

Audit history is GET-only, subject-authorized, bounded, encrypted-cursor
paginated and redacted, with no totals or hidden-row oracle. Privacy settings
save atomically. Offline mutations are blocked without queue or reconnect
submission. Export/deletion/regulatory automation remain explicit non-goals.

Operational logs, metrics and spans are allow-listed separately from audit
evidence and exclude identifiers, labels, scopes, setting values, effective
times, idempotency material, cursors, counts, payloads, headers and raw errors.
Identity readiness fails when the P2-S3 schema marker is absent.

## P3-S1 coordination authorization control

The frozen control is `docs/security/P3_S1_THREAT_MODEL.md`.

Identity & Consent issues a fresh request-digest-bound decision for exactly
`coordination.timeline.read` or `coordination.task.handoff`. Active membership
is necessary but not sufficient: non-subject access requires the current P2
subject, active household-coordination basic-label grant, and subject privacy
visibility. Every target is evaluated independently. The decision is neither
consent nor a reusable authorization cache.

Gateway strips fixture/actor assertions, binds normalized intent, preserves
session/CSRF/origin evidence, and never fabricates success or an empty Care
projection. Care verifies the decision and the task's household, recipient,
assignee, open state and version. Handoff uses row locking, advisory-serialized
digest idempotency and one transaction for assignment, handoff, timeline,
audit, outbox and replay evidence.

Timeline cursors are HMAC-sealed and scope/version/snapshot/expiry bound. Pages
have no totals. Server UTC instants, validated IANA zones, PostgreSQL local-day
boundaries and `(occurred_at, event_ref)` ordering cover DST, equal timestamps,
clock skew and keyset continuation deterministically.

No free-form handoff content is accepted. Task titles stay inside the
authorized Care read projection. Notification carries only an opaque task ID;
allow-listed telemetry excludes titles, actor references, reason values,
decisions, cursors, headers, tokens, idempotency material, payloads and raw
errors. Offline mutation is blocked without queue or reconnect submit.

## P3-S3 support-plan controls

Fresh action-specific P2 authorization is mandatory for aggregate read, every
history page/detail, draft save, and confirmation. Role alone never grants
access. Care revalidates decision age, permission, household, recipient,
correlation, digest, and each responsibility actor. Generic 404 behavior
prevents existence/consent/history inference.

Strict bounded schemas reject extra fields, markup objects, control characters,
clinical/medication/treatment/recommendation fields, contacts, locations, and
arbitrary metadata. Human-entered coordination statements stay only in
authorized no-store Care reads. Events, audit metadata, outbox, Notification,
logs, metrics, traces, cursors, and errors are content-free. Optimistic locking,
advisory/row locks, idempotency, immutable history, sealed no-total cursors,
stored IANA-day boundaries, no persistent browser cache, no offline queue, and
fresh-read uncertain recovery are required. The full matrix is
`docs/security/P3_S3_THREAT_MODEL.md`.

## P4-S1 reminder security and privacy controls

Every schedule and Notification operation consumes a new exact-purpose P2
decision. Downstream owners revalidate permission, household, recipient
context, actor/recipient, request digest, correlation and decision age. An
organizer or member without the current subject/grant/privacy decision receives
the same generic response as an absent resource and causes no owner write.

Strict schemas accept only a Care-local label, exact user-entered amount/unit
and deterministic finite schedule facts. They reject unknown fields, control
characters, clinical instructions, diagnosis, treatment, recommendation,
urgency, adherence, missed-dose guidance and arbitrary metadata. Cross-service
events omit label/amount/unit and use a fixed localized message key. Logs,
metrics, traces, audit metadata, errors and cursors omit schedule payloads,
authority bodies, actor references, idempotency material, credentials and raw
errors.

DST gaps are rejected; overlaps require an explicit policy and matching offset.
Server time controls due/missed boundaries. Digest-bound idempotency, optimistic
versions, advisory/row locks, unique occurrence identities, replay-safe inboxes
and atomic state/audit/outbox transactions address replay, stale and split-write
risks. Intent, delivered evidence, failed/missed/uncertain delivery and seen
acknowledgement remain distinct. Offline mutation is blocked; timeouts require a
fresh authoritative read and never a blind retry. The complete matrix is
`docs/security/P4_S1_THREAT_MODEL.md`.

## P4-S2 emergency readiness and offline-copy controls

Every online contact, plan, history, and offline-snapshot request consumes a
new exact-purpose P2 decision. Gateway binds the complete intent; Care
revalidates permission, household, recipient, request digest, correlation,
subject/grant/privacy versions, and decision age before any data access.
Organizer/member status and a locally stored snapshot are never authority.

Strict schemas accept only a bounded label, one configured phone method, exact
order, and bounded participant-entered guidance steps. They reject unknown
fields, markup/control characters, addresses, email, availability,
professional/legal status, diagnosis, treatment, urgency, dispatch claims, and
arbitrary metadata. Protected values stay only in authorized Care reads and
the accepted encrypted snapshot. Events, audit metadata, idempotency responses,
logs, metrics, traces, cursors, and errors are content-free.

ADR-025 and `docs/security/P4_S2_THREAT_MODEL.md` govern the browser exception:
explicit per-device opt-in; a distinct non-recoverable offline passphrase;
PBKDF2-HMAC-SHA-256 with 600,000 iterations; random 16-byte salt; AES-256-GCM
with a random 12-byte nonce; authenticated scope/schema/source/version/
confirmation/expiry metadata; one IndexedDB ciphertext; app-shell-only Cache
Storage; protected HTTP `no-store`; atomic verified replacement; and fail-
closed purge on integrity/AAD failure. Wrong/forgotten passphrase recovery is
local removal plus an online fresh-authority recreation.

Remote revocation cannot be discovered while offline. Every offline render
therefore says it is not live and current permission/updates cannot be checked.
At known logout, account switch, denial/revocation, `no_plan`, confirmed
contact/source change, incompatible schema, explicit removal, or 72-hour hard
expiry, content is hidden and the matching snapshot is purged before render.
Same-origin XSS, an unlocked device/profile, weak-passphrase guessing, and the
residual offline revocation window remain documented risks, not a security or
compliance claim. Offline writes are blocked and never queued, retried, or
submitted on reconnect.

## P4-S3 document-vault controls

`docs/security/P4_S3_THREAT_MODEL.md` and ADR-026 govern this slice. The
`document_vault.access` scope is required in addition to active household
membership and current subject visibility. Every list/upload/metadata/download/
delete operation obtains a fresh exact permission; organizer status,
basic-label consent, prior decisions, local state and possession of an opaque
ID never grant access.

Only strict UTF-8 `.txt` content declared as `text/plain`, decoded to
1–262,144 bytes, is accepted. Client validation is advisory. Care rejects
path/control/bidi/CRLF filenames, type/extension/size mismatch, invalid
base64/UTF-8 and prohibited content controls; it generates storage identifiers
and verifies SHA-256 plus object binding before retrieval. Logs, errors, audit,
tombstones and events never include bytes, filenames, MIME/type, size, digest,
object key or free-form sensitive payload. The 24-hour owner-local idempotency
row may duplicate the bounded authorized mutation projection required for exact
replay, but never stores bytes, storage keys, digests or object bindings.
Delete atomically replaces the matching upload replay with a content-free
invalidated marker so the old key neither retains the filename nor resurrects
the object.

There is no scanner. `ready_unscanned`, `not_configured`, `not_scanned` and
`strict_text_and_integrity_validation` are the only successful processing
truth. Content is never previewed or actively rendered; download is a
no-store, sandboxed, nosniff octet-stream attachment with a sanitized advisory
filename. Integrity failure closes access and purges active bytes.

Explicit deletion purges active data atomically and has no in-product undo.
Offline/local state exposes nothing and queues nothing. Denied/missing,
storage failure and uncertain results are privacy-safe and distinct from empty
or success. PostgreSQL and backup at-rest encryption, historical-backup
deletion reconciliation, production RPO/RTO, a malware scanner and manual
assistive-technology/private-render evidence remain explicit gates and risks.

## P5-S1 Community request and directory controls

`docs/security/P5_S1_THREAT_MODEL.md` and ADR-019 govern the first Spring
boundary. Identity adds `community_support` and
`community_help_request.access` without backfill. Every protected list,
submit, reconcile, close and delete action consumes one fresh request-bound
decision valid for at most ten seconds. Household organizer/member status,
prior decisions, opaque request IDs, browser state, audit or outbox facts grant
nothing. Spring Community validates exact purpose, permission, target,
correlation and canonical request digest before any protected row access.

Public directory search is intentionally separate: Gateway calls no Identity
endpoint and forwards no cookie, CSRF, actor, household, subject, grant,
recipient, request or protected filter. Search accepts only allowlisted
structured category/province-city/organization-type values, uses parameterized
PostgreSQL, returns at most 25 deterministic rows and exposes explicit
provenance/current-or-stale truth. Stored public source URLs are display-only
reviewed metadata; Community does not fetch, crawl, redirect through or resolve
them, preventing an SSRF/data-import path.

Protected commands reject unknown fields and accept no free-form narrative,
precise location/GPS, diagnosis, treatment, medication, urgency, eligibility,
attachment or matching preference. Submit/close/delete use digest-only 24-hour
idempotency and atomic request/audit/replay/outbox transactions. Optimistic
versioning, same-key advisory locks and owner row locks prevent duplicate first
writes and lost updates. Aggregate-linked replay rows are invalidated on
delete/purge so an earlier submit or close response cannot disclose deleted
fields. A post-dispatch timeout is
`COMMUNITY_REQUEST_RESULT_UNKNOWN` until a new exact-authority reconciliation
read succeeds; it is never a blind retry or success claim.

Audit/outbox/logs/metrics/traces are allowlisted and content-free: opaque
actor/aggregate digests, enumerated action/outcome/version, UTC, correlation/
causation only. They exclude category, location, day part, public contact,
authority body, raw idempotency key, command body and request/listing IDs in
high-cardinality labels. The Community service token is required only on the
internal boundary, never forwarded to the browser or persisted in evidence.
Community alone receives its PostgreSQL credential and has no other owner
privilege; Node services have no Community SQL credential.

Pending requests auto-close after 30 days; closed protected fields purge
within 30 more; explicit delete purges active fields immediately and retains
only digest-only tombstone/content-free evidence for at most 365 days.
Community's owned scheduled sweep performs these transitions with locked,
monotonic versions and cannot make matching or delivery claims.
Protected offline submission is blocked and never queued. The only browser
persistence is one identity-free public directory response for at most 24
hours, permanently labeled offline/stale with provenance/cache time. LB-024
never calls browser geolocation; its optional control reads only the permission
state and truthfully reports denial or that LifeBridge cannot use it.

Gateway does not expose raw Identity error bodies. Exact Community revocation
maps to the stable revoked failure, other 401/403/404 outcomes map to the
non-enumerating authority-required failure, and dependency/contract failures
map to Identity unavailable.

The exact pins are Temurin 25.0.3+9, Maven 3.9.16 through repository Wrapper
3.3.4 and Spring Boot 4.1.0 with frozen checksums and explicit plugin versions.
The bootstrap is process-local and refuses system runtime substitution.
Focused consumer/provider, decision/digest, owner-isolated migration,
idempotency/concurrency, privacy-safe database serialization and built
mixed-runtime browser/storage/log proof is green. The sole Level C invocation
and its same-ledger continuation are retained; later hardening used targeted
proof only. Hosted promotion remains. KI-001/KI-016/KI-019 remain; KI-020 is
unchanged and still scoped to P4-S3 deployment controls.

## P5-S2 match coordination controls

The `P5-S2-v1` threat model requires a new non-backfilled
`community_match_coordination` purpose with one exact scope per grant/action.
Community verifies purpose, permission, expiry (maximum ten-second decision),
canonical request digest, current organization enrollment/role, approval,
capacity and optimistic aggregate/subordinate versions inside the transaction.
Same-key first use is serialized; committed state, replay, content-free audit
and suppressed outbox evidence are atomic. Logs/events exclude request fields,
recipient/volunteer identifiers, authority bodies and raw idempotency keys.

# P5-S3 moderation controls

The reconciled controls are frozen in `docs/security/P5_S3_THREAT_MODEL.md`:
fresh exact-purpose authority, independent Community moderator enrollment,
anti-enumerating missing/denied responses, minimum redaction, explicit
restrictive confirmation, expected-version concurrency, idempotent replay,
uncertain-result reconciliation, and atomic audit/outbox rollback.

# P6-S2 supply-chain and credential isolation

Every deployable has a distinct dependency inventory and final container.
Build contexts exclude Git metadata, environment files, logs and generated test
output. Final images run without root and contain no foreign service source or
migrations. Gateway/Web receive no database credential; each datastore owner
receives only its own runtime credential. Admin migration/bootstrap credentials
remain test/operations inputs and are not runtime configuration.

The CI change classifier is intentionally narrow: only root governance Markdown
and ordinary `docs/**/*.md` can be docs-only. Workflow, source, contract,
container, package/lock, tooling, script, test, migration, config, hidden and
protected-canary changes fail closed into the heavy campaign.

# P7-S3 recovery and lifecycle controls

Four PostgreSQL owners have distinct runtime, migration, backup and restore
credential identifiers. Recovery artifacts are task-owned, AES-256-GCM
encrypted, SHA-256 verified and provenance-bound before isolated target
creation. Logs allow-list owner, bounded result, action/version and duration;
they omit request/data-class/subject/household identifiers, payloads, paths,
database URLs and credentials.

Lifecycle processing is fail-closed. Without an owner-approved data-class
disposition the only valid outcome is `POLICY_DECISION_REQUIRED`, with no
physical delete or export artifact. Fixture approvals are synthetic test input
and never legal policy or compliance evidence.

# P8-S1 household authorization controls

The P8-S1 registry defaults every unknown actor, relationship, consent state,
resource, operation, service identity and datastore edge to deny. Production
task/member/dashboard/notification requests require a fresh Identity decision
bound to household, resource, operation, correlation and request digest. Owner
services reject stale decisions and missing membership/consent versions without
distinguishing foreign from nonexistent resources. Service signatures verify
only the key declared by `kid`; fixture activation remains production-fatal.
