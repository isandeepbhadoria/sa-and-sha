import { NotificationPreferences, EventCategory } from './types';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: {
    orders: true,
    refunds: true,
    loyalty: true,
    account: true,
    marketing: true
  },
  whatsapp: {
    orders: true,
    refunds: true,
    loyalty: true,
    account: true,
    marketing: false
  }
};

/**
 * Fetch notification preferences for customer, falling back to defaults
 */
export async function getCustomerNotificationPreferences(
  adminDb: any,
  profileId: string
): Promise<NotificationPreferences> {
  if (!profileId) return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const docSnap = await adminDb.collection('customer_profiles').doc(profileId).get();
    if (!docSnap.exists) return DEFAULT_NOTIFICATION_PREFERENCES;

    const data = docSnap.data();
    const prefs = data?.notification_preferences;

    if (!prefs) return DEFAULT_NOTIFICATION_PREFERENCES;

    return {
      email: { ...DEFAULT_NOTIFICATION_PREFERENCES.email, ...(prefs.email || {}) },
      whatsapp: { ...DEFAULT_NOTIFICATION_PREFERENCES.whatsapp, ...(prefs.whatsapp || {}) }
    };
  } catch (err) {
    console.warn(`[NOTIF PREFS] Error loading preferences for ${profileId}, using defaults:`, err);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/**
 * Save notification preferences for customer
 */
export async function updateCustomerNotificationPreferences(
  adminDb: any,
  profileId: string,
  newPreferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const current = await getCustomerNotificationPreferences(adminDb, profileId);

  const updated: NotificationPreferences = {
    email: { ...current.email, ...(newPreferences.email || {}) },
    whatsapp: { ...current.whatsapp, ...(newPreferences.whatsapp || {}) }
  };

  await adminDb.collection('customer_profiles').doc(profileId).set({
    notification_preferences: updated,
    updated_at: new Date().toISOString()
  }, { merge: true });

  return updated;
}

/**
 * Check if customer allowed notification on specific channel and category
 */
export function isChannelAllowedByPreferences(
  prefs: NotificationPreferences,
  channel: 'email' | 'whatsapp',
  category: EventCategory,
  isTransactional: boolean
): boolean {
  // Transactional notifications ALWAYS bypass preferences for core operational delivery unless explicitly unsubscribed
  if (isTransactional) {
    return true;
  }

  const channelPrefs = prefs[channel];
  if (!channelPrefs) return false;

  return Boolean(channelPrefs[category]);
}
