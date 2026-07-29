import { readFile } from "node:fs/promises";

import { Pool } from "pg";

export async function migrateIdentityDatabase(connectionString: string): Promise<void> {
  const scripts = await Promise.all([
    readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/002_household_authorization.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/003_consent_privacy_audit.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/004_document_vault_scope.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/005_community_support_scope.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/006_community_match_scopes.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/007_community_moderation_scopes.sql", import.meta.url), "utf8"),
  ]);
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      for (const sql of scripts) {
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
