/**
 * Daily Quiz Controller — Quiz status, start, submit, and result endpoints.
 *
 * Routes (all require jwtAuth):
 * - GET  /status         → { success: true, data: { status, attempt? } }
 * - POST /start          → { success: true, data: { attempt } }  (questions without correctOption)
 * - POST /submit         → body: { attemptId, answers } → { success: true, data: { score, correctAnswers } }
 * - GET  /result/:id     → { success: true, data: { attempt, questions } }
 *
 * Requirements: 9.1, 10.1, 10.3, 10.5, 10.6, 11.1
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import {
  getQuizStatus,
  startQuiz,
  submitQuiz,
  getQuizResult,
} from "@/services/daily-quiz.service.js";
import { earnCoins } from "@/services/coins.service.js";
import { query } from "@/db/index.js";
import { asyncHandler } from "@/utils/async-handler.js";

// ─── Validation Schemas ───────────────────────────────────────────────

const submitBodySchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.array(z.number().min(0).max(3).nullable()).min(1).max(10),
});

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * GET /status
 * Returns the user's daily quiz status for today (IST).
 */
async function handleGetStatus(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const data = await getQuizStatus(userId);

  res.status(200).json({ success: true, data });
}

/**
 * POST /start
 * Starts a new daily quiz or returns the existing in-progress attempt.
 * Strips correctOption from questions to avoid exposing answers.
 */
async function handleStart(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const attempt = await startQuiz(userId);

  // Fetch question details without correctOption for the response
  const questionRows = await query<{
    id: string;
    text_en: string;
    text_hi: string;
    option_a_en: string;
    option_a_hi: string;
    option_b_en: string;
    option_b_hi: string;
    option_c_en: string;
    option_c_hi: string;
    option_d_en: string;
    option_d_hi: string;
    subject: string;
    explanation_en: string | null;
    explanation_hi: string | null;
  }>(
    `SELECT id, subject, text_en, text_hi,
            option_a_en, option_a_hi,
            option_b_en, option_b_hi,
            option_c_en, option_c_hi,
            option_d_en, option_d_hi,
            explanation_en, explanation_hi
     FROM questions
     WHERE id = ANY($1::uuid[])`,
    [attempt.questionIds],
  );

  // Order questions according to attempt's questionIds order
  const questionMap = new Map(questionRows.map((q) => [q.id, q]));
  const questions = attempt.questionIds
    .map((qid) => questionMap.get(qid))
    .filter((q): q is NonNullable<typeof q> => q != null)
    .map((row) => ({
      id: row.id,
      subject: row.subject,
      textEn: row.text_en,
      textHi: row.text_hi,
      optionAEn: row.option_a_en,
      optionAHi: row.option_a_hi,
      optionBEn: row.option_b_en,
      optionBHi: row.option_b_hi,
      optionCEn: row.option_c_en,
      optionCHi: row.option_c_hi,
      optionDEn: row.option_d_en,
      optionDHi: row.option_d_hi,
      explanationEn: row.explanation_en ?? undefined,
      explanationHi: row.explanation_hi ?? undefined,
    }));

  res.status(200).json({
    success: true,
    data: { attempt: { ...attempt, questions } },
  });
}

/**
 * POST /submit
 * Submits quiz answers, computes score, and awards coins if passed (≥60%).
 */
async function handleSubmit(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const parsed = submitBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message || "Invalid request body",
      },
    });
    return;
  }

  const { attemptId, answers } = parsed.data;
  const data = await submitQuiz(userId, attemptId, answers);

  // Award 20 coins if passed (≥60% = 6/10 correct)
  const passed = data.score >= 6;
  if (passed) {
    try {
      await earnCoins(userId, "daily_challenge_pass", attemptId);
    } catch {
      // Non-critical — quiz submitted successfully even if coin award fails
    }
  }

  res.status(200).json({ success: true, data: { ...data, passed } });
}

/**
 * GET /result/:id
 * Returns the full quiz result including questions with correct answers.
 */
async function handleGetResult(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const attemptId = req.params.id as string;

  const data = await getQuizResult(userId, attemptId);

  res.status(200).json({ success: true, data });
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

router.use(jwtAuth);

router.get("/status", asyncHandler(handleGetStatus));
router.post("/start", asyncHandler(handleStart));
router.post("/submit", asyncHandler(handleSubmit));
router.get("/result/:id", asyncHandler(handleGetResult));

export { router as dailyQuizRouter };
