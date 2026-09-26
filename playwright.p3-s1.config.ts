import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["p3-s1.spec.ts", "p3-s1-runtime.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: process.env.P3_PLAYWRIGHT_OUTPUT_DIR ?? ".lifebridge-local/p3-s1-playwright-output",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    timezoneId: "America/New_York",
    trace: "off",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
  },
});
