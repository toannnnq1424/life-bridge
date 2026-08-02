import { port, requiredSecret, requiredUrl } from "@lifebridge/config";
import { Pool } from "pg";

import { migrateNotificationDatabase } from "./migration.js";
import { MedicationReminderNotificationService } from "./medication-reminder-service.js";
import { buildNotificationServer } from "./server.js";
import { NotificationService } from "./service.js";

const databaseUrl = requiredUrl(process.env.NOTIFICATION_DATABASE_URL, "NOTIFICATION_DATABASE_URL");
const migrationDatabaseUrl = requiredUrl(
  process.env.NOTIFICATION_MIGRATION_DATABASE_URL ??
    (process.env.RUNTIME_MODE === "local" || process.env.RUNTIME_MODE === "test"
      ? databaseUrl
      : undefined),
  "NOTIFICATION_MIGRATION_DATABASE_URL",
);
const internalToken = requiredSecret(
  process.env.NOTIFICATION_INTERNAL_TOKEN,
  "NOTIFICATION_INTERNAL_TOKEN",
);
const careInternalToken = requiredSecret(
  process.env.RUNTIME_MODE === "production"
    ? process.env.CARE_NOTIFICATION_INTERNAL_TOKEN
    : (process.env.CARE_NOTIFICATION_INTERNAL_TOKEN ?? internalToken),
  "CARE_NOTIFICATION_INTERNAL_TOKEN",
);
const previousInternalToken = process.env.NOTIFICATION_INTERNAL_TOKEN_PREVIOUS
  ? requiredSecret(
      process.env.NOTIFICATION_INTERNAL_TOKEN_PREVIOUS,
      "NOTIFICATION_INTERNAL_TOKEN_PREVIOUS",
    )
  : undefined;
const previousCareInternalToken = process.env.CARE_NOTIFICATION_INTERNAL_TOKEN_PREVIOUS
  ? requiredSecret(
      process.env.CARE_NOTIFICATION_INTERNAL_TOKEN_PREVIOUS,
      "CARE_NOTIFICATION_INTERNAL_TOKEN_PREVIOUS",
    )
  : undefined;
const servicePort = port(process.env.NOTIFICATION_PORT, 3102);
const serviceHost = process.env.NOTIFICATION_HOST ?? "127.0.0.1";

await migrateNotificationDatabase(migrationDatabaseUrl);
const pool = new Pool({ connectionString: databaseUrl, max: 10 });
const service = new NotificationService(pool);
const medicationReminders = new MedicationReminderNotificationService(pool);
const app = buildNotificationServer(
  service,
  internalToken,
  medicationReminders,
  process.env.RUNTIME_MODE !== "local" && process.env.RUNTIME_MODE !== "test",
  careInternalToken,
  previousInternalToken,
  previousCareInternalToken,
);
const deliveryTimer = setInterval(() => {
  void medicationReminders.processDue().catch(() => undefined);
}, 30_000);
deliveryTimer.unref();

const close = async () => {
  clearInterval(deliveryTimer);
  await app.close();
  await pool.end();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await app.listen({ host: serviceHost, port: servicePort });
