/**
 * OTP Service — Handles generation, verification, invalidation, and rate limiting
 * of One-Time Passwords for phone-based authentication.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.6, 3.1, 3.2, 3.4, 4.1, 4.2, 4.5
 */

import { randomInt, createHash } from "node:crypto";

import {
  storeOtp,
  getOtp,
  incrementOtpAttempts,
  deleteOtp,
  recordOtpRequest,
  getOtpRequestCount,
  getOtpRetryAfter,
  setLockout,
  getLockout,
  getLockoutRemaining,
  setResendCooldown,
  isResendCooldownActive,
  getResendCooldownRemaining,
} from "@/redis/index.js";

import type { SmsGateway } from "./sms-gateway.interface.js";
import {
  OtpRateLimitError,
  ResendCooldownError,
  InvalidOtpError,
  OtpExpiredError,
  OtpLockoutError,
  SmsDeliveryError,
} from "@/errors/otp.errors.js";

// ─── Constants ────────────────────────────────────────────────────────

/** Maximum OTP generation requests per phone per hour */
const MAX_OTP_PER_HOUR = 5;

/** Maximum failed verification attempts before lockout */
const MAX_VERIFY_ATTEMPTS = 5;

/** OTP expiry time in seconds */
const OTP_EXPIRY_SECONDS = 300;

// ─── Types ────────────────────────────────────────────────────────────

export interface GenerateOtpResult {
  /** Whether the OTP was generated and sent successfully */
  success: boolean;
  /** Seconds until the OTP expires */
  expiresIn: number;
  /** Seconds until next resend is allowed */
  resendAfter: number;
}

export interface VerifyOtpResult {
  /** Whether verification succeeded */
  valid: boolean;
}

// ─── OTP Service ──────────────────────────────────────────────────────

export class OtpService {
  constructor(private readonly smsGateway: SmsGateway) {}

  /**
   * Hash a phone number using SHA-256 for use as Redis keys.
   * This prevents storing raw phone numbers in Redis.
   */
  hashPhone(phone: string): string {
    return createHash("sha256").update(phone).digest("hex");
  }

  /**
   * Generate a cryptographically secure 6-digit OTP code.
   * Range: 000000–999999 (left-padded with zeros).
   */
  generateCode(): string {
    const code = randomInt(0, 1_000_000);
    return code.toString().padStart(6, "0");
  }

  /**
   * Generate and send an OTP for a phone number.
   *
   * Flow:
   * 1. Check resend cooldown (30s between resends)
   * 2. Check rate limit (max 5 per hour)
   * 3. Generate crypto-random 6-digit code
   * 4. Store in Redis (invalidates any previous OTP for same phone)
   * 5. Set resend cooldown
   * 6. Record rate limit entry
   * 7. Send via SMS gateway
   *
   * @param phone - Validated 10-digit Indian phone number
   * @throws ResendCooldownError if 30-second cooldown is active
   * @throws OtpRateLimitError if hourly limit exceeded
   * @throws SmsDeliveryError if SMS gateway fails
   */
  async generate(phone: string): Promise<GenerateOtpResult> {
    const phoneHash = this.hashPhone(phone);

    // 1. Check resend cooldown
    const cooldownActive = await isResendCooldownActive(phoneHash);
    if (cooldownActive) {
      const remaining = await getResendCooldownRemaining(phoneHash);
      throw new ResendCooldownError(remaining);
    }

    // 2. Check rate limit (5 OTPs per phone per hour)
    const currentCount = await getOtpRequestCount(phoneHash);
    if (currentCount >= MAX_OTP_PER_HOUR) {
      const retryAfter = await getOtpRetryAfter(phoneHash);
      throw new OtpRateLimitError(retryAfter);
    }

    // 3. Generate secure OTP code
    const code = this.generateCode();

    // 4. Store OTP in Redis (auto-invalidates previous OTP for same phone via overwrite)
    await storeOtp(phoneHash, code);

    // 5. Set resend cooldown (30 seconds)
    await setResendCooldown(phoneHash);

    // 6. Record this request in the rate limit sliding window
    await recordOtpRequest(phoneHash);

    // 7. Send OTP via SMS gateway
    const deliveryResult = await this.smsGateway.sendOtp(phone, code);
    if (!deliveryResult.success) {
      // Clean up: remove the OTP from Redis since delivery failed
      await deleteOtp(phoneHash);
      throw new SmsDeliveryError({ providerError: deliveryResult.error });
    }

    return {
      success: true,
      expiresIn: OTP_EXPIRY_SECONDS,
      resendAfter: 30,
    };
  }

  /**
   * Verify an OTP code against the stored value.
   *
   * Flow:
   * 1. Check if phone is locked out
   * 2. Retrieve stored OTP from Redis
   * 3. If no OTP found, treat as expired
   * 4. Compare codes
   * 5. On match: invalidate OTP (single-use) and return success
   * 6. On mismatch: increment attempts, enforce lockout after 5 failures
   *
   * @param phone - The phone number to verify against
   * @param code - The 6-digit OTP code submitted by user
   * @throws OtpLockoutError if phone is locked out
   * @throws OtpExpiredError if no OTP exists (expired or never sent)
   * @throws InvalidOtpError if code doesn't match
   */
  async verify(phone: string, code: string): Promise<VerifyOtpResult> {
    const phoneHash = this.hashPhone(phone);

    // 1. Check lockout status
    const lockout = await getLockout(phoneHash);
    if (lockout) {
      const remainingSeconds = await getLockoutRemaining(phoneHash);
      throw new OtpLockoutError(remainingSeconds);
    }

    // 2. Retrieve stored OTP
    const otpData = await getOtp(phoneHash);

    // 3. No OTP found — expired or never sent
    if (!otpData) {
      throw new OtpExpiredError();
    }

    // 4. Compare the submitted code with stored code
    if (otpData.code === code) {
      // 5. Success — invalidate OTP (single-use) and return
      await deleteOtp(phoneHash);
      return { valid: true };
    }

    // 6. Mismatch — increment attempts
    const attempts = await incrementOtpAttempts(phoneHash);
    const totalAttempts = attempts ?? otpData.attempts + 1;

    // Enforce lockout after MAX_VERIFY_ATTEMPTS failures
    if (totalAttempts >= MAX_VERIFY_ATTEMPTS) {
      await setLockout(phoneHash, "max_attempts");
      // Also invalidate the OTP since it's now useless
      await deleteOtp(phoneHash);
      throw new OtpLockoutError(900); // 15 minutes = 900 seconds
    }

    const remainingAttempts = MAX_VERIFY_ATTEMPTS - totalAttempts;
    throw new InvalidOtpError(remainingAttempts);
  }

  /**
   * Invalidate (remove) the OTP for a phone number.
   * Used when a new OTP is generated or verification succeeds.
   *
   * @param phone - The phone number whose OTP should be removed
   */
  async invalidate(phone: string): Promise<void> {
    const phoneHash = this.hashPhone(phone);
    await deleteOtp(phoneHash);
  }

  /**
   * Check if a phone number can request a new OTP (rate limit check).
   * Does NOT consume a rate limit slot.
   *
   * @param phone - The phone number to check
   * @returns Whether the request would be allowed
   */
  async canRequestOtp(phone: string): Promise<{
    allowed: boolean;
    retryAfter?: number;
  }> {
    const phoneHash = this.hashPhone(phone);
    const count = await getOtpRequestCount(phoneHash);
    if (count >= MAX_OTP_PER_HOUR) {
      const retryAfter = await getOtpRetryAfter(phoneHash);
      return { allowed: false, retryAfter };
    }
    return { allowed: true };
  }

  /**
   * Check if the resend cooldown is active for a phone number.
   *
   * @param phone - The phone number to check
   * @returns Whether cooldown is active and remaining seconds
   */
  async checkResendCooldown(phone: string): Promise<{
    active: boolean;
    remainingSeconds: number;
  }> {
    const phoneHash = this.hashPhone(phone);
    const active = await isResendCooldownActive(phoneHash);
    if (!active) {
      return { active: false, remainingSeconds: 0 };
    }
    const remaining = await getResendCooldownRemaining(phoneHash);
    return { active: true, remainingSeconds: remaining };
  }

  /**
   * Check if a phone number is currently locked out.
   *
   * @param phone - The phone number to check
   * @returns Whether lockout is active and remaining seconds
   */
  async checkLockout(phone: string): Promise<{
    locked: boolean;
    remainingSeconds: number;
  }> {
    const phoneHash = this.hashPhone(phone);
    const lockout = await getLockout(phoneHash);
    if (!lockout) {
      return { locked: false, remainingSeconds: 0 };
    }
    const remaining = await getLockoutRemaining(phoneHash);
    return { locked: true, remainingSeconds: remaining };
  }
}
