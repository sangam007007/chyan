import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { storeCsrfToken, validateCsrfToken } from "@/redis/csrf.js";

// ─── Constants ────────────────────────────────────────────────────────

const CSRF_HEADER = "x-csrf-token";
const STATE_CHANGING_METHODS = new Set(["POST", "PATCH", "DELETE", "PUT"]);

// ─── CSRF Protection Middleware ───────────────────────────────────────

/**
 * Middleware that validates the X-CSRF-Token header on all state-changing
 * requests (POST, PATCH, DELETE, PUT).
 *
 * Expects the CSRF token in the `X-CSRF-Token` request header.
 * On invalid or missing token, responds with HTTP 403 and code "CSRF_INVALID".
 */
export async function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Skip validation for non-state-changing (safe) methods
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    next();
    return;
  }

  const token = req.headers[CSRF_HEADER] as string | undefined;

  if (!token) {
    res.status(403).json({
      success: false,
      error: {
        code: "CSRF_INVALID",
        message: "Missing or invalid security token",
      },
    });
    return;
  }

  const userId = await validateCsrfToken(token);

  if (!userId) {
    res.status(403).json({
      success: false,
      error: {
        code: "CSRF_INVALID",
        message: "Missing or invalid security token",
      },
    });
    return;
  }

  next();
}

// ─── CSRF Token Generation Route Handler ──────────────────────────────

/**
 * Route handler for GET /api/auth/csrf-token.
 * Generates a fresh CSRF token, stores it in Redis with 24h TTL,
 * and returns it to the client.
 *
 * Requires an authenticated user (userId should be available on req).
 * If no userId is available (unauthenticated), uses a placeholder "anonymous".
 */
export async function generateCsrfToken(
  req: Request,
  res: Response
): Promise<void> {
  // Use userId from auth context if available, otherwise "anonymous"
  const userId: string =
    (req as any).userId ?? (req as any).user?.id ?? "anonymous";

  const token = crypto.randomBytes(32).toString("hex");

  await storeCsrfToken(token, userId);

  res.status(200).json({
    success: true,
    data: { csrfToken: token },
  });
}
