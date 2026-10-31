import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validate } from "./validate.js";

function createMockReq(body: unknown): Request {
  return { body } as Request;
}

function createMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe("validate middleware", () => {
  const schema = z.object({
    phone: z.string().length(10, "Phone must be exactly 10 digits"),
    otp: z.string().optional(),
  });

  it("calls next() on valid input and replaces req.body with parsed data", () => {
    const req = createMockReq({ phone: "9876543210" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ phone: "9876543210" });
    expect(res.status).not.toHaveBeenCalled();
  });

  it("strips unknown fields from body (Zod default behavior with .object())", () => {
    const strictSchema = z.object({ name: z.string() }).strict();
    const req = createMockReq({ name: "Alice", extra: "field" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(strictSchema)(req, res, next);

    // strict() rejects unknown keys
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it("returns 422 with field errors on invalid input", () => {
    const req = createMockReq({ phone: "123" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          fieldErrors: {
            phone: ["Phone must be exactly 10 digits"],
          },
        },
      },
    });
  });

  it("returns multiple field errors when multiple fields fail", () => {
    const multiSchema = z.object({
      name: z.string().min(2, "Name too short"),
      email: z.string().email("Invalid email"),
    });
    const req = createMockReq({ name: "A", email: "not-an-email" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(multiSchema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    const response = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(response.error.details.fieldErrors.name).toContain("Name too short");
    expect(response.error.details.fieldErrors.email).toContain("Invalid email");
  });

  it("handles empty body gracefully", () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it("applies Zod transforms during parsing", () => {
    const transformSchema = z.object({
      phone: z.string().transform((val) => val.replace(/\s/g, "")),
    });
    const req = createMockReq({ phone: "987 654 3210" });
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validate(transformSchema)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ phone: "9876543210" });
  });
});
