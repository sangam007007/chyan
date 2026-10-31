import { redis } from "./client.js";

// ─── Constants ────────────────────────────────────────────────────────
const SESSION_PREFIX = "session:";
const USER_SESSIONS_PREFIX = "user_sessions:";
const SESSION_TTL = 2592000; // 30 days in seconds

// ─── Types ────────────────────────────────────────────────────────────
export interface SessionMetadata {
  user_id: string;
  device_type: string;
  created_at: number;
  last_active_at: number;
}

// ─── Session Metadata Helpers ─────────────────────────────────────────

/**
 * Store session metadata in Redis with a 30-day TTL.
 */
export async function storeSessionMetadata(
  sessionId: string,
  metadata: SessionMetadata
): Promise<void> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  await redis.set(key, JSON.stringify(metadata), "EX", SESSION_TTL);
}

/**
 * Retrieve session metadata by session ID.
 * Returns null if the session doesn't exist or has expired.
 */
export async function getSessionMetadata(
  sessionId: string
): Promise<SessionMetadata | null> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as SessionMetadata;
}

/**
 * Update the last_active_at timestamp for a session.
 * Preserves the remaining TTL.
 */
export async function updateSessionActivity(
  sessionId: string
): Promise<boolean> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  const raw = await redis.get(key);
  if (!raw) return false;

  const metadata = JSON.parse(raw) as SessionMetadata;
  metadata.last_active_at = Date.now();

  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    await redis.set(key, JSON.stringify(metadata), "EX", ttl);
  }
  return true;
}

/**
 * Delete session metadata (on logout or termination).
 */
export async function deleteSessionMetadata(
  sessionId: string
): Promise<void> {
  const key = `${SESSION_PREFIX}${sessionId}`;
  await redis.del(key);
}

// ─── User Session Set Helpers ─────────────────────────────────────────

/**
 * Add a session ID to the user's active session set.
 */
export async function addUserSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const key = `${USER_SESSIONS_PREFIX}${userId}`;
  await redis.sadd(key, sessionId);
}

/**
 * Remove a session ID from the user's active session set.
 */
export async function removeUserSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const key = `${USER_SESSIONS_PREFIX}${userId}`;
  await redis.srem(key, sessionId);
}

/**
 * Get all active session IDs for a user.
 */
export async function getUserSessions(userId: string): Promise<string[]> {
  const key = `${USER_SESSIONS_PREFIX}${userId}`;
  return redis.smembers(key);
}

/**
 * Remove all sessions for a user (used on logout-all or token theft detection).
 * Also cleans up individual session metadata keys.
 */
export async function clearAllUserSessions(userId: string): Promise<void> {
  const key = `${USER_SESSIONS_PREFIX}${userId}`;
  const sessionIds = await redis.smembers(key);

  if (sessionIds.length > 0) {
    const pipeline = redis.pipeline();
    for (const sid of sessionIds) {
      pipeline.del(`${SESSION_PREFIX}${sid}`);
    }
    pipeline.del(key);
    await pipeline.exec();
  }
}

/**
 * Remove all sessions for a user except a specific one (used on logout-all-except-current).
 */
export async function clearUserSessionsExcept(
  userId: string,
  exceptSessionId: string
): Promise<void> {
  const key = `${USER_SESSIONS_PREFIX}${userId}`;
  const sessionIds = await redis.smembers(key);

  const toRemove = sessionIds.filter((sid) => sid !== exceptSessionId);
  if (toRemove.length === 0) return;

  const pipeline = redis.pipeline();
  for (const sid of toRemove) {
    pipeline.del(`${SESSION_PREFIX}${sid}`);
    pipeline.srem(key, sid);
  }
  await pipeline.exec();
}
