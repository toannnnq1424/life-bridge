import { createHash } from "node:crypto";

import {
  port,
  requiredDependencyUrl,
  requiredSecret,
  requiredUrl,
  RuntimeModeSchema,
} from "@lifebridge/config";
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
const migrationDatabaseUrl = requiredUrl(
  process.env.CARE_MIGRATION_DATABASE_URL ??
    (process.env.RUNTIME_MODE === "local" || process.env.RUNTIME_MODE === "test"
      ? databaseUrl
      : undefined),
  "CARE_MIGRATION_DATABASE_URL",
);
const internalToken = requiredSecret(process.env.CARE_INTERNAL_TOKEN, "CARE_INTERNAL_TOKEN");
const previousInternalToken = process.env.CARE_INTERNAL_TOKEN_PREVIOUS
  ? requiredSecret(process.env.CARE_INTERNAL_TOKEN_PREVIOUS, "CARE_INTERNAL_TOKEN_PREVIOUS")
  : undefined;
const cursorSecret = requiredSecret(process.env.CARE_CURSOR_KEY, "CARE_CURSOR_KEY");
const notificationToken = requiredSecret(
  process.env.RUNTIME_MODE === "production"
    ? process.env.CARE_NOTIFICATION_INTERNAL_TOKEN
    : (process.env.CARE_NOTIFICATION_INTERNAL_TOKEN ?? process.env.NOTIFICATION_INTERNAL_TOKEN),
  "CARE_NOTIFICATION_INTERNAL_TOKEN",
);
const recoveryInternalToken = requiredSecret(
  process.env.RUNTIME_MODE === "production"
    ? process.env.CARE_RECOVERY_INTERNAL_TOKEN
    : (process.env.CARE_RECOVERY_INTERNAL_TOKEN ?? internalToken),
  "CARE_RECOVERY_INTERNAL_TOKEN",
);
const runtimeMode = RuntimeModeSchema.parse(process.env.RUNTIME_MODE);
const notificationUrl = requiredDependencyUrl(
  process.env.NOTIFICATION_URL,
  "NOTIFICATION_URL",
  runtimeMode,
);
const servicePort = port(process.env.CARE_PORT, 3101);
const serviceHost = process.env.CARE_HOST ?? "127.0.0.1";

await migrateCareDatabase(migrationDatabaseUrl);
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
  runtimeMode === "production",
  previousInternalToken,
  recoveryInternalToken,
);
const dispatcher = new OutboxDispatcher(
  care,
  httpEventDeliverer(notificationUrl, notificationToken),
);

let dispatching = false;
const timer = setInterval(() => {
  if (dispatching) return;
  dispatching = true;
  void dispatcher.dispatchOnce().finally(() => {
    dispatching = false;
  });
}, 250);
timer.unref();

const close = async () => {
  clearInterval(timer);
  await app.close();
  await pool.end();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await app.listen({ host: serviceHost, port: servicePort });
