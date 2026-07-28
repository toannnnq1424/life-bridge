import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const databaseName = `lifebridge_p3s3_upgrade_${process.pid}`;
if (!/^[a-z0-9_]{1,63}$/.test(databaseName)) throw new Error("P3_S3_DATABASE_NAME_INVALID");

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let upgrade: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${databaseName} OWNER lifebridge_care`);
  const url = new URL(adminUrl);
  url.pathname = `/${databaseName}`;
  upgrade = new Pool({ connectionString: url.toString(), max: 1 });
  const [initial, timeline, appointments, carePlan] = await Promise.all([
    migration("services/care-coordination/migrations/001_initial.sql"),
    migration("services/care-coordination/migrations/002_daily_timeline_handoff.sql"),
    migration("services/care-coordination/migrations/003_calendar_appointments.sql"),
    migration("services/care-coordination/migrations/004_care_plan_review.sql"),
  ]);
  await apply(upgrade, initial);
  await apply(upgrade, timeline);
  await apply(upgrade, appointments);
  await upgrade.query(`INSERT INTO care_tasks(task_id,household_id,care_recipient_id,title,description,assignee_id,created_by,due_at,due_time_zone,priority,status,version,created_at)
    VALUES ('task_upgrade','household_upgrade','recipient_upgrade','Synthetic upgrade task','','actor_upgrade','actor_upgrade','2026-11-01T06:30:00.000Z','America/New_York','normal','open',1,'2026-07-26T12:00:00.000Z')`);
  let rolledBack = false;
  await upgrade.query("BEGIN");
  try {
    await upgrade.query(carePlan);
    await upgrade.query("SELECT 1 FROM forced_p3_s3_failure");
    await upgrade.query("COMMIT");
  } catch {
    rolledBack = true;
    await upgrade.query("ROLLBACK");
  }
  const afterRollback = await upgrade.query<{
    plans: string | null;
    coverage: string | null;
  }>(`SELECT to_regclass('public.care_plans')::text AS plans,
    (SELECT column_name FROM information_schema.columns WHERE table_name='care_schema_state' AND column_name='care_plan_coverage_started_at') AS coverage`);
  if (
    !rolledBack ||
    afterRollback.rows[0]?.plans !== null ||
    afterRollback.rows[0]?.coverage !== null
  )
    throw new Error("P3_S3_ROLLBACK_FAILED");
  await apply(upgrade, carePlan);
  await apply(upgrade, carePlan);
  await apply(upgrade, timeline);
  await apply(upgrade, appointments);
  const result = await upgrade.query<{
    tasks: number;
    plans: number;
    versions: number;
    schemaVersion: number;
    coverage: Date;
  }>(`SELECT
    (SELECT COUNT(*)::int FROM care_tasks) AS tasks,
    (SELECT COUNT(*)::int FROM care_plans) AS plans,
    (SELECT COUNT(*)::int FROM care_plan_versions) AS versions,
    (SELECT version FROM care_schema_state WHERE service='care-coordination') AS "schemaVersion",
    (SELECT care_plan_coverage_started_at FROM care_schema_state WHERE service='care-coordination') AS coverage`);
  const row = result.rows[0];
  if (
    !row ||
    row.tasks !== 1 ||
    row.plans !== 0 ||
    row.versions !== 0 ||
    row.schemaVersion !== 4 ||
    !(row.coverage instanceof Date)
  )
    throw new Error("P3_S3_MIGRATION_INVARIANT_FAILED");
  console.log("P3-S3 migration rollback/reapply/no-backfill validation passed.");
} finally {
  await upgrade?.end();
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
    [databaseName],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
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
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
