/**
 * Global Express error-handling middleware.
 *
 * Catches all errors (thrown or passed via next(err)) and returns a
 * consistent JSON response:
 *
 *   { success: false, error: { code, message, details?, retryAfter? } }
 *
 * Known error types (AppError and existing domain errors that carry a `code`
 * and `statusCode` property) are mapped to their defined HTTP status. Unknown
 * errors result in a generic 500 response with no internal details leaked.
 */

import type { Request, Response, NextFunction } from "express";
import { AppError } from "@/errors/app-error.js";

/**
 * Shape of the standard error response body.
 */
export interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryAfter?: number;
  };
}

/**
 * Check whether an error looks like one of our typed domain errors
 * (OtpError, SessionError, ProfileError) that predate AppError but follow
 * the same { code, statusCode, details? } shape.
 */
function isKnownDomainError(
  err: unknown,
): err is Error & { code: string; statusCode: number; details?: Record<string, unknown>; retryAfter?: number } {
  if (!(err instanceof Error)) return false;
  const record = err as unknown as Record<string, unknown>;
  return (
    typeof record.code === "string" &&
    typeof record.statusCode === "number"
  );
}

/**
 * Global error handler — must be registered AFTER all routes.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // --- AppError or domain error with code/statusCode ---
  if (err instanceof AppError || isKnownDomainError(err)) {
    const typed = err as AppError & { retryAfter?: number };
    const { code, statusCode, message, details } = typed;
    const retryAfter = typed.retryAfter;

    if (retryAfter !== undefined) {
      res.setHeader("Retry-After", String(Math.ceil(retryAfter)));
    }

    const body: ErrorResponseBody = {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(retryAfter !== undefined ? { retryAfter } : {}),
      },
    };

    res.status(statusCode).json(body);
    return;
  }

  // --- Unknown / unexpected errors ---
  console.error("[unhandled error]", err);

  const body: ErrorResponseBody = {
    success: false,
    error: {
      code: "SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later.",
    },
  };

  res.status(500).json(body);
}
