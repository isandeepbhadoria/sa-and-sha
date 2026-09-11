export interface StockCheckResult {
  ref: FirebaseFirestore.DocumentReference;
  productId: string;
  size: string;
  qty: number;
  name: string;
  tracked: boolean;
  currentAvailable: number | null;
}

/**
 * Reads current per-size stock for a set of order line items inside an in-progress
 * transaction. Must be called before any transaction.set/update in the caller, since
 * Firestore requires all transaction reads to precede all transaction writes.
 * Aggregates duplicate (product, size) lines so a split cart line can't double-count.
 * A product with no `stock` map at all (never configured) is reported as untracked so
 * legacy/un-audited products aren't blocked from being ordered.
 */
export async function readStockForItems(
  transaction: FirebaseFirestore.Transaction,
  adminDb: FirebaseFirestore.Firestore,
  items: Array<{ product_id: string; size?: string; quantity: number; name?: string }>
): Promise<StockCheckResult[]> {
  const need = new Map<string, { productId: string; size: string; qty: number; name: string }>();
  for (const item of items) {
    const size = item.size || "Free Size";
    const key = `${item.product_id}__${size}`;
    const existing = need.get(key);
    if (existing) {
      existing.qty += item.quantity;
    } else {
      need.set(key, { productId: item.product_id, size, qty: item.quantity, name: item.name || item.product_id });
    }
  }

  const productIds = Array.from(new Set(Array.from(need.values()).map(v => v.productId)));
  const refs = productIds.map(id => adminDb.collection("products").doc(id));
  const snaps = await Promise.all(refs.map(ref => transaction.get(ref)));
  const snapById = new Map(productIds.map((id, i) => [id, snaps[i]]));

  return Array.from(need.values()).map(({ productId, size, qty, name }) => {
    const ref = adminDb.collection("products").doc(productId);
    const snap = snapById.get(productId);
    const data = snap && snap.exists ? (snap.data() || {}) : null;
    const stockMap = data && typeof data.stock === "object" && data.stock !== null ? data.stock : null;
    const tracked = stockMap !== null;
    const rawAvailable = tracked ? Number((stockMap as Record<string, number>)[size]) : null;
    const currentAvailable = tracked ? (Number.isFinite(rawAvailable) ? (rawAvailable as number) : 0) : null;
    return { ref, productId, size, qty, name, tracked, currentAvailable };
  });
}

/**
 * Restores per-size stock (e.g. on order cancellation/refund) directly, outside a
 * transaction. Self-heals a `stock` field that isn't a proper per-size map (legacy
 * bug: earlier code treated `stock` as a single number here) by reinitializing it as
 * a map rather than corrupting it further.
 */
export async function restoreInventoryForOrderItems(
  adminDb: FirebaseFirestore.Firestore,
  items: any[],
  nowIso: string
): Promise<void> {
  for (const item of items || []) {
    const pId = item.product_id || item.id;
    if (!pId) continue;
    const size = item.size || item.selectedSize || "Free Size";
    const qty = Number(item.quantity) || 1;
    try {
      const pRef = adminDb.collection("products").doc(pId);
      const pSnap = await pRef.get();
      if (!pSnap.exists) continue;
      const data = pSnap.data() || {};
      const currentStockMap = (data.stock && typeof data.stock === "object") ? data.stock : {};
      const currentForSize = Number(currentStockMap[size]);
      const newStockMap = {
        ...currentStockMap,
        [size]: (Number.isFinite(currentForSize) ? currentForSize : 0) + qty
      };
      await pRef.update({ stock: newStockMap, updated_at: nowIso });
    } catch (err) {
      console.error(`[INVENTORY RESTORE ERROR] product=${pId} size=${size}:`, err);
    }
  }
}
