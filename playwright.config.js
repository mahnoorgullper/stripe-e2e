// @ts-check
const { defineConfig, devices } = require("@playwright/test");
require("dotenv").config();

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // Sequential — API tests must complete before GUI
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    [process.env.CI ? "github" : "line"],
    [
      "allure-playwright",
      {
        detail: true,
        outputFolder: "allure-results",
        suiteTitle: true,
        environmentInfo: {
          framework: "Playwright",
          language: "JavaScript",
          environment: "Stripe Sandbox",
          node_version: process.version,
        },
      },
    ],
  ],
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "api-tests",
      testMatch: "tests/api/**/*.spec.js",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "gui-tests",
      testMatch: "tests/gui/**/*.spec.js",
      dependencies: ["api-tests"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        // Reuse saved session from auth.setup.js — avoids CAPTCHA on every run
        storageState: ".auth/stripe-dashboard.json",
      },
    },
  ],
});
