import { describe, it, expect, beforeEach } from "vitest";
import { createOrFetchGstInvoice } from "../invoice/invoiceEngine";
import { evaluateCreditNoteEligibility } from "../invoice/creditNoteEligibility";
import { calculateCreditNoteData } from "../invoice/creditNoteCalculation";
import {
  createOrFetchGstCreditNote,
  getCreditNoteByIdOrNumber,
  listGstCreditNotes
} from "../invoice/creditNoteEngine";
import { GstInvoice } from "../invoice/invoiceTypes";

function matchFilter(doc: any, field: string, op: string, value: any): boolean {
  if (!doc) return false;
  const docVal = doc[field];
  if (op === "==") return docVal === value;
  if (op === "!=") return docVal !== value;
  if (op === "in") return Array.isArray(value) && value.includes(docVal);
  return false;
}

class MockQuery {
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private limitN?: number;

  constructor(
    private collMap: Map<string, any>,
    private self: any,
    private collName: string
  ) {}

  where(field: string, op: string, value: any) {
    this.filters.push({ field, op, value });
    return this;
  }

  limit(n: number) {
    this.limitN = n;
    return this;
  }

  async get() {
    const results: any[] = [];
    for (const [id, data] of this.collMap.entries()) {
      let matches = true;
      for (const f of this.filters) {
        if (!matchFilter(data, f.field, f.op, f.value)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        results.push({
          id,
          exists: true,
          data: () => JSON.parse(JSON.stringify(data)),
          ref: this.self.collection(this.collName).doc(id)
        });
      }
    }
    const sliced = this.limitN !== undefined ? results.slice(0, this.limitN) : results;
    return {
      empty: sliced.length === 0,
      size: sliced.length,
      docs: sliced,
      forEach: (cb: any) => sliced.forEach(cb)
    };
  }
}

class MockFirestore {
  private collections: Map<string, Map<string, any>> = new Map();

  getCollection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  collection(collName: string) {
    const collMap = this.getCollection(collName);
    const self = this;

    return {
      doc(docId?: string) {
        const id = docId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return {
          id,
          async get() {
            const data = collMap.get(id);
            return {
              id,
              exists: !!data,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
              ref: self.collection(collName).doc(id)
            };
          },
          async set(data: any) {
            collMap.set(id, JSON.parse(JSON.stringify(data)));
          },
          async update(data: any) {
            const existing = collMap.get(id) || {};
            collMap.set(id, { ...existing, ...JSON.parse(JSON.stringify(data)) });
          }
        };
      },
      where(field: string, op: string, value: any) {
        const q = new MockQuery(collMap, self, collName);
        return q.where(field, op, value);
      },
      limit(n: number) {
        const q = new MockQuery(collMap, self, collName);
        return q.limit(n);
      },
      async get() {
        const q = new MockQuery(collMap, self, collName);
        return q.get();
      }
    };
  }

  async runTransaction(cb: any) {
    const self = this;
    const tx = {
      async get(docRefOrQuery: any) {
        return docRefOrQuery.get();
      },
      set(docRef: any, data: any) {
        return docRef.set(data);
      },
      update(docRef: any, data: any) {
        return docRef.update(data);
      }
    };
    return cb(tx);
  }
}

describe("Phase 10.5B — GST Credit Note Engine Test Suite", () => {
  let db: MockFirestore;

  beforeEach(() => {
    db = new MockFirestore();

    // Setup seller tax config in Firestore (doc: seller_gst)
    db.collection("system_tax_config").doc("seller_gst").set({
      legal_name: "Sa and Sha Private Limited",
      trade_name: "Sa and Sha",
      gstin: "08AAAAA0000A1Z5",
      address_line_1: "123 Linen Way",
      address_line_2: "Johari Bazaar",
      city: "Jaipur",
      state: "Rajasthan",
      state_code: "08",
      pincode: "302003",
      country: "India",
      pan: "AAAAA0000A",
      support_email: "support@sa-and-sha.com",
      support_phone: "+911410000000",
      invoice_prefix: "KL",
      status: "ACTIVE",
      is_active: true
    });

    // Setup product tax master with correct sku and product_id fields
    db.collection("product_tax_master").doc("shirt_linen").set({
      product_id: "p1",
      sku: "SHIRT-LINEN-01",
      hsn_code: "62052000",
      gst_rate: 12,
      tax_category: "APPAREL",
      status: "ACTIVE",
      is_active: true
    });
    db.collection("product_tax_master").doc("pant_linen").set({
      product_id: "p2",
      sku: "PANT-LINEN-01",
      hsn_code: "62034200",
      gst_rate: 12,
      tax_category: "APPAREL",
      status: "ACTIVE",
      is_active: true
    });

    // Setup shipping tax config
    db.collection("shipping_tax_config").doc("default").set({
      sac_code: "996812",
      gst_rate: 18,
      status: "ACTIVE",
      is_active: true
    });
  });

  const sampleOrderIntrastate = {
    order_id: "ORD-1001",
    created_at: "2026-08-01T10:00:00Z",
    status: "processing",
    payment_method: "razorpay",
    payment_id: "pay_test_1001",
    payment_status: "captured",
    payment_verified: true,
    payment_verification_source: "provider_verified",
    fulfillment_status: "accepted",
    customer_email: "customer1@example.com",
    customer_name: "Anita Sharma",
    state: "Rajasthan",
    pincode: "302001",
    grand_total: 2500,
    items: [
      { product_id: "p1", sku: "SHIRT-LINEN-01", name: "Linen Shirt", quantity: 2, price: 1000 },
      { product_id: "p2", sku: "PANT-LINEN-01", name: "Linen Pant", quantity: 1, price: 500 }
    ]
  };

  const sampleOrderInterstateB2B = {
    order_id: "ORD-2002",
    created_at: "2026-08-01T10:00:00Z",
    status: "processing",
    payment_method: "razorpay",
    payment_id: "pay_test_2002",
    payment_status: "captured",
    payment_verified: true,
    payment_verification_source: "provider_verified",
    fulfillment_status: "accepted",
    customer_email: "corp@business.com",
    customer_name: "Boutique Designs",
    state: "Maharashtra",
    pincode: "400001",
    gstin: "27AAACB1234C1Z1",
    gst_verified: true,
    b2b_verified: true,
    grand_total: 3000,
    items: [
      { product_id: "p1", sku: "SHIRT-LINEN-01", name: "Linen Shirt", quantity: 3, price: 1000 }
    ]
  };

  it("1. Rejects credit note when no finalized GST invoice exists", async () => {
    // Seed order without finalizing an invoice
    db.collection("orders").doc("ORD-1001").set(sampleOrderIntrastate);

    const result = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      reason: "GOODS_RETURNED"
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("NO_FINALIZED_INVOICE");
  });

  it("2. Rejects credit note for open/unapproved return request", async () => {
    // 1. Finalize invoice
    db.collection("orders").doc("ORD-1001").set(sampleOrderIntrastate);
    const invRes = await createOrFetchGstInvoice(db, "ORD-1001", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);

    // 2. Create open pending return
    db.collection("return_requests").doc("rma_open_1").set({
      rma_number: "RMA-OPEN-1",
      order_id: "ORD-1001",
      status: "requested", // open / not approved or financial completed
      items: [{ sku: "SHIRT-LINEN-01", quantity: 1 }]
    });

    const result = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-OPEN-1",
      reason: "GOODS_RETURNED"
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe("RETURN_NOT_SETTLED");
  });

  it("3. Successfully issues full credit note for eligible settled return (Intrastate B2C)", async () => {
    // Finalize original invoice
    db.collection("orders").doc("ORD-1001").set(sampleOrderIntrastate);
    const invRes = await createOrFetchGstInvoice(db, "ORD-1001", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);
    const origInvoice = invRes.invoice!;

    // Create settled return
    db.collection("return_requests").doc("rma_settled_1").set({
      rma_number: "RMA-1001",
      order_id: "ORD-1001",
      status: "financial_completed",
      items: [
        { sku: "SHIRT-LINEN-01", quantity: 2 },
        { sku: "PANT-LINEN-01", quantity: 1 }
      ]
    });

    const result = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-1001",
      reason: "GOODS_RETURNED",
      createdBy: "admin@sa-and-sha.com"
    });

    expect(result.success).toBe(true);
    expect(result.creditNote).toBeDefined();

    const cn = result.creditNote!;
    expect(cn.credit_note_number).toMatch(/^KLCN\/(20)?26-27\/\d{6}$/);
    expect(cn.supply_type).toBe("INTRASTATE");
    expect(cn.cgst_total_reversal).toBeGreaterThan(0);
    expect(cn.sgst_total_reversal).toBeGreaterThan(0);
    expect(cn.igst_total_reversal).toBe(0);
    expect(cn.grand_total_reversal).toBe(origInvoice.grand_total);
    expect(cn.gst_customer_type).toBe("B2C");
    expect(cn.immutable).toBe(true);

    // Verify original invoice is unchanged
    const invCheck = await db.collection("gst_invoices").doc(origInvoice.invoice_id).get();
    expect(invCheck.data().status).toBe("FINALIZED");
    expect(invCheck.data().invoice_number).toBe(origInvoice.invoice_number);
  });

  it("4. Successfully handles partial quantity return and multiple partial returns", async () => {
    // Order has SHIRT-LINEN-01 x 2, PANT-LINEN-01 x 1
    db.collection("orders").doc("ORD-1001").set(sampleOrderIntrastate);
    const invRes = await createOrFetchGstInvoice(db, "ORD-1001", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);

    // First partial return: SHIRT-LINEN-01 x 1
    db.collection("return_requests").doc("rma_part_1").set({
      rma_number: "RMA-PART-1",
      order_id: "ORD-1001",
      status: "refund_approved"
    });

    const cn1Res = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-PART-1",
      itemsToCredit: [{ sku: "SHIRT-LINEN-01", quantity: 1 }],
      reason: "PARTIAL_RETURN"
    });

    expect(cn1Res.success).toBe(true);
    expect(cn1Res.creditNote!.line_items.length).toBe(1);
    expect(cn1Res.creditNote!.line_items[0].credited_quantity).toBe(1);

    // Second partial return later: SHIRT-LINEN-01 x 1
    db.collection("return_requests").doc("rma_part_2").set({
      rma_number: "RMA-PART-2",
      order_id: "ORD-1001",
      status: "refund_approved"
    });

    const cn2Res = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-PART-2",
      itemsToCredit: [{ sku: "SHIRT-LINEN-01", quantity: 1 }],
      reason: "PARTIAL_RETURN"
    });

    expect(cn2Res.success).toBe(true);
    expect(cn2Res.creditNote!.credit_note_number).not.toBe(cn1Res.creditNote!.credit_note_number);

    // Third return attempt for SHIRT-LINEN-01 (0 remaining creditable) -> rejected!
    db.collection("return_requests").doc("rma_part_3").set({
      rma_number: "RMA-PART-3",
      order_id: "ORD-1001",
      status: "refund_approved"
    });

    const cn3Res = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-PART-3",
      itemsToCredit: [{ sku: "SHIRT-LINEN-01", quantity: 1 }],
      reason: "PARTIAL_RETURN"
    });

    expect(cn3Res.success).toBe(false);
    expect(cn3Res.code).toBe("OVER_CREDIT_QUANTITY");
  });

  it("5. Verifies Interstate IGST reversal, B2B snapshot preservation, and HSN preservation", async () => {
    db.collection("orders").doc("ORD-2002").set(sampleOrderInterstateB2B);
    const invRes = await createOrFetchGstInvoice(db, "ORD-2002", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);

    db.collection("return_requests").doc("rma_b2b").set({
      rma_number: "RMA-B2B",
      order_id: "ORD-2002",
      status: "financial_completed"
    });

    const result = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-2002",
      rmaNumber: "RMA-B2B",
      reason: "GOODS_RETURNED"
    });

    expect(result.success).toBe(true);
    const cn = result.creditNote!;

    expect(cn.supply_type).toBe("INTERSTATE");
    expect(cn.igst_total_reversal).toBeGreaterThan(0);
    expect(cn.cgst_total_reversal).toBe(0);
    expect(cn.sgst_total_reversal).toBe(0);

    // Verify B2B classification and GSTIN preserved from original invoice
    expect(cn.gst_customer_type).toBe("B2B");
    expect(cn.buyer_snapshot.gstin).toBe("27AAACB1234C1Z1");
    expect(cn.buyer_snapshot.gst_verified).toBe(true);

    // Verify original HSN preserved
    expect(cn.line_items[0].hsn_code).toBe("62052000");
    expect(cn.line_items[0].gst_rate).toBe(12);
  });

  it("6. Idempotency: repeated calls for same RMA return existing credit note", async () => {
    db.collection("orders").doc("ORD-1001").set(sampleOrderIntrastate);
    await createOrFetchGstInvoice(db, "ORD-1001", { allowAdminOverride: true });

    db.collection("return_requests").doc("rma_idemp_1").set({
      rma_number: "RMA-IDEMP-1",
      order_id: "ORD-1001",
      status: "financial_completed"
    });

    const call1 = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-IDEMP-1",
      reason: "GOODS_RETURNED"
    });

    expect(call1.success).toBe(true);
    expect(call1.reused).toBe(false);

    const call2 = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-IDEMP-1",
      reason: "GOODS_RETURNED"
    });

    expect(call2.success).toBe(true);
    expect(call2.reused).toBe(true);
    expect(call2.creditNote!.credit_note_id).toBe(call1.creditNote!.credit_note_id);
    expect(call2.creditNote!.credit_note_number).toBe(call1.creditNote!.credit_note_number);
  });

  it("7. Handles order cancellation credit note eligibility and creation", async () => {
    // First finalize invoice while order is active
    db.collection("orders").doc("ORD-CANCEL-1").set({
      ...sampleOrderIntrastate,
      order_id: "ORD-CANCEL-1"
    });

    const invRes = await createOrFetchGstInvoice(db, "ORD-CANCEL-1", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);

    // Then update order to CANCELLED state with requires_credit_note
    db.collection("orders").doc("ORD-CANCEL-1").update({
      status: "CANCELLED",
      requires_credit_note: true
    });

    const result = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-CANCEL-1",
      reason: "ORDER_CANCELLED"
    });

    expect(result.success).toBe(true);
    expect(result.creditNote!.reason).toBe("ORDER_CANCELLED");
    expect(result.creditNote!.grand_total_reversal).toBe(invRes.invoice!.grand_total);
  });

  it("8. Verify listing and retrieval helpers", async () => {
    db.collection("orders").doc("ORD-1001").set(sampleOrderIntrastate);
    await createOrFetchGstInvoice(db, "ORD-1001", { allowAdminOverride: true });

    db.collection("return_requests").doc("rma_list_1").set({
      rma_number: "RMA-LIST-1",
      order_id: "ORD-1001",
      status: "financial_completed"
    });

    const issued = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-1001",
      rmaNumber: "RMA-LIST-1",
      reason: "GOODS_RETURNED"
    });

    const cnNum = issued.creditNote!.credit_note_number;

    const fetchedByNum = await getCreditNoteByIdOrNumber(db, cnNum);
    expect(fetchedByNum.success).toBe(true);
    expect(fetchedByNum.creditNote!.credit_note_id).toBe(issued.creditNote!.credit_note_id);

    const listRes = await listGstCreditNotes(db, { orderId: "ORD-1001" });
    expect(listRes.success).toBe(true);
    expect(listRes.creditNotes.length).toBeGreaterThanOrEqual(1);
  });
});
