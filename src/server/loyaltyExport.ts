import { escapeCsvCell } from "./customerProfileHelpers";

/**
 * Builds a consent-neutral CSV operational loyalty report
 */
export async function generateLoyaltyExportCsv(adminDb: any): Promise<string> {
  const snapshot = await adminDb.collection("customer_profiles").get();

  const headers = [
    "Customer ID",
    "Customer Name",
    "Loyalty Tier",
    "Available Points",
    "Pending Points",
    "Store Credit Balance (INR)",
    "Lifetime Points Earned",
    "Lifetime Points Redeemed",
    "Lifetime Store Credit Issued (INR)",
    "Lifetime Store Credit Used (INR)",
    "Last Order Date",
    "Created Date"
  ];

  const rows: string[] = [headers.join(",")];

  snapshot.forEach((docSnap: any) => {
    const data = docSnap.data();
    if (!data) return;

    const customerId = data.customer_id || docSnap.id;
    const name = data.full_name || "Valued Customer";
    const tier = data.loyalty_tier || data.loyalty_summary?.current_tier || "MEMBER";
    const availablePoints = data.loyalty_summary?.available_points || 0;
    const pendingPoints = data.loyalty_summary?.pending_points || 0;
    const creditRupees = data.store_credit_summary?.available_balance_rupees || 0;
    const lifetimeEarned = data.loyalty_summary?.lifetime_points_earned || 0;
    const lifetimeRedeemed = data.loyalty_summary?.lifetime_points_redeemed || 0;
    const creditIssuedRupees = Math.floor((data.store_credit_summary?.lifetime_issued_paise || 0) / 100);
    const creditUsedRupees = Math.floor((data.store_credit_summary?.lifetime_used_paise || 0) / 100);
    const lastOrderAt = data.last_order_at ? new Date(data.last_order_at).toISOString().split("T")[0] : "N/A";
    const createdAt = data.created_at ? new Date(data.created_at).toISOString().split("T")[0] : "N/A";

    const row = [
      escapeCsvCell(customerId),
      escapeCsvCell(name),
      escapeCsvCell(tier),
      availablePoints,
      pendingPoints,
      creditRupees,
      lifetimeEarned,
      lifetimeRedeemed,
      creditIssuedRupees,
      creditUsedRupees,
      escapeCsvCell(lastOrderAt),
      escapeCsvCell(createdAt)
    ];

    rows.push(row.join(","));
  });

  return rows.join("\r\n");
}
