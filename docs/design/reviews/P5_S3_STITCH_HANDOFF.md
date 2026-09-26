# P5-S3 Stitch Handoff — Moderation Resolution

- Status: Frozen for corrected native-semantic implementation
- Date: 2026-07-29
- UI handoff: `P5-S3-UI-v1`
- Route: `LB-027 /admin/moderation`
- Design system: existing private LifeBridge `Clinical Clarity`

## Gate and redacted provenance

The approved existing private LifeBridge Stitch project was used. One owned-
project inventory and one design-system inventory were read before mutation.
Two bounded synthetic generation writes completed exactly once. Neither write
timed out, detached or had an uncertain result; no retry, edit, variant,
delete, export or download occurred. Each created screen was read back exactly
once with `get_screen`; exact title, device class, dimensions and artifact
presence matched.

| Repository alias      | Exact title                                                                              | Device/read-back                             | Disposition                               |
| --------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| `P5S3-LB027-CURRENT`  | `LB-027 Moderation resolution — Queue, redacted evidence and decision — Desktop — P5-S3` | Desktop; exact-title metadata read back once | Reference only; generated source rejected |
| `P5S3-LB027-RECOVERY` | `LB-027 Xử lý kiểm duyệt — Xung đột, xác nhận và phục hồi — Mobile — P5-S3`              | Mobile; exact-title metadata read back once  | Reference only; generated source rejected |

Prompts contained only opaque synthetic report/item codes, a bounded conduct
category, coarse timestamps, policy/version labels, structured outcomes and
reasons, and privacy-safe state copy. No credential, private locator, remote
identifier, generated source, URL, screenshot, real person, contact, location,
household, care record, diagnosis, accusation narrative or raw evidence is
persisted here.

The read-back exposed screenshot artifact metadata but no independently
inspectable private pixels. It therefore cannot prove visible layout,
contrast, focus, target size, reflow or language rendering. KI-019 remains
open. KI-016 continues to reserve manual assistive-technology and physical-
device evidence.

## Independent privacy and accessibility critique

The references are accepted only as information-architecture input. Generator
claims about accessibility, privacy, completeness or production readiness are
not evidence. Native contracts, implementation and tests remain authoritative.

Reject or correct all generated directions that imply:

- a moderator/admin/organizer/member label, queue presence or prior decision
  establishes current authority, consent or subject access;
- names, contacts, exact location, household/care/medical facts, narrative
  allegations, raw evidence or unbounded notes should be disclosed;
- a report establishes diagnosis, treatment, urgency, danger, guilt,
  criminality, abuse validity, eligibility, safety, endorsement, automated
  moderation accuracy or an external-enforcement outcome;
- automatic resolution, escalation, suspension, optimistic success, blind
  retry, timer-driven mutation, toast-only truth or silent auto-advance;
- all state specimens describe one live case, or an empty/denied response
  proves whether a report exists;
- generated HTML, CSS, scripts, remote assets, dependencies, localization copy
  or business logic may enter production.

## Frozen authority and minimum-disclosure boundary

- Every queue read, detail read and resolution action requires a fresh,
  request-bound, exact-purpose P2 Identity & Consent decision for the actor,
  subject, resource, action and moderation purpose.
- Role labels do not create consent or authority. Denied and missing cases use
  the same anti-enumeration surface and reveal no case existence or details.
- Render only bounded structured fields authorized for the current purpose:
  opaque report/item code, bounded category, coarse event time, policy version,
  redaction/retention label, lifecycle state, provenance and concurrency
  version. Protected facts disappear from visible and assistive text, title,
  history and recovery copy when authority expires or is revoked.
- Evidence is a minimum redacted summary backed by authoritative Community
  provenance. The UI never reconstructs or fetches raw sensitive payloads.
- Outcomes and reasons are bounded structured values from the frozen contract;
  no free-form sensitive field is permitted.
- Only authoritative Community state may support withdrawn, expired, already
  resolved, restricted, closed, duplicate or current-result claims.

## Responsive information architecture

One semantic control set serves desktop and mobile:

```text
skip link
→ compact route navigation and VI/EN control
→ one h1, purpose and disclosure boundary
→ least-privilege queue or explicit loading/empty state
→ selected report summary
→ fresh authority and minimum redacted evidence
→ bounded outcome and reason controls
→ explicit confirmation
→ persistent result/reconciliation and privacy-safe audit truth
```

Desktop may use a queue plus detail pane only when its reading and focus order
remain linear and keyboard complete. At narrow widths the queue becomes
ordered cards without horizontal page scrolling. Loading is polite and never
moves focus. Validation focuses a linked error summary. Denial, conflict,
revocation and uncertain result focus one persistent heading once.

## Destructive/restrictive confirmation and focus

- `No action`, `Restrict item visibility` and `Close report` remain distinct
  version-bound actions. No action auto-escalates or auto-suspends an account.
- Restrictive/destructive confirmation repeats only opaque identifiers,
  selected outcome, structured reason and bounded consequence. `Cancel` is the
  initial safe focus and returns focus to the invoking control.
- Success is announced in a persistent result region. Focus moves once to its
  heading, then the user explicitly selects the next queue item; the interface
  does not auto-advance before announcement.
- A duplicate idempotent request returns current authoritative state without a
  second effect. A stale/concurrent decision requires a fresh authority check
  and current Community read before another user decision.

## Required truth and recovery states

Native proof must cover VI/EN and loading; empty queue; denied/missing anti-
enumeration; withdrawn; expired; already resolved; stale version/concurrent
decision; duplicate/idempotent result; invalid outcome/reason; redaction or
retention conflict; Community unavailable; Identity unavailable; audit/outbox
failure; and action failure with persistent recovery.

Offline never permits a protected action. Definitely-unsent work remains
blocked. An uncertain-after-send result disables repetition and offers `Check
current state`; reconciliation refreshes exact-purpose authority and reads
authoritative Community state using the same idempotency identity. Only that
evidence may enable a new decision.

Audit/outbox failure must not be presented as completed moderation. The result
region preserves the uncertain or failed truth and a bounded recovery path;
logs, events and UI copy contain no narrative evidence or sensitive payload.

## Accessibility acceptance

Native validation must prove semantic landmarks/headings, unique labels,
logical DOM and focus order, visible focus, full keyboard operation, 48px
targets, non-color status cues, programmatic error-summary links, polite live
regions, 320px reflow without horizontal page scrolling, 200% text zoom,
VI/EN expansion, WCAG AA contrast and reduced-motion behavior. Status changes
persist in text and never depend on motion, color, hover, icons or toast timing.

## Gate verdict

**PASS WITH CORRECTIONS — Frozen.** The two synthetic references exist once
and were read back once. Native LB-027 UI may proceed only against the frozen
authority/disclosure/action/failure contracts and corrections above. Generated
source and invented facts are rejected. KI-019 prevents a visual-conformance
claim until bounded independent private-render review is available.
