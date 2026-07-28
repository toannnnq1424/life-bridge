import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const identityPassword = required("P2_IDENTITY_DATABASE_PASSWORD");
const carePassword = required("P1_CARE_DATABASE_PASSWORD");
const suffix = process.pid;
const identityDatabase = `lifebridge_p4s3_identity_${suffix}`;
const careDatabase = `lifebridge_p4s3_care_${suffix}`;
for (const name of [identityDatabase, careDatabase]) {
  if (!/^[a-z0-9_]{1,63}$/.test(name)) throw new Error("P4_S3_DATABASE_NAME_INVALID");
}

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let identity: Pool | undefined;
let care: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${identityDatabase} OWNER lifebridge_identity`);
  await admin.query(`CREATE DATABASE ${careDatabase} OWNER lifebridge_care`);
  identity = new Pool({
    connectionString: ownerDatabaseUrl(
      adminUrl,
      identityDatabase,
      "lifebridge_identity",
      identityPassword,
    ),
    max: 1,
  });
  care = new Pool({
    connectionString: ownerDatabaseUrl(adminUrl, careDatabase, "lifebridge_care", carePassword),
    max: 1,
  });

  const identityMigrations = await Promise.all(
    [
      "001_initial",
      "002_household_authorization",
      "003_consent_privacy_audit",
      "004_document_vault_scope",
    ].map((name) => migration(`services/identity-consent/migrations/${name}.sql`)),
  );
  for (const sql of identityMigrations.slice(0, 3)) await apply(identity, sql);
  await identity.query(`
    INSERT INTO identity_accounts(
      account_id,login_name,password_hash,status,authentication_version,
      failed_password_attempts,onboarding_completed,created_at,updated_at
    ) VALUES
      ('account_subject_upgrade','subject.upgrade','synthetic','active',1,0,TRUE,
       CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
      ('account_member_upgrade','member.upgrade','synthetic','active',1,0,TRUE,
       CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    INSERT INTO identity_households(
      household_id,display_label,status,version,created_at,updated_at
    ) VALUES (
      'household_upgrade','Synthetic upgrade','active',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
    INSERT INTO identity_household_memberships(
      membership_id,household_id,account_id,role,status,version,created_at,updated_at
    ) VALUES
      ('membership_subject_upgrade','household_upgrade','account_subject_upgrade',
       'organizer','active',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
      ('membership_member_upgrade','household_upgrade','account_member_upgrade',
       'member','active',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
    INSERT INTO identity_care_recipient_contexts(
      recipient_context_id,household_id,display_label,relationship_label,version,
      created_at,updated_at,created_by_account_id
    ) VALUES (
      'recipient_upgrade','household_upgrade','Synthetic recipient','Synthetic relation',
      1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'account_subject_upgrade'
    );
    INSERT INTO identity_consent_subjects(
      subject_id,household_id,recipient_context_id,account_id,authority,version,
      established_at,updated_at
    ) VALUES (
      'subject_upgrade','household_upgrade','recipient_upgrade','account_subject_upgrade',
      'self',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
    INSERT INTO identity_consent_grants(
      grant_id,subject_id,grantee_account_id,purpose,scopes,state,effective_at,
      revoked_effective_at,display_time_zone,version,created_at,updated_at
    ) VALUES (
      'grant_upgrade','subject_upgrade','account_member_upgrade','household_coordination',
      ARRAY['recipient_context.basic_label']::TEXT[],'active',CURRENT_TIMESTAMP,NULL,
      'Asia/Bangkok',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
  `);
  await expectRollback(identity, identityMigrations[3]!, "identity_p4_s3_forced_failure");
  const identityRollback = await identity.query<{
    schemaVersion: number;
    constraintDefinition: string;
    scopes: string[];
  }>(`
    SELECT
      (SELECT version FROM identity_schema_state WHERE service='identity-consent')
        AS "schemaVersion",
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname='identity_consent_grants_scopes_check')
        AS "constraintDefinition",
      (SELECT scopes FROM identity_consent_grants WHERE grant_id='grant_upgrade')
        AS scopes
  `);
  if (
    identityRollback.rows[0]?.schemaVersion !== 3 ||
    identityRollback.rows[0]?.constraintDefinition.includes("document_vault.access") ||
    identityRollback.rows[0]?.scopes.join(",") !== "recipient_context.basic_label"
  ) {
    throw new Error("P4_S3_IDENTITY_MIGRATION_ROLLBACK_FAILED");
  }
  await apply(identity, identityMigrations[3]!);
  await apply(identity, identityMigrations[3]!);
  const identityApplied = await identity.query<{
    schemaVersion: number;
    constraintDefinition: string;
    grants: number;
    documentScopeGrants: number;
  }>(`
    SELECT
      (SELECT version FROM identity_schema_state WHERE service='identity-consent')
        AS "schemaVersion",
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname='identity_consent_grants_scopes_v4_check')
        AS "constraintDefinition",
      (SELECT COUNT(*)::int FROM identity_consent_grants) AS grants,
      (SELECT COUNT(*)::int FROM identity_consent_grants
       WHERE 'document_vault.access'=ANY(scopes)) AS "documentScopeGrants"
  `);
  if (
    identityApplied.rows[0]?.schemaVersion !== 4 ||
    !identityApplied.rows[0]?.constraintDefinition.includes("document_vault.access") ||
    identityApplied.rows[0]?.grants !== 1 ||
    identityApplied.rows[0]?.documentScopeGrants !== 0
  ) {
    throw new Error("P4_S3_IDENTITY_NO_BACKFILL_OR_REAPPLY_FAILED");
  }

  const careMigrations = await Promise.all(
    [
      "001_initial",
      "002_daily_timeline_handoff",
      "003_calendar_appointments",
      "004_care_plan_review",
      "005_medication_reminders",
      "006_emergency_readiness",
      "007_document_vault",
    ].map((name) => migration(`services/care-coordination/migrations/${name}.sql`)),
  );
  for (const sql of careMigrations.slice(0, 6)) await apply(care, sql);
  await care.query(`
    INSERT INTO care_tasks(
      task_id,household_id,care_recipient_id,title,description,assignee_id,
      created_by,due_at,due_time_zone,priority,status,version,created_at
    ) VALUES (
      'task_p4s3_upgrade','household_upgrade','recipient_upgrade',
      'Synthetic retained task','','account_subject_upgrade','account_subject_upgrade',
      '2026-08-03T01:00:00.000Z','Asia/Bangkok','normal','open',1,
      '2026-07-28T00:00:00.000Z'
    )
  `);
  await expectRollback(care, careMigrations[6]!, "care_p4_s3_forced_failure");
  const careRollback = await care.query<{
    schemaVersion: number;
    vaultTable: string | null;
    blobTable: string | null;
  }>(`
    SELECT
      (SELECT version FROM care_schema_state WHERE service='care-coordination')
        AS "schemaVersion",
      to_regclass('public.care_document_vaults')::text AS "vaultTable",
      to_regclass('public.care_document_blobs')::text AS "blobTable"
  `);
  if (
    careRollback.rows[0]?.schemaVersion !== 6 ||
    careRollback.rows[0]?.vaultTable !== null ||
    careRollback.rows[0]?.blobTable !== null
  ) {
    throw new Error("P4_S3_CARE_MIGRATION_ROLLBACK_FAILED");
  }
  await apply(care, careMigrations[6]!);
  await apply(care, careMigrations[6]!);
  const careApplied = await care.query<{
    schemaVersion: number;
    tasks: number;
    vaults: number;
    documents: number;
    blobs: number;
    tombstones: number;
  }>(`
    SELECT
      (SELECT version FROM care_schema_state WHERE service='care-coordination')
        AS "schemaVersion",
      (SELECT COUNT(*)::int FROM care_tasks) AS tasks,
      (SELECT COUNT(*)::int FROM care_document_vaults) AS vaults,
      (SELECT COUNT(*)::int FROM care_documents) AS documents,
      (SELECT COUNT(*)::int FROM care_document_blobs) AS blobs,
      (SELECT COUNT(*)::int FROM care_document_tombstones) AS tombstones
  `);
  if (
    careApplied.rows[0]?.schemaVersion !== 7 ||
    careApplied.rows[0]?.tasks !== 1 ||
    careApplied.rows[0]?.vaults !== 0 ||
    careApplied.rows[0]?.documents !== 0 ||
    careApplied.rows[0]?.blobs !== 0 ||
    careApplied.rows[0]?.tombstones !== 0
  ) {
    throw new Error("P4_S3_CARE_NO_BACKFILL_OR_REAPPLY_FAILED");
  }
  console.log("P4-S3 migrations rollback/reapply/no-backfill validation passed.");
} finally {
  await identity?.end();
  await care?.end();
  for (const database of [identityDatabase, careDatabase]) {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  }
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
  if (!failed) throw new Error("P4_S3_FORCED_ROLLBACK_NOT_TRIGGERED");
}

function ownerDatabaseUrl(
  adminUrlValue: string,
  databaseName: string,
  owner: string,
  password: string,
) {
  const value = new URL(adminUrlValue);
  value.username = owner;
  value.password = password;
  value.pathname = `/${databaseName}`;
  return value.toString();
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
