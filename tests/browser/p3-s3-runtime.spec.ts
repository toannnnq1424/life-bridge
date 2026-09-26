import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P3_S3_REAL_RUNTIME !== "1",
  "requires the built P3-S3 runtime and PostgreSQL",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

test("real P3-S3 path proves role denial, fresh consent, durable confirmation and revoke denial", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const care = new Pool({ connectionString: required("CARE_DATABASE_URL"), max: 2 });
  const subjectContext = await browser.newContext({ baseURL });
  const memberContext = await browser.newContext({ baseURL });
  const subject = await subjectContext.newPage();
  const member = await memberContext.newPage();
  const suffix = `${process.pid}${Date.now().toString().slice(-6)}`;
  try {
    await registerAndSignIn(
      subject,
      `p3s3.subject.${suffix}`,
      "P3-S3 subject synthetic passphrase",
    );
    await registerAndSignIn(member, `p3s3.member.${suffix}`, "P3-S3 member synthetic passphrase");
    await subject.goto("/households/new");
    await selectEnglish(subject);
    await subject.locator('input[name="displayLabel"]').fill("P3-S3 synthetic household");
    await subject.locator('button[type="submit"]').click();
    const invitationPath = await subject.locator('a[href$="/invitations"]').getAttribute("href");
    expect(invitationPath).toBeTruthy();
    const householdId = invitationPath!.split("/")[2]!;
    await subject.goto(invitationPath!);
    await selectEnglish(subject);
    await subject.locator('input[name="inviteeLoginName"]').fill(`p3s3.member.${suffix}`);
    const invitationResponse = subject.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/households/${householdId}/invitations`) &&
        response.request().method() === "POST",
    );
    await subject.locator('button[type="submit"]').click();
    const token = (
      (await (await invitationResponse).json()) as { data: { invitationToken: string } }
    ).data.invitationToken;
    await member.goto("/invitations");
    await selectEnglish(member);
    await member.locator('input[name="invitationToken"]').fill(token);
    await member.locator('button[value="accept"]').click();
    await subject.goto(`/households/${householdId}/recipient-context`);
    await selectEnglish(subject);
    await subject.locator('input[name="displayLabel"]').fill("Synthetic recipient");
    await subject.locator('input[name="relationshipLabel"]').fill("Synthetic relationship");
    await subject.getByRole("button", { name: /Save context/ }).click();
    await subject.goto(`/households/${householdId}/consent`);
    await subject.getByRole("button", { name: /Review self authority/ }).click();
    await subject.getByRole("button", { name: /Confirm$/ }).click();
    await expect(subject.locator(".status-panel")).toContainText("Self authority confirmed");

    await member.goto(`/households/${householdId}/care-plan`);
    await member.locator(".care-plan-header select").selectOption("en");
    await expect(
      member.getByRole("heading", { name: "This content cannot be opened" }),
    ).toBeVisible();

    await subject.goto("/settings/privacy");
    await subject
      .getByRole("radio", { name: /Household only/ })
      .nth(1)
      .check();
    await subject.getByRole("button", { name: /Review changes/ }).click();
    await subject.getByRole("button", { name: /Confirm save/ }).click();
    await subject.goto(`/households/${householdId}/consent`);
    await subject.getByLabel(/Recipient/).selectOption({ index: 1 });
    await subject.getByLabel(/Basic recipient label/).check();
    await subject.getByRole("button", { name: /Review grant/ }).click();
    await subject.getByRole("button", { name: /Confirm grant/ }).click();
    await expect(subject.locator(".status-panel")).toContainText("server confirmed");

    await member.goto(`/households/${householdId}/care-plan`);
    await member.locator(".care-plan-header select").selectOption("en");
    await member.getByRole("button", { name: "Edit support plan" }).click();
    await member.getByLabel("Local review date").fill("2026-11-01");
    await member.getByLabel("IANA review time zone").selectOption("America/New_York");
    await member.getByRole("button", { name: "Review unsent draft" }).click();
    await expect(member.getByRole("heading", { name: "Review unsent draft" })).toBeFocused();
    await member.getByRole("button", { name: "Make current" }).click();
    await expect(
      member.getByRole("heading", { name: "The confirmed support plan is current" }),
    ).toBeFocused();

    const durable = await care.query<{
      versions: number;
      transitions: number;
      audits: number;
      suppressed: number;
    }>(
      `SELECT
      (SELECT COUNT(*)::int FROM care_plan_versions v JOIN care_plans p USING(plan_id) WHERE p.household_id=$1) AS versions,
      (SELECT COUNT(*)::int FROM care_plan_transitions t JOIN care_plans p USING(plan_id) WHERE p.household_id=$1) AS transitions,
      (SELECT COUNT(*)::int FROM care_audit WHERE household_id=$1 AND resource_type='care_plan') AS audits,
      (SELECT COUNT(*)::int FROM care_outbox o JOIN care_plans p ON p.plan_id=o.aggregate_id WHERE p.household_id=$1 AND o.status='suppressed') AS suppressed`,
      [householdId],
    );
    expect(durable.rows[0]).toEqual({ versions: 1, transitions: 2, audits: 2, suppressed: 1 });
    expect(await browserPersistence(member)).not.toContain("Weekly coordination check-in");

    await subject.getByRole("button", { name: /Revoke/ }).click();
    await subject.getByRole("button", { name: /Confirm revoke/ }).click();
    await expect(subject.locator(".status-panel")).toContainText("server confirmed");
    await member.reload();
    await expect(
      member.getByRole("heading", { name: "This content cannot be opened" }),
    ).toBeVisible();
  } finally {
    await subjectContext.close();
    await memberContext.close();
    await care.end();
  }
});

async function registerAndSignIn(page: Page, loginName: string, password: string) {
  await page.goto("/register");
  await page.locator('input[name="loginName"]').fill(loginName);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  const secret = await page.locator(".secret-display").innerText();
  await page.locator('input[name="code"]').fill(generateTotp(secret, Date.now()));
  await page.locator('button[type="submit"]').click();
  await page.locator('input[type="checkbox"]').check();
  await page.locator('form#ack-form button[type="submit"]').click();
  await page.locator('input[name="loginName"]').fill(loginName);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.locator('input[name="code"]').fill(generateTotp(secret, Date.now() + 30_000));
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/onboarding$/);
}
async function selectEnglish(page: Page) {
  await page.locator('select:has(option[value="en"])').first().selectOption("en");
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
