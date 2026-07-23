# LifeBridge Stitch Project Register

## Current status

```text
Integration: Configured but inactive
Transport: Remote HTTPS MCP
Tooling canary: Not run
Approved Stitch projects: None
Registered screens: None
Imported artifacts: None
Production design generation: Blocked
```

No Stitch project has been created, listed, imported, modified, deleted, or downloaded during bootstrap.

The disclosed API key is considered compromised. Do not use it. Activation remains blocked until its owner confirms revocation, reviews usage, creates a restricted non-production replacement, and enters that replacement through an approved secret mechanism.

The rejected package `@_davideast/stitch-mcp@0.9.0` was not approved for installation or execution.

Operational controls:

```text
docs/orchestration/STITCH_MCP_OPERATIONS.md
docs/orchestration/reports/STITCH_MCP_SECURITY_REVIEW.md
```

## Purpose and source precedence

This register tracks approved design references and artifact provenance. It is not a secret store, credential cache, MCP configuration, or production-code inventory.

Stitch supplies design input only:

```text
Git repository
→ design system
→ component contracts
→ application source code
→ automated tests
```

Accessibility, security, privacy, localization, authorization, consent, service contracts, resilience, and maintainability take precedence over visual similarity.

## Security boundary

- Use a dedicated non-production Google Cloud project and narrowly restricted credential.
- Use synthetic, minimum-necessary prompt data only.
- Never store API keys, OAuth tokens, cookies, credential paths, signed URLs, invitation links, query tokens, production identifiers, real personal data, care records, medication records, emergency-plan content, documents, or moderation evidence here.
- Redact remote project and screen references when they could expose a private workstream.
- Never place credentials in Git, MCP configuration, reports, screenshots, prompts, handoffs, terminal arguments, or imported artifacts.
- Do not automate OAuth, browser login, MFA, API enablement, IAM changes, `gcloud` installation, credential entry, or MCP trust prompts.
- Keep Cline `autoApprove: []`.
- Keep the Cline `stitch` server disabled outside an approved session.
- Every write, delete, export, build, browser, bulk-download, or cost-bearing operation requires explicit approval.

## Activation gate

Before creating or modifying a Stitch project:

1. Confirm the disclosed key was revoked and its usage reviewed.
2. Confirm a restricted replacement exists in a dedicated non-production project.
3. Enter the replacement only through VS Code password input or an approved Cline environment/session-secret mechanism.
4. Review and accept VS Code trust for this workspace only.
5. Enable Cline only for the canary; retain `autoApprove: []`.
6. Review live tool/resource names, descriptions, complete schemas, side effects, data egress, returned artifacts, and cost behavior.
7. Pass the VS Code and Cline tooling canary.
8. Approve project purpose, owner, access boundary, synthetic dataset, retention, and deletion authority.
9. Obtain explicit approval for the exact write tool call.

Canary discovery and one minimal read-only request may occur under the canary procedure. It must not create, modify, delete, bulk-download, or build a project.

## Project strategy

Start with the fewest projects that preserve access isolation, review clarity, artifact size, and lifecycle ownership. Do not create one project per screen by default.

No project is currently approved or registered.

| Local reference | Redacted remote reference | Scope | Environment | Owner | Data class | Status | Created | Last verified | Retention |
|---|---|---|---|---|---|---|---|---|---|
| None | None | None | Non-production only | `TBD` | Synthetic only | Not created | N/A | N/A | Pending approval |

Allowed status values:

```text
Proposed
Approved to create
Active exploration
Design review
Frozen reference
Archived
Deletion approved
Deleted
Unavailable
```

A local reference is not proof that a remote project exists.

## Project registration contract

Add one record only after an approved tool call or user-created project is independently verified:

```text
Local reference:
Redacted remote reference:
Purpose:
Product requirement:
Flow IDs:
Screen IDs:
Environment: Non-production
Owner:
Access boundary:
Created by:
Created:
Last verified:
Status:
Synthetic dataset:
Prompt/data classification:
Minimum-data justification:
Approved MCP tools:
Write approval reference:
Expected cost or quota effect:
Artifact destinations:
Screen handoffs:
Frozen baseline:
Retention:
Deletion authority:
Archive/deletion approval:
Notes:
```

Use an irreversible local alias or consistently redacted fragment only when traceability requires it. Keep the full remote identifier in an approved access-controlled operational system, not public design documentation.

Project creation remains blocked while any field affecting identity, access, data egress, cost, retention, or deletion is unresolved.

## Screen register

`SCREEN_INVENTORY.md` remains the authoritative screen list. Every imported or reviewed Stitch screen requires a handoff based on:

```text
docs/design/reviews/SCREEN_HANDOFF_TEMPLATE.md
```

| Screen ID | Local project reference | Redacted screen reference | Design version | Artifact path | Handoff | Design status | Accessibility status | Last reviewed |
|---|---|---|---|---|---|---|---|---|
| `LB-001`–`LB-035` | None | None | None | None | Pending | Not generated | Not reviewed | N/A |

Allowed design status values:

```text
Not generated
Concept
Flow review
Design review
Accessibility review
Frozen
Superseded
Rejected
Unavailable
```

A screen cannot become `Frozen` until its handoff, responsive evidence, accessibility evidence, privacy/security review, localization behavior, service contracts, and approvals are complete.

## Artifact provenance

Record every imported screenshot, image, HTML export, code reference, or prototype:

```text
Artifact ID:
Local project reference:
Redacted project reference:
Screen ID:
Redacted screen reference:
Source tool:
Tool classification: Read | Write
Retrieved:
Artifact type:
Destination:
Checksum:
Size:
Data classification:
Synthetic data confirmed:
Metadata review:
Secret/private-URL scan:
External asset review:
Script/dependency review:
License/usage review:
Reviewer:
Review status:
Approved extracted intent:
Rejected content:
Commit decision:
```

Approved destinations:

```text
docs/design/assets/
docs/design/screenshots/
docs/design/exports/
docs/design/reviews/
prototypes/stitch/<redacted-project-id>/
```

Private or sensitive exports belong only under the ignored path:

```text
docs/design/exports/private/
```

Do not automatically commit large binaries or raw exports. Never execute generated scripts before review. Never write generated output over production application paths.

## Artifact naming

Use repository-safe local references:

```text
<SCREEN-ID>_<state>_<width>_<UTC-timestamp>.<ext>
```

Example:

```text
LB-013_offline-queued_1280_20260724T010000Z.png
```

Names must not contain personal data, account names, remote project/screen IDs, tokens, signed query values, or production identifiers.

## Tool approval record

Before every Stitch MCP call, record:

```text
Date/time:
Client: VS Code | Cline
Tool:
Description:
Complete schema reviewed:
Classification: Read | Write
Data sent externally:
Returned artifact:
Destination:
Cost/quota effect:
Approval required:
Approval obtained:
Reviewer:
Result:
Redacted evidence:
```

Initial policy:

| Tool class | Policy |
|---|---|
| Tool/resource discovery | Canary only; explicit approval |
| Read-only metadata | Explicit approval until schema review and successful canary |
| Screen, image, HTML, or code retrieval | Explicit approval; external import review required |
| Create, update, archive, or delete | Explicit approval every call |
| Build site or prototype | Explicit approval every call; prototype branch and path only |
| Browser, OAuth, or credential operation | User-operated approval only |

Wildcard auto-approval is prohibited.

## Import decision

For every output:

```text
Decision: Reject | Reference only | Extracted intent approved | Converted to project-native implementation
Reason:
Generated code copied to production: No
Generated scripts executed: No
External dependencies accepted:
Tracking accepted: No
Placeholder credentials accepted: No
Accessibility issues:
Security/privacy issues:
Approved extracted intent:
Accepted divergence:
Reviewer:
Date:
```

Generated HTML, CSS, scripts, runtimes, tracking, CDN dependencies, placeholder credentials, inaccessible markup, hardcoded production copy, and generated business logic are not production source.

Convert approved intent into project-native tokens, semantic components, responsive rules, localization keys, state contracts, and tested flows.

## Design baseline

```text
Baseline ID:
Local project reference:
Screen set:
Viewport set: 320, 375, 768, 1024, 1280, 1440 CSS px
Zoom/reflow set: 200% zoom and 400% reflow
States:
Accessibility requirements:
Responsive requirements:
Localization fixtures:
Synthetic data fixture:
Baseline artifacts:
Checksums:
Comparison method:
Design reviewer:
Accessibility reviewer:
Privacy/security reviewer:
Frozen date:
Status: Not frozen
Approved divergences:
Open defects:
```

A frozen Stitch baseline remains design input. Production behavior follows repository contracts, source code, and tests.

## Prototype policy

`build site` and equivalent write tools:

- Require explicit approval.
- Run only on a prototype branch.
- Write only to `prototypes/stitch/<redacted-project-id>/`.
- Use synthetic data.
- Never overwrite application directories.
- Never enter a production container.
- Never deploy as the application.
- Never execute generated scripts before file, dependency, license, secret, tracking, URL, and metadata review.

## Archive and deletion

Before archive or deletion:

```text
Local project reference:
Reason:
Verified target:
Impact on handoffs and baselines:
Artifacts retained:
Artifacts removed:
Repository references updated:
Private links removed:
Retention obligation:
Delete tool schema reviewed:
Explicit approval:
Approver:
Executed by:
Execution date:
Remote result:
Verification:
```

Deletion tools never receive auto-approval. Do not claim deletion or credential revocation without user-confirmed evidence.

## Lifecycle

```text
Product requirements
→ UX flows
→ low-fidelity structure
→ approved Stitch generation or local wireframes
→ design review
→ accessibility review
→ privacy/security review
→ design freeze
→ component specification
→ project-native frontend implementation
→ consolidated frontend testing
```

## Current blockers

- Revocation of the disclosed API key is not user-confirmed.
- No approved replacement credential has been entered.
- VS Code workspace trust is not approved.
- Cline Stitch remains disabled.
- Live tool/resource schemas have not been inspected.
- No read-only canary has run.
- Application architecture and service contracts remain `TBD`.

Stitch failure does not block delivery:

```text
Design documents
→ local wireframes
→ project design system
→ manual component specification
→ frontend implementation after architecture approval
```
