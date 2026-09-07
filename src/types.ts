export type MerchandisingCollection =
  | 'pure-linen'
  | 'linen-cotton-blend'
  | 'pure-cotton'
  | 'chinos'
  | string;

export type ProductType =
  | 'shirts'
  | 'trousers'
  | 'shorts'
  | 'pyjamas'
  | 'kurtas'
  | 'co-ord-sets'
  | 'chinos'
  | string;

export type ProductSubType =
  | 'full-sleeve-shirts'
  | 'half-sleeve-shirts'
  | 'casual-short-kurtas'
  | 'smart-casual-long-kurtas'
  | string;

export type MaterialType =
  | 'pure-linen'
  | 'linen-cotton-blend'
  | 'pure-cotton'
  | 'other'
  | string;

export interface Product {
  id: string;
  name: string;
  category: 'shirts' | 'pants' | 'polos' | 'kurtas' | 'co-ord sets' | 'jackets' | 'accessories';
  subCategory: 'linen-shirts' | 'cotton-linen-shirts' | 'linen-pants' | 'cotton-linen-pants' | 'chinos' | 'polos' | 'kurtas' | 'co-ord-sets' | 'jackets' | 'accessories';
  collection?: MerchandisingCollection;
  productType?: ProductType;
  productSubType?: ProductSubType;
  materialType?: MaterialType;
  price: number;
  compareAtPrice: number;
  fabric: string;
  fit: 'Slim' | 'Regular' | 'Relaxed';
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
  stock?: Record<string, number>;
  tax_class?: string;
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
