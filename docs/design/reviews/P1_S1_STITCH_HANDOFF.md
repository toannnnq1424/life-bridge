# P1-S1 Stitch Handoff — Accountable Care Task / Công việc chăm sóc có trách nhiệm

## Control / Kiểm soát

```text
Slice: P1-S1
Status: Design review — not frozen
Version: 0.1
Owner: LifeBridge project owner
Last reviewed: 2026-07-26
Product requirement: MVP-001 through MVP-012
Flow: create → assign → view → complete → outbox → notify → dashboard
Routes: /households/:id, /households/:id/tasks, /tasks/:taskId, /notifications
Data class: Synthetic coordination data only
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
Responsive direction: Accepted with listed corrections
Product boundary: Accepted
Generated source import: Rejected
Production UI implementation readiness: Blocked
Blocking reason: P1 service contracts, corrections, localization mapping, and
manual accessibility evidence are not complete
Exact next action: In the dedicated P1-S1 task, freeze task/event/API contracts,
apply the correction list to repository-native component specifications, then
approve this handoff before frontend implementation
```
