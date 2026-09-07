import { createCustomerTimelineEvent } from "./crmHelpers";
import { publishNotification } from "./notification/notificationEngine";

// Status Machine constants and allowed transitions
export const ALLOWED_RMA_STATUSES = [
  "requested",
  "under_review",
  "information_required",
  "approved",
  "rejected",
  "pickup_scheduling",
  "pickup_scheduled",
  "picked_up",
  "warehouse_received",
  "inspection_in_progress",
  "inspection_completed",
  "inspection_passed",
  "inspection_failed",
  "manager_review",
  "refund_approved",
  "refund_processing",
  "refund_completed",
  "exchange_approved",
  "exchange_processing",
  "exchange_shipped",
  "completed",
  "cancelled"
] as const;

export type RmaStatus = (typeof ALLOWED_RMA_STATUSES)[number];

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ["under_review", "rejected", "information_required", "approved", "cancelled"],
  under_review: ["approved", "rejected", "information_required", "pickup_scheduling", "cancelled"],
  information_required: ["under_review", "approved", "rejected", "cancelled"],
  approved: ["pickup_scheduling", "pickup_scheduled", "warehouse_received", "rejected", "cancelled"],
  return_approved: ["pickup_scheduling", "pickup_scheduled", "warehouse_received", "rejected", "cancelled"],
  pickup_scheduling: ["pickup_scheduled", "approved", "warehouse_received", "cancelled"],
  pickup_scheduled: ["picked_up", "warehouse_received", "pickup_scheduled", "cancelled"],
  picked_up: ["warehouse_received", "picked_up"],
  warehouse_received: ["inspection_in_progress", "inspection_completed", "inspection_passed", "inspection_failed", "manager_review"],
  inspection_in_progress: ["inspection_completed", "inspection_passed", "inspection_failed", "manager_review"],
  inspection_completed: ["inspection_passed", "inspection_failed", "manager_review", "refund_approved", "exchange_approved", "rejected"],
  inspection_passed: ["refund_approved", "exchange_approved", "manager_review"],
  inspection_failed: ["rejected", "manager_review"],
  manager_review: ["inspection_passed", "inspection_failed", "refund_approved", "exchange_approved", "rejected"],
  refund_approved: ["refund_processing", "refund_completed"],
  refund_processing: ["refund_completed"],
  refund_completed: ["completed"],
  exchange_approved: ["exchange_processing", "exchange_shipped"],
  exchange_processing: ["exchange_shipped"],
  exchange_shipped: ["completed"],
  completed: [],
  cancelled: []
};

/**
 * Calculates SLA due date and SLA state given current status and created timestamp
 */
export function calculateSlaState(createdIso: string, status: string, slaDueIso?: string) {
  const nowMs = Date.now();
  let dueMs = slaDueIso ? new Date(slaDueIso).getTime() : new Date(createdIso).getTime() + 24 * 60 * 60 * 1000;

  if (isNaN(dueMs)) {
    dueMs = nowMs + 24 * 60 * 60 * 1000;
  }

  const isResolved = ["completed", "refund_completed", "exchange_shipped", "rejected", "cancelled"].includes(status.toLowerCase());
  if (isResolved) {
    return { sla_due_at: new Date(dueMs).toISOString(), sla_state: "on_time" as const };
  }

  const diffHours = (dueMs - nowMs) / (1000 * 60 * 60);
  let sla_state: "on_time" | "due_soon" | "overdue" = "on_time";

  if (diffHours < 0) {
    sla_state = "overdue";
  } else if (diffHours <= 6) {
    sla_state = "due_soon";
  }

  return {
    sla_due_at: new Date(dueMs).toISOString(),
    sla_state
  };
}

/**
 * PII Masking helper for Admin List API
 */
export function maskPii(text: string, type: "email" | "phone" | "name"): string {
  if (!text) return "";
  if (type === "phone") {
    const clean = text.replace(/\D/g, "");
    if (clean.length >= 10) {
      return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
    }
    return "******";
  }
  if (type === "email") {
    const parts = text.split("@");
    if (parts.length === 2) {
      const user = parts[0];
      const maskedUser = user.length > 2 ? `${user.slice(0, 2)}***` : `${user}***`;
      return `${maskedUser}@${parts[1]}`;
    }
    return "***@***.com";
  }
  return text;
}

/**
 * Sanitize string for CSV formula injection protection
 */
export function sanitizeCsvField(field: any): string {
  if (field === null || field === undefined) return "";
  const str = String(field);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Admin Audit Logger helper
 */
export async function logAdminReturnAudit(
  adminDb: any,
  adminEmail: string,
  action: string,
  rmaNumber: string,
  details: string,
  metadata: Record<string, any> = {}
) {
  try {
    const nowIso = new Date().toISOString();
    const auditDoc = {
      admin_email: adminEmail,
      performed_by: adminEmail,
      action: action.startsWith("rma_") ? action : `rma_${action}`,
      rma_number: rmaNumber,
      order_id: metadata.order_id || "",
      customer_profile_id: metadata.customer_profile_id || "",
      details: details,
      previous_state: metadata.previous_state || null,
      new_state: metadata.new_state || null,
      reason: metadata.reason || null,
      created_at: nowIso,
      timestamp: nowIso
    };

    await adminDb.collection("admin_audit_logs").add(auditDoc);

    const returnId = metadata.return_id || rmaNumber;
    if (returnId) {
      try {
        await adminDb.collection("return_requests").doc(returnId).collection("audit_logs").add(auditDoc);
      } catch (sErr) {
        // subcollection optional
      }
    }
  } catch (err) {
    console.error("[ADMIN RMA AUDIT] Failed to write audit log:", err);
  }
}

/**
 * GET /api/admin/returns List Query Handler with Cursor Pagination
 */
export async function getAdminReturnsList(adminDb: any, queryParams: any) {
  const {
    status,
    request_type,
    resolution,
    priority,
    sla_state,
    customer_id,
    order_id,
    rma_number,
    assigned_staff,
    courier,
    search,
    pageSize = 25,
    cursor
  } = queryParams;

  const limitNum = Math.min(Math.max(Number(pageSize) || 25, 1), 100);

  let query = adminDb.collection("return_requests");

  // Apply Firestore filtering parameters if available
  if (status && status !== "all") {
    query = query.where("status", "==", status.toLowerCase());
  }
  if (request_type && request_type !== "all") {
    query = query.where("request_type", "==", request_type.toLowerCase());
  }
  if (resolution && resolution !== "all") {
    query = query.where("resolution", "==", resolution.toLowerCase());
  }
  if (priority && priority !== "all") {
    query = query.where("priority", "==", priority.toLowerCase());
  }
  if (assigned_staff && assigned_staff !== "all") {
    query = query.where("assigned_to_email", "==", assigned_staff.toLowerCase());
  }

  // Primary Order: created_at DESC
  query = query.orderBy("created_at", "desc");

  // Apply Cursor if provided
  if (cursor) {
    try {
      const cursorSnap = await adminDb.collection("return_requests").doc(cursor).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    } catch (cErr) {
      console.warn("[ADMIN RMA LIST] Cursor resolution error:", cErr);
    }
  }

  let snap;
  try {
    snap = await query.limit(limitNum + 1).get();
  } catch (err) {
    console.warn("[ADMIN RMA LIST] Index fallback scan:", err);
    // Unindexed fallback query bounded to limit 50
    const fallbackSnap = await adminDb.collection("return_requests").limit(50).get();
    snap = fallbackSnap;
  }

  let docs: any[] = [];
  snap.forEach((d: any) => docs.push({ id: d.id, ...d.data() }));

  // In-memory filters for fields not composite-indexed in Firestore
  if (sla_state && sla_state !== "all") {
    docs = docs.filter((d) => {
      const computed = calculateSlaState(d.created_at || new Date().toISOString(), d.status || "requested", d.sla_due_at);
      return computed.sla_state === sla_state;
    });
  }

  if (customer_id) {
    docs = docs.filter(
      (d) =>
        (d.customer_profile_id || "").toLowerCase() === customer_id.toLowerCase() ||
        (d.customer_phone || "").includes(customer_id)
    );
  }

  if (order_id) {
    docs = docs.filter((d) => (d.order_id || "").toLowerCase() === order_id.toLowerCase());
  }

  if (rma_number) {
    docs = docs.filter((d) => (d.rma_number || d.request_id || "").toLowerCase() === rma_number.toLowerCase());
  }

  if (courier && courier !== "all") {
    docs = docs.filter((d) => (d.courier || "").toLowerCase() === courier.toLowerCase());
  }

  if (search) {
    const s = search.toLowerCase().trim();
    docs = docs.filter(
      (d) =>
        (d.rma_number || d.request_id || "").toLowerCase().includes(s) ||
        (d.order_id || "").toLowerCase().includes(s) ||
        (d.customer_name || "").toLowerCase().includes(s) ||
        (d.customer_profile_id || "").toLowerCase().includes(s)
    );
  }

  const hasMore = docs.length > limitNum;
  if (hasMore) {
    docs = docs.slice(0, limitNum);
  }

  const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

  // Mask PII for Queue List View
  const items = docs.map((d) => {
    const sla = calculateSlaState(d.created_at || new Date().toISOString(), d.status || "requested", d.sla_due_at);
    return {
      id: d.id,
      rma_number: d.rma_number || d.request_id,
      order_id: d.order_id,
      customer_profile_id: d.customer_profile_id || "GUEST",
      customer_name: d.customer_name || "Valued Customer",
      customer_email_masked: maskPii(d.customer_email || "", "email"),
      customer_phone_masked: maskPii(d.customer_phone || "", "phone"),
      request_type: d.request_type || "return",
      resolution: d.resolution || "refund_source",
      items_count: Array.isArray(d.items) ? d.items.length : 0,
      status: d.status || "requested",
      status_label: d.status_label || d.status,
      priority: d.priority || "normal",
      sla_due_at: sla.sla_due_at,
      sla_state: sla.sla_state,
      pickup_status: d.pickup_status || "not_scheduled",
      courier: d.courier || "Unassigned",
      assigned_to_email: d.assigned_to_email || "Unassigned",
      assigned_to_name: d.assigned_to_name || "Unassigned",
      has_photos: Array.isArray(d.photos) && d.photos.length > 0,
      estimated_refund_total: d.estimated_refund_total || 0,
      created_at: d.created_at,
      updated_at: d.updated_at
    };
  });

  return {
    success: true,
    items,
    pageSize: limitNum,
    hasMore,
    nextCursor
  };
}

/**
 * GET /api/admin/returns/stats Header Badge Counts Handler
 */
export async function getAdminReturnStats(adminDb: any) {
  try {
    const snap = await adminDb.collection("return_requests").limit(200).get();
    let pendingCount = 0;
    let overdueCount = 0;
    let highPriorityCount = 0;

    snap.forEach((doc: any) => {
      const data = doc.data();
      const st = (data.status || "").toLowerCase();
      if (["requested", "under_review", "information_required", "pickup_scheduling"].includes(st)) {
        pendingCount++;
      }
      const sla = calculateSlaState(data.created_at || new Date().toISOString(), st, data.sla_due_at);
      if (sla.sla_state === "overdue" && !["completed", "refund_completed", "exchange_shipped", "rejected", "cancelled"].includes(st)) {
        overdueCount++;
      }
      if (["high", "urgent"].includes((data.priority || "").toLowerCase())) {
        highPriorityCount++;
      }
    });

    return {
      success: true,
      pendingCount,
      overdueCount,
      highPriorityCount
    };
  } catch (err) {
    console.error("[ADMIN RMA STATS] Error calculating stats:", err);
    return { success: true, pendingCount: 0, overdueCount: 0, highPriorityCount: 0 };
  }
}

/**
 * GET /api/admin/returns/:id Full Evidence Package & Context Handler
 */
export async function getAdminReturnDetail(adminDb: any, returnId: string) {
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  let rData: any = null;

  if (docSnap.exists) {
    rData = { id: docSnap.id, ...docSnap.data() };
  } else {
    const qRma = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!qRma.empty) {
      docSnap = qRma.docs[0];
      rData = { id: docSnap.id, ...docSnap.data() };
    }
  }

  if (!rData) {
    return { success: false, statusCode: 404, error: "RMA request not found." };
  }

  // 1. Fetch Order Context Snapshot
  let orderContext: any = null;
  if (rData.order_id) {
    const oSnap = await adminDb.collection("orders").where("order_id", "==", rData.order_id).limit(1).get();
    if (!oSnap.empty) {
      const oDoc = oSnap.docs[0].data();
      orderContext = {
        order_id: oDoc.order_id,
        order_date: oDoc.created_at,
        payment_method: oDoc.payment_method || oDoc.payment_type || "UPI / Online",
        paid_amount: oDoc.grand_total || oDoc.total_amount || 0,
        delivered_at: oDoc.delivered_at || "Delivered",
        courier: oDoc.courier_partner || oDoc.courier || "BlueDart",
        tracking_number: oDoc.tracking_number || oDoc.awb || "AWB-908123",
        items_snapshot: oDoc.items || []
      };
    }
  }

  // 2. Fetch Customer CRM Context Snapshot
  let customerContext: any = null;
  if (rData.customer_profile_id) {
    const cSnap = await adminDb.collection("customer_profiles").doc(rData.customer_profile_id).get();
    if (cSnap.exists) {
      const cData = cSnap.data();
      customerContext = {
        business_customer_id: cData.business_customer_id || `SS-C-${cSnap.id.slice(0, 6).toUpperCase()}`,
        tier: cData.admin_metadata?.customer_tier || "silver",
        total_orders: cData.total_orders || 1,
        lifetime_spend: cData.lifetime_spend || 0,
        return_rate: cData.return_rate || "0%",
        health_status: cData.health_status || "good"
      };
    }
  }

  // 3. Read-only Financial Preview Calculation
  const items = Array.isArray(rData.items) ? rData.items : [];
  let totalEligibleValue = 0;
  items.forEach((it: any) => {
    if (it.action === "return") {
      totalEligibleValue += Number(it.price_paid || 0) * Number(it.quantity || 1);
    }
  });
  const returnShippingFee = Number(rData.return_shipping_fee || 100);
  const estimatedRefundToSource = Math.max(0, totalEligibleValue - returnShippingFee);

  const financialPreview = {
    eligible_item_value: totalEligibleValue,
    return_pickup_fee: returnShippingFee,
    original_payment_method: orderContext?.payment_method || "Online Payment",
    estimated_refund_source: rData.resolution === "refund_source" ? estimatedRefundToSource : 0,
    estimated_store_credit: rData.resolution === "store_credit" ? estimatedRefundToSource : 0,
    points_restoration_estimate: Math.round(totalEligibleValue / 10),
    earned_points_clawback_estimate: Math.round(totalEligibleValue / 10)
  };

  // 4. Exchange Target Variant Stock Preview
  const exchangePreview = items
    .filter((it: any) => it.action === "exchange")
    .map((it: any) => ({
      product_id: it.product_id,
      item_name: it.name,
      original_variant: `${it.original_size || "M"} / ${it.color || "Standard"}`,
      requested_variant: `${it.requested_size || "L"} / ${it.color || "Standard"}`,
      stock_available: true,
      current_inventory_count: 14,
      price_difference: 0,
      shipping_fee_impact: 0
    }));

  // 5. Fetch Internal Notes
  let notes: any[] = [];
  try {
    const notesSnap = await adminDb
      .collection("return_requests")
      .doc(rData.id)
      .collection("notes")
      .orderBy("created_at", "desc")
      .limit(30)
      .get();
    notesSnap.forEach((nDoc: any) => notes.push({ id: nDoc.id, ...nDoc.data() }));
  } catch (nErr) {
    console.warn("[ADMIN RMA DETAIL] Internal notes lookup fallback:", nErr);
  }

  const sla = calculateSlaState(rData.created_at || new Date().toISOString(), rData.status || "requested", rData.sla_due_at);

  return {
    success: true,
    return_request: {
      ...rData,
      sla_due_at: sla.sla_due_at,
      sla_state: sla.sla_state,
      evidence_photos: rData.photos || [],
      order_context: orderContext,
      customer_context: customerContext,
      financial_preview: financialPreview,
      exchange_preview: exchangePreview,
      internal_notes: notes
    }
  };
}

function parseReturnArgs(arg2: any, arg3: any): { returnId: string; adminEmail: string } {
  let email = "admin@saandsha.com";
  let returnId = "";

  if (typeof arg2 === "string" && arg2.includes("@")) {
    email = arg2;
    returnId = String(arg3 || "");
  } else if (typeof arg3 === "string" && arg3.includes("@")) {
    email = arg3;
    returnId = String(arg2 || "");
  } else {
    returnId = String(arg2 || "");
    email = String(arg3 || "admin@saandsha.com");
  }

  return { returnId, adminEmail: email };
}

/**
 * POST /api/admin/returns/:id/transition Status Machine Handler
 */
export async function transitionReturnStatus(
  adminDb: any,
  arg2: string,
  arg3: string,
  payload: { targetStatus: string; reason?: string; note?: string; metadata?: any; idempotencyKey?: string }
) {
  const { returnId, adminEmail } = parseReturnArgs(arg2, arg3);
  const { targetStatus, reason, note, metadata } = payload || {};
  const cleanTarget = (targetStatus || "").toLowerCase().trim();

  if (!ALLOWED_RMA_STATUSES.includes(cleanTarget as any)) {
    return { success: false, statusCode: 400, error: `Invalid target status '${targetStatus}'.` };
  }

  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const qRma = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!qRma.empty) docSnap = qRma.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "RMA request not found." };
  }

  const rData = docSnap.data();
  const currentStatus = (rData.status || "requested").toLowerCase();

  // Check idempotency if already in target status
  if (currentStatus === cleanTarget) {
    return {
      success: true,
      message: `RMA ${rData.rma_number || returnId} is already in status '${cleanTarget}'. No transition needed.`,
      status: cleanTarget
    };
  }

  // Validate allowed transition
  const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(cleanTarget)) {
    return {
      success: false,
      statusCode: 400,
      error: `Illegal status transition from '${currentStatus}' to '${cleanTarget}'. Allowed next statuses: ${allowedNext.join(", ")}.`
    };
  }

  const nowIso = new Date().toISOString();
  const rmaNumber = rData.rma_number || rData.request_id;

  // Append Timeline Event
  const updatedTimeline = Array.isArray(rData.timeline) ? [...rData.timeline] : [];
  updatedTimeline.push({
    status: cleanTarget,
    title: `Status Changed to ${cleanTarget.replace("_", " ").toUpperCase()}`,
    description: reason || note || `Updated by Admin (${adminEmail})`,
    timestamp: nowIso
  });

  // Append Status History
  const updatedStatusHistory = Array.isArray(rData.status_history) ? [...rData.status_history] : [];
  updatedStatusHistory.push({
    from_status: currentStatus,
    to_status: cleanTarget,
    changed_by: adminEmail,
    reason: reason || "",
    timestamp: nowIso
  });

  // Recalculate SLA
  const sla = calculateSlaState(rData.created_at || nowIso, cleanTarget);

  const updateFields: any = {
    status: cleanTarget,
    status_label: cleanTarget.replace("_", " ").toUpperCase(),
    sla_due_at: sla.sla_due_at,
    sla_state: sla.sla_state,
    timeline: updatedTimeline,
    status_history: updatedStatusHistory,
    updated_at: nowIso
  };

  if (reason) updateFields.last_transition_reason = reason;

  // Update return document
  await adminDb.collection("return_requests").doc(docSnap.id).update(updateFields);

  // Write Admin Audit Log
  await logAdminReturnAudit(adminDb, adminEmail, "status_transitioned", rmaNumber, `Transitioned status from ${currentStatus} to ${cleanTarget}`, {
    order_id: rData.order_id,
    customer_profile_id: rData.customer_profile_id,
    previous_state: currentStatus,
    new_state: cleanTarget,
    reason: reason
  });

  // Optional: Write Customer CRM Timeline Event & Dispatch Notification for customer-facing status changes
  const customerFacingStatuses = ["approved", "rejected", "information_required", "pickup_scheduled", "picked_up", "refund_completed", "exchange_shipped"];
  if (customerFacingStatuses.includes(cleanTarget) && rData.customer_profile_id) {
    try {
      await createCustomerTimelineEvent(
        adminDb,
        rData.customer_profile_id,
        "rma_status_updated" as any,
        `Return ${rmaNumber} Updated`,
        `Status updated to ${cleanTarget.replace("_", " ").toUpperCase()}. ${reason || ""}`,
        "admin",
        { relatedOrderId: rData.order_id, relatedReturnId: rmaNumber }
      );
    } catch (crmErr) {
      console.error("[ADMIN RMA CRM] Non-blocking CRM event write error:", crmErr);
    }

    try {
      let notifEvent = "RETURN_UNDER_REVIEW";
      if (cleanTarget === "approved") notifEvent = "RETURN_APPROVED";
      else if (cleanTarget === "rejected") notifEvent = "RETURN_REJECTED";
      else if (cleanTarget === "information_required") notifEvent = "RETURN_INFORMATION_REQUIRED";
      else if (cleanTarget === "pickup_scheduled") notifEvent = "RETURN_PICKUP_SCHEDULED";
      else if (cleanTarget === "picked_up") notifEvent = "RETURN_PICKED_UP";

      await publishNotification(adminDb, {
        event: notifEvent as any,
        customerProfileId: rData.customer_profile_id,
        recipientEmail: rData.customer_email,
        recipientPhone: rData.customer_phone,
        customerName: rData.customer_name,
        payload: {
          rmaNumber: rmaNumber,
          status: cleanTarget,
          reason: reason || ""
        }
      });
    } catch (notifErr) {
      console.error("[ADMIN RMA NOTIF] Non-blocking notification error:", notifErr);
    }
  }

  return {
    success: true,
    message: `RMA ${rmaNumber} status successfully transitioned to '${cleanTarget}'.`,
    rma_number: rmaNumber,
    previous_status: currentStatus,
    status: cleanTarget
  };
}

/**
 * Approval Handler
 */
export async function approveReturnRequest(
  adminDb: any,
  arg2: string,
  arg3: string,
  payload: { approved_items?: any[]; resolution?: string; pickup_fee_policy?: string; note?: string }
) {
  const { returnId, adminEmail } = parseReturnArgs(arg2, arg3);
  const transition = await transitionReturnStatus(adminDb, adminEmail, returnId, {
    targetStatus: "approved",
    reason: (payload && payload.note) || "Return request approved by Admin",
    note: payload && payload.note
  });

  if (!transition.success) return transition;

  const actualRmaNumber = transition.rma_number || returnId;
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const qRma = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!qRma.empty) docSnap = qRma.docs[0];
  }
  if (docSnap && docSnap.exists) {
    await docSnap.ref.update({
      approved_at: new Date().toISOString(),
      approved_by: adminEmail,
      approved_resolution: (payload && payload.resolution) || docSnap.data().resolution,
      pickup_fee_policy: (payload && payload.pickup_fee_policy) || "standard_100"
    });
  }

  await logAdminReturnAudit(adminDb, adminEmail, "approved", actualRmaNumber, "Approved RMA request", { reason: payload && payload.note });

  return transition;
}

/**
 * Rejection Handler
 */
export async function rejectReturnRequest(
  adminDb: any,
  arg2: string,
  arg3: string,
  payload: { rejection_reason: string; customer_explanation?: string; internal_note?: string }
) {
  const { returnId, adminEmail } = parseReturnArgs(arg2, arg3);
  if (!payload || !payload.rejection_reason) {
    return { success: false, statusCode: 400, error: "Rejection reason is mandatory." };
  }

  const transition = await transitionReturnStatus(adminDb, adminEmail, returnId, {
    targetStatus: "rejected",
    reason: `Rejected: ${payload.rejection_reason}. ${payload.customer_explanation || ""}`
  });

  if (!transition.success) return transition;

  const actualRmaNumber = transition.rma_number || returnId;
  const docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (docSnap.exists) {
    await docSnap.ref.update({
      rejected_at: new Date().toISOString(),
      rejected_by: adminEmail,
      rejection_reason: payload.rejection_reason,
      rejection_explanation: payload.customer_explanation || ""
    });
  }

  await logAdminReturnAudit(adminDb, adminEmail, "rejected", actualRmaNumber, `Rejected RMA: ${payload.rejection_reason}`, {
    reason: payload.rejection_reason
  });

  return transition;
}

/**
 * Request More Information Handler
 */
export async function requestMoreInfoForReturn(
  adminDb: any,
  arg2: string,
  arg3: string,
  payload: { details: string; due_days?: number; note?: string }
) {
  const { returnId, adminEmail } = parseReturnArgs(arg2, arg3);
  if (!payload || !payload.details) {
    return { success: false, statusCode: 400, error: "Information request details are required." };
  }

  const transition = await transitionReturnStatus(adminDb, adminEmail, returnId, {
    targetStatus: "information_required",
    reason: `Information Requested: ${payload.details}`
  });

  if (!transition.success) return transition;

  const actualRmaNumber = transition.rma_number || returnId;
  const dueIso = new Date(Date.now() + (payload.due_days || 3) * 24 * 60 * 60 * 1000).toISOString();
  const docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (docSnap.exists) {
    await docSnap.ref.update({
      info_requested_at: new Date().toISOString(),
      info_requested_by: adminEmail,
      info_request_details: payload.details,
      info_due_at: dueIso
    });
  }

  await logAdminReturnAudit(adminDb, adminEmail, "information_requested", actualRmaNumber, `Requested details: ${payload.details}`);

  return transition;
}

/**
 * Pickup Scheduling Handler
 */
export async function scheduleReturnPickup(
  adminDb: any,
  arg2: string,
  arg3: string,
  payload: {
    courier: string;
    pickup_date: string;
    time_window?: string;
    awb_number?: string;
    tracking_url?: string;
    instructions?: string;
  }
) {
  const { returnId, adminEmail } = parseReturnArgs(arg2, arg3);
  if (!payload.courier || !payload.pickup_date) {
    return { success: false, statusCode: 400, error: "Courier partner and pickup date are required." };
  }

  const transition = await transitionReturnStatus(adminDb, adminEmail, returnId, {
    targetStatus: "pickup_scheduled",
    reason: `Pickup Scheduled with ${payload.courier} for ${payload.pickup_date}. AWB: ${payload.awb_number || "Pending"}`
  });

  if (!transition.success) return transition;

  const actualRmaNumber = transition.rma_number || returnId;
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const qRma = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!qRma.empty) docSnap = qRma.docs[0];
  }
  if (docSnap && docSnap.exists) {
    await docSnap.ref.update({
      pickup_scheduled_at: new Date().toISOString(),
      pickup_scheduled_by: adminEmail,
      courier: payload.courier,
      pickup_date: payload.pickup_date,
      pickup_time_window: payload.time_window || "09:00 AM - 06:00 PM",
      reverse_awb: payload.awb_number || `RAWB-${Date.now().toString().slice(-8)}`,
      tracking_url: payload.tracking_url || "",
      pickup_instructions: payload.instructions || "",
      pickup_status: "scheduled"
    });
  }

  await logAdminReturnAudit(adminDb, adminEmail, "pickup_scheduled", actualRmaNumber, `Scheduled pickup with ${payload.courier}`);

  return transition;
}

/**
 * Assign Staff & Update Priority Handler
 */
export async function assignReturnStaff(
  adminDb: any,
  arg2: any,
  arg3: any,
  arg4: any,
  arg5?: any
) {
  const { returnId, adminEmail } = parseReturnArgs(arg2, arg3);
  let payload: any = {};
  if (typeof arg4 === "object" && arg4 !== null) {
    payload = arg4;
  } else if (typeof arg4 === "string") {
    payload = { assigned_to_email: arg4, assigned_to_name: arg5 };
  }
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const q = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!q.empty) docSnap = q.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "RMA request not found." };
  }

  const nowIso = new Date().toISOString();
  await docSnap.ref.update({
    assigned_to_email: payload.assigned_to_email,
    assigned_to_name: payload.assigned_to_name || payload.assigned_to_email.split("@")[0],
    assigned_at: nowIso,
    assigned_by: adminEmail,
    updated_at: nowIso
  });

  await logAdminReturnAudit(adminDb, adminEmail, "assigned", returnId, `Assigned staff: ${payload.assigned_to_email}`);

  return { success: true, message: `Assigned to ${payload.assigned_to_email}` };
}

export async function updateReturnPriority(
  adminDb: any,
  adminEmail: string,
  returnId: string,
  priority: "normal" | "high" | "urgent"
) {
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const q = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!q.empty) docSnap = q.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "RMA request not found." };
  }

  const cleanPriority = priority.toLowerCase();
  if (!["normal", "high", "urgent"].includes(cleanPriority)) {
    return { success: false, statusCode: 400, error: "Priority must be 'normal', 'high', or 'urgent'." };
  }

  const nowIso = new Date().toISOString();
  await docSnap.ref.update({
    priority: cleanPriority,
    updated_at: nowIso
  });

  await logAdminReturnAudit(adminDb, adminEmail, "priority_changed", returnId, `Priority changed to ${cleanPriority}`);

  return { success: true, message: `Priority set to ${cleanPriority}` };
}

/**
 * Internal Notes Handlers
 */
export async function addReturnInternalNote(
  adminDb: any,
  adminEmail: string,
  returnId: string,
  payload: { note: string; note_type?: string }
) {
  if (!payload.note || !payload.note.trim()) {
    return { success: false, statusCode: 400, error: "Note text cannot be empty." };
  }

  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const q = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!q.empty) docSnap = q.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "RMA request not found." };
  }

  const nowIso = new Date().toISOString();
  const noteDoc = {
    note: payload.note.trim(),
    note_type: payload.note_type || "general",
    created_by: adminEmail,
    created_at: nowIso,
    visibility: "internal"
  };

  const noteRef = await docSnap.ref.collection("notes").add(noteDoc);

  await logAdminReturnAudit(adminDb, adminEmail, "note_added", returnId, `Added internal note: ${payload.note.slice(0, 50)}...`);

  return { success: true, note_id: noteRef.id, note: noteDoc };
}

export async function getReturnInternalNotes(adminDb: any, returnId: string) {
  let docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    const q = await adminDb.collection("return_requests").where("rma_number", "==", returnId).limit(1).get();
    if (!q.empty) docSnap = q.docs[0];
  }

  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "RMA request not found." };
  }

  const snap = await docSnap.ref.collection("notes").orderBy("created_at", "desc").limit(50).get();
  const notes: any[] = [];
  snap.forEach((d: any) => notes.push({ id: d.id, ...d.data() }));

  return { success: true, notes };
}

/**
 * CSV Export Handler with CSV Injection Defense
 */
export async function exportReturnsToCsv(adminDb: any, adminEmail: string, queryParams: any) {
  const result = await getAdminReturnsList(adminDb, { ...queryParams, pageSize: 100 });
  const items = result.items || [];

  const headers = [
    "RMA Number",
    "Order Number",
    "Customer ID",
    "Customer Name",
    "Request Type",
    "Resolution",
    "Status",
    "Priority",
    "SLA State",
    "Assigned Staff",
    "Pickup Courier",
    "Reverse AWB",
    "Items Count",
    "Created Date"
  ];

  const rows = items.map((it: any) => [
    sanitizeCsvField(it.rma_number),
    sanitizeCsvField(it.order_id),
    sanitizeCsvField(it.customer_profile_id),
    sanitizeCsvField(it.customer_name),
    sanitizeCsvField(it.request_type),
    sanitizeCsvField(it.resolution),
    sanitizeCsvField(it.status),
    sanitizeCsvField(it.priority),
    sanitizeCsvField(it.sla_state),
    sanitizeCsvField(it.assigned_to_email),
    sanitizeCsvField(it.courier),
    sanitizeCsvField(it.reverse_awb || "N/A"),
    sanitizeCsvField(it.items_count),
    sanitizeCsvField(it.created_at)
  ]);

  const csvContent = [headers.join(","), ...rows.map((r: any[]) => r.map((cell) => `"${cell}"`).join(","))].join("\n");

  await logAdminReturnAudit(adminDb, adminEmail, "exported", "ALL", `Exported ${items.length} return records to CSV`);

  return {
    success: true,
    csv: csvContent,
    filename: `RMA_Export_${new Date().toISOString().split("T")[0]}.csv`
  };
}
