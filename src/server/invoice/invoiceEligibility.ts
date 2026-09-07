export interface InvoiceFinalizationEligibilityResult {
  eligible: boolean;
  reasonCode:
    | "ALREADY_FINALIZED"
    | "ORDER_NOT_FOUND"
    | "ORDER_CANCELLED_OR_REFUNDED"
    | "COD_DISPATCH_ELIGIBLE"
    | "COD_AWAITING_DISPATCH"
    | "PREPAID_FULFILLMENT_ACCEPTED_ELIGIBLE"
    | "PREPAID_AWAITING_PAYMENT"
    | "PREPAID_AWAITING_FULFILLMENT_ACCEPTANCE";
  triggerType: "COD_DISPATCH" | "PREPAID_FULFILLMENT_ACCEPTED" | "ADMIN_MANUAL" | "ALREADY_FINALIZED" | "NONE";
  reasonDescription?: string;
}

/**
 * Central server-side policy engine that determines whether a GST Tax Invoice
 * is eligible for finalization according to Sa and Sha business rules:
 *
 * 1. PREPAID / RAZORPAY:
 *    Finalize ONLY after payment is verified/captured AND the order is accepted into fulfillment.
 *
 * 2. CASH ON DELIVERY (COD):
 *    Finalize ONLY when the order transitions to DISPATCHED state.
 *
 * 3. CANCELLED / REFUNDED:
 *    Orders cancelled or refunded BEFORE invoice finalization are blocked.
 */
export function evaluateInvoiceFinalizationEligibility(
  order: any
): InvoiceFinalizationEligibilityResult {
  if (!order) {
    return {
      eligible: false,
      reasonCode: "ORDER_NOT_FOUND",
      triggerType: "NONE",
      reasonDescription: "Order record not found."
    };
  }

  // 1. Idempotency Check: Already finalized orders
  if (order.invoice_status === "FINALIZED" || !!order.invoice_id) {
    return {
      eligible: true,
      reasonCode: "ALREADY_FINALIZED",
      triggerType: order.invoice_trigger || order.finalized_trigger || "ALREADY_FINALIZED",
      reasonDescription: "Invoice is already finalized for this order."
    };
  }

  const currentStatus = (order.status || order.order_status || "placed").toString().trim().toLowerCase();

  // 2. Blocked States: Cancelled or refunded prior to finalization
  if (["cancelled", "refund_initiated", "refund_completed"].includes(currentStatus)) {
    return {
      eligible: false,
      reasonCode: "ORDER_CANCELLED_OR_REFUNDED",
      triggerType: "NONE",
      reasonDescription: `Order is in '${currentStatus}' state and cannot be finalized.`
    };
  }

  // 3. Normalize Payment Method
  const rawMethod = (order.payment_method || "").toString().trim().toLowerCase();
  const isCod = rawMethod === "cod" || rawMethod.includes("cash on delivery");

  // 4. CASH ON DELIVERY (COD) Policy
  if (isCod) {
    const isDispatched =
      currentStatus === "dispatched" ||
      (order.shipment_status || "").toString().trim().toLowerCase() === "dispatched";

    if (isDispatched) {
      return {
        eligible: true,
        reasonCode: "COD_DISPATCH_ELIGIBLE",
        triggerType: "COD_DISPATCH",
        reasonDescription: "COD order has reached dispatched status."
      };
    }

    return {
      eligible: false,
      reasonCode: "COD_AWAITING_DISPATCH",
      triggerType: "NONE",
      reasonDescription: `COD order is in '${currentStatus}' state. Invoices for COD orders are finalized only upon dispatch.`
    };
  }

  // 5. PREPAID / RAZORPAY Policy
  // Condition A: Payment verified/captured according to canonical provider / server verification
  const pmtStatus = (order.payment_status || order.razorpay_payment_status || "").toString().trim().toLowerCase();
  const hasPaymentId = !!(order.payment_id || order.razorpay_payment_id);
  const isExplicitlyUncapturedOrFailed =
    pmtStatus === "pending" ||
    pmtStatus === "authorized" ||
    pmtStatus === "failed" ||
    currentStatus === "failed" ||
    order.payment_verified === false;

  const verificationSource = (order.payment_verification_source || "").toString().trim().toLowerCase();
  const hasTrustedVerificationSource =
    verificationSource === "razorpay_api" ||
    verificationSource === "razorpay_webhook" ||
    verificationSource === "provider_verified" ||
    (!verificationSource && order.payment_verified === true);

  const isPaid =
    !isExplicitlyUncapturedOrFailed &&
    hasPaymentId &&
    order.payment_verified === true &&
    pmtStatus === "captured" &&
    hasTrustedVerificationSource;

  // Condition B: Accepted into fulfillment
  const fulfillmentStatus = (order.fulfillment_status || "").toString().trim().toLowerCase();
  const isFulfillmentAccepted =
    currentStatus === "processing" ||
    currentStatus === "dispatched" ||
    currentStatus === "delivered" ||
    fulfillmentStatus === "accepted" ||
    fulfillmentStatus === "fulfilled";

  if (isPaid && isFulfillmentAccepted) {
    return {
      eligible: true,
      reasonCode: "PREPAID_FULFILLMENT_ACCEPTED_ELIGIBLE",
      triggerType: "PREPAID_FULFILLMENT_ACCEPTED",
      reasonDescription: "Prepaid order payment is verified/captured and order has been accepted into fulfillment."
    };
  }

  if (!isPaid) {
    return {
      eligible: false,
      reasonCode: "PREPAID_AWAITING_PAYMENT",
      triggerType: "NONE",
      reasonDescription: "Prepaid order payment is pending, authorized (uncaptured), failed, or unverified."
    };
  }

  return {
    eligible: false,
    reasonCode: "PREPAID_AWAITING_FULFILLMENT_ACCEPTANCE",
    triggerType: "NONE",
    reasonDescription: "Prepaid order payment is verified, but order is awaiting fulfillment acceptance."
  };
}

/**
 * Convenient boolean helper for finalization eligibility.
 */
export function canFinalizeGstInvoiceForOrder(order: any): boolean {
  return evaluateInvoiceFinalizationEligibility(order).eligible;
}
