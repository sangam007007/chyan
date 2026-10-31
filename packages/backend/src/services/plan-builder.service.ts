/**
 * Today's-plan builder: how long things take, what the student can pick, and an auto-plan for a time budget.
 *
 * Time model (shown as "about", never as a promise):
 * - a topic = reading its 3 parts, TOPIC_MINUTES in total (parts have no stored length);
 * - a test = its own timer (tests.duration_minutes) plus REVIEW_MINUTES to read the explanations.
 * The same numbers are used for the planned total, the time already done and the time still left.
 */

import { queryMany } from "@/db/index.js";

export const TOPIC_MINUTES = 20;
export const REVIEW_MINUTES = 5;
export const MAX_ATTEMPTS = 5;

/**
 * Every topic is meant to have this many tests. A topic (or subject) is only 100% when its parts AND its tests are done,
 * so tests that do not exist yet count as "not done" instead of making the percentage jump to 100%.
 * Exams that have more tests than this keep their real number.
 */
export const EXPECTED_TESTS_PER_TOPIC = 5;
export const expectedTests = (actual: number, topics = 1): number => Math.max(actual, topics * EXPECTED_TESTS_PER_TOPIC);
export const MIN_BUDGET = 20;
export const MAX_BUDGET = 480;

export const testMinutes = (durationMinutes: number): number => Math.max(1, Math.round(durationMinutes)) + REVIEW_MINUTES;

export interface BuilderTest {
  id: string;
  titleEn: string;
  titleHi: string;
  topicId: string | null;
  questionCount: number;
  durationMinutes: number;
  estimatedMinutes: number;
  attemptCount: number;
  bestPercentage: number | null;
  passed: boolean;
  /** all attempts used: cannot be planned */
  locked: boolean;
}

export interface BuilderTopic {
  id: string;
  nameEn: string;
  nameHi: string;
  done: boolean;
  estimatedMinutes: number;
  /** best score over the topic's tests, null if none attempted yet */
  accuracy: number | null;
  attempted: boolean;
}

export interface BuilderSubject {
  id: string;
  nameEn: string;
  nameHi: string;
  /** average best score of attempted topic tests, null if nothing attempted */
  accuracy: number | null;
  topicsDone: number;
  topicsTotal: number;
  topics: BuilderTopic[];
  tests: BuilderTest[];
}

export async function getBuilderData(userId: string): Promise<{ subjects: BuilderSubject[]; todaySelected: { topicIds: string[]; testIds: string[] } }> {
  const subs = await queryMany<{ id: string; name_en: string; name_hi: string }>(
    `SELECT s.id, s.name_en, s.name_hi
     FROM users u JOIN subjects s ON s.exam_id = u.selected_exam_id
     WHERE u.id = $1 ORDER BY s.display_order, s.name_en`,
    [userId],
  );
  if (subs.length === 0) return { subjects: [], todaySelected: { topicIds: [], testIds: [] } };
  const subjectIds = subs.map((s) => s.id);

  const topics = await queryMany<{ id: string; subject_id: string; name_en: string; name_hi: string; done: boolean }>(
    `SELECT t.id, t.subject_id, t.name_en, t.name_hi,
            (tp.status = 'completed') AS done
     FROM topics t
     LEFT JOIN topic_progress tp ON tp.topic_id = t.id AND tp.user_id = $1
     WHERE t.subject_id = ANY($2::uuid[])
     ORDER BY t.display_order`,
    [userId, subjectIds],
  );

  const tests = await queryMany<{
    id: string; subject_id: string; topic_id: string | null; title_en: string; title_hi: string;
    duration_minutes: number; question_count: string; attempt_count: string; best_pct: string | null; pass_pct: string | null;
  }>(
    `SELECT t.id, t.subject_id, t.topic_id, t.title_en, t.title_hi, t.duration_minutes,
            (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id)::text AS question_count,
            (SELECT COUNT(*) FROM test_attempts ta WHERE ta.test_id = t.id AND ta.user_id = $1
               AND ta.status IN ('submitted', 'auto_submitted'))::text AS attempt_count,
            (SELECT MAX(ta.percentage) FROM test_attempts ta WHERE ta.test_id = t.id AND ta.user_id = $1
               AND ta.status IN ('submitted', 'auto_submitted')
               AND COALESCE(ta.correct_count, 0) + COALESCE(ta.wrong_count, 0) > 0)::text AS best_pct,
            (t.passing_marks::numeric / NULLIF(t.total_marks, 0) * 100)::text AS pass_pct
     FROM tests t
     WHERE t.status = 'published' AND t.subject_id = ANY($2::uuid[]) AND t.topic_id IS NOT NULL
     ORDER BY t.title_en`,
    [userId, subjectIds],
  );

  const todayItems = await queryMany<{ kind: string; id: string }>(
    `SELECT 'topic' AS kind, spit.topic_id AS id
     FROM user_active_plans uap
     JOIN study_plan_items spi ON spi.plan_id = uap.plan_id
     JOIN study_plan_item_topics spit ON spit.plan_item_id = spi.id
     JOIN subjects sj ON sj.id = spi.subject_id AND sj.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
     WHERE uap.user_id = $1 AND uap.plan_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
     UNION ALL
     SELECT 'test', spit2.test_id
     FROM user_active_plans uap
     JOIN study_plan_items spi ON spi.plan_id = uap.plan_id
     JOIN study_plan_item_tests spit2 ON spit2.plan_item_id = spi.id
     JOIN subjects sj ON sj.id = spi.subject_id AND sj.exam_id = (SELECT selected_exam_id FROM users WHERE id = $1)
     WHERE uap.user_id = $1 AND uap.plan_date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date`,
    [userId],
  );

  const builtTests: BuilderTest[] = tests.map((t) => {
    const best = t.best_pct != null ? Math.round(Number(t.best_pct)) : null;
    const attempts = Number(t.attempt_count);
    const passLine = t.pass_pct != null ? Number(t.pass_pct) : 60;
    return {
      id: t.id,
      titleEn: t.title_en,
      titleHi: t.title_hi,
      topicId: t.topic_id,
      questionCount: Number(t.question_count),
      durationMinutes: t.duration_minutes,
      estimatedMinutes: testMinutes(t.duration_minutes),
      attemptCount: attempts,
      bestPercentage: best,
      passed: best != null && best >= passLine,
      locked: attempts >= MAX_ATTEMPTS,
    };
  });

  const subjects: BuilderSubject[] = subs.map((s) => {
    const sTopics = topics.filter((t) => t.subject_id === s.id);
    const sTests = builtTests.filter((t) => tests.find((x) => x.id === t.id)?.subject_id === s.id);
    const builtTopics: BuilderTopic[] = sTopics.map((t) => {
      const mine = sTests.filter((x) => x.topicId === t.id && x.bestPercentage != null);
      const acc = mine.length ? Math.round(Math.max(...mine.map((x) => x.bestPercentage as number))) : null;
      return { id: t.id, nameEn: t.name_en, nameHi: t.name_hi, done: !!t.done, estimatedMinutes: TOPIC_MINUTES, accuracy: acc, attempted: mine.length > 0 };
    });
    const attempted = builtTopics.filter((t) => t.accuracy != null);
    return {
      id: s.id,
      nameEn: s.name_en,
      nameHi: s.name_hi,
      accuracy: attempted.length ? Math.round(attempted.reduce((a, t) => a + (t.accuracy as number), 0) / attempted.length) : null,
      topicsDone: builtTopics.filter((t) => t.done).length,
      topicsTotal: builtTopics.length,
      topics: builtTopics,
      tests: sTests,
    };
  });

  return {
    subjects,
    todaySelected: {
      topicIds: todayItems.filter((i) => i.kind === 'topic').map((i) => i.id),
      testIds: todayItems.filter((i) => i.kind === 'test').map((i) => i.id),
    },
  };
}

// ─── Auto-plan ────────────────────────────────────────────────────────

export type SuggestReason = "weak" | "retake" | "continue" | "next" | "practice";

export interface Suggestion {
  minutes: number;
  budget: number;
  topicIds: string[];
  testIds: string[];
  reasons: Record<string, SuggestReason>;
  /** per subject: how much of the budget it got */
  perSubject: { subjectId: string; minutes: number }[];
}

interface Task {
  kind: "topic" | "test";
  id: string;
  subjectId: string;
  minutes: number;
  priority: number;
  order: number;
  reason: SuggestReason;
}

/**
 * Fills the time budget with what helps most, weakest first:
 *  1. weak:     a topic whose best test score is below 60%, study it again, then retake its tests
 *  2. retake:   a test the student failed (attempts left)
 *  3. continue: a topic where some test was attempted but the topic is not finished
 *  4. next:     the next topics in order, with their first test
 *  5. practice: when time is still left, one more test per topic (not yet 80%+) to push the score up
 * Subjects are served in turns, the weakest subject first, so one subject never takes the whole budget.
 */
export function buildSuggestion(subjects: BuilderSubject[], budgetMinutes: number): Suggestion {
  const budget = Math.min(MAX_BUDGET, Math.max(MIN_BUDGET, Math.round(budgetMinutes)));
  const queues = new Map<string, Task[]>();
  let order = 0;

  for (const s of subjects) {
    const tasks: Task[] = [];
    for (const t of s.topics) {
      const tTests = s.tests.filter((x) => x.topicId === t.id && !x.locked);
      const failedTests = tTests.filter((x) => x.attemptCount > 0 && !x.passed);
      const untried = tTests.filter((x) => x.attemptCount === 0);
      const weak = t.accuracy != null && t.accuracy < 60;

      if (!(t.done && !weak && failedTests.length === 0)) {
        const base = weak ? 4 : failedTests.length > 0 ? 3 : t.attempted ? 2 : 1;
        const reason: SuggestReason = weak ? "weak" : failedTests.length > 0 ? "retake" : t.attempted ? "continue" : "next";
        // study the topic (again, when it is weak even if it was finished), then test it
        if (!t.done || weak) tasks.push({ kind: "topic", id: t.id, subjectId: s.id, minutes: t.estimatedMinutes, priority: base, order: order++, reason });
        for (const x of failedTests.slice(0, 1)) tasks.push({ kind: "test", id: x.id, subjectId: s.id, minutes: x.estimatedMinutes, priority: base - 0.1, order: order++, reason: weak ? "weak" : "retake" });
        if (!t.done && failedTests.length === 0 && untried.length > 0) {
          tasks.push({ kind: "test", id: untried[0].id, subjectId: s.id, minutes: untried[0].estimatedMinutes, priority: base - 0.1, order: order++, reason });
        }
      }

      // lowest priority: one more test for this topic if its score is not yet 80%+ (only used when time is left)
      const already = new Set(tasks.filter((x) => x.kind === "test").map((x) => x.id));
      const extra = tTests.find((x) => !already.has(x.id) && (x.bestPercentage == null || x.bestPercentage < 80));
      if (extra) tasks.push({ kind: "test", id: extra.id, subjectId: s.id, minutes: extra.estimatedMinutes, priority: 0.5, order: order++, reason: "practice" });
    }
    tasks.sort((a, b) => b.priority - a.priority || a.order - b.order);
    queues.set(s.id, tasks);
  }

  // weakest subject first (never attempted counts as medium so it is not starved)
  const ranked = [...subjects].sort((a, b) => (a.accuracy ?? 55) - (b.accuracy ?? 55));
  const picked: Task[] = [];
  let used = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const s of ranked) {
      const q = queues.get(s.id)!;
      // take the first task that still fits in the time left
      const i = q.findIndex((t) => used + t.minutes <= budget);
      if (i === -1) continue;
      const [task] = q.splice(i, 1);
      picked.push(task);
      used += task.minutes;
      progressed = true;
    }
  }
  const topicIds = picked.filter((t) => t.kind === "topic").map((t) => t.id);
  const testIds = picked.filter((t) => t.kind === "test").map((t) => t.id);
  const reasons: Record<string, SuggestReason> = {};
  for (const t of picked) reasons[t.id] = t.reason;
  const perSubject = ranked
    .map((s) => ({ subjectId: s.id, minutes: picked.filter((t) => t.subjectId === s.id).reduce((a, t) => a + t.minutes, 0) }))
    .filter((p) => p.minutes > 0);

  return { minutes: used, budget, topicIds, testIds, reasons, perSubject };
}

/** Minutes for exactly these picks, from the database (so a client cannot make up a duration). */
export async function estimateMinutes(subjectId: string, topicIds: string[], testIds: string[]): Promise<number> {
  let minutes = 0;
  if (topicIds.length) {
    const r = await queryMany<{ id: string }>(`SELECT id FROM topics WHERE id = ANY($1::uuid[]) AND subject_id = $2`, [topicIds, subjectId]);
    minutes += r.length * TOPIC_MINUTES;
  }
  if (testIds.length) {
    const r = await queryMany<{ duration_minutes: number }>(
      `SELECT duration_minutes FROM tests WHERE id = ANY($1::uuid[]) AND subject_id = $2`,
      [testIds, subjectId],
    );
    minutes += r.reduce((a, t) => a + testMinutes(t.duration_minutes), 0);
  }
  return minutes;
}
