import { describe, it, expect, beforeEach } from "vitest";
import { processOrderPointsEarning, releasePendingPointsBatch } from "../loyaltyHelpers";

function createMockAdminDb() {
  const store: Record<string, Record<string, any>> = {
    customer_profiles: {
      prof_123: {
        customer_id: "KL-C10001",
        loyalty_summary: { current_tier: "MEMBER" }
      }
    },
    orders: {},
    return_requests: {},
    loyalty_ledger: {}
  };

  function docObj(colName: string, docId: string) {
    const path = `${colName}/${docId}`;
    return {
      id: docId,
      path,
      ref: { path, id: docId },
      data: () => store[colName]?.[docId],
      async get() {
        const data = store[colName]?.[docId];
        return {
          exists: Boolean(data),
          id: docId,
          ref: { path, id: docId },
          data: () => data
        };
      },
      async set(data: any, opts?: any) {
        if (!store[colName]) store[colName] = {};
        if (opts?.merge && store[colName][docId]) {
          store[colName][docId] = { ...store[colName][docId], ...data };
        } else {
          store[colName][docId] = data;
        }
      },
      collection(subColName: string) {
        return {
          doc(subDocId: string) {
            return docObj(subColName, subDocId);
          },
          where(field: string, op: string, val: any) {
            return {
              async get() {
                const docs = Object.entries(store[subColName] || {})
                  .filter(([_, d]) => d[field] === val)
                  .map(([id]) => docObj(subColName, id));
                return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
              }
            };
          },
          async get() {
            const docs = Object.entries(store[subColName] || {})
              .map(([id]) => docObj(subColName, id));
            return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
          }
        };
      }
    };
  }

  return {
    store,
    collection(colName: string) {
      return {
        doc(docId: string) {
          return docObj(colName, docId);
        },
        where(field: string, op: string, val: any) {
          return {
            where(f2: string, op2: string, val2: any) {
              return {
                async get() {
                  const docs = Object.entries(store[colName] || {})
                    .filter(([_, d]) => d[field] === val && d[f2] === val2)
                    .map(([id]) => docObj(colName, id));
                  return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
                }
              };
            },
            limit() {
              return {
                async get() {
                  const docs = Object.entries(store[colName] || {})
                    .filter(([_, d]) => d[field] === val)
                    .map(([id]) => docObj(colName, id));
                  return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
                }
              };
            },
            async get() {
              const docs = Object.entries(store[colName] || {})
                .filter(([_, d]) => d[field] === val)
                .map(([id]) => docObj(colName, id));
              return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
            }
          };
        },
        async add(data: any) {
          if (!store[colName]) store[colName] = {};
          const id = `doc_${Math.random().toString(36).substring(2, 9)}`;
          store[colName][id] = { id, ...data };
          return { id };
        }
      };
    },
    collectionGroup(colName: string) {
      return {
        where(field: string, op: string, val: any) {
          return {
            orderBy(field2: string, dir: string) {
              return {
                limit(l: number) {
                  return {
                    async get() {
                      const docs = Object.entries(store[colName] || {})
                        .filter(([_, d]) => d[field] === val)
                        .map(([id]) => docObj(colName, id));
                      return { empty: docs.length === 0, docs, forEach: (cb: any) => docs.forEach(cb) };
                    }
                  };
                }
              };
            }
          };
        }
      };
    },
    async runTransaction(cb: any) {
      const tx = {
        async get(ref: any) {
          if (ref && typeof ref.get === "function") return ref.get();
          return { exists: false, data: () => null };
        },
        set(ref: any, data: any, opts?: any) {
          const path = ref?.path || ref?.ref?.path || "";
          const parts = path.split("/");
          if (parts[0] && parts[1]) {
            if (!store[parts[0]]) store[parts[0]] = {};
            if (opts?.merge && store[parts[0]][parts[1]]) {
              store[parts[0]][parts[1]] = { ...store[parts[0]][parts[1]], ...data };
            } else {
              store[parts[0]][parts[1]] = data;
            }
          }
        },
        update(ref: any, data: any) {
          const path = ref?.path || ref?.ref?.path || "";
          const parts = path.split("/");
          if (parts[0] && parts[1] && store[parts[0]]?.[parts[1]]) {
            store[parts[0]][parts[1]] = { ...store[parts[0]][parts[1]], ...data };
          }
        }
      };
      return cb(tx);
    }
  };
}

describe("Kora Rewards — Delivery + 7-Day Return Window Lifecycle", () => {
  let mockAdminDb: any;

  beforeEach(() => {
    mockAdminDb = createMockAdminDb();
  });

  it("1. Points stay PENDING on order delivery and available_at is set to delivery + 7 days", async () => {
    const deliveryTime = new Date("2026-08-10T10:00:00.000Z").getTime();
    const order = {
      id: "ord_101",
      order_id: "KL100101",
      status: "delivered",
      delivered_at: new Date(deliveryTime).toISOString(),
      grand_total: 5000,
      subtotal: 5000,
      discount: 0
    };

    const res = await processOrderPointsEarning(mockAdminDb, order, "prof_123");
    expect(res.pointsEarned).toBe(50); // 5000 / 100
    expect(res.status).toBe("pending");

    const entries = Object.values(mockAdminDb.store.loyalty_ledger);
    expect(entries.length).toBe(1);
    const entry: any = entries[0];
    expect(entry.status).toBe("pending");
    expect(entry.entry_type).toBe("earn_pending");

    // available_at should be exactly 7 days after delivery timestamp
    const expectedAvailableAt = new Date(deliveryTime + 7 * 24 * 3600 * 1000).toISOString();
    expect(new Date(entry.available_at).getTime()).toBe(new Date(expectedAvailableAt).getTime());
  });

  it("2. Points transition to AVAILABLE when 7-day return window elapses without return request", async () => {
    const deliveryTime = new Date("2026-08-01T10:00:00.000Z").getTime();
    const availableAt = new Date(deliveryTime + 7 * 24 * 3600 * 1000).toISOString();

    mockAdminDb.store.loyalty_ledger["entry_1"] = {
      id: "entry_1",
      customer_profile_id: "prof_123",
      points: 50,
      status: "pending",
      entry_type: "earn_pending",
      related_order_id: "KL100102",
      available_at: availableAt
    };

    mockAdminDb.store.orders["KL100102"] = {
      order_id: "KL100102",
      status: "delivered"
    };

    const batchRes = await releasePendingPointsBatch(mockAdminDb);
    expect(batchRes.released).toBe(1);

    const updatedEntry = mockAdminDb.store.loyalty_ledger["entry_1"];
    expect(updatedEntry.status).toBe("available");
    expect(updatedEntry.entry_type).toBe("earn_available");
  });

  it("3. Points stay PENDING if an active return or exchange request exists for the order", async () => {
    const deliveryTime = new Date("2026-08-01T10:00:00.000Z").getTime();
    const availableAt = new Date(deliveryTime + 7 * 24 * 3600 * 1000).toISOString();

    mockAdminDb.store.loyalty_ledger["entry_2"] = {
      id: "entry_2",
      customer_profile_id: "prof_123",
      points: 50,
      status: "pending",
      entry_type: "earn_pending",
      related_order_id: "KL100103",
      available_at: availableAt
    };

    mockAdminDb.store.orders["KL100103"] = {
      order_id: "KL100103",
      status: "delivered"
    };

    // Active return request
    mockAdminDb.store.return_requests["rma_1"] = {
      order_id: "KL100103",
      status: "under_review"
    };

    const batchRes = await releasePendingPointsBatch(mockAdminDb);
    expect(batchRes.released).toBe(0);

    const entry = mockAdminDb.store.loyalty_ledger["entry_2"];
    expect(entry.status).toBe("pending");
  });
});
