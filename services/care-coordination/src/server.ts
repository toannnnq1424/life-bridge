import {
  CalendarQuerySchema,
  CancelAppointmentRequestSchema,
  ChangeAppointmentRequestSchema,
  CoordinationAuthorizationDecisionSchema,
  CreateAppointmentRequestSchema,
  DailyTimelineQuerySchema,
  CompleteTaskRequestSchema,
  CreateTaskRequestSchema,
  HandoffTaskRequestSchema,
  IdempotencyKeySchema,
  IanaTimeZoneSchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import { CareError } from "./errors.js";
import type { AppointmentService } from "./appointment-service.js";
import type { CoordinationService } from "./coordination-service.js";
import type { CareService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): unknown {
  return request.headers[name];
}

export function buildCareServer(
  care: CareService,
  internalToken: string,
  coordination?: CoordinationService,
  appointments?: AppointmentService,
) {
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
  app.get("/version", async () => ({ service: "care-coordination", contract: "P3-S2-v1" }));

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/calendar/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireAppointments(appointments).calendar({
          householdId: request.params.householdId,
          query: CalendarQuerySchema.parse(body.query),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; appointmentId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/appointments/:appointmentId/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireAppointments(appointments).get({
          householdId: request.params.householdId,
          appointmentId: request.params.appointmentId,
          permission: "coordination.calendar.read",
          operation: "appointment.read",
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/appointments",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      const result = await requireAppointments(appointments).create({
        householdId: request.params.householdId,
        request: CreateAppointmentRequestSchema.parse(body.request),
        idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
        authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
        correlationId,
      });
      return reply.code(201).send(successEnvelope(result, correlationId));
    },
  );

  app.patch<{ Params: { householdId: string; appointmentId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/appointments/:appointmentId",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireAppointments(appointments).change({
          householdId: request.params.householdId,
          appointmentId: request.params.appointmentId,
          request: ChangeAppointmentRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; appointmentId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/appointments/:appointmentId/cancel",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireAppointments(appointments).cancel({
          householdId: request.params.householdId,
          appointmentId: request.params.appointmentId,
          request: CancelAppointmentRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/timeline/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCoordination(coordination).dailyTimeline({
          householdId: request.params.householdId,
          query: DailyTimelineQuerySchema.parse(body.query),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; taskId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/tasks/:taskId/handoff/review",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCoordination(coordination).handoffReview({
          householdId: request.params.householdId,
          taskId: request.params.taskId,
          displayTimeZone: IanaTimeZoneSchema.parse(body.displayTimeZone),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; taskId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/tasks/:taskId/handoffs",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCoordination(coordination).handoff({
          householdId: request.params.householdId,
          taskId: request.params.taskId,
          request: HandoffTaskRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

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
    const appointmentValidation =
      errorName === "ZodError" &&
      (request.url.includes("/appointments") || request.url.includes("/calendar"));
    const careError =
      error instanceof CareError
        ? error
        : new CareError(
            errorName === "ZodError" ? 400 : 500,
            appointmentValidation
              ? "APPOINTMENT_VALIDATION_FAILED"
              : errorName === "ZodError"
                ? "TASK_VALIDATION_FAILED"
                : "SERVICE_UNAVAILABLE",
            appointmentValidation
              ? "appointment.validation"
              : errorName === "ZodError"
                ? "errors.task.validation"
                : "errors.service.unavailable",
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
        ...(careError.currentAppointment
          ? { currentAppointment: careError.currentAppointment }
          : {}),
        ...(careError.conflict ? { conflict: careError.conflict } : {}),
        ...(careError.recoveryAction ? { recoveryAction: careError.recoveryAction } : {}),
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

function requireCoordination(service: CoordinationService | undefined): CoordinationService {
  if (!service) throw new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
  return service;
}

function requireAppointments(service: AppointmentService | undefined): AppointmentService {
  if (!service) throw new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
  return service;
}

function coordinationBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CareError(400, "HANDOFF_VALIDATION_FAILED", "handoff.validation");
  }
  return value as Record<string, unknown>;
}
