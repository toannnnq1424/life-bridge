import { describe, expect, it } from "vitest";

import { isDocsOnly } from "./p6-s2-change-classifier.ts";

describe("P6-S2 fail-closed docs-only classification", () => {
  it.each([
    [["README.md"], true],
    [["docs/DEPLOYMENT.md", "docs/SESSION_LOG.md"], true],
    [["README.md", "apps/gateway/src/main.ts"], false],
    [[".github/workflows/ci.yml"], false],
    [["package.json"], false],
    [["pnpm-lock.yaml"], false],
    [["services/community/pom.xml"], false],
    [["artifacts/gateway/Dockerfile"], false],
    [["contracts/community/p6-s1/openapi.json"], false],
    [["scripts/validate-p6-s2.ps1"], false],
    [["tools/quality/src/p6-s2-change-classifier.ts"], false],
    [["services/identity-consent/migrations/001_initial.sql"], false],
    [["docs/DEPLOYMENT.md", ".github/ISSUE_TEMPLATE/config.yml"], false],
    [["docs/orchestration/reports/STITCH_MCP_CANARY.md"], false],
    [["docs\\DEPLOYMENT.md"], true],
    [["../docs/DEPLOYMENT.md"], false],
    [[], false],
  ])("classifies %j as %s", (paths, expected) => {
    expect(isDocsOnly(paths as string[])).toBe(expected);
  });
});
