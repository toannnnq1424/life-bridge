import { describe, expect, it, vi } from "vitest";

import type { ConsentService } from "./consent-service.js";
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

describe("P2-S3 consent internal HTTP boundary", () => {
  it("binds grant and read-only audit routes to the authenticated account", async () => {
    const identity = {
      isReady: vi.fn(async () => true),
      requireAccountSession: vi.fn(async () => ({ accountId: "account_synthetic" })),
    } as unknown as IdentityService;
    const grant = {
      grantId: "grant_synthetic",
      subjectId: "subject_synthetic",
      recipientRef: "member_reference",
      recipientDisplayKey: "consent.recipient.household_member" as const,
      purpose: "household_coordination" as const,
      scopes: ["recipient_context.basic_label" as const],
      state: "active" as const,
      effectiveAt: "2026-07-26T12:00:00.000Z",
      revokedEffectiveAt: null,
      displayTimeZone: "Asia/Bangkok",
      version: 1,
    };
    const consent = {
      grant: vi.fn(async () => grant),
      auditHistory: vi.fn(async () => ({ items: [], nextCursor: null })),
    } as unknown as ConsentService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789", undefined, consent);
    const headers = {
      "x-internal-service-token": "internal-token-value-123456789",
      "x-session-token": "s".repeat(43),
      "x-csrf-token": "c".repeat(43),
      "x-correlation-id": "corr_p2_s3_routes",
      "idempotency-key": "consent-grant-route-0001",
    };

    const grantResponse = await app.inject({
      method: "POST",
      url: "/internal/v1/households/household_synthetic/consent/grants",
      headers,
      payload: {
        action: "grant",
        recipientRef: "member_reference",
        purpose: "household_coordination",
        scopes: ["recipient_context.basic_label"],
        effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
        expectedSubjectVersion: 1,
      },
    });
    const auditResponse = await app.inject({
      method: "GET",
      url: "/internal/v1/households/household_synthetic/audit?limit=20&displayTimeZone=Asia%2FBangkok",
      headers: {
        "x-internal-service-token": headers["x-internal-service-token"],
        "x-session-token": headers["x-session-token"],
        "x-correlation-id": headers["x-correlation-id"],
      },
    });

    expect(grantResponse.statusCode).toBe(201);
    expect(grantResponse.headers["cache-control"]).toBe("no-store");
    expect(consent.grant).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "account_synthetic",
        householdId: "household_synthetic",
        idempotencyKey: "consent-grant-route-0001",
      }),
    );
    expect(auditResponse.statusCode).toBe(200);
    expect(consent.auditHistory).toHaveBeenCalledTimes(1);
    expect(consent.grant).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it("returns a consent validation error instead of an authentication error", async () => {
    const identity = {
      isReady: vi.fn(async () => true),
      requireAccountSession: vi.fn(async () => ({ accountId: "account_synthetic" })),
    } as unknown as IdentityService;
    const consent = { grant: vi.fn() } as unknown as ConsentService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789", undefined, consent);
    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/households/household_synthetic/consent/grants",
      headers: {
        "x-internal-service-token": "internal-token-value-123456789",
        "x-session-token": "s".repeat(43),
        "x-csrf-token": "c".repeat(43),
        "x-correlation-id": "corr_p2_s3_invalid",
        "idempotency-key": "consent-grant-route-0002",
      },
      payload: {
        action: "grant",
        scopes: [],
        effectiveTime: { mode: "immediate", displayTimeZone: "ICT" },
        expectedSubjectVersion: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("CONSENT_VALIDATION_FAILED");
    expect(consent.grant).not.toHaveBeenCalled();

    const governedResponse = await app.inject({
      method: "GET",
      url: "/internal/v1/households/household_synthetic/recipient-context/scopes/not-a-scope",
      headers: {
        "x-internal-service-token": "internal-token-value-123456789",
        "x-session-token": "s".repeat(43),
        "x-correlation-id": "corr_p2_s3_invalid_scope",
      },
    });
    expect(governedResponse.statusCode).toBe(400);
    expect(governedResponse.json().error.code).toBe("CONSENT_VALIDATION_FAILED");

    const documentScopeResponse = await app.inject({
      method: "GET",
      url: "/internal/v1/households/household_synthetic/recipient-context/scopes/document_vault.access",
      headers: {
        "x-internal-service-token": "internal-token-value-123456789",
        "x-session-token": "s".repeat(43),
        "x-correlation-id": "corr_p4_s3_non_disclosure_scope",
      },
    });
    expect(documentScopeResponse.statusCode).toBe(400);
    expect(documentScopeResponse.json().error.code).toBe("CONSENT_VALIDATION_FAILED");
    expect(consent.grant).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("P5-S2 match authority boundary", () => {
  it("requires mutation session proof and returns only the fresh exact decision", async () => {
    const decision = {
      decisionId: "decision_match_synthetic",
      purpose: "community_match_coordination" as const,
      permission: "community_match.volunteer.respond" as const,
      actorRef: "actor_match_synthetic",
      recipientContextId: "recipient_match_synthetic",
      subjectVersion: 2,
      grantId: "grant_match_synthetic",
      grantVersion: 1,
      privacyVersion: 1,
      decidedAt: "2026-07-29T00:00:00.000Z",
      expiresAt: "2026-07-29T00:00:10.000Z",
      correlationId: "corr_match_authority",
      requestDigest: "a".repeat(64),
    };
    const identity = {
      isReady: vi.fn(async () => true),
      requireAccountSession: vi.fn(async () => ({ accountId: "account_synthetic" })),
    } as unknown as IdentityService;
    const consent = {
      authorizeCommunityMatch: vi.fn(async () => decision),
    } as unknown as ConsentService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789", undefined, consent);
    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/community/matches/authorize",
      headers: {
        "x-internal-service-token": "internal-token-value-123456789",
        "x-session-token": "s".repeat(43),
        "x-csrf-token": "c".repeat(43),
        "x-correlation-id": "corr_match_authority",
      },
      payload: {
        permission: "community_match.volunteer.respond",
        householdId: "household_synthetic",
        requestDigest: "a".repeat(64),
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json().data).toEqual(decision);
    expect(identity.requireAccountSession).toHaveBeenCalledWith("s".repeat(43), "c".repeat(43));
    expect(consent.authorizeCommunityMatch).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "account_synthetic" }),
    );
    await app.close();
  });
});

describe("P3-S1 coordination authority HTTP boundary", () => {
  it("requires a fresh session and mutation proof only for a selected handoff target", async () => {
    const requireAccountSession = vi.fn(async () => ({ accountId: "account_synthetic" }));
    const identity = {
      isReady: vi.fn(async () => true),
      requireAccountSession,
    } as unknown as IdentityService;
    const authorizeCoordination = vi.fn(
      async ({
        request,
      }: {
        request: {
          permission: "coordination.timeline.read" | "coordination.task.handoff";
          requestDigest: string;
        };
      }) => ({
        decisionId: "coordination_decision_synthetic",
        permission: request.permission,
        actor: {
          actorId: "account_synthetic",
          actorRef: "actor_ref_synthetic",
          displayKey: "coordination.actor.you" as const,
          subject: true,
        },
        householdId: "household_synthetic",
        recipientContextId: "recipient_synthetic",
        subjectId: "subject_synthetic",
        subjectVersion: 1,
        grantId: null,
        grantVersion: null,
        privacyVersion: null,
        target:
          request.permission === "coordination.task.handoff"
            ? {
                actorId: "account_target",
                actorRef: "actor_ref_target",
                displayKey: "coordination.actor.household_member" as const,
                subject: false,
              }
            : null,
        eligibleTargets: [],
        decidedAt: "2026-07-26T12:00:00.000Z",
        correlationId: "corr_p3_authority",
        requestDigest: request.requestDigest,
      }),
    );
    const consent = { authorizeCoordination } as unknown as ConsentService;
    const app = buildIdentityServer(identity, "internal-token-value-123456789", undefined, consent);
    const commonHeaders = {
      "x-internal-service-token": "internal-token-value-123456789",
      "x-session-token": "s".repeat(43),
      "x-correlation-id": "corr_p3_authority",
    };

    const timeline = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/authorize",
      headers: commonHeaders,
      payload: {
        permission: "coordination.timeline.read",
        householdId: "household_synthetic",
        requestDigest: "a".repeat(64),
      },
    });
    const handoff = await app.inject({
      method: "POST",
      url: "/internal/v1/coordination/authorize",
      headers: { ...commonHeaders, "x-csrf-token": "c".repeat(43) },
      payload: {
        permission: "coordination.task.handoff",
        householdId: "household_synthetic",
        taskId: "task_synthetic",
        targetActorRef: "actor_ref_target",
        requestDigest: "b".repeat(64),
      },
    });

    expect(timeline.statusCode).toBe(200);
    expect(handoff.statusCode).toBe(200);
    expect(requireAccountSession).toHaveBeenNthCalledWith(1, "s".repeat(43));
    expect(requireAccountSession).toHaveBeenNthCalledWith(2, "s".repeat(43), "c".repeat(43));
    expect(authorizeCoordination).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
