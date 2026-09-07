import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";
import { generateNextCustomerId, removeUndefined, sanitizeString } from "./customerProfileHelpers";
import { createCustomerTimelineEvent } from "./crmHelpers";
import { createOrUpdateIdentityConflict } from "./identityManagementHelpers";
import { createCustomerSession, recordCustomerSecurityEvent } from "./sessionManagementHelpers";
import {
  createGoogleRegistrationToken,
  createMobileVerificationRequiredToken
} from "./registrationHelpers";

const SESSION_SECRET = process.env.CUSTOMER_VERIFICATION_TOKEN_SECRET || "kora_linen_customer_auth_secure_secret_2026";

export interface GoogleAuthResult {
  success: boolean;
  sessionToken?: string;
  profileId?: string;
  customerId?: string;
  isNewCustomer?: boolean;
  profile?: any;
  error?: string;
  code?: string;
  statusCode?: number;
  mobile_verification_required?: boolean;
  verification_token?: string;
  registration_required?: boolean;
  registration_token?: string;
  verified_email?: string;
  google_name?: string;
  suggested_first_name?: string;
  suggested_last_name?: string;
  provider?: string;
  message?: string;
  email?: string;
}

/**
 * SHA-256 Hash of Firebase Google UID
 */
export function hashUid(uid: string): string {
  if (!uid) return "";
  return crypto.createHash("sha256").update(uid.trim()).digest("hex");
}

/**
 * Masked UID Hash for Admin CRM Display
 */
export function maskUidHash(hash: string): string {
  if (!hash || hash.length < 10) return "uid_****";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/**
 * Create cryptographically signed customer session token
 * Format: c_sess.<profileId>.<authMethod>.<expiresAt>.<signature>
 */
export function createCustomerSessionToken(
  profileId: string,
  customerId: string = "",
  authMethod: string = "google",
  expiresInMs: number = 30 * 24 * 60 * 60 * 1000 // 30 days
): string {
  const expiresAt = Date.now() + expiresInMs;
  const payload = `c_sess.${profileId}.${authMethod}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

/**
 * Verify customer session token
 */
export function verifyCustomerSessionToken(token: string): {
  valid: boolean;
  profileId?: string;
  authMethod?: string;
  expired?: boolean;
} {
  if (!token || typeof token !== "string" || !token.startsWith("c_sess.")) {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 5) {
    return { valid: false };
  }

  const [prefix, profileId, authMethod, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return { valid: false, expired: true };
  }

  const payload = `${prefix}.${profileId}.${authMethod}.${expiresAtStr}`;
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false };
  }

  return {
    valid: true,
    profileId,
    authMethod
  };
}

/**
 * Handle server-side Google ID Token verification, identity matching, profile linking/creation
 */
export async function handleGoogleAuthToken(
  adminDb: Firestore,
  adminAuth: Auth,
  idToken: string,
  reqMeta?: { userAgent?: string; ip?: string }
): Promise<GoogleAuthResult> {
  try {
    if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
      return {
        success: false,
        statusCode: 400,
        error: "Google ID token is required for authentication."
      };
    }

    // 1. Verify token with Firebase Admin Auth
    let decodedToken: any = null;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken.trim());
    } catch (authErr: any) {
      console.warn("[GOOGLE AUTH] Firebase ID token verification failed:", authErr?.message);
      return {
        success: false,
        statusCode: 401,
        error: "Invalid or expired Google authentication token. Please sign in again."
      };
    }

    const uid = decodedToken.uid;
    const email = (decodedToken.email || "").toLowerCase().trim();
    const emailVerified = Boolean(decodedToken.email_verified);
    const googleName = sanitizeString(decodedToken.name || "", 150);
    const googlePicture = (decodedToken.picture || "").trim();

    if (!uid) {
      return {
        success: false,
        statusCode: 400,
        error: "Invalid Google token claims: UID missing."
      };
    }

    if (!email || !emailVerified) {
      return {
        success: false,
        statusCode: 400,
        error: "Unverified Google accounts cannot be used for authentication. Please verify your Google account email first."
      };
    }

    const providerUidHash = hashUid(uid);
    const docId = `google_${providerUidHash.slice(0, 32)}`;
    const nowIso = new Date().toISOString();

    // 2. Query customer_auth_identities by provider_uid_hash
    const identityRef = adminDb.collection("customer_auth_identities").doc(docId);
    let identitySnap = await identityRef.get();

    // Fallback search if docId didn't hit
    if (!identitySnap.exists) {
      const qSnap = await adminDb
        .collection("customer_auth_identities")
        .where("provider", "==", "google")
        .where("provider_uid_hash", "==", providerUidHash)
        .limit(1)
        .get();
      if (!qSnap.empty) {
        identitySnap = qSnap.docs[0];
      }
    }

    // Path A: Identity document exists
    if (identitySnap.exists) {
      const identityData = identitySnap.data() || {};
      const targetProfileId = identityData.customer_profile_id;

      if (!targetProfileId) {
        return {
          success: false,
          statusCode: 500,
          error: "Identity record corrupted: missing customer profile reference."
        };
      }

      const profileRef = adminDb.collection("customer_profiles").doc(targetProfileId);
      const profileSnap = await profileRef.get();

      if (!profileSnap.exists) {
        console.warn(`[GOOGLE AUTH] Profile ${targetProfileId} missing for identity ${identitySnap.id}. Re-linking...`);
      } else {
        const profileData = profileSnap.data() || {};

        // Enforce Phase 9C.6: Check if existing profile has verified mobile
        const isMobileVerified = Boolean(
          (profileData.mobile_verified === true || profileData.phone_verified === true) &&
          (profileData.normalized_phone || profileData.phone)
        );

        if (!isMobileVerified) {
          const verificationToken = createMobileVerificationRequiredToken(profileSnap.id, email);
          return {
            success: true,
            mobile_verification_required: true,
            verification_token: verificationToken,
            profileId: profileSnap.id,
            email,
            message: "Mobile verification is required to complete account setup."
          };
        }

        // Update identity last_authenticated_at
        await identityRef.set(
          removeUndefined({
            ...identityData,
            email_lower: email,
            email_verified: true,
            updated_at: nowIso,
            last_authenticated_at: nowIso,
            profile_snapshot: { name: googleName || profileData.full_name, picture: googlePicture }
          }),
          { merge: true }
        );

        // Update profile auth_providers if google is missing
        const existingProviders: string[] = Array.isArray(profileData.auth_providers) ? profileData.auth_providers : ["mobile_otp"];
        if (!existingProviders.includes("google")) {
          existingProviders.push("google");
          await profileRef.update({
            auth_providers: existingProviders,
            updated_at: nowIso
          });
        }

        const sessionToken = createCustomerSessionToken(profileSnap.id, profileData.customer_id || "", "google");

        return {
          success: true,
          sessionToken,
          profileId: profileSnap.id,
          customerId: profileData.customer_id || "",
          isNewCustomer: false,
          profile: { id: profileSnap.id, ...profileData }
        };
      }
    }

    // Path B: Identity doc does NOT exist — Search customer_profiles by email_lower
    const profileEmailSnap = await adminDb
      .collection("customer_profiles")
      .where("email_lower", "==", email)
      .limit(10)
      .get();

    if (!profileEmailSnap.empty) {
      if (profileEmailSnap.docs.length > 1) {
        // Multiple profiles matched for the same verified email address!
        const matchedProfileIds = profileEmailSnap.docs.map((d) => d.id);
        const matchedCustomerIds = profileEmailSnap.docs.map((d) => (d.data() || {}).customer_id || d.id);

        await createOrUpdateIdentityConflict(adminDb, {
          provider: "google",
          provider_uid_hash: providerUidHash,
          verified_email: email,
          matched_profile_ids: matchedProfileIds,
          matched_customer_ids: matchedCustomerIds,
          reason: "MULTIPLE_EMAIL_MATCHES",
          risk_flags: ["MULTIPLE_PROFILES_MATCHED"],
          source: "google_login"
        }).catch((err) => console.warn("[GOOGLE AUTH] Error creating identity conflict record:", err));

        return {
          success: false,
          statusCode: 409,
          code: "ACCOUNT_LINK_REVIEW_REQUIRED",
          error: "Account linking review required. Multiple verified contact methods detected. Please contact customer support."
        };
      }

      // B1: Single existing customer profile matched by email
      const matchedProfileDoc = profileEmailSnap.docs[0];
      const matchedProfileData = matchedProfileDoc.data() || {};
      const matchedProfileId = matchedProfileDoc.id;

      // Conflict Review Check: if profile has account linking conflict flag
      if (matchedProfileData.admin_metadata?.account_link_conflict === true) {
        await createOrUpdateIdentityConflict(adminDb, {
          provider: "google",
          provider_uid_hash: providerUidHash,
          verified_email: email,
          matched_profile_ids: [matchedProfileId],
          matched_customer_ids: [matchedProfileData.customer_id || matchedProfileId],
          reason: "ACCOUNT_LINK_CONFLICT_FLAG_SET",
          risk_flags: ["CONFLICT_FLAG_SET"],
          source: "google_login"
        }).catch((err) => console.warn("[GOOGLE AUTH] Error creating identity conflict record:", err));

        return {
          success: false,
          statusCode: 409,
          code: "ACCOUNT_LINK_REVIEW_REQUIRED",
          error: "Account linking review required. Multiple verified contact methods detected. Please contact customer support."
        };
      }

      // Enforce Phase 9C.6: Check if existing profile has verified mobile
      const isMobileVerified = Boolean(
        (matchedProfileData.mobile_verified === true || matchedProfileData.phone_verified === true || Boolean(matchedProfileData.phone || matchedProfileData.normalized_phone)) &&
        (matchedProfileData.normalized_phone || matchedProfileData.phone)
      );

      if (!isMobileVerified) {
        const verificationToken = createMobileVerificationRequiredToken(matchedProfileId, email);
        return {
          success: true,
          mobile_verification_required: true,
          verification_token: verificationToken,
          profileId: matchedProfileId,
          email,
          message: "Mobile verification is required to complete account setup."
        };
      }

      // Create identity document in customer_auth_identities
      const identityPayload = {
        identity_id: docId,
        provider: "google",
        provider_uid_hash: providerUidHash,
        email,
        email_lower: email,
        email_verified: true,
        customer_profile_id: matchedProfileId,
        customer_id: matchedProfileData.customer_id || "",
        created_at: nowIso,
        updated_at: nowIso,
        last_authenticated_at: nowIso,
        profile_snapshot: { name: googleName, picture: googlePicture }
      };

      await identityRef.set(removeUndefined(identityPayload));

      // Update customer_profiles document cleanly WITHOUT overwriting existing phone/addresses/GST/consent
      const existingProviders: string[] = Array.isArray(matchedProfileData.auth_providers) ? matchedProfileData.auth_providers : ["mobile_otp"];
      if (!existingProviders.includes("google")) {
        existingProviders.push("google");
      }

      const updates: Record<string, any> = {
        auth_providers: existingProviders,
        updated_at: nowIso
      };

      // Fill full_name from Google ONLY if existing profile name is default/generic
      const currentName = matchedProfileData.full_name || "";
      if (googleName && (!currentName || currentName.startsWith("Customer ") || currentName === email.split("@")[0])) {
        updates.full_name = googleName;
      }

      await matchedProfileDoc.ref.update(removeUndefined(updates));

      await createCustomerTimelineEvent(
        adminDb,
        matchedProfileId,
        "google_identity_linked",
        "Google Sign-In Linked",
        `Linked Google account (${email}) to customer profile.`,
        "system"
      ).catch(err => console.warn("Failed to create timeline event:", err));

      const updatedProfileData = { ...matchedProfileData, ...updates };
      const { rawToken: sessionToken } = await createCustomerSession(adminDb, {
        customer_profile_id: matchedProfileId,
        customer_id: matchedProfileData.customer_id || "",
        auth_method: "google",
        userAgentString: reqMeta?.userAgent,
        clientIp: reqMeta?.ip
      });

      return {
        success: true,
        sessionToken,
        profileId: matchedProfileId,
        customerId: matchedProfileData.customer_id || "",
        isNewCustomer: false,
        profile: { id: matchedProfileId, ...updatedProfileData }
      };
    }

    // B2: No existing customer profile matched — Return ACCOUNT_NOT_FOUND
    // DO NOT create customer profile, customer ID, or session until Mobile OTP is verified via /create-account
    const registrationToken = createGoogleRegistrationToken({
      providerUidHash,
      email,
      googleName,
      googlePicture
    });

    const nameParts = (googleName || "").trim().split(/\s+/);
    const suggested_first_name = nameParts[0] || "";
    const suggested_last_name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

    return {
      success: false,
      statusCode: 404,
      code: "ACCOUNT_NOT_FOUND",
      error: "Account not found. We couldn't find a Sa and Sha customer account for these details.",
      registration_required: true,
      registration_token: registrationToken,
      verified_email: email,
      google_name: googleName,
      suggested_first_name,
      suggested_last_name,
      provider: "google"
    };

  } catch (err: any) {
    console.error("Critical error in handleGoogleAuthToken:", err);
    return {
      success: false,
      statusCode: 500,
      error: err?.message || "Internal error during Google authentication."
    };
  }
}
