# P4-S1 Stitch Handoff — Medication Reminder Acknowledgement

- Status: **Frozen for native semantic implementation with mandatory corrections; generated pixels and source unapproved; KI-019 retained**
- Version: `1.0`
- Date: 2026-07-28
- Contract: `P4-S1-v1`
- Change: `CHG-2026-016` / ADR-024
- Screens: LB-018 plus the minimum medication-reminder extension to LB-019

## Authority and precedence

This handoff extracts bounded intent from four synthetic private Google Stitch
references. It does not import generated code or screenshots and does not
approve rendered pixels. Repository contracts, native semantic HTML, service
ownership, VI/EN copy, accessibility, privacy and tests override generated
output.

```text
P4-S1-v1 contracts and threat model
→ this corrected redacted handoff
→ repository-native UI
→ automated and manual evidence
```

Care owns user-provided label/amount/unit/time/recurrence. Notification receives
neither medication label nor amount/unit and owns only generic minimum-data
delivery state plus immutable seen acknowledgement. Identity & Consent makes a
fresh exact-purpose decision for every read/action. Gateway composes owner
responses and stores/fabricates nothing.

## Synthetic generation and read-back

The approved existing private LifeBridge project and `Emerald & Azure Modern`
design system version 2 were used. Each exact title was confirmed absent before
generation. Each write was issued once; each returned screen was directly read
once. No retry, edit, delete, export, bulk download or build occurred.

| Local alias           | Exact redacted title                                                         | Device               | Direct read-back                                                       | Decision                               |
| --------------------- | ---------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `P4S1-LB018-CURRENT`  | `LB-018 Medication reminder schedule — Current and review — Desktop — P4-S1` | Desktop, 2560 × 2246 | Exact title/device/dimensions; screenshot and generated source present | Reference only; source/pixels rejected |
| `P4S1-LB018-RECOVERY` | `LB-018 Lịch nhắc dùng thuốc — Lỗi và phục hồi — Mobile — P4-S1`             | Mobile, 780 × 5816   | Exact title/device/dimensions; screenshot and generated source present | Reference only; source/pixels rejected |
| `P4S1-LB019-ACK`      | `LB-019 Medication reminder acknowledgement — Desktop — P4-S1`               | Desktop, 2560 × 2048 | Exact title/device/dimensions; screenshot and generated source present | Reference only; source/pixels rejected |
| `P4S1-LB019-FAILURE`  | `LB-019 Nhắc dùng thuốc — Chuyển thất bại và phục hồi — Mobile — P4-S1`      | Mobile, 780 × 3704   | Exact title/device/dimensions; screenshot and generated source present | Reference only; source/pixels rejected |

The subsequent project-wide listing continued to expose the prior screen set
and did not enumerate the four returned screens. Direct read-back proves that
each returned resource exists, but list lag is not duplicate-proof metadata.
The write contract forbids retry after an uncertain or lagging result, so no
generation was repeated. Private project/screen/file identifiers, sessions,
download URLs, signed locators, HTML and screenshots are intentionally omitted.

## Prompt contract

All prompts used synthetic generic content and the existing design system.
They explicitly prohibited real people, medicine names, diagnoses, clinicians,
contacts, addresses, credentials, links, raw identifiers and care records.

`P4S1-LB018-CURRENT` requested an English desktop LB-018 with one h1, skip link,
named landmarks, permanent authority/non-clinical notices, a confirmed generic
“Reminder item A”, a definition list of user-entered amount/unit, source local
time, IANA zone, numeric offset, resolved UTC, finite daily recurrence/final
date, version, intent-not-delivery and no acknowledgement, followed by an inline
review/back/confirm section. It required native controls, linear focus order,
44 px targets, high-contrast focus and a 320 px/400% one-column path.

`P4S1-LB018-RECOVERY` requested a Vietnamese mobile state reference with
separate specimens for empty, linked invalid summary (missing unit, invalid
abbreviation-only zone, DST gap and overlap choice), generic denied/not-found,
unavailable-not-empty, offline/no-queue, stale conflict, uncertain result and
fresh-read recovery. It prohibited toast-only truth, auto-submit, medical advice,
urgency/adherence wording and horizontal scrolling.

`P4S1-LB019-ACK` requested an English desktop extension to the existing
Notification center using only generic medication-reminder items: one
authoritatively persisted in-app item with a seen action, one immutable
duplicate acknowledgement with the original timestamp, and one intent recorded
without delivery evidence or acknowledgement action. It explicitly separated
schedule confirmation, intent, delivery evidence and acknowledgement and
excluded medication facts.

`P4S1-LB019-FAILURE` requested a Vietnamese mobile state reference with empty,
generic denied/not-found, Notification unavailable, offline/no-queue, delayed,
scheduled-time-passed without delivery evidence, failed, acknowledgement
uncertain, stale, duplicate and recovered states. It prohibited success marks on
failure, taken/missed-dose/non-adherent/urgent wording, countdowns, pulsing,
auto-dismiss and swipe/row-only actions.

## Independent review verdict

The independent privacy/accessibility reviewer received only redacted titles,
device classes, dimensions and screenshot/source-presence evidence. Verdict:
conditional pass for this stricter native-only handoff and fail as standalone
visual/privacy/accessibility approval.

> Independent reviewer could not access private rendered pixels. Exact redacted
> title, device, dimension, and screenshot/source-presence read-back proves
> existence and provenance only; it does not prove visual fidelity,
> design-system conformance, privacy-safe pixels, responsive/reflow quality,
> VI/EN copy, contrast, focus visibility, target size, forced-colors/reduced-
> motion behavior, or generated-markup safety. No visual-conformance claim is
> made. Retain KI-019 and perform one bounded independent private-pixel review
> when supported, without regeneration or locator/source persistence.

KI-016 manual assistive-technology/physical-device/text-spacing evidence also
remains open.

## Mandatory correction map

| Generated direction                | Frozen native correction                                                                                                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Schedule card and review           | Render only fresh Care-authorized facts; explicit amount + unit, local minute, IANA zone, numeric offset, resolved UTC, finite recurrence boundary, version and confirmed lifecycle. Browser never derives authoritative time. |
| Organizer/member authority wording | Server decision is authoritative. Role never implies care-recipient consent. Recheck every LB-018 and LB-019 operation.                                                                                                        |
| “Confirmed” visual state           | State schedule persistence only. Show separate intent, delivery and acknowledgement facts.                                                                                                                                     |
| Notification content               | Fixed generic message key and opaque source only. Never carry/display medication label, amount/unit, recipient label or free text.                                                                                             |
| Acknowledgement                    | Means only reminder seen. Never taken, skipped, adherence, dosage, urgency or clinical safety. No optimistic acknowledgement.                                                                                                  |
| Delivery success                   | Requires owner-provided `in_app_persisted` evidence and server timestamp. Intent receipt is not delivery.                                                                                                                      |
| Failures                           | Persistently distinguish pending/delayed, uncertain, missed/unconfirmed, failed, cancelled, duplicate and recovered. No false check mark or toast-only truth.                                                                  |
| Responsive composition             | One DOM/source/focus order; no duplicated mobile controls. Native one-column path at 320 CSS px and 400% reflow.                                                                                                               |
| Generated markup/source            | Reject completely; implement native project components and tokens only.                                                                                                                                                        |

## Frozen screen and state contract

### LB-018 medication reminder schedule

- Route: `/households/:id/medications`.
- Authorized list/detail are bounded and expose no hidden totals.
- Create/change/disable are explicit browser mutations with CSRF/origin/fetch
  evidence, expected version where applicable and digest-bound idempotency.
- Edit → inline review → confirm. Review repeats every submitted structured fact
  and the non-clinical boundary. Success appears only after server confirmation.
- Safe unsent values may remain only in component memory. Nothing is stored in
  URL/history, local/session storage, IndexedDB, cache or an offline queue.
- States: loading, empty, edit, review, invalid, denied/not-found, Care
  unavailable, Notification unavailable/degraded, offline/no-queue, stale/
  conflict, uncertain, confirmed success, disabled and fresh-read recovery.

### Minimum LB-019 medication extension

- Route: existing `/notifications`; do not create a second center.
- Existing task-notification behavior remains supported.
- Governed medication rows use Notification-authoritative generic projections.
- Keep acknowledged rows visible with their original server timestamp.
- Show the acknowledgement action only for authoritative delivered state.
- States: empty, denied/not-found, unavailable-not-empty, offline/no-queue,
  pending/delayed, uncertain, missed/unconfirmed delivery, failed, cancelled,
  delivered/unacknowledged, seen, duplicate, stale and recovered.
- Opening the source schedule triggers a new Care permission decision and cannot
  rely on notification visibility.

## Frozen VI/EN copy anchors

| Purpose                  | Vietnamese                                                                                                                                                       | English                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority                | Vai trò người tổ chức hoặc thành viên không thay thế sự đồng ý của người nhận chăm sóc. Quyền được kiểm tra lại cho từng lần xem, thay đổi và xác nhận nhắc nhở. | Organizer or member status never replaces care-recipient consent. Permission is rechecked for every view, change, and reminder acknowledgement. |
| User-provided boundary   | Đây là thông tin lịch do người dùng nhập. LifeBridge không khuyến nghị liều lượng, điều trị, thời điểm, mức độ khẩn cấp hoặc việc tuân thủ.                      | This is a user-provided schedule. LifeBridge does not recommend dosage, treatment, timing, urgency, or adherence.                               |
| Schedule success         | Lịch nhắc đã được máy chủ xác nhận. Trạng thái này chưa có nghĩa là nhắc nhở đã được chuyển.                                                                     | The reminder schedule was confirmed by the server. This does not mean the reminder was delivered.                                               |
| Empty                    | Không có lịch nhắc nào được hiển thị trong chế độ xem này.                                                                                                       | No reminder schedules are shown in this view.                                                                                                   |
| Invalid                  | Hãy sửa các mục sau. Dữ liệu hợp lệ vẫn chưa được gửi.                                                                                                           | Correct the following. Valid entries remain unsent.                                                                                             |
| Denied/not found         | Không thể mở nội dung này. Nội dung có thể không tồn tại hoặc tài khoản hiện tại không có quyền theo đúng mục đích.                                              | This content cannot be opened. It may not exist, or the current account may not have permission for this purpose.                               |
| Scheduling unavailable   | Dịch vụ lịch nhắc không khả dụng. Không suy diễn thành danh sách trống.                                                                                          | Reminder scheduling is unavailable. Do not infer an empty list.                                                                                 |
| Notification unavailable | Lịch nhắc đã được xác nhận, nhưng trạng thái thông báo hiện không khả dụng. Không suy diễn trạng thái chuyển.                                                    | The schedule is confirmed, but Notification state is unavailable. No delivery state is inferred.                                                |
| Offline/no queue         | Bạn đang ngoại tuyến. Thay đổi lịch và xác nhận nhắc nhở bị chặn, không được xếp hàng và không tự gửi lại khi kết nối trở lại.                                   | You are offline. Schedule changes and acknowledgements are blocked, never queued, and never auto-submitted on reconnect.                        |
| Conflict/stale           | Lịch hoặc nhắc nhở đã thay đổi. Lựa chọn của bạn vẫn chưa gửi. Tải trạng thái đã xác nhận và xem lại.                                                            | The schedule or reminder changed. Your choices remain unsent. Load confirmed state and review again.                                            |
| Uncertain                | Chưa biết yêu cầu có hoàn tất hay không. Không gửi lại. Hãy kiểm tra trạng thái hiện tại.                                                                        | It is not known whether the request completed. Do not submit again. Check current state.                                                        |
| Missed delivery truth    | Đã qua thời điểm đã đặt, nhưng việc chuyển nhắc nhở chưa được xác nhận. Chưa ghi nhận xác nhận đã xem.                                                           | The scheduled time passed, but delivery was not confirmed. No acknowledgement is recorded.                                                      |
| Failed delivery          | Chuyển nhắc nhở không thành công. Lịch vẫn được xác nhận; chưa ghi nhận xác nhận đã xem.                                                                         | Reminder delivery failed. The schedule remains confirmed; no acknowledgement is recorded.                                                       |
| Acknowledge              | Đánh dấu đã xem nhắc nhở                                                                                                                                         | Mark reminder as seen                                                                                                                           |
| Acknowledgement meaning  | Xác nhận này chỉ ghi nhận rằng nhắc nhở đã được xem. Việc này không xác nhận thuốc đã được dùng và không đánh giá mức độ tuân thủ.                               | This acknowledges only that the reminder was seen. It does not confirm medication was taken or assess adherence.                                |
| Duplicate                | Nhắc nhở này đã được xác nhận trước đó lúc {serverTime}. Không tạo xác nhận thứ hai.                                                                             | This reminder was already acknowledged at {serverTime}. No second acknowledgement was created.                                                  |
| Recovery                 | Đã tải trạng thái mới nhất được xác nhận. Xem lại trước khi gửi thao tác mới.                                                                                    | Latest confirmed state loaded. Review before a new action.                                                                                      |

## Semantic, focus and responsive requirements

- One visible h1, skip link, named header/navigation/main landmarks and logical
  native source order.
- Native label/input/select/button/link controls; `fieldset`/`legend` for unit
  and recurrence groups; `dl` for confirmed facts; `ul/li/article` for rows;
  `<time datetime>` for machine-readable UTC with visible IANA zone.
- Invalid submission focuses a linked error summary; review, conflict,
  uncertain, denied, success and recovery focus a persistent heading once.
  Background refresh never steals focus; cancelling review restores its trigger.
- Stable accessible names while busy, rapid duplicate activation disabled, no
  positive tabindex, no row-click-only/swipe/hover-only interaction.
- Persistent 4 px high-contrast focus, 44 px common targets, text + icon +
  border for state, forced-colors support and no motion-carried meaning.
- Test 320/375/768/1024/1280/1440 CSS px, 200% zoom, 400% reflow, long VI/EN,
  text spacing, portrait/landscape, forced colors and reduced motion with no
  horizontal page scroll or sticky obstruction.

## Rejected output and non-goals

Reject generated HTML/CSS/scripts/source, screenshots/imports, private IDs/
locators/URLs, CDN/runtime/tracking, placeholder credentials, generated business
logic, inaccessible custom controls, medical wording, optimistic save/ack,
implied delivery, offline replay, blind retry, toast-only truth, color-only
state, countdown/pulse and clinical/urgency imagery.

P4-S2, P4-S3, DATA-S1, P5, Spring, external channels, prescribing, dosage
determination, interaction checking, missed-dose guidance, adherence scoring,
escalation, emergency behavior, deployment and release are outside this handoff.

## Freeze decision

The four Stitch outputs are reference-only and not independently visually
approvable. The corrected native contract above is complete enough for
repository-native implementation and automated proof. Status is **Frozen for
native semantic implementation with mandatory corrections; generated pixels
and source unapproved; KI-019 retained**.
