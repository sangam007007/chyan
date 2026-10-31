/**
 * Zod validation schemas for Question Bank operations.
 *
 * - createQuestionSchema: validates full question creation payload
 * - updateQuestionSchema: partial version for updates (all fields optional)
 *
 * Requirements: 1.1, 1.2, 1.5
 */

import { z } from "zod";

/**
 * Schema for creating a new question in the question bank.
 * Enforces bilingual content, exactly 4 options, valid correctOption range,
 * subject/difficulty enums, and at least one exam association.
 */
export const createQuestionSchema = z.object({
  textEn: z.string().min(1).max(2000),
  textHi: z.string().min(1).max(2000),
  options: z
    .array(
      z.object({
        en: z.string().min(1).max(500),
        hi: z.string().min(1).max(500),
      })
    )
    .length(4),
  correctOption: z.number().int().min(0).max(3),
  explanationEn: z.string().max(2000).optional().nullable(),
  explanationHi: z.string().max(2000).optional().nullable(),
  subject: z.enum(["gk", "math", "reasoning", "hindi"]),
  topic: z.string().max(100).optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  imageUrl: z.string().url().optional().nullable(),
  examIds: z.array(z.string().uuid()).min(1),
});

/** Inferred TypeScript type for question creation input. */
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

/**
 * Schema for updating an existing question.
 * All fields are optional — only provided fields will be updated.
 */
export const updateQuestionSchema = createQuestionSchema.partial();

/** Inferred TypeScript type for question update input. */
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
