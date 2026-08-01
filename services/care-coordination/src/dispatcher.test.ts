import { describe, expect, it, vi } from "vitest";

import type { CareTaskCompletedEvent } from "@lifebridge/contracts";

import { OutboxDispatcher } from "./dispatcher.js";
import type { CareService } from "./service.js";

const event: CareTaskCompletedEvent = {
  eventId: "evt_complete_1",
  eventType: "care.task.completed.v1",
  eventVersion: 1,
  occurredAt: "2026-08-03T02:05:00.000Z",
  producer: "care-coordination",
  aggregateId: "task_demo_1",
  aggregateVersion: 2,
  correlationId: "corr_demo_123",
  causationId: "cmd_demo_123",
  payload: {
    householdId: "hh_minh_an",
    notificationDisposition: "deliver",
    recipientId: "member_lan",
    completedBy: "member_minh",
    completedAt: "2026-08-03T02:05:00.000Z",
  },
};

describe("outbox dispatcher", () => {
  it("acknowledges a durable consumer result", async () => {
    const care = {
      claimOutbox: vi.fn().mockResolvedValue({ event, attemptCount: 1 }),
      markOutboxAcknowledged: vi.fn().mockResolvedValue(undefined),
      markOutboxFailed: vi.fn(),
    };
    const dispatcher = new OutboxDispatcher(care as unknown as CareService, async () => ({
      eventId: event.eventId,
      result: "stored",
      notificationId: "notification_demo_1",
      processedAt: "2026-08-03T02:05:01.000Z",
    }));

    await expect(dispatcher.dispatchOnce()).resolves.toBe("delivered");
    expect(care.markOutboxAcknowledged).toHaveBeenCalledWith(event.eventId, "stored");
    expect(care.markOutboxFailed).not.toHaveBeenCalled();
  });

  it("records bounded failure without rolling back task completion", async () => {
    const care = {
      claimOutbox: vi.fn().mockResolvedValue({ event, attemptCount: 3 }),
      markOutboxAcknowledged: vi.fn(),
      markOutboxFailed: vi.fn().mockResolvedValue(undefined),
    };
    const delay = vi.fn(async () => undefined);
    const dispatcher = new OutboxDispatcher(
      care as unknown as CareService,
      async () => {
        throw new Error("NOTIFICATION_HTTP_503");
      },
      3,
      undefined,
      delay,
    );

    await expect(dispatcher.dispatchOnce()).resolves.toBe("failed");
    expect(care.markOutboxFailed).toHaveBeenCalledWith(
      event.eventId,
      "NOTIFICATION_HTTP_503",
      3,
      3,
    );
    expect(delay).toHaveBeenCalledWith(500);
  });

  it("terminalizes permanent dependency rejection without blind retry", async () => {
    const care = {
      claimOutbox: vi.fn().mockResolvedValue({ event, attemptCount: 1 }),
      markOutboxAcknowledged: vi.fn(),
      markOutboxFailed: vi.fn().mockResolvedValue(undefined),
    };
    const dispatcher = new OutboxDispatcher(care as unknown as CareService, async () => {
      throw new Error("NOTIFICATION_HTTP_403");
    });
    await expect(dispatcher.dispatchOnce()).resolves.toBe("failed");
    expect(care.markOutboxFailed).toHaveBeenCalledWith(
      event.eventId,
      "NOTIFICATION_HTTP_403",
      1,
      1,
    );
  });
});
