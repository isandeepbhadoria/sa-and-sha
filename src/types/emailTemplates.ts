export interface EmailTemplate {
  template_id: string; // e.g., 'order_confirmed'
  event_id: string;    // e.g., 'order_confirmed'
  name: string;        // e.g., 'Order Confirmed'
  subject: string;
  html: string;
  plain_text: string;
  version: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  updated_by?: string;
  published: boolean;
  published_at?: string;
  variables: string[];
}

export interface EmailTemplateVersion {
  id?: string;
  template_id: string;
  version: number;
  subject: string;
  html: string;
  plain_text: string;
  created_at: string;
  created_by?: string;
}

export interface EmailTemplateVariable {
  name: string;
  label: string;
  example: string;
  category: 'order' | 'customer' | 'payment' | 'shipping' | 'company' | 'loyalty' | 'return';
}

export const DEFAULT_EMAIL_VARIABLES: EmailTemplateVariable[] = [
  { name: 'customer_name', label: 'Customer Full Name', example: 'Ananya Sharma', category: 'customer' },
  { name: 'customer_email', label: 'Customer Email', example: 'ananya@example.com', category: 'customer' },
  { name: 'customer_phone', label: 'Customer Phone', example: '+91 98765 43210', category: 'customer' },
  { name: 'order_id', label: 'Order Reference ID', example: 'SS-100452', category: 'order' },
  { name: 'order_total', label: 'Order Total Amount', example: '₹14,500', category: 'order' },
  { name: 'order_date', label: 'Order Placement Date', example: '4 August 2026', category: 'order' },
  { name: 'order_items_table', label: 'HTML Order Items Table', example: '<table>...</table>', category: 'order' },
  { name: 'item_count', label: 'Total Items Count', example: '3', category: 'order' },
  { name: 'tracking_number', label: 'Shipment Tracking Number', example: 'SF10098234IN', category: 'shipping' },
  { name: 'courier_name', label: 'Courier / Delivery Partner', example: 'Delhivery Direct', category: 'shipping' },
  { name: 'tracking_url', label: 'Live Tracking URL', example: 'https://saandsha.com/track/SS-100452', category: 'shipping' },
  { name: 'estimated_delivery', label: 'Estimated Delivery Date', example: '8 August 2026', category: 'shipping' },
  { name: 'shipping_address', label: 'Formatted Shipping Address', example: '42, Marine Drive, Mumbai, 400020', category: 'shipping' },
  { name: 'payment_method', label: 'Payment Method Used', example: 'Prepaid (Razorpay / UPI)', category: 'payment' },
  { name: 'gst_number', label: 'Customer GSTIN', example: '27AABCU9603R1ZM', category: 'order' },
  { name: 'business_name', label: 'Business / Company Name', example: 'Sharma Luxury Interiors Pvt Ltd', category: 'order' },
  { name: 'store_name', label: 'Store Name', example: 'Sa and Sha', category: 'company' },
  { name: 'support_email', label: 'Customer Support Email', example: 'shop@saandsha.com', category: 'company' },
  { name: 'support_phone', label: 'Customer Care Phone', example: '+91 1800 123 4567', category: 'company' },
  { name: 'loyalty_points_earned', label: 'Loyalty Points Earned', example: '145 Points', category: 'loyalty' },
  { name: 'reward_balance', label: 'Current Rewards Balance', example: '520 Points', category: 'loyalty' },
  { name: 'return_id', label: 'Return Request Reference', example: 'RET-8841', category: 'return' },
  { name: 'return_status', label: 'Return Processing Status', example: 'Approved for Inspection', category: 'return' },
  { name: 'refund_amount', label: 'Refund Amount Processed', example: '₹4,200', category: 'return' }
];

export const MOCK_TEST_VARIABLES: Record<string, string> = {
  customer_name: 'Ananya Sharma',
  customer_email: 'ananya@example.com',
  customer_phone: '+91 98765 43210',
  order_id: 'SS-100452',
  order_total: '₹14,500',
  order_date: '4 August 2026',
  order_items_table: `<table style="width:100%; border-collapse:collapse; margin:16px 0;">
    <thead>
      <tr style="background:#f5f3ef; text-align:left; font-size:12px; color:#555;">
        <th style="padding:8px 12px;">Item</th>
        <th style="padding:8px 12px;">Qty</th>
        <th style="padding:8px 12px; text-align:right;">Price</th>
      </tr>
    </thead>
    <tbody style="font-size:13px; color:#2A211C;">
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;">Floral Wrap Midi Dress (M, Blush Pink)</td>
        <td style="padding:10px 12px;">1</td>
        <td style="padding:10px 12px; text-align:right;">₹3,500</td>
      </tr>
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:10px 12px;">Co-Ord Set — Top & Skirt (S, Ivory)</td>
        <td style="padding:10px 12px;">2</td>
        <td style="padding:10px 12px; text-align:right;">₹4,200</td>
      </tr>
    </tbody>
  </table>`,
  item_count: '3',
  tracking_number: 'SF10098234IN',
  courier_name: 'Delhivery Direct',
  tracking_url: 'https://saandsha.com/track/SS-100452',
  estimated_delivery: '8 August 2026',
  shipping_address: '42, Marine Drive, Nariman Point, Mumbai, Maharashtra 400020',
  payment_method: 'Prepaid (Razorpay / UPI)',
  gst_number: '27AABCU9603R1ZM',
  business_name: 'Sharma Luxury Interiors Pvt Ltd',
  store_name: 'Sa and Sha',
  support_email: 'shop@saandsha.com',
  support_phone: '+91 1800 123 4567',
  loyalty_points_earned: '145 Points',
  reward_balance: '520 Points',
  return_id: 'RET-8841',
  return_status: 'Approved for Pickup',
  refund_amount: '₹4,200'
};
