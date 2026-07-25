# Release Checklist

## Scope and evidence

- [ ] Release commit and exact included slices identified.
- [ ] Production assurance baseline matches accepted `CHG-2026-004` P6–P12
      planning, including the controlled #18–#20 mappings.
- [ ] Phase/slice acceptance criteria complete.
- [ ] Planned versus implemented behavior reconciled in product and implementation docs.
- [ ] Known limitations and deferred work disclosed.
- [ ] Repository map matches release structure.
- [ ] Research gate is current for every released slice.
- [ ] Unvalidated assumptions are disclosed and do not masquerade as facts.
- [ ] Public claims include current source, date, geography, and limitation.
- [ ] Legal/specialist/user-review gates match the intended market and scope.
- [ ] The closing phase records actual code/test evidence and publishes the
      exact next phase objective, slices, dependencies, research gates, and
      first action; every deviation has a Change ID.

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

## Production assurance P6–P12

- [ ] P6 proves independently deployable service boundaries, compatible
      API/event contracts, and the same safe topology in Windows local and CI.
- [ ] P7 proves service-owned migrations, outbox/inbox reliability, replay,
      retention, deletion/export, and service-level backup/restore.
- [ ] Every non-PostgreSQL persistence engine has an accepted ADR covering
      source of truth, consistency, ownership, migration, retention, recovery,
      cost, security, and exit plan.
- [ ] P8 threat, authorization, privacy, abuse, secret, SBOM, dependency, and
      software-supply-chain gates pass with no unresolved release-threshold
      finding.
- [ ] P9 telemetry is redacted and correlated; SLI/SLO values are measured;
      offline/conflict/dependency degradation is truthful; incident/DR game-day
      evidence meets approved RTO/RPO.
- [ ] P10 representative load, soak, backpressure, capacity, autoscaling, quota,
      performance-regression, and dated cost evidence passes against the exact
      candidate.
- [ ] P11 production configuration is reproducible; staged rollout,
      go/no-go/rollback criteria, pilot support, deployment smoke, and truthful
      release evidence pass.
- [ ] P12 operational ownership, alert routing, patch/EOL process, key rotation,
      recurring restore/replay drill, and privacy-safe improvement intake are
      assigned before public launch; do not claim P12 complete until
      post-launch evidence exists.

## Security and data

- [ ] Working tree, staged diff, and tracked history pass secret scanning.
- [ ] Dependency audit and SBOM reviewed.
- [ ] Authorization/consent isolation tests pass.
- [ ] Logs and error responses are redacted.
- [ ] Every shipped fixture is synthetic or redistributable with provenance.
- [ ] Backup/restore and migration compensation are rehearsed.
- [ ] No Stitch credential, private URL, raw export, or unreviewed generated code is shipped.
- [ ] Required MCP credentials are injected through an approved secret
      mechanism; no credential value appears in issues, chat-derived docs,
      logs, screenshots, repository history, or build artifacts.

## Git, CI, and deployment

- [ ] Research/data promotion followed
      `init/research → data → dev → test → main`.
- [ ] Implementation promotion followed `phase/* → dev → test → main`.
- [ ] Every cross-lane promotion used a reviewed pull request and GitHub
      **Create a merge commit**; no direct push, squash merge, rebase merge, or
      gate-bypassing cherry-pick changed the governed ancestry.
- [ ] `phase/*` was created from `dev`, owned exactly one phase or slice, and
      targeted `dev`; no `codex/*` branch was introduced.
- [ ] Required CI checks pass on the exact commit.
- [ ] No force push or rewritten public history.
- [ ] Live GitHub milestones, issue titles, labels, dependencies, #18–#20
      mappings, and branch/PR links match `docs/GITHUB_ISSUE_PLAN.md`.
- [ ] GitHub query `is:issue is:open label:mcp-debt` returns zero.
- [ ] `[GATE-P11] Clear required MCP debt before production deployment` is
      closed with verification or accepted de-scope evidence.
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
