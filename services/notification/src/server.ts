import {
  AcknowledgeMedicationReminderRequestSchema,
  CareCoordinationEventSchema,
  CoordinationAuthorizationDecisionSchema,
  currentCoordinationAuthorization,
  IdempotencyKeySchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";
import { verifyServiceAssertion } from "@lifebridge/config";

import {
  type MedicationReminderNotificationService,
  NotificationBoundaryError,
} from "./medication-reminder-service.js";
import { EventIdReusedError, OutOfOrderEventError, type NotificationService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): unknown {
  return request.headers[name];
}

export function buildNotificationServer(
  service: NotificationService,
  internalToken: string,
  medicationReminders?: MedicationReminderNotificationService,
  enforceServiceIdentity = false,
  careInternalToken = internalToken,
  previousInternalToken?: string,
  previousCareInternalToken?: string,
  recoveryInternalToken = internalToken,
) {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

  app.addHook("preHandler", async (request, reply) => {
    if (request.url.startsWith("/internal/")) {
      const recoveryRoute = request.url.startsWith("/internal/v1/event-recovery/");
      const eventRoute = request.url.startsWith("/internal/v1/events/");
      const identity = verifyServiceAssertion(header(request, "x-lifebridge-service-identity"), {
        audience: "notification",
        scope: recoveryRoute
          ? "event.reconciliation"
          : eventRoute
            ? "notification.events"
            : "notification.read",
        allowedCallers: recoveryRoute
          ? ["recovery-operator"]
          : eventRoute
            ? ["care-coordination"]
            : ["gateway"],
        keys: recoveryRoute
          ? { "recovery-current": recoveryInternalToken }
          : eventRoute
            ? {
                "care-current": careInternalToken,
                ...(previousCareInternalToken
                  ? { "care-previous": previousCareInternalToken }
                  : {}),
              }
            : {
                "gateway-current": internalToken,
                ...(previousInternalToken ? { "gateway-previous": previousInternalToken } : {}),
              },
      });
      const legacy = header(request, "x-internal-service-token") === internalToken;
      if (!(identity || (!enforceServiceIdentity && legacy))) {
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

  app.get<{ Params: { eventId: string } }>(
    "/internal/v1/event-recovery/events/:eventId",
    async (request, reply) => {
      const evidence = await service.receiptEvidence(request.params.eventId);
      return evidence ? evidence : reply.code(404).send();
    },
  );

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

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/authorized/households/:householdId/notifications/query",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = recordBody(request.body);
      const expectedDigest = createHash("sha256")
        .update(
          JSON.stringify({
            operation: "notification.task.read",
            householdId: request.params.householdId,
          }),
          "utf8",
        )
        .digest("hex");
      const decision = currentCoordinationAuthorization(body.authorization, {
        permission: "notification.task.read",
        householdId: request.params.householdId,
        correlationId,
        requestDigest: expectedDigest,
      });
      if (!decision) {
        return reply.code(404).send();
      }
      return {
        data: await service.list(decision.actor.actorId),
        meta: { correlationId },
      };
    },
  );

  app.setErrorHandler(async (error, request, reply) => {
    const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
    const eventReuse = error instanceof EventIdReusedError;
    const outOfOrder = error instanceof OutOfOrderEventError;
    const boundary = error instanceof NotificationBoundaryError ? error : null;
    const validation = error instanceof Error && error.name === "ZodError";
    return reply
      .code(
        boundary ? boundary.statusCode : eventReuse || outOfOrder ? 409 : validation ? 400 : 500,
      )
      .send({
        error: {
          code: boundary
            ? boundary.code
            : eventReuse
              ? "EVENT_ID_REUSED"
              : outOfOrder
                ? "OUT_OF_ORDER_EVENT"
                : "INTERNAL_CONTRACT_INVALID",
          messageKey: boundary
            ? boundary.messageKey
            : eventReuse
              ? "errors.event.reused"
              : outOfOrder
                ? "errors.event.outOfOrder"
                : "errors.contract.invalid",
          retryable: boundary ? boundary.retryable : !(eventReuse || outOfOrder),
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
import { createHash } from "node:crypto";
