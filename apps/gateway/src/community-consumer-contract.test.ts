import { describe, expect, it, vi } from "vitest";

import { buildGatewayServer } from "./server.js";
import { canonicalJson, communityRequestDigest } from "./community-routes.js";

const submission = {
  submissionReference: "submission_synthetic_0001",
  category: "daily_living_support",
  location: {
    granularity: "province_city",
    provinceCityCode: "SYN-PC-001",
  },
  dayPart: "flexible",
  disclosure: {
    purpose: "community_support",
    visibility: "current_request_collaborators",
    policyVersion: "P5-S1-v1",
    confirmed: true,
  },
} as const;

const gatewayConfig = {
  careUrl: "http://care.test",
  identityUrl: "http://identity.test",
  notificationUrl: "http://notification.test",
  communityUrl: "http://community.test",
  careToken: "care-token-synthetic-000000",
  identityToken: "identity-token-synthetic-000000",
  notificationToken: "notification-token-synthetic-000000",
  communityToken: "community-token-synthetic-000000",
  fixtureEnabled: false,
  publicOrigin: "http://app.test",
  sessionCookieName: "lb_session",
  secureCookies: false,
};

describe("P5-S1 Community Gateway consumer", () => {
  it("locks the cross-language canonical JSON and request-digest vectors", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: [3, { d: 4, c: 5 }] } })).toBe(
      '{"a":{"b":[3,{"c":5,"d":4}],"y":2},"z":1}',
    );
    expect(communityRequestDigest("POST", "/internal/v1/community/help-requests/query", {})).toBe(
      "81f1fa58d51b25cf81198059cf2c800b3b3fc30f845945b709cdccb516248115",
    );
    expect(communityRequestDigest("POST", "/internal/v1/community/help-requests", submission)).toBe(
      "8fd3a63d8d663d50de05e0e9d4c396878950b52bdfb9fcf246e9bd060d2cfa82",
    );
    expect(
      communityRequestDigest("POST", "/internal/v1/community/help-requests/reconcile", {
        submissionReference: "submission_synthetic_0001",
      }),
    ).toBe("4443b5bab164dcb20a7a091b9026960b9f15c0d26431812396f2abb70704de84");
    expect(
      communityRequestDigest(
        "POST",
        "/internal/v1/community/help-requests/request_synthetic_0001/close",
        { expectedVersion: 3 },
      ),
    ).toBe("85dabbd6a6febdbb374d092c77cf63a5d9f2dfb75917ea61a1e227225daa130d");
    expect(
      communityRequestDigest(
        "DELETE",
        "/internal/v1/community/help-requests/request_synthetic_0001",
        { expectedVersion: 3 },
      ),
    ).toBe("06b507915bbaef65b995f06fd031935ed04c521a6bd7ad343b4ce19de4fa41cc");
  });

  it("keeps public directory reads separate from Identity and protected context", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        data: directoryResult(),
        meta: { correlationId: "corr_public_directory" },
      });
    }) as unknown as typeof fetch;
    const app = buildGatewayServer(gatewayConfig, fetcher);

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/community?provinceCityCode=SYN-PC-001",
      headers: {
        cookie: "lb_session=must-not-cross",
        "x-csrf-token": "must-not-cross",
        "x-correlation-id": "corr_public_directory",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "http://community.test/internal/v1/community/directory?provinceCityCode=SYN-PC-001",
    );
    expect(calls[0]?.url).not.toContain("identity");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("x-session-token")).toBe(false);
    expect(headers.has("x-csrf-token")).toBe(false);
    expect(headers.has("x-actor-id")).toBe(false);
    expect(response.headers["cache-control"]).toContain("public");

    const cached = await app.inject({
      method: "GET",
      url: "/api/v1/community?provinceCityCode=SYN-PC-001",
      headers: { "x-correlation-id": "corr_public_directory_cached" },
    });
    expect(cached.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(cached.json()).toMatchObject({
      meta: { correlationId: "corr_public_directory_cached" },
    });
    await app.close();
  });

  it("gets a fresh exact-purpose decision then forwards only its projection", async () => {
    const calls: Array<{ url: string; body: unknown; headers: Headers }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: String(url), body, headers: new Headers(init?.headers) });
      if (String(url).endsWith("/internal/v1/community/authorize")) {
        const authorizationRequest = body as {
          permission: string;
          householdId: string;
          requestDigest: string;
        };
        return jsonResponse({
          data: {
            decisionId: `decision_${calls.length}_synthetic`,
            purpose: "community_support",
            permission: authorizationRequest.permission,
            actorRef: "actor_synthetic_0001",
            householdId: authorizationRequest.householdId,
            recipientContextId: "recipient_synthetic_0001",
            subjectVersion: 4,
            grantId: null,
            grantVersion: null,
            privacyVersion: 2,
            requestId: null,
            decidedAt: "2026-07-29T01:02:03.000Z",
            correlationId: "corr_protected_submit",
            requestDigest: authorizationRequest.requestDigest,
          },
          meta: { correlationId: "corr_protected_submit" },
        });
      }
      return jsonResponse({
        data: {
          outcome: "submitted",
          duplicate: false,
          request: requestProjection(),
          confirmedAt: "2026-07-29T01:02:03.000Z",
        },
        meta: { correlationId: "corr_protected_submit" },
      });
    }) as unknown as typeof fetch;
    const app = buildGatewayServer(gatewayConfig, fetcher);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/households/household_synthetic/community/help-requests",
      headers: {
        cookie: "lb_session=session_synthetic",
        origin: "http://app.test",
        "sec-fetch-site": "same-origin",
        "x-csrf-token": "csrf_synthetic",
        "x-correlation-id": "corr_protected_submit",
        "idempotency-key": "idem-community-synthetic-0001",
      },
      payload: submission,
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toBe("http://identity.test/internal/v1/community/authorize");
    expect(calls[0]?.body).toEqual({
      permission: "community.help_request.submit",
      householdId: "household_synthetic",
      requestDigest: "8fd3a63d8d663d50de05e0e9d4c396878950b52bdfb9fcf246e9bd060d2cfa82",
    });
    expect(calls[1]?.url).toBe("http://community.test/internal/v1/community/help-requests");
    expect(calls[1]?.body).toMatchObject({
      operation: "submit",
      request: submission,
      authorization: {
        purpose: "community_support",
        permission: "community.help_request.submit",
      },
    });
    expect(JSON.stringify(calls[1]?.body)).not.toMatch(
      /session_synthetic|csrf_synthetic|identity-token|organizer|membership/i,
    );
    expect(calls[1]?.headers.get("idempotency-key")).toBe("idem-community-synthetic-0001");
    await app.close();
  });

  it.each([
    {
      identityStatus: 404,
      identityCode: "CONSENT_RESOURCE_NOT_FOUND",
      expectedCode: "COMMUNITY_AUTHORITY_REQUIRED",
    },
    {
      identityStatus: 403,
      identityCode: "COMMUNITY_CONSENT_REVOKED",
      expectedCode: "COMMUNITY_CONSENT_REVOKED",
    },
  ])(
    "maps Identity $identityCode to stable non-enumerating P5 failure truth",
    async ({ identityStatus, identityCode, expectedCode }) => {
      const fetcher = vi.fn(async () =>
        jsonResponse(
          {
            error: {
              code: identityCode,
              messageKey: "identity.internal",
              retryable: false,
              correlationId: "corr_identity_internal",
            },
          },
          identityStatus,
        ),
      ) as unknown as typeof fetch;
      const app = buildGatewayServer(gatewayConfig, fetcher);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/households/household_synthetic/community/help-requests",
        headers: {
          cookie: "lb_session=session_synthetic",
          origin: "http://app.test",
          "sec-fetch-site": "same-origin",
          "x-csrf-token": "csrf_synthetic",
          "x-correlation-id": "corr_authority_mapping",
          "idempotency-key": "idem-community-authority-0001",
        },
        payload: submission,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: {
          code: expectedCode,
          messageKey:
            expectedCode === "COMMUNITY_CONSENT_REVOKED"
              ? "community.consent.revoked"
              : "community.authority.required",
          retryable: false,
          correlationId: "corr_authority_mapping",
        },
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await app.close();
    },
  );
});

function directoryResult() {
  return {
    items: [
      {
        listingId: "listing_synthetic_0001",
        publicName: "Synthetic community desk",
        organizationType: "community_group",
        provinceCityCode: "SYN-PC-001",
        provinceCityLabel: "Synthetic Province/City 001",
        categories: ["daily_living_support"],
        contactChannel: {
          type: "website",
          label: "Synthetic public page",
          value: "https://example.invalid/community",
        },
        accessibilityContactNote: "contact_for_accessibility_details",
        provenance: {
          sourceLabel: "Synthetic reviewed source",
          sourceUrl: "https://example.invalid/source",
          lastReviewedAt: "2026-07-20T00:00:00.000Z",
          nextReviewAt: "2026-08-20T00:00:00.000Z",
          state: "current",
        },
        availabilityState: "not_verified",
        eligibilityState: "not_determined",
        endorsementState: "none",
      },
    ],
    generatedAt: "2026-07-29T01:02:03.000Z",
    cachePolicy: "public_5m_session_24h",
    matchingState: "unavailable_in_p5_s1",
    resultMeaning: "informational_not_eligibility_availability_or_endorsement",
  };
}

function requestProjection() {
  return {
    requestId: "request_synthetic_0001",
    submissionReference: submission.submissionReference,
    category: submission.category,
    locationGranularity: "province_city",
    provinceCityCode: "SYN-PC-001",
    dayPart: "flexible",
    visibility: "current_request_collaborators",
    status: "pending",
    submissionOutcome: "confirmed",
    matchingState: "unavailable_in_p5_s1",
    retentionPolicy: "pending_30d_closed_30d_then_purge",
    version: 1,
    confirmedAt: "2026-07-29T01:02:03.000Z",
    pendingAutoCloseAt: "2026-08-28T01:02:03.000Z",
    closedAt: null,
    purgeAfter: null,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
