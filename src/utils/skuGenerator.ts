/**
 * Auto-generates the admin's "SKU Code" (the site's own product-level
 * identifier — feeds GST invoicing/credit notes/Tax Master's SKU-scoped
 * rules) instead of it being hand-typed —
 * `{Brand}-{ProductType}-{StyleNumber}-{FabricColor}-{PrintName}`, e.g.
 * SS-TOP-9001-WHIT-FLORAL.
 *
 * - ProductType: first 3 letters.
 * - StyleNumber: first 4 characters of the real Pattern/Style Number
 *   (nothing to count or collide on — it's already the factory's own
 *   unique-per-design number).
 * - FabricColor: first 4 letters.
 * - PrintName: exactly 6 letters, encoded by word count (see
 *   encodePrintName) so two prints that happen to share the same first
 *   few letters ("Pink Checks" vs "Pink Stripes") don't collide — or
 *   "SOLIDS" when the product has no print at all.
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

// 1 word -> first 6 letters of it. 2 words -> first 3 of each. 3+ words ->
// first 2 of each, counting only the first 3 words. Always 6 letters
// total (barring a word too short to contribute its share).
function encodePrintName(printName: string, noPrints: boolean): string {
  if (noPrints) return "SOLIDS";
  const words = (printName || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "STD";
  if (words.length === 1) return shortCode(words[0], "STD", 6);
  const wordsToUse = words.slice(0, 3);
  const perWordLength = wordsToUse.length === 2 ? 3 : 2;
  const code = wordsToUse.map((w) => shortCode(w, "", perWordLength)).join("");
  return code || "STD";
}

export function generateSkuCode(
  productType: string,
  styleNumber: string,
  fabricColor: string,
  printName: string,
  noPrints: boolean
): string {
  const categoryCode = shortCode(productType, "GEN", 3);
  const styleCode = shortCode(styleNumber, "0000", 4);
  const fabricColorCode = shortCode(fabricColor, "STD", 4);
  const printNameCode = encodePrintName(printName, noPrints);
  return `${BRAND_CODE}-${categoryCode}-${styleCode}-${fabricColorCode}-${printNameCode}`;
}
