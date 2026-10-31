/**
 * Performance Analytics Service — Comprehensive performance computation functions.
 *
 * All functions accept userId and compute analytics from existing tables.
 * Uses IST timezone boundaries for date-based calculations.
 */

import { getStreakWithBest } from "@/services/streak.service.js";
import { queryOne, queryMany } from "@/db/index.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface PerformanceOverview {
  totalTestsAttempted: number;
  totalQuestionsSolved: number;
  totalCorrect: number;
  totalWrong: number;
  overallAccuracy: number;
  averageScore: number;
  averagePercentage: number;
  totalCoinsEarned: number;
  totalStudyTimeMinutes: number;
  currentStreak: number;
  bestStreak: number;
}

export interface SubjectAnalytics {
  subjectId: string;
  nameEn: string;
  nameHi: string;
  accuracy: number;
  totalAttempts: number;
  questionsSolved: number;
  averageScore: number;
  completionPercentage: number;
}

export interface TopicAnalytics {
  topicId: string;
  nameEn: string;
  nameHi: string;
  subjectNameEn: string;
  subjectNameHi: string;
  attempts: number;
  bestAccuracy: number | null;
  latestAccuracy: number | null;
  status: string;
  lastAttempted: string | null;
}

export interface WeeklyEntry {
  date: string;
  studyTimeMinutes: number;
  testsCompleted: number;
  questionsSolved: number;
  accuracy: number | null;
}

export interface MonthlyData {
  totalTests: number;
  totalQuestions: number;
  averageAccuracy: number;
  improvementPercent: number;
  weekByWeek: { weekLabel: string; tests: number; questions: number; accuracy: number }[];
}

export interface TimeAnalytics {
  averageSecondsPerQuestion: number;
  fastestTestSeconds: number | null;
  slowestTestSeconds: number | null;
  totalStudyHours: number;
}

export interface Recommendation {
  type: "continue" | "retry" | "practice" | "mock";
  title: string;
  description: string;
  titleHi: string;
  descriptionHi: string;
  targetId: string | null;
}

export interface RankData {
  /** false when the student has no submitted test in the selected exam: there is no rank to show yet */
  ranked: boolean;
  currentRank: number;
  totalUsers: number;
  percentile: number;
  /** Rank as of 7 days ago; null if the user had no submitted attempt then. */
  previousRank: number | null;
  /** previousRank - currentRank: positive = moved up, negative = moved down. */
  rankChange: number | null;
}

export interface ActivityDay {
  date: string;
  testsCompleted: number;
}

export interface ActivityHeatmap {
  days: ActivityDay[];
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  thisWeekActiveDays: number;
}

// ─── getOverview ──────────────────────────────────────────────────────

export async function getOverview(userId: string): Promise<PerformanceOverview> {
  const stats = await queryOne<{
    total_tests: string;
    total_solved: string;
    total_correct: string;
    avg_score: string;
    avg_percentage: string;
    total_study_seconds: string;
  }>(
    `WITH att AS (
       SELECT ta.id, ta.total_score, ta.percentage,
              LEAST(COALESCE(ta.time_taken_seconds, 0), t.duration_minutes * 60) AS secs
       FROM test_attempts ta
       INNER JOIN tests t ON t.id = ta.test_id
       WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
         AND ta.status IN ('submitted', 'auto_submitted')
     ),
     ans AS (
       SELECT COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL) AS solved,
              COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option) AS correct
       FROM att
       INNER JOIN attempt_answers aa ON aa.attempt_id = att.id
       INNER JOIN questions q ON q.id = aa.question_id
     )
     SELECT
       (SELECT COUNT(*) FROM att) AS total_tests,
       ans.solved AS total_solved,
       ans.correct AS total_correct,
       COALESCE((SELECT AVG(total_score) FROM att), 0) AS avg_score,
       COALESCE((SELECT AVG(percentage) FROM att), 0) AS avg_percentage,
       COALESCE((SELECT SUM(secs) FROM att), 0) AS total_study_seconds
     FROM ans`,
    [userId],
  );

  const coins = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM coin_transactions WHERE user_id = $1`,
    [userId],
  );

  const streak = await getStreakWithBest(userId);

  const totalSolved = Number(stats?.total_solved ?? 0);
  const totalCorrect = Number(stats?.total_correct ?? 0);

  return {
    totalTestsAttempted: Number(stats?.total_tests ?? 0),
    totalQuestionsSolved: totalSolved,
    totalCorrect,
    totalWrong: totalSolved - totalCorrect,
    overallAccuracy: totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0,
    averageScore: Math.round(Number(stats?.avg_score ?? 0)),
    averagePercentage: Math.round(Number(stats?.avg_percentage ?? 0)),
    totalCoinsEarned: Number(coins?.total ?? 0),
    totalStudyTimeMinutes: Math.round(Number(stats?.total_study_seconds ?? 0) / 60),
    // One definition of streak for the whole app (days with a recorded activity, same as the Dashboard)
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
  };
}

// ─── getSubjectAnalytics ──────────────────────────────────────────────

export async function getSubjectAnalytics(userId: string): Promise<SubjectAnalytics[]> {
  const rows = await queryMany<{
    subject_id: string;
    name_en: string;
    name_hi: string;
    accuracy: string;
    total_attempts: string;
    questions_solved: string;
    average_score: string;
    completion_percentage: string;
  }>(
    `WITH subject_stats AS (
       SELECT
         s.id AS subject_id,
         s.name_en,
         s.name_hi,
         COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL) AS solved,
         COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option) AS correct,
         COUNT(DISTINCT ta.id) AS total_attempts,
         COALESCE(AVG(ta.percentage), 0) AS average_score
       FROM test_attempts ta
       INNER JOIN tests t ON t.id = ta.test_id AND t.subject_id IS NOT NULL
       INNER JOIN subjects s ON s.id = t.subject_id
       LEFT JOIN attempt_answers aa ON aa.attempt_id = ta.id
       LEFT JOIN questions q ON q.id = aa.question_id
       WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
         AND ta.status IN ('submitted', 'auto_submitted')
       GROUP BY s.id, s.name_en, s.name_hi
     ),
     topic_completion AS (
       SELECT
         t.subject_id,
         COUNT(*) AS total_topics,
         COUNT(*) FILTER (WHERE tp.status = 'completed') AS completed_topics
       FROM topics t
       LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
       GROUP BY t.subject_id
     )
     SELECT
       ss.subject_id,
       ss.name_en,
       ss.name_hi,
       CASE WHEN ss.solved > 0
         THEN ROUND(ss.correct::numeric / ss.solved * 100)
         ELSE 0
       END AS accuracy,
       ss.total_attempts,
       ss.solved AS questions_solved,
       ROUND(ss.average_score) AS average_score,
       CASE WHEN COALESCE(tc.total_topics, 0) > 0
         THEN ROUND(COALESCE(tc.completed_topics, 0)::numeric / tc.total_topics * 100)
         ELSE 0
       END AS completion_percentage
     FROM subject_stats ss
     LEFT JOIN topic_completion tc ON tc.subject_id = ss.subject_id
     ORDER BY ss.name_en`,
    [userId],
  );

  return rows.map((r) => ({
    subjectId: r.subject_id,
    nameEn: r.name_en,
    nameHi: r.name_hi,
    accuracy: Number(r.accuracy),
    totalAttempts: Number(r.total_attempts),
    questionsSolved: Number(r.questions_solved),
    averageScore: Number(r.average_score),
    completionPercentage: Number(r.completion_percentage),
  }));
}

// ─── getTopicAnalytics ────────────────────────────────────────────────

export async function getTopicAnalytics(userId: string): Promise<TopicAnalytics[]> {
  const rows = await queryMany<{
    topic_id: string;
    name_en: string;
    name_hi: string;
    subject_name_en: string;
    subject_name_hi: string;
    attempts: string;
    best_accuracy: string | null;
    latest_accuracy: string | null;
    status: string;
    last_attempted: string | null;
  }>(
    `SELECT
       tp.topic_id,
       t.name_en,
       t.name_hi,
       s.name_en AS subject_name_en,
       s.name_hi AS subject_name_hi,
       tp.attempts_count AS attempts,
       tp.best_accuracy,
       (
         SELECT ta.percentage
         FROM test_attempts ta
         INNER JOIN tests ts ON ts.id = ta.test_id
         WHERE ta.user_id = $1
           AND ts.topic_id = tp.topic_id
           AND ta.status IN ('submitted', 'auto_submitted')
         ORDER BY ta.submitted_at DESC
         LIMIT 1
       ) AS latest_accuracy,
       tp.status,
       (
         SELECT ta.submitted_at
         FROM test_attempts ta
         INNER JOIN tests ts ON ts.id = ta.test_id
         WHERE ta.user_id = $1
           AND ts.topic_id = tp.topic_id
           AND ta.status IN ('submitted', 'auto_submitted')
         ORDER BY ta.submitted_at DESC
         LIMIT 1
       ) AS last_attempted
     FROM topic_progress tp
     INNER JOIN topics t ON t.id = tp.topic_id
     INNER JOIN subjects s ON s.id = t.subject_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
     ORDER BY s.name_en, t.display_order`,
    [userId],
  );

  return rows.map((r) => ({
    topicId: r.topic_id,
    nameEn: r.name_en,
    nameHi: r.name_hi,
    subjectNameEn: r.subject_name_en,
    subjectNameHi: r.subject_name_hi,
    attempts: Number(r.attempts),
    bestAccuracy: r.best_accuracy != null ? Number(r.best_accuracy) : null,
    latestAccuracy: r.latest_accuracy != null ? Math.round(Number(r.latest_accuracy)) : null,
    status: r.status,
    lastAttempted: r.last_attempted ?? null,
  }));
}

// ─── getWeeklyAnalytics ───────────────────────────────────────────────

export async function getWeeklyAnalytics(userId: string): Promise<WeeklyEntry[]> {
  const rows = await queryMany<{
    date: string;
    study_time_minutes: string;
    tests_completed: string;
    questions_solved: string;
    accuracy: string | null;
  }>(
    `WITH days AS (
       SELECT d::date AS day
       FROM generate_series(
         (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days',
         (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
         '1 day'
       ) AS d
     ),
     daily_attempts AS (
       SELECT
         (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date AS attempt_day,
         SUM(ta.time_taken_seconds) AS study_seconds,
         COUNT(*) AS tests_done
       FROM test_attempts ta
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date
             >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days'
       GROUP BY attempt_day
     ),
     daily_answers AS (
       SELECT
         (aa.answered_at AT TIME ZONE 'Asia/Kolkata')::date AS answer_day,
         COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL) AS solved,
         COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option) AS correct
       FROM attempt_answers aa
       INNER JOIN questions q ON q.id = aa.question_id
       INNER JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND (aa.answered_at AT TIME ZONE 'Asia/Kolkata')::date
             >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 days'
       GROUP BY answer_day
     )
     SELECT
       TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
       COALESCE(ROUND(da.study_seconds / 60.0), 0) AS study_time_minutes,
       COALESCE(da.tests_done, 0) AS tests_completed,
       COALESCE(dan.solved, 0) AS questions_solved,
       CASE WHEN COALESCE(dan.solved, 0) > 0
         THEN ROUND(dan.correct::numeric / dan.solved * 100)
         ELSE NULL
       END AS accuracy
     FROM days d
     LEFT JOIN daily_attempts da ON da.attempt_day = d.day
     LEFT JOIN daily_answers dan ON dan.answer_day = d.day
     ORDER BY d.day`,
    [userId],
  );

  return rows.map((r) => ({
    date: r.date,
    studyTimeMinutes: Number(r.study_time_minutes),
    testsCompleted: Number(r.tests_completed),
    questionsSolved: Number(r.questions_solved),
    accuracy: r.accuracy != null ? Number(r.accuracy) : null,
  }));
}

// ─── getMonthlyAnalytics ──────────────────────────────────────────────

export async function getMonthlyAnalytics(userId: string): Promise<MonthlyData> {
  const summary = await queryOne<{
    total_tests: string;
    total_questions: string;
    avg_accuracy: string;
    recent_accuracy: string;
    previous_accuracy: string;
  }>(
    `WITH last30 AS (
       SELECT ta.id AS attempt_id, ta.submitted_at
       FROM test_attempts ta
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date
             > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '30 days'
     ),
     answers AS (
       SELECT
         aa.attempt_id,
         l.submitted_at,
         CASE WHEN aa.selected_option IS NOT NULL THEN 1 ELSE 0 END AS is_solved,
         CASE WHEN aa.selected_option = q.correct_option THEN 1 ELSE 0 END AS is_correct
       FROM attempt_answers aa
       INNER JOIN last30 l ON l.attempt_id = aa.attempt_id
       INNER JOIN questions q ON q.id = aa.question_id
     )
     SELECT
       (SELECT COUNT(*) FROM last30) AS total_tests,
       COALESCE(SUM(is_solved), 0) AS total_questions,
       CASE WHEN SUM(is_solved) > 0
         THEN ROUND(SUM(is_correct)::numeric / SUM(is_solved) * 100)
         ELSE 0
       END AS avg_accuracy,
       CASE WHEN SUM(is_solved) FILTER (
         WHERE (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
               > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '15 days'
       ) > 0
         THEN ROUND(
           SUM(is_correct) FILTER (
             WHERE (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
                   > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '15 days'
           )::numeric /
           SUM(is_solved) FILTER (
             WHERE (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
                   > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '15 days'
           ) * 100
         )
         ELSE 0
       END AS recent_accuracy,
       CASE WHEN SUM(is_solved) FILTER (
         WHERE (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
               <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '15 days'
       ) > 0
         THEN ROUND(
           SUM(is_correct) FILTER (
             WHERE (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
                   <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '15 days'
           )::numeric /
           SUM(is_solved) FILTER (
             WHERE (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
                   <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '15 days'
           ) * 100
         )
         ELSE 0
       END AS previous_accuracy
     FROM answers`,
    [userId],
  );

  const weekRows = await queryMany<{
    week_label: string;
    tests: string;
    questions: string;
    accuracy: string;
  }>(
    `WITH weeks AS (
       SELECT
         generate_series(0, 3) AS week_num
     ),
     week_bounds AS (
       SELECT
         week_num,
         'Week ' || (4 - week_num) AS week_label,
         (NOW() AT TIME ZONE 'Asia/Kolkata')::date - (week_num * 7 + 6) AS start_day,
         (NOW() AT TIME ZONE 'Asia/Kolkata')::date - (week_num * 7) AS end_day
       FROM weeks
     ),
     attempt_data AS (
       SELECT
         ta.id AS attempt_id,
         (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date AS attempt_day
       FROM test_attempts ta
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date
             > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '28 days'
     )
     SELECT
       wb.week_label,
       COUNT(DISTINCT ad.attempt_id) AS tests,
       COALESCE(SUM(CASE WHEN aa.selected_option IS NOT NULL THEN 1 ELSE 0 END), 0) AS questions,
       CASE WHEN SUM(CASE WHEN aa.selected_option IS NOT NULL THEN 1 ELSE 0 END) > 0
         THEN ROUND(
           SUM(CASE WHEN aa.selected_option = q.correct_option THEN 1 ELSE 0 END)::numeric /
           SUM(CASE WHEN aa.selected_option IS NOT NULL THEN 1 ELSE 0 END) * 100
         )
         ELSE 0
       END AS accuracy
     FROM week_bounds wb
     LEFT JOIN attempt_data ad ON ad.attempt_day BETWEEN wb.start_day AND wb.end_day
     LEFT JOIN attempt_answers aa ON aa.attempt_id = ad.attempt_id
     LEFT JOIN questions q ON q.id = aa.question_id
     GROUP BY wb.week_num, wb.week_label
     ORDER BY wb.week_num DESC`,
    [userId],
  );

  const recentAcc = Number(summary?.recent_accuracy ?? 0);
  const prevAcc = Number(summary?.previous_accuracy ?? 0);

  return {
    totalTests: Number(summary?.total_tests ?? 0),
    totalQuestions: Number(summary?.total_questions ?? 0),
    averageAccuracy: Number(summary?.avg_accuracy ?? 0),
    improvementPercent: recentAcc - prevAcc,
    weekByWeek: weekRows.map((r) => ({
      weekLabel: r.week_label,
      tests: Number(r.tests),
      questions: Number(r.questions),
      accuracy: Number(r.accuracy),
    })),
  };
}

// ─── getTimeAnalytics ─────────────────────────────────────────────────

export async function getTimeAnalytics(userId: string): Promise<TimeAnalytics> {
  const row = await queryOne<{
    avg_seconds_per_question: string;
    fastest: string | null;
    slowest: string | null;
    total_hours: string;
  }>(
    `WITH attempt_stats AS (
       SELECT
         ta.time_taken_seconds,
         (SELECT COUNT(*) FROM attempt_answers aa WHERE aa.attempt_id = ta.id) AS q_count
       FROM test_attempts ta
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
     )
     SELECT
       CASE WHEN SUM(q_count) > 0
         THEN ROUND(SUM(time_taken_seconds)::numeric / SUM(q_count))
         ELSE 0
       END AS avg_seconds_per_question,
       MIN(time_taken_seconds) AS fastest,
       MAX(time_taken_seconds) AS slowest,
       ROUND(COALESCE(SUM(time_taken_seconds), 0)::numeric / 3600, 1) AS total_hours
     FROM attempt_stats`,
    [userId],
  );

  return {
    averageSecondsPerQuestion: Number(row?.avg_seconds_per_question ?? 0),
    fastestTestSeconds: row?.fastest != null ? Number(row.fastest) : null,
    slowestTestSeconds: row?.slowest != null ? Number(row.slowest) : null,
    totalStudyHours: Number(row?.total_hours ?? 0),
  };
}

// ─── getWeakAreas ─────────────────────────────────────────────────────

export async function getWeakAreas(userId: string): Promise<{
  weakSubjects: { subjectId: string; nameEn: string; nameHi: string; accuracy: number }[];
  weakTopics: { topicId: string; nameEn: string; nameHi: string; bestAccuracy: number }[];
}> {
  const weakSubjects = await queryMany<{
    subject_id: string;
    name_en: string;
    name_hi: string;
    accuracy: string;
  }>(
    `SELECT
       s.id AS subject_id,
       s.name_en,
       s.name_hi,
       ROUND(
         COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option)::numeric /
         NULLIF(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
       ) AS accuracy
     FROM test_attempts ta
     INNER JOIN tests t ON t.id = ta.test_id AND t.subject_id IS NOT NULL
     INNER JOIN subjects s ON s.id = t.subject_id
     INNER JOIN attempt_answers aa ON aa.attempt_id = ta.id
     INNER JOIN questions q ON q.id = aa.question_id
     WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
       AND ta.status IN ('submitted', 'auto_submitted')
       AND aa.selected_option IS NOT NULL
     GROUP BY s.id, s.name_en, s.name_hi
     HAVING ROUND(
       COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option)::numeric /
       NULLIF(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
     ) < 60
     ORDER BY accuracy ASC
     LIMIT 5`,
    [userId],
  );

  const weakTopics = await queryMany<{
    topic_id: string;
    name_en: string;
    name_hi: string;
    best_accuracy: string;
  }>(
    `SELECT
       tp.topic_id,
       t.name_en,
       t.name_hi,
       tp.best_accuracy
     FROM topic_progress tp
     INNER JOIN topics t ON t.id = tp.topic_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
       AND tp.best_accuracy < 60
       AND tp.attempts_count > 0
     ORDER BY tp.best_accuracy ASC, t.name_en
     LIMIT 5`,
    [userId],
  );

  return {
    weakSubjects: weakSubjects.map((r) => ({
      subjectId: r.subject_id,
      nameEn: r.name_en,
      nameHi: r.name_hi,
      accuracy: Number(r.accuracy),
    })),
    weakTopics: weakTopics.map((r) => ({
      topicId: r.topic_id,
      nameEn: r.name_en,
      nameHi: r.name_hi,
      bestAccuracy: Number(r.best_accuracy),
    })),
  };
}

// ─── getStrongAreas ───────────────────────────────────────────────────

export async function getStrongAreas(userId: string): Promise<{
  strongSubjects: { subjectId: string; nameEn: string; nameHi: string; accuracy: number }[];
  strongTopics: { topicId: string; nameEn: string; nameHi: string; bestAccuracy: number }[];
}> {
  const strongSubjects = await queryMany<{
    subject_id: string;
    name_en: string;
    name_hi: string;
    accuracy: string;
  }>(
    `SELECT
       s.id AS subject_id,
       s.name_en,
       s.name_hi,
       ROUND(
         COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option)::numeric /
         NULLIF(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
       ) AS accuracy
     FROM test_attempts ta
     INNER JOIN tests t ON t.id = ta.test_id AND t.subject_id IS NOT NULL
     INNER JOIN subjects s ON s.id = t.subject_id
     INNER JOIN attempt_answers aa ON aa.attempt_id = ta.id
     INNER JOIN questions q ON q.id = aa.question_id
     WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
       AND ta.status IN ('submitted', 'auto_submitted')
       AND aa.selected_option IS NOT NULL
     GROUP BY s.id, s.name_en, s.name_hi
     HAVING ROUND(
       COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option)::numeric /
       NULLIF(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
     ) >= 80
     ORDER BY accuracy DESC
     LIMIT 5`,
    [userId],
  );

  const strongTopics = await queryMany<{
    topic_id: string;
    name_en: string;
    name_hi: string;
    best_accuracy: string;
  }>(
    `SELECT
       tp.topic_id,
       t.name_en,
       t.name_hi,
       tp.best_accuracy
     FROM topic_progress tp
     INNER JOIN topics t ON t.id = tp.topic_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
       AND tp.best_accuracy >= 80
     ORDER BY tp.best_accuracy DESC, t.name_en
     LIMIT 5`,
    [userId],
  );

  return {
    strongSubjects: strongSubjects.map((r) => ({
      subjectId: r.subject_id,
      nameEn: r.name_en,
      nameHi: r.name_hi,
      accuracy: Number(r.accuracy),
    })),
    strongTopics: strongTopics.map((r) => ({
      topicId: r.topic_id,
      nameEn: r.name_en,
      nameHi: r.name_hi,
      bestAccuracy: Number(r.best_accuracy),
    })),
  };
}

// ─── getRecommendations ───────────────────────────────────────────────

export async function getRecommendations(userId: string): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  // 1. Continue: in_progress topics
  const inProgress = await queryMany<{
    topic_id: string;
    name_en: string;
    name_hi: string;
  }>(
    `SELECT tp.topic_id, t.name_en, t.name_hi
     FROM topic_progress tp
     INNER JOIN topics t ON t.id = tp.topic_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND tp.status = 'in_progress'
     ORDER BY COALESCE(tp.last_visited_at, tp.unlocked_at, tp.created_at) DESC
     LIMIT 2`,
    [userId],
  );

  for (const row of inProgress) {
    recommendations.push({
      type: "continue",
      title: `Continue: ${row.name_en}`,
      description: `You have an in-progress topic. Keep practicing to improve your accuracy.`,
      titleHi: `जारी रखें: ${row.name_hi}`,
      descriptionHi: `यह टॉपिक अधूरा है। सटीकता बढ़ाने के लिए अभ्यास जारी रखें।`,
      targetId: row.topic_id,
    });
  }

  // 2. Retry: attempted but not completed, best_accuracy < 80
  if (recommendations.length < 5) {
    const retryTopics = await queryMany<{
      topic_id: string;
      name_en: string;
      name_hi: string;
      best_accuracy: string;
    }>(
      `SELECT tp.topic_id, t.name_en, t.name_hi, tp.best_accuracy
       FROM topic_progress tp
       INNER JOIN topics t ON t.id = tp.topic_id
       WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
         AND tp.status != 'completed'
         AND tp.attempts_count > 0
         AND tp.best_accuracy < 80
       ORDER BY tp.best_accuracy ASC, t.name_en
       LIMIT $2`,
      [userId, 5 - recommendations.length],
    );

    for (const row of retryTopics) {
      recommendations.push({
        type: "retry",
        title: `Retry: ${row.name_en}`,
        description: `Your best score is ${row.best_accuracy}%. Aim for 80% to complete this topic.`,
        titleHi: `दोबारा करें: ${row.name_hi}`,
        descriptionHi: `आपका सर्वश्रेष्ठ स्कोर ${row.best_accuracy}% है। यह टॉपिक पूरा करने के लिए 80% का लक्ष्य रखें।`,
        targetId: row.topic_id,
      });
    }
  }

  // 3. Practice: weak subjects
  if (recommendations.length < 5) {
    const weakSubjects = await queryMany<{
      subject_id: string;
      name_en: string;
      name_hi: string;
      accuracy: string;
    }>(
      `SELECT
         s.id AS subject_id,
         s.name_en,
         s.name_hi,
         ROUND(
           COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option)::numeric /
           NULLIF(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
         ) AS accuracy
       FROM test_attempts ta
       INNER JOIN tests t ON t.id = ta.test_id AND t.subject_id IS NOT NULL
       INNER JOIN subjects s ON s.id = t.subject_id
       INNER JOIN attempt_answers aa ON aa.attempt_id = ta.id
       INNER JOIN questions q ON q.id = aa.question_id
       WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
         AND ta.status IN ('submitted', 'auto_submitted')
         AND aa.selected_option IS NOT NULL
       GROUP BY s.id, s.name_en, s.name_hi
       HAVING ROUND(
         COUNT(*) FILTER (WHERE aa.selected_option = q.correct_option)::numeric /
         NULLIF(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
       ) < 60
       ORDER BY accuracy ASC
       LIMIT $2`,
      [userId, 5 - recommendations.length],
    );

    for (const row of weakSubjects) {
      recommendations.push({
        type: "practice",
        title: `Practice: ${row.name_en}`,
        description: `Your accuracy is ${row.accuracy}% in this subject. More practice will help.`,
        titleHi: `अभ्यास करें: ${row.name_hi}`,
        descriptionHi: `इस विषय में आपकी सटीकता ${row.accuracy}% है। और अभ्यास से सुधार होगा।`,
        targetId: row.subject_id,
      });
    }
  }

  // 4. Mock test if all topics completed
  if (recommendations.length < 3) {
    const completionCheck = await queryOne<{
      total: string;
      completed: string;
    }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE tp.status = 'completed') AS completed
       FROM topic_progress tp
       WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))`,
      [userId],
    );

    const total = Number(completionCheck?.total ?? 0);
    const completed = Number(completionCheck?.completed ?? 0);

    if (total > 0 && total === completed) {
      recommendations.push({
        type: "mock",
        title: "Take a Full Mock Test",
        description: "You've completed all topics! Test your overall readiness with a mock exam.",
        titleHi: "पूरा मॉक टेस्ट दें",
        descriptionHi: "आपने सभी टॉपिक पूरे कर लिए हैं! मॉक टेस्ट से अपनी तैयारी जांचें।",
        targetId: null,
      });
    }
  }

  return recommendations.slice(0, 5);
}

// ─── getRankAnalytics ─────────────────────────────────────────────────

export async function getRankAnalytics(userId: string): Promise<RankData> {
  // Rank is per exam: only tests of the exam the student has selected count, and only students of that exam compete.
  const row = await queryOne<{
    current_rank: string | null;
    total_users: string;
    has_attempts: boolean;
  }>(
    `WITH my AS (SELECT selected_exam_id AS exam_id FROM users WHERE id = $1),
     user_scores AS (
       SELECT
         ta.user_id,
         DENSE_RANK() OVER (ORDER BY COALESCE(SUM(ta.total_score), 0) DESC) AS rank
       FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       JOIN users u ON u.id = ta.user_id
       WHERE ta.status IN ('submitted', 'auto_submitted')
         AND t.exam_id = (SELECT exam_id FROM my)
         AND u.selected_exam_id = (SELECT exam_id FROM my)
       GROUP BY ta.user_id
     )
     SELECT
       (SELECT rank FROM user_scores WHERE user_id = $1) AS current_rank,
       GREATEST((SELECT COUNT(*) FROM user_scores), 1) AS total_users,
       EXISTS (SELECT 1 FROM user_scores WHERE user_id = $1) AS has_attempts`,
    [userId],
  );

  const prevRow = await queryOne<{ prev_rank: string | null }>(
    `WITH my AS (SELECT selected_exam_id AS exam_id FROM users WHERE id = $1),
     user_scores AS (
       SELECT
         ta.user_id,
         DENSE_RANK() OVER (ORDER BY COALESCE(SUM(ta.total_score), 0) DESC) AS rank
       FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       JOIN users u ON u.id = ta.user_id
       WHERE ta.status IN ('submitted', 'auto_submitted')
         AND ta.submitted_at < NOW() - INTERVAL '7 days'
         AND t.exam_id = (SELECT exam_id FROM my)
         AND u.selected_exam_id = (SELECT exam_id FROM my)
       GROUP BY ta.user_id
     )
     SELECT (SELECT rank FROM user_scores WHERE user_id = $1) AS prev_rank`,
    [userId],
  );

  const ranked = !!row?.has_attempts;
  const totalUsers = Number(row?.total_users ?? 1);
  // Not ranked yet (no test in this exam): last place among the others, so the number is never 0 or made up
  const currentRank = ranked ? Number(row?.current_rank) : totalUsers;
  const previousRank = prevRow?.prev_rank != null ? Number(prevRow.prev_rank) : null;
  const percentile = ranked && totalUsers > 0
    ? Math.round(((totalUsers - currentRank) / totalUsers) * 100)
    : 0;

  return {
    ranked,
    currentRank,
    totalUsers,
    percentile: Math.max(0, percentile),
    previousRank,
    rankChange: ranked && previousRank != null ? previousRank - currentRank : null,
  };
}

// ─── getActivityHeatmap ───────────────────────────────────────────────

export async function getActivityHeatmap(userId: string, weeks = 12): Promise<ActivityHeatmap> {
  const span = weeks * 7;
  const rows = await queryMany<{ day: string; tests: string }>(
    `WITH active AS (
       SELECT activity_date AS day FROM user_activities
       WHERE user_id = $1
         AND activity_date > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - $2::int
     ),
     tests AS (
       SELECT (submitted_at AT TIME ZONE 'Asia/Kolkata')::date AS day, COUNT(*) AS n
       FROM test_attempts
       WHERE user_id = $1
         AND status IN ('submitted', 'auto_submitted')
         AND (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
             > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - $2::int
       GROUP BY 1
     )
     SELECT to_char(COALESCE(a.day, t.day), 'YYYY-MM-DD') AS day, COALESCE(t.n, 0) AS tests
     FROM active a FULL OUTER JOIN tests t ON t.day = a.day
     ORDER BY 1`,
    [userId, span],
  );

  const days = rows.map((r) => ({ date: r.day, testsCompleted: Number(r.tests) }));
  const set = new Set(days.map((d) => d.date));

  const today = new Date(Date.now() + 5.5 * 3600 * 1000); // IST
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const back = (n: number) => iso(new Date(today.getTime() - n * 86400000));

  // Streaks use the same source as the Dashboard (recorded activity days), not test days.
  const streak = await getStreakWithBest(userId);

  const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
  let thisWeek = 0;
  for (let i = 0; i <= dow; i++) if (set.has(back(i))) thisWeek++;

  return { days, activeDays: days.length, currentStreak: streak.currentStreak, bestStreak: streak.bestStreak, thisWeekActiveDays: thisWeek };
}

// ─── getDailyPerformance ──────────────────────────────────────────────

export interface DailyPerformanceDay {
  date: string;
  tests: number;
  /** Average score % of that day's tests (after negative marking). */
  score: number;
  accuracy: number;
  questions: number;
}

export interface DailyPerformance {
  days: number;
  passMark: number;
  series: DailyPerformanceDay[];
  summary: {
    activeDays: number;
    avgScore: number;
    redDays: number;
    greenDays: number;
    bestDay: DailyPerformanceDay | null;
  };
}

export const DAILY_PASS_MARK = 60;

/** One row per active IST day over the last `days` days, overall (not per subject). */
export async function getDailyPerformance(userId: string, days: number): Promise<DailyPerformance> {
  const rows = await queryMany<{
    day: string;
    tests: string;
    score: string;
    correct: string;
    wrong: string;
    skipped: string;
  }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day,
            COUNT(*) AS tests,
            AVG(percentage) AS score,
            SUM(correct_count) AS correct,
            SUM(wrong_count) AS wrong,
            SUM(skipped_count) AS skipped
     FROM (
       SELECT (submitted_at AT TIME ZONE 'Asia/Kolkata')::date AS day,
              COALESCE(percentage, 0) AS percentage,
              COALESCE(correct_count, 0) AS correct_count,
              COALESCE(wrong_count, 0) AS wrong_count,
              COALESCE(skipped_count, 0) AS skipped_count
       FROM test_attempts
       WHERE user_id = $1
         AND status IN ('submitted', 'auto_submitted')
         AND submitted_at IS NOT NULL
         AND (submitted_at AT TIME ZONE 'Asia/Kolkata')::date
             > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - $2::int
     ) a
     GROUP BY day
     ORDER BY day`,
    [userId, days],
  );

  const series: DailyPerformanceDay[] = rows.map((r) => {
    const c = Number(r.correct);
    const w = Number(r.wrong);
    return {
      date: r.day,
      tests: Number(r.tests),
      score: Math.round(Number(r.score)),
      accuracy: c + w > 0 ? Math.round((c / (c + w)) * 100) : 0,
      questions: c + w + Number(r.skipped),
    };
  });

  const redDays = series.filter((d) => d.score < DAILY_PASS_MARK).length;
  return {
    days,
    passMark: DAILY_PASS_MARK,
    series,
    summary: {
      activeDays: series.length,
      avgScore: series.length ? Math.round(series.reduce((a, d) => a + d.score, 0) / series.length) : 0,
      redDays,
      greenDays: series.length - redDays,
      bestDay: series.length ? series.reduce((b, d) => (d.score > b.score ? d : b)) : null,
    },
  };
}

// ─── getReadiness ─────────────────────────────────────────────────────

export interface ReadinessData {
  exam: { nameEn: string; nameHi: string; examDate: string | null; daysLeft: number | null } | null;
  score: number;
  components: { key: "accuracy" | "coverage" | "consistency" | "volume"; value: number; weight: number }[];
  estimatedMarks: number;
  totalMarks: number;
  negativeMarking: number;
  subjects: {
    subjectId: string;
    nameEn: string;
    nameHi: string;
    accuracy: number | null;
    questionsSolved: number;
    topicsDone: number;
    topicsTotal: number;
  }[];
  topicsDone: number;
  topicsTotal: number;
  testsTaken: number;
}

const TOTAL_EXAM_MARKS = Number(process.env.RANK_TOTAL_MARKS) > 0 ? Number(process.env.RANK_TOTAL_MARKS) : 150;

export async function getReadiness(userId: string): Promise<ReadinessData> {
  const exam = await queryOne<{
    name_en: string;
    name_hi: string;
    exam_date: string | null;
    days_left: string | null;
    exam_id: string;
  }>(
    `SELECT e.id AS exam_id, e.name_en, e.name_hi, to_char(e.exam_date, 'YYYY-MM-DD') AS exam_date,
            (e.exam_date - (NOW() AT TIME ZONE 'Asia/Kolkata')::date)::text AS days_left
     FROM users u INNER JOIN exams e ON e.id = u.selected_exam_id
     WHERE u.id = $1`,
    [userId],
  );

  const subjectRows = await queryMany<{
    subject_id: string;
    name_en: string;
    name_hi: string;
    solved: string;
    correct: string;
    topics_total: string;
    topics_done: string;
  }>(
    `SELECT s.id AS subject_id, s.name_en, s.name_hi,
       COALESCE((
         SELECT COUNT(*) FROM test_attempts ta
         INNER JOIN tests t ON t.id = ta.test_id
         LEFT JOIN topics tp ON tp.id = t.topic_id
         INNER JOIN attempt_answers aa ON aa.attempt_id = ta.id
         WHERE ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted')
           AND COALESCE(t.subject_id, tp.subject_id) = s.id AND aa.selected_option IS NOT NULL), 0) AS solved,
       COALESCE((
         SELECT COUNT(*) FROM test_attempts ta
         INNER JOIN tests t ON t.id = ta.test_id
         LEFT JOIN topics tp ON tp.id = t.topic_id
         INNER JOIN attempt_answers aa ON aa.attempt_id = ta.id
         INNER JOIN questions q ON q.id = aa.question_id
         WHERE ta.user_id = $1 AND ta.status IN ('submitted', 'auto_submitted')
           AND COALESCE(t.subject_id, tp.subject_id) = s.id AND aa.selected_option = q.correct_option), 0) AS correct,
       (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id) AS topics_total,
       (SELECT COUNT(*) FROM topic_progress tpr
          WHERE tpr.user_id = $1 AND tpr.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND tpr.subject_id = s.id AND tpr.status = 'completed'
            AND COALESCE(tpr.best_accuracy, 0) >= 60) AS topics_done
     FROM subjects s
     WHERE ($2::uuid IS NULL OR s.exam_id = $2::uuid)
     ORDER BY s.display_order, s.name_en`,
    [userId, exam?.exam_id ?? null],
  );

  const totals = await queryOne<{
    tests: string;
    correct: string;
    wrong: string;
    skipped: string;
    neg: string | null;
  }>(
    `SELECT COUNT(DISTINCT ta.test_id) AS tests,
            COALESCE(SUM(ta.correct_count), 0) AS correct,
            COALESCE(SUM(ta.wrong_count), 0) AS wrong,
            COALESCE(SUM(ta.skipped_count), 0) AS skipped,
            (SELECT MAX(negative_marking_ratio) FROM tests
               WHERE status = 'published' AND topic_id IS NULL
                 AND category IN ('full_mock', 'previous_year', 'daily_practice')) AS neg
     FROM test_attempts ta INNER JOIN tests t ON t.id = ta.test_id
     WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1) AND ta.status IN ('submitted', 'auto_submitted')`,
    [userId],
  );

  const active = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM user_activities
     WHERE user_id = $1
       AND activity_date > (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 14`,
    [userId],
  );

  const correct = Number(totals?.correct ?? 0);
  const wrong = Number(totals?.wrong ?? 0);
  const skipped = Number(totals?.skipped ?? 0);
  const negativeMarking = totals?.neg != null ? Math.round(Number(totals.neg) * 100) / 100 : 0.25;
  const testsTaken = Number(totals?.tests ?? 0);
  const attemptedQ = correct + wrong;
  const allQ = attemptedQ + skipped;

  const topicsTotal = subjectRows.reduce((a, r) => a + Number(r.topics_total), 0);
  const topicsDone = subjectRows.reduce((a, r) => a + Number(r.topics_done), 0);

  const accuracy = attemptedQ > 0 ? Math.round((correct / attemptedQ) * 100) : 0;
  const coverage = topicsTotal > 0 ? Math.round((topicsDone / topicsTotal) * 100) : 0;
  const consistency = Math.round((Math.min(14, Number(active?.n ?? 0)) / 14) * 100);
  const volume = Math.round(Math.min(1, testsTaken / 20) * 100);

  const components: ReadinessData["components"] = [
    { key: "accuracy", value: accuracy, weight: 40 },
    { key: "coverage", value: coverage, weight: 30 },
    { key: "consistency", value: consistency, weight: 15 },
    { key: "volume", value: volume, weight: 15 },
  ];
  const score = Math.round(components.reduce((a, c) => a + (c.value * c.weight) / 100, 0));

  const netFraction = allQ > 0 ? Math.max(0, (correct - negativeMarking * wrong) / allQ) : 0;

  return {
    exam: exam
      ? {
          nameEn: exam.name_en,
          nameHi: exam.name_hi,
          examDate: exam.exam_date,
          daysLeft: exam.days_left != null ? Math.max(0, Number(exam.days_left)) : null,
        }
      : null,
    score,
    components,
    estimatedMarks: Math.round(netFraction * TOTAL_EXAM_MARKS),
    totalMarks: TOTAL_EXAM_MARKS,
    negativeMarking,
    subjects: subjectRows.map((r) => ({
      subjectId: r.subject_id,
      nameEn: r.name_en,
      nameHi: r.name_hi,
      accuracy: Number(r.solved) > 0 ? Math.round((Number(r.correct) / Number(r.solved)) * 100) : null,
      questionsSolved: Number(r.solved),
      topicsDone: Number(r.topics_done),
      topicsTotal: Number(r.topics_total),
    })),
    topicsDone,
    topicsTotal,
    testsTaken,
  };
}
