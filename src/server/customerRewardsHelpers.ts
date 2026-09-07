import { 
  DEFAULT_LOYALTY_POLICY, 
  getTierConfigForSpend, 
  validateAndCalculateLoyaltyRedemption 
} from "./loyaltyPolicy";
import { 
  recalculateLoyaltySummaryFromLedger, 
  recalculateStoreCreditSummaryFromLedger 
} from "./loyaltyHelpers";
import { LoyaltyTierName, TierConfig } from "../types/loyalty";

export interface RewardsDashboardResponse {
  success: boolean;
  customerId: string;
  businessCustomerId: string;
  profile: {
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
    member_since: string;
    birthday?: string;
  };
  tier: {
    current_tier: LoyaltyTierName;
    tier_label: string;
    badge_color: string;
    earning_multiplier: number;
    benefits: Array<{
      key: string;
      label: string;
      description: string;
      applicable: boolean;
    }>;
  };
  tier_progress: {
    rolling_12m_spend_rupees: number;
    current_tier: LoyaltyTierName;
    next_tier: LoyaltyTierName | null;
    spend_required_for_next_tier_rupees: number;
    progress_percent: number;
    unlocks_summary: string;
  };
  loyalty_summary: {
    available_points: number;
    pending_points: number;
    lifetime_points_earned: number;
    lifetime_points_redeemed: number;
    lifetime_points_expired: number;
    lifetime_points_reversed: number;
    current_redemption_value_rupees: number;
  };
  store_credit_summary: {
    available_balance_rupees: number;
    available_balance_paise: number;
    pending_balance_rupees: number;
    last_credit_added: {
      amount_rupees: number;
      date: string | null;
      description: string | null;
    } | null;
    last_credit_used: {
      amount_rupees: number;
      date: string | null;
      description: string | null;
    } | null;
    refund_credits_rupees: number;
    promotional_credits_rupees: number;
  };
  reward_timeline: Array<{
    id: string;
    date: string;
    type: string;
    title: string;
    description: string;
    points: number;
    status: "available" | "pending" | "expired" | "reversed" | "redeemed";
  }>;
  wallet_timeline: Array<{
    id: string;
    date: string;
    type: string;
    title: string;
    description: string;
    amount_rupees: number;
    category: "refund" | "promotional" | "redemption" | "adjustment" | "expiry";
    status: string;
  }>;
  expiring_points: {
    has_expiring: boolean;
    expiring_points: number;
    expiry_date: string | null;
    days_remaining: number | null;
  };
  membership_journey: Array<{
    id: string;
    title: string;
    description: string;
    date: string | null;
    status: "completed" | "current" | "upcoming";
    icon_type: string;
  }>;
  achievements: Array<{
    id: string;
    title: string;
    description: string;
    unlocked: boolean;
    progress_text: string;
    icon: string;
  }>;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    action_label: string;
    action_type: "birthday" | "profile" | "referral" | "shop";
    points_reward_text: string;
    completed: boolean;
  }>;
}

/**
 * Format tier metadata helper
 */
export function getTierDisplayMetadata(tier: LoyaltyTierName) {
  switch (tier) {
    case "SILVER":
      return {
        label: "Silver Member",
        badgeColor: "bg-slate-200 text-slate-800 border-slate-300",
        accentColor: "from-slate-400 to-slate-200"
      };
    case "GOLD":
      return {
        label: "Gold Member",
        badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
        accentColor: "from-amber-500 to-amber-300"
      };
    case "PLATINUM":
      return {
        label: "Platinum VIP",
        badgeColor: "bg-stone-900 text-amber-300 border-stone-800",
        accentColor: "from-stone-900 via-amber-600 to-stone-800"
      };
    case "MEMBER":
    default:
      return {
        label: "Member",
        badgeColor: "bg-stone-100 text-stone-800 border-stone-300",
        accentColor: "from-stone-400 to-stone-300"
      };
  }
}

/**
 * Calculate unlocks for next tier
 */
export function getNextTierUnlocksSummary(nextTier: LoyaltyTierName | null): string {
  switch (nextTier) {
    case "SILVER":
      return "Unlock 1.25x Earning Multiplier & Early Access to Sale Collections.";
    case "GOLD":
      return "Unlock 1.5x Earning Multiplier, Complimentary Shipping & Birthday Bonus Rewards.";
    case "PLATINUM":
      return "Unlock 2.0x Earning Multiplier, Priority Concierge Support & Exclusive Launch Events.";
    default:
      return "You have reached our highest VIP Membership tier!";
  }
}

/**
 * Main customer rewards dashboard aggregator
 */
export async function getCustomerRewardsDashboard(
  adminDb: any,
  profileId: string,
  profileData: any
): Promise<RewardsDashboardResponse> {
  // 1. Ensure summaries are calculated/available
  let loyaltySummary = profileData?.loyalty_summary;
  let storeCreditSummary = profileData?.store_credit_summary;

  if (!loyaltySummary) {
    loyaltySummary = await recalculateLoyaltySummaryFromLedger(adminDb, profileId);
  }
  if (!storeCreditSummary) {
    storeCreditSummary = await recalculateStoreCreditSummaryFromLedger(adminDb, profileId);
  }

  // 2. Profile metadata
  const firstName = profileData.first_name || profileData.name?.split(" ")[0] || "Valued";
  const lastName = profileData.last_name || profileData.name?.split(" ").slice(1).join(" ") || "Member";
  const fullName = `${firstName} ${lastName}`.trim();
  const memberSince = profileData.created_at ? new Date(profileData.created_at).toISOString() : new Date().toISOString();
  const businessCustId = profileData.customer_id || profileData.business_customer_id || `SS-CUST-${profileId.slice(0, 6).toUpperCase()}`;

  // 3. Commerce stats & tier evaluation
  const commerceSummary = profileData.commerce_summary || {};
  const totalOrders = Number(commerceSummary.total_orders || 0);
  const lifetimeSpend = Number(commerceSummary.lifetime_spend || 0);
  const rolling12mSpend = Number(loyaltySummary.tier_progress?.rolling_12m_spend_rupees || lifetimeSpend);

  const tierConfig = getTierConfigForSpend(rolling12mSpend);
  const currentTier = tierConfig.tier;
  const tierMeta = getTierDisplayMetadata(currentTier);

  // Next tier progress calculation
  let nextTier: LoyaltyTierName | null = null;
  let spendNeeded = 0;
  let progressPercent = 100;

  if (currentTier === "MEMBER") {
    nextTier = "SILVER";
    spendNeeded = Math.max(0, 15000 - rolling12mSpend);
    progressPercent = Math.min(100, Math.round((rolling12mSpend / 15000) * 100));
  } else if (currentTier === "SILVER") {
    nextTier = "GOLD";
    spendNeeded = Math.max(0, 40000 - rolling12mSpend);
    progressPercent = Math.min(100, Math.round(((rolling12mSpend - 15000) / (40000 - 15000)) * 100));
  } else if (currentTier === "GOLD") {
    nextTier = "PLATINUM";
    spendNeeded = Math.max(0, 80000 - rolling12mSpend);
    progressPercent = Math.min(100, Math.round(((rolling12mSpend - 40000) / (80000 - 40000)) * 100));
  } else {
    nextTier = null;
    spendNeeded = 0;
    progressPercent = 100;
  }

  // 4. Tier benefits list
  const benefits = [
    {
      key: "earning_multiplier",
      label: `${tierConfig.earning_multiplier}x Earning Multiplier`,
      description: `Earn ${tierConfig.earning_multiplier} points for every ₹100 spent.`,
      applicable: true
    },
    {
      key: "early_access",
      label: "Exclusive Launch Access",
      description: "Preview & shop new seasonal drops 24 hours early.",
      applicable: tierConfig.benefits?.early_access || false
    },
    {
      key: "free_shipping",
      label: "Complimentary Standard Shipping",
      description: "Enjoy zero delivery charges across all orders in India.",
      applicable: tierConfig.benefits?.free_standard_shipping || false
    },
    {
      key: "birthday_bonus",
      label: "Birthday Bonus Rewards",
      description: "Receive special birthday gift points during your birthday month.",
      applicable: tierConfig.benefits?.birthday_bonus_eligible || false
    },
    {
      key: "priority_support",
      label: "Priority Concierge Support",
      description: "Direct line to our senior customer experience specialists.",
      applicable: tierConfig.benefits?.priority_support || false
    }
  ];

  // 5. Fetch Bounded Timelines (Performance constraint: no full ledger scans, limit 50)
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);

  // Loyalty Ledger
  const loyaltySnap = await profileRef
    .collection("loyalty_ledger")
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  const rewardTimeline: RewardsDashboardResponse["reward_timeline"] = [];
  let expiringSoonPoints = 0;
  let nearestExpiryDate: string | null = null;

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  loyaltySnap.forEach((docSnap: any) => {
    const data = docSnap.data();
    if (!data) return;

    rewardTimeline.push({
      id: docSnap.id,
      date: data.created_at || new Date().toISOString(),
      type: data.entry_type || "loyalty_event",
      title: data.description || "Loyalty Points Activity",
      description: `Order/Ref: ${data.related_order_id || "System"}`,
      points: data.points || 0,
      status: data.status || "available"
    });

    // Check expiring points
    if (data.status === "available" && data.expires_at) {
      const expDate = new Date(data.expires_at);
      if (expDate > now && expDate <= thirtyDaysLater) {
        expiringSoonPoints += Math.max(0, data.balance_effect || data.points || 0);
        if (!nearestExpiryDate || expDate < new Date(nearestExpiryDate)) {
          nearestExpiryDate = data.expires_at;
        }
      }
    }
  });

  // Store Credit Ledger
  const creditSnap = await profileRef
    .collection("store_credit_ledger")
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  const walletTimeline: RewardsDashboardResponse["wallet_timeline"] = [];
  let lastCreditAdded: RewardsDashboardResponse["store_credit_summary"]["last_credit_added"] = null;
  let lastCreditUsed: RewardsDashboardResponse["store_credit_summary"]["last_credit_used"] = null;
  let refundCreditsRupees = 0;
  let promotionalCreditsRupees = 0;

  creditSnap.forEach((docSnap: any) => {
    const data = docSnap.data();
    if (!data) return;

    const amtRupees = Math.floor(Math.abs(data.amount_paise || 0) / 100);
    const entryType = data.entry_type || "manual_credit";

    let category: RewardsDashboardResponse["wallet_timeline"][0]["category"] = "promotional";
    if (entryType.includes("refund") || entryType.includes("return")) {
      category = "refund";
      refundCreditsRupees += amtRupees;
    } else if (entryType === "redemption") {
      category = "redemption";
    } else if (entryType === "expiry") {
      category = "expiry";
    } else {
      category = "promotional";
      if (data.amount_paise > 0) promotionalCreditsRupees += amtRupees;
    }

    walletTimeline.push({
      id: docSnap.id,
      date: data.created_at || new Date().toISOString(),
      type: entryType,
      title: data.description || "Store Credit Event",
      description: `Reference: ${data.related_order_id || "System"}`,
      amount_rupees: data.amount_paise > 0 ? amtRupees : -amtRupees,
      category,
      status: data.status || "active"
    });

    if (data.amount_paise > 0 && !lastCreditAdded) {
      lastCreditAdded = {
        amount_rupees: amtRupees,
        date: data.created_at || null,
        description: data.description || "Credit Added"
      };
    }

    if (entryType === "redemption" && !lastCreditUsed) {
      lastCreditUsed = {
        amount_rupees: amtRupees,
        date: data.created_at || null,
        description: data.description || "Used at Checkout"
      };
    }
  });

  // 6. Expiring Points Payload
  let daysRemaining: number | null = null;
  if (nearestExpiryDate) {
    const diffMs = new Date(nearestExpiryDate).getTime() - now.getTime();
    daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // 7. Membership Journey (derived from CRM events + Milestones)
  const crmEventsSnap = await profileRef
    .collection("events")
    .orderBy("occurred_at", "asc")
    .limit(30)
    .get();

  const crmEvents: any[] = [];
  crmEventsSnap.forEach((d: any) => crmEvents.push({ id: d.id, ...d.data() }));

  const journey: RewardsDashboardResponse["membership_journey"] = [
    {
      id: "journey_joined",
      title: "Joined Sa and Sha",
      description: "Welcome to the Sa and Sha Membership family.",
      date: memberSince,
      status: "completed",
      icon_type: "sparkles"
    },
    {
      id: "journey_first_order",
      title: "First Order",
      description: "Placed initial luxury order with custom artisan tailored garments.",
      date: totalOrders > 0 ? (crmEvents.find(e => e.event_type?.includes("order"))?.occurred_at || null) : null,
      status: totalOrders > 0 ? "completed" : "upcoming",
      icon_type: "package"
    },
    {
      id: "journey_silver",
      title: "Silver Member Unlocked",
      description: "Achieved ₹15,000 spend milestone for 1.25x points multiplier.",
      date: ["SILVER", "GOLD", "PLATINUM"].includes(currentTier) ? (profileData.silver_unlocked_at || memberSince) : null,
      status: ["SILVER", "GOLD", "PLATINUM"].includes(currentTier) ? "completed" : "upcoming",
      icon_type: "award"
    },
    {
      id: "journey_gold",
      title: "Gold Member Tier",
      description: "Unlocked complimentary standard shipping & birthday rewards.",
      date: ["GOLD", "PLATINUM"].includes(currentTier) ? (profileData.gold_unlocked_at || memberSince) : null,
      status: ["GOLD", "PLATINUM"].includes(currentTier) ? "completed" : "upcoming",
      icon_type: "crown"
    },
    {
      id: "journey_vip",
      title: "Platinum VIP Status",
      description: "Top tier membership with 2.0x earning multiplier & concierge support.",
      date: currentTier === "PLATINUM" ? (profileData.platinum_unlocked_at || memberSince) : null,
      status: currentTier === "PLATINUM" ? "completed" : "upcoming",
      icon_type: "shield"
    }
  ];

  // 8. Achievements
  const achievements: RewardsDashboardResponse["achievements"] = [
    {
      id: "ach_first_purchase",
      title: "First Purchase",
      description: "Place your first Sa and Sha order.",
      unlocked: totalOrders >= 1,
      progress_text: totalOrders >= 1 ? "Unlocked" : `${totalOrders}/1 Order`,
      icon: "shopping-bag"
    },
    {
      id: "ach_5_orders",
      title: "5 Orders Club",
      description: "Complete 5 orders with Sa and Sha.",
      unlocked: totalOrders >= 5,
      progress_text: totalOrders >= 5 ? "Unlocked" : `${totalOrders}/5 Orders`,
      icon: "package-check"
    },
    {
      id: "ach_10_orders",
      title: "10 Orders Master",
      description: "Complete 10 orders with us.",
      unlocked: totalOrders >= 10,
      progress_text: totalOrders >= 10 ? "Unlocked" : `${totalOrders}/10 Orders`,
      icon: "award"
    },
    {
      id: "ach_spend_25k",
      title: "₹25,000 Milestone",
      description: "Reach ₹25,000 lifetime spend.",
      unlocked: lifetimeSpend >= 25000,
      progress_text: lifetimeSpend >= 25000 ? "Unlocked" : `₹${lifetimeSpend.toLocaleString("en-IN")}/₹25,000`,
      icon: "trending-up"
    },
    {
      id: "ach_spend_50k",
      title: "₹50,000 Milestone",
      description: "Reach ₹50,000 lifetime spend.",
      unlocked: lifetimeSpend >= 50000,
      progress_text: lifetimeSpend >= 50000 ? "Unlocked" : `₹${lifetimeSpend.toLocaleString("en-IN")}/₹50,000`,
      icon: "zap"
    },
    {
      id: "ach_vip_candidate",
      title: "VIP Candidate",
      description: "Reach Platinum VIP status or ₹80,000 spend.",
      unlocked: currentTier === "PLATINUM" || lifetimeSpend >= 80000,
      progress_text: currentTier === "PLATINUM" || lifetimeSpend >= 80000 ? "Unlocked" : `₹${lifetimeSpend.toLocaleString("en-IN")}/₹80,000`,
      icon: "crown"
    }
  ];

  // 9. Recommendations
  const isProfileComplete = Boolean(profileData.email && profileData.phone && profileData.first_name);
  const hasBirthday = Boolean(profileData.birthday || profileData.date_of_birth);

  const recommendations: RewardsDashboardResponse["recommendations"] = [
    {
      id: "rec_profile",
      title: "Complete Your Profile",
      description: "Ensure your contact details & preferred sizes are saved.",
      action_label: isProfileComplete ? "Profile Complete" : "Update Profile",
      action_type: "profile",
      points_reward_text: "+50 Points",
      completed: isProfileComplete
    },
    {
      id: "rec_birthday",
      title: "Add Birthday",
      description: "Tell us your birthday to receive exclusive annual birthday bonus points.",
      action_label: hasBirthday ? "Birthday Saved" : "Add Birthday",
      action_type: "birthday",
      points_reward_text: "+100 Birthday Points",
      completed: hasBirthday
    },
    {
      id: "rec_referral",
      title: "Refer Friends",
      description: "Share your exclusive Sa and Sha link. Give ₹500, get 250 Points when they order.",
      action_label: "Share Referral Link",
      action_type: "referral",
      points_reward_text: "+250 Points / Referral",
      completed: false
    },
    {
      id: "rec_shop_new",
      title: "Shop New Arrivals",
      description: "Explore dresses, co-ord sets & the latest collection.",
      action_label: "Explore Collection",
      action_type: "shop",
      points_reward_text: `${tierConfig.earning_multiplier}x Points on Orders`,
      completed: false
    }
  ];

  return {
    success: true,
    customerId: profileId,
    businessCustomerId: businessCustId,
    profile: {
      first_name: firstName,
      last_name: lastName,
      full_name: fullName,
      email: profileData.email || "",
      phone: profileData.phone || "",
      member_since: memberSince,
      birthday: profileData.birthday || profileData.date_of_birth || undefined
    },
    tier: {
      current_tier: currentTier,
      tier_label: tierMeta.label,
      badge_color: tierMeta.badgeColor,
      earning_multiplier: tierConfig.earning_multiplier,
      benefits
    },
    tier_progress: {
      rolling_12m_spend_rupees: rolling12mSpend,
      current_tier: currentTier,
      next_tier: nextTier,
      spend_required_for_next_tier_rupees: spendNeeded,
      progress_percent: progressPercent,
      unlocks_summary: getNextTierUnlocksSummary(nextTier)
    },
    loyalty_summary: {
      available_points: loyaltySummary.available_points || 0,
      pending_points: loyaltySummary.pending_points || 0,
      lifetime_points_earned: loyaltySummary.lifetime_points_earned || 0,
      lifetime_points_redeemed: loyaltySummary.lifetime_points_redeemed || 0,
      lifetime_points_expired: loyaltySummary.lifetime_points_expired || 0,
      lifetime_points_reversed: loyaltySummary.lifetime_points_reversed || 0,
      current_redemption_value_rupees: loyaltySummary.available_points || 0
    },
    store_credit_summary: {
      available_balance_rupees: storeCreditSummary.available_balance_rupees || 0,
      available_balance_paise: storeCreditSummary.available_balance_paise || 0,
      pending_balance_rupees: 0,
      last_credit_added: lastCreditAdded,
      last_credit_used: lastCreditUsed,
      refund_credits_rupees: refundCreditsRupees,
      promotional_credits_rupees: promotionalCreditsRupees
    },
    reward_timeline: rewardTimeline,
    wallet_timeline: walletTimeline,
    expiring_points: {
      has_expiring: expiringSoonPoints > 0,
      expiring_points: expiringSoonPoints,
      expiry_date: nearestExpiryDate,
      days_remaining: daysRemaining
    },
    membership_journey: journey,
    achievements,
    recommendations
  };
}

/**
 * Helper for Redemption Simulator
 */
export function calculateSimulatorRedemption(
  subtotalRupees: number,
  requestedPoints: number,
  availablePoints: number
) {
  return validateAndCalculateLoyaltyRedemption(
    subtotalRupees,
    requestedPoints,
    availablePoints,
    DEFAULT_LOYALTY_POLICY
  );
}
