import { randomUUID } from "node:crypto";

import { CorrelationIdSchema } from "@lifebridge/contracts";

export type LogLevel = "info" | "warn" | "error";
export type LogResult = "success" | "denied" | "conflict" | "failed" | "pending";

export interface SafeLogEvent {
  timestamp: string;
  level: LogLevel;
  service: string;
  eventName: string;
  operation: string;
  result: LogResult;
  correlationId: string;
  errorCode?: string;
  durationMs?: number;
  retryCount?: number;
  actorId?: string;
  householdId?: string;
  resourceId?: string;
  eventType?: string;
  eventVersion?: number;
}

export type LogSink = (serialized: string) => void;

export class SafeLogger {
  public constructor(
    private readonly service: string,
    private readonly sink: LogSink = (serialized) => {
      process.stdout.write(`${serialized}\n`);
    },
    private readonly now: () => Date = () => new Date(),
  ) {}

  public emit(event: Omit<SafeLogEvent, "timestamp" | "service">): void {
    const safe: SafeLogEvent = {
      timestamp: this.now().toISOString(),
      service: this.service,
      ...event,
    };
    this.sink(JSON.stringify(safe));
  }
}

export function resolveCorrelationId(value: unknown): string {
  const parsed = CorrelationIdSchema.safeParse(value);
  return parsed.success ? parsed.data : `corr_${randomUUID().replaceAll("-", "")}`;
}

export function boundedErrorCode(value: unknown, fallback = "UNEXPECTED_FAILURE"): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.replaceAll(/[^A-Z0-9_]/g, "_").slice(0, 64);
  return normalized.length > 0 ? normalized : fallback;
}
