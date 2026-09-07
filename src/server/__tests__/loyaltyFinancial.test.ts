import { describe, it, expect } from "vitest";
import {
  processMixedPaymentRefundAllocation
} from "../loyaltyHelpers";
import {
  getTierConfigForSpend,
  validateAndCalculateLoyaltyRedemption
} from "../loyaltyPolicy";

describe("Financial Hardening & Allocation Unit Tests", () => {
  it("A. Mixed Payment Refund Allocation Priority - Cash first, then Store Credit, then Points", () => {
    const order = {
      total_rupees: 3000,
      paid_cash_rupees: 2200,
      store_credit_used_rupees: 500,
      loyalty_points_redeemed: 300,
      already_refunded_cash_rupees: 0,
      already_restored_credit_rupees: 0,
      already_restored_points: 0
    };

    // Case 1: Partial refund of ₹1200
    const alloc1 = processMixedPaymentRefundAllocation(order, 1200);
    expect(alloc1.refundCashRupees).toBe(1200);
    expect(alloc1.restoreCreditRupees).toBe(0);
    expect(alloc1.restorePoints).toBe(0);

    // Case 2: Partial refund of ₹2500 (₹2200 cash + ₹300 credit)
    const alloc2 = processMixedPaymentRefundAllocation(order, 2500);
    expect(alloc2.refundCashRupees).toBe(2200);
    expect(alloc2.restoreCreditRupees).toBe(300);
    expect(alloc2.restorePoints).toBe(0);

    // Case 3: Full refund of ₹3000 (₹2200 cash + ₹500 credit + 300 points)
    const alloc3 = processMixedPaymentRefundAllocation(order, 3000);
    expect(alloc3.refundCashRupees).toBe(2200);
    expect(alloc3.restoreCreditRupees).toBe(500);
    expect(alloc3.restorePoints).toBe(300);
  });

  it("B. Multi-stage partial refund allocation tracking", () => {
    const order = {
      total_rupees: 2000,
      paid_cash_rupees: 1500,
      store_credit_used_rupees: 500,
      loyalty_points_redeemed: 0,
      already_refunded_cash_rupees: 1500, // Cash already fully refunded
      already_restored_credit_rupees: 0,
      already_restored_points: 0
    };

    // Subsequent refund of ₹300 must go to Store Credit
    const alloc = processMixedPaymentRefundAllocation(order, 300);
    expect(alloc.refundCashRupees).toBe(0);
    expect(alloc.restoreCreditRupees).toBe(300);
    expect(alloc.restorePoints).toBe(0);
  });

  it("C. Rolling Spend Tier Qualification Thresholds", () => {
    expect(getTierConfigForSpend(0).tier).toBe("MEMBER");
    expect(getTierConfigForSpend(14999).tier).toBe("MEMBER");
    expect(getTierConfigForSpend(15000).tier).toBe("SILVER");
    expect(getTierConfigForSpend(39999).tier).toBe("SILVER");
    expect(getTierConfigForSpend(40000).tier).toBe("GOLD");
    expect(getTierConfigForSpend(79999).tier).toBe("GOLD");
    expect(getTierConfigForSpend(80000).tier).toBe("PLATINUM");
  });

  it("D. Loyalty Redemption Policy Calculations", () => {
    // subtotal = 1000, requested = 200, available = 500 (20% max discount = 200 points)
    const calc = validateAndCalculateLoyaltyRedemption(1000, 200, 500);
    expect(calc.valid).toBe(true);
    expect(calc.pointsToRedeem).toBe(200);
    expect(calc.discountRupees).toBe(200);
    expect(calc.discountPaise).toBe(20000);

    // Exceeding 20% max discount limit on ₹1000 subtotal (requested = 500 points)
    const calcExceed = validateAndCalculateLoyaltyRedemption(1000, 500, 500);
    expect(calcExceed.valid).toBe(false);
    expect(calcExceed.maxAllowedPoints).toBe(200);
  });

  it("E. Money Precision - Integer Paise Checks", () => {
    const rupees = 1250.75;
    const paise = Math.round(rupees * 100);
    expect(paise).toBe(125075);
    expect(Number.isInteger(paise)).toBe(true);
  });
});
