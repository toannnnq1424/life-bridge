import { createServiceAssertion } from "@lifebridge/config";
import { describe, expect, it, vi } from "vitest";

import { buildNotificationServer } from "./server.js";
import type { NotificationService } from "./service.js";

describe("P6-S3 Notification service identity", () => {
  it("permits only Care event scope with the independent Care key", async () => {
    const consume = vi.fn(async (body: unknown) => body);
    const service = {
      isReady: vi.fn(async () => true),
      consume,
    } as unknown as NotificationService;
    const gatewayKey = "synthetic-notification-gateway-key-001";
    const careKey = "synthetic-notification-care-key-00001";
    const app = buildNotificationServer(service, gatewayKey, undefined, true, careKey);
    const event = {
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
    const assertion = (caller: string, scope: string, secret: string, keyId: string) =>
      createServiceAssertion({
        caller,
        audience: "notification",
        scope,
        keyId,
        secret,
        nonce: "synthetic_nonce_0001",
      });
    for (const identity of [
      undefined,
      assertion("gateway", "notification.read", gatewayKey, "gateway-current"),
      assertion("care-coordination", "notification.events", gatewayKey, "care-current"),
    ]) {
      const denied = await app.inject({
        method: "POST",
        url: "/internal/v1/events/care-task-completed",
        headers: identity ? { "x-lifebridge-service-identity": identity } : {},
        payload: event,
      });
      expect(denied.statusCode).toBe(404);
    }
    const accepted = await app.inject({
      method: "POST",
      url: "/internal/v1/events/care-task-completed",
      headers: {
        "x-lifebridge-service-identity": assertion(
          "care-coordination",
          "notification.events",
          careKey,
          "care-current",
        ),
      },
      payload: event,
    });
    expect(accepted.statusCode).toBe(200);
    expect(consume).toHaveBeenCalledTimes(1);
    await app.close();
  });
});
