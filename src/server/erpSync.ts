import { erpRegisterStyleArticle, erpReserve, erpConfirmReservation, erpReleaseReservation, erpReturnStock } from "./erpClient";

/**
 * Registers/ensures one ERP StyleArticle per size for a product, keyed by
 * the shared factory Pattern/Style Number — see the ERP's
 * POST /integrations/inventory/style-articles. Idempotent: safe to call on
 * every product save. Writes the resulting per-size SKUs onto the product
 * doc (`erpSkuBySize`) and a reverse index (`erp_sku_index/{sku}`) the
 * webhook receiver uses to find "which product/size does this SKU mean"
 * without a collection scan.
 *
 * The product's Fabric Color + Print Name (`color`, despite the field
 * name — see types.ts) are combined into one ERP variantName ("White /
 * Pink Checks"): one Pattern/Style Number covers every color+print
 * combination of a design (the factory's own convention), so each
 * combination is its own Firestore product doc but shares a style number
 * — the ERP tells them apart via a ProductVariant, and the SKU it mints
 * comes back with both baked in (STYLENUMBER-BRAND-CATEGORY-VARIANT-SIZE).
 * This is the real barcode; the admin form's own "SKU Code" is a
 * separate, product-level (not per-size) identifier — see
 * skuGenerator.ts.
 *
 * Never touches `stock` — a newly registered article starts at 0 in the
 * ERP, same as any other new article; real stock only ever enters through
 * the ERP itself (production receipt, restock, transfer).
 */
export async function registerProductWithErp(
  adminDb: FirebaseFirestore.Firestore,
  productId: string,
  product: { styleNumber?: string; name?: string; sizes?: string[]; price?: number; color?: string; fabricColor?: string }
): Promise<{ registered: Record<string, string>; errors: Array<{ size: string; error: string }> }> {
  const styleNumber = (product.styleNumber || "").trim();
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const fabricColor = (product.fabricColor || "").trim();
  const printName = (product.color || "").trim();
  const variantName = [fabricColor, printName].filter(Boolean).join(" / ") || undefined;
  const registered: Record<string, string> = {};
  const errors: Array<{ size: string; error: string }> = [];

  if (!styleNumber || sizes.length === 0) {
    return { registered, errors };
  }

  for (const size of sizes) {
    try {
      const result = await erpRegisterStyleArticle({
        styleNumber,
        size,
        name: product.name,
        variantName,
        mrp: typeof product.price === "number" && product.price > 0 ? product.price : undefined
      });
      registered[size] = result.sku;
    } catch (err: any) {
      console.error(`[ERP SYNC ERROR] product=${productId} size=${size}:`, err?.message || err);
      errors.push({ size, error: err?.message || String(err) });
    }
  }

  if (Object.keys(registered).length > 0) {
    const batch = adminDb.batch();
    const productRef = adminDb.collection("products").doc(productId);
    const existing = (await productRef.get()).data()?.erpSkuBySize || {};
    batch.set(productRef, { erpSkuBySize: { ...existing, ...registered } }, { merge: true });
    for (const [size, sku] of Object.entries(registered)) {
      batch.set(adminDb.collection("erp_sku_index").doc(sku), { productId, size });
    }
    await batch.commit();
  }

  return { registered, errors };
}

interface CheckoutLine {
  productId: string;
  size: string;
  qty: number;
  name: string;
  sku: string | null; // null = this line isn't ERP-registered yet, treated like an untracked legacy product
}

/** Aggregates duplicate (product, size) lines and resolves each to its ERP SKU, same grouping readStockForItems used for the old Firestore stock map. Plain reads, not transactional — erpSkuBySize is reference data, not a counter that needs read/write atomicity. */
async function resolveLines(
  adminDb: FirebaseFirestore.Firestore,
  items: Array<{ product_id: string; size?: string; quantity: number; name?: string }>
): Promise<CheckoutLine[]> {
  const need = new Map<string, { productId: string; size: string; qty: number; name: string }>();
  for (const item of items) {
    const size = item.size || "Free Size";
    const key = `${item.product_id}__${size}`;
    const existing = need.get(key);
    if (existing) existing.qty += item.quantity;
    else need.set(key, { productId: item.product_id, size, qty: item.quantity, name: item.name || item.product_id });
  }

  const productIds = Array.from(new Set(Array.from(need.values()).map((v) => v.productId)));
  const snaps = await Promise.all(productIds.map((id) => adminDb.collection("products").doc(id).get()));
  const skuMapByProduct = new Map(productIds.map((id, i) => [id, (snaps[i].data()?.erpSkuBySize || {}) as Record<string, string>]));

  return Array.from(need.values()).map(({ productId, size, qty, name }) => ({
    productId,
    size,
    qty,
    name,
    sku: skuMapByProduct.get(productId)?.[size] ?? null
  }));
}

export interface OversoldLine {
  name: string;
  size: string;
  requested: number;
  available: number;
}

/**
 * COD path: payment hasn't been taken yet, so it's safe (and correct) to
 * hard-block the order if the ERP can't reserve every line. Reserves every
 * ERP-tracked line first; if any fails, releases whatever succeeded and
 * throws with a message matching the old Firestore-stock-check wording, so
 * the customer-facing behavior is unchanged. Call this BEFORE the Firestore
 * order transaction begins, never from inside it — Firestore transactions
 * retry on contention, and an external HTTP reserve() call has no business
 * running more than once for the same request.
 */
export async function reserveErpStockOrThrow(
  adminDb: FirebaseFirestore.Firestore,
  items: Array<{ product_id: string; size?: string; quantity: number; name?: string }>,
  orderRef: string
): Promise<Array<{ line: CheckoutLine; reservationId: string }>> {
  const lines = await resolveLines(adminDb, items);
  const held: Array<{ line: CheckoutLine; reservationId: string }> = [];

  for (const line of lines) {
    if (!line.sku) continue; // untracked — not registered with the ERP yet, don't block on it
    try {
      const reservation = await erpReserve({ sku: line.sku, quantity: line.qty, orderRef, ttlMinutes: 30 });
      held.push({ line, reservationId: reservation.id });
    } catch (err: any) {
      for (const h of held) {
        erpReleaseReservation(h.reservationId).catch((releaseErr) =>
          console.error(`[ERP RESERVE ROLLBACK ERROR] reservation=${h.reservationId}:`, releaseErr?.message || releaseErr)
        );
      }
      throw new Error(`"${line.name}" (size ${line.size}) is no longer available in the requested quantity. Please update your cart.`);
    }
  }

  return held;
}

/** Confirms every reservation from reserveErpStockOrThrow(), turning the temporary hold into a permanent deduction. Call this AFTER the Firestore order transaction has committed — the order already exists at this point, so a confirm failure here is logged, not thrown. */
export async function confirmErpReservations(
  held: Array<{ line: CheckoutLine; reservationId: string }>,
  referenceType: string,
  referenceId: string
): Promise<void> {
  for (const h of held) {
    try {
      await erpConfirmReservation(h.reservationId, referenceType, referenceId);
    } catch (err: any) {
      console.error(`[ERP CONFIRM ERROR] reservation=${h.reservationId} order=${referenceId}:`, err?.message || err);
    }
  }
}

/**
 * Razorpay path: payment is already captured by the time this runs, so
 * there is no blocking — every line is attempted independently and a
 * failure just gets flagged for admin follow-up (stock_oversold), same
 * spirit as the pre-ERP code's clamp-at-zero-and-flag behavior. Call this
 * BEFORE the Firestore order transaction, same reasoning as
 * reserveErpStockOrThrow — reserve+confirm are external calls that must
 * not run inside a retryable transaction.
 */
export async function reserveAndConfirmErpStockBestEffort(
  adminDb: FirebaseFirestore.Firestore,
  items: Array<{ product_id: string; size?: string; quantity: number; name?: string }>,
  orderRef: string,
  referenceType: string
): Promise<OversoldLine[]> {
  const lines = await resolveLines(adminDb, items);
  const oversold: OversoldLine[] = [];

  for (const line of lines) {
    if (!line.sku) continue;
    try {
      const reservation = await erpReserve({ sku: line.sku, quantity: line.qty, orderRef, ttlMinutes: 30 });
      try {
        await erpConfirmReservation(reservation.id, referenceType, orderRef);
      } catch (confirmErr: any) {
        console.error(`[ERP CONFIRM ERROR] reservation=${reservation.id} order=${orderRef}:`, confirmErr?.message || confirmErr);
        erpReleaseReservation(reservation.id).catch(() => {});
        oversold.push({ name: line.name, size: line.size, requested: line.qty, available: 0 });
      }
    } catch (reserveErr: any) {
      console.warn(`[STOCK OVERSOLD] order=${orderRef} sku=${line.sku}:`, reserveErr?.message || reserveErr);
      oversold.push({ name: line.name, size: line.size, requested: line.qty, available: 0 });
    }
  }

  return oversold;
}

/**
 * Cancellation/refund path: adds stock back in the ERP for every
 * ERP-tracked line in an order whose stock was already confirmed
 * (deducted) at checkout — see the ERP's POST /integrations/inventory/return.
 * Best-effort per line, same reasoning as confirmErpReservations: the
 * order's own cancellation/refund has already been decided and recorded by
 * the time this runs, so a restock failure here is logged, not thrown. The
 * caller is responsible for its own idempotency (e.g. an `inventory_restored`
 * flag on the order doc) so this never runs twice for the same order.
 */
export async function restockErpForOrder(
  adminDb: FirebaseFirestore.Firestore,
  items: Array<{ product_id: string; size?: string; quantity: number; name?: string }>,
  orderRef: string
): Promise<void> {
  const lines = await resolveLines(adminDb, items);
  for (const line of lines) {
    if (!line.sku) continue; // untracked — nothing was ever deducted in the ERP for this line
    try {
      await erpReturnStock({ sku: line.sku, quantity: line.qty, orderRef });
    } catch (err: any) {
      console.error(`[ERP RESTOCK ERROR] order=${orderRef} sku=${line.sku}:`, err?.message || err);
    }
  }
}
