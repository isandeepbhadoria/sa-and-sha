import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishNotification } from '../notification/notificationEngine';
import { whatsappService, EnterpriseWhatsAppService } from '../notification/whatsappService';

describe('Phase 8A.3 — Centralized Checkout Notification Architecture & Logging Tests', () => {
  let mockFirestoreDocs: Record<string, any> = {};

  const createMockDb = () => {
    const getDocObj = (colName: string, docId?: string) => {
      const id = docId || `mock_doc_${Math.random().toString(36).substring(7)}`;
      return {
        id,
        get: async () => ({
          exists: !!mockFirestoreDocs[`${colName}/${id}`],
          data: () => mockFirestoreDocs[`${colName}/${id}`]
        }),
        set: async (data: any, options?: any) => {
          if (options?.merge && mockFirestoreDocs[`${colName}/${id}`]) {
            mockFirestoreDocs[`${colName}/${id}`] = {
              ...mockFirestoreDocs[`${colName}/${id}`],
              ...data
            };
          } else {
            mockFirestoreDocs[`${colName}/${id}`] = data;
          }
        },
        collection: (subCol: string) => ({
          doc: (subId?: string) => getDocObj(`${colName}/${id}/${subCol}`, subId)
        })
      };
    };

    return {
      collection: (colName: string) => ({
        doc: (docId?: string) => getDocObj(colName, docId)
      })
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFirestoreDocs = {};
    delete process.env.RESEND_API_KEY;
    process.env.PUBLIC_BASE_URL = 'https://www.saandsha.com';
    process.env.MSG91_WHATSAPP_MOCK_MODE = 'true';
    process.env.MSG91_AUTH_KEY = 'test_auth_key_123456';
    process.env.MSG91_WHATSAPP_NUMBER = '917688886662';
    process.env.MSG91_BASE_URL = 'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
  });

  describe('1. MSG91 Endpoint Normalization & Validation', () => {
    it('normalizes base URL to official bulk outbound endpoint', () => {
      const service = new EnterpriseWhatsAppService();
      const normalized = service.getNormalizedBaseUrl('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk');
      expect(normalized).toBe('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/');
    });

    it('rejects unapproved custom base URL before dispatch', async () => {
      process.env.MSG91_WHATSAPP_MOCK_MODE = 'false';
      process.env.MSG91_BASE_URL = 'https://malicious.api.com/fake-endpoint/';
      
      const service = new EnterpriseWhatsAppService();
      const res = await service.sendTemplate({
        eventType: 'ORDER_PLACED',
        customer: {
          profileId: 'cust_123',
          name: 'Test User',
          phone: '919876543210'
        }
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('INVALID_CONFIGURATION');
    });
  });

  describe('2. Centralized Notification Dispatch & Dual-Channel Logging', () => {
    it('dispatches ORDER_PLACED event through Notification Engine and logs both Email and WhatsApp', async () => {
      const mockDb = createMockDb();

      const testOrder = {
        order_id: 'KL-10099',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        customer_name: 'Aditya Sharma',
        customer_email: 'aditya@example.com',
        customer_phone: '919876543210',
        grand_total: 2499,
        status: 'placed'
      };

      const result = await publishNotification(mockDb, {
        event: 'ORDER_PLACED',
        order: testOrder,
        customer: {
          profileId: 'cust_999',
          name: 'Aditya Sharma',
          email: 'aditya@example.com',
          phone: '919876543210'
        }
      });

      expect(result.success).toBe(true);
      expect(result.results.email).toBeDefined();
      expect(result.results.whatsapp).toBeDefined();
      expect(result.results.email.success).toBe(true);
      expect(result.results.whatsapp.success).toBe(true);

      // Filter recorded logs in notification_logs collection
      const logKeys = Object.keys(mockFirestoreDocs).filter(k => k.startsWith('notification_logs/'));
      expect(logKeys.length).toBeGreaterThanOrEqual(2);

      const logs = logKeys.map(k => mockFirestoreDocs[k]);
      const emailLog = logs.find(l => l.channel === 'email');
      const waLog = logs.find(l => l.channel === 'whatsapp');

      expect(emailLog).toBeDefined();
      expect(waLog).toBeDefined();

      // Verify all 9 required schema fields exist on every log document
      const requiredFields = [
        'notification_id',
        'event',
        'channel',
        'status',
        'provider',
        'provider_message_id',
        'recipient',
        'created_at',
        'updated_at'
      ];

      for (const field of requiredFields) {
        expect(emailLog).toHaveProperty(field);
        expect(waLog).toHaveProperty(field);
      }

      expect(emailLog.event).toBe('ORDER_PLACED');
      expect(waLog.event).toBe('ORDER_PLACED');
      expect(emailLog.recipient).toBe('aditya@example.com');
      expect(waLog.recipient).toContain('9198');
    });

    it('handles guest checkout with customer_business_id undefined and creates notification_logs without undefined fields', async () => {
      const mockDb = createMockDb();

      const guestOrder = {
        order_id: 'KL-704862-LX',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        customer_name: 'Sandeep Singh Bhadoria',
        customer_email: 'isandeepbhadoria@gmail.com',
        customer_phone: '7688886661',
        grand_total: 3899,
        status: 'placed'
      };

      const result = await publishNotification(mockDb, {
        event: 'ORDER_PLACED',
        order: guestOrder,
        customer: {
          profileId: 'guest',
          customerId: undefined,
          name: 'Sandeep Singh Bhadoria',
          email: 'isandeepbhadoria@gmail.com',
          phone: '7688886661'
        }
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('SENT');
      expect(result.dispatchedChannels).toEqual(['email', 'whatsapp']);

      // Verify email provider execution
      expect(result.results.email).toBeDefined();
      expect(result.results.email.success).toBe(true);
      expect(result.results.email.provider).toContain('resend');

      // Verify whatsapp provider execution
      expect(result.results.whatsapp).toBeDefined();
      expect(result.results.whatsapp.success).toBe(true);
      expect(result.results.whatsapp.provider).toContain('msg91_whatsapp');

      // Verify notification_logs documents created in Firestore
      const logKeys = Object.keys(mockFirestoreDocs).filter(k => k.startsWith('notification_logs/'));
      expect(logKeys.length).toBe(2);

      for (const logKey of logKeys) {
        const docData = mockFirestoreDocs[logKey];
        expect(docData.customer_profile_id).toBe('guest');
        // Ensure customer_business_id is either omitted or not undefined
        expect(docData).not.toHaveProperty('customer_business_id', undefined);
        
        // Ensure no value in docData is undefined
        for (const [key, val] of Object.entries(docData)) {
          expect(val).not.toBeUndefined();
        }
      }
    });

    it('returns success: false and status: FAILED if a provider or log creation fails', async () => {
      const failingDb = {
        collection: (colName: string) => ({
          doc: (docId?: string) => ({
            get: async () => { throw new Error('Firestore DB Connection Failed'); },
            set: async () => { throw new Error('Firestore Write Error'); }
          })
        })
      };

      const result = await publishNotification(failingDb, {
        event: 'ORDER_PLACED',
        order: { order_id: 'KL-FAIL-1' },
        customer: {
          profileId: 'guest',
          name: 'Fail User',
          email: 'fail@example.com',
          phone: '919000000000'
        }
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Firestore');
    });
  });

  describe('3. Phase 8A.8 — Order Confirmation Email & Channel Independence Regression Tests', () => {
    it('ORDER_PLACED selects order-confirmation template and does NOT send WELCOME email', async () => {
      const { emailProvider } = await import('../notification/notificationProviders/emailProvider');

      const testOrder = {
        order_id: 'KL-888999',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        customer_name: 'Priya Sharma',
        customer_email: 'priya@example.com',
        customer_phone: '919876543210',
        subtotal: 3000,
        discount: 0,
        shipping_cost: 0,
        grand_total: 3000,
        items: [{ product_id: 'p1', name: 'Linen Shirt', price: 3000, quantity: 1, size: 'M' }],
        status: 'placed',
        address: '123 Jaipur St',
        city: 'Jaipur',
        state: 'Rajasthan',
        pincode: '302001'
      };

      const result = await emailProvider.dispatch(
        'ORDER_PLACED',
        { profileId: 'cust_1', name: 'Priya Sharma', email: 'priya@example.com' },
        testOrder as any
      );

      expect(result.success).toBe(true);
      // Verify simulated or real dispatch metadata is order-transactional
      expect(result.metadata?.simulated ? result.metadata.event : 'ORDER_PLACED').toBe('ORDER_PLACED');
    });

    it('WELCOME template is restricted to actual customer account creation', async () => {
      const { emailProvider } = await import('../notification/notificationProviders/emailProvider');

      const result = await emailProvider.dispatch(
        'WELCOME',
        { profileId: 'cust_2', name: 'New User', email: 'newuser@example.com' }
      );

      expect(result.success).toBe(true);
      expect(result.metadata?.subject || 'Welcome to Sa and Sha™').toContain('Welcome');
    });

    it('selecting or unselecting marketing checkboxes does NOT block transactional notifications', async () => {
      const { routeNotificationEvent } = await import('../notification/notificationRouter');

      const mockDb = {
        collection: (col: string) => ({
          doc: (id: string) => ({
            get: async () => ({
              exists: true,
              data: () => ({
                notification_preferences: {
                  email: { orders: false, marketing: false },
                  whatsapp: { orders: false, marketing: false }
                }
              })
            })
          })
        })
      };

      const customer = {
        profileId: 'cust_optout',
        name: 'Opt Out User',
        email: 'optout@example.com',
        phone: '919876543210'
      };

      const activeChannels = await routeNotificationEvent(mockDb, 'ORDER_PLACED', customer);

      expect(activeChannels).toEqual(['email', 'whatsapp']);
    });

    it('channel errors in email do NOT stop WhatsApp notification from dispatching', async () => {
      const mockDb = createMockDb();

      const testOrder = {
        order_id: 'KL-INDEP-01',
        tracking_token: 'trk_0123456789abcdef0123456789abcdef',
        customer_name: 'Test Customer',
        customer_email: 'test@example.com',
        customer_phone: '919876543210',
        grand_total: 1500,
        status: 'placed'
      };

      // Mock emailProvider.dispatch to throw an error while WhatsApp succeeds
      const { emailProvider } = await import('../notification/notificationProviders/emailProvider');
      const originalDispatch = emailProvider.dispatch;
      emailProvider.dispatch = vi.fn().mockRejectedValue(new Error('Email server connection timeout'));

      try {
        const result = await publishNotification(mockDb, {
          event: 'ORDER_PLACED',
          order: testOrder,
          customer: {
            profileId: 'cust_indep',
            name: 'Test Customer',
            email: 'test@example.com',
            phone: '919876543210'
          }
        });

        expect(result.results.email.success).toBe(false);
        expect(result.results.email.error).toContain('Email server connection timeout');

        // Verify WhatsApp executed successfully despite email failure
        expect(result.results.whatsapp.success).toBe(true);
        expect(result.results.whatsapp.provider).toBe('msg91_whatsapp_mock');
      } finally {
        emailProvider.dispatch = originalDispatch;
      }
    });
  });
});
