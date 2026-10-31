/**
 * Attempts Controller — Test attempt lifecycle: start, answer, submit, results, review.
 *
 * Two routers with different base paths:
 * - testsAttemptsRouter: /api/tests/:testId/attempts/*
 *   - POST /                → Start a new attempt
 *   - GET  /current         → Get current in-progress attempt
 *
 * - attemptsRouter: /api/attempts/:attemptId/*
 *   - PUT  /answers/:questionIndex       → Save/update answer
 *   - POST /submit                       → Submit attempt
 *   - GET  /results                      → Get results (score + breakdown + percentile)
 *   - GET  /review                       → Get review (questions + answers + explanations)
 *   - POST /review/:questionIndex/revision → Mark question for revision
 *
 * All routes require JWT authentication.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { validate } from "@/middleware/validate.js";
import { saveAnswerSchema } from "@/schemas/test.schema.js";
import {
  startAttempt,
  saveAnswer,
  submitAttempt,
  autoSubmitIfExpired,
  MAX_ATTEMPTS_PER_TEST,
} from "@/services/attempt.service.js";
import {
  calculateSubjectBreakdown,
  calculatePercentile,
} from "@/services/score-calculator.service.js";
import { queryOne, queryMany } from "@/db/index.js";
import { asyncHandler } from "@/utils/async-handler.js";
import { MAX_SLOTS, MAX_ATTEMPTS_PER_SLOT } from "@/services/dynamic-full-test.service.js";
import { getQuestionPeerStats, getTestPeerStats } from "@/services/peer-stats.service.js";
import { getOrAssignComment } from "@/services/result-comment.service.js";

// ─── Route Handlers (tests/:testId/attempts) ─────────────────────────

/**
 * POST /api/tests/:testId/attempts
 * Start a new test attempt for the authenticated user.
 */
async function handleStartAttempt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const testId = req.params.testId as string;

    // Check max 5 attempts per test
    const attemptCountRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int as count FROM test_attempts WHERE test_id = $1 AND user_id = $2 AND status IN ('submitted', 'auto_submitted')`,
      [testId, userId]
    );
    if ((attemptCountRow?.count ?? 0) >= 5) {
      res.status(400).json({ success: false, error: { code: "MAX_ATTEMPTS_REACHED", message: "Maximum 5 attempts allowed per test." } });
      return;
    }

    const attempt = await startAttempt(userId, testId);

    res.status(201).json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/tests/:testId/attempts/current
 * Get the user's current in-progress attempt for this test.
 * If the attempt has expired, auto-submit it first.
 */
async function handleGetCurrentAttempt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const testId = req.params.testId as string;

    // Find latest in-progress attempt for this user + test
    const attempt = await queryOne<{
      id: string;
      user_id: string;
      test_id: string;
      started_at: string;
      ends_at: string;
      status: string;
    }>(
      `SELECT id, user_id, test_id, started_at, ends_at, status
       FROM test_attempts
       WHERE user_id = $1 AND test_id = $2 AND status = 'in_progress'
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId, testId]
    );

    if (!attempt) {
      res.status(404).json({
        success: false,
        error: {
          code: "ATTEMPT_NOT_FOUND",
          message: "No in-progress attempt found for this test",
        },
      });
      return;
    }

    // Check if expired — abandon (delete) if expired
    const endsAt = new Date(attempt.ends_at).getTime();
    if (Date.now() > endsAt) {
      // Expired — delete the abandoned attempt
      await queryOne(`DELETE FROM attempt_answers WHERE attempt_id = $1`, [attempt.id]);
      await queryOne(`DELETE FROM test_attempts WHERE id = $1 AND status = 'in_progress'`, [attempt.id]);
      res.status(404).json({
        success: false,
        error: { code: "ATTEMPT_NOT_FOUND", message: "No in-progress attempt found for this test" },
      });
      return;
    }

    // Re-fetch attempt (still in-progress, not expired)
    const updatedAttempt = await queryOne<{
      id: string;
      user_id: string;
      test_id: string;
      started_at: string;
      ends_at: string;
      submitted_at: string | null;
      status: string;
      total_score: number | null;
      correct_count: number | null;
      wrong_count: number | null;
      skipped_count: number | null;
      percentage: number | null;
      time_taken_seconds: number | null;
    }>(
      `SELECT * FROM test_attempts WHERE id = $1`,
      [attempt.id]
    );

    // Fetch answers for the attempt
    const answers = await queryMany<{
      question_order: number;
      selected_option: number | null;
      marked_for_review: boolean;
    }>(
      `SELECT question_order, selected_option, marked_for_review
       FROM attempt_answers
       WHERE attempt_id = $1
       ORDER BY question_order ASC`,
      [attempt.id]
    );

    res.status(200).json({
      success: true,
      data: {
        attempt: updatedAttempt,
        answers,
      },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Route Handlers (attempts/:attemptId) ─────────────────────────────

/**
 * PUT /api/attempts/:attemptId/answers/:questionIndex
 * Save or update an answer for a specific question in the attempt.
 */
async function handleSaveAnswer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const attemptId = req.params.attemptId as string;
    const questionIndex = req.params.questionIndex as string;
    const { selectedOption, markedForReview } = req.body;

    await saveAnswer(
      attemptId,
      parseInt(questionIndex, 10),
      selectedOption,
      markedForReview
    );

    res.status(200).json({
      success: true,
      data: { message: "Answer saved" },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/attempts/:attemptId/abandon
 * Abandon (delete) an in-progress attempt. Only works if status is 'in_progress'.
 * This is called when user navigates away from the test page without submitting.
 */
async function handleAbandonAttempt(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const attemptId = req.params.attemptId as string;

    // Verify attempt exists, belongs to user, and is in_progress
    const attempt = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM test_attempts WHERE id = $1 AND user_id = $2`,
      [attemptId, userId],
    );

    if (!attempt) {
      res.status(404).json({ success: false, error: { code: "ATTEMPT_NOT_FOUND", message: "Attempt not found" } });
      return;
    }

    if (attempt.status !== 'in_progress') {
      // Already submitted — can't abandon
      res.status(400).json({ success: false, error: { code: "ALREADY_SUBMITTED", message: "Attempt already submitted" } });
      return;
    }

    // Delete attempt answers first (cascade should handle this, but be explicit)
    await queryOne(`DELETE FROM attempt_answers WHERE attempt_id = $1`, [attemptId]);
    await queryOne(`DELETE FROM test_attempts WHERE id = $1 AND status = 'in_progress'`, [attemptId]);

    res.status(200).json({ success: true, data: { abandoned: true } });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to abandon attempt" } });
  }
}

/**
 * POST /api/attempts/:attemptId/submit
 * Submit the test attempt and get the score result.
 */
async function handleSubmitAttempt(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const attemptId = req.params.attemptId as string;

    const scoreResult = await submitAttempt(attemptId);

    res.status(200).json({
      success: true,
      data: scoreResult,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attempts/:attemptId/results
 * Get attempt results with score, subject breakdown, and percentile.
 */
async function handleGetResults(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const attemptId = req.params.attemptId as string;

    // Fetch the attempt with score data
    const attempt = await queryOne<{
      id: string;
      user_id: string;
      test_id: string;
      status: string;
      total_score: number | null;
      correct_count: number | null;
      wrong_count: number | null;
      skipped_count: number | null;
      percentage: number | null;
      time_taken_seconds: number | null;
      started_at: string;
      submitted_at: string | null;
      comment_band: string | null;
      comment_index: number | null;
    }>(
      `SELECT id, user_id, test_id, status, total_score, correct_count, wrong_count,
              skipped_count, percentage, time_taken_seconds, started_at, submitted_at,
              comment_band, comment_index
       FROM test_attempts WHERE id = $1`,
      [attemptId]
    );

    if (!attempt) {
      res.status(404).json({
        success: false,
        error: { code: "ATTEMPT_NOT_FOUND", message: "Attempt does not exist" },
      });
      return;
    }

    if (attempt.status === "in_progress") {
      res.status(400).json({
        success: false,
        error: {
          code: "ATTEMPT_NOT_SUBMITTED",
          message: "Attempt has not been submitted yet",
        },
      });
      return;
    }

    // Fetch attempt answers and questions for breakdown calculation
    const answers = await queryMany<{
      question_id: string;
      question_order: number;
      selected_option: number | null;
      marked_for_review: boolean;
    }>(
      `SELECT question_id, question_order, selected_option, marked_for_review
       FROM attempt_answers
       WHERE attempt_id = $1
       ORDER BY question_order ASC`,
      [attemptId]
    );

    const questions = await queryMany<{
      id: string;
      correct_option: number;
      subject: string;
    }>(
      `SELECT q.id, q.correct_option, q.subject
       FROM test_questions tq
       JOIN questions q ON q.id = tq.question_id
       WHERE tq.test_id = $1
       ORDER BY tq.question_order ASC`,
      [attempt.test_id]
    );

    // Calculate subject breakdown
    const subjectBreakdown = calculateSubjectBreakdown(answers, questions);

    // Calculate percentile
    const percentile = await calculatePercentile(
      Number(attempt.total_score),
      attempt.test_id
    );

    // Fetch test config for max score / passing marks
    const test = await queryOne<{
      total_marks: number;
      passing_marks: number;
      marks_per_question: number;
      negative_marking_ratio: number;
    }>(
      `SELECT total_marks, passing_marks, marks_per_question, negative_marking_ratio FROM tests WHERE id = $1`,
      [attempt.test_id]
    );

    // The real maximum is questions x marks per question (the stored total_marks can be larger than that).
    const marksPerQuestion = Number(test?.marks_per_question ?? 1);
    const maxScore = questions.length * marksPerQuestion;
    // Pass rule used everywhere: percentage >= passing_marks / total_marks.
    // Ratio actually applied to this attempt, recovered from its stored score, so attempts scored
    // before a test's marking scheme changed still explain themselves correctly.
    const wrongN = Number(attempt.wrong_count ?? 0);
    const appliedNegativeRatio = wrongN > 0
      ? Math.max(0, Math.round(((Number(attempt.correct_count ?? 0) * marksPerQuestion - Number(attempt.total_score ?? 0)) / (wrongN * marksPerQuestion)) * 100) / 100)
      : Number(test?.negative_marking_ratio ?? 0);
    const passRatio = test && Number(test.total_marks) > 0 ? Number(test.passing_marks) / Number(test.total_marks) : 0.6;

    // How other students did on their first attempt (anonymous aggregate)
    const peer = await getTestPeerStats(attempt.test_id, req.user!.userId);

    // The funny comment next to the score: picked once for this attempt, then always the same
    const passedNow = Number(attempt.percentage ?? 0) >= passRatio * 100;
    const comment = await getOrAssignComment({
      attemptId: attempt.id,
      attemptOwnerId: attempt.user_id,
      requestingUserId: req.user!.userId,
      testId: attempt.test_id,
      passed: passedNow,
      percentage: Number(attempt.percentage ?? 0),
      storedBand: attempt.comment_band,
      storedIndex: attempt.comment_index,
    });

    res.status(200).json({
      success: true,
      data: {
        attemptId: attempt.id,
        testId: attempt.test_id,
        status: attempt.status,
        totalScore: attempt.total_score,
        maxScore,
        marksPerQuestion,
        negativeMarkingRatio: appliedNegativeRatio,
        totalQuestions: questions.length,
        percentage: attempt.percentage,
        passPercentage: Math.round(passRatio * 100),
        passed: Number(attempt.percentage ?? 0) >= passRatio * 100,
        correctCount: attempt.correct_count,
        wrongCount: attempt.wrong_count,
        skippedCount: attempt.skipped_count,
        timeTakenSeconds: attempt.time_taken_seconds,
        startedAt: attempt.started_at,
        submittedAt: attempt.submitted_at,
        percentile,
        subjectBreakdown,
        peer,
        comment,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/attempts/:attemptId/review
 * Get full answer review with questions, user answers, correct answers, and explanations.
 */
async function handleGetReview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const attemptId = req.params.attemptId as string;

    // Verify attempt exists and is submitted
    const attempt = await queryOne<{
      id: string;
      test_id: string;
      status: string;
      started_at: string;
      duration_minutes: number;
    }>(
      `SELECT ta.id, ta.test_id, ta.status, ta.started_at, t.duration_minutes
       FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       WHERE ta.id = $1`,
      [attemptId]
    );

    if (!attempt) {
      res.status(404).json({
        success: false,
        error: { code: "ATTEMPT_NOT_FOUND", message: "Attempt does not exist" },
      });
      return;
    }

    if (attempt.status === "in_progress") {
      res.status(400).json({
        success: false,
        error: {
          code: "ATTEMPT_NOT_SUBMITTED",
          message: "Attempt has not been submitted yet",
        },
      });
      return;
    }

    // Fetch questions with answers joined
    const reviewData = await queryMany<{
      question_order: number;
      question_id: string;
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
      correct_option: number;
      explanation_en: string | null;
      explanation_hi: string | null;
      subject: string;
      selected_option: number | null;
      marked_for_review: boolean;
      answered_at: string | null;
    }>(
      `SELECT
         aa.question_order,
         aa.question_id,
         q.text_en,
         q.text_hi,
         q.option_a_en,
         q.option_a_hi,
         q.option_b_en,
         q.option_b_hi,
         q.option_c_en,
         q.option_c_hi,
         q.option_d_en,
         q.option_d_hi,
         q.correct_option,
         q.explanation_en,
         q.explanation_hi,
         q.subject,
         aa.selected_option,
         aa.marked_for_review,
         aa.answered_at
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       WHERE aa.attempt_id = $1
       ORDER BY aa.question_order ASC`,
      [attemptId]
    );

    // Calculate per-question time spent
    const totalAllowedSeconds = (attempt!.duration_minutes ?? 5) * 60;
    const totalQuestions = reviewData.length;
    const avgTimePerQuestion = totalQuestions > 0 ? Math.round(totalAllowedSeconds / totalQuestions) : 60;

    // Get question history for all questions in this review (how many times wrong/correct)
    const userId = req.user!.userId;
    const questionIds = reviewData.map((q) => q.question_id);
    const historyRows = await queryMany<{ question_id: string; correct_count: string; wrong_count: string; total_count: string }>(
      `SELECT aa.question_id,
              SUM(CASE WHEN aa.selected_option = q.correct_option THEN 1 ELSE 0 END)::text AS correct_count,
              SUM(CASE WHEN aa.selected_option IS NOT NULL AND aa.selected_option != q.correct_option THEN 1 ELSE 0 END)::text AS wrong_count,
              COUNT(*)::text AS total_count
       FROM attempt_answers aa
       JOIN questions q ON q.id = aa.question_id
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE aa.question_id = ANY($1::uuid[])
         AND ta.user_id = $2
         AND ta.status IN ('submitted', 'auto_submitted')
       GROUP BY aa.question_id`,
      [questionIds, userId],
    );
    const historyMap = new Map(historyRows.map((h) => [h.question_id, { correctCount: parseInt(h.correct_count, 10), wrongCount: parseInt(h.wrong_count, 10), totalCount: parseInt(h.total_count, 10) }]));

    // Get topic info for each question
    const topicRows = await queryMany<{ question_id: string; topic_name_en: string; topic_name_hi: string }>(
      `SELECT q.id AS question_id, COALESCE(t.name_en, q.topic) AS topic_name_en, COALESCE(t.name_hi, q.topic) AS topic_name_hi
       FROM questions q
       LEFT JOIN topics t ON LOWER(t.name_en) = LOWER(q.topic) OR LOWER(t.name_hi) = LOWER(q.topic)
       WHERE q.id = ANY($1::uuid[])`,
      [questionIds],
    );
    const topicMap = new Map(topicRows.map((t) => [t.question_id, { topicNameEn: t.topic_name_en, topicNameHi: t.topic_name_hi }]));

    // What other students picked the first time they answered each question
    const peerMap = await getQuestionPeerStats(questionIds);

    const questionsWithTime = reviewData.map((q, idx) => {
      let timeSpentSeconds: number | null = null;
      if (q.answered_at) {
        const answeredTime = new Date(q.answered_at).getTime();
        const prevTime = idx === 0
          ? new Date(attempt!.started_at).getTime()
          : (reviewData[idx - 1].answered_at ? new Date(reviewData[idx - 1].answered_at!).getTime() : null);
        if (prevTime) {
          timeSpentSeconds = Math.max(0, Math.round((answeredTime - prevTime) / 1000));
        }
      }
      const history = historyMap.get(q.question_id) ?? { correctCount: 0, wrongCount: 0, totalCount: 0 };
      const topicInfo = topicMap.get(q.question_id) ?? { topicNameEn: q.subject, topicNameHi: q.subject };
      return { ...q, time_spent_seconds: timeSpentSeconds, history, topicNameEn: topicInfo.topicNameEn, topicNameHi: topicInfo.topicNameHi, peer: peerMap.get(q.question_id) ?? null };
    });

    res.status(200).json({
      success: true,
      data: {
        attemptId: attempt!.id,
        testId: attempt!.test_id,
        avgTimePerQuestion,
        questions: questionsWithTime,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/attempts/:attemptId/review/:questionIndex/revision
 * Mark a question for revision (bookmarking for future study).
 */
async function handleMarkForRevision(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const attemptId = req.params.attemptId as string;
    const questionIndex = req.params.questionIndex as string;

    // Fetch the question_id from the attempt_answers for this question_order
    const answer = await queryOne<{ question_id: string }>(
      `SELECT question_id FROM attempt_answers
       WHERE attempt_id = $1 AND question_order = $2`,
      [attemptId, parseInt(questionIndex, 10)]
    );

    if (!answer) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_QUESTION_INDEX",
          message: "Question index out of range",
        },
      });
      return;
    }

    // Insert revision mark (ignore if already exists)
    await queryOne(
      `INSERT INTO revision_marks (user_id, question_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, question_id) DO NOTHING`,
      [userId, answer.question_id]
    );

    res.status(201).json({
      success: true,
      data: { message: "Question marked for revision" },
    });
  } catch (error) {
    next(error);
  }
}

// ─── Routers ──────────────────────────────────────────────────────────

/**
 * GET /api/tests/:testId/attempts/history
 * Get all completed attempts for this test by the current user.
 */
async function handleGetAttemptHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const testId = req.params.testId as string;

    const attempts = await queryMany<{
      id: string;
      started_at: string;
      submitted_at: string | null;
      status: string;
      total_score: number | null;
      percentage: number | null;
      correct_count: number | null;
      wrong_count: number | null;
      skipped_count: number | null;
      time_taken_seconds: number | null;
    }>(
      `SELECT id, started_at, submitted_at, status, total_score, percentage,
              correct_count, wrong_count, skipped_count, time_taken_seconds
       FROM test_attempts
       WHERE user_id = $1 AND test_id = $2
         AND status IN ('submitted', 'auto_submitted')
       ORDER BY submitted_at DESC`,
      [userId, testId]
    );

    res.status(200).json({
      success: true,
      data: attempts.map((a, index) => ({
        id: a.id,
        attemptNumber: attempts.length - index,
        startedAt: a.started_at,
        submittedAt: a.submitted_at,
        status: a.status,
        totalScore: Number(a.total_score),
        percentage: Number(a.percentage),
        correctCount: Number(a.correct_count),
        wrongCount: Number(a.wrong_count),
        skippedCount: Number(a.skipped_count),
        timeTakenSeconds: Number(a.time_taken_seconds),
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Router for /api/tests/:testId/attempts/*
 * Handles attempt creation and current attempt retrieval.
 */
export const testsAttemptsRouter = Router({ mergeParams: true });
testsAttemptsRouter.use(jwtAuth);
testsAttemptsRouter.post("/", handleStartAttempt);
testsAttemptsRouter.get("/current", handleGetCurrentAttempt);
testsAttemptsRouter.get("/history", handleGetAttemptHistory);

/**
 * Router for /api/attempts/:attemptId/*
 * Handles answers, submission, results, review, and revision marking.
 */
type MyKind = "topic" | "subject_full" | "mock";
type MyStatus = "passed" | "failed" | "not_attempted";

interface MyAttemptRow {
  attemptId: string;
  attemptNumber: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  marks: number;
  maxMarks: number;
  negativeMarkingRatio: number;
  submittedAt: string;
}

interface MyTestItem {
  testId: string | null;
  /** Subject Full tests are made on demand: a slot with no test yet has testId null */
  slotNumber: number | null;
  titleEn: string;
  titleHi: string;
  kind: MyKind;
  subjectId: string | null;
  subjectNameEn: string | null;
  subjectNameHi: string | null;
  topicId: string | null;
  topicNameEn: string | null;
  topicNameHi: string | null;
  sequence: number;
  durationMinutes: number | null;
  totalQuestions: number;
  negativeMarkingRatio: number;
  marksPerQuestion: number;
  status: MyStatus;
  attemptCount: number;
  maxAttempts: number;
  bestPercentage: number | null;
  /** Number of the first attempt that passed (null if not passed yet) */
  passedOnAttempt: number | null;
  /** Number of the attempt with the highest score (the earliest one if scores tie) */
  bestAttemptNumber: number | null;
  lastAttemptAt: string | null;
  attempts: MyAttemptRow[];
  _order: [number, number, number, number, string];
}

/**
 * GET /api/attempts/mine?group=topic|test&status=all|passed|failed|not_attempted&kind=topic|subject_full|mock
 *                       &subjectId=&topicId=&sort=sequence|recent
 *
 * `group` splits the two worlds: "topic" = topic tests (Study tab / Test tab Subject section),
 * "test" = the other Test-tab tests (Subject Full + Mocks). Everything below, totals included, is
 * computed inside the chosen group.
 *
 * Progress through the tests of the Test tab (Subject section = the same topic tests as the Study tab,
 * Subject Full tests and Full Mocks): one row per test with its attempts inside, INCLUDING the tests the
 * student has not attempted yet, so they can be started from here.
 *
 * Counts ("stats" and "facets") are always about tests under the other filters, so a pill never
 * promises more rows than you will see. Pass rule: percentage >= passing_marks / total_marks.
 */
async function handleListMyAttempts(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const asUuid = (v: unknown) => (typeof v === "string" && uuid.test(v) ? v : null);
  const status = ["passed", "failed", "not_attempted"].includes(String(req.query.status)) ? (String(req.query.status) as MyStatus) : null;
  const kind = ["topic", "subject_full", "mock"].includes(String(req.query.kind)) ? (String(req.query.kind) as MyKind) : null;
  // "none" = tests that belong to no subject (the Full Mocks)
  const subjectNone = req.query.subjectId === "none";
  const subjectId = asUuid(req.query.subjectId);
  const topicId = asUuid(req.query.topicId);
  const sort = req.query.sort === "recent" ? "recent" : "sequence";
  const groupParam = req.query.group === "test" ? "test" : req.query.group === "topic" ? "topic" : null;

  const examRow = await queryOne<{ selected_exam_id: string | null }>(`SELECT selected_exam_id FROM users WHERE id = $1`, [userId]);
  const examId = examRow?.selected_exam_id ?? null;

  const [tests, attemptRows, subjectRows] = await Promise.all([
    queryMany<any>(
      `SELECT t.id, t.title_en, t.title_hi, t.category, t.duration_minutes,
              t.marks_per_question, t.negative_marking_ratio, t.passing_marks, t.total_marks,
              tp.id AS topic_id, tp.name_en AS topic_name_en, tp.name_hi AS topic_name_hi, tp.display_order AS topic_order,
              s.id AS subject_id, s.name_en AS subject_name_en, s.name_hi AS subject_name_hi, s.display_order AS subject_order,
              (SELECT COUNT(*) FROM test_questions q WHERE q.test_id = t.id) AS total_questions,
              dft.slot_number
       FROM tests t
       LEFT JOIN topics tp ON tp.id = t.topic_id
       LEFT JOIN subjects s ON s.id = COALESCE(t.subject_id, tp.subject_id)
       LEFT JOIN dynamic_full_tests dft ON dft.test_id = t.id
       WHERE (dft.id IS NULL OR dft.user_id = $1)
         -- only the selected exam: tests (and attempts) of an exam you left do not show up here
         AND ($2::uuid IS NULL OR t.exam_id = $2::uuid)
         AND (
           t.status = 'published'
           OR EXISTS (SELECT 1 FROM test_attempts a WHERE a.test_id = t.id AND a.user_id = $1 AND a.status IN ('submitted', 'auto_submitted'))
         )`,
      [userId, examId],
    ),
    queryMany<any>(
      `SELECT ta.id, ta.test_id, ta.correct_count, ta.wrong_count, ta.skipped_count, ta.total_score, ta.percentage, ta.submitted_at
       FROM test_attempts ta
       WHERE ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted') AND ta.submitted_at IS NOT NULL
       ORDER BY ta.submitted_at ASC`,
      [userId],
    ),
    examId
      ? queryMany<{ id: string; name_en: string; name_hi: string; display_order: number }>(
          `SELECT s.id, s.name_en, s.name_hi, s.display_order FROM subjects s
           WHERE s.exam_id = $1
             -- a Subject Full Test is built from the subject's topic tests: no tests, nothing to build it from
             AND EXISTS (SELECT 1 FROM tests t WHERE t.subject_id = s.id AND t.status = 'published' AND t.category = 'subject_wise')`,
          [examId],
        )
      : Promise.resolve([] as { id: string; name_en: string; name_hi: string; display_order: number }[]),
  ]);

  const attemptsByTest = new Map<string, any[]>();
  for (const a of attemptRows) {
    const list = attemptsByTest.get(a.test_id) ?? [];
    list.push(a);
    attemptsByTest.set(a.test_id, list);
  }
  const titleNumber = (t: string) => Number((t.match(/(\d+)\D*$/) ?? [])[1] ?? 0);

  let items: MyTestItem[] = tests.map((t) => {
    const itemKind: MyKind = t.topic_id ? "topic" : ["subject_wise", "topic_wise"].includes(t.category) ? "subject_full" : "mock";
    const mpq = Number(t.marks_per_question) || 1;
    const nq = Number(t.total_questions);
    const passRatio = Number(t.total_marks) > 0 ? Number(t.passing_marks) / Number(t.total_marks) : 0.6;
    const attempts: MyAttemptRow[] = (attemptsByTest.get(t.id) ?? []).map((a, i) => {
      const wrong = Number(a.wrong_count ?? 0);
      const correct = Number(a.correct_count ?? 0);
      const pct = Number(a.percentage ?? 0);
      return {
        attemptId: a.id,
        attemptNumber: i + 1,
        percentage: Math.round(pct),
        passed: pct >= passRatio * 100,
        correctCount: correct,
        wrongCount: wrong,
        skippedCount: Number(a.skipped_count ?? 0),
        totalQuestions: nq,
        marks: Number(a.total_score ?? 0),
        maxMarks: nq * mpq,
        // Ratio really applied to this attempt, recovered from its stored marks
        negativeMarkingRatio: wrong > 0
          ? Math.max(0, Math.round(((correct * mpq - Number(a.total_score ?? 0)) / (wrong * mpq)) * 100) / 100)
          : Number(t.negative_marking_ratio),
        submittedAt: a.submitted_at,
      };
    });
    const firstPassed = attempts.find((a) => a.passed);
    return {
      testId: t.id,
      slotNumber: t.slot_number ?? null,
      titleEn: t.title_en,
      titleHi: t.title_hi,
      kind: itemKind,
      subjectId: t.subject_id,
      subjectNameEn: t.subject_name_en,
      subjectNameHi: t.subject_name_hi,
      topicId: t.topic_id,
      topicNameEn: t.topic_name_en,
      topicNameHi: t.topic_name_hi,
      sequence: t.slot_number ?? titleNumber(t.title_en),
      durationMinutes: t.duration_minutes,
      totalQuestions: nq,
      negativeMarkingRatio: Number(t.negative_marking_ratio),
      marksPerQuestion: mpq,
      status: attempts.length === 0 ? "not_attempted" : firstPassed ? "passed" : "failed",
      attemptCount: attempts.length,
      maxAttempts: itemKind === "subject_full" ? MAX_ATTEMPTS_PER_SLOT : MAX_ATTEMPTS_PER_TEST,
      bestPercentage: attempts.length ? Math.max(...attempts.map((a) => a.percentage)) : null,
      passedOnAttempt: firstPassed ? firstPassed.attemptNumber : null,
      bestAttemptNumber: attempts.length
        ? attempts.reduce((b, a) => (a.percentage > b.percentage ? a : b)).attemptNumber
        : null,
      lastAttemptAt: attempts.length ? attempts[attempts.length - 1].submittedAt : null,
      attempts,
      // subject, then its topics in order, then its Full tests; mocks last
      _order: [itemKind === "mock" ? 1 : 0, Number(t.subject_order ?? 0), itemKind === "topic" ? Number(t.topic_order ?? 0) : 999, titleNumber(t.title_en), t.title_en],
    };
  });

  // Subject Full slots the student has not generated yet are still "tests to take"
  const haveSlot = new Set(items.filter((i) => i.kind === "subject_full" && i.slotNumber).map((i) => `${i.subjectId}:${i.slotNumber}`));
  for (const sj of subjectRows) {
    for (let n = 1; n <= MAX_SLOTS; n++) {
      if (haveSlot.has(`${sj.id}:${n}`)) continue;
      items.push({
        testId: null, slotNumber: n,
        titleEn: `${sj.name_en} Full Test ${n}`, titleHi: `${sj.name_hi} पूर्ण टेस्ट ${n}`,
        kind: "subject_full", subjectId: sj.id, subjectNameEn: sj.name_en, subjectNameHi: sj.name_hi,
        topicId: null, topicNameEn: null, topicNameHi: null, sequence: n,
        durationMinutes: 10, totalQuestions: 0, negativeMarkingRatio: 0, marksPerQuestion: 1,
        status: "not_attempted", attemptCount: 0, maxAttempts: MAX_ATTEMPTS_PER_SLOT,
        bestPercentage: null, passedOnAttempt: null, bestAttemptNumber: null, lastAttemptAt: null, attempts: [],
        _order: [0, Number(sj.display_order ?? 0), 999, n, `${sj.name_en} Full Test ${n}`],
      });
    }
  }

  const cmp = (x: MyTestItem, y: MyTestItem) => {
    for (let i = 0; i < 4; i++) if (x._order[i] !== y._order[i]) return (x._order[i] as number) - (y._order[i] as number);
    return String(x._order[4]).localeCompare(String(y._order[4]));
  };
  items.sort(cmp);

  // The two groups, counted before one of them is chosen (for the toggle labels)
  const groupCounts = {
    topic: items.filter((i) => i.kind === "topic").length,
    test: items.filter((i) => i.kind !== "topic").length,
  };
  if (groupParam) items = items.filter((i) => (groupParam === "topic" ? i.kind === "topic" : i.kind !== "topic"));

  // ── filtering + counts (each count ignores its own filter and respects the others) ──
  const mKind = (i: MyTestItem) => !kind || i.kind === kind;
  const mSubject = (i: MyTestItem) => (subjectNone ? i.subjectId === null : !subjectId || i.subjectId === subjectId);
  const mTopic = (i: MyTestItem) => !topicId || i.topicId === topicId;
  const mStatus = (i: MyTestItem) => !status || i.status === status;

  const scope = items.filter((i) => mKind(i) && mSubject(i) && mTopic(i));
  const count = (list: MyTestItem[], st?: MyStatus) => list.filter((i) => !st || i.status === st).length;
  const stats = {
    total: scope.length,
    attempted: scope.length - count(scope, "not_attempted"),
    notAttempted: count(scope, "not_attempted"),
    passed: count(scope, "passed"),
    failed: count(scope, "failed"),
    attempts: scope.reduce((a, i) => a + i.attemptCount, 0),
  };

  // Everything the student has, whatever filters are on (for the top card)
  const overall = {
    total: items.length,
    attempted: items.length - count(items, "not_attempted"),
    notAttempted: count(items, "not_attempted"),
    passed: count(items, "passed"),
    failed: count(items, "failed"),
    attempts: items.reduce((a, i) => a + i.attemptCount, 0),
  };

  const group = (list: MyTestItem[], keyOf: (i: MyTestItem) => string | null, nameOf: (i: MyTestItem) => [string | null, string | null]) => {
    const m = new Map<string, { id: string; nameEn: string; nameHi: string; count: number }>();
    for (const i of list) {
      const k = keyOf(i);
      if (!k) continue;
      const e = m.get(k) ?? { id: k, nameEn: nameOf(i)[0] ?? "", nameHi: nameOf(i)[1] ?? "", count: 0 };
      e.count += 1;
      m.set(k, e);
    }
    return [...m.values()];
  };

  const kindsCount = (k: MyKind) => items.filter((i) => mSubject(i) && mTopic(i) && mStatus(i) && i.kind === k).length;
  const rows = scope.filter(mStatus);
  if (sort === "recent") {
    rows.sort((x, y) => (y.lastAttemptAt ? Date.parse(y.lastAttemptAt) : -1) - (x.lastAttemptAt ? Date.parse(x.lastAttemptAt) : -1) || cmp(x, y));
  }

  res.status(200).json({
    success: true,
    data: {
      items: rows.map(({ _order, ...rest }) => rest),
      stats,
      overall,
      groupCounts,
      facets: {
        status: { all: scope.length, passed: stats.passed, failed: stats.failed, not_attempted: stats.notAttempted },
        kinds: { topic: kindsCount("topic"), subject_full: kindsCount("subject_full"), mock: kindsCount("mock") },
      },
      // Subjects, then "no subject" (Full Mocks) so the counts add up to the total
      subjects: [
        ...group(items.filter((i) => mKind(i) && mStatus(i)), (i) => i.subjectId, (i) => [i.subjectNameEn, i.subjectNameHi]),
        ...group(items.filter((i) => mKind(i) && mStatus(i) && i.subjectId === null), () => "none", () => ["All-subject Mock (full length)", "सभी विषय · फुल मॉक"]),
      ],
      topics: subjectId
        ? group(items.filter((i) => i.subjectId === subjectId && mStatus(i) && i.kind === "topic"), (i) => i.topicId, (i) => [i.topicNameEn, i.topicNameHi])
        : [],
    },
  });
}

export const attemptsRouter = Router({ mergeParams: true });
attemptsRouter.use(jwtAuth);

// Every route with :attemptId (results, review, answers, submit, abandon, similar...) only works for
// the student who owns that attempt. Anyone else gets the same 404 as for an attempt that does not exist.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
attemptsRouter.param("attemptId", async (req: Request, res: Response, next: NextFunction, attemptId: string) => {
  try {
    const notFound = () => res.status(404).json({ success: false, error: { code: "ATTEMPT_NOT_FOUND", message: "Attempt does not exist" } });
    if (!UUID_RE.test(attemptId)) return notFound();
    const row = await queryOne<{ user_id: string }>(`SELECT user_id FROM test_attempts WHERE id = $1`, [attemptId]);
    const staff = req.user?.role === "admin" || req.user?.role === "super_admin";
    if (!row || (row.user_id !== req.user!.userId && !staff)) return notFound();
    next();
  } catch (err) {
    next(err);
  }
});
attemptsRouter.get("/mine", asyncHandler(handleListMyAttempts));
attemptsRouter.delete("/:attemptId/abandon", handleAbandonAttempt);
attemptsRouter.put(
  "/:attemptId/answers/:questionIndex",
  validate(saveAnswerSchema),
  handleSaveAnswer
);
attemptsRouter.post("/:attemptId/submit", handleSubmitAttempt);
attemptsRouter.get("/:attemptId/results", handleGetResults);
attemptsRouter.get("/:attemptId/review", handleGetReview);
attemptsRouter.post(
  "/:attemptId/review/:questionIndex/revision",
  handleMarkForRevision
);

// GET /api/attempts/:attemptId/similar/:questionId — Get 5 similar questions for practice
attemptsRouter.get("/:attemptId/similar/:questionId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const questionId = req.params.questionId as string;

    // Get the group/type/topic/subject of this question
    const q = await queryOne<{ subject: string; topic: string | null; question_type: string | null; question_group_id: string | null }>(
      `SELECT subject, topic, question_type, question_group_id FROM questions WHERE id = $1`,
      [questionId],
    );

    if (!q) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Question not found" } });
      return;
    }

    let similar: any[] = [];

    // Priority 1: Same question_group_id (exact linked variations — best match)
    if (q.question_group_id) {
      similar = await queryMany(
        `SELECT id, subject, text_en, text_hi, option_a_en, option_a_hi, option_b_en, option_b_hi,
                option_c_en, option_c_hi, option_d_en, option_d_hi, correct_option, explanation_en, explanation_hi
         FROM questions
         WHERE id != $1
           AND question_group_id = $2
         ORDER BY RANDOM()
         LIMIT 5`,
        [questionId, q.question_group_id],
      );
    }

    // Priority 2: Same question_type (loosely similar pattern)
    if (similar.length < 5 && q.question_type) {
      const excludeIds = [questionId, ...similar.map((s: any) => s.id)];
      const more = await queryMany(
        `SELECT id, subject, text_en, text_hi, option_a_en, option_a_hi, option_b_en, option_b_hi,
                option_c_en, option_c_hi, option_d_en, option_d_hi, correct_option, explanation_en, explanation_hi
         FROM questions
         WHERE id != ALL($1::uuid[])
           AND question_type = $2
         ORDER BY RANDOM()
         LIMIT $3`,
        [excludeIds, q.question_type, 5 - similar.length],
      );
      similar = [...similar, ...more];
    }

    // Priority 3: Same topic
    if (similar.length < 5 && q.topic) {
      const excludeIds = [questionId, ...similar.map((s: any) => s.id)];
      const more = await queryMany(
        `SELECT id, subject, text_en, text_hi, option_a_en, option_a_hi, option_b_en, option_b_hi,
                option_c_en, option_c_hi, option_d_en, option_d_hi, correct_option, explanation_en, explanation_hi
         FROM questions
         WHERE id != ALL($1::uuid[])
           AND subject = $2
           AND topic = $3
         ORDER BY RANDOM()
         LIMIT $4`,
        [excludeIds, q.subject, q.topic, 5 - similar.length],
      );
      similar = [...similar, ...more];
    }

    // Priority 4: Same subject (last fallback)
    if (similar.length < 5) {
      const excludeIds = [questionId, ...similar.map((s: any) => s.id)];
      const more = await queryMany(
        `SELECT id, subject, text_en, text_hi, option_a_en, option_a_hi, option_b_en, option_b_hi,
                option_c_en, option_c_hi, option_d_en, option_d_hi, correct_option, explanation_en, explanation_hi
         FROM questions
         WHERE id != ALL($1::uuid[])
           AND subject = $2
         ORDER BY RANDOM()
         LIMIT $3`,
        [excludeIds, q.subject, 5 - similar.length],
      );
      similar = [...similar, ...more];
    }

    res.json({ success: true, data: similar });
  } catch (error) {
    next(error);
  }
});
