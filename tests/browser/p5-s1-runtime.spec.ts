import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P5_S1_REAL_RUNTIME !== "1",
  "requires the built Node/Spring/PostgreSQL P5-S1 runtime",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test("real P5-S1 path separates public search and proves fresh authority, durable lifecycle, and redacted evidence", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const community = new Pool({
    connectionString: required("P5_S1_COMMUNITY_TEST_DATABASE_URL"),
    max: 2,
  });
  const identity = new Pool({ connectionString: required("IDENTITY_DATABASE_URL"), max: 1 });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const suffix = `${process.pid}${Date.now().toString().slice(-6)}`;
  let requestId = "";
  let actorDigest = "";

  try {
    await registerAndSignIn(page, `p5s1.subject.${suffix}`, "P5-S1 subject synthetic passphrase");
    await page.goto("/households/new");
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("P5-S1 synthetic household");
    await page.locator('button[type="submit"]').click();
    const invitationPath = await page.locator('a[href$="/invitations"]').getAttribute("href");
    expect(invitationPath).toBeTruthy();
    const householdId = invitationPath!.split("/")[2]!;

    await page.goto(`/households/${householdId}/recipient-context`);
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("Synthetic P5-S1 recipient");
    await page.locator('input[name="relationshipLabel"]').fill("Synthetic P5-S1 relationship");
    await page.locator('form.account-card button[type="submit"]').click();
    await page.goto(`/households/${householdId}/consent`);
    await page.getByRole("button", { name: /Review self authority/ }).click();
    await page.getByRole("button", { name: /Confirm$/ }).click();
    await expect(page.locator(".status-panel")).toContainText("Self authority confirmed");

    const decisionsBeforePublic = await allowedDecisionCount(identity);
    await page.goto("/community");
    await page.getByLabel("Ngôn ngữ").selectOption("en");
    await expect(
      page.getByRole("heading", { name: "Public community support directory" }),
    ).toBeVisible();
    await expect(page.getByText("Synthetic community desk")).toBeVisible();
    expect(await allowedDecisionCount(identity)).toBe(decisionsBeforePublic);
    expect(await browserPersistence(page)).not.toMatch(
      new RegExp(`${householdId}|recipient_|request_|consent|actor`, "i"),
    );

    await page.goto(`/help/new?householdId=${encodeURIComponent(householdId)}`);
    await page.getByLabel("Ngôn ngữ").selectOption("en");
    await expect(page.getByText(/No authorized active request/)).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Submit bounded request" }).click();
    await expect(page.getByRole("heading", { name: /Submission confirmed/ })).toBeFocused();
    await expect(page.getByText(/does not mean queued for matching/).first()).toBeVisible();

    const stored = await community.query<{
      requestId: string;
      actorDigest: string;
      status: string;
      version: number;
      category: string;
      code: string;
      visibility: string;
    }>(
      `SELECT
         request_id AS "requestId",
         actor_ref_digest AS "actorDigest",
         status,
         version,
         category,
         province_city_code AS code,
         visibility
       FROM community_help_requests
       WHERE household_id=$1`,
      [householdId],
    );
    expect(stored.rows).toHaveLength(1);
    requestId = stored.rows[0]!.requestId;
    actorDigest = stored.rows[0]!.actorDigest;
    expect(stored.rows[0]).toMatchObject({
      status: "pending",
      version: 1,
      category: "daily_living_support",
      code: "SYN-PC-001",
      visibility: "current_request_collaborators",
    });
    const submittedEvidence = await community.query<{
      auditRows: number;
      outboxRows: number;
      outboxPayloads: unknown[];
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM community_audit WHERE aggregate_ref_digest=$2)
           AS "auditRows",
         (SELECT COUNT(*)::int FROM community_outbox WHERE aggregate_id=$1)
           AS "outboxRows",
         (SELECT jsonb_agg(payload ORDER BY event_id)
          FROM community_outbox WHERE aggregate_id=$1) AS "outboxPayloads"`,
      [requestId, createHash("sha256").update(requestId).digest("hex")],
    );
    expect(submittedEvidence.rows[0]).toMatchObject({
      auditRows: 1,
      outboxRows: 1,
    });
    expect(JSON.stringify(submittedEvidence.rows[0]!.outboxPayloads)).not.toMatch(
      /daily_living_support|SYN-PC-001|submission_|account_|household_|recipient_|diagnosis|urgency/i,
    );

    await page.getByRole("button", { name: "Close request" }).click();
    await expect(page.getByRole("heading", { name: /Closure confirmed/ })).toBeFocused();
    await page.getByRole("button", { name: "Delete active request fields" }).click();
    await expect(page.getByRole("heading", { name: /Deletion confirmed/ })).toBeFocused();

    const deleted = await community.query<{
      requests: number;
      tombstones: number;
      auditRows: number;
      outboxRows: number;
      exposedPayloads: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM community_help_requests WHERE request_id=$1) AS requests,
         (SELECT COUNT(*)::int FROM community_request_tombstones
          WHERE request_digest=$2) AS tombstones,
         (SELECT COUNT(*)::int FROM community_audit
          WHERE aggregate_ref_digest=$2) AS "auditRows",
         (SELECT COUNT(*)::int FROM community_outbox WHERE aggregate_id=$1) AS "outboxRows",
         (SELECT COUNT(*)::int FROM community_outbox
          WHERE aggregate_id=$1 AND payload::text ~*
            'daily_living_support|SYN-PC-001|submission_|account_|household_|recipient_')
           AS "exposedPayloads"`,
      [requestId, createHash("sha256").update(requestId).digest("hex")],
    );
    expect(deleted.rows[0]).toEqual({
      requests: 0,
      tombstones: 1,
      auditRows: 3,
      outboxRows: 3,
      exposedPayloads: 0,
    });
    expect((await allowedDecisionCount(identity)) - decisionsBeforePublic).toBeGreaterThanOrEqual(
      4,
    );
    expect(await browserPersistence(page)).not.toMatch(new RegExp(`submission_|${requestId}`, "i"));
  } finally {
    await context.close();
    await cleanup(community, requestId, actorDigest);
    await community.end();
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

async function allowedDecisionCount(identity: Pool) {
  const result = await identity.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM identity_consent_audit
     WHERE category='recipient_context.access_allowed'`,
  );
  return result.rows[0]!.count;
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

async function cleanup(community: Pool, requestId: string, actorDigest: string) {
  if (!requestId) return;
  const digest = createHash("sha256").update(requestId).digest("hex");
  await community.query("DELETE FROM community_idempotency WHERE actor_ref_digest=$1", [
    actorDigest,
  ]);
  await community.query("DELETE FROM community_request_tombstones WHERE request_digest=$1", [
    digest,
  ]);
  await community.query("DELETE FROM community_audit WHERE aggregate_ref_digest=$1", [digest]);
  await community.query("DELETE FROM community_outbox WHERE aggregate_id=$1", [requestId]);
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
