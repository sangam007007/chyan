/**
 * Auth Controller — Handles OTP send/verify/resend, Google OAuth,
 * token refresh, logout, account linking, and CSRF token generation.
 *
 * Routes:
 * - POST /api/auth/otp/send       → Send OTP to phone number
 * - POST /api/auth/otp/verify     → Verify OTP and authenticate
 * - POST /api/auth/otp/resend     → Resend OTP with cooldown
 * - GET  /api/auth/google         → Get Google OAuth consent URL
 * - POST /api/auth/google/callback → Handle Google OAuth callback
 * - POST /api/auth/token/refresh  → Refresh access token
 * - POST /api/auth/logout         → Logout current session
 * - POST /api/auth/logout-all     → Logout all sessions except current
 * - POST /api/auth/link/confirm   → Confirm account linking
 * - POST /api/auth/link/decline   → Decline account linking (create separate)
 * - GET  /api/auth/csrf-token     → Generate and return CSRF token
 *
 * Requirements: 1.1–1.7, 2.1–2.7, 3.1–3.6, 4.1–4.6, 5.1–5.6, 6.1–6.6, 7.1–7.6
 */

import { Router } from "express";
import { z } from "zod";
import type { Request, Response } from "express";

import { ipRateLimiter } from "@/middleware/rate-limiter.js";
import { csrfProtection } from "@/middleware/csrf.js";
import { generateCsrfToken } from "@/middleware/csrf.js";
import { jwtAuth } from "@/middleware/jwt-auth.js";
import { OtpService } from "@/services/otp.service.js";
import { OAuthService } from "@/services/oauth.service.js";
import { SessionService } from "@/services/session.service.js";
import { AccountLinkService } from "@/services/account-link.service.js";
import { queryOne } from "@/db/index.js";
import { env } from "@/config/env.js";
import { HttpSmsGateway, MockSmsGateway } from "@/services/sms-gateway.interface.js";
import {
  OtpRateLimitError,
  ResendCooldownError,
  InvalidOtpError,
  OtpExpiredError,
  OtpLockoutError,
  SmsDeliveryError,
} from "@/errors/otp.errors.js";
import { OAuthError } from "@/services/oauth.service.js";
import { RefreshDeniedError, TokenReuseError } from "@/errors/session.errors.js";

// ─── Zod Validation Schemas ──────────────────────────────────────────

/**
 * Phone number validation: exactly 10 digits starting with 6-9 (Indian mobile).
 */
const phoneSchema = z.object({
  phone: z
    .string()
    .transform((val) => val.replace(/[\s\-]/g, "").replace(/^\+91/, ""))
    .pipe(
      z
        .string()
        .length(10, "Phone number must be exactly 10 digits")
        .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number format")
    ),
});

/**
 * OTP verification schema: phone + exactly 6-digit OTP + optional CAPTCHA token.
 */
const verifyOtpSchema = z.object({
  phone: z
    .string()
    .transform((val) => val.replace(/[\s\-]/g, "").replace(/^\+91/, ""))
    .pipe(
      z
        .string()
        .length(10, "Phone number must be exactly 10 digits")
        .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number format")
    ),
  otp: z
    .string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits"),
  captchaToken: z.string().nullable().optional(),
});

/**
 * Resend OTP schema: phone only.
 */
const resendOtpSchema = z.object({
  phone: z
    .string()
    .transform((val) => val.replace(/[\s\-]/g, "").replace(/^\+91/, ""))
    .pipe(
      z
        .string()
        .length(10, "Phone number must be exactly 10 digits")
        .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number format")
    ),
});

/**
 * Google OAuth callback schema: authorization code.
 */
const googleCallbackSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

/**
 * Account link confirm schema: primary and secondary user IDs.
 */
const linkConfirmSchema = z.object({
  primaryUserId: z.string().uuid("Invalid primary user ID"),
  secondaryUserId: z.string().uuid("Invalid secondary user ID"),
});

/**
 * Account link decline schema: Google profile data to create separate account.
 */
const linkDeclineSchema = z.object({
  googleId: z.string().min(1, "Google ID is required"),
  email: z.string().email("Invalid email"),
  name: z.string().optional(),
  picture: z.string().optional(),
});

// ─── Service Instances ────────────────────────────────────────────────

// Real SMS in production; the OTP is only printed to the server log in development, or in production when
// SMS_MODE=console (a closed test: the operator reads the OTP in the host's logs and tells the tester).
const smsGateway = env.NODE_ENV === "production" && process.env.SMS_MODE !== "console"
  ? new HttpSmsGateway(env.SMS_API_URL, env.SMS_API_KEY)
  : new MockSmsGateway();
const otpService = new OtpService(smsGateway);
const oauthService = new OAuthService();
const sessionService = new SessionService();
const accountLinkService = new AccountLinkService();

// ─── Cookie Configuration ─────────────────────────────────────────────

const REFRESH_COOKIE_NAME = "refresh_token";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
};

// ─── User Record Type ─────────────────────────────────────────────────

interface UserRecord {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  google_id: string | null;
  preferred_language: string;
  selected_exam_id: string | null;
  onboarding_completed: boolean;
  role: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract device info from the request for session creation.
 */
function extractDeviceInfo(req: Request) {
  const userAgent = req.headers["user-agent"] || "";
  let deviceType = "desktop";
  if (/mobile/i.test(userAgent)) deviceType = "mobile";
  else if (/tablet|ipad/i.test(userAgent)) deviceType = "tablet";

  return {
    device_type: deviceType,
    device_info: { userAgent },
    ip_address: req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown",
    city: undefined,
  };
}

/**
 * Determine the next step for user routing after authentication.
 */
function getNextStep(user: UserRecord): string {
  if (user.onboarding_completed) return "dashboard";
  if (!user.selected_exam_id) return "exam_selection";
  return "profile_setup";
}

/**
 * Format user object for response.
 */
function formatUserResponse(user: Pick<UserRecord, "id" | "phone" | "email" | "full_name" | "onboarding_completed" | "role">) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    fullName: user.full_name,
    onboardingCompleted: user.onboarding_completed,
    role: user.role ?? 'student',
  };
}

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * POST /api/auth/otp/send
 * Validate phone, check rate limits, generate and send OTP.
 */
async function sendOtp(req: Request, res: Response): Promise<void> {
  const parsed = phoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PHONE",
        message: "Invalid phone number",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { phone } = parsed.data;

  try {
    const result = await otpService.generate(phone);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      data: {
        expiresIn: result.expiresIn,
        resendAfter: result.resendAfter,
      },
    });
  } catch (error) {
    if (error instanceof OtpRateLimitError) {
      res.setHeader("Retry-After", String(error.retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests",
          retryAfter: error.retryAfter,
        },
      });
      return;
    }

    if (error instanceof ResendCooldownError) {
      res.status(429).json({
        success: false,
        error: {
          code: "RESEND_COOLDOWN",
          message: "Please wait before requesting another OTP",
          retryAfter: error.retryAfter,
        },
      });
      return;
    }

    if (error instanceof SmsDeliveryError) {
      res.status(502).json({
        success: false,
        error: {
          code: "SMS_DELIVERY_FAILED",
          message: "SMS delivery failed. Please try again.",
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "An unexpected error occurred" },
    });
  }
}

/**
 * POST /api/auth/otp/verify
 * Validate OTP, check lockout, verify, find/create user, create session.
 */
async function verifyOtp(req: Request, res: Response): Promise<void> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { phone, otp } = parsed.data;

  try {
    // Verify the OTP
    await otpService.verify(phone, otp);

    // Find or create user by phone
    let user = await queryOne<UserRecord>(
      `SELECT id, phone, email, full_name, avatar_url, google_id, preferred_language, selected_exam_id, onboarding_completed, role
       FROM users WHERE phone = $1`,
      [phone]
    );

    if (!user) {
      // Create new user
      user = await queryOne<UserRecord>(
        `INSERT INTO users (phone, preferred_language, onboarding_completed)
         VALUES ($1, 'hi', false)
         RETURNING id, phone, email, full_name, avatar_url, google_id, preferred_language, selected_exam_id, onboarding_completed, role`,
        [phone]
      );
    }

    if (!user) {
      res.status(500).json({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to create user account" },
      });
      return;
    }

    // Check for account linking scenarios (phone login finding existing Google account)
    const existingMatch = await accountLinkService.checkExisting(null, phone);
    if (existingMatch && existingMatch.user.id !== user.id && existingMatch.user.google_id) {
      // There's a different account linked by the same phone via Google
      // Create session for current user but signal linking required
      const deviceInfo = extractDeviceInfo(req);
      const { tokens } = await sessionService.create(user.id, deviceInfo);

      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          user: formatUserResponse(user),
          nextStep: "account_link",
          linkingInfo: {
            existingPhone: phone.replace(/^(\d{2})(\d{4})(\d{4})$/, "$1****$3"),
            provider: "google",
          },
        },
      });
      return;
    }

    // Create session
    const deviceInfo = extractDeviceInfo(req);
    const { tokens } = await sessionService.create(user.id, deviceInfo);

    // Set refresh token as HTTP-only cookie
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    const nextStep = getNextStep(user);

    res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user: formatUserResponse(user),
        nextStep,
      },
    });
  } catch (error) {
    if (error instanceof OtpLockoutError) {
      res.status(429).json({
        success: false,
        error: {
          code: "OTP_MAX_ATTEMPTS",
          message: "Too many failed attempts. Please try again later.",
          details: { remainingSeconds: error.remainingSeconds },
        },
      });
      return;
    }

    if (error instanceof InvalidOtpError) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_OTP",
          message: "Invalid OTP code",
          details: { remainingAttempts: error.remainingAttempts },
        },
      });
      return;
    }

    if (error instanceof OtpExpiredError) {
      res.status(400).json({
        success: false,
        error: {
          code: "OTP_EXPIRED",
          message: "OTP has expired. Please request a new one.",
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "An unexpected error occurred" },
    });
  }
}

/**
 * POST /api/auth/otp/resend
 * Check cooldown, invalidate old OTP, generate new one.
 */
async function resendOtp(req: Request, res: Response): Promise<void> {
  const parsed = resendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PHONE",
        message: "Invalid phone number",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { phone } = parsed.data;

  try {
    // Invalidate old OTP and generate new one
    await otpService.invalidate(phone);
    const result = await otpService.generate(phone);

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      data: {
        expiresIn: result.expiresIn,
        resendAfter: result.resendAfter,
      },
    });
  } catch (error) {
    if (error instanceof ResendCooldownError) {
      res.status(429).json({
        success: false,
        error: {
          code: "RESEND_COOLDOWN",
          message: "Please wait before requesting another OTP",
          retryAfter: error.retryAfter,
        },
      });
      return;
    }

    if (error instanceof OtpRateLimitError) {
      res.setHeader("Retry-After", String(error.retryAfter));
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "OTP request limit reached",
          retryAfter: error.retryAfter,
        },
      });
      return;
    }

    if (error instanceof SmsDeliveryError) {
      res.status(502).json({
        success: false,
        error: {
          code: "SMS_DELIVERY_FAILED",
          message: "SMS delivery failed. Please try again.",
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "An unexpected error occurred" },
    });
  }
}

/**
 * GET /api/auth/google
 * Return Google OAuth consent URL.
 */
async function getGoogleAuthUrl(_req: Request, res: Response): Promise<void> {
  try {
    const url = oauthService.getAuthUrl();

    res.status(200).json({
      success: true,
      data: { url },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to generate OAuth URL" },
    });
  }
}

/**
 * POST /api/auth/google/callback
 * Exchange code, find/create/link user, create session.
 */
async function googleCallback(req: Request, res: Response): Promise<void> {
  const parsed = googleCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Authorization code is required",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { code } = parsed.data;

  try {
    // Exchange code for Google profile
    const profile = await oauthService.exchangeCode(code);

    // Check for existing user by Google ID
    let user = await queryOne<UserRecord>(
      `SELECT id, phone, email, full_name, avatar_url, google_id, preferred_language, selected_exam_id, onboarding_completed
       FROM users WHERE google_id = $1`,
      [profile.googleId]
    );

    if (user) {
      // Existing Google user — create session and return
      const deviceInfo = extractDeviceInfo(req);
      const { tokens } = await sessionService.create(user.id, deviceInfo);

      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          user: formatUserResponse(user),
          nextStep: getNextStep(user),
        },
      });
      return;
    }

    // Check if email matches an existing account (account linking scenario)
    const existingMatch = await accountLinkService.checkExisting(profile.email, null);

    if (existingMatch) {
      // Existing account found by email — prompt for linking
      // Create a temporary account for the Google user
      const tempUser = await queryOne<UserRecord>(
        `INSERT INTO users (email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed)
         VALUES ($1, $2, $3, $4, $5, 'hi', false)
         RETURNING id, phone, email, full_name, avatar_url, google_id, preferred_language, selected_exam_id, onboarding_completed`,
        [profile.email, profile.name || null, profile.picture || null, profile.googleId, profile.picture || null]
      );

      if (!tempUser) {
        res.status(500).json({
          success: false,
          error: { code: "SERVER_ERROR", message: "Failed to create account" },
        });
        return;
      }

      // Create session for the temporary user
      const deviceInfo = extractDeviceInfo(req);
      const { tokens } = await sessionService.create(tempUser.id, deviceInfo);

      const maskedPhone = existingMatch.user.phone
        ? existingMatch.user.phone.replace(/^(\d{2})(\d{4})(\d{4})$/, "$1****$3")
        : null;

      res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
      res.status(200).json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          user: formatUserResponse(tempUser),
          nextStep: "account_link",
          linkingInfo: {
            existingPhone: maskedPhone,
            existingUserId: existingMatch.user.id,
            newUserId: tempUser.id,
            provider: "phone",
          },
        },
      });
      return;
    }

    // No existing account — create new Google user
    const newUser = await queryOne<UserRecord>(
      `INSERT INTO users (email, full_name, avatar_url, google_id, google_avatar_url, preferred_language, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, 'hi', false)
       RETURNING id, phone, email, full_name, avatar_url, google_id, preferred_language, selected_exam_id, onboarding_completed`,
      [profile.email, profile.name || null, profile.picture || null, profile.googleId, profile.picture || null]
    );

    if (!newUser) {
      res.status(500).json({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to create user account" },
      });
      return;
    }

    const deviceInfo = extractDeviceInfo(req);
    const { tokens } = await sessionService.create(newUser.id, deviceInfo);

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        user: formatUserResponse(newUser),
        nextStep: getNextStep(newUser),
      },
    });
  } catch (error) {
    if (error instanceof OAuthError) {
      const statusCode = error.code === "OAUTH_CANCELLED" ? 400 : 502;
      res.status(statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "An unexpected error occurred" },
    });
  }
}

/**
 * POST /api/auth/token/refresh
 * Validate refresh cookie, rotate tokens.
 */
async function refreshToken(req: Request, res: Response): Promise<void> {
  const refreshTokenValue = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!refreshTokenValue) {
    res.status(401).json({
      success: false,
      error: {
        code: "REFRESH_DENIED",
        message: "No refresh token provided",
      },
    });
    return;
  }

  try {
    const result = await sessionService.refresh(refreshTokenValue);

    // Set new refresh token cookie
    res.cookie(REFRESH_COOKIE_NAME, result.tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.tokens.accessToken,
      },
    });
  } catch (error) {
    // Clear the invalid refresh token cookie
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });

    if (error instanceof TokenReuseError) {
      res.status(401).json({
        success: false,
        error: {
          code: "REFRESH_DENIED",
          message: "Token reuse detected. All sessions revoked.",
          details: { reason: "token_reuse_detected" },
        },
      });
      return;
    }

    if (error instanceof RefreshDeniedError) {
      res.status(401).json({
        success: false,
        error: {
          code: "REFRESH_DENIED",
          message: "Invalid or expired refresh token",
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "An unexpected error occurred" },
    });
  }
}

/**
 * POST /api/auth/logout
 * Revoke current session.
 */
async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.user!;

    await sessionService.revoke(sessionId);

    // Clear refresh token cookie
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });

    res.status(200).json({
      success: true,
      data: { message: "Logged out successfully" },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to logout" },
    });
  }
}

/**
 * POST /api/auth/logout-all
 * Revoke all sessions except current.
 */
async function logoutAll(req: Request, res: Response): Promise<void> {
  try {
    const { userId, sessionId } = req.user!;

    await sessionService.revokeAll(userId, sessionId);

    res.status(200).json({
      success: true,
      data: { message: "All other sessions have been terminated" },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to logout from all devices" },
    });
  }
}

/**
 * POST /api/auth/link/confirm
 * Merge accounts (link Google and phone accounts).
 */
async function linkConfirm(req: Request, res: Response): Promise<void> {
  const parsed = linkConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { primaryUserId, secondaryUserId } = parsed.data;

  try {
    await accountLinkService.linkAccounts(primaryUserId, secondaryUserId);

    // Return the primary user's data
    const user = await queryOne<UserRecord>(
      `SELECT id, phone, email, full_name, avatar_url, google_id, preferred_language, selected_exam_id, onboarding_completed, role
       FROM users WHERE id = $1`,
      [primaryUserId]
    );

    if (!user) {
      res.status(500).json({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to retrieve linked account" },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: formatUserResponse(user),
        nextStep: getNextStep(user),
        message: "Accounts linked successfully",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to link accounts" },
    });
  }
}

/**
 * POST /api/auth/link/decline
 * Create a separate account (decline linking).
 */
async function linkDecline(req: Request, res: Response): Promise<void> {
  const parsed = linkDeclineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { googleId, email, name, picture } = parsed.data;

  try {
    const user = await accountLinkService.createSeparate({
      googleId,
      email,
      name,
      picture,
    });

    res.status(200).json({
      success: true,
      data: {
        user: formatUserResponse(user),
        nextStep: "exam_selection",
        message: "Separate account created",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to create separate account" },
    });
  }
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// OTP endpoints — public, rate limited
router.post("/otp/send", ipRateLimiter, sendOtp);
router.post("/otp/verify", ipRateLimiter, verifyOtp);
router.post("/otp/resend", ipRateLimiter, resendOtp);

// Google OAuth endpoints — public
router.get("/google", getGoogleAuthUrl);
router.post("/google/callback", googleCallback);

// Token refresh — public (uses cookie, no JWT required)
router.post("/token/refresh", refreshToken);

// Logout endpoints — require authentication
router.post("/logout", jwtAuth, logout);
router.post("/logout-all", jwtAuth, logoutAll);

// Account linking — require authentication
router.post("/link/confirm", jwtAuth, csrfProtection, linkConfirm);
router.post("/link/decline", jwtAuth, csrfProtection, linkDecline);

// CSRF token — can be called authenticated or unauthenticated
router.get("/csrf-token", generateCsrfToken);

export { router as authRouter };
