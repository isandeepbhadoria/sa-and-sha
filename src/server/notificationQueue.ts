import { Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

export type QueueJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type QueueChannel = 'email' | 'whatsapp' | 'sms';
export type RetryState = 'none' | 'scheduled' | 'processing' | 'exhausted';

export interface NotificationQueueJob {
  job_id: string;
  event_id: string;
  event_name?: string;
  order_id?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  channel: QueueChannel;
  provider?: string | null;
  priority: number;
  status: QueueJobStatus;
  payload: Record<string, any>;
  template_id?: string | null;
  attempts: number;
  max_attempts: number;
  retry_state?: RetryState;
  next_retry_at?: string | null;
  last_attempt_at?: string | null;
  created_at: string;
  scheduled_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  last_error?: string | null;
  provider_response?: Record<string, any> | null;
  dead_letter_id?: string | null;
  dead_lettered_at?: string | null;
  idempotency_key?: string | null;
  requeued_from_dead_letter_id?: string | null;
  original_job_id?: string | null;
  worker_id?: string | null;
  locked: boolean;
  locked_at?: string | null;
  created_by?: string;
}

export interface CreateJobInput {
  event_id: string;
  event_name?: string;
  order_id?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  channel: QueueChannel;
  provider?: string | null;
  priority?: number;
  payload: Record<string, any>;
  template_id?: string | null;
  max_attempts?: number;
  scheduled_at?: string;
  created_by?: string;
  idempotency_key?: string;
}

export interface RouterNotificationInput {
  event_id: string;
  event_name?: string;
  order_id?: string | null;
  customer_id?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  payload: Record<string, any>;
  created_by?: string;
  forceChannels?: QueueChannel[];
}

/**
  * Default Priority Map:
  * OTP -> Priority 1
  * Payment -> Priority 2
  * Orders -> Priority 3
  * Returns -> Priority 4
  * Marketing -> Priority 10
  */
export function getDefaultPriority(eventId: string): number {
  const e = eventId.toLowerCase();
  if (e.includes('otp') || e.includes('auth')) return 1;
  if (e.includes('payment') || e.includes('invoice') || e.includes('refund')) return 2;
  if (e.includes('order') || e.includes('ship') || e.includes('fulfillment') || e.includes('delivery')) return 3;
  if (e.includes('return') || e.includes('exchange') || e.includes('rma') || e.includes('enquiry')) return 4;
  return 10;
}

const COLLECTION_NAME = 'notification_queue';

/**
 * Creates a single notification queue job in Firestore.
 */
export async function createNotificationJob(
  db: Firestore,
  input: CreateJobInput
): Promise<NotificationQueueJob> {
  const jobId = randomUUID();
  const now = new Date().toISOString();

  const job: NotificationQueueJob = {
    job_id: jobId,
    event_id: input.event_id,
    event_name: input.event_name || input.event_id,
    order_id: input.order_id || null,
    customer_id: input.customer_id || null,
    customer_email: input.customer_email || null,
    customer_phone: input.customer_phone || null,
    channel: input.channel,
    provider: input.provider || null,
    priority: input.priority ?? getDefaultPriority(input.event_id),
    status: 'queued',
    payload: input.payload || {},
    template_id: input.template_id || null,
    attempts: 0,
    max_attempts: input.max_attempts ?? 5,
    created_at: now,
    scheduled_at: input.scheduled_at || now,
    started_at: null,
    completed_at: null,
    failed_at: null,
    last_error: null,
    provider_response: null,
    worker_id: null,
    locked: false,
    locked_at: null,
    created_by: input.created_by || 'system'
  };

  await db.collection(COLLECTION_NAME).doc(jobId).set(job);
  return job;
}

/**
 * Creates multiple notification queue jobs in batch.
 */
export async function createNotificationJobs(
  db: Firestore,
  inputs: CreateJobInput[]
): Promise<NotificationQueueJob[]> {
  if (!inputs.length) return [];
  const batch = db.batch();
  const now = new Date().toISOString();
  const jobs: NotificationQueueJob[] = [];

  for (const input of inputs) {
    const jobId = randomUUID();
    const job: NotificationQueueJob = {
      job_id: jobId,
      event_id: input.event_id,
      event_name: input.event_name || input.event_id,
      order_id: input.order_id || null,
      customer_id: input.customer_id || null,
      customer_email: input.customer_email || null,
      customer_phone: input.customer_phone || null,
      channel: input.channel,
      provider: input.provider || null,
      priority: input.priority ?? getDefaultPriority(input.event_id),
      status: 'queued',
      payload: input.payload || {},
      template_id: input.template_id || null,
      attempts: 0,
      max_attempts: input.max_attempts ?? 5,
      created_at: now,
      scheduled_at: input.scheduled_at || now,
      started_at: null,
      completed_at: null,
      failed_at: null,
      last_error: null,
      provider_response: null,
      worker_id: null,
      locked: false,
      locked_at: null,
      created_by: input.created_by || 'system'
    };

    const docRef = db.collection(COLLECTION_NAME).doc(jobId);
    batch.set(docRef, job);
    jobs.push(job);
  }

  await batch.commit();
  return jobs;
}

/**
 * Query queued jobs from Firestore.
 */
export async function getQueuedJobs(
  db: Firestore,
  options: {
    status?: QueueJobStatus;
    channel?: QueueChannel;
    event_id?: string;
    priority?: number;
    limit?: number;
  } = {}
): Promise<NotificationQueueJob[]> {
  let query: any = db.collection(COLLECTION_NAME);

  if (options.status) {
    query = query.where('status', '==', options.status);
  }
  if (options.channel) {
    query = query.where('channel', '==', options.channel);
  }
  if (options.event_id) {
    query = query.where('event_id', '==', options.event_id);
  }
  if (options.priority !== undefined) {
    query = query.where('priority', '==', options.priority);
  }

  const limitVal = options.limit || 50;
  query = query.limit(limitVal);

  const snap = await query.get();
  const jobs: NotificationQueueJob[] = [];
  snap.forEach((doc: any) => {
    jobs.push(doc.data() as NotificationQueueJob);
  });

  return jobs;
}

/**
 * Lock job helper (schema support for future background worker)
 */
export async function lockJob(
  db: Firestore,
  jobId: string,
  workerId: string
): Promise<boolean> {
  const docRef = db.collection(COLLECTION_NAME).doc(jobId);
  const now = new Date().toISOString();

  try {
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists) throw new Error('Job not found');
      const data = snap.data() as NotificationQueueJob;
      if (data.locked) throw new Error('Job is already locked');

      transaction.update(docRef, {
        locked: true,
        locked_at: now,
        worker_id: workerId,
        status: 'processing',
        started_at: now
      });
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Complete job helper
 */
export async function completeJob(
  db: Firestore,
  jobId: string,
  providerResponse?: Record<string, any>
): Promise<void> {
  const now = new Date().toISOString();
  await db.collection(COLLECTION_NAME).doc(jobId).update({
    status: 'completed',
    completed_at: now,
    locked: false,
    provider_response: providerResponse || null
  });
}

/**
 * Fail job helper
 */
export async function failJob(
  db: Firestore,
  jobId: string,
  error: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.collection(COLLECTION_NAME).doc(jobId).update({
    status: 'failed',
    failed_at: now,
    last_error: error,
    locked: false
  });
}

/**
 * Cancel job helper (only queued jobs can be cancelled)
 */
export async function cancelJob(
  db: Firestore,
  jobId: string,
  reason: string = 'Cancelled by Admin'
): Promise<{ success: boolean; error?: string }> {
  const docRef = db.collection(COLLECTION_NAME).doc(jobId);
  const snap = await docRef.get();

  if (!snap.exists) {
    return { success: false, error: 'Queue job not found.' };
  }

  const job = snap.data() as NotificationQueueJob;
  if (job.status === 'completed') {
    return { success: false, error: 'Cannot cancel a completed job.' };
  }
  if (job.status === 'cancelled') {
    return { success: false, error: 'Job is already cancelled.' };
  }

  const now = new Date().toISOString();
  await docRef.update({
    status: 'cancelled',
    last_error: reason,
    locked: false
  });

  return { success: true };
}

/**
 * Notification Router Helper:
 * Evaluates Notification Centre configuration for event_id and creates queue entries
 * for each enabled channel (Email, WhatsApp, SMS).
 */
export async function routeNotificationToQueue(
  db: Firestore,
  input: RouterNotificationInput
): Promise<NotificationQueueJob[]> {
  let enabledChannels: { email: boolean; whatsapp: boolean; sms: boolean } = {
    email: true,
    whatsapp: true,
    sms: false
  };
  let eventName = input.event_name || input.event_id;

  // Check event setting in notification_settings collection
  try {
    const settingSnap = await db.collection('notification_settings').doc(input.event_id).get();
    if (settingSnap.exists) {
      const settingData = settingSnap.data();
      if (settingData) {
        if (settingData.enabled === false) {
          // Event disabled globally
          return [];
        }
        if (settingData.channels) {
          enabledChannels = {
            email: Boolean(settingData.channels.email),
            whatsapp: Boolean(settingData.channels.whatsapp),
            sms: Boolean(settingData.channels.sms)
          };
        }
        if (settingData.event_name) {
          eventName = settingData.event_name;
        }
      }
    }
  } catch (err) {
    console.warn('[NOTIFICATION QUEUE ROUTER] Failed to read event setting, fallback to defaults:', err);
  }

  const jobsToCreate: CreateJobInput[] = [];

  const addChannelJobIfEnabled = (channel: QueueChannel) => {
    const isForced = input.forceChannels && input.forceChannels.includes(channel);
    const isConfigured = enabledChannels[channel];

    if (isForced || isConfigured) {
      jobsToCreate.push({
        event_id: input.event_id,
        event_name: eventName,
        order_id: input.order_id,
        customer_id: input.customer_id,
        customer_email: input.customer_email,
        customer_phone: input.customer_phone,
        channel,
        priority: getDefaultPriority(input.event_id),
        payload: input.payload,
        created_by: input.created_by || 'event_router'
      });
    }
  };

  addChannelJobIfEnabled('email');
  addChannelJobIfEnabled('whatsapp');
  addChannelJobIfEnabled('sms');

  if (!jobsToCreate.length) return [];

  return await createNotificationJobs(db, jobsToCreate);
}
