# Stitch MCP Tooling Canary

## Status

```text
Result: BLOCKED — NOT RUN
Date: 2026-07-23
Scope: Tooling only; no application behavior validated
Workspace: LifeBridge
Operating system: Windows 11
Transport under review: Remote HTTPS MCP
Endpoint: https://stitch.googleapis.com/mcp
Authentication: Not attempted
VS Code server: Configured; not trusted or started
Cline server: Configured during bootstrap; disabled at last verified state
Read-only request: Not executed
Remote project mutation: None
Artifact import: None
Production-code mutation by Stitch: None
```

This is a blocked pre-canary record, not evidence of successful integration.

No Stitch MCP request was sent as part of this canary. No live tool/resource schema was retrieved. No project was created, listed, modified, archived, deleted, downloaded, exported, or built. No OAuth flow, browser login, MFA, Google Cloud API enablement, IAM change, `gcloud` operation, package installation, generated-script execution, or artifact import occurred.

## Blocking incident

An API key was disclosed in plaintext outside an approved secret mechanism. Treat it as compromised.

The disclosed key is intentionally omitted. It was not used for this canary.

Before activation, the credential owner must:

1. Revoke or delete the disclosed key.
2. Review its recent usage and restrictions.
3. Create a replacement only in a dedicated non-production Google Cloud project.
4. Apply the narrowest supported API and client restrictions.
5. Enter the replacement only through an approved runtime secret mechanism.
6. Never place the replacement in chat, Git, terminal arguments, source files, committed MCP configuration, screenshots, reports, prompts, or handoffs.

Approved runtime mechanisms:

```text
VS Code: password input `stitch-api-key`
Cline: approved user/session environment secret `STITCH_API_KEY`
```

`.env.stitch.local` is ignored but is not automatically loaded by Cline.

## Security disposition

| Subject | Disposition |
|---|---|
| `@_davideast/stitch-mcp@0.9.0` | **NO-GO**; do not install or execute |
| Approved local npm executable version | None |
| Floating or unversioned `npx` | Prohibited |
| Global npm installation | Prohibited |
| Direct remote HTTPS MCP | Configured but inactive; canary-gated |
| API key in configuration, Git, logs, or reports | Prohibited |
| OAuth/browser/MFA/API enablement/IAM changes | User-operated only |
| Cline wildcard auto-approval | Prohibited |
| Write-tool auto-approval | Prohibited during initial integration |
| Generated Stitch code in production | Prohibited without normalization and review |

Do not run:

```text
npx -y @_davideast/stitch-mcp@0.9.0 doctor
npx -y @_davideast/stitch-mcp@0.9.0 doctor --verbose
npx -y @_davideast/stitch-mcp@0.9.0 proxy
```

Supporting evidence:

```text
docs/orchestration/reports/STITCH_MCP_SECURITY_REVIEW.md
docs/orchestration/STITCH_MCP_OPERATIONS.md
docs/design/STITCH_PROJECTS.md
```

## Gate status

| Gate | Required evidence | Status |
|---|---|---|
| Disclosed key revoked/deleted | Owner confirmation plus usage/restriction review | Blocked |
| Restricted replacement credential | Dedicated non-production project; least privilege | Blocked |
| Secure runtime entry | VS Code password input or approved Cline session secret | Blocked |
| Workspace config contains no literal secret | Parse and policy check immediately before activation | Pass at pre-canary review; recheck before activation |
| Cline config contains no literal secret | Parse and policy check immediately before activation | Pass at pre-canary review; recheck before activation |
| VS Code workspace trust | User reviews endpoint and trusts this workspace only | Blocked |
| Cline activation | Enable only for approved canary | Blocked |
| Cline `autoApprove` | Must remain `[]` | Pass at pre-canary review; recheck before activation |
| Live tool/resource schema review | Names, descriptions, schemas, side effects, egress, artifacts, cost | Blocked |
| Read-only call approval | Exact tool and synthetic request approved | Blocked |
| MCP sandbox | Enable if supported; otherwise retain per-call approval | Client verification required |
| Baseline capture | Filesystem, process, Git, and global-package state | Pending execution |

On 2026-07-24, the current Cline user configuration and workspace MCP configuration were reread, parsed, and policy-checked. Cline `stitch` remained disabled with `autoApprove: []`; both configurations referenced runtime secret mechanisms and contained no literal API key. Repeat these checks immediately before activation because user-level configuration can change independently of Git.

## Approved first-canary boundary

Once all blockers are cleared, the first canary may perform only:

1. Server discovery and connection observation in VS Code and Cline.
2. Live tool/resource schema inspection.
3. Exactly one minimal read-only request using synthetic, minimum-necessary data.
4. One orderly stop and restart.
5. Redacted log, filesystem, package, process, and configuration verification.

The first canary must not:

- Create, update, archive, delete, or build a Stitch project or screen.
- Retrieve a whole project or bulk artifacts.
- Import HTML, code, screenshots, images, exports, or binaries.
- Execute generated scripts or dependencies.
- Write production code.
- Install any Stitch package locally or globally.
- Start OAuth, browser login, MFA, `gcloud`, API enablement, or IAM changes.
- Enable wildcard or write-tool auto-approval.
- Send real personal, care-recipient, medication, emergency, document, moderation, production, credential, signed-URL, or private-link data.

## Execution procedure after unblock

1. Confirm disclosed-key revocation and usage review outside the repository.
2. Confirm a restricted replacement exists in a dedicated non-production project.
3. Capture pre-canary Git, filesystem, process, and global npm package baselines.
4. Reread and parse `.vscode/mcp.json`.
5. Reread, redact, and parse the current Cline MCP configuration.
6. Confirm neither configuration contains a literal credential.
7. Confirm Cline `stitch` is disabled and `autoApprove` is `[]`.
8. User enters the replacement through the approved VS Code runtime prompt.
9. User exposes `STITCH_API_KEY` only to the approved Cline host/session without printing or persisting it.
10. User reviews the VS Code trust prompt and trusts only this workspace.
11. Enable Cline `stitch` only for this canary.
12. Start the VS Code remote server and confirm stable transport.
13. Record each live tool/resource name, description, complete schema, classification, data egress, artifacts, destinations, side effects, and cost behavior.
14. Independently confirm the expected schemas in Cline.
15. Select exactly one minimal read-only operation.
16. Record its synthetic request classification and obtain explicit approval.
17. Execute the request and inspect the response without persisting sensitive content.
18. Stop and restart the server once.
19. Scan VS Code Output and Cline output for secret leakage; retain redacted evidence only.
20. Compare post-canary filesystem, process, Git, and global-package states with the baseline.
21. Disable Cline `stitch` after the approved session.
22. Update this report with observed, redacted evidence only.

## Live schema review

Pending activation.

| Tool/resource | Description reviewed | Complete schema reviewed | Classification | Data sent externally | Returned artifact | Cost/side effect | Approval policy | Result |
|---|---|---|---|---|---|---|---|---|
| Pending | No | No | Unknown | Unknown | Unknown | Unknown | Explicit approval required | Not run |

## Required observation record

Complete only during an approved canary:

```text
Execution start/end:
Operator:
Credential revocation confirmed:
Replacement restrictions verified:
Credential never printed or persisted:
VS Code version:
Cline version:
Operating system:
Sandbox status:
VS Code workspace trust decision:
VS Code server status:
Cline server status:
Cline autoApprove verified:
Tools visible in VS Code:
Resources visible in VS Code:
Tools visible in Cline:
Resources visible in Cline:
Selected tool:
Description reviewed:
Complete schema reviewed:
Classification: Read | Write
Data sent externally:
Request data classification:
Returned artifact:
Artifact destination:
Cost/quota implication:
Explicit approval:
Approval prompt observed:
Read-only result:
Stop/restart result:
Secret scan:
Workspace mutation scan:
Outside-workspace mutation scan:
Global package scan:
Process scan:
Remote project mutation:
Artifact import:
Production-code mutation:
Unexpected network destination:
Cline disabled after session:
Result: Pass | Fail | Blocked
Failure details:
Rollback performed:
Redacted evidence location:
Reviewer:
```

## Pass criteria

Mark `PASS` only when all conditions have evidence:

- Authentication succeeds with a restricted replacement credential.
- VS Code and Cline expose stable, expected schemas.
- Exactly one approved minimal read-only request succeeds.
- Required approval behavior appears.
- Write tools remain outside auto-approval.
- The server survives start, stop, and restart.
- No secret appears in Git, configuration, output, logs, screenshots, terminal history, reports, handoffs, or artifact metadata.
- No unapproved workspace or outside-workspace mutation occurs.
- No global package is installed.
- No abnormal process remains.
- No remote project/screen mutation, artifact import, generated-code execution, or production-code change occurs.
- Cline is disabled after the limited session.
- Evidence is redacted and reviewed.

## Failure and rollback

On failure:

1. Stop or disable `stitch` in VS Code.
2. Set Cline `mcpServers.stitch.disabled` to `true`.
3. Do not retry repeatedly, switch to `latest`, or install the rejected package.
4. Capture redacted logs only.
5. Inspect endpoint, transport, client versions, authentication, schemas, output, filesystem, packages, and processes.
6. Restore relevant configuration from:

```text
.security-review/backups/20260723-232928/
```

7. Revoke the replacement credential if exposure is suspected.
8. Continue with local design documents, wireframes, the design system, and manual component specifications.

## Current decision

```text
Canary: BLOCKED / NOT PASSED
Reason: Credential revocation/replacement, runtime secret entry, workspace trust, live schema review, and explicit read-only approval remain incomplete.
Project operations: Blocked
Artifact import: Blocked
Production implementation: Unaffected
Fallback: Local wireframes → design system → component specifications
```
