import { redis } from "./client.js";

// ─── Constants ────────────────────────────────────────────────────────
const CSRF_PREFIX = "csrf:";
const CSRF_TTL = 86400; // 24 hours in seconds

// ─── CSRF Token Helpers ───────────────────────────────────────────────

/**
 * Store a CSRF token linked to a user ID with a 24-hour TTL.
 */
export async function storeCsrfToken(
  token: string,
  userId: string
): Promise<void> {
  const key = `${CSRF_PREFIX}${token}`;
  await redis.set(key, userId, "EX", CSRF_TTL);
}

/**
 * Validate a CSRF token. Returns the associated user ID if valid, null otherwise.
 */
export async function validateCsrfToken(
  token: string
): Promise<string | null> {
  const key = `${CSRF_PREFIX}${token}`;
  return redis.get(key);
}

/**
 * Revoke a CSRF token (e.g., after use or on logout).
 */
export async function revokeCsrfToken(token: string): Promise<void> {
  const key = `${CSRF_PREFIX}${token}`;
  await redis.del(key);
}

/**
 * Revoke all CSRF tokens for a user by scanning keys.
 * NOTE: Use sparingly — scan is O(N). For most cases,
 * tokens expire naturally via TTL.
 */
export async function revokeAllCsrfTokensForUser(
  userId: string
): Promise<void> {
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${CSRF_PREFIX}*`,
      "COUNT",
      100
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.get(key);
      }
      const results = await pipeline.exec();

      const delPipeline = redis.pipeline();
      results?.forEach((result, index) => {
        if (result?.[1] === userId) {
          delPipeline.del(keys[index]);
        }
      });
      await delPipeline.exec();
    }
  } while (cursor !== "0");
}
