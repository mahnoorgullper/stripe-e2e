/**
 * stripe-api.js
 * Thin wrapper around the Stripe Node SDK for use in tests.
 */

require("dotenv").config();
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  telemetry: false,
});

// Stripe predefined test Payment Method IDs — no raw card numbers needed.
// These work on all accounts without any special permissions.
const TEST_CARDS = {
  visa_success:      "pm_card_visa",
  visa_decline:      "pm_card_visa_chargeDeclined",
  visa_insufficient: "pm_card_chargeDeclinedInsufficientFunds",
  three_d_secure:    "pm_card_threeDSecure2Required",
  auth_required:     "pm_card_authenticationRequired",
};

/**
 * Create a PaymentIntent via Stripe API
 */
async function createPaymentIntent({ amount, currency, metadata = {} }) {
  return stripe.paymentIntents.create({
    amount,
    currency,
    payment_method_types: ["card"],
    metadata: {
      test_run: "playwright-e2e",
    },
  });
}

/**
 * Confirm a PaymentIntent using a Stripe test Payment Method ID.
 * Uses predefined pm_card_* IDs — no raw card numbers required.
 */
async function confirmPaymentIntent(paymentIntentId, paymentMethodId = TEST_CARDS.visa_success) {
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
    return_url: "https://example.com/return",
  });
}

/**
 * Retrieve a PaymentIntent by ID
 */
async function retrievePaymentIntent(paymentIntentId) {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Issue a full or partial refund on a PaymentIntent.
 * Pass options.amount (in cents) for a partial refund; omit for a full refund.
 */
async function refundPaymentIntent(paymentIntentId, options = {}) {
  const intent = await retrievePaymentIntent(paymentIntentId);
  const chargeId = intent.latest_charge;

  const params = {
    charge: chargeId,
    reason: options.reason || "requested_by_customer",
    metadata: {
      test_run: "playwright-e2e",
      ...options.metadata,
    },
  };

  if (options.amount) {
    params.amount = options.amount;
  }

  return stripe.refunds.create(params);
}

/**
 * Retrieve all refunds for a charge
 */
async function listRefundsForCharge(chargeId) {
  return stripe.refunds.list({ charge: chargeId });
}

/**
 * Retrieve a charge by ID
 */
async function retrieveCharge(chargeId) {
  return stripe.charges.retrieve(chargeId);
}

/**
 * Simulate a webhook event using Stripe CLI approach.
 * In CI, we construct the event payload manually and verify signature.
 */
async function constructWebhookEvent(payload, signature) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Simulate a webhook payload for a given PaymentIntent (for testing purposes)
 * This mimics what Stripe sends to a webhook endpoint.
 */
function buildWebhookPayload(eventType, paymentIntent) {
  return {
    id: `evt_test_${Date.now()}`,
    object: "event",
    type: eventType,
    api_version: "2024-04-10",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    data: {
      object: paymentIntent,
    },
    request: {
      id: null,
      idempotency_key: null,
    },
  };
}

module.exports = {
  stripe,
  TEST_CARDS,
  createPaymentIntent,
  confirmPaymentIntent,
  retrievePaymentIntent,
  refundPaymentIntent,
  listRefundsForCharge,
  retrieveCharge,
  constructWebhookEvent,
  buildWebhookPayload,
};
