/**
 * Property-based tests for question validation schema.
 *
 * **Validates: Requirements 1.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createQuestionSchema } from './question.schema';

/**
 * Generates valid base fields that satisfy all non-option/correctOption constraints.
 * This isolates the test to focus solely on the options length and correctOption range.
 */
function validBaseFieldsArb() {
  return fc.record({
    textEn: fc.string({ minLength: 1, maxLength: 200 }),
    textHi: fc.string({ minLength: 1, maxLength: 200 }),
    explanationEn: fc.constant(undefined),
    explanationHi: fc.constant(undefined),
    subject: fc.constantFrom('gk', 'math', 'reasoning', 'hindi') as fc.Arbitrary<
      'gk' | 'math' | 'reasoning' | 'hindi'
    >,
    topic: fc.constant(undefined),
    difficulty: fc.constantFrom('easy', 'medium', 'hard') as fc.Arbitrary<
      'easy' | 'medium' | 'hard'
    >,
    imageUrl: fc.constant(undefined),
    examIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
  });
}

/**
 * Generates a single bilingual option object.
 */
function optionArb() {
  return fc.record({
    en: fc.string({ minLength: 1, maxLength: 100 }),
    hi: fc.string({ minLength: 1, maxLength: 100 }),
  });
}

describe('Question Validation - Property Tests', () => {
  /**
   * Property 7: Question validation invariant
   *
   * WHEN options array has exactly 4 items AND correctOption is 0-3,
   * validation SHALL succeed (given valid other fields).
   *
   * WHEN options array has != 4 items OR correctOption is outside 0-3,
   * validation SHALL fail.
   *
   * **Validates: Requirements 1.5**
   */
  it('accepts only 4 options with correctOption 0-3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: -1, max: 5 }),
        validBaseFieldsArb(),
        (optionCount, correctOption, baseFields) => {
          // Generate an options array of the given length
          const options = Array.from({ length: optionCount }, (_, i) => ({
            en: `Option ${i + 1} EN`,
            hi: `Option ${i + 1} HI`,
          }));

          const input = {
            ...baseFields,
            options,
            correctOption,
          };

          const result = createQuestionSchema.safeParse(input);

          const isValidOptionCount = optionCount === 4;
          const isValidCorrectOption = correctOption >= 0 && correctOption <= 3;

          if (isValidOptionCount && isValidCorrectOption) {
            // Should succeed when both constraints are met
            expect(result.success).toBe(true);
          } else {
            // Should fail when either constraint is violated
            expect(result.success).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects options arrays with fewer or more than 4 items', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }).filter((n) => n !== 4),
        validBaseFieldsArb(),
        (optionCount, baseFields) => {
          const options = Array.from({ length: optionCount }, (_, i) => ({
            en: `Option ${i + 1} EN`,
            hi: `Option ${i + 1} HI`,
          }));

          const input = {
            ...baseFields,
            options,
            correctOption: 0, // valid correctOption to isolate options count
          };

          const result = createQuestionSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects correctOption values outside 0-3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1, max: 5 }).filter((n) => n < 0 || n > 3),
        validBaseFieldsArb(),
        (correctOption, baseFields) => {
          const options = Array.from({ length: 4 }, (_, i) => ({
            en: `Option ${i + 1} EN`,
            hi: `Option ${i + 1} HI`,
          }));

          const input = {
            ...baseFields,
            options,
            correctOption,
          };

          const result = createQuestionSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
