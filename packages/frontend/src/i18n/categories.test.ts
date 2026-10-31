import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import en from './en.json';
import hi from './hi.json';

/**
 * Feature: test-categories, Property 6: Bilingual Category Label Correctness
 *
 * Validates: Requirements 2.3, 4.2
 *
 * For every valid category × language combination, looking up the
 * category translation key returns a non-empty string.
 */

const VALID_CATEGORIES = [
  'all',
  'full_mock',
  'subject_wise',
  'previous_year',
  'daily_practice',
] as const;

type CategoryKey = (typeof VALID_CATEGORIES)[number];

const translations: Record<string, Record<string, Record<string, string>>> = {
  en,
  hi,
};

function lookupCategoryLabel(category: CategoryKey, language: 'en' | 'hi'): string | undefined {
  const langFile = translations[language];
  return langFile?.testList?.categories?.[category];
}

describe('Feature: test-categories, Property 6: Bilingual Category Label Correctness', () => {
  it('every valid category × language combination returns a non-empty string', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_CATEGORIES),
        fc.constantFrom<'en' | 'hi'>('en', 'hi'),
        (category, language) => {
          const label = lookupCategoryLabel(category, language);
          // Label must be defined
          expect(label).toBeDefined();
          // Label must be a string
          expect(typeof label).toBe('string');
          // Label must be non-empty
          expect((label as string).trim().length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
