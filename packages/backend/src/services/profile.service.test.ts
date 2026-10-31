/**
 * Unit tests for Profile Service.
 * Mocks database and file system utilities to test service logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileService } from "./profile.service.js";
import type { AvatarFile, ProfileUpdateData } from "./profile.service.js";
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

// ─── Mock database utilities ──────────────────────────────────────────

vi.mock("@/db/index.js", () => ({
  queryOne: vi.fn().mockResolvedValue(null),
  queryMany: vi.fn().mockResolvedValue([]),
  withTransaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => {
    return fn({} as unknown);
  }),
}));

// Mock sharp
vi.mock("sharp", () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 400, height: 400 }),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("processed-image")),
  }));
  return { default: mockSharp };
});

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock config env
vi.mock("@/config/env.js", () => ({
  env: {
    UPLOAD_DIR: "./uploads",
    MAX_AVATAR_SIZE_MB: 2,
  },
}));

import * as db from "@/db/index.js";
import sharp from "sharp";
import fs from "node:fs/promises";

// ─── Test Setup ───────────────────────────────────────────────────────

describe("ProfileService", () => {
  let service: ProfileService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProfileService();
  });

  // ─── validateName ─────────────────────────────────────────────────

  describe("validateName", () => {
    it("should accept a valid name", () => {
      expect(() => service.validateName("John Doe")).not.toThrow();
    });

    it("should accept names with hyphens and periods", () => {
      expect(() => service.validateName("Mary-Jane Sr.")).not.toThrow();
    });

    it("should accept names in Hindi (Unicode letters)", () => {
      expect(() => service.validateName("राम कुमार")).not.toThrow();
    });

    it("should accept a 2-character name", () => {
      expect(() => service.validateName("Jo")).not.toThrow();
    });

    it("should accept a 50-character name", () => {
      const name = "A".repeat(50);
      expect(() => service.validateName(name)).not.toThrow();
    });

    it("should reject an empty string", () => {
      expect(() => service.validateName("")).toThrow(NameValidationError);
    });

    it("should reject a whitespace-only string", () => {
      expect(() => service.validateName("   ")).toThrow(NameValidationError);
    });

    it("should reject a name shorter than 2 characters", () => {
      expect(() => service.validateName("A")).toThrow(NameValidationError);
    });

    it("should reject a name longer than 50 characters", () => {
      const name = "A".repeat(51);
      expect(() => service.validateName(name)).toThrow(NameValidationError);
    });

    it("should reject names with numbers", () => {
      expect(() => service.validateName("John123")).toThrow(NameValidationError);
    });

    it("should reject names with special characters", () => {
      expect(() => service.validateName("John@Doe")).toThrow(NameValidationError);
    });

    it("should reject names with underscores", () => {
      expect(() => service.validateName("John_Doe")).toThrow(NameValidationError);
    });
  });

  // ─── validateAvatarFile ───────────────────────────────────────────

  describe("validateAvatarFile", () => {
    const validFile: AvatarFile = {
      buffer: Buffer.from("fake-image"),
      mimetype: "image/jpeg",
      size: 500_000, // 500KB
      originalname: "photo.jpg",
    };

    it("should accept a valid JPEG file under 2MB", () => {
      expect(() => service.validateAvatarFile(validFile)).not.toThrow();
    });

    it("should accept a valid PNG file under 2MB", () => {
      const pngFile = { ...validFile, mimetype: "image/png", originalname: "photo.png" };
      expect(() => service.validateAvatarFile(pngFile)).not.toThrow();
    });

    it("should accept a file exactly at 2MB", () => {
      const maxFile = { ...validFile, size: 2 * 1024 * 1024 };
      expect(() => service.validateAvatarFile(maxFile)).not.toThrow();
    });

    it("should reject a file exceeding 2MB", () => {
      const largeFile = { ...validFile, size: 2 * 1024 * 1024 + 1 };
      expect(() => service.validateAvatarFile(largeFile)).toThrow(AvatarTooLargeError);
    });

    it("should reject a GIF file", () => {
      const gifFile = { ...validFile, mimetype: "image/gif" };
      expect(() => service.validateAvatarFile(gifFile)).toThrow(AvatarInvalidFormatError);
    });

    it("should reject a WebP file", () => {
      const webpFile = { ...validFile, mimetype: "image/webp" };
      expect(() => service.validateAvatarFile(webpFile)).toThrow(AvatarInvalidFormatError);
    });

    it("should reject a non-image file", () => {
      const pdfFile = { ...validFile, mimetype: "application/pdf" };
      expect(() => service.validateAvatarFile(pdfFile)).toThrow(AvatarInvalidFormatError);
    });

    it("should check MIME type before size", () => {
      const invalidFile = { ...validFile, mimetype: "image/gif", size: 3 * 1024 * 1024 };
      try {
        service.validateAvatarFile(invalidFile);
      } catch (err) {
        expect(err).toBeInstanceOf(AvatarInvalidFormatError);
      }
    });
  });

  // ─── validateAvatarDimensions ─────────────────────────────────────

  describe("validateAvatarDimensions", () => {
    it("should accept an image with dimensions ≥200×200", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 400, height: 400 }),
      } as unknown as ReturnType<typeof sharp>);

      const result = await service.validateAvatarDimensions(Buffer.from("img"));
      expect(result).toEqual({ width: 400, height: 400 });
    });

    it("should accept exactly 200×200", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 200, height: 200 }),
      } as unknown as ReturnType<typeof sharp>);

      const result = await service.validateAvatarDimensions(Buffer.from("img"));
      expect(result).toEqual({ width: 200, height: 200 });
    });

    it("should reject an image smaller than 200×200 (both)", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
      } as unknown as ReturnType<typeof sharp>);

      await expect(
        service.validateAvatarDimensions(Buffer.from("img"))
      ).rejects.toThrow(AvatarTooSmallError);
    });

    it("should reject if width is below 200", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 150, height: 300 }),
      } as unknown as ReturnType<typeof sharp>);

      await expect(
        service.validateAvatarDimensions(Buffer.from("img"))
      ).rejects.toThrow(AvatarTooSmallError);
    });

    it("should reject if height is below 200", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 300, height: 150 }),
      } as unknown as ReturnType<typeof sharp>);

      await expect(
        service.validateAvatarDimensions(Buffer.from("img"))
      ).rejects.toThrow(AvatarTooSmallError);
    });
  });

  // ─── getProfile ───────────────────────────────────────────────────

  describe("getProfile", () => {
    it("should return user profile with exam info", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({
        id: "user-1",
        phone: "9876543210",
        email: "test@example.com",
        full_name: "John Doe",
        avatar_url: "/uploads/avatars/test.jpg",
        preferred_language: "en",
        selected_exam_id: "exam-1",
        google_id: null,
        google_avatar_url: null,
        onboarding_completed: true,
        exam_change_count_this_month: 1,
        exam_change_month: 6,
        deletion_scheduled_at: null,
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-06-01"),
        exam_id: "exam-1",
        exam_name_en: "UP Police Constable",
        exam_name_hi: "यूपी पुलिस कांस्टेबल",
        exam_description_en: "UP Police Constable Recruitment Exam",
        exam_description_hi: "यूपी पुलिस कांस्टेबल भर्ती परीक्षा",
        exam_category: "state",
        exam_icon_url: "/icons/up-constable.svg",
      });

      const profile = await service.getProfile("user-1");

      expect(profile.id).toBe("user-1");
      expect(profile.full_name).toBe("John Doe");
      expect(profile.exam).not.toBeNull();
      expect(profile.exam?.name_en).toBe("UP Police Constable");
    });

    it("should return profile with null exam when no exam selected", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({
        id: "user-2",
        phone: "9876543211",
        email: null,
        full_name: "Jane",
        avatar_url: null,
        preferred_language: "hi",
        selected_exam_id: null,
        google_id: null,
        google_avatar_url: null,
        onboarding_completed: false,
        exam_change_count_this_month: 0,
        exam_change_month: null,
        deletion_scheduled_at: null,
        created_at: new Date("2024-01-01"),
        updated_at: new Date("2024-01-01"),
        exam_id: null,
        exam_name_en: null,
        exam_name_hi: null,
        exam_description_en: null,
        exam_description_hi: null,
        exam_category: null,
        exam_icon_url: null,
      });

      const profile = await service.getProfile("user-2");

      expect(profile.exam).toBeNull();
    });

    it("should throw UserNotFoundError when user doesn't exist", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      await expect(service.getProfile("non-existent")).rejects.toThrow(
        UserNotFoundError
      );
    });
  });

  // ─── updateProfile ────────────────────────────────────────────────

  describe("updateProfile", () => {
    it("should validate and update name", async () => {
      // First call: UPDATE, second call: getProfile SELECT
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: "user-1" }) // UPDATE returns
        .mockResolvedValueOnce({
          id: "user-1",
          phone: "9876543210",
          email: null,
          full_name: "New Name",
          avatar_url: null,
          preferred_language: "en",
          selected_exam_id: null,
          google_id: null,
          google_avatar_url: null,
          onboarding_completed: false,
          exam_change_count_this_month: 0,
          exam_change_month: null,
          deletion_scheduled_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          exam_id: null,
          exam_name_en: null,
          exam_name_hi: null,
          exam_description_en: null,
          exam_description_hi: null,
          exam_category: null,
          exam_icon_url: null,
        });

      const result = await service.updateProfile("user-1", { full_name: "New Name" });

      expect(result.full_name).toBe("New Name");
      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE users SET"),
        expect.arrayContaining(["New Name", "user-1"])
      );
    });

    it("should validate and update language", async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: "user-1" })
        .mockResolvedValueOnce({
          id: "user-1",
          phone: "9876543210",
          email: null,
          full_name: "Test",
          avatar_url: null,
          preferred_language: "hi",
          selected_exam_id: null,
          google_id: null,
          google_avatar_url: null,
          onboarding_completed: false,
          exam_change_count_this_month: 0,
          exam_change_month: null,
          deletion_scheduled_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          exam_id: null,
          exam_name_en: null,
          exam_name_hi: null,
          exam_description_en: null,
          exam_description_hi: null,
          exam_category: null,
          exam_icon_url: null,
        });

      const result = await service.updateProfile("user-1", { preferred_language: "hi" });
      expect(result.preferred_language).toBe("hi");
    });

    it("should throw NameValidationError for invalid name", async () => {
      await expect(
        service.updateProfile("user-1", { full_name: "A" })
      ).rejects.toThrow(NameValidationError);
    });

    it("should throw InvalidLanguageError for invalid language", async () => {
      await expect(
        service.updateProfile("user-1", { preferred_language: "fr" })
      ).rejects.toThrow(InvalidLanguageError);
    });

    it("should throw UserNotFoundError if user doesn't exist", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      await expect(
        service.updateProfile("non-existent", { full_name: "Valid Name" })
      ).rejects.toThrow(UserNotFoundError);
    });

    it("should return current profile when no data provided", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({
        id: "user-1",
        phone: "9876543210",
        email: null,
        full_name: "Current Name",
        avatar_url: null,
        preferred_language: "en",
        selected_exam_id: null,
        google_id: null,
        google_avatar_url: null,
        onboarding_completed: false,
        exam_change_count_this_month: 0,
        exam_change_month: null,
        deletion_scheduled_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        exam_id: null,
        exam_name_en: null,
        exam_name_hi: null,
        exam_description_en: null,
        exam_description_hi: null,
        exam_category: null,
        exam_icon_url: null,
      });

      const result = await service.updateProfile("user-1", {});
      expect(result.full_name).toBe("Current Name");
    });
  });

  // ─── uploadAvatar ─────────────────────────────────────────────────

  describe("uploadAvatar", () => {
    const validFile: AvatarFile = {
      buffer: Buffer.from("fake-image-data"),
      mimetype: "image/jpeg",
      size: 500_000,
      originalname: "photo.jpg",
    };

    it("should process and store a valid avatar", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 400, height: 400 }),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from("processed")),
      } as unknown as ReturnType<typeof sharp>);
      vi.mocked(db.queryOne).mockResolvedValueOnce({ id: "user-1" });

      const url = await service.uploadAvatar("user-1", validFile);

      expect(url).toMatch(/^\/uploads\/avatars\/[a-f0-9-]+\.jpg$/);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("should throw AvatarInvalidFormatError for unsupported MIME type", async () => {
      const gifFile = { ...validFile, mimetype: "image/gif" };

      await expect(
        service.uploadAvatar("user-1", gifFile)
      ).rejects.toThrow(AvatarInvalidFormatError);
    });

    it("should throw AvatarTooLargeError for oversized file", async () => {
      const largeFile = { ...validFile, size: 3 * 1024 * 1024 };

      await expect(
        service.uploadAvatar("user-1", largeFile)
      ).rejects.toThrow(AvatarTooLargeError);
    });

    it("should throw AvatarTooSmallError for small dimensions", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
      } as unknown as ReturnType<typeof sharp>);

      await expect(
        service.uploadAvatar("user-1", validFile)
      ).rejects.toThrow(AvatarTooSmallError);
    });

    it("should throw UserNotFoundError when user doesn't exist", async () => {
      vi.mocked(sharp).mockReturnValue({
        metadata: vi.fn().mockResolvedValue({ width: 400, height: 400 }),
        resize: vi.fn().mockReturnThis(),
        jpeg: vi.fn().mockReturnThis(),
        toBuffer: vi.fn().mockResolvedValue(Buffer.from("processed")),
      } as unknown as ReturnType<typeof sharp>);
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      await expect(
        service.uploadAvatar("non-existent", validFile)
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  // ─── deleteAvatar ─────────────────────────────────────────────────

  describe("deleteAvatar", () => {
    it("should remove file and clear avatar_url", async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ avatar_url: "/uploads/avatars/old.jpg" }) // SELECT
        .mockResolvedValueOnce({ id: "user-1" }); // UPDATE

      await service.deleteAvatar("user-1");

      expect(fs.unlink).toHaveBeenCalled();
      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("avatar_url = NULL"),
        expect.arrayContaining(["user-1"])
      );
    });

    it("should handle case when no avatar exists", async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ avatar_url: null }) // SELECT
        .mockResolvedValueOnce({ id: "user-1" }); // UPDATE

      await service.deleteAvatar("user-1");

      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it("should throw UserNotFoundError when user doesn't exist", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      await expect(service.deleteAvatar("non-existent")).rejects.toThrow(
        UserNotFoundError
      );
    });
  });

  // ─── changeExam ───────────────────────────────────────────────────

  describe("changeExam", () => {
    it("should change exam when under monthly limit", async () => {
      const currentMonth = new Date().getMonth() + 1;
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: "exam-2" }) // exam exists
        .mockResolvedValueOnce({
          id: "user-1",
          selected_exam_id: "exam-1",
          exam_change_count_this_month: 1,
          exam_change_month: currentMonth,
        }) // user data
        .mockResolvedValueOnce({ id: "user-1" }) // UPDATE
        .mockResolvedValueOnce({
          id: "user-1",
          phone: "9876543210",
          email: null,
          full_name: "Test",
          avatar_url: null,
          preferred_language: "en",
          selected_exam_id: "exam-2",
          google_id: null,
          google_avatar_url: null,
          onboarding_completed: true,
          exam_change_count_this_month: 2,
          exam_change_month: currentMonth,
          deletion_scheduled_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          exam_id: "exam-2",
          exam_name_en: "SSC GD",
          exam_name_hi: "एसएससी जीडी",
          exam_description_en: null,
          exam_description_hi: null,
          exam_category: "central",
          exam_icon_url: null,
        }); // getProfile

      const result = await service.changeExam("user-1", "exam-2");
      expect(result.selected_exam_id).toBe("exam-2");
    });

    it("should reset counter when month has changed", async () => {
      const previousMonth = new Date().getMonth(); // 0-based, so this is "previous month" value (1-based would be current-1)
      // Use a month number that is definitely not the current month
      const differentMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth();

      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: "exam-2" }) // exam exists
        .mockResolvedValueOnce({
          id: "user-1",
          selected_exam_id: "exam-1",
          exam_change_count_this_month: 3,
          exam_change_month: differentMonth, // different from current month
        }) // user data
        .mockResolvedValueOnce({ id: "user-1" }) // UPDATE
        .mockResolvedValueOnce({
          id: "user-1",
          phone: "9876543210",
          email: null,
          full_name: "Test",
          avatar_url: null,
          preferred_language: "en",
          selected_exam_id: "exam-2",
          google_id: null,
          google_avatar_url: null,
          onboarding_completed: true,
          exam_change_count_this_month: 1,
          exam_change_month: new Date().getMonth() + 1,
          deletion_scheduled_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          exam_id: "exam-2",
          exam_name_en: "SSC GD",
          exam_name_hi: "एसएससी जीडी",
          exam_description_en: null,
          exam_description_hi: null,
          exam_category: "central",
          exam_icon_url: null,
        }); // getProfile

      const result = await service.changeExam("user-1", "exam-2");
      expect(result.selected_exam_id).toBe("exam-2");
    });

    it("should throw ExamChangeLimitError when at monthly limit", async () => {
      const currentMonth = new Date().getMonth() + 1;
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: "exam-2" }) // exam exists
        .mockResolvedValueOnce({
          id: "user-1",
          selected_exam_id: "exam-1",
          exam_change_count_this_month: 3,
          exam_change_month: currentMonth,
        }); // user data — at limit

      await expect(
        service.changeExam("user-1", "exam-2")
      ).rejects.toThrow(ExamChangeLimitError);
    });

    it("should throw InvalidExamError when exam doesn't exist", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null); // exam not found

      await expect(
        service.changeExam("user-1", "non-existent-exam")
      ).rejects.toThrow(InvalidExamError);
    });

    it("should throw UserNotFoundError when user doesn't exist", async () => {
      vi.mocked(db.queryOne)
        .mockResolvedValueOnce({ id: "exam-2" }) // exam exists
        .mockResolvedValueOnce(null); // user not found

      await expect(
        service.changeExam("non-existent", "exam-2")
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  // ─── deleteAccount ────────────────────────────────────────────────

  describe("deleteAccount", () => {
    it("should schedule deletion 7 days from now", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      vi.mocked(db.queryOne).mockResolvedValueOnce({
        deletion_scheduled_at: futureDate,
      });

      const result = await service.deleteAccount("user-1", "session-1");

      expect(result.deletionScheduledAt).toBeInstanceOf(Date);
      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("deletion_scheduled_at"),
        expect.arrayContaining(["user-1"])
      );
    });

    it("should throw UserNotFoundError when user doesn't exist", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      await expect(
        service.deleteAccount("non-existent")
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  // ─── cancelDeletion ───────────────────────────────────────────────

  describe("cancelDeletion", () => {
    it("should clear deletion_scheduled_at", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce({ id: "user-1" });

      await service.cancelDeletion("user-1");

      expect(db.queryOne).toHaveBeenCalledWith(
        expect.stringContaining("deletion_scheduled_at = NULL"),
        expect.arrayContaining(["user-1"])
      );
    });

    it("should throw UserNotFoundError when user doesn't exist or no pending deletion", async () => {
      vi.mocked(db.queryOne).mockResolvedValueOnce(null);

      await expect(service.cancelDeletion("non-existent")).rejects.toThrow(
        UserNotFoundError
      );
    });
  });
});
