import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("P8-S3 abuse, privacy and response fitness", () => {
  it("freezes complete fail-closed surface budgets and recovery exceptions", async () => {
    const inventory = JSON.parse(
      await readFile("contracts/security/p8-s3-surface-inventory.json", "utf8"),
    );
    expect(inventory.defaultDisposition).toBe("POLICY_DECISION_REQUIRED");
    expect(inventory.budgets.map((item: { class: string }) => item.class)).toEqual(
      expect.arrayContaining([
        "public-search",
        "normal-mutation",
        "document-transfer",
        "account-recovery",
        "emergency-recovery-read",
        "moderation",
        "internal-service",
      ]),
    );
    for (const budget of inventory.budgets) {
      expect(budget.limit).toBeGreaterThan(0);
      expect(budget.maxConcurrent).toBeGreaterThan(0);
      expect(budget.maxPayloadBytes).toBeGreaterThan(0);
      expect(budget.recovery).toBeTruthy();
    }
    expect(inventory.moderation.unsupported).toEqual(["report-ingestion", "claim", "appeal"]);
    expect(inventory.telemetry.forbidden).toContain("pii");
  });

  it("evaluates a bounded synthetic tabletop without external/legal claims", async () => {
    const drill = JSON.parse(await readFile("contracts/security/p8-s3-tabletop.json", "utf8"));
    expect(drill.syntheticOnly).toBe(true);
    expect(drill.phases).toEqual([
      "detect",
      "triage",
      "preserve_evidence",
      "contain",
      "revoke",
      "recover",
      "restore_replay_reconcile",
      "communicate_bilingually",
      "improve",
    ]);
    expect(drill.communications).toEqual(
      expect.objectContaining({ externalSent: false, legalClaim: false, languages: ["en", "vi"] }),
    );
    expect(drill.evidence).toEqual(
      expect.objectContaining({ rawPayloads: false, appendOnlyDigestBound: true }),
    );
    expect(JSON.stringify(drill)).not.toMatch(/password|token|email|phone|care content/iu);
  });

  it("keeps P8-S3 changes on the heavy path", async () => {
    const classifier = await readFile("tools/quality/src/p6-s2-change-classifier.ts", "utf8");
    expect(classifier).not.toContain("contracts/security/**");
    expect(classifier).not.toContain("tools/quality/src/p8-s3");
  });
});
