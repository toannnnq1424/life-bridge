# Security and Privacy

## Security objectives

LifeBridge handles household relationships and potentially sensitive care
coordination. The project prioritizes:

1. confidentiality and minimum necessary disclosure;
2. explicit consent and least privilege;
3. integrity and accountability of care tasks;
4. availability and truthful offline/stale state;
5. safe recovery without leaking protected data.

This document is an engineering baseline, not a legal-compliance certification
or medical-safety assessment.

## Trust boundaries

| Boundary                 | Main risks                                                | Required controls                                                                     |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Browser ↔ API gateway    | session theft, injection, enumeration                     | secure session, CSRF strategy, validation, throttling, non-enumerating errors         |
| Gateway ↔ services       | confused deputy, over-broad service identity              | service identity, explicit scopes, timeout, allow-listed routes                       |
| Service ↔ owned database | injection, excessive retention, operator access           | parameterized access, migrations, encryption, least privilege, audit                  |
| Event transport          | tampering, replay, sensitive payloads                     | authenticated transport, versioned envelope, idempotent consumer, minimum payload     |
| Stitch MCP               | secret leakage, external data egress, untrusted artifacts | synthetic prompts, disabled-by-default MCP, per-call approval, artifact review        |
| Research/data import     | license violation, PII, stale evidence                    | provenance register, classification, local raw-data ignore, review before fixture use |
| CI/deployment            | secret exposure, supply-chain compromise                  | pinned lockfile, minimal token scopes, secret scan, protected environments            |

## Identity, authorization, and consent

- Authentication does not imply household authorization.
- Every protected request checks role, household boundary, current consent, and
  minimum required capability.
- Administrative and moderation roles are separate from household roles.
- Consent has purpose, scope, lifecycle, version, and audit evidence.
- Revocation changes future access; any retention obligation must be explicit.
- Error behavior must not reveal the existence of an inaccessible person,
  household, document, invitation, or task.
- P1 fixture identity is an explicit local/test adapter. The production build
  rejects fixture mode. The owning service still verifies actor, household,
  active assignment, resource, and action rather than trusting UI role text.
- Under `CHG-2026-008`, the completion audience is the distinct task
  creator/coordinator. Care resolves delivery versus self-suppression before
  emitting the minimum event; Notification enforces recipient-scoped reads.

## Sensitive data rules

- Collect the least data required for the active slice.
- Do not place protected data in URLs, logs, events, analytics, exception text,
  screenshots, design prompts, or test snapshots.
- Production secrets never enter Git, fixtures, Markdown, issue text, chat,
  command arguments, or client bundles.
- Demo and automated-test identities are obviously synthetic.
- Medication reminders are coordination records; LifeBridge does not prescribe,
  diagnose, or infer dosage.
- Emergency plans present user-configured information and do not claim automatic
  dispatch or medical authority.

## Logging

Every structured log may include:

- timestamp, level, service, stable event name;
- correlation and trace identifiers;
- redacted/pseudonymous actor or resource reference;
- result and bounded error code;
- duration and retry count.

Logs must not include:

- authorization headers, cookies, passwords, tokens, keys, session material;
- complete request/response bodies by default;
- names, contact details, care notes, medication text, document contents;
- database connection strings or stack traces in client responses.
- task titles/descriptions, event/request payload bodies, fixture display names,
  or raw thrown-error messages.

Redaction is allow-list based. A logging change touching shared middleware
requires adjacent tests and phase-level secret scanning.

P1 local PostgreSQL passwords are generated into ignored local state, passed by
process environment, and never printed. Committed Compose/workflow files contain
no reusable credential. CI databases are disposable and isolated to the run.
GitHub workflow-generated owner passwords are masked before they are exported
to later steps; synthetic/transient scope is not an exception to log hygiene.

## Dependency and supply-chain policy

- Project-local dependencies only; no global install for repository operation.
- Lockfile is committed and frozen in CI.
- New dependencies require purpose, maintenance/provenance review, license
  review, and smallest reasonable scope.
- Install scripts are inspected when risk is material.
- `pnpm-workspace.yaml` uses explicit `allowBuilds`: required `esbuild` is
  allowed and `sharp` is denied. Because P1-S1 has no `next/image` or server
  image pipeline, the vulnerable optional Sharp edge is excluded rather than
  forced outside Next's declared range. Only Next 16.2.11's required PostCSS
  edge is overridden to reviewed patched 8.5.18. A later image feature must
  reopen the review before enabling or replacing Sharp.
- Known vulnerabilities are classified by exploitability and exposure, not
  hidden by blanket ignores.
- The rejected `@_davideast/stitch-mcp@0.9.0` package must not be executed.

## Stitch and external tools

Follow `docs/orchestration/STITCH_CODEX_APP_OPERATIONS.md`.

- Remote MCP is disabled by default.
- `STITCH_API_KEY` is referenced by name only.
- Only synthetic, non-sensitive content may be sent.
- Tool schemas and side effects are reviewed before use.
- Generated code/images are untrusted imports.
- Write, delete, export, build, browser, bulk, or material-cost operations
  require explicit approval.
- A required MCP that remains unavailable after 180 seconds becomes
  `MCP-DEBT-*`; dependent acceptance stays blocked while unrelated safe work may
  continue.
- Required MCP debt closes only after approved runtime secret handling,
  least-privilege and data-egress review, complete tool-schema/side-effect
  review, a synthetic canary, and recorded affected validation.
- Any key pasted into chat is treated as disclosed and cannot be a production
  secret. `CHG-2026-006` is a one-time exception for the project-owner-approved
  disposable Stitch key: use it only in process memory against the official
  endpoint for the bounded private synthetic design session; never persist,
  echo, hand off, or commit it; stop before diff/commit review and require
  provider-side retirement before deployment.

## Security validation

Phase/slice checks:

- working-tree and staged secret-pattern scan;
- dependency lockfile integrity;
- authorization/error contract tests for affected paths;
- log-redaction tests for changed middleware;
- configuration parse and allowed-host checks;
- no debug endpoints or local credentials in production build.

Before release:

- full secret scan including tracked history;
- dependency audit and SBOM;
- authorization matrix and tenant/household isolation tests;
- backup/restore rehearsal for each source of truth;
- deployment configuration review;
- incident-response and credential-rotation rehearsal.
- artifact provenance, container/dependency scans, and owned exceptions;
- zero unresolved required MCP/integration debt;
- successful P8 security/privacy/abuse/supply-chain gate and current P9
  incident/DR evidence.

## Incident response

1. Stop the affected action and preserve redacted evidence.
2. Do not repeat or print a suspected secret.
3. Disable the narrow integration or credential.
4. Confirm scope through logs and repository history.
5. Rotate/revoke through the credential owner.
6. Apply the smallest safe remediation and targeted test.
7. Record impact and follow-up in `KNOWN_ISSUES`, `DECISIONS`,
   `INTEGRATION_LOG`, and `SESSION_LOG` as applicable.
8. Never rewrite public Git history without explicit authorization and a
   coordinated incident plan.

## P2-S1 identity threat-model control

The frozen account/session/recovery/preferences threat model is
`docs/security/P2_S1_THREAT_MODEL.md` under `CHG-2026-010`/ADR-018. It requires:

- first-party Identity-owned PostgreSQL and no cross-service table access;
- Argon2id password storage with documented parameters, encrypted TOTP seed,
  TOTP replay CAS, digest-only one-time recovery/challenge/session artifacts;
- generic account/recovery responses and dummy password work for unknown users;
- atomic account/request-source rate limits using HMAC-derived dimensions;
- opaque server-side host-only cookie sessions, rotation/revocation, idle and
  absolute expiry, synchronizer CSRF, exact Origin and Fetch Metadata checks;
- public actor-header stripping and account-only authorization before P2-S2;
- no credential mutation offline queue and no secrets in browser storage;
- allow-listed logs and Identity-owned audit that exclude login names,
  passwords, OTP/seeds, recovery/session/CSRF/challenge tokens, raw IP,
  cookies, headers, bodies, database URLs and raw errors.

The selected libraries are `@node-rs/argon2` and `otpauth`, pinned exactly and
reviewed through the lockfile/lifecycle/dependency gate. TOTP is not
phishing-resistant and the project makes no NIST AAL or compliance claim.
Production UI is separately blocked by `MCP-DEBT-2026-002`.
