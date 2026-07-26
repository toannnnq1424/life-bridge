import { z } from "zod";

const opaqueIdPattern = /^[a-z][a-z0-9_-]{2,79}$/;
const correlationIdPattern = /^[A-Za-z0-9_-]{8,80}$/;
const idempotencyPattern = /^[\x21-\x7E]{8,128}$/;

export const OpaqueIdSchema = z.string().regex(opaqueIdPattern);
export const CorrelationIdSchema = z.string().regex(correlationIdPattern);
export const IdempotencyKeySchema = z.string().regex(idempotencyPattern);
export const LocaleSchema = z.enum(["vi-VN", "en"]);
export const PrioritySchema = z.enum(["normal", "important", "urgent"]);
export const TaskStatusSchema = z.enum(["open", "completed"]);
export const NotificationDeliverySchema = z.enum([
  "not_started",
  "pending",
  "retrying",
  "failed",
  "delivered",
  "suppressed",
]);

export function isIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export const IanaTimeZoneSchema = z.string().min(1).max(80).refine(isIanaTimeZone, {
  message: "invalid_time_zone",
});

export const MemberSchema = z
  .object({
    memberId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    displayNameKey: z.string().min(1).max(80),
    role: z.enum(["caregiver", "member"]),
    active: z.boolean(),
  })
  .strict();

export const CreateTaskRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional().default(""),
    assigneeId: OpaqueIdSchema,
    careRecipientId: OpaqueIdSchema,
    dueAt: z.iso.datetime({ offset: true }),
    dueTimeZone: IanaTimeZoneSchema,
    priority: PrioritySchema,
  })
  .strict();

export const CompleteTaskRequestSchema = z
  .object({
    operation: z.literal("complete"),
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export const TaskProjectionSchema = z
  .object({
    taskId: OpaqueIdSchema,
    householdId: OpaqueIdSchema,
    careRecipientId: OpaqueIdSchema,
    title: z.string().min(1).max(120),
    description: z.string().max(500),
    assigneeId: OpaqueIdSchema,
    createdBy: OpaqueIdSchema,
    dueAt: z.iso.datetime({ offset: true }),
    dueTimeZone: IanaTimeZoneSchema,
    priority: PrioritySchema,
    status: TaskStatusSchema,
    version: z.number().int().positive(),
    createdAt: z.iso.datetime({ offset: true }),
    completedBy: OpaqueIdSchema.nullable(),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    notificationDelivery: NotificationDeliverySchema,
  })
  .strict();

const EventBaseSchema = z
  .object({
    eventId: OpaqueIdSchema,
    eventType: z.literal("care.task.completed.v1"),
    eventVersion: z.literal(1),
    occurredAt: z.iso.datetime({ offset: true }),
    producer: z.literal("care-coordination"),
    aggregateId: OpaqueIdSchema,
    aggregateVersion: z.number().int().positive(),
    correlationId: CorrelationIdSchema,
    causationId: OpaqueIdSchema,
  })
  .strict();

const DeliverPayloadSchema = z
  .object({
    householdId: OpaqueIdSchema,
    notificationDisposition: z.literal("deliver"),
    recipientId: OpaqueIdSchema,
    completedBy: OpaqueIdSchema,
    completedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine((value) => value.recipientId !== value.completedBy, {
    message: "recipient_must_differ_from_completer",
    path: ["recipientId"],
  });

const SuppressPayloadSchema = z
  .object({
    householdId: OpaqueIdSchema,
    notificationDisposition: z.literal("suppress_self"),
    completedBy: OpaqueIdSchema,
    completedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const CareTaskCompletedEventSchema = EventBaseSchema.extend({
  payload: z.discriminatedUnion("notificationDisposition", [
    DeliverPayloadSchema,
    SuppressPayloadSchema,
  ]),
}).strict();

export const NotificationSchema = z
  .object({
    notificationId: OpaqueIdSchema,
    recipientId: OpaqueIdSchema,
    sourceEventId: OpaqueIdSchema,
    sourceTaskId: OpaqueIdSchema,
    messageKey: z.literal("notifications.task.completed"),
    messageParams: z
      .object({
        taskId: OpaqueIdSchema,
      })
      .strict(),
    read: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ConsumerAcknowledgementSchema = z
  .object({
    eventId: OpaqueIdSchema,
    result: z.enum(["stored", "duplicate", "suppressed_self"]),
    notificationId: OpaqueIdSchema.nullable(),
    processedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const DashboardProjectionSchema = z
  .object({
    openCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    nextTasks: z.array(TaskProjectionSchema).max(5),
    lastConfirmedAt: z.iso.datetime({ offset: true }).nullable(),
    taskSourceFreshness: z.literal("current"),
    notificationDependency: z.enum(["available", "degraded"]),
    notifications: z.array(NotificationSchema).nullable(),
  })
  .strict();

export const ApiErrorCodeSchema = z.enum([
  "TASK_VALIDATION_FAILED",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_KEY_REUSED",
  "TASK_NOT_FOUND",
  "TASK_VERSION_CONFLICT",
  "NOTIFICATION_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_CONTRACT_INVALID",
]);

export const ApiErrorSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        messageKey: z.string().min(1).max(120),
        fieldErrors: z.record(z.string(), z.string()).optional(),
        retryable: z.boolean(),
        correlationId: CorrelationIdSchema,
        currentTask: TaskProjectionSchema.optional(),
        recoveryAction: z.literal("reload_current").optional(),
      })
      .strict(),
  })
  .strict();

export type Member = z.infer<typeof MemberSchema>;
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;
export type CompleteTaskRequest = z.infer<typeof CompleteTaskRequestSchema>;
export type TaskProjection = z.infer<typeof TaskProjectionSchema>;
export type CareTaskCompletedEvent = z.infer<typeof CareTaskCompletedEventSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type ConsumerAcknowledgement = z.infer<typeof ConsumerAcknowledgementSchema>;
export type DashboardProjection = z.infer<typeof DashboardProjectionSchema>;
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export interface SuccessEnvelope<T> {
  data: T;
  meta: {
    correlationId: string;
  };
}

export function successEnvelope<T>(data: T, correlationId: string): SuccessEnvelope<T> {
  return {
    data,
    meta: { correlationId },
  };
}
