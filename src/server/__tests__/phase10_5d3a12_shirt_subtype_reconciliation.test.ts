import { describe, it, expect } from 'vitest';
import { products } from '../../data';

describe('Phase 10.5D.3A.12: 20-Shirt Sleeve Subtype Reconciliation', () => {
  const shirtIds = [
    'ls-1', 'ls-2', 'ls-3', 'ls-4', 'ls-5', 'ls-6', 'ls-7', 'ls-8', 'ls-9', 'ls-10',
    'cls-1', 'cls-2', 'cls-3', 'cls-4', 'cls-5', 'cls-6', 'cls-7', 'cls-8', 'cls-9', 'cls-10'
  ];

  it('contains exactly 20 active shirt records in the inspection scope', () => {
    const scopeProducts = products.filter(p => shirtIds.includes(p.id));
    expect(scopeProducts).toHaveLength(20);
    scopeProducts.forEach(p => {
      expect(p.category).toBe('shirts');
      expect(p.status ?? 'active').not.toBe('archived');
      expect(p.isDecommissioned).toBeFalsy();
    });
  });

  it('every shirt sleeve is either "Full Sleeve" or "Half Sleeve"', () => {
    const scopeProducts = products.filter(p => shirtIds.includes(p.id));
    scopeProducts.forEach(p => {
      expect(['Full Sleeve', 'Half Sleeve']).toContain(p.sleeve);
    });
  });

  it('productSubType perfectly aligns with sleeve mapping rule for all 20 shirts', () => {
    const scopeProducts = products.filter(p => shirtIds.includes(p.id));
    scopeProducts.forEach(p => {
      if (p.sleeve === 'Full Sleeve') {
        expect(p.productSubType).toBe('full-sleeve-shirts');
      } else if (p.sleeve === 'Half Sleeve') {
        expect(p.productSubType).toBe('half-sleeve-shirts');
      } else {
        throw new Error(`Unmapped sleeve specification: ${p.sleeve} on product ${p.id}`);
      }
    });
  });

  it('reconciles to exactly 16 full-sleeve shirts and 4 half-sleeve shirts', () => {
    const scopeProducts = products.filter(p => shirtIds.includes(p.id));
    const fullSleeve = scopeProducts.filter(p => p.productSubType === 'full-sleeve-shirts');
    const halfSleeve = scopeProducts.filter(p => p.productSubType === 'half-sleeve-shirts');

    expect(fullSleeve.map(p => p.id).sort()).toEqual([
      'cls-1', 'cls-3', 'cls-4', 'cls-5', 'cls-7', 'cls-8', 'cls-9', 'cls-10',
      'ls-1', 'ls-3', 'ls-4', 'ls-5', 'ls-6', 'ls-8', 'ls-9', 'ls-10'
    ].sort());

    expect(halfSleeve.map(p => p.id).sort()).toEqual([
      'cls-2', 'cls-6', 'ls-2', 'ls-7'
    ].sort());

    expect(fullSleeve.length + halfSleeve.length).toBe(20);
  });

  it('preserves all non-sleeve taxonomy and core product fields', () => {
    const pureLinenShirts = products.filter(p => p.id.startsWith('ls-'));
    expect(pureLinenShirts).toHaveLength(10);
    pureLinenShirts.forEach(p => {
      expect(p.collection).toBe('pure-linen');
      expect(p.materialType).toBe('pure-linen');
      expect(p.productType).toBe('shirts');
      expect(p.tax_class).toBe('mens_woven_shirt');
    });

    const blendShirts = products.filter(p => p.id.startsWith('cls-'));
    expect(blendShirts).toHaveLength(10);
    blendShirts.forEach(p => {
      expect(p.collection).toBe('linen-cotton-blend');
      expect(p.materialType).toBe('linen-cotton-blend');
      expect(p.productType).toBe('shirts');
      expect(p.tax_class).toBe('mens_woven_shirt');
    });
  });

  it('confirms 10 archived Polos remain archived and decommissioned', () => {
    const polos = products.filter(p => p.id.startsWith('po-'));
    expect(polos).toHaveLength(10);
    polos.forEach(p => {
      expect(p.status).toBe('archived');
      expect(p.isDecommissioned).toBe(true);
    });
  });
});
