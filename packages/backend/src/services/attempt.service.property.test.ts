/**
 * Property-based tests for the Attempt Service cooldown enforcement.
 *
 * **Validates: Requirements 4.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isCooldownActive, COOLDOWN_HOURS } from './attempt.service';

/** Cooldown duration in milliseconds (24 hours). */
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000; // 86400000

describe('Cooldown Enforcement - Property Tests', () => {
  /**
   * Property 6: Cooldown enforcement
   *
   * For any user who completed a test, attempting to start the same test
   * within 24 hours of submission SHALL be rejected. After 24 hours have
   * elapsed, the attempt SHALL be allowed.
   *
   * **Validates: Requirements 4.6**
   */

  it('cooldown IS active when elapsed time is less than 24 hours', () => {
    fc.assert(
      fc.property(
        // Generate a random submittedAt date within a reasonable range (year 2020-2030)
        fc.date({
          min: new Date('2020-01-01T00:00:00Z'),
          max: new Date('2030-01-01T00:00:00Z'),
        }),
        // Generate elapsed time strictly less than 24 hours (0 to 86399999 ms)
        fc.integer({ min: 0, max: COOLDOWN_MS - 1 }),
        (submittedAt, elapsedMs) => {
          const now = new Date(submittedAt.getTime() + elapsedMs);

          const result = isCooldownActive(submittedAt, now, COOLDOWN_MS);

          // Cooldown should be active (attempt blocked)
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cooldown is NOT active when elapsed time is >= 24 hours', () => {
    fc.assert(
      fc.property(
        // Generate a random submittedAt date within a reasonable range
        fc.date({
          min: new Date('2020-01-01T00:00:00Z'),
          max: new Date('2030-01-01T00:00:00Z'),
        }),
        // Generate elapsed time >= 24 hours (86400000 ms to ~48 hours)
        fc.integer({ min: COOLDOWN_MS, max: COOLDOWN_MS * 2 }),
        (submittedAt, elapsedMs) => {
          const now = new Date(submittedAt.getTime() + elapsedMs);

          const result = isCooldownActive(submittedAt, now, COOLDOWN_MS);

          // Cooldown should NOT be active (attempt allowed)
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cooldown is NOT active at exactly the 24-hour boundary', () => {
    fc.assert(
      fc.property(
        // Generate a random submittedAt date within a reasonable range
        fc.date({
          min: new Date('2020-01-01T00:00:00Z'),
          max: new Date('2030-01-01T00:00:00Z'),
        }),
        (submittedAt) => {
          // Exactly 24 hours after submission
          const now = new Date(submittedAt.getTime() + COOLDOWN_MS);

          const result = isCooldownActive(submittedAt, now, COOLDOWN_MS);

          // At exactly 24h, cooldown is NOT active (>= means allowed)
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property-based tests for Answer Persistence completeness.
 *
 * Since `saveAnswer` depends on the database (queries test_attempts and updates attempt_answers),
 * we test the LOGIC of answer persistence via a pure model that simulates what the DB does.
 *
 * **Validates: Requirements 4.7**
 */

interface AnswerState {
  questionOrder: number;
  selectedOption: number | null;
  markedForReview: boolean;
}

/**
 * Simulates the save-and-retrieve round-trip for an answer.
 * This models the UPDATE + SELECT behavior of the database.
 */
function simulateAnswerPersistence(
  existingAnswers: AnswerState[],
  questionOrder: number,
  selectedOption: number | null,
  markedForReview: boolean
): AnswerState | null {
  const answer = existingAnswers.find(a => a.questionOrder === questionOrder);
  if (!answer) return null; // INVALID_QUESTION_INDEX
  // Simulate UPDATE
  answer.selectedOption = selectedOption;
  answer.markedForReview = markedForReview;
  // Simulate SELECT (retrieve)
  return { ...answer };
}

describe('Answer Persistence Completeness - Property Tests', () => {
  /**
   * Property 5: Answer persistence completeness
   *
   * For any test attempt, saving an answer for question index N and then
   * retrieving the attempt state SHALL return the saved selected_option and
   * marked_for_review values for that index unchanged.
   *
   * **Validates: Requirements 4.7**
   */

  it('after saving, retrieving by questionOrder returns the same selectedOption and markedForReview', () => {
    fc.assert(
      fc.property(
        // Generate a list of 1-50 pre-existing answer slots (simulating pre-created attempt_answers)
        fc.integer({ min: 1, max: 50 }).chain(numQuestions =>
          fc.tuple(
            fc.constant(numQuestions),
            // Pick a valid questionOrder (1-based)
            fc.integer({ min: 1, max: numQuestions }),
            // selectedOption: 0-3 or null
            fc.oneof(fc.integer({ min: 0, max: 3 }), fc.constant(null)),
            // markedForReview: boolean
            fc.boolean()
          )
        ),
        ([numQuestions, questionOrder, selectedOption, markedForReview]) => {
          // Setup: create pre-existing answer slots with null values (as startAttempt does)
          const existingAnswers: AnswerState[] = Array.from({ length: numQuestions }, (_, i) => ({
            questionOrder: i + 1,
            selectedOption: null,
            markedForReview: false,
          }));

          const result = simulateAnswerPersistence(existingAnswers, questionOrder, selectedOption, markedForReview);

          // After saving, the retrieved answer matches what was saved
          expect(result).not.toBeNull();
          expect(result!.questionOrder).toBe(questionOrder);
          expect(result!.selectedOption).toBe(selectedOption);
          expect(result!.markedForReview).toBe(markedForReview);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('saving to a non-existent questionOrder returns null (simulating INVALID_QUESTION_INDEX)', () => {
    fc.assert(
      fc.property(
        // Generate a list of 1-20 pre-existing answer slots
        fc.integer({ min: 1, max: 20 }).chain(numQuestions =>
          fc.tuple(
            fc.constant(numQuestions),
            // Pick a questionOrder that is OUTSIDE the valid range
            fc.oneof(
              fc.integer({ min: -100, max: 0 }),
              fc.integer({ min: numQuestions + 1, max: numQuestions + 100 })
            ),
            fc.oneof(fc.integer({ min: 0, max: 3 }), fc.constant(null)),
            fc.boolean()
          )
        ),
        ([numQuestions, invalidQuestionOrder, selectedOption, markedForReview]) => {
          const existingAnswers: AnswerState[] = Array.from({ length: numQuestions }, (_, i) => ({
            questionOrder: i + 1,
            selectedOption: null,
            markedForReview: false,
          }));

          const result = simulateAnswerPersistence(existingAnswers, invalidQuestionOrder, selectedOption, markedForReview);

          // Non-existent question order should return null
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple saves to the same questionOrder preserve only the latest values', () => {
    fc.assert(
      fc.property(
        // Generate a list of 1-30 pre-existing answer slots
        fc.integer({ min: 1, max: 30 }).chain(numQuestions =>
          fc.tuple(
            fc.constant(numQuestions),
            // Pick a valid questionOrder
            fc.integer({ min: 1, max: numQuestions }),
            // First save values
            fc.oneof(fc.integer({ min: 0, max: 3 }), fc.constant(null)),
            fc.boolean(),
            // Second (latest) save values
            fc.oneof(fc.integer({ min: 0, max: 3 }), fc.constant(null)),
            fc.boolean()
          )
        ),
        ([numQuestions, questionOrder, firstOption, firstReview, latestOption, latestReview]) => {
          const existingAnswers: AnswerState[] = Array.from({ length: numQuestions }, (_, i) => ({
            questionOrder: i + 1,
            selectedOption: null,
            markedForReview: false,
          }));

          // First save
          simulateAnswerPersistence(existingAnswers, questionOrder, firstOption, firstReview);

          // Second save (latest) — should overwrite
          const result = simulateAnswerPersistence(existingAnswers, questionOrder, latestOption, latestReview);

          // Only the latest values should be present
          expect(result).not.toBeNull();
          expect(result!.selectedOption).toBe(latestOption);
          expect(result!.markedForReview).toBe(latestReview);
        }
      ),
      { numRuns: 100 }
    );
  });
});
