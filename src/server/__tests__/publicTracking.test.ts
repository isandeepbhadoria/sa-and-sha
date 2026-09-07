import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  generateTrackingToken, 
  isValidTrackingTokenFormat, 
  validateCarrierUrl,
  maskOrderNumber,
  maskPincode,
  buildProviderNeutralShipment,
  buildOrderStatusTimeline
} from '../trackingHelpers';
import { buildWhatsAppTemplateParams } from '../notification/notificationTemplates';

describe('Phase 8B.1 — Sa and Sha Branded Public Order Tracking Tests', () => {

  describe('1. Secure Tracking Token Generation & Entropy', () => {
    it('generates a URL-safe tracking token with at least 128 bits of entropy', () => {
      const token1 = generateTrackingToken();
      const token2 = generateTrackingToken();

      expect(token1).toMatch(/^trk_[a-f0-9]{32}$/);
      expect(token2).toMatch(/^trk_[a-f0-9]{32}$/);
      expect(token1).not.toBe(token2);
      expect(isValidTrackingTokenFormat(token1)).toBe(true);
      expect(isValidTrackingTokenFormat(token2)).toBe(true);
    });

    it('rejects invalid or predictable token formats', () => {
      expect(isValidTrackingTokenFormat('ORD-10928')).toBe(false);
      expect(isValidTrackingTokenFormat('12345')).toBe(false);
      expect(isValidTrackingTokenFormat('trk_short')).toBe(false);
      expect(isValidTrackingTokenFormat('')).toBe(false);
    });
  });

  describe('2. Privacy Protection & Masking Helpers', () => {
    it('masks order numbers safely for unverified guest views', () => {
      expect(maskOrderNumber('ORD-1785675315132')).toBe('ORD-***5132');
      expect(maskOrderNumber('KL-10928')).toBe('KL-1***0928');
    });

    it('partially masks pincodes to prevent full address identification', () => {
      expect(maskPincode('110001')).toBe('110***');
      expect(maskPincode('302001')).toBe('302***');
    });
  });

  describe('3. External Courier Carrier URL Domain Validation', () => {
    it('validates and allows trusted courier domains like Blue Dart, Delhivery, ExpressBees', () => {
      expect(validateCarrierUrl('https://www.bluedart.com/tracking/BD12345')).toBe('https://www.bluedart.com/tracking/BD12345');
      expect(validateCarrierUrl('https://track.delhivery.com/p/987654')).toBe('https://track.delhivery.com/p/987654');
      expect(validateCarrierUrl('https://www.shiprocket.in/tracking/SR001')).toBe('https://www.shiprocket.in/tracking/SR001');
    });

    it('rejects untrusted or malicious external domains to prevent SSRF and open redirects', () => {
      expect(validateCarrierUrl('https://malicious-site.com/track')).toBeNull();
      expect(validateCarrierUrl('javascript:alert(1)')).toBeNull();
      expect(validateCarrierUrl('http://phishing.bluedart.com.fake.com')).toBeNull();
      expect(validateCarrierUrl('')).toBeNull();
    });
  });

  describe('4. Provider-Neutral Blue Dart Ready Shipment Model', () => {
    it('builds provider-neutral shipment structure for Blue Dart courier', () => {
      const order = {
        courier_name: 'Blue Dart Express',
        tracking_number: 'BD9981230',
        tracking_url: 'https://www.bluedart.com/BD9981230',
        estimated_delivery: '5–7 business days',
        order_status: 'shipped',
        city: 'Jaipur',
        state: 'Rajasthan',
        created_at: '2026-08-01T10:00:00Z'
      };

      const shipment = buildProviderNeutralShipment(order);

      expect(shipment.provider).toBe('bluedart');
      expect(shipment.awb_number).toBe('BD9981230');
      expect(shipment.current_status).toBe('shipped');
      expect(shipment.tracking_url).toBe('https://www.bluedart.com/BD9981230');
      expect(shipment.events.length).toBeGreaterThan(0);
      expect(shipment.events[0].code).toBe('ORDER_PLACED');
    });

    it('supports pre-shipment state gracefully when no courier details exist', () => {
      const order = {
        order_status: 'processing',
        created_at: '2026-08-01T10:00:00Z'
      };

      const shipment = buildProviderNeutralShipment(order);

      expect(shipment.provider).toBeNull();
      expect(shipment.awb_number).toBeNull();
      expect(shipment.tracking_url).toBeNull();
      expect(shipment.current_status).toBe('processing');
    });
  });

  describe('5. Order Status Timeline Logic', () => {
    it('generates step timeline for standard completed order flow', () => {
      const order = {
        order_status: 'shipped',
        created_at: '2026-08-01T10:00:00Z',
        shipped_at: '2026-08-02T12:00:00Z'
      };

      const timeline = buildOrderStatusTimeline('shipped', order);

      expect(timeline.length).toBe(7);
      const shippedStep = timeline.find((s) => s.id === 'shipped');
      expect(shippedStep?.isCompleted).toBe(true);
      expect(shippedStep?.isCurrent).toBe(true);
      const deliveredStep = timeline.find((s) => s.id === 'delivered');
      expect(deliveredStep?.isCompleted).toBe(false);
    });

    it('handles exception status flows like Cancelled cleanly', () => {
      const order = {
        order_status: 'cancelled',
        created_at: '2026-08-01T10:00:00Z',
        cancelled_at: '2026-08-01T11:00:00Z'
      };

      const timeline = buildOrderStatusTimeline('cancelled', order);

      expect(timeline.length).toBe(2);
      expect(timeline[1].id).toBe('cancelled');
      expect(timeline[1].isCompleted).toBe(true);
    });
  });

  describe('6. WhatsApp & Email Notification Tracking Link Generation', () => {
    const origBaseUrl = process.env.PUBLIC_BASE_URL;

    beforeEach(() => {
      process.env.PUBLIC_BASE_URL = 'https://www.saandsha.com';
    });

    afterEach(() => {
      process.env.PUBLIC_BASE_URL = origBaseUrl;
    });

    it('builds WhatsApp body_4 using secure public tracking URL with tracking_token', () => {
      const orderData = {
        order_id: 'ORD-10928',
        tracking_token: 'trk_a1b2c3d4e5f607182930415263748596',
        estimated_delivery: '5–7 business days'
      };

      const params = buildWhatsAppTemplateParams('ORDER_PLACED', 'Vikram Sharma', orderData);

      expect(params[0]).toBe('Vikram Sharma');
      expect(params[1]).toBe('ORD-10928');
      expect(params[2]).toBe('5–7 business days');
      expect(params[3]).toBe('https://www.saandsha.com/track-order/trk_a1b2c3d4e5f607182930415263748596');
    });

    it('rejects notification dispatch if tracking_token is missing or invalid', () => {
      const orderData = {
        order_id: 'ORD-88901',
        estimated_delivery: '3–5 business days'
      };

      expect(() => {
        buildWhatsAppTemplateParams('ORDER_PLACED', 'Ananya Roy', orderData);
      }).toThrow(/MISSING_TRACKING_TOKEN/);
    });
  });
});
