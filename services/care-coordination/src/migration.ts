import { readFile } from "node:fs/promises";

import { Pool } from "pg";

export async function migrateCareDatabase(connectionString: string): Promise<void> {
  const migrations = await Promise.all([
    readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/002_daily_timeline_handoff.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/003_calendar_appointments.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/004_care_plan_review.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/005_medication_reminders.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/006_emergency_readiness.sql", import.meta.url), "utf8"),
  ]);
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      for (const sql of migrations) {
        try {
          await client.query("BEGIN");
          await client.query(sql);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
