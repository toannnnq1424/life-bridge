import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P4_S2_REAL_RUNTIME !== "1",
  "requires the built P4-S2 runtime and PostgreSQL",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test("real P4-S2 path proves exact authority, reviewed state, encrypted offline read, and replacement purge", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const care = new Pool({ connectionString: required("CARE_DATABASE_URL"), max: 2 });
  const identity = new Pool({ connectionString: required("IDENTITY_DATABASE_URL"), max: 1 });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const suffix = `${process.pid}${Date.now().toString().slice(-6)}`;
  let readinessId = "";

  try {
    await registerAndSignIn(page, `p4s2.subject.${suffix}`, "P4-S2 subject synthetic passphrase");
    await page.goto("/households/new");
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("P4-S2 synthetic household");
    await page.locator('button[type="submit"]').click();
    const invitationPath = await page.locator('a[href$="/invitations"]').getAttribute("href");
    expect(invitationPath).toBeTruthy();
    const householdId = invitationPath!.split("/")[2]!;

    await page.goto(`/households/${householdId}/recipient-context`);
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("Synthetic P4-S2 recipient");
    await page.locator('input[name="relationshipLabel"]').fill("Synthetic P4-S2 relationship");
    await page.locator('form.account-card button[type="submit"]').click();
    await page.goto(`/households/${householdId}/consent`);
    await page.getByRole("button", { name: /Review self authority/ }).click();
    await page.getByRole("button", { name: /Confirm$/ }).click();
    await expect(page.locator(".status-panel")).toContainText("Self authority confirmed");

    await page.goto(`/households/${householdId}/emergency-contacts`);
    await page.locator(".emergency-header select").selectOption("en");
    await page.getByRole("button", { name: "Add contact" }).click();
    await page.getByLabel("Display label").fill("Synthetic emergency contact");
    await page.getByLabel("Configured phone number").fill("+66000000001");
    await page.getByRole("button", { name: "Review complete order" }).click();
    await page.getByRole("button", { name: "Confirm complete contact list" }).click();
    await expect(
      page.getByRole("heading", { name: "Contact list confirmed by the server." }),
    ).toBeFocused();

    await page.goto(`/households/${householdId}/emergency-plan`);
    await page.locator(".emergency-header select").selectOption("en");
    await page
      .getByLabel(/Participant-entered plan steps 1/)
      .fill("Synthetic participant-entered step");
    await page.getByRole("button", { name: "Save draft on server" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Draft saved by the server; it is not the current reviewed plan.",
      }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Review and confirm version" }).click();
    await expect(
      page.getByRole("heading", { name: "Emergency plan version confirmed by the server." }),
    ).toBeFocused();

    const stored = await care.query<{
      readinessId: string;
      state: string;
      listRevision: number;
      currentPlanVersion: number;
      contactLabel: string;
      dialString: string;
      stepText: string;
      outboxPayloads: unknown[];
      suppressedEvents: number;
    }>(
      `SELECT
         readiness.readiness_id AS "readinessId",
         readiness.state,
         readiness.contact_list_revision AS "listRevision",
         readiness.current_plan_version AS "currentPlanVersion",
         contact.display_label AS "contactLabel",
         contact.dial_string AS "dialString",
         step.step_text AS "stepText",
         (
           SELECT jsonb_agg(payload ORDER BY event_id)
           FROM care_outbox WHERE aggregate_id=readiness.readiness_id
         ) AS "outboxPayloads",
         (
           SELECT COUNT(*)::int FROM care_outbox
           WHERE aggregate_id=readiness.readiness_id AND status='suppressed'
         ) AS "suppressedEvents"
       FROM care_emergency_readiness AS readiness
       JOIN care_emergency_contacts AS contact USING(readiness_id)
       JOIN care_emergency_plan_version_steps AS step
         ON step.readiness_id=readiness.readiness_id
        AND step.plan_version=readiness.current_plan_version
       WHERE readiness.household_id=$1`,
      [householdId],
    );
    expect(stored.rows).toHaveLength(1);
    readinessId = stored.rows[0]!.readinessId;
    expect(stored.rows[0]).toMatchObject({
      state: "reviewed",
      listRevision: 1,
      currentPlanVersion: 1,
      contactLabel: "Synthetic emergency contact",
      dialString: "+66000000001",
      stepText: "Synthetic participant-entered step",
      suppressedEvents: 2,
    });
    expect(JSON.stringify(stored.rows[0]!.outboxPayloads)).not.toMatch(
      /Synthetic|\+660|diagnosis|urgency|dispatch|availability/i,
    );

    await page
      .getByLabel("Offline passphrase (not your account password)")
      .fill("synthetic offline phrase");
    await page.getByRole("button", { name: "Save encrypted copy on this device" }).click();
    await expect(page.getByText(/encrypted copy was verified/)).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) location.reload();
    });
    await page.waitForLoadState("domcontentloaded");
    await context.setOffline(true);
    await page.goto(`/households/${householdId}/emergency-plan`);
    await expect(page.locator("#protected-content")).toBeHidden();
    await page.getByRole("button", { name: "English" }).click();
    await page.getByLabel("Offline passphrase").fill("synthetic offline phrase");
    await page.getByRole("button", { name: "Open copy" }).click();
    await expect(page.getByText("Synthetic participant-entered step")).toBeVisible();
    await expect(page.getByText(/still not live/)).toBeVisible();
    await expect(page.getByText(/Last server confirmation/)).toBeVisible();
    expect(await page.locator("a[href='tel:+66000000001']").count()).toBe(1);

    await context.setOffline(false);
    await page.goto(`/households/${householdId}/emergency-contacts`);
    await page.locator(".emergency-header select").selectOption("en");
    await page.getByLabel("Configured phone number").fill("+66000000002");
    await page.getByRole("button", { name: "Review complete order" }).click();
    await page.getByRole("button", { name: "Confirm complete contact list" }).click();
    await page.goto(`/households/${householdId}/emergency-plan`);
    await expect(page.getByText(/review is required before a new offline copy/)).toBeVisible();
    await expect(page.getByText("This device has no saved emergency-plan copy.")).toBeVisible();

    const decisions = await identity.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM identity_consent_audit
       WHERE category='recipient_context.access_allowed'
         AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'`,
    );
    expect(decisions.rows[0]!.count).toBeGreaterThanOrEqual(8);
    expect(await browserPersistence(page)).not.toMatch(
      /Synthetic emergency contact|\+6600000000|Synthetic participant-entered step|synthetic offline phrase/,
    );
  } finally {
    await context.close();
    await cleanup(care, readinessId);
    await care.end();
    await identity.end();
  }
});

async function registerAndSignIn(page: Page, loginName: string, password: string) {
  await page.goto("/register");
  await page.locator('input[name="loginName"]').fill(loginName);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  const manualSecret = await page.locator(".secret-display").innerText();
  await page.locator('input[name="code"]').fill(generateTotp(manualSecret, Date.now()));
  await page.locator('button[type="submit"]').click();
  await page.locator('input[type="checkbox"]').check();
  await page.locator('form#ack-form button[type="submit"]').click();
  await page.locator('input[name="loginName"]').fill(loginName);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.locator('input[name="code"]').fill(generateTotp(manualSecret, Date.now() + 30_000));
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

async function selectEnglish(page: Page) {
  await page.locator('select:has(option[value="en"])').first().selectOption("en");
}

async function cleanup(care: Pool, readinessId: string) {
  if (!readinessId) return;
  const actor = await care.query<{ actorId: string }>(
    `SELECT actor_id AS "actorId" FROM care_audit
     WHERE resource_type='emergency_readiness' AND resource_id=$1 LIMIT 1`,
    [readinessId],
  );
  await care.query("DELETE FROM care_emergency_plan_transitions WHERE readiness_id=$1", [
    readinessId,
  ]);
  await care.query("DELETE FROM care_emergency_plan_version_steps WHERE readiness_id=$1", [
    readinessId,
  ]);
  await care.query("DELETE FROM care_emergency_plan_versions WHERE readiness_id=$1", [readinessId]);
  await care.query("DELETE FROM care_emergency_contact_transitions WHERE readiness_id=$1", [
    readinessId,
  ]);
  await care.query("DELETE FROM care_outbox WHERE aggregate_id=$1", [readinessId]);
  await care.query(
    "DELETE FROM care_audit WHERE resource_type='emergency_readiness' AND resource_id=$1",
    [readinessId],
  );
  if (actor.rows[0]?.actorId) {
    await care.query(
      "DELETE FROM care_idempotency WHERE actor_id=$1 AND operation LIKE 'emergency.%'",
      [actor.rows[0].actorId],
    );
  }
  await care.query("DELETE FROM care_emergency_readiness WHERE readiness_id=$1", [readinessId]);
}

async function browserPersistence(page: Page) {
  return page.evaluate(() =>
    JSON.stringify({
      url: location.href,
      history: history.state,
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
