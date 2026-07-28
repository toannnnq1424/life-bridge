import { Pool } from "pg";

const adminUrl = process.env.P5_ADMIN_DATABASE_URL ?? required("P1_ADMIN_DATABASE_URL");
const communityPassword = credential("P5_COMMUNITY_DATABASE_PASSWORD");
const pool = new Pool({ connectionString: adminUrl, max: 1 });

try {
  await pool.query(
    `
      DO $provision$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_roles WHERE rolname = 'lifebridge_community'
        ) THEN
          CREATE ROLE lifebridge_community LOGIN PASSWORD '${communityPassword}';
        ELSE
          ALTER ROLE lifebridge_community WITH LOGIN PASSWORD '${communityPassword}';
        END IF;
      END
      $provision$;
    `,
  );

  const exists = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    ["lifebridge_community"],
  );
  if (!exists.rows[0]?.exists) {
    await pool.query("CREATE DATABASE lifebridge_community OWNER lifebridge_community");
  }
  await pool.query("ALTER DATABASE lifebridge_community OWNER TO lifebridge_community");
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
  if (!/^[A-Za-z0-9]{24,128}$/u.test(value)) {
    throw new Error(`${name}_INVALID`);
  }
  return value;
}
