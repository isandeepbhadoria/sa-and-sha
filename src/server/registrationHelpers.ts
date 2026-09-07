import crypto from "crypto";

function getSecret(): string {
  return (
    process.env.CUSTOMER_VERIFICATION_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    "kora_linen_registration_secret_key_2026"
  );
}

/**
 * Server-side guard to enforce the permanent Phase 9C.6 invariant:
 * No customer profile may be created without a verified mobile number via MSG91.
 */
export function assertNewCustomerCreationAllowed(params: {
  normalizedPhone?: string;
  mobileVerified?: boolean;
  verificationSource?: string;
}): void {
  const phone = (params.normalizedPhone || "").trim();
  if (!phone || params.mobileVerified !== true || params.verificationSource !== "msg91_mobile_otp") {
    const err: any = new Error("Mobile number verification via MSG91 OTP is mandatory before creating a new Sa and Sha customer account.");
    err.code = "MOBILE_VERIFICATION_REQUIRED";
    err.statusCode = 400;
    throw err;
  }
}

export interface GoogleRegistrationPayload {
  provider: "google";
  provider_uid_hash: string;
  verified_email: string;
  verified_email_hash: string;
  google_name?: string;
  google_picture?: string;
  purpose: "google_registration";
  issued_at: number;
  expires_at: number;
  nonce: string;
}

export function createGoogleRegistrationToken(params: {
  providerUidHash: string;
  email: string;
  googleName?: string;
  googlePicture?: string;
}): string {
  const secret = getSecret();
  const now = Date.now();
  const exp = now + 15 * 60 * 1000; // 15 minutes
  const nonce = crypto.randomBytes(16).toString("hex");
  const emailHash = crypto.createHash("sha256").update(params.email.toLowerCase()).digest("hex");

  const payload: GoogleRegistrationPayload = {
    provider: "google",
    provider_uid_hash: params.providerUidHash,
    verified_email: params.email.toLowerCase(),
    verified_email_hash: emailHash,
    google_name: params.googleName,
    google_picture: params.googlePicture,
    purpose: "google_registration",
    issued_at: now,
    expires_at: exp,
    nonce
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `g_reg.${payloadB64}.${signature}`;
}

export function verifyGoogleRegistrationToken(token: string): {
  valid: boolean;
  code?: string;
  error?: string;
  payload?: GoogleRegistrationPayload;
} {
  if (!token || typeof token !== "string" || !token.trim()) {
    return { valid: false, code: "TOKEN_REQUIRED", error: "Google registration token is required." };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "g_reg") {
    return { valid: false, code: "TOKEN_INVALID", error: "Invalid registration token format." };
  }
  const [, payloadB64, signature] = parts;
  const secret = getSecret();
  const expectedSignature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  if (signature !== expectedSignature) {
    return { valid: false, code: "TOKEN_INVALID", error: "Invalid registration token signature." };
  }
  let payload: GoogleRegistrationPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, code: "TOKEN_INVALID", error: "Malformed registration token payload." };
  }
  if (Date.now() > payload.expires_at) {
    return { valid: false, code: "TOKEN_EXPIRED", error: "Registration token has expired. Please try again." };
  }
  if (payload.purpose !== "google_registration") {
    return { valid: false, code: "PURPOSE_MISMATCH", error: "Registration token purpose mismatch." };
  }
  return { valid: true, payload };
}

export interface MobileVerificationRequiredPayload {
  purpose: "account_mobile_completion";
  profile_id: string;
  email?: string;
  issued_at: number;
  expires_at: number;
  nonce: string;
}

export function createMobileVerificationRequiredToken(profileId: string, email?: string): string {
  const secret = getSecret();
  const now = Date.now();
  const exp = now + 15 * 60 * 1000; // 15 minutes
  const nonce = crypto.randomBytes(16).toString("hex");

  const payload: MobileVerificationRequiredPayload = {
    purpose: "account_mobile_completion",
    profile_id: profileId,
    email: email ? email.toLowerCase() : undefined,
    issued_at: now,
    expires_at: exp,
    nonce
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `m_req.${payloadB64}.${signature}`;
}

export function verifyMobileVerificationRequiredToken(token: string): {
  valid: boolean;
  code?: string;
  error?: string;
  payload?: MobileVerificationRequiredPayload;
} {
  if (!token || typeof token !== "string" || !token.trim()) {
    return { valid: false, code: "TOKEN_REQUIRED", error: "Mobile verification completion token is required." };
  }
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "m_req") {
    return { valid: false, code: "TOKEN_INVALID", error: "Invalid completion token format." };
  }
  const [, payloadB64, signature] = parts;
  const secret = getSecret();
  const expectedSignature = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  if (signature !== expectedSignature) {
    return { valid: false, code: "TOKEN_INVALID", error: "Invalid completion token signature." };
  }
  let payload: MobileVerificationRequiredPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, code: "TOKEN_INVALID", error: "Malformed completion token payload." };
  }
  if (Date.now() > payload.expires_at) {
    return { valid: false, code: "TOKEN_EXPIRED", error: "Completion token has expired. Please try again." };
  }
  if (payload.purpose !== "account_mobile_completion") {
    return { valid: false, code: "PURPOSE_MISMATCH", error: "Completion token purpose mismatch." };
  }
  return { valid: true, payload };
}
