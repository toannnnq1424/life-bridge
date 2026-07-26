import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);

interface SyntheticP2S3Api {
  mutations: string[];
  idempotencyKeys: string[];
  failNext: "conflict" | "unavailable" | null;
}

async function syntheticP2S3Api(page: Page): Promise<SyntheticP2S3Api> {
  const state: SyntheticP2S3Api = { mutations: [], idempotencyKeys: [], failNext: null };
  let subjectVersion = 2;
  let grantVersion = 1;
  let grantState: "active" | "revoked" = "active";
  let grantScopes = ["recipient_context.basic_label", "recipient_context.relationship_label"];
  let privacy = {
    profileVisibility: "private",
    coordinationActivityVisibility: "hidden",
    accessAlerts: true,
    version: 1,
    confirmedAt: "2026-07-26T12:00:00.000Z",
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== "GET") state.mutations.push(`${request.method()} ${path}`);
    if (request.method() !== "GET" && path.includes("/consent/grants")) {
      state.idempotencyKeys.push(request.headers()["idempotency-key"] ?? "");
    }
    if (path === "/api/v1/account/session") {
      return json(route, 200, {
        authorizationScope: "account",
        onboardingState: "complete",
        csrfToken: csrf,
        preferences: { locale: "vi-VN" },
      });
    }
    if (path.endsWith("/recipient-context") && request.method() === "GET") {
      return json(route, 200, {
        recipientContextId: "recipient_synthetic",
        householdId: "household_synthetic",
        displayLabel: "Recipient A",
        relationshipLabel: "Relationship A",
        version: 1,
      });
    }
    if (path.endsWith("/consent") && request.method() === "GET") {
      return json(route, 200, {
        authority: "self",
        subject: {
          subjectId: "subject_synthetic",
          householdId: "household_synthetic",
          recipientContextId: "recipient_synthetic",
          authority: "self",
          version: subjectVersion,
          establishedAt: "2026-07-26T11:00:00.000Z",
        },
        eligibleRecipients: [
          {
            recipientRef: "member_reference",
            role: "member",
            displayKey: "consent.recipient.household_member",
          },
        ],
        grants:
          grantState === "active"
            ? [
                {
                  grantId: "grant_synthetic",
                  subjectId: "subject_synthetic",
                  recipientRef: "member_reference",
                  recipientDisplayKey: "consent.recipient.household_member",
                  purpose: "household_coordination",
                  scopes: grantScopes,
                  state: grantState,
                  effectiveAt: "2026-07-26T12:00:00.000Z",
                  revokedEffectiveAt: null,
                  displayTimeZone: "Asia/Bangkok",
                  version: grantVersion,
                },
              ]
            : [],
        serverTime: "2026-07-26T12:00:00.000Z",
      });
    }
    if (request.method() !== "GET" && path.includes("/consent/")) {
      if (state.failNext) {
        const failure = state.failNext;
        state.failNext = null;
        return json(route, failure === "conflict" ? 409 : 503, undefined, {
          code:
            failure === "conflict" ? "CONSENT_VERSION_CONFLICT" : "IDENTITY_SERVICE_UNAVAILABLE",
          messageKey: failure === "conflict" ? "consent.conflict" : "identity.unavailable",
          retryable: failure !== "conflict",
          correlationId: "corr_browser_failure",
        });
      }
      const body = request.postDataJSON() as {
        action?: string;
        scopes?: string[];
      };
      subjectVersion += 1;
      if (path.endsWith("/narrow")) {
        grantScopes = body.scopes ?? grantScopes;
        grantVersion += 1;
      } else if (path.endsWith("/revoke")) {
        grantState = "revoked";
        grantVersion += 1;
      }
      return json(route, path.includes("/grants") ? 200 : 201, {
        grantId: "grant_synthetic",
      });
    }
    if (path === "/api/v1/account/privacy" && request.method() === "GET") {
      return json(route, 200, privacy);
    }
    if (path === "/api/v1/account/privacy" && request.method() === "PATCH") {
      if (state.failNext) {
        const failure = state.failNext;
        state.failNext = null;
        return json(route, failure === "conflict" ? 409 : 503, undefined, {
          code:
            failure === "conflict" ? "PRIVACY_VERSION_CONFLICT" : "IDENTITY_SERVICE_UNAVAILABLE",
          messageKey: failure === "conflict" ? "privacy.conflict" : "identity.unavailable",
          retryable: failure !== "conflict",
          correlationId: "corr_browser_failure",
        });
      }
      const body = request.postDataJSON() as typeof privacy;
      privacy = {
        profileVisibility: body.profileVisibility,
        coordinationActivityVisibility: body.coordinationActivityVisibility,
        accessAlerts: body.accessAlerts,
        version: privacy.version + 1,
        confirmedAt: "2026-07-26T12:01:00.000Z",
      };
      return json(route, 200, privacy);
    }
    if (path.endsWith("/audit")) {
      return json(route, 200, {
        items: [
          {
            eventRef: "audit_event_1",
            category: "consent.revoked",
            actorAlias: "your_account",
            redaction: "protected",
            occurredAt: "2026-07-26T12:00:00.000Z",
            displayTimeZone: "Asia/Bangkok",
            outcome: "confirmed",
          },
        ],
        nextCursor: null,
      });
    }
    return json(route, 404, undefined, {
      code: "CONSENT_RESOURCE_NOT_FOUND",
      messageKey: "consent.resource_not_found",
      retryable: false,
      correlationId: "corr_browser_not_found",
    });
  });
  return state;
}

test("LB-028 uses a keyboard review flow and cancel sends no revoke", async ({ page }) => {
  const api = await syntheticP2S3Api(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/households/household_synthetic/consent");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Consent sharing");
  await expect(
    page.getByText(/Organizer membership does not grant consent authority/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Cài đặt.*Settings/ }).first()).toHaveAttribute(
    "href",
    "/settings?householdId=household_synthetic",
  );

  const revoke = page.getByRole("button", { name: /Thu hồi.*Revoke/ });
  await revoke.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /Review change/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Review change/ })).toBeFocused();
  await page.getByRole("button", { name: /Hủy.*Cancel/ }).focus();
  await page.keyboard.press("Enter");
  expect(api.mutations.filter((value) => value.endsWith("/revoke"))).toEqual([]);

  await page.getByRole("button", { name: /Thu hẹp.*Narrow/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Confirm narrow/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".status-panel")).toContainText("server confirmed");
  expect(api.mutations.some((value) => value.endsWith("/narrow"))).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-028 conflict keeps confirmed access and focuses recovery status", async ({ page }) => {
  const api = await syntheticP2S3Api(page);
  api.failNext = "conflict";
  await page.goto("/households/household_synthetic/consent");
  await page.getByRole("button", { name: /Thu hồi.*Revoke/ }).click();
  await page.getByRole("button", { name: /Confirm revoke/ }).click();
  await expect(page.locator(".status-panel")).toContainText("Reload the confirmed version");
  await expect(page.locator(".status-panel")).toBeFocused();
  await expect(page.getByText(/Status:.*active/)).toBeVisible();
});

test("LB-028 explicit retry reuses the same review idempotency key", async ({ page }) => {
  const api = await syntheticP2S3Api(page);
  api.failNext = "unavailable";
  await page.goto("/households/household_synthetic/consent");
  await page.getByRole("button", { name: /Thu hồi.*Revoke/ }).click();
  await page.getByRole("button", { name: /Confirm revoke/ }).click();
  await expect(page.locator(".status-panel")).toContainText("No success was confirmed");
  await page.getByRole("button", { name: /Confirm revoke/ }).click();
  await expect(page.locator(".status-panel")).toContainText("server confirmed");
  expect(api.idempotencyKeys).toHaveLength(2);
  expect(api.idempotencyKeys[0]).toMatch(/^p2s3-/);
  expect(api.idempotencyKeys[1]).toBe(api.idempotencyKeys[0]);
});

test("offline blocks consent mutations and reconnect never submits", async ({ context, page }) => {
  const api = await syntheticP2S3Api(page);
  await page.goto("/households/household_synthetic/consent");
  await context.setOffline(true);
  await expect(page.locator(".offline-banner")).toContainText("will not be queued");
  await expect(page.getByRole("button", { name: /Thu hồi.*Revoke/ })).toBeDisabled();
  const before = [...api.mutations];
  await context.setOffline(false);
  await page.waitForTimeout(100);
  expect(api.mutations).toEqual(before);
});

test("LB-029 is atomic, resets failed drafts, and never reports global success", async ({
  page,
}) => {
  const api = await syntheticP2S3Api(page);
  await page.goto("/settings/privacy");
  await page
    .getByRole("radio", { name: /Household only/ })
    .first()
    .check();
  await page.getByRole("button", { name: /Review changes/ }).click();
  await expect(page.getByText(/All three save atomically/)).toBeVisible();
  api.failNext = "unavailable";
  await page.getByRole("button", { name: /Confirm save/ }).click();
  await expect(page.locator(".status-panel")).toContainText("No success was confirmed");
  await expect(page.getByRole("radio", { name: /Private/ })).toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-030 is read-only, redacted, bounded and exposes no total", async ({ page }) => {
  await syntheticP2S3Api(page);
  await page.goto("/households/household_synthetic/audit");
  await expect(page.getByText(/this page cannot grant or change access/)).toBeVisible();
  await expect(page.getByText(/Some fields are hidden/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Consent revoked/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Load older events/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/total|hidden rows|cursor/i);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-031 is a semantic hub with no global saved state", async ({ page }) => {
  await syntheticP2S3Api(page);
  await page.goto("/settings?householdId=household_synthetic");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Settings hub");
  await expect(page.getByText(/no global saved state/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Consent sharing/ })).toHaveAttribute(
    "href",
    "/households/household_synthetic/consent",
  );
  expect(await browserPersistence(page)).not.toMatch(
    /grant_synthetic|audit_event_1|member_reference/,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

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
