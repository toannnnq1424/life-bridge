import type {
  CoordinationAuthorizationDecision,
  CoordinationPermission,
  CreateMedicationReminderRequest,
} from "@lifebridge/contracts";
import {
  ChangeMedicationReminderRequestSchema,
  CreateMedicationReminderRequestSchema,
  DisableMedicationReminderRequestSchema,
} from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MedicationReminderService } from "./medication-reminder-service.js";
import { migrateCareDatabase } from "./migration.js";

const databaseUrl = process.env.CARE_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P4-S1 Care-owned medication schedule boundary", () => {
  let pool: Pool;
  let service: MedicationReminderService;
  const clock = new Date("2026-08-03T00:30:00.000Z");
  let sequence = 0;

  beforeAll(async () => {
    await migrateCareDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE care_medication_reminder_transitions,
               care_medication_reminder_occurrences,
               care_medication_reminders,
               care_outbox, care_audit, care_idempotency
      RESTART IDENTITY CASCADE
    `);
    sequence = 0;
    service = makeService();
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("stores exact user facts atomically and emits only minimum-data intents", async () => {
    const request = createRequest();
    const input = {
      householdId: "household_p4s1",
      request,
      idempotencyKey: "p4s1-create-key",
      authorization: decision(
        "coordination.medication_reminder.create",
        MedicationReminderService.requestDigest({
          operation: "medication_reminder.create",
          householdId: "household_p4s1",
          request: CreateMedicationReminderRequestSchema.parse(request),
        }),
      ),
      correlationId: "corr_p4s1",
    };
    const created = await service.create(input);
    expect(await service.create(input)).toEqual(created);
    expect(created).toMatchObject({
      medicationLabel: "Synthetic reminder A",
      amount: "0.125",
      unit: "millilitre",
      sourceTimeZone: "America/New_York",
      sourceUtcOffset: "-04:00",
      version: 1,
    });
    expect(created.occurrences).toHaveLength(3);
    expect(created.occurrences.map((item) => item.sourceUtcOffset)).toEqual([
      "-04:00",
      "-05:00",
      "-05:00",
    ]);
    expect(created.occurrences.map((item) => item.scheduledAtUtc)).toEqual([
      "2026-10-25T12:00:00.000Z",
      "2026-11-01T13:00:00.000Z",
      "2026-11-08T13:00:00.000Z",
    ]);
    await expectCount("care_medication_reminders", 1);
    await expectCount("care_medication_reminder_occurrences", 3);
    await expectCount("care_medication_reminder_transitions", 1);
    await expectCount("care_audit", 1);
    await expectCount("care_outbox", 3);
    await expectCount("care_idempotency", 1);

    const evidence = await pool.query<{
      idempotency_key: string;
      payload: unknown;
      metadata: unknown;
    }>(
      `SELECT idempotency_key, NULL::jsonb AS payload, NULL::jsonb AS metadata
       FROM care_idempotency
       UNION ALL
       SELECT '' AS idempotency_key, payload, NULL::jsonb AS metadata
       FROM care_outbox
       UNION ALL
       SELECT '' AS idempotency_key, NULL::jsonb AS payload, metadata
       FROM care_audit`,
    );
    expect(JSON.stringify(evidence.rows)).not.toContain("p4s1-create-key");
    expect(JSON.stringify(evidence.rows.filter((row) => row.payload))).not.toMatch(
      /Synthetic reminder A|0\.125|millilitre|diagnosis|taken|skipped|adherence/i,
    );
    expect(JSON.stringify(evidence.rows.filter((row) => row.metadata))).not.toMatch(
      /Synthetic reminder A|0\.125|millilitre|diagnosis|taken|skipped|adherence/i,
    );
  });

  it("allows one optimistic change and makes a concurrent stale change explicit", async () => {
    const created = await createOne();
    const changeRequest = {
      operation: "change_medication_reminder" as const,
      expectedVersion: created.version,
      medicationLabel: "Synthetic reminder changed",
      amount: "1",
      unit: "tablet" as const,
      otherUnitLabel: null,
      schedule: {
        localStart: "2026-08-04T08:00",
        sourceTimeZone: "Asia/Bangkok",
        sourceUtcOffset: "+07:00",
        ambiguousTimePolicy: null,
        recurrence: { frequency: "none" as const },
      },
    };
    const mutate = (idempotencyKey: string) =>
      service.change({
        householdId: "household_p4s1",
        reminderId: created.reminderId,
        request: changeRequest,
        idempotencyKey,
        authorization: decision(
          "coordination.medication_reminder.change",
          MedicationReminderService.requestDigest({
            operation: "medication_reminder.change",
            householdId: "household_p4s1",
            reminderId: created.reminderId,
            request: ChangeMedicationReminderRequestSchema.parse(changeRequest),
          }),
        ),
        correlationId: "corr_p4s1",
      });
    const settled = await Promise.allSettled([mutate("p4s1-change-a"), mutate("p4s1-change-b")]);
    expect(settled.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((item) => item.status === "rejected");
    expect(rejected).toMatchObject({
      reason: { code: "MEDICATION_REMINDER_VERSION_CONFLICT" },
    });
    const current = await service.get({
      householdId: "household_p4s1",
      reminderId: created.reminderId,
      authorization: decision(
        "coordination.medication_reminder.read",
        MedicationReminderService.requestDigest({
          operation: "medication_reminder.read",
          householdId: "household_p4s1",
          reminderId: created.reminderId,
        }),
      ),
      correlationId: "corr_p4s1",
    });
    expect(current).toMatchObject({
      medicationLabel: "Synthetic reminder changed",
      version: 2,
    });
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM care_medication_reminder_occurrences
             WHERE reminder_id = $1 AND state = 'superseded'`,
            [created.reminderId],
          )
        ).rows[0]?.count,
      ),
    ).toBe(3);
    await expectCount("care_medication_reminder_transitions", 2);
    await expectCount("care_audit", 2);
    await expectCount("care_outbox", 7);
  });

  it("rejects stale or mismatched authority without reading schedule state", async () => {
    const request = createRequest();
    const authorization = decision(
      "coordination.medication_reminder.create",
      MedicationReminderService.requestDigest({
        operation: "medication_reminder.create",
        householdId: "household_p4s1",
        request: CreateMedicationReminderRequestSchema.parse(request),
      }),
    );
    authorization.decidedAt = new Date(clock.getTime() - 11_000).toISOString();
    await expect(
      service.create({
        householdId: "household_p4s1",
        request,
        idempotencyKey: "p4s1-stale-authority",
        authorization,
        correlationId: "corr_p4s1",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "COORDINATION_RESOURCE_NOT_FOUND",
    });
    await expectCount("care_medication_reminders", 0);
  });

  it("disables the current schedule version and records cancellation intents", async () => {
    const created = await createOne();
    const request = {
      operation: "disable_medication_reminder" as const,
      expectedVersion: created.version,
    };
    const disabled = await service.disable({
      householdId: "household_p4s1",
      reminderId: created.reminderId,
      request,
      idempotencyKey: "p4s1-disable",
      authorization: decision(
        "coordination.medication_reminder.disable",
        MedicationReminderService.requestDigest({
          operation: "medication_reminder.disable",
          householdId: "household_p4s1",
          reminderId: created.reminderId,
          request: DisableMedicationReminderRequestSchema.parse(request),
        }),
      ),
      correlationId: "corr_p4s1",
    });
    expect(disabled).toMatchObject({ status: "disabled", version: 2 });
    expect(disabled.occurrences.every((item) => item.state === "disabled")).toBe(true);
    expect(disabled.occurrences.every((item) => item.notificationIntent === "cancelled")).toBe(
      true,
    );
    await expectCount("care_medication_reminder_transitions", 2);
    await expectCount("care_audit", 2);
    await expectCount("care_outbox", 6);
  });

  it("rolls schedule, audit, outbox, transition, and idempotency back together", async () => {
    const rollbackService = makeService(async () => {
      throw new Error("synthetic_before_commit_failure");
    });
    const request = createRequest();
    await expect(
      rollbackService.create({
        householdId: "household_p4s1",
        request,
        idempotencyKey: "p4s1-rollback",
        authorization: decision(
          "coordination.medication_reminder.create",
          MedicationReminderService.requestDigest({
            operation: "medication_reminder.create",
            householdId: "household_p4s1",
            request: CreateMedicationReminderRequestSchema.parse(request),
          }),
        ),
        correlationId: "corr_p4s1",
      }),
    ).rejects.toThrow("synthetic_before_commit_failure");
    await expectCount("care_medication_reminders", 0);
    await expectCount("care_medication_reminder_occurrences", 0);
    await expectCount("care_medication_reminder_transitions", 0);
    await expectCount("care_audit", 0);
    await expectCount("care_outbox", 0);
    await expectCount("care_idempotency", 0);
  });

  function makeService(
    beforeCommit?: (operation: "create" | "change" | "disable") => void | Promise<void>,
  ): MedicationReminderService {
    return new MedicationReminderService(pool, {
      now: () => new Date(clock),
      id: (prefix) => `${prefix}_p4s1_${++sequence}`,
      ...(beforeCommit ? { beforeCommit } : {}),
    });
  }

  async function createOne() {
    const request = createRequest();
    return service.create({
      householdId: "household_p4s1",
      request,
      idempotencyKey: "p4s1-create-one",
      authorization: decision(
        "coordination.medication_reminder.create",
        MedicationReminderService.requestDigest({
          operation: "medication_reminder.create",
          householdId: "household_p4s1",
          request: CreateMedicationReminderRequestSchema.parse(request),
        }),
      ),
      correlationId: "corr_p4s1",
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

  async function expectCount(table: string, count: number) {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`,
    );
    expect(Number(result.rows[0]?.count)).toBe(count);
  }
});

function createRequest(): CreateMedicationReminderRequest {
  return {
    operation: "create_medication_reminder",
    medicationLabel: "Synthetic reminder A",
    amount: "0.125",
    unit: "millilitre",
    otherUnitLabel: null,
    schedule: {
      localStart: "2026-10-25T08:00",
      sourceTimeZone: "America/New_York",
      sourceUtcOffset: "-04:00",
      ambiguousTimePolicy: null,
      recurrence: { frequency: "weekly", intervalWeeks: 1, occurrenceCount: 3 },
    },
  };
}
