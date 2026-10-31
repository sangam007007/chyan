/**
 * Audit logging utility for sensitive operations.
 *
 * Inserts entries into the `auth_audit_log` table for actions such as:
 * - otp_generated, otp_verified, otp_failed
 * - login_google, login_phone
 * - session_created, session_revoked, session_revoked_all
 * - account_linked, account_deleted, account_deletion_cancelled
 * - profile_updated, exam_changed
 *
 * The utility is fire-and-forget: failures are logged to stderr but never
 * propagate exceptions to the caller (audit should not break user flows).
 */

import { queryOne } from "@/db/query.js";

export interface AuditEntry {
  /** User ID (can be null for pre-auth events like OTP generation by phone) */
  userId: string | null;
  /** Action identifier (e.g. "otp_generated", "login_phone") */
  action: string;
  /** Client IP address */
  ip: string | null;
  /** Arbitrary metadata for context (phone_hash, device_type, provider, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Insert an audit log entry.
 * This is fire-and-forget — errors are caught and logged, never thrown.
 */
export async function logAudit(
  userId: string | null,
  action: string,
  ip: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await queryOne(
      `INSERT INTO auth_audit_log (user_id, action, ip_address, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, action, ip, metadata ? JSON.stringify(metadata) : null],
    );
  } catch (err) {
    // Never let audit failures break user-facing flows
    console.error("[audit] Failed to write audit log entry:", {
      action,
      userId,
      error: err instanceof Error ? err.message : err,
    });
  }
}
