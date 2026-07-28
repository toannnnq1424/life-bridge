import { readFile } from "node:fs/promises";

import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const identityPassword = required("P2_IDENTITY_DATABASE_PASSWORD");
const communityPassword = required("P5_COMMUNITY_DATABASE_PASSWORD");
const suffix = process.pid;
const identityDatabase = `lifebridge_p5s1_identity_${suffix}`;
const communityDatabase = `lifebridge_p5s1_community_${suffix}`;
for (const name of [identityDatabase, communityDatabase]) {
  if (!/^[a-z0-9_]{1,63}$/u.test(name)) throw new Error("P5_S1_DATABASE_NAME_INVALID");
}

const admin = new Pool({ connectionString: adminUrl, max: 1 });
let identity: Pool | undefined;
let community: Pool | undefined;
let communityToIdentity: Pool | undefined;
let identityToCommunity: Pool | undefined;
try {
  await admin.query(`CREATE DATABASE ${identityDatabase} OWNER lifebridge_identity`);
  await admin.query(`CREATE DATABASE ${communityDatabase} OWNER lifebridge_community`);
  identity = new Pool({
    connectionString: ownerDatabaseUrl(
      adminUrl,
      identityDatabase,
      "lifebridge_identity",
      identityPassword,
    ),
    max: 1,
  });
  community = new Pool({
    connectionString: ownerDatabaseUrl(
      adminUrl,
      communityDatabase,
      "lifebridge_community",
      communityPassword,
    ),
    max: 1,
  });

  const identityMigrations = await Promise.all(
    [
      "001_initial",
      "002_household_authorization",
      "003_consent_privacy_audit",
      "004_document_vault_scope",
      "005_community_support_scope",
    ].map((name) => migration(`services/identity-consent/migrations/${name}.sql`)),
  );
  for (const sql of identityMigrations.slice(0, 4)) await apply(identity, sql);
  await identity.query(`
    INSERT INTO identity_accounts(
      account_id,login_name,password_hash,status,authentication_version,
      failed_password_attempts,onboarding_completed,created_at,updated_at
    ) VALUES (
      'account_p5s1_upgrade','p5s1.upgrade','synthetic','active',1,0,TRUE,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
    INSERT INTO identity_households(
      household_id,display_label,status,version,created_at,updated_at
    ) VALUES (
      'household_p5s1_upgrade','Synthetic P5-S1 upgrade','active',1,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
    INSERT INTO identity_household_memberships(
      membership_id,household_id,account_id,role,status,version,created_at,updated_at
    ) VALUES (
      'membership_p5s1_upgrade','household_p5s1_upgrade','account_p5s1_upgrade',
      'organizer','active',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
    INSERT INTO identity_care_recipient_contexts(
      recipient_context_id,household_id,display_label,relationship_label,version,
      created_at,updated_at,created_by_account_id
    ) VALUES (
      'recipient_p5s1_upgrade','household_p5s1_upgrade','Synthetic recipient',
      'Synthetic relationship',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
      'account_p5s1_upgrade'
    );
    INSERT INTO identity_consent_subjects(
      subject_id,household_id,recipient_context_id,account_id,authority,version,
      established_at,updated_at
    ) VALUES (
      'subject_p5s1_upgrade','household_p5s1_upgrade','recipient_p5s1_upgrade',
      'account_p5s1_upgrade','self',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
    INSERT INTO identity_consent_grants(
      grant_id,subject_id,grantee_account_id,purpose,scopes,state,effective_at,
      revoked_effective_at,display_time_zone,version,created_at,updated_at
    ) VALUES (
      'grant_p5s1_upgrade','subject_p5s1_upgrade','account_p5s1_upgrade',
      'household_coordination',ARRAY['recipient_context.basic_label']::TEXT[],
      'active',CURRENT_TIMESTAMP,NULL,'Asia/Bangkok',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    );
  `);
  await expectRollback(identity, identityMigrations[4]!, "identity_p5_s1_forced_failure");
  const identityRollback = await identity.query<{
    schemaVersion: number;
    purposeConstraint: string | null;
    scopes: string[];
  }>(`
    SELECT
      (SELECT version FROM identity_schema_state WHERE service='identity-consent')
        AS "schemaVersion",
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname='identity_consent_grants_purpose_v5_check')
        AS "purposeConstraint",
      (SELECT scopes FROM identity_consent_grants WHERE grant_id='grant_p5s1_upgrade')
        AS scopes
  `);
  if (
    identityRollback.rows[0]?.schemaVersion !== 4 ||
    identityRollback.rows[0]?.purposeConstraint !== null ||
    identityRollback.rows[0]?.scopes.join(",") !== "recipient_context.basic_label"
  ) {
    throw new Error("P5_S1_IDENTITY_MIGRATION_ROLLBACK_FAILED");
  }
  await apply(identity, identityMigrations[4]!);
  const identityApplied = await identity.query<{
    schemaVersion: number;
    purposeConstraint: string;
    grants: number;
    communityGrants: number;
  }>(`
    SELECT
      (SELECT version FROM identity_schema_state WHERE service='identity-consent')
        AS "schemaVersion",
      (SELECT pg_get_constraintdef(oid) FROM pg_constraint
       WHERE conname='identity_consent_grants_purpose_v5_check')
        AS "purposeConstraint",
      (SELECT COUNT(*)::int FROM identity_consent_grants) AS grants,
      (SELECT COUNT(*)::int FROM identity_consent_grants
       WHERE purpose='community_support') AS "communityGrants"
  `);
  if (
    identityApplied.rows[0]?.schemaVersion !== 5 ||
    !identityApplied.rows[0]?.purposeConstraint.includes("community_support") ||
    identityApplied.rows[0]?.grants !== 1 ||
    identityApplied.rows[0]?.communityGrants !== 0
  ) {
    throw new Error("P5_S1_IDENTITY_NO_BACKFILL_OR_REAPPLY_FAILED");
  }

  const communityMigration = await migration(
    "services/community/src/main/resources/db/migration/V1__p5_s1_community.sql",
  );
  await expectRollback(community, communityMigration, "community_p5_s1_forced_failure");
  const rolledBack = await community.query<{ schemaState: string | null }>(
    "SELECT to_regclass('public.community_schema_state')::text AS \"schemaState\"",
  );
  if (rolledBack.rows[0]?.schemaState !== null) {
    throw new Error("P5_S1_COMMUNITY_MIGRATION_ROLLBACK_FAILED");
  }
  await apply(community, communityMigration);
  const applied = await community.query<{
    schemaVersion: number;
    tableCount: number;
    listings: number;
    requests: number;
    auditRows: number;
    outboxRows: number;
    foreignOwners: number;
  }>(`
    SELECT
      (SELECT version FROM community_schema_state WHERE service='community')
        AS "schemaVersion",
      (SELECT COUNT(*)::int FROM information_schema.tables
       WHERE table_schema='public' AND table_name LIKE 'community_%') AS "tableCount",
      (SELECT COUNT(*)::int FROM community_directory_listings) AS listings,
      (SELECT COUNT(*)::int FROM community_help_requests) AS requests,
      (SELECT COUNT(*)::int FROM community_audit) AS "auditRows",
      (SELECT COUNT(*)::int FROM community_outbox) AS "outboxRows",
      (SELECT COUNT(*)::int
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       JOIN pg_roles r ON r.oid=c.relowner
       WHERE n.nspname='public' AND c.relname LIKE 'community_%'
         AND c.relkind IN ('r','i','S') AND r.rolname <> 'lifebridge_community')
        AS "foreignOwners"
  `);
  if (
    applied.rows[0]?.schemaVersion !== 1 ||
    applied.rows[0]?.tableCount !== 7 ||
    applied.rows[0]?.listings !== 0 ||
    applied.rows[0]?.requests !== 0 ||
    applied.rows[0]?.auditRows !== 0 ||
    applied.rows[0]?.outboxRows !== 0 ||
    applied.rows[0]?.foreignOwners !== 0
  ) {
    throw new Error("P5_S1_COMMUNITY_NO_BACKFILL_OR_OWNERSHIP_FAILED");
  }

  communityToIdentity = new Pool({
    connectionString: ownerDatabaseUrl(
      adminUrl,
      identityDatabase,
      "lifebridge_community",
      communityPassword,
    ),
    max: 1,
  });
  identityToCommunity = new Pool({
    connectionString: ownerDatabaseUrl(
      adminUrl,
      communityDatabase,
      "lifebridge_identity",
      identityPassword,
    ),
    max: 1,
  });
  await expectPermissionDenied(communityToIdentity, "SELECT COUNT(*) FROM identity_accounts");
  await expectPermissionDenied(identityToCommunity, "SELECT COUNT(*) FROM community_help_requests");

  console.log(
    "P5-S1 migrations rollback/reapply/no-backfill and owner isolation validation passed.",
  );
} finally {
  await communityToIdentity?.end();
  await identityToCommunity?.end();
  await identity?.end();
  await community?.end();
  for (const database of [identityDatabase, communityDatabase]) {
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
  if (!failed) throw new Error("P5_S1_FORCED_ROLLBACK_NOT_TRIGGERED");
}

async function expectPermissionDenied(pool: Pool, sql: string) {
  try {
    await pool.query(sql);
  } catch (error) {
    if ((error as { code?: string }).code === "42501") return;
    throw error;
  }
  throw new Error("P5_S1_CROSS_SERVICE_SQL_WAS_PERMITTED");
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
