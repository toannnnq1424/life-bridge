import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);
const now = "2026-07-29T01:02:03.000Z";

test("LB-024 keeps public search separate, truthful, accessible, and cache-bounded", async ({
  context,
  page,
}) => {
  const calls: string[] = [];
  const directoryMode: { value: "stale" | "empty" | "unavailable" } = { value: "stale" };
  await page.addInitScript(() => {
    Reflect.set(window, "__p5GeolocationCalls", 0);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: () => {
          Reflect.set(
            window,
            "__p5GeolocationCalls",
            Number(Reflect.get(window, "__p5GeolocationCalls")) + 1,
          );
        },
      },
    });
  });
  await page.route("**/api/v1/**", async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    if (new URL(route.request().url()).pathname !== "/api/v1/community") {
      return failure(route, 500, "INTERNAL_CONTRACT_INVALID");
    }
    if (directoryMode.value === "unavailable") {
      return failure(route, 503, "DIRECTORY_SEARCH_UNAVAILABLE");
    }
    const result = directoryResult();
    return jsonEnvelope(
      route,
      200,
      directoryMode.value === "empty" ? { ...result, items: [] } : result,
    );
  });
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.goto("/community");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Public community support directory" }),
  ).toBeVisible();
  await expect(page.getByText(/does not determine eligibility/)).toBeVisible();
  await expect(page.getByText(/Provenance is stale/).first()).toBeVisible();
  expect(calls).toEqual(["/api/v1/community"]);
  expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toMatch(
    /household|recipient|request|consent|actor/i,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByRole("heading", { name: /Offline, stale cached public listing/ }),
  ).toBeVisible();
  await context.setOffline(false);

  directoryMode.value = "empty";
  await page.getByRole("button", { name: "Search reviewed listings" }).click();
  await expect(page.getByRole("heading", { name: /No reviewed listing matched/ })).toBeFocused();
  directoryMode.value = "unavailable";
  await page.getByRole("button", { name: "Search reviewed listings" }).click();
  await expect(
    page.getByRole("heading", { name: /Directory search is unavailable/ }),
  ).toBeFocused();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: async () => ({ state: "denied" }) },
    });
  });
  await page.getByRole("button", { name: "Check location permission" }).click();
  await expect(page.getByRole("heading", { name: /location permission is denied/i })).toBeFocused();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: async () => ({ state: "prompt" }) },
    });
  });
  await page.getByRole("button", { name: "Check location permission" }).click();
  await expect(
    page.getByRole("heading", { name: /automatic province\/city lookup is unavailable/ }),
  ).toBeFocused();
  expect(await page.evaluate(() => Reflect.get(window, "__p5GeolocationCalls"))).toBe(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-022 explains consent first, blocks invalid/offline, and confirms only committed state", async ({
  context,
  page,
}) => {
  const mutations: Array<{ path: string; headers: Record<string, string>; body: unknown }> = [];
  await helpApi(page, mutations);
  await page.goto("/help/new?householdId=household_synthetic");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(
    page.getByRole("heading", { name: "Purpose, visibility, and consent" }),
  ).toBeVisible();
  await expect(page.getByText(/status alone is not consent/)).toBeVisible();
  await page.getByRole("button", { name: "Submit bounded request" }).click();
  await expect(page.getByRole("heading", { name: /Review the highlighted fields/ })).toBeFocused();
  expect(mutations).toHaveLength(0);

  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Submit bounded request" }).click();
  await expect(page.getByRole("heading", { name: /Submission confirmed/ })).toBeFocused();
  await expect(page.getByText(/does not mean queued for matching/).first()).toBeVisible();
  expect(mutations).toHaveLength(1);
  expect(mutations[0]?.headers["x-csrf-token"]).toBe(csrf);
  expect(mutations[0]?.headers["idempotency-key"]).toBeTruthy();
  expect(JSON.stringify(mutations[0]?.body)).not.toMatch(
    /diagnosis|treatment|urgency|address|latitude|longitude|narrative|notes/i,
  );
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toMatch(/submission_|request_synthetic|household_synthetic/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByRole("heading", { name: /Offline: protected requests are blocked/ }),
  ).toBeFocused();
  const before = mutations.length;
  await page.getByRole("button", { name: "Submit bounded request" }).click();
  expect(mutations).toHaveLength(before);
  await context.setOffline(false);
});

test("LB-022 distinguishes denied, conflict, uncertainty reconciliation, duplicate, and closed", async ({
  page,
}) => {
  let mode: "ready" | "denied" | "revoked" | "duplicate" | "conflict" | "uncertain" = "ready";
  const mutations: Array<{ path: string; headers: Record<string, string>; body: unknown }> = [];
  await helpApi(page, mutations, () => mode);
  await page.goto("/help/new?householdId=household_synthetic");
  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await page.getByRole("checkbox").check();

  mode = "duplicate";
  await page.getByRole("button", { name: "Submit bounded request" }).click();
  await expect(page.getByRole("heading", { name: /No second request was created/ })).toBeFocused();

  mode = "uncertain";
  await page.getByRole("button", { name: "Submit bounded request" }).click();
  await expect(page.getByRole("heading", { name: /result is uncertain/ })).toBeFocused();
  mode = "ready";
  await page.getByRole("button", { name: "Reconcile uncertain submission" }).click();
  await expect(page.getByRole("heading", { name: /Submission confirmed/ })).toBeFocused();

  mode = "conflict";
  await page.getByRole("button", { name: "Close request" }).click();
  await expect(page.getByRole("heading", { name: /request changed/ })).toBeFocused();
  mode = "denied";
  await page.getByRole("button", { name: "Check current authoritative state" }).click();
  await expect(
    page.getByRole("heading", { name: /lacks current purpose-scoped authority/ }),
  ).toBeFocused();
  mode = "revoked";
  await page.getByRole("button", { name: "Check current authoritative state" }).click();
  await expect(
    page.getByRole("heading", { name: /Current consent is no longer available/ }),
  ).toBeFocused();
  mode = "ready";
  await page.getByRole("button", { name: "Close request" }).click();
  await expect(page.getByRole("heading", { name: /Closure confirmed/ })).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

async function helpApi(
  page: Page,
  mutations: Array<{ path: string; headers: Record<string, string>; body: unknown }>,
  currentMode: () => "ready" | "denied" | "revoked" | "duplicate" | "conflict" | "uncertain" = () =>
    "ready",
) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/account/session") return jsonEnvelope(route, 200, session());
    if (currentMode() === "denied") {
      return failure(route, 404, "COMMUNITY_RESOURCE_NOT_FOUND");
    }
    if (currentMode() === "revoked") {
      return failure(route, 403, "COMMUNITY_CONSENT_REVOKED");
    }
    if (path.endsWith("/query")) {
      return jsonEnvelope(route, 200, { requests: [], serverTime: now });
    }
    if (request.method() === "POST" || request.method() === "DELETE") {
      const body = request.postDataJSON();
      mutations.push({ path, headers: request.headers(), body });
      if (currentMode() === "conflict") {
        return failure(route, 409, "COMMUNITY_REQUEST_VERSION_CONFLICT");
      }
      if (currentMode() === "uncertain") {
        return failure(route, 503, "COMMUNITY_REQUEST_RESULT_UNKNOWN");
      }
      if (path.endsWith("/reconcile")) {
        return jsonEnvelope(route, 200, mutationResult(String(body.submissionReference), true));
      }
      if (path.endsWith("/close")) {
        return jsonEnvelope(route, 200, {
          ...mutationResult("submission_synthetic_browser", false),
          outcome: "closed",
          request: {
            ...requestProjection("submission_synthetic_browser"),
            status: "closed",
            version: 2,
            closedAt: now,
            purgeAfter: "2026-08-28T01:02:03.000Z",
          },
        });
      }
      return jsonEnvelope(
        route,
        201,
        mutationResult(String(body.submissionReference), currentMode() === "duplicate"),
      );
    }
    return failure(route, 404, "COMMUNITY_RESOURCE_NOT_FOUND");
  });
}

function session() {
  return {
    accountId: "account_synthetic",
    onboardingState: "complete",
    authorizationScope: "account",
    csrfToken: csrf,
    preferences: {
      locale: "vi-VN",
      textScale: "default",
      contrast: "system",
      motion: "system",
      version: 1,
    },
    session: {
      idleExpiresAt: "2026-07-29T02:02:03.000Z",
      absoluteExpiresAt: "2026-07-29T10:02:03.000Z",
    },
  };
}

function mutationResult(submissionReference: string, duplicate: boolean) {
  return {
    outcome: "submitted",
    duplicate,
    request: requestProjection(submissionReference),
    confirmedAt: now,
  };
}

function requestProjection(submissionReference: string) {
  return {
    requestId: "request_synthetic_browser",
    submissionReference,
    category: "daily_living_support",
    locationGranularity: "province_city",
    provinceCityCode: "SYN-PC-001",
    dayPart: null,
    visibility: "current_request_collaborators",
    status: "pending",
    submissionOutcome: "confirmed",
    matchingState: "unavailable_in_p5_s1",
    retentionPolicy: "pending_30d_closed_30d_then_purge",
    version: 1,
    confirmedAt: now,
    pendingAutoCloseAt: "2026-08-28T01:02:03.000Z",
    closedAt: null,
    purgeAfter: null,
  };
}

function directoryResult() {
  return {
    items: [
      {
        listingId: "listing_synthetic_browser",
        publicName: "Synthetic community desk",
        organizationType: "community_group",
        provinceCityCode: "SYN-PC-001",
        provinceCityLabel: "Synthetic Province/City 001",
        categories: ["daily_living_support"],
        contactChannel: {
          type: "website",
          label: "Synthetic public page",
          value: "https://example.invalid/community",
        },
        accessibilityContactNote: "contact_for_accessibility_details",
        provenance: {
          sourceLabel: "Synthetic reviewed source",
          sourceUrl: "https://example.invalid/source",
          lastReviewedAt: "2026-06-01T00:00:00.000Z",
          nextReviewAt: "2026-07-01T00:00:00.000Z",
          state: "stale",
        },
        availabilityState: "not_verified",
        eligibilityState: "not_determined",
        endorsementState: "none",
      },
    ],
    generatedAt: now,
    cachePolicy: "public_5m_session_24h",
    matchingState: "unavailable_in_p5_s1",
    resultMeaning: "informational_not_eligibility_availability_or_endorsement",
  };
}

async function jsonEnvelope(route: Route, status: number, data: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ data, meta: { correlationId: "corr_p5s1_browser" } }),
  });
}

async function failure(route: Route, status: number, code: string) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code,
        messageKey: "community.synthetic",
        retryable: status >= 500,
        correlationId: "corr_p5s1_browser",
      },
    }),
  });
}
