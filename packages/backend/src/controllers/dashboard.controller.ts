/**
 * Dashboard Controller — Leaderboard, streak tracking, and rank estimation endpoints.
 *
 * Routes:
 * - GET  /leaderboard?type=state|national  → Get user rankings
 * - POST /activity                         → Record daily activity
 * - GET  /streak                           → Get current streak info
 * - GET  /rank-estimate?marks=<number>     → Estimate exam rank
 *
 * All routes require JWT authentication.
 *
 * Requirements: 1.1, 1.6, 2.1, 2.3, 3.1, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { queryOne } from "@/db/index.js";
import { getLeaderboard } from "@/services/leaderboard.service.js";
import { recordActivity, getStreakWithBest } from "@/services/streak.service.js";
import { estimateRank } from "@/services/rank-estimator.service.js";
import { getBalance } from "@/services/coins.service.js";
import {
  getTodayPlan as getTodayPlanService,
  getContinueLearning as getContinueLearningService,
  getPerformanceStats as getPerformanceStatsService,
  getWeakAreas as getWeakAreasService,
  getRevisionDue as getRevisionDueService,
  getRecommendations as getRecommendationsService,
  getDailyChallenge as getDailyChallengeService,
  getRecentResults as getRecentResultsService,
} from "@/services/dashboard-dynamic.service.js";
import { asyncHandler } from "@/utils/async-handler.js";

// ─── Validation Schemas ───────────────────────────────────────────────

const leaderboardQuerySchema = z.object({
  type: z.enum(["state", "national"]),
});

const rankEstimateQuerySchema = z.object({
  marks: z.coerce
    .number()
    .min(0, "marks must be >= 0")
    .max(150, "marks must be <= 150")
    .refine((v) => Number((v * 100).toFixed(0)) === v * 100, {
      message: "marks accepts up to 2 decimal places",
    }),
});

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * GET /leaderboard?type=state|national
 * Returns the leaderboard entries and the requesting user's rank.
 */
async function handleGetLeaderboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  // Validate query params
  const parsed = leaderboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message || "type must be 'state' or 'national'",
      },
    });
    return;
  }

  const { type } = parsed.data;

  let examId: string | null = null;

  // For state leaderboard, fetch user's selected_exam_id
  if (type === "state") {
    const user = await queryOne<{ selected_exam_id: string | null }>(
      `SELECT selected_exam_id FROM users WHERE id = $1`,
      [userId],
    );

    if (!user || !user.selected_exam_id) {
      res.status(400).json({
        success: false,
        error: {
          code: "NO_EXAM_SELECTED",
          message: "User has not selected an exam",
        },
      });
      return;
    }

    examId = user.selected_exam_id;
  }

  const result = await getLeaderboard(userId, type, examId);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * POST /activity
 * Records daily activity for the authenticated user.
 */
async function handleRecordActivity(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  await recordActivity(userId);

  res.status(200).json({ success: true });
}

/**
 * GET /streak
 * Returns the user's current streak information including best streak.
 */
async function handleGetStreak(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const result = await getStreakWithBest(userId);

  res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /home
 * Returns combined dashboard data: streak, days left, exam date, coin balance.
 */
async function handleGetHome(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  // Get streak data with best streak
  const streak = await getStreakWithBest(userId);

  // Get user's selected exam date
  const examRow = await queryOne<{ exam_date: Date | string | null }>(
    `SELECT e.exam_date
     FROM users u
     LEFT JOIN exams e ON e.id = u.selected_exam_id
     WHERE u.id = $1`,
    [userId],
  );

  let daysLeft: number | null = null;
  let examDateFormatted: string | null = null;

  if (examRow?.exam_date) {
    // Compute IST "today"
    const nowIST = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    );
    const todayIST = new Date(
      nowIST.getFullYear(),
      nowIST.getMonth(),
      nowIST.getDate(),
    );

    // Parse exam date
    const examDate =
      examRow.exam_date instanceof Date
        ? examRow.exam_date
        : new Date(examRow.exam_date);

    const examDateOnly = new Date(
      examDate.getFullYear(),
      examDate.getMonth(),
      examDate.getDate(),
    );

    // Compute daysLeft: if exam_date < today → 0; else → difference in calendar days
    const diffMs = examDateOnly.getTime() - todayIST.getTime();
    if (diffMs <= 0) {
      daysLeft = 0;
    } else {
      daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    // Format exam_date as "DD Mon" (e.g., "13 Oct")
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const day = examDateOnly.getDate();
    const month = months[examDateOnly.getMonth()];
    examDateFormatted = `${day} ${month}`;
  }

  // Get coin balance
  const coinBalanceData = await getBalance(userId);

  res.status(200).json({
    success: true,
    data: {
      streak: {
        currentStreak: streak.currentStreak,
        bestStreak: streak.bestStreak,
        streakDates: streak.streakDates,
      },
      daysLeft,
      examDateFormatted,
      coinBalance: coinBalanceData.balance,
    },
  });
}

/**
 * GET /rank-estimate?marks=<number>
 * Returns the estimated rank based on provided marks.
 */
async function handleGetRankEstimate(req: Request, res: Response): Promise<void> {
  // Validate query params
  const parsed = rankEstimateQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message || "Invalid marks parameter",
      },
    });
    return;
  }

  const { marks } = parsed.data;

  const result = await estimateRank(marks);

  res.status(200).json({
    success: true,
    data: result,
  });
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// All routes require JWT authentication
router.use(jwtAuth);

router.get("/leaderboard", asyncHandler(handleGetLeaderboard));
router.post("/activity", asyncHandler(handleRecordActivity));
router.get("/streak", asyncHandler(handleGetStreak));
router.get("/home", asyncHandler(handleGetHome));
router.get("/rank-estimate", asyncHandler(handleGetRankEstimate));

// ─── Dynamic Dashboard Widget Handlers ────────────────────────────────

/**
 * GET /today-plan
 * Returns the active study plan for today with items and completion status.
 */
async function handleGetTodayPlan(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getTodayPlanService(userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch today's plan" },
    });
  }
}

/**
 * GET /continue-learning
 * Returns the latest incomplete topic (accuracy < 80%) for the user.
 */
async function handleGetContinueLearning(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getContinueLearningService(userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch continue learning data" },
    });
  }
}

/**
 * GET /performance?period=week|last_week|month|6months|all
 * Returns performance stats filtered by period and a 7-day accuracy chart.
 */
async function handleGetPerformance(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const period = (req.query.period as string) || 'all';
    const result = await getPerformanceStatsService(userId, period);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch performance stats" },
    });
  }
}

/**
 * GET /weak-areas
 * Returns subjects with lowest accuracy (below 70%).
 */
async function handleGetWeakAreas(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getWeakAreasService(userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch weak areas" },
    });
  }
}

/**
 * GET /revision-due
 * Returns revision marks due today (oldest first).
 */
async function handleGetRevisionDue(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getRevisionDueService(userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch revision due items" },
    });
  }
}

/**
 * GET /recommendations
 * Returns recommended tests based on weak areas.
 */
async function handleGetRecommendations(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getRecommendationsService(userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch recommendations" },
    });
  }
}

/**
 * GET /daily-challenge
 * Returns today's answered question count vs target.
 */
async function handleGetDailyChallenge(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getDailyChallengeService(userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch daily challenge data" },
    });
  }
}

/**
 * GET /recent-results
 * Returns last 3 submitted test results.
 */
async function handleGetRecentResults(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const result = await getRecentResultsService(userId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch recent results" },
    });
  }
}

// ─── Dynamic Dashboard Widget Routes ──────────────────────────────────

router.get("/today-plan", asyncHandler(handleGetTodayPlan));
router.get("/continue-learning", asyncHandler(handleGetContinueLearning));
router.get("/performance", asyncHandler(handleGetPerformance));
router.get("/weak-areas", asyncHandler(handleGetWeakAreas));
router.get("/revision-due", asyncHandler(handleGetRevisionDue));
router.get("/recommendations", asyncHandler(handleGetRecommendations));
router.get("/daily-challenge", asyncHandler(handleGetDailyChallenge));
router.get("/recent-results", asyncHandler(handleGetRecentResults));

export { router as dashboardRouter };
