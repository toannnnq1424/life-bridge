# LifeBridge Test Strategy

## Purpose

LifeBridge validates coherent changes at the smallest useful scope. The project does not run the full suite after every edit. Tests must prove user-visible vertical slices, shared contracts, failure handling, and safe behavior without wasting local or CI time.

## Validation levels

### Level A — Local static validation

Run after a small coherent group of edits:

```powershell
pnpm.cmd run format:check
pnpm.cmd run lint
pnpm.cmd run typecheck
```

Prefer package-scoped equivalents once application packages exist. Format only intended files before the final check.

### Level B — Targeted defect validation

For a specific bug:

1. Identify or add the smallest reproducing test.
2. Run only that test and its immediate module tests.
3. Make one coherent fix.
4. Rerun the reproducer and affected static validation.
5. Defer unrelated tests to the slice checkpoint.

After two failed hypotheses, stop blind iteration and record evidence and the next diagnostic action in `docs/SESSION_LOG.md`.

### Level C — Vertical-slice validation

At the end of a slice, run:

- affected-package format, lint, and type check;
- related unit tests;
- the slice integration test;
- the affected build target;
- one end-to-end smoke path;
- documentation and secret-hygiene validation.

Every slice must exercise its success path, relevant denied/invalid input, dependency failure, and truthful error presentation.

For `P4-S1`, exactly one coherent Level C campaign uses:

```powershell
pnpm.cmd run validate:p4-s1
```

It cumulatively proves frozen contracts and fresh authority; exact
amount/unit/IANA/DST/finite recurrence; optimistic schedule conflict and
digest-only idempotency; minimum-data Care intent; Notification
pending/uncertain/delivered/failed/missed/cancelled truth; concurrent immutable
seen acknowledgement; owner-local atomic audit/outbox rollback;
owner-isolated migration rollback/reapply/no-backfill; privacy-safe logs;
mocked and real Chromium paths; VI/EN keyboard/focus/320 px reflow/axe,
forced-colors and reduced-motion CSS; config, secrets, dependency audit,
builds, diff and cumulative regressions. Browser traces, screenshots and video
remain disabled. A campaign failure retains proven evidence and permits only a
classified targeted recovery, never a second full Level C.

For `P3-S2`, exactly one coherent Level C campaign uses:

```powershell
pnpm.cmd run validate:p3-s2
```

The campaign covers canonical UTC ordering, IANA/DST gap and overlap
resolution, finite weekly recurrence, half-open conflicts and adjacency,
recipient-scoped serialization, digest-only idempotency, optimistic
stale/state recovery, cancelled history, provider/consumer contracts,
Care/Notification PostgreSQL ownership, atomic audit/outbox evidence,
migration rollback/reapply/no-backfill, minimum reminder intent, VI/EN native
UI, keyboard/focus/axe/reflow, mocked and real browser paths, production build,
secret/log scans and PID-scoped cleanup. A failed gate is classified and
continued only with the affected target; unchanged green gates are not
rerun.

### Level D — Phase or release validation

Run once at the end of a phase, before merge, release, or submission:

```powershell
pnpm.cmd run validate:phase0
pnpm.cmd run security:deps
```

As product packages are added, the phase command must include repository-wide format, lint, type check, unit tests, integration tests, production builds, and primary smoke tests.

## Phase 0 harness

| Command                         | Scope                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| `pnpm.cmd run doctor`           | Classify mandatory and optional Windows prerequisites               |
| `pnpm.cmd run format:check`     | Check formatting of Phase 0-owned source/config/docs                |
| `pnpm.cmd run lint`             | Lint the TypeScript quality harness and ESLint config               |
| `pnpm.cmd run typecheck`        | Type-check harness and unit tests                                   |
| `pnpm.cmd run test:unit`        | Run quality-harness unit tests                                      |
| `pnpm.cmd run test:integration` | Validate docs, configuration, and secret hygiene together           |
| `pnpm.cmd run validate:docs`    | Verify required useful Phase 0 documents and bilingual README       |
| `pnpm.cmd run validate:config`  | Verify pinned runtime, scripts, configs, CI, and MCP secret hygiene |
| `pnpm.cmd run validate:secrets` | Scan tracked/unignored text without printing detected values        |
| `pnpm.cmd run build`            | Compile-check non-test Phase 0 TypeScript                           |
| `pnpm.cmd run validate:phase0`  | Run the complete offline Phase 0 validation sequence                |
| `pnpm.cmd run security:deps`    | Query dependency advisories; network-dependent                      |

The secret validator is a fast repository hygiene gate, not a substitute for provider-side key rotation, GitHub secret scanning, incident review, or a release-time history scan with an approved dedicated scanner.

pnpm lifecycle scripts are denied unless explicitly allowlisted. The workspace
permits only `esbuild`, the MIT-licensed platform binary required by the pinned
tsx/Vitest and service bundle toolchain. Because P1-S1 has no image pipeline,
Next's optional `sharp` is excluded from resolution and remains explicitly
lifecycle-denied. A parent-scoped override moves only Next 16.2.11's PostCSS
edge to advisory-patched 8.5.18. Frozen install, audit, production Next build,
and real Chromium runtime prove this narrow graph; no advisory ignore or global
script approval is allowed. New build-script packages require a separate review
and configuration change; wildcard approval is prohibited.

## Test placement

Phase 0 harness tests live beside the validator under `tools/quality/src/*.test.ts`. Future package tests belong with the package they exercise. Cross-service tests must live in a clearly named integration workspace and use deterministic fixtures by default.

## Determinism and data safety

- Unit and integration tests use synthetic fixtures only.
- No real care-recipient, volunteer, credential, private link, or production identifier enters a fixture, snapshot, prompt, screenshot, or log.
- Time, random identifiers, external responses, and retry behavior are controlled in tests.
- Fixture mode and real adapters must satisfy the same internal contract.
- Vietnamese and English UI behavior require representative fixtures and localization tests.

## CI

The primary workflow is Windows-first and uses Node `22.22.3` plus pnpm
`11.9.0`. GitHub Actions are pinned to immutable commit SHAs. P1 CI checks out
the literal candidate SHA, installs the frozen lockfile under the narrow
lifecycle policy, and runs Windows static/unit/build/security plus an Ubuntu
PostgreSQL/Chromium acceptance job and one aggregate gate.

Cross-platform repository validators select `git.exe` only on Windows and
`git` on Unix, tolerate empty/Buffer child-process output, and have a targeted
regression for that boundary. CI-generated disposable database passwords are
masked before export to `GITHUB_ENV`; synthetic scope does not permit plaintext
credential-shaped values in hosted logs.

Docker, GitHub CLI, PowerShell 7, and Python are optional in Phase 0. A future slice may make a tool mandatory only when its acceptance criteria require it and the doctor documentation is updated in the same change.

## P1-S1 Level C contract

The one stable-candidate command is:

```powershell
pnpm.cmd run validate:p1-s1
```

It must execute, in one campaign:

1. affected format, lint, and TypeScript checks;
2. unit and frozen API/event consumer contract tests;
3. PostgreSQL integration with independently owned Care and Notification
   databases;
4. atomic completion/outbox, idempotent create/complete, optimistic conflict,
   duplicate/redelivered event, self-suppression, outage/retry, crash-after-
   consumer-commit, restart durability, time-zone, authorization, audit, and
   log-redaction cases;
5. affected production builds;
6. Playwright against the real gateway/service contracts for the complete
   Lan-create/Minh-complete/Lan-notified flow in both `vi-VN` and `en`;
7. keyboard/focus, semantic accessibility, 320 px and critical responsive
   checks;
8. documentation, configuration, generated-artifact, private Stitch locator,
   secret, and dependency advisory checks.

Hosted CI checks out the literal pull-request head SHA. A Windows job proves
the supported static/unit/production-build path; an Ubuntu PostgreSQL
service-container job proves owned database integration and Chromium browser
acceptance. The same browser campaign is also run locally on Windows before
push. One aggregate check depends on both.
Because branch protection is unavailable, the reviewer manually records that
local HEAD, remote branch head, PR head, and successful run head are identical.

Manual P1 acceptance evidence records keyboard-only flow, NVDA with Chrome or
Firefox, Narrator with Edge, 200% zoom, 400% reflow, text spacing, forced
colors, reduced motion, target size, and measured contrast. An unsupported row
is a named limitation, never an implicit pass.

## Failure classification

Classify a failure before editing:

- implementation defect;
- test defect;
- environment or permission issue;
- dependency issue;
- unrelated pre-existing failure.

Fix only failures caused by or blocking the active slice. Record deferred validation and unresolved issues in persistent project documentation.

## Research and risk validation

- Validate research/source/assumption schemas and provenance offline.
- Do not scrape live links in CI or treat HTTP success as evidence freshness.
- Before release, trace every public numerical claim to source, date, geography,
  limitation, and recorded re-check trigger.
- For each slice, select applicable rows from the shared risk catalog in
  `docs/RUNBOOK_ADOPTION.md`; do not run a generic matrix of irrelevant cases.
- Cross-cutting security/accessibility/offline controls begin with the first
  affected slice. P6–P12 verify them across progressively broader production
  scope; they do not postpone them.

## Production-maturity validation campaigns

| Phase | Required additional evidence                                                                                                                                |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6    | Provider/consumer compatibility, mixed-version primary flow, independent artifact/start/health, architecture fitness, dependency isolation                  |
| P7    | `N-1 -> N` migrations, replay/reconciliation/dead-letter recovery, duplicate/loss checks, backup/restore, retention/deletion, RPO/RTO                       |
| P8    | Authorization/isolation matrix, consent revocation, secret rotation, SBOM/provenance, dependency/container scan, abuse and response exercise                |
| P9    | Redacted telemetry journey, SLI/SLO/error budget, injected-alert/runbook test, degraded/offline/conflict states, incident and DR rehearsal                  |
| P10   | Representative load, spike and soak, backpressure/saturation, correctness under scale, capacity and cost thresholds                                         |
| P11   | Clean install, full CI/security/performance/DR evidence, immutable production build, migration/rollback, staged rollout, smoke, demo, and release rehearsal |
| P12   | Alert-to-resolution/postmortem, patch/vulnerability/credential cadence, backup/restore recheck, SLO review, privacy-safe feedback governance                |

Each campaign:

1. freeze the exact commit, schemas, fixtures, and journey inventory;
2. run static/build/unit/contract validation;
3. run integration and end-to-end validation;
4. run security/privacy/accessibility validation;
5. run performance/resilience/recovery validation;
6. batch fixes by root cause, use targeted retests, then run one final Level D
   validation.

## P2-S1 validation contract

Backend implementation while Stitch is blocked uses only package-scoped Level
A and targeted Level B. No partial command/result is labeled P2 Level C.

The eventual one stable-candidate command is:

```powershell
pnpm.cmd run validate:p2-s1
```

It must run after seven `LB-001`–`LB-007` handoffs are Frozen and include:

1. frozen install, P2 footprint format, affected lint/type/unit/contract/build;
2. Identity-owned PostgreSQL migration, restart, duplicate/race, rate-limit,
   TOTP replay, recovery single-use, session rotation/revoke/idle/absolute
   expiry, preference version/non-gating, audit and no-cross-write integration;
3. Gateway actor-header stripping, cookie flags, CSRF/origin/Fetch Metadata,
   fixture public/production rejection and non-disclosing household denial;
4. real register → factor → recovery-code acknowledgement → sign-in → factor →
   onboarding/preferences → authorized account browser journeys in VI/EN;
5. unknown/wrong/locked/disabled/duplicate/invalid/expired/used equivalence,
   offline blocked behavior and no secret in URL/history/web storage;
6. password-manager/autocomplete/paste, keyboard/focus, axe on material states,
   320 px/reflow/long strings/reduced motion/forced-colors automation plus
   honest manual NVDA/Narrator/zoom/text-spacing rows;
7. docs/config/secrets/generated junk/private Stitch locator/log redaction,
   dependency audit, `git diff --check`, and exact task-owned cleanup.

P2 browser runs must disable trace, video and screenshots for credential/TOTP/
recovery-code flows unless an accepted redaction design proves artifacts safe;
raw authentication artifacts are never uploaded. Hosted CI retains literal
head checkout, Node 22, Windows static/unit/build/security, Ubuntu PostgreSQL +
Chromium, and one P2 aggregate gate.

The Frozen handoff and artifact-disabled P2 browser project now satisfy the
preconditions to run the single Level C. Merge-as-complete and issue #6 closure
remain deferred until that command and exact-head hosted CI pass.

## P2-S2 validation contract

The one stable-candidate command is:

```powershell
pnpm.cmd run validate:p2-s2
```

It cumulatively covers P1/P2-S1 regression; affected format/lint/type, unit and
contracts; Identity-owned real PostgreSQL invitation lifecycle, decoy
equivalence, concurrency, idempotency, membership and context conflicts;
production build; built web → Gateway → Identity → PostgreSQL; artifact-disabled
LB-008–LB-010 and P2-S1 browser/axe/keyboard/reflow/offline/security paths;
docs/config/secrets/dependency/diff checks; and PID-scoped resource cleanup.

The 2026-07-26 campaign invoked that command once. After P1 static, unit 38/38,
contracts 8/8, PostgreSQL 5/5 and build passed, a P1 fixture-readiness
compatibility defect stopped the command. Targeted Level B passed after the
fixture-safe correction. Already-green inputs were not rerun; P1 browser 4/4
and all remaining P2 gates resumed in the same campaign and passed: aggregate
unit 46/46, contracts 8/8, P2-S2 PostgreSQL 7/7, real-plus-mocked P2-S2 browser
7/7, P2-S1 browser 4/4, build/security/docs/config/secrets/diff and exact
cleanup. No second Level C command was issued.

Hosted CI must check out the literal PR head and run
`scripts/validate-p2-s2.ps1 -UseExistingDatabase -SkipInstall` before a merge
commit. The resulting `dev` merge SHA must pass the same hosted workflow.

## P2-S3 validation contract

The stable-candidate command is invoked exactly once:

```powershell
pnpm.cmd run validate:p2-s3
```

It includes only the affected cumulative slice evidence:

1. P1, P2-S1 and P2-S2 regression plus affected format, lint, type, unit and
   `P2-S3-v1` contract checks;
2. real Identity-owned PostgreSQL migration 003 upgrade/reapply, readiness,
   subject establishment, no-organizer-authority, no-backfill, race,
   idempotency, stale/conflict, strict narrowing and revoke-boundary behavior;
3. governed exact-scope reads before and after narrow/revoke, redacted
   subject-scoped audit pagination without totals, sealed cursor isolation,
   atomic privacy saves and privacy-safe outbox/log/metric/trace evidence;
4. production build and built web → Gateway → Identity → PostgreSQL real
   runtime, followed by mocked denial/conflict/unavailable/offline/no-queue,
   partial-failure recovery and success paths for LB-028–LB-031;
5. keyboard-only review/cancel, safe successor focus and announcements, axe,
   visible focus, 320 px reflow, 44 px targets, reduced-motion/forced-color CSS
   and no sensitive browser storage or test artifacts;
6. docs/config/secrets/dependency/private-locator/generated-junk/diff checks,
   runtime sensitive-value scan and exact PID/Compose/process/log cleanup.

Browser traces, screenshots and video remain disabled. Synthetic fixtures use
server UTC instants and validated IANA zones; they never contain a real care
record, consent value, credential, private Stitch locator or generated source.
Hosted CI checks out the literal head and runs
`scripts/validate-p2-s3.ps1 -UseExistingDatabase -SkipInstall`; the merge
commit on `dev` must pass the same aggregate workflow.

The 2026-07-26 local command was invoked once. P1 browser 4/4, affected unit
54/54, contracts 12/12, Identity PostgreSQL 9/9, transactional migration
rollback/reapply, production build, real-plus-mocked P2-S3 browser 8/8 and
P2-S2 browser 6/6 passed. The final P2-S1 group found a strict-locator
ambiguity and then a stale pre-factor status behind it. Targeted Level B
cleared that stale state, added a failed-preference/no-false-success assertion,
rebuilt the web app and passed P2-S1 browser 5/5. No second Level C invocation
or unchanged successful phase rerun occurred. The runtime log scan now runs
before later regression groups and nested P1 logs are included in exact
cleanup; exact-head hosted CI must prove that coherent ordering from scratch.

If the one campaign exposes a defect, classify it before editing and use the
smallest Level B proof for changed inputs rather than blindly replaying the
entire campaign. Manual NVDA/Narrator, physical-device/touch observation,
text-spacing and 200%/400% assistive-technology sessions remain KI-016.
Independent inspection of the private generated renders remains KI-019 and is
not replaced by claiming automated native tests prove visual parity.

An MCP becoming callable does not satisfy a test gate by itself. Close required
MCP debt only after secret handling, least-privilege/data-egress and complete
tool-schema review, one synthetic canary, and the affected slice validation are
recorded. Any open deploy-blocking MCP debt fails P11 release validation.

## P3-S1 validation contract

The stable candidate has exactly one Level C entry point:

```powershell
pnpm.cmd run validate:p3-s1
```

The one campaign includes:

1. affected formatting, lint, type, aggregate unit and `P3-S1-v1`
   provider/consumer contracts;
2. real Identity and Care PostgreSQL integration for current P2 authorization,
   DST 23/25-hour boundaries, equal timestamps, backward clock values, sealed
   cursor tamper/scope/version/expiry, keyset snapshot, concurrency,
   optimistic conflicts, idempotent replay/changed intent and completed-state
   rejection;
3. transactional Care migration 002 rollback, repeat apply, old P1 row
   preservation, latest-schema readiness and explicit no-backfill proof;
4. one built runtime journey from native web through Gateway, fresh P2
   authority, Care-owned PostgreSQL handoff transaction, outbox dispatch and
   Notification inbox/store, plus cumulative P1 and governed P2 regressions;
5. LB-012/LB-014 mocked empty/filter-empty/denied/unavailable/stale-cursor,
   conflict, uncertain-result/current-state recovery, success and offline
   no-queue paths in VI/EN;
6. semantic list/time controls, keyboard review and safe focus, live status,
   axe, 44 px targets, 320 CSS px reflow, long-offset time rendering,
   reduced-motion/forced-colors CSS and artifact-disabled Playwright;
7. privacy-safe runtime-log scanning, docs/config/secrets/dependency/diff
   gates, generated-artifact checks and exact PID/Compose/process/log cleanup.

The runtime uses Node 22, pinned PostgreSQL 17 and production builds. Trace,
screenshots and video remain off. Local Level C result, any classified targeted
Level B recovery, exact-head hosted runs and post-merge evidence belong in
`docs/SESSION_LOG.md`; do not rerun unchanged successful phases.

Manual NVDA/Narrator, physical-device, text-spacing, forced-colors and
200%/400% assistive-technology sessions remain KI-016. Independent inspection
of private Stitch renders remains KI-019 and cannot be replaced by automated
visual-parity claims.

## P4-S2 Level C campaign

Exactly one `pnpm.cmd run validate:p4-s2` campaign proves cumulative P1 through
P4-S2 formatting, lint, type, unit, contract, docs, config, secrets,
dependency, build, PostgreSQL integration/migration and browser gates. The
new slice evidence covers:

1. all eight fresh exact-purpose Identity/Gateway/Care authority paths and
   zero owner calls after denial;
2. complete ordered-list replacement, per-item and aggregate optimistic
   revisions, concurrency, idempotency and sealed authority-bound history;
3. plan no-plan/draft/review-required/reviewed states, immutable versions,
   contact-revision invalidation and server/IANA confirmation facts;
4. minimum contact/plan projections, content-free suppressed events,
   privacy-safe audit/idempotency/log evidence and atomic rollback;
5. migration 006 forced rollback, repeat apply, retained legacy state and no
   unintended emergency backfill;
6. explicit passphrase opt-in, PBKDF2-HMAC-SHA-256 at 600,000 iterations,
   AES-256-GCM, write/decrypt/read-back verification, route/scope/source/
   version integrity and online denial/supersession purge;
7. 24-hour recent, through-72-hour stale, backward-clock unknown and expiry
   hiding/purge truth; wrong-passphrase and integrity recovery never expose
   protected content;
8. shell-only service-worker interception, no API cache/background write
   retry, mocked and real offline Chromium paths and local cleanup;
9. native VI/EN keyboard order, review focus, semantic ordered lists,
   text/icon/colour source distinction, 44 px controls, 320 CSS px reflow,
   axe, reduced-motion and forced-colours evidence.

Workers remain one, retries zero, and trace/screenshot/video are off. A failed
campaign is classified before only the smallest targeted recovery; a second
Level C is prohibited. Manual assistive-technology evidence remains KI-016 and
private Stitch pixel inspection remains KI-019.

## P3-S3 Level C campaign

Exactly one `pnpm.cmd run validate:p3-s3` campaign proves cumulative P1 through
P3-S3 format/lint/type/unit/contract/docs/config/secrets/dependency/build gates;
real Care/Identity/Notification PostgreSQL integrations; migration v4 forced
rollback, repeat apply, legacy migration reapply and no backfill; ordinary,
23-hour and 25-hour local review-day facts; shared-draft/confirm concurrency and
idempotency; atomic version/audit/outbox evidence; privacy-safe logs; and
artifact-disabled Chromium. P3-S3 browser coverage includes mocked VI/EN,
current plus draft, semantic history, overdue, denied, unavailable, offline,
conflict, uncertain recovery, axe/reflow/forced-colour/reduced-motion semantics,
plus a real Gateway→Identity→Care consent/grant/confirm/revoke journey. Workers
remain one, retries zero, and trace/screenshot/video off. Only classified
targeted recovery may follow an unproven failure; successful full gates are not
rerun merely because output detached.
