/**
 * Score Calculator Service — Computes test scores, subject breakdowns,
 * and percentile rankings for test attempts.
 *
 * Requirements: 4.5, 5.1, 5.2, 5.3
 */

import { query } from "../db/index.js";

// ─── Types ────────────────────────────────────────────────────────────

/** Represents a user's answer to a single question in an attempt. */
export interface AttemptAnswer {
  question_id: string;
  question_order: number;
  selected_option: number | null;
  marked_for_review: boolean;
}

/** Represents a question with its correct answer and metadata. */
export interface Question {
  id: string;
  correct_option: number;
  subject: string;
}

/** The result of score calculation for a test attempt. */
export interface ScoreResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number;
  passed: boolean;
}

/** Subject-wise performance breakdown. */
export interface SubjectBreakdown {
  subject: string;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
}

// ─── Score Calculator ─────────────────────────────────────────────────

/**
 * Calculate the score for a test attempt.
 *
 * Formula:
 *   totalScore = (correctCount × marksPerQuestion) - (wrongCount × marksPerQuestion × negativeMarkingRatio)
 *   percentage = (totalScore / maxScore) × 100
 *   passed = totalScore >= passingMarks
 *
 * An answer is:
 * - "correct" if selected_option === question's correct_option
 * - "wrong" if selected_option is not null AND not equal to correct_option
 * - "skipped" if selected_option is null
 *
 * @param answers - Array of attempt answers
 * @param questions - Array of questions (must match answers by question_id)
 * @param marksPerQuestion - Marks awarded per correct answer
 * @param negativeMarkingRatio - Fraction of marks deducted per wrong answer (0 to 1)
 * @param passingMarks - Minimum score required to pass
 * @param timeTakenSeconds - Time taken for the attempt in seconds
 * @returns ScoreResult with all computed fields
 */
export function calculateScore(
  answers: AttemptAnswer[],
  questions: Question[],
  marksPerQuestion: number,
  negativeMarkingRatio: number,
  passingMarks: number,
  timeTakenSeconds: number = 0
): ScoreResult {
  // Build a lookup map from question_id to correct_option
  const questionMap = new Map<string, number>();
  for (const q of questions) {
    questionMap.set(q.id, q.correct_option);
  }

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  for (const answer of answers) {
    if (answer.selected_option === null) {
      skippedCount++;
    } else {
      const correctOption = questionMap.get(answer.question_id);
      if (correctOption !== undefined && answer.selected_option === correctOption) {
        correctCount++;
      } else {
        wrongCount++;
      }
    }
  }

  const totalScore =
    correctCount * marksPerQuestion -
    wrongCount * marksPerQuestion * negativeMarkingRatio;

  const maxScore = answers.length * marksPerQuestion;

  // Avoid division by zero when there are no questions
  const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

  const passed = totalScore >= passingMarks;

  return {
    totalScore,
    maxScore,
    percentage,
    correctCount,
    wrongCount,
    skippedCount,
    timeTakenSeconds,
    passed,
  };
}

// ─── Subject Breakdown ────────────────────────────────────────────────

/**
 * Calculate subject-wise breakdown of correct, wrong, and skipped answers.
 *
 * Groups answers by the subject of their corresponding question, then
 * counts correct/wrong/skipped within each group.
 *
 * @param answers - Array of attempt answers
 * @param questions - Array of questions (must match answers by question_id)
 * @returns Array of SubjectBreakdown objects, one per subject
 */
export function calculateSubjectBreakdown(
  answers: AttemptAnswer[],
  questions: Question[]
): SubjectBreakdown[] {
  // Build a lookup map from question_id to question metadata
  const questionMap = new Map<string, Question>();
  for (const q of questions) {
    questionMap.set(q.id, q);
  }

  // Accumulate counts per subject
  const breakdownMap = new Map<
    string,
    { correct: number; wrong: number; skipped: number }
  >();

  for (const answer of answers) {
    const question = questionMap.get(answer.question_id);
    if (!question) {
      continue;
    }

    const { subject, correct_option } = question;

    if (!breakdownMap.has(subject)) {
      breakdownMap.set(subject, { correct: 0, wrong: 0, skipped: 0 });
    }

    const counts = breakdownMap.get(subject)!;

    if (answer.selected_option === null) {
      counts.skipped++;
    } else if (answer.selected_option === correct_option) {
      counts.correct++;
    } else {
      counts.wrong++;
    }
  }

  // Convert map to SubjectBreakdown array
  const result: SubjectBreakdown[] = [];
  for (const [subject, counts] of breakdownMap) {
    result.push({
      subject,
      correct: counts.correct,
      wrong: counts.wrong,
      skipped: counts.skipped,
      total: counts.correct + counts.wrong + counts.skipped,
    });
  }

  return result;
}

// ─── Percentile Calculation ───────────────────────────────────────────

/**
 * Pure utility function that computes percentile from a score and an array
 * of all scores. This enables property-based testing without database access.
 *
 * Percentile = (number of scores <= current score / total number of scores) × 100
 *
 * If the allScores array is empty, returns 100 (top percentile by default).
 *
 * @param score - The score to compute percentile for
 * @param allScores - Array of all scores for the test
 * @returns Percentile value between 0 and 100
 */
export function calculatePercentileFromScores(
  score: number,
  allScores: number[]
): number {
  if (allScores.length === 0) {
    return 100;
  }

  const countBelow = allScores.filter((s) => s <= score).length;
  return (countBelow / allScores.length) * 100;
}

/**
 * Calculate the rank percentile for a given score within a test.
 *
 * Queries all submitted/auto-submitted attempts for the test and computes
 * the percentage of scores that are less than or equal to the given score.
 *
 * If no attempts exist for the test, returns 100 (top percentile).
 *
 * @param score - The score to compute percentile for
 * @param testId - The test ID to query attempts for
 * @returns Percentile value between 0 and 100
 *
 * Requirements: 5.2
 */
export async function calculatePercentile(
  score: number,
  testId: string
): Promise<number> {
  const rows = await query<{ total_score: number }>(
    `SELECT total_score FROM test_attempts
     WHERE test_id = $1 AND status IN ('submitted', 'auto_submitted')`,
    [testId]
  );

  const allScores = rows.map((r) => Number(r.total_score));
  return calculatePercentileFromScores(score, allScores);
}
