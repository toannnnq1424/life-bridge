import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

import { generateTotp } from "../../services/identity-consent/src/crypto.js";

test.skip(
  process.env.P3_S1_REAL_RUNTIME !== "1",
  "requires the built P3-S1 runtime and PostgreSQL",
);
test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test("real P3-S1 path proves governed timeline, atomic handoff and safe notification", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("PLAYWRIGHT_BASE_URL is required");
  const careUrl = required("CARE_DATABASE_URL");
  const notificationUrl = required("NOTIFICATION_DATABASE_URL");
  const care = new Pool({ connectionString: careUrl, max: 2 });
  const notification = new Pool({ connectionString: notificationUrl, max: 1 });
  const subjectContext = await browser.newContext({ baseURL });
  const memberContext = await browser.newContext({ baseURL });
  const subject = await subjectContext.newPage();
  const member = await memberContext.newPage();
  const suffix = `${process.pid}${Date.now().toString().slice(-6)}`;
  const taskId = `task_p3_runtime_${suffix}`;

  try {
    await registerAndSignIn(
      subject,
      `p3s1.subject.${suffix}`,
      "P3-S1 subject synthetic passphrase",
    );
    await registerAndSignIn(member, `p3s1.member.${suffix}`, "P3-S1 member synthetic passphrase");

    await subject.goto("/households/new");
    await selectEnglish(subject);
    await subject.locator('input[name="displayLabel"]').fill("P3-S1 synthetic household");
    await subject.locator('button[type="submit"]').click();
    const invitationPath = await subject.locator('a[href$="/invitations"]').getAttribute("href");
    expect(invitationPath).toBeTruthy();
    const householdId = invitationPath!.split("/")[2]!;

    await subject.goto(invitationPath!);
    await selectEnglish(subject);
    await subject.locator('input[name="inviteeLoginName"]').fill(`p3s1.member.${suffix}`);
    const invitationResponse = subject.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/households/${householdId}/invitations`) &&
        response.request().method() === "POST",
    );
    await subject.locator('button[type="submit"]').click();
    const invitationToken = (
      (await (await invitationResponse).json()) as { data: { invitationToken: string } }
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
    await expect(subject.locator(".status-panel")).toContainText("saved atomically");

    await subject.goto(`/households/${householdId}/consent`);
    await subject.getByLabel(/Recipient/).selectOption({ index: 1 });
    await subject.getByLabel(/Basic recipient label/).check();
    await subject.getByRole("button", { name: /Review grant/ }).click();
    await subject.getByRole("button", { name: /Confirm grant/ }).click();
    await expect(subject.locator(".status-panel")).toContainText("server confirmed");

    const subjectSession = await session(subject);
    const memberSession = await session(member);
    const recipientContext = await subject.evaluate(async (id) => {
      const response = await fetch(`/api/v1/households/${id}/recipient-context`);
      if (!response.ok) throw new Error(`RECIPIENT_CONTEXT_${response.status}`);
      return (await response.json()) as {
        data: { recipientContextId: string };
      };
    }, householdId);
    const now = new Date();
    await care.query(
      `INSERT INTO care_tasks (
         task_id, household_id, care_recipient_id, title, description,
         assignee_id, created_by, due_at, due_time_zone, priority,
         status, version, created_at
       ) VALUES ($1,$2,$3,'Synthetic morning task','',$4,$5,$6,
                 'America/New_York','normal','open',1,$7)`,
      [
        taskId,
        householdId,
        recipientContext.data.recipientContextId,
        memberSession.accountId,
        subjectSession.accountId,
        new Date(now.getTime() + 60 * 60_000),
        now,
      ],
    );

    await member.goto(`/households/${householdId}/tasks/${taskId}`);
    await selectEnglish(member);
    await expect(member.getByRole("heading", { name: "Synthetic morning task" })).toBeVisible();
    const review = await member.evaluate(
      async ({ id, task }) => {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const response = await fetch(
          `/api/v1/households/${id}/tasks/${task}/handoff?displayTimeZone=${encodeURIComponent(zone)}`,
        );
        if (!response.ok) throw new Error(`HANDOFF_REVIEW_${response.status}`);
        return (await response.json()) as {
          data: { currentActor: { actorRef: string } };
        };
      },
      { id: householdId, task: taskId },
    );
    const eventRef = `timeline_p3_runtime_${suffix}`;
    await care.query(
      `INSERT INTO care_timeline_events (
         event_ref, household_id, recipient_context_id, task_id, task_version,
         event_kind, actor_id, actor_ref, occurred_at, recorded_at
       ) VALUES ($1,$2,$3,$4,1,'task_created',$5,$6,$7,$7)`,
      [
        eventRef,
        householdId,
        recipientContext.data.recipientContextId,
        taskId,
        memberSession.accountId,
        review.data.currentActor.actorRef,
        now,
      ],
    );

    await member.goto(`/households/${householdId}/timeline`);
    await selectEnglish(member);
    await expect(member.getByRole("link", { name: "Synthetic morning task" })).toBeVisible();
    await expect(member.locator("ol.timeline-list > li")).toHaveCount(1);

    await member.goto(`/households/${householdId}/tasks/${taskId}`);
    await selectEnglish(member);
    await member.getByLabel("Proposed person").selectOption({ index: 1 });
    await member.getByLabel("Structured reason").selectOption("coverage_update");
    await member.getByRole("button", { name: "Review handoff" }).click();
    await expect(member.getByRole("heading", { name: "Check before confirmation" })).toBeFocused();
    await member.getByRole("button", { name: "Confirm handoff" }).click();
    await expect(member.getByRole("heading", { name: "Handoff confirmed" })).toBeFocused();
    await expect(member.getByText("Pending separate delivery")).toBeVisible();

    const durable = await care.query<{
      assigneeId: string;
      version: number;
      timelineCount: number;
      handoffCount: number;
      auditCount: number;
      outboxCount: number;
    }>(
      `SELECT
         (SELECT assignee_id FROM care_tasks WHERE task_id = $1) AS "assigneeId",
         (SELECT version FROM care_tasks WHERE task_id = $1) AS version,
         (SELECT COUNT(*)::int FROM care_timeline_events WHERE task_id = $1)
           AS "timelineCount",
         (SELECT COUNT(*)::int FROM care_task_handoffs WHERE task_id = $1)
           AS "handoffCount",
         (SELECT COUNT(*)::int FROM care_audit
          WHERE resource_type = 'care_task' AND resource_id = $1 AND action = 'task.handoff')
           AS "auditCount",
         (SELECT COUNT(*)::int FROM care_outbox
          WHERE aggregate_id = $1 AND event_type = 'care.task.handed_off.v1')
           AS "outboxCount"`,
      [taskId],
    );
    expect(durable.rows[0]).toEqual({
      assigneeId: subjectSession.accountId,
      version: 2,
      timelineCount: 2,
      handoffCount: 1,
      auditCount: 1,
      outboxCount: 1,
    });

    const delivered = await pollNotification(notification, taskId);
    expect(delivered.messageKey).toBe("notifications.task.handed_off");
    expect(delivered.messageParams).toEqual({ taskId });
    expect(JSON.stringify(delivered)).not.toContain("Synthetic morning task");
    expect(JSON.stringify(delivered)).not.toContain("coverage_update");

    await member.goto(`/households/${householdId}/timeline`);
    await selectEnglish(member);
    await expect(member.locator("ol.timeline-list > li")).toHaveCount(2);
    await expect(
      member.locator("ol.timeline-list").getByText("Handoff", { exact: true }),
    ).toBeVisible();
    expect(await browserPersistence(member)).not.toContain(invitationToken);
  } finally {
    await cleanupTask(care, notification, taskId);
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
  await page.getByLabel(/Ngôn ngữ|Language/).selectOption("en");
}

async function session(page: Page): Promise<{ accountId: string }> {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/account/session");
    if (!response.ok) throw new Error(`SESSION_${response.status}`);
    const body = (await response.json()) as { data: { accountId: string } };
    return body.data;
  });
}

async function pollNotification(
  pool: Pool,
  taskId: string,
): Promise<{ messageKey: string; messageParams: { taskId: string } }> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await pool.query<{
      messageKey: string;
      messageParams: { taskId: string };
    }>(
      `SELECT message_key AS "messageKey", message_params AS "messageParams"
       FROM notifications
       WHERE source_task_id = $1`,
      [taskId],
    );
    if (result.rows[0]) return result.rows[0];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("P3_S1_NOTIFICATION_NOT_DELIVERED");
}

async function cleanupTask(care: Pool, notification: Pool, taskId: string) {
  const events = await care.query<{ eventId: string }>(
    `SELECT event_id AS "eventId" FROM care_outbox WHERE aggregate_id = $1`,
    [taskId],
  );
  const ids = events.rows.map((row) => row.eventId);
  await notification.query(`DELETE FROM notifications WHERE source_task_id = $1`, [taskId]);
  if (ids.length > 0) {
    await notification.query(
      `DELETE FROM notification_inbox WHERE source_event_id = ANY($1::text[])`,
      [ids],
    );
  }
  await care.query(
    `DELETE FROM care_idempotency
     WHERE operation = 'task.handoff' AND response_body->>'taskId' = $1`,
    [taskId],
  );
  await care.query("DELETE FROM care_task_handoffs WHERE task_id = $1", [taskId]);
  await care.query("DELETE FROM care_timeline_events WHERE task_id = $1", [taskId]);
  await care.query("DELETE FROM care_outbox WHERE aggregate_id = $1", [taskId]);
  await care.query(
    `DELETE FROM care_audit
     WHERE resource_type = 'care_task' AND resource_id = $1`,
    [taskId],
  );
  await care.query("DELETE FROM care_tasks WHERE task_id = $1", [taskId]);
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
