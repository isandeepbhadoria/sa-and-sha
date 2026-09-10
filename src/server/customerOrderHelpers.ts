import PDFDocument from "pdfkit";
import { reverseLoyaltyAndCreditForOrderCancellation } from "./loyaltyHelpers";
import { publishNotification } from "./notification/notificationEngine";
import { createCustomerTimelineEvent } from "./crmHelpers";
import { streamGstInvoicePdfResponse } from "./invoice/invoicePdfGenerator";

/**
 * Customer Orders & Post-Purchase Order Portal Helper
 */

export interface GetCustomerOrdersOptions {
  cursor?: string;
  pageSize?: number;
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  search?: string;
}

/**
 * Fetches authenticated customer's orders using indexed profile ID queries with cursor pagination
 */
export async function getCustomerOrders(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  options: GetCustomerOrdersOptions = {}
) {
  const pageSize = Math.min(Math.max(Number(options.pageSize) || 10, 1), 50);

  // 1. Primary indexed query by customer_profile_id
  let query = adminDb.collection("orders")
    .where("customer_profile_id", "==", profileId)
    .orderBy("created_at", "desc");

  const snap = await query.limit(pageSize + 10).get();
  let docs: any[] = [];
  snap.forEach((d: any) => docs.push({ id: d.id, ...d.data() }));

  // Fallback lookup if no orders linked directly by profile_id
  if (docs.length === 0) {
    const cleanPhone = (userPhone || "").replace(/\D/g, "");
    const cleanEmail = (userEmail || "").trim().toLowerCase();
    const fallbackQueries: Promise<any>[] = [];

    if (cleanPhone) {
      fallbackQueries.push(
        adminDb.collection("orders").where("customer_phone", "==", cleanPhone).limit(30).get()
      );
    }
    if (cleanEmail && cleanEmail !== "sales@sa-and-sha.com") {
      fallbackQueries.push(
        adminDb.collection("orders").where("customer_email", "==", cleanEmail).limit(30).get()
      );
    }

    if (fallbackQueries.length > 0) {
      const fallbackSnaps = await Promise.all(fallbackQueries);
      const matchedMap = new Map<string, any>();
      fallbackSnaps.forEach((fSnap) => {
        fSnap.forEach((docSnap: any) => {
          if (!matchedMap.has(docSnap.id)) {
            matchedMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          }
        });
      });
      docs = Array.from(matchedMap.values());
      docs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }
  }

  // Filter in memory for optional bounded filters
  if (options.status && options.status !== "all") {
    const targetStatus = options.status.toLowerCase();
    if (targetStatus === "active") {
      docs = docs.filter((o) => !["delivered", "completed", "cancelled", "returned", "refunded"].includes((o.order_status || o.status || "").toLowerCase()));
    } else if (targetStatus === "shipped") {
      docs = docs.filter((o) => ["shipped", "in_transit", "out_for_delivery", "dispatched"].includes((o.order_status || o.status || "").toLowerCase()));
    } else if (targetStatus === "delivered") {
      docs = docs.filter((o) => ["delivered", "completed"].includes((o.order_status || o.status || "").toLowerCase()));
    } else if (targetStatus === "cancelled") {
      docs = docs.filter((o) => (o.order_status || o.status || "").toLowerCase() === "cancelled");
    } else if (targetStatus === "returns") {
      docs = docs.filter((o) => ["returned", "refunded", "return_requested", "refund_initiated"].includes((o.order_status || o.status || "").toLowerCase()));
    } else {
      docs = docs.filter((o) => (o.order_status || o.status || "").toLowerCase() === targetStatus);
    }
  }

  if (options.paymentMethod && options.paymentMethod !== "all") {
    docs = docs.filter((o) => (o.payment_method || "").toLowerCase() === options.paymentMethod?.toLowerCase());
  }

  if (options.paymentStatus && options.paymentStatus !== "all") {
    docs = docs.filter((o) => (o.payment_status || o.status || "").toLowerCase() === options.paymentStatus?.toLowerCase());
  }

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    docs = docs.filter((o) =>
      (o.order_id || o.id || "").toLowerCase().includes(q) ||
      (o.tracking_number || "").toLowerCase().includes(q)
    );
  }

  // Cursor Pagination handling
  if (options.cursor) {
    let cursorTime = 0;
    try {
      const decoded = Buffer.from(options.cursor, "base64").toString("utf-8");
      cursorTime = new Date(decoded).getTime();
    } catch {
      cursorTime = new Date(options.cursor).getTime();
    }

    if (!isNaN(cursorTime) && cursorTime > 0) {
      docs = docs.filter((o) => new Date(o.created_at || 0).getTime() < cursorTime);
    }
  }

  const hasMore = docs.length > pageSize;
  const pageItems = docs.slice(0, pageSize);

  let nextCursor: string | null = null;
  if (hasMore && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    if (lastItem.created_at) {
      nextCursor = Buffer.from(lastItem.created_at).toString("base64");
    }
  }

  const formattedOrders = pageItems.map((o) => formatOrderSummary(o));

  return {
    success: true,
    orders: formattedOrders,
    nextCursor,
    hasMore
  };
}

/**
 * Format order summary for list view
 */
export function formatOrderSummary(o: any) {
  const statusRaw = (o.order_status || o.status || "placed").toLowerCase();
  const refundStatusRaw = (o.refund_status || "").toString().trim().toUpperCase();
  const isCod = (o.payment_method || "").toString().trim().toLowerCase().includes("cod");

  let statusLabel = "Order Placed";
  if (["confirmed", "paid"].includes(statusRaw)) statusLabel = "Confirmed";
  else if (["processing", "packed", "dispatched"].includes(statusRaw)) statusLabel = "Processing";
  else if (["in_transit", "shipped"].includes(statusRaw)) statusLabel = "In Transit";
  else if (statusRaw === "out_for_delivery") statusLabel = "Out for Delivery";
  else if (["delivered", "completed"].includes(statusRaw)) statusLabel = "Delivered";
  else if (statusRaw === "cancelled" || statusRaw === "cancellation_requested" || o.cancellation_requested) {
    if (isCod || refundStatusRaw === "NOT_REQUIRED") {
      statusLabel = "Cancelled";
    } else if (refundStatusRaw === "PROCESSED" || refundStatusRaw === "REFUND_COMPLETED" || statusRaw === "refunded" || statusRaw === "refund_completed") {
      statusLabel = "Cancelled — Refund Processed";
    } else if (refundStatusRaw === "UNKNOWN" || refundStatusRaw === "REFUND_STATUS_BEING_CONFIRMED" || o.reconciliation_required) {
      statusLabel = "Cancelled — Refund Status Being Confirmed";
    } else if (refundStatusRaw === "FAILED" || refundStatusRaw === "REFUND_FAILED") {
      statusLabel = "Cancelled — Refund Failed / Support Required";
    } else {
      statusLabel = "Cancelled — Refund Pending";
    }
  } else if (["returned", "refunded", "refund_completed"].includes(statusRaw)) {
    statusLabel = "Cancelled — Refund Processed";
  }

  const items = Array.isArray(o.items) ? o.items : [];
  const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0);
  const firstItemImage = items[0]?.image || items[0]?.thumbnail || items[0]?.images?.[0] || "";

  const canCancel = ["placed", "paid", "confirmed"].includes(statusRaw) && statusRaw !== "cancelled" && !o.cancellation_requested;
  const canReturn = ["delivered", "completed"].includes(statusRaw);

  return {
    id: o.id,
    order_number: o.order_id || o.orderNumber || o.id,
    order_status: statusRaw,
    status_label: statusLabel,
    payment_method: (o.payment_method || "COD").toUpperCase(),
    payment_status: (o.payment_status || (statusRaw === "paid" ? "PAID" : "PENDING")).toUpperCase(),
    total_amount: Number(o.grand_total || o.total_amount || o.total || 0),
    items_count: itemCount,
    thumbnail: firstItemImage,
    city: o.city || "",
    state: o.state || "",
    created_at: o.created_at || new Date().toISOString(),
    tracking_number: o.tracking_number || null,
    courier_name: o.courier_name || null,
    tracking_url: o.tracking_url || null,
    can_cancel: canCancel,
    can_return: canReturn,
    refund_status: o.refund_status || null,
    refund_amount: Number(o.refund_amount || 0)
  };
}

/**
 * Retrieves single order details ensuring strict customer ownership check
 */
export async function getCustomerOrderDetail(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  orderIdentifier: string
) {
  let docSnap = await adminDb.collection("orders").doc(orderIdentifier).get();
  let orderData: any = null;

  if (docSnap.exists) {
    orderData = { id: docSnap.id, ...docSnap.data() };
  } else {
    const qSnap = await adminDb.collection("orders").where("order_id", "==", orderIdentifier).limit(1).get();
    if (!qSnap.empty) {
      orderData = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
    }
  }

  if (!orderData) {
    return { success: false, statusCode: 404, error: "Order not found." };
  }

  // Strict ownership check
  const oProfileId = orderData.customer_profile_id || orderData.profile_id || "";
  const cleanUserPhone = (userPhone || "").replace(/\D/g, "");
  const cleanOrderPhone = (orderData.customer_phone || "").replace(/\D/g, "");
  const cleanUserEmail = (userEmail || "").trim().toLowerCase();
  const cleanOrderEmail = (orderData.customer_email || "").trim().toLowerCase();

  const matchProfile = oProfileId && oProfileId === profileId;
  const matchPhone = cleanUserPhone && cleanOrderPhone && cleanUserPhone === cleanOrderPhone;
  const matchEmail = cleanUserEmail && cleanUserEmail !== "sales@sa-and-sha.com" && cleanOrderEmail === cleanUserEmail;

  if (!matchProfile && !matchPhone && !matchEmail) {
    return { success: false, statusCode: 404, error: "Order not found." }; // Safe 404 to avoid enumeration
  }

  // Bounded timeline and notification logs read
  const [notifSnap, eventsSnap] = await Promise.all([
    adminDb.collection("notification_logs")
      .where("customer_profile_id", "==", profileId)
      .limit(20)
      .get(),
    adminDb.collection("customer_profiles")
      .doc(profileId)
      .collection("events")
      .orderBy("occurred_at", "desc")
      .limit(10)
      .get()
  ]);

  // Filter notifications linked to this order
  const orderId = orderData.order_id || orderData.id;
  const notifLogs: any[] = [];
  notifSnap.forEach((dSnap: any) => {
    const nd = dSnap.data();
    if (nd && (nd.payload?.order_id === orderId || nd.order?.order_id === orderId || nd.recipient === cleanOrderEmail || nd.recipient === cleanUserPhone)) {
      notifLogs.push({
        id: dSnap.id,
        channel: (nd.channel || "EMAIL").toUpperCase(),
        event_type: nd.event_type || nd.event || "NOTIFICATION",
        status: (nd.status || "DELIVERED").toUpperCase(),
        title: nd.title || nd.subject || "Order Update",
        queued_at: nd.queued_at || nd.sent_at || new Date().toISOString()
      });
    }
  });

  // Build timeline steps
  const statusRaw = (orderData.order_status || orderData.status || "placed").toLowerCase();
  const timelineSteps = buildOrderTimeline(orderData, statusRaw);

  const canCancel = ["placed", "paid", "confirmed"].includes(statusRaw) && statusRaw !== "cancelled";
  const canReturn = ["delivered", "completed"].includes(statusRaw);

  return {
    success: true,
    order: {
      id: orderData.id,
      order_id: orderData.order_id || orderData.id,
      created_at: orderData.created_at || new Date().toISOString(),
      order_status: statusRaw,
      payment_method: (orderData.payment_method || "COD").toUpperCase(),
      payment_status: (orderData.payment_status || (statusRaw === "paid" ? "PAID" : "PENDING")).toUpperCase(),
      payment_id: orderData.payment_id || null,
      cancellation_reason: orderData.cancellation_reason || null,
      cancelled_at: orderData.cancelled_at || null,
      
      // Customer Info Snapshot
      customer_name: orderData.customer_name || "",
      customer_email: orderData.customer_email || "",
      customer_phone: orderData.customer_phone || "",

      // Address Snapshot
      address: orderData.address || "",
      city: orderData.city || "",
      state: orderData.state || "",
      pincode: orderData.pincode || "",
      country: orderData.country || "India",

      // Items Snapshot
      items: (Array.isArray(orderData.items) ? orderData.items : []).map((i: any) => ({
        product_id: i.product_id || i.id || "",
        name: i.name || i.title || "Garment",
        quantity: i.quantity || 1,
        price: Number(i.price || 0),
        total_price: Number(i.quantity || 1) * Number(i.price || 0),
        image: i.image || i.thumbnail || i.images?.[0] || "",
        size: i.size || "M",
        color: i.color || ""
      })),

      // Pricing & Discounts Breakdown
      subtotal: Number(orderData.subtotal || 0),
      discount: Number(orderData.discount || orderData.discount_amount || 0),
      promo_code: orderData.promo_code || null,
      loyalty_points_redeemed: Number(orderData.loyalty_points_redeemed || 0),
      store_credit_redeemed_rupees: Number(orderData.store_credit_redeemed_rupees || 0),
      shipping_cost: Number(orderData.shipping_cost || 0),
      grand_total: Number(orderData.grand_total || orderData.total_amount || 0),

      // Shipment & Tracking
      courier_name: orderData.courier_name || null,
      tracking_number: orderData.tracking_number || null,
      tracking_url: orderData.tracking_url || null,
      estimated_delivery: orderData.estimated_delivery || null,

      // Refunds & Restorations
      refund_status: orderData.refund_status || null,
      refund_amount: Number(orderData.refund_amount || 0),
      points_restored: Number(orderData.points_restored || 0),
      credit_restored_rupees: Number(orderData.credit_restored_rupees || 0),

      // Actions & Timeline
      timeline: timelineSteps,
      notifications: notifLogs.slice(0, 5),
      can_cancel: canCancel,
      can_return: canReturn,
      can_reorder: true,
      can_invoice: true
    }
  };
}

/**
 * Builds verified order status timeline steps
 */
function buildOrderTimeline(order: any, currentStatus: string) {
  const steps = [
    {
      key: "placed",
      title: "Order Placed",
      description: "Order placed successfully.",
      timestamp: order.created_at || null,
      completed: true
    },
    {
      key: "confirmed",
      title: "Order Confirmed",
      description: "Order confirmed and queued for fulfillment.",
      timestamp: order.confirmed_at || order.created_at || null,
      completed: ["confirmed", "paid", "processing", "packed", "dispatched", "shipped", "in_transit", "out_for_delivery", "delivered", "completed"].includes(currentStatus)
    },
    {
      key: "processing",
      title: "Packed & Ready",
      description: "Garments hand-checked and packed.",
      timestamp: order.packed_at || null,
      completed: ["processing", "packed", "dispatched", "shipped", "in_transit", "out_for_delivery", "delivered", "completed"].includes(currentStatus)
    },
    {
      key: "shipped",
      title: "Shipped",
      description: order.courier_name ? `Handed to ${order.courier_name} (${order.tracking_number || "In transit"})` : "Handed over to courier.",
      timestamp: order.shipped_at || null,
      completed: ["shipped", "in_transit", "out_for_delivery", "delivered", "completed"].includes(currentStatus)
    },
    {
      key: "delivered",
      title: "Delivered",
      description: "Package delivered to destination.",
      timestamp: order.delivered_at || null,
      completed: ["delivered", "completed"].includes(currentStatus)
    }
  ];

  if (currentStatus === "cancelled") {
    return [
      steps[0],
      {
        key: "cancelled",
        title: "Order Cancelled",
        description: order.cancellation_reason ? `Reason: ${order.cancellation_reason}` : "Order was cancelled.",
        timestamp: order.cancelled_at || order.updated_at || new Date().toISOString(),
        completed: true,
        isTerminal: true
      }
    ];
  }

  if (["returned", "refunded"].includes(currentStatus)) {
    steps.push({
      key: "refunded",
      title: "Refund Processed",
      description: `Refund processed (${order.refund_amount ? "₹" + order.refund_amount : "Completed"}).`,
      timestamp: order.refunded_at || order.updated_at || new Date().toISOString(),
      completed: true
    });
  }

  return steps;
}

/**
 * Generates customer PDF tax invoice stream using verified GST invoice snapshot
 */
export async function streamCustomerInvoicePdf(order: any, res: any, invoiceSnapshot?: any) {
  if (invoiceSnapshot) {
    return await streamGstInvoicePdfResponse(invoiceSnapshot, res);
  }
  
  // Fallback if no snapshot provided: return 400 invoice unavailable
  if (!res.headersSent) {
    res.status(400).json({
      success: false,
      code: "INVOICE_NOT_AVAILABLE",
      error: "Tax invoice is not available yet. Please contact support if you require assistance."
    });
  }
}

/**
 * Previews reordering items against current Firestore product prices and stock availability
 */
export async function reorderPreview(adminDb: any, orderItems: any[]) {
  const availableItems: any[] = [];
  const unavailableItems: any[] = [];
  const changedPriceItems: any[] = [];

  for (const item of orderItems) {
    const prodId = item.product_id || item.id;
    if (!prodId) {
      unavailableItems.push({ ...item, reason: "Product missing" });
      continue;
    }

    const prodSnap = await adminDb.collection("products").doc(prodId).get();
    if (!prodSnap.exists) {
      unavailableItems.push({ ...item, reason: "Product no longer available" });
      continue;
    }

    const currentProd = prodSnap.data();
    if (currentProd.active === false || currentProd.status === "archived") {
      unavailableItems.push({ ...item, reason: "Product discontinued" });
      continue;
    }

    const currentPrice = Number(currentProd.price || 0);
    const oldPrice = Number(item.price || 0);
    const currentStock = Number(currentProd.stock || currentProd.inventory || 99);

    if (currentStock < 1) {
      unavailableItems.push({ ...item, reason: "Out of stock" });
      continue;
    }

    const cartItem = {
      product_id: prodId,
      name: currentProd.name || item.name,
      image: currentProd.image || currentProd.thumbnail || item.image || "",
      size: item.size || "M",
      color: item.color || "",
      quantity: Math.min(item.quantity || 1, currentStock),
      price: currentPrice,
      oldPrice: oldPrice
    };

    if (currentPrice !== oldPrice) {
      changedPriceItems.push({
        ...cartItem,
        priceDifference: currentPrice - oldPrice
      });
    }

    availableItems.push(cartItem);
  }

  return {
    success: true,
    availableItems,
    unavailableItems,
    changedPriceItems
  };
}

/**
 * Handles customer order cancellation with idempotent reversals, notifications and timeline log
 */
export async function cancelCustomerOrder(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  orderIdentifier: string,
  reason: string
) {
  let docSnap = await adminDb.collection("orders").doc(orderIdentifier).get();
  let docId = docSnap.id;
  let orderData: any = null;

  if (docSnap.exists) {
    orderData = docSnap.data();
  } else {
    const qSnap = await adminDb.collection("orders").where("order_id", "==", orderIdentifier).limit(1).get();
    if (!qSnap.empty) {
      docSnap = qSnap.docs[0];
      docId = docSnap.id;
      orderData = docSnap.data();
    }
  }

  if (!orderData) {
    return { success: false, statusCode: 404, error: "Order not found." };
  }

  // Ownership verification
  const oProfileId = orderData.customer_profile_id || orderData.profile_id || "";
  const cleanUserPhone = (userPhone || "").replace(/\D/g, "");
  const cleanOrderPhone = (orderData.customer_phone || "").replace(/\D/g, "");
  const cleanUserEmail = (userEmail || "").trim().toLowerCase();
  const cleanOrderEmail = (orderData.customer_email || "").trim().toLowerCase();

  const matchProfile = oProfileId && oProfileId === profileId;
  const matchPhone = cleanUserPhone && cleanOrderPhone && cleanUserPhone === cleanOrderPhone;
  const matchEmail = cleanUserEmail && cleanUserEmail !== "sales@sa-and-sha.com" && cleanOrderEmail === cleanUserEmail;

  if (!matchProfile && !matchPhone && !matchEmail) {
    return { success: false, statusCode: 404, error: "Order not found." };
  }

  const currentStatus = (orderData.order_status || orderData.status || "placed").toLowerCase();

  if (currentStatus === "cancelled") {
    return { success: true, message: "Order is already cancelled.", order_id: orderData.order_id };
  }

  const allowedStatuses = ["placed", "paid", "confirmed"];
  if (!allowedStatuses.includes(currentStatus)) {
    return {
      success: false,
      statusCode: 400,
      error: `Order cannot be cancelled in '${currentStatus.toUpperCase()}' state as processing/shipping has already begun.`
    };
  }

  const nowIso = new Date().toISOString();
  const cancelReason = (reason || "Cancelled by customer").trim();
  const paymentMethod = (orderData.payment_method || "").toString().trim().toLowerCase();
  const isCod = paymentMethod.includes("cod") || paymentMethod === "cash on delivery";

  const orderUpdatePayload: any = {
    order_status: "cancelled",
    status: "cancelled",
    cancellation_reason: cancelReason,
    cancelled_at: nowIso,
    cancelled_by: "customer",
    updated_at: nowIso
  };

  if (isCod) {
    orderUpdatePayload.refund_required = false;
    orderUpdatePayload.refund_status = "NOT_REQUIRED";
    orderUpdatePayload.refund_provider = "none";
  } else {
    // Prepaid Razorpay order: customer request marks cancellation & refund pending, BUT NEVER calls Razorpay API directly
    orderUpdatePayload.cancellation_requested = true;
    orderUpdatePayload.cancellation_request_reason = cancelReason;
    orderUpdatePayload.cancellation_requested_at = nowIso;
    orderUpdatePayload.refund_required = true;
    orderUpdatePayload.refund_status = "PENDING";
    orderUpdatePayload.refund_amount = Number(orderData.grand_total || 0);
    orderUpdatePayload.refund_currency = "INR";
    orderUpdatePayload.refund_provider = "razorpay";
    orderUpdatePayload.refund_requested_at = nowIso;
  }

  // GST Invoice Protection Logic
  const hasFinalizedGstInvoice = orderData.invoice_status === "FINALIZED" || !!orderData.invoice_id;
  if (hasFinalizedGstInvoice) {
    // Already finalized: NEVER delete, mutate, renumber, or overwrite the immutable GST invoice.
    // Flag for proper GST credit-note lifecycle in subsequent GST phase.
    orderUpdatePayload.requires_credit_note = true;
    orderUpdatePayload.credit_note_status = "PENDING_CREDIT_NOTE_PHASE";
  } else {
    // Permanently block future invoice finalization for this cancelled order
    orderUpdatePayload.invoice_eligibility = {
      eligible: false,
      reasonCode: "ORDER_CANCELLED",
      reasonDescription: "Order was cancelled prior to invoice finalization."
    };
  }

  // Update order document
  await adminDb.collection("orders").doc(docId).update(orderUpdatePayload);

  const orderIdStr = orderData.order_id || docId;

  // Restore points & credit via existing helper
  let restorationRes = { pointsRestored: 0, creditRestoredRupees: 0 };
  try {
    restorationRes = await reverseLoyaltyAndCreditForOrderCancellation(adminDb, orderIdStr, cancelReason);
  } catch (revErr) {
    console.error("[CANCELLATION LEDGER REVERSAL] Non-blocking error:", revErr);
  }

  // Inventory Restoration
  try {
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    for (const item of items) {
      const pId = item.product_id || item.id;
      if (pId) {
        const pRef = adminDb.collection("products").doc(pId);
        const pSnap = await pRef.get();
        if (pSnap.exists) {
          const currentStock = Number(pSnap.data()?.stock || 0);
          await pRef.update({
            stock: currentStock + (item.quantity || 1),
            updated_at: nowIso
          });
        }
      }
    }
  } catch (invErr) {
    console.error("[CANCELLATION STOCK RESTORE] Non-blocking error:", invErr);
  }

  // Dispatch Notification Event
  try {
    await publishNotification(adminDb, {
      event: "ORDER_CANCELLED",
      customerProfileId: profileId,
      recipientEmail: orderData.customer_email,
      recipientPhone: orderData.customer_phone,
      customerName: orderData.customer_name,
      order: { ...orderData, order_status: "cancelled", cancellation_reason: cancelReason },
      payload: {
        reason: cancelReason,
        pointsRestored: restorationRes.pointsRestored,
        creditRestoredRupees: restorationRes.creditRestoredRupees
      }
    });
  } catch (notifErr) {
    console.error("[CANCELLATION NOTIFICATION] Non-blocking error:", notifErr);
  }

  // CRM Timeline Log
  try {
    await createCustomerTimelineEvent(
      adminDb,
      profileId,
      "order_cancelled",
      "Order Cancelled",
      `Order #${orderIdStr} was cancelled. Reason: ${cancelReason}`,
      "customer_action",
      { relatedOrderId: orderIdStr }
    );
  } catch (tmErr) {
    console.error("[CANCELLATION TIMELINE LOG] Non-blocking error:", tmErr);
  }

  return {
    success: true,
    message: `Order #${orderIdStr} successfully cancelled.`,
    order_id: orderIdStr,
    points_restored: restorationRes.pointsRestored,
    credit_restored_rupees: restorationRes.creditRestoredRupees
  };
}
