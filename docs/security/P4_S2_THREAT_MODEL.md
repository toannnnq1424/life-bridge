# P4-S2 Emergency Readiness and Offline Copy Threat Model

- Status: Frozen for implementation
- Contract: `P4-S2-v1` / `P4-S2-offline-v1`
- Scope: LB-020, LB-021, and only the P4-S2 read-only LB-032 behavior

## Assets and ownership

Care Coordination owns the minimum current contact projection, contact-list
revision/history facts, one shared plan draft, immutable participant-reviewed
plan versions, source/display-time facts, redacted audit, digest-only
idempotency, and content-free outbox. Identity & Consent owns fresh exact-
purpose authority. Gateway stores no emergency data and composes only current
owner responses. Notification has no P4-S2 role.

The browser may own one explicitly saved passphrase-encrypted minimum snapshot
per bound account/household/recipient scope. Cache Storage owns only a versioned
non-sensitive shell. Offline possession is not authority, current permission,
professional review, availability, dispatch, diagnosis, treatment, urgency, or
legal status.

## Trust boundaries

1. Browser to Gateway: session, same-origin/Fetch-Metadata, CSRF,
   idempotency, and no-store boundaries.
2. Gateway to Identity: a new exact permission, scope, normalized digest, and
   correlation for every operation.
3. Gateway to Care: the current decision plus the strict minimum command/read.
4. Care to its PostgreSQL owner: one aggregate lock and one transaction for
   state, transitions, redacted audit, replay, and suppressed outbox evidence.
5. Authorized live page to Web Crypto/IndexedDB: explicit review, KDF/AEAD,
   authenticated envelope, verified atomic replacement, and bounded retention.
6. Route-bounded service worker to Cache Storage: shell/static assets only;
   never API/session/mutation/protected content.
7. Offline page memory: passphrase entry and plaintext render only after
   authenticated decryption; nothing is returned to the worker/server.

## Threats and required controls

| Threat                                                                   | Control                                                                                                                                       | Required evidence                                     |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Household role is mistaken for participant consent                       | Fresh exact-purpose P2 decision for every online read/write/snapshot; Care rejects mismatched/stale decisions before data access              | Gateway/Identity/Care denial and stale-decision tests |
| External-contact consent or availability is fabricated                   | User-provided minimum fields only; no consent/availability/professional/legal claim; one configured phone method opens a device function only | Contract rejection and VI/EN copy                     |
| Plan/contact reads produce a torn offline copy                           | Same aggregate lock and one transactionally consistent snapshot bound to exact plan/contact revisions                                         | Concurrency and snapshot integration tests            |
| Contact change leaves an apparently current plan                         | Any complete contact replacement sets `review_required`; snapshot issuance fails until participant re-review                                  | Race, conflict, and recovery tests                    |
| Protected data leaks into events/audit/logs/cache                        | Content-free transitions/audit/idempotency/outbox; API `no-store`; worker shell allowlist; browser-store inspection                           | Contract, DB, log, IndexedDB/Cache scans              |
| Plaintext or an automatic key is persisted                               | Explicit offline passphrase; PBKDF2-HMAC-SHA-256/600,000; random 16-byte salt; AES-256-GCM/random 12-byte nonce; key/passphrase memory only   | Web Crypto unit and real browser tests                |
| Ciphertext is copied, replayed, or altered                               | AAD binds contract/source/scope/schema/plan/contact/confirmation/expiry facts; decryption or shape mismatch hides content and purges          | Ciphertext/AAD/scope/version tamper tests             |
| Wrong or forgotten passphrase leaks a hint or creates recovery authority | Generic failure; no hint/server recovery; local removal always available; recreation requires a fresh authorized online snapshot              | Mocked and real recovery paths                        |
| Service worker fabricates live/API success                               | Route-bounded shell-only cache; no API/session/mutation matching; no background sync or write queue                                           | Worker source inspection and Cache Storage test       |
| Remote revocation is missed while offline                                | Permanent not-live/current-permission-unchecked text; 24-hour recent and 72-hour hard boundary; reconnect reauthorization before replacement  | Offline/reconnect/revocation browser path             |
| Device clock rollback extends freshness                                  | Backward/invalid time becomes `freshness_unknown`, never recent; expiry comparison fails closed and server confirmation remains visible       | Boundary/backward-clock tests                         |
| Logout/account switch exposes another scope                              | Scope-bound AAD/key record; purge before render on logout/switch/session invalidation/known denial                                            | Multi-account browser-store tests                     |
| Quota/eviction/partial replacement reports success                       | Verify ciphertext read-back and authenticated decrypt before success/old-copy removal; failure retains at most the prior labelled copy        | Storage-failure and atomic-replacement tests          |
| Offline mutation is submitted later                                      | All writes/actions disabled; no queue, retry, background sync, or reconnect submit                                                            | Mocked/real browser network assertions                |
| UI implies diagnosis, urgency, treatment, contact, or dispatch           | Permanent safety boundary; structured participant-entered steps only; text/icon/color live/offline distinction                                | Handoff, copy assertions, accessibility review        |
| Migration couples services or fabricates old data                        | Care-only migration 006; rollback/reapply/no-backfill/owner-isolation proof                                                                   | P4-S2 migration campaign                              |

## Offline failure truth

`offline_recent`, `offline_stale`, `freshness_unknown`,
`freshness_expired`, `wrong_passphrase`, `integrity_failed`, `revoked`,
`purged`, `offline_copy_unavailable`, and `recovery_required` are local states,
not server results. No saved copy means only that this browser has no usable
copy; it never means `no_plan`. At expiry, known revocation, incompatible
schema, or integrity failure, content is hidden before purge. A local purge is
reported separately from any server plan/contact outcome.

## Residual risk

A remote revocation cannot reach a disconnected browser. A same-origin XSS can
capture the passphrase or decrypted content. A compromised/unlocked browser or
OS profile can observe use, and a weak passphrase permits offline guessing.
JavaScript cannot guarantee memory erasure or durable storage. These residual
risks are explicit and bounded; the implementation makes no device-encryption,
clinical, dispatch, legal-compliance, or guaranteed-availability claim.

KI-001 continues to block deployment. KI-016 retains manual assistive-
technology/physical-device evidence. KI-019 retains the lack of independent
private Stitch pixel inspection. No P4-S3, DATA-S1, P5, Spring, deployment, or
release authority is introduced.
