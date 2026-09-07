export type LoyaltyTierName = "MEMBER" | "SILVER" | "GOLD" | "PLATINUM";

export type LoyaltyEntryType =
  | "earn_pending"
  | "earn_available"
  | "redeem"
  | "redeem_reversal"
  | "order_cancel_reversal"
  | "order_partial_refund_reversal"
  | "return_reversal"
  | "refund_reversal"
  | "manual_adjustment_positive"
  | "manual_adjustment_negative"
  | "expiry"
  | "birthday_bonus_future"
  | "referral_bonus_future"
  | "welcome_bonus_future";

export type LoyaltyEntryStatus = "pending" | "available" | "redeemed" | "reversed" | "expired";

export interface LoyaltyLedgerEntry {
  id: string;
  customer_profile_id: string;
  customer_id: string;
  entry_type: LoyaltyEntryType;
  points: number; // positive or negative integer
  balance_effect: number; // net change on available balance
  status: LoyaltyEntryStatus;
  source: "checkout" | "order_delivery" | "admin_adjustment" | "order_cancellation" | "order_refund" | "scheduled_batch" | "system";
  related_order_id?: string;
  related_return_id?: string;
  related_refund_id?: string;
  related_reward_id?: string;
  idempotency_key: string;
  description: string;
  earned_at?: string;
  available_at?: string;
  expires_at?: string;
  reversed_entry_id?: string;
  created_at: string;
  created_by: string; // admin email or "system"
  metadata?: Record<string, any>;
}

export type StoreCreditEntryType =
  | "refund_credit"
  | "return_credit"
  | "goodwill_credit"
  | "manual_credit"
  | "manual_debit"
  | "redemption"
  | "redemption_reversal"
  | "expiry"
  | "promotion_credit_future";

export interface StoreCreditLedgerEntry {
  id: string;
  customer_profile_id: string;
  customer_id: string;
  entry_type: StoreCreditEntryType;
  amount_paise: number; // integer in paise (e.g., ₹100 = 10000 paise)
  balance_effect_paise: number; // net change on available balance in paise
  currency: "INR";
  status: "active" | "used" | "reversed" | "expired";
  source: "refund" | "return" | "admin_adjustment" | "checkout_redemption" | "order_cancellation" | "scheduled_batch";
  related_order_id?: string;
  related_refund_id?: string;
  related_return_id?: string;
  related_admin_email?: string;
  idempotency_key: string;
  description: string;
  issued_at?: string;
  expires_at?: string;
  reversed_entry_id?: string;
  created_at: string;
  created_by: string;
}

export interface LoyaltySummary {
  available_points: number;
  pending_points: number;
  lifetime_points_earned: number;
  lifetime_points_redeemed: number;
  lifetime_points_expired: number;
  lifetime_points_reversed: number;
  current_tier: LoyaltyTierName;
  tier_progress: {
    rolling_12m_spend_rupees: number;
    next_tier: LoyaltyTierName | null;
    spend_required_for_next_tier_rupees: number;
    tier_qualified_at?: string;
    tier_expires_at?: string;
  };
  calculated_at: string;
  version: string;
}

export interface StoreCreditSummary {
  available_balance_paise: number; // stored in paise
  available_balance_rupees: number; // calculated for display
  lifetime_issued_paise: number;
  lifetime_used_paise: number;
  lifetime_expired_paise: number;
  lifetime_reversed_paise: number;
  calculated_at: string;
  version: string;
}

export interface TierBenefitFlags {
  earning_multiplier: number;
  early_access: boolean;
  free_standard_shipping: boolean;
  birthday_bonus_eligible: boolean;
  priority_support: boolean;
}

export interface TierConfig {
  tier: LoyaltyTierName;
  min_spend_rupees: number;
  max_spend_rupees: number | null;
  earning_multiplier: number;
  benefits: TierBenefitFlags;
}

export interface LoyaltyPolicyConfig {
  policyVersion: string;
  currency: "INR";
  pointsPerRupees: number; // e.g. 100 -> ₹100 = 1 point
  redemptionValuePaisePerPoint: number; // e.g. 100 -> 1 point = 100 paise (₹1)
  minimumRedemptionPoints: number; // e.g. 100 points minimum
  maximumRedemptionPercent: number; // e.g. 20 -> max 20% of subtotal
  pointsPendingDaysAfterDelivery: number; // e.g. 14 days after delivery
  pointsExpiryMonths: number; // e.g. 12 months
  tierEvaluationMonths: number; // e.g. 12 months rolling
  tiers: TierConfig[];
  updated_at?: string;
  updated_by?: string;
}

export interface LoyaltyRedemptionAllocation {
  source_entry_id: string;
  points_used: number;
  source_expires_at?: string;
}

export interface CustomerRewardsData {
  loyalty_summary: LoyaltySummary;
  store_credit_summary: StoreCreditSummary;
  tier_info: TierConfig;
  expiring_points_30d: number;
  expiring_credit_30d_paise: number;
}
