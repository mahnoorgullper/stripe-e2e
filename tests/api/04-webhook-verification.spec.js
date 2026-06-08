/**
 * 04-webhook-verification.spec.js
 * Tests: Webhook signature verification using HMAC-SHA256
 */

const { test, expect } = require("@playwright/test");
const { allure } = require("allure-playwright");
const crypto = require("crypto");
const { stripe, buildWebhookPayload, constructWebhookEvent } = require("../../utils/stripe-api");
const { readState } = require("../../utils/shared-state");

require("dotenv").config();

function buildStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

test.describe("Webhook Event Verification", () => {
  test("should construct and verify a payment_intent.succeeded webhook", async () => {
    allure.feature("Webhook Verification");
    allure.story("Valid Webhook Signature");
    allure.severity("critical");
    allure.description(
      "Simulates a payment_intent.succeeded webhook event, signs it with the webhook secret, and verifies it using Stripe's constructEvent method."
    );

    const state = readState();
    expect(state.paymentIntentId, "PaymentIntent ID not found in shared state").toBeTruthy();

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    expect(webhookSecret, "STRIPE_WEBHOOK_SECRET is not set").toBeTruthy();

    // Build a fake PaymentIntent payload
    const fakeIntent = { id: state.paymentIntentId, object: "payment_intent", status: "succeeded" };
    const webhookPayload = buildWebhookPayload("payment_intent.succeeded", fakeIntent);
    const payloadString = JSON.stringify(webhookPayload);

    const signature = buildStripeSignature(payloadString, webhookSecret);

    const event = await constructWebhookEvent(payloadString, signature);

    allure.attachment("Verified Webhook Event", JSON.stringify(event, null, 2), "application/json");

    expect(event.type).toBe("payment_intent.succeeded");
    expect(event.data.object.id).toBe(state.paymentIntentId);
    expect(event.livemode).toBe(false);

    console.log(`Webhook event verified: ${event.type} for ${event.data.object.id}`);
  });

  test("should reject webhook with invalid signature", async () => {
    allure.feature("Webhook Verification");
    allure.story("Invalid Webhook Signature");
    allure.severity("critical");
    allure.description(
      "Attempts to construct a webhook event with a tampered/invalid signature and verifies that Stripe throws a StripeSignatureVerificationError."
    );

    const fakeIntent = { id: "pi_fake_test", object: "payment_intent", status: "succeeded" };
    const webhookPayload = buildWebhookPayload("payment_intent.succeeded", fakeIntent);
    const payloadString = JSON.stringify(webhookPayload);
    const invalidSignature = "t=1234567890,v1=invalidsignaturethatdoesnotmatch";

    await expect(
      constructWebhookEvent(payloadString, invalidSignature)
    ).rejects.toThrow();

    console.log("Invalid webhook signature correctly rejected");
  });

  test("should simulate webhook for charge.refunded event structure", async () => {
    allure.feature("Webhook Verification");
    allure.story("Charge Refunded Event");
    allure.severity("normal");
    allure.description(
      "Builds and verifies a charge.refunded webhook event, checking that the event structure matches Stripe's expected format."
    );

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    expect(webhookSecret, "STRIPE_WEBHOOK_SECRET is not set").toBeTruthy();

    const fakeCharge = {
      id: "ch_test_refunded",
      object: "charge",
      amount: 2000,
      currency: "usd",
      refunded: true,
      amount_refunded: 2000,
    };

    const webhookPayload = buildWebhookPayload("charge.refunded", fakeCharge);
    const payloadString = JSON.stringify(webhookPayload);
    const signature = buildStripeSignature(payloadString, webhookSecret);

    const event = await constructWebhookEvent(payloadString, signature);

    expect(event.type).toBe("charge.refunded");
    expect(event.data.object.refunded).toBe(true);
    expect(event.data.object.amount_refunded).toBe(2000);

    console.log("charge.refunded event structure validated");
  });
});
