# Known Issues

## P8-S3 local validation note — 2026-08-02

The sole Level C command failed before runner initialization because an extra
pnpm separator duplicated `SkipInstall`; no marker/resource was created and no
second Level C was launched. Classified continuation passed every local static,
Node, Java-provider, security and build stage. Local PostgreSQL Community tests
remained unavailable/skipped. Both exact-head workflows and automatic dev run
`30739630918` passed hosted PostgreSQL/mixed-runtime proof. No production,
legal or certification claim is inferred.

P7-S2 introduces no new accepted exception. Local PostgreSQL unavailability was
classified by the single Level C and satisfied by exact-head plus automatic
post-merge hosted PostgreSQL proof. Existing release gates remain unchanged.

## P7-S1 candidate environment note — 2026-08-02

Local Docker/PostgreSQL destructive proof remains unavailable under the
accepted environment limitation. The exact-head hosted PostgreSQL/Flyway job
is mandatory before P7-S1 acceptance. This note authorizes no P7-S2/P7-S3 work.

Updated: 2026-08-02

P5-S3 note: KI-001 and KI-016 remain unchanged. KI-019 also covers the two
synthetic LB-027 references; their metadata was read once, but independent
private-pixel inspection remains unavailable, so no standalone visual-
conformance claim is made.

| ID     | Severity             | Status                                         | Issue                                                                                                                                                                                                                                                                                                                                                                      | Impact / next action                                                                                                                                                                                               |
| ------ | -------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| KI-001 | High; deploy blocker | Open; retirement review unconfirmed            | `CHG-2026-006` authorized one session-scoped use of a disposable non-production Stitch key; repository, configuration, issue, log, and handoff scans contain no credential value                                                                                                                                                                                           | Confirm retirement/revocation and review provider usage before any deployment; never reuse, persist, or promote it as a production credential                                                                      |
| KI-002 | Medium               | Resolved for P1 integration                    | Official Stitch MCP review references for `LB-011`, `LB-013`, `LB-014`, applicable `LB-019`, and mobile variants are frozen through repository-native P1-S1 handoff v1.0                                                                                                                                                                                                   | P1 browser/privacy/security evidence passed; manual accessibility remains KI-016 and any new visual direction reopens the design-review gate                                                                       |
| KI-003 | High                 | Resolved; ownership guard retained             | P5-S1 checkpoint and canonical updates reconfirm `STITCH_MCP_CANARY.md` has no worktree/index diff; the task does not own, stage, commit or overwrite it                                                                                                                                                                                                                   | Preserve the ownership guard; do not stage or rewrite the canary without explicit ownership approval                                                                                                               |
| KI-004 | Medium               | Open locally; hosted proof satisfied for P6-S3 | P6-S3 read-only `docker version` found the Docker Desktop Linux engine pipe absent in this task. No machine-wide remediation was attempted. PR #77 exact-head and post-merge run `30724770738` passed hosted image/upgrade and authenticated failure-path proof.                                                                                                           | Keep local absence classified as environment-only; never alter Docker service, Registry, firewall, ACLs, users, global config, or Administrator state                                                              |
| KI-005 | Medium               | Mitigated                                      | PowerShell blocks `npm.ps1` and `npx.ps1` under current execution policy                                                                                                                                                                                                                                                                                                   | Use `.cmd` shims; do not change machine or user Execution Policy                                                                                                                                                   |
| KI-006 | Low                  | Open; non-blocking                             | `gh` and PowerShell 7 are absent; the GitHub App connector could not see the private repository during P3-S1 or P3-S2, while the authorized signed-in browser completed PR/check/merge/issue operations                                                                                                                                                                    | Treat optional CLI/connector visibility as non-blocking; use an already-authorized repository surface, never install global tools or change credentials automatically                                              |
| KI-007 | Medium               | Open                                           | Existing design inventory contains 35 screens, much broader than MVP                                                                                                                                                                                                                                                                                                       | Keep as backlog; design/implement only screens required by the active vertical slice                                                                                                                               |
| KI-008 | Medium               | Resolved                                       | The P0 foundation/planning overlay converged into `dev` through PR #21; P1 later converged through PR #42 as merge commit `cea4f83`                                                                                                                                                                                                                                        | Keep every later `phase/* → dev` promotion PR-only with exact-head CI and merge-commit topology                                                                                                                    |
| KI-009 | Low                  | Accepted temporarily                           | Ignored `.security-review/` contains about 87 MB of package evidence/backups                                                                                                                                                                                                                                                                                               | Exclude from scans/maps; preserve until credential/package incident review is closed                                                                                                                               |
| KI-010 | Medium               | Resolved for P1 integration                    | P1-S1 application code, owner-isolated migrations, PostgreSQL/browser suites and production builds passed local Level C, exact-head PR CI and post-merge `dev` CI                                                                                                                                                                                                          | This is integration evidence only; public or production deployment remains gated by P11 and cannot be inferred from P1                                                                                             |
| KI-011 | Medium               | Controlled                                     | The supplied 16-phase/85-slice runbook contains unverified source/status claims and highly repetitive generic edge matrices                                                                                                                                                                                                                                                | Use only the reviewed overlay/crosswalk; re-verify candidate sources on `init/research`; do not import it as canonical state                                                                                       |
| KI-012 | High                 | Resolved                                       | Guarded workflow-only PR #41 registered hosted CI; P1 PR #42 exact-head run `30183168519` and post-merge `dev` run `30183280672` succeeded                                                                                                                                                                                                                                 | Retain the hosted exact-head aggregate gate for every later PR; do not infer branch protection from workflow availability                                                                                          |
| KI-013 | Medium               | Resolved                                       | `CHG-2026-004` required the production P6–P12 GitHub catalog to replace the old overloaded P6 execution state                                                                                                                                                                                                                                                              | Three labels, P6–P12 milestones, 21 slice issues, #18–#20 remaps, and standing gate #40 were applied and audited on 2026-07-26                                                                                     |
| KI-014 | Medium               | Controlled; platform limitation                | GitHub reports every branch unprotected, and the private-repository branch-protection API requires a higher plan or public visibility                                                                                                                                                                                                                                      | Enforce PR-only and merge-commit topology through review/manual governance; never claim platform enforcement; reassess when repository plan/visibility changes                                                     |
| KI-015 | Low                  | Mitigated; hosted validation passed            | Next 16.2.11 cannot select patched Sharp 0.35, so unused optional `sharp` is excluded from the P1 install graph and remains lifecycle-denied; scoped PostCSS 8.5.18 patch passes audit/build/runtime/browser                                                                                                                                                               | Reopen before any `next/image`/server image feature; prefer a Next release that natively supports patched dependencies and retire the scoped PostCSS override when proven                                          |
| KI-016 | Low                  | Open; non-blocking for integration             | Automated axe, keyboard/focus, 320 px reflow, locale, contrast, forced-colors/reduced-motion CSS and 44 px target evidence spans accepted slices; manual NVDA/Narrator, physical-device, text-spacing and 200%/400% assistive-technology sessions remain unexecuted                                                                                                        | Record those manual rows before any pilot/release claim; do not describe browser automation as full WCAG, physical-device or screen-reader conformance                                                             |
| KI-017 | High; P2 blocker     | Resolved                                       | `MCP-DEBT-2026-002`: official schema review, seven bounded synthetic Stitch generations, Frozen redacted handoff, native UI, single P2 Level C, exact-head CI and merge-commit promotion passed without secret/private-locator/generated-source persistence                                                                                                                | Retain the redacted handoff and artifact-disabled auth browser policy; deployment remains separately gated and manual assistive-technology evidence remains KI-016                                                 |
| KI-018 | High; P2-S2 blocker  | Resolved for promotion; deploy still gated     | `MCP-DEBT-2026-003`: synthetic LB-008–LB-010 handoff, native UI, local Level C, exact-head CI, PR #47 merge, post-merge `dev` CI and issue #7 closeout passed without locator/source persistence                                                                                                                                                                           | Retain the 600-second policy and redacted handoff; KI-001 blocks deployment and KI-016 retains manual assistive-technology evidence                                                                                |
| KI-019 | Low                  | Open; non-blocking for corrected native proof  | LB-028–LB-031 and the reference sets through P5-S3, including P5-S1 LB-022/LB-024, P5-S2 LB-025/LB-026 and two synthetic LB-027 references, exist once in the private Stitch project, but independent reviewers could not inspect private rendered pixels; native evidence must not treat them as standalone visual approval                                               | Do not regenerate or persist locators/source; retain native axe/keyboard/focus/reflow/contrast/reduced-motion/privacy evidence and perform a bounded independent visual review before any visual-conformance claim |
| KI-020 | High; deploy blocker | Open; bounded integration evidence only        | P4-S3 intentionally has no malware scanner and keeps bounded bytes in PostgreSQL. Local/hosted-CI logical restore proves pre-delete owner recovery and a post-delete snapshot does not resurrect active content, but production at-rest/backup encryption, historical-backup retirement, deletion reconciliation, stale-processing cleanup and RPO/RTO are not implemented | Do not deploy the vault or make clean/safe/complete-erasure/recovery claims. Select and validate production controls through a fresh official-source review and accepted ADR before P11 deployment work            |

Closed items remain in session/integration history rather than being silently
removed. Update this file after every slice when status or mitigation changes.

# P7-S3 policy decision and local environment note — 2026-08-02

The product owner delegated and accepted a conservative engineering disposition
matrix: product export only, 24-hour export artifacts, 30-day backup artifacts,
and bounded evidence retention up to 365 days. This resolves the product gate
without claiming statutory compliance. Actual legal-hold/statutory-retention
applicability remains counsel-owned; any requested override fails closed with
`POLICY_DECISION_REQUIRED`. A targeted local PostgreSQL rehearsal could not
start because the Docker Desktop Linux engine was unavailable. No resource was
created; hosted PostgreSQL proof is required.

The initial Level C command also failed before runner initialization because an
extra pnpm argument separator produced duplicate `SkipInstall` binding. There
is no marker or stage evidence and no product failure. The exactly-once guard
prevents silently launching a corrected second command without owner approval.

The owner granted that explicit exception. The corrected invocation completed
with `passed_with_hosted_postgres_required`; only the already-recorded local
Docker engine limitation remains, and hosted PostgreSQL proof is now the next
required gate.

Exact-head push/PR and automatic post-merge dev PostgreSQL evidence subsequently
passed. The local Docker absence remains an environment note, not a P7-S3
acceptance blocker. Production deployment still depends on later P11/P12 gates;
P7-S3 does not claim live infrastructure, legal advice or regulatory compliance.

# P8-S1 local PostgreSQL environment note — 2026-08-02

Docker Desktop's Linux engine is unavailable in this session. Focused static,
unit and contract proof runs locally; exact-head PostgreSQL/mixed-runtime jobs
passed in runs `30735140477`/`30735160950`, and automatic dev run `30735583092`
passed the same heavy path. This is an environment classification, not a
skipped hosted requirement or compliance claim.

# P8-S2 local container/PostgreSQL environment note — 2026-08-02

The sole Level C classified the unavailable local Docker/PostgreSQL proof as
hosted-required. Exact-head runs `30737326707`/`30737393207` and automatic dev
run `30737823547` passed the independent container, PostgreSQL/mixed-runtime,
runtime, SBOM/provenance and cumulative gates. The local absence is therefore
an environment note, not a skipped requirement. Production key custody,
trusted signing and storage-at-rest selection remain later decision gates; no
provider, certification, SLSA level or deployment claim is inferred.

# P9-S1 open acceptance dependencies (2026-08-02)

- Local Docker/PostgreSQL availability remains an environment note only; exact-head and post-merge hosted P9-S1 jobs passed the mixed Node/Spring/PostgreSQL durable-path proof.
- The GitHub connector installation does not see the private repository, but the authenticated in-app browser does. Issue #31 was verified and reconciled in place; promotion will use the authenticated repository UI/ordinary Git transport without creating a duplicate.
- No production telemetry collector or enforceable repository retention store exists. Inventory truthfully assigns stdout/CI access and retention to the execution environment; this is not a compliance claim.
