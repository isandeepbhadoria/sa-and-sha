import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkCustomerLoginEligibility } from "../loginEligibilityHelpers";
import { handleGoogleAuthToken } from "../googleAuthHelpers";
import { assertNewCustomerCreationAllowed } from "../registrationHelpers";

describe("PHASE 10 — Customer Account Architecture Refactor Test Suite", () => {
  let mockDb: any;
  let mockAuth: any;
  let collections: Record<string, Map<string, any>>;

  beforeEach(() => {
    vi.clearAllMocks();
    collections = {
      customer_profiles: new Map(),
      customer_sessions: new Map(),
      customer_registration_tokens: new Map(),
      auth_identities: new Map(),
      identity_conflicts: new Map()
    };

    mockDb = {
      collection: (colName: string) => {
        if (!collections[colName]) {
          collections[colName] = new Map();
        }
        const colMap = collections[colName];

        const queryObj: any = {
          where: () => queryObj,
          orderBy: () => queryObj,
          limit: () => ({
            get: async () => {
              const matches: any[] = [];
              for (const [id, doc] of colMap.entries()) {
                matches.push({ id, data: () => doc });
              }
              return { empty: matches.length === 0, docs: matches };
            }
          }),
          get: async () => {
            const matches: any[] = [];
            for (const [id, doc] of colMap.entries()) {
              matches.push({ id, data: () => doc });
            }
            return { empty: matches.length === 0, docs: matches };
          }
        };

        return {
          doc: (docId: string) => ({
            get: async () => ({
              exists: colMap.has(docId),
              id: docId,
              data: () => colMap.get(docId)
            }),
            set: async (data: any, opts?: any) => {
              if (opts?.merge && colMap.has(docId)) {
                colMap.set(docId, { ...colMap.get(docId), ...data });
              } else {
                colMap.set(docId, data);
              }
            }
          }),
          where: () => queryObj,
          orderBy: () => queryObj,
          limit: () => queryObj
        };
      }
    };

    mockAuth = {
      verifyIdToken: vi.fn()
    };
  });

  it("1. Login Eligibility returns ACCOUNT_NOT_FOUND (eligible=false) for unknown Mobile number", async () => {
    const res = await checkCustomerLoginEligibility(mockDb, "mobile", "919876543210");
    expect(res.success).toBe(true);
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("ACCOUNT_NOT_FOUND");
    expect(res.loginChallenge).toBeUndefined();
  });

  it("2. Login Eligibility returns ACCOUNT_NOT_FOUND (eligible=false) for unknown Email address", async () => {
    const res = await checkCustomerLoginEligibility(mockDb, "email", "newuser@example.com");
    expect(res.success).toBe(true);
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("ACCOUNT_NOT_FOUND");
    expect(res.loginChallenge).toBeUndefined();
  });

  it("3. Google Sign-In returns ACCOUNT_NOT_FOUND (404) with registration prefill data for unknown Google account", async () => {
    mockAuth.verifyIdToken.mockResolvedValue({
      uid: "google_uid_phase10_test",
      email: "newgoogleuser@example.com",
      email_verified: true,
      name: "Ananya Sen",
      picture: "https://lh3.googleusercontent.com/photo.jpg"
    });

    const res = await handleGoogleAuthToken(mockDb, mockAuth, "valid_token_123", { ip: "127.0.0.1" });
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(404);
    expect(res.code).toBe("ACCOUNT_NOT_FOUND");
    expect(res.registration_required).toBe(true);
    expect(res.registration_token).toMatch(/^g_reg\./);
    expect(res.verified_email).toBe("newgoogleuser@example.com");
    expect(res.suggested_first_name).toBe("Ananya");
    expect(res.suggested_last_name).toBe("Sen");

    // Zero profiles or sessions should be created
    expect(collections.customer_profiles.size).toBe(0);
    expect(collections.customer_sessions.size).toBe(0);
  });

  it("4. Permanent Invariant: Registration fails if mobile number is missing or unverified", async () => {
    // Missing mobile number
    expect(() => assertNewCustomerCreationAllowed({
      normalizedPhone: "",
      mobileVerified: false,
      verificationSource: ""
    })).toThrow("Mobile number verification via MSG91 OTP is mandatory");

    // Unverified mobile
    expect(() => assertNewCustomerCreationAllowed({
      normalizedPhone: "919876543210",
      mobileVerified: false,
      verificationSource: "msg91_mobile_otp"
    })).toThrow("Mobile number verification via MSG91 OTP is mandatory");

    // Wrong verification source
    expect(() => assertNewCustomerCreationAllowed({
      normalizedPhone: "919876543210",
      mobileVerified: true,
      verificationSource: "email_otp"
    })).toThrow("Mobile number verification via MSG91 OTP is mandatory");

    // Correct Mobile verification invariant pass
    expect(() => assertNewCustomerCreationAllowed({
      normalizedPhone: "919876543210",
      mobileVerified: true,
      verificationSource: "msg91_mobile_otp"
    })).not.toThrow();
  });
});
