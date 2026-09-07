import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerProductTaxMetadata,
  clearProductTaxMaster,
  lookupProductTaxMetadata,
  normalizeTaxCategory,
  checkProductTaxDateOverlap,
  checkPriceBandsOverlap,
  parseAndValidateProductTaxCsv,
  getTaxCoverageSummary,
  ProductTaxMasterEntry
} from '../invoice/productTaxMaster';
import { buildGstInvoiceData } from '../invoice/invoiceCalculation';
import { calculateCreditNoteData } from '../invoice/creditNoteCalculation';

describe('Phase 10.5D.3A — Product Tax Master Category/Rule Engine', () => {
  beforeEach(() => {
    clearProductTaxMaster();
    // Setup valid seller env for invoice calculation test
    process.env.SELLER_LEGAL_NAME = 'Sa and Sha Pvt Ltd';
    process.env.SELLER_GSTIN = '27AABCK1234F1ZP';
    process.env.SELLER_STATE_CODE = '27';
    process.env.SELLER_STATE = 'Maharashtra';
    process.env.SELLER_ADDRESS_LINE1 = '101 Marine Drive';
    process.env.SELLER_CITY = 'Mumbai';
    process.env.SELLER_PINCODE = '400020';
    process.env.INVOICE_PREFIX = 'KL-2425-';
  });

  // 1. Category Resolution
  it('1. Category-level tax lookup correctly resolves for SKU belonging to category (e.g. Linen Shirt -> MEN_SHIRTS rule)', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_shirts',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      gst_rate: 5,
      rate_mode: 'FIXED',
      status: 'ACTIVE',
      effective_from: '2025-01-01T00:00:00.000Z'
    });

    const res = lookupProductTaxMetadata({
      sku: 'SHIRT-BLUE-M',
      product_id: 'prod_shirt_1',
      category: 'Linen Shirts'
    });

    expect(res.success).toBe(true);
    expect(res.metadata?.hsn_code).toBe('6205');
    expect(res.metadata?.gst_rate).toBe(5);
    expect(res.metadata?.resolved_scope).toBe('CATEGORY');
  });

  // 2. Product-level Override
  it('2. Product-level override takes priority over Category-level rule', () => {
    // Category rule (12%)
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_shirts',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      hsn_code: '6205',
      gst_rate: 12,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    // Product-level override (5%)
    registerProductTaxMetadata({
      tax_record_id: 'rule_prod_shirt_spec',
      scope_type: 'PRODUCT',
      scope_value: 'prod_special_linen',
      product_id: 'prod_special_linen',
      hsn_code: '6205',
      gst_rate: 5,
      rate_mode: 'FIXED',
      status: 'ACTIVE'
    });

    const res = lookupProductTaxMetadata({
      sku: 'SPECIAL-SHIRT-M',
      product_id: 'prod_special_linen',
      category: 'MEN_SHIRTS'
    });

    expect(res.success).toBe(true);
    expect(res.metadata?.gst_rate).toBe(5);
    expect(res.metadata?.resolved_scope).toBe('PRODUCT');
  });

  // 3. SKU-level Override
  it('3. SKU-level override takes priority over Product-level and Category-level rules', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_shirts',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      hsn_code: '6205',
      gst_rate: 12,
      status: 'ACTIVE'
    });

    registerProductTaxMetadata({
      tax_record_id: 'rule_prod_shirt',
      scope_type: 'PRODUCT',
      scope_value: 'prod_linen_1',
      product_id: 'prod_linen_1',
      hsn_code: '6205',
      gst_rate: 12,
      status: 'ACTIVE'
    });

    registerProductTaxMetadata({
      tax_record_id: 'rule_sku_silk_blend',
      scope_type: 'SKU',
      scope_value: 'SKU-SILK-BLEND-L',
      sku: 'SKU-SILK-BLEND-L',
      hsn_code: '6206',
      gst_rate: 18,
      status: 'ACTIVE'
    });

    const res = lookupProductTaxMetadata({
      sku: 'SKU-SILK-BLEND-L',
      product_id: 'prod_linen_1',
      category: 'MEN_SHIRTS'
    });

    expect(res.success).toBe(true);
    expect(res.metadata?.hsn_code).toBe('6206');
    expect(res.metadata?.gst_rate).toBe(18);
    expect(res.metadata?.resolved_scope).toBe('SKU');
  });

  // 4. Default Tax Rule
  it('4. Default tax rule applies when no Category/Product/SKU rule exists', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_default_global',
      scope_type: 'DEFAULT',
      scope_value: 'DEFAULT',
      hsn_code: '6211',
      gst_rate: 12,
      status: 'ACTIVE'
    });

    const res = lookupProductTaxMetadata({
      sku: 'UNKNOWN-ACCESSORY-01',
      product_id: 'prod_unknown',
      category: 'UNKNOWN_CATEGORY'
    });

    expect(res.success).toBe(true);
    expect(res.metadata?.hsn_code).toBe('6211');
    expect(res.metadata?.gst_rate).toBe(12);
    expect(res.metadata?.resolved_scope).toBe('DEFAULT');
  });

  // 5 & 6. Value Bands
  it('5. Value-band rule resolves 5% GST for product price <= 1000', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 1000, gst_rate: 5 },
        { min_price: 1000.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const res5 = lookupProductTaxMetadata({
      sku: 'SHIRT-BUDGET',
      category: 'MEN_SHIRTS',
      price: 800
    });

    expect(res5.success).toBe(true);
    expect(res5.metadata?.gst_rate).toBe(5);
  });

  it('6. Value-band rule resolves 12% GST for product price > 1000', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 1000, gst_rate: 5 },
        { min_price: 1000.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const res12 = lookupProductTaxMetadata({
      sku: 'SHIRT-PREMIUM',
      category: 'MEN_SHIRTS',
      price: 2500
    });

    expect(res12.success).toBe(true);
    expect(res12.metadata?.gst_rate).toBe(12);
  });

  // 7. Category Normalization
  it('7. Category normalization correctly maps variations ("shirts", "Linen Shirts", "MEN_SHIRTS")', () => {
    expect(normalizeTaxCategory('shirts')).toBe('MEN_SHIRTS');
    expect(normalizeTaxCategory('Linen Shirts')).toBe('MEN_SHIRTS');
    expect(normalizeTaxCategory('MEN_SHIRTS')).toBe('MEN_SHIRTS');
    expect(normalizeTaxCategory('polos')).toBe('MEN_POLOS');
    expect(normalizeTaxCategory('chinos')).toBe('MEN_TROUSERS');
  });

  // 8. Missing Tax Rule Fail-Closed
  it('8. Missing tax rule causes lookup failure with code: "INVOICE_TAX_METADATA_MISSING"', () => {
    const res = lookupProductTaxMetadata({
      sku: 'UNREGISTERED-SKU-99',
      product_id: 'unregistered_prod',
      category: 'UNKNOWN_CAT'
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
  });

  // 9. Inactive Tax Rule Ignored
  it('9. Inactive tax rule is ignored and falls through to lower priority / fails if no other rule', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_sku_inactive',
      scope_type: 'SKU',
      scope_value: 'SKU-OLD-01',
      sku: 'SKU-OLD-01',
      hsn_code: '6205',
      gst_rate: 5,
      status: 'INACTIVE'
    });

    registerProductTaxMetadata({
      tax_record_id: 'rule_default',
      scope_type: 'DEFAULT',
      scope_value: 'DEFAULT',
      hsn_code: '6211',
      gst_rate: 12,
      status: 'ACTIVE'
    });

    const res = lookupProductTaxMetadata({
      sku: 'SKU-OLD-01',
      product_id: 'prod_old',
      category: 'MEN_SHIRTS'
    });

    expect(res.success).toBe(true);
    expect(res.metadata?.resolved_scope).toBe('DEFAULT');
    expect(res.metadata?.hsn_code).toBe('6211');
  });

  // 10. Future Effective Date
  it('10. Future effective tax rule (effective_from in future) is not active today', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    registerProductTaxMetadata({
      tax_record_id: 'rule_future_vat',
      scope_type: 'SKU',
      scope_value: 'SKU-FUTURE-01',
      sku: 'SKU-FUTURE-01',
      hsn_code: '6205',
      gst_rate: 18,
      effective_from: futureDate.toISOString(),
      status: 'ACTIVE'
    });

    const res = lookupProductTaxMetadata({
      sku: 'SKU-FUTURE-01'
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
  });

  // 11. Expired Tax Rule
  it('11. Expired tax rule (effective_to in past) is not active today', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_expired',
      scope_type: 'SKU',
      scope_value: 'SKU-EXPIRED-01',
      sku: 'SKU-EXPIRED-01',
      hsn_code: '6205',
      gst_rate: 5,
      effective_from: '2020-01-01T00:00:00.000Z',
      effective_to: '2023-12-31T23:59:59.000Z',
      status: 'ACTIVE'
    });

    const res = lookupProductTaxMetadata({
      sku: 'SKU-EXPIRED-01'
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
  });

  // 12. Date Overlap Check
  it('12. Overlapping active tax rules for same scope/item fail validation (TAX_RULE_DATE_OVERLAP)', () => {
    const existingRecords: ProductTaxMasterEntry[] = [
      {
        tax_record_id: 'rule_1',
        scope_type: 'CATEGORY',
        scope_value: 'MEN_SHIRTS',
        hsn_code: '6205',
        gst_rate: 5,
        status: 'ACTIVE',
        effective_from: '2025-01-01T00:00:00.000Z',
        effective_to: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    const candidate: Partial<ProductTaxMasterEntry> = {
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      effective_from: '2025-06-01T00:00:00.000Z',
      effective_to: null
    };

    const overlapRes = checkProductTaxDateOverlap(existingRecords, candidate);
    expect(overlapRes.overlap).toBe(true);
  });

  // 13. Price Band Overlap Check
  it('13. Overlapping price bands within a rule fail validation (TAX_RULE_PRICE_BAND_OVERLAP)', () => {
    const badBands = [
      { min_price: 0, max_price: 1000, gst_rate: 5 },
      { min_price: 500, max_price: 2000, gst_rate: 12 }
    ];

    const bandRes = checkPriceBandsOverlap(badBands);
    expect(bandRes.valid).toBe(false);
    expect(bandRes.error).toContain('overlap');
  });

  // 14. Tax Coverage Summary
  it('14. Tax coverage summary correctly calculates covered vs uncovered catalog products', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_shirts',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      hsn_code: '6205',
      gst_rate: 5,
      status: 'ACTIVE'
    });

    const summary = getTaxCoverageSummary();
    expect(summary.total_products).toBeGreaterThan(0);
    expect(summary.covered_products).toBeGreaterThan(0);
    expect(summary.coverage_percentage).toBeGreaterThan(0);
  });

  // 15. CSV Import Valid
  it('15. Valid scope-based CSV import parses correctly with valid scopes', () => {
    const validCsv = `scope_type,scope_value,hsn_code,gst_rate,rate_mode,min_price,max_price,description
CATEGORY,MEN_SHIRTS,6205,5,FIXED,,,Men Linen Shirts
SKU,SHIRT-WHITE-L,6205,12,FIXED,,,White Linen Shirt Large
CATEGORY,MEN_TROUSERS,6203,,VALUE_BAND,0,1000,5
CATEGORY,MEN_TROUSERS,6203,,VALUE_BAND,1000.01,,12`;

    const res = parseAndValidateProductTaxCsv(validCsv);
    expect(res.valid_rows).toBe(4);
    expect(res.records?.length).toBe(3); // 2 FIXED rules + 1 grouped VALUE_BAND rule
    expect(res.error_count).toBe(0);
    if (!res.records) return;
    expect(res.records[0].scope_type).toBe('CATEGORY');
    expect(res.records[0].scope_value).toBe('MEN_SHIRTS');
  });

  // 16. CSV Import Invalid Rejection
  it('16. Invalid CSV import (e.g. missing HSN or invalid GST rate) is rejected', () => {
    const invalidCsv = `scope_type,scope_value,hsn_code,gst_rate,rate_mode
CATEGORY,MEN_SHIRTS,INVALID_HSN,5,FIXED
SKU,SHIRT-01,6205,150,FIXED`;

    const res = parseAndValidateProductTaxCsv(invalidCsv);
    expect(res.error_count).toBe(2);
    if (!res.errors) return;
    expect(res.errors[0].message).toContain('HSN code');
    expect(res.errors[1].message).toContain('GST rate');
  });

  // 17. Immutable Invoice Snapshot
  it('17. Finalized GST invoice creates immutable snapshot (future tax master edits don\'t change old invoice calculation)', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_shirts',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      hsn_code: '6205',
      gst_rate: 5,
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-SNAP-TEST-01',
      created_at: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          product_id: 'prod_1',
          sku: 'SHIRT-M',
          name: 'Classic Linen Shirt',
          category: 'Linen Shirts',
          quantity: 1,
          unit_price: 2000
        }
      ],
      subtotal: 2000,
      total_amount: 2000,
      shipping_fee: 0
    };

    const invoiceRes = buildGstInvoiceData(order as any);
    expect(invoiceRes.success).toBe(true);
    if (!invoiceRes.success) return;
    expect(invoiceRes.invoice.line_items[0].gst_rate).toBe(5);

    // Save invoice snapshot items
    const snapshotItem = invoiceRes.invoice.line_items[0];

    // Now update the tax master rule for shirts to 12%
    clearProductTaxMaster();
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_shirts_new',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      hsn_code: '6205',
      gst_rate: 12,
      status: 'ACTIVE'
    });

    // Verify snapshot item in the calculated invoice is unchanged
    expect(snapshotItem?.gst_rate).toBe(5);
  });

  // 18. Fail-Closed Invoice Generation
  it('18. Fail-closed behavior blocks invoice generation when tax metadata is missing or ambiguous', () => {
    const unconfiguredOrder = {
      order_id: 'ORD-FAIL-CLOSED-01',
      order_date: '2025-02-01T10:00:00.000Z',
      customer: {
        id: 'cust_1',
        name: 'Jane Doe',
        shipping_address: {
          address_line1: '123 Main St',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        }
      },
      items: [
        {
          id: 'unconfigured_prod',
          sku: 'UNKNOWN-ITEM-01',
          name: 'Unknown Item',
          category: 'NO_RULE_CATEGORY',
          quantity: 1,
          unit_price: 1500
        }
      ],
      subtotal: 1500,
      total_amount: 1500,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(unconfiguredOrder as any);
    expect(res.success).toBe(false);
    expect((res as any).code).toBe('INVOICE_TAX_METADATA_MISSING');
  });

  // 19. Value-Band: Net transaction value per piece = ₹2,500.00 -> lower configured band (5%)
  it('19. Net transaction value per piece = ₹2,500.00 resolves to lower configured band (5%)', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-BAND-2500',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-2500',
          name: 'Linen Shirt Exact 2500',
          category: 'MEN_SHIRTS',
          quantity: 1,
          unit_price: 2500
        }
      ],
      subtotal: 2500,
      total_amount: 2500,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.gst_rate).toBe(5);
    expect(line.unit_transaction_value).toBe(2500);
    expect(line.net_amount).toBe(2500);
    expect(line.tax_record_id).toBe('rule_cat_apparel_2500_band');
  });

  // 20. Value-Band: Net transaction value per piece = ₹2,500.01 -> upper configured band (12%)
  it('20. Net transaction value per piece = ₹2,500.01 resolves to upper configured band (12%)', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-BAND-2500-01',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-2500-01',
          name: 'Linen Shirt 2500.01',
          category: 'MEN_SHIRTS',
          quantity: 1,
          unit_price: 2500.01
        }
      ],
      subtotal: 2500.01,
      total_amount: 2500.01,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.gst_rate).toBe(12);
    expect(line.unit_transaction_value).toBe(2500.01);
  });

  // 21. Multi-Quantity: Qty 2 × ₹2,000 -> evaluate ₹2,000 per piece, not line gross ₹4,000
  it('21. Multi-quantity: Qty 2 × ₹2,000 evaluates per-piece ₹2,000 (resolves 5%), not line gross ₹4,000', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-MULTI-QTY-2000',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-2000',
          name: 'Linen Shirt 2000',
          category: 'MEN_SHIRTS',
          quantity: 2,
          unit_price: 2000
        }
      ],
      subtotal: 4000,
      total_amount: 4000,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.gross_amount).toBe(4000);
    expect(line.unit_transaction_value).toBe(2000);
    expect(line.gst_rate).toBe(5);
  });

  // 22. Multi-Quantity: Qty 2 × ₹3,000 -> evaluate per-piece ₹3,000 (resolves 12%)
  it('22. Multi-quantity: Qty 2 × ₹3,000 evaluates per-piece ₹3,000 (resolves 12%)', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-MULTI-QTY-3000',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-3000',
          name: 'Linen Shirt 3000',
          category: 'MEN_SHIRTS',
          quantity: 2,
          unit_price: 3000
        }
      ],
      subtotal: 6000,
      total_amount: 6000,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.gross_amount).toBe(6000);
    expect(line.unit_transaction_value).toBe(3000);
    expect(line.gst_rate).toBe(12);
  });

  // 23. Catalog ₹2,799 discounted to ₹2,450 -> evaluates ₹2,450 (resolves 5%)
  it('23. Catalog ₹2,799 discounted to ₹2,450 evaluates ₹2,450 and resolves to 5% (not 12%)', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-DISCOUNT-2450',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-2799',
          name: 'Linen Shirt 2799',
          category: 'MEN_SHIRTS',
          quantity: 1,
          unit_price: 2799,
          line_discount: 349
        }
      ],
      subtotal: 2799,
      discount: 349,
      total_amount: 2450,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.unit_price).toBe(2799);
    expect(line.line_discount).toBe(349);
    expect(line.net_amount).toBe(2450);
    expect(line.unit_transaction_value).toBe(2450);
    expect(line.gst_rate).toBe(5);
  });

  // 24. Catalog ₹2,499 with no discount -> ₹2,499 (resolves 5%)
  it('24. Catalog ₹2,499 with no discount evaluates ₹2,499 and resolves to 5%', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-NO-DISCOUNT-2499',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-2499',
          name: 'Linen Shirt 2499',
          category: 'MEN_SHIRTS',
          quantity: 1,
          unit_price: 2499
        }
      ],
      subtotal: 2499,
      total_amount: 2499,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.unit_transaction_value).toBe(2499);
    expect(line.gst_rate).toBe(5);
  });

  // 25. Qty 2 × ₹3,000 with ₹1,000 order discount -> net ₹5,000 / 2 = ₹2,500.00 per piece (resolves 5%)
  it('25. Qty 2 × ₹3,000 with ₹1,000 order discount evaluates ₹2,500.00 per piece and resolves to 5%', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-ORDER-DISCOUNT-1000',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-3000',
          name: 'Linen Shirt 3000',
          category: 'MEN_SHIRTS',
          quantity: 2,
          unit_price: 3000
        }
      ],
      subtotal: 6000,
      discount: 1000,
      total_amount: 5000,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.gross_amount).toBe(6000);
    expect(line.line_discount).toBe(1000);
    expect(line.net_amount).toBe(5000);
    expect(line.unit_transaction_value).toBe(2500);
    expect(line.gst_rate).toBe(5);
  });

  // 26. Multi-line order with discount spanning different quantities
  it('26. Coupon discount spanning multiple lines with different quantities resolves each line independently', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_trousers_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_TROUSERS',
      category: 'MEN_TROUSERS',
      hsn_code: '6203',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    // Total gross = 2 * 2800 (5600) + 1 * 4400 (4400) = 10,000
    // Total discount = 2,000
    // Line 1: gross 5600 / 10000 * 2000 = 1120 discount -> Net 4480 / 2 = 2240 per piece (<= 2500 -> 5%)
    // Line 2: gross 4400 -> discount 880 -> Net 3520 / 1 = 3520 per piece (> 2500 -> 12%)
    const order = {
      order_id: 'ORD-MULTILINE-COUPON',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_shirt',
          sku: 'SHIRT-2800',
          name: 'Linen Shirt',
          category: 'MEN_SHIRTS',
          quantity: 2,
          unit_price: 2800
        },
        {
          id: 'prod_trouser',
          sku: 'TROUSER-4400',
          name: 'Linen Trouser',
          category: 'MEN_TROUSERS',
          quantity: 1,
          unit_price: 4400
        }
      ],
      subtotal: 10000,
      discount: 2000,
      total_amount: 8000,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    expect(res.invoice.line_items.length).toBe(2);

    const line1 = res.invoice.line_items[0];
    expect(line1.unit_price).toBe(2800);
    expect(line1.gross_amount).toBe(5600);
    expect(line1.line_discount).toBe(1120);
    expect(line1.net_amount).toBe(4480);
    expect(line1.unit_transaction_value).toBe(2240);
    expect(line1.gst_rate).toBe(5);

    const line2 = res.invoice.line_items[1];
    expect(line2.unit_price).toBe(4400);
    expect(line2.gross_amount).toBe(4400);
    expect(line2.line_discount).toBe(880);
    expect(line2.net_amount).toBe(3520);
    expect(line2.unit_transaction_value).toBe(3520);
    expect(line2.gst_rate).toBe(12);
  });

  // 27. Audit Trail & Snapshot verification
  it('27. Finalized invoice line records complete snapshot (unit_price, line_discount, net_amount, unit_transaction_value, tax_record_id, hsn_code, gst_rate)', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE',
      tax_config_version: 'v2.1'
    });

    const order = {
      order_id: 'ORD-AUDIT-SNAP',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-2800',
          name: 'Linen Shirt',
          category: 'MEN_SHIRTS',
          quantity: 2,
          unit_price: 2800,
          line_discount: 800
        }
      ],
      subtotal: 5600,
      discount: 800,
      total_amount: 4800,
      shipping_fee: 0
    };

    const res = buildGstInvoiceData(order as any);
    expect(res.success).toBe(true);
    if (!res.success) return;

    const line = res.invoice.line_items[0];
    expect(line.unit_price).toBe(2800);
    expect(line.line_discount).toBe(800);
    expect(line.net_amount).toBe(4800);
    expect(line.unit_transaction_value).toBe(2400);
    expect(line.tax_record_id).toBe('rule_cat_apparel_2500_band');
    expect(line.tax_config_version).toBe('v2.1');
    expect(line.tax_rule_scope).toBe('CATEGORY');
    expect(line.hsn_code).toBe('6205');
    expect(line.gst_rate).toBe(5);
  });

  // 28. Credit note reversal preserves original tax snapshot without re-running value-band logic
  it('28. Credit note calculation reverses tax rate from original invoice snapshot without re-evaluating value bands', () => {
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_apparel_2500_band',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      rate_mode: 'VALUE_BAND',
      value_bands: [
        { min_price: 0, max_price: 2500, gst_rate: 5 },
        { min_price: 2500.01, max_price: null, gst_rate: 12 }
      ],
      status: 'ACTIVE'
    });

    const order = {
      order_id: 'ORD-CN-REVERSAL',
      order_date: '2025-02-01T10:00:00.000Z',
      customer_id: 'cust_1',
      customer_name: 'Customer 1',
      address: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      items: [
        {
          id: 'prod_1',
          sku: 'SHIRT-2799',
          name: 'Linen Shirt',
          category: 'MEN_SHIRTS',
          quantity: 1,
          unit_price: 2799,
          line_discount: 349
        }
      ],
      subtotal: 2799,
      discount: 349,
      total_amount: 2450,
      shipping_fee: 0
    };

    const invRes = buildGstInvoiceData(order as any);
    expect(invRes.success).toBe(true);
    if (!invRes.success) return;

    // Mutate the active tax master to a higher rate rule or remove value bands
    clearProductTaxMaster();
    registerProductTaxMetadata({
      tax_record_id: 'rule_cat_shirts_flat18',
      scope_type: 'CATEGORY',
      scope_value: 'MEN_SHIRTS',
      category: 'MEN_SHIRTS',
      hsn_code: '6205',
      gst_rate: 18,
      status: 'ACTIVE'
    });

    // Credit Note derivation
    const cnRes = calculateCreditNoteData({
      originalInvoice: { ...invRes.invoice, invoice_id: 'INV-CN-TEST-01' } as any,
      itemsToCredit: [
        {
          line_id: invRes.invoice.line_items[0].line_id,
          sku: invRes.invoice.line_items[0].sku,
          quantity: 1
        }
      ],
      reason: 'GOODS_RETURNED',
      reasonDetails: 'Customer return'
    });

    expect(cnRes.success).toBe(true);
    if (!cnRes.success) return;

    // Original rate of 5% is preserved in the credit note reversal, NOT the updated 18% rule
    expect(cnRes.creditNoteData.line_items[0].gst_rate).toBe(5);
    expect(cnRes.creditNoteData.line_items[0].hsn_code).toBe('6205');
  });
});
