/**
 * Auto-generates the admin's "SKU Code" instead of it being hand-typed —
 * `{Brand}-{Category}-{running number}-{Color}`, e.g. SS-SH-004-BLK. This
 * is the site's own internal SKU (feeds GST invoicing/credit notes/Tax
 * Master's SKU-scoped rules), a different thing from the ERP's own
 * per-size barcode (see erpSync.ts's registerProductWithErp) — this one
 * only needs to be a readable, typo-free reference code, not globally
 * unique across every size/color combination.
 *
 * The running number is derived from how many existing products already
 * share this category, +1 — a best-effort count, not a database-backed
 * counter (nothing here enforces uniqueness, same as the field it
 * replaces), which is fine for a single-admin catalog.
 */

const BRAND_CODE = "SS";

function shortCode(value: string, fallback: string): string {
  const code = (value || "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 3)
    .toUpperCase();
  return code || fallback;
}

export function generateSkuCode(
  allProducts: Array<{ category?: string }>,
  category: string,
  color: string
): string {
  const categoryCode = shortCode(category, "GEN");
  const colorCode = shortCode(color, "STD");
  const countInCategory = allProducts.filter((p) => p.category === category).length + 1;
  const running = String(countInCategory).padStart(3, "0");
  return `${BRAND_CODE}-${categoryCode}-${running}-${colorCode}`;
}
