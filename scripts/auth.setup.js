/**
 * auth.setup.js
 * One-time interactive login to save authenticated session cookies.
 * Run via: npm run auth:setup
 *
 * A browser window opens — log in manually (including any CAPTCHA).
 * Once the dashboard loads, the script saves your cookies to .auth/stripe-dashboard.json.
 * All GUI tests then reuse this session without logging in again.
 */

const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const AUTH_FILE = path.join(__dirname, "../.auth/stripe-dashboard.json");
const DASHBOARD_URL = "https://dashboard.stripe.com";

(async () => {
  console.log("\n🔐 Stripe Dashboard Auth Setup");
  console.log("================================");
  console.log("A browser window will open. Log in manually (complete CAPTCHA if shown).");
  console.log("The script will automatically save your session once you reach the dashboard.\n");

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${DASHBOARD_URL}/login`);

  console.log("⏳ Waiting for you to log in... (you have 3 minutes)\n");

  // Wait until the user has logged in and landed somewhere other than /login
  await page.waitForURL(
    (url) => !url.toString().includes("/login"),
    { timeout: 180_000 }
  );

  // Navigate to test mode dashboard to confirm authenticated state
  await page.goto(`${DASHBOARD_URL}/test/dashboard`, { waitUntil: "load" });
  console.log("✅ Login detected — saving session cookies...");

  // Save the session state (cookies + localStorage)
  await context.storageState({ path: AUTH_FILE });

  await browser.close();
  console.log(`✅ Session saved to: ${AUTH_FILE}`);
  console.log("   You can now run: npm test\n");
})();
