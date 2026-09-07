import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { Request } from "express";
import { encodeCursor, decodeCursor } from "./customerProfileHelpers";

// Centralized Session Constants
export const SESSION_ABSOLUTE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_IDLE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;       // 7 days
export const ACTIVITY_THROTTLE_MS = 15 * 60 * 1000;                 // 15 minutes

export const SESSION_CONSTANTS = {
  ABSOLUTE_EXPIRATION_DAYS: 30,
  IDLE_EXPIRATION_DAYS: 7,
  TOKEN_PREFIX: "cses_"
};

export type AuthMethod = "mobile_otp" | "google" | "email_otp";
export type SessionStatus = "active" | "revoked" | "expired";

export interface UserAgentMetadata {
  browser: string;
  operating_system: string;
  device_type: "desktop" | "mobile" | "tablet";
  device_name: string;
  user_agent_summary: string;
}

export interface CustomerSessionDoc {
  session_id: string;
  session_token_hash: string;
  customer_profile_id: string;
  customer_id: string;
  auth_method: AuthMethod;
  provider: string;
  status: SessionStatus;
  created_at: string;
  last_activity_at: string;
  expires_at: string;
  idle_expires_at: string;
  revoked_at?: string | null;
  revoked_by?: string | null;
  revoke_reason?: string | null;
  device_id_hash?: string | null;
  device_name: string;
  device_type: "desktop" | "mobile" | "tablet";
  browser: string;
  operating_system: string;
  user_agent_summary: string;
  ip_hash: string;
  ip_masked: string;
  country: string | null;
  region: string | null;
  city: string | null;
  is_current?: boolean;
  is_trusted: boolean;
  rotated_from_session_id?: string | null;
  metadata?: Record<string, any>;
}

export type SecurityEventType =
  | "login_success"
  | "login_failed"
  | "mobile_otp_requested"
  | "mobile_otp_verified"
  | "mobile_otp_failed"
  | "email_otp_requested"
  | "email_otp_verified"
  | "email_otp_failed"
  | "google_login_success"
  | "google_login_failed"
  | "session_created"
  | "session_revoked"
  | "session_expired"
  | "logout"
  | "logout_all"
  | "token_rotated"
  | "session_rotated"
  | "identity_linked"
  | "identity_conflict"
  | "suspicious_login"
  | "account_locked"
  | "account_unlocked"
  | "login_eligibility_checked"
  | "login_eligibility_rejected"
  | "account_creation_started"
  | "account_created";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export const SECURITY_EVENT_RETENTION_DAYS = 365;

export interface CustomerSecurityEventDoc {
  event_id: string;
  customer_profile_id: string;
  customer_id: string;
  event_type: SecurityEventType;
  session_id: string;
  auth_method: AuthMethod | "system" | "unknown";
  device_name: string;
  browser: string;
  operating_system: string;
  device_type: "desktop" | "mobile" | "tablet";
  ip_masked: string;
  ip_hash: string;
  approximate_location: string;
  created_at: string;
  outcome: "success" | "failed" | "failure" | "rejected" | "warning" | "info";
  reason?: string;
  risk_level: RiskLevel;
  risk_flags: string[];
  request_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Hash raw session token using SHA-256
 */
export function hashSessionToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== "string") return "";
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

/**
 * Mask IP address safely for privacy compliance
 * IPv4: 203.0.113.xxx
 * IPv6: 2001:db8:****:****
 */
export function maskIpAddress(ipStr?: string): string {
  if (!ipStr || typeof ipStr !== "string") return "xxx.xxx.xxx.xxx";
  const cleanIp = ipStr.trim().split(",")[0].trim(); // Handle X-Forwarded-For

  if (cleanIp.includes(".")) {
    // IPv4
    const parts = cleanIp.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  } else if (cleanIp.includes(":")) {
    // IPv6
    const parts = cleanIp.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:****:****`;
    }
  }

  return "xxx.xxx.xxx.xxx";
}

/**
 * Hash IP Address safely for internal matching without storing raw IP
 */
export function hashIpAddress(ipStr?: string): string {
  if (!ipStr) return "";
  return crypto.createHash("sha256").update(ipStr.trim().split(",")[0].trim()).digest("hex");
}

/**
 * Parse User-Agent string safely into device & OS metadata
 */
export function parseUserAgent(uaString?: string): UserAgentMetadata {
  const ua = uaString || "";

  let browser = "Unknown Browser";
  let os = "Unknown OS";
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";

  // Operating System
  if (/android/i.test(ua)) {
    os = "Android";
    deviceType = "mobile";
  } else if (/ipad|tablet/i.test(ua)) {
    os = "iPadOS";
    deviceType = "tablet";
  } else if (/iphone|ipod/i.test(ua)) {
    os = "iOS";
    deviceType = "mobile";
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = "macOS";
    deviceType = "desktop";
  } else if (/windows/i.test(ua)) {
    os = "Windows";
    deviceType = "desktop";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
    deviceType = "desktop";
  }

  // Browser
  if (/edg/i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/chrome|crios/i.test(ua) && !/opr|opera|edg/i.test(ua)) {
    browser = "Chrome";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/safari/i.test(ua) && !/chrome|crios|android/i.test(ua)) {
    browser = "Safari";
  } else if (/opera|opr/i.test(ua)) {
    browser = "Opera";
  }

  // Refine tablet
  if (/mobile/i.test(ua) && deviceType === "desktop") {
    deviceType = "mobile";
  }

  const deviceName = `${browser} on ${os}`;
  const userAgentSummary = ua.length > 120 ? `${ua.substring(0, 117)}...` : ua;

  return {
    browser,
    operating_system: os,
    device_type: deviceType,
    device_name: deviceName,
    user_agent_summary: userAgentSummary
  };
}

/**
 * Helper to extract IP from Express request
 */
export function extractClientIp(req?: Request): string {
  if (!req) return "127.0.0.1";
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

/**
 * Record append-only Security Event in customer_security_events
 */
export async function recordCustomerSecurityEvent(
  adminDb: Firestore,
  event: {
    customer_profile_id: string;
    customer_id?: string;
    event_type: SecurityEventType;
    session_id?: string;
    auth_method?: AuthMethod | "system" | "unknown";
    device_name?: string;
    browser?: string;
    operating_system?: string;
    device_type?: "desktop" | "mobile" | "tablet";
    ip_masked?: string;
    ip_hash?: string;
    approximate_location?: string;
    outcome?: "success" | "failed" | "failure" | "rejected" | "warning" | "info";
    reason?: string;
    risk_level?: RiskLevel;
    risk_flags?: string[];
    request_id?: string;
    req?: Request;
    metadata?: Record<string, any>;
  }
): Promise<string> {
  try {
    const docRef = adminDb.collection("customer_security_events").doc();
    const eventId = docRef.id;
    const nowIso = new Date().toISOString();

    let uaMeta = {
      browser: event.browser || "Unknown Browser",
      operating_system: event.operating_system || "Unknown OS",
      device_type: event.device_type || "desktop",
      device_name: event.device_name || "Unknown Device",
      user_agent_summary: ""
    };

    let rawIp = "";
    if (event.req) {
      const parsedUa = parseUserAgent(event.req.headers["user-agent"]);
      uaMeta = {
        browser: event.browser || parsedUa.browser,
        operating_system: event.operating_system || parsedUa.operating_system,
        device_type: event.device_type || parsedUa.device_type,
        device_name: event.device_name || parsedUa.device_name,
        user_agent_summary: parsedUa.user_agent_summary
      };
      rawIp = extractClientIp(event.req);
    }

    const ipMasked = event.ip_masked || (rawIp ? maskIpAddress(rawIp) : "xxx.xxx.xxx.xxx");
    const ipHash = event.ip_hash || (rawIp ? hashIpAddress(rawIp) : "");

    // Sanitize metadata to never store secrets or raw tokens
    let safeMeta: Record<string, any> | undefined = undefined;
    if (event.metadata) {
      const copy = { ...event.metadata };
      delete copy.token;
      delete copy.rawToken;
      delete copy.otp;
      delete copy.idToken;
      delete copy.accessToken;
      delete copy.refreshToken;
      delete copy.uid;
      delete copy.ip;
      delete copy.authHeader;
      delete copy.authorization;
      delete copy.secret;
      delete copy.password;
      safeMeta = copy;
    }

    const payload: CustomerSecurityEventDoc = {
      event_id: eventId,
      customer_profile_id: event.customer_profile_id,
      customer_id: event.customer_id || "",
      event_type: event.event_type,
      session_id: event.session_id || "",
      auth_method: event.auth_method || "unknown",
      device_name: uaMeta.device_name,
      browser: uaMeta.browser,
      operating_system: uaMeta.operating_system,
      device_type: uaMeta.device_type,
      ip_masked: ipMasked,
      ip_hash: ipHash,
      approximate_location: event.approximate_location || "Approximate location",
      created_at: nowIso,
      outcome: event.outcome || "success",
      reason: event.reason || undefined,
      risk_level: event.risk_level || "low",
      risk_flags: event.risk_flags || [],
      request_id: event.request_id || undefined,
      metadata: safeMeta
    };

    const cleanPayload = JSON.parse(JSON.stringify(payload));
    await docRef.set(cleanPayload);
    return eventId;
  } catch (err: any) {
    console.warn("[SECURITY EVENT LOG WARNING] Failed to record security event:", err?.message || err);
    return "";
  }
}

/**
 * Rule-based Suspicious Login Detection
 */
export async function detectSuspiciousLogin(
  adminDb: Firestore,
  customerProfileId: string,
  currentReq?: Request,
  authMethod?: AuthMethod
): Promise<{ riskLevel: RiskLevel; riskFlags: string[] }> {
  const riskFlags: string[] = [];
  let riskLevel: RiskLevel = "low";

  if (!customerProfileId) return { riskLevel, riskFlags };

  try {
    const recentSnap = await adminDb
      .collection("customer_security_events")
      .where("customer_profile_id", "==", customerProfileId)
      .orderBy("created_at", "desc")
      .limit(20)
      .get();

    const currentUa = currentReq ? parseUserAgent(currentReq.headers["user-agent"]) : null;
    const currentIp = currentReq ? extractClientIp(currentReq) : "";
    const currentIpHash = currentIp ? hashIpAddress(currentIp) : "";

    const events = (recentSnap.docs || []).map((d: any) => d.data() as CustomerSecurityEventDoc);

    if (events.length > 0 && currentUa) {
      const knownDevices = new Set(events.map((e) => e.device_name));
      const knownBrowsers = new Set(events.map((e) => e.browser));
      const knownOs = new Set(events.map((e) => e.operating_system));
      const knownIps = new Set(events.map((e) => e.ip_hash).filter(Boolean));

      if (!knownDevices.has(currentUa.device_name)) {
        riskFlags.push("NEW_DEVICE");
      }
      if (!knownBrowsers.has(currentUa.browser)) {
        riskFlags.push("NEW_BROWSER");
      }
      if (!knownOs.has(currentUa.operating_system)) {
        riskFlags.push("NEW_OPERATING_SYSTEM");
      }
      if (currentIpHash && knownIps.size > 0 && !knownIps.has(currentIpHash)) {
        riskFlags.push("IP_CHANGE");
      }
    }

    // Check rapid failed logins in last 15 minutes
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const failedRecent = events.filter(
      (e) => e.created_at >= fifteenMinsAgo && (e.outcome === "failed" || e.outcome === "failure" || e.event_type.includes("failed"))
    );

    if (failedRecent.length >= 3) {
      riskFlags.push("MULTIPLE_FAILED_LOGINS");
      riskFlags.push("RAPID_LOGIN_ATTEMPTS");
    }

    if (riskFlags.includes("MULTIPLE_FAILED_LOGINS") || riskFlags.includes("RAPID_LOGIN_ATTEMPTS")) {
      riskLevel = "high";
    } else if (riskFlags.includes("NEW_DEVICE") || riskFlags.includes("NEW_BROWSER")) {
      riskLevel = "medium";
    }

    return { riskLevel, riskFlags };
  } catch (err) {
    console.warn("[SUSPICIOUS LOGIN CHECK WARNING]", err);
    return { riskLevel: "low", riskFlags: [] };
  }
}

/**
 * List Customer Login History (customer-scoped API query helper)
 */
export async function listCustomerLoginHistory(
  adminDb: Firestore,
  customerProfileId: string,
  options: {
    event_type?: string;
    auth_method?: string;
    outcome?: string;
    risk_level?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    cursor?: string;
    currentSessionId?: string;
  }
) {
  if (!customerProfileId) {
    return { events: [], nextCursor: null, hasMore: false };
  }

  const limitVal = Math.min(Math.max(options.limit || 25, 1), 100);

  let query: any = adminDb
    .collection("customer_security_events")
    .where("customer_profile_id", "==", customerProfileId);

  if (options.event_type) {
    query = query.where("event_type", "==", options.event_type);
  }
  if (options.auth_method) {
    query = query.where("auth_method", "==", options.auth_method);
  }
  if (options.outcome) {
    query = query.where("outcome", "==", options.outcome);
  }
  if (options.risk_level) {
    query = query.where("risk_level", "==", options.risk_level);
  }

  query = query.orderBy("created_at", "desc");

  if (options.cursor) {
    try {
      const decoded = decodeCursor(options.cursor);
      if (decoded && decoded.lastValue) {
        query = query.startAfter(decoded.lastValue);
      }
    } catch (e) {
      // Ignore cursor error
    }
  }

  const fetchLimit = limitVal + 1;
  query = query.limit(fetchLimit);

  const snap = await query.get();
  let docs = snap.docs || [];

  if (options.date_from) {
    docs = docs.filter((d: any) => (d.data().created_at || "") >= options.date_from!);
  }
  if (options.date_to) {
    docs = docs.filter((d: any) => (d.data().created_at || "") <= options.date_to!);
  }

  const hasMore = docs.length > limitVal;
  const pageDocs = docs.slice(0, limitVal);

  const events = pageDocs.map((d: any) => {
    const data = d.data() as CustomerSecurityEventDoc;
    return {
      event_id: data.event_id || d.id,
      event_type: data.event_type,
      auth_method: data.auth_method,
      outcome: data.outcome,
      reason: data.reason || null,
      device_name: data.device_name,
      browser: data.browser,
      operating_system: data.operating_system,
      device_type: data.device_type,
      ip_masked: data.ip_masked,
      approximate_location: data.approximate_location,
      created_at: data.created_at,
      risk_level: data.risk_level || "low",
      risk_flags: data.risk_flags || [],
      is_current_session: Boolean(options.currentSessionId && data.session_id === options.currentSessionId),
      request_id: data.request_id || null
    };
  });

  let nextCursor: string | null = null;
  if (hasMore && pageDocs.length > 0) {
    const lastDoc = pageDocs[pageDocs.length - 1];
    const lastItem = lastDoc.data();
    nextCursor = encodeCursor({
      v: 1,
      sortBy: "created_at",
      sortDirection: "desc",
      lastValue: lastItem.created_at,
      lastDocumentId: lastDoc.id
    });
  }

  return {
    events,
    nextCursor,
    hasMore
  };
}

/**
 * Get Customer Security Summary
 */
export async function getCustomerSecuritySummary(
  adminDb: Firestore,
  customerProfileId: string
) {
  if (!customerProfileId) {
    return {
      lastSuccessfulLogin: null,
      lastFailedLogin: null,
      successfulLogins30d: 0,
      failedLogins30d: 0,
      googleLoginCount: 0,
      mobileOtpLoginCount: 0,
      activeSessionsCount: 0,
      revokedSessionsCount: 0,
      suspiciousEventCount: 0,
      highRiskEventCount: 0,
      latestDevice: null,
      latestApproximateLocation: null,
      securityRecommendations: ["Verify your mobile number", "Link a Google account"]
    };
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const eventsSnap = await adminDb
    .collection("customer_security_events")
    .where("customer_profile_id", "==", customerProfileId)
    .orderBy("created_at", "desc")
    .limit(100)
    .get();

  const events = (eventsSnap.docs || []).map((d: any) => d.data() as CustomerSecurityEventDoc);

  const sessionsSnap = await adminDb
    .collection("customer_sessions")
    .where("customer_profile_id", "==", customerProfileId)
    .get();

  let activeSessionsCount = 0;
  let revokedSessionsCount = 0;
  (sessionsSnap.docs || []).forEach((doc: any) => {
    const status = doc.data().status;
    if (status === "active") activeSessionsCount++;
    if (status === "revoked") revokedSessionsCount++;
  });

  let lastSuccessfulLogin: string | null = null;
  let lastFailedLogin: string | null = null;
  let successfulLogins30d = 0;
  let failedLogins30d = 0;
  let googleLoginCount = 0;
  let mobileOtpLoginCount = 0;
  let suspiciousEventCount = 0;
  let highRiskEventCount = 0;
  let latestDevice: string | null = null;
  let latestApproximateLocation: string | null = null;

  events.forEach((ev, idx) => {
    if (idx === 0) {
      latestDevice = ev.device_name || null;
      latestApproximateLocation = ev.approximate_location || null;
    }

    const isSuccess = ev.outcome === "success" && (ev.event_type.includes("success") || ev.event_type === "session_created" || ev.event_type === "mobile_otp_verified");
    const isFailed = ev.outcome === "failed" || ev.outcome === "failure" || ev.event_type.includes("failed");

    if (isSuccess && !lastSuccessfulLogin) {
      lastSuccessfulLogin = ev.created_at;
    }
    if (isFailed && !lastFailedLogin) {
      lastFailedLogin = ev.created_at;
    }

    if (ev.created_at >= thirtyDaysAgo) {
      if (isSuccess) successfulLogins30d++;
      if (isFailed) failedLogins30d++;
    }

    if (ev.auth_method === "google") googleLoginCount++;
    if (ev.auth_method === "mobile_otp") mobileOtpLoginCount++;

    if (ev.event_type === "suspicious_login" || (ev.risk_flags && ev.risk_flags.length > 0)) {
      suspiciousEventCount++;
    }
    if (ev.risk_level === "high" || ev.risk_level === "critical") {
      highRiskEventCount++;
    }
  });

  const recommendations: string[] = [];
  if (mobileOtpLoginCount === 0) {
    recommendations.push("Verify your mobile number");
  }
  if (googleLoginCount === 0) {
    recommendations.push("Link a Google account for faster, safer login");
  }
  if (activeSessionsCount > 2) {
    recommendations.push("Sign out unused devices to keep your account secure");
  }
  if (failedLogins30d > 0) {
    recommendations.push("Review recent failed logins");
  }
  if (suspiciousEventCount > 0) {
    recommendations.push("Review an unfamiliar session or new device activity");
  }
  if (recommendations.length === 0) {
    recommendations.push("Your account security looks good");
  }

  return {
    lastSuccessfulLogin,
    lastFailedLogin,
    successfulLogins30d,
    failedLogins30d,
    googleLoginCount,
    mobileOtpLoginCount,
    activeSessionsCount,
    revokedSessionsCount,
    suspiciousEventCount,
    highRiskEventCount,
    latestDevice,
    latestApproximateLocation,
    securityRecommendations: recommendations
  };
}

/**
 * Generate cryptographically secure random session token
 * Raw token returned to customer: cses_<32 bytes hex>
 */
export function generateRawSessionToken(): string {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  return `cses_${randomBytes}`;
}

/**
 * Create server-side customer session in customer_sessions collection
 */
export async function createCustomerSession(
  adminDb: Firestore,
  params: {
    customer_profile_id: string;
    customer_id?: string;
    auth_method: AuthMethod;
    req?: Request;
    userAgentString?: string;
    clientIp?: string;
    ip?: string;
    is_trusted?: boolean;
    rotated_from_session_id?: string;
    metadata?: Record<string, any>;
  }
): Promise<{ rawToken: string; sessionId: string; sessionDoc: CustomerSessionDoc }> {
  const rawToken = generateRawSessionToken();
  const tokenHash = hashSessionToken(rawToken);

  const docRef = adminDb.collection("customer_sessions").doc();
  const sessionId = docRef.id;

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAtIso = new Date(now + SESSION_ABSOLUTE_EXPIRY_MS).toISOString();
  const idleExpiresAtIso = new Date(now + SESSION_IDLE_EXPIRY_MS).toISOString();

  const uaString = params.userAgentString || (params.req ? params.req.headers["user-agent"] : "");
  const rawIp = params.ip || params.clientIp || (params.req ? extractClientIp(params.req) : "");

  const uaMeta = parseUserAgent(uaString);
  const ipMasked = maskIpAddress(rawIp);
  const ipHash = hashIpAddress(rawIp);

  const sessionDoc: CustomerSessionDoc = {
    session_id: sessionId,
    session_token_hash: tokenHash,
    customer_profile_id: params.customer_profile_id,
    customer_id: params.customer_id || "",
    auth_method: params.auth_method,
    provider: params.auth_method,
    status: "active",
    created_at: nowIso,
    last_activity_at: nowIso,
    expires_at: expiresAtIso,
    idle_expires_at: idleExpiresAtIso,
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
    device_name: uaMeta.device_name,
    device_type: uaMeta.device_type,
    browser: uaMeta.browser,
    operating_system: uaMeta.operating_system,
    user_agent_summary: uaMeta.user_agent_summary,
    ip_hash: ipHash,
    ip_masked: ipMasked,
    country: null, // Approximate location left null if no paid geolocation
    region: null,
    city: null,
    is_trusted: Boolean(params.is_trusted),
    rotated_from_session_id: params.rotated_from_session_id || null,
    metadata: params.metadata || {}
  };

  const cleanSessionDoc = JSON.parse(JSON.stringify(sessionDoc));
  await docRef.set(cleanSessionDoc);

  // Run suspicious login risk detection
  const suspiciousCheck = await detectSuspiciousLogin(
    adminDb,
    params.customer_profile_id,
    params.req,
    params.auth_method
  );

  // Record audit security event asynchronously with risk metadata
  recordCustomerSecurityEvent(adminDb, {
    customer_profile_id: params.customer_profile_id,
    customer_id: params.customer_id,
    event_type: params.rotated_from_session_id ? "token_rotated" : "session_created",
    session_id: sessionId,
    auth_method: params.auth_method,
    device_name: uaMeta.device_name,
    browser: uaMeta.browser,
    operating_system: uaMeta.operating_system,
    device_type: uaMeta.device_type,
    ip_masked: ipMasked,
    outcome: "success",
    risk_level: suspiciousCheck.riskLevel,
    risk_flags: suspiciousCheck.riskFlags,
    req: params.req
  }).catch((err) => console.warn("[SESSION MANAGEMENT] Error recording security event:", err));

  // If suspicious risk flags were detected, also record suspicious_login event
  if (suspiciousCheck.riskFlags.length > 0) {
    recordCustomerSecurityEvent(adminDb, {
      customer_profile_id: params.customer_profile_id,
      customer_id: params.customer_id,
      event_type: "suspicious_login",
      session_id: sessionId,
      auth_method: params.auth_method,
      device_name: uaMeta.device_name,
      browser: uaMeta.browser,
      operating_system: uaMeta.operating_system,
      device_type: uaMeta.device_type,
      ip_masked: ipMasked,
      outcome: "warning",
      reason: `Suspicious login flags detected: ${suspiciousCheck.riskFlags.join(", ")}`,
      risk_level: suspiciousCheck.riskLevel,
      risk_flags: suspiciousCheck.riskFlags,
      req: params.req
    }).catch(() => {});
  }

  return { rawToken, sessionId, sessionDoc };
}

/**
 * Validate customer session token against Firestore customer_sessions
 */
export async function validateCustomerSession(
  adminDb: Firestore,
  rawToken: string,
  options: { updateActivity?: boolean } = { updateActivity: true }
): Promise<{
  valid: boolean;
  session?: CustomerSessionDoc;
  profileId?: string;
  reason?: string;
  error?: string;
}> {
  if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
    return { valid: false, reason: "MISSING_TOKEN" };
  }

  const tokenHash = hashSessionToken(rawToken.trim());
  if (!tokenHash) {
    return { valid: false, reason: "INVALID_TOKEN_FORMAT" };
  }

  const snap = await adminDb
    .collection("customer_sessions")
    .where("session_token_hash", "==", tokenHash)
    .limit(1)
    .get();

  if (snap.empty) {
    return { valid: false, reason: "INVALID_SESSION_TOKEN", error: "INVALID_SESSION_TOKEN" };
  }

  const docSnap = snap.docs[0];
  const sessionData = docSnap.data() as CustomerSessionDoc;
  const now = Date.now();

  // 1. Check status
  if (sessionData.status !== "active") {
    const r = `SESSION_${sessionData.status.toUpperCase()}`;
    return { valid: false, session: sessionData, reason: r, error: r };
  }

  // 2. Check Absolute Expiry
  const expiresAtMs = new Date(sessionData.expires_at).getTime();
  if (isNaN(expiresAtMs) || now > expiresAtMs) {
    // Mark as expired asynchronously
    docSnap.ref.update({ status: "expired" }).catch(() => {});
    return { valid: false, session: sessionData, reason: "SESSION_EXPIRED", error: "SESSION_EXPIRED" };
  }

  // 3. Check Idle Expiry
  const idleExpiresAtMs = new Date(sessionData.idle_expires_at).getTime();
  if (isNaN(idleExpiresAtMs) || now > idleExpiresAtMs) {
    docSnap.ref.update({ status: "expired" }).catch(() => {});
    return { valid: false, session: sessionData, reason: "SESSION_IDLE_TIMEOUT", error: "SESSION_IDLE_TIMEOUT" };
  }

  // 4. Update last_activity_at & idle_expires_at with 15-min throttle
  if (options.updateActivity) {
    const lastActivityMs = new Date(sessionData.last_activity_at).getTime();
    if (isNaN(lastActivityMs) || now - lastActivityMs >= ACTIVITY_THROTTLE_MS) {
      const nowIso = new Date(now).toISOString();
      const newIdleExpiresAtIso = new Date(now + SESSION_IDLE_EXPIRY_MS).toISOString();

      docSnap.ref
        .update({
          last_activity_at: nowIso,
          idle_expires_at: newIdleExpiresAtIso
        })
        .catch(() => {});

      sessionData.last_activity_at = nowIso;
      sessionData.idle_expires_at = newIdleExpiresAtIso;
    }
  }

  return {
    valid: true,
    session: sessionData,
    profileId: sessionData.customer_profile_id
  };
}

/**
 * Revoke a single customer session
 */
export async function revokeCustomerSession(
  adminDb: Firestore,
  sessionId: string,
  revokedBy: string = "customer",
  reason: string = "user_logout",
  profileIdForAuthCheck?: string
): Promise<{ success: boolean; error?: string; sessionDoc?: CustomerSessionDoc }> {
  if (!sessionId) {
    return { success: false, error: "Session ID is required." };
  }

  const docRef = adminDb.collection("customer_sessions").doc(sessionId);
  const snap = await docRef.get();

  if (!snap.exists) {
    // Idempotent success response if not found
    return { success: true };
  }

  const sessionData = snap.data() as CustomerSessionDoc;

  // Authorization check: Customer can only revoke their own session
  if (profileIdForAuthCheck && sessionData.customer_profile_id !== profileIdForAuthCheck) {
    return { success: false, error: "Unauthorized session revocation." };
  }

  if (sessionData.status === "revoked") {
    // Already revoked - idempotent success
    return { success: true, sessionDoc: sessionData };
  }

  const nowIso = new Date().toISOString();
  await docRef.update({
    status: "revoked",
    revoked_at: nowIso,
    revoked_by: revokedBy,
    revoke_reason: reason
  });

  // Record security event
  recordCustomerSecurityEvent(adminDb, {
    customer_profile_id: sessionData.customer_profile_id,
    customer_id: sessionData.customer_id,
    event_type: "session_revoked",
    session_id: sessionId,
    auth_method: sessionData.auth_method,
    device_name: sessionData.device_name,
    ip_masked: sessionData.ip_masked,
    reason
  }).catch(() => {});

  return { success: true, sessionDoc: { ...sessionData, status: "revoked", revoked_at: nowIso } };
}

/**
 * Revoke all customer sessions for a profile
 */
export async function revokeAllCustomerSessions(
  adminDb: Firestore,
  profileId: string,
  options: { keepCurrentSessionId?: string; revokedBy?: string; reason?: string } = {}
): Promise<{ success: boolean; revokedCount: number }> {
  if (!profileId) {
    return { success: false, revokedCount: 0 };
  }

  const snap = await adminDb
    .collection("customer_sessions")
    .where("customer_profile_id", "==", profileId)
    .where("status", "==", "active")
    .get();

  if (snap.empty) {
    return { success: true, revokedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  let count = 0;
  const batch = adminDb.batch();

  for (const docSnap of snap.docs) {
    if (options.keepCurrentSessionId && docSnap.id === options.keepCurrentSessionId) {
      continue;
    }

    batch.update(docSnap.ref, {
      status: "revoked",
      revoked_at: nowIso,
      revoked_by: options.revokedBy || "customer",
      revoke_reason: options.reason || "revoke_all_sessions"
    });
    count++;
  }

  if (count > 0) {
    await batch.commit();

    // Log security event
    recordCustomerSecurityEvent(adminDb, {
      customer_profile_id: profileId,
      event_type: "logout_all",
      session_id: options.keepCurrentSessionId || "bulk_revoke",
      auth_method: "mobile_otp",
      device_name: "All Devices",
      ip_masked: "xxx.xxx.xxx.xxx",
      reason: options.reason || "logout_all"
    }).catch(() => {});
  }

  return { success: true, revokedCount: count };
}

/**
 * Rotate Session Token
 */
export async function rotateCustomerSession(
  adminDb: Firestore,
  currentRawToken: string,
  req?: Request
): Promise<{ success: boolean; newRawToken?: string; newSessionId?: string; error?: string }> {
  const valResult = await validateCustomerSession(adminDb, currentRawToken, { updateActivity: false });

  if (!valResult.valid || !valResult.session) {
    return { success: false, error: "Current session is invalid or expired." };
  }

  const oldSession = valResult.session;

  // Revoke old session
  await revokeCustomerSession(adminDb, oldSession.session_id, "system", "session_token_rotation");

  // Create new session
  const { rawToken, sessionId } = await createCustomerSession(adminDb, {
    customer_profile_id: oldSession.customer_profile_id,
    customer_id: oldSession.customer_id,
    auth_method: oldSession.auth_method,
    req,
    userAgentString: oldSession.user_agent_summary,
    is_trusted: oldSession.is_trusted,
    rotated_from_session_id: oldSession.session_id
  });

  // Record rotation event
  await recordCustomerSecurityEvent(adminDb, {
    customer_profile_id: oldSession.customer_profile_id,
    event_type: "session_rotated",
    session_id: sessionId,
    auth_method: oldSession.auth_method,
    device_name: oldSession.device_name,
    ip_masked: oldSession.ip_masked,
    outcome: "success"
  });

  return { success: true, newRawToken: rawToken, newSessionId: sessionId };
}

/**
 * List Customer Sessions for authenticated customer UI
 */
export async function listCustomerSessions(
  adminDb: Firestore,
  profileId: string,
  currentSessionId?: string
): Promise<Array<Omit<CustomerSessionDoc, "session_token_hash" | "ip_hash">>> {
  if (!profileId) return [];

  const snap = await adminDb
    .collection("customer_sessions")
    .where("customer_profile_id", "==", profileId)
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  const sessions: any[] = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data() as CustomerSessionDoc;

    // Filter sensitive hashes out
    const { session_token_hash, ip_hash, ...safeSession } = data;

    safeSession.is_current = currentSessionId ? docSnap.id === currentSessionId : false;
    sessions.push(safeSession);
  });

  return sessions;
}

/**
 * Admin CRM Session Summary (Exposes safe metadata only)
 */
export async function getAdminCustomerSessionSummary(
  adminDb: Firestore,
  profileId: string
): Promise<{
  total_sessions_count: number;
  active_sessions_count: number;
  revoked_sessions_count: number;
  mobile_otp_sessions_count: number;
  google_sessions_count: number;
  last_login_at: string | null;
  last_device: string | null;
  last_approximate_location: string | null;
  recent_sessions: any[];
  recent_security_events: any[];
}> {
  if (!profileId) {
    return {
      total_sessions_count: 0,
      active_sessions_count: 0,
      revoked_sessions_count: 0,
      mobile_otp_sessions_count: 0,
      google_sessions_count: 0,
      last_login_at: null,
      last_device: null,
      last_approximate_location: null,
      recent_sessions: [],
      recent_security_events: []
    };
  }

  const snap = await adminDb
    .collection("customer_sessions")
    .where("customer_profile_id", "==", profileId)
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  let activeCount = 0;
  let revokedCount = 0;
  let mobileCount = 0;
  let googleCount = 0;
  let lastLoginAt: string | null = null;
  let lastDevice: string | null = null;
  let lastLocation: string | null = null;

  const recentSessions: any[] = [];

  snap.docs.forEach((docSnap, index) => {
    const data = docSnap.data() as CustomerSessionDoc;

    if (data.status === "active") activeCount++;
    if (data.status === "revoked") revokedCount++;
    if (data.auth_method === "mobile_otp") mobileCount++;
    if (data.auth_method === "google") googleCount++;

    if (index === 0) {
      lastLoginAt = data.created_at;
      lastDevice = data.device_name;
      lastLocation = [data.city, data.region, data.country].filter(Boolean).join(", ") || "Approximate location";
    }

    recentSessions.push({
      session_id: data.session_id,
      device_name: data.device_name,
      browser: data.browser,
      operating_system: data.operating_system,
      auth_method: data.auth_method,
      status: data.status,
      created_at: data.created_at,
      last_activity_at: data.last_activity_at,
      ip_masked: data.ip_masked
    });
  });

  return {
    total_sessions_count: recentSessions.length,
    active_sessions_count: activeCount,
    revoked_sessions_count: revokedCount,
    mobile_otp_sessions_count: mobileCount,
    google_sessions_count: googleCount,
    last_login_at: lastLoginAt,
    last_device: lastDevice,
    last_approximate_location: lastLocation,
    recent_sessions: recentSessions,
    recent_security_events: []
  };
}
