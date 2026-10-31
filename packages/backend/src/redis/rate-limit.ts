import { redis } from "./client.js";

// ─── Constants ────────────────────────────────────────────────────────
const OTP_RATE_PREFIX = "otp_count:";
const IP_RATE_PREFIX = "ip_rate:";
const RATE_WINDOW = 60; // 1 minute in seconds

// ─── Sliding Window Rate Limiting ─────────────────────────────────────

/**
 * Record a request timestamp in a sorted set and return the current
 * count within the sliding window.
 *
 * This implements a sliding-window rate limiter:
 * 1. Remove entries older than the window
 * 2. Add the current timestamp
 * 3. Set TTL on the key for cleanup
 * 4. Return the count of entries in the window
 */
async function slidingWindowIncrement(
  key: string,
  windowSeconds: number
): Promise<number> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const pipeline = redis.pipeline();
  // Remove timestamps outside the window
  pipeline.zremrangebyscore(key, 0, windowStart);
  // Add current timestamp (score = timestamp, member = unique identifier)
  pipeline.zadd(key, now.toString(), `${now}:${Math.random()}`);
  // Count entries within window
  pipeline.zcard(key);
  // Set TTL so the key auto-expires after the window passes
  pipeline.expire(key, windowSeconds);

  const results = await pipeline.exec();
  // zcard result is at index 2
  const count = results?.[2]?.[1] as number;
  return count;
}

/**
 * Get the current count of requests in the sliding window without adding a new entry.
 */
async function slidingWindowCount(
  key: string,
  windowSeconds: number
): Promise<number> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // Clean stale entries first
  await redis.zremrangebyscore(key, 0, windowStart);
  return redis.zcard(key);
}

/**
 * Get the timestamp of the oldest entry in the window (useful for Retry-After calculation).
 */
async function getOldestTimestamp(key: string): Promise<number | null> {
  const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
  if (oldest.length < 2) return null;
  return parseInt(oldest[1], 10);
}

// ─── OTP Rate Limiting (per phone) ───────────────────────────────────

/**
 * Record an OTP send request for a phone hash.
 * Returns the count of OTPs sent within the rolling 1-hour window.
 */
export async function recordOtpRequest(phoneHash: string): Promise<number> {
  const key = `${OTP_RATE_PREFIX}${phoneHash}`;
  return slidingWindowIncrement(key, RATE_WINDOW);
}

/**
 * Get the current OTP send count for a phone hash within the window.
 */
export async function getOtpRequestCount(phoneHash: string): Promise<number> {
  const key = `${OTP_RATE_PREFIX}${phoneHash}`;
  return slidingWindowCount(key, RATE_WINDOW);
}

/**
 * Get seconds until the oldest OTP request exits the window.
 * Useful for the Retry-After header.
 */
export async function getOtpRetryAfter(phoneHash: string): Promise<number> {
  const key = `${OTP_RATE_PREFIX}${phoneHash}`;
  const oldest = await getOldestTimestamp(key);
  if (!oldest) return 0;
  const expiresAt = oldest + RATE_WINDOW * 1000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

// ─── IP Rate Limiting (sliding window) ────────────────────────────────

/**
 * Record a login-related request from an IP address.
 * Returns the count of requests within the rolling 1-hour window.
 */
export async function recordIpRequest(ipAddress: string): Promise<number> {
  const key = `${IP_RATE_PREFIX}${ipAddress}`;
  return slidingWindowIncrement(key, RATE_WINDOW);
}

/**
 * Get the current request count for an IP within the window.
 */
export async function getIpRequestCount(ipAddress: string): Promise<number> {
  const key = `${IP_RATE_PREFIX}${ipAddress}`;
  return slidingWindowCount(key, RATE_WINDOW);
}

/**
 * Get seconds until the oldest IP request exits the window.
 * Useful for the Retry-After header.
 */
export async function getIpRetryAfter(ipAddress: string): Promise<number> {
  const key = `${IP_RATE_PREFIX}${ipAddress}`;
  const oldest = await getOldestTimestamp(key);
  if (!oldest) return 0;
  const expiresAt = oldest + RATE_WINDOW * 1000;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}
