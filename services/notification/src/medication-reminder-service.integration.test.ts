import type {
  CoordinationAuthorizationDecision,
  CoordinationPermission,
  MedicationReminderIntentEvent,
} from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MedicationReminderNotificationService } from "./medication-reminder-service.js";
import { migrateNotificationDatabase } from "./migration.js";

const databaseUrl = process.env.NOTIFICATION_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P4-S1 Notification-owned delivery and seen acknowledgement", () => {
  let pool: Pool;
  let service: MedicationReminderNotificationService;
  let clock: Date;
  let sequence = 0;

  beforeAll(async () => {
    await migrateNotificationDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE notification_outbox, notification_audit, notification_idempotency,
               medication_delivery_attempts, medication_reminder_notifications,
               medication_reminder_intents, notifications, notification_inbox
      RESTART IDENTITY CASCADE
    `);
    clock = new Date("2026-08-03T01:00:00.000Z");
    sequence = 0;
    service = makeService();
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("persists delivery evidence before one immutable concurrent seen acknowledgement", async () => {
    const intent = event("event_p4s1_schedule", "occurrence_p4s1_a", clock.toISOString());
    expect(await service.consume(intent)).toMatchObject({
      result: "medication_reminder_scheduled",
    });
    expect(await service.consume(intent)).toMatchObject({ result: "duplicate" });
    expect(await service.processDue("deliver")).toBe(1);

    const before = await service.list({
      householdId: "household_p4s1",
      authorization: decision(
        "notification.medication_reminder.read",
        MedicationReminderNotificationService.requestDigest({
          operation: "medication_notification.list",
          householdId: "household_p4s1",
        }),
      ),
      correlationId: "corr_p4s1",
    });
    expect(before.items[0]).toMatchObject({
      deliveryState: "delivered",
      deliveryEvidence: "in_app_persisted",
      acknowledgementState: "unacknowledged",
    });

    const input = {
      householdId: "household_p4s1",
      occurrenceId: "occurrence_p4s1_a",
      request: {
        operation: "acknowledge_medication_reminder" as const,
        expectedVersion: before.items[0]!.version,
      },
      authorization: decision(
        "notification.medication_reminder.acknowledge",
        MedicationReminderNotificationService.requestDigest({
          operation: "medication_notification.acknowledge",
          householdId: "household_p4s1",
          occurrenceId: "occurrence_p4s1_a",
          request: {
            operation: "acknowledge_medication_reminder",
            expectedVersion: before.items[0]!.version,
          },
        }),
      ),
      correlationId: "corr_p4s1",
    };
    const results = await Promise.all([
      service.acknowledge({ ...input, idempotencyKey: "p4s1-ack-a" }),
      service.acknowledge({ ...input, idempotencyKey: "p4s1-ack-b" }),
    ]);
    expect(results.map((item) => item.result).sort()).toEqual(["duplicate", "recorded"]);
    expect(new Set(results.map((item) => item.notification.acknowledgedAt)).size).toBe(1);

    expect(await service.acknowledge({ ...input, idempotencyKey: "p4s1-ack-a" })).toEqual(
      results[0],
    );
    await expectCount("notification_audit", 1);
    await expectCount("notification_outbox", 1);
    await expectCount("notification_idempotency", 2);
    const stored = await pool.query<{ idempotency_key: string; payload: unknown }>(
      `SELECT idempotency_key, NULL::jsonb AS payload FROM notification_idempotency
       UNION ALL
       SELECT '' AS idempotency_key, payload FROM notification_outbox`,
    );
    expect(JSON.stringify(stored.rows)).not.toMatch(
      /p4s1-ack|medicationLabel|amount|unit|taken|skipped|adherence/i,
    );
    await expect(migrateNotificationDatabase(databaseUrl!)).resolves.toBeUndefined();
  });

  it("keeps uncertain, failed, and missed delivery distinct and auditable", async () => {
    await service.consume(event("event_uncertain", "occurrence_uncertain", clock.toISOString()));
    expect(await service.processDue("uncertain")).toBe(1);
    expect(await stateOf("occurrence_uncertain")).toMatchObject({
      delivery_state: "uncertain",
      delivery_evidence: "none",
      attempt_count: 1,
    });
    expect(await service.processDue("deliver")).toBe(1);
    expect(await stateOf("occurrence_uncertain")).toMatchObject({
      delivery_state: "delivered",
      delivery_evidence: "in_app_persisted",
      attempt_count: 2,
    });

    await service.consume(event("event_failed", "occurrence_failed", clock.toISOString()));
    expect(await service.processDue("fail")).toBe(1);
    expect(await stateOf("occurrence_failed")).toMatchObject({
      delivery_state: "failed",
      delivery_evidence: "none",
      attempt_count: 1,
    });

    await service.consume(
      event(
        "event_missed",
        "occurrence_missed",
        new Date(clock.getTime() - 16 * 60_000).toISOString(),
      ),
    );
    expect(await service.processDue("deliver")).toBe(1);
    expect(await stateOf("occurrence_missed")).toMatchObject({
      delivery_state: "missed",
      delivery_evidence: "none",
      attempt_count: 1,
    });
    await expectCount("medication_delivery_attempts", 4);
  });

  it("rolls acknowledgement state, audit, outbox, and idempotency back together", async () => {
    await service.consume(event("event_rollback", "occurrence_rollback", clock.toISOString()));
    await service.processDue("deliver");
    const version = (await stateOf("occurrence_rollback")).version;
    const rollbackService = makeService(async (operation) => {
      if (operation === "acknowledgement") throw new Error("synthetic_before_commit_failure");
    });
    const request = {
      operation: "acknowledge_medication_reminder" as const,
      expectedVersion: version,
    };
    await expect(
      rollbackService.acknowledge({
        householdId: "household_p4s1",
        occurrenceId: "occurrence_rollback",
        request,
        idempotencyKey: "p4s1-rollback-key",
        authorization: decision(
          "notification.medication_reminder.acknowledge",
          MedicationReminderNotificationService.requestDigest({
            operation: "medication_notification.acknowledge",
            householdId: "household_p4s1",
            occurrenceId: "occurrence_rollback",
            request,
          }),
        ),
        correlationId: "corr_p4s1",
      }),
    ).rejects.toThrow("synthetic_before_commit_failure");
    expect(await stateOf("occurrence_rollback")).toMatchObject({
      acknowledgement_state: "unacknowledged",
      version,
    });
    await expectCount("notification_audit", 0);
    await expectCount("notification_outbox", 0);
    await expectCount("notification_idempotency", 0);
  });

  function makeService(
    beforeCommit?: (operation: "delivery" | "acknowledgement") => void | Promise<void>,
  ): MedicationReminderNotificationService {
    return new MedicationReminderNotificationService(pool, {
      now: () => new Date(clock),
      id: (prefix) => `${prefix}_p4s1_${++sequence}`,
      ...(beforeCommit ? { beforeCommit } : {}),
    });
  }

  function decision(
    permission: CoordinationPermission,
    requestDigest: string,
  ): CoordinationAuthorizationDecision {
    return {
      decisionId: `decision_p4s1_${++sequence}`,
      permission,
      actor: {
        actorId: "account_p4s1",
        actorRef: "actor_ref_p4s1",
        displayKey: "coordination.actor.you",
        subject: true,
      },
      householdId: "household_p4s1",
      recipientContextId: "recipient_context_p4s1",
      subjectId: "subject_p4s1",
      subjectVersion: 1,
      grantId: null,
      grantVersion: null,
      privacyVersion: null,
      target: null,
      eligibleTargets: [],
      decidedAt: clock.toISOString(),
      correlationId: "corr_p4s1",
      requestDigest,
    };
  }

  async function stateOf(occurrenceId: string) {
    return (
      await pool.query<{
        delivery_state: string;
        delivery_evidence: string;
        attempt_count: number;
        acknowledgement_state: string | null;
        version: number;
      }>(
        `SELECT intent.delivery_state, intent.delivery_evidence, intent.attempt_count,
                notification.acknowledgement_state, intent.version
         FROM medication_reminder_intents AS intent
         LEFT JOIN medication_reminder_notifications AS notification
           ON notification.occurrence_id = intent.occurrence_id
         WHERE intent.occurrence_id = $1`,
        [occurrenceId],
      )
    ).rows[0]!;
  }

  async function expectCount(table: string, count: number) {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`,
    );
    expect(Number(result.rows[0]?.count)).toBe(count);
  }
});

function event(
  eventId: string,
  occurrenceId: string,
  scheduledAtUtc: string,
): MedicationReminderIntentEvent {
  return {
    eventId,
    eventType: "care.medication_reminder.intent.v1",
    eventVersion: 1,
    occurredAt: "2026-08-03T00:59:00.000Z",
    producer: "care-coordination",
    aggregateId: occurrenceId,
    aggregateVersion: 1,
    correlationId: "corr_p4s1",
    causationId: `command_${eventId}`,
    payload: {
      intent: "schedule",
      reminderId: `reminder_${occurrenceId}`,
      occurrenceId,
      householdId: "household_p4s1",
      recipientContextId: "recipient_context_p4s1",
      recipientId: "account_p4s1",
      occurrenceVersion: 1,
      scheduledAtUtc,
      sourceLocalStart: "2026-08-03T08:00",
      sourceTimeZone: "Asia/Bangkok",
      sourceUtcOffset: "+07:00",
      messageKey: "notifications.medication_reminder.generic",
    },
  };
}
