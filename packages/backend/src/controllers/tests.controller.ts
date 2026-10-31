/**
 * Tests Controller — CRUD operations for Test management (admin) and user test listing.
 *
 * Routes:
 * - POST   /api/tests      → Create test with ordered question associations
 * - PUT    /api/tests/:id  → Update test (optionally re-link questions)
 * - GET    /api/tests       → List published tests for authenticated user (filtered by exam)
 * - GET    /api/tests/:id  → Get test details with question count
 *
 * All routes require JWT authentication.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4
 */

import { Router } from "express";
import type { Request, Response } from "express";

import { jwtAuth } from "@/middleware/jwt-auth.js";
import { requireRole } from "@/middleware/require-role.js";
import { validate } from "@/middleware/validate.js";
import { createTestSchema, updateTestSchema, VALID_CATEGORIES } from "@/schemas/test.schema.js";
import type { TestCategory } from "@/schemas/test.schema.js";
import { queryOne, queryMany, withTransaction } from "@/db/index.js";
import { getTestsForUser } from "@/services/test-listing.service.js";
import type { SortOption } from "@/services/test-listing.service.js";
import { getFullTestSlots, generateFullTest } from "@/services/dynamic-full-test.service.js";

// ─── Types ────────────────────────────────────────────────────────────

interface TestRow {
  id: string;
  title_en: string;
  title_hi: string;
  description_en: string | null;
  description_hi: string | null;
  exam_id: string;
  duration_minutes: number;
  total_marks: number;
  marks_per_question: number;
  negative_marking_ratio: number;
  passing_marks: number;
  pricing_type: string;
  category: string;
  status: string;
  available_from: string | null;
  available_until: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Topic and subject tests (Study / Subject content) never have negative marking.
 * Only Test-section tests (full mock, previous year, daily practice) can, when an admin sets it.
 * The database enforces the same rule (chk_study_tests_no_negative_marking).
 */
const NO_NEGATIVE_MARKING_CATEGORIES = ["subject_wise", "topic_wise"];

/**
 * Format a database test row into API response format.
 */
function formatTest(row: TestRow, questionCount?: number) {
  return {
    id: row.id,
    titleEn: row.title_en,
    titleHi: row.title_hi,
    descriptionEn: row.description_en,
    descriptionHi: row.description_hi,
    examId: row.exam_id,
    durationMinutes: row.duration_minutes,
    totalMarks: row.total_marks,
    marksPerQuestion: row.marks_per_question,
    negativeMarkingRatio: row.negative_marking_ratio,
    passingMarks: row.passing_marks,
    pricingType: row.pricing_type,
    category: row.category,
    status: row.status,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    attemptCount: row.attempt_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(questionCount !== undefined ? { questionCount } : {}),
  };
}

// ─── Route Handlers ───────────────────────────────────────────────────

/**
 * POST /api/tests
 * Create a new test with ordered question associations.
 */
async function createTest(req: Request, res: Response): Promise<void> {
  const {
    titleEn,
    titleHi,
    descriptionEn,
    descriptionHi,
    examId,
    durationMinutes,
    totalMarks,
    marksPerQuestion,
    negativeMarkingRatio,
    passingMarks,
    pricingType,
    status,
    availableFrom,
    availableUntil,
    category,
    questionIds,
  } = req.body;

  try {
    const result = await withTransaction(async (client) => {
      // Insert into tests table
      const test = await queryOne<TestRow>(
        `INSERT INTO tests (
          title_en, title_hi,
          description_en, description_hi,
          exam_id, duration_minutes, total_marks,
          marks_per_question, negative_marking_ratio, passing_marks,
          pricing_type, status,
          available_from, available_until,
          category
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING *`,
        [
          titleEn,
          titleHi,
          descriptionEn || null,
          descriptionHi || null,
          examId,
          durationMinutes,
          totalMarks,
          marksPerQuestion,
          NO_NEGATIVE_MARKING_CATEGORIES.includes(category) ? 0 : negativeMarkingRatio,
          passingMarks,
          pricingType,
          status,
          availableFrom || null,
          availableUntil || null,
          category,
        ],
        { client },
      );

      if (!test) {
        throw new Error("Failed to insert test");
      }

      // Insert ordered test_questions rows
      for (let i = 0; i < questionIds.length; i++) {
        await queryOne(
          `INSERT INTO test_questions (test_id, question_id, question_order)
           VALUES ($1, $2, $3)`,
          [test.id, questionIds[i], i],
          { client },
        );
      }

      return test;
    });

    res.status(201).json({
      success: true,
      data: formatTest(result, questionIds.length),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to create test" },
    });
  }
}

/**
 * PUT /api/tests/:id
 * Update an existing test. Only provided fields are updated.
 * Optionally re-links questions if questionIds is provided.
 */
async function updateTest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body;

  // Build SET clause dynamically based on provided fields
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (body.titleEn !== undefined) {
    setClauses.push(`title_en = $${paramIndex++}`);
    params.push(body.titleEn);
  }
  if (body.titleHi !== undefined) {
    setClauses.push(`title_hi = $${paramIndex++}`);
    params.push(body.titleHi);
  }
  if (body.descriptionEn !== undefined) {
    setClauses.push(`description_en = $${paramIndex++}`);
    params.push(body.descriptionEn);
  }
  if (body.descriptionHi !== undefined) {
    setClauses.push(`description_hi = $${paramIndex++}`);
    params.push(body.descriptionHi);
  }
  if (body.examId !== undefined) {
    setClauses.push(`exam_id = $${paramIndex++}`);
    params.push(body.examId);
  }
  if (body.durationMinutes !== undefined) {
    setClauses.push(`duration_minutes = $${paramIndex++}`);
    params.push(body.durationMinutes);
  }
  if (body.totalMarks !== undefined) {
    setClauses.push(`total_marks = $${paramIndex++}`);
    params.push(body.totalMarks);
  }
  if (body.marksPerQuestion !== undefined) {
    setClauses.push(`marks_per_question = $${paramIndex++}`);
    params.push(body.marksPerQuestion);
  }
  if (body.negativeMarkingRatio !== undefined) {
    if (body.category !== undefined && NO_NEGATIVE_MARKING_CATEGORIES.includes(body.category)) {
      setClauses.push(`negative_marking_ratio = 0`);
    } else if (body.category !== undefined) {
      // Moving to a Test-section category: keep it 0 only for topic tests
      setClauses.push(`negative_marking_ratio = CASE WHEN topic_id IS NOT NULL THEN 0 ELSE $${paramIndex++} END`);
      params.push(body.negativeMarkingRatio);
    } else {
      // Category unchanged: topic tests and subject/topic categories stay at 0
      setClauses.push(`negative_marking_ratio = CASE WHEN topic_id IS NOT NULL OR category IN ('subject_wise', 'topic_wise') THEN 0 ELSE $${paramIndex++} END`);
      params.push(body.negativeMarkingRatio);
    }
  } else if (body.category !== undefined && NO_NEGATIVE_MARKING_CATEGORIES.includes(body.category)) {
    setClauses.push(`negative_marking_ratio = 0`);
  }
  if (body.passingMarks !== undefined) {
    setClauses.push(`passing_marks = $${paramIndex++}`);
    params.push(body.passingMarks);
  }
  if (body.pricingType !== undefined) {
    setClauses.push(`pricing_type = $${paramIndex++}`);
    params.push(body.pricingType);
  }
  if (body.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    params.push(body.status);
  }
  if (body.availableFrom !== undefined) {
    setClauses.push(`available_from = $${paramIndex++}`);
    params.push(body.availableFrom);
  }
  if (body.availableUntil !== undefined) {
    setClauses.push(`available_until = $${paramIndex++}`);
    params.push(body.availableUntil);
  }
  if (body.category !== undefined) {
    setClauses.push(`category = $${paramIndex++}`);
    params.push(body.category);
  }

  // Always update updated_at
  setClauses.push(`updated_at = NOW()`);

  // If only updated_at and no questionIds, nothing to do
  if (setClauses.length === 1 && body.questionIds === undefined) {
    res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "No fields to update" },
    });
    return;
  }

  try {
    const result = await withTransaction(async (client) => {
      let test: TestRow | null = null;

      if (setClauses.length > 1) {
        // There are actual field updates beyond updated_at
        test = await queryOne<TestRow>(
          `UPDATE tests SET ${setClauses.join(", ")}
           WHERE id = $${paramIndex}
           RETURNING *`,
          [...params, id],
          { client },
        );
      } else {
        // Only questionIds provided, just touch updated_at
        test = await queryOne<TestRow>(
          `UPDATE tests SET updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [id],
          { client },
        );
      }

      if (!test) {
        return null;
      }

      // Re-link questions if provided
      if (body.questionIds !== undefined) {
        await queryOne(
          `DELETE FROM test_questions WHERE test_id = $1`,
          [id],
          { client },
        );
        for (let i = 0; i < body.questionIds.length; i++) {
          await queryOne(
            `INSERT INTO test_questions (test_id, question_id, question_order)
             VALUES ($1, $2, $3)`,
            [id, body.questionIds[i], i],
            { client },
          );
        }
      }

      return test;
    });

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: "TEST_NOT_FOUND", message: "Test not found" },
      });
      return;
    }

    // Fetch question count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM test_questions WHERE test_id = $1`,
      [id],
    );
    const questionCount = parseInt(countResult?.count || "0", 10);

    res.status(200).json({
      success: true,
      data: formatTest(result, questionCount),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to update test" },
    });
  }
}

/**
 * GET /api/tests/:id
 * Get test details with question count.
 */
async function getTest(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const test = await queryOne<TestRow>(
      `SELECT * FROM tests WHERE id = $1`,
      [id],
    );

    if (!test) {
      res.status(404).json({
        success: false,
        error: { code: "TEST_NOT_FOUND", message: "Test not found" },
      });
      return;
    }

    // Fetch question count
    const countResult = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM test_questions WHERE test_id = $1`,
      [id],
    );
    const questionCount = parseInt(countResult?.count || "0", 10);

    res.status(200).json({
      success: true,
      data: formatTest(test, questionCount),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to get test" },
    });
  }
}

/**
 * GET /api/tests
 * List published tests for the authenticated user, filtered by their selected exam.
 * Query params: sort (newest|popular|difficulty), page, limit
 */
async function listTests(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  // Parse query params with defaults
  const sort = (req.query.sort as string) || "newest";
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

  // Validate sort option
  const validSorts: SortOption[] = ["newest", "popular", "difficulty"];
  const sortOption: SortOption = validSorts.includes(sort as SortOption)
    ? (sort as SortOption)
    : "newest";

  // Parse and validate category filter (Req 3.1, 3.4)
  // Invalid or missing category silently defaults to undefined (all categories)
  const rawCategory = req.query.category as string | undefined;
  const category: TestCategory | undefined =
    rawCategory && (VALID_CATEGORIES as readonly string[]).includes(rawCategory)
      ? (rawCategory as TestCategory)
      : undefined;

  // Parse and validate subject_id and topic_id query params (Req 6.1, 6.2, 6.7)
  // Invalid UUID formats are silently ignored (graceful degradation)
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const rawSubjectId = req.query.subject_id as string | undefined;
  const subjectId: string | undefined =
    rawSubjectId && UUID_REGEX.test(rawSubjectId) ? rawSubjectId : undefined;

  const rawTopicId = req.query.topic_id as string | undefined;
  let topicId: string | null | undefined;
  if (rawTopicId === "null") {
    // Explicit NULL filtering: get full subject tests only (topic_id IS NULL)
    topicId = null;
  } else if (rawTopicId && UUID_REGEX.test(rawTopicId)) {
    topicId = rawTopicId;
  } else {
    topicId = undefined;
  }

  try {
    // Fetch the user's selected_exam_id from the database
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

    const result = await getTestsForUser(
      userId,
      user.selected_exam_id,
      sortOption,
      page,
      limit,
      category,
      subjectId,
      topicId,
    );

    res.status(200).json({
      success: true,
      data: result.tests,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch tests" },
    });
  }
}

/**
 * GET /api/tests/:id/questions
 * Get questions for a test (used during test attempt to display questions).
 * Returns question text and options but NOT the correct answer.
 */
async function getTestQuestions(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const test = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM tests WHERE id = $1`,
      [id],
    );

    if (!test) {
      res.status(404).json({
        success: false,
        error: { code: "TEST_NOT_FOUND", message: "Test not found" },
      });
      return;
    }

    // Fetch questions in order (exclude correct_option for active attempts)
    const questions = await queryMany<{
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
      image_url: string | null;
      subject: string;
    }>(
      `SELECT q.id, q.text_en, q.text_hi, q.subject,
              q.option_a_en, q.option_a_hi,
              q.option_b_en, q.option_b_hi,
              q.option_c_en, q.option_c_hi,
              q.option_d_en, q.option_d_hi,
              q.image_url
       FROM test_questions tq
       JOIN questions q ON q.id = tq.question_id
       WHERE tq.test_id = $1
       ORDER BY tq.question_order ASC`,
      [id],
    );

    // Map to camelCase for frontend
    const data = questions.map((q) => ({
      id: q.id,
      subject: q.subject,
      textEn: q.text_en,
      textHi: q.text_hi,
      optionAEn: q.option_a_en,
      optionAHi: q.option_a_hi,
      optionBEn: q.option_b_en,
      optionBHi: q.option_b_hi,
      optionCEn: q.option_c_en,
      optionCHi: q.option_c_hi,
      optionDEn: q.option_d_en,
      optionDHi: q.option_d_hi,
      imageUrl: q.image_url,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch test questions" },
    });
  }
}

/**
 * GET /api/tests/full-test-slots/:subjectId
 * Returns 5 full test slots with their status for a subject.
 */
async function handleGetFullTestSlots(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const subjectId = req.params.subjectId as string;
    const slots = await getFullTestSlots(userId, subjectId);
    res.status(200).json({ success: true, data: slots });
  } catch (error) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to get full test slots" } });
  }
}

/**
 * POST /api/tests/full-test-generate
 * Generate (or retrieve) a dynamic full test for a slot.
 * Body: { subjectId, slotNumber }
 */
async function handleGenerateFullTest(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { subjectId, slotNumber } = req.body;
    if (!subjectId || !slotNumber) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "subjectId and slotNumber required" } });
      return;
    }
    const testId = await generateFullTest(userId, subjectId, slotNumber);
    res.status(200).json({ success: true, data: { testId, slotNumber } });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
    } else {
      res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to generate full test" } });
    }
  }
}

/**
 * GET /api/tests/subject-tree
 * Returns subject → topic → tests hierarchy with stats for the authenticated user.
 */
async function getSubjectTree(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  try {
    // 1. Get user's selected exam
    const user = await queryOne<{ selected_exam_id: string | null }>(
      `SELECT selected_exam_id FROM users WHERE id = $1`,
      [userId],
    );

    if (!user || !user.selected_exam_id) {
      res.status(400).json({
        success: false,
        error: { code: "NO_EXAM_SELECTED", message: "User has not selected an exam" },
      });
      return;
    }

    const examId = user.selected_exam_id;

    // 2. Get all subjects for this exam with accuracy stats
    const subjects = await queryMany<{
      id: string;
      name_en: string;
      name_hi: string;
      display_order: number;
    }>(
      `SELECT id, name_en, name_hi, display_order
       FROM subjects
       WHERE exam_id = $1
       ORDER BY display_order ASC`,
      [examId],
    );

    // 3. Build the tree for each subject
    const subjectsData = await Promise.all(
      subjects.map(async (subject) => {
        // Get accuracy for this subject (avg percentage across all completed attempts for tests in this subject)
        const accuracyRow = await queryOne<{ accuracy: string | null }>(
          `SELECT ROUND(AVG(ta.percentage), 0) as accuracy
           FROM test_attempts ta
           JOIN tests ts ON ts.id = ta.test_id
           WHERE ta.user_id = $1
             AND ts.subject_id = $2
             AND ta.status IN ('submitted', 'auto_submitted')`,
          [userId, subject.id],
        );

        // Get total and completed test counts for this subject
        const countsRow = await queryOne<{ total_tests: string; completed_tests: string }>(
          `SELECT
             COUNT(DISTINCT ts.id) as total_tests,
             COUNT(DISTINCT CASE WHEN ta.id IS NOT NULL THEN ts.id END) as completed_tests
           FROM tests ts
           LEFT JOIN test_attempts ta ON ta.test_id = ts.id
             AND ta.user_id = $1
             AND ta.status IN ('submitted', 'auto_submitted')
           WHERE ts.subject_id = $2
             AND ts.status = 'published'
             AND ts.category = 'subject_wise'`,
          [userId, subject.id],
        );

        // Get topics for this subject
        const topics = await queryMany<{
          id: string;
          name_en: string;
          name_hi: string;
          display_order: number;
        }>(
          `SELECT id, name_en, name_hi, display_order
           FROM topics
           WHERE subject_id = $1
           ORDER BY display_order ASC`,
          [subject.id],
        );

        // For each topic, get tests with attempt info
        const topicsData = await Promise.all(
          topics.map(async (topic) => {
            const tests = await queryMany<{
              id: string;
              title_en: string;
              title_hi: string;
              duration_minutes: number;
              total_marks: number;
              passing_marks: number;
              negative_marking_ratio: string;
              marks_per_question: string;
              question_count: string;
              attempt_status: string | null;
              best_percentage: string | null;
              attempt_count: string;
              last_attempt_id: string | null;
              passed: boolean | null;
            }>(
              `SELECT
                 ts.id,
                 ts.title_en,
                 ts.title_hi,
                 ts.duration_minutes,
                 ts.total_marks,
                 ts.passing_marks,
                 ts.negative_marking_ratio::text AS negative_marking_ratio,
                 ts.marks_per_question::text AS marks_per_question,
                 (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = ts.id)::text as question_count,
                 -- Attempt status
                 CASE
                   WHEN EXISTS (
                     SELECT 1 FROM test_attempts ta
                     WHERE ta.test_id = ts.id AND ta.user_id = $1
                       AND ta.status IN ('submitted', 'auto_submitted')
                   ) THEN 'completed'
                   WHEN EXISTS (
                     SELECT 1 FROM test_attempts ta
                     WHERE ta.test_id = ts.id AND ta.user_id = $1
                       AND ta.status = 'in_progress'
                   ) THEN 'in_progress'
                   ELSE 'not_attempted'
                 END as attempt_status,
                 -- Best percentage (from best attempt)
                 (SELECT ta.percentage::text
                  FROM test_attempts ta
                  WHERE ta.test_id = ts.id AND ta.user_id = $1
                    AND ta.status IN ('submitted', 'auto_submitted')
                  ORDER BY ta.percentage DESC NULLS LAST, ta.created_at DESC
                  LIMIT 1
                 ) as best_percentage,
                 -- Attempt count
                 (SELECT COUNT(*)::text
                  FROM test_attempts ta
                  WHERE ta.test_id = ts.id AND ta.user_id = $1
                    AND ta.status IN ('submitted', 'auto_submitted')
                 ) as attempt_count,
                 -- Last attempt ID (most recent completed)
                 (SELECT ta.id::text
                  FROM test_attempts ta
                  WHERE ta.test_id = ts.id AND ta.user_id = $1
                    AND ta.status IN ('submitted', 'auto_submitted')
                  ORDER BY ta.created_at DESC
                  LIMIT 1
                 ) as last_attempt_id,
                 -- Passed/failed based on best attempt
                 (SELECT CASE
                   WHEN ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100)
                   THEN true ELSE false END
                  FROM test_attempts ta
                  WHERE ta.test_id = ts.id AND ta.user_id = $1
                    AND ta.status IN ('submitted', 'auto_submitted')
                  ORDER BY ta.percentage DESC NULLS LAST, ta.created_at DESC
                  LIMIT 1
                 ) as passed
               FROM tests ts
               WHERE ts.topic_id = $2
                 AND ts.status = 'published'
                 AND ts.category = 'subject_wise'
               ORDER BY ts.title_en ASC`,
              [userId, topic.id],
            );

            return {
              id: topic.id,
              nameEn: topic.name_en,
              nameHi: topic.name_hi,
              tests: tests.map((t) => ({
                id: t.id,
                titleEn: t.title_en,
                titleHi: t.title_hi,
                questionCount: parseInt(t.question_count, 10),
                duration: t.duration_minutes,
                totalMarks: t.total_marks,
                negativeMarkingRatio: parseFloat(t.negative_marking_ratio),
                marksPerQuestion: parseFloat(t.marks_per_question),
                attemptStatus: t.attempt_status || 'not_attempted',
                passed: t.passed,
                bestPercentage: t.best_percentage ? parseFloat(t.best_percentage) : null,
                attemptCount: parseInt(t.attempt_count, 10),
                maxAttempts: 5,
                lastAttemptId: t.last_attempt_id,
              })),
            };
          }),
        );

        // Get full-subject tests (topic_id IS NULL — mixed topic tests for the whole subject)
        const fullSubjectTests = await queryMany<{
          id: string;
          title_en: string;
          title_hi: string;
          duration_minutes: number;
          total_marks: number;
          passing_marks: number;
          question_count: string;
          attempt_status: string | null;
          best_percentage: string | null;
          attempt_count: string;
          last_attempt_id: string | null;
          passed: boolean | null;
        }>(
          `SELECT
             ts.id, ts.title_en, ts.title_hi, ts.duration_minutes, ts.total_marks, ts.passing_marks,
             (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = ts.id)::text as question_count,
             CASE
               WHEN EXISTS (SELECT 1 FROM test_attempts ta WHERE ta.test_id = ts.id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted')) THEN 'completed'
               WHEN EXISTS (SELECT 1 FROM test_attempts ta WHERE ta.test_id = ts.id AND ta.user_id = $1 AND ta.status = 'in_progress') THEN 'in_progress'
               ELSE 'not_attempted'
             END as attempt_status,
             (SELECT ta.percentage::text FROM test_attempts ta WHERE ta.test_id = ts.id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.percentage DESC NULLS LAST, ta.created_at DESC LIMIT 1) as best_percentage,
             (SELECT COUNT(*)::text FROM test_attempts ta WHERE ta.test_id = ts.id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted')) as attempt_count,
             (SELECT ta.id::text FROM test_attempts ta WHERE ta.test_id = ts.id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.created_at DESC LIMIT 1) as last_attempt_id,
             (SELECT CASE WHEN ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100) THEN true ELSE false END FROM test_attempts ta WHERE ta.test_id = ts.id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.percentage DESC NULLS LAST, ta.created_at DESC LIMIT 1) as passed
           FROM tests ts
           WHERE ts.subject_id = $2
             AND ts.topic_id IS NULL
             AND ts.status = 'published'
             AND ts.category = 'subject_wise'
           ORDER BY ts.title_en ASC`,
          [userId, subject.id],
        );

        return {
          id: subject.id,
          nameEn: subject.name_en,
          nameHi: subject.name_hi,
          accuracy: accuracyRow?.accuracy ? parseInt(accuracyRow.accuracy, 10) : null,
          totalTests: parseInt(countsRow?.total_tests || "0", 10),
          completedTests: parseInt(countsRow?.completed_tests || "0", 10),
          fullSubjectTests: fullSubjectTests.map((t) => ({
            id: t.id,
            titleEn: t.title_en,
            titleHi: t.title_hi,
            questionCount: parseInt(t.question_count, 10),
            duration: t.duration_minutes,
            totalMarks: t.total_marks,
            attemptStatus: t.attempt_status || 'not_attempted',
            passed: t.passed,
            bestPercentage: t.best_percentage ? parseFloat(t.best_percentage) : null,
            attemptCount: parseInt(t.attempt_count, 10),
            maxAttempts: 5,
            lastAttemptId: t.last_attempt_id,
          })),
          topics: topicsData,
        };
      }),
    );

    res.status(200).json({
      success: true,
      subjects: subjectsData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to fetch subject tree" },
    });
  }
}

// ─── Router ───────────────────────────────────────────────────────────

const router = Router();

// All routes require JWT authentication
router.use(jwtAuth);

router.post("/", requireRole('admin', 'super_admin'), validate(createTestSchema), createTest);
router.put("/:id", requireRole('admin', 'super_admin'), validate(updateTestSchema), updateTest);
router.get("/subject-tree", getSubjectTree);
router.get("/full-test-slots/:subjectId", handleGetFullTestSlots);
router.post("/full-test-generate", handleGenerateFullTest);
router.get("/", listTests);
router.get("/:id", getTest);
router.get("/:id/questions", getTestQuestions);

export default router;
