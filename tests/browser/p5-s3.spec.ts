import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const url =
  "/admin/moderation?householdId=household_synthetic_0001&moderatorEnrollmentId=moderator_synthetic_0001";

test("LB-027 supports VI/EN, minimum disclosure, confirmation focus, authoritative result and reflow", async ({
  page,
}) => {
  await mockApi(page);
  await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(url);
  await expect(page.getByRole("heading", { name: /Xử lý kiểm duyệt/i })).toBeVisible();
  await page.getByLabel(/Ngôn ngữ/i).selectOption("en");
  await expect(page.getByRole("heading", { name: "Moderation resolution" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(
    /name|phone|email|address|diagnosis|treatment|narrative/i,
  );
  await page.getByLabel("Outcome").selectOption("content_visibility_restricted");
  await page.getByLabel("Structured reason").selectOption("policy_content_boundary");
  const review = page.getByRole("button", { name: "Review decision" });
  await review.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(review).toBeFocused();
  await review.click();
  await page.getByRole("button", { name: "Confirm decision" }).click();
  await expect(page.getByRole("heading", { name: "Decision result" })).toBeFocused();
  await expect(page.locator("main")).toContainText(/Community confirmed/i);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("LB-027 keeps denied/missing anti-enumerating and blocks offline writes", async ({
  context,
  page,
}) => {
  const writes: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().endsWith("/api/v1/session"))
      return respond(route, 200, { data: { csrfToken: "csrf_synthetic_p5s3" } });
    writes.push(route.request().url());
    return respond(route, 404, { error: { code: "COMMUNITY_MODERATION_NOT_FOUND" } });
  });
  await page.goto(url);
  await page.getByLabel(/Ngôn ngữ/i).selectOption("en");
  await expect(page.locator("main")).toContainText("This moderation view is unavailable.");
  await expect(page.locator("main")).not.toContainText(
    /case_synthetic|content_boundary|evidence_synthetic/i,
  );
  await context.setOffline(true);
  const before = writes.length;
  await page.getByRole("button", { name: "Load current state" }).last().click();
  expect(writes).toHaveLength(before);
  await expect(page.locator("main")).toContainText(/Offline/i);
});

test("LB-027 preserves uncertain-after-send truth and reconciles without repeating resolution", async ({
  page,
}) => {
  let resolveCalls = 0;
  await mockApi(page, async (route) => {
    if (route.request().url().endsWith("/resolution")) {
      resolveCalls += 1;
      await route.abort("connectionfailed");
      return true;
    }
    if (route.request().url().endsWith("/reconcile")) {
      await respond(route, 200, { case: resolvedCase() });
      return true;
    }
    return false;
  });
  await page.goto(url);
  await page.getByLabel(/Ngôn ngữ/i).selectOption("en");
  await page.getByLabel("Outcome").selectOption("no_change");
  await page.getByLabel("Structured reason").selectOption("insufficient_authoritative_evidence");
  await page.getByRole("button", { name: "Review decision" }).click();
  await page.getByRole("button", { name: "Confirm decision" }).click();
  await expect(page.locator("main")).toContainText(/uncertain after dispatch/i);
  await page.getByRole("button", { name: "Check current state" }).click();
  await expect(page.locator("main")).toContainText(/Community confirmed/i);
  expect(resolveCalls).toBe(1);
});

async function mockApi(page: Page, override?: (route: Route) => Promise<boolean>) {
  await page.route("**/api/v1/**", async (route) => {
    if (override && (await override(route))) return;
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/session"))
      return respond(route, 200, { data: { csrfToken: "csrf_synthetic_p5s3" } });
    if (path.endsWith("/cases/query")) return respond(route, 200, { cases: [queueCase()] });
    if (path.endsWith("/query")) return respond(route, 200, { case: detailCase() });
    if (path.endsWith("/resolution")) return respond(route, 200, { case: resolvedCase() });
    if (path.endsWith("/reconcile")) return respond(route, 200, { case: resolvedCase() });
    return respond(route, 503, { error: { code: "COMMUNITY_SERVICE_UNAVAILABLE" } });
  });
}

function queueCase() {
  return {
    caseId: "case_synthetic_0027",
    category: "content_boundary",
    state: "in_review",
    version: 7,
    submittedAt: "2026-07-29T02:20:00.000Z",
    retentionDeadline: "2026-10-29T00:00:00.000Z",
    minimumDisclosure: true,
  };
}
function detailCase() {
  return {
    ...queueCase(),
    affectedReference: "aggregate_digest_synthetic_0027",
    moderationPolicyVersion: "MOD-POL-1",
    redactionPolicyVersion: "MOD-RED-1",
    retentionPolicyVersion: "MOD-RET-1",
    evidenceCutoffAt: "2026-07-29T02:19:00.000Z",
    allowedOutcomes: [
      "no_change",
      "content_visibility_restricted",
      "community_participation_restricted",
    ],
    allowedReasons: [
      "insufficient_authoritative_evidence",
      "duplicate_report",
      "outside_moderation_scope",
      "policy_content_boundary",
      "policy_privacy_boundary",
      "policy_contact_boundary",
    ],
    evidence: [
      {
        evidenceId: "evidence_synthetic_0001",
        kind: "reported_aggregate_snapshot",
        value: "redacted_boundary_marker",
        provenance: "community_authoritative_record",
        observedAt: "2026-07-29T02:18:00.000Z",
        redacted: true,
      },
    ],
  };
}
function resolvedCase() {
  return {
    ...detailCase(),
    state: "resolved",
    version: 8,
    outcome: "no_change",
    reason: "insufficient_authoritative_evidence",
  };
}
async function respond(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "cache-control": "no-store" },
    body: JSON.stringify(body),
  });
}
