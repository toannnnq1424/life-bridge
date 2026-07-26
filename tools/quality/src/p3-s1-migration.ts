import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const databaseName = `lifebridge_p3s1_upgrade_${process.pid}`;
if (!/^[a-z0-9_]{1,63}$/.test(databaseName)) {
  throw new Error("P3_S1_UPGRADE_DATABASE_NAME_INVALID");
}

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let upgrade: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${databaseName} OWNER lifebridge_care`);
  const upgradeUrl = new URL(adminUrl);
  upgradeUrl.pathname = `/${databaseName}`;
  upgrade = new Pool({ connectionString: upgradeUrl.toString(), max: 1 });
  const [initial, timelineHandoff] = await Promise.all([
    readFile(
      new URL("../../../services/care-coordination/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../../services/care-coordination/migrations/002_daily_timeline_handoff.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  await applyTransaction(upgrade, initial);
  await upgrade.query(
    `INSERT INTO care_tasks
     (task_id, household_id, care_recipient_id, title, description, assignee_id,
      created_by, due_at, due_time_zone, priority, status, version, created_at)
     VALUES (
       'task_upgrade', 'household_upgrade', 'recipient_upgrade',
       'Synthetic upgrade task', '', 'actor_upgrade', 'actor_upgrade',
       '2026-11-01T06:30:00.000Z', 'America/New_York', 'normal', 'open', 1,
       '2026-07-26T12:00:00.000Z'
     );
     INSERT INTO care_audit
     (audit_id, actor_id, household_id, action, resource_type, resource_id,
      result, occurred_at, correlation_id, metadata)
     VALUES (
       'audit_upgrade', 'actor_upgrade', 'household_upgrade', 'task.created',
       'care_task', 'task_upgrade', 'success', '2026-07-26T12:00:00.000Z',
       'corr_upgrade_seed', '{}'::jsonb
     )`,
  );

  let rollbackTriggered = false;
  await upgrade.query("BEGIN");
  try {
    await upgrade.query(timelineHandoff);
    await upgrade.query("SELECT 1 FROM care_p3_s1_forced_failure");
    await upgrade.query("COMMIT");
  } catch {
    rollbackTriggered = true;
    await upgrade.query("ROLLBACK");
  }
  const rolledBack = await upgrade.query<{
    schemaTable: string | null;
    timelineTable: string | null;
    handoffTable: string | null;
  }>(
    `SELECT
       to_regclass('public.care_schema_state')::text AS "schemaTable",
       to_regclass('public.care_timeline_events')::text AS "timelineTable",
       to_regclass('public.care_task_handoffs')::text AS "handoffTable"`,
  );
  const rollback = rolledBack.rows[0];
  if (
    !rollbackTriggered ||
    rollback?.schemaTable !== null ||
    rollback?.timelineTable !== null ||
    rollback?.handoffTable !== null
  ) {
    throw new Error("P3_S1_MIGRATION_ROLLBACK_FAILED");
  }

  await applyTransaction(upgrade, timelineHandoff);
  await applyTransaction(upgrade, timelineHandoff);

  const preserved = await upgrade.query<{
    tasks: number;
    audits: number;
    timelineEvents: number;
    handoffs: number;
    schemaVersion: number;
    coverageStartedAt: Date;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM care_tasks) AS tasks,
       (SELECT COUNT(*)::int FROM care_audit) AS audits,
       (SELECT COUNT(*)::int FROM care_timeline_events) AS "timelineEvents",
       (SELECT COUNT(*)::int FROM care_task_handoffs) AS handoffs,
       (SELECT version FROM care_schema_state
        WHERE service = 'care-coordination') AS "schemaVersion",
       (SELECT coverage_started_at FROM care_schema_state
        WHERE service = 'care-coordination') AS "coverageStartedAt"`,
  );
  const row = preserved.rows[0];
  if (
    !row ||
    row.tasks !== 1 ||
    row.audits !== 1 ||
    row.timelineEvents !== 0 ||
    row.handoffs !== 0 ||
    row.schemaVersion !== 2 ||
    !(row.coverageStartedAt instanceof Date)
  ) {
    throw new Error("P3_S1_UPGRADE_PRESERVATION_OR_NO_BACKFILL_FAILED");
  }

  const legacyProjection = await upgrade.query(
    `SELECT task_id, household_id, care_recipient_id, assignee_id, status, version
     FROM care_tasks
     WHERE household_id = 'household_upgrade'`,
  );
  if (legacyProjection.rows.length !== 1) {
    throw new Error("P3_S1_OLD_RUNTIME_COMPATIBILITY_FAILED");
  }
} finally {
  await upgrade?.end();
  await admin.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await admin.end();
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
