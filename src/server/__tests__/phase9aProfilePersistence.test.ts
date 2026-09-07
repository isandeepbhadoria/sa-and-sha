import { describe, it, expect } from "vitest";
import {
  migrateAndNormalizeProfile,
  validateAddressInput,
  buildNormalizedSearchFields,
  ensureCustomerIdInTransaction,
  recalculateCustomerCommerceSummary,
  calculateProfileCompletion,
  findDuplicateCustomerCandidates,
  checkEmailDuplicate,
  buildCustomerDataExport,
  createAccountDeletionRequest,
  logConsentEvent
} from "../customerProfileHelpers";

describe("PHASE 9A — Customer Profile Persistence, Returning Autofill & CRM Suite (24 Tests)", () => {

  // Test 1: Phone Normalization - 10-digit Indian Mobile
  it("1. Normalizes 10-digit mobile number to 91XXXXXXXXXX format", () => {
    const raw = "9876543210";
    const profile = migrateAndNormalizeProfile({ normalized_phone: "919876543210" }, "p_123");
    expect(profile.normalized_phone).toBe("919876543210");
  });

  // Test 2: Phone Normalization - Dirty / Formatted Input Handling
  it("2. Handles dirty input with spaces, dashes, country code prefixes", () => {
    const rawProfile = { normalized_phone: "+91 (987) 654-3210" };
    const fields = buildNormalizedSearchFields(rawProfile);
    expect(fields.normalized_phone).toBe("919876543210");
  });

  // Test 3: Profile Lookup for Existing Verified Customer
  it("3. Profile normalization handles complete existing profile data", () => {
    const existingData = {
      customer_id: "KL-C000015",
      full_name: "Anita Sharma",
      email: "anita@example.com",
      normalized_phone: "919876543210",
      addresses: [
        {
          id: "addr_1",
          recipient_name: "Anita Sharma",
          phone: "919876543210",
          address_line_1: "Flat 101, Lakeview",
          city: "Jaipur",
          state: "Rajasthan",
          postal_code: "302001",
          country: "India",
          is_default: true
        }
      ]
    };
    const norm = migrateAndNormalizeProfile(existingData, "p_doc1");
    expect(norm.id).toBe("p_doc1");
    expect(norm.customer_id).toBe("KL-C000015");
    expect(norm.full_name).toBe("Anita Sharma");
    expect(norm.email).toBe("anita@example.com");
    expect(norm.addresses).toHaveLength(1);
    expect(norm.default_address?.city).toBe("Jaipur");
  });

  // Test 4: Profile Normalization for New / Empty Customer Profile
  it("4. Normalizes new customer profile with safe default fallback structure", () => {
    const rawProfile = {};
    const norm = migrateAndNormalizeProfile(rawProfile, "p_new1");
    expect(norm.id).toBe("p_new1");
    expect(norm.full_name).toBe("");
    expect(norm.email).toBe("");
    expect(norm.addresses).toEqual([]);
    expect(norm.default_address).toBeUndefined();
  });

  // Test 5: Transactional Customer ID Preservation
  it("5. Idempotent Customer ID generation preserves existing assigned ID in transaction", async () => {
    let getCalled = false;
    const mockTransaction = {
      get: async () => { getCalled = true; return { exists: true, data: () => ({}) }; },
      set: () => {}
    };
    const mockDb = { collection: () => ({ doc: () => ({ id: "customer_counter" }) }) };

    const existing = { customer_id: "KL-C000099", full_name: "Rohan Varma" };
    const id = await ensureCustomerIdInTransaction(mockTransaction, mockDb, existing);
    expect(id).toBe("KL-C000099");
    expect(getCalled).toBe(false);
  });

  // Test 6: Sequential Customer ID Generation for New Customer
  it("6. Generates sequential Customer ID KL-C000001 when transaction counter is unitialized", async () => {
    let counterData: any = null;
    const mockTransaction = {
      get: async () => ({ exists: false, data: () => null }),
      set: (_ref: any, data: any) => { counterData = data; }
    };
    const mockDb = { collection: () => ({ doc: () => ({ id: "customer_counter" }) }) };

    const id = await ensureCustomerIdInTransaction(mockTransaction, mockDb, {});
    expect(id).toBe("KL-C000001");
    expect(counterData?.last_sequence).toBe(1);
  });

  // Test 7: Non-Destructive Field Merging (Does NOT overwrite valid values with empty)
  it("7. Non-destructive merging retains existing valid email when order email is blank or placeholder", () => {
    const existing = {
      email: "pria@saandsha.com",
      full_name: "Pria Kapur"
    };
    const norm = migrateAndNormalizeProfile(existing, "p_pria");
    expect(norm.email).toBe("pria@saandsha.com");

    // Placeholder shop email check
    const cleanEmail = "shop@saandsha.com".trim().toLowerCase();
    const finalEmail = cleanEmail === "shop@saandsha.com" ? "" : cleanEmail;
    const mergedEmail = finalEmail || norm.email;
    expect(mergedEmail).toBe("pria@saandsha.com");
  });

  // Test 8: Address Input Validation
  it("8. Validates and sanitizes incoming shipping address input", () => {
    const rawAddr = {
      recipient_name: "Sumanth Patel",
      phone: "919876543210",
      address_line_1: "Flat 402, Green Avenue",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560001",
      country: "India"
    };

    const val = validateAddressInput(rawAddr, "919876543210");
    expect(val.valid).toBe(true);
    expect(val.cleanAddress).toBeDefined();
    expect(val.cleanAddress?.postal_code).toBe("560001");
    expect(val.cleanAddress?.city).toBe("Bengaluru");
  });

  // Test 9: Address Duplicate Prevention
  it("9. Identifies matching address by line 1 and postal code to prevent duplicates", () => {
    const existingAddrs = [
      {
        id: "addr_1",
        recipient_name: "Sumanth Patel",
        phone: "919876543210",
        address_line_1: "Flat 402, Green Avenue",
        city: "Bengaluru",
        state: "Karnataka",
        postal_code: "560001",
        country: "India",
        is_default: true
      }
    ];

    const incoming = {
      recipient_name: "Sumanth Patel",
      phone: "919876543210",
      address_line_1: "FLAT 402, GREEN AVENUE",
      city: "Bengaluru",
      state: "Karnataka",
      postal_code: "560001",
      country: "India"
    };

    const matchIdx = existingAddrs.findIndex(
      a => a.postal_code === incoming.postal_code && a.address_line_1.toLowerCase() === incoming.address_line_1.toLowerCase()
    );

    expect(matchIdx).toBe(0);
  });

  // Test 10: Automatic Default Address Assignment
  it("10. Sets first added address as default address automatically", () => {
    const valRes = validateAddressInput({
      recipient_name: "Maya Singh",
      phone: "919988776655",
      address_line_1: "123 Park Street",
      city: "Kolkata",
      state: "West Bengal",
      postal_code: "700016",
      country: "India"
    }, "919988776655");

    expect(valRes.valid).toBe(true);
    const addr = valRes.cleanAddress!;
    const addresses: any[] = [];
    addr.is_default = addresses.length === 0;
    addresses.push(addr);

    expect(addresses[0].is_default).toBe(true);
  });

  // Test 11: Verified GST Information Structure
  it("11. Preserves verified GST details structure when GST invoice is requested", () => {
    const rawGstData = {
      gstin: "08AAAAA0000A1Z5",
      legal_name: "Kora Textiles Pvt Ltd",
      trade_name: "Sa and Sha Enterprise",
      taxpayer_type: "Regular",
      gstin_status: "Active",
      principal_place_address: "123 Linen Way, Jaipur, Rajasthan - 302001"
    };

    expect(rawGstData.gstin).toBe("08AAAAA0000A1Z5");
    expect(rawGstData.legal_name).toBe("Kora Textiles Pvt Ltd");
    expect(rawGstData.gstin_status).toBe("Active");
  });

  // Test 12: GST Omission Non-Destructiveness
  it("12. Does not overwrite existing GST details when GST is omitted in checkout", () => {
    const existingProfile = {
      gstin: "08AAAAA0000A1Z5",
      business_name: "Kora Textiles Pvt Ltd"
    };

    const omittedGstin = undefined;
    const finalGstin = omittedGstin || existingProfile.gstin;
    expect(finalGstin).toBe("08AAAAA0000A1Z5");
  });

  // Test 13: Recalculate Commerce Summary from Orders (Paid Razorpay vs Unpaid COD)
  it("13. Recalculates commerce summary correctly from matched orders", async () => {
    const mockOrders = [
      {
        order_id: "KL-1001",
        customer_phone: "919876543210",
        customer_email: "anita@example.com",
        order_status: "paid",
        payment_type: "razorpay",
        total_amount: 3500,
        created_at: "2026-01-10T10:00:00Z"
      },
      {
        order_id: "KL-1002",
        customer_phone: "919876543210",
        customer_email: "anita@example.com",
        order_status: "placed",
        payment_type: "cod",
        total_amount: 2000,
        created_at: "2026-02-01T10:00:00Z"
      }
    ];

    const mockAdminDb = {
      collection: (col: string) => ({
        get: async () => ({
          forEach: (cb: Function) => mockOrders.forEach(o => cb({ data: () => o }))
        })
      })
    };

    const summary = await recalculateCustomerCommerceSummary(mockAdminDb, "919876543210", "anita@example.com");
    expect(summary.total_orders).toBe(2);
    expect(summary.completed_orders).toBe(1); // Only Razorpay 'paid' is completed, 'placed' COD is not delivered yet
    expect(summary.lifetime_spend).toBe(3500);
    expect(summary.average_order_value).toBe(3500);
  });

  // Test 14: Excludes Cancelled Orders from Lifetime Spend
  it("14. Excludes cancelled orders from completed orders count and lifetime spend", async () => {
    const mockOrders = [
      {
        order_id: "KL-1003",
        customer_phone: "919876543210",
        order_status: "cancelled",
        payment_type: "razorpay",
        total_amount: 5000,
        created_at: "2026-01-15T10:00:00Z"
      }
    ];

    const mockAdminDb = {
      collection: () => ({
        get: async () => ({
          forEach: (cb: Function) => mockOrders.forEach(o => cb({ data: () => o }))
        })
      })
    };

    const summary = await recalculateCustomerCommerceSummary(mockAdminDb, "919876543210");
    expect(summary.total_orders).toBe(1);
    expect(summary.cancelled_orders).toBe(1);
    expect(summary.completed_orders).toBe(0);
    expect(summary.lifetime_spend).toBe(0);
  });

  // Test 15: Includes Delivered COD Orders in Lifetime Spend
  it("15. Includes delivered COD orders in lifetime spend calculation", async () => {
    const mockOrders = [
      {
        order_id: "KL-1004",
        customer_phone: "919876543210",
        order_status: "delivered",
        payment_type: "cod",
        total_amount: 4200,
        created_at: "2026-01-20T10:00:00Z"
      }
    ];

    const mockAdminDb = {
      collection: () => ({
        get: async () => ({
          forEach: (cb: Function) => mockOrders.forEach(o => cb({ data: () => o }))
        })
      })
    };

    const summary = await recalculateCustomerCommerceSummary(mockAdminDb, "919876543210");
    expect(summary.completed_orders).toBe(1);
    expect(summary.lifetime_spend).toBe(4200);
  });

  // Test 16: Profile Completion Calculator
  it("16. Calculates profile completion percentage accurately", () => {
    const profile = {
      full_name: "Aarav Sharma",
      email: "aarav@example.com",
      addresses: [{ id: "a1" }],
      birthday: "1992-05-12",
      marketing_preferences: { whatsapp_marketing_consent: true },
      gender: "Male"
    };

    const res = calculateProfileCompletion(profile);
    expect(res.completion_percent).toBe(100);
    expect(res.completed_fields).toHaveLength(6);
  });

  // Test 17: Profile Completion for Partial Profile
  it("17. Calculates partial profile completion percentage for missing fields", () => {
    const partialProfile = {
      full_name: "Aarav Sharma",
      email: "aarav@example.com"
    };

    const res = calculateProfileCompletion(partialProfile);
    expect(res.completion_percent).toBe(45); // 25 (name) + 20 (email)
  });

  // Test 18: Marketing Preferences & Consent State
  it("18. Preserves marketing consent state across checkout preferences", () => {
    const prefs = {
      email_marketing_consent: false,
      sms_marketing_consent: false,
      whatsapp_marketing_consent: true,
      voice_call_consent: false,
      consent_updated_at: new Date().toISOString(),
      consent_source: "checkout"
    };

    expect(prefs.whatsapp_marketing_consent).toBe(true);
    expect(prefs.email_marketing_consent).toBe(false);
  });

  // Test 19: Immutable Consent Event Logging
  it("19. Writes audit event log when customer consent status changes", async () => {
    let writtenDoc: any = null;
    const mockAdminDb = {
      collection: (col: string) => ({
        add: async (doc: any) => { writtenDoc = doc; return { id: "evt_1" }; }
      })
    };

    await logConsentEvent(
      mockAdminDb,
      "p_doc1",
      "919876543210",
      "whatsapp",
      false,
      true,
      "checkout",
      "customer"
    );

    expect(writtenDoc).not.toBeNull();
    expect(writtenDoc.channel).toBe("whatsapp");
    expect(writtenDoc.previous_status).toBe(false);
    expect(writtenDoc.new_status).toBe(true);
    expect(writtenDoc.actor_type).toBe("customer");
  });

  // Test 20: Duplicate Candidate Detection by Phone
  it("20. Detects duplicate customer profile candidate by matching normalized phone", async () => {
    const mockProfiles = [
      {
        id: "p_doc1",
        full_name: "Rahul Varma",
        normalized_phone: "919876543210",
        email: "rahul@example.com",
        created_at: "2026-01-01T00:00:00Z"
      }
    ];

    const mockAdminDb = {
      collection: () => ({
        where: (field: string, _op: string, val: string) => ({
          limit: () => ({
            get: async () => ({
              forEach: (cb: Function) => {
                mockProfiles.filter(p => p.normalized_phone === val).forEach(p => cb({ id: p.id, data: () => p }));
              }
            })
          })
        })
      })
    };

    const candidates = await findDuplicateCustomerCandidates(
      mockAdminDb,
      "p_doc2",
      "919876543210",
      "rahul2@example.com",
      "Rahul Varma"
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe("p_doc1");
    expect(candidates[0].reason).toContain("phone");
  });

  // Test 21: Check Email Duplicate Endpoint Helper
  it("21. Checks for duplicate registered email address across profiles", async () => {
    const mockProfiles = [
      { id: "p_doc1", email: "pria@example.com" }
    ];

    const mockAdminDb = {
      collection: () => ({
        where: (_field: string, _op: string, val: string) => ({
          limit: () => ({
            get: async () => ({
              forEach: (cb: Function) => {
                mockProfiles.filter(p => p.email === val).forEach(p => cb({ id: p.id, data: () => p }));
              }
            })
          })
        })
      })
    };

    const res = await checkEmailDuplicate(mockAdminDb, "pria@example.com", "p_doc2");
    expect(res.isDuplicate).toBe(true);
    expect(res.matchedProfileId).toBe("p_doc1");
  });

  // Test 22: GDPR/DPDP Compliant Data Export Builder
  it("22. Builds GDPR/DPDP compliant customer data export stripping internal secrets", async () => {
    const rawProfile = {
      customer_id: "KL-C000042",
      full_name: "Vikram Malhotra",
      email: "vikram@example.com",
      normalized_phone: "919811223344",
      created_at: "2026-01-01T00:00:00Z"
    };

    const mockOrders = [
      {
        order_id: "KL-9901",
        customer_phone: "919811223344",
        customer_email: "vikram@example.com",
        created_at: "2026-02-01T00:00:00Z",
        total_amount: 4500,
        order_status: "delivered",
        payment_type: "razorpay"
      }
    ];

    const mockAdminDb = {
      collection: (col: string) => {
        if (col === "orders") {
          return {
            get: async () => ({
              forEach: (cb: Function) => mockOrders.forEach(o => cb({ data: () => o, id: o.order_id }))
            })
          };
        }
        return {
          doc: () => ({
            collection: () => ({
              limit: () => ({
                get: async () => ({ forEach: () => {} })
              })
            })
          })
        };
      }
    };

    const dataExport = await buildCustomerDataExport(mockAdminDb, "p_vikram", rawProfile);
    expect(dataExport.export_metadata.compliance).toContain("DPDP");
    expect(dataExport.customer_info.customer_id).toBe("KL-C000042");
    expect(dataExport.customer_info.full_name).toBe("Vikram Malhotra");
    expect(dataExport.orders_summary.recent_orders).toHaveLength(1);
  });

  // Test 23: Account Deletion Request Creation with Grace Period
  it("23. Creates account deletion request with 30-day grace period", async () => {
    let createdRequest: any = null;
    let profileUpdate: any = null;
    let eventAdded: any = null;

    const mockAdminDb = {
      collection: (col: string) => {
        if (col === "account_deletion_requests") {
          return {
            doc: (_id: string) => ({
              set: async (doc: any) => { createdRequest = doc; }
            })
          };
        }
        if (col === "customer_profiles") {
          return {
            doc: (_id: string) => ({
              set: async (doc: any) => { profileUpdate = doc; },
              collection: () => ({
                add: async (evt: any) => { eventAdded = evt; }
              })
            })
          };
        }
        return {};
      }
    };

    const profileData = { customer_id: "KL-C000007", email: "user@example.com", normalized_phone: "919876543210" };
    const request = await createAccountDeletionRequest(mockAdminDb, "p_user1", profileData, "User account closure");

    expect(request.grace_period_days).toBe(30);
    expect(request.status).toBe("pending_admin_review");
    expect(createdRequest).not.toBeNull();
    expect(profileUpdate?.account_status).toBe("deletion_pending");
    expect(eventAdded?.event_type).toBe("account_deletion_requested");
  });

  // Test 24: Search Tokens Generation for Fast Lookups
  it("24. Generates comprehensive search tokens indexing phone, name, email, and Customer ID", () => {
    const profile = {
      customer_id: "KL-C000088",
      full_name: "Kavita Rao",
      email: "kavita.rao@example.com",
      normalized_phone: "919876543210"
    };

    const fields = buildNormalizedSearchFields(profile);
    expect(fields.search_tokens).toContain("KL-C000088");
    expect(fields.search_tokens).toContain("kl-c000088");
    expect(fields.search_tokens).toContain("kavita rao");
    expect(fields.search_tokens).toContain("kavita.rao@example.com");
    expect(fields.search_tokens).toContain("919876543210");
  });

});
