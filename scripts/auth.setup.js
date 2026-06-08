/**
 * auth.setup.js
 * Opens Chrome with your real profile (already logged into Stripe),
 * then saves the session to .auth/stripe-dashboard.json for GUI tests.
 * Run via: npm run auth:setup
 */

const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

const AUTH_FILE = path.join(__dirname, "../.auth/stripe-dashboard.json");
const AUTH_DIR = path.dirname(AUTH_FILE);
const DASHBOARD_URL = "https://dashboard.stripe.com";

const CHROME_PROFILE = (() => {
  const home = os.homedir();
  if (os.platform() === "darwin")
    return path.join(home, "Library/Application Support/Google/Chrome");
  if (os.platform() === "win32")
    return path.join(home, "AppData/Local/Google/Chrome/User Data");
  return path.join(home, ".config/google-chrome");
})();

function isChromeRunning() {
  try {
    const out = execSync('pgrep -x "Google Chrome"', { encoding: "utf8" });
    return out.trim().length > 0;
  } catch {
    return false; // pgrep exits non-zero when no match found
  }
}

(async () => {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  console.log("\nStripe Dashboard Auth Setup");
  console.log("============================\n");

  if (isChromeRunning()) {
    console.error("Chrome is still open.");
    console.error("Please quit Chrome fully: press Cmd+Q (not just close the window).");
    console.error("Then run this script again.\n");
    process.exit(1);
  }

  if (!fs.existsSync(CHROME_PROFILE)) {
    console.error(`Chrome profile not found at: ${CHROME_PROFILE}`);
    process.exit(1);
  }

  console.log("Opening Chrome with your real profile...");
  console.log("(Since you are already logged into Stripe in Chrome, it will open the dashboard directly)\n");

  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    channel: "chrome",
    headless: false,
    ignoreDefaultArgs: ["--no-sandbox"],
  });

  // Open a new tab and navigate to Stripe
  const page = await context.newPage();

  console.log("Navigating to Stripe Dashboard...");
  try {
    await page.goto(`${DASHBOARD_URL}/test/dashboard`, { waitUntil: "load", timeout: 30_000 });
  } catch {
    // Navigation timeout is OK — just check the current URL below
  }

  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);

  // If not on dashboard yet, wait for manual login
  if (!currentUrl.includes("dashboard.stripe.com") || currentUrl.includes("/login")) {
    console.log("\nNot logged in yet — please log in manually in the browser.");
    console.log("Waiting up to 3 minutes...\n");
    await page.waitForURL(
      (url) => url.toString().includes("dashboard.stripe.com") && !url.toString().includes("/login"),
      { timeout: 180_000 }
    );
  }

  console.log("Logged in — saving session...");
  await context.storageState({ path: AUTH_FILE });
  await context.close();

  console.log(`Session saved to: ${AUTH_FILE}`);
  console.log("You can now run: npm run test:gui\n");
})();
