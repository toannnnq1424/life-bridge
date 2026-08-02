import { execFileSync } from "node:child_process";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import {
  assertIsolatedRestore,
  measureRecovery,
  verifyArtifact,
  type RecoveryManifest,
} from "./p7-s3-recovery.js";

const adminUrl = required("P7_ADMIN_DATABASE_URL");
const container = required("P7_S3_POSTGRES_CONTAINER");
if (!/^[a-zA-Z0-9_.-]{6,128}$/.test(container)) throw new Error("P7_S3_CONTAINER_INVALID");
const suffix = (
  process.env.GITHUB_RUN_ID ?? randomUUID().replaceAll("-", "").slice(0, 10)
).toLowerCase();
const temp = await mkdtemp(join(tmpdir(), "lifebridge-p7s3-"));
const admin = new Pool({ connectionString: adminUrl, max: 1 });
const resources: string[] = [];
const owners = [
  ["identity-consent", "identity", "identity_lifecycle_sentinel", 8, "lifebridge_identity"],
  ["care-coordination", "care", "care_lifecycle_sentinel", 9, "lifebridge_care"],
  ["notification", "notification", "notification_lifecycle_sentinel", 5, "lifebridge_notification"],
  ["community", "community", "community_lifecycle_sentinel", 4, "lifebridge_community"],
] as const;

try {
  const evidence = [];
  for (const owner of owners) evidence.push(await prove(owner));
  process.stdout.write(`${JSON.stringify({ eventName: "p7-s3.recovery", owners: evidence })}\n`);
} finally {
  for (const database of resources.filter((x) => x.startsWith("db:")))
    await drop(database.slice(3));
  for (const role of resources.filter((x) => x.startsWith("role:")))
    await admin.query(`DROP ROLE IF EXISTS ${role.slice(5)}`);
  await admin.end();
  await rm(temp, { recursive: true, force: true });
}

async function prove(owner: (typeof owners)[number]) {
  const [ownerId, stem, table, schemaVersion, canonical] = owner;
  const role = resource(`${stem}_backup`);
  const source = resource(`${stem}_source`);
  const target = `lifebridge_p7s3_restore_${stem}_${suffix}`;
  assertIsolatedRestore(source, target, false);
  await admin.query(`CREATE ROLE ${role} LOGIN`);
  resources.push(`role:${role}`);
  await admin.query(`CREATE DATABASE ${source} OWNER ${role}`);
  resources.push(`db:${source}`);
  const pool = new Pool({ connectionString: databaseUrl(source, role), max: 1 });
  const recoveryPoint = new Date();
  await pool.query(
    `CREATE TABLE ${table}(id text primary key, schema_version int not null, payload text not null)`,
  );
  await pool.query(`INSERT INTO ${table} VALUES ($1,$2,$3)`, [
    `synthetic_${stem}`,
    schemaVersion - 1,
    "synthetic-no-pii",
  ]);
  await pool.end();
  const remoteDump = `/tmp/p7s3-${stem}-${suffix}.dump`;
  const plain = join(temp, `${stem}.dump`);
  const encrypted = `${plain}.enc`;
  exec("exec", container, "pg_dump", "-U", "postgres", "-Fc", "-f", remoteDump, source);
  exec("cp", `${container}:${remoteDump}`, plain);
  const raw = await readFile(plain);
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(raw), cipher.final()]);
  const tag = cipher.getAuthTag();
  await writeFile(encrypted, Buffer.concat([iv, tag, ciphertext]));
  const manifest: RecoveryManifest = {
    manifestVersion: 1,
    artifactId: `artifact_${stem}_${suffix}`,
    owner: ownerId,
    sourceDatabase: canonical,
    postgresqlVersion: "17.5",
    schemaVersion: schemaVersion - 1,
    ledgerDigest: createHash("sha256")
      .update(`${ownerId}:${schemaVersion - 1}`)
      .digest("hex"),
    artifactSha256: createHash("sha256")
      .update(await readFile(encrypted))
      .digest("hex"),
    artifactBytes: (await readFile(encrypted)).length,
    capturedAt: new Date().toISOString(),
    recoveryPointAt: recoveryPoint.toISOString(),
    encrypted: true,
    accessBoundary: "owner-scoped-task-artifact",
  };
  await verifyArtifact(encrypted, manifest);
  const envelope = await readFile(encrypted);
  const decipher = createDecipheriv("aes-256-gcm", key, envelope.subarray(0, 12));
  decipher.setAuthTag(envelope.subarray(12, 28));
  const restoredDump = Buffer.concat([decipher.update(envelope.subarray(28)), decipher.final()]);
  if (
    createHash("sha256").update(restoredDump).digest("hex") !==
    createHash("sha256").update(raw).digest("hex")
  )
    throw new Error("BACKUP_DECRYPT_INTEGRITY_FAILED");
  await writeFile(plain, restoredDump);
  exec("cp", plain, `${container}:${remoteDump}`);
  exec("exec", container, "pg_restore", "-l", remoteDump);
  const started = new Date();
  await admin.query(`CREATE DATABASE ${target} OWNER ${role}`);
  resources.push(`db:${target}`);
  exec(
    "exec",
    container,
    "pg_restore",
    "-U",
    "postgres",
    "--single-transaction",
    "--exit-on-error",
    "--no-owner",
    `--role=${role}`,
    "-d",
    target,
    remoteDump,
  );
  const restored = new Pool({ connectionString: databaseUrl(target, role), max: 1 });
  const row = await restored.query<{ schema_version: number; payload: string }>(
    `SELECT schema_version,payload FROM ${table}`,
  );
  await restored.query(`UPDATE ${table} SET schema_version=$1`, [schemaVersion]);
  const upgraded = await restored.query<{ schema_version: number }>(
    `SELECT schema_version FROM ${table}`,
  );
  await restored.end();
  if (
    row.rows[0]?.payload !== "synthetic-no-pii" ||
    row.rows[0]?.schema_version !== schemaVersion - 1 ||
    upgraded.rows[0]?.schema_version !== schemaVersion
  )
    throw new Error("RESTORE_N_MINUS_ONE_TO_N_FAILED");
  exec("exec", container, "rm", "-f", remoteDump);
  return {
    owner: ownerId,
    ...measureRecovery(manifest, started, new Date()),
    result: "verified_isolated_n_minus_one_to_n",
  };
}

function exec(...args: string[]) {
  execFileSync("docker", args, { stdio: "ignore", timeout: 30_000 });
}
function resource(kind: string) {
  const value = `lifebridge_p7s3_${kind}_${suffix}`;
  if (!/^[a-z0-9_]{1,63}$/.test(value)) throw new Error("P7_S3_RESOURCE_INVALID");
  return value;
}
function databaseUrl(database: string, role: string) {
  const value = new URL(adminUrl);
  value.username = role;
  value.pathname = `/${database}`;
  return value.toString();
}
async function drop(database: string) {
  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",
    [database],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${database}`);
}
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
