# P4-S3 Access-Controlled Document Vault Threat Model

- Status: Frozen for implementation
- Contract: `P4-S3-v1`
- Scope: native VI/EN LB-023 at `/households/:id/documents`
- Change/decision: `CHG-2026-018` / ADR-026

## Assets and ownership

Care Coordination owns both document metadata and bounded bytes in its existing
PostgreSQL database. Identity & Consent owns current consent grants and issues
one fresh exact-action P2 decision for every online list, upload, metadata
read, content download and deletion. Gateway validates and relays bounded
requests and attachment responses but stores no document fact, byte, locator
or authority. Notification is not involved.

P4-S3 introduces no object store, scanner service, cryptographic storage
scheme, cache, broker or new service. The only accepted content is one strict
UTF-8 `.txt` file declared as `text/plain`, with 1 through 262,144 decoded
bytes. PostgreSQL `bytea` is the source of truth for the bounded object bytes.

## Authority boundary

The accepted P2 `household_coordination` purpose gains an explicit
`document_vault.access` scope. The self-bound subject may act directly. Every
other active household member needs a current grant containing that scope and
the subject's current permitted coordination visibility. A role, organizer
status, membership, `recipient_context.basic_label`, route possession, local
selection, prior decision, event, audit row or offline state grants nothing.
Existing grants are not broadened or backfilled.

Exact permissions are:

```text
coordination.document_vault.list
coordination.document_vault.upload
coordination.document_vault.metadata.read
coordination.document_vault.content.download
coordination.document_vault.delete
```

Metadata/download/delete decisions bind the exact opaque document ID. All
decisions bind actor, household, recipient context, exact permission,
normalized request digest, correlation and current subject/grant/privacy
versions for at most ten seconds. Care revalidates every bound fact before
state access.

## Trust boundaries

1. Browser to Gateway: opaque session, same-origin/fetch-metadata, CSRF,
   bounded JSON upload, idempotency and no-store controls.
2. Gateway to Identity: one exact permission, document scope when applicable,
   canonical request digest and correlation.
3. Gateway to Care: the fresh decision plus one strict command/read.
4. Care to owned PostgreSQL: owner-local metadata/bytes, randomized binding,
   optimistic state, audit, digest-only replay and suppressed outbox.
5. Gateway download to browser: a bounded byte response with attachment-only
   disposition; never a preview, inline viewer, signed URL or active render.
6. Browser memory: one user-selected file and transient downloaded blob only;
   no Cache Storage, service worker, IndexedDB, localStorage or sessionStorage
   document persistence.

## Processing truth

Authoritative processing states are:

```text
processing
ready_unscanned
rejected
failed
integrity_failed
```

Every successful projection also states:

```text
scannerStatus: not_configured
malwareStatus: not_scanned
processingEvidence: strict_text_and_integrity_validation
```

`ready_unscanned` means only that Care confirmed the allowlisted extension and
declared type, exact decoded size, strict UTF-8/control-character boundary,
SHA-256 digest and document/object binding. It never means clean, safe,
reviewed, clinically valid or suitable. Scanner absence supplies no evidence
and is never transformed into a clean claim. `processing` cannot be
downloaded. Rejected/failed temporary bytes are purged. Integrity mismatch
fails closed, removes active bytes and prevents download.

## Threats and required controls

| Threat                                                                     | Control                                                                                                                                                            | Required evidence                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Household role or basic-label consent grants document access               | New `document_vault.access` grant scope; fresh exact decision for every action; Care rejects stale/wrong scope before lookup                                       | Identity/Gateway/Care allow/deny and no-backfill tests |
| Filename controls storage path or response headers                         | Reject path/control/bidi/CRLF input; sanitize a display basename; independent CSPRNG document and object IDs; RFC 6266 attachment encoding                         | Contract/service/header tests                          |
| Spoofed type or oversized content reaches trusted state                    | `.txt` plus declared `text/plain` are necessary but insufficient; Care decodes, measures and strictly validates UTF-8/content controls with a 262,144-byte maximum | Boundary/polyglot/double-extension tests               |
| External content executes or renders as trusted content                    | No preview/viewer/iframe/object/embed/HTML insertion; `application/octet-stream`, attachment, `nosniff`, sandbox and `no-store`                                    | Static/browser/download-header tests                   |
| Missing scanner is presented as clean                                      | Frozen `ready_unscanned`, `not_configured`, `not_scanned` wording; no clean/safe enum or copy                                                                      | Contract/copy/browser assertions                       |
| Metadata or bytes are swapped/tampered                                     | Random object binding covers document, household, recipient, digest, size and version; recompute before every download                                             | One-byte and swapped-binding database tamper tests     |
| Unknown upload result creates a duplicate                                  | Required idempotency key and client upload reference; same key+intent replays, changed intent conflicts; fresh list/status reconciliation only                     | Timeout/replay/concurrency/browser recovery tests      |
| Concurrent delete or stale state removes the wrong version                 | Expected vault/document versions, owner lock and one atomic purge transaction                                                                                      | Race, replay and injected rollback tests               |
| Denied/missing response reveals document existence                         | Generic inaccessible result before metadata/byte access; no filename, count, URL, announcement or assistive-only residue                                           | Identity outage/deny/missing and browser tests         |
| Bytes/filename/digest leak through evidence                                | Content-free audit/tombstone/outbox; digest-only replay key; bounded 24-hour replay projection without bytes/storage key/digest/binding; allowlisted telemetry     | Database serialization and runtime scan                |
| Offline/local state creates authority                                      | No document persistence or offline projection; every action blocked offline, never queued/replayed/auto-submitted                                                  | Browser storage/network assertions                     |
| Deletion is described as recoverable or complete across historical backups | Active bytes/metadata purge is atomic and immediate; no product undo; recovery means re-uploading an original local file; backup residue remains a deployment gate | Delete transaction and post-delete restore rehearsal   |
| Migration invents old documents or crosses owners                          | Additive Identity 004 and Care 007 owner migrations; no backfill; independent rollback/reapply/readiness proof                                                     | Migration campaign                                     |

## Retention, deletion and recovery

The engineering retention rule is `retained_until_explicit_delete`. There is no
automatic expiry, product undo, legal hold or regulatory deletion claim in
P4-S3. Confirmed deletion immediately prevents all active reads/downloads and
atomically removes the primary bytes, sanitized filename, digest and object
binding. Only opaque content-free transition, audit, tombstone, suppressed
outbox facts, an invalidated upload replay marker and the bounded delete replay
result remain. The old upload key conflicts and cannot resurrect the object.

The local/CI backup rehearsal proves active owner data can be restored with
matching bytes and binding, and that a backup taken after deletion restores no
deleted content. It is not a production RPO/RTO, backup-encryption, historical
backup retirement or deletion-reconciliation claim. Production historical
backup residue/non-resurrection remains a deployment blocker.

## Stable failure truth

Stable errors include `DOCUMENT_VALIDATION_FAILED`,
`DOCUMENT_TYPE_UNSUPPORTED`, `DOCUMENT_TOO_LARGE`,
`DOCUMENT_CONTENT_REJECTED`, `DOCUMENT_PROCESSING_PENDING`,
`DOCUMENT_PROCESSING_FAILED`, `DOCUMENT_INTEGRITY_FAILED`,
`DOCUMENT_VERSION_CONFLICT`, `DOCUMENT_VAULT_CONFLICT`,
`DOCUMENT_CAPACITY_REACHED`, `DOCUMENT_RESULT_UNKNOWN`,
`COORDINATION_RESOURCE_NOT_FOUND`, `COORDINATION_AUTHORITY_REQUIRED`,
`IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`,
`IDENTITY_SERVICE_UNAVAILABLE`, `DOCUMENT_STORAGE_UNAVAILABLE`,
`SERVICE_UNAVAILABLE` and `INTERNAL_CONTRACT_INVALID`.

Storage/scanner unavailability is not an empty vault. A timeout, cancellation
or 5xx after upload/delete is uncertain: perform a new authorized list/status
read using the same upload/idempotency context and never retry blindly or with
a new key.

## Residual risk and gates

PostgreSQL at-rest and backup encryption, automated stale-processing cleanup,
historical backup deletion reconciliation, production RPO/RTO and a real
malware scanner are not implemented. Indefinite retention until user deletion
is a privacy risk. A downloaded attachment can be opened by software outside
LifeBridge. These are explicit limits, not safety claims.

KI-001 blocks deployment, KI-016 retains manual assistive-technology/device
evidence, and KI-019 retains independent private-pixel review. Adding another
file type, object storage, a scanner/clean verdict, application-layer
encryption, cache or new service reopens official-source research and ADR-026.
