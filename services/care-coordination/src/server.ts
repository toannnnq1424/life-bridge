import {
  CompleteTaskRequestSchema,
  CreateTaskRequestSchema,
  IdempotencyKeySchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import { CareError } from "./errors.js";
import type { CareService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): unknown {
  return request.headers[name];
}

export function buildCareServer(care: CareService, internalToken: string) {
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
    (await care.isReady())
      ? { status: "ready" }
      : reply.code(503).send({ status: "not_ready", dependency: "care_database" }),
  );
  app.get("/version", async () => ({ service: "care-coordination", contract: "P1-S1-v1" }));

  app.get<{ Params: { householdId: string } }>(
    "/internal/v1/households/:householdId/members",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const actorId = String(header(request, "x-actor-id") ?? "");
      return successEnvelope(care.listMembers(actorId, request.params.householdId), correlationId);
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/internal/v1/households/:householdId/tasks",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const actorId = String(header(request, "x-actor-id") ?? "");
      return successEnvelope(
        await care.listTasks(actorId, request.params.householdId),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/households/:householdId/tasks",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const actorId = String(header(request, "x-actor-id") ?? "");
      const idempotencyKey = requiredIdempotencyKey(header(request, "idempotency-key"));
      const result = await care.createTask({
        actorId,
        householdId: request.params.householdId,
        idempotencyKey,
        correlationId,
        request: CreateTaskRequestSchema.parse(request.body),
      });
      return reply.code(result.statusCode).send(successEnvelope(result.task, correlationId));
    },
  );

  app.get<{ Params: { taskId: string } }>("/internal/v1/tasks/:taskId", async (request) => {
    const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
    const actorId = String(header(request, "x-actor-id") ?? "");
    return successEnvelope(await care.getTask(actorId, request.params.taskId), correlationId);
  });

  app.patch<{ Params: { taskId: string }; Body: unknown }>(
    "/internal/v1/tasks/:taskId",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const actorId = String(header(request, "x-actor-id") ?? "");
      const idempotencyKey = requiredIdempotencyKey(header(request, "idempotency-key"));
      return successEnvelope(
        await care.completeTask({
          actorId,
          taskId: request.params.taskId,
          idempotencyKey,
          correlationId,
          request: CompleteTaskRequestSchema.parse(request.body),
        }),
        correlationId,
      );
    },
  );

  app.get<{ Params: { householdId: string } }>(
    "/internal/v1/households/:householdId/dashboard",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const actorId = String(header(request, "x-actor-id") ?? "");
      const tasks = await care.listTasks(actorId, request.params.householdId);
      const ordered = [...tasks].sort(
        (left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
      );
      return successEnvelope(
        {
          openCount: tasks.filter((task) => task.status === "open").length,
          completedCount: tasks.filter((task) => task.status === "completed").length,
          nextTasks: ordered.slice(0, 5),
          lastConfirmedAt:
            tasks
              .map((task) => task.completedAt ?? task.createdAt)
              .sort()
              .at(-1) ?? null,
          taskSourceFreshness: "current" as const,
        },
        correlationId,
      );
    },
  );

  app.setErrorHandler(async (error, request, reply) => {
    const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const careError =
      error instanceof CareError
        ? error
        : new CareError(
            errorName === "ZodError" ? 400 : 500,
            errorName === "ZodError" ? "TASK_VALIDATION_FAILED" : "SERVICE_UNAVAILABLE",
            errorName === "ZodError" ? "errors.task.validation" : "errors.service.unavailable",
            errorName !== "ZodError",
          );
    return reply.code(careError.statusCode).send({
      error: {
        code: careError.code,
        messageKey: careError.messageKey,
        ...(careError.fieldErrors ? { fieldErrors: careError.fieldErrors } : {}),
        retryable: careError.retryable,
        correlationId,
        ...(careError.currentTask
          ? { currentTask: careError.currentTask, recoveryAction: "reload_current" }
          : {}),
      },
    });
  });

  return app;
}

function requiredIdempotencyKey(value: unknown): string {
  if (value === undefined) {
    throw new CareError(400, "IDEMPOTENCY_KEY_REQUIRED", "errors.idempotency.required", false);
  }
  return IdempotencyKeySchema.parse(value);
}
