# P3-S1 Stitch handoff — Daily timeline and accountable task handoff

Status: **Frozen for native semantic implementation with KI-019 retained**

Version: `1.0`

Date: `2026-07-26`

Scope: `LB-012` daily timeline and the minimum `LB-014` task-detail extension
needed for an accountable handoff. This handoff does not authorize P3-S2,
P3-S3, DATA, P5, deployment or release work.

## Evidence and review disposition

Four new synthetic references were generated once in the existing private
LifeBridge project with the active `Emerald & Azure Modern` v2 design system:

- `LB-012 Daily Timeline — Desktop — P3-S1`
- `LB-012 Daily Timeline — Mobile — P3-S1`
- `LB-014 Task Handoff Review — Desktop — P3-S1`
- `LB-014 Task Handoff Review — Mobile — P3-S1`

Direct per-screen read-back confirmed the exact redacted titles and device
classes. No remote ID, project locator, signed URL, screenshot, generated
HTML/CSS/source or credential is recorded here.

The independent authority/privacy/accessibility reviewer could reach the
project but its bounded screen-list view did not expose the four newly
generated titles. It therefore correctly returned **not independently visually
approvable** and did not substitute older screens or infer private identifiers.
The rendered pixels are not standalone approval evidence and no visual
conformance claim is made. `KI-019` remains open.

The handoff is Frozen because the reviewed corrections below—not generated
markup or private pixels—are the authoritative implementation input. Native
automation must prove them before acceptance. A later bounded independent
private-render review may add visual evidence but must not regenerate screens
or weaken these corrections.

## Synthetic content boundary

- Household actors: `Lan` and `Minh`, synthetic aliases only.
- Task example: `Arrange transport / Sắp xếp phương tiện`.
- Explicit zones: `Asia/Bangkok` and `America/New_York`.
- No patient, clinician, medical, diagnosis, treatment, medication, urgency or
  legal-authority claim.
- No real care record, contact, credential, private link, broad membership
  roster or human-entered handoff note.

## Authority and privacy corrections

1. The browser never supplies or infers authority. A current account session
   reaches Identity & Consent for a fresh, permission-specific coordination
   decision. Gateway composes and Care Coordination verifies it.
2. Organizer/member/caregiver status never substitutes for P2 governed consent
   or current task assignment.
3. A collaborator requires the exact accepted P2 boundary. Handoff targets are
   independently authorized and returned as subject-bound actor references
   with safe display keys; the UI never downloads a broad member list.
4. Generic denied and not-found states use the same safe copy and destination.
   They reveal no household, recipient, task, actor, membership, event, total or
   hidden count.
5. Task title may exist only in the authorized, no-store Care read projection
   and safe in-memory stale view. Description and free-form context are absent.
   Title never enters a cursor, notification, audit, outbox, log, metric or
   trace.

## LB-012 daily timeline

- One visible `h1`, page title and named landmarks.
- A labelled date-navigation form uses native controls: Previous, Today, Next
  and selected local date.
- The selected `YYYY-MM-DD`, validated IANA zone, inclusive UTC day start,
  exclusive UTC day end and exact filter are visible together.
- Use `ol > li > article` and `<time datetime="<UTC instant>">`. Server UTC
  occurrence plus stable opaque event reference defines order. Cursor,
  sequence and tie-breaker are never displayed.
- Repeated fall-back local times include the IANA zone and UTC offset so the
  two instants are distinguishable. Spring/fall DST and clock skew never reorder
  confirmed events.
- Filters are `all|task_created|task_completed|task_handoff`.
- `Load later events` appends one sealed keyset page, preserves focus and
  announces only that confirmed events were loaded. No total, page number,
  `x of y` or hidden-count inference exists.
- Distinguish loading, history unavailable, empty day, filter-empty, generic
  denied/not-found, Identity unavailable, Care unavailable, stale cursor,
  stale-labelled safe offline view, no-cache unavailable and recovery.
- An unavailable dependency is never rendered as an authoritative empty day.

## LB-014 handoff review and confirmation

- The task detail displays the safe task title, confirmed `open|completed`
  state, current accountable actor, expected version and current server
  confirmation time.
- Use one inline two-step flow, not a required modal.
- Step one contains a native authorized-target select and one enumerated reason:
  `availability_changed|schedule_conflict|coverage_update|other_coordination`.
  No text area or free-text note exists.
- Review repeats task, current actor, proposed actor, reason, expected version,
  validated IANA display zone and the statement that effect begins only when the
  server confirms.
- Cancel sends nothing and restores focus. Confirm submits once with CSRF,
  exact origin, idempotency and expected version.
- Accepted state is derived only from the durable response: new actor/version,
  server `occurredAt`/`effectiveAt`, matching timeline evidence and separate
  notification delivery state.
- Conflict retains the proposed intent as **unsent**, focuses a persistent
  heading, displays current confirmed state and requires reload plus fresh
  review.
- An uncertain result offers `Check current state`; there is no blind retry.
- Offline blocks mutation, creates no queue, does not auto-submit on reconnect
  and never shows success.
- Completed and any future cancelled state cannot enter the handoff mutation.

## Accessibility and responsive correction map

- Native date/select/radio/button controls, semantic chronology, one `h1`, skip
  link and logical heading order.
- Keyboard-only operation and visible, unobscured focus. No row-click-only,
  drag, swipe, hover or colour-only action.
- Relevant error/review/conflict/success headings are persistent focus
  destinations. Async refresh does not steal focus.
- Polite status announcements are bounded and not duplicated. Consequential
  failure uses `role=alert` only when immediate attention is required.
- Controls meet the 44 CSS px target goal. Content reflows at 320 CSS px and
  400% without clipping, two-dimensional scrolling or sticky-action overlap.
- Long VI/EN strings and text-spacing overrides wrap. Native automation covers
  contrast tokens, forced colours and reduced motion.
- Axe runs on success, empty, filter-empty, denied, conflict, unavailable,
  offline, stale and recovery states. Manual NVDA/Narrator, physical touch,
  full 400% assistive-technology and private-render review remain under
  `KI-016`/`KI-019`.

## Reject list

- Generated source, third-party CDN/font/tracker or custom timeline/date-picker
  implementation.
- `Clinical Clarity` or any patient/practitioner/medical framing.
- Placeholder dates, `ICT` or abbreviation-only zones, client-inferred
  authority/time, hidden local-day boundaries.
- Totals, page counts, raw IDs, cursors, stable sequences, tie-breakers or
  broad actor/member lists.
- Free-form handoff content, sensitive notification text, optimistic success,
  implied notification delivery, offline queue/replay or silent conflict
  overwrite.

## Planned versus actual deviation

Change ID: `CHG-2026-013`

- Planned: generate four references, independently review rendered authority,
  privacy and accessibility details, then freeze the redacted handoff.
- Actual: generation and direct exact-title/device read-back succeeded once.
  The independent reviewer could not discover the new private screens through
  its list view and returned a blocked visual disposition.
- Reason: private Stitch list/read visibility differed across callable reviewer
  sessions; retrying a write could create duplicates and is prohibited.
- Impact: private pixels provide no visual-conformance evidence. Production UI
  may proceed only from this stricter native correction map and executable
  contracts.
- Validation: exact per-screen read-back, four-title/device check, pre-generation
  independent audit, post-generation blocked disposition, no duplicate write,
  and later native axe/keyboard/reflow/privacy acceptance.
- Follow-up: perform one bounded independent private-render review when the
  provider exposes the exact screens; do not regenerate, persist locators or
  reopen the contract without a new reviewed Change ID.

## Freeze approvals

| Review                | Disposition                                          |
| --------------------- | ---------------------------------------------------- |
| Product and contract  | Frozen against `P3-S1-v1`                            |
| Authority and privacy | Frozen corrections; generated pixels unapproved      |
| Accessibility         | Frozen native requirements; manual evidence deferred |
| Implementation        | Native semantics only; generated source rejected     |
| Visual conformance    | Not claimed; `KI-019` retained                       |
