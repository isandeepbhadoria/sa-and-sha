import {
  NotificationLog,
  NotificationStatus,
  NotificationChannel,
  NotificationEventType
} from './types';
import { createCustomerTimelineEvent } from '../crmHelpers';

export const RETRY_DELAYS_SECONDS = [60, 300, 1800, 21600, 86400]; // 1m, 5m, 30m, 6h, 24h
export const MAX_RETRY_COUNT = 5;

/**
 * Record a new notification log in Firestore
 */
export async function recordNotificationLog(
  adminDb: any,
  log: Omit<NotificationLog, 'id'> & { id?: string }
): Promise<NotificationLog> {
  const docRef = log.id
    ? adminDb.collection('notification_logs').doc(log.id)
    : adminDb.collection('notification_logs').doc();

  const nowIso = new Date().toISOString();
  const evt = log.event || log.event_type;
  const docId = log.id || docRef.id || `notif_log_${Date.now()}`;

  const rawData: Record<string, any> = {
    id: docId,
    notification_id: log.notification_id,
    customer_profile_id: log.customer_profile_id || 'guest',
    event: evt,
    event_type: evt,
    channel: log.channel,
    provider: log.provider || 'unknown',
    provider_message_id: log.provider_message_id || '',
    recipient: log.recipient || '',
    status: log.status || 'PROCESSING',
    queued_at: log.queued_at || nowIso,
    created_at: log.created_at || log.queued_at || nowIso,
    updated_at: log.updated_at || nowIso,
    retry_count: log.retry_count ?? 0,
    max_retries: log.max_retries ?? MAX_RETRY_COUNT,
    metadata: log.metadata || {}
  };

  if (log.customer_business_id !== undefined) rawData.customer_business_id = log.customer_business_id;
  if (log.template !== undefined) rawData.template = log.template;
  if (log.payload_hash !== undefined) rawData.payload_hash = log.payload_hash;
  if (log.next_retry_at !== undefined) rawData.next_retry_at = log.next_retry_at;
  if (log.error_message !== undefined) rawData.error_message = log.error_message;
  if (log.sent_at !== undefined) rawData.sent_at = log.sent_at;
  if (log.delivered_at !== undefined) rawData.delivered_at = log.delivered_at;
  if (log.read_at !== undefined) rawData.read_at = log.read_at;
  if (log.failed_at !== undefined) rawData.failed_at = log.failed_at;

  const cleanLog = Object.fromEntries(
    Object.entries(rawData).filter(([_, v]) => v !== undefined)
  );

  await docRef.set(cleanLog, { merge: true });
  return cleanLog as NotificationLog;
}

/**
 * Update an existing notification log status
 */
export async function updateNotificationLogStatus(
  adminDb: any,
  logId: string,
  status: NotificationStatus,
  updates?: Partial<NotificationLog>
): Promise<void> {
  const docRef = adminDb.collection('notification_logs').doc(logId);
  const nowIso = new Date().toISOString();

  const dataToUpdate: Record<string, any> = {
    status,
    updated_at: nowIso,
    ...updates
  };

  if (status === 'SENT' && !dataToUpdate.sent_at) dataToUpdate.sent_at = nowIso;
  if (status === 'DELIVERED' && !dataToUpdate.delivered_at) dataToUpdate.delivered_at = nowIso;
  if (status === 'READ' && !dataToUpdate.read_at) dataToUpdate.read_at = nowIso;
  if (status === 'FAILED' && !dataToUpdate.failed_at) dataToUpdate.failed_at = nowIso;

  const cleanData = Object.fromEntries(
    Object.entries(dataToUpdate).filter(([_, v]) => v !== undefined)
  );

  await docRef.set(cleanData, { merge: true });
}

/**
 * Calculate next retry timestamp based on retry count
 */
export function calculateNextRetryAt(retryCount: number): string | null {
  if (retryCount >= MAX_RETRY_COUNT) return null;
  const delaySec = RETRY_DELAYS_SECONDS[Math.min(retryCount, RETRY_DELAYS_SECONDS.length - 1)];
  return new Date(Date.now() + delaySec * 1000).toISOString();
}

/**
 * Register CRM timeline event when a notification is dispatched/delivered
 */
export async function logNotificationTimelineEvent(
  adminDb: any,
  profileId: string,
  channel: NotificationChannel,
  event: NotificationEventType,
  status: NotificationStatus,
  providerMessageId?: string
): Promise<void> {
  if (!profileId) return;

  const channelLabel = channel.toUpperCase();
  const title = `${channelLabel} Notification ${status === 'SENT' || status === 'DELIVERED' ? 'Sent' : status}`;
  const description = `Triggered event: ${event}. Provider Message Ref: ${providerMessageId || 'N/A'}`;

  await createCustomerTimelineEvent(
    adminDb,
    profileId,
    'notification_sent' as any,
    title,
    description,
    'system',
    {
      metadata: {
        channel,
        eventType: event,
        status,
        providerMessageId
      }
    }
  );
}

/**
 * Fetch notification metrics dashboard totals
 */
export async function fetchNotificationMetrics(adminDb: any): Promise<{
  totalToday: number;
  emailSentToday: number;
  whatsappSentToday: number;
  deliveryRate: number;
  readRate: number;
  failureRate: number;
  retriesToday: number;
}> {
  const todayStartIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const snap = await adminDb
    .collection('notification_logs')
    .where('queued_at', '>=', todayStartIso)
    .limit(1000)
    .get();

  let totalToday = 0;
  let emailSentToday = 0;
  let whatsappSentToday = 0;
  let deliveredCount = 0;
  let readCount = 0;
  let failedCount = 0;
  let retriesToday = 0;

  snap.docs.forEach((doc: any) => {
    const data: NotificationLog = doc.data();
    totalToday++;

    if (data.channel === 'email' && (data.status === 'SENT' || data.status === 'DELIVERED')) emailSentToday++;
    if (data.channel === 'whatsapp' && (data.status === 'SENT' || data.status === 'DELIVERED')) whatsappSentToday++;

    if (data.status === 'DELIVERED') deliveredCount++;
    if (data.status === 'READ') readCount++;
    if (data.status === 'FAILED') failedCount++;
    if (data.retry_count > 0) retriesToday += data.retry_count;
  });

  const base = totalToday || 1;
  return {
    totalToday,
    emailSentToday,
    whatsappSentToday,
    deliveryRate: Math.round(((deliveredCount + emailSentToday + whatsappSentToday) / base) * 100),
    readRate: Math.round((readCount / base) * 100),
    failureRate: Math.round((failedCount / base) * 100),
    retriesToday
  };
}
