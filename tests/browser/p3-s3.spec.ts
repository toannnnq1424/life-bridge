import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);

test("LB-017 distinguishes current, draft, review facts and bounded history in VI/EN", async ({
  page,
}) => {
  const state = await syntheticApi(page);
  await page.goto("/households/household_synthetic/care-plan");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.getByRole("heading", { level: 1, name: "Support plan" })).toBeVisible();
  await expect(page.getByText("Current confirmed version")).toBeVisible();
  await expect(page.getByText("Confirmed version history")).toBeVisible();
  await expect(page.getByText("Coordination only — not clinical advice.")).toBeVisible();
  await page.getByRole("button", { name: "Edit support plan" }).click();
  await page.getByLabel("Local review date").fill("2026-11-01");
  await page.getByLabel("IANA review time zone").selectOption("America/New_York");
  await page.getByRole("button", { name: "Review unsent draft" }).click();
  await expect(page.getByRole("heading", { name: "Review unsent draft" })).toBeFocused();
  await expect(
    page.locator(".review-panel").getByText("2026-11-01T04:00:00.000Z", { exact: false }),
  ).toBeVisible();
  expect(state.mutations).toEqual(["PUT draft"]);
  await page.getByRole("button", { name: "Make current" }).click();
  await expect(
    page.getByRole("heading", { name: "The confirmed support plan is current" }),
  ).toBeFocused();
  expect(state.mutations).toEqual(["PUT draft", "POST current"]);
  expect(state.keys.every(Boolean)).toBe(true);
  expect(state.csrf.every((value) => value === csrf)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-017 preserves unsent conflict choices and never retries an uncertain command", async ({
  page,
}) => {
  const state = await syntheticApi(page);
  await page.goto("/households/household_synthetic/care-plan");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByRole("button", { name: "Edit support plan" }).click();
  await page.getByLabel("Local review date").fill("2026-11-01");
  state.failure = "conflict";
  await page.getByRole("button", { name: "Review unsent draft" }).click();
  await expect(page.getByRole("heading", { name: "The support plan changed" })).toBeFocused();
  expect(state.mutations).toHaveLength(1);
  await page.getByRole("button", { name: "Check current state" }).click();
  expect(state.mutations).toHaveLength(1);
});

test("LB-017 labels an in-memory offline view stale and blocks mutation", async ({
  page,
  context,
}) => {
  await syntheticApi(page);
  await page.goto("/households/household_synthetic/care-plan");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByText("already loaded information may be stale", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit support plan" })).toBeDisabled();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  await context.setOffline(false);
});

interface SyntheticState {
  failure: "conflict" | "uncertain" | null;
  mutations: string[];
  keys: string[];
  csrf: string[];
  plan: ReturnType<typeof projection>;
}

async function syntheticApi(page: Page): Promise<SyntheticState> {
  const state: SyntheticState = {
    failure: null,
    mutations: [],
    keys: [],
    csrf: [],
    plan: projection(),
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/account/session") return json(route, 200, session());
    if (path.endsWith("/care-plan/history"))
      return json(route, 200, {
        versions: state.plan.current ? [state.plan.current] : [],
        nextCursor: null,
        coverageStartedAt: "2026-07-27T00:00:00.000Z",
      });
    if (path.endsWith("/care-plan") && request.method() === "GET")
      return json(route, 200, state.plan);
    if (path.endsWith("/care-plan/draft")) {
      state.mutations.push("PUT draft");
      state.keys.push(request.headers()["idempotency-key"] ?? "");
      state.csrf.push(request.headers()["x-csrf-token"] ?? "");
      if (state.failure) {
        const failure = state.failure;
        state.failure = null;
        return fail(
          route,
          failure === "conflict" ? 409 : 503,
          failure === "conflict" ? "CARE_PLAN_VERSION_CONFLICT" : "SERVICE_UNAVAILABLE",
        );
      }
      state.plan = { ...state.plan, aggregateRevision: 2, draft: draft() };
      return json(route, 200, {
        planId: "plan_synthetic",
        aggregateRevision: 2,
        draftRevision: 1,
        planVersion: null,
        outcome: "draft_saved",
        confirmedAt: "2026-10-30T12:00:00.000Z",
        review: null,
        eventRef: null,
      });
    }
    if (path.endsWith("/care-plan/current")) {
      state.mutations.push("POST current");
      state.keys.push(request.headers()["idempotency-key"] ?? "");
      state.csrf.push(request.headers()["x-csrf-token"] ?? "");
      state.plan = {
        ...state.plan,
        aggregateRevision: 3,
        current: { ...version(), planVersion: 5 },
        draft: null,
      };
      return json(route, 200, {
        planId: "plan_synthetic",
        aggregateRevision: 3,
        draftRevision: null,
        planVersion: 5,
        outcome: "confirmed",
        confirmedAt: "2026-10-30T12:00:00.000Z",
        review: state.plan.current!.review,
        eventRef: "event_synthetic_5",
      });
    }
    return fail(route, 404, "COORDINATION_RESOURCE_NOT_FOUND");
  });
  return state;
}

function projection() {
  return {
    state: "plan" as const,
    planId: "plan_synthetic",
    aggregateRevision: 1,
    current: version(),
    draft: null as ReturnType<typeof draft> | null,
    eligibleResponsibilityActors: [
      {
        actorId: "actor_synthetic",
        actorRef: "actor_ref_synthetic",
        displayKey: "coordination.actor.you" as const,
        subject: true,
      },
    ],
    reviewState: "upcoming" as const,
    requiresReview: false,
    coverageStartedAt: "2026-07-27T00:00:00.000Z",
    serverTime: "2026-10-30T12:00:00.000Z",
  };
}
function draft() {
  return {
    draftRevision: 1,
    baseCurrentVersion: 4,
    goals: [{ category: "communication" as const, statement: "Weekly coordination check-in" }],
    preferences: [
      { category: "communication" as const, statement: "Coordination language: Vietnamese" },
    ],
    responsibilities: [
      {
        category: "coordination" as const,
        statement: "Confirm shared schedule",
        actor: { state: "eligible" as const, actorRef: "actor_ref_synthetic" },
      },
    ],
    reviewLocalDate: "2026-11-01",
    reviewTimeZone: "America/New_York",
    reviewDayStartUtc: "2026-11-01T04:00:00.000Z",
    reviewDayEndUtc: "2026-11-02T05:00:00.000Z",
    publicationReadiness: "ready" as const,
    updatedAt: "2026-10-30T12:00:00.000Z",
  };
}
function version() {
  return {
    planVersion: 4,
    changeGroups: ["initial" as const],
    goals: [{ category: "communication" as const, statement: "Weekly coordination check-in" }],
    preferences: [
      { category: "communication" as const, statement: "Coordination language: Vietnamese" },
    ],
    responsibilities: [
      {
        category: "coordination" as const,
        statement: "Confirm shared schedule",
        actor: { state: "eligible" as const, actorRef: "actor_ref_synthetic" },
      },
    ],
    review: {
      reviewLocalDate: "2026-11-01",
      reviewTimeZone: "America/New_York",
      reviewDayStartUtc: "2026-11-01T04:00:00.000Z",
      reviewDayEndUtc: "2026-11-02T05:00:00.000Z",
      reviewState: "upcoming" as const,
    },
    confirmedAt: "2026-10-30T12:00:00.000Z",
    eventRef: "event_synthetic_4",
  };
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
      idleExpiresAt: "2026-11-01T07:00:00.000Z",
      absoluteExpiresAt: "2026-11-01T18:00:00.000Z",
    },
  };
}
async function json(route: Route, status: number, data: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ data, meta: { correlationId: "correlation_synthetic" } }),
  });
}
async function fail(route: Route, status: number, code: string) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code,
        messageKey: "synthetic.error",
        retryable: status >= 500,
        correlationId: "correlation_synthetic",
        recoveryAction: code.includes("CONFLICT") ? "reload_current" : undefined,
      },
    }),
  });
}
