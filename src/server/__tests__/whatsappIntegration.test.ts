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
  WHATSAPP_TEMPLATE_MAPPINGS,
  buildWhatsAppTemplateParams
} from '../notification/notificationTemplates';
import { isChannelAllowedByPreferences } from '../notification/notificationPreferences';

describe('Phase 8A.1 — MSG91 WhatsApp Integration Tests', () => {

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
    it('contains exact approved MSG91 template identifiers for all six templates', () => {
      expect(APPROVED_WHATSAPP_TEMPLATES.ORDER_PLACED).toBe('kl_order_placed_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.PAYMENT_RECEIVED).toBe('kl_payment_received_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.ORDER_SHIPPED).toBe('kl_order_shipped_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.ORDER_DELIVERED).toBe('kl_order_delivered_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.REFUND_PROCESSED).toBe('kl_refund_processed_v1');
      expect(APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS).toBe('kl_loyalty_points_v1');
    });

    it('maps all six core templates to exact expected variable counts and builders', () => {
      const origBaseUrl = process.env.PUBLIC_BASE_URL;
      process.env.PUBLIC_BASE_URL = 'https://www.saandsha.com';

      // 1. Order Placed (4 vars: customerName, orderId, estimatedDelivery, trackingUrl)
      const p1 = buildWhatsAppTemplateParams('ORDER_PLACED', 'Aarav Sharma', {
        order_id: 'ORD-101',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef'
      });
      expect(p1.length).toBe(4);
      expect(p1[0]).toBe('Aarav Sharma');
      expect(p1[1]).toBe('ORD-101');
      expect(p1[2]).toBe('5–7 business days');
      expect(p1[3]).toBe('https://www.saandsha.com/track-order/trk_0123456789abcdef0123456789abcdef');

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

  describe('3. MSG91 Official Bulk Payload Format & Phase 8A.11 Requirements', () => {
    it('constructs official bulk payload with messaging_product, namespace, and body_1 through body_4', () => {
      const payload = buildPayload({
        toPhone: '919876543210',
        templateName: 'kl_order_placed_v1',
        language: 'en',
        bodyParams: ['Vikram Sharma', 'ORD-10928', '5–7 business days', 'https://www.saandsha.com/account/orders/ORD-10928'],
        integratedNumber: '917688886662',
        namespace: 'e05e342e_f402_47f4_8d19_76c1e20d8dce'
      });

      expect(payload.integrated_number).toBe('917688886662');
      expect(payload.content_type).toBe('template');
      expect(payload.payload.messaging_product).toBe('whatsapp');
      expect(payload.payload.type).toBe('template');
      expect(payload.payload.template.name).toBe('kl_order_placed_v1');
      expect(payload.payload.template.language.code).toBe('en');
      expect(payload.payload.template.namespace).toBe('e05e342e_f402_47f4_8d19_76c1e20d8dce');

      const targetComp = payload.payload.template.to_and_components[0];
      expect(targetComp.to).toEqual(['919876543210']);
      expect(targetComp.components).toEqual({
        body_1: { type: 'text', value: 'Vikram Sharma' },
        body_2: { type: 'text', value: 'ORD-10928' },
        body_3: { type: 'text', value: '5–7 business days' },
        body_4: { type: 'text', value: 'https://www.saandsha.com/account/orders/ORD-10928' }
      });
    });

    it('proves body_3 is estimated delivery (not amount) and body_4 is tracking URL with customer-friendly fallback', () => {
      const origBaseUrl = process.env.PUBLIC_BASE_URL;
      process.env.PUBLIC_BASE_URL = 'https://www.saandsha.com';

      // With custom estimated delivery
      const params1 = buildWhatsAppTemplateParams('ORDER_PLACED', 'Sandeep Bhadoria', {
        order_id: 'KL-698782-LX',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        estimated_delivery: 'Aug 5 - Aug 8'
      });
      expect(params1[0]).toBe('Sandeep Bhadoria');
      expect(params1[1]).toBe('KL-698782-LX');
      expect(params1[2]).toBe('Aug 5 - Aug 8');
      expect(params1[3]).toBe('https://www.saandsha.com/track-order/trk_0123456789abcdef0123456789abcdef');

      // With fallback estimated delivery
      const params2 = buildWhatsAppTemplateParams('ORDER_PLACED', 'Sandeep Bhadoria', {
        order_id: 'KL-698782-LX',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        estimated_delivery: 'N/A'
      });
      expect(params2[2]).toBe('5–7 business days');
      expect(params2[3]).toBe('https://www.saandsha.com/track-order/trk_0123456789abcdef0123456789abcdef');

      process.env.PUBLIC_BASE_URL = origBaseUrl;
    });

    it('fails safely when public base URL is missing and no absolute tracking URL exists', async () => {
      const origPublic = process.env.PUBLIC_BASE_URL;
      const origApp = process.env.APP_BASE_URL;
      const origMock = process.env.MSG91_WHATSAPP_MOCK_MODE;

      delete process.env.PUBLIC_BASE_URL;
      delete process.env.APP_BASE_URL;
      process.env.MSG91_WHATSAPP_MOCK_MODE = 'true';

      const res = await whatsappService.sendTemplate({
        eventType: 'ORDER_PLACED',
        customer: { profileId: 'p1', name: 'Test User', phone: '9876543210' },
        order: { order_id: 'ORD-ERR-1', tracking_token: 'trk_0123456789abcdef0123456789abcdef' }
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('CONFIGURATION_ERROR');

      process.env.PUBLIC_BASE_URL = origPublic;
      process.env.APP_BASE_URL = origApp;
      process.env.MSG91_WHATSAPP_MOCK_MODE = origMock;
    });

    it('proves no undefined or empty parameters are present in output params', () => {
      process.env.PUBLIC_BASE_URL = 'https://www.saandsha.com';
      const params = buildWhatsAppTemplateParams('ORDER_PLACED', '', {
        order_id: '',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef'
      });
      expect(params.every(p => typeof p === 'string' && p.length > 0)).toBe(true);
      expect(params[0]).toBe('Valued Customer');
      expect(params[1]).toBe('N/A');
      expect(params[2]).toBe('5–7 business days');
      expect(params[3]).toMatch(/^https:\/\/www\.saandsha\.com\/track-order\/trk_[a-f0-9]{32}$/);
    });
  });

  describe('4. Fail-Closed Production Behavior & Mock Mode', () => {
    it('fails closed with CONFIGURATION_ERROR when MSG91_AUTH_KEY is absent and mock mode is false', async () => {
      const originalAuthKey = process.env.MSG91_AUTH_KEY;
      const originalMock = process.env.MSG91_WHATSAPP_MOCK_MODE;
      delete process.env.MSG91_AUTH_KEY;
      process.env.MSG91_WHATSAPP_MOCK_MODE = 'false';

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

      process.env.MSG91_AUTH_KEY = originalAuthKey;
      process.env.MSG91_WHATSAPP_MOCK_MODE = originalMock;
    });

    it('succeeds with simulated mock response when MSG91_WHATSAPP_MOCK_MODE=true', async () => {
      const originalMock = process.env.MSG91_WHATSAPP_MOCK_MODE;
      process.env.MSG91_WHATSAPP_MOCK_MODE = 'true';

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
      expect(res.provider).toBe('msg91_whatsapp_mock');
      expect(res.providerMessageId).toBeDefined();

      process.env.MSG91_WHATSAPP_MOCK_MODE = originalMock;
    });

    it('identifies non-transient errors to avoid invalid retries', () => {
      const service = new EnterpriseWhatsAppService();
      expect(service.isTransientError(400, 'Invalid template parameters')).toBe(false);
      expect(service.isTransientError(401, 'Unauthorized authkey')).toBe(false);
      expect(service.isTransientError(429, 'Rate limit exceeded')).toBe(true);
      expect(service.isTransientError(503, 'Service unavailable')).toBe(true);
    });
  });

  describe('5. Live Template Verification Client API', () => {
    it('verifies approved templates via MSG91 Client API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'success',
          data: [
            { name: 'kl_order_placed_v1', status: 'APPROVED', language: 'en', variable_count: 3 },
            { name: 'kl_payment_received_v1', status: 'APPROVED', language: 'en', variable_count: 3 },
            { name: 'kl_order_shipped_v1', status: 'APPROVED', language: 'en', variable_count: 5 },
            { name: 'kl_order_delivered_v1', status: 'APPROVED', language: 'en', variable_count: 2 },
            { name: 'kl_refund_processed_v1', status: 'APPROVED', language: 'en', variable_count: 3 },
            { name: 'kl_loyalty_points_v1', status: 'APPROVED', language: 'en', variable_count: 3 }
          ]
        })
      });

      global.fetch = mockFetch;

      const result = await whatsappService.verifyMsg91ApprovedTemplates('test_auth_key', '917688886662');
      expect(result.verified).toBe(true);
      expect(result.templateDetails['kl_order_placed_v1'].approved).toBe(true);
      expect(result.templateDetails['kl_order_placed_v1'].variableCount).toBe(3);
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

