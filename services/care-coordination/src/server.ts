import {
  CalendarQuerySchema,
  CarePlanHistoryQuerySchema,
  CancelAppointmentRequestSchema,
  ChangeAppointmentRequestSchema,
  ChangeMedicationReminderRequestSchema,
  CoordinationAuthorizationDecisionSchema,
  CreateAppointmentRequestSchema,
  CreateMedicationReminderRequestSchema,
  ConfirmCarePlanVersionRequestSchema,
  DailyTimelineQuerySchema,
  CompleteTaskRequestSchema,
  CreateTaskRequestSchema,
  HandoffTaskRequestSchema,
  IdempotencyKeySchema,
  IanaTimeZoneSchema,
  DisableMedicationReminderRequestSchema,
  DeleteDocumentRequestSchema,
  EmergencyHistoryQuerySchema,
  ReplaceEmergencyContactsRequestSchema,
  ReviewEmergencyPlanVersionRequestSchema,
  SaveCarePlanDraftRequestSchema,
  SaveEmergencyPlanDraftRequestSchema,
  UploadDocumentRequestSchema,
  successEnvelope,
} from "@lifebridge/contracts";
import { resolveCorrelationId } from "@lifebridge/observability";
import Fastify from "fastify";

import { CareError } from "./errors.js";
import type { AppointmentService } from "./appointment-service.js";
import type { CarePlanService } from "./care-plan-service.js";
import type { CoordinationService } from "./coordination-service.js";
import type { EmergencyReadinessService } from "./emergency-readiness-service.js";
import type { DocumentVaultService } from "./document-vault-service.js";
import type { MedicationReminderService } from "./medication-reminder-service.js";
import type { CareService } from "./service.js";

function header(request: { headers: Record<string, unknown> }, name: string): unknown {
  return request.headers[name];
}

export function buildCareServer(
  care: CareService,
  internalToken: string,
  coordination?: CoordinationService,
  appointments?: AppointmentService,
  carePlans?: CarePlanService,
  medicationReminders?: MedicationReminderService,
  emergencyReadiness?: EmergencyReadinessService,
  documentVault?: DocumentVaultService,
) {
  const app = Fastify({ logger: false, bodyLimit: 512 * 1024 });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("cache-control", "no-store");
    reply.header("pragma", "no-cache");
  });

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
  app.get("/version", async () => ({ service: "care-coordination", contract: "P4-S3-v1" }));

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/documents/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireDocumentVault(documentVault).list({
          householdId: request.params.householdId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/documents",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      const result = await requireDocumentVault(documentVault).upload({
        householdId: request.params.householdId,
        request: UploadDocumentRequestSchema.parse(body.request),
        idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
        authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
        correlationId,
      });
      return reply.code(201).send(successEnvelope(result, correlationId));
    },
  );

  app.post<{ Params: { householdId: string; documentId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/documents/:documentId/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireDocumentVault(documentVault).get({
          householdId: request.params.householdId,
          documentId: request.params.documentId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; documentId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/documents/:documentId/content/read",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      const result = await requireDocumentVault(documentVault).download({
        householdId: request.params.householdId,
        documentId: request.params.documentId,
        authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
        correlationId,
      });
      const encodedName = encodeURIComponent(result.metadata.displayName);
      return reply
        .header("content-type", "application/octet-stream")
        .header(
          "content-disposition",
          `attachment; filename="document.txt"; filename*=UTF-8''${encodedName}`,
        )
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "sandbox")
        .header("content-length", String(result.bytes.length))
        .send(result.bytes);
    },
  );

  app.delete<{ Params: { householdId: string; documentId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/documents/:documentId",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireDocumentVault(documentVault).delete({
          householdId: request.params.householdId,
          documentId: request.params.documentId,
          request: DeleteDocumentRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-contacts/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).readContacts({
          householdId: request.params.householdId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-contacts",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).replaceContacts({
          householdId: request.params.householdId,
          request: ReplaceEmergencyContactsRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-contacts/history/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).contactHistory({
          householdId: request.params.householdId,
          query: EmergencyHistoryQuerySchema.parse(body.query),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-plan/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).readPlan({
          householdId: request.params.householdId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-plan/draft",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).saveDraft({
          householdId: request.params.householdId,
          request: SaveEmergencyPlanDraftRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-plan/reviews",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).reviewVersion({
          householdId: request.params.householdId,
          request: ReviewEmergencyPlanVersionRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-plan/history/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).planHistory({
          householdId: request.params.householdId,
          query: EmergencyHistoryQuerySchema.parse(body.query),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/emergency-plan/offline-snapshot/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireEmergencyReadiness(emergencyReadiness).offlineSnapshot({
          householdId: request.params.householdId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/medication-reminders/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
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

  app.post<{ Params: { householdId: string; reminderId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/medication-reminders/:reminderId/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireMedicationReminders(medicationReminders).get({
          householdId: request.params.householdId,
          reminderId: request.params.reminderId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/medication-reminders",
    async (request, reply) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      const result = await requireMedicationReminders(medicationReminders).create({
        householdId: request.params.householdId,
        request: CreateMedicationReminderRequestSchema.parse(body.request),
        idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
        authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
        correlationId,
      });
      return reply.code(201).send(successEnvelope(result, correlationId));
    },
  );

  app.put<{ Params: { householdId: string; reminderId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/medication-reminders/:reminderId",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireMedicationReminders(medicationReminders).change({
          householdId: request.params.householdId,
          reminderId: request.params.reminderId,
          request: ChangeMedicationReminderRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; reminderId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/medication-reminders/:reminderId/disable",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireMedicationReminders(medicationReminders).disable({
          householdId: request.params.householdId,
          reminderId: request.params.reminderId,
          request: DisableMedicationReminderRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/care-plan/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCarePlans(carePlans).read({
          householdId: request.params.householdId,
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/care-plan/history/query",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCarePlans(carePlans).history({
          householdId: request.params.householdId,
          query: CarePlanHistoryQuerySchema.parse(body.query),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string; planVersion: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/care-plan/versions/:planVersion/read",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCarePlans(carePlans).version({
          householdId: request.params.householdId,
          planVersion: Number(request.params.planVersion),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.put<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/care-plan/draft",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCarePlans(carePlans).saveDraft({
          householdId: request.params.householdId,
          request: SaveCarePlanDraftRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

  app.post<{ Params: { householdId: string }; Body: unknown }>(
    "/internal/v1/coordination/households/:householdId/care-plan/current",
    async (request) => {
      const correlationId = resolveCorrelationId(header(request, "x-correlation-id"));
      const body = coordinationBody(request.body);
      return successEnvelope(
        await requireCarePlans(carePlans).confirm({
          householdId: request.params.householdId,
          request: ConfirmCarePlanVersionRequestSchema.parse(body.request),
          idempotencyKey: requiredIdempotencyKey(header(request, "idempotency-key")),
          authorization: CoordinationAuthorizationDecisionSchema.parse(body.authorization),
          correlationId,
        }),
        correlationId,
      );
    },
  );

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
    const bodyTooLarge =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "FST_ERR_CTP_BODY_TOO_LARGE" &&
      request.url.includes("/documents");
    const appointmentValidation =
      errorName === "ZodError" &&
      (request.url.includes("/appointments") || request.url.includes("/calendar"));
    const carePlanValidation = errorName === "ZodError" && request.url.includes("/care-plan");
    const medicationValidation =
      errorName === "ZodError" && request.url.includes("/medication-reminders");
    const emergencyContactValidation =
      errorName === "ZodError" && request.url.includes("/emergency-contacts");
    const emergencyPlanValidation =
      errorName === "ZodError" && request.url.includes("/emergency-plan");
    const documentRoute = request.url.includes("/documents");
    const documentValidation = errorName === "ZodError" && documentRoute;
    const careError =
      error instanceof CareError
        ? error
        : bodyTooLarge
          ? new CareError(413, "DOCUMENT_TOO_LARGE", "errors.document.tooLarge", false)
          : new CareError(
              errorName === "ZodError" ? 400 : documentRoute ? 503 : 500,
              documentValidation
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
                          : errorName === "ZodError"
                            ? "TASK_VALIDATION_FAILED"
                            : documentRoute
                              ? "DOCUMENT_STORAGE_UNAVAILABLE"
                              : "SERVICE_UNAVAILABLE",
              documentValidation
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
                          : errorName === "ZodError"
                            ? "errors.task.validation"
                            : documentRoute
                              ? "errors.document.storageUnavailable"
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

function requireCarePlans(service: CarePlanService | undefined): CarePlanService {
  if (!service) throw new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
  return service;
}

function requireMedicationReminders(
  service: MedicationReminderService | undefined,
): MedicationReminderService {
  if (!service) throw new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
  return service;
}

function requireEmergencyReadiness(
  service: EmergencyReadinessService | undefined,
): EmergencyReadinessService {
  if (!service) throw new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
  return service;
}

function requireDocumentVault(service: DocumentVaultService | undefined): DocumentVaultService {
  if (!service) throw new CareError(503, "SERVICE_UNAVAILABLE", "errors.service.unavailable", true);
  return service;
}

function coordinationBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CareError(400, "HANDOFF_VALIDATION_FAILED", "handoff.validation");
  }
  return value as Record<string, unknown>;
}
