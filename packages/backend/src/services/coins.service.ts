/**
 * Coins Service — Manages the coin economy including balance queries,
 * transaction history, and earning events with idempotency guarantees.
 *
 * Idempotency is handled entirely by unique partial indexes on the
 * `coin_transactions` table. We INSERT and catch constraint violations.
 *
 * Requirements: 4.1, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3,
 *              7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { query, queryOne } from "@/db/query.js";
import { withTransaction } from "@/db/transaction.js";
import { redis } from "@/redis/index.js";

// ─── Types ────────────────────────────────────────────────────────────

export type CoinEventType =
  | "daily_login"
  | "streak_bonus_7"
  | "referral"
  | "quiz_complete"
  | "daily_challenge_pass"
  | "test_complete";

export interface CoinTransaction {
  id: string;
  userId: string;
  type: CoinEventType;
  amount: number;
  referenceId: string | null;
  createdAt: Date;
}

export interface CoinBalance {
  balance: number;
  lastEarnedAt: Date | null;
}

export interface EarnResult {
  awarded: boolean;
  amount: number;
  newBalance: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const COIN_AMOUNTS: Record<CoinEventType, number> = {
  daily_login: 10,
  streak_bonus_7: 50,
  referral: 200,
  quiz_complete: 5,
  daily_challenge_pass: 20,
  test_complete: 10,
};

const BALANCE_CACHE_TTL = 60; // seconds
const BALANCE_CACHE_PREFIX = "coins:balance:";

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Build the Redis cache key for a user's coin balance.
 */
function balanceCacheKey(userId: string): string {
  return `${BALANCE_CACHE_PREFIX}${userId}`;
}

/**
 * Check if an error is a unique constraint violation (PostgreSQL error code 23505).
 */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}

// ─── Service Functions ────────────────────────────────────────────────

/**
 * Get a user's current coin balance.
 * Checks Redis cache first (TTL 60s), falls back to DB query.
 *
 * @param userId - The authenticated user's ID
 * @returns The coin balance and last earned timestamp
 */
export async function getBalance(userId: string): Promise<CoinBalance> {
  // Try Redis cache first
  try {
    const cached = await redis.get(balanceCacheKey(userId));
    if (cached) {
      const parsed = JSON.parse(cached) as CoinBalance;
      return {
        balance: parsed.balance,
        lastEarnedAt: parsed.lastEarnedAt ? new Date(parsed.lastEarnedAt) : null,
      };
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  // Query from database
  const row = await queryOne<{ balance: string; last_earned_at: Date | null }>(
    `SELECT COALESCE(SUM(amount), 0) as balance, MAX(created_at) as last_earned_at
     FROM coin_transactions
     WHERE user_id = $1`,
    [userId],
  );

  const balance = row ? Number(row.balance) : 0;
  const lastEarnedAt = row?.last_earned_at ?? null;

  const result: CoinBalance = { balance, lastEarnedAt };

  // Cache in Redis
  try {
    await redis.set(
      balanceCacheKey(userId),
      JSON.stringify(result),
      "EX",
      BALANCE_CACHE_TTL,
    );
  } catch {
    // Redis unavailable — non-critical
  }

  return result;
}

/**
 * Get a user's coin transaction history with pagination.
 *
 * @param userId - The authenticated user's ID
 * @param limit - Maximum number of transactions to return
 * @param offset - Number of transactions to skip
 * @returns The transactions array and total count
 */
export async function getHistory(
  userId: string,
  limit: number,
  offset: number,
): Promise<{ transactions: CoinTransaction[]; total: number }> {
  const [rows, countRow] = await Promise.all([
    query<{
      id: string;
      user_id: string;
      type: CoinEventType;
      amount: number;
      reference_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, user_id, type, amount, reference_id, created_at
       FROM coin_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    ),
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM coin_transactions WHERE user_id = $1`,
      [userId],
    ),
  ]);

  const transactions: CoinTransaction[] = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    amount: row.amount,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  }));

  const total = countRow ? Number(countRow.count) : 0;

  return { transactions, total };
}

/**
 * Award coins to a user for a specific event type.
 * Uses INSERT with the unique partial indexes handling idempotency.
 * Catches unique constraint violations and returns { awarded: false }.
 *
 * @param userId - The authenticated user's ID
 * @param type - The earning event type
 * @param referenceId - Optional reference (attempt ID, referred user ID, etc.)
 * @returns Whether coins were awarded, the amount, and the new balance
 */
export async function earnCoins(
  userId: string,
  type: CoinEventType,
  referenceId?: string,
): Promise<EarnResult> {
  const amount = COIN_AMOUNTS[type];

  try {
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO coin_transactions (user_id, type, amount, reference_id)
         VALUES ($1, $2, $3, $4)`,
        [userId, type, amount, referenceId ?? null],
      );
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Duplicate earning attempt — idempotency handled by DB indexes
      const current = await getBalance(userId);
      return { awarded: false, amount: 0, newBalance: current.balance };
    }
    throw err;
  }

  // Invalidate Redis cache on successful earning
  try {
    await redis.del(balanceCacheKey(userId));
  } catch {
    // Redis unavailable — non-critical
  }

  // Fetch fresh balance
  const updated = await getBalance(userId);
  return { awarded: true, amount, newBalance: updated.balance };
}
