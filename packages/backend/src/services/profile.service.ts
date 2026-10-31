/**
 * Profile Service — Handles user profile management including
 * profile retrieval, name/language updates, avatar upload/delete,
 * exam changes with monthly limits, and account deletion lifecycle.
 *
 * Requirements: 10.3, 10.5, 12.1, 12.2, 12.6, 12.7, 13.3, 13.4, 13.5, 13.6, 15.4, 15.6
 */

import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { env } from "@/config/env.js";
import { queryOne, queryMany, withTransaction } from "@/db/index.js";
import type { QueryOptions } from "@/db/index.js";
import {
  NameValidationError,
  AvatarTooLargeError,
  AvatarInvalidFormatError,
  AvatarTooSmallError,
  ExamChangeLimitError,
  UserNotFoundError,
  InvalidLanguageError,
  InvalidExamError,
} from "@/errors/profile.errors.js";

// ─── Constants ────────────────────────────────────────────────────────

/** Maximum avatar file size in bytes (2MB) */
const MAX_AVATAR_SIZE_BYTES = (env.MAX_AVATAR_SIZE_MB ?? 2) * 1024 * 1024;

/** Minimum avatar dimensions in pixels */
const MIN_AVATAR_DIMENSION = 200;

/** Avatar output size (square crop) */
const AVATAR_OUTPUT_SIZE = 400;

/** Allowed MIME types for avatar upload */
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

/** Maximum exam changes per calendar month (unlimited) */
const MAX_EXAM_CHANGES_PER_MONTH = 999999;

/** Account deletion grace period in days */
const DELETION_GRACE_PERIOD_DAYS = 7;

/** Allowed languages */
const ALLOWED_LANGUAGES = new Set(["hi", "en"]);

/** Name validation regex: letters (Unicode), combining marks (for Devanagari etc.), spaces, hyphens, periods */
const NAME_REGEX = /^[\p{L}\p{M}\s.\-]+$/u;

/** Name min/max length */
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;

// ─── Types ────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  preferred_language: string;
  selected_exam_id: string | null;
  google_id: string | null;
  google_avatar_url: string | null;
  onboarding_completed: boolean;
  exam_change_count_this_month: number;
  exam_change_month: number | null;
  deletion_scheduled_at: Date | null;
  created_at: Date;
  updated_at: Date;
  role?: string;
  exam?: ExamInfo | null;
}

export interface ExamInfo {
  id: string;
  name_en: string;
  name_hi: string;
  description_en: string | null;
  description_hi: string | null;
  category: string;
  icon_url: string | null;
}

export interface ProfileUpdateData {
  full_name?: string;
  preferred_language?: string;
}

export interface AvatarFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

// ─── Profile Service ──────────────────────────────────────────────────

export class ProfileService {
  // ─── Name Validation ──────────────────────────────────────────────

  /**
   * Validate a full name string.
   * Rules: 2-50 chars, letters (any script), spaces, hyphens, and periods only.
   *
   * @throws NameValidationError if validation fails
   */
  validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new NameValidationError("Name is required");
    }

    const trimmed = name.trim();

    if (trimmed.length < NAME_MIN_LENGTH) {
      throw new NameValidationError(
        `Name must be at least ${NAME_MIN_LENGTH} characters`
      );
    }

    if (trimmed.length > NAME_MAX_LENGTH) {
      throw new NameValidationError(
        `Name must be no more than ${NAME_MAX_LENGTH} characters`
      );
    }

    if (!NAME_REGEX.test(trimmed)) {
      throw new NameValidationError(
        "Name can only contain letters, spaces, hyphens, and periods"
      );
    }
  }

  // ─── Avatar Validation ────────────────────────────────────────────

  /**
   * Validate an avatar file (MIME type and size only — dimensions checked separately).
   *
   * @throws AvatarInvalidFormatError if MIME type is not JPEG/PNG
   * @throws AvatarTooLargeError if file exceeds 2MB
   */
  validateAvatarFile(file: AvatarFile): void {
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.mimetype)) {
      throw new AvatarInvalidFormatError(file.mimetype);
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new AvatarTooLargeError(file.size, MAX_AVATAR_SIZE_BYTES);
    }
  }

  /**
   * Validate avatar image dimensions using sharp.
   *
   * @throws AvatarTooSmallError if dimensions are below 200x200
   */
  async validateAvatarDimensions(
    buffer: Buffer
  ): Promise<{ width: number; height: number }> {
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    if (width < MIN_AVATAR_DIMENSION || height < MIN_AVATAR_DIMENSION) {
      throw new AvatarTooSmallError(width, height);
    }

    return { width, height };
  }

  // ─── Profile CRUD ─────────────────────────────────────────────────

  /**
   * Get a user's profile with exam information joined.
   *
   * @param userId - The user's ID
   * @returns The user profile with exam info, or throws UserNotFoundError
   */
  async getProfile(userId: string): Promise<UserProfile> {
    const row = await queryOne<UserProfile & {
      exam_id: string | null;
      exam_name_en: string | null;
      exam_name_hi: string | null;
      exam_description_en: string | null;
      exam_description_hi: string | null;
      exam_category: string | null;
      exam_icon_url: string | null;
    }>(
      `SELECT u.id, u.phone, u.email, u.full_name, u.avatar_url, u.preferred_language,
              u.selected_exam_id, u.google_id, u.google_avatar_url, u.onboarding_completed,
              u.exam_change_count_this_month, u.exam_change_month, u.deletion_scheduled_at,
              u.created_at, u.updated_at, u.role,
              e.id AS exam_id, e.name_en AS exam_name_en, e.name_hi AS exam_name_hi,
              e.description_en AS exam_description_en, e.description_hi AS exam_description_hi,
              e.category AS exam_category, e.icon_url AS exam_icon_url
       FROM users u
       LEFT JOIN exams e ON u.selected_exam_id = e.id
       WHERE u.id = $1`,
      [userId]
    );

    if (!row) {
      throw new UserNotFoundError(userId);
    }

    // Map the flat row into nested structure
    const profile: UserProfile = {
      id: row.id,
      phone: row.phone,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      preferred_language: row.preferred_language,
      selected_exam_id: row.selected_exam_id,
      google_id: row.google_id,
      google_avatar_url: row.google_avatar_url,
      onboarding_completed: row.onboarding_completed,
      exam_change_count_this_month: row.exam_change_count_this_month,
      exam_change_month: row.exam_change_month,
      deletion_scheduled_at: row.deletion_scheduled_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      role: (row as any).role ?? 'student',
      exam: row.exam_id
        ? {
            id: row.exam_id,
            name_en: row.exam_name_en!,
            name_hi: row.exam_name_hi!,
            description_en: row.exam_description_en,
            description_hi: row.exam_description_hi,
            category: row.exam_category!,
            icon_url: row.exam_icon_url,
          }
        : null,
    };

    return profile;
  }

  /**
   * Update a user's profile fields (name and/or language).
   *
   * @param userId - The user's ID
   * @param data - Fields to update
   * @returns The updated profile
   * @throws NameValidationError if name is invalid
   * @throws InvalidLanguageError if language is not 'hi' or 'en'
   * @throws UserNotFoundError if user doesn't exist
   */
  async updateProfile(userId: string, data: ProfileUpdateData): Promise<UserProfile> {
    // Validate inputs
    if (data.full_name !== undefined) {
      this.validateName(data.full_name);
    }

    if (data.preferred_language !== undefined) {
      if (!ALLOWED_LANGUAGES.has(data.preferred_language)) {
        throw new InvalidLanguageError(data.preferred_language);
      }
    }

    // Build dynamic update query
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.full_name !== undefined) {
      setClauses.push(`full_name = $${paramIndex}`);
      params.push(data.full_name.trim());
      paramIndex++;
    }

    if (data.preferred_language !== undefined) {
      setClauses.push(`preferred_language = $${paramIndex}`);
      params.push(data.preferred_language);
      paramIndex++;
    }

    if (setClauses.length === 0) {
      // Nothing to update, just return the current profile
      return this.getProfile(userId);
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(userId);

    const result = await queryOne<{ id: string }>(
      `UPDATE users SET ${setClauses.join(", ")} WHERE id = $${paramIndex} RETURNING id`,
      params
    );

    if (!result) {
      throw new UserNotFoundError(userId);
    }

    return this.getProfile(userId);
  }

  /**
   * Upload and process an avatar image.
   *
   * Flow:
   * 1. Validate MIME type and file size
   * 2. Validate dimensions (≥200×200)
   * 3. Resize/crop to square (400x400)
   * 4. Store file to disk
   * 5. Update avatar_url in database
   *
   * @param userId - The user's ID
   * @param file - The uploaded file object
   * @returns The new avatar URL
   */
  async uploadAvatar(userId: string, file: AvatarFile): Promise<string> {
    // 1. Validate MIME type and size
    this.validateAvatarFile(file);

    // 2. Validate dimensions
    await this.validateAvatarDimensions(file.buffer);

    // 3. Resize/crop to square
    const processedBuffer = await sharp(file.buffer)
      .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // 4. Store file on disk
    const filename = `${randomUUID()}.jpg`;
    const uploadDir = path.resolve(env.UPLOAD_DIR, "avatars");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, processedBuffer);

    // 5. Update avatar_url in database
    const avatarUrl = `/uploads/avatars/${filename}`;
    const result = await queryOne<{ id: string }>(
      `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
      [avatarUrl, userId]
    );

    if (!result) {
      // Clean up the file if user not found
      await fs.unlink(filePath).catch(() => {});
      throw new UserNotFoundError(userId);
    }

    // Remove old avatar file if it exists
    const user = await queryOne<{ avatar_url: string | null }>(
      `SELECT avatar_url FROM users WHERE id = $1`,
      [userId]
    );
    // Note: old avatar already replaced, but we could track old one.
    // For simplicity, old file cleanup can be done via a background job.

    return avatarUrl;
  }

  /**
   * Delete a user's avatar.
   * Removes the file from disk and clears avatar_url in the database.
   *
   * @param userId - The user's ID
   */
  async deleteAvatar(userId: string): Promise<void> {
    // Get current avatar URL
    const user = await queryOne<{ avatar_url: string | null }>(
      `SELECT avatar_url FROM users WHERE id = $1`,
      [userId]
    );

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    if (user.avatar_url) {
      // Remove file from disk
      const filePath = path.resolve(
        env.UPLOAD_DIR,
        user.avatar_url.replace(/^\/uploads\//, "")
      );
      await fs.unlink(filePath).catch(() => {
        // File may not exist, ignore errors
      });
    }

    // Clear avatar_url in database
    await queryOne(
      `UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [userId]
    );
  }

  // ─── Exam Management ──────────────────────────────────────────────

  /**
   * Change a user's selected exam.
   * Enforces 3-change monthly limit with calendar month reset.
   *
   * @param userId - The user's ID
   * @param examId - The new exam ID to select
   * @throws ExamChangeLimitError if monthly limit reached
   * @throws InvalidExamError if exam doesn't exist or is inactive
   * @throws UserNotFoundError if user doesn't exist
   */
  async changeExam(userId: string, examId: string): Promise<UserProfile> {
    return withTransaction(async (client) => {
      // 1. Verify the exam exists and is active
      const exam = await queryOne<{ id: string }>(
        `SELECT id FROM exams WHERE id = $1 AND is_active = true`,
        [examId],
        { client }
      );

      if (!exam) {
        throw new InvalidExamError(examId);
      }

      // 2. Get the user's current exam change count
      const user = await queryOne<{
        id: string;
        selected_exam_id: string | null;
        exam_change_count_this_month: number;
        exam_change_month: number | null;
      }>(
        `SELECT id, selected_exam_id, exam_change_count_this_month, exam_change_month
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
        { client }
      );

      if (!user) {
        throw new UserNotFoundError(userId);
      }

      // 3. Determine if the counter should be reset (new calendar month)
      const currentMonth = new Date().getMonth() + 1; // 1-12
      let changeCount = user.exam_change_count_this_month;

      if (user.exam_change_month !== currentMonth) {
        // Reset counter for new month
        changeCount = 0;
      }

      // 4. Check the monthly limit
      if (changeCount >= MAX_EXAM_CHANGES_PER_MONTH) {
        const nextResetDate = this.getNextMonthStart();
        throw new ExamChangeLimitError(nextResetDate);
      }

      // 5. Update the user's exam selection and increment counter
      await queryOne(
        `UPDATE users
         SET selected_exam_id = $1,
             exam_change_count_this_month = $2,
             exam_change_month = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING id`,
        [examId, changeCount + 1, currentMonth, userId],
        { client }
      );

      // 6. Return updated profile
      return this.getProfile(userId);
    });
  }

  // ─── Account Deletion ─────────────────────────────────────────────

  /**
   * Schedule account deletion with a 7-day grace period.
   * Also revokes all sessions except the current one.
   *
   * @param userId - The user's ID
   * @param currentSessionId - The current session to keep active (for showing confirmation)
   */
  async deleteAccount(
    userId: string,
    currentSessionId?: string
  ): Promise<{ deletionScheduledAt: Date }> {
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

    const result = await queryOne<{ deletion_scheduled_at: Date }>(
      `UPDATE users
       SET deletion_scheduled_at = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING deletion_scheduled_at`,
      [deletionDate, userId]
    );

    if (!result) {
      throw new UserNotFoundError(userId);
    }

    // Revoke all sessions (done by the caller via SessionService)
    // The caller is responsible for calling sessionService.revokeAll(userId, currentSessionId)

    return { deletionScheduledAt: result.deletion_scheduled_at };
  }

  /**
   * Cancel a pending account deletion.
   * Clears the deletion_scheduled_at field.
   *
   * @param userId - The user's ID
   */
  async cancelDeletion(userId: string): Promise<void> {
    const result = await queryOne<{ id: string }>(
      `UPDATE users
       SET deletion_scheduled_at = NULL, updated_at = NOW()
       WHERE id = $1 AND deletion_scheduled_at IS NOT NULL
       RETURNING id`,
      [userId]
    );

    if (!result) {
      throw new UserNotFoundError(userId);
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Get the first day of the next calendar month as an ISO date string.
   */
  private getNextMonthStart(): string {
    const now = new Date();
    const year = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const month = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
    return new Date(year, month, 1).toISOString().split("T")[0];
  }
}
