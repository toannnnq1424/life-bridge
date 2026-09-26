# LifeBridge Responsive Rules

## Principle

Responsive behavior follows content space, zoom, localization, input mode, and user preferences—not device identity. Every critical workflow remains available at every width. Larger layouts may improve context and density only.

Prefer native CSS reflow and container-aware layout. Do not branch product behavior by user agent or JavaScript viewport checks.

## Reference ranges

Ranges guide design review; implementation breakpoints occur where content no longer works.

| Range | Layout intent |
|---|---|
| `320–599 CSS px` | One-column priority flow; compact navigation; every critical capability retained |
| `600–899 CSS px` | One or two contextual regions when reading and focus order remain coherent |
| `900–1199 CSS px` | Persistent navigation or contextual panels allowed |
| `1200+ CSS px` | Constrained reading width; optional support pane; denser coordination only when relationships remain clear |

Test at minimum:

- 320, 375, 768, 1024, 1280, and 1440 CSS px.
- 200% browser zoom.
- 400% reflow equivalent.
- Portrait and landscape.
- Long localized strings.
- WCAG text-spacing overrides.
- Reduced motion.
- Forced colors or high-contrast mode.

## Global layout

- Preserve every critical workflow on mobile.
- Preserve logical DOM, reading, and keyboard order across reflow.
- Keep one visible `h1`, skip navigation, named landmarks, role context, connectivity state, and accessible control names.
- Reflow before reducing text, spacing, contrast, or target size.
- Avoid horizontal page scrolling at 320 CSS px. Deliberately scrollable data regions require a visible affordance and equivalent accessible view.
- Never require hover, dragging, swiping, pinching, precise pointer movement, or orientation for a critical action.
- Keep targets at least 44 × 44 CSS px or provide equivalent separation where practical.
- Do not lock scrolling content or dialogs to viewport height.
- Do not duplicate active focusable controls across responsive variants.
- Do not move a focused control during interaction.
- Sticky regions must not obscure headings, errors, content, virtual keyboards, or visible focus.
- Preserve route, valid input, filters, and task context when the viewport changes.
- Allow headings, labels, values, actions, user content, and status text to wrap.
- Never truncate emergency guidance, consent effects, medication units, error recovery, or other safety-critical meaning.
- Meaning must remain semantic; images and Stitch screenshots are references only.

## Content priority

1. Safety-critical status and emergency context.
2. Current task or decision.
3. Required controls and next permitted action.
4. Ownership, due state, consent, and permission context.
5. Supporting metadata.
6. Secondary navigation.
7. Optional summaries and analytics.

Lower-priority content may move, collapse behind a named disclosure, or become a separate route. It must not disappear when required to complete the task.

## App shell and navigation

| Region | Narrow layout | Expanded layout |
|---|---|---|
| Skip link | First focusable item; targets main content | Same |
| Primary navigation | Explicit labelled toggle; focus managed and restored | Persistent navigation allowed; current route exposed programmatically |
| Page header | Title, critical status, then actions in source order | Actions may align beside the title without changing source order |
| Connectivity | Persistent concise status with explicit details control | Same; utility-region placement allowed |
| Role context | Visible text or accessible label | Same; never avatar-only |
| Emergency entry | Consistent labelled entry; urgency not color-only | Same; prominence must not unpredictably displace navigation |

Collapsed navigation must be keyboard operable, labelled, closable with Escape when safe, focus-contained when modal, and return focus to its trigger.

Route changes normally move focus to the main heading. In-place operations retain focus when that better preserves context.

## Pattern behavior

| Pattern | Narrow behavior | Expanded enhancement |
|---|---|---|
| Dashboard | Priority-ordered sections; urgent state first | Grid or context pane using the same source priority |
| Task board | Semantic grouped list with explicit status controls | Visual columns allowed; list and keyboard controls remain |
| Calendar | Agenda/list view available and complete | Keyboard-operable grid plus agenda/details |
| Timeline | Single chronological flow with explicit dates and headings | Filters or detail pane allowed |
| Data table | Labelled record list or intentional labelled overflow with equivalent detail | Semantic table with caption, headers, sort state, and relationships |
| Form | One field column; labels above controls; error summary before fields | Independent fields may group when order and errors remain clear |
| Detail/editor | Read context before edit actions; destructive actions separated | Side-by-side context/editor only when source order remains logical |
| Filters | Visible active-filter summary and clear action | Persistent filter pane allowed |
| Dialog | Labelled full-page or sheet treatment only when focus and scrolling remain safe | Constrained dialog with stable context |
| Document vault | List/card view; file picker always available | Preview and optional drop zone; file picker remains |
| Emergency plan | Approved guidance, contacts, and stale/offline state first | Supporting context pane allowed |
| Organization/moderation | Queue item and safe action first | Queue/detail/audit split allowed within permission scope |

### Boards

- Drag-and-drop is optional.
- Assignment, ordering, and status changes require button, menu, or select alternatives.
- Announce confirmed changes.
- Keep queued changes labelled queued until persistence is confirmed.

### Calendars

- Agenda view remains available at every width.
- Date, time, time zone, event type, and status remain textual.
- Horizontal swipe is never the only date-navigation method.

### Tables

- Do not remove actor, action, timestamp, result, permission, consent, or safety-critical state merely to fit.
- Sort and filter controls remain programmatic and keyboard operable.
- Scrollable regions need captions, headers, visible overflow affordance, and reachable focus.

### Forms

- Required state, hints, validation, and errors remain visible and programmatically associated.
- Error summaries precede affected fields and link to them.
- Submit and safe-cancel controls remain reachable without crossing unrelated content.
- Password managers, autofill, and paste remain available unless a documented security requirement forbids them.

### Dialogs and overlays

- Required actions must not render beneath browser chrome, virtual keyboards, sticky controls, or zoomed content.
- Dialog content must remain labelled, scrollable, keyboard-contained, and dismissible where safe.
- Closing restores focus to the trigger or nearest safe successor.

## Input resilience

Support equivalent critical outcomes for:

- Keyboard.
- Touch.
- Mouse.
- Switch input.
- Speech input.
- Screen readers.

No critical behavior may depend solely on hover, path-based gestures, multi-touch, precise dragging, or visual position. Do not disable browser zoom.

Virtualized content requires stable focus, semantic position/count information, and a non-virtualized accessible alternative when necessary.

## Zoom, text, and localization

- At 200% zoom, navigation, labels, controls, errors, task status, and primary actions remain visible and operable.
- At 400% reflow, content uses one-dimensional scrolling except deliberate data regions with an equivalent view.
- Use relative units and intrinsic sizing.
- Avoid fixed-height containers for translated or user-generated content.
- Support increased line height, paragraph spacing, letter spacing, word spacing, and user-selected fonts.
- Use CSS logical properties where implementation supports bidirectional content.
- Expanded labels must remain understandable; abbreviations need an accessible full form.

## State behavior

Loading, empty, error, permission-denied, offline, stale, queued, conflicted, rejected, and confirmed states preserve the loaded screen’s shell and heading hierarchy.

- Loading identifies its region and does not fabricate data.
- Empty state explains the cause and one permitted next action.
- Error state retains safe input and exposes recovery without layout collapse.
- Permission-denied state does not reveal protected content or resource existence at wider widths.
- Offline state exposes last confirmed synchronization when known.
- Queued work never appears completed.
- Conflict state keeps comparison and resolution controls usable on narrow layouts.
- Transitions must not unexpectedly move primary actions or erase safe input.

Offline and emergency banners must:

- Remain visible without covering content or focus.
- Wrap without truncation.
- Use text plus icon and color.
- Distinguish stale, queued, blocked, conflicted, and confirmed state.
- Never claim fresh data, persistence, diagnosis, or dispatch without confirmation.

## Artifact handling

Imported Stitch references belong only under:

```text
docs/design/screenshots/
docs/design/exports/
docs/design/assets/
prototypes/stitch/<redacted-project-id>/
```

Optimize committed images. Do not embed credentials, production data, tokens, signed URLs, private links, or sensitive project identifiers in files, metadata, screenshots, or descriptions.

## Review evidence

Each screen handoff must record:

- Narrow, medium, and wide behavior.
- 320 CSS px result.
- 200% zoom and 400% reflow result.
- Portrait and landscape where relevant.
- Keyboard order and visible focus in compact and expanded layouts.
- Screen-reader landmarks, headings, names, relationships, and reading order.
- Long localization and text-spacing results.
- Reduced-motion and forced-color/high-contrast results.
- Loading, empty, error, permission-denied, and applicable offline states.
- Board, calendar, table, dialog, file-upload, and drag/drop alternatives where relevant.
- Soft-keyboard and sticky-element obstruction checks.
- Hidden or collapsed content inventory.
- Screenshot comparison against the frozen baseline.
- Every exception, rationale, owner, and remediation date.

Responsive review fails when a critical capability disappears, semantic and visual order conflict, focus is obscured, safety-critical text is truncated, state truth changes by width, or page-level horizontal scrolling is required.