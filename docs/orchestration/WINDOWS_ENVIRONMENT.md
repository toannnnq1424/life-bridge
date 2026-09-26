# Windows Development Environment

## Supported baseline

LifeBridge local engineering is Windows-first and operated through the Codex desktop app. Phase 0 pins:

| Tool               |                Required version | Requirement                                  |
| ------------------ | ------------------------------: | -------------------------------------------- |
| Windows            |                   Windows 10/11 | Mandatory workstation baseline               |
| Windows PowerShell |                    5.1 or newer | Mandatory                                    |
| Git                | Current supported Windows build | Mandatory                                    |
| Node.js            |                            22.x | Mandatory                                    |
| pnpm               |                          11.9.0 | Mandatory                                    |
| npm/Corepack       |     Compatible with pinned Node | Optional helper                              |
| Docker Desktop     |         Current supported build | Optional until a container slice requires it |
| GitHub CLI         |         Current supported build | Optional; publishing only                    |
| PowerShell 7       |         Current supported build | Optional                                     |
| Python             |                  Slice-specific | Optional                                     |

The initial observed machine had Git `2.48.1.windows.1`, Node `22.22.3`, npm `10.9.8`, Corepack `0.34.6`, pnpm `11.9.0`, Docker CLI `27.5.1`, and Windows PowerShell `5.1`. Doctor output is the authority for the current session.

## Canonical commands

Use Windows command shims explicitly:

```powershell
pnpm.cmd run doctor
pnpm.cmd run bootstrap
pnpm.cmd run validate:phase0
```

Direct script equivalents are:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\doctor.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\bootstrap.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\validate-phase0.ps1
```

The `Bypass` argument applies only to that child PowerShell process and does not write user, machine, Group Policy, or Registry configuration. Never run `Set-ExecutionPolicy` for LifeBridge. On the observed host, `.ps1` execution and `npm.ps1` were blocked while `.cmd` shims worked. LifeBridge therefore uses `npm.cmd`, `npx.cmd`, and `pnpm.cmd`, never their PowerShell shim variants.

## Bootstrap contract

`scripts/bootstrap.ps1`:

- verifies Node 22.x and exact pnpm `11.9.0`;
- requires the reviewed `pnpm-lock.yaml`;
- installs with `--frozen-lockfile`;
- supports `-Offline` when the pnpm store is already materialized;
- runs Phase 0 validation unless `-SkipValidation` is supplied;
- is safe to rerun;
- never changes system policy, registry, services, firewall, Docker configuration, or credentials;
- never performs recursive deletion, Git reset, Git clean, or history rewriting;
- never creates or overwrites a secret environment file.

A worktree must run bootstrap independently. Future database migrations, generated clients, or browser tooling must be added as idempotent steps only when a vertical slice introduces them.

## Doctor classification

`scripts/doctor.ps1` emits:

- `mandatory/PASS` or `mandatory/FAIL` for prerequisites that block Phase 0;
- `optional/PASS` or `optional/WARN` for tools not yet required;
- a classification such as environment, dependency, configuration, or permission.

Optional warnings do not fail by default. Use `-FailOnOptional` only for a checkpoint that explicitly requires every optional capability.

The doctor does not install software, request administrator rights, print environment secrets, or repair configuration.

## Docker boundary

Docker is diagnostic-only in Phase 0. The doctor checks the CLI and attempts a read-only daemon version query.

If Docker reports an access or configuration warning:

1. Capture the exact redacted error.
2. Classify CLI, daemon, user-file permission, context, or sandbox failure.
3. Confirm whether the active slice actually needs Docker.
4. Inspect the smallest relevant user-owned configuration.
5. Before a specific user-file patch, resolve its absolute path and create a verified backup.
6. Obtain scoped approval for that exact patch.

Never automatically change Docker services, registry, firewall, Windows groups, system-wide configuration, or `%USERPROFILE%\.docker\config.json`. Never delete Docker state as a diagnostic shortcut.

## Network and elevation

Network access is requested only for a scoped need such as a locked dependency install, advisory audit, browser binary download, or approved external integration canary. Retry a sandbox-blocked required command only through a narrowly described escalation.

Administrator access is not a default prerequisite. Do not install global packages locally, alter PATH, enable services, or grant broad permanent access during bootstrap.

## Secrets and logs

- `.env.example` contains safe non-secret defaults only.
- Local secrets use an approved ignored mechanism and are never pasted into chat or command arguments.
- Stitch credentials are developer-tool secrets, not application runtime variables.
- Doctor and validation output may report a credential type and file, but never the value.
- Logs use structured fields and redact authorization, cookies, tokens, keys, personal records, private links, and request bodies by default.

## CI parity

`.github/workflows/ci.yml` runs on `windows-latest`, pins Node `22.22.3`, installs pnpm `11.9.0` on the ephemeral runner, installs the frozen lockfile, runs Phase 0 validation, and performs a dependency advisory audit.

Local validation intentionally excludes the network-backed audit from the default offline sequence. CI or a phase/release checkpoint runs it once after relevant dependency inputs change.

## Current known optional gaps

- GitHub CLI was not observed on the initial host.
- PowerShell 7 was not observed.
- The Python launcher existed without an installed Python runtime.
- Docker CLI existed, but sandbox access to its user configuration/daemon required diagnosis.

These are not Phase 0 blockers until a documented slice requires them.
