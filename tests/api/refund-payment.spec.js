/**
 * refund-payment.spec.js
 * Tests: Issuing a full refund and verifying the refund status
 */

const { test, expect } = require("@playwright/test");
const { allure } = require("allure-playwright");
const {
  refundPaymentIntent,
  retrievePaymentIntent,
  retrieveCharge,
  listRefundsForCharge,
  createPaymentIntent,
  confirmPaymentIntent,
  TEST_CARDS,
} = require("../../utils/stripe-api");
const { readState, writeState } = require("../../utils/shared-state");

require("dotenv").config();

const AMOUNT = parseInt(process.env.PAYMENT_AMOUNT || "2000");
const CURRENCY = process.env.PAYMENT_CURRENCY || "usd";

test.describe("Payment Refund", () => {
  test("should issue a full refund successfully", async () => {
    allure.feature("Refund");
    allure.story("Full Refund");
    allure.severity("critical");
    allure.description(
      "Issues a full refund for the confirmed PaymentIntent and verifies the refund object is created with status 'succeeded'."
    );

    const state = readState();
    expect(state.paymentIntentId).toBeTruthy();
    expect(state.chargeId).toBeTruthy();

    const refund = await refundPaymentIntent(state.paymentIntentId, {
      reason: "requested_by_customer",
      metadata: { test_case: "TC-005-full-refund" },
    });

    allure.attachment(
      "Refund Response",
      JSON.stringify(refund, null, 2),
      "application/json"
    );

    // Validate refund object
    expect(refund.id).toMatch(/^re_/);
    expect(refund.object).toBe("refund");
    expect(refund.amount).toBe(AMOUNT);
    expect(refund.currency).toBe(CURRENCY);
    expect(refund.status).toBe("succeeded");
    expect(refund.charge).toBe(state.chargeId);
    expect(refund.reason).toBe("requested_by_customer");

    // Persist refund ID
    writeState({ refundId: refund.id });

    console.log(`Refund issued: ${refund.id} → status: ${refund.status}`);
  });

  test("should update the Charge to reflect refunded amount", async () => {
    allure.feature("Refund");
    allure.story("Charge Updated After Refund");
    allure.severity("high");
    allure.description(
      "Retrieves the Charge after refund and verifies amount_refunded equals full payment amount, and refunded flag is true."
    );

    const state = readState();
    expect(state.chargeId, "Charge ID not found in shared state").toBeTruthy();
    const charge = await retrieveCharge(state.chargeId);

    allure.attachment(
      "Charge After Refund",
      JSON.stringify(charge, null, 2),
      "application/json"
    );

    expect(charge.amount_refunded).toBe(AMOUNT);
    expect(charge.refunded).toBe(true);

    console.log(`Charge ${charge.id}: amount_refunded=${charge.amount_refunded}, refunded=${charge.refunded}`);
  });

  test("should list the refund in the refunds collection for the charge", async () => {
    allure.feature("Refund");
    allure.story("Refund Appears in List");
    allure.severity("normal");
    allure.description(
      "Retrieves the list of refunds for the charge and verifies our refund is present with correct details."
    );

    const state = readState();
    expect(state.chargeId, "Charge ID not found in shared state").toBeTruthy();
    expect(state.refundId, "Refund ID not found in shared state — run full refund test first").toBeTruthy();
    const refundList = await listRefundsForCharge(state.chargeId);

    allure.attachment(
      "Refund List",
      JSON.stringify(refundList, null, 2),
      "application/json"
    );

    expect(refundList.data.length).toBeGreaterThan(0);

    const ourRefund = refundList.data.find((r) => r.id === state.refundId);
    expect(ourRefund).toBeDefined();
    expect(ourRefund.amount).toBe(AMOUNT);
    expect(ourRefund.status).toBe("succeeded");

    console.log(`Refund ${state.refundId} found in refund list`);
  });

  test("should prevent double-refund on an already-refunded charge", async () => {
    allure.feature("Refund");
    allure.story("Double Refund Prevention");
    allure.severity("normal");
    allure.description(
      "Attempts to refund the same PaymentIntent twice and verifies Stripe returns a charge_already_refunded error."
    );

    const state = readState();
    expect(state.paymentIntentId, "PaymentIntent ID not found in shared state").toBeTruthy();

    await expect(
      refundPaymentIntent(state.paymentIntentId)
    ).rejects.toThrow(/charge_already_refunded|nothing_to_refund|already been refunded/i);

    console.log("Double refund correctly prevented");
  });

  test("should support partial refund on a separate payment", async () => {
    allure.feature("Refund");
    allure.story("Partial Refund");
    allure.severity("normal");
    allure.description(
      "Creates and confirms a new PaymentIntent, then issues a partial refund and verifies the partial amount."
    );

    // Create and confirm a fresh payment for partial refund test
    const intent = await createPaymentIntent({
      amount: 5000, // $50.00
      currency: CURRENCY,
      metadata: { test_case: "TC-005-partial-refund" },
    });

    const confirmed = await confirmPaymentIntent(intent.id, TEST_CARDS.visa_success);
    expect(confirmed.status).toBe("succeeded");

    // Issue partial refund of $20.00
    const partialAmount = 2000;
    const partialRefund = await refundPaymentIntent(intent.id, {
      amount: partialAmount,
      reason: "requested_by_customer",
      metadata: { test_case: "TC-005-partial-refund" },
    });

    allure.attachment(
      "Partial Refund Response",
      JSON.stringify(partialRefund, null, 2),
      "application/json"
    );

    expect(partialRefund.amount).toBe(partialAmount);
    expect(partialRefund.status).toBe("succeeded");

    // Verify charge reflects partial refund
    const charge = await retrieveCharge(confirmed.latest_charge);
    expect(charge.amount_refunded).toBe(partialAmount);
    expect(charge.refunded).toBe(false); // Not fully refunded

    console.log(`Partial refund of ${partialAmount} cents issued and verified`);
  });
});
