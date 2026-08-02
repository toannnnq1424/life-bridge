import { randomUUID } from "node:crypto";

import {
  FIXED_TEST_TIME,
  FIXTURE_ASSIGNEE_ID,
  FIXTURE_CARE_RECIPIENT_ID,
  FIXTURE_CREATOR_ID,
  FIXTURE_HOUSEHOLD_ID,
} from "../../../packages/test-fixtures/src/index.js";
import { Pool } from "pg";

import { OutboxDispatcher } from "../../../services/care-coordination/src/dispatcher.js";
import { migrateCareDatabase } from "../../../services/care-coordination/src/migration.js";
import { CareService } from "../../../services/care-coordination/src/service.js";
import { migrateNotificationDatabase } from "../../../services/notification/src/migration.js";
import {
  EventIdReusedError,
  NotificationService,
  OutOfOrderEventError,
} from "../../../services/notification/src/service.js";

const adminUrl = required("P7_ADMIN_DATABASE_URL");
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const careDatabase = `lifebridge_p7s2_care_${suffix}`;
const notificationDatabase = `lifebridge_p7s2_notification_${suffix}`;
const admin = new Pool({ connectionString: adminUrl, max: 1 });
const databaseUrl = (name: string) => {
  const value = new URL(adminUrl);
  value.pathname = `/${name}`;
  return value.toString();
};

try {
  await admin.query(`CREATE DATABASE ${careDatabase}`);
  await admin.query(`CREATE DATABASE ${notificationDatabase}`);
  const careUrl = databaseUrl(careDatabase);
  const notificationUrl = databaseUrl(notificationDatabase);
  await migrateCareDatabase(careUrl);
  await migrateNotificationDatabase(notificationUrl);
  const carePool = new Pool({ connectionString: careUrl, max: 6 });
  const notificationPool = new Pool({ connectionString: notificationUrl, max: 6 });
  try {
    let clock = new Date(FIXED_TEST_TIME);
    const now = () => new Date(clock);
    const care = new CareService(carePool, { now });
    const notification = new NotificationService(notificationPool, now);
    const created = await care.createTask({
      actorId: FIXTURE_CREATOR_ID,
      householdId: FIXTURE_HOUSEHOLD_ID,
      idempotencyKey: "idem_p7s2_create",
      correlationId: "corr_p7s2_create",
      request: {
        title: "Synthetic replay boundary",
        description: "Synthetic only",
        assigneeId: FIXTURE_ASSIGNEE_ID,
        careRecipientId: FIXTURE_CARE_RECIPIENT_ID,
        dueAt: "2026-08-04T09:30:00+07:00",
        dueTimeZone: "Asia/Bangkok",
        priority: "important",
      },
    });
    await care.completeTask({
      actorId: FIXTURE_ASSIGNEE_ID,
      taskId: created.task.taskId,
      idempotencyKey: "idem_p7s2_complete",
      correlationId: "corr_p7s2_complete",
      request: { operation: "complete", expectedVersion: 1 },
    });
    const sourceBefore = await carePool.query("SELECT task_id,status,version FROM care_tasks");
    const stale = await care.claimOutbox();
    assert(stale, "FIRST_CLAIM_MISSING");
    clock = new Date(clock.getTime() + 6_000);
    const current = await care.claimOutbox();
    assert(current, "LEASE_RECLAIM_MISSING");
    const [firstConsume, secondConsume] = await Promise.all([
      notification.consume(current.event),
      notification.consume(current.event),
    ]);
    assert(
      new Set([firstConsume.result, secondConsume.result]).has("duplicate"),
      "CONCURRENT_DUPLICATE_NOT_DEDUPED",
    );
    assert(
      await care.markOutboxAcknowledged(
        current.event.eventId,
        current.claimToken,
        firstConsume.result,
      ),
      "CURRENT_ACK_REJECTED",
    );
    assert(
      !(await care.markOutboxFailed(stale.event.eventId, stale.claimToken, "LATE_FAILURE", 1, 3)),
      "STALE_WORKER_REGRESSED_STATE",
    );
    assert((await notification.countRows("notifications")) === 1, "DUPLICATE_DURABLE_RESULT");
    const sourceAfter = await carePool.query("SELECT task_id,status,version FROM care_tasks");
    assert(
      JSON.stringify(sourceBefore.rows) === JSON.stringify(sourceAfter.rows),
      "SOURCE_TRUTH_CHANGED",
    );

    const newer = { ...current.event, eventId: "evt_order_new", aggregateVersion: 4 };
    const older = { ...current.event, eventId: "evt_order_old", aggregateVersion: 3 };
    await notification.consume(newer);
    await expectError(() => notification.consume(older), OutOfOrderEventError);
    await expectError(
      () =>
        notification.consume({
          ...newer,
          payload: { ...newer.payload, completedBy: "member_changed" },
        }),
      EventIdReusedError,
    );

    await carePool.query(
      `UPDATE care_outbox SET status='attention_required',terminal_at=$2,last_error_code='POISON'
       WHERE event_id=$1`,
      [current.event.eventId, now()],
    );
    const preview = await care.replayEvent({
      eventId: current.event.eventId,
      operatorId: "operator_synthetic",
      reasonCode: "verified_recovery",
      correlationId: "corr_recovery_preview",
      dryRun: true,
    });
    assert(preview.afterState === "attention_required", "DRY_RUN_MUTATED");
    const replay = await care.replayEvent({
      eventId: current.event.eventId,
      operatorId: "operator_synthetic",
      reasonCode: "verified_recovery",
      correlationId: "corr_recovery_execute",
      dryRun: false,
    });
    assert(replay.afterState === "pending", "REPLAY_NOT_REQUEUED");
    assert(
      Number(
        (await carePool.query("SELECT count(*) FROM care_event_recovery_audit")).rows[0]?.count,
      ) === 2,
      "RECOVERY_AUDIT_MISSING",
    );
    const recovered = new OutboxDispatcher(care, (event) => notification.consume(event));
    assert((await recovered.dispatchOnce()) === "delivered", "REPLAY_DELIVERY_FAILED");
    assert((await notification.countRows("notifications")) === 2, "REPLAY_DUPLICATED_RESULT");
    await carePool.query(
      `UPDATE care_outbox SET status='retrying',attempt_count=max_attempts,
         lease_expires_at=$2,terminal_at=NULL WHERE event_id=$1`,
      [current.event.eventId, new Date(now().getTime() - 1)],
    );
    assert((await care.claimOutbox()) === null, "EXHAUSTED_CRASH_RECLAIMED");
    assert(
      (await care.deliveryEvidence(current.event.eventId))?.state === "attention_required",
      "EXHAUSTED_CRASH_NOT_TERMINAL",
    );
    console.log("P7-S2 deterministic event recovery validation passed.");
  } finally {
    await carePool.end();
    await notificationPool.end();
  }
} finally {
  for (const database of [careDatabase, notificationDatabase]) {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [
      database,
    ]);
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  }
  await admin.end();
}

function assert(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function expectError(action: () => Promise<unknown>, expected: new () => Error) {
  try {
    await action();
  } catch (error) {
    if (error instanceof expected) return;
    throw error;
  }
  throw new Error(`EXPECTED_${expected.name}`);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
