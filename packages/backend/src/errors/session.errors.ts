/**
 * Typed error classes for session/token-related failures.
 * Each error maps to a specific error code from the API error taxonomy.
 */

export class SessionError extends Error {
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
    this.name = "SessionError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Refresh token is expired, revoked, or invalid */
export class RefreshDeniedError extends SessionError {
  constructor(reason: string = "Token invalid or expired") {
    super(
      `Refresh denied: ${reason}`,
      "REFRESH_DENIED",
      401,
      { reason }
    );
    this.name = "RefreshDeniedError";
  }
}

/** Token reuse detected — entire family invalidated */
export class TokenReuseError extends SessionError {
  constructor() {
    super(
      "Refresh token reuse detected. All sessions have been revoked for security.",
      "REFRESH_DENIED",
      401,
      { reason: "token_reuse_detected" }
    );
    this.name = "TokenReuseError";
  }
}

/** Session was remotely terminated */
export class SessionTerminatedError extends SessionError {
  constructor() {
    super(
      "Session has been terminated.",
      "SESSION_TERMINATED",
      401
    );
    this.name = "SessionTerminatedError";
  }
}

/** Cannot terminate current session via the sessions list */
export class CannotTerminateCurrentSessionError extends SessionError {
  constructor() {
    super(
      "Cannot terminate the current session. Use logout instead.",
      "VALIDATION_ERROR",
      400
    );
    this.name = "CannotTerminateCurrentSessionError";
  }
}
