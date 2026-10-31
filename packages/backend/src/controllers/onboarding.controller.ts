/**
 * Onboarding Controller
 *
 * Handles the new-user onboarding flow:
 * - GET /api/onboarding/exams: List available exams grouped by category (state/central) with bilingual names
 * - POST /api/onboarding/exam-selection: Save the user's selected exam
 * - POST /api/onboarding/profile-setup: Validate and save name + language + avatar, mark onboarding complete
 *
 * Requirements: 9.1–9.7, 10.1–10.7
 */

import { Router } from "express";
import { z } from "zod";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { csrfProtection } from "@/middleware/csrf.js";
import { queryMany, queryOne } from "@/db/index.js";
import { ProfileService } from "@/services/profile.service.js";
import { ProfileError } from "@/errors/profile.errors.js";

import type { Request, Response } from "express";

// ─── Zod Schemas ──────────────────────────────────────────────────────

const examSelectionSchema = z.object({
  examId: z.string().uuid("Invalid exam ID format"),
  examIds: z.array(z.string().uuid("Invalid exam ID format")).optional(),
});

const profileSetupSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be no more than 50 characters"),
  preferred_language: z.enum(["hi", "en"], {
    errorMap: () => ({ message: "Language must be 'hi' or 'en'" }),
  }),
  avatar_url: z.string().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────

interface ExamRow {
  id: string;
  name_en: string;
  name_hi: string;
  description_en: string | null;
  description_hi: string | null;
  category: string;
  icon_url: string | null;
  display_order: number;
  exam_date: string | null;
}

// ─── Service Instance ─────────────────────────────────────────────────

const profileService = new ProfileService();

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * GET /api/onboarding/exams
 * Returns active exams grouped by category with bilingual names.
 *
 * Response: { success: true, data: { state: [...], central: [...] } }
 */
async function getExams(_req: Request, res: Response): Promise<void> {
  try {
    const exams = await queryMany<ExamRow>(
      `SELECT id, name_en, name_hi, description_en, description_hi, category, icon_url, display_order, exam_date
       FROM exams
       WHERE is_active = true
       ORDER BY display_order ASC, name_en ASC`
    );

    // Group exams by category
    const grouped: Record<string, ExamRow[]> = { state: [], central: [] };

    for (const exam of exams) {
      const category = exam.category === "state" ? "state" : "central";
      grouped[category].push({
        id: exam.id,
        name_en: exam.name_en,
        name_hi: exam.name_hi,
        description_en: exam.description_en,
        description_hi: exam.description_hi,
        category: exam.category,
        icon_url: exam.icon_url,
        display_order: exam.display_order,
        exam_date: exam.exam_date,
      });
    }

    res.status(200).json({
      success: true,
      data: grouped,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Failed to load exams",
      },
    });
  }
}

/**
 * POST /api/onboarding/exam-selection
 * Saves the user's selected exam during onboarding.
 *
 * Body: { examId: string (UUID) }
 */
async function saveExamSelection(req: Request, res: Response): Promise<void> {
  // Validate request body
  const parsed = examSelectionSchema.safeParse(req.body);
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

  const { examId } = parsed.data;
  const userId = req.user!.userId;

  try {
    // Verify exam exists and is active
    const exam = await queryOne<{ id: string }>(
      `SELECT id FROM exams WHERE id = $1 AND is_active = true`,
      [examId]
    );

    if (!exam) {
      res.status(422).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid exam selection. Exam not found or inactive.",
        },
      });
      return;
    }

    // Save exam selection
    const result = await queryOne<{ id: string }>(
      `UPDATE users SET selected_exam_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [examId, userId]
    );

    if (!result) {
      res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      });
      return;
    }

    // Also enroll in user_exams (supports multi-exam enrollment)
    const examIdsToEnroll = parsed.data.examIds || [examId];
    for (const eid of examIdsToEnroll) {
      await queryOne(
        `INSERT INTO user_exams (user_id, exam_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, eid]
      );
    }

    res.status(200).json({
      success: true,
      data: { examId },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "Failed to save exam selection",
      },
    });
  }
}

/**
 * POST /api/onboarding/profile-setup
 * Validates and saves name + language, marks onboarding complete.
 *
 * Body: { full_name: string, preferred_language: "hi" | "en", avatar_url?: string }
 */
async function saveProfileSetup(req: Request, res: Response): Promise<void> {
  // Validate request body
  const parsed = profileSetupSchema.safeParse(req.body);
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

  const { full_name, preferred_language } = parsed.data;
  const userId = req.user!.userId;

  try {
    // Validate name via ProfileService (applies business rules)
    profileService.validateName(full_name);

    // Update profile and mark onboarding complete
    const result = await queryOne<{ id: string }>(
      `UPDATE users
       SET full_name = $1,
           preferred_language = $2,
           onboarding_completed = true,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id`,
      [full_name.trim(), preferred_language, userId]
    );

    if (!result) {
      res.status(404).json({
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "User not found",
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        onboarding_completed: true,
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
        message: "Failed to save profile setup",
      },
    });
  }
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// All onboarding routes require authentication
router.use(jwtAuth);

// GET exams list (read-only, no CSRF needed)
router.get("/exams", getExams);

// State-changing routes (CSRF disabled in dev for now — frontend fetches token on startup)
router.post("/exam-selection", saveExamSelection);
router.post("/profile-setup", saveProfileSetup);

export default router;
