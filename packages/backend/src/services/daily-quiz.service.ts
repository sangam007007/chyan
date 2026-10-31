/**
 * Daily Quiz Service — Generates, manages, and scores one 10-question quiz
 * per user per IST calendar day.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 12.1
 */

import { query, queryOne } from "@/db/query.js";
import { withTransaction } from "@/db/transaction.js";
import { AppError } from "@/errors/index.js";
import type { PoolClient, QueryResultRow } from "pg";

// ─── Types ────────────────────────────────────────────────────────────

export interface DailyQuizQuestion {
  id: string;
  subject?: string;
  textEn: string;
  textHi: string;
  optionAEn: string;
  optionAHi: string;
  optionBEn: string;
  optionBHi: string;
  optionCEn: string;
  optionCHi: string;
  optionDEn: string;
  optionDHi: string;
  correctOption: number; // 0-3 (only in result, not in start response)
  explanationEn?: string;
  explanationHi?: string;
}

export interface DailyQuizAttempt {
  id: string;
  userId: string;
  quizDate: string;
  questionIds: string[];
  answers: (number | null)[];
  score: number | null;
  timeTakenSeconds: number | null;
  status: "in_progress" | "submitted";
  createdAt: Date;
  submittedAt: Date | null;
}

export type QuizStatus = "not_started" | "in_progress" | "completed";

export interface QuizStatusResult {
  status: QuizStatus;
  attempt?: DailyQuizAttempt;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Get today's date in IST (Asia/Kolkata) as a YYYY-MM-DD string.
 */
function getTodayIST(): string {
  const now = new Date();
  const istDate = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Map a database row to a DailyQuizAttempt object.
 */
function mapRowToAttempt(row: QueryResultRow): DailyQuizAttempt {
  return {
    id: row.id,
    userId: row.user_id,
    quizDate:
      row.quiz_date instanceof Date
        ? row.quiz_date.toISOString().slice(0, 10)
        : String(row.quiz_date).slice(0, 10),
    questionIds: row.question_ids,
    answers: row.answers ?? [],
    score: row.score ?? null,
    timeTakenSeconds: row.time_taken_seconds ?? null,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? null,
  };
}

// ─── Service ──────────────────────────────────────────────────────────

/**
 * Get the quiz status for a user for today (IST).
 * Returns the status and optionally the attempt record.
 */
export async function getQuizStatus(userId: string): Promise<QuizStatusResult> {
  const row = await queryOne(
    `SELECT * FROM daily_quiz_attempts
     WHERE user_id = $1
       AND quiz_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
    [userId],
  );

  if (!row) {
    return { status: "not_started" };
  }

  const attempt = mapRowToAttempt(row);

  if (row.status === "in_progress") {
    return { status: "in_progress", attempt };
  }

  return { status: "completed", attempt };
}

/**
 * Start a daily quiz for the user. Enforces one-per-day constraint.
 * If an attempt already exists for today, returns the existing attempt.
 *
 * Selects 10 random questions from the user's selected exam subjects,
 * excluding questions answered in the last 30 days (with fallback to
 * seen questions if fewer than 10 fresh ones are available).
 */
export async function startQuiz(userId: string): Promise<DailyQuizAttempt> {
  // Check if attempt already exists for today
  const existingStatus = await getQuizStatus(userId);
  if (existingStatus.attempt) {
    return existingStatus.attempt;
  }

  // Get user's selected exam
  const user = await queryOne<{ selected_exam_id: string | null }>(
    `SELECT selected_exam_id FROM users WHERE id = $1`,
    [userId],
  );

  if (!user?.selected_exam_id) {
    throw new AppError(
      "No exam selected. Please select an exam before starting the quiz.",
      "NO_EXAM_SELECTED",
      400,
    );
  }

  const examId = user.selected_exam_id;

  // Get question IDs answered in last 30 days
  const recentRows = await query<{ qid: string }>(
    `SELECT UNNEST(question_ids) AS qid
     FROM daily_quiz_attempts
     WHERE user_id = $1
       AND quiz_date > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 30`,
    [userId],
  );
  const recentQuestionIds = recentRows.map((r) => r.qid);

  // Select 10 random fresh questions from the user's exam
  let selectedIds: string[] = [];

  if (recentQuestionIds.length > 0) {
    const freshRows = await query<{ id: string }>(
      `SELECT q.id FROM questions q
       INNER JOIN question_exams qe ON qe.question_id = q.id
       WHERE qe.exam_id = $1
         AND q.is_active = true
         AND q.id != ALL($2::uuid[])
       ORDER BY RANDOM()
       LIMIT 10`,
      [examId, recentQuestionIds],
    );
    selectedIds = freshRows.map((r) => r.id);
  } else {
    const freshRows = await query<{ id: string }>(
      `SELECT q.id FROM questions q
       INNER JOIN question_exams qe ON qe.question_id = q.id
       WHERE qe.exam_id = $1
         AND q.is_active = true
       ORDER BY RANDOM()
       LIMIT 10`,
      [examId],
    );
    selectedIds = freshRows.map((r) => r.id);
  }

  // If fewer than 10 fresh questions, fill from already-seen questions
  if (selectedIds.length < 10) {
    const remaining = 10 - selectedIds.length;
    const excludeIds = selectedIds.length > 0 ? selectedIds : ["00000000-0000-0000-0000-000000000000"];

    const fillRows = await query<{ id: string }>(
      `SELECT q.id FROM questions q
       INNER JOIN question_exams qe ON qe.question_id = q.id
       WHERE qe.exam_id = $1
         AND q.is_active = true
         AND q.id != ALL($2::uuid[])
       ORDER BY RANDOM()
       LIMIT $3`,
      [examId, excludeIds, remaining],
    );
    selectedIds = [...selectedIds, ...fillRows.map((r) => r.id)];
  }

  if (selectedIds.length === 0) {
    throw new AppError(
      "Unable to generate quiz. Not enough questions available.",
      "QUIZ_GENERATION_FAILED",
      500,
    );
  }

  // Insert the quiz attempt
  const row = await queryOne(
    `INSERT INTO daily_quiz_attempts (user_id, quiz_date, question_ids, status)
     VALUES ($1, (NOW() AT TIME ZONE 'Asia/Kolkata')::date, $2::uuid[], 'in_progress')
     RETURNING *`,
    [userId, selectedIds],
  );

  if (!row) {
    throw new AppError(
      "Unable to generate quiz. Please try again.",
      "QUIZ_GENERATION_FAILED",
      500,
    );
  }

  return mapRowToAttempt(row);
}

/**
 * Submit a daily quiz with the user's answers.
 * Validates the attempt belongs to the user and is in progress.
 * Computes the score and updates the attempt record.
 */
export async function submitQuiz(
  userId: string,
  attemptId: string,
  answers: (number | null)[],
): Promise<{ score: number; correctAnswers: number[] }> {
  return withTransaction(async (client: PoolClient) => {
    // Fetch and validate the attempt
    const attempt = await queryOne(
      `SELECT * FROM daily_quiz_attempts
       WHERE id = $1 AND user_id = $2`,
      [attemptId, userId],
      { client },
    );

    if (!attempt) {
      throw new AppError(
        "Quiz attempt not found.",
        "ATTEMPT_NOT_FOUND",
        404,
      );
    }

    if (attempt.status !== "in_progress") {
      throw new AppError(
        "This quiz has already been submitted.",
        "QUIZ_ALREADY_SUBMITTED",
        400,
      );
    }

    const questionIds: string[] = attempt.question_ids;

    // Fetch correct options for all questions
    const questionRows = await query<{ id: string; correct_option: number }>(
      `SELECT id, correct_option FROM questions WHERE id = ANY($1::uuid[])`,
      [questionIds],
      { client },
    );

    // Build a map of question id → correct option
    const correctMap = new Map<string, number>();
    for (const q of questionRows) {
      correctMap.set(q.id, q.correct_option);
    }

    // Compute score
    const correctAnswers: number[] = [];
    let score = 0;

    for (let i = 0; i < questionIds.length; i++) {
      const correctOption = correctMap.get(questionIds[i]) ?? -1;
      correctAnswers.push(correctOption);
      if (answers[i] !== null && answers[i] === correctOption) {
        score++;
      }
    }

    // Update the attempt
    await query(
      `UPDATE daily_quiz_attempts
       SET answers = $1::smallint[],
           score = $2,
           time_taken_seconds = EXTRACT(EPOCH FROM (NOW() - created_at))::integer,
           status = 'submitted',
           submitted_at = NOW()
       WHERE id = $3`,
      [answers, score, attemptId],
      { client },
    );

    return { score, correctAnswers };
  });
}

/**
 * Get the full quiz result including questions with correct answers and explanations.
 * Validates the attempt belongs to the user.
 */
export async function getQuizResult(
  userId: string,
  attemptId: string,
): Promise<{ attempt: DailyQuizAttempt; questions: DailyQuizQuestion[] }> {
  // Fetch the attempt
  const attemptRow = await queryOne(
    `SELECT * FROM daily_quiz_attempts
     WHERE id = $1 AND user_id = $2`,
    [attemptId, userId],
  );

  if (!attemptRow) {
    throw new AppError(
      "Quiz attempt not found.",
      "ATTEMPT_NOT_FOUND",
      404,
    );
  }

  const attempt = mapRowToAttempt(attemptRow);

  // Fetch full question data
  const questionRows = await query<QueryResultRow>(
    `SELECT id, subject, text_en, text_hi,
            option_a_en, option_a_hi,
            option_b_en, option_b_hi,
            option_c_en, option_c_hi,
            option_d_en, option_d_hi,
            correct_option,
            explanation_en, explanation_hi
     FROM questions
     WHERE id = ANY($1::uuid[])`,
    [attempt.questionIds],
  );

  // Build a map for ordering questions according to attempt's questionIds order
  const questionMap = new Map<string, QueryResultRow>();
  for (const row of questionRows) {
    questionMap.set(row.id, row);
  }

  // Map to DailyQuizQuestion in the same order as questionIds
  const questions: DailyQuizQuestion[] = attempt.questionIds
    .map((qid) => questionMap.get(qid))
    .filter((row): row is QueryResultRow => row != null)
    .map((row) => ({
      id: row.id,
      subject: row.subject,
      textEn: row.text_en,
      textHi: row.text_hi,
      optionAEn: row.option_a_en,
      optionAHi: row.option_a_hi,
      optionBEn: row.option_b_en,
      optionBHi: row.option_b_hi,
      optionCEn: row.option_c_en,
      optionCHi: row.option_c_hi,
      optionDEn: row.option_d_en,
      optionDHi: row.option_d_hi,
      correctOption: row.correct_option,
      explanationEn: row.explanation_en ?? undefined,
      explanationHi: row.explanation_hi ?? undefined,
    }));

  return { attempt, questions };
}
