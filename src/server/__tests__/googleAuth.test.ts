import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashUid,
  maskUidHash,
  createCustomerSessionToken,
  verifyCustomerSessionToken,
  handleGoogleAuthToken
} from "../googleAuthHelpers";

describe("PHASE 9C.1 — Google Sign-In & Auth Identities Integration", () => {
  // Test 1: Hash UID determinism
  it("1. Generates deterministic SHA-256 hash for Google UID", () => {
    const rawUid = "google-uid-123456789";
    const hash1 = hashUid(rawUid);
    const hash2 = hashUid(rawUid);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).not.toBe(rawUid);
  });

  // Test 2: Mask UID hash for Admin CRM
  it("2. Masks UID hash for admin privacy logging", () => {
    const hash = "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef";
    const masked = maskUidHash(hash);
    expect(masked).toBe("a1b2c3...cdef");
  });

  // Test 3: Signed customer session token creation and verification
  it("3. Creates and verifies valid customer session tokens", () => {
    const profileId = "prof_999";
    const customerId = "KL-C000123";
    const token = createCustomerSessionToken(profileId, customerId, "google");

    expect(token).toContain("c_sess.");
    expect(token).toContain(profileId);

    const verified = verifyCustomerSessionToken(token);
    expect(verified.valid).toBe(true);
    expect(verified.profileId).toBe(profileId);
    expect(verified.authMethod).toBe("google");
  });

  // Test 4: Rejects tampered session tokens
  it("4. Rejects tampered customer session tokens", () => {
    const token = createCustomerSessionToken("prof_123", "KL-C000123", "google");
    const tampered = token.slice(0, -4) + "0000";

    const verified = verifyCustomerSessionToken(tampered);
    expect(verified.valid).toBe(false);
  });

  // Test 5: Rejects missing token
  it("5. Rejects missing or empty Google ID token", async () => {
    const mockDb: any = {};
    const mockAuth: any = {};

    const res = await handleGoogleAuthToken(mockDb, mockAuth, "");
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.error).toContain("required");
  });

  // Test 6: Rejects unverified Google accounts
  it("6. Rejects unverified Google accounts (email_verified = false)", async () => {
    const mockAuth: any = {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: "g_uid_unverified",
        email: "unverified@example.com",
        email_verified: false,
        name: "Unverified User"
      })
    };
    const mockDb: any = {};

    const res = await handleGoogleAuthToken(mockDb, mockAuth, "mock_token_123");
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.error).toContain("Unverified Google accounts cannot be used");
  });

  // Test 7: Links identity to existing customer profile by matching email
  it("7. Links Google identity to existing profile by email without overwriting existing details", async () => {
    const existingProfile = {
      customer_id: "KL-C000088",
      full_name: "Rahul Mehta",
      email: "rahul@example.com",
      email_lower: "rahul@example.com",
      phone: "9876543210",
      normalized_phone: "919876543210",
      auth_providers: ["mobile_otp"],
      admin_metadata: { customer_tier: "gold" }
    };

    const mockProfileDoc: any = {
      id: "p_rahul_123",
      data: () => existingProfile,
      ref: { update: vi.fn().mockResolvedValue({}) }
    };

    const mockIdentityRef: any = {
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue({})
    };

    const mockDb: any = {
      collection: (collName: string) => {
        if (collName === "customer_auth_identities") {
          return {
            doc: () => mockIdentityRef,
            where: () => ({
              where: () => ({
                limit: () => ({ get: vi.fn().mockResolvedValue({ empty: true }) })
              })
            })
          };
        }
        if (collName === "customer_profiles") {
          return {
            where: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: [mockProfileDoc] })
              })
            })
          };
        }
        const defaultDocMock = {
          id: "doc_mock_123",
          get: vi.fn().mockResolvedValue({ exists: false }),
          set: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
          ref: {
            update: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue({})
          }
        };
        return {
          doc: () => defaultDocMock,
          add: vi.fn().mockResolvedValue({ id: "event_123" }),
          where: () => ({
            where: () => ({
              limit: () => ({ get: vi.fn().mockResolvedValue({ empty: true }) })
            })
          })
        };
      }
    };

    const mockAuth: any = {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: "g_uid_rahul",
        email: "rahul@example.com",
        email_verified: true,
        name: "Rahul Mehta"
      })
    };

    const res = await handleGoogleAuthToken(mockDb, mockAuth, "valid_token");
    expect(res.success).toBe(true);
    expect(res.isNewCustomer).toBe(false);
    expect(res.customerId).toBe("KL-C000088");
    expect(res.sessionToken.startsWith("cses_") || res.sessionToken.startsWith("c_sess.")).toBe(true);
    expect(mockIdentityRef.set).toHaveBeenCalled();
  });

  // Test 8: Account linking conflict returns ACCOUNT_LINK_REVIEW_REQUIRED
  it("8. Returns ACCOUNT_LINK_REVIEW_REQUIRED when conflict flag exists", async () => {
    const conflictedProfile = {
      customer_id: "KL-C000099",
      full_name: "Conflicted User",
      email: "conflict@example.com",
      email_lower: "conflict@example.com",
      normalized_phone: "919876543210",
      admin_metadata: { account_link_conflict: true }
    };

    const mockProfileDoc: any = {
      id: "p_conflict_123",
      data: () => conflictedProfile
    };

    const mockDb: any = {
      collection: (collName: string) => {
        if (collName === "customer_auth_identities") {
          return {
            doc: () => ({ get: vi.fn().mockResolvedValue({ exists: false }) }),
            where: () => ({
              where: () => ({
                limit: () => ({ get: vi.fn().mockResolvedValue({ empty: true }) })
              })
            })
          };
        }
        if (collName === "customer_profiles") {
          return {
            where: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: [mockProfileDoc] })
              })
            })
          };
        }
        return {};
      }
    };

    const mockAuth: any = {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: "g_uid_conflict",
        email: "conflict@example.com",
        email_verified: true,
        name: "Conflict User"
      })
    };

    const res = await handleGoogleAuthToken(mockDb, mockAuth, "valid_token");
    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(409);
    expect(res.code).toBe("ACCOUNT_LINK_REVIEW_REQUIRED");
  });
});
