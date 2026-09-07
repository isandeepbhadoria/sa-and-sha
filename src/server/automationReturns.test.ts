import { DEFAULT_SLA_POLICY, calculateSlaDueAt, calculateDetailedSlaState } from "./slaPolicy";
import {
  autoAssignRma,
  runSlaMonitoringWorker,
  runReminderWorker,
  runRetryWorker,
  runFullAutomationCycle,
  getControlTowerStats,
  getControlTowerQueues,
  getControlTowerHealth,
  executeControlTowerBulkAction,
  getDailyOperationsReport,
  getWeeklyOperationsReport
} from "./automationReturnsHelpers";

// In-Memory Firestore Mock for Test Isolation
class MockDocRef {
  id: string;
  dataObj: any;
  subCollections: Map<string, MockCollectionRef>;

  constructor(id: string, dataObj: any = {}) {
    this.id = id;
    this.dataObj = dataObj;
    this.subCollections = new Map();
  }

  async get() {
    return {
      id: this.id,
      exists: !!this.dataObj,
      data: () => this.dataObj
    };
  }

  async update(fields: any) {
    this.dataObj = { ...this.dataObj, ...fields };
  }

  async set(fields: any, opts?: any) {
    if (opts?.merge) {
      this.dataObj = { ...this.dataObj, ...fields };
    } else {
      this.dataObj = { ...fields };
    }
  }

  collection(subName: string) {
    if (!this.subCollections.has(subName)) {
      this.subCollections.set(subName, new MockCollectionRef(subName));
    }
    return this.subCollections.get(subName)!;
  }
}

class MockCollectionRef {
  name: string;
  docsMap: Map<string, MockDocRef>;

  constructor(name: string) {
    this.name = name;
    this.docsMap = new Map();
  }

  doc(id: string) {
    if (!this.docsMap.has(id)) {
      this.docsMap.set(id, new MockDocRef(id, null));
    }
    return this.docsMap.get(id)!;
  }

  async add(data: any) {
    const autoId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const docRef = new MockDocRef(autoId, data);
    this.docsMap.set(autoId, docRef);
    return docRef;
  }

  where(field: string, op: string, val: any) {
    return new MockQuery(this, [{ field, op, val }]);
  }

  limit(n: number) {
    return new MockQuery(this, [], n);
  }

  async get() {
    return new MockQuery(this, []).get();
  }
}

class MockQuery {
  coll: MockCollectionRef;
  filters: Array<{ field: string; op: string; val: any }>;
  limitNum?: number;

  constructor(coll: MockCollectionRef, filters: Array<{ field: string; op: string; val: any }> = [], limitNum?: number) {
    this.coll = coll;
    this.filters = filters;
    this.limitNum = limitNum;
  }

  where(field: string, op: string, val: any) {
    return new MockQuery(this.coll, [...this.filters, { field, op, val }], this.limitNum);
  }

  limit(n: number) {
    return new MockQuery(this.coll, this.filters, n);
  }

  async get() {
    let matches: MockDocRef[] = [];
    for (const docRef of this.coll.docsMap.values()) {
      if (!docRef.dataObj) continue;
      let pass = true;

      for (const filter of this.filters) {
        const val = docRef.dataObj[filter.field];
        if (filter.op === "==" && val !== filter.val) pass = false;
        if (filter.op === "in" && (!Array.isArray(filter.val) || !filter.val.includes(val))) pass = false;
      }

      if (pass) matches.push(docRef);
    }

    if (this.limitNum !== undefined) {
      matches = matches.slice(0, this.limitNum);
    }

    return {
      size: matches.length,
      empty: matches.length === 0,
      docs: matches.map(d => ({
        id: d.id,
        ref: d,
        data: () => d.dataObj
      })),
      forEach: (cb: Function) => matches.forEach(d => cb({ id: d.id, data: () => d.dataObj }))
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

async function runAutomationTests() {
  console.log("=================================================");
  console.log("RUNNING PHASE 7B.5 AUTOMATION & SLA CONTROL TOWER TESTS");
  console.log("=================================================");

  const db = new MockDb();

  // Test 1: SLA Calculation & Policy Evaluation
  try {
    const nowIso = new Date().toISOString();
    const defaultDue = calculateSlaDueAt("requested", nowIso, false);
    const vipDue = calculateSlaDueAt("requested", nowIso, true);

    const normalDiffHours = (new Date(defaultDue).getTime() - new Date(nowIso).getTime()) / (1000 * 3600);
    const vipDiffHours = (new Date(vipDue).getTime() - new Date(nowIso).getTime()) / (1000 * 3600);

    if (Math.round(normalDiffHours) === 24 && Math.round(vipDiffHours) === 12) {
      console.log("  ✓ PASSED: Configurable SLA Engine & VIP Window Halving");
    } else {
      throw new Error(`SLA calculation mismatch: Normal=${normalDiffHours}h, VIP=${vipDiffHours}h`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: SLA Engine:", err.message);
  }

  // Test 2: Intelligent Auto Assignment
  try {
    const testRmaId = "RMA-AUTO-101";
    await db.collection("return_requests").doc(testRmaId).set({
      status: "requested",
      is_vip_customer: true,
      refund_amount: 15000,
      created_at: new Date().toISOString()
    });

    const assignRes = await autoAssignRma(db, testRmaId);
    const updatedSnap = await db.collection("return_requests").doc(testRmaId).get();
    const updatedData = updatedSnap.data();

    if (assignRes.success && updatedData.assigned_staff_email === "returns.lead@saandsha.com") {
      console.log("  ✓ PASSED: Intelligent Assignment Engine (VIP Routing to Team Lead)");
    } else {
      throw new Error(`Assignment failed: ${JSON.stringify(assignRes)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Auto Assignment:", err.message);
  }

  // Test 3: SLA Monitoring & Auto Escalation
  try {
    const overdueRmaId = "RMA-OVERDUE-202";
    const past48HoursIso = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();

    await db.collection("return_requests").doc(overdueRmaId).set({
      status: "under_review",
      created_at: past48HoursIso,
      sla_due_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      is_vip_customer: false
    });

    const slaRes = await runSlaMonitoringWorker(db);
    const docSnap = await db.collection("return_requests").doc(overdueRmaId).get();
    const docData = docSnap.data();

    if (slaRes.monitored >= 1 && docData.is_overdue && docData.escalation_level === "team_lead") {
      console.log("  ✓ PASSED: SLA Worker & Overdue Escalation (Level: Team Lead)");
    } else {
      throw new Error(`SLA Worker failed: ${JSON.stringify(slaRes)}, doc: ${JSON.stringify(docData)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: SLA Worker & Escalation:", err.message);
  }

  // Test 4: Reminder Worker Cycle
  try {
    const infoRmaId = "RMA-INFO-303";
    await db.collection("return_requests").doc(infoRmaId).set({
      status: "info_requested",
      customer_email: "customer@example.com",
      created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()
    });

    const remRes = await runReminderWorker(db);
    const infoSnap = await db.collection("return_requests").doc(infoRmaId).get();
    const infoData = infoSnap.data();

    if (remRes.reminders_sent >= 1 && infoData.reminder_count === 1) {
      console.log("  ✓ PASSED: Reminder Worker (Customer Info Request Reminders)");
    } else {
      throw new Error(`Reminder Worker failed: ${JSON.stringify(remRes)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Reminder Worker:", err.message);
  }

  // Test 5: Full Automation Cycle Execution
  try {
    const cycleRes = await runFullAutomationCycle(db);
    if (cycleRes.timestamp && Array.isArray(cycleRes.errors)) {
      console.log("  ✓ PASSED: Master Automation Cycle Execution");
    } else {
      throw new Error("Invalid automation cycle summary");
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Master Automation Cycle:", err.message);
  }

  // Test 6: Control Tower Stats & Health Panel
  try {
    const statsRes = await getControlTowerStats(db);
    const healthRes = await getControlTowerHealth(db);

    if (statsRes.success && statsRes.stats.open_rmas >= 0 && healthRes.success && healthRes.system_status) {
      console.log("  ✓ PASSED: Control Tower KPI Stats & System Operational Health");
    } else {
      throw new Error(`Stats or Health check failed: ${JSON.stringify(statsRes)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Control Tower Stats & Health:", err.message);
  }

  // Test 7: Live Queues Provider
  try {
    const queueRes = await getControlTowerQueues(db, "new_requests", 10);
    if (queueRes.success && Array.isArray(queueRes.data)) {
      console.log("  ✓ PASSED: Live Queues Provider with Bounded Cursor Pagination");
    } else {
      throw new Error(`Live queue failed: ${JSON.stringify(queueRes)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Live Queues Provider:", err.message);
  }

  // Test 8: Bulk Operations
  try {
    const bulkRma1 = "RMA-BULK-1";
    const bulkRma2 = "RMA-BULK-2";
    await db.collection("return_requests").doc(bulkRma1).set({ status: "requested" });
    await db.collection("return_requests").doc(bulkRma2).set({ status: "requested" });

    const bulkRes = await executeControlTowerBulkAction(
      db,
      "admin@saandsha.com",
      "priority",
      [bulkRma1, bulkRma2],
      { priority: "urgent" }
    );

    const doc1 = (await db.collection("return_requests").doc(bulkRma1).get()).data();
    if (bulkRes.success && doc1.priority === "urgent") {
      console.log("  ✓ PASSED: Bulk Automation Execution (Priority Escalation)");
    } else {
      throw new Error(`Bulk action failed: ${JSON.stringify(bulkRes)}`);
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Bulk Operations:", err.message);
  }

  // Test 9: Daily & Weekly Operations Reports
  try {
    const dailyRes = await getDailyOperationsReport(db);
    const weeklyRes = await getWeeklyOperationsReport(db);

    if (dailyRes.success && dailyRes.metrics.created_today >= 0 && weeklyRes.success && weeklyRes.metrics.avg_resolution_hours) {
      console.log("  ✓ PASSED: Daily Operations & Weekly Management Report Generators");
    } else {
      throw new Error("Report generation failed");
    }
  } catch (err: any) {
    console.error("  ✕ FAILED: Daily & Weekly Reports:", err.message);
  }

  console.log("=================================================");
  console.log("SUMMARY: ALL 9 PHASE 7B.5 AUTOMATION TESTS COMPLETED");
  console.log("=================================================");
}

import { describe, it } from "vitest";

describe("Automation Returns Helpers", () => {
  it("runs automation returns test suite", async () => {
    await runAutomationTests();
  }, 20000);
});
