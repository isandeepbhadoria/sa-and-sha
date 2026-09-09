import crypto from 'crypto';
import {
  PublishNotificationOptions,
  NotificationEngineResult,
  NotificationChannel,
  NotificationStatus,
  NotificationLog
} from './types';
import { sendEmailNotification } from './notificationProviders/emailProvider';
import { sendWhatsAppNotification } from './notificationProviders/whatsappProvider';
import { routeNotificationEvent } from './notificationRouter';
import { WHATSAPP_TEMPLATE_MAPPINGS } from './notificationTemplates';
import {
  recordNotificationLog,
  updateNotificationLogStatus,
  calculateNextRetryAt,
  logNotificationTimelineEvent,
  MAX_RETRY_COUNT
} from './notificationHelpers';


/**
 * Main Event-Driven Omnichannel Notification Dispatcher
 */
export async function publishNotification(
  adminDb: any,
  opts: PublishNotificationOptions
): Promise<NotificationEngineResult> {
  const { event, order, payload, idempotencyKey } = opts;
  const notificationId = idempotencyKey || `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const customerTarget = opts.customer || {
    profileId: opts.customerProfileId || order?.customer_profile_id || order?.customer_id || 'guest',
    customerId: opts.customerBusinessId || order?.customer_id,
    name: opts.customerName || order?.customer_name || 'Valued Customer',
    email: opts.recipientEmail || order?.customer_email,
    phone: opts.recipientPhone || order?.customer_phone
  };

  const activeChannelsOverride = opts.channelsOverride || opts.forceChannels;

  // 1. Determine active routed channels
  const routedChannels = await routeNotificationEvent(
    adminDb,
    event,
    customerTarget,
    activeChannelsOverride
  );

  if (routedChannels.length === 0) {
    return {
      notificationId,
      event,
      dispatchedChannels: [],
      results: {} as any,
      status: 'EXPIRED',
      success: true,
      logs: [],
      errors: []
    };
  }

  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ event, customer: customerTarget.profileId, orderId: order?.order_id, payload }))
    .digest('hex')
    .substring(0, 16);

  const nowIso = new Date().toISOString();
  const dispatchResults: Record<NotificationChannel, any> = {} as any;
  const createdLogs: NotificationLog[] = [];
  const errorList: string[] = [];

  // 2. Process active target channels concurrently with isolated error boundaries and idempotency
  const channelPromises = routedChannels.map(async (channel) => {
    const logId = `${notificationId}_${channel}`;
    const recipient = channel === 'email' ? (customerTarget.email || 'no-email@saandsha.com') : (customerTarget.phone || 'no-phone');

    // Idempotency check: prevent sending duplicate notification if already sent/delivered for this channel
    try {
      const existingDoc = await adminDb.collection('notification_logs').doc(logId).get();
      if (existingDoc.exists) {
        const existingData = existingDoc.data() as NotificationLog;
        if (['SENT', 'DELIVERED', 'READ', 'QUEUED', 'SUBMITTED'].includes(existingData.status)) {
          console.log(`[NOTIF ENGINE] Skipping duplicate notification dispatch for ${logId} (Status: ${existingData.status})`);
          const skippedRes = {
            success: true,
            provider: channel === 'email' ? 'smtp' : 'msg91_whatsapp',
            channel,
            providerMessageId: existingData.provider_message_id,
            metadata: { skipped: true }
          };
          dispatchResults[channel] = skippedRes;
          return { channel, success: true, skipped: true, log: existingData };
        }
      }
    } catch (idempotencyErr) {
      console.warn(`[NOTIF ENGINE] Idempotency check warning for ${logId}:`, idempotencyErr);
    }

    // Determine template name
    const templateConfig = WHATSAPP_TEMPLATE_MAPPINGS[event];
    const templateName = channel === 'whatsapp' ? (templateConfig?.templateName || 'kl_generic_v1') : undefined;

    // Create PROCESSING log record
    let logRecord: NotificationLog | null = null;
    try {
      logRecord = await recordNotificationLog(adminDb, {
        id: logId,
        notification_id: notificationId,
        customer_profile_id: customerTarget.profileId || 'guest',
        customer_business_id: customerTarget.customerId,
        event: event,
        event_type: event,
        channel,
        provider: channel === 'email' ? 'smtp' : 'msg91_whatsapp',
        template: templateName,
        payload_hash: payloadHash,
        recipient,
        status: 'PROCESSING',
        queued_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
        retry_count: 0,
        max_retries: MAX_RETRY_COUNT,
        metadata: {
          customerEmail: customerTarget.email,
          customerPhone: customerTarget.phone,
          orderId: order?.order_id
        }
      });
      if (logRecord) {
        createdLogs.push(logRecord);
      }
    } catch (logErr: any) {
      const logErrMsg = logErr?.message || `Failed to record notification log for ${channel}`;
      console.error(`[NOTIF ENGINE] Log recording error for ${channel}:`, logErr);
      if (!errorList.includes(logErrMsg)) errorList.push(logErrMsg);
      const failRes = {
        success: false,
        provider: channel === 'email' ? 'smtp' : 'msg91_whatsapp',
        channel,
        error: logErrMsg
      };
      dispatchResults[channel] = failRes;
      return { channel, success: false, res: failRes };
    }

    let res: any;
    try {
      if (channel === 'email') {
        res = await sendEmailNotification({
          to: customerTarget.email || order?.customer_email || '',
          subject: `Notification: ${event}`,
          order,
          eventType: event,
          targetStatus: event === 'ORDER_CONFIRMED' || event === 'PAYMENT_RECEIVED' ? 'processing' :
                        event === 'ORDER_SHIPPED' || event === 'OUT_FOR_DELIVERY' ? 'dispatched' :
                        event === 'ORDER_DELIVERED' ? 'delivered' :
                        event === 'ORDER_CANCELLED' ? 'cancelled' :
                        event === 'REFUND_INITIATED' ? 'refund_initiated' :
                        event === 'REFUND_COMPLETED' ? 'refund_completed' : undefined
        });
      } else if (channel === 'whatsapp') {
        res = await sendWhatsAppNotification({
          toPhone: customerTarget.phone || order?.customer_phone || '',
          eventType: event,
          params: {
            customerName: customerTarget.name,
            orderId: order?.order_id,
            grandTotal: order?.grand_total,
            trackingNumber: order?.tracking_number,
            courierName: order?.courier_name,
            amount: payload?.amount,
            points: payload?.points,
            tier: payload?.tier,
            otp: payload?.otp,
            customMessage: payload?.customMessage
          },
          order
        });
      } else {
        res = {
          success: false,
          provider: 'unknown',
          channel,
          error: `Channel ${channel} is not yet integrated.`
        };
      }
    } catch (err: any) {
      res = {
        success: false,
        provider: channel === 'email' ? 'smtp' : 'msg91_whatsapp',
        channel,
        error: err.message || `Unhandled exception sending ${channel} notification`
      };
    }

    dispatchResults[channel] = res;

    if (res.success) {
      try {
        await updateNotificationLogStatus(adminDb, logId, 'SENT', {
          provider_message_id: res.providerMessageId,
          template: templateName,
          sent_at: new Date().toISOString()
        });

        // Register CRM timeline entry
        await logNotificationTimelineEvent(
          adminDb,
          customerTarget.profileId,
          channel,
          event,
          'SENT',
          res.providerMessageId
        );
      } catch (logUpdateErr: any) {
        console.error(`[NOTIF ENGINE] Error updating SENT log for ${channel}:`, logUpdateErr);
      }
    } else {
      if (res.error && !errorList.includes(res.error)) errorList.push(res.error);
      const nextRetryAt = calculateNextRetryAt(0);

      try {
        await updateNotificationLogStatus(adminDb, logId, 'FAILED', {
          failed_at: new Date().toISOString(),
          error_message: res.error,
          next_retry_at: nextRetryAt || undefined,
          status: nextRetryAt ? 'RETRYING' : 'FAILED'
        });
      } catch (logUpdateErr: any) {
        console.error(`[NOTIF ENGINE] Error updating FAILED log for ${channel}:`, logUpdateErr);
      }
    }

    return { channel, success: res.success, res };
  });

  const settledResults = await Promise.allSettled(channelPromises);

  // Post-process any rejected promises from Promise.allSettled
  settledResults.forEach((settled, idx) => {
    const channel = routedChannels[idx];
    if (settled.status === 'rejected') {
      const errMsg = settled.reason?.message || String(settled.reason) || `Unhandled rejection for ${channel}`;
      if (!errorList.includes(errMsg)) {
        errorList.push(errMsg);
      }
      if (!dispatchResults[channel]) {
        dispatchResults[channel] = {
          success: false,
          provider: channel === 'email' ? 'smtp' : channel === 'whatsapp' ? 'msg91_whatsapp' : 'unknown',
          channel,
          error: errMsg
        };
      }
    }
  });

  const hasFailures = routedChannels.length === 0 || routedChannels.some((ch) => !dispatchResults[ch]?.success);
  const finalStatus: NotificationStatus = (hasFailures || errorList.length > 0) ? 'FAILED' : 'SENT';

  return {
    notificationId,
    event,
    dispatchedChannels: routedChannels,
    results: dispatchResults,
    status: finalStatus,
    success: !hasFailures && errorList.length === 0,
    logs: createdLogs,
    errors: errorList
  };
}

/**
 * Automatic background retry processor for failed notifications
 */
export async function retryFailedNotifications(
  adminDb: any
): Promise<{ processed: number; retried: number; failed: number }> {
  const nowIso = new Date().toISOString();

  const retrySnap = await adminDb
    .collection('notification_logs')
    .where('status', '==', 'RETRYING')
    .where('next_retry_at', '<=', nowIso)
    .limit(50)
    .get();

  let processed = 0;
  let retried = 0;
  let failed = 0;

  for (const docSnap of retrySnap.docs) {
    processed++;
    const log: NotificationLog = docSnap.data();

    const customer: any = {
      profileId: log.customer_profile_id,
      customerId: log.customer_business_id,
      email: log.metadata?.customerEmail,
      phone: log.metadata?.customerPhone,
      name: 'Customer'
    };

    let res;
    if (log.channel === 'email') {
      res = await sendEmailNotification({
        to: customer.email || '',
        subject: `Notification Retry: ${log.event_type}`
      });
    } else if (log.channel === 'whatsapp') {
      res = await sendWhatsAppNotification({
        toPhone: customer.phone || '',
        eventType: log.event_type,
        params: {
          customerName: customer.name,
          orderId: log.metadata?.orderId
        }
      });
    } else {
      res = { success: false, templateUsed: 'none', error: 'Unsupported channel' };
    }

    const nextRetryCount = log.retry_count + 1;

    if (res.success) {
      retried++;
      await updateNotificationLogStatus(adminDb, log.id, 'SENT', {
        provider_message_id: res.providerMessageId,
        retry_count: nextRetryCount,
        sent_at: new Date().toISOString()
      });
    } else {
      failed++;
      const nextRetryAt = calculateNextRetryAt(nextRetryCount);
      await updateNotificationLogStatus(adminDb, log.id, nextRetryAt ? 'RETRYING' : 'FAILED', {
        retry_count: nextRetryCount,
        error_message: res.error,
        next_retry_at: nextRetryAt || undefined,
        failed_at: new Date().toISOString()
      });
    }
  }

  return { processed, retried, failed };
}
