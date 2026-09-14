/**
 * Groups a garment's separate print listings (each still its own Firestore
 * product/URL/SKU — see AdminPage's Print Name field) into one shop-grid
 * card and one product-detail-page swatch selector, so a style with 6-10
 * prints doesn't clutter the grid with near-duplicate cards.
 *
 * Grouping key is Pattern/Style Number + Fabric Color — prints of the
 * SAME color group together; a different fabric color under the same
 * style number stays its own separate group/page (colors can differ in
 * price/behavior in ways prints of one color don't).
 *
 * A product with no Style Number set (legacy data, predates this
 * feature) never groups with anything else — it's always its own
 * singleton group, exactly like before.
 */

export interface GroupableProduct {
  id: string;
  styleNumber?: string;
  fabricColor?: string;
}

export function productGroupKey(p: GroupableProduct): string | null {
  const styleNumber = (p.styleNumber || '').trim().toLowerCase();
  if (!styleNumber) return null;
  const fabricColor = (p.fabricColor || '').trim().toLowerCase();
  return `${styleNumber}::${fabricColor}`;
}

export interface ProductGroup<T> {
  representative: T;
  siblings: T[];
}

// Preserves the input order of each group's first-seen member, so
// grouping doesn't reshuffle an already-sorted/filtered product list —
// the representative is whichever sibling happened to be first (e.g.
// the one that matched an active filter).
export function groupProductsByStyleAndColor<T extends GroupableProduct>(
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
