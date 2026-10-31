/**
 * Unit tests for Session Service.
 * Mocks database and Redis utilities to test session logic in isolation.
 */

import bcrypt from "bcrypt";
import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { SessionService } from "./session.service.js";
import { RefreshDeniedError, TokenReuseError } from "@/errors/session.errors.js";

// ─── Mock environment ─────────────────────────────────────────────────

vi.mock("@/config/env.js", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars-long!!",
    JWT_REFRESH_SECRET: "test-jwt-refresh-secret-that-is-at-least-32-chars",
  },
}));

// ─── Mock Redis utilities ─────────────────────────────────────────────

vi.mock("@/redis/index.js", () => ({
  storeSessionMetadata: vi.fn().mockResolvedValue(undefined),
  getSessionMetadata: vi.fn().mockResolvedValue(null),
  deleteSessionMetadata: vi.fn().mockResolvedValue(undefined),
  addUserSession: vi.fn().mockResolvedValue(undefined),
  removeUserSession: vi.fn().mockResolvedValue(undefined),
  getUserSessions: vi.fn().mockResolvedValue([]),
  clearAllUserSessions: vi.fn().mockResolvedValue(undefined),
  clearUserSessionsExcept: vi.fn().mockResolvedValue(undefined),
}));

import * as redisUtils from "@/redis/index.js";

// ─── Mock DB utilities ────────────────────────────────────────────────

const mockQueryOne = vi.fn();
const mockQueryMany = vi.fn();
const mockWithTransaction = vi.fn();

vi.mock("@/db/index.js", () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  queryMany: (...args: unknown[]) => mockQueryMany(...args),
  withTransaction: (fn: (client: unknown) => Promise<unknown>) => mockWithTransaction(fn),
}));

// ─── Test Setup ───────────────────────────────────────────────────────

describe("SessionService", () => {
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SessionService();

    // Default: withTransaction just executes the function with a mock client
    mockWithTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => {
      return fn({ query: vi.fn() });
    });
  });

  // ─── generateAccessToken ──────────────────────────────────────────

  describe("generateAccessToken", () => {
    it("should generate a valid JWT with correct claims", () => {
      const token = service.generateAccessToken("user-123", "session-456");
      const decoded = jwt.verify(token, "test-jwt-secret-that-is-at-least-32-chars-long!!") as jwt.JwtPayload;

      expect(decoded.sub).toBe("user-123");
      expect(decoded.sessionId).toBe("session-456");
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it("should set expiry to exactly 1 hour (3600 seconds) from issuance", () => {
      const token = service.generateAccessToken("user-123", "session-456");
      const decoded = jwt.verify(token, "test-jwt-secret-that-is-at-least-32-chars-long!!") as jwt.JwtPayload;

      expect(decoded.exp! - decoded.iat!).toBe(3600);
    });

    it("should produce different tokens for different userId/sessionId combinations", () => {
      const token1 = service.generateAccessToken("user-1", "session-1");
      const token2 = service.generateAccessToken("user-2", "session-2");

      expect(token1).not.toBe(token2);
    });
  });

  // ─── generateRefreshToken ─────────────────────────────────────────

  describe("generateRefreshToken", () => {
    it("should generate a valid UUID string", () => {
      const token = service.generateRefreshToken();
      // UUID v4 format
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("should generate unique tokens on each call", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(service.generateRefreshToken());
      }
      expect(tokens.size).toBe(100);
    });
  });

  // ─── hashRefreshToken / verifyRefreshToken ────────────────────────

  describe("hashRefreshToken and verifyRefreshToken", () => {
    it("should hash and verify a refresh token correctly", async () => {
      const token = "test-refresh-token-uuid";
      const hash = await service.hashRefreshToken(token);

      expect(hash).not.toBe(token);
      expect(hash.length).toBeGreaterThan(0);

      const isValid = await service.verifyRefreshToken(token, hash);
      expect(isValid).toBe(true);
    });

    it("should reject an incorrect token against a hash", async () => {
      const token = "correct-token";
      const hash = await service.hashRefreshToken(token);

      const isValid = await service.verifyRefreshToken("wrong-token", hash);
      expect(isValid).toBe(false);
    });

    it("hashes different tokens to different values and never stores the token itself", async () => {
      const h1 = await service.hashRefreshToken("token-one");
      const h2 = await service.hashRefreshToken("token-two");

      expect(h1).not.toBe(h2);
      expect(h1).not.toContain("token-one");
      expect(await service.verifyRefreshToken("token-one", h1)).toBe(true);
      expect(await service.verifyRefreshToken("token-two", h1)).toBe(false);
    });

    it("is fast (no password-style slow hash): 200 hashes + checks take well under a second", async () => {
      const t0 = Date.now();
      for (let i = 0; i < 200; i++) {
        const h = await service.hashRefreshToken("t" + i);
        await service.verifyRefreshToken("t" + i, h);
      }
      expect(Date.now() - t0).toBeLessThan(1000);
    });

    it("still accepts hashes written by the older bcrypt version", async () => {
      const legacy = await bcrypt.hash("old-token", 4);
      expect(await service.verifyRefreshToken("old-token", legacy)).toBe(true);
      expect(await service.verifyRefreshToken("other", legacy)).toBe(false);
    });
  });

  // ─── create ───────────────────────────────────────────────────────

  describe("create", () => {
    const mockDeviceInfo = {
      device_type: "mobile",
      device_info: { browser: "Chrome", os: "Android" },
      ip_address: "192.168.1.1",
      city: "Mumbai",
    };

    const mockSessionRow = {
      id: "session-new-uuid",
      user_id: "user-123",
      token_family: "family-uuid",
      device_type: "mobile",
      device_info: { browser: "Chrome", os: "Android" },
      ip_address: "192.168.1.1",
      city: "Mumbai",
      is_active: true,
      last_active_at: new Date(),
      created_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    beforeEach(() => {
      // Default: no existing sessions (under limit)
      mockQueryMany.mockResolvedValue([]);
      // Insert returns the new session
      mockQueryOne.mockResolvedValue(mockSessionRow);
    });

    it("should create a session with access and refresh tokens", async () => {
      const result = await service.create("user-123", mockDeviceInfo);

      expect(result.session).toBeDefined();
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it("should store session metadata in Redis", async () => {
      await service.create("user-123", mockDeviceInfo);

      expect(redisUtils.storeSessionMetadata).toHaveBeenCalledWith(
        "session-new-uuid",
        expect.objectContaining({
          user_id: "user-123",
          device_type: "mobile",
        })
      );
    });

    it("should add session to user's Redis session set", async () => {
      await service.create("user-123", mockDeviceInfo);

      expect(redisUtils.addUserSession).toHaveBeenCalledWith("user-123", "session-new-uuid");
    });

    it("should generate a valid access token with correct claims", async () => {
      const result = await service.create("user-123", mockDeviceInfo);

      const decoded = jwt.verify(
        result.tokens.accessToken,
        "test-jwt-secret-that-is-at-least-32-chars-long!!"
      ) as jwt.JwtPayload;

      expect(decoded.sub).toBe("user-123");
      expect(decoded.sessionId).toBe("session-new-uuid");
      expect(decoded.exp! - decoded.iat!).toBe(3600);
    });

    it("should evict the oldest session when at 3-session limit", async () => {
      const existingSessions = [
        { id: "old-session-1", user_id: "user-123", created_at: new Date("2024-01-01") },
        { id: "old-session-2", user_id: "user-123", created_at: new Date("2024-01-02") },
        { id: "old-session-3", user_id: "user-123", created_at: new Date("2024-01-03") },
      ];

      // First call: queryMany for enforceSessionLimit returns 3 sessions
      mockQueryMany.mockResolvedValueOnce(existingSessions);
      // queryOne for deactivating old session
      mockQueryOne
        .mockResolvedValueOnce({ id: "old-session-1" }) // evict oldest
        .mockResolvedValueOnce(mockSessionRow); // insert new session

      await service.create("user-123", mockDeviceInfo);

      // Should have removed the oldest session from Redis
      expect(redisUtils.deleteSessionMetadata).toHaveBeenCalledWith("old-session-1");
      expect(redisUtils.removeUserSession).toHaveBeenCalledWith("user-123", "old-session-1");
    });

    it("should not evict any sessions when under the limit", async () => {
      mockQueryMany.mockResolvedValueOnce([
        { id: "session-1", user_id: "user-123", created_at: new Date() },
        { id: "session-2", user_id: "user-123", created_at: new Date() },
      ]);
      mockQueryOne.mockResolvedValueOnce(mockSessionRow);

      await service.create("user-123", mockDeviceInfo);

      // deleteSessionMetadata should not be called for eviction
      expect(redisUtils.deleteSessionMetadata).not.toHaveBeenCalled();
    });

    it("should throw if session insertion fails", async () => {
      mockQueryMany.mockResolvedValueOnce([]);
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.create("user-123", mockDeviceInfo)).rejects.toThrow(
        "Failed to create session record"
      );
    });
  });

  // ─── refresh ──────────────────────────────────────────────────────

  describe("refresh", () => {
    const SID = "11111111-1111-4111-8111-111111111111";
    const session = (hash: string, over: Record<string, unknown> = {}) => ({
      id: SID,
      user_id: "user-123",
      refresh_token_hash: hash,
      token_family: "family-1",
      is_active: true,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 86400000),
      ...over,
    });

    it("should return new tokens when refresh token is valid", async () => {
      const refreshToken = service.composeRefreshToken(SID);
      const hash = await service.hashRefreshToken(refreshToken);

      mockQueryOne
        .mockResolvedValueOnce(session(hash)) // the one session named by the token
        .mockResolvedValueOnce({ id: SID })   // update on rotation
        .mockResolvedValueOnce({ role: "student" });

      const result = await service.refresh(refreshToken);

      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.tokens.refreshToken).not.toBe(refreshToken);
      expect(result.tokens.refreshToken.startsWith(SID + ".")).toBe(true);
      expect(result.sessionId).toBe(SID);
    });

    it("checks only the one session the token names (never scans all sessions)", async () => {
      const refreshToken = service.composeRefreshToken(SID);
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(RefreshDeniedError);
      expect(mockQueryMany).not.toHaveBeenCalled();
    });

    it("should throw RefreshDeniedError for a token that is not in the new format", async () => {
      await expect(service.refresh("invalid-token")).rejects.toThrow(RefreshDeniedError);
      expect(mockQueryOne).not.toHaveBeenCalled();
    });

    it("should throw RefreshDeniedError when the secret part does not match", async () => {
      const real = service.composeRefreshToken(SID);
      const hash = await service.hashRefreshToken(real);
      mockQueryOne.mockResolvedValueOnce(session(hash));

      await expect(service.refresh(service.composeRefreshToken(SID))).rejects.toThrow(RefreshDeniedError);
    });

    it("denies the second of two simultaneous refreshes (the first already rotated the token)", async () => {
      const refreshToken = service.composeRefreshToken(SID);
      const hash = await service.hashRefreshToken(refreshToken);
      mockQueryOne
        .mockResolvedValueOnce(session(hash))
        .mockResolvedValueOnce(null); // conditional UPDATE matched no row: someone else rotated first

      await expect(service.refresh(refreshToken)).rejects.toThrow(RefreshDeniedError);
    });

    it("should throw TokenReuseError when the token of an ended session is replayed", async () => {
      const oldRefreshToken = service.composeRefreshToken(SID);
      const hash = await service.hashRefreshToken(oldRefreshToken);

      mockQueryOne.mockResolvedValueOnce(session(hash, { is_active: false }));
      // invalidateTokenFamily query, then revokeAll query
      mockQueryMany.mockResolvedValue([]);

      await expect(service.refresh(oldRefreshToken)).rejects.toThrow(TokenReuseError);
    });

    it("should update the session with new refresh token hash on rotation", async () => {
      const refreshToken = service.composeRefreshToken(SID);
      const hash = await service.hashRefreshToken(refreshToken);

      mockQueryOne
        .mockResolvedValueOnce(session(hash))
        .mockResolvedValueOnce({ id: SID })
        .mockResolvedValueOnce({ role: "student" });

      await service.refresh(refreshToken);

      // Verify the update query was called with new hash
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE sessions"),
        expect.arrayContaining([expect.any(String), SID, hash]),
      );
    });
  });

  // ─── revoke ───────────────────────────────────────────────────────

  describe("revoke", () => {
    it("should mark session as inactive and clean up Redis", async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: "session-1",
        user_id: "user-123",
      });

      await service.revoke("session-1");

      expect(redisUtils.deleteSessionMetadata).toHaveBeenCalledWith("session-1");
      expect(redisUtils.removeUserSession).toHaveBeenCalledWith("user-123", "session-1");
    });

    it("should do nothing if session is already inactive", async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await service.revoke("nonexistent-session");

      expect(redisUtils.deleteSessionMetadata).not.toHaveBeenCalled();
      expect(redisUtils.removeUserSession).not.toHaveBeenCalled();
    });
  });

  // ─── revokeAll ────────────────────────────────────────────────────

  describe("revokeAll", () => {
    it("should revoke all sessions and clear Redis for user", async () => {
      mockQueryMany.mockResolvedValueOnce([]);

      await service.revokeAll("user-123");

      expect(redisUtils.clearAllUserSessions).toHaveBeenCalledWith("user-123");
    });

    it("should keep the excepted session when exceptSessionId is provided", async () => {
      mockQueryMany.mockResolvedValueOnce([]);

      await service.revokeAll("user-123", "keep-this-session");

      expect(redisUtils.clearUserSessionsExcept).toHaveBeenCalledWith("user-123", "keep-this-session");
    });
  });

  // ─── listActive ───────────────────────────────────────────────────

  describe("listActive", () => {
    it("should return active sessions for a user", async () => {
      const mockSessions = [
        {
          id: "session-1",
          user_id: "user-123",
          token_family: "family-1",
          device_type: "mobile",
          device_info: { browser: "Chrome" },
          ip_address: "192.168.1.1",
          city: "Mumbai",
          is_active: true,
          last_active_at: new Date(),
          created_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
        },
        {
          id: "session-2",
          user_id: "user-123",
          token_family: "family-2",
          device_type: "desktop",
          device_info: { browser: "Firefox" },
          ip_address: "10.0.0.1",
          city: "Delhi",
          is_active: true,
          last_active_at: new Date(),
          created_at: new Date(),
          expires_at: new Date(Date.now() + 86400000),
        },
      ];

      mockQueryMany.mockResolvedValueOnce(mockSessions);

      const result = await service.listActive("user-123");

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("session-1");
      expect(result[1].id).toBe("session-2");
    });

    it("should return empty array when no active sessions exist", async () => {
      mockQueryMany.mockResolvedValueOnce([]);

      const result = await service.listActive("user-123");

      expect(result).toEqual([]);
    });
  });
});
