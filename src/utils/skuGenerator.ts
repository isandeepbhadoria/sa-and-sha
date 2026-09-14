/**
 * Auto-generates the admin's "SKU Code" (the site's own product-level
 * identifier — feeds GST invoicing/credit notes/Tax Master's SKU-scoped
 * rules) instead of it being hand-typed —
 * `{Brand}-{ProductType}-{StyleNumber}-{FabricColor}-{PrintName}`, e.g.
 * SS-SH-1004-WHITE-PINKCH.
 *
 * Uses the real Pattern/Style Number as the identifying segment (not a
 * running counter) — it's already the factory's own unique-per-design
 * number, so there's nothing to count or collide on. Product Type and
 * Print Name are shortened (3 and 6 characters respectively — Print Name
 * gets more room since two prints sharing the same first 3 letters, e.g.
 * "Pink Checks" vs "Pink Stripes", would otherwise collide); Fabric Color
 * is kept in full since color names are already short.
 *
 * A size-aware "complete" SKU with a real barcode already exists
 * separately — the ERP mints one per size once this product is saved
 * (see erpSync.ts's registerProductWithErp and AdminPage's read-only
 * per-size SKU display) — this generator only ever produces the
 * product-level one.
 */

const BRAND_CODE = "SS";

function shortCode(value: string, fallback: string, length: number): string {
  const code = (value || "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, length)
    .toUpperCase();
  return code || fallback;
}

export function generateSkuCode(
  productType: string,
  styleNumber: string,
  fabricColor: string,
  printName: string
): string {
  const categoryCode = shortCode(productType, "GEN", 3);
  const styleCode = shortCode(styleNumber, "0000", 20);
  const fabricColorCode = shortCode(fabricColor, "STD", 20);
  const printNameCode = shortCode(printName, "STD", 6);
  return `${BRAND_CODE}-${categoryCode}-${styleCode}-${fabricColorCode}-${printNameCode}`;
}
