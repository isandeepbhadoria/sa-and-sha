import { describe, it, expect, beforeEach } from 'vitest';
import { generateGstCreditNotePdfBuffer } from '../invoice/creditNotePdfGenerator';
import { GstCreditNote } from '../invoice/creditNoteTypes';
import { createOrFetchGstCreditNote, getCreditNoteByIdOrNumber } from '../invoice/creditNoteEngine';
import { getCustomerCreditNote } from '../customerReturnsHelpers';

// Mock Firestore DB for testing
function createMockDb() {
  const collections: Record<string, Map<string, any>> = {
    gst_credit_notes: new Map(),
    return_requests: new Map(),
    orders: new Map(),
    gst_invoices: new Map(),
    counters: new Map()
  };

  return {
    _collections: collections,
    collection(name: string) {
      if (!collections[name]) collections[name] = new Map();
      const colMap = collections[name];

      return {
        doc(id: string) {
          return {
            get: async () => {
              const data = colMap.get(id);
              return {
                exists: Boolean(data),
                id,
                data: () => data
              };
            },
            set: async (data: any) => {
              colMap.set(id, data);
            },
            update: async (data: any) => {
              const existing = colMap.get(id) || {};
              colMap.set(id, { ...existing, ...data });
            }
          };
        },
        where(field: string, op: string, val: any) {
          return {
            limit(n: number) {
              return {
                get: async () => {
                  const results: any[] = [];
                  for (const [docId, docData] of colMap.entries()) {
                    if (docData && docData[field] === val) {
                      results.push({ id: docId, data: () => docData });
                      if (results.length >= n) break;
                    }
                  }
                  return {
                    empty: results.length === 0,
                    docs: results,
                    forEach: (cb: any) => results.forEach(cb)
                  };
                }
              };
            },
            get: async () => {
              const results: any[] = [];
              for (const [docId, docData] of colMap.entries()) {
                if (docData && docData[field] === val) {
                  results.push({ id: docId, data: () => docData });
                }
              }
              return {
                empty: results.length === 0,
                docs: results,
                forEach: (cb: any) => results.forEach(cb)
              };
            }
          };
        }
      };
    },
    async runTransaction(cb: any) {
      const transaction = {
        get: async (ref: any) => ref.get(),
        set: (ref: any, data: any) => ref.set(data),
        update: (ref: any, data: any) => ref.update(data)
      };
      return cb(transaction);
    }
  };
}

describe('Phase 10.5C - GST Credit Note PDF & Access Control Engine', () => {
  let mockDb: any;

  const sampleB2cNote: GstCreditNote = {
    credit_note_id: 'cn_test_100',
    credit_note_number: 'KLCN/26-27/000001',
    original_invoice_id: 'inv_42',
    financial_year: '26-27',
    original_invoice_number: 'KL/26-27/000042',
    original_invoice_date: '2026-04-10T10:00:00.000Z',
    order_id: 'ord_b2c_101',
    order_number: 'KL-1001',
    rma_number: 'RMA-9001',
    return_request_id: 'ret_101',
    issue_date: '2026-04-15T12:00:00.000Z',
    customer_id: 'cust_b2c_101',
    customer_profile_id: 'prof_cust_a',
    seller_snapshot: {
      legal_name: 'Sa and Sha Private Limited',
      trade_name: 'Sa and Sha',
      gstin: '27AABCK1234F1Z1',
      pan: 'AABCK1234F',
      state: 'Maharashtra',
      state_code: '27',
      address_line_1: 'Plot 12, Industrial Zone',
      address_line_2: '',
      city: 'Mumbai',
      pincode: '400001',
      country: 'India',
      support_email: 'support@sa-and-sha.com',
      support_phone: '1800-123-4567'
    },
    buyer_snapshot: {
      customer_id: 'cust_b2c_101',
      customer_type: 'INDIVIDUAL',
      full_name: 'Aarav Sharma',
      email: 'aarav@example.com',
      phone: '9876543210',
      gst_verified: false,
      address_line_1: 'Flat 401, Sun Towers',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400050',
      country: 'India'
    },
    shipping_snapshot: {
      full_name: 'Aarav Sharma',
      phone: '9876543210',
      address_line_1: 'Flat 401, Sun Towers',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400050',
      country: 'India'
    },
    billing_snapshot: {
      full_name: 'Aarav Sharma',
      phone: '9876543210',
      address_line_1: 'Flat 401, Sun Towers',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400050',
      country: 'India'
    },
    place_of_supply: 'Maharashtra',
    place_of_supply_state_code: '27',
    supply_type: 'INTRASTATE',
    gst_customer_type: 'B2C',
    reason: 'GOODS_RETURNED',
    reason_details: 'Size too large',
    line_items: [
      {
        line_id: 'item_1',
        product_id: 'prod_linen_shirt',
        product_name: 'Handcrafted Classic Linen Shirt',
        sku: 'KL-LS-WHT-L',
        variant: 'White / L',
        hsn_code: '6205',
        original_quantity: 2,
        credited_quantity: 1,
        unit_price: 3000,
        original_gross_amount: 6000,
        original_line_discount: 0,
        credited_gross_amount: 3000,
        credited_line_discount: 0,
        taxable_value_reversal: 3000,
        gst_rate: 12,
        cgst_rate: 6,
        cgst_reversal: 180,
        sgst_rate: 6,
        sgst_reversal: 180,
        igst_rate: 0,
        igst_reversal: 0,
        line_total_reversal: 3360
      }
    ],
    subtotal_reversal: 3000,
    discount_total_reversal: 0,
    taxable_total_reversal: 3000,
    cgst_total_reversal: 180,
    sgst_total_reversal: 180,
    igst_total_reversal: 0,
    tax_total_reversal: 360,
    shipping_sac: '996812',
    shipping_gst_rate: 18,
    shipping_taxable_reversal: 100,
    shipping_tax_reversal: 18,
    shipping_total_reversal: 118,
    round_off_reversal: 0,
    grand_total_reversal: 3478,
    status: 'ISSUED',
    currency: 'INR',
    created_at: '2026-04-15T12:00:00.000Z',
    created_by: 'admin@sa-and-sha.com',
    version: 1,
    pdf_status: 'NOT_GENERATED',
    pdf_generated_at: null,
    pdf_storage_reference: null,
    immutable: true,
    tax_liability_adjusted: false,
    gst_reporting_status: 'NOT_REPORTED',
    gst_adjustment_eligibility: 'ELIGIBLE',
    gst_adjustment_deadline: '2027-11-30T23:59:59.999Z',
    e_invoice_status: 'NOT_APPLICABLE'
  };

  beforeEach(() => {
    mockDb = createMockDb();
  });

  describe('1. PDF Generation Engine (Buffer Verification)', () => {
    it('generates a valid, non-empty PDF Buffer with %PDF header for B2C Intrastate credit note', async () => {
      const buffer = await generateGstCreditNotePdfBuffer(sampleB2cNote);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
      const pdfHeader = buffer.slice(0, 5).toString('utf8');
      expect(pdfHeader).toBe('%PDF-');
    });

    it('generates a valid PDF Buffer for B2B Interstate credit note with IGST', async () => {
      const b2bInterstateNote: GstCreditNote = {
        ...sampleB2cNote,
        credit_note_id: 'cn_test_200',
        credit_note_number: 'KLCN/26-27/000002',
        gst_customer_type: 'B2B',
        supply_type: 'INTERSTATE',
        place_of_supply: 'Karnataka',
        place_of_supply_state_code: '29',
        buyer_snapshot: {
          ...sampleB2cNote.buyer_snapshot,
          legal_name: 'Bengaluru Linen Boutique Pvt Ltd',
          gstin: '29AABCB9876F1Z5',
          state: 'Karnataka',
          state_code: '29'
        },
        cgst_total_reversal: 0,
        sgst_total_reversal: 0,
        igst_total_reversal: 360,
        line_items: [
          {
            ...sampleB2cNote.line_items[0],
            cgst_reversal: 0,
            sgst_reversal: 0,
            igst_reversal: 360
          }
        ]
      };

      const buffer = await generateGstCreditNotePdfBuffer(b2bInterstateNote);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.slice(0, 5).toString('utf8')).toBe('%PDF-');
    });

    it('handles credit notes with multiple line items without throwing', async () => {
      const multiItemNote: GstCreditNote = {
        ...sampleB2cNote,
        line_items: Array.from({ length: 8 }, (_, i) => ({
          ...sampleB2cNote.line_items[0],
          item_id: `item_${i + 1}`,
          product_name: `Linen Item Premium Custom Handcrafted Version ${i + 1}`,
          credited_quantity: i + 1,
          line_total_reversal: (i + 1) * 3360
        }))
      };

      const buffer = await generateGstCreditNotePdfBuffer(multiItemNote);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(2000);
    });
  });

  describe('2. Customer Access Control & Ownership Verification', () => {
    beforeEach(async () => {
      // Seed mock return request for Customer A
      await mockDb.collection('return_requests').doc('ret_101').set({
        request_id: 'ret_101',
        rma_number: 'RMA-9001',
        order_id: 'ord_b2c_101',
        customer_profile_id: 'prof_cust_a',
        customer_phone: '9876543210',
        customer_email: 'aarav@example.com'
      });

      // Seed finalized credit note for Customer A
      await mockDb.collection('gst_credit_notes').doc('cn_test_100').set(sampleB2cNote);
    });

    it('allows Customer A to retrieve their own credit note via RMA / Return ID', async () => {
      const result = await getCustomerCreditNote(
        mockDb,
        'prof_cust_a',
        '9876543210',
        'aarav@example.com',
        'RMA-9001'
      );

      expect(result.success).toBe(true);
      expect(result.creditNote).toBeDefined();
      expect(result.creditNote?.credit_note_number).toBe('KLCN/26-27/000001');
    });

    it('rejects Cross-Customer B access attempt to Customer A credit note with 404/CREDIT_NOTE_NOT_AVAILABLE', async () => {
      const result = await getCustomerCreditNote(
        mockDb,
        'prof_cust_b',
        '9999999999',
        'intruder@example.com',
        'RMA-9001'
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.code).toBe('CREDIT_NOTE_NOT_AVAILABLE');
      expect(result.creditNote).toBeUndefined();
    });

    it('returns 404/CREDIT_NOTE_NOT_AVAILABLE when return request exists but no credit note was issued', async () => {
      await mockDb.collection('return_requests').doc('ret_no_cn').set({
        request_id: 'ret_no_cn',
        rma_number: 'RMA-9099',
        order_id: 'ord_no_cn',
        customer_profile_id: 'prof_cust_a',
        customer_phone: '9876543210',
        customer_email: 'aarav@example.com'
      });

      const result = await getCustomerCreditNote(
        mockDb,
        'prof_cust_a',
        '9876543210',
        'aarav@example.com',
        'RMA-9099'
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.code).toBe('CREDIT_NOTE_NOT_AVAILABLE');
    });

    it('rejects direct document ID lookup if Customer B attempts to guess Customer A credit_note_id', async () => {
      const result = await getCustomerCreditNote(
        mockDb,
        'prof_cust_b',
        '9999999999',
        'intruder@example.com',
        'cn_test_100'
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.code).toBe('CREDIT_NOTE_NOT_AVAILABLE');
    });
  });

  describe('3. Read-Only Immutability Verification', () => {
    it('repeatedly fetching or generating PDF leaves credit note document in Firestore unchanged', async () => {
      await mockDb.collection('gst_credit_notes').doc('cn_test_100').set(sampleB2cNote);

      const beforeSnap = await mockDb.collection('gst_credit_notes').doc('cn_test_100').get();
      const beforeData = beforeSnap.data();

      // Call getCustomerCreditNote
      await getCustomerCreditNote(mockDb, 'prof_cust_a', '9876543210', 'aarav@example.com', 'cn_test_100');

      // Generate PDF buffer
      await generateGstCreditNotePdfBuffer(sampleB2cNote);

      const afterSnap = await mockDb.collection('gst_credit_notes').doc('cn_test_100').get();
      const afterData = afterSnap.data();

      expect(JSON.stringify(beforeData)).toBe(JSON.stringify(afterData));
      expect(afterData.tax_liability_adjusted).toBe(false);
      expect(afterData.gst_reporting_status).toBe('NOT_REPORTED');
    });
  });
});
