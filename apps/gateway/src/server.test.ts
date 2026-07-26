import { describe, expect, it } from "vitest";

import { buildGatewayServer } from "./server.js";

const config = {
  careUrl: "http://care.test",
  notificationUrl: "http://notification.test",
  careToken: "care_token_value_for_testing",
  notificationToken: "notification_token_testing",
  fixtureEnabled: true,
};

describe("gateway dashboard degradation", () => {
  it("keeps confirmed task data when Notification is unavailable", async () => {
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("care.test")) {
        return new Response(
          JSON.stringify({
            data: {
              openCount: 1,
              completedCount: 0,
              nextTasks: [],
              lastConfirmedAt: "2026-08-03T02:05:00.000Z",
              taskSourceFreshness: "current",
            },
            meta: { correlationId: "corr_gateway_1" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error("notification unavailable");
    }) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/hh_minh_an/dashboard",
      headers: {
        "x-fixture-actor-id": "member_lan",
        "x-correlation-id": "corr_gateway_1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      openCount: 1,
      notificationDependency: "degraded",
      notifications: null,
    });
    await app.close();
  });

  it("does not fabricate an empty notification collection", async () => {
    const fetcher = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: { "x-fixture-actor-id": "member_lan" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("NOTIFICATION_UNAVAILABLE");
    await app.close();
  });

  it("fails a mutation without an idempotency key before calling Care", async () => {
    let dependencyCalled = false;
    const fetcher = (async () => {
      dependencyCalled = true;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households/hh_minh_an/tasks",
      headers: { "x-fixture-actor-id": "member_lan" },
      payload: {
        title: "Synthetic task",
        description: "",
        assigneeId: "member_minh",
        careRecipientId: "person_an",
        dueAt: "2026-08-04T02:30:00.000Z",
        dueTimeZone: "Asia/Bangkok",
        priority: "normal",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(dependencyCalled).toBe(false);
    await app.close();
  });
});
