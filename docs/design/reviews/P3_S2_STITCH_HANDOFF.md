# P3-S2 Stitch handoff — Calendar and appointment coordination

Status: **Frozen for native semantic implementation with KI-019 retained**

Version: `1.0`

Date: `2026-07-27`

Scope: `LB-015` calendar plus equivalent agenda and `LB-016` appointment
create, change, review, cancellation, and recovery. This handoff does not
authorize P3-S3, DATA, P4, P5, deployment, or release work.

## Evidence and review disposition

Four synthetic references were generated once in the existing private
LifeBridge project with the active `Emerald & Azure Modern` design system:

- `LB-015 Calendar + equivalent agenda — Desktop — P3-S2`
  (`DESKTOP`, reported `2560 × 2048`)
- `LB-015 Calendar + equivalent agenda — Mobile — P3-S2`
  (`MOBILE`, reported `780 × 3356`)
- `LB-016 Appointment create/change/review — Desktop — P3-S2`
  (`DESKTOP`, reported `2560 × 2472`)
- `LB-016 Appointment detail/cancel/recovery — Mobile — P3-S2`
  (`MOBILE`, reported `780 × 2372`)

Direct one-time read-back confirmed each exact redacted title, device class,
dimensions, screenshot presence, and generated-source presence. No remote ID,
project locator, signed URL, screenshot, generated HTML/CSS/source, or
credential is recorded or imported.

The independent post-generation reviewer returned **not independently visually
approvable** because private pixels were unavailable to that reviewer. The
reviewer confirmed that existence metadata cannot establish visual fidelity,
design-system conformance, responsive quality, contrast, focus visibility,
touch targets, reflow, VI/EN quality, privacy-safe pixels, or generated-markup
safety. Generated HTML is rejected as semantic or implementation authority.
No visual-conformance claim is made and `KI-019` remains open.

This handoff is Frozen because the corrected structural requirements below,
not the generated pixels or source, are authoritative for native
implementation. Automated and real-browser evidence must prove them.

## Contract, authority, and privacy corrections

1. Every read or mutation begins with a fresh, permission-specific Identity &
   Consent decision:
   `coordination.calendar.read`,
   `coordination.appointment.create`,
   `coordination.appointment.change`, or
   `coordination.appointment.cancel`.
2. Organizer, caregiver, or member status never substitutes for the accepted
   P2 purpose-scoped consent boundary. Gateway composes; Care Coordination
   verifies and owns durable truth.
3. The UI uses only structured appointment kind and logistics values. It
   contains no free-form title, note, address, clinical content, broad roster,
   or protected conflict details.
4. Generic denied and not-found states disclose no household, recipient,
   appointment, member, conflict owner, or hidden count.
5. Confirmed appointment state is separate from reminder-intent acceptance.
   The UI never claims notification delivery.

## LB-015 calendar and equivalent agenda

- One visible `h1`, named landmarks, a native labelled local-date control, and
  Previous, Today, and Next actions.
- Display the selected local date, validated display IANA zone, inclusive UTC
  day start, exclusive UTC day end, filter, coverage state, and server
  confirmation time.
- The calendar grid is an enhancement. The semantic agenda is a complete,
  keyboard-operable path and contains every critical fact for each item:
  status, structured kind, logistics, UTC instant, source local time, numeric
  offset, source IANA zone, duration, recurrence occurrence/count/final local
  date, occurrence-only scope, reminder-intent state, version, and last change.
- Use stable server ordering `(startsAtUtc, appointmentId)`. Repeated fall-back
  local times remain distinguishable by offset and zone.
- Distinguish loading, empty day, filter-empty, history unavailable,
  generic denied/not-found, service unavailable, offline/no-cache,
  stale-labelled retained view, conflict, and recovery. An unavailable
  dependency is never rendered as an authoritative empty day.

## LB-016 create, change, cancellation, and recovery

- Use native labelled date, time, duration, zone, offset, ambiguity policy,
  recurrence, appointment-kind, logistics, and reminder-intent controls.
- Server review repeats the resolved UTC instant, source local time, numeric
  offset, IANA zone, duration, recurrence boundary, and occurrence-only
  mutation scope before confirmation.
- Recurrence is finite weekly occurrence materialization only. No
  this-and-following or silent series mutation exists.
- Confirm sends once with exact origin, CSRF, idempotency, and expected version.
  An uncertain result offers `Check current state`; there is no blind retry.
- Stale-write recovery preserves entered choices as unsent, focuses a useful
  persistent heading, shows current confirmed state, and requires reload plus
  fresh review.
- Conflict exposes only the safe occupied UTC interval and recovery action.
  Offline blocks mutations, creates no queue, and never auto-submits.
- Cancellation uses an explicit review step, keeps cancelled history visible,
  confirms occurrence-only scope, and reports reminder-intent cancellation
  separately from durable appointment cancellation.

## Accessibility and responsive correction map

- Native semantic controls, one `h1`, skip link, logical headings, visible and
  unobscured focus, and no row-click-only, drag, swipe, hover, or colour-only
  action.
- Calendar grid implements the WAI-ARIA date-grid keyboard model only as an
  enhancement; agenda parity is mandatory.
- Focus moves to a useful heading after navigation, success, conflict, denial,
  or recovery. Async status uses bounded announcements without focus theft.
- Controls meet the 44 CSS px target goal. Content reflows at 320 CSS px and
  400% without page-level horizontal scrolling or sticky overlap.
- VI/EN copy, text-spacing overrides, forced colours, contrast tokens, and
  reduced motion are covered by native tests.
- Axe and keyboard tests cover success, empty, filter-empty, denied, conflict,
  unavailable, cancelled, offline, stale, and recovery states.
- Manual NVDA/Narrator, physical touch, full 400% assistive-technology, and
  private-pixel review remain under `KI-016`/`KI-019`.

## Reject list

- Generated source, private artifact import, third-party CDN/font/script,
  tracker, or custom non-semantic control.
- Medical framing, real names, care records, free-form sensitive content,
  address, credential, private locator, raw authority decision, or broad
  membership data.
- Client-inferred UTC, IANA, DST overlap/gap, recurrence, conflict, authority,
  success, or reminder delivery.
- Truncated agenda facts, colour-only status, hidden time-zone boundary,
  implicit series mutation, optimistic success, offline queue/replay, blind
  retry, or silent conflict overwrite.

## Planned versus actual deviation

Change ID: `CHG-2026-014`

- Planned: generate four P3-S2 references, independently review their pixels,
  then freeze a redacted handoff.
- Actual: all four references were generated and read back once. The
  independent reviewer could review sanitized metadata and the correction map,
  but could not inspect private pixels.
- Reason: private-pixel access is not available across independent reviewer
  sessions; retrying writes or persisting locators/source is prohibited.
- Impact: generated pixels provide no visual-conformance evidence. Production
  UI proceeds only from this stricter native correction map and frozen
  executable contracts.
- Validation: four exact-title/device/dimension read-backs, independent
  pre-generation audit, independent post-generation blocked disposition, no
  duplicate writes, and required native axe/keyboard/reflow/privacy tests.
- Follow-up: perform one bounded independent private-render review when the
  provider exposes the exact screens. Do not regenerate or weaken the frozen
  requirements.

## Freeze approvals

| Review                | Disposition                                          |
| --------------------- | ---------------------------------------------------- |
| Product and contract  | Frozen against `P3-S2-v1`                            |
| Authority and privacy | Frozen corrections; generated pixels unapproved      |
| Accessibility         | Frozen native requirements; manual evidence deferred |
| Implementation        | Native semantics only; generated source rejected     |
| Visual conformance    | Not claimed; `KI-019` retained                       |
