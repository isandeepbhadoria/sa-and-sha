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
 * Normalizes phone numbers to E.164 digits without a leading plus, default 91 prefix for India.
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

export interface BuildPayloadOptions {
  toPhone: string;
  templateName: string;
  language?: string;
  bodyParams: string[];
}

/**
 * Builds a Meta WhatsApp Cloud API template-message payload.
 * Endpoint: POST https://graph.facebook.com/{version}/{phoneNumberId}/messages
 */
export function buildPayload(options: BuildPayloadOptions) {
  return {
    messaging_product: 'whatsapp',
    to: options.toPhone,
    type: 'template',
    template: {
      name: options.templateName,
      language: {
        code: options.language || 'en'
      },
      components: [
        {
          type: 'body',
          parameters: options.bodyParams.map((text) => ({ type: 'text', text: String(text !== undefined && text !== null ? text : '') }))
        }
      ]
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
  /**
   * Reads the Meta Cloud API credentials — null if either is missing, so
   * callers fail closed.
   */
  private getConfig(): { accessToken: string; phoneNumberId: string; apiVersion: string } | null {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    if (!accessToken || !phoneNumberId) return null;
    return { accessToken, phoneNumberId, apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0' };
  }

  /**
   * Validate if an event has a registered WhatsApp template
   */
  public validateTemplate(eventType: NotificationEventType): { isValid: boolean; templateName: string; config?: any } {
    const config = WHATSAPP_TEMPLATE_MAPPINGS[eventType];
    if (!config) {
      return { isValid: false, templateName: 'ss_generic_v1' };
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
   * Fetch the live approved template list from the Meta WhatsApp Business
   * Account for verification.
   */
  public async verifyApprovedTemplates(accessTokenOverride?: string, wabaIdOverride?: string) {
    const accessToken = (accessTokenOverride || process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
    const wabaId = (wabaIdOverride || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();
    const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';

    const requiredTemplates = [
      APPROVED_WHATSAPP_TEMPLATES.ORDER_PLACED,
      APPROVED_WHATSAPP_TEMPLATES.PAYMENT_RECEIVED,
      APPROVED_WHATSAPP_TEMPLATES.ORDER_SHIPPED,
      APPROVED_WHATSAPP_TEMPLATES.ORDER_DELIVERED,
      APPROVED_WHATSAPP_TEMPLATES.REFUND_PROCESSED,
      APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS
    ];

    if (!accessToken || !wabaId) {
      return {
        verified: false,
        reason: 'WHATSAPP_ACCESS_TOKEN or WHATSAPP_BUSINESS_ACCOUNT_ID missing',
        requiredTemplates,
        templateDetails: {}
      };
    }

    try {
      const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates?fields=name,status,language,category&limit=250`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return {
          verified: false,
          statusCode: response.status,
          reason: `Meta Template API returned HTTP ${response.status}`,
          requiredTemplates,
          templateDetails: {}
        };
      }

      const data: any = await response.json().catch(() => ({}));
      const templatesList: any[] = Array.isArray(data?.data) ? data.data : [];

      const templateDetails: Record<string, any> = {};
      let allFound = true;

      for (const tName of requiredTemplates) {
        const found = templatesList.find((t) => t.name === tName);
        if (found) {
          const approved = found.status === 'APPROVED';
          if (!approved) allFound = false;
          templateDetails[tName] = {
            approved,
            status: found.status,
            language: found.language || 'en',
            category: found.category || 'UTILITY'
          };
        } else {
          allFound = false;
          templateDetails[tName] = {
            approved: false,
            reason: 'Template not found on this WhatsApp Business Account'
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
        reason: err.message || 'Network error verifying WhatsApp templates',
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
        provider: 'meta_whatsapp',
        channel: 'whatsapp',
        error: `Phone normalization failed: ${phoneResult.error}`
      };
    }

    const formattedPhone = phoneResult.normalized;
    const maskedPhone = phoneResult.masked;

    // 2. Template Mapping & Parameter Extraction
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
        provider: 'meta_whatsapp',
        channel: 'whatsapp',
        error: err.message || 'CONFIGURATION_ERROR: Parameter extraction failed.',
        metadata: { phone: maskedPhone, eventType, templateName }
      };
    }

    if (bodyValues.some((v) => v === undefined || v === null || v === '')) {
      return {
        success: false,
        provider: 'meta_whatsapp',
        channel: 'whatsapp',
        error: 'CONFIGURATION_ERROR: Template parameters contain empty or undefined values.',
        metadata: { phone: maskedPhone, eventType, templateName, bodyValues }
      };
    }

    const isMockMode = process.env.WHATSAPP_MOCK_MODE === 'true';

    // 3. Mock/Simulation Mode if explicitly enabled via WHATSAPP_MOCK_MODE=true
    if (isMockMode) {
      console.log(`[WHATSAPP SERVICE] Mock mode active. Simulating dispatch to ${maskedPhone} [Template: ${templateName}]`);
      return {
        success: true,
        provider: 'meta_whatsapp_mock',
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
    const config = this.getConfig();
    if (!config) {
      console.error(`[WHATSAPP SERVICE] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID in production mode. Failing closed.`);
      return {
        success: false,
        provider: 'meta_whatsapp',
        channel: 'whatsapp',
        error: 'CONFIGURATION_ERROR: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing and WHATSAPP_MOCK_MODE is not true.',
        metadata: { phone: maskedPhone, eventType, templateName }
      };
    }

    // 4. Construct Payload in Meta Cloud API's template-message structure
    const requestPayload = buildPayload({
      toPhone: formattedPhone,
      templateName,
      language,
      bodyParams: bodyValues
    });

    // 5. Execute HTTP Request with Timeout + Retry
    const maxRetries = 2;
    let attempt = 0;
    let lastError = '';

    while (attempt <= maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const responseData: any = await response.json().catch(() => ({}));

        if (response.ok && responseData.messages?.[0]?.id) {
          const providerMsgId = responseData.messages[0].id;
          console.log(`[WHATSAPP SERVICE] Successfully dispatched to ${maskedPhone} (MsgId: ${providerMsgId})`);
          return {
            success: true,
            provider: 'meta_whatsapp',
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
        const errMsg = responseData.error?.message || `Meta WhatsApp API Error (${statusCode})`;
        lastError = errMsg;

        // If non-transient error (e.g., 400 Bad Request, template rejected), break immediately
        if (!this.isTransientError(statusCode, errMsg)) {
          return {
            success: false,
            provider: 'meta_whatsapp',
            channel: 'whatsapp',
            error: `Non-retryable Meta WhatsApp error: ${errMsg}`,
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
      provider: 'meta_whatsapp',
      channel: 'whatsapp',
      error: `Failed after ${attempt} attempts: ${lastError}`,
      metadata: { phone: maskedPhone }
    };
  }
}

export const whatsappService = new EnterpriseWhatsAppService();
