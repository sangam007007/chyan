import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

import { requireRole } from "./require-role.js";

// ─── Helpers ──────────────────────────────────────────────────────────

function mockRequest(user?: { userId: string; sessionId: string; role?: string }): Request {
  return { user } as unknown as Request;
}

function mockResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("requireRole middleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it("allows access when user role matches a single allowed role", () => {
    const middleware = requireRole("admin");
    const req = mockRequest({ userId: "u1", sessionId: "s1", role: "admin" });
    const res = mockResponse();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows access when user has any of multiple allowed roles", () => {
    const middleware = requireRole("admin", "super_admin");
    const req = mockRequest({ userId: "u1", sessionId: "s1", role: "super_admin" });
    const res = mockResponse();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 when user role does not match allowed roles", () => {
    const middleware = requireRole("admin", "super_admin");
    const req = mockRequest({ userId: "u1", sessionId: "s1", role: "student" });
    const res = mockResponse();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions",
      },
    });
  });

  it("returns 401 when req.user is undefined (jwtAuth not applied)", () => {
    const middleware = requireRole("admin");
    const req = mockRequest(undefined);
    const res = mockResponse();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "TOKEN_INVALID",
        message: "Authentication required",
      },
    });
  });

  it("works with a single role requirement", () => {
    const middleware = requireRole("super_admin");
    const req = mockRequest({ userId: "u1", sessionId: "s1", role: "super_admin" });
    const res = mockResponse();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("works with multiple role requirements and denies unlisted roles", () => {
    const middleware = requireRole("admin", "super_admin");
    const req = mockRequest({ userId: "u1", sessionId: "s1", role: "student" });
    const res = mockResponse();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 when user role is undefined", () => {
    const middleware = requireRole("admin");
    const req = mockRequest({ userId: "u1", sessionId: "s1", role: undefined });
    const res = mockResponse();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
