import { randomBytes, randomUUID } from "node:crypto";

import { CorrelationIdSchema } from "@lifebridge/contracts";

export type LogLevel = "info" | "warn" | "error";
export type LogResult =
  | "success"
  | "denied"
  | "conflict"
  | "failed"
  | "pending"
  | "queued"
  | "blocked"
  | "rejected"
  | "dependency_failed"
  | "uncertain"
  | "reconciling"
  | "confirmed";
export type FailureClass =
  | "validation"
  | "authorization"
  | "privacy_policy"
  | "timeout"
  | "rate_limited"
  | "rejected"
  | "unavailable"
  | "invalid_response"
  | "saturated"
  | "database"
  | "migration"
  | "storage"
  | "event_lag"
  | "replay"
  | "poison"
  | "terminal_attention"
  | "telemetry_dropped";

export interface SafeLogEvent {
  timestamp: string;
  level: LogLevel;
  service: string;
  eventName: string;
  operation: string;
  result: LogResult;
  correlationId: string;
  traceId?: string;
  spanId?: string;
  errorCode?: string;
  durationMs?: number;
  retryCount?: number;
  dependency?: "identity" | "care" | "notification" | "community" | "postgresql";
  failureClass?: FailureClass;
  circuitState?: "closed" | "open" | "half_open";
  eventType?: string;
  eventVersion?: number;
  // Deprecated input-only compatibility fields. They are never serialized.
  actorId?: string;
  householdId?: string;
  resourceId?: string;
}

export type LogSink = (serialized: string) => void;
export type PrivacySafeOperation =
  | "consent.bind"
  | "consent.grant"
  | "consent.narrow"
  | "consent.revoke"
  | "consent.authorize"
  | "community.authorize"
  | "coordination.authorize"
  | "audit.read"
  | "privacy.update"
  | "journey.http"
  | "journey.event"
  | "journey.replay"
  | "journey.reconcile"
  | "dependency.call"
  | "storage.operation";
export type TelemetryResult = LogResult;

const telemetryResults: readonly TelemetryResult[] = [
  "success",
  "denied",
  "conflict",
  "failed",
  "pending",
  "queued",
  "blocked",
  "rejected",
  "dependency_failed",
  "uncertain",
  "reconciling",
  "confirmed",
];
const safeTelemetryResult = (value: unknown): TelemetryResult =>
  telemetryResults.includes(value as TelemetryResult) ? (value as TelemetryResult) : "failed";

const SAFE_TOKEN = /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/;
const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-(0[01])$/;
const finite = (value: unknown, max: number): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
    ? value
    : undefined;
const token = (value: unknown, fallback: string): string =>
  typeof value === "string" && SAFE_TOKEN.test(value) ? value : fallback;
const correlation = (value: unknown): string =>
  CorrelationIdSchema.safeParse(value).success
    ? (value as string)
    : `corr_${randomUUID().replaceAll("-", "")}`;

function nonThrowingSink(sink: LogSink, serialized: string): void {
  try {
    sink(serialized);
  } catch {
    /* Telemetry must never change core state. */
  }
}

export class SafeLogger {
  public constructor(
    private readonly service: string,
    private readonly sink: LogSink = (v) => process.stdout.write(`${v}\n`),
    private readonly now: () => Date = () => new Date(),
  ) {}
  public emit(event: Omit<SafeLogEvent, "timestamp" | "service">): void {
    const safe: SafeLogEvent = {
      timestamp: this.now().toISOString(),
      service: token(this.service, "unknown-service"),
      level: (["info", "warn", "error"] as unknown[]).includes(event.level) ? event.level : "error",
      eventName: token(event.eventName, "telemetry.invalid"),
      operation: token(event.operation, "unknown"),
      result: (
        [
          "success",
          "denied",
          "conflict",
          "failed",
          "pending",
          "queued",
          "blocked",
          "rejected",
          "dependency_failed",
          "uncertain",
          "reconciling",
          "confirmed",
        ] as unknown[]
      ).includes(event.result)
        ? event.result
        : "failed",
      correlationId: correlation(event.correlationId),
    };
    if (event.traceId?.match(/^[0-9a-f]{32}$/)) safe.traceId = event.traceId;
    if (event.spanId?.match(/^[0-9a-f]{16}$/)) safe.spanId = event.spanId;
    if (event.errorCode) safe.errorCode = boundedErrorCode(event.errorCode);
    const duration = finite(event.durationMs, 86_400_000);
    if (duration !== undefined) safe.durationMs = duration;
    const retry = finite(event.retryCount, 100);
    if (retry !== undefined) safe.retryCount = retry;
    if (
      ["identity", "care", "notification", "community", "postgresql"].includes(
        event.dependency ?? "",
      )
    )
      safe.dependency = event.dependency!;
    if (
      [
        "validation",
        "authorization",
        "privacy_policy",
        "timeout",
        "rate_limited",
        "rejected",
        "unavailable",
        "invalid_response",
        "saturated",
        "database",
        "migration",
        "storage",
        "event_lag",
        "replay",
        "poison",
        "terminal_attention",
        "telemetry_dropped",
      ].includes(event.failureClass ?? "")
    )
      safe.failureClass = event.failureClass!;
    if (["closed", "open", "half_open"].includes(event.circuitState ?? ""))
      safe.circuitState = event.circuitState!;
    if (event.eventType) safe.eventType = token(event.eventType, "unknown.event");
    const version = finite(event.eventVersion, 1000);
    if (version !== undefined) safe.eventVersion = version;
    nonThrowingSink(this.sink, JSON.stringify(safe));
  }
}

export interface SafeMetricEvent {
  timestamp: string;
  service: string;
  metricName:
    | "lifebridge_operation_total"
    | "lifebridge_operation_duration_ms"
    | "lifebridge_event_lag_ms"
    | "lifebridge_telemetry_dropped_total";
  operation: PrivacySafeOperation;
  result: TelemetryResult;
  value: number;
}
export class SafeMetrics {
  public constructor(
    private readonly service: string,
    private readonly sink: LogSink = (v) => process.stdout.write(`${v}\n`),
    private readonly now: () => Date = () => new Date(),
  ) {}
  public emit(event: Omit<SafeMetricEvent, "timestamp" | "service">): void {
    const value = finite(event.value, Number.MAX_SAFE_INTEGER);
    if (value === undefined) return;
    nonThrowingSink(
      this.sink,
      JSON.stringify({
        timestamp: this.now().toISOString(),
        service: token(this.service, "unknown-service"),
        metricName: event.metricName,
        operation: event.operation,
        result: safeTelemetryResult(event.result),
        value,
      } satisfies SafeMetricEvent),
    );
  }
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  correlationId: string;
  traceparent: string;
}
export function createTrustedTraceContext(): TraceContext {
  const traceId = randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");
  return {
    traceId,
    spanId,
    correlationId: `corr_${randomUUID().replaceAll("-", "")}`,
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}
export function acceptTrustedTraceContext(value: unknown, trusted: boolean): TraceContext {
  if (!trusted || typeof value !== "string") return createTrustedTraceContext();
  const match = TRACEPARENT.exec(value);
  if (!match || /^0+$/.test(match[1]!) || /^0+$/.test(match[2]!))
    return createTrustedTraceContext();
  const spanId = randomBytes(8).toString("hex");
  return {
    traceId: match[1]!,
    spanId,
    correlationId: `corr_${match[1]}`,
    traceparent: `00-${match[1]}-${spanId}-01`,
  };
}
export function safePropagationHeaders(context: TraceContext): Record<string, string> {
  return { traceparent: context.traceparent, "x-correlation-id": context.correlationId };
}

export interface SafeSpanEvent {
  timestamp: string;
  service: string;
  spanName: "lifebridge.operation";
  operation: PrivacySafeOperation;
  result: TelemetryResult;
  correlationId: string;
  traceId?: string;
  spanId?: string;
  durationMs: number;
}
export class SafeTracer {
  public constructor(
    private readonly service: string,
    private readonly sink: LogSink = (v) => process.stdout.write(`${v}\n`),
    private readonly now: () => Date = () => new Date(),
  ) {}
  public emit(event: Omit<SafeSpanEvent, "timestamp" | "service" | "spanName">): void {
    const durationMs = finite(event.durationMs, 86_400_000);
    if (durationMs === undefined) return;
    const safe: SafeSpanEvent = {
      timestamp: this.now().toISOString(),
      service: token(this.service, "unknown-service"),
      spanName: "lifebridge.operation",
      operation: event.operation,
      result: safeTelemetryResult(event.result),
      correlationId: correlation(event.correlationId),
      durationMs,
    };
    if (event.traceId?.match(/^[0-9a-f]{32}$/)) safe.traceId = event.traceId;
    if (event.spanId?.match(/^[0-9a-f]{16}$/)) safe.spanId = event.spanId;
    nonThrowingSink(this.sink, JSON.stringify(safe));
  }
}

export function resolveCorrelationId(value: unknown): string {
  return correlation(value);
}
export function resolvePublicCorrelationId(value: unknown): string {
  void value;
  return createTrustedTraceContext().correlationId;
}
export function boundedErrorCode(value: unknown, fallback = "UNEXPECTED_FAILURE"): string {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(value) ? value : fallback;
}
