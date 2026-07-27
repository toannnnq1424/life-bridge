import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import { EventIdReusedError, type NotificationService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): unknown {
  return request.headers[name];
}

export function buildNotificationServer(service: NotificationService, internalToken: string) {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/internal/")) {
      if (header(request, "x-internal-service-token") !== internalToken) {
        await reply.code(404).send();
      }
    }
  });

  app.get("/health/live", async () => ({ status: "live" }));
  app.get("/health/ready", async (_request, reply) =>
    (await service.isReady())
      ? { status: "ready" }
      : reply.code(503).send({ status: "not_ready", dependency: "notification_database" }),
  );
  app.get("/version", async () => ({ service: "notification", contract: "P3-S2-v1" }));

  app.post<{ Body: unknown }>("/internal/v1/events/care-task-completed", async (request) =>
    service.consume(request.body),
  );
  app.post<{ Body: unknown }>("/internal/v1/events/care-coordination", async (request) =>
    service.consume(request.body),
  );

  app.get("/internal/v1/notifications", async (request) => {
    const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
    const recipientId = String(header(request, "x-actor-id") ?? "");
    return {
      data: await service.list(recipientId),
      meta: { correlationId },
    };
  });

  app.setErrorHandler(async (error, request, reply) => {
    const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
    const eventReuse = error instanceof EventIdReusedError;
    const validation = error instanceof Error && error.name === "ZodError";
    return reply.code(eventReuse ? 409 : validation ? 400 : 500).send({
      error: {
        code: eventReuse ? "EVENT_ID_REUSED" : "INTERNAL_CONTRACT_INVALID",
        messageKey: eventReuse ? "errors.event.reused" : "errors.contract.invalid",
        retryable: !eventReuse,
        correlationId,
      },
    });
  });

  return app;
}
