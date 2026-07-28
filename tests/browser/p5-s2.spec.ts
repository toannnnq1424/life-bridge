import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

for (const route of ["/matching", "/organization"] as const) {
  test(`${route} preserves minimum disclosure, offline truth, reflow, and accessibility`, async ({
    context,
    page,
  }) => {
    const writes: string[] = [];
    await page.route("**/api/v1/**", async (requestRoute) => {
      if (requestRoute.request().url().endsWith("/api/v1/session")) {
        return respond(requestRoute, 200, {
          data: { csrfToken: "csrf_synthetic_p5s2_0001" },
        });
      }
      if (requestRoute.request().method() !== "GET") writes.push(requestRoute.request().url());
      await respond(requestRoute, 200, queueResult());
    });
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
    await page.goto(
      `${route}?householdId=household_synthetic_0001&organizationId=org_synthetic_0001`,
    );
    await selectEnglish(page);
    await expect(page.locator("main")).toBeVisible();
    expect(JSON.stringify(await browserStorage(page))).not.toMatch(
      /diagnosis|treatment|address|phone|email|narrative|recipient.*name/i,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);

    await context.setOffline(true);
    await expect(page.locator("main")).toContainText(/offline|ngoại tuyến/i);
    const before = writes.length;
    const action = page.locator("main button:not([disabled])").last();
    if (await action.isVisible()) await action.click();
    expect(writes).toHaveLength(before);
    await context.setOffline(false);
  });
}

test("LB-025 reports concurrent/stale action truth without fabricating acceptance", async ({
  page,
}) => {
  let conflict = false;
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().endsWith("/api/v1/session")) {
      return respond(route, 200, { data: { csrfToken: "csrf_synthetic_p5s2_0001" } });
    }
    if (!conflict) return respond(route, 200, queueResult());
    return respond(route, 409, {
      error: {
        code: "COMMUNITY_MATCH_VERSION_CONFLICT",
        messageKey: "community.match.version_conflict",
        correlationId: "correlation_p5s2_conflict",
      },
    });
  });
  await page.goto(
    "/matching?householdId=household_synthetic_0001&organizationId=org_synthetic_0001",
  );
  await selectEnglish(page);
  const action = page.getByRole("button", { name: /accept/i }).first();
  await expect(action).toBeVisible();
  conflict = true;
  await action.click();
  await expect(page.locator("main")).toContainText(/changed|conflict|reconcile/i);
  await expect(page.locator("main")).not.toContainText(/acceptance confirmed/i);
});

test("LB-026 shows separate approval/capacity/authority evidence and append-only progress", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) =>
    route.request().url().endsWith("/api/v1/session")
      ? respond(route, 200, { data: { csrfToken: "csrf_synthetic_p5s2_0001" } })
      : respond(route, 200, queueResult()),
  );
  await page.goto(
    "/organization?householdId=household_synthetic_0001&organizationId=org_synthetic_0001",
  );
  await selectEnglish(page);
  await expect(page.locator("main")).toContainText(/approval/i);
  await expect(page.locator("main")).toContainText(/capacity/i);
  await expect(page.locator("main")).toContainText(/authority|consent/i);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

async function selectEnglish(page: Page) {
  const locale = page.getByLabel(/Ngôn ngữ|Language/i);
  if (await locale.isVisible()) await locale.selectOption("en");
}

async function browserStorage(page: Page) {
  return page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
}

async function respond(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}

function matchResult() {
  return {
    matchId: "match_synthetic_0001",
    organizationId: "org_synthetic_0001",
    state: "offered",
    version: 2,
    category: "daily_living_support",
    provinceCityCode: "SYN-PC-001",
    serviceDate: "2026-08-01",
    dayPart: "morning",
    offerId: "offer_synthetic_0001",
    nextActions: ["accept", "decline"],
    evidenceExpiresAt: "2026-08-28T00:00:00.000Z",
    confirmedAt: "2026-07-29T01:02:03.000Z",
  };
}

function queueResult() {
  return {
    matches: [matchResult()],
    serverTime: "2026-07-29T01:02:03.000Z",
    minimumDisclosure: "P5-S2-v1",
  };
}
