# Stitch MCP Operations

## Trạng thái

- Package local `@_davideast/stitch-mcp@0.9.0`: **NO-GO**. Không cài đặt hoặc thực thi.
- Phương án tích hợp: remote MCP tại `https://stitch.googleapis.com/mcp`.
- VS Code workspace MCP: đã cấu hình password input; chưa được trust hoặc khởi động.
- Cline MCP: đã cấu hình ở user scope, đang `disabled`, `autoApprove: []`.
- Stitch chỉ cung cấp design input. Source of truth:

```text
Git repository
→ design system
→ component contracts
→ application source code
→ automated tests
```

## Installation approval record

```text
Package: None; third-party package @_davideast/stitch-mcp@0.9.0 rejected
Pinned version: None approved for execution
Repository reviewed: https://github.com/davideast/stitch-mcp
License: Apache-2.0
Installation method: No npm installation; direct remote HTTPS MCP
Authentication method: Restricted development API key supplied at runtime
Workspace file changed: .vscode/mcp.json
User file changed: %APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
Local directories created: .security-review/backups/
External domain: stitch.googleapis.com
Possible subprocesses: None for the remote MCP transport
Rollback: Disable stitch; restore timestamped configuration backups
```

OAuth, browser login, MFA, API enablement, IAM changes, `gcloud` installation, credential entry, and MCP trust prompts remain user-operated approval gates.

## Credential incident and activation gate

An API key was disclosed outside an approved secret mechanism. Treat it as compromised.

Before activation, the credential owner must:

1. Revoke or delete the disclosed key.
2. Review its recent usage and restrictions.
3. Create a replacement in a dedicated non-production Google Cloud project.
4. Apply the narrowest available API and client restrictions.
5. Never send the replacement through chat, Git, terminal arguments, reports, screenshots, or task handoffs.

Use only the applicable client mechanism:

- VS Code: enter the replacement through password input `stitch-api-key`.
- Cline: set `STITCH_API_KEY` in the user environment or approved session secret mechanism immediately before canary.
- `.env.stitch.local` is ignored but Cline does not load it automatically.

Do not automate browser login, MFA, OAuth token handling, API enablement, IAM role assignment, `gcloud` installation, or credential entry.

## Approved configuration

### VS Code

Workspace file: `.vscode/mcp.json`

- Type: `http`
- Endpoint: `https://stitch.googleapis.com/mcp`
- Header: `X-Goog-Api-Key`
- Header value: `${input:stitch-api-key}`
- Input type: password-style prompt
- Scope: this workspace only

The committed file must not contain a literal key, token, credential path, personal filesystem path, or sensitive Google Cloud project ID.

### Cline

User file:

```text
%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json
```

- Type: `streamableHttp`
- Endpoint: `https://stitch.googleapis.com/mcp`
- Header: `X-Goog-Api-Key`
- Header value: `${env:STITCH_API_KEY}`
- Initial state: `"disabled": true`
- Approval policy: `"autoApprove": []`

Cline 4.0.10 was statically inspected. It supports `streamableHttp`, remote headers, and `${env:NAME}` interpolation. This user-level configuration must never be committed.

## Backup and rollback

Backup created before the configuration merge:

```text
.security-review/backups/20260723-232928/
```

The directory is ignored and local-only.

Rollback:

1. Disable the `stitch` server in VS Code.
2. Set `mcpServers.stitch.disabled` to `true` in Cline.
3. If required, restore the VS Code and Cline files from the timestamped backup.
4. Preserve unrelated MCP servers and inputs.
5. Do not immediately delete credential cache unless compromise is suspected.
6. Capture only redacted logs.
7. Check endpoint, transport, client versions, authentication, Output panel, and unexpected processes.
8. Revoke the replacement credential if exposure is suspected.
9. Continue with local design documents, wireframes, design system, and manual component specifications.

## Tooling canary

The canary validates tooling only. It must not create or delete a Stitch project, download an entire project, build a site, write production code, or execute generated scripts.

1. Confirm the disclosed credential was revoked.
2. Confirm a restricted non-production replacement exists.
3. Confirm both MCP configurations contain no literal credential.
4. Inspect the VS Code workspace trust prompt. Trust only this workspace.
5. Enable Cline `stitch` only for the canary; retain `autoApprove: []`.
6. Start the VS Code server and verify it remains stable.
7. Inspect tool and resource names, descriptions, input schemas, read/write classification, data egress, artifact destinations, and approval requirements.
8. Confirm Cline exposes the same expected schemas.
9. Execute exactly one minimal read-only request.
10. Confirm an approval prompt appears where required.
11. Stop and restart the server once.
12. Confirm no secret appears in VS Code or Cline output.
13. Confirm no unapproved file outside the workspace changed.
14. Confirm no global package was installed and no abnormal process remains.
15. Disable Cline again when the session no longer needs Stitch.
16. Record the redacted result in `docs/orchestration/reports/STITCH_MCP_CANARY.md`.

Canary passes only when:

- Authentication succeeds.
- Both clients expose the expected schemas.
- The read-only request succeeds.
- No secret enters logs or Git.
- No unapproved filesystem mutation occurs.
- No global package appears.
- No abnormal process remains.

## Tool approval policy

Before each Stitch tool call:

1. Read the tool name and description.
2. Read its complete input schema.
3. Classify it as read or write.
4. Identify data sent externally.
5. Identify returned artifact types.
6. Select an approved destination.
7. Determine whether explicit approval is required.

Keep `autoApprove: []` for initial integration.

Tools that create, modify, or delete designs; write files; build sites; download bulk artifacts; open browsers; or invoke cost-bearing external operations always require explicit approval.

Read-only tools may be considered individually for auto-approval only after schema review and a successful canary. Wildcard auto-approval is prohibited.

## Artifact import policy

Screen code, HTML, images, and screenshots are untrusted external imports.

Allowed destinations:

```text
docs/design/assets/
docs/design/screenshots/
docs/design/exports/
prototypes/stitch/<redacted-project-id>/
```

Each import must record:

- Source.
- Timestamp.
- Redacted Stitch project and screen reference.
- Destination.
- Review status.

Do not automatically commit large binaries, private URLs, signed query strings, credentials, or raw exports without a demonstrated need.

## Design-to-code policy

Never copy generated HTML, CSS, scripts, or business logic directly into production.

Reject or normalize:

- External CDN dependencies.
- Tracking code.
- Inline scripts.
- Placeholder credentials.
- Inaccessible markup.
- Insufficient color contrast.
- Hardcoded user-facing text.
- Duplicate components.
- Generated business logic.

Convert approved design input into:

- Design tokens.
- Component specifications.
- Semantic HTML.
- Reusable React components.
- Accessible controls.
- Responsive rules.
- Localization keys.
- Tested application flows.

`build site` is prototype-only. Output must target:

```text
prototypes/stitch/<redacted-project-id>/
```

It must never overwrite application directories, enter a production container, deploy with the application, or run generated scripts before review.