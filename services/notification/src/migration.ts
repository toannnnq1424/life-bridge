import { readFile } from "node:fs/promises";

import { Pool } from "pg";

export async function migrateNotificationDatabase(connectionString: string): Promise<void> {
  const migrations = await Promise.all([
    readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/002_appointment_reminder_intent.sql", import.meta.url), "utf8"),
    readFile(
      new URL("../migrations/003_medication_reminder_delivery.sql", import.meta.url),
      "utf8",
    ),
  ]);
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      const stateTable = await client.query<{ relation: string | null }>(
        `SELECT to_regclass('notification_schema_state')::text AS relation`,
      );
      if (stateTable.rows[0]?.relation) {
        const state = await client.query<{ version: number }>(
          `SELECT version
             FROM notification_schema_state
            WHERE service = 'notification'`,
        );
        if ((state.rows[0]?.version ?? 0) >= migrations.length) return;
      }
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
