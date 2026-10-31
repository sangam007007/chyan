import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { csrfProtection, generateCsrfToken } from "./csrf.js";

// ─── Mock Redis CSRF helpers ──────────────────────────────────────────

const mockStoreCsrfToken = vi.fn();
const mockValidateCsrfToken = vi.fn();

vi.mock("@/redis/csrf.js", () => ({
  storeCsrfToken: (...args: unknown[]) => mockStoreCsrfToken(...args),
  validateCsrfToken: (...args: unknown[]) => mockValidateCsrfToken(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response & {
  _status: number | null;
  _json: unknown;
} {
  const res = {
    _status: null as number | null,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._json = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number | null; _json: unknown };
}

function createMockNext(): NextFunction & { called: boolean } {
  const fn = (() => {
    fn.called = true;
  }) as unknown as NextFunction & { called: boolean };
  fn.called = false;
  return fn;
}

// ─── Tests: csrfProtection middleware ─────────────────────────────────

describe("csrfProtection middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("safe methods (should pass through)", () => {
    it("should call next() for GET requests without checking token", async () => {
      const req = createMockRequest({ method: "GET" });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(true);
      expect(mockValidateCsrfToken).not.toHaveBeenCalled();
    });

    it("should call next() for HEAD requests without checking token", async () => {
      const req = createMockRequest({ method: "HEAD" });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(true);
      expect(mockValidateCsrfToken).not.toHaveBeenCalled();
    });

    it("should call next() for OPTIONS requests without checking token", async () => {
      const req = createMockRequest({ method: "OPTIONS" });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(true);
      expect(mockValidateCsrfToken).not.toHaveBeenCalled();
    });
  });

  describe("state-changing methods (should validate token)", () => {
    it("should return 403 for POST without CSRF token", async () => {
      const req = createMockRequest({ method: "POST", headers: {} });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(false);
      expect(res._status).toBe(403);
      expect(res._json).toEqual({
        success: false,
        error: {
          code: "CSRF_INVALID",
          message: "Missing or invalid security token",
        },
      });
    });

    it("should return 403 for PATCH without CSRF token", async () => {
      const req = createMockRequest({ method: "PATCH", headers: {} });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(false);
      expect(res._status).toBe(403);
      expect((res._json as any).error.code).toBe("CSRF_INVALID");
    });

    it("should return 403 for DELETE without CSRF token", async () => {
      const req = createMockRequest({ method: "DELETE", headers: {} });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(false);
      expect(res._status).toBe(403);
      expect((res._json as any).error.code).toBe("CSRF_INVALID");
    });

    it("should return 403 for PUT without CSRF token", async () => {
      const req = createMockRequest({ method: "PUT", headers: {} });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(false);
      expect(res._status).toBe(403);
      expect((res._json as any).error.code).toBe("CSRF_INVALID");
    });

    it("should return 403 when CSRF token is invalid (not found in Redis)", async () => {
      mockValidateCsrfToken.mockResolvedValue(null);

      const req = createMockRequest({
        method: "POST",
        headers: { "x-csrf-token": "invalid-token-abc123" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(mockValidateCsrfToken).toHaveBeenCalledWith("invalid-token-abc123");
      expect(next.called).toBe(false);
      expect(res._status).toBe(403);
      expect((res._json as any).error.code).toBe("CSRF_INVALID");
    });

    it("should call next() when CSRF token is valid", async () => {
      mockValidateCsrfToken.mockResolvedValue("user-123");

      const req = createMockRequest({
        method: "POST",
        headers: { "x-csrf-token": "valid-token-xyz789" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(mockValidateCsrfToken).toHaveBeenCalledWith("valid-token-xyz789");
      expect(next.called).toBe(true);
      expect(res._status).toBeNull();
    });

    it("should call next() for DELETE with valid CSRF token", async () => {
      mockValidateCsrfToken.mockResolvedValue("user-456");

      const req = createMockRequest({
        method: "DELETE",
        headers: { "x-csrf-token": "delete-token" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(true);
    });

    it("should call next() for PATCH with valid CSRF token", async () => {
      mockValidateCsrfToken.mockResolvedValue("user-789");

      const req = createMockRequest({
        method: "PATCH",
        headers: { "x-csrf-token": "patch-token" },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await csrfProtection(req, res, next);

      expect(next.called).toBe(true);
    });
  });
});

// ─── Tests: generateCsrfToken route handler ───────────────────────────

describe("generateCsrfToken route handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreCsrfToken.mockResolvedValue(undefined);
  });

  it("should generate and return a CSRF token", async () => {
    const req = createMockRequest({ method: "GET" }) as any;
    req.userId = "user-123";
    const res = createMockResponse();

    await generateCsrfToken(req, res);

    expect(res._status).toBe(200);
    expect((res._json as any).success).toBe(true);
    expect((res._json as any).data.csrfToken).toBeDefined();
    expect(typeof (res._json as any).data.csrfToken).toBe("string");
    // Token should be 64 hex characters (32 bytes)
    expect((res._json as any).data.csrfToken).toHaveLength(64);
  });

  it("should store the token in Redis with the user's ID", async () => {
    const req = createMockRequest({ method: "GET" }) as any;
    req.userId = "user-abc";
    const res = createMockResponse();

    await generateCsrfToken(req, res);

    expect(mockStoreCsrfToken).toHaveBeenCalledWith(
      expect.any(String),
      "user-abc"
    );
    // The token stored should match the token returned
    const returnedToken = (res._json as any).data.csrfToken;
    expect(mockStoreCsrfToken).toHaveBeenCalledWith(returnedToken, "user-abc");
  });

  it("should use user.id when userId is not directly on req", async () => {
    const req = createMockRequest({ method: "GET" }) as any;
    req.user = { id: "user-from-user-obj" };
    const res = createMockResponse();

    await generateCsrfToken(req, res);

    expect(mockStoreCsrfToken).toHaveBeenCalledWith(
      expect.any(String),
      "user-from-user-obj"
    );
  });

  it('should use "anonymous" when no user context is available', async () => {
    const req = createMockRequest({ method: "GET" });
    const res = createMockResponse();

    await generateCsrfToken(req, res);

    expect(mockStoreCsrfToken).toHaveBeenCalledWith(
      expect.any(String),
      "anonymous"
    );
  });

  it("should generate unique tokens on each call", async () => {
    const req = createMockRequest({ method: "GET" }) as any;
    req.userId = "user-123";
    const res1 = createMockResponse();
    const res2 = createMockResponse();

    await generateCsrfToken(req, res1);
    await generateCsrfToken(req, res2);

    const token1 = (res1._json as any).data.csrfToken;
    const token2 = (res2._json as any).data.csrfToken;
    expect(token1).not.toBe(token2);
  });
});
