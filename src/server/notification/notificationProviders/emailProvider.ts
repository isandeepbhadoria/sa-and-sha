import {
  NotificationEventType,
  CustomerTarget,
  ProviderDispatchResult
} from '../types';
import { sendStatusUpdateEmail, sendOrderTransactionalEmails, generateCustomerConfirmationHTML, OrderData } from '../../email';
import { sendMail, isEmailConfigured, getDefaultFromAddress } from '../../mailer';

const FROM_ADDRESS = getDefaultFromAddress();
const REPLY_TO_ADDRESS = 'sales@sa-and-sha.com';

export interface EmailProvider {
  dispatch(
    event: NotificationEventType,
    customer: CustomerTarget,
    order?: OrderData,
    payload?: Record<string, any>
  ): Promise<ProviderDispatchResult>;
}

export class SmtpEmailProvider implements EmailProvider {
  async dispatch(
    event: NotificationEventType,
    customer: CustomerTarget,
    order?: OrderData,
    payload?: Record<string, any>
  ): Promise<ProviderDispatchResult> {
    const toEmail = customer.email || order?.customer_email;

    if (!toEmail) {
      return {
        success: false,
        provider: 'smtp',
        channel: 'email',
        error: 'No email address available for customer target.'
      };
    }

    // 1. Map order placement & status emails directly to sendOrderTransactionalEmails / sendStatusUpdateEmail
    if (order && order.order_id) {
      if (event === 'ORDER_PLACED' || event === 'PAYMENT_RECEIVED') {
        if (!isEmailConfigured()) {
          console.warn(`[EMAIL PROVIDER] SMTP not configured. Simulating order email dispatch for ${event} to ${toEmail}`);
          return {
            success: true,
            provider: 'smtp_mock',
            channel: 'email',
            providerMessageId: `mock_order_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            metadata: { simulated: true, event, orderId: order.order_id }
          };
        }
        const res = await sendOrderTransactionalEmails(order);
        return {
          success: res.customerSuccess || res.adminSuccess,
          provider: 'smtp',
          channel: 'email',
          providerMessageId: res.customerProviderId || res.adminProviderId,
          error: res.error,
          metadata: { customerSuccess: res.customerSuccess, adminSuccess: res.adminSuccess }
        };
      }

      let statusKey: string | null = null;
      if (event === 'ORDER_CONFIRMED') statusKey = 'processing';
      else if (event === 'ORDER_SHIPPED' || event === 'OUT_FOR_DELIVERY') statusKey = 'dispatched';
      else if (event === 'ORDER_DELIVERED') statusKey = 'delivered';
      else if (event === 'ORDER_CANCELLED') statusKey = 'cancelled';
      else if (event === 'REFUND_INITIATED') statusKey = 'refund_initiated';
      else if (event === 'REFUND_COMPLETED') statusKey = 'refund_completed';

      if (statusKey) {
        const res = await sendStatusUpdateEmail(order, statusKey);
        return {
          success: res.success,
          provider: 'smtp',
          channel: 'email',
          providerMessageId: res.providerId,
          error: res.error,
          metadata: { subject: res.subject, mappedStatusKey: statusKey }
        };
      }
    }

    // 2. Custom/General Email dispatch via SMTP
    if (!isEmailConfigured()) {
      console.warn(`[EMAIL PROVIDER] SMTP not configured. Simulating dispatch for ${event} to ${toEmail}`);
      return {
        success: true,
        provider: 'smtp_mock',
        channel: 'email',
        providerMessageId: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        metadata: { simulated: true, event }
      };
    }

    const { subject, html } = renderEmailContent(event, customer.name, order, payload);

    const res = await sendMail({
      from: FROM_ADDRESS,
      to: [toEmail],
      replyTo: REPLY_TO_ADDRESS,
      subject,
      html
    });

    if (!res.success) {
      return {
        success: false,
        provider: 'smtp',
        channel: 'email',
        error: res.error || 'SMTP send error'
      };
    }

    return {
      success: true,
      provider: 'smtp',
      channel: 'email',
      providerMessageId: res.providerId,
      metadata: { subject }
    };
  }
}

export const emailProvider = new SmtpEmailProvider();

export async function sendEmailNotification(options: {
  to: string;
  subject: string;
  order?: OrderData;
  targetStatus?: string;
  payload?: Record<string, any>;
  eventType?: NotificationEventType;
}): Promise<ProviderDispatchResult> {
  const event = options.eventType || (options.order ? 'ORDER_PLACED' : (options.targetStatus ? 'ORDER_CONFIRMED' : 'WELCOME'));
  return emailProvider.dispatch(
    event as NotificationEventType,
    { profileId: 'guest', name: 'Customer', email: options.to },
    options.order,
    options.payload
  );
}

function renderEmailContent(
  event: NotificationEventType,
  customerName: string,
  order?: OrderData,
  payload?: Record<string, any>
): { subject: string; html: string } {
  const name = customerName || 'Valued Guest';

  switch (event) {
    case 'ORDER_PLACED':
    case 'PAYMENT_RECEIVED':
      if (order) {
        return {
          subject: `Order Confirmed — ${order.order_id} | Sa and Sha`,
          html: generateCustomerConfirmationHTML(order)
        };
      }
      return {
        subject: `Order Confirmation | Sa and Sha`,
        html: buildSimpleEmailHTML(`Order Confirmation`, `Dear ${name},<br><br>Thank you for placing your order with Sa and Sha. Our team is processing it with care.`)
      };
    case 'WELCOME':
    case 'ACCOUNT_CREATED':
      return {
        subject: `Welcome to Sa and Sha™`,
        html: buildSimpleEmailHTML(`Welcome to Sa and Sha`, `Dear ${name},<br><br>Thank you for creating an account with Sa and Sha. Explore our latest collections of dresses, tops, and more.`)
      };
    case 'LOYALTY_POINTS_EARNED':
      return {
        subject: `You Earned ${payload?.pointsEarned || 0} Loyalty Points! | Sa and Sha`,
        html: buildSimpleEmailHTML(`Loyalty Points Earned`, `Dear ${name},<br><br>You earned <strong>${payload?.pointsEarned || 0}</strong> points on your recent activity! Your total available points balance is now <strong>${payload?.newBalance || 0}</strong>.`)
      };
    case 'LOYALTY_POINTS_RELEASED':
      return {
        subject: `Your ${payload?.pointsReleased || 0} Pending Points Are Now Available!`,
        html: buildSimpleEmailHTML(`Points Released`, `Dear ${name},<br><br>Great news! <strong>${payload?.pointsReleased || 0}</strong> pending loyalty points are now available in your account. Your updated balance is <strong>${payload?.availableBalance || 0}</strong>.`)
      };
    case 'TIER_UPGRADED':
      return {
        subject: `Congratulations! You've Upgraded to ${payload?.newTier || 'Gold'} Tier!`,
        html: buildSimpleEmailHTML(`Tier Upgrade Alert`, `Dear ${name},<br><br>Your exclusive Sa and Sha rewards status has been upgraded to <strong>${payload?.newTier}</strong>. Enjoy elevated perks and multiplier earnings on every order!`)
      };
    case 'STORE_CREDIT_ADDED':
      return {
        subject: `₹${payload?.amount || 0} Store Credit Added to Your Account`,
        html: buildSimpleEmailHTML(`Store Credit Issued`, `Dear ${name},<br><br>An amount of <strong>₹${(payload?.amount || 0).toLocaleString('en-IN')}</strong> store credit has been added to your Sa and Sha profile. Current balance: <strong>₹${(payload?.newBalance || 0).toLocaleString('en-IN')}</strong>.`)
      };
    case 'REVIEW_REQUEST':
      return {
        subject: `How was your experience with Sa and Sha?`,
        html: buildSimpleEmailHTML(`We'd Love Your Feedback`, `Dear ${name},<br><br>We hope you are enjoying your new pieces. Please share your feedback and review your recent purchase.`)
      };
    default:
      return {
        subject: `Update regarding your Sa and Sha account`,
        html: buildSimpleEmailHTML(`Sa and Sha Notice`, `Dear ${name},<br><br>You have a new update regarding your account or order (${order?.order_id || 'N/A'}).`)
      };
  }
}

function buildSimpleEmailHTML(heading: string, bodyText: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${heading}</title></head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: sans-serif; color: #2A211C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 24px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; border: 1px solid #EAE5DC; overflow: hidden;">
        <tr><td style="background-color: #2A211C; padding: 20px; text-align: center; color: #FBF6EE;">
          <h1 style="margin: 0; font-family: serif; font-size: 20px; letter-spacing: 3px;">SA AND SHA™</h1>
        </td></tr>
        <tr><td style="padding: 24px;">
          <h2 style="margin: 0 0 12px 0; color: #2A211C; font-size: 18px;">${heading}</h2>
          <p style="font-size: 14px; line-height: 1.6; color: #52473C;">${bodyText}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
