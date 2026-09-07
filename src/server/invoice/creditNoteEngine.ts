import { GstCreditNote, CreditNoteReason, GstReportingStatus } from "./creditNoteTypes";
import {
  CreditNoteNumberingConfig,
  getCreditNoteNumberingConfigFromFirestore
} from "./creditNoteNumberingConfig";
import {
  evaluateCreditNoteEligibility,
  CreditNoteItemRequest
} from "./creditNoteEligibility";
import { calculateCreditNoteData } from "./creditNoteCalculation";

export async function generateCreditNoteNumberInTransaction(
  transaction: any,
  adminDb: any,
  financialYear: string,
  numConfig?: CreditNoteNumberingConfig
): Promise<string> {
  const counterRef = adminDb.collection("counters").doc("gst_credit_note_counter");
  const counterSnap = await transaction.get(counterRef);

  let seq = 1;
  if (counterSnap.exists) {
    const data = counterSnap.data() || {};
    if (data.financial_year === financialYear && typeof data.current_sequence === "number") {
      seq = data.current_sequence + 1;
    }
  }

  const prefix = numConfig?.prefix || "KLCN";
  const sep = numConfig?.separator || "/";
  const padding = numConfig?.sequence_padding || 6;

  const paddedSeq = seq.toString().padStart(padding, "0");
  const creditNoteNumber = `${prefix}${sep}${financialYear}${sep}${paddedSeq}`;

  transaction.set(counterRef, {
    financial_year: financialYear,
    current_sequence: seq,
    last_credit_note_number: creditNoteNumber,
    updated_at: new Date().toISOString()
  });

  return creditNoteNumber;
}

export interface CreateCreditNoteOptions {
  orderId?: string;
  invoiceId?: string;
  rmaNumber?: string;
  returnRequestId?: string;
  itemsToCredit?: CreditNoteItemRequest[];
  creditShipping?: boolean;
  reason?: CreditNoteReason;
  reasonDetails?: string;
  createdBy?: string;
  idempotencyKey?: string;
  allowOpenReturnOverride?: boolean;
}

export interface CreateCreditNoteResponse {
  success: boolean;
  creditNote?: GstCreditNote;
  code?: string;
  error?: string;
  details?: any;
  reused?: boolean;
}

/**
 * Idempotently and atomically creates a GST Credit Note inside a Firestore transaction.
 * FAILS CLOSED on accounting inconsistencies or over-crediting.
 */
export async function createOrFetchGstCreditNote(
  adminDb: any,
  options: CreateCreditNoteOptions
): Promise<CreateCreditNoteResponse> {
  const createdBy = options.createdBy || "system";
  const reason = options.reason || "GOODS_RETURNED";

  try {
    // 1. Idempotency Check (Pre-Transaction)
    const idempotencyKey = options.idempotencyKey || (options.rmaNumber ? `rma_${options.rmaNumber}` : null);

    if (idempotencyKey) {
      const existingKeySnap = await adminDb
        .collection("gst_credit_notes")
        .where("idempotency_key", "==", idempotencyKey)
        .limit(1)
        .get();

      if (!existingKeySnap.empty) {
        const doc = existingKeySnap.docs[0];
        return {
          success: true,
          creditNote: { ...(doc.data() as GstCreditNote), credit_note_id: doc.id },
          reused: true
        };
      }
    }

    if (options.rmaNumber || options.returnRequestId) {
      const rmaVal = options.rmaNumber || options.returnRequestId;
      const existingRmaSnap = await adminDb
        .collection("gst_credit_notes")
        .where("rma_number", "==", rmaVal)
        .limit(1)
        .get();

      if (!existingRmaSnap.empty) {
        const doc = existingRmaSnap.docs[0];
        return {
          success: true,
          creditNote: { ...(doc.data() as GstCreditNote), credit_note_id: doc.id },
          reused: true
        };
      }
    }

    // 2. Evaluate Eligibility
    const eligibility = await evaluateCreditNoteEligibility(adminDb, {
      orderId: options.orderId,
      invoiceId: options.invoiceId,
      rmaNumber: options.rmaNumber,
      returnRequestId: options.returnRequestId,
      itemsToCredit: options.itemsToCredit,
      creditShipping: options.creditShipping,
      allowOpenReturnOverride: options.allowOpenReturnOverride
    });

    if (!eligibility.eligible || !eligibility.originalInvoice) {
      return {
        success: false,
        code: eligibility.reasonCode || "INELIGIBLE",
        error: eligibility.reasonDescription || "Order or return is not eligible for a GST credit note.",
        details: eligibility
      };
    }

    const origInvoice = eligibility.originalInvoice;

    // Default itemsToCredit to remaining creditable items if not explicitly specified
    let targetItemsToCredit = options.itemsToCredit;
    if (!targetItemsToCredit || targetItemsToCredit.length === 0) {
      targetItemsToCredit = (eligibility.remainingCreditableItems || [])
        .filter((i) => i.remaining_quantity > 0)
        .map((i) => ({ line_id: i.line_id, sku: i.sku, quantity: i.remaining_quantity }));
    }

    if (targetItemsToCredit.length === 0 && !options.creditShipping) {
      return {
        success: false,
        code: "NO_CREDITABLE_QUANTITY",
        error: "All line items on original invoice have already been fully credited."
      };
    }

    // 3. Pre-calculate Credit Note
    const calcResult = calculateCreditNoteData({
      originalInvoice: origInvoice,
      itemsToCredit: targetItemsToCredit,
      creditShipping: options.creditShipping,
      reason,
      reasonDetails: options.reasonDetails,
      createdBy,
      rmaNumber: options.rmaNumber || eligibility.returnRequest?.rma_number || null,
      returnRequestId: options.returnRequestId || eligibility.returnRequest?.id || null,
      idempotencyKey
    });

    if (!calcResult.success) {
      const errRes = calcResult as { success: false; code: string; error: string; details?: any };
      return {
        success: false,
        code: errRes.code,
        error: errRes.error,
        details: errRes.details
      };
    }

    // 4. Load Numbering Config
    const numberingConfig = await getCreditNoteNumberingConfigFromFirestore(adminDb);

    // 5. Perform Atomic Creation in Transaction
    let createdCreditNote: GstCreditNote | null = null;
    const docIdSeed = idempotencyKey
      ? idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_")
      : `cn_${origInvoice.order_id}_${Date.now()}`;
    const creditNoteDocId = docIdSeed.startsWith("cn_") ? docIdSeed : `cn_${docIdSeed}`;

    await adminDb.runTransaction(async (transaction: any) => {
      // Re-check for duplicate document ID inside transaction
      const doubleCheckRef = adminDb.collection("gst_credit_notes").doc(creditNoteDocId);
      const doubleCheckSnap = await transaction.get(doubleCheckRef);
      if (doubleCheckSnap.exists) {
        createdCreditNote = doubleCheckSnap.data() as GstCreditNote;
        return;
      }

      // Re-query existing credit notes inside transaction for exact concurrency protection
      const existingQueryRef = adminDb
        .collection("gst_credit_notes")
        .where("original_invoice_id", "==", origInvoice.invoice_id);
      const existingQuerySnap = await transaction.get(existingQueryRef);

      let cumulativeCreditedAmount = 0;
      const cumulativeLineQtyMap = new Map<string, number>();

      existingQuerySnap.forEach((doc: any) => {
        const cnData = doc.data() as GstCreditNote;
        if (cnData.status === "CANCELLED") return;
        cumulativeCreditedAmount += Number(cnData.grand_total_reversal || 0);

        for (const line of cnData.line_items || []) {
          const prev = cumulativeLineQtyMap.get(line.line_id) || 0;
          cumulativeLineQtyMap.set(line.line_id, prev + line.credited_quantity);
        }
      });

      // Verify cumulative limits
      const requestedReversalGrandTotal = calcResult.creditNoteData.grand_total_reversal;
      if (cumulativeCreditedAmount + requestedReversalGrandTotal > origInvoice.grand_total + 0.01) {
        throw new Error(
          `Over-credit error: Cumulative credit note total (₹${cumulativeCreditedAmount + requestedReversalGrandTotal}) would exceed original invoice grand total (₹${origInvoice.grand_total}).`
        );
      }

      for (const reqLine of calcResult.creditNoteData.line_items) {
        const origLine = origInvoice.line_items.find((l) => l.line_id === reqLine.line_id);
        if (origLine) {
          const prevCredited = cumulativeLineQtyMap.get(origLine.line_id) || 0;
          if (prevCredited + reqLine.credited_quantity > origLine.quantity) {
            throw new Error(
              `Over-credit error: Cumulative credited quantity (${prevCredited + reqLine.credited_quantity}) for SKU '${origLine.sku}' would exceed original invoice line quantity (${origLine.quantity}).`
            );
          }
        }
      }

      // Generate sequential credit note number
      const creditNoteNumber = await generateCreditNoteNumberInTransaction(
        transaction,
        adminDb,
        calcResult.creditNoteData.financial_year,
        numberingConfig
      );

      const nowIso = new Date().toISOString();
      const creditNotePayload: GstCreditNote = {
        ...calcResult.creditNoteData,
        credit_note_id: creditNoteDocId,
        credit_note_number: creditNoteNumber,
        status: "ISSUED",
        created_at: nowIso,
        issue_date: nowIso
      };

      // Set credit note document
      transaction.set(doubleCheckRef, creditNotePayload);

      // Update Return Request document linkage if present
      if (eligibility.returnRequest?.id) {
        const rRef = adminDb.collection("return_requests").doc(eligibility.returnRequest.id);
        transaction.update(rRef, {
          credit_note_id: creditNoteDocId,
          credit_note_number: creditNoteNumber,
          credit_note_status: "ISSUED",
          credit_note_issued_at: nowIso
        });
      }

      // Update Order document linkage
      if (origInvoice.order_id) {
        const oRef = adminDb.collection("orders").doc(origInvoice.order_id);
        const oSnap = await transaction.get(oRef);
        if (oSnap.exists) {
          const oData = oSnap.data();
          const existingCns: any[] = Array.isArray(oData.credit_notes) ? oData.credit_notes : [];
          existingCns.push({
            credit_note_id: creditNoteDocId,
            credit_note_number: creditNoteNumber,
            amount: creditNotePayload.grand_total_reversal,
            issued_at: nowIso
          });

          transaction.update(oRef, {
            latest_credit_note_id: creditNoteDocId,
            latest_credit_note_number: creditNoteNumber,
            credit_note_status: "ISSUED",
            credit_notes: existingCns
          });
        }
      }

      // Record Audit Log inside transaction
      const auditRef = adminDb.collection("admin_audit_logs").doc();
      transaction.set(auditRef, {
        event_type: "credit_note_created",
        action: "CREDIT_NOTE_ISSUED",
        credit_note_id: creditNoteDocId,
        credit_note_number: creditNoteNumber,
        original_invoice_id: origInvoice.invoice_id,
        original_invoice_number: origInvoice.invoice_number,
        order_id: origInvoice.order_id,
        rma_number: creditNotePayload.rma_number || null,
        grand_total_reversal: creditNotePayload.grand_total_reversal,
        tax_total_reversal: creditNotePayload.tax_total_reversal,
        reason: creditNotePayload.reason,
        created_by: createdBy,
        timestamp: nowIso
      });

      createdCreditNote = creditNotePayload;
    });

    if (!createdCreditNote) {
      return { success: false, error: "Transaction failed to generate credit note." };
    }

    return {
      success: true,
      creditNote: createdCreditNote,
      reused: false
    };
  } catch (err: any) {
    console.error(`[GST CREDIT NOTE ENGINE] Error issuing credit note:`, err);
    return {
      success: false,
      error: `Failed to issue GST credit note: ${err.message || String(err)}`
    };
  }
}

/**
 * Retrieves credit note by credit_note_id or credit_note_number.
 */
export async function getCreditNoteByIdOrNumber(
  adminDb: any,
  queryId: string
): Promise<{ success: boolean; creditNote?: GstCreditNote; error?: string }> {
  const cleanId = String(queryId).trim();
  try {
    const docSnap = await adminDb.collection("gst_credit_notes").doc(cleanId).get();
    if (docSnap.exists) {
      return { success: true, creditNote: { ...(docSnap.data() as GstCreditNote), credit_note_id: docSnap.id } };
    }

    const byNumQuery = await adminDb
      .collection("gst_credit_notes")
      .where("credit_note_number", "==", cleanId)
      .limit(1)
      .get();

    if (!byNumQuery.empty) {
      const doc = byNumQuery.docs[0];
      return { success: true, creditNote: { ...(doc.data() as GstCreditNote), credit_note_id: doc.id } };
    }

    const byRmaQuery = await adminDb
      .collection("gst_credit_notes")
      .where("rma_number", "==", cleanId)
      .limit(1)
      .get();

    if (!byRmaQuery.empty) {
      const doc = byRmaQuery.docs[0];
      return { success: true, creditNote: { ...(doc.data() as GstCreditNote), credit_note_id: doc.id } };
    }

    return { success: false, error: `Credit Note '${cleanId}' not found.` };
  } catch (err: any) {
    console.error(`Error fetching credit note '${cleanId}':`, err);
    return { success: false, error: err.message || "Failed to fetch credit note." };
  }
}

/**
 * Lists credit notes for admin reporting.
 */
export async function listGstCreditNotes(
  adminDb: any,
  filters?: {
    orderId?: string;
    financialYear?: string;
    customerType?: string;
    limit?: number;
  }
): Promise<{ success: boolean; creditNotes: GstCreditNote[]; error?: string }> {
  try {
    let query: any = adminDb.collection("gst_credit_notes");

    if (filters?.orderId) {
      query = query.where("order_id", "==", filters.orderId);
    }
    if (filters?.financialYear) {
      query = query.where("financial_year", "==", filters.financialYear);
    }
    if (filters?.customerType) {
      query = query.where("gst_customer_type", "==", filters.customerType.toUpperCase());
    }

    const snap = await query.limit(filters?.limit || 50).get();
    const creditNotes: GstCreditNote[] = [];

    snap.forEach((doc: any) => {
      creditNotes.push({ ...(doc.data() as GstCreditNote), credit_note_id: doc.id });
    });

    return { success: true, creditNotes };
  } catch (err: any) {
    console.error("Error listing credit notes:", err);
    return { success: false, creditNotes: [], error: err.message || "Failed to list credit notes." };
  }
}

export interface UpdateGstReportingStatusOptions {
  creditNoteId: string;
  gstReportingStatus: GstReportingStatus;
  taxLiabilityAdjusted?: boolean;
  gstReportingPeriod?: string;
  gstAdjustmentReference?: string;
  updatedBy: string;
}

export interface UpdateGstReportingStatusResponse {
  success: boolean;
  creditNote?: GstCreditNote;
  error?: string;
}

/**
 * Updates the GST reporting lifecycle status and tax liability adjustment flag for a credit note.
 * IMMUTABILITY GUARANTEE: Does NOT recalculate or alter original accounting or line item values.
 */
export async function updateCreditNoteGstReportingStatus(
  adminDb: any,
  options: UpdateGstReportingStatusOptions
): Promise<UpdateGstReportingStatusResponse> {
  const {
    creditNoteId,
    gstReportingStatus,
    taxLiabilityAdjusted,
    gstReportingPeriod,
    gstAdjustmentReference,
    updatedBy
  } = options;

  if (!creditNoteId) {
    return { success: false, error: "creditNoteId is required." };
  }

  const validStatuses: GstReportingStatus[] = [
    "NOT_REPORTED",
    "REPORTED",
    "ADJUSTED",
    "NOT_ELIGIBLE_FOR_ADJUSTMENT"
  ];

  if (!validStatuses.includes(gstReportingStatus)) {
    return {
      success: false,
      error: `Invalid gstReportingStatus '${gstReportingStatus}'. Allowed values: ${validStatuses.join(", ")}`
    };
  }

  try {
    let updatedNote: GstCreditNote | null = null;
    const nowIso = new Date().toISOString();

    await adminDb.runTransaction(async (transaction: any) => {
      const docRef = adminDb.collection("gst_credit_notes").doc(creditNoteId);
      const docSnap = await transaction.get(docRef);

      if (!docSnap.exists) {
        throw new Error(`Credit Note '${creditNoteId}' not found.`);
      }

      const existingData = docSnap.data() as GstCreditNote;

      const isAdjusted = gstReportingStatus === "ADJUSTED" || (taxLiabilityAdjusted === true);

      const updates: Partial<GstCreditNote> = {
        gst_reporting_status: gstReportingStatus,
        tax_liability_adjusted: isAdjusted,
        gst_reporting_period: gstReportingPeriod || existingData.gst_reporting_period || null,
        gst_adjustment_reference: gstAdjustmentReference || existingData.gst_adjustment_reference || null
      };

      if (gstReportingStatus === "REPORTED" && !existingData.gst_reported_at) {
        updates.gst_reported_at = nowIso;
      }

      if (gstReportingStatus === "ADJUSTED" && !existingData.gst_adjusted_at) {
        updates.gst_adjusted_at = nowIso;
      }

      transaction.update(docRef, updates);

      const eventType =
        gstReportingStatus === "ADJUSTED"
          ? "CREDIT_NOTE_TAX_ADJUSTMENT_CONFIRMED"
          : gstReportingStatus === "REPORTED"
          ? "CREDIT_NOTE_GST_REPORTED"
          : "CREDIT_NOTE_REPORTING_STATUS_UPDATED";

      const auditRef = adminDb.collection("admin_audit_logs").doc();
      transaction.set(auditRef, {
        event_type: eventType,
        action: "UPDATE_GST_REPORTING_STATUS",
        credit_note_id: creditNoteId,
        credit_note_number: existingData.credit_note_number,
        previous_reporting_status: existingData.gst_reporting_status,
        new_reporting_status: gstReportingStatus,
        tax_liability_adjusted: isAdjusted,
        gst_reporting_period: updates.gst_reporting_period,
        gst_adjustment_reference: updates.gst_adjustment_reference,
        updated_by: updatedBy,
        timestamp: nowIso
      });

      updatedNote = {
        ...existingData,
        ...updates
      };
    });

    return {
      success: true,
      creditNote: updatedNote!
    };
  } catch (err: any) {
    console.error(`Error updating GST reporting status for Credit Note '${creditNoteId}':`, err);
    return {
      success: false,
      error: err.message || "Failed to update GST reporting status."
    };
  }
}
