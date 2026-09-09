export interface SellerTaxConfig {
  legal_name: string;
  trade_name: string;
  gstin: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  country: string;
  pan: string;
  support_email: string;
  support_phone: string;
  invoice_prefix: string;
  financial_year: string;
  is_active?: boolean;
  status?: "DRAFT" | "ACTIVE";
  version?: number;
  updated_at?: string;
  updated_by?: string;
}

export interface SellerValidationResult {
  valid: boolean;
  code?: "SELLER_TAX_CONFIGURATION_REQUIRED" | "SELLER_TAX_CONFIGURATION_INVALID";
  error?: string;
  missing_fields?: string[];
  config?: SellerTaxConfig;
}

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const KNOWN_PLACEHOLDERS = [
  "TEST",
  "EXAMPLE",
  "123456789012345",
  "27AABCK1234L1Z9",
  "AABCK1234L",
  "MIDC MUMBAI",
  "XYZ STREET",
  "DUMMY"
];

export function calculateFinancialYear(dateInput?: Date | string): string {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) {
    return calculateFinancialYear(new Date());
  }
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, Jan = 0, Mar = 2, Apr = 3
  // Indian Financial Year: April 1 to March 31
  let startYear = year;
  if (month < 3) {
    startYear = year - 1;
  }
  const endYear = startYear + 1;
  const startStr = startYear.toString().slice(-2);
  const endStr = endYear.toString().slice(-2);
  return `${startStr}-${endStr}`;
}

export function getSellerTaxConfig(): SellerTaxConfig {
  const sellerGstin = (process.env.SELLER_GSTIN || "").trim().toUpperCase();
  const derivedPan = sellerGstin.length === 15 ? sellerGstin.substring(2, 12) : (process.env.SELLER_PAN || "").trim().toUpperCase();

  return {
    legal_name: (process.env.SELLER_LEGAL_NAME || "").trim(),
    trade_name: (process.env.SELLER_TRADE_NAME || "Sa and Sha").trim(),
    gstin: sellerGstin,
    address_line_1: (process.env.SELLER_ADDRESS_LINE1 || "").trim(),
    address_line_2: (process.env.SELLER_ADDRESS_LINE2 || "").trim(),
    city: (process.env.SELLER_CITY || "").trim(),
    state: (process.env.SELLER_STATE || "").trim(),
    state_code: (process.env.SELLER_STATE_CODE || "").trim(),
    pincode: (process.env.SELLER_PINCODE || "").trim(),
    country: (process.env.SELLER_COUNTRY || "India").trim(),
    pan: derivedPan,
    support_email: (process.env.SELLER_SUPPORT_EMAIL || "shop@sa-and-sha.com").trim(),
    support_phone: (process.env.SELLER_SUPPORT_PHONE || "+91 98765 43210").trim(),
    invoice_prefix: (process.env.SELLER_INVOICE_PREFIX || "SS").trim(),
    financial_year: calculateFinancialYear(new Date()),
    is_active: true,
    status: "ACTIVE"
  };
}

export function validateSellerTaxConfig(config?: SellerTaxConfig): SellerValidationResult {
  const cfg = config || getSellerTaxConfig();
  const missingFields: string[] = [];

  if (!cfg.legal_name) missingFields.push("SELLER_LEGAL_NAME");
  if (!cfg.gstin) missingFields.push("SELLER_GSTIN");
  if (!cfg.state_code) missingFields.push("SELLER_STATE_CODE");
  if (!cfg.state) missingFields.push("SELLER_STATE");
  if (!cfg.address_line_1) missingFields.push("SELLER_ADDRESS_LINE1");
  if (!cfg.city) missingFields.push("SELLER_CITY");
  if (!cfg.pincode) missingFields.push("SELLER_PINCODE");

  if (missingFields.length > 0) {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_REQUIRED",
      error: `Unconfigured seller tax metadata: Missing ${missingFields.join(", ")}. Seller tax configuration required before invoice finalization.`,
      missing_fields: missingFields
    };
  }

  // Check if status is ACTIVE / is_active is true
  if (cfg.status && cfg.status !== "ACTIVE") {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_INVALID",
      error: `Seller tax configuration status is '${cfg.status}' (expected 'ACTIVE').`,
      missing_fields: ["status"]
    };
  }
  if (cfg.is_active === false) {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_INVALID",
      error: "Seller tax configuration is inactive.",
      missing_fields: ["is_active"]
    };
  }

  // Check for placeholder strings
  const textToCheck = [
    cfg.legal_name,
    cfg.trade_name,
    cfg.gstin,
    cfg.address_line_1,
    cfg.city,
    cfg.pan
  ].join(" ").toUpperCase();

  for (const ph of KNOWN_PLACEHOLDERS) {
    if (textToCheck.includes(ph)) {
      return {
        valid: false,
        code: "SELLER_TAX_CONFIGURATION_INVALID",
        error: `Seller tax configuration contains unverified or placeholder value '${ph}'. Verified seller tax master entry is required.`,
        missing_fields: ["SELLER_GSTIN", "SELLER_LEGAL_NAME"]
      };
    }
  }

  // Validate GSTIN format
  if (!GSTIN_REGEX.test(cfg.gstin)) {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_INVALID",
      error: `Invalid seller GSTIN format: '${cfg.gstin}'. Expected 15-character GSTIN (e.g., 27AABCK1234L1Z9).`,
      missing_fields: ["SELLER_GSTIN"]
    };
  }

  // Validate state prefix matches state_code
  const gstinStatePrefix = cfg.gstin.substring(0, 2);
  const normalizedStateCode = cfg.state_code.padStart(2, "0");
  if (gstinStatePrefix !== normalizedStateCode) {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_INVALID",
      error: `Seller GSTIN state prefix '${gstinStatePrefix}' does not match configured state code '${cfg.state_code}'.`,
      missing_fields: ["SELLER_STATE_CODE", "SELLER_GSTIN"]
    };
  }

  // Validate PAN format
  const panToTest = cfg.pan || (cfg.gstin.length === 15 ? cfg.gstin.substring(2, 12) : "");
  if (!PAN_REGEX.test(panToTest)) {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_INVALID",
      error: `Invalid seller PAN format: '${panToTest}'. Expected 10-character PAN.`,
      missing_fields: ["SELLER_PAN"]
    };
  }

  // Validate Pincode format
  if (!PINCODE_REGEX.test(cfg.pincode)) {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_INVALID",
      error: `Invalid seller pincode format: '${cfg.pincode}'. Expected 6-digit Indian postal code.`,
      missing_fields: ["SELLER_PINCODE"]
    };
  }

  // Validate invoice prefix
  if (!cfg.invoice_prefix || !/^[A-Z0-9\-_]{1,10}$/i.test(cfg.invoice_prefix)) {
    return {
      valid: false,
      code: "SELLER_TAX_CONFIGURATION_INVALID",
      error: `Invalid invoice prefix '${cfg.invoice_prefix}'. Must be 1-10 alphanumeric characters.`,
      missing_fields: ["SELLER_INVOICE_PREFIX"]
    };
  }

  return {
    valid: true,
    config: cfg
  };
}

/**
 * Loads seller tax configuration from Firestore system_tax_config/seller_gst,
 * falling back to environment variables if doc is missing.
 */
export async function getSellerTaxConfigFromFirestore(db?: any): Promise<SellerTaxConfig> {
  if (db) {
    try {
      const docRef = db.collection("system_tax_config").doc("seller_gst");
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const sellerGstin = (data.gstin || "").trim().toUpperCase();
        const derivedPan = data.pan || (sellerGstin.length === 15 ? sellerGstin.substring(2, 12) : "");
        return {
          legal_name: (data.legal_name || "").trim(),
          trade_name: (data.trade_name || "Sa and Sha").trim(),
          gstin: sellerGstin,
          address_line_1: (data.address_line_1 || data.registered_address_line_1 || "").trim(),
          address_line_2: (data.address_line_2 || data.registered_address_line_2 || "").trim(),
          city: (data.city || "").trim(),
          state: (data.state || "").trim(),
          state_code: (data.state_code || "").trim(),
          pincode: (data.pincode || "").trim(),
          country: (data.country || "India").trim(),
          pan: derivedPan,
          support_email: (data.support_email || "shop@sa-and-sha.com").trim(),
          support_phone: (data.support_phone || "+91 98765 43210").trim(),
          invoice_prefix: (data.invoice_prefix || "SS").trim(),
          financial_year: calculateFinancialYear(new Date()),
          is_active: data.is_active !== false,
          status: data.status || "ACTIVE",
          version: data.version || 1,
          updated_at: data.updated_at,
          updated_by: data.updated_by
        };
      }
    } catch (err) {
      console.warn("Failed to load seller tax config from Firestore:", err);
    }
  }
  return getSellerTaxConfig();
}
