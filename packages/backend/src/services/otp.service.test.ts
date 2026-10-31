/**
 * Unit tests for OTP Service.
 * Uses a mock SMS gateway and mocks Redis utilities to test
 * the service logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OtpService } from "./otp.service.js";
import { MockSmsGateway } from "./sms-gateway.interface.js";
import {
  OtpRateLimitError,
  ResendCooldownError,
  InvalidOtpError,
  OtpExpiredError,
  OtpLockoutError,
  SmsDeliveryError,
} from "@/errors/otp.errors.js";

// ─── Mock Redis utilities ─────────────────────────────────────────────

vi.mock("@/redis/index.js", () => ({
  storeOtp: vi.fn().mockResolvedValue(undefined),
  getOtp: vi.fn().mockResolvedValue(null),
  incrementOtpAttempts: vi.fn().mockResolvedValue(1),
  deleteOtp: vi.fn().mockResolvedValue(undefined),
  recordOtpRequest: vi.fn().mockResolvedValue(1),
  getOtpRequestCount: vi.fn().mockResolvedValue(0),
  getOtpRetryAfter: vi.fn().mockResolvedValue(0),
  setLockout: vi.fn().mockResolvedValue(undefined),
  getLockout: vi.fn().mockResolvedValue(null),
  getLockoutRemaining: vi.fn().mockResolvedValue(0),
  setResendCooldown: vi.fn().mockResolvedValue(undefined),
  isResendCooldownActive: vi.fn().mockResolvedValue(false),
  getResendCooldownRemaining: vi.fn().mockResolvedValue(0),
}));

// Import mocked modules for assertions
import * as redisUtils from "@/redis/index.js";

// ─── Test Setup ───────────────────────────────────────────────────────

describe("OtpService", () => {
  let service: OtpService;
  let mockGateway: MockSmsGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGateway = new MockSmsGateway();
    service = new OtpService(mockGateway);
  });

  // ─── hashPhone ────────────────────────────────────────────────────

  describe("hashPhone", () => {
    it("should return a SHA-256 hex string", () => {
      const hash = service.hashPhone("9876543210");
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce consistent hashes for the same phone", () => {
      const hash1 = service.hashPhone("9876543210");
      const hash2 = service.hashPhone("9876543210");
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different phones", () => {
      const hash1 = service.hashPhone("9876543210");
      const hash2 = service.hashPhone("9876543211");
      expect(hash1).not.toBe(hash2);
    });
  });

  // ─── generateCode ─────────────────────────────────────────────────

  describe("generateCode", () => {
    it("should generate a 6-digit string", () => {
      const code = service.generateCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it("should left-pad with zeros when needed", () => {
      // We can't control crypto.randomInt, but verify format is always 6 digits
      for (let i = 0; i < 100; i++) {
        const code = service.generateCode();
        expect(code).toHaveLength(6);
        expect(Number(code)).toBeGreaterThanOrEqual(0);
        expect(Number(code)).toBeLessThan(1_000_000);
      }
    });
  });

  // ─── generate ─────────────────────────────────────────────────────

  describe("generate", () => {
    it("should generate and send an OTP successfully", async () => {
      const result = await service.generate("9876543210");

      expect(result.success).toBe(true);
      expect(result.expiresIn).toBe(300);
      expect(result.resendAfter).toBe(30);
      expect(mockGateway.sentMessages).toHaveLength(1);
      expect(mockGateway.sentMessages[0].phone).toBe("9876543210");
      expect(mockGateway.sentMessages[0].code).toMatch(/^\d{6}$/);
    });

    it("should store OTP in Redis", async () => {
      await service.generate("9876543210");

      expect(redisUtils.storeOtp).toHaveBeenCalledWith(
        expect.any(String), // phone hash
        expect.stringMatching(/^\d{6}$/)
      );
    });

    it("should set resend cooldown after generating OTP", async () => {
      await service.generate("9876543210");

      expect(redisUtils.setResendCooldown).toHaveBeenCalledWith(
        expect.any(String) // phone hash
      );
    });

    it("should record the rate limit entry", async () => {
      await service.generate("9876543210");

      expect(redisUtils.recordOtpRequest).toHaveBeenCalledWith(
        expect.any(String) // phone hash
      );
    });

    it("should throw ResendCooldownError if cooldown is active", async () => {
      vi.mocked(redisUtils.isResendCooldownActive).mockResolvedValue(true);
      vi.mocked(redisUtils.getResendCooldownRemaining).mockResolvedValue(20);

      await expect(service.generate("9876543210")).rejects.toThrow(
        ResendCooldownError
      );
      await expect(service.generate("9876543210")).rejects.toMatchObject({
        retryAfter: 20,
      });
    });

    it("should throw OtpRateLimitError if hourly limit exceeded", async () => {
      vi.mocked(redisUtils.isResendCooldownActive).mockResolvedValue(false);
      vi.mocked(redisUtils.getOtpRequestCount).mockResolvedValue(5);
      vi.mocked(redisUtils.getOtpRetryAfter).mockResolvedValue(1800);

      await expect(service.generate("9876543210")).rejects.toThrow(
        OtpRateLimitError
      );
      vi.mocked(redisUtils.isResendCooldownActive).mockResolvedValue(false);
      vi.mocked(redisUtils.getOtpRequestCount).mockResolvedValue(5);
      vi.mocked(redisUtils.getOtpRetryAfter).mockResolvedValue(1800);
      await expect(service.generate("9876543210")).rejects.toMatchObject({
        retryAfter: 1800,
      });
    });

    it("should throw SmsDeliveryError if SMS gateway fails", async () => {
      vi.mocked(redisUtils.isResendCooldownActive).mockResolvedValue(false);
      vi.mocked(redisUtils.getOtpRequestCount).mockResolvedValue(0);
      const failingGateway = new MockSmsGateway();
      failingGateway.sendOtp = vi.fn().mockResolvedValue({
        success: false,
        error: "Provider unavailable",
      });
      const failService = new OtpService(failingGateway);

      await expect(failService.generate("9876543210")).rejects.toThrow(
        SmsDeliveryError
      );
    });

    it("should clean up OTP from Redis if SMS delivery fails", async () => {
      vi.mocked(redisUtils.isResendCooldownActive).mockResolvedValue(false);
      vi.mocked(redisUtils.getOtpRequestCount).mockResolvedValue(0);
      const failingGateway = new MockSmsGateway();
      failingGateway.sendOtp = vi.fn().mockResolvedValue({
        success: false,
        error: "Provider unavailable",
      });
      const failService = new OtpService(failingGateway);

      try {
        await failService.generate("9876543210");
      } catch {
        // expected
      }

      expect(redisUtils.deleteOtp).toHaveBeenCalled();
    });
  });

  // ─── verify ───────────────────────────────────────────────────────

  describe("verify", () => {
    it("should verify a valid OTP successfully", async () => {
      vi.mocked(redisUtils.getOtp).mockResolvedValue({
        code: "123456",
        attempts: 0,
        created_at: Date.now(),
      });

      const result = await service.verify("9876543210", "123456");

      expect(result.valid).toBe(true);
      expect(redisUtils.deleteOtp).toHaveBeenCalled();
    });

    it("should throw OtpLockoutError if phone is locked out", async () => {
      vi.mocked(redisUtils.getLockout).mockResolvedValue({
        until: Date.now() + 900_000,
        reason: "max_attempts",
      });
      vi.mocked(redisUtils.getLockoutRemaining).mockResolvedValue(600);

      await expect(service.verify("9876543210", "123456")).rejects.toThrow(
        OtpLockoutError
      );
      await expect(
        service.verify("9876543210", "123456")
      ).rejects.toMatchObject({
        remainingSeconds: 600,
      });
    });

    it("should throw OtpExpiredError if no OTP exists in Redis", async () => {
      vi.mocked(redisUtils.getLockout).mockResolvedValue(null);
      vi.mocked(redisUtils.getOtp).mockResolvedValue(null);

      await expect(service.verify("9876543210", "123456")).rejects.toThrow(
        OtpExpiredError
      );
    });

    it("should throw InvalidOtpError with remaining attempts on wrong code", async () => {
      vi.mocked(redisUtils.getLockout).mockResolvedValue(null);
      vi.mocked(redisUtils.getOtp).mockResolvedValue({
        code: "123456",
        attempts: 0,
        created_at: Date.now(),
      });
      vi.mocked(redisUtils.incrementOtpAttempts).mockResolvedValue(1);

      await expect(service.verify("9876543210", "654321")).rejects.toThrow(
        InvalidOtpError
      );
      await expect(
        service.verify("9876543210", "654321")
      ).rejects.toMatchObject({
        remainingAttempts: 4,
      });
    });

    it("should set lockout after 5 failed attempts", async () => {
      vi.mocked(redisUtils.getLockout).mockResolvedValue(null);
      vi.mocked(redisUtils.getOtp).mockResolvedValue({
        code: "123456",
        attempts: 4,
        created_at: Date.now(),
      });
      vi.mocked(redisUtils.incrementOtpAttempts).mockResolvedValue(5);

      await expect(service.verify("9876543210", "654321")).rejects.toThrow(
        OtpLockoutError
      );
      expect(redisUtils.setLockout).toHaveBeenCalledWith(
        expect.any(String),
        "max_attempts"
      );
      expect(redisUtils.deleteOtp).toHaveBeenCalled();
    });

    it("should invalidate OTP on successful verification (single-use)", async () => {
      vi.mocked(redisUtils.getLockout).mockResolvedValue(null);
      vi.mocked(redisUtils.getOtp).mockResolvedValue({
        code: "789012",
        attempts: 0,
        created_at: Date.now(),
      });

      await service.verify("9876543210", "789012");

      expect(redisUtils.deleteOtp).toHaveBeenCalled();
    });
  });

  // ─── invalidate ───────────────────────────────────────────────────

  describe("invalidate", () => {
    it("should delete the OTP from Redis", async () => {
      await service.invalidate("9876543210");

      expect(redisUtils.deleteOtp).toHaveBeenCalledWith(expect.any(String));
    });
  });

  // ─── canRequestOtp ────────────────────────────────────────────────

  describe("canRequestOtp", () => {
    it("should return allowed=true when under rate limit", async () => {
      vi.mocked(redisUtils.getOtpRequestCount).mockResolvedValue(3);

      const result = await service.canRequestOtp("9876543210");

      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it("should return allowed=false with retryAfter when at limit", async () => {
      vi.mocked(redisUtils.getOtpRequestCount).mockResolvedValue(5);
      vi.mocked(redisUtils.getOtpRetryAfter).mockResolvedValue(2400);

      const result = await service.canRequestOtp("9876543210");

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(2400);
    });
  });

  // ─── checkResendCooldown ──────────────────────────────────────────

  describe("checkResendCooldown", () => {
    it("should return active=false when no cooldown", async () => {
      vi.mocked(redisUtils.isResendCooldownActive).mockResolvedValue(false);

      const result = await service.checkResendCooldown("9876543210");

      expect(result.active).toBe(false);
      expect(result.remainingSeconds).toBe(0);
    });

    it("should return active=true with remaining seconds when cooldown active", async () => {
      vi.mocked(redisUtils.isResendCooldownActive).mockResolvedValue(true);
      vi.mocked(redisUtils.getResendCooldownRemaining).mockResolvedValue(15);

      const result = await service.checkResendCooldown("9876543210");

      expect(result.active).toBe(true);
      expect(result.remainingSeconds).toBe(15);
    });
  });

  // ─── checkLockout ─────────────────────────────────────────────────

  describe("checkLockout", () => {
    it("should return locked=false when not locked out", async () => {
      vi.mocked(redisUtils.getLockout).mockResolvedValue(null);

      const result = await service.checkLockout("9876543210");

      expect(result.locked).toBe(false);
      expect(result.remainingSeconds).toBe(0);
    });

    it("should return locked=true with remaining seconds when locked out", async () => {
      vi.mocked(redisUtils.getLockout).mockResolvedValue({
        until: Date.now() + 600_000,
        reason: "max_attempts",
      });
      vi.mocked(redisUtils.getLockoutRemaining).mockResolvedValue(600);

      const result = await service.checkLockout("9876543210");

      expect(result.locked).toBe(true);
      expect(result.remainingSeconds).toBe(600);
    });
  });
});
