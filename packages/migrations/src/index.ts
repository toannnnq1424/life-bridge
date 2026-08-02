import { createHash } from "node:crypto";

import { type PoolClient, Pool } from "pg";

export interface OwnedMigration {
  version: number;
  name: string;
  sql: string;
}

export interface MigrationHealth {
  owner: string;
  version: number;
  result: "applied" | "baselined" | "repeat_safe" | "failed" | "uncertain_reconciled";
  failureClass?: "checksum_drift" | "database_unavailable" | "lock_timeout" | "migration_failed";
  durationMs: number;
}

type MigrationFailureClass = Exclude<MigrationHealth["failureClass"], undefined>;

export interface OwnedMigrationOptions {
  connectionString: string;
  owner: string;
  stateTable: string;
  tool: string;
  migrations: OwnedMigration[];
  lockTimeoutMs?: number;
  statementTimeoutMs?: number;
  connectionTimeoutMs?: number;
  health?: (event: MigrationHealth) => void;
}

export function migrationHealthLine(event: MigrationHealth): string {
  return JSON.stringify({
    eventName: "migration.health",
    owner: event.owner,
    version: event.version,
    result: event.result,
    ...(event.failureClass ? { failureClass: event.failureClass } : {}),
    durationMs: event.durationMs,
  });
}

const LEDGER = "lifebridge_migration_ledger";
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

export async function migrateOwnedDatabase(options: OwnedMigrationOptions): Promise<void> {
  assertDefinition(options);
  const started = Date.now();
  const pool = new Pool({
    connectionString: options.connectionString,
    max: 1,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? 5000,
  });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`SET lock_timeout = '${options.lockTimeoutMs ?? 5000}ms'`);
    await client.query(`SET statement_timeout = '${options.statementTimeoutMs ?? 30000}ms'`);
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [
      `lifebridge:migration:${options.owner}`,
    ]);
    await ensureLedger(client);
    await baselineAcceptedHistory(client, options);
    await validateLedger(client, options);

    for (const migration of options.migrations) {
      const checksum = sha256(migration.sql);
      const applied = await client.query<{ checksum_sha256: string }>(
        `SELECT checksum_sha256 FROM ${LEDGER} WHERE owner=$1 AND version=$2`,
        [options.owner, migration.version],
      );
      if (applied.rowCount) {
        if (applied.rows[0]?.checksum_sha256 !== checksum) throw drift(migration.version);
        emit(options, migration.version, "repeat_safe", started);
        continue;
      }
      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${LEDGER}
             (owner, version, name, checksum_sha256, tool, outcome, applied_at)
           VALUES ($1,$2,$3,$4,$5,'applied',CURRENT_TIMESTAMP)`,
          [options.owner, migration.version, migration.name, checksum, options.tool],
        );
        try {
          await client.query("COMMIT");
          emit(options, migration.version, "applied", started);
        } catch (error) {
          if (
            await reconcilesCommitted(
              options.connectionString,
              options.owner,
              migration.version,
              checksum,
            )
          ) {
            emit(options, migration.version, "uncertain_reconciled", started);
          } else {
            throw error;
          }
        }
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // The connection may be unavailable; the original bounded error wins.
        }
        throw error;
      }
    }
  } catch (error) {
    emitFailure(options, classify(error), started);
    throw error;
  } finally {
    if (client) {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
          `lifebridge:migration:${options.owner}`,
        ]);
      } catch {
        // Session close releases the owner lock.
      }
      client.release(true);
    }
    await pool.end();
  }
}

async function ensureLedger(client: PoolClient): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS ${LEDGER} (
    owner TEXT NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    name TEXT NOT NULL,
    checksum_sha256 CHAR(64) NOT NULL,
    tool TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('applied','baselined')),
    applied_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (owner, version),
    UNIQUE (owner, name)
  )`);
}

async function baselineAcceptedHistory(
  client: PoolClient,
  options: OwnedMigrationOptions,
): Promise<void> {
  const ledger = await client.query(`SELECT 1 FROM ${LEDGER} WHERE owner=$1 LIMIT 1`, [
    options.owner,
  ]);
  if (ledger.rowCount) return;
  const relation = await client.query<{ relation: string | null }>(
    "SELECT to_regclass($1)::text AS relation",
    [options.stateTable],
  );
  if (!relation.rows[0]?.relation) return;
  const state = await client.query<{ version: number }>(
    `SELECT version FROM ${options.stateTable} WHERE service=$1`,
    [options.owner],
  );
  const accepted = state.rows[0]?.version ?? 0;
  if (accepted > options.migrations.length) throw new Error("MIGRATION_LEDGER_AHEAD");
  for (const migration of options.migrations.slice(0, accepted)) {
    await client.query(
      `INSERT INTO ${LEDGER}
         (owner,version,name,checksum_sha256,tool,outcome,applied_at)
       VALUES ($1,$2,$3,$4,$5,'baselined',CURRENT_TIMESTAMP)`,
      [options.owner, migration.version, migration.name, sha256(migration.sql), options.tool],
    );
    emit(options, migration.version, "baselined", Date.now());
  }
}

async function validateLedger(client: PoolClient, options: OwnedMigrationOptions): Promise<void> {
  const rows = await client.query<{ version: number; name: string; checksum_sha256: string }>(
    `SELECT version,name,checksum_sha256 FROM ${LEDGER} WHERE owner=$1 ORDER BY version`,
    [options.owner],
  );
  for (let index = 0; index < rows.rows.length; index += 1) {
    const row = rows.rows[index]!;
    const expected = options.migrations[index];
    if (
      !expected ||
      row.version !== index + 1 ||
      row.name !== expected.name ||
      row.checksum_sha256 !== sha256(expected.sql)
    ) {
      throw drift(row.version);
    }
  }
}

async function reconcilesCommitted(
  connectionString: string,
  owner: string,
  version: number,
  checksum: string,
): Promise<boolean> {
  const reconciliation = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const result = await reconciliation.query<{ checksum_sha256: string }>(
      `SELECT checksum_sha256 FROM ${LEDGER} WHERE owner=$1 AND version=$2`,
      [owner, version],
    );
    return result.rows[0]?.checksum_sha256 === checksum;
  } finally {
    await reconciliation.end();
  }
}

function assertDefinition(options: OwnedMigrationOptions): void {
  for (const timeout of [options.lockTimeoutMs ?? 5000, options.statementTimeoutMs ?? 30000]) {
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 300_000) {
      throw new Error("MIGRATION_TIMEOUT_INVALID");
    }
  }
  if (
    !IDENTIFIER.test(options.stateTable) ||
    !IDENTIFIER.test(options.owner.replaceAll("-", "_"))
  ) {
    throw new Error("MIGRATION_DEFINITION_INVALID");
  }
  options.migrations.forEach((migration, index) => {
    if (migration.version !== index + 1 || !/^\d{3}_[a-z0-9_]+\.sql$/.test(migration.name)) {
      throw new Error("MIGRATION_ORDER_INVALID");
    }
  });
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function drift(version: number): Error {
  return new Error(`MIGRATION_CHECKSUM_DRIFT:${version}`);
}

function classify(error: unknown): MigrationFailureClass {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("MIGRATION_CHECKSUM_DRIFT") || message === "MIGRATION_LEDGER_AHEAD") {
    return "checksum_drift";
  }
  if (code === "55P03" || code === "57014") return "lock_timeout";
  if (code.startsWith("08") || code === "57P03") return "database_unavailable";
  return "migration_failed";
}

function emit(
  options: OwnedMigrationOptions,
  version: number,
  result: MigrationHealth["result"],
  started: number,
): void {
  options.health?.({ owner: options.owner, version, result, durationMs: Date.now() - started });
}

function emitFailure(
  options: OwnedMigrationOptions,
  failureClass: MigrationFailureClass,
  started: number,
): void {
  options.health?.({
    owner: options.owner,
    version: 0,
    result: "failed",
    failureClass,
    durationMs: Date.now() - started,
  });
}
