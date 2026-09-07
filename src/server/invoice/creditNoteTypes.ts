import {
  GstInvoiceSellerSnapshot,
  GstInvoiceBuyerSnapshot,
  GstInvoiceAddressSnapshot,
  GstCustomerType
} from "./invoiceTypes";

export type CreditNoteReason =
  | "GOODS_RETURNED"
  | "ORDER_CANCELLED"
  | "PARTIAL_RETURN"
  | "PRICE_ADJUSTMENT"
  | "OTHER";

export type CreditNoteStatus = "ISSUED" | "CANCELLED";

export type GstReportingStatus =
  | "NOT_REPORTED"
  | "REPORTED"
  | "ADJUSTED"
  | "NOT_ELIGIBLE_FOR_ADJUSTMENT";

export type GstAdjustmentEligibility =
  | "ELIGIBLE"
  | "DEADLINE_EXPIRED"
  | "REQUIRES_REVIEW";

export interface GstCreditNoteLineItem {
  line_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  variant: string;
  original_quantity: number;
  credited_quantity: number;
  unit_price: number;
  original_gross_amount: number;
  original_line_discount: number;
  credited_gross_amount: number;
  credited_line_discount: number;
  taxable_value_reversal: number;
  hsn_code: string;
  gst_rate: number;
  cgst_rate: number;
  cgst_reversal: number;
  sgst_rate: number;
  sgst_reversal: number;
  igst_rate: number;
  igst_reversal: number;
  line_total_reversal: number;
}

export interface GstCreditNote {
  credit_note_id: string;
  credit_note_number: string;
  original_invoice_id: string;
  original_invoice_number: string;
  original_invoice_date?: string | null;
  order_id: string;
  order_number: string;
  rma_number?: string | null;
  return_request_id?: string | null;
  reason: CreditNoteReason;
  reason_details?: string | null;
  issue_date: string;
  financial_year: string;
  currency: string;
  seller_snapshot: GstInvoiceSellerSnapshot;
  buyer_snapshot: GstInvoiceBuyerSnapshot;
  shipping_snapshot: GstInvoiceAddressSnapshot;
  billing_snapshot: GstInvoiceAddressSnapshot;
  place_of_supply: string;
  place_of_supply_state_code: string;
  supply_type: "INTRASTATE" | "INTERSTATE";
  line_items: GstCreditNoteLineItem[];
  subtotal_reversal: number;
  discount_total_reversal: number;
  taxable_total_reversal: number;
  cgst_total_reversal: number;
  sgst_total_reversal: number;
  igst_total_reversal: number;
  tax_total_reversal: number;
  shipping_sac?: string;
  shipping_gst_rate?: number;
  shipping_taxable_reversal: number;
  shipping_cgst_reversal?: number;
  shipping_sgst_reversal?: number;
  shipping_igst_reversal?: number;
  shipping_tax_reversal: number;
  shipping_total_reversal: number;
  round_off_reversal: number;
  grand_total_reversal: number;
  status: CreditNoteStatus;
  customer_id: string;
  customer_profile_id: string | null;
  gst_customer_type: GstCustomerType;

  // GST Reporting & Tax Adjustment Metadata (Phase 10.5B.2)
  tax_liability_adjusted: boolean; // MUST default to false
  gst_reporting_status: GstReportingStatus; // MUST default to NOT_REPORTED
  gst_adjustment_eligibility: GstAdjustmentEligibility; // ELIGIBLE | DEADLINE_EXPIRED | REQUIRES_REVIEW
  gst_adjustment_deadline: string; // Statutory cutoff date YYYY-MM-DD under CGST Act Sec 34(2)
  gst_reporting_period?: string | null;
  gst_reported_at?: string | null;
  gst_adjusted_at?: string | null;
  gst_adjustment_reference?: string | null;

  // E-Invoice Status
  e_invoice_status: "NOT_APPLICABLE" | "PENDING" | "GENERATED" | "FAILED";
  irn?: string | null;
  ack_number?: string | null;
  ack_date?: string | null;

  created_at: string;
  created_by: string;
  version: number;
  pdf_status: "NOT_GENERATED" | "GENERATED";
  pdf_generated_at: string | null;
  pdf_storage_reference: string | null;
  immutable: boolean;
  idempotency_key?: string | null;
}
