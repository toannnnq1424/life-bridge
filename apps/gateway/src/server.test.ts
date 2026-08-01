import { describe, expect, it, vi } from "vitest";

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
    const app = buildGatewayServer(
      {
        ...config,
        fixtureEnabled: false,
        communityUrl: "http://community.test",
        communityToken: "community_token_value_for_testing",
      },
      fetcher,
    );

    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "not_ready", dependency: "identity" });
    await app.close();
  });

  it("keeps core readiness truthful when secondary Community and Notification are down", async () => {
    const fetcher = (async (input: string | URL | Request) =>
      new Response(null, {
        status:
          String(input).includes("community.test") || String(input).includes("notification.test")
            ? 503
            : 200,
      })) as typeof fetch;
    const app = buildGatewayServer(
      {
        ...config,
        fixtureEnabled: false,
        communityUrl: "http://community.test",
        communityToken: "community_token_value_for_testing",
      },
      fetcher,
    );
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ready",
      notification: "degraded",
      community: "degraded",
    });
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

describe("P2-S3 consent gateway boundary", () => {
  it("forwards only session, CSRF, correlation and idempotency evidence for consent", async () => {
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe(
        "http://identity.test/internal/v1/households/household_synthetic/consent/grants",
      );
      const headers = new Headers(init?.headers);
      expect(headers.get("x-session-token")).toBe("synthetic_session");
      expect(headers.get("x-csrf-token")).toBe("c".repeat(43));
      expect(headers.get("idempotency-key")).toBe("consent-grant-0001");
      expect(headers.get("x-correlation-id")).toBe("corr_consent_gateway");
      expect(headers.get("x-actor-id")).toBeNull();
      expect(headers.get("x-fixture-actor-id")).toBeNull();
      return new Response(
        JSON.stringify({
          data: {
            grantId: "grant_synthetic",
            subjectId: "subject_synthetic",
            recipientRef: "member_reference",
            recipientDisplayKey: "consent.recipient.household_member",
            purpose: "household_coordination",
            scopes: ["recipient_context.basic_label"],
            state: "active",
            effectiveAt: "2026-07-26T12:00:00.000Z",
            revokedEffectiveAt: null,
            displayTimeZone: "Asia/Bangkok",
            version: 1,
          },
          meta: { correlationId: "corr_consent_gateway" },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households/household_synthetic/consent/grants",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "idempotency-key": "consent-grant-0001",
        "x-correlation-id": "corr_consent_gateway",
        "x-fixture-actor-id": "member_lan",
        "x-actor-id": "forged_actor",
      },
      payload: {
        action: "grant",
        recipientRef: "member_reference",
        purpose: "household_coordination",
        scopes: ["recipient_context.basic_label"],
        effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
        expectedSubjectVersion: 1,
      },
    });

    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it("keeps audit GET read-only and forwards no mutation evidence", async () => {
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toContain("/internal/v1/households/household_synthetic/audit?");
      expect(String(input)).toContain("displayTimeZone=Asia%2FBangkok");
      expect(init?.method ?? "GET").toBe("GET");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-session-token")).toBe("synthetic_session");
      expect(headers.get("x-csrf-token")).toBeNull();
      expect(headers.get("idempotency-key")).toBeNull();
      expect(headers.get("x-actor-id")).toBeNull();
      return new Response(
        JSON.stringify({
          data: { items: [], nextCursor: null },
          meta: { correlationId: "corr_audit_gateway" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer(config, fetcher);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/audit?limit=20&displayTimeZone=Asia%2FBangkok",
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_audit_gateway",
        "x-fixture-actor-id": "member_lan",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().data).toEqual({ items: [], nextCursor: null });
    await app.close();
  });

  it("rejects a consent command without idempotency before calling Identity", async () => {
    let called = false;
    const fetcher = (async () => {
      called = true;
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    const app = buildGatewayServer(config, fetcher);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households/household_synthetic/consent/grants",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
      },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(called).toBe(false);
    await app.close();
  });
});

describe("P3-S1 governed coordination boundary", () => {
  it("obtains a purpose-scoped timeline decision before calling Care", async () => {
    const seen: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      seen.push({ url, headers: new Headers(init?.headers), body });
      if (url.endsWith("/internal/v1/coordination/authorize")) {
        expect(body).toMatchObject({
          permission: "coordination.timeline.read",
          householdId: "household_synthetic",
        });
        expect(body.requestDigest).toMatch(/^[a-f0-9]{64}$/);
        return jsonResponse(coordinationDecision("coordination.timeline.read", body.requestDigest));
      }
      expect(url).toBe(
        "http://care.test/internal/v1/coordination/households/household_synthetic/timeline/query",
      );
      expect(body).toMatchObject({
        query: {
          localDate: "2026-11-01",
          displayTimeZone: "America/New_York",
          filter: "all",
          limit: 2,
        },
        authorization: {
          permission: "coordination.timeline.read",
          householdId: "household_synthetic",
        },
      });
      return jsonResponse({
        localDate: "2026-11-01",
        displayTimeZone: "America/New_York",
        dayStartUtc: "2026-11-01T04:00:00.000Z",
        dayEndUtc: "2026-11-02T05:00:00.000Z",
        filter: "all",
        snapshotAt: "2026-11-01T12:00:00.000Z",
        coverageStartedAt: "2026-07-26T12:00:00.000Z",
        coverage: "complete",
        items: [],
        nextCursor: null,
      });
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/timeline?localDate=2026-11-01&displayTimeZone=America%2FNew_York&filter=all&limit=2",
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-fixture-actor-id": "forged_actor",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(seen).toHaveLength(2);
    expect(seen[0]?.headers.get("x-session-token")).toBe("synthetic_session");
    expect(seen[0]?.headers.get("x-actor-id")).toBeNull();
    expect(seen[0]?.headers.get("x-correlation-id")).toMatch(/^corr_[a-f0-9]{32}$/);
    expect(seen[1]?.headers.get("x-internal-service-token")).toBe(config.careToken);
    expect(seen[1]?.headers.get("x-actor-id")).toBe("");
    expect(seen[1]?.headers.get("x-correlation-id")).toBe(seen[0]?.headers.get("x-correlation-id"));
    await app.close();
  });

  it("binds mutation proof and one intent digest through Identity to Care", async () => {
    const calls: Array<{ url: string; headers: Headers; body: Record<string, unknown> }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, headers: new Headers(init?.headers), body });
      if (url.endsWith("/internal/v1/coordination/authorize")) {
        expect(body).toMatchObject({
          permission: "coordination.task.handoff",
          householdId: "household_synthetic",
          taskId: "task_synthetic",
          targetActorRef: "actor_ref_target",
        });
        return jsonResponse(
          coordinationDecision("coordination.task.handoff", body.requestDigest, "actor_ref_target"),
        );
      }
      expect(url).toBe(
        "http://care.test/internal/v1/coordination/households/household_synthetic/tasks/task_synthetic/handoffs",
      );
      expect(calls[0]?.headers.get("x-csrf-token")).toBe("c".repeat(43));
      expect(calls[1]?.headers.get("idempotency-key")).toBe("p3-handoff-0001");
      expect(body).toMatchObject({
        authorization: {
          target: { actorRef: "actor_ref_target" },
          requestDigest: calls[0]?.body.requestDigest,
        },
        request: {
          operation: "handoff",
          expectedTaskVersion: 3,
          expectedFromActorRef: "actor_ref_current",
          toActorRef: "actor_ref_target",
          reasonCode: "schedule_conflict",
          effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
        },
      });
      return jsonResponse({
        taskId: "task_synthetic",
        taskVersion: 4,
        currentActor: {
          actorRef: "actor_ref_target",
          displayKey: "coordination.actor.household_member",
          subject: false,
        },
        fromActor: {
          actorRef: "actor_ref_current",
          displayKey: "coordination.actor.you",
          subject: true,
        },
        reasonCode: "schedule_conflict",
        occurredAt: "2026-07-26T12:00:00.000Z",
        effectiveAt: "2026-07-26T12:00:00.000Z",
        eventRef: "timeline_event_synthetic",
        outcome: "accepted",
        notificationDelivery: "pending",
      });
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households/household_synthetic/tasks/task_synthetic/handoffs",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "idempotency-key": "p3-handoff-0001",
        "x-correlation-id": "corr_p3_handoff",
      },
      payload: {
        operation: "handoff",
        expectedTaskVersion: 3,
        expectedFromActorRef: "actor_ref_current",
        toActorRef: "actor_ref_target",
        reasonCode: "schedule_conflict",
        effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.outcome).toBe("accepted");
    expect(calls).toHaveLength(2);
    await app.close();
  });

  it("never fabricates an empty timeline when Identity or Care is unavailable", async () => {
    const identityDown = buildGatewayServer({ ...config, fixtureEnabled: false }, (async () => {
      throw new Error("identity unavailable");
    }) as typeof fetch);
    const identityResponse = await identityDown.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/timeline?localDate=2026-07-26&displayTimeZone=Asia%2FBangkok",
      headers: { cookie: "lb_session=synthetic_session" },
    });
    expect(identityResponse.statusCode).toBe(503);
    expect(identityResponse.body).not.toContain('"items":[]');
    await identityDown.close();

    const careDown = buildGatewayServer({ ...config, fixtureEnabled: false }, (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = String(input);
      if (url.endsWith("/internal/v1/coordination/authorize")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return jsonResponse(coordinationDecision("coordination.timeline.read", body.requestDigest));
      }
      throw new Error("care unavailable");
    }) as typeof fetch);
    const careResponse = await careDown.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/timeline?localDate=2026-07-26&displayTimeZone=Asia%2FBangkok",
      headers: { cookie: "lb_session=synthetic_session" },
    });
    expect(careResponse.statusCode).toBe(503);
    expect(careResponse.body).not.toContain('"items":[]');
    await careDown.close();
  });
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data, meta: { correlationId: "corr_p3_contract" } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function coordinationDecision(
  permission:
    | "coordination.timeline.read"
    | "coordination.task.handoff"
    | "coordination.care_plan.read"
    | "coordination.care_plan.draft.save"
    | "coordination.medication_reminder.read"
    | "coordination.medication_reminder.create"
    | "coordination.medication_reminder.change"
    | "coordination.medication_reminder.disable"
    | "notification.medication_reminder.read"
    | "notification.medication_reminder.acknowledge"
    | "coordination.emergency_contacts.read"
    | "coordination.emergency_contacts.replace"
    | "coordination.emergency_contacts.history.read"
    | "coordination.emergency_plan.read"
    | "coordination.emergency_plan.draft.save"
    | "coordination.emergency_plan.version.review"
    | "coordination.emergency_plan.history.read"
    | "coordination.emergency_plan.offline_snapshot.read"
    | "coordination.document_vault.list"
    | "coordination.document_vault.upload"
    | "coordination.document_vault.metadata.read"
    | "coordination.document_vault.content.download"
    | "coordination.document_vault.delete",
  requestDigest: unknown,
  targetActorRef?: string,
  documentId?: string,
) {
  return {
    decisionId: "coordination_decision_synthetic",
    permission,
    actor: {
      actorId: "account_actor_synthetic",
      actorRef: "actor_ref_current",
      displayKey: "coordination.actor.you",
      subject: true,
    },
    householdId: "household_synthetic",
    recipientContextId: "recipient_synthetic",
    ...(documentId ? { documentId } : {}),
    subjectId: "subject_synthetic",
    subjectVersion: 2,
    grantId: null,
    grantVersion: null,
    privacyVersion: null,
    target: targetActorRef
      ? {
          actorId: "account_target_synthetic",
          actorRef: targetActorRef,
          displayKey: "coordination.actor.household_member",
          subject: false,
        }
      : null,
    eligibleTargets: [
      {
        actorId: "account_target_synthetic",
        actorRef: "actor_ref_target",
        displayKey: "coordination.actor.household_member",
        subject: false,
      },
    ],
    decidedAt: "2026-07-26T12:00:00.000Z",
    correlationId: "corr_p3_contract",
    requestDigest,
  };
}

describe("P3-S3 Gateway fresh care-plan authority", () => {
  it("obtains a fresh read decision and relays only the authoritative Care response", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });
      if (url.endsWith("/internal/v1/coordination/authorize")) {
        return jsonResponse(
          coordinationDecision("coordination.care_plan.read", body.requestDigest),
        );
      }
      return jsonResponse({
        state: "no_plan",
        planId: null,
        aggregateRevision: 0,
        current: null,
        draft: null,
        eligibleResponsibilityActors: [],
        reviewState: "not_applicable",
        requiresReview: false,
        coverageStartedAt: "2026-07-27T00:00:00.000Z",
        serverTime: "2026-07-27T12:00:00.000Z",
      });
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/care-plan",
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_p3_contract",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.state).toBe("no_plan");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.body.permission).toBe("coordination.care_plan.read");
    expect(calls[1]?.body).toHaveProperty(
      "authorization.permission",
      "coordination.care_plan.read",
    );
    await app.close();
  });

  it("does not call Care when fresh Identity authority is denied", async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          error: {
            code: "COORDINATION_RESOURCE_NOT_FOUND",
            messageKey: "coordination.resource_not_found",
            retryable: false,
            correlationId: "corr_p3_contract",
          },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/care-plan",
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_p3_contract",
      },
    });
    expect(response.statusCode).toBe(404);
    expect(calls).toBe(1);
    await app.close();
  });
});

describe("P4-S1 Gateway medication reminder authority and ownership", () => {
  it("gets a fresh create decision and sends medication facts only to Care", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const headers = new Headers(init?.headers);
      calls.push({ url, body, headers });
      if (url.endsWith("/internal/v1/coordination/authorize")) {
        return jsonResponse(
          coordinationDecision("coordination.medication_reminder.create", body.requestDigest),
        );
      }
      expect(url).toBe(
        "http://care.test/internal/v1/coordination/households/household_synthetic/medication-reminders",
      );
      return jsonResponse({ reminderId: "medication_reminder_synthetic" }, 201);
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households/household_synthetic/medication-reminders",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "idempotency-key": "p4s1-create-0001",
        "x-correlation-id": "corr_p3_contract",
      },
      payload: {
        operation: "create_medication_reminder",
        medicationLabel: "Synthetic reminder A",
        amount: "1",
        unit: "tablet",
        otherUnitLabel: null,
        schedule: {
          localStart: "2026-08-03T08:00",
          sourceTimeZone: "Asia/Bangkok",
          sourceUtcOffset: "+07:00",
          ambiguousTimePolicy: null,
          recurrence: { frequency: "none" },
        },
      },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.body).toMatchObject({
      permission: "coordination.medication_reminder.create",
      householdId: "household_synthetic",
    });
    expect(calls[1]?.body).toMatchObject({
      authorization: { permission: "coordination.medication_reminder.create" },
      request: {
        medicationLabel: "Synthetic reminder A",
        amount: "1",
        unit: "tablet",
      },
    });
    expect(calls[1]?.headers.get("idempotency-key")).toBe("p4s1-create-0001");
    expect(calls.every((call) => !call.url.startsWith("http://notification.test"))).toBe(true);
    await app.close();
  });

  it("binds acknowledgement to the exact occurrence and sends no medication facts to Notification", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      calls.push({ url, body });
      if (url.endsWith("/internal/v1/coordination/authorize")) {
        expect(body).toMatchObject({
          permission: "notification.medication_reminder.acknowledge",
          householdId: "household_synthetic",
          medicationOccurrenceId: "occurrence_synthetic",
        });
        return jsonResponse(
          coordinationDecision("notification.medication_reminder.acknowledge", body.requestDigest),
        );
      }
      expect(url).toBe(
        "http://notification.test/internal/v1/medication-reminders/households/household_synthetic/occurrences/occurrence_synthetic/acknowledgements",
      );
      return jsonResponse({
        result: "recorded",
        notification: { occurrenceId: "occurrence_synthetic" },
      });
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/notifications/medication-reminders/occurrence_synthetic/acknowledgements?householdId=household_synthetic",
      headers: {
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "idempotency-key": "p4s1-ack-0001",
        "x-correlation-id": "corr_p3_contract",
      },
      payload: {
        operation: "acknowledge_medication_reminder",
        expectedVersion: 2,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.body).toMatchObject({
      authorization: {
        permission: "notification.medication_reminder.acknowledge",
      },
      request: {
        operation: "acknowledge_medication_reminder",
        expectedVersion: 2,
      },
    });
    expect(JSON.stringify(calls[1]?.body)).not.toMatch(
      /medicationLabel|amount|unit|taken|skipped|adherence/i,
    );
    await app.close();
  });

  it("does not call an owner service when a fresh medication decision is denied", async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          error: {
            code: "COORDINATION_RESOURCE_NOT_FOUND",
            messageKey: "coordination.resource_not_found",
            retryable: false,
            correlationId: "corr_p3_contract",
          },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/medication-reminders",
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_p3_contract",
      },
    });
    expect(response.statusCode).toBe(404);
    expect(calls).toBe(1);
    expect(response.body).not.toContain('"items":[]');
    await app.close();
  });
});

describe("P4-S2 Gateway exact-purpose emergency authority", () => {
  const routes = [
    {
      method: "GET" as const,
      url: "/api/v1/households/household_synthetic/emergency-contacts",
      permission: "coordination.emergency_contacts.read" as const,
    },
    {
      method: "PUT" as const,
      url: "/api/v1/households/household_synthetic/emergency-contacts",
      permission: "coordination.emergency_contacts.replace" as const,
      payload: {
        operation: "replace_emergency_contacts",
        expectedListRevision: 0,
        contacts: [{ displayLabel: "Synthetic contact A", dialString: "+66000000001" }],
      },
    },
    {
      method: "GET" as const,
      url: "/api/v1/households/household_synthetic/emergency-contacts/history?limit=10",
      permission: "coordination.emergency_contacts.history.read" as const,
    },
    {
      method: "GET" as const,
      url: "/api/v1/households/household_synthetic/emergency-plan",
      permission: "coordination.emergency_plan.read" as const,
    },
    {
      method: "PUT" as const,
      url: "/api/v1/households/household_synthetic/emergency-plan/draft",
      permission: "coordination.emergency_plan.draft.save" as const,
      payload: {
        operation: "save_emergency_plan_draft",
        expectedAggregateRevision: 1,
        expectedDraftRevision: 0,
        basePlanVersion: 0,
        contactListRevision: 1,
        steps: ["Synthetic step"],
      },
    },
    {
      method: "POST" as const,
      url: "/api/v1/households/household_synthetic/emergency-plan/reviews",
      permission: "coordination.emergency_plan.version.review" as const,
      payload: {
        operation: "review_emergency_plan_version",
        expectedAggregateRevision: 2,
        expectedDraftRevision: 1,
        basePlanVersion: 0,
        contactListRevision: 1,
        displayTimeZone: "Asia/Bangkok",
      },
    },
    {
      method: "GET" as const,
      url: "/api/v1/households/household_synthetic/emergency-plan/history?limit=10",
      permission: "coordination.emergency_plan.history.read" as const,
    },
    {
      method: "GET" as const,
      url: "/api/v1/households/household_synthetic/emergency-plan/offline-snapshot",
      permission: "coordination.emergency_plan.offline_snapshot.read" as const,
    },
  ];

  it.each(routes)(
    "gets fresh $permission authority and forwards only to Care",
    async ({ method, url, permission, payload }) => {
      const calls: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = [];
      const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
        const target = String(input);
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        calls.push({ url: target, body, headers: new Headers(init?.headers) });
        if (target.endsWith("/internal/v1/coordination/authorize")) {
          expect(body).toMatchObject({ permission, householdId: "household_synthetic" });
          return jsonResponse(coordinationDecision(permission, body.requestDigest));
        }
        expect(target.startsWith("http://care.test/internal/v1/coordination/")).toBe(true);
        return jsonResponse({ outcome: "synthetic_authoritative_response" });
      }) as typeof fetch;
      const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
      const response = await app.inject({
        method,
        url,
        headers: {
          cookie: "lb_session=synthetic_session",
          origin: config.publicOrigin,
          "sec-fetch-site": "same-origin",
          "x-csrf-token": "c".repeat(43),
          "idempotency-key": `p4s2-${method.toLowerCase()}-0001`,
          "x-correlation-id": "corr_p3_contract",
        },
        ...(payload ? { payload } : {}),
      });

      expect(response.statusCode).toBe(200);
      expect(calls).toHaveLength(2);
      expect(calls[1]?.body).toHaveProperty("authorization.permission", permission);
      if (payload) {
        expect(calls[1]?.body.request).toEqual(payload);
        expect(calls[1]?.headers.get("idempotency-key")).toContain("p4s2-");
      }
      expect(calls.every((call) => !call.url.startsWith("http://notification.test"))).toBe(true);
      await app.close();
    },
  );

  it("makes a denied snapshot indistinguishable and performs zero Care calls", async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          error: {
            code: "COORDINATION_RESOURCE_NOT_FOUND",
            messageKey: "coordination.resource_not_found",
            retryable: false,
            correlationId: "corr_p3_contract",
          },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/emergency-plan/offline-snapshot",
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_p3_contract",
      },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("COORDINATION_RESOURCE_NOT_FOUND");
    expect(calls).toBe(1);
    expect(response.body).not.toMatch(/planVersion|contacts|steps|permission/i);
    await app.close();
  });
});

describe("P4-S3 Gateway exact-purpose document authority", () => {
  const documentId = "document_synthetic";
  const upload = {
    uploadReference: "upload_reference_synthetic",
    fileName: "synthetic-note.txt",
    declaredType: "text/plain",
    decodedSizeBytes: 5,
    contentBase64: "aGVsbG8=",
  };
  const deletion = {
    expectedVaultVersion: 2,
    expectedDocumentVersion: 1,
  };
  const routes = [
    {
      method: "GET" as const,
      url: "/api/v1/households/household_synthetic/documents",
      permission: "coordination.document_vault.list" as const,
    },
    {
      method: "POST" as const,
      url: "/api/v1/households/household_synthetic/documents",
      permission: "coordination.document_vault.upload" as const,
      payload: upload,
    },
    {
      method: "GET" as const,
      url: `/api/v1/households/household_synthetic/documents/${documentId}`,
      permission: "coordination.document_vault.metadata.read" as const,
      documentId,
    },
    {
      method: "DELETE" as const,
      url: `/api/v1/households/household_synthetic/documents/${documentId}`,
      permission: "coordination.document_vault.delete" as const,
      documentId,
      payload: deletion,
    },
  ];

  it.each(routes)(
    "binds $permission and relays exactly one owner request",
    async ({ method, url, permission, payload, documentId: scopedDocumentId }) => {
      const calls: Array<{ url: string; body: Record<string, unknown>; headers: Headers }> = [];
      const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
        const target = String(input);
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        calls.push({ url: target, body, headers: new Headers(init?.headers) });
        if (target.endsWith("/internal/v1/coordination/authorize")) {
          expect(body).toMatchObject({
            permission,
            householdId: "household_synthetic",
            ...(scopedDocumentId ? { documentId: scopedDocumentId } : {}),
          });
          if (!scopedDocumentId) expect(body.documentId).toBeUndefined();
          return jsonResponse(
            coordinationDecision(permission, body.requestDigest, undefined, scopedDocumentId),
          );
        }
        expect(target.startsWith("http://care.test/internal/v1/coordination/")).toBe(true);
        return jsonResponse({ outcome: "synthetic_document_response" });
      }) as typeof fetch;
      const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
      const response = await app.inject({
        method,
        url,
        headers: {
          cookie: "lb_session=synthetic_session",
          origin: config.publicOrigin,
          "sec-fetch-site": "same-origin",
          "x-csrf-token": "c".repeat(43),
          "idempotency-key": `p4s3-${method.toLowerCase()}-0001`,
          "x-correlation-id": "corr_p3_contract",
        },
        ...(payload ? { payload } : {}),
      });

      expect(response.statusCode).toBe(200);
      expect(calls).toHaveLength(2);
      expect(calls[1]?.body).toHaveProperty("authorization.permission", permission);
      if (payload) expect(calls[1]?.body.request).toEqual(payload);
      expect(calls.every((call) => !call.url.startsWith("http://notification.test"))).toBe(true);
      await app.close();
    },
  );

  it("relays only an attachment response for a freshly bound content decision", async () => {
    let calls = 0;
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      const target = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (target.endsWith("/internal/v1/coordination/authorize")) {
        return jsonResponse(
          coordinationDecision(
            "coordination.document_vault.content.download",
            body.requestDigest,
            undefined,
            documentId,
          ),
        );
      }
      return new Response(Buffer.from("hello"), {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition":
            "attachment; filename=\"document.txt\"; filename*=UTF-8''synthetic-note.txt",
          "x-content-type-options": "nosniff",
          "content-security-policy": "sandbox",
          "content-length": "5",
        },
      });
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/households/household_synthetic/documents/${documentId}/content`,
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_p3_contract",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(calls).toBe(2);
    expect(response.headers["content-type"]).toContain("application/octet-stream");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["content-security-policy"]).toBe("sandbox");
    expect(response.body).toBe("hello");
    await app.close();
  });

  it("stops after a generic denied decision without calling Care", async () => {
    let calls = 0;
    const fetcher = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          error: {
            code: "COORDINATION_RESOURCE_NOT_FOUND",
            messageKey: "coordination.resource_not_found",
            retryable: false,
            correlationId: "corr_p3_contract",
          },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/households/household_synthetic/documents/${documentId}/content`,
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_p3_contract",
      },
    });
    expect(response.statusCode).toBe(404);
    expect(calls).toBe(1);
    expect(response.body).not.toMatch(/synthetic-note|content|documentId/);
    await app.close();
  });

  it("reports an unreachable document owner as storage unavailable, never empty", async () => {
    let calls = 0;
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      calls += 1;
      const target = String(input);
      if (target.endsWith("/internal/v1/coordination/authorize")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
        return jsonResponse(
          coordinationDecision("coordination.document_vault.list", body.requestDigest),
        );
      }
      throw new Error("synthetic owner outage");
    }) as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/households/household_synthetic/documents",
      headers: {
        cookie: "lb_session=synthetic_session",
        "x-correlation-id": "corr_p3_contract",
      },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("DOCUMENT_STORAGE_UNAVAILABLE");
    expect(response.body).not.toMatch(/documents|synthetic owner outage/i);
    expect(calls).toBe(2);
    await app.close();
  });

  it("rejects an over-limit document body before authority or owner calls", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    const app = buildGatewayServer({ ...config, fixtureEnabled: false }, fetcher);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households/household_synthetic/documents",
      headers: {
        "content-type": "application/json",
        cookie: "lb_session=synthetic_session",
        origin: config.publicOrigin,
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "c".repeat(43),
        "idempotency-key": "p4s3-body-limit-key",
        "x-correlation-id": "corr_p3_contract",
      },
      payload: {
        contentBase64: "A".repeat(530_000),
      },
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe("DOCUMENT_TOO_LARGE");
    expect(fetcher).not.toHaveBeenCalled();
    await app.close();
  });
});
