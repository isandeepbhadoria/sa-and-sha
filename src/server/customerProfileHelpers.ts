import crypto from "crypto";

export interface CustomerAddress {
  id: string;
  label: "Home" | "Work" | "Other" | string;
  custom_label?: string;
  recipient_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  landmark?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommerceSummary {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  returned_orders: number;
  lifetime_spend: number;
  average_order_value: number;
  first_order_at?: string;
  last_order_at?: string;
}

export interface MarketingPreferences {
  email_marketing_consent: boolean;
  sms_marketing_consent: boolean;
  whatsapp_marketing_consent: boolean;
  voice_call_consent: boolean;
  consent_updated_at?: string;
  consent_source?: string;
}

export interface AdminMetadata {
  tags: string[];
  internal_notes?: string;
  customer_tier?: "standard" | "bronze" | "silver" | "gold" | "platinum" | "vip";
}

export interface CustomerProfileDoc {
  id: string;
  customer_id?: string;
  customer_type?: "BUSINESS" | "INDIVIDUAL";
  normalized_phone: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  email: string;
  country?: string;
  country_code?: string;
  dial_code?: string;
  addresses: CustomerAddress[];
  default_address?: Partial<CustomerAddress>;
  shipping_address?: CustomerAddress;
  billing_address?: Partial<CustomerAddress> & {
    first_name?: string;
    last_name?: string;
    company_name?: string;
    gstin?: string;
    is_same_as_shipping?: boolean;
    phone?: string;
  };
  billing_same_as_shipping?: boolean;
  gstin?: string;
  business_name?: string;
  gst_details?: {
    gstin?: string;
    legal_name?: string;
    trade_name?: string;
    taxpayer_type?: string;
    business_constitution?: string;
    status?: string;
    registration_date?: string;
    address?: string;
    pincode?: string;
    state_code?: string;
    verified_at?: string;
  };
  gst_verified?: boolean;
  gst_verified_at?: string;
  gst_provider?: string;
  marketing_consent?: boolean;
  whatsapp_updates?: boolean;
  email_marketing?: boolean;
  commerce_summary?: CommerceSummary;
  marketing_preferences?: MarketingPreferences;
  admin_metadata?: AdminMetadata;
  health_status?: string;
  manual_tags?: string[];
  suggested_tags?: string[];
  dismissed_suggested_tags?: string[];
  vip_candidate?: boolean;
  vip_reason?: string;
  created_at: string;
  updated_at: string;
  last_order_at?: string;
}

/**
 * Sanitize string against HTML/script injection
 */
export function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefined(item)) as unknown as T;
  }

  const constructorName = obj.constructor?.name;
  if (
    constructorName &&
    constructorName !== "Object" &&
    constructorName !== "Array"
  ) {
    return obj;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = removeUndefined(value);
    }
  }
  return result as T;
}

export function sanitizeString(val: any, maxLength = 250): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Strip unsafe control chars
    .trim()
    .substring(0, maxLength);
}

/**
 * Formula injection protection for CSV/XLSX
 */
export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).trim();
  if (str.startsWith("=") || str.startsWith("+") || str.startsWith("-") || str.startsWith("@")) {
    str = "'" + str;
  }
  // Escape double quotes
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Lazy Migration Helper: Converts legacy `default_address` into `addresses` array if missing
 */
export function migrateAndNormalizeProfile(docData: any, docId = ""): CustomerProfileDoc {
  const now = new Date().toISOString();
  const rawAddresses = Array.isArray(docData?.addresses) ? docData.addresses : [];
  let addresses: CustomerAddress[] = [];

  if (rawAddresses.length > 0) {
    addresses = rawAddresses.map((addr: any, idx: number) => ({
      id: addr.id || `addr_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
      label: sanitizeString(addr.label || "Home", 30),
      custom_label: sanitizeString(addr.custom_label || "", 50) || undefined,
      recipient_name: sanitizeString(addr.recipient_name || docData.full_name || "Valued Customer", 100),
      phone: sanitizeString(addr.phone || docData.normalized_phone || "", 20),
      address_line_1: sanitizeString(addr.address_line_1 || "", 250),
      address_line_2: sanitizeString(addr.address_line_2 || "", 250),
      landmark: sanitizeString(addr.landmark || "", 150),
      city: sanitizeString(addr.city || "", 100),
      state: sanitizeString(addr.state || "", 100),
      postal_code: sanitizeString(addr.postal_code || "", 10),
      country: sanitizeString(addr.country || "India", 50),
      is_default: Boolean(addr.is_default),
      created_at: addr.created_at || docData.created_at || now,
      updated_at: addr.updated_at || docData.updated_at || now
    }));
  } else if (docData?.default_address && typeof docData.default_address === "object" && docData.default_address.address_line_1) {
    // Convert legacy default_address
    const legacy: CustomerAddress = {
      id: "addr_default",
      label: "Home",
      recipient_name: sanitizeString(docData.full_name || "Valued Customer", 100),
      phone: sanitizeString(docData.normalized_phone || "", 20),
      address_line_1: sanitizeString(docData.default_address.address_line_1 || "", 250),
      address_line_2: sanitizeString(docData.default_address.address_line_2 || "", 250),
      landmark: sanitizeString(docData.default_address.landmark || "", 150),
      city: sanitizeString(docData.default_address.city || "", 100),
      state: sanitizeString(docData.default_address.state || "", 100),
      postal_code: sanitizeString(docData.default_address.postal_code || "", 10),
      country: sanitizeString(docData.default_address.country || "India", 50),
      is_default: true,
      created_at: docData.created_at || now,
      updated_at: docData.updated_at || now
    };
    addresses = [legacy];
  }

  // Guarantee exactly 1 default address if addresses exist
  if (addresses.length > 0) {
    const hasDefault = addresses.some(a => a.is_default);
    if (!hasDefault) {
      addresses[0].is_default = true;
    } else {
      // Ensure only one address is_default === true
      let foundFirstDefault = false;
      addresses = addresses.map(a => {
        if (a.is_default) {
          if (!foundFirstDefault) {
            foundFirstDefault = true;
            return a;
          }
          return { ...a, is_default: false };
        }
        return a;
      });
    }
  }

  const defaultAddr = addresses.find(a => a.is_default) || addresses[0] || null;

  // Name resolution
  let firstName = sanitizeString(docData?.first_name || "", 50);
  let lastName = sanitizeString(docData?.last_name || "", 50);
  let fullName = sanitizeString(docData?.full_name || "", 100);

  if ((!firstName || !lastName) && fullName) {
    const nameParts = fullName.trim().split(/\s+/);
    if (!firstName) firstName = nameParts[0] || "";
    if (!lastName) lastName = nameParts.slice(1).join(" ") || "";
  }
  if (!fullName && (firstName || lastName)) {
    fullName = `${firstName} ${lastName}`.trim();
  }

  const country = sanitizeString(docData?.country || defaultAddr?.country || "India", 50);
  const country_code = sanitizeString(docData?.country_code || (country === "India" ? "IN" : ""), 10);
  const dial_code = sanitizeString(docData?.dial_code || (country === "India" ? "+91" : ""), 10);
  const gstin = sanitizeString(docData?.gstin || docData?.gst_details?.gstin || docData?.billing_address?.gstin || "", 30).toUpperCase() || undefined;
  const businessName = sanitizeString(docData?.business_name || docData?.gst_details?.legal_name || docData?.gst_details?.trade_name || docData?.billing_address?.company_name || "", 100) || undefined;

  const gstDetails = docData?.gst_details && typeof docData.gst_details === "object" ? {
    gstin: sanitizeString(docData.gst_details.gstin || gstin || "", 30).toUpperCase() || undefined,
    legal_name: sanitizeString(docData.gst_details.legal_name || businessName || "", 100) || undefined,
    trade_name: sanitizeString(docData.gst_details.trade_name || "", 100) || undefined,
    taxpayer_type: sanitizeString(docData.gst_details.taxpayer_type || "", 50) || undefined,
    business_constitution: sanitizeString(docData.gst_details.business_constitution || "", 50) || undefined,
    status: sanitizeString(docData.gst_details.status || "Active", 30) || undefined,
    registration_date: sanitizeString(docData.gst_details.registration_date || "", 30) || undefined,
    address: sanitizeString(docData.gst_details.address || "", 300) || undefined,
    pincode: sanitizeString(docData.gst_details.pincode || "", 10) || undefined,
    state_code: sanitizeString(docData.gst_details.state_code || "", 10) || undefined,
    verified_at: docData.gst_details.verified_at || undefined
  } : undefined;

  const isGstPresent = Boolean(gstin || businessName || gstDetails || docData?.gst_verified);
  const customerType: "BUSINESS" | "INDIVIDUAL" = (
    docData?.customer_type === "BUSINESS" ||
    docData?.customer_type === "business" ||
    isGstPresent
  ) ? "BUSINESS" : "INDIVIDUAL";

  const billingSameAsShipping = typeof docData?.billing_same_as_shipping === "boolean"
    ? docData.billing_same_as_shipping
    : (docData?.billing_address ? Boolean(docData.billing_address.is_same_as_shipping) : true);

  const whatsappUpdates = typeof docData?.whatsapp_updates === "boolean" 
    ? docData.whatsapp_updates 
    : (docData?.marketing_preferences?.whatsapp_marketing_consent ?? true);

  const emailMarketing = typeof docData?.email_marketing === "boolean" 
    ? docData.email_marketing 
    : (docData?.marketing_preferences?.email_marketing_consent ?? false);

  const billingAddress = docData?.billing_address && typeof docData.billing_address === "object"
    ? {
        first_name: sanitizeString(docData.billing_address.first_name || firstName, 50),
        last_name: sanitizeString(docData.billing_address.last_name || lastName, 50),
        company_name: sanitizeString(docData.billing_address.company_name || businessName || "", 100) || undefined,
        address_line_1: sanitizeString(docData.billing_address.address_line_1 || "", 250),
        address_line_2: sanitizeString(docData.billing_address.address_line_2 || "", 250),
        city: sanitizeString(docData.billing_address.city || "", 100),
        state: sanitizeString(docData.billing_address.state || "", 100),
        postal_code: sanitizeString(docData.billing_address.postal_code || "", 10),
        country: sanitizeString(docData.billing_address.country || country, 50),
        phone: sanitizeString(docData.billing_address.phone || "", 20),
        gstin: sanitizeString(docData.billing_address.gstin || gstin || "", 30) || undefined,
        is_same_as_shipping: Boolean(docData.billing_address.is_same_as_shipping)
      }
    : undefined;

  return {
    id: docId || docData?.id || "",
    customer_id: docData?.customer_id ? sanitizeString(docData.customer_id, 20) : undefined,
    customer_type: customerType,
    normalized_phone: docData?.normalized_phone || "",
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    full_name: fullName,
    email: sanitizeString((docData?.email || "").toLowerCase(), 100),
    country,
    country_code,
    dial_code,
    addresses,
    default_address: defaultAddr
      ? {
          address_line_1: defaultAddr.address_line_1,
          address_line_2: defaultAddr.address_line_2,
          city: defaultAddr.city,
          state: defaultAddr.state,
          postal_code: defaultAddr.postal_code,
          country: defaultAddr.country
        }
      : undefined,
    shipping_address: defaultAddr || undefined,
    billing_address: billingAddress,
    billing_same_as_shipping: billingSameAsShipping,
    gstin,
    business_name: businessName,
    gst_details: gstDetails,
    marketing_consent: Boolean(docData?.marketing_consent || whatsappUpdates || emailMarketing),
    whatsapp_updates: whatsappUpdates,
    email_marketing: emailMarketing,
    commerce_summary: docData?.commerce_summary || {
      total_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      returned_orders: 0,
      lifetime_spend: 0,
      average_order_value: 0
    },
    marketing_preferences: {
      email_marketing_consent: emailMarketing,
      sms_marketing_consent: Boolean(docData?.marketing_preferences?.sms_marketing_consent),
      whatsapp_marketing_consent: whatsappUpdates,
      voice_call_consent: Boolean(docData?.marketing_preferences?.voice_call_consent),
      consent_updated_at: docData?.marketing_preferences?.consent_updated_at || undefined,
      consent_source: docData?.marketing_preferences?.consent_source || undefined
    },
    admin_metadata: {
      tags: Array.isArray(docData?.admin_metadata?.tags) ? docData.admin_metadata.tags : [],
      internal_notes: sanitizeString(docData?.admin_metadata?.internal_notes || "", 1000) || undefined,
      customer_tier: docData?.admin_metadata?.customer_tier || "standard"
    },
    health_status: docData?.health_status || undefined,
    manual_tags: Array.isArray(docData?.manual_tags) ? docData.manual_tags : undefined,
    suggested_tags: Array.isArray(docData?.suggested_tags) ? docData.suggested_tags : undefined,
    dismissed_suggested_tags: Array.isArray(docData?.dismissed_suggested_tags) ? docData.dismissed_suggested_tags : undefined,
    vip_candidate: typeof docData?.vip_candidate === "boolean" ? docData.vip_candidate : undefined,
    vip_reason: docData?.vip_reason ? sanitizeString(docData.vip_reason, 250) : undefined,
    created_at: docData?.created_at || now,
    updated_at: docData?.updated_at || now,
    last_order_at: docData?.last_order_at || undefined
  };
}

/**
 * Server-side address input validation
 */
export function validateAddressInput(input: any, verifiedPhone = ""): { valid: boolean; error?: string; cleanAddress?: CustomerAddress } {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid address payload." };
  }

  const recipient_name = sanitizeString(input.recipient_name || input.fullName || "", 100);
  if (!recipient_name || recipient_name.length < 2) {
    return { valid: false, error: "Recipient full name is required (at least 2 characters)." };
  }

  const phone = sanitizeString(input.phone || verifiedPhone || "", 20);
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    return { valid: false, error: "A valid mobile phone number is required." };
  }

  const address_line_1 = sanitizeString(input.address_line_1 || input.addressLine1 || "", 250);
  if (!address_line_1 || address_line_1.length < 3) {
    return { valid: false, error: "Address line 1 is required (at least 3 characters)." };
  }

  const address_line_2 = sanitizeString(input.address_line_2 || input.addressLine2 || "", 250);
  const landmark = sanitizeString(input.landmark || "", 150);

  const city = sanitizeString(input.city || "", 100);
  if (!city || city.length < 2) {
    return { valid: false, error: "City is required." };
  }

  const state = sanitizeString(input.state || "", 100);
  if (!state || state.length < 2) {
    return { valid: false, error: "State is required." };
  }

  const country = sanitizeString(input.country || "India", 50);

  const postal_code = sanitizeString(input.postal_code || input.pincode || "", 10);
  if (!postal_code) {
    return { valid: false, error: "PIN / postal code is required." };
  }

  if (country.toLowerCase() === "india" && !/^\d{6}$/.test(postal_code)) {
    return { valid: false, error: "Please enter a valid 6-digit Indian PIN code." };
  }

  const labelRaw = sanitizeString(input.label || "Home", 30);
  const label = ["Home", "Work", "Other"].includes(labelRaw) ? labelRaw : "Other";
  const custom_label = label === "Other" ? sanitizeString(input.custom_label || input.customLabel || "Other", 50) : undefined;

  const now = new Date().toISOString();
  const cleanAddress: CustomerAddress = {
    id: input.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    label,
    custom_label,
    recipient_name,
    phone,
    address_line_1,
    address_line_2,
    landmark,
    city,
    state,
    postal_code,
    country,
    is_default: Boolean(input.is_default || input.set_as_default),
    created_at: input.created_at || now,
    updated_at: now
  };

  return { valid: true, cleanAddress };
}

/**
 * Mask phone number for API list privacy (e.g. +91 ***** **321)
 */
export function maskPhone(phone: string): string {
  if (!phone) return "N/A";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "******";
  const last3 = digits.slice(-3);
  const prefix = phone.startsWith("+") ? phone.slice(0, 3) : "";
  return `${prefix} ***** **${last3}`;
}

/**
 * Mask email address for API list privacy (e.g. j***e@gmail.com)
 */
export function maskEmail(email: string): string {
  if (!email || email.trim().toLowerCase() === "n/a") return "N/A";
  const parts = email.trim().split("@");
  if (parts.length !== 2) return "m***d@domain.com";
  const [local, domain] = parts;
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Build normalized search fields for fast, case-insensitive customer indexing
 */
export function buildNormalizedSearchFields(profile: Partial<CustomerProfileDoc>) {
  const first_name_lower = (profile.first_name || "").toLowerCase().trim();
  const last_name_lower = (profile.last_name || "").toLowerCase().trim();
  const full_name_lower = (profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`).toLowerCase().trim();
  const email_lower = (profile.email || "").toLowerCase().trim();
  const normPhone = (profile.normalized_phone || "").replace(/\D/g, "");
  const defaultAddr = profile.default_address || (profile.addresses && profile.addresses[0]) || {};
  const city_lower = (defaultAddr.city || "").toLowerCase().trim();
  const state_lower = (defaultAddr.state || "").toLowerCase().trim();
  const postal_code = (defaultAddr.postal_code || "").trim();
  const customer_id = (profile.customer_id || "").trim();
  const customer_id_upper = customer_id.toUpperCase();
  const customer_id_lower = customer_id.toLowerCase();
  const customer_id_num = customer_id.replace(/^KL-C/i, "");
  const gstin_lower = (profile.gstin || "").toLowerCase().trim();
  const business_name_lower = (profile.business_name || "").toLowerCase().trim();
  const health_status = profile.health_status || "active";
  const customer_tier = profile.admin_metadata?.customer_tier || "standard";

  const search_tokens = Array.from(new Set([
    first_name_lower,
    last_name_lower,
    full_name_lower,
    ...full_name_lower.split(/\s+/),
    email_lower,
    normPhone,
    city_lower,
    state_lower,
    postal_code,
    customer_id,
    customer_id_upper,
    customer_id_lower,
    customer_id_num,
    gstin_lower,
    business_name_lower,
    ...business_name_lower.split(/\s+/)
  ].filter(Boolean)));

  return {
    first_name_lower,
    last_name_lower,
    full_name_lower,
    email_lower,
    normalized_phone: normPhone,
    city_lower,
    state_lower,
    postal_code,
    customer_id,
    customer_id_upper,
    search_tokens,
    health_status,
    customer_tier
  };
}

/**
 * Cursor Payload Structure & Safe Base64 Encoding/Decoding
 */
export interface QueryCursorPayload {
  v: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
  lastValue: any;
  lastDocumentId: string;
  filtersHash?: string;
}

export function encodeCursor(payload: QueryCursorPayload): string {
  const jsonStr = JSON.stringify(payload);
  return Buffer.from(jsonStr, "utf-8").toString("base64url");
}

export function decodeCursor(cursorStr: string): QueryCursorPayload | null {
  try {
    if (!cursorStr || typeof cursorStr !== "string") return null;
    const jsonStr = Buffer.from(cursorStr, "base64url").toString("utf-8");
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.v === "number" && typeof parsed.sortBy === "string" && typeof parsed.lastDocumentId === "string") {
      return parsed as QueryCursorPayload;
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Atomic Customer ID Generator inside a Firestore Transaction
 * Reads global counter from `system_counters/customer_counter`, increments last_sequence,
 * and returns formatted Business Customer ID (e.g. "KL-C000001").
 */
export async function generateNextCustomerIdInTransaction(
  transaction: any,
  adminDb: any
): Promise<string> {
  const counterRef = adminDb.collection("system_counters").doc("customer_counter");
  const counterSnap = await transaction.get(counterRef);

  let lastSeq = 0;
  if (counterSnap.exists) {
    const data = counterSnap.data() || {};
    lastSeq = typeof data.last_sequence === "number" && !isNaN(data.last_sequence) ? data.last_sequence : 0;
  }

  const nextSeq = lastSeq + 1;
  const nowIso = new Date().toISOString();

  transaction.set(counterRef, {
    last_sequence: nextSeq,
    updated_at: nowIso
  }, { merge: true });

  const paddedSeq = String(nextSeq).padStart(6, "0");
  return `KL-C${paddedSeq}`;
}

/**
 * Ensures a customer profile has a valid customer_id.
 * If existingProfileData already contains customer_id, returns it unchanged.
 * Otherwise, generates the next sequential customer_id using the transaction.
 */
export async function ensureCustomerIdInTransaction(
  transaction: any,
  adminDb: any,
  existingProfileData: any
): Promise<string> {
  if (existingProfileData && typeof existingProfileData.customer_id === "string" && existingProfileData.customer_id.trim()) {
    return existingProfileData.customer_id.trim();
  }
  return await generateNextCustomerIdInTransaction(transaction, adminDb);
}

/**
 * Standalone atomic Customer ID Generator (wraps runTransaction)
 */
export async function generateNextCustomerId(adminDb: any): Promise<string> {
  let newId = "";
  await adminDb.runTransaction(async (transaction: any) => {
    newId = await generateNextCustomerIdInTransaction(transaction, adminDb);
  });
  return newId;
}

/**
 * Migration utility for assigning business customer IDs to existing customer profiles
 */
export async function runCustomerIdMigration(
  adminDb: any,
  options: { dryRun?: boolean; batchSize?: number; startAfterId?: string } = {}
): Promise<{
  dryRun: boolean;
  scanned: number;
  assigned: number;
  alreadyHadId: number;
  hasMore: boolean;
  nextCursor: string | null;
  currentCounter: number;
  assignedIdsSample: Array<{ docId: string; customerId: string }>;
}> {
  const dryRun = Boolean(options.dryRun);
  const batchSize = Math.min(200, Math.max(1, options.batchSize || 50));
  const startAfterId = options.startAfterId ? options.startAfterId.trim() : "";

  let query = adminDb.collection("customer_profiles").orderBy("__name__").limit(batchSize);

  if (startAfterId) {
    const startDocSnap = await adminDb.collection("customer_profiles").doc(startAfterId).get();
    if (startDocSnap.exists) {
      query = query.startAfter(startDocSnap);
    }
  }

  const snapshot = await query.get();
  let scanned = 0;
  let assigned = 0;
  let alreadyHadId = 0;
  let lastDocId: string | null = null;
  const assignedIdsSample: Array<{ docId: string; customerId: string }> = [];

  for (const docSnap of snapshot.docs) {
    scanned += 1;
    lastDocId = docSnap.id;
    const data = docSnap.data() || {};

    if (data.customer_id && typeof data.customer_id === "string" && data.customer_id.trim()) {
      alreadyHadId += 1;
      continue;
    }

    if (dryRun) {
      assigned += 1;
      assignedIdsSample.push({ docId: docSnap.id, customerId: `KL-C(DRY_RUN_${assigned})` });
    } else {
      let generatedId = "";
      await adminDb.runTransaction(async (transaction: any) => {
        const freshSnap = await transaction.get(docSnap.ref);
        const freshData = freshSnap.exists ? freshSnap.data() : {};

        if (freshData.customer_id && typeof freshData.customer_id === "string" && freshData.customer_id.trim()) {
          generatedId = freshData.customer_id.trim();
          return;
        }

        generatedId = await generateNextCustomerIdInTransaction(transaction, adminDb);
        const norm = migrateAndNormalizeProfile(freshData, docSnap.id);
        norm.customer_id = generatedId;
        const normSearch = buildNormalizedSearchFields(norm);

        transaction.set(docSnap.ref, {
          customer_id: generatedId,
          ...normSearch,
          updated_at: new Date().toISOString()
        }, { merge: true });
      });

      assigned += 1;
      if (assignedIdsSample.length < 10) {
        assignedIdsSample.push({ docId: docSnap.id, customerId: generatedId });
      }
    }
  }

  // Fetch current counter
  const counterSnap = await adminDb.collection("system_counters").doc("customer_counter").get();
  const currentCounter = counterSnap.exists ? (counterSnap.data()?.last_sequence || 0) : 0;

  const hasMore = scanned === batchSize;

  return {
    dryRun,
    scanned,
    assigned,
    alreadyHadId,
    hasMore,
    nextCursor: hasMore ? lastDocId : null,
    currentCounter,
    assignedIdsSample
  };
}

/**
 * Server-side Consent Event Logger
 */
export async function logConsentEvent(
  adminDb: any,
  profileId: string,
  normalizedPhone: string,
  channel: 'email' | 'sms' | 'whatsapp' | 'voice_call',
  prevStatus: boolean,
  newStatus: boolean,
  source: string,
  actorType: 'customer' | 'admin',
  actorEmail?: string,
  requestId?: string
) {
  if (prevStatus === newStatus) return; // Ignore if unchanged

  try {
    const eventDoc = {
      customer_profile_id: profileId,
      normalized_phone_hash: crypto.createHash('sha256').update(normalizedPhone || '').digest('hex'),
      channel,
      previous_status: Boolean(prevStatus),
      new_status: Boolean(newStatus),
      source: sanitizeString(source || 'address_book', 50),
      actor_type: actorType,
      actor_email: actorEmail ? sanitizeString(actorEmail, 100) : null,
      created_at: new Date().toISOString(),
      request_id: requestId ? sanitizeString(requestId, 100) : null
    };

    await adminDb.collection("customer_consent_events").add(eventDoc);
  } catch (err) {
    console.warn("[CONSENT HISTORY] Failed to write consent event:", err);
  }
}

/**
 * Duplicate Candidate Detection in Admin Customer Details
 * Uses targeted indexed queries instead of full collection scans
 */
export async function findDuplicateCustomerCandidates(
  adminDb: any,
  currentDocId: string,
  currentPhone: string,
  currentEmail: string,
  fullName: string,
  city = "",
  state = ""
): Promise<Array<{ id: string; full_name: string; phone: string; email: string; reason: string; created_at: string }>> {
  try {
    const cleanPhoneDigits = (currentPhone || "").replace(/\D/g, "");
    const cleanEmail = (currentEmail || "").trim().toLowerCase();
    const cleanName = (fullName || "").trim().toLowerCase();

    const candidateMap = new Map<string, { id: string; full_name: string; phone: string; email: string; reason: string; created_at: string }>();

    // 1. Phone match lookup
    if (cleanPhoneDigits) {
      const phoneSnap = await adminDb
        .collection("customer_profiles")
        .where("normalized_phone", "==", cleanPhoneDigits)
        .limit(10)
        .get();

      phoneSnap.forEach((docSnap: any) => {
        if (docSnap.id === currentDocId) return;
        const data = docSnap.data();
        if (!data) return;
        candidateMap.set(docSnap.id, {
          id: docSnap.id,
          full_name: data.full_name || "Valued Customer",
          phone: maskPhone(data.normalized_phone || ""),
          email: maskEmail(data.email || ""),
          reason: "Matching verified phone number",
          created_at: data.created_at || new Date().toISOString()
        });
      });
    }

    // 2. Email match lookup
    if (cleanEmail && cleanEmail !== "shop@saandsha.com") {
      const emailSnap = await adminDb
        .collection("customer_profiles")
        .where("email_lower", "==", cleanEmail)
        .limit(10)
        .get();

      emailSnap.forEach((docSnap: any) => {
        if (docSnap.id === currentDocId) return;
        if (candidateMap.has(docSnap.id)) return;
        const data = docSnap.data();
        if (!data) return;
        candidateMap.set(docSnap.id, {
          id: docSnap.id,
          full_name: data.full_name || "Valued Customer",
          phone: maskPhone(data.normalized_phone || ""),
          email: maskEmail(data.email || ""),
          reason: "Matching registered email address",
          created_at: data.created_at || new Date().toISOString()
        });
      });
    }

    // 3. Name match lookup
    if (cleanName && cleanName.length > 3) {
      const nameSnap = await adminDb
        .collection("customer_profiles")
        .where("full_name_lower", "==", cleanName)
        .limit(10)
        .get();

      nameSnap.forEach((docSnap: any) => {
        if (docSnap.id === currentDocId) return;
        if (candidateMap.has(docSnap.id)) return;
        const data = docSnap.data();
        if (!data) return;

        const defAddr = data.default_address || (data.addresses && data.addresses[0]) || {};
        const pCity = (defAddr.city || "").trim().toLowerCase();
        const cleanCity = (city || "").trim().toLowerCase();

        if (cleanCity && pCity && pCity === cleanCity) {
          candidateMap.set(docSnap.id, {
            id: docSnap.id,
            full_name: data.full_name || "Valued Customer",
            phone: maskPhone(data.normalized_phone || ""),
            email: maskEmail(data.email || ""),
            reason: "Identical full name and primary city",
            created_at: data.created_at || new Date().toISOString()
          });
        }
      });
    }

    return Array.from(candidateMap.values()).slice(0, 5);
  } catch (err) {
    console.warn("Failed to search duplicate customer candidates:", err);
    return [];
  }
}

/**
 * Authoritative recalculation of Customer Commerce Summary from Firestore orders
 */
export async function recalculateCustomerCommerceSummary(adminDb: any, phone: string, email = ""): Promise<CommerceSummary> {
  try {
    const cleanPhoneDigits = phone.replace(/\D/g, "");
    const cleanEmail = email.trim().toLowerCase();

    const snapshot = await adminDb.collection("orders").get();
    let matchedOrders: any[] = [];

    snapshot.forEach((doc: any) => {
      const o = doc.data();
      if (!o) return;
      const orderPhoneDigits = (o.customer_phone || "").replace(/\D/g, "");
      const orderEmail = (o.customer_email || "").trim().toLowerCase();

      const phoneMatch = cleanPhoneDigits && orderPhoneDigits && (
        orderPhoneDigits === cleanPhoneDigits ||
        orderPhoneDigits.endsWith(cleanPhoneDigits) ||
        cleanPhoneDigits.endsWith(orderPhoneDigits)
      );

      const emailMatch = cleanEmail && cleanEmail !== "shop@saandsha.com" && orderEmail === cleanEmail;

      if (phoneMatch || emailMatch) {
        matchedOrders.push(o);
      }
    });

    const total_orders = matchedOrders.length;
    let completed_orders = 0;
    let cancelled_orders = 0;
    let returned_orders = 0;
    let lifetime_spend = 0;
    let first_order_at: string | undefined = undefined;
    let last_order_at: string | undefined = undefined;

    matchedOrders.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());

    if (matchedOrders.length > 0) {
      first_order_at = matchedOrders[0].created_at || undefined;
      last_order_at = matchedOrders[matchedOrders.length - 1].created_at || undefined;
    }

    for (const o of matchedOrders) {
      const status = (o.order_status || o.payment_status || "placed").toLowerCase();
      const paymentType = (o.payment_type || o.payment_method || (o.razorpay_payment_id ? "razorpay" : "cod")).toLowerCase();
      const totalAmt = Number(o.total_amount || o.totalAmount || o.total || 0);
      const refundAmt = Number(o.refund_amount || o.refundAmount || 0);

      if (status === "cancelled") {
        cancelled_orders += 1;
      } else if (status === "returned" || status === "refund_completed" || status === "refunded") {
        returned_orders += 1;
      } else {
        // Evaluate completion/paid criteria based on payment method
        let isCountedAsSpend = false;

        if (paymentType === "razorpay") {
          // Razorpay: count captured / paid / shipped / delivered / completed / placed
          if (["paid", "completed", "shipped", "delivered", "dispatched"].includes(status)) {
            isCountedAsSpend = true;
          }
        } else {
          // COD: count DELIVERED or COMPLETED ONLY
          if (["delivered", "completed"].includes(status)) {
            isCountedAsSpend = true;
          }
        }

        if (isCountedAsSpend) {
          completed_orders += 1;
          const netAmt = Math.max(0, totalAmt - refundAmt);
          lifetime_spend += netAmt;
        }
      }
    }

    const average_order_value = completed_orders > 0 ? Math.round(lifetime_spend / completed_orders) : 0;

    return {
      total_orders,
      completed_orders,
      cancelled_orders,
      returned_orders,
      lifetime_spend: Math.max(0, Math.round(lifetime_spend)),
      average_order_value,
      first_order_at,
      last_order_at
    };
  } catch (err) {
    console.error("Error recalculating customer commerce summary:", err);
    return {
      total_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      returned_orders: 0,
      lifetime_spend: 0,
      average_order_value: 0
    };
  }
}

/**
 * PHASE 7A.4 - Profile Completion % Calculator
 */
export interface ProfileCompletionResult {
  completion_percent: number;
  completed_fields: string[];
  missing_suggestions: Array<{
    key: string;
    label: string;
    weight: number;
    completed: boolean;
    action_type: "birthday" | "email" | "address" | "whatsapp" | "gender" | "language" | "name";
  }>;
}

export function calculateProfileCompletion(profileData: any): ProfileCompletionResult {
  const suggestions = [
    {
      key: "name",
      label: "Full Name Provided",
      weight: 25,
      completed: Boolean(profileData?.full_name && profileData.full_name.trim().length >= 2),
      action_type: "name" as const
    },
    {
      key: "email",
      label: "Email Address Saved",
      weight: 20,
      completed: Boolean(profileData?.email && profileData.email.includes("@")),
      action_type: "email" as const
    },
    {
      key: "address",
      label: "At Least 1 Saved Delivery Address",
      weight: 20,
      completed: Boolean(Array.isArray(profileData?.addresses) && profileData.addresses.length > 0),
      action_type: "address" as const
    },
    {
      key: "birthday",
      label: "Add Birthday for Special Rewards",
      weight: 15,
      completed: Boolean(profileData?.birthday || profileData?.date_of_birth),
      action_type: "birthday" as const
    },
    {
      key: "whatsapp",
      label: "Enable WhatsApp / Marketing Preferences",
      weight: 10,
      completed: Boolean(profileData?.marketing_preferences?.whatsapp_marketing_consent || profileData?.marketing_preferences?.email_marketing_consent),
      action_type: "whatsapp" as const
    },
    {
      key: "gender_lang",
      label: "Set Gender & Preferred Language",
      weight: 10,
      completed: Boolean(profileData?.gender || profileData?.preferred_language),
      action_type: "language" as const
    }
  ];

  let completion_percent = 0;
  const completed_fields: string[] = [];

  for (const item of suggestions) {
    if (item.completed) {
      completion_percent += item.weight;
      completed_fields.push(item.key);
    }
  }

  return {
    completion_percent: Math.min(100, completion_percent),
    completed_fields,
    missing_suggestions: suggestions
  };
}

/**
 * PHASE 7A.4 - Check for Duplicate Email across customer profiles
 */
export async function checkEmailDuplicate(
  adminDb: any,
  email: string,
  currentProfileId: string
): Promise<{ isDuplicate: boolean; matchedProfileId?: string }> {
  if (!email || !email.includes("@")) return { isDuplicate: false };

  const cleanEmail = email.trim().toLowerCase();
  try {
    const snap = await adminDb
      .collection("customer_profiles")
      .where("email", "==", cleanEmail)
      .limit(5)
      .get();

    let duplicateFound = false;
    let matchedId: string | undefined = undefined;

    snap.forEach((doc: any) => {
      if (doc.id !== currentProfileId) {
        duplicateFound = true;
        matchedId = doc.id;
      }
    });

    return { isDuplicate: duplicateFound, matchedProfileId: matchedId };
  } catch (err) {
    console.warn("Error checking email duplicate:", err);
    return { isDuplicate: false };
  }
}

/**
 * PHASE 7A.4 - Build Comprehensive Customer Data Export (GDPR/Privacy Compliant)
 * Strips internal tokens, secret keys, hashes, and admin-only internal notes.
 */
export async function buildCustomerDataExport(
  adminDb: any,
  profileId: string,
  profileData: any
) {
  const normalized = migrateAndNormalizeProfile(profileData, profileId);
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);

  // 1. Fetch Orders Summary (non-sensitive fields)
  const ordersSnap = await adminDb.collection("orders").get();
  const customerOrders: any[] = [];
  const phoneDigits = (profileData.normalized_phone || "").replace(/\D/g, "");
  const emailLower = (profileData.email || "").toLowerCase();

  ordersSnap.forEach((doc: any) => {
    const o = doc.data();
    if (!o) return;
    const oPhone = (o.customer_phone || "").replace(/\D/g, "");
    const oEmail = (o.customer_email || "").toLowerCase();

    if ((phoneDigits && oPhone && (oPhone === phoneDigits || oPhone.endsWith(phoneDigits))) ||
        (emailLower && oEmail === emailLower)) {
      customerOrders.push({
        order_id: o.order_id || doc.id,
        created_at: o.created_at,
        total_amount: o.total_amount || o.totalAmount || 0,
        order_status: o.order_status || "placed",
        payment_method: o.payment_type || o.payment_method || "COD",
        items_count: Array.isArray(o.items) ? o.items.length : 1
      });
    }
  });

  // 2. Fetch Loyalty Ledger Summary
  const loyaltySnap = await profileRef.collection("loyalty_ledger").limit(50).get();
  const loyaltyActivity: any[] = [];
  loyaltySnap.forEach((doc: any) => {
    const d = doc.data();
    if (d) {
      loyaltyActivity.push({
        date: d.created_at,
        points: d.points || 0,
        description: d.description || "",
        status: d.status || "available"
      });
    }
  });

  // 3. Fetch Store Credit Ledger Summary
  const creditSnap = await profileRef.collection("store_credit_ledger").limit(50).get();
  const walletActivity: any[] = [];
  creditSnap.forEach((doc: any) => {
    const d = doc.data();
    if (d) {
      walletActivity.push({
        date: d.created_at,
        amount_rupees: Math.floor((d.amount_paise || 0) / 100),
        entry_type: d.entry_type || "",
        description: d.description || ""
      });
    }
  });

  // 4. Fetch Communication Preferences & Events
  const eventsSnap = await profileRef.collection("events").limit(30).get();
  const crmTimeline: any[] = [];
  eventsSnap.forEach((doc: any) => {
    const d = doc.data();
    if (d) {
      crmTimeline.push({
        date: d.occurred_at || d.created_at,
        event_type: d.event_type,
        title: d.title || d.description
      });
    }
  });

  return {
    export_metadata: {
      generated_at: new Date().toISOString(),
      export_type: "Sa and Sha Customer Profile & Account Record",
      compliance: "DPDP / GDPR Data Subject Access Request"
    },
    customer_info: {
      customer_id: normalized.customer_id || `KL-CUST-${profileId.slice(0, 6).toUpperCase()}`,
      full_name: normalized.full_name,
      email: normalized.email,
      phone: profileData.normalized_phone || "",
      member_since: normalized.created_at,
      birthday: profileData.birthday || profileData.date_of_birth || null,
      gender: profileData.gender || null,
      preferred_language: profileData.preferred_language || "English",
      country: profileData.country || "India"
    },
    addresses: normalized.addresses.map(a => ({
      label: a.label,
      recipient_name: a.recipient_name,
      phone: a.phone,
      address_line_1: a.address_line_1,
      address_line_2: a.address_line_2,
      city: a.city,
      state: a.state,
      postal_code: a.postal_code,
      country: a.country,
      is_default: a.is_default
    })),
    marketing_preferences: normalized.marketing_preferences,
    orders_summary: {
      commerce_stats: normalized.commerce_summary,
      recent_orders: customerOrders.slice(0, 20)
    },
    loyalty_rewards: {
      summary: profileData.loyalty_summary || {},
      recent_points_history: loyaltyActivity
    },
    store_credit_wallet: {
      summary: profileData.store_credit_summary || {},
      recent_wallet_history: walletActivity
    },
    activity_timeline: crmTimeline
  };
}

/**
 * PHASE 7A.4 - Account Deletion Request Creation
 */
export async function createAccountDeletionRequest(
  adminDb: any,
  profileId: string,
  profileData: any,
  reason = "User requested account closure via Account Center"
) {
  const now = new Date();
  const gracePeriodDays = 30;
  const scheduledDeletionDate = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000).toISOString();

  const requestId = `del_req_${profileId.slice(0, 8)}_${now.getTime()}`;
  const requestDoc = {
    id: requestId,
    profile_id: profileId,
    customer_id: profileData.customer_id || `KL-CUST-${profileId.slice(0, 6).toUpperCase()}`,
    email: profileData.email || "",
    phone: profileData.normalized_phone || "",
    requested_at: now.toISOString(),
    status: "pending_admin_review",
    grace_period_days: gracePeriodDays,
    scheduled_deletion_date: scheduledDeletionDate,
    reason: sanitizeString(reason, 300),
    reviewed_by_admin: false,
    updated_at: now.toISOString()
  };

  await adminDb.collection("account_deletion_requests").doc(requestId).set(requestDoc);

  // Update customer profile status
  await adminDb.collection("customer_profiles").doc(profileId).set(removeUndefined({
    account_status: "deletion_pending",
    pending_deletion_request_id: requestId,
    updated_at: now.toISOString()
  }), { merge: true });

  // Log CRM event
  const profileRef = adminDb.collection("customer_profiles").doc(profileId);
  await profileRef.collection("events").add({
    event_type: "account_deletion_requested",
    title: "Account Deletion Requested",
    description: `Account deletion request submitted with 30-day grace period (scheduled: ${new Date(scheduledDeletionDate).toLocaleDateString("en-IN")}).`,
    occurred_at: now.toISOString()
  });

  return requestDoc;
}

export function normalizeIndianPhone(phone: string): string {
  if (!phone) return '';
  const clean = phone.toString().trim().replace(/\D/g, '');
  if (clean.length === 10) {
    return `91${clean}`;
  }
  if (clean.length === 11 && clean.startsWith('0')) {
    return `91${clean.substring(1)}`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return clean;
  }
  if (clean.length > 10) {
    const last10 = clean.slice(-10);
    if (/^[6-9]\d{9}$/.test(last10)) {
      return `91${last10}`;
    }
  }
  return clean;
}

export interface CustomerVerificationSession {
  session_id: string;
  normalized_phone: string;
  phone_hash: string;
  verified_at: string;
  expires_at: number;
  consumed_at: string | null;
  last_used_at: string;
  status: "VERIFIED" | "EXPIRED" | "CONSUMED";
  created_at: string;
  updated_at: string;
  checkout_session_id?: string | null;
  customer_profile_id?: string | null;
}

export async function createCustomerVerificationSession(
  adminDb: any,
  rawPhone: string,
  checkoutSessionId?: string
): Promise<{ sessionId: string; expiresAt: number; normalizedPhone: string }> {
  const normalizedPhone = normalizeIndianPhone(rawPhone);
  if (!normalizedPhone) {
    throw new Error("Invalid mobile number for verification session creation.");
  }

  const sessionId = `v_sess_${crypto.randomBytes(16).toString('hex')}`;
  const now = Date.now();
  const expiresAt = now + 60 * 60 * 1000; // 60 minutes duration
  const phoneHash = crypto.createHash('sha256').update(normalizedPhone).digest('hex');

  const sessDoc: CustomerVerificationSession = {
    session_id: sessionId,
    normalized_phone: normalizedPhone,
    phone_hash: phoneHash,
    verified_at: new Date(now).toISOString(),
    expires_at: expiresAt,
    consumed_at: null,
    last_used_at: new Date(now).toISOString(),
    status: "VERIFIED",
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    checkout_session_id: checkoutSessionId || null,
    customer_profile_id: null
  };

  if (adminDb && typeof adminDb.collection === "function") {
    await adminDb.collection("customer_verification_sessions").doc(sessionId).set(sessDoc);
  }

  return { sessionId, expiresAt, normalizedPhone };
}

export interface ResolveVerifiedIdentityParams {
  verifiedCustomerSessionId?: string;
  verificationToken?: string;
  submittedPhone?: string;
  checkoutSessionId?: string;
}

export interface ResolvedVerifiedIdentity {
  valid: boolean;
  normalizedPhone?: string;
  verificationSource?: "VERIFICATION_SESSION" | "HMAC_TOKEN" | "CHECKOUT_SESSION_LINK";
  verifiedAt?: string | number;
  sessionId?: string;
  error?: string;
}

export async function resolveVerifiedCustomerIdentity(
  adminDb: any,
  params: ResolveVerifiedIdentityParams,
  tokenVerifier?: (token: string, expectedPhone?: string) => { valid: boolean; normalizedPhone?: string; error?: string }
): Promise<ResolvedVerifiedIdentity> {
  const { verifiedCustomerSessionId, verificationToken, submittedPhone, checkoutSessionId } = params;

  // A. Check verifiedCustomerSessionId
  if (verifiedCustomerSessionId && typeof verifiedCustomerSessionId === "string" && verifiedCustomerSessionId.trim()) {
    const cleanSessId = verifiedCustomerSessionId.trim();
    try {
      if (adminDb && typeof adminDb.collection === "function") {
        const sessDocRef = adminDb.collection("customer_verification_sessions").doc(cleanSessId);
        const sessSnap = await sessDocRef.get();
        if (sessSnap.exists) {
          const data = sessSnap.data() as CustomerVerificationSession;
          if (data && data.status === "VERIFIED" && typeof data.expires_at === "number" && data.expires_at > Date.now()) {
            const normPhone = data.normalized_phone;
            if (submittedPhone) {
              const normSubmitted = normalizeIndianPhone(submittedPhone);
              if (normSubmitted && normSubmitted !== normPhone) {
                return { valid: false, error: "Submitted phone does not match verified session." };
              }
            }
            sessDocRef.update({ last_used_at: new Date().toISOString() }).catch(() => {});
            return {
              valid: true,
              normalizedPhone: normPhone,
              verificationSource: "VERIFICATION_SESSION",
              verifiedAt: data.verified_at,
              sessionId: cleanSessId
            };
          } else if (data && data.expires_at <= Date.now()) {
            return { valid: false, error: "Verification session has expired." };
          }
        }
      }
    } catch (err: any) {
      console.warn("[SECURITY IDENTITY] Verification session resolution failed:", err?.message || err);
    }
  }

  // B. Check legacy HMAC token
  if (verificationToken && typeof verificationToken === "string" && verificationToken.trim()) {
    const cleanToken = verificationToken.trim();
    if (tokenVerifier) {
      const authRes = tokenVerifier(cleanToken, submittedPhone);
      if (authRes.valid && authRes.normalizedPhone) {
        return {
          valid: true,
          normalizedPhone: authRes.normalizedPhone,
          verificationSource: "HMAC_TOKEN",
          verifiedAt: Date.now()
        };
      }
    }
  }

  // C. Check linked checkout session ID
  if (checkoutSessionId && typeof checkoutSessionId === "string" && checkoutSessionId.trim()) {
    const cleanCheckoutId = checkoutSessionId.trim();
    try {
      if (adminDb && typeof adminDb.collection === "function") {
        const q = await adminDb.collection("customer_verification_sessions")
          .where("checkout_session_id", "==", cleanCheckoutId)
          .where("status", "==", "VERIFIED")
          .limit(1)
          .get();
        if (!q.empty) {
          const doc = q.docs[0];
          const data = doc.data() as CustomerVerificationSession;
          if (data && typeof data.expires_at === "number" && data.expires_at > Date.now()) {
            const normPhone = data.normalized_phone;
            if (submittedPhone) {
              const normSubmitted = normalizeIndianPhone(submittedPhone);
              if (normSubmitted && normSubmitted !== normPhone) {
                return { valid: false, error: "Submitted phone does not match session." };
              }
            }
            return {
              valid: true,
              normalizedPhone: normPhone,
              verificationSource: "CHECKOUT_SESSION_LINK",
              verifiedAt: data.verified_at,
              sessionId: doc.id
            };
          }
        }
      }
    } catch (err: any) {
      console.warn("[SECURITY IDENTITY] Checkout session resolution failed:", err?.message || err);
    }
  }

  return { valid: false, error: "No trustworthy verified identity found." };
}

/**
 * PHASE 9F.1 - Admin Idempotent Repair Helper
 * Scans customer_profiles and associated orders to fix:
 * - Missing or outdated GST details (gstin, business_name, gst_details, customer_type: BUSINESS)
 * - Missing or incorrect separate billing address and billing_same_as_shipping flag
 * - Missing or incorrect canonical customer_id on orders (setting customer_id to KL-C... and customer_profile_id to p_...)
 */
export async function repairCustomerProfilesAndOrders(
  adminDb: any,
  options?: { targetPhone?: string; targetProfileId?: string; dryRun?: boolean }
): Promise<{
  success: boolean;
  dryRun: boolean;
  repairedProfilesCount: number;
  repairedOrdersCount: number;
  details: any[];
}> {
  const dryRun = Boolean(options?.dryRun);
  const targetPhone = options?.targetPhone ? normalizeIndianPhone(options.targetPhone) : null;
  const targetProfileId = options?.targetProfileId || null;

  if (!targetProfileId && !targetPhone) {
    throw new Error("targetProfileId or targetPhone is required.");
  }

  let profilesQuery: any = adminDb.collection("customer_profiles");
  if (targetProfileId) {
    profilesQuery = profilesQuery.where("__name__", "==", targetProfileId);
  } else if (targetPhone) {
    profilesQuery = profilesQuery.where("normalized_phone", "==", targetPhone);
  }

  const profilesSnap = await profilesQuery.get();
  const ordersSnap = await adminDb.collection("orders").get();

  const allOrders: any[] = [];
  ordersSnap.forEach((docSnap: any) => {
    allOrders.push({ docRefId: docSnap.id, ...docSnap.data() });
  });

  let repairedProfilesCount = 0;
  let repairedOrdersCount = 0;
  const details: any[] = [];

  for (const profDoc of profilesSnap.docs) {
    const pData = profDoc.data() || {};
    const docId = profDoc.id;
    const normPhone = pData.normalized_phone || (pData.phone ? normalizeIndianPhone(pData.phone) : "");
    const cleanEmail = (pData.email || "").trim().toLowerCase();

    // Find orders belonging to this profile
    const matchedOrders = allOrders.filter((o: any) => {
      const oPhone = (o.customer_phone || "").replace(/\D/g, "");
      const normPhoneDigits = (normPhone || "").replace(/\D/g, "");
      const phoneMatch = normPhoneDigits && oPhone && (oPhone === normPhoneDigits || oPhone.endsWith(normPhoneDigits) || normPhoneDigits.endsWith(oPhone));
      const emailMatch = cleanEmail && cleanEmail !== "shop@saandsha.com" && (o.customer_email || "").trim().toLowerCase() === cleanEmail;
      const profileIdMatch = o.customer_profile_id === docId;
      return phoneMatch || emailMatch || profileIdMatch;
    });

    let gstin = pData.gstin || pData.gst_details?.gstin;
    let businessName = pData.business_name || pData.gst_details?.legal_name;
    let gstDetails = pData.gst_details;
    let billingAddress = pData.billing_address;
    let billingSameAsShipping = typeof pData.billing_same_as_shipping === "boolean" ? pData.billing_same_as_shipping : undefined;

    // Scan matched orders (newest first) for any missing GST / billing data
    for (const o of matchedOrders) {
      if (!gstin && (o.gstin || o.gst_details?.gstin)) {
        gstin = (o.gstin || o.gst_details?.gstin).toString().trim().toUpperCase();
      }
      if (!businessName && (o.business_name || o.gst_details?.legal_name)) {
        businessName = o.business_name || o.gst_details?.legal_name;
      }
      if (!gstDetails && o.gst_details) {
        gstDetails = o.gst_details;
      }
      if (!billingAddress && o.billing_address) {
        billingAddress = o.billing_address;
      }
      if (billingSameAsShipping === undefined && typeof o.billing_same_as_shipping === "boolean") {
        billingSameAsShipping = o.billing_same_as_shipping;
      }
    }

    const isBusiness = Boolean(gstin || businessName || gstDetails || pData.gst_verified || pData.customer_type === "BUSINESS" || pData.customer_type === "business");
    const customerType = isBusiness ? "BUSINESS" : "INDIVIDUAL";
    const canonicalCustomerId = pData.customer_id || (pData.id ? pData.id : null);

    const profileUpdates: any = {};
    if (gstin && gstin !== pData.gstin) profileUpdates.gstin = gstin.toUpperCase();
    if (businessName && businessName !== pData.business_name) profileUpdates.business_name = businessName;
    if (gstDetails && JSON.stringify(gstDetails) !== JSON.stringify(pData.gst_details)) profileUpdates.gst_details = gstDetails;
    if (isBusiness && pData.customer_type !== "BUSINESS") profileUpdates.customer_type = "BUSINESS";
    if (isBusiness && !pData.gst_verified) {
      profileUpdates.gst_verified = true;
      profileUpdates.gst_verified_at = pData.gst_verified_at || new Date().toISOString();
      profileUpdates.gst_provider = pData.gst_provider || "gstinapi";
    }
    if (billingAddress && JSON.stringify(billingAddress) !== JSON.stringify(pData.billing_address)) profileUpdates.billing_address = billingAddress;
    if (typeof billingSameAsShipping === "boolean" && billingSameAsShipping !== pData.billing_same_as_shipping) {
      profileUpdates.billing_same_as_shipping = billingSameAsShipping;
    }

    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updated_at = new Date().toISOString();
      if (!dryRun) {
        await adminDb.collection("customer_profiles").doc(docId).set(removeUndefined(profileUpdates), { merge: true });
      }
      repairedProfilesCount++;
    }

    // Repair matched orders' customer_profile_id and customer_id
    let repairedOrdersForThisProfile = 0;
    for (const o of matchedOrders) {
      const orderUpdates: any = {};
      if (o.customer_profile_id !== docId) {
        orderUpdates.customer_profile_id = docId;
      }
      if (canonicalCustomerId && o.customer_id !== canonicalCustomerId) {
        orderUpdates.customer_id = canonicalCustomerId;
      }
      if (gstin && !o.gstin) {
        orderUpdates.gstin = gstin.toUpperCase();
      }
      if (businessName && !o.business_name) {
        orderUpdates.business_name = businessName;
      }
      if (gstDetails && !o.gst_details) {
        orderUpdates.gst_details = gstDetails;
      }
      if (typeof billingSameAsShipping === "boolean" && o.billing_same_as_shipping === undefined) {
        orderUpdates.billing_same_as_shipping = billingSameAsShipping;
      }

      if (Object.keys(orderUpdates).length > 0) {
        if (!dryRun) {
          await adminDb.collection("orders").doc(o.docRefId).update(removeUndefined(orderUpdates));
        }
        repairedOrdersCount++;
        repairedOrdersForThisProfile++;
      }
    }

    details.push({
      profileDocId: docId,
      phone: normPhone,
      customer_id: canonicalCustomerId,
      customer_type: customerType,
      profileUpdates,
      repairedOrdersCount: repairedOrdersForThisProfile
    });
  }

  return {
    success: true,
    dryRun,
    repairedProfilesCount,
    repairedOrdersCount,
    details
  };
}


