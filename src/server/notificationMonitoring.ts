import { Firestore } from 'firebase-admin/firestore';
import { NotificationQueueJob } from './notificationQueue';
import { WorkerHeartbeatStatus, isNotificationQueueEnabled } from './notificationWorker';

export const QUEUE_LATENCY_WARNING_MS = 5 * 60 * 1000; // 5 minutes
export const QUEUE_LATENCY_CRITICAL_MS = 15 * 60 * 1000; // 15 minutes

const QUEUE_COLLECTION = 'notification_queue';
const WORKER_COLLECTION = 'notification_worker_status';

/**
 * Utility: Mask email addresses for privacy (e.g. s***e@example.com)
 */
export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Utility: Mask phone numbers for privacy (e.g. +91 ***** **800)
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return '*****';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length < 5) return '*****';
  const prefix = clean.startsWith('+') ? clean.slice(0, 3) : clean.slice(0, 2);
  const suffix = clean.slice(-3);
  return `${prefix} ***** **${suffix}`;
}

/**
 * Utility: Sanitize error text to prevent leaking credentials or headers
 */
export function sanitizeError(errorText?: string | null): string {
  if (!errorText) return 'Unknown error';
  let sanitized = String(errorText);

  // Mask potential Bearer tokens or API keys
  sanitized = sanitized.replace(/(Bearer|key|token|auth|secret|password)[=:\s]+[A-Za-z0-9_\-\.\~]+/gi, '$1=***REDACTED***');
  // Mask URLs containing secret params
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, (url) => {
    try {
      const parsed = new URL(url);
      parsed.search = '?redacted=true';
      return parsed.toString();
    } catch {
      return url;
    }
  });

  return sanitized.length > 300 ? sanitized.slice(0, 300) + '...' : sanitized;
}

/**
 * Calculate derived Worker Health state
 */
export function deriveWorkerHealthState(
  worker: WorkerHeartbeatStatus,
  nowMs: number = Date.now()
): 'ONLINE' | 'STALE' | 'OFFLINE' {
  if (!worker.last_heartbeat) return 'OFFLINE';
  const hbMs = new Date(worker.last_heartbeat).getTime();
  const diffMs = nowMs - hbMs;

  if (diffMs <= 3 * 60 * 1000) {
    return 'ONLINE';
  } else if (diffMs <= 10 * 60 * 1000) {
    return 'STALE';
  } else {
    return 'OFFLINE';
  }
}

/**
 * Get Queue Health Summary
 */
export async function getQueueHealthSummary(db: Firestore) {
  const snapshot = await db.collection(QUEUE_COLLECTION).limit(1000).get();
  const nowMs = Date.now();

  let queued = 0;
  let processing = 0;
  let completedToday = 0;
  let failedToday = 0;
  let cancelledToday = 0;

  const todayStr = new Date().toDateString();
  let oldestQueuedMs = Number.MAX_SAFE_INTEGER;
  let totalWaitTimeMs = 0;
  let waitTimeCount = 0;
  let totalProcessingTimeMs = 0;
  let processingTimeCount = 0;

  snapshot.forEach((doc: any) => {
    const job = doc.data() as NotificationQueueJob;
    const st = (job.status || 'queued').toLowerCase();

    if (st === 'queued') {
      queued++;
      if (job.created_at) {
        const cMs = new Date(job.created_at).getTime();
        if (cMs < oldestQueuedMs) oldestQueuedMs = cMs;
      }
    } else if (st === 'processing') {
      processing++;
    }

    const createdToday = job.created_at && new Date(job.created_at).toDateString() === todayStr;
    const completedTodayMatch = job.completed_at && new Date(job.completed_at).toDateString() === todayStr;
    const failedTodayMatch = job.failed_at && new Date(job.failed_at).toDateString() === todayStr;

    if (st === 'completed' && (createdToday || completedTodayMatch)) completedToday++;
    if (st === 'failed' && (createdToday || failedTodayMatch)) failedToday++;
    if (st === 'cancelled' && createdToday) cancelledToday++;

    // Wait time: started_at - created_at
    if (job.started_at && job.created_at) {
      const wait = new Date(job.started_at).getTime() - new Date(job.created_at).getTime();
      if (wait >= 0) {
        totalWaitTimeMs += wait;
        waitTimeCount++;
      }
    }

    // Processing time: (completed_at || failed_at) - started_at
    const endAt = job.completed_at || job.failed_at;
    if (endAt && job.started_at) {
      const proc = new Date(endAt).getTime() - new Date(job.started_at).getTime();
      if (proc >= 0) {
        totalProcessingTimeMs += proc;
        processingTimeCount++;
      }
    }
  });

  const oldestQueuedAgeMs = oldestQueuedMs === Number.MAX_SAFE_INTEGER ? 0 : Math.max(0, nowMs - oldestQueuedMs);
  const avgWaitTimeMs = waitTimeCount > 0 ? Math.round(totalWaitTimeMs / waitTimeCount) : 0;
  const avgProcessingTimeMs = processingTimeCount > 0 ? Math.round(totalProcessingTimeMs / processingTimeCount) : 0;

  // Determine Overall Status
  const isQueueEnabled = isNotificationQueueEnabled();
  let status: 'Healthy' | 'Warning' | 'Critical' | 'Offline' | 'Idle' | 'Shadow Mode' = 'Shadow Mode';

  if (!isQueueEnabled) {
    status = 'Shadow Mode';
  } else if (queued === 0 && processing === 0) {
    status = 'Idle';
  } else if (oldestQueuedAgeMs > QUEUE_LATENCY_CRITICAL_MS || failedToday > 10) {
    status = 'Critical';
  } else if (oldestQueuedAgeMs > QUEUE_LATENCY_WARNING_MS || failedToday > 2) {
    status = 'Warning';
  } else {
    status = 'Healthy';
  }

  return {
    queued,
    processing,
    completedToday,
    failedToday,
    cancelledToday,
    oldestQueuedAgeMs,
    avgWaitTimeMs,
    avgProcessingTimeMs,
    status,
    isQueueEnabled,
    queueMode: isQueueEnabled ? 'ACTIVE' : 'SHADOW MODE'
  };
}

/**
 * Get Worker Health Summary
 */
export async function getWorkerHealthSummary(db: Firestore) {
  const snapshot = await db.collection(WORKER_COLLECTION).get();
  const workers: any[] = [];
  const nowMs = Date.now();

  snapshot.forEach((doc: any) => {
    const data = doc.data() as WorkerHeartbeatStatus;
    const derivedState = deriveWorkerHealthState(data, nowMs);

    workers.push({
      worker_id: data.worker_id,
      hostname: data.hostname || 'cloud-run-worker',
      version: data.version || '1.0.0',
      status: derivedState,
      raw_status: data.status,
      started_at: data.started_at,
      last_heartbeat: data.last_heartbeat,
      jobs_processed: data.jobs_processed || 0,
      jobs_failed: data.jobs_failed || 0,
      heartbeat_age_ms: data.last_heartbeat ? Math.max(0, nowMs - new Date(data.last_heartbeat).getTime()) : null
    });
  });

  const onlineWorkers = workers.filter((w) => w.status === 'ONLINE').length;
  const overallWorkerStatus = onlineWorkers > 0 ? 'ONLINE' : workers.length > 0 ? 'STALE / OFFLINE' : 'OFFLINE';

  return {
    workers,
    onlineWorkersCount: onlineWorkers,
    totalWorkersCount: workers.length,
    overallWorkerStatus
  };
}

/**
 * Get Channel Performance
 */
export async function getChannelPerformance(db: Firestore) {
  const snapshot = await db.collection(QUEUE_COLLECTION).limit(1000).get();
  const todayStr = new Date().toDateString();

  const channels: Record<string, any> = {
    email: {
      channel: 'email',
      queued: 0,
      processing: 0,
      completedToday: 0,
      failedToday: 0,
      totalCount: 0,
      successCount: 0,
      totalExecDurationMs: 0,
      execDurationCount: 0,
      latestSuccessAt: null as string | null,
      latestFailedAt: null as string | null,
      configuredProvider: 'resend',
      isConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim())
    },
    whatsapp: {
      channel: 'whatsapp',
      queued: 0,
      processing: 0,
      completedToday: 0,
      failedToday: 0,
      totalCount: 0,
      successCount: 0,
      totalExecDurationMs: 0,
      execDurationCount: 0,
      latestSuccessAt: null as string | null,
      latestFailedAt: null as string | null,
      configuredProvider: 'msg91_whatsapp',
      isConfigured: Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_WHATSAPP_NUMBER)
    },
    sms: {
      channel: 'sms',
      queued: 0,
      processing: 0,
      completedToday: 0,
      failedToday: 0,
      totalCount: 0,
      successCount: 0,
      totalExecDurationMs: 0,
      execDurationCount: 0,
      latestSuccessAt: null as string | null,
      latestFailedAt: null as string | null,
      configuredProvider: process.env.MSG91_AUTH_KEY ? 'msg91_sms' : 'sms_widget',
      isConfigured: Boolean(
        (process.env.MSG91_AUTH_KEY && process.env.MSG91_AUTH_KEY.trim()) ||
          (process.env.VITE_MSG91_WIDGET_ID && process.env.VITE_MSG91_WIDGET_ID.trim())
      )
    }
  };

  snapshot.forEach((doc: any) => {
    const job = doc.data() as NotificationQueueJob;
    const ch = (job.channel || 'email').toLowerCase();
    if (!channels[ch]) return;

    const target = channels[ch];
    const st = (job.status || 'queued').toLowerCase();

    if (st === 'queued') target.queued++;
    if (st === 'processing') target.processing++;

    const isToday = job.created_at && new Date(job.created_at).toDateString() === todayStr;

    if (st === 'completed') {
      target.successCount++;
      if (isToday) target.completedToday++;
      if (!target.latestSuccessAt || new Date(job.completed_at || job.created_at) > new Date(target.latestSuccessAt)) {
        target.latestSuccessAt = job.completed_at || job.created_at;
      }
    } else if (st === 'failed') {
      if (isToday) target.failedToday++;
      if (!target.latestFailedAt || new Date(job.failed_at || job.created_at) > new Date(target.latestFailedAt)) {
        target.latestFailedAt = job.failed_at || job.created_at;
      }
    }

    if (st === 'completed' || st === 'failed') {
      target.totalCount++;
    }

    if (job.provider_response?.execution_duration_ms) {
      target.totalExecDurationMs += Number(job.provider_response.execution_duration_ms);
      target.execDurationCount++;
    }
  });

  // Calculate success rates & avg execution durations
  Object.keys(channels).forEach((key) => {
    const c = channels[key];
    c.successRatePercent = c.totalCount > 0 ? Math.round((c.successCount / c.totalCount) * 100) : 100;
    c.avgExecDurationMs = c.execDurationCount > 0 ? Math.round(c.totalExecDurationMs / c.execDurationCount) : 0;
  });

  return channels;
}

/**
 * Get Queue Latency Metrics
 */
export async function getQueueLatencyMetrics(db: Firestore) {
  const snapshot = await db.collection(QUEUE_COLLECTION).limit(1000).get();
  const nowMs = Date.now();

  let maxWaitTimeMs = 0;
  let totalWaitMs = 0;
  let waitCount = 0;

  let maxProcessingMs = 0;
  let totalProcessingMs = 0;
  let processingCount = 0;

  let maxEndToEndMs = 0;
  let totalEndToEndMs = 0;
  let endToEndCount = 0;

  let oldestWaitingJob: any = null;
  let oldestWaitMs = 0;
  let jobsWaitingOverWarning = 0;
  let jobsWaitingOverCritical = 0;

  snapshot.forEach((doc: any) => {
    const job = doc.data() as NotificationQueueJob;
    const st = (job.status || 'queued').toLowerCase();

    if (st === 'queued') {
      const waitAge = job.created_at ? Math.max(0, nowMs - new Date(job.created_at).getTime()) : 0;
      if (waitAge > oldestWaitMs) {
        oldestWaitMs = waitAge;
        oldestWaitingJob = {
          job_id: job.job_id,
          event_id: job.event_id,
          channel: job.channel,
          created_at: job.created_at,
          waitAgeMs: waitAge
        };
      }

      if (waitAge >= QUEUE_LATENCY_CRITICAL_MS) jobsWaitingOverCritical++;
      else if (waitAge >= QUEUE_LATENCY_WARNING_MS) jobsWaitingOverWarning++;
    }

    // Wait time (started_at - created_at)
    if (job.started_at && job.created_at) {
      const w = new Date(job.started_at).getTime() - new Date(job.created_at).getTime();
      if (w >= 0) {
        totalWaitMs += w;
        waitCount++;
        if (w > maxWaitTimeMs) maxWaitTimeMs = w;
      }
    }

    // Processing duration ((completed_at || failed_at) - started_at)
    const endAt = job.completed_at || job.failed_at;
    if (endAt && job.started_at) {
      const p = new Date(endAt).getTime() - new Date(job.started_at).getTime();
      if (p >= 0) {
        totalProcessingMs += p;
        processingCount++;
        if (p > maxProcessingMs) maxProcessingMs = p;
      }
    }

    // End to end ((completed_at || failed_at) - created_at)
    if (endAt && job.created_at) {
      const e2e = new Date(endAt).getTime() - new Date(job.created_at).getTime();
      if (e2e >= 0) {
        totalEndToEndMs += e2e;
        endToEndCount++;
        if (e2e > maxEndToEndMs) maxEndToEndMs = e2e;
      }
    }
  });

  return {
    avgWaitTimeMs: waitCount > 0 ? Math.round(totalWaitMs / waitCount) : 0,
    maxWaitTimeMs,
    avgProcessingDurationMs: processingCount > 0 ? Math.round(totalProcessingMs / processingCount) : 0,
    maxProcessingDurationMs: maxProcessingMs,
    avgEndToEndMs: endToEndCount > 0 ? Math.round(totalEndToEndMs / endToEndCount) : 0,
    maxEndToEndMs,
    oldestWaitingJob,
    jobsWaitingOverWarning,
    jobsWaitingOverCritical,
    warningThresholdMs: QUEUE_LATENCY_WARNING_MS,
    criticalThresholdMs: QUEUE_LATENCY_CRITICAL_MS
  };
}

/**
 * Get Delivery Throughput Metrics
 */
export async function getNotificationThroughput(
  db: Firestore,
  range: 'hour' | 'day' | '7d' = 'day',
  channelFilter?: string,
  eventIdFilter?: string
) {
  const now = new Date();
  let minTimeMs = now.getTime() - 24 * 60 * 60 * 1000; // default 24h

  if (range === 'hour') {
    minTimeMs = now.getTime() - 60 * 60 * 1000;
  } else if (range === '7d') {
    minTimeMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  }

  let query: any = db.collection(QUEUE_COLLECTION);
  if (channelFilter && channelFilter !== 'all') {
    query = query.where('channel', '==', channelFilter.toLowerCase());
  }
  if (eventIdFilter && eventIdFilter !== 'all') {
    query = query.where('event_id', '==', eventIdFilter);
  }

  const snapshot = await query.get();

  let totalJobs = 0;
  let completed = 0;
  let failed = 0;
  let cancelled = 0;
  const perChannel: Record<string, { total: number; completed: number; failed: number }> = {};
  const perEvent: Record<string, { total: number; completed: number; failed: number }> = {};

  snapshot.forEach((doc: any) => {
    const job = doc.data() as NotificationQueueJob;
    if (!job.created_at) return;

    const cMs = new Date(job.created_at).getTime();
    if (cMs < minTimeMs) return;

    totalJobs++;
    const st = (job.status || 'queued').toLowerCase();
    if (st === 'completed') completed++;
    else if (st === 'failed') failed++;
    else if (st === 'cancelled') cancelled++;

    // Channel totals
    const ch = (job.channel || 'email').toLowerCase();
    if (!perChannel[ch]) perChannel[ch] = { total: 0, completed: 0, failed: 0 };
    perChannel[ch].total++;
    if (st === 'completed') perChannel[ch].completed++;
    if (st === 'failed') perChannel[ch].failed++;

    // Event totals
    const ev = job.event_id || 'unknown';
    if (!perEvent[ev]) perEvent[ev] = { total: 0, completed: 0, failed: 0 };
    perEvent[ev].total++;
    if (st === 'completed') perEvent[ev].completed++;
    if (st === 'failed') perEvent[ev].failed++;
  });

  return {
    range,
    totalJobs,
    completed,
    failed,
    cancelled,
    successRatePercent: totalJobs > 0 ? Math.round((completed / (completed + failed || 1)) * 100) : 100,
    perChannel,
    perEvent
  };
}

/**
 * Get Recent Notification Failures (Privacy Sanitized)
 */
export async function getRecentNotificationFailures(
  db: Firestore,
  options: {
    limit?: number;
    offset?: number;
    channel?: string;
    eventId?: string;
  } = {}
) {
  let query: any = db.collection(QUEUE_COLLECTION).where('status', '==', 'failed');

  if (options.channel && options.channel !== 'all') {
    query = query.where('channel', '==', options.channel.toLowerCase());
  }
  if (options.eventId && options.eventId !== 'all') {
    query = query.where('event_id', '==', options.eventId);
  }

  const snapshot = await query.get();
  let failures: any[] = [];

  snapshot.forEach((doc: any) => {
    const job = doc.data() as NotificationQueueJob;
    failures.push({
      job_id: job.job_id,
      event_id: job.event_id,
      event_name: job.event_name || job.event_id,
      order_id: job.order_id || null,
      customer_ref: maskEmail(job.customer_email) !== '***@***.***' ? maskEmail(job.customer_email) : maskPhone(job.customer_phone),
      channel: job.channel,
      provider: job.provider || job.provider_response?.provider || job.channel,
      error_code: job.last_error ? job.last_error.slice(0, 30) : 'FAILURE',
      safe_error_summary: sanitizeError(job.last_error),
      attempts: job.attempts || 1,
      failed_at: job.failed_at || job.created_at,
      execution_duration_ms: job.provider_response?.execution_duration_ms || null
    });
  });

  // Sort newest failed first
  failures.sort((a, b) => new Date(b.failed_at || 0).getTime() - new Date(a.failed_at || 0).getTime());

  const total = failures.length;
  const startIdx = options.offset || 0;
  const limitVal = options.limit || 20;
  const paginatedFailures = failures.slice(startIdx, startIdx + limitVal);

  return {
    failures: paginatedFailures,
    total,
    limit: limitVal,
    offset: startIdx
  };
}

/**
 * Get Operational Timeline (Read-Only Derived Activity Feed)
 */
export async function getOperationalTimeline(db: Firestore, limit: number = 30) {
  const [queueSnap, workerSnap] = await Promise.all([
    db.collection(QUEUE_COLLECTION).limit(200).get(),
    db.collection(WORKER_COLLECTION).get()
  ]);

  const events: any[] = [];

  queueSnap.forEach((doc: any) => {
    const job = doc.data() as NotificationQueueJob;

    if (job.created_at) {
      events.push({
        id: `${job.job_id}_created`,
        timestamp: job.created_at,
        type: 'JOB_QUEUED',
        description: `Job ${job.job_id.slice(0, 8)} (${job.event_name || job.event_id}) queued on ${job.channel.toUpperCase()}`,
        job_id: job.job_id,
        channel: job.channel
      });
    }

    if (job.started_at) {
      events.push({
        id: `${job.job_id}_started`,
        timestamp: job.started_at,
        type: 'JOB_LOCKED',
        description: `Worker locked job ${job.job_id.slice(0, 8)} for processing`,
        job_id: job.job_id,
        worker_id: job.worker_id
      });
    }

    if (job.completed_at) {
      events.push({
        id: `${job.job_id}_completed`,
        timestamp: job.completed_at,
        type: 'JOB_COMPLETED',
        description: `Job ${job.job_id.slice(0, 8)} delivered successfully via ${job.channel.toUpperCase()}`,
        job_id: job.job_id,
        channel: job.channel
      });
    }

    if (job.failed_at) {
      events.push({
        id: `${job.job_id}_failed`,
        timestamp: job.failed_at,
        type: 'JOB_FAILED',
        description: `Job ${job.job_id.slice(0, 8)} dispatch failed: ${sanitizeError(job.last_error)}`,
        job_id: job.job_id,
        channel: job.channel
      });
    }

    if (job.status === 'cancelled') {
      events.push({
        id: `${job.job_id}_cancelled`,
        timestamp: job.created_at,
        type: 'JOB_CANCELLED',
        description: `Job ${job.job_id.slice(0, 8)} cancelled by admin`,
        job_id: job.job_id
      });
    }
  });

  const nowMs = Date.now();
  workerSnap.forEach((doc: any) => {
    const w = doc.data() as WorkerHeartbeatStatus;
    if (w.last_heartbeat) {
      const state = deriveWorkerHealthState(w, nowMs);
      events.push({
        id: `${w.worker_id}_heartbeat`,
        timestamp: w.last_heartbeat,
        type: `WORKER_${state}`,
        description: `Worker '${w.worker_id}' heartbeat status: ${state}`,
        worker_id: w.worker_id
      });
    }
  });

  // Sort newest timestamp first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}
