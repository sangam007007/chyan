/**
 * CAPTCHA Verifier Middleware
 *
 * Tracks failed OTP verification attempts per identifier in Redis.
 * After 3 failures, requires a valid CAPTCHA token on subsequent OTP verify requests.
 *
 * Requirements: 17.3
 * Design: Middleware Stack — captchaVerifier
 */

import type { Request, Response, NextFunction } from "express";
import type Redis from "ioredis";

// ─── Constants ────────────────────────────────────────────────────────

/** Number of failures before CAPTCHA is required */
export const CAPTCHA_FAILURE_THRESHOLD = 3;

/** TTL for the failure counter in seconds (15 minutes) */
export const CAPTCHA_FAILURE_TTL = 900;

/** Redis key prefix for CAPTCHA failure tracking */
export const CAPTCHA_FAILURES_KEY_PREFIX = "captcha_failures:";

// ─── CAPTCHA Validator Interface ──────────────────────────────────────

/**
 * Abstract CAPTCHA validator interface for testability.
 * Implementations can validate against reCAPTCHA, hCaptcha, Turnstile, etc.
 */
export interface CaptchaValidator {
  /**
   * Validate a CAPTCHA token against the external service.
   * @param token - The CAPTCHA response token from the client
   * @returns true if the token is valid, false otherwise
   */
  validate(token: string): Promise<boolean>;
}

// ─── Redis Helpers ────────────────────────────────────────────────────

/**
 * Get the current failure count for an identifier.
 */
export async function getFailureCount(
  redis: Redis,
  identifier: string
): Promise<number> {
  const key = `${CAPTCHA_FAILURES_KEY_PREFIX}${identifier}`;
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
}

/**
 * Increment the failure count for an identifier.
 * Sets TTL on first increment and refreshes it on subsequent increments.
 */
export async function incrementFailureCount(
  redis: Redis,
  identifier: string
): Promise<number> {
  const key = `${CAPTCHA_FAILURES_KEY_PREFIX}${identifier}`;
  const newCount = await redis.incr(key);
  // Set/refresh TTL on every increment
  await redis.expire(key, CAPTCHA_FAILURE_TTL);
  return newCount;
}

/**
 * Reset the failure count for an identifier (e.g., on successful verification).
 */
export async function resetFailureCount(
  redis: Redis,
  identifier: string
): Promise<void> {
  const key = `${CAPTCHA_FAILURES_KEY_PREFIX}${identifier}`;
  await redis.del(key);
}

// ─── Middleware Factory ───────────────────────────────────────────────

export interface CaptchaMiddlewareOptions {
  /** Redis client instance */
  redis: Redis;
  /** CAPTCHA validator implementation */
  captchaValidator: CaptchaValidator;
  /**
   * Function to extract the identifier from the request.
   * Typically the phone number hash or IP address.
   */
  getIdentifier: (req: Request) => string;
}

/**
 * Creates the CAPTCHA verifier middleware.
 *
 * Behavior:
 * - Checks if the identifier has >= CAPTCHA_FAILURE_THRESHOLD failed attempts
 * - If under threshold: passes through (next())
 * - If at/over threshold and no captchaToken in body: returns 403 CAPTCHA_REQUIRED
 * - If at/over threshold and captchaToken invalid: returns 403 CAPTCHA_INVALID
 * - If at/over threshold and captchaToken valid: passes through (next())
 */
export function captchaVerifier(options: CaptchaMiddlewareOptions) {
  const { redis, captchaValidator, getIdentifier } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const identifier = getIdentifier(req);
      const failureCount = await getFailureCount(redis, identifier);

      // Under threshold — pass through
      if (failureCount < CAPTCHA_FAILURE_THRESHOLD) {
        next();
        return;
      }

      // At or over threshold — CAPTCHA required
      const captchaToken = req.body?.captchaToken;

      if (!captchaToken) {
        res.status(403).json({
          success: false,
          error: {
            code: "CAPTCHA_REQUIRED",
            message:
              "CAPTCHA verification is required after multiple failed attempts.",
          },
        });
        return;
      }

      // Validate the CAPTCHA token
      const isValid = await captchaValidator.validate(captchaToken);

      if (!isValid) {
        res.status(403).json({
          success: false,
          error: {
            code: "CAPTCHA_INVALID",
            message: "CAPTCHA verification failed. Please try again.",
          },
        });
        return;
      }

      // CAPTCHA valid — pass through
      next();
    } catch (error) {
      // On Redis/validator errors, fail open (allow request through)
      // to avoid blocking users due to infrastructure issues
      next();
    }
  };
}
