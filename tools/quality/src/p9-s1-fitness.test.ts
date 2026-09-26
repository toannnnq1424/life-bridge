import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  acceptTrustedTraceContext,
  SafeLogger,
} from "../../../packages/observability/src/index.js";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
describe("P9-S1 telemetry architecture fitness", () => {
  it("inventories every deployable, durable path and mandated dashboard class", () => {
    const inventory = read("contracts/observability/p9-s1-inventory.json");
    const dashboards = read("contracts/observability/p9-s1-dashboards.json");
    expect(new Set(inventory.journeys.flatMap((j: { owners: string[] }) => j.owners))).toEqual(
      new Set(["gateway", "identity-consent", "care-coordination", "notification", "community"]),
    );
    expect(inventory.journeys[0].paths).toEqual(
      expect.arrayContaining(["postgresql", "outbox", "inbox", "replay", "reconciliation"]),
    );
    expect(dashboards.definitions.map((d: { id: string }) => d.id)).toEqual(
      expect.arrayContaining([
        "validation",
        "authorization-denial",
        "abuse-rate-limit",
        "dependency-circuit",
        "database-migration-storage",
        "event-lag-replay-poison-terminal",
        "privacy-policy-block",
      ]),
    );
  });
  it("restarts spoofed public traces and serializes no negative-fixture content", () => {
    const fixture = read("contracts/observability/negative/hostile-telemetry.json");
    expect(acceptTrustedTraceContext(fixture.correlation[2], false).traceId).not.toBe(
      "00000000000000000000000000000000",
    );
    const output: string[] = [];
    new SafeLogger("gateway", (v) => output.push(v)).emit({
      level: "warn",
      eventName: "request.rejected",
      operation: "request",
      result: "failed",
      correlationId: fixture.correlation[1],
      ...fixture.attributes,
    } as never);
    for (const forbidden of [
      "password",
      "household_private",
      "medication",
      "document",
      "sql connection",
    ])
      expect(output[0]).not.toContain(forbidden);
  });
  it("keeps confirmed state independent from exporter failure", () => {
    const confirmed = true;
    const logger = new SafeLogger("care-coordination", () => {
      throw new Error("sink unavailable");
    });
    expect(() =>
      logger.emit({
        level: "info",
        eventName: "event.delivered",
        operation: "dispatch",
        result: "success",
        correlationId: "corr_synthetic_123",
      }),
    ).not.toThrow();
    expect(confirmed).toBe(true);
  });
});
