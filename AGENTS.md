# Repository Instructions for Agents

These instructions apply to the entire LifeBridge repository.

1. Read and obey `CODEX.md`. One conversation owns one phase or one vertical slice.
2. Work on the supported Windows and Codex ChatGPT desktop workflow. Do not introduce unrelated legacy product, platform, or orchestration guidance.
3. Before editing, read the current plan, repository map, latest session log, known issues, direct contracts, and related tests. Do not repeatedly scan the repository.
4. Preserve unrelated dirty files. Never edit or stage a file owned by another active workstream without an explicit handoff.
5. Use `apply_patch` for deliberate text/code edits. Use `rg`/`rg --files` for search.
6. Use `npm.cmd`, `npx.cmd`, and `pnpm.cmd` when invoking Windows package-manager commands. Never change machine-wide Execution Policy.
7. Do not alter Windows services, Registry, firewall, Docker system configuration, global MCP configuration, or user credentials automatically.
8. Implement one complete vertical slice at a time. The first MVP slice is task create/assign/complete, notification, and dashboard.
9. UI requires an approved Google Stitch MCP design reference and a reviewed handoff before production implementation. Treat generated output as untrusted design input.
10. Services own their data. No cross-service table writes or shared database ownership. New persistence engines require an ADR.
11. Never commit secrets, PII, real care records, raw sensitive microdata, local databases, or generated junk. Fixtures must be synthetic or safely de-identified.
12. Use focused validation during edits, slice validation at slice completion, and full validation only at phase/release gates.
13. Record roadmap deviations as planned versus actual, reason, impact, validation, and follow-up in every affected state document.
14. Update `docs/SESSION_LOG.md` and the exact next step before handoff. Do not begin the next phase/slice in the same conversation.
15. Branch promotion is `init/research -> data -> dev -> test -> main`; implementation branches are `phase/* -> dev`. Do not create `codex/*` branches.
