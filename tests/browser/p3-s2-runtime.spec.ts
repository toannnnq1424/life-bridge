import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P3_S2_REAL_RUNTIME !== "1",
  "requires the built P3-S2 runtime and PostgreSQL",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

test("real P3-S2 path proves governed create/change/cancel, agenda truth, and reminder intent", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const care = new Pool({ connectionString: required("CARE_DATABASE_URL"), max: 2 });
  const notification = new Pool({
    connectionString: required("NOTIFICATION_DATABASE_URL"),
    max: 1,
  });
  const subjectContext = await browser.newContext({ baseURL });
  const memberContext = await browser.newContext({ baseURL });
  const subject = await subjectContext.newPage();
  const member = await memberContext.newPage();
  const suffix = `${process.pid}${Date.now().toString().slice(-6)}`;
  const appointmentIds: string[] = [];

  try {
    await registerAndSignIn(
      subject,
      `p3s2.subject.${suffix}`,
      "P3-S2 subject synthetic passphrase",
    );
    await registerAndSignIn(member, `p3s2.member.${suffix}`, "P3-S2 member synthetic passphrase");

    await subject.goto("/households/new");
    await selectEnglish(subject);
    await subject.locator('input[name="displayLabel"]').fill("P3-S2 synthetic household");
    await subject.locator('button[type="submit"]').click();
    const invitationPath = await subject.locator('a[href$="/invitations"]').getAttribute("href");
    expect(invitationPath).toBeTruthy();
    const householdId = invitationPath!.split("/")[2]!;

    await subject.goto(invitationPath!);
    await selectEnglish(subject);
    await subject.locator('input[name="inviteeLoginName"]').fill(`p3s2.member.${suffix}`);
    const invitationResponse = subject.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/households/${householdId}/invitations`) &&
        response.request().method() === "POST",
    );
    await subject.locator('button[type="submit"]').click();
    const invitationToken = (
      (await (await invitationResponse).json()) as {
        data: { invitationToken: string };
      }
    ).data.invitationToken;
    await member.goto("/invitations");
    await selectEnglish(member);
    await member.locator('input[name="invitationToken"]').fill(invitationToken);
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

    await member.goto(`/households/${householdId}/appointments/new`);
    await member.locator(".appointment-header select").selectOption("en");
    await member.getByLabel("Appointment kind").selectOption("transport");
    await member.getByLabel("Logistics mode").selectOption("in_person");
    await member.getByLabel("Source local date and time").fill("2026-11-01T09:00");
    await member.getByLabel("Source IANA time zone").fill("America/New_York");
    await member.getByLabel("Source UTC offset").fill("-05:00");
    await member.getByLabel("Frequency").selectOption("weekly");
    await member.getByLabel("Week interval").fill("1");
    await member.getByLabel("Occurrences (maximum 12)").fill("2");
    await member.getByLabel("Reminder lead").selectOption("60");
    await member.getByRole("button", { name: "Review before sending" }).click();
    await member.getByRole("button", { name: "Confirm create" }).click();
    await expect(member.getByRole("heading", { name: "Appointment confirmed" })).toBeFocused();
    await expect(
      member
        .getByRole("heading", { name: "Appointment confirmed" })
        .locator("..")
        .getByText(/notification delivery is not claimed/)
        .last(),
    ).toBeVisible();

    const rows = await care.query<{ appointmentId: string }>(
      `SELECT appointment_id AS "appointmentId"
       FROM care_appointments
       WHERE household_id = $1
       ORDER BY occurrence_number`,
      [householdId],
    );
    appointmentIds.push(...rows.rows.map((row) => row.appointmentId));
    expect(appointmentIds).toHaveLength(2);

    await member.goto(
      `/appointments/${appointmentIds[0]}?householdId=${encodeURIComponent(householdId)}`,
    );
    await member.locator(".appointment-header select").selectOption("en");
    await member.getByLabel("Logistics mode").selectOption("phone");
    await member.getByRole("button", { name: "Review before sending" }).click();
    await expect(
      member.getByRole("heading", {
        name: /Check the unsent intent|Kiểm tra ý định chưa gửi/,
      }),
    ).toBeFocused();
    await member.getByRole("button", { name: /Confirm change|Xác nhận thay đổi/ }).click();
    await expect(member.getByRole("heading", { name: "Change confirmed" })).toBeFocused();

    await member.goto(
      `/appointments/${appointmentIds[0]}?householdId=${encodeURIComponent(householdId)}`,
    );
    await member.locator(".appointment-header select").selectOption("en");
    await member.getByRole("button", { name: "Review cancellation" }).click();
    await member.getByRole("button", { name: "Confirm cancellation" }).click();
    await expect(member.getByRole("heading", { name: "Cancellation confirmed" })).toBeFocused();

    const durable = await care.query<{
      status: string;
      version: number;
      transitions: number;
      audits: number;
      outbox: number;
    }>(
      `SELECT
         (SELECT status FROM care_appointments WHERE appointment_id = $1) AS status,
         (SELECT version FROM care_appointments WHERE appointment_id = $1) AS version,
         (SELECT COUNT(*)::int FROM care_appointment_transitions
          WHERE appointment_id = ANY($2::text[])) AS transitions,
         (SELECT COUNT(*)::int FROM care_audit
          WHERE resource_type = 'appointment' AND resource_id = ANY($2::text[])) AS audits,
         (SELECT COUNT(*)::int FROM care_outbox
          WHERE aggregate_id = ANY($2::text[])
            AND event_type = 'care.appointment.reminder_intent.v1') AS outbox`,
      [appointmentIds[0], appointmentIds],
    );
    expect(durable.rows[0]).toEqual({
      status: "cancelled",
      version: 3,
      transitions: 4,
      audits: 4,
      outbox: 4,
    });

    await pollReminder(notification, appointmentIds[0]!, "cancelled");
    await pollReminder(notification, appointmentIds[1]!, "scheduled");
    expect(await browserPersistence(member)).not.toContain(invitationToken);

    await member.goto(`/households/${householdId}/calendar`);
    await member.locator(".appointment-header select").selectOption("en");
    await member.locator('input[type="date"]').fill("2026-11-01");
    await expect(member.locator("ol.appointment-agenda > li")).toHaveCount(1);
    await expect(member.locator("ol.appointment-agenda")).toContainText("Cancelled");
  } finally {
    await cleanupAppointments(care, notification, appointmentIds);
    await subjectContext.close();
    await memberContext.close();
    await care.end();
    await notification.end();
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

async function pollReminder(
  pool: Pool,
  appointmentId: string,
  expected: "scheduled" | "cancelled",
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const result = await pool.query<{ intentState: string }>(
      `SELECT intent_state AS "intentState"
       FROM appointment_reminder_intents
       WHERE appointment_id = $1`,
      [appointmentId],
    );
    if (result.rows[0]?.intentState === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`P3_S2_REMINDER_${expected.toUpperCase()}_NOT_STORED`);
}

async function cleanupAppointments(care: Pool, notification: Pool, appointmentIds: string[]) {
  if (appointmentIds.length === 0) return;
  const events = await care.query<{ eventId: string }>(
    `SELECT event_id AS "eventId"
     FROM care_outbox WHERE aggregate_id = ANY($1::text[])`,
    [appointmentIds],
  );
  const eventIds = events.rows.map((row) => row.eventId);
  await notification.query(
    "DELETE FROM appointment_reminder_intents WHERE appointment_id = ANY($1::text[])",
    [appointmentIds],
  );
  if (eventIds.length > 0) {
    await notification.query(
      "DELETE FROM notification_inbox WHERE source_event_id = ANY($1::text[])",
      [eventIds],
    );
  }
  await care.query(
    `DELETE FROM care_idempotency
     WHERE operation LIKE 'appointment.%'
       AND (
         response_body->>'appointmentId' = ANY($1::text[])
         OR response_body->'appointments' @> $2::jsonb
       )`,
    [appointmentIds, JSON.stringify([{ appointmentId: appointmentIds[0] }])],
  );
  await care.query(
    "DELETE FROM care_appointment_transitions WHERE appointment_id = ANY($1::text[])",
    [appointmentIds],
  );
  await care.query("DELETE FROM care_outbox WHERE aggregate_id = ANY($1::text[])", [
    appointmentIds,
  ]);
  await care.query(
    `DELETE FROM care_audit
     WHERE resource_type = 'appointment' AND resource_id = ANY($1::text[])`,
    [appointmentIds],
  );
  await care.query("DELETE FROM care_appointments WHERE appointment_id = ANY($1::text[])", [
    appointmentIds,
  ]);
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
