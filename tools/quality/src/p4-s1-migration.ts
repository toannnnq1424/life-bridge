import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const careDatabase = `lifebridge_p4s1_care_upgrade_${process.pid}`;
const notificationDatabase = `lifebridge_p4s1_notification_upgrade_${process.pid}`;
for (const name of [careDatabase, notificationDatabase]) {
  if (!/^[a-z0-9_]{1,63}$/.test(name)) throw new Error("P4_S1_DATABASE_NAME_INVALID");
}

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let care: Pool | undefined;
let notification: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${careDatabase} OWNER lifebridge_care`);
  await admin.query(`CREATE DATABASE ${notificationDatabase} OWNER lifebridge_notification`);
  care = new Pool({ connectionString: databaseUrl(adminUrl, careDatabase), max: 1 });
  notification = new Pool({
    connectionString: databaseUrl(adminUrl, notificationDatabase),
    max: 1,
  });

  const [
    careInitial,
    timeline,
    appointments,
    carePlan,
    medication,
    notificationInitial,
    appointmentIntent,
    delivery,
  ] = await Promise.all([
    migration("services/care-coordination/migrations/001_initial.sql"),
    migration("services/care-coordination/migrations/002_daily_timeline_handoff.sql"),
    migration("services/care-coordination/migrations/003_calendar_appointments.sql"),
    migration("services/care-coordination/migrations/004_care_plan_review.sql"),
    migration("services/care-coordination/migrations/005_medication_reminders.sql"),
    migration("services/notification/migrations/001_initial.sql"),
    migration("services/notification/migrations/002_appointment_reminder_intent.sql"),
    migration("services/notification/migrations/003_medication_reminder_delivery.sql"),
  ]);

  for (const sql of [careInitial, timeline, appointments, carePlan]) {
    await apply(care, sql);
  }
  for (const sql of [notificationInitial, appointmentIntent]) {
    await apply(notification, sql);
  }
  await care.query(`
    INSERT INTO care_tasks (
      task_id, household_id, care_recipient_id, title, description,
      assignee_id, created_by, due_at, due_time_zone, priority,
      status, version, created_at
    ) VALUES (
      'task_p4_upgrade', 'household_p4_upgrade', 'recipient_p4_upgrade',
      'Synthetic upgrade task', '', 'actor_p4_upgrade', 'actor_p4_upgrade',
      '2026-08-03T01:00:00.000Z', 'Asia/Bangkok', 'normal',
      'open', 1, '2026-07-28T00:00:00.000Z'
    )
  `);
  await notification.query(`
    INSERT INTO notification_inbox (
      source_event_id, payload_hash, event_type, event_version,
      result, notification_id, processed_at
    ) VALUES (
      'event_p4_upgrade', '${"a".repeat(64)}', 'care.task.completed.v1',
      1, 'suppressed_self', NULL, '2026-07-28T00:00:00.000Z'
    )
  `);

  await expectRollback(care, medication, "forced_p4_s1_care_failure");
  await expectRollback(notification, delivery, "forced_p4_s1_notification_failure");
  const rolledBackCare = await care.query<{
    reminderTable: string | null;
    occurrenceTable: string | null;
    coverageColumn: string | null;
    schemaVersion: number;
  }>(`
    SELECT
      to_regclass('public.care_medication_reminders')::text AS "reminderTable",
      to_regclass('public.care_medication_reminder_occurrences')::text AS "occurrenceTable",
      (
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'care_schema_state'
          AND column_name = 'medication_reminder_coverage_started_at'
      ) AS "coverageColumn",
      (
        SELECT version FROM care_schema_state
        WHERE service = 'care-coordination'
      ) AS "schemaVersion"
  `);
  const rolledBackNotification = await notification.query<{
    intentTable: string | null;
    notificationTable: string | null;
    schemaTable: string | null;
  }>(`
    SELECT
      to_regclass('public.medication_reminder_intents')::text AS "intentTable",
      to_regclass('public.medication_reminder_notifications')::text AS "notificationTable",
      to_regclass('public.notification_schema_state')::text AS "schemaTable"
  `);
  if (
    rolledBackCare.rows[0]?.reminderTable !== null ||
    rolledBackCare.rows[0]?.occurrenceTable !== null ||
    rolledBackCare.rows[0]?.coverageColumn !== null ||
    rolledBackCare.rows[0]?.schemaVersion !== 4 ||
    rolledBackNotification.rows[0]?.intentTable !== null ||
    rolledBackNotification.rows[0]?.notificationTable !== null ||
    rolledBackNotification.rows[0]?.schemaTable !== null
  ) {
    throw new Error("P4_S1_MIGRATION_ROLLBACK_FAILED");
  }

  await apply(care, medication);
  await apply(care, medication);
  await apply(notification, delivery);
  await apply(notification, delivery);
  const careResult = await care.query<{
    tasks: number;
    reminders: number;
    occurrences: number;
    transitions: number;
    schemaVersion: number;
    coverage: Date;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM care_tasks) AS tasks,
      (SELECT COUNT(*)::int FROM care_medication_reminders) AS reminders,
      (SELECT COUNT(*)::int FROM care_medication_reminder_occurrences) AS occurrences,
      (SELECT COUNT(*)::int FROM care_medication_reminder_transitions) AS transitions,
      (
        SELECT version FROM care_schema_state
        WHERE service = 'care-coordination'
      ) AS "schemaVersion",
      (
        SELECT medication_reminder_coverage_started_at FROM care_schema_state
        WHERE service = 'care-coordination'
      ) AS coverage
  `);
  const notificationResult = await notification.query<{
    legacyInbox: number;
    intents: number;
    attempts: number;
    reminders: number;
    schemaVersion: number;
    coverage: Date;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM notification_inbox) AS "legacyInbox",
      (SELECT COUNT(*)::int FROM medication_reminder_intents) AS intents,
      (SELECT COUNT(*)::int FROM medication_delivery_attempts) AS attempts,
      (SELECT COUNT(*)::int FROM medication_reminder_notifications) AS reminders,
      (
        SELECT version FROM notification_schema_state
        WHERE service = 'notification'
      ) AS "schemaVersion",
      (
        SELECT medication_reminder_coverage_started_at
        FROM notification_schema_state
        WHERE service = 'notification'
      ) AS coverage
  `);
  const careRow = careResult.rows[0];
  const notificationRow = notificationResult.rows[0];
  if (
    !careRow ||
    careRow.tasks !== 1 ||
    careRow.reminders !== 0 ||
    careRow.occurrences !== 0 ||
    careRow.transitions !== 0 ||
    careRow.schemaVersion !== 5 ||
    !(careRow.coverage instanceof Date) ||
    !notificationRow ||
    notificationRow.legacyInbox !== 1 ||
    notificationRow.intents !== 0 ||
    notificationRow.attempts !== 0 ||
    notificationRow.reminders !== 0 ||
    notificationRow.schemaVersion !== 3 ||
    !(notificationRow.coverage instanceof Date)
  ) {
    throw new Error("P4_S1_MIGRATION_REAPPLY_OR_NO_BACKFILL_FAILED");
  }
  console.log("P4-S1 owner-isolated migration rollback/reapply/no-backfill validation passed.");
} finally {
  await care?.end();
  await notification?.end();
  for (const name of [careDatabase, notificationDatabase]) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [name],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
  }
  await admin.end();
}

async function migration(path: string): Promise<string> {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

async function apply(pool: Pool, sql: string): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function expectRollback(pool: Pool, sql: string, missingTable: string): Promise<void> {
  let failed = false;
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query(`SELECT 1 FROM ${missingTable}`);
    await pool.query("COMMIT");
  } catch {
    failed = true;
    await pool.query("ROLLBACK");
  }
  if (!failed) throw new Error("P4_S1_FORCED_ROLLBACK_NOT_TRIGGERED");
}

function databaseUrl(adminUrlValue: string, database: string): string {
  const value = new URL(adminUrlValue);
  value.pathname = `/${database}`;
  return value.toString();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
