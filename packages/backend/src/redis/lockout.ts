import { redis } from "./client.js";

// ─── Constants ────────────────────────────────────────────────────────
const LOCKOUT_PREFIX = "lockout:";
const LOCKOUT_TTL = 900; // 15 minutes in seconds
const RESEND_COOLDOWN_PREFIX = "resend_cooldown:";
const RESEND_COOLDOWN_TTL = 30; // 30 seconds

// ─── Types ────────────────────────────────────────────────────────────
export interface LockoutData {
  until: number; // timestamp (ms) when lockout expires
  reason: string;
}

// ─── Lockout Helpers ──────────────────────────────────────────────────

/**
 * Set a lockout for a phone hash (e.g., after 5 failed OTP verifications).
 */
export async function setLockout(
  phoneHash: string,
  reason: string = "max_attempts"
): Promise<void> {
  const key = `${LOCKOUT_PREFIX}${phoneHash}`;
  const data: LockoutData = {
    until: Date.now() + LOCKOUT_TTL * 1000,
    reason,
  };
  await redis.set(key, JSON.stringify(data), "EX", LOCKOUT_TTL);
}

/**
 * Check if a phone hash is currently locked out.
 * Returns the lockout data if active, null otherwise.
 */
export async function getLockout(
  phoneHash: string
): Promise<LockoutData | null> {
  const key = `${LOCKOUT_PREFIX}${phoneHash}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as LockoutData;
}

/**
 * Get the remaining lockout duration in seconds.
 * Returns 0 if not locked out.
 */
export async function getLockoutRemaining(
  phoneHash: string
): Promise<number> {
  const key = `${LOCKOUT_PREFIX}${phoneHash}`;
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 0;
}

/**
 * Clear a lockout (e.g., after the lockout period or a successful verification).
 */
export async function clearLockout(phoneHash: string): Promise<void> {
  const key = `${LOCKOUT_PREFIX}${phoneHash}`;
  await redis.del(key);
}

// ─── Resend Cooldown Helpers ──────────────────────────────────────────

/**
 * Set a resend cooldown for a phone hash (30-second window).
 */
export async function setResendCooldown(phoneHash: string): Promise<void> {
  const key = `${RESEND_COOLDOWN_PREFIX}${phoneHash}`;
  await redis.set(key, "1", "EX", RESEND_COOLDOWN_TTL);
}

/**
 * Check if a resend cooldown is active for a phone hash.
 * Returns true if the user must wait before resending.
 */
export async function isResendCooldownActive(
  phoneHash: string
): Promise<boolean> {
  const key = `${RESEND_COOLDOWN_PREFIX}${phoneHash}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Get the remaining cooldown time in seconds.
 * Returns 0 if no cooldown is active.
 */
export async function getResendCooldownRemaining(
  phoneHash: string
): Promise<number> {
  const key = `${RESEND_COOLDOWN_PREFIX}${phoneHash}`;
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 0;
}
