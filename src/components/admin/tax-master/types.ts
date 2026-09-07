export type TaxRuleScope = 'CATEGORY' | 'PRODUCT' | 'SKU' | 'TAX_CLASS' | 'DEFAULT';
export type TaxRateMode = 'FIXED' | 'VALUE_BAND';

export interface TaxValueBand {
  min_price: number;
  max_price: number | null; // null represents "Above min_price" / Infinity
  gst_rate: number;
}

export interface ProductTaxRecord {
  tax_record_id: string;
  scope_type?: TaxRuleScope;
  scope_value?: string;
  sku?: string;
  product_id?: string;
  tax_class?: string;
  category?: string;
  tax_category?: string;
  product_name_snapshot?: string;
  hsn_code: string;
  description?: string;
  rate_mode?: TaxRateMode;
  gst_rate?: number;
  value_bands?: TaxValueBand[];
  effective_from: string;
  effective_to?: string | null;
  status: 'ACTIVE' | 'SUPERSEDED' | 'INACTIVE' | 'DRAFT';
  source?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TaxCoverageDetailItem {
  product_id: string;
  sku: string;
  name: string;
  category: string;
  tax_class?: string;
  price: number;
  status: 'COVERED' | 'MISSING' | 'AMBIGUOUS';
  resolved_scope?: TaxRuleScope;
  hsn_code?: string;
  gst_rate?: number;
  error?: string;
}

export interface TaxCoverageSummary {
  total_products: number;
  covered_products: number;
  uncovered_products: number;
  coverage_percentage: number;
  covered_by_sku: number;
  covered_by_product: number;
  covered_by_tax_class?: number;
  covered_by_category: number;
  covered_by_default: number;
  missing: number;
  ambiguous: number;
  details: TaxCoverageDetailItem[];
}
