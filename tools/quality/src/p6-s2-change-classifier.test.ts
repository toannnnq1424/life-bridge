import { describe, expect, it } from "vitest";

import { isDocsOnly } from "./p6-s2-change-classifier.ts";

describe("P6-S2 fail-closed docs-only classification", () => {
  it.each([
    [["README.md"], true],
    [["docs/IMPLEMENTATION_PLAN.md", "docs/SESSION_LOG.md"], true],
    [["docs/DEPLOYMENT.md"], false],
    [["docs/SECURITY.md"], false],
    [["docs/testing/P7_S2_PRECODE_REVIEW.md"], false],
    [["docs/testing/P7_S3_PRECODE_REVIEW.md"], false],
    [["contracts/lifecycle/p7-s3-source-inventory.json"], false],
    [["packages/lifecycle/src/index.ts"], false],
    [["tools/quality/src/p7-s3-recovery.ts"], false],
    [["scripts/validate-p7-s3.ps1"], false],
    [["docs/security/P7_S2_THREAT_MODEL.md"], false],
    [["docs/security/P8_S1_THREAT_MODEL.md"], false],
    [["contracts/authorization/p8-s1-policy.json"], false],
    [["scripts/validate-p8-s1.ps1"], false],
    [["contracts/security/p8-s2-secret-inventory.json"], false],
    [["contracts/security/p8-s2-runtime-policy.json"], false],
    [["tools/quality/src/p8-s2-provenance.ts"], false],
    [["scripts/validate-p8-s2.ps1"], false],
    [["CODEX.md"], false],
    [["AGENTS.md"], false],
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
    [["docs\\SESSION_LOG.md"], true],
    [["../docs/DEPLOYMENT.md"], false],
    [[], false],
  ])("classifies %j as %s", (paths, expected) => {
    expect(isDocsOnly(paths as string[])).toBe(expected);
  });
});
