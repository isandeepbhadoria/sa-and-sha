import crypto from "crypto";
import {
  LoyaltyLedgerEntry,
  LoyaltyEntryType,
  LoyaltyEntryStatus,
  StoreCreditLedgerEntry,
  StoreCreditEntryType,
  LoyaltySummary,
  StoreCreditSummary,
  LoyaltyRedemptionAllocation,
  LoyaltyTierName
} from "../types/loyalty";
import { DEFAULT_LOYALTY_POLICY, getLoyaltyPolicy, calculateEarnedPoints, getTierConfigForSpend, validateAndCalculateLoyaltyRedemption } from "./loyaltyPolicy";
import { createCustomerTimelineEvent } from "./crmHelpers";

/**
 * Generate a deterministic hash string for ledger idempotency keys
 */
export function generateLedgerIdempotencyKey(prefix: string, identifier: string): string {
  const cleanId = identifier.trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(`${prefix}:${cleanId}`).digest("hex").slice(0, 32);
  return `${prefix}_${hash}`;
}

/**
 * Recalculate authoritative loyalty summary by aggregating customer's loyalty ledger entries
 */
export async function recalculateLoyaltySummaryFromLedger(
  adminDb: any,
  profileId: string,
  transaction?: any
): Promise<LoyaltySummary> {
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const ledgerCol = profileRef.collection("loyalty_ledger");

  const snapshot = transaction
    ? await transaction.get(ledgerCol)
    : await ledgerCol.get();

  let availablePoints = 0;
  let pendingPoints = 0;
  let lifetimeEarned = 0;
  let lifetimeRedeemed = 0;
  let lifetimeExpired = 0;
  let lifetimeReversed = 0;

  snapshot.forEach((docSnap: any) => {
    const entry: LoyaltyLedgerEntry = docSnap.data();
    if (!entry) return;

    if (entry.status === "available") {
      availablePoints += entry.balance_effect;
    } else if (entry.status === "pending") {
      pendingPoints += entry.points;
    }

    if (["earn_pending", "earn_available", "manual_adjustment_positive", "birthday_bonus_future", "referral_bonus_future", "welcome_bonus_future"].includes(entry.entry_type)) {
      if (entry.points > 0) {
        lifetimeEarned += entry.points;
      }
    } else if (entry.entry_type === "redeem") {
      lifetimeRedeemed += Math.abs(entry.points);
    } else if (entry.entry_type === "expiry") {
      lifetimeExpired += Math.abs(entry.points);
    } else if (["redeem_reversal", "order_cancel_reversal", "return_reversal", "refund_reversal"].includes(entry.entry_type)) {
      lifetimeReversed += Math.abs(entry.points);
    }
  });

  // Fetch rolling 12m spend to evaluate tier
  const profileSnap = transaction ? await transaction.get(profileRef) : await profileRef.get();
  const profileData = profileSnap.exists ? profileSnap.data() : {};
  const commerceSummary = profileData?.commerce_summary || {};
  const rolling12mSpend = Number(commerceSummary.lifetime_spend || 0); // fallback to lifetime_spend if rolling not isolated

  const tierConfig = getTierConfigForSpend(rolling12mSpend);
  const currentTier = tierConfig.tier;

  let nextTier: LoyaltyTierName | null = null;
  let requiredSpend = 0;

  if (currentTier === "MEMBER") {
    nextTier = "SILVER";
    requiredSpend = Math.max(0, 15000 - rolling12mSpend);
  } else if (currentTier === "SILVER") {
    nextTier = "GOLD";
    requiredSpend = Math.max(0, 40000 - rolling12mSpend);
  } else if (currentTier === "GOLD") {
    nextTier = "PLATINUM";
    requiredSpend = Math.max(0, 80000 - rolling12mSpend);
  }

  const summary: LoyaltySummary = {
    available_points: Math.max(0, availablePoints),
    pending_points: Math.max(0, pendingPoints),
    lifetime_points_earned: Math.max(0, lifetimeEarned),
    lifetime_points_redeemed: Math.max(0, lifetimeRedeemed),
    lifetime_points_expired: Math.max(0, lifetimeExpired),
    lifetime_points_reversed: Math.max(0, lifetimeReversed),
    current_tier: currentTier,
    tier_progress: {
      rolling_12m_spend_rupees: rolling12mSpend,
      next_tier: nextTier,
      spend_required_for_next_tier_rupees: requiredSpend
    },
    calculated_at: new Date().toISOString(),
    version: DEFAULT_LOYALTY_POLICY.policyVersion
  };

  const updateData = {
    loyalty_summary: summary,
    loyalty_tier: currentTier,
    updated_at: new Date().toISOString()
  };

  if (transaction) {
    transaction.set(profileRef, updateData, { merge: true });
  } else {
    await profileRef.set(updateData, { merge: true });
  }

  return summary;
}

/**
 * Recalculate authoritative store credit summary by aggregating store_credit_ledger entries
 */
export async function recalculateStoreCreditSummaryFromLedger(
  adminDb: any,
  profileId: string,
  transaction?: any
): Promise<StoreCreditSummary> {
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const creditCol = profileRef.collection("store_credit_ledger");

  const snapshot = transaction
    ? await transaction.get(creditCol)
    : await creditCol.get();

  let availablePaise = 0;
  let lifetimeIssuedPaise = 0;
  let lifetimeUsedPaise = 0;
  let lifetimeExpiredPaise = 0;
  let lifetimeReversedPaise = 0;

  snapshot.forEach((docSnap: any) => {
    const entry: StoreCreditLedgerEntry = docSnap.data();
    if (!entry) return;

    if (entry.status === "active") {
      availablePaise += entry.balance_effect_paise;
    }

    if (["refund_credit", "return_credit", "goodwill_credit", "manual_credit"].includes(entry.entry_type)) {
      if (entry.amount_paise > 0) {
        lifetimeIssuedPaise += entry.amount_paise;
      }
    } else if (entry.entry_type === "redemption") {
      lifetimeUsedPaise += Math.abs(entry.amount_paise);
    } else if (entry.entry_type === "expiry") {
      lifetimeExpiredPaise += Math.abs(entry.amount_paise);
    } else if (entry.entry_type === "redemption_reversal") {
      lifetimeReversedPaise += Math.abs(entry.amount_paise);
    }
  });

  const availableRupees = Math.floor(Math.max(0, availablePaise) / 100);

  const summary: StoreCreditSummary = {
    available_balance_paise: Math.max(0, availablePaise),
    available_balance_rupees: availableRupees,
    lifetime_issued_paise: Math.max(0, lifetimeIssuedPaise),
    lifetime_used_paise: Math.max(0, lifetimeUsedPaise),
    lifetime_expired_paise: Math.max(0, lifetimeExpiredPaise),
    lifetime_reversed_paise: Math.max(0, lifetimeReversedPaise),
    calculated_at: new Date().toISOString(),
    version: DEFAULT_LOYALTY_POLICY.policyVersion
  };

  const updateData = {
    store_credit_summary: summary,
    updated_at: new Date().toISOString()
  };

  if (transaction) {
    transaction.set(profileRef, updateData, { merge: true });
  } else {
    await profileRef.set(updateData, { merge: true });
  }

  return summary;
}

/**
 * Record a new loyalty ledger entry with strict idempotency
 */
export async function recordLoyaltyLedgerEntry(
  adminDb: any,
  entry: Omit<LoyaltyLedgerEntry, "id">,
  transaction?: any
): Promise<{ success: boolean; entryId: string; duplicate: boolean }> {
  const profileRef = adminDb.collection("customer_profiles").doc(entry.customer_profile_id);
  const entryDocRef = profileRef.collection("loyalty_ledger").doc(entry.idempotency_key);

  if (transaction) {
    const existingSnap = await transaction.get(entryDocRef);
    if (existingSnap.exists) {
      return { success: true, entryId: entryDocRef.id, duplicate: true };
    }
    const fullEntry: LoyaltyLedgerEntry = {
      ...entry,
      id: entryDocRef.id
    };
    transaction.set(entryDocRef, fullEntry);
    await recalculateLoyaltySummaryFromLedger(adminDb, entry.customer_profile_id, transaction);
    return { success: true, entryId: entryDocRef.id, duplicate: false };
  } else {
    return await adminDb.runTransaction(async (tx: any) => {
      const existingSnap = await tx.get(entryDocRef);
      if (existingSnap.exists) {
        return { success: true, entryId: entryDocRef.id, duplicate: true };
      }
      const fullEntry: LoyaltyLedgerEntry = {
        ...entry,
        id: entryDocRef.id
      };
      tx.set(entryDocRef, fullEntry);
      await recalculateLoyaltySummaryFromLedger(adminDb, entry.customer_profile_id, tx);
      return { success: true, entryId: entryDocRef.id, duplicate: false };
    });
  }
}

/**
 * Record a new store credit ledger entry with strict idempotency
 */
export async function recordStoreCreditLedgerEntry(
  adminDb: any,
  entry: Omit<StoreCreditLedgerEntry, "id">,
  transaction?: any
): Promise<{ success: boolean; entryId: string; duplicate: boolean }> {
  const profileRef = adminDb.collection("customer_profiles").doc(entry.customer_profile_id);
  const entryDocRef = profileRef.collection("store_credit_ledger").doc(entry.idempotency_key);

  if (transaction) {
    const existingSnap = await transaction.get(entryDocRef);
    if (existingSnap.exists) {
      return { success: true, entryId: entryDocRef.id, duplicate: true };
    }
    const fullEntry: StoreCreditLedgerEntry = {
      ...entry,
      id: entryDocRef.id
    };
    transaction.set(entryDocRef, fullEntry);
    await recalculateStoreCreditSummaryFromLedger(adminDb, entry.customer_profile_id, transaction);
    return { success: true, entryId: entryDocRef.id, duplicate: false };
  } else {
    return await adminDb.runTransaction(async (tx: any) => {
      const existingSnap = await tx.get(entryDocRef);
      if (existingSnap.exists) {
        return { success: true, entryId: entryDocRef.id, duplicate: true };
      }
      const fullEntry: StoreCreditLedgerEntry = {
        ...entry,
        id: entryDocRef.id
      };
      tx.set(entryDocRef, fullEntry);
      await recalculateStoreCreditSummaryFromLedger(adminDb, entry.customer_profile_id, tx);
      return { success: true, entryId: entryDocRef.id, duplicate: false };
    });
  }
}

/**
 * Earn points for an order based on payment and delivery status
 */
export async function processOrderPointsEarning(
  adminDb: any,
  order: any,
  profileId: string
): Promise<{ pointsEarned: number; status: LoyaltyEntryStatus; entryId: string | null }> {
  const status = (order.status || "").toLowerCase();
  const paymentStatus = (order.payment_status || "").toLowerCase();
  const paymentMethod = (order.payment_method || "").toLowerCase();

  // Check order eligibility
  if (["cancelled", "failed", "unpaid"].includes(status) || paymentStatus === "failed") {
    return { pointsEarned: 0, status: "reversed", entryId: null };
  }

  // Calculate net eligible spend (Subtotal - promo discount - points discount)
  const subtotal = Number(order.subtotal || order.grand_total || 0);
  const promoDiscount = Number(order.discount || 0);
  const pointsDiscount = Number(order.loyalty_discount_rupees || 0);
  const creditDiscount = Number(order.store_credit_used_rupees || 0);

  const netEligibleSpend = Math.max(0, subtotal - promoDiscount - pointsDiscount - creditDiscount);

  if (netEligibleSpend <= 0) {
    return { pointsEarned: 0, status: "pending", entryId: null };
  }

  // Fetch active policy and customer tier
  const policy = await getLoyaltyPolicy(adminDb);
  const profileSnap = await adminDb.collection("customer_profiles").doc(profileId).get();
  const profileData = profileSnap.exists ? profileSnap.data() : {};
  const currentTier: LoyaltyTierName = profileData?.loyalty_summary?.current_tier || profileData?.loyalty_tier || "MEMBER";
  const tierConfig = (policy.tiers || DEFAULT_LOYALTY_POLICY.tiers).find(t => t.tier === currentTier) || DEFAULT_LOYALTY_POLICY.tiers[0];

  const pointsEarned = calculateEarnedPoints(netEligibleSpend, tierConfig.earning_multiplier);
  if (pointsEarned <= 0) {
    return { pointsEarned: 0, status: "pending", entryId: null };
  }

  const nowIso = new Date().toISOString();
  const orderId = order.order_id || order.id;
  const idempotencyKey = generateLedgerIdempotencyKey("earn", orderId);

  // Determine availability status
  let isAvailableImmediately = false;
  let availableAt: string | undefined = undefined;

  const pendingDays = policy.pointsPendingDaysAfterDelivery || DEFAULT_LOYALTY_POLICY.pointsPendingDaysAfterDelivery || 7;

  if (status === "delivered") {
    // 7 days post-delivery holding period (or policy configured days)
    const deliveryTime = order.delivered_at ? new Date(order.delivered_at).getTime() : Date.now();
    const availTime = deliveryTime + pendingDays * 24 * 60 * 60 * 1000;
    availableAt = new Date(availTime).toISOString();
    // On delivery, points are created as PENDING to respect the 7-day return window
    isAvailableImmediately = false;
  }

  const entryStatus: LoyaltyEntryStatus = isAvailableImmediately ? "available" : "pending";
  const expiryTime = new Date(Date.now() + (policy.pointsExpiryMonths || 12) * 30 * 24 * 60 * 60 * 1000).toISOString();

  const entryData: Omit<LoyaltyLedgerEntry, "id"> = {
    customer_profile_id: profileId,
    customer_id: profileData.customer_id || "SS-C00000",
    entry_type: isAvailableImmediately ? "earn_available" : "earn_pending",
    points: pointsEarned,
    balance_effect: isAvailableImmediately ? pointsEarned : 0,
    status: entryStatus,
    source: "checkout",
    related_order_id: orderId,
    idempotency_key: idempotencyKey,
    description: `Earned ${pointsEarned} points for Order #${orderId} (${currentTier} Tier ${tierConfig.earning_multiplier}x)`,
    earned_at: nowIso,
    available_at: availableAt,
    expires_at: expiryTime,
    created_at: nowIso,
    created_by: "system"
  };

  (entryData as any).policy_snapshot = {
    policyVersion: policy.policyVersion || "1.0",
    rupeesPerPoint: policy.pointsPerRupees || 100,
    tierAtEarningTime: currentTier,
    tierMultiplier: tierConfig.earning_multiplier,
    eligibleSpend: netEligibleSpend,
    calculatedBasePoints: Math.floor(netEligibleSpend / (policy.pointsPerRupees || 100)),
    finalPoints: pointsEarned,
    pendingDays: pendingDays
  };

  const res = await recordLoyaltyLedgerEntry(adminDb, entryData);

  if (!res.duplicate) {
    await createCustomerTimelineEvent(
      adminDb,
      profileId,
      entryStatus === "available" ? "points_available" : "points_earned_pending",
      `Points ${entryStatus === "available" ? "Unlocked" : "Earned (Pending)"}`,
      `${pointsEarned} reward points ${entryStatus === "available" ? "added to available balance" : "in pending status"} for Order #${orderId}.`,
      "checkout",
      { relatedOrderId: orderId, customEventId: `evt_${idempotencyKey}` }
    );
  }

  return { pointsEarned, status: entryStatus, entryId: res.entryId };
}

/**
 * Scheduled Batch Processor: Convert pending points to available once delivery & return window passes
 */
export async function releasePendingPointsBatch(
  adminDb: any,
  opts?: { dryRun?: boolean; batchSize?: number; cursor?: string | null }
): Promise<{
  scanned: number;
  released: number;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 100));
  const nowIso = new Date().toISOString();

  let scanned = 0;
  let released = 0;

  // Collection group query for pending loyalty entries where available_at <= now
  let query = adminDb.collectionGroup("loyalty_ledger")
    .where("status", "==", "pending")
    .orderBy("available_at", "asc")
    .limit(batchSize + 1);

  if (opts?.cursor) {
    const cursorDocSnap = await adminDb.collectionGroup("loyalty_ledger").doc(opts.cursor).get();
    if (cursorDocSnap.exists) {
      query = query.startAfter(cursorDocSnap);
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
    const entry: LoyaltyLedgerEntry = docSnap.data();

    if (entry.available_at && entry.available_at <= nowIso) {
      // Check if related order has an active return request or cancellation
      if (entry.related_order_id) {
        try {
          const retSnap = await adminDb.collection("return_requests")
            .where("order_id", "==", entry.related_order_id)
            .limit(1)
            .get();
          if (!retSnap.empty) {
            const rData = retSnap.docs[0].data();
            const rStatus = (rData.status || "").toLowerCase();
            if (!["cancelled", "rejected"].includes(rStatus)) {
              // Active return or exchange exists; do not release points
              continue;
            }
          }

          const orderDoc = await adminDb.collection("orders").doc(entry.related_order_id).get();
          if (orderDoc.exists) {
            const oData = orderDoc.data();
            const oStatus = (oData.order_status || oData.status || "").toLowerCase();
            if (["cancelled", "returned", "refunded"].includes(oStatus) || oData.cancellation_requested) {
              // Order cancelled or returned; do not release points
              continue;
            }
          }
        } catch (err) {
          console.warn("[LOYALTY BATCH] Error checking order return status during points release:", err);
        }
      }

      if (!dryRun) {
        await adminDb.runTransaction(async (tx: any) => {
          tx.update(docSnap.ref, {
            status: "available",
            balance_effect: entry.points,
            entry_type: "earn_available",
            updated_at: nowIso
          });
          await recalculateLoyaltySummaryFromLedger(adminDb, entry.customer_profile_id, tx);
        });

        await createCustomerTimelineEvent(
          adminDb,
          entry.customer_profile_id,
          "points_available",
          "Pending Points Available",
          `${entry.points} pending points are now available for redemption!`,
          "system",
          { relatedOrderId: entry.related_order_id, customEventId: `evt_avail_${entry.id}` }
        );
      }
      released++;
    }
  }

  return {
    scanned,
    released,
    hasMore,
    nextCursor: hasMore ? lastDocId : null
  };
}

/**
 * Scheduled Batch Processor: Expire available points that passed expires_at
 */
export async function expirePointsBatch(
  adminDb: any,
  opts?: { dryRun?: boolean; batchSize?: number; cursor?: string | null }
): Promise<{
  scanned: number;
  expiredPoints: number;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 100));
  const nowIso = new Date().toISOString();

  let scanned = 0;
  let expiredPoints = 0;

  let query = adminDb.collectionGroup("loyalty_ledger")
    .where("status", "==", "available")
    .where("expires_at", "<=", nowIso)
    .limit(batchSize + 1);

  if (opts?.cursor) {
    const cursorDocSnap = await adminDb.collectionGroup("loyalty_ledger").doc(opts.cursor).get();
    if (cursorDocSnap.exists) {
      query = query.startAfter(cursorDocSnap);
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
    const entry: LoyaltyLedgerEntry = docSnap.data();

    const pointsToExpire = Math.max(0, entry.balance_effect);
    if (pointsToExpire > 0) {
      if (!dryRun) {
        const idempotencyKey = generateLedgerIdempotencyKey("expire", docSnap.id);
        const expiryEntry: Omit<LoyaltyLedgerEntry, "id"> = {
          customer_profile_id: entry.customer_profile_id,
          customer_id: entry.customer_id,
          entry_type: "expiry",
          points: -pointsToExpire,
          balance_effect: -pointsToExpire,
          status: "expired",
          source: "scheduled_batch",
          idempotency_key: idempotencyKey,
          description: `Expired ${pointsToExpire} unused points from entry ${docSnap.id}`,
          reversed_entry_id: docSnap.id,
          created_at: nowIso,
          created_by: "system"
        };

        await adminDb.runTransaction(async (tx: any) => {
          tx.update(docSnap.ref, { status: "expired", balance_effect: 0 });
          await recordLoyaltyLedgerEntry(adminDb, expiryEntry, tx);
        });

        await createCustomerTimelineEvent(
          adminDb,
          entry.customer_profile_id,
          "points_expired",
          "Points Expired",
          `${pointsToExpire} unused reward points expired.`,
          "system",
          { customEventId: `evt_${idempotencyKey}` }
        );
      }
      expiredPoints += pointsToExpire;
    }
  }

  return {
    scanned,
    expiredPoints,
    hasMore,
    nextCursor: hasMore ? lastDocId : null
  };
}

/**
 * Calculate rolling 12-month eligible order spend for a customer
 */
export async function calculateRolling12MonthSpend(
  adminDb: any,
  profileId: string
): Promise<{ rolling12mSpendRupees: number; rolling12mOrdersCount: number }> {
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const docSnap = await profileRef.get();
  if (!docSnap.exists) {
    return { rolling12mSpendRupees: 0, rolling12mOrdersCount: 0 };
  }

  const pData = docSnap.data();
  const customerId = pData.customer_id;

  const oneYearAgoIso = new Date(Date.now() - 365 * 86400 * 1000).toISOString();

  // Query top-level orders created in the last 365 days
  let snapshot = await adminDb.collection("orders")
    .where("created_at", ">=", oneYearAgoIso)
    .where("customer_profile_id", "==", profileId)
    .get();

  let docs = snapshot.docs;

  if (docs.length === 0 && customerId) {
    snapshot = await adminDb.collection("orders")
      .where("created_at", ">=", oneYearAgoIso)
      .where("customer_id", "==", customerId)
      .get();
    docs = snapshot.docs;
  }

  let totalSpendRupees = 0;
  let validOrderCount = 0;

  for (const doc of docs) {
    const o = doc.data();
    const status = (o.status || o.order_status || "").toLowerCase();
    // Exclude cancelled / completely returned / unpaid / failed orders
    if (["cancelled", "failed", "unpaid", "returned"].includes(status)) {
      continue;
    }

    const orderTotal = Number(o.grand_total_rupees || o.total_amount || o.subtotal || 0);
    const refunded = Number(o.refunded_amount_rupees || 0);
    const netOrderSpend = Math.max(0, orderTotal - refunded);

    totalSpendRupees += netOrderSpend;
    validOrderCount++;
  }

  // Fallback to cached summary if no order documents exist but commerce summary indicates recent activity
  if (docs.length === 0 && pData.commerce_summary) {
    const lastOrderDate = pData.commerce_summary.last_order_date;
    if (lastOrderDate && new Date(lastOrderDate).getTime() >= Date.now() - 365 * 86400 * 1000) {
      totalSpendRupees = Number(pData.commerce_summary.recent_12m_spend || pData.commerce_summary.lifetime_spend || 0);
      validOrderCount = Number(pData.commerce_summary.total_orders || 1);
    }
  }

  return { rolling12mSpendRupees: Math.round(totalSpendRupees), rolling12mOrdersCount: validOrderCount };
}

/**
 * Re-evaluate and calculate customer loyalty tier using rolling 12-month spend
 */
export async function recalculateCustomerLoyaltyTier(
  adminDb: any,
  profileId: string
): Promise<{ previousTier: LoyaltyTierName; newTier: LoyaltyTierName; changed: boolean; rolling12mSpend: number }> {
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const docSnap = await profileRef.get();
  if (!docSnap.exists) {
    throw new Error(`Customer profile ${profileId} not found.`);
  }

  const pData = docSnap.data();
  const previousTier: LoyaltyTierName = pData.loyalty_tier || pData.loyalty_summary?.current_tier || "MEMBER";

  // Calculate actual rolling 12-month spend from order history
  const { rolling12mSpendRupees, rolling12mOrdersCount } = await calculateRolling12MonthSpend(adminDb, profileId);

  const tierConfig = getTierConfigForSpend(rolling12mSpendRupees);
  const newTier = tierConfig.tier;
  const changed = previousTier !== newTier;

  const nowIso = new Date().toISOString();
  await profileRef.set({
    loyalty_tier: newTier,
    "loyalty_summary.current_tier": newTier,
    "loyalty_summary.tier_progress.rolling_12m_spend_rupees": rolling12mSpendRupees,
    rolling_spend_summary: {
      rolling_12m_spend_rupees: rolling12mSpendRupees,
      rolling_12m_orders_count: rolling12mOrdersCount,
      calculated_at: nowIso,
      version: 1
    },
    updated_at: nowIso
  }, { merge: true });

  if (changed) {
    await createCustomerTimelineEvent(
      adminDb,
      profileId,
      "loyalty_tier_changed",
      `Loyalty Tier Updated: ${newTier}`,
      `Customer upgraded to ${newTier} tier based on ₹${rolling12mSpendRupees.toLocaleString("en-IN")} rolling 12-month eligible spend!`,
      "system",
      { customEventId: `evt_tier_${profileId}_${newTier}` }
    );
  }

  return { previousTier, newTier, changed, rolling12mSpend: rolling12mSpendRupees };
}

/**
 * Cursor-paginated batch loyalty tier recalculation for all customer profiles
 */
export async function recalculateLoyaltyTiersBatch(
  adminDb: any,
  opts?: { dryRun?: boolean; batchSize?: number; cursor?: string | null; force?: boolean }
): Promise<{
  scanned: number;
  updated: number;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const force = Boolean(opts?.force);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 200));

  let scanned = 0;
  let updated = 0;

  let query = adminDb.collection("customer_profiles").orderBy("__name__").limit(batchSize + 1);
  if (opts?.cursor) {
    const startDocSnap = await adminDb.collection("customer_profiles").doc(opts.cursor).get();
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

    if (!dryRun) {
      const res = await recalculateCustomerLoyaltyTier(adminDb, docSnap.id);
      if (res.changed || force) {
        updated++;
      }
    } else {
      const pData = docSnap.data();
      const previousTier = pData.loyalty_tier || "MEMBER";
      const spend = Number(pData.commerce_summary?.lifetime_spend || 0);
      const newTier = getTierConfigForSpend(spend).tier;
      if (previousTier !== newTier || force) {
        updated++;
      }
    }
  }

  return {
    scanned,
    updated,
    hasMore,
    nextCursor: hasMore ? lastDocId : null
  };
}

/**
 * Atomic Loyalty Points Redemption during Order Placement
 * Consumes available points FIFO by earliest expiry
 */
export async function applyLoyaltyRedemptionInTransaction(
  adminDb: any,
  transaction: any,
  profileId: string,
  orderId: string,
  requestedPoints: number,
  subtotalRupees: number
): Promise<{ success: boolean; pointsRedeemed: number; discountRupees: number; allocations: LoyaltyRedemptionAllocation[] }> {
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const profileSnap = await transaction.get(profileRef);

  if (!profileSnap.exists) {
    throw new Error("Customer profile not found for loyalty redemption.");
  }

  const pData = profileSnap.data();
  const summary: LoyaltySummary = pData.loyalty_summary || { available_points: 0 };
  const availablePoints = summary.available_points || 0;

  const validation = validateAndCalculateLoyaltyRedemption(subtotalRupees, requestedPoints, availablePoints);
  if (!validation.valid || validation.pointsToRedeem <= 0) {
    throw new Error(validation.message);
  }

  const pointsToRedeem = validation.pointsToRedeem;

  // Query available ledger entries sorted by earliest expiry (FIFO)
  const ledgerCol = profileRef.collection("loyalty_ledger");
  const availEntriesSnap = await transaction.get(
    ledgerCol.where("status", "==", "available").orderBy("expires_at", "asc")
  );

  let remainingToRedeem = pointsToRedeem;
  const allocations: LoyaltyRedemptionAllocation[] = [];

  availEntriesSnap.forEach((docSnap: any) => {
    if (remainingToRedeem <= 0) return;
    const entry: LoyaltyLedgerEntry = docSnap.data();
    const currentBalance = entry.balance_effect;

    if (currentBalance > 0) {
      const usedFromThisEntry = Math.min(currentBalance, remainingToRedeem);
      remainingToRedeem -= usedFromThisEntry;
      allocations.push({
        source_entry_id: docSnap.id,
        points_used: usedFromThisEntry,
        source_expires_at: entry.expires_at
      });

      const newBalance = currentBalance - usedFromThisEntry;
      const newStatus = newBalance === 0 ? "redeemed" : "available";
      transaction.update(docSnap.ref, {
        balance_effect: newBalance,
        status: newStatus
      });
    }
  });

  if (remainingToRedeem > 0) {
    throw new Error("Insufficient available points entries to satisfy redemption request.");
  }

  // Create redemption ledger entry
  const nowIso = new Date().toISOString();
  const idempotencyKey = generateLedgerIdempotencyKey("redeem", orderId);
  const redemptionEntryRef = ledgerCol.doc(idempotencyKey);

  const redemptionEntry: LoyaltyLedgerEntry = {
    id: redemptionEntryRef.id,
    customer_profile_id: profileId,
    customer_id: pData.customer_id || "SS-C00000",
    entry_type: "redeem",
    points: -pointsToRedeem,
    balance_effect: -pointsToRedeem,
    status: "redeemed",
    source: "checkout",
    related_order_id: orderId,
    idempotency_key: idempotencyKey,
    description: `Redeemed ${pointsToRedeem} points (₹${validation.discountRupees} discount) for Order #${orderId}`,
    created_at: nowIso,
    created_by: "system",
    metadata: {
      allocations,
      discount_rupees: validation.discountRupees
    }
  };

  transaction.set(redemptionEntryRef, redemptionEntry);

  // Update cached profile summary
  await recalculateLoyaltySummaryFromLedger(adminDb, profileId, transaction);

  return {
    success: true,
    pointsRedeemed: pointsToRedeem,
    discountRupees: validation.discountRupees,
    allocations
  };
}

/**
 * Atomic Store Credit Redemption during Order Placement
 */
export async function applyStoreCreditRedemptionInTransaction(
  adminDb: any,
  transaction: any,
  profileId: string,
  orderId: string,
  requestedCreditRupees: number
): Promise<{ success: boolean; creditUsedPaise: number; creditUsedRupees: number }> {
  const requestedPaise = Math.floor(Math.max(0, requestedCreditRupees) * 100);
  if (requestedPaise <= 0) {
    return { success: true, creditUsedPaise: 0, creditUsedRupees: 0 };
  }

  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const profileSnap = await transaction.get(profileRef);

  if (!profileSnap.exists) {
    throw new Error("Customer profile not found for store credit redemption.");
  }

  const pData = profileSnap.data();
  const summary: StoreCreditSummary = pData.store_credit_summary || { available_balance_paise: 0 };
  const availablePaise = summary.available_balance_paise || 0;

  if (requestedPaise > availablePaise) {
    throw new Error(`Requested store credit (₹${requestedCreditRupees}) exceeds available balance (₹${Math.floor(availablePaise / 100)}).`);
  }

  const creditCol = profileRef.collection("store_credit_ledger");
  const availEntriesSnap = await transaction.get(
    creditCol.where("status", "==", "active").orderBy("created_at", "asc")
  );

  let remainingPaise = requestedPaise;

  availEntriesSnap.forEach((docSnap: any) => {
    if (remainingPaise <= 0) return;
    const entry: StoreCreditLedgerEntry = docSnap.data();
    const currentBalance = entry.balance_effect_paise;

    if (currentBalance > 0) {
      const usedFromThisEntry = Math.min(currentBalance, remainingPaise);
      remainingPaise -= usedFromThisEntry;

      const newBalance = currentBalance - usedFromThisEntry;
      const newStatus = newBalance === 0 ? "used" : "active";
      transaction.update(docSnap.ref, {
        balance_effect_paise: newBalance,
        status: newStatus
      });
    }
  });

  if (remainingPaise > 0) {
    throw new Error("Insufficient active store credit ledger entries to satisfy redemption.");
  }

  const nowIso = new Date().toISOString();
  const idempotencyKey = generateLedgerIdempotencyKey("credit_redeem", orderId);
  const redemptionEntryRef = creditCol.doc(idempotencyKey);

  const redemptionEntry: StoreCreditLedgerEntry = {
    id: redemptionEntryRef.id,
    customer_profile_id: profileId,
    customer_id: pData.customer_id || "SS-C00000",
    entry_type: "redemption",
    amount_paise: -requestedPaise,
    balance_effect_paise: -requestedPaise,
    currency: "INR",
    status: "used",
    source: "checkout_redemption",
    related_order_id: orderId,
    idempotency_key: idempotencyKey,
    description: `Applied ₹${Math.floor(requestedPaise / 100)} store credit discount to Order #${orderId}`,
    created_at: nowIso,
    created_by: "system"
  };

  transaction.set(redemptionEntryRef, redemptionEntry);

  await recalculateStoreCreditSummaryFromLedger(adminDb, profileId, transaction);

  return {
    success: true,
    creditUsedPaise: requestedPaise,
    creditUsedRupees: Math.floor(requestedPaise / 100)
  };
}

/**
 * Compensating ledger entries for Order Cancellation
 * Restores redeemed points and store credit, reverses pending/earned points
 */
export async function reverseLoyaltyAndCreditForOrderCancellation(
  adminDb: any,
  orderId: string,
  reason = "Order Cancelled"
): Promise<{ pointsRestored: number; creditRestoredRupees: number }> {
  const ordersSnap = await adminDb.collection("orders").where("order_id", "==", orderId).limit(1).get();
  if (ordersSnap.empty) {
    return { pointsRestored: 0, creditRestoredRupees: 0 };
  }

  const oDoc = ordersSnap.docs[0];
  const order = oDoc.data();
  const phone = order.customer_phone || "";
  const email = order.customer_email || "";

  if (!phone && !email) {
    return { pointsRestored: 0, creditRestoredRupees: 0 };
  }

  // Find customer profile
  const cleanPhone = phone.replace(/\D/g, "");
  let profileDocSnap: any = null;

  if (cleanPhone) {
    const pQuery = await adminDb.collection("customer_profiles").where("normalized_phone", "==", cleanPhone).limit(1).get();
    if (!pQuery.empty) profileDocSnap = pQuery.docs[0];
  }

  if (!profileDocSnap && email) {
    const eQuery = await adminDb.collection("customer_profiles").where("email_lower", "==", email.toLowerCase()).limit(1).get();
    if (!eQuery.empty) profileDocSnap = eQuery.docs[0];
  }

  if (!profileDocSnap) {
    return { pointsRestored: 0, creditRestoredRupees: 0 };
  }

  const profileId = profileDocSnap.id;
  const pData = profileDocSnap.data();
  const nowIso = new Date().toISOString();

  let pointsRestored = 0;
  let creditRestoredRupees = 0;

  // 1. Restore Redeemed Points if any
  const redeemedPoints = Number(order.loyalty_points_redeemed || 0);
  if (redeemedPoints > 0) {
    const idempotencyKey = generateLedgerIdempotencyKey("cancel_points_restore", orderId);
    const entryData: Omit<LoyaltyLedgerEntry, "id"> = {
      customer_profile_id: profileId,
      customer_id: pData.customer_id || "SS-C00000",
      entry_type: "redeem_reversal",
      points: redeemedPoints,
      balance_effect: redeemedPoints,
      status: "available",
      source: "order_cancellation",
      related_order_id: orderId,
      idempotency_key: idempotencyKey,
      description: `Restored ${redeemedPoints} redeemed points due to cancellation of Order #${orderId}`,
      created_at: nowIso,
      created_by: "system"
    };

    await recordLoyaltyLedgerEntry(adminDb, entryData);
    pointsRestored = redeemedPoints;

    await createCustomerTimelineEvent(
      adminDb,
      profileId,
      "points_restored",
      "Redeemed Points Restored",
      `${redeemedPoints} reward points restored following cancellation of Order #${orderId}.`,
      "system",
      { relatedOrderId: orderId, customEventId: `evt_${idempotencyKey}` }
    );
  }

  // 2. Reverse Pending/Earned Points for this order
  const earnIdempotency = generateLedgerIdempotencyKey("earn", orderId);
  const earnLedgerSnap = await adminDb.collection("customer_profiles").doc(profileId).collection("loyalty_ledger").doc(earnIdempotency).get();

  if (earnLedgerSnap.exists) {
    const earnEntry: LoyaltyLedgerEntry = earnLedgerSnap.data();
    if (earnEntry.status !== "reversed") {
      const cancelIdempotency = generateLedgerIdempotencyKey("cancel_points_reverse", orderId);
      const pointsToReverse = earnEntry.points;

      const reversalEntry: Omit<LoyaltyLedgerEntry, "id"> = {
        customer_profile_id: profileId,
        customer_id: pData.customer_id || "SS-C00000",
        entry_type: "order_cancel_reversal",
        points: -pointsToReverse,
        balance_effect: earnEntry.status === "available" ? -pointsToReverse : 0,
        status: "reversed",
        source: "order_cancellation",
        related_order_id: orderId,
        idempotency_key: cancelIdempotency,
        description: `Reversed ${pointsToReverse} points earned on cancelled Order #${orderId}`,
        reversed_entry_id: earnEntry.id,
        created_at: nowIso,
        created_by: "system"
      };

      await adminDb.runTransaction(async (tx: any) => {
        tx.update(earnLedgerSnap.ref, { status: "reversed", balance_effect: 0 });
        await recordLoyaltyLedgerEntry(adminDb, reversalEntry, tx);
      });
    }
  }

  // 3. Restore Used Store Credit if any
  const creditUsedPaise = Number(order.store_credit_used_paise || (order.store_credit_used_rupees || 0) * 100);
  if (creditUsedPaise > 0) {
    const creditIdempotency = generateLedgerIdempotencyKey("cancel_credit_restore", orderId);
    const creditEntryData: Omit<StoreCreditLedgerEntry, "id"> = {
      customer_profile_id: profileId,
      customer_id: pData.customer_id || "SS-C00000",
      entry_type: "redemption_reversal",
      amount_paise: creditUsedPaise,
      balance_effect_paise: creditUsedPaise,
      currency: "INR",
      status: "active",
      source: "order_cancellation",
      related_order_id: orderId,
      idempotency_key: creditIdempotency,
      description: `Restored ₹${Math.floor(creditUsedPaise / 100)} store credit due to cancellation of Order #${orderId}`,
      created_at: nowIso,
      created_by: "system"
    };

    await recordStoreCreditLedgerEntry(adminDb, creditEntryData);
    creditRestoredRupees = Math.floor(creditUsedPaise / 100);

    await createCustomerTimelineEvent(
      adminDb,
      profileId,
      "store_credit_restored",
      "Store Credit Restored",
      `₹${creditRestoredRupees} store credit restored following cancellation of Order #${orderId}.`,
      "system",
      { relatedOrderId: orderId, customEventId: `evt_${creditIdempotency}` }
    );
  }

  // Recalculate loyalty tier after cancellation
  await recalculateCustomerLoyaltyTier(adminDb, profileId);

  return { pointsRestored, creditRestoredRupees };
}

/**
 * Proportional Point Clawback for Partial Refunds & Partial Returns
 */
export async function processPartialRefundOrReturnPointsClawback(
  adminDb: any,
  opts: {
    profileId: string;
    orderId: string;
    refundId?: string;
    returnId?: string;
    refundedMerchandiseRupees: number;
    originalEligibleSubtotalRupees: number;
    reason: string;
    created_by?: string;
  }
): Promise<{
  pointsReversed: number;
  alreadyReversedPoints: number;
  netPointsEarnedRemaining: number;
  idempotentAlreadyProcessed?: boolean;
}> {
  const {
    profileId,
    orderId,
    refundId,
    returnId,
    refundedMerchandiseRupees,
    originalEligibleSubtotalRupees,
    reason,
    created_by = "system"
  } = opts;

  const eventIdentifier = refundId || returnId || `ref_${Date.now()}`;
  const cancelIdempotency = generateLedgerIdempotencyKey("partial_refund_reverse", `${orderId}_${eventIdentifier}`);

  // Check if idempotency key exists
  const existingLedgerSnap = await adminDb.collection("customer_profiles").doc(profileId).collection("loyalty_ledger").doc(cancelIdempotency).get();
  if (existingLedgerSnap.exists) {
    const existingData = existingLedgerSnap.data();
    return {
      pointsReversed: Math.abs(existingData.points || 0),
      alreadyReversedPoints: Math.abs(existingData.points || 0),
      netPointsEarnedRemaining: 0,
      idempotentAlreadyProcessed: true
    };
  }

  // 1. Fetch original earn entry for this order
  const earnIdempotency = generateLedgerIdempotencyKey("earn", orderId);
  const earnLedgerSnap = await adminDb.collection("customer_profiles").doc(profileId).collection("loyalty_ledger").doc(earnIdempotency).get();

  if (!earnLedgerSnap.exists) {
    return { pointsReversed: 0, alreadyReversedPoints: 0, netPointsEarnedRemaining: 0 };
  }

  const earnEntry: LoyaltyLedgerEntry = earnLedgerSnap.data();
  if (earnEntry.status === "reversed") {
    return { pointsReversed: 0, alreadyReversedPoints: earnEntry.points, netPointsEarnedRemaining: 0 };
  }

  const originalEarnedPoints = earnEntry.points;
  const eligibleSubtotal = Math.max(1, originalEligibleSubtotalRupees);

  // 2. Find all previous partial reversals for this order
  const previousReversalsSnap = await adminDb.collection("customer_profiles").doc(profileId).collection("loyalty_ledger")
    .where("related_order_id", "==", orderId)
    .where("entry_type", "==", "order_partial_refund_reversal")
    .get();

  let alreadyReversedPoints = 0;
  previousReversalsSnap.docs.forEach((doc: any) => {
    alreadyReversedPoints += Math.abs(doc.data().points || 0);
  });

  const remainingEarnedPoints = Math.max(0, originalEarnedPoints - alreadyReversedPoints);
  if (remainingEarnedPoints <= 0) {
    return { pointsReversed: 0, alreadyReversedPoints, netPointsEarnedRemaining: 0 };
  }

  // 3. Calculate proportional points to clawback
  const proportionalPoints = Math.floor((Math.max(0, refundedMerchandiseRupees) / eligibleSubtotal) * originalEarnedPoints);
  const pointsToReverse = Math.min(proportionalPoints, remainingEarnedPoints);

  if (pointsToReverse <= 0) {
    return { pointsReversed: 0, alreadyReversedPoints, netPointsEarnedRemaining: remainingEarnedPoints };
  }

  const profileSnap = await adminDb.collection("customer_profiles").doc(profileId).get();
  const pData = profileSnap.exists ? profileSnap.data() : {};
  const nowIso = new Date().toISOString();

  // 4. Create ledger entry
  const reversalEntry: Omit<LoyaltyLedgerEntry, "id"> = {
    customer_profile_id: profileId,
    customer_id: pData.customer_id || "SS-C00000",
    entry_type: "order_partial_refund_reversal",
    points: -pointsToReverse,
    balance_effect: earnEntry.status === "available" ? -pointsToReverse : 0,
    status: "reversed",
    source: "order_refund",
    related_order_id: orderId,
    idempotency_key: cancelIdempotency,
    description: `Reversed ${pointsToReverse} points for partial refund/return on Order #${orderId}. Reason: ${reason}`,
    reversed_entry_id: earnEntry.id,
    created_at: nowIso,
    created_by
  };

  await recordLoyaltyLedgerEntry(adminDb, reversalEntry);

  await createCustomerTimelineEvent(
    adminDb,
    profileId,
    "points_restored",
    "Points Clawed Back (Partial Refund)",
    `Clawed back ${pointsToReverse} points earned on refunded items from Order #${orderId}.`,
    "system",
    { relatedOrderId: orderId, customEventId: `evt_${cancelIdempotency}` }
  );

  await recalculateCustomerLoyaltyTier(adminDb, profileId);

  return {
    pointsReversed: pointsToReverse,
    alreadyReversedPoints: alreadyReversedPoints + pointsToReverse,
    netPointsEarnedRemaining: Math.max(0, remainingEarnedPoints - pointsToReverse)
  };
}

/**
 * Deterministic Refund Allocation for Mixed Payment Orders
 * Priority 1: Cash/Razorpay Gateway refund
 * Priority 2: Store Credit restoration
 * Priority 3: Loyalty Points restoration (1 point = ₹1)
 */
export function processMixedPaymentRefundAllocation(
  order: {
    total_rupees: number;
    paid_cash_rupees: number;
    store_credit_used_rupees: number;
    loyalty_points_redeemed: number;
    already_refunded_cash_rupees?: number;
    already_restored_credit_rupees?: number;
    already_restored_points?: number;
  },
  requestedRefundRupees: number
): {
  refundCashRupees: number;
  restoreCreditRupees: number;
  restorePoints: number;
} {
  const req = Math.max(0, Math.round(requestedRefundRupees));

  const maxCash = Math.max(0, Math.round((order.paid_cash_rupees || 0) - (order.already_refunded_cash_rupees || 0)));
  const maxCredit = Math.max(0, Math.round((order.store_credit_used_rupees || 0) - (order.already_restored_credit_rupees || 0)));
  const maxPoints = Math.max(0, Math.round((order.loyalty_points_redeemed || 0) - (order.already_restored_points || 0)));

  let unallocated = req;

  // Priority 1: Cash refund
  const refundCashRupees = Math.min(unallocated, maxCash);
  unallocated -= refundCashRupees;

  // Priority 2: Store Credit
  const restoreCreditRupees = Math.min(unallocated, maxCredit);
  unallocated -= restoreCreditRupees;

  // Priority 3: Loyalty Points
  const restorePoints = Math.min(unallocated, maxPoints);
  unallocated -= restorePoints;

  return {
    refundCashRupees,
    restoreCreditRupees,
    restorePoints
  };
}

/**
 * Verifies loyalty summary against loyalty ledger entries
 */
export async function verifyLoyaltySummary(
  adminDb: any,
  profileId: string
): Promise<{
  summaryMatchesLedger: boolean;
  expected: LoyaltySummary;
  actual: LoyaltySummary;
  diff: { available_points: number; pending_points: number };
  orphanEntries: number;
  duplicateEntries: number;
  warnings: string[];
}> {
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const docSnap = await profileRef.get();
  if (!docSnap.exists) {
    throw new Error(`Customer profile ${profileId} not found.`);
  }

  const pData = docSnap.data();
  const actualSummary: LoyaltySummary = pData.loyalty_summary || {
    available_points: 0,
    pending_points: 0,
    lifetime_earned_points: 0,
    lifetime_redeemed_points: 0,
    lifetime_expired_points: 0,
    current_tier: pData.loyalty_tier || "MEMBER"
  };

  const expectedSummary = await recalculateLoyaltySummaryFromLedger(adminDb, profileId);

  const diffAvailable = expectedSummary.available_points - (actualSummary.available_points || 0);
  const diffPending = expectedSummary.pending_points - (actualSummary.pending_points || 0);

  const warnings: string[] = [];
  if (diffAvailable !== 0) {
    warnings.push(`Available points mismatch: Cached=${actualSummary.available_points}, Ledger=${expectedSummary.available_points}`);
  }
  if (diffPending !== 0) {
    warnings.push(`Pending points mismatch: Cached=${actualSummary.pending_points}, Ledger=${expectedSummary.pending_points}`);
  }

  const ledgerSnap = await profileRef.collection("loyalty_ledger").get();
  const seenKeys = new Set<string>();
  let duplicateEntries = 0;
  ledgerSnap.docs.forEach((doc: any) => {
    const key = doc.data().idempotency_key;
    if (key) {
      if (seenKeys.has(key)) duplicateEntries++;
      else seenKeys.add(key);
    }
  });

  return {
    summaryMatchesLedger: diffAvailable === 0 && diffPending === 0,
    expected: expectedSummary,
    actual: actualSummary,
    diff: { available_points: diffAvailable, pending_points: diffPending },
    orphanEntries: 0,
    duplicateEntries,
    warnings
  };
}

/**
 * Verifies store credit summary against store credit ledger entries
 */
export async function verifyStoreCreditSummary(
  adminDb: any,
  profileId: string
): Promise<{
  summaryMatchesLedger: boolean;
  expected: StoreCreditSummary;
  actual: StoreCreditSummary;
  diff: { available_balance_paise: number; available_balance_rupees: number };
  warnings: string[];
}> {
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const docSnap = await profileRef.get();
  if (!docSnap.exists) {
    throw new Error(`Customer profile ${profileId} not found.`);
  }

  const pData = docSnap.data();
  const actualSummary: StoreCreditSummary = pData.store_credit_summary || {
    available_balance_paise: 0,
    available_balance_rupees: 0,
    lifetime_issued_paise: 0,
    lifetime_redeemed_paise: 0
  };

  const expectedSummary = await recalculateStoreCreditSummaryFromLedger(adminDb, profileId);

  const diffPaise = expectedSummary.available_balance_paise - (actualSummary.available_balance_paise || 0);
  const diffRupees = expectedSummary.available_balance_rupees - (actualSummary.available_balance_rupees || 0);

  const warnings: string[] = [];
  if (diffPaise !== 0) {
    warnings.push(`Store credit balance mismatch: Cached=${actualSummary.available_balance_paise} paise, Ledger=${expectedSummary.available_balance_paise} paise`);
  }

  return {
    summaryMatchesLedger: diffPaise === 0,
    expected: expectedSummary,
    actual: actualSummary,
    diff: { available_balance_paise: diffPaise, available_balance_rupees: diffRupees },
    warnings
  };
}

/**
 * Cursor-paginated batch repair utility for customer summaries and tiers
 */
export async function runLoyaltyAndCreditBatchRepair(
  adminDb: any,
  opts?: { dryRun?: boolean; batchSize?: number; cursor?: string | null; force?: boolean }
): Promise<{
  scanned: number;
  repairedLoyalty: number;
  repairedCredit: number;
  repairedTiers: number;
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const force = Boolean(opts?.force);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 100));

  let scanned = 0;
  let repairedLoyalty = 0;
  let repairedCredit = 0;
  let repairedTiers = 0;

  let query = adminDb.collection("customer_profiles").orderBy("__name__").limit(batchSize + 1);
  if (opts?.cursor) {
    const startDocSnap = await adminDb.collection("customer_profiles").doc(opts.cursor).get();
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
    const id = docSnap.id;
    lastDocId = id;

    const vLoyalty = await verifyLoyaltySummary(adminDb, id);
    const vCredit = await verifyStoreCreditSummary(adminDb, id);

    if (!vLoyalty.summaryMatchesLedger || force) {
      repairedLoyalty++;
      if (!dryRun) {
        await adminDb.collection("customer_profiles").doc(id).set({ loyalty_summary: vLoyalty.expected }, { merge: true });
      }
    }

    if (!vCredit.summaryMatchesLedger || force) {
      repairedCredit++;
      if (!dryRun) {
        await adminDb.collection("customer_profiles").doc(id).set({ store_credit_summary: vCredit.expected }, { merge: true });
      }
    }

    const tierRes = await recalculateCustomerLoyaltyTier(adminDb, id);
    if (tierRes.changed) {
      repairedTiers++;
    }
  }

  return {
    scanned,
    repairedLoyalty,
    repairedCredit,
    repairedTiers,
    hasMore,
    nextCursor: hasMore ? lastDocId : null
  };
}

/**
 * Admin Manual Points Adjustment
 */
export async function adjustLoyaltyPointsManual(
  adminDb: any,
  profileId: string,
  points: number,
  reason: string,
  adminEmail: string
): Promise<{ success: boolean; newAvailablePoints: number }> {
  if (!points || !reason || !reason.trim()) {
    throw new Error("Points amount and reason are required for manual adjustment.");
  }

  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    throw new Error(`Customer profile ${profileId} not found.`);
  }

  const pData = profileSnap.data();
  const summary: LoyaltySummary = pData.loyalty_summary || { available_points: 0 };
  const currentAvailable = summary.available_points || 0;

  if (points < 0 && (currentAvailable + points) < 0) {
    throw new Error(`Cannot debit ${Math.abs(points)} points. Available balance is ${currentAvailable} points.`);
  }

  const nowIso = new Date().toISOString();
  const idempotencyKey = generateLedgerIdempotencyKey("manual_pts", `${profileId}_${Date.now()}`);

  const entryType: LoyaltyEntryType = points > 0 ? "manual_adjustment_positive" : "manual_adjustment_negative";

  const entryData: Omit<LoyaltyLedgerEntry, "id"> = {
    customer_profile_id: profileId,
    customer_id: pData.customer_id || "SS-C00000",
    entry_type: entryType,
    points: points,
    balance_effect: points,
    status: "available",
    source: "admin_adjustment",
    idempotency_key: idempotencyKey,
    description: `Manual adjustment by ${adminEmail}: ${reason.trim()}`,
    created_at: nowIso,
    created_by: adminEmail
  };

  await recordLoyaltyLedgerEntry(adminDb, entryData);

  const updatedSummary = await recalculateLoyaltySummaryFromLedger(adminDb, profileId);

  await createCustomerTimelineEvent(
    adminDb,
    profileId,
    "loyalty_adjustment",
    `Points Adjusted (${points > 0 ? `+${points}` : points})`,
    `Admin (${adminEmail}) adjusted points balance: ${reason.trim()}`,
    "admin",
    { customEventId: `evt_${idempotencyKey}` }
  );

  // Audit log
  await adminDb.collection("admin_audit_logs").add({
    action: "loyalty_points_adjusted",
    admin_email: adminEmail,
    customer_profile_id: profileId,
    customer_id: pData.customer_id,
    points_effect: points,
    reason: reason.trim(),
    created_at: nowIso
  });

  return { success: true, newAvailablePoints: updatedSummary.available_points };
}

/**
 * Admin Manual Store Credit Adjustment
 */
export async function adjustStoreCreditManual(
  adminDb: any,
  profileId: string,
  amountRupees: number,
  reason: string,
  adminEmail: string,
  expiresAtIso?: string
): Promise<{ success: boolean; newAvailableCreditRupees: number }> {
  if (!amountRupees || !reason || !reason.trim()) {
    throw new Error("Store credit amount and reason are required.");
  }

  const amountPaise = Math.floor(amountRupees * 100);

  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    throw new Error(`Customer profile ${profileId} not found.`);
  }

  const pData = profileSnap.data();
  const summary: StoreCreditSummary = pData.store_credit_summary || { available_balance_paise: 0 };
  const currentAvailablePaise = summary.available_balance_paise || 0;

  if (amountPaise < 0 && (currentAvailablePaise + amountPaise) < 0) {
    throw new Error(`Cannot debit ₹${Math.abs(amountRupees)} credit. Available balance is ₹${Math.floor(currentAvailablePaise / 100)}.`);
  }

  const nowIso = new Date().toISOString();
  const idempotencyKey = generateLedgerIdempotencyKey("manual_credit", `${profileId}_${Date.now()}`);

  const entryType: StoreCreditEntryType = amountPaise > 0 ? "manual_credit" : "manual_debit";

  const entryData: Omit<StoreCreditLedgerEntry, "id"> = {
    customer_profile_id: profileId,
    customer_id: pData.customer_id || "SS-C00000",
    entry_type: entryType,
    amount_paise: amountPaise,
    balance_effect_paise: amountPaise,
    currency: "INR",
    status: "active",
    source: "admin_adjustment",
    related_admin_email: adminEmail,
    idempotency_key: idempotencyKey,
    description: `Manual store credit adjustment by ${adminEmail}: ${reason.trim()}`,
    issued_at: nowIso,
    expires_at: expiresAtIso,
    created_at: nowIso,
    created_by: adminEmail
  };

  await recordStoreCreditLedgerEntry(adminDb, entryData);

  const updatedSummary = await recalculateStoreCreditSummaryFromLedger(adminDb, profileId);

  await createCustomerTimelineEvent(
    adminDb,
    profileId,
    "store_credit_issued",
    `Store Credit ${amountRupees > 0 ? "Issued" : "Adjusted"} (₹${amountRupees})`,
    `Admin (${adminEmail}) adjusted store credit: ${reason.trim()}`,
    "admin",
    { customEventId: `evt_${idempotencyKey}` }
  );

  await adminDb.collection("admin_audit_logs").add({
    action: "store_credit_adjusted",
    admin_email: adminEmail,
    customer_profile_id: profileId,
    customer_id: pData.customer_id,
    amount_rupees: amountRupees,
    reason: reason.trim(),
    created_at: nowIso
  });

  return {
    success: true,
    newAvailableCreditRupees: updatedSummary.available_balance_rupees
  };
}

/**
 * Historical Orders Loyalty Backfill Utility
 */
export async function runLoyaltyBackfill(
  adminDb: any,
  opts?: {
    dryRun?: boolean;
    batchSize?: number;
    cursor?: string | null;
    awardPoints?: boolean;
    recalculateTiersOnly?: boolean;
  }
): Promise<{
  scanned: number;
  ordersProcessed: number;
  pointsAwarded: number;
  tiersUpdated: number;
  hasMore: boolean;
  nextCursor: string | null;
  dryRun: boolean;
}> {
  const dryRun = Boolean(opts?.dryRun);
  const awardPoints = Boolean(opts?.awardPoints);
  const batchSize = Math.min(500, Math.max(1, opts?.batchSize || 200));

  let scanned = 0;
  let ordersProcessed = 0;
  let pointsAwarded = 0;
  let tiersUpdated = 0;

  let query = adminDb.collection("customer_profiles").orderBy("__name__").limit(batchSize + 1);
  if (opts?.cursor) {
    const startDocSnap = await adminDb.collection("customer_profiles").doc(opts.cursor).get();
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
    const pData = docSnap.data();
    const phone = pData.normalized_phone || "";
    const email = pData.email || "";

    // 1. Recalculate Tier
    const tierRes = await recalculateCustomerLoyaltyTier(adminDb, docSnap.id);
    if (tierRes.changed) tiersUpdated++;

    // 2. Process historical orders if awardPoints enabled
    if (awardPoints && (phone || email)) {
      const cleanPhone = phone.replace(/\D/g, "");
      const cleanEmail = email.toLowerCase().trim();

      const matchedOrders = new Map<string, any>();

      if (cleanPhone) {
        const pOrders = await adminDb.collection("orders").where("customer_phone", "==", cleanPhone).get();
        pOrders.forEach((oSnap: any) => matchedOrders.set(oSnap.id, oSnap.data()));
      }

      if (cleanEmail && cleanEmail !== "sales@sa-and-sha.com") {
        const eOrders = await adminDb.collection("orders").where("customer_email", "==", cleanEmail).get();
        eOrders.forEach((oSnap: any) => matchedOrders.set(oSnap.id, oSnap.data()));
      }

      for (const [orderDocId, oData] of matchedOrders.entries()) {
        const status = (oData.status || "").toLowerCase();
        if (["delivered", "completed", "paid"].includes(status)) {
          ordersProcessed++;
          if (!dryRun) {
            const earnRes = await processOrderPointsEarning(adminDb, { id: orderDocId, ...oData }, docSnap.id);
            pointsAwarded += earnRes.pointsEarned;
          } else {
            const subtotal = Number(oData.subtotal || oData.grand_total || 0);
            pointsAwarded += calculateEarnedPoints(subtotal, 1.0);
          }
        }
      }
    }
  }

  return {
    scanned,
    ordersProcessed,
    pointsAwarded,
    tiersUpdated,
    hasMore,
    nextCursor: hasMore ? lastDocId : null,
    dryRun
  };
}
