/**
 * 03-retrieve-payment-status.spec.js
 * Tests: Retrieving and verifying the PaymentIntent status after confirmation
 */

const { test, expect } = require("@playwright/test");
const { allure } = require("allure-playwright");
const {
  retrievePaymentIntent,
  retrieveCharge,
} = require("../../utils/stripe-api");
const { readState } = require("../../utils/shared-state");

require("dotenv").config();

const AMOUNT = parseInt(process.env.PAYMENT_AMOUNT || "2000");
const CURRENCY = process.env.PAYMENT_CURRENCY || "usd";

test.describe("Payment Status Retrieval", () => {
  test("should retrieve PaymentIntent with status 'succeeded'", async () => {
    allure.feature("Payment Status");
    allure.story("Retrieve Confirmed Intent");
    allure.severity("critical");
    allure.description(
      "Retrieves the PaymentIntent by ID and verifies status, amount, and currency match expected values after confirmation."
    );

    const state = readState();
    expect(state.paymentIntentId).toBeTruthy();
    expect(state.chargeId).toBeTruthy();

    const intent = await retrievePaymentIntent(state.paymentIntentId);

    allure.attachment(
      "Retrieved PaymentIntent",
      JSON.stringify(intent, null, 2),
      "application/json"
    );

    // Status verification
    expect(intent.status).toBe("succeeded");

    // Financial verification
    expect(intent.amount).toBe(AMOUNT);
    expect(intent.currency).toBe(CURRENCY);
    expect(intent.amount_received).toBe(AMOUNT);

    // Charge linkage
    expect(intent.latest_charge).toBe(state.chargeId);

    console.log(`✅ PaymentIntent ${intent.id} has status: ${intent.status}`);
  });

  test("should retrieve the underlying Charge with correct details", async () => {
    allure.feature("Payment Status");
    allure.story("Retrieve Charge");
    allure.severity("high");
    allure.description(
      "Retrieves the Charge object linked to the PaymentIntent and verifies amount, status, and payment method details."
    );

    const state = readState();
    expect(state.chargeId).toBeTruthy();

    const charge = await retrieveCharge(state.chargeId);

    allure.attachment(
      "Retrieved Charge",
      JSON.stringify(charge, null, 2),
      "application/json"
    );

    // Charge status
    expect(charge.status).toBe("succeeded");
    expect(charge.paid).toBe(true);
    expect(charge.captured).toBe(true);

    // Financial
    expect(charge.amount).toBe(AMOUNT);
    expect(charge.currency).toBe(CURRENCY);
    expect(charge.amount_captured).toBe(AMOUNT);
    expect(charge.amount_refunded).toBe(0); // No refund yet

    // Card brand
    expect(charge.payment_method_details.card.brand).toBe("visa");
    expect(charge.payment_method_details.card.last4).toBe("4242");

    console.log(`✅ Charge ${charge.id}: paid=${charge.paid}, captured=${charge.captured}`);
  });

  test("should return 404 for a non-existent PaymentIntent", async () => {
    allure.feature("Payment Status");
    allure.story("Retrieve Non-existent Intent");
    allure.severity("minor");
    allure.description(
      "Verifies that retrieving a made-up PaymentIntent ID returns the correct error response."
    );

    await expect(
      retrievePaymentIntent("pi_nonexistent_fakeid_00000")
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("should have correct metadata on PaymentIntent", async () => {
    allure.feature("Payment Status");
    allure.story("Metadata Persistence");
    allure.severity("normal");
    allure.description(
      "Verifies that metadata set during PaymentIntent creation is correctly stored and retrievable."
    );

    const state = readState();
    expect(state.paymentIntentId, "PaymentIntent ID not found in shared state").toBeTruthy();
    const intent = await retrievePaymentIntent(state.paymentIntentId);

    expect(intent.metadata).toBeDefined();
    expect(intent.metadata.test_run).toBe("playwright-e2e");
  });
});
