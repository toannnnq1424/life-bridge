# LifeBridge Design System

## Status

Implementation-independent baseline. Not a Stitch export. Values and component specifications require design, accessibility, privacy, and implementation review before production use.

## Foundations

| Foundation | Requirement |
|---|---|
| Typography | Language-appropriate system sans-serif stack; base text at least `1rem`; relative units; browser zoom to 200% without lost content or controls |
| Spacing | 4 px scale: 4, 8, 12, 16, 24, 32, 48, 64 |
| Layout | Single-column mobile flow; constrained reading width; no critical action dependent on hover |
| Targets | At least 44 × 44 CSS px or equivalent target spacing where practical |
| Motion | Honor `prefers-reduced-motion`; no flashing; motion never required to understand state |
| Color | Semantic tokens only; meaning never conveyed by color alone |
| Contrast | WCAG 2.2 AA: 4.5:1 normal text; 3:1 large text, UI boundaries, and focus indicators; target 7:1 for critical dense care information |
| Focus | Persistent, unobscured, high-visibility keyboard indicator; minimum 2 px visual treatment |
| Icons | Actionable icons require programmatic names; icon-only controls require visible focus and contextual labels |
| Language | Plain, localizable text; no concatenated translation fragments; allow longer strings |
| Test data | No real care-recipient data in prompts, mockups, screenshots, exports, prototypes, or visual fixtures |

Prevent horizontal page scrolling at 320 CSS px except deliberately scrollable data regions with an accessible alternative.

## Semantic tokens

Final values require contrast evidence.

| Family | Tokens | Use |
|---|---|---|
| Surface | `surface-canvas`, `surface-default`, `surface-raised`, `surface-inverse`, `surface-disabled` | Pages, cards, dialogs, disabled regions |
| Text | `text-primary`, `text-secondary`, `text-muted`, `text-inverse`, `text-link` | Reading hierarchy and links |
| Border | `border-default`, `border-strong`, `border-focus`, `border-danger` | Grouping, focus, validation |
| Action | `action-primary`, `action-secondary`, `action-danger`, `action-disabled` | Interactive states |
| Status | `status-info`, `status-success`, `status-warning`, `status-danger`, `status-emergency` | Status treatment paired with text/icon |
| Care | `care-task`, `care-medication`, `care-appointment`, `care-document`, `care-community` | Categorization only; never sole state signal |
| Focus | `focus-ring`, `focus-ring-offset` | Keyboard focus |
| Overlay | `overlay-scrim`, `overlay-dialog` | Modal and blocking states |

Raw colors must not carry role-specific meaning in component contracts. Test light, dark, forced-color, and high-contrast presentations before design freeze.

## Component contracts

| Component | Required behavior |
|---|---|
| `AppShell` | Skip link first; named landmarks; responsive navigation; current route and role context exposed; persistent connectivity state |
| `PageHeader` | One visible `h1`; actions follow title in logical focus order |
| `Navigation` | Keyboard operable; `aria-current` where applicable; no hover-only disclosure; modal mobile menu manages and restores focus |
| `Button` | Native `<button>` for actions; visible focus; loading prevents duplicate submission without removing accessible name |
| `Link` | Native `<a>` for navigation; descriptive destination; distinguishable without color alone |
| `TextField` | Visible programmatic label; hint/error association; preserves valid input after failure |
| `PasswordField` | Paste allowed; rules visible; show/hide control exposes name and state |
| `Select` / `Combobox` | Native control preferred; custom control requires complete keyboard, name, role, value, and state behavior |
| `Checkbox` / `Radio` / `Switch` | Native control preferred; visible group/field labels; state readable without color |
| `Dialog` | Explicit trigger; labelled title; safe initial focus; contained focus; Escape when safe; return focus |
| `Toast` | Supplemental only; urgency-appropriate announcement; dismissible; never sole carrier of a critical result/action |
| `Alert` | Persistent heading, affected action, consequence, retained data, and recovery; assertive announcement only for newly injected urgent feedback |
| `StatusBadge` | Text plus icon/color; never color-only |
| `Card` / `ListRow` | Avoid nested controls inside a whole-row button; preserve separate target names and focus |
| `TaskCard` | Owner, due state, status, priority, and next action exposed as text |
| `TaskBoard` | Keyboard assignment/reordering alternative; drag-and-drop never required |
| `TimelineItem` | Date/time, event type, actor/owner, status, and destination exposed semantically |
| `Calendar` | Keyboard navigation plus equivalent agenda/list view; announce date and selection |
| `DataTable` | Caption, headers, sortable state, semantic relationships, and responsive alternative without hidden essential data |
| `FileUpload` | Accepted files, limits, processing, retention, access, and errors explained; visible alternative to drag/drop |
| `EmptyState` | Explain absence, filter, or permission cause; provide one permitted safe next step |
| `LoadingState` | Represent actual structure without false data; announce meaningful prolonged progress |
| `OfflineBanner` | Persistent connectivity, stale/queued state, last sync if known, retry, and conflict guidance |
| `PermissionDenied` | Explain capability boundary without leaking protected resource existence or details |
| `AuditEntry` | Timestamp/time zone, actor, action, target type, result, and redaction-aware detail |
| `DestructiveAction` | Name affected record and consequence; require intentional confirmation for irreversible operations |

## Screen state model

Every data-bearing screen specifies:

| State | Required behavior |
|---|---|
| Loading | Identify scope; retain context; disable only duplicate or invalid actions |
| Empty | Explain why no content exists and what may appear |
| Error | Identify failed action, retained data, and safe recovery |
| Permission denied | Explain role or consent boundary without sensitive inference |
| Offline | Distinguish stale, queued, blocked, and confirmed state; never claim unconfirmed persistence |
| Success | Confirm result and safe next step; offer reversal only when genuinely supported |
| Emergency | Name emergency context and configured local guidance; never imply diagnosis or automated dispatch |

## Forms

- Validate at an actionable boundary; avoid premature error announcements.
- On invalid submission, provide a linked error summary and focus it when useful.
- Required state must be visible and programmatic.
- Never use placeholder text as the only label.
- Correction text must be specific; color, shake motion, or icon alone is insufficient.
- Preserve input after validation, network, and service failures where safe.
- Confirm destructive or irreversible actions.
- Expose date format, time zone, recurrence, dosage units, and notification channel.
- Autosave must announce saving, saved, conflict, and failed states; “saved” only follows confirmed persistence.

## Responsive behavior

- Mobile retains every critical workflow; larger layouts improve density, not capability.
- Keep primary actions and navigation placement predictable.
- Reflow multi-column content before reducing text or targets.
- Convert boards and tables to equivalent semantic lists when width cannot preserve relationships.
- Support portrait/landscape orientation unless a documented safety need requires otherwise.
- Content and controls must survive long localized strings, text spacing overrides, and 400% reflow.

## Privacy and safety

- Show permission and consent context beside sensitive actions.
- Default community and volunteer views to minimum necessary personal data.
- Mask care and document details in summaries when full disclosure is unnecessary.
- Never reveal whether a protected resource exists to unauthorized users.
- Audit consent, invitation, export, role, emergency-plan, document-access, and deletion actions.
- Do not present automated medical urgency assessment, diagnosis, or emergency dispatch.
- Urgent states use explicit text, iconography, and color together.

## Review gate

A screen or component is implementation-ready only when:

- Semantic structure and accessible names are specified.
- Token combinations have contrast evidence.
- Keyboard behavior, focus order, and focus restoration are defined.
- Loading, empty, error, permission-denied, success, and applicable offline states are defined.
- Mobile, tablet, desktop, zoom, reflow, and long-content behavior are documented.
- Localization, privacy, consent, and permission rules are known.
- No generated dependency, script, tracking code, or unreviewed Stitch markup is required.