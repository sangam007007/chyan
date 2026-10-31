/**
 * Streak Service — Records daily user activity and computes
 * consecutive-day engagement streaks using IST calendar boundaries.
 *
 * Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4
 */

import { query, queryOne } from "@/db/query.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
  streakDates: string[];
  todayRecorded: boolean;
  milestoneReached: boolean;
  /** Longest run of consecutive recorded days in user_activities. */
  longestStreak?: number;
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
 * Subtract one day from a YYYY-MM-DD date string and return the result.
 */
function subtractOneDay(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - 1);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Service ──────────────────────────────────────────────────────────

/**
 * Record activity for today (IST). Idempotent — safe to call multiple times.
 * Uses ON CONFLICT DO NOTHING to handle duplicates at the DB level.
 * After recording, updates the user's best_streak if the current streak exceeds it.
 *
 * @param userId - The authenticated user's ID
 */
export async function recordActivity(userId: string): Promise<void> {
  await query(
    `INSERT INTO user_activities (user_id, activity_date)
     VALUES ($1, (NOW() AT TIME ZONE 'Asia/Kolkata')::date)
     ON CONFLICT DO NOTHING`,
    [userId],
  );

  // Compute current streak and update best_streak if it grew
  const { currentStreak } = await getStreak(userId);
  await query(
    `UPDATE users SET best_streak = GREATEST(best_streak, $1) WHERE id = $2`,
    [currentStreak, userId],
  );
}

/**
 * Compute the user's current streak from their activity records.
 * Iterates from today (IST) backward counting consecutive calendar days.
 *
 * @param userId - The authenticated user's ID
 * @returns The streak result with current count, dates, and milestone flag
 */
export async function getStreak(userId: string): Promise<StreakResult> {
  const rows = await query<{ activity_date: Date | string }>(
    `SELECT activity_date
     FROM user_activities
     WHERE user_id = $1
     ORDER BY activity_date DESC`,
    [userId],
  );

  // Convert activity_date values to YYYY-MM-DD strings
  const activityDates = new Set(
    rows.map((row) => {
      if (row.activity_date instanceof Date) {
        const year = row.activity_date.getFullYear();
        const month = String(row.activity_date.getMonth() + 1).padStart(2, "0");
        const day = String(row.activity_date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
      // If it comes as a string (e.g., from some DB drivers), use it directly
      return String(row.activity_date).slice(0, 10);
    }),
  );

  const todayStr = getTodayIST();
  const todayRecorded = activityDates.has(todayStr);

  // Compute streak: count consecutive days backward from today
  let currentStreak = 0;
  const streakDates: string[] = [];

  if (todayRecorded) {
    let checkDate = todayStr;
    while (activityDates.has(checkDate)) {
      currentStreak++;
      streakDates.push(checkDate);
      checkDate = subtractOneDay(checkDate);
    }
  }

  // Longest run of consecutive recorded days (used to keep best_streak honest)
  const sorted = [...activityDates].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T00:00:00Z`);
    run = prev !== null && t - prev === 86400000 ? run + 1 : 1;
    prev = t;
    longestStreak = Math.max(longestStreak, run);
  }

  return {
    currentStreak,
    bestStreak: 0, // Use getStreakWithBest() for the actual persisted best streak
    streakDates,
    todayRecorded,
    milestoneReached: currentStreak === 7,
    longestStreak,
  };
}

/**
 * Compute the user's current streak and retrieve the persisted best streak.
 * Combines the streak computation from `getStreak` with the best_streak column from the users table.
 *
 * @param userId - The authenticated user's ID
 * @returns The full streak result including the persisted best streak
 */
export async function getStreakWithBest(userId: string): Promise<StreakResult> {
  const streakResult = await getStreak(userId);

  const row = await queryOne<{ best_streak: number }>(
    `SELECT best_streak FROM users WHERE id = $1`,
    [userId],
  );

  // Persisted best can lag behind the real history, so never report less than the longest run.
  const bestStreak = Math.max(row?.best_streak ?? 0, streakResult.longestStreak ?? 0, streakResult.currentStreak);

  return { ...streakResult, bestStreak };
}
