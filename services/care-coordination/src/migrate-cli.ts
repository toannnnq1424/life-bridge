import { requiredUrl } from "@lifebridge/config";

import { migrateCareDatabase } from "./migration.js";

await migrateCareDatabase(requiredUrl(process.env.CARE_DATABASE_URL, "CARE_DATABASE_URL"));
