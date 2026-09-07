import { Product } from './types';

// Generic stock photography — placeholders until real Sa and Sha product
// photography is uploaded for each product via the Admin panel.
const dressImages = {
  blockPrintWhite: [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1495385794356-15371f348c31?w=800&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80'
  ]
};

export const COLOR_SWATCHES = [
  { name: 'White', hex: '#F5F1E8' },
  { name: 'Natural Sand', hex: '#E4D8C3' },
  { name: 'Warm Beige', hex: '#C9B79C' },
  { name: 'Terracotta Rust', hex: '#B85C38' },
  { name: 'Olive Green', hex: '#5C6B4A' },
  { name: 'Ink Navy', hex: '#16202A' },
  { name: 'Charcoal', hex: '#1F1B16' },
  { name: 'Sage Grey', hex: '#8C9C8F' },
  { name: 'Sky Blue', hex: '#A4C3D2' },
  { name: 'Desert Rose', hex: '#C58B82' }
];

// Per-category size runs. Add more as new categories get real inventory
// (e.g. waist-based sizing for Trousers, one-size for most Bags & Pouches).
const DRESS_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// Real Sa and Sha catalog, added as actual products go live. Each new
// product should carry the full new-taxonomy field set (category,
// subCategory, collection, productType, materialType, tax_class) — see
// src/config/catalogTaxonomy.ts for the valid values and combinations.
export let products: Product[] = [
  {
    id: 'ss-dress-001',
    name: 'Block Print Maxi Dress',
    slug: 'block-print-maxi-dress',
    category: 'dresses',
    subCategory: 'dresses',
    collection: 'apparel',
    productType: 'dresses',
    materialType: 'cotton',
    tax_class: 'womens_dress',
    price: 4000,
    compareAtPrice: 4000,
    fabric: '100% Pure Cotton',
    fit: 'Relaxed',
    color: 'White',
    colorHex: '#F5F1E8',
    sizes: DRESS_SIZES,
    pattern: 'Printed',
    images: dressImages.blockPrintWhite,
    rating: 0,
    reviewCount: 0,
    bestseller: true,
    newArrival: true,
    dateAdded: '2026-09-07',
    description: 'A breezy white cotton maxi dress hand block-printed with a vivid floral motif in coral, pink, and green. The smocked bodice gives a comfortable, adjustable fit, while ruffled cap sleeves and a flowing tiered skirt with contrast woven borders make it an easy pick for daytime events or warm-weather evenings.',
    details: [
      'Hand block-printed floral design on soft, breathable cotton',
      'Smocked, elasticated bodice for a comfortable, adjustable fit',
      'Ruffle-trimmed cap sleeves with a high, ruffled neckline',
      'Tiered, flowing maxi-length skirt',
      'Contrast woven border trim detailing at the tiers and hem',
      'Pull-on style — no zip needed'
    ],
    careInstructions: [
      'Machine wash cold, separately for the first few washes',
      'Do not bleach',
      'Dry in shade to preserve print vibrancy',
      'Warm iron if needed; avoid ironing directly over printed areas'
    ],
    sku: 'SS-DRS-BLOCKPRINT-01'
  }
];

// FAQs shown on category/collection pages, keyed by canonical product type
// (src/config/catalogTaxonomy.ts). Add entries here as new categories get
// their own specifics; keep the general ones broadly true across styles.
export const categoryFAQs: Record<string, { q: string; a: string }[]> = {
  dresses: [
    { q: 'How do I pick the right size for a dress?', a: 'Check the size guide linked on each product page for bust, waist, and length measurements. If you’re between sizes, size up for a relaxed fit or size down for something more fitted.' },
    { q: 'Are the dresses lined?', a: 'Lining varies by style and is listed in that product’s details. Unlined pieces are designed to be layered with a slip if you prefer more coverage.' },
    { q: 'How should I care for a block-printed dress?', a: 'Hand block-printed fabrics are best washed cold and separately for the first few washes to protect the print. Avoid ironing directly over printed areas and dry in shade to preserve colour.' },
    { q: 'Can I return or exchange a dress if the size doesn’t fit?', a: 'Yes — unworn dresses with tags attached are eligible for return or exchange within our standard return window. See our Returns & Exchanges page for details.' }
  ],
  'tops-shirts': [
    { q: 'What’s the difference between your Tops and Shirts?', a: 'Tops are relaxed, casual pieces designed for everyday layering, while Shirts have a more structured silhouette with a collar or placket.' },
    { q: 'Do your tops and shirts run true to size?', a: 'Yes, sized to our standard chart. Check the size guide on each product page for exact bust and length measurements.' },
    { q: 'How do I care for printed or embroidered tops?', a: 'Gentle machine wash cold, inside out, and air dry in shade to protect prints and embroidery.' }
  ],
  'shorts-skirts': [
    { q: 'What length are your skirts?', a: 'Lengths vary by style — mini, midi, or maxi is noted in each product’s description.' },
    { q: 'What rise are your shorts?', a: 'Waist rise is noted per style in the product details; most sit at a comfortable mid-to-high rise.' },
    { q: 'How should I wash printed shorts and skirts?', a: 'Machine wash cold with similar colours and avoid bleach to keep prints looking fresh.' }
  ],
  'co-ord-sets': [
    { q: 'Can I buy the top and bottom separately?', a: 'Co-ord sets are sold as a matched set. If you need help with sizing or availability, reach out to our support team.' },
    { q: 'Do both pieces come in the same size?', a: 'Yes, each set ships in one selected size across both pieces. If you need different sizes for top and bottom, contact support before ordering.' }
  ],
  trousers: [
    { q: 'What sizing do you use for trousers?', a: 'Our trousers are sized by waist measurement — check the size chart on the product page for the exact fit.' },
    { q: 'Do the trousers have pockets?', a: 'Pocket details are listed under each product’s key features.' },
    { q: 'How do I care for tailored trousers?', a: 'Follow the specific wash or dry-clean instructions listed on the product page — this varies by fabric.' }
  ],
  jackets: [
    { q: 'What season are your jackets suited for?', a: 'Our jackets are lightweight layering pieces for transitional weather — ideal for evenings and air-conditioned spaces rather than heavy winter cold.' },
    { q: 'How do I clean a jacket?', a: 'Follow the specific care instructions on the product page, as this varies by fabric and lining.' }
  ],
  'bags-pouches': [
    { q: 'What materials are your bags made from?', a: 'Material is listed on each product page and varies by style.' },
    { q: 'How do I clean my bag or pouch?', a: 'Spot clean with a soft, slightly damp cloth. Avoid soaking or machine washing.' }
  ]
};
