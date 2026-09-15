/**
 * Groups a garment's separate variant listings (each still its own
 * Firestore product/URL/SKU — see AdminPage's Variants section) into one
 * shop-grid card and one product-detail-page swatch selector, so a style
 * with several Color/Print combinations doesn't clutter the grid with
 * near-duplicate cards.
 *
 * Grouping key is Pattern/Style Number alone — every Fabric Color + Print
 * Name combination under the same style lands on one page; the customer
 * only ever picks a print/swatch there, never a separate color (see
 * ProductDetailPage's swatch labels, which show Print Name only).
 *
 * A product with no Style Number set (legacy data, predates this
 * feature) never groups with anything else — it's always its own
 * singleton group, exactly like before.
 */

export interface GroupableProduct {
  id: string;
  styleNumber?: string;
}

export function productGroupKey(p: GroupableProduct): string | null {
  const styleNumber = (p.styleNumber || '').trim().toLowerCase();
  if (!styleNumber) return null;
  return styleNumber;
}

export interface ProductGroup<T> {
  representative: T;
  siblings: T[];
}

// Preserves the input order of each group's first-seen member, so
// grouping doesn't reshuffle an already-sorted/filtered product list —
// the representative is whichever sibling happened to be first (e.g.
// the one that matched an active filter).
export function groupProductsByStyle<T extends GroupableProduct>(
  productList: T[]
): ProductGroup<T>[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];
  for (const p of productList) {
    const key = productGroupKey(p) ?? `__ungrouped__${p.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(p);
  }
  return order.map((key) => {
    const siblings = groups.get(key)!;
    return { representative: siblings[0], siblings };
  });
}

// The full sibling set for one specific product — used on the product
// detail page to build the print swatch selector. Returns just the
// product itself when it has no Style Number (nothing to group with).
export function findPrintSiblings<T extends GroupableProduct>(
  product: T,
  allInGroup: T[]
): T[] {
  const key = productGroupKey(product);
  if (!key) return [product];
  return allInGroup.filter((p) => productGroupKey(p) === key);
}
