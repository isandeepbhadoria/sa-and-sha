import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Focused unit test for bluedartRegisterReversePickup's request-shape logic
// (the Shipper/Consignee swap this integration relies on) and for the
// "don't swallow Blue Dart's raw error" contract that lets a config/auth
// failure surface clearly instead of silently falling back to a fake AWB.
// See src/server/bluedartClient.ts's top-of-file comment and the comment
// above bluedartRegisterReversePickup for why this swap is an inference,
// not a confirmed-from-docs fact.

const ENV_KEYS = [
  "BLUEDART_ENV",
  "BLUEDART_CLIENT_ID",
  "BLUEDART_CLIENT_SECRET",
  "BLUEDART_LOGIN_ID",
  "BLUEDART_LICENSE_KEY",
  "BLUEDART_API_TYPE",
  "BLUEDART_API_VERSION",
  "BLUEDART_ORIGIN_AREA",
  "BLUEDART_CUSTOMER_CODE",
  "BLUEDART_ORIGIN_NAME",
  "BLUEDART_ORIGIN_ADDRESS1",
  "BLUEDART_ORIGIN_ADDRESS2",
  "BLUEDART_ORIGIN_PINCODE",
  "BLUEDART_ORIGIN_PHONE"
];

describe("bluedartRegisterReversePickup — Shipper/Consignee swap", () => {
  let originalEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalEnv = {};
    for (const k of ENV_KEYS) originalEnv[k] = process.env[k];

    process.env.BLUEDART_ENV = "sandbox";
    process.env.BLUEDART_CLIENT_ID = "test-client-id";
    process.env.BLUEDART_CLIENT_SECRET = "test-client-secret";
    process.env.BLUEDART_LOGIN_ID = "TESTLOGIN";
    process.env.BLUEDART_LICENSE_KEY = "TESTLICENSE";
    process.env.BLUEDART_API_TYPE = "S";
    process.env.BLUEDART_API_VERSION = "1.10";
    process.env.BLUEDART_ORIGIN_AREA = "JAI";
    process.env.BLUEDART_CUSTOMER_CODE = "CUST001";
    process.env.BLUEDART_ORIGIN_NAME = "Sa and Sha Warehouse";
    process.env.BLUEDART_ORIGIN_ADDRESS1 = "Plot 12, Industrial Area";
    process.env.BLUEDART_ORIGIN_ADDRESS2 = "";
    process.env.BLUEDART_ORIGIN_PINCODE = "302001";
    process.env.BLUEDART_ORIGIN_PHONE = "9999999999";

    originalFetch = global.fetch;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
    global.fetch = originalFetch;
    vi.resetModules();
  });

  it("sends the customer's return address as Shipper and the warehouse as Consignee, with RegisterPickup set", async () => {
    let capturedBody: any = null;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      if (url.includes("/token/v1/login")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ JWTToken: "test-jwt" }) };
      }
      if (url.includes("/waybill/v1/GenerateWayBill")) {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ AWBNo: "REV123456789", DestinationArea: "JAI" })
        };
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
    global.fetch = mockFetch as any;

    const { bluedartRegisterReversePickup } = await import("../bluedartClient");

    const result = await bluedartRegisterReversePickup({
      returnId: "SS-RMA-100001",
      shipperName: "Priya Sharma",
      addressLine1: "44 MG Road",
      addressLine2: "Near City Mall, Jaipur, Rajasthan",
      shipperPincode: "302020",
      shipperMobile: "9876543210",
      shipperEmail: "priya@example.com",
      declaredValue: 2999,
      pieceCount: 1
    });

    expect(result.awb).toBe("REV123456789");
    expect(capturedBody).toBeTruthy();

    // Same lowercase `profile` wrapper key pattern as the forward call.
    expect(capturedBody.profile).toBeDefined();
    expect(capturedBody.profile.LoginID).toBe("TESTLOGIN");
    expect(capturedBody.profile.Api_type).toBe("S");
    expect(capturedBody.profile.Version).toBe("1.10");

    const req = capturedBody.request;

    // Shipper = customer's return address (pickup origin) — the swap.
    expect(req.Shipper.CustomerName).toBe("Priya Sharma");
    expect(req.Shipper.CustomerAddress1).toBe("44 MG Road");
    expect(req.Shipper.CustomerPincode).toBe("302020");
    expect(req.Shipper.CustomerMobile).toBe("9876543210");

    // Consignee = our own warehouse (delivery destination) — the swap.
    expect(req.Consignee.ConsigneeName).toBe("Sa and Sha Warehouse");
    expect(req.Consignee.ConsigneeAddress1).toBe("Plot 12, Industrial Area");
    expect(req.Consignee.ConsigneePincode).toBe("302001");

    expect(req.Services.RegisterPickup).toBe(true);
    expect(req.Services.DeclaredValue).toBe(2999);
    expect(req.Services.PieceCount).toBe(1);
  });

  it("surfaces Blue Dart's raw error text on failure instead of swallowing it or faking an AWB", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/token/v1/login")) {
        return { ok: true, status: 200, text: async () => JSON.stringify({ JWTToken: "test-jwt" }) };
      }
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ IsError: true, ErrorMessage: "Invalid Profile credentials" })
      };
    });
    global.fetch = mockFetch as any;

    const { bluedartRegisterReversePickup } = await import("../bluedartClient");

    await expect(
      bluedartRegisterReversePickup({
        returnId: "SS-RMA-100002",
        shipperName: "Test Customer",
        addressLine1: "1 Test Street",
        shipperPincode: "302020",
        shipperMobile: "9876543210"
      })
    ).rejects.toMatchObject({
      name: "BluedartApiError",
      message: expect.stringContaining("Invalid Profile credentials")
    });
  });
});
