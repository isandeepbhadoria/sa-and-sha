export type CustomerEventType =
  | "profile_created"
  | "profile_updated"
  | "google_identity_linked"
  | "otp_verified"
  | "address_added"
  | "address_updated"
  | "address_deleted"
  | "default_address_changed"
  | "order_created"
  | "payment_successful"
  | "payment_failed"
  | "order_confirmed"
  | "order_packed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "return_requested"
  | "return_approved"
  | "return_rejected"
  | "refund_initiated"
  | "refund_completed"
  | "exchange_requested"
  | "exchange_completed"
  | "consent_enabled"
  | "consent_disabled"
  | "admin_note_updated"
  | "tag_added"
  | "tag_removed"
  | "tier_changed"
  | "duplicate_flagged"
  | "profiles_merged_future_placeholder"
  | "points_earned_pending"
  | "points_available"
  | "points_expired"
  | "points_redeemed"
  | "points_restored"
  | "store_credit_issued"
  | "store_credit_redeemed"
  | "store_credit_restored"
  | "loyalty_tier_changed"
  | "loyalty_adjustment"
  | "store_credit_adjustment";

export interface CustomerTimelineEvent {
  id: string;
  customer_profile_id: string;
  event_type: CustomerEventType;
  title: string;
  description: string;
  source: "system" | "checkout" | "admin" | "webhook" | "customer_action";
  related_order_id?: string;
  related_address_id?: string;
  related_return_id?: string;
  related_admin_email?: string;
  metadata?: Record<string, any>;
  occurred_at: string;
  created_at: string;
}

export type HealthStatus =
  | "new"
  | "active"
  | "loyal"
  | "vip"
  | "at_risk"
  | "inactive"
  | "high_return_risk";

export interface CustomerHealth {
  health_score: number; // 0 - 100
  health_status: HealthStatus;
  health_reasons: string[];
  health_calculated_at: string;
  health_model_version: string;
}

export interface EligibleMetrics {
  eligible_order_count: number;
  eligible_revenue: number;
  return_rate: number; // 0 - 100%
  cancellation_rate: number; // 0 - 100%
  refund_rate: number; // 0 - 100%
  avg_days_between_orders?: number;
  days_since_last_order?: number;
  total_orders?: number;
  cancelled_count?: number;
  returned_count?: number;
  refunded_count?: number;
  first_order_at?: string;
  last_order_at?: string;
}

export interface CustomerSegmentFilter {
  health_status?: HealthStatus[];
  customer_tier?: string[];
  total_orders_min?: number;
  total_orders_max?: number;
  eligible_orders_min?: number;
  eligible_orders_max?: number;
  lifetime_spend_min?: number;
  lifetime_spend_max?: number;
  aov_min?: number;
  aov_max?: number;
  days_since_last_order_min?: number;
  days_since_last_order_max?: number;
  city?: string;
  state?: string;
  payment_preference?: ("razorpay" | "cod")[];
  tags?: string[];
  consents?: ("email" | "sms" | "whatsapp" | "voice_call")[];
  created_after?: string;
  created_before?: string;
  last_order_after?: string;
  last_order_before?: string;
  has_birthday_this_month?: boolean;
  has_anniversary_this_month?: boolean;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  filters: CustomerSegmentFilter;
  sort_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_system: boolean;
}

export type CustomerNoteType =
  | "general"
  | "call"
  | "email"
  | "whatsapp"
  | "complaint"
  | "size_preference"
  | "delivery_instruction"
  | "wholesale_enquiry";

export interface StructuredCustomerNote {
  id: string;
  customer_profile_id: string;
  note: string;
  note_type: CustomerNoteType;
  created_by: string; // Admin email
  created_at: string;
  updated_at?: string;
}

export interface CustomerAnalytics {
  total_customers: number;
  new_customers: number;
  active_customers: number;
  repeat_customers: number;
  at_risk_customers: number;
  inactive_customers: number;
  vip_customers: number;
  high_return_risk_customers: number;
  eligible_customer_revenue: number;
  average_customer_value: number;
  repeat_purchase_rate: number;
  one_time_buyer_rate: number;
  health_distribution: Record<HealthStatus, number>;
  top_cities: { city: string; count: number; revenue: number }[];
  top_states: { state: string; count: number; revenue: number }[];
  growth_over_time: { month: string; new_customers: number; total_revenue: number }[];
  segment_revenue: { segment_name: string; count: number; revenue: number }[];
}

export interface MergePreviewResult {
  primary_id: string;
  duplicate_id: string;
  primary_summary: {
    full_name: string;
    phone: string;
    email: string;
    order_count: number;
    lifetime_spend: number;
    addresses_count: number;
  };
  duplicate_summary: {
    full_name: string;
    phone: string;
    email: string;
    order_count: number;
    lifetime_spend: number;
    addresses_count: number;
  };
  combined_preview: {
    merged_email: string;
    merged_addresses_count: number;
    merged_order_count: number;
    merged_lifetime_spend: number;
    merged_tags: string[];
    conflicts: Array<{ field: string; primary_value: any; duplicate_value: any; resolution: string }>;
  };
  is_safe_to_merge: boolean;
  warnings: string[];
}
