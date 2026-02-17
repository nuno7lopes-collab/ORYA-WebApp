import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.UI_E2E_BASE_URL || "http://127.0.0.1:33123").replace(/\/+$/, "");

export default defineConfig({
  testDir: "tests/ui/web",
  testMatch: "**/*.pw.mjs",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 240_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalSetup: "tests/ui/web/global.setup.mjs",
  webServer: {
    command: "node scripts/start-ui-e2e-server.mjs",
    reuseExistingServer: false,
    timeout: 240_000,
    url: baseURL,
  },
});
