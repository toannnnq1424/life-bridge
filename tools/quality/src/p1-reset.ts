import { Pool } from "pg";

const careUrl = required("CARE_DATABASE_URL");
const notificationUrl = required("NOTIFICATION_DATABASE_URL");
const care = new Pool({ connectionString: careUrl, max: 1 });
const notification = new Pool({ connectionString: notificationUrl, max: 1 });

try {
  await care.query(
    "TRUNCATE care_idempotency, care_audit, care_outbox, care_tasks RESTART IDENTITY",
  );
  await notification.query("TRUNCATE notifications, notification_inbox RESTART IDENTITY CASCADE");
} finally {
  await Promise.all([care.end(), notification.end()]);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name}_REQUIRED`);
  }
  return value;
}
