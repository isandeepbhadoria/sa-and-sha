import { GstInvoice } from "./invoiceTypes";
import { GstCreditNote } from "./creditNoteTypes";

export interface CreditNoteItemRequest {
  sku?: string;
  line_id?: string;
  product_id?: string;
  quantity: number;
}

export interface EvaluateCreditNoteEligibilityParams {
  orderId?: string;
  invoiceId?: string;
  rmaNumber?: string;
  returnRequestId?: string;
  itemsToCredit?: CreditNoteItemRequest[];
  creditShipping?: boolean;
  allowOpenReturnOverride?: boolean; // For explicit admin or specific test triggers if needed
}

export interface CreditNoteEligibilityResult {
  eligible: boolean;
  reasonCode?:
    | "NO_FINALIZED_INVOICE"
    | "RETURN_NOT_SETTLED"
    | "ORDER_NOT_CANCELLED"
    | "NO_CREDITABLE_QUANTITY"
    | "OVER_CREDIT_QUANTITY"
    | "OVER_CREDIT_AMOUNT"
    | "INVALID_ITEMS"
    | "ACCOUNTING_STATE_INCONSISTENT";
  reasonDescription?: string;
  originalInvoice?: GstInvoice;
  existingCreditNotes?: GstCreditNote[];
  returnRequest?: any;
  order?: any;
  remainingCreditableItems?: Array<{
    line_id: string;
    sku: string;
    original_quantity: number;
    credited_quantity: number;
    remaining_quantity: number;
    unit_price: number;
    hsn_code: string;
    gst_rate: number;
  }>;
  remainingCreditableGrandTotal?: number;
}

// Authoritative settled return statuses that allow credit note creation
const ELIGIBLE_RETURN_STATUSES = [
  "financial_completed",
  "refund_completed",
  "exchange_shipped",
  "completed",
  "refund_approved",
  "exchange_approved",
  "inspection_passed",
  "inspection_completed",
  "warehouse_received",
  "picked_up",
  "approved",
  "cancelled"
];

/**
 * Evaluates authoritative credit-note eligibility for an order/return.
 * Fails closed on any inconsistent accounting state.
 */
export async function evaluateCreditNoteEligibility(
  adminDb: any,
  params: EvaluateCreditNoteEligibilityParams
): Promise<CreditNoteEligibilityResult> {
  const { orderId, invoiceId, rmaNumber, returnRequestId, itemsToCredit, creditShipping } = params;

  if (!orderId && !invoiceId && !rmaNumber && !returnRequestId) {
    return {
      eligible: false,
      reasonCode: "ACCOUNTING_STATE_INCONSISTENT",
      reasonDescription: "Must provide orderId, invoiceId, rmaNumber, or returnRequestId to evaluate credit note eligibility."
    };
  }

  // 1. Resolve Return Request if provided
  let returnDoc: any = null;
  let targetOrderId = orderId;

  if (rmaNumber || returnRequestId) {
    const queryVal = rmaNumber || returnRequestId;
    let rQuery = await adminDb.collection("return_requests").where("rma_number", "==", queryVal).limit(1).get();
    if (rQuery.empty) {
      rQuery = await adminDb.collection("return_requests").where("request_id", "==", queryVal).limit(1).get();
    }
    if (rQuery.empty) {
      const docSnap = await adminDb.collection("return_requests").doc(queryVal!).get();
      if (docSnap.exists) {
        returnDoc = { id: docSnap.id, ...docSnap.data() };
      }
    } else {
      const d = rQuery.docs[0];
      returnDoc = { id: d.id, ...d.data() };
    }

    if (returnDoc) {
      targetOrderId = targetOrderId || returnDoc.order_id;
    }
  }

  // 2. Fetch Original GST Invoice
  let originalInvoice: GstInvoice | null = null;
  if (invoiceId) {
    const invSnap = await adminDb.collection("gst_invoices").doc(invoiceId).get();
    if (invSnap.exists) {
      originalInvoice = invSnap.data() as GstInvoice;
    }
  } else if (targetOrderId) {
    const invQuery = await adminDb
      .collection("gst_invoices")
      .where("order_id", "==", targetOrderId)
      .where("status", "==", "FINALIZED")
      .limit(1)
      .get();
    if (!invQuery.empty) {
      originalInvoice = invQuery.docs[0].data() as GstInvoice;
    }
  }

  if (!originalInvoice) {
    return {
      eligible: false,
      reasonCode: "NO_FINALIZED_INVOICE",
      reasonDescription: `No finalized immutable GST invoice exists for order/return (order: '${targetOrderId || 'N/A'}'). Credit note cannot be created without original invoice.`
    };
  }

  if (originalInvoice.status !== "FINALIZED") {
    return {
      eligible: false,
      reasonCode: "NO_FINALIZED_INVOICE",
      reasonDescription: `GST invoice '${originalInvoice.invoice_number}' is in state '${originalInvoice.status}', not 'FINALIZED'.`
    };
  }

  // 3. Fetch Order document
  let orderData: any = null;
  if (originalInvoice.order_id) {
    const oQuery = await adminDb.collection("orders").where("order_id", "==", originalInvoice.order_id).limit(1).get();
    if (!oQuery.empty) {
      orderData = oQuery.docs[0].data();
    } else {
      const oDoc = await adminDb.collection("orders").doc(originalInvoice.order_id).get();
      if (oDoc.exists) orderData = oDoc.data();
    }
  }

  // 4. Verify Return or Cancellation Settlement Eligibility
  const isOrderCancelled = Boolean(
    orderData &&
    ((orderData.status || orderData.order_status || "").toString().toLowerCase() === "cancelled" ||
     (orderData.status || orderData.order_status || "").toString().toLowerCase().includes("cancel"))
  );

  if (returnDoc) {
    const rStatus = String(returnDoc.status || "").toLowerCase();
    const isSettled = ELIGIBLE_RETURN_STATUSES.includes(rStatus);
    if (!isSettled && !params.allowOpenReturnOverride) {
      return {
        eligible: false,
        reasonCode: "RETURN_NOT_SETTLED",
        reasonDescription: `Return request '${returnDoc.rma_number || returnDoc.id}' is in status '${returnDoc.status}'. Must reach an eligible settled/approved state (e.g. financial_completed, refund_approved, inspection_passed, approved) before credit note issuance.`,
        originalInvoice,
        returnRequest: returnDoc,
        order: orderData
      };
    }
  } else if (!isOrderCancelled && orderData?.requires_credit_note !== true && !params.allowOpenReturnOverride) {
    // Neither a return request provided nor order cancelled / requires credit note
    return {
      eligible: false,
      reasonCode: "ORDER_NOT_CANCELLED",
      reasonDescription: `Order '${targetOrderId}' is not cancelled and has no active settled return request. Credit note cannot be issued.`,
      originalInvoice,
      order: orderData
    };
  }

  // 5. Fetch Existing Credit Notes for this Original Invoice / Order
  const existingCnSnap = await adminDb
    .collection("gst_credit_notes")
    .where("original_invoice_id", "==", originalInvoice.invoice_id)
    .get();

  const existingCreditNotes: GstCreditNote[] = [];
  existingCnSnap.forEach((doc: any) => {
    existingCreditNotes.push(doc.data() as GstCreditNote);
  });

  // Calculate cumulative credited quantities per line item and total credited amount
  const lineCreditedQtyMap = new Map<string, number>(); // line_id or sku -> total credited qty
  let totalCreditedAmount = 0;

  for (const cn of existingCreditNotes) {
    if (cn.status === "CANCELLED") continue;
    totalCreditedAmount += Number(cn.grand_total_reversal || 0);

    for (const item of cn.line_items || []) {
      const keyByLine = item.line_id;
      const keyBySku = item.sku;
      
      const prevLineQty = lineCreditedQtyMap.get(keyByLine) || 0;
      lineCreditedQtyMap.set(keyByLine, prevLineQty + item.credited_quantity);

      if (keyBySku && keyBySku !== keyByLine) {
        const prevSkuQty = lineCreditedQtyMap.get(keyBySku) || 0;
        lineCreditedQtyMap.set(keyBySku, prevSkuQty + item.credited_quantity);
      }
    }
  }

  // Determine remaining creditable quantity per line
  const remainingCreditableItems: Array<{
    line_id: string;
    sku: string;
    original_quantity: number;
    credited_quantity: number;
    remaining_quantity: number;
    unit_price: number;
    hsn_code: string;
    gst_rate: number;
  }> = [];

  let totalRemainingQuantityAcrossInvoice = 0;

  for (const line of originalInvoice.line_items) {
    const creditedQty = lineCreditedQtyMap.get(line.line_id) ?? lineCreditedQtyMap.get(line.sku) ?? 0;
    const remainingQty = Math.max(0, line.quantity - creditedQty);
    totalRemainingQuantityAcrossInvoice += remainingQty;

    remainingCreditableItems.push({
      line_id: line.line_id,
      sku: line.sku,
      original_quantity: line.quantity,
      credited_quantity: creditedQty,
      remaining_quantity: remainingQty,
      unit_price: line.unit_price,
      hsn_code: line.hsn_code,
      gst_rate: line.gst_rate
    });
  }

  const remainingCreditableGrandTotal = Math.max(0, originalInvoice.grand_total - totalCreditedAmount);

  if (totalRemainingQuantityAcrossInvoice <= 0 && remainingCreditableGrandTotal <= 0.01) {
    return {
      eligible: false,
      reasonCode: "NO_CREDITABLE_QUANTITY",
      reasonDescription: `Invoice '${originalInvoice.invoice_number}' has already been fully credited by existing credit note(s).`,
      originalInvoice,
      existingCreditNotes,
      remainingCreditableItems,
      remainingCreditableGrandTotal: 0
    };
  }

  // 6. Validate Specific Requested Items (if provided)
  if (itemsToCredit && itemsToCredit.length > 0) {
    for (const reqItem of itemsToCredit) {
      if (!reqItem.quantity || reqItem.quantity <= 0) continue;

      // Find matching line in original invoice
      const matchedLine = originalInvoice.line_items.find(
        (l) =>
          (reqItem.line_id && l.line_id === reqItem.line_id) ||
          (reqItem.sku && l.sku.toLowerCase() === reqItem.sku.toLowerCase()) ||
          (reqItem.product_id && l.product_id === reqItem.product_id)
      );

      if (!matchedLine) {
        return {
          eligible: false,
          reasonCode: "INVALID_ITEMS",
          reasonDescription: `Item '${reqItem.sku || reqItem.line_id || reqItem.product_id}' was not part of original invoice '${originalInvoice.invoice_number}'.`,
          originalInvoice,
          existingCreditNotes,
          remainingCreditableItems,
          remainingCreditableGrandTotal
        };
      }

      const creditedSoFar = lineCreditedQtyMap.get(matchedLine.line_id) ?? lineCreditedQtyMap.get(matchedLine.sku) ?? 0;
      const remainingForLine = Math.max(0, matchedLine.quantity - creditedSoFar);

      if (reqItem.quantity > remainingForLine) {
        return {
          eligible: false,
          reasonCode: "OVER_CREDIT_QUANTITY",
          reasonDescription: `Requested credit quantity (${reqItem.quantity}) for SKU '${matchedLine.sku}' exceeds remaining creditable quantity (${remainingForLine}) on invoice '${originalInvoice.invoice_number}'.`,
          originalInvoice,
          existingCreditNotes,
          remainingCreditableItems,
          remainingCreditableGrandTotal
        };
      }
    }
  }

  return {
    eligible: true,
    originalInvoice,
    existingCreditNotes,
    returnRequest: returnDoc,
    order: orderData,
    remainingCreditableItems,
    remainingCreditableGrandTotal
  };
}
