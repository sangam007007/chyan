/**
 * Performance Analytics Controller
 *
 * Routes:
 * - GET /overview         → Overall performance stats
 * - GET /subjects         → Per-subject analytics
 * - GET /topics           → Per-topic analytics
 * - GET /weekly           → Last 7 days breakdown
 * - GET /monthly          → Last 30 days with week-by-week
 * - GET /time             → Time-based analytics
 * - GET /weak-strong      → Weak and strong areas combined
 * - GET /recommendations  → Personalized recommendations
 * - GET /rank             → User rank and percentile
 *
 * All routes require JWT authentication.
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { getAchievements } from "@/services/achievements.service.js";
import { queryOne, queryMany } from "@/db/index.js";
import {
  getOverview,
  getSubjectAnalytics,
  getTopicAnalytics,
  getWeeklyAnalytics,
  getMonthlyAnalytics,
  getTimeAnalytics,
  getWeakAreas,
  getStrongAreas,
  getRecommendations,
  getRankAnalytics,
  getActivityHeatmap,
  getDailyPerformance,
  getReadiness,
} from "@/services/performance-analytics.service.js";

export const performanceRouter = Router();

performanceRouter.use(jwtAuth);

// GET /api/performance/overview
performanceRouter.get("/overview", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getOverview(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] overview error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch overview" } });
  }
});

// GET /api/performance/subjects
performanceRouter.get("/subjects", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getSubjectAnalytics(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] subjects error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch subject analytics" } });
  }
});

// GET /api/performance/topics
performanceRouter.get("/topics", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getTopicAnalytics(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] topics error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch topic analytics" } });
  }
});

// GET /api/performance/weekly
performanceRouter.get("/weekly", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getWeeklyAnalytics(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] weekly error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch weekly analytics" } });
  }
});

// GET /api/performance/monthly
performanceRouter.get("/monthly", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getMonthlyAnalytics(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] monthly error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch monthly analytics" } });
  }
});

// GET /api/performance/time
performanceRouter.get("/time", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getTimeAnalytics(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] time error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch time analytics" } });
  }
});

// GET /api/performance/weak-strong
performanceRouter.get("/weak-strong", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [weak, strong] = await Promise.all([
      getWeakAreas(userId),
      getStrongAreas(userId),
    ]);
    res.json({ success: true, data: { weak: weak.weakSubjects, strong: strong.strongSubjects, weakTopics: weak.weakTopics, strongTopics: strong.strongTopics } });
  } catch (err) {
    console.error("[Performance] weak-strong error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch weak/strong areas" } });
  }
});

// GET /api/performance/recommendations
performanceRouter.get("/recommendations", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getRecommendations(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] recommendations error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch recommendations" } });
  }
});

// GET /api/performance/rank
performanceRouter.get("/rank", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getRankAnalytics(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] rank error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch rank analytics" } });
  }
});

// GET /api/performance/activity — last 12 weeks of active days + streaks
performanceRouter.get("/activity", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getActivityHeatmap(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] activity error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch activity" } });
  }
});

// GET /api/performance/daily?days=7|30|90|180 — overall per-day score for the progress graph
performanceRouter.get("/daily", async (req: Request, res: Response) => {
  try {
    const requested = parseInt(String(req.query.days ?? "30"), 10);
    const days = [7, 30, 90, 180].includes(requested) ? requested : 30;
    const data = await getDailyPerformance(req.user!.userId, days);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] daily error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch daily performance" } });
  }
});

// GET /api/performance/achievements — derived badges + XP/level
performanceRouter.get("/achievements", async (req: Request, res: Response) => {
  try {
    const data = await getAchievements(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] achievements error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch achievements" } });
  }
});

// GET /api/performance/readiness — composite exam-readiness score + breakdown
performanceRouter.get("/readiness", async (req: Request, res: Response) => {
  try {
    const data = await getReadiness(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Performance] readiness error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch readiness" } });
  }
});

// GET /api/performance/leaderboard — Top 10 + user position
performanceRouter.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const leaderboard = await queryMany<{ user_id: string; name: string; avg_pct: string; rank: string }>(
      `WITH best_per_test AS (
         SELECT user_id, test_id, MAX(percentage) AS pct
         FROM test_attempts
         WHERE status IN ('submitted', 'auto_submitted')
         GROUP BY user_id, test_id
       ),
       user_avgs AS (
         SELECT bpt.user_id, u.full_name AS name,
                ROUND(AVG(bpt.pct), 1) AS avg_pct,
                DENSE_RANK() OVER (ORDER BY AVG(bpt.pct) DESC) AS rank
         FROM best_per_test bpt
         JOIN users u ON u.id = bpt.user_id
         GROUP BY bpt.user_id, u.full_name
         HAVING COUNT(DISTINCT bpt.test_id) >= 2
       )
       SELECT user_id, name, avg_pct::text, rank::text FROM user_avgs ORDER BY rank LIMIT 10`,
      [],
    );

    // Get user's own position
    const userRow = await queryOne<{ avg_pct: string; rank: string }>(
      `WITH best_per_test AS (
         SELECT user_id, test_id, MAX(percentage) AS pct
         FROM test_attempts
         WHERE status IN ('submitted', 'auto_submitted')
         GROUP BY user_id, test_id
       ),
       user_avgs AS (
         SELECT bpt.user_id,
                ROUND(AVG(bpt.pct), 1) AS avg_pct,
                DENSE_RANK() OVER (ORDER BY AVG(bpt.pct) DESC) AS rank
         FROM best_per_test bpt
         GROUP BY bpt.user_id
         HAVING COUNT(DISTINCT bpt.test_id) >= 2
       )
       SELECT avg_pct::text, rank::text FROM user_avgs WHERE user_id = $1`,
      [userId],
    );

    res.json({
      success: true,
      data: {
        leaderboard: leaderboard.map((r) => ({
          userId: r.user_id,
          name: r.name || 'Student',
          avgPercentage: parseFloat(r.avg_pct),
          rank: parseInt(r.rank, 10),
          isCurrentUser: r.user_id === userId,
        })),
        userRank: userRow ? { avgPercentage: parseFloat(userRow.avg_pct), rank: parseInt(userRow.rank, 10) } : null,
      },
    });
  } catch (err) {
    console.error("[Performance] leaderboard error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch leaderboard" } });
  }
});

// GET /api/performance/trend — Daily accuracy for last 30 days
performanceRouter.get("/trend", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const rows = await queryMany<{ date: string; avg_pct: string; tests_taken: string }>(
      `SELECT (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date::text AS date,
              ROUND(AVG(ta.percentage), 1)::text AS avg_pct,
              COUNT(*)::text AS tests_taken
       FROM test_attempts ta
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND ta.submitted_at >= NOW() - INTERVAL '30 days'
       GROUP BY (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date
       ORDER BY date ASC`,
      [userId],
    );

    res.json({
      success: true,
      data: rows.map((r) => ({ date: r.date, avgPercentage: parseFloat(r.avg_pct), testsTaken: parseInt(r.tests_taken, 10) })),
    });
  } catch (err) {
    console.error("[Performance] trend error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch trend" } });
  }
});

// GET /api/performance/prediction — Exam score prediction
performanceRouter.get("/prediction", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user's exam details
    const user = await queryOne<{ selected_exam_id: string }>(
      `SELECT selected_exam_id FROM users WHERE id = $1`, [userId],
    );
    const exam = user?.selected_exam_id ? await queryOne<{ exam_date: string | null }>(
      `SELECT exam_date::text FROM exams WHERE id = $1`, [user.selected_exam_id],
    ) : null;

    const totalExamMarks = Number(process.env.RANK_TOTAL_MARKS) > 0 ? Number(process.env.RANK_TOTAL_MARKS) : 150;
    const examDate = exam?.exam_date ?? null;

    // Get overall accuracy (best per test)
    const accuracyRow = await queryOne<{ avg_pct: string }>(
      `SELECT ROUND(AVG(best.pct), 1)::text AS avg_pct
       FROM (SELECT MAX(percentage) AS pct FROM test_attempts WHERE user_id = $1 AND status IN ('submitted', 'auto_submitted') GROUP BY test_id) best`,
      [userId],
    );
    const avgAccuracy = accuracyRow ? parseFloat(accuracyRow.avg_pct) : 0;

    // Prediction: estimated marks = (accuracy% / 100) * total_marks
    const predictedMarks = Math.round((avgAccuracy / 100) * totalExamMarks);

    // Days until exam
    const daysLeft = examDate ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

    // Speed: avg time per question
    const speedRow = await queryOne<{ avg_time: string }>(
      `SELECT ROUND(AVG(ta.time_taken_seconds::numeric / NULLIF((ta.correct_count + ta.wrong_count + ta.skipped_count), 0)), 1)::text AS avg_time
       FROM test_attempts ta WHERE ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted')`,
      [userId],
    );
    const avgSecondsPerQuestion = speedRow ? parseFloat(speedRow.avg_time) : 0;

    res.json({
      success: true,
      data: {
        predictedMarks,
        totalExamMarks,
        avgAccuracy,
        avgSecondsPerQuestion,
        daysLeft,
        examDate,
      },
    });
  } catch (err) {
    console.error("[Performance] prediction error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch prediction" } });
  }
});
