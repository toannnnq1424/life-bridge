# P9-S2 Stitch handoff — truthful mutation states

Status: `Frozen` (native implementation constraints only). Date: 2026-08-02.

## Reference and review

Two synthetic private Stitch references were generated and read back in the
established LifeBridge project using the existing `Clinical Clarity` design
system:

- `LB-032 Truthful mutation state system — Desktop Reference`: `DESKTOP`,
  2560 rendered/1280 logical width, `COMPLETE`, screenshot artifact returned;
- `LB-033 Truthful mutation state system — Mobile Reference`: `MOBILE`, 780
  rendered/390 logical width, `COMPLETE`, screenshot artifact returned.

Those are private reference aliases spanning the existing canonical LB-032–
LB-035 cross-pattern system. They do not rename or remap `SCREEN_INVENTORY`.

No real names, care facts, contact data, credentials, URLs or identifiers were
sent. Private locators, screenshots, generated HTML/assets/source and external
dependencies are not persisted. Stitch output is untrusted design input.

The independent UI/privacy/accessibility review required all nine states,
source/version/time, preserved confirmed core data, no hidden queue or automatic
replay, icon plus text, persistent recovery actions, bilingual wrapping,
keyboard/focus/live-region behavior, 320 px/400% reflow, forced colors and
reduced motion. The native handoff corrects any generated ambiguity: there is
no “force local” overwrite, no fabricated progress/timer, no toast-only truth,
and `navigator.onLine` is only a hint.

## Frozen native behavior

- One reusable semantic presenter renders stale, queued, blocked, conflicted,
  rejected, dependency-failed, uncertain, reconciling and confirmed.
- Only task create may be held in memory. Copy says “held/not sent/not saved”,
  shows expiry/cancel and local/base provenance only, and reconnect requires
  explicit review/send. A queue item never presents authoritative provenance.
- Upload/delete/acknowledge/consent/auth/moderation/emergency review are blocked
  offline and never queued.
- Confirmation appears only with authoritative version/evidence. Conflicts keep
  current confirmed data separate from unsent local intent and offer
  load-current/re-authorize/review, never sensitive side-by-side disclosure,
  destructive merge, “force local”, or blind retry.
- Dependency failure exposes only a safe class and retained-data truth. Denied,
  not-found and revoked states are anti-enumerating and purge protected visible,
  assistive, history and live-region residue.
- VI/EN copy comes from native localization keys; generated copy is not copied.
  Dates, time zones, expiry, pluralization and assistive truth are tested per
  locale.
- Connectivity changes use a deduplicated polite live region and do not steal
  focus. User-triggered validation/conflict/rejection/uncertainty focuses one
  persistent heading once. Background reconciliation does not move focus.
- One DOM/control order reflows; text and borders carry meaning in forced
  colors; motion is removable; critical truth never auto-dismisses.
- Destructive review gives safe Cancel initial focus, supports Escape, restores
  the invoker, and after confirmed deletion focuses the deterministic next item
  or empty-state heading.

## Limitations

KI-019 still prevents an independent private-pixel conformance claim. KI-016
still requires manual NVDA/Narrator, physical-device, text-spacing and zoom
sessions before pilot/release claims. Automated tests may prove semantics and
layout behavior, not full WCAG conformance.

Freeze decision: `PASS WITH CORRECTIONS — FROZEN for corrected native-only
P9-S2 implementation`; no visual/compliance claim, new product surface or
permission to start P9-S3.
