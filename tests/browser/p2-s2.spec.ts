import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const csrf = "C".repeat(43);
const rawInvitationToken = "T".repeat(43);

interface SyntheticApi {
  mutations: string[];
  sessionReads: number;
}

async function syntheticHouseholdApi(page: Page): Promise<SyntheticApi> {
  const api = { mutations: [] as string[], sessionReads: 0 };
  let invitationVersion = 1;
  let context: Record<string, unknown> | null = null;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== "GET") api.mutations.push(`${request.method()} ${path}`);
    if (path === "/api/v1/account/session") {
      api.sessionReads += 1;
      return json(route, 200, {
        authorizationScope: "account",
        onboardingState: "complete",
        csrfToken: csrf,
        preferences: { locale: "vi-VN" },
      });
    }
    if (path === "/api/v1/households" && request.method() === "POST") {
      return json(route, 201, {
        householdId: "household_synthetic",
        displayLabel: "Nhà An",
        role: "organizer",
        capabilities: [
          "household.view",
          "household.manage",
          "invitation.manage",
          "recipient_context.view",
          "recipient_context.manage",
        ],
        version: 1,
      });
    }
    if (path === "/api/v1/households/household_synthetic" && request.method() === "GET") {
      return json(route, 200, {
        householdId: "household_synthetic",
        displayLabel: "Nhà An",
        role: "organizer",
        capabilities: [
          "household.view",
          "household.manage",
          "invitation.manage",
          "recipient_context.view",
          "recipient_context.manage",
        ],
        version: 1,
      });
    }
    if (
      path === "/api/v1/households/household_synthetic/invitations" &&
      request.method() === "POST"
    ) {
      return json(route, 201, {
        invitationId: "invitation_synthetic",
        householdId: "household_synthetic",
        role: "member",
        state: "pending",
        expiresAt: "2026-08-05T02:00:00.000Z",
        version: invitationVersion,
        invitationToken: rawInvitationToken,
      });
    }
    if (path.endsWith("/resend")) {
      invitationVersion += 1;
      return json(route, 200, {
        invitationId: "invitation_synthetic",
        householdId: "household_synthetic",
        role: "member",
        state: "pending",
        expiresAt: "2026-08-05T03:00:00.000Z",
        version: invitationVersion,
        invitationToken: "R".repeat(43),
      });
    }
    if (path.endsWith("/revoke")) {
      invitationVersion += 1;
      return json(route, 200, {
        invitationId: "invitation_synthetic",
        householdId: "household_synthetic",
        role: "member",
        state: "revoked",
        expiresAt: "2026-08-05T03:00:00.000Z",
        version: invitationVersion,
      });
    }
    if (path === "/api/v1/invitations/accept" || path === "/api/v1/invitations/decline") {
      return json(route, 200, {
        invitationId: "invitation_synthetic",
        householdId: "household_synthetic",
        role: "member",
        state: path.endsWith("/accept") ? "accepted" : "declined",
        expiresAt: "2026-08-05T02:00:00.000Z",
        version: 2,
      });
    }
    if (path.endsWith("/recipient-context") && request.method() === "GET") {
      return json(route, 200, context);
    }
    if (path.endsWith("/recipient-context") && request.method() === "PUT") {
      const body = request.postDataJSON() as Record<string, unknown>;
      context = {
        recipientContextId: "recipient_synthetic",
        householdId: "household_synthetic",
        displayLabel: body.displayLabel,
        relationshipLabel: body.relationshipLabel,
        version: 1,
      };
      return json(route, 200, context);
    }
    return json(route, 404, undefined, {
      code: "HOUSEHOLD_NOT_FOUND",
      messageKey: "household.notFound",
    });
  });
  return api;
}

test("LB-008 creates one household with keyboard, reflow, locale and axe coverage", async ({
  page,
}) => {
  const api = await syntheticHouseholdApi(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/households/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tạo hộ gia đình");
  await page.getByLabel(/Tên hiển thị hộ gia đình/).fill("Nhà An");
  await expect(page.getByText(/6\/80 ký tự/)).toBeVisible();
  await page.getByRole("button", { name: "Tạo hộ gia đình" }).click();
  await expect(
    page.locator(".confirmed-panel p").filter({
      hasText: /vai trò điều phối viên đã được xác nhận/,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Mời một cộng tác viên" })).toHaveAttribute(
    "href",
    "/households/household_synthetic/invitations",
  );
  await page.locator(".account-header select").selectOption("en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create a household");
  expect(api.sessionReads).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-009 keeps account existence and raw tokens out of the organizer surface", async ({
  page,
}) => {
  await syntheticHouseholdApi(page);
  await page.goto("/households/household_synthetic/invitations");
  await page.getByLabel(/Tên đăng nhập/).fill("unknown.synthetic");
  await page.getByRole("radio", { name: /Thành viên/ }).check();
  await page.getByRole("button", { name: "Gửi lời mời" }).click();
  await expect(
    page.locator(".account-card p").filter({
      hasText: /cùng một cách cho mọi tên đăng nhập/,
    }),
  ).toBeVisible();
  await expect(page.locator(".status-with-icon")).toContainText("Đang chờ");
  await expect(page.locator("body")).not.toContainText(rawInvitationToken);
  expect(await browserPersistence(page)).not.toContain(rawInvitationToken);
  await page.getByRole("button", { name: "Gửi lại" }).click();
  await expect(page.getByText(/đã được làm mới/)).toBeVisible();
  await page.getByRole("button", { name: "Thu hồi" }).click();
  await expect(page.locator(".status-with-icon")).toContainText("Đã thu hồi");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("LB-009 invitee decision clears the body token and reveals only terminal state", async ({
  page,
}) => {
  await syntheticHouseholdApi(page);
  await page.goto("/invitations");
  await expect(page.getByText(/Chưa có thông tin hộ gia đình nào/)).toBeVisible();
  await page.getByLabel(/Mã lời mời/).fill(rawInvitationToken);
  await page.getByRole("button", { name: "Chấp nhận" }).click();
  await expect(page.locator(".status-with-icon")).toContainText("Đã chấp nhận");
  await expect(page.locator("body")).not.toContainText(rawInvitationToken);
  expect(await browserPersistence(page)).not.toContain(rawInvitationToken);
});

test("LB-010 limits context to two safe labels and preserves atomic confirmed state", async ({
  page,
}) => {
  await syntheticHouseholdApi(page);
  await page.goto("/households/household_synthetic/recipient-context");
  await expect(page.getByText("Chưa có bối cảnh tối thiểu được xác nhận.")).toBeVisible();
  await page.getByLabel(/Tên hiển thị an toàn/).fill("Ông An");
  await page.getByLabel(/Nhãn mối quan hệ trung tính/).fill("Người thân");
  await page.getByRole("button", { name: "Lưu bối cảnh" }).click();
  await expect(page.getByRole("heading", { name: "Bối cảnh đã xác nhận" })).toBeVisible();
  await expect(page.getByText("Ông An")).toBeVisible();
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/chẩn đoán|thuốc|triệu chứng|quyền giám hộ/i);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("offline mutation is blocked and reconnect never submits it", async ({ context, page }) => {
  const api = await syntheticHouseholdApi(page);
  await page.goto("/households/new");
  await page.getByLabel(/Tên hiển thị hộ gia đình/).fill("Nhà ngoại tuyến");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Tạo hộ gia đình" }).click();
  await expect(page.locator(".status-banner.warning")).toContainText(
    "không được gửi, không được xếp hàng",
  );
  expect(api.mutations).toEqual([]);
  await context.setOffline(false);
  await page.waitForTimeout(100);
  expect(api.mutations).toEqual([]);
});

test("protected absent and inaccessible context share one generic UI outcome", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/account/session") {
      return json(route, 200, {
        csrfToken: csrf,
        preferences: { locale: "vi-VN" },
      });
    }
    return json(route, 404, undefined, {
      code: "HOUSEHOLD_NOT_FOUND",
      messageKey: "household.notFound",
    });
  });
  await page.goto("/households/protected_unknown/recipient-context");
  await expect(page.locator(".error-summary")).toContainText(
    "Tài nguyên có thể không tồn tại hoặc bạn không có quyền truy cập.",
  );
});

async function json(route: Route, status: number, data?: unknown, error?: Record<string, unknown>) {
  await route.fulfill({
    status,
    contentType: "application/json",
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
