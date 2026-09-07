import { describe, it, expect } from 'vitest';
import { generateGstInvoicePdfBuffer, numberToIndianWords } from './invoice/invoicePdfGenerator';
import { GstInvoice } from './invoice/invoiceTypes';

function createMockInvoice(overrides: Partial<GstInvoice> = {}): GstInvoice {
  return {
    invoice_id: 'inv_test_123',
    invoice_number: 'KL/2026-27/000001',
    invoice_type: 'TAX_INVOICE',
    status: 'FINALIZED',
    order_id: 'ord_test_999',
    order_number: 'KL-ORD-999',
    invoice_date: '2026-08-08',
    financial_year: '2026-27',
    currency: 'INR',
    seller_snapshot: {
      legal_name: 'SA AND SHA PRIVATE LIMITED',
      trade_name: 'Sa and Sha',
      gstin: '27AAAAA0000A1Z5',
      address_line_1: 'Plot 101, Industrial Estate',
      address_line_2: 'Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400069',
      country: 'India',
      pan: 'AAAAA0000A',
      support_email: 'support@saandsha.com',
      support_phone: '+919876543210'
    },
    buyer_snapshot: {
      customer_id: 'cust_b2c_1',
      customer_type: 'INDIVIDUAL',
      full_name: 'Rahul Sharma',
      email: 'rahul@example.com',
      phone: '+919876543211',
      gst_verified: false,
      address_line_1: 'Apt 402, Sunshine Heights',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400050',
      country: 'India'
    },
    shipping_snapshot: {
      full_name: 'Rahul Sharma',
      phone: '+919876543211',
      address_line_1: 'Apt 402, Sunshine Heights',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400050',
      country: 'India'
    },
    billing_snapshot: {
      full_name: 'Rahul Sharma',
      phone: '+919876543211',
      address_line_1: 'Apt 402, Sunshine Heights',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400050',
      country: 'India'
    },
    place_of_supply: 'Maharashtra',
    place_of_supply_state_code: '27',
    supply_type: 'INTRASTATE',
    line_items: [
      {
        line_id: 'line_1',
        product_id: 'prod_101',
        sku: 'KL-SHIRT-WHT-M',
        product_name: 'Handcrafted Classic White Linen Shirt',
        variant: 'Size: M | Color: White',
        quantity: 2,
        unit_price: 2500,
        gross_amount: 5000,
        line_discount: 500,
        taxable_value: 4500,
        hsn_code: '6205',
        gst_rate: 12,
        cgst_rate: 6,
        cgst_amount: 270,
        sgst_rate: 6,
        sgst_amount: 270,
        igst_rate: 0,
        igst_amount: 0,
        line_total: 5040
      }
    ],
    subtotal: 5000,
    discount_total: 500,
    taxable_total: 4500,
    cgst_total: 270,
    sgst_total: 270,
    igst_total: 0,
    tax_total: 540,
    shipping_taxable: 100,
    shipping_tax: 18,
    shipping_total: 118,
    round_off: 0.00,
    grand_total: 5158,
    payment_method: 'RAZORPAY',
    payment_status: 'PAID',
    customer_id: 'cust_b2c_1',
    customer_profile_id: 'prof_b2c_1',
    gst_customer_type: 'B2C',
    created_at: '2026-08-08T10:00:00Z',
    created_by: 'system',
    version: 1,
    pdf_status: 'NOT_GENERATED',
    pdf_generated_at: null,
    pdf_storage_reference: null,
    immutable: true,
    ...overrides
  };
}

describe('GST Invoice PDF Generator & Tax Engine Tests', () => {
  describe('Amount in Words (Rupee Converter)', () => {
    it('1. converts 0 correctly', () => {
      expect(numberToIndianWords(0)).toBe('Rupees Zero Only');
    });

    it('2. converts standard rupees correctly', () => {
      expect(numberToIndianWords(12450)).toBe('Rupees Twelve Thousand Four Hundred Fifty Only');
    });

    it('3. converts rupees with paise correctly', () => {
      expect(numberToIndianWords(12450.50)).toBe('Rupees Twelve Thousand Four Hundred Fifty and Fifty Paise Only');
    });

    it('4. converts lakhs correctly', () => {
      expect(numberToIndianWords(100000)).toBe('Rupees One Lakh Only');
    });

    it('5. converts complex crore and lakh amounts', () => {
      expect(numberToIndianWords(1540320.75)).toBe(
        'Rupees Fifteen Lakh Forty Thousand Three Hundred Twenty and Seventy Five Paise Only'
      );
    });
  });

  describe('PDF Generation Engine (Read-Only Snapshot)', () => {
    it('6. generates valid PDF buffer for Intrastate B2C invoice', async () => {
      const inv = createMockInvoice({ supply_type: 'INTRASTATE', gst_customer_type: 'B2C' });
      const buffer = await generateGstInvoicePdfBuffer(inv);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });

    it('7. generates valid PDF buffer for Interstate B2C invoice with IGST', async () => {
      const inv = createMockInvoice({
        supply_type: 'INTERSTATE',
        place_of_supply: 'Karnataka',
        place_of_supply_state_code: '29',
        gst_customer_type: 'B2C',
        cgst_total: 0,
        sgst_total: 0,
        igst_total: 540,
        line_items: [
          {
            line_id: 'line_1',
            product_id: 'prod_101',
            sku: 'KL-SHIRT-WHT-M',
            product_name: 'Handcrafted Classic White Linen Shirt',
            variant: 'Size: M | Color: White',
            quantity: 2,
            unit_price: 2500,
            gross_amount: 5000,
            line_discount: 500,
            taxable_value: 4500,
            hsn_code: '6205',
            gst_rate: 12,
            cgst_rate: 0,
            cgst_amount: 0,
            sgst_rate: 0,
            sgst_amount: 0,
            igst_rate: 12,
            igst_amount: 540,
            line_total: 5040
          }
        ]
      });

      const buffer = await generateGstInvoicePdfBuffer(inv);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });

    it('8. handles B2B invoice with verified customer GSTIN and Legal Name', async () => {
      const inv = createMockInvoice({
        gst_customer_type: 'B2B',
        buyer_snapshot: {
          customer_id: 'cust_b2b_100',
          customer_type: 'BUSINESS',
          full_name: 'Anand Verma',
          email: 'anand@textilescorp.com',
          phone: '+919811122233',
          gstin: '27ABCDE1234F1ZH',
          legal_name: 'TEXTILES CORP PRIVATE LIMITED',
          trade_name: 'Textiles Corp',
          gst_verified: true,
          address_line_1: 'Industrial Zone Block B',
          city: 'Mumbai',
          state: 'Maharashtra',
          state_code: '27',
          pincode: '400018',
          country: 'India'
        }
      });

      const buffer = await generateGstInvoicePdfBuffer(inv);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('9. supports multi-page rendering for invoices with numerous line items', async () => {
      const manyItems = Array.from({ length: 25 }).map((_, idx) => ({
        line_id: `line_${idx + 1}`,
        product_id: `prod_${idx + 1}`,
        sku: `KL-SKU-P${idx + 1}`,
        product_name: `Premium Handcrafted Pure Linen Garment Item Variant #${idx + 1}`,
        variant: 'Size: XL | Custom Fit',
        quantity: 1,
        unit_price: 3000,
        gross_amount: 3000,
        line_discount: 300,
        taxable_value: 2700,
        hsn_code: '6205',
        gst_rate: 12,
        cgst_rate: 6,
        cgst_amount: 162,
        sgst_rate: 6,
        sgst_amount: 162,
        igst_rate: 0,
        igst_amount: 0,
        line_total: 3024
      }));

      const inv = createMockInvoice({ line_items: manyItems });
      const buffer = await generateGstInvoicePdfBuffer(inv);

      expect(Buffer.isBuffer(buffer)).toBe(true);
      // Multi-page PDF should be substantially larger
      expect(buffer.length).toBeGreaterThan(5000);
    });

    it('10. handles extremely long product names and long address strings without crashing', async () => {
      const inv = createMockInvoice({
        buyer_snapshot: {
          customer_id: 'cust_b2c_long',
          customer_type: 'INDIVIDUAL',
          full_name: 'Super Long Customer Name With Multiple Middle Names And Suffixes Senior',
          email: 'longname@example.com',
          phone: '+919999999999',
          gst_verified: false,
          address_line_1: 'Flat 1204, Tower B, Whispering Palms Residency Phase 2, Near Mindspace Business Park, Off Western Express Highway',
          address_line_2: 'Malad East, Landmark Opposite Metro Station Entrance Gate 3',
          city: 'Mumbai',
          state: 'Maharashtra',
          state_code: '27',
          pincode: '400097',
          country: 'India'
        },
        line_items: [
          {
            line_id: 'line_long',
            product_id: 'prod_long',
            sku: 'KL-LONG-DESC-SKU-99',
            product_name: 'Tailored French Organic Unbleached Hand-Woven Pure Flax Linen Casual Band Collar Executive Shirt - Limited Bespoke Edition',
            variant: 'Size: Custom Tailored 42R | Monogrammed Cuff | Natural Off-White Color',
            quantity: 1,
            unit_price: 15000,
            gross_amount: 15000,
            line_discount: 1500,
            taxable_value: 13500,
            hsn_code: '6205',
            gst_rate: 12,
            cgst_rate: 6,
            cgst_amount: 810,
            sgst_rate: 6,
            sgst_amount: 810,
            igst_rate: 0,
            igst_amount: 0,
            line_total: 15120
          }
        ]
      });

      const buffer = await generateGstInvoicePdfBuffer(inv);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('11. strictly performs zero mutations on input invoice snapshot object', async () => {
      const inv = createMockInvoice();
      const originalJson = JSON.stringify(inv);

      await generateGstInvoicePdfBuffer(inv);

      const afterJson = JSON.stringify(inv);
      expect(afterJson).toBe(originalJson);
    });
  });
});
