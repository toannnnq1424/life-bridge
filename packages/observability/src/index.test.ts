import { describe, expect, it } from "vitest";

import { SafeLogger, SafeMetrics, SafeTracer, resolveCorrelationId } from "./index.js";

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

  it("emits metrics and spans with no extensible sensitive labels", () => {
    const output: string[] = [];
    const now = () => new Date("2026-07-26T12:00:00.000Z");
    const metrics = new SafeMetrics("identity-consent", (value) => output.push(value), now);
    const tracer = new SafeTracer("identity-consent", (value) => output.push(value), now);

    metrics.emit({
      metricName: "lifebridge_operation_total",
      operation: "consent.revoke",
      result: "success",
      value: 1,
    });
    tracer.emit({
      operation: "consent.revoke",
      result: "success",
      correlationId: "corr_consent_123",
      durationMs: 8,
    });

    expect(output).toHaveLength(2);
    expect(output.join("\n")).not.toContain("recipient_context.basic_label");
    expect(output.join("\n")).not.toContain("idempotency");
    expect(JSON.parse(output[0] ?? "{}")).toEqual({
      timestamp: "2026-07-26T12:00:00.000Z",
      service: "identity-consent",
      metricName: "lifebridge_operation_total",
      operation: "consent.revoke",
      result: "success",
      value: 1,
    });
    expect(JSON.parse(output[1] ?? "{}")).toEqual({
      timestamp: "2026-07-26T12:00:00.000Z",
      service: "identity-consent",
      spanName: "lifebridge.operation",
      operation: "consent.revoke",
      result: "success",
      correlationId: "corr_consent_123",
      durationMs: 8,
    });
  });
});
