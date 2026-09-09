import { describe, it, expect, beforeEach } from "vitest";
import { executeHardenedRazorpayRefund } from "../invoice/razorpayRefundService";

class MockFirestoreForConcurrency {
  orders: Map<string, any> = new Map();
  auditLogs: any[] = [];
  private transactionQueue: Promise<any> = Promise.resolve();

  collection(colName: string) {
    const self = this;
    if (colName === "admin_audit_logs") {
      return {
        add: async (log: any) => {
          self.auditLogs.push(log);
          return { id: `log_${Date.now()}` };
        }
      };
    }
    return {
      doc: (id: string) => ({
        id,
        get: async () => ({
          exists: self.orders.has(id),
          id,
          data: () => self.orders.get(id),
          ref: self.collection(colName).doc(id)
        }),
        set: async (data: any) => {
          self.orders.set(id, { ...data });
        },
        update: async (fields: any) => {
          const existing = self.orders.get(id) || {};
          self.orders.set(id, { ...existing, ...fields });
        }
      }),
      where: (field: string, _op: string, val: any) => ({
        limit: (_lim: number) => ({
          get: async () => {
            const matches: any[] = [];
            for (const [id, data] of self.orders.entries()) {
              if (data[field] === val) {
                matches.push({
                  id,
                  ref: self.collection(colName).doc(id),
                  data: () => data
                });
              }
            }
            return {
              empty: matches.length === 0,
              docs: matches
            };
          }
        })
      })
    };
  }

  async runTransaction(cb: (tx: any) => Promise<any>) {
    // Acquire lock to process Firestore transactions atomically in sequence
    const res = this.transactionQueue.then(async () => {
      const transaction = {
        get: async (ref: any) => ref.get(),
        set: async (ref: any, data: any, opts?: any) => ref.set(data, opts),
        update: async (ref: any, fields: any) => ref.update(fields)
      };
      return await cb(transaction);
    });
    this.transactionQueue = res.catch(() => {});
    return await res;
  }
}

describe("PHASE 10.5D.2 — Atomic Razorpay Refund Concurrency Lock Hardening", () => {
  let db: MockFirestoreForConcurrency;

  beforeEach(() => {
    db = new MockFirestoreForConcurrency();
  });

  it("1. Same Order + Same RMA + Same Amount launched simultaneously: Exactly ONE acquires lock and calls provider", async () => {
    let rzpCallCount = 0;
    const mockRazorpayFn = () => ({
      payments: {
        fetch: async () => ({
          id: "pay_test_conc_1",
          status: "captured",
          amount: 289900,
          currency: "INR",
          amount_refunded: 0,
          notes: { order_id: "ORD_CONC_1" }
        }),
        fetchMultipleRefund: async () => [],
        refund: async () => {
          rzpCallCount++;
          return {
            id: `rfnd_test_conc_${Date.now()}_${rzpCallCount}`,
            status: "processed",
            amount: 100000,
            currency: "INR"
          };
        }
      }
    });

    await db.collection("orders").doc("ORD_CONC_1").set({
      id: "ORD_CONC_1",
      order_id: "ORD_CONC_1",
      payment_method: "razorpay",
      payment_id: "pay_test_conc_1",
      grand_total: 2899,
      refunds: []
    });

    // Launch TWO simultaneous refund requests for the exact same order and RMA
    const [req1, req2] = await Promise.all([
      executeHardenedRazorpayRefund({
        adminDb: db,
        orderId: "ORD_CONC_1",
        rmaNumber: "KL-RMA-CONC-001",
        requestedAmount: 1000,
        reason: "Defective item",
        adminEmail: "admin@sa-and-sha.com",
        getRazorpayFn: mockRazorpayFn
      }),
      executeHardenedRazorpayRefund({
        adminDb: db,
        orderId: "ORD_CONC_1",
        rmaNumber: "KL-RMA-CONC-001",
        requestedAmount: 1000,
        reason: "Defective item",
        adminEmail: "admin@sa-and-sha.com",
        getRazorpayFn: mockRazorpayFn
      })
    ]);

    // Results evaluation
    const succeededReqs = [req1, req2].filter((r) => r.success);
    const failedReqs = [req1, req2].filter((r) => !r.success);

    expect(succeededReqs.length).toBe(1);
    expect(failedReqs.length).toBe(1);

    // Second request must receive lock/conflict/in-progress error
    const failedReq = failedReqs[0];
    expect([429, 400]).toContain(failedReq.statusCode);
    expect(failedReq.error).toMatch(/REFUND_ALREADY_IN_PROGRESS|has already been processed|REFUND_ALREADY_COMPLETED/);

    // Check order state in Firestore
    const docSnap = await db.collection("orders").doc("ORD_CONC_1").get();
    const orderData = docSnap.data();

    // Exactly ONE logical refund reservation exists for this RMA
    const rmaRefunds = orderData.refunds.filter((r: any) => r.rma_number === "KL-RMA-CONC-001");
    expect(rmaRefunds.length).toBe(1);

    // Reserved totals are not doubled
    const totalRefundedAmount = orderData.refunds.reduce((sum: number, r: any) => sum + r.amount, 0);
    expect(totalRefundedAmount).toBe(1000);
  });

  it("2. Two Simultaneous Different RMAs exceeding remaining refundable balance: Combined reservation never exceeds ₹1,500", async () => {
    let totalRzpRefundCalls = 0;
    const mockRazorpayFn = () => ({
      payments: {
        fetch: async () => ({
          id: "pay_test_conc_2",
          status: "captured",
          amount: 150000, // ₹1,500 total captured balance
          currency: "INR",
          amount_refunded: 0,
          notes: { order_id: "ORD_CONC_2" }
        }),
        fetchMultipleRefund: async () => [],
        refund: async () => {
          totalRzpRefundCalls++;
          return {
            id: `rfnd_test_conc_2_${totalRzpRefundCalls}`,
            status: "processed",
            amount: 100000,
            currency: "INR"
          };
        }
      }
    });

    // Seed order with ₹1,500 total captured balance
    await db.collection("orders").doc("ORD_CONC_2").set({
      id: "ORD_CONC_2",
      order_id: "ORD_CONC_2",
      payment_method: "razorpay",
      payment_id: "pay_test_conc_2",
      grand_total: 1500,
      refunds: []
    });

    // RMA-A requests ₹1,000 and RMA-B requests ₹1,000 simultaneously. Combined = ₹2,000 > ₹1,500 limit!
    const [resA, resB] = await Promise.all([
      executeHardenedRazorpayRefund({
        adminDb: db,
        orderId: "ORD_CONC_2",
        rmaNumber: "KL-RMA-CONC-A",
        requestedAmount: 1000,
        reason: "Return Item A",
        adminEmail: "admin@sa-and-sha.com",
        getRazorpayFn: mockRazorpayFn
      }),
      executeHardenedRazorpayRefund({
        adminDb: db,
        orderId: "ORD_CONC_2",
        rmaNumber: "KL-RMA-CONC-B",
        requestedAmount: 1000,
        reason: "Return Item B",
        adminEmail: "admin@sa-and-sha.com",
        getRazorpayFn: mockRazorpayFn
      })
    ]);

    const succeeded = [resA, resB].filter((r) => r.success);
    const failed = [resA, resB].filter((r) => !r.success);

    // Exactly one RMA can reserve ₹1,000; the second RMA cannot reserve ₹1,000 because remaining balance is only ₹500
    expect(succeeded.length).toBe(1);
    expect(failed.length).toBe(1);

    expect(failed[0].statusCode).toBe(400);
    expect(failed[0].error).toMatch(/exceeds remaining refundable balance|NO_REFUNDABLE_BALANCE/);

    // Verify Firestore state
    const docSnap = await db.collection("orders").doc("ORD_CONC_2").get();
    const orderData = docSnap.data();

    // At most ₹1,500 cumulative provider liability is reserved/submitted (here exactly ₹1,000)
    const cumulativeReserved = orderData.refunds
      .filter((r: any) => ["submitting", "processed", "initiated"].includes(r.status))
      .reduce((sum: number, r: any) => sum + r.amount, 0);

    expect(cumulativeReserved).toBeLessThanOrEqual(1500);
    expect(cumulativeReserved).toBe(1000);
  });
});
