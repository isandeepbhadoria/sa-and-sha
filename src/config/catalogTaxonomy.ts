/**
 * Sa and Sha — Centralized Catalog Merchandising Taxonomy
 *
 * Defines canonical collections, product types, sub-types, material types,
 * valid matrix combinations, selectable tax class options, and validation
 * rules.
 *
 * Product categories reflect Sa and Sha's actual merchandising plan:
 * Dresses, Top & Shirts, Shorts & Skirts, Co-Ord Sets, Trousers, Jackets,
 * Bags & Pouches. "Top & Shirts" and "Shorts & Skirts" are further split
 * into sub-types (tops/shirts, shorts/skirts) for filtering.
 *
 * CRITICAL INVARIANTS:
 * 1. Merchandising taxonomy is independent from statutory GST classification.
 * 2. tax_class links a product to Product Tax Master, NOT directly to HSN/GST rates.
 * 3. HSN codes and GST rates are NEVER derived from merchandising categories or tax_class in this catalog layer.
 * 4. Legacy fields (category, subCategory) remain supported for backward compatibility.
 */

import { products } from '../data';

export type MerchandisingCollectionId =
  | 'apparel'
  | 'accessories';

export type ProductTypeId =
  | 'dresses'
  | 'tops-shirts'
  | 'shorts-skirts'
  | 'co-ord-sets'
  | 'trousers'
  | 'jackets'
  | 'bags-pouches';

export type ProductSubTypeId =
  | 'tops'
  | 'shirts'
  | 'shorts'
  | 'skirts';

export type MaterialTypeId =
  | 'cotton'
  | 'linen-cotton-blend'
  | 'georgette'
  | 'other';

export interface TaxonomyItem<T extends string = string> {
  id: T;
  label: string;
  shortLabel?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// 1. CANONICAL COLLECTIONS
// ---------------------------------------------------------------------------
export const CANONICAL_COLLECTIONS: readonly TaxonomyItem<MerchandisingCollectionId>[] = [
  {
    id: 'apparel',
    label: 'Apparel',
    shortLabel: 'Apparel',
    description: 'Dresses, tops, shirts, shorts, skirts, co-ord sets, trousers, and jackets'
  },
  {
    id: 'accessories',
    label: 'Accessories',
    shortLabel: 'Accessories',
    description: 'Bags and pouches'
  }
] as const;

// ---------------------------------------------------------------------------
// 2. CANONICAL PRODUCT TYPES
// ---------------------------------------------------------------------------
export const CANONICAL_PRODUCT_TYPES: readonly TaxonomyItem<ProductTypeId>[] = [
  { id: 'dresses', label: 'Dresses' },
  { id: 'tops-shirts', label: 'Top & Shirts' },
  { id: 'shorts-skirts', label: 'Shorts & Skirts' },
  { id: 'co-ord-sets', label: 'Co-Ord Sets' },
  { id: 'trousers', label: 'Trousers' },
  { id: 'jackets', label: 'Jackets' },
  { id: 'bags-pouches', label: 'Bags & Pouches' }
] as const;

// ---------------------------------------------------------------------------
// 3. CANONICAL PRODUCT SUB-TYPES
// ---------------------------------------------------------------------------
export const CANONICAL_PRODUCT_SUB_TYPES: readonly TaxonomyItem<ProductSubTypeId>[] = [
  { id: 'tops', label: 'Tops' },
  { id: 'shirts', label: 'Shirts' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'skirts', label: 'Skirts' }
] as const;

// ---------------------------------------------------------------------------
// 4. CANONICAL MATERIAL TYPES
// ---------------------------------------------------------------------------
export const CANONICAL_MATERIAL_TYPES: readonly TaxonomyItem<MaterialTypeId>[] = [
  { id: 'cotton', label: 'Cotton' },
  { id: 'linen-cotton-blend', label: 'Linen-Cotton Blend' },
  { id: 'georgette', label: 'Georgette' },
  { id: 'other', label: 'Other' }
] as const;

// ---------------------------------------------------------------------------
// 5. VALID COLLECTION × PRODUCT TYPE MATRIX
// ---------------------------------------------------------------------------
export const COLLECTION_PRODUCT_TYPE_MATRIX: Record<MerchandisingCollectionId, readonly ProductTypeId[]> = {
  'apparel': ['dresses', 'tops-shirts', 'shorts-skirts', 'co-ord-sets', 'trousers', 'jackets'],
  'accessories': ['bags-pouches']
} as const;

// ---------------------------------------------------------------------------
// 6. VALID PRODUCT TYPE × SUB-TYPE MATRIX
// ---------------------------------------------------------------------------
export const PRODUCT_TYPE_SUBTYPES_MATRIX: Partial<Record<ProductTypeId, readonly ProductSubTypeId[]>> = {
  'tops-shirts': ['tops', 'shirts'],
  'shorts-skirts': ['shorts', 'skirts']
} as const;

// ---------------------------------------------------------------------------
// 7. SELECTABLE TAX CLASS KEYS (INTERNAL TAX MASTER CLASSIFIERS)
// ---------------------------------------------------------------------------
export interface TaxClassOption {
  id: string;
  label: string;
  description?: string;
}

export const SELECTABLE_TAX_CLASSES: readonly TaxClassOption[] = [
  { id: 'womens_dress', label: "Women's Dress (womens_dress)" },
  { id: 'womens_top_shirt', label: "Women's Top / Shirt (womens_top_shirt)" },
  { id: 'womens_shorts_skirt', label: "Women's Shorts / Skirt (womens_shorts_skirt)" },
  { id: 'womens_coord_set', label: "Women's Co-ord Set (womens_coord_set)" },
  { id: 'womens_trouser', label: "Women's Trouser (womens_trouser)" },
  { id: 'womens_jacket', label: "Women's Jacket (womens_jacket)" },
  { id: 'bags_pouches', label: "Bags & Pouches (bags_pouches)" },
  { id: 'accessories_general', label: "Accessories / General (accessories_general)" }
] as const;

// ---------------------------------------------------------------------------
// 8. TAXONOMY VALIDATION AND LOOKUP HELPERS
// ---------------------------------------------------------------------------

/**
 * Checks if a given collection ID is recognized.
 */
export function isValidCollection(id?: string): boolean {
  if (!id) return false;
  return CANONICAL_COLLECTIONS.some(c => c.id === id);
}

/**
 * Checks if a given product type ID is recognized.
 */
export function isValidProductType(id?: string): boolean {
  if (!id) return false;
  return CANONICAL_PRODUCT_TYPES.some(pt => pt.id === id);
}

/**
 * Checks if a given product sub-type ID is recognized.
 */
export function isValidProductSubType(id?: string): boolean {
  if (!id) return false;
  return CANONICAL_PRODUCT_SUB_TYPES.some(st => st.id === id);
}

/**
 * Checks if a given material type ID is recognized.
 */
export function isValidMaterialType(id?: string): boolean {
  if (!id) return false;
  return CANONICAL_MATERIAL_TYPES.some(mt => mt.id === id);
}

/**
 * Checks if a collection and product type combination is catalog-valid.
 */
export function isValidCollectionProductType(collection?: string, productType?: string): boolean {
  if (!collection || !productType) return false;
  const validTypes = COLLECTION_PRODUCT_TYPE_MATRIX[collection as MerchandisingCollectionId];
  if (!validTypes) return false;
  return validTypes.includes(productType as ProductTypeId);
}

/**
 * Checks if a sub-type is valid for the given product type.
 */
export function isValidProductSubTypeForType(productType?: string, productSubType?: string): boolean {
  if (!productSubType) return true; // Optional by design
  if (!productType) return false;
  const validSubTypes = PRODUCT_TYPE_SUBTYPES_MATRIX[productType as ProductTypeId];
  if (!validSubTypes) return false;
  return validSubTypes.includes(productSubType as ProductSubTypeId);
}

/**
 * Returns available product types for a chosen collection (or all if none chosen).
 */
export function getAvailableProductTypesForCollection(collection?: string): readonly TaxonomyItem<ProductTypeId>[] {
  if (!collection || !isValidCollection(collection)) {
    return CANONICAL_PRODUCT_TYPES;
  }
  const allowed = COLLECTION_PRODUCT_TYPE_MATRIX[collection as MerchandisingCollectionId] || [];
  return CANONICAL_PRODUCT_TYPES.filter(pt => allowed.includes(pt.id));
}

/**
 * Returns available sub-types for a chosen product type.
 */
export function getAvailableSubTypesForProductType(productType?: string): readonly TaxonomyItem<ProductSubTypeId>[] {
  if (!productType) return [];
  const allowed = PRODUCT_TYPE_SUBTYPES_MATRIX[productType as ProductTypeId] || [];
  return CANONICAL_PRODUCT_SUB_TYPES.filter(st => allowed.includes(st.id));
}

export interface TaxonomyValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a product's merchandising taxonomy settings.
 * Supports legacy products where taxonomy fields are undefined.
 */
export function validateProductTaxonomy(data: {
  collection?: string;
  productType?: string;
  productSubType?: string;
  materialType?: string;
  tax_class?: string;
}): TaxonomyValidationResult {
  const errors: string[] = [];

  // 1. Collection validation
  if (data.collection !== undefined && data.collection !== '') {
    if (!isValidCollection(data.collection)) {
      errors.push(`Invalid collection: "${data.collection}". Must be one of: ${CANONICAL_COLLECTIONS.map(c => c.id).join(', ')}`);
    }
  }

  // 2. Product Type validation
  if (data.productType !== undefined && data.productType !== '') {
    if (!isValidProductType(data.productType)) {
      errors.push(`Invalid productType: "${data.productType}". Must be one of: ${CANONICAL_PRODUCT_TYPES.map(pt => pt.id).join(', ')}`);
    }
  }

  // 3. Collection × Product Type Matrix validation
  if (data.collection && data.productType) {
    if (isValidCollection(data.collection) && isValidProductType(data.productType)) {
      if (!isValidCollectionProductType(data.collection, data.productType)) {
        errors.push(`Product type "${data.productType}" is not valid within collection "${data.collection}".`);
      }
    }
  }

  // 4. Product SubType validation
  if (data.productSubType !== undefined && data.productSubType !== '') {
    if (!isValidProductSubType(data.productSubType)) {
      errors.push(`Invalid productSubType: "${data.productSubType}". Must be one of: ${CANONICAL_PRODUCT_SUB_TYPES.map(st => st.id).join(', ')}`);
    } else if (data.productType && !isValidProductSubTypeForType(data.productType, data.productSubType)) {
      errors.push(`Product sub-type "${data.productSubType}" is not valid for product type "${data.productType}".`);
    }
  }

  // 5. Material Type validation
  if (data.materialType !== undefined && data.materialType !== '') {
    if (!isValidMaterialType(data.materialType)) {
      errors.push(`Invalid materialType: "${data.materialType}". Must be one of: ${CANONICAL_MATERIAL_TYPES.map(mt => mt.id).join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// ---------------------------------------------------------------------------
// 9. SUBTYPE URL SLUG MAPPINGS
// ---------------------------------------------------------------------------
export function resolveSubtypeFromSlug(productType: string, subTypeSlug: string): ProductSubTypeId | null {
  if (productType === 'tops-shirts') {
    if (subTypeSlug === 'tops') return 'tops';
    if (subTypeSlug === 'shirts') return 'shirts';
  }
  if (productType === 'shorts-skirts') {
    if (subTypeSlug === 'shorts') return 'shorts';
    if (subTypeSlug === 'skirts') return 'skirts';
  }
  return null;
}

export function getSubtypeUrlSlug(productSubType: ProductSubTypeId): string {
  return productSubType;
}

// ---------------------------------------------------------------------------
// 10. CANONICAL STOREFRONT TAXONOMY ROUTE RESOLVER
// ---------------------------------------------------------------------------
export interface TaxonomyRouteInfo {
  isValid: boolean;
  isComingSoon: boolean;
  title: string;
  h1: string;
  metaDescription: string;
  canonicalPath: string;
  canonicalUrl: string;
  breadcrumbs: Array<{ name: string; url?: string }>;
  filterCollection?: MerchandisingCollectionId;
  filterProductType?: ProductTypeId;
  filterProductSubType?: ProductSubTypeId;
  curatedType?: 'all' | 'bestsellers' | 'new-arrivals';
}

const SITE_BASE_URL = 'https://www.sa-and-sha.com';
const SITE_NAME = 'Sa and Sha';

function isProductLive(p: { status?: string; isDecommissioned?: boolean }): boolean {
  return p.status !== 'archived' && p.status !== 'draft' && !p.isDecommissioned;
}

function hasActiveInventoryForProductType(productTypeId: string): boolean {
  return products.some(p => p.productType === productTypeId && isProductLive(p));
}

function hasActiveInventoryForCollection(collectionId: string): boolean {
  return products.some(p => p.collection === collectionId && isProductLive(p));
}

export function getTaxonomyRouteInfo(params: {
  collectionId?: string;
  productTypeId?: string;
  subTypeSlug?: string;
  curatedSlug?: string;
}): TaxonomyRouteInfo {
  const { collectionId, productTypeId, subTypeSlug, curatedSlug } = params;

  // 1. Curated or standalone category routes
  if (curatedSlug) {
    if (curatedSlug === 'all') {
      return {
        isValid: true,
        isComingSoon: false,
        title: `Shop All Women's Apparel | ${SITE_NAME}`,
        h1: "Shop All Products",
        metaDescription: `Explore the complete ${SITE_NAME} collection of dresses, tops & shirts, shorts & skirts, co-ord sets, trousers, jackets, and bags & pouches.`,
        canonicalPath: "/shop/all",
        canonicalUrl: `${SITE_BASE_URL}/shop/all`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Shop All' }],
        curatedType: 'all'
      };
    }
    if (curatedSlug === 'bestsellers') {
      return {
        isValid: true,
        isComingSoon: false,
        title: `Bestselling Women's Apparel | ${SITE_NAME}`,
        h1: "Bestsellers",
        metaDescription: `Discover our most-loved dresses, tops, and co-ord sets, favored by ${SITE_NAME} customers.`,
        canonicalPath: "/shop/bestsellers",
        canonicalUrl: `${SITE_BASE_URL}/shop/bestsellers`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Bestsellers' }],
        curatedType: 'bestsellers'
      };
    }
    if (curatedSlug === 'new-arrivals') {
      return {
        isValid: true,
        isComingSoon: false,
        title: `New Arrivals | ${SITE_NAME}`,
        h1: "Fresh Arrivals",
        metaDescription: "Explore the newest seasonal arrivals across dresses, co-ord sets, and jackets.",
        canonicalPath: "/shop/new-arrivals",
        canonicalUrl: `${SITE_BASE_URL}/shop/new-arrivals`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'New Arrivals' }],
        curatedType: 'new-arrivals'
      };
    }

    // Invalid curated slug
    return {
      isValid: false,
      isComingSoon: false,
      title: `Page Not Found | ${SITE_NAME}`,
      h1: "Item Not Found",
      metaDescription: "The page you requested is not available in our catalog.",
      canonicalPath: "/404",
      canonicalUrl: `${SITE_BASE_URL}/404`,
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Not Found' }]
    };
  }

  // 2. Collection + Product Intersection Route: /shop/collection/:collectionId/:productTypeId
  if (collectionId && productTypeId) {
    if (!isValidCollection(collectionId) || !isValidProductType(productTypeId) || !isValidCollectionProductType(collectionId, productTypeId)) {
      return {
        isValid: false,
        isComingSoon: false,
        title: `Page Not Found | ${SITE_NAME}`,
        h1: "Item Not Found",
        metaDescription: "The requested category combination does not exist.",
        canonicalPath: "/404",
        canonicalUrl: `${SITE_BASE_URL}/404`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Not Found' }]
      };
    }

    const collItem = CANONICAL_COLLECTIONS.find(c => c.id === collectionId)!;
    const typeItem = CANONICAL_PRODUCT_TYPES.find(p => p.id === productTypeId)!;

    const hasActiveInventory = products.some(
      p => p.collection === collectionId && p.productType === productTypeId && isProductLive(p)
    );

    const h1 = `${collItem.label} ${typeItem.label}`;
    const title = `${h1} | ${SITE_NAME}`;
    const metaDescription = `Explore our collection of ${typeItem.label.toLowerCase()}, designed for everyday elegance.`;

    return {
      isValid: true,
      isComingSoon: !hasActiveInventory,
      title,
      h1,
      metaDescription,
      canonicalPath: `/shop/collection/${collectionId}/${productTypeId}`,
      canonicalUrl: `${SITE_BASE_URL}/shop/collection/${collectionId}/${productTypeId}`,
      breadcrumbs: [
        { name: 'Home', url: '/' },
        { name: collItem.label, url: `/shop/collection/${collectionId}` },
        { name: typeItem.label }
      ],
      filterCollection: collectionId as MerchandisingCollectionId,
      filterProductType: productTypeId as ProductTypeId
    };
  }

  // 3. Collection Route Only: /shop/collection/:collectionId
  if (collectionId) {
    if (!isValidCollection(collectionId)) {
      return {
        isValid: false,
        isComingSoon: false,
        title: `Page Not Found | ${SITE_NAME}`,
        h1: "Item Not Found",
        metaDescription: "The collection you requested is not recognized.",
        canonicalPath: "/404",
        canonicalUrl: `${SITE_BASE_URL}/404`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Not Found' }]
      };
    }

    const collItem = CANONICAL_COLLECTIONS.find(c => c.id === collectionId)!;
    const isComingSoon = !hasActiveInventoryForCollection(collectionId);

    const title = `${collItem.label} | ${SITE_NAME}`;
    const h1 = collItem.label;
    const metaDescription = collItem.description;

    return {
      isValid: true,
      isComingSoon,
      title,
      h1,
      metaDescription,
      canonicalPath: `/shop/collection/${collectionId}`,
      canonicalUrl: `${SITE_BASE_URL}/shop/collection/${collectionId}`,
      breadcrumbs: [
        { name: 'Home', url: '/' },
        { name: 'Collections', url: '/shop' },
        { name: collItem.label }
      ],
      filterCollection: collectionId as MerchandisingCollectionId
    };
  }

  // 4. Product SubType Route: /shop/product/:productTypeId/:subTypeSlug
  if (productTypeId && subTypeSlug) {
    if (!isValidProductType(productTypeId)) {
      return {
        isValid: false,
        isComingSoon: false,
        title: `Page Not Found | ${SITE_NAME}`,
        h1: "Item Not Found",
        metaDescription: "Invalid product type.",
        canonicalPath: "/404",
        canonicalUrl: `${SITE_BASE_URL}/404`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Not Found' }]
      };
    }

    const resolvedSubType = resolveSubtypeFromSlug(productTypeId, subTypeSlug);
    if (!resolvedSubType || !isValidProductSubTypeForType(productTypeId, resolvedSubType)) {
      return {
        isValid: false,
        isComingSoon: false,
        title: `Page Not Found | ${SITE_NAME}`,
        h1: "Item Not Found",
        metaDescription: "Invalid product subtype.",
        canonicalPath: "/404",
        canonicalUrl: `${SITE_BASE_URL}/404`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Not Found' }]
      };
    }

    const typeItem = CANONICAL_PRODUCT_TYPES.find(p => p.id === productTypeId)!;
    const subTypeItem = CANONICAL_PRODUCT_SUB_TYPES.find(st => st.id === resolvedSubType)!;
    const canonicalSlug = getSubtypeUrlSlug(resolvedSubType);

    const h1 = subTypeItem.label;
    const title = `${subTypeItem.label} | ${SITE_NAME}`;
    const metaDescription = `Explore our collection of ${subTypeItem.label.toLowerCase()} designed for everyday elegance.`;
    const isComingSoon = !products.some(
      p => p.productType === productTypeId && p.productSubType === resolvedSubType && isProductLive(p)
    );

    return {
      isValid: true,
      isComingSoon,
      title,
      h1,
      metaDescription,
      canonicalPath: `/shop/product/${productTypeId}/${canonicalSlug}`,
      canonicalUrl: `${SITE_BASE_URL}/shop/product/${productTypeId}/${canonicalSlug}`,
      breadcrumbs: [
        { name: 'Home', url: '/' },
        { name: 'Products', url: '/shop' },
        { name: typeItem.label, url: `/shop/product/${productTypeId}` },
        { name: subTypeItem.label }
      ],
      filterProductType: productTypeId as ProductTypeId,
      filterProductSubType: resolvedSubType
    };
  }

  // 5. Product Type Route Only: /shop/product/:productTypeId
  if (productTypeId) {
    if (!isValidProductType(productTypeId)) {
      return {
        isValid: false,
        isComingSoon: false,
        title: `Page Not Found | ${SITE_NAME}`,
        h1: "Item Not Found",
        metaDescription: "Invalid product type.",
        canonicalPath: "/404",
        canonicalUrl: `${SITE_BASE_URL}/404`,
        breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Not Found' }]
      };
    }

    const typeItem = CANONICAL_PRODUCT_TYPES.find(p => p.id === productTypeId)!;
    const hasActiveInventory = hasActiveInventoryForProductType(productTypeId);

    const h1 = typeItem.label;
    const title = `${typeItem.label} | ${SITE_NAME}`;
    const metaDescription = `Explore our collection of ${typeItem.label.toLowerCase()} designed for everyday elegance.`;

    return {
      isValid: true,
      isComingSoon: !hasActiveInventory,
      title,
      h1,
      metaDescription,
      canonicalPath: `/shop/product/${productTypeId}`,
      canonicalUrl: `${SITE_BASE_URL}/shop/product/${productTypeId}`,
      breadcrumbs: [
        { name: 'Home', url: '/' },
        { name: 'Products', url: '/shop' },
        { name: typeItem.label }
      ],
      filterProductType: productTypeId as ProductTypeId
    };
  }

  // Default: All products
  return {
    isValid: true,
    isComingSoon: false,
    title: `Shop All Women's Apparel | ${SITE_NAME}`,
    h1: "Shop All Products",
    metaDescription: `Explore the complete ${SITE_NAME} collection of dresses, tops & shirts, shorts & skirts, co-ord sets, trousers, jackets, and bags & pouches.`,
    canonicalPath: "/shop/all",
    canonicalUrl: `${SITE_BASE_URL}/shop/all`,
    breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'Shop All' }],
    curatedType: 'all'
  };
}
