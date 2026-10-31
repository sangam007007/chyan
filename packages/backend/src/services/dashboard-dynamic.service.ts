/**
 * Dashboard Dynamic Service — Computation functions for the 7 dynamic dashboard widgets.
 *
 * Provides data for:
 * 1. Today's Plan — active study plan with completion status
 * 2. Continue Learning — latest incomplete topic (accuracy < 80%)
 * 3. Performance Stats — all-time stats + 7-day chart
 * 4. Weak Areas — subjects with lowest accuracy
 * 5. Revision Due — revision marks due today
 * 6. Recommendations — recommended tests based on weak areas
 * 7. Daily Challenge — today's answered count vs target
 *
 * All functions accept userId and use IST date boundaries.
 */

import { queryOne, queryMany } from "@/db/index.js";
import { TOPIC_MINUTES, REVIEW_MINUTES, expectedTests } from "@/services/plan-builder.service.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface TodayPlanItem {
  id: string;
  subjectNameEn: string;
  subjectNameHi: string;
  durationMinutes: number;
  /** About how long this subject takes: its topics and tests (see plan-builder.service.ts) */
  estimatedMinutes: number;
  /** Minutes of that already done today (all of it once ticked off by hand) */
  doneMinutes: number;
  /** True when every topic and test selected for this subject is done today (or it was ticked manually). */
  completed: boolean;
  topicCount: number;
  testCount: number;
  /** Topics + tests selected for this subject, and how many of them are done today. */
  tasksTotal: number;
  tasksDone: number;
}

export interface TodayPlanResponse {
  planId: string;
  planName: string;
  items: TodayPlanItem[];
  /** Subjects fully done / total subjects in today's plan. */
  completedCount: number;
  totalCount: number;
  /** Topics + tests done today across the plan — the single "today's progress" used by every screen. */
  tasksDone: number;
  tasksTotal: number;
  progressPercent: number;
  /** About how long the whole plan takes, how much is done, and how much is left (minutes) */
  estimatedMinutes: number;
  doneMinutes: number;
  remainingMinutes: number;
}

export interface ContinueLearningResponse {
  subjectNameEn: string;
  subjectNameHi: string;
  topicNameEn: string;
  topicNameHi: string;
  /** Accuracy of the latest attempt on this topic: correct / answered (not the test score). */
  accuracyPercent: number;
  /** Score % of the latest test attempt on this topic, the same number the test result shows. */
  lastScorePercent: number;
  /** Topic completion, same formula as the topic page: (parts done + tests passed) / (parts + tests). */
  progressPercent: number;
  completedParts: number;
  totalParts: number;
  completedTests: number;
  totalTests: number;
  topicId: string;
  subjectId: string;
}

export interface WeeklyChartEntry {
  date: string;
  accuracy: number | null;
}

export interface PerformanceBucket {
  /** First day of the bucket (YYYY-MM-DD, IST) */
  start: string;
  accuracy: number | null;
  attempted: number;
}

export interface PerformanceStatsResponse {
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  /** Accuracy of the previous equal-length window (kept for older screens). */
  previousAccuracy: number | null;
  /** Daily accuracy of the last 7 days (kept for older screens). */
  weeklyChart: WeeklyChartEntry[];
  period: string;
  /** What this window is compared with. Null for "all". */
  comparison: {
    previous: { attempted: number; correct: number; accuracy: number } | null;
    /** Accuracy change in percentage points; null when either window has too few answers. */
    delta: number | null;
    /** Questions answered now minus the comparison window. */
    attemptedDelta: number | null;
    minQuestions: number;
  };
  /** Chart that matches the selected window (days, 6-day buckets, 30-day buckets or months). */
  chart: { kind: 'day' | 'bucket' | 'month'; buckets: PerformanceBucket[] };
  /** Lowest-accuracy subject in the window, only when it is below 70%. */
  weakestSubject: { subjectId: string; nameEn: string; nameHi: string; accuracy: number } | null;
  /** Best calendar week so far (only for "all"). */
  bestWeek: { weekStart: string; accuracy: number; attempted: number } | null;
}

export interface WeakAreaItem {
  subjectEn: string;
  subjectHi: string;
  accuracy: number;
  totalQuestions: number;
  incorrectCount: number;
  topics: WeakTopicItem[];
}

export interface WeakTopicItem {
  topicId: string;
  topicEn: string;
  topicHi: string;
  accuracy: number;
  totalQuestions: number;
  incorrectCount: number;
  previousAccuracy: number | null;
}

export interface RevisionDueItem {
  id: string;
  questionText: string;
  subject: string;
  createdAt: string;
}

export interface RecommendationItem {
  testId: string;
  titleEn: string;
  titleHi: string;
  questionCount: number;
  category: string;
}

export interface DailyChallengeResponse {
  solved: number;
  target: number;
}

// ─── 1. Today's Plan ──────────────────────────────────────────────────

/**
 * Returns the active plan for today (IST) with items and completion status.
 * Returns null if no active plan exists for today.
 */
export async function getTodayPlan(userId: string): Promise<TodayPlanResponse | null> {
  const rows = await queryMany<{
    plan_id: string;
    plan_name: string;
    item_id: string;
    subject_name_en: string;
    subject_name_hi: string;
    duration_minutes: number;
    display_order: number;
    completed: boolean;
    topic_count: number;
    test_count: number;
    topics_total: string;
    topics_done: string;
    tests_total: string;
    tests_done: string;
    test_minutes_total: string;
    test_minutes_done: string;
  }>(
    `SELECT
      sp.id AS plan_id,
      sp.name AS plan_name,
      spi.id AS item_id,
      s.name_en AS subject_name_en,
      s.name_hi AS subject_name_hi,
      spi.duration_minutes,
      spi.display_order,
      COALESCE(spi.topic_count, 0) AS topic_count,
      COALESCE(spi.test_count, 0) AS test_count,
      CASE WHEN pic.id IS NOT NULL THEN true ELSE false END AS completed,
      (SELECT COUNT(*) FROM study_plan_item_topics x WHERE x.plan_item_id = spi.id)::text AS topics_total,
      (SELECT COUNT(*) FROM study_plan_item_topics x
         JOIN topic_progress tp ON tp.topic_id = x.topic_id AND tp.user_id = $1 AND tp.subject_id IN (SELECT id FROM subjects WHERE exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)) AND tp.status = 'completed'
          AND (tp.completed_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        WHERE x.plan_item_id = spi.id)::text AS topics_done,
      (SELECT COUNT(*) FROM study_plan_item_tests x WHERE x.plan_item_id = spi.id)::text AS tests_total,
      (SELECT COUNT(*) FROM study_plan_item_tests x
        WHERE x.plan_item_id = spi.id
          AND EXISTS (
            SELECT 1 FROM test_attempts ta
            WHERE ta.test_id = x.test_id AND ta.user_id = $1
              AND ta.status IN ('submitted', 'auto_submitted')
              AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          ))::text AS tests_done,
      -- minutes: a test is its own timer plus time to read the explanations (see plan-builder.service.ts)
      (SELECT COALESCE(SUM(t.duration_minutes + $2), 0) FROM study_plan_item_tests x
         JOIN tests t ON t.id = x.test_id WHERE x.plan_item_id = spi.id)::text AS test_minutes_total,
      (SELECT COALESCE(SUM(t.duration_minutes + $2), 0) FROM study_plan_item_tests x
         JOIN tests t ON t.id = x.test_id
        WHERE x.plan_item_id = spi.id
          AND EXISTS (
            SELECT 1 FROM test_attempts ta
            WHERE ta.test_id = x.test_id AND ta.user_id = $1
              AND ta.status IN ('submitted', 'auto_submitted')
              AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
          ))::text AS test_minutes_done
    FROM user_active_plans uap
    JOIN study_plans sp ON sp.id = uap.plan_id
    JOIN study_plan_items spi ON spi.plan_id = sp.id
    JOIN subjects s ON s.id = spi.subject_id
    LEFT JOIN plan_item_completions pic
      ON pic.item_id = spi.id
      AND pic.user_id = $1
      AND pic.completion_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
    WHERE uap.user_id = $1
      AND uap.plan_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      AND s.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
    ORDER BY spi.display_order ASC`,
    [userId, REVIEW_MINUTES],
  );

  if (rows.length === 0) {
    return null;
  }

  const items: TodayPlanItem[] = rows.map((row) => {
    const tasksTotal = Number(row.topics_total) + Number(row.tests_total);
    const tasksDone = Number(row.topics_done) + Number(row.tests_done);
    // With picked topics/tests the time is worked out from them; older plans keep the minutes they were saved with
    const estimated = tasksTotal > 0
      ? Number(row.topics_total) * TOPIC_MINUTES + Number(row.test_minutes_total)
      : row.duration_minutes;
    const doneRaw = Number(row.topics_done) * TOPIC_MINUTES + Number(row.test_minutes_done);
    // Done only when everything picked for the subject was really done today. (Old plans with nothing picked keep their hand tick.)
    const completed = tasksTotal > 0 ? tasksDone >= tasksTotal : row.completed;
    return {
      id: row.item_id,
      subjectNameEn: row.subject_name_en,
      subjectNameHi: row.subject_name_hi,
      durationMinutes: estimated,
      estimatedMinutes: estimated,
      // a subject ticked off by hand counts as fully done
      doneMinutes: completed ? estimated : Math.min(estimated, doneRaw),
      // Done when ticked by hand, or when everything selected for the subject is done today
      completed,
      topicCount: row.topic_count,
      testCount: row.test_count,
      tasksTotal,
      tasksDone,
    };
  });

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const estimatedMinutes = items.reduce((a, i) => a + i.estimatedMinutes, 0);
  const doneMinutes = items.reduce((a, i) => a + i.doneMinutes, 0);
  const tasksTotal = items.reduce((a, i) => a + i.tasksTotal, 0);
  const tasksDone = items.reduce((a, i) => a + Math.min(i.tasksDone, i.tasksTotal), 0);
  // Task-based when topics/tests were selected; otherwise fall back to subjects ticked off
  const progressPercent = tasksTotal > 0
    ? Math.min(100, Math.round((tasksDone / tasksTotal) * 100))
    : totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    planId: rows[0].plan_id,
    planName: rows[0].plan_name,
    items,
    completedCount,
    totalCount,
    tasksDone,
    tasksTotal,
    progressPercent,
    estimatedMinutes,
    doneMinutes,
    remainingMinutes: Math.max(0, estimatedMinutes - doneMinutes),
  };
}

// ─── 2. Continue Learning ─────────────────────────────────────────────

/** Completion of one topic. Must match the Study > Topic page (parts completed + tests passed). */
async function getTopicCompletion(userId: string, topicId: string) {
  const parts = await queryOne<{ total: string; done: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE tpp.status = 'completed') AS done
     FROM topic_parts tp
     LEFT JOIN topic_part_progress tpp ON tpp.part_id = tp.id AND tpp.user_id = $1
     WHERE tp.topic_id = $2`,
    [userId, topicId],
  );
  const tests = await queryOne<{ total: string; done: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (
              WHERE ta.percentage >= (ts.passing_marks::numeric / NULLIF(ts.total_marks, 0) * 100)
            ) AS done
     FROM tests ts
     LEFT JOIN LATERAL (
       SELECT percentage FROM test_attempts
       WHERE test_id = ts.id AND user_id = $1 AND status IN ('submitted', 'auto_submitted')
       ORDER BY percentage DESC NULLS LAST LIMIT 1
     ) ta ON true
     WHERE ts.topic_id = $2 AND ts.status = 'published'`,
    [userId, topicId],
  );
  const totalParts = Number(parts?.total ?? 0);
  const completedParts = Number(parts?.done ?? 0);
  const totalTests = Number(tests?.total ?? 0);
  const completedTests = Number(tests?.done ?? 0);
  // tests that do not exist yet count as not done, so a topic is never 100% without its tests
  const totalItems = totalParts + expectedTests(totalTests);
  const progressPercent = totalItems > 0 ? Math.round(((completedParts + completedTests) / totalItems) * 100) : 0;
  return { totalParts, completedParts, totalTests, completedTests, progressPercent };
}

/**
 * The topic the student worked on most recently that is not finished yet.
 * Returns null if every recently attempted topic is already complete.
 * The ring on the card shows the topic's completion, so it matches the topic page.
 */
export async function getContinueLearning(userId: string): Promise<ContinueLearningResponse | null> {
  const candidates = await queryMany<{
    topic_id: string;
    subject_id: string;
    topic_name_en: string;
    topic_name_hi: string;
    subject_name_en: string;
    subject_name_hi: string;
    accuracy_percent: number;
    last_score_percent: number | null;
  }>(
    `WITH latest AS (
       SELECT DISTINCT ON (t.topic_id)
         t.topic_id, t.subject_id, ta.submitted_at, ta.percentage AS score_pct,
         COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL) AS attempted,
         COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option) AS correct_count
       FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       JOIN attempt_answers aa ON aa.attempt_id = ta.id
       JOIN questions q ON q.id = aa.question_id
       WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
         AND ta.status IN ('submitted', 'auto_submitted')
         AND t.category = 'subject_wise'
         AND t.topic_id IS NOT NULL
       GROUP BY t.topic_id, t.subject_id, ta.id, ta.submitted_at, ta.percentage
       ORDER BY t.topic_id, ta.submitted_at DESC
     )
     SELECT l.topic_id, l.subject_id,
            tp.name_en AS topic_name_en, tp.name_hi AS topic_name_hi,
            s.name_en AS subject_name_en, s.name_hi AS subject_name_hi,
            COALESCE(ROUND(l.correct_count::numeric / NULLIF(l.attempted, 0) * 100)::int, 0) AS accuracy_percent,
            ROUND(l.score_pct)::int AS last_score_percent
     FROM latest l
     JOIN topics tp ON tp.id = l.topic_id
     JOIN subjects s ON s.id = l.subject_id
     ORDER BY l.submitted_at DESC
     LIMIT 10`,
    [userId],
  );

  for (const row of candidates) {
    const c = await getTopicCompletion(userId, row.topic_id);
    if (c.progressPercent >= 100) continue;
    return {
      subjectNameEn: row.subject_name_en,
      subjectNameHi: row.subject_name_hi,
      topicNameEn: row.topic_name_en,
      topicNameHi: row.topic_name_hi,
      accuracyPercent: row.accuracy_percent,
      lastScorePercent: row.last_score_percent ?? row.accuracy_percent,
      progressPercent: c.progressPercent,
      completedParts: c.completedParts,
      totalParts: c.totalParts,
      completedTests: c.completedTests,
      totalTests: c.totalTests,
      topicId: row.topic_id,
      subjectId: row.subject_id,
    };
  }

  return null;
}

// ─── 3. Performance Stats ─────────────────────────────────────────────

const PERF_MIN_QUESTIONS = 10;

const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/**
 * Performance for the dashboard card.
 *
 * Each period is compared with the window right before it, of the same length:
 *  - week       Monday → today            vs the same number of days of last week
 *  - last_week  last Monday → Sunday      vs the week before
 *  - month      last 30 days              vs the 30 days before
 *  - 6months    last 180 days             vs the 180 days before
 *  - all        everything, no comparison
 * Accuracy = correct / answered. A comparison needs enough questions in both windows.
 */
export async function getPerformanceStats(userId: string, period: string = 'all'): Promise<PerformanceStatsResponse> {
  const rows = await queryMany<{
    day: string;
    subject_id: string | null;
    name_en: string | null;
    name_hi: string | null;
    attempted: string;
    correct: string;
  }>(
    `SELECT
       to_char((ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day,
       s.id AS subject_id, s.name_en, s.name_hi,
       COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL) AS attempted,
       COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option) AS correct
     FROM test_attempts ta
     JOIN tests t ON t.id = ta.test_id
     LEFT JOIN topics tp ON tp.id = t.topic_id
     LEFT JOIN subjects s ON s.id = COALESCE(t.subject_id, tp.subject_id)
     JOIN attempt_answers aa ON aa.attempt_id = ta.id
     JOIN questions q ON q.id = aa.question_id
     WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
       AND ta.status IN ('submitted', 'auto_submitted')
       AND ta.submitted_at IS NOT NULL
     GROUP BY 1, s.id, s.name_en, s.name_hi`,
    [userId],
  );

  const facts = rows.map((r) => ({
    day: r.day,
    subjectId: r.subject_id,
    nameEn: r.name_en,
    nameHi: r.name_hi,
    attempted: Number(r.attempted),
    correct: Number(r.correct),
  }));

  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const today = ist.toISOString().slice(0, 10);
  const dow = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const weekStart = addDays(today, -dow);

  const sum = (from: string | null, to: string) => {
    let attempted = 0;
    let correct = 0;
    for (const f of facts) {
      if ((from === null || f.day >= from) && f.day <= to) {
        attempted += f.attempted;
        correct += f.correct;
      }
    }
    return { attempted, correct, accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0 };
  };

  // Current window and the window it is compared with
  let cur: { from: string | null; to: string };
  let prev: { from: string; to: string } | null = null;
  if (period === 'week') {
    cur = { from: weekStart, to: today };
    prev = { from: addDays(weekStart, -7), to: addDays(weekStart, -7 + dow) };
  } else if (period === 'last_week') {
    cur = { from: addDays(weekStart, -7), to: addDays(weekStart, -1) };
    prev = { from: addDays(weekStart, -14), to: addDays(weekStart, -8) };
  } else if (period === 'month') {
    cur = { from: addDays(today, -29), to: today };
    prev = { from: addDays(today, -59), to: addDays(today, -30) };
  } else if (period === '6months') {
    cur = { from: addDays(today, -179), to: today };
    prev = { from: addDays(today, -359), to: addDays(today, -180) };
  } else {
    cur = { from: null, to: today };
  }

  const now = sum(cur.from, cur.to);
  const before = prev ? sum(prev.from, prev.to) : null;
  const delta =
    before && now.attempted >= PERF_MIN_QUESTIONS && before.attempted >= PERF_MIN_QUESTIONS
      ? now.accuracy - before.accuracy
      : null;

  // Chart that matches the window
  const bucketOf = (from: string, to: string): PerformanceBucket => {
    const t = sum(from, to);
    return { start: from, accuracy: t.attempted > 0 ? t.accuracy : null, attempted: t.attempted };
  };
  let chart: PerformanceStatsResponse['chart'];
  if (period === 'week' || period === 'last_week') {
    const start = cur.from as string;
    chart = { kind: 'day', buckets: Array.from({ length: 7 }, (_, i) => bucketOf(addDays(start, i), addDays(start, i))) };
  } else if (period === 'month') {
    const start = cur.from as string;
    chart = { kind: 'bucket', buckets: Array.from({ length: 5 }, (_, i) => bucketOf(addDays(start, i * 6), addDays(start, i * 6 + 5))) };
  } else if (period === '6months') {
    const start = cur.from as string;
    chart = { kind: 'bucket', buckets: Array.from({ length: 6 }, (_, i) => bucketOf(addDays(start, i * 30), addDays(start, i * 30 + 29))) };
  } else {
    // Calendar months, newest 8
    const first = facts.length ? facts.reduce((m, f) => (f.day < m ? f.day : m), today) : today;
    const months: PerformanceBucket[] = [];
    let y = Number(today.slice(0, 4));
    let m = Number(today.slice(5, 7));
    for (let i = 0; i < 8; i++) {
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // last day of month
      if (end < first.slice(0, 7) + '-01') break;
      months.unshift(bucketOf(start, end));
      m -= 1;
      if (m === 0) { m = 12; y -= 1; }
    }
    chart = { kind: 'month', buckets: months };
  }

  // Weakest subject in the window (needs a few answers, and must really be weak)
  const bySubject = new Map<string, { nameEn: string; nameHi: string; attempted: number; correct: number }>();
  for (const f of facts) {
    if (!f.subjectId || (cur.from !== null && f.day < cur.from) || f.day > cur.to) continue;
    const e = bySubject.get(f.subjectId) ?? { nameEn: f.nameEn ?? '', nameHi: f.nameHi ?? '', attempted: 0, correct: 0 };
    e.attempted += f.attempted;
    e.correct += f.correct;
    bySubject.set(f.subjectId, e);
  }
  let weakestSubject: PerformanceStatsResponse['weakestSubject'] = null;
  for (const [subjectId, e] of bySubject) {
    if (e.attempted < 5) continue;
    const accuracy = Math.round((e.correct / e.attempted) * 100);
    if (accuracy < 70 && (weakestSubject === null || accuracy < weakestSubject.accuracy)) {
      weakestSubject = { subjectId, nameEn: e.nameEn, nameHi: e.nameHi, accuracy };
    }
  }

  // Best calendar week (all-time view)
  let bestWeek: PerformanceStatsResponse['bestWeek'] = null;
  if (period !== 'week' && period !== 'last_week' && period !== 'month' && period !== '6months') {
    const weeks = new Map<string, { attempted: number; correct: number }>();
    for (const f of facts) {
      const d = new Date(Date.parse(`${f.day}T00:00:00Z`));
      const ws = addDays(f.day, -((d.getUTCDay() + 6) % 7));
      const w = weeks.get(ws) ?? { attempted: 0, correct: 0 };
      w.attempted += f.attempted;
      w.correct += f.correct;
      weeks.set(ws, w);
    }
    for (const [ws, w] of weeks) {
      if (w.attempted < PERF_MIN_QUESTIONS) continue;
      const accuracy = Math.round((w.correct / w.attempted) * 100);
      if (bestWeek === null || accuracy > bestWeek.accuracy) bestWeek = { weekStart: ws, accuracy, attempted: w.attempted };
    }
  }

  // Older screens: last 7 days, daily
  const weeklyChart: WeeklyChartEntry[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const t = sum(day, day);
    return { date: day, accuracy: t.attempted > 0 ? t.accuracy : null };
  });

  return {
    attempted: now.attempted,
    correct: now.correct,
    wrong: now.attempted - now.correct,
    accuracy: now.accuracy,
    previousAccuracy: before && before.attempted > 0 ? before.accuracy : null,
    weeklyChart,
    period,
    comparison: {
      previous: before,
      delta,
      attemptedDelta: before ? now.attempted - before.attempted : null,
      minQuestions: PERF_MIN_QUESTIONS,
    },
    chart,
    weakestSubject,
    bestWeek,
  };
}

// ─── 4. Weak Areas ────────────────────────────────────────────────────

/**
 * Returns subjects with lowest accuracy (below 70%) with topic-level breakdown.
 * Includes previous week accuracy for improvement tracking.
 */
export async function getWeakAreas(userId: string): Promise<WeakAreaItem[]> {
  // Get subject-level weak areas
  const subjectRows = await queryMany<{
    subject_id: string;
    subject_en: string;
    subject_hi: string;
    accuracy: number;
    total_questions: string;
    incorrect_count: string;
  }>(
    `SELECT
      s.id AS subject_id,
      s.name_en AS subject_en,
      s.name_hi AS subject_hi,
      ROUND(
        COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option)::numeric
        / NULLIF(COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
      )::int AS accuracy,
      COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL) AS total_questions,
      COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL AND aa.selected_option != q.correct_option) AS incorrect_count
    FROM test_attempts ta
    JOIN tests t ON t.id = ta.test_id
    JOIN attempt_answers aa ON aa.attempt_id = ta.id
    JOIN questions q ON q.id = aa.question_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
      AND ta.status IN ('submitted', 'auto_submitted')
      AND t.subject_id IS NOT NULL
      AND aa.selected_option IS NOT NULL
    GROUP BY s.id, s.name_en, s.name_hi
    HAVING ROUND(
      COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option)::numeric
      / NULLIF(COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
    ) < 70
    ORDER BY accuracy ASC
    LIMIT 5`,
    [userId],
  );

  if (subjectRows.length === 0) return [];

  const subjectIds = subjectRows.map((r) => r.subject_id);

  // Get topic-level breakdown for weak subjects
  const topicRows = await queryMany<{
    subject_id: string;
    topic_id: string;
    topic_en: string;
    topic_hi: string;
    accuracy: number;
    total_questions: string;
    incorrect_count: string;
  }>(
    `SELECT
      t.subject_id,
      tp.id AS topic_id,
      tp.name_en AS topic_en,
      tp.name_hi AS topic_hi,
      ROUND(
        COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option)::numeric
        / NULLIF(COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
      )::int AS accuracy,
      COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL) AS total_questions,
      COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL AND aa.selected_option != q.correct_option) AS incorrect_count
    FROM test_attempts ta
    JOIN tests t ON t.id = ta.test_id
    JOIN attempt_answers aa ON aa.attempt_id = ta.id
    JOIN questions q ON q.id = aa.question_id
    JOIN topics tp ON tp.id = t.topic_id
    WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
      AND ta.status IN ('submitted', 'auto_submitted')
      AND t.subject_id = ANY($2::uuid[])
      AND t.topic_id IS NOT NULL
      AND aa.selected_option IS NOT NULL
    GROUP BY t.subject_id, tp.id, tp.name_en, tp.name_hi
    HAVING COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL) >= 2
    ORDER BY accuracy ASC`,
    [userId, subjectIds],
  );

  // Get previous week accuracy for topics (for improvement tracking)
  const prevTopicRows = await queryMany<{
    topic_id: string;
    accuracy: number;
  }>(
    `SELECT
      t.topic_id,
      ROUND(
        COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option)::numeric
        / NULLIF(COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
      )::int AS accuracy
    FROM test_attempts ta
    JOIN tests t ON t.id = ta.test_id
    JOIN attempt_answers aa ON aa.attempt_id = ta.id
    JOIN questions q ON q.id = aa.question_id
    WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
      AND ta.status IN ('submitted', 'auto_submitted')
      AND t.subject_id = ANY($2::uuid[])
      AND t.topic_id IS NOT NULL
      AND aa.selected_option IS NOT NULL
      AND ta.submitted_at < ((NOW() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '7 days')
    GROUP BY t.topic_id
    HAVING COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL) >= 1`,
    [userId, subjectIds],
  );

  const prevAccuracyMap = new Map<string, number>();
  for (const row of prevTopicRows) {
    prevAccuracyMap.set(row.topic_id, row.accuracy);
  }

  // Build topic map by subject
  const topicsBySubject = new Map<string, WeakTopicItem[]>();
  for (const row of topicRows) {
    if (!topicsBySubject.has(row.subject_id)) {
      topicsBySubject.set(row.subject_id, []);
    }
    topicsBySubject.get(row.subject_id)!.push({
      topicId: row.topic_id,
      topicEn: row.topic_en,
      topicHi: row.topic_hi,
      accuracy: row.accuracy,
      totalQuestions: parseInt(String(row.total_questions), 10),
      incorrectCount: parseInt(String(row.incorrect_count), 10),
      previousAccuracy: prevAccuracyMap.get(row.topic_id) ?? null,
    });
  }

  return subjectRows.map((row) => ({
    subjectEn: row.subject_en,
    subjectHi: row.subject_hi,
    accuracy: row.accuracy,
    totalQuestions: parseInt(String(row.total_questions), 10),
    incorrectCount: parseInt(String(row.incorrect_count), 10),
    topics: (topicsBySubject.get(row.subject_id) ?? []).slice(0, 3), // max 3 topics per subject
  }));
}

// ─── 5. Revision Due ──────────────────────────────────────────────────

/**
 * Returns revision marks due today (oldest first), max 5.
 */
export async function getRevisionDue(userId: string): Promise<RevisionDueItem[]> {
  const rows = await queryMany<{
    id: string;
    question_text: string;
    subject: string;
    created_at: string;
  }>(
    `SELECT
      rm.id,
      q.text_en AS question_text,
      q.subject,
      rm.created_at::text AS created_at
    FROM revision_marks rm
    JOIN questions q ON q.id = rm.question_id
    WHERE rm.user_id = $1
      AND q.is_active = true
    ORDER BY rm.created_at ASC
    LIMIT 5`,
    [userId],
  );

  return rows.map((row) => ({
    id: row.id,
    questionText: row.question_text,
    subject: row.subject,
    createdAt: row.created_at,
  }));
}

// ─── 6. Recommendations ──────────────────────────────────────────────

/**
 * Returns recommended tests based on the user's weak subjects, max 4.
 */
export async function getRecommendations(userId: string): Promise<RecommendationItem[]> {
  const rows = await queryMany<{
    test_id: string;
    title_en: string;
    title_hi: string;
    question_count: string;
    category: string;
  }>(
    `WITH weak_subjects AS (
      SELECT
        t.subject_id,
        ROUND(
          COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option)::numeric
          / NULLIF(COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
        )::int AS accuracy
      FROM test_attempts ta
      JOIN tests t ON t.id = ta.test_id
      JOIN attempt_answers aa ON aa.attempt_id = ta.id
      JOIN questions q ON q.id = aa.question_id
      WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
        AND ta.status IN ('submitted', 'auto_submitted')
        AND t.subject_id IS NOT NULL
        AND aa.selected_option IS NOT NULL
      GROUP BY t.subject_id
      HAVING ROUND(
        COUNT(aa.id) FILTER (WHERE aa.selected_option = q.correct_option)::numeric
        / NULLIF(COUNT(aa.id) FILTER (WHERE aa.selected_option IS NOT NULL), 0) * 100
      ) < 70
    )
    SELECT
      ts.id AS test_id,
      ts.title_en,
      ts.title_hi,
      (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = ts.id)::text AS question_count,
      ts.category
    FROM tests ts
    JOIN weak_subjects ws ON ws.subject_id = ts.subject_id
    WHERE ts.status = 'published'
    ORDER BY ws.accuracy ASC, ts.created_at DESC
    LIMIT 4`,
    [userId],
  );

  return rows.map((row) => ({
    testId: row.test_id,
    titleEn: row.title_en,
    titleHi: row.title_hi,
    questionCount: parseInt(row.question_count, 10),
    category: row.category,
  }));
}

// ─── 7. Daily Challenge ───────────────────────────────────────────────

/**
 * Returns today's answered question count vs target (50).
 */
export async function getDailyChallenge(userId: string): Promise<DailyChallengeResponse> {
  const row = await queryOne<{ solved: string }>(
    `SELECT COUNT(aa.id) AS solved
    FROM test_attempts ta
    JOIN attempt_answers aa ON aa.attempt_id = ta.id
    WHERE ta.user_id = $1
      AND ta.status IN ('submitted', 'auto_submitted')
      AND (ta.submitted_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
      AND aa.selected_option IS NOT NULL`,
    [userId],
  );

  return {
    solved: parseInt(row?.solved ?? "0", 10),
    target: 50,
  };
}

// ─── 8. Recent Test Results ───────────────────────────────────────────

export interface RecentResultItem {
  attemptId: string;
  testId: string;
  testTitleEn: string;
  testTitleHi: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

/**
 * Returns last 3 submitted test results for the user.
 */
export async function getRecentResults(userId: string): Promise<RecentResultItem[]> {
  const rows = await queryMany<{
    attempt_id: string;
    test_id: string;
    title_en: string;
    title_hi: string;
    correct_count: string;
    wrong_count: string;
    total_score: string;
    marks_per_question: string;
    negative_marking_ratio: string;
    total_questions: string;
    percentage: string;
    passing_marks: string;
    total_marks: string;
    submitted_at: string;
    attempt_number: string;
    max_attempts: string;
  }>(
    `SELECT
      ta.id AS attempt_id,
      t.id AS test_id,
      t.title_en,
      t.title_hi,
      COALESCE(ta.correct_count, 0)::text AS correct_count,
      COALESCE(ta.wrong_count, 0)::text AS wrong_count,
      COALESCE(ta.total_score, 0)::text AS total_score,
      t.marks_per_question::text AS marks_per_question,
      t.negative_marking_ratio::text AS negative_marking_ratio,
      (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id)::text AS total_questions,
      COALESCE(ta.percentage, 0)::text AS percentage,
      t.passing_marks::text,
      t.total_marks::text,
      ta.submitted_at::text,
      (SELECT COUNT(*) FROM test_attempts ta2 WHERE ta2.user_id = $1 AND ta2.test_id = t.id AND ta2.status IN ('submitted', 'auto_submitted'))::text AS attempt_number,
      '5' AS max_attempts
    FROM test_attempts ta
    JOIN tests t ON t.id = ta.test_id
    WHERE ta.user_id = $1 AND t.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
      AND ta.status IN ('submitted', 'auto_submitted')
    ORDER BY ta.submitted_at DESC
    LIMIT 3`,
    [userId],
  );

  return rows.map((row) => {
    const percentage = Math.round(parseFloat(row.percentage));
    const passingMarks = parseInt(row.passing_marks, 10);
    const totalMarks = parseInt(row.total_marks, 10);
    // Pass threshold = passing_marks / total_marks * 100
    const passThreshold = totalMarks > 0 ? Math.round((passingMarks / totalMarks) * 100) : 60;
    const passed = percentage >= passThreshold;

    return {
      attemptId: row.attempt_id,
      testId: row.test_id,
      testTitleEn: row.title_en,
      testTitleHi: row.title_hi,
      score: parseInt(row.correct_count, 10),
      totalQuestions: parseInt(row.total_questions, 10),
      correctCount: parseInt(row.correct_count, 10),
      wrongCount: parseInt(row.wrong_count, 10),
      marks: parseFloat(row.total_score),
      maxMarks: parseInt(row.total_questions, 10) * parseFloat(row.marks_per_question),
      // Ratio actually applied to this attempt (recovered from its stored marks)
      negativeMarkingRatio: (() => {
        const w = parseInt(row.wrong_count, 10);
        const mpq = parseFloat(row.marks_per_question);
        if (!(w > 0) || !(mpq > 0)) return parseFloat(row.negative_marking_ratio);
        const lost = parseInt(row.correct_count, 10) * mpq - parseFloat(row.total_score);
        return Math.max(0, Math.round((lost / (w * mpq)) * 100) / 100);
      })(),
      percentage,
      passed,
      submittedAt: row.submitted_at,
    };
  });
}
