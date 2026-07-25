# Dependency Control

## Current foundation

- Windows PowerShell 5.1-compatible repository scripts.
- Node.js 22 and pnpm 11.9.0.
- Project-local development dependencies with a committed lockfile.
- Docker is optional for Phase 0 validation until the first database-backed
  integration slice; doctor still reports its state.

## Phase 0 additions

- `smol-toml@1.7.0` is a pinned development-only parser used to validate the
  repository-scoped Codex MCP configuration as TOML, including its disabled
  state and environment-backed credential contract. Node's standard library
  does not parse TOML. The package is BSD-3-Clause, declares Node 18+, has no
  runtime dependencies, and runs no install script. Rollback is to remove the
  package and the TOML contract validator together; do not replace it with
  line-oriented parsing.

## Addition gate

Before adding a dependency, record:

- affected phase/slice and exact purpose;
- why existing platform/dependencies are insufficient;
- package/source owner, license, maintenance, scripts, and advisories;
- runtime versus development scope;
- version and lockfile change;
- removal/rollback plan;
- required validation.

Database engines and infrastructure dependencies additionally require an ADR.
