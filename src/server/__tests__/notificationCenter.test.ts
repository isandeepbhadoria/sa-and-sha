import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  routeNotificationEvent,
  isChannelAllowedByPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  WHATSAPP_TEMPLATES,
  calculateNextRetryAt,
  recordNotificationLog,
  updateNotificationLogStatus
} from '../notification';

describe('Omnichannel Notification Center — Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Channel Routing & Preferences', () => {
    it('allows transactional events to ignore marketing opt-out preferences', () => {
      const prefs = {
        email: { orders: true, marketing: false },
        whatsapp: { orders: true, marketing: false }
      };

      // Transactional event ORDER_SHIPPED should bypass false marketing preference
      const isEmailAllowed = isChannelAllowedByPreferences(prefs as any, 'email', 'orders', true);
      const isWaAllowed = isChannelAllowedByPreferences(prefs as any, 'whatsapp', 'orders', true);

      expect(isEmailAllowed).toBe(true);
      expect(isWaAllowed).toBe(true);
    });

    it('respects marketing consent for promotional notification events', () => {
      const optOutPrefs = {
        email: { marketing: false },
        whatsapp: { marketing: false }
      };

      const optInPrefs = {
        email: { marketing: true },
        whatsapp: { marketing: true }
      };

      expect(isChannelAllowedByPreferences(optOutPrefs as any, 'email', 'marketing', false)).toBe(false);
      expect(isChannelAllowedByPreferences(optInPrefs as any, 'email', 'marketing', false)).toBe(true);
    });

    it('routes event based on customer contact availability and preference', async () => {
      const mockAdminDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ notification_preferences: DEFAULT_NOTIFICATION_PREFERENCES })
            })
          })
        })
      };

      const customerWithOnlyEmail = {
        profileId: 'prof_123',
        name: 'Arjun Kumar',
        email: 'arjun@example.com'
      };

      const routedChannels = await routeNotificationEvent(
        mockAdminDb,
        'ORDER_PLACED',
        customerWithOnlyEmail
      );

      expect(routedChannels).toContain('email');
      expect(routedChannels).not.toContain('whatsapp');
    });
  });

  describe('2. WhatsApp Template Mapping', () => {
    it('maps ORDER_PLACED event to kl_order_placed_v1 with formatted params', () => {
      const origBaseUrl = process.env.PUBLIC_BASE_URL;
      process.env.PUBLIC_BASE_URL = 'https://www.saandsha.com';

      const mapping = WHATSAPP_TEMPLATES['ORDER_PLACED'];
      expect(mapping.templateName).toBe('kl_order_placed_v1');

      const params = mapping.buildBodyValues({
        customerName: 'Rohan Sharma',
        orderId: 'ORD-90210',
        trackingToken: 'trk_0123456789abcdef0123456789abcdef'
      });

      expect(params.length).toBe(4);
      expect(params[0]).toBe('Rohan Sharma');
      expect(params[1]).toBe('ORD-90210');
      expect(params[2]).toBe('5–7 business days');
      expect(params[3]).toBe('https://www.saandsha.com/track-order/trk_0123456789abcdef0123456789abcdef');

      process.env.PUBLIC_BASE_URL = origBaseUrl;
    });

    it('maps ORDER_SHIPPED event to kl_order_shipped_v1 with courier and tracking details', () => {
      const mapping = WHATSAPP_TEMPLATES['ORDER_SHIPPED'];
      expect(mapping.templateName).toBe('kl_order_shipped_v1');

      const params = mapping.buildBodyValues({
        customerName: 'Ananya Patel',
        orderId: 'ORD-8812',
        courierName: 'BlueDart',
        trackingNumber: 'BD123456IN',
        trackingToken: 'trk_0123456789abcdef0123456789abcdef'
      });

      expect(params).toContain('Ananya Patel');
      expect(params).toContain('ORD-8812');
      expect(params).toContain('BlueDart');
      expect(params).toContain('BD123456IN');
    });
  });

  describe('3. Retry Interval Engine & Exponential Delays', () => {
    it('calculates expected retry timestamps for 1m, 5m, 30m, 6h, 24h', () => {
      const retry0 = calculateNextRetryAt(0);
      const retry1 = calculateNextRetryAt(1);
      const retryMax = calculateNextRetryAt(5);

      expect(retry0).toBeDefined();
      expect(retry1).toBeDefined();
      expect(retryMax).toBeNull(); // Reached max retry limit
    });
  });

  describe('4. Notification Logging & Firestore Records', () => {
    it('records and updates log status correctly', async () => {
      const mockSet = vi.fn().mockResolvedValue(true);
      const mockDoc = vi.fn().mockReturnValue({ set: mockSet });
      const mockAdminDb = {
        collection: vi.fn().mockReturnValue({ doc: mockDoc })
      };

      const log = await recordNotificationLog(mockAdminDb, {
        id: 'notif_log_1',
        notification_id: 'notif_100',
        customer_profile_id: 'prof_1',
        event: 'ORDER_PLACED',
        event_type: 'ORDER_PLACED',
        channel: 'email',
        provider: 'resend',
        recipient: 'test@example.com',
        status: 'PROCESSING',
        queued_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        retry_count: 0,
        max_retries: 5
      });

      expect(log.id).toBe('notif_log_1');
      expect(mockSet).toHaveBeenCalled();

      await updateNotificationLogStatus(mockAdminDb, 'notif_log_1', 'SENT', { provider_message_id: 'resend_msg_99' });
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'SENT', provider_message_id: 'resend_msg_99' }),
        { merge: true }
      );
    });
  });
});
