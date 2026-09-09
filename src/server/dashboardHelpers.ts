import { recalculateLoyaltySummaryFromLedger, recalculateStoreCreditSummaryFromLedger } from "./loyaltyHelpers";
import { migrateAndNormalizeProfile } from "./customerProfileHelpers";
import { calculateReturnEligibility } from "./returnEligibilityHelpers";

/**
 * Builds the complete customer dashboard payload using cached summaries and
 * targeted indexed queries for orders, notifications, and customer timeline events.
 */
export async function buildCustomerDashboard(
  adminDb: any,
  profileId: string,
  rawProfileData: any
) {
  const normalizedProfile = migrateAndNormalizeProfile(rawProfileData, profileId);
  const businessCustomerId = rawProfileData.customer_id;

  const fullName = normalizedProfile.full_name || "Valued Customer";
  const firstName = fullName.trim().split(" ")[0] || "Customer";
  const rawCreatedAt = normalizedProfile.created_at || new Date().toISOString();
  const joinedDate = new Date(rawCreatedAt);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const memberSinceStr = `Member since ${monthNames[joinedDate.getMonth()]} ${joinedDate.getFullYear()}`;

  const cleanPhone = (normalizedProfile.normalized_phone || "").replace(/\D/g, "");
  const cleanEmail = (normalizedProfile.email || "").trim().toLowerCase();

  // 1. Loyalty summary: Use cached summary from profile if present, else fallback to calculation
  let loyaltySummaryPromise: Promise<any>;
  if (rawProfileData.loyalty_summary && typeof rawProfileData.loyalty_summary === "object" && rawProfileData.loyalty_summary.available_points !== undefined) {
    loyaltySummaryPromise = Promise.resolve(rawProfileData.loyalty_summary);
  } else {
    loyaltySummaryPromise = recalculateLoyaltySummaryFromLedger(adminDb, profileId);
  }

  // 2. Store credit summary: Use cached summary from profile if present, else fallback to calculation
  let storeCreditSummaryPromise: Promise<any>;
  if (rawProfileData.store_credit_summary && typeof rawProfileData.store_credit_summary === "object" && rawProfileData.store_credit_summary.available_balance_rupees !== undefined) {
    storeCreditSummaryPromise = Promise.resolve(rawProfileData.store_credit_summary);
  } else {
    storeCreditSummaryPromise = recalculateStoreCreditSummaryFromLedger(adminDb, profileId);
  }

  // 3. Orders query: Strictly targeted by customer_profile_id (max 50)
  const ordersByIdQuery = adminDb.collection("orders")
    .where("customer_profile_id", "==", profileId)
    .limit(50)
    .get();

  // 4. Notifications query: Single targeted query by customer_profile_id (max 10)
  const notificationsQuery = adminDb.collection("notification_logs")
    .where("customer_profile_id", "==", profileId)
    .limit(10)
    .get();

  // 5. Customer timeline events: Subcollection query (max 10)
  const eventsQuery = adminDb.collection("customer_profiles")
    .doc(profileId)
    .collection("events")
    .orderBy("occurred_at", "desc")
    .limit(10)
    .get();

  // Run all independent queries in parallel
  const [
    loyaltySummary,
    storeCreditSummary,
    ordersSnapshot,
    notificationsSnapshot,
    eventsSnapshot
  ] = await Promise.all([
    loyaltySummaryPromise,
    storeCreditSummaryPromise,
    ordersByIdQuery,
    notificationsQuery,
    eventsQuery
  ]);

  // Extract order documents matched by profile_id
  let ordersDocs: any[] = [];
  ordersSnapshot.forEach((snap: any) => {
    ordersDocs.push({ id: snap.id, ...snap.data() });
  });

  // Fallback targeted queries by phone/email if no orders were linked directly by customer_profile_id
  if (ordersDocs.length === 0 && (cleanPhone || (cleanEmail && cleanEmail !== "shop@sa-and-sha.com"))) {
    const fallbackQueries: Promise<any>[] = [];
    if (cleanPhone) {
      fallbackQueries.push(
        adminDb.collection("orders").where("customer_phone", "==", cleanPhone).limit(20).get()
      );
    }
    if (cleanEmail && cleanEmail !== "shop@sa-and-sha.com") {
      fallbackQueries.push(
        adminDb.collection("orders").where("customer_email", "==", cleanEmail).limit(20).get()
      );
    }
    if (fallbackQueries.length > 0) {
      const fallbackSnapshots = await Promise.all(fallbackQueries);
      const matchedMap = new Map<string, any>();
      fallbackSnapshots.forEach((snap) => {
        snap.forEach((docSnap: any) => {
          if (!matchedMap.has(docSnap.id)) {
            matchedMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          }
        });
      });
      ordersDocs = Array.from(matchedMap.values());
    }
  }

  // Sort orders descending by creation timestamp
  ordersDocs.sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  // Compute commerce metrics
  let activeOrdersCount = 0;
  let completedOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let returnedOrdersCount = 0;
  let lifetimeSpend = 0;

  for (const ord of ordersDocs) {
    const status = (ord.order_status || ord.payment_status || "placed").toLowerCase();
    const totalAmt = Number(ord.total_amount || ord.totalAmount || ord.total || 0);

    if (["delivered", "completed"].includes(status)) {
      completedOrdersCount += 1;
      lifetimeSpend += totalAmt;
    } else if (status === "cancelled") {
      cancelledOrdersCount += 1;
    } else if (["returned", "refunded", "refund_completed"].includes(status)) {
      returnedOrdersCount += 1;
    } else {
      activeOrdersCount += 1;
    }
  }

  const totalOrdersCount = ordersDocs.length;
  const avgOrderValue =
    completedOrdersCount > 0
      ? Math.round((lifetimeSpend / completedOrdersCount) * 100) / 100
      : 0;

  // Format top 3 recent orders
  const recentOrders = ordersDocs.slice(0, 3).map((ord) => {
    const statusRaw = (ord.order_status || ord.status || ord.payment_status || "placed").toLowerCase();
    let statusLabel = "Order Placed";
    if (statusRaw === "confirmed" || statusRaw === "paid") statusLabel = "Order Confirmed";
    else if (statusRaw === "processing" || statusRaw === "dispatched") statusLabel = "Processing";
    else if (statusRaw === "in_transit" || statusRaw === "shipped") statusLabel = "In Transit";
    else if (statusRaw === "out_for_delivery") statusLabel = "Out for Delivery";
    else if (statusRaw === "delivered" || statusRaw === "completed") statusLabel = "Delivered";
    else if (statusRaw === "cancelled") statusLabel = "Cancelled";
    else if (statusRaw === "returned" || statusRaw === "refunded") statusLabel = "Refunded";

    const canCancel = ["placed", "paid", "confirmed"].includes(statusRaw) && statusRaw !== "cancelled" && !ord.cancellation_requested;
    const eligibility = calculateReturnEligibility(ord);

    return {
      id: ord.id,
      order_number: ord.order_id || ord.orderNumber || ord.id,
      order_status: statusRaw,
      status_label: ord.cancellation_requested ? "Cancellation Requested" : statusLabel,
      total_amount: Number(ord.total_amount || ord.totalAmount || ord.total || 0),
      items_count: Array.isArray(ord.items)
        ? ord.items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)
        : 1,
      created_at: ord.created_at || new Date().toISOString(),
      items: Array.isArray(ord.items)
        ? ord.items.map((i: any) => ({
            product_id: i.product_id || i.id || "",
            name: i.name || i.title || "Garment",
            quantity: i.quantity || 1,
            price: i.price || 0,
            image: i.image || i.thumbnail || i.images?.[0] || "",
            size: i.size || "M",
            color: i.color || ""
          }))
        : [],
      tracking_number: ord.tracking_number || ord.trackingNumber || null,
      courier_name: ord.courier_name || ord.courierName || null,
      can_cancel: canCancel,
      cancellation_requested: !!ord.cancellation_requested,
      cancellation_reason: ord.cancellation_reason || null,
      can_return: eligibility.eligible,
      eligible: eligibility.eligible,
      is_delivered: eligibility.is_delivered,
      is_expired: eligibility.is_expired,
      return_deadline: eligibility.return_deadline,
      tax_invoice_finalized: !!(ord.tax_invoice_finalized || ord.invoice_finalized || ord.invoice_url),
      invoice_url: ord.invoice_url || null,
      payment_method: (ord.payment_method || "COD").toUpperCase(),
      payment_status: (ord.payment_status || (statusRaw === "paid" ? "PAID" : "PENDING")).toUpperCase(),
      refund_status: ord.refund_status || null,
      refund_amount: Number(ord.refund_amount || 0)
    };
  });

  // Loyalty Tier & Progress
  const currentTierName = loyaltySummary.current_tier || "MEMBER";
  const nextTierName = loyaltySummary.tier_progress?.next_tier || null;
  const spendRequired = loyaltySummary.tier_progress?.spend_required_for_next_tier_rupees || 0;
  const rollingSpend = loyaltySummary.tier_progress?.rolling_12m_spend_rupees || 0;

  // Single-query notification payload processing with email/phone historical fallback
  const notificationLogs: any[] = [];
  notificationsSnapshot.forEach((docSnap: any) => {
    notificationLogs.push({ id: docSnap.id, ...docSnap.data() });
  });

  if (notificationLogs.length === 0) {
    try {
      const fallbackPromises: Promise<any>[] = [];
      if (cleanEmail && cleanEmail !== "shop@sa-and-sha.com") {
        fallbackPromises.push(adminDb.collection("notification_logs").where("recipient", "==", cleanEmail).limit(10).get());
      }
      if (cleanPhone) {
        fallbackPromises.push(adminDb.collection("notification_logs").where("recipient", "==", cleanPhone).limit(10).get());
        fallbackPromises.push(adminDb.collection("notification_logs").where("recipient", "==", `+91${cleanPhone}`).limit(10).get());
      }
      const fallbackSnaps = await Promise.all(fallbackPromises);
      fallbackSnaps.forEach((snap: any) => {
        snap.forEach((docSnap: any) => {
          if (!notificationLogs.some((l) => l.id === docSnap.id)) {
            notificationLogs.push({ id: docSnap.id, ...docSnap.data() });
          }
        });
      });
    } catch (fbErr) {
      console.warn("[DASHBOARD] Historical notification fallback query warning:", fbErr);
    }
  }

  notificationLogs.sort(
    (a, b) =>
      new Date(b.queued_at || b.sent_at || 0).getTime() -
      new Date(a.queued_at || a.sent_at || 0).getTime()
  );

  const recentNotifications = notificationLogs.slice(0, 5).map((n) => {
    const channel = (n.channel || "EMAIL").toUpperCase();
    const statusRaw = (n.status || "DELIVERED").toUpperCase();
    let status: "DELIVERED" | "PENDING" | "FAILED" = "DELIVERED";
    if (["PENDING", "QUEUED", "PROCESSING"].includes(statusRaw)) status = "PENDING";
    else if (["FAILED", "ERROR", "BOUNCED"].includes(statusRaw)) status = "FAILED";

    const eventType = n.event_type || n.event || "NOTIFICATION";

    return {
      id: n.id,
      channel,
      event_type: eventType,
      recipient: n.recipient || "",
      status,
      title: n.title || n.subject || eventType.replace(/_/g, " "),
      queued_at: n.queued_at || n.sent_at || new Date().toISOString()
    };
  });

  // Timeline Events
  const timelineEvents: any[] = [];
  eventsSnapshot.forEach((docSnap: any) => {
    timelineEvents.push({ id: docSnap.id, ...docSnap.data() });
  });

  if (timelineEvents.length === 0) {
    timelineEvents.push({
      id: "evt_joined",
      event_type: "CUSTOMER_JOINED",
      category: "PROFILE",
      title: "Joined Sa and Sha",
      description: `Registered with Customer ID ${businessCustomerId}.`,
      occurred_at: rawCreatedAt
    });
    if (normalizedProfile.default_address) {
      timelineEvents.push({
        id: "evt_addr",
        event_type: "ADDRESS_ADDED",
        category: "PROFILE",
        title: "Default Address Set",
        description: `Primary address set to ${normalizedProfile.default_address.city}, ${normalizedProfile.default_address.state}.`,
        occurred_at: rawCreatedAt
      });
    }
  }

  const recentTimeline = timelineEvents.slice(0, 5).map((e) => ({
    id: e.id,
    event_type: e.event_type || e.type || "ACTIVITY",
    category: e.category || "GENERAL",
    title: e.title || "Customer Action",
    description: e.description || "",
    occurred_at: e.occurred_at || e.timestamp || new Date().toISOString()
  }));

  const defaultAddress =
    normalizedProfile.default_address ||
    (normalizedProfile.addresses && normalizedProfile.addresses[0]) ||
    null;

  return {
    success: true,
    profile: {
      profile_id: profileId,
      customer_id: businessCustomerId,
      first_name: firstName,
      full_name: fullName,
      email: normalizedProfile.email || "",
      phone: normalizedProfile.normalized_phone || "",
      created_at: rawCreatedAt,
      member_since: memberSinceStr,
      customer_tier: currentTierName
    },
    commerce_summary: {
      total_orders: totalOrdersCount,
      completed_orders: completedOrdersCount,
      active_orders: activeOrdersCount,
      cancelled_orders: cancelledOrdersCount,
      returned_orders: returnedOrdersCount,
      lifetime_spend: lifetimeSpend,
      average_order_value: avgOrderValue
    },
    loyalty_summary: {
      tier: currentTierName,
      available_points: loyaltySummary.available_points || 0,
      pending_points: loyaltySummary.pending_points || 0,
      lifetime_earned_points: loyaltySummary.lifetime_points_earned || 0,
      lifetime_redeemed_points: loyaltySummary.lifetime_points_redeemed || 0,
      rolling_12m_spend_rupees: rollingSpend,
      tier_progress: {
        current_tier: currentTierName,
        next_tier: nextTierName,
        spend_to_next_tier: spendRequired,
        progress_percent:
          spendRequired > 0
            ? Math.round((rollingSpend / (rollingSpend + spendRequired)) * 100)
            : 100
      }
    },
    store_credit_summary: {
      current_balance: storeCreditSummary.available_balance_rupees || 0,
      last_activity: null
    },
    address_summary: {
      total_addresses: (normalizedProfile.addresses || []).length,
      default_address: defaultAddress,
      all_addresses: normalizedProfile.addresses || []
    },
    recent_orders: recentOrders,
    notification_summary: {
      recent_notifications: recentNotifications
    },
    timeline_preview: recentTimeline,
    quick_stats: {
      active_orders_count: activeOrdersCount,
      completed_orders_count: completedOrdersCount,
      available_loyalty_points: loyaltySummary.available_points || 0,
      store_credit_balance: storeCreditSummary.available_balance_rupees || 0,
      saved_addresses_count: (normalizedProfile.addresses || []).length
    }
  };
}
