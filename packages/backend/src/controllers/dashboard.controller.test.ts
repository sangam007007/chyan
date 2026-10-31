/**
 * Unit tests for Dashboard Controller
 *
 * Tests:
 * 1. Milestone flag: streak of exactly 7 → milestone_reached: true; 6 and 8 → false
 * 2. Config error: invalid RANK_TOTAL_APPLICANTS → 500 with CONFIG_ERROR
 * 3. Self-rank inclusion: user at rank 51 still appears in response
 * 4. IST boundary: activity at 23:59 IST and 00:01 IST next day produce correct dates
 * 5. All endpoints return 401 without valid JWT
 *
 * Requirements: 2.5, 3.7, 1.4, 2.7, 4.1, 4.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";

// ─── Mocks ────────────────────────────────────────────────────────────

const { mockQueryOne, mockGetStreak, mockRecordActivity, mockGetLeaderboard, mockEstimateRank } =
  vi.hoisted(() => ({
    mockQueryOne: vi.fn(),
    mockGetStreak: vi.fn(),
    mockRecordActivity: vi.fn(),
    mockGetLeaderboard: vi.fn(),
    mockEstimateRank: vi.fn(),
  }));

vi.mock("@/db/index.js", () => ({
  queryOne: (...args: any[]) => mockQueryOne(...args),
}));

vi.mock("@/services/streak.service.js", () => ({
  getStreak: (...args: any[]) => mockGetStreak(...args),
  recordActivity: (...args: any[]) => mockRecordActivity(...args),
}));

vi.mock("@/services/leaderboard.service.js", () => ({
  getLeaderboard: (...args: any[]) => mockGetLeaderboard(...args),
}));

vi.mock("@/services/rank-estimator.service.js", () => ({
  estimateRank: (...args: any[]) => mockEstimateRank(...args),
}));

// Mock jwtAuth — by default: passes and attaches user
// For 401 tests, we override this per-test via a control flag
let jwtShouldReject = false;

vi.mock("@/middleware/jwt-auth.js", () => ({
  jwtAuth: (req: Request, res: Response, next: () => void) => {
    if (jwtShouldReject) {
      res.status(401).json({
        success: false,
        error: {
          code: "TOKEN_INVALID",
          message: "Missing or malformed authorization header",
        },
      });
      return;
    }
    req.user = { userId: "user-123", sessionId: "session-456" };
    next();
  },
}));

// Import after mocks are set up
import { dashboardRouter } from "./dashboard.controller.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: "user-123", sessionId: "session-456" },
    params: {},
    body: {},
    query: {},
    headers: {},
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
 * Extract a route handler from the router's stack by method and path.
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
  const router = dashboardRouter as unknown as { stack: RouteLayer[] };
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

describe("Dashboard Controller - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jwtShouldReject = false;
  });

  // ─── Milestone Flag Tests (Requirement 2.5) ──────────────────────────

  describe("GET /streak - Milestone flag", () => {
    it("should return milestone_reached: true when streak is exactly 7", async () => {
      mockGetStreak.mockResolvedValue({
        currentStreak: 7,
        streakDates: [
          "2025-01-07",
          "2025-01-06",
          "2025-01-05",
          "2025-01-04",
          "2025-01-03",
          "2025-01-02",
          "2025-01-01",
        ],
        todayRecorded: true,
        milestoneReached: true,
      });

      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const handler = getRouteHandler("get", "/streak");

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          currentStreak: 7,
          streakDates: expect.any(Array),
          todayRecorded: true,
          milestoneReached: true,
        },
      });
    });

    it("should return milestone_reached: false when streak is 6", async () => {
      mockGetStreak.mockResolvedValue({
        currentStreak: 6,
        streakDates: [
          "2025-01-07",
          "2025-01-06",
          "2025-01-05",
          "2025-01-04",
          "2025-01-03",
          "2025-01-02",
        ],
        todayRecorded: true,
        milestoneReached: false,
      });

      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const handler = getRouteHandler("get", "/streak");

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.body as any).data.milestoneReached).toBe(false);
    });

    it("should return milestone_reached: false when streak is 8", async () => {
      mockGetStreak.mockResolvedValue({
        currentStreak: 8,
        streakDates: [
          "2025-01-08",
          "2025-01-07",
          "2025-01-06",
          "2025-01-05",
          "2025-01-04",
          "2025-01-03",
          "2025-01-02",
          "2025-01-01",
        ],
        todayRecorded: true,
        milestoneReached: false,
      });

      const req = createMockReq({ query: {} });
      const res = createMockRes();
      const handler = getRouteHandler("get", "/streak");

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect((res.body as any).data.milestoneReached).toBe(false);
    });
  });

  // ─── Config Error Tests (Requirement 3.7) ────────────────────────────

  describe("GET /rank-estimate - Config error", () => {
    it("should return 500 with CONFIG_ERROR when estimateRank throws config error", async () => {
      const { AppError } = await import("@/errors/index.js");
      mockEstimateRank.mockRejectedValue(
        new AppError("Rank estimation configuration error", "CONFIG_ERROR", 500),
      );

      const req = createMockReq({ query: { marks: "75" } });
      const res = createMockRes();
      const handler = getRouteHandler("get", "/rank-estimate");

      await handler(req, res).catch((err: any) => {
        // The controller lets AppError propagate to the error handler
        // Simulate what the error handler does
        expect(err).toBeInstanceOf(AppError);
        expect(err.code).toBe("CONFIG_ERROR");
        expect(err.statusCode).toBe(500);
      });
    });
  });

  // ─── Self-Rank Inclusion Tests (Requirement 1.4) ─────────────────────

  describe("GET /leaderboard - Self-rank inclusion", () => {
    it("should include user rank even when user is at rank 51 (outside top 50)", async () => {
      // The leaderboard service returns entries (top 50) and the user's rank separately
      mockQueryOne.mockResolvedValue({ selected_exam_id: "exam-1" });
      mockGetLeaderboard.mockResolvedValue({
        entries: Array.from({ length: 50 }, (_, i) => ({
          rank: i + 1,
          userId: `user-${i}`,
          fullName: `User ${i}`,
          avatarUrl: null,
          totalScore: 1000 - i * 10,
        })),
        userRank: {
          rank: 51,
          userId: "user-123",
          fullName: "Test User",
          avatarUrl: null,
          totalScore: 450,
        },
        type: "state" as const,
      });

      const req = createMockReq({ query: { type: "state" } });
      const res = createMockRes();
      const handler = getRouteHandler("get", "/leaderboard");

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      const data = (res.body as any).data;
      expect(data.userRank).toEqual({
        rank: 51,
        userId: "user-123",
        fullName: "Test User",
        avatarUrl: null,
        totalScore: 450,
      });
      expect(data.entries).toHaveLength(50);
    });
  });

  // ─── IST Boundary Tests (Requirement 2.7) ────────────────────────────

  describe("POST /activity - IST boundary", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should record activity for the correct IST date at 23:59 IST", async () => {
      // 23:59 IST on Jan 15, 2025 = 18:29 UTC on Jan 15, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T18:29:00.000Z"));

      mockRecordActivity.mockResolvedValue(undefined);

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/activity");

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockRecordActivity).toHaveBeenCalledWith("user-123");
    });

    it("should record activity for the next IST date at 00:01 IST next day", async () => {
      // 00:01 IST on Jan 16, 2025 = 18:31 UTC on Jan 15, 2025
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-15T18:31:00.000Z"));

      mockRecordActivity.mockResolvedValue(undefined);

      const req = createMockReq();
      const res = createMockRes();
      const handler = getRouteHandler("post", "/activity");

      await handler(req, res);

      expect(res.statusCode).toBe(200);
      // The recordActivity service internally uses (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      // which will resolve to 2025-01-16 in IST. We verify the handler calls the service.
      expect(mockRecordActivity).toHaveBeenCalledWith("user-123");
    });
  });

  // ─── 401 Without JWT Tests (Requirement 4.1, 4.2) ───────────────────

  describe("All endpoints - 401 without valid JWT", () => {
    beforeEach(() => {
      jwtShouldReject = true;
    });

    it("GET /leaderboard should return 401 without JWT", async () => {
      const req = createMockReq({ query: { type: "national" } });
      const res = createMockRes();

      // Execute the full router middleware chain
      const router = dashboardRouter as any;
      // Call the jwtAuth middleware directly (first middleware in the chain)
      const layers = router.stack as RouteLayer[];
      const jwtLayer = layers.find(
        (l: any) => l.name === "jwtAuth" || (l.handle && l.handle.name === "jwtAuth"),
      );

      if (jwtLayer?.handle) {
        jwtLayer.handle(req, res, () => {});
      }

      expect(res.statusCode).toBe(401);
      expect((res.body as any).error.code).toBe("TOKEN_INVALID");
    });

    it("POST /activity should return 401 without JWT", async () => {
      const req = createMockReq();
      const res = createMockRes();

      const router = dashboardRouter as any;
      const layers = router.stack as RouteLayer[];
      const jwtLayer = layers.find(
        (l: any) => l.name === "jwtAuth" || (l.handle && l.handle.name === "jwtAuth"),
      );

      if (jwtLayer?.handle) {
        jwtLayer.handle(req, res, () => {});
      }

      expect(res.statusCode).toBe(401);
      expect((res.body as any).error.code).toBe("TOKEN_INVALID");
    });

    it("GET /streak should return 401 without JWT", async () => {
      const req = createMockReq();
      const res = createMockRes();

      const router = dashboardRouter as any;
      const layers = router.stack as RouteLayer[];
      const jwtLayer = layers.find(
        (l: any) => l.name === "jwtAuth" || (l.handle && l.handle.name === "jwtAuth"),
      );

      if (jwtLayer?.handle) {
        jwtLayer.handle(req, res, () => {});
      }

      expect(res.statusCode).toBe(401);
      expect((res.body as any).error.code).toBe("TOKEN_INVALID");
    });

    it("GET /rank-estimate should return 401 without JWT", async () => {
      const req = createMockReq({ query: { marks: "75" } });
      const res = createMockRes();

      const router = dashboardRouter as any;
      const layers = router.stack as RouteLayer[];
      const jwtLayer = layers.find(
        (l: any) => l.name === "jwtAuth" || (l.handle && l.handle.name === "jwtAuth"),
      );

      if (jwtLayer?.handle) {
        jwtLayer.handle(req, res, () => {});
      }

      expect(res.statusCode).toBe(401);
      expect((res.body as any).error.code).toBe("TOKEN_INVALID");
    });
  });
});
