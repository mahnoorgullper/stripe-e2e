/**
 * 06-dashboard-gui.spec.js
 * Tests: Stripe Dashboard GUI validation
 *
 * Session is pre-loaded from .auth/stripe-dashboard.json (saved by scripts/auth.setup.js).
 * Run `npm run auth:setup` once to log in manually and save the session.
 * These tests then run without a login step — bypassing CAPTCHA.
 */

const { test, expect } = require("@playwright/test");
const { allure } = require("allure-playwright");
const { readState } = require("../../utils/shared-state");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

const DASHBOARD_URL = "https://dashboard.stripe.com";
const AMOUNT_DISPLAY = "$20.00"; 
const AUTH_FILE = path.join(__dirname, "../../.auth/stripe-dashboard.json");

// Helper: navigate to the test mode payments list
async function goToPaymentsList(page) {
  await page.goto(`${DASHBOARD_URL}/test/payments`, { waitUntil: "load" });
}

// Helper: ensure we're on the test-mode dashboard (session may redirect to live mode)
async function ensureTestMode(page) {
  if (!page.url().includes("/test/")) {
    await page.goto(`${DASHBOARD_URL}/test/dashboard`, { waitUntil: "load" });
  }
}

test.describe("Stripe Dashboard GUI Validation", () => {
  test.beforeEach(async ({ page }) => {
    // Skip if auth session file doesn't exist
    if (!fs.existsSync(AUTH_FILE)) {
      test.skip(true, "Auth session not found — run `npm run auth:setup` first to log in and save session");
      return;
    }
    // Confirm we're authenticated by landing on the test dashboard
    await page.goto(`${DASHBOARD_URL}/test/dashboard`, { waitUntil: "load" });
    // If redirected back to login, session expired — skip
    if (page.url().includes("/login")) {
      test.skip(true, "Session expired — run `npm run auth:setup` again to refresh");
    }
  });

  test("should log into Stripe Dashboard in test mode", async ({ page }) => {
    allure.feature("Dashboard GUI");
    allure.story("Login");
    allure.severity("critical");
    allure.description("Verifies that the saved session is authenticated and shows the test mode dashboard.");

    await ensureTestMode(page);

    // Verify we're in test mode — Stripe shows a "Test mode" banner
    const testModeBadge = page.getByText(/test mode/i).first();
    await expect(testModeBadge).toBeVisible({ timeout: 15_000 });

    allure.attachment("Dashboard After Login", await page.screenshot(), "image/png");
    console.log("Authenticated on Stripe Dashboard (test mode)");
  });

  test("should find the payment in the Payments list with correct amount", async ({ page }) => {
    allure.feature("Dashboard GUI");
    allure.story("Payment Appears in List");
    allure.severity("critical");
    allure.description(
      "Navigates to the test mode Payments list and verifies the payment created in the API tests appears with the correct amount."
    );

    const state = readState();
    expect(state.paymentIntentId, "paymentIntentId not found — run API tests first").toBeTruthy();

    await goToPaymentsList(page);

    // Search for the specific payment by intent ID using Stripe's search
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await searchInput.fill(state.paymentIntentId);
      await page.keyboard.press("Enter");
      await page.waitForLoadState("load");
    }

    // Wait for payments table to render
    await page.waitForSelector("table, [data-testid='payments-table'], .Box-root", {
      timeout: 15_000,
    });

    allure.attachment("Payments List", await page.screenshot(), "image/png");

    // Look for our payment — either by payment intent ID suffix or amount
    const paymentRow = page
      .locator("tr, [data-testid*='payment'], .TableBodyRow-root")
      .filter({ hasText: state.paymentIntentId.slice(-8) })
      .or(
        page
          .locator("tr, [data-testid*='payment'], .TableBodyRow-root")
          .filter({ hasText: AMOUNT_DISPLAY })
          .first()
      );

    await expect(paymentRow).toBeVisible({ timeout: 10_000 });
    console.log(`Payment found in Payments list`);
  });

  test("should show payment status as Succeeded on detail page", async ({ page }) => {
    allure.feature("Dashboard GUI");
    allure.story("Payment Status Verification");
    allure.severity("critical");
    allure.description(
      "Opens the payment detail page for the test PaymentIntent and verifies the status shows 'Succeeded'."
    );

    const state = readState();
    expect(state.paymentIntentId, "PaymentIntent ID not found in shared state").toBeTruthy();

    await page.goto(
      `${DASHBOARD_URL}/test/payments/${state.paymentIntentId}`,
      { waitUntil: "load" }
    );

    // The page title / status badge should show "Succeeded"
    const succeededBadge = page.getByText(/succeeded/i).first();
    await expect(succeededBadge).toBeVisible({ timeout: 20_000 });

    // Verify the amount is displayed
    const amountText = page.getByText(AMOUNT_DISPLAY).first();
    await expect(amountText).toBeVisible({ timeout: 10_000 });

    allure.attachment("Payment Detail Page", await page.screenshot(), "image/png");
    console.log("Payment detail page shows status: Succeeded");
  });

  test("should display the refund on the payment detail page", async ({ page }) => {
    allure.feature("Dashboard GUI");
    allure.story("Refund Visible on Detail Page");
    allure.severity("high");
    allure.description(
      "Opens the payment detail page and verifies the refund section shows the correct amount and 'Refunded' status."
    );

    const state = readState();
    expect(state.paymentIntentId, "PaymentIntent ID not found in shared state").toBeTruthy();
    expect(state.refundId, "Refund ID not found — run API refund tests first").toBeTruthy();

    await page.goto(
      `${DASHBOARD_URL}/test/payments/${state.paymentIntentId}`,
      { waitUntil: "load" }
    );

    const refundedText = page.getByText(/refunded/i).first();
    await expect(refundedText).toBeVisible({ timeout: 20_000 });

    const refundAmountText = page.getByText(AMOUNT_DISPLAY);
    await expect(refundAmountText.first()).toBeVisible({ timeout: 10_000 });

    allure.attachment("Payment Detail - Refund Visible", await page.screenshot(), "image/png");
    console.log("Refund is visible on the payment detail page");
  });

  test("should show the correct payment amount in the Payments overview", async ({ page }) => {
    allure.feature("Dashboard GUI");
    allure.story("Amount Display");
    allure.severity("normal");
    allure.description(
      "Verifies the payment amount ($20.00) is correctly formatted and displayed on the payment overview page."
    );

    const state = readState();
    expect(state.paymentIntentId, "PaymentIntent ID not found in shared state").toBeTruthy();

    await page.goto(
      `${DASHBOARD_URL}/test/payments/${state.paymentIntentId}`,
      { waitUntil: "load" }
    );

    // Check the amount is displayed as $20.00 (2000 cents in USD)
    await expect(page.getByText("$20.00").first()).toBeVisible({ timeout: 10_000 });

    // Verify currency display
    const usdText = page.getByText(/USD/i).first();
    await expect(usdText).toBeVisible({ timeout: 10_000 });

    allure.attachment("Amount Verification", await page.screenshot(), "image/png");
    console.log(" Correct amount ($20.00 USD) displayed on Stripe Dashboard");
  });
});
