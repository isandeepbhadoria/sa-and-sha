import crypto from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Generates a cryptographically secure, URL-safe, non-sequential tracking token.
 * Contains 128+ bits of entropy and cannot be guessed or derived from PII or Order IDs.
 */
export function generateTrackingToken(): string {
  const bytes = crypto.randomBytes(16).toString('hex'); // 128 bits of entropy
  return `trk_${bytes}`;
}

/**
 * Validates if a string matches the secure tracking token format.
 */
export function isValidTrackingTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  return /^trk_[a-f0-9]{32}$/i.test(token.trim());
}

/**
 * Retrieves server-side TRACKING_OTP_SECRET or falls back safely in non-production.
 * Returns null if missing in production mode.
 */
export function getTrackingOtpSecret(): string | null {
  const envSecret = process.env.TRACKING_OTP_SECRET;
  if (envSecret && envSecret.trim()) {
    return envSecret.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return 'kl_dev_tracking_otp_secret_default';
}

/**
 * Hashes an OTP code deterministically using SHA-256 and server secret.
 * Raw OTP is never stored in Firestore.
 */
export function hashOtp(otp: string, trackingToken: string): string {
  const secret = getTrackingOtpSecret();
  if (!secret) {
    throw new Error('MISSING_TRACKING_OTP_SECRET');
  }
  return crypto.createHmac('sha256', secret).update(`${otp.trim()}:${trackingToken.trim()}`).digest('hex');
}

/**
 * Safely compares two hex hashes using constant-time comparison to protect against timing attacks.
 */
export function safeCompareHashes(hashA: string, hashB: string): boolean {
  if (!hashA || !hashB) return false;
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Hashes a raw verification session token for server-side storage in tracking_verification_sessions.
 */
export function hashSessionToken(rawToken: string): string {
  const secret = getTrackingOtpSecret();
  if (!secret) {
    throw new Error('MISSING_TRACKING_OTP_SECRET');
  }
  return crypto.createHmac('sha256', secret).update(rawToken.trim()).digest('hex');
}

/**
 * Validates external carrier URL domain to prevent SSRF or open redirect vulnerabilities.
 */
export function validateCarrierUrl(urlStr: string | null | undefined): string | null {
  if (!urlStr || typeof urlStr !== 'string') return null;
  const trimmed = urlStr.trim();
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const allowedDomains = [
      'bluedart.com',
      'www.bluedart.com',
      'delhivery.com',
      'www.delhivery.com',
      'clik.delhivery.com',
      'track.delhivery.com',
      'ecomexpress.in',
      'www.ecomexpress.in',
      'xpressbees.com',
      'www.xpressbees.com',
      'shadowfax.in',
      'www.shadowfax.in',
      'shiprocket.in',
      'www.shiprocket.in',
      'shiprocket.co',
      'dtdc.in',
      'www.dtdc.in',
      'fedex.com',
      'www.fedex.com',
      'dhl.com',
      'www.dhl.com',
      'dhl.co.in',
      'indiapost.gov.in',
      'www.indiapost.gov.in'
    ];

    const isAllowed = allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    return isAllowed ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Ensures an order document in Firestore has a valid tracking_token.
 * If missing, updates Firestore lazily and returns the token.
 */
export async function ensureOrderTrackingToken(adminDb: Firestore, orderData: any, docId?: string): Promise<string> {
  if (orderData.tracking_token && isValidTrackingTokenFormat(orderData.tracking_token)) {
    return orderData.tracking_token;
  }

  const newToken = generateTrackingToken();
  const targetDocId = docId || orderData.id || orderData.docId;

  if (targetDocId) {
    try {
      await adminDb.collection('orders').doc(targetDocId).update({
        tracking_token: newToken,
        updated_at: new Date().toISOString()
      });
      orderData.tracking_token = newToken;
    } catch (err: any) {
      console.warn(`[TRACKING HELPER] Failed to update tracking_token on order doc ${targetDocId}:`, err.message);
    }
  }

  return newToken;
}

/**
 * Mask string values for public display (e.g., PII protection)
 */
export function maskOrderNumber(orderId: string): string {
  if (!orderId) return 'KL-*****';
  if (orderId.length <= 6) return orderId;
  const prefix = orderId.slice(0, 4);
  const suffix = orderId.slice(-4);
  return `${prefix}***${suffix}`;
}

export function maskPincode(pincode: string): string {
  if (!pincode) return '***';
  const clean = pincode.replace(/\D/g, '');
  if (clean.length < 3) return '***';
  return `${clean.slice(0, 3)}***`;
}

export function maskPhone(phone: string): string {
  if (!phone) return '******';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '******';
  return `******${digits.slice(-4)}`;
}

export function maskAwb(awb: string): string {
  if (!awb || typeof awb !== 'string') return '****';
  const clean = awb.trim();
  if (clean.length <= 4) return '****';
  return `${clean.slice(0, 2)}***${clean.slice(-4)}`;
}

export function maskEmail(email: string): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '****@****.com';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Construct Provider-Neutral Shipment Model
 */
export interface ProviderNeutralShipment {
  provider: 'bluedart' | 'other' | null;
  awb_number: string | null;
  current_status: string | null;
  status_code: string | null;
  estimated_delivery: string | null;
  tracking_url: string | null;
  last_synced_at: string | null;
  events: Array<{
    code: string;
    label: string;
    location: string | null;
    occurred_at: string;
    description: string;
    source: string;
  }>;
}

export function buildProviderNeutralShipment(orderData: any): ProviderNeutralShipment {
  const courierName = (orderData.courier_name || '').toLowerCase();
  const isBlueDart = courierName.includes('bluedart') || courierName.includes('blue dart');
  const awb = orderData.tracking_number || orderData.awb || null;
  const rawStatus = (orderData.order_status || orderData.status || 'placed').toLowerCase();

  const validatedUrl = validateCarrierUrl(orderData.tracking_url);

  // Default events derived from order timeline
  const events = [];
  if (orderData.created_at) {
    events.push({
      code: 'ORDER_PLACED',
      label: 'Order Placed',
      location: orderData.city || 'Sa and Sha Warehouse',
      occurred_at: orderData.created_at,
      description: 'Your order was placed successfully.',
      source: 'system'
    });
  }

  if (['confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'].includes(rawStatus)) {
    events.push({
      code: 'ORDER_CONFIRMED',
      label: 'Order Confirmed',
      location: 'Sa and Sha Fulfillment Center',
      occurred_at: orderData.confirmed_at || orderData.created_at,
      description: 'Payment verified and order confirmed for fulfillment.',
      source: 'system'
    });
  }

  if (['packed', 'shipped', 'out_for_delivery', 'delivered'].includes(rawStatus)) {
    events.push({
      code: 'PACKED',
      label: 'Order Packed',
      location: 'Sa and Sha Warehouse',
      occurred_at: orderData.packed_at || new Date().toISOString(),
      description: 'Items inspected, carefully packaged, and ready for courier pickup.',
      source: 'warehouse'
    });
  }

  if (['shipped', 'out_for_delivery', 'delivered'].includes(rawStatus)) {
    events.push({
      code: 'SHIPPED',
      label: 'Handed to Courier',
      location: orderData.dispatch_location || 'Dispatch Hub',
      occurred_at: orderData.shipped_at || new Date().toISOString(),
      description: `Handed over to ${orderData.courier_name || 'Courier Partner'}${awb ? ` (AWB: ${awb})` : ''}.`,
      source: isBlueDart ? 'bluedart' : 'courier'
    });
  }

  if (['out_for_delivery', 'delivered'].includes(rawStatus)) {
    events.push({
      code: 'OUT_FOR_DELIVERY',
      label: 'Out for Delivery',
      location: orderData.city || 'Local Destination Hub',
      occurred_at: orderData.out_for_delivery_at || new Date().toISOString(),
      description: 'Courier executive is out for delivery to your address.',
      source: isBlueDart ? 'bluedart' : 'courier'
    });
  }

  if (rawStatus === 'delivered') {
    events.push({
      code: 'DELIVERED',
      label: 'Delivered',
      location: `${orderData.city || 'Destination'}, ${orderData.state || ''}`,
      occurred_at: orderData.delivered_at || new Date().toISOString(),
      description: 'Package delivered successfully.',
      source: isBlueDart ? 'bluedart' : 'courier'
    });
  }

  return {
    provider: isBlueDart ? 'bluedart' : orderData.courier_name ? 'other' : null,
    awb_number: awb,
    current_status: rawStatus,
    status_code: rawStatus.toUpperCase(),
    estimated_delivery: orderData.estimated_delivery || '5–7 business days',
    tracking_url: validatedUrl,
    last_synced_at: orderData.updated_at || new Date().toISOString(),
    events: orderData.shipment_events && Array.isArray(orderData.shipment_events) && orderData.shipment_events.length > 0
      ? orderData.shipment_events
      : events
  };
}

/**
 * Standard Status Timeline Steps Builder
 */
export interface TimelineStep {
  id: string;
  label: string;
  description: string;
  isCompleted: boolean;
  isCurrent: boolean;
  timestamp?: string | null;
}

export function buildOrderStatusTimeline(statusRaw: string, orderData: any): TimelineStep[] {
  const status = (statusRaw || 'placed').toLowerCase();

  const isCancelled = status === 'cancelled';
  const isFailed = status === 'delivery_failed';
  const isReturned = status === 'returned_to_origin';

  if (isCancelled) {
    return [
      { id: 'placed', label: 'Order Placed', description: 'Order was created', isCompleted: true, isCurrent: false, timestamp: orderData.created_at },
      { id: 'cancelled', label: 'Cancelled', description: 'Order was cancelled', isCompleted: true, isCurrent: true, timestamp: orderData.cancelled_at || orderData.updated_at }
    ];
  }

  if (isFailed) {
    return [
      { id: 'placed', label: 'Order Placed', description: 'Order was created', isCompleted: true, isCurrent: false, timestamp: orderData.created_at },
      { id: 'shipped', label: 'Shipped', description: 'Dispatched via courier', isCompleted: true, isCurrent: false, timestamp: orderData.shipped_at },
      { id: 'failed', label: 'Delivery Failed', description: 'Delivery attempt unsuccessful', isCompleted: true, isCurrent: true, timestamp: orderData.updated_at }
    ];
  }

  if (isReturned) {
    return [
      { id: 'placed', label: 'Order Placed', description: 'Order was created', isCompleted: true, isCurrent: false, timestamp: orderData.created_at },
      { id: 'shipped', label: 'Shipped', description: 'Dispatched via courier', isCompleted: true, isCurrent: false, timestamp: orderData.shipped_at },
      { id: 'returned', label: 'Returned to Origin', description: 'Package returned to warehouse', isCompleted: true, isCurrent: true, timestamp: orderData.updated_at }
    ];
  }

  const stepsOrder = ['placed', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
  const stepLabels: Record<string, { label: string; description: string; dateKey: string }> = {
    placed: { label: 'Order Placed', description: 'Order received and logged', dateKey: 'created_at' },
    confirmed: { label: 'Order Confirmed', description: 'Payment verified & order confirmed', dateKey: 'confirmed_at' },
    processing: { label: 'Processing', description: 'Preparing and quality-checking your items', dateKey: 'processing_at' },
    packed: { label: 'Packed', description: 'Quality checked & carefully packed', dateKey: 'packed_at' },
    shipped: { label: 'Shipped', description: 'Handed over to courier partner', dateKey: 'shipped_at' },
    out_for_delivery: { label: 'Out for Delivery', description: 'Courier executive out for delivery', dateKey: 'out_for_delivery_at' },
    delivered: { label: 'Delivered', description: 'Package delivered to address', dateKey: 'delivered_at' }
  };

  const currentIndex = stepsOrder.indexOf(status);
  const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;

  return stepsOrder.map((stepId, idx) => {
    const isCompleted = idx <= effectiveIndex;
    const isCurrent = idx === effectiveIndex;
    const info = stepLabels[stepId];
    return {
      id: stepId,
      label: info.label,
      description: info.description,
      isCompleted,
      isCurrent,
      timestamp: isCompleted ? (orderData[info.dateKey] || (idx === 0 ? orderData.created_at : null)) : null
    };
  });
}
