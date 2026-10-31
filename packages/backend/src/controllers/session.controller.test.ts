/**
 * Unit tests for Session Controller
 *
 * Tests cover:
 * - GET /api/sessions: returns active sessions with current session indicator
 * - DELETE /api/sessions/:sessionId: terminates a remote session
 * - DELETE /api/sessions/:sessionId: blocks self-termination (returns 400)
 * - Error handling when service fails
 *
 * Requirements: 8.1–8.5
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ─── Mocks ────────────────────────────────────────────────────────────

const { mockListActive, mockRevoke, mockQueryOne } = vi.hoisted(() => ({
  mockListActive: vi.fn(),
  mockRevoke: vi.fn(),
  mockQueryOne: vi.fn(),
}));

// The controller only ends a session that belongs to the caller: it looks the session up by owner first
vi.mock("@/db/index.js", () => ({ queryOne: mockQueryOne }));

vi.mock("@/services/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    listActive: mockListActive,
    revoke: mockRevoke,
  })),
}));

vi.mock("@/middleware/jwt-auth.js", () => ({
  jwtAuth: (
    req: Request,
    _res: Response,
    next: () => void
  ) => {
    req.user = {
      userId: "user-123",
      sessionId: "current-session-id",
    };
    next();
  },
}));

// Import after mocks are set up
import { sessionRouter } from "./session.controller.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: "user-123", sessionId: "current-session-id" },
    params: {},
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
 * The sessionRouter has routes registered; we need to find the handler
 * for a specific method + path to call it directly in tests.
 */
interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: Request, res: Response) => Promise<void> }>;
  };
}

function getRouteHandler(method: string, path: string) {
  const router = sessionRouter as unknown as { stack: RouteLayer[] };
  for (const layer of router.stack) {
    if (
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method]
    ) {
      // The last handler in the stack is the actual route handler (after middleware)
      const handlers = layer.route.stack;
      return handlers[handlers.length - 1].handle;
    }
  }
  throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("Session Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/sessions", () => {
    it("should return a list of active sessions with isCurrent flag", async () => {
      mockListActive.mockResolvedValueOnce([
        {
          id: "current-session-id",
          user_id: "user-123",
          token_family: "family-1",
          device_type: "desktop",
          device_info: { browser: "Chrome", os: "Windows" },
          ip_address: "192.168.1.1",
          city: "Delhi",
          is_active: true,
          last_active_at: new Date("2024-01-15T10:00:00Z"),
          created_at: new Date("2024-01-14T08:00:00Z"),
          expires_at: new Date("2024-02-14T08:00:00Z"),
        },
        {
          id: "other-session-id",
          user_id: "user-123",
          token_family: "family-2",
          device_type: "mobile",
          device_info: { browser: "Safari", os: "iOS" },
          ip_address: "10.0.0.1",
          city: "Mumbai",
          is_active: true,
          last_active_at: new Date("2024-01-15T09:00:00Z"),
          created_at: new Date("2024-01-13T12:00:00Z"),
          expires_at: new Date("2024-02-13T12:00:00Z"),
        },
      ]);

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("get", "/");

      await handler(req, res);

      expect(res.body).toEqual({
        success: true,
        data: {
          sessions: [
            {
              id: "current-session-id",
              deviceType: "desktop",
              deviceInfo: { browser: "Chrome", os: "Windows" },
              ipAddress: "192.168.1.1",
              city: "Delhi",
              lastActiveAt: new Date("2024-01-15T10:00:00Z"),
              createdAt: new Date("2024-01-14T08:00:00Z"),
              isCurrent: true,
            },
            {
              id: "other-session-id",
              deviceType: "mobile",
              deviceInfo: { browser: "Safari", os: "iOS" },
              ipAddress: "10.0.0.1",
              city: "Mumbai",
              lastActiveAt: new Date("2024-01-15T09:00:00Z"),
              createdAt: new Date("2024-01-13T12:00:00Z"),
              isCurrent: false,
            },
          ],
        },
      });
      expect(mockListActive).toHaveBeenCalledWith("user-123");
    });

    it("should return an empty array when no active sessions exist", async () => {
      mockListActive.mockResolvedValueOnce([]);

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("get", "/");

      await handler(req, res);

      expect(res.body).toEqual({
        success: true,
        data: { sessions: [] },
      });
    });

    it("should return 500 when service throws an error", async () => {
      mockListActive.mockRejectedValueOnce(new Error("Database error"));

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("get", "/");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to retrieve sessions" },
      });
    });
  });

  describe("DELETE /api/sessions/:sessionId", () => {
    it("should terminate a remote session successfully", async () => {
      mockQueryOne.mockResolvedValueOnce({ id: "other-session-id" }); // it belongs to this user
      mockRevoke.mockResolvedValueOnce(undefined);

      const req = createMockReq({ params: { sessionId: "other-session-id" } });
      const res = createMockRes();
      const handler = getRouteHandler("delete", "/:sessionId");

      await handler(req, res);

      expect(res.body).toEqual({
        success: true,
        data: { message: "Session terminated successfully" },
      });
      expect(mockRevoke).toHaveBeenCalledWith("other-session-id");
    });

    it("should return 404 and not end a session that belongs to someone else", async () => {
      mockQueryOne.mockResolvedValueOnce(null); // not found for this user
      const req = createMockReq({ params: { sessionId: "someone-elses-session" } });
      const res = createMockRes();
      const handler = getRouteHandler("delete", "/:sessionId");

      await handler(req, res);

      expect(res.statusCode).toBe(404);
      expect(mockRevoke).not.toHaveBeenCalledWith("someone-elses-session");
    });

    it("should return 400 when attempting to terminate the current session", async () => {
      const req = createMockReq({ params: { sessionId: "current-session-id" } });
      const res = createMockRes();
      const handler = getRouteHandler("delete", "/:sessionId");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Cannot terminate the current session. Use logout instead.",
        },
      });
      expect(mockRevoke).not.toHaveBeenCalled();
    });

    it("should return 500 when service throws an error", async () => {
      mockQueryOne.mockResolvedValueOnce({ id: "other-session-id" });
      mockRevoke.mockRejectedValueOnce(new Error("Database error"));

      const req = createMockReq({ params: { sessionId: "other-session-id" } });
      const res = createMockRes();
      const handler = getRouteHandler("delete", "/:sessionId");

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.body).toEqual({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to terminate session" },
      });
    });
  });
});
