/**
 * Property-based tests for test category validation schema.
 *
 * Feature: test-categories, Property 1: Category Validation Accepts Only Valid Values
 *
 * **Validates: Requirements 1.2, 5.3, 5.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { z } from 'zod';
import { VALID_CATEGORIES, createTestSchema } from './test.schema';

describe('Category Validation - Property Tests', () => {
  /**
   * Property 1: Category Validation Accepts Only Valid Values
   *
   * For any string input, the category validator SHALL accept it if and only if
   * it is exactly one of: full_mock, subject_wise, previous_year, daily_practice.
   * All other strings — including empty strings, strings with extra whitespace,
   * different casing, or partial matches — SHALL be rejected.
   *
   * **Validates: Requirements 1.2, 5.3, 5.4**
   */

  const categorySchema = z.enum(VALID_CATEGORIES);

  it('rejects arbitrary strings that are not valid categories', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !(VALID_CATEGORIES as readonly string[]).includes(s)),
        (arbitraryString) => {
          const result = categorySchema.safeParse(arbitraryString);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts all valid category values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_CATEGORIES),
        (validCategory) => {
          const result = categorySchema.safeParse(validCategory);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
