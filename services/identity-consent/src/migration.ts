import { readFile } from "node:fs/promises";

import { Pool } from "pg";

export async function migrateIdentityDatabase(connectionString: string): Promise<void> {
  const scripts = await Promise.all([
    readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/002_household_authorization.sql", import.meta.url), "utf8"),
  ]);
  const pool = new Pool({ connectionString, max: 1 });
  try {
    for (const sql of scripts) {
      await pool.query(sql);
    }
  } finally {
    await pool.end();
  }
}
