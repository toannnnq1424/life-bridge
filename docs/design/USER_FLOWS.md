# LifeBridge User Flows

## Flow contract

Every flow must define:

- Actor, role, entry condition, exit condition, and safe cancellation path.
- Authorization, care-recipient consent, and minimum-data boundary.
- Loading, empty, validation, service-error, denied, stale, conflict, success, and applicable offline behavior.
- Whether mutations are blocked, queued, rejected, conflicted, or confirmed.
- Retained input and duplicate-submission prevention.
- End-to-end keyboard path, focus destination, and screen-reader announcements.
- Audit events for security-, privacy-, consent-, or safety-relevant actions.
- Mobile, tablet, desktop, zoom/reflow, reduced-motion, forced-color, localization, and long-content behavior.
- Synthetic test data only.

A screen must not imply persistence until confirmation arrives. Permission failures must not reveal protected record existence or contents. Irreversible actions require explicit confirmation naming the target and consequence.

API names remain `TBD` until architecture contracts exist. UI specifications must not invent backend behavior.

## F-01: Account access and recovery

```text
LB-001 Landing
→ LB-002 Login or LB-003 Registration
→ LB-004 MFA when required
→ LB-006 Onboarding when incomplete
→ last authorized destination or LB-011 Family dashboard

LB-002 Login
→ LB-005 Account recovery
→ generic confirmation
→ verified recovery path
→ LB-002 Login or LB-004 MFA
```

Rules:

- Never reveal whether an account, invitation, recovery channel, or MFA enrollment exists.
- Allow password-manager use, password paste, and one-time-code paste.
- Support invalid/expired challenge, resend cooldown, alternate approved factor, throttling, and lockout recovery.
- Preserve safe non-secret input after recoverable failure.
- Focus a linked error summary after invalid submission.
- Offline authentication is blocked with explanation; cached application data never bypasses authentication.
- Successful authentication uses only an authorized destination.
- Recovery tokens must not enter logs, analytics, screenshots, design artifacts, or task handoffs.

Screens: `LB-001`–`LB-006`.

## F-02: Household setup and invitation

```text
LB-006 Onboarding
→ LB-007 Accessibility onboarding
→ create household at LB-008
   or accept invitation at LB-009
→ LB-010 Care recipient profile
→ LB-028 Consent management
→ LB-011 Family dashboard
```

Rules:

- Accessibility preferences are optional, reversible, and never an access gate.
- Explain household ownership, role capabilities, invitation scope, visibility, and responsibility before commitment.
- Organizer status cannot silently bypass care-recipient consent.
- Capture only necessary profile information; distinguish profile data from consent grants.
- Expired, revoked, invalid, or unauthorized invitations disclose no private household detail.
- Save/resume drafts only with documented retention and deletion behavior.
- Household creation and invitation acceptance remain blocked or explicitly queued offline; never display false success.
- Audit creation, invitation, acceptance, revocation, role change, and consent change.

Screens: `LB-006`–`LB-011`, `LB-028`.

## F-03: Daily care coordination

```text
LB-011 Family dashboard
→ LB-012 Daily care timeline or LB-013 Task board
→ LB-014 Task detail
→ assign / start / complete / snooze / escalate / hand off
→ confirmed LB-011 and LB-012 state
```

Rules:

- Expose owner, due date/time zone, status, urgency, responsibility, and next permitted action as text.
- Use text, icon, and color together for urgency.
- Provide a semantic keyboard list equivalent to every drag-and-drop interaction.
- Reassignment and escalation require role and consent checks.
- Prevent duplicate submission without removing the control’s accessible name.
- Concurrent changes require comparison and deliberate resolution; never silently overwrite.
- Queued offline mutations remain labelled queued until confirmed.
- A handoff identifies completed, blocked, or escalated state and the next responsible party.
- Critical status remains visible in page content; notifications and toasts are supplemental.
- Audit assignment, reassignment, completion, escalation, and material status changes.

Screens: `LB-011`–`LB-014`, `LB-019`, `LB-032`–`LB-035`.

## F-04: Calendar and appointment coordination

```text
LB-011 Family dashboard or LB-012 Daily care timeline
→ LB-015 Calendar
→ LB-016 Appointment detail
→ view / update logistics / configure reminder / cancel
→ confirmed LB-015, LB-012, and LB-019 state
```

Rules:

- Provide a keyboard-operable agenda/list equivalent to the visual calendar.
- Expose locale, date format, local time, source time zone, and selection state.
- Preserve changed or canceled status in history.
- Require confirmation for cancellation or destructive changes.
- Return focus to the appointment or its safe successor after save/cancellation.
- Distinguish stale calendar data, queued changes, conflicts, failed reminders, and confirmed state.
- Audit material appointment and reminder changes.

Screens: `LB-011`, `LB-012`, `LB-015`, `LB-016`, `LB-019`.

## F-05: Care plan and medication reminders

```text
LB-010 Care recipient profile
→ LB-017 Care plan
→ create or revise goal, preference, and responsibility
→ review consent scope
→ confirmed plan version and review date

LB-017 Care plan
→ LB-018 Medication reminder schedule
→ validate user-supplied schedule
→ confirmed reminder state
→ LB-019 Notification center
```

Rules:

- Confirm authorization and consent before showing or editing protected fields.
- Display care-plan version, responsible party, change summary, and review date.
- Medication functionality schedules and records reminders only.
- Do not diagnose, prescribe, recommend dosage, assess interactions, infer administration, or automate clinical urgency.
- Explicitly label user-supplied medication details, units, recurrence, time zone, channel, acknowledgement, skipped/delayed state, and delivery failure.
- Preserve safe valid input after validation or service failure.
- Resolve concurrent plan, schedule, or consent revisions explicitly.
- Never report a reminder or acknowledgement as synchronized while queued or failed.
- Audit plan and medication-schedule creation, edit, disablement, and access-policy changes.

Screens: `LB-010`, `LB-017`–`LB-019`.

## F-06: Emergency readiness and use

Preparation:

```text
LB-020 Emergency contact list
→ LB-021 Emergency plan
→ review contact order, consent, local guidance, freshness, and offline availability
→ confirmed approved plan
```

Use:

```text
LB-011 Family dashboard or direct safe entry
→ LB-021 Emergency plan
→ read configured guidance
→ choose a configured contact or local emergency route
```

Rules:

- Never claim automated emergency dispatch, diagnosis, medical prioritization, or guaranteed contact.
- Use heading, explicit text, icon, and color together for urgent state.
- Reveal only permission-scoped contact and plan data.
- Clearly label cached plans, last confirmed synchronization, and stale risk.
- Keep an approved cached plan readable offline only when product architecture supports secure storage.
- Confirm contact removal, ordering, or plan changes and explain consequences.
- Audit plan, contact, consent, export, and access-policy changes. Ordinary reading is audited only when policy requires it.

Screens: `LB-011`, `LB-020`, `LB-021`, `LB-032`.

## F-07: Community help and volunteer matching

```text
LB-022 Help request
→ explain visibility, consent, eligibility, and cancellation
→ submit
→ pending review or match
→ LB-025 Volunteer matching
→ approve / accept / reassign / deliver / close

LB-024 Community directory
→ eligible service
→ LB-022 Help request or explicit external-contact confirmation

LB-026 Organization dashboard
→ scoped referral or matching work
→ LB-025 Volunteer matching
```

Rules:

- Collect and disclose minimum necessary location, timing, accessibility, contact, and task information.
- Show who can see each field before submission.
- Require explicit approval before revealing contact or precise-location details.
- Volunteer and organization views contain only role-authorized, consented data.
- Distinguish draft, pending, unavailable, denied, matched, revoked, withdrawn, expired, completed, and closed states.
- Offline submission is explicitly blocked or queued; local drafts never appear as submitted.
- Completion does not imply clinical outcome or independent safety verification.
- Audit submission, visibility, disclosure, match, acceptance, reassignment, withdrawal, and closure.

Screens: `LB-022`, `LB-024`–`LB-026`.

## F-08: Document lifecycle

```text
LB-023 Document vault
→ choose file
→ validate type, size, access, and retention
→ upload
→ process
→ available / rejected / unavailable
→ authorized view / download / export / delete
```

Rules:

- Always provide a file picker; drag-and-drop is optional.
- Explain accepted types, limits, progress, processing, retention, sharing, access scope, and recovery.
- Never expose document existence or metadata to unauthorized users.
- Do not mark a document available before confirmed processing.
- Distinguish unsupported, rejected, malware/processing failure, unavailable, denied, and offline states without exposing scanner internals.
- Preserve retryable metadata and file selection only where safe.
- Deletion names permanence, retention effect, and recovery limitations before confirmation.
- Audit upload, access-policy change, download/export where policy requires, and deletion.

Screen: `LB-023`.

## F-09: Consent, privacy, audit, and settings

```text
LB-031 Settings
→ LB-007 Accessibility preferences or LB-029 Privacy controls
→ review effect
→ save / reset / export / deletion request
→ confirmed, pending, or failed state

LB-010 Care recipient profile or LB-031 Settings
→ LB-028 Consent management
→ inspect current grants
→ grant / narrow / revoke / set expiry
→ review affected data, audience, and timing
→ confirmed policy state
→ LB-030 Audit history
```

Rules:

- Use plain language and minimum-disclosure defaults; never use hidden or preselected consent.
- Name affected people, data, recipients/roles, duration, effective timing, and consequence before commitment.
- Distinguish immediate changes from asynchronous export/deletion requests.
- Explain propagation delay only when the service contract supports it.
- Sensitive offline changes remain blocked unless a secure, auditable queue contract is approved.
- Concurrent consent or privacy revisions require explicit resolution.
- Accessibility settings work without pointer input and are reversible where supported.
- Audit consent, privacy, role, export, deletion, and sensitive-setting changes without reproducing protected values.
- Audit history itself is permission-scoped and redacted.

Screens: `LB-007`, `LB-010`, `LB-028`–`LB-031`.

## F-10: Organization, moderation, and administration

Organization:

```text
LB-026 Organization dashboard
→ scoped work queue
→ LB-025 Volunteer matching or exception action
→ auditable result
```

Moderation:

```text
LB-027 Admin moderation
→ inspect minimum necessary report
→ resolve / restrict / escalate / dismiss
→ confirmation
→ LB-030 Audit history
```

Rules:

- Enforce organization, moderator, and administrator scopes independently.
- Reveal sensitive details progressively and only when required for the decision.
- Separate unverified report content from established platform state.
- Require rationale and explicit confirmation for destructive or irreversible actions.
- Preserve safe filters and unsaved rationale after recoverable failure.
- Denied access and errors must not reveal restricted queue, report, household, or target details.
- Dense tables require semantic headers and responsive list alternatives.
- Return focus to the affected queue item or its nearest safe successor.
- Audit every moderation decision and privileged access according to policy.

Screens: `LB-025`–`LB-027`, `LB-030`.

## Global state transitions

```text
Any data route
→ LB-035 Loading state
→ target content
   or LB-033 Empty-state pattern
   or LB-034 Error-state pattern
   or permission-denied presentation

Any authenticated route
↔ LB-032 Offline state
→ stale read
   or explicit queue
   or blocked mutation
   or reconnect
→ confirmed / conflicted / rejected result
```

State patterns preserve:

- Originating route and understandable context.
- Valid input where safe.
- Available navigation and permitted recovery.
- Current focus or a deliberate focus destination.
- Truthful stale, queued, blocked, conflicted, rejected, and confirmed labels.

Route transitions normally move focus to the main heading. In-place operations retain focus when that better preserves context. Dialog closure restores focus to its trigger or nearest safe successor. Error summaries link to invalid fields. No critical action or information exists only in a toast.

## Design-generation order

1. Account access and recovery.
2. Household setup and consent.
3. Daily care coordination.
4. Calendar, care plan, and medication reminders.
5. Emergency readiness.
6. Consent, privacy, documents, and audit.
7. Community support and matching.
8. Organization and moderation.
9. Reusable loading, empty, error, denied, and offline patterns.

This order establishes authentication, permissions, consent, daily care, and safety-critical behavior before lower-priority operational screens.

## Freeze evidence per flow

Before design freeze, record:

- Product outcome and accountable owner.
- Screen and route mapping.
- Actor, role, permission, consent, and minimum-data rules.
- Entry, exit, alternate, cancellation, and recovery paths.
- Complete state matrix, including conflict and persistence semantics.
- End-to-end keyboard sequence and focus transitions.
- Accessible names, descriptions, live-region behavior, and announced changes.
- Mobile, tablet, desktop, 200% zoom, and 400% reflow evidence.
- Reduced-motion, forced-color/high-contrast, and token-contrast evidence.
- Localized long-string and text-spacing review.
- API dependencies and service-backed offline/conflict behavior.
- Redacted Stitch reference or local-wireframe source.
- Product, design, accessibility, privacy, security, and implementation approval.