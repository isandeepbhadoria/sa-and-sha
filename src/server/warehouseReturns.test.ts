import assert from "assert";
import {
  getWarehouseReturnsList,
  getWarehouseReturnDetail,
  receiveWarehouseParcel,
  startWarehouseInspection,
  completeWarehouseInspection,
  uploadWarehousePhoto,
  addWarehouseInternalNote
} from "./warehouseReturnsHelpers";
import {
  VALID_STATUS_TRANSITIONS,
  ALLOWED_RMA_STATUSES
} from "./adminReturnsHelpers";

/**
 * In-Memory Firestore Mock for Warehouse Return Tests
 */
class MockFirestore {
  private collections: Map<string, Map<string, any>> = new Map();

  getCollection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
    const transaction = {
      async get(docRef: any) {
        return docRef.get();
      },
      update(docRef: any, data: any) {
        return docRef.update(data);
      },
      set(docRef: any, data: any, options?: any) {
        return docRef.set(data, options);
      }
    };
    return updateFunction(transaction);
  }

  collection(collName: string) {
    const collMap = this.getCollection(collName);
    const self = this;

    return {
      doc(docId: string) {
        return {
          id: docId,
          async get() {
            const data = collMap.get(docId);
            return {
              id: docId,
              exists: !!data,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
              ref: self.collection(collName).doc(docId)
            };
          },
          async update(fields: any) {
            const existing = collMap.get(docId) || {};
            const updated = { ...existing, ...fields };
            collMap.set(docId, updated);
          },
          async set(fields: any, options?: any) {
            if (options?.merge) {
              const existing = collMap.get(docId) || {};
              collMap.set(docId, { ...existing, ...fields });
            } else {
              collMap.set(docId, fields);
            }
          },
          collection(subCollName: string) {
            const subKey = `${collName}/${docId}/${subCollName}`;
            return self.collection(subKey);
          }
        };
      },
      async add(data: any) {
        const id = `mock_id_${Math.random().toString(36).slice(2, 9)}`;
        collMap.set(id, { ...data, id });
        return { id, ...(collMap.get(id) || {}) };
      },
      where(field: string, op: string, value: any) {
        return createQuery(collMap, [{ field, op, value }], [], null, null);
      },
      orderBy(field: string, direction: "asc" | "desc" = "asc") {
        return createQuery(collMap, [], [{ field, direction }], null, null);
      },
      limit(n: number) {
        return createQuery(collMap, [], [], n, null);
      },
      async get() {
        return createQuery(collMap, [], [], null, null).get();
      }
    };
  }
}

function createQuery(
  collMap: Map<string, any>,
  filters: Array<{ field: string; op: string; value: any }>,
  orders: Array<{ field: string; direction: "asc" | "desc" }>,
  limitNum: number | null,
  startAfterDoc: any | null
) {
  return {
    where(field: string, op: string, value: any) {
      return createQuery(collMap, [...filters, { field, op, value }], orders, limitNum, startAfterDoc);
    },
    orderBy(field: string, direction: "asc" | "desc" = "asc") {
      return createQuery(collMap, filters, [...orders, { field, direction }], limitNum, startAfterDoc);
    },
    limit(n: number) {
      return createQuery(collMap, filters, orders, n, startAfterDoc);
    },
    startAfter(docSnap: any) {
      return createQuery(collMap, filters, orders, limitNum, docSnap);
    },
    async get() {
      let items = Array.from(collMap.entries()).map(([id, data]) => ({
        id,
        data: () => JSON.parse(JSON.stringify(data)),
        ...data
      }));

      for (const filter of filters) {
        items = items.filter(item => {
          const val = item[filter.field];
          if (filter.op === "==") return val === filter.value;
          if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(val);
          if (filter.op === ">=") return val >= filter.value;
          if (filter.op === "<=") return val <= filter.value;
          return true;
        });
      }

      for (const order of orders) {
        items.sort((a, b) => {
          const valA = a[order.field] ?? "";
          const valB = b[order.field] ?? "";
          if (valA < valB) return order.direction === "asc" ? -1 : 1;
          if (valA > valB) return order.direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      if (startAfterDoc) {
        const index = items.findIndex(item => item.id === startAfterDoc.id);
        if (index >= 0) {
          items = items.slice(index + 1);
        }
      }

      if (limitNum !== null && limitNum > 0) {
        items = items.slice(0, limitNum);
      }

      const docs = items.map(item => ({
        id: item.id,
        exists: true,
        data: () => JSON.parse(JSON.stringify(item))
      }));

      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach(fn: (doc: any) => void) {
          docs.forEach(fn);
        }
      };
    }
  };
}

/**
 * Test Runner Helper
 */
async function runTestSuite() {
  console.log("=================================================");
  console.log("RUNNING PHASE 7B.3 WAREHOUSE WORKBENCH TEST SUITE");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASSED: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAILED: ${name}`);
      console.error(`    Error: ${err.message}`);
      if (err.stack) {
        console.error(`    ${err.stack.split("\n").slice(0, 5).join("\n    ")}`);
      }
      failed++;
    }
  }

  // --- SECTION 1: WAREHOUSE RECEIVING TESTS ---
  await test("Parcel Receiving: Successfully receives approved return parcel", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_101";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      rma_number: "RMA-2026-101",
      order_id: "KL1001",
      status: "return_approved",
      customer_name: "Rahul Sharma",
      created_at: new Date().toISOString()
    });

    const res = await receiveWarehouseParcel(db, returnId, "warehouse@saandsha.com", {
      warehouse_location: "BLR-WH-A01",
      carrier_name: "Delhivery Surface",
      tracking_number: "DEL123456789",
      parcel_condition: "intact_unopened",
      notes: "Box undamaged upon arrival."
    });
    if (!res.success) {
      console.log("RECEIVE PARCEL FAIL RES:", res);
    }

    assert.strictEqual(res.success, true, "Receiving parcel should succeed");
    assert.strictEqual(res.status, "warehouse_received", "Status should transition to warehouse_received");

    const updated = (await db.collection("return_requests").doc(returnId).get()).data();
    assert.strictEqual(updated.status, "warehouse_received");
    assert.strictEqual(updated.receiving_info.warehouse_location, "BLR-WH-A01");
    assert.strictEqual(updated.receiving_info.received_by, "warehouse@saandsha.com");
    assert.ok(updated.receiving_info.received_at, "Received timestamp should be populated");

    // Check audit log created
    const audits = (await db.collection("return_requests").doc(returnId).collection("audit_logs").get()).docs;
    assert.strictEqual(audits.length, 1, "Audit log should be created");
    assert.strictEqual(audits[0].data().action, "rma_PARCEL_RECEIVED");
  });

  await test("Parcel Receiving: Rejects receiving for unapproved return status", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_102";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      rma_number: "RMA-2026-102",
      order_id: "KL1002",
      status: "requested", // Still pending review
      created_at: new Date().toISOString()
    });

    const res = await receiveWarehouseParcel(db, returnId, "warehouse@saandsha.com", {
      warehouse_location: "BLR-WH-A01",
      carrier_name: "BlueDart",
      tracking_number: "BD987654321",
      parcel_condition: "tampered"
    });

    assert.strictEqual(res.success, false, "Should reject receiving unapproved RMA");
    assert.ok((res as any).error?.includes("Cannot receive parcel for return request in status 'requested'"));
  });

  // --- SECTION 2: INSPECTION START TESTS ---
  await test("Inspection Start: Transitions status from warehouse_received to inspection_in_progress", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_201";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      rma_number: "RMA-2026-201",
      status: "warehouse_received",
      created_at: new Date().toISOString()
    });

    const res = await startWarehouseInspection(db, returnId, "inspector.jane@saandsha.com");
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, "inspection_in_progress");

    const updated = (await db.collection("return_requests").doc(returnId).get()).data();
    assert.strictEqual(updated.status, "inspection_in_progress");
    assert.strictEqual(updated.inspection_assigned_to, "inspector.jane@saandsha.com");
    assert.ok(updated.inspection_started_at);
  });

  await test("Inspection Start: Prevents double starting if not in warehouse_received", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_202";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      status: "inspection_in_progress",
      created_at: new Date().toISOString()
    });

    const res = await startWarehouseInspection(db, returnId, "inspector.jane@saandsha.com");
    assert.strictEqual(res.success, false);
    assert.ok((res as any).error?.includes("Cannot start inspection from status 'inspection_in_progress'"));
  });

  // --- SECTION 3: INSPECTION COMPLETION & DECISION LOGIC TESTS ---
  await test("Inspection Completion: All items A Grade results in inspection_passed", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_301";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      rma_number: "RMA-2026-301",
      status: "inspection_in_progress",
      created_at: new Date().toISOString()
    });

    const inspectionPayload = {
      overall_condition_grade: "A_grade_resellable" as const,
      inspection_summary: "Pristine condition, tags attached.",
      items_inspection: [
        {
          product_id: "ls-white-01",
          sku: "KL-LS-WHT-L",
          name: "Linen Shirt White",
          tags_attached: true,
          original_packaging: true,
          worn_used_washed: false,
          stain_damage_smell: false,
          counterfeited_swapped: false,
          grade: "A_grade_resellable" as const,
          recommended_action: "restock_as_new" as const,
          notes: "Perfect condition"
        }
      ]
    };

    const res = await completeWarehouseInspection(db, returnId, "inspector.jane@saandsha.com", inspectionPayload);
    assert.strictEqual(res.success, true);
    assert.strictEqual((res as any).recommended_next_status, "inspection_passed");
    assert.strictEqual(res.status, "inspection_passed");

    const doc = (await db.collection("return_requests").doc(returnId).get()).data();
    assert.strictEqual(doc.status, "inspection_passed");
    assert.strictEqual(doc.overall_condition_grade, "A_grade_resellable");
    assert.ok(doc.inspection_completed_at);

    // Verify audit log recorded inspection details
    const audits = (await db.collection("return_requests").doc(returnId).collection("audit_logs").get()).docs;
    assert.strictEqual(audits.length, 1);
    assert.strictEqual(audits[0].data().action, "rma_INSPECTION_COMPLETED");
  });

  await test("Inspection Completion: Counterfeited item automatically forces manager_review or inspection_failed", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_302";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      rma_number: "RMA-2026-302",
      status: "inspection_in_progress",
      created_at: new Date().toISOString()
    });

    const inspectionPayload = {
      overall_condition_grade: "D_grade_rejected_scam" as const,
      inspection_summary: "Customer sent back a cheap duplicate shirt with fake label.",
      items_inspection: [
        {
          product_id: "ls-white-01",
          sku: "KL-LS-WHT-L",
          name: "Linen Shirt White",
          tags_attached: false,
          original_packaging: false,
          worn_used_washed: true,
          stain_damage_smell: true,
          counterfeited_swapped: true,
          grade: "D_grade_rejected_scam" as const,
          recommended_action: "reject_and_dispose" as const,
          notes: "Counterfeit product detected"
        }
      ]
    };

    const res = await completeWarehouseInspection(db, returnId, "inspector.jane@saandsha.com", inspectionPayload);
    assert.strictEqual(res.success, true);
    assert.strictEqual((res as any).recommended_next_status, "manager_review");
    assert.strictEqual(res.status, "manager_review");

    const doc = (await db.collection("return_requests").doc(returnId).get()).data();
    assert.strictEqual(doc.status, "manager_review");
  });

  await test("Inspection Completion: Boundary Check — NEVER executes financial side effects", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_303";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      status: "inspection_in_progress",
      refund_amount: 4999,
      created_at: new Date().toISOString()
    });

    const res = await completeWarehouseInspection(db, returnId, "inspector.jane@saandsha.com", {
      overall_condition_grade: "A_grade_resellable",
      items_inspection: [
        {
          product_id: "ls-white-01",
          grade: "A_grade_resellable",
          tags_attached: true,
          original_packaging: true,
          worn_used_washed: false,
          stain_damage_smell: false,
          counterfeited_swapped: false,
          recommended_action: "restock_as_new"
        }
      ]
    });

    assert.strictEqual(res.success, true);

    const doc = (await db.collection("return_requests").doc(returnId).get()).data();
    // Verify NO financial processing fields were updated or mutated
    assert.strictEqual(doc.refund_processed, undefined, "Refund must not be executed in Phase 7B.3");
    assert.strictEqual(doc.store_credit_issued, undefined, "Store credit must not be issued in Phase 7B.3");
    assert.strictEqual(doc.inventory_restocked, undefined, "Inventory restocking must not be performed in Phase 7B.3");
  });

  // --- SECTION 4: PHOTO UPLOAD TESTS ---
  await test("Photo Upload: Appends internal inspection photos cleanly", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_401";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      status: "inspection_in_progress",
      warehouse_photos: [],
      created_at: new Date().toISOString()
    });

    const uploadRes = await uploadWarehousePhoto(db, returnId, "inspector.jane@saandsha.com", {
      url: "https://storage.saandsha.com/warehouse/photo1.jpg",
      photo_type: "item_defect",
      caption: "Stain on right collar"
    });

    assert.strictEqual(uploadRes.success, true);
    assert.strictEqual(uploadRes.total_photos, 1);

    const doc = (await db.collection("return_requests").doc(returnId).get()).data();
    assert.strictEqual(doc.warehouse_photos.length, 1);
    assert.strictEqual(doc.warehouse_photos[0].url, "https://storage.saandsha.com/warehouse/photo1.jpg");
    assert.strictEqual(doc.warehouse_photos[0].photo_type, "item_defect");
    assert.strictEqual(doc.warehouse_photos[0].uploaded_by, "inspector.jane@saandsha.com");
  });

  // --- SECTION 5: WAREHOUSE INTERNAL NOTES ISOLATION TESTS ---
  await test("Warehouse Notes: Notes are stored in warehouse_notes subcollection only", async () => {
    const db = new MockFirestore() as any;
    const returnId = "rma_ret_501";

    await db.collection("return_requests").doc(returnId).set({
      return_id: returnId,
      status: "inspection_in_progress",
      created_at: new Date().toISOString()
    });

    const res = await addWarehouseInternalNote(
      db,
      returnId,
      "manager.bob@saandsha.com",
      "Customer called support demanding instant replacement without inspection."
    );

    assert.strictEqual(res.success, true);
    assert.ok(res.note_id);

    // Verify document on top-level return request does NOT contain the private note text
    const parentDoc = (await db.collection("return_requests").doc(returnId).get()).data();
    assert.strictEqual(parentDoc.customer_notes, undefined, "Customer notes should not be touched");
    assert.strictEqual(parentDoc.notes, undefined, "Public notes should not contain internal text");

    // Verify subcollection has the note
    const subNotes = (await db.collection(`return_requests/${returnId}/warehouse_notes`).get()).docs;
    assert.strictEqual(subNotes.length, 1, "Note must be in subcollection");
    assert.strictEqual(subNotes[0].data().note, "Customer called support demanding instant replacement without inspection.");
    assert.strictEqual(subNotes[0].data().author_email, "manager.bob@saandsha.com");
  });

  // --- SECTION 6: WAREHOUSE QUEUE & PAGINATION TESTS ---
  await test("Warehouse Queue: Cursor pagination & filtering works accurately", async () => {
    const db = new MockFirestore() as any;

    // Seed 3 warehouse items
    await db.collection("return_requests").doc("item_1").set({
      return_id: "item_1",
      rma_number: "RMA-100",
      status: "return_approved",
      created_at: "2026-08-01T10:00:00.000Z"
    });

    await db.collection("return_requests").doc("item_2").set({
      return_id: "item_2",
      rma_number: "RMA-101",
      status: "warehouse_received",
      created_at: "2026-08-01T11:00:00.000Z"
    });

    await db.collection("return_requests").doc("item_3").set({
      return_id: "item_3",
      rma_number: "RMA-102",
      status: "inspection_in_progress",
      created_at: "2026-08-01T12:00:00.000Z"
    });

    // Test list without filter
    const listAll = await getWarehouseReturnsList(db, { limit: 10 });
    assert.strictEqual(listAll.success, true);
    assert.strictEqual(listAll.returns.length, 3);

    // Test list with status filter
    const listReceived = await getWarehouseReturnsList(db, { status: "warehouse_received" });
    assert.strictEqual(listReceived.success, true);
    assert.strictEqual(listReceived.returns.length, 1);
    assert.strictEqual(listReceived.returns[0].rma_number, "RMA-101");

    // Test detail retrieval
    const detailRes = await getWarehouseReturnDetail(db, "item_2");
    assert.strictEqual(detailRes.success, true);
    assert.strictEqual(detailRes.return_request.rma_number, "RMA-101");
  });

  console.log("=================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

import { describe, it } from "vitest";

describe("Warehouse Returns Helpers", () => {
  it("runs warehouse returns test suite", async () => {
    await runTestSuite();
  });
});
