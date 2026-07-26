import { describe, expect, it, vi } from "vitest";

import type { HouseholdService } from "./household-service.js";
import { buildIdentityServer } from "./server.js";
import type { IdentityService } from "./service.js";

describe("identity internal HTTP boundary", () => {
  it("conceals protected routes from callers without the internal token", async () => {
    const identity = {
      isReady: vi.fn(async () => true),
      beginSignIn: vi.fn(),
    } as unknown as IdentityService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789");

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/account/sessions",
      payload: { loginName: "synthetic.user", password: "Synthetic passphrase value" },
    });

    expect(response.statusCode).toBe(404);
    expect(identity.beginSignIn).not.toHaveBeenCalled();
    expect(response.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  it("returns only a safe envelope and no-store headers for an authorized call", async () => {
    const beginSignIn = vi.fn(async () => ({
      code: "AUTHENTICATION_CONTINUE" as const,
      messageKey: "auth.continue" as const,
      challengeToken: "q".repeat(43),
    }));
    const identity = {
      isReady: vi.fn(async () => true),
      beginSignIn,
    } as unknown as IdentityService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789");

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/account/sessions",
      headers: {
        "x-internal-service-token": "internal-token-value-123456789",
        "x-correlation-id": "corr_internal_1",
        "x-rate-limit-source": "127.0.0.1",
      },
      payload: { loginName: "synthetic.user", password: "Synthetic passphrase value" },
    });

    expect(response.statusCode).toBe(202);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toEqual({
      data: {
        code: "AUTHENTICATION_CONTINUE",
        messageKey: "auth.continue",
        challengeToken: "q".repeat(43),
      },
      meta: { correlationId: "corr_internal_1" },
    });
    expect(beginSignIn).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: "127.0.0.1" }));
    await app.close();
  });

  it("binds every P2-S2 route to an authenticated account and its household service method", async () => {
    const projection = {
      householdId: "household_synthetic",
      displayLabel: "Synthetic household",
      role: "organizer" as const,
      capabilities: ["household.view"],
      version: 1,
    };
    const invitation = {
      invitationId: "invitation_synthetic",
      householdId: "household_synthetic",
      role: "member" as const,
      state: "pending" as const,
      expiresAt: "2026-08-05T02:00:00.000Z",
      version: 1,
    };
    const context = {
      recipientContextId: "recipient_synthetic",
      householdId: "household_synthetic",
      displayLabel: "Synthetic recipient",
      relationshipLabel: "Family member",
      version: 1,
    };
    const identity = {
      isReady: vi.fn(async () => true),
      requireAccountSession: vi.fn(async () => ({ accountId: "account_synthetic" })),
    } as unknown as IdentityService;
    const households = {
      createHousehold: vi.fn(async () => projection),
      getHousehold: vi.fn(async () => projection),
      createInvitation: vi.fn(async () => invitation),
      respondToInvitation: vi.fn(async () => invitation),
      resendInvitation: vi.fn(async () => invitation),
      revokeInvitation: vi.fn(async () => ({ ...invitation, state: "revoked" as const })),
      upsertRecipientContext: vi.fn(async () => context),
      getRecipientContext: vi.fn(async () => context),
    } as unknown as HouseholdService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789", households);
    const headers = {
      "x-internal-service-token": "internal-token-value-123456789",
      "x-session-token": "s".repeat(43),
      "x-csrf-token": "c".repeat(43),
      "x-correlation-id": "corr_p2_s2_routes",
      "idempotency-key": "p2-s2-route-idempotency",
    };
    const cases = [
      {
        method: "POST",
        url: "/internal/v1/households",
        payload: { displayLabel: "Synthetic household" },
        status: 201,
      },
      { method: "GET", url: "/internal/v1/households/household_synthetic", status: 200 },
      {
        method: "POST",
        url: "/internal/v1/households/household_synthetic/invitations",
        payload: { inviteeLoginName: "invitee.user", role: "member" },
        status: 201,
      },
      {
        method: "POST",
        url: "/internal/v1/invitations/accept",
        payload: { invitationToken: "t".repeat(43) },
        status: 200,
      },
      {
        method: "POST",
        url: "/internal/v1/invitations/decline",
        payload: { invitationToken: "t".repeat(43) },
        status: 200,
      },
      {
        method: "POST",
        url: "/internal/v1/households/household_synthetic/invitations/invitation_synthetic/resend",
        payload: { expectedVersion: 1 },
        status: 200,
      },
      {
        method: "POST",
        url: "/internal/v1/households/household_synthetic/invitations/invitation_synthetic/revoke",
        payload: { expectedVersion: 1 },
        status: 200,
      },
      {
        method: "PUT",
        url: "/internal/v1/households/household_synthetic/recipient-context",
        payload: {
          displayLabel: "Synthetic recipient",
          relationshipLabel: "Family member",
          expectedVersion: 0,
        },
        status: 200,
      },
      {
        method: "GET",
        url: "/internal/v1/households/household_synthetic/recipient-context",
        status: 200,
      },
    ] as const;
    for (const entry of cases) {
      const response = await app.inject({
        method: entry.method,
        url: entry.url,
        headers,
        ...("payload" in entry ? { payload: entry.payload } : {}),
      });
      expect(response.statusCode, `${entry.method} ${entry.url}`).toBe(entry.status);
      expect(response.headers["cache-control"]).toBe("no-store");
    }
    expect(identity.requireAccountSession).toHaveBeenCalledTimes(cases.length);
    expect(households.respondToInvitation).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
