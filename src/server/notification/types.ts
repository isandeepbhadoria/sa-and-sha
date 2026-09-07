export type NotificationEventType =
  | 'ORDER_PLACED'
  | 'PAYMENT_RECEIVED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PACKED'
  | 'ORDER_SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'ORDER_RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURN_COMPLETED'
  | 'REFUND_INITIATED'
  | 'REFUND_COMPLETED'
  | 'STORE_CREDIT_ADDED'
  | 'STORE_CREDIT_EXPIRED'
  | 'LOYALTY_POINTS_EARNED'
  | 'LOYALTY_POINTS_RELEASED'
  | 'LOYALTY_POINTS_EXPIRING'
  | 'LOYALTY_POINTS_REDEEMED'
  | 'TIER_UPGRADED'
  | 'TIER_DOWNGRADED'
  | 'WELCOME'
  | 'ACCOUNT_CREATED'
  | 'ADDRESS_UPDATED'
  | 'PASSWORDLESS_LOGIN'
  | 'OTP_VERIFIED'
  | 'REVIEW_REQUEST'
  | 'ABANDONED_CART'
  | 'BACK_IN_STOCK'
  | 'PRICE_DROP'
  | 'BIRTHDAY'
  | 'ANNIVERSARY'
  | 'REFERRAL_REWARD';

export type NotificationChannel = 'email' | 'whatsapp' | 'sms' | 'push';

export type NotificationStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SUBMITTED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RETRYING'
  | 'EXPIRED'
  | 'UNKNOWN';

export type EventCategory = 'orders' | 'refunds' | 'loyalty' | 'account' | 'marketing';

export interface CustomerTarget {
  profileId: string;
  customerId?: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface NotificationPreferences {
  email: {
    orders: boolean;
    refunds: boolean;
    loyalty: boolean;
    account: boolean;
    marketing: boolean;
  };
  whatsapp: {
    orders: boolean;
    refunds: boolean;
    loyalty: boolean;
    account: boolean;
    marketing: boolean;
  };
}

export interface ChannelRouteConfig {
  enabled: boolean;
  templateId?: string;
}

export interface EventRouteSetting {
  event: NotificationEventType;
  category: EventCategory;
  isTransactional: boolean;
  channels: {
    email: ChannelRouteConfig;
    whatsapp: ChannelRouteConfig;
    sms?: ChannelRouteConfig;
    push?: ChannelRouteConfig;
  };
}

export interface ProviderDispatchResult {
  success: boolean;
  provider: string;
  channel: NotificationChannel;
  providerMessageId?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface NotificationLog {
  id: string;
  notification_id: string;
  customer_profile_id: string;
  customer_business_id?: string;
  event: NotificationEventType;
  event_type: NotificationEventType;
  channel: NotificationChannel;
  provider: string;
  provider_message_id?: string;
  recipient?: string;
  template?: string;
  payload_hash?: string;
  status: NotificationStatus;
  queued_at: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  failed_at?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface PublishNotificationOptions {
  event: NotificationEventType;
  customer?: CustomerTarget;
  customerProfileId?: string;
  customerBusinessId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  customerName?: string;
  order?: any;
  payload?: Record<string, any>;
  channelsOverride?: NotificationChannel[];
  forceChannels?: NotificationChannel[];
  idempotencyKey?: string;
}

export interface NotificationEngineResult {
  notificationId: string;
  event: NotificationEventType;
  dispatchedChannels: NotificationChannel[];
  results: Record<NotificationChannel, ProviderDispatchResult>;
  status: NotificationStatus;
  success?: boolean;
  logs?: NotificationLog[];
  errors?: string[];
}
