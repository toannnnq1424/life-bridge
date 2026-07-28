# P5-S1 Stitch Handoff — Consented Help Request and Community Directory

- Status: Frozen for corrected native-semantic implementation
- Date: 2026-07-28
- UI handoff: `P5-S1-UI-v1`
- Routes: `LB-022 /help/new`; `LB-024 /community`
- Architecture decision: ADR-019

## Gate and redacted provenance

The approved existing private LifeBridge Stitch project and its existing
repository-design-system direction were used. Before each write, the exact
title was confirmed absent. Four bounded synthetic generation writes completed
once; no uncertain write was retried. Every completed result was read back
exactly once with `get_screen`, which confirmed its exact title, device class,
dimensions, completed metadata, screenshot metadata and generated-source
metadata.

Prompts contained only generic categories, province/city granularity,
organization metadata and failure-state copy. No credential, private locator,
remote identifier, generated source, screenshot, real person, household, care
record, diagnosis, precise location or private contact is persisted here.
Nothing was deleted, exported, downloaded or executed.

| Repository alias       | Exact title                                                                            | Device/read-back                                  | Disposition                               |
| ---------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `P5S1-LB022-CURRENT`   | `LB-022 Help request — Draft, consent, submit and status — Desktop — P5-S1`            | Desktop; completed exact-title metadata read back | Reference only; generated source rejected |
| `P5S1-LB022-RECOVERY`  | `LB-022 Yêu cầu hỗ trợ — Từ chối, xung đột và phục hồi — Mobile — P5-S1`               | Mobile; completed exact-title metadata read back  | Reference only; generated source rejected |
| `P5S1-LB024-DIRECTORY` | `LB-024 Community directory — Public search, provenance and results — Desktop — P5-S1` | Desktop; completed exact-title metadata read back | Reference only; generated source rejected |
| `P5S1-LB024-RECOVERY`  | `LB-024 Danh bạ cộng đồng — Vị trí, ngoại tuyến và lỗi — Mobile — P5-S1`               | Mobile; completed exact-title metadata read back  | Reference only; generated source rejected |

Private rendered pixels were not independently inspectable through the
callable read-back surface. Metadata proves the four completed artifacts,
titles, device classes and artifact presence; it does not prove their visible
layout, contrast, reflow, focus, target size, language rendering or privacy
safety. This handoff therefore freezes corrected native semantics, not
standalone visual approval. KI-019 remains open. KI-016 continues to reserve
manual screen-reader, physical-device, text-spacing and assistive-technology
zoom evidence.

## Independent review result

The references are useful only as information-architecture prompts. Generated
content is not authoritative. In particular, the mobile directory output
invented specific historical review dates, a provenance source, organization
facts and a `Medical Support` category that the prompt did not authorize.
Another output invented a request reference and submission copy. All such
facts are rejected. Native UI may render only current authoritative contract
data or an explicitly marked synthetic test fixture.

The following generated directions are also rejected:

- side navigation, profile affordances or authenticated chrome on the public
  directory merely because the generator supplied them;
- a generic `other` field that becomes unbounded sensitive free text;
- hard-coded identifiers, counts, dates, review ages, organization details,
  contacts, sources, versions or cache times;
- `eligible`, `available`, `safe`, `urgent`, `matched`, `delivered`,
  `recommended`, `verified provider`, `approved` or endorsement wording unless
  the exact authoritative contract supports that specific non-inferred fact;
- skeleton rows that assistive technology could mistake for results;
- automatic geolocation, automatic retry, automatic refresh, timers,
  fabricated progress, infinite scroll, toast-only truth or auto-dismissed
  status;
- generated HTML, CSS, scripts, remote assets, tracking, external
  dependencies, business logic and hard-coded localization copy.

## Frozen product and authority boundary

`LB-022` creates and reads a protected Community help request. `LB-024` reads a
public directory. They share navigation and bounded taxonomy only; they do not
share authorization semantics.

- Public directory reads require no household, subject or consent context.
- Opening `LB-022`, reading a protected draft/request, submitting, checking an
  uncertain result, closing or deleting requires a fresh request-bound,
  purpose-scoped P2 Identity & Consent decision for that exact action.
- Household organizer/member status never proves care-recipient consent,
  subject authority or permission to disclose.
- Denial or revocation removes protected request facts from visible text,
  assistive-only text, document title, history state, announcements and
  recovery copy.
- The UI receives only minimum authorized display context. It must not invent
  Gateway, Identity & Consent or Community success.
- P5-S1 does not perform matching. It may say matching is unavailable in this
  slice; it must not show a match queue, volunteer, candidate, acceptance,
  delivery or outcome.

## Information architecture and focus order

Both routes use one responsive DOM/control set for all widths:

```text
skip link
→ compact header, route navigation and VI/EN control
→ one h1 and permanent purpose/limitations copy
→ route controls
→ authoritative results/status/recovery region
→ separate next-route link where applicable
```

`LB-022` keeps the visibility/purpose explanation and exact disclosure review
before the submit control. `LB-024` keeps provenance/freshness and the
informational-listing limitation before results. Public search and the
protected request call to action must not look like one atomic submission.

Loading updates are polite and do not move focus. Validation focuses a linked
summary. Denial, revocation, conflict, uncertain reconciliation, unavailable
and no-results outcomes focus one persistent result heading once. A user-
initiated retry returns focus predictably and never clears filters or an
authorized draft without contract evidence.

## LB-022 bounded form and disclosure review

The native form may collect only fields frozen by the versioned Community
contract. The UI shape is:

```text
bounded support category
province/city only
optional broad day-part preference
explicit visibility/purpose review
explicit unselected consent confirmation
idempotent submit action
```

No street address, GPS coordinate, diagnosis, treatment, medication, urgency,
eligibility explanation, safety assessment, match preference, organization
selection, precise schedule or free-form sensitive narrative belongs in
P5-S1. If the contract does not accept a field, the UI must not collect it.

Before submission, visible VI/EN copy must answer:

1. What minimum fields will be sent?
2. Why is Community processing them?
3. Who may see them at this stage?
4. How long are they retained and how can the requester close or delete them?
5. That no match, availability, response or outcome is promised.
6. That household role is not consent and current authority is checked again.

Consent is never preselected or bundled into a generic terms checkbox. Draft
editing cannot make a later submit decision stale: the exact disclosure
summary is reviewed immediately before the mutation.

## LB-022 authoritative states and recovery copy

| State                           | Native truth and action                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `draft`                         | Locally edited or server-confirmed draft is labeled with its actual authority and persistence source; it is not submitted.                  |
| `validation_failed`             | Linked field errors plus a focused summary; server validation overrides advisory client validation.                                         |
| `authority_denied`              | Protected details and existence are not disclosed; provide a safe return or new-decision path only.                                         |
| `consent_revoked`               | Stop protected processing/display, clear announcement residue and require a new authoritative decision.                                     |
| `submitting`                    | Disable duplicate activation, expose a real pending operation and make no durable claim yet.                                                |
| `duplicate_reconciled`          | Display the existing authoritative request returned for the same idempotency context; never claim a second request.                         |
| `version_conflict`              | Preserve only safe intent, load current authorized state, then require review before another mutation.                                      |
| `uncertain_result`              | Say the result is unknown; offer a fresh authorized status read using the same idempotency context, never a blind retry.                    |
| `submitted`                     | Render only after authoritative Community confirmation. Submission does not mean queued for matching, matched or delivered.                 |
| `pending`                       | Means Community owns a confirmed open request state only; it does not imply staff review, match activity or availability.                   |
| `closed`                        | Show authoritative closure and permitted next actions without claiming a service outcome.                                                   |
| `community_unavailable`         | Distinct from validation, denial, empty or closed; preserve safe input/intent according to the frozen retention contract.                   |
| `matching_unavailable_boundary` | Explain that matching is outside P5-S1; status viewing may remain available if Community confirms it.                                       |
| `offline_blocked`               | `Not sent; reconnect to submit.` / `Chưa gửi; hãy kết nối lại để gửi.`                                                                      |
| `offline_queued_local`          | Only with durable, authorized local evidence: `Saved on this device for later send.` Never `submitted`, `pending` or `queued by Community`. |

The production implementation may choose only `offline_blocked` if no
reviewed secure durable local queue exists. Merely retaining React state,
browser form values or an optimistic animation is not queue evidence.

## LB-024 public directory and minimum listing data

Search controls are bounded category, province/city and optional public
organization type. Location permission is optional. Denial collects no GPS or
precise location and immediately leaves manual province/city selection
operable.

One result may show only authoritative public metadata permitted by the
directory contract:

```text
public organization name
public organization type
province/city or reviewed public service area
bounded public support categories
organization-published public contact channel
reviewed accessibility-contact note, when present
provenance source label
authoritative last-reviewed time
current/stale provenance text
```

Individual names, household/request identifiers, private or inferred
locations, unpublished contacts, raw source payloads, internal notes, ranking
or match scores, hidden eligibility criteria, diagnoses and protected request
facts are excluded. A precise public service address is excluded from P5-S1
unless the frozen contract and reviewed provenance explicitly authorize it.

Every result region permanently states that listings are informational and do
not establish eligibility, availability, quality, safety, a match, a response,
an outcome or LifeBridge endorsement. Users contact an organization through
its confirmed public channel to verify current details.

## LB-024 search, provenance and failure states

| State                           | Native truth and action                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `loading`                       | Keep filters and purpose visible; expose a named busy region without fake result semantics.                          |
| `results_current`               | Show authoritative listings and per-listing provenance/review time.                                                  |
| `no_results`                    | Say no listings matched these filters; never say no eligible support exists. Offer safe filter changes.              |
| `location_denied`               | Say precise location was not collected; keep manual province/city controls. It is not an empty or error result.      |
| `provenance_stale`              | Show authoritative last-reviewed time and that details may have changed; never relabel cached rendering as current.  |
| `search_unavailable`            | Search failed; do not show an empty-result claim. Keep safe filters for a user-initiated retry.                      |
| `community_unavailable`         | Directory service is unavailable; distinct from search failure and no results.                                       |
| `offline_cached`                | Show only reviewed cached listings with source and cache age; label the entire region offline/stale.                 |
| `offline_no_trusted_cache`      | Say no trusted cached directory is available; do not manufacture rows or freshness.                                  |
| `matching_unavailable_boundary` | No matching action is present. Link to the separately protected request route only when route availability is known. |

No result count, timestamp, cache age, source or listing remains visible after
the authoritative response has invalidated it. Stale data may remain only when
the cache contract explicitly permits display and its age/source are retained.

## Privacy and minimum disclosure critique

- The help-request route must not place protected values in URLs, telemetry,
  analytics, console output, generic errors, page titles, browser storage or
  public directory queries.
- Structured logs and metrics use opaque correlation/state/category keys, not
  request text, location detail, contact data, authority tokens or listing
  payloads.
- Protected denial/revocation states reveal no hidden request count, request
  existence, category, location, version, timestamp or stale announcement.
- Public-directory cache keys must not encode household/request identity.
- Public contact actions are ordinary links or explicit external-contact
  actions. The UI never claims the person called, emailed, reached or received
  help.
- Synthetic fixtures use clearly fictional organization labels and neutral
  category/location codes, not plausible personal details or copied source
  microdata.

## Accessibility freeze

- One h1, skip link, named landmarks, native form controls/buttons and
  semantic results/status headings.
- `LB-022` uses `fieldset`/`legend`, programmatic labels, descriptions,
  `aria-describedby` only where needed and one linked error summary.
- `LB-024` uses a semantic list of articles with headings, definition lists
  and `<time datetime>` for authoritative provenance timestamps.
- Minimum target size is 44 by 44 CSS pixels. Focus is persistent and remains
  distinguishable in forced colors.
- Status combines explicit text, a recognizable icon and border/shape; color
  is never the only carrier.
- Critical truth is persistent, not toast-only. Live regions are bounded and
  cleared when authorization changes.
- At 320 CSS pixels and 400% reflow, one DOM/control set becomes one readable
  column with no page horizontal scroll. Long VI/EN labels, organization names,
  contacts and provenance wrap without clipping.
- Locale changes preserve route and safe state but never bypass a new
  authorization decision. Visible and assistive text use the same locale and
  authorization boundary.
- Reduced motion removes non-essential transitions. There is no pulse,
  parallax, auto-scroll, countdown, auto-dismiss or motion-only status.

Automated axe, keyboard, focus, reflow, contrast and reduced-motion checks are
required native evidence, not a WCAG-conformance, screen-reader or physical-
device claim. KI-016 remains until its manual rows are completed.

## Native implementation acceptance

Implementation may begin only after the versioned request, directory, failure
and authority contracts agree with this handoff. Native acceptance must prove:

1. VI/EN parity for every state and disclosure, without hard-coded generated
   facts.
2. A fresh P2 decision for every protected read/write/action and no such
   decision fabricated for public directory reads.
3. Server-authoritative validation, duplicate/idempotency, conflict and
   uncertain reconciliation truth.
4. Submitted/pending/closed claims only from authoritative Community state.
5. Location denial, no results, stale provenance/cache, search unavailable,
   Community unavailable and matching-boundary distinctions.
6. Offline queued-versus-blocked wording backed by actual durable evidence.
7. Keyboard-only completion and recovery, predictable focus, 320 CSS px/400%
   reflow, forced colors, contrast, 44 CSS px targets and reduced motion.
8. Privacy-safe logs, metrics, audit, browser state and tests with synthetic
   fixtures only.

Generated code copied to production: **No**. Generated scripts executed:
**No**. Remote artifact imported: **No**. KI-019 is retained until private
pixels or the corrected native implementation receive a bounded independent
visual review.
