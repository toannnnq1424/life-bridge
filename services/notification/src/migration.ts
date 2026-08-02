import { readFile } from "node:fs/promises";

import { migrateOwnedDatabase, migrationHealthLine } from "@lifebridge/migrations";

export async function migrateNotificationDatabase(connectionString: string): Promise<void> {
  const names = [
    "001_initial.sql",
    "002_appointment_reminder_intent.sql",
    "003_medication_reminder_delivery.sql",
    "004_p7_schema_compatibility.sql",
  ];
  await migrateOwnedDatabase({
    connectionString,
    owner: "notification",
    stateTable: "notification_schema_state",
    tool: "lifebridge-node-ledger@1",
    health: (event) => console.info(migrationHealthLine(event)),
    migrations: await Promise.all(
      names.map(async (name, index) => ({
        version: index + 1,
        name,
        sql: await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
      })),
    ),
  });
}
