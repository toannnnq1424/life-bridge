import { requiredUrl } from "@lifebridge/config";

import { migrateIdentityDatabase } from "./migration.js";

await migrateIdentityDatabase(
  requiredUrl(process.env.IDENTITY_DATABASE_URL, "IDENTITY_DATABASE_URL"),
);
