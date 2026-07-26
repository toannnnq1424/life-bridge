import { expect, test, type Page } from "@playwright/test";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P2_S3_REAL_RUNTIME !== "1",
  "requires the built P2-S3 runtime and PostgreSQL",
);
test.describe.configure({ mode: "serial" });

test("real P2-S3 path proves allow, narrow, revoke, denial and redacted audit", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const subjectContext = await browser.newContext({ baseURL });
  const memberContext = await browser.newContext({ baseURL });
  const subject = await subjectContext.newPage();
  const member = await memberContext.newPage();
  await registerAndSignIn(subject, "p2s3.subject", "P2-S3 subject synthetic passphrase");
  await registerAndSignIn(member, "p2s3.member", "P2-S3 member synthetic passphrase");

  await subject.goto("/households/new");
  await subject.locator('input[name="displayLabel"]').fill("P2-S3 synthetic household");
  await subject.locator('button[type="submit"]').click();
  const invitationPath = await subject.locator('a[href$="/invitations"]').getAttribute("href");
  expect(invitationPath).toBeTruthy();
  const householdId = invitationPath!.split("/")[2]!;

  await subject.goto(invitationPath!);
  await subject.locator('input[name="inviteeLoginName"]').fill("p2s3.member");
  const invitationResponse = subject.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/households/${householdId}/invitations`) &&
      response.request().method() === "POST",
  );
  await subject.locator('button[type="submit"]').click();
  const token = ((await (await invitationResponse).json()) as { data: { invitationToken: string } })
    .data.invitationToken;
  await member.goto("/invitations");
  await member.locator('input[name="invitationToken"]').fill(token);
  await member.locator('button[value="accept"]').click();

  await subject.goto(`/households/${householdId}/recipient-context`);
  await subject.locator('input[name="displayLabel"]').fill("Runtime Recipient Alpha");
  await subject.locator('input[name="relationshipLabel"]').fill("Runtime Relationship Beta");
  await subject.getByRole("button", { name: /Lưu bối cảnh|Save context/ }).click();

  await subject.goto(`/households/${householdId}/consent`);
  await subject.getByRole("button", { name: /Review self authority/ }).click();
  await subject.getByRole("button", { name: /^Xác nhận.*Confirm$/ }).click();
  await expect(subject.locator(".status-panel")).toContainText("Self authority confirmed");

  const fullAfterBinding = await member.evaluate(async (id) => {
    const response = await fetch(`/api/v1/households/${id}/recipient-context`, {
      cache: "no-store",
    });
    return response.status;
  }, householdId);
  expect(fullAfterBinding).toBe(404);

  await subject.getByLabel(/Người nhận.*Recipient/).selectOption({ index: 1 });
  await subject.getByLabel(/Nhãn cơ bản.*Basic recipient label/).check();
  await subject.getByLabel(/Nhãn quan hệ.*Relationship label/).check();
  await subject.getByRole("button", { name: /Review grant/ }).click();
  await subject.getByRole("button", { name: /Confirm grant/ }).click();
  await expect(subject.locator(".status-panel")).toContainText("server confirmed");

  const allowed = await governed(member, householdId, "recipient_context.relationship_label");
  expect(allowed.status).toBe(200);
  expect(allowed.body.data.value).toBe("Runtime Relationship Beta");

  await subject.getByRole("button", { name: /Thu hẹp.*Narrow/ }).click();
  await subject.getByRole("button", { name: /Confirm narrow/ }).click();
  await expect(subject.locator(".status-panel")).toContainText("server confirmed");
  expect((await governed(member, householdId, "recipient_context.relationship_label")).status).toBe(
    404,
  );
  expect((await governed(member, householdId, "recipient_context.basic_label")).status).toBe(200);

  await subject.getByRole("button", { name: /Thu hồi.*Revoke/ }).click();
  await subject.getByRole("button", { name: /Confirm revoke/ }).click();
  await expect(subject.locator(".status-panel")).toContainText("server confirmed");
  expect((await governed(member, householdId, "recipient_context.basic_label")).status).toBe(404);

  await subject.goto(`/households/${householdId}/audit`);
  await expect(subject.getByRole("heading", { name: /Consent revoked/ })).toBeVisible();
  await expect(subject.getByText(/Some fields are hidden/)).toBeVisible();
  const body = await subject.locator("body").innerText();
  expect(body).not.toContain("Runtime Recipient Alpha");
  expect(body).not.toContain("Runtime Relationship Beta");
  expect(await persistedBrowserState(subject)).not.toContain(token);
  expect(await persistedBrowserState(member)).not.toContain(token);

  await subjectContext.close();
  await memberContext.close();
});

async function governed(page: Page, householdId: string, scope: string) {
  return page.evaluate(
    async ({ id, requestedScope }) => {
      const response = await fetch(
        `/api/v1/households/${id}/recipient-context/scopes/${requestedScope}`,
        { cache: "no-store" },
      );
      return {
        status: response.status,
        body: (await response.json()) as { data: { value?: string } },
      };
    },
    { id: householdId, requestedScope: scope },
  );
}

async function registerAndSignIn(page: Page, loginName: string, password: string) {
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
