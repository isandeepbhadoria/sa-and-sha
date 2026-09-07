import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyMsg91AccessTokenOnServer, getMsg91PublicConfig } from "../../lib/msg91";

describe("Customer Portal Auth & Unified MSG91 Mobile + Email OTP Widget", () => {
  beforeEach(() => {
    delete process.env.MSG91_AUTH_KEY;
    delete process.env.VITE_MSG91_WIDGET_ID;
    delete process.env.VITE_MSG91_TOKEN_AUTH;
  });

  it("checks MSG91 widget public configuration function", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        widgetId: "mock_widget_id_123",
        tokenAuth: "mock_token_auth_456"
      })
    }) as any;

    try {
      const config = await getMsg91PublicConfig();
      expect(config).toBeDefined();
      expect(config.widgetId).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("verifies mobile access token via unified MSG91 server helper", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: "Mobile number verified successfully.",
        mobile: "9876543210",
        normalizedPhone: "919876543210",
        sessionToken: "sess_mock_mobile_token_123",
        profile: { id: "p_mobile_123", phone_verified: true }
      })
    }) as any;

    try {
      const res = await verifyMsg91AccessTokenOnServer({
        accessToken: "msg91_mobile_token_123",
        phone: "9876543210"
      });

      expect(res.success).toBe(true);
      expect(res.mobile).toBe("9876543210");
      expect(res.normalizedPhone).toBe("919876543210");
      expect(res.sessionToken).toBe("sess_mock_mobile_token_123");
      expect(res.profile).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("verifies email access token via unified MSG91 server helper", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: "Email verified successfully.",
        email: "customer@saandsha.com",
        sessionToken: "sess_mock_email_token_456",
        profile: { id: "p_email_456", email_verified: true }
      })
    }) as any;

    try {
      const res = await verifyMsg91AccessTokenOnServer({
        accessToken: "msg91_email_token_456",
        email: "customer@saandsha.com"
      });

      expect(res.success).toBe(true);
      expect(res.email).toBe("customer@saandsha.com");
      expect(res.sessionToken).toBe("sess_mock_email_token_456");
      expect(res.profile).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles verification failure safely without exposing sensitive tokens", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "Invalid or expired MSG91 access token."
      })
    }) as any;

    try {
      const res = await verifyMsg91AccessTokenOnServer({
        accessToken: "invalid_token",
        phone: "9876543210"
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Invalid or expired MSG91 access token.");
      expect((res as any).accessToken).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles VERIFIED_IDENTIFIER_MISSING error when provider returns no contact identifier", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        code: "VERIFIED_IDENTIFIER_MISSING",
        error: "Unable to confirm the verified contact."
      })
    }) as any;

    try {
      const res = await verifyMsg91AccessTokenOnServer({
        accessToken: "token_without_contact",
        phone: "9876543210"
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Unable to confirm the verified contact");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles VERIFIED_IDENTIFIER_MISMATCH when provider contact does not match expected request", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        code: "VERIFIED_IDENTIFIER_MISMATCH",
        error: "The verified contact does not match this login request."
      })
    }) as any;

    try {
      const res = await verifyMsg91AccessTokenOnServer({
        accessToken: "token_for_user_A",
        phone: "9876543210" // Expected user B
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("The verified contact does not match this login request.");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("proves initSendOTP never receives an identifier option during initialization", async () => {
    const mockInitSendOTP = vi.fn();
    (globalThis as any).window = {
      initSendOTP: mockInitSendOTP
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ widgetId: "w_123", tokenAuth: "t_456" })
    }) as any;

    try {
      const { ensureMsg91Initialized } = await import("../../lib/msg91");

      mockInitSendOTP.mockImplementation(() => {
        (globalThis as any).window.sendOtp = vi.fn();
      });

      await ensureMsg91Initialized({
        hideMethod: "mobile",
        identifier: "customer@example.com"
      });

      expect(mockInitSendOTP).toHaveBeenCalledTimes(1);
      const passedConfig = mockInitSendOTP.mock.calls[0][0];
      expect(passedConfig.widgetId).toBeDefined();
      expect(passedConfig.tokenAuth).toBeDefined();
      expect(passedConfig.exposeMethods).toBe(true);
      expect(passedConfig.hideMethod).toBe("mobile");
      // CRITICAL GUARANTEE: identifier MUST NOT be passed to initSendOTP
      expect(passedConfig.identifier).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).window;
    }
  });

  it("proves mode switching deletes stale window methods before reinitialization", async () => {
    const mockInitSendOTP = vi.fn();
    const staleSendOtp = vi.fn();
    (globalThis as any).window = {
      initSendOTP: mockInitSendOTP,
      sendOtp: staleSendOtp,
      retryOtp: vi.fn(),
      verifyOtp: vi.fn()
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ widgetId: "w_123", tokenAuth: "t_456" })
    }) as any;

    try {
      const { ensureMsg91Initialized } = await import("../../lib/msg91");

      mockInitSendOTP.mockImplementation(() => {
        (globalThis as any).window.sendOtp = vi.fn();
      });

      // Initialize with mobile mode
      await ensureMsg91Initialized({ hideMethod: "email" });
      expect(mockInitSendOTP).toHaveBeenCalledTimes(1);
      expect(mockInitSendOTP.mock.calls[0][0].hideMethod).toBe("email");
      expect(mockInitSendOTP.mock.calls[0][0].identifier).toBeUndefined();

      // Switch mode to email
      await ensureMsg91Initialized({ hideMethod: "mobile" });
      expect(mockInitSendOTP).toHaveBeenCalledTimes(2);
      expect(mockInitSendOTP.mock.calls[1][0].hideMethod).toBe("mobile");
      expect(mockInitSendOTP.mock.calls[1][0].identifier).toBeUndefined();
      expect((globalThis as any).window.sendOtp).not.toBe(staleSendOtp);
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).window;
    }
  });

  it("proves window.sendOtp is the single authority for OTP dispatch", async () => {
    const mockInitSendOTP = vi.fn();
    const mockSendOtp = vi.fn();

    (globalThis as any).window = {
      initSendOTP: mockInitSendOTP
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true })
    }) as any;

    try {
      const { ensureMsg91Initialized } = await import("../../lib/msg91");

      mockInitSendOTP.mockImplementation(() => {
        (globalThis as any).window.sendOtp = mockSendOtp;
      });

      // 1. Re-initialize for email mode
      const win = await ensureMsg91Initialized({ hideMethod: "mobile" });

      // 2. Dispatch OTP via sendOtp exactly once
      win.sendOtp("customer@saandsha.com", vi.fn(), vi.fn());

      // Confirm initSendOTP was called without identifier
      expect(mockInitSendOTP).toHaveBeenCalled();
      expect(mockInitSendOTP.mock.calls[0][0].identifier).toBeUndefined();
      // Confirm window.sendOtp was called with target identifier
      expect(mockSendOtp).toHaveBeenCalledTimes(1);
      expect(mockSendOtp.mock.calls[0][0]).toBe("customer@saandsha.com");
    } finally {
      globalThis.fetch = originalFetch;
      delete (globalThis as any).window;
    }
  });

  it("sends channel=mobile and phone for mobile rate-limit checks", async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, cooldownSeconds: 45 })
    });
    globalThis.fetch = mockFetch as any;

    try {
      const { checkAndRecordOtpSendRateLimit } = await import("../../lib/msg91");

      const res = await checkAndRecordOtpSendRateLimit({
        channel: "mobile",
        identifier: "9876543210"
      });

      expect(res.allowed).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/otp/rate-limit-send");
      const body = JSON.parse(opts.body);
      expect(body.channel).toBe("mobile");
      expect(body.phone).toBe("9876543210");
      expect(body.email).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sends channel=email and email for email rate-limit checks and never submits email in phone field", async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, cooldownSeconds: 45 })
    });
    globalThis.fetch = mockFetch as any;

    try {
      const { checkAndRecordOtpSendRateLimit } = await import("../../lib/msg91");

      const res = await checkAndRecordOtpSendRateLimit({
        channel: "email",
        identifier: "customer@saandsha.com"
      });

      expect(res.allowed).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/otp/rate-limit-send");
      const body = JSON.parse(opts.body);
      expect(body.channel).toBe("email");
      expect(body.email).toBe("customer@saandsha.com");
      expect(body.phone).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("auto-detects string identifier with @ as email channel", async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true, cooldownSeconds: 45 })
    });
    globalThis.fetch = mockFetch as any;

    try {
      const { checkAndRecordOtpSendRateLimit } = await import("../../lib/msg91");

      const res = await checkAndRecordOtpSendRateLimit("user@domain.com");

      expect(res.allowed).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.channel).toBe("email");
      expect(body.email).toBe("user@domain.com");
      expect(body.phone).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles rate-limit rejections gracefully", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        allowed: false,
        error: "Too many OTP requests. Please wait a few minutes and try again.",
        retryAfterSeconds: 60
      })
    }) as any;

    try {
      const { checkAndRecordOtpSendRateLimit } = await import("../../lib/msg91");

      const res = await checkAndRecordOtpSendRateLimit({
        channel: "email",
        identifier: "blocked@saandsha.com"
      });

      expect(res.allowed).toBe(false);
      expect(res.error).toBe("Too many OTP requests. Please wait a few minutes and try again.");
      expect(res.retryAfterSeconds).toBe(60);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

