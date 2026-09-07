export interface ShippingTaxConfig {
  enabled: boolean;
  hsn_or_sac_code: string;
  gst_rate: number;
  tax_category: string;
  effective_from: string;
  effective_to?: string | null;
  status: "DRAFT" | "ACTIVE";
  version?: number;
  updated_at?: string;
  updated_by?: string;
}

export interface ShippingTaxValidationResult {
  valid: boolean;
  code?: "INVOICE_TAX_METADATA_MISSING";
  error?: string;
  config?: ShippingTaxConfig;
}

export function getDefaultShippingTaxConfig(): ShippingTaxConfig {
  return {
    enabled: true,
    hsn_or_sac_code: "996812",
    gst_rate: 18,
    tax_category: "COURIER_SERVICES",
    effective_from: new Date(0).toISOString(),
    status: "ACTIVE"
  };
}

export function validateShippingTaxConfig(config?: ShippingTaxConfig | null): ShippingTaxValidationResult {
  if (!config) {
    return {
      valid: false,
      code: "INVOICE_TAX_METADATA_MISSING",
      error: "No active approved shipping tax configuration found in master settings."
    };
  }

  const cfg = config;

  if (!cfg.enabled) {
    return {
      valid: false,
      code: "INVOICE_TAX_METADATA_MISSING",
      error: "Shipping tax calculation is disabled in tax configuration."
    };
  }

  if (cfg.status !== "ACTIVE") {
    return {
      valid: false,
      code: "INVOICE_TAX_METADATA_MISSING",
      error: `Shipping tax configuration status is '${cfg.status}' (expected 'ACTIVE').`
    };
  }

  if (!cfg.hsn_or_sac_code || !/^[0-9]{4,8}$/.test(cfg.hsn_or_sac_code)) {
    return {
      valid: false,
      code: "INVOICE_TAX_METADATA_MISSING",
      error: `Invalid shipping HSN/SAC code '${cfg.hsn_or_sac_code}'. Expected 4 to 8 digits.`
    };
  }

  if (typeof cfg.gst_rate !== "number" || isNaN(cfg.gst_rate) || cfg.gst_rate < 0) {
    return {
      valid: false,
      code: "INVOICE_TAX_METADATA_MISSING",
      error: `Invalid shipping GST rate '${cfg.gst_rate}'. Must be a non-negative number.`
    };
  }

  return {
    valid: true,
    config: cfg
  };
}

export async function getShippingTaxConfigFromFirestore(db?: any): Promise<ShippingTaxConfig | null> {
  if (db) {
    try {
      const docRef = db.collection("shipping_tax_config").doc("default");
      const docSnap = await docRef.get();
      if (docSnap && docSnap.exists) {
        const data = docSnap.data();
        if (!data || data.enabled === false || data.status !== "ACTIVE") {
          return null;
        }
        return {
          enabled: true,
          hsn_or_sac_code: String(data.hsn_or_sac_code || "").trim(),
          gst_rate: Number(data.gst_rate),
          tax_category: data.tax_category || "COURIER_SERVICES",
          effective_from: data.effective_from || new Date(0).toISOString(),
          effective_to: data.effective_to || null,
          status: "ACTIVE",
          version: data.version || 1,
          updated_at: data.updated_at,
          updated_by: data.updated_by
        };
      }
    } catch (err) {
      console.warn("Failed to load shipping tax config from Firestore:", err);
    }
  }
  return null;
}
