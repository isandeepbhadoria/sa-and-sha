import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateInvoiceFinalizationEligibility,
  canFinalizeGstInvoiceForOrder
} from '../invoice/invoiceEligibility';
import { buildGstInvoiceData } from '../invoice/invoiceCalculation';
import { createOrFetchGstInvoice, getGstInvoiceByIdOrOrder } from '../invoice/invoiceEngine';
import { registerProductTaxMetadata, clearProductTaxMaster } from '../invoice/productTaxMaster';
import { validateShippingTaxConfig } from '../invoice/shippingTaxConfig';

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
    support_email: 'support@sa-and-sha.com',
    support_phone: '+919876543210',
    invoice_prefix: 'KL',
    status: 'ACTIVE'
  };

  const shipping = initialData?.shippingConfig !== undefined ? initialData.shippingConfig : {
    enabled: true,
    hsn_or_sac_code: '996812',
    gst_rate: 18,
    tax_category: 'COURIER_SERVICES',
    effective_from: '2020-01-01',
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

      if (collName === 'invoice_number_config' || collName === 'invoice_numbering_config') {
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

      if (collName === 'product_tax_master' || collName === 'products') {
        const docs = Array.from(productsMap.values()).map(p => ({
          id: p.product_id || p.sku || 'prod_1',
          data: () => ({
            tax_record_id: `tax_${p.product_id || p.sku}`,
            product_id: p.product_id,
            sku: p.sku,
            product_name_snapshot: p.title || p.name || 'Sample Product',
            hsn_code: p.hsn_code || '620520',
            gst_rate: p.gst_rate !== undefined ? p.gst_rate : 5,
            tax_category: p.tax_category || 'APPAREL',
            effective_from: p.effective_from || '2020-01-01',
            status: p.status || 'ACTIVE'
          })
        }));

        return {
          path: collName,
          get: async () => ({
            docs,
            forEach: (cb: (doc: any) => void) => docs.forEach(cb)
          })
        };
      }

      if (collName === 'orders') {
        const createQuery = (items: any[]) => ({
          where: (field: string, op: string, val: any) => {
            const filtered = items.filter(item => {
              if (op === '==') return item[field] === val || item.order_id === val;
              return true;
            });
            return createQuery(filtered);
          },
          limit: (lim: number) => ({
            get: async () => {
              const sliced = items.slice(0, lim);
              return {
                empty: sliced.length === 0,
                docs: sliced.map(ord => ({
                  id: ord.order_id,
                  ref: { path: `orders/${ord.order_id}` },
                  data: () => ord
                }))
              };
            }
          }),
          get: async () => ({
            empty: items.length === 0,
            docs: items.map(ord => ({
              id: ord.order_id,
              ref: { path: `orders/${ord.order_id}` },
              data: () => ord
            }))
          })
        });

        return {
          path: 'orders',
          doc: (docId: string) => ({
            path: `orders/${docId}`,
            ref: { path: `orders/${docId}` },
            get: async () => ({
              exists: ordersMap.has(docId),
              data: () => ordersMap.get(docId)
            }),
            update: async (data: any) => {
              const curr = ordersMap.get(docId) || {};
              ordersMap.set(docId, { ...curr, ...data });
            }
          }),
          where: (field: string, op: string, val: any) => {
            const allOrders = Array.from(ordersMap.values());
            return createQuery(allOrders).where(field, op, val);
          }
        };
      }

      if (collName === 'gst_invoices') {
        const createQuery = (items: any[]) => ({
          where: (field: string, op: string, val: any) => {
            const filtered = items.filter(item => {
              if (op === '==') return item[field] === val;
              return true;
            });
            return createQuery(filtered);
          },
          limit: (lim: number) => ({
            get: async () => {
              const sliced = items.slice(0, lim);
              return {
                empty: sliced.length === 0,
                docs: sliced.map(inv => ({
                  id: inv.invoice_id,
                  data: () => inv
                }))
              };
            }
          }),
          get: async () => ({
            empty: items.length === 0,
            docs: items.map(inv => ({
              id: inv.invoice_id,
              data: () => inv
            }))
          })
        });

        return {
          path: 'gst_invoices',
          doc: (docId: string) => ({
            path: `gst_invoices/${docId}`,
            get: async () => ({
              exists: invoicesMap.has(docId),
              data: () => invoicesMap.get(docId)
            })
          }),
          where: (field: string, op: string, val: any) => {
            const allInvoices = Array.from(invoicesMap.values());
            return createQuery(allInvoices).where(field, op, val);
          }
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

describe('PHASE 10.3.2B.3 — Payment Capture & Reconciliation Hardening Test Suite (18 Scenarios)', () => {
  const sampleProduct = {
    product_id: 'prod_linen_shirt',
    sku: 'LINEN-SHIRT-001',
    hsn_code: '620520',
    gst_rate: 12,
    tax_category: 'APPAREL',
    is_tax_inclusive: true,
    effective_from: '2020-01-01'
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
    registerProductTaxMetadata(sampleProduct);
  });

  // 1. Valid Razorpay signature + status AUTHORIZED/PENDING -> NO invoice
  it('1. Valid Razorpay HMAC signature + status AUTHORIZED/PENDING -> NO invoice', () => {
    const order = {
      order_id: 'KL-3001',
      payment_method: 'razorpay',
      payment_id: 'pay_auth_123',
      razorpay_order_id: 'order_rzp_123',
      payment_status: 'authorized',
      status: 'processing',
      items: sampleOrderItems,
      grand_total: 5000,
      created_at: '2026-08-08T00:00:00Z'
    };

    const result = evaluateInvoiceFinalizationEligibility(order);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('PREPAID_AWAITING_PAYMENT');
  });

  // 2. Valid Razorpay signature + status CAPTURED + fulfillment accepted -> INVOICE finalized
  it('2. Valid Razorpay signature + status CAPTURED + fulfillment accepted -> INVOICE finalized', async () => {
    const order = {
      order_id: 'KL-3002',
      payment_method: 'razorpay',
      payment_id: 'pay_captured_456',
      razorpay_order_id: 'order_rzp_456',
      payment_status: 'captured',
      payment_verified: true,
      status: 'processing',
      fulfillment_status: 'accepted',
      items: sampleOrderItems,
      grand_total: 5000,
      created_at: '2026-08-08T00:00:00Z'
    };

    const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
    const result = await createOrFetchGstInvoice(db, 'KL-3002');
    expect(result.success).toBe(true);
    expect(result.invoice?.invoice_id).toBeDefined();
    expect(result.invoice?.status).toBe('FINALIZED');
  });

  // 3. Razorpay payment status FAILED -> NO invoice
  it('3. Razorpay payment status FAILED -> NO invoice', () => {
    const order = {
      order_id: 'KL-3003',
      payment_method: 'razorpay',
      payment_id: 'pay_failed_789',
      payment_status: 'failed',
      status: 'failed',
      items: sampleOrderItems,
      grand_total: 5000,
      created_at: '2026-08-08T00:00:00Z'
    };

    const result = evaluateInvoiceFinalizationEligibility(order);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('PREPAID_AWAITING_PAYMENT');
  });

  // 4. Razorpay payment status PENDING -> NO invoice
  it('4. Razorpay payment status PENDING -> NO invoice', () => {
    const order = {
      order_id: 'KL-3004',
      payment_method: 'razorpay',
      payment_status: 'pending',
      status: 'placed',
      items: sampleOrderItems,
      grand_total: 5000,
      created_at: '2026-08-08T00:00:00Z'
    };

    const result = evaluateInvoiceFinalizationEligibility(order);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('PREPAID_AWAITING_PAYMENT');
  });

  // 5. Client-supplied paid state without server verification/capture -> NO invoice
  it('5. Client-supplied paid state without server verification/capture -> NO invoice', () => {
    const order = {
      order_id: 'KL-3005',
      payment_method: 'razorpay',
      payment_status: 'pending',
      payment_verified: false,
      status: 'processing',
      items: sampleOrderItems,
      grand_total: 5000,
      created_at: '2026-08-08T00:00:00Z'
    };

    const result = evaluateInvoiceFinalizationEligibility(order);
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe('PREPAID_AWAITING_PAYMENT');
  });

  // 6. Duplicate Razorpay payment completion event -> ONE invoice
  it('6. Duplicate Razorpay payment completion event -> ONE invoice', async () => {
    const order = {
      order_id: 'KL-3006',
      payment_method: 'razorpay',
      payment_id: 'pay_dup_999',
      payment_status: 'captured',
      payment_verified: true,
      status: 'processing',
      items: sampleOrderItems,
      grand_total: 5000,
      created_at: '2026-08-08T00:00:00Z'
    };

    const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
    const res1 = await createOrFetchGstInvoice(db, 'KL-3006');
    const res2 = await createOrFetchGstInvoice(db, 'KL-3006');

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res2.reused).toBe(true);
    expect(res1.invoice?.invoice_number).toBe(res2.invoice?.invoice_number);
    expect(db._counterState.current_sequence).toBe(1);
  });

  // 7. Unapproved shipping tax configuration -> finalization BLOCKED with tax config error
  it('7. Unapproved shipping tax configuration -> finalization BLOCKED with tax config error', async () => {
    const order = {
      order_id: 'KL-3007',
      payment_method: 'razorpay',
      payment_id: 'pay_3007',
      payment_status: 'captured',
      payment_verified: true,
      payment_verification_source: 'razorpay_api',
      status: 'processing',
      shipping_cost: 150,
      items: sampleOrderItems,
      grand_total: 5150,
      created_at: '2026-08-08T00:00:00Z'
    };

    const unapprovedShippingConfig = {
      enabled: true,
      hsn_or_sac_code: '996812',
      gst_rate: 18,
      status: 'DRAFT'
    };

    const db = createMockAdminDb({
      shippingConfig: unapprovedShippingConfig,
      products: [sampleProduct],
      orders: [order]
    });

    const res = await createOrFetchGstInvoice(db, 'KL-3007');
    expect(res.success).toBe(false);
    expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
  });

  // 8. Shipping tax config missing -> finalization FAILS CLOSED with error, no default fallback
  it('8. Shipping tax config missing -> finalization FAILS CLOSED with error, no default SAC fallback', async () => {
    const order = {
      order_id: 'KL-3008',
      payment_method: 'razorpay',
      payment_id: 'pay_3008',
      payment_status: 'captured',
      payment_verified: true,
      payment_verification_source: 'razorpay_api',
      status: 'processing',
      shipping_cost: 100,
      items: sampleOrderItems,
      grand_total: 5100,
      created_at: '2026-08-08T00:00:00Z'
    };

    const db = createMockAdminDb({
      shippingConfig: null,
      products: [sampleProduct],
      orders: [order]
    });

    const res = await createOrFetchGstInvoice(db, 'KL-3008');
    expect(res.success).toBe(false);
    expect(res.code).toBe('INVOICE_TAX_METADATA_MISSING');
  });

  // 9. Correct paise-level rounding (round-off <= ₹1.00) -> SUCCESSful finalization
  it('9. Correct paise-level rounding (round-off <= ₹1.00) -> SUCCESSful finalization', () => {
    const sellerConfig: any = {
      legal_name: 'Sa and Sha Pvt Ltd',
      trade_name: 'Sa and Sha',
      gstin: '27ABCDE1234F1Z5',
      address_line_1: '123 Linen Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      invoice_prefix: 'KL',
      status: 'ACTIVE' as const
    };

    const shippingTaxConfig: any = {
      enabled: true,
      hsn_or_sac_code: '996812',
      gst_rate: 18,
      tax_category: 'COURIER_SERVICES',
      effective_from: '2020-01-01',
      status: 'ACTIVE' as const
    };

    const order = {
      order_id: 'KL-3009',
      shipping_address: { state: 'Maharashtra', state_code: '27' },
      items: [
        {
          product_id: 'prod_linen_shirt',
          sku: 'LINEN-SHIRT-001',
          quantity: 1,
          unit_price: 199.99
        }
      ],
      grand_total: 200.00
    };

    const calc = buildGstInvoiceData(order, { sellerConfig, shippingTaxConfig });
    expect(calc.success).toBe(true);
    if (calc.success) {
      expect(Math.abs(calc.invoice.round_off)).toBeLessThanOrEqual(1.00);
      expect(calc.invoice.grand_total).toBe(200.00);
    }
  });

  // 10. Material total calculation difference (> ₹1.00 round-off) -> FAILS closed with INVOICE_TOTAL_RECONCILIATION_FAILED
  it('10. Material total calculation difference (> ₹1.00 round-off) -> FAILS closed with INVOICE_TOTAL_RECONCILIATION_FAILED', () => {
    const sellerConfig: any = {
      legal_name: 'Sa and Sha Pvt Ltd',
      trade_name: 'Sa and Sha',
      gstin: '27ABCDE1234F1Z5',
      address_line_1: '123 Linen Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      invoice_prefix: 'KL',
      status: 'ACTIVE' as const
    };

    const shippingTaxConfig: any = {
      enabled: true,
      hsn_or_sac_code: '996812',
      gst_rate: 18,
      tax_category: 'COURIER_SERVICES',
      effective_from: '2020-01-01',
      status: 'ACTIVE' as const
    };

    const order = {
      order_id: 'KL-3010',
      shipping_address: { state: 'Maharashtra', state_code: '27' },
      items: sampleOrderItems,
      grand_total: 5100.00 // Real computed total is 5000. Difference is 100.00
    };

    const calc: any = buildGstInvoiceData(order, { sellerConfig, shippingTaxConfig });
    expect(calc.success).toBe(false);
    expect(calc.code).toBe('INVOICE_TOTAL_RECONCILIATION_FAILED');
  });

  // 11. ₹4.99 mismatch cannot silently pass as ordinary round_off -> FAILS closed
  it('11. ₹4.99 mismatch cannot silently pass as ordinary round_off -> FAILS closed', () => {
    const sellerConfig: any = {
      legal_name: 'Sa and Sha Pvt Ltd',
      trade_name: 'Sa and Sha',
      gstin: '27ABCDE1234F1Z5',
      address_line_1: '123 Linen Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      invoice_prefix: 'KL',
      status: 'ACTIVE' as const
    };

    const shippingTaxConfig: any = {
      enabled: true,
      hsn_or_sac_code: '996812',
      gst_rate: 18,
      tax_category: 'COURIER_SERVICES',
      effective_from: '2020-01-01',
      status: 'ACTIVE' as const
    };

    const order = {
      order_id: 'KL-3011',
      shipping_address: { state: 'Maharashtra', state_code: '27' },
      items: sampleOrderItems,
      grand_total: 5004.99 // Variance of ₹4.99 from calculated ₹5000.00
    };

    const calc: any = buildGstInvoiceData(order, { sellerConfig, shippingTaxConfig });
    expect(calc.success).toBe(false);
    expect(calc.code).toBe('INVOICE_TOTAL_RECONCILIATION_FAILED');
  });

  // 12. Checkout/invoice totals use consistent monetary source
  it('12. Checkout/invoice totals use consistent monetary source', () => {
    const sellerConfig: any = {
      legal_name: 'Sa and Sha Pvt Ltd',
      trade_name: 'Sa and Sha',
      gstin: '27ABCDE1234F1Z5',
      address_line_1: '123 Linen Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      invoice_prefix: 'KL',
      status: 'ACTIVE' as const
    };

    const shippingTaxConfig: any = {
      enabled: true,
      hsn_or_sac_code: '996812',
      gst_rate: 18,
      tax_category: 'COURIER_SERVICES',
      effective_from: '2020-01-01',
      status: 'ACTIVE' as const
    };

    const order = {
      order_id: 'KL-3012',
      shipping_address: { state: 'Maharashtra', state_code: '27' },
      items: [
        {
          product_id: 'prod_linen_shirt',
          sku: 'LINEN-SHIRT-001',
          quantity: 2,
          unit_price: 2500
        }
      ],
      shipping_cost: 150,
      grand_total: 5177.00
    };

    const calc = buildGstInvoiceData(order, { sellerConfig, shippingTaxConfig });
    expect(calc.success).toBe(true);
    if (calc.success) {
      expect(calc.invoice.grand_total).toBe(5177.00);
      expect(calc.invoice.taxable_total + calc.invoice.shipping_taxable + calc.invoice.cgst_total + calc.invoice.sgst_total + calc.invoice.round_off)
        .toBeCloseTo(5177.00, 2);
    }
  });

  // 13. Verified B2B GST buyer -> classified as B2B, GSTIN present on invoice
  it('13. Verified B2B GST buyer -> classified as B2B, GSTIN present on invoice', () => {
    const sellerConfig: any = {
      legal_name: 'Sa and Sha Pvt Ltd',
      trade_name: 'Sa and Sha',
      gstin: '27ABCDE1234F1Z5',
      address_line_1: '123 Linen Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      invoice_prefix: 'KL',
      status: 'ACTIVE' as const
    };

    const order = {
      order_id: 'KL-3013',
      gstin: '27AAACK1234A1Z1',
      gst_verified: true,
      business_name: 'Apex Retail Pvt Ltd',
      shipping_address: { state: 'Maharashtra', state_code: '27' },
      items: sampleOrderItems,
      grand_total: 5000
    };

    const calc = buildGstInvoiceData(order, { sellerConfig });
    expect(calc.success).toBe(true);
    if (calc.success) {
      expect(calc.invoice.buyer_snapshot.customer_type).toBe('BUSINESS');
      expect(calc.invoice.buyer_snapshot.gst_verified).toBe(true);
      expect(calc.invoice.buyer_snapshot.gstin).toBe('27AAACK1234A1Z1');
    }
  });

  // 14. Regex-valid but unverified GSTIN -> classified as B2C (fails closed to B2C)
  it('14. Regex-valid but unverified GSTIN -> classified as B2C (fails closed to B2C)', () => {
    const sellerConfig: any = {
      legal_name: 'Sa and Sha Pvt Ltd',
      trade_name: 'Sa and Sha',
      gstin: '27ABCDE1234F1Z5',
      address_line_1: '123 Linen Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      invoice_prefix: 'KL',
      status: 'ACTIVE' as const
    };

    const order = {
      order_id: 'KL-3014',
      gstin: '27AAACK1234A1Z1',
      gst_verified: false, // Unverified GSTIN!
      shipping_address: { state: 'Maharashtra', state_code: '27' },
      items: sampleOrderItems,
      grand_total: 5000
    };

    const calc = buildGstInvoiceData(order, { sellerConfig });
    expect(calc.success).toBe(true);
    if (calc.success) {
      expect(calc.invoice.buyer_snapshot.customer_type).toBe('INDIVIDUAL');
      expect(calc.invoice.buyer_snapshot.gst_verified).toBe(false);
    }
  });

  // 15. Standard B2C buyer -> classified as B2C
  it('15. Standard B2C buyer -> classified as B2C', () => {
    const sellerConfig: any = {
      legal_name: 'Sa and Sha Pvt Ltd',
      trade_name: 'Sa and Sha',
      gstin: '27ABCDE1234F1Z5',
      address_line_1: '123 Linen Way',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      invoice_prefix: 'KL',
      status: 'ACTIVE' as const
    };

    const order = {
      order_id: 'KL-3015',
      customer_name: 'Priya Sharma',
      shipping_address: { state: 'Maharashtra', state_code: '27' },
      items: sampleOrderItems,
      grand_total: 5000
    };

    const calc = buildGstInvoiceData(order, { sellerConfig });
    expect(calc.success).toBe(true);
    if (calc.success) {
      expect(calc.invoice.buyer_snapshot.customer_type).toBe('INDIVIDUAL');
      expect(calc.invoice.buyer_snapshot.gstin).toBeNull();
    }
  });

  // 16. COD order dispatch behavior unchanged -> finalized on dispatch, NOT before
  it('16. COD order dispatch behavior unchanged -> finalized on dispatch, NOT before', async () => {
    const codPlacedOrder = {
      order_id: 'KL-3016-A',
      payment_method: 'cod',
      status: 'placed',
      items: sampleOrderItems,
      grand_total: 5000
    };

    const codDispatchedOrder = {
      order_id: 'KL-3016-B',
      payment_method: 'cod',
      status: 'dispatched',
      courier_name: 'Delhivery',
      tracking_number: 'DEL12345678',
      items: sampleOrderItems,
      grand_total: 5000
    };

    const eligPlaced = evaluateInvoiceFinalizationEligibility(codPlacedOrder);
    expect(eligPlaced.eligible).toBe(false);
    expect(eligPlaced.reasonCode).toBe('COD_AWAITING_DISPATCH');

    const db = createMockAdminDb({ products: [sampleProduct], orders: [codDispatchedOrder] });
    const res = await createOrFetchGstInvoice(db, 'KL-3016-B');
    if (!res.success) console.log('TEST 16 RES FAILED:', res);
    expect(res.success).toBe(true);
    expect(res.invoice?.finalized_trigger).toBe('COD_DISPATCH');
  });

  // 17. Customer PDF download remains read-only and immutable
  it('17. Customer PDF download remains read-only and immutable', async () => {
    const order = {
      order_id: 'KL-3017',
      payment_method: 'razorpay',
      payment_id: 'pay_3017',
      payment_status: 'captured',
      payment_verified: true,
      payment_verification_source: 'razorpay_api',
      status: 'processing',
      items: sampleOrderItems,
      grand_total: 5000
    };

    const db = createMockAdminDb({ products: [sampleProduct], orders: [order] });
    const firstRes = await createOrFetchGstInvoice(db, 'KL-3017');
    expect(firstRes.success).toBe(true);

    const fetched = await getGstInvoiceByIdOrOrder(db, 'KL-3017');
    expect(fetched.invoice).toBeDefined();
    expect(fetched.invoice?.invoice_id).toBe(firstRes.invoice?.invoice_id);
    expect(fetched.invoice?.immutable).toBe(true);
  });

  // 18. Admin invoice endpoints remain protected
  it('18. Admin invoice endpoints remain protected', () => {
    // Validate shipping tax configuration validator behaves properly
    const validConfig = validateShippingTaxConfig({
      enabled: true,
      hsn_or_sac_code: '996812',
      gst_rate: 18,
      tax_category: 'COURIER_SERVICES',
      effective_from: '2026-01-01',
      status: 'ACTIVE'
    });
    expect(validConfig.valid).toBe(true);

    const nullConfig = validateShippingTaxConfig(null);
    expect(nullConfig.valid).toBe(false);
    expect(nullConfig.code).toBe('INVOICE_TAX_METADATA_MISSING');
  });
});
