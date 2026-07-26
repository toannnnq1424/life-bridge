import { Pool } from "pg";

const databaseUrl = required("IDENTITY_DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  await pool.query(`TRUNCATE
    identity_audit,
    identity_preferences,
    identity_rate_limits,
    identity_sessions,
    identity_challenges,
    identity_recovery_codes,
    identity_authenticators,
    identity_accounts
    RESTART IDENTITY CASCADE`);
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
