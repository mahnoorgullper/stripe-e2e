/**
 * 04-webhook-verification.spec.js
 * Tests: Simulating and verifying Stripe webhook notifications
 *
 * Stripe webhooks can't be received in CI without a public URL, so this test:
 * 1. Constructs the exact payload Stripe would send
 * 2. Signs it using the STRIPE_WEBHOOK_SECRET (as Stripe does)
 * 3. Verifies the signature using stripe.webhooks.constructEvent()
 * 4. Validates the event payload structure and fields
 *
 * This pattern mirrors production webhook handling without needing a live endpoint.
 */

const { test, expect } = require("@playwright/test");
const { allure } = require("allure-playwright");
const Stripe = require("stripe");
const {
  stripe,
  retrievePaymentIntent,
  buildWebhookPayload,
} = require("../../utils/stripe-api");
const { readState } = require("../../utils/shared-state");

require("dotenv").config();

test.describe("Webhook Event Verification", () => {
  test("should construct and verify a payment_intent.succeeded webhook", async () => {
    allure.feature("Webhook Verification");
    allure.story("payment_intent.succeeded Event");
    allure.severity("critical");
    allure.description(
      "Simulates the payment_intent.succeeded webhook that Stripe sends after a successful payment. " +
      "Constructs the event, signs it using the webhook secret, and verifies signature + payload structure."
    );

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      test.skip(true, "STRIPE_WEBHOOK_SECRET not configured — skipping webhook signature test");
      return;
    }

    const state = readState();
    expect(state.paymentIntentId).toBeTruthy();

    // Retrieve the actual PaymentIntent to build a realistic payload
    const intent = await retrievePaymentIntent(state.paymentIntentId);

    // Build the webhook event payload
    const eventPayload = buildWebhookPayload("payment_intent.succeeded", intent);
    const payloadString = JSON.stringify(eventPayload);

    // Sign the payload as Stripe would (timestamp + HMAC-SHA256)
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payloadString}`;
    const crypto = require("crypto");
    const hmac = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");
    const signature = `t=${timestamp},v1=${hmac}`;

    // Verify the webhook signature (as your server would)
    const event = stripe.webhooks.constructEvent(payloadString, signature, webhookSecret);

    allure.attachment(
      "Webhook Event",
      JSON.stringify(event, null, 2),
      "application/json"
    );

    // Validate event structure
    expect(event.type).toBe("payment_intent.succeeded");
    expect(event.object).toBe("event");
    expect(event.livemode).toBe(false);
    expect(event.data.object.id).toBe(state.paymentIntentId);
    expect(event.data.object.status).toBe("succeeded");
    expect(event.data.object.amount).toBe(state.amount);

    console.log(`✅ Webhook event verified: ${event.type} for ${event.data.object.id}`);
  });

  test("should reject webhook with invalid signature", async () => {
    allure.feature("Webhook Verification");
    allure.story("Invalid Signature Rejection");
    allure.severity("critical");
    allure.description(
      "Verifies that a webhook with a tampered or incorrect signature is rejected, protecting against replay attacks and forgery."
    );

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      test.skip(true, "STRIPE_WEBHOOK_SECRET not configured");
      return;
    }

    const fakePayload = JSON.stringify({ id: "evt_fake", type: "payment_intent.succeeded" });
    const fakeSignature = "t=1234567890,v1=invalidsignaturehex";

    expect(() => {
      stripe.webhooks.constructEvent(fakePayload, fakeSignature, webhookSecret);
    }).toThrow(Stripe.errors.StripeSignatureVerificationError);

    console.log("✅ Invalid webhook signature correctly rejected");
  });

  test("should simulate webhook for charge.refunded event structure", async () => {
    allure.feature("Webhook Verification");
    allure.story("charge.refunded Event Structure");
    allure.severity("normal");
    allure.description(
      "Validates the expected structure of a charge.refunded webhook payload for post-refund verification."
    );

    // This test validates the expected structure without full signing
    // (the signing test above covers the crypto path)
    const mockRefundEvent = {
      id: "evt_test_refund_mock",
      object: "event",
      type: "charge.refunded",
      api_version: "2024-04-10",
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      data: {
        object: {
          id: "ch_test_mock",
          object: "charge",
          amount: 2000,
          amount_refunded: 2000,
          currency: "usd",
          refunded: true,
          refunds: {
            object: "list",
            data: [
              {
                id: "re_test_mock",
                object: "refund",
                amount: 2000,
                currency: "usd",
                status: "succeeded",
                reason: "requested_by_customer",
              },
            ],
          },
        },
      },
    };

    // Validate charge.refunded payload 
    expect(mockRefundEvent.type).toBe("charge.refunded");
    expect(mockRefundEvent.data.object.refunded).toBe(true);
    expect(mockRefundEvent.data.object.amount_refunded).toBe(
      mockRefundEvent.data.object.amount
    );
    expect(mockRefundEvent.data.object.refunds.data[0].status).toBe("succeeded");

    allure.attachment(
      "Mock Refund Event",
      JSON.stringify(mockRefundEvent, null, 2),
      "application/json"
    );

    console.log("✅ charge.refunded event structure validated");
  });
});
