# P2-S1 Stitch Handoff — Account Access and Accessible Onboarding

## Control

- Screens: `LB-001`–`LB-007`
- Status: **Frozen**
- Design source: official Google Stitch MCP, bounded synthetic generation
- Reference aliases: `P2-LB-001` through `P2-LB-007`
- Private project/screen locators: intentionally omitted
- Generated source imported: **No**
- Production authority: repository contracts, this reviewed handoff, and tests

## Provenance and review boundary

The official Stitch MCP was used against the single existing LifeBridge project.
`list_projects` was read-only. Seven `generate_screen_from_text` calls produced
synthetic desktop references, one for each screen. No project was created,
deleted, edited or duplicated; no design-system mutation, variant, upload or
generated source import occurred.

Prompts contained only public product language, synthetic states and
accessibility requirements. They contained no credential, real identity, care
record, private URL, signed URL, remote identifier or production data. Remote
resource names remain ephemeral and are not recorded in Git, issues or PRs.

Stitch output is untrusted visual input. Product, accessibility, privacy and
security review below overrides any generated layout, wording or behavior.

## Frozen screen aliases

| Alias       | Screen                                       | Route                       | Frozen purpose                                                                  |
| ----------- | -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `P2-LB-001` | Public landing                               | `/`                         | Public safety boundary; sign-in and registration only; no private destination   |
| `P2-LB-002` | Sign in                                      | `/login`                    | Password continuation with generic anonymous response                           |
| `P2-LB-003` | Registration                                 | `/register`                 | Account request; no session before required factor and recovery acknowledgement |
| `P2-LB-004` | Required factor and recovery acknowledgement | `/mfa`                      | Single TOTP field; one-time recovery display and explicit acknowledgement       |
| `P2-LB-005` | Recovery                                     | `/recover`                  | Password and authenticator recovery; never auto-sign-in                         |
| `P2-LB-006` | Account-only onboarding                      | `/onboarding`               | Optional intent only; never grants household authority                          |
| `P2-LB-007` | Language and accessibility preferences       | `/onboarding/accessibility` | VI/EN, text, contrast and motion; failure never gates account access            |

## Component and state contract

All screens use a skip link, public brand header, language control, one visible
`h1`, named `main`, native fields/buttons/links and a persistent linked error
summary. Navigation focuses the new heading; validation focuses the summary.
Password managers, autofill and paste remain enabled. TOTP uses one semantic
input. Secret values never enter a live region, URL, history, browser storage,
telemetry or test artifact.

Anonymous unknown, wrong, duplicate, locked, disabled, unverified and expired
conditions use the same title, DOM structure, focus destination, assistive text,
message key and retry affordance. Rate-limited and service-unavailable states
remain generic. Offline mutations are blocked, never queued, and reconnect
never submits automatically.

The account session has only `account` scope. Role intent is non-authoritative.
No household route, member, care recipient, task or notification is exposed
until a later authorization slice. Registration does not create a session;
recovery revokes sessions and does not sign in automatically.

Preferences are limited to locale, text scale, contrast and motion. Defaults or
a failed save cannot block an authorized session. Locale changes update
document language, title, labels, errors and status without submitting or
clearing the current non-secret fields.

## Responsive and accessibility corrections

- One-column reflow at 320 CSS px and 400% zoom; no two-dimensional scrolling.
- Visible keyboard focus, logical source order, 24 by 24 CSS pixel minimum targets.
- System forced colors and reduced motion remain usable without color-only state.
- Long Vietnamese strings wrap without clipping.
- Errors persist as text and are programmatically associated.
- Recovery artifacts are selectable text, never announced wholesale.
- CAPTCHA, six-box OTP, drag, hover-only, gesture, timer-only recovery and
  disabled paste are prohibited.

Automated axe, keyboard/focus, reflow, locale, reduced-motion, forced-colors and
secret-storage assertions are required in the P2 browser campaign. Manual
NVDA/Narrator, text-spacing and 200%/400% observation remain honestly unexecuted
until separately recorded.

## Review decision

- Product: **Approved** for the P2-S1 account-only flow.
- Accessibility: **Approved with the corrections above**.
- Privacy/security: **Approved with synthetic-only provenance, generic
  anonymous behavior, artifact suppression and no household authorization**.
- Implementation: **Frozen for native project implementation**.

This handoff closes the design-reference portion of `MCP-DEBT-2026-002`. The
debt closes only after production implementation, browser/security/accessibility
evidence and the single P2 Level C command pass.
