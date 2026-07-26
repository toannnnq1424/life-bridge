import { describe, expect, it } from "vitest";

import { buildGatewayServer } from "./server.js";

const config = {
  careUrl: "http://care.test",
  identityUrl: "http://identity.test",
  notificationUrl: "http://notification.test",
  careToken: "care_token_value_for_testing",
  identityToken: "identity_token_value_for_testing",
  notificationToken: "notification_token_testing",
  fixtureEnabled: true,
  publicOrigin: "http://127.0.0.1:3000",
  sessionCookieName: "lb_session",
  secureCookies: false,
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

describe("P2-S2 household gateway boundary", () => {
  it("forwards only cookie session, CSRF and idempotency evidence to Identity", async () => {
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://identity.test/internal/v1/households");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-session-token")).toBe("synthetic_session");
      expect(headers.get("x-csrf-token")).toBe("c".repeat(43));
      expect(headers.get("idempotency-key")).toBe("household-create-0001");
      expect(headers.get("x-actor-id")).toBeNull();
      return new Response(
        JSON.stringify({
          data: {
            householdId: "household_synthetic",
            displayLabel: "Synthetic household",
            role: "organizer",
            capabilities: ["household.view"],
            version: 1,
          },
          meta: { correlationId: "corr_household_gateway" },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "idempotency-key": "household-create-0001",
        "x-fixture-actor-id": "member_lan",
        "x-correlation-id": "corr_household_gateway",
      },
      payload: { displayLabel: "Synthetic household" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.role).toBe("organizer");
    await app.close();
  });

  it("rejects cross-site household mutation before calling Identity", async () => {
    let called = false;
    const app = buildGatewayServer(config, (async () => {
      called = true;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: "https://attacker.invalid",
        "sec-fetch-site": "cross-site",
        "x-csrf-token": "c".repeat(43),
        "idempotency-key": "household-create-0002",
      },
      payload: { displayLabel: "Synthetic household" },
    });
    expect(response.statusCode).toBe(403);
    expect(called).toBe(false);
    await app.close();
  });

  it("forwards the complete P2-S2 route surface without actor or token leakage", async () => {
    const seen: Array<{ url: string; headers: Headers; body: string | null }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push({
        url: String(input),
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? init.body : null,
      });
      return new Response(
        JSON.stringify({ data: { state: "pending" }, meta: { correlationId: "corr_surface" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);
    const mutationHeaders = {
      cookie: "lb_session=synthetic_session",
      origin: config.publicOrigin,
      "sec-fetch-site": "same-origin",
      "x-csrf-token": "c".repeat(43),
      "x-correlation-id": "corr_surface",
    };
    const cases = [
      {
        method: "GET",
        url: "/api/v1/households/household_synthetic",
      },
      {
        method: "POST",
        url: "/api/v1/households/household_synthetic/invitations",
        headers: { ...mutationHeaders, "idempotency-key": "invite-surface-0001" },
        payload: { inviteeLoginName: "synthetic.user", role: "member" },
      },
      {
        method: "POST",
        url: "/api/v1/invitations/accept",
        headers: mutationHeaders,
        payload: { invitationToken: "t".repeat(43) },
      },
      {
        method: "POST",
        url: "/api/v1/invitations/decline",
        headers: mutationHeaders,
        payload: { invitationToken: "t".repeat(43) },
      },
      {
        method: "POST",
        url: "/api/v1/households/household_synthetic/invitations/invitation_synthetic/resend",
        headers: mutationHeaders,
        payload: { expectedVersion: 1 },
      },
      {
        method: "POST",
        url: "/api/v1/households/household_synthetic/invitations/invitation_synthetic/revoke",
        headers: mutationHeaders,
        payload: { expectedVersion: 1 },
      },
      {
        method: "GET",
        url: "/api/v1/households/household_synthetic/recipient-context",
      },
      {
        method: "PUT",
        url: "/api/v1/households/household_synthetic/recipient-context",
        headers: mutationHeaders,
        payload: {
          displayLabel: "Synthetic recipient",
          relationshipLabel: "Family member",
          expectedVersion: 0,
        },
      },
    ] as const;
    for (const entry of cases) {
      const response = await app.inject({
        method: entry.method,
        url: entry.url,
        headers: {
          cookie: "lb_session=synthetic_session",
          "x-correlation-id": "corr_surface",
          ...("headers" in entry ? entry.headers : {}),
        },
        ...("payload" in entry ? { payload: entry.payload } : {}),
      });
      expect(response.statusCode, `${entry.method} ${entry.url}`).toBe(200);
    }
    expect(seen).toHaveLength(cases.length);
    for (const forwarded of seen) {
      expect(forwarded.headers.get("x-session-token")).toBe("synthetic_session");
      expect(forwarded.headers.get("x-actor-id")).toBeNull();
      expect(forwarded.headers.get("x-fixture-actor-id")).toBeNull();
    }
    expect(JSON.stringify(seen)).not.toContain("lb_session");
    await app.close();
  });
});

describe("gateway identity boundary", () => {
  it("keeps the safe P1 fixture runtime ready without an Identity process", async () => {
    const seen: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      seen.push(String(input));
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: true }, fetcher);

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(200);
    expect(seen).not.toContain("http://identity.test/health/ready");
    await app.close();
  });

  it("fails readiness truthfully when required Identity is unavailable", async () => {
    const fetcher = (async (input: string | URL | Request) =>
      new Response(null, {
        status: String(input).includes("identity.test") ? 503 : 200,
      })) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "not_ready", dependency: "identity" });
    await app.close();
  });

  it("sets an HttpOnly Strict cookie and removes the raw session token", async () => {
    const rawToken = "s".repeat(43);
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe("http://identity.test/internal/v1/account/sessions/factor");
      expect(new Headers(init?.headers).get("x-internal-service-token")).toBe(config.identityToken);
      return new Response(
        JSON.stringify({
          data: {
            sessionToken: rawToken,
            projection: { accountId: "account_synthetic", csrfToken: "c".repeat(43) },
          },
          meta: { correlationId: "corr_identity_1" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/account/sessions/factor",
      headers: { "x-correlation-id": "corr_identity_1" },
      payload: { challengeToken: "q".repeat(43), code: "123456" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(rawToken);
    expect(response.headers["set-cookie"]).toContain("lb_session=");
    expect(response.headers["set-cookie"]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]).toContain("SameSite=Strict");
    await app.close();
  });

  it("rejects a cookie-authenticated mutation with no trusted browser origin", async () => {
    let dependencyCalled = false;
    const fetcher = (async () => {
      dependencyCalled = true;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/preferences",
      headers: {
        cookie: "lb_session=synthetic",
        "x-csrf-token": "c".repeat(43),
      },
      payload: {
        locale: "en",
        textScale: "large",
        contrast: "more",
        motion: "reduce",
        expectedVersion: 1,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("ORIGIN_REJECTED");
    expect(dependencyCalled).toBe(false);
    await app.close();
  });

  it("forwards cookie and CSRF only on an exact-origin mutation", async () => {
    const fetcher = (async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-session-token")).toBe("synthetic_session");
      expect(headers.get("x-csrf-token")).toBe("c".repeat(43));
      return new Response(
        JSON.stringify({
          data: { preferences: { version: 2 } },
          meta: { correlationId: "corr_identity_2" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/account/preferences",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "x-correlation-id": "corr_identity_2",
      },
      payload: {
        locale: "en",
        textScale: "large",
        contrast: "more",
        motion: "reduce",
        expectedVersion: 1,
      },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("makes public logout idempotent and always expires the cookie", async () => {
    const fetcher = (async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "SESSION_EXPIRED",
            messageKey: "session.expired",
            retryable: false,
            correlationId: "corr_logout_1",
          },
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      )) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/account/session/logout",
      headers: {
        cookie: "lb_session=already_expired",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "x-correlation-id": "corr_logout_1",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ revoked: true });
    expect(response.headers["set-cookie"]).toContain("lb_session=;");
    await app.close();
  });

  it("ignores a forged P1 fixture actor whenever fixture mode is disabled", async () => {
    const protectedConfig = { ...config, fixtureEnabled: false };
    const fetcher = (async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("x-actor-id")).toBe("");
      return new Response(
        JSON.stringify({ error: { code: "FORBIDDEN", correlationId: "corr_actor_1" } }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer(protectedConfig, fetcher);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/hh_minh_an/tasks",
      headers: { "x-fixture-actor-id": "member_lan" },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
