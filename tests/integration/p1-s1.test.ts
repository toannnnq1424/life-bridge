import {
  FIXED_TEST_TIME,
  FIXTURE_ASSIGNEE_ID,
  FIXTURE_CARE_RECIPIENT_ID,
  FIXTURE_CREATOR_ID,
  FIXTURE_HOUSEHOLD_ID,
  FIXTURE_SECOND_CREATOR_ID,
  FIXTURE_SECOND_HOUSEHOLD_ID,
  FIXTURE_SECOND_MEMBER_ID,
} from "@lifebridge/test-fixtures";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OutboxDispatcher } from "../../services/care-coordination/src/dispatcher.js";
import { CoordinationService } from "../../services/care-coordination/src/coordination-service.js";
import { CareError } from "../../services/care-coordination/src/errors.js";
import { migrateCareDatabase } from "../../services/care-coordination/src/migration.js";
import {
  type ClaimedOutboxEvent,
  CareService,
} from "../../services/care-coordination/src/service.js";
import { migrateNotificationDatabase } from "../../services/notification/src/migration.js";
import { NotificationService } from "../../services/notification/src/service.js";

const careUrl = required("CARE_DATABASE_URL");
const notificationUrl = required("NOTIFICATION_DATABASE_URL");
const carePool = new Pool({ connectionString: careUrl, max: 5 });
const notificationPool = new Pool({ connectionString: notificationUrl, max: 5 });
const fixedNow = () => new Date(FIXED_TEST_TIME);

beforeAll(async () => {
  await Promise.all([migrateCareDatabase(careUrl), migrateNotificationDatabase(notificationUrl)]);
});

beforeEach(async () => {
  await carePool.query(
    `TRUNCATE care_event_recovery_audit, care_delivery_attempts, care_task_handoffs,
              care_timeline_events, care_idempotency, care_audit, care_outbox,
              care_tasks RESTART IDENTITY CASCADE`,
  );
  await notificationPool.query(
    "TRUNCATE notification_event_heads, notifications, notification_inbox RESTART IDENTITY CASCADE",
  );
});

afterAll(async () => {
  await Promise.all([carePool.end(), notificationPool.end()]);
});

describe("P1-S1 accountable care-task loop", () => {
  it("creates with no notification, completes once under concurrency, and notifies the distinct creator once", async () => {
    const care = new CareService(carePool, { now: fixedNow });
    const notification = new NotificationService(notificationPool, fixedNow);
    const created = await createAssignedTask(care);

    expect(created.notificationDelivery).toBe("not_started");
    expect(await care.countRows("care_outbox")).toBe(0);
    expect(await notification.countRows("notifications")).toBe(0);

    const complete = {
      actorId: FIXTURE_ASSIGNEE_ID,
      taskId: created.taskId,
      idempotencyKey: "idem_complete_primary",
      correlationId: "corr_primary_complete",
      request: { operation: "complete" as const, expectedVersion: 1 },
    };
    const [first, replay] = await Promise.all([
      care.completeTask(complete),
      care.completeTask(complete),
    ]);

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      completedBy: FIXTURE_ASSIGNEE_ID,
      notificationDelivery: "pending",
      status: "completed",
      version: 2,
    });
    expect(await care.countRows("care_outbox")).toBe(1);

    let captured: ClaimedOutboxEvent["event"] | undefined;
    const dispatcher = new OutboxDispatcher(care, async (event) => {
      captured = event;
      return notification.consume(event);
    });
    const dispatchResults = await Promise.all([
      dispatcher.dispatchOnce(),
      dispatcher.dispatchOnce(),
    ]);
    expect(dispatchResults.sort()).toEqual(["delivered", "idle"]);
    expect(captured?.payload).toMatchObject({
      notificationDisposition: "deliver",
      recipientId: FIXTURE_CREATOR_ID,
      completedBy: FIXTURE_ASSIGNEE_ID,
    });

    const duplicate = await notification.consume(captured);
    expect(duplicate.result).toBe("duplicate");
    expect(await notification.countRows("notification_inbox")).toBe(1);
    expect(await notification.countRows("notifications")).toBe(1);
    expect(await notification.list(FIXTURE_CREATOR_ID)).toHaveLength(1);
    expect(await notification.list(FIXTURE_ASSIGNEE_ID)).toHaveLength(0);
    expect((await care.getTask(FIXTURE_CREATOR_ID, created.taskId)).notificationDelivery).toBe(
      "delivered",
    );
    expect(await care.countRows("care_audit")).toBe(2);
  });

  it("records but suppresses a self-completion notification", async () => {
    const care = new CareService(carePool, { now: fixedNow });
    const notification = new NotificationService(notificationPool, fixedNow);
    const created = await createAssignedTask(care, {
      assigneeId: FIXTURE_CREATOR_ID,
      idempotencyKey: "idem_create_self",
    });
    await care.completeTask({
      actorId: FIXTURE_CREATOR_ID,
      taskId: created.taskId,
      idempotencyKey: "idem_complete_self",
      correlationId: "corr_complete_self",
      request: { operation: "complete", expectedVersion: 1 },
    });

    const dispatcher = new OutboxDispatcher(care, (event) => notification.consume(event));
    expect(await dispatcher.dispatchOnce()).toBe("delivered");
    expect(await notification.countRows("notification_inbox")).toBe(1);
    expect(await notification.countRows("notifications")).toBe(0);
    expect((await care.getTask(FIXTURE_CREATOR_ID, created.taskId)).notificationDelivery).toBe(
      "suppressed",
    );
  });

  it("rejects unauthorized mutation, stale versions, and idempotency-key payload reuse", async () => {
    const care = new CareService(carePool, { now: fixedNow });

    await expect(
      createAssignedTask(care, {
        actorId: FIXTURE_ASSIGNEE_ID,
        idempotencyKey: "idem_create_denied",
      }),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND", statusCode: 404 });

    const created = await createAssignedTask(care);
    await expect(
      care.completeTask({
        actorId: FIXTURE_CREATOR_ID,
        taskId: created.taskId,
        idempotencyKey: "idem_complete_denied",
        correlationId: "corr_complete_denied",
        request: { operation: "complete", expectedVersion: 1 },
      }),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND", statusCode: 404 });

    await expect(
      care.completeTask({
        actorId: FIXTURE_ASSIGNEE_ID,
        taskId: created.taskId,
        idempotencyKey: "idem_complete_stale",
        correlationId: "corr_complete_stale",
        request: { operation: "complete", expectedVersion: 9 },
      }),
    ).rejects.toMatchObject({
      code: "TASK_VERSION_CONFLICT",
      currentTask: { taskId: created.taskId, version: 1 },
    });

    await expect(
      createAssignedTask(care, {
        idempotencyKey: "idem_create_primary",
        title: "A changed payload",
      }),
    ).rejects.toBeInstanceOf(CareError);
    await expect(
      createAssignedTask(care, {
        idempotencyKey: "idem_create_primary",
        title: "A changed payload",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", statusCode: 409 });
  });

  it("does not disclose a second household through list, detail, or mutation", async () => {
    const care = new CareService(carePool, { now: fixedNow });
    const foreign = await care.createTask({
      actorId: FIXTURE_SECOND_CREATOR_ID,
      householdId: FIXTURE_SECOND_HOUSEHOLD_ID,
      idempotencyKey: "idem_second_household_create",
      correlationId: "corr_second_household_create",
      request: {
        title: "Synthetic second household task",
        description: "Isolation fixture",
        assigneeId: FIXTURE_SECOND_MEMBER_ID,
        careRecipientId: "person_binh",
        dueAt: "2026-08-04T10:30:00+07:00",
        dueTimeZone: "Asia/Bangkok",
        priority: "normal",
      },
    });

    await expect(
      care.listTasks(FIXTURE_CREATOR_ID, FIXTURE_SECOND_HOUSEHOLD_ID),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND", statusCode: 404 });
    await expect(care.getTask(FIXTURE_CREATOR_ID, foreign.task.taskId)).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
      statusCode: 404,
    });
    await expect(
      care.completeTask({
        actorId: FIXTURE_CREATOR_ID,
        taskId: foreign.task.taskId,
        idempotencyKey: "idem_foreign_complete",
        correlationId: "corr_foreign_complete",
        request: { operation: "complete", expectedVersion: 1 },
      }),
    ).rejects.toMatchObject({ code: "TASK_NOT_FOUND", statusCode: 404 });
    expect((await care.getTask(FIXTURE_SECOND_CREATOR_ID, foreign.task.taskId)).taskId).toBe(
      foreign.task.taskId,
    );
  });

  it("keeps completion durable through notification outage and retries the same event", async () => {
    const care = new CareService(carePool, { now: fixedNow });
    const notification = new NotificationService(notificationPool, fixedNow);
    const created = await createAssignedTask(care, {
      idempotencyKey: "idem_create_outage",
    });
    await care.completeTask({
      actorId: FIXTURE_ASSIGNEE_ID,
      taskId: created.taskId,
      idempotencyKey: "idem_complete_outage",
      correlationId: "corr_complete_outage",
      request: { operation: "complete", expectedVersion: 1 },
    });

    const unavailable = new OutboxDispatcher(
      care,
      async () => {
        throw new Error("NOTIFICATION_UNAVAILABLE");
      },
      3,
    );
    expect(await unavailable.dispatchOnce()).toBe("failed");
    expect((await care.getTask(FIXTURE_CREATOR_ID, created.taskId)).status).toBe("completed");
    expect((await care.getTask(FIXTURE_CREATOR_ID, created.taskId)).notificationDelivery).toBe(
      "retrying",
    );
    expect(await notification.countRows("notifications")).toBe(0);

    await carePool.query("UPDATE care_outbox SET next_attempt_at = $2 WHERE aggregate_id = $1", [
      created.taskId,
      fixedNow(),
    ]);
    const recovered = new OutboxDispatcher(care, (event) => notification.consume(event), 3);
    expect(await recovered.dispatchOnce()).toBe("delivered");
    expect(await notification.list(FIXTURE_CREATOR_ID)).toHaveLength(1);
    expect((await care.getTask(FIXTURE_CREATOR_ID, created.taskId)).notificationDelivery).toBe(
      "delivered",
    );
  });

  it("survives a service-pool restart and preserves the explicit due-time-zone fact", async () => {
    const firstPool = new Pool({ connectionString: careUrl, max: 2 });
    const first = new CareService(firstPool, { now: fixedNow });
    const created = await createAssignedTask(first, {
      idempotencyKey: "idem_create_restart",
      dueAt: "2026-11-01T01:30:00-04:00",
      dueTimeZone: "America/New_York",
    });
    await firstPool.end();

    const restartedPool = new Pool({ connectionString: careUrl, max: 2 });
    try {
      const restarted = new CareService(restartedPool, { now: fixedNow });
      const persisted = await restarted.getTask(FIXTURE_CREATOR_ID, created.taskId);
      expect(persisted.dueAt).toBe("2026-11-01T05:30:00.000Z");
      expect(persisted.dueTimeZone).toBe("America/New_York");
      expect(persisted.status).toBe("open");
    } finally {
      await restartedPool.end();
    }
  });

  it("delivers one privacy-minimized handoff notification from durable outbox evidence", async () => {
    const care = new CareService(carePool, { now: fixedNow });
    const notification = new NotificationService(notificationPool, fixedNow);
    const created = await createAssignedTask(care, {
      idempotencyKey: "idem_create_handoff_notification",
      title: "Private title sentinel not for notification",
    });
    const coordination = new CoordinationService(carePool, {
      cursorKey: Buffer.alloc(32, 9),
      now: fixedNow,
      id: (() => {
        let id = 0;
        return (prefix: string) => `${prefix}_notify_${++id}`;
      })(),
    });
    const request: HandoffTaskRequest = {
      operation: "handoff",
      expectedTaskVersion: 1,
      expectedFromActorRef: "actor_ref_assignee",
      toActorRef: "actor_ref_creator",
      reasonCode: "coverage_update",
      effectiveTime: { mode: "immediate", displayTimeZone: "Asia/Bangkok" },
    };
    const requestDigest = createHash("sha256")
      .update(
        JSON.stringify({
          operation: "task.handoff",
          householdId: FIXTURE_HOUSEHOLD_ID,
          taskId: created.taskId,
          request,
        }),
      )
      .digest("hex");
    const authorization: CoordinationAuthorizationDecision = {
      decisionId: "decision_notify",
      permission: "coordination.task.handoff",
      actor: {
        actorId: FIXTURE_ASSIGNEE_ID,
        actorRef: "actor_ref_assignee",
        displayKey: "coordination.actor.you",
        subject: false,
      },
      householdId: FIXTURE_HOUSEHOLD_ID,
      recipientContextId: FIXTURE_CARE_RECIPIENT_ID,
      subjectId: "subject_notify",
      subjectVersion: 2,
      grantId: "grant_notify",
      grantVersion: 1,
      privacyVersion: 2,
      target: {
        actorId: FIXTURE_CREATOR_ID,
        actorRef: "actor_ref_creator",
        displayKey: "coordination.actor.household_member",
        subject: true,
      },
      eligibleTargets: [],
      decidedAt: fixedNow().toISOString(),
      correlationId: "corr_handoff_notify",
      requestDigest,
    };
    const result = await coordination.handoff({
      householdId: FIXTURE_HOUSEHOLD_ID,
      taskId: created.taskId,
      request,
      idempotencyKey: "idem_handoff_notification",
      authorization,
      correlationId: "corr_handoff_notify",
    });
    expect(result.notificationDelivery).toBe("pending");

    let serializedEvent = "";
    const dispatcher = new OutboxDispatcher(care, async (event) => {
      serializedEvent = JSON.stringify(event);
      return notification.consume(event);
    });
    expect(await dispatcher.dispatchOnce()).toBe("delivered");
    const notifications = await notification.list(FIXTURE_CREATOR_ID);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      messageKey: "notifications.task.handed_off",
      sourceTaskId: created.taskId,
    });
    expect(serializedEvent).not.toContain("Private title sentinel");
    expect(serializedEvent).not.toContain("idem_handoff_notification");
  });
});

async function createAssignedTask(
  care: CareService,
  overrides: {
    actorId?: string;
    assigneeId?: string;
    dueAt?: string;
    dueTimeZone?: string;
    idempotencyKey?: string;
    title?: string;
  } = {},
) {
  const result = await care.createTask({
    actorId: overrides.actorId ?? FIXTURE_CREATOR_ID,
    householdId: FIXTURE_HOUSEHOLD_ID,
    idempotencyKey: overrides.idempotencyKey ?? "idem_create_primary",
    correlationId: "corr_create_primary",
    request: {
      title: overrides.title ?? "Prepare the family check-in",
      description: "Synthetic coordination fixture",
      assigneeId: overrides.assigneeId ?? FIXTURE_ASSIGNEE_ID,
      careRecipientId: FIXTURE_CARE_RECIPIENT_ID,
      dueAt: overrides.dueAt ?? "2026-08-04T09:30:00+07:00",
      dueTimeZone: overrides.dueTimeZone ?? "Asia/Bangkok",
      priority: "important",
    },
  });
  return result.task;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}_REQUIRED`);
  }
  return value;
}
import { createHash } from "node:crypto";

import type { CoordinationAuthorizationDecision, HandoffTaskRequest } from "@lifebridge/contracts";
