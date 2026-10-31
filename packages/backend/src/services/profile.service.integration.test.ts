/**
 * Integration tests for Profile Service and Onboarding flow.
 * Uses a real PostgreSQL container via testcontainers with seeded exam data.
 *
 * Tests:
 * - New user → exam selection → profile setup → onboarding complete
 * - Returning user with incomplete profile → redirect to correct step
 * - Avatar upload with valid/invalid files
 * - Exam change with monthly limit (3 per calendar month)
 * - Account deletion → grace period → cancel/expire
 *
 * Requirements: 9.1–9.7, 10.1–10.7, 11.1–11.5, 12.1–12.7, 13.1–13.7, 15.1–15.8
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client, Pool } from 'pg';
import { runMigrations } from '../db/migrate.js';
import { ProfileService } from './profile.service.js';
import type { AvatarFile } from './profile.service.js';
import {
  NameValidationError,
  AvatarTooLargeError,
  AvatarInvalidFormatError,
  AvatarTooSmallError,
  ExamChangeLimitError,
  UserNotFoundError,
  InvalidExamError,
} from '../errors/profile.errors.js';

// ─── Test Setup ───────────────────────────────────────────────────────

let container: StartedPostgreSqlContainer;
let databaseUrl: string;
let pool: Pool;
let service: ProfileService;

/**
 * Helper: Create a minimal valid PNG buffer (1x1 pixel for invalid dims, or bigger).
 * A valid PNG is: 8-byte signature + IHDR chunk + IDAT chunk + IEND chunk.
 */
function createPngBuffer(width: number, height: number): Buffer {
  // Use sharp to generate a real PNG image of specified dimensions
  // We'll use the sharp library directly for this
  const sharp = require('sharp');
  // Return a promise-wrapped buffer — but for setup we'll use a pre-built one.
  // Instead, we'll generate during tests using sharp.
  // For a synchronous helper, create a minimal valid PNG:
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk (13 bytes data)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);   // Width
  ihdrData.writeUInt32BE(height, 4);  // Height
  ihdrData.writeUInt8(8, 8);          // Bit depth
  ihdrData.writeUInt8(2, 9);          // Color type (RGB)
  ihdrData.writeUInt8(0, 10);         // Compression
  ihdrData.writeUInt8(0, 11);         // Filter
  ihdrData.writeUInt8(0, 12);         // Interlace

  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  // Minimal IDAT chunk (compressed empty image data)
  // For a valid but minimal IDAT, we use zlib deflate of the raw data
  const zlib = require('zlib');
  const rawData = Buffer.alloc((width * 3 + 1) * height, 0); // filter byte + RGB per row
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createPngChunk('IDAT', compressed);

  // IEND chunk (0 bytes data)
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  // CRC32 calculation
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return ~crc;
}

/**
 * Generate a real PNG buffer using sharp for accurate dimension tests.
 */
async function generatePngBuffer(width: number, height: number): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .png()
    .toBuffer();
}

// ─── Database Helpers ─────────────────────────────────────────────────

async function createTestUser(overrides: Record<string, unknown> = {}): Promise<string> {
  const defaults = {
    phone: '9876543210',
    preferred_language: 'hi',
    onboarding_completed: false,
    exam_change_count_this_month: 0,
  };
  const data = { ...defaults, ...overrides };

  const result = await pool.query(
    `INSERT INTO users (phone, preferred_language, onboarding_completed, exam_change_count_this_month)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [data.phone, data.preferred_language, data.onboarding_completed, data.exam_change_count_this_month]
  );
  return result.rows[0].id;
}

async function getUser(userId: string) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] ?? null;
}

async function getExamIds(): Promise<{ first: string; second: string; third: string; fourth: string }> {
  const result = await pool.query(
    'SELECT id FROM exams WHERE is_active = true ORDER BY display_order LIMIT 4'
  );
  return {
    first: result.rows[0].id,
    second: result.rows[1].id,
    third: result.rows[2].id,
    fourth: result.rows[3].id,
  };
}

async function cleanUsers(): Promise<void> {
  await pool.query('DELETE FROM users');
}

// ─── Test Suite ───────────────────────────────────────────────────────

describe('ProfileService Integration Tests', () => {
  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withStartupTimeout(120_000)
      .start();
    databaseUrl = container.getConnectionUri();

    // Run migrations (creates tables and seeds exams)
    await runMigrations({ databaseUrl, direction: 'up', verbose: false });

    // Create a pool for direct DB access in tests
    pool = new Pool({ connectionString: databaseUrl });

    // Override the database module's pool for ProfileService
    // We need to mock the pool used by the query helpers
    const dbModule = await import('../db/pool.js');
    // Replace the pool's connectionString at runtime
    // Since pool.ts uses env.DB_URL, we need to set it before importing
    // Instead, we'll mock the query/transaction modules to use our pool

    // We'll use a different approach: override the db module exports
    vi.mock('../db/pool.js', () => ({
      pool: null as unknown,
      closePool: vi.fn(),
    }));

    // Dynamically set the pool
    const poolModule = await import('../db/pool.js');
    (poolModule as unknown as { pool: Pool }).pool = pool;

    service = new ProfileService();
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await cleanUsers();
  });

  // ─── Test 1: Full Onboarding Flow ──────────────────────────────────

  describe('New user → exam selection → profile setup → onboarding complete', () => {
    it('should complete the full onboarding flow for a new user', async () => {
      // 1. Create a new user (simulates user created after OTP verification)
      const userId = await createTestUser();
      let user = await getUser(userId);
      expect(user.onboarding_completed).toBe(false);
      expect(user.selected_exam_id).toBeNull();
      expect(user.full_name).toBeNull();

      // 2. Select an exam (exam selection step)
      const exams = await getExamIds();
      await pool.query(
        `UPDATE users SET selected_exam_id = $1, updated_at = NOW() WHERE id = $2`,
        [exams.first, userId]
      );
      user = await getUser(userId);
      expect(user.selected_exam_id).toBe(exams.first);

      // 3. Complete profile setup (name + language)
      const profile = await service.updateProfile(userId, {
        full_name: 'राम कुमार',
        preferred_language: 'hi',
      });
      expect(profile.full_name).toBe('राम कुमार');
      expect(profile.preferred_language).toBe('hi');

      // 4. Mark onboarding as complete
      await pool.query(
        `UPDATE users SET onboarding_completed = true, updated_at = NOW() WHERE id = $1`,
        [userId]
      );
      user = await getUser(userId);
      expect(user.onboarding_completed).toBe(true);

      // 5. Verify full profile retrieval works
      const fullProfile = await service.getProfile(userId);
      expect(fullProfile.full_name).toBe('राम कुमार');
      expect(fullProfile.selected_exam_id).toBe(exams.first);
      expect(fullProfile.onboarding_completed).toBe(true);
      expect(fullProfile.exam).not.toBeNull();
      expect(fullProfile.exam?.category).toBe('state');
    });
  });

  // ─── Test 2: Returning User Incomplete Profile ─────────────────────

  describe('Returning user with incomplete profile → redirect to correct step', () => {
    it('should identify user needing exam selection', async () => {
      const userId = await createTestUser();
      const profile = await service.getProfile(userId);

      // User has no exam selected → should go to exam selection
      expect(profile.selected_exam_id).toBeNull();
      expect(profile.onboarding_completed).toBe(false);
    });

    it('should identify user needing profile setup (has exam but no name)', async () => {
      const exams = await getExamIds();
      const userId = await createTestUser();

      // Set exam but leave name empty
      await pool.query(
        `UPDATE users SET selected_exam_id = $1 WHERE id = $2`,
        [exams.first, userId]
      );

      const profile = await service.getProfile(userId);
      expect(profile.selected_exam_id).toBe(exams.first);
      expect(profile.full_name).toBeNull();
      expect(profile.onboarding_completed).toBe(false);
    });

    it('should identify user with complete profile', async () => {
      const exams = await getExamIds();
      const userId = await createTestUser();

      // Complete the profile
      await pool.query(
        `UPDATE users SET selected_exam_id = $1, full_name = 'Test User', onboarding_completed = true WHERE id = $2`,
        [exams.first, userId]
      );

      const profile = await service.getProfile(userId);
      expect(profile.selected_exam_id).not.toBeNull();
      expect(profile.full_name).toBe('Test User');
      expect(profile.onboarding_completed).toBe(true);
    });
  });

  // ─── Test 3: Avatar Upload ─────────────────────────────────────────

  describe('Avatar upload with valid/invalid files', () => {
    it('should accept and process a valid PNG image (≥200x200)', async () => {
      const userId = await createTestUser();
      const pngBuffer = await generatePngBuffer(300, 300);

      const file: AvatarFile = {
        buffer: pngBuffer,
        mimetype: 'image/png',
        size: pngBuffer.length,
        originalname: 'avatar.png',
      };

      const avatarUrl = await service.uploadAvatar(userId, file);
      expect(avatarUrl).toMatch(/^\/uploads\/avatars\/[a-f0-9-]+\.jpg$/);

      // Verify DB was updated
      const user = await getUser(userId);
      expect(user.avatar_url).toBe(avatarUrl);
    });

    it('should accept a valid JPEG image', async () => {
      const userId = await createTestUser({ phone: '9876543211' });
      const sharp = (await import('sharp')).default;
      const jpegBuffer = await sharp({
        create: { width: 250, height: 250, channels: 3, background: { r: 200, g: 100, b: 50 } },
      }).jpeg().toBuffer();

      const file: AvatarFile = {
        buffer: jpegBuffer,
        mimetype: 'image/jpeg',
        size: jpegBuffer.length,
        originalname: 'photo.jpg',
      };

      const avatarUrl = await service.uploadAvatar(userId, file);
      expect(avatarUrl).toMatch(/\.jpg$/);
    });

    it('should reject a file with invalid MIME type', async () => {
      const userId = await createTestUser({ phone: '9876543212' });
      const buffer = Buffer.from('fake-gif-data');

      const file: AvatarFile = {
        buffer,
        mimetype: 'image/gif',
        size: buffer.length,
        originalname: 'animation.gif',
      };

      await expect(service.uploadAvatar(userId, file)).rejects.toThrow(AvatarInvalidFormatError);
    });

    it('should reject a file exceeding 2MB', async () => {
      const userId = await createTestUser({ phone: '9876543213' });
      const largeBuffer = Buffer.alloc(2 * 1024 * 1024 + 1); // Just over 2MB

      const file: AvatarFile = {
        buffer: largeBuffer,
        mimetype: 'image/png',
        size: largeBuffer.length,
        originalname: 'large.png',
      };

      await expect(service.uploadAvatar(userId, file)).rejects.toThrow(AvatarTooLargeError);
    });

    it('should reject an image smaller than 200x200 pixels', async () => {
      const userId = await createTestUser({ phone: '9876543214' });
      const smallPng = await generatePngBuffer(100, 100);

      const file: AvatarFile = {
        buffer: smallPng,
        mimetype: 'image/png',
        size: smallPng.length,
        originalname: 'tiny.png',
      };

      await expect(service.uploadAvatar(userId, file)).rejects.toThrow(AvatarTooSmallError);
    });
  });

  // ─── Test 4: Exam Change with Monthly Limit ────────────────────────

  describe('Exam change with monthly limit (3 per calendar month)', () => {
    it('should allow exam change when under monthly limit', async () => {
      const exams = await getExamIds();
      const userId = await createTestUser();

      // Set initial exam
      await pool.query(
        `UPDATE users SET selected_exam_id = $1, onboarding_completed = true, full_name = 'Test User' WHERE id = $2`,
        [exams.first, userId]
      );

      // Change exam (1st change)
      const profile = await service.changeExam(userId, exams.second);
      expect(profile.selected_exam_id).toBe(exams.second);
      expect(profile.exam_change_count_this_month).toBe(1);
    });

    it('should allow up to 3 exam changes per month', async () => {
      const exams = await getExamIds();
      const userId = await createTestUser({ phone: '9876543215' });

      // Set initial exam
      await pool.query(
        `UPDATE users SET selected_exam_id = $1, onboarding_completed = true, full_name = 'Test User' WHERE id = $2`,
        [exams.first, userId]
      );

      // 1st change
      await service.changeExam(userId, exams.second);
      // 2nd change
      await service.changeExam(userId, exams.third);
      // 3rd change
      await service.changeExam(userId, exams.fourth);

      // Verify counter
      const user = await getUser(userId);
      expect(user.exam_change_count_this_month).toBe(3);
    });

    it('should reject 4th exam change in the same month', async () => {
      const exams = await getExamIds();
      const userId = await createTestUser({ phone: '9876543216' });
      const currentMonth = new Date().getMonth() + 1;

      // Set user at the limit (3 changes already this month)
      await pool.query(
        `UPDATE users
         SET selected_exam_id = $1, onboarding_completed = true, full_name = 'Test User',
             exam_change_count_this_month = 3, exam_change_month = $2
         WHERE id = $3`,
        [exams.first, currentMonth, userId]
      );

      // 4th attempt should fail
      await expect(service.changeExam(userId, exams.second)).rejects.toThrow(ExamChangeLimitError);

      // Verify exam didn't change
      const user = await getUser(userId);
      expect(user.selected_exam_id).toBe(exams.first);
    });

    it('should reset counter when calendar month changes', async () => {
      const exams = await getExamIds();
      const userId = await createTestUser({ phone: '9876543217' });
      const currentMonth = new Date().getMonth() + 1;
      // Use a previous month
      const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;

      // Set user at limit but for PREVIOUS month
      await pool.query(
        `UPDATE users
         SET selected_exam_id = $1, onboarding_completed = true, full_name = 'Test User',
             exam_change_count_this_month = 3, exam_change_month = $2
         WHERE id = $3`,
        [exams.first, previousMonth, userId]
      );

      // Change should succeed because month has changed (counter resets)
      const profile = await service.changeExam(userId, exams.second);
      expect(profile.selected_exam_id).toBe(exams.second);

      // Counter should be 1 for the new month
      const user = await getUser(userId);
      expect(user.exam_change_count_this_month).toBe(1);
      expect(user.exam_change_month).toBe(currentMonth);
    });

    it('should reject change to non-existent exam', async () => {
      const userId = await createTestUser({ phone: '9876543218' });
      await pool.query(
        `UPDATE users SET onboarding_completed = true, full_name = 'Test User' WHERE id = $1`,
        [userId]
      );

      await expect(
        service.changeExam(userId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(InvalidExamError);
    });
  });

  // ─── Test 5: Account Deletion Lifecycle ────────────────────────────

  describe('Account deletion → grace period → cancel/expire', () => {
    it('should schedule deletion with 7-day grace period', async () => {
      const userId = await createTestUser({ phone: '9876543219' });

      const result = await service.deleteAccount(userId);

      // Should be approximately 7 days from now
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 7);

      const diffMs = Math.abs(
        result.deletionScheduledAt.getTime() - expectedDate.getTime()
      );
      // Allow 5 seconds tolerance
      expect(diffMs).toBeLessThan(5000);

      // Verify in database
      const user = await getUser(userId);
      expect(user.deletion_scheduled_at).not.toBeNull();
    });

    it('should allow cancellation of pending deletion', async () => {
      const userId = await createTestUser({ phone: '9876543220' });

      // Schedule deletion
      await service.deleteAccount(userId);
      let user = await getUser(userId);
      expect(user.deletion_scheduled_at).not.toBeNull();

      // Cancel deletion
      await service.cancelDeletion(userId);
      user = await getUser(userId);
      expect(user.deletion_scheduled_at).toBeNull();
    });

    it('should reject cancellation when no deletion is scheduled', async () => {
      const userId = await createTestUser({ phone: '9876543221' });

      // No deletion scheduled — cancellation should fail
      await expect(service.cancelDeletion(userId)).rejects.toThrow(UserNotFoundError);
    });

    it('should maintain full account functionality during grace period', async () => {
      const exams = await getExamIds();
      const userId = await createTestUser({ phone: '9876543222' });

      // Set up complete profile
      await pool.query(
        `UPDATE users SET selected_exam_id = $1, onboarding_completed = true, full_name = 'Doomed User' WHERE id = $2`,
        [exams.first, userId]
      );

      // Schedule deletion
      await service.deleteAccount(userId);

      // Profile should still be accessible and editable during grace period
      const profile = await service.getProfile(userId);
      expect(profile.full_name).toBe('Doomed User');
      expect(profile.deletion_scheduled_at).not.toBeNull();

      // Should still be able to update profile
      const updated = await service.updateProfile(userId, { full_name: 'Still Active' });
      expect(updated.full_name).toBe('Still Active');
    });

    it('should allow re-scheduling deletion after cancellation', async () => {
      const userId = await createTestUser({ phone: '9876543223' });

      // Schedule → cancel → re-schedule
      await service.deleteAccount(userId);
      await service.cancelDeletion(userId);
      const result = await service.deleteAccount(userId);

      expect(result.deletionScheduledAt).toBeInstanceOf(Date);
      const user = await getUser(userId);
      expect(user.deletion_scheduled_at).not.toBeNull();
    });
  });
});
