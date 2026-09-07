import {
  NotificationEventType,
  NotificationChannel,
  EventCategory,
  EventRouteSetting,
  CustomerTarget
} from './types';
import {
  getCustomerNotificationPreferences,
  isChannelAllowedByPreferences
} from './notificationPreferences';

export const EVENT_CATEGORY_MAP: Record<NotificationEventType, { category: EventCategory; isTransactional: boolean }> = {
  ORDER_PLACED: { category: 'orders', isTransactional: true },
  PAYMENT_RECEIVED: { category: 'orders', isTransactional: true },
  ORDER_CONFIRMED: { category: 'orders', isTransactional: true },
  ORDER_PACKED: { category: 'orders', isTransactional: true },
  ORDER_SHIPPED: { category: 'orders', isTransactional: true },
  OUT_FOR_DELIVERY: { category: 'orders', isTransactional: true },
  ORDER_DELIVERED: { category: 'orders', isTransactional: true },
  ORDER_CANCELLED: { category: 'orders', isTransactional: true },
  ORDER_RETURN_REQUESTED: { category: 'refunds', isTransactional: true },
  RETURN_APPROVED: { category: 'refunds', isTransactional: true },
  RETURN_COMPLETED: { category: 'refunds', isTransactional: true },
  REFUND_INITIATED: { category: 'refunds', isTransactional: true },
  REFUND_COMPLETED: { category: 'refunds', isTransactional: true },
  STORE_CREDIT_ADDED: { category: 'refunds', isTransactional: true },
  STORE_CREDIT_EXPIRED: { category: 'refunds', isTransactional: true },
  LOYALTY_POINTS_EARNED: { category: 'loyalty', isTransactional: true },
  LOYALTY_POINTS_RELEASED: { category: 'loyalty', isTransactional: true },
  LOYALTY_POINTS_EXPIRING: { category: 'loyalty', isTransactional: true },
  LOYALTY_POINTS_REDEEMED: { category: 'loyalty', isTransactional: true },
  TIER_UPGRADED: { category: 'loyalty', isTransactional: true },
  TIER_DOWNGRADED: { category: 'loyalty', isTransactional: true },
  WELCOME: { category: 'account', isTransactional: true },
  ACCOUNT_CREATED: { category: 'account', isTransactional: true },
  ADDRESS_UPDATED: { category: 'account', isTransactional: true },
  PASSWORDLESS_LOGIN: { category: 'account', isTransactional: true },
  OTP_VERIFIED: { category: 'account', isTransactional: true },
  REVIEW_REQUEST: { category: 'marketing', isTransactional: false },
  ABANDONED_CART: { category: 'marketing', isTransactional: false },
  BACK_IN_STOCK: { category: 'marketing', isTransactional: false },
  PRICE_DROP: { category: 'marketing', isTransactional: false },
  BIRTHDAY: { category: 'marketing', isTransactional: false },
  ANNIVERSARY: { category: 'marketing', isTransactional: false },
  REFERRAL_REWARD: { category: 'marketing', isTransactional: false }
};

/**
 * Fetch global admin notification route settings or fallback to defaults
 */
export async function getGlobalNotificationSettings(adminDb: any): Promise<Record<string, EventRouteSetting>> {
  try {
    const docSnap = await adminDb.collection('notification_settings').doc('global_router').get();
    if (docSnap.exists) {
      return docSnap.data()?.events || {};
    }
  } catch (err) {
    console.warn('[NOTIF ROUTER] Using default route settings:', err);
  }

  // Generate default router configuration for all events
  const defaultSettings: Record<string, EventRouteSetting> = {};
  for (const [evt, info] of Object.entries(EVENT_CATEGORY_MAP)) {
    defaultSettings[evt] = {
      event: evt as NotificationEventType,
      category: info.category,
      isTransactional: info.isTransactional,
      channels: {
        email: { enabled: true },
        whatsapp: { enabled: true }
      }
    };
  }
  return defaultSettings;
}

/**
 * Determine target active channels for an event and customer
 */
export async function routeNotificationEvent(
  adminDb: any,
  event: NotificationEventType,
  customer: CustomerTarget,
  channelsOverride?: NotificationChannel[]
): Promise<NotificationChannel[]> {
  const meta = EVENT_CATEGORY_MAP[event] || { category: 'account', isTransactional: true };

  // If specific channels are explicitly requested in trigger call
  if (channelsOverride && channelsOverride.length > 0) {
    return channelsOverride;
  }

  const globalSettings = await getGlobalNotificationSettings(adminDb);
  const eventSetting = globalSettings[event] || {
    event,
    category: meta.category,
    isTransactional: meta.isTransactional,
    channels: { email: { enabled: true }, whatsapp: { enabled: true } }
  };

  const customerPrefs = await getCustomerNotificationPreferences(adminDb, customer.profileId);
  const activeChannels: NotificationChannel[] = [];

  // Check Email
  if (
    eventSetting.channels.email?.enabled &&
    Boolean(customer.email) &&
    isChannelAllowedByPreferences(customerPrefs, 'email', meta.category, meta.isTransactional)
  ) {
    activeChannels.push('email');
  }

  // Check WhatsApp
  if (
    eventSetting.channels.whatsapp?.enabled &&
    Boolean(customer.phone) &&
    isChannelAllowedByPreferences(customerPrefs, 'whatsapp', meta.category, meta.isTransactional)
  ) {
    activeChannels.push('whatsapp');
  }

  return activeChannels;
}
