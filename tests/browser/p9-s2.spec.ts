import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function mockTaskBoard(page: Page) {
  await page.route("**/api/v1/households/hh_minh_an/tasks", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [] }) });
      return;
    }
    await route.abort("failed");
  });
  await page.route("**/api/v1/households/hh_minh_an/members", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            memberId: "member_lan",
            householdId: "hh_minh_an",
            displayNameKey: "lan",
            role: "caregiver",
            active: true,
          },
          {
            memberId: "member_minh",
            householdId: "hh_minh_an",
            displayNameKey: "minh",
            role: "member",
            active: true,
          },
        ],
      }),
    });
  });
}

test("held offline task intent is truthful, explicit, cancellable and never auto-submitted", async ({
  context,
  page,
}) => {
  await mockTaskBoard(page);
  let posts = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/tasks")) posts += 1;
  });
  await page.goto("/households/hh_minh_an/tasks");
  await page.getByLabel("Tên công việc").fill("Yêu cầu tổng hợp ngoại tuyến");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Giữ trong tab này" }).click();

  const queued = page.locator(".truthful-state-queued");
  await expect(queued).toContainText("chưa gửi và chưa lưu trên máy chủ");
  await expect(queued).toContainText("Hết hạn");
  expect(posts).toBe(0);

  await context.setOffline(false);
  await expect(queued).toContainText("không tự động gửi lại");
  expect(posts).toBe(0);
  await queued.getByRole("button", { name: "Hủy yêu cầu đang giữ" }).click();
  await expect(queued).toHaveCount(0);
});

test("held intent is purged on actor change and reflows with long bilingual copy", async ({
  context,
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await mockTaskBoard(page);
  await page.goto("/households/hh_minh_an/tasks");
  await page
    .getByLabel("Tên công việc")
    .fill("Nội dung dài dùng để kiểm tra trạng thái ngoại tuyến");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Giữ trong tab này" }).click();
  await page.getByLabel("Thành viên đang thao tác").selectOption("member_minh");
  await expect(page.locator(".truthful-state-queued")).toHaveCount(0);
  await context.setOffline(false);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
