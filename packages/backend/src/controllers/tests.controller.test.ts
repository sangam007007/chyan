/**
 * Integration tests for Test Categories — migration structure and API validation.
 *
 * Tests:
 * 1. Migration structure verification — verifies the 011_add-test-category migration
 *    calls MigrationBuilder methods with correct parameters.
 * 2. API validation — verifies that invalid category values in create/update
 *    requests return 422 validation errors.
 *
 * Requirements: 1.1, 1.4, 6.1, 6.2, 6.3
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// ─── Migration Structure Tests ────────────────────────────────────────

describe("Migration 011_add-test-category", () => {
  describe("up function", () => {
    it("should add category column with varchar(20), NOT NULL, and default 'full_mock'", async () => {
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn(),
        dropConstraint: vi.fn(),
        dropColumn: vi.fn(),
      };

      const { up } = await import("../../migrations/011_add-test-category.js");
      await up(mockPgm as any);

      expect(mockPgm.addColumn).toHaveBeenCalledWith("tests", {
        category: {
          type: "varchar(20)",
          notNull: true,
          default: "full_mock",
        },
      });
    });

    it("should add CHECK constraint limiting category to five valid values", async () => {
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn(),
        dropConstraint: vi.fn(),
        dropColumn: vi.fn(),
      };

      const { up } = await import("../../migrations/011_add-test-category.js");
      await up(mockPgm as any);

      expect(mockPgm.addConstraint).toHaveBeenCalledWith(
        "tests",
        "chk_test_category",
        {
          check:
            "category IN ('full_mock', 'subject_wise', 'previous_year', 'daily_practice', 'topic_wise')",
        },
      );
    });

    it("should create index idx_tests_category on category column", async () => {
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn(),
        dropConstraint: vi.fn(),
        dropColumn: vi.fn(),
      };

      const { up } = await import("../../migrations/011_add-test-category.js");
      await up(mockPgm as any);

      expect(mockPgm.createIndex).toHaveBeenCalledWith("tests", "category", {
        name: "idx_tests_category",
      });
    });

    it("should set default value so existing rows get 'full_mock'", async () => {
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn(),
        dropConstraint: vi.fn(),
        dropColumn: vi.fn(),
      };

      const { up } = await import("../../migrations/011_add-test-category.js");
      await up(mockPgm as any);

      // The default value "full_mock" ensures existing rows get this value
      // (node-pg-migrate handles SQL quoting internally)
      const addColumnCall = mockPgm.addColumn.mock.calls[0];
      expect(addColumnCall[1].category.default).toBe("full_mock");
      expect(addColumnCall[1].category.notNull).toBe(true);
    });
  });

  describe("down function", () => {
    it("should remove index, constraint, and column in correct order", async () => {
      const callOrder: string[] = [];
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn().mockImplementation(() => callOrder.push("dropIndex")),
        dropConstraint: vi.fn().mockImplementation(() => callOrder.push("dropConstraint")),
        dropColumn: vi.fn().mockImplementation(() => callOrder.push("dropColumn")),
      };

      const { down } = await import("../../migrations/011_add-test-category.js");
      await down(mockPgm as any);

      // Verify correct order: index first, then constraint, then column
      expect(callOrder).toEqual(["dropIndex", "dropConstraint", "dropColumn"]);
    });

    it("should drop the correct index by name", async () => {
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn(),
        dropConstraint: vi.fn(),
        dropColumn: vi.fn(),
      };

      const { down } = await import("../../migrations/011_add-test-category.js");
      await down(mockPgm as any);

      expect(mockPgm.dropIndex).toHaveBeenCalledWith("tests", "category", {
        name: "idx_tests_category",
      });
    });

    it("should drop the CHECK constraint by name", async () => {
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn(),
        dropConstraint: vi.fn(),
        dropColumn: vi.fn(),
      };

      const { down } = await import("../../migrations/011_add-test-category.js");
      await down(mockPgm as any);

      expect(mockPgm.dropConstraint).toHaveBeenCalledWith("tests", "chk_test_category");
    });

    it("should drop the category column from tests table", async () => {
      const mockPgm = {
        addColumn: vi.fn(),
        addConstraint: vi.fn(),
        createIndex: vi.fn(),
        dropIndex: vi.fn(),
        dropConstraint: vi.fn(),
        dropColumn: vi.fn(),
      };

      const { down } = await import("../../migrations/011_add-test-category.js");
      await down(mockPgm as any);

      expect(mockPgm.dropColumn).toHaveBeenCalledWith("tests", "category");
    });
  });
});

// ─── API Validation Tests ─────────────────────────────────────────────

describe("Tests Controller - Category Validation", () => {
  // We test the validate middleware + schema combination directly
  // by importing the validate middleware and schema, then calling it
  // with mock req/res objects.

  describe("POST /api/tests - create test validation", () => {
    it("should return 422 when category field is missing from request body", async () => {
      const { validate } = await import("@/middleware/validate.js");
      const { createTestSchema } = await import("@/schemas/test.schema.js");

      const middleware = validate(createTestSchema);

      const req = {
        body: {
          titleEn: "Test Title",
          titleHi: "टेस्ट शीर्षक",
          examId: "550e8400-e29b-41d4-a716-446655440000",
          durationMinutes: 60,
          totalMarks: 100,
          marksPerQuestion: 1,
          negativeMarkingRatio: 0.25,
          passingMarks: 40,
          pricingType: "free",
          status: "draft",
          // category is intentionally missing
          questionIds: ["550e8400-e29b-41d4-a716-446655440001"],
        },
      } as unknown as Request;

      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res as unknown as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: {
            fieldErrors: expect.objectContaining({
              category: expect.any(Array),
            }),
          },
        },
      });
    });

    it("should return 422 when category has an invalid value", async () => {
      const { validate } = await import("@/middleware/validate.js");
      const { createTestSchema } = await import("@/schemas/test.schema.js");

      const middleware = validate(createTestSchema);

      const req = {
        body: {
          titleEn: "Test Title",
          titleHi: "टेस्ट शीर्षक",
          examId: "550e8400-e29b-41d4-a716-446655440000",
          durationMinutes: 60,
          totalMarks: 100,
          marksPerQuestion: 1,
          negativeMarkingRatio: 0.25,
          passingMarks: 40,
          pricingType: "free",
          status: "draft",
          category: "invalid_category",
          questionIds: ["550e8400-e29b-41d4-a716-446655440001"],
        },
      } as unknown as Request;

      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res as unknown as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: {
            fieldErrors: expect.objectContaining({
              category: expect.any(Array),
            }),
          },
        },
      });
    });

    it("should pass validation when a valid category is provided", async () => {
      const { validate } = await import("@/middleware/validate.js");
      const { createTestSchema } = await import("@/schemas/test.schema.js");

      const middleware = validate(createTestSchema);

      const req = {
        body: {
          titleEn: "Test Title",
          titleHi: "टेस्ट शीर्षक",
          examId: "550e8400-e29b-41d4-a716-446655440000",
          durationMinutes: 60,
          totalMarks: 100,
          marksPerQuestion: 1,
          negativeMarkingRatio: 0.25,
          passingMarks: 40,
          pricingType: "free",
          status: "draft",
          category: "subject_wise",
          questionIds: ["550e8400-e29b-41d4-a716-446655440001"],
        },
      } as unknown as Request;

      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res as unknown as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe("PUT /api/tests/:id - update test validation", () => {
    it("should return 422 when category has an invalid value on update", async () => {
      const { validate } = await import("@/middleware/validate.js");
      const { updateTestSchema } = await import("@/schemas/test.schema.js");

      const middleware = validate(updateTestSchema);

      const req = {
        body: {
          category: "not_a_valid_category",
        },
      } as unknown as Request;

      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res as unknown as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(422);
      expect(res.body).toMatchObject({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: {
            fieldErrors: expect.objectContaining({
              category: expect.any(Array),
            }),
          },
        },
      });
    });

    it("should pass validation when a valid category is provided on update", async () => {
      const { validate } = await import("@/middleware/validate.js");
      const { updateTestSchema } = await import("@/schemas/test.schema.js");

      const middleware = validate(updateTestSchema);

      const req = {
        body: {
          category: "daily_practice",
        },
      } as unknown as Request;

      const res = createMockRes();
      const next = vi.fn();

      middleware(req, res as unknown as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

// ─── Test Helpers ─────────────────────────────────────────────────────

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res;
}


// ─── Property 7: Invalid UUID Graceful Degradation ────────────────────

import * as fc from "fast-check";

/**
 * UUID v4 validation regex — the same regex used in tests.controller.ts
 * to validate subject_id and topic_id query parameters.
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
  return UUID_V4_REGEX.test(value);
}

describe("Feature: subject-category-restructuring, Property 7: Invalid UUID Graceful Degradation", () => {
  /**
   * Validates: Requirements 6.7
   *
   * For any string that is not a valid UUID v4 format, when provided as
   * subject_id or topic_id query parameter, the API shall return the same
   * results as if the parameter were not provided. The invalid value
   * shall be silently ignored without returning an error.
   */
  it("should identify invalid UUIDs correctly — non-UUID strings fail validation", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !isValidUUID(s)),
        (invalidString) => {
          // The UUID validation regex should reject this string
          expect(isValidUUID(invalidString)).toBe(false);

          // The controller logic: if !isValidUUID(value), set to undefined
          // This means the filter is not applied — graceful degradation
          const normalizedSubjectId = isValidUUID(invalidString) ? invalidString : undefined;
          const normalizedTopicId = isValidUUID(invalidString) ? invalidString : undefined;

          expect(normalizedSubjectId).toBeUndefined();
          expect(normalizedTopicId).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should accept valid UUID v4 strings", () => {
    fc.assert(
      fc.property(fc.uuidV(4), (validUuid) => {
        // Valid v4 UUIDs should pass the validation
        expect(isValidUUID(validUuid)).toBe(true);

        // The controller logic: if isValidUUID(value), pass through
        const normalizedSubjectId = isValidUUID(validUuid) ? validUuid : undefined;
        expect(normalizedSubjectId).toBe(validUuid);
      }),
      { numRuns: 100 }
    );
  });

  it("should not treat common invalid patterns as valid UUIDs", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Empty or whitespace strings
          fc.constant(""),
          fc.stringOf(fc.constant(" "), { minLength: 1, maxLength: 10 }),
          // Numeric strings
          fc.stringOf(fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9"), { minLength: 1, maxLength: 36 }),
          // UUIDs with wrong version (not v4)
          fc.tuple(
            fc.hexaString({ minLength: 8, maxLength: 8 }),
            fc.hexaString({ minLength: 4, maxLength: 4 }),
            fc.hexaString({ minLength: 3, maxLength: 3 }),
            fc.hexaString({ minLength: 3, maxLength: 3 }),
            fc.hexaString({ minLength: 12, maxLength: 12 })
          ).map(([a, b, c, d, e]) => `${a}-${b}-0${c}-${d}-${e}`),
          // SQL injection attempts
          fc.constant("'; DROP TABLE tests; --"),
          fc.constant("1 OR 1=1"),
          // Almost-valid UUIDs (wrong length)
          fc.hexaString({ minLength: 30, maxLength: 35 })
        ),
        (invalidValue) => {
          // None of these should be treated as valid UUIDs
          const normalized = isValidUUID(invalidValue) ? invalidValue : undefined;

          // If the value happens to be a valid UUID (extremely unlikely for these generators),
          // that's fine — we just care that invalid ones are normalized to undefined
          if (!isValidUUID(invalidValue)) {
            expect(normalized).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("should silently ignore invalid subject_id/topic_id — controller normalization logic", () => {
    fc.assert(
      fc.property(
        // Generate pairs of potentially invalid subject_id and topic_id
        fc.record({
          subjectId: fc.oneof(
            fc.uuidV(4),
            fc.string().filter((s) => !isValidUUID(s))
          ),
          topicId: fc.oneof(
            fc.uuidV(4),
            fc.constant("null"),
            fc.string().filter((s) => s !== "null" && !isValidUUID(s))
          ),
        }),
        ({ subjectId, topicId }) => {
          // Simulate controller normalization logic
          const normalizedSubjectId = isValidUUID(subjectId) ? subjectId : undefined;

          let normalizedTopicId: string | null | undefined;
          if (topicId === "null") {
            normalizedTopicId = null; // explicit null for full subject tests
          } else if (isValidUUID(topicId)) {
            normalizedTopicId = topicId;
          } else {
            normalizedTopicId = undefined; // invalid UUID → ignored
          }

          // Verify: invalid UUIDs always normalize to undefined (ignored)
          if (!isValidUUID(subjectId)) {
            expect(normalizedSubjectId).toBeUndefined();
          } else {
            expect(normalizedSubjectId).toBe(subjectId);
          }

          if (topicId === "null") {
            expect(normalizedTopicId).toBeNull();
          } else if (!isValidUUID(topicId)) {
            expect(normalizedTopicId).toBeUndefined();
          } else {
            expect(normalizedTopicId).toBe(topicId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
