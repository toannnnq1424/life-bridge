# LifeBridge Screen Handoff: `LB-XXX`

Copy to:

```text
docs/design/reviews/<SCREEN-ID>.md
```

Use synthetic data only. Never include credentials, tokens, cookies, signed URLs, private credential-bearing links, production identifiers, real personal/care data, or unredacted private Stitch identifiers.

## Control

```text
Screen ID:
Screen name:
Status: Not started
Version:
Owner:
Last updated:
Product requirement:
User journey / flow ID:
Target route:
API dependencies:
Permission requirements:
Loading state:
Empty state:
Error state:
Offline behavior:
Review status:
```

Allowed status values:

```text
Not started
Flow drafted
Design review
Accessibility review
Frozen
Implemented
```

`Frozen` requires every applicable contract and approval below, no blocking `TBD`, and no unresolved blocker/high-severity accessibility, security, privacy, or data-integrity defect. `Implemented` additionally requires approved production source and consolidated test evidence.

## Journey

```text
Primary outcome:
Primary actor:
Secondary actors:
Role:
Entry conditions:
Exit conditions:
Success destination:
Alternate paths:
Safe cancellation path:
Recovery path:
Related screen IDs:
```

## Authorization, consent, privacy, and audit

```text
Required permission:
Resource scope:
Action scope:
Authorization decision point:
Care-recipient consent required: Yes / No / Not applicable / TBD
Consent purpose:
Consent audience or role:
Consent duration and effective time:
Minimum necessary data:
Protected or redacted fields:
Data classification:
Permission-denied behavior:
Not-found behavior:
Audit events:
Retention or deletion implications:
```

Permission-denied, not-found, error, visible, and assistive output must not reveal protected-resource existence, protected values, or private identifiers.

No role—including organizer, caregiver, volunteer, organization, moderator, or administrator—silently bypasses authorization or care-recipient consent.

## Design source and artifact provenance

```text
Design source: Local wireframe | Stitch reference | Approved prototype
Stitch project reference: None | Unavailable | Redacted reference
Stitch screen reference: None | Unavailable | Redacted reference
Reference artifact:
Artifact type:
Storage path:
Retrieved or created:
Source tool:
Tool classification: Read | Write
Prompt/data classification:
Reviewer:
Synthetic data confirmed: Yes / No
Metadata checked: Pass / Fail
Secret/private-URL scan: Pass / Fail
External assets reviewed:
Generated scripts reviewed:
Generated dependencies reviewed:
License or usage status:
Approved extracted intent:
Rejected generated content:
```

Stitch output is untrusted reference material. Do not copy generated HTML, CSS, scripts, runtimes, tracking, CDN dependencies, placeholders, or inaccessible markup into production.

## Information architecture and semantics

```text
Document title:
Visible h1:
Skip-link target:
Landmarks:
Heading outline:
Primary task:
Secondary tasks:
Critical safety context:
Navigation context:
Lists:
Tables:
Forms:
Dialogs or sheets:
Live regions:
Status messages:
Source/reading/focus order:
Information priority at narrow width:
Information priority at wide width:
Hidden, moved, or collapsed content:
```

Use native HTML first. For every custom control, document why native HTML is insufficient plus role, name, value, state, keyboard model, focus behavior, and test evidence.

## Required components

| Component or native element | Purpose | Semantic basis | Existing/reuse decision | Contract status |
|---|---|---|---|---|
| `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |

Repeat this contract for each approved reusable or complex component:

```text
Component:
Purpose:
Consumers:
Native semantic basis:
Inputs:
Outputs and events:
Accessible name and description:
States:
Keyboard behavior:
Focus behavior:
Responsive behavior:
Localization behavior:
Permission and consent assumptions:
Error and persistence semantics:
Data classification:
Synthetic fixtures:
Automated checks:
Manual checks:
Known limits:
Owner:
```

Prefer native markup and existing project components. Add an abstraction only for repeated approved semantic behavior or one independently testable complex control.

## Content and localization

```text
Localization namespace:
Visible copy keys:
Assistive copy keys:
Pluralization:
Date/time/time-zone formatting:
Number and unit formatting:
Long-string result:
Text-spacing result:
Bidirectional-content result:
Plain-language result:
User-generated content handling:
Untranslated copy:
Hardcoded generated copy removed: Yes / No
```

Do not concatenate translated sentences. Labels, hints, units, errors, statuses, dialogs, empty states, recovery text, and announcements require localization keys before implementation.

## API, service, and persistence contract

```text
Service owner:
Operation:
Request contract:
Response contract:
Authorization enforcement:
Consent enforcement:
Data classification:
Pagination/filter/sort:
Validation:
Rate-limit behavior:
Not-found and denied disclosure:
Conflict/version behavior:
Idempotency:
Timeout/retry behavior:
Offline/cache/queue behavior:
Audit event:
Synthetic fixture:
Contract version:
```

Persistence semantics:

```text
Draft:
Saving:
Confirmed:
Failed:
Stale:
Offline blocked:
Offline queued:
Rejected:
Conflict:
Reconnect behavior:
```

A service-critical `TBD` blocks production implementation. The client must not infer authorization, consent, persistence, delivery, medication state, emergency dispatch, or audit completion from local state.

## State matrix

| State | Trigger/source | Visible behavior | Programmatic behavior | Keyboard/focus behavior | Persistence truth | Recovery |
|---|---|---|---|---|---|---|
| Loading | `TBD` | Scoped truthful progress | `TBD` | `TBD` | No data or persistence implied | `TBD` |
| Empty | `TBD` | Cause and one permitted action | `TBD` | `TBD` | N/A | `TBD` |
| Validation error | `TBD` | Field, problem, correction | Linked error relationships | Linked error summary | Safe input retained | `TBD` |
| Service error | `TBD` | Safe non-sensitive recovery | `TBD` | `TBD` | No false success | `TBD` |
| Permission denied | `TBD` | Boundary without disclosure | `TBD` | `TBD` | N/A | Safe destination |
| Not found | `TBD` | Non-disclosing result | `TBD` | `TBD` | N/A | Safe destination |
| Offline blocked | `TBD` | Blocked action explicit | `TBD` | `TBD` | Not persisted | `TBD` |
| Offline queued | `TBD` | Queue state explicit | `TBD` | `TBD` | Queued, not confirmed | `TBD` |
| Stale | `TBD` | Freshness and limitations | `TBD` | `TBD` | Not current unless confirmed | `TBD` |
| Conflict | `TBD` | Compare and resolve | `TBD` | `TBD` | Unresolved | `TBD` |
| Rejected | `TBD` | Rejection and safe recovery | `TBD` | `TBD` | Rejected | `TBD` |
| Confirmed success | `TBD` | Confirmed result and next action | `TBD` | `TBD` | Service-confirmed only | `TBD` |
| Emergency, if applicable | `TBD` | Explicit text, icon, and color | `TBD` | `TBD` | No diagnosis/dispatch claim | `TBD` |

Add applicable `cancelled`, `expired`, `revoked`, `processing`, or `unavailable` rows. Remove a state only with a documented rationale. Critical information never exists only in a toast.

## Interaction and forms

```text
Primary action:
Secondary actions:
Destructive or irreversible actions:
Confirmation target and consequence:
Safe cancel:
Duplicate-submission prevention:
Field labels, hints, and units:
Required/optional rules:
Validation timing:
Error summary:
Retained safe input:
Autocomplete/password-manager behavior:
Paste behavior:
Timeout, warning, extension, and recovery:
```

## Responsive behavior

| Condition | Required behavior | Evidence |
|---|---|---|
| 320 CSS px | `TBD` | `TBD` |
| 375 CSS px | `TBD` | `TBD` |
| 768 CSS px | `TBD` | `TBD` |
| 1024 CSS px | `TBD` | `TBD` |
| 1280 CSS px | `TBD` | `TBD` |
| 1440 CSS px | `TBD` | `TBD` |
| 200% zoom | `TBD` | `TBD` |
| 400% reflow | `TBD` | `TBD` |
| Portrait | `TBD` | `TBD` |
| Landscape | `TBD` | `TBD` |
| Long localized strings | `TBD` | `TBD` |
| Text-spacing override | `TBD` | `TBD` |
| Reduced motion | `TBD` | `TBD` |
| Forced colors/high contrast | `TBD` | `TBD` |
| Soft keyboard/sticky regions | `TBD` | `TBD` |

Record source, reading, and keyboard order; moved/collapsed content; page and region overflow; plus alternatives for boards, calendars, tables, charts, uploads, dialogs, drag/drop, gestures, and virtualized data.

Every critical capability remains available at every width. No critical behavior may require hover, drag, swipe, pinch, pointer precision, multi-touch, timing, or orientation.

## Accessibility behavior

```text
WCAG target: 2.2 AA
Initial focus:
Keyboard sequence:
Route-change focus:
In-place update focus:
Error-summary focus:
Dialog focus and restoration:
Focus after delete/remove:
Visible-focus evidence:
Accessible names and descriptions:
Label/hint/error relationships:
Required/invalid/busy/progress states:
Screen-reader reading order:
Live-region and status announcements:
Non-pointer alternatives:
Target-size evidence:
Contrast token evidence:
Color/shape/icon/text equivalence:
Reduced-motion result:
Forced-color/high-contrast result:
Assistive-technology result:
Assistive-technology caveats:
Privacy review of assistive text:
```

## Test fixtures and evidence

```text
Synthetic fixture provenance:
Synthetic roles:
Permission cases:
Consent cases:
Data classification:
Loading fixture:
Empty fixture:
Error fixture:
Denied fixture:
Offline/stale fixture:
Conflict fixture:
Confirmed fixture:
Contract test paths:
Component test paths:
Route/state test paths:
Keyboard/focus test paths:
Visual test paths:
Responsive test paths:
Accessibility test paths:
Security/privacy test paths:
Manual review paths:
Consolidated campaign reference:
```

Tests are written during implementation and run during the consolidated frontend campaign.

## Design review

```text
Frozen baseline:
Visual hierarchy:
Interaction model:
Responsive behavior:
Design-token usage:
State coverage:
Comparison artifact:
Divergences:
Reason for each divergence:
Approved divergences:
Open defects:
Reviewer:
Date:
Decision:
```

Visual similarity cannot override accessibility, security, privacy, localization, resilience, authorization, consent, service contracts, or maintainability.

## Accessibility review

```text
WCAG criteria reviewed:
Automated scan result:
Manual keyboard result:
Manual screen-reader result:
OS/browser/assistive-technology versions:
Zoom/reflow result:
Text-spacing result:
Contrast result:
Reduced-motion result:
Forced-color/high-contrast result:
Cognitive/usability result:
Open defects:
Exceptions:
Reviewer:
Date:
Decision:
```

## Privacy and security review

```text
Authorization result:
Consent result:
Minimum-disclosure result:
Non-enumeration result:
Sensitive visible-text result:
Sensitive assistive-text result:
Artifact/metadata secret scan:
Unsafe URL result:
Tracking/external dependency result:
Generated code/dependency result:
Audit result:
Destructive-action result:
Open defects:
Privacy reviewer:
Security reviewer:
Date:
Decision:
```

## Implementation task

```text
Implementation task:
Target application/package:
Target branch:
Source paths:
Fixture paths:
Test paths:
Dependencies:
Feature flag:
Out of scope:
Blocked by:
Implementation owner:
Target milestone:
```

Do not add dependencies until native platform features, standard library, existing project components, and installed packages are insufficient.

## Exceptions

```text
Exception ID:
Screen/component:
Requirement or WCAG criterion:
User impact:
Affected roles/devices:
Reason:
Accessible fallback:
Risk:
Risk owner:
Approver:
Remediation:
Due date:
Review cadence:
Verification:
```

No exception may permit credential exposure, unauthorized disclosure, inaccessible emergency information, false persistence, or a critical pointer-only workflow.

## Approval gates

| Gate | Reviewer | Status | Evidence | Date |
|---|---|---|---|---|
| Product | `TBD` | Pending | `TBD` | `TBD` |
| UX/flow | `TBD` | Pending | `TBD` | `TBD` |
| Design | `TBD` | Pending | `TBD` | `TBD` |
| Responsive | `TBD` | Pending | `TBD` | `TBD` |
| Accessibility | `TBD` | Pending | `TBD` | `TBD` |
| Privacy | `TBD` | Pending | `TBD` | `TBD` |
| Security | `TBD` | Pending | `TBD` | `TBD` |
| Service/API | `TBD` | Pending | `TBD` | `TBD` |
| Implementation | `TBD` | Pending | `TBD` | `TBD` |

## Freeze checklist

- [ ] Product requirement, owner, journey, route, entry, exit, cancellation, and recovery approved.
- [ ] Role, authorization, consent, minimum disclosure, audit, retention, denied, and not-found behavior approved.
- [ ] Artifact provenance is redacted, reviewed, licensed, synthetic, and secret-free.
- [ ] Semantic structure, components, localization, interaction, state matrix, and persistence truth are complete.
- [ ] Service contracts resolve every blocking `TBD`.
- [ ] Mobile, tablet, desktop, zoom/reflow, orientation, long-string, and text-spacing evidence passes.
- [ ] Keyboard, focus, screen-reader, contrast, target-size, reduced-motion, and forced-color evidence passes.
- [ ] Loading, empty, validation, service-error, denied, not-found, offline, stale, queued, blocked, conflict, rejected, confirmed, and applicable emergency behavior passes.
- [ ] Synthetic fixtures and test plan are approved.
- [ ] No blocker or high-severity accessibility, security, privacy, or data-integrity defect remains.
- [ ] Product, UX/flow, design, responsive, accessibility, privacy, security, service/API, and implementation gates pass.

## Freeze decision

```text
Decision: Not frozen
Status:
Open blockers:
Open high-severity defects:
Approved exceptions:
Design baseline reference:
Risk owner:
Approver:
Decision date:
```
