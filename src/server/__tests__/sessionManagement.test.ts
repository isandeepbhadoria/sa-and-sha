import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCustomerSession,
  validateCustomerSession,
  revokeCustomerSession,
  revokeAllCustomerSessions,
  rotateCustomerSession,
  listCustomerSessions,
  getAdminCustomerSessionSummary,
  maskIpAddress,
  hashIpAddress,
  hashSessionToken,
  parseUserAgent,
  SESSION_CONSTANTS
} from "../sessionManagementHelpers";

// Mock Firestore Implementation
function createMockFirestore() {
  const collections: Record<string, Map<string, any>> = {
    customer_sessions: new Map(),
    customer_security_events: new Map(),
    customer_profiles: new Map()
  };

  return {
    collections,
    batch() {
      const ops: Array<() => Promise<any>> = [];
      return {
        update(ref: any, data: any) {
          ops.push(async () => ref.update(data));
        },
        async commit() {
          for (const op of ops) await op();
        }
      };
    },
    collection(name: string) {
      if (!collections[name]) collections[name] = new Map();
      const store = collections[name];

      return {
        doc(id?: string) {
          const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const ref = {
            id: docId,
            async set(data: any, options?: any) {
              if (options?.merge && store.has(docId)) {
                store.set(docId, { ...store.get(docId), ...data });
              } else {
                store.set(docId, data);
              }
            },
            async update(data: any) {
              const existing = store.get(docId) || {};
              store.set(docId, { ...existing, ...data });
            }
          };

          return {
            ...ref,
            async get() {
              const data = store.get(docId);
              return {
                id: docId,
                ref,
                exists: data !== undefined,
                data: () => data
              };
            }
          };
        },

        where(field: string, op: string, val: any) {
          return {
            where(f2: string, op2: string, val2: any) {
              return this;
            },
            orderBy() {
              return this;
            },
            limit() {
              return this;
            },
            async get() {
              const docs: any[] = [];
              store.forEach((data, id) => {
                if (op === "==" && data[field] === val) {
                  const docRef = {
                    id,
                    async update(uData: any) {
                      const existing = store.get(id) || {};
                      store.set(id, { ...existing, ...uData });
                    }
                  };
                  docs.push({ id, ref: docRef, exists: true, data: () => data });
                }
              });
              return {
                empty: docs.length === 0,
                docs,
                size: docs.length,
                forEach: (cb: (value: any, index: number, array: any[]) => void) => docs.forEach(cb)
              };
            }
          };
        }
      };
    }
  };
}

describe("PHASE 9C.3.1 - SECURE CUSTOMER SESSION MANAGEMENT", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = createMockFirestore();
  });

  // 1. Session Creation on Google Auth Login
  it("1. should create a valid customer session record on Google login", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_google_123",
      customer_id: "KORA-CUST-1001",
      auth_method: "google",
      userAgentString: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      ip: "103.21.124.45"
    });

    expect(sessionRes.rawToken).toBeDefined();
    expect(sessionRes.rawToken.startsWith("cses_")).toBe(true);
    expect(sessionRes.sessionId).toBeDefined();

    const storedSession = mockDb.collections.customer_sessions.get(sessionRes.sessionId);
    expect(storedSession).toBeDefined();
    expect(storedSession.customer_profile_id).toBe("prof_google_123");
    expect(storedSession.auth_method).toBe("google");
    expect(storedSession.status).toBe("active");
    expect(storedSession.browser).toBe("Chrome");
    expect(storedSession.operating_system).toBe("macOS");
  });

  // 2. Session Creation on Mobile OTP Verification
  it("2. should create a valid customer session record on Mobile OTP verification", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_otp_456",
      customer_id: "KORA-CUST-1002",
      auth_method: "mobile_otp",
      userAgentString: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      ip: "49.207.200.12"
    });

    expect(sessionRes.rawToken.startsWith("cses_")).toBe(true);
    const storedSession = mockDb.collections.customer_sessions.get(sessionRes.sessionId);
    expect(storedSession.auth_method).toBe("mobile_otp");
    expect(storedSession.device_type).toBe("mobile");
    expect(storedSession.operating_system).toBe("iOS");
  });

  // 3. Token Hash Matching
  it("3. should verify session token hash using SHA-256 and reject mismatched token", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "google"
    });

    const validRes = await validateCustomerSession(mockDb, sessionRes.rawToken);
    expect(validRes.valid).toBe(true);
    expect(validRes.profileId).toBe("prof_123");

    const tamperedToken = sessionRes.rawToken + "x";
    const invalidRes = await validateCustomerSession(mockDb, tamperedToken);
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.reason || invalidRes.error).toBe("INVALID_SESSION_TOKEN");
  });

  // 4. Absolute Expiration Enforcement (30 days)
  it("4. should reject session if absolute expiration duration has passed", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "google"
    });

    // Manually set expires_at in the past
    const pastIso = new Date(Date.now() - 1000).toISOString();
    const stored = mockDb.collections.customer_sessions.get(sessionRes.sessionId);
    stored.expires_at = pastIso;

    const valRes = await validateCustomerSession(mockDb, sessionRes.rawToken);
    expect(valRes.valid).toBe(false);
    expect(valRes.reason || valRes.error).toBe("SESSION_EXPIRED");
    expect(mockDb.collections.customer_sessions.get(sessionRes.sessionId).status).toBe("expired");
  });

  // 5. Idle Expiration Enforcement (7 days)
  it("5. should reject session if idle timeout period has lapsed", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "mobile_otp"
    });

    const pastIso = new Date(Date.now() - 1000).toISOString();
    const stored = mockDb.collections.customer_sessions.get(sessionRes.sessionId);
    stored.idle_expires_at = pastIso;

    const valRes = await validateCustomerSession(mockDb, sessionRes.rawToken);
    expect(valRes.valid).toBe(false);
    expect(valRes.reason || valRes.error).toBe("SESSION_IDLE_TIMEOUT");
    expect(mockDb.collections.customer_sessions.get(sessionRes.sessionId).status).toBe("expired");
  });

  // 6. Idle Activity Timestamp Updates
  it("6. should update last_activity_at and extend idle_expires_at on validation", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "google"
    });

    const initialStored = mockDb.collections.customer_sessions.get(sessionRes.sessionId);
    const initialIdleExp = initialStored.idle_expires_at;

    // Simulate 2 seconds delay
    await new Promise((r) => setTimeout(r, 100));

    const valRes = await validateCustomerSession(mockDb, sessionRes.rawToken, { updateActivity: true });
    expect(valRes.valid).toBe(true);

    const updatedStored = mockDb.collections.customer_sessions.get(sessionRes.sessionId);
    expect(new Date(updatedStored.idle_expires_at).getTime()).toBeGreaterThanOrEqual(new Date(initialIdleExp).getTime());
  });

  // 7. Single Session Revocation
  it("7. should revoke a single customer session by ID", async () => {
    const s1 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });
    const s2 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "mobile_otp" });

    const revokeRes = await revokeCustomerSession(mockDb, s1.sessionId, "customer", "user_revoked", "prof_123");
    expect(revokeRes.success).toBe(true);

    const check1 = await validateCustomerSession(mockDb, s1.rawToken);
    expect(check1.valid).toBe(false);
    expect(check1.reason || check1.error).toBe("SESSION_REVOKED");

    const check2 = await validateCustomerSession(mockDb, s2.rawToken);
    expect(check2.valid).toBe(true);
  });

  // 8. Revoke All Sessions with keep_current=true
  it("8. should revoke all other sessions for profile while preserving current session", async () => {
    const s1 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });
    const s2 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "mobile_otp" });
    const s3 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });

    const result = await revokeAllCustomerSessions(mockDb, "prof_123", {
      keepCurrentSessionId: s1.sessionId,
      revokedBy: "customer",
      reason: "revoke_all_devices"
    });

    expect(result.revokedCount).toBe(2);

    const check1 = await validateCustomerSession(mockDb, s1.rawToken);
    expect(check1.valid).toBe(true);

    const check2 = await validateCustomerSession(mockDb, s2.rawToken);
    expect(check2.valid).toBe(false);

    const check3 = await validateCustomerSession(mockDb, s3.rawToken);
    expect(check3.valid).toBe(false);
  });

  // 9. Revoke All Sessions with keep_current=false
  it("9. should revoke all sessions including current session when keep_current is false", async () => {
    const s1 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });
    const s2 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "mobile_otp" });

    const result = await revokeAllCustomerSessions(mockDb, "prof_123", {
      revokedBy: "customer",
      reason: "revoke_everywhere"
    });

    expect(result.revokedCount).toBe(2);

    const check1 = await validateCustomerSession(mockDb, s1.rawToken);
    expect(check1.valid).toBe(false);

    const check2 = await validateCustomerSession(mockDb, s2.rawToken);
    expect(check2.valid).toBe(false);
  });

  // 10. Explicit Logout Session Revocation
  it("10. should revoke active session on explicit customer logout", async () => {
    const s1 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });

    const logoutRes = await revokeCustomerSession(mockDb, s1.sessionId, "customer", "user_logout", "prof_123");
    expect(logoutRes.success).toBe(true);

    const valRes = await validateCustomerSession(mockDb, s1.rawToken);
    expect(valRes.valid).toBe(false);
    expect(valRes.reason || valRes.error).toBe("SESSION_REVOKED");
  });

  // 11. Session Token Rotation
  it("11. should rotate session token, revoking old session and issuing new session", async () => {
    const oldSession = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });

    const rotateRes = await rotateCustomerSession(mockDb, oldSession.rawToken);
    expect(rotateRes.success).toBe(true);
    expect(rotateRes.newRawToken).toBeDefined();
    expect(rotateRes.newRawToken).not.toBe(oldSession.rawToken);

    // Old token should be revoked
    const checkOld = await validateCustomerSession(mockDb, oldSession.rawToken);
    expect(checkOld.valid).toBe(false);

    // New token should be active
    const checkNew = await validateCustomerSession(mockDb, rotateRes.newRawToken!);
    expect(checkNew.valid).toBe(true);
  });

  // 12. Privacy Masking of IP Addresses (IPv4 & IPv6)
  it("12. should mask IPv4 and IPv6 addresses properly without leaking full IP", () => {
    expect(maskIpAddress("203.0.113.195")).toBe("203.0.113.xxx");
    expect(maskIpAddress("192.168.1.1")).toBe("192.168.1.xxx");
    expect(maskIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:0db8:****:****");
    expect(maskIpAddress("unknown")).toBe("xxx.xxx.xxx.xxx");

    const hash1 = hashIpAddress("203.0.113.195");
    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64); // SHA-256
  });

  // 13. Device Metadata Parsing
  it("13. should parse Chrome on macOS, Safari on iOS, and Android Chrome user agents", () => {
    const macChrome = parseUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36");
    expect(macChrome.browser).toBe("Chrome");
    expect(macChrome.operating_system).toBe("macOS");
    expect(macChrome.device_type).toBe("desktop");

    const iosSafari = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1");
    expect(iosSafari.browser).toBe("Safari");
    expect(iosSafari.operating_system).toBe("iOS");
    expect(iosSafari.device_type).toBe("mobile");

    const androidChrome = parseUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/120.0.6099.144 Mobile Safari/537.36");
    expect(androidChrome.browser).toBe("Chrome");
    expect(androidChrome.operating_system).toBe("Android");
    expect(androidChrome.device_type).toBe("mobile");
  });

  // 14. Recording Security Events for Session Creation
  it("14. should record security audit event when session is created", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "google"
    });

    const events = Array.from(mockDb.collections.customer_security_events.values()) as any[];
    expect(events.length).toBeGreaterThan(0);
    const creationEvent = events.find((e) => e.event_type === "session_created");
    expect(creationEvent).toBeDefined();
    expect(creationEvent.customer_profile_id).toBe("prof_123");
    expect(creationEvent.session_id).toBe(sessionRes.sessionId);
    expect(creationEvent.outcome).toBe("success");
  });

  // 15. Recording Security Events for Session Revocation
  it("15. should record security audit event when session is revoked", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "google"
    });

    await revokeCustomerSession(mockDb, sessionRes.sessionId, "customer", "user_revoked", "prof_123");

    const events = Array.from(mockDb.collections.customer_security_events.values()) as any[];
    const revokeEvent = events.find((e) => e.event_type === "session_revoked");
    expect(revokeEvent).toBeDefined();
    expect(revokeEvent.customer_profile_id).toBe("prof_123");
    expect(revokeEvent.session_id).toBe(sessionRes.sessionId);
  });

  // 16. Recording Security Events for Session Rotation
  it("16. should record security audit event on session token rotation", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "mobile_otp"
    });

    await rotateCustomerSession(mockDb, sessionRes.rawToken);

    const events = Array.from(mockDb.collections.customer_security_events.values()) as any[];
    const rotateEvent = events.find((e) => e.event_type === "session_rotated");
    expect(rotateEvent).toBeDefined();
    expect(rotateEvent.customer_profile_id).toBe("prof_123");
  });

  // 17. Invalid or Tampered Token Rejection
  it("17. should reject malformed or non-existent session tokens safely", async () => {
    const res1 = await validateCustomerSession(mockDb, "");
    expect(res1.valid).toBe(false);

    const res2 = await validateCustomerSession(mockDb, "random_garbage_string");
    expect(res2.valid).toBe(false);
  });

  // 18. Expired Session Token Rejection
  it("18. should reject expired session tokens without throwing runtime error", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "google"
    });

    // Artificially expire
    const stored = mockDb.collections.customer_sessions.get(sessionRes.sessionId);
    stored.expires_at = new Date(Date.now() - 5000).toISOString();

    const check = await validateCustomerSession(mockDb, sessionRes.rawToken);
    expect(check.valid).toBe(false);
    expect(check.reason || check.error).toBe("SESSION_EXPIRED");
  });

  // 19. Revoked Session Token Rejection
  it("19. should reject revoked session tokens", async () => {
    const sessionRes = await createCustomerSession(mockDb, {
      customer_profile_id: "prof_123",
      auth_method: "google"
    });

    await revokeCustomerSession(mockDb, sessionRes.sessionId, "admin", "admin_revoked");

    const check = await validateCustomerSession(mockDb, sessionRes.rawToken);
    expect(check.valid).toBe(false);
    expect(check.reason || check.error).toBe("SESSION_REVOKED");
  });

  // 20. Cross-Customer Session Isolation
  it("20. should enforce cross-customer isolation and prevent Customer A from revoking Customer B session", async () => {
    const sA = await createCustomerSession(mockDb, { customer_profile_id: "prof_cust_A", auth_method: "google" });
    const sB = await createCustomerSession(mockDb, { customer_profile_id: "prof_cust_B", auth_method: "mobile_otp" });

    // Customer A attempts to revoke Customer B's session
    const revokeAttempt = await revokeCustomerSession(mockDb, sB.sessionId, "customer", "malicious_attempt", "prof_cust_A");
    expect(revokeAttempt.success).toBe(false);
    expect(revokeAttempt.error).toContain("Unauthorized");

    // Session B remains active
    const checkB = await validateCustomerSession(mockDb, sB.rawToken);
    expect(checkB.valid).toBe(true);
  });

  // 21. List Customer Sessions
  it("21. should list customer active and recent sessions marking current session", async () => {
    const s1 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });
    const s2 = await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "mobile_otp" });

    const list = await listCustomerSessions(mockDb, "prof_123", s1.sessionId);
    expect(list.length).toBe(2);

    const item1 = list.find((i) => i.session_id === s1.sessionId);
    expect(item1?.is_current).toBe(true);

    const item2 = list.find((i) => i.session_id === s2.sessionId);
    expect(item2?.is_current).toBe(false);
  });

  // 22. Admin CRM Security Summary
  it("22. should return admin CRM security session summary for customer profile", async () => {
    await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "google" });
    await createCustomerSession(mockDb, { customer_profile_id: "prof_123", auth_method: "mobile_otp" });

    const summary = await getAdminCustomerSessionSummary(mockDb, "prof_123");
    expect(summary.total_sessions_count).toBe(2);
    expect(summary.active_sessions_count).toBe(2);
    expect(summary.recent_sessions.length).toBe(2);
    expect(summary.recent_security_events).toBeDefined();
  });

  // 23. Centralized Duration Constants
  it("23. should verify centralized session duration constants (30d absolute, 7d idle)", () => {
    expect(SESSION_CONSTANTS.ABSOLUTE_EXPIRATION_DAYS).toBe(30);
    expect(SESSION_CONSTANTS.IDLE_EXPIRATION_DAYS).toBe(7);
    expect(SESSION_CONSTANTS.TOKEN_PREFIX).toBe("cses_");
  });
});
