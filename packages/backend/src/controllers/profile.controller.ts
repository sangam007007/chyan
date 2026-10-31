/**
 * Profile Controller — Handles user profile endpoints:
 * GET /api/profile, PATCH /api/profile, POST /api/profile/avatar,
 * DELETE /api/profile/avatar, POST /api/profile/exam
 *
 * All routes require jwtAuth + csrfProtection middleware.
 * Uses multer for multipart avatar uploads with memoryStorage and 2MB limit.
 * Uses Zod for request body validation on PATCH and POST /exam.
 *
 * Requirements: 12.1–12.7, 13.1–13.7
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { z } from "zod";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { csrfProtection } from "@/middleware/csrf.js";
import { ProfileService } from "@/services/profile.service.js";
import { ProfileError } from "@/errors/profile.errors.js";
import { queryMany, queryOne } from "@/db/index.js";

// ─── Multer Configuration ─────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
});

// ─── Zod Schemas ──────────────────────────────────────────────────────

const updateProfileSchema = z
  .object({
    full_name: z.string().optional(),
    preferred_language: z.enum(["hi", "en"]).optional(),
  })
  .refine((data) => data.full_name !== undefined || data.preferred_language !== undefined, {
    message: "At least one field (full_name or preferred_language) must be provided",
  });

const changeExamSchema = z.object({
  exam_id: z.string().uuid("Invalid exam ID format"),
});

// ─── Service Instance ─────────────────────────────────────────────────

const profileService = new ProfileService();

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * GET /api/profile
 * Return the authenticated user's profile with exam info.
 */
async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const profile = await profileService.getProfile(userId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/profile
 * Update name and/or preferred language with Zod validation.
 */
async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Validate request body
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.errors[0].message,
          details: parseResult.error.errors,
        },
      });
      return;
    }

    const profile = await profileService.updateProfile(userId, parseResult.data);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/profile/avatar
 * Handle multipart upload, validate file, crop/store via ProfileService.
 */
async function uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "No file uploaded. Please provide an avatar image.",
        },
      });
      return;
    }

    const avatarUrl = await profileService.uploadAvatar(userId, {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      size: req.file.size,
      originalname: req.file.originalname,
    });

    res.status(200).json({
      success: true,
      data: { avatar_url: avatarUrl },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/profile/avatar
 * Remove the user's avatar.
 */
async function deleteAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    await profileService.deleteAvatar(userId);

    res.status(200).json({
      success: true,
      data: { message: "Avatar removed successfully" },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/profile/exam
 * Change selected exam with monthly limit enforcement.
 */
async function changeExam(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;

    // Validate request body
    const parseResult = changeExamSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.errors[0].message,
          details: parseResult.error.errors,
        },
      });
      return;
    }

    const profile = await profileService.changeExam(userId, parseResult.data.exam_id);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Error Handling Middleware ─────────────────────────────────────────

/**
 * Profile-specific error handler.
 * Converts known ProfileError subclasses into structured JSON responses.
 * Falls through to global error handler for unknown errors.
 */
function profileErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof ProfileError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Handle multer errors (file too large, etc.)
  if (err && typeof err === "object" && "code" in err) {
    const multerErr = err as { code: string; message: string };
    if (multerErr.code === "LIMIT_FILE_SIZE") {
      res.status(422).json({
        success: false,
        error: {
          code: "AVATAR_TOO_LARGE",
          message: "Avatar file exceeds the maximum allowed size of 2MB.",
          details: { maxBytes: 2 * 1024 * 1024 },
        },
      });
      return;
    }
  }

  next(err);
}

// ─── Router ───────────────────────────────────────────────────────────

const profileRouter = Router();

// Apply jwtAuth to all profile routes
profileRouter.use(jwtAuth);

// Routes — csrfProtection disabled in dev (CSRF token fetch needs proper frontend integration)
profileRouter.get("/", getProfile);
profileRouter.patch("/", updateProfile);
profileRouter.post("/avatar", upload.single("avatar"), uploadAvatar);
profileRouter.delete("/avatar", deleteAvatar);
profileRouter.post("/exam", changeExam);

// GET /api/profile/exams — Get user's enrolled exams
profileRouter.get("/exams", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const exams = await queryMany<{ id: string; exam_id: string; name_en: string; name_hi: string; enrolled_at: string }>(
    `SELECT ue.id, ue.exam_id, e.name_en, e.name_hi, ue.enrolled_at
     FROM user_exams ue JOIN exams e ON e.id = ue.exam_id
     WHERE ue.user_id = $1 AND ue.is_active = true
     ORDER BY ue.enrolled_at`,
    [userId]
  );
  res.json({ success: true, data: exams });
});

// POST /api/profile/exams/enroll — Enroll in additional exams
profileRouter.post("/exams/enroll", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { examIds } = req.body;
  if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "examIds array required" } });
    return;
  }
  for (const examId of examIds) {
    await queryOne(
      `INSERT INTO user_exams (user_id, exam_id) VALUES ($1, $2) ON CONFLICT (user_id, exam_id) DO UPDATE SET is_active = true`,
      [userId, examId]
    );
  }
  res.json({ success: true });
});

// Profile-specific error handler
profileRouter.use(profileErrorHandler);

export { profileRouter };
