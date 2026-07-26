import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("VI create/assign/complete delivers exactly one useful cross-user notification and EN confirms state", async ({
  page,
}) => {
  const title = "Lên lịch gọi video gia đình";
  await page.goto("/households/hh_minh_an/tasks");
  await expect(page.getByRole("heading", { level: 1, name: "Công việc chăm sóc" })).toBeVisible();

  await page.getByLabel("Tên công việc").fill(title);
  await page
    .getByLabel("Mô tả an toàn (không bắt buộc)")
    .fill("Dữ liệu tổng hợp cho kiểm thử P1-S1");
  await page.getByLabel("Người chịu trách nhiệm").selectOption("member_minh");
  await page.getByLabel("Mức ưu tiên").selectOption("important");
  await page.getByRole("button", { name: "Tạo công việc" }).click();

  await expect(page.getByText("Công việc đã được lưu và xác nhận.")).toBeVisible();
  const taskCard = page.locator(".task-card").filter({ hasText: title });
  await expect(taskCard).toContainText("Minh");
  await expect(taskCard).toContainText("Đang mở");

  await page.getByLabel("Thành viên đang thao tác").selectOption("member_minh");
  await expect(taskCard.getByRole("button", { name: "Hoàn tất" })).toBeVisible();
  await taskCard.getByRole("button", { name: "Hoàn tất" }).click();
  await expect(page.getByText("Công việc đã hoàn tất.")).toBeVisible();
  await expect(taskCard).toContainText("Thông báo đã lưu bền vững", { timeout: 8_000 });

  await page.getByLabel("Thành viên đang thao tác").selectOption("member_lan");
  await page.getByRole("link", { name: "Thông báo" }).click();
  const notificationItems = page.locator(".notification-list li");
  await expect(notificationItems).toHaveCount(1);
  await expect(notificationItems.first()).toContainText(
    "Người được giao đã hoàn tất một công việc.",
  );
  await notificationItems.first().getByRole("link", { name: "Mở công việc nguồn" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.locator(".detail-card .status-with-icon")).toContainText("Đã hoàn tất");

  await page.getByLabel("Ngôn ngữ").selectOption("en");
  await expect(page.getByRole("heading", { level: 1, name: "View details" })).toBeVisible();
  await expect(page.locator(".detail-card .status-with-icon")).toContainText("Completed");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("keyboard validation focus, 320px reflow, and automated accessibility checks pass", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/households/hh_minh_an/tasks");
  await expect(page.getByRole("heading", { level: 1, name: "Công việc chăm sóc" })).toBeVisible();

  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.removeAttribute("tabindex");
  });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Bỏ qua đến nội dung chính" })).toBeFocused();
  await page.getByRole("link", { name: "Bỏ qua đến nội dung chính" }).press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  await page.getByRole("button", { name: "Tạo công việc" }).click();
  const summary = page.locator(".error-summary");
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Vui lòng sửa các trường sau");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("offline mutation is blocked without clearing entered data", async ({ context, page }) => {
  await page.goto("/households/hh_minh_an/tasks");
  await page.getByLabel("Tên công việc").fill("Bản nháp ngoại tuyến");
  await context.setOffline(true);

  await expect(page.getByRole("status").filter({ hasText: "Đang ngoại tuyến" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tạo công việc" })).toBeDisabled();
  await expect(page.getByLabel("Tên công việc")).toHaveValue("Bản nháp ngoại tuyến");
  await context.setOffline(false);
});

test("dashboard exposes Notification degradation without fabricating an empty success", async ({
  page,
}) => {
  await page.route("**/api/v1/households/hh_minh_an/dashboard", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          openCount: 0,
          completedCount: 1,
          nextTasks: [],
          lastConfirmedAt: "2026-08-03T02:05:00.000Z",
          taskSourceFreshness: "current",
          notificationDependency: "degraded",
          notifications: null,
        },
        meta: { correlationId: "corr_browser_degraded" },
      }),
    });
  });
  await page.goto("/households/hh_minh_an");

  const alert = page.locator(".status-banner.danger");
  await expect(alert).toContainText("dịch vụ thông báo đang không khả dụng");
  await expect(alert).toContainText("Không có trạng thái giao giả");
});
