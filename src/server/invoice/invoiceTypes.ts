export type InvoiceType = "TAX_INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE" | "CANCELLED_INVOICE";
export type InvoiceStatus = "DRAFT" | "FINALIZED" | "CANCELLED";
export type GstCustomerType = "B2C" | "B2B";

export interface GstInvoiceSellerSnapshot {
  legal_name: string;
  trade_name: string;
  gstin: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  pan: string;
  support_email: string;
  support_phone: string;
}

export interface GstInvoiceBuyerSnapshot {
  customer_id: string;
  customer_type: "INDIVIDUAL" | "BUSINESS";
  first_name?: string;
  last_name?: string;
  full_name: string;
  email: string;
  phone: string;
  gstin?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  gst_verified: boolean;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
}

export interface GstInvoiceAddressSnapshot {
  first_name?: string;
  last_name?: string;
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  gstin?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  is_same_as_shipping?: boolean;
}

export interface GstInvoiceLineItem {
  line_id: string;
  product_id: string;
  sku: string;
  product_name: string;
  variant: string;
  quantity: number;
  unit_price: number;
  gross_amount: number;
  line_discount: number;
  taxable_value: number;
  hsn_code: string;
  gst_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  line_total: number;
  net_amount?: number;
  unit_transaction_value?: number;
  tax_record_id?: string;
  tax_config_version?: string;
  tax_rule_scope?: string;
  tax_class?: string;
}

export interface GstInvoice {
  invoice_id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  status: InvoiceStatus;
  order_id: string;
  order_number: string;
  invoice_date: string;
  financial_year: string;
  currency: string;
  seller_snapshot: GstInvoiceSellerSnapshot;
  buyer_snapshot: GstInvoiceBuyerSnapshot;
  shipping_snapshot: GstInvoiceAddressSnapshot;
  billing_snapshot: GstInvoiceAddressSnapshot;
  place_of_supply: string;
  place_of_supply_state_code: string;
  supply_type: "INTRASTATE" | "INTERSTATE";
  line_items: GstInvoiceLineItem[];
  subtotal: number;
  discount_total: number;
  taxable_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  tax_total: number;
  shipping_taxable: number;
  shipping_tax: number;
  shipping_total: number;
  shipping_sac?: string;
  shipping_gst_rate?: number;
  round_off: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  customer_id: string;
  customer_profile_id: string | null;
  gst_customer_type: GstCustomerType;
  created_at: string;
  created_by: string;
  version: number;
  pdf_status: "NOT_GENERATED" | "GENERATED";
  pdf_generated_at: string | null;
  pdf_storage_reference: string | null;
  immutable: boolean;
  finalized_at?: string;
  finalized_trigger?: string;
  finalized_by?: string;
}
