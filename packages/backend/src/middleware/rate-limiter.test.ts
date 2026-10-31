/**
 * Unit tests for Rate Limiter Middleware.
 * Mocks Redis rate-limit utilities to test middleware logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// ─── Mock Redis rate-limit module ─────────────────────────────────────

vi.mock("@/redis/rate-limit.js", () => ({
  recordIpRequest: vi.fn().mockResolvedValue(1),
  getIpRequestCount: vi.fn().mockResolvedValue(0),
  getIpRetryAfter: vi.fn().mockResolvedValue(0),
  recordOtpRequest: vi.fn().mockResolvedValue(1),
  getOtpRequestCount: vi.fn().mockResolvedValue(0),
  getOtpRetryAfter: vi.fn().mockResolvedValue(0),
}));

import * as rateLimitUtils from "@/redis/rate-limit.js";
import { ipRateLimiter, otpRateLimiter } from "./rate-limiter.js";

// ─── Test Helpers ─────────────────────────────────────────────────────

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    ip: "192.168.1.1",
    headers: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response & {
  statusCode: number;
  headersSent: boolean;
  _headers: Record<string, string>;
  _body: unknown;
} {
  const res = {
    statusCode: 200,
    headersSent: false,
    _headers: {} as Record<string, string>,
    _body: null as unknown,
    setHeader(name: string, value: string) {
      res._headers[name] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      res.headersSent = true;
      return res;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    headersSent: boolean;
    _headers: Record<string, string>;
    _body: unknown;
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("ipRateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow requests under the rate limit", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockResolvedValue(5);
    vi.mocked(rateLimitUtils.recordIpRequest).mockResolvedValue(6);

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("should block requests when IP rate limit is reached", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockResolvedValue(50);
    vi.mocked(rateLimitUtils.getIpRetryAfter).mockResolvedValue(1823);

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res._headers["Retry-After"]).toBe("1823");
    expect(res._body).toEqual({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: expect.any(String),
        retryAfter: 1823,
      },
    });
  });

  it("should block requests when count exceeds limit after recording", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockResolvedValue(49);
    vi.mocked(rateLimitUtils.recordIpRequest).mockResolvedValue(51);
    vi.mocked(rateLimitUtils.getIpRetryAfter).mockResolvedValue(900);

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res._headers["Retry-After"]).toBe("900");
  });

  it("ignores a client-supplied x-forwarded-for header (it would let anyone dodge the limit); uses req.ip", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockResolvedValue(0);
    vi.mocked(rateLimitUtils.recordIpRequest).mockResolvedValue(1);

    // req.ip is what Express works out for the configured number of trusted proxies
    const req = createMockRequest({
      ip: "203.0.113.9",
      headers: { "x-forwarded-for": "10.0.0.1, 10.0.0.2" },
    });
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(rateLimitUtils.getIpRequestCount).toHaveBeenCalledWith("203.0.113.9");
    expect(rateLimitUtils.recordIpRequest).toHaveBeenCalledWith("203.0.113.9");
    expect(rateLimitUtils.getIpRequestCount).not.toHaveBeenCalledWith("10.0.0.1");
    expect(next).toHaveBeenCalled();
  });

  it("should fall back to req.ip when no x-forwarded-for header", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockResolvedValue(0);
    vi.mocked(rateLimitUtils.recordIpRequest).mockResolvedValue(1);

    const req = createMockRequest({ ip: "172.16.0.5" });
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(rateLimitUtils.getIpRequestCount).toHaveBeenCalledWith("172.16.0.5");
    expect(next).toHaveBeenCalled();
  });

  it("should return Hindi error message when Accept-Language includes hi", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockResolvedValue(50);
    vi.mocked(rateLimitUtils.getIpRetryAfter).mockResolvedValue(500);

    const req = createMockRequest({
      headers: { "accept-language": "hi-IN,hi;q=0.9,en;q=0.8" },
    });
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    const body = res._body as { error: { message: string } };
    expect(body.error.message).toContain("बहुत अधिक अनुरोध");
  });

  it("should return English error message by default", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockResolvedValue(50);
    vi.mocked(rateLimitUtils.getIpRetryAfter).mockResolvedValue(500);

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    const body = res._body as { error: { message: string } };
    expect(body.error.message).toContain("Too many requests");
  });

  it("should fail-open when Redis throws an error", async () => {
    vi.mocked(rateLimitUtils.getIpRequestCount).mockRejectedValue(
      new Error("Redis connection refused")
    );

    const req = createMockRequest();
    const res = createMockResponse();
    const next = vi.fn();

    await ipRateLimiter(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});

describe("otpRateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow OTP requests under the rate limit", async () => {
    vi.mocked(rateLimitUtils.getOtpRequestCount).mockResolvedValue(3);

    const req = createMockRequest({ body: { phone: "9876543210" } });
    const res = createMockResponse();
    const next = vi.fn();

    await otpRateLimiter(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("should block OTP requests when phone rate limit is reached", async () => {
    vi.mocked(rateLimitUtils.getOtpRequestCount).mockResolvedValue(10);
    vi.mocked(rateLimitUtils.getOtpRetryAfter).mockResolvedValue(2400);

    const req = createMockRequest({ body: { phone: "9876543210" } });
    const res = createMockResponse();
    const next = vi.fn();

    await otpRateLimiter(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res._headers["Retry-After"]).toBe("2400");
    expect(res._body).toEqual({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: expect.any(String),
        retryAfter: 2400,
      },
    });
  });

  it("should skip rate limiting when no phone in request body", async () => {
    const req = createMockRequest({ body: {} });
    const res = createMockResponse();
    const next = vi.fn();

    await otpRateLimiter(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(rateLimitUtils.getOtpRequestCount).not.toHaveBeenCalled();
  });

  it("should return Hindi error message when Accept-Language includes hi", async () => {
    vi.mocked(rateLimitUtils.getOtpRequestCount).mockResolvedValue(10);
    vi.mocked(rateLimitUtils.getOtpRetryAfter).mockResolvedValue(1200);

    const req = createMockRequest({
      body: { phone: "9876543210" },
      headers: { "accept-language": "hi" },
    });
    const res = createMockResponse();
    const next = vi.fn();

    await otpRateLimiter(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    const body = res._body as { error: { message: string } };
    expect(body.error.message).toContain("OTP अनुरोध सीमा");
  });

  it("should return English error message by default", async () => {
    vi.mocked(rateLimitUtils.getOtpRequestCount).mockResolvedValue(10);
    vi.mocked(rateLimitUtils.getOtpRetryAfter).mockResolvedValue(1200);

    const req = createMockRequest({ body: { phone: "9876543210" } });
    const res = createMockResponse();
    const next = vi.fn();

    await otpRateLimiter(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    const body = res._body as { error: { message: string } };
    expect(body.error.message).toContain("OTP request limit reached");
  });

  it("should fail-open when Redis throws an error", async () => {
    vi.mocked(rateLimitUtils.getOtpRequestCount).mockRejectedValue(
      new Error("Redis timeout")
    );

    const req = createMockRequest({ body: { phone: "9876543210" } });
    const res = createMockResponse();
    const next = vi.fn();

    await otpRateLimiter(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("should use phone from request body as the rate limit key", async () => {
    vi.mocked(rateLimitUtils.getOtpRequestCount).mockResolvedValue(2);

    const req = createMockRequest({ body: { phone: "8765432109" } });
    const res = createMockResponse();
    const next = vi.fn();

    await otpRateLimiter(req, res as unknown as Response, next);

    expect(rateLimitUtils.getOtpRequestCount).toHaveBeenCalledWith(
      "8765432109"
    );
    expect(next).toHaveBeenCalled();
  });
});
