import { products as catalogProducts } from '../../data';

export type TaxRuleScope = "SKU" | "PRODUCT" | "TAX_CLASS" | "CATEGORY" | "DEFAULT";
export type TaxRateMode = "FIXED" | "VALUE_BAND";

export interface TaxValueBand {
  min_price: number;
  max_price: number | null; // null or Infinity for "Above X"
  gst_rate: number;
}

export interface ProductTaxMasterEntry {
  tax_record_id?: string;
  scope_type?: TaxRuleScope;
  scope_value?: string;
  product_id?: string;
  sku?: string;
  tax_class?: string;
  category?: string;
  product_name_snapshot?: string;
  hsn_code: string;
  description?: string;
  rate_mode?: TaxRateMode;
  gst_rate?: number;
  value_bands?: TaxValueBand[];
  tax_category?: string;
  tax_config_version?: string;
  effective_from?: string; // ISO date string e.g. "2026-04-01T00:00:00.000Z"
  effective_to?: string | null; // ISO date string or null
  status?: "ACTIVE" | "INACTIVE" | "SUPERSEDED" | "DRAFT";
  source?: "MANUAL" | "BULK_IMPORT" | "API";
  notes?: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
}

export interface TaxMasterLookupResult {
  success: boolean;
  code?: "INVOICE_TAX_METADATA_MISSING" | "PRODUCT_TAX_RULE_AMBIGUOUS" | "PRODUCT_TAX_RULE_MISSING";
  error?: string;
  missing_field?: "hsn_code" | "gst_rate";
  sku?: string;
  product_id?: string;
  tax_class?: string;
  category?: string;
  metadata?: ProductTaxMasterEntry & { resolved_scope?: TaxRuleScope };
}

export interface DateOverlapCheckResult {
  overlap: boolean;
  code?: "TAX_RULE_DATE_OVERLAP";
  error?: string;
  conflicting_record?: ProductTaxMasterEntry;
}

export const HSN_REGEX = /^[0-9]{4,8}$/;
export const VALID_GST_RATES = [0, 5, 12, 18, 28];

// Memory store for product tax master entries indexed by scope
const taxMasterStore: Map<string, ProductTaxMasterEntry[]> = new Map();

export function initDefaultTaxMasterStore(): void {
  registerProductTaxMetadata({
    tax_record_id: 'default_apparel_rule',
    scope_type: 'DEFAULT',
    scope_value: 'DEFAULT',
    hsn_code: '6205',
    description: 'Default Apparel Tax Rule',
    rate_mode: 'VALUE_BAND',
    value_bands: [
      { min_price: 0, max_price: 1000, gst_rate: 5 },
      { min_price: 1000.01, max_price: null, gst_rate: 12 }
    ],
    status: 'ACTIVE'
  });
}

// Initialize default store once on module load
initDefaultTaxMasterStore();

export function clearProductTaxMaster(): void {
  taxMasterStore.clear();
}

/**
 * Category normalization helper.
 * Normalizes input strings into canonical category identifiers.
 */
export function normalizeTaxCategory(cat?: string): string {
  if (!cat) return "";
  const cleaned = cat.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (cleaned === "DRESSES" || cleaned === "DRESS") return "DRESSES";
  if (cleaned === "TOPS_SHIRTS" || cleaned === "TOPS" || cleaned === "SHIRTS") return "TOPS_SHIRTS";
  if (cleaned === "SHORTS_SKIRTS" || cleaned === "SHORTS" || cleaned === "SKIRTS") return "SHORTS_SKIRTS";
  if (cleaned === "CO_ORD_SETS" || cleaned === "COORD_SETS" || cleaned === "COORDS") return "CO_ORD_SETS";
  if (cleaned === "TROUSERS" || cleaned === "PANTS") return "TROUSERS";
  if (cleaned === "JACKETS") return "JACKETS";
  if (cleaned === "BAGS_POUCHES" || cleaned === "BAGS" || cleaned === "ACCESSORIES") return "BAGS_POUCHES";
  return cleaned;
}

/**
 * Tax class normalization helper.
 * Normalizes classification strings into canonical lowercase underscored keys.
 */
export function normalizeTaxClass(tc?: string): string {
  if (!tc) return "";
  return tc.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Scope resolution helper.
 */
export function resolveRuleScope(entry: Partial<ProductTaxMasterEntry>): { scope_type: TaxRuleScope; scope_value: string } {
  if (entry.scope_type && entry.scope_value) {
    let val = entry.scope_value.trim().toLowerCase();
    if (entry.scope_type === "CATEGORY") val = normalizeTaxCategory(val).toLowerCase();
    if (entry.scope_type === "TAX_CLASS") val = normalizeTaxClass(val).toLowerCase();
    return { scope_type: entry.scope_type, scope_value: val };
  }

  if (entry.sku && entry.sku.trim()) {
    return { scope_type: "SKU", scope_value: entry.sku.trim().toLowerCase() };
  }
  if (entry.product_id && entry.product_id.trim()) {
    return { scope_type: "PRODUCT", scope_value: entry.product_id.trim().toLowerCase() };
  }
  if (entry.tax_class && entry.tax_class.trim()) {
    return { scope_type: "TAX_CLASS", scope_value: normalizeTaxClass(entry.tax_class).toLowerCase() };
  }
  const cat = entry.tax_category || entry.category;
  if (cat && cat.trim()) {
    return { scope_type: "CATEGORY", scope_value: normalizeTaxCategory(cat).toLowerCase() };
  }
  return { scope_type: "DEFAULT", scope_value: "DEFAULT" };
}

export function registerProductTaxMetadata(entry: ProductTaxMasterEntry): void {
  const normScope = resolveRuleScope(entry);
  const normEntry: ProductTaxMasterEntry = {
    ...entry,
    scope_type: normScope.scope_type,
    scope_value: normScope.scope_value,
    effective_from: entry.effective_from || new Date(0).toISOString(),
    status: entry.status || "ACTIVE",
    rate_mode: entry.rate_mode || "FIXED"
  };

  const mainKey = `${normScope.scope_type.toLowerCase()}:${normScope.scope_value}`;
  const existing = taxMasterStore.get(mainKey) || [];
  
  const existingIdx = existing.findIndex((e) => {
    if (normEntry.tax_record_id && e.tax_record_id && e.tax_record_id === normEntry.tax_record_id) {
      return true;
    }
    return (
      e.scope_type === normEntry.scope_type &&
      e.scope_value === normEntry.scope_value &&
      new Date(e.effective_from || 0).getTime() === new Date(normEntry.effective_from || 0).getTime()
    );
  });

  if (existingIdx >= 0) {
    existing[existingIdx] = normEntry;
  } else {
    existing.push(normEntry);
  }
  taxMasterStore.set(mainKey, existing);

  // Maintain backwards-compatible lookup keys
  const matchEntry = (e: ProductTaxMasterEntry) => {
    if (normEntry.tax_record_id && e.tax_record_id && e.tax_record_id === normEntry.tax_record_id) {
      return true;
    }
    return (
      e.scope_type === normEntry.scope_type &&
      e.scope_value === normEntry.scope_value &&
      new Date(e.effective_from || 0).getTime() === new Date(normEntry.effective_from || 0).getTime()
    );
  };

  if (normEntry.sku) {
    const k = `sku:${normEntry.sku.toLowerCase().trim()}`;
    const ex = taxMasterStore.get(k) || [];
    const idx = ex.findIndex(matchEntry);
    if (idx >= 0) {
      ex[idx] = normEntry;
    } else {
      ex.push(normEntry);
    }
    taxMasterStore.set(k, ex);
  }
  if (normEntry.product_id) {
    const k = `prod:${normEntry.product_id.toLowerCase().trim()}`;
    const ex = taxMasterStore.get(k) || [];
    const idx = ex.findIndex(matchEntry);
    if (idx >= 0) {
      ex[idx] = normEntry;
    } else {
      ex.push(normEntry);
    }
    taxMasterStore.set(k, ex);
  }
}

export function seedProductTaxMaster(entries: ProductTaxMasterEntry[]): void {
  entries.forEach((e) => registerProductTaxMetadata(e));
}

/**
 * Checks if a proposed product tax entry overlaps in effective date range and price band
 * with any existing active rule of the SAME scope and scope value.
 */
export function checkProductTaxDateOverlap(
  existingEntries: ProductTaxMasterEntry[],
  newEntry: Partial<ProductTaxMasterEntry>
): DateOverlapCheckResult {
  const newFromStr = newEntry.effective_from || new Date().toISOString();
  const newFromTime = new Date(newFromStr).getTime();
  const newToStr = newEntry.effective_to ? newEntry.effective_to : null;
  const newToTime = newToStr ? new Date(newToStr).getTime() : Infinity;

  if (isNaN(newFromTime)) {
    return {
      overlap: true,
      code: "TAX_RULE_DATE_OVERLAP",
      error: `Invalid effective_from date '${newEntry.effective_from}'.`
    };
  }

  if (newToStr && isNaN(newToTime)) {
    return {
      overlap: true,
      code: "TAX_RULE_DATE_OVERLAP",
      error: `Invalid effective_to date '${newEntry.effective_to}'.`
    };
  }

  if (newToTime < newFromTime) {
    return {
      overlap: true,
      code: "TAX_RULE_DATE_OVERLAP",
      error: `effective_to (${newToStr}) cannot be earlier than effective_from (${newFromStr}).`
    };
  }

  const newScope = resolveRuleScope(newEntry);

  for (const ex of existingEntries) {
    if (ex.status === "INACTIVE" || ex.status === "SUPERSEDED") continue;
    if (newEntry.tax_record_id && ex.tax_record_id === newEntry.tax_record_id) continue;

    const exScope = resolveRuleScope(ex);
    if (newScope.scope_type !== exScope.scope_type || newScope.scope_value !== exScope.scope_value) {
      continue;
    }

    const exFromTime = new Date(ex.effective_from || 0).getTime();
    const exToTime = ex.effective_to ? new Date(ex.effective_to).getTime() : Infinity;

    // Check date range overlap
    if (newFromTime <= exToTime && exFromTime <= newToTime) {
      // Check price band overlap
      if (checkTwoEntriesPriceBandsOverlap(newEntry, ex)) {
        return {
          overlap: true,
          code: "TAX_RULE_DATE_OVERLAP",
          error: `Effective date/price range for ${newScope.scope_type} '${newScope.scope_value}' overlaps with existing active rule '${ex.tax_record_id || "existing"}'.`,
          conflicting_record: ex
        };
      }
    }
  }

  return { overlap: false };
}

export function checkPriceBandsOverlap(bands: TaxValueBand[]): { valid: boolean; error?: string } {
  if (!bands || bands.length === 0) return { valid: true };
  const sorted = [...bands].sort((a, b) => a.min_price - b.min_price);
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur.max_price !== null && cur.max_price !== undefined && cur.max_price < cur.min_price) {
      return { valid: false, error: `Invalid price band: min_price (${cur.min_price}) cannot exceed max_price (${cur.max_price}).` };
    }
    if (i < sorted.length - 1) {
      const next = sorted[i + 1];
      if (cur.max_price === null || cur.max_price === undefined || cur.max_price >= next.min_price) {
        return { valid: false, error: `Price band overlap detected between band ending at ${cur.max_price} and band starting at ${next.min_price}.` };
      }
    }
  }
  return { valid: true };
}

function checkTwoEntriesPriceBandsOverlap(entryA: Partial<ProductTaxMasterEntry>, entryB: ProductTaxMasterEntry): boolean {
  if (entryA.rate_mode !== "VALUE_BAND" || entryB.rate_mode !== "VALUE_BAND") {
    return true; // Fixed rate or unbanded rule covers all price points
  }
  const bandsA = entryA.value_bands || [];
  const bandsB = entryB.value_bands || [];
  if (bandsA.length === 0 || bandsB.length === 0) return true;

  for (const bA of bandsA) {
    const maxA = bA.max_price === null ? Infinity : bA.max_price;
    for (const bB of bandsB) {
      const maxB = bB.max_price === null ? Infinity : bB.max_price;
      if (Math.max(bA.min_price, bB.min_price) <= Math.min(maxA, maxB)) {
        return true;
      }
    }
  }
  return false;
}

function isEffectiveForDate(entry: ProductTaxMasterEntry, targetDate: Date): boolean {
  if (entry.status === "INACTIVE" || entry.status === "SUPERSEDED") return false;
  const tTime = targetDate.getTime();
  const fromTime = new Date(entry.effective_from || 0).getTime();
  const toTime = entry.effective_to ? new Date(entry.effective_to).getTime() : Infinity;

  return tTime >= fromTime && tTime <= toTime;
}

/**
 * Strict hierarchical lookup for product tax metadata.
 * PRIORITY 1 — SKU-specific override
 * PRIORITY 2 — Product-ID-specific override
 * PRIORITY 3 — Product-category rule
 * PRIORITY 4 — Configured default rule
 *
 * NEVER infers HSN from name or SKU text.
 * NEVER infers GST rate without explicit tax master configuration.
 */
export function lookupProductTaxMetadata(params: {
  product_id?: string;
  sku?: string;
  tax_class?: string;
  category?: string;
  item?: any;
  invoice_date?: Date | string;
  price?: number;
}): TaxMasterLookupResult {
  const item = params.item || {};
  const cleanProdId = String(params.product_id || item.product_id || item.id || "").toLowerCase().trim();
  const cleanSku = String(params.sku || item.sku || "").toLowerCase().trim();

  let rawTaxClass = params.tax_class || item.tax_class || item.taxClass || "";
  let rawCategory = params.category || item.category || item.tax_category || "";

  if ((!rawCategory || !rawTaxClass) && (cleanProdId || cleanSku)) {
    const foundInCatalog = catalogProducts.find(
      (p) => p.id.toLowerCase() === cleanProdId || (p as any).sku?.toLowerCase() === cleanSku
    );
    if (foundInCatalog) {
      if (!rawCategory && foundInCatalog.category) {
        rawCategory = foundInCatalog.category;
      }
      if (!rawTaxClass && (foundInCatalog as any).tax_class) {
        rawTaxClass = (foundInCatalog as any).tax_class;
      }
    }
  }
  const normalizedCat = normalizeTaxCategory(rawCategory);
  const normalizedTaxClass = normalizeTaxClass(rawTaxClass);

  const targetDate = params.invoice_date ? new Date(params.invoice_date) : new Date();
  const validTargetDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;
  const itemPrice = typeof params.price === "number"
    ? Math.round(params.price * 100) / 100
    : Math.round(Number(item.price || item.unit_price || 0) * 100) / 100;

  // 1. Direct item snapshot check
  if (
    typeof item.hsn_code === "string" &&
    item.hsn_code.trim().length >= 4 &&
    typeof item.gst_rate === "number" &&
    !isNaN(item.gst_rate) &&
    item.gst_rate >= 0
  ) {
    return {
      success: true,
      metadata: {
        product_id: cleanProdId || "item",
        sku: cleanSku || undefined,
        tax_class: rawTaxClass || undefined,
        hsn_code: item.hsn_code.trim(),
        gst_rate: item.gst_rate,
        tax_category: rawCategory || "APPAREL",
        effective_from: item.effective_from || new Date(0).toISOString(),
        tax_config_version: item.tax_config_version || "v1.0",
        status: "ACTIVE",
        resolved_scope: item.tax_rule_scope || "SKU"
      }
    };
  }

  // Gather active, date-effective entries
  const allActiveEntries: ProductTaxMasterEntry[] = [];
  taxMasterStore.forEach((list) => {
    list.forEach((e) => {
      if (isEffectiveForDate(e, validTargetDate) && !allActiveEntries.includes(e)) {
        allActiveEntries.push(e);
      }
    });
  });

  // PRIORITY 1: SKU Override
  if (cleanSku) {
    const skuMatches = allActiveEntries.filter((e) => {
      const scope = resolveRuleScope(e);
      return scope.scope_type === "SKU" && scope.scope_value.toLowerCase() === cleanSku;
    });
    if (skuMatches.length > 0) {
      return resolveMatchingRule(skuMatches, itemPrice, "SKU", cleanSku, cleanProdId, normalizedCat, normalizedTaxClass);
    }
  }

  // PRIORITY 2: Product ID Override
  if (cleanProdId) {
    const prodMatches = allActiveEntries.filter((e) => {
      const scope = resolveRuleScope(e);
      return scope.scope_type === "PRODUCT" && scope.scope_value.toLowerCase() === cleanProdId;
    });
    if (prodMatches.length > 0) {
      return resolveMatchingRule(prodMatches, itemPrice, "PRODUCT", cleanSku, cleanProdId, normalizedCat, normalizedTaxClass);
    }
  }

  // PRIORITY 3: Tax Class Rule
  if (normalizedTaxClass) {
    const normTcLower = normalizedTaxClass.toLowerCase();
    const tcMatches = allActiveEntries.filter((e) => {
      const scope = resolveRuleScope(e);
      return scope.scope_type === "TAX_CLASS" && scope.scope_value.toLowerCase() === normTcLower;
    });
    if (tcMatches.length > 0) {
      return resolveMatchingRule(tcMatches, itemPrice, "TAX_CLASS", cleanSku, cleanProdId, normalizedCat, normalizedTaxClass);
    }
  }

  // PRIORITY 4: Category Rule
  if (normalizedCat) {
    const normCatLower = normalizedCat.toLowerCase();
    const catMatches = allActiveEntries.filter((e) => {
      const scope = resolveRuleScope(e);
      return scope.scope_type === "CATEGORY" && scope.scope_value.toLowerCase() === normCatLower;
    });
    if (catMatches.length > 0) {
      return resolveMatchingRule(catMatches, itemPrice, "CATEGORY", cleanSku, cleanProdId, normalizedCat, normalizedTaxClass);
    }
  }

  // PRIORITY 5: Configured Default Rule
  const defaultMatches = allActiveEntries.filter((e) => {
    const scope = resolveRuleScope(e);
    return scope.scope_type === "DEFAULT";
  });
  if (defaultMatches.length > 0) {
    return resolveMatchingRule(defaultMatches, itemPrice, "DEFAULT", cleanSku, cleanProdId, normalizedCat, normalizedTaxClass);
  }

  // FAIL CLOSED
  const missingField: "hsn_code" | "gst_rate" = !item.hsn_code ? "hsn_code" : "gst_rate";
  return {
    success: false,
    code: "INVOICE_TAX_METADATA_MISSING",
    error: `Missing verified product tax metadata for item '${item.name || cleanSku || cleanProdId || "product"}'. Automatic HSN/rate inference is forbidden.`,
    missing_field: missingField,
    sku: cleanSku || undefined,
    product_id: cleanProdId || undefined,
    tax_class: normalizedTaxClass || undefined,
    category: normalizedCat || undefined
  };
}

function resolveMatchingRule(
  matchingRules: ProductTaxMasterEntry[],
  itemPrice: number,
  priorityScope: TaxRuleScope,
  cleanSku?: string,
  cleanProdId?: string,
  category?: string,
  taxClass?: string
): TaxMasterLookupResult {
  const validCandidates: { rule: ProductTaxMasterEntry; gst_rate: number }[] = [];

  for (const rule of matchingRules) {
    if (rule.rate_mode === "VALUE_BAND" && Array.isArray(rule.value_bands) && rule.value_bands.length > 0) {
      const band = rule.value_bands.find((b) => {
        const minP = b.min_price ?? 0;
        const maxP = b.max_price === null ? Infinity : b.max_price;
        return itemPrice >= minP && itemPrice <= maxP;
      });
      if (band) {
        validCandidates.push({ rule, gst_rate: band.gst_rate });
      }
    } else if (typeof rule.gst_rate === "number" && !isNaN(rule.gst_rate)) {
      validCandidates.push({ rule, gst_rate: rule.gst_rate });
    }
  }

  if (validCandidates.length === 0) {
    return {
      success: false,
      code: "PRODUCT_TAX_RULE_MISSING",
      error: `Tax rule found for ${priorityScope} level, but item price ₹${itemPrice} falls outside configured value bands.`,
      sku: cleanSku,
      product_id: cleanProdId,
      tax_class: taxClass,
      category
    };
  }

  if (validCandidates.length > 1) {
    return {
      success: false,
      code: "PRODUCT_TAX_RULE_AMBIGUOUS",
      error: `Ambiguous tax rules found: ${validCandidates.length} active rules apply simultaneously at ${priorityScope} level for item.`,
      sku: cleanSku,
      product_id: cleanProdId,
      tax_class: taxClass,
      category
    };
  }

  const selected = validCandidates[0];
  return {
    success: true,
    metadata: {
      ...selected.rule,
      gst_rate: selected.gst_rate,
      tax_class: selected.rule.tax_class || taxClass || undefined,
      resolved_scope: priorityScope
    }
  };
}

/**
 * Loads all product tax master records from Firestore collection product_tax_master into memory store.
 */
export async function loadProductTaxMasterFromFirestore(db: any): Promise<number> {
  if (!db) return 0;
  try {
    clearProductTaxMaster();
    const snap = await db.collection("product_tax_master").get();
    let count = 0;
    snap.forEach((docSnap: any) => {
      const data = docSnap.data();
      registerProductTaxMetadata({
        tax_record_id: docSnap.id,
        scope_type: data.scope_type,
        scope_value: data.scope_value,
        product_id: data.product_id,
        sku: data.sku,
        tax_class: data.tax_class,
        category: data.category,
        tax_category: data.tax_category,
        product_name_snapshot: data.product_name_snapshot,
        hsn_code: String(data.hsn_code || "").trim(),
        description: data.description,
        rate_mode: data.rate_mode || "FIXED",
        gst_rate: typeof data.gst_rate === "number" ? Number(data.gst_rate) : undefined,
        value_bands: Array.isArray(data.value_bands) ? data.value_bands : undefined,
        tax_config_version: data.tax_config_version || "v1.0",
        effective_from: data.effective_from || new Date(0).toISOString(),
        effective_to: data.effective_to || null,
        status: data.status || "ACTIVE",
        source: data.source || "MANUAL",
        notes: data.notes,
        created_at: data.created_at,
        updated_at: data.updated_at
      });
      count++;
    });
    return count;
  } catch (err) {
    console.error("Error loading product tax master from Firestore:", err);
    return 0;
  }
}

/**
 * Calculates Tax Coverage summary across catalog products.
 */
export function getTaxCoverageSummary(
  allProducts: any[] = catalogProducts,
  invoiceDate?: Date | string
): {
  total_products: number;
  covered_products: number;
  uncovered_products: number;
  coverage_percentage: number;
  covered_by_sku: number;
  covered_by_product: number;
  covered_by_tax_class: number;
  covered_by_category: number;
  covered_by_default: number;
  missing: number;
  ambiguous: number;
  details: Array<{
    product_id: string;
    sku: string;
    name: string;
    category: string;
    tax_class?: string;
    price: number;
    status: "COVERED" | "MISSING" | "AMBIGUOUS";
    resolved_scope?: TaxRuleScope;
    hsn_code?: string;
    gst_rate?: number;
    error?: string;
  }>;
} {
  let covered_by_sku = 0;
  let covered_by_product = 0;
  let covered_by_tax_class = 0;
  let covered_by_category = 0;
  let covered_by_default = 0;
  let missing = 0;
  let ambiguous = 0;

  const details: any[] = [];

  allProducts.forEach((p) => {
    const prodId = p.id;
    const sku = p.sku || p.id;
    const cat = p.category;
    const taxClass = (p as any).tax_class;
    const price = p.price || 0;

    const res = lookupProductTaxMetadata({
      product_id: prodId,
      sku: sku,
      category: cat,
      tax_class: taxClass,
      price: price,
      invoice_date: invoiceDate
    });

    if (res.success && res.metadata) {
      const scope = res.metadata.resolved_scope || "SKU";
      if (scope === "SKU") covered_by_sku++;
      else if (scope === "PRODUCT") covered_by_product++;
      else if (scope === "TAX_CLASS") covered_by_tax_class++;
      else if (scope === "CATEGORY") covered_by_category++;
      else if (scope === "DEFAULT") covered_by_default++;

      details.push({
        product_id: prodId,
        sku: sku,
        name: p.name,
        category: cat,
        tax_class: taxClass,
        price,
        status: "COVERED",
        resolved_scope: scope,
        hsn_code: res.metadata.hsn_code,
        gst_rate: res.metadata.gst_rate
      });
    } else if (res.code === "PRODUCT_TAX_RULE_AMBIGUOUS") {
      ambiguous++;
      details.push({
        product_id: prodId,
        sku: sku,
        name: p.name,
        category: cat,
        tax_class: taxClass,
        price,
        status: "AMBIGUOUS",
        error: res.error
      });
    } else {
      missing++;
      details.push({
        product_id: prodId,
        sku: sku,
        name: p.name,
        category: cat,
        tax_class: taxClass,
        price,
        status: "MISSING",
        error: res.error
      });
    }
  });

  const covered_products = covered_by_sku + covered_by_product + covered_by_tax_class + covered_by_category + covered_by_default;
  const uncovered_products = missing + ambiguous;
  const coverage_percentage = allProducts.length > 0 ? Math.round((covered_products / allProducts.length) * 100) : 100;

  return {
    total_products: allProducts.length,
    covered_products,
    uncovered_products,
    coverage_percentage,
    covered_by_sku,
    covered_by_product,
    covered_by_tax_class,
    covered_by_category,
    covered_by_default,
    missing,
    ambiguous,
    details
  };
}

export interface CsvImportRowValidation {
  row_number: number;
  valid: boolean;
  errors: string[];
  data: Partial<ProductTaxMasterEntry>;
}

export interface CsvImportPreviewResult {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  valid_count?: number;
  error_count?: number;
  records?: ProductTaxMasterEntry[];
  errors?: Array<{ row_number: number; message: string; errors: string[] }>;
  has_overlaps: boolean;
  rows: CsvImportRowValidation[];
}

/**
 * Parses and validates CSV string for Product Tax Master bulk import.
 */
export function parseAndValidateProductTaxCsv(
  csvText: string,
  existingEntries: ProductTaxMasterEntry[] = []
): CsvImportPreviewResult {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { total_rows: 0, valid_rows: 0, invalid_rows: 0, has_overlaps: false, rows: [] };
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  const scopeTypeIdx = headers.findIndex((h) => h === "scope_type" || h === "scope");
  const scopeValueIdx = headers.findIndex((h) => h === "scope_value");
  const skuIdx = headers.indexOf("sku");
  const prodIdIdx = headers.indexOf("product_id");
  const taxClassIdx = headers.findIndex((h) => h === "tax_class" || h === "taxclass");
  const categoryIdx = headers.findIndex((h) => h === "category" || h === "tax_category");
  const hsnIdx = headers.indexOf("hsn_code");
  const descIdx = headers.indexOf("description");
  const rateModeIdx = headers.indexOf("rate_mode");
  const rateIdx = headers.indexOf("gst_rate");
  const valueBandsIdx = headers.indexOf("value_bands");
  const minPriceIdx = headers.indexOf("min_price");
  const maxPriceIdx = headers.indexOf("max_price");
  const fromIdx = headers.indexOf("effective_from");
  const toIdx = headers.indexOf("effective_to");
  const notesIdx = headers.indexOf("notes");

  const rowValidations: CsvImportRowValidation[] = [];
  const validBatchEntries: ProductTaxMasterEntry[] = [];
  let hasOverlaps = false;

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;

    const cleanCols = rawLine.split(",").map((c) => c.replace(/^"|"$/g, "").trim());

    let scope_type: TaxRuleScope | undefined =
      scopeTypeIdx >= 0 && cleanCols[scopeTypeIdx]
        ? (cleanCols[scopeTypeIdx].toUpperCase() as TaxRuleScope)
        : undefined;
    let scope_value = scopeValueIdx >= 0 && cleanCols[scopeValueIdx] ? cleanCols[scopeValueIdx] : "";
    const sku = skuIdx >= 0 && cleanCols[skuIdx] ? cleanCols[skuIdx] : "";
    const product_id = prodIdIdx >= 0 && cleanCols[prodIdIdx] ? cleanCols[prodIdIdx] : "";
    const tax_class = taxClassIdx >= 0 && cleanCols[taxClassIdx] ? cleanCols[taxClassIdx] : "";
    const category = categoryIdx >= 0 && cleanCols[categoryIdx] ? cleanCols[categoryIdx] : "";
    const hsn_code = hsnIdx >= 0 && cleanCols[hsnIdx] ? cleanCols[hsnIdx] : "";
    const description = descIdx >= 0 && cleanCols[descIdx] ? cleanCols[descIdx] : "";
    const rate_mode: TaxRateMode =
      rateModeIdx >= 0 && cleanCols[rateModeIdx]?.toUpperCase() === "VALUE_BAND" ? "VALUE_BAND" : "FIXED";
    const gst_rate_str = rateIdx >= 0 && cleanCols[rateIdx] ? cleanCols[rateIdx] : "";
    const gst_rate = parseFloat(gst_rate_str);
    const value_bands_str = valueBandsIdx >= 0 && cleanCols[valueBandsIdx] ? cleanCols[valueBandsIdx] : "";
    const effective_from = fromIdx >= 0 && cleanCols[fromIdx] ? cleanCols[fromIdx] : new Date().toISOString();
    const effective_to = toIdx >= 0 && cleanCols[toIdx] ? cleanCols[toIdx] : null;
    const notes = notesIdx >= 0 && cleanCols[notesIdx] ? cleanCols[notesIdx] : "";

    const rowErrors: string[] = [];

    // Derive scope if not explicitly specified
    if (!scope_type || !scope_value) {
      if (sku) { scope_type = "SKU"; scope_value = sku; }
      else if (product_id) { scope_type = "PRODUCT"; scope_value = product_id; }
      else if (tax_class) { scope_type = "TAX_CLASS"; scope_value = tax_class; }
      else if (category) { scope_type = "CATEGORY"; scope_value = category; }
      else { scope_type = "DEFAULT"; scope_value = "DEFAULT"; }
    }

    if (!hsn_code) {
      rowErrors.push("Missing required field 'hsn_code'.");
    } else if (!HSN_REGEX.test(hsn_code)) {
      rowErrors.push(`Invalid HSN code '${hsn_code}'. Must be 4 to 8 digits.`);
    }

    let parsedValueBands: TaxValueBand[] | undefined = undefined;
    if (rate_mode === "VALUE_BAND") {
      if (minPriceIdx >= 0 && cleanCols[minPriceIdx] !== undefined && cleanCols[minPriceIdx] !== "") {
        const minP = parseFloat(cleanCols[minPriceIdx]) || 0;
        const maxPStr = maxPriceIdx >= 0 ? cleanCols[maxPriceIdx] : "";
        const maxP = maxPStr && maxPStr !== "null" && maxPStr !== "inf" ? parseFloat(maxPStr) : null;
        const bandRate = !isNaN(gst_rate) ? gst_rate : parseFloat(description) || 0;
        parsedValueBands = [{ min_price: minP, max_price: maxP, gst_rate: bandRate }];
      } else if (!value_bands_str) {
        rowErrors.push("Rate mode is VALUE_BAND but missing 'value_bands'.");
      } else {
        try {
          if (value_bands_str.startsWith("[")) {
            parsedValueBands = JSON.parse(value_bands_str);
          } else {
            // Pipe-separated format: "0-1000:5|1001-null:12"
            parsedValueBands = value_bands_str.split("|").map((part) => {
              const [range, r] = part.split(":");
              const [minP, maxP] = range.split("-");
              return {
                min_price: parseFloat(minP) || 0,
                max_price: maxP === "null" || maxP === "inf" || !maxP ? null : parseFloat(maxP),
                gst_rate: parseFloat(r) || 0
              };
            });
          }
        } catch (e) {
          rowErrors.push(`Invalid value_bands format '${value_bands_str}'.`);
        }
      }
    } else {
      if (isNaN(gst_rate)) {
        rowErrors.push("Missing or non-numeric 'gst_rate'.");
      } else if (gst_rate < 0 || gst_rate > 100) {
        rowErrors.push(`Invalid GST rate '${gst_rate}'. Must be between 0% and 100%.`);
      }
    }

    if (isNaN(new Date(effective_from).getTime())) {
      rowErrors.push(`Invalid effective_from date '${effective_from}'.`);
    }

    if (effective_to && isNaN(new Date(effective_to).getTime())) {
      rowErrors.push(`Invalid effective_to date '${effective_to}'.`);
    }

    const entryCandidate: ProductTaxMasterEntry = {
      tax_record_id: `import_row_${i}`,
      scope_type,
      scope_value,
      sku: sku || (scope_type === "SKU" ? scope_value : undefined),
      product_id: product_id || (scope_type === "PRODUCT" ? scope_value : undefined),
      tax_class: tax_class || (scope_type === "TAX_CLASS" ? scope_value : undefined),
      tax_category: category || (scope_type === "CATEGORY" ? scope_value : undefined),
      hsn_code,
      description,
      rate_mode,
      gst_rate: rate_mode === "FIXED" ? gst_rate : undefined,
      value_bands: parsedValueBands,
      effective_from,
      effective_to: effective_to || null,
      status: "ACTIVE",
      notes
    };

    if (rowErrors.length === 0) {
      const dbOverlapCheck = checkProductTaxDateOverlap(existingEntries, entryCandidate);
      if (dbOverlapCheck.overlap) {
        rowErrors.push(dbOverlapCheck.error || "Date range overlaps with existing database rule.");
        hasOverlaps = true;
      }

      const batchOverlapCheck = checkProductTaxDateOverlap(validBatchEntries, entryCandidate);
      if (batchOverlapCheck.overlap) {
        rowErrors.push(`Intra-batch date range overlap: ${batchOverlapCheck.error}`);
        hasOverlaps = true;
      }
    }

    const isValid = rowErrors.length === 0;
    if (isValid) {
      validBatchEntries.push(entryCandidate);
    }

    rowValidations.push({
      row_number: i,
      valid: isValid,
      errors: rowErrors,
      data: entryCandidate
    });
  }

  const validRowsCount = rowValidations.filter((r) => r.valid).length;
  const invalidRowsCount = rowValidations.length - validRowsCount;
  const errorsList: Array<{ row_number: number; message: string; errors: string[] }> = [];
  rowValidations.forEach((r) => {
    if (!r.valid && r.errors) {
      errorsList.push({
        row_number: r.row_number,
        message: r.errors.join("; "),
        errors: r.errors
      });
    }
  });

  // Group VALUE_BAND entries by scope_type + scope_value + hsn_code
  const groupedRecordsMap = new Map<string, ProductTaxMasterEntry>();
  const finalRecords: ProductTaxMasterEntry[] = [];

  for (const entry of validBatchEntries) {
    if (entry.rate_mode === "VALUE_BAND") {
      const key = `${entry.scope_type}:${entry.scope_value}:${entry.hsn_code}`;
      if (groupedRecordsMap.has(key)) {
        const existing = groupedRecordsMap.get(key)!;
        existing.value_bands = [...(existing.value_bands || []), ...(entry.value_bands || [])];
      } else {
        const clone = { ...entry, value_bands: [...(entry.value_bands || [])] };
        groupedRecordsMap.set(key, clone);
        finalRecords.push(clone);
      }
    } else {
      finalRecords.push(entry);
    }
  }

  return {
    total_rows: rowValidations.length,
    valid_rows: validRowsCount,
    invalid_rows: invalidRowsCount,
    valid_count: validRowsCount,
    error_count: invalidRowsCount,
    records: finalRecords,
    errors: errorsList,
    has_overlaps: hasOverlaps,
    rows: rowValidations
  };
}
