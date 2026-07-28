import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["p4-s3.spec.ts", "p4-s3-runtime.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: process.env.P4_S3_PLAYWRIGHT_OUTPUT_DIR ?? ".lifebridge-local/p4-s3-playwright-output",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    timezoneId: "Asia/Bangkok",
    trace: "off",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
  },
});
