import { port, requiredKey, requiredSecret, requiredUrl } from "@lifebridge/config";
import { Pool } from "pg";

import { hashPassword } from "./crypto.js";
import { migrateIdentityDatabase } from "./migration.js";
import { buildIdentityServer } from "./server.js";
import { ConsentService } from "./consent-service.js";
import { HouseholdService } from "./household-service.js";
import { IdentityService } from "./service.js";

const databaseUrl = requiredUrl(process.env.IDENTITY_DATABASE_URL, "IDENTITY_DATABASE_URL");
const migrationDatabaseUrl = requiredUrl(
  process.env.IDENTITY_MIGRATION_DATABASE_URL ??
    (process.env.RUNTIME_MODE === "local" || process.env.RUNTIME_MODE === "test"
      ? databaseUrl
      : undefined),
  "IDENTITY_MIGRATION_DATABASE_URL",
);
const internalToken = requiredSecret(
  process.env.IDENTITY_INTERNAL_TOKEN,
  "IDENTITY_INTERNAL_TOKEN",
);
const previousInternalToken = process.env.IDENTITY_INTERNAL_TOKEN_PREVIOUS
  ? requiredSecret(process.env.IDENTITY_INTERNAL_TOKEN_PREVIOUS, "IDENTITY_INTERNAL_TOKEN_PREVIOUS")
  : undefined;
const dataKey = requiredKey(process.env.IDENTITY_DATA_KEY, "IDENTITY_DATA_KEY");
const rateLimitKey = requiredKey(process.env.IDENTITY_RATE_LIMIT_KEY, "IDENTITY_RATE_LIMIT_KEY");
const servicePort = port(process.env.IDENTITY_PORT, 3100);
const serviceHost = process.env.IDENTITY_HOST ?? "127.0.0.1";

await migrateIdentityDatabase(migrationDatabaseUrl);
const pool = new Pool({ connectionString: databaseUrl, max: 10 });
const identity = new IdentityService(pool, {
  dataKey,
  rateLimitKey,
  dummyPasswordHash: await hashPassword(`dummy-${randomDummy()}`),
});
const households = new HouseholdService(pool, { rateLimitKey });
const consent = new ConsentService(pool, { rateLimitKey, cursorKey: dataKey });
const app = buildIdentityServer(
  identity,
  internalToken,
  households,
  consent,
  process.env.RUNTIME_MODE !== "local" && process.env.RUNTIME_MODE !== "test",
  previousInternalToken,
);

const close = async () => {
  await app.close();
  await pool.end();
};
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());

await app.listen({ host: serviceHost, port: servicePort });

function randomDummy(): string {
  return globalThis.crypto.randomUUID().replaceAll("-", "");
}
