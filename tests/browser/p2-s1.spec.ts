import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const challenge = "A".repeat(43);
const csrf = "C".repeat(43);

async function syntheticIdentity(page: Page, options: { failPreferences?: boolean } = {}) {
  await page.route("**/api/v1/account/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    let data: Record<string, unknown> = {};
    if (path.endsWith("/registrations")) {
      data = {
        code: "REGISTRATION_ACCEPTED",
        messageKey: "registration.accepted",
        challengeToken: challenge,
        manualSecret: "SYNTHETICSETUPKEY",
      };
    } else if (path.endsWith("/registrations/factor")) {
      data = {
        code: "REGISTRATION_ACCEPTED",
        messageKey: "registration.accepted",
        challengeToken: challenge,
        recoveryCodes: ["AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD"],
      };
    } else if (path.endsWith("/sessions/factor")) {
      data = {
        projection: {
          accountId: "account_synthetic",
          onboardingState: "required",
          authorizationScope: "account",
          preferences: {
            locale: "vi-VN",
            textScale: "default",
            contrast: "system",
            motion: "system",
            version: 1,
          },
          session: {
            idleExpiresAt: "2026-07-26T07:00:00.000Z",
            absoluteExpiresAt: "2026-07-26T18:00:00.000Z",
          },
          csrfToken: csrf,
        },
      };
    } else if (path.endsWith("/sessions")) {
      data = {
        code: "AUTHENTICATION_CONTINUE",
        messageKey: "auth.continue",
        challengeToken: challenge,
      };
    } else if (path.endsWith("/onboarding/complete")) {
      data = {
        authorizationScope: "account",
        onboardingState: "complete",
        csrfToken: csrf,
        preferences: {
          locale: "vi-VN",
          textScale: "default",
          contrast: "system",
          motion: "system",
          version: 1,
        },
      };
    } else if (path.endsWith("/preferences")) {
      if (options.failPreferences) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "IDENTITY_SERVICE_UNAVAILABLE",
              messageKey: "identity.unavailable",
              retryable: true,
              correlationId: "corr_p2_preferences_failed",
            },
          }),
        });
        return;
      }
      data = {
        authorizationScope: "account",
        onboardingState: "complete",
        csrfToken: csrf,
        preferences: { ...body, version: 2 },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data, meta: { correlationId: "corr_p2_synthetic" } }),
    });
  });
}

test("LB-001 public landing is semantic, bilingual, reflow-safe and has no household link", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Điều phối chăm sóc");
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/login");
  await expect(page.locator('a[href^="/households/"]')).toHaveCount(0);
  await page.locator(".account-header select").selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Coordinate care clearly and safely",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("registration requires factor and recovery acknowledgement without browser persistence", async ({
  page,
}) => {
  await syntheticIdentity(page);
  await page.goto("/register");
  await page.getByLabel("Tên đăng nhập").fill("synthetic.user");
  await page.getByLabel("Mật khẩu mới").fill("correct horse battery");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  await expect(page.getByText("SYNTHETICSETUPKEY")).toBeVisible();
  await page.getByLabel("Mã xác thực 6 chữ số").fill("123456");
  await page.getByRole("button", { name: "Xác minh" }).click();
  await expect(page.getByText("AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD")).toBeVisible();
  await page.getByLabel("Tôi đã lưu các mã khôi phục ở nơi an toàn").check();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const persisted = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    url: location.href,
    historyState: history.state,
  }));
  expect(JSON.stringify(persisted)).not.toContain("correct horse battery");
  expect(JSON.stringify(persisted)).not.toContain("SYNTHETICSETUPKEY");
  expect(JSON.stringify(persisted)).not.toContain("AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD");
});

test("sign-in factor reaches account-only onboarding and preferences in VI and EN", async ({
  page,
}) => {
  await syntheticIdentity(page);
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("synthetic.user");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("correct horse battery");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Mã xác thực 6 chữ số").fill("123456");
  await page.getByRole("button", { name: "Xác minh" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("paragraph").filter({ hasText: /không cấp vai trò/i })).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page).toHaveURL(/\/onboarding\/accessibility$/);
  await page.locator(".account-header select").selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Display and language — Step 2 of 2",
  );
  await page.getByLabel("Text size").selectOption("large");
  await page.getByLabel("Contrast").selectOption("more");
  await page.getByLabel("Motion").selectOption("reduce");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.locator(".sr-status")).toHaveText(/Household access has not been granted/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("failed accessibility preferences never announce account-ready success", async ({ page }) => {
  await syntheticIdentity(page, { failPreferences: true });
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("synthetic.user");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("correct horse battery");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByLabel("Mã xác thực 6 chữ số").fill("123456");
  await page.getByRole("button", { name: "Xác minh" }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.locator(".account-header select").selectOption("en");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.locator(".error-summary")).toContainText("request could not be completed");
  await expect(page.locator(".sr-status")).toBeEmpty();
});

test("anonymous failure is generic and offline mutation is blocked without reconnect submit", async ({
  context,
  page,
}) => {
  await page.route("**/api/v1/account/sessions", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "AUTHENTICATION_FAILED",
          messageKey: "auth.failed",
          retryable: false,
          correlationId: "corr_p2_generic",
        },
      }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill("unknown.user");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("wrong but synthetic");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  const summary = page.locator(".error-summary");
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("không xác nhận tài khoản có tồn tại");

  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/account/sessions")) requests += 1;
  });
  await context.setOffline(true);
  await page.getByLabel("Tên đăng nhập").fill("offline.user");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("offline synthetic password");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.locator(".error-summary")).toContainText("ngoại tuyến");
  await context.setOffline(false);
  await page.waitForTimeout(250);
  expect(requests).toBe(0);
});
