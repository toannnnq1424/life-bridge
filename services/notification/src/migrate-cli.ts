import { requiredUrl } from "@lifebridge/config";

import { migrateNotificationDatabase } from "./migration.js";

await migrateNotificationDatabase(
  requiredUrl(process.env.NOTIFICATION_DATABASE_URL, "NOTIFICATION_DATABASE_URL"),
);
