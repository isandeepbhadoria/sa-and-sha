import { describe, it, expect } from "vitest";
import {
  generateNextCustomerIdInTransaction,
  ensureCustomerIdInTransaction,
  buildNormalizedSearchFields,
  migrateAndNormalizeProfile
} from "../customerProfileHelpers";

describe("Business Customer ID Verification Suite", () => {
  it("indexes Customer ID and formatted variants into search_tokens", () => {
    const fields = buildNormalizedSearchFields({
      customer_id: "KL-C000042",
      full_name: "Rahul Sharma",
      email: "rahul@example.com",
      normalized_phone: "919876543210"
    });

    expect(fields.customer_id).toBe("KL-C000042");
    expect(fields.search_tokens).toContain("KL-C000042");
    expect(fields.search_tokens).toContain("kl-c000042");
    expect(fields.search_tokens).toContain("000042");
  });

  it("generates sequential Customer ID KL-C000001 when counter is empty", async () => {
    let counterData: any = null;
    const fakeTransaction1 = {
      get: async () => ({ exists: false, data: () => null }),
      set: (_ref: any, data: any) => { counterData = data; }
    };
    const fakeAdminDb1 = {
      collection: () => ({ doc: () => ({ id: "customer_counter" }) })
    };

    const id1 = await generateNextCustomerIdInTransaction(fakeTransaction1, fakeAdminDb1);
    expect(id1).toBe("KL-C000001");
    expect(counterData?.last_sequence).toBe(1);
  });

  it("increments sequential counter from 42 to 43 generating KL-C000043", async () => {
    let counterData: any = null;
    const fakeTransaction2 = {
      get: async () => ({ exists: true, data: () => ({ last_sequence: 42 }) }),
      set: (_ref: any, data: any) => { counterData = data; }
    };
    const fakeAdminDb1 = {
      collection: () => ({ doc: () => ({ id: "customer_counter" }) })
    };

    const id2 = await generateNextCustomerIdInTransaction(fakeTransaction2, fakeAdminDb1);
    expect(id2).toBe("KL-C000043");
    expect(counterData?.last_sequence).toBe(43);
  });

  it("preserves existing assigned Customer ID without reading counter", async () => {
    let getCalled = false;
    const fakeTransaction3 = {
      get: async () => { getCalled = true; return { exists: true, data: () => ({}) }; },
      set: () => {}
    };
    const fakeAdminDb1 = {
      collection: () => ({ doc: () => ({ id: "customer_counter" }) })
    };

    const existingData = { customer_id: "KL-C000123", full_name: "John Doe" };
    const id3 = await ensureCustomerIdInTransaction(fakeTransaction3, fakeAdminDb1, existingData);
    expect(id3).toBe("KL-C000123");
    expect(getCalled).toBe(false);
  });

  it("preserves unassigned customer_id as undefined during profile normalization", () => {
    const rawProfile = { full_name: "Bikram Singh", email: "bikram@linen.in" };
    const norm = migrateAndNormalizeProfile(rawProfile, "doc_123");
    expect(norm.id).toBe("doc_123");
    expect(norm.customer_id).toBeUndefined();
  });

  it("retains explicitly assigned customer_id during profile normalization", () => {
    const rawProfile = { customer_id: "KL-C000007", full_name: "Chitra Roy" };
    const norm = migrateAndNormalizeProfile(rawProfile, "doc_456");
    expect(norm.customer_id).toBe("KL-C000007");
  });
});
