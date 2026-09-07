import { LoyaltyPolicyConfig, LoyaltyTierName, TierConfig } from "../types/loyalty";

export const DEFAULT_LOYALTY_POLICY: LoyaltyPolicyConfig = {
  policyVersion: "1.0",
  currency: "INR",
  pointsPerRupees: 100, // ₹100 eligible spend = 1 base point
  redemptionValuePaisePerPoint: 100, // 1 point = ₹1 = 100 paise
  minimumRedemptionPoints: 100, // Minimum 100 points required to redeem
  maximumRedemptionPercent: 20, // Max 20% of subtotal can be paid with points
  pointsPendingDaysAfterDelivery: 7, // Points available 7 days post-delivery (aligned with 7-day return window)
  pointsExpiryMonths: 12, // Points expire 12 months after becoming available
  tierEvaluationMonths: 12, // Evaluation window is 12 rolling months
  tiers: [
    {
      tier: "MEMBER",
      min_spend_rupees: 0,
      max_spend_rupees: 14999,
      earning_multiplier: 1.0,
      benefits: {
        earning_multiplier: 1.0,
        early_access: false,
        free_standard_shipping: false,
        birthday_bonus_eligible: false,
        priority_support: false
      }
    },
    {
      tier: "SILVER",
      min_spend_rupees: 15000,
      max_spend_rupees: 39999,
      earning_multiplier: 1.25,
      benefits: {
        earning_multiplier: 1.25,
        early_access: true,
        free_standard_shipping: false,
        birthday_bonus_eligible: false,
        priority_support: false
      }
    },
    {
      tier: "GOLD",
      min_spend_rupees: 40000,
      max_spend_rupees: 79999,
      earning_multiplier: 1.5,
      benefits: {
        earning_multiplier: 1.5,
        early_access: true,
        free_standard_shipping: true,
        birthday_bonus_eligible: true,
        priority_support: false
      }
    },
    {
      tier: "PLATINUM",
      min_spend_rupees: 80000,
      max_spend_rupees: null,
      earning_multiplier: 2.0,
      benefits: {
        earning_multiplier: 2.0,
        early_access: true,
        free_standard_shipping: true,
        birthday_bonus_eligible: true,
        priority_support: true
      }
    }
  ]
};

/**
 * Calculate earned points based on net eligible merchandise spend in rupees
 * Precise integer arithmetic: floor(netEligibleSpendInRupees / pointsPerRupees * multiplier)
 */
export function calculateEarnedPoints(
  eligibleSpendInRupees: number,
  tierMultiplier = 1.0,
  policy = DEFAULT_LOYALTY_POLICY
): number {
  if (eligibleSpendInRupees <= 0) return 0;
  const basePoints = Math.floor(eligibleSpendInRupees / (policy.pointsPerRupees || 100));
  const totalPoints = Math.floor(basePoints * Math.max(1.0, tierMultiplier));
  return Math.max(0, totalPoints);
}

/**
 * Determine loyalty tier config for given 12-month rolling spend in rupees
 */
export function getTierConfigForSpend(
  rolling12MonthSpendRupees: number,
  policy = DEFAULT_LOYALTY_POLICY
): TierConfig {
  const spend = Math.max(0, rolling12MonthSpendRupees);
  
  // Find highest matching tier
  for (let i = policy.tiers.length - 1; i >= 0; i--) {
    const t = policy.tiers[i];
    if (spend >= t.min_spend_rupees) {
      return t;
    }
  }

  return policy.tiers[0];
}

/**
 * Helper to calculate redemption discount caps and validation
 */
export function validateAndCalculateLoyaltyRedemption(
  subtotalRupees: number,
  requestedPoints: number,
  availablePoints: number,
  policy = DEFAULT_LOYALTY_POLICY
): {
  valid: boolean;
  message: string;
  pointsToRedeem: number;
  discountRupees: number;
  discountPaise: number;
  maxAllowedPoints: number;
} {
  const points = Math.floor(Math.max(0, requestedPoints));

  if (points === 0) {
    return {
      valid: true,
      message: "No points redeemed.",
      pointsToRedeem: 0,
      discountRupees: 0,
      discountPaise: 0,
      maxAllowedPoints: 0
    };
  }

  if (availablePoints < policy.minimumRedemptionPoints) {
    return {
      valid: false,
      message: `Minimum ${policy.minimumRedemptionPoints} points required to redeem rewards. You currently have ${availablePoints} points.`,
      pointsToRedeem: 0,
      discountRupees: 0,
      discountPaise: 0,
      maxAllowedPoints: 0
    };
  }

  if (points < policy.minimumRedemptionPoints) {
    return {
      valid: false,
      message: `Minimum redemption is ${policy.minimumRedemptionPoints} points.`,
      pointsToRedeem: 0,
      discountRupees: 0,
      discountPaise: 0,
      maxAllowedPoints: 0
    };
  }

  if (points > availablePoints) {
    return {
      valid: false,
      message: `Cannot redeem ${points} points. Available balance is ${availablePoints} points.`,
      pointsToRedeem: 0,
      discountRupees: 0,
      discountPaise: 0,
      maxAllowedPoints: 0
    };
  }

  // Calculate maximum points allowed by subtotal percentage cap
  const maxDiscountRupees = Math.floor(subtotalRupees * (policy.maximumRedemptionPercent / 100));
  const maxPointsByCap = Math.floor((maxDiscountRupees * 100) / policy.redemptionValuePaisePerPoint);
  const maxAllowedPoints = Math.min(availablePoints, maxPointsByCap);

  if (points > maxAllowedPoints) {
    return {
      valid: false,
      message: `Loyalty point discount cannot exceed ${policy.maximumRedemptionPercent}% of order subtotal (max ${maxAllowedPoints} points / ₹${maxDiscountRupees}).`,
      pointsToRedeem: 0,
      discountRupees: 0,
      discountPaise: 0,
      maxAllowedPoints
    };
  }

  const discountRupees = Math.floor((points * policy.redemptionValuePaisePerPoint) / 100);
  const discountPaise = points * policy.redemptionValuePaisePerPoint;

  return {
    valid: true,
    message: `Applied ${points} Kora Rewards points (₹${discountRupees} discount).`,
    pointsToRedeem: points,
    discountRupees,
    discountPaise,
    maxAllowedPoints
  };
}

/**
 * Load current loyalty policy configuration from Firestore (or return default)
 */
export async function getLoyaltyPolicy(adminDb: any): Promise<LoyaltyPolicyConfig> {
  try {
    const docSnap = await adminDb.collection("system_config").doc("loyalty_policy").get();
    if (docSnap.exists) {
      const data = docSnap.data();
      return {
        ...DEFAULT_LOYALTY_POLICY,
        ...data,
        tiers: Array.isArray(data.tiers) && data.tiers.length > 0 ? data.tiers : DEFAULT_LOYALTY_POLICY.tiers
      };
    }
  } catch (err) {
    console.warn("[LOYALTY POLICY] Could not load custom policy from Firestore, using default:", err);
  }
  return DEFAULT_LOYALTY_POLICY;
}

/**
 * Save loyalty policy configuration to Firestore
 */
export async function saveLoyaltyPolicy(
  adminDb: any,
  updatedPolicy: Partial<LoyaltyPolicyConfig>,
  updatedBy: string = "ADMIN"
): Promise<LoyaltyPolicyConfig> {
  const current = await getLoyaltyPolicy(adminDb);
  const newPolicy: LoyaltyPolicyConfig = {
    ...current,
    ...updatedPolicy,
    policyVersion: (parseFloat(current.policyVersion || "1.0") + 0.1).toFixed(1),
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  await adminDb.collection("system_config").doc("loyalty_policy").set(newPolicy, { merge: true });

  // Audit log
  try {
    await adminDb.collection("audit_logs").add({
      action: "UPDATE_LOYALTY_POLICY",
      performed_by: updatedBy,
      timestamp: new Date().toISOString(),
      details: newPolicy
    });
  } catch (err) {
    console.warn("[AUDIT LOG] Non-fatal error writing audit log:", err);
  }

  return newPolicy;
}

