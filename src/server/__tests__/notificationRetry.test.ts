import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateNextRetryAt,
  RETRY_BACKOFF_SCHEDULE_MS,
  DEFAULT_MAX_ATTEMPTS,
  bulkRetryFailedJobs,
  bulkCancelQueuedJobs,
  bulkRequeueDeadLetterJobs,
  recordRetryAuditLog
} from '../notificationRetry';
import { maskEmail, maskPhone, sanitizeError } from '../notificationMonitoring';

describe('Phase 9B.4 — Notification Retry, DLQ & Bulk Operations Unit Tests', () => {
  const NOW_MS = 1700000000000;

  describe('1. Backoff Schedule & Interval Calculations', () => {
    it('calculates 1st retry after 1 minute (60,000 ms)', () => {
      const nextIso = calculateNextRetryAt(1, NOW_MS);
      expect(nextIso).toBe(new Date(NOW_MS + 60 * 1000).toISOString());
    });

    it('calculates 2nd retry after 5 minutes (300,000 ms)', () => {
      const nextIso = calculateNextRetryAt(2, NOW_MS);
      expect(nextIso).toBe(new Date(NOW_MS + 5 * 60 * 1000).toISOString());
    });

    it('calculates 3rd retry after 30 minutes (1,800,000 ms)', () => {
      const nextIso = calculateNextRetryAt(3, NOW_MS);
      expect(nextIso).toBe(new Date(NOW_MS + 30 * 60 * 1000).toISOString());
    });

    it('calculates 4th retry after 2 hours (7,200,000 ms)', () => {
      const nextIso = calculateNextRetryAt(4, NOW_MS);
      expect(nextIso).toBe(new Date(NOW_MS + 2 * 60 * 60 * 1000).toISOString());
    });

    it('calculates 5th retry after 24 hours (86,400,000 ms)', () => {
      const nextIso = calculateNextRetryAt(5, NOW_MS);
      expect(nextIso).toBe(new Date(NOW_MS + 24 * 60 * 60 * 1000).toISOString());
    });

    it('returns null for attempt indices beyond configured schedule', () => {
      const nextIso = calculateNextRetryAt(6, NOW_MS);
      expect(nextIso).toBeNull();
    });
  });

  describe('2. Retry Constants & Configuration Safeguards', () => {
    it('has 5 steps in the backoff schedule array', () => {
      expect(RETRY_BACKOFF_SCHEDULE_MS.length).toBe(5);
    });

    it('default max_attempts is set to 5', () => {
      expect(DEFAULT_MAX_ATTEMPTS).toBe(5);
    });
  });

  describe('3. Privacy Controls & Sanitization', () => {
    it('masks email addresses accurately', () => {
      expect(maskEmail('customer@saandsha.com')).toBe('c***r@saandsha.com');
    });

    it('masks phone numbers accurately', () => {
      expect(maskPhone('+919876543210')).toBe('+91 ***** **210');
    });

    it('sanitizes secret keys and auth tokens from error strings', () => {
      const rawError = 'Error connecting with apiKey=SECRET123456 and token=BEARER_98765';
      const cleanError = sanitizeError(rawError);
      expect(cleanError).not.toContain('SECRET123456');
      expect(cleanError).not.toContain('BEARER_98765');
    });
  });

  describe('4. Bulk Operations Input Validation & Safeguards', () => {
    it('rejects empty array for bulk retry', async () => {
      const mockDb: any = {};
      const res = await bulkRetryFailedJobs(mockDb, []);
      expect(res.success).toBe(false);
      expect(res.error).toContain('cannot be empty');
    });

    it('rejects > 100 IDs for bulk retry', async () => {
      const mockDb: any = {};
      const largeArray = Array.from({ length: 101 }, (_, i) => `job_${i}`);
      const res = await bulkRetryFailedJobs(mockDb, largeArray);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Maximum 100 IDs');
    });

    it('rejects empty array for bulk cancel', async () => {
      const mockDb: any = {};
      const res = await bulkCancelQueuedJobs(mockDb, []);
      expect(res.success).toBe(false);
      expect(res.error).toContain('cannot be empty');
    });

    it('rejects > 100 IDs for bulk cancel', async () => {
      const mockDb: any = {};
      const largeArray = Array.from({ length: 105 }, (_, i) => `job_${i}`);
      const res = await bulkCancelQueuedJobs(mockDb, largeArray);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Maximum 100 IDs');
    });

    it('rejects empty array for bulk requeue', async () => {
      const mockDb: any = {};
      const res = await bulkRequeueDeadLetterJobs(mockDb, []);
      expect(res.success).toBe(false);
      expect(res.error).toContain('cannot be empty');
    });

    it('rejects > 100 IDs for bulk requeue', async () => {
      const mockDb: any = {};
      const largeArray = Array.from({ length: 110 }, (_, i) => `dl_${i}`);
      const res = await bulkRequeueDeadLetterJobs(mockDb, largeArray);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Maximum 100 IDs');
    });
  });
});
