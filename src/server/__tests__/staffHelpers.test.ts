import { describe, it, expect, vi } from "vitest";
import {
  createStaffAccount,
  listStaffAccounts,
  setStaffActive,
  deleteStaffAccount,
  resolveStaffOrAdmin
} from "../staffHelpers";

function createMockAdminAuth(existingUsers: Record<string, any> = {}) {
  const users = new Map<string, any>(Object.entries(existingUsers));
  let nextUidCounter = 1;
  return {
    createUser: vi.fn(async (params: any) => {
      const uid = `uid_${nextUidCounter++}`;
      const record = { uid, ...params };
      users.set(uid, record);
      return record;
    }),
    deleteUser: vi.fn(async (uid: string) => {
      if (!users.has(uid)) {
        const err: any = new Error("no user");
        err.code = "auth/user-not-found";
        throw err;
      }
      users.delete(uid);
    }),
    _users: users
  } as any;
}

function createMockAdminDb(initialStaff: Record<string, any> = {}) {
  const staffMap = new Map<string, any>(Object.entries(initialStaff));
  return {
    collection: (name: string) => {
      if (name !== "staff_users") throw new Error(`Unexpected collection: ${name}`);
      return {
        doc: (uid: string) => ({
          get: async () => ({ exists: staffMap.has(uid), data: () => staffMap.get(uid) }),
          set: async (data: any) => { staffMap.set(uid, data); },
          update: async (fields: any) => { staffMap.set(uid, { ...(staffMap.get(uid) || {}), ...fields }); },
          delete: async () => { staffMap.delete(uid); }
        }),
        orderBy: () => ({
          get: async () => {
            const docs = Array.from(staffMap.values())
              .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
              .map(v => ({ data: () => v }));
            return { docs };
          }
        })
      };
    },
    _staffMap: staffMap
  } as any;
}

describe("createStaffAccount", () => {
  it("creates a Firebase Auth user and a matching staff_users record", async () => {
    const auth = createMockAdminAuth();
    const db = createMockAdminDb();

    const record = await createStaffAccount(auth, db, {
      name: "Priya",
      email: "Priya@Sa-And-Sha.com",
      password: "supersecret1",
      createdBy: "sales@sa-and-sha.com"
    });

    expect(record.email).toBe("priya@sa-and-sha.com"); // lowercased
    expect(record.active).toBe(true);
    expect(record.role).toBe("store_staff");
    expect(db._staffMap.get(record.uid)).toEqual(record);
    expect(auth.createUser).toHaveBeenCalledOnce();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const auth = createMockAdminAuth();
    const db = createMockAdminDb();
    await expect(
      createStaffAccount(auth, db, { name: "X", email: "x@sa-and-sha.com", password: "short", createdBy: "admin" })
    ).rejects.toThrow(/at least 8 characters/);
  });

  it("rejects an invalid email", async () => {
    const auth = createMockAdminAuth();
    const db = createMockAdminDb();
    await expect(
      createStaffAccount(auth, db, { name: "X", email: "not-an-email", password: "supersecret1", createdBy: "admin" })
    ).rejects.toThrow(/valid email/);
  });

  it("rejects a blank name", async () => {
    const auth = createMockAdminAuth();
    const db = createMockAdminDb();
    await expect(
      createStaffAccount(auth, db, { name: "  ", email: "x@sa-and-sha.com", password: "supersecret1", createdBy: "admin" })
    ).rejects.toThrow(/name is required/);
  });
});

describe("listStaffAccounts / setStaffActive / deleteStaffAccount", () => {
  it("lists staff and toggles active state", async () => {
    const db = createMockAdminDb({
      uid_1: { uid: "uid_1", name: "A", email: "a@sa-and-sha.com", role: "store_staff", active: true, created_at: "2026-01-01T00:00:00Z", created_by: "admin" }
    });

    let list = await listStaffAccounts(db);
    expect(list).toHaveLength(1);
    expect(list[0].active).toBe(true);

    await setStaffActive(db, "uid_1", false);
    list = await listStaffAccounts(db);
    expect(list[0].active).toBe(false);
  });

  it("throws when deactivating a non-existent staff account", async () => {
    const db = createMockAdminDb();
    await expect(setStaffActive(db, "ghost", false)).rejects.toThrow(/not found/);
  });

  it("deletes both the Firestore record and the Firebase Auth user", async () => {
    const auth = createMockAdminAuth({ uid_1: { uid: "uid_1", email: "a@sa-and-sha.com" } });
    const db = createMockAdminDb({
      uid_1: { uid: "uid_1", name: "A", email: "a@sa-and-sha.com", role: "store_staff", active: true, created_at: "x", created_by: "admin" }
    });

    await deleteStaffAccount(auth, db, "uid_1");

    expect(db._staffMap.has("uid_1")).toBe(false);
    expect(auth._users.has("uid_1")).toBe(false);
  });
});

describe("resolveStaffOrAdmin", () => {
  const ADMIN_EMAIL = "sales@sa-and-sha.com";

  it("authorizes the hardcoded admin email regardless of staff_users content", async () => {
    const db = createMockAdminDb();
    const result = await resolveStaffOrAdmin(db, "sales@sa-and-sha.com", "admin-uid", ADMIN_EMAIL);
    expect(result.authorized).toBe(true);
    expect(result.role).toBe("admin");
  });

  it("authorizes an active staff account", async () => {
    const db = createMockAdminDb({
      staff_uid: { uid: "staff_uid", name: "Priya", email: "priya@sa-and-sha.com", role: "store_staff", active: true, created_at: "x", created_by: "admin" }
    });
    const result = await resolveStaffOrAdmin(db, "priya@sa-and-sha.com", "staff_uid", ADMIN_EMAIL);
    expect(result.authorized).toBe(true);
    expect(result.role).toBe("store_staff");
    expect(result.name).toBe("Priya");
  });

  it("rejects a deactivated staff account", async () => {
    const db = createMockAdminDb({
      staff_uid: { uid: "staff_uid", name: "Priya", email: "priya@sa-and-sha.com", role: "store_staff", active: false, created_at: "x", created_by: "admin" }
    });
    const result = await resolveStaffOrAdmin(db, "priya@sa-and-sha.com", "staff_uid", ADMIN_EMAIL);
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/deactivated/);
  });

  it("rejects a signed-in Firebase user who is neither admin nor staff", async () => {
    const db = createMockAdminDb();
    const result = await resolveStaffOrAdmin(db, "randomcustomer@gmail.com", "random-uid", ADMIN_EMAIL);
    expect(result.authorized).toBe(false);
    expect(result.error).toMatch(/not registered as staff/);
  });
});
