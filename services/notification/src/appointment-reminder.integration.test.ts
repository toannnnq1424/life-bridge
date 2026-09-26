import type { AppointmentReminderIntentEvent } from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { migrateNotificationDatabase } from "./migration.js";
import { NotificationService } from "./service.js";

const databaseUrl = process.env.NOTIFICATION_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P3-S2 Notification reminder-intent PostgreSQL boundary", () => {
  let pool: Pool;
  let service: NotificationService;

  beforeAll(async () => {
    await migrateNotificationDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 4 });
  });

  beforeEach(async () => {
    await pool.query(
      "TRUNCATE appointment_reminder_intents, notifications, notification_inbox CASCADE",
    );
    service = new NotificationService(pool, () => new Date("2026-07-27T02:05:00.000Z"));
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("stores schedule/cancel intent idempotently without fabricating delivery", async () => {
    const scheduled = event("event_reminder_schedule", "schedule");
    expect(await service.consume(scheduled)).toMatchObject({
      result: "reminder_scheduled",
      notificationId: null,
    });
    expect(await service.consume(scheduled)).toMatchObject({
      result: "duplicate",
      notificationId: null,
    });

    const cancelled = event("event_reminder_cancel", "cancel");
    expect(await service.consume(cancelled)).toMatchObject({
      result: "reminder_cancelled",
      notificationId: null,
    });
    expect(await service.countRows("appointment_reminder_intents")).toBe(1);
    expect(await service.countRows("notifications")).toBe(0);
    const stored = await pool.query<{
      intent_state: string;
      remind_at_utc: Date | null;
      starts_at_utc: Date | null;
      message_key: string;
    }>(
      `SELECT intent_state, remind_at_utc, starts_at_utc, message_key
       FROM appointment_reminder_intents
       WHERE appointment_id = 'appointment_reminder_demo'`,
    );
    expect(stored.rows[0]).toMatchObject({
      intent_state: "cancelled",
      remind_at_utc: null,
      starts_at_utc: null,
      message_key: "notifications.appointment.reminder",
    });
  });
});

function event(eventId: string, intent: "schedule" | "cancel"): AppointmentReminderIntentEvent {
  return {
    eventId,
    eventType: "care.appointment.reminder_intent.v1",
    eventVersion: 1,
    occurredAt: "2026-07-27T02:00:00.000Z",
    producer: "care-coordination",
    aggregateId: "appointment_reminder_demo",
    aggregateVersion: intent === "schedule" ? 1 : 2,
    correlationId: "corr_reminder_runtime",
    causationId: `command_reminder_${intent}`,
    payload:
      intent === "schedule"
        ? {
            intent,
            recipientId: "account_reminder_demo",
            remindAtUtc: "2026-07-28T01:00:00.000Z",
            startsAtUtc: "2026-07-28T02:00:00.000Z",
            messageKey: "notifications.appointment.reminder",
          }
        : {
            intent,
            recipientId: "account_reminder_demo",
            messageKey: "notifications.appointment.reminder",
          },
  };
}
