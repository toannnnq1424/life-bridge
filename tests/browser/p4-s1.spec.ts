import { AxeBuilder } from "@axe-core/playwright";
import type {
  MedicationReminderNotificationProjection,
  MedicationReminderProjection,
} from "../../packages/contracts/src/index.js";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);

interface SyntheticApi {
  mode: "items" | "empty" | "denied" | "unavailable";
  mutationFailure: "conflict" | "uncertain" | null;
  reminder: MedicationReminderProjection;
  notifications: MedicationReminderNotificationProjection[];
  mutations: Array<{ method: string; path: string; body: Record<string, unknown> }>;
  acknowledgeDuplicate: boolean;
}

async function syntheticApi(page: Page): Promise<SyntheticApi> {
  const state: SyntheticApi = {
    mode: "items",
    mutationFailure: null,
    reminder: reminder(),
    notifications: notifications(),
    mutations: [],
    acknowledgeDuplicate: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/v1/account/session") return json(route, 200, session());
    if (
      path.includes("/households/") &&
      path.endsWith("/medication-reminders") &&
      request.method() === "GET"
    ) {
      if (state.mode === "denied") return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
      if (state.mode === "unavailable") return failure(route, 503, "SERVICE_UNAVAILABLE");
      return json(route, 200, {
        items: state.mode === "empty" ? [] : [state.reminder],
        snapshotAt: "2026-08-03T01:00:00.000Z",
      });
    }
    if (
      path.includes("/households/") &&
      path.includes("/medication-reminders/") &&
      request.method() === "GET"
    ) {
      if (state.mode === "denied") return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
      return json(route, 200, state.reminder);
    }
    if (
      path.includes("/households/") &&
      path.includes("/medication-reminders") &&
      ["POST", "PUT"].includes(request.method())
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.mutations.push({ method: request.method(), path, body });
      if (request.headers()["x-csrf-token"] !== csrf) {
        return failure(route, 403, "CSRF_REJECTED");
      }
      if (state.mutationFailure) {
        const failureMode = state.mutationFailure;
        state.mutationFailure = null;
        return failure(
          route,
          failureMode === "conflict" ? 409 : 503,
          failureMode === "conflict"
            ? "MEDICATION_REMINDER_VERSION_CONFLICT"
            : "SERVICE_UNAVAILABLE",
        );
      }
      if (path.endsWith("/disable")) {
        state.reminder = {
          ...state.reminder,
          status: "disabled",
          version: state.reminder.version + 1,
          disabledAt: "2026-08-03T01:05:00.000Z",
          updatedAt: "2026-08-03T01:05:00.000Z",
          confirmedAt: "2026-08-03T01:05:00.000Z",
          occurrences: state.reminder.occurrences.map((item) => ({
            ...item,
            state: "disabled",
            notificationIntent: "cancelled",
          })),
        };
        return json(route, 200, state.reminder);
      }
      state.reminder = {
        ...state.reminder,
        ...(body.medicationLabel ? { medicationLabel: String(body.medicationLabel) } : {}),
      };
      return json(route, request.method() === "POST" ? 201 : 200, state.reminder);
    }
    if (path === "/api/v1/notifications/medication-reminders" && request.method() === "GET") {
      if (state.mode === "denied") return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
      if (state.mode === "unavailable") {
        return failure(route, 503, "MEDICATION_NOTIFICATION_UNAVAILABLE");
      }
      return json(route, 200, {
        items: state.mode === "empty" ? [] : state.notifications,
        snapshotAt: "2026-08-03T01:05:00.000Z",
      });
    }
    if (path.endsWith("/acknowledgements") && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.mutations.push({ method: request.method(), path, body });
      const occurrenceId = path.split("/").at(-2)!;
      const index = state.notifications.findIndex((item) => item.occurrenceId === occurrenceId);
      const current = state.notifications[index]!;
      const updated = {
        ...current,
        acknowledgementState: "seen" as const,
        acknowledgedAt: "2026-08-03T01:06:00.000Z",
        version: current.version + 1,
      };
      state.notifications[index] = updated;
      return json(route, 200, {
        result: state.acknowledgeDuplicate ? "duplicate" : "recorded",
        notification: updated,
      });
    }
    return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
  });
  return state;
}

test("LB-018 reviews explicit user facts and does not infer clinical content", async ({ page }) => {
  const api = await syntheticApi(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/households/household_synthetic/medication-reminders");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByLabel("Medication name you enter").fill("Synthetic reminder B");
  await page.getByLabel("Quantity you enter").fill("0.125");
  await page.getByLabel("Explicit unit").selectOption("millilitre");
  await page.getByLabel("Local date and time").fill("2026-11-01T01:30");
  await page.getByLabel("IANA time zone").fill("America/New_York");
  await page.getByLabel("UTC offset at that time").fill("-05:00");
  await page.getByLabel("Local-time interpretation").selectOption("later");
  await page.getByLabel("Recurrence").selectOption("weekly");
  await page.getByLabel("Interval").fill("1");
  await page.getByLabel("Finite occurrence count").fill("3");
  await page.getByRole("button", { name: "Review unsent schedule" }).click();
  await expect(page.getByRole("heading", { name: "Review unsent schedule" })).toBeFocused();
  await expect(page.getByText(/not medication advice/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm schedule" }).click();
  await expect(
    page.getByRole("heading", { name: "Schedule confirmed by the server" }),
  ).toBeFocused();
  expect(api.mutations).toHaveLength(1);
  expect(api.mutations[0]?.body).toEqual({
    medicationLabel: "Synthetic reminder B",
    amount: "0.125",
    unit: "millilitre",
    otherUnitLabel: null,
    schedule: {
      localStart: "2026-11-01T01:30",
      sourceTimeZone: "America/New_York",
      sourceUtcOffset: "-05:00",
      ambiguousTimePolicy: "later",
      recurrence: { frequency: "weekly", intervalWeeks: 1, occurrenceCount: 3 },
    },
    operation: "create_medication_reminder",
  });
  expect(JSON.stringify(api.mutations[0]?.body)).not.toMatch(
    /diagnosis|instruction|urgency|adherence|taken|skipped/i,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-018 distinguishes invalid, empty, denied, unavailable, offline, conflict, and uncertain", async ({
  context,
  page,
}) => {
  const api = await syntheticApi(page);
  api.mode = "empty";
  await page.goto("/households/household_synthetic/medication-reminders");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "No server-confirmed reminder schedules." }),
  ).toBeVisible();
  await page.getByLabel("Quantity you enter").fill("0");
  await page.getByRole("button", { name: "Review unsent schedule" }).click();
  await expect(page.getByRole("heading", { name: /invalid/ })).toBeFocused();
  expect(api.mutations).toHaveLength(0);

  api.mode = "denied";
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: /lacks consent-based authority/ })).toBeVisible();
  api.mode = "unavailable";
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("heading", { name: /service is unavailable/ })).toBeVisible();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("heading", { name: /You are offline/ })).toBeVisible();
  expect(api.mutations).toHaveLength(0);
  await context.setOffline(false);

  api.mode = "items";
  api.mutationFailure = "conflict";
  await page.goto("/medication-reminders/reminder_synthetic?householdId=household_synthetic");
  await expect(page.getByLabel("Language")).toBeVisible();
  await page.getByRole("button", { name: "Review unsent schedule" }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("heading", { name: /State changed/ })).toBeFocused();
  expect(api.mutations).toHaveLength(1);

  api.mutationFailure = "uncertain";
  await page.getByRole("button", { name: "Check current state" }).click();
  await page.getByRole("button", { name: "Review unsent schedule" }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("heading", { name: /outcome is unknown/ })).toBeFocused();
  await page.waitForTimeout(100);
  expect(api.mutations).toHaveLength(2);
});

test("minimum LB-019 represents delivery truth and seen-only duplicate acknowledgement", async ({
  page,
}) => {
  const api = await syntheticApi(page);
  api.acknowledgeDuplicate = true;
  await page.goto("/notifications/medication-reminders?householdId=household_synthetic");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  for (const truth of [
    "Intent recorded; there is no delivery evidence yet.",
    "The in-app notification was durably persisted.",
    "Reminder delivery failed.",
    "The scheduled time passed without confirmed delivery.",
    "Delivery outcome is uncertain",
    "The delivery intent was cancelled.",
  ]) {
    await expect(page.getByText(new RegExp(truth))).toBeVisible();
  }
  expect(await page.getByRole("button", { name: "Acknowledge as seen" }).count()).toBe(1);
  await page.getByRole("button", { name: "Acknowledge as seen" }).click();
  await expect(page.getByRole("heading", { name: /No second acknowledgement/ })).toBeFocused();
  await expect(page.getByText(/Acknowledged as seen/)).toBeVisible();
  expect(api.mutations).toHaveLength(1);
  expect(JSON.stringify(api.mutations[0])).not.toMatch(
    /medicationLabel|amount|unit|taken|skipped|adherence/i,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

function reminder(): MedicationReminderProjection {
  return {
    reminderId: "reminder_synthetic",
    householdId: "household_synthetic",
    recipientContextId: "recipient_context_synthetic",
    medicationLabel: "Synthetic reminder A",
    amount: "1",
    unit: "tablet" as const,
    otherUnitLabel: null,
    sourceLocalStart: "2026-08-03T08:00",
    sourceTimeZone: "Asia/Bangkok",
    sourceUtcOffset: "+07:00",
    ambiguousTimePolicy: null,
    recurrence: { frequency: "none" as const },
    status: "active" as const,
    version: 1,
    occurrences: [
      {
        occurrenceId: "occurrence_synthetic",
        reminderId: "reminder_synthetic",
        scheduleVersion: 1,
        occurrenceNumber: 1,
        occurrenceCount: 1,
        sourceLocalStart: "2026-08-03T08:00",
        sourceTimeZone: "Asia/Bangkok",
        sourceUtcOffset: "+07:00",
        scheduledAtUtc: "2026-08-03T01:00:00.000Z",
        recurrenceFinalLocalDate: "2026-08-03",
        state: "current" as const,
        notificationIntent: "recorded" as const,
      },
    ],
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    disabledAt: null,
    confirmedAt: "2026-08-03T00:00:00.000Z",
  };
}

function notifications(): MedicationReminderNotificationProjection[] {
  const state = (
    occurrenceId: string,
    deliveryState: "pending" | "delivered" | "failed" | "missed" | "uncertain" | "cancelled",
  ) => ({
    notificationId: deliveryState === "delivered" ? `notification_${occurrenceId}` : null,
    reminderId: `reminder_${occurrenceId}`,
    occurrenceId,
    sourceLocalStart: "2026-08-03T08:00",
    sourceTimeZone: "Asia/Bangkok",
    sourceUtcOffset: "+07:00",
    scheduledAtUtc: "2026-08-03T01:00:00.000Z",
    messageKey: "notifications.medication_reminder.generic" as const,
    intentState: deliveryState === "cancelled" ? ("cancelled" as const) : ("pending" as const),
    deliveryState,
    deliveryEvidence:
      deliveryState === "delivered" ? ("in_app_persisted" as const) : ("none" as const),
    attemptCount: deliveryState === "pending" || deliveryState === "cancelled" ? 0 : 1,
    deliveredAt: deliveryState === "delivered" ? "2026-08-03T01:00:00.000Z" : null,
    failedAt: deliveryState === "failed" ? "2026-08-03T01:01:00.000Z" : null,
    missedAt: deliveryState === "missed" ? "2026-08-03T01:16:00.000Z" : null,
    acknowledgementState: "unacknowledged" as const,
    acknowledgedAt: null,
    version: deliveryState === "pending" || deliveryState === "cancelled" ? 1 : 2,
  });
  return [
    state("occurrence_pending", "pending"),
    state("occurrence_delivered", "delivered"),
    state("occurrence_failed", "failed"),
    state("occurrence_missed", "missed"),
    state("occurrence_uncertain", "uncertain"),
    state("occurrence_cancelled", "cancelled"),
  ];
}

function session() {
  return {
    accountId: "account_synthetic",
    authorizationScope: "account",
    onboardingState: "complete",
    csrfToken: csrf,
    preferences: {
      locale: "en",
      textScale: "default",
      contrast: "system",
      motion: "reduce",
      version: 1,
    },
    session: {
      idleExpiresAt: "2026-08-03T02:00:00.000Z",
      absoluteExpiresAt: "2026-08-03T12:00:00.000Z",
    },
  };
}

async function json(route: Route, status: number, data?: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ data, meta: { correlationId: "corr_browser_p4s1" } }),
  });
}

async function failure(route: Route, status: number, code: string) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code,
        messageKey: "errors.synthetic",
        retryable: status >= 500,
        correlationId: "corr_browser_p4s1",
      },
    }),
  });
}
