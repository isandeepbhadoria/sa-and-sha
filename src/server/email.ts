import fs from 'fs';
import path from 'path';
import { sendMail, isEmailConfigured, getDefaultFromAddress } from './mailer';

const FROM_ADDRESS = getDefaultFromAddress();
const REPLY_TO_ADDRESS = 'shop@sa-and-sha.com';
const ADMIN_NOTIFICATION_EMAIL = 'shop@sa-and-sha.com';

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color?: string;
  image?: string;
}

export interface OrderData {
  order_id: string;
  first_name?: string;
  last_name?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address: string;
  address_line_2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  country_code?: string;
  dial_code?: string;
  billing_address?: {
    first_name?: string;
    last_name?: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  } | null;
  billing_same_as_shipping?: boolean;
  gstin?: string | null;
  business_name?: string | null;
  gst_details?: any;
  whatsapp_updates?: boolean;
  email_marketing?: boolean;
  notes?: string;
  shipping_method?: string;
  payment_method?: string;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  grand_total: number;
  items: OrderItem[];
  payment_id?: string;
  tracking_token?: string;
  razorpay_order_id?: string;
  refund_amount?: number;
  refund_reference?: string;
  promo_code?: string | null;
  promo_discount_type?: string | null;
  promo_discount_value?: number | null;
  discount_amount?: number;
  status: string;
  created_at?: string;
  courier_name?: string;
  tracking_number?: string;
  tracking_url?: string;
  dispatch_date?: string;
  estimated_delivery_date?: string;
  emailStatus?: {
    confirmationSent?: boolean;
    confirmationSentAt?: string;
    adminNotified?: boolean;
    adminNotifiedAt?: string;
    confirmationError?: string;
    confirmationProviderId?: string;
    processingSent?: boolean;
    processingSentAt?: string;
    processingProviderId?: string;
    dispatchedSent?: boolean;
    dispatchedSentAt?: string;
    dispatchedProviderId?: string;
    deliveredSent?: boolean;
    deliveredSentAt?: string;
    deliveredProviderId?: string;
    cancellationSent?: boolean;
    cancellationSentAt?: string;
    cancellationProviderId?: string;
    refundInitiatedSent?: boolean;
    refundInitiatedSentAt?: string;
    refundInitiatedProviderId?: string;
    refundCompletedSent?: boolean;
    refundCompletedSentAt?: string;
    refundCompletedProviderId?: string;
    lastError?: string;
    lastAttemptAt?: string;
  };
}

// Generate Customer Order Confirmation HTML Email
export function generateCustomerConfirmationHTML(order: OrderData): string {
  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const isPaid = (order.status || '').toLowerCase() === 'paid';
  const isCod = (order.payment_method || '').toLowerCase() === 'cod';
  const paymentStatusText = isPaid ? 'Paid' : isCod ? 'Pending on Delivery (COD)' : 'Pending Verification';
  const paymentMethodText = isCod
    ? 'Cash on Delivery (COD)'
    : 'Razorpay Online Prepaid';
  const totalLabel = isPaid ? 'Total Paid' : 'Total Amount (Payable on Delivery)';

  const deliveryTimelineText =
    order.shipping_method === 'express'
      ? '2-3 Business Days'
      : order.shipping_method === 'international'
      ? '7-10 Business Days'
      : '3-5 Business Days';

  const itemsRows = (order.items || [])
    .map((item) => {
      const itemTotal = (item.price || 0) * (item.quantity || 1);
      const hasImg = item.image && item.image.trim().length > 0;
      const imgHtml = hasImg
        ? `<img src="${item.image}" alt="${item.name}" width="60" height="75" style="width: 60px; height: 75px; object-fit: cover; border-radius: 4px; border: 1px solid #E5E0D8; display: block;" />`
        : `<div style="width: 60px; height: 75px; background-color: #FBF6EE; border-radius: 4px; border: 1px solid #E5E0D8; display: flex; align-items: center; justify-center; text-align: center; color: #8C7A6B; font-size: 9px; font-weight: bold; letter-spacing: 1px; padding: 4px;">SA AND SHA</div>`;

      return `
        <tr style="border-bottom: 1px solid #EAE5DC;">
          <td style="padding: 12px 8px 12px 0; width: 70px; vertical-align: top;">
            ${imgHtml}
          </td>
          <td style="padding: 12px 8px; vertical-align: top;">
            <div style="font-size: 13px; font-weight: 600; color: #2A211C; margin-bottom: 4px;">${item.name}</div>
            <div style="font-size: 11px; color: #7A6C5D;">
              Size: <strong style="color: #2A211C;">${item.size}</strong> ${
        item.color ? `| Color: <strong style="color: #2A211C;">${item.color}</strong>` : ''
      }
            </div>
            <div style="font-size: 11px; color: #7A6C5D; margin-top: 2px;">
              Qty: ${item.quantity} × ₹${(item.price || 0).toLocaleString('en-IN')}
            </div>
          </td>
          <td style="padding: 12px 0 12px 8px; text-align: right; vertical-align: top; font-size: 13px; font-weight: 700; color: #2A211C; white-space: nowrap;">
            ₹${itemTotal.toLocaleString('en-IN')}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed — ${order.order_id}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2A211C; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #EAE5DC; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #2A211C; padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 26px; font-weight: 700; letter-spacing: 4px; color: #FBF6EE; text-transform: uppercase;">SA AND SHA™</h1>
              <div style="font-size: 9px; letter-spacing: 3px; color: #E5D2BC; text-transform: uppercase; margin-top: 6px; font-weight: 600;">LADIES APPAREL</div>
            </td>
          </tr>

          <!-- Main Greeting -->
          <tr>
            <td style="padding: 32px 28px 20px 28px;">
              <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #B08D57; text-transform: uppercase; margin-bottom: 8px;">Order Confirmed</div>
              <h2 style="margin: 0 0 12px 0; font-family: 'Times New Roman', Georgia, serif; font-size: 22px; color: #2A211C; font-weight: 600;">Thank you for your order, ${order.customer_name}.</h2>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #52473C;">
                We have received your payment and our team is preparing your order with meticulous care.
              </p>
            </td>
          </tr>

          <!-- Order Summary Badge Grid -->
          <tr>
            <td style="padding: 0 28px 24px 28px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; border-radius: 6px; border: 1px solid #EAE5DC; padding: 16px;">
                <tr>
                  <td width="50%" style="padding: 4px 8px; vertical-align: top;">
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8C7A6B; font-weight: 700;">Order Reference</div>
                    <div style="font-size: 14px; font-weight: 700; color: #2A211C; margin-top: 2px; font-family: monospace;">${order.order_id}</div>
                  </td>
                  <td width="50%" style="padding: 4px 8px; vertical-align: top;">
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8C7A6B; font-weight: 700;">Order Date</div>
                    <div style="font-size: 13px; font-weight: 600; color: #2A211C; margin-top: 2px;">${formattedDate}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding: 12px 8px 4px 8px; vertical-align: top;">
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8C7A6B; font-weight: 700;">Payment Status</div>
                    <div style="font-size: 13px; font-weight: 700; color: ${isPaid ? '#2E6B38' : '#B08D57'}; margin-top: 2px;">
                      ${paymentStatusText}
                    </div>
                  </td>
                  <td width="50%" style="padding: 12px 8px 4px 8px; vertical-align: top;">
                    <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8C7A6B; font-weight: 700;">Method</div>
                    <div style="font-size: 12px; font-weight: 600; color: #2A211C; margin-top: 2px;">${paymentMethodText}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Products Table Header -->
          <tr>
            <td style="padding: 0 28px;">
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #2A211C; padding-bottom: 8px; border-bottom: 2px solid #2A211C;">
                Purchased Items
              </div>
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                ${itemsRows}
              </table>
            </td>
          </tr>

          <!-- Financial Totals Breakdown -->
          <tr>
            <td style="padding: 20px 28px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #52473C;">
                <tr>
                  <td style="padding: 4px 0;">Subtotal</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #2A211C;">₹${(order.subtotal || 0).toLocaleString('en-IN')}</td>
                </tr>
                ${
                  order.discount > 0
                    ? `<tr>
                        <td style="padding: 4px 0; color: #2E6B38;">Discount Applied</td>
                        <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #2E6B38;">-₹${order.discount.toLocaleString('en-IN')}</td>
                      </tr>`
                    : ''
                }
                <tr>
                  <td style="padding: 4px 0;">Shipping Fee</td>
                  <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #2A211C;">
                    ${order.shipping_cost === 0 ? '<span style="color: #2E6B38; font-weight: 700;">FREE</span>' : `₹${order.shipping_cost}`}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0 0 0; font-size: 15px; font-weight: 700; color: #2A211C; border-top: 1px solid #2A211C;">${totalLabel}</td>
                  <td style="padding: 12px 0 0 0; text-align: right; font-size: 17px; font-weight: 800; color: #B08D57; border-top: 1px solid #2A211C;">
                    ₹${(order.grand_total || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping Details & Timeline -->
          <tr>
            <td style="padding: 0 28px 28px 28px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; border-radius: 6px; border: 1px solid #EAE5DC; padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #2A211C; margin-bottom: 8px;">
                      Shipping Destination
                    </div>
                    <div style="font-size: 13px; font-weight: 700; color: #2A211C; margin-bottom: 4px;">${order.customer_name}</div>
                    <div style="font-size: 13px; line-height: 1.5; color: #52473C;">
                      ${order.address}<br>
                      ${order.city}, ${order.state} - ${order.pincode}<br>
                      ${order.country || 'India'}
                    </div>
                    <div style="font-size: 12px; color: #52473C; margin-top: 8px;">
                      <strong>Contact Phone:</strong> ${order.customer_phone}
                    </div>
                    <div style="font-size: 12px; color: #52473C; margin-top: 4px;">
                      <strong>Estimated Delivery:</strong> ${deliveryTimelineText}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 28px 32px 28px; text-align: center;">
              <a href="https://sa-and-sha.com" target="_blank" style="display: inline-block; background-color: #2A211C; color: #FBF6EE; padding: 14px 32px; text-decoration: none; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">
                Visit Sa and Sha
              </a>
            </td>
          </tr>

          <!-- Support & Footer -->
          <tr>
            <td style="background-color: #FAF8F5; padding: 24px; text-align: center; border-top: 1px solid #EAE5DC;">
              <div style="font-size: 12px; color: #7A6C5D; line-height: 1.5;">
                Need assistance with your order? Reply directly to this email or write to us at 
                <a href="mailto:shop@sa-and-sha.com" style="color: #B08D57; text-decoration: none; font-weight: 600;">shop@sa-and-sha.com</a>.
              </div>
              <div style="font-size: 10px; color: #A39587; margin-top: 16px; letter-spacing: 1px; text-transform: uppercase;">
                © 2026 Sa and Sha. All Rights Reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Generate Internal New Order Alert HTML Email for shop@sa-and-sha.com
export function generateAdminNotificationHTML(order: OrderData): string {
  const itemsText = (order.items || [])
    .map(
      (it) =>
        `• ${it.name} | Size: ${it.size} | Color: ${it.color || 'Standard'} | Qty: ${it.quantity} | Price: ₹${(it.price * it.quantity).toLocaleString('en-IN')}`
    )
    .join('<br>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>New Paid Order Alert — ${order.order_id}</title>
</head>
<body style="margin: 0; padding: 16px; font-family: monospace, sans-serif; background-color: #2A211C; color: #FBF6EE;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #2A241E; border: 1px solid #E5D2BC; padding: 24px; border-radius: 6px;">
    <h2 style="margin-top: 0; color: #B08D57; font-size: 18px; border-bottom: 1px solid #E5D2BC; padding-bottom: 12px;">
      ⚡ NEW PAID ORDER SECURED — ${order.order_id}
    </h2>

    <table width="100%" border="0" cellspacing="0" cellpadding="6" style="font-size: 13px; color: #E8E2D8; border-collapse: collapse;">
      <tr>
        <td width="35%" style="color: #E5D2BC; font-weight: bold;">Order Reference:</td>
        <td style="font-weight: bold; font-size: 15px; color: #FFFFFF;">${order.order_id}</td>
      </tr>
      <tr>
        <td style="color: #E5D2BC; font-weight: bold;">Grand Total Paid:</td>
        <td style="font-weight: bold; font-size: 16px; color: #B08D57;">₹${(order.grand_total || 0).toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td style="color: #E5D2BC; font-weight: bold;">Payment Method:</td>
        <td>${order.payment_method || 'Razorpay Prepaid'} (${order.status})</td>
      </tr>
      <tr>
        <td style="color: #E5D2BC; font-weight: bold;">Razorpay Payment ID:</td>
        <td>${order.payment_id || 'N/A'}</td>
      </tr>
      <tr>
        <td style="color: #E5D2BC; font-weight: bold;">Razorpay Order ID:</td>
        <td>${order.razorpay_order_id || 'N/A'}</td>
      </tr>
      <tr>
        <td style="color: #E5D2BC; font-weight: bold;">Timestamp:</td>
        <td>${order.created_at || new Date().toISOString()}</td>
      </tr>
    </table>

    <hr style="border: 0; border-top: 1px solid #42382E; margin: 16px 0;">

    <h3 style="color: #E5D2BC; font-size: 14px; margin-bottom: 8px;">CUSTOMER & SHIPPING DETAILS</h3>
    <div style="font-size: 13px; line-height: 1.6; background-color: #2A211C; padding: 12px; border-radius: 4px; border: 1px solid #42382E;">
      <strong>Name:</strong> ${order.customer_name}<br>
      <strong>Email:</strong> ${order.customer_email}<br>
      <strong>Phone:</strong> ${order.customer_phone}<br>
      <strong>Address:</strong> ${order.address}, ${order.city}, ${order.state} - ${order.pincode} (${order.country || 'India'})<br>
      <strong>Order Note:</strong> ${order.notes || 'None'}
    </div>

    <hr style="border: 0; border-top: 1px solid #42382E; margin: 16px 0;">

    <h3 style="color: #E5D2BC; font-size: 14px; margin-bottom: 8px;">ORDER ITEMS</h3>
    <div style="font-size: 12px; line-height: 1.8; background-color: #2A211C; padding: 12px; border-radius: 4px; border: 1px solid #42382E;">
      ${itemsText}
    </div>

    <div style="margin-top: 20px; padding: 12px; background-color: #B08D57; color: #FFFFFF; font-weight: bold; font-size: 12px; text-align: center; border-radius: 4px;">
      ACTION REQUIRED: Please check https://sa-and-sha.com/admin to prepare shipment and generate courier AWB.
    </div>
  </div>
</body>
</html>`;
}

// Main Transactional Dispatch Function
export async function sendOrderTransactionalEmails(order: OrderData): Promise<{
  customerSuccess: boolean;
  adminSuccess: boolean;
  customerProviderId?: string;
  adminProviderId?: string;
  error?: string;
}> {
  console.log(`[EMAIL] SMTP configured: ${isEmailConfigured()}`);

  if (!isEmailConfigured()) {
    console.warn(`[EMAIL] SMTP unconfigured for Order #${order.order_id}. Skipping email dispatch.`);
    return {
      customerSuccess: false,
      adminSuccess: false,
      error: 'SMTP is not configured on the server environment.',
    };
  }

  let customerSuccess = false;
  let adminSuccess = false;
  let customerProviderId: string | undefined = undefined;
  let adminProviderId: string | undefined = undefined;
  let customerError = '';
  let adminError = '';

  // 1. Send Customer Confirmation Email
  try {
    console.log(`[EMAIL] sending customer confirmation for order #${order.order_id}...`);
    const customerHtml = generateCustomerConfirmationHTML(order);
    const customerSubject = `Order Confirmed — ${order.order_id} | Sa and Sha`;

    const customerRes = await sendMail({
      from: FROM_ADDRESS,
      to: [order.customer_email],
      replyTo: REPLY_TO_ADDRESS,
      subject: customerSubject,
      html: customerHtml,
    });

    if (!customerRes.success) {
      customerError = customerRes.error || 'SMTP customer email error';
      console.warn(`[EMAIL] customer confirmation failed for ${order.order_id}: ${customerError}`);
    } else {
      customerSuccess = true;
      customerProviderId = customerRes.providerId;
      console.log(`[EMAIL] customer confirmation accepted by provider for ${order.order_id} (ID: ${customerProviderId})`);
    }
  } catch (err: any) {
    customerError = err?.message || 'Error sending customer email';
    console.warn(`[EMAIL] customer confirmation failed for ${order.order_id}: ${customerError}`);
  }

  // 2. Send Internal New Order Email to Admin
  try {
    console.log(`[EMAIL] sending admin notification for order #${order.order_id}...`);
    const adminHtml = generateAdminNotificationHTML(order);
    const adminSubject = `New Paid Order — ${order.order_id} — ₹${(order.grand_total || 0).toLocaleString('en-IN')}`;

    const adminRes = await sendMail({
      from: FROM_ADDRESS,
      to: [ADMIN_NOTIFICATION_EMAIL],
      replyTo: REPLY_TO_ADDRESS,
      subject: adminSubject,
      html: adminHtml,
    });

    if (!adminRes.success) {
      adminError = adminRes.error || 'SMTP admin email error';
      console.warn(`[EMAIL] admin notification failed for ${order.order_id}: ${adminError}`);
    } else {
      adminSuccess = true;
      adminProviderId = adminRes.providerId;
      console.log(`[EMAIL] admin notification accepted by provider for ${order.order_id} (ID: ${adminProviderId})`);
    }
  } catch (err: any) {
    adminError = err?.message || 'Error sending admin email';
    console.warn(`[EMAIL] admin notification failed for ${order.order_id}: ${adminError}`);
  }

  return {
    customerSuccess,
    adminSuccess,
    customerProviderId,
    adminProviderId,
    error: customerError || adminError ? `Customer err: ${customerError}; Admin err: ${adminError}` : undefined,
  };
}

// Common Item Table Renderer for Status Emails
function renderItemsRows(items: OrderItem[]): string {
  return (items || []).map((item) => {
    const itemTotal = (item.price || 0) * (item.quantity || 1);
    const hasImg = item.image && item.image.trim().length > 0;
    const imgHtml = hasImg
      ? `<img src="${item.image}" alt="${item.name}" width="50" height="65" style="width: 50px; height: 65px; object-fit: cover; border-radius: 4px; border: 1px solid #E5E0D8; display: block;" />`
      : `<div style="width: 50px; height: 65px; background-color: #FBF6EE; border-radius: 4px; border: 1px solid #E5E0D8; text-align: center; color: #8C7A6B; font-size: 8px; font-weight: bold; padding-top: 20px;">KORA</div>`;

    return `
      <tr style="border-bottom: 1px solid #EAE5DC;">
        <td style="padding: 10px 8px 10px 0; width: 60px; vertical-align: top;">${imgHtml}</td>
        <td style="padding: 10px 8px; vertical-align: top;">
          <div style="font-size: 13px; font-weight: 600; color: #2A211C;">${item.name}</div>
          <div style="font-size: 11px; color: #7A6C5D; margin-top: 2px;">Size: <strong>${item.size}</strong> | Qty: <strong>${item.quantity}</strong></div>
        </td>
        <td style="padding: 10px 0 10px 8px; text-align: right; vertical-align: top; font-size: 13px; font-weight: 700; color: #2A211C; white-space: nowrap;">
          ₹${itemTotal.toLocaleString('en-IN')}
        </td>
      </tr>
    `;
  }).join('');
}

// 1. Processing Email Template
export function generateProcessingEmailHTML(order: OrderData): string {
  const isCod = (order.payment_method || '').toLowerCase() === 'cod';
  const paymentWording = isCod ? 'Cash on Delivery (Payable on Delivery)' : 'Razorpay Prepaid (Paid)';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Preparing Your Order</title></head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2A211C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 24px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #EAE5DC;">
        <tr><td style="background-color: #2A211C; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #FBF6EE; text-transform: uppercase;">SA AND SHA™</h1>
          <div style="font-size: 9px; letter-spacing: 2px; color: #E5D2BC; text-transform: uppercase; margin-top: 4px;">LADIES APPAREL</div>
        </td></tr>
        <tr><td style="padding: 28px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #B08D57; text-transform: uppercase; margin-bottom: 8px;">Order Processing</div>
          <h2 style="margin: 0 0 12px 0; font-family: 'Times New Roman', Georgia, serif; font-size: 20px; color: #2A211C;">We’re Preparing Your Order — ${order.order_id}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #52473C;">
            Dear ${order.customer_name},<br><br>
            Your order is now being processed! Our team is carefully inspecting and packaging your order with meticulous attention to detail.
          </p>
          <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #52473C;">
              <tr><td style="padding: 4px 0; font-weight: 600;">Order Reference:</td><td style="text-align: right; font-family: monospace; font-weight: 700; color: #2A211C;">${order.order_id}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Payment Method:</td><td style="text-align: right; font-weight: 600; color: #2A211C;">${paymentWording}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Grand Total:</td><td style="text-align: right; font-weight: 700; color: #2A211C;">₹${(order.grand_total || 0).toLocaleString('en-IN')}</td></tr>
            </table>
          </div>
          <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #2A211C; margin-bottom: 8px; border-bottom: 2px solid #2A211C; padding-bottom: 4px;">Items Being Prepared</div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
            ${renderItemsRows(order.items)}
          </table>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #52473C;">
            You will receive a dispatch notification with your tracking details as soon as your parcel is handed over to our courier partner.<br><br>
            For any queries, reach us at <a href="mailto:shop@sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">shop@sa-and-sha.com</a> or visit <a href="https://sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">sa-and-sha.com</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// 2. Dispatched / Shipped Email Template
export function generateDispatchedEmailHTML(order: OrderData): string {
  const courier = order.courier_name || 'Courier / Delivery Partner';
  const awb = order.tracking_number || 'N/A';
  const trackUrl = order.tracking_url || 'https://sa-and-sha.com/track-order';
  const dispatchDate = order.dispatch_date || new Date().toLocaleDateString('en-IN');
  const estDelivery = order.estimated_delivery_date || '3-5 Business Days';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Dispatched</title></head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2A211C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 24px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #EAE5DC;">
        <tr><td style="background-color: #2A211C; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #FBF6EE; text-transform: uppercase;">SA AND SHA™</h1>
          <div style="font-size: 9px; letter-spacing: 2px; color: #E5D2BC; text-transform: uppercase; margin-top: 4px;">LADIES APPAREL</div>
        </td></tr>
        <tr><td style="padding: 28px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #2E6B38; text-transform: uppercase; margin-bottom: 8px;">Order Dispatched</div>
          <h2 style="margin: 0 0 12px 0; font-family: 'Times New Roman', Georgia, serif; font-size: 20px; color: #2A211C;">Your Order Has Shipped — ${order.order_id}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #52473C;">
            Dear ${order.customer_name},<br><br>
            Great news! Your Sa and Sha order has been carefully pressed, sealed, and handed over to our courier partner. It is now on its way to you.
          </p>
          <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #52473C;">
              <tr><td style="padding: 4px 0; font-weight: 600;">Courier Partner:</td><td style="text-align: right; font-weight: 700; color: #2A211C;">${courier}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">AWB / Tracking No:</td><td style="text-align: right; font-family: monospace; font-weight: 700; color: #2A211C;">${awb}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Dispatch Date:</td><td style="text-align: right; font-weight: 600; color: #2A211C;">${dispatchDate}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Estimated Delivery:</td><td style="text-align: right; font-weight: 700; color: #2E6B38;">${estDelivery}</td></tr>
            </table>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${trackUrl}" target="_blank" style="display: inline-block; background-color: #2A211C; color: #FBF6EE; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: 2px; padding: 14px 28px; border-radius: 4px; text-transform: uppercase;">TRACK YOUR ORDER</a>
          </div>
          <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #2A211C; margin-bottom: 8px; border-bottom: 2px solid #2A211C; padding-bottom: 4px;">Items in Shipment</div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            ${renderItemsRows(order.items)}
          </table>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #52473C;">
            If you need assistance with your delivery, contact us at <a href="mailto:shop@sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">shop@sa-and-sha.com</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// 3. Delivered Email Template
export function generateDeliveredEmailHTML(order: OrderData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Delivered</title></head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2A211C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 24px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #EAE5DC;">
        <tr><td style="background-color: #2A211C; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #FBF6EE; text-transform: uppercase;">SA AND SHA™</h1>
          <div style="font-size: 9px; letter-spacing: 2px; color: #E5D2BC; text-transform: uppercase; margin-top: 4px;">LADIES APPAREL</div>
        </td></tr>
        <tr><td style="padding: 28px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #2E6B38; text-transform: uppercase; margin-bottom: 8px;">Order Delivered</div>
          <h2 style="margin: 0 0 12px 0; font-family: 'Times New Roman', Georgia, serif; font-size: 20px; color: #2A211C;">Your Order Has Been Delivered — ${order.order_id}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #52473C;">
            Dear ${order.customer_name},<br><br>
            Your order <strong>${order.order_id}</strong> has been successfully delivered! We hope you love your new pieces as much as we loved putting them together for you.
          </p>
          <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #2A211C; margin-bottom: 8px; border-bottom: 2px solid #2A211C; padding-bottom: 4px;">Summary of Delivered Items</div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            ${renderItemsRows(order.items)}
          </table>
          <p style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #52473C;">
            Thank you for choosing Sa and Sha. For care instructions or support, reach out to us at <a href="mailto:shop@sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">shop@sa-and-sha.com</a> or visit <a href="https://sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">sa-and-sha.com</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// 4. Cancellation Email Template
export function generateCancellationEmailHTML(order: OrderData): string {
  const isCod = (order.payment_method || '').toLowerCase() === 'cod';
  const refundNote = isCod 
    ? 'No payment was collected for this Cash on Delivery order.' 
    : 'If you were charged, a full refund has been requested and will process to your original payment method.';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Cancelled</title></head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2A211C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 24px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #EAE5DC;">
        <tr><td style="background-color: #2A211C; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #FBF6EE; text-transform: uppercase;">SA AND SHA™</h1>
          <div style="font-size: 9px; letter-spacing: 2px; color: #E5D2BC; text-transform: uppercase; margin-top: 4px;">LADIES APPAREL</div>
        </td></tr>
        <tr><td style="padding: 28px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #B08D57; text-transform: uppercase; margin-bottom: 8px;">Order Notice</div>
          <h2 style="margin: 0 0 12px 0; font-family: 'Times New Roman', Georgia, serif; font-size: 20px; color: #2A211C;">Order Cancelled — ${order.order_id}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #52473C;">
            Dear ${order.customer_name},<br><br>
            Your order reference <strong>${order.order_id}</strong> has been cancelled.<br>${refundNote}
          </p>
          <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #52473C;">
              <tr><td style="padding: 4px 0; font-weight: 600;">Order Reference:</td><td style="text-align: right; font-family: monospace; font-weight: 700; color: #2A211C;">${order.order_id}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Cancellation Date:</td><td style="text-align: right; font-weight: 600; color: #2A211C;">${new Date().toLocaleDateString('en-IN')}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Payment Method:</td><td style="text-align: right; font-weight: 600; color: #2A211C;">${order.payment_method || 'Razorpay'}</td></tr>
            </table>
          </div>
          <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #2A211C; margin-bottom: 8px; border-bottom: 2px solid #2A211C; padding-bottom: 4px;">Cancelled Items</div>
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
            ${renderItemsRows(order.items)}
          </table>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #52473C;">
            If you have questions regarding this cancellation, contact customer care at <a href="mailto:shop@sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">shop@sa-and-sha.com</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// 5. Refund Initiated Email Template
export function generateRefundInitiatedEmailHTML(order: OrderData): string {
  const refundAmount = order.refund_amount || order.grand_total || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Refund Initiated</title></head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2A211C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 24px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #EAE5DC;">
        <tr><td style="background-color: #2A211C; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #FBF6EE; text-transform: uppercase;">SA AND SHA™</h1>
          <div style="font-size: 9px; letter-spacing: 2px; color: #E5D2BC; text-transform: uppercase; margin-top: 4px;">LADIES APPAREL</div>
        </td></tr>
        <tr><td style="padding: 28px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #B08D57; text-transform: uppercase; margin-bottom: 8px;">Refund Update</div>
          <h2 style="margin: 0 0 12px 0; font-family: 'Times New Roman', Georgia, serif; font-size: 20px; color: #2A211C;">Refund Initiated — ${order.order_id}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #52473C;">
            Dear ${order.customer_name},<br><br>
            Your refund request for order <strong>${order.order_id}</strong> in the amount of <strong>₹${refundAmount.toLocaleString('en-IN')}</strong> has been initiated.
          </p>
          <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #52473C;">
              <tr><td style="padding: 4px 0; font-weight: 600;">Refund Amount:</td><td style="text-align: right; font-weight: 700; color: #2A211C;">₹${refundAmount.toLocaleString('en-IN')}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Initiated Date:</td><td style="text-align: right; font-weight: 600; color: #2A211C;">${new Date().toLocaleDateString('en-IN')}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Note:</td><td style="text-align: right; font-weight: 600; color: #2E6B38;">Refund posting time may vary depending on your bank or payment provider.</td></tr>
            </table>
          </div>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #52473C;">
            If you need further details, please contact our support desk at <a href="mailto:shop@sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">shop@sa-and-sha.com</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// 6. Refund Completed Email Template
export function generateRefundCompletedEmailHTML(order: OrderData): string {
  const refundAmount = order.refund_amount || order.grand_total || 0;
  const refundRef = order.refund_reference || 'N/A';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Refund Completed</title></head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #2A211C;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #FAF8F5; padding: 24px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #EAE5DC;">
        <tr><td style="background-color: #2A211C; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-family: 'Times New Roman', Georgia, serif; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #FBF6EE; text-transform: uppercase;">SA AND SHA™</h1>
          <div style="font-size: 9px; letter-spacing: 2px; color: #E5D2BC; text-transform: uppercase; margin-top: 4px;">LADIES APPAREL</div>
        </td></tr>
        <tr><td style="padding: 28px;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #2E6B38; text-transform: uppercase; margin-bottom: 8px;">Refund Completed</div>
          <h2 style="margin: 0 0 12px 0; font-family: 'Times New Roman', Georgia, serif; font-size: 20px; color: #2A211C;">Refund Completed — ${order.order_id}</h2>
          <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #52473C;">
            Dear ${order.customer_name},<br><br>
            Your refund of <strong>₹${refundAmount.toLocaleString('en-IN')}</strong> for order <strong>${order.order_id}</strong> has been recorded as completed.
          </p>
          <div style="background-color: #FAF8F5; border: 1px solid #EAE5DC; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #52473C;">
              <tr><td style="padding: 4px 0; font-weight: 600;">Refund Amount:</td><td style="text-align: right; font-weight: 700; color: #2A211C;">₹${refundAmount.toLocaleString('en-IN')}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Refund Reference:</td><td style="text-align: right; font-weight: 700; color: #2A211C; font-family: monospace;">${refundRef}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Completion Date:</td><td style="text-align: right; font-weight: 600; color: #2A211C;">${new Date().toLocaleDateString('en-IN')}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600;">Status:</td><td style="text-align: right; font-weight: 700; color: #2E6B38;">Credited to Original Method</td></tr>
            </table>
          </div>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #52473C;">
            Thank you for your patience. For any further assistance, reach out to us at <a href="mailto:shop@sa-and-sha.com" style="color: #B08D57; text-decoration: underline;">shop@sa-and-sha.com</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Main Status Update Email Dispatcher
export async function sendStatusUpdateEmail(
  order: OrderData,
  targetStatus: string
): Promise<{
  success: boolean;
  providerId?: string;
  subject?: string;
  error?: string;
}> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      error: 'SMTP is not configured on the server.',
    };
  }

  let subject = '';
  let html = '';
  const ref = order.order_id;

  switch (targetStatus) {
    case 'processing':
      subject = `We’re Preparing Your Order — ${ref} | Sa and Sha`;
      html = generateProcessingEmailHTML(order);
      break;
    case 'dispatched':
      subject = `Your Sa and Sha Order Has Shipped — ${ref}`;
      html = generateDispatchedEmailHTML(order);
      break;
    case 'delivered':
      subject = `Your Order Has Been Delivered — ${ref} | Sa and Sha`;
      html = generateDeliveredEmailHTML(order);
      break;
    case 'cancelled':
      subject = `Order Cancelled — ${ref} | Sa and Sha`;
      html = generateCancellationEmailHTML(order);
      break;
    case 'refund_initiated':
      subject = `Refund Initiated — ${ref} | Sa and Sha`;
      html = generateRefundInitiatedEmailHTML(order);
      break;
    case 'refund_completed':
      subject = `Refund Completed — ${ref} | Sa and Sha`;
      html = generateRefundCompletedEmailHTML(order);
      break;
    default:
      return { success: false, error: `No email template defined for status '${targetStatus}'` };
  }

  const res = await sendMail({
    from: FROM_ADDRESS,
    to: [order.customer_email],
    replyTo: REPLY_TO_ADDRESS,
    subject,
    html,
  });

  if (!res.success) {
    return { success: false, error: res.error || 'SMTP provider error', subject };
  }
  return { success: true, providerId: res.providerId, subject };
}

