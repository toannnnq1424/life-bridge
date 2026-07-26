import type { CareTaskCompletedEvent, ConsumerAcknowledgement } from "@lifebridge/contracts";
import { ConsumerAcknowledgementSchema } from "@lifebridge/contracts";
import { boundedErrorCode, SafeLogger } from "@lifebridge/observability";

import type { CareService } from "./service.js";

export type EventDeliverer = (event: CareTaskCompletedEvent) => Promise<ConsumerAcknowledgement>;

export class OutboxDispatcher {
  private readonly logger: SafeLogger;

  public constructor(
    private readonly care: CareService,
    private readonly deliver: EventDeliverer,
    private readonly maxAttempts = 3,
    logger?: SafeLogger,
  ) {
    this.logger = logger ?? new SafeLogger("care-coordination");
  }

  public async dispatchOnce(): Promise<"idle" | "delivered" | "failed"> {
    const claimed = await this.care.claimOutbox();
    if (!claimed) {
      return "idle";
    }

    try {
      const acknowledgement = ConsumerAcknowledgementSchema.parse(
        await this.deliver(claimed.event),
      );
      if (acknowledgement.eventId !== claimed.event.eventId) {
        throw new Error("ACK_EVENT_MISMATCH");
      }
      await this.care.markOutboxAcknowledged(claimed.event.eventId, acknowledgement.result);
      this.logger.emit({
        level: "info",
        eventName:
          acknowledgement.result === "suppressed_self"
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
      const errorCode = boundedErrorCode(
        error instanceof Error ? error.message : undefined,
        "NOTIFICATION_DELIVERY_FAILED",
      );
      await this.care.markOutboxFailed(
        claimed.event.eventId,
        errorCode,
        claimed.attemptCount,
        this.maxAttempts,
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
      });
      return "failed";
    }
  }
}

export function httpEventDeliverer(notificationUrl: string, serviceToken: string): EventDeliverer {
  return async (event) => {
    const response = await fetch(`${notificationUrl}/internal/v1/events/care-task-completed`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service-token": serviceToken,
        "x-correlation-id": event.correlationId,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) {
      throw new Error(`NOTIFICATION_HTTP_${response.status}`);
    }
    const body: unknown = await response.json();
    return ConsumerAcknowledgementSchema.parse(body);
  };
}
