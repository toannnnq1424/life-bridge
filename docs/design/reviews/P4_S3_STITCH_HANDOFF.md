# P4-S3 Stitch Handoff — Access-Controlled Document Vault

- Status: Frozen for native implementation
- Date: 2026-07-28
- Change ID: `CHG-2026-018`
- Contract: `P4-S3-v1`
- Screen/route: LB-023 at `/households/:id/documents`
- Architecture decision: ADR-026

## Gate and provenance

Three independent pre-implementation reviews covered contract/data/authority/
retention/integrity/storage threat, UI/privacy/accessibility/processing/
recovery, and tests/CI/scanner-storage failure/backup-restore. ADR-026 and
`docs/security/P4_S3_THREAT_MODEL.md` were frozen before production code or UI.

The approved existing private LifeBridge project was used. Every exact title
was confirmed absent before its one write. Each completed result was read back
exactly once. Prompts contained only generic synthetic `.txt` document facts.
No credential, private locator, remote ID, generated source, screenshot, real
document, PII, exported artifact or generated asset is persisted here.

| Alias                   | Exact title                                                                      | Device/read-back                                           | Disposition                               |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `P4S3-LB023-UPLOAD`     | `LB-023 Document vault — Empty, choose, upload and processing — Desktop — P4-S3` | Desktop; exact title/device and completed metadata present | Reference only; generated source rejected |
| `P4S3-LB023-VALIDATION` | `LB-023 Kho tài liệu — Xác thực, từ chối và lỗi xử lý — Mobile — P4-S3`          | Mobile; exact title/device and completed metadata present  | Reference only; generated source rejected |
| `P4S3-LB023-ACCESS`     | `LB-023 Document vault — Available, access and deletion — Desktop — P4-S3`       | Desktop; exact title/device and completed metadata present | Reference only; generated source rejected |
| `P4S3-LB023-RECOVERY`   | `LB-023 Kho tài liệu — Từ chối, ngoại tuyến và đối soát — Mobile — P4-S3`        | Mobile; exact title/device and completed metadata present  | Reference only; generated source rejected |

Private rendered pixels were not independently inspectable. Metadata proves
existence, title/device and artifact presence only—not layout, contrast,
reflow, focus visibility, target size, privacy or generated-markup safety.
This handoff is Frozen for corrected native semantics, not standalone visual
approval. KI-019 remains.

## Frozen product boundary

- Exactly one UTF-8 `.txt` file declared as `text/plain`.
- Exact decoded-size range: 1 through 262,144 bytes. Do not say ambiguous
  “256 KB.”
- Care owns metadata and bytes in PostgreSQL. No object store or download URL.
- Access label:
  `Care recipient and currently authorized collaborators — checked again for every action.`
- Organizer/member status and basic-label consent alone grant nothing.
- Current retention: retained until explicit deletion. There is no automatic
  expiry, legal hold or in-product undo/restore.
- Malware scan: not configured. No clean or safe claim is made.

## Information architecture and states

One page owns five regions in DOM/focus order: skip link; compact header and
locale control; h1 plus permanent access/retention/scanner explanation; upload
form; authoritative document list/status; persistent recovery/deletion result.

The file picker is the complete keyboard workflow. Optional drag/drop may call
the same selection/validation path but exposes no exclusive action. Native
input and button controls remain visible and operable.

Required states are:

```text
empty
selection_valid | selection_invalid
uploading | cancelling | uncertain_result
processing
ready_unscanned
rejected | failed | integrity_failed
scanner_not_configured | storage_unavailable
denied_or_missing
vault_or_document_conflict
offline_no_queue
reconcile_loading | reconciled
delete_review | delete_confirmed | delete_uncertain
```

Storage unavailable is never empty. Scanner absence is not rejected, clean or
safe. `ready_unscanned` means attachment download is permitted only after the
authoritative type/size/UTF-8/digest/object-binding checks and a new access
decision; it does not mean safe, clean, reviewed or suitable.

## Upload and recovery interaction

Selection shows sanitized proposed name, exact decoded bytes, `.txt`/
`text/plain` policy, access scope, retention and deletion consequence before
upload. Client checks are advisory. Care independently validates every byte.

Actual XHR upload events drive a native progress element and polite meaningful
percentage announcements. No timer fabricates progress. Progress never moves
focus. Cancel aborts the transfer but reports an uncertain result whenever the
server may have received bytes. Timeout/cancel recovery is a fresh authorized
list/status read using the same upload/idempotency context—never a blind retry
or new key.

Conflict or uncertainty preserves only safe in-memory selection/intent.
Current authoritative state must be loaded and reviewed before another
mutation. No document metadata or bytes enter offline storage, browser cache,
IndexedDB, localStorage, sessionStorage or service-worker caches.

## Download and deletion

There is no preview, inline rendering, iframe, object, embed, HTML insertion or
viewer. Download requests a fresh decision and returns
`application/octet-stream` with attachment disposition, sanitized advisory
filename, `nosniff`, sandbox and `no-store`. “Download issued” never claims
that the browser saved or opened the file.

Delete uses a native dialog with target, expected version and these effects:

- active bytes and metadata are removed immediately on confirmation;
- only content-free audit/tombstone/outbox evidence remains;
- there is no in-product undo or server restore;
- recovery means selecting and re-uploading an original local file;
- operator backup recovery is not a user restore path.

Cancel restores focus to the invoking button. Confirmed deletion focuses one
persistent result heading and then leaves a predictable successor in the list.

## Privacy and minimum disclosure

Every list, upload, metadata read, download and delete receives a fresh
request-bound P2 decision. Denied/missing and authorization-loss states reveal
no filename, metadata, existence, hidden count, URL, identifier, browser
history detail, announcement residue or assistive-only protected text.

Public metadata contains only:

```text
opaque document ID and upload reference
sanitized display name
verified type and exact byte size
processing/scanner/malware state
access and retention policy keys
version
server upload/processing confirmation times
```

Storage keys, digests, raw headers, scanner internals, document content,
account/grant/subject identifiers, hidden totals and download URLs are
excluded. Generated hard-coded byte counts, versions and timestamps are
rejected; native UI uses current authoritative projections.

## Accessibility freeze

- One h1, skip link, named landmarks, native file input/buttons/dialog/
  progress, semantic list/article/definition-list and `<time datetime>`.
- Invalid selection/submission focuses a linked summary. Progress/status is
  politely announced without focus movement. Denial/conflict/recovery focuses
  one persistent heading.
- Status combines explicit text, recognizable icon, border/shape and color.
  Critical truth is never toast-only.
- Controls are at least 44 by 44 CSS pixels with persistent high-contrast
  focus. One DOM/control set serves all widths.
- At 320 CSS pixels and 400% reflow, content remains one readable column with
  no page horizontal scroll; long VI/EN names and policy copy wrap safely.
- Forced colors preserve borders/focus/status distinction. Reduced motion
  removes transitions; no pulse, countdown, auto-dismiss or motion-only state.
- Visible and assistive text share the same authorization boundary.

Automated axe/keyboard/reflow evidence is not a manual WCAG, screen-reader or
physical-device claim. KI-016 remains.

## Rejected Stitch output

Generated HTML/source, external assets, side navigation, hard-coded metadata,
“permanent,” “clinical integrity,” “safe/clean,” generic “Authorized
Collaborators,” WCAG-conformance wording, preview controls, automatic retry,
offline queue/sync, and color-only status are rejected. Production uses native
repository semantics, contracts and localization keys.
