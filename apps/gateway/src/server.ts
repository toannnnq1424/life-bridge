import { createHash } from "node:crypto";

import {
  AcknowledgeMedicationReminderRequestSchema,
  CalendarQuerySchema,
  CarePlanHistoryQuerySchema,
  CancelAppointmentRequestSchema,
  ChangeAppointmentRequestSchema,
  ChangeMedicationReminderRequestSchema,
  CoordinationAuthorizationDecisionSchema,
  ConfirmCarePlanVersionRequestSchema,
  CreateAppointmentRequestSchema,
  CreateMedicationReminderRequestSchema,
  DailyTimelineQuerySchema,
  DeleteDocumentRequestSchema,
  DisableMedicationReminderRequestSchema,
  EmergencyHistoryQuerySchema,
  ReplaceEmergencyContactsRequestSchema,
  ReviewEmergencyPlanVersionRequestSchema,
  CompleteTaskRequestSchema,
  CreateTaskRequestSchema,
  HandoffTaskRequestSchema,
  IdempotencyKeySchema,
  IanaTimeZoneSchema,
  SaveCarePlanDraftRequestSchema,
  SaveEmergencyPlanDraftRequestSchema,
  UploadDocumentRequestSchema,
  successEnvelope,
  type CoordinationPermission,
} from "@lifebridge/contracts";
import { resolveCorrelationId, SafeLogger } from "@lifebridge/observability";
import { fixtureMember } from "@lifebridge/test-fixtures";
import cookie from "@fastify/cookie";
import Fastify from "fastify";

import { registerCommunityRoutes } from "./community-routes.js";

export interface GatewayConfig {
  careUrl: string;
  identityUrl: string;
  notificationUrl: string;
  communityUrl?: string;
  careToken: string;
  identityToken: string;
  notificationToken: string;
  communityToken?: string;
  fixtureEnabled: boolean;
  publicOrigin: string;
  sessionCookieName: string;
  secureCookies: boolean;
}

type Fetcher = typeof fetch;

class DependencyResponse {
  public constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {}
}

class BinaryDependencyResponse {
  public constructor(
    public readonly status: number,
    public readonly bytes: Buffer,
    public readonly errorBody: unknown,
  ) {}
}

class IdempotencyKeyRequiredError extends Error {
  public constructor() {
    super("IDEMPOTENCY_KEY_REQUIRED");
    this.name = "IdempotencyKeyRequiredError";
  }
}

function actorId(headers: Record<string, unknown>, fixtureEnabled: boolean): string {
  if (!fixtureEnabled) {
    return "";
  }
  const candidate = String(headers["x-fixture-actor-id"] ?? "");
  return fixtureMember(candidate)?.active ? candidate : "";
}

async function dependencyRequest(
  fetcher: Fetcher,
  url: string,
  input: {
    method?: string;
    actorId: string;
    correlationId: string;
    token: string;
    idempotencyKey?: string;
    body?: unknown;
  },
): Promise<DependencyResponse> {
  const response = await fetcher(url, {
    method: input.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-actor-id": input.actorId,
      "x-correlation-id": input.correlationId,
      "x-internal-service-token": input.token,
      ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    signal: AbortSignal.timeout(2_500),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return new DependencyResponse(response.status, body);
}

async function binaryDependencyRequest(
  fetcher: Fetcher,
  url: string,
  input: {
    actorId: string;
    correlationId: string;
    token: string;
    body: unknown;
  },
): Promise<BinaryDependencyResponse> {
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-actor-id": input.actorId,
      "x-correlation-id": input.correlationId,
      "x-internal-service-token": input.token,
    },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(2_500),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  let errorBody: unknown = null;
  if (response.status >= 400) {
    try {
      errorBody = JSON.parse(bytes.toString("utf8"));
    } catch {
      errorBody = null;
    }
  }
  return new BinaryDependencyResponse(response.status, bytes, errorBody);
}

async function identityRequest(
  fetcher: Fetcher,
  url: string,
  input: {
    method?: string;
    correlationId: string;
    token: string;
    sourceKey: string;
    sessionToken?: string;
    csrfToken?: string;
    idempotencyKey?: string;
    body?: unknown;
  },
): Promise<DependencyResponse> {
  const response = await fetcher(url, {
    method: input.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": input.correlationId,
      "x-internal-service-token": input.token,
      "x-rate-limit-source": input.sourceKey,
      ...(input.sessionToken ? { "x-session-token": input.sessionToken } : {}),
      ...(input.csrfToken ? { "x-csrf-token": input.csrfToken } : {}),
      ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
    },
    ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
    signal: AbortSignal.timeout(2_500),
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return new DependencyResponse(response.status, body);
}

export function buildGatewayServer(
  config: GatewayConfig,
  fetcher: Fetcher = fetch,
  logger = new SafeLogger("gateway"),
) {
  const app = Fastify({ logger: false, bodyLimit: 512 * 1024 });
  void app.register(cookie);
  app.addHook("onRequest", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("pragma", "no-cache");
  });
  registerCommunityRoutes(
    app,
    {
      communityUrl: config.communityUrl ?? "http://127.0.0.1:3103",
      identityUrl: config.identityUrl,
      communityToken: config.communityToken ?? "community-test-token-000000",
      identityToken: config.identityToken,
      publicOrigin: config.publicOrigin,
      sessionCookieName: config.sessionCookieName,
    },
    fetcher,
    logger,
  );

  app.get("/health/live", async () => ({ status: "live" }));
  app.get("/version", async () => ({ service: "gateway", contract: "P5-S1-v1" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      const care = await fetcher(`${config.careUrl}/health/ready`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (!care.ok) {
        return reply.code(503).send({ status: "not_ready", dependency: "care" });
      }
      if (!config.fixtureEnabled) {
        const identity = await fetcher(`${config.identityUrl}/health/ready`, {
          signal: AbortSignal.timeout(1_000),
        });
        if (!identity.ok) {
          return reply.code(503).send({ status: "not_ready", dependency: "identity" });
        }
      }
      if (config.communityUrl) {
        const community = await fetcher(`${config.communityUrl}/health/ready`, {
          signal: AbortSignal.timeout(1_000),
        });
        if (!community.ok) {
          return reply.code(503).send({ status: "not_ready", dependency: "community" });
        }
      }
      let notification = "available";
      try {
        const response = await fetcher(`${config.notificationUrl}/health/ready`, {
          signal: AbortSignal.timeout(1_000),
        });
        notification = response.ok ? "available" : "degraded";
      } catch {
        notification = "degraded";
      }
      return { status: "ready", notification };
    } catch {
      return reply.code(503).send({ status: "not_ready", dependency: "care" });
    }
  });

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/members",
    async (request, reply) =>
      forwardCare(
        request,
        reply,
        `${config.careUrl}/internal/v1/households/${encodeURIComponent(request.params.householdId)}/members`,
      ),
  );

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/tasks",
    async (request, reply) =>
      forwardCare(
        request,
        reply,
        `${config.careUrl}/internal/v1/households/${encodeURIComponent(request.params.householdId)}/tasks`,
      ),
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/tasks",
    async (request, reply) => {
      const parsedBody = CreateTaskRequestSchema.parse(request.body);
      const key = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return forwardCare(
        request,
        reply,
        `${config.careUrl}/internal/v1/households/${encodeURIComponent(request.params.householdId)}/tasks`,
        { method: "POST", idempotencyKey: key, body: parsedBody },
      );
    },
  );

  app.get<{ Params: { taskId: string } }>("/api/v1/tasks/:taskId", async (request, reply) =>
    forwardCare(
      request,
      reply,
      `${config.careUrl}/internal/v1/tasks/${encodeURIComponent(request.params.taskId)}`,
    ),
  );

  app.patch<{ Params: { taskId: string }; Body: unknown }>(
    "/api/v1/tasks/:taskId",
    async (request, reply) => {
      const parsedBody = CompleteTaskRequestSchema.parse(request.body);
      const key = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return forwardCare(
        request,
        reply,
        `${config.careUrl}/internal/v1/tasks/${encodeURIComponent(request.params.taskId)}`,
        { method: "PATCH", idempotencyKey: key, body: parsedBody },
      );
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/dashboard",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      const actor = actorId(request.headers, config.fixtureEnabled);
      let careResponse: DependencyResponse;
      try {
        careResponse = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/households/${encodeURIComponent(request.params.householdId)}/dashboard`,
          {
            actorId: actor,
            correlationId,
            token: config.careToken,
          },
        );
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
      if (careResponse.status >= 400) {
        return reply.code(careResponse.status).send(careResponse.body);
      }

      let notificationDependency: "available" | "degraded" = "available";
      let notifications: unknown[] | null;
      try {
        const notificationResponse = await dependencyRequest(
          fetcher,
          `${config.notificationUrl}/internal/v1/notifications`,
          {
            actorId: actor,
            correlationId,
            token: config.notificationToken,
          },
        );
        if (notificationResponse.status >= 400) {
          notificationDependency = "degraded";
          notifications = null;
        } else {
          notifications = (notificationResponse.body as { data?: unknown[] } | null)?.data ?? null;
        }
      } catch {
        notificationDependency = "degraded";
        notifications = null;
      }
      const careData = (careResponse.body as { data?: Record<string, unknown> } | null)?.data;
      return successEnvelope(
        {
          ...careData,
          notificationDependency,
          notifications,
        },
        correlationId,
      );
    },
  );

  app.get("/api/v1/notifications", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const actor = actorId(request.headers, config.fixtureEnabled);
    try {
      const response = await dependencyRequest(
        fetcher,
        `${config.notificationUrl}/internal/v1/notifications`,
        {
          actorId: actor,
          correlationId,
          token: config.notificationToken,
        },
      );
      if (response.status >= 400) {
        return dependencyUnavailable(reply, correlationId, logger, "notification");
      }
      return reply.code(200).send(response.body);
    } catch {
      return dependencyUnavailable(reply, correlationId, logger, "notification");
    }
  });

  const anonymousIdentityRoutes = [
    ["/api/v1/account/registrations", "/internal/v1/account/registrations"],
    ["/api/v1/account/registrations/factor", "/internal/v1/account/registrations/factor"],
    [
      "/api/v1/account/registrations/confirm-recovery",
      "/internal/v1/account/registrations/confirm-recovery",
    ],
    ["/api/v1/account/sessions", "/internal/v1/account/sessions"],
    ["/api/v1/account/recoveries/password", "/internal/v1/account/recoveries/password"],
    ["/api/v1/account/recoveries/factor", "/internal/v1/account/recoveries/factor"],
    ["/api/v1/account/recoveries/factor/confirm", "/internal/v1/account/recoveries/factor/confirm"],
  ] as const;
  for (const [publicPath, internalPath] of anonymousIdentityRoutes) {
    app.post<{ Body: unknown }>(publicPath, async (request, reply) =>
      forwardIdentity(request, reply, internalPath, { method: "POST", body: request.body }),
    );
  }

  app.post<{ Body: unknown }>("/api/v1/account/sessions/factor", async (request, reply) => {
    const response = await callIdentity(request, "/internal/v1/account/sessions/factor", {
      method: "POST",
      body: request.body,
    });
    if (!response) {
      return dependencyUnavailable(
        reply,
        resolveCorrelationId(request.headers["x-correlation-id"]),
        logger,
        "identity",
      );
    }
    return sendSessionResponse(reply, response);
  });

  app.get("/api/v1/account/session", async (request, reply) =>
    forwardIdentity(request, reply, "/internal/v1/account/session", {
      ...sessionOption(request.cookies[config.sessionCookieName]),
    }),
  );

  app.patch<{ Body: unknown }>("/api/v1/account/preferences", async (request, reply) => {
    if (!validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    return forwardIdentity(request, reply, "/internal/v1/account/preferences", {
      method: "PATCH",
      body: request.body,
      ...sessionOption(request.cookies[config.sessionCookieName]),
      csrfToken: String(request.headers["x-csrf-token"] ?? ""),
    });
  });

  app.get("/api/v1/account/privacy", async (request, reply) =>
    forwardIdentity(request, reply, "/internal/v1/account/privacy", {
      ...sessionOption(request.cookies[config.sessionCookieName]),
    }),
  );

  app.patch<{ Body: unknown }>("/api/v1/account/privacy", async (request, reply) => {
    if (!validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    return forwardIdentity(request, reply, "/internal/v1/account/privacy", {
      method: "PATCH",
      body: request.body,
      ...sessionOption(request.cookies[config.sessionCookieName]),
      csrfToken: String(request.headers["x-csrf-token"] ?? ""),
    });
  });

  app.post<{ Body: unknown }>("/api/v1/account/onboarding/complete", async (request, reply) => {
    if (!validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    const response = await callIdentity(request, "/internal/v1/account/onboarding/complete", {
      method: "POST",
      body: request.body,
      ...sessionOption(request.cookies[config.sessionCookieName]),
      csrfToken: String(request.headers["x-csrf-token"] ?? ""),
    });
    if (!response) {
      return dependencyUnavailable(
        reply,
        resolveCorrelationId(request.headers["x-correlation-id"]),
        logger,
        "identity",
      );
    }
    return sendSessionResponse(reply, response);
  });

  app.post("/api/v1/account/session/logout", async (request, reply) => {
    if (!validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const response = await callIdentity(request, "/internal/v1/account/session/logout", {
      method: "POST",
      ...sessionOption(request.cookies[config.sessionCookieName]),
      csrfToken: String(request.headers["x-csrf-token"] ?? ""),
    });
    reply.clearCookie(config.sessionCookieName, cookieOptions());
    if (!response) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    const errorCode = (response.body as { error?: { code?: unknown } } | null)?.error?.code;
    if (
      response.status === 401 &&
      (errorCode === "SESSION_REQUIRED" || errorCode === "SESSION_EXPIRED")
    ) {
      return reply.code(200).send(successEnvelope({ revoked: true }, correlationId));
    }
    return reply.code(response.status).send(response.body);
  });

  app.post<{ Body: unknown }>("/api/v1/households", async (request, reply) => {
    if (!validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    return forwardIdentity(request, reply, "/internal/v1/households", {
      method: "POST",
      body: request.body,
      ...sessionOption(request.cookies[config.sessionCookieName]),
      csrfToken: String(request.headers["x-csrf-token"] ?? ""),
      idempotencyKey: requiredIdempotencyKey(request.headers["idempotency-key"]),
    });
  });

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId",
    async (request, reply) =>
      forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}`,
        { ...sessionOption(request.cookies[config.sessionCookieName]) },
      ),
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/invitations",
    async (request, reply) => {
      if (!validBrowserMutation(request.headers)) {
        return rejectedBrowserMutation(reply, request.headers);
      }
      return forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/invitations`,
        {
          method: "POST",
          body: request.body,
          ...sessionOption(request.cookies[config.sessionCookieName]),
          csrfToken: String(request.headers["x-csrf-token"] ?? ""),
          idempotencyKey: requiredIdempotencyKey(request.headers["idempotency-key"]),
        },
      );
    },
  );

  for (const action of ["accept", "decline"] as const) {
    app.post<{ Body: unknown }>(`/api/v1/invitations/${action}`, async (request, reply) => {
      if (!validBrowserMutation(request.headers)) {
        return rejectedBrowserMutation(reply, request.headers);
      }
      return forwardIdentity(request, reply, `/internal/v1/invitations/${action}`, {
        method: "POST",
        body: request.body,
        ...sessionOption(request.cookies[config.sessionCookieName]),
        csrfToken: String(request.headers["x-csrf-token"] ?? ""),
      });
    });
  }

  for (const action of ["resend", "revoke"] as const) {
    app.post<{
      Params: { householdId: string; invitationId: string };
      Body: unknown;
    }>(
      `/api/v1/households/:householdId/invitations/:invitationId/${action}`,
      async (request, reply) => {
        if (!validBrowserMutation(request.headers)) {
          return rejectedBrowserMutation(reply, request.headers);
        }
        return forwardIdentity(
          request,
          reply,
          `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/invitations/${encodeURIComponent(request.params.invitationId)}/${action}`,
          {
            method: "POST",
            body: request.body,
            ...sessionOption(request.cookies[config.sessionCookieName]),
            csrfToken: String(request.headers["x-csrf-token"] ?? ""),
          },
        );
      },
    );
  }

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/recipient-context",
    async (request, reply) =>
      forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/recipient-context`,
        { ...sessionOption(request.cookies[config.sessionCookieName]) },
      ),
  );

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/recipient-context",
    async (request, reply) => {
      if (!validBrowserMutation(request.headers)) {
        return rejectedBrowserMutation(reply, request.headers);
      }
      return forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/recipient-context`,
        {
          method: "PUT",
          body: request.body,
          ...sessionOption(request.cookies[config.sessionCookieName]),
          csrfToken: String(request.headers["x-csrf-token"] ?? ""),
        },
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/consent/subject",
    async (request, reply) => {
      if (!validBrowserMutation(request.headers)) {
        return rejectedBrowserMutation(reply, request.headers);
      }
      return forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/consent/subject`,
        {
          method: "POST",
          body: request.body,
          ...sessionOption(request.cookies[config.sessionCookieName]),
          csrfToken: String(request.headers["x-csrf-token"] ?? ""),
        },
      );
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/consent",
    async (request, reply) =>
      forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/consent`,
        { ...sessionOption(request.cookies[config.sessionCookieName]) },
      ),
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/consent/grants",
    async (request, reply) => {
      if (!validBrowserMutation(request.headers)) {
        return rejectedBrowserMutation(reply, request.headers);
      }
      return forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/consent/grants`,
        {
          method: "POST",
          body: request.body,
          ...sessionOption(request.cookies[config.sessionCookieName]),
          csrfToken: String(request.headers["x-csrf-token"] ?? ""),
          idempotencyKey: requiredIdempotencyKey(request.headers["idempotency-key"]),
        },
      );
    },
  );

  for (const action of ["narrow", "revoke"] as const) {
    app.post<{
      Params: { householdId: string; grantId: string };
      Body: unknown;
    }>(
      `/api/v1/households/:householdId/consent/grants/:grantId/${action}`,
      async (request, reply) => {
        if (!validBrowserMutation(request.headers)) {
          return rejectedBrowserMutation(reply, request.headers);
        }
        return forwardIdentity(
          request,
          reply,
          `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/consent/grants/${encodeURIComponent(request.params.grantId)}/${action}`,
          {
            method: "POST",
            body: request.body,
            ...sessionOption(request.cookies[config.sessionCookieName]),
            csrfToken: String(request.headers["x-csrf-token"] ?? ""),
            idempotencyKey: requiredIdempotencyKey(request.headers["idempotency-key"]),
          },
        );
      },
    );
  }

  app.get<{ Params: { householdId: string; scope: string } }>(
    "/api/v1/households/:householdId/recipient-context/scopes/:scope",
    async (request, reply) =>
      forwardIdentity(
        request,
        reply,
        `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/recipient-context/scopes/${encodeURIComponent(request.params.scope)}`,
        { ...sessionOption(request.cookies[config.sessionCookieName]) },
      ),
  );

  app.get<{
    Params: { householdId: string };
    Querystring: Record<string, string | undefined>;
  }>("/api/v1/households/:householdId/audit", async (request, reply) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(request.query)) {
      if (value !== undefined) query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return forwardIdentity(
      request,
      reply,
      `/internal/v1/households/${encodeURIComponent(request.params.householdId)}/audit${suffix}`,
      { ...sessionOption(request.cookies[config.sessionCookieName]) },
    );
  });

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/care-plan",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      const requestDigest = digestJson({
        operation: "care_plan.read",
        householdId: request.params.householdId,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        body: {
          permission: "coordination.care_plan.read",
          householdId: request.params.householdId,
          requestDigest,
        },
      });
      if (!decisionResponse) return dependencyUnavailable(reply, correlationId, logger, "identity");
      if (decisionResponse.status >= 400)
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      const authorization = decisionData(decisionResponse);
      if (!authorization) return dependencyUnavailable(reply, correlationId, logger, "identity");
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/care-plan/read`,
          {
            method: "POST",
            actorId: "",
            correlationId,
            token: config.careToken,
            body: { authorization },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.get<{ Params: { householdId: string }; Querystring: { limit?: string; cursor?: string } }>(
    "/api/v1/households/:householdId/care-plan/history",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      const query = CarePlanHistoryQuerySchema.parse(request.query);
      const requestDigest = digestJson({
        operation: "care_plan.history.read",
        householdId: request.params.householdId,
        query,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        body: {
          permission: "coordination.care_plan.history.read",
          householdId: request.params.householdId,
          requestDigest,
        },
      });
      if (!decisionResponse) return dependencyUnavailable(reply, correlationId, logger, "identity");
      if (decisionResponse.status >= 400)
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      const authorization = decisionData(decisionResponse);
      if (!authorization) return dependencyUnavailable(reply, correlationId, logger, "identity");
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/care-plan/history/query`,
          {
            method: "POST",
            actorId: "",
            correlationId,
            token: config.careToken,
            body: { authorization, query },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.get<{ Params: { householdId: string; planVersion: string } }>(
    "/api/v1/households/:householdId/care-plan/versions/:planVersion",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      const planVersion = Number(request.params.planVersion);
      const requestDigest = digestJson({
        operation: "care_plan.version.read",
        householdId: request.params.householdId,
        planVersion,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        body: {
          permission: "coordination.care_plan.history.read",
          householdId: request.params.householdId,
          requestDigest,
        },
      });
      if (!decisionResponse) return dependencyUnavailable(reply, correlationId, logger, "identity");
      if (decisionResponse.status >= 400)
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      const authorization = decisionData(decisionResponse);
      if (!authorization) return dependencyUnavailable(reply, correlationId, logger, "identity");
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/care-plan/versions/${encodeURIComponent(String(planVersion))}/read`,
          {
            method: "POST",
            actorId: "",
            correlationId,
            token: config.careToken,
            body: { authorization },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/care-plan/draft",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      if (!validBrowserMutation(request.headers))
        return rejectedBrowserMutation(reply, request.headers);
      const carePlanRequest = SaveCarePlanDraftRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      const requestDigest = digestJson({
        operation: "care_plan.draft.save",
        householdId: request.params.householdId,
        request: carePlanRequest,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        csrfToken: String(request.headers["x-csrf-token"] ?? ""),
        body: {
          permission: "coordination.care_plan.draft.save",
          householdId: request.params.householdId,
          requestDigest,
        },
      });
      if (!decisionResponse) return dependencyUnavailable(reply, correlationId, logger, "identity");
      if (decisionResponse.status >= 400)
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      const authorization = decisionData(decisionResponse);
      if (!authorization) return dependencyUnavailable(reply, correlationId, logger, "identity");
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/care-plan/draft`,
          {
            method: "PUT",
            actorId: "",
            correlationId,
            token: config.careToken,
            idempotencyKey,
            body: { authorization, request: carePlanRequest },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/care-plan/current",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      if (!validBrowserMutation(request.headers))
        return rejectedBrowserMutation(reply, request.headers);
      const carePlanRequest = ConfirmCarePlanVersionRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      const requestDigest = digestJson({
        operation: "care_plan.version.confirm",
        householdId: request.params.householdId,
        request: carePlanRequest,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        csrfToken: String(request.headers["x-csrf-token"] ?? ""),
        body: {
          permission: "coordination.care_plan.version.confirm",
          householdId: request.params.householdId,
          requestDigest,
        },
      });
      if (!decisionResponse) return dependencyUnavailable(reply, correlationId, logger, "identity");
      if (decisionResponse.status >= 400)
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      const authorization = decisionData(decisionResponse);
      if (!authorization) return dependencyUnavailable(reply, correlationId, logger, "identity");
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/care-plan/current`,
          {
            method: "POST",
            actorId: "",
            correlationId,
            token: config.careToken,
            idempotencyKey,
            body: { authorization, request: carePlanRequest },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.get<{
    Params: { householdId: string };
    Querystring: {
      localDate?: string;
      displayTimeZone?: string;
      status?: string;
    };
  }>("/api/v1/households/:householdId/calendar", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const query = CalendarQuerySchema.parse({
      localDate: request.query.localDate,
      displayTimeZone: request.query.displayTimeZone,
      filter: request.query.status ?? "all",
    });
    const requestDigest = digestJson({
      operation: "calendar.read",
      householdId: request.params.householdId,
      query,
    });
    const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
      correlationId,
      method: "POST",
      ...sessionOption(request.cookies[config.sessionCookieName]),
      body: {
        permission: "coordination.calendar.read",
        householdId: request.params.householdId,
        requestDigest,
      },
    });
    if (!decisionResponse) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    if (decisionResponse.status >= 400) {
      return reply.code(decisionResponse.status).send(decisionResponse.body);
    }
    const authorization = decisionData(decisionResponse);
    if (!authorization) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    try {
      const response = await dependencyRequest(
        fetcher,
        `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/calendar/query`,
        {
          method: "POST",
          actorId: "",
          correlationId,
          token: config.careToken,
          body: { authorization, query },
        },
      );
      return reply.code(response.status).send(response.body);
    } catch {
      return dependencyUnavailable(reply, correlationId, logger, "care");
    }
  });

  app.get<{ Params: { householdId: string; appointmentId: string } }>(
    "/api/v1/households/:householdId/appointments/:appointmentId",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      const requestDigest = digestJson({
        operation: "appointment.read",
        householdId: request.params.householdId,
        appointmentId: request.params.appointmentId,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        body: {
          permission: "coordination.calendar.read",
          householdId: request.params.householdId,
          requestDigest,
        },
      });
      if (!decisionResponse) {
        return dependencyUnavailable(reply, correlationId, logger, "identity");
      }
      if (decisionResponse.status >= 400) {
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      }
      const authorization = decisionData(decisionResponse);
      if (!authorization) {
        return dependencyUnavailable(reply, correlationId, logger, "identity");
      }
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/appointments/${encodeURIComponent(request.params.appointmentId)}/read`,
          {
            method: "POST",
            actorId: "",
            correlationId,
            token: config.careToken,
            body: { authorization },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/appointments",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      if (!validBrowserMutation(request.headers)) {
        return rejectedBrowserMutation(reply, request.headers);
      }
      const appointmentRequest = CreateAppointmentRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      const requestDigest = digestJson({
        operation: "appointment.create",
        householdId: request.params.householdId,
        request: appointmentRequest,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        csrfToken: String(request.headers["x-csrf-token"] ?? ""),
        body: {
          permission: "coordination.appointment.create",
          householdId: request.params.householdId,
          requestDigest,
        },
      });
      if (!decisionResponse) {
        return dependencyUnavailable(reply, correlationId, logger, "identity");
      }
      if (decisionResponse.status >= 400) {
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      }
      const authorization = decisionData(decisionResponse);
      if (!authorization) {
        return dependencyUnavailable(reply, correlationId, logger, "identity");
      }
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/appointments`,
          {
            method: "POST",
            actorId: "",
            correlationId,
            token: config.careToken,
            idempotencyKey,
            body: { authorization, request: appointmentRequest },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.patch<{
    Params: { householdId: string; appointmentId: string };
    Body: unknown;
  }>("/api/v1/households/:householdId/appointments/:appointmentId", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    if (!validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    const appointmentRequest = ChangeAppointmentRequestSchema.parse(request.body);
    const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
    const requestDigest = digestJson({
      operation: "appointment.change",
      householdId: request.params.householdId,
      appointmentId: request.params.appointmentId,
      request: appointmentRequest,
    });
    const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
      correlationId,
      method: "POST",
      ...sessionOption(request.cookies[config.sessionCookieName]),
      csrfToken: String(request.headers["x-csrf-token"] ?? ""),
      body: {
        permission: "coordination.appointment.change",
        householdId: request.params.householdId,
        appointmentId: request.params.appointmentId,
        requestDigest,
      },
    });
    if (!decisionResponse) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    if (decisionResponse.status >= 400) {
      return reply.code(decisionResponse.status).send(decisionResponse.body);
    }
    const authorization = decisionData(decisionResponse);
    if (!authorization) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    try {
      const response = await dependencyRequest(
        fetcher,
        `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/appointments/${encodeURIComponent(request.params.appointmentId)}`,
        {
          method: "PATCH",
          actorId: "",
          correlationId,
          token: config.careToken,
          idempotencyKey,
          body: { authorization, request: appointmentRequest },
        },
      );
      return reply.code(response.status).send(response.body);
    } catch {
      return dependencyUnavailable(reply, correlationId, logger, "care");
    }
  });

  app.post<{
    Params: { householdId: string; appointmentId: string };
    Body: unknown;
  }>(
    "/api/v1/households/:householdId/appointments/:appointmentId/cancel",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
      if (!validBrowserMutation(request.headers)) {
        return rejectedBrowserMutation(reply, request.headers);
      }
      const appointmentRequest = CancelAppointmentRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      const requestDigest = digestJson({
        operation: "appointment.cancel",
        householdId: request.params.householdId,
        appointmentId: request.params.appointmentId,
        request: appointmentRequest,
      });
      const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
        correlationId,
        method: "POST",
        ...sessionOption(request.cookies[config.sessionCookieName]),
        csrfToken: String(request.headers["x-csrf-token"] ?? ""),
        body: {
          permission: "coordination.appointment.cancel",
          householdId: request.params.householdId,
          appointmentId: request.params.appointmentId,
          requestDigest,
        },
      });
      if (!decisionResponse) {
        return dependencyUnavailable(reply, correlationId, logger, "identity");
      }
      if (decisionResponse.status >= 400) {
        return reply.code(decisionResponse.status).send(decisionResponse.body);
      }
      const authorization = decisionData(decisionResponse);
      if (!authorization) {
        return dependencyUnavailable(reply, correlationId, logger, "identity");
      }
      try {
        const response = await dependencyRequest(
          fetcher,
          `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/appointments/${encodeURIComponent(request.params.appointmentId)}/cancel`,
          {
            method: "POST",
            actorId: "",
            correlationId,
            token: config.careToken,
            idempotencyKey,
            body: { authorization, request: appointmentRequest },
          },
        );
        return reply.code(response.status).send(response.body);
      } catch {
        return dependencyUnavailable(reply, correlationId, logger, "care");
      }
    },
  );

  app.get<{
    Params: { householdId: string };
    Querystring: Record<string, string | undefined>;
  }>("/api/v1/households/:householdId/timeline", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const query = DailyTimelineQuerySchema.parse(request.query);
    const requestDigest = digestJson({
      operation: "timeline.read",
      householdId: request.params.householdId,
      query,
    });
    const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
      correlationId,
      method: "POST",
      ...sessionOption(request.cookies[config.sessionCookieName]),
      body: {
        permission: "coordination.timeline.read",
        householdId: request.params.householdId,
        requestDigest,
      },
    });
    if (!decisionResponse) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    if (decisionResponse.status >= 400) {
      return reply.code(decisionResponse.status).send(decisionResponse.body);
    }
    const authorization = decisionData(decisionResponse);
    if (!authorization) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    try {
      const response = await dependencyRequest(
        fetcher,
        `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/timeline/query`,
        {
          method: "POST",
          actorId: "",
          correlationId,
          token: config.careToken,
          body: { authorization, query },
        },
      );
      return reply.code(response.status).send(response.body);
    } catch {
      return dependencyUnavailable(reply, correlationId, logger, "care");
    }
  });

  app.get<{
    Params: { householdId: string; taskId: string };
    Querystring: { displayTimeZone?: string };
  }>("/api/v1/households/:householdId/tasks/:taskId/handoff", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const displayTimeZone = IanaTimeZoneSchema.parse(
      request.query.displayTimeZone ?? "Asia/Bangkok",
    );
    const requestDigest = digestJson({
      operation: "handoff.review",
      householdId: request.params.householdId,
      taskId: request.params.taskId,
      displayTimeZone,
    });
    const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
      correlationId,
      method: "POST",
      ...sessionOption(request.cookies[config.sessionCookieName]),
      body: {
        permission: "coordination.task.handoff",
        householdId: request.params.householdId,
        taskId: request.params.taskId,
        requestDigest,
      },
    });
    if (!decisionResponse) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    if (decisionResponse.status >= 400) {
      return reply.code(decisionResponse.status).send(decisionResponse.body);
    }
    const authorization = decisionData(decisionResponse);
    if (!authorization) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    try {
      const response = await dependencyRequest(
        fetcher,
        `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/tasks/${encodeURIComponent(request.params.taskId)}/handoff/review`,
        {
          method: "POST",
          actorId: "",
          correlationId,
          token: config.careToken,
          body: { authorization, displayTimeZone },
        },
      );
      return reply.code(response.status).send(response.body);
    } catch {
      return dependencyUnavailable(reply, correlationId, logger, "care");
    }
  });

  app.post<{
    Params: { householdId: string; taskId: string };
    Body: unknown;
  }>("/api/v1/households/:householdId/tasks/:taskId/handoffs", async (request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    if (!validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    const handoffRequest = HandoffTaskRequestSchema.parse(request.body);
    const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
    const requestDigest = digestJson({
      operation: "task.handoff",
      householdId: request.params.householdId,
      taskId: request.params.taskId,
      request: handoffRequest,
    });
    const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
      correlationId,
      method: "POST",
      ...sessionOption(request.cookies[config.sessionCookieName]),
      csrfToken: String(request.headers["x-csrf-token"] ?? ""),
      body: {
        permission: "coordination.task.handoff",
        householdId: request.params.householdId,
        taskId: request.params.taskId,
        targetActorRef: handoffRequest.toActorRef,
        requestDigest,
      },
    });
    if (!decisionResponse) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    if (decisionResponse.status >= 400) {
      return reply.code(decisionResponse.status).send(decisionResponse.body);
    }
    const authorization = decisionData(decisionResponse);
    if (!authorization) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    try {
      const response = await dependencyRequest(
        fetcher,
        `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(request.params.householdId)}/tasks/${encodeURIComponent(request.params.taskId)}/handoffs`,
        {
          method: "POST",
          actorId: "",
          correlationId,
          token: config.careToken,
          idempotencyKey,
          body: { authorization, request: handoffRequest },
        },
      );
      return reply.code(response.status).send(response.body);
    } catch {
      return dependencyUnavailable(reply, correlationId, logger, "care");
    }
  });

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/documents",
    async (request, reply) => {
      const householdId = request.params.householdId;
      return authorizeAndForward(request, reply, {
        permission: "coordination.document_vault.list",
        householdId,
        requestDigest: digestJson({ operation: "document_vault.list", householdId }),
        dependency: "care",
        unavailableCode: "DOCUMENT_STORAGE_UNAVAILABLE",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/documents/query`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/documents",
    async (request, reply) => {
      const householdId = request.params.householdId;
      const uploadRequest = UploadDocumentRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return authorizeAndForward(request, reply, {
        permission: "coordination.document_vault.upload",
        householdId,
        requestDigest: digestJson({
          operation: "document_vault.upload",
          householdId,
          request: uploadRequest,
        }),
        dependency: "care",
        unavailableCode: "DOCUMENT_STORAGE_UNAVAILABLE",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/documents`,
        method: "POST",
        idempotencyKey,
        mutation: true,
        body: (authorization) => ({ authorization, request: uploadRequest }),
      });
    },
  );

  app.get<{ Params: { householdId: string; documentId: string } }>(
    "/api/v1/households/:householdId/documents/:documentId",
    async (request, reply) => {
      const { householdId, documentId } = request.params;
      return authorizeAndForward(request, reply, {
        permission: "coordination.document_vault.metadata.read",
        householdId,
        documentId,
        requestDigest: digestJson({
          operation: "document_vault.metadata.read",
          householdId,
          documentId,
        }),
        dependency: "care",
        unavailableCode: "DOCUMENT_STORAGE_UNAVAILABLE",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/documents/${encodeURIComponent(documentId)}/read`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.get<{ Params: { householdId: string; documentId: string } }>(
    "/api/v1/households/:householdId/documents/:documentId/content",
    async (request, reply) => {
      const { householdId, documentId } = request.params;
      return authorizeAndForward(request, reply, {
        permission: "coordination.document_vault.content.download",
        householdId,
        documentId,
        requestDigest: digestJson({
          operation: "document_vault.content.download",
          householdId,
          documentId,
        }),
        dependency: "care",
        unavailableCode: "DOCUMENT_STORAGE_UNAVAILABLE",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/documents/${encodeURIComponent(documentId)}/content/read`,
        method: "POST",
        binary: true,
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.delete<{
    Params: { householdId: string; documentId: string };
    Body: unknown;
  }>("/api/v1/households/:householdId/documents/:documentId", async (request, reply) => {
    const { householdId, documentId } = request.params;
    const deleteRequest = DeleteDocumentRequestSchema.parse(request.body);
    const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
    return authorizeAndForward(request, reply, {
      permission: "coordination.document_vault.delete",
      householdId,
      documentId,
      requestDigest: digestJson({
        operation: "document_vault.delete",
        householdId,
        documentId,
        request: deleteRequest,
      }),
      dependency: "care",
      unavailableCode: "DOCUMENT_STORAGE_UNAVAILABLE",
      targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/documents/${encodeURIComponent(documentId)}`,
      method: "DELETE",
      idempotencyKey,
      mutation: true,
      body: (authorization) => ({ authorization, request: deleteRequest }),
    });
  });

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/emergency-contacts",
    async (request, reply) => {
      const householdId = request.params.householdId;
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_contacts.read",
        householdId,
        requestDigest: digestJson({ operation: "emergency_contacts.read", householdId }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-contacts/read`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/emergency-contacts",
    async (request, reply) => {
      const householdId = request.params.householdId;
      const contactRequest = ReplaceEmergencyContactsRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_contacts.replace",
        householdId,
        requestDigest: digestJson({
          operation: "emergency_contacts.replace",
          householdId,
          request: contactRequest,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-contacts`,
        method: "PUT",
        idempotencyKey,
        mutation: true,
        body: (authorization) => ({ authorization, request: contactRequest }),
      });
    },
  );

  app.get<{ Params: { householdId: string }; Querystring: unknown }>(
    "/api/v1/households/:householdId/emergency-contacts/history",
    async (request, reply) => {
      const householdId = request.params.householdId;
      const query = EmergencyHistoryQuerySchema.parse(request.query);
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_contacts.history.read",
        householdId,
        requestDigest: digestJson({
          operation: "emergency_contacts.history",
          householdId,
          query,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-contacts/history/query`,
        method: "POST",
        body: (authorization) => ({ authorization, query }),
      });
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/emergency-plan",
    async (request, reply) => {
      const householdId = request.params.householdId;
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_plan.read",
        householdId,
        requestDigest: digestJson({ operation: "emergency_plan.read", householdId }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-plan/read`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/emergency-plan/draft",
    async (request, reply) => {
      const householdId = request.params.householdId;
      const draftRequest = SaveEmergencyPlanDraftRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_plan.draft.save",
        householdId,
        requestDigest: digestJson({
          operation: "emergency_plan.draft.save",
          householdId,
          request: draftRequest,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-plan/draft`,
        method: "PUT",
        idempotencyKey,
        mutation: true,
        body: (authorization) => ({ authorization, request: draftRequest }),
      });
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/emergency-plan/reviews",
    async (request, reply) => {
      const householdId = request.params.householdId;
      const reviewRequest = ReviewEmergencyPlanVersionRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_plan.version.review",
        householdId,
        requestDigest: digestJson({
          operation: "emergency_plan.version.review",
          householdId,
          request: reviewRequest,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-plan/reviews`,
        method: "POST",
        idempotencyKey,
        mutation: true,
        body: (authorization) => ({ authorization, request: reviewRequest }),
      });
    },
  );

  app.get<{ Params: { householdId: string }; Querystring: unknown }>(
    "/api/v1/households/:householdId/emergency-plan/history",
    async (request, reply) => {
      const householdId = request.params.householdId;
      const query = EmergencyHistoryQuerySchema.parse(request.query);
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_plan.history.read",
        householdId,
        requestDigest: digestJson({
          operation: "emergency_plan.history",
          householdId,
          query,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-plan/history/query`,
        method: "POST",
        body: (authorization) => ({ authorization, query }),
      });
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/emergency-plan/offline-snapshot",
    async (request, reply) => {
      const householdId = request.params.householdId;
      return authorizeAndForward(request, reply, {
        permission: "coordination.emergency_plan.offline_snapshot.read",
        householdId,
        requestDigest: digestJson({
          operation: "emergency_plan.offline_snapshot",
          householdId,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/emergency-plan/offline-snapshot/read`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/api/v1/households/:householdId/medication-reminders",
    async (request, reply) => {
      const householdId = request.params.householdId;
      return authorizeAndForward(request, reply, {
        permission: "coordination.medication_reminder.read",
        householdId,
        requestDigest: digestJson({ operation: "medication_reminder.list", householdId }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/medication-reminders/query`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.get<{ Params: { householdId: string; reminderId: string } }>(
    "/api/v1/households/:householdId/medication-reminders/:reminderId",
    async (request, reply) => {
      const { householdId, reminderId } = request.params;
      return authorizeAndForward(request, reply, {
        permission: "coordination.medication_reminder.read",
        householdId,
        medicationReminderId: reminderId,
        requestDigest: digestJson({
          operation: "medication_reminder.read",
          householdId,
          reminderId,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/medication-reminders/${encodeURIComponent(reminderId)}/read`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/api/v1/households/:householdId/medication-reminders",
    async (request, reply) => {
      const householdId = request.params.householdId;
      const reminderRequest = CreateMedicationReminderRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return authorizeAndForward(request, reply, {
        permission: "coordination.medication_reminder.create",
        householdId,
        requestDigest: digestJson({
          operation: "medication_reminder.create",
          householdId,
          request: reminderRequest,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/medication-reminders`,
        method: "POST",
        idempotencyKey,
        mutation: true,
        body: (authorization) => ({ authorization, request: reminderRequest }),
      });
    },
  );

  app.put<{
    Params: { householdId: string; reminderId: string };
    Body: unknown;
  }>("/api/v1/households/:householdId/medication-reminders/:reminderId", async (request, reply) => {
    const { householdId, reminderId } = request.params;
    const reminderRequest = ChangeMedicationReminderRequestSchema.parse(request.body);
    const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
    return authorizeAndForward(request, reply, {
      permission: "coordination.medication_reminder.change",
      householdId,
      medicationReminderId: reminderId,
      requestDigest: digestJson({
        operation: "medication_reminder.change",
        householdId,
        reminderId,
        request: reminderRequest,
      }),
      dependency: "care",
      targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/medication-reminders/${encodeURIComponent(reminderId)}`,
      method: "PUT",
      idempotencyKey,
      mutation: true,
      body: (authorization) => ({ authorization, request: reminderRequest }),
    });
  });

  app.post<{
    Params: { householdId: string; reminderId: string };
    Body: unknown;
  }>(
    "/api/v1/households/:householdId/medication-reminders/:reminderId/disable",
    async (request, reply) => {
      const { householdId, reminderId } = request.params;
      const reminderRequest = DisableMedicationReminderRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return authorizeAndForward(request, reply, {
        permission: "coordination.medication_reminder.disable",
        householdId,
        medicationReminderId: reminderId,
        requestDigest: digestJson({
          operation: "medication_reminder.disable",
          householdId,
          reminderId,
          request: reminderRequest,
        }),
        dependency: "care",
        targetUrl: `${config.careUrl}/internal/v1/coordination/households/${encodeURIComponent(householdId)}/medication-reminders/${encodeURIComponent(reminderId)}/disable`,
        method: "POST",
        idempotencyKey,
        mutation: true,
        body: (authorization) => ({ authorization, request: reminderRequest }),
      });
    },
  );

  app.get<{ Querystring: { householdId?: string } }>(
    "/api/v1/notifications/medication-reminders",
    async (request, reply) => {
      const householdId = String(request.query.householdId ?? "");
      return authorizeAndForward(request, reply, {
        permission: "notification.medication_reminder.read",
        householdId,
        requestDigest: digestJson({
          operation: "medication_notification.list",
          householdId,
        }),
        dependency: "notification",
        targetUrl: `${config.notificationUrl}/internal/v1/medication-reminders/households/${encodeURIComponent(householdId)}/query`,
        method: "POST",
        body: (authorization) => ({ authorization }),
      });
    },
  );

  app.post<{
    Params: { occurrenceId: string };
    Querystring: { householdId?: string };
    Body: unknown;
  }>(
    "/api/v1/notifications/medication-reminders/:occurrenceId/acknowledgements",
    async (request, reply) => {
      const householdId = String(request.query.householdId ?? "");
      const occurrenceId = request.params.occurrenceId;
      const acknowledgementRequest = AcknowledgeMedicationReminderRequestSchema.parse(request.body);
      const idempotencyKey = requiredIdempotencyKey(request.headers["idempotency-key"]);
      return authorizeAndForward(request, reply, {
        permission: "notification.medication_reminder.acknowledge",
        householdId,
        medicationOccurrenceId: occurrenceId,
        requestDigest: digestJson({
          operation: "medication_notification.acknowledge",
          householdId,
          occurrenceId,
          request: acknowledgementRequest,
        }),
        dependency: "notification",
        targetUrl: `${config.notificationUrl}/internal/v1/medication-reminders/households/${encodeURIComponent(householdId)}/occurrences/${encodeURIComponent(occurrenceId)}/acknowledgements`,
        method: "POST",
        idempotencyKey,
        mutation: true,
        body: (authorization) => ({ authorization, request: acknowledgementRequest }),
      });
    },
  );

  app.setErrorHandler(async (error, request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const idempotencyRequired = error instanceof IdempotencyKeyRequiredError;
    const validation = error instanceof Error && error.name === "ZodError";
    const bodyTooLarge =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "FST_ERR_CTP_BODY_TOO_LARGE" &&
      request.url.includes("/documents");
    const appointmentValidation =
      validation && (request.url.includes("/appointments") || request.url.includes("/calendar"));
    const carePlanValidation = validation && request.url.includes("/care-plan");
    const medicationValidation = validation && request.url.includes("/medication-reminders");
    const emergencyContactValidation = validation && request.url.includes("/emergency-contacts");
    const emergencyPlanValidation = validation && request.url.includes("/emergency-plan");
    const documentValidation = validation && request.url.includes("/documents");
    return reply.code(bodyTooLarge ? 413 : idempotencyRequired || validation ? 400 : 503).send({
      error: {
        code: bodyTooLarge
          ? "DOCUMENT_TOO_LARGE"
          : idempotencyRequired
            ? "IDEMPOTENCY_KEY_REQUIRED"
            : documentValidation
              ? "DOCUMENT_VALIDATION_FAILED"
              : emergencyContactValidation
                ? "EMERGENCY_CONTACT_VALIDATION_FAILED"
                : emergencyPlanValidation
                  ? "EMERGENCY_PLAN_VALIDATION_FAILED"
                  : medicationValidation
                    ? "MEDICATION_REMINDER_VALIDATION_FAILED"
                    : carePlanValidation
                      ? "CARE_PLAN_VALIDATION_FAILED"
                      : appointmentValidation
                        ? "APPOINTMENT_VALIDATION_FAILED"
                        : validation
                          ? "TASK_VALIDATION_FAILED"
                          : "SERVICE_UNAVAILABLE",
        messageKey: bodyTooLarge
          ? "errors.document.tooLarge"
          : idempotencyRequired
            ? "errors.idempotency.required"
            : documentValidation
              ? "errors.document.validation"
              : emergencyContactValidation
                ? "emergency_contacts.validation"
                : emergencyPlanValidation
                  ? "emergency_plan.validation"
                  : medicationValidation
                    ? "medication_reminder.validation"
                    : carePlanValidation
                      ? "care_plan.validation"
                      : appointmentValidation
                        ? "appointment.validation"
                        : validation
                          ? "errors.task.validation"
                          : "errors.service.unavailable",
        retryable: !bodyTooLarge && !idempotencyRequired && !validation,
        correlationId,
      },
    });
  });

  async function forwardCare(
    request: { headers: Record<string, unknown> },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    url: string,
    options: { method?: string; idempotencyKey?: string; body?: unknown } = {},
  ) {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const actor = actorId(request.headers, config.fixtureEnabled);
    try {
      const response = await dependencyRequest(fetcher, url, {
        actorId: actor,
        correlationId,
        token: config.careToken,
        ...(options.method ? { method: options.method } : {}),
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
        ...(options.body === undefined ? {} : { body: options.body }),
      });
      return reply.code(response.status).send(response.body);
    } catch {
      return dependencyUnavailable(reply, correlationId, logger, "care");
    }
  }

  async function authorizeAndForward(
    request: {
      headers: Record<string, unknown>;
      cookies: Record<string, string | undefined>;
      ip: string;
    },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    input: {
      permission: CoordinationPermission;
      householdId: string;
      medicationReminderId?: string;
      medicationOccurrenceId?: string;
      documentId?: string;
      requestDigest: string;
      dependency: "care" | "notification";
      targetUrl: string;
      method: string;
      idempotencyKey?: string;
      mutation?: boolean;
      binary?: boolean;
      unavailableCode?: "DOCUMENT_STORAGE_UNAVAILABLE";
      body: (authorization: ReturnType<typeof decisionData>) => unknown;
    },
  ) {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    if (input.mutation && !validBrowserMutation(request.headers)) {
      return rejectedBrowserMutation(reply, request.headers);
    }
    const decisionResponse = await callIdentity(request, "/internal/v1/coordination/authorize", {
      correlationId,
      method: "POST",
      ...sessionOption(request.cookies[config.sessionCookieName]),
      ...(input.mutation ? { csrfToken: String(request.headers["x-csrf-token"] ?? "") } : {}),
      body: {
        permission: input.permission,
        householdId: input.householdId,
        ...(input.medicationReminderId ? { medicationReminderId: input.medicationReminderId } : {}),
        ...(input.medicationOccurrenceId
          ? { medicationOccurrenceId: input.medicationOccurrenceId }
          : {}),
        ...(input.documentId ? { documentId: input.documentId } : {}),
        requestDigest: input.requestDigest,
      },
    });
    if (!decisionResponse) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    if (decisionResponse.status >= 400) {
      return reply.code(decisionResponse.status).send(decisionResponse.body);
    }
    const authorization = decisionData(decisionResponse);
    if (!authorization) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    try {
      if (input.binary) {
        const response = await binaryDependencyRequest(fetcher, input.targetUrl, {
          actorId: "",
          correlationId,
          token: config.careToken,
          body: input.body(authorization),
        });
        if (response.status >= 400) {
          return response.errorBody
            ? reply.code(response.status).send(response.errorBody)
            : dependencyUnavailable(
                reply,
                correlationId,
                logger,
                input.dependency,
                input.unavailableCode,
              );
        }
        const binaryReply = reply as typeof reply & {
          header: (name: string, value: string) => typeof reply;
        };
        binaryReply.header("content-type", "application/octet-stream");
        binaryReply.header("content-disposition", 'attachment; filename="document.txt"');
        binaryReply.header("x-content-type-options", "nosniff");
        binaryReply.header("content-security-policy", "sandbox");
        binaryReply.header("content-length", String(response.bytes.length));
        return reply.code(response.status).send(response.bytes);
      }
      const response = await dependencyRequest(fetcher, input.targetUrl, {
        method: input.method,
        actorId: "",
        correlationId,
        token: input.dependency === "care" ? config.careToken : config.notificationToken,
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        body: input.body(authorization),
      });
      return reply.code(response.status).send(response.body);
    } catch {
      return dependencyUnavailable(
        reply,
        correlationId,
        logger,
        input.dependency,
        input.unavailableCode,
      );
    }
  }

  async function callIdentity(
    request: {
      headers: Record<string, unknown>;
      ip: string;
    },
    internalPath: string,
    options: {
      correlationId?: string;
      method?: string;
      sessionToken?: string;
      csrfToken?: string;
      idempotencyKey?: string;
      body?: unknown;
    } = {},
  ): Promise<DependencyResponse | null> {
    const correlationId =
      options.correlationId ?? resolveCorrelationId(request.headers["x-correlation-id"]);
    try {
      return await identityRequest(fetcher, `${config.identityUrl}${internalPath}`, {
        correlationId,
        token: config.identityToken,
        sourceKey: request.ip,
        ...(options.method ? { method: options.method } : {}),
        ...(options.sessionToken ? { sessionToken: options.sessionToken } : {}),
        ...(options.csrfToken ? { csrfToken: options.csrfToken } : {}),
        ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
        ...(options.body === undefined ? {} : { body: options.body }),
      });
    } catch {
      return null;
    }
  }

  async function forwardIdentity(
    request: { headers: Record<string, unknown>; ip: string },
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    internalPath: string,
    options: {
      method?: string;
      sessionToken?: string;
      csrfToken?: string;
      idempotencyKey?: string;
      body?: unknown;
    } = {},
  ) {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const response = await callIdentity(request, internalPath, options);
    if (!response) {
      return dependencyUnavailable(reply, correlationId, logger, "identity");
    }
    return reply.code(response.status).send(response.body);
  }

  function sendSessionResponse(
    reply: {
      code: (status: number) => { send: (body: unknown) => unknown };
      setCookie: (
        name: string,
        value: string,
        options: ReturnType<typeof cookieOptions>,
      ) => unknown;
    },
    response: DependencyResponse,
  ) {
    const envelope = response.body as
      { data?: { sessionToken?: unknown; projection?: unknown }; meta?: unknown } | undefined;
    const token = envelope?.data?.sessionToken;
    if (response.status < 400 && typeof token === "string") {
      reply.setCookie(config.sessionCookieName, token, cookieOptions());
      return reply.code(response.status).send({
        data: envelope?.data?.projection,
        meta: envelope?.meta,
      });
    }
    return reply.code(response.status).send(response.body);
  }

  function cookieOptions() {
    return {
      path: "/",
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: "strict" as const,
      maxAge: 12 * 60 * 60,
    };
  }

  function sessionOption(value: string | undefined): { sessionToken?: string } {
    return value ? { sessionToken: value } : {};
  }

  function validBrowserMutation(headers: Record<string, unknown>): boolean {
    const origin = String(headers.origin ?? "");
    const fetchSite = String(headers["sec-fetch-site"] ?? "");
    return origin === config.publicOrigin && (fetchSite === "same-origin" || fetchSite === "none");
  }

  function rejectedBrowserMutation(
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
    headers: Record<string, unknown>,
  ) {
    const correlationId = resolveCorrelationId(headers["x-correlation-id"]);
    return reply.code(403).send({
      error: {
        code: "ORIGIN_REJECTED",
        messageKey: "origin.rejected",
        retryable: false,
        correlationId,
      },
    });
  }

  return app;
}

function requiredIdempotencyKey(value: unknown): string {
  if (value === undefined) {
    throw new IdempotencyKeyRequiredError();
  }
  return IdempotencyKeySchema.parse(value);
}

function digestJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function decisionData(response: DependencyResponse) {
  try {
    return CoordinationAuthorizationDecisionSchema.parse(
      (response.body as { data?: unknown } | null)?.data,
    );
  } catch {
    return null;
  }
}

function dependencyUnavailable(
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  correlationId: string,
  logger: SafeLogger,
  dependency: "care" | "notification" | "identity",
  overrideCode?: "DOCUMENT_STORAGE_UNAVAILABLE",
) {
  const code =
    overrideCode ??
    (dependency === "notification"
      ? "NOTIFICATION_UNAVAILABLE"
      : dependency === "identity"
        ? "IDENTITY_SERVICE_UNAVAILABLE"
        : "SERVICE_UNAVAILABLE");
  logger.emit({
    level: "warn",
    eventName: `${dependency}.unavailable`,
    operation: "dependency.request",
    result: "failed",
    correlationId,
    errorCode: code,
  });
  return reply.code(503).send({
    error: {
      code,
      messageKey:
        overrideCode === "DOCUMENT_STORAGE_UNAVAILABLE"
          ? "errors.document.storageUnavailable"
          : dependency === "notification"
            ? "errors.notification.unavailable"
            : dependency === "identity"
              ? "identity.unavailable"
              : "errors.service.unavailable",
      retryable: true,
      correlationId,
    },
  });
}
