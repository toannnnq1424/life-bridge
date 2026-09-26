# P3-S3 Stitch handoff — Versioned support-plan review

Status: **Frozen for native semantic implementation with KI-019 retained**

Version: `1.0`

Date: `2026-07-27`

Scope: `LB-017` current, draft, confirmed history, review date, and truthful
recovery. This handoff does not authorize DATA-S1, P4, P5, deployment, or
release work.

## Evidence and disposition

Four synthetic references were generated once in the existing private
LifeBridge project with the active Emerald & Azure Modern design system:

- `LB-017 Care Plan Current + History — Desktop — P3-S3` (`DESKTOP`, reported
  `2560 × 2858`)
- `LB-017 Kế hoạch chăm sóc hiện tại + lịch sử — Mobile — P3-S3` (`MOBILE`,
  reported `780 × 2638`)
- `LB-017 Care Plan Draft + Review — Desktop — P3-S3` (`DESKTOP`, reported
  `2560 × 2048`)
- `LB-017 Care Plan Failure + Recovery States — Mobile — P3-S3` (`MOBILE`,
  reported `780 × 4018`)

One-time read-back confirmed exact title, device class, dimensions, screenshot
presence, and generated-source presence. No remote ID, locator, signed URL,
screenshot, generated source, or credential is recorded or imported.
Generated source is rejected as implementation authority. Independent private
pixel inspection remains unavailable, so visual conformance is not claimed and
`KI-019` remains open. “Care Plan” in generated titles is provenance only;
product-facing copy is **Kế hoạch hỗ trợ / Support plan**. Native executable
requirements below are authoritative.

## Authority, lifecycle, and privacy corrections

1. Every read/write begins with a fresh action-specific P2 Identity decision.
   Organizer/member/caregiver status never substitutes for care-recipient
   consent. Gateway composes; Care owns durable truth.
2. Current version, shared draft revision, aggregate revision, draft base
   current version, and confirmed history are visibly distinct. A draft is
   never labelled current and success is shown only after server confirmation
   plus a fresh read.
3. Editing uses bounded structured coordination statements/categories and
   only responsibility actors eligible in the fresh decision. It includes no
   diagnosis, treatment, medication, urgency, recommendation, contact,
   location, attachment, or arbitrary metadata.
4. Edit → inline review → Make current sends once with exact Origin, CSRF,
   idempotency, and expected aggregate/draft/base versions. Conflict preserves
   unsent choices as unsent, reloads current, and requires fresh review.
5. An uncertain result offers `Check current state`, never blind retry. Offline
   is read-only and creates no queue. Generic denial does not reveal existence,
   actors, consent, history depth, or totals.
6. Review date is displayed as local date plus IANA zone and server-resolved
   inclusive/exclusive UTC bounds. Upcoming/due/overdue is non-clinical and
   server-derived. Changing it creates a new confirmed version.
7. History is bounded confirmed versions only, reverse-version ordered, and
   rendered as a semantic ordered list with bounded load-more/detail navigation.
   It has no total, page number, x-of-y, remaining count, or hidden-count
   inference. An actor no longer eligible is shown only as
   `authorization_changed`. Current/version detail shows the F-05 responsible
   party and enumerated change summary without exposing a broad roster.

## Native LB-017 requirements

- Use one visible `h1`, skip link, named landmarks, semantic lists and
  descriptions, native controls, fieldsets, and explicit labels.
- Current/history view exposes coverage truth, server time, review state,
  version and confirmation facts. Current plus draft can coexist.
- Draft/review uses predefined synthetic choices, native date input, IANA-zone
  select, linked/focused error summary with field associations, and the exact
  Edit → Review → Make current path. Review repeats aggregate/draft/base
  versions, all structured content and responsibilities, local date, IANA zone,
  and server-resolved inclusive/exclusive UTC bounds. Cancel sends nothing and
  restores useful focus. Success requires durable confirmation followed by a
  fresh authorized read.
- Model loading, no plan, current, current plus draft, overdue, denied/not
  found, dependency unavailable, offline read-only, conflict, uncertain,
  success, and recovered fresh-state paths in VI and EN.
- Offline read-only means only an already-loaded safe in-memory view, visibly
  stale-labelled with its last confirmation time. Without that view, show
  unavailable. Never persist plan content in browser storage, queue, replay,
  autosave, submit on reconnect, or claim success.
- Move focus to a useful persistent heading after validation, review, denial,
  conflict, uncertain result, success, and recovery. Use bounded status/alert
  announcements without focus theft.
- Provide visible/unobscured focus, text-plus-icon state, 44 CSS px targets,
  320 CSS px and 400% reflow without page horizontal scrolling, text-spacing
  resilience, forced-colour semantics, sufficient contrast, and reduced motion.
- Preserve one logical DOM/reading/tab order across reflow with no duplicate
  focusable desktop/mobile controls. Evidence targets are 4.5:1 normal text and
  3:1 large text, UI boundaries, and focus indicators.
- No card-click-only control, modal review, custom date picker, drag, swipe,
  hover-only action, colour-only status, autosave, optimistic success, or
  sticky overlap.
- `KI-016` retains manual NVDA/Narrator, physical-device/touch, text-spacing,
  and full assistive-technology zoom evidence.

## Planned versus actual deviation

Change ID: `CHG-2026-015`

- Planned: generate four synthetic references, independently inspect pixels,
  and freeze a redacted handoff.
- Actual: four references were generated and read back once. Private pixels
  are not independently available, so sanitized metadata and the stricter
  correction map are the review evidence.
- Reason: the provider does not expose private pixels across independent
  reviewer sessions; persisting locators/source or repeating writes is
  prohibited.
- Impact: no generated visual-conformance claim. Native semantics and browser
  evidence remain the production authority.
- Validation: exact-title/device/dimension read-back, independent pre/post
  review, no duplicate/uncertain write, and native contract, privacy,
  accessibility, mocked, and runtime tests.
- Follow-up: perform one bounded private-render review when supported. Retain
  KI-019 and do not regenerate or weaken this handoff.

## Freeze approvals

| Review             | Disposition                                          |
| ------------------ | ---------------------------------------------------- |
| Product/contract   | Frozen against `P3-S3-v1`                            |
| Authority/privacy  | Frozen corrections; generated pixels unapproved      |
| Accessibility      | Native requirements frozen; manual evidence deferred |
| Implementation     | Native semantics only; generated source rejected     |
| Visual conformance | Not claimed; `KI-019` retained                       |
