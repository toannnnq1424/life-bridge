import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "p5-s3.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  webServer: {
    command: `${process.platform === "win32" ? "pnpm.cmd" : "pnpm"} --filter @lifebridge/web exec next dev --hostname 127.0.0.1 --port 3100`,
    url: "http://127.0.0.1:3100/admin/moderation",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
