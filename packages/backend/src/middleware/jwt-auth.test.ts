/**
 * Unit tests for JWT Auth Middleware
 *
 * Tests cover:
 * - Valid token with active session → attaches user context
 * - Expired token → 401 TOKEN_EXPIRED
 * - Invalid/malformed token → 401 TOKEN_INVALID
 * - Missing Authorization header → 401 TOKEN_INVALID
 * - Bearer prefix without token → 401 TOKEN_INVALID
 * - Valid token but session terminated in Redis → 401 SESSION_TERMINATED
 * - Valid token but Redis error → 401 TOKEN_INVALID (fail closed)
 * - Invalid payload structure → 401 TOKEN_INVALID
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { jwtAuth } from "./jwt-auth.js";

// ─── Mocks ────────────────────────────────────────────────────────────

// Mock the env module
vi.mock("@/config/env.js", () => ({
  env: {
    JWT_SECRET: "test-secret-key-that-is-at-least-32-chars-long",
  },
}));

// Mock the Redis session module
const mockGetSessionMetadata = vi.fn();
vi.mock("@/redis/session.js", () => ({
  getSessionMetadata: (...args: unknown[]) => mockGetSessionMetadata(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────

const TEST_SECRET = "test-secret-key-that-is-at-least-32-chars-long";

function createMockRequest(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function createMockResponse(): Partial<Response> & {
  statusCode?: number;
  body?: unknown;
} {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn().mockImplementation((data: unknown) => {
    res.body = data;
    return res;
  });
  return res;
}

function generateValidToken(
  payload: { sub: string; sessionId: string },
  options?: jwt.SignOptions
): string {
  return jwt.sign(payload, TEST_SECRET, {
    expiresIn: "1h",
    ...options,
  });
}

function generateExpiredToken(payload: {
  sub: string;
  sessionId: string;
}): string {
  return jwt.sign(payload, TEST_SECRET, { expiresIn: "-1s" });
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("jwtAuth middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
  });

  describe("missing or malformed Authorization header", () => {
    it("should return 401 TOKEN_INVALID when no Authorization header is present", () => {
      const req = createMockRequest() as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Missing or malformed authorization header",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 TOKEN_INVALID when Authorization header does not start with Bearer", () => {
      const req = createMockRequest("Basic abc123") as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Missing or malformed authorization header",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 TOKEN_INVALID when Bearer prefix is present but token is empty", () => {
      const req = createMockRequest("Bearer ") as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Missing or malformed authorization header",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("invalid tokens", () => {
    it("should return 401 TOKEN_INVALID for a completely malformed token", () => {
      const req = createMockRequest("Bearer not.a.valid.jwt") as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Invalid access token",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 TOKEN_INVALID for a token signed with wrong secret", () => {
      const token = jwt.sign(
        { sub: "user-123", sessionId: "session-456" },
        "wrong-secret-key-that-is-also-32-chars",
        { expiresIn: "1h" }
      );
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Invalid access token",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 TOKEN_EXPIRED for an expired token", () => {
      const token = generateExpiredToken({
        sub: "user-123",
        sessionId: "session-456",
      });
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_EXPIRED",
          message: "Access token has expired",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("invalid payload", () => {
    it("should return 401 TOKEN_INVALID when payload is missing sub", async () => {
      const token = jwt.sign({ sessionId: "session-456" }, TEST_SECRET, {
        expiresIn: "1h",
      });
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      // Need to wait for potential async operations
      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(401);
      });

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Invalid token payload",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 TOKEN_INVALID when payload is missing sessionId", async () => {
      const token = jwt.sign({ sub: "user-123" }, TEST_SECRET, {
        expiresIn: "1h",
      });
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(401);
      });

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Invalid token payload",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("session validation (Redis)", () => {
    it("should attach user context and call next() when token is valid and session is active", async () => {
      const token = generateValidToken({
        sub: "user-123",
        sessionId: "session-456",
      });
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      mockGetSessionMetadata.mockResolvedValueOnce({
        user_id: "user-123",
        device_type: "desktop",
        created_at: Date.now(),
        last_active_at: Date.now(),
      });

      jwtAuth(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });

      expect(req.user).toEqual({
        userId: "user-123",
        sessionId: "session-456",
      });
      expect(mockGetSessionMetadata).toHaveBeenCalledWith("session-456");
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 401 SESSION_TERMINATED when session is not found in Redis", async () => {
      const token = generateValidToken({
        sub: "user-123",
        sessionId: "session-456",
      });
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      mockGetSessionMetadata.mockResolvedValueOnce(null);

      jwtAuth(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(401);
      });

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "SESSION_TERMINATED",
          message: "Session has been terminated",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 TOKEN_INVALID when Redis throws an error (fail closed)", async () => {
      const token = generateValidToken({
        sub: "user-123",
        sessionId: "session-456",
      });
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      mockGetSessionMetadata.mockRejectedValueOnce(
        new Error("Redis connection failed")
      );

      jwtAuth(req, res, next);

      await vi.waitFor(() => {
        expect(res.status).toHaveBeenCalledWith(401);
      });

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Unable to validate session",
        },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle tokens with extra whitespace in Bearer header", () => {
      // "Bearer  token" has double space — the slice(7) grabs " token" which is invalid JWT
      const req = createMockRequest("Bearer  invalidtoken") as Request;
      const res = createMockResponse() as unknown as Response;

      jwtAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should correctly extract userId from sub claim", async () => {
      const userId = "550e8400-e29b-41d4-a716-446655440000";
      const sessionId = "660e8400-e29b-41d4-a716-446655440001";

      const token = generateValidToken({ sub: userId, sessionId });
      const req = createMockRequest(`Bearer ${token}`) as Request;
      const res = createMockResponse() as unknown as Response;

      mockGetSessionMetadata.mockResolvedValueOnce({
        user_id: userId,
        device_type: "mobile",
        created_at: Date.now(),
        last_active_at: Date.now(),
      });

      jwtAuth(req, res, next);

      await vi.waitFor(() => {
        expect(next).toHaveBeenCalled();
      });

      expect(req.user).toEqual({ userId, sessionId });
    });
  });
});
