import { NotificationEventType } from './types';
import { generateTrackingToken, isValidTrackingTokenFormat } from '../trackingHelpers';

/**
 * Centralized Approved WhatsApp Template Registry
 * Never hardcode template names throughout the project.
 */
export const APPROVED_WHATSAPP_TEMPLATES = {
  ORDER_PLACED: 'kl_order_placed_v1',
  PAYMENT_RECEIVED: 'kl_payment_received_v1',
  ORDER_SHIPPED: 'kl_order_shipped_v1',
  ORDER_DELIVERED: 'kl_order_delivered_v1',
  REFUND_PROCESSED: 'kl_refund_processed_v1',
  REFUND_COMPLETED: 'kl_refund_processed_v1',
  LOYALTY_POINTS: 'kl_loyalty_points_v1',
  LOYALTY_POINTS_EARNED: 'kl_loyalty_points_v1'
} as const;

export interface WhatsAppTemplateConfig {
  templateName: string;
  language: string;
  variableKeys: string[];
}

export const WHATSAPP_TEMPLATE_MAPPINGS: Record<NotificationEventType, WhatsAppTemplateConfig> = {
  ORDER_PLACED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.ORDER_PLACED,
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'estimatedDelivery', 'trackingUrl']
  },
  PAYMENT_RECEIVED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.PAYMENT_RECEIVED,
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'amountPaid']
  },
  ORDER_CONFIRMED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.ORDER_PLACED,
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'estimatedDelivery', 'trackingUrl']
  },
  ORDER_PACKED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.ORDER_PLACED,
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'estimatedDelivery', 'trackingUrl']
  },
  ORDER_SHIPPED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.ORDER_SHIPPED,
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'courierName', 'trackingNumber', 'trackingUrl']
  },
  OUT_FOR_DELIVERY: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.ORDER_SHIPPED,
    language: 'en',
    variableKeys: ['customerName', 'orderId']
  },
  ORDER_DELIVERED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.ORDER_DELIVERED,
    language: 'en',
    variableKeys: ['customerName', 'orderId']
  },
  ORDER_CANCELLED: {
    templateName: 'kl_order_cancelled_v1',
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'refundNotice']
  },
  ORDER_RETURN_REQUESTED: {
    templateName: 'kl_return_requested_v1',
    language: 'en',
    variableKeys: ['customerName', 'orderId']
  },
  RETURN_APPROVED: {
    templateName: 'kl_return_approved_v1',
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'instructions']
  },
  RETURN_COMPLETED: {
    templateName: 'kl_return_completed_v1',
    language: 'en',
    variableKeys: ['customerName', 'orderId']
  },
  REFUND_INITIATED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.REFUND_PROCESSED,
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'refundAmount']
  },
  REFUND_COMPLETED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.REFUND_PROCESSED,
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'refundAmount', 'refundRef']
  },
  STORE_CREDIT_ADDED: {
    templateName: 'kl_store_credit_added_v1',
    language: 'en',
    variableKeys: ['customerName', 'amount', 'newBalance']
  },
  STORE_CREDIT_EXPIRED: {
    templateName: 'kl_store_credit_expired_v1',
    language: 'en',
    variableKeys: ['customerName', 'amount']
  },
  LOYALTY_POINTS_EARNED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS,
    language: 'en',
    variableKeys: ['customerName', 'pointsEarned', 'newBalance']
  },
  LOYALTY_POINTS_RELEASED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS,
    language: 'en',
    variableKeys: ['customerName', 'pointsReleased', 'availableBalance']
  },
  LOYALTY_POINTS_EXPIRING: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS,
    language: 'en',
    variableKeys: ['customerName', 'expiringPoints', 'expiryDate']
  },
  LOYALTY_POINTS_REDEEMED: {
    templateName: APPROVED_WHATSAPP_TEMPLATES.LOYALTY_POINTS,
    language: 'en',
    variableKeys: ['customerName', 'pointsRedeemed', 'remainingBalance']
  },
  TIER_UPGRADED: {
    templateName: 'kl_tier_upgraded_v1',
    language: 'en',
    variableKeys: ['customerName', 'newTier']
  },
  TIER_DOWNGRADED: {
    templateName: 'kl_tier_downgraded_v1',
    language: 'en',
    variableKeys: ['customerName', 'currentTier']
  },
  WELCOME: {
    templateName: 'kl_welcome_v1',
    language: 'en',
    variableKeys: ['customerName']
  },
  ACCOUNT_CREATED: {
    templateName: 'kl_account_created_v1',
    language: 'en',
    variableKeys: ['customerName']
  },
  ADDRESS_UPDATED: {
    templateName: 'kl_address_updated_v1',
    language: 'en',
    variableKeys: ['customerName']
  },
  PASSWORDLESS_LOGIN: {
    templateName: 'kl_login_link_v1',
    language: 'en',
    variableKeys: ['customerName', 'loginUrl']
  },
  OTP_VERIFIED: {
    templateName: 'kl_otp_verified_v1',
    language: 'en',
    variableKeys: ['customerName', 'otpCode']
  },
  REVIEW_REQUEST: {
    templateName: 'kl_review_request_v1',
    language: 'en',
    variableKeys: ['customerName', 'orderId', 'reviewUrl']
  },
  ABANDONED_CART: {
    templateName: 'kl_abandoned_cart_v1',
    language: 'en',
    variableKeys: ['customerName', 'cartUrl']
  },
  BACK_IN_STOCK: {
    templateName: 'kl_back_in_stock_v1',
    language: 'en',
    variableKeys: ['customerName', 'productName', 'productUrl']
  },
  PRICE_DROP: {
    templateName: 'kl_price_drop_v1',
    language: 'en',
    variableKeys: ['customerName', 'productName', 'newPrice', 'productUrl']
  },
  BIRTHDAY: {
    templateName: 'kl_birthday_wishes_v1',
    language: 'en',
    variableKeys: ['customerName', 'giftCode']
  },
  ANNIVERSARY: {
    templateName: 'kl_anniversary_wishes_v1',
    language: 'en',
    variableKeys: ['customerName', 'giftCode']
  },
  REFERRAL_REWARD: {
    templateName: 'kl_referral_reward_v1',
    language: 'en',
    variableKeys: ['customerName', 'rewardAmount']
  }
};

/**
  Extract variables for WhatsApp template body parameter rendering
*/
export const WHATSAPP_TEMPLATES: Record<string, {
  templateName: string;
  buildBodyValues: (data: { customerName: string; orderId?: string; grandTotal?: number; estimatedDelivery?: string; trackingUrl?: string; trackingToken?: string; courierName?: string; trackingNumber?: string }) => string[];
}> = new Proxy({} as any, {
  get: (_, event: string) => {
    const config = WHATSAPP_TEMPLATE_MAPPINGS[event as NotificationEventType];
    return {
      templateName: config?.templateName || 'wa_generic_v1',
      buildBodyValues: (data: { customerName: string; orderId?: string; grandTotal?: number; estimatedDelivery?: string; trackingUrl?: string; trackingToken?: string; courierName?: string; trackingNumber?: string }) => {
        return buildWhatsAppTemplateParams(
          event as NotificationEventType,
          data.customerName,
          {
            order_id: data.orderId,
            grand_total: data.grandTotal,
            estimated_delivery: data.estimatedDelivery,
            tracking_url: data.trackingUrl,
            tracking_token: data.trackingToken,
            courier_name: data.courierName,
            tracking_number: data.trackingNumber
          },
          data
        );
      }
    };
  }
});

export function buildWhatsAppTemplateParams(
  event: NotificationEventType,
  customerName: string,
  order?: any,
  payload?: Record<string, any>
): string[] {
  const config = WHATSAPP_TEMPLATE_MAPPINGS[event];
  if (!config) return [customerName];

  return config.variableKeys.map((key) => {
    if (key === 'customerName') return customerName || 'Valued Customer';
    if (key === 'orderId') return order?.order_id || payload?.orderId || 'N/A';
    if (key === 'estimatedDelivery') {
      const rawEst = order?.estimated_delivery || order?.estimatedDelivery || payload?.estimatedDelivery || payload?.estimated_delivery;
      if (rawEst && typeof rawEst === 'string' && rawEst.trim() !== '' && rawEst.trim().toUpperCase() !== 'N/A') {
        return rawEst.trim();
      }
      return '5–7 business days';
    }
    if (key === 'trackingUrl') {
      const rawTrackingUrl = order?.tracking_url || payload?.trackingUrl;
      if (rawTrackingUrl && typeof rawTrackingUrl === 'string' && (rawTrackingUrl.startsWith('http://') || rawTrackingUrl.startsWith('https://')) && !rawTrackingUrl.includes('/track-order')) {
        return rawTrackingUrl;
      }
      const baseUrl = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '');
      if (!baseUrl) {
        throw new Error('CONFIGURATION_ERROR: Neither PUBLIC_BASE_URL nor APP_BASE_URL is configured for trackingUrl.');
      }
      const token = order?.tracking_token || payload?.trackingToken;
      if (!token || typeof token !== 'string' || !isValidTrackingTokenFormat(token)) {
        throw new Error('MISSING_TRACKING_TOKEN: Valid tracking_token is required for notification dispatch but missing.');
      }
      return `${baseUrl}/track-order/${token}`;
    }
    if (key === 'grandTotal') return `₹${(order?.grand_total || payload?.grandTotal || 0).toLocaleString('en-IN')}`;
    if (key === 'amountPaid') return `₹${(order?.grand_total || payload?.amountPaid || 0).toLocaleString('en-IN')}`;
    if (key === 'courierName') return order?.courier_name || payload?.courierName || 'Our Logistics Partner';
    if (key === 'trackingNumber') return order?.tracking_number || payload?.trackingNumber || 'N/A';
    if (key === 'refundNotice') return payload?.refundNotice || 'Refund processed if applicable.';
    if (key === 'instructions') return payload?.instructions || 'Please keep items ready for pickup.';
    if (key === 'refundAmount') return `₹${(order?.refund_amount || payload?.refundAmount || 0).toLocaleString('en-IN')}`;
    if (key === 'refundRef') return order?.refund_reference || payload?.refundRef || 'N/A';
    if (key === 'amount') return `₹${(payload?.amount || 0).toLocaleString('en-IN')}`;
    if (key === 'newBalance') return `₹${(payload?.newBalance || 0).toLocaleString('en-IN')}`;
    if (key === 'pointsEarned') return `${payload?.pointsEarned || 0}`;
    if (key === 'pointsReleased') return `${payload?.pointsReleased || 0}`;
    if (key === 'availableBalance') return `${payload?.availableBalance || 0}`;
    if (key === 'expiringPoints') return `${payload?.expiringPoints || 0}`;
    if (key === 'expiryDate') return payload?.expiryDate || 'soon';
    if (key === 'pointsRedeemed') return `${payload?.pointsRedeemed || 0}`;
    if (key === 'remainingBalance') return `${payload?.remainingBalance || 0}`;
    if (key === 'newTier') return payload?.newTier || 'Member';
    if (key === 'currentTier') return payload?.currentTier || 'Member';
    if (key === 'loginUrl') return payload?.loginUrl || 'https://saandsha.com/login';
    if (key === 'otpCode') return payload?.otpCode || '';
    if (key === 'reviewUrl') return payload?.reviewUrl || 'https://saandsha.com/reviews';
    if (key === 'cartUrl') return payload?.cartUrl || 'https://saandsha.com/cart';
    if (key === 'productName') return payload?.productName || 'Linen Garment';
    if (key === 'productUrl') return payload?.productUrl || 'https://saandsha.com';
    if (key === 'newPrice') return `₹${(payload?.newPrice || 0).toLocaleString('en-IN')}`;
    if (key === 'giftCode') return payload?.giftCode || 'SPECIAL10';
    if (key === 'rewardAmount') return `₹${(payload?.rewardAmount || 0).toLocaleString('en-IN')}`;

    return payload?.[key] ? String(payload[key]) : '';
  });
}
