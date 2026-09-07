import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveWorkerHealthState,
  maskEmail,
  maskPhone,
  sanitizeError,
  QUEUE_LATENCY_WARNING_MS,
  QUEUE_LATENCY_CRITICAL_MS
} from '../notificationMonitoring';

describe('Phase 9B.3.3 — Notification Monitoring Helpers & Security Tests', () => {
  const NOW_MS = 1700000000000; // Fixed timestamp for testing

  describe('1. Worker Health State Calculations', () => {
    it('returns ONLINE when heartbeat is under 3 minutes old', () => {
      const hb = new Date(NOW_MS - 2 * 60 * 1000).toISOString(); // 2 mins ago
      const worker: any = { worker_id: 'w1', last_heartbeat: hb, status: 'idle' };
      const state = deriveWorkerHealthState(worker, NOW_MS);
      expect(state).toBe('ONLINE');
    });

    it('returns STALE when heartbeat is between 3 and 10 minutes old', () => {
      const hb = new Date(NOW_MS - 5 * 60 * 1000).toISOString(); // 5 mins ago
      const worker: any = { worker_id: 'w1', last_heartbeat: hb, status: 'idle' };
      const state = deriveWorkerHealthState(worker, NOW_MS);
      expect(state).toBe('STALE');
    });

    it('returns OFFLINE when heartbeat is over 10 minutes old', () => {
      const hb = new Date(NOW_MS - 15 * 60 * 1000).toISOString(); // 15 mins ago
      const worker: any = { worker_id: 'w1', last_heartbeat: hb, status: 'idle' };
      const state = deriveWorkerHealthState(worker, NOW_MS);
      expect(state).toBe('OFFLINE');
    });

    it('returns OFFLINE if last_heartbeat is missing or null', () => {
      const worker: any = { worker_id: 'w1', last_heartbeat: null, status: 'idle' };
      const state = deriveWorkerHealthState(worker, NOW_MS);
      expect(state).toBe('OFFLINE');
    });
  });

  describe('2. Privacy & Masking Security', () => {
    it('masks email addresses correctly (s***e@example.com)', () => {
      expect(maskEmail('sandeep@example.com')).toBe('s***p@example.com');
      expect(maskEmail('ab@example.com')).toBe('a***@example.com');
      expect(maskEmail(null)).toBe('***@***.***');
      expect(maskEmail('invalid_email')).toBe('***@***.***');
    });

    it('masks phone numbers correctly (+91 ***** **800)', () => {
      expect(maskPhone('+919876543800')).toBe('+91 ***** **800');
      expect(maskPhone('9876543800')).toBe('98 ***** **800');
      expect(maskPhone(null)).toBe('*****');
    });

    it('sanitizes errors and strips bearer tokens, api keys, and authorization headers', () => {
      const rawError = 'API call failed with Bearer token_secret_key_12345 in header key=secret_val_999';
      const sanitized = sanitizeError(rawError);
      expect(sanitized).not.toContain('token_secret_key_12345');
      expect(sanitized).not.toContain('secret_val_999');
      expect(sanitized).toContain('***REDACTED***');
    });
  });

  describe('3. Latency Constants & Thresholds', () => {
    it('defines 5 minutes warning threshold and 15 minutes critical threshold', () => {
      expect(QUEUE_LATENCY_WARNING_MS).toBe(5 * 60 * 1000);
      expect(QUEUE_LATENCY_CRITICAL_MS).toBe(15 * 60 * 1000);
    });
  });
});
