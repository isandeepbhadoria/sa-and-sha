import {
  getCustomerNotificationPreferences,
  updateCustomerNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES
} from './notificationPreferences';
import {
  getGlobalNotificationSettings
} from './notificationRouter';
import {
  recordNotificationLog,
  updateNotificationLogStatus,
  fetchNotificationMetrics
} from './notificationHelpers';
import {
  publishNotification,
  retryFailedNotifications
} from './notificationEngine';
import {
  NotificationEventType,
  NotificationChannel,
  NotificationStatus,
  NotificationPreferences,
  NotificationLog,
  PublishNotificationOptions
} from './types';
import { sendEmailNotification } from './notificationProviders/emailProvider';
import { sendWhatsAppNotification } from './notificationProviders/whatsappProvider';

export * from './types';
export * from './notificationTemplates';
export * from './notificationPreferences';
export * from './notificationRouter';
export * from './notificationHelpers';
export * from './whatsappService';
export * from './notificationProviders/emailProvider';
export * from './notificationProviders/whatsappProvider';
export * from './notificationEngine';

export function getDefaultNotificationPreferences(): NotificationPreferences {
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

/**
 * Save notification settings map to Firestore
 */
export async function saveNotificationSettings(adminDb: any, settings: any): Promise<void> {
  await adminDb.collection('notification_settings').doc('global_router').set({
    events: settings,
    updated_at: new Date().toISOString()
  }, { merge: true });
}

/**
 * Fetch notification settings helper
 */
export async function fetchNotificationSettings(adminDb: any): Promise<any> {
  return await getGlobalNotificationSettings(adminDb);
}

/**
 * Query notification logs for admin or customer
 */
export async function getNotificationLogs(
  adminDb: any,
  filters: {
    customerProfileId?: string;
    channel?: NotificationChannel;
    status?: NotificationStatus;
    eventType?: NotificationEventType;
    limit?: number;
  }
): Promise<NotificationLog[]> {
  let query: any = adminDb.collection('notification_logs');

  if (filters.customerProfileId) {
    query = query.where('customer_profile_id', '==', filters.customerProfileId);
  }
  if (filters.channel) {
    query = query.where('channel', '==', filters.channel);
  }
  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }
  if (filters.eventType) {
    query = query.where('event_type', '==', filters.eventType);
  }

  const snap = await query.limit(filters.limit || 100).get();
  const logs: NotificationLog[] = [];
  snap.docs.forEach((doc: any) => {
    logs.push(doc.data() as NotificationLog);
  });

  return logs.sort((a, b) => new Date(b.queued_at).getTime() - new Date(a.queued_at).getTime());
}

/**
 * Get single log by ID
 */
export async function getNotificationLogById(adminDb: any, id: string): Promise<NotificationLog | null> {
  const docSnap = await adminDb.collection('notification_logs').doc(id).get();
  if (!docSnap.exists) return null;
  return docSnap.data() as NotificationLog;
}

/**
 * Single notification manual retry helper by ID
 */
export async function retryNotification(adminDb: any, id: string): Promise<{ success: boolean; log?: NotificationLog; error?: string }> {
  const log = await getNotificationLogById(adminDb, id);
  if (!log) return { success: false, error: 'Notification log not found' };

  const customer: any = {
    profileId: log.customer_profile_id || 'guest',
    customerId: log.customer_business_id,
    email: log.metadata?.customerEmail,
    phone: log.metadata?.customerPhone,
    name: 'Customer'
  };

  let res;
  if (log.channel === 'email') {
    res = await sendEmailNotification({
      to: log.recipient || log.metadata?.customerEmail || '',
      subject: `[Retry] Notification for ${log.event_type}`
    });
  } else if (log.channel === 'whatsapp') {
    res = await sendWhatsAppNotification({
      toPhone: log.recipient || log.metadata?.customerPhone || '',
      eventType: log.event_type,
      params: {
        customerName: 'Customer',
        orderId: log.metadata?.orderId
      }
    });
  } else {
    res = { success: false, templateUsed: 'none', error: 'Unsupported channel' };
  }

  const nextRetryCount = log.retry_count + 1;

  if (res.success) {
    await updateNotificationLogStatus(adminDb, id, 'SENT', {
      provider_message_id: res.providerMessageId,
      retry_count: nextRetryCount,
      sent_at: new Date().toISOString()
    });
    const updated = await getNotificationLogById(adminDb, id);
    return { success: true, log: updated || undefined };
  } else {
    await updateNotificationLogStatus(adminDb, id, 'FAILED', {
      retry_count: nextRetryCount,
      error_message: res.error,
      failed_at: new Date().toISOString()
    });
    const updated = await getNotificationLogById(adminDb, id);
    return { success: false, error: res.error, log: updated || undefined };
  }
}
