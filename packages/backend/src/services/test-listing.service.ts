/**
 * Test Listing Service — Handles querying and filtering published tests
 * for authenticated users, with sorting and pagination support.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { queryMany, queryOne } from "@/db/index.js";
import type { TestCategory } from "@/schemas/test.schema.js";

// ─── Types ────────────────────────────────────────────────────────────

/** A single test item in the listing response. */
export interface TestListItem {
  id: string;
  titleEn: string;
  titleHi: string;
  duration: number;
  totalQuestions: number;
  totalMarks: number;
  pricingType: "free" | "premium";
  attemptStatus: "not_attempted" | "in_progress" | "completed";
  lastScore?: number;
  lastAttemptId?: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: Date;
  category: TestCategory;
  subjectId: string | null;
  topicId: string | null;
  subjectNameEn: string | null;
  subjectNameHi: string | null;
  topicNameEn: string | null;
  topicNameHi: string | null;
  lastAttemptedAt: string | null;
  bestPercentage: number | null;
  /** Marks deducted per wrong answer, as a fraction of marksPerQuestion (0 = no negative marking). */
  negativeMarkingRatio: number;
  marksPerQuestion: number;
}

/** Available sort options for test listing. */
export type SortOption = "newest" | "popular" | "difficulty";

// ─── Service ──────────────────────────────────────────────────────────

/**
 * Retrieve published tests for a user, filtered by exam and schedule window.
 *
 * - Base filter: status = 'published', exam_id matches, schedule window active
 * - Joins test_questions for question count
 * - Joins test_attempts for the user's attempt status and last score
 * - Supports sorting by newest, popular, or difficulty
 * - Returns paginated results with total count
 *
 * @param userId - The authenticated user's ID
 * @param examId - The exam ID to filter tests by
 * @param sort - Sort option: 'newest', 'popular', or 'difficulty'
 * @param page - Page number (1-based)
 * @param limit - Number of results per page
 * @param category - Optional category filter; when provided, only tests with this category are returned
 * @param subjectId - Optional subject filter; when provided, only tests with this subject_id are returned
 * @param topicId - Optional topic filter; undefined = no filter, UUID string = filter by topic, null = filter for topic_id IS NULL (full subject tests only)
 * @returns Object with tests array and total count
 */
export async function getTestsForUser(
  userId: string,
  examId: string,
  sort: SortOption,
  page: number,
  limit: number,
  category?: TestCategory,
  subjectId?: string,
  topicId?: string | null
): Promise<{ tests: TestListItem[]; total: number }> {
  const offset = (page - 1) * limit;

  // Determine ORDER BY clause based on sort option
  const orderByClause = buildOrderByClause(sort);

  // Build dynamic params and category filter clause
  const params: (string | number)[] = [userId, examId, limit, offset];
  let categoryClause = "";
  if (category !== undefined) {
    params.push(category);
    categoryClause = `AND t.category = $${params.length}`;
  }

  // Build subject filter clause
  let subjectClause = "";
  if (subjectId !== undefined) {
    params.push(subjectId);
    subjectClause = `AND t.subject_id = $${params.length}`;
  }

  // Build topic filter clause
  let topicClause = "";
  if (topicId === null) {
    // Explicitly filter for topic_id IS NULL (full subject tests only)
    topicClause = `AND t.topic_id IS NULL`;
  } else if (topicId !== undefined) {
    // Filter by specific topic UUID
    params.push(topicId);
    topicClause = `AND t.topic_id = $${params.length}`;
  }

  // Main query: fetch tests with question count and attempt status
  const sql = `
    SELECT
      t.id,
      t.title_en,
      t.title_hi,
      t.duration_minutes,
      t.total_marks,
      t.negative_marking_ratio,
      t.marks_per_question,
      t.pricing_type,
      t.created_at,
      t.attempt_count,
      t.category,
      t.subject_id,
      t.topic_id,
      s.name_en AS subject_name_en,
      s.name_hi AS subject_name_hi,
      top.name_en AS topic_name_en,
      top.name_hi AS topic_name_hi,
      COALESCE(tq_counts.question_count, 0)::int AS question_count,
      latest_attempt.status AS attempt_status,
      latest_attempt.total_score AS last_score,
      latest_attempt.attempt_id AS last_attempt_id,
      latest_attempt.best_pct AS best_percentage,
      COALESCE(attempt_counts.completed_count, 0) AS user_attempt_count,
      last_activity.last_attempted_at
    FROM tests t
    LEFT JOIN subjects s ON s.id = t.subject_id
    LEFT JOIN topics top ON top.id = t.topic_id
    LEFT JOIN (
      SELECT test_id, COUNT(*)::int AS question_count
      FROM test_questions
      GROUP BY test_id
    ) tq_counts ON tq_counts.test_id = t.id
    LEFT JOIN LATERAL (
      SELECT ta.id AS attempt_id, ta.status, ta.total_score, ta.percentage AS best_pct
      FROM test_attempts ta
      WHERE ta.test_id = t.id AND ta.user_id = $1
        AND ta.status IN ('submitted', 'auto_submitted')
      ORDER BY ta.percentage DESC NULLS LAST, ta.started_at DESC
      LIMIT 1
    ) latest_attempt ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS completed_count
      FROM test_attempts ta2
      WHERE ta2.test_id = t.id AND ta2.user_id = $1
        AND ta2.status IN ('submitted', 'auto_submitted')
    ) attempt_counts ON true
    LEFT JOIN LATERAL (
      SELECT MAX(ta3.submitted_at) AS last_attempted_at
      FROM test_attempts ta3
      WHERE ta3.test_id = t.id AND ta3.user_id = $1
        AND ta3.status IN ('submitted', 'auto_submitted')
    ) last_activity ON true
    WHERE t.status = 'published'
      AND t.exam_id = $2
      AND (t.available_from IS NULL OR t.available_from <= NOW())
      AND (t.available_until IS NULL OR t.available_until >= NOW())
      AND NOT EXISTS (SELECT 1 FROM dynamic_full_tests dft WHERE dft.test_id = t.id AND dft.user_id = $1)
      ${categoryClause}
      ${subjectClause}
      ${topicClause}
    ${orderByClause}
    LIMIT $3 OFFSET $4
  `;

  const rows = await queryMany<{
    id: string;
    title_en: string;
    title_hi: string;
    duration_minutes: number;
    total_marks: number;
    pricing_type: "free" | "premium";
    created_at: Date;
    attempt_count: number;
    category: TestCategory;
    subject_id: string | null;
    topic_id: string | null;
    subject_name_en: string | null;
    subject_name_hi: string | null;
    topic_name_en: string | null;
    topic_name_hi: string | null;
    question_count: number;
    negative_marking_ratio: number | string;
    marks_per_question: number | string;
    attempt_status: string | null;
    last_score: number | null;
    last_attempt_id: string | null;
    best_percentage: number | null;
    user_attempt_count: number;
    last_attempted_at: string | null;
  }>(sql, params);

  // Count query for pagination (with category, subject, and topic filters when applicable)
  const countParams: (string | number)[] = [userId, examId];
  let countCategoryClause = "";
  if (category !== undefined) {
    countParams.push(category);
    countCategoryClause = `AND t.category = $${countParams.length}`;
  }

  let countSubjectClause = "";
  if (subjectId !== undefined) {
    countParams.push(subjectId);
    countSubjectClause = `AND t.subject_id = $${countParams.length}`;
  }

  let countTopicClause = "";
  if (topicId === null) {
    countTopicClause = `AND t.topic_id IS NULL`;
  } else if (topicId !== undefined) {
    countParams.push(topicId);
    countTopicClause = `AND t.topic_id = $${countParams.length}`;
  }

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM tests t
     WHERE t.status = 'published'
       AND t.exam_id = $2
       AND (t.available_from IS NULL OR t.available_from <= NOW())
       AND (t.available_until IS NULL OR t.available_until >= NOW())
       AND NOT EXISTS (SELECT 1 FROM dynamic_full_tests dft WHERE dft.test_id = t.id AND dft.user_id = $1)
       ${countCategoryClause}
       ${countSubjectClause}
       ${countTopicClause}`,
    countParams
  );

  const total = countRow ? parseInt(countRow.total, 10) : 0;

  // Map rows to TestListItem interface
  const tests: TestListItem[] = rows.map((row) => {
    const attemptStatus = deriveAttemptStatus(row.attempt_status);
    const item: TestListItem = {
      id: row.id,
      titleEn: row.title_en,
      titleHi: row.title_hi,
      duration: row.duration_minutes,
      totalQuestions: row.question_count,
      totalMarks: row.total_marks,
      negativeMarkingRatio: Number(row.negative_marking_ratio),
      marksPerQuestion: Number(row.marks_per_question),
      pricingType: row.pricing_type,
      attemptStatus,
      attemptCount: Number(row.user_attempt_count),
      maxAttempts: 5,
      createdAt: row.created_at,
      category: row.category,
      subjectId: row.subject_id,
      topicId: row.topic_id,
      subjectNameEn: row.subject_name_en,
      subjectNameHi: row.subject_name_hi,
      topicNameEn: row.topic_name_en,
      topicNameHi: row.topic_name_hi,
      lastAttemptedAt: row.last_attempted_at,
      bestPercentage: row.best_percentage != null ? Math.round(Number(row.best_percentage)) : null,
    };

    if (attemptStatus === "completed" && row.last_score !== null) {
      item.lastScore = Number(row.last_score);
    }

    if (row.last_attempt_id) {
      item.lastAttemptId = row.last_attempt_id;
    }

    return item;
  });

  return { tests, total };
}

// ─── Private Helpers ──────────────────────────────────────────────────

/**
 * Build the ORDER BY clause based on the sort option.
 */
function buildOrderByClause(sort: SortOption): string {
  switch (sort) {
    case "newest":
      return "ORDER BY last_activity.last_attempted_at DESC NULLS LAST, t.created_at DESC";
    case "popular":
      return "ORDER BY t.attempt_count DESC";
    case "difficulty":
      // Subquery: average difficulty of questions in the test
      // Maps: easy=1, medium=2, hard=3, orders by descending average
      return `ORDER BY (
        SELECT COALESCE(AVG(
          CASE q.difficulty
            WHEN 'easy' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'hard' THEN 3
          END
        ), 0)
        FROM test_questions tq_sort
        JOIN questions q ON q.id = tq_sort.question_id
        WHERE tq_sort.test_id = t.id
      ) DESC`;
    default:
      return "ORDER BY last_activity.last_attempted_at DESC NULLS LAST, t.created_at DESC";
  }
}

/**
 * Derive the user-facing attempt status from the database status value.
 *
 * - null → 'not_attempted' (no attempt exists)
 * - 'in_progress' → 'in_progress'
 * - 'submitted' or 'auto_submitted' → 'completed'
 */
function deriveAttemptStatus(
  dbStatus: string | null
): "not_attempted" | "in_progress" | "completed" {
  if (dbStatus === null) {
    return "not_attempted";
  }
  if (dbStatus === "in_progress") {
    return "in_progress";
  }
  // 'submitted' or 'auto_submitted'
  return "completed";
}
