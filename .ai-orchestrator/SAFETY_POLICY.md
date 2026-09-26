# Safety Policy

- Write only inside the LifeBridge repository unless a specific external file
  has been identified, backed up, and explicitly approved.
- Do not run recursive delete, `git clean`, hard reset, force push, history
  rewrite, branch deletion, or broad restore.
- Preserve untracked and pre-existing dirty work.
- Do not alter Windows Registry, system services, firewall, PowerShell execution
  policy, boot settings, antivirus, or global Docker configuration.
- Use project-local dependencies and scoped network access.
- Never print, persist, forward, or commit a secret.
- External login, credential entry, data upload, deployment, public exposure,
  and destructive MCP calls are explicit gates.
- Classify a failure before editing and retry the same failure no more than three
  times without new evidence.
