import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSellerTaxConfig,
  validateSellerTaxConfig,
  calculateFinancialYear
} from '../invoice/sellerTaxConfig';
import {
  normalizeGstStateCode,
  getStateNameFromCode,
  determineGstTreatment
} from '../invoice/gstUtils';
import {
  buildGstInvoiceData,
  round2
} from '../invoice/invoiceCalculation';
import {
  createOrFetchGstInvoice,
  getGstInvoiceByIdOrOrder,
  listGstInvoices
} from '../invoice/invoiceEngine';
import {
  registerProductTaxMetadata,
  clearProductTaxMaster,
  lookupProductTaxMetadata
} from '../invoice/productTaxMaster';

describe('Phase 10.3.1A — GST Invoice Master-Data Safety Correction', () => {
  beforeEach(() => {
    clearProductTaxMaster();
    // Clear seller process.env overrides
    delete process.env.SELLER_LEGAL_NAME;
    delete process.env.SELLER_GSTIN;
    delete process.env.SELLER_STATE_CODE;
    delete process.env.SELLER_STATE;
    delete process.env.SELLER_ADDRESS_LINE1;
    delete process.env.SELLER_CITY;
    delete process.env.SELLER_PINCODE;
  });

  describe('1. Seller Tax Configuration Safety & Validation', () => {
    it('1.1. Blocks unconfigured/placeholder seller data from invoice finalization', () => {
      const config = getSellerTaxConfig();
      const validation = validateSellerTaxConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.code).toBe('SELLER_TAX_CONFIGURATION_REQUIRED');
      expect(validation.missing_fields).toContain('SELLER_LEGAL_NAME');
      expect(validation.missing_fields).toContain('SELLER_GSTIN');
    });

    it('1.2. Validates GSTIN format and rejects invalid GSTIN strings', () => {
      process.env.SELLER_LEGAL_NAME = 'Sa and Sha Pvt Ltd';
      process.env.SELLER_GSTIN = 'INVALID_GSTIN_123';
      process.env.SELLER_STATE_CODE = '27';
      process.env.SELLER_STATE = 'Maharashtra';
      process.env.SELLER_ADDRESS_LINE1 = '101 Marine Drive';
      process.env.SELLER_CITY = 'Mumbai';
      process.env.SELLER_PINCODE = '400020';

      const config = getSellerTaxConfig();
      const validation = validateSellerTaxConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.code).toBe('SELLER_TAX_CONFIGURATION_INVALID');
      expect(validation.error).toContain('Invalid seller GSTIN format');
    });

    it('1.3. Enforces that seller GSTIN state prefix matches configured state code', () => {
      process.env.SELLER_LEGAL_NAME = 'Sa and Sha Pvt Ltd';
      process.env.SELLER_GSTIN = '07AAAAA0000A1Z5'; // Delhi GSTIN prefix '07'
      process.env.SELLER_STATE_CODE = '27'; // Mismatch: Maharashtra code '27'
      process.env.SELLER_STATE = 'Maharashtra';
      process.env.SELLER_ADDRESS_LINE1 = '101 Marine Drive';
      process.env.SELLER_CITY = 'Mumbai';
      process.env.SELLER_PINCODE = '400020';

      const config = getSellerTaxConfig();
      const validation = validateSellerTaxConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.code).toBe('SELLER_TAX_CONFIGURATION_INVALID');
      expect(validation.error).toContain("does not match configured state code");
    });

    it('1.4. Accepts valid, fully configured seller tax metadata', () => {
      process.env.SELLER_LEGAL_NAME = 'Sa and Sha Enterprise Private Limited';
      process.env.SELLER_GSTIN = '27AAACK1234A1Z5';
      process.env.SELLER_STATE_CODE = '27';
      process.env.SELLER_STATE = 'Maharashtra';
      process.env.SELLER_ADDRESS_LINE1 = 'Building A, Commercial Complex';
      process.env.SELLER_CITY = 'Mumbai';
      process.env.SELLER_PINCODE = '400001';

      const config = getSellerTaxConfig();
      const validation = validateSellerTaxConfig(config);
      expect(validation.valid).toBe(true);
      expect(validation.config?.legal_name).toBe('Sa and Sha Enterprise Private Limited');
      expect(validation.config?.pan).toBe('AAACK1234A');
    });
  });

  describe('2. Strict Product Tax Master & No-Fallback Policy', () => {
    it('2.1. Product name cannot infer HSN code', () => {
      const result = lookupProductTaxMetadata({
        product_id: 'p-shirt-1',
        item: { name: 'Amalfi Pure Linen Shirt', category: 'shirts' }
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVOICE_TAX_METADATA_MISSING');
      expect(result.missing_field).toBe('hsn_code');
    });

    it('2.2. Product category cannot infer HSN code', () => {
      const result = lookupProductTaxMetadata({
        product_id: 'p-pants-1',
        item: { name: 'Custom Bottomwear', category: 'pants' }
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVOICE_TAX_METADATA_MISSING');
      expect(result.missing_field).toBe('hsn_code');
    });

    it('2.3. Unit price cannot infer GST rate without explicit tax master entry', () => {
      const result = lookupProductTaxMetadata({
        product_id: 'p-generic-1',
        item: { name: 'Cheap Linen Item', price: 800 }
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('INVOICE_TAX_METADATA_MISSING');
    });

    it('2.4. Successfully looks up verified tax metadata from Product Tax Master', () => {
      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        sku: 'KL-SHIRT-WHT-L',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL_SHIRT',
        tax_config_version: '2026.1'
      });

      const result = lookupProductTaxMetadata({
        product_id: 'p-shirt-101',
        sku: 'KL-SHIRT-WHT-L'
      });

      expect(result.success).toBe(true);
      expect(result.metadata?.hsn_code).toBe('62052000');
      expect(result.metadata?.gst_rate).toBe(12);
      expect(result.metadata?.tax_config_version).toBe('2026.1');
    });
  });

  describe('3. Invoice Creation Fail-Closed Behavior & Calculations', () => {
    const validOrder = {
      order_id: 'KL-ORDER-88001',
      customer_name: 'Aditya Roy',
      customer_email: 'aditya@example.com',
      customer_phone: '+919876543210',
      address: 'Flat 12B, Sea Crest Towers',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      items: [
        {
          id: 'item-1',
          product_id: 'p-shirt-101',
          sku: 'KL-SHIRT-WHT-L',
          name: 'Amalfi Pure Linen Shirt',
          quantity: 2,
          price: 3500
        }
      ],
      subtotal: 7000,
      discount: 0,
      shipping_cost: 0,
      grand_total: 7000,
      payment_method: 'razorpay',
      status: 'paid'
    };

    function setupValidSellerEnv() {
      process.env.SELLER_LEGAL_NAME = 'Sa and Sha Private Limited';
      process.env.SELLER_GSTIN = '27AAACK1234A1Z5';
      process.env.SELLER_STATE_CODE = '27';
      process.env.SELLER_STATE = 'Maharashtra';
      process.env.SELLER_ADDRESS_LINE1 = 'Plot 10, Industrial Estate';
      process.env.SELLER_CITY = 'Mumbai';
      process.env.SELLER_PINCODE = '400093';
    }

    it('3.1. Fails with SELLER_TAX_CONFIGURATION_REQUIRED if seller env is missing', () => {
      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        tax_config_version: '2026.1'
      });

      const res = buildGstInvoiceData(validOrder);
      expect(res.success).toBe(false);
      if (res.success === false) {
        expect(res.code).toBe('SELLER_TAX_CONFIGURATION_REQUIRED');
      }
    });

    it('3.2. Fails with INVOICE_TAX_METADATA_MISSING if order item lacks verified HSN in tax master', () => {
      setupValidSellerEnv();
      // Notice: clearProductTaxMaster was called, so no tax metadata exists for p-shirt-101

      const res = buildGstInvoiceData(validOrder);
      expect(res.success).toBe(false);
      if (res.success === false) {
        expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
        expect(res.details?.missing_field).toBe('hsn_code');
      }
    });

    it('3.3. Calculates INTRASTATE (CGST + SGST) when seller state == buyer state', () => {
      setupValidSellerEnv();
      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        tax_config_version: '2026.1'
      });

      const res = buildGstInvoiceData(validOrder);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.invoice.supply_type).toBe('INTRASTATE');
        expect(res.invoice.cgst_total).toBeGreaterThan(0);
        expect(res.invoice.sgst_total).toBeGreaterThan(0);
        expect(res.invoice.igst_total).toBe(0);
        expect(res.invoice.line_items[0].hsn_code).toBe('62052000');
        expect(res.invoice.line_items[0].gst_rate).toBe(12);
      }
    });

    it('3.4. Calculates INTERSTATE (IGST) when seller state != buyer state', () => {
      setupValidSellerEnv();
      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        tax_config_version: '2026.1'
      });

      const delhiOrder = {
        ...validOrder,
        state: 'Delhi'
      };

      const res = buildGstInvoiceData(delhiOrder);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.invoice.supply_type).toBe('INTERSTATE');
        expect(res.invoice.igst_total).toBeGreaterThan(0);
        expect(res.invoice.cgst_total).toBe(0);
        expect(res.invoice.sgst_total).toBe(0);
      }
    });

    it('3.5. Reconciles invoice tax breakdown with order grand total', () => {
      setupValidSellerEnv();
      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        tax_config_version: '2026.1'
      });

      const res = buildGstInvoiceData(validOrder);
      expect(res.success).toBe(true);
      if (res.success) {
        const inv = res.invoice;
        const sum = round2(inv.taxable_total + inv.shipping_taxable + inv.tax_total + inv.round_off);
        expect(sum).toBe(inv.grand_total);
      }
    });

    it('3.6. Preserves historical invoice snapshot immutably even if tax master updates later', () => {
      setupValidSellerEnv();
      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        tax_config_version: '2026.1'
      });

      const res = buildGstInvoiceData(validOrder);
      expect(res.success).toBe(true);
      if (res.success) {
        const snapshot = res.invoice;
        expect(snapshot.immutable).toBe(true);

        // Update product tax master to a new future rate (e.g., 18%)
        registerProductTaxMetadata({
          product_id: 'p-shirt-101',
          hsn_code: '62052000',
          gst_rate: 18,
          tax_category: 'APPAREL',
          tax_config_version: '2027.1'
        });

        // Verify previously calculated snapshot rate remains unchanged at 12%
        expect(snapshot.line_items[0].gst_rate).toBe(12);
      }
    });
  });

  describe('4. Transaction-Safe Engine Integration & Database Isolation', () => {
    let mockStore: Record<string, Record<string, any>> = {};

    function createMockAdminDb() {
      mockStore = {
        gst_invoices: {},
        orders: {
          'KL-999001-LX': {
            order_id: 'KL-999001-LX',
            customer_name: 'Pooja Hegde',
            customer_email: 'pooja@example.com',
            customer_phone: '+919988776655',
            address: 'Juhu Beach Road',
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400049',
            items: [{ id: 'ls-1', product_id: 'p-shirt-101', name: 'Amalfi Shirt', price: 3499, quantity: 1 }],
            subtotal: 3499,
            discount: 0,
            shipping_cost: 0,
            grand_total: 3499,
            payment_method: 'razorpay',
            payment_status: 'captured',
            payment_verified: true,
            payment_verification_source: 'razorpay_api',
            payment_id: 'pay_999001',
            status: 'processing',
            created_at: '2026-08-05T14:00:00.000Z'
          }
        },
        counters: {},
        admin_audit_logs: {}
      };

      const createDocRef = (collName: string, actualDocId: string) => ({
        id: actualDocId,
        get: async () => ({
          exists: Boolean(mockStore[collName]?.[actualDocId]),
          id: actualDocId,
          data: () => mockStore[collName]?.[actualDocId],
          ref: createDocRef(collName, actualDocId)
        }),
        set: async (data: any) => {
          if (!mockStore[collName]) mockStore[collName] = {};
          mockStore[collName][actualDocId] = data;
        },
        update: async (data: any) => {
          if (!mockStore[collName]) mockStore[collName] = {};
          mockStore[collName][actualDocId] = {
            ...(mockStore[collName][actualDocId] || {}),
            ...data
          };
        }
      });

      return {
        collection: (collName: string) => ({
          add: async (data: any) => {
            const id = `doc_${Math.random().toString(36).substring(2, 9)}`;
            if (!mockStore[collName]) mockStore[collName] = {};
            mockStore[collName][id] = data;
            return createDocRef(collName, id);
          },
          doc: (docId?: string) => {
            const actualDocId = docId || `doc_${Math.random().toString(36).substring(2, 9)}`;
            return createDocRef(collName, actualDocId);
          },
          where: (field: string, op: string, val: any) => ({
            where: (field2: string, op2: string, val2: any) => ({
              limit: (lim: number) => ({
                get: async () => {
                  const items = Object.entries(mockStore[collName] || {})
                    .filter(([_, v]) => v[field] === val && v[field2] === val2)
                    .map(([k, v]) => ({
                      id: k,
                      data: () => v,
                      ref: createDocRef(collName, k)
                    }));
                  return { empty: items.length === 0, docs: items, forEach: (cb: any) => items.forEach(cb) };
                }
              })
            }),
            limit: (lim: number) => ({
              get: async () => {
                const items = Object.entries(mockStore[collName] || {})
                  .filter(([_, v]) => v[field] === val)
                  .map(([k, v]) => ({
                    id: k,
                    data: () => v,
                    ref: createDocRef(collName, k)
                  }));
                return { empty: items.length === 0, docs: items, forEach: (cb: any) => items.forEach(cb) };
              }
            })
          }),
          limit: (lim: number) => ({
            get: async () => {
              const items = Object.entries(mockStore[collName] || {})
                .slice(0, lim)
                .map(([k, v]) => ({
                  id: k,
                  data: () => v,
                  ref: createDocRef(collName, k)
                }));
              return { empty: items.length === 0, docs: items, forEach: (cb: any) => items.forEach(cb) };
            }
          }),
          get: async () => {
            const items = Object.entries(mockStore[collName] || {}).map(([k, v]) => ({
              id: k,
              data: () => v,
              ref: createDocRef(collName, k)
            }));
            return { empty: items.length === 0, docs: items, forEach: (cb: any) => items.forEach(cb) };
          }
        }),
        runTransaction: async (updateFunction: any) => {
          const transactionMock = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any) => ref.set(data),
            update: (ref: any, data: any) => ref.update(data)
          };
          return updateFunction(transactionMock);
        }
      };
    }

    it('4.1. Fails closed when unconfigured before attempting Firestore transaction', async () => {
      const mockDb = createMockAdminDb();
      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        tax_config_version: '2026.1'
      });

      const res = await createOrFetchGstInvoice(mockDb, 'KL-999001-LX');
      expect(res.success).toBe(false);
      expect(res.code).toBe('SELLER_TAX_CONFIGURATION_REQUIRED');
    });

    it('4.2. Successfully creates GST invoice idempotently when seller & product tax master are configured', async () => {
      process.env.SELLER_LEGAL_NAME = 'Sa and Sha Private Limited';
      process.env.SELLER_GSTIN = '27AAACK1234A1Z5';
      process.env.SELLER_STATE_CODE = '27';
      process.env.SELLER_STATE = 'Maharashtra';
      process.env.SELLER_ADDRESS_LINE1 = 'Plot 10, Industrial Estate';
      process.env.SELLER_CITY = 'Mumbai';
      process.env.SELLER_PINCODE = '400093';

      registerProductTaxMetadata({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        tax_config_version: '2026.1'
      });

      const mockDb = createMockAdminDb();
      await mockDb.collection('product_tax_master').doc('ptm-1').set({
        product_id: 'p-shirt-101',
        hsn_code: '62052000',
        gst_rate: 12,
        tax_category: 'APPAREL',
        status: 'ACTIVE'
      });

      const res = await createOrFetchGstInvoice(mockDb, 'KL-999001-LX');
      expect(res.success).toBe(true);
      expect(res.invoice?.invoice_number).toMatch(/^KL\/26-27\/000001$/);

      // Idempotent retry
      const resRetry = await createOrFetchGstInvoice(mockDb, 'KL-999001-LX');
      expect(resRetry.success).toBe(true);
      expect(resRetry.reused).toBe(true);
      expect(resRetry.invoice?.invoice_number).toBe(res.invoice?.invoice_number);
    });
  });
});
