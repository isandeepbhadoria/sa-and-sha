export interface CreditNoteNumberingConfig {
  prefix: string;
  separator: string;
  financial_year_format: string;
  sequence_padding: number;
  reset_policy: "ANNUAL_FY";
  is_active: boolean;
  status: "DRAFT" | "ACTIVE";
  updated_at?: string;
  updated_by?: string;
}

export function getDefaultCreditNoteNumberingConfig(): CreditNoteNumberingConfig {
  return {
    prefix: "KLCN",
    separator: "/",
    financial_year_format: "YY-YY",
    sequence_padding: 6,
    reset_policy: "ANNUAL_FY",
    is_active: true,
    status: "ACTIVE"
  };
}

export async function getCreditNoteNumberingConfigFromFirestore(
  db?: any
): Promise<CreditNoteNumberingConfig> {
  if (db) {
    try {
      const docRef = db.collection("credit_note_number_config").doc("default");
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        return {
          prefix: String(data.prefix || "KLCN").trim(),
          separator: String(data.separator || "/").trim(),
          financial_year_format: String(data.financial_year_format || "YY-YY").trim(),
          sequence_padding: Number(data.sequence_padding || 6),
          reset_policy: "ANNUAL_FY",
          is_active: data.is_active !== false,
          status: data.status || "ACTIVE",
          updated_at: data.updated_at,
          updated_by: data.updated_by
        };
      }
    } catch (err) {
      console.warn("Failed to load credit note numbering config from Firestore:", err);
    }
  }
  return getDefaultCreditNoteNumberingConfig();
}
