/**
 * Dynamic Full Test Service — Generates subject-level full tests dynamically.
 *
 * Each subject has 5 "Full Test" slots. Each slot generates random questions
 * from all topics of that subject, excluding questions already used in
 * previous slots (no repetition across tests).
 *
 * - 5 test slots per subject per user
 * - 30 questions per test (or max available)
 * - 2 reattempts per test (same questions on reattempt)
 * - Questions locked once generated for a slot
 */

import { queryOne, queryMany } from "@/db/query.js";
import { AppError } from "@/errors/index.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface FullTestSlot {
  slotNumber: number;
  status: 'not_started' | 'generated' | 'completed';
  questionCount: number;
  attemptCount: number;
  maxAttempts: number;
  bestPercentage: number | null;
  passed: boolean | null;
  lastAttemptId: string | null;
}

export interface FullTestStartResult {
  testId: string;
  questionIds: string[];
  slotNumber: number;
}

// ─── Constants ────────────────────────────────────────────────────────

export const MAX_SLOTS = 2;
const QUESTIONS_PER_TEST = 5;
export const MAX_ATTEMPTS_PER_SLOT = 2;

// ─── Service Functions ────────────────────────────────────────────────

/**
 * Get all 5 full test slots for a subject + user.
 * Returns status of each slot (not_started, generated, completed).
 */
export async function getFullTestSlots(userId: string, subjectId: string): Promise<FullTestSlot[]> {
  // Check if dynamic_full_tests table exists for this user+subject
  const rows = await queryMany<{
    slot_number: number;
    test_id: string;
    question_count: string;
    attempt_count: string;
    best_percentage: string | null;
    passed: boolean | null;
    last_attempt_id: string | null;
  }>(
    `SELECT
       dft.slot_number,
       dft.test_id,
       (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = dft.test_id)::text as question_count,
       (SELECT COUNT(*) FROM test_attempts ta WHERE ta.test_id = dft.test_id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted'))::text as attempt_count,
       (SELECT ta.percentage::text FROM test_attempts ta WHERE ta.test_id = dft.test_id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.percentage DESC NULLS LAST LIMIT 1) as best_percentage,
       (SELECT CASE WHEN ta.percentage >= (t.passing_marks::numeric / NULLIF(t.total_marks, 0) * 100) THEN true ELSE false END FROM test_attempts ta JOIN tests t ON t.id = ta.test_id WHERE ta.test_id = dft.test_id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.percentage DESC NULLS LAST LIMIT 1) as passed,
       (SELECT ta.id::text FROM test_attempts ta WHERE ta.test_id = dft.test_id AND ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted') ORDER BY ta.created_at DESC LIMIT 1) as last_attempt_id
     FROM dynamic_full_tests dft
     WHERE dft.user_id = $1 AND dft.subject_id = $2
     ORDER BY dft.slot_number ASC`,
    [userId, subjectId],
  );

  const slotsMap = new Map<number, typeof rows[0]>();
  for (const row of rows) slotsMap.set(row.slot_number, row);

  const slots: FullTestSlot[] = [];
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const row = slotsMap.get(i);
    if (!row) {
      slots.push({ slotNumber: i, status: 'not_started', questionCount: 0, attemptCount: 0, maxAttempts: MAX_ATTEMPTS_PER_SLOT, bestPercentage: null, passed: null, lastAttemptId: null });
    } else {
      const attemptCount = parseInt(row.attempt_count, 10);
      const hasAttempts = attemptCount > 0;
      slots.push({
        slotNumber: i,
        status: hasAttempts ? 'completed' : 'generated',
        questionCount: parseInt(row.question_count, 10),
        attemptCount,
        maxAttempts: MAX_ATTEMPTS_PER_SLOT,
        bestPercentage: row.best_percentage ? parseFloat(row.best_percentage) : null,
        passed: row.passed,
        lastAttemptId: row.last_attempt_id,
      });
    }
  }

  return slots;
}

/**
 * Generate (or retrieve) a full test for a specific slot.
 * If already generated, returns the existing test_id.
 * If not, picks random questions excluding those used in previous slots.
 */
export async function generateFullTest(userId: string, subjectId: string, slotNumber: number): Promise<string> {
  if (slotNumber < 1 || slotNumber > MAX_SLOTS) {
    throw new AppError("Invalid slot number", "INVALID_SLOT", 400);
  }

  // Check if already generated
  const existing = await queryOne<{ test_id: string }>(
    `SELECT test_id FROM dynamic_full_tests WHERE user_id = $1 AND subject_id = $2 AND slot_number = $3`,
    [userId, subjectId, slotNumber],
  );

  if (existing) return existing.test_id;

  // Get subject info
  const subject = await queryOne<{ name_en: string; name_hi: string; exam_id: string }>(
    `SELECT name_en, name_hi, exam_id FROM subjects WHERE id = $1`,
    [subjectId],
  );
  if (!subject) throw new AppError("Subject not found", "SUBJECT_NOT_FOUND", 404);

  // Get question IDs already used in previous slots for this user+subject
  const usedRows = await queryMany<{ question_id: string }>(
    `SELECT tq.question_id
     FROM dynamic_full_tests dft
     JOIN test_questions tq ON tq.test_id = dft.test_id
     WHERE dft.user_id = $1 AND dft.subject_id = $2 AND dft.slot_number < $3`,
    [userId, subjectId, slotNumber],
  );
  const usedIds = usedRows.map((r) => r.question_id);

  // Pick random questions from this subject (all topics), excluding used ones
  let questionIds: string[];

  if (usedIds.length > 0) {
    const freshRows = await queryMany<{ id: string }>(
      `SELECT id FROM (
         SELECT DISTINCT q.id
         FROM questions q
         JOIN test_questions tq ON tq.question_id = q.id
         JOIN tests t ON t.id = tq.test_id
         WHERE t.subject_id = $1 AND t.status = 'published' AND t.category = 'subject_wise'
           AND q.is_active = true
           AND q.id != ALL($2::uuid[])
       ) sq ORDER BY RANDOM() LIMIT $3`,
      [subjectId, usedIds, QUESTIONS_PER_TEST],
    );
    questionIds = freshRows.map((r) => r.id);
  } else {
    const freshRows = await queryMany<{ id: string }>(
      `SELECT id FROM (
         SELECT DISTINCT q.id
         FROM questions q
         JOIN test_questions tq ON tq.question_id = q.id
         JOIN tests t ON t.id = tq.test_id
         WHERE t.subject_id = $1 AND t.status = 'published' AND t.category = 'subject_wise'
           AND q.is_active = true
       ) sq ORDER BY RANDOM() LIMIT $2`,
      [subjectId, QUESTIONS_PER_TEST],
    );
    questionIds = freshRows.map((r) => r.id);
  }

  if (questionIds.length === 0) {
    throw new AppError("Not enough questions available", "INSUFFICIENT_QUESTIONS", 400);
  }

  // Create a test record
  const testRow = await queryOne<{ id: string }>(
    `INSERT INTO tests (title_en, title_hi, exam_id, duration_minutes, total_marks, marks_per_question, negative_marking_ratio, passing_marks, pricing_type, status, category, subject_id, topic_id)
     VALUES ($1, $2, $3, 10, $4, 1, 0, $5, 'free', 'published', 'subject_wise', $6, NULL)
     RETURNING id`,
    [
      `${subject.name_en} Full Test ${slotNumber}`,
      `${subject.name_hi} पूर्ण टेस्ट ${slotNumber}`,
      subject.exam_id,
      questionIds.length, // total_marks = 1 per question
      Math.ceil(questionIds.length * 0.5), // passing_marks = 50%
      subjectId,
    ],
  );

  if (!testRow) throw new AppError("Failed to create test", "TEST_CREATION_FAILED", 500);

  // Insert test_questions
  for (let i = 0; i < questionIds.length; i++) {
    await queryOne(
      `INSERT INTO test_questions (test_id, question_id, question_order) VALUES ($1, $2, $3)`,
      [testRow.id, questionIds[i], i + 1],
    );
  }

  // Record in dynamic_full_tests
  await queryOne(
    `INSERT INTO dynamic_full_tests (user_id, subject_id, slot_number, test_id) VALUES ($1, $2, $3, $4)`,
    [userId, subjectId, slotNumber, testRow.id],
  );

  return testRow.id;
}
