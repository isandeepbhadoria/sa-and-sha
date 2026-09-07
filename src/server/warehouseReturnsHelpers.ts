import {
  transitionReturnStatus,
  logAdminReturnAudit,
  maskPii,
  calculateSlaState
} from "./adminReturnsHelpers";
import { publishNotification } from "./notification/notificationEngine";
import { createCustomerTimelineEvent } from "./crmHelpers";

export interface WarehouseQueueQuery {
  status?: string;
  priority?: string;
  sla_state?: string;
  assigned_inspector?: string;
  courier?: string;
  search?: string;
  cursor?: string;
  limit?: number | string;
}

export interface WarehouseReceivingPayload {
  warehouse_location?: string;
  carrier_name?: string;
  courier?: string;
  tracking_number?: string;
  reverse_awb?: string;
  parcel_condition?: string;
  package_condition?: string;
  seal_condition?: string;
  weight_kg?: number | string;
  receiving_notes?: string;
  notes?: string;
  received_at?: string;
  receiver_name?: string;
}

export interface ItemConditionGrade {
  product_id: string;
  sku?: string;
  name?: string;
  grade: "A" | "B" | "C" | "D" | "E" | "A_grade_resellable" | "B_grade_discount" | "C_grade_refurbish" | "D_grade_rejected_scam" | string;
  tags_attached?: boolean;
  original_packaging?: boolean;
  worn_used_washed?: boolean;
  stain_damage_smell?: boolean;
  counterfeited_swapped?: boolean;
  recommended_action?: string;
  notes?: string;
}

export interface CompleteInspectionPayload {
  decision?: "pass" | "partial_pass" | "fail" | "needs_manager_review";
  recommendation?: "refund" | "exchange" | "reject" | "restock" | "dispose";
  overall_condition_grade?: string;
  items_inspection?: ItemConditionGrade[];
  item_grades?: ItemConditionGrade[];
  inspection_summary?: string;
  discrepancies?: string[];
  discrepancy_details?: string;
  photos?: any[];
  summary_notes?: string;
}

export interface WarehousePhoto {
  id?: string;
  url: string;
  type?: "outer_package" | "seal" | "item_defect" | "label" | "overview" | string;
  photo_type?: string;
  caption?: string;
  uploaded_by?: string;
  uploaded_at?: string;
}

/**
 * GET Warehouse Returns Queue List
 */
export async function getWarehouseReturnsList(adminDb: any, query: WarehouseQueueQuery = {}) {
  const {
    status,
    priority,
    sla_state,
    assigned_inspector,
    courier,
    search,
    cursor,
    limit = 20
  } = query;

  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 50);

  let collRef = adminDb.collection("return_requests");
  let items: any[] = [];

  const snap = await collRef.get();
  snap.forEach((doc: any) => {
    items.push({ id: doc.id, ...doc.data() });
  });

  // Filter for warehouse relevant statuses if status not specified
  if (status && status !== "all") {
    items = items.filter((item) => (item.status || "").toLowerCase() === status.toLowerCase());
  } else {
    // Default queue filters for warehouse operations
    const warehouseStatuses = [
      "pickup_scheduled",
      "picked_up",
      "return_approved",
      "approved",
      "warehouse_received",
      "inspection_in_progress",
      "inspection_completed",
      "inspection_passed",
      "inspection_failed",
      "manager_review"
    ];
    items = items.filter((item) => warehouseStatuses.includes((item.status || "").toLowerCase()));
  }

  if (priority && priority !== "all") {
    items = items.filter((item) => (item.priority || "normal").toLowerCase() === priority.toLowerCase());
  }

  if (assigned_inspector) {
    items = items.filter(
      (item) => (item.assigned_inspector || item.inspection_assigned_to || "").toLowerCase() === assigned_inspector.toLowerCase()
    );
  }

  if (courier && courier !== "all") {
    items = items.filter((item) => (item.courier || item.carrier_name || "").toLowerCase() === courier.toLowerCase());
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((item) => {
      const rma = (item.rma_number || item.return_id || "").toLowerCase();
      const awb = (item.reverse_awb || item.tracking_number || "").toLowerCase();
      const orderId = (item.order_id || "").toLowerCase();
      const email = (item.customer_email || "").toLowerCase();
      const phone = (item.customer_phone || "").toLowerCase();
      const name = (item.customer_name || "").toLowerCase();
      return (
        rma.includes(q) ||
        awb.includes(q) ||
        orderId.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        name.includes(q)
      );
    });
  }

  // Sort descending by created_at or received_at
  items.sort((a, b) => {
    const dateA = a.warehouse_received_at || a.created_at || "";
    const dateB = b.warehouse_received_at || b.created_at || "";
    return dateB.localeCompare(dateA);
  });

  // Cursor pagination
  let startIndex = 0;
  if (cursor) {
    const cursorIdx = items.findIndex((i) => i.id === cursor);
    if (cursorIdx !== -1) {
      startIndex = cursorIdx + 1;
    }
  }

  const paginated = items.slice(startIndex, startIndex + limitNum);
  const nextCursor = paginated.length === limitNum && startIndex + limitNum < items.length
    ? paginated[paginated.length - 1].id
    : null;

  // Format and mask PII for queue response
  const formattedItems = paginated.map((item) => ({
    id: item.id,
    return_id: item.id,
    rma_number: item.rma_number || item.return_id,
    order_id: item.order_id,
    customer_profile_id: item.customer_profile_id || "GUEST",
    customer_name_masked: item.customer_name ? `${item.customer_name.slice(0, 2)}***` : "Customer",
    customer_email_masked: maskPii(item.customer_email || "", "email"),
    courier: item.courier || item.carrier_name || "N/A",
    reverse_awb: item.reverse_awb || item.tracking_number || "N/A",
    status: item.status,
    warehouse_received_at: item.warehouse_received_at || null,
    received_by: item.received_by || null,
    assigned_inspector: item.assigned_inspector || item.inspection_assigned_to || null,
    priority: item.priority || "normal",
    sla_state: item.sla_state || "on_time",
    sla_due_at: item.sla_due_at || null,
    condition_grade: item.overall_condition_grade || null,
    inspection_decision: item.inspection_decision || null,
    recommendation: item.recommendation || null,
    created_at: item.created_at
  }));

  return {
    success: true,
    items: formattedItems,
    returns: formattedItems,
    pagination: {
      total: items.length,
      pageSize: limitNum,
      hasMore: !!nextCursor,
      nextCursor
    }
  };
}

/**
 * GET detail for warehouse return inspection workbench
 */
export async function getWarehouseReturnDetail(adminDb: any, returnId: string) {
  const docSnap = await adminDb.collection("return_requests").doc(returnId).get();
  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found" };
  }

  const data = docSnap.data();
  const warehousePhotos = data.warehouse_photos || [];

  return {
    success: true,
    return_request: {
      id: docSnap.id,
      return_id: docSnap.id,
      rma_number: data.rma_number || docSnap.id,
      order_id: data.order_id,
      customer_profile_id: data.customer_profile_id || "",
      customer_name: data.customer_name || "",
      customer_email: data.customer_email || "",
      customer_phone: data.customer_phone || "",
      status: data.status,
      priority: data.priority || "normal",
      sla_state: data.sla_state || "on_time",
      sla_due_at: data.sla_due_at || null,
      request_type: data.request_type || "return",
      resolution: data.resolution || "refund_source",
      reason_code: data.reason_code || "",
      customer_reason: data.customer_reason || "",
      customer_photos: data.customer_photos || [],
      items: (data.items || []).map((item: any) => ({
        product_id: item.product_id,
        sku: item.sku || item.product_id,
        name: item.name || "Product Item",
        size: item.size || "N/A",
        color: item.color || "N/A",
        image_url: item.image_url || null,
        purchased_quantity: item.purchased_quantity || item.quantity || 1,
        returned_quantity: item.returned_quantity || item.quantity || 1,
        price_paid: item.price_paid || 0,
        return_reason: item.return_reason || data.customer_reason || ""
      })),
      receiving_details: data.receiving_info || {
        warehouse_received_at: data.warehouse_received_at || null,
        received_by: data.received_by || null,
        courier: data.courier || data.carrier_name || null,
        reverse_awb: data.reverse_awb || data.tracking_number || null,
        package_condition: data.package_condition || data.parcel_condition || null,
        seal_condition: data.seal_condition || null,
        weight_kg: data.weight_kg || null,
        receiving_notes: data.receiving_notes || data.notes || null
      },
      receiving_info: data.receiving_info || {
        warehouse_location: data.warehouse_location || "WH-MAIN",
        carrier_name: data.courier || data.carrier_name || "N/A",
        tracking_number: data.reverse_awb || data.tracking_number || "N/A",
        parcel_condition: data.package_condition || data.parcel_condition || "intact",
        notes: data.receiving_notes || data.notes || "",
        received_by: data.received_by || "",
        received_at: data.warehouse_received_at || null
      },
      inspection_report: data.inspection_report || null,
      warehouse_photos: warehousePhotos,
      assigned_inspector: data.assigned_inspector || data.inspection_assigned_to || null,
      created_at: data.created_at,
      updated_at: data.updated_at
    }
  };
}

/**
 * Receive parcel at warehouse
 */
export async function receiveWarehouseParcel(
  adminDb: any,
  returnId: string,
  adminEmail: string,
  payload: WarehouseReceivingPayload = {}
) {
  const docRef = adminDb.collection("return_requests").doc(returnId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found" };
  }

  const data = docSnap.data();
  const currentStatus = data.status;

  if (!["pickup_scheduling", "pickup_scheduled", "picked_up", "approved", "return_approved", "in_transit", "warehouse_received"].includes(currentStatus)) {
    return {
      success: false,
      statusCode: 400,
      error: `Cannot receive parcel for return request in status '${currentStatus}'. Return must be approved or in transit first.`
    };
  }

  const nowIso = new Date().toISOString();
  const receivedAt = payload.received_at || nowIso;
  const receiverName = payload.receiver_name || adminEmail;

  if (currentStatus !== "warehouse_received") {
    const tRes = await transitionReturnStatus(adminDb, adminEmail, returnId, {
      targetStatus: "warehouse_received",
      reason: `Parcel received at warehouse by ${receiverName}`
    });
    if (!tRes.success) {
      return tRes;
    }
  }

  const rmaNumber = data.rma_number || returnId;
  const receivingInfo = {
    warehouse_location: payload.warehouse_location || "WH-MAIN",
    carrier_name: payload.carrier_name || payload.courier || data.courier || "N/A",
    tracking_number: payload.tracking_number || payload.reverse_awb || data.reverse_awb || "N/A",
    parcel_condition: payload.parcel_condition || payload.package_condition || "intact",
    notes: payload.notes || payload.receiving_notes || "",
    received_by: receiverName,
    received_at: receivedAt
  };

  await docRef.update({
    status: "warehouse_received",
    warehouse_received_at: receivedAt,
    received_by: receiverName,
    courier: receivingInfo.carrier_name,
    reverse_awb: receivingInfo.tracking_number,
    package_condition: receivingInfo.parcel_condition,
    receiving_info: receivingInfo,
    updated_at: nowIso
  });

  await logAdminReturnAudit(
    adminDb,
    adminEmail,
    "PARCEL_RECEIVED",
    rmaNumber,
    `Parcel received at warehouse by ${receiverName}. Condition: ${receivingInfo.parcel_condition}`,
    { receiving_info: receivingInfo, order_id: data.order_id, customer_profile_id: data.customer_profile_id, return_id: returnId }
  );

  return {
    success: true,
    message: `Parcel for ${rmaNumber} marked as received at warehouse.`,
    status: "warehouse_received",
    received_at: receivedAt
  };
}

/**
 * Start inspection workflow
 */
export async function startWarehouseInspection(
  adminDb: any,
  returnId: string,
  adminEmail: string,
  inspectorName?: string
) {
  const docRef = adminDb.collection("return_requests").doc(returnId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found" };
  }

  const data = docSnap.data();
  const currentStatus = data.status;

  if (currentStatus !== "warehouse_received") {
    return {
      success: false,
      statusCode: 400,
      error: `Cannot start inspection from status '${currentStatus}'. Must be warehouse_received.`
    };
  }

  const nowIso = new Date().toISOString();
  const inspector = inspectorName || adminEmail;

  if (currentStatus !== "inspection_in_progress") {
    const tRes = await transitionReturnStatus(adminDb, adminEmail, returnId, {
      targetStatus: "inspection_in_progress",
      reason: `Inspection started by ${inspector}`
    });
    if (!tRes.success) return tRes;
  }

  const rmaNumber = data.rma_number || returnId;

  await docRef.update({
    status: "inspection_in_progress",
    assigned_inspector: inspector,
    inspection_assigned_to: inspector,
    inspection_started_at: nowIso,
    updated_at: nowIso
  });

  await logAdminReturnAudit(
    adminDb,
    adminEmail,
    "INSPECTION_STARTED",
    rmaNumber,
    `Inspection started by ${inspector}`,
    { inspector }
  );

  return {
    success: true,
    message: `Inspection started for ${rmaNumber}`,
    status: "inspection_in_progress",
    assigned_inspector: inspector,
    inspection_started_at: nowIso
  };
}

/**
 * Complete inspection workflow
 */
export async function completeWarehouseInspection(
  adminDb: any,
  returnId: string,
  adminEmail: string,
  payload: CompleteInspectionPayload
) {
  const docRef = adminDb.collection("return_requests").doc(returnId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found" };
  }

  const data = docSnap.data();
  const currentStatus = data.status;

  if (!["warehouse_received", "inspection_in_progress"].includes(currentStatus)) {
    return {
      success: false,
      statusCode: 400,
      error: `Cannot complete inspection from status '${currentStatus}'. Must be in progress.`
    };
  }

  // Normalize payload
  const rawGrade = (payload.overall_condition_grade || "").toLowerCase();
  const itemsInspection = payload.items_inspection || (payload as any).items || [];
  const hasCounterfeit = itemsInspection.some((i: any) => i.counterfeited_swapped);

  let decision = payload.decision;
  if (!decision) {
    if (hasCounterfeit || rawGrade.includes("scam") || rawGrade.startsWith("d") || rawGrade.startsWith("e")) {
      decision = "needs_manager_review";
    } else if (rawGrade.startsWith("a") || rawGrade.startsWith("b")) {
      decision = "pass";
    } else if (rawGrade.startsWith("c")) {
      decision = "partial_pass";
    } else {
      decision = "pass";
    }
  }

  let itemGrades = payload.item_grades;
  if ((!itemGrades || itemGrades.length === 0) && itemsInspection.length > 0) {
    itemGrades = itemsInspection.map((it: any) => {
      let g: "A" | "B" | "C" | "D" | "E" = "A";
      const rawItemGrade = (it.grade || "").toUpperCase();
      if (rawItemGrade.startsWith("A")) g = "A";
      else if (rawItemGrade.startsWith("B")) g = "B";
      else if (rawItemGrade.startsWith("C")) g = "C";
      else if (rawItemGrade.startsWith("D")) g = "D";
      else if (rawItemGrade.startsWith("E")) g = "E";
      return {
        product_id: it.product_id || "item",
        sku: it.sku || it.product_id,
        name: it.name || "Item",
        grade: g,
        tags_attached: it.tags_attached ?? true,
        original_packaging: it.original_packaging ?? true,
        worn_used_washed: it.worn_used_washed ?? false,
        stain_damage_smell: it.stain_damage_smell ?? false,
        counterfeited_swapped: it.counterfeited_swapped ?? false,
        recommended_action: it.recommended_action || "restock",
        notes: it.notes || ""
      };
    });
  }

  if (!itemGrades || itemGrades.length === 0) {
    itemGrades = [{ product_id: "item", grade: "A" }];
  }

  // Determine target status
  let targetStatus: string = "inspection_completed";
  let recommendedNextStatus: string = "inspection_passed";

  if (decision === "pass") {
    targetStatus = "inspection_passed";
    recommendedNextStatus = "inspection_passed";
  } else if (decision === "fail") {
    targetStatus = "inspection_failed";
    recommendedNextStatus = "inspection_failed";
  } else if (decision === "needs_manager_review" || hasCounterfeit) {
    targetStatus = "manager_review";
    recommendedNextStatus = "manager_review";
  } else if (decision === "partial_pass") {
    targetStatus = "inspection_completed";
    recommendedNextStatus = "inspection_completed";
  }

  const tRes = await transitionReturnStatus(adminDb, adminEmail, returnId, {
    targetStatus,
    reason: `Inspection completed: Decision = ${decision}, Grade = ${rawGrade || "A"}`
  });

  if (!tRes.success) return tRes;

  const nowIso = new Date().toISOString();
  const rmaNumber = data.rma_number || returnId;
  const computedOverallGrade = payload.overall_condition_grade || (itemGrades[0]?.grade ? `${itemGrades[0].grade}_grade` : "A_grade_resellable");

  const inspectionReport = {
    report_id: `INSP-${Date.now()}`,
    rma_number: rmaNumber,
    inspector: data.assigned_inspector || adminEmail,
    completed_at: nowIso,
    decision,
    recommendation: payload.recommendation || "refund",
    overall_condition_grade: computedOverallGrade,
    item_grades: itemGrades,
    items_inspection: itemsInspection,
    discrepancies: payload.discrepancies || [],
    discrepancy_details: payload.discrepancy_details || "",
    photos: payload.photos || data.warehouse_photos || [],
    summary_notes: payload.summary_notes || payload.inspection_summary || ""
  };

  await docRef.update({
    status: targetStatus,
    inspection_completed_at: nowIso,
    inspection_decision: decision,
    recommendation: payload.recommendation || "refund",
    overall_condition_grade: computedOverallGrade,
    inspection_report: inspectionReport,
    warehouse_photos: payload.photos && payload.photos.length > 0 ? payload.photos : (data.warehouse_photos || []),
    updated_at: nowIso
  });

  await logAdminReturnAudit(
    adminDb,
    adminEmail,
    "INSPECTION_COMPLETED",
    rmaNumber,
    `Inspection completed. Decision: ${decision}, Overall Grade: ${computedOverallGrade}`,
    { order_id: data.order_id, customer_profile_id: data.customer_profile_id, return_id: returnId }
  );

  return {
    success: true,
    message: `Inspection completed for ${rmaNumber}. Result: ${decision}.`,
    status: targetStatus,
    recommended_next_status: recommendedNextStatus,
    overall_condition_grade: computedOverallGrade,
    inspection_report: inspectionReport
  };
}

/**
 * Upload warehouse photo
 */
export async function uploadWarehousePhoto(
  adminDb: any,
  returnId: string,
  adminEmail: string,
  photo: WarehousePhoto
) {
  const docRef = adminDb.collection("return_requests").doc(returnId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found" };
  }

  if (!photo || !photo.url) {
    return { success: false, statusCode: 400, error: "Photo URL is required" };
  }

  const data = docSnap.data();
  const existingPhotos: WarehousePhoto[] = data.warehouse_photos || [];
  const nowIso = new Date().toISOString();

  const newPhoto: WarehousePhoto = {
    id: `wphoto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    url: photo.url,
    type: photo.type || photo.photo_type || "overview",
    photo_type: photo.photo_type || photo.type || "overview",
    caption: photo.caption || "",
    uploaded_by: adminEmail,
    uploaded_at: nowIso
  };

  const updatedPhotos = [...existingPhotos, newPhoto];
  await docRef.update({
    warehouse_photos: updatedPhotos,
    updated_at: nowIso
  });

  const rmaNumber = data.rma_number || returnId;
  await logAdminReturnAudit(
    adminDb,
    adminEmail,
    "warehouse_photo_added",
    rmaNumber,
    `Added inspection photo (${photo.photo_type || photo.type || "overview"})`,
    { photo_id: newPhoto.id, url: newPhoto.url }
  );

  return {
    success: true,
    photo: newPhoto,
    total_photos: updatedPhotos.length
  };
}

/**
 * Add Warehouse Internal Note (stored in return_requests/{id}/warehouse_notes)
 */
export async function addWarehouseInternalNote(
  adminDb: any,
  returnId: string,
  authorEmail: string,
  noteText: string
) {
  if (!noteText || !noteText.trim()) {
    return { success: false, statusCode: 400, error: "Warehouse note content cannot be empty" };
  }

  const docRef = adminDb.collection("return_requests").doc(returnId);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    return { success: false, statusCode: 404, error: "Return request not found" };
  }

  const data = docSnap.data();
  const nowIso = new Date().toISOString();

  const notesColl = docRef.collection("warehouse_notes");
  const addedDoc = await notesColl.add({
    note: noteText.trim(),
    author_email: authorEmail,
    created_by: authorEmail,
    created_at: nowIso,
    timestamp: nowIso
  });

  const rmaNumber = data.rma_number || returnId;
  await logAdminReturnAudit(
    adminDb,
    authorEmail,
    "warehouse_note_added",
    rmaNumber,
    `Added warehouse internal note`,
    { note_id: addedDoc.id }
  );

  return {
    success: true,
    note_id: addedDoc.id,
    note: {
      id: addedDoc.id,
      note: noteText.trim(),
      author_email: authorEmail,
      created_by: authorEmail,
      created_at: nowIso
    }
  };
}

/**
 * Get Warehouse Internal Notes
 */
export async function getWarehouseInternalNotes(adminDb: any, returnId: string) {
  const docRef = adminDb.collection("return_requests").doc(returnId);
  const notesSnap = await docRef.collection("warehouse_notes").orderBy("created_at", "desc").get();

  const notes: any[] = [];
  notesSnap.forEach((doc: any) => {
    notes.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return {
    success: true,
    notes
  };
}
