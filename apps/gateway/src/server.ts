import {
  CompleteTaskRequestSchema,
  CreateTaskRequestSchema,
  IdempotencyKeySchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId, SafeLogger } from "@lifebridge/observability";
import { fixtureMember } from "@lifebridge/test-fixtures";
import Fastify from "fastify";

export interface GatewayConfig {
  careUrl: string;
  notificationUrl: string;
  careToken: string;
  notificationToken: string;
  fixtureEnabled: boolean;
}

type Fetcher = typeof fetch;

class DependencyResponse {
  public constructor(
    public readonly status: number,
    public readonly body: unknown,
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

export function buildGatewayServer(
  config: GatewayConfig,
  fetcher: Fetcher = fetch,
  logger = new SafeLogger("gateway"),
) {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

  app.get("/health/live", async () => ({ status: "live" }));
  app.get("/version", async () => ({ service: "gateway", contract: "P1-S1-v1" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      const care = await fetcher(`${config.careUrl}/health/ready`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (!care.ok) {
        return reply.code(503).send({ status: "not_ready", dependency: "care" });
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

  app.setErrorHandler(async (error, request, reply) => {
    const correlationId = resolveCorrelationId(request.headers["x-correlation-id"]);
    const idempotencyRequired = error instanceof IdempotencyKeyRequiredError;
    const validation = error instanceof Error && error.name === "ZodError";
    return reply.code(idempotencyRequired || validation ? 400 : 503).send({
      error: {
        code: idempotencyRequired
          ? "IDEMPOTENCY_KEY_REQUIRED"
          : validation
            ? "TASK_VALIDATION_FAILED"
            : "SERVICE_UNAVAILABLE",
        messageKey: idempotencyRequired
          ? "errors.idempotency.required"
          : validation
            ? "errors.task.validation"
            : "errors.service.unavailable",
        retryable: !idempotencyRequired && !validation,
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

  return app;
}

function requiredIdempotencyKey(value: unknown): string {
  if (value === undefined) {
    throw new IdempotencyKeyRequiredError();
  }
  return IdempotencyKeySchema.parse(value);
}

function dependencyUnavailable(
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  correlationId: string,
  logger: SafeLogger,
  dependency: "care" | "notification",
) {
  logger.emit({
    level: "warn",
    eventName: `${dependency}.unavailable`,
    operation: "dependency.request",
    result: "failed",
    correlationId,
    errorCode: dependency === "notification" ? "NOTIFICATION_UNAVAILABLE" : "SERVICE_UNAVAILABLE",
  });
  return reply.code(503).send({
    error: {
      code: dependency === "notification" ? "NOTIFICATION_UNAVAILABLE" : "SERVICE_UNAVAILABLE",
      messageKey:
        dependency === "notification"
          ? "errors.notification.unavailable"
          : "errors.service.unavailable",
      retryable: true,
      correlationId,
    },
  });
}
