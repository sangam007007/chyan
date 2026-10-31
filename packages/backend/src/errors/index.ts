export {
  AppError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ExternalServiceError,
} from "./app-error.js";

export {
  OtpError,
  OtpRateLimitError,
  ResendCooldownError,
  InvalidOtpError,
  OtpExpiredError,
  OtpLockoutError,
  SmsDeliveryError,
} from "./otp.errors.js";

export {
  SessionError,
  RefreshDeniedError,
  TokenReuseError,
  SessionTerminatedError,
  CannotTerminateCurrentSessionError,
} from "./session.errors.js";

export {
  ProfileError,
  NameValidationError,
  AvatarTooLargeError,
  AvatarInvalidFormatError,
  AvatarTooSmallError,
  ExamChangeLimitError,
  UserNotFoundError,
  InvalidLanguageError,
  InvalidExamError,
} from "./profile.errors.js";
