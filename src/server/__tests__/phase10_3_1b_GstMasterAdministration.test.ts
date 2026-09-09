import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSellerTaxConfig,
  validateSellerTaxConfig,
  SellerTaxConfig
} from '../invoice/sellerTaxConfig';
import {
  registerProductTaxMetadata,
  clearProductTaxMaster,
  lookupProductTaxMetadata,
  checkProductTaxDateOverlap,
  parseAndValidateProductTaxCsv,
  ProductTaxMasterEntry
} from '../invoice/productTaxMaster';
import {
  getDefaultShippingTaxConfig,
  validateShippingTaxConfig,
  ShippingTaxConfig
} from '../invoice/shippingTaxConfig';
import {
  getDefaultInvoiceNumberingConfig,
  InvoiceNumberingConfig
} from '../invoice/invoiceNumberingConfig';
import {
  logTaxMasterAudit,
  TaxMasterAuditEntry
} from '../invoice/taxMasterAudit';
import { buildGstInvoiceData } from '../invoice/invoiceCalculation';

describe('Phase 10.3.1B — GST Master Configuration & Product Tax Master Administration', () => {
  beforeEach(() => {
    clearProductTaxMaster();
    delete process.env.SELLER_LEGAL_NAME;
    delete process.env.SELLER_GSTIN;
    delete process.env.SELLER_STATE_CODE;
    delete process.env.SELLER_STATE;
    delete process.env.SELLER_ADDRESS_LINE1;
    delete process.env.SELLER_CITY;
    delete process.env.SELLER_PINCODE;
  });

  describe('1. Seller GST Master Configuration & Validation', () => {
    it('1.1. Fails validation if legal name or GSTIN is missing', () => {
      const config = getSellerTaxConfig();
      const val = validateSellerTaxConfig(config);
      expect(val.valid).toBe(false);
      expect(val.code).toBe('SELLER_TAX_CONFIGURATION_REQUIRED');
      expect(val.missing_fields).toContain('SELLER_LEGAL_NAME');
      expect(val.missing_fields).toContain('SELLER_GSTIN');
    });

    it('1.2. Rejects placeholder/dummy GSTIN patterns', () => {
      process.env.SELLER_LEGAL_NAME = 'Sa and Sha Pvt Ltd';
      process.env.SELLER_GSTIN = '27AABCK1234L1Z9'; // Dummy placeholder pattern
      process.env.SELLER_STATE_CODE = '27';
      process.env.SELLER_STATE = 'Maharashtra';
      process.env.SELLER_ADDRESS_LINE1 = '101 Marine Drive';
      process.env.SELLER_CITY = 'Mumbai';
      process.env.SELLER_PINCODE = '400020';

      const config = getSellerTaxConfig();
      const val = validateSellerTaxConfig(config);
      expect(val.valid).toBe(false);
      expect(val.code).toBe('SELLER_TAX_CONFIGURATION_INVALID');
    });

    it('1.3. Accepts verified valid seller GST configuration', () => {
      const validConfig: SellerTaxConfig = {
        legal_name: 'SA AND SHA PRIVATE LIMITED',
        trade_name: 'Sa and Sha',
        gstin: '27AABCU9603R1ZM', // Verified format
        pan: 'AABCU9603R',
        address_line_1: 'Plot 42, MIDC Industrial Area',
        address_line_2: 'Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
        pincode: '400093',
        country: 'India',
        support_email: 'shop@sa-and-sha.com',
        support_phone: '+91 98765 43210',
        invoice_prefix: 'KL',
        financial_year: '25-26',
        is_active: true,
        status: 'ACTIVE'
      };

      const val = validateSellerTaxConfig(validConfig);
      expect(val.valid).toBe(true);
    });
  });

  describe('2. Product Tax Master & Effective Date Resolution', () => {
    it('2.1. Looks up product tax rate by SKU and order date', () => {
      registerProductTaxMetadata({
        tax_record_id: 'tax_1',
        sku: 'KL-BED-001',
        hsn_code: '6302',
        gst_rate: 12,
        tax_category: 'BEDDING',
        effective_from: '2025-01-01T00:00:00.000Z',
        status: 'ACTIVE'
      });

      const res = lookupProductTaxMetadata({ sku: 'KL-BED-001', invoice_date: '2025-06-15T00:00:00.000Z' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.metadata.hsn_code).toBe('6302');
        expect(res.metadata.gst_rate).toBe(12);
      }
    });

    it('2.2. Returns error when tax metadata is missing for SKU (Fail Closed)', () => {
      const res = lookupProductTaxMetadata({ sku: 'UNKNOWN-SKU', invoice_date: '2025-06-15T00:00:00.000Z' });
      expect(res.success).toBe(false);
    });

    it('2.3. Resolves date-versioned rules based on order creation date', () => {
      // Historical rule (Old 5% rate before July 2025)
      registerProductTaxMetadata({
        tax_record_id: 'tax_old',
        sku: 'KL-LINEN-100',
        hsn_code: '6302',
        gst_rate: 5,
        tax_category: 'BEDDING',
        effective_from: '2024-01-01T00:00:00.000Z',
        effective_to: '2025-06-30T23:59:59.999Z',
        status: 'ACTIVE'
      });

      // New rule (12% rate starting July 2025)
      registerProductTaxMetadata({
        tax_record_id: 'tax_new',
        sku: 'KL-LINEN-100',
        hsn_code: '6302',
        gst_rate: 12,
        tax_category: 'BEDDING',
        effective_from: '2025-07-01T00:00:00.000Z',
        status: 'ACTIVE'
      });

      // Old order in May 2025 -> 5%
      const oldRes = lookupProductTaxMetadata({ sku: 'KL-LINEN-100', invoice_date: '2025-05-15T00:00:00.000Z' });
      expect(oldRes.success).toBe(true);
      if (oldRes.success) expect(oldRes.metadata.gst_rate).toBe(5);

      // New order in August 2025 -> 12%
      const newRes = lookupProductTaxMetadata({ sku: 'KL-LINEN-100', invoice_date: '2025-08-15T00:00:00.000Z' });
      expect(newRes.success).toBe(true);
      if (newRes.success) expect(newRes.metadata.gst_rate).toBe(12);
    });
  });

  describe('3. Date Overlap Validation Engine', () => {
    it('3.1. Detects overlapping date ranges for the same SKU', () => {
      const existing: ProductTaxMasterEntry[] = [
        {
          tax_record_id: 'rule_1',
          sku: 'KL-BED-001',
          hsn_code: '6302',
          gst_rate: 12,
          tax_category: 'APPAREL',
          effective_from: '2025-01-01T00:00:00.000Z',
          effective_to: '2025-12-31T23:59:59.999Z',
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          created_by: 'admin',
          updated_at: new Date().toISOString(),
          updated_by: 'admin'
        }
      ];

      const candidate: Partial<ProductTaxMasterEntry> = {
        sku: 'KL-BED-001',
        effective_from: '2025-06-01T00:00:00.000Z',
        effective_to: '2026-06-01T00:00:00.000Z'
      };

      const check = checkProductTaxDateOverlap(existing, candidate);
      expect(check.overlap).toBe(true);
      expect(check.error).toContain('overlaps with existing active rule');
    });

    it('3.2. Allows non-overlapping sequential date ranges', () => {
      const existing: ProductTaxMasterEntry[] = [
        {
          tax_record_id: 'rule_1',
          sku: 'KL-BED-001',
          hsn_code: '6302',
          gst_rate: 12,
          tax_category: 'APPAREL',
          effective_from: '2025-01-01T00:00:00.000Z',
          effective_to: '2025-06-30T23:59:59.999Z',
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          created_by: 'admin',
          updated_at: new Date().toISOString(),
          updated_by: 'admin'
        }
      ];

      const candidate: Partial<ProductTaxMasterEntry> = {
        sku: 'KL-BED-001',
        effective_from: '2025-07-01T00:00:00.000Z'
      };

      const check = checkProductTaxDateOverlap(existing, candidate);
      expect(check.overlap).toBe(false);
    });
  });

  describe('4. CSV Bulk Import Parser & Validator', () => {
    it('4.1. Parses valid CSV text and extracts product tax metadata', () => {
      const csv = `sku,hsn_code,gst_rate,tax_category,effective_from
KL-BED-001,6302,12,APPAREL,2025-01-01T00:00:00.000Z
KL-BATH-002,6302,12,APPAREL,2025-01-01T00:00:00.000Z`;

      const parsed = parseAndValidateProductTaxCsv(csv);
      expect(parsed.total_rows).toBe(2);
      expect(parsed.valid_rows).toBe(2);
      expect(parsed.invalid_rows).toBe(0);
      expect(parsed.rows[0].data.sku).toBe('KL-BED-001');
      expect(parsed.rows[0].data.hsn_code).toBe('6302');
      expect(parsed.rows[0].data.gst_rate).toBe(12);
    });

    it('4.2. Flags invalid rows with errors for wrong HSN or negative GST rate', () => {
      const csv = `sku,hsn_code,gst_rate
KL-BED-001,INVALID_HSN,-5
KL-BATH-002,6302,12`;

      const parsed = parseAndValidateProductTaxCsv(csv);
      expect(parsed.valid_rows).toBe(1);
      expect(parsed.invalid_rows).toBe(1);
      expect(parsed.rows[0].valid).toBe(false);
      expect(parsed.rows[0].errors[0]).toContain('Must be 4 to 8 digits');
      expect(parsed.rows[0].errors[1]).toContain('Must be between 0% and 100%');
    });
  });

  describe('5. Shipping Tax Configuration & Invoice Integration', () => {
    it('5.1. Validates standard shipping tax config', () => {
      const cfg = getDefaultShippingTaxConfig();
      const val = validateShippingTaxConfig(cfg);
      expect(val.valid).toBe(true);
      expect(cfg.hsn_or_sac_code).toBe('996812');
      expect(cfg.gst_rate).toBe(18);
    });

    it('5.2. Rejects invalid shipping SAC codes', () => {
      const invalidCfg: ShippingTaxConfig = {
        enabled: true,
        hsn_or_sac_code: '123', // Too short
        gst_rate: 18,
        tax_category: 'COURIER_SERVICES',
        effective_from: '2025-01-01',
        status: 'ACTIVE'
      };
      const val = validateShippingTaxConfig(invalidCfg);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('Expected 4 to 8 digits');
    });
  });

  describe('6. End-to-End Invoice Calculation Safety', () => {
    it('6.1. Fails closed when building invoice for order with unconfigured product SKU', () => {
      const validSeller: SellerTaxConfig = {
        legal_name: 'SA AND SHA PRIVATE LIMITED',
        trade_name: 'Sa and Sha',
        gstin: '27AABCU9603R1ZM',
        pan: 'AABCU9603R',
        address_line_1: 'Plot 42, MIDC Industrial Area',
        address_line_2: 'Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
        pincode: '400093',
        country: 'India',
        support_email: 'shop@sa-and-sha.com',
        support_phone: '+91 98765 43210',
        invoice_prefix: 'KL',
        financial_year: '25-26',
        is_active: true,
        status: 'ACTIVE'
      };

      const orderWithUnconfiguredSku = {
        order_id: 'ORD-999',
        created_at: '2025-08-01T10:00:00.000Z',
        shipping_address: {
          address_line_1: '456 MG Road',
          city: 'Pune',
          state: 'Maharashtra',
          pincode: '411001'
        },
        items: [
          {
            product_id: 'p_unconfigured',
            sku: 'KL-UNCONFIGURED-SKU',
            product_name: 'Mysterious Linen Item',
            quantity: 1,
            unit_price: 1000
          }
        ]
      };

      const result = buildGstInvoiceData(orderWithUnconfiguredSku, {
        sellerConfig: validSeller
      });

      expect(result.success).toBe(false);
      if (result.success === false) {
        expect(result.code).toBe('INVOICE_TAX_METADATA_MISSING');
        expect(result.error).toContain('Missing verified product tax metadata');
      }
    });
  });
});
