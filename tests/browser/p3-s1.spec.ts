import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);

interface SyntheticP3Api {
  mutations: string[];
  handoffKeys: string[];
  timelineMode: "items" | "empty" | "denied" | "unavailable";
  continuationFailure: boolean;
  handoffFailure: "conflict" | "uncertain" | null;
  reviewVersion: number;
  currentActorRef: string;
}

async function syntheticP3Api(page: Page): Promise<SyntheticP3Api> {
  const state: SyntheticP3Api = {
    mutations: [],
    handoffKeys: [],
    timelineMode: "items",
    continuationFailure: false,
    handoffFailure: null,
    reviewVersion: 3,
    currentActorRef: "actor_ref_current",
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== "GET") state.mutations.push(`${request.method()} ${path}`);

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
          motion: "system",
          version: 1,
        },
        session: {
          idleExpiresAt: "2026-11-01T07:00:00.000Z",
          absoluteExpiresAt: "2026-11-01T18:00:00.000Z",
        },
      });
    }
    if (path.endsWith("/timeline")) {
      if (state.timelineMode === "denied") {
        return json(route, 404, undefined, {
          code: "COORDINATION_RESOURCE_NOT_FOUND",
          messageKey: "coordination.resource_not_found",
          retryable: false,
        });
      }
      if (state.timelineMode === "unavailable") {
        return json(route, 503, undefined, {
          code: "CARE_SERVICE_UNAVAILABLE",
          messageKey: "coordination.unavailable",
          retryable: true,
        });
      }
      const cursor = url.searchParams.get("cursor");
      if (cursor && state.continuationFailure) {
        return json(route, 400, undefined, {
          code: "TIMELINE_CURSOR_INVALID",
          messageKey: "timeline.cursor_invalid",
          retryable: false,
        });
      }
      const localDate = url.searchParams.get("localDate") ?? "2026-11-01";
      const displayTimeZone = url.searchParams.get("displayTimeZone") ?? "America/New_York";
      const filter = url.searchParams.get("filter") ?? "all";
      const empty = state.timelineMode === "empty";
      return json(route, 200, {
        localDate,
        displayTimeZone,
        dayStartUtc:
          localDate === "2026-11-01" ? "2026-11-01T04:00:00.000Z" : `${localDate}T04:00:00.000Z`,
        dayEndUtc:
          localDate === "2026-11-01" ? "2026-11-02T05:00:00.000Z" : `${localDate}T05:00:00.000Z`,
        filter,
        snapshotAt: "2026-11-01T12:00:00.000Z",
        coverageStartedAt: "2026-07-26T12:00:00.000Z",
        coverage: "complete",
        items: empty
          ? []
          : cursor
            ? [timelineItem("timeline_event_3", "Task Gamma", "2026-11-01T06:30:01.000Z")]
            : [
                timelineItem("timeline_event_1", "Task Alpha", "2026-11-01T06:30:00.000Z"),
                handoffItem("timeline_event_2", "Task Beta", "2026-11-01T06:30:00.000Z"),
              ],
        nextCursor: !empty && !cursor ? "sealed_cursor_value_long_enough_0001" : null,
      });
    }
    if (path.endsWith("/handoff") && request.method() === "GET") {
      return json(route, 200, {
        taskId: "task_synthetic",
        taskTitle: "Synthetic morning task",
        taskStatus: "open",
        taskVersion: state.reviewVersion,
        currentActor:
          state.currentActorRef === "actor_ref_current"
            ? actor("actor_ref_current", "coordination.actor.you", true)
            : actor("actor_ref_target", "coordination.actor.household_member", false),
        eligibleTargets:
          state.currentActorRef === "actor_ref_current"
            ? [actor("actor_ref_target", "coordination.actor.household_member", false)]
            : [actor("actor_ref_current", "coordination.actor.you", true)],
        effectiveMode: "immediate",
        displayTimeZone: "America/New_York",
        serverTime: "2026-11-01T06:30:00.000Z",
      });
    }
    if (path.endsWith("/handoffs") && request.method() === "POST") {
      state.handoffKeys.push(request.headers()["idempotency-key"] ?? "");
      if (state.handoffFailure) {
        const failure = state.handoffFailure;
        state.handoffFailure = null;
        if (failure === "conflict") {
          state.reviewVersion += 1;
          return json(route, 409, undefined, {
            code: "HANDOFF_VERSION_CONFLICT",
            messageKey: "handoff.conflict",
            retryable: false,
          });
        }
        state.currentActorRef = "actor_ref_target";
        state.reviewVersion += 1;
        return json(route, 503, undefined, {
          code: "CARE_SERVICE_UNAVAILABLE",
          messageKey: "handoff.uncertain",
          retryable: true,
        });
      }
      state.currentActorRef = "actor_ref_target";
      state.reviewVersion += 1;
      return json(route, 200, {
        taskId: "task_synthetic",
        taskVersion: state.reviewVersion,
        currentActor: actor("actor_ref_target", "coordination.actor.household_member", false),
        fromActor: actor("actor_ref_current", "coordination.actor.you", true),
        reasonCode: "schedule_conflict",
        occurredAt: "2026-11-01T06:30:00.000Z",
        effectiveAt: "2026-11-01T06:30:00.000Z",
        eventRef: "timeline_handoff_synthetic",
        outcome: "accepted",
        notificationDelivery: "pending",
      });
    }
    return json(route, 404, undefined, {
      code: "COORDINATION_RESOURCE_NOT_FOUND",
      messageKey: "coordination.resource_not_found",
      retryable: false,
    });
  });
  return state;
}

test("LB-012 exposes explicit DST boundary, stable chronology, keyset continuation and axe", async ({
  page,
}) => {
  await syntheticP3Api(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/households/household_synthetic/timeline");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByLabel("Selected local date").fill("2026-11-01");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Daily timeline");
  await expect(page.getByLabel("IANA display time zone")).toHaveValue("America/New_York");
  await expect(page.getByText("2026-11-01T04:00:00.000Z")).toBeVisible();
  await expect(page.getByText("2026-11-02T05:00:00.000Z")).toBeVisible();
  const items = page.locator("ol.timeline-list > li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Task Alpha");
  await expect(items.nth(1)).toContainText("Task Beta");

  await page.getByRole("button", { name: "Load later events" }).click();
  await expect(items).toHaveCount(3);
  await expect(items.nth(2)).toContainText("Task Gamma");
  await expect(page.locator("body")).not.toContainText(/total|hidden count|cursor/i);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-012 distinguishes empty/filter-empty and generic denial without count inference", async ({
  page,
}) => {
  const api = await syntheticP3Api(page);
  api.timelineMode = "empty";
  await page.goto("/households/household_synthetic/timeline");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.getByRole("heading", { name: "No confirmed events occurred" })).toBeVisible();

  await page.getByLabel("Event filter").selectOption("task_handoff");
  await expect(
    page.getByRole("heading", { name: "No events match the current filter" }),
  ).toBeVisible();

  api.timelineMode = "denied";
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.getByRole("heading", { name: "This content cannot be opened" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/member|recipient|hidden event|total/i);
});

test("LB-012 retains confirmed items on a stale continuation and offline never fabricates", async ({
  context,
  page,
}) => {
  const api = await syntheticP3Api(page);
  api.continuationFailure = true;
  await page.goto("/households/household_synthetic/timeline");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.locator("ol.timeline-list > li")).toHaveCount(2);
  await page.getByRole("button", { name: "Load later events" }).click();
  await expect(page.getByRole("heading", { name: "The continuation is stale" })).toBeVisible();
  await expect(page.locator("ol.timeline-list > li")).toHaveCount(2);

  await context.setOffline(true);
  await expect(page.getByRole("heading", { name: /You are offline/ })).toBeVisible();
  await expect(page.getByText(/This read may be stale/)).toBeVisible();
  await context.setOffline(false);
});

test("LB-014 review and durable success are keyboard operable, bounded and accessible", async ({
  page,
}) => {
  const api = await syntheticP3Api(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/households/household_synthetic/tasks/task_synthetic");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByLabel("Proposed person").selectOption("actor_ref_target");
  await page.getByLabel("Structured reason").selectOption("schedule_conflict");
  await page.getByRole("button", { name: "Review handoff" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Check before confirmation" })).toBeFocused();
  await expect(page.getByText(/server confirms it/)).toBeVisible();
  await expect(
    page.locator(".review-panel").getByText("Expected version").locator(".."),
  ).toContainText("3");
  await page.getByRole("button", { name: "Confirm handoff" }).click();

  await expect(page.getByRole("heading", { name: "Handoff confirmed" })).toBeFocused();
  await expect(page.getByText("Pending separate delivery")).toBeVisible();
  expect(api.handoffKeys).toHaveLength(1);
  expect(api.handoffKeys[0]).toMatch(/^p3_/);
  expect(JSON.stringify(api.mutations)).not.toMatch(/free.?form|description|title/i);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-014 conflict reloads confirmed state and uncertain result checks without blind retry", async ({
  page,
}) => {
  const api = await syntheticP3Api(page);
  api.handoffFailure = "conflict";
  await page.goto("/households/household_synthetic/tasks/task_synthetic");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await propose(page);
  await page.getByRole("button", { name: "Confirm handoff" }).click();
  await expect(page.getByRole("heading", { name: "The task has changed" })).toBeFocused();
  await page.getByRole("button", { name: "Load current state" }).click();
  await expect(page.getByRole("heading", { name: /Current state loaded/ })).toBeVisible();
  expect(api.handoffKeys).toHaveLength(1);

  api.handoffFailure = "uncertain";
  await propose(page);
  await page.getByRole("button", { name: "Confirm handoff" }).click();
  await expect(
    page.getByRole("heading", { name: "The request result is uncertain" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Check current state" }).click();
  await expect(page.getByRole("heading", { name: /Current state loaded/ })).toBeVisible();
  expect(api.handoffKeys).toHaveLength(2);
});

test("offline handoff is read-only, never queues and reconnect never submits", async ({
  context,
  page,
}) => {
  const api = await syntheticP3Api(page);
  await page.goto("/households/household_synthetic/tasks/task_synthetic");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await context.setOffline(true);
  await expect(page.getByRole("heading", { name: /You are offline/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Review handoff" })).toBeDisabled();
  const before = [...api.mutations];
  await context.setOffline(false);
  await page.waitForTimeout(100);
  expect(api.mutations).toEqual(before);
});

async function propose(page: Page) {
  await page.getByLabel("Proposed person").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Review handoff" }).click();
  await expect(page.getByRole("heading", { name: "Check before confirmation" })).toBeVisible();
}

function actor(actorRef: string, displayKey: string, subject: boolean) {
  return { actorRef, displayKey, subject };
}

function timelineItem(eventRef: string, taskTitle: string, occurredAt: string) {
  return {
    eventRef,
    kind: "task_created",
    taskId: `task_${eventRef}`,
    taskTitle,
    actor: actor("actor_ref_current", "coordination.actor.you", true),
    fromActor: null,
    toActor: null,
    reasonCode: null,
    occurredAt,
    outcome: "confirmed",
  };
}

function handoffItem(eventRef: string, taskTitle: string, occurredAt: string) {
  return {
    eventRef,
    kind: "task_handoff",
    taskId: `task_${eventRef}`,
    taskTitle,
    actor: null,
    fromActor: actor("actor_ref_current", "coordination.actor.you", true),
    toActor: actor("actor_ref_target", "coordination.actor.household_member", false),
    reasonCode: "schedule_conflict",
    occurredAt,
    outcome: "confirmed",
  };
}

async function json(route: Route, status: number, data?: unknown, error?: Record<string, unknown>) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(
      error
        ? { error, meta: { correlationId: "corr_browser_synthetic" } }
        : { data, meta: { correlationId: "corr_browser_synthetic" } },
    ),
  });
}
