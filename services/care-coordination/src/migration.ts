import { readFile } from "node:fs/promises";

import { migrateOwnedDatabase, migrationHealthLine } from "@lifebridge/migrations";

export async function migrateCareDatabase(connectionString: string): Promise<void> {
  const names = [
    "001_initial.sql",
    "002_daily_timeline_handoff.sql",
    "003_calendar_appointments.sql",
    "004_care_plan_review.sql",
    "005_medication_reminders.sql",
    "006_emergency_readiness.sql",
    "007_document_vault.sql",
    "008_p7_schema_compatibility.sql",
    "009_p7_event_recovery.sql",
  ];
  await migrateOwnedDatabase({
    connectionString,
    owner: "care-coordination",
    stateTable: "care_schema_state",
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
