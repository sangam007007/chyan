/**
 * Unit tests for Account Lifecycle Controller
 *
 * Tests the three routes:
 * - POST /api/account/delete/request
 * - POST /api/account/delete/confirm
 * - POST /api/account/delete/cancel
 *
 * Requirements: 15.1–15.8
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ─── Mocks ────────────────────────────────────────────────────────────

const { mockQueryOne, mockGenerate, mockVerify, mockDeleteAccount, mockCancelDeletion, mockRevokeAll } = vi.hoisted(() => ({
  mockQueryOne: vi.fn(),
  mockGenerate: vi.fn(),
  mockVerify: vi.fn(),
  mockDeleteAccount: vi.fn(),
  mockCancelDeletion: vi.fn(),
  mockRevokeAll: vi.fn(),
}));

vi.mock("@/db/index.js", () => ({
  queryOne: (...args: any[]) => mockQueryOne(...args),
  queryMany: vi.fn().mockResolvedValue([]),
  withTransaction: vi.fn(),
}));

vi.mock("@/services/otp.service.js", () => ({
  OtpService: vi.fn().mockImplementation(() => ({
    generate: mockGenerate,
    verify: mockVerify,
  })),
}));

vi.mock("@/services/profile.service.js", () => ({
  ProfileService: vi.fn().mockImplementation(() => ({
    deleteAccount: mockDeleteAccount,
    cancelDeletion: mockCancelDeletion,
  })),
}));

vi.mock("@/services/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    revokeAll: mockRevokeAll,
  })),
}));

vi.mock("@/services/sms-gateway.interface.js", () => ({
  MockSmsGateway: vi.fn(),
}));

vi.mock("@/config/env.js", () => ({
  env: { JWT_SECRET: "test-secret" },
}));

vi.mock("@/middleware/jwt-auth.js", () => ({
  jwtAuth: (req: Request, _res: Response, next: () => void) => {
    req.user = { userId: "user-123", sessionId: "session-456" };
    next();
  },
}));

vi.mock("@/middleware/csrf.js", () => ({
  csrfProtection: (_req: Request, _res: Response, next: () => void) => {
    next();
  },
}));

// Import after mocks are set up
import { accountRouter } from "./account.controller.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: "user-123", sessionId: "session-456" },
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  vi.spyOn(res, "status");
  vi.spyOn(res, "json");
  return res as unknown as Response & { statusCode: number; body: unknown };
}

/**
 * Extract the route handler from the router's stack.
 * The accountRouter has middleware applied at the router level (jwtAuth, csrfProtection),
 * then route-specific handlers. We need to find the handler for a specific method + path.
 */
interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
  };
  name?: string;
  handle?: any;
}

function getRouteHandler(method: string, path: string) {
  const router = accountRouter as unknown as { stack: RouteLayer[] };
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
    ) {
      // The last handler in the stack is the actual route handler
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle;
    }
  }
  throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("Account Lifecycle Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/account/delete/request", () => {
    it("should send OTP for re-authentication and return success", async () => {
      mockQueryOne.mockResolvedValue({ phone: "9876543210" });
      mockGenerate.mockResolvedValue({
        success: true,
        expiresIn: 300,
        resendAfter: 30,
      });

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/request");

      await handler(req, res);

      expect(res.body).toEqual({
        success: true,
        data: {
          message: "OTP sent for account deletion verification",
          expiresIn: 300,
          resendAfter: 30,
        },
      });
      expect(mockGenerate).toHaveBeenCalledWith("9876543210");
    });

    it("should return 400 if user has no phone number", async () => {
      mockQueryOne.mockResolvedValue({ phone: null });

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/request");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: "DELETION_AUTH_FAILED",
          message: "No phone number associated with this account. Cannot verify identity.",
        },
      });
    });

    it("should return 400 if user not found", async () => {
      mockQueryOne.mockResolvedValue(null);

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/request");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: "DELETION_AUTH_FAILED",
          message: "No phone number associated with this account. Cannot verify identity.",
        },
      });
    });

    it("should propagate OTP rate limit errors", async () => {
      mockQueryOne.mockResolvedValue({ phone: "9876543210" });

      const { OtpRateLimitError } = await import("@/errors/otp.errors.js");
      mockGenerate.mockRejectedValue(new OtpRateLimitError(120));

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/request");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "RATE_LIMITED" },
      });
    });

    it("should return 500 on unexpected errors", async () => {
      mockQueryOne.mockResolvedValue({ phone: "9876543210" });
      mockGenerate.mockRejectedValue(new Error("Unexpected error"));

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/request");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to initiate account deletion" },
      });
    });
  });

  describe("POST /api/account/delete/confirm", () => {
    it("should verify OTP, schedule deletion, and revoke sessions", async () => {
      const scheduledDate = new Date("2025-01-15T00:00:00.000Z");
      mockQueryOne.mockResolvedValue({ phone: "9876543210" });
      mockVerify.mockResolvedValue({ valid: true });
      mockDeleteAccount.mockResolvedValue({ deletionScheduledAt: scheduledDate });
      mockRevokeAll.mockResolvedValue(undefined);

      const req = createMockReq({ body: { otp: "123456" } });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.body).toEqual({
        success: true,
        data: {
          message: "Account deletion scheduled",
          deletionScheduledAt: "2025-01-15T00:00:00.000Z",
        },
      });

      expect(mockVerify).toHaveBeenCalledWith("9876543210", "123456");
      expect(mockDeleteAccount).toHaveBeenCalledWith("user-123", "session-456");
      expect(mockRevokeAll).toHaveBeenCalledWith("user-123", "session-456");
    });

    it("should return 422 for invalid OTP format (non-numeric)", async () => {
      const req = createMockReq({ body: { otp: "abcdef" } });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    });

    it("should return 422 for OTP with wrong length", async () => {
      const req = createMockReq({ body: { otp: "123" } });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    });

    it("should return 422 when OTP is missing", async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    });

    it("should return 403 when OTP verification fails (invalid code)", async () => {
      mockQueryOne.mockResolvedValue({ phone: "9876543210" });

      const { InvalidOtpError } = await import("@/errors/otp.errors.js");
      mockVerify.mockRejectedValue(new InvalidOtpError(3));

      const req = createMockReq({ body: { otp: "999999" } });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "DELETION_AUTH_FAILED" },
      });
    });

    it("should return 403 when OTP is expired", async () => {
      mockQueryOne.mockResolvedValue({ phone: "9876543210" });

      const { OtpExpiredError } = await import("@/errors/otp.errors.js");
      mockVerify.mockRejectedValue(new OtpExpiredError());

      const req = createMockReq({ body: { otp: "123456" } });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "DELETION_AUTH_FAILED" },
      });
    });

    it("should return 400 when user has no phone", async () => {
      mockQueryOne.mockResolvedValue({ phone: null });

      const req = createMockReq({ body: { otp: "123456" } });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "DELETION_AUTH_FAILED" },
      });
    });

    it("should return 500 on unexpected errors", async () => {
      mockQueryOne.mockResolvedValue({ phone: "9876543210" });
      mockVerify.mockResolvedValue({ valid: true });
      mockDeleteAccount.mockRejectedValue(new Error("DB connection lost"));

      const req = createMockReq({ body: { otp: "123456" } });
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/confirm");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to confirm account deletion" },
      });
    });
  });

  describe("POST /api/account/delete/cancel", () => {
    it("should cancel pending deletion and return success", async () => {
      mockCancelDeletion.mockResolvedValue(undefined);

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/cancel");

      await handler(req, res);

      expect(res.body).toEqual({
        success: true,
        data: { message: "Account deletion cancelled" },
      });
      expect(mockCancelDeletion).toHaveBeenCalledWith("user-123");
    });

    it("should return 404 when user not found or no pending deletion", async () => {
      const { UserNotFoundError } = await import("@/errors/profile.errors.js");
      mockCancelDeletion.mockRejectedValue(new UserNotFoundError("user-123"));

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/cancel");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.body).toMatchObject({
        success: false,
        error: { code: "USER_NOT_FOUND" },
      });
    });

    it("should return 500 on unexpected errors", async () => {
      mockCancelDeletion.mockRejectedValue(new Error("Connection timeout"));

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/delete/cancel");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to cancel account deletion" },
      });
    });
  });
});
