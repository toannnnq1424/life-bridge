import {
  CompleteAccountOnboardingSchema,
  CreateHouseholdInvitationRequestSchema,
  CreateHouseholdRequestSchema,
  FactorRecoveryConfirmationSchema,
  FactorRecoveryRequestSchema,
  IdempotencyKeySchema,
  InvitationTokenRequestSchema,
  PasswordRecoveryRequestSchema,
  RegistrationFactorRequestSchema,
  RegistrationRecoveryConfirmationSchema,
  RegistrationRequestSchema,
  ResendHouseholdInvitationRequestSchema,
  SignInFactorRequestSchema,
  SignInRequestSchema,
  UpdateIdentityPreferencesSchema,
  UpsertCareRecipientContextRequestSchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import { IdentityError } from "./errors.js";
import type { HouseholdService } from "./household-service.js";
import type { IdentityService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): string {
  return String(request.headers[name] ?? "");
}

export function buildIdentityServer(
  identity: IdentityService,
  internalToken: string,
  households?: HouseholdService,
) {
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024 });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("pragma", "no-cache");
  });

  app.addHook("preHandler", async (request, reply) => {
    if (
      request.url.startsWith("/internal/") &&
      header(request, "x-internal-service-token") !== internalToken
    ) {
      await reply.code(404).send();
    }
  });

  app.get("/health/live", async () => ({ status: "live" }));
  app.get("/health/ready", async (_request, reply) =>
    (await identity.isReady())
      ? { status: "ready" }
      : reply.code(503).send({ status: "not_ready", dependency: "identity_database" }),
  );
  app.get("/version", async () => ({ service: "identity-consent", contract: "P2-S2-v1" }));

  app.post<{ Body: unknown }>("/internal/v1/account/registrations", async (request, reply) => {
    const correlationId = correlation(request);
    const data = await identity.register({
      request: RegistrationRequestSchema.parse(request.body),
      correlationId,
      sourceKey: source(request),
    });
    return reply.code(202).send(successEnvelope(data, correlationId));
  });

  app.post<{ Body: unknown }>(
    "/internal/v1/account/registrations/factor",
    async (request, reply) => {
      const correlationId = correlation(request);
      const body = RegistrationFactorRequestSchema.parse(request.body);
      const data = await identity.verifyRegistrationFactor({
        ...body,
        correlationId,
        sourceKey: source(request),
      });
      return reply.code(202).send(successEnvelope(data, correlationId));
    },
  );

  app.post<{ Body: unknown }>(
    "/internal/v1/account/registrations/confirm-recovery",
    async (request, reply) => {
      const correlationId = correlation(request);
      const body = RegistrationRecoveryConfirmationSchema.parse(request.body);
      const data = await identity.confirmRegistrationRecovery({ ...body, correlationId });
      return reply.code(202).send(successEnvelope(data, correlationId));
    },
  );

  app.post<{ Body: unknown }>("/internal/v1/account/sessions", async (request, reply) => {
    const correlationId = correlation(request);
    const data = await identity.beginSignIn({
      request: SignInRequestSchema.parse(request.body),
      correlationId,
      sourceKey: source(request),
    });
    return reply.code(202).send(successEnvelope(data, correlationId));
  });

  app.post<{ Body: unknown }>("/internal/v1/account/sessions/factor", async (request, reply) => {
    const correlationId = correlation(request);
    const body = SignInFactorRequestSchema.parse(request.body);
    const data = await identity.completeSignIn({
      ...body,
      correlationId,
      sourceKey: source(request),
    });
    return reply.code(200).send(successEnvelope(data, correlationId));
  });

  app.post<{ Body: unknown }>(
    "/internal/v1/account/recoveries/password",
    async (request, reply) => {
      const correlationId = correlation(request);
      const data = await identity.recoverPassword({
        request: PasswordRecoveryRequestSchema.parse(request.body),
        correlationId,
        sourceKey: source(request),
      });
      return reply.code(200).send(successEnvelope(data, correlationId));
    },
  );

  app.post<{ Body: unknown }>("/internal/v1/account/recoveries/factor", async (request, reply) => {
    const correlationId = correlation(request);
    const data = await identity.beginFactorRecovery({
      request: FactorRecoveryRequestSchema.parse(request.body),
      correlationId,
      sourceKey: source(request),
    });
    return reply.code(200).send(successEnvelope(data, correlationId));
  });

  app.post<{ Body: unknown }>(
    "/internal/v1/account/recoveries/factor/confirm",
    async (request, reply) => {
      const correlationId = correlation(request);
      const body = FactorRecoveryConfirmationSchema.parse(request.body);
      const data = await identity.confirmFactorRecovery({
        ...body,
        correlationId,
        sourceKey: source(request),
      });
      return reply.code(200).send(successEnvelope(data, correlationId));
    },
  );

  app.get("/internal/v1/account/session", async (request) => {
    const correlationId = correlation(request);
    return successEnvelope(
      await identity.getSession(header(request, "x-session-token")),
      correlationId,
    );
  });

  app.patch<{ Body: unknown }>("/internal/v1/account/preferences", async (request) => {
    const correlationId = correlation(request);
    return successEnvelope(
      await identity.updatePreferences({
        sessionToken: header(request, "x-session-token"),
        csrfToken: header(request, "x-csrf-token"),
        request: UpdateIdentityPreferencesSchema.parse(request.body),
        correlationId,
      }),
      correlationId,
    );
  });

  app.post<{ Body: unknown }>("/internal/v1/account/onboarding/complete", async (request) => {
    const correlationId = correlation(request);
    return successEnvelope(
      await identity.completeOnboarding({
        sessionToken: header(request, "x-session-token"),
        csrfToken: header(request, "x-csrf-token"),
        request: CompleteAccountOnboardingSchema.parse(request.body),
        correlationId,
      }),
      correlationId,
    );
  });

  app.post("/internal/v1/account/session/logout", async (request) => {
    const correlationId = correlation(request);
    await identity.logout({
      sessionToken: header(request, "x-session-token"),
      csrfToken: header(request, "x-csrf-token"),
      correlationId,
    });
    return successEnvelope({ revoked: true }, correlationId);
  });

  app.post<{ Body: unknown }>("/internal/v1/households", async (request, reply) => {
    const service = requireHouseholds(households);
    const correlationId = correlation(request);
    const account = await identity.requireAccountSession(
      header(request, "x-session-token"),
      header(request, "x-csrf-token"),
    );
    const data = await service.createHousehold({
      accountId: account.accountId,
      request: CreateHouseholdRequestSchema.parse(request.body),
      idempotencyKey: IdempotencyKeySchema.parse(header(request, "idempotency-key")),
      correlationId,
    });
    return reply.code(201).send(successEnvelope(data, correlationId));
  });

  app.get<{ Params: { householdId: string } }>(
    "/internal/v1/households/:householdId",
    async (request) => {
      const service = requireHouseholds(households);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(header(request, "x-session-token"));
      return successEnvelope(
        await service.getHousehold({
          accountId: account.accountId,
          householdId: request.params.householdId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/households/:householdId/invitations",
    async (request, reply) => {
      const service = requireHouseholds(households);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(
        header(request, "x-session-token"),
        header(request, "x-csrf-token"),
      );
      const data = await service.createInvitation({
        accountId: account.accountId,
        householdId: request.params.householdId,
        request: CreateHouseholdInvitationRequestSchema.parse(request.body),
        idempotencyKey: IdempotencyKeySchema.parse(header(request, "idempotency-key")),
        correlationId,
      });
      return reply.code(201).send(successEnvelope(data, correlationId));
    },
  );

  for (const decision of ["accepted", "declined"] as const) {
    app.post<{ Body: unknown }>(
      `/internal/v1/invitations/${decision === "accepted" ? "accept" : "decline"}`,
      async (request) => {
        const service = requireHouseholds(households);
        const correlationId = correlation(request);
        const account = await identity.requireAccountSession(
          header(request, "x-session-token"),
          header(request, "x-csrf-token"),
        );
        const body = InvitationTokenRequestSchema.parse(request.body);
        return successEnvelope(
          await service.respondToInvitation({
            accountId: account.accountId,
            invitationToken: body.invitationToken,
            decision,
            correlationId,
          }),
          correlationId,
        );
      },
    );
  }

  app.post<{
    Params: { householdId: string; invitationId: string };
    Body: unknown;
  }>("/internal/v1/households/:householdId/invitations/:invitationId/resend", async (request) => {
    const service = requireHouseholds(households);
    const correlationId = correlation(request);
    const account = await identity.requireAccountSession(
      header(request, "x-session-token"),
      header(request, "x-csrf-token"),
    );
    const body = ResendHouseholdInvitationRequestSchema.parse(request.body);
    return successEnvelope(
      await service.resendInvitation({
        accountId: account.accountId,
        householdId: request.params.householdId,
        invitationId: request.params.invitationId,
        expectedVersion: body.expectedVersion,
        correlationId,
      }),
      correlationId,
    );
  });

  app.post<{
    Params: { householdId: string; invitationId: string };
    Body: unknown;
  }>("/internal/v1/households/:householdId/invitations/:invitationId/revoke", async (request) => {
    const service = requireHouseholds(households);
    const correlationId = correlation(request);
    const account = await identity.requireAccountSession(
      header(request, "x-session-token"),
      header(request, "x-csrf-token"),
    );
    const body = ResendHouseholdInvitationRequestSchema.parse(request.body);
    return successEnvelope(
      await service.revokeInvitation({
        accountId: account.accountId,
        householdId: request.params.householdId,
        invitationId: request.params.invitationId,
        expectedVersion: body.expectedVersion,
        correlationId,
      }),
      correlationId,
    );
  });

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/households/:householdId/recipient-context",
    async (request) => {
      const service = requireHouseholds(households);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(
        header(request, "x-session-token"),
        header(request, "x-csrf-token"),
      );
      return successEnvelope(
        await service.upsertRecipientContext({
          accountId: account.accountId,
          householdId: request.params.householdId,
          request: UpsertCareRecipientContextRequestSchema.parse(request.body),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/internal/v1/households/:householdId/recipient-context",
    async (request) => {
      const service = requireHouseholds(households);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(header(request, "x-session-token"));
      return successEnvelope(
        await service.getRecipientContext({
          accountId: account.accountId,
          householdId: request.params.householdId,
        }),
        correlationId,
      );
    },
  );

  app.setErrorHandler(async (error, request, reply) => {
    const correlationId = correlation(request);
    const identityError =
      error instanceof IdentityError
        ? error
        : new IdentityError(
            error instanceof Error && error.name === "ZodError" ? 400 : 503,
            error instanceof Error && error.name === "ZodError"
              ? "AUTHENTICATION_FAILED"
              : "IDENTITY_SERVICE_UNAVAILABLE",
            error instanceof Error && error.name === "ZodError"
              ? "auth.failed"
              : "identity.unavailable",
            !(error instanceof Error && error.name === "ZodError"),
          );
    return reply.code(identityError.statusCode).send({
      error: {
        code: identityError.code,
        messageKey: identityError.messageKey,
        retryable: identityError.retryable,
        correlationId,
      },
    });
  });

  return app;
}

function requireHouseholds(service: HouseholdService | undefined): HouseholdService {
  if (!service) {
    throw new IdentityError(503, "IDENTITY_SERVICE_UNAVAILABLE", "identity.unavailable", true);
  }
  return service;
}

function correlation(request: { headers: Record<string, unknown> }): string {
  return resolveCorrelationId(request.headers["x-correlation-id"]);
}

function source(request: { headers: Record<string, unknown> }): string {
  const value = String(request.headers["x-rate-limit-source"] ?? "unknown");
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : "unknown";
}
