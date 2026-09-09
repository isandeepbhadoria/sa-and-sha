import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createOrUpdateIdentityConflict,
  listIdentityConflicts,
  getIdentityConflictDetails,
  generateMergePreview,
  executeProfileMergeTransaction,
  recordIdentityAudit
} from "../identityManagementHelpers";

// Mock Firestore Implementation
function createMockFirestore() {
  const collections: Record<string, Map<string, any>> = {
    customer_identity_conflicts: new Map(),
    customer_identity_audit: new Map(),
    customer_profiles: new Map(),
    customer_orders: new Map(),
    customer_auth_identities: new Map()
  };

  return {
    collections,
    collection(name: string) {
      if (!collections[name]) collections[name] = new Map();
      const store = collections[name];

      return {
        doc(id?: string) {
          const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          return {
            id: docId,
            async get() {
              const data = store.get(docId);
              return {
                id: docId,
                exists: data !== undefined,
                data: () => data
              };
            },
            async set(data: any, options?: any) {
              if (options?.merge && store.has(docId)) {
                store.set(docId, { ...store.get(docId), ...data });
              } else {
                store.set(docId, data);
              }
            },
            async update(data: any) {
              const existing = store.get(docId) || {};
              store.set(docId, { ...existing, ...data });
            }
          };
        },

        where(field: string, op: string, val: any) {
          const self = this;
          return {
            where(f2: string, op2: string, val2: any) {
              return self.where(f2, op2, val2);
            },
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            startAfter() {
              return this;
            },
            async get() {
              const docs: any[] = [];
              for (const [id, data] of store.entries()) {
                if (op === "==" && data[field] === val) {
                  docs.push({
                    id,
                    data: () => data,
                    ref: self.doc(id)
                  });
                } else if (op === "in" && Array.isArray(val) && val.includes(data[field])) {
                  docs.push({
                    id,
                    data: () => data,
                    ref: self.doc(id)
                  });
                }
              }
              return {
                empty: docs.length === 0,
                size: docs.length,
                docs
              };
            }
          };
        },

        orderBy() {
          return this;
        },
        limit() {
          return this;
        },
        startAfter() {
          return this;
        },
        async get() {
          const docs = Array.from(store.entries()).map(([id, data]) => ({
            id,
            data: () => data,
            ref: this.doc(id)
          }));
          return {
            empty: docs.length === 0,
            size: docs.length,
            docs
          };
        }
      };
    },

    async runTransaction(updateFunction: (transaction: any) => Promise<any>) {
      const transaction = {
        async get(docRef: any) {
          return docRef.get();
        },
        update(docRef: any, data: any) {
          docRef.update(data);
        },
        set(docRef: any, data: any) {
          docRef.set(data);
        }
      };
      return await updateFunction(transaction);
    }
  };
}

describe("Phase 9C.2 — Admin Identity Management Unit Tests", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockFirestore();
  });

  it("1. Should idempotently create identity conflict record without duplicating", async () => {
    const res1 = await createOrUpdateIdentityConflict(mockDb, {
      provider: "google",
      provider_uid_hash: "hash_test_123",
      verified_email: "conflict.user@example.com",
      matched_profile_ids: ["prof_1", "prof_2"],
      matched_customer_ids: ["KORA-1001", "KORA-1002"],
      reason: "MULTIPLE_EMAIL_MATCHES"
    });

    expect(res1.created).toBe(true);
    expect(res1.conflictId).toBeDefined();

    const res2 = await createOrUpdateIdentityConflict(mockDb, {
      provider: "google",
      provider_uid_hash: "hash_test_123",
      verified_email: "conflict.user@example.com",
      matched_profile_ids: ["prof_1", "prof_2", "prof_3"],
      matched_customer_ids: ["KORA-1001", "KORA-1002", "KORA-1003"],
      reason: "MULTIPLE_EMAIL_MATCHES"
    });

    expect(res2.created).toBe(false);
    expect(res2.conflictId).toBe(res1.conflictId);

    const snap = await mockDb.collection("customer_identity_conflicts").doc(res1.conflictId).get();
    const data = snap.data();
    expect(data.matched_profile_ids).toEqual(["prof_1", "prof_2", "prof_3"]);
  });

  it("2. Should detect VERIFIED_PHONE_CONFLICT and block merge when phone numbers differ", async () => {
    // Seed Conflict
    const conflictId = "cnf_phone_test";
    await mockDb.collection("customer_identity_conflicts").doc(conflictId).set({
      conflict_id: conflictId,
      provider: "google",
      provider_uid_hash: "hash_phone",
      verified_email: "phone.conflict@example.com",
      matched_profile_ids: ["prof_a", "prof_b"],
      matched_customer_ids: ["KORA-2001", "KORA-2002"],
      status: "under_review",
      created_at: new Date().toISOString()
    });

    // Seed Profile A (Canonical candidate)
    await mockDb.collection("customer_profiles").doc("prof_a").set({
      customer_id: "KORA-2001",
      full_name: "Rahul Sharma",
      email: "phone.conflict@example.com",
      phone: "+919876543210",
      normalized_phone: "+919876543210",
      created_at: "2026-01-01T00:00:00Z",
      loyalty_points: 100
    });

    // Seed Profile B (Has DIFFERENT phone)
    await mockDb.collection("customer_profiles").doc("prof_b").set({
      customer_id: "KORA-2002",
      full_name: "Rahul S",
      email: "phone.conflict@example.com",
      phone: "+919123456789",
      normalized_phone: "+919123456789",
      created_at: "2026-02-01T00:00:00Z",
      loyalty_points: 50
    });

    const preview = await generateMergePreview(mockDb, conflictId, "prof_a");
    expect(preview.can_merge).toBe(false);
    expect(preview.blocking_reasons[0]).toContain("VERIFIED_PHONE_CONFLICT");

    // Attempting to execute merge should throw VERIFIED_PHONE_CONFLICT error
    await expect(
      executeProfileMergeTransaction(mockDb, {
        conflictId,
        canonicalProfileId: "prof_a",
        confirmationText: "MERGE CUSTOMER PROFILES",
        adminEmail: "admin@sa-and-sha.com",
        reason: "Test merge"
      })
    ).rejects.toThrow("VERIFIED_PHONE_CONFLICT");
  });

  it("3. Should successfully execute profile merge when phone numbers match or are empty", async () => {
    const conflictId = "cnf_valid_merge";
    await mockDb.collection("customer_identity_conflicts").doc(conflictId).set({
      conflict_id: conflictId,
      provider: "google",
      provider_uid_hash: "hash_valid",
      verified_email: "valid.merge@example.com",
      matched_profile_ids: ["prof_c1", "prof_c2"],
      matched_customer_ids: ["KORA-3001", "KORA-3002"],
      status: "under_review",
      created_at: new Date().toISOString()
    });

    await mockDb.collection("customer_profiles").doc("prof_c1").set({
      customer_id: "KORA-3001",
      full_name: "Priya Patel",
      email: "valid.merge@example.com",
      phone: "+919988776655",
      normalized_phone: "+919988776655",
      created_at: "2026-01-01T00:00:00Z",
      loyalty_points: 120,
      addresses: [{ id: "addr_1", pincode: "380001", address_line1: "Drive In Road" }],
      commerce_summary: { total_orders: 2, lifetime_spend: 4500 }
    });

    await mockDb.collection("customer_profiles").doc("prof_c2").set({
      customer_id: "KORA-3002",
      full_name: "Priya P",
      email: "valid.merge@example.com",
      phone: "+919988776655",
      normalized_phone: "+919988776655",
      created_at: "2026-02-01T00:00:00Z",
      loyalty_points: 80,
      addresses: [{ id: "addr_2", pincode: "380001", address_line1: "Drive In Road" }],
      commerce_summary: { total_orders: 1, lifetime_spend: 2000 }
    });

    // Seed Order belonging to prof_c2
    await mockDb.collection("customer_orders").doc("ord_99").set({
      order_id: "ORD-99",
      customer_profile_id: "prof_c2",
      grand_total: 2000
    });

    const preview = await generateMergePreview(mockDb, conflictId, "prof_c1");
    expect(preview.can_merge).toBe(true);
    expect(preview.summary_totals.loyalty_points).toBe(200);

    const result = await executeProfileMergeTransaction(mockDb, {
      conflictId,
      canonicalProfileId: "prof_c1",
      confirmationText: "MERGE CUSTOMER PROFILES",
      adminEmail: "admin@sa-and-sha.com",
      reason: "Manual customer consolidation"
    });

    expect(result.success).toBe(true);

    // Verify Canonical Profile Updates
    const c1Snap = await mockDb.collection("customer_profiles").doc("prof_c1").get();
    const c1Data = c1Snap.data();
    expect(c1Data.loyalty_points).toBe(200);
    expect(c1Data.commerce_summary.total_orders).toBe(3);
    expect(c1Data.commerce_summary.lifetime_spend).toBe(6500);

    // Verify Duplicate Profile marked as merged (NOT deleted)
    const c2Snap = await mockDb.collection("customer_profiles").doc("prof_c2").get();
    const c2Data = c2Snap.data();
    expect(c2Data.status).toBe("merged");
    expect(c2Data.merged_into_profile_id).toBe("prof_c1");

    // Verify Order Relinked
    const orderSnap = await mockDb.collection("customer_orders").doc("ord_99").get();
    expect(orderSnap.data().customer_profile_id).toBe("prof_c1");

    // Verify Audit Record
    const auditSnap = await mockDb.collection("customer_identity_audit").doc(result.auditId).get();
    expect(auditSnap.exists).toBe(true);
    expect(auditSnap.data().action).toBe("merge_completed");
  });

  it("4. Should throw error if conflict status is stale during merge execution", async () => {
    const conflictId = "cnf_stale";
    await mockDb.collection("customer_identity_conflicts").doc(conflictId).set({
      conflict_id: conflictId,
      provider: "google",
      provider_uid_hash: "hash_stale",
      verified_email: "stale@example.com",
      matched_profile_ids: ["p_stale1", "p_stale2"],
      status: "resolved", // Already resolved!
      created_at: new Date().toISOString()
    });

    await expect(
      executeProfileMergeTransaction(mockDb, {
        conflictId,
        canonicalProfileId: "p_stale1",
        expectedStatus: "under_review",
        confirmationText: "MERGE CUSTOMER PROFILES",
        adminEmail: "admin@sa-and-sha.com",
        reason: "Stale merge"
      })
    ).rejects.toThrow();
  });
});
