import { createHash } from "node:crypto";

import type {
  CoordinationAuthorizationDecision,
  DailyTimelineQuery,
  HandoffTaskRequest,
} from "@lifebridge/contracts";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CoordinationService } from "./coordination-service.js";
import { migrateCareDatabase } from "./migration.js";

const databaseUrl = process.env.CARE_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration("P3-S1 Care-owned timeline and handoff PostgreSQL boundary", () => {
  let pool: Pool;
  let service: CoordinationService;
  const clock = { value: Date.parse("2026-07-26T12:00:00.000Z") };
  let sequence = 0;

  beforeAll(async () => {
    await migrateCareDatabase(databaseUrl!);
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
  });

  beforeEach(async () => {
    await pool.query(`
      TRUNCATE care_task_handoffs, care_timeline_events, care_outbox,
               care_audit, care_idempotency, care_tasks
      RESTART IDENTITY CASCADE
    `);
    clock.value = Date.parse("2026-07-26T12:00:00.000Z");
    sequence = 0;
    service = new CoordinationService(pool, {
      cursorKey: Buffer.alloc(32, 7),
      now: () => new Date(clock.value),
      id: (prefix) => `${prefix}_p3_${++sequence}`,
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("uses explicit 23/24/25-hour local-day boundaries", async () => {
    const cases = [
      {
        localDate: "2026-03-08",
        displayTimeZone: "America/New_York",
        hours: 23,
      },
      {
        localDate: "2026-11-01",
        displayTimeZone: "America/New_York",
        hours: 25,
      },
      {
        localDate: "2026-07-26",
        displayTimeZone: "Asia/Bangkok",
        hours: 24,
      },
    ] as const;
    for (const item of cases) {
      const query: DailyTimelineQuery = {
        localDate: item.localDate,
        displayTimeZone: item.displayTimeZone,
        filter: "all",
        limit: 25,
      };
      const projection = await service.dailyTimeline({
        householdId: "household_p3",
        query,
        authorization: decision(
          "coordination.timeline.read",
          digest({
            operation: "timeline.read",
            householdId: "household_p3",
            query,
          }),
          clock.value,
        ),
        correlationId: "corr_p3_timeline",
      });
      expect(
        (Date.parse(projection.dayEndUtc) - Date.parse(projection.dayStartUtc)) / 3_600_000,
      ).toBe(item.hours);
      expect(Object.hasOwn(projection, "total")).toBe(false);
    }
  });

  it("orders equal instants by stable event ref and seals snapshot keyset continuation", async () => {
    await seedTask("task_p3_a", "Title sentinel A");
    await seedTask("task_p3_b", "Title sentinel B");
    const occurredAt = "2026-07-26T03:00:00.000Z";
    await seedTimeline("event_b", "task_p3_b", occurredAt, 1);
    await seedTimeline("event_a", "task_p3_a", occurredAt, 1);

    const firstQuery: DailyTimelineQuery = {
      localDate: "2026-07-26",
      displayTimeZone: "Asia/Bangkok",
      filter: "all",
      limit: 1,
    };
    const first = await service.dailyTimeline({
      householdId: "household_p3",
      query: firstQuery,
      authorization: timelineDecision(firstQuery),
      correlationId: "corr_p3_timeline",
    });
    expect(first.items.map((item) => item.eventRef)).toEqual(["event_a"]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.nextCursor).not.toContain("event_a");

    await seedTask("task_p3_late", "Late clock sentinel");
    await seedTimeline("event_0_late", "task_p3_late", "2026-07-26T02:00:00.000Z", 1);
    const nextQuery: DailyTimelineQuery = { ...firstQuery, cursor: first.nextCursor! };
    const next = await service.dailyTimeline({
      householdId: "household_p3",
      query: nextQuery,
      authorization: timelineDecision(nextQuery),
      correlationId: "corr_p3_timeline",
    });
    expect(next.items.map((item) => item.eventRef)).toEqual(["event_b"]);
    expect(next.items.some((item) => item.eventRef === "event_0_late")).toBe(false);

    await expect(
      service.dailyTimeline({
        householdId: "household_p3",
        query: { ...nextQuery, cursor: `${first.nextCursor}tampered` },
        authorization: timelineDecision({
          ...nextQuery,
          cursor: `${first.nextCursor}tampered`,
        }),
        correlationId: "corr_p3_timeline",
      }),
    ).rejects.toMatchObject({ code: "TIMELINE_CURSOR_INVALID" });

    await expect(
      service.dailyTimeline({
        householdId: "household_p3",
        query: nextQuery,
        authorization: {
          ...timelineDecision(nextQuery),
          grantVersion: 2,
        },
        correlationId: "corr_p3_timeline",
      }),
    ).rejects.toMatchObject({ code: "TIMELINE_CURSOR_INVALID" });
  });

  it("atomically hands off with optimistic concurrency and digest-only idempotency", async () => {
    await seedTask("task_p3_handoff", "Handoff title sentinel");
    const request: HandoffTaskRequest = {
      operation: "handoff",
      expectedTaskVersion: 1,
      expectedFromActorRef: "actor_ref_current",
      toActorRef: "actor_ref_target",
      reasonCode: "availability_changed",
      effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
    };
    const authorization = handoffDecision(request);
    const input = {
      householdId: "household_p3",
      taskId: "task_p3_handoff",
      request,
      authorization,
      correlationId: "corr_p3_handoff",
    } as const;
    const [left, right] = await Promise.allSettled([
      service.handoff({ ...input, idempotencyKey: "p3-handoff-key-left" }),
      service.handoff({ ...input, idempotencyKey: "p3-handoff-key-right" }),
    ]);
    const outcomes = [left, right].map((result) =>
      result.status === "fulfilled"
        ? { status: result.status }
        : {
            status: result.status,
            code:
              result.reason instanceof Error
                ? ((result.reason as Error & { code?: string }).code ?? result.reason.name)
                : "non_error",
            message: result.reason instanceof Error ? result.reason.message : "non_error",
          },
    );
    if (outcomes.every((outcome) => outcome.status === "rejected")) {
      throw new Error(`HANDOFF_CONCURRENCY_OUTCOMES_${JSON.stringify(outcomes)}`);
    }
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    let accepted;
    let acceptedKey;
    if (left.status === "fulfilled") {
      accepted = left.value;
      acceptedKey = "p3-handoff-key-left";
    } else if (right.status === "fulfilled") {
      accepted = right.value;
      acceptedKey = "p3-handoff-key-right";
    } else {
      throw new Error("one handoff should succeed");
    }
    expect(accepted).toMatchObject({
      taskVersion: 2,
      outcome: "accepted",
      notificationDelivery: "pending",
    });

    const replay = await service.handoff({
      ...input,
      idempotencyKey: acceptedKey,
    });
    expect(replay).toEqual(accepted);
    await expect(
      service.handoff({
        ...input,
        request: { ...request, reasonCode: "schedule_conflict" },
        authorization: handoffDecision({ ...request, reasonCode: "schedule_conflict" }),
        idempotencyKey: acceptedKey,
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });

    const task = await pool.query<{ assignee_id: string; version: number }>(
      `SELECT assignee_id, version FROM care_tasks WHERE task_id = 'task_p3_handoff'`,
    );
    expect(task.rows).toEqual([{ assignee_id: "account_target", version: 2 }]);
    for (const table of [
      "care_task_handoffs",
      "care_timeline_events",
      "care_outbox",
      "care_audit",
    ]) {
      const count = await pool.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM ${table}`,
      );
      expect(count.rows[0]?.count).toBe(1);
    }
    const persisted = await pool.query<{ payload: string; idempotency_key: string }>(
      `SELECT outbox.payload::text, idempotency.idempotency_key
       FROM care_outbox AS outbox
       CROSS JOIN care_idempotency AS idempotency
       WHERE idempotency.operation = 'task.handoff'`,
    );
    expect(persisted.rows[0]?.payload).not.toContain("Handoff title sentinel");
    expect(persisted.rows[0]?.idempotency_key).not.toContain("p3-handoff-key");
  });

  it("rejects completed state and stale or cross-scope authority without writes", async () => {
    await seedTask("task_p3_completed", "Completed sentinel", "completed");
    const request: HandoffTaskRequest = {
      operation: "handoff",
      expectedTaskVersion: 1,
      expectedFromActorRef: "actor_ref_current",
      toActorRef: "actor_ref_target",
      reasonCode: "coverage_update",
      effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
    };
    await expect(
      service.handoff({
        householdId: "household_p3",
        taskId: "task_p3_completed",
        request,
        idempotencyKey: "p3-completed-reject",
        authorization: handoffDecision(request, "task_p3_completed"),
        correlationId: "corr_p3_handoff",
      }),
    ).rejects.toMatchObject({ code: "HANDOFF_STATE_CONFLICT" });

    await seedTask("task_p3_cross_scope", "Cross-scope sentinel");
    const crossScope = {
      ...handoffDecision(request, "task_p3_cross_scope"),
      householdId: "household_other",
      requestDigest: digest({
        operation: "task.handoff",
        householdId: "household_other",
        taskId: "task_p3_cross_scope",
        request,
      }),
    };
    await expect(
      service.handoff({
        householdId: "household_other",
        taskId: "task_p3_cross_scope",
        request,
        idempotencyKey: "p3-cross-scope-reject",
        authorization: crossScope,
        correlationId: "corr_p3_handoff",
      }),
    ).rejects.toMatchObject({ code: "COORDINATION_RESOURCE_NOT_FOUND" });

    await expect(
      service.handoff({
        householdId: "household_p3",
        taskId: "task_p3_cross_scope",
        request,
        idempotencyKey: "p3-stale-decision-reject",
        authorization: {
          ...handoffDecision(request, "task_p3_cross_scope"),
          decidedAt: new Date(clock.value - 10_001).toISOString(),
        },
        correlationId: "corr_p3_handoff",
      }),
    ).rejects.toMatchObject({ code: "COORDINATION_RESOURCE_NOT_FOUND" });
    const evidence = await pool.query<{ count: number }>(
      `SELECT
        (SELECT COUNT(*) FROM care_task_handoffs)
        + (SELECT COUNT(*) FROM care_outbox)
        + (SELECT COUNT(*) FROM care_audit) AS count`,
    );
    expect(Number(evidence.rows[0]?.count)).toBe(0);
  });

  it("cleans only expired handoff idempotency evidence", async () => {
    await pool.query(
      `INSERT INTO care_idempotency (
        operation, actor_id, idempotency_key, request_hash,
        response_status, response_body, created_at, expires_at
      ) VALUES
        ('task.handoff','account_current','expired_digest','request_digest',200,'{}',
         $1::timestamptz - INTERVAL '25 hours',$1::timestamptz),
        ('task.handoff','account_current','active_digest','request_digest',200,'{}',
         $1::timestamptz,$1::timestamptz + INTERVAL '24 hours'),
        ('task.complete','account_current','other_digest','request_digest',200,'{}',
         $1::timestamptz - INTERVAL '25 hours',$1::timestamptz)`,
      [new Date(clock.value)],
    );

    await expect(service.cleanupExpiredIdempotency()).resolves.toBe(1);
    const retained = await pool.query<{ operation: string; idempotency_key: string }>(
      `SELECT operation, idempotency_key
       FROM care_idempotency
       ORDER BY operation, idempotency_key`,
    );
    expect(retained.rows).toEqual([
      { operation: "task.complete", idempotency_key: "other_digest" },
      { operation: "task.handoff", idempotency_key: "active_digest" },
    ]);
  });

  function timelineDecision(query: DailyTimelineQuery) {
    return decision(
      "coordination.timeline.read",
      digest({ operation: "timeline.read", householdId: "household_p3", query }),
      clock.value,
    );
  }

  function handoffDecision(
    request: HandoffTaskRequest,
    taskId = "task_p3_handoff",
  ): CoordinationAuthorizationDecision {
    return {
      ...decision(
        "coordination.task.handoff",
        digest({
          operation: "task.handoff",
          householdId: "household_p3",
          taskId,
          request,
        }),
        clock.value,
      ),
      target: {
        actorId: "account_target",
        actorRef: "actor_ref_target",
        displayKey: "coordination.actor.household_member",
        subject: true,
      },
      eligibleTargets: [
        {
          actorId: "account_target",
          actorRef: "actor_ref_target",
          displayKey: "coordination.actor.household_member",
          subject: true,
        },
      ],
    };
  }

  async function seedTask(taskId: string, title: string, status: "open" | "completed" = "open") {
    await pool.query(
      `INSERT INTO care_tasks (
        task_id, household_id, care_recipient_id, title, description,
        assignee_id, created_by, due_at, due_time_zone, priority,
        status, version, created_at, completed_by, completed_at
      ) VALUES (
        $1, 'household_p3', 'recipient_p3', $2, 'description sentinel',
        'account_current', 'account_current', '2026-07-27T00:00:00Z',
        'Asia/Bangkok', 'normal', $3, 1, '2026-07-26T00:00:00Z',
        $4, $5
      )`,
      [
        taskId,
        title,
        status,
        status === "completed" ? "account_current" : null,
        status === "completed" ? "2026-07-26T01:00:00Z" : null,
      ],
    );
  }

  async function seedTimeline(
    eventRef: string,
    taskId: string,
    occurredAt: string,
    taskVersion: number,
  ) {
    await pool.query(
      `INSERT INTO care_timeline_events (
        event_ref, household_id, recipient_context_id, task_id, task_version,
        event_kind, actor_id, actor_ref, occurred_at, recorded_at
      ) VALUES ($1,'household_p3','recipient_p3',$2,$3,'task_created',
                'account_current','actor_ref_current',$4,$4)`,
      [eventRef, taskId, taskVersion, occurredAt],
    );
  }
});

function decision(
  permission: "coordination.timeline.read" | "coordination.task.handoff",
  requestDigest: string,
  decidedAt: number,
): CoordinationAuthorizationDecision {
  return {
    decisionId: "decision_p3",
    permission,
    actor: {
      actorId: "account_current",
      actorRef: "actor_ref_current",
      displayKey: "coordination.actor.you",
      subject: false,
    },
    householdId: "household_p3",
    recipientContextId: "recipient_p3",
    subjectId: "subject_p3",
    subjectVersion: 2,
    grantId: "grant_p3",
    grantVersion: 1,
    privacyVersion: 2,
    target: null,
    eligibleTargets: [],
    decidedAt: new Date(decidedAt).toISOString(),
    correlationId:
      permission === "coordination.timeline.read" ? "corr_p3_timeline" : "corr_p3_handoff",
    requestDigest,
  };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}
