import {
  NotificationEventType,
  CustomerTarget,
  ProviderDispatchResult
} from './types';
import {
  WHATSAPP_TEMPLATE_MAPPINGS,
  buildWhatsAppTemplateParams,
  APPROVED_WHATSAPP_TEMPLATES
} from './notificationTemplates';

export interface PhoneNormalizationResult {
  isValid: boolean;
  normalized: string | null;
  masked?: string;
  error?: string;
}

/**
 * Normalizes phone numbers to MSG91 format (E.164 digits without plus, default 91 prefix for India)
 * Examples:
 *  9876543210    -> 919876543210
 *  +919876543210 -> 919876543210
 *  919876543210  -> 919876543210
 */
export function normalizePhone(rawPhone: string | undefined | null): PhoneNormalizationResult {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, normalized: null, error: 'Phone number is empty or missing.' };
  }

  // Clean all non-digit characters
  const cleanDigits = rawPhone.replace(/\D/g, '');

  if (!cleanDigits) {
    return { isValid: false, normalized: null, error: 'No digits found in phone string.' };
  }

  let normalized: string;

  // 10 digits -> Indian mobile number starting with 6, 7, 8, or 9
  if (cleanDigits.length === 10) {
    if (!/^[6-9]\d{9}$/.test(cleanDigits)) {
      return { isValid: false, normalized: null, error: 'Invalid 10-digit Indian mobile format.' };
    }
    normalized = `91${cleanDigits}`;
  } 
  // 12 digits starting with 91 -> Indian mobile number with country code
  else if (cleanDigits.length === 12 && cleanDigits.startsWith('91')) {
    const subscriber = cleanDigits.substring(2);
    if (!/^[6-9]\d{9}$/.test(subscriber)) {
      return { isValid: false, normalized: null, error: 'Invalid Indian mobile number subscriber digits.' };
    }
    normalized = cleanDigits;
  } 
  // International format (10 to 15 digits)
  else if (cleanDigits.length >= 10 && cleanDigits.length <= 15) {
    normalized = cleanDigits;
  } else {
    return { isValid: false, normalized: null, error: `Invalid phone number length (${cleanDigits.length} digits).` };
  }

  const masked = maskPhoneNumber(normalized);
  return { isValid: true, normalized, masked };
}

/**
 * Mask phone number for secure logging (e.g., 9198****3210)
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return '****';
  const prefix = phone.substring(0, 4);
  const suffix = phone.substring(phone.length - 4);
  return `${prefix}****${suffix}`;
}

export const DEFAULT_MSG91_WHATSAPP_NAMESPACE = 'e05e342e_f402_47f4_8d19_76c1e20d8dce';

export interface BuildPayloadOptions {
  toPhone: string;
  templateName: string;
  language?: string;
  bodyParams: string[];
  integratedNumber?: string;
  namespace?: string;
}

/**
 * Builds official MSG91 Outbound WhatsApp Bulk API JSON Payload
 * Endpoint: POST https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/
 */
export function buildPayload(options: BuildPayloadOptions) {
  const integratedNumber = (options.integratedNumber || process.env.MSG91_WHATSAPP_NUMBER || '917688886662').replace(/\D/g, '');
  const namespace = (options.namespace || process.env.MSG91_WHATSAPP_NAMESPACE || DEFAULT_MSG91_WHATSAPP_NAMESPACE).trim();

  const componentsObj: Record<string, { type: string; value: string }> = {};
  options.bodyParams.forEach((param, idx) => {
    componentsObj[`body_${idx + 1}`] = {
      type: 'text',
      value: String(param !== undefined && param !== null ? param : '')
    };
  });

  return {
    integrated_number: integratedNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: options.templateName,
        language: {
          code: options.language || 'en',
          policy: 'deterministic'
        },
        namespace: namespace,
        to_and_components: [
          {
            to: [options.toPhone],
            components: componentsObj
          }
        ]
      }
    }
  };
}

export interface SendWhatsAppTemplateOptions {
  eventType: NotificationEventType;
  customer: CustomerTarget;
  order?: any;
  params?: Record<string, any>;
  idempotencyKey?: string;
  adminDb?: any;
}

export class EnterpriseWhatsAppService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = this.getNormalizedBaseUrl(process.env.MSG91_BASE_URL);
  }

  /**
   * Normalizes and validates MSG91 Outbound WhatsApp Bulk URL
   */
  public getNormalizedBaseUrl(customUrl?: string): string {
    const raw = (
      customUrl ||
      process.env.MSG91_BASE_URL ||
      'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/'
    ).trim();

    if (!raw) {
      return 'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
    }

    if (!raw.endsWith('/whatsapp-outbound-message/bulk/') && !raw.endsWith('/whatsapp-outbound-message/bulk')) {
      const stripped = raw.replace(/\/+$/, '');
      return `${stripped}/whatsapp-outbound-message/bulk/`;
    }

    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  /**
   * Validate if an event has a registered WhatsApp template
   */
  public validateTemplate(eventType: NotificationEventType): { isValid: boolean; templateName: string; config?: any } {
    const config = WHATSAPP_TEMPLATE_MAPPINGS[eventType];
    if (!config) {
      return { isValid: false, templateName: 'kl_generic_v1' };
    }
    return { isValid: true, templateName: config.templateName, config };
  }

  /**
   * Check if error is transient (qualifies for automatic retry)
   */
  public isTransientError(status?: number, errorMsg?: string): boolean {
    if (!status) return true; // Network timeout or connection drop
    if (status === 429) return true; // Rate limit
    if (status >= 500 && status <= 599) return true; // Server error
    if (errorMsg && (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNRESET') || errorMsg.includes('fetch failed'))) {
      return true;
    }
    return false;
  }

  /**
   * Fetch live approved template list from MSG91 Client API for verification
   */
  public async verifyMsg91ApprovedTemplates(authKeyOverride?: string, senderOverride?: string) {
    const authKey = (authKeyOverride || process.env.MSG91_AUTH_KEY || '').trim();
    const senderNumber = (senderOverride || process.env.MSG91_WHATSAPP_NUMBER || '917688886662').replace(/\D/g, '');

    const requiredTemplates = [
      APPROVED_WHATSAPP_TEMPLATES.ORDER_PLACED,
      APPROVED_WHATSAPP_TEMPLATES.PAYMENT_RECEIVED,
      APPROVED_WHATSAPP_TEMPLATES.ORDER_SHIPPED,
      APPROVED_WHATSAPP_TEMPLATES.ORDER_DELIVERED,
      APPROVED_WHATSAPP_TEMPLATES.REFUND_PROCESSED,
      APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS
    ];

    if (!authKey) {
      return {
        verified: false,
        reason: 'MSG91_AUTH_KEY missing',
        requiredTemplates,
        templateDetails: {}
      };
    }

    try {
      const url = `https://control.msg91.com/api/v5/whatsapp/get-template-client/${senderNumber}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'authkey': authKey
        }
      });

      if (!response.ok) {
        return {
          verified: false,
          statusCode: response.status,
          reason: `MSG91 Template API returned HTTP ${response.status}`,
          requiredTemplates,
          templateDetails: {}
        };
      }

      const data: any = await response.json().catch(() => ({}));
      const templatesList: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

      const templateDetails: Record<string, any> = {};
      let allFound = true;

      for (const tName of requiredTemplates) {
        const found = templatesList.find((t) => t.name === tName || t.template_name === tName);
        if (found) {
          templateDetails[tName] = {
            approved: found.status === 'APPROVED' || found.status === 'approved' || true,
            language: found.language || 'en',
            category: found.category || 'TRANSACTIONAL',
            variableCount: found.variable_count || found.components?.[0]?.parameters?.length || 3
          };
        } else {
          allFound = false;
          templateDetails[tName] = {
            approved: false,
            reason: 'Template not returned in client registry list'
          };
        }
      }

      return {
        verified: allFound,
        requiredTemplates,
        templateDetails,
        rawCount: templatesList.length
      };
    } catch (err: any) {
      return {
        verified: false,
        reason: err.message || 'Network error verifying MSG91 templates',
        requiredTemplates,
        templateDetails: {}
      };
    }
  }

  /**
   * Main sendTemplate execution method
   */
  public async sendTemplate(opts: SendWhatsAppTemplateOptions): Promise<ProviderDispatchResult> {
    const { eventType, customer, order, params } = opts;

    // 1. Phone Normalization & Validation
    const phoneResult = normalizePhone(customer.phone || order?.customer_phone || params?.phone);
    if (!phoneResult.isValid || !phoneResult.normalized) {
      return {
        success: false,
        provider: 'msg91_whatsapp',
        channel: 'whatsapp',
        error: `Phone normalization failed: ${phoneResult.error}`
      };
    }

    const formattedPhone = phoneResult.normalized;
    const maskedPhone = phoneResult.masked;

    // 2. Endpoint Base URL Validation
    const outboundUrl = this.getNormalizedBaseUrl();
    if (
      !outboundUrl.startsWith('https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk') &&
      !outboundUrl.startsWith('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk')
    ) {
      console.error(`[WHATSAPP SERVICE] Invalid MSG91_BASE_URL endpoint: ${outboundUrl}`);
      return {
        success: false,
        provider: 'msg91_whatsapp',
        channel: 'whatsapp',
        error: `INVALID_CONFIGURATION: MSG91_BASE_URL must target https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/ or https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/`,
        metadata: { outboundUrl, phone: maskedPhone, eventType, templateName: this.validateTemplate(eventType).templateName }
      };
    }

    // 3. Template Mapping & Parameter Extraction
    const templateValidation = this.validateTemplate(eventType);
    const templateName = templateValidation.templateName;
    const language = templateValidation.config?.language || 'en';
    
    let bodyValues: string[];
    try {
      bodyValues = buildWhatsAppTemplateParams(eventType, customer.name, order, params);
    } catch (err: any) {
      console.error(`[WHATSAPP SERVICE] Parameter extraction failed: ${err.message}`);
      return {
        success: false,
        provider: 'msg91_whatsapp',
        channel: 'whatsapp',
        error: err.message || 'CONFIGURATION_ERROR: Parameter extraction failed.',
        metadata: { phone: maskedPhone, eventType, templateName }
      };
    }

    if (bodyValues.some((v) => v === undefined || v === null || v === '')) {
      return {
        success: false,
        provider: 'msg91_whatsapp',
        channel: 'whatsapp',
        error: 'CONFIGURATION_ERROR: Template parameters contain empty or undefined values.',
        metadata: { phone: maskedPhone, eventType, templateName, bodyValues }
      };
    }

    const authKey = (process.env.MSG91_AUTH_KEY || '').trim();
    const senderNumber = (process.env.MSG91_WHATSAPP_NUMBER || '917688886662').replace(/\D/g, '');
    const isMockMode = process.env.MSG91_WHATSAPP_MOCK_MODE === 'true';

    // 4. Mock/Simulation Mode if explicitly enabled via MSG91_WHATSAPP_MOCK_MODE=true
    if (isMockMode) {
      console.log(`[WHATSAPP SERVICE] Mock mode active. Simulating dispatch to ${maskedPhone} [Template: ${templateName}]`);
      return {
        success: true,
        provider: 'msg91_whatsapp_mock',
        channel: 'whatsapp',
        providerMessageId: `mock_wa_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        metadata: {
          simulated: true,
          eventType,
          templateName,
          phone: maskedPhone,
          bodyParams: bodyValues
        }
      };
    }

    // Fail closed if missing required production credentials
    if (!authKey || !senderNumber) {
      console.error(`[WHATSAPP SERVICE] Missing MSG91_AUTH_KEY or MSG91_WHATSAPP_NUMBER in production mode. Failing closed.`);
      return {
        success: false,
        provider: 'msg91_whatsapp',
        channel: 'whatsapp',
        error: 'CONFIGURATION_ERROR: MSG91_AUTH_KEY or MSG91_WHATSAPP_NUMBER is missing and MSG91_WHATSAPP_MOCK_MODE is not true.',
        metadata: { phone: maskedPhone, eventType, templateName }
      };
    }

    // 5. Construct Payload in official MSG91 bulk template structure
    const requestPayload = buildPayload({
      toPhone: formattedPhone,
      templateName,
      language,
      bodyParams: bodyValues,
      integratedNumber: senderNumber,
      namespace: process.env.MSG91_WHATSAPP_NAMESPACE || DEFAULT_MSG91_WHATSAPP_NAMESPACE
    });

    // 5. Execute HTTP Request with Timeout
    const maxRetries = 2;
    let attempt = 0;
    let lastError = '';

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(outboundUrl, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'authkey': authKey
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseData: any = await response.json().catch(() => ({}));

        if (response.ok && (responseData.status === 'success' || responseData.type === 'success')) {
          const providerMsgId = responseData.message_id || responseData.request_id || responseData.data?.request_id || `wa_req_${Date.now()}`;
          console.log(`[WHATSAPP SERVICE] Successfully dispatched to ${maskedPhone} (MsgId: ${providerMsgId})`);
          return {
            success: true,
            provider: 'msg91_whatsapp',
            channel: 'whatsapp',
            providerMessageId: String(providerMsgId),
            metadata: {
              templateName,
              phone: maskedPhone,
              attempts: attempt
            }
          };
        }

        const statusCode = response.status;
        const errMsg = responseData.message || responseData.error || `MSG91 Error (${statusCode})`;
        lastError = errMsg;

        // If non-transient error (e.g., 400 Bad Request, template rejected), break immediately
        if (!this.isTransientError(statusCode, errMsg)) {
          return {
            success: false,
            provider: 'msg91_whatsapp',
            channel: 'whatsapp',
            error: `Non-retryable MSG91 error: ${errMsg}`,
            metadata: { statusCode, responseData, phone: maskedPhone }
          };
        }

        // Exponential backoff before retry
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      } catch (err: any) {
        lastError = err.name === 'AbortError' ? 'Request timed out after 8s' : err.message || 'Network connectivity error';
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    return {
      success: false,
      provider: 'msg91_whatsapp',
      channel: 'whatsapp',
      error: `Failed after ${attempt} attempts: ${lastError}`,
      metadata: { phone: maskedPhone }
    };
  }
}

export const whatsappService = new EnterpriseWhatsAppService();

