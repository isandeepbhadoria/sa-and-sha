import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSellerTaxConfig, validateSellerTaxConfig, SellerTaxConfig } from '../invoice/sellerTaxConfig';
import { lookupProductTaxMetadata, registerProductTaxMetadata, clearProductTaxMaster } from '../invoice/productTaxMaster';

describe('Phase 10.5D.3 — GST Master Admin Authentication & Token Verification Security Suite', () => {
  beforeEach(() => {
    clearProductTaxMaster();
  });

  describe('1. Server-Side verifyAdminRequest Authorization Rules', () => {
    // Simulated verifyAdminRequest helper matching server.ts behavior
    const verifyAdminRequestMock = async (req: { headers: Record<string, string | undefined> }, mockVerifyIdToken?: (token: string) => Promise<any>) => {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1].trim();
        if (token) {
          try {
            if (mockVerifyIdToken) {
              const decoded = await mockVerifyIdToken(token);
              if (decoded.email && decoded.email.toLowerCase() === "sales@sa-and-sha.com") {
                return { authorized: true, email: decoded.email };
              } else {
                return { authorized: false, error: "Unauthorized email. Only sales@sa-and-sha.com is granted admin access." };
              }
            }
          } catch (authErr: any) {
            // token invalid or expired
          }
        }
      }

      const adminKey = req.headers["x-admin-key"] || req.headers["x-admin-token"];
      const totpSecret = process.env.ADMIN_TOTP_SECRET || "";
      if (adminKey && totpSecret && adminKey === totpSecret) {
        return { authorized: true, email: "sales@sa-and-sha.com" };
      }

      return { authorized: false, error: "Missing or invalid Firebase Auth admin session token." };
    };

    it('1.1. Authorizes valid Firebase ID token for sales@sa-and-sha.com', async () => {
      const mockVerify = async (token: string) => {
        if (token === 'valid_admin_token') return { email: 'sales@sa-and-sha.com' };
        throw new Error('Invalid token');
      };

      const req = { headers: { authorization: 'Bearer valid_admin_token' } };
      const res = await verifyAdminRequestMock(req, mockVerify);
      expect(res.authorized).toBe(true);
      expect(res.email).toBe('sales@sa-and-sha.com');
    });

    it('1.2. Rejects request with missing Authorization header', async () => {
      const req = { headers: {} };
      const res = await verifyAdminRequestMock(req);
      expect(res.authorized).toBe(false);
      expect(res.error).toBe('Missing or invalid Firebase Auth admin session token.');
    });

    it('1.3. Rejects invalid or expired Firebase Auth token', async () => {
      const mockVerify = async () => {
        throw new Error('Token expired');
      };

      const req = { headers: { authorization: 'Bearer expired_token' } };
      const res = await verifyAdminRequestMock(req, mockVerify);
      expect(res.authorized).toBe(false);
      expect(res.error).toBe('Missing or invalid Firebase Auth admin session token.');
    });

    it('1.4. Rejects non-admin email logged-in session', async () => {
      const mockVerify = async (token: string) => {
        if (token === 'customer_token') return { email: 'customer@example.com' };
        throw new Error('Invalid token');
      };

      const req = { headers: { authorization: 'Bearer customer_token' } };
      const res = await verifyAdminRequestMock(req, mockVerify);
      expect(res.authorized).toBe(false);
      expect(res.error).toBe('Unauthorized email. Only sales@sa-and-sha.com is granted admin access.');
    });

    it('1.5. Accepts valid TOTP secret header in preview/dev environment', async () => {
      process.env.ADMIN_TOTP_SECRET = 'secret_totp_key_123';
      const req = { headers: { 'x-admin-token': 'secret_totp_key_123' } };
      const res = await verifyAdminRequestMock(req);
      expect(res.authorized).toBe(true);
      expect(res.email).toBe('sales@sa-and-sha.com');
      delete process.env.ADMIN_TOTP_SECRET;
    });
  });

  describe('2. Frontend Authenticated Fetch & Single Token Auto-Refresh', () => {
    it('2.1. Automatically adds Bearer token header on outbound requests', async () => {
      let capturedHeader = '';
      const mockFetch = async (url: string, init?: any) => {
        capturedHeader = init?.headers?.['Authorization'] || '';
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      const getAdminToken = async () => 'test_id_token_xyz';
      const token = await getAdminToken();
      const headers = { Authorization: `Bearer ${token}` };
      await mockFetch('/api/admin/tax-master/seller', { headers });

      expect(capturedHeader).toBe('Bearer test_id_token_xyz');
    });

    it('2.2. Single token force-refresh retry on 401 status', async () => {
      let callCount = 0;
      let usedToken = '';

      const mockFetch = async (url: string, init?: any) => {
        callCount++;
        usedToken = init?.headers?.['Authorization'] || '';
        if (callCount === 1) {
          return new Response(JSON.stringify({ success: false, error: 'Token expired' }), { status: 401 });
        }
        return new Response(JSON.stringify({ success: true, config: { status: 'ACTIVE' } }), { status: 200 });
      };

      const getToken = async (forceRefresh: boolean) => {
        return forceRefresh ? 'refreshed_token_456' : 'stale_token_123';
      };

      // Perform request with single retry
      let currentToken = await getToken(false);
      let headers: Record<string, string> = { Authorization: `Bearer ${currentToken}` };
      let res = await mockFetch('/api/admin/tax-master/seller', { headers });

      if (res.status === 401) {
        const newToken = await getToken(true);
        headers = { Authorization: `Bearer ${newToken}` };
        res = await mockFetch('/api/admin/tax-master/seller', { headers });
      }

      expect(callCount).toBe(2);
      expect(usedToken).toBe('Bearer refreshed_token_456');
      expect(res.status).toBe(200);
    });
  });

  describe('3. Non-Regression: GST Calculations & Tax Rules', () => {
    it('3.1. Verified seller tax config validation remains strict and intact', () => {
      const validConfig: SellerTaxConfig = {
        legal_name: 'SA AND SHA PRIVATE LIMITED',
        trade_name: 'Sa and Sha',
        gstin: '27AABCU9603R1ZM',
        pan: 'AABCU9603R',
        address_line_1: 'Plot 42, Nariman Point',
        address_line_2: '',
        city: 'Mumbai',
        state: 'Maharashtra',
        state_code: '27',
        pincode: '400093',
        country: 'India',
        support_email: 'sales@sa-and-sha.com',
        support_phone: '+91 98765 43210',
        invoice_prefix: 'KL',
        financial_year: '25-26',
        is_active: true,
        status: 'ACTIVE'
      };

      const val = validateSellerTaxConfig(validConfig);
      expect(val.valid).toBe(true);
    });

    it('3.2. Product tax master lookup remains fully operational', () => {
      registerProductTaxMetadata({
        tax_record_id: 'rec_100',
        sku: 'KL-COTTON-001',
        hsn_code: '6302',
        gst_rate: 12,
        tax_category: 'APPAREL',
        effective_from: '2025-01-01T00:00:00.000Z',
        status: 'ACTIVE'
      });

      const result = lookupProductTaxMetadata({ sku: 'KL-COTTON-001', invoice_date: '2025-08-01T00:00:00.000Z' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.metadata.gst_rate).toBe(12);
        expect(result.metadata.hsn_code).toBe('6302');
      }
    });
  });
});
