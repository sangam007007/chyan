// Redis client
export { redis, disconnectRedis } from "./client.js";

// OTP storage helpers
export {
  storeOtp,
  getOtp,
  incrementOtpAttempts,
  deleteOtp,
  type OtpData,
} from "./otp.js";

// Rate limiting helpers
export {
  recordOtpRequest,
  getOtpRequestCount,
  getOtpRetryAfter,
  recordIpRequest,
  getIpRequestCount,
  getIpRetryAfter,
} from "./rate-limit.js";

// Session helpers
export {
  storeSessionMetadata,
  getSessionMetadata,
  updateSessionActivity,
  deleteSessionMetadata,
  addUserSession,
  removeUserSession,
  getUserSessions,
  clearAllUserSessions,
  clearUserSessionsExcept,
  type SessionMetadata,
} from "./session.js";

// Lockout and cooldown helpers
export {
  setLockout,
  getLockout,
  getLockoutRemaining,
  clearLockout,
  setResendCooldown,
  isResendCooldownActive,
  getResendCooldownRemaining,
  type LockoutData,
} from "./lockout.js";

// CSRF helpers
export {
  storeCsrfToken,
  validateCsrfToken,
  revokeCsrfToken,
  revokeAllCsrfTokensForUser,
} from "./csrf.js";
