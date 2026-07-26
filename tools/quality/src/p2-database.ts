import { Pool } from "pg";

const adminUrl = required("P2_ADMIN_DATABASE_URL");
const identityPassword = credential("P2_IDENTITY_DATABASE_PASSWORD");
const pool = new Pool({ connectionString: adminUrl, max: 1 });

try {
  await pool.query(`
    DO $provision$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lifebridge_identity') THEN
        CREATE ROLE lifebridge_identity LOGIN PASSWORD '${identityPassword}';
      ELSE
        ALTER ROLE lifebridge_identity WITH LOGIN PASSWORD '${identityPassword}';
      END IF;
    END
    $provision$;
  `);
  const exists = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    ["lifebridge_identity"],
  );
  if (!exists.rows[0]?.exists) {
    await pool.query("CREATE DATABASE lifebridge_identity OWNER lifebridge_identity");
  }
  await pool.query("ALTER DATABASE lifebridge_identity OWNER TO lifebridge_identity");
} finally {
  await pool.end();
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}_REQUIRED`);
  }
  return value;
}

function credential(name: string): string {
  const value = required(name);
  if (!/^[A-Za-z0-9]{24,128}$/.test(value)) {
    throw new Error(`${name}_INVALID`);
  }
  return value;
}
