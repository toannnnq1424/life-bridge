import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface OwnerRecord {
  owner: string;
  database: string;
  schema: string;
  tables: { allowedPrefixes: string[] };
  tool: { name: string; version: string; driver: string };
  credentials: { migration: string | string[]; runtime: string | string[] };
  compatibility: { schema: number; runtimeMinimum: number; runtimeMaximum: number };
  migrations: Array<[number, string, string]>;
}

interface Ledger {
  schemaVersion: number;
  owners: OwnerRecord[];
  recoveryPoint: { requiredBeforeMutation: boolean; prohibitedClaims: string[] };
}

const root = resolve(import.meta.dirname, "../../..");
const ledgerPath = resolve(root, "contracts/migrations/p7-s1-owner-ledger.json");

describe("P7-S1 owner migration ledger fitness", () => {
  it("pins exactly four isolated owners, tools, credentials and compatibility windows", async () => {
    const ledger = await loadLedger(ledgerPath);
    expect(ledger.schemaVersion).toBe(1);
    expect(ledger.owners.map(({ owner }) => owner).sort()).toEqual([
      "care-coordination",
      "community",
      "identity-consent",
      "notification",
    ]);
    const databases = new Set<string>();
    const credentials = new Set<string>();
    for (const owner of ledger.owners) {
      expect(databases.has(owner.database)).toBe(false);
      databases.add(owner.database);
      expect(owner.schema).toBe("public");
      expect(owner.tool.name).toMatch(/^(flyway|lifebridge-node-ledger)$/);
      expect(owner.tool.version).toMatch(/^\d/);
      expect(owner.tool.driver).toMatch(/@\d/);
      expect(owner.compatibility.runtimeMinimum).toBe(owner.compatibility.schema - 1);
      expect(owner.compatibility.runtimeMaximum).toBe(owner.compatibility.schema);
      for (const credential of [
        ...array(owner.credentials.migration),
        ...array(owner.credentials.runtime),
      ]) {
        expect(credentials.has(credential)).toBe(false);
        credentials.add(credential);
      }
    }
    expect(ledger.recoveryPoint.requiredBeforeMutation).toBe(true);
    expect(ledger.recoveryPoint.prohibitedClaims).toEqual(
      expect.arrayContaining(["retention", "rpo", "rto", "disaster-recovery"]),
    );
  });

  it("matches every ordered migration byte-for-byte and rejects extras", async () => {
    const ledger = await loadLedger(ledgerPath);
    for (const owner of ledger.owners) {
      const directory = migrationDirectory(owner.owner);
      const disk = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
      expect(disk).toEqual(owner.migrations.map(([, name]) => name));
      for (const [index, [version, name, expectedHash]] of owner.migrations.entries()) {
        expect(version).toBe(index + 1);
        const bytes = await readFile(resolve(directory, name));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(expectedHash);
      }
    }
  });

  it("keeps every artifact on only its owner runtime and migration credentials", async () => {
    const ledger = await loadLedger(ledgerPath);
    for (const owner of ledger.owners) {
      const artifact = JSON.parse(
        await readFile(resolve(root, `artifacts/${owner.owner}/artifact.json`), "utf8"),
      ) as { requiredConfig: string[]; allowedConfig: string[] };
      const ownCredentials = [
        ...array(owner.credentials.migration),
        ...array(owner.credentials.runtime),
      ];
      expect(artifact.requiredConfig).toEqual(expect.arrayContaining(ownCredentials));
      for (const foreign of ledger.owners.filter(({ owner: name }) => name !== owner.owner)) {
        for (const credential of [
          ...array(foreign.credentials.migration),
          ...array(foreign.credentials.runtime),
        ]) {
          expect(artifact.allowedConfig).not.toContain(credential);
        }
      }
    }
  });

  it("fails closed on foreign credential and table fixtures", async () => {
    const ledger = await loadLedger(ledgerPath);
    const credential = JSON.parse(
      await readFile(
        resolve(root, "contracts/migrations/negative/foreign-credential.json"),
        "utf8",
      ),
    ) as Partial<OwnerRecord>;
    const table = JSON.parse(
      await readFile(resolve(root, "contracts/migrations/negative/foreign-table.json"), "utf8"),
    ) as Partial<OwnerRecord>;
    expect(() => validateCandidate(ledger, credential)).toThrow("FOREIGN_CREDENTIAL");
    expect(() => validateCandidate(ledger, table)).toThrow("FOREIGN_TABLE");
  });
});

async function loadLedger(path: string): Promise<Ledger> {
  return JSON.parse(await readFile(path, "utf8")) as Ledger;
}

function migrationDirectory(owner: string): string {
  return owner === "community"
    ? resolve(root, "services/community/src/main/resources/db/migration")
    : resolve(root, `services/${owner}/migrations`);
}

function array(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return typeof value === "string" ? [value] : value;
}

function validateCandidate(ledger: Ledger, candidate: Partial<OwnerRecord>): void {
  const owner = ledger.owners.find(({ owner }) => owner === candidate.owner);
  if (!owner) throw new Error("UNKNOWN_OWNER");
  const ownCredentials = new Set([
    ...array(owner.credentials.migration),
    ...array(owner.credentials.runtime),
  ]);
  const presented = candidate.credentials
    ? [...array(candidate.credentials.migration), ...array(candidate.credentials.runtime)]
    : [];
  if (presented.some((credential) => !ownCredentials.has(credential))) {
    throw new Error("FOREIGN_CREDENTIAL");
  }
  if (
    candidate.tables?.allowedPrefixes.some(
      (prefix) => !owner.tables.allowedPrefixes.includes(prefix),
    )
  ) {
    throw new Error("FOREIGN_TABLE");
  }
}
