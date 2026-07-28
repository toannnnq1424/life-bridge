import { readFile } from "node:fs/promises";

import { Pool } from "pg";

import { migrateIdentityDatabase } from "../../../services/identity-consent/src/migration.js";

const adminUrl = process.env.P5_ADMIN_DATABASE_URL ?? required("P1_ADMIN_DATABASE_URL");
const communityPassword = credential("P5_COMMUNITY_DATABASE_PASSWORD");
const identityPassword = credential("P2_IDENTITY_DATABASE_PASSWORD");
const suffix = `${process.pid}_${Date.now()}`;
const communityDatabase = `lifebridge_p5s2_community_${suffix}`;
const identityDatabase = `lifebridge_p5s2_identity_${suffix}`;
const admin = new Pool({ connectionString: adminUrl, max: 1 });
let community: Pool | undefined;
let identity: Pool | undefined;
let communityToIdentity: Pool | undefined;
let identityToCommunity: Pool | undefined;

try {
  await provisionRole("lifebridge_community", communityPassword);
  await provisionRole("lifebridge_identity", identityPassword);
  await createDatabase(communityDatabase, "lifebridge_community");
  await createDatabase(identityDatabase, "lifebridge_identity");

  community = new Pool({
    connectionString: ownerUrl(communityDatabase, "lifebridge_community", communityPassword),
    max: 2,
  });
  identity = new Pool({
    connectionString: ownerUrl(identityDatabase, "lifebridge_identity", identityPassword),
    max: 1,
  });
  await migrateIdentityDatabase(
    ownerUrl(identityDatabase, "lifebridge_identity", identityPassword),
  );
  const identityState = await identity.query<{ version: number }>(
    "SELECT version FROM identity_schema_state WHERE service='identity-consent'",
  );
  if (identityState.rows[0]?.version !== 6) throw new Error("P5_S2_IDENTITY_SCHEMA_NOT_V6");
  const matchGrantBackfill = await identity.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM identity_consent_grants WHERE purpose='community_match_coordination'",
  );
  if (matchGrantBackfill.rows[0]?.count !== 0)
    throw new Error("P5_S2_IDENTITY_MATCH_SCOPE_BACKFILLED");
  await identity.query("CREATE TABLE identity_owner_sentinel(id TEXT PRIMARY KEY)");
  const v1 = await migration(
    "services/community/src/main/resources/db/migration/V1__p5_s1_community.sql",
  );
  const v2 = await migration(
    "services/community/src/main/resources/db/migration/V2__p5_s2_match_coordination.sql",
  );
  await apply(community, v1);
  await seedV1Sentinel(community);
  const before = await v1Fingerprint(community);

  await expectForcedRollback(community, v2);
  expectEqual(await v1Fingerprint(community), before, "FORCED_ROLLBACK_CHANGED_V1");
  await assertSchemaVersion(community, 1);

  const tablesBefore = await tableNames(community);
  await apply(community, v2);
  await assertSchemaVersion(community, 2);
  expectEqual(await v1Fingerprint(community), before, "V2_CHANGED_V1_OR_BACKFILLED");
  const tablesAfter = await tableNames(community);
  const addedTables = tablesAfter.filter((name) => !tablesBefore.includes(name));
  if (addedTables.length === 0) throw new Error("P5_S2_V2_ADDED_NO_OWNED_TABLES");
  await assertNewTablesEmpty(community, addedTables);

  const firstSchema = await schemaFingerprint(community, addedTables);
  await rollbackAdditiveV2(community, addedTables);
  await assertSchemaVersion(community, 1);
  expectEqual(await v1Fingerprint(community), before, "ROLLBACK_CHANGED_V1");
  await apply(community, v2);
  expectEqual(
    await schemaFingerprint(community, addedTables),
    firstSchema,
    "P5_S2_REAPPLY_SCHEMA_MISMATCH",
  );
  expectEqual(await v1Fingerprint(community), before, "REAPPLY_CHANGED_V1");
  await assertNewTablesEmpty(community, addedTables);

  communityToIdentity = new Pool({
    connectionString: ownerUrl(identityDatabase, "lifebridge_community", communityPassword),
    max: 1,
  });
  identityToCommunity = new Pool({
    connectionString: ownerUrl(communityDatabase, "lifebridge_identity", identityPassword),
    max: 1,
  });
  await expectPermissionDenied(identityToCommunity, "SELECT COUNT(*) FROM community_help_requests");
  for (const table of addedTables) {
    await expectPermissionDenied(identityToCommunity, `SELECT COUNT(*) FROM "${table}"`);
  }
  await expectPermissionDenied(communityToIdentity, "SELECT COUNT(*) FROM identity_owner_sentinel");

  console.log(
    "P5-S2 V2 rollback/reapply/no-backfill and Community owner-isolation validation passed.",
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
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
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

async function expectForcedRollback(pool: Pool, sql: string) {
  let failed = false;
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("SELECT 1/0");
    await pool.query("COMMIT");
  } catch {
    failed = true;
    await pool.query("ROLLBACK");
  }
  if (!failed) throw new Error("P5_S2_FORCED_ROLLBACK_NOT_TRIGGERED");
}

async function seedV1Sentinel(pool: Pool) {
  await pool.query(
    `INSERT INTO community_directory_listings(
       listing_id,public_name,organization_type,province_city_code,province_city_label,
       categories,contact_type,contact_label,contact_value,source_label,source_url,
       last_reviewed_at,next_review_at,reviewed
     ) VALUES(
       'p5s2_migration_listing','Synthetic migration listing','community_group',
       'SYN-PC-001','Synthetic province',ARRAY['daily_living_support'],'website',
       'Synthetic website','https://example.invalid/p5s2','Synthetic source',
       'https://example.invalid/source',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '30 days',TRUE
     )`,
  );
}

async function v1Fingerprint(pool: Pool) {
  const result = await pool.query<{ fingerprint: string }>(
    `SELECT md5(jsonb_build_object(
       'directory', (SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY listing_id),'[]') FROM community_directory_listings d),
       'requests', (SELECT COUNT(*) FROM community_help_requests),
       'idempotency', (SELECT COUNT(*) FROM community_idempotency),
       'tombstones', (SELECT COUNT(*) FROM community_request_tombstones),
       'audit', (SELECT COUNT(*) FROM community_audit),
       'outbox', (SELECT COUNT(*) FROM community_outbox)
     )::text) AS fingerprint`,
  );
  return result.rows[0]?.fingerprint;
}

async function tableNames(pool: Pool) {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

async function assertNewTablesEmpty(pool: Pool, tables: string[]) {
  for (const table of tables) {
    const result = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM "${table}"`,
    );
    if (result.rows[0]?.count !== 0) throw new Error(`P5_S2_UNINTENDED_BACKFILL:${table}`);
  }
}

async function schemaFingerprint(pool: Pool, tables: string[]) {
  const result = await pool.query<{ definition: string }>(
    `SELECT table_name || ':' || column_name || ':' || data_type || ':' || is_nullable AS definition
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name = ANY($1::text[])
     ORDER BY table_name,ordinal_position`,
    [tables],
  );
  return result.rows.map((row) => row.definition).join("|");
}

async function rollbackAdditiveV2(pool: Pool, tables: string[]) {
  await pool.query("BEGIN");
  try {
    for (const table of [...tables].reverse()) await pool.query(`DROP TABLE "${table}" CASCADE`);
    await pool.query(
      `ALTER TABLE community_audit DROP CONSTRAINT community_audit_action_check;
       ALTER TABLE community_audit ADD CONSTRAINT community_audit_action_check CHECK (
         action IN ('help_request.submitted','help_request.closed','help_request.auto_closed',
           'help_request.deleted','help_request.retention_purged')
       );
       ALTER TABLE community_outbox DROP CONSTRAINT community_outbox_event_type_check;
       ALTER TABLE community_outbox ADD CONSTRAINT community_outbox_event_type_check CHECK (
         event_type IN ('community.help_request.submitted.v1',
           'community.help_request.closed.v1','community.help_request.deleted.v1')
       );
       ALTER TABLE community_outbox DROP CONSTRAINT community_outbox_lifecycle_outcome_check;
       ALTER TABLE community_outbox ADD CONSTRAINT community_outbox_lifecycle_outcome_check CHECK (
         lifecycle_outcome IN ('pending','closed','deleted')
       );
       ALTER TABLE community_schema_state
         DROP CONSTRAINT community_schema_state_version_supported`,
    );
    await pool.query(
      "UPDATE community_schema_state SET version=1,updated_at=CURRENT_TIMESTAMP WHERE service='community'",
    );
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function assertSchemaVersion(pool: Pool, expected: number) {
  const result = await pool.query<{ version: number }>(
    "SELECT version FROM community_schema_state WHERE service='community'",
  );
  if (result.rows[0]?.version !== expected) {
    throw new Error(`P5_S2_SCHEMA_VERSION_EXPECTED_${expected}`);
  }
}

async function provisionRole(role: string, password: string) {
  if (!["lifebridge_community", "lifebridge_identity"].includes(role)) {
    throw new Error("P5_S2_ROLE_NOT_ALLOWED");
  }
  const exists = await admin.query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS exists",
    [role],
  );
  const verb = exists.rows[0]?.exists ? "ALTER ROLE" : "CREATE ROLE";
  const options = exists.rows[0]?.exists ? "WITH LOGIN PASSWORD" : "LOGIN PASSWORD";
  await admin.query(`${verb} "${role}" ${options} '${password}'`);
}

async function createDatabase(name: string, owner: string) {
  await admin.query(`CREATE DATABASE "${name}" OWNER "${owner}"`);
}

async function expectPermissionDenied(pool: Pool, sql: string) {
  try {
    await pool.query(sql);
  } catch (error) {
    if ((error as { code?: string }).code === "42501") return;
    throw error;
  }
  throw new Error("P5_S2_CROSS_SERVICE_SQL_WAS_PERMITTED");
}

function ownerUrl(database: string, owner: string, password: string) {
  const value = new URL(adminUrl);
  value.username = owner;
  value.password = password;
  value.pathname = `/${database}`;
  return value.toString();
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function credential(name: string) {
  const value = required(name);
  if (!/^[A-Za-z0-9]{24,128}$/u.test(value)) throw new Error(`${name}_INVALID`);
  return value;
}

function expectEqual(actual: unknown, expected: unknown, code: string) {
  if (actual !== expected) throw new Error(code);
}
