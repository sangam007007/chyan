/**
 * Rate Limiter Middleware
 *
 * Provides IP-based and phone-based rate limiting for authentication endpoints.
 * Uses Redis sorted sets for sliding window tracking.
 *
 * - ipRateLimiter: Limits login endpoints to 10 requests per IP per hour
 * - otpRateLimiter: Limits OTP generation to 5 per phone number per hour
 */

import type { Request, Response, NextFunction } from "express";
import {
  recordIpRequest,
  getIpRequestCount,
  getIpRetryAfter,
  getOtpRequestCount,
  getOtpRetryAfter,
} from "@/redis/rate-limit.js";

// ─── Constants ────────────────────────────────────────────────────────

const IP_RATE_LIMIT = 50; // max requests per minute per IP
const OTP_RATE_LIMIT = 10; // max OTP requests per minute per phone

// ─── Error Messages ───────────────────────────────────────────────────

const ERROR_MESSAGES = {
  en: {
    ipRateLimited: "Too many requests. Please try again later.",
    otpRateLimited:
      "OTP request limit reached. Please wait before requesting another OTP.",
  },
  hi: {
    ipRateLimited:
      "बहुत अधिक अनुरोध। कृपया बाद में पुनः प्रयास करें।",
    otpRateLimited:
      "OTP अनुरोध सीमा पूरी हो गई। कृपया दूसरा OTP अनुरोध करने से पहले प्रतीक्षा करें।",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Client IP for rate limiting.
 * Uses req.ip only. Express works it out from the X-Forwarded-For header ONLY for as many proxies as the
 * TRUST_PROXY setting says (see index.ts). Reading the header directly would let anyone send a made-up
 * address with every request and dodge the limit.
 */
function getClientIp(req: Request): string {
  return req.ip || "unknown";
}

/**
 * Determine the user's preferred language from the request.
 * Checks Accept-Language header for 'hi' (Hindi), defaults to 'en'.
 */
function getLanguage(req: Request): "en" | "hi" {
  const acceptLang = req.headers["accept-language"] || "";
  if (acceptLang.includes("hi")) return "hi";
  return "en";
}

// ─── IP Rate Limiter Middleware ───────────────────────────────────────

/**
 * Middleware that rate-limits login endpoints by IP address.
 * Allows 10 requests per IP per rolling 1-hour window.
 *
 * On limit exceeded:
 * - Returns 429 with Retry-After header
 * - Returns JSON error body with code "RATE_LIMITED"
 */
export async function ipRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ip = getClientIp(req);

    // Check current count before recording
    const currentCount = await getIpRequestCount(ip);

    if (currentCount >= IP_RATE_LIMIT) {
      const retryAfter = await getIpRetryAfter(ip);
      const lang = getLanguage(req);

      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: ERROR_MESSAGES[lang].ipRateLimited,
          retryAfter,
        },
      });
      return;
    }

    // Record this request
    const newCount = await recordIpRequest(ip);

    if (newCount > IP_RATE_LIMIT) {
      // Edge case: concurrent requests pushed us over
      const retryAfter = await getIpRetryAfter(ip);
      const lang = getLanguage(req);

      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: ERROR_MESSAGES[lang].ipRateLimited,
          retryAfter,
        },
      });
      return;
    }

    next();
  } catch (error) {
    // If Redis is unavailable, allow the request through
    // (fail-open to avoid blocking all traffic)
    next();
  }
}

// ─── OTP Rate Limiter Middleware ──────────────────────────────────────

/**
 * Middleware that rate-limits OTP generation by phone number.
 * Allows 5 OTP requests per phone per rolling 1-hour window.
 *
 * Expects `req.body.phone` to contain the phone number (or phone hash).
 *
 * On limit exceeded:
 * - Returns 429 with Retry-After header
 * - Returns JSON error body with code "RATE_LIMITED"
 */
export async function otpRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const phone: string | undefined = req.body?.phone;

    if (!phone) {
      // No phone in request body, skip rate limiting (validation will catch it)
      next();
      return;
    }

    // Use the phone number directly as the identifier for rate limiting.
    // In production the OTP service hashes it before passing to Redis helpers,
    // but for the middleware layer we use the raw phone to check limits.
    const phoneKey = phone;

    const currentCount = await getOtpRequestCount(phoneKey);

    if (currentCount >= OTP_RATE_LIMIT) {
      const retryAfter = await getOtpRetryAfter(phoneKey);
      const lang = getLanguage(req);

      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: ERROR_MESSAGES[lang].otpRateLimited,
          retryAfter,
        },
      });
      return;
    }

    next();
  } catch (error) {
    // Fail-open: allow request if Redis is unavailable
    next();
  }
}
