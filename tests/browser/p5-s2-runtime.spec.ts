import { expect, test } from "@playwright/test";
import { Pool } from "pg";

test.skip(
  process.env.P5_S2_REAL_RUNTIME !== "1",
  "requires the built Node/Spring/PostgreSQL P5-S2 runtime",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test("real P5-S2 routes expose only authoritative Community state", async ({ page }) => {
  const community = new Pool({
    connectionString: required("P5_S2_COMMUNITY_TEST_DATABASE_URL"),
    max: 1,
  });
  try {
    await page.goto("/matching");
    await expect(page.locator("main")).toBeVisible();
    await page.goto("/organization");
    await expect(page.locator("main")).toBeVisible();

    const schema = await community.query<{ version: number }>(
      "SELECT version FROM community_schema_state WHERE service='community'",
    );
    expect(schema.rows[0]?.version).toBe(2);
    const sensitive = await community.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM information_schema.columns
       WHERE table_schema='public'
         AND table_name LIKE 'community_%'
         AND column_name ~* '(diagnosis|treatment|narrative|free.?text|full.?address)'`,
    );
    expect(sensitive.rows[0]?.count).toBe(0);
  } finally {
    await community.end();
  }
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
