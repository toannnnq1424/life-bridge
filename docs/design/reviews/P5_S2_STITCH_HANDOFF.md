# P5-S2 Stitch Handoff — Volunteer Match and Organization Coordination

- Status: Frozen for corrected native-semantic implementation
- Date: 2026-07-29
- UI handoff: `P5-S2-UI-v1`
- Routes: `LB-025 /matching`; `LB-026 /organization`
- Design system: existing private LifeBridge `Clinical Clarity`

## Gate and redacted provenance

The approved existing private LifeBridge Stitch project was used. One owned-
project inventory, one screen inventory and one design-system inventory were
read before mutation. The four exact P5-S2 titles were absent. Four bounded
synthetic generation writes then completed exactly once. No write timed out,
detached or had an uncertain result; no retry, edit, variant, delete, export or
download occurred. Each created screen was read back exactly once with
`get_screen`; title, device class, dimensions and artifact metadata matched.

| Repository alias      | Exact title                                                                               | Device/read-back                             | Disposition                               |
| --------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| `P5S2-LB025-CURRENT`  | `LB-025 Volunteer matching — Approved offer, assignment and progress — Desktop — P5-S2`   | Desktop; exact-title metadata read back once | Reference only; generated source rejected |
| `P5S2-LB025-RECOVERY` | `LB-025 Ghép nối tình nguyện viên — Từ chối, xung đột và phục hồi — Mobile — P5-S2`       | Mobile; exact-title metadata read back once  | Reference only; generated source rejected |
| `P5S2-LB026-CURRENT`  | `LB-026 Organization coordination — Capacity, approvals and exceptions — Desktop — P5-S2` | Desktop; exact-title metadata read back once | Reference only; generated source rejected |
| `P5S2-LB026-RECOVERY` | `LB-026 Điều phối tổ chức — Ngoại tuyến, từ chối và đối soát — Mobile — P5-S2`            | Mobile; exact-title metadata read back once  | Reference only; generated source rejected |

Prompts contained only synthetic match codes, a fictional organization label,
broad support categories, coarse areas, bounded time windows, aggregate counts,
structured status and failure copy. No credential, private locator, remote ID,
generated source, screenshot, URL, real person, household, care record, contact,
precise location, diagnosis or free-form sensitive data is persisted here.

The callable read-back surface exposed metadata but did not provide independent
private-pixel inspection. It therefore cannot prove visible layout, contrast,
focus, target size, reflow or language rendering. KI-019 remains open and this
handoff makes no standalone visual-conformance claim. KI-016 continues to
reserve manual assistive-technology and physical-device evidence.

## Independent privacy and accessibility critique

The references are accepted only as information-architecture input. Generator
claims such as “WCAG compliant”, “production ready”, complete state coverage or
safe disclosure are not evidence. The native implementation and tests remain
authoritative.

Rejected generated directions and facts include:

- any invented organization fact, actor, timestamp, count, capacity, approval,
  match, audit entry, availability, outcome or success;
- any names, contacts, exact addresses, household details, diagnoses, treatment,
  urgency, safety, eligibility, priority, suitability, match score or endorsement;
- a role, membership, approval, capacity or consent badge treated as authority;
- automatic dispatch, optimistic success, blind retry, timer-driven mutation,
  toast-only truth, auto-dismissed failure or fabricated progress;
- a dense desktop table without an equivalent semantic card/list reflow;
- state galleries exposed as if all failures apply to one live match;
- generated HTML, CSS, scripts, remote assets, dependencies, localization copy
  or business logic.

## Frozen authority and disclosure boundary

- Every protected read, write and action requires a fresh, request-bound,
  purpose-scoped P2 Identity & Consent decision for the exact subject, actor,
  organization, resource, action and purpose.
- Volunteer, coordinator, organizer, member and organization labels create no
  subject authority or care-recipient consent.
- Identity authority, organization approval, volunteer capacity and
  care-recipient consent are separate expiring/revocable evidence. None may be
  inferred from another.
- Only minimum authorized structured fields may render: opaque match code,
  bounded support category, coarse service area, bounded time window, lifecycle
  state, evidence expiry, capacity and concurrency versions.
- Protected facts disappear from visible and assistive text, title, history and
  recovery copy on denial, expiry or revocation.
- The UI must not infer eligibility, need, diagnosis, treatment, urgency,
  safety, priority, suitability, match quality, availability, outcome or
  endorsement.
- Only authoritative Community evidence may support `accepted`, `assigned`,
  `reassigned`, `progress recorded`, `closed`, `revoked` or persisted claims.

## Responsive information architecture

One semantic control set serves desktop and mobile:

```text
skip link
→ compact route navigation and VI/EN control
→ one h1, purpose and disclosure boundary
→ authoritative aggregate/queue status
→ selected match summary
→ separate authority and evidence region
→ permitted action and confirmation
→ persistent result/reconciliation region
→ privacy-safe activity
```

Desktop may use a queue table plus detail pane only when headers, row actions
and status are fully keyboard accessible. At narrow widths it becomes ordered
cards; it does not horizontally scroll. Mobile keeps summary, queue, selected
item, evidence, action and reconciliation in that order. Loading is polite and
does not move focus. Validation focuses a linked summary. Denial, conflict,
revocation and uncertain results focus one persistent heading once.

## LB-025 `/matching`

The volunteer/coordinator may inspect a minimum-disclosure approved offer,
decline or accept it, and record bounded assignment/progress actions only when
the frozen authority and Community contracts permit them.

- Pending, rejected, revoked or expired approval disables mutation.
- Accept is unavailable with no capacity and is version-bound for duplicate,
  stale-offer and concurrent-accept truth.
- Assignment, reassignment and progress use explicit expected versions.
- Confirmation repeats only the minimum disclosure and expected action.
- A confirmed duplicate returns current authoritative state without a second
  effect. A conflict refreshes authority and Community state before a new user
  decision.
- No match is an explicit empty result, not evidence of ineligibility.

## LB-026 `/organization`

The coordinator sees organization-scoped aggregate capacity and a minimum-
disclosure queue. Aggregate loading, empty, partial-error and stale states are
independent from an individual match. Partial failure identifies unavailable
regions and never substitutes fabricated zeros.

Approve, reject, revoke, assign, reassign, record bounded progress and close
remain distinct actions with separate confirmation and expected versions.
Organization approval does not dispatch a volunteer. A capacity count is not
availability or suitability. Reassignment preserves conflict truth and does
not hide the prior authoritative assignment.

## Required truth and recovery states

Native proof must cover VI/EN and:

- pending approval; approved; rejected; revoked; expired;
- decline; duplicate accept; no capacity; stale offer/version; concurrent accept;
- assignment/reassignment conflict; progress conflict; closed/revoked during action;
- organization, Identity or Community unavailable;
- offline blocked before send versus uncertain after possible send;
- scoped denial/minimum disclosure; no match; aggregate loading/empty/partial error.

Offline never permits protected mutation. A definitely unsent action remains
blocked. An uncertain action disables repetition and offers “check current
state”, which refreshes authority and reads authoritative Community state using
the same idempotency/reconciliation identity. Only that evidence may enable a
new decision.

## Accessibility acceptance

Native validation must prove semantic landmarks/headings, unique labels,
logical DOM/focus order, visible focus, full keyboard operation, 48px targets,
non-color status cues, programmatic error-summary links, polite live regions,
320px reflow without horizontal page scrolling, 200% text zoom, VI/EN expansion,
WCAG AA contrast and reduced-motion behavior. Status changes must persist in
text and must not depend on motion, color, hover, icons or toast timing.

## Gate verdict

**PASS WITH CORRECTIONS — Frozen.** The four synthetic references exist once
and were read back once. Native UI may proceed only against the frozen
authority/data/action/failure contracts and the corrections above. Generated
source and invented facts are rejected. KI-019 prevents a visual-conformance
claim until bounded independent private-render review is available.
