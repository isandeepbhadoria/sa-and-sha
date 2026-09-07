export const RETURNS_CONFIG = {
  // Business Rules
  RETURN_SHIPPING_FEE: 100, // ₹100 fixed return shipping fee per return request/pickup
  EXCHANGE_FEE: 0, // ₹0 exchange fee
  RETURN_EXCHANGE_WINDOW_DAYS: 7, // Configurable return/exchange window in days after delivery
  CURRENCY: 'INR',
  CURRENCY_SYMBOL: '₹',
  SAME_PRODUCT_SAME_VARIANT_SIZE_ONLY: true, // Only size changes allowed for same product & color
  REQUIRE_OTP_VERIFICATION: true, // Require OTP or combined verification before showing full order history

  // Return Reasons Options
  RETURN_REASONS: [
    'Size Issue',
    'Fit Issue',
    'Product Not as Expected',
    'Received Wrong Item',
    'Received Damaged Item',
    'Quality Issue',
    'Other'
  ],

  // Exchange Reasons Options
  EXCHANGE_REASONS: [
    'Too Small',
    'Too Large',
    'Fit Issue',
    'Other'
  ],

  // Request Status Definitions
  STATUS_FLOW: {
    REQUESTED: 'Requested',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    PICKUP_SCHEDULED: 'Pickup Scheduled',
    PICKED_UP: 'Picked Up',
    RECEIVED: 'Received at Facility',
    QUALITY_CHECK: 'Quality Check Passed',
    REFUND_PROCESSED: 'Refund Processed',
    EXCHANGE_PROCESSING: 'Exchange Processing',
    EXCHANGE_SHIPPED: 'Exchange Shipped',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected'
  }
};
