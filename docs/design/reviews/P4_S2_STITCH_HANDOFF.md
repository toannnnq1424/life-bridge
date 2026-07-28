# P4-S2 Stitch Handoff — Emergency Contacts and Offline-Readable Plan

- Status: Frozen for native implementation
- Date: 2026-07-28
- Change ID: `CHG-2026-017`
- Contract: `P4-S2-v1` / `P4-S2-offline-v1`
- Screens: LB-020, LB-021, and only the P4-S2 read-only LB-032 behavior
- Architecture decision: ADR-025

## Gate and provenance

Three independent pre-implementation reviews covered contract/data/authority/
retention/threat, UI/privacy/accessibility/offline behavior, and test/CI/
operations/recovery. ADR-025 and `docs/security/P4_S2_THREAT_MODEL.md` were
accepted before production UI.

The approved existing private LifeBridge project and `Emerald & Azure Modern`
design system version 2 were used. Every exact title was confirmed absent
before its write. Each generation was issued once and its returned screen was
read directly once. Prompts contained only synthetic generic labels. No
credential, private locator, remote ID, generated source, screenshot, real
contact/plan data, or exported artifact is persisted here.

| Alias                 | Exact title                                                                                     | Device/read-back                                           | Disposition                               |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `P4S2-LB020-ORDER`    | `LB-020 Emergency contacts — Ordered list and review — Desktop — P4-S2`                         | Desktop; exact title/device and completed metadata present | Reference only; generated source rejected |
| `P4S2-LB020-RECOVERY` | `LB-020 Danh bạ khẩn cấp — Lỗi, giới hạn đồng ý và xung đột — Mobile — P4-S2`                   | Mobile; exact title/device and completed metadata present  | Reference only; generated source rejected |
| `P4S2-LB021-LIVE`     | `LB-021 Emergency plan — Live confirmed and offline-copy setup — Desktop — P4-S2`               | Desktop; exact title/device and completed metadata present | Reference only; generated source rejected |
| `P4S2-LB021-OFFLINE`  | `LB-021 Kế hoạch khẩn cấp + LB-032 — Bản sao ngoại tuyến, hết hạn và phục hồi — Mobile — P4-S2` | Mobile; exact title/device and completed metadata present  | Reference only; generated source rejected |

Stitch text/metadata confirms the intended theme, device, synthetic content,
state galleries, minimum projection, keyboard buttons, offline lock, and
accessibility direction. Private pixels were not independently available.
Therefore this handoff is Frozen only for corrected native semantics; it is not
a standalone visual-conformance approval. KI-019 remains.

## Rejected generated wording and behavior

The native implementation must not inherit these reference ambiguities:

- “Priority contact” becomes “configured contact in participant-reviewed
  order”; order does not mean availability, urgency, legal authority, or
  professional status.
- “Fresh/current offline copy” is forbidden. The allowed text is “within the
  approved reading window,” always paired with “saved offline copy — not live.”
- “Approved plan” becomes “participant-reviewed, server-confirmed plan.” No
  professional or clinical approval is claimed.
- “Call” controls state only that the device calling function opens. There is
  no LifeBridge call, connection, answer, availability, dispatch, or guarantee.
- A green/check state may confirm only a server plan version or local encrypted
  write. It never means that a person was contacted.
- Generated side navigation, bottom navigation, HTML, icons, scripts,
  dependencies, source, CDN usage, and state logic are rejected. Production
  routes use native repository components and contracts.
- Offline queue/sync/retry controls are inapplicable. Every P4-S2 offline write
  is blocked and never queued, replayed, or submitted on reconnect.

## Frozen information architecture

### LB-020 ordered contacts

One h1 and a semantic `<ol>` expose only the current authorized projection:
position, participant-entered display label, and one configured dial string.
The complete list uses native Edit, Remove, Move earlier, and Move later
controls. Drag is never required. Reorder focus stays with the moved item and a
polite announcement reports the unsaved position.

A separate inline review repeats the complete proposed order, expected list
revision, and the consequence that a confirmed contact change makes the plan
`review_required` and removes/replaces a saved offline copy separately. Success
reports a server-confirmed list revision. Unknown outcome offers only a fresh
current-state read.

Required states: no contacts, invalid linked error summary, minimum/consent-
limited projection, generic denied/not-found, unavailable-not-empty, stale
revision conflict preserving only safe unsent memory, uncertain result,
recovered current state, and confirmed complete replacement.

### LB-021 live plan

The first source banner is:

> Live server-confirmed plan — permission checked for this view.

Vietnamese:

> Kế hoạch trực tiếp đã được máy chủ xác nhận — quyền đã được kiểm tra cho lần xem này.

A permanent safety boundary states that LifeBridge displays only a participant-
reviewed plan and does not diagnose, rank urgency, contact anyone, or dispatch
emergency services. Plan steps and contacts are separate semantic ordered
lists. Confirmed facts use `<dl>` and `<time>`: plan version, contact-list
revision, reviewed/server-confirmed facts, UTC, server-derived local time,
numeric offset, and IANA zone.

Required online states: `no_plan`, `draft_only`, `reviewed`,
`review_required`, minimum/consent-limited, generic denied/not-found,
unavailable-not-empty, conflict with safe unsent memory, unknown result,
recovery, and confirmed version. No-plan is an authorized online fact only.

### Offline-copy setup

Offline setup is a second device-scoped review, not part of plan confirmation.
It names the exact copied fields, current source revisions, 24-hour reading
window, stale period through 72 hours, expiry/purge, shared-device/XSS/unlocked-
profile risk, and inability to learn remote revocation while disconnected.

The offline passphrase is distinct from the account password; paste and
password managers are allowed. It is never sent, logged, stored, hinted, or
recoverable. Forgotten passphrase means local removal and fresh online
recreation. Plan confirmation and encrypted local persistence are reported as
two separate facts. Quota/write/read-back/decrypt failure leaves the live plan
readable and never claims that a copy was saved.

### LB-032 offline read

Before passphrase unlock, render no contact or plan content. The permanent
source banner is:

> Saved offline copy — not live. Current permission and updates cannot be checked offline.

Vietnamese:

> Bản sao ngoại tuyến đã lưu — không phải trạng thái trực tiếp. Không thể kiểm tra quyền hiện tại hoặc cập nhật khi ngoại tuyến.

After authenticated unlock, the source/version/last-confirmed facts precede the
plan content. `offline_recent` means only within the approved 24-hour reading
window. `offline_stale` over 24 through 72 hours has a persistent warning before
content. `freshness_unknown` uses the strongest warning and never appears
recent. At 72 hours, known revocation/denial, incompatible schema, or integrity
failure, protected content is hidden before the ciphertext is purged.

Wrong/forgotten passphrase reveals no hint. No saved copy/eviction never means
no plan. Local Remove saved copy is always available. Recovery requires a live
fresh-authority read and separately reports the server plan result and offline
replacement result. There is no edit, queue, replay, retry, countdown, pulse,
auto-submit, or toast-only critical state.

## Minimum disclosure

Online contacts and the offline snapshot contain only:

```text
position
displayLabel
dialString
```

The offline snapshot additionally contains only:

```text
contract/source/schema version
plan version and contact-list revision
ordered participant-reviewed guidance steps
reviewed and last-confirmed server facts
UTC plus server-supplied local/IANA/offset display facts
fresh-until and expiry facts
```

Address, email, notes, location, health context, contact availability,
professional/organization/legal role, hidden totals, contact consent claims,
roster, audit/history, actor/grant/subject identifiers, drafts, passphrase/key
material, and arbitrary metadata are excluded.

## Accessibility freeze

- DOM/focus sequence: skip link, header/navigation/locale, h1, source banner,
  safety boundary, plan, contacts, facts, actions.
- Contacts and plan use `<ol>/<li>/<article>`; facts use `<dl>`; timestamps use
  `<time datetime>`. One DOM/control set serves all widths.
- Invalid submit focuses a linked summary. Confirmed, conflict, integrity,
  expired, purged, and recovery transitions focus one persistent heading.
  Background connectivity changes never steal focus.
- Common targets are at least 44 by 44 CSS pixels; the native target is 48
  pixels. Focus is persistent, high-contrast, and at least 4 pixels on the
  safety path.
- Text meets 4.5:1; UI/icon/focus boundaries meet 3:1. Status always combines
  explicit text, recognizable icon, border/shape, and color. Forced colors
  preserve focus and boundaries.
- At 320 CSS pixels and 400% reflow there is one readable column, no page
  horizontal scroll, and long VI/EN/dial strings wrap safely.
- Reduced motion removes nonessential transitions. There is no pulse,
  countdown, auto-dismiss, or motion-carried emergency meaning.
- Visible and assistive text expose the same minimum projection. URLs, titles,
  announcements, errors, caches, and test artifacts contain no protected
  values beyond the current permitted view.

Automated axe/keyboard/reflow evidence does not become a manual WCAG or
assistive-technology claim. KI-016 remains.

## Implementation gate

This handoff is Frozen because the owner, exact-purpose permissions, strict
contracts, cache/crypto ADR, retention/purge/integrity behavior, state truth,
minimum projection, responsive semantics, localization anchors, privacy
boundary, and test mapping are resolved. Production implementation must be
native and must prove the threat model. The Stitch output itself remains
untrusted reference input.
