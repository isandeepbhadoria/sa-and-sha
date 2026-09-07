import { describe, it, expect, beforeEach } from "vitest";
import { createOrFetchGstInvoice } from "../invoice/invoiceEngine";
import { calculateCreditNoteData, calculateFinancialYear, calculateGstAdjustmentDeadline } from "../invoice/creditNoteCalculation";
import {
  createOrFetchGstCreditNote,
  getCreditNoteByIdOrNumber,
  updateCreditNoteGstReportingStatus
} from "../invoice/creditNoteEngine";

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

describe("Phase 10.5B.2 — GST Credit Note Reporting Status & Hardening Suite", () => {
  let db: MockFirestore;

  beforeEach(() => {
    db = new MockFirestore();

    db.collection("system_tax_config").doc("seller_gst").set({
      legal_name: "Sa and Sha Private Limited",
      trade_name: "Sa and Sha",
      gstin: "08AAAAA0000A1Z5",
      address_line_1: "123 Linen Way",
      city: "Jaipur",
      state: "Rajasthan",
      state_code: "08",
      pincode: "302003",
      country: "India",
      pan: "AAAAA0000A",
      invoice_prefix: "KL",
      status: "ACTIVE",
      is_active: true
    });

    db.collection("product_tax_master").doc("shirt_linen").set({
      product_id: "p1",
      sku: "SHIRT-LINEN-01",
      hsn_code: "62052000",
      gst_rate: 12,
      tax_category: "APPAREL",
      status: "ACTIVE",
      is_active: true
    });
  });

  const sampleOrder = {
    order_id: "ORD-MARCH-2027",
    created_at: "2027-03-15T10:00:00Z",
    status: "processing",
    payment_method: "razorpay",
    payment_id: "pay_test_march",
    payment_status: "captured",
    payment_verified: true,
    payment_verification_source: "provider_verified",
    fulfillment_status: "accepted",
    customer_email: "customer@example.com",
    customer_name: "Ramesh Kumar",
    state: "Rajasthan",
    pincode: "302001",
    grand_total: 1000,
    items: [
      { product_id: "p1", sku: "SHIRT-LINEN-01", name: "Linen Shirt", quantity: 1, price: 1000 }
    ]
  };

  it("1. Verifies new credit note defaults to tax_liability_adjusted = false and NOT_REPORTED", async () => {
    db.collection("orders").doc("ORD-MARCH-2027").set(sampleOrder);
    const invRes = await createOrFetchGstInvoice(db, "ORD-MARCH-2027", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);

    db.collection("return_requests").doc("rma_1").set({
      rma_number: "RMA-1",
      order_id: "ORD-MARCH-2027",
      status: "financial_completed"
    });

    const cnRes = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-MARCH-2027",
      rmaNumber: "RMA-1",
      reason: "GOODS_RETURNED"
    });

    expect(cnRes.success).toBe(true);
    const cn = cnRes.creditNote!;

    // MUST NOT claim tax liability has been adjusted at document creation time
    expect(cn.tax_liability_adjusted).toBe(false);
    expect(cn.gst_reporting_status).toBe("NOT_REPORTED");
    expect(cn.gst_reporting_period).toBeNull();
    expect(cn.gst_reported_at).toBeNull();
    expect(cn.gst_adjusted_at).toBeNull();
    expect(cn.e_invoice_status).toBe("NOT_APPLICABLE");
  });

  it("2. Verifies Section 34(2) statutory adjustment deadline calculation and eligibility", () => {
    // Invoice issued March 15, 2027 (FY 2026-27).
    // Deadline is 30th November 2027.
    const deadline1 = calculateGstAdjustmentDeadline("2027-03-15T10:00:00Z");
    expect(deadline1).toBe("2027-11-30");

    // Invoice issued August 10, 2026 (FY 2026-27).
    // Deadline is 30th November 2027.
    const deadline2 = calculateGstAdjustmentDeadline("2026-08-10T10:00:00Z");
    expect(deadline2).toBe("2027-11-30");

    // Invoice issued April 10, 2027 (FY 2027-28).
    // Deadline is 30th November 2028.
    const deadline3 = calculateGstAdjustmentDeadline("2027-04-10T10:00:00Z");
    expect(deadline3).toBe("2028-11-30");
  });

  it("3. Verifies credit note issued in next FY gets correct issue-date FY and deadline eligibility", async () => {
    // Invoice in March 2027 (FY 2026-27)
    db.collection("orders").doc("ORD-MARCH-2027").set(sampleOrder);
    const invRes = await createOrFetchGstInvoice(db, "ORD-MARCH-2027", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);

    // Calculate CN in April 2027 (FY 2027-28)
    const calcRes = calculateCreditNoteData({
      originalInvoice: invRes.invoice!,
      itemsToCredit: [{ sku: "SHIRT-LINEN-01", quantity: 1 }],
      reason: "GOODS_RETURNED",
      issueDate: "2027-04-15T10:00:00Z"
    });

    expect(calcRes.success).toBe(true);
    if (calcRes.success) {
      const cnData = calcRes.creditNoteData;
      // CN financial year must be 2027-28
      expect(cnData.financial_year).toBe("2027-28");
      // Original invoice remains FY 26-27
      expect(invRes.invoice!.financial_year).toBe("26-27");
      // Deadline is November 30, 2027
      expect(cnData.gst_adjustment_deadline).toBe("2027-11-30");
      // Issued April 15, 2027 <= 2027-11-30 -> ELIGIBLE
      expect(cnData.gst_adjustment_eligibility).toBe("ELIGIBLE");
      expect(cnData.gst_reporting_status).toBe("NOT_REPORTED");
    }
  });

  it("4. Verifies credit note issued AFTER deadline remains a valid document but flags DEADLINE_EXPIRED", async () => {
    // Invoice in August 2026 (FY 2026-27). Statutory deadline is 2027-11-30.
    db.collection("orders").doc("ORD-MARCH-2027").set(sampleOrder);
    const invRes = await createOrFetchGstInvoice(db, "ORD-MARCH-2027", { allowAdminOverride: true });
    expect(invRes.success).toBe(true);

    // Credit Note issued in December 2027 (> 2027-11-30)
    const calcRes = calculateCreditNoteData({
      originalInvoice: invRes.invoice!,
      itemsToCredit: [{ sku: "SHIRT-LINEN-01", quantity: 1 }],
      reason: "GOODS_RETURNED",
      issueDate: "2027-12-10T10:00:00Z"
    });

    expect(calcRes.success).toBe(true);
    if (calcRes.success) {
      const cnData = calcRes.creditNoteData;
      expect(cnData.status).toBe("ISSUED"); // Still a legally valid commercial/accounting credit note
      expect(cnData.gst_adjustment_eligibility).toBe("DEADLINE_EXPIRED");
      expect(cnData.gst_reporting_status).toBe("NOT_ELIGIBLE_FOR_ADJUSTMENT");
      expect(cnData.tax_liability_adjusted).toBe(false);
    }
  });

  it("5. Verifies updateCreditNoteGstReportingStatus and audit log without mutating accounting snapshot", async () => {
    db.collection("orders").doc("ORD-MARCH-2027").set(sampleOrder);
    await createOrFetchGstInvoice(db, "ORD-MARCH-2027", { allowAdminOverride: true });

    db.collection("return_requests").doc("rma_2").set({
      rma_number: "RMA-2",
      order_id: "ORD-MARCH-2027",
      status: "financial_completed"
    });

    const issued = await createOrFetchGstCreditNote(db, {
      orderId: "ORD-MARCH-2027",
      rmaNumber: "RMA-2",
      reason: "GOODS_RETURNED"
    });

    const cnId = issued.creditNote!.credit_note_id;

    // Update reporting status to REPORTED
    const repRes = await updateCreditNoteGstReportingStatus(db, {
      creditNoteId: cnId,
      gstReportingStatus: "REPORTED",
      gstReportingPeriod: "082026",
      updatedBy: "tax_admin@saandsha.com"
    });

    expect(repRes.success).toBe(true);
    expect(repRes.creditNote!.gst_reporting_status).toBe("REPORTED");
    expect(repRes.creditNote!.gst_reporting_period).toBe("082026");
    expect(repRes.creditNote!.gst_reported_at).toBeDefined();
    expect(repRes.creditNote!.tax_liability_adjusted).toBe(false);

    // Update reporting status to ADJUSTED
    const adjRes = await updateCreditNoteGstReportingStatus(db, {
      creditNoteId: cnId,
      gstReportingStatus: "ADJUSTED",
      gstAdjustmentReference: "GSTR3B-SEP2026-REF123",
      updatedBy: "tax_admin@saandsha.com"
    });

    expect(adjRes.success).toBe(true);
    expect(adjRes.creditNote!.gst_reporting_status).toBe("ADJUSTED");
    expect(adjRes.creditNote!.tax_liability_adjusted).toBe(true);
    expect(adjRes.creditNote!.gst_adjustment_reference).toBe("GSTR3B-SEP2026-REF123");
    expect(adjRes.creditNote!.gst_adjusted_at).toBeDefined();

    // PROOF OF IMMUTABILITY: Accounting snapshot fields must be 100% identical
    expect(adjRes.creditNote!.grand_total_reversal).toBe(issued.creditNote!.grand_total_reversal);
    expect(adjRes.creditNote!.seller_snapshot).toEqual(issued.creditNote!.seller_snapshot);
    expect(adjRes.creditNote!.buyer_snapshot).toEqual(issued.creditNote!.buyer_snapshot);
    expect(adjRes.creditNote!.line_items).toEqual(issued.creditNote!.line_items);
    expect(adjRes.creditNote!.original_invoice_number).toBe(issued.creditNote!.original_invoice_number);

    // Verify Audit Logs appended
    const auditLogs = await db.collection("admin_audit_logs").get();
    expect(auditLogs.size).toBeGreaterThanOrEqual(3);
  });
});
