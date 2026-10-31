/**
 * Base application error class and typed subclasses.
 *
 * All known errors thrown by the application should extend AppError so the
 * global error handler can produce a consistent JSON response shape:
 *
 *   { success: false, error: { code, message, details?, retryAfter? } }
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    options?: { details?: Record<string, unknown>; retryAfter?: number },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = options?.details;
    this.retryAfter = options?.retryAfter;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Request body or query parameter validation failure.
 * Typically thrown by the Zod validation middleware.
 */
export class ValidationError extends AppError {
  constructor(
    message: string = "Validation failed",
    details?: Record<string, unknown>,
  ) {
    super(message, "VALIDATION_ERROR", 422, { details });
    this.name = "ValidationError";
  }
}

/**
 * Authentication or authorization failure.
 * Covers expired tokens, invalid tokens, and session-terminated scenarios.
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = "Authentication required",
    code: string = "TOKEN_INVALID",
    details?: Record<string, unknown>,
  ) {
    super(message, code, 401, { details });
    this.name = "AuthenticationError";
  }
}

/**
 * Rate limit exceeded.
 * Always includes a retryAfter value (in seconds) so clients know when to retry.
 */
export class RateLimitError extends AppError {
  constructor(
    retryAfter: number,
    message: string = "Too many requests. Please try again later.",
    code: string = "RATE_LIMITED",
  ) {
    super(message, code, 429, { retryAfter });
    this.name = "RateLimitError";
  }
}

/**
 * An external service (SMS gateway, Google OAuth, CAPTCHA, etc.) failed.
 */
export class ExternalServiceError extends AppError {
  constructor(
    service: string,
    message: string = `External service failure: ${service}`,
    details?: Record<string, unknown>,
  ) {
    super(message, "EXTERNAL_SERVICE_ERROR", 502, {
      details: { service, ...details },
    });
    this.name = "ExternalServiceError";
  }
}
