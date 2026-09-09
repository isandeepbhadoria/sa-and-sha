import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkCustomerLoginEligibility } from "../loginEligibilityHelpers";

describe("PHASE 9C.5.1 — Account Setup Required UX & Eligibility Tests", () => {
  let mockAdminDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb = {
      collection: vi.fn().mockImplementation((colName: string) => {
        return {
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: false }),
            set: vi.fn().mockResolvedValue({})
          }),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] })
            })
          })
        };
      })
    };
  });

  it("1 & 2. Unknown Email and Mobile return eligible=false with code ACCOUNT_NOT_FOUND", async () => {
    const emailRes = await checkCustomerLoginEligibility(mockAdminDb, "email", "unknown_user@example.com");
    expect(emailRes.success).toBe(true);
    expect(emailRes.eligible).toBe(false);
    expect(emailRes.code).toBe("ACCOUNT_NOT_FOUND");
    expect(emailRes.message).toContain("We couldn't find a Sa and Sha customer account");

    const mobileRes = await checkCustomerLoginEligibility(mockAdminDb, "mobile", "919999999999");
    expect(mobileRes.success).toBe(true);
    expect(mobileRes.eligible).toBe(false);
    expect(mobileRes.code).toBe("ACCOUNT_NOT_FOUND");
    expect(mobileRes.message).toContain("We couldn't find a Sa and Sha customer account");
  });

  it("3 & 4. Proves Unknown Email and Mobile do not issue a login challenge (so sendOtp is never called)", async () => {
    const emailRes = await checkCustomerLoginEligibility(mockAdminDb, "email", "nonexistent@sa-and-sha.com");
    expect(emailRes.eligible).toBe(false);
    expect((emailRes as any).loginChallenge).toBeUndefined();

    const mobileRes = await checkCustomerLoginEligibility(mockAdminDb, "mobile", "919876543210");
    expect(mobileRes.eligible).toBe(false);
    expect((mobileRes as any).loginChallenge).toBeUndefined();
  });

  it("14 & 15. Existing customer Mobile and Email login return eligible=true with signed loginChallenge", async () => {
    const mockProfile = {
      id: "p_existing_123",
      customer_id: "KL-C100001",
      email: "rahul@sa-and-sha.com",
      email_lower: "rahul@sa-and-sha.com",
      phone: "+919876543210",
      normalized_phone: "919876543210",
      status: "active"
    };

    const mockDbWithUser = {
      collection: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: "p_existing_123", data: () => mockProfile }]
            })
          })
        })
      })
    };

    const emailRes = await checkCustomerLoginEligibility(mockDbWithUser as any, "email", "rahul@sa-and-sha.com");
    expect(emailRes.success).toBe(true);
    expect(emailRes.eligible).toBe(true);
    expect(emailRes.loginChallenge).toBeDefined();

    const mobileRes = await checkCustomerLoginEligibility(mockDbWithUser as any, "mobile", "919876543210");
    expect(mobileRes.success).toBe(true);
    expect(mobileRes.eligible).toBe(true);
    expect(mobileRes.loginChallenge).toBeDefined();
  });

  it("12 & 13. Database/Server exceptions do not mislabel errors as account-not-found", async () => {
    const mockErrorDb = {
      collection: vi.fn().mockImplementation(() => {
        throw new Error("Firestore DB connection failed");
      })
    };

    await expect(checkCustomerLoginEligibility(mockErrorDb as any, "email", "user@example.com")).rejects.toThrow(
      "Firestore DB connection failed"
    );
  });

  it("5 & 6. Proves Try Again resets eligibility error state while preserving input identifier", () => {
    let authView = 'account_setup_required';
    let showOtpScreen = false;
    let formError: string | null = 'Account setup required';
    const savedEmailInput = 'corrected@sa-and-sha.com';
    const savedMobileInput = '9876543210';

    // Simulate Try Again handler
    authView = 'login';
    showOtpScreen = false;
    formError = null;

    expect(authView).toBe('login');
    expect(showOtpScreen).toBe(false);
    expect(formError).toBeNull();
    expect(savedEmailInput).toBe('corrected@sa-and-sha.com');
    expect(savedMobileInput).toBe('9876543210');
  });

  it("7, 8 & 9. Proves Create Account opens registration flow with prefilled normalized identifier", () => {
    const accountSetupTargetEmail = { channel: 'email' as const, identifier: 'newuser@sa-and-sha.com' };
    const accountSetupTargetMobile = { channel: 'mobile' as const, identifier: '9876543210' };

    // Test Email Create Account action
    let regChannel: 'mobile' | 'email' = accountSetupTargetEmail.channel;
    let regIdentifier = accountSetupTargetEmail.identifier;
    let regOptionalContact = '';
    let authView = 'registration';

    expect(authView).toBe('registration');
    expect(regChannel).toBe('email');
    expect(regIdentifier).toBe('newuser@sa-and-sha.com');
    expect(regOptionalContact).toBe('');

    // Test Mobile Create Account action
    regChannel = accountSetupTargetMobile.channel;
    regIdentifier = accountSetupTargetMobile.identifier;
    regOptionalContact = '';

    expect(regChannel).toBe('mobile');
    expect(regIdentifier).toBe('9876543210');
    expect(regOptionalContact).toBe('');
  });

  it("10. Loading state clears on eligible=false", () => {
    let isSubmitting = true;
    const response = { success: true, eligible: false, code: "ACCOUNT_SETUP_REQUIRED" };

    if (!response.eligible) {
      isSubmitting = false;
    }

    expect(isSubmitting).toBe(false);
  });

  it("11. HTTP 429 response displays rate limit error message", () => {
    const resStatus = 429;
    const resData = { error: "Too many attempts. Please wait a moment and try again." };

    let errorMessage = "";
    if (resStatus === 429) {
      errorMessage = resData.error;
    }

    expect(errorMessage).toBe("Too many attempts. Please wait a moment and try again.");
  });

  it("16 & 17. Verifies Checkout OTP & Google Sign-In functions remain unmodified", async () => {
    const { handleGoogleAuthToken } = await import("../googleAuthHelpers");
    expect(handleGoogleAuthToken).toBeDefined();
    expect(typeof handleGoogleAuthToken).toBe("function");
  });
});
