# P2-S1 Local Semantic Wireframe and Stitch Handoff Preparation

## Control

- Screens: `LB-001`–`LB-007`
- Flow: `F-01` plus the P2-S1 portion of `F-02`
- Status: **Flow drafted — production UI blocked**
- Source: repository-native local semantic wireframe only
- Stitch reference: pending Codex App restart, in-task schema/data-egress
  review, and bounded synthetic design operations
- Debt: `MCP-DEBT-2026-002`
- Backend contract: `P2-S1-v1`
- Production implementation approved: **No**
- Blocks deploy: **Yes**

This document prepares a handoff without claiming a Stitch reference, design
review, accessibility review, Frozen state, or production UI implementation.
P1 design references do not approve these screens.

## Permission and privacy contract

Anonymous screens may collect only login name, password, TOTP code, or a saved
recovery code required by the current operation. Secrets remain in memory only,
are never placed in URLs/history/storage/telemetry, and are cleared on expiry,
route cancellation, or success. Offline authentication mutations are blocked,
not queued.

An authorized P2-S1 session is account-scoped. `LB-006` may capture a
non-authoritative role intent, but cannot create membership or grant household
access. `LB-007` preferences are optional and cannot gate navigation or
authorization.

Public login and recovery copy, DOM shape, HTTP-facing state, focus destination,
page title, and assistive text do not disclose whether an account exists or is
locked, disabled, unverified, expired, or unknown.

## Local route wireframes

### `LB-001` Landing — `/`

```text
[Skip to main]
header: LifeBridge | Language: VI / EN
main
  h1: Coordinate care with clear responsibility
  safety boundary: coordination, not diagnosis or emergency dispatch
  primary link: Sign in
  secondary link: Create account
  fallback public summary when optional content is unavailable
```

No account state or private destination is rendered. At 320 CSS px, actions
remain a one-column list in source order.

### `LB-002` Sign in — `/login`

```text
h1: Sign in
generic status/error summary
Login name [autocomplete=username]
Password [autocomplete=current-password] [Show password]
[Continue]
[Use account recovery]
```

Successful password verification proceeds to a purpose-bound factor challenge;
all anonymous failures use generic copy. Paste, autofill, password managers,
and show-password are supported. Rate limits never expose account state.

### `LB-003` Registration — `/register`

```text
h1: Create an account
plain-language privacy and no-household-access explanation
Login name [autocomplete=username]
New password [autocomplete=new-password]
Password guidance without composition rules
[Continue]
[Cancel and sign in]
```

Registration returns an accepted real-or-decoy enrollment challenge of the
same public shape. It does not create a session. The account becomes active
only after factor confirmation and one-time recovery-code acknowledgement.

### `LB-004` Required factor — `/mfa`

Enrollment variant:

```text
h1: Set up your required authenticator
provisioning URI rendered as a QR reference plus selectable manual secret
TOTP code [one input, inputmode=numeric, autocomplete=one-time-code]
[Verify]
[Cancel]
```

Sign-in variant:

```text
h1: Enter your authenticator code
generic invalid / expired / rate-limited summary
TOTP code [single semantic input; whole-code paste]
[Verify]
[Use account recovery]
```

No OTP or seed enters a live region, title, history, screenshot, trace, or
storage. TOTP is not described as phishing-resistant.

### `LB-005` Recovery — `/recover`

```text
h1: Recover account access
choice: recover password | replace authenticator
Login name [autocomplete=username]
remaining factor: password or TOTP
Saved recovery code [autocomplete=off; paste allowed]
new password or new-factor continuation as applicable
[Continue]
generic persistent confirmation or failure
```

Password recovery requires TOTP plus one recovery code. Factor recovery
requires the password plus one recovery code, then new TOTP verification.
Success revokes all sessions and rotates recovery artifacts; it never
automatically signs in. Total loss has an honest unsupported message and no
weaker security-question fallback.

### `LB-006` Account onboarding — `/onboarding`

```text
h1: Finish account setup — Step 1 of 2
explanation: no household access has been granted
optional coordination-role intent (non-authoritative)
[Continue]
[Back]
[Sign out]
```

No choice grants a role. Forward/back transitions preserve non-secret input and
announce step/title changes. Onboarding completion rotates the session.

### `LB-007` Accessibility onboarding — `/onboarding/accessibility`

```text
h1: Display and language — Step 2 of 2
Language: Tiếng Việt | English
Text size: Default | Large
Contrast: System | More
Motion: System | Reduce
preview region
[Save and continue]
[Use defaults and continue]
[Reset]
[Back]
```

The screen does not ask for a diagnosis or screen-reader use. Save failure is
shown truthfully but does not gate the authorized account session; defaults and
retry remain available.

## Shared state and accessibility contract

- one visible `h1`, descriptive privacy-safe title, skip link, named `main`,
  native labels/fields/buttons/links, and logical source/focus order;
- failed submission focuses a persistent linked error summary; in-place status
  does not steal focus; route changes focus the new heading;
- no CAPTCHA, cognitive puzzle, forced transcription, six-box OTP widget,
  disabled paste, timer-only recovery, hover, drag, or gesture requirement;
- loading, generic validation, rate-limited, denied, locked-equivalent,
  expired, offline-blocked, service-error, and confirmed states have persistent
  VI/EN copy and programmatic status;
- reconnect never auto-submits credentials;
- session/challenge expiry clears secret fields and cached private content;
- 320 CSS px, 200% zoom, 400% reflow, long VI strings, text spacing, 24×24
  minimum targets, reduced motion, and forced colors remain acceptance rows;
- preference precedence is explicit current choice, authenticated preference,
  safe browser language, then `vi-VN` default. Locale change updates `<html
lang>`, title, labels, errors, and status without resetting or submitting.

## Required Stitch review before Frozen

The official endpoint and environment-backed authentication passed a read-only
direct MCP transport canary without project mutation. After a full Codex App
restart, the project owner/design lead must inspect the newly callable tool
schemas, classify side effects and data egress, and run one bounded synthetic
design session for `LB-001`–`LB-007`. No real login name, credential, private
URL, signed URL, remote ID, or care data may be sent.

Then create seven screen handoffs from
`docs/design/reviews/SCREEN_HANDOFF_TEMPLATE.md`. Each must include a redacted
reference alias, complete VI/EN copy, state and enumeration-equivalence matrix,
semantics, keyboard/focus/announcement behavior, responsive/accessibility
evidence, privacy/security review, and product/design/accessibility/security/
implementation approvals. Generated source is never copied.

Manual NVDA/Narrator, forced-colors/high-contrast, 200%/400%, text spacing, and
target-size rows remain honestly untested until executed.

## MCP debt

`MCP-DEBT-2026-002 — P2-S1 LB-001–LB-007 Stitch reference and handoff pending`

- Owner: Project Owner and Design Lead; MCP activation owner supports.
- Affected slice/screens: P2-S1, `LB-001`–`LB-007`.
- Original gate evidence: callable Stitch inventory was empty at
  `2026-07-26T02:09:54.193Z` and remained empty at
  `2026-07-26T02:13:03.970Z` (>180 seconds). No secret/private locator was
  inspected.
- Activation evidence: the official endpoint and environment-backed
  authentication later passed a read-only direct MCP canary with HTTP 200 for
  initialization and tool discovery, protocol `2025-06-18`, and 15 exposed
  project/screen/design-system tools. No project mutation occurred.
- Remaining availability gate: restart Codex App and resume this same task so
  the newly configured namespace becomes callable in-task.
- Fallback: this local semantic wireframe, frozen backend contracts, bilingual
  copy requirements, and backend implementation only.
- Remaining security/data-egress review: exact callable tool schemas, side effects,
  least privilege, synthetic-only payload, artifact metadata, private-URL and
  secret scan; write/cost operations require approval.
- Blocks production UI implementation: no; Frozen Stitch handoff and native UI complete.
- Blocks full P2-S1 acceptance and deploy: no for P2 acceptance; deployment remains separately gated.
- Closure: official reference completed, seven reviewed handoffs Frozen, no
  generated source copied, and affected frontend/browser validation passes.

Closure evidence: satisfied by the Frozen
`docs/design/reviews/P2_S1_STITCH_HANDOFF.md` and the passing single P2 Level C.
