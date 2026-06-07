/**
 * 01-create-payment-intent.spec.js
 * Tests: Creating a PaymentIntent via Stripe API
 */

const { test, expect } = require("@playwright/test");
const { allure } = require("allure-playwright");
const {
  createPaymentIntent,
  TEST_CARDS,
} = require("../../utils/stripe-api");
const { writeState } = require("../../utils/shared-state");

require("dotenv").config();

const AMOUNT = parseInt(process.env.PAYMENT_AMOUNT || "2000"); // $20.00 in cents
const CURRENCY = process.env.PAYMENT_CURRENCY || "usd";

test.describe("Payment Intent Creation", () => {
  test("should create a PaymentIntent with correct amount and currency", async () => {
    allure.feature("Payment Intent API");
    allure.story("Create Payment Intent");
    allure.severity("critical");
    allure.description(
      "Verifies that a PaymentIntent is created with the expected amount, currency, and initial status."
    );

    const intent = await createPaymentIntent({
      amount: AMOUNT,
      currency: CURRENCY,
      metadata: { test_case: "TC-001-create" },
    });

    allure.attachment(
      "PaymentIntent Response",
      JSON.stringify(intent, null, 2),
      "application/json"
    );

    // Validate response structure
    expect(intent).toBeDefined();
    expect(intent.id).toMatch(/^pi_/);
    expect(intent.object).toBe("payment_intent");

    // Validate financial fields
    expect(intent.amount).toBe(AMOUNT);
    expect(intent.currency).toBe(CURRENCY);

    // Validate initial status
    expect(intent.status).toBe("requires_payment_method");

    // Validate client secret exists
    expect(intent.client_secret).toMatch(/^pi_.*_secret_/);

    // Validate payment method types
    expect(intent.payment_method_types).toContain("card");

    // Validate metadata was persisted
    expect(intent.metadata.test_run).toBe("playwright-e2e");

    // Validate sandbox mode
    expect(intent.livemode).toBe(false);

    // Persist for subsequent tests
    writeState({
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amount: intent.amount,
      currency: intent.currency,
      createdAt: intent.created,
    });

    console.log(`✅ Created PaymentIntent: ${intent.id}`);
  });

  test("should reject PaymentIntent with zero amount", async () => {
    allure.feature("Payment Intent API");
    allure.story("Validation - Zero Amount");
    allure.severity("normal");
    allure.description("Verifies that Stripe rejects a PaymentIntent with amount 0.");

    await expect(
      createPaymentIntent({ amount: 0, currency: CURRENCY })
    ).rejects.toThrow();
  });

  test("should reject PaymentIntent with invalid currency", async () => {
    allure.feature("Payment Intent API");
    allure.story("Validation - Invalid Currency");
    allure.severity("normal");
    allure.description("Verifies that Stripe rejects a PaymentIntent with an unsupported currency.");

    await expect(
      createPaymentIntent({ amount: AMOUNT, currency: "xyz" })
    ).rejects.toThrow();
  });

  test("should reject PaymentIntent with negative amount", async () => {
    allure.feature("Payment Intent API");
    allure.story("Validation - Negative Amount");
    allure.severity("minor");
    allure.description("Verifies that Stripe rejects a PaymentIntent with a negative amount.");

    await expect(
      createPaymentIntent({ amount: -100, currency: CURRENCY })
    ).rejects.toThrow();
  });
});
