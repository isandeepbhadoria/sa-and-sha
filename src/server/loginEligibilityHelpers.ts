import crypto from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { Request } from "express";
import { recordCustomerSecurityEvent } from "./sessionManagementHelpers";

// Memory set cache for used challenge nonces (replay resistance)
const usedChallengeNonces = new Set<string>();

/**
 * Resets the in-memory replay protection cache (primarily for unit testing).
 */
export function resetUsedChallengeNonces(): void {
  usedChallengeNonces.clear();
}

function getSecret(): string {
  return (
    process.env.CUSTOMER_VERIFICATION_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    "sa_and_sha_login_challenge_secret_key_2026"
  );
}

export interface LoginChallengePayload {
  ch: "mobile" | "email";
  ih: string; // SHA-256 hash of normalized identifier
  pid: string; // canonical profile ID
  iat: number; // issued at timestamp (ms)
  exp: number; // expires at timestamp (ms)
  n: string;   // random nonce
}

export interface VerifyChallengeResult {
  valid: boolean;
  code?: string;
  error?: string;
  profileId?: string;
  channel?: "mobile" | "email";
}

export interface EligibilityResult {
  success: boolean;
  eligible: boolean;
  loginChallenge?: string;
  expiresIn?: number;
  code?: string;
  message?: string;
}

/**
 * Generates a short-lived signed loginChallenge bound to channel, identifier hash, canonical profile ID, nonce, and expiry.
 */
export function createLoginChallenge(
  channel: "mobile" | "email",
  normalizedIdentifier: string,
  canonicalProfileId: string
): { loginChallenge: string; expiresIn: number } {
  const secret = getSecret();
  const idHash = crypto.createHash("sha256").update(normalizedIdentifier).digest("hex");
  const now = Date.now();
  const expiresInSeconds = 300; // 5 minutes
  const exp = now + expiresInSeconds * 1000;
  const nonce = crypto.randomBytes(16).toString("hex");

  const payload: LoginChallengePayload = {
    ch: channel,
    ih: idHash,
    pid: canonicalProfileId,
    iat: now,
    exp,
    n: nonce
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  const loginChallenge = `c_chal.${payloadB64}.${signature}`;

  return { loginChallenge, expiresIn: expiresInSeconds };
}

/**
 * Verifies and consumes a loginChallenge (preventing replay attacks).
 */
export function verifyAndConsumeLoginChallenge(
  challengeToken: string,
  providerVerifiedIdentifier: string,
  expectedChannel?: "mobile" | "email"
): VerifyChallengeResult {
  if (!challengeToken || typeof challengeToken !== "string" || !challengeToken.trim()) {
    return {
      valid: false,
      code: "LOGIN_CHALLENGE_REQUIRED",
      error: "Login challenge is required for customer portal authentication."
    };
  }

  const parts = challengeToken.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "c_chal") {
    return {
      valid: false,
      code: "LOGIN_CHALLENGE_INVALID",
      error: "Invalid login challenge format."
    };
  }

  const [, payloadB64, signature] = parts;
  const secret = getSecret();
  const expectedSignature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");

  if (signature !== expectedSignature) {
    return {
      valid: false,
      code: "LOGIN_CHALLENGE_INVALID",
      error: "Invalid login challenge signature."
    };
  }

  let payload: LoginChallengePayload;
  try {
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    payload = JSON.parse(jsonStr);
  } catch {
    return {
      valid: false,
      code: "LOGIN_CHALLENGE_INVALID",
      error: "Malformed login challenge payload."
    };
  }

  const now = Date.now();
  if (now > payload.exp) {
    return {
      valid: false,
      code: "LOGIN_CHALLENGE_EXPIRED",
      error: "Login challenge has expired. Please try again."
    };
  }

  if (expectedChannel && payload.ch !== expectedChannel) {
    return {
      valid: false,
      code: "LOGIN_CHALLENGE_CHANNEL_MISMATCH",
      error: "Login challenge channel mismatch."
    };
  }

  if (usedChallengeNonces.has(payload.n)) {
    return {
      valid: false,
      code: "LOGIN_CHALLENGE_REUSED",
      error: "Login challenge has already been used. Please try again."
    };
  }

  // Verify identifier hash against providerVerifiedIdentifier
  let normId = (providerVerifiedIdentifier || "").trim();
  if (payload.ch === "email") {
    normId = normId.toLowerCase();
  } else {
    const digitsOnly = normId.replace(/\D/g, "");
    if (digitsOnly.length === 10) {
      normId = `91${digitsOnly}`;
    } else {
      normId = digitsOnly;
    }
  }

  const computedHash = crypto.createHash("sha256").update(normId).digest("hex");
  if (computedHash !== payload.ih) {
    return {
      valid: false,
      code: "VERIFIED_IDENTIFIER_MISMATCH",
      error: "The verified contact does not match this login request."
    };
  }

  // Mark nonce as used (replay protection)
  usedChallengeNonces.add(payload.n);

  return {
    valid: true,
    profileId: payload.pid,
    channel: payload.ch
  };
}

/**
 * Normalizes input identifier according to channel specifications.
 */
export function normalizeIdentifier(channel: "mobile" | "email", identifier: string): string {
  const raw = (identifier || "").trim();
  if (channel === "email") {
    return raw.toLowerCase();
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Performs server-side eligibility check for customer login.
 */
export async function checkCustomerLoginEligibility(
  adminDb: Firestore,
  channel: "mobile" | "email",
  identifier: string,
  req?: Request
): Promise<EligibilityResult> {
  const normId = normalizeIdentifier(channel, identifier);

  if (channel === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!normId || !emailRegex.test(normId)) {
      return {
        success: true,
        eligible: false,
        code: "ACCOUNT_NOT_FOUND",
        message: "Account not found. We couldn't find a Sa and Sha customer account for these details."
      };
    }
  } else {
    if (!normId || normId.length < 10) {
      return {
        success: true,
        eligible: false,
        code: "ACCOUNT_NOT_FOUND",
        message: "Account not found. We couldn't find a Sa and Sha customer account for these details."
      };
    }
  }

  // Query customer_profiles by normalized identifier
  let querySnap: any = null;
  if (channel === "email") {
    querySnap = await adminDb
      .collection("customer_profiles")
      .where("email_lower", "==", normId)
      .limit(1)
      .get();

    if (querySnap.empty) {
      querySnap = await adminDb
        .collection("customer_profiles")
        .where("email", "==", normId)
        .limit(1)
        .get();
    }
  } else {
    querySnap = await adminDb
      .collection("customer_profiles")
      .where("normalized_phone", "==", normId)
      .limit(1)
      .get();

    if (querySnap.empty) {
      querySnap = await adminDb
        .collection("customer_profiles")
        .where("phone", "==", normId)
        .limit(1)
        .get();
    }
  }

  if (!querySnap || querySnap.empty) {
    if (req) {
      await recordCustomerSecurityEvent(adminDb, {
        customer_profile_id: "unknown",
        customer_id: "unknown",
        event_type: "login_eligibility_rejected",
        auth_method: channel === "email" ? "email_otp" : "mobile_otp",
        outcome: "failure",
        req
      }).catch(() => {});
    }
    return {
      success: true,
      eligible: false,
      code: "ACCOUNT_NOT_FOUND",
      message: "Account not found. We couldn't find a Sa and Sha customer account for these details."
    };
  }

  const profileDoc = querySnap.docs[0];
  let pData = profileDoc.data();
  let canonicalProfileId = profileDoc.id;

  // Check if profile is blocked or deleted
  if (pData.status === "blocked" || pData.is_blocked === true || pData.status === "deleted") {
    if (req) {
      await recordCustomerSecurityEvent(adminDb, {
        customer_profile_id: canonicalProfileId,
        customer_id: pData.customer_id || "unknown",
        event_type: "login_eligibility_rejected",
        auth_method: channel === "email" ? "email_otp" : "mobile_otp",
        outcome: "failure",
        req
      }).catch(() => {});
    }
    return {
      success: true,
      eligible: false,
      code: "ACCOUNT_SETUP_REQUIRED",
      message: "We could not start sign-in with these details. You can create a new Sa and Sha account or check the information entered."
    };
  }

  // Resolve merged profile to canonical profile if applicable
  if ((pData.status === "merged" || pData.merged_into_profile_id) && pData.merged_into_profile_id) {
    const canonicalSnap = await adminDb.collection("customer_profiles").doc(pData.merged_into_profile_id).get();
    if (canonicalSnap.exists) {
      const canonicalData = canonicalSnap.data() || {};
      if (canonicalData.status !== "blocked" && canonicalData.status !== "deleted") {
        canonicalProfileId = canonicalSnap.id;
        pData = canonicalData;
      }
    }
  }

  const { loginChallenge, expiresIn } = createLoginChallenge(channel, normId, canonicalProfileId);

  if (req) {
    await recordCustomerSecurityEvent(adminDb, {
      customer_profile_id: canonicalProfileId,
      customer_id: pData.customer_id || canonicalProfileId,
      event_type: "login_eligibility_checked",
      auth_method: channel === "email" ? "email_otp" : "mobile_otp",
      outcome: "success",
      req
    }).catch(() => {});
  }

  return {
    success: true,
    eligible: true,
    loginChallenge,
    expiresIn
  };
}
