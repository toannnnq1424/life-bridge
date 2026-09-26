import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("P7-S3 lifecycle and recovery architecture fitness", () => {
  it("keeps four authoritative stores PostgreSQL-owned and credentials unique", async () => {
    const inventory = JSON.parse(
      await readFile("contracts/lifecycle/p7-s3-source-inventory.json", "utf8"),
    );
    const authoritative = inventory.sources.filter(
      (source: { authority: string }) => source.authority === "source-of-truth",
    );
    expect(authoritative).toHaveLength(4);
    expect(inventory.persistenceDecision).toMatchObject({
      authoritativeEngine: "postgresql",
      additionalEngines: [],
    });
    const credentials = authoritative.flatMap(
      (source: { credentialBoundary: Record<string, string> }) =>
        Object.values(source.credentialBoundary),
    );
    expect(new Set(credentials).size).toBe(credentials.length);
    expect(
      authoritative.every(
        (source: { backup: { access: string }; restoreTarget: string; rebuildExit: string }) =>
          source.backup.access === "owner-scoped" &&
          source.restoreTarget.includes("isolated") &&
          source.rebuildExit.length > 20,
      ),
    ).toBe(true);
  });
  it("keeps derived IndexedDB outside server backup claims", async () => {
    const inventory = JSON.parse(
      await readFile("contracts/lifecycle/p7-s3-source-inventory.json", "utf8"),
    );
    const offline = inventory.sources.find(
      (source: { id: string }) => source.id === "emergency-offline-indexeddb",
    );
    expect(offline).toMatchObject({
      authority: "derived-encrypted-offline-copy",
      backup: null,
      restoreTarget: null,
    });
  });
  it("aligns declared current schema with the final immutable migration", async () => {
    const ledger = JSON.parse(
      await readFile("contracts/migrations/p7-s1-owner-ledger.json", "utf8"),
    );
    for (const owner of ledger.owners) {
      const final = owner.migrations.at(-1)[0];
      expect(owner.compatibility.schema).toBe(final);
      expect(owner.compatibility.runtimeMaximum).toBe(final);
      expect(owner.compatibility.runtimeMinimum).toBe(final - 1);
    }
  });

  it("covers every inventoried data class with one bounded engineering policy", async () => {
    const inventory = JSON.parse(
      await readFile("contracts/lifecycle/p7-s3-source-inventory.json", "utf8"),
    );
    const policy = JSON.parse(
      await readFile("contracts/lifecycle/p7-s3-product-policy.json", "utf8"),
    );
    expect(policy.classification).toBe("product-engineering-default-not-legal-advice");
    expect(policy.legalHold).toContain("fail-closed");
    expect(policy.exportArtifactExpiryHours).toBe(24);
    expect(policy.backupArtifactRetentionDays).toBe(30);
    const expected = inventory.sources.flatMap((source: { owner: string; dataClasses: string[] }) =>
      source.dataClasses.map((dataClass) => `${source.owner}:${dataClass}`),
    );
    const actual = policy.dispositions.map(
      (item: { owner: string; dataClass: string }) => `${item.owner}:${item.dataClass}`,
    );
    expect(new Set(actual).size).toBe(actual.length);
    expect(actual.sort()).toEqual(expected.sort());
    for (const item of policy.dispositions) {
      expect(["delete", "pseudonymize", "retain", "tombstone"]).toContain(item.delete);
      expect(["export_include", "export_exclude"]).toContain(item.export);
      expect(item.evidenceRetentionDays).toBeGreaterThanOrEqual(0);
      expect(item.evidenceRetentionDays).toBeLessThanOrEqual(365);
    }
  });
});
