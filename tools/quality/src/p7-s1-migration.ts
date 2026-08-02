import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { migrateOwnedDatabase, type MigrationHealth } from "@lifebridge/migrations";
import { Pool } from "pg";

import { migrateCareDatabase } from "../../../services/care-coordination/src/migration.js";
import { migrateIdentityDatabase } from "../../../services/identity-consent/src/migration.js";
import { migrateNotificationDatabase } from "../../../services/notification/src/migration.js";
import { NotificationService } from "../../../services/notification/src/service.js";

const adminUrl = required("P7_ADMIN_DATABASE_URL");
const suffix = (
  process.env.GITHUB_RUN_ID ?? randomUUID().replaceAll("-", "").slice(0, 10)
).toLowerCase();
if (!/^[a-z0-9]{6,20}$/.test(suffix)) throw new Error("P7_RESOURCE_SUFFIX_INVALID");

const admin = new Pool({ connectionString: adminUrl, max: 1 });
const password = "SyntheticP7MigrationCredential0001";
const owners = [
  {
    owner: "identity-consent",
    stem: "identity",
    state: "identity_schema_state",
    current: 8,
    previous: 7,
    path: "services/identity-consent/migrations",
    migrate: migrateIdentityDatabase,
  },
  {
    owner: "care-coordination",
    stem: "care",
    state: "care_schema_state",
    current: 8,
    previous: 7,
    path: "services/care-coordination/migrations",
    migrate: migrateCareDatabase,
  },
  {
    owner: "notification",
    stem: "notification",
    state: "notification_schema_state",
    current: 4,
    previous: 3,
    path: "services/notification/migrations",
    migrate: migrateNotificationDatabase,
  },
] as const;

const resources: string[] = [];
try {
  for (const owner of owners) await proveOwner(owner);
  await proveCrossOwnerDenial();
  await provePartialAndUnavailable();
  console.log("P7-S1 Node migration ownership, compatibility and failure validation passed.");
} finally {
  for (const database of resources.filter((name) => name.startsWith("db:"))) {
    await dropDatabase(database.slice(3));
  }
  for (const role of resources.filter((name) => name.startsWith("role:"))) {
    await admin.query(`DROP ROLE IF EXISTS ${role.slice(5)}`);
  }
  await admin.end();
}

async function proveOwner(owner: (typeof owners)[number]): Promise<void> {
  const database = name(`${owner.stem}_db`);
  const recovery = name(`${owner.stem}_recovery`);
  const migrator = name(`${owner.stem}_migrator`);
  const runtime = name(`${owner.stem}_runtime`);
  const insufficient = name(`${owner.stem}_insufficient`);
  await createRole(migrator);
  await createRole(runtime);
  await createRole(insufficient);
  await createDatabase(database, migrator);
  const migrationUrl = url(database, migrator);
  let migrationPool: Pool | undefined = new Pool({ connectionString: migrationUrl, max: 2 });
  try {
    const files = (await import("node:fs/promises")).readdir(owner.path);
    const historical = (await files)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .slice(0, -1);
    for (const file of historical) {
      const sql = await readFile(`${owner.path}/${file}`, "utf8");
      await migrationPool.query("BEGIN");
      try {
        await migrationPool.query(sql);
        await migrationPool.query("COMMIT");
      } catch (error) {
        await migrationPool.query("ROLLBACK");
        throw error;
      }
    }
    const before = await migrationPool.query<{ version: number }>(
      `SELECT version FROM ${owner.state} WHERE service=$1`,
      [owner.owner],
    );
    if (before.rows[0]?.version !== owner.previous) throw new Error("N_MINUS_ONE_INVALID");

    await migrationPool.end();
    migrationPool = undefined;
    await createRecoveryPoint(database, recovery, migrator, owner.state, owner.previous);

    await Promise.all([owner.migrate(migrationUrl), owner.migrate(migrationUrl)]);
    await owner.migrate(migrationUrl);
    const verify = new Pool({ connectionString: migrationUrl, max: 2 });
    const state = await verify.query<{ version: number }>(
      `SELECT version FROM ${owner.state} WHERE service=$1`,
      [owner.owner],
    );
    const ledger = await verify.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM lifebridge_migration_ledger WHERE owner=$1",
      [owner.owner],
    );
    if (
      state.rows[0]?.version !== owner.current ||
      Number(ledger.rows[0]?.count) !== owner.current
    ) {
      throw new Error("N_MIGRATION_INVALID");
    }

    await admin.query(`REVOKE CONNECT ON DATABASE ${database} FROM PUBLIC`);
    await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${runtime}, ${migrator}`);
    await verify.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
    await verify.query(`GRANT USAGE ON SCHEMA public TO ${runtime}`);
    await verify.query(
      `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${runtime}`,
    );
    await verify.query(`REVOKE ALL ON TABLE lifebridge_migration_ledger FROM ${runtime}`);
    await verify.end();

    const runtimePool = new Pool({ connectionString: url(database, runtime), max: 1 });
    const runtimeState = await runtimePool.query<{ version: number }>(
      `SELECT version FROM ${owner.state} WHERE service=$1`,
      [owner.owner],
    );
    if (runtimeState.rows[0]?.version !== owner.current) throw new Error("OLD_RUNTIME_UNSAFE");
    if (owner.owner === "notification") await proveMixedNotificationRuntimes(runtimePool);
    await expectDenied(() => runtimePool.query("CREATE TABLE forbidden_runtime_ddl(id int)"));
    await expectDenied(() => runtimePool.query("SELECT * FROM lifebridge_migration_ledger"));
    await runtimePool.end();

    const insufficientPool = new Pool({ connectionString: url(database, insufficient), max: 1 });
    await expectDenied(() => insufficientPool.query(`SELECT * FROM ${owner.state}`));
    await insufficientPool.end();

    const drift = new Pool({ connectionString: migrationUrl, max: 1 });
    await drift.query(
      "UPDATE lifebridge_migration_ledger SET checksum_sha256=$1 WHERE owner=$2 AND version=1",
      ["0".repeat(64), owner.owner],
    );
    await expectCode(() => owner.migrate(migrationUrl), "MIGRATION_CHECKSUM_DRIFT");
    const firstSql = await readFile(`${owner.path}/${historical[0]}`, "utf8");
    const { createHash } = await import("node:crypto");
    await drift.query(
      "UPDATE lifebridge_migration_ledger SET checksum_sha256=$1 WHERE owner=$2 AND version=1",
      [createHash("sha256").update(firstSql).digest("hex"), owner.owner],
    );
    await drift.end();
  } finally {
    if (migrationPool) await migrationPool.end();
  }
}

async function proveMixedNotificationRuntimes(runtimePool: Pool): Promise<void> {
  const nMinusOne = new NotificationService(runtimePool, () => new Date("2026-08-02T00:00:00Z"));
  const n = new NotificationService(runtimePool, () => new Date("2026-08-02T00:00:01Z"));
  const event = (suffix: string) => ({
    eventId: `evt_p7_${suffix}`,
    eventType: "care.task.completed.v1" as const,
    eventVersion: 1 as const,
    occurredAt: "2026-08-02T00:00:00.000Z",
    producer: "care-coordination" as const,
    aggregateId: `task_p7_${suffix}`,
    aggregateVersion: 2,
    correlationId: `corr_p7_${suffix}`,
    causationId: `cmd_p7_${suffix}`,
    payload: {
      householdId: "household_synthetic_p7",
      notificationDisposition: "deliver" as const,
      recipientId: "member_synthetic_p7",
      completedBy: "member_synthetic_other",
      completedAt: "2026-08-02T00:00:00.000Z",
    },
  });
  const [oldWrite, newWrite] = await Promise.all([
    nMinusOne.consume(event("n_minus_one")),
    n.consume(event("n")),
  ]);
  if (oldWrite.result !== "stored" || newWrite.result !== "stored") {
    throw new Error("MIXED_RUNTIME_WRITE_UNSAFE");
  }
  const [oldRead, newRead] = await Promise.all([
    nMinusOne.list("member_synthetic_p7"),
    n.list("member_synthetic_p7"),
  ]);
  if (oldRead.length !== 2 || newRead.length !== 2) {
    throw new Error("MIXED_RUNTIME_READ_UNSAFE");
  }
}

async function provePartialAndUnavailable(): Promise<void> {
  const database = name("partial_db");
  const migrator = name("partial_migrator");
  await createRole(migrator);
  await createDatabase(database, migrator);
  const events: MigrationHealth[] = [];
  const partialMigrations = [
    {
      version: 1,
      name: "001_partial.sql",
      sql: "CREATE TABLE partial_schema_state(service text primary key, version int); INSERT INTO partial_schema_state VALUES ('partial-owner',1);",
    },
    {
      version: 2,
      name: "002_failure.sql",
      sql: "CREATE TABLE must_rollback(id int); SELECT * FROM deliberately_missing_relation;",
    },
  ];
  await expectCode(
    () =>
      migrateOwnedDatabase({
        connectionString: url(database, migrator),
        owner: "partial-owner",
        stateTable: "partial_schema_state",
        tool: "lifebridge-node-ledger@1",
        health: (event) => events.push(event),
        migrations: partialMigrations,
      }),
    "deliberately_missing_relation",
  );
  const pool = new Pool({ connectionString: url(database, migrator), max: 1 });
  const rolledBack = await pool.query<{ relation: string | null }>(
    "SELECT to_regclass('must_rollback')::text AS relation",
  );
  if (rolledBack.rows[0]?.relation !== null) throw new Error("PARTIAL_MIGRATION_NOT_ROLLED_BACK");
  await pool.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [
    "lifebridge:migration:partial-owner",
  ]);
  await expectCode(
    () =>
      migrateOwnedDatabase({
        connectionString: url(database, migrator),
        owner: "partial-owner",
        stateTable: "partial_schema_state",
        tool: "lifebridge-node-ledger@1",
        lockTimeoutMs: 100,
        migrations: partialMigrations,
      }),
    "lock timeout",
  );
  await pool.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
    "lifebridge:migration:partial-owner",
  ]);
  await pool.end();
  if (JSON.stringify(events).includes(password) || JSON.stringify(events).includes("SELECT")) {
    throw new Error("MIGRATION_TELEMETRY_LEAK");
  }
  await expectCode(
    () =>
      migrateOwnedDatabase({
        connectionString: "postgresql://synthetic@127.0.0.1:1/unavailable",
        owner: "partial-owner",
        stateTable: "partial_schema_state",
        tool: "lifebridge-node-ledger@1",
        connectionTimeoutMs: 250,
        migrations: [],
      }),
    "ECONNREFUSED",
  );
}

async function proveCrossOwnerDenial(): Promise<void> {
  const identityRuntime = name("identity_runtime");
  const careDatabase = name("care_db");
  const foreign = new Pool({ connectionString: url(careDatabase, identityRuntime), max: 1 });
  await expectDenied(() => foreign.query("SELECT 1"));
  await foreign.end();
}

async function createRecoveryPoint(
  source: string,
  recovery: string,
  owner: string,
  stateTable: string,
  expectedVersion: number,
): Promise<void> {
  await createDatabase(recovery, owner, source);
  const proof = new Pool({ connectionString: url(recovery, owner), max: 1 });
  const value = await proof.query<{ version: number }>(`SELECT version FROM ${stateTable}`);
  await proof.end();
  if (value.rows[0]?.version !== expectedVersion) throw new Error("RECOVERY_POINT_INVALID");
}

async function createRole(role: string): Promise<void> {
  await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}'`);
  resources.push(`role:${role}`);
}

async function createDatabase(database: string, owner: string, template?: string): Promise<void> {
  await admin.query(
    `CREATE DATABASE ${database} OWNER ${owner}${template ? ` TEMPLATE ${template}` : ""}`,
  );
  resources.push(`db:${database}`);
}

async function dropDatabase(database: string): Promise<void> {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [
    database,
  ]);
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
}

function name(kind: string): string {
  const value = `lifebridge_p7s1_${kind}_${suffix}`;
  if (!/^lifebridge_p7s1_[a-z_]+_[a-z0-9]{6,20}$/.test(value))
    throw new Error("P7_RESOURCE_INVALID");
  return value;
}

function url(database: string, role: string): string {
  const value = new URL(adminUrl);
  value.username = role;
  value.password = password;
  value.pathname = `/${database}`;
  return value.toString();
}

async function expectDenied(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "42501") return;
    throw error;
  }
  throw new Error("EXPECTED_OWNER_DENIAL");
}

async function expectCode(action: () => Promise<unknown>, text: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (String(error).includes(text)) return;
    throw error;
  }
  throw new Error(`EXPECTED_FAILURE:${text}`);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
