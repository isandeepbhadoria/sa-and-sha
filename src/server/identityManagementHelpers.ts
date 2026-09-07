import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { generateNextCustomerId, removeUndefined, sanitizeString } from "./customerProfileHelpers";
import { createCustomerTimelineEvent } from "./crmHelpers";

export interface IdentityConflict {
  conflict_id: string;
  provider: "google" | "mobile_otp";
  provider_uid_hash: string;
  verified_email: string;
  matched_profile_ids: string[];
  matched_customer_ids: string[];
  reason: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "resolved" | "cancelled";
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
  reviewed_by?: string | null;
  resolution_action?: string | null;
  canonical_profile_id?: string | null;
  notes?: string | null;
  risk_flags: string[];
  source: string;
}

export interface IdentityAuditRecord {
  audit_id: string;
  action:
    | "conflict_created"
    | "review_started"
    | "preview_generated"
    | "merge_approved"
    | "merge_completed"
    | "merge_rejected"
    | "identity_linked"
    | "identity_unlinked"
    | "conflict_cancelled";
  conflict_id?: string | null;
  provider: string;
  canonical_profile_id?: string | null;
  affected_profile_ids: string[];
  admin_email: string;
  reason?: string | null;
  outcome: "SUCCESS" | "BLOCKED" | "REJECTED" | "FAILED";
  before_summary?: any;
  after_summary?: any;
  created_at: string;
  request_id?: string | null;
  metadata?: any;
}

export interface MergePreviewResult {
  conflict_id: string;
  can_merge: boolean;
  canonical_profile: any;
  duplicate_profiles: any[];
  field_classifications: {
    field: string;
    classification: "KEEP_CANONICAL" | "FILL_MISSING" | "COMBINE" | "CONFLICT" | "BLOCKED";
    canonical_value: any;
    duplicate_values: any[];
    resolved_value: any;
    notes?: string;
  }[];
  summary_totals: {
    total_orders: number;
    lifetime_spend: number;
    addresses_count: number;
    loyalty_points: number;
  };
  blocking_reasons: string[];
}

/**
 * Log immutable audit record in customer_identity_audit collection
 */
export async function recordIdentityAudit(
  adminDb: Firestore,
  params: Omit<IdentityAuditRecord, "audit_id" | "created_at">
): Promise<string> {
  const auditId = `aud_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const nowIso = new Date().toISOString();

  const auditDoc: IdentityAuditRecord = {
    audit_id: auditId,
    created_at: nowIso,
    ...params
  };

  await adminDb
    .collection("customer_identity_audit")
    .doc(auditId)
    .set(removeUndefined(auditDoc));

  return auditId;
}

/**
 * Create or update idempotent identity conflict record
 */
export async function createOrUpdateIdentityConflict(
  adminDb: Firestore,
  params: {
    provider: "google" | "mobile_otp";
    provider_uid_hash: string;
    verified_email: string;
    matched_profile_ids: string[];
    matched_customer_ids: string[];
    reason: string;
    risk_flags?: string[];
    source?: string;
    admin_email?: string;
  }
): Promise<{ conflictId: string; created: boolean }> {
  const emailLower = (params.verified_email || "").toLowerCase().trim();
  const providerUidHash = params.provider_uid_hash || "";

  // Deterministic conflict key to enforce idempotency
  const conflictKey = `cnf_${crypto.createHash("sha256").update(`${params.provider}:${emailLower}:${providerUidHash}`).digest("hex").slice(0, 24)}`;
  const conflictRef = adminDb.collection("customer_identity_conflicts").doc(conflictKey);
  const conflictSnap = await conflictRef.get();

  const nowIso = new Date().toISOString();

  if (conflictSnap.exists) {
    const existing = conflictSnap.data() as IdentityConflict;
    // Update existing conflict if pending or under_review
    if (existing.status === "pending" || existing.status === "under_review") {
      const updatedProfiles = Array.from(new Set([...existing.matched_profile_ids, ...params.matched_profile_ids]));
      const updatedCustomerIds = Array.from(new Set([...existing.matched_customer_ids, ...params.matched_customer_ids]));
      const updatedRiskFlags = Array.from(new Set([...(existing.risk_flags || []), ...(params.risk_flags || [])]));

      await conflictRef.update(
        removeUndefined({
          matched_profile_ids: updatedProfiles,
          matched_customer_ids: updatedCustomerIds,
          risk_flags: updatedRiskFlags,
          updated_at: nowIso
        })
      );
    }
    return { conflictId: conflictKey, created: false };
  }

  const newConflict: IdentityConflict = {
    conflict_id: conflictKey,
    provider: params.provider,
    provider_uid_hash: providerUidHash,
    verified_email: emailLower,
    matched_profile_ids: params.matched_profile_ids,
    matched_customer_ids: params.matched_customer_ids,
    reason: params.reason,
    status: "pending",
    created_at: nowIso,
    updated_at: nowIso,
    risk_flags: params.risk_flags || ["MULTIPLE_PROFILES_MATCHED"],
    source: params.source || "customer_login"
  };

  await conflictRef.set(removeUndefined(newConflict));

  await recordIdentityAudit(adminDb, {
    action: "conflict_created",
    conflict_id: conflictKey,
    provider: params.provider,
    affected_profile_ids: params.matched_profile_ids,
    admin_email: params.admin_email || "system",
    reason: params.reason,
    outcome: "SUCCESS",
    after_summary: {
      matched_customer_ids: params.matched_customer_ids,
      verified_email: emailLower
    }
  }).catch((err) => console.warn("Failed to record identity audit:", err));

  return { conflictId: conflictKey, created: true };
}

/**
 * List conflicts with pagination and filters
 */
export async function listIdentityConflicts(
  adminDb: Firestore,
  queryOptions: {
    status?: string;
    provider?: string;
    email?: string;
    customer_id?: string;
    limit?: number;
    startAfterId?: string;
  }
) {
  let query: any = adminDb.collection("customer_identity_conflicts");

  if (queryOptions.status && queryOptions.status !== "ALL") {
    query = query.where("status", "==", queryOptions.status);
  }
  if (queryOptions.provider && queryOptions.provider !== "ALL") {
    query = query.where("provider", "==", queryOptions.provider);
  }

  const limitNum = Math.min(Math.max(queryOptions.limit || 50, 1), 100);
  query = query.orderBy("created_at", "desc").limit(limitNum);

  if (queryOptions.startAfterId) {
    const docSnap = await adminDb.collection("customer_identity_conflicts").doc(queryOptions.startAfterId).get();
    if (docSnap.exists) {
      query = query.startAfter(docSnap);
    }
  }

  const snap = await query.get();
  let conflicts = snap.docs.map((d: any) => d.data() as IdentityConflict);

  // Client-side search filters if required
  if (queryOptions.email) {
    const e = queryOptions.email.toLowerCase();
    conflicts = conflicts.filter((c) => c.verified_email.includes(e));
  }
  if (queryOptions.customer_id) {
    const cid = queryOptions.customer_id.toUpperCase();
    conflicts = conflicts.filter((c) => (c.matched_customer_ids || []).some((id) => id.includes(cid)));
  }

  return conflicts;
}

/**
 * Fetch conflict details with rich profile summaries
 */
export async function getIdentityConflictDetails(
  adminDb: Firestore,
  conflictId: string
) {
  const conflictRef = adminDb.collection("customer_identity_conflicts").doc(conflictId);
  const snap = await conflictRef.get();

  if (!snap.exists) return null;

  const conflict = snap.data() as IdentityConflict;

  const profiles: any[] = [];
  for (const pid of conflict.matched_profile_ids) {
    const pSnap = await adminDb.collection("customer_profiles").doc(pid).get();
    if (pSnap.exists) {
      const pData = pSnap.data() || {};
      
      // Get order count for this profile
      const ordersSnap = await adminDb
        .collection("customer_orders")
        .where("customer_profile_id", "==", pid)
        .get();

      profiles.push({
        profile_id: pid,
        customer_id: pData.customer_id || "",
        full_name: pData.full_name || "",
        email: pData.email || "",
        phone: pData.phone || "",
        normalized_phone: pData.normalized_phone || "",
        auth_providers: pData.auth_providers || [],
        created_at: pData.created_at || "",
        updated_at: pData.updated_at || "",
        gstin: pData.gstin || pData.business_details?.gstin || "",
        company_name: pData.company_name || pData.business_details?.company_name || "",
        addresses_count: (pData.addresses || []).length,
        orders_count: ordersSnap.size,
        lifetime_spend: pData.commerce_summary?.lifetime_spend || 0,
        loyalty_points: pData.loyalty_points || 0,
        admin_metadata: pData.admin_metadata || {},
        merged_into_profile_id: pData.merged_into_profile_id || null
      });
    }
  }

  return {
    conflict,
    profiles
  };
}

/**
 * Generate Merge Preview
 */
export async function generateMergePreview(
  adminDb: Firestore,
  conflictId: string,
  canonicalProfileId?: string
): Promise<MergePreviewResult> {
  const details = await getIdentityConflictDetails(adminDb, conflictId);
  if (!details) {
    throw new Error(`Conflict ${conflictId} not found.`);
  }

  const { conflict, profiles } = details;
  if (profiles.length < 2) {
    throw new Error("Merge preview requires at least 2 matched customer profiles.");
  }

  // Determine canonical profile
  let canonical = profiles.find((p) => p.profile_id === canonicalProfileId);
  if (!canonical) {
    // Default canonical: oldest profile or profile with customer_id
    canonical = [...profiles].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  }

  const duplicates = profiles.filter((p) => p.profile_id !== canonical.profile_id);

  const fieldClassifications: MergePreviewResult["field_classifications"] = [];
  const blockingReasons: string[] = [];

  // Rule 1: Check Verified Mobile Phone Numbers
  const canonicalPhone = canonical.normalized_phone || canonical.phone || "";
  const duplicatePhones = duplicates
    .map((d) => d.normalized_phone || d.phone || "")
    .filter((ph) => Boolean(ph));

  const uniquePhones = Array.from(new Set([canonicalPhone, ...duplicatePhones].filter(Boolean)));

  if (uniquePhones.length > 1) {
    fieldClassifications.push({
      field: "verified_phone",
      classification: "BLOCKED",
      canonical_value: canonicalPhone || "(none)",
      duplicate_values: duplicatePhones,
      resolved_value: null,
      notes: "Different verified mobile numbers detected across profiles. Automatic merge is blocked to prevent account takeover."
    });
    blockingReasons.push("VERIFIED_PHONE_CONFLICT: Profiles have different verified mobile phone numbers.");
  } else if (uniquePhones.length === 1) {
    fieldClassifications.push({
      field: "verified_phone",
      classification: "KEEP_CANONICAL",
      canonical_value: canonicalPhone,
      duplicate_values: duplicatePhones,
      resolved_value: uniquePhones[0]
    });
  } else {
    fieldClassifications.push({
      field: "verified_phone",
      classification: "FILL_MISSING",
      canonical_value: "",
      duplicate_values: [],
      resolved_value: ""
    });
  }

  // Rule 2: Customer ID
  fieldClassifications.push({
    field: "customer_id",
    classification: "KEEP_CANONICAL",
    canonical_value: canonical.customer_id,
    duplicate_values: duplicates.map((d) => d.customer_id),
    resolved_value: canonical.customer_id
  });

  // Rule 3: Full Name
  const canonicalName = canonical.full_name;
  const fillName = duplicates.find((d) => d.full_name && !canonicalName.startsWith("Customer "))?.full_name;
  fieldClassifications.push({
    field: "full_name",
    classification: canonicalName ? "KEEP_CANONICAL" : "FILL_MISSING",
    canonical_value: canonicalName,
    duplicate_values: duplicates.map((d) => d.full_name),
    resolved_value: canonicalName || fillName || "Valued Customer"
  });

  // Rule 4: GST & Business Details
  const canonicalGst = canonical.gstin;
  const duplicateGsts = duplicates.map((d) => d.gstin).filter(Boolean);
  if (canonicalGst && duplicateGsts.length > 0 && duplicateGsts.some((g) => g !== canonicalGst)) {
    fieldClassifications.push({
      field: "gstin",
      classification: "CONFLICT",
      canonical_value: canonicalGst,
      duplicate_values: duplicateGsts,
      resolved_value: canonicalGst,
      notes: "Different GSTIN numbers detected. Keeping canonical profile GSTIN."
    });
  } else {
    fieldClassifications.push({
      field: "gstin",
      classification: canonicalGst ? "KEEP_CANONICAL" : duplicateGsts[0] ? "FILL_MISSING" : "KEEP_CANONICAL",
      canonical_value: canonicalGst,
      duplicate_values: duplicateGsts,
      resolved_value: canonicalGst || duplicateGsts[0] || ""
    });
  }

  // Rule 5: Loyalty Points
  const canonicalLoyalty = Number(canonical.loyalty_points) || 0;
  const duplicateLoyalties = duplicates.map((d) => Number(d.loyalty_points) || 0);
  const combinedLoyalty = canonicalLoyalty + duplicateLoyalties.reduce((a, b) => a + b, 0);
  fieldClassifications.push({
    field: "loyalty_points",
    classification: "COMBINE",
    canonical_value: canonicalLoyalty,
    duplicate_values: duplicateLoyalties,
    resolved_value: combinedLoyalty,
    notes: "Combining loyalty point balances safely."
  });

  // Rule 6: Orders & Commerce Summary
  const totalOrders = canonical.orders_count + duplicates.reduce((sum, d) => sum + d.orders_count, 0);
  const totalSpend = canonical.lifetime_spend + duplicates.reduce((sum, d) => sum + d.lifetime_spend, 0);
  fieldClassifications.push({
    field: "commerce_summary",
    classification: "COMBINE",
    canonical_value: { orders: canonical.orders_count, spend: canonical.lifetime_spend },
    duplicate_values: duplicates.map((d) => ({ orders: d.orders_count, spend: d.lifetime_spend })),
    resolved_value: { orders: totalOrders, spend: totalSpend }
  });

  // Rule 7: Addresses Count
  const totalAddresses = canonical.addresses_count + duplicates.reduce((sum, d) => sum + d.addresses_count, 0);
  fieldClassifications.push({
    field: "addresses",
    classification: "COMBINE",
    canonical_value: canonical.addresses_count,
    duplicate_values: duplicates.map((d) => d.addresses_count),
    resolved_value: `${totalAddresses} addresses (deduplicated during merge)`
  });

  const canMerge = blockingReasons.length === 0;

  return {
    conflict_id: conflictId,
    can_merge: canMerge,
    canonical_profile: canonical,
    duplicate_profiles: duplicates,
    field_classifications: fieldClassifications,
    summary_totals: {
      total_orders: totalOrders,
      lifetime_spend: totalSpend,
      addresses_count: totalAddresses,
      loyalty_points: combinedLoyalty
    },
    blocking_reasons: blockingReasons
  };
}

/**
 * Execute Transactional Profile Merge
 */
export async function executeProfileMergeTransaction(
  adminDb: Firestore,
  params: {
    conflictId: string;
    canonicalProfileId: string;
    expectedStatus?: string;
    expectedUpdatedAt?: string;
    confirmationText: string;
    adminEmail: string;
    reason: string;
  }
): Promise<{ success: boolean; canonicalProfileId: string; auditId: string }> {
  if (params.confirmationText !== "MERGE CUSTOMER PROFILES") {
    throw new Error("Invalid confirmation phrase. Must be exactly 'MERGE CUSTOMER PROFILES'.");
  }

  const conflictRef = adminDb.collection("customer_identity_conflicts").doc(params.conflictId);

  // Use transaction for optimistic locking and atomicity
  return await adminDb.runTransaction(async (transaction) => {
    const conflictSnap = await transaction.get(conflictRef);
    if (!conflictSnap.exists) {
      throw new Error(`Conflict record ${params.conflictId} not found.`);
    }

    const conflict = conflictSnap.data() as IdentityConflict;

    // Check status / version stale locking
    if (params.expectedStatus && conflict.status !== params.expectedStatus) {
      const err: any = new Error("Conflict state updated by another process. Please refresh.");
      err.code = "IDENTITY_CONFLICT_UPDATED";
      err.statusCode = 409;
      throw err;
    }

    if (conflict.status === "resolved") {
      throw new Error("This conflict has already been resolved.");
    }

    const matchedIds = conflict.matched_profile_ids || [];
    if (!matchedIds.includes(params.canonicalProfileId)) {
      throw new Error("Selected canonical profile ID is not part of this conflict record.");
    }

    const duplicateProfileIds = matchedIds.filter((id) => id !== params.canonicalProfileId);

    // Fetch canonical profile
    const canonicalRef = adminDb.collection("customer_profiles").doc(params.canonicalProfileId);
    const canonicalSnap = await transaction.get(canonicalRef);
    if (!canonicalSnap.exists) {
      throw new Error(`Canonical profile ${params.canonicalProfileId} does not exist.`);
    }

    const canonicalData = canonicalSnap.data() || {};
    const canonicalPhone = canonicalData.normalized_phone || canonicalData.phone || "";

    // Fetch duplicate profiles
    const duplicateDocs: any[] = [];
    for (const dupId of duplicateProfileIds) {
      const dupRef = adminDb.collection("customer_profiles").doc(dupId);
      const dupSnap = await transaction.get(dupRef);
      if (dupSnap.exists) {
        duplicateDocs.push({ id: dupId, ref: dupRef, data: dupSnap.data() || {} });
      }
    }

    // BLOCKING CHECK: Mobile Phone Conflict
    for (const dup of duplicateDocs) {
      const dupPhone = dup.data.normalized_phone || dup.data.phone || "";
      if (canonicalPhone && dupPhone && canonicalPhone !== dupPhone) {
        const err: any = new Error("VERIFIED_PHONE_CONFLICT: Profiles have different verified phone numbers.");
        err.code = "VERIFIED_PHONE_CONFLICT";
        err.statusCode = 400;
        throw err;
      }
    }

    const nowIso = new Date().toISOString();

    // 1. Relink customer_orders
    const ordersToRelinkSnap = await adminDb
      .collection("customer_orders")
      .where("customer_profile_id", "in", duplicateProfileIds)
      .get();

    ordersToRelinkSnap.docs.forEach((orderDoc) => {
      transaction.update(orderDoc.ref, {
        customer_profile_id: params.canonicalProfileId,
        relinked_from_profile_id: orderDoc.data().customer_profile_id,
        relinked_at: nowIso,
        relinked_by: params.adminEmail
      });
    });

    // 2. Deduplicate addresses
    const existingAddresses: any[] = canonicalData.addresses || [];
    const newAddresses: any[] = [...existingAddresses];

    for (const dup of duplicateDocs) {
      const dupAddresses: any[] = dup.data.addresses || [];
      dupAddresses.forEach((addr) => {
        const isDup = newAddresses.some(
          (existing) =>
            existing.pincode === addr.pincode &&
            (existing.address_line1 || "").toLowerCase() === (addr.address_line1 || "").toLowerCase()
        );
        if (!isDup) {
          newAddresses.push({ ...addr, id: addr.id || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}` });
        }
      });
    }

    // 3. Combine Loyalty Points
    let totalLoyalty = Number(canonicalData.loyalty_points) || 0;
    for (const dup of duplicateDocs) {
      totalLoyalty += Number(dup.data.loyalty_points) || 0;
    }

    // 4. Auth providers
    const existingProviders: string[] = Array.isArray(canonicalData.auth_providers) ? canonicalData.auth_providers : [];
    const allProviders = Array.from(
      new Set([
        ...existingProviders,
        "google",
        ...duplicateDocs.flatMap((d) => d.data.auth_providers || [])
      ])
    );

    // 5. Commerce Summary Recalculation
    let totalOrders = (canonicalData.commerce_summary?.total_orders || 0);
    let lifetimeSpend = (canonicalData.commerce_summary?.lifetime_spend || 0);

    for (const dup of duplicateDocs) {
      totalOrders += (dup.data.commerce_summary?.total_orders || 0);
      lifetimeSpend += (dup.data.commerce_summary?.lifetime_spend || 0);
    }

    const updatedCommerceSummary = {
      ...canonicalData.commerce_summary,
      total_orders: totalOrders,
      lifetime_spend: lifetimeSpend,
      last_calculated_at: nowIso
    };

    // Update Canonical Profile
    transaction.update(
      canonicalRef,
      removeUndefined({
        addresses: newAddresses,
        loyalty_points: totalLoyalty,
        auth_providers: allProviders,
        commerce_summary: updatedCommerceSummary,
        updated_at: nowIso
      })
    );

    // Mark Duplicate Profiles as MERGED (not deleted)
    for (const dup of duplicateDocs) {
      transaction.update(
        dup.ref,
        removeUndefined({
          status: "merged",
          merged_into_profile_id: params.canonicalProfileId,
          merged_at: nowIso,
          merged_by: params.adminEmail,
          merge_conflict_id: params.conflictId,
          updated_at: nowIso
        })
      );
    }

    // Relink Auth Identity documents in customer_auth_identities
    const identitiesSnap = await adminDb
      .collection("customer_auth_identities")
      .where("customer_profile_id", "in", duplicateProfileIds)
      .get();

    identitiesSnap.docs.forEach((idDoc) => {
      transaction.update(idDoc.ref, {
        customer_profile_id: params.canonicalProfileId,
        customer_id: canonicalData.customer_id || "",
        updated_at: nowIso
      });
    });

    // Update Conflict Document Status
    transaction.update(
      conflictRef,
      removeUndefined({
        status: "resolved",
        resolution_action: "merged",
        canonical_profile_id: params.canonicalProfileId,
        resolved_at: nowIso,
        resolved_by: params.adminEmail,
        updated_at: nowIso,
        notes: params.reason
      })
    );

    // Audit Record
    const auditId = `aud_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const auditDocRef = adminDb.collection("customer_identity_audit").doc(auditId);

    transaction.set(
      auditDocRef,
      removeUndefined({
        audit_id: auditId,
        action: "merge_completed",
        conflict_id: params.conflictId,
        provider: conflict.provider,
        canonical_profile_id: params.canonicalProfileId,
        affected_profile_ids: duplicateProfileIds,
        admin_email: params.adminEmail,
        reason: params.reason,
        outcome: "SUCCESS",
        before_summary: {
          canonical_id: params.canonicalProfileId,
          duplicate_ids: duplicateProfileIds
        },
        after_summary: {
          relinked_orders: ordersToRelinkSnap.size,
          combined_loyalty: totalLoyalty,
          addresses_count: newAddresses.length
        },
        created_at: nowIso
      })
    );

    return {
      success: true,
      canonicalProfileId: params.canonicalProfileId,
      auditId
    };
  });
}
