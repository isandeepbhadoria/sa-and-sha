import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateInvoiceFinalizationEligibility,
  canFinalizeGstInvoiceForOrder
} from '../invoice/invoiceEligibility';
import { createOrFetchGstInvoice, getGstInvoiceByIdOrOrder } from '../invoice/invoiceEngine';
import { registerProductTaxMetadata, clearProductTaxMaster, initDefaultTaxMasterStore } from '../invoice/productTaxMaster';

// Mock Firestore Admin DB Helper
function createMockAdminDb(initialData?: {
  sellerConfig?: any;
  shippingConfig?: any;
  numberingConfig?: any;
  products?: any[];
  orders?: any[];
  invoices?: any[];
  counter?: any;
}) {
  const seller = initialData?.sellerConfig !== undefined ? initialData.sellerConfig : {
    legal_name: 'Sa and Sha Pvt Ltd',
    trade_name: 'Sa and Sha',
    gstin: '27ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    address_line_1: '123 Linen Way',
    address_line_2: 'Suite 100',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '400001',
    country: 'India',
    support_email: 'support@saandsha.com',
    support_phone: '+919876543210',
    invoice_prefix: 'KL',
    status: 'ACTIVE'
  };

  const shipping = initialData?.shippingConfig || {
    enabled: true,
    hsn_or_sac_code: '996812',
    gst_rate: 18,
    tax_category: 'COURIER_SERVICES',
    effective_from: '2026-01-01',
    status: 'ACTIVE'
  };

  const numbering = initialData?.numberingConfig || {
    prefix: 'KL',
    separator: '/',
    sequence_padding: 6,
    is_active: true,
    status: 'ACTIVE'
  };

  const ordersMap = new Map<string, any>();
  if (initialData?.orders) {
    for (const o of initialData.orders) {
      ordersMap.set(o.order_id, { ...o });
    }
  }

  const invoicesMap = new Map<string, any>();
  if (initialData?.invoices) {
    for (const inv of initialData.invoices) {
      invoicesMap.set(inv.invoice_id || inv.order_id, { ...inv });
    }
  }

  const productsMap = new Map<string, any>();
  if (initialData?.products) {
    for (const p of initialData.products) {
      productsMap.set(p.product_id || p.sku, { ...p });
    }
  }

  let counterState = initialData?.counter || {
    financial_year: '2026-27',
    current_sequence: 0
  };

  const auditLogs: any[] = [];

  const mockDb = {
    _ordersMap: ordersMap,
    _invoicesMap: invoicesMap,
    _counterState: counterState,
    _auditLogs: auditLogs,
    collection: (collName: string) => {
      if (collName === 'system_tax_config') {
        return {
          doc: (docId: string) => ({
            path: `system_tax_config/${docId}`,
            get: async () => ({
              exists: docId === 'seller_gst' && !!seller,
              data: () => (docId === 'seller_gst' ? seller : null)
            })
          })
        };
      }

      if (collName === 'shipping_tax_config') {
        return {
          doc: (docId: string) => ({
            path: `shipping_tax_config/${docId}`,
            get: async () => ({
              exists: docId === 'default' && !!shipping,
              data: () => (docId === 'default' ? shipping : null)
            })
          })
        };
      }

      if (collName === 'invoice_number_config') {
        return {
          doc: (docId: string) => ({
            path: `invoice_number_config/${docId}`,
            get: async () => ({
              exists: docId === 'default' && !!numbering,
              data: () => (docId === 'default' ? numbering : null)
            })
          })
        };
      }

      if (collName === 'product_tax_master') {
        const docs = Array.from(productsMap.values()).map(p => ({
          id: p.product_id || p.sku,
          data: () => p
        }));
        return {
          path: 'product_tax_master',
          get: async () => ({
            docs,
            forEach: (cb: any) => docs.forEach(cb)
          })
        };
      }

      if (collName === 'orders') {
        const queryOrders = (f: string, v: any) => {
          const results: any[] = [];
          for (const [id, o] of ordersMap.entries()) {
            if (o[f] === v) {
              results.push({ id, ref: { id, path: `orders/${id}` }, data: () => o });
            }
          }
          return { empty: results.length === 0, docs: results, forEach: (cb: any) => results.forEach(cb) };
        };

        return {
          path: 'orders',
          where: (field: string, op: string, val: any) => ({
            limit: (l: number) => ({
              get: async () => queryOrders(field, val)
            }),
            get: async () => queryOrders(field, val)
          }),
          doc: (docId: string) => ({
            path: `orders/${docId}`,
            get: async () => ({
              exists: ordersMap.has(docId),
              data: () => ordersMap.get(docId)
            }),
            update: async (fields: any) => {
              const curr = ordersMap.get(docId) || {};
              ordersMap.set(docId, { ...curr, ...fields });
            }
          })
        };
      }

      if (collName === 'gst_invoices') {
        const queryInvoices = (filters: Array<{ f: string; v: any }>) => {
          const results: any[] = [];
          for (const [id, inv] of invoicesMap.entries()) {
            if (filters.every(filter => inv[filter.f] === filter.v)) {
              results.push({ id: inv.invoice_id || id, data: () => inv });
            }
          }
          return { empty: results.length === 0, docs: results, forEach: (cb: any) => results.forEach(cb) };
        };

        const createQuery = (filters: Array<{ f: string; v: any }>): any => ({
          where: (f2: string, op2: string, v2: any) => createQuery([...filters, { f: f2, v: v2 }]),
          limit: (l: number) => ({
            get: async () => queryInvoices(filters)
          }),
          get: async () => queryInvoices(filters)
        });

        return {
          path: 'gst_invoices',
          where: (field: string, op: string, val: any) => createQuery([{ f: field, v: val }]),
          doc: (docId: string) => ({
            path: `gst_invoices/${docId}`,
            get: async () => ({
              exists: invoicesMap.has(docId),
              data: () => invoicesMap.get(docId)
            })
          })
        };
      }

      if (collName === 'counters') {
        return {
          path: 'counters',
          doc: (docId: string) => ({
            path: `counters/${docId}`,
            get: async () => ({
              exists: docId === 'gst_invoice_counter',
              data: () => counterState
            })
          })
        };
      }

      if (collName === 'admin_audit_logs') {
        return {
          path: 'admin_audit_logs',
          doc: (docId: string = 'audit_doc') => ({
            path: `admin_audit_logs/${docId}`,
            set: async (data: any) => {
              auditLogs.push(data);
            }
          }),
          add: async (data: any) => {
            auditLogs.push(data);
          }
        };
      }

      return {
        path: collName,
        doc: (docId: string) => ({ path: `${collName}/${docId}` })
      };
    },
    runTransaction: async (cb: any) => {
      const mockTx = {
        get: async (ref: any) => {
          if (ref.path === 'counters/gst_invoice_counter') {
            return {
              exists: true,
              data: () => counterState
            };
          }
          if (ref.path?.startsWith('gst_invoices/')) {
            const docId = ref.path.replace('gst_invoices/', '');
            return {
              exists: invoicesMap.has(docId),
              data: () => invoicesMap.get(docId)
            };
          }
          if (ref.path?.startsWith('orders/')) {
            const docId = ref.path.replace('orders/', '');
            return {
              exists: ordersMap.has(docId),
              data: () => ordersMap.get(docId)
            };
          }
          return { exists: false, data: () => null };
        },
        set: (ref: any, data: any) => {
          if (ref.path === 'counters/gst_invoice_counter') {
            Object.assign(counterState, data);
          } else if (ref.path?.startsWith('gst_invoices/')) {
            const docId = ref.path.replace('gst_invoices/', '');
            invoicesMap.set(docId, data);
          } else if (ref.path?.startsWith('admin_audit_logs/')) {
            auditLogs.push(data);
          }
        },
        update: (ref: any, data: any) => {
          if (ref.path?.startsWith('orders/')) {
            const docId = ref.path.replace('orders/', '');
            const curr = ordersMap.get(docId) || {};
            ordersMap.set(docId, { ...curr, ...data });
          }
        }
      };
      return await cb(mockTx);
    }
  };

  return mockDb;
}

describe('PHASE 10.3.2B — Production GST Invoice Finalization Lifecycle Matrix', () => {
  const sampleProduct = {
    product_id: 'prod_linen_shirt',
    sku: 'LINEN-SHIRT-001',
    hsn_code: '620520',
    gst_rate: 12,
    tax_category: 'APPAREL',
    is_tax_inclusive: true,
    effective_from: '2026-01-01'
  };

  const sampleOrderItems = [
    {
      product_id: 'prod_linen_shirt',
      sku: 'LINEN-SHIRT-001',
      title: 'Pure Linen Shirt',
      quantity: 2,
      unit_price: 2500,
      line_total: 5000
    }
  ];

  beforeEach(() => {
    clearProductTaxMaster();
    initDefaultTaxMasterStore();
    registerProductTaxMetadata(sampleProduct);
  });

  // ==========================================
  // PREPAID / RAZORPAY TEST MATRIX (1 - 9)
  // ==========================================
  describe('PREPAID / RAZORPAY MATRIX', () => {
    it('1. Payment pending + fulfillment not accepted → no invoice', () => {
      const order = {
        order_id: 'KL-1001',
        payment_method: 'razorpay',
        payment_status: 'pending',
        status: 'placed',
        created_at: '2026-08-08T00:00:00Z'
      };
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('PREPAID_AWAITING_PAYMENT');
    });

    it('2. Payment paid + fulfillment not accepted → no invoice', () => {
      const order = {
        order_id: 'KL-1002',
        payment_method: 'razorpay',
        payment_id: 'pay_1002',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'placed',
        created_at: '2026-08-08T00:00:00Z'
      };
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('PREPAID_AWAITING_FULFILLMENT_ACCEPTANCE');
    });

    it('3. Payment pending + fulfillment accepted → no invoice', () => {
      const order = {
        order_id: 'KL-1003',
        payment_method: 'razorpay',
        payment_status: 'pending',
        status: 'processing',
        created_at: '2026-08-08T00:00:00Z'
      };
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('PREPAID_AWAITING_PAYMENT');
    });

    it('4. Payment verified/captured + fulfillment accepted → invoice finalized', async () => {
      const order = {
        order_id: 'KL-1004',
        payment_method: 'razorpay',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        payment_id: 'pay_rzp_1004',
        status: 'processing',
        customer_email: 'buyer@saandsha.com',
        customer_name: 'Ananya Sharma',
        shipping_address: { state: 'Maharashtra' },
        items: sampleOrderItems,
        subtotal: 5000,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const eligibility = evaluateInvoiceFinalizationEligibility(order);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reasonCode).toBe('PREPAID_FULFILLMENT_ACCEPTED_ELIGIBLE');

      const result = await createOrFetchGstInvoice(db, 'KL-1004', { createdBy: 'admin' });
      expect(result.success).toBe(true);
      expect(result.reused).toBe(false);
      expect(result.invoice?.invoice_number).toMatch(/KL\/(2026-27|26-27)\/000001/);
      expect(result.invoice?.finalized_trigger).toBe('PREPAID_FULFILLMENT_ACCEPTED');
    });

    it('5. Duplicate payment webhook → one invoice', async () => {
      const order = {
        order_id: 'KL-1005',
        payment_method: 'razorpay',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        payment_id: 'pay_rzp_1005',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const res1 = await createOrFetchGstInvoice(db, 'KL-1005');
      expect(res1.success).toBe(true);
      expect(res1.reused).toBe(false);

      const res2 = await createOrFetchGstInvoice(db, 'KL-1005');
      expect(res2.success).toBe(true);
      expect(res2.reused).toBe(true);
      expect(res2.invoice?.invoice_number).toBe(res1.invoice?.invoice_number);
      expect(db._counterState.current_sequence).toBe(1);
    });

    it('6. Duplicate fulfillment event → one invoice', async () => {
      const order = {
        order_id: 'KL-1006',
        payment_method: 'razorpay',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        payment_id: 'pay_rzp_1006',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const firstCall = await createOrFetchGstInvoice(db, 'KL-1006');
      const secondCall = await createOrFetchGstInvoice(db, 'KL-1006');
      expect(secondCall.reused).toBe(true);
    });

    it('7. Concurrent payment + fulfillment events → one invoice', async () => {
      const order = {
        order_id: 'KL-1007',
        payment_method: 'razorpay',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        payment_id: 'pay_rzp_1007',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const [p1, p2] = await Promise.all([
        createOrFetchGstInvoice(db, 'KL-1007'),
        createOrFetchGstInvoice(db, 'KL-1007')
      ]);

      expect(p1.success && p2.success).toBe(true);
      const invoices = Array.from(db._invoicesMap.values());
      expect(invoices.length).toBe(1);
    });

    it('8. Failed payment → no invoice', async () => {
      const order = {
        order_id: 'KL-1008',
        payment_method: 'razorpay',
        payment_status: 'failed',
        status: 'failed',
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);

      const genRes = await createOrFetchGstInvoice(db, 'KL-1008');
      expect(genRes.success).toBe(false);
      expect(genRes.code).toBe('PREPAID_AWAITING_PAYMENT');
    });

    it('9. Cancelled before fulfillment → no invoice', async () => {
      const order = {
        order_id: 'KL-1009',
        payment_method: 'razorpay',
        payment_status: 'paid',
        status: 'cancelled',
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('ORDER_CANCELLED_OR_REFUNDED');

      const genRes = await createOrFetchGstInvoice(db, 'KL-1009');
      expect(genRes.success).toBe(false);
      expect(genRes.code).toBe('ORDER_CANCELLED_OR_REFUNDED');
    });
  });

  // ==========================================
  // COD MATRIX (10 - 17)
  // ==========================================
  describe('COD MATRIX', () => {
    it('10. COD placed → no invoice', () => {
      const order = {
        order_id: 'KL-2010',
        payment_method: 'cod',
        status: 'placed',
        created_at: '2026-08-08T00:00:00Z'
      };
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('COD_AWAITING_DISPATCH');
    });

    it('11. COD confirmed → no invoice', () => {
      const order = {
        order_id: 'KL-2011',
        payment_method: 'cod',
        status: 'confirmed',
        created_at: '2026-08-08T00:00:00Z'
      };
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('COD_AWAITING_DISPATCH');
    });

    it('12. COD packed → no invoice', () => {
      const order = {
        order_id: 'KL-2012',
        payment_method: 'cod',
        status: 'packed',
        created_at: '2026-08-08T00:00:00Z'
      };
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('COD_AWAITING_DISPATCH');
    });

    it('13. COD ready to ship → no invoice', () => {
      const order = {
        order_id: 'KL-2013',
        payment_method: 'cod',
        status: 'ready_to_ship',
        created_at: '2026-08-08T00:00:00Z'
      };
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('COD_AWAITING_DISPATCH');
    });

    it('14. COD dispatched → invoice finalized', async () => {
      const order = {
        order_id: 'KL-2014',
        payment_method: 'cod',
        status: 'dispatched',
        courier_name: 'BlueDart',
        tracking_number: 'AWB12345678',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const eligibility = evaluateInvoiceFinalizationEligibility(order);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reasonCode).toBe('COD_DISPATCH_ELIGIBLE');

      const result = await createOrFetchGstInvoice(db, 'KL-2014');
      expect(result.success).toBe(true);
      expect(result.invoice?.finalized_trigger).toBe('COD_DISPATCH');
    });

    it('15. Duplicate dispatch event → one invoice', async () => {
      const order = {
        order_id: 'KL-2015',
        payment_method: 'cod',
        status: 'dispatched',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const res1 = await createOrFetchGstInvoice(db, 'KL-2015');
      const res2 = await createOrFetchGstInvoice(db, 'KL-2015');
      expect(res1.success).toBe(true);
      expect(res2.reused).toBe(true);
      expect(db._counterState.current_sequence).toBe(1);
    });

    it('16. COD delivered after dispatch → no second invoice', async () => {
      const order = {
        order_id: 'KL-2016',
        payment_method: 'cod',
        status: 'delivered',
        invoice_id: 'inv_KL-2016_tax_invoice',
        invoice_status: 'FINALIZED',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const existingInv = {
        invoice_id: 'inv_KL-2016_tax_invoice',
        order_id: 'KL-2016',
        invoice_number: 'KL/2026-27/000005',
        invoice_type: 'TAX_INVOICE'
      };

      const db = createMockAdminDb({
        products: [sampleProduct],
        orders: [order],
        invoices: [existingInv]
      });

      const res = await createOrFetchGstInvoice(db, 'KL-2016');
      expect(res.success).toBe(true);
      expect(res.reused).toBe(true);
      expect(res.invoice?.invoice_number).toBe('KL/2026-27/000005');
    });

    it('17. COD cancelled before dispatch → no invoice', async () => {
      const order = {
        order_id: 'KL-2017',
        payment_method: 'cod',
        status: 'cancelled',
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const res = evaluateInvoiceFinalizationEligibility(order);
      expect(res.eligible).toBe(false);
      expect(res.reasonCode).toBe('ORDER_CANCELLED_OR_REFUNDED');
    });
  });

  // ==========================================
  // GENERAL MATRIX (18 - 30)
  // ==========================================
  describe('GENERAL MATRIX', () => {
    it('18. Customer download cannot finalize non-finalized invoice', async () => {
      const db = createMockAdminDb();
      const fetchRes = await getGstInvoiceByIdOrOrder(db, 'KL-NONEXISTENT');
      expect(fetchRes.success).toBe(false);
      expect(fetchRes.error).toContain('not found');
    });

    it('19. Admin duplicate finalization returns existing invoice', async () => {
      const order = {
        order_id: 'KL-3019',
        payment_method: 'razorpay',
        payment_id: 'pay_3019',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const first = await createOrFetchGstInvoice(db, 'KL-3019', { createdBy: 'admin' });
      const second = await createOrFetchGstInvoice(db, 'KL-3019', { createdBy: 'admin' });

      expect(first.success && second.success).toBe(true);
      expect(second.reused).toBe(true);
      expect(first.invoice?.invoice_number).toBe(second.invoice?.invoice_number);
    });

    it('20. Counter increments once', async () => {
      const order = {
        order_id: 'KL-3020',
        payment_method: 'razorpay',
        payment_id: 'pay_3020',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      await createOrFetchGstInvoice(db, 'KL-3020');
      await createOrFetchGstInvoice(db, 'KL-3020');
      await createOrFetchGstInvoice(db, 'KL-3020');

      expect(db._counterState.current_sequence).toBe(1);
    });

    it('21. Order invoice linkage written once', async () => {
      const order = {
        order_id: 'KL-3021',
        payment_method: 'razorpay',
        payment_id: 'pay_3021',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      await createOrFetchGstInvoice(db, 'KL-3021');

      const savedOrder = db._ordersMap.get('KL-3021');
      expect(savedOrder.invoice_status).toBe('FINALIZED');
      expect(savedOrder.invoice_id).toBeDefined();
      expect(savedOrder.invoice_number).toBeDefined();
    });

    it('22. Existing finalized invoice immutable upon later order cancellation', async () => {
      const existingInvoice = {
        invoice_id: 'inv_KL-3022_tax_invoice',
        order_id: 'KL-3022',
        invoice_number: 'KL/2026-27/000088',
        invoice_type: 'TAX_INVOICE',
        status: 'FINALIZED',
        grand_total: 5000
      };

      const order = {
        order_id: 'KL-3022',
        payment_method: 'razorpay',
        payment_id: 'pay_3022',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'cancelled',
        invoice_id: 'inv_KL-3022_tax_invoice',
        invoice_status: 'FINALIZED',
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({
        products: [sampleProduct],
        orders: [order],
        invoices: [existingInvoice]
      });

      const res = await createOrFetchGstInvoice(db, 'KL-3022');
      expect(res.success).toBe(true);
      expect(res.reused).toBe(true);
      expect(res.invoice?.invoice_number).toBe('KL/2026-27/000088');
      expect(res.invoice?.status).toBe('FINALIZED');
    });

    it('23. Missing GST seller master blocks finalization', async () => {
      const order = {
        order_id: 'KL-3023',
        payment_method: 'razorpay',
        payment_id: 'pay_3023',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 5000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({
        sellerConfig: null, // missing seller
        products: [sampleProduct],
        orders: [order]
      });

      const res = await createOrFetchGstInvoice(db, 'KL-3023');
      expect(res.success).toBe(false);
      expect(res.code).toBe('SELLER_TAX_CONFIGURATION_REQUIRED');
    });

    it('24. Missing product tax master blocks finalization', async () => {
      const order = {
        order_id: 'KL-3024',
        payment_method: 'razorpay',
        payment_id: 'pay_3024',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'processing',
        items: [{ product_id: 'unknown_prod', quantity: 1, unit_price: 1000 }],
        grand_total: 1000,
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [], orders: [order] });
      const res = await createOrFetchGstInvoice(db, 'KL-3024');
      expect(res.success).toBe(false);
      expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
    });

    it('25. Failed calculation / reconciliation blocks finalization', async () => {
      const order = {
        order_id: 'KL-3025',
        payment_method: 'razorpay',
        payment_id: 'pay_3025',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'processing',
        items: sampleOrderItems,
        grand_total: 999999, // mismatch grand total vs line total sum
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
      const res = await createOrFetchGstInvoice(db, 'KL-3025');
      expect(res.success).toBe(false);
      expect(res.code).toBe('INVOICE_TOTAL_RECONCILIATION_FAILED');
    });

    it('26. Customer Portal helper canFinalizeGstInvoiceForOrder behaves predictably', () => {
      expect(canFinalizeGstInvoiceForOrder({ payment_method: 'cod', status: 'placed' })).toBe(false);
      expect(canFinalizeGstInvoiceForOrder({ payment_method: 'cod', status: 'dispatched' })).toBe(true);
      expect(canFinalizeGstInvoiceForOrder({ payment_method: 'razorpay', payment_id: 'pay_rzp', payment_status: 'captured', payment_verified: true, payment_verification_source: 'razorpay_api', status: 'placed' })).toBe(false);
      expect(canFinalizeGstInvoiceForOrder({ payment_method: 'razorpay', payment_id: 'pay_rzp', payment_status: 'captured', payment_verified: true, payment_verification_source: 'razorpay_api', status: 'processing' })).toBe(true);
    });

    it('27. Checkout does not generate invoice for unfulfilled prepaid order', async () => {
      const unfulfilledPrepaidOrder = {
        order_id: 'KL-3027',
        payment_method: 'razorpay',
        payment_id: 'pay_3027',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'placed', // not yet processing/accepted
        created_at: '2026-08-08T00:00:00Z'
      };

      const db = createMockAdminDb({ products: [sampleProduct], orders: [unfulfilledPrepaidOrder] });
      const res = await createOrFetchGstInvoice(db, 'KL-3027', { createdBy: 'checkout' });
      expect(res.success).toBe(false);
      expect(res.code).toBe('PREPAID_AWAITING_FULFILLMENT_ACCEPTANCE');
      expect(db._invoicesMap.size).toBe(0);
    });

    it('28. PDF download fetches existing finalized invoice safely', async () => {
      const existingInvoice = {
        invoice_id: 'inv_KL-3028_tax_invoice',
        order_id: 'KL-3028',
        invoice_number: 'KL/2026-27/000099',
        invoice_type: 'TAX_INVOICE',
        status: 'FINALIZED',
        grand_total: 5000
      };

      const db = createMockAdminDb({ invoices: [existingInvoice] });
      const fetched = await getGstInvoiceByIdOrOrder(db, 'KL-3028');
      expect(fetched.success).toBe(true);
      expect(fetched.invoice?.invoice_number).toBe('KL/2026-27/000099');
    });

    it('29. Razorpay verification without fulfillment acceptance does not trigger finalization', async () => {
      const razorpayVerifiedOrder = {
        order_id: 'KL-3029',
        payment_method: 'razorpay',
        payment_id: 'pay_3029',
        payment_status: 'captured',
        payment_verified: true,
        payment_verification_source: 'razorpay_api',
        status: 'placed',
        created_at: '2026-08-08T00:00:00Z'
      };

      const eligibility = evaluateInvoiceFinalizationEligibility(razorpayVerifiedOrder);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reasonCode).toBe('PREPAID_AWAITING_FULFILLMENT_ACCEPTANCE');
    });

    it('30. COD tracking updates do not finalize before dispatch', () => {
      const codOrderTracking = {
        order_id: 'KL-3030',
        payment_method: 'cod',
        status: 'processing',
        created_at: '2026-08-08T00:00:00Z'
      };

      const eligibility = evaluateInvoiceFinalizationEligibility(codOrderTracking);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reasonCode).toBe('COD_AWAITING_DISPATCH');
    });
  });
});
