import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import { Pool } from "pg";

const adminUrl = required("P7_ADMIN_DATABASE_URL");
const suffix = (
  process.env.GITHUB_RUN_ID ?? randomUUID().replaceAll("-", "").slice(0, 10)
).toLowerCase();
if (!/^[a-z0-9]{6,20}$/.test(suffix)) throw new Error("P7_RESOURCE_SUFFIX_INVALID");
const database = resource("community_db");
const migrator = resource("community_migrator");
const runtime = resource("community_runtime");
const password = "SyntheticP7CommunityCredential0001";
const admin = new Pool({ connectionString: adminUrl, max: 1 });

try {
  await admin.query(`CREATE ROLE ${migrator} LOGIN PASSWORD '${password}'`);
  await admin.query(`CREATE ROLE ${runtime} LOGIN PASSWORD '${password}'`);
  await admin.query(`CREATE DATABASE ${database} OWNER ${migrator}`);
  await admin.query(`REVOKE CONNECT ON DATABASE ${database} FROM PUBLIC`);
  await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${migrator}, ${runtime}`);

  const migrationJdbc = jdbc(database);
  const migrationUrl = pgUrl(database, migrator);
  await Promise.all([
    mavenTest(migrationJdbc, migrator, password, migrationJdbc, migrator, password, "p7a", false),
    mavenTest(migrationJdbc, migrator, password, migrationJdbc, migrator, password, "p7b", false),
  ]);

  const owner = new Pool({ connectionString: migrationUrl, max: 1 });
  await owner.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await owner.query(`GRANT USAGE ON SCHEMA public TO ${runtime}`);
  await owner.query(
    `GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${runtime}`,
  );
  await owner.query(`REVOKE ALL ON TABLE flyway_schema_history FROM ${runtime}`);
  await owner.end();

  await mavenTest(
    jdbc(database),
    runtime,
    password,
    migrationJdbc,
    migrator,
    password,
    "p7repeat",
    true,
  );

  const drift = new Pool({ connectionString: migrationUrl, max: 1 });
  const checksum = await drift.query<{ checksum: number }>(
    "SELECT checksum FROM flyway_schema_history WHERE version='1'",
  );
  await drift.query("UPDATE flyway_schema_history SET checksum=checksum+1 WHERE version='1'");
  await expectFailure(
    () =>
      mavenTest(
        jdbc(database),
        runtime,
        password,
        migrationJdbc,
        migrator,
        password,
        "p7drift",
        true,
      ),
    "validation",
  );
  await drift.query("UPDATE flyway_schema_history SET checksum=$1 WHERE version='1'", [
    checksum.rows[0]?.checksum,
  ]);
  await drift.end();

  console.log("P7-S1 Community Flyway concurrency, repeat, credential and drift proof passed.");
} finally {
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1", [
    database,
  ]);
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
  await admin.query(`DROP ROLE IF EXISTS ${runtime}`);
  await admin.query(`DROP ROLE IF EXISTS ${migrator}`);
  await admin.end();
}

function mavenTest(
  runtimeJdbc: string,
  runtimeUser: string,
  runtimePassword: string,
  migrationJdbc: string,
  migrationUser: string,
  migrationPassword: string,
  target: string,
  expectRuntimeDenial: boolean,
): Promise<void> {
  const command = process.platform === "win32" ? "mvnw.cmd" : "./mvnw";
  const args = [
    "-B",
    "-ntp",
    "-f",
    "services/community/pom.xml",
    `-Dproject.build.directory=target/${target}`,
    "-Dtest=CommunityMigrationIntegrationTest",
    "test",
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "pipe",
      env: {
        ...process.env,
        P7_S1_COMMUNITY_INTEGRATION: "1",
        P7_S1_EXPECT_RUNTIME_DENIAL: expectRuntimeDenial ? "1" : "0",
        COMMUNITY_DATABASE_URL: runtimeJdbc,
        COMMUNITY_DATABASE_USERNAME: runtimeUser,
        COMMUNITY_DATABASE_PASSWORD: runtimePassword,
        COMMUNITY_MIGRATION_DATABASE_URL: migrationJdbc,
        COMMUNITY_MIGRATION_DATABASE_USERNAME: migrationUser,
        COMMUNITY_MIGRATION_DATABASE_PASSWORD: migrationPassword,
        COMMUNITY_INTERNAL_TOKEN: "synthetic-community-token-0001",
        RUNTIME_MODE: "test",
      },
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(redact(output)));
    });
  });
}

async function expectFailure(action: () => Promise<void>, text: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (String(error).toLowerCase().includes(text.toLowerCase())) return;
    throw error;
  }
  throw new Error("EXPECTED_FLYWAY_DRIFT_FAILURE");
}

function redact(value: string): string {
  return value.replaceAll(password, "[REDACTED]").slice(-8000);
}

function resource(kind: string): string {
  const value = `lifebridge_p7s1_${kind}_${suffix}`;
  if (!/^lifebridge_p7s1_[a-z_]+_[a-z0-9]{6,20}$/.test(value))
    throw new Error("P7_RESOURCE_INVALID");
  return value;
}

function jdbc(databaseName: string): string {
  const value = new URL(adminUrl);
  return `jdbc:postgresql://${value.hostname}:${value.port || "5432"}/${databaseName}`;
}

function pgUrl(databaseName: string, role: string): string {
  const value = new URL(adminUrl);
  value.username = role;
  value.password = password;
  value.pathname = `/${databaseName}`;
  return value.toString();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
