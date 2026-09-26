import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const database = `lifebridge_p4s2_care_upgrade_${process.pid}`;
if (!/^[a-z0-9_]{1,63}$/.test(database)) throw new Error("P4_S2_DATABASE_NAME_INVALID");

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let care: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${database} OWNER lifebridge_care`);
  care = new Pool({ connectionString: databaseUrl(adminUrl, database), max: 1 });
  const migrations = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((version) =>
      migration(
        `services/care-coordination/migrations/${String(version).padStart(3, "0")}_${
          [
            "initial",
            "daily_timeline_handoff",
            "calendar_appointments",
            "care_plan_review",
            "medication_reminders",
            "emergency_readiness",
          ][version - 1]
        }.sql`,
      ),
    ),
  );
  for (const sql of migrations.slice(0, 5)) await apply(care, sql);
  await care.query(`
    INSERT INTO care_tasks (
      task_id, household_id, care_recipient_id, title, description,
      assignee_id, created_by, due_at, due_time_zone, priority, status, version, created_at
    ) VALUES (
      'task_p4s2_upgrade', 'household_p4s2_upgrade', 'recipient_p4s2_upgrade',
      'Synthetic retained task', '', 'actor_p4s2_upgrade', 'actor_p4s2_upgrade',
      '2026-08-03T01:00:00.000Z', 'Asia/Bangkok', 'normal', 'open', 1,
      '2026-07-28T00:00:00.000Z'
    )
  `);

  await expectRollback(care, migrations[5]!, "forced_p4_s2_failure");
  const rollback = await care.query<{
    readinessTable: string | null;
    contactTable: string | null;
    versionTable: string | null;
    coverageColumn: string | null;
    schemaVersion: number;
  }>(`
    SELECT
      to_regclass('public.care_emergency_readiness')::text AS "readinessTable",
      to_regclass('public.care_emergency_contacts')::text AS "contactTable",
      to_regclass('public.care_emergency_plan_versions')::text AS "versionTable",
      (
        SELECT column_name FROM information_schema.columns
        WHERE table_name='care_schema_state'
          AND column_name='emergency_readiness_coverage_started_at'
      ) AS "coverageColumn",
      (
        SELECT version FROM care_schema_state WHERE service='care-coordination'
      ) AS "schemaVersion"
  `);
  const rolledBack = rollback.rows[0];
  if (
    !rolledBack ||
    rolledBack.readinessTable !== null ||
    rolledBack.contactTable !== null ||
    rolledBack.versionTable !== null ||
    rolledBack.coverageColumn !== null ||
    rolledBack.schemaVersion !== 5
  ) {
    throw new Error("P4_S2_MIGRATION_ROLLBACK_FAILED");
  }

  await apply(care, migrations[5]!);
  await apply(care, migrations[5]!);
  const result = await care.query<{
    retainedTasks: number;
    readiness: number;
    contacts: number;
    drafts: number;
    versions: number;
    schemaVersion: number;
    coverage: Date;
  }>(`
    SELECT
      (SELECT COUNT(*)::int FROM care_tasks) AS "retainedTasks",
      (SELECT COUNT(*)::int FROM care_emergency_readiness) AS readiness,
      (SELECT COUNT(*)::int FROM care_emergency_contacts) AS contacts,
      (SELECT COUNT(*)::int FROM care_emergency_plan_drafts) AS drafts,
      (SELECT COUNT(*)::int FROM care_emergency_plan_versions) AS versions,
      (
        SELECT version FROM care_schema_state WHERE service='care-coordination'
      ) AS "schemaVersion",
      (
        SELECT emergency_readiness_coverage_started_at
        FROM care_schema_state WHERE service='care-coordination'
      ) AS coverage
  `);
  const row = result.rows[0];
  if (
    !row ||
    row.retainedTasks !== 1 ||
    row.readiness !== 0 ||
    row.contacts !== 0 ||
    row.drafts !== 0 ||
    row.versions !== 0 ||
    row.schemaVersion !== 6 ||
    !(row.coverage instanceof Date)
  ) {
    throw new Error("P4_S2_MIGRATION_REAPPLY_OR_NO_BACKFILL_FAILED");
  }
  console.log("P4-S2 Care-owned migration rollback/reapply/no-backfill validation passed.");
} finally {
  await care?.end();
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
    [database],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  await admin.end();
}

async function migration(path: string) {
  return readFile(new URL(`../../../${path}`, import.meta.url), "utf8");
}

async function apply(pool: Pool, sql: string) {
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function expectRollback(pool: Pool, sql: string, missingTable: string) {
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
  if (!failed) throw new Error("P4_S2_FORCED_ROLLBACK_NOT_TRIGGERED");
}

function databaseUrl(adminUrlValue: string, databaseName: string) {
  const value = new URL(adminUrlValue);
  value.pathname = `/${databaseName}`;
  return value.toString();
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
