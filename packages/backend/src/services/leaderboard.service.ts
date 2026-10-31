/**
 * Leaderboard Service — Computes user rankings based on aggregated
 * test attempt scores with state-level (exam-filtered) and national views.
 * Results are cached in Redis with a 5-minute TTL.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8, 1.9, 1.10
 */

import { query } from "@/db/query.js";
import { redis } from "@/redis/index.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalScore: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[]; // max 50
  userRank: LeaderboardEntry | null; // requesting user's position
  type: "state" | "national";
}

// ─── Row type from DB ─────────────────────────────────────────────────

interface LeaderboardRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_score: string; // numeric comes as string from pg
  rank: string; // bigint comes as string from pg
}

// ─── SQL Queries ──────────────────────────────────────────────────────

const STATE_LEADERBOARD_SQL = `
WITH ranked AS (
  SELECT
    u.id AS user_id,
    u.full_name,
    u.avatar_url,
    COALESCE(SUM(ta.total_score), 0) AS total_score,
    MIN(ta.submitted_at) AS earliest_submission,
    DENSE_RANK() OVER (
      ORDER BY COALESCE(SUM(ta.total_score), 0) DESC,
               MIN(ta.submitted_at) ASC
    ) AS rank
  FROM users u
  INNER JOIN test_attempts ta
    ON ta.user_id = u.id
    AND ta.status IN ('submitted', 'auto_submitted')
    AND ta.total_score IS NOT NULL
  INNER JOIN tests tx ON tx.id = ta.test_id AND tx.exam_id = $1
  WHERE u.selected_exam_id = $1
  GROUP BY u.id, u.full_name, u.avatar_url
  HAVING COALESCE(SUM(ta.total_score), 0) > 0
)
SELECT user_id, full_name, avatar_url, total_score, rank
FROM ranked
ORDER BY rank ASC, earliest_submission ASC
LIMIT 50;
`;

const NATIONAL_LEADERBOARD_SQL = `
WITH ranked AS (
  SELECT
    u.id AS user_id,
    u.full_name,
    u.avatar_url,
    COALESCE(SUM(ta.total_score), 0) AS total_score,
    MIN(ta.submitted_at) AS earliest_submission,
    DENSE_RANK() OVER (
      ORDER BY COALESCE(SUM(ta.total_score), 0) DESC,
               MIN(ta.submitted_at) ASC
    ) AS rank
  FROM users u
  INNER JOIN test_attempts ta
    ON ta.user_id = u.id
    AND ta.status IN ('submitted', 'auto_submitted')
    AND ta.total_score IS NOT NULL
  GROUP BY u.id, u.full_name, u.avatar_url
  HAVING COALESCE(SUM(ta.total_score), 0) > 0
)
SELECT user_id, full_name, avatar_url, total_score, rank
FROM ranked
ORDER BY rank ASC, earliest_submission ASC
LIMIT 50;
`;

const STATE_USER_RANK_SQL = `
WITH ranked AS (
  SELECT
    u.id AS user_id,
    u.full_name,
    u.avatar_url,
    COALESCE(SUM(ta.total_score), 0) AS total_score,
    MIN(ta.submitted_at) AS earliest_submission,
    DENSE_RANK() OVER (
      ORDER BY COALESCE(SUM(ta.total_score), 0) DESC,
               MIN(ta.submitted_at) ASC
    ) AS rank
  FROM users u
  INNER JOIN test_attempts ta
    ON ta.user_id = u.id
    AND ta.status IN ('submitted', 'auto_submitted')
    AND ta.total_score IS NOT NULL
  INNER JOIN tests tx ON tx.id = ta.test_id AND tx.exam_id = $1
  WHERE u.selected_exam_id = $1
  GROUP BY u.id, u.full_name, u.avatar_url
  HAVING COALESCE(SUM(ta.total_score), 0) > 0
)
SELECT user_id, full_name, avatar_url, total_score, rank
FROM ranked
WHERE user_id = $2;
`;

const NATIONAL_USER_RANK_SQL = `
WITH ranked AS (
  SELECT
    u.id AS user_id,
    u.full_name,
    u.avatar_url,
    COALESCE(SUM(ta.total_score), 0) AS total_score,
    MIN(ta.submitted_at) AS earliest_submission,
    DENSE_RANK() OVER (
      ORDER BY COALESCE(SUM(ta.total_score), 0) DESC,
               MIN(ta.submitted_at) ASC
    ) AS rank
  FROM users u
  INNER JOIN test_attempts ta
    ON ta.user_id = u.id
    AND ta.status IN ('submitted', 'auto_submitted')
    AND ta.total_score IS NOT NULL
  GROUP BY u.id, u.full_name, u.avatar_url
  HAVING COALESCE(SUM(ta.total_score), 0) > 0
)
SELECT user_id, full_name, avatar_url, total_score, rank
FROM ranked
WHERE user_id = $1;
`;

// ─── Cache Configuration ──────────────────────────────────────────────

const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Build the Redis cache key for leaderboard entries.
 */
function buildCacheKey(type: "state" | "national", examId: string | null): string {
  if (type === "state" && examId) {
    return `leaderboard:state:${examId}`;
  }
  return "leaderboard:national";
}

// ─── Helpers ──────────────────────────────────────────────────────────

function mapRowToEntry(row: LeaderboardRow): LeaderboardEntry {
  return {
    rank: Number(row.rank),
    userId: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    totalScore: Number(row.total_score),
  };
}

// ─── Service Function ─────────────────────────────────────────────────

/**
 * Get the leaderboard for the given type.
 * Checks Redis cache first (TTL 5 min), falls back to DB query.
 *
 * @param userId - The requesting user's ID (to include their rank)
 * @param type - "state" (filtered by exam) or "national" (all users)
 * @param examId - The user's selected exam ID (required for state, null for national)
 * @returns LeaderboardResult with top 50 entries and the user's own rank
 */
export async function getLeaderboard(
  userId: string,
  type: "state" | "national",
  examId: string | null,
): Promise<LeaderboardResult> {
  const cacheKey = buildCacheKey(type, examId);
  let entries: LeaderboardEntry[] | null = null;
  let cacheAvailable = true;

  // 1. Try to read from Redis cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      entries = JSON.parse(cached) as LeaderboardEntry[];
    }
  } catch (err) {
    console.error("[Leaderboard] Redis read error:", err);
    cacheAvailable = false;
  }

  // 2. On cache miss: query DB
  if (!entries) {
    let rows: LeaderboardRow[];

    if (type === "state") {
      rows = await query<LeaderboardRow>(STATE_LEADERBOARD_SQL, [examId]);
    } else {
      rows = await query<LeaderboardRow>(NATIONAL_LEADERBOARD_SQL);
    }

    entries = rows.map(mapRowToEntry);

    // 3. Cache the entries (not userRank) in Redis with TTL
    if (cacheAvailable) {
      try {
        await redis.set(cacheKey, JSON.stringify(entries), "EX", CACHE_TTL_SECONDS);
      } catch (err) {
        console.error("[Leaderboard] Redis write error:", err);
      }
    }
  }

  // 4. Always compute userRank fresh (per-user, not cached)
  const userInTop50 = entries.find((e) => e.userId === userId);

  if (userInTop50) {
    return {
      entries,
      userRank: userInTop50,
      type,
    };
  }

  // User not in top 50 — fetch their rank separately
  let userRankRow: LeaderboardRow | undefined;

  if (type === "state") {
    const userRows = await query<LeaderboardRow>(STATE_USER_RANK_SQL, [
      examId,
      userId,
    ]);
    userRankRow = userRows[0];
  } else {
    const userRows = await query<LeaderboardRow>(NATIONAL_USER_RANK_SQL, [
      userId,
    ]);
    userRankRow = userRows[0];
  }

  return {
    entries,
    userRank: userRankRow ? mapRowToEntry(userRankRow) : null,
    type,
  };
}
