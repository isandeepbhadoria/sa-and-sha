import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizePhone,
  maskPhoneNumber,
  buildPayload,
  EnterpriseWhatsAppService,
  whatsappService
} from '../notification/whatsappService';
import {
  APPROVED_WHATSAPP_TEMPLATES,
  buildWhatsAppTemplateParams
} from '../notification/notificationTemplates';
import { isChannelAllowedByPreferences } from '../notification/notificationPreferences';

describe('Phase 8A.1 — Meta WhatsApp Cloud API Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Phone Normalization & Masking', () => {
    it('normalizes 10-digit Indian mobile numbers with 91 prefix', () => {
      const result = normalizePhone('9876543210');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('919876543210');
    });

    it('normalizes +91 formatted mobile numbers', () => {
      const result = normalizePhone('+919876543210');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('919876543210');
    });

    it('handles clean 91 prefix numbers without changes', () => {
      const result = normalizePhone('919876543210');
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('919876543210');
    });

    it('masks phone numbers for secure logging without exposing full digits', () => {
      const masked = maskPhoneNumber('919876543210');
      expect(masked).toBe('9198****3210');
      expect(masked).not.toContain('7654');
    });

    it('rejects invalid or incomplete phone numbers', () => {
      const invalidShort = normalizePhone('12345');
      const invalidLetters = normalizePhone('abcdefghij');

      expect(invalidShort.isValid).toBe(false);
      expect(invalidShort.normalized).toBeNull();
      expect(invalidLetters.isValid).toBe(false);
    });
  });

  describe('2. Centralized Approved Template Registry & Variable Mappings', () => {
    it('contains the six placeholder Sa and Sha template identifiers pending real Meta-approved names', () => {
      expect(APPROVED_WHATSAPP_TEMPLATES.ORDER_PLACED).toBe('ss_order_placed_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.PAYMENT_RECEIVED).toBe('ss_payment_received_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.ORDER_SHIPPED).toBe('ss_order_shipped_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.ORDER_DELIVERED).toBe('ss_order_delivered_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.REFUND_PROCESSED).toBe('ss_refund_processed_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS).toBe('ss_loyalty_points_v1');
    });

    it('maps all six core templates to exact expected variable counts and builders', () => {
      const origBaseUrl = process.env.PUBLIC_BASE_URL;
      process.env.PUBLIC_BASE_URL = 'https://www.sa-and-sha.com';

      // 1. Order Placed (4 vars: customerName, orderId, estimatedDelivery, trackingUrl)
      const p1 = buildWhatsAppTemplateParams('ORDER_PLACED', 'Aarav Sharma', {
        order_id: 'ORD-101',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef'
      });
      expect(p1.length).toBe(4);
      expect(p1[0]).toBe('Aarav Sharma');
      expect(p1[1]).toBe('ORD-101');
      expect(p1[2]).toBe('5–7 business days');
      expect(p1[3]).toBe('https://www.sa-and-sha.com/track-order/trk_0123456789abcdef0123456789abcdef');

      // 2. Payment Received (3 vars: customerName, orderId, amountPaid)
      const p2 = buildWhatsAppTemplateParams('PAYMENT_RECEIVED', 'Aarav Sharma', { order_id: 'ORD-101', grand_total: 4500 });
      expect(p2).toEqual(['Aarav Sharma', 'ORD-101', '₹4,500']);

      // 3. Order Shipped (5 vars)
      const p3 = buildWhatsAppTemplateParams('ORDER_SHIPPED', 'Aarav Sharma', { order_id: 'ORD-101', courier_name: 'Bluedart', tracking_number: 'BD99812', tracking_url: 'https://bluedart.com/BD99812' });
      expect(p3).toEqual(['Aarav Sharma', 'ORD-101', 'Bluedart', 'BD99812', 'https://bluedart.com/BD99812']);

      // 4. Order Delivered (2 vars)
      const p4 = buildWhatsAppTemplateParams('ORDER_DELIVERED', 'Aarav Sharma', { order_id: 'ORD-101' });
      expect(p4).toEqual(['Aarav Sharma', 'ORD-101']);

      // 5. Refund Processed (3 vars)
      const p5 = buildWhatsAppTemplateParams('REFUND_COMPLETED', 'Aarav Sharma', { order_id: 'ORD-101', refund_amount: 1200 });
      expect(p5).toEqual(['Aarav Sharma', 'ORD-101', '₹1,200', 'N/A']);

      // 6. Loyalty Points (3 vars)
      const p6 = buildWhatsAppTemplateParams('LOYALTY_POINTS_EARNED', 'Aarav Sharma', undefined, { pointsEarned: 250, newBalance: 1250 });
      expect(p6).toEqual(['Aarav Sharma', '250', '₹1,250']);

      process.env.PUBLIC_BASE_URL = origBaseUrl;
    });
  });

  describe('3. Meta Cloud API Template Payload Format', () => {
    it('constructs a Meta Cloud API template-message payload with messaging_product, template name, language, and body parameters', () => {
      const payload = buildPayload({
        toPhone: '919876543210',
        templateName: 'ss_order_placed_v1',
        language: 'en',
        bodyParams: ['Vikram Sharma', 'ORD-10928', '5–7 business days', 'https://www.sa-and-sha.com/account/orders/ORD-10928']
      });

      expect(payload.messaging_product).toBe('whatsapp');
      expect(payload.to).toBe('919876543210');
      expect(payload.type).toBe('template');
      expect(payload.template.name).toBe('ss_order_placed_v1');
      expect(payload.template.language.code).toBe('en');
      expect(payload.template.components).toEqual([
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Vikram Sharma' },
            { type: 'text', text: 'ORD-10928' },
            { type: 'text', text: '5–7 business days' },
            { type: 'text', text: 'https://www.sa-and-sha.com/account/orders/ORD-10928' }
          ]
        }
      ]);
    });

    it('proves body_3 is estimated delivery (not amount) and body_4 is tracking URL with customer-friendly fallback', () => {
      const origBaseUrl = process.env.PUBLIC_BASE_URL;
      process.env.PUBLIC_BASE_URL = 'https://www.sa-and-sha.com';

      // With custom estimated delivery
      const params1 = buildWhatsAppTemplateParams('ORDER_PLACED', 'Sandeep Bhadoria', {
        order_id: 'SS-698782-LX',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        estimated_delivery: 'Aug 5 - Aug 8'
      });
      expect(params1[0]).toBe('Sandeep Bhadoria');
      expect(params1[1]).toBe('SS-698782-LX');
      expect(params1[2]).toBe('Aug 5 - Aug 8');
      expect(params1[3]).toBe('https://www.sa-and-sha.com/track-order/trk_0123456789abcdef0123456789abcdef');

      // With fallback estimated delivery
      const params2 = buildWhatsAppTemplateParams('ORDER_PLACED', 'Sandeep Bhadoria', {
        order_id: 'SS-698782-LX',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        estimated_delivery: 'N/A'
      });
      expect(params2[2]).toBe('5–7 business days');
      expect(params2[3]).toBe('https://www.sa-and-sha.com/track-order/trk_0123456789abcdef0123456789abcdef');

      process.env.PUBLIC_BASE_URL = origBaseUrl;
    });

    it('fails safely when public base URL is missing and no absolute tracking URL exists', async () => {
      const origPublic = process.env.PUBLIC_BASE_URL;
      const origApp = process.env.APP_BASE_URL;
      const origMock = process.env.WHATSAPP_MOCK_MODE;

      delete process.env.PUBLIC_BASE_URL;
      delete process.env.APP_BASE_URL;
      process.env.WHATSAPP_MOCK_MODE = 'true';

      const res = await whatsappService.sendTemplate({
        eventType: 'ORDER_PLACED',
        customer: { profileId: 'p1', name: 'Test User', phone: '9876543210' },
        order: { order_id: 'ORD-ERR-1', tracking_token: 'trk_0123456789abcdef0123456789abcdef' }
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('CONFIGURATION_ERROR');

      process.env.PUBLIC_BASE_URL = origPublic;
      process.env.APP_BASE_URL = origApp;
      process.env.WHATSAPP_MOCK_MODE = origMock;
    });

    it('proves no undefined or empty parameters are present in output params', () => {
      process.env.PUBLIC_BASE_URL = 'https://www.sa-and-sha.com';
      const params = buildWhatsAppTemplateParams('ORDER_PLACED', '', {
        order_id: '',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef'
      });
      expect(params.every(p => typeof p === 'string' && p.length > 0)).toBe(true);
      expect(params[0]).toBe('Valued Customer');
      expect(params[1]).toBe('N/A');
      expect(params[2]).toBe('5–7 business days');
      expect(params[3]).toMatch(/^https:\/\/www\.sa-and-sha\.com\/track-order\/trk_[a-f0-9]{32}$/);
    });
  });

  describe('4. Fail-Closed Production Behavior & Mock Mode', () => {
    it('fails closed with CONFIGURATION_ERROR when WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID are absent and mock mode is false', async () => {
      const originalAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      const originalPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const originalMock = process.env.WHATSAPP_MOCK_MODE;
      delete process.env.WHATSAPP_ACCESS_TOKEN;
      delete process.env.WHATSAPP_PHONE_NUMBER_ID;
      process.env.WHATSAPP_MOCK_MODE = 'false';

      const res = await whatsappService.sendTemplate({
        eventType: 'ORDER_PLACED',
        customer: {
          profileId: 'prof_test_1',
          name: 'Siddharth Roy',
          phone: '9876543210'
        },
        order: {
          order_id: 'ORD-5541',
          tracking_token: 'trk_0123456789abcdef0123456789abcdef',
          grand_total: 2999
        }
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('CONFIGURATION_ERROR');

      process.env.WHATSAPP_ACCESS_TOKEN = originalAccessToken;
      process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneNumberId;
      process.env.WHATSAPP_MOCK_MODE = originalMock;
    });

    it('succeeds with simulated mock response when WHATSAPP_MOCK_MODE=true', async () => {
      const originalMock = process.env.WHATSAPP_MOCK_MODE;
      process.env.WHATSAPP_MOCK_MODE = 'true';

      const res = await whatsappService.sendTemplate({
        eventType: 'ORDER_PLACED',
        customer: {
          profileId: 'prof_test_1',
          name: 'Siddharth Roy',
          phone: '9876543210'
        },
        order: {
          order_id: 'ORD-5541',
          tracking_token: 'trk_0123456789abcdef0123456789abcdef',
          grand_total: 2999
        }
      });

      expect(res.success).toBe(true);
      expect(res.provider).toBe('meta_whatsapp_mock');
      expect(res.providerMessageId).toBeDefined();

      process.env.WHATSAPP_MOCK_MODE = originalMock;
    });

    it('identifies non-transient errors to avoid invalid retries', () => {
      const service = new EnterpriseWhatsAppService();
      expect(service.isTransientError(400, 'Invalid template parameters')).toBe(false);
      expect(service.isTransientError(401, 'Unauthorized access token')).toBe(false);
      expect(service.isTransientError(429, 'Rate limit exceeded')).toBe(true);
      expect(service.isTransientError(503, 'Service unavailable')).toBe(true);
    });
  });

  describe('5. Live Template Verification Client API', () => {
    it('verifies approved templates via the Meta WhatsApp Business Account Graph API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { name: 'ss_order_placed_v1', status: 'APPROVED', language: 'en', category: 'UTILITY' },
            { name: 'ss_payment_received_v1', status: 'APPROVED', language: 'en', category: 'UTILITY' },
            { name: 'ss_order_shipped_v1', status: 'APPROVED', language: 'en', category: 'UTILITY' },
            { name: 'ss_order_delivered_v1', status: 'APPROVED', language: 'en', category: 'UTILITY' },
            { name: 'ss_refund_processed_v1', status: 'APPROVED', language: 'en', category: 'UTILITY' },
            { name: 'ss_loyalty_points_v1', status: 'APPROVED', language: 'en', category: 'MARKETING' }
          ]
        })
      });

      global.fetch = mockFetch as any;

      const result = await whatsappService.verifyApprovedTemplates('test_access_token', '808292182310403');
      expect(result.verified).toBe(true);
      expect(result.templateDetails['ss_order_placed_v1'].approved).toBe(true);
      expect(result.templateDetails['ss_loyalty_points_v1'].category).toBe('MARKETING');
    });
  });

  describe('6. Customer Preference Opt-Out Handling', () => {
    it('prevents WhatsApp notifications when customer opts out of category', () => {
      const prefs = {
        email: { orders: true, marketing: true },
        whatsapp: { orders: true, marketing: false }
      };

      const isAllowed = isChannelAllowedByPreferences(prefs as any, 'whatsapp', 'marketing', false);
      expect(isAllowed).toBe(false);
    });

    it('allows transactional WhatsApp notifications even if marketing is disabled', () => {
      const prefs = {
        email: { orders: true, marketing: false },
        whatsapp: { orders: true, marketing: false }
      };

      const isAllowed = isChannelAllowedByPreferences(prefs as any, 'whatsapp', 'orders', true);
      expect(isAllowed).toBe(true);
    });
  });
});
