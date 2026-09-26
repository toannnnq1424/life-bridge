# P2-S3 consent, privacy, and audit threat model

Status: Frozen for implementation on 2026-07-26 under `CHG-2026-012`.

## Authority and service ownership

Identity & Consent remains the only authority and the only writer of the
P2-S3 consent, privacy, idempotency, transition, outbox, and audit tables in
its owned `lifebridge_identity` PostgreSQL database. Gateway is a policy
enforcement proxy and never imports Identity business code or receives its
database credential. Care and Notification receive no new credential and
write no Identity table.

A verified account session, active household membership, and organizer role
are each insufficient to grant consent authority. A care-recipient subject is
established only by an explicit self-binding command after the account has
created that recipient context. Existing contexts created before provenance
tracking are not backfilled, organizers cannot claim them, and no membership
role silently becomes subject authority. The binding is unique for the account
within that household and recipient context and is serialized in one database
transaction; one account may own independently governed contexts in different
households.

Before subject establishment, the existing P2-S2 minimum orientation
projection remains member-readable for backward compatibility and is not
represented as a consent-governed grant. After establishment, the subject can
read the complete minimum context; every other member needs an active,
purpose-bound grant. This compatibility boundary is explicit and cannot be
used to claim or infer consent authority.

## Versioned command and effective-time model

Consent grants cover only these minimum scopes:

- `recipient_context.basic_label`
- `recipient_context.relationship_label`

The only P2-S3 purpose is `household_coordination`. A grant selects one active
non-subject household member by a server-generated, keyed subject-bound
pseudonymous reference. It is not linkable across consent subjects. The browser
never receives or submits the internal account identifier.

`grant`, `narrow`, and `revoke` are distinct strict commands. Every mutation
requires:

- authenticated subject authority and CSRF/origin enforcement;
- the household and subject version;
- the expected grant version for `narrow` and `revoke`;
- a validated IANA display time zone;
- an idempotency key;
- an explicit immediate-effect mode.

The server assigns the effective instant at commit in UTC. No backdating,
scheduling, or offline queue exists. Access is evaluated with half-open
semantics: a governed decision is valid only while
`decisionTime < revokedEffectiveAt`; it is denied at or after the revocation
boundary. `narrow` must be a non-empty strict subset of the current scopes and
can never broaden, resurrect, or merge a grant. Removing all scopes is a
`revoke`.

One subject aggregate version serializes consent mutations. Row locks and
optimistic versions produce a bounded conflict rather than last-write-wins.
The same idempotency key with the same canonical request replays the original
projection; reuse for changed intent is rejected. A stale or unauthorized
request never broadens access.

## Evidence, events, and authorization

The mutation, current grant, immutable transition, redacted audit fact,
idempotency result, and versioned outbox event commit atomically. Events are
integration evidence, not an authorization source:

- `identity.consent.granted.v1`
- `identity.consent.narrowed.v1`
- `identity.consent.revoked.v1`

Event payloads contain only opaque aggregate/grant/subject/member references,
the enumerated purpose/scopes, action, UTC effective time, versions,
correlation, and causation. They exclude recipient labels, household labels,
privacy-setting values, request bodies, raw account identifiers, idempotency
material, cursors, credentials, and care content.

Authorization reads the Identity-owned current grant in a fresh transaction.
Revocation never deletes historical transition or audit evidence. Outbox
delivery is outside this slice; authorization never depends on delivery.

## Redacted audit read model

`GET /api/v1/households/{id}/audit` is authenticated, subject-authorized,
read-only, `no-store`, bounded to 25 rows, and ordered by
`(occurred_at DESC, audit_id DESC)`. Its encrypted, authenticated continuation
cursor is bound to the account, subject, filters, and boundary. Invalid,
expired, or cross-scope cursors fail generically.

The projection exposes only an enumerated event category, permitted actor
alias, redaction state, UTC instant, requested IANA display zone, outcome, and
opaque event reference. It exposes no total, hidden-row count, raw actor ID,
recipient label, scope value, privacy value, request data, IP/device
information, or authorization control. Empty, absent, and inaccessible
responses cannot be used to infer another household or subject.

The audit read model exposes at most the most recent 90 days as an engineering
default.
Consent subjects, current grants, and immutable transitions remain while the
account/household product record remains. Idempotency responses remain 24
hours; unpublished outbox evidence remains until delivered or operationally
reconciled. These are product engineering defaults, not legal retention advice
or a regulatory-compliance claim. Physical scheduled purge, legal hold,
account deletion and proof of erasure remain P7-S3/P8 work; no older fact is
exposed through this slice's read model. A later production processing
inventory and legal review may shorten or extend the boundary.

## Privacy settings and failure truth

Profile visibility, coordination-activity visibility, and access alerts form
one versioned Identity-owned record and save atomically. A failed or conflicted
request confirms no new value. Account accessibility preferences remain an
independent existing record, so each section reports its own result; the
settings hub never claims a global save.

Offline operation disables every mutation, creates no browser queue, and never
auto-submits on reconnect. An interrupted or uncertain mutation instructs the
client to reload the confirmed projection before retry. Export, deletion, and
regulatory automation are documented deferred non-goals with no fake action.

## Privacy-safe observability

Allowed operation names are `consent.bind`, `consent.grant`,
`consent.narrow`, `consent.revoke`, `consent.authorize`, `audit.read`, and
`privacy.update`. Logs, metrics, and spans may contain only service,
operation, result/error category, correlation/trace identifier, and duration.
They must not contain actor/household/member/subject/grant identifiers,
recipient or relationship labels, scopes/purposes, effective instants,
setting values, idempotency keys/digests, cursors, counts tied to a household,
request/response payloads, database URLs, headers, cookies, or raw errors.

Latest-schema readiness checks connectivity plus the P2-S3 schema marker.
Missing consent/audit/privacy structures make Identity not ready. Safe runtime
validation scans exact captured log files for synthetic prohibited values
before cleanup.

## Bounded primary-source research

Result: `PASS WITH ASSUMPTIONS`. Retrieved 2026-07-26.

| Source                                                                                                           | Scope and year                            | Repository conclusion                                                                                                                                                                                                | Limits                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [EDPB Consent summary](https://www.edpb.europa.eu/system/files/2026-04/edpb-summary-consent_en.pdf)              | EU, 2026, official regulator summary      | Use specific affirmative choices, identify purpose and data type before grant, and make withdrawal no harder than grant. Stop new governed processing at withdrawal while retaining properly bounded prior evidence. | Background control design only; not Viet Nam legal advice.                                                |
| [EUR-Lex GDPR, Articles 5 and 7](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)                              | EU, 2016 current official regulation      | Minimize purposes/data, bound storage, preserve accountability, and state that withdrawal does not retroactively invalidate earlier lawful processing.                                                               | Older than the preferred evidence window but still-current primary law; no claim of direct applicability. |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Global, current official project guidance | Deny by default, validate authorization on every request, and test denial/failure paths.                                                                                                                             | Security guidance, not a product/legal authority model.                                                   |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)             | Global, current official project guidance | Keep business audit evidence separate from operational logs; allow-list when/who/what/result dimensions and exclude sensitive values.                                                                                | Implementation guidance; retention remains repository-owned and reviewable.                               |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)                                                                    | Global, 2024 W3C Recommendation           | Require keyboard operation, visible/unobscured focus, reflow, review/confirmation for consequential changes, target size, and announced status messages.                                                             | Automation does not replace manual assistive-technology or physical-device review.                        |

Kết luận riêng cho kho mã / Repository-specific conclusion: P2-S3 cung cấp
điều khiển đồng thuận ở cấp sản phẩm, không tự động hóa tuân thủ pháp lý. Mọi
quyền phải cụ thể, chủ động, tối thiểu, có thể thu hẹp/thu hồi dễ dàng, và
được kiểm tra lại ở phía máy chủ cho từng lần truy cập. / P2-S3 provides a
product consent control, not legal-compliance automation. Every grant is
specific, affirmative, minimized, easy to narrow/revoke, and re-evaluated
server-side for each governed access.

## Validation evidence required

- contract tests reject broadened narrow, stale versions, changed-intent
  idempotency reuse, invalid time zones, unsafe event/audit fields, and
  unrecognized error envelopes;
- real PostgreSQL tests cover empty and `002` upgrades, reapply/restart,
  subject-binding non-hijack, concurrent commands, boundary authorization,
  historical evidence, cursor scope binding, atomic privacy rollback, and
  latest-schema readiness;
- HTTP/Gateway tests prove actor-header stripping, generic inaccessible
  responses, GET-only audit behavior, and `no-store`;
- browser tests cover VI/EN review, cancel, conflict, denied, unavailable,
  offline/no queue, uncertain result, recovery, safe focus, axe, keyboard
  operation, reflow, reduced motion, contrast, and no browser-storage leak;
- manual NVDA/Narrator, physical touch, text-spacing, and physical-device
  evidence remain explicitly limited by `KI-016`.
