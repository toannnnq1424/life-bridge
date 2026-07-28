import { createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P4_S3_REAL_RUNTIME !== "1",
  "requires the built P4-S3 runtime and PostgreSQL",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

test("real P4-S3 path proves fresh authority, owner bytes, attachment retrieval, active purge and no browser persistence", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const care = new Pool({ connectionString: required("CARE_DATABASE_URL"), max: 2 });
  const identity = new Pool({ connectionString: required("IDENTITY_DATABASE_URL"), max: 1 });
  const context = await browser.newContext({ baseURL, acceptDownloads: true });
  const page = await context.newPage();
  const suffix = `${process.pid}${Date.now().toString().slice(-6)}`;
  let vaultId = "";
  let householdId = "";
  const content = Buffer.from("Synthetic P4-S3 runtime document\n", "utf8");

  try {
    await registerAndSignIn(page, `p4s3.subject.${suffix}`, "P4-S3 subject synthetic passphrase");
    await page.goto("/households/new");
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("P4-S3 synthetic household");
    await page.locator('button[type="submit"]').click();
    const invitationPath = await page.locator('a[href$="/invitations"]').getAttribute("href");
    expect(invitationPath).toBeTruthy();
    householdId = invitationPath!.split("/")[2]!;

    await page.goto(`/households/${householdId}/recipient-context`);
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("Synthetic P4-S3 recipient");
    await page.locator('input[name="relationshipLabel"]').fill("Synthetic P4-S3 relationship");
    await page.locator('form.account-card button[type="submit"]').click();
    await page.goto(`/households/${householdId}/consent`);
    await page.getByRole("button", { name: /Review self authority/ }).click();
    await page.getByRole("button", { name: /Confirm$/ }).click();
    await expect(page.locator(".status-panel")).toContainText("Self authority confirmed");

    await page.goto(`/households/${householdId}/documents`);
    await page.locator(".document-vault-header select").selectOption("en");
    await expect(page.getByText(/No documents are currently available/)).toBeVisible();
    await page.getByLabel("Text document").setInputFiles({
      name: "synthetic-runtime.txt",
      mimeType: "text/plain",
      buffer: content,
    });
    await page.getByRole("button", { name: "Upload for validation" }).click();
    await expect(page.getByRole("heading", { name: /Upload confirmed/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "synthetic-runtime.txt" })).toBeVisible();
    await expect(page.getByText("ready_unscanned")).toBeVisible();
    await expect(page.getByText(/Malware scanner: not configured/).first()).toBeVisible();

    const stored = await care.query<{
      vaultId: string;
      objectBytes: Buffer;
      digest: string;
      binding: string;
      processingState: string;
      scannerStatus: string;
      malwareStatus: string;
      outboxPayloads: unknown[];
    }>(
      `SELECT
         v.vault_id AS "vaultId",
         b.object_bytes AS "objectBytes",
         b.sha256_digest AS digest,
         b.binding_digest AS binding,
         d.processing_state AS "processingState",
         d.scanner_status AS "scannerStatus",
         d.malware_status AS "malwareStatus",
         (
           SELECT jsonb_agg(payload ORDER BY event_id)
           FROM care_outbox WHERE aggregate_id=v.vault_id
         ) AS "outboxPayloads"
       FROM care_document_vaults v
       JOIN care_documents d USING(vault_id)
       JOIN care_document_blobs b USING(document_id)
       WHERE v.household_id=$1`,
      [householdId],
    );
    expect(stored.rows).toHaveLength(1);
    vaultId = stored.rows[0]!.vaultId;
    expect(stored.rows[0]!.objectBytes.equals(content)).toBe(true);
    expect(stored.rows[0]).toMatchObject({
      digest: createHash("sha256").update(content).digest("hex"),
      processingState: "ready_unscanned",
      scannerStatus: "not_configured",
      malwareStatus: "not_scanned",
    });
    expect(stored.rows[0]!.binding).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored.rows[0]!.outboxPayloads)).not.toMatch(
      /Synthetic|runtime|text\/plain|sha256|object_/i,
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download attachment" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("synthetic-runtime.txt");
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const downloadedChunks: Buffer[] = [];
    for await (const chunk of stream!) downloadedChunks.push(Buffer.from(chunk));
    expect(Buffer.concat(downloadedChunks).equals(content)).toBe(true);
    await expect(
      page.getByRole("heading", { name: /attachment response was issued/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Review deletion" }).click();
    await page.getByRole("button", { name: "Delete active copy" }).click();
    await expect(page.getByRole("heading", { name: /Deletion confirmed/ })).toBeFocused();
    const deleted = await care.query<{
      documents: number;
      blobs: number;
      tombstones: number;
      fileNamesInEvidence: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM care_documents WHERE vault_id=$1) AS documents,
         (SELECT COUNT(*)::int FROM care_document_blobs WHERE vault_id=$1) AS blobs,
         (SELECT COUNT(*)::int FROM care_document_tombstones WHERE vault_id=$1) AS tombstones,
         (
           SELECT COUNT(*)::int FROM care_outbox
           WHERE aggregate_id=$1 AND payload::text ILIKE '%synthetic-runtime%'
         ) AS "fileNamesInEvidence"`,
      [vaultId],
    );
    expect(deleted.rows[0]).toEqual({
      documents: 0,
      blobs: 0,
      tombstones: 1,
      fileNamesInEvidence: 0,
    });

    const decisions = await identity.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM identity_consent_audit
       WHERE category='recipient_context.access_allowed'
         AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'`,
    );
    expect(decisions.rows[0]!.count).toBeGreaterThanOrEqual(4);
    expect(await browserPersistence(page)).not.toMatch(
      /synthetic-runtime|Synthetic P4-S3 runtime document|document_/,
    );
  } finally {
    await context.close();
    await cleanup(care, vaultId, householdId);
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

async function cleanup(care: Pool, vaultId: string, householdId: string) {
  if (!vaultId) return;
  const actors = await care.query<{ actorId: string }>(
    `SELECT DISTINCT actor_id AS "actorId" FROM care_audit
     WHERE household_id=$1 AND resource_type='document_vault'`,
    [householdId],
  );
  await care.query("DELETE FROM care_document_tombstones WHERE vault_id=$1", [vaultId]);
  await care.query("DELETE FROM care_document_transitions WHERE vault_id=$1", [vaultId]);
  await care.query("DELETE FROM care_outbox WHERE aggregate_id=$1", [vaultId]);
  await care.query(
    "DELETE FROM care_audit WHERE household_id=$1 AND resource_type='document_vault'",
    [householdId],
  );
  for (const actor of actors.rows) {
    await care.query(
      "DELETE FROM care_idempotency WHERE actor_id=$1 AND operation LIKE 'document.vault.%'",
      [actor.actorId],
    );
  }
  await care.query("DELETE FROM care_document_vaults WHERE vault_id=$1", [vaultId]);
}

async function browserPersistence(page: Page) {
  return page.evaluate(() =>
    JSON.stringify({
      url: location.href,
      history: history.state,
      local: { ...localStorage },
      session: { ...sessionStorage },
      caches: "caches" in window,
    }),
  );
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
