import { createCustomerTimelineEvent } from "./crmHelpers";
import { publishNotification } from "./notification/notificationEngine";
import { calculateReturnEligibility } from "./returnEligibilityHelpers";
import { getCustomerOrderDetail } from "./customerOrderHelpers";
import { GstCreditNote } from "./invoice/creditNoteTypes";

export interface ReturnItemPayload {
  product_id: string;
  name: string;
  image?: string;
  size?: string;
  original_size?: string;
  color?: string;
  quantity: number;
  price_paid: number;
  action: "return" | "exchange";
  reason?: string;
  reason_notes?: string;
  evidence_images?: string[];
  requested_size?: string;
  requested_color?: string;
}

export interface CreateReturnRequestPayload {
  order_id: string;
  items: ReturnItemPayload[];
  reason?: string;
  reason_details?: string;
  photos?: string[];
  resolution?: "refund_source" | "store_credit" | "exchange";
  pickup_address?: any;
}

/**
 * Generates sequential immutable RMA Number (e.g. SS-RMA-100001)
 */
export async function generateRmaNumber(adminDb: any): Promise<string> {
  try {
    const counterRef = adminDb.collection("system_counters").doc("rma_counter");
    const docSnap = await counterRef.get();

    let nextVal = 100001;
    if (docSnap.exists) {
      nextVal = (docSnap.data().current_val || 100000) + 1;
    }

    await counterRef.set({
      current_val: nextVal,
      updated_at: new Date().toISOString()
    }, { merge: true });

    const padded = String(nextVal).padStart(6, "0");
    return `SS-RMA-${padded}`;
  } catch (err) {
    console.warn("Falling back to timestamp RMA number generation:", err);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SS-RMA-${Date.now().toString().slice(-6)}${rand}`;
  }
}

/**
 * Retrieves authenticated customer's return requests from Firestore return_requests collection
 */
export async function getCustomerReturnRequests(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  statusFilter?: string
) {
  let query = adminDb.collection("return_requests")
    .where("customer_profile_id", "==", profileId)
    .orderBy("created_at", "desc");

  let snap;
  try {
    snap = await query.limit(50).get();
  } catch (err) {
    // If composite index is missing or field unset, fallback to profile_id without orderBy or fallback lookups
    const unindexedSnap = await adminDb.collection("return_requests")
      .where("customer_profile_id", "==", profileId)
      .get();
    snap = unindexedSnap;
  }

  let returnsList: any[] = [];
  snap.forEach((d: any) => returnsList.push({ id: d.id, ...d.data() }));

  // Fallback by phone / email if customer_profile_id was not stamped on legacy requests
  if (returnsList.length === 0) {
    const cleanPhone = (userPhone || "").replace(/\D/g, "");
    const cleanEmail = (userEmail || "").trim().toLowerCase();

    const fallbackPromises: Promise<any>[] = [];
    if (cleanPhone) {
      fallbackPromises.push(adminDb.collection("return_requests").where("customer_phone", "==", cleanPhone).limit(30).get());
    }
    if (cleanEmail && cleanEmail !== "shop@sa-and-sha.com") {
      fallbackPromises.push(adminDb.collection("return_requests").where("customer_email", "==", cleanEmail).limit(30).get());
    }

    if (fallbackPromises.length > 0) {
      const fallbackSnaps = await Promise.all(fallbackPromises);
      const matchedMap = new Map<string, any>();
      fallbackSnaps.forEach(fSnap => {
        fSnap.forEach((docSnap: any) => {
          if (!matchedMap.has(docSnap.id)) {
            matchedMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
          }
        });
      });
      returnsList = Array.from(matchedMap.values());
    }
  }

  // Sort descending by created_at
  returnsList.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  // Filter in memory by tab status category
  if (statusFilter && statusFilter !== "all") {
    const sf = statusFilter.toLowerCase();
    if (sf === "active") {
      returnsList = returnsList.filter(r => 
        ["requested", "under_review", "approved", "pickup_scheduled", "picked_up", "warehouse_inspection", "refund_approved"].includes((r.status || "").toLowerCase())
      );
    } else if (sf === "completed") {
      returnsList = returnsList.filter(r => 
        ["completed", "refunded"].includes((r.status || "").toLowerCase())
      );
    } else if (sf === "rejected") {
      returnsList = returnsList.filter(r => (r.status || "").toLowerCase() === "rejected");
    } else if (sf === "cancelled") {
      returnsList = returnsList.filter(r => (r.status || "").toLowerCase() === "cancelled");
    }
  }

  return returnsList;
}

/**
 * Retrieves single return request by RMA Number or Document ID with strict customer ownership verification
 */
export async function getCustomerReturnRequestById(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  returnIdentifier: string
) {
  let docSnap = await adminDb.collection("return_requests").doc(returnIdentifier).get();
  let returnData: any = null;

  if (docSnap.exists) {
    returnData = { id: docSnap.id, ...docSnap.data() };
  } else {
    const rmaSnap = await adminDb.collection("return_requests")
      .where("request_id", "==", returnIdentifier)
      .limit(1)
      .get();
    if (!rmaSnap.empty) {
      docSnap = rmaSnap.docs[0];
      returnData = { id: docSnap.id, ...docSnap.data() };
    } else {
      const rmaNumSnap = await adminDb.collection("return_requests")
        .where("rma_number", "==", returnIdentifier)
        .limit(1)
        .get();
      if (!rmaNumSnap.empty) {
        docSnap = rmaNumSnap.docs[0];
        returnData = { id: docSnap.id, ...docSnap.data() };
      }
    }
  }

  if (!returnData) {
    return { success: false, statusCode: 404, error: "Return request not found." };
  }

  // Verify ownership
  const rProfileId = returnData.customer_profile_id || "";
  const cleanUserPhone = (userPhone || "").replace(/\D/g, "");
  const cleanReturnPhone = (returnData.customer_phone || "").replace(/\D/g, "");
  const cleanUserEmail = (userEmail || "").trim().toLowerCase();
  const cleanReturnEmail = (returnData.customer_email || "").trim().toLowerCase();

  const matchProfile = rProfileId && rProfileId === profileId;
  const matchPhone = cleanUserPhone && cleanReturnPhone && cleanUserPhone === cleanReturnPhone;
  const matchEmail = cleanUserEmail && cleanUserEmail !== "shop@sa-and-sha.com" && cleanReturnEmail && cleanUserEmail === cleanReturnEmail;

  if (!matchProfile && !matchPhone && !matchEmail) {
    return { success: false, statusCode: 403, error: "Access denied. You do not have permission to view this return request." };
  }

  return { success: true, return_request: returnData };
}

/**
 * Validates Order Return Eligibility (Delivered status, within 15 days return window, non-returned items)
 */
export async function validateOrderReturnEligibility(
  adminDb: any,
  orderId: string,
  profileId: string,
  userPhone: string,
  userEmail: string
) {
  let docSnap = await adminDb.collection("orders").doc(orderId).get();
  let orderData: any = null;

  if (docSnap.exists) {
    orderData = docSnap.data();
  } else {
    const qSnap = await adminDb.collection("orders").where("order_id", "==", orderId).limit(1).get();
    if (!qSnap.empty) {
      docSnap = qSnap.docs[0];
      orderData = docSnap.data();
    }
  }

  if (!orderData) {
    return { eligible: false, reason: "Order not found." };
  }

  // Ownership verification
  const oProfileId = orderData.customer_profile_id || "";
  const cleanUserPhone = (userPhone || "").replace(/\D/g, "");
  const cleanOrderPhone = (orderData.customer_phone || "").replace(/\D/g, "");
  const cleanUserEmail = (userEmail || "").trim().toLowerCase();
  const cleanOrderEmail = (orderData.customer_email || "").trim().toLowerCase();

  const matchProfile = oProfileId && oProfileId === profileId;
  const matchPhone = cleanUserPhone && cleanOrderPhone && cleanUserPhone === cleanOrderPhone;
  const matchEmail = cleanUserEmail && cleanUserEmail !== "shop@sa-and-sha.com" && cleanOrderEmail === cleanOrderEmail;

  if (!matchProfile && !matchPhone && !matchEmail) {
    return { eligible: false, reason: "Order does not belong to this account." };
  }

  // Authoritative 7-day Return/Exchange eligibility evaluation
  const eligibilityRes = calculateReturnEligibility(orderData, []);
  if (!eligibilityRes.eligible) {
    return {
      eligible: false,
      reason: eligibilityRes.reason
    };
  }

  return { eligible: true, order: { id: docSnap.id, ...orderData } };
}

/**
 * Creates new Customer Return / Exchange Request
 */
export async function createCustomerReturnRequest(
  adminDb: any,
  profileId: string,
  profileData: any,
  payload: CreateReturnRequestPayload
) {
  const { order_id, items, reason, reason_details, photos, resolution, pickup_address } = payload;

  if (!order_id || !Array.isArray(items) || items.length === 0) {
    return { success: false, statusCode: 400, error: "Please select an order and at least one item to return or exchange." };
  }

  const userPhone = profileData.normalized_phone || profileData.phone || "";
  const userEmail = profileData.email || "";

  // 1. Validate Order Eligibility
  const eligibility = await validateOrderReturnEligibility(adminDb, order_id, profileId, userPhone, userEmail);
  if (!eligibility.eligible) {
    return { success: false, statusCode: 400, error: eligibility.reason };
  }

  const orderData = eligibility.order;

  // 2. Check for duplicate active return requests on selected items
  const existingReqsSnap = await adminDb.collection("return_requests")
    .where("order_id", "==", orderData.order_id || order_id)
    .get();

  const activeExistingItems: any[] = [];
  existingReqsSnap.forEach((doc: any) => {
    const r = doc.data();
    if (["requested", "under_review", "approved", "pickup_scheduled", "picked_up", "warehouse_inspection", "refund_approved", "completed"].includes((r.status || "").toLowerCase())) {
      if (Array.isArray(r.items)) {
        r.items.forEach((it: any) => activeExistingItems.push(it));
      }
    }
  });

  for (const newItem of items) {
    const isDup = activeExistingItems.some((eItem) => 
      eItem.product_id === newItem.product_id && 
      (eItem.size || eItem.original_size) === (newItem.size || (newItem as any).original_size)
    );
    if (isDup) {
      return {
        success: false,
        statusCode: 400,
        error: `A return or exchange request is already active for '${newItem.name}' in this order.`
      };
    }
  }

  // 3. Generate Sequential RMA Number
  const rmaNumber = await generateRmaNumber(adminDb);
  const nowIso = new Date().toISOString();

  // 4. Calculate estimated refund / charges
  const hasReturnItem = items.some(it => it.action === "return");
  const returnShippingFee = hasReturnItem ? 100 : 0; // ₹100 standard pickup fee for returns
  let totalItemRefund = 0;
  items.forEach(it => {
    if (it.action === "return") {
      totalItemRefund += Number(it.price_paid || 0) * Number(it.quantity || 1);
    }
  });
  const estimatedRefundTotal = Math.max(0, totalItemRefund - returnShippingFee);

  // 5. Construct Initial Timeline
  const initialTimeline = [
    {
      status: "requested",
      title: "Return Request Submitted",
      description: `RMA request ${rmaNumber} created by customer. Selected resolution: ${(resolution || "refund_source").replace(/_/g, " ").toUpperCase()}.`,
      timestamp: nowIso
    }
  ];

  // 6. Build Document Payload
  const returnDoc = {
    rma_number: rmaNumber,
    request_id: rmaNumber,
    customer_profile_id: profileId,
    customer_name: profileData.full_name || orderData.customer_name || "Valued Customer",
    customer_email: userEmail || orderData.customer_email || "",
    customer_phone: userPhone || orderData.customer_phone || "",
    order_id: orderData.order_id || order_id,
    order_doc_id: orderData.id,
    request_type: items.every(i => i.action === "exchange") ? "exchange" : (items.every(i => i.action === "return") ? "return" : "mixed"),
    resolution: resolution || "refund_source",
    reason: reason || "Quality Issue",
    reason_details: reason_details || "",
    photos: Array.isArray(photos) ? photos.slice(0, 6) : [],
    items: items.map(it => ({
      product_id: it.product_id,
      name: it.name,
      original_size: it.size || "M",
      requested_size: it.requested_size || undefined,
      color: it.color || "Standard",
      quantity: it.quantity || 1,
      price_paid: it.price_paid || 0,
      action: it.action,
      reason: it.reason || reason,
      reason_notes: it.reason_notes || reason_details || "",
      evidence_images: it.evidence_images || photos || []
    })),
    return_shipping_fee: returnShippingFee,
    estimated_refund_total: estimatedRefundTotal,
    status: "requested",
    status_label: "Under Review",
    pickup_address: pickup_address || orderData.shipping_address || {},
    timeline: initialTimeline,
    audit_log: [
      { action: "created", by: "customer", timestamp: nowIso, details: `Created return request ${rmaNumber}` }
    ],
    created_at: nowIso,
    updated_at: nowIso
  };

  // 7. Save to Firestore collection return_requests
  const docRef = await adminDb.collection("return_requests").add(returnDoc);

  // Mark order with return flag
  await adminDb.collection("orders").doc(orderData.id).set({
    has_active_return: true,
    last_rma_number: rmaNumber,
    updated_at: nowIso
  }, { merge: true });

  // 8. Dispatch Notification Event
  try {
    await publishNotification(adminDb, {
      event: "ORDER_RETURN_REQUESTED" as any,
      customerProfileId: profileId,
      recipientEmail: returnDoc.customer_email,
      recipientPhone: returnDoc.customer_phone,
      customerName: returnDoc.customer_name,
      order: orderData,
      payload: {
        rmaNumber: rmaNumber,
        itemsCount: items.length,
        resolution: resolution
      }
    });
  } catch (notifErr) {
    console.error("[RETURN NOTIFICATION] Non-blocking error:", notifErr);
  }

  // 9. Log CRM Event
  try {
    await createCustomerTimelineEvent(
      adminDb,
      profileId,
      "return_requested",
      "Return Request Submitted",
      `Submitted return/exchange request ${rmaNumber} for Order #${orderData.order_id}. Resolution: ${(resolution || "refund_source").toUpperCase()}.`,
      "customer_action",
      { relatedOrderId: orderData.order_id, relatedReturnId: rmaNumber }
    );
  } catch (crmErr) {
    console.error("[RETURN CRM TIMELINE] Non-blocking error:", crmErr);
  }

  return {
    success: true,
    rma_number: rmaNumber,
    return_request: { id: docRef.id, ...returnDoc }
  };
}

/**
 * Cancels Return Request (Only permitted when status is 'requested' or 'under_review')
 */
export async function cancelCustomerReturnRequest(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  returnIdentifier: string,
  reason?: string
) {
  const lookup = await getCustomerReturnRequestById(adminDb, profileId, userPhone, userEmail, returnIdentifier);
  if (!lookup.success || !lookup.return_request) {
    return lookup;
  }

  const rData = lookup.return_request;
  const currentStatus = (rData.status || "").toLowerCase();

  if (!["requested", "under_review"].includes(currentStatus)) {
    return {
      success: false,
      statusCode: 400,
      error: `Return request ${rData.rma_number || rData.request_id} is in status '${currentStatus}' and can no longer be cancelled directly by customer.`
    };
  }

  const nowIso = new Date().toISOString();
  const cancelReason = (reason || "Cancelled by customer").trim();

  const updatedTimeline = Array.isArray(rData.timeline) ? [...rData.timeline] : [];
  updatedTimeline.push({
    status: "cancelled",
    title: "Return Request Cancelled",
    description: `Request cancelled by customer. Reason: ${cancelReason}`,
    timestamp: nowIso
  });

  const updatedAudit = Array.isArray(rData.audit_log) ? [...rData.audit_log] : [];
  updatedAudit.push({
    action: "cancelled",
    by: "customer",
    timestamp: nowIso,
    details: cancelReason
  });

  // Update return document
  await adminDb.collection("return_requests").doc(rData.id).update({
    status: "cancelled",
    status_label: "Cancelled",
    cancellation_reason: cancelReason,
    timeline: updatedTimeline,
    audit_log: updatedAudit,
    updated_at: nowIso
  });

  // Dispatch Notification Event
  try {
    await publishNotification(adminDb, {
      event: "ORDER_CANCELLED" as any,
      customerProfileId: profileId,
      recipientEmail: rData.customer_email,
      recipientPhone: rData.customer_phone,
      customerName: rData.customer_name,
      payload: {
        rmaNumber: rData.rma_number || rData.request_id,
        reason: cancelReason
      }
    });
  } catch (notifErr) {
    console.error("[RETURN CANCEL NOTIFICATION] Non-blocking error:", notifErr);
  }

  // CRM Timeline Log
  try {
    await createCustomerTimelineEvent(
      adminDb,
      profileId,
      "order_cancelled" as any,
      "Return Request Cancelled",
      `Cancelled return request ${rData.rma_number || rData.request_id}. Reason: ${cancelReason}`,
      "customer_action",
      { relatedReturnId: rData.rma_number || rData.request_id }
    );
  } catch (crmErr) {
    console.error("[RETURN CANCEL CRM] Non-blocking error:", crmErr);
  }

  return {
    success: true,
    message: `Return request ${rData.rma_number || rData.request_id} has been cancelled successfully.`,
    rma_number: rData.rma_number || rData.request_id
  };
}

/**
 * Retrieves finalized GST credit note for authenticated customer with strict ownership verification
 */
export async function getCustomerCreditNote(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  identifier: string
) {
  const cleanId = String(identifier || "").trim();
  if (!cleanId) {
    return {
      success: false,
      statusCode: 400,
      code: "INVALID_IDENTIFIER",
      error: "Return ID, Order ID, or Credit Note reference is required."
    };
  }

  let rmaNumber: string | null = null;
  let orderId: string | null = null;

  // 1. Try return request lookup with ownership verification
  const returnLookup = await getCustomerReturnRequestById(adminDb, profileId, userPhone, userEmail, cleanId);
  if (returnLookup.success && returnLookup.return_request) {
    const rr = returnLookup.return_request;
    rmaNumber = rr.rma_number || rr.request_id || null;
    orderId = rr.order_id || null;
  } else {
    // 2. Try order detail lookup with ownership verification
    const orderLookup = await getCustomerOrderDetail(adminDb, profileId, userPhone, userEmail, cleanId);
    if (orderLookup.success && orderLookup.order) {
      orderId = orderLookup.order.order_id || orderLookup.order.id || null;
    }
  }

  let cnDoc: any = null;

  if (rmaNumber) {
    const rmaSnap = await adminDb.collection("gst_credit_notes")
      .where("rma_number", "==", rmaNumber)
      .limit(1)
      .get();
    if (!rmaSnap.empty) {
      cnDoc = { credit_note_id: rmaSnap.docs[0].id, ...rmaSnap.docs[0].data() };
    }
  }

  if (!cnDoc && orderId) {
    const orderSnap = await adminDb.collection("gst_credit_notes")
      .where("order_id", "==", orderId)
      .limit(1)
      .get();
    if (!orderSnap.empty) {
      cnDoc = { credit_note_id: orderSnap.docs[0].id, ...orderSnap.docs[0].data() };
    }
  }

  if (!cnDoc) {
    // 3. Direct credit note document lookup or credit_note_number lookup
    const directDoc = await adminDb.collection("gst_credit_notes").doc(cleanId).get();
    if (directDoc.exists) {
      cnDoc = { credit_note_id: directDoc.id, ...directDoc.data() };
    } else {
      const numSnap = await adminDb.collection("gst_credit_notes")
        .where("credit_note_number", "==", cleanId)
        .limit(1)
        .get();
      if (!numSnap.empty) {
        cnDoc = { credit_note_id: numSnap.docs[0].id, ...numSnap.docs[0].data() };
      }
    }

    // Direct lookup MUST verify ownership strictly
    if (cnDoc) {
      const cnProfileId = cnDoc.customer_profile_id || cnDoc.customer_id || "";
      const cleanUserPhone = (userPhone || "").replace(/\D/g, "");
      const cleanUserEmail = (userEmail || "").trim().toLowerCase();
      const cnEmail = (cnDoc.buyer_snapshot?.email || "").trim().toLowerCase();
      const cnPhone = (cnDoc.buyer_snapshot?.phone || "").replace(/\D/g, "");

      const matchProfile = cnProfileId && cnProfileId === profileId;
      const matchPhone = cleanUserPhone && cnPhone && cleanUserPhone === cnPhone;
      const matchEmail = cleanUserEmail && cleanUserEmail !== "shop@sa-and-sha.com" && cnEmail === cleanUserEmail;

      if (!matchProfile && !matchPhone && !matchEmail) {
        return {
          success: false,
          statusCode: 404,
          code: "CREDIT_NOTE_NOT_AVAILABLE",
          error: "Credit note not found."
        };
      }
    }
  }

  if (!cnDoc) {
    return {
      success: false,
      statusCode: 404,
      code: "CREDIT_NOTE_NOT_AVAILABLE",
      error: "GST Credit Note is not available for this return/order."
    };
  }

  return {
    success: true,
    creditNote: cnDoc as GstCreditNote
  };
}

/**
 * Lists all finalized GST Credit Notes for a verified customer order.
 */
export async function listCustomerCreditNotesForOrder(
  adminDb: any,
  profileId: string,
  userPhone: string,
  userEmail: string,
  orderIdOrNumber: string
) {
  const cleanId = String(orderIdOrNumber || "").trim();
  if (!cleanId) {
    return { success: false, statusCode: 400, error: "Order ID or Number is required." };
  }

  // Verify order ownership
  const orderLookup = await getCustomerOrderDetail(adminDb, profileId, userPhone, userEmail, cleanId);
  if (!orderLookup.success || !orderLookup.order) {
    return { success: false, statusCode: 404, error: "Order not found or access denied." };
  }

  const orderId = orderLookup.order.order_id || orderLookup.order.id || cleanId;
  const orderNumber = orderLookup.order.order_id || cleanId;

  // Query all credit notes matching order_id or order_number
  const snap1 = await adminDb.collection("gst_credit_notes").where("order_id", "==", orderId).get();
  const snap2 = await adminDb.collection("gst_credit_notes").where("order_number", "==", orderNumber).get();

  const map = new Map<string, GstCreditNote>();
  snap1.forEach((doc: any) => {
    map.set(doc.id, { credit_note_id: doc.id, ...doc.data() } as GstCreditNote);
  });
  snap2.forEach((doc: any) => {
    map.set(doc.id, { credit_note_id: doc.id, ...doc.data() } as GstCreditNote);
  });

  const creditNotes = Array.from(map.values()).sort((a, b) =>
    new Date(b.issue_date || b.created_at).getTime() - new Date(a.issue_date || a.created_at).getTime()
  );

  return {
    success: true,
    creditNotes
  };
}
