import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);

interface Failure {
  code: string;
  messageKey?: string;
  retryable?: boolean;
  currentAppointment?: SyntheticAppointment;
  conflict?: { startsAtUtc: string; endsAtUtc: string };
  recoveryAction?: string;
}

interface SyntheticAppointment extends Record<string, unknown> {
  seriesId: string;
  logistics: string;
  status: string;
  lastChange: string;
  reminderIntent: string;
  version: number;
  cancelledAt: string | null;
  updatedAt: string;
  confirmedAt: string;
}

interface SyntheticApi {
  mode: "items" | "empty" | "denied" | "unavailable";
  mutationFailure: "conflict" | "stale" | "uncertain" | null;
  mutations: string[];
  keys: string[];
  appointment: ReturnType<typeof appointment>;
}

async function syntheticApi(page: Page): Promise<SyntheticApi> {
  const state: SyntheticApi = {
    mode: "items",
    mutationFailure: null,
    mutations: [],
    keys: [],
    appointment: appointment(),
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/api/v1/account/session") {
      return json(route, 200, {
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
          idleExpiresAt: "2026-11-01T07:00:00.000Z",
          absoluteExpiresAt: "2026-11-01T18:00:00.000Z",
        },
      });
    }
    if (path.endsWith("/calendar")) {
      if (state.mode === "denied") return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
      if (state.mode === "unavailable") return failure(route, 503, "SERVICE_UNAVAILABLE");
      const localDate = url.searchParams.get("localDate") ?? "2026-11-01";
      return json(route, 200, {
        localDate,
        displayTimeZone: "America/New_York",
        dayStartUtc: "2026-11-01T04:00:00.000Z",
        dayEndUtc: "2026-11-02T05:00:00.000Z",
        filter: url.searchParams.get("status") ?? "all",
        coverageStartedAt: "2026-07-27T00:00:00.000Z",
        coverage: "complete",
        items: state.mode === "empty" ? [] : [state.appointment],
        snapshotAt: "2026-11-01T12:00:00.000Z",
      });
    }
    if (path.includes("/appointments/") && request.method() === "GET") {
      if (state.mode === "denied") return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
      return json(route, 200, state.appointment);
    }
    if (
      path.endsWith("/appointments") ||
      (path.includes("/appointments/") && ["PATCH", "POST"].includes(request.method()))
    ) {
      state.mutations.push(`${request.method()} ${path}`);
      state.keys.push(request.headers()["idempotency-key"] ?? "");
      if (request.headers()["x-csrf-token"] !== csrf) {
        return failure(route, 403, "CSRF_REJECTED");
      }
      if (state.mutationFailure) {
        const next = state.mutationFailure;
        state.mutationFailure = null;
        if (next === "uncertain") return failure(route, 503, "SERVICE_UNAVAILABLE");
        if (next === "stale") {
          state.appointment = { ...state.appointment, version: state.appointment.version + 1 };
          return json(route, 409, undefined, {
            code: "APPOINTMENT_VERSION_CONFLICT",
            messageKey: "appointment.version_conflict",
            retryable: false,
            currentAppointment: state.appointment,
            recoveryAction: "reload_current",
          });
        }
        return json(route, 409, undefined, {
          code: "APPOINTMENT_TIME_CONFLICT",
          messageKey: "appointment.time_conflict",
          retryable: false,
          conflict: {
            startsAtUtc: "2026-11-01T07:00:00.000Z",
            endsAtUtc: "2026-11-01T08:00:00.000Z",
          },
          recoveryAction: "choose_another_time",
        });
      }
      if (path.endsWith("/cancel")) {
        state.appointment = {
          ...state.appointment,
          status: "cancelled",
          lastChange: "cancelled",
          reminderIntent: "cancelled",
          version: state.appointment.version + 1,
          cancelledAt: "2026-11-01T12:05:00.000Z",
          updatedAt: "2026-11-01T12:05:00.000Z",
          confirmedAt: "2026-11-01T12:05:00.000Z",
        };
        return json(route, 200, state.appointment);
      }
      if (request.method() === "PATCH") {
        state.appointment = {
          ...state.appointment,
          logistics: "phone",
          lastChange: "changed",
          version: state.appointment.version + 1,
          updatedAt: "2026-11-01T12:04:00.000Z",
          confirmedAt: "2026-11-01T12:04:00.000Z",
        };
        return json(route, 200, state.appointment);
      }
      return json(route, 201, {
        seriesId: state.appointment.seriesId,
        appointments: [state.appointment],
      });
    }
    return failure(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
  });
  return state;
}

test("LB-015 exposes explicit 25-hour boundary and a fact-complete keyboard agenda", async ({
  page,
}) => {
  await syntheticApi(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/households/household_synthetic/calendar");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.locator('input[type="date"]').fill("2026-11-01");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Appointment calendar");
  await expect(page.getByText("2026-11-01T04:00:00.000Z")).toBeVisible();
  await expect(page.getByText("2026-11-02T05:00:00.000Z")).toBeVisible();
  const agenda = page.locator("ol.appointment-agenda > li");
  await expect(agenda).toHaveCount(1);
  for (const fact of [
    "2026-11-01T06:30:00.000Z",
    "2026-11-01T01:30",
    "-05:00",
    "America/New_York",
    "This occurrence only",
    "Intent receipt only",
  ]) {
    await expect(agenda).toContainText(fact);
  }
  await page.getByRole("gridcell").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Complete agenda" })).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-015 distinguishes empty, denial, unavailable, and offline without fabricating", async ({
  context,
  page,
}) => {
  const api = await syntheticApi(page);
  api.mode = "empty";
  await page.goto("/households/household_synthetic/calendar");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.getByRole("heading", { name: /No confirmed appointments/ })).toBeVisible();
  api.mode = "denied";
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.getByRole("heading", { name: "This content cannot be opened" })).toBeVisible();
  api.mode = "unavailable";
  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page.getByRole("heading", { name: "The service is unavailable" })).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("heading", { name: /You are offline/ })).toBeVisible();
  expect(api.mutations).toEqual([]);
  await context.setOffline(false);
});

test("LB-016 creates with explicit review and reports durable truth separately from reminder delivery", async ({
  page,
}) => {
  const api = await syntheticApi(page);
  await page.goto("/households/household_synthetic/appointments/new");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByLabel("Appointment kind").selectOption("transport");
  await page.getByLabel("Logistics mode").selectOption("in_person");
  await page.getByLabel("Source local date and time").fill("2026-11-01T01:30");
  await page.getByLabel("Source IANA time zone").fill("America/New_York");
  await page.getByLabel("Source UTC offset").fill("-05:00");
  await page.getByLabel("Later instant").check();
  await page.getByLabel("Reminder lead").selectOption("60");
  await page.getByRole("button", { name: "Review before sending" }).click();
  await expect(page.getByRole("heading", { name: "Check the unsent intent" })).toBeFocused();
  await expect(page.getByText(/server validates IANA\/DST/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm create" }).click();
  await expect(page.getByRole("heading", { name: "Appointment confirmed" })).toBeFocused();
  await expect(
    page
      .getByRole("heading", { name: "Appointment confirmed" })
      .locator("..")
      .getByText(/notification delivery is not claimed/)
      .last(),
  ).toBeVisible();
  expect(api.mutations).toEqual(["POST /api/v1/households/household_synthetic/appointments"]);
  expect(api.keys[0]).toMatch(/^p3s2_/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-016 preserves unsent intent on stale/conflict, blocks blind retry, and confirms cancellation", async ({
  page,
}) => {
  const api = await syntheticApi(page);
  await page.goto("/appointments/appointment_synthetic?householdId=household_synthetic");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  api.mutationFailure = "stale";
  await page.getByLabel("Logistics mode").selectOption("phone");
  await page.getByRole("button", { name: "Review before sending" }).click();
  await page.getByRole("button", { name: "Confirm change" }).click();
  await expect(page.getByRole("heading", { name: "The appointment changed" })).toBeFocused();
  await expect(page.getByText(/choices remain unsent/)).toBeVisible();
  expect(api.mutations).toHaveLength(1);
  await page.getByRole("button", { name: "Load current state" }).click();
  await page.getByRole("button", { name: "Review cancellation" }).click();
  await expect(page.getByRole("heading", { name: /Check before cancelling/ })).toBeFocused();
  await page.getByRole("button", { name: "Confirm cancellation" }).click();
  await expect(page.getByRole("heading", { name: "Cancellation confirmed" })).toBeFocused();
  await expect(page.getByText("Cancelled").first()).toBeVisible();
  expect(api.mutations).toHaveLength(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-016 uncertain mutation offers state check and never retries automatically", async ({
  page,
}) => {
  const api = await syntheticApi(page);
  api.mutationFailure = "uncertain";
  await page.goto("/households/household_synthetic/appointments/new");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByRole("button", { name: "Review before sending" }).click();
  await page.getByRole("button", { name: "Confirm create" }).click();
  await expect(
    page.getByRole("heading", { name: "The request result is uncertain" }),
  ).toBeFocused();
  expect(api.mutations).toHaveLength(1);
  await page.waitForTimeout(100);
  expect(api.mutations).toHaveLength(1);
});

function appointment(): SyntheticAppointment {
  return {
    appointmentId: "appointment_synthetic",
    seriesId: "series_synthetic",
    householdId: "household_synthetic",
    recipientContextId: "recipient_synthetic",
    kind: "transport",
    logistics: "in_person",
    status: "scheduled",
    lastChange: "created",
    startsAtUtc: "2026-11-01T06:30:00.000Z",
    endsAtUtc: "2026-11-01T07:30:00.000Z",
    sourceLocalStart: "2026-11-01T01:30",
    sourceUtcOffset: "-05:00",
    sourceTimeZone: "America/New_York",
    durationMinutes: 60,
    occurrenceNumber: 1,
    occurrenceCount: 4,
    recurrenceFrequency: "weekly",
    recurrenceIntervalWeeks: 1,
    recurrenceFinalLocalDate: "2026-11-22",
    mutationScope: "occurrence_only",
    reminderIntent: "recorded",
    reminderLeadMinutes: 60,
    version: 1,
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
    cancelledAt: null,
    confirmedAt: "2026-11-01T12:00:00.000Z",
  };
}

async function json(
  route: Route,
  status: number,
  data?: unknown,
  error?: Failure & { messageKey: string; retryable: boolean },
) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(
      error ? { error } : { data, meta: { correlationId: "corr_browser_p3s2" } },
    ),
  });
}

function failure(route: Route, status: number, code: string) {
  return json(route, status, undefined, {
    code,
    messageKey: "errors.synthetic",
    retryable: status >= 500,
  });
}
