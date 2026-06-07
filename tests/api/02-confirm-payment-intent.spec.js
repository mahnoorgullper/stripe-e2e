/**
 * 02-confirm-payment-intent.spec.js
 * Tests: Confirming the PaymentIntent with test card numbers
 */

const { test, expect } = require("@playwright/test");
const { allure } = require("allure-playwright");
const {
  createPaymentIntent,
  confirmPaymentIntent,
  retrievePaymentIntent,
  TEST_CARDS,
} = require("../../utils/stripe-api");
const { readState, writeState } = require("../../utils/shared-state");

require("dotenv").config();

const AMOUNT = parseInt(process.env.PAYMENT_AMOUNT || "2000");
const CURRENCY = process.env.PAYMENT_CURRENCY || "usd";

test.describe("Payment Intent Confirmation", () => {
  test("should confirm PaymentIntent with a successful Visa test card", async () => {
    allure.feature("Payment Confirmation");
    allure.story("Confirm with Valid Card");
    allure.severity("critical");
    allure.description(
      "Confirms the PaymentIntent created in the previous step using Stripe's test Visa card (4242 4242 4242 4242). Expects status to become 'succeeded'."
    );

    const state = readState();
    expect(state.paymentIntentId, "PaymentIntent ID not found in shared state").toBeTruthy();

    const confirmed = await confirmPaymentIntent(
      state.paymentIntentId,
      TEST_CARDS.visa_success
    );

    allure.attachment(
      "Confirmed PaymentIntent",
      JSON.stringify(confirmed, null, 2),
      "application/json"
    );

    expect(confirmed.id).toBe(state.paymentIntentId);
    expect(confirmed.status).toBe("succeeded");
    expect(confirmed.amount_received).toBe(state.amount);

    // Persist charge ID for refund test
    writeState({
      chargeId: confirmed.latest_charge,
      confirmedAt: Date.now(),
    });

    console.log(`✅ Confirmed PaymentIntent: ${confirmed.id} → status: ${confirmed.status}`);
    console.log(`   Charge ID: ${confirmed.latest_charge}`);
  });

  test("should decline PaymentIntent with a declined test card", async () => {
    allure.feature("Payment Confirmation");
    allure.story("Confirm with Declined Card");
    allure.severity("normal");
    allure.description(
      "Attempts to confirm a new PaymentIntent using Stripe's generic decline test card (4000 0000 0000 0002). Expects the API to throw a card_declined error."
    );

    const intent = await createPaymentIntent({
      amount: AMOUNT,
      currency: CURRENCY,
      metadata: { test_case: "TC-002-decline" },
    });

    await expect(
      confirmPaymentIntent(intent.id, TEST_CARDS.visa_decline)
    ).rejects.toMatchObject({
      type: "StripeCardError",
      code: "card_declined",
    });

    console.log("✅ Card decline handled correctly");
  });

  test("should fail with insufficient funds test card", async () => {
    allure.feature("Payment Confirmation");
    allure.story("Confirm with Insufficient Funds");
    allure.severity("normal");
    allure.description(
      "Confirms a PaymentIntent with an insufficient funds test card. Expects a card_declined error with insufficient_funds decline code."
    );

    const intent = await createPaymentIntent({
      amount: AMOUNT,
      currency: CURRENCY,
      metadata: { test_case: "TC-002-insufficient" },
    });

    try {
      await confirmPaymentIntent(intent.id, TEST_CARDS.visa_insufficient);
      throw new Error("Expected card to be declined");
    } catch (err) {
      expect(err.type).toBe("StripeCardError");
      expect(err.decline_code).toBe("insufficient_funds");
      allure.attachment("Expected Error", JSON.stringify({
        type: err.type,
        code: err.code,
        decline_code: err.decline_code,
        message: err.message,
      }, null, 2), "application/json");
    }
  });
});
