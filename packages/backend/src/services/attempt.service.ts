/**
 * Attempt Service — Manages starting test attempts, saving answers,
 * and submitting tests with score calculation.
 *
 * Requirements: 4.1, 4.5, 4.6, 5.1
 */

import { withTransaction, queryOne, queryMany } from "@/db/index.js";
import { AppError } from "@/errors/index.js";
import { redis } from "@/redis/client.js";
import {
  calculateScore,
  type ScoreResult,
  type AttemptAnswer,
  type Question,
} from "@/services/score-calculator.service.js";

// ─── Constants ────────────────────────────────────────────────────────

/** Cooldown period in hours between consecutive attempts of the same test. */
export const COOLDOWN_HOURS = 24;

/** Cooldown period in milliseconds. */
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

/** Maximum number of attempts allowed per user per test. */
export const MAX_ATTEMPTS_PER_TEST = 5;

// ─── Types ────────────────────────────────────────────────────────────

/** Represents a test attempt record from the database. */
export interface TestAttempt {
  id: string;
  user_id: string;
  test_id: string;
  started_at: Date;
  ends_at: Date;
  submitted_at: Date | null;
  status: "in_progress" | "submitted" | "auto_submitted";
  total_score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  skipped_count: number | null;
  percentage: number | null;
  time_taken_seconds: number | null;
  created_at: Date;
}

// ─── Pure Helpers (exported for property testing) ─────────────────────

/**
 * Determines whether the cooldown period is still active given a submission time.
 *
 * @param submittedAt - When the last attempt was submitted
 * @param now - The current timestamp
 * @param cooldownMs - Cooldown duration in milliseconds
 * @returns true if cooldown is still active (attempt should be blocked)
 */
export function isCooldownActive(
  submittedAt: Date,
  now: Date,
  cooldownMs: number
): boolean {
  return now.getTime() - submittedAt.getTime() < cooldownMs;
}

// ─── Service Functions ────────────────────────────────────────────────

/**
 * Start a new test attempt for a user.
 *
 * Steps:
 * 1. Verify test exists and is published
 * 2. Check 24h cooldown since last submission
 * 3. Return existing in-progress attempt if one exists
 * 4. Create test_attempts record with timing
 * 5. Pre-create attempt_answers rows for all questions
 * 6. Cache timer in Redis
 * 7. Return the attempt record
 *
 * @param userId - The authenticated user's ID
 * @param testId - The test to attempt
 * @returns The created (or existing in-progress) TestAttempt
 *
 * Requirements: 4.1, 4.6
 */
export async function startAttempt(
  userId: string,
  testId: string
): Promise<TestAttempt> {
  // 1. Fetch the test and verify it exists & is published
  const test = await queryOne<{
    id: string;
    duration_minutes: number;
    status: string;
  }>(
    `SELECT id, duration_minutes, status FROM tests WHERE id = $1`,
    [testId]
  );

  if (!test) {
    throw new AppError("Test does not exist", "TEST_NOT_FOUND", 404);
  }

  if (test.status !== "published") {
    throw new AppError(
      "Test is not currently available",
      "TEST_NOT_AVAILABLE",
      403
    );
  }

  // 2. Check cooldown: most recent submitted/auto_submitted attempt
  // Cooldown disabled — retakes limited by MAX_ATTEMPTS_PER_TEST instead

  // 3. Check for existing in-progress attempt — return if still valid, auto-submit if expired
  const existingAttempt = await queryOne<TestAttempt>(
    `SELECT * FROM test_attempts
     WHERE user_id = $1 AND test_id = $2 AND status = 'in_progress'
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId, testId]
  );

  if (existingAttempt) {
    // Check if expired
    const endsAt = new Date(existingAttempt.ends_at).getTime();
    if (Date.now() > endsAt) {
      // Expired abandoned attempt — delete it entirely (doesn't count as an attempt)
      await queryOne(`DELETE FROM attempt_answers WHERE attempt_id = $1`, [existingAttempt.id]);
      await queryOne(`DELETE FROM test_attempts WHERE id = $1 AND status = 'in_progress'`, [existingAttempt.id]);
      // Fall through to create a new attempt
    } else {
      // Still valid — return existing attempt
      return existingAttempt;
    }
  }

  // 3b. Check max attempts limit (5 per user per test)
  // Note: Also re-checked inside transaction to prevent race conditions
  const attemptCountRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM test_attempts
     WHERE user_id = $1 AND test_id = $2
       AND status IN ('submitted', 'auto_submitted')`,
    [userId, testId]
  );

  const totalAttempts = parseInt(attemptCountRow?.count || "0", 10);
  if (totalAttempts >= MAX_ATTEMPTS_PER_TEST) {
    throw new AppError(
      `Maximum ${MAX_ATTEMPTS_PER_TEST} attempts allowed per test`,
      "MAX_ATTEMPTS_REACHED",
      403
    );
  }

  // 4-6. Create attempt, pre-create answers, cache timer — all in a transaction
  const attempt = await withTransaction(async (client) => {
    // Re-check count inside transaction with advisory lock to prevent race conditions
    const lockKey = Buffer.from(userId.replace(/-/g, '').slice(0, 8) + testId.replace(/-/g, '').slice(0, 8), 'hex');
    await client.query(`SELECT pg_advisory_xact_lock($1)`, [parseInt(lockKey.toString('hex').slice(0, 15), 16) || Date.now()]);

    const txCountRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM test_attempts
       WHERE user_id = $1 AND test_id = $2
         AND status IN ('submitted', 'auto_submitted')`,
      [userId, testId],
      { client }
    );
    const txCount = parseInt(txCountRow?.count || "0", 10);
    if (txCount >= MAX_ATTEMPTS_PER_TEST) {
      throw new AppError(
        `Maximum ${MAX_ATTEMPTS_PER_TEST} attempts allowed per test`,
        "MAX_ATTEMPTS_REACHED",
        403
      );
    }

    // 4. Create test_attempts record
    const createdAttempt = await queryOne<TestAttempt>(
      `INSERT INTO test_attempts (user_id, test_id, started_at, ends_at, status)
       VALUES ($1, $2, NOW(), NOW() + ($3 || ' minutes')::interval, 'in_progress')
       RETURNING *`,
      [userId, testId, String(test.duration_minutes)],
      { client }
    );

    if (!createdAttempt) {
      throw new AppError(
        "Failed to create attempt",
        "ATTEMPT_CREATION_FAILED",
        500
      );
    }

    // 5. Fetch all test_questions ordered by question_order
    const questions = await queryMany<{
      question_id: string;
      question_order: number;
    }>(
      `SELECT question_id, question_order FROM test_questions
       WHERE test_id = $1
       ORDER BY question_order ASC`,
      [testId],
      { client }
    );

    // Pre-create attempt_answers rows for each question
    if (questions.length > 0) {
      const valuesClauses: string[] = [];
      const params: unknown[] = [createdAttempt.id];
      let paramIndex = 2;

      for (const q of questions) {
        valuesClauses.push(
          `($1, $${paramIndex}, $${paramIndex + 1}, NULL, false)`
        );
        params.push(q.question_id, q.question_order);
        paramIndex += 2;
      }

      await client.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, question_order, selected_option, marked_for_review)
         VALUES ${valuesClauses.join(", ")}`,
        params
      );
    }

    return createdAttempt;
  });

  // 7. Cache timer in Redis
  const ttlSeconds = test.duration_minutes * 60;
  const redisKey = `attempt:${attempt.id}:timer`;
  await redis.set(redisKey, attempt.ends_at.toISOString(), "EX", ttlSeconds);

  return attempt;
}

/**
 * Save (or update) a user's answer for a specific question in an attempt.
 *
 * Steps:
 * 1. Fetch the attempt and verify it exists and is still in_progress
 * 2. Verify the attempt hasn't expired (current time <= ends_at)
 * 3. Update the attempt_answers row for the given question_order
 * 4. If no row matches, throw INVALID_QUESTION_INDEX
 *
 * @param attemptId - The attempt to save the answer for
 * @param questionIndex - The question_order (0-based index) within the attempt
 * @param selectedOption - The selected option index (0-3) or null to clear
 * @param markedForReview - Whether the question is marked for review
 *
 * Requirements: 4.7
 */
export async function saveAnswer(
  attemptId: string,
  questionIndex: number,
  selectedOption: number | null,
  markedForReview: boolean
): Promise<void> {
  // 1. Fetch the attempt and verify status
  const attempt = await queryOne<Pick<TestAttempt, "id" | "status" | "ends_at">>(
    `SELECT id, status, ends_at FROM test_attempts WHERE id = $1`,
    [attemptId]
  );

  if (!attempt) {
    throw new AppError("Attempt does not exist", "ATTEMPT_NOT_FOUND", 404);
  }

  if (attempt.status !== "in_progress") {
    throw new AppError(
      "Test has already been submitted",
      "ATTEMPT_ALREADY_SUBMITTED",
      409
    );
  }

  // 2. Verify the attempt hasn't expired
  const now = new Date();
  if (now > new Date(attempt.ends_at)) {
    throw new AppError(
      "Test time has expired",
      "ATTEMPT_TIME_EXPIRED",
      403
    );
  }

  // 3. Update the attempt_answers row for the given question_order
  const result = await queryOne<{ id: string }>(
    `UPDATE attempt_answers
     SET selected_option = $1,
         marked_for_review = $2,
         answered_at = NOW()
     WHERE attempt_id = $3 AND question_order = $4
     RETURNING id`,
    [selectedOption, markedForReview, attemptId, questionIndex]
  );

  // 4. If no row was updated, the question_order doesn't exist for this attempt
  if (!result) {
    throw new AppError(
      "Question index out of range",
      "INVALID_QUESTION_INDEX",
      400
    );
  }
}

/**
 * Submit a test attempt — calculate score and finalize the attempt.
 *
 * Steps:
 * 1. Fetch the attempt and verify it exists and is in_progress
 * 2. Fetch the test configuration (marks, negative marking, passing marks)
 * 3. Fetch all attempt_answers for this attempt
 * 4. Fetch the test's questions (correct_option and subject)
 * 5. Calculate score using calculateScore
 * 6. Update test_attempts with score results and status
 * 7. Increment tests.attempt_count
 * 8. Delete Redis timer key
 * 9. Return the ScoreResult
 *
 * @param attemptId - The attempt to submit
 * @param submitStatus - The status to set ('submitted' or 'auto_submitted')
 * @returns ScoreResult with all computed fields
 *
 * Requirements: 4.5, 5.1
 */
export async function submitAttempt(
  attemptId: string,
  submitStatus: "submitted" | "auto_submitted" = "submitted"
): Promise<ScoreResult> {
  // 1. Fetch the attempt and verify it exists and is in_progress
  const attempt = await queryOne<{
    id: string;
    test_id: string;
    status: string;
    started_at: Date;
  }>(
    `SELECT id, test_id, status, started_at FROM test_attempts WHERE id = $1`,
    [attemptId]
  );

  if (!attempt) {
    throw new AppError("Attempt does not exist", "ATTEMPT_NOT_FOUND", 404);
  }

  if (attempt.status !== "in_progress") {
    throw new AppError(
      "Test has already been submitted",
      "ATTEMPT_ALREADY_SUBMITTED",
      409
    );
  }

  // 2. Fetch the test configuration
  const test = await queryOne<{
    id: string;
    marks_per_question: number;
    negative_marking_ratio: number;
    passing_marks: number;
    total_marks: number;
  }>(
    `SELECT id, marks_per_question, negative_marking_ratio, passing_marks, total_marks FROM tests WHERE id = $1`,
    [attempt.test_id]
  );

  if (!test) {
    throw new AppError("Test does not exist", "TEST_NOT_FOUND", 404);
  }

  // 3. Fetch all attempt_answers for this attempt
  const answers = await queryMany<AttemptAnswer>(
    `SELECT question_id, question_order, selected_option, marked_for_review
     FROM attempt_answers
     WHERE attempt_id = $1
     ORDER BY question_order ASC`,
    [attemptId]
  );

  // 4. Fetch the test's questions (correct_option and subject)
  const questions = await queryMany<Question>(
    `SELECT q.id, q.correct_option, q.subject
     FROM test_questions tq
     JOIN questions q ON q.id = tq.question_id
     WHERE tq.test_id = $1
     ORDER BY tq.question_order ASC`,
    [attempt.test_id]
  );

  // 5. Calculate time taken and score
  const now = new Date();
  const timeTakenSeconds = Math.floor(
    (now.getTime() - new Date(attempt.started_at).getTime()) / 1000
  );

  // Pass mark is stored against total_marks, which can be larger than questions x marks per question,
  // so scale it to the real maximum (same rule as the results page and the dashboard).
  const realMax = questions.length * Number(test.marks_per_question);
  const passingMarks =
    Number(test.total_marks) > 0
      ? (Number(test.passing_marks) / Number(test.total_marks)) * realMax
      : Number(test.passing_marks);

  const scoreResult = calculateScore(
    answers,
    questions,
    Number(test.marks_per_question),
    Number(test.negative_marking_ratio),
    passingMarks,
    timeTakenSeconds
  );

  // 6. Update test_attempts with score results and status
  await queryOne(
    `UPDATE test_attempts
     SET status = $1,
         submitted_at = NOW(),
         total_score = $2,
         correct_count = $3,
         wrong_count = $4,
         skipped_count = $5,
         percentage = $6,
         time_taken_seconds = $7
     WHERE id = $8
     RETURNING id`,
    [
      submitStatus,
      scoreResult.totalScore,
      scoreResult.correctCount,
      scoreResult.wrongCount,
      scoreResult.skippedCount,
      scoreResult.percentage,
      scoreResult.timeTakenSeconds,
      attemptId,
    ]
  );

  // 7. Increment tests.attempt_count
  await queryOne(
    `UPDATE tests SET attempt_count = attempt_count + 1 WHERE id = $1 RETURNING id`,
    [attempt.test_id]
  );

  // 8. Delete Redis timer key
  await redis.del(`attempt:${attemptId}:timer`);

  // 9. Return the ScoreResult
  return scoreResult;
}

/**
 * Check if an attempt has expired and auto-submit if so.
 * This is called from route handlers when fetching current attempt status.
 *
 * @param attemptId - The attempt to check
 * @returns ScoreResult if auto-submitted, null if still in progress
 *
 * Requirements: 4.4
 */
export async function autoSubmitIfExpired(attemptId: string): Promise<ScoreResult | null> {
  const attempt = await queryOne<Pick<TestAttempt, "id" | "status" | "ends_at">>(
    `SELECT id, status, ends_at FROM test_attempts WHERE id = $1`,
    [attemptId]
  );

  if (!attempt || attempt.status !== "in_progress") {
    return null;
  }

  const now = new Date();
  if (now > new Date(attempt.ends_at)) {
    // Time expired — auto-submit
    return submitAttempt(attemptId, "auto_submitted");
  }

  return null; // Still in progress
}
