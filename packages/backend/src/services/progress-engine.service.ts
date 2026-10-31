/**
 * Progress Engine Service — Learning journey & completion tracking.
 *
 * DIFFERENT from performance-analytics.service.ts (which handles test stats/accuracy).
 * This focuses on LEARNING COMPLETION: XP, milestones, heatmap, timeline, goals.
 *
 * XP System: 1 XP = 1 coin earned. Level = floor(totalCoins / 100). Progress = totalCoins % 100.
 * All date calculations use IST (Asia/Kolkata) timezone.
 */

import { queryOne, queryMany } from "@/db/index.js";

// ─── Constants ────────────────────────────────────────────────────────

const DEFAULT_DAILY_GOAL = 3;
const XP_PER_LEVEL = 100;

// ─── Types ────────────────────────────────────────────────────────────

export interface ProgressOverview {
  syllabusCompletion: number;
  subjectsCompleted: number;
  totalSubjects: number;
  topicsCompleted: number;
  totalTopics: number;
  lockedTopics: number;
  unlockedTopics: number;
  currentStreak: number;
  currentLevel: number;
  currentXP: number;
  nextLevelXP: number;
  xpProgress: number;
  estimatedCompletionDays: number;
}

export interface SubjectProgressItem {
  subjectId: string;
  nameEn: string;
  nameHi: string;
  completionPercent: number;
  completedTopics: number;
  remainingTopics: number;
  lockedTopics: number;
  averageAccuracy: number;
  averageAttempts: number;
}

export interface TopicProgressItem {
  topicId: string;
  nameEn: string;
  nameHi: string;
  subjectNameEn: string;
  status: string;
  bestAccuracy: number | null;
  attempts: number;
  completedAt: string | null;
}

export interface TimelineEntry {
  type: "topic_completed" | "test_completed" | "coins_earned" | "journey_started";
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface DailyGoals {
  target: number;
  completed: number;
  remaining: number;
  streakDays: number;
}

export interface HeatmapEntry {
  date: string;
  intensity: 0 | 1 | 2 | 3 | 4;
  questionsSolved: number;
  studyMinutes: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
  achievedAt: string | null;
}

export interface XPDetails {
  totalXP: number;
  currentLevel: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  recentXPGains: { amount: number; reason: string; date: string }[];
}

export interface ProgressHistory {
  weeklyCompletion: { week: string; topicsCompleted: number }[];
  monthlyCompletion: { month: string; topicsCompleted: number }[];
}

// ─── getProgressOverview ──────────────────────────────────────────────

export async function getProgressOverview(userId: string): Promise<ProgressOverview> {
  // Topic stats
  const topicStats = await queryOne<{
    total: string;
    completed: string;
    locked: string;
    unlocked: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed,
       COUNT(*) FILTER (WHERE status = 'locked') AS locked,
       COUNT(*) FILTER (WHERE status IN ('unlocked', 'in_progress')) AS unlocked
     FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))`,
    [userId],
  );

  // Subject stats
  const subjectStats = await queryOne<{
    total_subjects: string;
    completed_subjects: string;
  }>(
    `SELECT
       COUNT(DISTINCT subject_id) AS total_subjects,
       COUNT(DISTINCT subject_id) FILTER (
         WHERE subject_id NOT IN (
           SELECT subject_id FROM topic_progress
           WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND status != 'completed'
         )
       ) AS completed_subjects
     FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))`,
    [userId],
  );

  // XP (total coins earned)
  const xpRow = await queryOne<{ total_xp: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_xp FROM coin_transactions WHERE user_id = $1`,
    [userId],
  );

  // Current streak from user_activities (consecutive days including today IST)
  const streakRow = await queryOne<{ streak: string }>(
    `WITH ordered_dates AS (
       SELECT activity_date,
              activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::int AS grp
       FROM user_activities
       WHERE user_id = $1
         AND activity_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
     )
     SELECT COUNT(*) AS streak
     FROM ordered_dates
     WHERE grp = (
       SELECT activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::int
       FROM user_activities
       WHERE user_id = $1
         AND activity_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 1
       ORDER BY activity_date DESC
       LIMIT 1
     )`,
    [userId],
  );

  // Estimated completion: topics completed in last 7 days
  const recentRate = await queryOne<{ recent_completed: string }>(
    `SELECT COUNT(*) AS recent_completed
     FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
       AND status = 'completed'
       AND completed_at >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '7 days'`,
    [userId],
  );

  const totalTopics = Number(topicStats?.total ?? 0);
  const completedTopics = Number(topicStats?.completed ?? 0);
  const lockedTopics = Number(topicStats?.locked ?? 0);
  const unlockedTopics = Number(topicStats?.unlocked ?? 0);
  const totalSubjects = Number(subjectStats?.total_subjects ?? 0);
  const completedSubjects = Number(subjectStats?.completed_subjects ?? 0);
  const totalXP = Number(xpRow?.total_xp ?? 0);
  const currentStreak = Number(streakRow?.streak ?? 0);

  const currentLevel = Math.floor(totalXP / XP_PER_LEVEL);
  const xpInLevel = totalXP % XP_PER_LEVEL;
  const xpProgress = Math.round((xpInLevel / XP_PER_LEVEL) * 100);

  const recentCompleted = Number(recentRate?.recent_completed ?? 0);
  const remainingTopics = totalTopics - completedTopics;
  const dailyRate = recentCompleted / 7;
  const estimatedCompletionDays = dailyRate > 0 ? Math.ceil(remainingTopics / dailyRate) : 0;

  return {
    syllabusCompletion: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
    subjectsCompleted: completedSubjects,
    totalSubjects,
    topicsCompleted: completedTopics,
    totalTopics,
    lockedTopics,
    unlockedTopics,
    currentStreak,
    currentLevel,
    currentXP: totalXP,
    nextLevelXP: (currentLevel + 1) * XP_PER_LEVEL,
    xpProgress,
    estimatedCompletionDays,
  };
}

// ─── getSubjectProgress ───────────────────────────────────────────────

export async function getSubjectProgress(userId: string): Promise<SubjectProgressItem[]> {
  const rows = await queryMany<{
    subject_id: string;
    name_en: string;
    name_hi: string;
    total_topics: string;
    completed_topics: string;
    locked_topics: string;
    avg_accuracy: string;
    avg_attempts: string;
  }>(
    `SELECT
       s.id AS subject_id,
       s.name_en,
       s.name_hi,
       COUNT(tp.id) AS total_topics,
       COUNT(tp.id) FILTER (WHERE tp.status = 'completed') AS completed_topics,
       COUNT(tp.id) FILTER (WHERE tp.status = 'locked') AS locked_topics,
       COALESCE(AVG(tp.best_accuracy) FILTER (WHERE tp.status = 'completed'), 0) AS avg_accuracy,
       COALESCE(AVG(tp.attempts_count) FILTER (WHERE tp.attempts_count > 0), 0) AS avg_attempts
     FROM topic_progress tp
     JOIN subjects s ON s.id = tp.subject_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
     GROUP BY s.id, s.name_en, s.name_hi, s.display_order
     ORDER BY s.display_order ASC`,
    [userId],
  );

  return rows.map((r) => {
    const total = Number(r.total_topics);
    const completed = Number(r.completed_topics);
    const locked = Number(r.locked_topics);
    return {
      subjectId: r.subject_id,
      nameEn: r.name_en,
      nameHi: r.name_hi,
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      completedTopics: completed,
      remainingTopics: total - completed,
      lockedTopics: locked,
      averageAccuracy: Math.round(Number(r.avg_accuracy)),
      averageAttempts: Math.round(Number(r.avg_attempts) * 10) / 10,
    };
  });
}

// ─── getTopicProgress ─────────────────────────────────────────────────

export async function getTopicProgress(userId: string): Promise<TopicProgressItem[]> {
  const rows = await queryMany<{
    topic_id: string;
    name_en: string;
    name_hi: string;
    subject_name_en: string;
    status: string;
    best_accuracy: number | null;
    attempts_count: number;
    completed_at: string | null;
  }>(
    `SELECT
       tp.topic_id,
       t.name_en,
       t.name_hi,
       s.name_en AS subject_name_en,
       tp.status,
       tp.best_accuracy,
       tp.attempts_count,
       tp.completed_at::text AS completed_at
     FROM topic_progress tp
     JOIN topics t ON t.id = tp.topic_id
     JOIN subjects s ON s.id = tp.subject_id
     WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
     ORDER BY s.display_order ASC, t.display_order ASC`,
    [userId],
  );

  return rows.map((r) => ({
    topicId: r.topic_id,
    nameEn: r.name_en,
    nameHi: r.name_hi,
    subjectNameEn: r.subject_name_en,
    status: r.status,
    bestAccuracy: r.best_accuracy,
    attempts: r.attempts_count,
    completedAt: r.completed_at,
  }));
}

// ─── getTimeline ──────────────────────────────────────────────────────

export async function getTimeline(userId: string, limit = 20): Promise<TimelineEntry[]> {
  const rows = await queryMany<{
    type: string;
    title: string;
    description: string;
    timestamp: string;
    metadata: string;
  }>(
    `(
       SELECT
         'topic_completed' AS type,
         'Topic completed: ' || t.name_en AS title,
         'Completed with ' || tp.best_accuracy || '% accuracy' AS description,
         tp.completed_at::text AS timestamp,
         json_build_object('topicId', tp.topic_id, 'accuracy', tp.best_accuracy)::text AS metadata
       FROM topic_progress tp
       JOIN topics t ON t.id = tp.topic_id
       WHERE tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND tp.completed_at IS NOT NULL
     )
     UNION ALL
     (
       SELECT
         'test_completed' AS type,
         'Test completed: ' || ts.title AS title,
         'Score: ' || COALESCE(ta.percentage::text, '0') || '%' AS description,
         ta.submitted_at::text AS timestamp,
         json_build_object('attemptId', ta.id, 'testId', ta.test_id, 'percentage', ta.percentage)::text AS metadata
       FROM test_attempts ta
       JOIN tests ts ON ts.id = ta.test_id
       WHERE ta.user_id = $1 AND ts.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1) AND ta.status IN ('submitted', 'auto_submitted')
     )
     UNION ALL
     (
       SELECT
         'coins_earned' AS type,
         'Coins earned: +' || ct.amount AS title,
         ct.type || ' reward' AS description,
         ct.created_at::text AS timestamp,
         json_build_object('amount', ct.amount, 'reason', ct.type)::text AS metadata
       FROM coin_transactions ct
       WHERE ct.user_id = $1
     )
     UNION ALL
     (
       SELECT
         'journey_started' AS type,
         'Learning journey started' AS title,
         'Welcome to your learning path!' AS description,
         ua.created_at::text AS timestamp,
         json_build_object('date', ua.activity_date)::text AS metadata
       FROM user_activities ua
       WHERE ua.user_id = $1
       ORDER BY ua.activity_date ASC
       LIMIT 1
     )
     ORDER BY timestamp DESC
     LIMIT $2`,
    [userId, limit],
  );

  return rows.map((r) => ({
    type: r.type as TimelineEntry["type"],
    title: r.title,
    description: r.description,
    timestamp: r.timestamp,
    metadata: parseJsonSafe(r.metadata),
  }));
}

// ─── getDailyGoals ────────────────────────────────────────────────────

export async function getDailyGoals(userId: string): Promise<DailyGoals> {
  // Tests submitted today (IST)
  const todayRow = await queryOne<{ completed: string }>(
    `SELECT COUNT(*) AS completed
     FROM test_attempts
     WHERE user_id = $1
       AND status IN ('submitted', 'auto_submitted')
       AND (submitted_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
    [userId],
  );

  // Current streak
  const streakRow = await queryOne<{ streak: string }>(
    `WITH ordered_dates AS (
       SELECT activity_date,
              activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::int AS grp
       FROM user_activities
       WHERE user_id = $1
         AND activity_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
     )
     SELECT COUNT(*) AS streak
     FROM ordered_dates
     WHERE grp = (
       SELECT activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::int
       FROM user_activities
       WHERE user_id = $1
         AND activity_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 1
       ORDER BY activity_date DESC
       LIMIT 1
     )`,
    [userId],
  );

  const completed = Number(todayRow?.completed ?? 0);
  const target = DEFAULT_DAILY_GOAL;

  return {
    target,
    completed,
    remaining: Math.max(0, target - completed),
    streakDays: Number(streakRow?.streak ?? 0),
  };
}

// ─── getHeatmap ───────────────────────────────────────────────────────

export async function getHeatmap(userId: string): Promise<HeatmapEntry[]> {
  const rows = await queryMany<{
    date: string;
    questions_solved: string;
    study_minutes: string;
  }>(
    `WITH days AS (
       SELECT d::date AS day
       FROM generate_series(
         (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '364 days',
         (NOW() AT TIME ZONE 'Asia/Kolkata')::date,
         '1 day'
       ) AS d
     ),
     daily_questions AS (
       SELECT
         (aa.answered_at AT TIME ZONE 'Asia/Kolkata')::date AS answer_day,
         COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL) AS solved
       FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND aa.answered_at IS NOT NULL
         AND (aa.answered_at AT TIME ZONE 'Asia/Kolkata')::date
             >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '364 days'
       GROUP BY answer_day
     ),
     daily_time AS (
       SELECT
         (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date AS attempt_day,
         COALESCE(SUM(ta.time_taken_seconds), 0) AS total_seconds
       FROM test_attempts ta
       WHERE ta.user_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date
             >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '364 days'
       GROUP BY attempt_day
     ),
     activity_days AS (
       SELECT activity_date
       FROM user_activities
       WHERE user_id = $1
         AND activity_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '364 days'
     )
     SELECT
       TO_CHAR(d.day, 'YYYY-MM-DD') AS date,
       COALESCE(dq.solved, 0) AS questions_solved,
       COALESCE(ROUND(dt.total_seconds / 60.0), 0) AS study_minutes
     FROM days d
     LEFT JOIN daily_questions dq ON dq.answer_day = d.day
     LEFT JOIN daily_time dt ON dt.attempt_day = d.day
     LEFT JOIN activity_days ad ON ad.activity_date = d.day
     WHERE dq.solved IS NOT NULL OR dt.total_seconds IS NOT NULL OR ad.activity_date IS NOT NULL
     ORDER BY d.day ASC`,
    [userId],
  );

  // Generate full 365-day heatmap with intensity calculation
  const dataMap = new Map<string, { questions: number; minutes: number }>();
  for (const r of rows) {
    dataMap.set(r.date, {
      questions: Number(r.questions_solved),
      minutes: Number(r.study_minutes),
    });
  }

  const result: HeatmapEntry[] = [];
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const data = dataMap.get(dateStr);
    const questions = data?.questions ?? 0;
    const minutes = data?.minutes ?? 0;

    let intensity: 0 | 1 | 2 | 3 | 4 = 0;
    if (questions >= 61) intensity = 4;
    else if (questions >= 31) intensity = 3;
    else if (questions >= 11) intensity = 2;
    else if (questions >= 1) intensity = 1;

    result.push({
      date: dateStr,
      intensity,
      questionsSolved: questions,
      studyMinutes: minutes,
    });
  }

  return result;
}

// ─── getMilestones ────────────────────────────────────────────────────

export async function getMilestones(userId: string): Promise<Milestone[]> {
  // Get completion stats
  const topicStats = await queryOne<{
    total: string;
    completed: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed
     FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))`,
    [userId],
  );

  const totalTopics = Number(topicStats?.total ?? 0);
  const completedTopics = Number(topicStats?.completed ?? 0);
  const syllabusCompletion = totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0;

  // Test count
  const testCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM test_attempts
     WHERE user_id = $1 AND status IN ('submitted', 'auto_submitted')`,
    [userId],
  );
  const tests = Number(testCount?.count ?? 0);

  // Questions answered count
  const questionCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM attempt_answers aa
     JOIN test_attempts ta ON ta.id = aa.attempt_id
     WHERE ta.user_id = $1
       AND ta.status IN ('submitted', 'auto_submitted')
       AND aa.selected_option IS NOT NULL`,
    [userId],
  );
  const questions = Number(questionCount?.count ?? 0);

  // Current streak
  const streakRow = await queryOne<{ streak: string }>(
    `WITH ordered_dates AS (
       SELECT activity_date,
              activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::int AS grp
       FROM user_activities
       WHERE user_id = $1
         AND activity_date <= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
     )
     SELECT COUNT(*) AS streak
     FROM ordered_dates
     WHERE grp = (
       SELECT activity_date - (ROW_NUMBER() OVER (ORDER BY activity_date DESC))::int
       FROM user_activities
       WHERE user_id = $1
         AND activity_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 1
       ORDER BY activity_date DESC
       LIMIT 1
     )`,
    [userId],
  );
  const streak = Number(streakRow?.streak ?? 0);

  // Completion dates (for achievedAt)
  const firstCompletionDate = await queryOne<{ first_at: string }>(
    `SELECT MIN(completed_at)::text AS first_at FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND completed_at IS NOT NULL`,
    [userId],
  );

  const milestones: Milestone[] = [
    buildMilestone("25_percent", "25% Complete", "Complete 25% of the syllabus", syllabusCompletion, 25, firstCompletionDate?.first_at),
    buildMilestone("50_percent", "50% Complete", "Complete 50% of the syllabus", syllabusCompletion, 50, firstCompletionDate?.first_at),
    buildMilestone("75_percent", "75% Complete", "Complete 75% of the syllabus", syllabusCompletion, 75, firstCompletionDate?.first_at),
    buildMilestone("100_percent", "100% Complete", "Complete the entire syllabus", syllabusCompletion, 100, firstCompletionDate?.first_at),
    buildMilestone("first_test", "First Test", "Complete your first test", tests, 1, null),
    buildMilestone("10_tests", "10 Tests", "Complete 10 tests", tests, 10, null),
    buildMilestone("50_tests", "50 Tests", "Complete 50 tests", tests, 50, null),
    buildMilestone("100_questions", "100 Questions", "Answer 100 questions", questions, 100, null),
    buildMilestone("1000_questions", "1000 Questions", "Answer 1000 questions", questions, 1000, null),
    buildMilestone("7_day_streak", "7 Day Streak", "Maintain a 7-day activity streak", streak, 7, null),
    buildMilestone("30_day_streak", "30 Day Streak", "Maintain a 30-day activity streak", streak, 30, null),
    buildMilestone("100_day_streak", "100 Day Streak", "Maintain a 100-day activity streak", streak, 100, null),
  ];

  return milestones;
}

// ─── getXPDetails ─────────────────────────────────────────────────────

export async function getXPDetails(userId: string): Promise<XPDetails> {
  const xpRow = await queryOne<{ total_xp: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_xp FROM coin_transactions WHERE user_id = $1`,
    [userId],
  );

  const totalXP = Number(xpRow?.total_xp ?? 0);
  const currentLevel = Math.floor(totalXP / XP_PER_LEVEL);
  const xpInCurrentLevel = totalXP % XP_PER_LEVEL;

  // Recent XP gains (last 5 transactions)
  const recentRows = await queryMany<{
    amount: number;
    type: string;
    created_at: string;
  }>(
    `SELECT amount, type, created_at::text AS created_at
     FROM coin_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId],
  );

  return {
    totalXP,
    currentLevel,
    xpInCurrentLevel,
    xpForNextLevel: XP_PER_LEVEL,
    progressPercent: Math.round((xpInCurrentLevel / XP_PER_LEVEL) * 100),
    recentXPGains: recentRows.map((r) => ({
      amount: r.amount,
      reason: r.type,
      date: r.created_at,
    })),
  };
}

// ─── getProgressHistory ───────────────────────────────────────────────

export async function getProgressHistory(userId: string): Promise<ProgressHistory> {
  // Weekly: last 4 weeks
  const weeklyRows = await queryMany<{
    week: string;
    topics_completed: string;
  }>(
    `SELECT
       TO_CHAR(DATE_TRUNC('week', completed_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS week,
       COUNT(*) AS topics_completed
     FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
       AND status = 'completed'
       AND completed_at IS NOT NULL
       AND completed_at >= (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '4 weeks'
     GROUP BY DATE_TRUNC('week', completed_at AT TIME ZONE 'Asia/Kolkata')
     ORDER BY week ASC`,
    [userId],
  );

  // Monthly: last 6 months
  const monthlyRows = await queryMany<{
    month: string;
    topics_completed: string;
  }>(
    `SELECT
       TO_CHAR(DATE_TRUNC('month', completed_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM') AS month,
       COUNT(*) AS topics_completed
     FROM topic_progress
     WHERE user_id = $1 AND subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1))
       AND status = 'completed'
       AND completed_at IS NOT NULL
       AND completed_at >= (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '6 months'
     GROUP BY DATE_TRUNC('month', completed_at AT TIME ZONE 'Asia/Kolkata')
     ORDER BY month ASC`,
    [userId],
  );

  return {
    weeklyCompletion: weeklyRows.map((r) => ({
      week: r.week,
      topicsCompleted: Number(r.topics_completed),
    })),
    monthlyCompletion: monthlyRows.map((r) => ({
      month: r.month,
      topicsCompleted: Number(r.topics_completed),
    })),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function buildMilestone(
  id: string,
  title: string,
  description: string,
  current: number,
  target: number,
  achievedAt: string | null | undefined,
): Milestone {
  const achieved = current >= target;
  const progress = Math.min(100, Math.round((current / target) * 100));
  return {
    id,
    title,
    description,
    achieved,
    progress,
    achievedAt: achieved ? (achievedAt ?? null) : null,
  };
}

function parseJsonSafe(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
