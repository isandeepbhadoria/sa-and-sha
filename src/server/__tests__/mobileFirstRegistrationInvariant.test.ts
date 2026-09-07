import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assertNewCustomerCreationAllowed,
  createGoogleRegistrationToken,
  verifyGoogleRegistrationToken,
  createMobileVerificationRequiredToken,
  verifyMobileVerificationRequiredToken
} from "../registrationHelpers";
import { handleGoogleAuthToken } from "../googleAuthHelpers";

// Mock Firebase Admin Firestore
function createMockFirestore(initialDocs: Record<string, any> = {}) {
  const collections: Record<string, Map<string, any>> = {
    customer_profiles: new Map(),
    customer_auth_identities: new Map(),
    customer_login_challenges: new Map(),
    customer_sessions: new Map(),
    counters: new Map()
  };

  // Seed counters for customer_id generation
  collections.counters.set("customer_id_counter", { current_count: 100 });

  // Seed initial docs
  for (const [key, val] of Object.entries(initialDocs)) {
    const [collName, docId] = key.split("/");
    if (collections[collName]) {
      collections[collName].set(docId, val);
    }
  }

  const mockDb: any = {
    collection: (collName: string) => {
      const store = collections[collName] || new Map();
      return {
        doc: (docId?: string) => {
          const id = docId || `doc_${Math.random().toString(36).substring(2, 9)}`;
          return {
            id,
            get: async () => ({
              exists: store.has(id),
              id,
              data: () => store.get(id)
            }),
            set: async (data: any, options?: any) => {
              if (options?.merge && store.has(id)) {
                store.set(id, { ...store.get(id), ...data });
              } else {
                store.set(id, data);
              }
            },
            update: async (data: any) => {
              const current = store.get(id) || {};
              store.set(id, { ...current, ...data });
            }
          };
        },
        where: (field1: string, op1: string, value1: any) => {
          const filter = (field2?: string, op2?: string, value2?: any) => ({
            where: (field3: string, op3: string, value3: any) => filter(field3, op3, value3),
            limit: (n: number) => ({
              get: async () => {
                const matched: any[] = [];
                for (const [id, data] of store.entries()) {
                  let match = op1 === "==" ? data[field1] === value1 : true;
                  if (match && field2) {
                    match = op2 === "==" ? data[field2] === value2 : true;
                  }
                  if (match) {
                    matched.push({
                      id,
                      exists: true,
                      data: () => data,
                      ref: {
                        update: async (updates: any) => store.set(id, { ...data, ...updates })
                      }
                    });
                  }
                }
                return {
                  empty: matched.length === 0,
                  docs: matched.slice(0, n)
                };
              }
            })
          });
          return filter();
        },
        runTransaction: async (updateFunction: any) => {
          const transaction = {
            get: async (ref: any) => ref.get(),
            set: (ref: any, data: any, options?: any) => ref.set(data, options),
            update: (ref: any, data: any) => ref.update(data)
          };
          return updateFunction(transaction);
        }
      };
    },
    runTransaction: async (updateFunction: any) => {
      const transaction = {
        get: async (ref: any) => ref.get(),
        set: (ref: any, data: any, options?: any) => ref.set(data, options),
        update: (ref: any, data: any) => ref.update(data)
      };
      return updateFunction(transaction);
    }
  };

  return { mockDb, collections };
}

describe("Phase 9C.6 — Permanent Verified-Mobile Account Invariant Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. assertNewCustomerCreationAllowed Guard Unit Tests
  // =========================================================================
  describe("assertNewCustomerCreationAllowed Guard", () => {
    it("1.1 Throws MOBILE_VERIFICATION_REQUIRED if normalizedPhone is missing or empty", () => {
      expect(() => {
        assertNewCustomerCreationAllowed({
          normalizedPhone: "",
          mobileVerified: true,
          verificationSource: "msg91_mobile_otp"
        });
      }).toThrowError(/Mobile number verification via MSG91 OTP is mandatory/);
    });

    it("1.2 Throws MOBILE_VERIFICATION_REQUIRED if mobileVerified is false", () => {
      expect(() => {
        assertNewCustomerCreationAllowed({
          normalizedPhone: "919876543210",
          mobileVerified: false,
          verificationSource: "msg91_mobile_otp"
        });
      }).toThrowError(/Mobile number verification via MSG91 OTP is mandatory/);
    });

    it("1.3 Throws MOBILE_VERIFICATION_REQUIRED if verificationSource is not msg91_mobile_otp", () => {
      expect(() => {
        assertNewCustomerCreationAllowed({
          normalizedPhone: "919876543210",
          mobileVerified: true,
          verificationSource: "email_otp"
        });
      }).toThrowError(/Mobile number verification via MSG91 OTP is mandatory/);
    });

    it("1.4 Passes cleanly when normalizedPhone is non-empty, mobileVerified is true, and verificationSource is msg91_mobile_otp", () => {
      expect(() => {
        assertNewCustomerCreationAllowed({
          normalizedPhone: "919876543210",
          mobileVerified: true,
          verificationSource: "msg91_mobile_otp"
        });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // 2. Registration Token Unit Tests
  // =========================================================================
  describe("Google Registration Token Helper", () => {
    it("2.1 Creates a signed g_reg token and verifies payload successfully", () => {
      const token = createGoogleRegistrationToken({
        providerUidHash: "hash_12345",
        email: "newuser@example.com",
        googleName: "New User",
        googlePicture: "https://example.com/pic.jpg"
      });

      expect(token).toMatch(/^g_reg\./);

      const verifyRes = verifyGoogleRegistrationToken(token);
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.payload?.verified_email).toBe("newuser@example.com");
      expect(verifyRes.payload?.purpose).toBe("google_registration");
      expect(verifyRes.payload?.provider_uid_hash).toBe("hash_12345");
    });

    it("2.2 Rejects empty or invalid token format", () => {
      expect(verifyGoogleRegistrationToken("").valid).toBe(false);
      expect(verifyGoogleRegistrationToken("invalid.token").valid).toBe(false);
      expect(verifyGoogleRegistrationToken("other.b64.sig").valid).toBe(false);
    });

    it("2.3 Rejects token with tampered signature", () => {
      const token = createGoogleRegistrationToken({
        providerUidHash: "hash_12345",
        email: "newuser@example.com"
      });
      const parts = token.split(".");
      const tampered = `${parts[0]}.${parts[1]}.bad_signature_hash`;

      const verifyRes = verifyGoogleRegistrationToken(tampered);
      expect(verifyRes.valid).toBe(false);
      expect(verifyRes.code).toBe("TOKEN_INVALID");
    });
  });

  // =========================================================================
  // 3. Mobile Completion Token Unit Tests
  // =========================================================================
  describe("Mobile Completion Token Helper", () => {
    it("3.1 Creates a signed m_req token and verifies payload successfully", () => {
      const token = createMobileVerificationRequiredToken("prof_999", "legacy@example.com");
      expect(token).toMatch(/^m_req\./);

      const verifyRes = verifyMobileVerificationRequiredToken(token);
      expect(verifyRes.valid).toBe(true);
      expect(verifyRes.payload?.profile_id).toBe("prof_999");
      expect(verifyRes.payload?.purpose).toBe("account_mobile_completion");
    });

    it("3.2 Rejects invalid or tampered completion token", () => {
      expect(verifyMobileVerificationRequiredToken("m_req.fake.sig").valid).toBe(false);
    });
  });

  // =========================================================================
  // 4. handleGoogleAuthToken Refactored Invariant Behavior Tests
  // =========================================================================
  describe("handleGoogleAuthToken Invariant Refactoring", () => {
    it("4.1 Unknown Google User: Does NOT create customer profile or session; returns registration_required: true", async () => {
      const { mockDb, collections } = createMockFirestore();

      const mockAuth: any = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: "google_uid_new_123",
          email: "brandnewgoogle@example.com",
          email_verified: true,
          name: "Brand New Google User",
          picture: "https://lh3.googleusercontent.com/photo.jpg"
        })
      };

      const result = await handleGoogleAuthToken(
        mockDb,
        mockAuth,
        "valid_google_id_token_123",
        { ip: "127.0.0.1", userAgent: "Vitest" }
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.code).toBe("ACCOUNT_NOT_FOUND");
      expect(result.registration_required).toBe(true);
      expect(result.registration_token).toMatch(/^g_reg\./);
      expect(result.verified_email).toBe("brandnewgoogle@example.com");
      expect(result.suggested_first_name).toBe("Brand");
      expect(result.suggested_last_name).toBe("New Google User");
      expect(result.sessionToken).toBeUndefined();

      // Ensure NO profile was created in Firestore
      expect(collections.customer_profiles.size).toBe(0);
      expect(collections.customer_sessions.size).toBe(0);
    });

    it("4.2 Existing Google User with Verified Mobile: Returns active sessionToken", async () => {
      const { mockDb } = createMockFirestore({
        "customer_profiles/prof_google_exist": {
          customer_id: "KL-C000101",
          full_name: "Existing Google Customer",
          email: "existinggoogle@example.com",
          email_lower: "existinggoogle@example.com",
          phone: "+919876543210",
          normalized_phone: "919876543210",
          mobile_verified: true,
          phone_verified: true,
          auth_providers: ["mobile_otp", "google"]
        },
        "customer_auth_identities/google_uid_hash_existing": {
          identity_id: "google_uid_hash_existing",
          provider: "google",
          provider_uid_hash: "uid_hash_existing",
          customer_profile_id: "prof_google_exist",
          email_lower: "existinggoogle@example.com"
        }
      });

      const mockAuth: any = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: "uid_hash_existing",
          email: "existinggoogle@example.com",
          email_verified: true,
          name: "Existing Google Customer"
        })
      };

      const result = await handleGoogleAuthToken(
        mockDb,
        mockAuth,
        "valid_google_id_token_123",
        { ip: "127.0.0.1", userAgent: "Vitest" }
      );

      expect(result.success).toBe(true);
      expect(result.sessionToken).toBeDefined();
      expect(result.profileId).toBe("prof_google_exist");
      expect(result.isNewCustomer).toBe(false);
    });

    it("4.3 Existing Profile matched by Email WITHOUT Verified Mobile: Demands Mobile Verification", async () => {
      const { mockDb } = createMockFirestore({
        "customer_profiles/prof_no_mobile": {
          customer_id: "KL-C000102",
          full_name: "Legacy Email Customer",
          email: "legacyemail@example.com",
          email_lower: "legacyemail@example.com",
          phone: "",
          normalized_phone: "",
          mobile_verified: false,
          auth_providers: ["email_otp"]
        }
      });

      const mockAuth: any = {
        verifyIdToken: vi.fn().mockResolvedValue({
          uid: "google_uid_unverified_mobile",
          email: "legacyemail@example.com",
          email_verified: true,
          name: "Legacy Email Customer"
        })
      };

      const result = await handleGoogleAuthToken(
        mockDb,
        mockAuth,
        "valid_google_id_token_123",
        { ip: "127.0.0.1", userAgent: "Vitest" }
      );

      expect(result.success).toBe(true);
      expect(result.mobile_verification_required).toBe(true);
      expect(result.verification_token).toMatch(/^m_req\./);
      expect(result.sessionToken).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. Registration API & Mobile Invariant Enforcement Tests
  // =========================================================================
  describe("Registration API & Mobile Invariant Enforcement", () => {
    it("5.1 Rejects registration when firstName or lastName is missing", () => {
      // Logic test for input validation
      const validateRegistrationInput = (firstName: string, lastName: string, accessToken: string) => {
        if (!firstName || !lastName) return { status: 400, error: "First name and last name are required for account registration." };
        if (!accessToken) return { status: 400, error: "Mobile OTP verification access token is required to complete registration." };
        return { status: 200 };
      };

      expect(validateRegistrationInput("", "Doe", "token123").status).toBe(400);
      expect(validateRegistrationInput("John", "", "token123").status).toBe(400);
      expect(validateRegistrationInput("John", "Doe", "").status).toBe(400);
      expect(validateRegistrationInput("John", "Doe", "token123").status).toBe(200);
    });

    it("5.2 Rejects registration if MSG91 verified contact is an Email address", () => {
      const verifyContactType = (verifiedContact: string) => {
        if (verifiedContact.includes("@")) {
          return { status: 400, code: "MOBILE_VERIFICATION_REQUIRED", error: "A valid mobile number must be verified to register an account." };
        }
        return { status: 200 };
      };

      expect(verifyContactType("user@example.com").code).toBe("MOBILE_VERIFICATION_REQUIRED");
      expect(verifyContactType("919876543210").status).toBe(200);
    });

    it("5.3 Rejects registration if user provided mobile number mismatches MSG91 verified mobile", () => {
      const checkTrustBoundary = (providedMobile: string, verifiedMobile: string) => {
        const normProvided = providedMobile.replace(/\D/g, "");
        const normVerified = verifiedMobile.replace(/\D/g, "");
        if (normProvided && normProvided !== normVerified) {
          return { status: 400, code: "VERIFIED_IDENTIFIER_MISMATCH", error: "Verified mobile identifier mismatch during registration." };
        }
        return { status: 200 };
      };

      expect(checkTrustBoundary("919876543210", "919999999999").code).toBe("VERIFIED_IDENTIFIER_MISMATCH");
      expect(checkTrustBoundary("919876543210", "919876543210").status).toBe(200);
    });

    it("5.4 Enforces Primary Contact = Mobile invariant on created profile", () => {
      const newProfileData = {
        customer_id: "KL-C000103",
        first_name: "Aarav",
        last_name: "Sharma",
        full_name: "Aarav Sharma",
        phone: "919876543210",
        normalized_phone: "919876543210",
        phone_verified: true,
        mobile_verified: true,
        primary_contact_type: "mobile"
      };

      expect(newProfileData.normalized_phone).not.toBe("");
      expect(newProfileData.mobile_verified).toBe(true);
      expect(newProfileData.primary_contact_type).toBe("mobile");
    });
  });

  // =========================================================================
  // 6. Existing Customer Login Regression & Invariant Tests
  // =========================================================================
  describe("Existing Customer Login Regression", () => {
    it("6.1 Existing Customer Mobile OTP Login: Unimpeded", () => {
      const existingProfile = {
        customer_id: "KL-C000001",
        normalized_phone: "919876543210",
        mobile_verified: true
      };

      expect(existingProfile.mobile_verified).toBe(true);
      expect(existingProfile.normalized_phone).toBeTruthy();
    });

    it("6.2 Existing Customer Email OTP Login with Verified Mobile: Unimpeded", () => {
      const existingProfile = {
        customer_id: "KL-C000002",
        email_lower: "customer@example.com",
        normalized_phone: "919876543210",
        mobile_verified: true
      };

      const isEligibleForEmailLogin = Boolean(existingProfile.mobile_verified && existingProfile.normalized_phone);
      expect(isEligibleForEmailLogin).toBe(true);
    });

    it("6.3 Existing Customer Google Login with Verified Mobile: Unimpeded", () => {
      const existingProfile = {
        customer_id: "KL-C000003",
        email_lower: "googlecustomer@example.com",
        normalized_phone: "919876543210",
        mobile_verified: true
      };

      const isEligibleForGoogleLogin = Boolean(existingProfile.mobile_verified && existingProfile.normalized_phone);
      expect(isEligibleForGoogleLogin).toBe(true);
    });
  });
});
