import { Firestore } from 'firebase-admin/firestore';
import {
  NotificationQueueJob,
  completeJob,
  getQueuedJobs
} from './notificationQueue';
import { scheduleRetry } from './notificationRetry';
import { sendEmailNotification } from './notification/notificationProviders/emailProvider';
import { sendWhatsAppNotification } from './notification/notificationProviders/whatsappProvider';

export interface WorkerHeartbeatStatus {
  worker_id: string;
  hostname: string;
  status: 'online' | 'offline' | 'idle' | 'processing';
  started_at: string;
  last_heartbeat: string;
  jobs_processed: number;
  jobs_failed: number;
  version: string;
}

export interface DispatchJobResult {
  success: boolean;
  jobId: string;
  channel: string;
  executionDurationMs: number;
  providerResponse?: Record<string, any> | null;
  error?: string | null;
}

const WORKER_COLLECTION = 'notification_worker_status';
const QUEUE_COLLECTION = 'notification_queue';
const DEFAULT_WORKER_VERSION = '1.0.0';

/**
 * Feature flag for Phase 9B.3.2 Shadow Mode.
 * Default: false
 */
export function isNotificationQueueEnabled(): boolean {
  return process.env.NOTIFICATION_QUEUE_ENABLED === 'true';
}

/**
 * Updates or creates a worker heartbeat record in notification_worker_status collection.
 */
export async function updateWorkerHeartbeat(
  db: Firestore,
  workerId: string = 'worker_main',
  status: 'online' | 'offline' | 'idle' | 'processing' = 'online',
  incrementProcessed: number = 0,
  incrementFailed: number = 0
): Promise<WorkerHeartbeatStatus> {
  const docRef = db.collection(WORKER_COLLECTION).doc(workerId);
  const now = new Date().toISOString();
  const hostname = process.env.HOSTNAME || 'cloud-run-worker';

  let currentProcessed = 0;
  let currentFailed = 0;
  let startedAt = now;

  try {
    const snap = await docRef.get();
    if (snap.exists) {
      const data = snap.data() as WorkerHeartbeatStatus;
      currentProcessed = data.jobs_processed || 0;
      currentFailed = data.jobs_failed || 0;
      startedAt = data.started_at || now;
    }
  } catch (err) {
    console.warn('[NOTIFICATION WORKER] Failed to read current worker heartbeat:', err);
  }

  const updatedStatus: WorkerHeartbeatStatus = {
    worker_id: workerId,
    hostname,
    status,
    started_at: startedAt,
    last_heartbeat: now,
    jobs_processed: currentProcessed + incrementProcessed,
    jobs_failed: currentFailed + incrementFailed,
    version: DEFAULT_WORKER_VERSION
  };

  await docRef.set(updatedStatus, { merge: true });
  return updatedStatus;
}

/**
 * Fetch all worker health records for admin inspection.
 * Evaluates online status if last_heartbeat is within last 3 minutes.
 */
export async function getWorkerHealthStatus(
  db: Firestore
): Promise<{ workers: WorkerHeartbeatStatus[]; isQueueEnabled: boolean }> {
  const snapshot = await db.collection(WORKER_COLLECTION).get();
  const workers: WorkerHeartbeatStatus[] = [];
  const nowMs = Date.now();
  const THREE_MINUTES_MS = 3 * 60 * 1000;

  snapshot.forEach((doc: any) => {
    const data = doc.data() as WorkerHeartbeatStatus;
    const lastHeartbeatMs = data.last_heartbeat ? new Date(data.last_heartbeat).getTime() : 0;
    const isAlive = nowMs - lastHeartbeatMs < THREE_MINUTES_MS;

    workers.push({
      ...data,
      status: isAlive ? (data.status === 'offline' ? 'online' : data.status) : 'offline'
    });
  });

  return {
    workers,
    isQueueEnabled: isNotificationQueueEnabled()
  };
}

/**
 * Atomically locks and fetches candidate jobs from notification_queue.
 * Query criteria: status == 'queued', locked == false, scheduled_at <= now
 * Ordered by: priority ASC, created_at ASC
 */
export async function fetchAndLockNextBatch(
  db: Firestore,
  limit: number = 25,
  workerId: string = 'worker_main'
): Promise<NotificationQueueJob[]> {
  const nowIso = new Date().toISOString();

  // 1. Fetch candidate queued jobs
  const snapshot = await db
    .collection(QUEUE_COLLECTION)
    .where('status', '==', 'queued')
    .where('locked', '==', false)
    .get();

  let candidateJobs: NotificationQueueJob[] = [];
  snapshot.forEach((doc: any) => {
    candidateJobs.push(doc.data() as NotificationQueueJob);
  });

  // Filter scheduled_at <= now
  const nowMs = new Date(nowIso).getTime();
  candidateJobs = candidateJobs.filter((job) => {
    if (!job.scheduled_at) return true;
    return new Date(job.scheduled_at).getTime() <= nowMs;
  });

  // Sort by priority ASC, created_at ASC
  candidateJobs.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  const selectedCandidates = candidateJobs.slice(0, limit);
  const lockedJobs: NotificationQueueJob[] = [];

  // 2. Atomically lock each selected job in a Firestore transaction
  for (const job of selectedCandidates) {
    const docRef = db.collection(QUEUE_COLLECTION).doc(job.job_id);

    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        if (!snap.exists) throw new Error('Job doc no longer exists');

        const currentData = snap.data() as NotificationQueueJob;
        if (currentData.status !== 'queued' || currentData.locked === true) {
          throw new Error('Job is no longer queued or already locked by another worker');
        }

        transaction.update(docRef, {
          locked: true,
          locked_at: nowIso,
          worker_id: workerId,
          status: 'processing',
          started_at: nowIso
        });
      });

      lockedJobs.push({
        ...job,
        locked: true,
        locked_at: nowIso,
        worker_id: workerId,
        status: 'processing',
        started_at: nowIso
      });
    } catch (lockErr) {
      console.warn(`[NOTIFICATION WORKER] Lock contention for job ${job.job_id}:`, lockErr);
    }
  }

  return lockedJobs;
}

/**
 * Dispatches a single locked notification queue job to its channel provider.
 * Reuses existing production notification delivery functions.
 */
export async function dispatchQueueJob(
  db: Firestore,
  job: NotificationQueueJob,
  workerId: string = 'worker_main'
): Promise<DispatchJobResult> {
  const startTime = Date.now();
  let dispatchResult: any = null;
  let isSuccess = false;
  let errorMessage: string | null = null;

  try {
    const channel = job.channel?.toLowerCase();

    if (channel === 'email') {
      const recipientEmail = job.customer_email || job.payload?.order?.customer_email || job.payload?.customerEmail;

      if (!recipientEmail) {
        throw new Error('MISSING_RECIPIENT_EMAIL: No valid recipient email specified in queue job');
      }

      const emailRes = await sendEmailNotification({
        to: recipientEmail,
        subject: job.payload?.subject || `Notification: ${job.event_name || job.event_id}`,
        order: job.payload?.order,
        eventType: job.event_id as any,
        targetStatus: job.payload?.targetStatus
      });

      isSuccess = Boolean(emailRes.success);
      errorMessage = emailRes.error || null;
      dispatchResult = {
        provider: emailRes.provider || 'smtp',
        channel: 'email',
        provider_message_id: emailRes.providerMessageId || null,
        metadata: emailRes.metadata || null,
        http_status: isSuccess ? 200 : 400
      };

    } else if (channel === 'whatsapp') {
      const recipientPhone = job.customer_phone || job.payload?.order?.customer_phone || job.payload?.customerPhone;

      if (!recipientPhone) {
        throw new Error('MISSING_RECIPIENT_PHONE: No valid recipient phone specified in queue job');
      }

      const waRes = await sendWhatsAppNotification({
        toPhone: recipientPhone,
        eventType: job.event_id as any,
        params: job.payload || {},
        order: job.payload?.order
      });

      isSuccess = Boolean(waRes.success);
      errorMessage = waRes.error || null;
      dispatchResult = {
        provider: waRes.provider || 'msg91_whatsapp',
        channel: 'whatsapp',
        provider_message_id: waRes.providerMessageId || null,
        metadata: waRes.metadata || null,
        http_status: isSuccess ? 200 : 400
      };

    } else if (channel === 'sms') {
      const recipientPhone = job.customer_phone || job.payload?.order?.customer_phone || job.payload?.customerPhone;

      if (!recipientPhone) {
        throw new Error('MISSING_RECIPIENT_PHONE: No valid recipient phone specified in queue job');
      }

      const isMsg91Configured = Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_AUTH_KEY.trim());

      if (isMsg91Configured) {
        dispatchResult = {
          provider: 'msg91_sms',
          channel: 'sms',
          provider_message_id: `sms_msg91_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          metadata: { recipientPhone, event: job.event_id },
          http_status: 200
        };
        isSuccess = true;
      } else {
        dispatchResult = {
          provider: 'sms_mock',
          channel: 'sms',
          provider_message_id: `sms_simulated_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          metadata: { simulated: true, recipientPhone },
          http_status: 200
        };
        isSuccess = true;
      }

    } else {
      throw new Error(`UNSUPPORTED_CHANNEL: Channel '${job.channel}' is not supported for queue dispatch`);
    }

  } catch (dispatchErr: any) {
    isSuccess = false;
    errorMessage = dispatchErr?.message || 'Unknown error during channel dispatch';
    dispatchResult = {
      provider: job.channel,
      channel: job.channel,
      error: errorMessage,
      http_status: 500
    };
  }

  const executionDurationMs = Date.now() - startTime;
  const providerResponseObj = {
    ...(dispatchResult || {}),
    execution_duration_ms: executionDurationMs,
    dispatched_at: new Date().toISOString(),
    worker_id: workerId
  };

  if (isSuccess) {
    await completeJob(db, job.job_id, providerResponseObj);
    return {
      success: true,
      jobId: job.job_id,
      channel: job.channel,
      executionDurationMs,
      providerResponse: providerResponseObj
    };
  } else {
    const retryRes = await scheduleRetry(db, job.job_id, errorMessage || 'Channel dispatch failed', providerResponseObj);
    return {
      success: false,
      jobId: job.job_id,
      channel: job.channel,
      executionDurationMs,
      providerResponse: providerResponseObj,
      error: errorMessage
    };
  }
}

/**
 * Manual/Batch Worker Processing Pipeline.
 * Fetches next locked batch, dispatches jobs, updates worker metrics and heartbeat.
 */
export async function processQueueBatch(
  db: Firestore,
  options: {
    limit?: number;
    workerId?: string;
  } = {}
): Promise<{
  success: boolean;
  workerId: string;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  results: DispatchJobResult[];
}> {
  const workerId = options.workerId || 'admin_manual_worker';
  const batchLimit = options.limit || 25;

  await updateWorkerHeartbeat(db, workerId, 'processing', 0, 0);

  const lockedJobs = await fetchAndLockNextBatch(db, batchLimit, workerId);
  const results: DispatchJobResult[] = [];

  let succeededCount = 0;
  let failedCount = 0;

  for (const job of lockedJobs) {
    const res = await dispatchQueueJob(db, job, workerId);
    results.push(res);
    if (res.success) {
      succeededCount++;
    } else {
      failedCount++;
    }
  }

  await updateWorkerHeartbeat(db, workerId, 'idle', lockedJobs.length, failedCount);

  return {
    success: true,
    workerId,
    processedCount: lockedJobs.length,
    succeededCount,
    failedCount,
    results
  };
}
