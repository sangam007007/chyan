/**
 * Central Routes File
 *
 * Mounts all controller routers under their respective base paths.
 * Import this file in the main app entry point and use it with app.use().
 */

import { Router } from "express";

import { authRouter } from "@/controllers/auth.controller.js";
import { sessionRouter } from "@/controllers/session.controller.js";
import { profileRouter } from "@/controllers/profile.controller.js";
import onboardingRouter from "@/controllers/onboarding.controller.js";
import { accountRouter } from "@/controllers/account.controller.js";
import questionsRouter from "@/controllers/questions.controller.js";
import subjectsRouter from "@/controllers/subjects.controller.js";
import testsRouter from "@/controllers/tests.controller.js";
import {
  testsAttemptsRouter,
  attemptsRouter,
} from "@/controllers/attempts.controller.js";
import { dashboardRouter } from "@/controllers/dashboard.controller.js";
import { coinsRouter } from "@/controllers/coins.controller.js";
import { dailyQuizRouter } from "@/controllers/daily-quiz.controller.js";
import { adminRouter } from "@/controllers/admin.controller.js";
import { studyPlanRouter } from "@/controllers/study-plan.controller.js";
import { performanceRouter } from "@/controllers/performance.controller.js";
import { progressRouter } from "@/controllers/progress.controller.js";
import { publicRouter } from "@/controllers/public.controller.js";
import { discussionsRouter } from "@/controllers/discussions.controller.js";
import { billingRouter } from "@/controllers/billing.controller.js";
import { requireAccess } from "@/middleware/require-access.js";

const router = Router();

router.use("/api/auth", authRouter);
router.use("/api/sessions", sessionRouter);
router.use("/api/profile", profileRouter);
router.use("/api/onboarding", onboardingRouter);
router.use("/api/account", accountRouter);
router.use("/api/questions", questionsRouter);

// Learning content: needs a login AND a running free trial or paid plan (402 otherwise)
router.use("/api/subjects", requireAccess, subjectsRouter);
router.use("/api/tests", requireAccess, testsRouter);
router.use("/api/tests/:testId/attempts", requireAccess, testsAttemptsRouter);
router.use("/api/attempts", requireAccess, attemptsRouter);
router.use("/api/dashboard", requireAccess, dashboardRouter);
router.use("/api/coins", requireAccess, coinsRouter);
router.use("/api/daily-quiz", requireAccess, dailyQuizRouter);
router.use("/api/study-plan", requireAccess, studyPlanRouter);
router.use("/api/performance", requireAccess, performanceRouter);
router.use("/api/progress", requireAccess, progressRouter);
router.use("/api/discussions", requireAccess, discussionsRouter);

// Staff area (role-protected) and plan status (must work even when the plan has ended)
router.use("/api/admin", adminRouter);
router.use("/api/billing", billingRouter);
router.use("/api/public", publicRouter);

export default router;
