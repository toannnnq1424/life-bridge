import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: ["p2-s2.spec.ts", "p2-s2-runtime.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "off",
    screenshot: "off",
    video: "off",
    ...devices["Desktop Chrome"],
  },
});
