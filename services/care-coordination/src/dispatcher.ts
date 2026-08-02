import type { CareCoordinationEvent, ConsumerAcknowledgement } from "@lifebridge/contracts";
import { ConsumerAcknowledgementSchema } from "@lifebridge/contracts";
import { boundedErrorCode, SafeLogger } from "@lifebridge/observability";
import { createServiceAssertion, DependencyGuard } from "@lifebridge/config";

import type { CareService } from "./service.js";

export type EventDeliverer = (event: CareCoordinationEvent) => Promise<ConsumerAcknowledgement>;

export class OutboxDispatcher {
  private readonly logger: SafeLogger;

  public constructor(
    private readonly care: CareService,
    private readonly deliver: EventDeliverer,
    private readonly maxAttempts = 3,
    logger?: SafeLogger,
    private readonly delay: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.logger = logger ?? new SafeLogger("care-coordination");
  }

  public async dispatchOnce(): Promise<"idle" | "delivered" | "failed"> {
    const claimed = await this.care.claimOutbox();
    if (!claimed) {
      return "idle";
    }

    try {
      if (claimed.attemptCount > 1) {
        await this.delay(Math.min(250 * 2 ** (claimed.attemptCount - 2), 1_000));
      }
      const acknowledgement = ConsumerAcknowledgementSchema.parse(
        await this.deliver(claimed.event),
      );
      if (acknowledgement.eventId !== claimed.event.eventId) {
        throw new Error("ACK_EVENT_MISMATCH");
      }
      const acknowledged = await this.care.markOutboxAcknowledged(
        claimed.event.eventId,
        claimed.claimToken,
        acknowledgement.result,
      );
      if (!acknowledged) return "failed";
      this.logger.emit({
        level: "info",
        eventName:
          claimed.event.eventType === "care.appointment.reminder_intent.v1"
            ? "appointment.reminder_intent.acknowledged"
            : claimed.event.eventType === "care.medication_reminder.intent.v1"
              ? "medication_reminder.intent.acknowledged"
              : acknowledgement.result === "suppressed_self"
                ? "task.notification.suppressed_self"
                : "task.notification.delivered",
        operation: "outbox.dispatch",
        result: "success",
        correlationId: claimed.event.correlationId,
        resourceId: claimed.event.aggregateId,
        eventType: claimed.event.eventType,
        eventVersion: claimed.event.eventVersion,
        retryCount: claimed.attemptCount,
      });
      return "delivered";
    } catch (error) {
      const errorCode =
        error instanceof Error &&
        /^NOTIFICATION_HTTP_(?:400|401|403|404|409|429|500|502|503|504)$/.test(error.message)
          ? boundedErrorCode(error.message, "NOTIFICATION_DELIVERY_FAILED")
          : "NOTIFICATION_DELIVERY_FAILED";
      const retryable =
        errorCode === "NOTIFICATION_DELIVERY_FAILED" ||
        /^NOTIFICATION_HTTP_(?:429|500|502|503|504)$/.test(errorCode);
      await this.care.markOutboxFailed(
        claimed.event.eventId,
        claimed.claimToken,
        errorCode,
        claimed.attemptCount,
        retryable ? this.maxAttempts : claimed.attemptCount,
      );
      this.logger.emit({
        level: "warn",
        eventName: "task.notification.failed",
        operation: "outbox.dispatch",
        result: "failed",
        correlationId: claimed.event.correlationId,
        errorCode,
        resourceId: claimed.event.aggregateId,
        eventType: claimed.event.eventType,
        eventVersion: claimed.event.eventVersion,
        retryCount: claimed.attemptCount,
        dependency: "notification",
        failureClass: /^NOTIFICATION_HTTP_(?:400|401|403|404|409)$/.test(errorCode)
          ? "rejected"
          : "unavailable",
      });
      return "failed";
    }
  }
}

export function httpEventDeliverer(notificationUrl: string, serviceToken: string): EventDeliverer {
  const guard = new DependencyGuard({ maxConcurrent: 4, failureThreshold: 3, openMs: 5_000 });
  return async (event) => {
    return guard.execute(async () => {
      const body = JSON.stringify(event);
      if (Buffer.byteLength(body) > 64 * 1024) throw new Error("NOTIFICATION_PAYLOAD_TOO_LARGE");
      const response = await fetch(`${notificationUrl}/internal/v1/events/care-coordination`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": serviceToken,
          "x-lifebridge-service-identity": createServiceAssertion({
            caller: "care-coordination",
            audience: "notification",
            scope: "notification.events",
            keyId: "care-current",
            secret: serviceToken,
          }),
          "x-correlation-id": event.correlationId,
        },
        body,
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`NOTIFICATION_HTTP_${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 16 * 1024) throw new Error("NOTIFICATION_RESPONSE_TOO_LARGE");
      return ConsumerAcknowledgementSchema.parse(JSON.parse(bytes.toString("utf8")));
    });
  };
}
