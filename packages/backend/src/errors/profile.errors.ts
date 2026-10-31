/**
 * Typed error classes for profile-related failures.
 * Each error maps to a specific error code from the API error taxonomy.
 */

export class ProfileError extends Error {
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
    this.name = "ProfileError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** Full name validation failed (2-50 chars, letters/spaces/hyphens/periods only) */
export class NameValidationError extends ProfileError {
  constructor(reason: string) {
    super(
      `Invalid name: ${reason}`,
      "NAME_INVALID",
      422,
      { reason }
    );
    this.name = "NameValidationError";
  }
}

/** Avatar file exceeds 2MB size limit */
export class AvatarTooLargeError extends ProfileError {
  constructor(sizeBytes: number, maxBytes: number) {
    super(
      "Avatar file exceeds the maximum allowed size of 2MB.",
      "AVATAR_TOO_LARGE",
      422,
      { sizeBytes, maxBytes }
    );
    this.name = "AvatarTooLargeError";
  }
}

/** Avatar file is not JPEG or PNG */
export class AvatarInvalidFormatError extends ProfileError {
  constructor(mimeType: string) {
    super(
      "Avatar must be a JPEG or PNG image.",
      "AVATAR_INVALID_FORMAT",
      422,
      { mimeType, allowedFormats: ["image/jpeg", "image/png"] }
    );
    this.name = "AvatarInvalidFormatError";
  }
}

/** Avatar dimensions are below 200x200 pixels */
export class AvatarTooSmallError extends ProfileError {
  constructor(width: number, height: number) {
    super(
      "Avatar must be at least 200x200 pixels.",
      "AVATAR_TOO_SMALL",
      422,
      { width, height, minimumWidth: 200, minimumHeight: 200 }
    );
    this.name = "AvatarTooSmallError";
  }
}

/** Monthly exam change limit (3) reached */
export class ExamChangeLimitError extends ProfileError {
  public readonly nextResetDate: string;

  constructor(nextResetDate: string) {
    super(
      "Monthly exam change limit reached. You can only change your exam 3 times per month.",
      "EXAM_CHANGE_LIMIT",
      429,
      { nextResetDate }
    );
    this.name = "ExamChangeLimitError";
    this.nextResetDate = nextResetDate;
  }
}

/** User not found */
export class UserNotFoundError extends ProfileError {
  constructor(userId: string) {
    super(
      "User not found.",
      "USER_NOT_FOUND",
      404,
      { userId }
    );
    this.name = "UserNotFoundError";
  }
}

/** Invalid language selection */
export class InvalidLanguageError extends ProfileError {
  constructor(language: string) {
    super(
      "Invalid language. Must be 'hi' or 'en'.",
      "VALIDATION_ERROR",
      422,
      { language, allowedValues: ["hi", "en"] }
    );
    this.name = "InvalidLanguageError";
  }
}

/** Invalid exam ID */
export class InvalidExamError extends ProfileError {
  constructor(examId: string) {
    super(
      "Invalid exam selection. Exam not found or inactive.",
      "VALIDATION_ERROR",
      422,
      { examId }
    );
    this.name = "InvalidExamError";
  }
}
