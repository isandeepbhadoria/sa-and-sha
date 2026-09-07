import { GstInvoice, GstInvoiceLineItem } from "./invoiceTypes";
import {
  GstCreditNote,
  GstCreditNoteLineItem,
  CreditNoteReason,
  GstAdjustmentEligibility,
  GstReportingStatus
} from "./creditNoteTypes";
import { round2 } from "./invoiceCalculation";

/**
/ * Calculates standard Indian Financial Year (e.g., "2026-27") from an ISO date string.
 */
export function calculateFinancialYear(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1..12
  const startYear = month < 4 ? year - 1 : year;
  const endYearShort = String(startYear + 1).slice(-2);
  return `${startYear}-${endYearShort}`;
}

/**
 * Calculates statutory GST output tax liability adjustment deadline under amended Section 34(2) CGST Act.
 * Deadline is 30th November following the end of the financial year in which the original supply (invoice) was made.
 */
export function calculateGstAdjustmentDeadline(originalInvoiceIssueDate: string): string {
  const d = new Date(originalInvoiceIssueDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const fyEndYear = month >= 4 ? year + 1 : year;
  return `${fyEndYear}-11-30`;
}

export interface CalculateCreditNoteDataParams {
  originalInvoice: GstInvoice;
  itemsToCredit: Array<{
    line_id?: string;
    sku?: string;
    product_id?: string;
    quantity: number;
  }>;
  creditShipping?: boolean;
  reason: CreditNoteReason;
  reasonDetails?: string | null;
  creditNoteNumber?: string;
  issueDate?: string;
  createdBy?: string;
  rmaNumber?: string | null;
  returnRequestId?: string | null;
  idempotencyKey?: string | null;
}

export type CalculateCreditNoteDataResult =
  | { success: true; creditNoteData: Omit<GstCreditNote, "credit_note_id" | "credit_note_number"> & { credit_note_number?: string } }
  | { success: false; code: string; error: string; details?: any };

/**
 * Derives a deterministic GST Credit Note strictly from the original finalized GST invoice snapshot.
 * Reverses taxes using original line-level rates, HSN, POS, and customer classification.
 */
export function calculateCreditNoteData(
  params: CalculateCreditNoteDataParams
): CalculateCreditNoteDataResult {
  const {
    originalInvoice,
    itemsToCredit,
    creditShipping = false,
    reason,
    reasonDetails,
    creditNoteNumber,
    createdBy = "system",
    rmaNumber,
    returnRequestId,
    idempotencyKey
  } = params;

  if (!originalInvoice || !originalInvoice.invoice_id) {
    return {
      success: false,
      code: "ORIGINAL_INVOICE_REQUIRED",
      error: "Original finalized GST invoice is required to calculate credit note."
    };
  }

  if ((!itemsToCredit || itemsToCredit.length === 0) && !creditShipping) {
    return {
      success: false,
      code: "NO_ITEMS_TO_CREDIT",
      error: "Must specify at least one line item or shipping credit to calculate credit note."
    };
  }

  const line_items: GstCreditNoteLineItem[] = [];
  let subtotal_reversal = 0;
  let discount_total_reversal = 0;
  let taxable_total_reversal = 0;
  let cgst_total_reversal = 0;
  let sgst_total_reversal = 0;
  let igst_total_reversal = 0;

  // Reversals for each item
  for (const reqItem of itemsToCredit || []) {
    if (!reqItem.quantity || reqItem.quantity <= 0) continue;

    const origLine = originalInvoice.line_items.find(
      (l) =>
        (reqItem.line_id && l.line_id === reqItem.line_id) ||
        (reqItem.sku && l.sku.toLowerCase() === reqItem.sku.toLowerCase()) ||
        (reqItem.product_id && l.product_id === reqItem.product_id)
    );

    if (!origLine) {
      return {
        success: false,
        code: "ITEM_NOT_IN_INVOICE",
        error: `Item '${reqItem.sku || reqItem.line_id || reqItem.product_id}' not found in original invoice line items.`
      };
    }

    const creditedQty = reqItem.quantity;
    if (creditedQty > origLine.quantity) {
      return {
        success: false,
        code: "CREDIT_QTY_EXCEEDS_ORIGINAL",
        error: `Credited quantity (${creditedQty}) exceeds original line quantity (${origLine.quantity}) for SKU '${origLine.sku}'.`
      };
    }

    const fraction = creditedQty / origLine.quantity;
    const creditedGross = round2(origLine.gross_amount * fraction);
    const creditedDiscount = round2(origLine.line_discount * fraction);
    const netGross = Math.max(0, creditedGross - creditedDiscount);

    // Calculate taxable value reversal based on original line tax treatment
    // Original line formula: taxable_value = lineNetGross / (1 + gst_rate / 100)
    const taxableValueReversal = round2(netGross / (1 + origLine.gst_rate / 100));

    let cgstReversal = 0;
    let sgstReversal = 0;
    let igstReversal = 0;

    if (originalInvoice.supply_type === "INTRASTATE") {
      const halfTax = round2((taxableValueReversal * (origLine.gst_rate / 2)) / 100);
      cgstReversal = halfTax;
      sgstReversal = halfTax;
    } else {
      igstReversal = round2((taxableValueReversal * origLine.gst_rate) / 100);
    }

    const lineTotalReversal = round2(taxableValueReversal + cgstReversal + sgstReversal + igstReversal);

    line_items.push({
      line_id: origLine.line_id,
      product_id: origLine.product_id,
      sku: origLine.sku,
      product_name: origLine.product_name,
      variant: origLine.variant,
      original_quantity: origLine.quantity,
      credited_quantity: creditedQty,
      unit_price: origLine.unit_price,
      original_gross_amount: origLine.gross_amount,
      original_line_discount: origLine.line_discount,
      credited_gross_amount: creditedGross,
      credited_line_discount: creditedDiscount,
      taxable_value_reversal: taxableValueReversal,
      hsn_code: origLine.hsn_code,
      gst_rate: origLine.gst_rate,
      cgst_rate: origLine.cgst_rate,
      cgst_reversal: cgstReversal,
      sgst_rate: origLine.sgst_rate,
      sgst_reversal: sgstReversal,
      igst_rate: origLine.igst_rate,
      igst_reversal: igstReversal,
      line_total_reversal: lineTotalReversal
    });

    subtotal_reversal += creditedGross;
    discount_total_reversal += creditedDiscount;
    taxable_total_reversal += taxableValueReversal;
    cgst_total_reversal += cgstReversal;
    sgst_total_reversal += sgstReversal;
    igst_total_reversal += igstReversal;
  }

  // Shipping Reversal
  let shipping_sac: string | undefined = undefined;
  let shipping_gst_rate: number | undefined = undefined;
  let shipping_taxable_reversal = 0;
  let shipping_cgst_reversal = 0;
  let shipping_sgst_reversal = 0;
  let shipping_igst_reversal = 0;
  let shipping_tax_reversal = 0;
  let shipping_total_reversal = 0;

  if (creditShipping && (originalInvoice.shipping_taxable > 0 || originalInvoice.shipping_total > 0)) {
    const origShippingSac = originalInvoice.shipping_sac || (originalInvoice as any).shipping_tax_config?.hsn_or_sac_code || (originalInvoice as any).shipping_snapshot?.sac_code || (originalInvoice as any).shipping_snapshot?.hsn_or_sac_code;
    const origShippingGstRate = originalInvoice.shipping_gst_rate ?? (originalInvoice as any).shipping_tax_config?.gst_rate ?? (originalInvoice as any).shipping_snapshot?.gst_rate;

    if (!origShippingSac || origShippingGstRate === undefined || origShippingGstRate === null) {
      return {
        success: false,
        code: "CREDIT_NOTE_SHIPPING_TAX_SNAPSHOT_MISSING",
        error: "Original finalized invoice is missing historical shipping tax metadata (shipping SAC or GST rate) required for shipping tax reversal."
      };
    }

    shipping_sac = origShippingSac;
    shipping_gst_rate = origShippingGstRate;
    shipping_taxable_reversal = originalInvoice.shipping_taxable;
    shipping_tax_reversal = originalInvoice.shipping_tax;
    shipping_total_reversal = originalInvoice.shipping_total;

    if (originalInvoice.supply_type === "INTRASTATE") {
      const halfShipTax = round2(shipping_tax_reversal / 2);
      shipping_cgst_reversal = halfShipTax;
      shipping_sgst_reversal = halfShipTax;
      cgst_total_reversal += halfShipTax;
      sgst_total_reversal += halfShipTax;
    } else {
      shipping_igst_reversal = shipping_tax_reversal;
      igst_total_reversal += shipping_tax_reversal;
    }
  }

  const tax_total_reversal = round2(cgst_total_reversal + sgst_total_reversal + igst_total_reversal);
  subtotal_reversal = round2(subtotal_reversal);
  discount_total_reversal = round2(discount_total_reversal);
  taxable_total_reversal = round2(taxable_total_reversal);

  const rawReversalTotal = round2(taxable_total_reversal + shipping_taxable_reversal + tax_total_reversal);

  // Check if this is a FULL return matching all original invoice items & shipping
  const isFullReturn =
    originalInvoice.line_items.every((origL) => {
      const creditedL = line_items.find((c) => c.line_id === origL.line_id || c.sku === origL.sku);
      return creditedL && creditedL.credited_quantity === origL.quantity;
    }) &&
    (!originalInvoice.shipping_taxable || creditShipping);

  let round_off_reversal = 0;
  let grand_total_reversal = 0;

  if (isFullReturn) {
    // For full return, grand_total_reversal matches original invoice grand_total exactly
    grand_total_reversal = originalInvoice.grand_total;
    round_off_reversal = round2(grand_total_reversal - rawReversalTotal);
  } else {
    // For partial return, round to nearest rupee or keep exact fractional sum
    grand_total_reversal = round2(rawReversalTotal);
    round_off_reversal = 0;
  }

  // Verification: taxable + shipping + taxes + round_off MUST equal grand_total_reversal exactly
  const reconciledSum = round2(taxable_total_reversal + shipping_taxable_reversal + tax_total_reversal + round_off_reversal);
  if (Math.abs(reconciledSum - grand_total_reversal) > 0.01) {
    return {
      success: false,
      code: "CREDIT_NOTE_RECONCILIATION_FAILED",
      error: `Credit note totals fail to reconcile. Reconciled: ₹${reconciledSum}, Grand Total Reversal: ₹${grand_total_reversal}.`
    };
  }

  const nowIso = params.issueDate || new Date().toISOString();
  const cnFinancialYear = calculateFinancialYear(nowIso);
  const origInvoiceDate = originalInvoice.invoice_date || originalInvoice.created_at || nowIso;
  const gstAdjustmentDeadline = calculateGstAdjustmentDeadline(origInvoiceDate);

  const issueDateDateStr = nowIso.substring(0, 10);
  const isExpired = issueDateDateStr > gstAdjustmentDeadline;
  const gstAdjustmentEligibility: GstAdjustmentEligibility = isExpired ? "DEADLINE_EXPIRED" : "ELIGIBLE";
  const gstReportingStatus: GstReportingStatus = isExpired ? "NOT_ELIGIBLE_FOR_ADJUSTMENT" : "NOT_REPORTED";

  return {
    success: true,
    creditNoteData: {
      credit_note_number: creditNoteNumber,
      original_invoice_id: originalInvoice.invoice_id,
      original_invoice_number: originalInvoice.invoice_number,
      original_invoice_date: origInvoiceDate,
      order_id: originalInvoice.order_id,
      order_number: originalInvoice.order_number,
      rma_number: rmaNumber || null,
      return_request_id: returnRequestId || null,
      reason,
      reason_details: reasonDetails || null,
      issue_date: nowIso,
      financial_year: cnFinancialYear,
      currency: "INR",
      seller_snapshot: originalInvoice.seller_snapshot,
      buyer_snapshot: originalInvoice.buyer_snapshot,
      shipping_snapshot: originalInvoice.shipping_snapshot,
      billing_snapshot: originalInvoice.billing_snapshot,
      place_of_supply: originalInvoice.place_of_supply,
      place_of_supply_state_code: originalInvoice.place_of_supply_state_code,
      supply_type: originalInvoice.supply_type,
      line_items: line_items,
      subtotal_reversal,
      discount_total_reversal,
      taxable_total_reversal,
      cgst_total_reversal: round2(cgst_total_reversal),
      sgst_total_reversal: round2(sgst_total_reversal),
      igst_total_reversal: round2(igst_total_reversal),
      tax_total_reversal,
      shipping_sac,
      shipping_gst_rate,
      shipping_taxable_reversal,
      shipping_cgst_reversal,
      shipping_sgst_reversal,
      shipping_igst_reversal,
      shipping_tax_reversal,
      shipping_total_reversal,
      round_off_reversal,
      grand_total_reversal,
      status: "ISSUED",
      customer_id: originalInvoice.customer_id,
      customer_profile_id: originalInvoice.customer_profile_id,
      gst_customer_type: originalInvoice.gst_customer_type,

      // GST Reporting & Tax Adjustment Metadata (Phase 10.5B.2)
      tax_liability_adjusted: false, // MUST default to false on creation
      gst_reporting_status: gstReportingStatus,
      gst_adjustment_eligibility: gstAdjustmentEligibility,
      gst_adjustment_deadline: gstAdjustmentDeadline,
      gst_reporting_period: null,
      gst_reported_at: null,
      gst_adjusted_at: null,
      gst_adjustment_reference: null,

      // E-Invoice Status
      e_invoice_status: "NOT_APPLICABLE",
      irn: null,
      ack_number: null,
      ack_date: null,

      created_at: nowIso,
      created_by: createdBy,
      version: 1,
      pdf_status: "NOT_GENERATED",
      pdf_generated_at: null,
      pdf_storage_reference: null,
      immutable: true,
      idempotency_key: idempotencyKey || null
    }
  };
}
