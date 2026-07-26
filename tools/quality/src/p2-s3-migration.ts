import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P2_ADMIN_DATABASE_URL");
const databaseName = `lifebridge_p2s3_upgrade_${process.pid}`;
if (!/^[a-z0-9_]{1,63}$/.test(databaseName)) {
  throw new Error("P2_S3_UPGRADE_DATABASE_NAME_INVALID");
}

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let upgrade: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${databaseName} OWNER lifebridge_identity`);
  const upgradeUrl = new URL(adminUrl);
  upgradeUrl.pathname = `/${databaseName}`;
  upgrade = new Pool({ connectionString: upgradeUrl.toString(), max: 1 });
  const [initial, household, consent] = await Promise.all([
    readFile(
      new URL("../../../services/identity-consent/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../../../services/identity-consent/migrations/002_household_authorization.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../../../services/identity-consent/migrations/003_consent_privacy_audit.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  await upgrade.query(initial);
  await upgrade.query(household);
  await upgrade.query(
    `INSERT INTO identity_accounts
     (account_id, login_name, password_hash, status, authentication_version,
      failed_password_attempts, onboarding_completed, created_at, updated_at)
     VALUES ('account_upgrade', 'upgrade.synthetic', 'synthetic-hash', 'active',
             1, 0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
     INSERT INTO identity_preferences
     (account_id, locale, text_scale, contrast, motion, version, created_at, updated_at)
     VALUES ('account_upgrade', 'vi-VN', 'default', 'system', 'system', 1,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
     INSERT INTO identity_households
     (household_id, display_label, status, version, created_at, updated_at)
     VALUES ('household_upgrade', 'Synthetic upgrade household', 'active', 1,
             CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
     INSERT INTO identity_household_memberships
     (membership_id, household_id, account_id, role, status, version, created_at, updated_at)
     VALUES ('membership_upgrade', 'household_upgrade', 'account_upgrade',
             'organizer', 'active', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
     INSERT INTO identity_care_recipient_contexts
     (recipient_context_id, household_id, display_label, relationship_label,
      version, created_at, updated_at)
     VALUES ('recipient_upgrade', 'household_upgrade', 'Synthetic recipient',
             'Synthetic relationship', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
     INSERT INTO identity_audit
     (audit_id, account_id, action, result, correlation_id, occurred_at,
      household_id, target_type, target_id, reason_code)
     VALUES ('audit_upgrade', 'account_upgrade', 'upgrade.seed', 'success',
             'corr_upgrade_seed', CURRENT_TIMESTAMP, 'household_upgrade',
             'recipient_context', 'recipient_upgrade', NULL)`,
  );

  let rollbackTriggered = false;
  await upgrade.query("BEGIN");
  try {
    await upgrade.query(consent);
    await upgrade.query("SELECT 1 FROM identity_p2_s3_forced_failure");
    await upgrade.query("COMMIT");
  } catch {
    rollbackTriggered = true;
    await upgrade.query("ROLLBACK");
  }
  const rolledBack = await upgrade.query<{
    subject_table: string | null;
    schema_table: string | null;
    creator_column: boolean;
  }>(
    `SELECT
       to_regclass('public.identity_consent_subjects')::text AS subject_table,
       to_regclass('public.identity_schema_state')::text AS schema_table,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'identity_care_recipient_contexts'
           AND column_name = 'created_by_account_id'
       ) AS creator_column`,
  );
  if (
    !rollbackTriggered ||
    rolledBack.rows[0]?.subject_table !== null ||
    rolledBack.rows[0]?.schema_table !== null ||
    rolledBack.rows[0]?.creator_column !== false
  ) {
    throw new Error("P2_S3_MIGRATION_ROLLBACK_FAILED");
  }

  await applyTransaction(upgrade, consent);
  await applyTransaction(upgrade, consent);

  const preserved = await upgrade.query<{
    accounts: number;
    contexts: number;
    audits: number;
    provenance: string | null;
    schema_version: number;
  }>(
    `SELECT
       (SELECT COUNT(*)::int FROM identity_accounts) AS accounts,
       (SELECT COUNT(*)::int FROM identity_care_recipient_contexts) AS contexts,
       (SELECT COUNT(*)::int FROM identity_audit) AS audits,
       (SELECT created_by_account_id FROM identity_care_recipient_contexts
        WHERE recipient_context_id = 'recipient_upgrade') AS provenance,
       (SELECT version FROM identity_schema_state
        WHERE service = 'identity-consent') AS schema_version`,
  );
  const row = preserved.rows[0];
  if (
    !row ||
    row.accounts !== 1 ||
    row.contexts !== 1 ||
    row.audits !== 1 ||
    row.provenance !== null ||
    row.schema_version !== 3
  ) {
    throw new Error("P2_S3_UPGRADE_PRESERVATION_FAILED");
  }

  const legacyProjection = await upgrade.query(
    `SELECT recipient_context_id, household_id, display_label,
            relationship_label, version
     FROM identity_care_recipient_contexts
     WHERE household_id = 'household_upgrade'`,
  );
  if (legacyProjection.rows.length !== 1) {
    throw new Error("P2_S3_OLD_RUNTIME_COMPATIBILITY_FAILED");
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
