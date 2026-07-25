# Release Checklist

## Scope and evidence

- [ ] Release commit and exact included slices identified.
- [ ] Phase/slice acceptance criteria complete.
- [ ] Planned versus implemented behavior reconciled in product and implementation docs.
- [ ] Known limitations and deferred work disclosed.
- [ ] Repository map matches release structure.
- [ ] Research gate is current for every released slice.
- [ ] Unvalidated assumptions are disclosed and do not masquerade as facts.
- [ ] Public claims include current source, date, geography, and limitation.
- [ ] Legal/specialist/user-review gates match the intended market and scope.

## Clean materialization

- [ ] Clean dependency install from the committed lockfile.
- [ ] Generated artifacts reproduced.
- [ ] Disposable database migration and fixture load succeed.
- [ ] Required browser tooling installs reproducibly.
- [ ] Bootstrap is idempotent.

## Validation

- [ ] Repository format check.
- [ ] Repository lint.
- [ ] Repository type check.
- [ ] Unit tests.
- [ ] Integration and contract tests.
- [ ] Production builds.
- [ ] Health/readiness checks.
- [ ] Primary bilingual end-to-end smoke test.
- [ ] Accessibility and keyboard checks.
- [ ] Visual/design comparison for implemented Stitch-backed screens.
- [ ] Exact release journey/test inventory is traceable.
- [ ] Blocker/critical/high defects meet the documented zero-or-exception policy.

## Security and data

- [ ] Working tree, staged diff, and tracked history pass secret scanning.
- [ ] Dependency audit and SBOM reviewed.
- [ ] Authorization/consent isolation tests pass.
- [ ] Logs and error responses are redacted.
- [ ] Every shipped fixture is synthetic or redistributable with provenance.
- [ ] Backup/restore and migration compensation are rehearsed.
- [ ] No Stitch credential, private URL, raw export, or unreviewed generated code is shipped.

## Git, CI, and deployment

- [ ] Branch promotion followed `phase/* → dev → test → main`.
- [ ] Required CI checks pass on the exact commit.
- [ ] No force push or rewritten public history.
- [ ] Deployment configuration and secret injection reviewed.
- [ ] Public URL smoke-tested once after deployment.
- [ ] Rollback artifact and instructions verified.
- [ ] Rollback and monitoring stop conditions were rehearsed.
- [ ] Progressive rollout is verified or explicitly `N/A` with platform reason.

## Demo and submission

- [ ] Demo rehearsed against the release candidate.
- [ ] Vietnamese and English paths verified.
- [ ] Screenshots contain synthetic data only.
- [ ] Devpost claims match implemented behavior.
- [ ] Repository URL, deployment URL, video, and disclosed limitations are current.
- [ ] Internal persona rehearsal is not misreported as completed user research.
