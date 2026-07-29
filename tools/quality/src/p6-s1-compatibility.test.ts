import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Policy = {
  current: string;
  previous: string;
  supportWindowDays: number;
  selectionHeader: string;
  unsupportedStatus: number;
  breakingChanges: string[];
  versions: Record<string, { state: string; eventVersions: number[] }>;
};

const root = resolve("contracts/community/p6-s1");

describe("P6-S1 language-neutral compatibility policy", () => {
  it("freezes exactly current and previous with a bounded support window", async () => {
    const policy = JSON.parse(
      await readFile(resolve(root, "compatibility-policy.json"), "utf8"),
    ) as Policy;
    expect(policy.current).toBe("community-v2");
    expect(policy.previous).toBe("community-v1");
    expect(policy.supportWindowDays).toBeGreaterThanOrEqual(90);
    expect(policy.selectionHeader).toBe("x-lifebridge-contract-version");
    expect(policy.unsupportedStatus).toBe(406);
    expect(policy.versions[policy.current]?.state).toBe("current");
    expect(policy.versions[policy.previous]?.state).toBe("previous");
    expect(policy.versions[policy.current]?.eventVersions).toEqual([1, 2]);
    expect(policy.versions[policy.previous]?.eventVersions).toEqual([1]);
  });

  it("requires all four rolling cells to preserve the previous-first journey", async () => {
    const matrix = JSON.parse(
      await readFile(resolve(root, "compatibility-matrix.json"), "utf8"),
    ) as {
      wireDefaultUntilProviderConvergence: string;
      cells: Array<{ gateway: string; community: string; selected: string; expected: string }>;
    };
    expect(matrix.wireDefaultUntilProviderConvergence).toBe("community-v1");
    expect(matrix.cells).toHaveLength(4);
    expect(new Set(matrix.cells.map((cell) => `${cell.gateway}:${cell.community}`))).toEqual(
      new Set(["previous:previous", "previous:current", "current:previous", "current:current"]),
    );
    expect(matrix.cells.every((cell) => cell.expected === "pass")).toBe(true);
  });

  it("fails a required request addition and permits an optional response addition", async () => {
    const incompatible = JSON.parse(
      await readFile(resolve(root, "negative/add-required-request-field.json"), "utf8"),
    ) as { change: string; compatible: boolean };
    const compatible = JSON.parse(
      await readFile(resolve(root, "negative/add-optional-response-field.json"), "utf8"),
    ) as { change: string; compatible: boolean };
    expect(incompatible).toEqual({
      change: "add-required-request-field",
      compatible: false,
    });
    expect(compatible).toEqual({
      change: "add-optional-response-field",
      compatible: true,
    });
  });

  it("keeps event v2 additive and required business fields stable", async () => {
    const previous = JSON.parse(
      await readFile(resolve(root, "events/help-request-lifecycle-v1.schema.json"), "utf8"),
    ) as { required: string[]; properties: Record<string, unknown> };
    const current = JSON.parse(
      await readFile(resolve(root, "events/help-request-lifecycle-v2.schema.json"), "utf8"),
    ) as { required: string[]; properties: Record<string, unknown> };
    expect(current.required).toEqual(previous.required);
    expect(Object.keys(current.properties)).toEqual(
      expect.arrayContaining(Object.keys(previous.properties)),
    );
    expect(current.properties).toHaveProperty("causationId");
  });
});
