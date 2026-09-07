import { describe, it, expect, beforeEach } from "vitest";
import {
  createCustomerReturnRequest,
  generateRmaNumber,
  getCustomerReturnRequests,
  getCustomerReturnRequestById,
  validateOrderReturnEligibility,
  CreateReturnRequestPayload
} from "../customerReturnsHelpers";
import {
  getAdminReturnsList,
  getAdminReturnStats,
  getAdminReturnDetail,
  approveReturnRequest,
  rejectReturnRequest,
  scheduleReturnPickup
} from "../adminReturnsHelpers";
import {
  executeProviderRefundServiceContract,
  processReturnFinancials
} from "../financialReturnsHelpers";

/**
 * In-Memory Firestore Mock for Phase 10.5A Consolidation Tests
 */
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
      doc(docId: string) {
        return {
          id: docId,
          collection(subCollName: string) {
            return self.collection(`${collName}_${docId}_${subCollName}`);
          },
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
            collMap.set(docId, { ...existing, ...fields });
          },
          async set(data: any, opts?: any) {
            if (opts?.merge) {
              const existing = collMap.get(docId) || {};
              collMap.set(docId, { ...existing, ...data });
            } else {
              collMap.set(docId, JSON.parse(JSON.stringify(data)));
            }
          }
        };
      },
      async add(data: any) {
        const id = `doc_${Math.random().toString(36).substring(2, 9)}`;
        const docObj = { id, ...JSON.parse(JSON.stringify(data)) };
        collMap.set(id, docObj);
        return {
          id,
          get: async () => ({
            id,
            exists: true,
            data: () => JSON.parse(JSON.stringify(docObj)),
            ref: self.collection(collName).doc(id)
          })
        };
      },
      orderBy(field: string, dir?: string) {
        return this;
      },
      limit(num: number) {
        return this;
      },
      where(field: string, op: string, val: any) {
        return {
          orderBy(f: string, d?: string) { return this; },
          limit(num: number) { return this; },
          async get() {
            const results: any[] = [];
            for (const [id, item] of collMap.entries()) {
              let match = false;
              if (op === "==") match = item[field] === val;
              if (match) {
                results.push({
                  exists: true,
                  id,
                  data: () => JSON.parse(JSON.stringify(item)),
                  ref: self.collection(collName).doc(id)
                });
              }
            }
            return {
              empty: results.length === 0,
              docs: results,
              forEach: (cb: any) => results.forEach(cb)
            };
          }
        };
      },
      async get() {
        const results: any[] = [];
        for (const [id, item] of collMap.entries()) {
          results.push({
            exists: true,
            id,
            data: () => JSON.parse(JSON.stringify(item)),
            ref: self.collection(collName).doc(id)
          });
        }
        return {
          empty: results.length === 0,
          docs: results,
          forEach: (cb: any) => results.forEach(cb)
        };
      }
    };
  }

  runTransaction(cb: any) {
    const transaction = {
      get: async (ref: any) => ref.get(),
      set: async (ref: any, data: any, opts?: any) => ref.set(data, opts),
      update: async (ref: any, fields: any) => ref.update(fields)
    };
    return cb(transaction);
  }
}

describe("Phase 10.5A — Returns Architecture Consolidation & Safety Tests", () => {
  let db: MockFirestore;
  const nowIso = new Date().toISOString();

  beforeEach(async () => {
    db = new MockFirestore();

    // Seed test order (Delivered 2 days ago = Within 7-day policy)
    const deliveredAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await db.collection("orders").doc("ORD_TEST_100").set({
      id: "ORD_TEST_100",
      order_id: "ORD_TEST_100",
      customer_profile_id: "prof_cust_100",
      customer_email: "cust100@example.com",
      customer_phone: "+919876543210",
      status: "delivered",
      fulfillment_status: "delivered",
      delivered_at: deliveredAt,
      items: [
        {
          product_id: "prod_linen_shirt",
          name: "Linen Shirt",
          size: "M",
          color: "Beige",
          quantity: 1,
          price_paid: 2999
        }
      ],
      payment_method: "razorpay",
      amount_paid: 2999,
      cash_paid: 2999,
      store_credit_used: 0
    });

    await db.collection("orders").doc("ORD_TEST_101").set({
      id: "ORD_TEST_101",
      order_id: "ORD_TEST_101",
      customer_profile_id: "prof_cust_100",
      customer_email: "cust100@example.com",
      customer_phone: "+919876543210",
      status: "delivered",
      fulfillment_status: "delivered",
      delivered_at: deliveredAt,
      items: [
        {
          product_id: "prod_linen_shirt",
          name: "Linen Shirt",
          size: "M",
          color: "Beige",
          quantity: 1,
          price_paid: 2999
        }
      ],
      payment_method: "razorpay",
      amount_paid: 2999,
      cash_paid: 2999,
      store_credit_used: 0
    });

    // Seed counter for RMA generation
    await db.collection("system_counters").doc("rma_counter").set({ last_number: 100000 });
  });

  describe("1. Unified Creation Path & Canonical Schema", () => {
    it("creates authenticated customer return request with canonical RMA numbering", async () => {
      const payload: CreateReturnRequestPayload = {
        order_id: "ORD_TEST_100",
        items: [
          {
            product_id: "prod_linen_shirt",
            name: "Linen Shirt",
            size: "M",
            original_size: "M",
            color: "Beige",
            quantity: 1,
            price_paid: 2999,
            action: "return",
            reason: "Fit Issue",
            reason_notes: "Slightly tight around shoulders"
          }
        ],
        reason: "Fit Issue",
        resolution: "refund_source"
      };

      const result = await createCustomerReturnRequest(
        db,
        "prof_cust_100",
        { full_name: "Customer 100", email: "cust100@example.com", phone: "+919876543210" },
        payload
      );

      expect(result.success).toBe(true);
      expect(result.return_request).toBeDefined();
      expect(result.return_request.rma_number).toBe("SS-RMA-100001");
      expect(result.return_request.status).toBe("requested");
      expect(result.return_request.return_shipping_fee).toBe(100);
      expect(result.return_request.estimated_refund_total).toBe(2899);
      expect(Array.isArray(result.return_request.timeline)).toBe(true);
    });

    it("creates guest return request producing identical canonical schema", async () => {
      const payload: CreateReturnRequestPayload = {
        order_id: "ORD_TEST_100",
        items: [
          {
            product_id: "prod_linen_shirt",
            name: "Linen Shirt",
            size: "M",
            original_size: "M",
            color: "Beige",
            quantity: 1,
            price_paid: 2999,
            action: "return",
            reason: "Quality Issue",
            reason_notes: "Fabric texture defect"
          }
        ],
        reason: "Quality Issue",
        resolution: "refund_source"
      };

      const guestProfileId = "guest_9876543210";
      const result = await createCustomerReturnRequest(
        db,
        guestProfileId,
        { full_name: "Guest User", email: "cust100@example.com", phone: "+919876543210" },
        payload
      );

      expect(result.success).toBe(true);
      expect(result.return_request.rma_number).toBe("SS-RMA-100001");
      expect(result.return_request.status).toBe("requested");
      expect(result.return_request.customer_phone).toBe("+919876543210");
    });

    it("prevents duplicate return submission for the same product and size", async () => {
      const payload: CreateReturnRequestPayload = {
        order_id: "ORD_TEST_100",
        items: [
          {
            product_id: "prod_linen_shirt",
            name: "Linen Shirt",
            size: "M",
            original_size: "M",
            color: "Beige",
            quantity: 1,
            price_paid: 2999,
            action: "return",
            reason: "Fit Issue"
          }
        ]
      };

      // First submission succeeds
      const res1 = await createCustomerReturnRequest(
        db,
        "prof_cust_100",
        { full_name: "Customer 100", email: "cust100@example.com" },
        payload
      );
      expect(res1.success).toBe(true);

      // Second submission for same item fails
      const res2 = await createCustomerReturnRequest(
        db,
        "prof_cust_100",
        { full_name: "Customer 100", email: "cust100@example.com" },
        payload
      );
      expect(res2.success).toBe(false);
      expect(res2.error).toContain("already active");
    });

    it("strictly rejects return creation after 7-day eligibility window expires", async () => {
      // Delivered 10 days ago
      const oldDelivery = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      await db.collection("orders").doc("ORD_OLD_500").set({
        id: "ORD_OLD_500",
        order_id: "ORD_OLD_500",
        customer_profile_id: "prof_cust_100",
        customer_email: "cust100@example.com",
        status: "delivered",
        fulfillment_status: "delivered",
        delivered_at: oldDelivery,
        items: [
          { product_id: "prod_pants", name: "Pants", size: "32", quantity: 1, price_paid: 1999 }
        ]
      });

      const payload: CreateReturnRequestPayload = {
        order_id: "ORD_OLD_500",
        items: [
          { product_id: "prod_pants", name: "Pants", size: "32", original_size: "32", quantity: 1, price_paid: 1999, action: "return" }
        ]
      };

      const result = await createCustomerReturnRequest(
        db,
        "prof_cust_100",
        { full_name: "Customer 100", email: "cust100@example.com" },
        payload
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("7-day window expired");
    });
  });

  describe("2. Isolated Provider Refund Contract & Safety Boundary", () => {
    it("executes provider refund via hardened Razorpay refund integration", async () => {
      await db.collection("orders").doc("ORD_TEST_100").set({
        order_id: "ORD_TEST_100",
        payment_id: "pay_test_100",
        payment_status: "captured",
        payment_method: "razorpay",
        grand_total: 2899,
        refunds: []
      });

      const contractRes = await executeProviderRefundServiceContract(db, {
        rmaNumber: "SS-RMA-100001",
        orderId: "ORD_TEST_100",
        amountRupees: 2899,
        adminEmail: "admin@saandsha.com",
        paymentMethod: "razorpay"
      });

      expect(contractRes.success).toBe(true);
      expect(contractRes.gateway).toBe("razorpay");
      expect(contractRes.is_simulated).toBe(false);
    });
  });

  describe("3. Admin Portal Consistency & Pickup Endpoints", () => {
    it("retrieves list and stats cleanly for consolidated return records", async () => {
      // Create a return
      await createCustomerReturnRequest(
        db,
        "prof_cust_100",
        { full_name: "Customer 100", email: "cust100@example.com", phone: "+919876543210" },
        {
          order_id: "ORD_TEST_100",
          items: [{ product_id: "prod_linen_shirt", name: "Linen Shirt", size: "M", original_size: "M", quantity: 1, price_paid: 2999, action: "return" }]
        }
      );

      const listRes = await getAdminReturnsList(db, {});
      expect(listRes.success).toBe(true);
      expect(listRes.items.length).toBe(1);
      expect(listRes.items[0].rma_number).toBe("SS-RMA-100001");

      const statsRes = await getAdminReturnStats(db);
      expect(statsRes.success).toBe(true);
      expect(statsRes.pendingCount).toBe(1);
    }, 15000);

    it("executes return pickup scheduling and updates status to pickup_scheduled", async () => {
      // Seed return
      const retDoc = await createCustomerReturnRequest(
        db,
        "prof_cust_100",
        { full_name: "Customer 100", email: "cust100@example.com", phone: "+919876543210" },
        {
          order_id: "ORD_TEST_101",
          items: [{ product_id: "prod_linen_shirt", name: "Linen Shirt", size: "M", original_size: "M", quantity: 1, price_paid: 2999, action: "return" }]
        }
      );
      const rmaNum = retDoc.return_request.rma_number;

      // Approve return first
      const approveRes = await approveReturnRequest(db, "admin@saandsha.com", rmaNum, { approved_items: retDoc.return_request.items });

      // Schedule pickup
      const pickupRes = await scheduleReturnPickup(db, "admin@saandsha.com", rmaNum, {
        courier: "Delhivery",
        awb_number: "DEL123456789",
        pickup_date: "2026-08-12"
      });

      expect(pickupRes.success).toBe(true);
      expect(pickupRes.status).toBe("pickup_scheduled");
    }, 15000);
  });
});
