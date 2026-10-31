/**
 * Progress Engine Controller — Learning journey & completion tracking.
 *
 * Routes:
 * - GET /overview     → Overall progress (XP, levels, completion, streak)
 * - GET /subjects     → Per-subject completion progress
 * - GET /topics       → Per-topic progress details
 * - GET /timeline     → Chronological activity timeline
 * - GET /goals        → Daily goals & streak
 * - GET /heatmap      → 365-day activity heatmap
 * - GET /milestones   → Dynamic achievement milestones
 * - GET /xp           → XP & level details
 * - GET /history      → Weekly/monthly completion history
 *
 * All routes require JWT authentication.
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import {
  getProgressOverview,
  getSubjectProgress,
  getTopicProgress,
  getTimeline,
  getDailyGoals,
  getHeatmap,
  getMilestones,
  getXPDetails,
  getProgressHistory,
} from "@/services/progress-engine.service.js";

export const progressRouter = Router();

progressRouter.use(jwtAuth);

// GET /api/progress/overview
progressRouter.get("/overview", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getProgressOverview(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] overview error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch progress overview" } });
  }
});

// GET /api/progress/subjects
progressRouter.get("/subjects", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getSubjectProgress(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] subjects error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch subject progress" } });
  }
});

// GET /api/progress/topics
progressRouter.get("/topics", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getTopicProgress(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] topics error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch topic progress" } });
  }
});

// GET /api/progress/timeline
progressRouter.get("/timeline", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const data = await getTimeline(userId, limit);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] timeline error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch timeline" } });
  }
});

// GET /api/progress/goals
progressRouter.get("/goals", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getDailyGoals(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] goals error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch daily goals" } });
  }
});

// GET /api/progress/heatmap
progressRouter.get("/heatmap", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getHeatmap(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] heatmap error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch heatmap" } });
  }
});

// GET /api/progress/milestones
progressRouter.get("/milestones", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getMilestones(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] milestones error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch milestones" } });
  }
});

// GET /api/progress/xp
progressRouter.get("/xp", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getXPDetails(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] xp error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch XP details" } });
  }
});

// GET /api/progress/history
progressRouter.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getProgressHistory(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[Progress] history error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch progress history" } });
  }
});
