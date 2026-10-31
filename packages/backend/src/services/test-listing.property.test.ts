/**
 * Property-based tests for test listing filtering logic.
 *
 * **Validates: Requirements 2.5, 3.1, 3.5**
 *
 * The schedule filtering rule from the SQL:
 *   (available_from IS NULL OR available_from <= NOW())
 *   AND (available_until IS NULL OR available_until >= NOW())
 *
 * The exam/status filtering rule:
 *   status = 'published' AND exam_id = targetExamId
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Pure function encoding the schedule filtering logic used in the
 * test-listing SQL query. A test is visible when:
 *   - available_from is null OR available_from <= now
 *   - AND available_until is null OR available_until >= now
 */
function isTestInSchedule(
  availableFrom: Date | null,
  availableUntil: Date | null,
  now: Date
): boolean {
  const fromOk = availableFrom === null || availableFrom.getTime() <= now.getTime();
  const untilOk = availableUntil === null || availableUntil.getTime() >= now.getTime();
  return fromOk && untilOk;
}

/**
 * Arbitrary for generating dates within a reasonable range (2020-2030).
 */
const dateArb = fc.date({
  min: new Date('2020-01-01T00:00:00Z'),
  max: new Date('2030-12-31T23:59:59Z'),
});

describe('Test Listing Schedule Filtering - Property Tests', () => {
  /**
   * Property 4: Test listing schedule filtering
   *
   * For any test with schedule dates, the test SHALL appear in listings
   * only when the current time is between available_from and available_until
   * (inclusive). Tests outside this window SHALL be excluded.
   *
   * **Validates: Requirements 2.5, 3.5**
   */

  it('if both available_from and available_until are null, the test is always visible', () => {
    fc.assert(
      fc.property(dateArb, (now) => {
        const result = isTestInSchedule(null, null, now);
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('if available_from <= now AND available_until is null, test is visible', () => {
    fc.assert(
      fc.property(
        dateArb,
        dateArb,
        (availableFrom, now) => {
          // Ensure available_from <= now
          const from = availableFrom.getTime() <= now.getTime() ? availableFrom : now;
          const adjustedNow = availableFrom.getTime() <= now.getTime() ? now : availableFrom;

          const result = isTestInSchedule(from, null, adjustedNow);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if available_from > now, test is not visible', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }),
        (now, offsetMs) => {
          // available_from is strictly after now
          const availableFrom = new Date(now.getTime() + offsetMs);
          const result = isTestInSchedule(availableFrom, null, now);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if available_until < now, test is not visible', () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }),
        (now, offsetMs) => {
          // available_until is strictly before now
          const availableUntil = new Date(now.getTime() - offsetMs);
          const result = isTestInSchedule(null, availableUntil, now);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if available_from <= now <= available_until, test is visible', () => {
    fc.assert(
      fc.property(
        dateArb,
        dateArb,
        dateArb,
        (d1, d2, d3) => {
          // Sort the three dates to get from <= now <= until
          const sorted = [d1, d2, d3].sort((a, b) => a.getTime() - b.getTime());
          const availableFrom = sorted[0];
          const now = sorted[1];
          const availableUntil = sorted[2];

          const result = isTestInSchedule(availableFrom, availableUntil, now);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('schedule filtering is consistent: visible iff (from is null OR from <= now) AND (until is null OR until >= now)', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), dateArb),
        fc.oneof(fc.constant(null), dateArb),
        dateArb,
        (availableFrom, availableUntil, now) => {
          const result = isTestInSchedule(availableFrom, availableUntil, now);

          const fromOk = availableFrom === null || availableFrom.getTime() <= now.getTime();
          const untilOk = availableUntil === null || availableUntil.getTime() >= now.getTime();
          const expected = fromOk && untilOk;

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 5: Test listing exam and status filtering
 *
 * Given a set of tests with random statuses (draft/published) and random exam IDs,
 * the filtering logic should return ONLY tests where status='published' AND
 * exam_id matches the target exam.
 *
 * **Validates: Requirements 3.1**
 */

interface TestData {
  id: string;
  status: 'draft' | 'published';
  examId: string;
}

/**
 * Pure function encoding the exam + status filtering logic used in the
 * test-listing SQL query. A test is returned when:
 *   - status = 'published'
 *   - AND exam_id = targetExamId
 */
function filterTestsForUser(tests: TestData[], targetExamId: string): TestData[] {
  return tests.filter(t => t.status === 'published' && t.examId === targetExamId);
}

/**
 * Generate a set of 3-5 random UUIDs to use as exam IDs.
 */
const examIdSetArb = fc.array(fc.uuid(), { minLength: 3, maxLength: 5 });

/**
 * Given a set of exam IDs, generate a random test with random status and random examId.
 */
function testDataArb(examIds: string[]): fc.Arbitrary<TestData> {
  return fc.record({
    id: fc.uuid(),
    status: fc.oneof(fc.constant('draft' as const), fc.constant('published' as const)),
    examId: fc.constantFrom(...examIds),
  });
}

describe('Test Listing Exam and Status Filtering - Property Tests', () => {
  it('all returned tests have status = published', () => {
    fc.assert(
      fc.property(
        examIdSetArb.chain((examIds) =>
          fc.tuple(
            fc.array(testDataArb(examIds), { minLength: 1, maxLength: 20 }),
            fc.constantFrom(...examIds)
          )
        ),
        ([tests, targetExamId]) => {
          const result = filterTestsForUser(tests, targetExamId);
          for (const test of result) {
            expect(test.status).toBe('published');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all returned tests have examId = targetExamId', () => {
    fc.assert(
      fc.property(
        examIdSetArb.chain((examIds) =>
          fc.tuple(
            fc.array(testDataArb(examIds), { minLength: 1, maxLength: 20 }),
            fc.constantFrom(...examIds)
          )
        ),
        ([tests, targetExamId]) => {
          const result = filterTestsForUser(tests, targetExamId);
          for (const test of result) {
            expect(test.examId).toBe(targetExamId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no test matching both criteria is excluded from results', () => {
    fc.assert(
      fc.property(
        examIdSetArb.chain((examIds) =>
          fc.tuple(
            fc.array(testDataArb(examIds), { minLength: 1, maxLength: 20 }),
            fc.constantFrom(...examIds)
          )
        ),
        ([tests, targetExamId]) => {
          const result = filterTestsForUser(tests, targetExamId);
          const resultIds = new Set(result.map(t => t.id));

          // Every test that matches both criteria must be in the result
          for (const test of tests) {
            if (test.status === 'published' && test.examId === targetExamId) {
              expect(resultIds.has(test.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('count of returned tests equals count of tests with published + matching exam', () => {
    fc.assert(
      fc.property(
        examIdSetArb.chain((examIds) =>
          fc.tuple(
            fc.array(testDataArb(examIds), { minLength: 1, maxLength: 20 }),
            fc.constantFrom(...examIds)
          )
        ),
        ([tests, targetExamId]) => {
          const result = filterTestsForUser(tests, targetExamId);
          const expectedCount = tests.filter(
            t => t.status === 'published' && t.examId === targetExamId
          ).length;

          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
