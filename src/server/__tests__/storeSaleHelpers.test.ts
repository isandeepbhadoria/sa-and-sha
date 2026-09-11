import { describe, it, expect } from "vitest";
import { createStoreSale, listStoreSales } from "../storeSaleHelpers";

function createMockAdminDb(products: Record<string, any>, storeSales: Record<string, any> = {}) {
  const productsMap = new Map<string, any>(Object.entries(products));
  const storeSalesMap = new Map<string, any>(Object.entries(storeSales));

  const db: any = {
    collection: (name: string) => {
      if (name === "products") {
        return {
          doc: (id: string) => ({
            path: `products/${id}`,
            get: async () => ({ exists: productsMap.has(id), data: () => productsMap.get(id) }),
            update: async (fields: any) => {
              productsMap.set(id, { ...(productsMap.get(id) || {}), ...fields });
            }
          })
        };
      }
      if (name === "store_sales") {
        return {
          doc: (id: string) => ({
            path: `store_sales/${id}`,
            get: async () => ({ exists: storeSalesMap.has(id), data: () => storeSalesMap.get(id) }),
            set: async (data: any) => { storeSalesMap.set(id, data); }
          }),
          where: (field: string, _op: string, value: any) => ({
            orderBy: () => ({
              limit: () => ({
                get: async () => {
                  const docs = Array.from(storeSalesMap.entries())
                    .filter(([, v]) => {
                      // supports the single-level path used here: 'recorded_by.uid'
                      const parts = field.split(".");
                      let cur = v;
                      for (const p of parts) cur = cur?.[p];
                      return cur === value;
                    })
                    .map(([id, v]) => ({ data: () => v, id }));
                  return { docs };
                }
              })
            })
          }),
          orderBy: () => ({
            limit: () => ({
              get: async () => {
                const docs = Array.from(storeSalesMap.entries()).map(([id, v]) => ({ data: () => v, id }));
                return { docs };
              }
            })
          })
        };
      }
      throw new Error(`Unexpected collection in test mock: ${name}`);
    },
    runTransaction: async (fn: any) => {
      const transaction = {
        get: async (ref: any) => {
          const parts = ref.path.split("/");
          const [collName, docId] = parts;
          if (collName === "products") {
            return { exists: productsMap.has(docId), data: () => productsMap.get(docId) };
          }
          return { exists: false, data: () => null };
        },
        update: (ref: any, data: any) => {
          const parts = ref.path.split("/");
          const [collName, docId] = parts;
          if (collName === "products") {
            const curr = { ...(productsMap.get(docId) || {}) };
            // Mirror real Firestore dot-path field update semantics (e.g. "stock.M").
            for (const [key, value] of Object.entries(data)) {
              if (key.includes(".")) {
                const segments = key.split(".");
                let node: any = curr;
                for (let i = 0; i < segments.length - 1; i++) {
                  if (typeof node[segments[i]] !== "object" || node[segments[i]] === null) {
                    node[segments[i]] = {};
                  } else {
                    node[segments[i]] = { ...node[segments[i]] };
                  }
                  node = node[segments[i]];
                }
                node[segments[segments.length - 1]] = value;
              } else {
                curr[key] = value;
              }
            }
            productsMap.set(docId, curr);
          }
        },
        set: (ref: any, data: any) => {
          const parts = ref.path.split("/");
          const [collName, docId] = parts;
          if (collName === "store_sales") {
            storeSalesMap.set(docId, data);
          }
        }
      };
      return await fn(transaction);
    },
    _productsMap: productsMap,
    _storeSalesMap: storeSalesMap
  };

  return db;
}

const RECORDED_BY = { uid: "staff_1", name: "Priya", email: "priya@sa-and-sha.com", role: "store_staff" as const };

describe("createStoreSale", () => {
  it("creates a sale, computes totals from the live catalog price, and decrements stock", async () => {
    const db = createMockAdminDb({
      p1: { name: "Block Print Maxi Dress", price: 1999, sizes: ["S", "M"], stock: { S: 5, M: 2 } }
    });

    const sale = await createStoreSale(db, {
      items: [{ product_id: "p1", size: "M", quantity: 2 }],
      payment_method: "cash",
      recordedBy: RECORDED_BY
    });

    expect(sale.grand_total).toBe(3998);
    expect(sale.items[0].name).toBe("Block Print Maxi Dress");
    expect(sale.channel).toBe("store");
    expect(db._productsMap.get("p1").stock).toEqual({ S: 5, M: 0 });
    expect(db._storeSalesMap.get(sale.order_id)).toBeDefined();
  });

  it("rejects a sale that exceeds available tracked stock", async () => {
    const db = createMockAdminDb({
      p1: { name: "Dress", price: 999, sizes: ["S"], stock: { S: 1 } }
    });

    await expect(
      createStoreSale(db, {
        items: [{ product_id: "p1", size: "S", quantity: 5 }],
        payment_method: "cash",
        recordedBy: RECORDED_BY
      })
    ).rejects.toThrow(/only 1 left/);

    // Stock must be untouched after a rejected sale.
    expect(db._productsMap.get("p1").stock).toEqual({ S: 1 });
  });

  it("never lets a staff-supplied price override exceed the listed price", async () => {
    const db = createMockAdminDb({
      p1: { name: "Dress", price: 1000, sizes: [], stock: {} }
    });

    const sale = await createStoreSale(db, {
      items: [{ product_id: "p1", size: "Free Size", quantity: 1, unit_price: 5000 }],
      payment_method: "upi",
      recordedBy: RECORDED_BY
    });

    expect(sale.items[0].price).toBe(1000);
  });

  it("allows a staff-supplied discount below the listed price", async () => {
    const db = createMockAdminDb({
      p1: { name: "Dress", price: 1000, sizes: [], stock: {} }
    });

    const sale = await createStoreSale(db, {
      items: [{ product_id: "p1", size: "Free Size", quantity: 1, unit_price: 800 }],
      payment_method: "card",
      recordedBy: RECORDED_BY
    });

    expect(sale.items[0].price).toBe(800);
    expect(sale.grand_total).toBe(800);
  });

  it("rejects an unknown product", async () => {
    const db = createMockAdminDb({});
    await expect(
      createStoreSale(db, { items: [{ product_id: "ghost", quantity: 1 }], payment_method: "cash", recordedBy: RECORDED_BY })
    ).rejects.toThrow(/not found/);
  });

  it("rejects an invalid payment method", async () => {
    const db = createMockAdminDb({ p1: { name: "Dress", price: 100, sizes: [], stock: {} } });
    await expect(
      createStoreSale(db, { items: [{ product_id: "p1", quantity: 1 }], payment_method: "bitcoin", recordedBy: RECORDED_BY })
    ).rejects.toThrow(/Invalid payment method/);
  });

  it("rejects an invalid size for the product", async () => {
    const db = createMockAdminDb({ p1: { name: "Dress", price: 100, sizes: ["S", "M"], stock: {} } });
    await expect(
      createStoreSale(db, { items: [{ product_id: "p1", size: "XXL", quantity: 1 }], payment_method: "cash", recordedBy: RECORDED_BY })
    ).rejects.toThrow(/not valid/);
  });

  it("leaves untracked products (no stock map) unaffected", async () => {
    const db = createMockAdminDb({ p1: { name: "Legacy Item", price: 500, sizes: [] } });
    const sale = await createStoreSale(db, {
      items: [{ product_id: "p1", quantity: 3 }],
      payment_method: "cash",
      recordedBy: RECORDED_BY
    });
    expect(sale.grand_total).toBe(1500);
    expect(db._productsMap.get("p1").stock).toBeUndefined();
  });
});

describe("listStoreSales", () => {
  it("scopes results to a given staff uid", async () => {
    const db = createMockAdminDb({}, {
      s1: { order_id: "s1", recorded_by: { uid: "staff_1" }, created_at: "2026-01-01T00:00:00Z" },
      s2: { order_id: "s2", recorded_by: { uid: "staff_2" }, created_at: "2026-01-02T00:00:00Z" }
    });

    const results = await listStoreSales(db, { staffUid: "staff_1" });
    expect(results).toHaveLength(1);
    expect(results[0].order_id).toBe("s1");
  });

  it("returns all sales when no staffUid is given", async () => {
    const db = createMockAdminDb({}, {
      s1: { order_id: "s1", recorded_by: { uid: "staff_1" }, created_at: "2026-01-01T00:00:00Z" },
      s2: { order_id: "s2", recorded_by: { uid: "staff_2" }, created_at: "2026-01-02T00:00:00Z" }
    });

    const results = await listStoreSales(db);
    expect(results).toHaveLength(2);
  });
});
