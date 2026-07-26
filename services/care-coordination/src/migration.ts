import { readFile } from "node:fs/promises";

import { Pool } from "pg";

export async function migrateCareDatabase(connectionString: string): Promise<void> {
  const sql = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}
