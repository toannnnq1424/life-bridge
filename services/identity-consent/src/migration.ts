import { readFile } from "node:fs/promises";

import { migrateOwnedDatabase, migrationHealthLine } from "@lifebridge/migrations";

export async function migrateIdentityDatabase(connectionString: string): Promise<void> {
  const names = [
    "001_initial.sql",
    "002_household_authorization.sql",
    "003_consent_privacy_audit.sql",
    "004_document_vault_scope.sql",
    "005_community_support_scope.sql",
    "006_community_match_scopes.sql",
    "007_community_moderation_scopes.sql",
    "008_p7_schema_compatibility.sql",
  ];
  await migrateOwnedDatabase({
    connectionString,
    owner: "identity-consent",
    stateTable: "identity_schema_state",
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
