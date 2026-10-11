import { defineConfig, devices } from "@playwright/test";

// BASE_URL=https://your-deploy npx playwright test  runs the same suite against a live site.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL || "http://localhost:5174", trace: "retain-on-failure", screenshot: "only-on-failure", ...devices["Desktop Chrome"] },
});
