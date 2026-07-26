# P2-S1 Identity Threat Model and Frozen Backend Contract

## Control

- Slice: `P2-S1 — Account access and accessible onboarding`
- Contract: `P2-S1-v1`
- State: **Frozen for contracts and backend implementation**
- UI state: **Blocked** pending `MCP-DEBT-2026-002` and seven Frozen Stitch handoffs
- Frozen: 2026-07-26
- Architecture decision: `ADR-018`
- Change record: `CHG-2026-010`
- Evidence gate: `PASS WITH ASSUMPTIONS`

This record is an engineering threat model, not an identity-proofing, NIST AAL,
legal-compliance, or production-deployment claim.

## Scope and authority

P2-S1 creates an account-scoped authorized session. It does not create a
household, grant a household role, accept an invitation, or authorize access to
P1 Care or Notification data. Those capabilities begin in P2-S2. An onboarding
role choice is a non-authoritative intent only.

The slice supports:

- registration with a non-email login name and password;
- required standards-based TOTP enrollment and verification;
- one-time saved recovery codes that are shown once and acknowledged;
- password recovery using TOTP plus one recovery code;
- factor recovery using the password plus one recovery code, followed by TOTP
  re-enrollment;
- sign-in using password plus TOTP;
- server-side session issue, rotation, expiry, logout, and revocation;
- optional `vi-VN` / `en` and minimum-data accessibility preferences;
- account onboarding completion that grants no household permission.

If the user loses the password, TOTP authenticator, and all saved recovery
codes together, automated recovery is unavailable in P2-S1. Support-assisted
identity proofing, email/SMS delivery, passkeys, external identity providers,
SSO, remembered devices, household authorization, and deployment are non-goals.

## Architecture and trust boundaries

Identity & Consent owns one PostgreSQL database on the existing engine. It
owns accounts, authenticators, recovery codes, challenges, sessions, rate
limits, preferences, and identity audit facts. It never reads or writes Care or
Notification tables. No JWT, Redis, broker, external identity provider, email,
or SMS provider is added.

The browser receives only opaque pre-authentication challenges and opaque
session cookies. The gateway strips public `X-Actor-Id` and
`X-Fixture-Actor-Id`, resolves the account from Identity, and supplies trusted
internal context. A P2 account without a P2-S2 membership is denied every
household route.

Production cookie contract:

```text
__Host-lb_session=<opaque 256-bit token>; Secure; HttpOnly; SameSite=Strict; Path=/
```

No `Domain` attribute is permitted. Local/test HTTP uses a distinct
non-production cookie name and is valid only on loopback. Any fixture identity
combined with production mode, non-loopback binding, or a public origin fails
at startup.

## Authenticator and artifact protection

- Passwords: Unicode NFC, 8–128 code points because TOTP is always required;
  no composition or periodic-change rule; common/context password blocklist;
  password managers, autofill, paste, and show-password remain possible.
- Password storage: `@node-rs/argon2` Argon2id, memory `19,456 KiB`, time cost
  `2`, parallelism `1`, output `32` bytes, random per-password salt; encoded
  parameters remain versioned in the stored hash.
- Unknown-account work: verify against one configured dummy Argon2id hash so
  the public path does not skip password work. Tests assert the selected work
  path, not brittle wall-clock equality.
- TOTP: `otpauth`, RFC 6238, SHA-256, six digits, 30-second period, accepted
  window `±1`. Identity stores an encrypted seed and the last accepted time
  step; one time step can win only once, including under concurrency.
- TOTP seed encryption: Node maintained `node:crypto` AES-256-GCM with a random
  96-bit nonce, 128-bit authentication tag, account/authenticator AAD, and a
  versioned 256-bit runtime key. The key never enters Git, logs, fixtures, or
  the database.
- Recovery codes: ten independently generated 128-bit printable codes, shown
  once; only SHA-256 digests scoped to the account are stored. Consumption is
  conditional and single-use. Recovery rotates all codes and revokes every
  existing session.
- Pre-authentication challenges: independently generated 256-bit tokens,
  digest-only storage, five-minute expiry, purpose-bound, attempt-bounded, and
  single-use. They never become authorized session identifiers.
- Sessions: independently generated 256-bit opaque tokens, digest-only storage,
  30-minute idle timeout, 12-hour absolute timeout, server-side revocation,
  and `Cache-Control: no-store`. A successful factor, recovery, or onboarding
  privilege transition creates a new token and invalidates the old token.

## CSRF, origin, replay, and race controls

Every cookie-authenticated mutation requires all of:

1. a session-bound 256-bit synchronizer token in a custom header;
2. an exact allowed `Origin`;
3. no `Sec-Fetch-Site: cross-site` signal;
4. `application/json` input;
5. authorization and current session/authentication version.

`SameSite=Strict` is defense in depth, not the only CSRF control. GET/HEAD never
change state. Challenge consumption, TOTP-step acceptance, recovery-code use,
session rotation, onboarding completion, and preference versions use row locks
or conditional writes so concurrent attempts have one winner. A retry never
turns an unknown result into a second credential/session transition.

## Enumeration and rate limits

Public responses do not distinguish unknown, wrong-password, disabled, locked,
or unverified accounts. Recovery failure does not distinguish unknown,
expired, used, or invalid artifacts. Registration always returns the same
accepted envelope and a real or decoy challenge of the same shape. Public
status, code, message key, headers, field shape, redirect/focus contract, and
safe structured logging remain equivalent.

PostgreSQL rate buckets are atomic and use HMAC-derived identifiers rather than
raw login names or IP addresses:

| Operation        |                     Identifier dimension | Request-source dimension |
| ---------------- | ---------------------------------------: | -----------------------: |
| Sign-in password |                  5 failures / 15 minutes |          30 / 15 minutes |
| TOTP factor      | 5 / challenge; 10 / account / 15 minutes |          30 / 15 minutes |
| Recovery         |                   5 / account / 24 hours |                20 / hour |
| Registration     |                     no account dimension |                 5 / hour |

Unknown identifiers receive the same bucket behavior. A new challenge does not
reset account failures. Lockout is temporary and public copy remains generic.

## Data and retention

Identity-owned tables:

- `identity_accounts`: opaque account ID, normalized login name, password hash,
  state, authentication version, timestamps;
- `identity_authenticators`: type/state, encrypted TOTP secret/key version,
  last accepted step;
- `identity_recovery_codes`: digest and created/used/revoked timestamps;
- `identity_challenges`: digest, purpose, decoy marker, attempts, expiry,
  consumed time, bounded encrypted/hashed artifacts where required;
- `identity_sessions`: token and CSRF digests, authentication version,
  creation/authentication/last-seen/idle/absolute/revoked fields;
- `identity_rate_limits`: operation, HMAC dimension, window, count;
- `identity_preferences`: locale, text scale, contrast, motion, version and
  timestamps;
- `identity_audit`: stable action/result/correlation and nullable opaque account
  ID; never candidate login name, raw IP, token, code, seed, or request body.

Challenges are retained at most one hour after expiry, rate buckets 24 hours
after their window, revoked/expired sessions seven days, and used recovery
digests 30 days. Security audit retention is a 90-day engineering default, not
a compliance claim. Account deletion/export is deferred to P2-S3/P7.

Preferences are optional and do not describe disability or assistive-technology
use. Allowed values are locale `vi-VN | en`, text scale `default | large`,
contrast `system | more`, and motion `system | reduce`. Save, reset, or offline
failure cannot revoke or gate an otherwise authorized account session.

## Audit and log contract

Required audit actions include:

```text
account.registration.accepted
auth.password.failed
auth.factor.succeeded
auth.factor.failed
auth.recovery.succeeded
auth.recovery.failed
session.created
session.rotated
session.revoked
session.expired
onboarding.completed
preferences.updated
fixture.startup.rejected
```

Safe logs contain stable event/action, result, correlation ID, duration, bounded
error code, and opaque account/session-family reference only after safe account
resolution. Logs and audit never contain login names, passwords, OTPs, TOTP
seeds/URIs, recovery codes, session/CSRF/challenge tokens, cookies,
authorization headers, raw IP addresses, preference payloads, request bodies,
database URLs, or raw errors.

## Threat and validation matrix

| Threat                  | Frozen control                                            | Required proof                                          |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Enumeration/timing      | generic envelopes, dummy password work, unknown buckets   | exact response equivalence and work-path tests          |
| Credential stuffing     | account-HMAC and source-HMAC atomic limits                | concurrent threshold tests without raw identifiers      |
| Password database theft | Argon2id and per-password salt                            | encoded-parameter and no-truncation tests               |
| TOTP seed theft/replay  | AEAD seed, last-step conditional use                      | same/concurrent step has one winner                     |
| Recovery bypass         | remaining factor plus one 128-bit code                    | invalid/used/concurrent code tests; revoke all sessions |
| Session fixation/theft  | separate challenge/session tokens, rotation, cookie flags | planted/old token rejection and cookie tests            |
| CSRF/origin abuse       | synchronizer token, Origin, Fetch Metadata, JSON only     | missing/wrong/cross-site rejection before mutation      |
| Confused deputy         | public actor headers stripped; account-only scope         | forged header ignored; P1 household denied              |
| Fixture escape          | mode, bind, origin and fixture matrix                     | public/production startup rejection                     |
| Offline misuse          | no auth/recovery/factor/preference queue                  | no request, persistence, auto-submit, or false success  |
| Preference privacy      | minimum enumerated preferences only                       | persistence/restart and non-gating failure tests        |
| Sensitive telemetry     | allow-list logging and owned audit                        | sentinel scan across success/failure/exception paths    |

## Frozen acceptance and commands

Full P2-S1 acceptance still requires seven Frozen Stitch handoffs and production
UI. The one eventual stable-candidate Level C command is:

```powershell
pnpm.cmd run validate:p2-s1
```

It must cover affected format/lint/type/build, unit and contract tests, owned
PostgreSQL integration/restart/races, gateway cookie/CSRF/header boundaries,
registration/sign-in/factor/recovery/preferences/session browser journeys,
VI/EN, keyboard/focus/axe/320 px/reflow, offline and expiry states, fixture
escape, audit/log redaction, dependency/security checks, docs/secrets/private
Stitch locator/generated junk, exact task-owned cleanup, and `git diff --check`.
It is not run or reported as passing while `MCP-DEBT-2026-002` blocks UI.

Backend work before that gate uses package-scoped Level A and targeted Level B
commands. No partial campaign is labeled Level C.

## Minimum implementation footprint

- `services/identity-consent/` and its owned migration;
- `packages/contracts`, `packages/config`, `packages/observability`;
- `apps/gateway` public identity/session boundary;
- colocated `services/identity-consent/src/service.integration.test.ts`;
- P2 database/reset helpers and existing PostgreSQL Compose; start/full-Level-C
  helpers remain gated with the production UI;
- root manifest/lockfile and exact-head CI definition;
- affected architecture/API/data/security/test/deployment/design/state memory;
- later, only after the gate, `apps/web` and `tests/browser/p2-s1.spec.ts`.

## Research trace

Retrieved 2026-07-26. Sources are used as engineering guidance outside a US
federal conformance claim; no source data enters fixtures.

| Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Year / geography / terms                                       | Decision or test changed                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), NIST                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2025 / US / official public standard                           | password, recovery-code, session-secret, cookie, replay and expiry contract; no AAL claim         |
| OWASP [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [MFA](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), and [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) Cheat Sheets | current 2026 / global / CC BY-SA 4.0                           | generic work path, Argon2id parameters, rotation, recovery, rate, CSRF/origin and log tests       |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) SC 3.3.8 and related Understanding documents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | WCAG 2023, current 2026 guidance / global / W3C document terms | password-manager/autofill/paste, non-cognitive authentication, focus/reflow/status tests          |
| Fastify [validation/serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) and [cookie plugin](https://github.com/fastify/fastify-cookie) documentation                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | current 2026 / global / project licenses                       | bounded schema validation, sanitized errors and cookie handling; no database access in validators |
| [Node.js 22 crypto documentation](https://nodejs.org/docs/latest-v22.x/api/crypto.html)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | current Node 22 LTS / global / MIT                             | CSPRNG, hashes, timing-safe comparison and AES-GCM runtime implementation                         |
| [`@node-rs/argon2`](https://github.com/napi-rs/node-rs/tree/main/packages/argon2) and [`otpauth`](https://github.com/hectorm/otpauth) official project documentation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | reviewed 2026 / global / MIT                                   | maintained libraries and exact dependency/algorithm tests                                         |

GitHub issue #6 could not be fetched anonymously because the repository is
private. The user-supplied canonical delegation plus repository plan/board is
the acceptance authority for this freeze. Re-check triggers are a Stitch
activation, authenticator/provider change, public pilot, passkey scope, or
changed NIST/OWASP/WCAG guidance.
