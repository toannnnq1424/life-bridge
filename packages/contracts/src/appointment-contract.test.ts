import { describe, expect, it } from "vitest";

import {
  AppointmentProjectionSchema,
  AppointmentReminderIntentEventSchema,
  CalendarQuerySchema,
  CancelAppointmentRequestSchema,
  ChangeAppointmentRequestSchema,
  CoordinationAuthorizationRequestSchema,
  CreateAppointmentRequestSchema,
} from "./index.js";

const schedule = {
  localStart: "2026-11-01T01:30",
  sourceTimeZone: "America/New_York",
  sourceUtcOffset: "-05:00",
  ambiguousTimePolicy: "later",
  durationMinutes: 60,
  recurrence: { frequency: "weekly", intervalWeeks: 1, occurrenceCount: 4 },
} as const;

describe("P3-S2 appointment contracts", () => {
  it("binds action-specific authority to appointment scope", () => {
    const base = {
      householdId: "household_demo",
      requestDigest: "a".repeat(64),
    };
    expect(
      CoordinationAuthorizationRequestSchema.safeParse({
        ...base,
        permission: "coordination.calendar.read",
      }).success,
    ).toBe(true);
    expect(
      CoordinationAuthorizationRequestSchema.safeParse({
        ...base,
        permission: "coordination.appointment.change",
        appointmentId: "appointment_demo",
      }).success,
    ).toBe(true);
    expect(
      CoordinationAuthorizationRequestSchema.safeParse({
        ...base,
        permission: "coordination.appointment.cancel",
      }).success,
    ).toBe(false);
  });

  it("accepts only structured finite commands", () => {
    const create = {
      operation: "create_appointment",
      appointmentKind: "transport",
      logisticsMode: "in_person",
      schedule,
      reminder: { leadMinutes: 60 },
    } as const;
    expect(CreateAppointmentRequestSchema.safeParse(create).success).toBe(true);
    expect(
      CreateAppointmentRequestSchema.safeParse({
        ...create,
        title: "free form is forbidden",
      }).success,
    ).toBe(false);
    expect(
      CreateAppointmentRequestSchema.safeParse({
        ...create,
        schedule: {
          ...schedule,
          recurrence: { frequency: "weekly", intervalWeeks: 1, occurrenceCount: 13 },
        },
      }).success,
    ).toBe(false);

    expect(
      ChangeAppointmentRequestSchema.safeParse({
        operation: "change_appointment",
        scope: "occurrence_only",
        expectedVersion: 2,
        appointmentKind: "transport",
        logisticsMode: "phone",
        schedule: {
          ...schedule,
          recurrence: { frequency: "none" },
        },
        reminder: { leadMinutes: null },
      }).success,
    ).toBe(true);
    expect(
      CancelAppointmentRequestSchema.safeParse({
        operation: "cancel_appointment",
        scope: "occurrence_only",
        expectedVersion: 2,
        reasonCode: "schedule_changed",
      }).success,
    ).toBe(true);
  });

  it("freezes fact-complete projections and minimum reminder intent", () => {
    const projection = {
      appointmentId: "appointment_demo",
      seriesId: "series_demo",
      householdId: "household_demo",
      recipientContextId: "recipient_demo",
      kind: "transport",
      logistics: "in_person",
      status: "scheduled",
      lastChange: "created",
      startsAtUtc: "2026-11-01T06:30:00.000Z",
      endsAtUtc: "2026-11-01T07:30:00.000Z",
      sourceLocalStart: "2026-11-01T01:30",
      sourceUtcOffset: "-05:00",
      sourceTimeZone: "America/New_York",
      durationMinutes: 60,
      occurrenceNumber: 1,
      occurrenceCount: 4,
      recurrenceFrequency: "weekly",
      recurrenceIntervalWeeks: 1,
      recurrenceFinalLocalDate: "2026-11-22",
      mutationScope: "occurrence_only",
      reminderIntent: "recorded",
      reminderLeadMinutes: 60,
      version: 1,
      createdAt: "2026-07-27T00:00:00.000Z",
      updatedAt: "2026-07-27T00:00:00.000Z",
      cancelledAt: null,
      confirmedAt: "2026-07-27T00:00:00.000Z",
    } as const;
    expect(AppointmentProjectionSchema.safeParse(projection).success).toBe(true);
    expect(
      AppointmentProjectionSchema.safeParse({ ...projection, note: "forbidden" }).success,
    ).toBe(false);

    const event = {
      eventId: "event_reminder_demo",
      eventType: "care.appointment.reminder_intent.v1",
      eventVersion: 1,
      occurredAt: "2026-07-27T00:00:00.000Z",
      producer: "care-coordination",
      aggregateId: "appointment_demo",
      aggregateVersion: 1,
      correlationId: "corr_reminder_demo",
      causationId: "command_reminder_demo",
      payload: {
        intent: "schedule",
        recipientId: "account_demo",
        remindAtUtc: "2026-11-01T05:30:00.000Z",
        startsAtUtc: "2026-11-01T06:30:00.000Z",
        messageKey: "notifications.appointment.reminder",
      },
    } as const;
    expect(AppointmentReminderIntentEventSchema.safeParse(event).success).toBe(true);
    expect(
      AppointmentReminderIntentEventSchema.safeParse({
        ...event,
        payload: { ...event.payload, title: "forbidden" },
      }).success,
    ).toBe(false);
    expect(
      CalendarQuerySchema.parse({
        localDate: "2026-11-01",
        displayTimeZone: "America/New_York",
      }),
    ).toMatchObject({ filter: "all" });
  });
});
