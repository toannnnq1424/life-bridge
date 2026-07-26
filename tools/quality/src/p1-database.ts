import { Pool } from "pg";

const adminUrl = required("P1_ADMIN_DATABASE_URL");
const carePassword = credential("P1_CARE_DATABASE_PASSWORD");
const notificationPassword = credential("P1_NOTIFICATION_DATABASE_PASSWORD");

const pool = new Pool({ connectionString: adminUrl, max: 1 });

try {
  await createOrUpdateRole("lifebridge_care", carePassword);
  await createOrUpdateRole("lifebridge_notification", notificationPassword);
  await createDatabase("lifebridge_care", "lifebridge_care");
  await createDatabase("lifebridge_notification", "lifebridge_notification");
} finally {
  await pool.end();
}

async function createOrUpdateRole(role: string, password: string): Promise<void> {
  await pool.query(`
    DO $provision$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
        CREATE ROLE ${role} LOGIN PASSWORD '${password}';
      ELSE
        ALTER ROLE ${role} WITH LOGIN PASSWORD '${password}';
      END IF;
    END
    $provision$;
  `);
}

async function createDatabase(database: string, owner: string): Promise<void> {
  const exists = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [database],
  );
  if (!exists.rows[0]?.exists) {
    await pool.query(`CREATE DATABASE ${database} OWNER ${owner}`);
  }
  await pool.query(`ALTER DATABASE ${database} OWNER TO ${owner}`);
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
