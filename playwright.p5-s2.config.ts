import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["p5-s2.spec.ts", "p5-s2-runtime.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: process.env.P5_S2_PLAYWRIGHT_OUTPUT_DIR ?? ".lifebridge-local/p5-s2-playwright-output",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    timezoneId: "Asia/Bangkok",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
  ],
});
