import {
  AuditHistoryQuerySchema,
  CompleteAccountOnboardingSchema,
  CreateHouseholdInvitationRequestSchema,
  CreateHouseholdRequestSchema,
  ConsentScopeSchema,
  CoordinationAuthorizationRequestSchema,
  EstablishConsentSubjectRequestSchema,
  FactorRecoveryConfirmationSchema,
  FactorRecoveryRequestSchema,
  GrantConsentRequestSchema,
  IdempotencyKeySchema,
  InvitationTokenRequestSchema,
  NarrowConsentRequestSchema,
  PasswordRecoveryRequestSchema,
  RegistrationFactorRequestSchema,
  RegistrationRecoveryConfirmationSchema,
  RegistrationRequestSchema,
  ResendHouseholdInvitationRequestSchema,
  RevokeConsentRequestSchema,
  SignInFactorRequestSchema,
  SignInRequestSchema,
  UpdateIdentityPreferencesSchema,
  UpdatePrivacyPreferencesSchema,
  UpsertCareRecipientContextRequestSchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import { IdentityError } from "./errors.js";
import type { ConsentService } from "./consent-service.js";
import type { HouseholdService } from "./household-service.js";
import type { IdentityService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): string {
  return String(request.headers[name] ?? "");
}

export function buildIdentityServer(
  identity: IdentityService,
  internalToken: string,
  households?: HouseholdService,
  consent?: ConsentService,
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
  app.get("/version", async () => ({ service: "identity-consent", contract: "P3-S3-v1" }));

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

  app.get("/internal/v1/account/privacy", async (request) => {
    const service = requireConsent(consent);
    const correlationId = correlation(request);
    const account = await identity.requireAccountSession(header(request, "x-session-token"));
    return successEnvelope(
      await service.getPrivacy({ accountId: account.accountId }),
      correlationId,
    );
  });

  app.patch<{ Body: unknown }>("/internal/v1/account/privacy", async (request) => {
    const service = requireConsent(consent);
    const correlationId = correlation(request);
    const account = await identity.requireAccountSession(
      header(request, "x-session-token"),
      header(request, "x-csrf-token"),
    );
    return successEnvelope(
      await service.updatePrivacy({
        accountId: account.accountId,
        request: UpdatePrivacyPreferencesSchema.parse(request.body),
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
    "/internal/v1/households/:householdId/consent/subject",
    async (request, reply) => {
      const service = requireConsent(consent);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(
        header(request, "x-session-token"),
        header(request, "x-csrf-token"),
      );
      const data = await service.establishSubject({
        accountId: account.accountId,
        householdId: request.params.householdId,
        request: EstablishConsentSubjectRequestSchema.parse(request.body),
        correlationId,
      });
      return reply.code(201).send(successEnvelope(data, correlationId));
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/internal/v1/households/:householdId/consent",
    async (request) => {
      const service = requireConsent(consent);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(header(request, "x-session-token"));
      return successEnvelope(
        await service.overview({
          accountId: account.accountId,
          householdId: request.params.householdId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/households/:householdId/consent/grants",
    async (request, reply) => {
      const service = requireConsent(consent);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(
        header(request, "x-session-token"),
        header(request, "x-csrf-token"),
      );
      const data = await service.grant({
        accountId: account.accountId,
        householdId: request.params.householdId,
        request: GrantConsentRequestSchema.parse(request.body),
        idempotencyKey: IdempotencyKeySchema.parse(header(request, "idempotency-key")),
        correlationId,
      });
      return reply.code(201).send(successEnvelope(data, correlationId));
    },
  );

  app.post<{ Params: { householdId: string; grantId: string }; Body: unknown }>(
    "/internal/v1/households/:householdId/consent/grants/:grantId/narrow",
    async (request) => {
      const service = requireConsent(consent);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(
        header(request, "x-session-token"),
        header(request, "x-csrf-token"),
      );
      return successEnvelope(
        await service.narrow({
          accountId: account.accountId,
          householdId: request.params.householdId,
          grantId: request.params.grantId,
          request: NarrowConsentRequestSchema.parse(request.body),
          idempotencyKey: IdempotencyKeySchema.parse(header(request, "idempotency-key")),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; grantId: string }; Body: unknown }>(
    "/internal/v1/households/:householdId/consent/grants/:grantId/revoke",
    async (request) => {
      const service = requireConsent(consent);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(
        header(request, "x-session-token"),
        header(request, "x-csrf-token"),
      );
      return successEnvelope(
        await service.revoke({
          accountId: account.accountId,
          householdId: request.params.householdId,
          grantId: request.params.grantId,
          request: RevokeConsentRequestSchema.parse(request.body),
          idempotencyKey: IdempotencyKeySchema.parse(header(request, "idempotency-key")),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.get<{ Params: { householdId: string; scope: string } }>(
    "/internal/v1/households/:householdId/recipient-context/scopes/:scope",
    async (request) => {
      const service = requireConsent(consent);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(header(request, "x-session-token"));
      return successEnvelope(
        await service.governedRecipientContext({
          accountId: account.accountId,
          householdId: request.params.householdId,
          scope: ConsentScopeSchema.parse(request.params.scope),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Body: unknown }>("/internal/v1/coordination/authorize", async (request) => {
    const service = requireConsent(consent);
    const correlationId = correlation(request);
    const authorizationRequest = CoordinationAuthorizationRequestSchema.parse(request.body);
    const requiresMutationProof =
      authorizationRequest.permission === "coordination.task.handoff" ||
      authorizationRequest.permission === "coordination.appointment.create" ||
      authorizationRequest.permission === "coordination.appointment.change" ||
      authorizationRequest.permission === "coordination.appointment.cancel";
    const account = requiresMutationProof
      ? await identity.requireAccountSession(
          header(request, "x-session-token"),
          header(request, "x-csrf-token"),
        )
      : await identity.requireAccountSession(header(request, "x-session-token"));
    return successEnvelope(
      await service.authorizeCoordination({
        accountId: account.accountId,
        request: authorizationRequest,
        correlationId,
      }),
      correlationId,
    );
  });

  app.get<{ Params: { householdId: string }; Querystring: unknown }>(
    "/internal/v1/households/:householdId/audit",
    async (request) => {
      const service = requireConsent(consent);
      const correlationId = correlation(request);
      const account = await identity.requireAccountSession(header(request, "x-session-token"));
      return successEnvelope(
        await service.auditHistory({
          accountId: account.accountId,
          householdId: request.params.householdId,
          query: AuditHistoryQuerySchema.parse(request.query),
          correlationId,
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
              ? isP2S3Route(request.url)
                ? "CONSENT_VALIDATION_FAILED"
                : "AUTHENTICATION_FAILED"
              : "IDENTITY_SERVICE_UNAVAILABLE",
            error instanceof Error && error.name === "ZodError"
              ? isP2S3Route(request.url)
                ? "consent.validation_failed"
                : "auth.failed"
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

function requireConsent(service: ConsentService | undefined): ConsentService {
  if (!service) {
    throw new IdentityError(503, "IDENTITY_SERVICE_UNAVAILABLE", "identity.unavailable", true);
  }
  return service;
}

function isP2S3Route(url: string): boolean {
  return (
    url.includes("/consent") ||
    url.includes("/audit") ||
    url.includes("/privacy") ||
    url.includes("/coordination/") ||
    url.includes("/recipient-context/scopes/")
  );
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
