import { expect, test, type Page } from "@playwright/test";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(process.env.P2_REAL_RUNTIME !== "1", "requires the built P2-S2 runtime and PostgreSQL");
test.describe.configure({ mode: "serial" });

test("real browser path crosses web, gateway, Identity and PostgreSQL", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const organizerContext = await browser.newContext({ baseURL });
  const inviteeContext = await browser.newContext({ baseURL });
  const organizer = await organizerContext.newPage();
  const invitee = await inviteeContext.newPage();
  const organizerSecret = await registerAndSignIn(
    organizer,
    "browser.organizer",
    "Organizer browser passphrase",
  );
  expect(organizerSecret.length).toBeGreaterThan(20);
  await registerAndSignIn(invitee, "browser.invitee", "Invitee browser passphrase");

  await organizer.goto("/households/new");
  await organizer.locator('input[name="displayLabel"]').fill("Synthetic browser household");
  await organizer.locator('button[type="submit"]').click();
  const invitationLink = organizer.locator('a[href$="/invitations"]');
  const invitationPath = await invitationLink.getAttribute("href");
  expect(invitationPath).toBeTruthy();
  const householdId = invitationPath!.split("/")[2]!;

  await organizer.goto(invitationPath!);
  await organizer.locator('input[name="inviteeLoginName"]').fill("browser.invitee");
  const invitationResponse = organizer.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/households/${householdId}/invitations`) &&
      response.request().method() === "POST",
  );
  await organizer.locator('button[type="submit"]').click();
  const invitationEnvelope = (await (await invitationResponse).json()) as {
    data: { invitationToken: string };
  };
  const token = invitationEnvelope.data.invitationToken;
  expect(token).toHaveLength(43);
  await expect(organizer.locator("body")).not.toContainText(token);

  await invitee.goto("/invitations");
  await invitee.locator('input[name="invitationToken"]').fill(token);
  await invitee.locator('button[value="accept"]').click();
  await expect(invitee.locator(".status-with-icon")).toContainText(/Đã chấp nhận|Accepted/);
  await expect(invitee.locator("body")).not.toContainText(token);

  await organizer.goto(`/households/${householdId}/recipient-context`);
  await organizer.locator('input[name="displayLabel"]').fill("Synthetic recipient");
  await organizer.locator('input[name="relationshipLabel"]').fill("Family member");
  await organizer.getByRole("button", { name: /Lưu bối cảnh|Save context/ }).click();
  await expect(organizer.getByText("Synthetic recipient")).toBeVisible();

  await invitee.goto(`/households/${householdId}/recipient-context`);
  await expect(invitee.getByText("Synthetic recipient")).toBeVisible();
  await expect(invitee.locator('form input[name="displayLabel"]')).toHaveCount(0);
  expect(await persistedBrowserState(organizer)).not.toContain(token);
  expect(await persistedBrowserState(invitee)).not.toContain(token);

  await organizerContext.close();
  await inviteeContext.close();
});

async function registerAndSignIn(page: Page, loginName: string, password: string): Promise<string> {
  await page.goto("/register");
  await page.locator('input[name="loginName"]').fill(loginName);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  const manualSecret = await page.locator(".secret-display").innerText();
  await page.locator('input[name="code"]').fill(generateTotp(manualSecret, Date.now()));
  await page.locator('button[type="submit"]').click();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Tiếp tục|Continue/ }).click();

  await page.locator('input[name="loginName"]').fill(loginName);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.locator('input[name="code"]').fill(generateTotp(manualSecret, Date.now() + 30_000));
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/onboarding$/);
  return manualSecret;
}

async function persistedBrowserState(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify({
      url: location.href,
      history: history.state,
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
}
