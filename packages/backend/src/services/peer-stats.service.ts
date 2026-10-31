/**
 * Peer comparison for the analysis screens.
 *
 * Only a student's FIRST attempt counts (an attempt with no answered question does not count), so retaking a test never changes what the crowd looks like,
 * but every student can see these numbers in the analysis of all their attempts.
 * Everything returned is an anonymous aggregate; no other student can be identified.
 *
 * - Question level: for each question, every user's first answer to it (any test that contains it).
 * - Test level: every user's first attempt at the test. Subject full tests are generated per user,
 *   so their group is all the generated full tests of that subject.
 */

import { queryMany, queryOne } from "@/db/index.js";

export interface QuestionPeerStat {
  /** Students whose first answer to this question is counted */
  total: number;
  /** Share of those students that picked option A, B, C, D (0–100, whole numbers) */
  optionPercents: [number, number, number, number];
  /** Share that left the question unanswered */
  skippedPercent: number;
  /** Share that answered correctly */
  correctPercent: number;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export async function getQuestionPeerStats(questionIds: string[]): Promise<Map<string, QuestionPeerStat>> {
  const out = new Map<string, QuestionPeerStat>();
  if (questionIds.length === 0) return out;

  const rows = await queryMany<{
    question_id: string;
    total: string;
    a: string;
    b: string;
    c: string;
    d: string;
    skipped: string;
    correct: string;
  }>(
    `WITH first_answer AS (
       SELECT DISTINCT ON (ta.user_id, aa.question_id)
              aa.question_id, aa.selected_option
       FROM attempt_answers aa
       JOIN test_attempts ta ON ta.id = aa.attempt_id
       WHERE aa.question_id = ANY($1::uuid[])
         AND ta.status IN ('submitted', 'auto_submitted')
         AND ta.submitted_at IS NOT NULL
         AND COALESCE(ta.correct_count, 0) + COALESCE(ta.wrong_count, 0) > 0
       ORDER BY ta.user_id, aa.question_id, ta.submitted_at ASC
     )
     SELECT f.question_id,
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE f.selected_option = 0) AS a,
            COUNT(*) FILTER (WHERE f.selected_option = 1) AS b,
            COUNT(*) FILTER (WHERE f.selected_option = 2) AS c,
            COUNT(*) FILTER (WHERE f.selected_option = 3) AS d,
            COUNT(*) FILTER (WHERE f.selected_option IS NULL) AS skipped,
            COUNT(*) FILTER (WHERE f.selected_option = q.correct_option) AS correct
     FROM first_answer f
     JOIN questions q ON q.id = f.question_id
     GROUP BY f.question_id`,
    [questionIds],
  );

  for (const r of rows) {
    const total = Number(r.total);
    out.set(r.question_id, {
      total,
      optionPercents: [pct(Number(r.a), total), pct(Number(r.b), total), pct(Number(r.c), total), pct(Number(r.d), total)],
      skippedPercent: pct(Number(r.skipped), total),
      correctPercent: pct(Number(r.correct), total),
    });
  }
  return out;
}

export interface TestPeerStat {
  /** "test": everyone who took this test. "subject": everyone who took a generated full test of this subject. */
  scope: "test" | "subject";
  /** Distinct students counted (first attempts only) */
  participants: number;
  /** Students who attempted any test of the same topic (topic tests only), otherwise null */
  topicParticipants: number | null;
  avgScore: number;
  avgPercentage: number;
  /** Average of the correct answers, to read next to the total questions */
  avgCorrect: number;
  /** The requesting student's own first attempt in this group (null if they have none) */
  yourFirstPercentage: number | null;
  yourFirstScore: number | null;
}

export async function getTestPeerStats(testId: string, userId: string): Promise<TestPeerStat | null> {
  const test = await queryOne<{ topic_id: string | null; dyn_subject: string | null }>(
    `SELECT t.topic_id,
            (SELECT d.subject_id FROM dynamic_full_tests d WHERE d.test_id = t.id LIMIT 1) AS dyn_subject
     FROM tests t WHERE t.id = $1`,
    [testId],
  );
  if (!test) return null;

  const scope: "test" | "subject" = test.dyn_subject ? "subject" : "test";
  const groupSql = scope === "subject"
    ? `ta.test_id IN (SELECT test_id FROM dynamic_full_tests WHERE subject_id = $1)`
    : `ta.test_id = $1`;
  const groupParam = scope === "subject" ? test.dyn_subject : testId;

  // One row per (user, test): that user's first submitted attempt
  const firstAttempts = `
    SELECT DISTINCT ON (ta.user_id, ta.test_id)
           ta.user_id, ta.total_score, ta.percentage, ta.correct_count
    FROM test_attempts ta
    WHERE ${groupSql}
      AND ta.status IN ('submitted', 'auto_submitted')
      AND ta.submitted_at IS NOT NULL
      AND COALESCE(ta.correct_count, 0) + COALESCE(ta.wrong_count, 0) > 0
    ORDER BY ta.user_id, ta.test_id, ta.submitted_at ASC`;

  const agg = await queryOne<{ participants: string; avg_score: string | null; avg_pct: string | null; avg_correct: string | null }>(
    `WITH f AS (${firstAttempts})
     SELECT COUNT(DISTINCT user_id) AS participants,
            AVG(total_score) AS avg_score,
            AVG(percentage) AS avg_pct,
            AVG(correct_count) AS avg_correct
     FROM f`,
    [groupParam],
  );
  const participants = Number(agg?.participants ?? 0);
  if (participants === 0) return null;

  // For a subject group a student may have several generated tests: use the average of their first attempts
  const mine = await queryOne<{ total_score: string | null; percentage: string | null }>(
    `WITH f AS (${firstAttempts})
     SELECT AVG(total_score) AS total_score, AVG(percentage) AS percentage FROM f WHERE user_id = $2`,
    [groupParam, userId],
  );

  let topicParticipants: number | null = null;
  if (test.topic_id) {
    const t = await queryOne<{ n: string }>(
      `SELECT COUNT(DISTINCT ta.user_id) AS n
       FROM test_attempts ta
       JOIN tests t ON t.id = ta.test_id
       WHERE t.topic_id = $1
         AND ta.status IN ('submitted', 'auto_submitted')
         AND ta.submitted_at IS NOT NULL
         AND COALESCE(ta.correct_count, 0) + COALESCE(ta.wrong_count, 0) > 0`,
      [test.topic_id],
    );
    topicParticipants = Number(t?.n ?? 0);
  }

  const round1 = (v: string | null) => Math.round(Number(v ?? 0) * 10) / 10;
  return {
    scope,
    participants,
    topicParticipants,
    avgScore: round1(agg?.avg_score ?? null),
    avgPercentage: Math.round(Number(agg?.avg_pct ?? 0)),
    avgCorrect: round1(agg?.avg_correct ?? null),
    yourFirstPercentage: mine?.percentage != null ? Math.round(Number(mine.percentage)) : null,
    yourFirstScore: mine?.total_score != null ? round1(mine.total_score) : null,
  };
}
