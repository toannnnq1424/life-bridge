# LifeBridge Accessibility Requirements

## Standard and scope

LifeBridge targets WCAG 2.2 Level AA for every public, authenticated, household, community, organization, moderation, administration, responsive, loading, empty, error, permission-denied, and offline experience.

Accessibility is a release requirement, not a visual-polish pass. Design review creates implementation requirements and evidence; only tested production behavior can support a conformance claim.

Automated checks detect regressions. They do not replace keyboard, screen-reader, zoom/reflow, contrast, cognitive, privacy, or usability review.

## Non-negotiable outcomes

- Complete every critical journey with keyboard alone.
- Use native semantics and accurate accessible names, roles, values, states, and relationships.
- Preserve all critical content and functionality at 320 CSS px, 200% zoom, and 400% reflow.
- Provide visible, unobscured focus in logical task order.
- Explain errors, loading, stale data, queued work, conflicts, permissions, consent, privacy, and emergency context in text.
- Never require color perception, sight, hearing, hover, dragging, path gestures, pointer precision, multi-touch, timed response, or a specific orientation.
- Protect credentials, personal data, care status, consent data, private identifiers, and protected-resource existence in visible and assistive output.
- Use synthetic data in Stitch prompts, prototypes, screenshots, design artifacts, and automated fixtures.

## Semantic structure

| Requirement        | Acceptance evidence                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Document title     | Unique, descriptive route title without unnecessary sensitive data                                              |
| Page heading       | One visible `h1`; logical heading hierarchy                                                                     |
| Skip link          | First keyboard destination; visibly focuses and moves to main content                                           |
| Landmarks          | Meaningful, named `header`, `nav`, `main`, complementary, search, and footer regions only where applicable      |
| Native HTML        | Buttons, links, fields, lists, tables, details, dialogs, and status elements use native semantics first         |
| Accessible names   | Every control, region, field, icon action, image, and disclosure has a concise purpose-accurate name            |
| Relationships      | Labels, hints, units, errors, descriptions, groups, headings, and table headers are programmatically associated |
| Programmatic state | Current, selected, expanded, invalid, required, disabled, busy, progress, sort, and status state exposed        |
| Language           | Document language and language changes identified; abbreviations explained where needed                         |
| Custom controls    | Role, name, value, state, keyboard model, focus behavior, and assistive-technology evidence documented          |

Requirements:

- DOM, visual, reading, and keyboard order remain coherent after responsive reflow.
- Use headings for structure, not styling.
- Use links for navigation and buttons for actions.
- Use lists for grouped tasks, timelines, results, and audit records where appropriate.
- Use tables only for real row/column relationships.
- Do not use ARIA to hide avoidable semantic defects.
- Do not add redundant roles or landmark noise.
- Do not use positive `tabindex`.
- Do not apply `aria-hidden` to focusable or meaningful content.
- Decorative images and visual design references remain outside the accessibility tree.

## Keyboard and focus

- Every function is reachable and operable by keyboard.
- No keyboard trap, hidden focus, hover-only action, drag-only action, swipe-only action, or timing-dependent critical path is permitted.
- Focus indicators remain persistent, sufficiently contrasted, and unobscured by sticky regions, banners, dialogs, browser chrome, or virtual keyboards.
- Meaningful route changes normally move focus to the main heading.
- In-place operations preserve focus when that better preserves task context.
- Failed form submission focuses a linked error summary when useful.
- Dialogs have a labelled title, safe initial focus, contained focus, safe Escape behavior, and focus restoration.
- Removing an item returns focus to a predictable safe successor.
- Asynchronous updates do not steal focus.
- Menus, disclosures, tabs, comboboxes, calendars, grids, and other composite widgets follow established keyboard patterns.
- Boards, calendars, uploads, tables, reorder controls, and drag-and-drop interactions provide complete non-drag alternatives.
- Virtualized content preserves truthful position, count, and focus; provide a non-virtualized alternative when semantic navigation cannot be preserved.

## Accessible names and instructions

- Accessible names match visible labels where practical.
- Icon-only controls have a contextual programmatic name and visible focus.
- Repeated links and actions remain distinguishable in context.
- Labels remain visible after fields contain data.
- Instructions identify required state, expected format, units, time zone, recurrence, constraints, privacy effect, and consequence where applicable.
- Instructions never depend only on color, shape, location, sound, motion, or gesture.
- Screen-reader-only text follows the same authorization and consent boundary as visible text.
- Page titles, labels, descriptions, alerts, status messages, alt text, and browser-history labels contain no unauthorized sensitive data.

## Forms, validation, and authentication

- Every field has a persistent visible programmatic label.
- Placeholder text is never the only label.
- Required and optional state is visible and programmatic.
- Validate after a meaningful user action; avoid noisy premature announcements.
- Validation identifies the field, problem, and correction.
- Error summaries state the problem, link to invalid controls, preserve safe valid input, and explain recovery.
- Errors never depend on color, motion, vibration, icon, or toast alone.
- Prevent duplicate submission while preserving the control’s accessible name and saving status.
- Destructive and irreversible actions name the target and consequence before confirmation.
- Autosave announces saving, saved, conflict, and failure. “Saved” follows confirmed persistence only.
- Password managers, autofill, password paste, and one-time-code paste remain available.
- Authentication, registration, MFA, recovery, and invitation errors do not enumerate accounts, channels, invitations, or enrollment state.
- MFA exposes invalid or expired challenge, resend cooldown, alternate approved method, lockout, and recovery safely.
- Avoid CAPTCHA and cognitive-function tests. If abuse controls require them, provide an equivalent accessible alternative.
- Time limits are absent unless essential; otherwise show remaining time, warning, extension, and recovery behavior.

## Dynamic content and announcements

- Announce meaningful changes with the least interruptive live-region behavior.
- Use assertive announcements only for newly introduced urgent or blocking feedback.
- Avoid duplicate announcements from native behavior, ARIA, toasts, and focused summaries.
- Loading identifies its scope; meaningful prolonged work exposes progress or status.
- Decorative skeletons remain hidden from assistive technology.
- Toasts are supplemental, dismissible, and never the sole carrier of critical information or action.
- Offline, stale, queued, blocked, conflicted, rejected, and confirmed states remain programmatically and visually distinct.
- Queued or failed work is never announced as completed.
- Responsive reflow, focus, and input do not cause unexpected context changes.

## Visual presentation

| Area                                  | Minimum requirement                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Normal text contrast                  | 4.5:1                                                                                                                  |
| Large text contrast                   | 3:1                                                                                                                    |
| Meaningful UI boundaries and graphics | 3:1 against adjacent colors where WCAG applies                                                                         |
| Focus contrast                        | 3:1 against adjacent colors; remains visible in forced colors                                                          |
| Critical dense care information       | Target 7:1 where practical                                                                                             |
| Text size                             | Base at least `1rem`; relative units; no critical text rendered only as an image                                       |
| Resize                                | 200% zoom without loss of content or functionality                                                                     |
| Reflow                                | 400% reflow without page-level two-dimensional scrolling, except deliberate data regions with an equivalent view       |
| Text spacing                          | No clipping, overlap, hiding, or lost controls with WCAG text-spacing overrides                                        |
| Target size                           | At least 24 × 24 CSS px or qualifying spacing; target 44 × 44 CSS px for common, primary, and safety-critical controls |
| Orientation                           | Portrait and landscape supported unless a documented essential exception exists                                        |
| Forced colors                         | Controls, boundaries, state, selection, and focus remain perceivable                                                   |
| Motion                                | Honor `prefers-reduced-motion`; no required meaning through motion alone                                               |
| Flashing                              | No seizure-risk flashing patterns                                                                                      |

Additional requirements:

- Meaning never relies on color alone.
- Do not disable browser zoom.
- Do not truncate emergency guidance, consent effects, medication units, ownership, due state, permission context, or recovery instructions.
- Do not place essential text over complex imagery without measured contrast-preserving treatment.
- Avoid adjacent destructive and primary actions; provide separation and confirmation.
- Token evidence covers default, hover, active, selected, disabled, focus, error, warning, success, emergency, light, dark, forced-color, and high-contrast states where supported.

Contrast records identify foreground token, background token, interaction state, measured ratio, tool or method, reviewer, and date.

## Responsive and input accessibility

Support equivalent critical outcomes using:

- Keyboard.
- Touch.
- Mouse.
- Switch input.
- Speech input.
- Screen readers.

Requirements:

- Preserve every critical function at 320 CSS px.
- Do not branch capability by user agent.
- Do not require hover, dragging, swiping, path gestures, multi-touch, precise pointer movement, or orientation.
- Preserve logical source and focus order across layouts.
- Virtual keyboards and sticky regions never obscure controls, errors, content, or focus.
- Long localized strings, user-generated content, bidirectional text, and text-spacing overrides reflow safely.
- Deliberately scrollable data regions have visible affordances and an equivalent accessible view.

## Complex interaction patterns

### Task boards

- Provide a complete semantic list alternative.
- Expose owner, due state, status, priority, and action as text.
- Assignment, ordering, and status changes work without dragging.
- Announce only confirmed changes; queued changes remain labelled queued.

### Calendars

- Provide a complete agenda/list equivalent.
- Expose date, time, time zone, event type, status, and selection.
- Date navigation and appointment actions work without swipe or pointer precision.

### Tables and charts

- Tables have captions, headers, associations, sort state, filters, and responsive alternatives.
- Charts have a textual summary and accessible source table or list.
- Screen position or color is never the only record identifier.

### Uploads and documents

- A file picker is always available; drag-and-drop is optional.
- Explain accepted types, limits, progress, processing, retention, access, failure, retry, and deletion.
- PDFs and downloads require accessibility review before being represented as accessible content.
- Unauthorized users cannot infer document names, metadata, existence, or download URLs.

### Media

- Prerecorded video has captions.
- Meaningful audio has a transcript.
- Meaningful visual-only content has an equivalent description.
- Unexpected audio does not autoplay.
- Auto-updating or animated content can pause, stop, or hide where required.

## Cognitive accessibility

- Use clear, direct, predictable language.
- Group related information and expose current step and progress.
- Keep recurring labels and action placement consistent.
- Avoid unexplained icons, dense acronyms, ambiguous labels, and artificial urgency.
- Explain purpose and consequence before destructive, consent, privacy, role, export, document, and emergency-plan actions.
- Preserve valid work after recoverable failure.
- Do not auto-submit, silently redirect, or reset forms unexpectedly.
- Distinguish user-supplied data from system-confirmed state.
- Never present tentative, queued, stale, rejected, or failed actions as completed.
- Accessibility preferences are optional, reversible where supported, and never an access gate.

## Care, medication, emergency, consent, and privacy

### Care and medication

- Expose owner, due state, time zone, units, recurrence, reminder state, acknowledgement, failure, and next action as text.
- Medication UI schedules and records reminders only.
- Do not diagnose, prescribe, recommend dosage, assess interactions, infer administration, or automate medical urgency.

### Emergency

- Urgency uses heading, explicit text, icon, and color together.
- Never imply diagnosis, medical prioritization, automated dispatch, guaranteed contact, or confirmed connection unless supported by actual confirmed state.
- Approved cached plans expose freshness and last confirmed synchronization.
- Critical emergency guidance remains understandable without color, animation, audio, or an image.

### Consent and privacy

- Explain affected data, audience or role, purpose, duration, effective timing, reversibility, and consequence before consent changes.
- Never preselect consent.
- Caregiver or organizer status does not silently override care-recipient consent.
- Permission-denied states do not reveal protected resource existence or sensitive details.
- Audit, organization, volunteer, and moderation views use minimum-necessary, role-scoped, redacted data.
- Accessibility metadata follows the same authorization boundary as visible content.

## State acceptance criteria

| State             | Accessibility acceptance                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Loading           | Scope named; meaningful delay announced; decorative skeletons hidden                                              |
| Empty             | Heading, cause, and permitted next action available in reading and focus order                                    |
| Error             | Persistent recovery text; relevant announcement; safe input retained; no implementation or protected-data leakage |
| Permission denied | Understandable boundary and safe destination; no protected-resource disclosure                                    |
| Offline           | Connectivity, freshness, blocked or queued work, last sync, retry, and conflict behavior exposed                  |
| Stale             | Source freshness and limitations exposed without claiming current data                                            |
| Queued            | Pending persistence explicit; no success announcement                                                             |
| Conflict          | Compared values and resolution controls understandable without color or spatial relation alone                    |
| Success           | Confirmed result announced without unnecessary focus movement                                                     |
| Emergency         | Explicit context and configured guidance available without color, motion, audio, diagnosis, or dispatch claims    |

## Screen-reader test matrix

Record OS, browser, assistive technology, versions, route, state, result, defect, and retest evidence.

| Platform                        | Screen reader | Browser                             |
| ------------------------------- | ------------- | ----------------------------------- |
| Windows                         | NVDA          | Current supported Chrome or Firefox |
| Windows                         | Narrator      | Current supported Edge              |
| iOS, when in delivery scope     | VoiceOver     | Safari                              |
| Android, when in delivery scope | TalkBack      | Chrome                              |

Unsupported rows require an explicit product decision. They must not be silently omitted.

## Design-review evidence

Each screen handoff records:

- Heading, landmark, list, table, and form structure.
- Keyboard sequence, focus order, initial focus, focus restoration, and visible-focus evidence.
- Accessible names, descriptions, field associations, and state announcements.
- Native elements and justification for every custom control.
- Contrast results for semantic token combinations and interaction states.
- 320 CSS px, 200% zoom, 400% reflow, text-spacing, orientation, and long-string results.
- Reduced-motion and forced-color/high-contrast results.
- Touch-target review.
- Loading, empty, error, permission-denied, offline, stale, queued, conflict, success, and emergency behavior.
- Board, calendar, table, dialog, upload, gesture, and drag alternatives where relevant.
- Privacy review of visible and programmatic text.
- Screen-reader results and known assistive-technology caveats.
- Defect severity, owner, target date, remediation, and retest evidence.
- Synthetic-data and artifact-secret review.

## Consolidated implementation testing

Write tests during implementation. Run them during the consolidated frontend campaign.

Required layers:

1. Semantic/component automated checks.
2. Route and state-fixture accessibility scans.
3. Keyboard-only critical-flow tests.
4. Focus-order and focus-restoration tests.
5. Screen-reader manual review.
6. 320 px, 200% zoom, 400% reflow, text-spacing, orientation, and responsive tests.
7. Color-contrast and design-token consistency tests.
8. Reduced-motion and forced-color/high-contrast checks.
9. Visual regression for focus, errors, offline, privacy, and urgent states.
10. Manual authentication, consent, privacy, care, medication, emergency, document, organization, and moderation review.
11. Assistive-technology regression retest for every fixed accessibility defect.

Automated success does not waive manual or privacy evidence. Pixel-perfect matching is not required when divergence improves accessibility, security, localization, resilience, or maintainability.

## Exit criteria and exceptions

A screen fails accessibility review if any critical path lacks:

- Keyboard operation.
- Visible and unobscured focus.
- Correct semantic naming and relationships.
- Sufficient contrast.
- Truthful dynamic and persistence state.
- Responsive reflow.
- An equivalent alternative to complex pointer interaction.
- Authorization-safe visible and assistive output.

No unresolved blocker or high-severity defect may remain in a frozen or releasable flow.

Every exception records:

```text
Screen/component:
WCAG criterion:
User impact:
Affected roles/devices:
Reason:
Accessible fallback:
Risk owner:
Approver:
Remediation:
Due date:
Review cadence:
Verification:
```

No exception may permit credential exposure, unauthorized disclosure, inaccessible emergency information, false persistence, or a critical workflow available only through pointer interaction.
