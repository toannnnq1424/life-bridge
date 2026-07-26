import { describe, expect, it } from "vitest";

import { SafeLogger, resolveCorrelationId } from "./index.js";

describe("safe structured logging", () => {
  it("serializes only the allow-listed shape", () => {
    const output: string[] = [];
    const logger = new SafeLogger(
      "care-coordination",
      (serialized) => output.push(serialized),
      () => new Date("2026-08-03T02:05:00.000Z"),
    );

    logger.emit({
      level: "info",
      eventName: "task.complete",
      operation: "complete",
      result: "success",
      correlationId: "corr_demo_123",
      actorId: "member_minh",
      resourceId: "task_demo_1",
    });

    expect(output).toHaveLength(1);
    expect(output[0]).not.toContain("Arrange transport");
    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      timestamp: "2026-08-03T02:05:00.000Z",
      service: "care-coordination",
      level: "info",
      eventName: "task.complete",
      operation: "complete",
      result: "success",
      correlationId: "corr_demo_123",
      actorId: "member_minh",
      resourceId: "task_demo_1",
    });
  });

  it("replaces invalid inbound correlation identifiers", () => {
    const resolved = resolveCorrelationId("unsafe correlation\nsecret");
    expect(resolved).toMatch(/^corr_[a-f0-9]{32}$/);
  });
});
