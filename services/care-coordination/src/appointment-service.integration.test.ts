import { createHash } from "node:crypto";

import type {
  CalendarQuery,
  CoordinationAuthorizationDecision,
  CoordinationPermission,
  CreateAppointmentRequest,
} from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppointmentService } from "./appointment-service.js";
import { migrateCareDatabase } from "./migration.js";

const databaseUrl = process.env.CARE_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P3-S2 Care-owned appointment PostgreSQL boundary", () => {
  let pool: Pool;
  let service: AppointmentService;
  const now = Date.parse("2026-07-27T02:00:00.000Z");
  let sequence = 0;

  beforeAll(async () => {
    await migrateCareDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE care_appointment_transitions, care_appointments, care_outbox,
               care_audit, care_idempotency
      RESTART IDENTITY CASCADE
    `);
    sequence = 0;
    service = new AppointmentService(pool, {
      now: () => new Date(now),
      id: (prefix) => `${prefix}_p3s2_${++sequence}`,
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("atomically materializes finite recurrence with digest-only idempotency and outbox", async () => {
    const request = createRequest("2026-10-25T09:00", "-04:00", true);
    const input = createInput(request, "p3s2-create-key");
    const created = await service.create(input);
    const replay = await service.create(input);

    expect(replay).toEqual(created);
    expect(created.appointments).toHaveLength(3);
    expect(created.appointments.map((item) => item.sourceUtcOffset)).toEqual([
      "-04:00",
      "-05:00",
      "-05:00",
    ]);
    expect(created.appointments.map((item) => item.startsAtUtc)).toEqual([
      "2026-10-25T13:00:00.000Z",
      "2026-11-01T14:00:00.000Z",
      "2026-11-08T14:00:00.000Z",
    ]);
    expect(
      Number(
        (
          await pool.query<{ count: string }>(
            "SELECT COUNT(*)::text AS count FROM care_appointments",
          )
        ).rows[0]?.count,
      ),
    ).toBe(3);
    expect(
      Number(
        (await pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM care_outbox"))
          .rows[0]?.count,
      ),
    ).toBe(3);
    const idempotency = await pool.query<{ idempotency_key: string; response_body: unknown }>(
      `SELECT idempotency_key, response_body
       FROM care_idempotency WHERE operation = 'appointment.create'`,
    );
    expect(idempotency.rows[0]?.idempotency_key).not.toContain("p3s2-create-key");
    expect(JSON.stringify(idempotency.rows[0]?.response_body)).not.toContain("p3s2-create-key");
  });

  it("orders the complete agenda deterministically and preserves cancelled history", async () => {
    const first = await service.create(
      createInput(createRequest("2026-07-28T09:00", "+07:00"), "p3s2-order-a"),
    );
    const appointment = first.appointments[0]!;
    await service.cancel({
      householdId: "household_p3s2",
      appointmentId: appointment.appointmentId,
      request: {
        operation: "cancel_appointment",
        scope: "occurrence_only",
        expectedVersion: 1,
        reasonCode: "no_longer_needed",
      },
      idempotencyKey: "p3s2-cancel-a",
      authorization: decision(
        "coordination.appointment.cancel",
        digest({
          operation: "appointment.cancel",
          householdId: "household_p3s2",
          appointmentId: appointment.appointmentId,
          request: {
            operation: "cancel_appointment",
            scope: "occurrence_only",
            expectedVersion: 1,
            reasonCode: "no_longer_needed",
          },
        }),
      ),
      correlationId: "corr_p3s2_appointment",
    });
    const query: CalendarQuery = {
      localDate: "2026-07-28",
      displayTimeZone: "Asia/Bangkok",
      filter: "all",
    };
    const calendar = await service.calendar({
      householdId: "household_p3s2",
      query,
      authorization: decision(
        "coordination.calendar.read",
        digest({ operation: "calendar.read", householdId: "household_p3s2", query }),
      ),
      correlationId: "corr_p3s2_appointment",
    });
    expect(calendar.items).toHaveLength(1);
    expect(calendar.items[0]).toMatchObject({
      appointmentId: appointment.appointmentId,
      status: "cancelled",
      lastChange: "cancelled",
      mutationScope: "occurrence_only",
      reminderIntent: "cancelled",
    });
  });

  it("serializes conflicts, permits adjacency, and returns a safe interval only", async () => {
    await service.create(
      createInput(createRequest("2026-07-28T09:00", "+07:00"), "p3s2-conflict-base"),
    );
    await expect(
      service.create(
        createInput(createRequest("2026-07-28T09:30", "+07:00"), "p3s2-conflict-overlap"),
      ),
    ).rejects.toMatchObject({
      code: "APPOINTMENT_TIME_CONFLICT",
      conflict: {
        startsAtUtc: "2026-07-28T02:00:00.000Z",
        endsAtUtc: "2026-07-28T03:00:00.000Z",
      },
      recoveryAction: "choose_another_time",
    });
    await expect(
      service.create(createInput(createRequest("2026-07-28T10:00", "+07:00"), "p3s2-adjacent")),
    ).resolves.toBeDefined();

    const concurrentRequest = createRequest("2026-07-29T09:00", "+07:00");
    const results = await Promise.allSettled([
      service.create(createInput(concurrentRequest, "p3s2-race-left")),
      service.create(createInput(concurrentRequest, "p3s2-race-right")),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      results
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason.code),
    ).toEqual(["APPOINTMENT_TIME_CONFLICT"]);
  });

  it("enforces optimistic versions and cancelled terminal state without blind replay", async () => {
    const created = await service.create(
      createInput(createRequest("2026-07-30T09:00", "+07:00"), "p3s2-version-base"),
    );
    const appointment = created.appointments[0]!;
    const changeRequest = {
      operation: "change_appointment",
      scope: "occurrence_only",
      expectedVersion: 99,
      appointmentKind: "transport",
      logisticsMode: "phone",
      schedule: {
        localStart: "2026-07-30T11:00",
        sourceTimeZone: "Asia/Bangkok",
        sourceUtcOffset: "+07:00",
        ambiguousTimePolicy: "earlier",
        durationMinutes: 60,
        recurrence: { frequency: "none" },
      },
      reminder: { leadMinutes: null },
    } as const;
    await expect(
      service.change({
        householdId: "household_p3s2",
        appointmentId: appointment.appointmentId,
        request: changeRequest,
        idempotencyKey: "p3s2-stale-change",
        authorization: decision(
          "coordination.appointment.change",
          digest({
            operation: "appointment.change",
            householdId: "household_p3s2",
            appointmentId: appointment.appointmentId,
            request: changeRequest,
          }),
        ),
        correlationId: "corr_p3s2_appointment",
      }),
    ).rejects.toMatchObject({
      code: "APPOINTMENT_VERSION_CONFLICT",
      currentAppointment: { version: 1 },
      recoveryAction: "reload_current",
    });
  });

  function createInput(request: CreateAppointmentRequest, idempotencyKey: string) {
    return {
      householdId: "household_p3s2",
      request,
      idempotencyKey,
      authorization: decision(
        "coordination.appointment.create",
        digest({
          operation: "appointment.create",
          householdId: "household_p3s2",
          request,
        }),
      ),
      correlationId: "corr_p3s2_appointment",
    };
  }

  function createRequest(
    localStart: string,
    offset: string,
    recurring = false,
  ): CreateAppointmentRequest {
    const sourceTimeZone = offset.startsWith("-") ? "America/New_York" : "Asia/Bangkok";
    return {
      operation: "create_appointment",
      appointmentKind: "transport",
      logisticsMode: "in_person",
      schedule: {
        localStart,
        sourceTimeZone,
        sourceUtcOffset: offset,
        ambiguousTimePolicy: "earlier",
        durationMinutes: 60,
        recurrence: recurring
          ? { frequency: "weekly", intervalWeeks: 1, occurrenceCount: 3 }
          : { frequency: "none" },
      },
      reminder: { leadMinutes: 60 },
    };
  }

  function decision(
    permission: CoordinationPermission,
    requestDigest: string,
  ): CoordinationAuthorizationDecision {
    return {
      decisionId: `decision_p3s2_${permission.split(".").at(-1)}`,
      permission,
      actor: {
        actorId: "account_subject",
        actorRef: "actor_ref_subject",
        displayKey: "coordination.actor.you",
        subject: true,
      },
      householdId: "household_p3s2",
      recipientContextId: "recipient_context_p3s2",
      subjectId: "subject_p3s2",
      subjectVersion: 1,
      grantId: null,
      grantVersion: null,
      privacyVersion: 1,
      target: null,
      eligibleTargets: [],
      decidedAt: new Date(now).toISOString(),
      correlationId: "corr_p3s2_appointment",
      requestDigest,
    };
  }
});

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
