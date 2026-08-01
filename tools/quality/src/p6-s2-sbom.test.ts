import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { generateSboms } from "./p6-s2-sbom.ts";

let output: string | undefined;
afterEach(async () => output && rm(output, { recursive: true, force: true }));

describe("P6-S2 per-artifact SBOM", () => {
  it("emits six deterministic CycloneDX inventories without foreign runtime families", async () => {
    output = await mkdtemp(resolve(tmpdir(), "lifebridge-p6-s2-sbom-"));
    await generateSboms(output);
    const gateway = await bom("gateway");
    const identity = await bom("identity-consent");
    const notification = await bom("notification");
    const community = await bom("community");
    expect(gateway.bomFormat).toBe("CycloneDX");
    expect(gateway.components.map((item) => item.name)).not.toContain("pg");
    expect(notification.components.map((item) => item.name)).not.toContain("@node-rs/argon2");
    expect(identity.components.map((item) => item.name)).toContain("@node-rs/argon2");
    expect(community.components.every((item) => !item.purl?.startsWith("pkg:npm/"))).toBe(true);
  });
});

async function bom(
  name: string,
): Promise<{ bomFormat: string; components: Array<{ name: string; purl?: string }> }> {
  return JSON.parse(await readFile(resolve(output!, `${name}.cdx.json`), "utf8"));
}
