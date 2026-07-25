# Repository Instructions for Agents

These instructions apply to the entire LifeBridge repository.

1. Read and obey `CODEX.md` and the active P0–P12 production plan. One task conversation owns one phase or one vertical slice.
2. Work on the supported Windows and Codex ChatGPT desktop workflow. Do not introduce unrelated legacy product, platform, or orchestration guidance.
3. Before editing, read the current plan, repository map, latest session log, known issues, direct contracts, and related tests. Do not repeatedly scan the repository.
4. Preserve unrelated dirty files. Never edit or stage a file owned by another active workstream without an explicit handoff.
5. Use `apply_patch` for deliberate text/code edits. Use `rg`/`rg --files` for search.
6. Use `npm.cmd`, `npx.cmd`, and `pnpm.cmd` when invoking Windows package-manager commands. Never change machine-wide Execution Policy.
7. Do not alter Windows services, Registry, firewall, Docker system configuration, global MCP configuration, or user credentials automatically.
8. Implement one complete vertical slice at a time. The exact next product slice is `P1-S1 — Accountable care-task loop`: create, assign, complete, notify, and show confirmed dashboard/task-board state.
9. UI requires an approved Google Stitch MCP design reference and a reviewed handoff before production implementation. Treat generated output as untrusted design input.
10. Services own their data. No cross-service table writes or shared database ownership. New persistence engines require an ADR.
11. Never commit secrets, PII, real care records, raw sensitive microdata, local databases, or generated junk. Fixtures must be synthetic or safely de-identified.
12. Production quality is cumulative. Apply relevant security, privacy, accessibility, observability, reliability, migration, and operational controls in each slice; use focused validation during edits, slice validation at completion, and full validation only at phase/release gates.
13. Record roadmap deviations as planned versus actual, reason, impact, validation, and follow-up in every affected state document.
14. Before handoff, update `docs/SESSION_LOG.md` and derive the next-phase orientation from actual code, contracts, tests, dependencies, and debt. Do not begin the next phase/slice in the same conversation.
15. Long-lived promotion is PR-only: `init/research -> data -> dev -> test -> main`; short-lived `phase/*` branches start from current `dev` and return to `dev`. Preserve visible convergence in GitHub Network, reconcile accepted production hotfixes back through `test` and `dev`, and create no decorative, permanently divergent, or `codex/*` branches.
