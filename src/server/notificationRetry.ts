import { Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { NotificationQueueJob, QueueChannel, getDefaultPriority } from './notificationQueue';
import { sanitizeError } from './notificationMonitoring';

/**
 * Centralized Retry Backoff Schedule (in milliseconds)
 * Attempt 1: 1 minute
 * Attempt 2: 5 minutes
 * Attempt 3: 30 minutes
 * Attempt 4: 2 hours
 * Attempt 5: 24 hours
 */
export const RETRY_BACKOFF_SCHEDULE_MS = [
  60 * 1000,          // Attempt 1: 1 minute (60,000 ms)
  5 * 60 * 1000,      // Attempt 2: 5 minutes (300,000 ms)
  30 * 60 * 1000,     // Attempt 3: 30 minutes (1,800,000 ms)
  2 * 60 * 60 * 1000, // Attempt 4: 2 hours (7,200,000 ms)
  24 * 60 * 60 * 1000 // Attempt 5: 24 hours (86,400,000 ms)
];

export const DEFAULT_MAX_ATTEMPTS = 5;
const QUEUE_COLLECTION = 'notification_queue';
const DEAD_LETTER_COLLECTION = 'notification_dead_letter';

export interface NotificationDeadLetterDoc {
  dead_letter_id: string;
  original_job_id: string;
  event_id: string;
  event_name?: string;
  order_id?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  channel: QueueChannel;
  provider?: string | null;
  payload: Record<string, any>;
  template_id?: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string;
  provider_response?: Record<string, any> | null;
  failed_at: string;
  dead_lettered_at: string;
  idempotency_key: string;
  reason?: string;
}

/**
 * Calculate the next ISO timestamp for retry backoff based on attempts count.
 * @param attempts The 1-based attempt index that just failed (1 for 1st retry, 2 for 2nd retry, etc.)
 * @param nowMs Base timestamp in milliseconds
 */
export function calculateNextRetryAt(attempts: number, nowMs: number = Date.now()): string | null {
  if (attempts < 1 || attempts > RETRY_BACKOFF_SCHEDULE_MS.length) {
    return null;
  }
  const delayMs = RETRY_BACKOFF_SCHEDULE_MS[attempts - 1];
  return new Date(nowMs + delayMs).toISOString();
}

/**
 * Schedules a retry for a failed queue job or moves it to Dead-Letter Queue if max_attempts is reached.
 * Executes atomically in a Firestore transaction to prevent concurrent modification.
 */
export async function scheduleRetry(
  db: Firestore,
  jobId: string,
  errorMsg: string,
  providerResponse?: Record<string, any> | null
): Promise<{
  success: boolean;
  retryState: 'scheduled' | 'exhausted';
  nextRetryAt?: string | null;
  deadLetterId?: string | null;
}> {
  const docRef = db.collection(QUEUE_COLLECTION).doc(jobId);
  const nowIso = new Date().toISOString();
  const safeErr = sanitizeError(errorMsg);

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) {
        return { success: false, retryState: 'exhausted' as const };
      }

      const job = snap.data() as NotificationQueueJob;

      // Completed or cancelled jobs must never be retried
      if (job.status === 'completed' || job.status === 'cancelled') {
        return { success: false, retryState: 'exhausted' as const };
      }

      const nextAttempts = (job.attempts || 0) + 1;
      const maxAttempts = job.max_attempts || DEFAULT_MAX_ATTEMPTS;

      // Check if retry allowed
      if (nextAttempts < maxAttempts) {
        const nextRetryAt = calculateNextRetryAt(nextAttempts, Date.now());

        if (nextRetryAt) {
          transaction.update(docRef, {
            attempts: nextAttempts,
            status: 'queued',
            retry_state: 'scheduled',
            next_retry_at: nextRetryAt,
            scheduled_at: nextRetryAt,
            last_attempt_at: nowIso,
            last_error: safeErr,
            provider_response: providerResponse || null,
            locked: false,
            locked_at: null,
            started_at: null
          });

          return {
            success: true,
            retryState: 'scheduled' as const,
            nextRetryAt
          };
        }
      }

      // Max attempts reached or invalid backoff: Move to Dead-Letter Queue
      const dlqRef = db.collection(DEAD_LETTER_COLLECTION).doc();
      const deadLetterId = dlqRef.id;

      const deadLetterDoc: NotificationDeadLetterDoc = {
        dead_letter_id: deadLetterId,
        original_job_id: job.job_id,
        event_id: job.event_id,
        event_name: job.event_name || job.event_id,
        order_id: job.order_id || null,
        customer_id: job.customer_id || null,
        customer_email: job.customer_email || null,
        customer_phone: job.customer_phone || null,
        channel: job.channel,
        provider: job.provider || null,
        payload: job.payload || {},
        template_id: job.template_id || null,
        attempts: nextAttempts,
        max_attempts: maxAttempts,
        last_error: safeErr,
        provider_response: providerResponse || null,
        failed_at: nowIso,
        dead_lettered_at: nowIso,
        idempotency_key: job.idempotency_key || `idemp_${job.job_id}`,
        reason: `Max attempts (${maxAttempts}) exceeded`
      };

      transaction.create(dlqRef, deadLetterDoc);

      transaction.update(docRef, {
        attempts: nextAttempts,
        status: 'failed',
        retry_state: 'exhausted',
        next_retry_at: null,
        scheduled_at: null,
        last_attempt_at: nowIso,
        failed_at: nowIso,
        last_error: safeErr,
        provider_response: providerResponse || null,
        dead_letter_id: deadLetterId,
        dead_lettered_at: nowIso,
        locked: false,
        locked_at: null
      });

      return {
        success: true,
        retryState: 'exhausted' as const,
        deadLetterId
      };
    });
  } catch (err) {
    console.error(`[NOTIFICATION RETRY] Error scheduling retry for job ${jobId}:`, err);
    return { success: false, retryState: 'exhausted' as const };
  }
}

/**
 * Manually or forcefully moves a failed queue job to the Dead-Letter Queue.
 */
export async function moveToDeadLetter(
  db: Firestore,
  jobId: string,
  reason: string = 'Manually moved to DLQ'
): Promise<{ success: boolean; deadLetterId?: string; error?: string }> {
  const docRef = db.collection(QUEUE_COLLECTION).doc(jobId);
  const nowIso = new Date().toISOString();

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) return { success: false, error: 'Job not found' };

      const job = snap.data() as NotificationQueueJob;
      if (job.dead_letter_id) {
        return { success: false, error: 'Job is already in dead-letter queue', deadLetterId: job.dead_letter_id };
      }

      const dlqRef = db.collection(DEAD_LETTER_COLLECTION).doc();
      const deadLetterId = dlqRef.id;

      const deadLetterDoc: NotificationDeadLetterDoc = {
        dead_letter_id: deadLetterId,
        original_job_id: job.job_id,
        event_id: job.event_id,
        event_name: job.event_name || job.event_id,
        order_id: job.order_id || null,
        customer_id: job.customer_id || null,
        customer_email: job.customer_email || null,
        customer_phone: job.customer_phone || null,
        channel: job.channel,
        provider: job.provider || null,
        payload: job.payload || {},
        template_id: job.template_id || null,
        attempts: job.attempts || 1,
        max_attempts: job.max_attempts || DEFAULT_MAX_ATTEMPTS,
        last_error: sanitizeError(job.last_error || reason),
        provider_response: job.provider_response || null,
        failed_at: job.failed_at || nowIso,
        dead_lettered_at: nowIso,
        idempotency_key: job.idempotency_key || `idemp_${job.job_id}`,
        reason
      };

      transaction.create(dlqRef, deadLetterDoc);

      transaction.update(docRef, {
        status: 'failed',
        retry_state: 'exhausted',
        dead_letter_id: deadLetterId,
        dead_lettered_at: nowIso,
        locked: false,
        locked_at: null
      });

      return { success: true, deadLetterId };
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to move to DLQ' };
  }
}

/**
 * Fetch jobs ready for retry (status == 'queued', retry_state == 'scheduled', next_retry_at <= now).
 */
export async function getRetryableJobs(
  db: Firestore,
  limit: number = 25
): Promise<NotificationQueueJob[]> {
  const nowIso = new Date().toISOString();
  const snap = await db.collection(QUEUE_COLLECTION)
    .where('status', '==', 'queued')
    .where('retry_state', '==', 'scheduled')
    .where('locked', '==', false)
    .limit(limit)
    .get();

  const jobs: NotificationQueueJob[] = [];
  snap.forEach((doc) => {
    const data = doc.data() as NotificationQueueJob;
    if (data.next_retry_at && new Date(data.next_retry_at).getTime() <= new Date(nowIso).getTime()) {
      jobs.push(data);
    }
  });

  return jobs;
}

/**
 * Admin action: Retries a failed or scheduled job immediately by setting status='queued' and scheduled_at=now.
 */
export async function retryFailedJob(
  db: Firestore,
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  const docRef = db.collection(QUEUE_COLLECTION).doc(jobId);
  const nowIso = new Date().toISOString();

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) return { success: false, error: 'Job not found' };

      const job = snap.data() as NotificationQueueJob;
      if (job.status === 'completed') {
        return { success: false, error: 'Cannot retry a completed job' };
      }
      if (job.status === 'cancelled') {
        return { success: false, error: 'Cannot retry a cancelled job' };
      }

      transaction.update(docRef, {
        status: 'queued',
        retry_state: 'scheduled',
        scheduled_at: nowIso,
        next_retry_at: nowIso,
        locked: false,
        locked_at: null,
        last_error: null
      });

      return { success: true };
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to retry job' };
  }
}

/**
 * Admin action: Requeues a dead-letter record into notification_queue as a new queued job.
 * Preserves linkage to original job and DLQ record. Does NOT delete the DLQ record.
 */
export async function requeueDeadLetterJob(
  db: Firestore,
  deadLetterId: string
): Promise<{ success: boolean; newJobId?: string; error?: string }> {
  const dlqRef = db.collection(DEAD_LETTER_COLLECTION).doc(deadLetterId);
  const nowIso = new Date().toISOString();

  try {
    const dlqSnap = await dlqRef.get();
    if (!dlqSnap.exists) {
      return { success: false, error: 'Dead-letter record not found' };
    }

    const dlqDoc = dlqSnap.data() as NotificationDeadLetterDoc;
    const newJobId = randomUUID();

    const newQueueJob: NotificationQueueJob = {
      job_id: newJobId,
      event_id: dlqDoc.event_id,
      event_name: dlqDoc.event_name || dlqDoc.event_id,
      order_id: dlqDoc.order_id || null,
      customer_id: dlqDoc.customer_id || null,
      customer_email: dlqDoc.customer_email || null,
      customer_phone: dlqDoc.customer_phone || null,
      channel: dlqDoc.channel,
      provider: dlqDoc.provider || null,
      priority: getDefaultPriority(dlqDoc.event_id),
      status: 'queued',
      payload: dlqDoc.payload || {},
      template_id: dlqDoc.template_id || null,
      attempts: 0,
      max_attempts: dlqDoc.max_attempts || DEFAULT_MAX_ATTEMPTS,
      retry_state: 'none',
      next_retry_at: null,
      created_at: nowIso,
      scheduled_at: nowIso,
      started_at: null,
      completed_at: null,
      failed_at: null,
      last_error: null,
      provider_response: null,
      worker_id: null,
      locked: false,
      locked_at: null,
      created_by: 'admin_requeue_dlq',
      idempotency_key: `requeue_${deadLetterId}_${Date.now()}`,
      requeued_from_dead_letter_id: deadLetterId,
      original_job_id: dlqDoc.original_job_id || deadLetterId
    };

    await db.collection(QUEUE_COLLECTION).doc(newJobId).set(newQueueJob);

    return { success: true, newJobId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to requeue dead letter job' };
  }
}

export interface RetryAuditLogInput {
  action: 'retry_single' | 'retry_bulk' | 'cancel_single' | 'cancel_bulk' | 'requeue_single' | 'requeue_bulk';
  admin_email: string;
  target_type: 'job' | 'dead_letter';
  target_ids: string[];
  successful_ids: string[];
  skipped_ids: string[];
  failed_ids: string[];
  reason?: string | null;
  request_id?: string;
  source?: 'ui' | 'api';
  metadata?: Record<string, any>;
}

/**
 * Record an immutable retry audit log entry in notification_retry_audit
 */
export async function recordRetryAuditLog(db: Firestore, input: RetryAuditLogInput): Promise<string> {
  const auditId = `audit_${randomUUID()}`;
  const nowIso = new Date().toISOString();
  const requestId = input.request_id || `req_${randomUUID()}`;

  const cleanMetadata: Record<string, any> = {};
  if (input.metadata) {
    for (const [key, val] of Object.entries(input.metadata)) {
      if (['password', 'secret', 'auth', 'token', 'key', 'bearer'].some(k => key.toLowerCase().includes(k))) {
        cleanMetadata[key] = '***REDACTED***';
      } else {
        cleanMetadata[key] = val;
      }
    }
  }

  const docData = {
    audit_id: auditId,
    action: input.action,
    admin_email: input.admin_email || 'sales@sa-and-sha.com',
    target_type: input.target_type,
    target_ids: input.target_ids || [],
    successful_ids: input.successful_ids || [],
    skipped_ids: input.skipped_ids || [],
    failed_ids: input.failed_ids || [],
    reason: input.reason ? sanitizeError(input.reason) : null,
    created_at: nowIso,
    request_id: requestId,
    source: input.source || 'ui',
    metadata: cleanMetadata
  };

  await db.collection('notification_retry_audit').doc(auditId).set(docData);
  return auditId;
}

/**
 * Bulk retry failed/scheduled jobs up to 100 items
 */
export async function bulkRetryFailedJobs(
  db: Firestore,
  jobIds: string[],
  adminEmail: string = 'sales@sa-and-sha.com',
  source: 'ui' | 'api' = 'ui'
) {
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return { success: false, error: 'Job IDs array cannot be empty.', results: [], summary: { total: 0, successful: 0, skipped: 0, failed: 0 } };
  }
  if (jobIds.length > 100) {
    return { success: false, error: 'Maximum 100 IDs allowed per request.', results: [], summary: { total: 0, successful: 0, skipped: 0, failed: 0 } };
  }

  const uniqueJobIds = Array.from(new Set(jobIds));
  const results: Array<{ jobId: string; status: 'successful' | 'skipped' | 'failed'; reason?: string }> = [];
  const successfulIds: string[] = [];
  const skippedIds: string[] = [];
  const failedIds: string[] = [];

  const nowIso = new Date().toISOString();

  for (const jobId of uniqueJobIds) {
    if (!jobId || typeof jobId !== 'string') {
      results.push({ jobId, status: 'failed', reason: 'Invalid job ID format' });
      failedIds.push(jobId);
      continue;
    }

    try {
      const docRef = db.collection('notification_queue').doc(jobId);
      const snap = await docRef.get();

      if (!snap.exists) {
        results.push({ jobId, status: 'failed', reason: 'Job not found' });
        failedIds.push(jobId);
        continue;
      }

      const job = snap.data() as NotificationQueueJob;

      if (job.status === 'completed') {
        results.push({ jobId, status: 'skipped', reason: 'Cannot retry a completed job' });
        skippedIds.push(jobId);
        continue;
      }

      if (job.status === 'cancelled') {
        results.push({ jobId, status: 'skipped', reason: 'Cannot retry a cancelled job' });
        skippedIds.push(jobId);
        continue;
      }

      if (job.retry_state === 'exhausted' || (job.status === 'failed' && job.attempts >= (job.max_attempts || DEFAULT_MAX_ATTEMPTS))) {
        results.push({ jobId, status: 'skipped', reason: 'Exhausted jobs cannot use Retry Now' });
        skippedIds.push(jobId);
        continue;
      }

      await docRef.update({
        status: 'queued',
        retry_state: 'scheduled',
        scheduled_at: nowIso,
        next_retry_at: nowIso,
        locked: false,
        locked_at: null,
        last_error: null
      });

      results.push({ jobId, status: 'successful' });
      successfulIds.push(jobId);
    } catch (err: any) {
      const safeErr = sanitizeError(err?.message || 'Error updating job');
      results.push({ jobId, status: 'failed', reason: safeErr });
      failedIds.push(jobId);
    }
  }

  const action = uniqueJobIds.length === 1 ? 'retry_single' as const : 'retry_bulk' as const;
  const auditId = await recordRetryAuditLog(db, {
    action,
    admin_email: adminEmail,
    target_type: 'job',
    target_ids: uniqueJobIds,
    successful_ids: successfulIds,
    skipped_ids: skippedIds,
    failed_ids: failedIds,
    source
  });

  return {
    success: true,
    auditId,
    results,
    summary: {
      total: uniqueJobIds.length,
      successful: successfulIds.length,
      skipped: skippedIds.length,
      failed: failedIds.length
    }
  };
}

/**
 * Bulk cancel queued jobs up to 100 items
 */
export async function bulkCancelQueuedJobs(
  db: Firestore,
  jobIds: string[],
  adminEmail: string = 'sales@sa-and-sha.com',
  source: 'ui' | 'api' = 'ui'
) {
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return { success: false, error: 'Job IDs array cannot be empty.', results: [], summary: { total: 0, successful: 0, skipped: 0, failed: 0 } };
  }
  if (jobIds.length > 100) {
    return { success: false, error: 'Maximum 100 IDs allowed per request.', results: [], summary: { total: 0, successful: 0, skipped: 0, failed: 0 } };
  }

  const uniqueJobIds = Array.from(new Set(jobIds));
  const results: Array<{ jobId: string; status: 'successful' | 'skipped' | 'failed'; reason?: string }> = [];
  const successfulIds: string[] = [];
  const skippedIds: string[] = [];
  const failedIds: string[] = [];

  for (const jobId of uniqueJobIds) {
    if (!jobId || typeof jobId !== 'string') {
      results.push({ jobId, status: 'failed', reason: 'Invalid job ID format' });
      failedIds.push(jobId);
      continue;
    }

    try {
      const docRef = db.collection('notification_queue').doc(jobId);
      const snap = await docRef.get();

      if (!snap.exists) {
        results.push({ jobId, status: 'failed', reason: 'Job not found' });
        failedIds.push(jobId);
        continue;
      }

      const job = snap.data() as NotificationQueueJob;

      if (job.status !== 'queued') {
        results.push({ jobId, status: 'skipped', reason: `Only queued jobs can be cancelled (current status: ${job.status})` });
        skippedIds.push(jobId);
        continue;
      }

      await docRef.update({
        status: 'cancelled',
        retry_state: 'none',
        last_error: `Cancelled by admin (${adminEmail})`,
        locked: false,
        locked_at: null
      });

      results.push({ jobId, status: 'successful' });
      successfulIds.push(jobId);
    } catch (err: any) {
      const safeErr = sanitizeError(err?.message || 'Error cancelling job');
      results.push({ jobId, status: 'failed', reason: safeErr });
      failedIds.push(jobId);
    }
  }

  const action = uniqueJobIds.length === 1 ? 'cancel_single' as const : 'cancel_bulk' as const;
  const auditId = await recordRetryAuditLog(db, {
    action,
    admin_email: adminEmail,
    target_type: 'job',
    target_ids: uniqueJobIds,
    successful_ids: successfulIds,
    skipped_ids: skippedIds,
    failed_ids: failedIds,
    source
  });

  return {
    success: true,
    auditId,
    results,
    summary: {
      total: uniqueJobIds.length,
      successful: successfulIds.length,
      skipped: skippedIds.length,
      failed: failedIds.length
    }
  };
}

/**
 * Bulk requeue dead-letter jobs up to 100 items
 */
export async function bulkRequeueDeadLetterJobs(
  db: Firestore,
  deadLetterIds: string[],
  adminEmail: string = 'sales@sa-and-sha.com',
  source: 'ui' | 'api' = 'ui'
) {
  if (!Array.isArray(deadLetterIds) || deadLetterIds.length === 0) {
    return { success: false, error: 'Dead Letter IDs array cannot be empty.', results: [], summary: { total: 0, successful: 0, skipped: 0, failed: 0 } };
  }
  if (deadLetterIds.length > 100) {
    return { success: false, error: 'Maximum 100 IDs allowed per request.', results: [], summary: { total: 0, successful: 0, skipped: 0, failed: 0 } };
  }

  const uniqueDlIds = Array.from(new Set(deadLetterIds));
  const results: Array<{ deadLetterId: string; status: 'successful' | 'skipped' | 'failed'; newJobId?: string; reason?: string }> = [];
  const successfulIds: string[] = [];
  const skippedIds: string[] = [];
  const failedIds: string[] = [];

  for (const dlId of uniqueDlIds) {
    if (!dlId || typeof dlId !== 'string') {
      results.push({ deadLetterId: dlId, status: 'failed', reason: 'Invalid dead-letter ID format' });
      failedIds.push(dlId);
      continue;
    }

    try {
      const res = await requeueDeadLetterJob(db, dlId);
      if (res.success && res.newJobId) {
        results.push({ deadLetterId: dlId, status: 'successful', newJobId: res.newJobId });
        successfulIds.push(dlId);
      } else {
        results.push({ deadLetterId: dlId, status: 'failed', reason: res.error || 'Failed to requeue' });
        failedIds.push(dlId);
      }
    } catch (err: any) {
      const safeErr = sanitizeError(err?.message || 'Error requeuing dead letter job');
      results.push({ deadLetterId: dlId, status: 'failed', reason: safeErr });
      failedIds.push(dlId);
    }
  }

  const action = uniqueDlIds.length === 1 ? 'requeue_single' as const : 'requeue_bulk' as const;
  const auditId = await recordRetryAuditLog(db, {
    action,
    admin_email: adminEmail,
    target_type: 'dead_letter',
    target_ids: uniqueDlIds,
    successful_ids: successfulIds,
    skipped_ids: skippedIds,
    failed_ids: failedIds,
    source
  });

  return {
    success: true,
    auditId,
    results,
    summary: {
      total: uniqueDlIds.length,
      successful: successfulIds.length,
      skipped: skippedIds.length,
      failed: failedIds.length
    }
  };
}

/**
 * Fetch Retry Audit History
 */
export async function getRetryAuditHistory(
  db: Firestore,
  options: { limit?: number; offset?: number; action?: string } = {}
) {
  const limitVal = Math.min(options.limit || 20, 100);
  const offsetVal = options.offset || 0;

  let query: any = db.collection('notification_retry_audit');
  if (options.action && options.action !== 'all') {
    query = query.where('action', '==', options.action);
  }

  const snap = await query.get();
  const logs: any[] = [];

  snap.forEach((doc: any) => {
    const data = doc.data();
    logs.push({
      audit_id: data.audit_id || doc.id,
      action: data.action,
      admin_email: data.admin_email,
      target_type: data.target_type,
      target_count: Array.isArray(data.target_ids) ? data.target_ids.length : 0,
      target_ids: data.target_ids || [],
      successful_count: Array.isArray(data.successful_ids) ? data.successful_ids.length : 0,
      successful_ids: data.successful_ids || [],
      skipped_count: Array.isArray(data.skipped_ids) ? data.skipped_ids.length : 0,
      skipped_ids: data.skipped_ids || [],
      failed_count: Array.isArray(data.failed_ids) ? data.failed_ids.length : 0,
      failed_ids: data.failed_ids || [],
      reason: data.reason || null,
      created_at: data.created_at,
      request_id: data.request_id,
      source: data.source || 'ui',
      metadata: data.metadata || {}
    });
  });

  logs.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const total = logs.length;
  const paginated = logs.slice(offsetVal, offsetVal + limitVal);

  return {
    auditLogs: paginated,
    total,
    limit: limitVal,
    offset: offsetVal
  };
}

/**
 * Fetch Retry Analytics & Trend metrics
 */
export async function getRetryAnalytics(
  db: Firestore,
  range: 'today' | '7days' | '30days' = 'today'
) {
  const now = new Date();
  let minMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); // Today start

  if (range === '7days') {
    minMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  } else if (range === '30days') {
    minMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  }

  const [auditSnap, queueSnap] = await Promise.all([
    db.collection('notification_retry_audit').get(),
    db.collection(QUEUE_COLLECTION).get()
  ]);

  let totalRetryAttempts = 0;
  let successfulManualRetries = 0;
  let skippedOperations = 0;
  let failedAdminActions = 0;
  let requeuedDeadLetterJobs = 0;
  let cancelledQueuedJobs = 0;

  const errorReasonsCount: Record<string, number> = {};
  const channelFailureCount: Record<string, number> = { email: 0, whatsapp: 0, sms: 0 };

  const actionsOverTimeMap: Record<string, number> = {};
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  auditSnap.forEach((doc: any) => {
    const data = doc.data();
    if (!data.created_at) return;
    const cMs = new Date(data.created_at).getTime();
    if (cMs < minMs) return;

    const action = data.action || 'retry_bulk';
    const numTargets = Array.isArray(data.target_ids) ? data.target_ids.length : 1;
    const numSucc = Array.isArray(data.successful_ids) ? data.successful_ids.length : 0;
    const numSkip = Array.isArray(data.skipped_ids) ? data.skipped_ids.length : 0;
    const numFail = Array.isArray(data.failed_ids) ? data.failed_ids.length : 0;

    totalRetryAttempts += numTargets;
    if (action.includes('retry')) {
      successfulManualRetries += numSucc;
    } else if (action.includes('requeue')) {
      requeuedDeadLetterJobs += numSucc;
    } else if (action.includes('cancel')) {
      cancelledQueuedJobs += numSucc;
    }

    skippedOperations += numSkip;
    failedAdminActions += numFail;

    successCount += numSucc;
    skippedCount += numSkip;
    failedCount += numFail;

    const dateKey = data.created_at.slice(0, 10);
    actionsOverTimeMap[dateKey] = (actionsOverTimeMap[dateKey] || 0) + 1;
  });

  queueSnap.forEach((doc: any) => {
    const job = doc.data() as NotificationQueueJob;
    if (!job.created_at) return;
    const cMs = new Date(job.created_at).getTime();
    if (cMs < minMs) return;

    if (job.status === 'failed' || job.retry_state === 'exhausted') {
      const errText = sanitizeError(job.last_error || 'Unknown error');
      const shortErr = errText.slice(0, 60);
      errorReasonsCount[shortErr] = (errorReasonsCount[shortErr] || 0) + 1;

      const ch = (job.channel || 'email').toLowerCase();
      channelFailureCount[ch] = (channelFailureCount[ch] || 0) + 1;
    }
  });

  // Find most common failure reason
  let mostCommonReason = 'None';
  let maxReasonCount = 0;
  for (const [r, count] of Object.entries(errorReasonsCount)) {
    if (count > maxReasonCount) {
      maxReasonCount = count;
      mostCommonReason = r;
    }
  }

  // Find most affected channel
  let mostAffectedChannel = 'None';
  let maxChanCount = 0;
  for (const [ch, count] of Object.entries(channelFailureCount)) {
    if (count > maxChanCount) {
      maxChanCount = count;
      mostAffectedChannel = ch.toUpperCase();
    }
  }

  const actionsOverTime = Object.entries(actionsOverTimeMap).map(([date, count]) => ({ date, count }));
  actionsOverTime.sort((a, b) => a.date.localeCompare(b.date));

  return {
    range,
    totalRetryAttempts,
    successfulManualRetries,
    skippedOperations,
    failedAdminActions,
    requeuedDeadLetterJobs,
    cancelledQueuedJobs,
    mostCommonFailureReason: mostCommonReason,
    mostAffectedChannel: mostAffectedChannel,
    outcomes: {
      success: successCount,
      skipped: skippedCount,
      failed: failedCount
    },
    channelFailures: channelFailureCount,
    actionsOverTime
  };
}

