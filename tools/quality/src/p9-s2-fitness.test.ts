import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Inventory {
  schemaVersion: string;
  queuePolicy: {
    allowlistedOperations: string[];
    storage: string;
    reconnect: string;
    reauthorizeAtDispatch: boolean;
  };
  mutations: Array<{
    id: string;
    method: string;
    path: string;
    kind: string;
    offline: string;
    idempotency: string;
    version: string;
    reconcile: string;
  }>;
}

const inventory = JSON.parse(
  readFileSync("contracts/resilience/p9-s2-mutation-inventory.json", "utf8"),
) as Inventory;
const copy = JSON.parse(
  readFileSync("contracts/resilience/p9-s2-state-copy.vi-en.json", "utf8"),
) as { states: Record<string, { vi: string; en: string }> };

describe("P9-S2 frozen mutation inventory", () => {
  it("is unique, versioned and complete for every declared mutation", () => {
    expect(inventory.schemaVersion).toBe("P9-S2-mutation-inventory-v1");
    expect(new Set(inventory.mutations.map(({ id }) => id)).size).toBe(inventory.mutations.length);
    expect(inventory.mutations.length).toBeGreaterThanOrEqual(40);
    for (const mutation of inventory.mutations) {
      expect(mutation).toMatchObject({
        method: expect.any(String),
        path: expect.stringContaining("/api/v1/"),
        offline: expect.any(String),
        idempotency: expect.any(String),
        version: expect.any(String),
        reconcile: expect.any(String),
      });
    }
  });

  it("covers representative create, update, delete, acknowledge, upload and event-backed flows", () => {
    for (const id of [
      "task.create",
      "appointment.change",
      "document.delete",
      "medication.ack",
      "document.upload",
      "community.help.create",
    ]) {
      expect(inventory.mutations.some((mutation) => mutation.id === id)).toBe(true);
    }
  });

  it("allows only memory-bound explicit-review queueing", () => {
    expect(inventory.queuePolicy).toEqual(
      expect.objectContaining({
        allowlistedOperations: ["task.create"],
        storage: "memory_only_current_tab",
        reconnect: "explicit_review_and_send_only",
        reauthorizeAtDispatch: true,
      }),
    );
    expect(inventory.mutations.filter(({ offline }) => offline.startsWith("queue"))).toHaveLength(
      1,
    );
  });

  it("freezes long bilingual copy for every truthful state", () => {
    expect(Object.keys(copy.states).sort()).toEqual([
      "blocked",
      "confirmed",
      "conflicted",
      "dependency_failed",
      "queued",
      "reconciling",
      "rejected",
      "stale",
      "uncertain",
    ]);
    for (const state of Object.values(copy.states)) {
      expect(state.vi.length).toBeGreaterThan(35);
      expect(state.en.length).toBeGreaterThan(35);
    }
  });
});
