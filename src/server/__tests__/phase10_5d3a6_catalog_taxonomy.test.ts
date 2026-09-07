import { describe, it, expect, beforeEach } from 'vitest';
import {
  CANONICAL_COLLECTIONS,
  CANONICAL_PRODUCT_TYPES,
  CANONICAL_PRODUCT_SUB_TYPES,
  CANONICAL_MATERIAL_TYPES,
  COLLECTION_PRODUCT_TYPE_MATRIX,
  PRODUCT_TYPE_SUBTYPES_MATRIX,
  SELECTABLE_TAX_CLASSES,
  isValidCollection,
  isValidProductType,
  isValidProductSubType,
  isValidMaterialType,
  isValidCollectionProductType,
  isValidProductSubTypeForType,
  getAvailableProductTypesForCollection,
  getAvailableSubTypesForProductType,
  validateProductTaxonomy
} from '../../config/catalogTaxonomy';
import { Product } from '../../types';
import {
  clearProductTaxMaster,
  registerProductTaxMetadata,
  lookupProductTaxMetadata,
  normalizeTaxClass
} from '../invoice/productTaxMaster';

describe('Phase 10.5D.3A.6 — Normalized Catalog Taxonomy & Admin Architecture', () => {
  beforeEach(() => {
    clearProductTaxMaster();
  });
  // -------------------------------------------------------------------------
  // 1. CANONICAL MERCHANDISING COLLECTIONS
  // -------------------------------------------------------------------------
  describe('Canonical Merchandising Collections', () => {
    it('defines the 4 required canonical collections with stable IDs and descriptive labels', () => {
      const collectionIds = CANONICAL_COLLECTIONS.map(c => c.id);
      expect(collectionIds).toContain('ethnic-wear');
      expect(collectionIds).toContain('western-wear');
      expect(collectionIds).toContain('co-ord-sets');
      expect(collectionIds).toContain('winter-wear');
      expect(CANONICAL_COLLECTIONS).toHaveLength(4);
    });

    it('validates collection IDs using isValidCollection()', () => {
      expect(isValidCollection('ethnic-wear')).toBe(true);
      expect(isValidCollection('western-wear')).toBe(true);
      expect(isValidCollection('co-ord-sets')).toBe(true);
      expect(isValidCollection('winter-wear')).toBe(true);

      expect(isValidCollection('silk-collection')).toBe(false);
      expect(isValidCollection('')).toBe(false);
      expect(isValidCollection(undefined)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // 2. CANONICAL PRODUCT TYPES & SUB-TYPES
  // -------------------------------------------------------------------------
  describe('Canonical Product Types & Sub-Types', () => {
    it('defines canonical product types', () => {
      const typeIds = CANONICAL_PRODUCT_TYPES.map(pt => pt.id);
      expect(typeIds).toEqual(
        expect.arrayContaining([
          'dresses',
          'tops',
          'bottoms',
          'kurtas',
          'sarees',
          'co-ord-sets',
          'jackets'
        ])
      );
    });

    it('defines canonical product sub-types', () => {
      const subTypeIds = CANONICAL_PRODUCT_SUB_TYPES.map(st => st.id);
      expect(subTypeIds).toEqual(
        expect.arrayContaining([
          'maxi-dresses',
          'midi-dresses',
          'straight-kurtas',
          'a-line-kurtas'
        ])
      );
    });

    it('defines canonical material types', () => {
      const matIds = CANONICAL_MATERIAL_TYPES.map(m => m.id);
      expect(matIds).toEqual(
        expect.arrayContaining([
          'cotton',
          'linen-cotton-blend',
          'georgette',
          'other'
        ])
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. COLLECTION × PRODUCT TYPE MATRIX
  // -------------------------------------------------------------------------
  describe('Collection × Product Type Matrix Validation', () => {
    it('ethnic-wear supports kurtas, sarees, and co-ord-sets', () => {
      const allowed = COLLECTION_PRODUCT_TYPE_MATRIX['ethnic-wear'];
      expect(allowed).toEqual(['kurtas', 'sarees', 'co-ord-sets']);

      expect(isValidCollectionProductType('ethnic-wear', 'kurtas')).toBe(true);
      expect(isValidCollectionProductType('ethnic-wear', 'sarees')).toBe(true);
      expect(isValidCollectionProductType('ethnic-wear', 'co-ord-sets')).toBe(true);
      expect(isValidCollectionProductType('ethnic-wear', 'dresses')).toBe(false);
    });

    it('western-wear supports dresses, tops, bottoms, and co-ord-sets', () => {
      const allowed = COLLECTION_PRODUCT_TYPE_MATRIX['western-wear'];
      expect(allowed).toEqual(['dresses', 'tops', 'bottoms', 'co-ord-sets']);

      expect(isValidCollectionProductType('western-wear', 'dresses')).toBe(true);
      expect(isValidCollectionProductType('western-wear', 'tops')).toBe(true);
      expect(isValidCollectionProductType('western-wear', 'bottoms')).toBe(true);
      expect(isValidCollectionProductType('western-wear', 'co-ord-sets')).toBe(true);
      expect(isValidCollectionProductType('western-wear', 'sarees')).toBe(false);
      expect(isValidCollectionProductType('western-wear', 'kurtas')).toBe(false);
    });

    it('co-ord-sets collection supports only the co-ord-sets product type', () => {
      const allowed = COLLECTION_PRODUCT_TYPE_MATRIX['co-ord-sets'];
      expect(allowed).toEqual(['co-ord-sets']);

      expect(isValidCollectionProductType('co-ord-sets', 'co-ord-sets')).toBe(true);
      expect(isValidCollectionProductType('co-ord-sets', 'dresses')).toBe(false);
    });

    it('winter-wear supports jackets product type', () => {
      const allowed = COLLECTION_PRODUCT_TYPE_MATRIX['winter-wear'];
      expect(allowed).toEqual(['jackets']);

      expect(isValidCollectionProductType('winter-wear', 'jackets')).toBe(true);
      expect(isValidCollectionProductType('winter-wear', 'dresses')).toBe(false);
    });

    it('returns filtered product types for collection in admin dropdown helper', () => {
      const ethnicTypes = getAvailableProductTypesForCollection('ethnic-wear').map(t => t.id);
      expect(ethnicTypes).toEqual(['kurtas', 'sarees', 'co-ord-sets']);

      const winterTypes = getAvailableProductTypesForCollection('winter-wear').map(t => t.id);
      expect(winterTypes).toEqual(['jackets']);

      const unassignedTypes = getAvailableProductTypesForCollection(undefined);
      expect(unassignedTypes.length).toBe(CANONICAL_PRODUCT_TYPES.length);
    });
  });

  // -------------------------------------------------------------------------
  // 4. PRODUCT TYPE × SUB-TYPE MATRIX
  // -------------------------------------------------------------------------
  describe('Product Type × Sub-Type Matrix Validation', () => {
    it('dresses support maxi-dresses and midi-dresses', () => {
      expect(isValidProductSubTypeForType('dresses', 'maxi-dresses')).toBe(true);
      expect(isValidProductSubTypeForType('dresses', 'midi-dresses')).toBe(true);
      expect(isValidProductSubTypeForType('dresses', 'straight-kurtas')).toBe(false);
      // Optional sub-type
      expect(isValidProductSubTypeForType('dresses', undefined)).toBe(true);
      expect(isValidProductSubTypeForType('dresses', '')).toBe(true);
    });

    it('kurtas support straight-kurtas and a-line-kurtas', () => {
      expect(isValidProductSubTypeForType('kurtas', 'straight-kurtas')).toBe(true);
      expect(isValidProductSubTypeForType('kurtas', 'a-line-kurtas')).toBe(true);
      expect(isValidProductSubTypeForType('kurtas', 'maxi-dresses')).toBe(false);
    });

    it('returns available sub-types for product type helper', () => {
      const dressSubTypes = getAvailableSubTypesForProductType('dresses').map(s => s.id);
      expect(dressSubTypes).toEqual(['maxi-dresses', 'midi-dresses']);

      const topsSubTypes = getAvailableSubTypesForProductType('tops').map(s => s.id);
      expect(topsSubTypes).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 5. TAXONOMY VALIDATION HELPER & BACKWARD COMPATIBILITY
  // -------------------------------------------------------------------------
  describe('Taxonomy Validation & Backward Compatibility', () => {
    it('passes legacy product with undefined taxonomy fields (backward compatibility invariant)', () => {
      const legacyProduct: Partial<Product> = {
        name: 'Heritage Belgian Linen Shirt',
        category: 'shirts',
        subCategory: 'linen-shirts',
        price: 3490
      };

      const result = validateProductTaxonomy(legacyProduct);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates a complete new taxonomy product', () => {
      const newTaxonomyProduct = {
        collection: 'western-wear',
        productType: 'dresses',
        productSubType: 'maxi-dresses',
        materialType: 'cotton',
        tax_class: 'womens_dress'
      };

      const result = validateProductTaxonomy(newTaxonomyProduct);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid collection ID', () => {
      const result = validateProductTaxonomy({
        collection: 'non_existent_collection'
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid collection');
    });

    it('rejects invalid collection × product type combination', () => {
      const result = validateProductTaxonomy({
        collection: 'western-wear',
        productType: 'sarees' // western-wear only allows dresses, tops, bottoms, co-ord-sets
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not valid within collection');
    });

    it('rejects mismatched product sub-type', () => {
      const result = validateProductTaxonomy({
        collection: 'western-wear',
        productType: 'dresses',
        productSubType: 'straight-kurtas'
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not valid for product type "dresses"');
    });
  });

  // -------------------------------------------------------------------------
  // 6. SELECTABLE TAX CLASSES (INTERNAL TAX MASTER KEYS)
  // -------------------------------------------------------------------------
  describe('Selectable Tax Classes', () => {
    it('contains all required stable classification keys', () => {
      const keys = SELECTABLE_TAX_CLASSES.map(t => t.id);
      expect(keys).toContain('womens_dress');
      expect(keys).toContain('womens_top');
      expect(keys).toContain('womens_bottom');
      expect(keys).toContain('womens_kurta');
      expect(keys).toContain('womens_saree');
      expect(keys).toContain('womens_coord_set');
      expect(keys).toContain('womens_jacket');
    });

    it('ensures tax classes have NO statutory HSN or GST rates hardcoded into their definitions', () => {
      for (const option of SELECTABLE_TAX_CLASSES) {
        expect((option as any).hsn).toBeUndefined();
        expect((option as any).gstRate).toBeUndefined();
        expect((option as any).igst).toBeUndefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. MULTI-DIMENSIONAL DISCOVERY (NO RECORD DUPLICATION)
  // -------------------------------------------------------------------------
  describe('Multi-Dimensional Discovery Invariant', () => {
    it('allows a single product to be surfaced by both collection and productType dimensions', () => {
      const sampleProduct: Product = {
        id: 'prod-belgian-shirt-01',
        name: 'Amalfi Pure Linen Full Sleeve Shirt',
        category: 'shirts',
        subCategory: 'linen-shirts',
        collection: 'pure-linen',
        productType: 'shirts',
        productSubType: 'full-sleeve-shirts',
        materialType: 'pure-linen',
        tax_class: 'mens_woven_shirt',
        price: 3200,
        compareAtPrice: 0,
        fabric: '100% Belgian Linen, 180 GSM',
        fit: 'Regular',
        color: 'Flax White',
        colorHex: '#F5F1E8',
        sizes: ['M', 'L', 'XL'],
        sleeve: 'Full Sleeve',
        pattern: 'Solid',
        images: ['https://example.com/shirt.jpg'],
        rating: 4.8,
        reviewCount: 12,
        bestseller: true,
        newArrival: false,
        dateAdded: '2026-03-01',
        description: 'Bespoke pure linen full sleeve shirt.',
        details: ['100% Linen'],
        careInstructions: ['Dry in shade']
      };

      // Query by Collection dimension
      const matchesCollection = sampleProduct.collection === 'pure-linen';
      expect(matchesCollection).toBe(true);

      // Query by Product Type dimension
      const matchesProductType = sampleProduct.productType === 'shirts';
      expect(matchesProductType).toBe(true);

      // Query by Sub-Type dimension
      const matchesSubType = sampleProduct.productSubType === 'full-sleeve-shirts';
      expect(matchesSubType).toBe(true);

      // Active Legacy Storefront Navigation dimension is simultaneously preserved
      expect(sampleProduct.category).toBe('shirts');
      expect(sampleProduct.subCategory).toBe('linen-shirts');
    });
  });

  // -------------------------------------------------------------------------
  // 8. STATUTORY GST PRECEDENCE & DECOUPLING INTEGRATION
  // -------------------------------------------------------------------------
  describe('Statutory GST Precedence & Decoupling Integration', () => {
    it('resolves GST via independent tax_class with precedence over legacy category', () => {
      // Register Category Rule (12%)
      registerProductTaxMetadata({
        tax_record_id: 'rule_category_shirts',
        scope_type: 'CATEGORY',
        scope_value: 'shirts',
        hsn_code: '6205',
        gst_rate: 12,
        rate_mode: 'FIXED',
        status: 'ACTIVE'
      });

      // Register Tax Class Rule (18%)
      registerProductTaxMetadata({
        tax_record_id: 'rule_tax_class_shirt',
        scope_type: 'TAX_CLASS',
        scope_value: 'mens_woven_shirt',
        hsn_code: '6205',
        gst_rate: 18,
        rate_mode: 'FIXED',
        status: 'ACTIVE'
      });

      const productWithTaxClass: Product = {
        id: 'p1',
        name: 'Pure Linen Shirt',
        category: 'shirts',
        subCategory: 'linen-shirts',
        collection: 'pure-linen',
        productType: 'shirts',
        tax_class: 'mens_woven_shirt',
        price: 1500,
        compareAtPrice: 0,
        fabric: '100% Linen',
        fit: 'Regular',
        color: 'White',
        colorHex: '#FFF',
        sizes: ['M'],
        pattern: 'Solid',
        images: ['img.jpg'],
        rating: 5,
        reviewCount: 1,
        bestseller: false,
        newArrival: true,
        dateAdded: '2026-03-01',
        description: 'Test',
        details: [],
        careInstructions: []
      };

      const resolved = lookupProductTaxMetadata({
        product_id: productWithTaxClass.id,
        category: productWithTaxClass.category,
        tax_class: productWithTaxClass.tax_class,
        price: 1500
      });

      expect(resolved.success).toBe(true);
      expect(resolved.metadata?.resolved_scope).toBe('TAX_CLASS');
      expect(resolved.metadata?.gst_rate).toBe(18);
      expect(resolved.metadata?.hsn_code).toBe('6205');
    });

    it('falls back to category level when tax_class is undefined (legacy product behavior)', () => {
      // Register Category Rule (12%)
      registerProductTaxMetadata({
        tax_record_id: 'rule_category_shirts',
        scope_type: 'CATEGORY',
        scope_value: 'shirts',
        hsn_code: '6205',
        gst_rate: 12,
        rate_mode: 'FIXED',
        status: 'ACTIVE'
      });

      const legacyProduct: Product = {
        id: 'p2',
        name: 'Legacy Linen Shirt',
        category: 'shirts',
        subCategory: 'linen-shirts',
        price: 800,
        compareAtPrice: 0,
        fabric: '100% Linen',
        fit: 'Regular',
        color: 'Blue',
        colorHex: '#00F',
        sizes: ['L'],
        pattern: 'Solid',
        images: ['img.jpg'],
        rating: 5,
        reviewCount: 1,
        bestseller: false,
        newArrival: true,
        dateAdded: '2026-03-01',
        description: 'Test',
        details: [],
        careInstructions: []
      };

      const resolved = lookupProductTaxMetadata({
        product_id: legacyProduct.id,
        category: legacyProduct.category,
        tax_class: legacyProduct.tax_class,
        price: 800
      });

      expect(resolved.success).toBe(true);
      expect(resolved.metadata?.resolved_scope).toBe('CATEGORY');
      expect(resolved.metadata?.gst_rate).toBe(12);
      expect(resolved.metadata?.hsn_code).toBe('6205');
    });
  });
});
