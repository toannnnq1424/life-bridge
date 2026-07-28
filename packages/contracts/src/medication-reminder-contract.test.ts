import { describe, expect, it } from "vitest";

import {
  AcknowledgeMedicationReminderRequestSchema,
  ChangeMedicationReminderRequestSchema,
  CoordinationAuthorizationRequestSchema,
  CreateMedicationReminderRequestSchema,
  MedicationReminderIntentEventSchema,
  MedicationReminderNotificationProjectionSchema,
  MedicationReminderSeenEventSchema,
} from "./index.js";

const createRequest = {
  operation: "create_medication_reminder" as const,
  medicationLabel: "Reminder item A",
  amount: "1",
  unit: "tablet" as const,
  otherUnitLabel: null,
  schedule: {
    localStart: "2026-08-03T08:00",
    sourceTimeZone: "Asia/Bangkok",
    sourceUtcOffset: "+07:00",
    ambiguousTimePolicy: null,
    recurrence: { frequency: "daily" as const, intervalDays: 1, occurrenceCount: 7 },
  },
};

describe("P4-S1 medication reminder contracts", () => {
  it("round-trips exact user-provided amount/unit/time facts without inference", () => {
    expect(CreateMedicationReminderRequestSchema.parse(createRequest)).toEqual(createRequest);
    expect(
      CreateMedicationReminderRequestSchema.parse({
        ...createRequest,
        amount: "0.125",
        unit: "other",
        otherUnitLabel: "measured unit",
        schedule: {
          ...createRequest.schedule,
          recurrence: { frequency: "weekly", intervalWeeks: 2, occurrenceCount: 4 },
        },
      }),
    ).toMatchObject({ amount: "0.125", unit: "other", otherUnitLabel: "measured unit" });
  });

  it.each([
    ["zero", { ...createRequest, amount: "0" }],
    ["negative", { ...createRequest, amount: "-1" }],
    ["exponent", { ...createRequest, amount: "1e2" }],
    ["too precise", { ...createRequest, amount: "0.0001" }],
    ["missing other label", { ...createRequest, unit: "other", otherUnitLabel: null }],
    ["other label on enum unit", { ...createRequest, otherUnitLabel: "tablet" }],
    [
      "invalid IANA zone",
      { ...createRequest, schedule: { ...createRequest.schedule, sourceTimeZone: "ICT" } },
    ],
    [
      "unbounded recurrence",
      {
        ...createRequest,
        schedule: {
          ...createRequest.schedule,
          recurrence: { frequency: "daily", intervalDays: 1, occurrenceCount: 32 },
        },
      },
    ],
    ["unknown field", { ...createRequest, diagnosis: "synthetic diagnosis" }],
    ["clinical instruction", { ...createRequest, instruction: "take now" }],
  ])("rejects %s", (_name, value) => {
    expect(() => CreateMedicationReminderRequestSchema.parse(value)).toThrow();
  });

  it("requires optimistic versions for change and acknowledgement", () => {
    expect(
      ChangeMedicationReminderRequestSchema.parse({
        ...createRequest,
        operation: "change_medication_reminder",
        expectedVersion: 2,
      }).expectedVersion,
    ).toBe(2);
    expect(
      AcknowledgeMedicationReminderRequestSchema.parse({
        operation: "acknowledge_medication_reminder",
        expectedVersion: 1,
      }),
    ).toEqual({ operation: "acknowledge_medication_reminder", expectedVersion: 1 });
    expect(() =>
      AcknowledgeMedicationReminderRequestSchema.parse({
        operation: "acknowledge_medication_reminder",
        expectedVersion: 1,
        outcome: "taken",
      }),
    ).toThrow();
  });

  it("binds schedule and acknowledgement resource scopes to exact permissions", () => {
    const common = {
      householdId: "household_demo",
      requestDigest: "a".repeat(64),
    };
    expect(
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "coordination.medication_reminder.change",
        medicationReminderId: "reminder_demo",
      }).medicationReminderId,
    ).toBe("reminder_demo");
    expect(() =>
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "coordination.medication_reminder.change",
      }),
    ).toThrow();
    expect(
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "coordination.medication_reminder.read",
        medicationReminderId: "reminder_demo",
      }).medicationReminderId,
    ).toBe("reminder_demo");
    expect(
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "notification.medication_reminder.acknowledge",
        medicationOccurrenceId: "occurrence_demo",
      }).medicationOccurrenceId,
    ).toBe("occurrence_demo");
    expect(() =>
      CoordinationAuthorizationRequestSchema.parse({
        ...common,
        permission: "notification.medication_reminder.read",
        medicationOccurrenceId: "occurrence_demo",
      }),
    ).toThrow();
  });

  it("keeps Notification intent minimum-data and excludes medication content", () => {
    const event = MedicationReminderIntentEventSchema.parse({
      eventId: "event_medication_demo",
      eventType: "care.medication_reminder.intent.v1",
      eventVersion: 1,
      occurredAt: "2026-08-03T00:00:00.000Z",
      producer: "care-coordination",
      aggregateId: "occurrence_demo",
      aggregateVersion: 1,
      correlationId: "corr_medication_demo",
      causationId: "command_medication_demo",
      payload: {
        intent: "schedule",
        reminderId: "reminder_demo",
        occurrenceId: "occurrence_demo",
        householdId: "household_demo",
        recipientContextId: "recipient_context_demo",
        recipientId: "account_demo",
        occurrenceVersion: 1,
        scheduledAtUtc: "2026-08-03T01:00:00.000Z",
        sourceLocalStart: "2026-08-03T08:00",
        sourceTimeZone: "Asia/Bangkok",
        sourceUtcOffset: "+07:00",
        messageKey: "notifications.medication_reminder.generic",
      },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/medicationLabel|amount|unit|diagnosis|adherence|idempotency/i);
    expect(() =>
      MedicationReminderIntentEventSchema.parse({
        ...event,
        payload: { ...event.payload, amount: "1" },
      }),
    ).toThrow();
  });

  it("requires authoritative delivered evidence before seen acknowledgement", () => {
    const delivered = {
      notificationId: "notification_medication_demo",
      reminderId: "reminder_demo",
      occurrenceId: "occurrence_demo",
      sourceLocalStart: "2026-08-03T08:00",
      sourceTimeZone: "Asia/Bangkok",
      sourceUtcOffset: "+07:00",
      scheduledAtUtc: "2026-08-03T01:00:00.000Z",
      messageKey: "notifications.medication_reminder.generic" as const,
      intentState: "pending" as const,
      deliveryState: "delivered" as const,
      deliveryEvidence: "in_app_persisted" as const,
      attemptCount: 1,
      deliveredAt: "2026-08-03T01:00:00.000Z",
      failedAt: null,
      missedAt: null,
      acknowledgementState: "unacknowledged" as const,
      acknowledgedAt: null,
      version: 1,
    };
    expect(MedicationReminderNotificationProjectionSchema.parse(delivered)).toEqual(delivered);
    expect(() =>
      MedicationReminderNotificationProjectionSchema.parse({
        ...delivered,
        deliveryEvidence: "none",
      }),
    ).toThrow();
    expect(() =>
      MedicationReminderNotificationProjectionSchema.parse({
        ...delivered,
        acknowledgementState: "seen",
      }),
    ).toThrow();
  });

  it("emits content-free seen evidence and rejects clinical outcomes", () => {
    const event = MedicationReminderSeenEventSchema.parse({
      eventId: "event_seen_demo",
      eventType: "notification.medication_reminder.seen.v1",
      eventVersion: 1,
      occurredAt: "2026-08-03T01:05:00.000Z",
      producer: "notification",
      aggregateId: "occurrence_demo",
      aggregateVersion: 2,
      correlationId: "corr_seen_demo",
      causationId: "command_seen_demo",
      payload: {
        reminderId: "reminder_demo",
        occurrenceId: "occurrence_demo",
        outcome: "seen",
        acknowledgedAt: "2026-08-03T01:05:00.000Z",
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/taken|skipped|dose|adherence|label|amount|unit/i);
    expect(() =>
      MedicationReminderSeenEventSchema.parse({
        ...event,
        payload: { ...event.payload, outcome: "taken" },
      }),
    ).toThrow();
  });
});
