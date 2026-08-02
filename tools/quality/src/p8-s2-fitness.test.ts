import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createProvenance, verifyProvenance } from "./p8-s2-provenance.js";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

describe("P8-S2 secrets, runtime and supply-chain fitness", () => {
  it("freezes owned credentials, truthful encryption and bounded rotation", async () => {
    const inventory = JSON.parse(
      await readFile("contracts/security/p8-s2-secret-inventory.json", "utf8"),
    );
    expect(inventory.credentials.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([
        "human-password-session",
        "service-assertions",
        "identity-data-key",
        "owner-runtime-database",
        "owner-migration-database",
        "ci-build-identity",
      ]),
    );
    for (const credential of inventory.credentials) {
      expect(credential.owner).toBeTruthy();
      expect(credential.consumers.length).toBeGreaterThan(0);
      expect(credential.rotation.overlapSeconds).toBeGreaterThanOrEqual(0);
      expect(credential.rotation.revocation).toBeTruthy();
      expect(JSON.stringify(credential)).not.toMatch(/password\s*[:=]\s*[^"}]+/iu);
    }
    expect(inventory.nonClaims.join(" ")).toContain("No external secret manager");
    expect(
      inventory.encryptionBoundaries.some((item: { atRest: string }) =>
        item.atRest.includes("not evidenced"),
      ),
    ).toBe(true);
  });

  it("rejects unpinned workflow/container inputs and stale exceptions", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu))
      expect(match[1]).toMatch(/@[a-f0-9]{40}$/u);
    for (const name of [
      "web",
      "gateway",
      "identity-consent",
      "care-coordination",
      "notification",
      "community",
    ]) {
      const dockerfile = await readFile(`artifacts/${name}/Dockerfile`, "utf8");
      for (const match of dockerfile.matchAll(/^FROM\s+([^\s]+)/gmu))
        expect(match[1]).toMatch(/@sha256:[a-f0-9]{64}$/u);
    }
    const policy = JSON.parse(
      await readFile("contracts/security/p8-s2-supply-chain-policy.json", "utf8"),
    );
    expect(policy.exceptions).toEqual([]);
    expect(policy.releaseThresholds).toEqual(
      expect.objectContaining({ dependency: "high", container: "high", secretLeak: 0 }),
    );
  });

  it("binds exact source, artifact, SBOM and inputs and detects tamper", async () => {
    const root = await mkdtemp(join(tmpdir(), "lifebridge-p8-s2-"));
    roots.push(root);
    const artifactPath = join(root, "artifact.bin"),
      sbomPath = join(root, "bom.json"),
      inputPath = join(root, "Dockerfile");
    await writeFile(artifactPath, "artifact");
    await writeFile(sbomPath, '{"bomFormat":"CycloneDX"}');
    await writeFile(inputPath, "FROM pinned@sha256:00");
    const input = {
      artifact: "gateway",
      sourceSha: "a".repeat(40),
      artifactPath,
      sbomPath,
      buildInputPaths: [inputPath],
      builderVersions: { node: "22.22.0", pnpm: "11.9.0" },
    };
    const record = await createProvenance(input);
    await expect(verifyProvenance(record, input)).resolves.toBeUndefined();
    await writeFile(artifactPath, "tampered");
    await expect(verifyProvenance(record, input)).rejects.toThrow("PROVENANCE_BINDING_INVALID");
  });

  it("requires orchestrator-enforced least privilege and production guards", async () => {
    const policy = JSON.parse(
      await readFile("contracts/security/p8-s2-runtime-policy.json", "utf8"),
    );
    expect(policy.deployables).toHaveLength(6);
    expect(policy.container).toMatchObject({
      runAsNonRoot: true,
      readOnlyRootFilesystem: true,
      noNewPrivileges: true,
      declaredPortsOnly: true,
    });
    expect(policy.container.dropCapabilities).toEqual(["ALL"]);
    expect(policy.production).toMatchObject({
      fixtures: false,
      debug: false,
      migrationCredentialsInRuntime: false,
      runtimeAutoMigration: false,
    });
    expect(policy.orchestratorEnforcementRequired).toBe(true);
  });
});
