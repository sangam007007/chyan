/**
 * Account Lifecycle Controller — Handles account deletion flow:
 * - POST /api/account/delete/request: Initiate deletion (send OTP for re-authentication)
 * - POST /api/account/delete/confirm: Verify OTP, schedule 7-day deletion, terminate sessions
 * - POST /api/account/delete/cancel: Cancel pending deletion
 *
 * All routes require JWT authentication and CSRF protection.
 *
 * Requirements: 15.1–15.8
 */

import { Router } from "express";
import { z } from "zod";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { csrfProtection } from "@/middleware/csrf.js";
import { queryOne } from "@/db/index.js";
import { OtpService } from "@/services/otp.service.js";
import { ProfileService } from "@/services/profile.service.js";
import { SessionService } from "@/services/session.service.js";
import { OtpError } from "@/errors/otp.errors.js";
import { ProfileError } from "@/errors/profile.errors.js";
import { MockSmsGateway } from "@/services/sms-gateway.interface.js";
import { env } from "@/config/env.js";

// ─── Zod Schemas ──────────────────────────────────────────────────────

const confirmDeletionSchema = z.object({
  otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

// ─── Service Instances ────────────────────────────────────────────────

const otpService = new OtpService(new MockSmsGateway());
const profileService = new ProfileService();
const sessionService = new SessionService();

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * POST /api/account/delete/request
 *
 * Initiates account deletion by sending an OTP to the user's registered phone
 * for re-authentication. The user must verify this OTP before deletion proceeds.
 *
 * Flow:
 * 1. Fetch the authenticated user's phone number from the database
 * 2. Generate and send an OTP to that phone number
 * 3. Return success with expiry info
 */
async function requestDeletion(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.user!;

    // 1. Fetch user's phone number for re-authentication OTP
    const user = await queryOne<{ phone: string | null }>(
      `SELECT phone FROM users WHERE id = $1`,
      [userId]
    );

    if (!user || !user.phone) {
      res.status(400).json({
        success: false,
        error: {
          code: "DELETION_AUTH_FAILED",
          message: "No phone number associated with this account. Cannot verify identity.",
        },
      });
      return;
    }

    // 2. Generate and send OTP
    const result = await otpService.generate(user.phone);

    // 3. Return success
    res.status(200).json({
      success: true,
      data: {
        message: "OTP sent for account deletion verification",
        expiresIn: result.expiresIn,
        resendAfter: result.resendAfter,
      },
    });
  } catch (error) {
    if (error instanceof OtpError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Failed to initiate account deletion",
      },
    });
  }
}

/**
 * POST /api/account/delete/confirm
 *
 * Confirms account deletion after OTP verification.
 *
 * Flow:
 * 1. Validate the OTP from request body
 * 2. Fetch user's phone number
 * 3. Verify OTP against stored value
 * 4. Schedule account deletion (7-day grace period) via ProfileService
 * 5. Terminate all sessions except current via SessionService
 * 6. Return confirmation with scheduled deletion date
 */
async function confirmDeletion(req: Request, res: Response): Promise<void> {
  try {
    const { userId, sessionId } = req.user!;

    // 1. Validate request body
    const parsed = confirmDeletionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data",
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const { otp } = parsed.data;

    // 2. Fetch user's phone number
    const user = await queryOne<{ phone: string | null }>(
      `SELECT phone FROM users WHERE id = $1`,
      [userId]
    );

    if (!user || !user.phone) {
      res.status(400).json({
        success: false,
        error: {
          code: "DELETION_AUTH_FAILED",
          message: "No phone number associated with this account. Cannot verify identity.",
        },
      });
      return;
    }

    // 3. Verify OTP
    await otpService.verify(user.phone, otp);

    // 4. Schedule account deletion (7-day grace period)
    const { deletionScheduledAt } = await profileService.deleteAccount(userId, sessionId);

    // 5. Terminate all sessions except current
    await sessionService.revokeAll(userId, sessionId);

    // 6. Return confirmation
    res.status(200).json({
      success: true,
      data: {
        message: "Account deletion scheduled",
        deletionScheduledAt: deletionScheduledAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof OtpError) {
      // Re-authentication failed (invalid OTP, expired, lockout)
      const statusCode = error.code === "INVALID_OTP" || error.code === "OTP_EXPIRED"
        ? 403
        : error.statusCode;

      res.status(statusCode).json({
        success: false,
        error: {
          code: "DELETION_AUTH_FAILED",
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    if (error instanceof ProfileError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Failed to confirm account deletion",
      },
    });
  }
}

/**
 * POST /api/account/delete/cancel
 *
 * Cancels a pending account deletion during the 7-day grace period.
 *
 * Flow:
 * 1. Call ProfileService.cancelDeletion to clear the scheduled deletion
 * 2. Return success
 */
async function cancelDeletion(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.user!;

    await profileService.cancelDeletion(userId);

    res.status(200).json({
      success: true,
      data: {
        message: "Account deletion cancelled",
      },
    });
  } catch (error) {
    if (error instanceof ProfileError) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Failed to cancel account deletion",
      },
    });
  }
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// All account lifecycle routes require authentication and CSRF protection
router.use(jwtAuth);
router.use(csrfProtection);

router.post("/delete/request", requestDeletion);
router.post("/delete/confirm", confirmDeletion);
router.post("/delete/cancel", cancelDeletion);

export { router as accountRouter };
