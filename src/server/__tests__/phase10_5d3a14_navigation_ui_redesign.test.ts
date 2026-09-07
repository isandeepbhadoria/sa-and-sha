import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  CANONICAL_COLLECTIONS,
  CANONICAL_PRODUCT_TYPES,
  getTaxonomyRouteInfo,
} from '../../config/catalogTaxonomy';
import { products } from '../../data';

describe('PHASE 10.5D.3A.14 — Navigation UI Redesign Verification', () => {
  const headerFile = fs.readFileSync(path.resolve(__dirname, '../../components/Header.tsx'), 'utf-8');
  const footerFile = fs.readFileSync(path.resolve(__dirname, '../../components/Footer.tsx'), 'utf-8');
  const homePageFile = fs.readFileSync(path.resolve(__dirname, '../../pages/HomePage.tsx'), 'utf-8');
  const collectionPageFile = fs.readFileSync(path.resolve(__dirname, '../../pages/CollectionPage.tsx'), 'utf-8');

  it('1. Header Desktop Mega Menu exposes canonical Shop by Collection and Shop by Product dimensions', () => {
    // Check Mega Menu headings
    expect(headerFile).toContain('Shop by Collection');
    expect(headerFile).toContain('Shop by Product');

    // Check Collections links in Header
    expect(headerFile).toContain('/shop/collection/pure-linen');
    expect(headerFile).toContain('/shop/collection/linen-cotton-blend');
    expect(headerFile).toContain('/shop/collection/pure-cotton');
    expect(headerFile).toContain('/shop/collection/chinos');

    // Check Product links in Header
    expect(headerFile).toContain('/shop/product/shirts');
    expect(headerFile).toContain('/shop/product/shirts/full-sleeve');
    expect(headerFile).toContain('/shop/product/shirts/half-sleeve');
    expect(headerFile).toContain('/shop/product/trousers');
    expect(headerFile).toContain('/shop/product/shorts');
    expect(headerFile).toContain('/shop/product/pyjamas');
    expect(headerFile).toContain('/shop/product/kurtas');
    expect(headerFile).toContain('/shop/product/co-ord-sets');
    expect(headerFile).toContain('/shop/product/chinos');
  });

  it('2. Header Mobile Drawer contains accordions for Shop by Collection and Shop by Product', () => {
    expect(headerFile).toContain('mobileCollectionExpanded');
    expect(headerFile).toContain('mobileProductExpanded');
    expect(headerFile).toContain('mobile-nav-collections-toggle');
    expect(headerFile).toContain('mobile-nav-products-toggle');
  });

  it('3. Pure Cotton and future product types include Coming Soon indicators', () => {
    // Coming soon badge in header
    expect(headerFile).toContain('Coming Soon');

    // Coming soon in HomePage
    expect(homePageFile).toContain('Coming Soon');
    expect(homePageFile).toContain('/shop/collection/pure-cotton');
    expect(homePageFile).toContain('/shop/product/shorts');
    expect(homePageFile).toContain('/shop/product/pyjamas');
    expect(homePageFile).toContain('/shop/product/kurtas');
    expect(homePageFile).toContain('/shop/product/co-ord-sets');
  });

  it('4. Footer features Collections and Products columns with canonical routes', () => {
    expect(footerFile).toContain('Collections');
    expect(footerFile).toContain('Products');

    expect(footerFile).toContain('/shop/collection/pure-linen');
    expect(footerFile).toContain('/shop/collection/linen-cotton-blend');
    expect(footerFile).toContain('/shop/collection/pure-cotton');
    expect(footerFile).toContain('/shop/collection/chinos');

    expect(footerFile).toContain('/shop/product/shirts');
    expect(footerFile).toContain('/shop/product/trousers');
    expect(footerFile).toContain('/shop/product/shorts');
    expect(footerFile).toContain('/shop/product/pyjamas');
    expect(footerFile).toContain('/shop/product/kurtas');
    expect(footerFile).toContain('/shop/product/co-ord-sets');
    expect(footerFile).toContain('/shop/product/chinos');
  });

  it('5. Homepage presents Shop by Collection and Shop by Product', () => {
    expect(homePageFile).toContain('Shop by Collection');
    expect(homePageFile).toContain('Shop by Product');
  });

  it('6. Forbids Polos from active customer navigation and ensures decommission policy holds', () => {
    // Header should not link to /shop/polos or contain Polo nav items
    expect(headerFile).not.toContain('/shop/polos');
    expect(footerFile).not.toContain('/shop/polos');

    // No active polo products in catalog
    const activePolos = products.filter(
      p => (p.category === 'polos' || p.productType === 'polos') && p.status !== 'archived' && !p.isDecommissioned
    );
    expect(activePolos.length).toBe(0);
  });

  it('7. Does NOT use forbidden legacy category terms in primary customer navigation', () => {
    // Header and Footer should not expose legacy "Pants" links in primary navigation
    expect(headerFile).not.toContain('Shop All Pants');
    expect(headerFile).not.toContain('Linen Pants');
    expect(headerFile).not.toContain('Cotton Linen Pants');
    expect(footerFile).not.toContain('Linen Pants');

    // Subcategory filter options in CollectionPage should use canonical labels
    expect(collectionPageFile).not.toContain('Pure Linen Pants');
    expect(collectionPageFile).not.toContain('Cotton Linen Blend Pants');
    expect(collectionPageFile).toContain('Pure Linen Trousers');
    expect(collectionPageFile).toContain('Linen-Cotton Blend Trousers');
  });

  it('8. Canonical taxonomy route resolution delivers correct page metadata and counts', () => {
    const apparelRoute = getTaxonomyRouteInfo({ collectionId: 'apparel' });
    expect(apparelRoute.isValid).toBe(true);
    expect(apparelRoute.h1).toBe('Apparel');

    const accessoriesRoute = getTaxonomyRouteInfo({ collectionId: 'accessories' });
    expect(accessoriesRoute.isValid).toBe(true);
    expect(accessoriesRoute.isComingSoon).toBe(true);

    const trousersRoute = getTaxonomyRouteInfo({ productTypeId: 'trousers' });
    expect(trousersRoute.isValid).toBe(true);
    expect(trousersRoute.isComingSoon).toBe(true);

    const topsRoute = getTaxonomyRouteInfo({
      productTypeId: 'tops-shirts',
      subTypeSlug: 'tops',
    });
    expect(topsRoute.isValid).toBe(true);
    expect(topsRoute.filterProductSubType).toBe('tops');
  });
});
