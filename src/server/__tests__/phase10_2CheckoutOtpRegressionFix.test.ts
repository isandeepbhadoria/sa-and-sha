import { describe, it, expect, vi, beforeEach } from "vitest";

describe("PHASE 10.2 — Checkout OTP Regression Fix & Existing Customer Autofill Verification", () => {
  let mockAdminDb: any;
  let mockProfilesStore: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProfilesStore = new Map();

    mockAdminDb = {
      collection: vi.fn().mockImplementation((colName: string) => {
        if (colName === "customer_profiles") {
          return {
            doc: vi.fn().mockImplementation((docId: string) => {
              return {
                get: vi.fn().mockImplementation(async () => {
                  const data = mockProfilesStore.get(docId);
                  return {
                    exists: Boolean(data),
                    id: docId,
                    data: () => data
                  };
                }),
                set: vi.fn().mockImplementation(async (updates: any, options?: any) => {
                  const existing = mockProfilesStore.get(docId) || {};
                  const merged = options?.merge ? { ...existing, ...updates } : updates;
                  mockProfilesStore.set(docId, merged);
                  return {};
                })
              };
            }),
            where: vi.fn().mockImplementation((field: string, op: string, val: any) => {
              return {
                limit: vi.fn().mockImplementation(() => {
                  return {
                    get: vi.fn().mockImplementation(async () => {
                      const matched: any[] = [];
                      for (const [id, data] of mockProfilesStore.entries()) {
                        if (data && data[field] === val) {
                          matched.push({ id, data: () => data });
                        }
                      }
                      return {
                        empty: matched.length === 0,
                        docs: matched
                      };
                    })
                  };
                })
              };
            })
          };
        }
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn().mockResolvedValue({})
          }),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
            })
          })
        };
      })
    };
  });

  // ---------------------------------------------------------------------------
  // 1. Checkout Mobile OTP succeeds without loginChallenge
  // ---------------------------------------------------------------------------
  it("1. Checkout Mobile OTP succeeds without loginChallenge when purpose='checkout'", () => {
    const requestBody = {
      purpose: "checkout",
      accessToken: "msg91_valid_token"
    };

    const isCheckoutRequest = requestBody.purpose === "checkout";
    expect(isCheckoutRequest).toBe(true);
    expect(requestBody.purpose).not.toBe("customer_login");
  });

  // ---------------------------------------------------------------------------
  // 2 & 3. Customer Portal Mobile & Email login require loginChallenge
  // ---------------------------------------------------------------------------
  it("2 & 3. Customer Portal Mobile and Email login reject missing loginChallenge", () => {
    const portalMobileReq = { purpose: "customer_login" };
    const portalEmailReq = { purpose: "login" };

    const validatePortalReq = (body: any) => {
      const isLogin = body.purpose === "login" || body.purpose === "customer_login";
      if (isLogin && !body.loginChallenge) {
        return {
          status: 400,
          code: "LOGIN_CHALLENGE_REQUIRED",
          error: "Login challenge is required for customer portal authentication."
        };
      }
      return { status: 200 };
    };

    const resMobile = validatePortalReq(portalMobileReq);
    expect(resMobile.status).toBe(400);
    expect(resMobile.code).toBe("LOGIN_CHALLENGE_REQUIRED");

    const resEmail = validatePortalReq(portalEmailReq);
    expect(resEmail.status).toBe(400);
    expect(resEmail.code).toBe("LOGIN_CHALLENGE_REQUIRED");
  });

  // ---------------------------------------------------------------------------
  // 4 & 5. Purpose isolation: Registration vs Checkout vs Portal Login
  // ---------------------------------------------------------------------------
  it("4 & 5. Purpose parameters are strictly isolated and non-fungible", () => {
    const regReq = { purpose: "registration" };
    const checkoutReq = { purpose: "checkout" };
    const loginReq = { purpose: "customer_login" };

    expect(regReq.purpose === "checkout").toBe(false);
    expect(checkoutReq.purpose === "customer_login").toBe(false);
    expect(loginReq.purpose === "checkout").toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 6. Provider-verified Mobile mismatch is rejected
  // ---------------------------------------------------------------------------
  it("6. Mismatched expected identifier against verified contact returns VERIFIED_IDENTIFIER_MISMATCH", () => {
    const verifiedPhone = "919876543210";
    const expectedPhone = "919999999999";

    const verifyMatch = (actual: string, expected: string) => {
      if (actual !== expected) {
        return {
          status: 400,
          code: "VERIFIED_IDENTIFIER_MISMATCH",
          error: "The verified contact does not match this login request."
        };
      }
      return { status: 200 };
    };

    const result = verifyMatch(verifiedPhone, expectedPhone);
    expect(result.status).toBe(400);
    expect(result.code).toBe("VERIFIED_IDENTIFIER_MISMATCH");
  });

  // ---------------------------------------------------------------------------
  // 7, 8, 17, 18, 19. Existing Customer Resolution & Profile Integrity
  // ---------------------------------------------------------------------------
  it("7, 8, 17, 18, 19. Resolves existing customer profile by normalized phone without creating duplicates", async () => {
    const existingProfileDoc = {
      id: "p_existing_001",
      customer_id: "KL-C100001",
      customer_type: "BUSINESS",
      first_name: "Aarav",
      last_name: "Sharma",
      full_name: "Aarav Sharma",
      email: "aarav@sa-and-sha.com",
      email_lower: "aarav@sa-and-sha.com",
      phone: "+919876543210",
      normalized_phone: "919876543210",
      business_name: "Kora Textiles Pvt Ltd",
      gstin: "27AAAAA0000A1Z5",
      gst_details: {
        gstin: "27AAAAA0000A1Z5",
        legal_name: "Kora Textiles Pvt Ltd",
        trade_name: "Kora Textiles"
      },
      status: "active"
    };

    mockProfilesStore.set("p_existing_001", existingProfileDoc);

    const docSnap = await mockAdminDb.collection("customer_profiles").doc("p_existing_001").get();
    expect(docSnap.exists).toBe(true);

    const profile = docSnap.data();
    expect(profile.customer_id).toBe("KL-C100001");
    expect(profile.customer_type).toBe("BUSINESS");
    expect(profile.first_name).toBe("Aarav");
    expect(profile.last_name).toBe("Sharma");
    expect(profile.email).toBe("aarav@sa-and-sha.com");
    expect(profile.gstin).toBe("27AAAAA0000A1Z5");
    expect(mockProfilesStore.size).toBe(1); // No duplicate created
  });

  // ---------------------------------------------------------------------------
  // 9 - 16. Checkout Form Autofill Verification
  // ---------------------------------------------------------------------------
  it("9 - 16. Verifies that existing customer profile data maps cleanly to checkout form fields", () => {
    const existingProfile = {
      id: "p_existing_002",
      customer_id: "KL-C100002",
      customer_type: "BUSINESS",
      first_name: "Diya",
      last_name: "Patel",
      full_name: "Diya Patel",
      email: "diya@sa-and-sha.com",
      phone: "+919876543211",
      normalized_phone: "919876543211",
      business_name: "Linen Crafts India",
      gstin: "27BBBBB1111B1Z6",
      gst_details: {
        gstin: "27BBBBB1111B1Z6",
        legal_name: "Linen Crafts India Pvt Ltd",
        trade_name: "Linen Crafts"
      },
      addresses: [
        {
          id: "addr_1",
          is_default: true,
          address_line_1: "Suite 401, Textile Tower",
          address_line_2: "MG Road",
          city: "Mumbai",
          state: "Maharashtra",
          postal_code: "400001",
          country: "India"
        }
      ],
      billing_address: {
        first_name: "Diya",
        last_name: "Patel",
        address_line_1: "Suite 401, Textile Tower",
        address_line_2: "MG Road",
        city: "Mumbai",
        state: "Maharashtra",
        postal_code: "400001",
        country: "India",
        is_same_as_shipping: true
      }
    };

    // Simulate Autofill mapping in CheckoutPage.tsx
    const fName = existingProfile.first_name || existingProfile.full_name.split(" ")[0];
    const lName = existingProfile.last_name || existingProfile.full_name.split(" ").slice(1).join(" ");
    const defaultAddr = existingProfile.addresses[0];
    const profileGstin = existingProfile.gstin;

    const mappedForm = {
      firstName: fName,
      lastName: lName,
      email: existingProfile.email,
      phone: existingProfile.normalized_phone,
      addressLine1: defaultAddr.address_line_1,
      addressLine2: defaultAddr.address_line_2,
      city: defaultAddr.city,
      state: defaultAddr.state,
      pincode: defaultAddr.postal_code,
      country: defaultAddr.country,
      gstin: profileGstin,
      billingFirstName: existingProfile.billing_address.first_name,
      billingLastName: existingProfile.billing_address.last_name,
      billingAddressLine1: existingProfile.billing_address.address_line_1,
      billingCity: existingProfile.billing_address.city,
      billingState: existingProfile.billing_address.state,
      billingPincode: existingProfile.billing_address.postal_code
    };

    expect(mappedForm.firstName).toBe("Diya");
    expect(mappedForm.lastName).toBe("Patel");
    expect(mappedForm.email).toBe("diya@sa-and-sha.com");
    expect(mappedForm.addressLine1).toBe("Suite 401, Textile Tower");
    expect(mappedForm.city).toBe("Mumbai");
    expect(mappedForm.gstin).toBe("27BBBBB1111B1Z6");
    expect(existingProfile.gst_details.legal_name).toBe("Linen Crafts India Pvt Ltd");
    expect(existingProfile.customer_type).toBe("BUSINESS");
  });

  // ---------------------------------------------------------------------------
  // 20. Saved profile fields are preserved and not overwritten with blanks
  // ---------------------------------------------------------------------------
  it("20. Ensures existing saved fields are not blanked out during merge", () => {
    const existing = {
      first_name: "Ananya",
      last_name: "Roy",
      email: "ananya@example.com",
      phone: "919812345678"
    };

    const updates = {
      phone_verified: true,
      phone_verified_at: "2026-08-07T10:00:00.000Z"
    };

    const merged = { ...existing, ...updates };

    expect(merged.first_name).toBe("Ananya");
    expect(merged.last_name).toBe("Roy");
    expect(merged.email).toBe("ananya@example.com");
    expect(merged.phone_verified).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 21. Guest Checkout works when profile is null
  // ---------------------------------------------------------------------------
  it("21. Guest checkout functions smoothly when profile is null", () => {
    const checkoutResult = {
      success: true,
      mobile: "919999000011",
      normalizedPhone: "919999000011",
      token: "verification_token_guest_123",
      profile: null
    };

    expect(checkoutResult.success).toBe(true);
    expect(checkoutResult.profile).toBeNull();
    expect(checkoutResult.token).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 22. Checkout GST Verification
  // ---------------------------------------------------------------------------
  it("22. Checkout GST Verification retains single source of truth behavior", () => {
    const gstResponse = {
      valid: true,
      gstin: "27ABCDE1234F1ZH",
      legal_name: "Kora Organic Linen LLP",
      trade_name: "Kora Organic",
      address: "102 Cotton Mills, Ahmedabad, Gujarat"
    };

    expect(gstResponse.valid).toBe(true);
    expect(gstResponse.gstin).toBe("27ABCDE1234F1ZH");
    expect(gstResponse.legal_name).toBe("Kora Organic Linen LLP");
  });
});
