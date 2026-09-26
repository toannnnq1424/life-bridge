# Stitch MCP Security Review

## Document control

| Field | Value |
|---|---|
| Review date | 2026-07-23 |
| Reviewer context | LifeBridge local development workspace |
| Candidate | `@_davideast/stitch-mcp@0.9.0` |
| Candidate disposition | **NO-GO — rejected for execution and stable workflow use** |
| Approved executable package version | **None** |
| Proposed alternative | Direct remote MCP over HTTPS at `https://stitch.googleapis.com/mcp` |
| Alternative status | Proposed only; credential rotation and explicit approval are still required |
| Evidence workspace | Local-only `.security-review/stitch-mcp-0.9.0/` |
| Production impact | None; the candidate package was not installed, initialized, or executed |

## Executive decision

LifeBridge must not run:

```text
npx -y @_davideast/stitch-mcp@0.9.0 ...
```

and must not use any floating form such as:

```text
npx @_davideast/stitch-mcp ...
npx @_davideast/stitch-mcp@latest ...
```

Version `0.9.0` was inspected as the current candidate but is **not an approved pinned runtime version**. The candidate is an independent experimental project, is not affiliated with or endorsed by Google, resolves a dependency tree with known high-severity vulnerabilities, can execute dependency install scripts, and contains setup functionality capable of installing or invoking Google Cloud tooling, changing authentication/configuration state, enabling APIs, and writing outside the repository.

The preferred integration path is the Google-owned remote endpoint:

```text
https://stitch.googleapis.com/mcp
```

Using the remote endpoint avoids executing the reviewed third-party local package. This does not remove the need to review tool schemas, external data transfer, authorization scope, logging, and write-tool approvals.

## Credential incident

An API key was included in plaintext in the integration request. It must be treated as compromised.

Required response:

1. Revoke or delete the disclosed key in the relevant Google Cloud project.
2. Review recent usage and restrictions for anomalous activity.
3. Create a replacement key only in a non-production development project.
4. Restrict the replacement key to the minimum API and applicable client restrictions supported by Google Cloud.
5. Enter the replacement only through a password-style secure prompt or an approved user-level secret mechanism.
6. Never paste the replacement into chat, source files, committed MCP configuration, terminal commands, screenshots, reports, or task handoffs.

The disclosed key is intentionally omitted from this report. No credential was used during this review.

## Review method

The package was not executed. Review activities were limited to:

- Reading npm registry metadata.
- Downloading the exact npm tarball for static inspection.
- Extracting the tarball without running package code.
- Inspecting package metadata, README, bundled JavaScript, command behavior, domains, filesystem paths, and subprocess references.
- Generating a dependency-only lockfile with `--package-lock-only --ignore-scripts`.
- Running `npm audit` against that lockfile.
- Reading public GitHub repository metadata, commit metadata, issues, and source manifest.
- Comparing npm `gitHead` with the public source commit and manifest.
- Checking for lifecycle-script flags in the resolved dependency tree.

No `init`, `doctor`, `proxy`, `serve`, `site`, `tool`, or `logout` command was run. No `node_modules` directory was intentionally created by the lockfile-only review. No OAuth flow was started. No Google Cloud API or IAM setting was changed.

## Package identity and existence

| Check | Finding |
|---|---|
| npm package | Exists as `@_davideast/stitch-mcp` |
| Reviewed version | `0.9.0` |
| Package author | David East |
| npm publisher identity | `_davideast` |
| License | Apache-2.0 |
| Node engine | `>=18.0.0` |
| Package description | CLI helper for Stitch authentication, MCP client configuration, and proxy setup |
| Distribution model | Independent experimental package |
| Google affiliation | Explicitly disclaimed in the package README |

The package README states that the project is experimental, provided as-is, and is not affiliated with, endorsed by, or sponsored by Google LLC, Alphabet Inc., or the Stitch API team.

## Repository and provenance

| Check | Finding |
|---|---|
| Candidate source repository | `https://github.com/davideast/stitch-mcp` |
| Repository owner | `davideast` |
| Visibility | Public |
| Default branch | `main` |
| Repository license | Apache-2.0 |
| Repository created | 2026-01-15 |
| Last observed push | 2026-05-28 |
| Open issue/PR count observed | 10 |
| npm `gitHead` | `0911d6dc48b9515895e1109387e14c2c969114a2` |
| Commit signature | Unsigned |
| Matching tag/release observed | None |
| npm provenance attestation observed | None in the queried npm metadata |
| npm registry signature | Present |
| Package repository field | Missing from the published package manifest |

The npm `gitHead` resolves to a public commit in `davideast/stitch-mcp`. The source `package.json` at that commit matches the package name, version `0.9.0`, and reviewed direct dependency declarations. This gives a partial package-to-source match.

The match is not a complete trusted build provenance chain because:

- The commit is unsigned.
- No matching Git tag or GitHub release was observed.
- No npm provenance attestation was observed in queried metadata.
- The published package manifest omits a `repository` field.
- Reproducible build equivalence between source and tarball was not established.
- The `0.9.0` commit message states that npm version `0.8.0` had previously been built from a commit not present in the repository.

## Maintainer and ownership review

Current public metadata associates the package publisher and repository with David East / `_davideast` / `davideast`.

No evidence found in the inspected current metadata proved a package ownership transfer. However, npm's current public package metadata alone does not provide a complete historical ownership ledger. Therefore, the requirement to prove that ownership has never changed is **not fully satisfied**.

A future review must re-check:

- Current npm owners and maintainers.
- Repository organization/owner.
- Publisher identity for the candidate version.
- npm provenance attestations.
- Unexpected changes in package scope, repository URL, signing keys, or publish cadence.

## Release freshness

The reviewed source commit was authored and committed on 2026-05-28. The repository was observed as active and not archived, but no corresponding Git tag or GitHub release was found.

Freshness alone is not sufficient for approval. A recent package can still be unsafe, compromised, or operationally incompatible.

## Dependency tree

A lockfile-only resolution was performed with scripts disabled.

Observed audit summary:

| Metric | Count |
|---|---:|
| Total resolved dependencies reported by npm audit | 271 |
| Production dependencies | 220 |
| Optional dependencies | 52 |
| Critical vulnerabilities | 0 |
| High vulnerabilities | 2 |
| Moderate vulnerabilities | 2 |
| Low vulnerabilities | 0 |

Security-relevant resolved versions:

| Dependency | Resolved version | Finding |
|---|---:|---|
| `@_davideast/stitch-mcp` | `0.9.0` | Direct reviewed package; npm audit reports effective high severity through transitive dependencies |
| `@google/stitch-sdk` | `0.3.5` | Direct dependency |
| `@modelcontextprotocol/sdk` | `1.29.0` | Moderate finding via vulnerable Hono adapter |
| `@hono/node-server` | `1.19.14` | Moderate Windows path traversal finding |
| `adm-zip` | `0.5.18` | High memory-allocation denial-of-service finding |

### Known advisories

#### `adm-zip` — high

- Advisory: `GHSA-xcpc-8h2w-3j85`
- Affected range: `<0.6.0`
- Resolved version: `0.5.18`
- Impact: a crafted ZIP can trigger a roughly 4 GB memory allocation, causing denial of service.
- npm audit result: no fix available through the reviewed package tree.

This is especially relevant because the package contains archive/download and bundled-tooling behavior.

#### `@hono/node-server` — moderate

- Advisory: `GHSA-frvp-7c67-39w9`
- Affected range: `<2.0.5`
- Resolved version: `1.19.14`
- Impact: path traversal in `serve-static` on Windows via encoded backslash.
- npm audit result: a fixed dependency version exists, but the reviewed lock resolution remains affected.

This is directly relevant to the current Windows 11 review environment and the package's local preview/server capabilities.

## Lifecycle scripts

The root package manifest declares development/release scripts including `prepublishOnly`, but no root `preinstall`, `install`, or `postinstall` lifecycle script was observed.

The resolved tree contains packages marked with install scripts:

- `esbuild@0.28.1`
- `fsevents@2.3.3` — optional and Darwin-only

Running the package through `npx` can still cause npm to fetch dependencies and execute dependency lifecycle scripts, including platform binary setup. The review used `--ignore-scripts`; therefore these scripts were not approved or exercised.

## Sensitive capabilities found by static inspection

The package can or documents behavior that may:

- Start a local stdio MCP proxy.
- Connect to `https://stitch.googleapis.com/mcp`.
- Send `X-Goog-Api-Key` or bearer authorization data.
- Read `STITCH_API_KEY`, `STITCH_ACCESS_TOKEN`, Google project variables, and custom host variables.
- Invoke or install Google Cloud CLI tooling.
- Start browser-based OAuth.
- Use application-default credentials.
- Set a Google Cloud project.
- Enable `stitch.googleapis.com`.
- Generate or modify MCP client configuration.
- Create local `.env` content containing a credential.
- Write credential/configuration state outside the repository.
- Clear or revoke authentication/configuration state.
- Start local preview servers.
- Open a browser.
- Download screen HTML/images and other external artifacts.
- Build generated site output.
- Invoke subprocesses such as Node/npm/npx, Google Cloud CLI, package/build tooling, and browser/open commands depending on the selected command and environment.

These capabilities are broader than required for a minimal read-only design canary.

## External domains and network destinations

Domains observed or expected from package metadata/source and the reviewed workflow include:

- `registry.npmjs.org` — package metadata and tarballs.
- `github.com`, `api.github.com`, `raw.githubusercontent.com` — source and public review evidence.
- `stitch.googleapis.com` — Stitch MCP API.
- `accounts.google.com` — OAuth login when used.
- Google Cloud service/download endpoints — possible gcloud installation, authentication, API enablement, and project operations.
- External screen/image/code URLs returned by Stitch data — artifact imports requiring separate review.

Only the minimum domains required by the selected authentication and MCP path may be allowed.

## Open issues and operational signals

Open repository items observed during review include reports or proposals concerning:

- API-key proxy behavior being rejected by the Stitch `/mcp` endpoint.
- A stable stdio alternative intended to avoid proxy crashes on Windows.
- OAuth/ADC support gaps.
- Cross-account shared project OAuth failures.
- Screenshot URL behavior.
- Logging/capture test hardening.
- Additional write/generation functionality.

No open item observed was clearly labeled as a security issue. Absence of a security label is not evidence of safety; npm audit independently identified known vulnerabilities.

## Package/source consistency conclusion

Status: **Partially matched, not fully attestable**.

Positive evidence:

- npm `gitHead` resolves to the expected public repository.
- Commit manifest matches package name and version.
- Direct dependency declarations align with inspected package metadata.
- npm registry signature metadata is present.

Blocking gaps:

- Unsigned source commit.
- No matching tag or release.
- No observed npm provenance attestation.
- No repository field in the published package manifest.
- No verified reproducible-build comparison.
- Historical mismatch explicitly noted for the preceding `0.8.0` publication.

## Risk assessment

| Risk | Rating | Rationale |
|---|---|---|
| Supply-chain provenance | High | Experimental third-party package; unsigned commit; no tag/release or observed provenance attestation |
| Known dependency vulnerabilities | High | Two high and two moderate audit findings; `adm-zip` has no available fix in the reviewed tree |
| Credential exposure | High | Package handles API keys/OAuth/access tokens and may generate config/env content |
| Filesystem/config mutation | High | Setup/logout/config generation can write outside the workspace |
| Subprocess execution | High | May invoke npm tooling, gcloud, browsers, servers, and build tools |
| Windows compatibility | Medium–High | Open crash-related report and affected Hono path traversal dependency |
| External data import | Medium–High | Downloads generated HTML/images and can build site output |
| Production coupling | High if misused | Generated output must not become production source without normalization and review |

## Decision and controls

### Rejected

- Installing the package globally.
- Adding the package to production dependencies.
- Adding the package to production containers.
- Running `init`, `doctor`, `doctor --verbose`, `proxy`, `serve`, `site`, `tool`, or `logout` for version `0.9.0`.
- Using a floating npm version.
- Persisting the disclosed API key.
- Enabling wildcard auto-approval.
- Granting filesystem-wide or shell-wide access.
- Copying generated HTML/CSS directly into production.

### Proposed alternative

Configure workspace-scoped VS Code MCP to call the Google-owned HTTPS endpoint directly:

```text
https://stitch.googleapis.com/mcp
```

with the API key supplied through a password prompt, not stored in JSON.

For Cline, use a supported remote/streamable-HTTP configuration only after the installed Cline version and its exact configuration schema/location are verified. If Cline cannot securely prompt or reference an environment secret for remote headers, do not hardcode the key; leave Cline integration disabled and use the manual secure setup path.

### Mandatory controls

- Revoke and rotate the disclosed key before activation.
- Use a dedicated non-production Google Cloud project.
- Apply least-privilege API and client restrictions.
- Keep write-tool `autoApprove` empty.
- Review every tool name, description, schema, data egress, and artifact path.
- Approve the MCP server only for this workspace.
- Use MCP sandboxing when available.
- Store imported artifacts only under approved design/prototype paths.
- Redact logs before saving.
- Do not run generated scripts before review.
- Do not write generated output into production application directories.
- Keep `.security-review/`, credentials, local environment files, and private exports out of Git.

## Upgrade policy

No package version is approved for automatic upgrade.

A future package reconsideration requires:

```text
new security review
→ verify owner and provenance
→ verify source/package match
→ inspect lifecycle scripts and dependency tree
→ confirm all high findings are resolved
→ backup config
→ isolated branch
→ MCP canary
→ design regression review
→ explicit promotion
```

A reviewed version must be pinned exactly. `latest`, ranges, and unversioned `npx` commands are prohibited in stable workflow documentation and configuration.

## Rollback

If a later remote MCP activation fails:

1. Disable the `stitch` server in VS Code.
2. Disable the `stitch` server in Cline.
3. Preserve credential cache temporarily for incident analysis unless compromise is suspected.
4. Capture only redacted logs.
5. Verify endpoint, transport, client version, and authentication.
6. Restore workspace and Cline configuration from timestamped backups.
7. Revoke the replacement credential if exposure is suspected.
8. Confirm no unexpected process remains.
9. Continue using local design documents, wireframes, the project design system, manual component specifications, and frontend implementation.

## Remote client schema verification

Cline extension version `4.0.10` was statically inspected without executing extension code. Its bundled MCP configuration schema accepts:

- `type: "streamableHttp"`;
- an HTTPS `url`;
- string `headers`;
- `disabled`;
- `autoApprove`.

Its interpolation logic resolves `${env:NAME}` from the Cline host process environment. The approved Cline header reference is therefore:

```json
{
  "X-Goog-Api-Key": "${env:STITCH_API_KEY}"
}
```

This value is an environment reference, not a credential. The initial Cline configuration retains `"disabled": true` and `"autoApprove": []`. The user-level Cline configuration is not committed. The VS Code workspace configuration uses a password-style input reference instead.

The configurations were backed up before merge under the ignored local path:

```text
.security-review/backups/20260723-232928/
```

Both resulting JSON files were parsed and policy-checked. No literal Google API key was found. No MCP server was started during schema verification or configuration merge.

## Final status

`@_davideast/stitch-mcp@0.9.0` fails the LifeBridge installation gate and must not be executed.

The direct remote Stitch MCP endpoint is configured but remains blocked from canary completion until:

- the disclosed key has been revoked;
- a replacement credential has been created securely in a non-production project;
- the user supplies that credential through the approved runtime mechanism;
- workspace trust and server activation are explicitly approved;
- and read-only VS Code and Cline canaries succeed without credential leakage or unexpected filesystem/process changes.
