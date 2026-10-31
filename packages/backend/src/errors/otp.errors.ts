/**
 * Typed error classes for OTP-related failures.
 * Each error maps to a specific error code from the API error taxonomy.
 */

export class OtpError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OtpError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Phone-based OTP rate limit exceeded (5 OTPs per hour) */
export class OtpRateLimitError extends OtpError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      "OTP rate limit exceeded. Too many OTP requests for this phone number.",
      "RATE_LIMITED",
      429,
      { retryAfter }
    );
    this.name = "OtpRateLimitError";
    this.retryAfter = retryAfter;
  }
}

/** Resend cooldown active (30-second minimum between resends) */
export class ResendCooldownError extends OtpError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      "Resend cooldown active. Please wait before requesting another OTP.",
      "RESEND_COOLDOWN",
      429,
      { retryAfter }
    );
    this.name = "ResendCooldownError";
    this.retryAfter = retryAfter;
  }
}

/** OTP verification failed (wrong code) */
export class InvalidOtpError extends OtpError {
  public readonly remainingAttempts: number;

  constructor(remainingAttempts: number) {
    super(
      "Invalid OTP code.",
      "INVALID_OTP",
      400,
      { remainingAttempts }
    );
    this.name = "InvalidOtpError";
    this.remainingAttempts = remainingAttempts;
  }
}

/** OTP has expired (past 300-second window) */
export class OtpExpiredError extends OtpError {
  constructor() {
    super("OTP has expired. Please request a new one.", "OTP_EXPIRED", 400);
    this.name = "OtpExpiredError";
  }
}

/** Phone locked out after 5 failed verification attempts */
export class OtpLockoutError extends OtpError {
  public readonly remainingSeconds: number;

  constructor(remainingSeconds: number) {
    super(
      "Too many failed attempts. Phone number is temporarily locked.",
      "OTP_MAX_ATTEMPTS",
      429,
      { remainingSeconds }
    );
    this.name = "OtpLockoutError";
    this.remainingSeconds = remainingSeconds;
  }
}

/** SMS delivery failed */
export class SmsDeliveryError extends OtpError {
  constructor(details?: Record<string, unknown>) {
    super(
      "SMS delivery failed. Please try again.",
      "SMS_DELIVERY_FAILED",
      502,
      details
    );
    this.name = "SmsDeliveryError";
  }
}
