# Google Stitch MCP — Codex App Operations

## Purpose / Mục đích

This is the active Windows-only runbook for using Google Stitch as design input
from the Codex ChatGPT desktop app.

Đây là runbook đang có hiệu lực trên Windows để dùng Google Stitch làm đầu vào
thiết kế từ ứng dụng Codex ChatGPT.

Stitch is not the source of truth for production code. Approved artifacts are
normalized into repository-owned design tokens, component contracts,
localization keys, accessible interactions, and tests.

## Current status

| Control                                    | Status                                     |
| ------------------------------------------ | ------------------------------------------ |
| Third-party `@_davideast/stitch-mcp@0.9.0` | `NO-GO`; do not install or execute         |
| Official remote endpoint                   | Configured, disabled                       |
| Project configuration                      | `.codex/config.toml`                       |
| Literal credential in Git                  | Prohibited; none required by configuration |
| Codex App tool discovery                   | Not run                                    |
| Read-only canary                           | Not run                                    |
| Design-generation calls                    | Blocked                                    |

The old VS Code/Cline workflow is historical evidence only. Cline, 9Router,
macOS, and user-level VS Code configuration are outside the active LifeBridge
delivery path.

## Configuration contract

Codex App, Codex CLI, and the IDE extension share Codex configuration layers.
LifeBridge uses the trusted-repository layer:

```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"
env_http_headers = { "X-Goog-Api-Key" = "STITCH_API_KEY" }
enabled = false
required = false
default_tools_approval_mode = "prompt"
startup_timeout_sec = 20
tool_timeout_sec = 60
```

The committed file contains only the environment-variable name. It must never
contain an API key, OAuth token, cookie, signed URL, credential path, private
project identifier, or real care data.

## Credential gate

Before enabling the server, the credential owner must confirm all of the
following:

1. The previously disclosed key was revoked.
2. Recent usage and restrictions were reviewed.
3. A replacement key exists in a dedicated non-production Google Cloud project.
4. The replacement is restricted to the narrowest supported API and client
   boundary.
5. The replacement is supplied to the Codex App process through an approved
   Windows secret/runtime mechanism, never through chat, Git, Markdown,
   screenshots, command arguments, or task handoffs.

Do not modify Windows Registry, system services, global PowerShell execution
policy, firewall rules, or machine-wide credential configuration to satisfy this
gate.

## Offline checks

Before any network call:

1. Parse `.codex/config.toml`.
2. Confirm the endpoint host is exactly `stitch.googleapis.com`.
3. Confirm `enabled = false` until the live canary is approved.
4. Confirm `default_tools_approval_mode = "prompt"`.
5. Confirm the header value resolves from `STITCH_API_KEY`, not a literal.
6. Scan the working tree and staged diff for credential patterns.
7. Record the result without recording a secret value.

## Live read-only canary

The live canary is a separate approval gate because it authenticates and sends
data to an external service.

After approval:

1. Enable the server for the approved session.
2. Restart or open a new Codex task if required for configuration discovery.
3. Inspect every exposed tool name, description, complete schema, annotations,
   side effects, data egress, returned artifacts, and possible quota/cost.
4. Run exactly one minimal read-only request using synthetic, non-sensitive
   content.
5. Verify that no project, screen, design, file, browser action, export, or
   billable generation was created.
6. Inspect redacted logs and Git status.
7. Confirm no unexpected process, package, or file appeared.
8. Disable the server again if design work is not beginning immediately.
9. Record evidence in
   `docs/orchestration/reports/STITCH_CODEX_APP_CANARY.md`.

Schema discovery is not proof of a passed canary. A canary passes only when
authentication, schema review, the approved read-only request, log hygiene, and
filesystem checks all pass.

## Tool policy

Every Stitch call starts in prompt mode.

Explicit approval is always required for a tool that can:

- create, update, archive, or delete a project or screen;
- generate a design;
- export or bulk-download code, HTML, images, or project artifacts;
- write files or open a browser;
- build or deploy a site;
- incur material quota or cost.

Read-only approval may be relaxed per named tool only after its exact schema and
behavior pass review. Wildcard approval is prohibited.

## Design workflow

```text
approved product requirement
→ route/API/data/permission/error contracts
→ synthetic Stitch prompt
→ generated design reference
→ product/accessibility/privacy review
→ design freeze
→ component specification
→ project-native frontend implementation
→ slice validation
```

Generated HTML, scripts, business logic, tracking, CDN dependencies, credentials,
and inaccessible markup are untrusted inputs. They must not be copied directly
into production.

## Artifact boundary

Approved imports may be stored only under:

```text
docs/design/assets/
docs/design/screenshots/
docs/design/exports/
prototypes/stitch/<redacted-project-id>/
```

Each import records source, retrieval timestamp, redacted project/screen
reference, destination, license or usage restriction, review status, and
checksum when useful. Large binaries and private signed URLs are not committed.

## Rollback

1. Set `mcp_servers.stitch.enabled = false`.
2. Restart Codex App if required.
3. Preserve redacted evidence; do not delete caches blindly.
4. Review endpoint, auth, schemas, logs, filesystem changes, processes, and
   package state.
5. Revoke the replacement credential if exposure is suspected.
6. Continue with local wireframes and repository-native specifications.

Stitch unavailability must not block backend contracts, research, accessibility
requirements, or local design work.
