export type MerchandisingCollection =
  | 'apparel'
  | 'accessories'
  | string;

export type ProductType =
  | 'dresses'
  | 'tops-shirts'
  | 'shorts-skirts'
  | 'co-ord-sets'
  | 'trousers'
  | 'jackets'
  | 'bags-pouches'
  | string;

export type ProductSubType =
  | 'tops'
  | 'shirts'
  | 'shorts'
  | 'skirts'
  | string;

export type MaterialType =
  | 'cotton'
  | 'linen-cotton-blend'
  | 'georgette'
  | 'other'
  | string;

export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  collection?: MerchandisingCollection;
  productType?: ProductType;
  productSubType?: ProductSubType;
  materialType?: MaterialType;
  price: number;
  compareAtPrice: number;
  fabric: string;
  // Sourced from Fit Profile Master, not a fixed list — see
  // SimpleMasterListTab / server.ts's /api/admin/fit-profiles.
  fit: string;
  color: string;
  colorHex: string;
  sizes: string[];
  collar?: 'Spread' | 'Cutaway' | 'Mandarin' | 'Polo Collar';
  sleeve?: 'Full Sleeve' | 'Half Sleeve';
  pattern: 'Solid' | 'Striped' | 'Printed' | 'Checked';
  images: string[];
  rating: number;
  reviewCount: number;
  bestseller: boolean;
  newArrival: boolean;
  dateAdded: string; // YYYY-MM-DD format
  description: string;
  details: string[];
  careInstructions: string[];
  sku?: string;
  slug?: string;
  previousSlugs?: string[];
  status?: 'draft' | 'published' | 'archived';
  isDecommissioned?: boolean;
  // Read-only display cache, kept current by the ERP's stock-change
  // webhook (see server.ts's /api/webhooks/erp-inventory) — the ERP is now
  // the only place real stock changes happen. Never write this from the
  // admin form.
  stock?: Record<string, number>;
  tax_class?: string;
  // The factory's Pattern/Style Number — shared across export and
  // domestic brands on purpose. Required for a product's sizes to become
  // real, orderable ERP stock; see erpSkuBySize below.
  styleNumber?: string;
  // One ERP StyleArticle SKU per size, populated by
  // src/server/erpSync.ts#registerProductWithErp after each save. A size
  // with no entry here isn't tracked in the ERP yet (e.g. styleNumber was
  // just added and hasn't synced) and checkout treats it as untracked,
  // same as a legacy product with no stock map ever did.
  erpSkuBySize?: Record<string, string>;
}

export interface CartItem {
  product: Product;
  selectedSize: string;
  quantity: number;
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

export interface PromoMessage {
  id: number;
  text: string;
}

export interface ShippingDetails {
  fullName: string;
  phone: string;
  addressLine: string;
  pincode: string;
  city: string;
  state: string;
}

export interface Promotion {
  id?: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_order_amount: number;
  maximum_discount_amount: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  applicable_product_ids: string[];
  applicable_categories: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
}
