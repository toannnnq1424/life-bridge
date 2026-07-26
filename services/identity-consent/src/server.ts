import {
  CompleteAccountOnboardingSchema,
  FactorRecoveryConfirmationSchema,
  FactorRecoveryRequestSchema,
  PasswordRecoveryRequestSchema,
  RegistrationFactorRequestSchema,
  RegistrationRecoveryConfirmationSchema,
  RegistrationRequestSchema,
  SignInFactorRequestSchema,
  SignInRequestSchema,
  UpdateIdentityPreferencesSchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import { IdentityError } from "./errors.js";
import type { IdentityService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): string {
  return String(request.headers[name] ?? "");
}

export function buildIdentityServer(identity: IdentityService, internalToken: string) {
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
  app.get("/version", async () => ({ service: "identity-consent", contract: "P2-S1-v1" }));

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

function correlation(request: { headers: Record<string, unknown> }): string {
  return resolveCorrelationId(request.headers["x-correlation-id"]);
}

function source(request: { headers: Record<string, unknown> }): string {
  const value = String(request.headers["x-rate-limit-source"] ?? "unknown");
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(value) ? value : "unknown";
}
