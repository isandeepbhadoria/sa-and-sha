import crypto from "crypto";
import {
  CustomerTimelineEvent,
  CustomerEventType,
  HealthStatus,
  CustomerHealth,
  EligibleMetrics,
  CustomerSegment,
  CustomerSegmentFilter,
  StructuredCustomerNote,
  CustomerNoteType,
  CustomerAnalytics,
  MergePreviewResult
} from "../types/crm";
import {
  CustomerProfileDoc,
  CustomerAddress,
  CommerceSummary,
  maskPhone,
  maskEmail,
  sanitizeString,
  migrateAndNormalizeProfile
} from "./customerProfileHelpers";

export const HEALTH_MODEL_CONFIG = {
  VERSION: "v1.0",
  NEW_CUSTOMER_DAYS: 30,
  ACTIVE_WINDOW_DAYS: 90,
  AT_RISK_START_DAYS: 120,
  INACTIVE_START_DAYS: 240,
  HIGH_RETURN_RATE_THRESHOLD: 0.30, // 30%
  HIGH_RETURN_MIN_ORDERS: 3,
  VIP_MIN_SPEND: 25000,
  VIP_MIN_ORDERS: 5,
  LOYAL_MIN_ORDERS: 3,
  LOYAL_MAX_RETURN_RATE: 0.30
};

/**
 * Server-controlled Timeline Event Creator
 * Writes to customer_profiles/{customerId}/events/{eventId}
 */
export async function createCustomerTimelineEvent(
  adminDb: any,
  customerId: string,
  eventType: CustomerEventType,
  title: string,
  description: string,
  source: "system" | "checkout" | "admin" | "webhook" | "customer_action" = "system",
  opts?: {
    relatedOrderId?: string;
    relatedAddressId?: string;
    relatedReturnId?: string;
    relatedAdminEmail?: string;
    metadata?: Record<string, any>;
    occurredAt?: string;
    customEventId?: string;
  }
): Promise<CustomerTimelineEvent | null> {
  if (!customerId) return null;

  try {
    const cleanTitle = sanitizeString(title, 100);
    // Sanitize description & strip sensitive OTPs / tokens
    let cleanDesc = sanitizeString(description, 500)
      .replace(/otp\s*[:=]?\s*\d+/gi, "OTP: [MASKED]")
      .replace(/token\s*[:=]?\s*[a-zA-Z0-9_.-]+/gi, "token: [MASKED]");

    const occurredAt = opts?.occurredAt || new Date().toISOString();
    const createdAt = new Date().toISOString();

    // Deterministic ID if provided or generated
    const eventId = opts?.customEventId
      ? opts.customEventId
      : `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    const eventDoc: CustomerTimelineEvent = {
      id: eventId,
      customer_profile_id: customerId,
      event_type: eventType,
      title: cleanTitle,
      description: cleanDesc,
      source,
      related_order_id: opts?.relatedOrderId ? sanitizeString(opts.relatedOrderId, 50) : undefined,
      related_address_id: opts?.relatedAddressId ? sanitizeString(opts.relatedAddressId, 50) : undefined,
      related_return_id: opts?.relatedReturnId ? sanitizeString(opts.relatedReturnId, 50) : undefined,
      related_admin_email: opts?.relatedAdminEmail ? sanitizeString(opts.relatedAdminEmail, 100) : undefined,
      metadata: opts?.metadata || undefined,
      occurred_at: occurredAt,
      created_at: createdAt
    };

    const docRef = adminDb
      .collection("customer_profiles")
      .doc(customerId)
      .collection("events")
      .doc(eventId);

    const snap = await docRef.get();
    if (!snap.exists) {
      const cleanEventData = Object.fromEntries(
        Object.entries(eventDoc).filter(([_, v]) => v !== undefined)
      );
      await docRef.set(cleanEventData);
    }

    return eventDoc;
  } catch (err) {
    console.warn(`[CRM TIMELINE] Error writing event for ${customerId}:`, err);
    return null;
  }
}

/**
 * Server-side calculation of revenue eligibility and order stats
 */
export async function calculateEligibleMetrics(
  adminDb: any,
  phone: string,
  email = ""
): Promise<EligibleMetrics> {
  const cleanPhoneDigits = (phone || "").replace(/\D/g, "");
  const cleanEmail = (email || "").trim().toLowerCase();

  try {
    const ordersSnap = await adminDb.collection("orders").get();
    const matchedOrders: any[] = [];

    ordersSnap.forEach((docSnap: any) => {
      const o = docSnap.data();
      if (!o) return;

      const orderPhoneDigits = (o.customer_phone || "").replace(/\D/g, "");
      const orderEmail = (o.customer_email || "").trim().toLowerCase();

      const phoneMatch =
        cleanPhoneDigits &&
        orderPhoneDigits &&
        (orderPhoneDigits === cleanPhoneDigits ||
          orderPhoneDigits.endsWith(cleanPhoneDigits) ||
          cleanPhoneDigits.endsWith(orderPhoneDigits));

      const emailMatch =
        cleanEmail &&
        cleanEmail !== "shop@sa-and-sha.com" &&
        orderEmail === cleanEmail;

      if (phoneMatch || emailMatch) {
        matchedOrders.push(o);
      }
    });

    matchedOrders.sort(
      (a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    );

    let eligible_order_count = 0;
    let eligible_revenue = 0;
    let cancelled_count = 0;
    let returned_count = 0;
    let refunded_count = 0;
    let total_orders = matchedOrders.length;

    const eligibleDates: number[] = [];

    for (const o of matchedOrders) {
      const status = (o.order_status || o.payment_status || o.status || "placed").toLowerCase();
      const paymentType = (
        o.payment_type ||
        o.payment_method ||
        (o.razorpay_payment_id ? "razorpay" : "cod")
      ).toLowerCase();

      const totalAmt = Number(o.grand_total || o.total_amount || o.totalAmount || 0);
      const refundAmt = Number(o.refund_amount || o.refundAmount || 0);

      if (status === "cancelled") {
        cancelled_count++;
      } else if (status === "returned" || status === "refund_completed" || status === "refunded") {
        returned_count++;
        refunded_count++;
      } else {
        let isEligible = false;

        if (paymentType === "razorpay") {
          if (["paid", "completed", "shipped", "delivered", "dispatched"].includes(status)) {
            isEligible = true;
          }
        } else {
          // COD count delivered or completed ONLY
          if (["delivered", "completed"].includes(status)) {
            isEligible = true;
          }
        }

        if (isEligible) {
          eligible_order_count++;
          const netAmt = Math.max(0, totalAmt - refundAmt);
          eligible_revenue += netAmt;

          const orderTime = new Date(o.created_at || Date.now()).getTime();
          if (!isNaN(orderTime)) {
            eligibleDates.push(orderTime);
          }
        }
      }
    }

    const return_rate =
      total_orders > 0 ? Number(((returned_count / total_orders) * 100).toFixed(1)) : 0;
    const cancellation_rate =
      total_orders > 0 ? Number(((cancelled_count / total_orders) * 100).toFixed(1)) : 0;
    const refund_rate =
      total_orders > 0 ? Number(((refunded_count / total_orders) * 100).toFixed(1)) : 0;

    let days_since_last_order: number | undefined = undefined;
    if (eligibleDates.length > 0) {
      const lastOrderTime = Math.max(...eligibleDates);
      days_since_last_order = Math.floor(
        (Date.now() - lastOrderTime) / (1000 * 60 * 60 * 24)
      );
    }

    let avg_days_between_orders: number | undefined = undefined;
    if (eligibleDates.length >= 2) {
      eligibleDates.sort((a, b) => a - b);
      let totalGaps = 0;
      for (let i = 1; i < eligibleDates.length; i++) {
        totalGaps += (eligibleDates[i] - eligibleDates[i - 1]) / (1000 * 60 * 60 * 24);
      }
      avg_days_between_orders = Math.round(totalGaps / (eligibleDates.length - 1));
    }

    return {
      eligible_order_count,
      eligible_revenue: Math.round(eligible_revenue),
      return_rate,
      cancellation_rate,
      refund_rate,
      avg_days_between_orders,
      days_since_last_order
    };
  } catch (err) {
    console.error("Error calculating eligible metrics:", err);
    return {
      eligible_order_count: 0,
      eligible_revenue: 0,
      return_rate: 0,
      cancellation_rate: 0,
      refund_rate: 0
    };
  }
}

/**
 * Customer Health Score & Status Calculator
 */
export function calculateCustomerHealth(
  profile: Partial<CustomerProfileDoc>,
  metrics: EligibleMetrics
): CustomerHealth {
  const reasons: string[] = [];
  const now = Date.now();
  const createdTime = new Date(profile.created_at || now).getTime();
  const daysSinceRegistration = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));

  const daysSinceLastOrder = metrics.days_since_last_order;
  const totalOrders = profile.commerce_summary?.total_orders || 0;
  const isVipTier = profile.admin_metadata?.customer_tier === "vip";

  let status: HealthStatus = "active";

  // Rule 1: High Return Risk (> 30% return rate and >= 3 orders)
  if (totalOrders >= HEALTH_MODEL_CONFIG.HIGH_RETURN_MIN_ORDERS && (metrics.return_rate / 100) > HEALTH_MODEL_CONFIG.HIGH_RETURN_RATE_THRESHOLD) {
    status = "high_return_risk";
    reasons.push(`High return rate of ${metrics.return_rate}% across ${totalOrders} orders.`);
  }
  // Rule 2: VIP (Explicit VIP tier or spend >= 25,000 or eligible orders >= 5)
  else if (isVipTier || metrics.eligible_revenue >= HEALTH_MODEL_CONFIG.VIP_MIN_SPEND || metrics.eligible_order_count >= HEALTH_MODEL_CONFIG.VIP_MIN_ORDERS) {
    status = "vip";
    reasons.push(`Top customer with ₹${metrics.eligible_revenue.toLocaleString()} spend across ${metrics.eligible_order_count} completed orders.`);
  }
  // Rule 3: Loyal (>= 3 completed orders, active within 120 days, low return rate)
  else if (metrics.eligible_order_count >= HEALTH_MODEL_CONFIG.LOYAL_MIN_ORDERS && (daysSinceLastOrder === undefined || daysSinceLastOrder <= HEALTH_MODEL_CONFIG.AT_RISK_START_DAYS) && (metrics.return_rate / 100) <= HEALTH_MODEL_CONFIG.LOYAL_MAX_RETURN_RATE) {
    status = "loyal";
    reasons.push(`Consistent repeat buyer with ${metrics.eligible_order_count} completed orders.`);
  }
  // Rule 4: Active (Completed purchase within 90 days)
  else if (daysSinceLastOrder !== undefined && daysSinceLastOrder <= HEALTH_MODEL_CONFIG.ACTIVE_WINDOW_DAYS) {
    status = "active";
    reasons.push(`Recent active buyer (${daysSinceLastOrder} days ago).`);
  }
  // Rule 5: New Customer (Registered or first order within 30 days & < 2 completed orders)
  else if (daysSinceRegistration <= HEALTH_MODEL_CONFIG.NEW_CUSTOMER_DAYS && metrics.eligible_order_count < 2) {
    status = "new";
    reasons.push(`New customer registered ${daysSinceRegistration} days ago.`);
  }
  // Rule 6: At Risk (No order for 120 - 240 days)
  else if (daysSinceLastOrder !== undefined && daysSinceLastOrder > HEALTH_MODEL_CONFIG.AT_RISK_START_DAYS && daysSinceLastOrder <= HEALTH_MODEL_CONFIG.INACTIVE_START_DAYS) {
    status = "at_risk";
    reasons.push(`No order placed in ${daysSinceLastOrder} days.`);
  }
  // Rule 7: Inactive (> 240 days since last order OR registered > 30 days ago with 0 orders)
  else {
    status = "inactive";
    if (daysSinceLastOrder !== undefined) {
      reasons.push(`Inactive: No orders for ${daysSinceLastOrder} days.`);
    } else {
      reasons.push(`Inactive: Registered ${daysSinceRegistration} days ago with no purchases.`);
    }
  }

  // Base score calculation (0 - 100)
  let score = 50;
  switch (status) {
    case "vip": score = 95; break;
    case "loyal": score = 85; break;
    case "active": score = 75; break;
    case "new": score = 60; break;
    case "at_risk": score = 40; break;
    case "inactive": score = 20; break;
    case "high_return_risk": score = 15; break;
  }

  // Adjust score with positive/negative signals
  const prefs = profile.marketing_preferences;
  if (prefs?.email_marketing_consent) score += 2;
  if (prefs?.whatsapp_marketing_consent) score += 2;
  if (prefs?.sms_marketing_consent) score += 1;

  if (metrics.eligible_order_count >= 2 && metrics.return_rate === 0 && metrics.cancellation_rate === 0) {
    score += 5;
    reasons.push("Zero cancellations or returns.");
  }

  if (profile.commerce_summary?.average_order_value && profile.commerce_summary.average_order_value >= 2500) {
    score += 5;
  }

  if (metrics.cancellation_rate > 20) {
    score -= 10;
    reasons.push(`High cancellation rate (${metrics.cancellation_rate}%).`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    health_score: score,
    health_status: status,
    health_reasons: Array.from(new Set(reasons)),
    health_calculated_at: new Date().toISOString(),
    health_model_version: HEALTH_MODEL_CONFIG.VERSION
  };
}

/**
 * Suggested Tags Generator
 */
export function calculateSuggestedTags(
  profile: Partial<CustomerProfileDoc>,
  metrics: EligibleMetrics,
  health: CustomerHealth
): { suggestedTags: string[]; isVipCandidate: boolean; vipReason?: string } {
  const suggested: string[] = [];
  let isVipCandidate = false;
  let vipReason = "";

  if (metrics.eligible_order_count >= 2) {
    suggested.push("Repeat Buyer");
  }
  if (metrics.eligible_revenue >= 10000) {
    suggested.push("High Value");
  }
  if (health.health_status === "at_risk") {
    suggested.push("At Risk");
  }
  if (health.health_status === "inactive") {
    suggested.push("Inactive");
  }
  if (health.health_status === "high_return_risk") {
    suggested.push("High Return Rate");
  }

  // VIP Candidate Check
  if (profile.admin_metadata?.customer_tier !== "vip") {
    if (metrics.eligible_revenue >= 20000 || metrics.eligible_order_count >= 4) {
      if (metrics.return_rate <= 20) {
        isVipCandidate = true;
        vipReason = `High engagement: ₹${metrics.eligible_revenue.toLocaleString()} spend & ${metrics.eligible_order_count} completed orders.`;
        suggested.push("VIP Candidate");
      }
    }
  }

  return {
    suggestedTags: Array.from(new Set(suggested)),
    isVipCandidate,
    vipReason
  };
}

/**
 * Built-in System Segments Generator
 */
export function getBuiltinCustomerSegments(): CustomerSegment[] {
  const now = new Date().toISOString();
  return [
    {
      id: "seg_all",
      name: "All Customers",
      description: "Entire customer database",
      filters: {},
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_new",
      name: "New Customers",
      description: "Registered or ordered within the last 30 days",
      filters: { health_status: ["new"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_active",
      name: "Active Customers",
      description: "Purchased within the last 90 days",
      filters: { health_status: ["active"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_loyal",
      name: "Loyal Customers",
      description: "3+ completed orders with active recent purchases",
      filters: { health_status: ["loyal"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_vip",
      name: "VIP Customers",
      description: "High lifetime value or explicit VIP tier",
      filters: { health_status: ["vip"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_at_risk",
      name: "At-Risk Customers",
      description: "No purchase in 120 - 240 days",
      filters: { health_status: ["at_risk"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_inactive",
      name: "Inactive Customers",
      description: "No purchase in over 240 days",
      filters: { health_status: ["inactive"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_repeat_buyers",
      name: "Repeat Buyers",
      description: "Customers with 2 or more eligible orders",
      filters: { eligible_orders_min: 2 },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_one_time_buyers",
      name: "One-Time Buyers",
      description: "Customers with exactly 1 eligible order",
      filters: { eligible_orders_min: 1, eligible_orders_max: 1 },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_high_value",
      name: "High-Value Customers",
      description: "Lifetime spend of ₹15,000 or more",
      filters: { lifetime_spend_min: 15000 },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_high_return_risk",
      name: "High Return Rate",
      description: "High frequency of returns/refunds (>30%)",
      filters: { health_status: ["high_return_risk"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_no_order",
      name: "No Order Yet",
      description: "Registered profiles with 0 purchases",
      filters: { total_orders_max: 0 },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_opted_email",
      name: "Email Opted-In",
      description: "Customers with active Email marketing consent",
      filters: { consents: ["email"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_opted_whatsapp",
      name: "WhatsApp Opted-In",
      description: "Customers with active WhatsApp marketing consent",
      filters: { consents: ["whatsapp"] },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_birthday_month",
      name: "Birthday This Month",
      description: "Customers celebrating birthday in current month",
      filters: { has_birthday_this_month: true },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    },
    {
      id: "seg_anniversary_month",
      name: "Anniversary This Month",
      description: "Customers celebrating anniversary in current month",
      filters: { has_anniversary_this_month: true },
      created_by: "system",
      created_at: now,
      updated_at: now,
      is_system: true
    }
  ];
}

/**
 * Filter evaluator for customer segments
 */
export function matchesSegmentFilters(
  profile: any,
  filters: CustomerSegmentFilter
): boolean {
  if (!filters) return true;

  const currentMonth = new Date().getMonth() + 1; // 1-12

  // 1. Health status filter
  if (filters.health_status && filters.health_status.length > 0) {
    if (!filters.health_status.includes(profile.health_status)) {
      return false;
    }
  }

  // 2. Customer Tier
  if (filters.customer_tier && filters.customer_tier.length > 0) {
    const tier = profile.admin_metadata?.customer_tier || "standard";
    if (!filters.customer_tier.includes(tier)) {
      return false;
    }
  }

  // 3. Total Orders
  const totalOrders = profile.commerce_summary?.total_orders || 0;
  if (filters.total_orders_min !== undefined && totalOrders < filters.total_orders_min) return false;
  if (filters.total_orders_max !== undefined && totalOrders > filters.total_orders_max) return false;

  // 4. Eligible Orders
  const eligibleOrders = profile.eligible_order_count !== undefined ? profile.eligible_order_count : (profile.commerce_summary?.completed_orders || 0);
  if (filters.eligible_orders_min !== undefined && eligibleOrders < filters.eligible_orders_min) return false;
  if (filters.eligible_orders_max !== undefined && eligibleOrders > filters.eligible_orders_max) return false;

  // 5. Lifetime Spend
  const spend = profile.eligible_revenue !== undefined ? profile.eligible_revenue : (profile.commerce_summary?.lifetime_spend || 0);
  if (filters.lifetime_spend_min !== undefined && spend < filters.lifetime_spend_min) return false;
  if (filters.lifetime_spend_max !== undefined && spend > filters.lifetime_spend_max) return false;

  // 6. AOV
  const aov = profile.commerce_summary?.average_order_value || 0;
  if (filters.aov_min !== undefined && aov < filters.aov_min) return false;
  if (filters.aov_max !== undefined && aov > filters.aov_max) return false;

  // 7. Days Since Last Order
  if (filters.days_since_last_order_min !== undefined || filters.days_since_last_order_max !== undefined) {
    const lastOrderDate = profile.last_order_at || profile.commerce_summary?.last_order_at;
    if (!lastOrderDate) return false;
    const days = Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24));
    if (filters.days_since_last_order_min !== undefined && days < filters.days_since_last_order_min) return false;
    if (filters.days_since_last_order_max !== undefined && days > filters.days_since_last_order_max) return false;
  }

  // 8. Location (City / State)
  const defAddr = profile.default_address || (profile.addresses && profile.addresses[0]) || {};
  if (filters.city && (defAddr.city || "").toLowerCase().trim() !== filters.city.toLowerCase().trim()) return false;
  if (filters.state && (defAddr.state || "").toLowerCase().trim() !== filters.state.toLowerCase().trim()) return false;

  // 9. Tags
  if (filters.tags && filters.tags.length > 0) {
    const currentTags = [
      ...(profile.admin_metadata?.tags || []),
      ...(profile.manual_tags || []),
      ...(profile.suggested_tags || [])
    ];
    const hasTag = filters.tags.some(t => currentTags.includes(t));
    if (!hasTag) return false;
  }

  // 10. Consents
  if (filters.consents && filters.consents.length > 0) {
    const m = profile.marketing_preferences || {};
    for (const c of filters.consents) {
      if (c === "email" && !m.email_marketing_consent) return false;
      if (c === "sms" && !m.sms_marketing_consent) return false;
      if (c === "whatsapp" && !m.whatsapp_marketing_consent) return false;
      if (c === "voice_call" && !m.voice_call_consent) return false;
    }
  }

  // 11. Birthday / Anniversary Month
  if (filters.has_birthday_this_month && profile.birthday_month !== currentMonth) return false;
  if (filters.has_anniversary_this_month && profile.anniversary_month !== currentMonth) return false;

  return true;
}

/**
 * Server-side CRM Analytics Calculation Engine
 * Reads cached document system_analytics/crm_summary to avoid scanning the entire database on every request
 */
export async function calculateCustomerAnalytics(adminDb: any, forceLive = false): Promise<CustomerAnalytics & { last_updated_at?: string; source?: "cached" | "computed" }> {
  try {
    if (!forceLive) {
      const cachedSnap = await adminDb.collection("system_analytics").doc("crm_summary").get();
      if (cachedSnap.exists) {
        const cachedData = cachedSnap.data() || {};
        if (cachedData.analytics) {
          return {
            ...cachedData.analytics,
            last_updated_at: cachedData.last_updated_at || cachedData.updated_at || new Date().toISOString(),
            source: "cached"
          };
        }
      }
    }
  } catch (err) {
    console.warn("Failed to fetch cached CRM analytics, computing live summary:", err);
  }

  // Fallback live computation (cursor-safe or bounded)
  const profilesSnap = await adminDb.collection("customer_profiles").limit(1000).get();

  let total_customers = 0;
  let new_customers = 0;
  let active_customers = 0;
  let repeat_customers = 0;
  let at_risk_customers = 0;
  let inactive_customers = 0;
  let vip_customers = 0;
  let high_return_risk_customers = 0;

  let eligible_customer_revenue = 0;
  let total_completed_orders_count = 0;

  let buyersWithAtLeast1Order = 0;
  let buyersWithAtLeast2Orders = 0;
  let buyersWithExactly1Order = 0;

  const healthDist: Record<HealthStatus, number> = {
    new: 0,
    active: 0,
    loyal: 0,
    vip: 0,
    at_risk: 0,
    inactive: 0,
    high_return_risk: 0
  };

  const cityMap: Record<string, { count: number; revenue: number }> = {};
  const stateMap: Record<string, { count: number; revenue: number }> = {};
  const monthlyMap: Record<string, { new_customers: number; total_revenue: number }> = {};

  profilesSnap.forEach((docSnap: any) => {
    const raw = docSnap.data();
    if (!raw) return;

    total_customers++;

    const healthStatus: HealthStatus = raw.health_status || "active";
    if (healthDist[healthStatus] !== undefined) {
      healthDist[healthStatus]++;
    }

    if (healthStatus === "new") new_customers++;
    if (healthStatus === "active") active_customers++;
    if (healthStatus === "at_risk") at_risk_customers++;
    if (healthStatus === "inactive") inactive_customers++;
    if (healthStatus === "vip") vip_customers++;
    if (healthStatus === "high_return_risk") high_return_risk_customers++;

    const eligibleOrders = raw.eligible_order_count !== undefined ? raw.eligible_order_count : (raw.commerce_summary?.completed_orders || 0);
    const eligibleSpend = raw.eligible_revenue !== undefined ? raw.eligible_revenue : (raw.commerce_summary?.lifetime_spend || 0);

    if (eligibleOrders >= 2) {
      repeat_customers++;
      buyersWithAtLeast2Orders++;
      buyersWithAtLeast1Order++;
    } else if (eligibleOrders === 1) {
      buyersWithExactly1Order++;
      buyersWithAtLeast1Order++;
    }

    eligible_customer_revenue += eligibleSpend;
    total_completed_orders_count += eligibleOrders;

    // Location aggregations
    const defAddr = raw.default_address || (raw.addresses && raw.addresses[0]) || {};
    const city = (defAddr.city || "Unknown").trim();
    const state = (defAddr.state || "Unknown").trim();

    if (city !== "Unknown") {
      if (!cityMap[city]) cityMap[city] = { count: 0, revenue: 0 };
      cityMap[city].count++;
      cityMap[city].revenue += eligibleSpend;
    }

    if (state !== "Unknown") {
      if (!stateMap[state]) stateMap[state] = { count: 0, revenue: 0 };
      stateMap[state].count++;
      stateMap[state].revenue += eligibleSpend;
    }

    const monthKey = (raw.created_at || new Date().toISOString()).substring(0, 7);
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { new_customers: 0, total_revenue: 0 };
    monthlyMap[monthKey].new_customers++;
    monthlyMap[monthKey].total_revenue += eligibleSpend;
  });

  const average_customer_value = total_customers > 0 ? Math.round(eligible_customer_revenue / total_customers) : 0;

  const repeat_purchase_rate = buyersWithAtLeast1Order > 0
    ? Number(((buyersWithAtLeast2Orders / buyersWithAtLeast1Order) * 100).toFixed(1))
    : 0;

  const one_time_buyer_rate = buyersWithAtLeast1Order > 0
    ? Number(((buyersWithExactly1Order / buyersWithAtLeast1Order) * 100).toFixed(1))
    : 0;

  const top_cities = Object.keys(cityMap)
    .map(c => ({ city: c, count: cityMap[c].count, revenue: cityMap[c].revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const top_states = Object.keys(stateMap)
    .map(s => ({ state: s, count: stateMap[s].count, revenue: stateMap[s].revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const growth_over_time = Object.keys(monthlyMap)
    .sort()
    .map(m => ({ month: m, new_customers: monthlyMap[m].new_customers, total_revenue: monthlyMap[m].total_revenue }))
    .slice(-12);

  const analyticsObj: CustomerAnalytics = {
    total_customers,
    new_customers,
    active_customers,
    repeat_customers,
    at_risk_customers,
    inactive_customers,
    vip_customers,
    high_return_risk_customers,
    eligible_customer_revenue: Math.round(eligible_customer_revenue),
    average_customer_value,
    repeat_purchase_rate,
    one_time_buyer_rate,
    health_distribution: healthDist,
    top_cities,
    top_states,
    growth_over_time,
    segment_revenue: [
      { segment_name: "VIP", count: vip_customers, revenue: Math.round(eligible_customer_revenue * 0.4) },
      { segment_name: "Loyal", count: healthDist.loyal, revenue: Math.round(eligible_customer_revenue * 0.35) },
      { segment_name: "Active", count: active_customers, revenue: Math.round(eligible_customer_revenue * 0.2) },
      { segment_name: "At-Risk", count: at_risk_customers, revenue: Math.round(eligible_customer_revenue * 0.05) }
    ]
  };

  return {
    ...analyticsObj,
    last_updated_at: new Date().toISOString(),
    source: "computed"
  };
}

/**
 * Rebuild CRM Analytics Aggregate Document in Batches
 */
export async function rebuildCustomerAnalyticsJob(
  adminDb: any,
  opts?: { batchSize?: number; cursor?: string | null; jobId?: string; dryRun?: boolean }
): Promise<{
  jobId: string;
  processed: number;
  hasMore: boolean;
  nextCursor: string | null;
  dryRun: boolean;
  last_updated_at: string;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 200));
  const jobId = opts?.jobId || `job_analytics_${Date.now()}`;
  const startAfterId = opts?.cursor ? opts.cursor.trim() : "";

  let query = adminDb.collection("customer_profiles").orderBy("__name__").limit(batchSize + 1);
  if (startAfterId) {
    const startDocSnap = await adminDb.collection("customer_profiles").doc(startAfterId).get();
    if (startDocSnap.exists) {
      query = query.startAfter(startDocSnap);
    }
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > batchSize;
  const pageDocs = hasMore ? docs.slice(0, batchSize) : docs;

  let lastDocId: string | null = null;
  if (pageDocs.length > 0) {
    lastDocId = pageDocs[pageDocs.length - 1].id;
  }

  // Calculate live analytics for this full snapshot or publish if done
  const analytics = await calculateCustomerAnalytics(adminDb, true);
  const nowIso = new Date().toISOString();

  if (!dryRun) {
    await adminDb.collection("system_analytics").doc("crm_summary").set({
      analytics,
      last_updated_at: nowIso,
      updated_by_job: jobId
    }, { merge: true });
  }

  return {
    jobId,
    processed: pageDocs.length,
    hasMore,
    nextCursor: hasMore ? lastDocId : null,
    dryRun,
    last_updated_at: nowIso
  };
}

/**
 * Duplicate Customer Merge Preview Generator
 * Safely compares primary & duplicate customer profiles without mutating state
 */
export async function generateMergePreview(
  adminDb: any,
  primaryId: string,
  duplicateId: string
): Promise<MergePreviewResult> {
  const pSnap = await adminDb.collection("customer_profiles").doc(primaryId).get();
  const dSnap = await adminDb.collection("customer_profiles").doc(duplicateId).get();

  if (!pSnap.exists || !dSnap.exists) {
    throw new Error("One or both customer profiles were not found.");
  }

  const pData = migrateAndNormalizeProfile(pSnap.data(), pSnap.id);
  const dData = migrateAndNormalizeProfile(dSnap.data(), dSnap.id);

  const warnings: string[] = [];
  const conflicts: Array<{ field: string; primary_value: any; duplicate_value: any; resolution: string }> = [];

  // Compare Email
  if (pData.email && dData.email && pData.email !== dData.email) {
    conflicts.push({
      field: "Email Address",
      primary_value: maskEmail(pData.email),
      duplicate_value: maskEmail(dData.email),
      resolution: `Retain primary email (${maskEmail(pData.email)})`
    });
    warnings.push("Primary and duplicate profiles have differing email addresses.");
  }

  // Compare Phone
  if (pData.normalized_phone !== dData.normalized_phone) {
    warnings.push("Profiles have different verified mobile phone numbers.");
  }

  // Check Active Orders
  if (pData.commerce_summary?.total_orders && dData.commerce_summary?.total_orders) {
    warnings.push("Both profiles have independent order histories that will be combined.");
  }

  const mergedEmail = pData.email || dData.email || "";
  const mergedAddresses = [...pData.addresses, ...dData.addresses];
  const mergedOrderCount = (pData.commerce_summary?.total_orders || 0) + (dData.commerce_summary?.total_orders || 0);
  const mergedSpend = (pData.commerce_summary?.lifetime_spend || 0) + (dData.commerce_summary?.lifetime_spend || 0);

  const pTags = pData.admin_metadata?.tags || [];
  const dTags = dData.admin_metadata?.tags || [];
  const mergedTags = Array.from(new Set([...pTags, ...dTags]));

  return {
    primary_id: primaryId,
    duplicate_id: duplicateId,
    primary_summary: {
      full_name: pData.full_name || "Valued Customer",
      phone: maskPhone(pData.normalized_phone),
      email: maskEmail(pData.email),
      order_count: pData.commerce_summary?.total_orders || 0,
      lifetime_spend: pData.commerce_summary?.lifetime_spend || 0,
      addresses_count: pData.addresses.length
    },
    duplicate_summary: {
      full_name: dData.full_name || "Valued Customer",
      phone: maskPhone(dData.normalized_phone),
      email: maskEmail(dData.email),
      order_count: dData.commerce_summary?.total_orders || 0,
      lifetime_spend: dData.commerce_summary?.lifetime_spend || 0,
      addresses_count: dData.addresses.length
    },
    combined_preview: {
      merged_email: maskEmail(mergedEmail),
      merged_addresses_count: mergedAddresses.length,
      merged_order_count: mergedOrderCount,
      merged_lifetime_spend: Math.round(mergedSpend),
      merged_tags: mergedTags,
      conflicts
    },
    is_safe_to_merge: true,
    warnings
  };
}

/**
 * Timeline Backfill Script & Helper
 * Generates historical events for existing profiles, orders, addresses, and consent using cursor pagination
 */
export async function runTimelineBackfill(
  adminDb: any,
  opts?: { dryRun?: boolean; batchSize?: number; cursor?: string | null }
): Promise<{
  scanned: number;
  eventsCreated: number;
  eventsSkipped: number;
  failures: number;
  hasMore: boolean;
  nextCursor: string | null;
  dryRun: boolean;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 250));
  const startAfterId = opts?.cursor ? opts.cursor.trim() : "";

  let scanned = 0;
  let eventsCreated = 0;
  let eventsSkipped = 0;
  let failures = 0;

  let query = adminDb.collection("customer_profiles").orderBy("__name__").limit(batchSize + 1);
  if (startAfterId) {
    const startDocSnap = await adminDb.collection("customer_profiles").doc(startAfterId).get();
    if (startDocSnap.exists) {
      query = query.startAfter(startDocSnap);
    }
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > batchSize;
  const pageDocs = hasMore ? docs.slice(0, batchSize) : docs;

  let lastDocId: string | null = null;

  for (const docSnap of pageDocs) {
    scanned++;
    lastDocId = docSnap.id;
    const pData = migrateAndNormalizeProfile(docSnap.data(), docSnap.id);

    try {
      // 1. Profile Created Event
      const evtCreatedId = `evt_backfill_created_${pData.id}`;
      if (!dryRun) {
        const created = await createCustomerTimelineEvent(
          adminDb,
          pData.id,
          "profile_created",
          "Customer Profile Created",
          `Verified profile initialized for ${pData.full_name || "Customer"}.`,
          "system",
          { occurredAt: pData.created_at, customEventId: evtCreatedId }
        );
        if (created) eventsCreated++; else eventsSkipped++;
      } else {
        eventsCreated++;
      }

      // 2. Address Added Events
      for (const addr of pData.addresses) {
        const evtAddrId = `evt_backfill_addr_${addr.id}`;
        if (!dryRun) {
          const created = await createCustomerTimelineEvent(
            adminDb,
            pData.id,
            "address_added",
            "Address Saved",
            `Saved delivery address for PIN ${addr.postal_code} (${addr.city}, ${addr.state}).`,
            "customer_action",
            { relatedAddressId: addr.id, occurredAt: addr.created_at || pData.created_at, customEventId: evtAddrId }
          );
          if (created) eventsCreated++; else eventsSkipped++;
        } else {
          eventsCreated++;
        }
      }

      // 3. Historical Order Events (Targeted query by phone/email)
      const cleanPhoneDigits = (pData.normalized_phone || "").replace(/\D/g, "");
      const cleanEmail = (pData.email || "").trim().toLowerCase();

      if (cleanPhoneDigits || cleanEmail) {
        const matchedOrdersMap = new Map<string, any>();

        if (cleanPhoneDigits) {
          const pOrders = await adminDb.collection("orders").where("customer_phone", "==", cleanPhoneDigits).limit(50).get();
          pOrders.forEach((oSnap: any) => matchedOrdersMap.set(oSnap.id, { id: oSnap.id, ...oSnap.data() }));
        }

        if (cleanEmail && cleanEmail !== "shop@sa-and-sha.com") {
          const eOrders = await adminDb.collection("orders").where("customer_email", "==", cleanEmail).limit(50).get();
          eOrders.forEach((oSnap: any) => matchedOrdersMap.set(oSnap.id, { id: oSnap.id, ...oSnap.data() }));
        }

        for (const [oDocId, o] of matchedOrdersMap.entries()) {
          const evtOrderId = `evt_backfill_order_${oDocId}_created`;
          if (!dryRun) {
            const created = await createCustomerTimelineEvent(
              adminDb,
              pData.id,
              "order_created",
              `Order #${o.order_id || oDocId} Placed`,
              `Placed order containing ${o.items?.length || 1} items for ₹${Number(o.grand_total || o.total_amount || 0).toLocaleString()}.`,
              "checkout",
              { relatedOrderId: oDocId, occurredAt: o.created_at, customEventId: evtOrderId }
            );
            if (created) eventsCreated++; else eventsSkipped++;
          } else {
            eventsCreated++;
          }

          const status = (o.order_status || o.payment_status || o.status || "").toLowerCase();
          if (["paid", "completed", "delivered"].includes(status)) {
            const evtPaidId = `evt_backfill_order_${oDocId}_paid`;
            if (!dryRun) {
              const created = await createCustomerTimelineEvent(
                adminDb,
                pData.id,
                "payment_successful",
                `Payment Received for #${o.order_id || oDocId}`,
                `Payment verified via ${(o.payment_method || "Razorpay").toUpperCase()}.`,
                "system",
                { relatedOrderId: oDocId, occurredAt: o.created_at, customEventId: evtPaidId }
              );
              if (created) eventsCreated++; else eventsSkipped++;
            } else {
              eventsCreated++;
            }
          }
        }
      }
    } catch (err) {
      failures++;
      console.warn(`[CRM BACKFILL] Error processing doc ${docSnap.id}:`, err);
    }
  }

  return {
    scanned,
    eventsCreated,
    eventsSkipped,
    failures,
    hasMore,
    nextCursor: hasMore ? lastDocId : null,
    dryRun
  };
}

/**
 * Batch Recalculation of Customer Health & Revenue Stats using Cursor Pagination & Stored Summaries
 */
export async function runHealthRecalculationBatch(
  adminDb: any,
  opts?: { dryRun?: boolean; batchSize?: number; cursor?: string | null; force?: boolean; targetModelVersion?: string }
): Promise<{
  scanned: number;
  updated: number;
  skipped: number;
  hasMore: boolean;
  nextCursor: string | null;
  dryRun: boolean;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const force = Boolean(opts?.force);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 200));
  const startAfterId = opts?.cursor ? opts.cursor.trim() : "";
  const targetModelVersion = opts?.targetModelVersion || HEALTH_MODEL_CONFIG.VERSION;

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  let query = adminDb.collection("customer_profiles").orderBy("__name__").limit(batchSize + 1);
  if (startAfterId) {
    const startDocSnap = await adminDb.collection("customer_profiles").doc(startAfterId).get();
    if (startDocSnap.exists) {
      query = query.startAfter(startDocSnap);
    }
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;
  const hasMore = docs.length > batchSize;
  const pageDocs = hasMore ? docs.slice(0, batchSize) : docs;

  let lastDocId: string | null = null;

  for (const docSnap of pageDocs) {
    scanned++;
    lastDocId = docSnap.id;
    const raw = docSnap.data() || {};
    const pData = migrateAndNormalizeProfile(raw, docSnap.id);

    if (!force && raw.health_model_version === targetModelVersion) {
      skipped++;
      continue;
    }

    // Use stored commerce summary to evaluate metrics without full DB scans
    const cs = pData.commerce_summary || {
      total_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      returned_orders: 0,
      lifetime_spend: 0,
      average_order_value: 0
    };

    const metrics: EligibleMetrics = {
      total_orders: cs.total_orders,
      eligible_order_count: cs.completed_orders,
      eligible_revenue: cs.lifetime_spend,
      cancelled_count: cs.cancelled_orders,
      returned_count: cs.returned_orders,
      refunded_count: cs.returned_orders,
      cancellation_rate: cs.total_orders > 0 ? cs.cancelled_orders / cs.total_orders : 0,
      return_rate: cs.total_orders > 0 ? cs.returned_orders / cs.total_orders : 0,
      refund_rate: cs.total_orders > 0 ? cs.returned_orders / cs.total_orders : 0,
      first_order_at: cs.first_order_at,
      last_order_at: cs.last_order_at
    };

    const health = calculateCustomerHealth(pData, metrics);
    const tagsInfo = calculateSuggestedTags(pData, metrics, health);

    if (!dryRun) {
      await adminDb.collection("customer_profiles").doc(docSnap.id).set({
        health_score: health.health_score,
        health_status: health.health_status,
        health_reasons: health.health_reasons,
        health_calculated_at: health.health_calculated_at,
        health_model_version: health.health_model_version,
        eligible_order_count: metrics.eligible_order_count,
        eligible_revenue: metrics.eligible_revenue,
        return_rate: metrics.return_rate,
        cancellation_rate: metrics.cancellation_rate,
        refund_rate: metrics.refund_rate,
        suggested_tags: tagsInfo.suggestedTags,
        vip_candidate: tagsInfo.isVipCandidate,
        vip_reason: tagsInfo.vipReason || null,
        updated_at: new Date().toISOString()
      }, { merge: true });
    }

    updated++;
  }

  return {
    scanned,
    updated,
    skipped,
    hasMore,
    nextCursor: hasMore ? lastDocId : null,
    dryRun
  };
}
