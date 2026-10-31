/**
 * Zod validation schemas for Test management and attempt operations.
 *
 * - createTestSchema: validates full test creation payload
 * - updateTestSchema: partial version for updates (all fields optional)
 * - saveAnswerSchema: validates answer submission during a test attempt
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { z } from "zod";

/**
 * Valid test category values.
 * Requirements: 1.2, 1.4, 5.3, 5.4
 */
export const VALID_CATEGORIES = ['full_mock', 'subject_wise', 'previous_year', 'daily_practice'] as const;

/** TypeScript type representing valid test categories. */
export type TestCategory = typeof VALID_CATEGORIES[number];

/**
 * Schema for creating a new test.
 * Enforces bilingual title, valid duration/marks, marking config,
 * pricing/status enums, optional schedule dates, and at least one question.
 */
const createTestBaseSchema = z.object({
  titleEn: z.string().min(1).max(200),
  titleHi: z.string().min(1).max(200),
  descriptionEn: z.string().max(1000).optional(),
  descriptionHi: z.string().max(1000).optional(),
  examId: z.string().uuid(),
  durationMinutes: z.number().int().positive(),
  totalMarks: z.number().int().positive(),
  marksPerQuestion: z.number().positive().default(1),
  negativeMarkingRatio: z.number().min(0).max(1).default(0),
  passingMarks: z.number().int().nonnegative(),
  pricingType: z.enum(["free", "premium"]).default("free"),
  status: z.enum(["draft", "published"]).default("draft"),
  availableFrom: z.string().datetime().optional(),
  availableUntil: z.string().datetime().optional(),
  category: z.enum(VALID_CATEGORIES),
  questionIds: z.array(z.string().uuid()).min(1),
  subjectId: z.string().uuid().optional(),
  topicId: z.string().uuid().optional(),
});

export const createTestSchema = createTestBaseSchema.refine(
  (data) => !data.topicId || data.subjectId,
  { message: "subjectId is required when topicId is provided", path: ["subjectId"] }
);

/** Inferred TypeScript type for test creation input. */
export type CreateTestInput = z.infer<typeof createTestSchema>;

/**
 * Schema for updating an existing test.
 * All fields are optional — only provided fields will be updated.
 */
export const updateTestSchema = createTestBaseSchema.partial();

/** Inferred TypeScript type for test update input. */
export type UpdateTestInput = z.infer<typeof updateTestSchema>;

/**
 * Schema for saving an answer during a test attempt.
 * Validates selected option (0-3 or null for clearing) and review flag.
 */
export const saveAnswerSchema = z.object({
  selectedOption: z.number().int().min(0).max(3).nullable(),
  markedForReview: z.boolean().default(false),
});

/** Inferred TypeScript type for save answer input. */
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
