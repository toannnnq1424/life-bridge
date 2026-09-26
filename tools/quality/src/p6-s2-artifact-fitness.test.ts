import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Manifest = {
  name: string;
  owner: string;
  runtime: "node" | "java";
  entrypoint: string;
  requiredConfig: string[];
  allowedConfig: string[];
  databaseCredential: string | null;
  health: { live: string; ready: string };
  container: string;
  sbom: string;
};

const deployables = [
  "web",
  "gateway",
  "identity-consent",
  "care-coordination",
  "notification",
  "community",
];
const serviceRoots = [
  "apps/gateway",
  "apps/web",
  "services/identity-consent",
  "services/care-coordination",
  "services/notification",
  "services/community",
];
const databaseCredentials = [
  "IDENTITY_DATABASE_URL",
  "CARE_DATABASE_URL",
  "NOTIFICATION_DATABASE_URL",
  "COMMUNITY_DATABASE_PASSWORD",
];

describe("P6-S2 artifact ownership fitness", () => {
  it("declares one complete owner contract per deployable", async () => {
    const dirs = (await readdir("artifacts", { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(dirs).toEqual([...deployables].sort());
    for (const name of deployables) {
      const manifest = JSON.parse(
        await readFile(resolve("artifacts", name, "artifact.json"), "utf8"),
      ) as Manifest;
      expect(manifest.name).toBe(name);
      expect(manifest.owner).toBe(name);
      expect(manifest.entrypoint).toBeTruthy();
      expect(manifest.health).toEqual({ live: "/health/live", ready: "/health/ready" });
      expect(manifest.sbom).toBe(`sbom/${name}.cdx.json`);
      expect(manifest.container).toBe(`artifacts/${name}/Dockerfile`);
      expect(new Set(manifest.allowedConfig).size).toBe(manifest.allowedConfig.length);
      expect(manifest.requiredConfig.every((key) => manifest.allowedConfig.includes(key))).toBe(
        true,
      );
      const foreign = databaseCredentials.filter((key) => key !== manifest.databaseCredential);
      expect(manifest.allowedConfig.filter((key) => foreign.includes(key))).toEqual([]);
    }
  });

  it("forbids cross-deployable source imports", async () => {
    for (const root of serviceRoots) {
      const files = await sourceFiles(root);
      for (const file of files) {
        const source = await readFile(file, "utf8");
        expect(source, file).not.toMatch(/from\s+["'][^"']*(?:apps|services)\//u);
      }
    }
  });

  it("keeps final container stages non-root and free of broad repository copies", async () => {
    for (const name of deployables) {
      const dockerfile = await readFile(resolve("artifacts", name, "Dockerfile"), "utf8");
      expect(dockerfile, name).toMatch(/\nUSER\s+(?:node|10001)\s*\n/u);
      expect(dockerfile, name).not.toMatch(/^FROM\s+[^\s@]+(?:\s|$)/gmu);
      expect(dockerfile.match(/^FROM\s+[^\s]+@sha256:[a-f0-9]{64}/gmu)?.length, name).toBe(2);
      expect(dockerfile, name).not.toMatch(/^COPY\s+\.\s+/gmu);
      expect(dockerfile, name).not.toMatch(/COPY\s+--from=build[^\n]+\/(?:src|tests)\b/u);
    }
  });
});

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (["node_modules", "dist", "target", ".next"].includes(entry.name)) continue;
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(?:ts|tsx|java)$/u.test(entry.name)) files.push(path);
  }
  return files;
}
