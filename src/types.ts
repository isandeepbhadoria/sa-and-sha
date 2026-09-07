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
