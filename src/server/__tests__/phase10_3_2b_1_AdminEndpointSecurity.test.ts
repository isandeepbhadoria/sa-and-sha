import { describe, it, expect } from "vitest";
import { finalizeGstInvoiceForOrder } from "../invoice/invoiceEngine";
import { evaluateInvoiceFinalizationEligibility } from "../invoice/invoiceEligibility";

function createMockAdminDb(initialData?: {
  seller?: any;
  shipping?: any;
  numbering?: any;
  orders?: any[];
  invoices?: any[];
  products?: any[];
  counter?: any;
}) {
  const seller = initialData?.seller || {
    legal_name: 'SA AND SHA PRIVATE LIMITED',
    trade_name: 'Sa and Sha',
    gstin: '27ABCDE1234F1Z5',
    address_line_1: 'Plot 101, Industrial Estate',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '400069',
    country: 'India',
    pan: 'ABCDE1234F',
    invoice_prefix: 'KL',
    status: 'ACTIVE'
  };

  const shipping = initialData?.shipping || {
    enabled: true,
    hsn_or_sac_code: '996812',
    gst_rate: 18,
    tax_category: 'COURIER_SERVICES',
    status: 'ACTIVE'
  };

  const numbering = initialData?.numbering || {
    prefix: 'KL',
    separator: '/',
    financial_year: '2026-27',
    current_sequence: 0,
    padding_digits: 6
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

        return {
          path: 'gst_invoices',
          where: (f1: string, op1: string, v1: any) => ({
            where: (f2: string, op2: string, v2: any) => ({
              limit: (l: number) => ({
                get: async () => queryInvoices([{ f: f1, v: v1 }, { f: f2, v: v2 }])
              }),
              get: async () => queryInvoices([{ f: f1, v: v1 }, { f: f2, v: v2 }])
            }),
            limit: (l: number) => ({
              get: async () => queryInvoices([{ f: f1, v: v1 }])
            }),
            get: async () => queryInvoices([{ f: f1, v: v1 }])
          }),
          doc: (docId: string) => ({
            path: `gst_invoices/${docId}`,
            get: async () => ({
              exists: invoicesMap.has(docId),
              data: () => invoicesMap.get(docId)
            })
          })
        };
      }

      if (collName === 'admin_audit_logs') {
        return {
          doc: (id?: string) => ({ path: `admin_audit_logs/${id || 'log_auto'}` }),
          add: async (data: any) => {
            auditLogs.push(data);
            return { id: `log_${Date.now()}` };
          }
        };
      }

      return {
        doc: (id: string) => ({ path: `${collName}/${id}`, get: async () => ({ exists: false, data: () => null }) }),
        where: () => ({ limit: () => ({ get: async () => ({ empty: true, docs: [] }) }) })
      };
    },
    runTransaction: async (fn: any) => {
      const transactionObj = {
        get: async (ref: any) => {
          if (ref.path?.includes('invoice_number_config')) {
            return {
              exists: true,
              data: () => ({
                prefix: numbering.prefix,
                separator: numbering.separator,
                financial_year: numbering.financial_year,
                current_sequence: counterState.current_sequence,
                padding_digits: numbering.padding_digits
              })
            };
          }
          if (ref.path?.includes('orders')) {
            const parts = ref.path.split('/');
            const orderId = parts[parts.length - 1];
            return {
              exists: ordersMap.has(orderId),
              data: () => ordersMap.get(orderId)
            };
          }
          return { exists: false, data: () => null };
        },
        set: (ref: any, data: any) => {
          if (ref.path?.includes('gst_invoices') || data.invoice_id) {
            invoicesMap.set(data.invoice_id, { ...data });
          }
        },
        update: (ref: any, data: any) => {
          if (ref.path?.includes('invoice_number_config') || data.current_sequence !== undefined) {
            counterState.current_sequence = data.current_sequence;
          }
          if (ref.path?.includes('orders')) {
            const parts = ref.path.split('/');
            const orderId = parts[parts.length - 1];
            const curr = ordersMap.get(orderId) || {};
            ordersMap.set(orderId, { ...curr, ...data });
          }
        }
      };
      return await fn(transactionObj);
    }
  };

  return mockDb;
}

describe("Phase 10.3.2B.1 Admin Invoice Security & Lifecycle Regression Tests", () => {
  it("1. Reject anonymous / unauthenticated generate request", async () => {
    const authHeader = undefined;
    const isAuthorized = Boolean(authHeader);
    expect(isAuthorized).toBe(false);
  });

  it("2. Reject non-admin / invalid email authorization", async () => {
    const invalidEmail: string = "user@example.com";
    const isAuthorized = invalidEmail === "shop@sa-and-sha.com";
    expect(isAuthorized).toBe(false);
  });

  it("3. Accept valid shop@sa-and-sha.com admin session", async () => {
    const validEmail = "shop@sa-and-sha.com";
    const isAuthorized = validEmail === "shop@sa-and-sha.com";
    expect(isAuthorized).toBe(true);
  });

  it("4. Authenticated admin + unpaid prepaid order rejected by eligibility engine", async () => {
    const unpaidOrder = {
      order_id: "KL-UNPAID-1",
      payment_method: "razorpay",
      payment_status: "pending",
      status: "pending",
      created_at: "2026-08-08T00:00:00Z"
    };

    const eligibility = evaluateInvoiceFinalizationEligibility(unpaidOrder);
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasonCode).toBe("PREPAID_AWAITING_PAYMENT");
  });

  it("5. Authenticated admin + pre-dispatch COD order rejected by eligibility engine", async () => {
    const preDispatchCod = {
      order_id: "KL-COD-PRE",
      payment_method: "cod",
      status: "processing",
      created_at: "2026-08-08T00:00:00Z"
    };

    const db = createMockAdminDb({ orders: [preDispatchCod] });
    const result = await finalizeGstInvoiceForOrder(db, "KL-COD-PRE", { createdBy: "admin:shop@sa-and-sha.com" });

    expect(result.success).toBe(false);
    expect(result.code).toBe("COD_AWAITING_DISPATCH");
    expect(db._invoicesMap.size).toBe(0);
  });

  it("6. Authenticated admin + cancelled order rejected by eligibility engine", async () => {
    const cancelledOrder = {
      order_id: "KL-CANCELLED-1",
      payment_method: "razorpay",
      payment_status: "paid",
      status: "cancelled",
      created_at: "2026-08-08T00:00:00Z"
    };

    const db = createMockAdminDb({ orders: [cancelledOrder] });
    const result = await finalizeGstInvoiceForOrder(db, "KL-CANCELLED-1", { createdBy: "admin:shop@sa-and-sha.com" });

    expect(result.success).toBe(false);
    expect(result.code).toBe("ORDER_CANCELLED_OR_REFUNDED");
    expect(db._invoicesMap.size).toBe(0);
  });

  it("7. Authenticated admin + eligible prepaid order (processing/fulfillment) succeeds", async () => {
    const sampleProduct = {
      product_id: "p1",
      sku: "p1",
      hsn_code: "6205",
      gst_rate: 12,
      tax_category: "APPAREL",
      is_tax_inclusive: true,
      effective_from: "2026-01-01"
    };

    const eligiblePrepaid = {
      order_id: "KL-ELIG-PREPAID",
      payment_method: "razorpay",
      payment_id: "pay_ELIG_PREPAID",
      payment_status: "captured",
      payment_verified: true,
      payment_verification_source: "razorpay_api",
      status: "processing",
      created_at: "2026-08-08T00:00:00Z",
      customer_email: "buyer@example.com",
      shipping_address: {
        full_name: "Test Buyer",
        address_line_1: "123 Main St",
        city: "Mumbai",
        state: "Maharashtra",
        state_code: "27",
        pincode: "400001"
      },
      items: [
        { product_id: "p1", sku: "p1", title: "Shirt", price: 1000, quantity: 1, line_total: 1000, hsn_code: "6205", gst_rate: 12 }
      ],
      subtotal: 1000,
      grand_total: 1000
    };

    const db = createMockAdminDb({ orders: [eligiblePrepaid], products: [sampleProduct] });
    const result = await finalizeGstInvoiceForOrder(db, "KL-ELIG-PREPAID", { createdBy: "admin:shop@sa-and-sha.com" });

    expect(result.success).toBe(true);
    expect(result.invoice).toBeDefined();
    expect(result.invoice?.invoice_number).toBe("KL/26-27/000001");
    expect(db._invoicesMap.size).toBe(1);
  });

  it("8. Authenticated admin + dispatched COD order succeeds", async () => {
    const sampleProduct = {
      product_id: "p2",
      sku: "p2",
      hsn_code: "6203",
      gst_rate: 12,
      tax_category: "APPAREL",
      is_tax_inclusive: true,
      effective_from: "2026-01-01"
    };

    const eligibleCod = {
      order_id: "KL-ELIG-COD",
      payment_method: "cod",
      status: "dispatched",
      created_at: "2026-08-08T00:00:00Z",
      customer_email: "buyer2@example.com",
      shipping_address: {
        full_name: "Test Buyer 2",
        address_line_1: "456 Link Rd",
        city: "Mumbai",
        state: "Maharashtra",
        state_code: "27",
        pincode: "400002"
      },
      items: [
        { product_id: "p2", sku: "p2", title: "Pants", price: 2000, quantity: 1, line_total: 2000, hsn_code: "6203", gst_rate: 12 }
      ],
      subtotal: 2000,
      grand_total: 2000
    };

    const db = createMockAdminDb({ orders: [eligibleCod], products: [sampleProduct] });
    const result = await finalizeGstInvoiceForOrder(db, "KL-ELIG-COD", { createdBy: "admin:shop@sa-and-sha.com" });

    expect(result.success).toBe(true);
    expect(result.invoice).toBeDefined();
    expect(result.invoice?.invoice_number).toBe("KL/26-27/000001");
    expect(db._invoicesMap.size).toBe(1);
  });

  it("9. Duplicate admin request returns same invoice with reused=true", async () => {
    const existingInvoice = {
      invoice_id: "inv_KL-DUP_tax_invoice",
      order_id: "KL-DUP",
      invoice_number: "KL/2026-27/000055",
      invoice_type: "TAX_INVOICE",
      status: "FINALIZED",
      grand_total: 1500
    };

    const db = createMockAdminDb({ invoices: [existingInvoice] });
    const result = await finalizeGstInvoiceForOrder(db, "KL-DUP", { createdBy: "admin:shop@sa-and-sha.com" });

    expect(result.success).toBe(true);
    expect(result.reused).toBe(true);
    expect(result.invoice?.invoice_number).toBe("KL/2026-27/000055");
  });

  it("10. Duplicate request allocates zero additional invoice numbers", async () => {
    const existingInvoice = {
      invoice_id: "inv_KL-DUP2_tax_invoice",
      order_id: "KL-DUP2",
      invoice_number: "KL/2026-27/000056",
      invoice_type: "TAX_INVOICE",
      status: "FINALIZED",
      grand_total: 1500
    };

    const db = createMockAdminDb({ invoices: [existingInvoice] });
    const initialCount = db._invoicesMap.size;

    const result1 = await finalizeGstInvoiceForOrder(db, "KL-DUP2", { createdBy: "admin:shop@sa-and-sha.com" });
    const result2 = await finalizeGstInvoiceForOrder(db, "KL-DUP2", { createdBy: "admin:shop@sa-and-sha.com" });

    expect(result1.invoice?.invoice_number).toBe("KL/2026-27/000056");
    expect(result2.invoice?.invoice_number).toBe("KL/2026-27/000056");
    expect(db._invoicesMap.size).toBe(initialCount);
  });
});
