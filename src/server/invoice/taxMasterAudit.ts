export interface TaxMasterAuditEntry {
  audit_id?: string;
  action:
    | "SELLER_CONFIG_CREATED"
    | "SELLER_CONFIG_UPDATED"
    | "SELLER_CONFIG_ACTIVATED"
    | "PRODUCT_TAX_CREATED"
    | "PRODUCT_TAX_UPDATED"
    | "PRODUCT_TAX_SUPERSEDED"
    | "PRODUCT_TAX_DEACTIVATED"
    | "PRODUCT_TAX_IMPORTED"
    | "SHIPPING_TAX_UPDATED"
    | "INVOICE_NUMBERING_UPDATED";
  entity_type: "seller_gst" | "product_tax" | "shipping_tax" | "invoice_numbering";
  entity_id: string;
  before_summary?: any;
  after_summary?: any;
  admin_id?: string;
  email?: string;
  reason?: string;
  created_at?: string;
}

export async function logTaxMasterAudit(db: any, entry: TaxMasterAuditEntry): Promise<string | null> {
  if (!db) return null;
  try {
    const auditId = entry.audit_id || `audit_tax_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullEntry: TaxMasterAuditEntry = {
      ...entry,
      audit_id: auditId,
      created_at: entry.created_at || new Date().toISOString()
    };

    await db.collection("tax_master_audit").doc(auditId).set(fullEntry);
    return auditId;
  } catch (err) {
    console.error("Failed to write tax master audit log:", err);
    return null;
  }
}
