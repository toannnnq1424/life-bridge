import {
  AcknowledgeMedicationReminderRequestSchema,
  CareCoordinationEventSchema,
  CoordinationAuthorizationDecisionSchema,
  IdempotencyKeySchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import {
  type MedicationReminderNotificationService,
  NotificationBoundaryError,
} from "./medication-reminder-service.js";
import { EventIdReusedError, type NotificationService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): unknown {
  return request.headers[name];
}

export function buildNotificationServer(
  service: NotificationService,
  internalToken: string,
  medicationReminders?: MedicationReminderNotificationService,
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
  app.get("/health/ready", async (_request, reply) => {
    const ready =
      (await service.isReady()) && (!medicationReminders || (await medicationReminders.isReady()));
    return ready
      ? { status: "ready" }
      : reply.code(503).send({ status: "not_ready", dependency: "notification_database" });
  });
  app.get("/version", async () => ({ service: "notification", contract: "P4-S1-v1" }));

  app.post<{ Body: unknown }>("/internal/v1/events/care-task-completed", async (request) =>
    service.consume(request.body),
  );
  app.post<{ Body: unknown }>("/internal/v1/events/care-coordination", async (request) => {
    const event = CareCoordinationEventSchema.parse(request.body);
    return event.eventType === "care.medication_reminder.intent.v1"
      ? requireMedicationReminders(medicationReminders).consume(event)
      : service.consume(event);
  });

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/medication-reminders/households/:householdId/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = recordBody(request.body);
      return successEnvelope(
        await requireMedicationReminders(medicationReminders).list({
          householdId: request.params.householdId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{
    Params: { householdId: string; occurrenceId: string };
    Body: unknown;
  }>(
    "/internal/v1/medication-reminders/households/:householdId/occurrences/:occurrenceId/acknowledgements",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = recordBody(request.body);
      return successEnvelope(
        await requireMedicationReminders(medicationReminders).acknowledge({
          householdId: request.params.householdId,
          occurrenceId: request.params.occurrenceId,
          request: AcknowledgeMedicationReminderRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Body: unknown }>("/internal/v1/medication-reminders/process-due", async (request) => {
    const body = recordBody(request.body);
    const mode =
      body.mode === "deliver" || body.mode === "fail" || body.mode === "uncertain"
        ? body.mode
        : "deliver";
    return {
      processed: await requireMedicationReminders(medicationReminders).processDue(mode),
    };
  });

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
    const boundary = error instanceof NotificationBoundaryError ? error : null;
    const validation = error instanceof Error && error.name === "ZodError";
    return reply
      .code(boundary ? boundary.statusCode : eventReuse ? 409 : validation ? 400 : 500)
      .send({
        error: {
          code: boundary
            ? boundary.code
            : eventReuse
              ? "EVENT_ID_REUSED"
              : "INTERNAL_CONTRACT_INVALID",
          messageKey: boundary
            ? boundary.messageKey
            : eventReuse
              ? "errors.event.reused"
              : "errors.contract.invalid",
          retryable: boundary ? boundary.retryable : !eventReuse,
          correlationId,
        },
      });
  });

  return app;
}

function requireMedicationReminders(
  service: MedicationReminderNotificationService | undefined,
): MedicationReminderNotificationService {
  if (!service) {
    throw new NotificationBoundaryError(
      503,
      "MEDICATION_NOTIFICATION_UNAVAILABLE",
      "medication_notification.unavailable",
      true,
    );
  }
  return service;
}

function recordBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new NotificationBoundaryError(
      400,
      "MEDICATION_REMINDER_VALIDATION_FAILED",
      "medication_notification.validation",
    );
  }
  return value as Record<string, unknown>;
}

function requiredIdempotencyKey(value: unknown): string {
  if (value === undefined) {
    throw new NotificationBoundaryError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "errors.idempotency.required",
    );
  }
  return IdempotencyKeySchema.parse(value);
}
