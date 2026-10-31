/**
 * Integration tests for OTP Service lifecycle.
 * Uses real Redis via testcontainers to verify actual TTL behavior,
 * sliding window rate limiting, lockout, and resend cooldown.
 *
 * Requirements: 2.1–2.6, 3.1–3.5, 4.1–4.6
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Redis from "ioredis";
import { GenericContainer, type StartedTestContainer } from "testcontainers";

// ─── Test Redis Client Setup ──────────────────────────────────────────
// We create a module-scoped Redis instance and mock the redis/client module
// so that all Redis utility functions (otp, rate-limit, lockout) use our
// test container instead of the production env.REDIS_URL.

let testRedis: Redis;

vi.mock("@/redis/client.js", () => {
  // Return a proxy object where the `redis` property is resolved dynamically.
  // This allows `testRedis` to be set in beforeAll and still be used by
  // the imported utility modules.
  const handler = {
    get redis() {
      return testRedis;
    },
    disconnectRedis: async () => {
      if (testRedis) await testRedis.quit();
    },
  };
  return handler;
});

// Now import the service and utilities that depend on the mocked client
import { OtpService } from "./otp.service.js";
import { MockSmsGateway } from "./sms-gateway.interface.js";
import {
  OtpRateLimitError,
  ResendCooldownError,
  InvalidOtpError,
  OtpExpiredError,
  OtpLockoutError,
} from "@/errors/otp.errors.js";

// ─── Test Suite ───────────────────────────────────────────────────────

describe("OTP Service Integration Tests", () => {
  let container: StartedTestContainer;
  let service: OtpService;
  let mockGateway: MockSmsGateway;

  beforeAll(async () => {
    // Start a real Redis container
    container = await new GenericContainer("redis:7-alpine")
      .withExposedPorts(6379)
      .withStartupTimeout(120_000)
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);
    const url = `redis://${host}:${port}`;

    // Create the test Redis client pointing to the container
    testRedis = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    // Wait for connection
    await testRedis.ping();
  }, 120_000);

  afterAll(async () => {
    if (testRedis) {
      try {
        await testRedis.quit();
      } catch {
        // ignore
      }
    }
    if (container) {
      await container.stop();
    }
  }, 30_000);

  beforeEach(async () => {
    // Flush Redis between tests for isolation
    await testRedis.flushall();
    mockGateway = new MockSmsGateway();
    service = new OtpService(mockGateway);
  });

  // ─── Full OTP Lifecycle ─────────────────────────────────────────────

  describe("Full OTP lifecycle: generate → verify → invalidate", () => {
    it("should generate an OTP, verify it successfully, then reject reuse", async () => {
      const phone = "9876543210";

      // Generate OTP
      const result = await service.generate(phone);
      expect(result.success).toBe(true);
      expect(result.expiresIn).toBe(300);
      expect(result.resendAfter).toBe(30);

      // The SMS gateway received the OTP
      expect(mockGateway.sentMessages).toHaveLength(1);
      const sentCode = mockGateway.sentMessages[0].code;
      expect(sentCode).toMatch(/^\d{6}$/);

      // Verify the OTP successfully
      const verifyResult = await service.verify(phone, sentCode);
      expect(verifyResult.valid).toBe(true);

      // OTP is now invalidated — verifying again should throw OtpExpiredError
      await expect(service.verify(phone, sentCode)).rejects.toThrow(
        OtpExpiredError
      );
    });

    it("should invalidate previous OTP when a new one is generated", async () => {
      const phone = "9876543210";

      // Generate first OTP
      await service.generate(phone);
      const firstCode = mockGateway.sentMessages[0].code;

      // Manually expire the resend cooldown to allow immediate regeneration
      const phoneHash = service.hashPhone(phone);
      await testRedis.del(`resend_cooldown:${phoneHash}`);

      // Generate second OTP (invalidates the first)
      await service.generate(phone);
      const secondCode = mockGateway.sentMessages[1].code;

      // First OTP should be invalid now (overwritten by second)
      if (firstCode !== secondCode) {
        await expect(service.verify(phone, firstCode)).rejects.toThrow(
          InvalidOtpError
        );
      }

      // Second OTP should be valid
      const result = await service.verify(phone, secondCode);
      expect(result.valid).toBe(true);
    });

    it("should reject verification with wrong code and track attempts", async () => {
      const phone = "9876543210";

      // Generate OTP
      await service.generate(phone);
      const correctCode = mockGateway.sentMessages[0].code;
      const wrongCode = correctCode === "000000" ? "111111" : "000000";

      // First wrong attempt
      const err1 = await getError(() => service.verify(phone, wrongCode));
      expect(err1).toBeInstanceOf(InvalidOtpError);
      expect((err1 as InvalidOtpError).remainingAttempts).toBe(4);

      // Second wrong attempt
      const err2 = await getError(() => service.verify(phone, wrongCode));
      expect(err2).toBeInstanceOf(InvalidOtpError);
      expect((err2 as InvalidOtpError).remainingAttempts).toBe(3);

      // Correct code should still work
      const result = await service.verify(phone, correctCode);
      expect(result.valid).toBe(true);
    });
  });

  // ─── Rate Limiting with Sliding Window ──────────────────────────────

  describe("Rate limiting with actual sliding window", () => {
    it("should allow up to 5 OTP requests per phone per hour", async () => {
      const phone = "9876543210";
      const phoneHash = service.hashPhone(phone);

      // Generate 5 OTPs by manually clearing cooldown between requests
      for (let i = 0; i < 5; i++) {
        await service.generate(phone);
        // Clear cooldown for next iteration
        await testRedis.del(`resend_cooldown:${phoneHash}`);
      }

      expect(mockGateway.sentMessages).toHaveLength(5);

      // 6th request should be rejected
      await expect(service.generate(phone)).rejects.toThrow(
        OtpRateLimitError
      );
    });

    it("should provide retryAfter value when rate limited", async () => {
      const phone = "9876543210";
      const phoneHash = service.hashPhone(phone);

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await service.generate(phone);
        await testRedis.del(`resend_cooldown:${phoneHash}`);
      }

      // Check the error has retryAfter
      const err = await getError(() => service.generate(phone));
      expect(err).toBeInstanceOf(OtpRateLimitError);
      expect((err as OtpRateLimitError).retryAfter).toBeGreaterThan(0);
      expect((err as OtpRateLimitError).retryAfter).toBeLessThanOrEqual(3600);
    });

    it("should enforce rate limit independently per phone number", async () => {
      const phone1 = "9876543210";
      const phone2 = "8765432109";

      // Generate for phone1
      await service.generate(phone1);
      expect(mockGateway.sentMessages).toHaveLength(1);

      // Generate for phone2 (separate rate limit bucket)
      await service.generate(phone2);
      expect(mockGateway.sentMessages).toHaveLength(2);
    });

    it("should allow requests after sliding window entries expire", async () => {
      const phone = "9876543210";
      const phoneHash = service.hashPhone(phone);

      // Exhaust rate limit
      for (let i = 0; i < 5; i++) {
        await service.generate(phone);
        await testRedis.del(`resend_cooldown:${phoneHash}`);
      }

      // Verify rate limited
      await expect(service.generate(phone)).rejects.toThrow(OtpRateLimitError);

      // Manually remove all entries from the rate limit sorted set
      // (simulating that an hour has passed)
      await testRedis.del(`otp_count:${phoneHash}`);

      // Now should be allowed again
      const result = await service.generate(phone);
      expect(result.success).toBe(true);
    });
  });

  // ─── Lockout and Recovery ───────────────────────────────────────────

  describe("Lockout and recovery after timeout", () => {
    it("should lock out after 5 consecutive failed verification attempts", async () => {
      const phone = "9876543210";

      // Generate OTP
      await service.generate(phone);
      const correctCode = mockGateway.sentMessages[0].code;
      const wrongCode = correctCode === "000000" ? "111111" : "000000";

      // Fail 4 times (InvalidOtpError each time)
      for (let i = 0; i < 4; i++) {
        await expect(service.verify(phone, wrongCode)).rejects.toThrow(
          InvalidOtpError
        );
      }

      // 5th failure triggers lockout
      await expect(service.verify(phone, wrongCode)).rejects.toThrow(
        OtpLockoutError
      );

      // Even the correct code is rejected during lockout
      await expect(service.verify(phone, correctCode)).rejects.toThrow(
        OtpLockoutError
      );
    });

    it("should report remaining lockout time", async () => {
      const phone = "9876543210";

      // Generate and trigger lockout
      await service.generate(phone);
      const correctCode = mockGateway.sentMessages[0].code;
      const wrongCode = correctCode === "000000" ? "111111" : "000000";

      for (let i = 0; i < 4; i++) {
        try {
          await service.verify(phone, wrongCode);
        } catch {
          // expected
        }
      }

      // 5th failure triggers lockout with remaining seconds
      try {
        await service.verify(phone, wrongCode);
      } catch (err) {
        expect(err).toBeInstanceOf(OtpLockoutError);
        expect((err as OtpLockoutError).remainingSeconds).toBe(900);
      }

      // Check lockout status via service method
      const lockoutStatus = await service.checkLockout(phone);
      expect(lockoutStatus.locked).toBe(true);
      expect(lockoutStatus.remainingSeconds).toBeGreaterThan(0);
      expect(lockoutStatus.remainingSeconds).toBeLessThanOrEqual(900);
    });

    it("should allow verification after lockout expires", async () => {
      const phone = "9876543210";
      const phoneHash = service.hashPhone(phone);

      // Generate OTP
      await service.generate(phone);
      const correctCode = mockGateway.sentMessages[0].code;
      const wrongCode = correctCode === "000000" ? "111111" : "000000";

      // Trigger lockout
      for (let i = 0; i < 4; i++) {
        try {
          await service.verify(phone, wrongCode);
        } catch {
          // expected
        }
      }
      try {
        await service.verify(phone, wrongCode);
      } catch {
        // lockout triggered
      }

      // Verify locked
      const lockoutStatus = await service.checkLockout(phone);
      expect(lockoutStatus.locked).toBe(true);

      // Manually expire the lockout key to simulate time passing
      await testRedis.del(`lockout:${phoneHash}`);

      // Clear cooldown and generate a new OTP
      await testRedis.del(`resend_cooldown:${phoneHash}`);
      await service.generate(phone);
      const newCode = mockGateway.sentMessages[1].code;

      // Verification should now work
      const result = await service.verify(phone, newCode);
      expect(result.valid).toBe(true);
    });
  });

  // ─── Resend Cooldown Enforcement ────────────────────────────────────

  describe("Resend cooldown enforcement", () => {
    it("should reject OTP generation within 30-second cooldown", async () => {
      const phone = "9876543210";

      // First generation succeeds
      await service.generate(phone);
      expect(mockGateway.sentMessages).toHaveLength(1);

      // Immediate second request should be rejected
      await expect(service.generate(phone)).rejects.toThrow(
        ResendCooldownError
      );
      expect(mockGateway.sentMessages).toHaveLength(1); // No new SMS sent
    });

    it("should report remaining cooldown time", async () => {
      const phone = "9876543210";

      // Generate OTP (sets cooldown)
      await service.generate(phone);

      // Check cooldown status
      const status = await service.checkResendCooldown(phone);
      expect(status.active).toBe(true);
      expect(status.remainingSeconds).toBeGreaterThan(0);
      expect(status.remainingSeconds).toBeLessThanOrEqual(30);
    });

    it("should include retryAfter in ResendCooldownError", async () => {
      const phone = "9876543210";

      // Generate OTP (sets cooldown)
      await service.generate(phone);

      // Try to generate again
      const err = await getError(() => service.generate(phone));
      expect(err).toBeInstanceOf(ResendCooldownError);
      expect((err as ResendCooldownError).retryAfter).toBeGreaterThan(0);
      expect((err as ResendCooldownError).retryAfter).toBeLessThanOrEqual(30);
    });

    it("should allow OTP generation after cooldown expires (real TTL)", async () => {
      const phone = "9876543210";

      // Generate first OTP
      await service.generate(phone);
      expect(mockGateway.sentMessages).toHaveLength(1);

      // Wait for cooldown to expire (30 seconds + 1s buffer)
      await sleep(31_000);

      // Second generation should succeed
      await service.generate(phone);
      expect(mockGateway.sentMessages).toHaveLength(2);
    }, 40_000);

    it("should have cooldown inactive after TTL", async () => {
      const phone = "9876543210";

      // Generate OTP (sets cooldown)
      await service.generate(phone);

      // Wait for TTL to expire
      await sleep(31_000);

      // Cooldown should no longer be active
      const status = await service.checkResendCooldown(phone);
      expect(status.active).toBe(false);
      expect(status.remainingSeconds).toBe(0);
    }, 40_000);
  });

  // ─── OTP Expiry with Real TTL ──────────────────────────────────────

  describe("OTP expiry with real Redis TTL", () => {
    it("should reject verification after OTP TTL expires", async () => {
      const phone = "9876543210";

      // Generate OTP
      await service.generate(phone);
      const sentCode = mockGateway.sentMessages[0].code;

      // Manually set a very short TTL on the OTP key to simulate expiry
      const phoneHash = service.hashPhone(phone);
      await testRedis.expire(`otp:${phoneHash}`, 1); // 1 second TTL

      // Wait for expiry
      await sleep(1_500);

      // Verification should fail with OtpExpiredError
      await expect(service.verify(phone, sentCode)).rejects.toThrow(
        OtpExpiredError
      );
    });

    it("should verify successfully when OTP has not expired yet", async () => {
      const phone = "9876543210";

      // Generate OTP
      await service.generate(phone);
      const sentCode = mockGateway.sentMessages[0].code;

      // Verify TTL exists on the key
      const phoneHash = service.hashPhone(phone);
      const ttl = await testRedis.ttl(`otp:${phoneHash}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);

      // Verify immediately (within TTL)
      const result = await service.verify(phone, sentCode);
      expect(result.valid).toBe(true);
    });
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getError(fn: () => Promise<unknown>): Promise<Error> {
  try {
    await fn();
    throw new Error("Expected function to throw");
  } catch (err) {
    return err as Error;
  }
}
