import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "./error-handler.js";
import { AppError, ValidationError, AuthenticationError, RateLimitError, ExternalServiceError } from "@/errors/app-error.js";
import { OtpRateLimitError, InvalidOtpError } from "@/errors/otp.errors.js";
import { RefreshDeniedError } from "@/errors/session.errors.js";
import { NameValidationError } from "@/errors/profile.errors.js";

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext = vi.fn() as NextFunction;

describe("errorHandler middleware", () => {
  it("handles AppError with correct status and body", () => {
    const err = new AppError("Something went wrong", "CUSTOM_ERROR", 400, {
      details: { field: "value" },
    });
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "CUSTOM_ERROR",
        message: "Something went wrong",
        details: { field: "value" },
      },
    });
  });

  it("handles ValidationError (422)", () => {
    const err = new ValidationError("Name is required", { fieldErrors: { name: ["required"] } });
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Name is required",
        details: { fieldErrors: { name: ["required"] } },
      },
    });
  });

  it("handles AuthenticationError (401)", () => {
    const err = new AuthenticationError("Token expired", "TOKEN_EXPIRED");
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "TOKEN_EXPIRED",
        message: "Token expired",
      },
    });
  });

  it("handles RateLimitError with Retry-After header", () => {
    const err = new RateLimitError(120, "Too many attempts");
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "120");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many attempts",
        retryAfter: 120,
      },
    });
  });

  it("handles ExternalServiceError (502)", () => {
    const err = new ExternalServiceError("SMS Gateway");
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "EXTERNAL_SERVICE_ERROR",
        message: "External service failure: SMS Gateway",
        details: { service: "SMS Gateway" },
      },
    });
  });

  it("handles legacy OtpRateLimitError (domain error)", () => {
    const err = new OtpRateLimitError(45);
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", "45");
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "OTP rate limit exceeded. Too many OTP requests for this phone number.",
        details: { retryAfter: 45 },
        retryAfter: 45,
      },
    });
  });

  it("handles legacy InvalidOtpError (domain error)", () => {
    const err = new InvalidOtpError(3);
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "INVALID_OTP",
        message: "Invalid OTP code.",
        details: { remainingAttempts: 3 },
      },
    });
  });

  it("handles legacy RefreshDeniedError (session domain error)", () => {
    const err = new RefreshDeniedError("Token expired");
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "REFRESH_DENIED",
        message: "Refresh denied: Token expired",
        details: { reason: "Token expired" },
      },
    });
  });

  it("handles legacy NameValidationError (profile domain error)", () => {
    const err = new NameValidationError("too short");
    const res = createMockRes();

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "NAME_INVALID",
        message: "Invalid name: too short",
        details: { reason: "too short" },
      },
    });
  });

  it("handles unknown errors with 500 and no details leaked", () => {
    const err = new Error("DB connection failed");
    const res = createMockRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("handles non-Error objects thrown with 500", () => {
    const res = createMockRes();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    errorHandler("string error", mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again later.",
      },
    });
    consoleSpy.mockRestore();
  });
});
