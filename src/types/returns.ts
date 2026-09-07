export type ReturnActionType = 'return' | 'exchange';

export type ReturnRequestStatus = 
  | 'requested'
  | 'under_review'
  | 'approved'
  | 'pickup_scheduled'
  | 'picked_up'
  | 'received'
  | 'quality_check'
  | 'refund_processed'
  | 'exchange_processing'
  | 'exchange_shipped'
  | 'completed'
  | 'rejected';

export interface ReturnExchangeItem {
  product_id: string;
  sku?: string;
  name: string;
  variant_color?: string;
  color?: string;
  original_size: string;
  requested_size?: string; // required if action === 'exchange'
  quantity: number;
  price_paid: number;
  action: ReturnActionType;
  reason: string;
  reason_notes?: string;
  evidence_images?: string[];
  item_status?: 'requested' | 'approved' | 'rejected' | 'processed';
  estimated_refund_item?: number;
}

export interface ReturnExchangeRequest {
  id?: string; // Firestore document ID
  request_id: string; // e.g. RET-102548-8392 or EXC-102548-4820
  order_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  request_type: 'return' | 'exchange' | 'mixed';
  items: ReturnExchangeItem[];
  return_shipping_fee: number; // e.g., 100 for return, 0 if only exchange
  estimated_refund_total: number;
  status: ReturnRequestStatus;
  status_label?: string;
  shipping_address?: {
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  pickup_details?: {
    scheduled_date?: string;
    courier?: string;
    awb_number?: string;
  };
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerVerificationResult {
  verified: boolean;
  masked_email?: string;
  masked_phone?: string;
  customer_name?: string;
  verification_token?: string;
  orders_count?: number;
  error?: string;
}
