/**
 * Session Service — Handles JWT token issuance, refresh token rotation,
 * session lifecycle management, and multi-device session control.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.3, 8.4
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import { env } from "@/config/env.js";
import { queryOne, queryMany, withTransaction } from "@/db/index.js";
import type { QueryOptions } from "@/db/index.js";
import {
  storeSessionMetadata,
  deleteSessionMetadata,
  addUserSession,
  removeUserSession,
  getUserSessions,
  clearAllUserSessions,
  clearUserSessionsExcept,
} from "@/redis/index.js";
import { RefreshDeniedError, TokenReuseError } from "@/errors/session.errors.js";

// ─── Constants ────────────────────────────────────────────────────────

/** Access token expiry: 1 hour in seconds */
const ACCESS_TOKEN_EXPIRY = 3600;

/** Refresh token expiry: 30 days in seconds */
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60;

/** Maximum concurrent sessions per user */
const MAX_SESSIONS_PER_USER = 3;

/** Bcrypt salt rounds for refresh token hashing */

// ─── Types ────────────────────────────────────────────────────────────

export interface DeviceInfo {
  device_type: string; // 'mobile' | 'desktop' | 'tablet'
  device_info: Record<string, unknown>; // parsed user-agent
  ip_address: string;
  city?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  token_family: string;
  device_type: string;
  device_info: Record<string, unknown>;
  ip_address: string;
  city: string | null;
  is_active: boolean;
  last_active_at: Date;
  created_at: Date;
  expires_at: Date;
}

export interface CreateSessionResult {
  session: SessionRecord;
  tokens: TokenPair;
}

export interface RefreshResult {
  tokens: TokenPair;
  sessionId: string;
}

// ─── Session Service ──────────────────────────────────────────────────

export class SessionService {
  /**
   * Generate a JWT access token.
   * Payload: { sub: userId, sessionId, role, iat, exp } where exp-iat = 3600 (1h)
   */
  generateAccessToken(userId: string, sessionId: string, role: string = 'student'): string {
    return jwt.sign(
      { sub: userId, sessionId, role },
      env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Generate a refresh token (random UUID string).
   * The raw token is returned to the client; the hash is stored server-side.
   */
  generateRefreshToken(): string {
    return randomUUID();
  }

  /**
   * A refresh token is "<sessionId>.<random secret>". The session id lets us find the one session to check,
   * so a refresh costs ONE bcrypt compare. (It used to compare against every active session of every user,
   * which took seconds per refresh once a few hundred people were logged in, and let anyone jam the server.)
   */
  composeRefreshToken(sessionId: string): string {
    return `${sessionId}.${this.generateRefreshToken()}`;
  }

  parseRefreshToken(token: string): { sessionId: string } | null {
    const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[0-9a-f-]{36}$/i.exec(token);
    return m ? { sessionId: m[1] } : null;
  }

  /**
   * Hash a refresh token for storage: HMAC-SHA256 keyed with the server's refresh secret.
   *
   * The token is 122 random bits, so it cannot be guessed or brute-forced, and a slow password hash (bcrypt)
   * adds nothing. bcrypt costs ~50 ms of CPU per call, which made 1000 people opening the app at once take
   * over a minute and made requests fail. This costs microseconds.
   */
  async hashRefreshToken(token: string): Promise<string> {
    // 64 hex characters: exactly the width of the sessions.refresh_token_hash column
    return createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
  }

  /**
   * Compare a raw refresh token against a stored hash (HMAC format; hashes written by older versions are bcrypt).
   */
  async verifyRefreshToken(token: string, hash: string): Promise<boolean> {
    if (hash.startsWith("$2")) return bcrypt.compare(token, hash);
    if (!/^[0-9a-f]{64}$/i.test(hash)) return false;
    const expected = Buffer.from(hash, "hex");
    const actual = createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest();
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /**
   * Create a new session for a user.
   *
   * Flow:
   * 1. Check active session count — if ≥ 3, evict the oldest session
   * 2. Generate a new token family UUID
   * 3. Generate refresh token + hash it
   * 4. Store session record in PostgreSQL
   * 5. Store session metadata in Redis
   * 6. Add session to user's active session set in Redis
   * 7. Generate access token
   * 8. Return session + tokens
   *
   * @param userId - The authenticated user's ID
   * @param deviceInfo - Device/location information from the request
   */
  async create(userId: string, deviceInfo: DeviceInfo): Promise<CreateSessionResult> {
    // The bcrypt hash takes ~50 ms of CPU. It is done first, before a database connection is taken,
    // so a burst of logins does not sit on the small connection pool while hashing.
    const tokenFamily = randomUUID();
    const sessionId = randomUUID();
    const refreshToken = this.composeRefreshToken(sessionId);
    const refreshTokenHash = await this.hashRefreshToken(refreshToken);

    return withTransaction(async (client) => {
      // 1. Check and enforce session limit (max 3 active sessions)
      await this.enforceSessionLimit(userId, { client });

      // 3. Calculate expiry
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);

      // 4. Insert session into the database
      const session = await queryOne<SessionRecord>(
        `INSERT INTO sessions (id, user_id, refresh_token_hash, token_family, device_type, device_info, ip_address, city, is_active, expires_at)
         VALUES ($9, $1, $2, $3, $4, $5, $6, $7, true, $8)
         RETURNING id, user_id, token_family, device_type, device_info, ip_address, city, is_active, last_active_at, created_at, expires_at`,
        [
          userId,
          refreshTokenHash,
          tokenFamily,
          deviceInfo.device_type,
          JSON.stringify(deviceInfo.device_info),
          deviceInfo.ip_address,
          deviceInfo.city || null,
          expiresAt,
          sessionId,
        ],
        { client }
      );

      if (!session) {
        throw new Error("Failed to create session record");
      }

      // 5. Store session metadata in Redis
      await storeSessionMetadata(session.id, {
        user_id: userId,
        device_type: deviceInfo.device_type,
        created_at: Date.now(),
        last_active_at: Date.now(),
      });

      // 6. Add session to user's active session set
      await addUserSession(userId, session.id);

      // 7. Fetch user role for JWT payload
      const userRecord = await queryOne<{ role: string }>(
        `SELECT role FROM users WHERE id = $1`,
        [userId],
        { client }
      );
      const role = userRecord?.role || 'student';

      // 8. Generate access token
      const accessToken = this.generateAccessToken(userId, session.id, role);

      return {
        session,
        tokens: { accessToken, refreshToken },
      };
    });
  }

  /**
   * Refresh an access token using a refresh token.
   *
   * Flow:
   * 1. Find the session by looking up all active sessions and comparing the refresh token hash
   * 2. Validate the token family is not revoked
   * 3. If token hash doesn't match but family is valid → token reuse detected
   * 4. Rotate: invalidate old refresh token hash, generate new one
   * 5. Issue new access token + refresh token
   *
   * @param refreshToken - The raw refresh token from the client cookie
   * @throws RefreshDeniedError if the token is invalid, expired, or revoked
   * @throws TokenReuseError if token reuse is detected (family revocation)
   */
  async refresh(refreshToken: string): Promise<RefreshResult> {
    // The token names its own session: look at that one session only (one bcrypt compare, never a scan)
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) {
      // Tokens from before this change (plain random ids) cannot be traced to a session: log in again
      throw new RefreshDeniedError("Invalid refresh token");
    }
    const candidate = await queryOne<SessionRecord & { refresh_token_hash: string }>(
      `SELECT id, user_id, refresh_token_hash, token_family, device_type, device_info, ip_address, city, is_active, last_active_at, created_at, expires_at
       FROM sessions WHERE id = $1`,
      [parsed.sessionId],
    );
    if (!candidate) throw new RefreshDeniedError("Invalid refresh token");

    // bcrypt runs here, with no database connection held
    const matches = await this.verifyRefreshToken(refreshToken, candidate.refresh_token_hash);
    if (!matches) throw new RefreshDeniedError("Invalid refresh token");

    if (!candidate.is_active) {
      // A valid token of a session that was already ended = it was copied or replayed: end the whole family
      await withTransaction(async (client) => {
        await this.invalidateTokenFamily(candidate.token_family, { client });
        await this.revokeAllInternal(candidate.user_id, undefined, { client });
      });
      throw new TokenReuseError();
    }
    if (new Date(candidate.expires_at).getTime() <= Date.now()) {
      throw new RefreshDeniedError("Invalid refresh token");
    }

    // Valid refresh token: rotate it
    const newRefreshToken = this.composeRefreshToken(candidate.id);
    const newRefreshTokenHash = await this.hashRefreshToken(newRefreshToken);

    // Only the first of two simultaneous refreshes (two tabs) wins; the other keeps the old token and is denied
    const rotated = await queryOne<{ id: string }>(
      `UPDATE sessions
       SET refresh_token_hash = $1, last_active_at = NOW()
       WHERE id = $2 AND refresh_token_hash = $3 AND is_active = true
       RETURNING id`,
      [newRefreshTokenHash, candidate.id, candidate.refresh_token_hash],
    );
    if (!rotated) throw new RefreshDeniedError("Invalid refresh token");

    const userRecord = await queryOne<{ role: string }>(`SELECT role FROM users WHERE id = $1`, [candidate.user_id]);
    const accessToken = this.generateAccessToken(candidate.user_id, candidate.id, userRecord?.role || "student");

    return {
      tokens: { accessToken, refreshToken: newRefreshToken },
      sessionId: candidate.id,
    };
  }

  /**
   * Revoke a specific session.
   * Marks the session as inactive in the database and removes from Redis.
   *
   * @param sessionId - The session ID to revoke
   */
  async revoke(sessionId: string): Promise<void> {
    const session = await queryOne<SessionRecord>(
      `UPDATE sessions SET is_active = false WHERE id = $1 AND is_active = true
       RETURNING id, user_id, token_family, device_type, device_info, ip_address, city, is_active, last_active_at, created_at, expires_at`,
      [sessionId]
    );

    if (session) {
      await deleteSessionMetadata(sessionId);
      await removeUserSession(session.user_id, sessionId);
    }
  }

  /**
   * Revoke all active sessions for a user.
   * Optionally keep one session active (the current one for "logout all other devices").
   *
   * @param userId - The user whose sessions to revoke
   * @param exceptSessionId - Optional session ID to keep active
   */
  async revokeAll(userId: string, exceptSessionId?: string): Promise<void> {
    await withTransaction(async (client) => {
      await this.revokeAllInternal(userId, exceptSessionId, { client });
    });
  }

  /**
   * List all active sessions for a user with device info.
   *
   * @param userId - The user whose sessions to list
   * @returns Array of active session records
   */
  async listActive(userId: string): Promise<SessionRecord[]> {
    const sessions = await queryMany<SessionRecord>(
      `SELECT id, user_id, token_family, device_type, device_info, ip_address, city, is_active, last_active_at, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY last_active_at DESC`,
      [userId]
    );
    return sessions;
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Enforce the maximum session limit (3 active sessions per user).
   * If the user already has 3+ active sessions, evict the oldest one.
   */
  private async enforceSessionLimit(userId: string, options?: QueryOptions): Promise<void> {
    const activeSessions = await queryMany<SessionRecord>(
      `SELECT id, user_id, token_family, device_type, device_info, ip_address, city, is_active, last_active_at, created_at, expires_at
       FROM sessions
       WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
       ORDER BY created_at ASC`,
      [userId],
      options
    );

    // If at the limit, evict oldest sessions to make room for the new one
    const sessionsToEvict = activeSessions.length >= MAX_SESSIONS_PER_USER
      ? activeSessions.slice(0, activeSessions.length - MAX_SESSIONS_PER_USER + 1)
      : [];

    for (const session of sessionsToEvict) {
      await queryOne(
        `UPDATE sessions SET is_active = false WHERE id = $1`,
        [session.id],
        options
      );
      await deleteSessionMetadata(session.id);
      await removeUserSession(userId, session.id);
    }
  }

  /**
   * Invalidate all sessions in a token family (used on token reuse detection).
   */
  private async invalidateTokenFamily(tokenFamily: string, options?: QueryOptions): Promise<void> {
    await queryMany(
      `UPDATE sessions SET is_active = false WHERE token_family = $1 AND is_active = true`,
      [tokenFamily],
      options
    );
  }

  /**
   * Internal helper for revoking all sessions (used within transactions).
   */
  private async revokeAllInternal(
    userId: string,
    exceptSessionId?: string,
    options?: QueryOptions
  ): Promise<void> {
    if (exceptSessionId) {
      // Revoke all except the specified session
      await queryMany(
        `UPDATE sessions SET is_active = false
         WHERE user_id = $1 AND is_active = true AND id != $2`,
        [userId, exceptSessionId],
        options
      );
      await clearUserSessionsExcept(userId, exceptSessionId);
    } else {
      // Revoke all sessions
      await queryMany(
        `UPDATE sessions SET is_active = false
         WHERE user_id = $1 AND is_active = true`,
        [userId],
        options
      );
      await clearAllUserSessions(userId);
    }
  }
}
