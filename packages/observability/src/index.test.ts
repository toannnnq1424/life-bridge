import { describe, expect, it } from "vitest";

import {
  acceptTrustedTraceContext,
  createTrustedTraceContext,
  SafeLogger,
  SafeMetrics,
  SafeTracer,
  safePropagationHeaders,
  resolveCorrelationId,
} from "./index.js";

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
    });
  });

  it("restarts untrusted context and propagates no baggage", () => {
    const hostile = "00-11111111111111111111111111111111-2222222222222222-01";
    const first = acceptTrustedTraceContext(hostile, false);
    const second = acceptTrustedTraceContext(hostile, false);
    expect(first.traceId).not.toBe("11111111111111111111111111111111");
    expect(first.traceId).not.toBe(second.traceId);
    expect(Object.keys(safePropagationHeaders(first))).toEqual(["traceparent", "x-correlation-id"]);
  });

  it("continues only trusted strict W3C context with a fresh span", () => {
    const parent = createTrustedTraceContext();
    const child = acceptTrustedTraceContext(parent.traceparent, true);
    expect(child.traceId).toBe(parent.traceId);
    expect(child.spanId).not.toBe(parent.spanId);
  });

  it("drops sensitive/unknown runtime keys, control injection and survives sink failure", () => {
    const output: string[] = [];
    const logger = new SafeLogger("gateway", (value) => output.push(value));
    logger.emit({
      level: "info",
      eventName: "bad\r\nsecret",
      operation: "request",
      result: "success",
      correlationId: "corr_safe_123",
      actorId: "household_private",
      password: "hidden",
      baggage: "email@example.test",
    } as never);
    expect(output.join("\n")).not.toMatch(/household_private|hidden|example\.test|\r|\nsecret/);
    expect(() =>
      new SafeLogger("gateway", () => {
        throw new Error("exporter down");
      }).emit({
        level: "info",
        eventName: "request.accepted",
        operation: "request",
        result: "success",
        correlationId: "corr_safe_123",
      }),
    ).not.toThrow();
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

  it("keeps truthful P9-S2 results bounded across metrics and spans", () => {
    const output: string[] = [];
    const metrics = new SafeMetrics("gateway", (value) => output.push(value));
    const tracer = new SafeTracer("gateway", (value) => output.push(value));
    metrics.emit({
      metricName: "lifebridge_operation_total",
      operation: "journey.reconcile",
      result: "queued",
      value: 1,
    });
    tracer.emit({
      operation: "journey.reconcile",
      result: "private_result" as never,
      correlationId: "corr_safe_123",
      durationMs: 1,
    });
    expect(JSON.parse(output[0] ?? "{}").result).toBe("queued");
    expect(JSON.parse(output[1] ?? "{}").result).toBe("failed");
  });
});
