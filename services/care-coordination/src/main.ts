import { createHash } from "node:crypto";

import { port, requiredSecret, requiredUrl } from "@lifebridge/config";
import { Pool } from "pg";

import { OutboxDispatcher, httpEventDeliverer } from "./dispatcher.js";
import { AppointmentService } from "./appointment-service.js";
import { CarePlanService } from "./care-plan-service.js";
import { CoordinationService } from "./coordination-service.js";
import { EmergencyReadinessService } from "./emergency-readiness-service.js";
import { DocumentVaultService } from "./document-vault-service.js";
import { MedicationReminderService } from "./medication-reminder-service.js";
import { migrateCareDatabase } from "./migration.js";
import { buildCareServer } from "./server.js";
import { CareService } from "./service.js";

const databaseUrl = requiredUrl(process.env.CARE_DATABASE_URL, "CARE_DATABASE_URL");
const internalToken = requiredSecret(process.env.CARE_INTERNAL_TOKEN, "CARE_INTERNAL_TOKEN");
const cursorSecret = requiredSecret(process.env.CARE_CURSOR_KEY, "CARE_CURSOR_KEY");
const notificationToken = requiredSecret(
  process.env.NOTIFICATION_INTERNAL_TOKEN,
  "NOTIFICATION_INTERNAL_TOKEN",
);
const notificationUrl = requiredUrl(process.env.NOTIFICATION_URL, "NOTIFICATION_URL");
const servicePort = port(process.env.CARE_PORT, 3101);

await migrateCareDatabase(databaseUrl);
const pool = new Pool({ connectionString: databaseUrl, max: 10 });
const care = new CareService(pool);
const coordination = new CoordinationService(pool, {
  cursorKey: createHash("sha256").update(cursorSecret).digest(),
});
const appointments = new AppointmentService(pool);
const carePlans = new CarePlanService(pool, {
  cursorKey: createHash("sha256").update(`${cursorSecret}:care-plan`).digest(),
});
const medicationReminders = new MedicationReminderService(pool);
const emergencyReadiness = new EmergencyReadinessService(pool, {
  cursorKey: createHash("sha256").update(`${cursorSecret}:emergency-readiness`).digest(),
});
const documentVault = new DocumentVaultService(pool);
const app = buildCareServer(
  care,
  internalToken,
  coordination,
  appointments,
  carePlans,
  medicationReminders,
  emergencyReadiness,
  documentVault,
);
const dispatcher = new OutboxDispatcher(
  care,
  httpEventDeliverer(notificationUrl, notificationToken),
);

const timer = setInterval(() => {
  void dispatcher.dispatchOnce();
}, 250);
timer.unref();

const close = async () => {
  clearInterval(timer);
  await app.close();
  await pool.end();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await app.listen({ host: "127.0.0.1", port: servicePort });
