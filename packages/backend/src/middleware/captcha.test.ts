import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type Redis from "ioredis";

import {
  captchaVerifier,
  getFailureCount,
  incrementFailureCount,
  resetFailureCount,
  CaptchaValidator,
  CAPTCHA_FAILURE_THRESHOLD,
  CAPTCHA_FAILURE_TTL,
  CAPTCHA_FAILURES_KEY_PREFIX,
} from "./captcha.js";

// ─── Mock Redis ───────────────────────────────────────────────────────

function createMockRedis(store: Map<string, string> = new Map()): Redis {
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(store.get(key) ?? "0", 10);
      const next = current + 1;
      store.set(key, String(next));
      return next;
    }),
    expire: vi.fn(async () => 1),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
  } as unknown as Redis;
}

// ─── Mock CAPTCHA Validator ───────────────────────────────────────────

function createMockValidator(isValid: boolean): CaptchaValidator {
  return {
    validate: vi.fn(async () => isValid),
  };
}

// ─── Mock Express Objects ─────────────────────────────────────────────

function createMockReq(body: Record<string, unknown> = {}): Request {
  return { body } as Request;
}

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("CAPTCHA Middleware", () => {
  describe("Redis Helpers", () => {
    describe("getFailureCount()", () => {
      it("should return 0 when no failures are recorded", async () => {
        const redis = createMockRedis();
        const count = await getFailureCount(redis, "test-identifier");
        expect(count).toBe(0);
        expect(redis.get).toHaveBeenCalledWith(
          `${CAPTCHA_FAILURES_KEY_PREFIX}test-identifier`
        );
      });

      it("should return the stored failure count", async () => {
        const store = new Map([
          [`${CAPTCHA_FAILURES_KEY_PREFIX}phone-hash-123`, "3"],
        ]);
        const redis = createMockRedis(store);
        const count = await getFailureCount(redis, "phone-hash-123");
        expect(count).toBe(3);
      });

      it("should return numeric value for string-stored numbers", async () => {
        const store = new Map([
          [`${CAPTCHA_FAILURES_KEY_PREFIX}id1`, "5"],
        ]);
        const redis = createMockRedis(store);
        const count = await getFailureCount(redis, "id1");
        expect(count).toBe(5);
      });
    });

    describe("incrementFailureCount()", () => {
      it("should increment from 0 to 1 on first failure", async () => {
        const redis = createMockRedis();
        const count = await incrementFailureCount(redis, "id1");
        expect(count).toBe(1);
      });

      it("should increment from existing count", async () => {
        const store = new Map([
          [`${CAPTCHA_FAILURES_KEY_PREFIX}id2`, "2"],
        ]);
        const redis = createMockRedis(store);
        const count = await incrementFailureCount(redis, "id2");
        expect(count).toBe(3);
      });

      it("should set TTL on the key", async () => {
        const redis = createMockRedis();
        await incrementFailureCount(redis, "id3");
        expect(redis.expire).toHaveBeenCalledWith(
          `${CAPTCHA_FAILURES_KEY_PREFIX}id3`,
          CAPTCHA_FAILURE_TTL
        );
      });
    });

    describe("resetFailureCount()", () => {
      it("should delete the failure key", async () => {
        const store = new Map([
          [`${CAPTCHA_FAILURES_KEY_PREFIX}id4`, "4"],
        ]);
        const redis = createMockRedis(store);
        await resetFailureCount(redis, "id4");
        expect(redis.del).toHaveBeenCalledWith(
          `${CAPTCHA_FAILURES_KEY_PREFIX}id4`
        );
      });

      it("should not throw if key does not exist", async () => {
        const redis = createMockRedis();
        await expect(
          resetFailureCount(redis, "nonexistent")
        ).resolves.not.toThrow();
      });
    });
  });

  describe("captchaVerifier middleware", () => {
    let redis: Redis;
    let next: NextFunction;

    beforeEach(() => {
      next = vi.fn();
    });

    it("should pass through when failure count is below threshold", async () => {
      redis = createMockRedis(); // empty store = 0 failures
      const middleware = captchaVerifier({
        redis,
        captchaValidator: createMockValidator(false),
        getIdentifier: (req) => req.body.phone ?? "unknown",
      });

      const req = createMockReq({ phone: "9876543210" });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should pass through when failure count is 1 (below threshold)", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}9876543210`, "1"],
      ]);
      redis = createMockRedis(store);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: createMockValidator(false),
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({ phone: "9876543210" });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should pass through when failure count is 2 (below threshold)", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}9876543210`, "2"],
      ]);
      redis = createMockRedis(store);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: createMockValidator(false),
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({ phone: "9876543210" });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 403 CAPTCHA_REQUIRED when at threshold and no captchaToken provided", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}9876543210`, "3"],
      ]);
      redis = createMockRedis(store);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: createMockValidator(true),
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({ phone: "9876543210" });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "CAPTCHA_REQUIRED",
          message:
            "CAPTCHA verification is required after multiple failed attempts.",
        },
      });
    });

    it("should return 403 CAPTCHA_REQUIRED when over threshold and captchaToken is empty string", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}9876543210`, "5"],
      ]);
      redis = createMockRedis(store);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: createMockValidator(true),
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({ phone: "9876543210", captchaToken: "" });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "CAPTCHA_REQUIRED" }),
        })
      );
    });

    it("should return 403 CAPTCHA_INVALID when token validation fails", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}9876543210`, "3"],
      ]);
      redis = createMockRedis(store);
      const validator = createMockValidator(false);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: validator,
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({
        phone: "9876543210",
        captchaToken: "invalid-token",
      });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(validator.validate).toHaveBeenCalledWith("invalid-token");
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "CAPTCHA_INVALID",
          message: "CAPTCHA verification failed. Please try again.",
        },
      });
    });

    it("should pass through when at threshold and captchaToken is valid", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}9876543210`, "4"],
      ]);
      redis = createMockRedis(store);
      const validator = createMockValidator(true);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: validator,
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({
        phone: "9876543210",
        captchaToken: "valid-captcha-token",
      });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(validator.validate).toHaveBeenCalledWith("valid-captcha-token");
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should pass through (fail open) when Redis throws an error", async () => {
      redis = {
        get: vi.fn(async () => {
          throw new Error("Redis connection failed");
        }),
      } as unknown as Redis;
      const middleware = captchaVerifier({
        redis,
        captchaValidator: createMockValidator(false),
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({ phone: "9876543210" });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should pass through (fail open) when CAPTCHA validator throws", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}9876543210`, "5"],
      ]);
      redis = createMockRedis(store);
      const validator: CaptchaValidator = {
        validate: vi.fn(async () => {
          throw new Error("External service unavailable");
        }),
      };
      const middleware = captchaVerifier({
        redis,
        captchaValidator: validator,
        getIdentifier: (req) => req.body.phone,
      });

      const req = createMockReq({
        phone: "9876543210",
        captchaToken: "some-token",
      });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should use the getIdentifier function to extract identifier", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}192.168.1.1`, "4"],
      ]);
      redis = createMockRedis(store);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: createMockValidator(true),
        getIdentifier: (req) => (req as any).ip ?? "unknown",
      });

      const req = { body: {}, ip: "192.168.1.1" } as Request;
      const res = createMockRes();

      await middleware(req, res, next);

      // Should require CAPTCHA since count = 4 >= 3
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should handle exactly at threshold boundary (count = 3)", async () => {
      const store = new Map([
        [`${CAPTCHA_FAILURES_KEY_PREFIX}phone1`, "3"],
      ]);
      redis = createMockRedis(store);
      const validator = createMockValidator(true);
      const middleware = captchaVerifier({
        redis,
        captchaValidator: validator,
        getIdentifier: () => "phone1",
      });

      const req = createMockReq({ captchaToken: "valid" });
      const res = createMockRes();

      await middleware(req, res, next);

      expect(validator.validate).toHaveBeenCalledWith("valid");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Constants", () => {
    it("should have threshold of 3", () => {
      expect(CAPTCHA_FAILURE_THRESHOLD).toBe(3);
    });

    it("should have TTL of 900 seconds (15 minutes)", () => {
      expect(CAPTCHA_FAILURE_TTL).toBe(900);
    });

    it("should use correct key prefix", () => {
      expect(CAPTCHA_FAILURES_KEY_PREFIX).toBe("captcha_failures:");
    });
  });
});
