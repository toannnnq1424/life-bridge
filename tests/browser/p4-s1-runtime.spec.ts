import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P4_S1_REAL_RUNTIME !== "1",
  "requires the built P4-S1 runtime and PostgreSQL",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

test("real P4-S1 path proves governed schedule, generic delivery, and one seen acknowledgement", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const care = new Pool({ connectionString: required("CARE_DATABASE_URL"), max: 2 });
  const notification = new Pool({
    connectionString: required("NOTIFICATION_DATABASE_URL"),
    max: 2,
  });
  const identity = new Pool({
    connectionString: required("IDENTITY_DATABASE_URL"),
    max: 1,
  });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const suffix = `${process.pid}${Date.now().toString().slice(-6)}`;
  let reminderId = "";
  let occurrenceId = "";

  try {
    await registerAndSignIn(page, `p4s1.subject.${suffix}`, "P4-S1 subject synthetic passphrase");
    await page.goto("/households/new");
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("P4-S1 synthetic household");
    await page.locator('button[type="submit"]').click();
    const invitationPath = await page.locator('a[href$="/invitations"]').getAttribute("href");
    expect(invitationPath).toBeTruthy();
    const householdId = invitationPath!.split("/")[2]!;

    await page.goto(`/households/${householdId}/recipient-context`);
    await selectEnglish(page);
    await page.locator('input[name="displayLabel"]').fill("Synthetic P4 recipient");
    await page.locator('input[name="relationshipLabel"]').fill("Synthetic P4 relationship");
    await page.getByRole("button", { name: /Save context/ }).click();
    await page.goto(`/households/${householdId}/consent`);
    await page.getByRole("button", { name: /Review self authority/ }).click();
    await page.getByRole("button", { name: /Confirm$/ }).click();
    await expect(page.locator(".status-panel")).toContainText("Self authority confirmed");

    const localStart = bangkokMinute(new Date(Date.now() - 60_000));
    await page.goto(`/households/${householdId}/medication-reminders`);
    await page.locator(".medication-header select").selectOption("en");
    await page.getByLabel("Medication name you enter").fill("Synthetic schedule item");
    await page.getByLabel("Quantity you enter").fill("0.125");
    await page.getByLabel("Explicit unit").selectOption("millilitre");
    await page.getByLabel("Local date and time").fill(localStart);
    await page.getByLabel("IANA time zone").fill("Asia/Bangkok");
    await page.getByLabel("UTC offset at that time").fill("+07:00");
    await page.getByRole("button", { name: "Review unsent schedule" }).click();
    await expect(page.getByRole("heading", { name: "Review unsent schedule" })).toBeFocused();
    await page.getByRole("button", { name: "Confirm schedule" }).click();
    await expect(
      page.getByRole("heading", { name: "Schedule confirmed by the server" }),
    ).toBeFocused();

    const stored = await care.query<{
      reminderId: string;
      medicationLabel: string;
      amount: string;
      unit: string;
      sourceTimeZone: string;
      sourceUtcOffset: string;
      occurrenceId: string;
      outboxPayloads: unknown[];
    }>(
      `SELECT reminder.reminder_id AS "reminderId",
              reminder.medication_label AS "medicationLabel",
              reminder.amount, reminder.unit,
              reminder.source_time_zone AS "sourceTimeZone",
              reminder.source_utc_offset AS "sourceUtcOffset",
              occurrence.occurrence_id AS "occurrenceId",
              (
                SELECT jsonb_agg(payload ORDER BY event_id)
                FROM care_outbox
                WHERE aggregate_id = occurrence.occurrence_id
              ) AS "outboxPayloads"
       FROM care_medication_reminders AS reminder
       JOIN care_medication_reminder_occurrences AS occurrence
         ON occurrence.reminder_id = reminder.reminder_id
       WHERE reminder.household_id = $1`,
      [householdId],
    );
    expect(stored.rows).toHaveLength(1);
    reminderId = stored.rows[0]!.reminderId;
    occurrenceId = stored.rows[0]!.occurrenceId;
    expect(stored.rows[0]).toMatchObject({
      medicationLabel: "Synthetic schedule item",
      amount: "0.125",
      unit: "millilitre",
      sourceTimeZone: "Asia/Bangkok",
      sourceUtcOffset: "+07:00",
    });
    expect(JSON.stringify(stored.rows[0]!.outboxPayloads)).not.toMatch(
      /Synthetic schedule item|0\.125|millilitre|diagnosis|taken|skipped|adherence/i,
    );

    await pollIntent(notification, occurrenceId);
    const deliveryResponse = await fetch(
      `${required("NOTIFICATION_URL")}/internal/v1/medication-reminders/process-due`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-service-token": required("NOTIFICATION_INTERNAL_TOKEN"),
        },
        body: JSON.stringify({ mode: "deliver" }),
      },
    );
    expect(deliveryResponse.ok).toBe(true);
    const preAckVersion = await pollDelivery(notification, occurrenceId);

    await page.goto(
      `/notifications/medication-reminders?householdId=${encodeURIComponent(householdId)}`,
    );
    await page.locator(".medication-header select").selectOption("en");
    await expect(page.getByText("The in-app notification was durably persisted.")).toBeVisible();
    await page.getByRole("button", { name: "Acknowledge as seen" }).click();
    await expect(page.getByText(/Acknowledged as seen/)).toBeVisible();

    const duplicate = await page.evaluate(
      async ({ householdId: household, occurrenceId: occurrence, expectedVersion }) => {
        const sessionResponse = await fetch("/api/v1/account/session");
        const session = (await sessionResponse.json()) as { data: { csrfToken: string } };
        const response = await fetch(
          `/api/v1/notifications/medication-reminders/${encodeURIComponent(occurrence)}/acknowledgements?householdId=${encodeURIComponent(household)}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-csrf-token": session.data.csrfToken,
              "idempotency-key": `p4s1-browser-duplicate-${crypto.randomUUID()}`,
            },
            body: JSON.stringify({
              operation: "acknowledge_medication_reminder",
              expectedVersion,
            }),
          },
        );
        return { status: response.status, body: await response.json() };
      },
      { householdId, occurrenceId, expectedVersion: preAckVersion },
    );
    expect(duplicate).toMatchObject({
      status: 200,
      body: { data: { result: "duplicate" } },
    });

    const evidence = await notification.query<{
      acknowledgementState: string;
      acknowledgedAt: Date;
      audits: number;
      outbox: number;
      sensitiveMatches: number;
    }>(
      `SELECT
         notification.acknowledgement_state AS "acknowledgementState",
         notification.acknowledged_at AS "acknowledgedAt",
         (
           SELECT COUNT(*)::int FROM notification_audit
           WHERE resource_id = $1
         ) AS audits,
         (
           SELECT COUNT(*)::int FROM notification_outbox
           WHERE aggregate_id = $1
         ) AS outbox,
         (
           SELECT COUNT(*)::int FROM notification_outbox
           WHERE aggregate_id = $1
             AND payload::text ~* '(taken|skipped|adherence|dose|label|amount|unit)'
         ) AS "sensitiveMatches"
       FROM medication_reminder_notifications AS notification
       WHERE notification.occurrence_id = $1`,
      [occurrenceId],
    );
    expect(evidence.rows[0]).toMatchObject({
      acknowledgementState: "seen",
      audits: 1,
      outbox: 1,
      sensitiveMatches: 0,
    });
    expect(evidence.rows[0]!.acknowledgedAt).toBeInstanceOf(Date);

    const decisions = await identity.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM identity_consent_audit
       WHERE category = 'recipient_context.access_allowed'
         AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'`,
    );
    expect(decisions.rows[0]!.count).toBeGreaterThanOrEqual(4);
    expect(await browserPersistence(page)).not.toMatch(
      /Synthetic schedule item|0\.125|millilitre|P4-S1 subject synthetic passphrase/,
    );
  } finally {
    await cleanup(care, notification, reminderId, occurrenceId);
    await context.close();
    await care.end();
    await notification.end();
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

function bangkokMinute(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

async function pollIntent(pool: Pool, occurrenceId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await pool.query<{ state: string }>(
      `SELECT intent_state AS state
       FROM medication_reminder_intents WHERE occurrence_id = $1`,
      [occurrenceId],
    );
    if (result.rows[0]?.state === "pending") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("P4_S1_NOTIFICATION_INTENT_NOT_STORED");
}

async function pollDelivery(pool: Pool, occurrenceId: string): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await pool.query<{ state: string; version: number }>(
      `SELECT delivery_state AS state, version
       FROM medication_reminder_intents WHERE occurrence_id = $1`,
      [occurrenceId],
    );
    if (result.rows[0]?.state === "delivered") return result.rows[0].version;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("P4_S1_NOTIFICATION_DELIVERY_NOT_STORED");
}

async function cleanup(care: Pool, notification: Pool, reminderId: string, occurrenceId: string) {
  if (!reminderId || !occurrenceId) return;
  const events = await care.query<{ eventId: string }>(
    `SELECT event_id AS "eventId"
     FROM care_outbox WHERE aggregate_id = $1`,
    [occurrenceId],
  );
  const eventIds = events.rows.map((row) => row.eventId);
  await notification.query("DELETE FROM notification_outbox WHERE aggregate_id = $1", [
    occurrenceId,
  ]);
  await notification.query("DELETE FROM notification_audit WHERE resource_id = $1", [occurrenceId]);
  await notification.query(
    `DELETE FROM notification_idempotency
     WHERE response_body->'notification'->>'occurrenceId' = $1`,
    [occurrenceId],
  );
  await notification.query(
    "DELETE FROM medication_reminder_notifications WHERE occurrence_id = $1",
    [occurrenceId],
  );
  await notification.query("DELETE FROM medication_delivery_attempts WHERE occurrence_id = $1", [
    occurrenceId,
  ]);
  await notification.query("DELETE FROM medication_reminder_intents WHERE occurrence_id = $1", [
    occurrenceId,
  ]);
  if (eventIds.length > 0) {
    await notification.query(
      "DELETE FROM notification_inbox WHERE source_event_id = ANY($1::text[])",
      [eventIds],
    );
  }
  await care.query(
    `DELETE FROM care_idempotency
     WHERE response_body->>'reminderId' = $1`,
    [reminderId],
  );
  await care.query("DELETE FROM care_medication_reminder_transitions WHERE reminder_id = $1", [
    reminderId,
  ]);
  await care.query("DELETE FROM care_outbox WHERE aggregate_id = $1", [occurrenceId]);
  await care.query(
    `DELETE FROM care_audit
     WHERE resource_type = 'medication_reminder' AND resource_id = $1`,
    [reminderId],
  );
  await care.query("DELETE FROM care_medication_reminder_occurrences WHERE reminder_id = $1", [
    reminderId,
  ]);
  await care.query("DELETE FROM care_medication_reminders WHERE reminder_id = $1", [reminderId]);
}

async function browserPersistence(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify({
      url: location.href,
      history: history.state,
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  );
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}
