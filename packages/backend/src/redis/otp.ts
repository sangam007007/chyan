import { redis } from "./client.js";

// ─── Constants ────────────────────────────────────────────────────────
const OTP_TTL = 300; // 5 minutes
const OTP_PREFIX = "otp:";

// ─── Types ────────────────────────────────────────────────────────────
export interface OtpData {
  code: string;
  attempts: number;
  created_at: number;
}

// ─── OTP Storage Helpers ──────────────────────────────────────────────

/**
 * Store an OTP for a phone hash. Overwrites any previous OTP
 * (ensures only the latest OTP is valid).
 */
export async function storeOtp(
  phoneHash: string,
  code: string
): Promise<void> {
  const key = `${OTP_PREFIX}${phoneHash}`;
  const data: OtpData = {
    code,
    attempts: 0,
    created_at: Date.now(),
  };
  await redis.set(key, JSON.stringify(data), "EX", OTP_TTL);
}

/**
 * Retrieve the current OTP data for a phone hash.
 * Returns null if no OTP exists or it has expired.
 */
export async function getOtp(phoneHash: string): Promise<OtpData | null> {
  const key = `${OTP_PREFIX}${phoneHash}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as OtpData;
}

/**
 * Increment the attempt counter for an OTP.
 * Returns the updated attempt count, or null if the OTP doesn't exist.
 */
export async function incrementOtpAttempts(
  phoneHash: string
): Promise<number | null> {
  const key = `${OTP_PREFIX}${phoneHash}`;
  const raw = await redis.get(key);
  if (!raw) return null;

  const data = JSON.parse(raw) as OtpData;
  data.attempts += 1;

  // Preserve remaining TTL
  const ttl = await redis.ttl(key);
  if (ttl > 0) {
    await redis.set(key, JSON.stringify(data), "EX", ttl);
  }

  return data.attempts;
}

/**
 * Delete the OTP for a phone hash (invalidation after successful verify or explicit clear).
 */
export async function deleteOtp(phoneHash: string): Promise<void> {
  const key = `${OTP_PREFIX}${phoneHash}`;
  await redis.del(key);
}
