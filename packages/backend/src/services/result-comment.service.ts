/**
 * Picks the funny comment shown next to a score on the result page and remembers it.
 *
 * The comment is chosen once per attempt and saved on the attempt, so reopening the result always
 * shows the same line. When the same student lands in the same group again (another attempt, or
 * another test, with a score in the same range) a comment they have not seen yet is chosen.
 * The text itself lives in the frontend (src/data/resultComments.ts); this only stores which one.
 */

import { queryMany, queryOne } from "@/db/index.js";

/** Must match the number of comments in each group in the frontend file. */
export const COMMENTS_PER_BAND = 10;

export type CommentBand = "fail-1" | "fail-2" | "fail-3" | "pass-69" | "pass-70" | "pass-80" | "pass-90";

export interface AttemptComment {
  band: CommentBand;
  index: number;
}

/** Same rule as the frontend: failures go by attempt number, passes by 10% score band. */
export function commentBand(passed: boolean, percentage: number, attemptNumber: number): CommentBand {
  if (!passed) return attemptNumber <= 1 ? "fail-1" : attemptNumber === 2 ? "fail-2" : "fail-3";
  const p = Math.round(percentage);
  return p >= 90 ? "pass-90" : p >= 80 ? "pass-80" : p >= 70 ? "pass-70" : "pass-69";
}

export async function getOrAssignComment(a: {
  attemptId: string;
  attemptOwnerId: string;
  requestingUserId: string;
  testId: string;
  passed: boolean;
  percentage: number;
  storedBand: string | null;
  storedIndex: number | null;
}): Promise<AttemptComment | null> {
  if (a.storedBand && a.storedIndex != null) return { band: a.storedBand as CommentBand, index: a.storedIndex };
  // Only the owner of an attempt fixes its comment
  if (a.attemptOwnerId !== a.requestingUserId) return null;

  // Which attempt at this test is it (1st, 2nd, ...)? Counted by submit time.
  const nth = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n
     FROM test_attempts x
     WHERE x.user_id = $1 AND x.test_id = $2
       AND x.status IN ('submitted', 'auto_submitted') AND x.submitted_at IS NOT NULL
       AND x.submitted_at <= (SELECT submitted_at FROM test_attempts WHERE id = $3)`,
    [a.attemptOwnerId, a.testId, a.attemptId],
  );
  const band = commentBand(a.passed, a.percentage, Math.max(1, Number(nth?.n ?? 1)));

  // Prefer a line this student has not been shown in this group yet
  const usedRows = await queryMany<{ comment_index: number }>(
    `SELECT comment_index FROM test_attempts
     WHERE user_id = $1 AND comment_band = $2 AND comment_index IS NOT NULL AND id <> $3`,
    [a.attemptOwnerId, band, a.attemptId],
  );
  const used = new Set(usedRows.map((r) => r.comment_index));
  const all = Array.from({ length: COMMENTS_PER_BAND }, (_, i) => i);
  const fresh = all.filter((i) => !used.has(i));
  const pool = fresh.length > 0 ? fresh : all;
  const index = pool[Math.floor(Math.random() * pool.length)];

  // Only the first writer wins, so two quick requests cannot give the attempt two different lines
  const saved = await queryOne<{ comment_band: string; comment_index: number }>(
    `UPDATE test_attempts SET comment_band = $2, comment_index = $3
     WHERE id = $1 AND comment_index IS NULL
     RETURNING comment_band, comment_index`,
    [a.attemptId, band, index],
  );
  if (saved) return { band: saved.comment_band as CommentBand, index: saved.comment_index };

  const existing = await queryOne<{ comment_band: string | null; comment_index: number | null }>(
    `SELECT comment_band, comment_index FROM test_attempts WHERE id = $1`,
    [a.attemptId],
  );
  return existing?.comment_band && existing.comment_index != null
    ? { band: existing.comment_band as CommentBand, index: existing.comment_index }
    : null;
}
