import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTrackingOtpSecret,
  hashOtp,
  safeCompareHashes,
  hashSessionToken,
  isValidTrackingTokenFormat
} from '../trackingHelpers';

describe('Phase 8B.1.3 — Tracking OTP & Verification Security Fixes Tests', () => {
  const origEnv = process.env.NODE_ENV;
  const origSecret = process.env.TRACKING_OTP_SECRET;

  beforeEach(() => {
    process.env.TRACKING_OTP_SECRET = 'test_secret_key_12345';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    process.env.TRACKING_OTP_SECRET = origSecret;
  });

  describe('1. OTP Hashing & Secret Validation', () => {
    it('deterministically hashes OTP codes using SHA-256 and server secret', () => {
      const token = 'trk_a1b2c3d4e5f607182930415263748596';
      const otp = '123456';

      const hash1 = hashOtp(otp, token);
      const hash2 = hashOtp(otp, token);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(otp);
      expect(hash1.length).toBe(64); // SHA-256 hex string length
    });

    it('produces different hashes for different tracking tokens or different OTP codes', () => {
      const token1 = 'trk_a1b2c3d4e5f607182930415263748596';
      const token2 = 'trk_f6e5d4c3b2a107182930415263748596';
      const otp1 = '123456';
      const otp2 = '654321';

      expect(hashOtp(otp1, token1)).not.toBe(hashOtp(otp2, token1));
      expect(hashOtp(otp1, token1)).not.toBe(hashOtp(otp1, token2));
    });

    it('rejects comparison of raw plaintext OTP against hashed OTP', () => {
      const token = 'trk_a1b2c3d4e5f607182930415263748596';
      const rawOtp = '554433';
      const hashedOtp = hashOtp(rawOtp, token);

      // Raw plaintext string comparison must fail
      expect(rawOtp === hashedOtp).toBe(false);

      // Safe compare of raw string vs hash must fail
      expect(safeCompareHashes(rawOtp, hashedOtp)).toBe(false);

      // Safe compare of correctly re-hashed computed OTP must pass
      const computedHash = hashOtp(rawOtp, token);
      expect(safeCompareHashes(computedHash, hashedOtp)).toBe(true);
    });

    it('fails closed if TRACKING_OTP_SECRET is missing in production mode', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TRACKING_OTP_SECRET;

      expect(getTrackingOtpSecret()).toBeNull();
      expect(() => hashOtp('123456', 'trk_a1b2c3d4e5f607182930415263748596')).toThrow(/MISSING_TRACKING_OTP_SECRET/);
      expect(() => hashSessionToken('vtok_12345')).toThrow(/MISSING_TRACKING_OTP_SECRET/);
    });
  });

  describe('2. Constant-Time Hash Comparison', () => {
    it('safely compares hex hashes without leaking timing information', () => {
      const hashA = 'a'.repeat(64);
      const hashB = 'a'.repeat(64);
      const hashC = 'b'.repeat(64);

      expect(safeCompareHashes(hashA, hashB)).toBe(true);
      expect(safeCompareHashes(hashA, hashC)).toBe(false);
      expect(safeCompareHashes('', hashA)).toBe(false);
      expect(safeCompareHashes('short', hashA)).toBe(false);
    });
  });

  describe('3. Session Token Server-Side Hashing', () => {
    it('hashes verification session tokens before server storage', () => {
      const rawSessionToken = 'vtok_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a';
      const tokenHash1 = hashSessionToken(rawSessionToken);
      const tokenHash2 = hashSessionToken(rawSessionToken);

      expect(tokenHash1).toBe(tokenHash2);
      expect(tokenHash1).not.toBe(rawSessionToken);
      expect(tokenHash1.length).toBe(64);
    });
  });

  describe('4. Input Validation & Token Format Safeguards', () => {
    it('strictly validates tracking token format before processing OTP actions', () => {
      expect(isValidTrackingTokenFormat('trk_1234567890abcdef1234567890abcdef')).toBe(true);
      expect(isValidTrackingTokenFormat('invalid_token')).toBe(false);
      expect(isValidTrackingTokenFormat('trk_short')).toBe(false);
      expect(isValidTrackingTokenFormat('<script>alert(1)</script>')).toBe(false);
    });
  });
});
