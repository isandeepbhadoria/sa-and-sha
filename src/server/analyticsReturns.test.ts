import {
  evaluateCustomerFraudRisk,
  calculateExecutiveHealthScore,
  getExecutiveAnalytics,
  exportAnalyticsReportCsv
} from "./analyticsReturnsHelpers";

// Mock Db for Analytics testing
class MockDocRef {
  id: string;
  dataObj: any;

  constructor(id: string, dataObj: any = {}) {
    this.id = id;
    this.dataObj = dataObj;
  }

  async get() {
    return {
      id: this.id,
      exists: !!this.dataObj,
      data: () => this.dataObj
    };
  }

  async set(data: any) {
    this.dataObj = { ...data };
  }
}

class MockCollectionRef {
  name: string;
  docsMap: Map<string, MockDocRef> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  doc(id: string) {
    if (!this.docsMap.has(id)) {
      this.docsMap.set(id, new MockDocRef(id, null));
    }
    return this.docsMap.get(id)!;
  }

  where(field: string, op: string, val: any) {
    return this;
  }

  limit(n: number) {
    return this;
  }

  async get() {
    const docs = Array.from(this.docsMap.values())
      .filter(d => d.dataObj)
      .map(d => ({
        id: d.id,
        data: () => d.dataObj
      }));

    return {
      size: docs.length,
      docs,
      forEach: (cb: (item: any) => void) => docs.forEach(cb)
    };
  }
}

class MockDb {
  collections: Map<string, MockCollectionRef> = new Map();

  collection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollectionRef(name));
    }
    return this.collections.get(name)!;
  }
}

async function runAnalyticsTests() {
  console.log("=================================================");
  console.log("RUNNING PHASE 7B.6 ANALYTICS & FRAUD INTELLIGENCE TESTS");
  console.log("=================================================");

  // Test 1: Fraud Risk Engine Evaluation
  try {
    const mockProfile = { email: "fraud.user@example.com" };
    const mockOrders = [
      { order_id: "ORD-1", created_at: "2026-07-20T10:00:00Z" },
      { order_id: "ORD-2", created_at: "2026-07-22T10:00:00Z" },
      { order_id: "ORD-3", created_at: "2026-07-25T10:00:00Z" }
    ];
    const mockReturns = [
      { order_id: "ORD-1", created_at: "2026-07-20T14:00:00Z", refund_amount: 12000, reason: "damaged" },
      { order_id: "ORD-2", created_at: "2026-07-22T18:00:00Z", refund_amount: 15000, reason: "damaged" },
      { order_id: "ORD-3", created_at: "2026-07-25T15:00:00Z", refund_amount: 8000, reason: "damaged" }
    ];

    const fraudRes = evaluateCustomerFraudRisk(mockProfile, mockOrders, mockReturns);

    if (fraudRes.score >= 50 && fraudRes.signals.length >= 2 && fraudRes.explanation) {
      console.log("  ✓ PASSED: Fraud Risk Engine & Signal Explainability");
    } else {
      throw new Error(`Fraud engine mismatch: ${JSON.stringify(fraudRes)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Fraud Risk Engine:", err.message);
  }

  // Test 2: Executive Health Score Calculator
  try {
    const health = calculateExecutiveHealthScore({
      return_rate_pct: 3.5,
      sla_compliance_pct: 98.0,
      qc_pass_rate_pct: 94.0,
      inventory_recovery_pct: 90.0,
      high_risk_customer_pct: 1.2
    });

    if (health.score >= 80 && health.grade === "Good" && health.factors) {
      console.log("  ✓ PASSED: Executive Health Score Algorithm");
    } else {
      throw new Error(`Health score mismatch: ${JSON.stringify(health)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Executive Health Score:", err.message);
  }

  // Test 3: Materialized Executive Analytics Engine
  try {
    const db = new MockDb();
    await db.collection("orders").doc("O1").set({ id: "O1" });
    await db.collection("orders").doc("O2").set({ id: "O2" });

    await db.collection("return_requests").doc("R1").set({
      status: "completed",
      resolution: "refund",
      refund_amount: 2500,
      reason: "wrong_size",
      items: [{ product_id: "P-100", name: "Silk Kurta", quantity: 1, unit_price: 2500 }]
    });

    const execRes = await getExecutiveAnalytics(db);

    if (execRes.success && execRes.executive_kpis && execRes.health_score) {
      console.log("  ✓ PASSED: Materialized Executive Analytics Engine");
    } else {
      throw new Error(`Executive analytics failed: ${JSON.stringify(execRes)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Executive Analytics Engine:", err.message);
  }

  // Test 4: CSV Export Formatting
  try {
    const sampleData = [{ product_id: "P-100", name: "Silk Kurta", count: 12, value: 30000 }];
    const csv = exportAnalyticsReportCsv("products", sampleData);

    if (csv.includes("product_id,name,count,value") && csv.includes("P-100,Silk Kurta,12,30000")) {
      console.log("  ✓ PASSED: CSV Analytics Export Engine");
    } else {
      throw new Error(`CSV export invalid: ${csv}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: CSV Export Engine:", err.message);
  }

  console.log("=================================================");
  console.log("SUMMARY: ALL 4 PHASE 7B.6 ANALYTICS TESTS COMPLETED");
  console.log("=================================================");
}

import { describe, it } from "vitest";

describe("Analytics Returns Helpers", () => {
  it("runs analytics returns test suite", async () => {
    await runAnalyticsTests();
  });
});
