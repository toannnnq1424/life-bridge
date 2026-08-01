import { port, requiredSecret, requiredUrl } from "@lifebridge/config";
import { Pool } from "pg";

import { migrateNotificationDatabase } from "./migration.js";
import { MedicationReminderNotificationService } from "./medication-reminder-service.js";
import { buildNotificationServer } from "./server.js";
import { NotificationService } from "./service.js";

const databaseUrl = requiredUrl(process.env.NOTIFICATION_DATABASE_URL, "NOTIFICATION_DATABASE_URL");
const internalToken = requiredSecret(
  process.env.NOTIFICATION_INTERNAL_TOKEN,
  "NOTIFICATION_INTERNAL_TOKEN",
);
const servicePort = port(process.env.NOTIFICATION_PORT, 3102);
const serviceHost = process.env.NOTIFICATION_HOST ?? "127.0.0.1";

await migrateNotificationDatabase(databaseUrl);
const pool = new Pool({ connectionString: databaseUrl, max: 10 });
const service = new NotificationService(pool);
const medicationReminders = new MedicationReminderNotificationService(pool);
const app = buildNotificationServer(service, internalToken, medicationReminders);
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
