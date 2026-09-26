# P1-S1 Stitch Handoff — Accountable Care Task / Công việc chăm sóc có trách nhiệm

## Control / Kiểm soát

```text
Slice: P1-S1
Status: Frozen for P1-S1 implementation
Version: 1.0
Owner: LifeBridge project owner
Last reviewed/frozen: 2026-07-26
Product requirement: MVP-001 through MVP-012
Flow: create → assign → view → complete → outbox → notify → dashboard
Routes: /households/:id, /households/:id/tasks, /tasks/:taskId, /notifications
Data class: Synthetic coordination data only
Contract: P1-S1-v1
Change: CHG-2026-008
```

The official Google Stitch MCP produced the visual references. They are design
input, not production source. No generated HTML, CSS, script, runtime, remote
image, signed URL, or private screen identifier is committed.

MCP Stitch chính thức đã tạo các tham chiếu hình ảnh. Đây chỉ là đầu vào thiết
kế, không phải source production. Repository không chứa HTML, CSS, script,
runtime, ảnh từ xa, signed URL hoặc screen ID riêng tư do Stitch tạo.

## Outcome / Kết quả người dùng

Within the deterministic Minh An synthetic household, an authorized fixture
caregiver can create and assign a task, find it on the task list/dashboard,
complete it once, and see a persistent notification. Task completion and
notification delivery remain separate truths.

Trong hộ gia đình tổng hợp Minh An, caregiver fixture có quyền có thể tạo và giao
việc, tìm công việc trên danh sách/dashboard, hoàn thành đúng một lần và xem
thông báo bền vững. Trạng thái hoàn thành công việc và trạng thái chuyển thông
báo luôn được trình bày riêng.

## Reviewed Stitch references / Tham chiếu đã review

| Local alias                      | Screen/state                                                                             | Viewport                 | Review result                    | Required correction before freeze                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `STITCH-P1-001/LB011-DESKTOP-v1` | `LB-011` dashboard; notification dependency delayed while task data is current           | Desktop                  | Direction accepted               | Make actor role, explicit row action, focus treatment, and icon-plus-text status more prominent                       |
| `STITCH-P1-001/LB013-DESKTOP-v1` | `LB-013` task board; offline blocked mutation, conflict, notification pending            | Desktop                  | Failure-state reference accepted | Replace the medication-themed example with a neutral household task                                                   |
| `STITCH-P1-001/LB013-MOBILE-v1`  | `LB-013` online task list; enabled create action                                         | Mobile, 390 CSS px class | Responsive direction accepted    | Show `Lan — Family caregiver` role text in the compact header                                                         |
| `STITCH-P1-001/LB014-DESKTOP-v1` | `LB-014` detail/edit; conflict, version, audit, offline draft                            | Desktop                  | Interaction direction accepted   | Use VI-first navigation and state that the local draft is not saved to the server                                     |
| `STITCH-P1-001/LB014-MOBILE-v1`  | `LB-014` detail/edit; one-column form, conflict, local unsaved draft                     | Mobile, 390 CSS px class | Responsive direction accepted    | Specify long VI/EN copy, 320 CSS px reflow, and sticky-action focus order before freeze; revalidate in implementation |
| `STITCH-P1-001/LB019-DESKTOP-v1` | `LB-019` persistent notifications; delivered, pending, failed, empty, load-error, denied | Desktop                  | State model accepted             | Replace the leading English `error` label with VI-first localized copy                                                |

The first LB-013 generation response was not retained as a discoverable
artifact. After `list_screens` and project metadata showed no retrievable
reference, one controlled regeneration captured a complete server-side screen
reference. No third generation was attempted.

## Freeze trace and correction resolution

No new Stitch call is required. The reviewed remote aliases remain the visual
provenance; this repository-native specification resolves the correction list
without importing generated source or private locators.

| Route/surface                                  | Stitch alias                          | Frozen correction and implementation trace                                                                                                                                                                            | Required evidence                                    |
| ---------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Dashboard `/households/:id`                    | `LB011-DESKTOP-v1`                    | Header shows `Lan — Người chăm sóc gia đình / Family caregiver`; every task row has a named detail link and explicit complete action when authorized; icon + text accompanies state; 3 px focus ring is never clipped | semantic/keyboard/partial-Notification/browser tests |
| Task board `/households/:id/tasks`             | `LB013-DESKTOP-v1`, `LB013-MOBILE-v1` | Neutral synthetic “Arrange transport / Sắp xếp phương tiện” task replaces medication content; list-first layout; compact header retains actor role; offline create/complete is blocked, never queued                  | 320–1440 reflow, offline, actor/role tests           |
| Task create/detail `/tasks/:id` and board form | `LB014-DESKTOP-v1`, `LB014-MOBILE-v1` | VI-first navigation; local input retention is labelled “Chưa lưu trên máy chủ / Not saved to server”; long VI/EN wraps at 320 px; sticky actions follow fields in DOM/focus order and never cover focus               | validation retention, conflict, 320/zoom/focus tests |
| Notifications `/notifications`                 | `LB019-DESKTOP-v1`                    | VI-first status/error labels; persistent list, empty, denied, load-error, pending/failed dependency context, and delivered rows; no toast-only truth or fabricated Notification row                                   | recipient-scope, degraded, duplicate, VI/EN tests    |

Accepted accessible divergence: production uses semantic lists and native
controls instead of any canvas-like board or generated custom control. Layout
may reflow earlier than a Stitch reference to preserve long strings, target
size, focus, and 320 px behavior.

## Frozen notification and actor model

- Primary fixture: Lan creates/co-ordinates; Minh is assigned and completes;
  Lan receives exactly one persistent completion notification.
- Completion never notifies the completing actor about their own action.
  Self-completion is durably suppressed and produces no notification row.
- Create/assignment produces no P1 notification.
- Care-owned pending/retry/failed delivery appears with the affected task or
  dashboard status. Notification-owned persistent items appear only after its
  durable commit.
- The fixture actor control is visibly labelled local demo context, contains
  only synthetic members, and cannot be enabled by a production build.

## Localization contract

- Default fixture locale: `vi-VN`; supported alternate: `en`.
- The visible language switch preserves route, actor, safe form input, and
  confirmed state, and updates the document `lang`.
- Every visible and assistive string is keyed. Missing keys fail tests; there
  is no mixed-language fallback or concatenated translated sentence.
- Dates use `Intl.DateTimeFormat` with the selected locale and the stored IANA
  time zone. The explicit zone label remains visible.
- Minimum key families:
  `nav.*`, `actor.*`, `dashboard.*`, `tasks.*`, `task.form.*`,
  `task.status.*`, `priority.*`, `delivery.*`, `notifications.*`,
  `state.loading`, `state.empty`, `state.offline`, `state.denied`,
  `state.conflict`, `state.error`, `action.*`, and `errors.*`.

## State, focus, and announcement contract

| State                         | Persistent visible truth                                                 | Focus/announcement                                    | Recovery                                      |
| ----------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------- |
| Loading                       | named region and scope; no fake task                                     | polite status only for meaningful delay               | wait or retry when exposed                    |
| Empty                         | reason and permitted create action                                       | normal reading order                                  | focus create heading/action                   |
| Validation                    | linked summary + inline field errors; valid input retained               | focus error summary, links focus invalid field        | correct and resubmit with same intent         |
| Denied/not found              | capability boundary without resource disclosure                          | focus page heading; no sensitive announcement         | safe dashboard destination                    |
| Offline                       | “not saved/not queued”; confirmed cached content labelled with freshness | polite persistent status; no success                  | reconnect then explicit submit                |
| Conflict                      | current server version and retained local input                          | focus persistent alert once                           | explicit “Load current version”; no overwrite |
| Task completed                | confirmed task/version/time remains in page                              | polite in-place status; logical action focus retained | follow task/detail links                      |
| Notification pending/retrying | task remains completed; delivery not claimed                             | polite status, not alert spam                         | automatic bounded retry/status refresh        |
| Notification failed           | task remains completed; delivery attention required                      | persistent alert with correlation-safe retry          | retry dispatcher/status refresh               |
| Notification delivered        | one persistent recipient-scoped item                                     | polite status; no forced route change                 | open source task                              |

## Frozen tokens and preimplementation contrast review

| Purpose          | Foreground      | Background            |   Ratio |
| ---------------- | --------------- | --------------------- | ------: |
| Primary text     | `#15332B`       | warm canvas `#FFF9F0` | 13.02:1 |
| Secondary text   | `#4C625A`       | warm canvas `#FFF9F0` |  6.26:1 |
| Primary action   | white `#FFFFFF` | deep green `#1F5F4A`  |  7.52:1 |
| Green text/state | `#1F5F4A`       | pale mint `#E8F3ED`   |  6.61:1 |
| Error text       | `#A12828`       | warm canvas `#FFF9F0` |  7.04:1 |
| Focus indicator  | `#B54708`       | warm canvas `#FFF9F0` |  5.18:1 |

Implementation must preserve at least these ratios, add explicit borders/icons
for forced colors, honor reduced motion, and package fonts locally or use the
approved system fallback. No runtime font or asset request to Stitch is allowed.

## Approved extracted intent / Ý định được chấp nhận

- Calm warm surface, deep green primary, pale mint navigation, 8 px rounded
  language, and Be Vietnam Pro.
- Vietnamese-primary labels with concise English support.
- List-first task interaction; drag is never required.
- Explicit actor, household, assignee, priority, due time zone, status, version,
  freshness, and audit context.
- Icon plus text for priority, persistence, delivery, offline, conflict, and
  error states; color is supplementary.
- Desktop density reflows to a semantic single column on mobile.
- Completed task, notification pending, notification failed, and notification
  delivered are distinct states.
- Offline P1 mutations are blocked. A local draft is not server persistence.
- Conflict recovery loads the current server version and never overwrites
  silently.
- Persistent notifications are keyboard-operable and never toast-only.

## Rejected generated content / Nội dung không được dùng

- Any generated HTML, CSS, scripts, component runtime, dependency, tracking,
  hardcoded production copy, or inferred business logic.
- Medication-themed sample copy in the P1 task-board reference.
- Any copy that implies diagnosis, treatment, dosage advice, emergency
  dispatch, legal guardianship, consent bypass, or confirmed delivery without a
  durable acknowledgement.
- Row-click-only or drag-only interaction, color-only status, hidden critical
  action, truncated safety/recovery text, and optimistic “saved” language.

## Authorization, privacy, and persistence

P1 uses a deterministic fixture actor only. The server-side contract must still
enforce household, resource, and action scope; the client cannot infer
permission from the visible role label. Real identity, household onboarding,
consent receipts, and delegated authority remain P2 work.

Use minimum synthetic fields: task title, assignee label, due timestamp and time
zone, priority, status, version, source event alias, delivery state, read state,
and audit actor/action/time/result. Do not put diagnosis, dosage, address, phone,
or free-form care records in notification/log payloads.

Persistence truth:

```text
draft != saving != confirmed
task completed != notification delivered
offline local draft != saved to server
queued != confirmed
conflict != rejected != failed
```

## Required semantic components

| Component         | Semantic baseline                       | Required behavior                                                                                   |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| App shell         | `header`, `nav`, `main`                 | One visible `h1`, skip target, current-route indication, role and freshness context                 |
| Task list         | Heading plus semantic list              | Keyboard order follows visual order; every row exposes a named details/action control               |
| Task form         | Native `form`, `label`, inputs, buttons | Required cues, linked inline errors and summary, safe input retention, focus first actionable error |
| Status banner     | Named status/alert region               | Scope, persistence truth, timestamp, and recovery; no false success                                 |
| Conflict notice   | Alert plus explicit buttons             | Announce newer version, preserve input safely, load current server version                          |
| Notification list | Semantic list                           | Persistent items, source-task link, read state, delivery state, retry where allowed                 |
| State panel       | Headings and grouped examples           | Empty, load failure, denied, stale/offline behavior without protected-resource disclosure           |

## Responsive and accessibility gates

- Validate at 320, 375/390, 768, 1024, 1280, and 1440 CSS px.
- Validate 200% zoom and 400% reflow without page-level horizontal scrolling.
- Use minimum 44 by 44 CSS px targets and visible focus.
- Do not remove actor, task owner, due state, version, freshness, persistence, or
  delivery truth at narrow widths.
- Test keyboard-only operation, screen-reader names/status announcements, text
  spacing, reduced motion, forced colors, and non-color status recognition.
- The mobile implementation must use semantic order; it must not merely scale
  the desktop canvas.

## Service contracts required before freeze

The following repository-owned contracts remain blockers:

1. versioned create/list/get/complete task operations;
2. household/action authorization and non-disclosing denied/not-found behavior;
3. idempotency keys and optimistic version conflict response;
4. transactional outbox event and notification inbox/deduplication;
5. notification delivery acknowledgement and retry state;
6. redacted structured audit/log event;
7. deterministic synthetic fixture and localization keys;
8. timeout, partial-failure, offline-blocked, and recovery semantics.

Until these contracts are implemented and reviewed, the client must not infer
server behavior from the Stitch screens.

## Freeze decision / Quyết định đóng băng

```text
Design direction: Accepted
Responsive direction: Accepted; corrections mapped above
Product boundary: Accepted
Generated source import: Rejected
Product/accessibility/privacy/security specification review: Accepted
Production UI implementation readiness: Ready for P1-S1
Remaining acceptance evidence: implementation-level automated and manual
accessibility, responsive, contrast, privacy, browser, and visual review
Exact next action: implement only P1-S1 through the frozen P1-S1-v1 contract,
then record test results and accessible divergences before slice acceptance
```
