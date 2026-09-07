import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearProductTaxMaster,
  registerProductTaxMetadata,
  lookupProductTaxMetadata,
  getTaxCoverageSummary,
  initDefaultTaxMasterStore,
  normalizeTaxClass
} from '../invoice/productTaxMaster';
import { buildGstInvoiceData } from '../invoice/invoiceCalculation';
import { calculateCreditNoteData } from '../invoice/creditNoteCalculation';
import { SellerTaxConfig } from '../invoice/sellerTaxConfig';

const mockSellerConfig: SellerTaxConfig = {
  legal_name: 'Sa and Sha Enterprise Private Limited',
  trade_name: 'Sa and Sha',
  gstin: '27AAACK1234A1Z5',
  pan: 'AAACK1234A',
  state: 'Maharashtra',
  state_code: '27',
  city: 'Mumbai',
  address_line_1: 'Building A, Commercial Complex',
  address_line_2: 'Nariman Point',
  pincode: '400001',
  country: 'India',
  support_email: 'support@saandsha.com',
  support_phone: '+91 98765 43210',
  invoice_prefix: 'KL',
  financial_year: '26-27',
  is_active: true,
  status: 'ACTIVE'
};

describe('Phase 10.5D.3A.5 — Tax Class Decoupling Foundation Tests', () => {
  beforeEach(() => {
    clearProductTaxMaster();
  });

  it('1. Normalizes tax_class into canonical format', () => {
    expect(normalizeTaxClass('mens_woven_shirt')).toBe('mens_woven_shirt');
    expect(normalizeTaxClass('Mens-Woven-Shirt ')).toBe('mens_woven_shirt');
    expect(normalizeTaxClass('MENS WOVEN SHIRT')).toBe('mens_woven_shirt');
    expect(normalizeTaxClass('')).toBe('');
  });

  it('2. Strict Precedence Hierarchy: SKU > PRODUCT > TAX_CLASS > CATEGORY > DEFAULT', () => {
    // Register Default Rule (5%)
    registerProductTaxMetadata({
      tax_record_id: 'rule_default',
      scope_type: 'DEFAULT',
      scope_value: 'DEFAULT',
      hsn_code: '9999',
      gst_rate: 5,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    // Register Category Rule (12%)
    registerProductTaxMetadata({
      tax_record_id: 'rule_category_shirts',
      scope_type: 'CATEGORY',
      scope_value: 'TOPS_SHIRTS',
      hsn_code: '6205',
      gst_rate: 12,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    // Register Tax Class Rule (18%)
    registerProductTaxMetadata({
      tax_record_id: 'rule_tax_class_apparel',
      scope_type: 'TAX_CLASS',
      scope_value: 'mens_woven_shirt',
      hsn_code: '6205',
      gst_rate: 18,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    // Register Product ID Rule (28%)
    registerProductTaxMetadata({
      tax_record_id: 'rule_product_p1',
      scope_type: 'PRODUCT',
      scope_value: 'prod_101',
      hsn_code: '6205',
      gst_rate: 28,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    // Register SKU Rule (0%)
    registerProductTaxMetadata({
      tax_record_id: 'rule_sku_s1',
      scope_type: 'SKU',
      scope_value: 'sku_101_blue',
      hsn_code: '6205',
      gst_rate: 0,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    // Case A: Full match -> SKU wins (0%)
    const resA = lookupProductTaxMetadata({
      sku: 'sku_101_blue',
      product_id: 'prod_101',
      tax_class: 'mens_woven_shirt',
      category: 'shirts'
    });
    expect(resA.success).toBe(true);
    expect(resA.metadata?.resolved_scope).toBe('SKU');
    expect(resA.metadata?.gst_rate).toBe(0);

    // Case B: Without SKU -> Product ID wins (28%)
    const resB = lookupProductTaxMetadata({
      sku: 'sku_other',
      product_id: 'prod_101',
      tax_class: 'mens_woven_shirt',
      category: 'shirts'
    });
    expect(resB.success).toBe(true);
    expect(resB.metadata?.resolved_scope).toBe('PRODUCT');
    expect(resB.metadata?.gst_rate).toBe(28);

    // Case C: Without Product ID / SKU -> Tax Class wins (18%)
    const resC = lookupProductTaxMetadata({
      sku: 'sku_other',
      product_id: 'prod_other',
      tax_class: 'mens_woven_shirt',
      category: 'shirts'
    });
    expect(resC.success).toBe(true);
    expect(resC.metadata?.resolved_scope).toBe('TAX_CLASS');
    expect(resC.metadata?.gst_rate).toBe(18);

    // Case D: Without Tax Class -> Category wins (12%)
    const resD = lookupProductTaxMetadata({
      sku: 'sku_other',
      product_id: 'prod_other',
      category: 'shirts'
    });
    expect(resD.success).toBe(true);
    expect(resD.metadata?.resolved_scope).toBe('CATEGORY');
    expect(resD.metadata?.gst_rate).toBe(12);

    // Case E: Without Category -> Default wins (5%)
    const resE = lookupProductTaxMetadata({
      sku: 'sku_other',
      product_id: 'prod_other',
      category: 'unknown_misc'
    });
    expect(resE.success).toBe(true);
    expect(resE.metadata?.resolved_scope).toBe('DEFAULT');
    expect(resE.metadata?.gst_rate).toBe(5);
  });

  it('3. Existing product with tax_class = undefined falls through safely without breaking', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_pants',
      scope_type: 'CATEGORY',
      scope_value: 'TROUSERS',
      hsn_code: '6203',
      gst_rate: 12,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    const res = lookupProductTaxMetadata({
      product_id: 'pants_99',
      sku: 'SKU-PANTS-99',
      category: 'pants'
      // tax_class is undefined
    });

    expect(res.success).toBe(true);
    expect(res.metadata?.resolved_scope).toBe('CATEGORY');
    expect(res.metadata?.hsn_code).toBe('6203');
    expect(res.metadata?.gst_rate).toBe(12);
  });

  it('4. Tax class does NOT infer HSN or GST rate implicitly and fails closed if no rule matches', () => {
    // Store is empty (no default rule, no tax class rule)
    const res = lookupProductTaxMetadata({
      product_id: 'prod_custom',
      sku: 'SKU-CUSTOM',
      tax_class: 'mens_woven_shirt'
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
  });

  it('5. Invoice calculation records tax_class and tax_rule_scope in line items', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_tc_kurta',
      scope_type: 'TAX_CLASS',
      scope_value: 'mens_kurta',
      hsn_code: '6205',
      gst_rate: 12,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-TC-001',
      order_number: 'KL-ORD-TC-001',
      order_date: '2026-05-10T10:00:00Z',
      customer_name: 'Vikram Mehta',
      email: 'vikram@example.com',
      phone: '9876543210',
      state: 'Maharashtra',
      items: [
        {
          id: 'k1',
          name: 'Classic Linen Kurta',
          sku: 'KL-KURTA-01',
          quantity: 1,
          price: 2499,
          tax_class: 'mens_kurta'
        }
      ],
      grand_total: 2499
    };

    const invoiceRes = buildGstInvoiceData(order, { sellerConfig: mockSellerConfig });
    expect(invoiceRes.success).toBe(true);
    if (invoiceRes.success) {
      const line = invoiceRes.invoice.line_items[0];
      expect(line.tax_class).toBe('mens_kurta');
      expect(line.tax_rule_scope).toBe('TAX_CLASS');
      expect(line.tax_record_id).toBe('rule_tc_kurta');
      expect(line.hsn_code).toBe('6205');
      expect(line.gst_rate).toBe(12);
    }
  });

  it('6. Credit notes preserve original invoice tax snapshot and never re-resolve new Tax Master rules', () => {
    // Step 1: Create invoice under 5% Category rule
    registerProductTaxMetadata({
      tax_record_id: 'old_cat_rule',
      scope_type: 'CATEGORY',
      scope_value: 'TOPS_SHIRTS',
      hsn_code: '6205',
      gst_rate: 5,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-HIST-01',
      order_number: 'KL-ORD-HIST-01',
      order_date: '2026-04-01T10:00:00Z',
      customer_name: 'Rahul Sharma',
      email: 'rahul@example.com',
      phone: '9876543210',
      state: 'Maharashtra',
      items: [
        {
          id: 'shirt_1',
          name: 'Linen Shirt',
          sku: 'KL-SHIRT-01',
          quantity: 2,
          price: 2000,
          category: 'shirts'
        }
      ],
      grand_total: 4000
    };

    const invoiceRes = buildGstInvoiceData(order, { sellerConfig: mockSellerConfig });
    expect(invoiceRes.success).toBe(true);
    if (!invoiceRes.success) return;

    const finalizedInvoice = {
      ...invoiceRes.invoice,
      invoice_id: 'inv_hist_01',
      invoice_number: 'KL/2026-27/001'
    };

    // Step 2: Now change the Tax Master drastically (e.g. register high-precedence TAX_CLASS with 18%)
    clearProductTaxMaster();
    registerProductTaxMetadata({
      tax_record_id: 'new_tc_rule_18',
      scope_type: 'TAX_CLASS',
      scope_value: 'mens_woven_shirt',
      hsn_code: '6205',
      gst_rate: 18,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    // Step 3: Issue Credit Note for 1 unit of original invoice
    const cnRes = calculateCreditNoteData({
      originalInvoice: finalizedInvoice as any,
      reason: 'GOODS_RETURNED',
      itemsToCredit: [
        {
          line_id: finalizedInvoice.line_items[0].line_id,
          sku: 'KL-SHIRT-01',
          quantity: 1
        }
      ]
    });

    expect(cnRes.success).toBe(true);
    if (cnRes.success) {
      const cnLine = cnRes.creditNoteData.line_items[0];
      // Credit note MUST mirror original invoice's 5% GST snapshot and not re-resolve to 18%
      expect(cnLine.gst_rate).toBe(5);
      expect(cnLine.hsn_code).toBe('6205');
      expect(cnLine.credited_quantity).toBe(1);
      expect(cnLine.credited_gross_amount).toBe(2000);
      expect(cnLine.taxable_value_reversal).toBe(Math.round((2000 / 1.05) * 100) / 100);
    }
  });

  it('7. Tax coverage summary accurately tallies covered_by_tax_class', () => {
    registerProductTaxMetadata({
      tax_record_id: 'tc_shirts',
      scope_type: 'TAX_CLASS',
      scope_value: 'mens_woven_shirt',
      hsn_code: '6205',
      gst_rate: 12,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    const sampleCatalog = [
      { id: 'p1', sku: 'SKU1', name: 'Shirt 1', category: 'shirts', price: 2000, tax_class: 'mens_woven_shirt' },
      { id: 'p2', sku: 'SKU2', name: 'Shirt 2', category: 'shirts', price: 2500, tax_class: 'mens_woven_shirt' },
      { id: 'p3', sku: 'SKU3', name: 'Pants 1', category: 'pants', price: 3000 } // uncovered
    ];

    const summary = getTaxCoverageSummary(sampleCatalog);
    expect(summary.total_products).toBe(3);
    expect(summary.covered_by_tax_class).toBe(2);
    expect(summary.covered_products).toBe(2);
    expect(summary.uncovered_products).toBe(1);
    expect(summary.details.find(d => d.product_id === 'p1')?.resolved_scope).toBe('TAX_CLASS');
  });
});
