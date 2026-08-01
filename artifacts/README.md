# P6-S2 deployable artifacts

Each directory is an owner contract, not a shared deployment unit. `artifact.json`
is the machine-readable allowlist for build, entrypoint, configuration, probes,
owned migrations, SBOM and container definition. A service receives only its own
database credential; service API tokens do not imply datastore access.

Container builds use the repository root as an explicit build context because
pnpm resolves workspace contracts there. Dockerfiles copy only declared package
inputs and the final image contains one deployable's runtime output. The P6-S2
fitness gate rejects cross-service source, migrations and database credentials.
