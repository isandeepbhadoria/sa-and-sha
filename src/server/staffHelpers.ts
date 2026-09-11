import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

export interface StaffAccount {
  uid: string;
  name: string;
  email: string;
  role: "store_staff";
  active: boolean;
  created_at: string;
  created_by: string;
  updated_at?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createStaffAccount(
  adminAuthSvc: Auth,
  adminDb: Firestore,
  params: { name: string; email: string; password: string; createdBy: string }
): Promise<StaffAccount> {
  const name = (params.name || "").trim();
  const email = (params.email || "").trim().toLowerCase();
  const password = params.password || "";

  if (!name) throw new Error("Staff name is required.");
  if (!email || !EMAIL_REGEX.test(email)) throw new Error("A valid email address is required.");
  if (!password || password.length < 8) throw new Error("Password must be at least 8 characters.");

  const userRecord = await adminAuthSvc.createUser({
    email,
    password,
    displayName: name,
    emailVerified: true
  });

  const record: StaffAccount = {
    uid: userRecord.uid,
    name,
    email,
    role: "store_staff",
    active: true,
    created_at: new Date().toISOString(),
    created_by: params.createdBy
  };

  await adminDb.collection("staff_users").doc(userRecord.uid).set(record);
  return record;
}

export async function listStaffAccounts(adminDb: Firestore): Promise<StaffAccount[]> {
  const snap = await adminDb.collection("staff_users").orderBy("created_at", "desc").get();
  return snap.docs.map(d => d.data() as StaffAccount);
}

export async function setStaffActive(adminDb: Firestore, uid: string, active: boolean): Promise<void> {
  const ref = adminDb.collection("staff_users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Staff account not found.");
  await ref.update({ active, updated_at: new Date().toISOString() });
}

export async function deleteStaffAccount(adminAuthSvc: Auth, adminDb: Firestore, uid: string): Promise<void> {
  const ref = adminDb.collection("staff_users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Staff account not found.");
  await ref.delete();
  try {
    await adminAuthSvc.deleteUser(uid);
  } catch (err: any) {
    if (err?.code !== "auth/user-not-found") throw err;
  }
}

export interface StaffOrAdminAuthResult {
  authorized: boolean;
  role?: "admin" | "store_staff";
  email?: string;
  name?: string;
  uid?: string;
  error?: string;
}

/**
 * Resolves a decoded Firebase ID token to either the single hardcoded admin
 * account, or an active entry in staff_users. Never grants access based on
 * client-supplied data alone - staff_users is only ever read/written via the
 * Admin SDK (server-side), so there are no Firestore security rules to keep in
 * sync for it.
 */
export async function resolveStaffOrAdmin(
  adminDb: Firestore,
  decodedEmail: string | undefined,
  decodedUid: string,
  adminEmailConst: string
): Promise<StaffOrAdminAuthResult> {
  if (decodedEmail && decodedEmail.toLowerCase() === adminEmailConst.toLowerCase()) {
    return { authorized: true, role: "admin", email: decodedEmail, uid: decodedUid };
  }

  const snap = await adminDb.collection("staff_users").doc(decodedUid).get();
  if (!snap.exists) {
    return { authorized: false, error: "This account is not registered as staff." };
  }

  const data = snap.data() as StaffAccount;
  if (!data.active) {
    return { authorized: false, error: "This staff account has been deactivated. Contact the admin." };
  }

  return { authorized: true, role: "store_staff", email: data.email, name: data.name, uid: decodedUid };
}
