/**
 * Study Plan Controller — Sequential learning flow endpoints.
 *
 * Routes:
 * - GET  /                    → Full study plan overview
 * - GET  /current             → Current topic (resume position)
 * - GET  /subjects            → Subjects with progress
 * - GET  /topics/:subjectId   → Topics for a subject
 * - GET  /progress            → Progress summary
 * - POST /initialize          → Initialize study plan
 * - POST /topic/:topicId/start    → Start a topic
 * - POST /topic/:topicId/complete → Complete a topic
 *
 * All routes require JWT authentication.
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { queryOne, queryMany, withTransaction } from "@/db/index.js";
import {
  initializePlan,
  getStudyPlan,
  getCurrentTopic,
  startTopic,
  completeTopic,
  getProgressSummary,
  getSubjectsWithProgress,
  getTopicsForSubject,
  canTakeTopicTest,
} from "@/services/learning-engine.service.js";
import { getBuilderData, buildSuggestion, estimateMinutes, expectedTests, MIN_BUDGET, MAX_BUDGET } from "@/services/plan-builder.service.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS_PER_SUBJECT = 40;

// ─── Router ───────────────────────────────────────────────────────────

export const studyPlanRouter = Router();
studyPlanRouter.use(jwtAuth);

// ─── GET / — Full study plan overview ─────────────────────────────────

studyPlanRouter.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getStudyPlan(userId);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /current — Resume position ──────────────────────────────────

studyPlanRouter.get("/current", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getCurrentTopic(userId);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /subjects — Subjects with progress ──────────────────────────

studyPlanRouter.get("/subjects", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getSubjectsWithProgress(userId);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /topics/:subjectId — Topics for a subject ───────────────────

studyPlanRouter.get("/topics/:subjectId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const subjectId = req.params.subjectId as string;
    const data = await getTopicsForSubject(userId, subjectId);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /progress — Progress summary ────────────────────────────────

studyPlanRouter.get("/progress", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = await getProgressSummary(userId);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /initialize — Initialize study plan ────────────────────────

studyPlanRouter.post("/initialize", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { examId } = req.body;

    if (!examId || typeof examId !== "string") {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "examId is required." },
      });
      return;
    }

    await initializePlan(userId, examId);
    res.json({ success: true, data: { initialized: true } });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST/DELETE /today/items/:itemId/complete — Tick a subject of today's plan by hand ──

async function isItemInTodaysPlan(userId: string, itemId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT spi.id
     FROM user_active_plans uap
     JOIN study_plan_items spi ON spi.plan_id = uap.plan_id
     JOIN subjects sx ON sx.id = spi.subject_id
     WHERE uap.user_id = $1 AND spi.id = $2
       AND sx.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
       AND uap.plan_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
    [userId, itemId],
  );
  return !!row;
}

studyPlanRouter.post("/today/items/:itemId/complete", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const itemId = req.params.itemId as string;
    if (!(await isItemInTodaysPlan(userId, itemId))) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Item is not part of today's plan." } });
      return;
    }
    await queryOne(
      `INSERT INTO plan_item_completions (user_id, item_id, completion_date)
       VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
       ON CONFLICT (user_id, item_id, completion_date) DO NOTHING`,
      [userId, itemId],
    );
    res.json({ success: true, data: { completed: true } });
  } catch (err) {
    handleError(res, err);
  }
});

studyPlanRouter.delete("/today/items/:itemId/complete", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const itemId = req.params.itemId as string;
    await queryOne(
      `DELETE FROM plan_item_completions
       WHERE user_id = $1 AND item_id = $2
         AND completion_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
      [userId, itemId],
    );
    res.json({ success: true, data: { completed: false } });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /topic/:topicId/start — Start a topic ─────────────────────

studyPlanRouter.post("/topic/:topicId/start", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const topicId = req.params.topicId as string;

    await startTopic(userId, topicId);
    res.json({ success: true, data: { started: true } });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /topic/:topicId/complete — Complete a topic ────────────────

studyPlanRouter.post("/topic/:topicId/complete", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const topicId = req.params.topicId as string;
    const { accuracy } = req.body;

    if (accuracy === undefined || typeof accuracy !== "number" || accuracy < 0 || accuracy > 100) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "accuracy must be a number between 0 and 100.",
        },
      });
      return;
    }

    const result = await completeTopic(userId, topicId, accuracy);

    if (!result.completed) {
      res.json({
        success: true,
        data: {
          passed: false,
          message: "Accuracy below 80%. Please revise and try again.",
          bestAccuracy: accuracy,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        passed: true,
        ...result,
      },
    });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /builder — everything the "edit today's plan" screen needs, in one call ──

studyPlanRouter.get("/builder", async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getBuilderData(req.user!.userId) });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── GET /suggest?minutes=120 — auto-plan: fill the time you have with what helps most ──

studyPlanRouter.get("/suggest", async (req: Request, res: Response) => {
  try {
    const minutes = Number(req.query.minutes);
    if (!Number.isFinite(minutes) || minutes < MIN_BUDGET || minutes > MAX_BUDGET) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: `minutes must be between ${MIN_BUDGET} and ${MAX_BUDGET}.` } });
      return;
    }
    const { subjects } = await getBuilderData(req.user!.userId);
    res.json({ success: true, data: buildSuggestion(subjects, minutes) });
  } catch (err) {
    handleError(res, err);
  }
});

// ─── POST /create-today — Create & activate a plan for today ─────────

studyPlanRouter.post("/create-today", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "At least one item is required." },
      });
      return;
    }

    if (items.length > 20) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Too many subjects." } });
      return;
    }

    // Validate each item: only the student's own exam subjects, only topics/tests of that subject
    const own = await queryMany<{ id: string }>(
      `SELECT s.id FROM users u JOIN subjects s ON s.exam_id = u.selected_exam_id WHERE u.id = $1`,
      [userId],
    );
    const ownSubjects = new Set(own.map((r) => r.id));
    const seenSubjects = new Set<string>();
    for (const item of items) {
      const bad = (message: string) => res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message } });
      if (!item.subjectId || typeof item.subjectId !== "string" || !UUID.test(item.subjectId)) return void bad("Each item must have a valid subjectId.");
      if (!ownSubjects.has(item.subjectId)) return void bad("That subject is not part of your exam.");
      if (seenSubjects.has(item.subjectId)) return void bad("A subject can only appear once.");
      seenSubjects.add(item.subjectId);
      for (const key of ["topicIds", "testIds"] as const) {
        const list = item[key] ?? [];
        if (!Array.isArray(list) || list.length > MAX_ITEMS_PER_SUBJECT || list.some((x: unknown) => typeof x !== "string" || !UUID.test(x))) return void bad(`Invalid ${key}.`);
        item[key] = [...new Set(list as string[])];
      }
      if ((item.topicIds as string[]).length + (item.testIds as string[]).length === 0) return void bad("Pick at least one topic or test for each subject.");
    }
    // The planned time is worked out here from the real topics and tests, not trusted from the client
    for (const item of items) {
      const minutes = await estimateMinutes(item.subjectId, item.topicIds, item.testIds);
      if (minutes < 1) {
        res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Those topics/tests do not belong to the subject." } });
        return;
      }
      item.durationMinutes = minutes;
      item.topicCount = item.topicIds.length;
      item.testCount = item.testIds.length;
    }

    const result = await withTransaction(async (client) => {
      // 1. Create the plan
      const plan = await queryOne<{ id: string }>(
        `INSERT INTO study_plans (user_id, name) VALUES ($1, 'Today''s Plan') RETURNING id`,
        [userId],
        { client },
      );

      if (!plan) throw new Error("Failed to create plan");

      // 2. Add items with their selected topics and tests
      for (let i = 0; i < items.length; i++) {
        const planItem = await queryOne<{ id: string }>(
          `INSERT INTO study_plan_items (plan_id, subject_id, duration_minutes, display_order, topic_count, test_count)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [plan.id, items[i].subjectId, items[i].durationMinutes, i, items[i].topicCount ?? 0, items[i].testCount ?? 0],
          { client },
        );

        if (!planItem) continue;

        // Insert selected topic IDs
        const topicIds: string[] = items[i].topicIds ?? [];
        for (const topicId of topicIds) {
          await queryOne(
            `INSERT INTO study_plan_item_topics (plan_item_id, topic_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [planItem.id, topicId],
            { client },
          );
        }

        // Insert selected test IDs
        const testIds: string[] = items[i].testIds ?? [];
        for (const testId of testIds) {
          await queryOne(
            `INSERT INTO study_plan_item_tests (plan_item_id, test_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [planItem.id, testId],
            { client },
          );
        }
      }

      // 2b. Keep today's manual "subject done" ticks for subjects that stay in the plan unchanged
      await queryOne(
        `INSERT INTO plan_item_completions (user_id, item_id, completion_date)
         SELECT $1, new_i.id, (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         FROM plan_item_completions pic
         JOIN study_plan_items old_i ON old_i.id = pic.item_id
         JOIN study_plan_items new_i ON new_i.plan_id = $2 AND new_i.subject_id = old_i.subject_id
         WHERE pic.user_id = $1 AND pic.completion_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
           -- only if nothing new was added to the subject: a new topic or test means it is not finished any more
           AND NOT EXISTS (SELECT 1 FROM study_plan_item_topics nt WHERE nt.plan_item_id = new_i.id
                 AND nt.topic_id NOT IN (SELECT topic_id FROM study_plan_item_topics WHERE plan_item_id = old_i.id))
           AND NOT EXISTS (SELECT 1 FROM study_plan_item_tests nt WHERE nt.plan_item_id = new_i.id
                 AND nt.test_id NOT IN (SELECT test_id FROM study_plan_item_tests WHERE plan_item_id = old_i.id))
         ON CONFLICT (user_id, item_id, completion_date) DO NOTHING`,
        [userId, plan.id],
        { client },
      );

      // 3. Activate for today (upsert)
      await queryOne(
        `INSERT INTO user_active_plans (user_id, plan_id, plan_date)
         VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
         ON CONFLICT (user_id, plan_date) DO UPDATE SET plan_id = EXCLUDED.plan_id`,
        [userId, plan.id],
        { client },
      );

      return plan;
    });

    res.json({ success: true, data: { planId: result!.id } });
  } catch (err) {
    console.error("[study-plan] create-today error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to create plan." },
    });
  }
});

// ─── GET /today-selections — Today's plan with exact selected topics/tests ───

studyPlanRouter.get("/today-selections", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get today's active plan items with subject info
    const planItems = await queryMany<{
      item_id: string;
      subject_id: string;
      subject_name_en: string;
      subject_name_hi: string;
      duration_minutes: number;
    }>(
      `SELECT spi.id AS item_id, spi.subject_id, s.name_en AS subject_name_en, s.name_hi AS subject_name_hi, spi.duration_minutes
       FROM user_active_plans uap
       JOIN study_plans sp ON sp.id = uap.plan_id
       JOIN study_plan_items spi ON spi.plan_id = sp.id
       JOIN subjects s ON s.id = spi.subject_id
       WHERE uap.user_id = $1
         AND uap.plan_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         AND s.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
       ORDER BY spi.display_order`,
      [userId],
    );

    if (planItems.length === 0) {
      res.json({ success: true, data: { items: [] } });
      return;
    }

    // Build response with selected topics and tests for each item
    const items = await Promise.all(
      planItems.map(async (pi) => {
        // Get selected topics — show as completed only if completed TODAY
        const topics = await queryMany<{
          id: string;
          name_en: string;
          name_hi: string;
          status: string;
        }>(
          `SELECT t.id, t.name_en, t.name_hi,
                  CASE
                    WHEN tp.status = 'completed' AND (tp.completed_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date THEN 'completed'
                    ELSE 'not_started'
                  END AS status
           FROM study_plan_item_topics spit
           JOIN topics t ON t.id = spit.topic_id
           LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
           WHERE spit.plan_item_id = $2
           ORDER BY t.display_order`,
          [userId, pi.item_id],
        );

        // Get selected tests with attempt status
        const tests = await queryMany<{
          id: string;
          title_en: string;
          title_hi: string;
          topic_id: string | null;
          attempt_status: string;
          passed: boolean;
          attempt_id: string | null;
          best_percentage: number | null;
          attempt_count: number;
        }>(
          `SELECT ts.id, ts.title_en, ts.title_hi, ts.topic_id,
                  CASE
                    WHEN EXISTS (
                      SELECT 1 FROM test_attempts ta_today
                      WHERE ta_today.test_id = ts.id AND ta_today.user_id = $1
                        AND ta_today.status IN ('submitted', 'auto_submitted')
                        AND (ta_today.submitted_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
                    ) THEN 'completed'
                    WHEN ta.status = 'in_progress' THEN 'in_progress'
                    ELSE 'not_attempted'
                  END AS attempt_status,
                  CASE WHEN ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100) THEN true ELSE false END AS passed,
                  ta.attempt_id,
                  COALESCE(ta.percentage, 0) AS best_percentage,
                  (SELECT COUNT(*)::int FROM test_attempts WHERE test_id = ts.id AND user_id = $1 AND status IN ('submitted', 'auto_submitted')) AS attempt_count
           FROM study_plan_item_tests spit2
           JOIN tests ts ON ts.id = spit2.test_id
           LEFT JOIN LATERAL (
             SELECT status, id AS attempt_id, percentage FROM test_attempts
             WHERE test_id = ts.id AND user_id = $1 AND status IN ('submitted', 'auto_submitted')
             ORDER BY percentage DESC NULLS LAST, created_at DESC LIMIT 1
           ) ta ON true
           WHERE spit2.plan_item_id = $2`,
          [userId, pi.item_id],
        );

        return {
          subjectId: pi.subject_id,
          subjectNameEn: pi.subject_name_en,
          subjectNameHi: pi.subject_name_hi,
          durationMinutes: pi.duration_minutes,
          topics: topics.map((t) => ({
            id: t.id,
            nameEn: t.name_en,
            nameHi: t.name_hi,
            status: t.status,
          })),
          tests: tests.map((t) => ({
            id: t.id,
            titleEn: t.title_en,
            titleHi: t.title_hi,
            topicId: t.topic_id || null,
            attemptStatus: t.attempt_status,
            passed: t.passed,
            attemptCount: t.attempt_count,
            attemptId: t.attempt_id,
            bestPercentage: t.best_percentage ? Math.round(Number(t.best_percentage)) : null,
          })),
        };
      }),
    );

    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("[study-plan] today-selections error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch selections." },
    });
  }
});

// ─── GET /weekly-strip — Weekly plan progress for date strip ──────────

studyPlanRouter.get("/weekly-strip", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get last 7 days progress from daily_plan_progress table
    const rows = await queryMany<{
      date: string;
      total_items: number;
      completed_items: number;
      completion_pct: number;
    }>(
      `SELECT date::text, total_items, completed_items, completion_pct
       FROM daily_plan_progress
       WHERE user_id = $1
         AND date >= ((NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days')
       ORDER BY date ASC`,
      [userId],
    );

    const progressMap: Record<string, { totalItems: number; completedItems: number; pct: number }> = {};
    for (const row of rows) {
      progressMap[row.date] = {
        totalItems: row.total_items,
        completedItems: row.completed_items,
        pct: row.completion_pct,
      };
    }

    // Fallback: for days without stored data, check if user had any test activity
    const activityRows = await queryMany<{ date: string; tests_done: string }>(
      `SELECT (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date::text as date,
              COUNT(*)::text as tests_done
       FROM test_attempts ta
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date >= ((NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days')
       GROUP BY (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date`,
      [userId],
    );

    for (const row of activityRows) {
      if (!progressMap[row.date]) {
        // Had activity but no plan progress stored — show as partial
        const testsDone = parseInt(row.tests_done, 10);
        progressMap[row.date] = { totalItems: testsDone, completedItems: testsDone, pct: Math.min(100, testsDone * 20) };
      }
    }

    res.json({ success: true, data: progressMap });
  } catch (err) {
    console.error("[study-plan] weekly-strip error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch weekly strip data." },
    });
  }
});

// ─── POST /update-daily-progress — Update today's plan progress ──────

studyPlanRouter.post("/update-daily-progress", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Calculate today's plan progress from selections
    const planRow = await queryOne<{ plan_id: string }>(
      `SELECT plan_id FROM user_active_plans
       WHERE user_id = $1 AND plan_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
      [userId],
    );

    if (!planRow) {
      res.json({ success: true, data: { pct: 0 } });
      return;
    }

    // Count total selected topics + tests across all plan items
    const countRow = await queryOne<{ total: string; completed: string }>(
      `WITH selected_topics AS (
         SELECT spit.topic_id, spi.id as item_id
         FROM study_plan_items spi
         JOIN study_plan_item_topics spit ON spit.plan_item_id = spi.id
         WHERE spi.plan_id = $2
       ),
       selected_tests AS (
         SELECT spits.test_id, spi.id as item_id
         FROM study_plan_items spi
         JOIN study_plan_item_tests spits ON spits.plan_item_id = spi.id
         WHERE spi.plan_id = $2
       ),
       done_topics AS (
         SELECT st.topic_id FROM selected_topics st
         WHERE EXISTS (
           SELECT 1 FROM topic_progress tp
           WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND tp.topic_id = st.topic_id AND tp.status = 'completed'
             AND (tp.completed_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         )
       ),
       done_tests AS (
         SELECT st.test_id FROM selected_tests st
         WHERE EXISTS (
           SELECT 1 FROM test_attempts ta
           WHERE ta.user_id = $1 AND ta.test_id = st.test_id AND ta.status IN ('submitted', 'auto_submitted')
             AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
         )
       )
       SELECT
         ((SELECT COUNT(*) FROM selected_topics) + (SELECT COUNT(*) FROM selected_tests))::text AS total,
         ((SELECT COUNT(*) FROM done_topics) + (SELECT COUNT(*) FROM done_tests))::text AS completed`,
      [userId, planRow.plan_id],
    );

    const total = parseInt(countRow?.total ?? "0", 10);
    const completed = parseInt(countRow?.completed ?? "0", 10);
    const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

    // Upsert daily_plan_progress
    await queryOne(
      `INSERT INTO daily_plan_progress (user_id, date, total_items, completed_items, completion_pct, updated_at)
       VALUES ($1, (NOW() AT TIME ZONE 'Asia/Kolkata')::date, $2, $3, $4, NOW())
       ON CONFLICT (user_id, date) DO UPDATE
         SET total_items = $2, completed_items = $3, completion_pct = $4, updated_at = NOW()
       RETURNING id`,
      [userId, total, completed, pct],
    );

    res.json({ success: true, data: { pct, total, completed } });
  } catch (err) {
    console.error("[study-plan] update-daily-progress error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to update daily progress." },
    });
  }
});

// ─── POST /visit-subject — Record when user clicks on a subject ──────

studyPlanRouter.post("/visit-subject", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { subjectId } = req.body;
    if (!subjectId) { res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "subjectId required." } }); return; }
    await queryOne(
      `INSERT INTO subject_visits (user_id, subject_id, visited_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, subject_id) DO UPDATE SET visited_at = NOW()`,
      [userId, subjectId],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed." } });
  }
});

// ─── POST /mark-topic-done — Directly mark a topic as completed ──────

studyPlanRouter.post("/mark-topic-done", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { topicId } = req.body;

    if (!topicId || typeof topicId !== "string") {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "topicId is required." } });
      return;
    }

    // Upsert topic_progress — always set completed_at to NOW (today's click)
    await queryOne(
      `INSERT INTO topic_progress (user_id, topic_id, subject_id, status, best_accuracy, attempts_count, completed_at, unlocked_at)
       SELECT $1, t.id, t.subject_id, 'completed', 100, 1, NOW(), NOW()
       FROM topics t WHERE t.id = $2
       ON CONFLICT (user_id, topic_id) DO UPDATE
         SET status = 'completed', best_accuracy = GREATEST(topic_progress.best_accuracy, 100), completed_at = NOW()`,
      [userId, topicId],
    );

    res.json({ success: true, data: { completed: true } });
  } catch (err) {
    console.error("[study-plan] mark-topic-done error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to mark topic." } });
  }
});

// ─── GET /subject-detail/:subjectId — Full subject study screen data ──

studyPlanRouter.get("/subject-detail/:subjectId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const subjectId = req.params.subjectId as string;

    // 1. Subject info
    const subject = await queryOne<{
      id: string;
      name_en: string;
      name_hi: string;
    }>(
      `SELECT id, name_en, name_hi FROM subjects WHERE id = $1`,
      [subjectId],
    );

    if (!subject) {
      res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Subject not found." },
      });
      return;
    }

    // 2. Topics with progress status + part counts (parts-based status)
    const topics = await queryMany<{
      id: string;
      name_en: string;
      name_hi: string;
      display_order: number;
      status: string;
      test_count: number;
      completed_tests: number;
      total_parts: number;
      completed_parts: number;
    }>(
      `SELECT t.id, t.name_en, t.name_hi, t.display_order,
              CASE
                WHEN (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t.id) > 0
                     AND (SELECT COUNT(*)::int FROM topic_parts tp2 JOIN topic_part_progress tppr ON tppr.part_id = tp2.id AND tppr.user_id = $1 AND tppr.status = 'completed' WHERE tp2.topic_id = t.id)
                         >= (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t.id)
                     AND (SELECT COUNT(*)::int FROM tests WHERE topic_id = t.id AND status = 'published') =
                         (SELECT COUNT(DISTINCT ta2.test_id)::int FROM test_attempts ta2 JOIN tests ts2 ON ts2.id = ta2.test_id WHERE ta2.user_id = $1 AND ts2.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1) AND ts2.topic_id = t.id AND ta2.status IN ('submitted', 'auto_submitted') AND ta2.percentage >= (ts2.passing_marks::numeric / NULLIF(ts2.total_marks, 0) * 100))
                THEN 'completed'
                WHEN (SELECT COUNT(*)::int FROM topic_parts tp3 JOIN topic_part_progress tppr2 ON tppr2.part_id = tp3.id AND tppr2.user_id = $1 AND tppr2.status = 'completed' WHERE tp3.topic_id = t.id) > 0
                THEN 'in_progress'
                ELSE 'not_started'
              END AS status,
              (SELECT COUNT(*)::int FROM tests WHERE topic_id = t.id AND status = 'published') AS test_count,
              (SELECT COUNT(DISTINCT ta.test_id)::int FROM test_attempts ta JOIN tests ts ON ts.id = ta.test_id WHERE ta.user_id = $1 AND ts.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1) AND ts.topic_id = t.id AND ta.status IN ('submitted', 'auto_submitted') AND ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100)) AS completed_tests,
              (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t.id) AS total_parts,
              (SELECT COUNT(*)::int FROM topic_parts tpp2 JOIN topic_part_progress tppr ON tppr.part_id = tpp2.id AND tppr.user_id = $1 AND tppr.status = 'completed' WHERE tpp2.topic_id = t.id) AS completed_parts
       FROM topics t
       LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
       WHERE t.subject_id = $2
       ORDER BY t.display_order`,
      [userId, subjectId],
    );

    // 3. Continue learning — most recently active incomplete topic (or first incomplete if none active)
    const incompletedTopics = topics.filter((t) => t.status !== "completed");
    // Find topic with most recent part progress (in_progress ones first)
    let continueTopic = incompletedTopics.find((t) => t.status === "in_progress");
    if (!continueTopic) {
      continueTopic = incompletedTopics[0] ?? null;
    }
    const completedTopics = topics.filter((t) => t.status === "completed").length;
    const totalTopics = topics.length;

    // Get last activity date for continue topic
    let lastActivityDate: string | null = null;
    if (continueTopic) {
      const activityRow = await queryOne<{ last_activity: string | null }>(
        `SELECT GREATEST(
           (SELECT MAX(tpp.completed_at) FROM topic_part_progress tpp JOIN topic_parts tp ON tp.id = tpp.part_id WHERE tp.topic_id = $2 AND tpp.user_id = $1),
           (SELECT MAX(ta.submitted_at) FROM test_attempts ta JOIN tests ts ON ts.id = ta.test_id WHERE ts.topic_id = $2 AND ta.user_id = $1 AND ts.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1) AND ta.status IN ('submitted', 'auto_submitted'))
         ) AS last_activity`,
        [userId, continueTopic.id],
      );
      lastActivityDate = activityRow?.last_activity ?? null;
    }

    const continueLearning = continueTopic
      ? {
          topicId: continueTopic.id,
          topicNameEn: continueTopic.name_en,
          topicNameHi: continueTopic.name_hi,
          completedParts: continueTopic.completed_parts,
          totalParts: continueTopic.total_parts,
          completedTests: continueTopic.completed_tests,
          testCount: continueTopic.test_count,
          completedTopics,
          totalTopics,
          lastActivity: lastActivityDate,
          progressPercent: (continueTopic.total_parts + expectedTests(continueTopic.test_count)) > 0
            ? Math.round(((continueTopic.completed_parts + continueTopic.completed_tests) / (continueTopic.total_parts + expectedTests(continueTopic.test_count))) * 100)
            : 0,
        }
      : null;

    // 4. Stats
    const testStats = await queryOne<{ total_tests: number; completed_tests: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM tests WHERE subject_id = $2 AND status = 'published') AS total_tests,
         (SELECT COUNT(DISTINCT ta.test_id)::int
          FROM test_attempts ta
          JOIN tests ts ON ts.id = ta.test_id
          WHERE ta.user_id = $1 AND ts.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1) AND ts.subject_id = $2 AND ta.status IN ('submitted', 'auto_submitted')
            AND ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100)
         ) AS completed_tests`,
      [userId, subjectId],
    );

    const stats = {
      totalTopics,
      completedTopics,
      totalTests: testStats?.total_tests ?? 0,
      completedTests: testStats?.completed_tests ?? 0,
    };

    // 5. Daily goal — topics completed today
    const dailyResult = await queryOne<{ completed_today: number }>(
      `SELECT COUNT(*)::int AS completed_today
       FROM topic_progress
       WHERE user_id = $1 AND subject_id = $2 AND status = 'completed'
         AND (completed_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
      [userId, subjectId],
    );

    const dailyGoal = {
      completed: dailyResult?.completed_today ?? 0,
      target: 10,
      remaining: Math.max(0, 10 - (dailyResult?.completed_today ?? 0)),
    };

    // 6. Build response
    res.json({
      success: true,
      data: {
        subject: {
          id: subject.id,
          nameEn: subject.name_en,
          nameHi: subject.name_hi,
        },
        continueLearning,
        topics: topics.map((t) => {
          const totalItems = t.total_parts + expectedTests(t.test_count);
          const doneItems = t.completed_parts + t.completed_tests;
          const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
          return {
            id: t.id,
            nameEn: t.name_en,
            nameHi: t.name_hi,
            // "completed" only at a real 100%: parts done but tests still to do (or not added yet) is "in progress"
            status: t.status === "completed" && pct < 100 ? "in_progress" : t.status,
            testsComingSoon: t.test_count < 5,
            testCount: t.test_count,
            completedTests: t.completed_tests,
            totalParts: t.total_parts,
            completedParts: t.completed_parts,
            progressPercent: pct,
          };
        }),
        stats,
        dailyGoal,
      },
    });
  } catch (err) {
    console.error("[study-plan] subject-detail error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch subject detail." },
    });
  }
});

// ─── GET /study-screen — Full study screen data ──────────────────────

studyPlanRouter.get("/study-screen", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // 1. Get user's exam to find subjects
    const userRow = await queryOne<{ selected_exam_id: string }>(
      `SELECT selected_exam_id FROM users WHERE id = $1`,
      [userId],
    );

    if (!userRow?.selected_exam_id) {
      res.json({
        success: true,
        data: { continueLearning: null, subjects: [], dailyGoal: { completed: 0, target: 10, remaining: 10 } },
      });
      return;
    }

    const examId = userRow.selected_exam_id;

    // 2. Continue Learning: find the most recently active topic that is NOT fully completed (parts-based)
    const continueRow = await queryOne<{
      subject_id: string;
      subject_name_en: string;
      subject_name_hi: string;
      topic_id: string;
      topic_name_en: string;
      topic_name_hi: string;
    }>(
      `SELECT t.subject_id, s.name_en AS subject_name_en, s.name_hi AS subject_name_hi,
              t.id AS topic_id, t.name_en AS topic_name_en, t.name_hi AS topic_name_hi
       FROM topics t
       JOIN subjects s ON s.id = t.subject_id
       WHERE s.exam_id = $2
         AND (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t.id) > 0
         AND (SELECT COUNT(*)::int FROM topic_parts tp2 JOIN topic_part_progress tpp ON tpp.part_id = tp2.id AND tpp.user_id = $1 AND tpp.status = 'completed' WHERE tp2.topic_id = t.id)
             < (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t.id)
         AND (SELECT COUNT(*)::int FROM topic_parts tp3 JOIN topic_part_progress tpp2 ON tpp2.part_id = tp3.id AND tpp2.user_id = $1 WHERE tp3.topic_id = t.id) > 0
       ORDER BY (SELECT MAX(tpp3.completed_at) FROM topic_part_progress tpp3 JOIN topic_parts tp4 ON tp4.id = tpp3.part_id WHERE tp4.topic_id = t.id AND tpp3.user_id = $1) DESC NULLS LAST
       LIMIT 1`,
      [userId, examId],
    );

    // Fallback: if no in-progress topic, show first topic that has 0 parts done
    const fallbackRow = !continueRow ? await queryOne<{
      subject_id: string;
      subject_name_en: string;
      subject_name_hi: string;
      topic_id: string;
      topic_name_en: string;
      topic_name_hi: string;
    }>(
      `SELECT t.subject_id, s.name_en AS subject_name_en, s.name_hi AS subject_name_hi,
              t.id AS topic_id, t.name_en AS topic_name_en, t.name_hi AS topic_name_hi
       FROM topics t
       JOIN subjects s ON s.id = t.subject_id
       WHERE s.exam_id = $2
         AND (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t.id) > 0
         AND (SELECT COUNT(*)::int FROM topic_parts tp2 JOIN topic_part_progress tpp ON tpp.part_id = tp2.id AND tpp.user_id = $1 AND tpp.status = 'completed' WHERE tp2.topic_id = t.id) = 0
       ORDER BY s.display_order, t.display_order
       LIMIT 1`,
      [userId, examId],
    ) : null;

    const activeRow = continueRow || fallbackRow;

    let continueLearning = null;
    if (activeRow) {
      const clStats = await queryOne<{ total: number; done: number }>(
        `SELECT
           (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = $1) AS total,
           (SELECT COUNT(*)::int FROM topic_parts tp2 JOIN topic_part_progress tpp ON tpp.part_id = tp2.id AND tpp.user_id = $2 AND tpp.status = 'completed' WHERE tp2.topic_id = $1) AS done`,
        [activeRow.topic_id, userId],
      );
      const total = clStats?.total ?? 0;
      const done = clStats?.done ?? 0;
      continueLearning = {
        subjectNameEn: activeRow.subject_name_en,
        subjectNameHi: activeRow.subject_name_hi,
        topicNameEn: activeRow.topic_name_en,
        topicNameHi: activeRow.topic_name_hi,
        completedTopics: done,
        totalTopics: total,
        progressPercent: total > 0 ? Math.round((done / total) * 100) : 0,
        topicId: activeRow.topic_id,
      };
    }

    // 3. Subjects with progress
    const subjectRows = await queryMany<{
      id: string;
      name_en: string;
      name_hi: string;
      created_at: string;
    }>(
      `SELECT s.id, s.name_en, s.name_hi, s.created_at
       FROM subjects s
       WHERE s.exam_id = $1
       ORDER BY s.display_order, s.name_en`,
      [examId],
    );

    // Get subject-level stats in batch
    const subjectIds = subjectRows.map((s) => s.id);

    const subjects = await Promise.all(
      subjectRows.map(async (s) => {
        const stats = await queryOne<{
          total_topics: number;
          completed_topics: number;
          test_count: number;
          completed_tests: number;
          last_studied: string | null;
          accuracy: string | null;
        }>(
          `SELECT
             (SELECT COUNT(*)::int FROM topics WHERE subject_id = $1) AS total_topics,
             (SELECT COUNT(*)::int FROM topics t2 WHERE t2.subject_id = $1
                AND (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t2.id) > 0
                AND (SELECT COUNT(*)::int FROM topic_parts tp3 JOIN topic_part_progress tppr ON tppr.part_id = tp3.id AND tppr.user_id = $2 AND tppr.status = 'completed' WHERE tp3.topic_id = t2.id)
                    >= (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = t2.id)
             ) AS completed_topics,
             (SELECT COUNT(*)::int FROM tests WHERE subject_id = $1 AND status = 'published') AS test_count,
             (SELECT COUNT(DISTINCT ta.test_id)::int FROM test_attempts ta JOIN tests ts ON ts.id = ta.test_id WHERE ta.user_id = $2 AND ts.subject_id = $1 AND ta.status IN ('submitted', 'auto_submitted') AND ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100)) AS completed_tests,
             (SELECT visited_at FROM subject_visits WHERE user_id = $2 AND subject_id = $1) AS last_studied,
             (SELECT ROUND(AVG(best.pct))::text FROM (SELECT MAX(ta.percentage) AS pct FROM test_attempts ta JOIN tests ts ON ts.id = ta.test_id WHERE ta.user_id = $2 AND ts.subject_id = $1 AND ta.status IN ('submitted', 'auto_submitted') GROUP BY ta.test_id) best) AS accuracy`,
          [s.id, userId],
        );

        const totalTopics = stats?.total_topics ?? 0;
        const completedTopics = stats?.completed_topics ?? 0;
        const testCount = stats?.test_count ?? 0;
        const completedTests = stats?.completed_tests ?? 0;
        const lastStudied = stats?.last_studied ?? null;
        const accuracy = stats?.accuracy ? parseInt(stats.accuracy, 10) : null;
        // Subject progress = (completedTopics + completedTests) / (totalTopics + totalTests)
        const totalItems = totalTopics + expectedTests(testCount, totalTopics);
        const doneItems = completedTopics + completedTests;
        const progressPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

        // Badge logic
        let badge: string | null = null;
        const createdAt = new Date(s.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (createdAt > sevenDaysAgo) {
          badge = "NEW";
        }

        // Status logic
        let status: string;
        if (totalTopics > 0 && completedTopics >= totalTopics && progressPercent >= 100) {
          status = "completed";
        } else if (completedTopics > 0) {
          status = "ongoing";
        } else {
          status = "not_started";
        }

        return {
          id: s.id,
          nameEn: s.name_en,
          nameHi: s.name_hi,
          description: "",
          badge,
          completedTopics,
          totalTopics,
          completedTests,
          progressPercent,
          topicCount: totalTopics,
          pdfCount: 0,
          videoCount: 0,
          testCount,
          lastStudied,
          accuracy,
          status,
        };
      }),
    );

    // Check for HOT badge — most studied subject by all users
    if (subjects.length > 0) {
      const hotSubject = await queryOne<{ subject_id: string }>(
        `SELECT subject_id
         FROM topic_progress
         WHERE subject_id = ANY($1::uuid[])
         GROUP BY subject_id
         ORDER BY COUNT(*) DESC
         LIMIT 1`,
        [subjectIds],
      );
      if (hotSubject) {
        const hotIdx = subjects.findIndex((s) => s.id === hotSubject.subject_id);
        if (hotIdx >= 0 && !subjects[hotIdx].badge) {
          subjects[hotIdx].badge = "HOT";
        }
      }
    }

    // 4. Daily Goal: topics completed today (IST)
    const dailyResult = await queryOne<{ completed_today: number }>(
      `SELECT COUNT(*)::int AS completed_today
       FROM topic_progress
       WHERE user_id = $1 AND status = 'completed'
         AND (completed_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
      [userId],
    );

    const completedToday = dailyResult?.completed_today ?? 0;
    const target = 10;
    const dailyGoal = {
      completed: completedToday,
      target,
      remaining: Math.max(0, target - completedToday),
    };

    res.json({
      success: true,
      data: {
        /** false while the exam has no published test at all (content still being added) */
        examHasTests: ((await queryOne<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM tests WHERE status = 'published' AND exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)`,
          [userId],
        ))?.n ?? "0") !== "0",
        continueLearning,
        subjects,
        dailyGoal,
      },
    });
  } catch (err) {
    console.error("[study-plan] study-screen error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch study screen." },
    });
  }
});

// ─── GET /topic-parts/:topicId — Get all parts of a topic with progress ──

studyPlanRouter.get("/topic-parts/:topicId", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const topicId = req.params.topicId as string;

    // Get topic info
    const topic = await queryOne<{ id: string; name_en: string; name_hi: string; subject_id: string }>(
      "SELECT id, name_en, name_hi, subject_id FROM topics WHERE id = $1",
      [topicId],
    );

    if (!topic) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Topic not found" } });
      return;
    }

    // Get parts with progress and test attempt status
    const parts = await queryMany<{
      id: string;
      part_number: number;
      title_en: string;
      title_hi: string;
      test_id: string | null;
      status: string;
      completed_at: string | null;
      test_status: string;
    }>(
      `SELECT tp.id, tp.part_number, tp.title_en, tp.title_hi, tp.test_id,
              COALESCE(tpp.status, 'not_started') AS status,
              tpp.completed_at,
              CASE 
                WHEN tp.test_id IS NULL THEN 'no_test'
                WHEN COALESCE(tpp.status, 'not_started') != 'completed' THEN 'locked'
                WHEN ta.status IN ('submitted', 'auto_submitted') THEN 'completed'
                WHEN ta.status = 'in_progress' THEN 'in_progress'
                ELSE 'unlocked'
              END AS test_status
       FROM topic_parts tp
       LEFT JOIN topic_part_progress tpp ON tpp.part_id = tp.id AND tpp.user_id = $1
       LEFT JOIN LATERAL (
         SELECT status FROM test_attempts WHERE test_id = tp.test_id AND user_id = $1 AND status IN ('submitted', 'auto_submitted') ORDER BY percentage DESC NULLS LAST, created_at DESC LIMIT 1
       ) ta ON tp.test_id IS NOT NULL
       WHERE tp.topic_id = $2
       ORDER BY tp.display_order, tp.part_number`,
      [userId, topicId],
    );

    // Fetch all tests linked to THIS specific topic
    const topicTests = await queryMany<{
      id: string;
      title_en: string;
      title_hi: string;
      attempt_status: string;
      attempt_id: string | null;
      passed: boolean;
      attempt_count: number;
      best_percentage: number | null;
    }>(
      `SELECT ts.id, ts.title_en, ts.title_hi,
              CASE
                WHEN ta.status IN ('submitted', 'auto_submitted') THEN 'completed'
                WHEN ta.status = 'in_progress' THEN 'in_progress'
                ELSE 'not_attempted'
              END AS attempt_status,
              ta.attempt_id,
              CASE WHEN ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100) THEN true ELSE false END AS passed,
              (SELECT COUNT(*)::int FROM test_attempts WHERE test_id = ts.id AND user_id = $1 AND status IN ('submitted', 'auto_submitted')) AS attempt_count,
              ta.percentage AS best_percentage
       FROM tests ts
       LEFT JOIN LATERAL (
         SELECT status, id AS attempt_id, percentage FROM test_attempts WHERE test_id = ts.id AND user_id = $1 AND status IN ('submitted', 'auto_submitted') ORDER BY percentage DESC NULLS LAST, created_at DESC LIMIT 1
       ) ta ON true
       WHERE ts.topic_id = $2 AND ts.status = 'published'
       ORDER BY ts.created_at`,
      [userId, topicId],
    );

    // Stats — include tests in progress calculation
    const totalParts = parts.length;
    const completedParts = parts.filter((p) => p.status === "completed").length;
    const totalTests = topicTests.length;
    const testsExpected = expectedTests(totalTests);
    const completedTests = topicTests.filter((t) => t.passed).length;
    const allDone = totalParts > 0 && completedParts >= totalParts;
    const totalItems = totalParts + testsExpected;
    const doneItems = completedParts + completedTests;
    const progressPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    res.json({
      success: true,
      data: {
        topic: { id: topic.id, nameEn: topic.name_en, nameHi: topic.name_hi, subjectId: topic.subject_id },
        parts: parts.map((p) => ({
          id: p.id,
          partNumber: p.part_number,
          titleEn: p.title_en,
          titleHi: p.title_hi,
          status: p.status,
          testId: p.test_id,
          testStatus: p.test_status,
          completedAt: p.completed_at,
        })),
        tests: topicTests.map((t) => ({
          id: t.id,
          titleEn: t.title_en,
          titleHi: t.title_hi,
          attemptStatus: t.attempt_status,
          attemptId: t.attempt_id,
          passed: t.passed,
          attemptCount: t.attempt_count,
          bestPercentage: t.best_percentage != null ? Math.round(Number(t.best_percentage)) : null,
        })),
        stats: {
          totalParts,
          completedParts,
          totalTests,
          completedTests,
          allPartsCompleted: allDone,
          progressPercent,
          /** this topic has fewer tests than planned: the missing ones are still to be added */
          testsComingSoon: totalTests < 5,
        },
      },
    });
  } catch (err) {
    console.error("[study-plan] topic-parts error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch topic parts." } });
  }
});

// ─── POST /part/:partId/complete — Mark a part as completed ──────────

studyPlanRouter.post("/part/:partId/complete", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const partId = req.params.partId as string;

    // 1. Mark part as completed
    await queryOne(
      `INSERT INTO topic_part_progress (user_id, part_id, status, completed_at)
       VALUES ($1, $2, 'completed', NOW())
       ON CONFLICT (user_id, part_id) DO UPDATE SET status = 'completed', completed_at = NOW()`,
      [userId, partId],
    );

    // 2. Check if ALL parts of this topic are now completed — if yes, mark topic as completed too
    const partInfo = await queryOne<{ topic_id: string }>(
      `SELECT topic_id FROM topic_parts WHERE id = $1`,
      [partId],
    );

    if (partInfo) {
      const counts = await queryOne<{ total: number; done: number }>(
        `SELECT
           (SELECT COUNT(*)::int FROM topic_parts WHERE topic_id = $1) AS total,
           (SELECT COUNT(*)::int FROM topic_parts tp2 JOIN topic_part_progress tpp ON tpp.part_id = tp2.id AND tpp.user_id = $2 AND tpp.status = 'completed' WHERE tp2.topic_id = $1) AS done`,
        [partInfo.topic_id, userId],
      );

      if (counts && counts.total > 0 && counts.done >= counts.total) {
        // All parts done — auto-mark topic as completed
        await queryOne(
          `INSERT INTO topic_progress (user_id, topic_id, subject_id, status, best_accuracy, attempts_count, completed_at, unlocked_at)
           SELECT $1, t.id, t.subject_id, 'completed', 100, 1, NOW(), NOW()
           FROM topics t WHERE t.id = $2
           ON CONFLICT (user_id, topic_id) DO UPDATE
             SET status = 'completed', completed_at = NOW()`,
          [userId, partInfo.topic_id],
        );
      }
    }

    res.json({ success: true, data: { completed: true } });
  } catch (err) {
    console.error("[study-plan] part-complete error:", err);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to complete part." } });
  }
});

// ─── Error Handler ────────────────────────────────────────────────────

function handleError(res: Response, err: unknown): void {
  if (err instanceof Error) {
    const statusCode = (err as { statusCode?: number }).statusCode;

    if (statusCode === 403) {
      res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: err.message },
      });
      return;
    }

    if (statusCode === 400) {
      res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: err.message },
      });
      return;
    }
  }

  console.error("[study-plan] Unexpected error:", err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Something went wrong." },
  });
}
