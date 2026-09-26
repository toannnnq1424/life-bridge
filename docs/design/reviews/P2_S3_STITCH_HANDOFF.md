# P2-S3 Stitch handoff — Consent, privacy, audit, and settings

## Control

- Change: `CHG-2026-012`
- Slice: `P2-S3`
- Status: **Frozen with mandatory corrections**
- Frozen: 2026-07-26
- Design input: existing private LifeBridge Stitch project and existing
  `Emerald & Azure Modern` v2 design system
- Data: synthetic only
- Implementation rule: native Next.js only; no generated Stitch source,
  remote identifier, private locator, credential, or screenshot is persisted

The four required references were created exactly once and direct read
confirmed their titles. General-list propagation was delayed, so no generation
was retried. This handoff records titles/aliases only.

## Independent review disposition

The independent consent/authority, accessibility/privacy, and test/operations
audits were completed before generation. A separate post-generation auditor
confirmed that the four references exist in the correct private project, but
its isolated worker could not render the private screenshots before its usage
limit. It therefore conservatively rejected every generated reference as
standalone visual acceptance evidence.

That disposition is preserved. The generated references are untrusted layout
input, not approved production code or proof. Native implementation may proceed
only against the mandatory corrections and testable requirements frozen below.
It must not reproduce a generated detail that conflicts with this contract.

## Frozen screen aliases

| Alias    | Route                     | Accepted purpose                                                        |
| -------- | ------------------------- | ----------------------------------------------------------------------- |
| `LB-028` | `/households/:id/consent` | review current sharing and safely grant, narrow, or revoke              |
| `LB-029` | `/settings/privacy`       | atomically review and save the three privacy preferences                |
| `LB-030` | `/households/:id/audit`   | read a bounded, redacted, permission-scoped access history              |
| `LB-031` | `/settings`               | navigate to independently managed settings; never duplicate their forms |

## Mandatory corrections to generated input

1. Reject every generated placeholder date/time. Native UI displays only a
   live server-confirmed UTC instant plus a validated IANA display zone.
2. Reject `ICT` or any abbreviation as a time-zone identifier.
   `Asia/Bangkok` is the synthetic reference zone.
3. Reject any implication that organizer membership, household management, or
   context creation alone is consent authority. The verified self-bound
   care-recipient subject is the only P2-S3 authority.
4. Reject any preselected grant scope. Grant review repeats recipient,
   purpose, exact selected scopes, effect, authority, and immediate boundary.
5. Reject broadening through `narrow`; it accepts a non-empty strict subset.
   Removing all scopes moves to the separately confirmed revoke flow.
6. Reject language that deletes or hides historical evidence on revoke. New
   governed access stops at the effective boundary; required redacted evidence
   remains under the documented engineering retention rule.
7. Reject raw account/household/grant/event IDs, cursor values, totals, hidden
   counts, labels, setting values, request data, device/IP data, or care
   content from LB-030.
8. Reject any global or optimistic saved status. LB-029 saves one coupled
   privacy record atomically; other settings sections report independently.
   LB-031 is a link hub and has no saved state.
9. Reject export/deletion buttons or regulatory promises. LB-029 shows a
   non-actionable deferred-information panel only.
10. Reject offline queueing, reconnect submission, or success. All mutations
    are disabled offline and the UI states that nothing is queued.

## State and recovery contract

All affected screens have VI/EN loading, empty where applicable, validation,
generic denied/not-found, conflict, unavailable, offline, recovery, uncertain
result, and success treatments. Generic denial and absence share wording and
status. Unknown mutation results direct the user to reload the confirmed
projection before retry; they never invite a blind repeat.

LB-028 requires an inline two-step review for every grant, narrow, and revoke.
Cancel performs no request. On conflict, focus moves to the conflict heading
and the confirmed current state is preserved. Revoke is visually distinct and
calm, with an explicit final confirmation.

LB-029 repeats all three resulting values before one atomic save. A failed
request confirms none of them. LB-031 states that destination sections can have
independent outcomes and never synthesizes a global result.

LB-030 is GET-only. It has safe category/date filters, a maximum page size of
25, keyset-style “load older events,” no page number/total, and an empty
message that does not reveal whether hidden events exist. Offline content is
either unavailable or explicitly marked as an unconfirmed stale page.

## VI/EN copy anchors

- Authority:
  `Vai trò người tổ chức không tự cấp quyền đồng thuận. / Organizer membership does not grant consent authority.`
- Immediate effect:
  `Có hiệu lực ngay khi máy chủ xác nhận. / Effective when the server confirms.`
- Offline:
  `Không thể lưu khi ngoại tuyến. Thay đổi sẽ không được xếp hàng hoặc tự gửi lại. / Changes cannot be saved offline and will not be queued or submitted later.`
- Conflict:
  `Trạng thái đã thay đổi. Tải lại bản đã xác nhận trước khi thử lại. / The state changed. Reload the confirmed version before retrying.`
- Revoke:
  `Quyền truy cập mới dừng tại thời điểm có hiệu lực; bằng chứng lịch sử đã che vẫn được giữ theo chính sách. / New access stops at the effective boundary; redacted historical evidence remains under policy.`
- Audit redaction:
  `Một số trường được che để bảo vệ quyền riêng tư hộ gia đình. / Some fields are hidden to protect household privacy.`
- Deferred actions:
  `Xuất và xóa chưa được tự động hóa trong phạm vi này. / Export and deletion are not automated in this slice.`

## Accessibility contract

- skip link, landmarks, one focusable `h1`, semantic form/list/table/status
  structures, and accessible VI/EN names;
- true keyboard-only order and activation, visible focus using the approved
  high-contrast global ring, and focus restoration/movement after review,
  error, conflict, and success;
- polite/assertive live regions appropriate to the outcome without repeated
  announcements;
- no status by color alone, text/background contrast at least WCAG 2.2 AA,
  forced-colors support, and no essential motion;
- 320 CSS px and 400% reflow without two-dimensional page scrolling,
  truncation, overlap, or lost actions;
- minimum 44 CSS px product touch targets and at least the WCAG 2.2 AA target
  minimum for every actionable control;
- axe on material success/error states and browser storage/URL checks.

Manual NVDA/Narrator, physical touch, text-spacing, and physical-device
coverage remain the explicit `KI-016` limitation and must not be represented
as automated evidence.

## Freeze decision

The repository freezes the corrected interaction, privacy, authority, failure,
and accessibility contract above. It does **not** approve the generated
screens as pixel-perfect visual evidence. Native implementation must be
reviewed through contract, PostgreSQL, browser, security/privacy, concurrency,
and accessibility tests. Any later visual refinement must preserve this
handoff and must not mutate or delete the existing Stitch references.
