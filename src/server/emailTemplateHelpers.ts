import { getAdminDb } from './firebaseAdmin';
import { sendMail, getDefaultFromAddress } from './mailer';
import sanitizeHtml from 'sanitize-html';
import {
  EmailTemplate,
  EmailTemplateVersion,
  EmailTemplateVariable,
  DEFAULT_EMAIL_VARIABLES,
  MOCK_TEST_VARIABLES
} from '../types/emailTemplates';

export type { EmailTemplate, EmailTemplateVersion, EmailTemplateVariable };
export { DEFAULT_EMAIL_VARIABLES, MOCK_TEST_VARIABLES };

// Custom Error for Optimistic Lock Conflict
export class VersionConflictError extends Error {
  public code = 'VERSION_CONFLICT';
  public currentVersion: number;

  constructor(message: string, currentVersion: number) {
    super(message);
    this.name = 'VersionConflictError';
    this.currentVersion = currentVersion;
  }
}

// Server-side HTML Sanitizer for Email Templates
export function sanitizeEmailHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return sanitizeHtml(html, {
    allowVulnerableTags: true,
    allowedTags: [
      'html', 'head', 'body', 'title', 'style', 'meta',
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th',
      'ul', 'ol', 'li', 'a', 'img', 'strong', 'em', 'b', 'i', 'u', 's', 'strike',
      'sub', 'sup', 'hr', 'br', 'center', 'blockquote', 'font', 'small', 'code', 'pre'
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'id', 'align', 'valign', 'width', 'height', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'color'],
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height', 'border', 'style'],
      'meta': ['charset', 'name', 'content', 'viewport'],
      'html': ['lang']
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data']
    },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    exclusiveFilter: (frame) => {
      if (frame.tag === 'meta') {
        const httpEquiv = (frame.attribs['http-equiv'] || '').toLowerCase();
        const content = (frame.attribs['content'] || '').toLowerCase();
        if (httpEquiv === 'refresh' || content.includes('refresh') || content.includes('url=')) {
          return true;
        }
      }
      return false;
    }
  });
}

// Input Bounds and Format Validation
export function validateEmailTemplateInput(input: {
  templateId?: string;
  subject?: string;
  html?: string;
  plain_text?: string;
  recipientEmail?: string;
}): { valid: boolean; error?: string } {
  if (input.templateId !== undefined) {
    if (!input.templateId || typeof input.templateId !== 'string' || !/^[a-z0-9_-]{1,64}$/i.test(input.templateId)) {
      return { valid: false, error: 'Invalid template ID format. Must be alphanumeric with underscores or hyphens (max 64 chars).' };
    }
  }

  if (input.subject !== undefined && input.subject !== null) {
    if (typeof input.subject !== 'string' || input.subject.length > 300) {
      return { valid: false, error: 'Subject line exceeds maximum length of 300 characters.' };
    }
  }

  if (input.html !== undefined && input.html !== null) {
    if (typeof input.html !== 'string' || Buffer.byteLength(input.html, 'utf8') > 500 * 1024) {
      return { valid: false, error: 'HTML content exceeds maximum allowed size of 500 KB.' };
    }
  }

  if (input.plain_text !== undefined && input.plain_text !== null) {
    if (typeof input.plain_text !== 'string' || Buffer.byteLength(input.plain_text, 'utf8') > 200 * 1024) {
      return { valid: false, error: 'Plain text content exceeds maximum allowed size of 200 KB.' };
    }
  }

  if (input.recipientEmail !== undefined) {
    if (!input.recipientEmail || typeof input.recipientEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail.trim())) {
      return { valid: false, error: 'Invalid or missing test recipient email address.' };
    }
  }

  return { valid: true };
}

// Helper generator for HTML template wrapper
function wrapSaAndShaEmailHtml(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F9F6F0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2A211C; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 30px auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E6DEC8; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
    .header { background-color: #2A211C; padding: 32px 24px; text-align: center; }
    .header h1 { color: #F9F6F0; margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase; }
    .header p { color: #E5D2BC; margin: 6px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; }
    .content { padding: 36px 32px; }
    .badge { display: inline-block; background-color: #F4EBE1; color: #B08D57; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 6px 12px; border-radius: 20px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 600; color: #2A211C; margin: 0 0 16px 0; line-height: 1.3; }
    .body-text { font-size: 15px; line-height: 1.6; color: #4A443C; margin: 0 0 24px 0; }
    .card { background-color: #FAF8F5; border: 1px solid #EFEAE1; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .card-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; color: #4A443C; }
    .card-row strong { color: #2A211C; }
    .button-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #B08D57; color: #FFFFFF !important; text-decoration: none; font-size: 14px; font-weight: 600; padding: 14px 28px; border-radius: 6px; text-transform: uppercase; letter-spacing: 1px; }
    .footer { background-color: #FAF8F5; border-top: 1px solid #EFEAE1; padding: 24px 32px; text-align: center; font-size: 12px; color: #8C8275; line-height: 1.5; }
    .footer a { color: #B08D57; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SA AND SHA</h1>
      <p>Everyday Elegance</p>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>&copy; {{year}} {{company_name}}. All rights reserved.</p>
      <p>GSTIN: {{gst_number}} | Support: <a href="mailto:{{support_email}}">{{support_email}}</a> | {{support_phone}}</p>
    </div>
  </div>
</body>
</html>`;
}

// Starter templates definitions
export function getDefaultTemplatesList(): EmailTemplate[] {
  const now = new Date().toISOString();
  
  const allVars = DEFAULT_EMAIL_VARIABLES.map(v => v.name);

  return [
    {
      template_id: 'welcome',
      event_id: 'welcome',
      name: 'Welcome Email',
      subject: 'Welcome to Sa and Sha, {{first_name}}!',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'coupon_code', 'discount', 'company_name', 'year', 'gst_number', 'support_email', 'support_phone'],
      html: wrapSaAndShaEmailHtml('Welcome to Sa and Sha', `
        <span class="badge">Welcome Gift</span>
        <h2 class="title">Hello {{customer_name}},</h2>
        <p class="body-text">Thank you for joining the {{company_name}} family. We are thrilled to share our latest collection with you.</p>
        <div class="card">
          <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #8C8275; letter-spacing: 1px;">Exclusive Welcome Voucher</p>
          <p style="margin: 0; font-size: 22px; font-weight: 700; color: #B08D57;">Use Code: {{coupon_code}}</p>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #4A443C;">Enjoy {{discount}} off on your first order with us.</p>
        </div>
        <div class="button-container">
          <a href="https://saandsha.com" class="btn">Explore Collection</a>
        </div>
      `),
      plain_text: `Hello {{customer_name}},

Welcome to {{company_name}}!

We are thrilled to welcome you. Enjoy your exclusive welcome voucher:
Code: {{coupon_code}} ({{discount}} off)

Shop now: https://saandsha.com

Best regards,
The {{company_name}} Team`
    },
    {
      template_id: 'order_confirmed',
      event_id: 'order_confirmed',
      name: 'Order Confirmed',
      subject: 'Order Confirmed! {{order_id}} - Sa and Sha',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'order_id', 'order_date', 'order_total', 'payment_method', 'expected_delivery', 'invoice_link', 'company_name', 'year', 'gst_number', 'support_email', 'support_phone'],
      html: wrapSaAndShaEmailHtml('Order Confirmed', `
        <span class="badge">Order Confirmed</span>
        <h2 class="title">Thank you for your order, {{first_name}}!</h2>
        <p class="body-text">We have received your order <strong>#{{order_id}}</strong> placed on {{order_date}}. Our team is preparing it with care.</p>
        <div class="card">
          <div class="card-row"><span>Order Reference:</span> <strong>#{{order_id}}</strong></div>
          <div class="card-row"><span>Order Date:</span> <strong>{{order_date}}</strong></div>
          <div class="card-row"><span>Payment Method:</span> <strong>{{payment_method}}</strong></div>
          <div class="card-row"><span>Expected Delivery:</span> <strong>{{expected_delivery}}</strong></div>
          <div class="card-row" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #EFEAE1; font-size: 16px;">
            <span>Total Amount:</span> <strong style="color: #B08D57;">{{order_total}}</strong>
          </div>
        </div>
        <div class="button-container">
          <a href="{{invoice_link}}" class="btn">View Order Details</a>
        </div>
      `),
      plain_text: `Thank you for your order, {{customer_name}}!

Order ID: {{order_id}}
Order Date: {{order_date}}
Total: {{order_total}}
Payment Method: {{payment_method}}
Expected Delivery: {{expected_delivery}}

View invoice: {{invoice_link}}

Thank you for choosing {{company_name}}.`
    },
    {
      template_id: 'payment_success',
      event_id: 'payment_success',
      name: 'Payment Success',
      subject: 'Payment Received for Order {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'order_id', 'order_total', 'payment_method', 'company_name', 'year', 'gst_number', 'support_email'],
      html: wrapSaAndShaEmailHtml('Payment Successful', `
        <span class="badge">Payment Successful</span>
        <h2 class="title">Payment Confirmed</h2>
        <p class="body-text">Hi {{customer_name}}, your payment of <strong>{{order_total}}</strong> for order <strong>#{{order_id}}</strong> via {{payment_method}} was successful.</p>
        <div class="card">
          <div class="card-row"><span>Order ID:</span> <strong>#{{order_id}}</strong></div>
          <div class="card-row"><span>Amount Paid:</span> <strong>{{order_total}}</strong></div>
          <div class="card-row"><span>Status:</span> <strong style="color: #10B981;">PAID</strong></div>
        </div>
      `),
      plain_text: `Hi {{customer_name}},

Your payment of {{order_total}} for order #{{order_id}} was successful.

Thank you,
{{company_name}}`
    },
    {
      template_id: 'payment_failed',
      event_id: 'payment_failed',
      name: 'Payment Failed',
      subject: 'Action Required: Payment Failed for Order {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'order_id', 'order_total', 'support_email', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Payment Failed', `
        <span class="badge" style="background-color: #FEE2E2; color: #991B1B;">Payment Action Needed</span>
        <h2 class="title">Payment Could Not Be Processed</h2>
        <p class="body-text">Dear {{customer_name}}, we encountered an issue processing payment for order <strong>#{{order_id}}</strong> (Total: {{order_total}}).</p>
        <p class="body-text">Please try completing your order or contact our support team at <a href="mailto:{{support_email}}">{{support_email}}</a> for assistance.</p>
      `),
      plain_text: `Dear {{customer_name}},

We could not process your payment for order #{{order_id}} (Amount: {{order_total}}).

Please try again or contact {{support_email}} for support.`
    },
    {
      template_id: 'order_packed',
      event_id: 'order_packed',
      name: 'Order Packed',
      subject: 'Your order {{order_id}} is packed and ready!',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'order_id', 'courier', 'expected_delivery', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Order Packed', `
        <span class="badge">Order Packed</span>
        <h2 class="title">Ready for Dispatch, {{first_name}}!</h2>
        <p class="body-text">Great news! Your order <strong>#{{order_id}}</strong> has been carefully packed and hand-checked for quality.</p>
        <div class="card">
          <div class="card-row"><span>Courier Partner:</span> <strong>{{courier}}</strong></div>
          <div class="card-row"><span>Estimated Delivery:</span> <strong>{{expected_delivery}}</strong></div>
        </div>
      `),
      plain_text: `Hi {{first_name}},

Your order #{{order_id}} has been packed and is ready for courier pickup.

Courier: {{courier}}
Estimated Delivery: {{expected_delivery}}

Thank you,
{{company_name}}`
    },
    {
      template_id: 'order_shipped',
      event_id: 'order_shipped',
      name: 'Order Shipped',
      subject: 'Your Sa and Sha order {{order_id}} is on its way!',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'order_id', 'courier', 'tracking_number', 'tracking_link', 'expected_delivery', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Order Dispatched', `
        <span class="badge">Dispatched</span>
        <h2 class="title">Your Order Has Shipped!</h2>
        <p class="body-text">Hello {{first_name}}, your order <strong>#{{order_id}}</strong> has been handed over to {{courier}}.</p>
        <div class="card">
          <div class="card-row"><span>Tracking Number:</span> <strong>{{tracking_number}}</strong></div>
          <div class="card-row"><span>Courier:</span> <strong>{{courier}}</strong></div>
          <div class="card-row"><span>Expected Arrival:</span> <strong>{{expected_delivery}}</strong></div>
        </div>
        <div class="button-container">
          <a href="{{tracking_link}}" class="btn">Track Shipment</a>
        </div>
      `),
      plain_text: `Hello {{first_name}},

Your order #{{order_id}} has shipped via {{courier}}!

Tracking Number: {{tracking_number}}
Track Online: {{tracking_link}}
Expected Delivery: {{expected_delivery}}

{{company_name}}`
    },
    {
      template_id: 'out_for_delivery',
      event_id: 'out_for_delivery',
      name: 'Out For Delivery',
      subject: 'Out for Delivery: Order {{order_id}} arrives today!',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'order_id', 'courier', 'tracking_link', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Out For Delivery', `
        <span class="badge">Arriving Today</span>
        <h2 class="title">Your package is out for delivery!</h2>
        <p class="body-text">Hi {{first_name}}, {{courier}} will deliver order <strong>#{{order_id}}</strong> today. Please ensure someone is available at your delivery address.</p>
        <div class="button-container">
          <a href="{{tracking_link}}" class="btn">View Live Tracking</a>
        </div>
      `),
      plain_text: `Hi {{first_name}},

Order #{{order_id}} is out for delivery today via {{courier}}.

Track Live: {{tracking_link}}

Thank you,
{{company_name}}`
    },
    {
      template_id: 'delivered',
      event_id: 'delivered',
      name: 'Delivered',
      subject: 'Delivered: Your Sa and Sha order {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'order_id', 'support_email', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Order Delivered', `
        <span class="badge" style="background-color: #D1FAE5; color: #065F46;">Delivered</span>
        <h2 class="title">Enjoy Your Sa and Sha!</h2>
        <p class="body-text">Dear {{first_name}}, order <strong>#{{order_id}}</strong> has been delivered. We hope you love it as much as we loved putting it together for you.</p>
        <p class="body-text">If you have any feedback or questions, reach out to us at {{support_email}}.</p>
      `),
      plain_text: `Dear {{first_name}},

Order #{{order_id}} has been delivered. We hope you enjoy your Sa and Sha items!

If you need any support, email {{support_email}}.`
    },
    {
      template_id: 'cancelled',
      event_id: 'cancelled',
      name: 'Order Cancelled',
      subject: 'Order Cancellation Notice: {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'order_id', 'refund_amount', 'support_email', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Order Cancelled', `
        <span class="badge" style="background-color: #F3F4F6; color: #374151;">Order Cancelled</span>
        <h2 class="title">Order Cancellation Confirmed</h2>
        <p class="body-text">Dear {{customer_name}}, order <strong>#{{order_id}}</strong> has been cancelled as requested.</p>
        <p class="body-text">If payment was already deducted, a refund of <strong>{{refund_amount}}</strong> will be credited back within 5-7 business days.</p>
      `),
      plain_text: `Dear {{customer_name}},

Order #{{order_id}} has been cancelled.
Refund Amount: {{refund_amount}} (if applicable).

Support: {{support_email}}`
    },
    {
      template_id: 'refund_initiated',
      event_id: 'refund_initiated',
      name: 'Refund Initiated',
      subject: 'Refund Initiated for Order {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'order_id', 'refund_amount', 'payment_method', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Refund Initiated', `
        <span class="badge">Refund Initiated</span>
        <h2 class="title">Refund Process Started</h2>
        <p class="body-text">Dear {{customer_name}}, a refund of <strong>{{refund_amount}}</strong> for order <strong>#{{order_id}}</strong> has been initiated back to your original {{payment_method}}.</p>
      `),
      plain_text: `Dear {{customer_name}},

A refund of {{refund_amount}} for order #{{order_id}} has been initiated.

{{company_name}}`
    },
    {
      template_id: 'refund_completed',
      event_id: 'refund_completed',
      name: 'Refund Completed',
      subject: 'Refund Completed for Order {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'order_id', 'refund_amount', 'payment_method', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Refund Completed', `
        <span class="badge" style="background-color: #D1FAE5; color: #065F46;">Refund Completed</span>
        <h2 class="title">Refund Processed</h2>
        <p class="body-text">Dear {{customer_name}}, your refund of <strong>{{refund_amount}}</strong> for order <strong>#{{order_id}}</strong> has been successfully processed.</p>
      `),
      plain_text: `Dear {{customer_name}},

Your refund of {{refund_amount}} for order #{{order_id}} is complete.

Thank you,
{{company_name}}`
    },
    {
      template_id: 'return_approved',
      event_id: 'return_approved',
      name: 'Return Approved',
      subject: 'Return Request Approved for Order {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'order_id', 'courier', 'instructions', 'support_email', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Return Approved', `
        <span class="badge">Return Approved</span>
        <h2 class="title">Return Request Update</h2>
        <p class="body-text">Dear {{customer_name}}, your return request for order <strong>#{{order_id}}</strong> has been approved. Our logistics partner {{courier}} will schedule a reverse pickup.</p>
      `),
      plain_text: `Dear {{customer_name}},

Your return request for order #{{order_id}} has been approved.

Pickup via {{courier}} will be scheduled soon.

{{company_name}}`
    },
    {
      template_id: 'exchange_approved',
      event_id: 'exchange_approved',
      name: 'Exchange Approved',
      subject: 'Exchange Approved for Order {{order_id}}',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'order_id', 'courier', 'support_email', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Exchange Approved', `
        <span class="badge">Exchange Approved</span>
        <h2 class="title">Exchange Confirmed</h2>
        <p class="body-text">Dear {{customer_name}}, your exchange request for order <strong>#{{order_id}}</strong> has been approved. We will dispatch your replacement piece shortly.</p>
      `),
      plain_text: `Dear {{customer_name}},

Your exchange request for order #{{order_id}} is approved.

Replacement shipment details will follow.

{{company_name}}`
    },
    {
      template_id: 'account_created',
      event_id: 'account_created',
      name: 'Account Created',
      subject: 'Your Sa and Sha Account is Ready',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'support_email', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Account Created', `
        <span class="badge">Account Ready</span>
        <h2 class="title">Welcome {{first_name}}!</h2>
        <p class="body-text">Your customer account at {{company_name}} has been created. You can now track orders, save shipping addresses, and manage your wishlist.</p>
      `),
      plain_text: `Welcome {{first_name}},

Your account with {{company_name}} is ready!

Manage orders: https://saandsha.com`
    },
    {
      template_id: 'password_reset',
      event_id: 'password_reset',
      name: 'Password Reset',
      subject: 'Reset Your Sa and Sha Password',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'first_name', 'reset_link', 'support_email', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Password Reset', `
        <span class="badge">Security Notice</span>
        <h2 class="title">Reset Your Password</h2>
        <p class="body-text">Hi {{first_name}}, we received a request to reset your password. Click the button below to set a new password.</p>
        <div class="button-container">
          <a href="https://saandsha.com/reset-password" class="btn">Reset Password</a>
        </div>
        <p class="body-text" style="font-size: 13px; color: #8C8275;">If you did not request this, please ignore this email.</p>
      `),
      plain_text: `Hi {{first_name}},

Reset your password using the link below:
https://saandsha.com/reset-password

If you did not request this, ignore this message.`
    },
    {
      template_id: 'newsletter_welcome',
      event_id: 'newsletter_welcome',
      name: 'Newsletter Welcome',
      subject: 'Welcome to the Sa and Sha Journal',
      version: 1,
      status: 'published',
      published: true,
      published_at: now,
      created_at: now,
      updated_at: now,
      updated_by: 'system',
      variables: ['customer_name', 'coupon_code', 'discount', 'company_name', 'year', 'gst_number'],
      html: wrapSaAndShaEmailHtml('Subscriber Welcome', `
        <span class="badge">Subscribed</span>
        <h2 class="title">Thank you for subscribing!</h2>
        <p class="body-text">You are now subscribed to Sa and Sha updates, seasonal edit drops, and quiet luxury styling tips.</p>
      `),
      plain_text: `Thank you for subscribing to Sa and Sha!

Stay tuned for our latest edits and stories.`
    }
  ];
}

// Seed templates if collection is empty
export async function seedEmailTemplatesIfEmpty(): Promise<EmailTemplate[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection('email_templates').get();
  
  const existingMap: Record<string, EmailTemplate> = {};
  snapshot.forEach((doc) => {
    existingMap[doc.id] = { template_id: doc.id, ...doc.data() } as EmailTemplate;
  });

  const defaults = getDefaultTemplatesList();
  const batch = adminDb.batch();
  let seededCount = 0;

  for (const template of defaults) {
    if (!existingMap[template.template_id]) {
      seededCount++;
      const docRef = adminDb.collection('email_templates').doc(template.template_id);
      batch.set(docRef, template);

      // Create version 1 record
      const versionRef = adminDb.collection('email_template_versions').doc(`${template.template_id}_v1`);
      batch.set(versionRef, {
        template_id: template.template_id,
        version: 1,
        subject: template.subject,
        html: template.html,
        plain_text: template.plain_text,
        created_at: template.created_at,
        created_by: 'system'
      });

      existingMap[template.template_id] = template;
    }
  }

  if (seededCount > 0) {
    await batch.commit();
  }

  return Object.values(existingMap);
}

// Get single email template
export async function getEmailTemplate(templateId: string): Promise<EmailTemplate | null> {
  const adminDb = getAdminDb();
  const doc = await adminDb.collection('email_templates').doc(templateId).get();
  if (!doc.exists) return null;
  return { template_id: doc.id, ...doc.data() } as EmailTemplate;
}

// Save draft
export async function saveEmailTemplateDraft(
  templateId: string,
  payload: { subject?: string; html?: string; plain_text?: string; variables?: string[] },
  adminEmail: string
): Promise<EmailTemplate> {
  const validation = validateEmailTemplateInput({ templateId, subject: payload.subject, html: payload.html, plain_text: payload.plain_text });
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid draft input.');
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('email_templates').doc(templateId);
  const existingDoc = await docRef.get();

  const now = new Date().toISOString();
  let currentData = existingDoc.exists ? (existingDoc.data() as EmailTemplate) : null;

  const currentVersion = currentData ? currentData.version || 1 : 1;
  const sanitizedHtml = payload.html !== undefined ? sanitizeEmailHtml(payload.html) : (currentData?.html || '');

  const updatedData: Partial<EmailTemplate> = {
    template_id: templateId,
    event_id: templateId,
    name: currentData?.name || templateId.replace(/_/g, ' ').toUpperCase(),
    subject: payload.subject !== undefined ? payload.subject : (currentData?.subject || ''),
    html: sanitizedHtml,
    plain_text: payload.plain_text !== undefined ? payload.plain_text : (currentData?.plain_text || ''),
    status: 'draft', // saving changes marks status as draft
    published: currentData?.published ?? false,
    version: currentVersion,
    updated_at: now,
    updated_by: adminEmail || 'admin',
    variables: payload.variables || currentData?.variables || DEFAULT_EMAIL_VARIABLES.map(v => v.name)
  };

  await docRef.set(updatedData, { merge: true });

  const freshSnap = await docRef.get();
  return { template_id: freshSnap.id, ...freshSnap.data() } as EmailTemplate;
}

// Publish email template (atomic transaction, bumps version, creates immutable snapshot, optimistic locking)
export async function publishEmailTemplate(
  templateId: string,
  payload: { subject?: string; html?: string; plain_text?: string; variables?: string[]; expected_version?: number; base_version?: number },
  adminEmail: string
): Promise<{ template: EmailTemplate; versionDoc: EmailTemplateVersion }> {
  const validation = validateEmailTemplateInput({ templateId, subject: payload.subject, html: payload.html, plain_text: payload.plain_text });
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid publish input.');
  }

  const expectedVersion = payload.expected_version !== undefined ? payload.expected_version : payload.base_version;

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('email_templates').doc(templateId);

  return await adminDb.runTransaction(async (transaction) => {
    const existingDoc = await transaction.get(docRef);
    const now = new Date().toISOString();
    let currentData = existingDoc.exists ? (existingDoc.data() as EmailTemplate) : null;

    const currentVersion = currentData ? (currentData.version || 1) : 1;

    // Optimistic edit conflict detection
    if (expectedVersion !== undefined && currentData) {
      if (currentVersion !== expectedVersion) {
        throw new VersionConflictError(
          'Template was updated by another administrator. Reload before publishing.',
          currentVersion
        );
      }
    }

    const nextVersion = currentData ? currentVersion + 1 : 1;

    const rawSubject = payload.subject !== undefined ? payload.subject : (currentData?.subject || '');
    const rawHtml = payload.html !== undefined ? payload.html : (currentData?.html || '');
    const rawPlainText = payload.plain_text !== undefined ? payload.plain_text : (currentData?.plain_text || '');
    const finalVariables = payload.variables || currentData?.variables || DEFAULT_EMAIL_VARIABLES.map(v => v.name);

    const sanitizedHtml = sanitizeEmailHtml(rawHtml);

    const updatedTemplate: EmailTemplate = {
      template_id: templateId,
      event_id: templateId,
      name: currentData?.name || templateId.replace(/_/g, ' ').toUpperCase(),
      subject: rawSubject,
      html: sanitizedHtml,
      plain_text: rawPlainText,
      version: nextVersion,
      status: 'published',
      published: true,
      published_at: now,
      created_at: currentData?.created_at || now,
      updated_at: now,
      updated_by: adminEmail || 'admin',
      variables: finalVariables
    };

    const versionSnapshot: EmailTemplateVersion = {
      template_id: templateId,
      version: nextVersion,
      subject: rawSubject,
      html: sanitizedHtml,
      plain_text: rawPlainText,
      created_at: now,
      created_by: adminEmail || 'admin'
    };

    const versionRef = adminDb.collection('email_template_versions').doc(`${templateId}_v${nextVersion}`);

    transaction.set(docRef, updatedTemplate, { merge: true });
    // transaction.create ensures that if this version doc already exists, Firestore aborts atomically
    transaction.create(versionRef, versionSnapshot);

    return { template: updatedTemplate, versionDoc: versionSnapshot };
  });
}

// Get Version History
export async function getEmailTemplateVersionsList(templateId: string): Promise<EmailTemplateVersion[]> {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection('email_template_versions')
    .where('template_id', '==', templateId)
    .get();

  const versions: EmailTemplateVersion[] = [];
  snapshot.forEach((doc) => {
    versions.push({ id: doc.id, ...doc.data() } as EmailTemplateVersion);
  });

  // Sort descending by version number
  return versions.sort((a, b) => b.version - a.version);
}

// Restore previous version (atomic transaction, creates new version snapshot from historical content)
export async function restoreEmailTemplateVersion(
  templateId: string,
  targetVersion: number,
  adminEmail: string
): Promise<EmailTemplate> {
  const validation = validateEmailTemplateInput({ templateId });
  if (!validation.valid || typeof targetVersion !== 'number' || targetVersion < 1) {
    throw new Error('Invalid template ID or target version number for restore.');
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('email_templates').doc(templateId);
  const versionRef = adminDb.collection('email_template_versions').doc(`${templateId}_v${targetVersion}`);

  return await adminDb.runTransaction(async (transaction) => {
    const versionSnap = await transaction.get(versionRef);
    if (!versionSnap.exists) {
      throw new Error(`Version v${targetVersion} for template ${templateId} not found.`);
    }

    const vData = versionSnap.data() as EmailTemplateVersion;
    const existingDoc = await transaction.get(docRef);
    const now = new Date().toISOString();
    let currentData = existingDoc.exists ? (existingDoc.data() as EmailTemplate) : null;

    const nextVersion = currentData ? (currentData.version || 1) + 1 : 1;

    const sanitizedHtml = sanitizeEmailHtml(vData.html || '');

    const updatedTemplate: EmailTemplate = {
      template_id: templateId,
      event_id: templateId,
      name: currentData?.name || templateId.replace(/_/g, ' ').toUpperCase(),
      subject: vData.subject,
      html: sanitizedHtml,
      plain_text: vData.plain_text,
      version: nextVersion,
      status: 'published',
      published: true,
      published_at: now,
      created_at: currentData?.created_at || now,
      updated_at: now,
      updated_by: adminEmail || 'admin',
      variables: currentData?.variables || DEFAULT_EMAIL_VARIABLES.map(v => v.name)
    };

    const newVersionSnapshot: EmailTemplateVersion = {
      template_id: templateId,
      version: nextVersion,
      subject: vData.subject,
      html: sanitizedHtml,
      plain_text: vData.plain_text,
      created_at: now,
      created_by: adminEmail || 'admin'
    };

    const newVersionRef = adminDb.collection('email_template_versions').doc(`${templateId}_v${nextVersion}`);

    transaction.set(docRef, updatedTemplate, { merge: true });
    transaction.create(newVersionRef, newVersionSnapshot);

    return updatedTemplate;
  });
}

// Replace template variables
export function renderTemplateString(str: string, variables: Record<string, string>): string {
  if (!str) return '';
  let rendered = str;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, value ?? '');
  }
  return rendered;
}

// Send Test Email (uses sanitized HTML, explicit single test recipient, [TEST] subject prefix)
export async function sendTestEmailHelper(
  templateId: string,
  recipientEmail: string,
  customVariables?: Record<string, string>,
  adminEmail?: string
): Promise<{ success: boolean; message: string; renderedSubject: string; renderedHtml: string; delivered: boolean }> {
  const validation = validateEmailTemplateInput({ templateId, recipientEmail });
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid test email input.');
  }

  const template = await getEmailTemplate(templateId);
  if (!template) {
    throw new Error(`Email template '${templateId}' not found.`);
  }

  const mergedVars = {
    ...MOCK_TEST_VARIABLES,
    ...(customVariables || {})
  };

  const rawRenderedSubject = renderTemplateString(template.subject, mergedVars);
  const rawRenderedHtml = renderTemplateString(template.html, mergedVars);
  const renderedPlain = renderTemplateString(template.plain_text, mergedVars);

  const sanitizedRenderedHtml = sanitizeEmailHtml(rawRenderedHtml);
  const finalSubject = rawRenderedSubject.startsWith('[TEST]') ? rawRenderedSubject : `[TEST] ${rawRenderedSubject}`;

  const cleanRecipient = recipientEmail.trim();

  const sendRes = await sendMail({
    from: getDefaultFromAddress(),
    to: [cleanRecipient],
    subject: finalSubject,
    html: sanitizedRenderedHtml,
    text: renderedPlain
  });
  const delivered = sendRes.success;
  if (!delivered) {
    console.warn('[TEST EMAIL] SMTP send warning:', sendRes.error);
  }

  return {
    success: true,
    message: delivered
      ? `Test email sent successfully to ${cleanRecipient}.`
      : `Test email rendered successfully. (Preview mode generated - configure SMTP_HOST/USER/PASSWORD for live inbox delivery).`,
    renderedSubject: finalSubject,
    renderedHtml: sanitizedRenderedHtml,
    delivered
  };
}
