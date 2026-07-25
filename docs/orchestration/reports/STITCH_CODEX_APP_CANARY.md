# Stitch MCP Codex App Canary

## Status

```text
Result: BLOCKED — NOT RUN
Date: 2026-07-25
Client: Codex ChatGPT desktop app on Windows
Endpoint: https://stitch.googleapis.com/mcp
Configuration: .codex/config.toml
Authentication: Not attempted
Tool discovery: Not attempted
Read-only request: Not attempted
Remote mutation: None requested
```

## Blocking controls

- [ ] Credential owner confirms the disclosed key was revoked.
- [ ] Credential owner confirms recent usage and restrictions were reviewed.
- [ ] Restricted non-production replacement credential exists.
- [x] Repository configuration contains no literal credential.
- [x] Server is disabled by default.
- [x] Default tool approval mode is `prompt`.
- [ ] Codex App process receives the replacement through an approved runtime
      secret mechanism.
- [ ] Exact schema-discovery action is approved.
- [ ] Exact synthetic read-only canary request is approved.

## Required evidence after execution

Record only redacted facts:

```text
Execution time:
Codex App version:
Server initialized:
Authentication result:
Tools/resources observed:
Schema review result:
Read-only tool:
Synthetic request summary:
Response classification:
Remote mutation observed:
Local files changed:
Packages/processes added:
Secret-pattern scan:
Git status:
Final result:
```

Do not paste keys, tokens, cookies, request authorization headers, real personal
data, or private project URLs into this report.
