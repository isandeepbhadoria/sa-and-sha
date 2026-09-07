import assert from "assert";
import {
  processReturnFinancials,
  retryReturnFinancials,
  getReturnFinancialSummary,
  getReturnReconciliation
} from "./financialReturnsHelpers";
import {
  receiveWarehouseParcel,
  startWarehouseInspection,
  completeWarehouseInspection
} from "./warehouseReturnsHelpers";
import { approveReturnRequest } from "./adminReturnsHelpers";

/**
 * MOCK FIRESTORE DATABASE IN-MEMORY ENGINE FOR AUTOMATED TESTS
 */
function createMockDb() {
  const collections: Record<string, Map<string, any>> = {};

  function getColMap(colName: string) {
    if (!collections[colName]) {
      collections[colName] = new Map<string, any>();
    }
    return collections[colName];
  }

  return {
    _collections: collections,
    collection: function (colName: string) {
      const colMap = getColMap(colName);

      return {
        doc: function (docId: string) {
          const makeCollection = (subName: string) => {
            const subMapKey = `${colName}/${docId}/${subName}`;
            const subMap = getColMap(subMapKey);
            return {
              doc: function (subDocId: string) {
                return {
                  id: subDocId,
                  get: async () => {
                    const sData = subMap.get(subDocId);
                    return { exists: !!sData, id: subDocId, data: () => sData };
                  },
                  set: async (sData: any, opts?: any) => {
                    if (opts?.merge) {
                      const existing = subMap.get(subDocId) || {};
                      subMap.set(subDocId, { ...existing, ...sData });
                    } else {
                      subMap.set(subDocId, sData);
                    }
                  },
                  update: async (up: any) => {
                    const sData = subMap.get(subDocId);
                    if (sData) Object.assign(sData, up);
                  }
                };
              },
              add: async (sData: any) => {
                const newId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                subMap.set(newId, sData);
                return { id: newId };
              },
              where: function (field: string, op: string, val: any) {
                return {
                  get: async () => {
                    const results: any[] = [];
                    subMap.forEach((v, k) => {
                      if (v[field] === val) {
                        results.push({ id: k, data: () => v });
                      }
                    });
                    return { empty: results.length === 0, size: results.length, docs: results, forEach: (fn: any) => results.forEach(fn) };
                  }
                };
              },
              get: async () => {
                const results: any[] = [];
                subMap.forEach((v, k) => {
                  results.push({ id: k, data: () => v });
                });
                return { empty: results.length === 0, size: results.length, docs: results, forEach: (fn: any) => results.forEach(fn) };
              },
              orderBy: function () { return this; },
              limit: function () { return this; }
            };
          };

          const docObj = {
            id: docId,
            collection: makeCollection,
            ref: {
              id: docId,
              collection: makeCollection,
              get: async () => {
                const data = colMap.get(docId);
                return { exists: !!data, id: docId, data: () => data, ref: { update: async (up: any) => Object.assign(data, up) } };
              },
              set: async (data: any, opts?: any) => {
                if (opts?.merge) {
                  const existing = colMap.get(docId) || {};
                  colMap.set(docId, { ...existing, ...data });
                } else {
                  colMap.set(docId, data);
                }
              },
              update: async (up: any) => {
                const data = colMap.get(docId);
                if (data) Object.assign(data, up);
              }
            },
            get: async () => {
              const data = colMap.get(docId);
              return { exists: !!data, id: docId, data: () => data, ref: { update: async (up: any) => Object.assign(data, up) } };
            },
            set: async (data: any, opts?: any) => {
              if (opts?.merge) {
                const existing = colMap.get(docId) || {};
                colMap.set(docId, { ...existing, ...data });
              } else {
                colMap.set(docId, data);
              }
            },
            update: async (up: any) => {
              const data = colMap.get(docId);
              if (data) Object.assign(data, up);
            }
          };

          return docObj;
        },
        add: async (data: any) => {
          const autoId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          colMap.set(autoId, data);
          return { id: autoId };
        },
        where: function (field: string, op: string, val: any) {
          return {
            where: function (field2: string, op2: string, val2: any) {
              return {
                limit: function (l: number) {
                  return {
                    get: async () => {
                      const results: any[] = [];
                      colMap.forEach((v, k) => {
                        if (v[field] === val && v[field2] === val2) {
                          results.push({ id: k, data: () => v, ref: { update: async (up: any) => Object.assign(v, up) } });
                        }
                      });
                      return { empty: results.length === 0, size: results.length, docs: results, forEach: (fn: any) => results.forEach(fn) };
                    }
                  };
                },
                get: async () => {
                  const results: any[] = [];
                  colMap.forEach((v, k) => {
                    if (v[field] === val && v[field2] === val2) {
                      results.push({ id: k, data: () => v, ref: { update: async (up: any) => Object.assign(v, up) } });
                    }
                  });
                  return { empty: results.length === 0, size: results.length, docs: results, forEach: (fn: any) => results.forEach(fn) };
                }
              };
            },
            limit: function (l: number) {
              return {
                get: async () => {
                  const results: any[] = [];
                  colMap.forEach((v, k) => {
                    if (v[field] === val) {
                      results.push({ id: k, data: () => v, ref: { update: async (up: any) => Object.assign(v, up) } });
                    }
                  });
                  return { empty: results.length === 0, size: results.length, docs: results, forEach: (fn: any) => results.forEach(fn) };
                }
              };
            },
            get: async () => {
              const results: any[] = [];
              colMap.forEach((v, k) => {
                if (v[field] === val) {
                  results.push({ id: k, data: () => v, ref: { update: async (up: any) => Object.assign(v, up) } });
                }
              });
              return { empty: results.length === 0, size: results.length, docs: results, forEach: (fn: any) => results.forEach(fn) };
            },
            orderBy: function () { return this; }
          };
        },
        orderBy: function () { return this; },
        limit: function () { return this; }
      };
    },
    runTransaction: async (cb: any) => {
      const tx = {
        get: async (docRef: any) => docRef.get(),
        set: async (docRef: any, data: any, opts?: any) => docRef.set(data, opts),
        update: async (docRef: any, data: any) => docRef.update(data)
      };
      return await cb(tx);
    }
  };
}

async function runFinancialTests() {
  console.log("=================================================");
  console.log("RUNNING PHASE 7B.4 FINANCIAL SETTLEMENT TEST SUITE");
  console.log("=================================================\n");

  const adminEmail = "finance.manager@saandsha.com";

  // --- TEST 1: FULL REFUND EXECUTION ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-001";
    const orderId = "ORD-7B4-001";
    const profileId = "PROF-7B4-001";

    // Seed customer profile
    await db.collection("customer_profiles").doc(profileId).set({
      customer_id: "KL-C10001",
      email: "jane.doe@example.com",
      full_name: "Jane Doe"
    });

    // Seed product
    await db.collection("products").doc("PROD-001").set({
      name: "Linen Shirt White",
      sku: "LS-W-M",
      stock: 10
    });

    // Seed parent order
    await db.collection("orders").doc(orderId).set({
      order_id: orderId,
      customer_profile_id: profileId,
      grand_total: 2500,
      amount_paid_cash: 2500,
      points_redeemed: 0
    });

    // Seed return request in inspection_passed status
    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      order_id: orderId,
      customer_profile_id: profileId,
      customer_name: "Jane Doe",
      customer_email: "jane.doe@example.com",
      status: "inspection_passed",
      resolution: "refund",
      refund_amount: 2500,
      pickup_fee_amount: 100,
      items: [
        { product_id: "PROD-001", sku: "LS-W-M", quantity: 1, unit_price: 2500, grade: "A" }
      ],
      inspection_report: {
        overall_condition_grade: "A",
        items_inspection: [{ product_id: "PROD-001", grade: "A", quantity: 1 }]
      },
      created_at: new Date().toISOString()
    });

    const res = await processReturnFinancials(db, adminEmail, returnId);
    assert.strictEqual(res.success, true, "Financial settlement should succeed for full refund");
    assert.strictEqual(res.status, "completed");
    assert.strictEqual(res.settlement.settlement_breakdown.net_refund, 2400); // 2500 - 100 pickup fee
    assert.strictEqual(res.settlement.settlement_breakdown.cash_refund_executed, 2400);

    // Verify inventory restocked
    const prodDoc = (await db.collection("products").doc("PROD-001").get()).data();
    assert.strictEqual(prodDoc.stock, 11, "Stock should be incremented from 10 to 11 for Grade A restock");

    console.log("  ✓ PASSED: Full Refund Execution & Stock Restock");
  })();

  // --- TEST 2: STORE CREDIT ISSUANCE ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-002";
    const orderId = "ORD-7B4-002";
    const profileId = "PROF-7B4-002";

    await db.collection("customer_profiles").doc(profileId).set({
      customer_id: "KL-C10002",
      email: "adam.smith@example.com"
    });

    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      order_id: orderId,
      customer_profile_id: profileId,
      status: "inspection_passed",
      resolution: "store_credit",
      refund_amount: 1800,
      pickup_fee_amount: 100,
      items: [{ product_id: "PROD-002", quantity: 1, unit_price: 1800 }],
      inspection_report: { overall_condition_grade: "A", items_inspection: [{ product_id: "PROD-002", grade: "A", quantity: 1 }] }
    });

    const res = await processReturnFinancials(db, adminEmail, returnId);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "completed");
    assert.strictEqual(res.settlement.settlement_breakdown.store_credit_issued, 1700);

    // Check store credit ledger entry
    const profileRef = db.collection("customer_profiles").doc(profileId);
    const ledgerSnap = await profileRef.collection("store_credit_ledger").get();
    assert.strictEqual(ledgerSnap.size, 1, "Should record 1 store credit ledger entry");

    console.log("  ✓ PASSED: Store Credit Resolution & Ledger Writing");
  })();

  // --- TEST 3: MIXED PAYMENT ALLOCATION & LOYALTY CLAWBACK ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-003";
    const orderId = "ORD-7B4-003";
    const profileId = "PROF-7B4-003";

    await db.collection("customer_profiles").doc(profileId).set({
      customer_id: "KL-C10003",
      email: "loyalty.user@example.com"
    });

    await db.collection("orders").doc(orderId).set({
      order_id: orderId,
      customer_profile_id: profileId,
      grand_total: 3000,
      amount_paid_cash: 2000,
      store_credit_redeemed_rupees: 500,
      points_redeemed: 2000 // ₹500 value
    });

    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      order_id: orderId,
      customer_profile_id: profileId,
      status: "inspection_passed",
      resolution: "refund",
      refund_amount: 3000,
      pickup_fee_amount: 100,
      items: [{ product_id: "PROD-003", quantity: 1, unit_price: 3000 }],
      inspection_report: { overall_condition_grade: "A", items_inspection: [{ product_id: "PROD-003", grade: "A", quantity: 1 }] }
    });

    const res = await processReturnFinancials(db, adminEmail, returnId);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.settlement.settlement_breakdown.net_refund, 2900);
    assert.strictEqual(res.settlement.settlement_breakdown.cash_refund_executed, 2000); // capped at cash paid
    assert.strictEqual(res.settlement.settlement_breakdown.store_credit_issued, 900); // remaining 2900 - 2000
    assert.strictEqual(res.settlement.settlement_breakdown.points_clawed_back, 30); // 3000 / 100

    console.log("  ✓ PASSED: Mixed Payment Deterministic Allocation & Loyalty Reversals");
  })();

  // --- TEST 4: INVENTORY ROUTING BY INSPECTION GRADES ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-004";
    const orderId = "ORD-7B4-004";

    await db.collection("products").doc("PROD-GRADE-B").set({ stock: 5, qc_hold_stock: 0 });
    await db.collection("products").doc("PROD-GRADE-E").set({ stock: 5, destroy_stock: 0 });

    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      order_id: orderId,
      status: "inspection_passed",
      resolution: "refund",
      refund_amount: 4000,
      items: [
        { product_id: "PROD-GRADE-B", quantity: 2, unit_price: 2000 },
        { product_id: "PROD-GRADE-E", quantity: 1, unit_price: 2000 }
      ],
      inspection_report: {
        overall_condition_grade: "MIXED",
        items_inspection: [
          { product_id: "PROD-GRADE-B", grade: "B", quantity: 2 },
          { product_id: "PROD-GRADE-E", grade: "E", quantity: 1 }
        ]
      }
    });

    const res = await processReturnFinancials(db, adminEmail, returnId);
    assert.strictEqual(res.success, true);

    const prodB = (await db.collection("products").doc("PROD-GRADE-B").get()).data();
    const prodE = (await db.collection("products").doc("PROD-GRADE-E").get()).data();

    assert.strictEqual(prodB.qc_hold_stock, 2, "Grade B item should route to qc_hold_stock");
    assert.strictEqual(prodE.destroy_stock, 1, "Grade E item should route to destroy_stock");

    // Check inventory movement logs
    const logs = await db.collection("inventory_logs").where("rma_number", "==", returnId).get();
    assert.strictEqual(logs.size, 2, "Should create 2 immutable inventory movement records");

    console.log("  ✓ PASSED: Inventory Grade Routing & Immutable Movement Logs");
  })();

  // --- TEST 5: EXCHANGE FULFILLMENT & REPLACEMENT ORDER CREATION ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-005";
    const orderId = "ORD-7B4-005";

    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      order_id: orderId,
      status: "inspection_passed",
      resolution: "exchange",
      customer_name: "Charlie Brown",
      customer_email: "charlie@example.com",
      items: [{ product_id: "PROD-EXCH-1", quantity: 1, replacement_product_id: "PROD-EXCH-NEW", name: "New Size L" }],
      inspection_report: { overall_condition_grade: "A", items_inspection: [{ product_id: "PROD-EXCH-1", grade: "A", quantity: 1 }] }
    });

    const res = await processReturnFinancials(db, adminEmail, returnId);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "exchange_shipped");
    assert.ok(res.settlement.exchange_details.exchange_order_id.includes("EXCH-"));

    const exchOrder = (await db.collection("orders").doc(res.settlement.exchange_details.exchange_order_id).get()).data();
    assert.strictEqual(exchOrder.is_exchange_order, true);
    assert.strictEqual(exchOrder.parent_rma_number, returnId);

    console.log("  ✓ PASSED: Exchange Fulfillment & Replacement Order Linkage");
  })();

  // --- TEST 6: IDEMPOTENCY & DUPLICATE REQUEST PREVENTION ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-006";

    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      status: "completed",
      financial_settlement: { financial_status: "completed", net_refund_rupees: 1500 }
    });

    const res = await processReturnFinancials(db, adminEmail, returnId);
    assert.strictEqual(res.success, true);
    assert.ok(res.message.includes("already completed"), "Should return idempotent success without re-executing");

    console.log("  ✓ PASSED: Idempotency Check & Duplicate Request Defense");
  })();

  // --- TEST 7: RECOVERY FROM FINANCIAL FAILURE VIA RETRY ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-007";

    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      status: "financial_failed",
      financial_error: "Razorpay timeout error",
      resolution: "refund",
      refund_amount: 1000,
      items: [{ product_id: "PROD-007", quantity: 1, unit_price: 1000 }],
      inspection_report: { overall_condition_grade: "A", items_inspection: [{ product_id: "PROD-007", grade: "A", quantity: 1 }] }
    });

    const retryRes = await retryReturnFinancials(db, adminEmail, returnId);
    assert.strictEqual(retryRes.success, true, "Retry should successfully re-process financials");
    assert.strictEqual(retryRes.status, "completed");

    console.log("  ✓ PASSED: Failure Recovery & Retry Mechanism");
  })();

  // --- TEST 8: FINANCIAL RECONCILIATION HELPER ---
  await (async () => {
    const db = createMockDb();
    const returnId = "RMA-7B4-008";

    await db.collection("return_requests").doc(returnId).set({
      rma_number: returnId,
      status: "completed",
      items: [{ product_id: "P8", quantity: 1 }],
      financial_settlement: {
        resolution: "refund",
        settlement_breakdown: {
          net_refund: 1200,
          cash_refund_executed: 1000,
          store_credit_issued: 200
        }
      }
    });

    // Seed inventory log to pass reconciliation
    await db.collection("inventory_logs").add({ rma_number: returnId });

    const reconRes = await getReturnReconciliation(db, returnId);
    assert.strictEqual(reconRes.success, true);
    assert.strictEqual(reconRes.is_balanced, true);

    console.log("  ✓ PASSED: Financial & Inventory Reconciliation Audit Helper");
  })();

  console.log("\n=================================================");
  console.log("SUMMARY: ALL 8 FINANCIAL SETTLEMENT TESTS PASSED");
  console.log("=================================================");
}

import { describe, it } from "vitest";

describe("Financial Returns Helpers", () => {
  it("runs financial returns test suite", async () => {
    await runFinancialTests();
  });
});
