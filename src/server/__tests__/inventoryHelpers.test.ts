import { describe, it, expect } from "vitest";
import { readStockForItems, restoreInventoryForOrderItems } from "../inventoryHelpers";

function createMockAdminDb(products: Record<string, any>) {
  const productsMap = new Map<string, any>(Object.entries(products));

  return {
    collection: (collName: string) => {
      if (collName !== "products") {
        throw new Error(`Unexpected collection in test mock: ${collName}`);
      }
      return {
        doc: (docId: string) => ({
          path: `products/${docId}`,
          get: async () => ({
            exists: productsMap.has(docId),
            data: () => productsMap.get(docId)
          }),
          update: async (fields: any) => {
            const curr = productsMap.get(docId) || {};
            productsMap.set(docId, { ...curr, ...fields });
          }
        })
      };
    },
    _productsMap: productsMap
  };
}

function createMockTransaction(adminDb: ReturnType<typeof createMockAdminDb>) {
  return {
    get: async (ref: any) => {
      const parts = ref.path.split("/");
      const docId = parts[parts.length - 1];
      return {
        exists: adminDb._productsMap.has(docId),
        data: () => adminDb._productsMap.get(docId)
      };
    }
  } as any;
}

describe("readStockForItems", () => {
  it("reports correct availability for a tracked product/size", async () => {
    const adminDb = createMockAdminDb({
      p1: { name: "Block Print Maxi Dress", stock: { S: 5, M: 2, L: 0 } }
    });
    const transaction = createMockTransaction(adminDb);

    const results = await readStockForItems(transaction, adminDb as any, [
      { product_id: "p1", size: "M", quantity: 1, name: "Block Print Maxi Dress" }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].tracked).toBe(true);
    expect(results[0].currentAvailable).toBe(2);
  });

  it("treats a product with no stock map at all as untracked (never blocks legacy products)", async () => {
    const adminDb = createMockAdminDb({
      p1: { name: "Legacy Product" } // no `stock` field
    });
    const transaction = createMockTransaction(adminDb);

    const results = await readStockForItems(transaction, adminDb as any, [
      { product_id: "p1", size: "M", quantity: 5, name: "Legacy Product" }
    ]);

    expect(results[0].tracked).toBe(false);
    expect(results[0].currentAvailable).toBeNull();
  });

  it("treats a size that was never explicitly given a stock entry as untracked, not 0", async () => {
    // The admin form always saves `stock` as an object even when a size checkbox
    // was never checked - an absent key means "never configured," not "zero."
    const adminDb = createMockAdminDb({
      p1: { name: "Dress", stock: { S: 5 } } // no "XL" key
    });
    const transaction = createMockTransaction(adminDb);

    const results = await readStockForItems(transaction, adminDb as any, [
      { product_id: "p1", size: "XL", quantity: 1, name: "Dress" }
    ]);

    expect(results[0].tracked).toBe(false);
    expect(results[0].currentAvailable).toBeNull();
  });

  it("treats a size explicitly set to 0 as tracked and unavailable", async () => {
    const adminDb = createMockAdminDb({
      p1: { name: "Dress", stock: { S: 5, L: 0 } }
    });
    const transaction = createMockTransaction(adminDb);

    const results = await readStockForItems(transaction, adminDb as any, [
      { product_id: "p1", size: "L", quantity: 1, name: "Dress" }
    ]);

    expect(results[0].tracked).toBe(true);
    expect(results[0].currentAvailable).toBe(0);
  });

  it("treats a no-size product (bags/accessories) with an empty stock map as untracked", async () => {
    // The admin form's size checkboxes are apparel-only (S/M/L/XL/XXL/3XL) - a
    // no-size product like a bag saves `stock: {}` since no checkbox applies,
    // and checkout defaults its pseudo-size to 'Free Size'.
    const adminDb = createMockAdminDb({
      p1: { name: "Tote Bag", stock: {} }
    });
    const transaction = createMockTransaction(adminDb);

    const results = await readStockForItems(transaction, adminDb as any, [
      { product_id: "p1", size: "Free Size", quantity: 1, name: "Tote Bag" }
    ]);

    expect(results[0].tracked).toBe(false);
    expect(results[0].currentAvailable).toBeNull();
  });

  it("aggregates duplicate (product, size) cart lines into a single quantity", async () => {
    const adminDb = createMockAdminDb({
      p1: { name: "Dress", stock: { S: 10 } }
    });
    const transaction = createMockTransaction(adminDb);

    const results = await readStockForItems(transaction, adminDb as any, [
      { product_id: "p1", size: "S", quantity: 2, name: "Dress" },
      { product_id: "p1", size: "S", quantity: 3, name: "Dress" }
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].qty).toBe(5);
  });

  it("does not treat a corrupted (non-object) stock field as tracked", async () => {
    // Simulates the legacy bug where `stock` was written as a bare NaN/number.
    const adminDb = createMockAdminDb({
      p1: { name: "Dress", stock: NaN }
    });
    const transaction = createMockTransaction(adminDb);

    const results = await readStockForItems(transaction, adminDb as any, [
      { product_id: "p1", size: "S", quantity: 1, name: "Dress" }
    ]);

    expect(results[0].tracked).toBe(false);
  });
});

describe("restoreInventoryForOrderItems", () => {
  it("increments the correct size's stock on a well-formed stock map", async () => {
    const adminDb = createMockAdminDb({
      p1: { name: "Dress", stock: { S: 3, M: 1 } }
    });

    await restoreInventoryForOrderItems(
      adminDb as any,
      [{ product_id: "p1", size: "M", quantity: 2 }],
      "2026-01-01T00:00:00.000Z"
    );

    expect(adminDb._productsMap.get("p1").stock).toEqual({ S: 3, M: 3 });
  });

  it("self-heals a corrupted (non-map) stock field instead of propagating NaN", async () => {
    // Reproduces the pre-fix bug: stock had been written as a bare number.
    const adminDb = createMockAdminDb({
      p1: { name: "Dress", stock: NaN }
    });

    await restoreInventoryForOrderItems(
      adminDb as any,
      [{ product_id: "p1", size: "M", quantity: 2 }],
      "2026-01-01T00:00:00.000Z"
    );

    const updated = adminDb._productsMap.get("p1").stock;
    expect(Number.isNaN(updated)).toBe(false);
    expect(updated).toEqual({ M: 2 });
  });

  it("initializes stock as a map when the product has no stock field yet", async () => {
    const adminDb = createMockAdminDb({
      p1: { name: "Dress" }
    });

    await restoreInventoryForOrderItems(
      adminDb as any,
      [{ product_id: "p1", size: "L", quantity: 1 }],
      "2026-01-01T00:00:00.000Z"
    );

    expect(adminDb._productsMap.get("p1").stock).toEqual({ L: 1 });
  });

  it("skips items with no product_id without throwing", async () => {
    const adminDb = createMockAdminDb({});
    await expect(
      restoreInventoryForOrderItems(adminDb as any, [{ size: "S", quantity: 1 }], "2026-01-01T00:00:00.000Z")
    ).resolves.not.toThrow();
  });
});
