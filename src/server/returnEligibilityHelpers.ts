// Authoritative 7-Day Return & Exchange Eligibility Engine

export const RETURN_WINDOW_DAYS = 7;
export const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface ItemEligibilityResult {
  product_id: string;
  sku?: string;
  size?: string;
  eligible: boolean;
  reason?: string;
  active_request_id?: string;
}

export interface ReturnEligibilityResult {
  eligible: boolean;
  is_delivered: boolean;
  is_cancelled: boolean;
  is_expired: boolean;
  reason: string;
  delivered_at: string | null;
  return_deadline: string | null;
  remaining_days: number;
  window_days: number;
  items?: ItemEligibilityResult[];
}

/**
 * Calculates authoritative server-side return eligibility for an order based on 7 calendar days from delivered_at.
 * 
 * @param order Order document
 * @param existingReturnRequests List of active or completed return requests for this order
 * @param nowMs Optional reference timestamp (defaults to Date.now() for authoritative server time)
 */
export function calculateReturnEligibility(
  order: any,
  existingReturnRequests: any[] = [],
  nowMs: number = Date.now()
): ReturnEligibilityResult {
  const status = (order.status || order.order_status || "").toString().toLowerCase();
  const isCancelled = status === "cancelled" || status.includes("cancel");
  const isDelivered = status === "delivered";

  // Determine authoritative delivered_at
  let deliveredAtIso: string | null = null;
  if (order.delivered_at) {
    deliveredAtIso = new Date(order.delivered_at).toISOString();
  } else if (order.deliveredAt) {
    deliveredAtIso = new Date(order.deliveredAt).toISOString();
  } else if (isDelivered) {
    // Fallback for delivered orders without explicit delivered_at timestamp
    deliveredAtIso = new Date(order.updated_at || order.created_at || nowMs).toISOString();
  }

  if (isCancelled) {
    return {
      eligible: false,
      is_delivered: isDelivered,
      is_cancelled: true,
      is_expired: false,
      reason: "Order was cancelled.",
      delivered_at: deliveredAtIso,
      return_deadline: null,
      remaining_days: 0,
      window_days: RETURN_WINDOW_DAYS
    };
  }

  if (!isDelivered || !deliveredAtIso) {
    return {
      eligible: false,
      is_delivered: false,
      is_cancelled: false,
      is_expired: false,
      reason: "Order is in transit or not yet marked delivered.",
      delivered_at: null,
      return_deadline: null,
      remaining_days: 0,
      window_days: RETURN_WINDOW_DAYS
    };
  }

  const deliveredAtMs = new Date(deliveredAtIso).getTime();
  const deadlineMs = deliveredAtMs + RETURN_WINDOW_MS;
  const deadlineIso = new Date(deadlineMs).toISOString();
  const remainingMs = deadlineMs - nowMs;

  const isExpired = nowMs > deadlineMs;

  if (isExpired) {
    return {
      eligible: false,
      is_delivered: true,
      is_cancelled: false,
      is_expired: true,
      reason: `Return/Exchange 7-day window expired on ${new Date(deadlineMs).toLocaleDateString("en-IN")}.`,
      delivered_at: deliveredAtIso,
      return_deadline: deadlineIso,
      remaining_days: 0,
      window_days: RETURN_WINDOW_DAYS
    };
  }

  const remainingDays = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  // Check item-level eligibility against active/past return requests
  const orderRequests = existingReturnRequests.filter(r => r.order_id === order.order_id || r.order_number === order.order_number);

  const itemsEligibility: ItemEligibilityResult[] = (order.items || []).map((it: any) => {
    const activeReq = orderRequests.find(r =>
      Array.isArray(r.items) && r.items.some((ri: any) =>
        ri.product_id === it.product_id && (ri.original_size === it.size || ri.size === it.size)
      )
    );

    if (activeReq) {
      return {
        product_id: it.product_id,
        sku: it.sku,
        size: it.size,
        eligible: false,
        reason: `Return or exchange request (${activeReq.rma_number || activeReq.request_id || "existing"}) already submitted for this item.`,
        active_request_id: activeReq.request_id || activeReq.id
      };
    }

    return {
      product_id: it.product_id,
      sku: it.sku,
      size: it.size,
      eligible: true
    };
  });

  const hasAnyEligibleItem = itemsEligibility.some(i => i.eligible);

  return {
    eligible: hasAnyEligibleItem,
    is_delivered: true,
    is_cancelled: false,
    is_expired: false,
    reason: hasAnyEligibleItem ? "Eligible for return or exchange." : "All items in this order have active or completed return requests.",
    delivered_at: deliveredAtIso,
    return_deadline: deadlineIso,
    remaining_days: remainingDays,
    window_days: RETURN_WINDOW_DAYS,
    items: itemsEligibility
  };
}
