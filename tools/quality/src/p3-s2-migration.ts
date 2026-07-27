import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const databaseName = `lifebridge_p3s2_upgrade_${process.pid}`;
if (!/^[a-z0-9_]{1,63}$/.test(databaseName)) {
  throw new Error("P3_S2_UPGRADE_DATABASE_NAME_INVALID");
}

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let upgrade: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${databaseName} OWNER lifebridge_care`);
  const upgradeUrl = new URL(adminUrl);
  upgradeUrl.pathname = `/${databaseName}`;
  upgrade = new Pool({ connectionString: upgradeUrl.toString(), max: 1 });
  const [careInitial, p3s1, appointment, notificationInitial, reminder] = await Promise.all([
    migration("services/care-coordination/migrations/001_initial.sql"),
    migration("services/care-coordination/migrations/002_daily_timeline_handoff.sql"),
    migration("services/care-coordination/migrations/003_calendar_appointments.sql"),
    migration("services/notification/migrations/001_initial.sql"),
    migration("services/notification/migrations/002_appointment_reminder_intent.sql"),
  ]);

  await applyTransaction(upgrade, careInitial);
  await applyTransaction(upgrade, p3s1);
  await applyTransaction(upgrade, notificationInitial);
  await upgrade.query(`
    INSERT INTO care_tasks
    (task_id, household_id, care_recipient_id, title, description, assignee_id,
     created_by, due_at, due_time_zone, priority, status, version, created_at)
    VALUES (
      'task_upgrade', 'household_upgrade', 'recipient_upgrade',
      'Synthetic upgrade task', '', 'actor_upgrade', 'actor_upgrade',
      '2026-11-01T06:30:00.000Z', 'America/New_York', 'normal', 'open', 1,
      '2026-07-26T12:00:00.000Z'
    );
    INSERT INTO notification_inbox
    (source_event_id, payload_hash, event_type, event_version, result,
     notification_id, processed_at)
    VALUES (
      'event_upgrade', '${"a".repeat(64)}', 'care.task.completed.v1', 1,
      'suppressed_self', NULL, '2026-07-26T12:00:00.000Z'
    )
  `);

  let rollbackTriggered = false;
  await upgrade.query("BEGIN");
  try {
    await upgrade.query(appointment);
    await upgrade.query(reminder);
    await upgrade.query("SELECT 1 FROM care_p3_s2_forced_failure");
    await upgrade.query("COMMIT");
  } catch {
    rollbackTriggered = true;
    await upgrade.query("ROLLBACK");
  }
  const rolledBack = await upgrade.query<{
    appointmentTable: string | null;
    transitionTable: string | null;
    reminderTable: string | null;
    coverageColumn: string | null;
  }>(
    `SELECT
       to_regclass('public.care_appointments')::text AS "appointmentTable",
       to_regclass('public.care_appointment_transitions')::text AS "transitionTable",
       to_regclass('public.appointment_reminder_intents')::text AS "reminderTable",
       (
         SELECT column_name FROM information_schema.columns
         WHERE table_name = 'care_schema_state'
           AND column_name = 'appointment_coverage_started_at'
       ) AS "coverageColumn"`,
  );
  const rollback = rolledBack.rows[0];
  if (
    !rollbackTriggered ||
    rollback?.appointmentTable !== null ||
    rollback?.transitionTable !== null ||
    rollback?.reminderTable !== null ||
    rollback?.coverageColumn !== null
  ) {
    throw new Error("P3_S2_MIGRATION_ROLLBACK_FAILED");
  }

  await applyTransaction(upgrade, appointment);
  await applyTransaction(upgrade, reminder);
  await applyTransaction(upgrade, appointment);
  await applyTransaction(upgrade, reminder);

  const preserved = await upgrade.query<{
    tasks: number;
    legacyInbox: number;
    appointments: number;
    transitions: number;
    reminders: number;
    schemaVersion: number;
    coverageStartedAt: Date;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM care_tasks) AS tasks,
       (SELECT COUNT(*)::int FROM notification_inbox) AS "legacyInbox",
       (SELECT COUNT(*)::int FROM care_appointments) AS appointments,
       (SELECT COUNT(*)::int FROM care_appointment_transitions) AS transitions,
       (SELECT COUNT(*)::int FROM appointment_reminder_intents) AS reminders,
       (SELECT version FROM care_schema_state
        WHERE service = 'care-coordination') AS "schemaVersion",
       (SELECT appointment_coverage_started_at FROM care_schema_state
        WHERE service = 'care-coordination') AS "coverageStartedAt"`,
  );
  const row = preserved.rows[0];
  if (
    !row ||
    row.tasks !== 1 ||
    row.legacyInbox !== 1 ||
    row.appointments !== 0 ||
    row.transitions !== 0 ||
    row.reminders !== 0 ||
    row.schemaVersion !== 3 ||
    !(row.coverageStartedAt instanceof Date)
  ) {
    throw new Error("P3_S2_UPGRADE_PRESERVATION_OR_NO_BACKFILL_FAILED");
  }
} finally {
  await upgrade?.end();
  await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await admin.end();
}

async function migration(path: string): Promise<string> {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function applyTransaction(pool: Pool, sql: string): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}
