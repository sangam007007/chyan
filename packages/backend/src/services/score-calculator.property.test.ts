/**
 * Property-based tests for the Score Calculator service.
 *
 * **Validates: Requirements 4.5, 5.1, 5.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateScore,
  calculateSubjectBreakdown,
  calculatePercentileFromScores,
  type AttemptAnswer,
  type Question,
} from './score-calculator.service';

/**
 * Generates a consistent set of questions and answers for property testing.
 * Each question gets a random correct_option (0-3), and each answer gets
 * a random selected_option (null for skipped, or 0-3).
 */
function questionsAndAnswersArb(minQuestions = 1, maxQuestions = 50) {
  return fc
    .integer({ min: minQuestions, max: maxQuestions })
    .chain((numQuestions) => {
      const questionArbs = fc.array(
        fc.record({
          id: fc.uuid(),
          correct_option: fc.integer({ min: 0, max: 3 }),
          subject: fc.constantFrom('gk', 'math', 'reasoning', 'hindi'),
        }),
        { minLength: numQuestions, maxLength: numQuestions }
      );

      return questionArbs.chain((questions) => {
        const answerArbs = fc.tuple(
          ...questions.map((q, index) =>
            fc.record({
              question_id: fc.constant(q.id),
              question_order: fc.constant(index + 1),
              selected_option: fc.oneof(
                fc.constant(null),
                fc.integer({ min: 0, max: 3 })
              ),
              marked_for_review: fc.boolean(),
            })
          )
        );

        return answerArbs.map((answers) => ({
          questions: questions as Question[],
          answers: answers as AttemptAnswer[],
        }));
      });
    });
}

describe('Score Calculator - Property Tests', () => {
  /**
   * Property 1: Score calculation correctness
   *
   * For any set of attempt answers and test configuration, the calculated
   * total score SHALL equal:
   *   (correctCount × marksPerQuestion) - (wrongCount × marksPerQuestion × negativeMarkingRatio)
   *
   * And correctCount + wrongCount + skippedCount SHALL equal total answers.
   *
   * And percentage SHALL equal (totalScore / maxScore) × 100 when maxScore > 0.
   *
   * And passed SHALL equal totalScore >= passingMarks.
   *
   * **Validates: Requirements 4.5, 5.1**
   */
  it('score formula, counts sum, percentage, and passed flag are always correct', () => {
    fc.assert(
      fc.property(
        questionsAndAnswersArb(),
        fc.double({ min: 0.5, max: 10, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
        (data, marksPerQuestion, negativeMarkingRatio, passingMarks) => {
          const { questions, answers } = data;

          const result = calculateScore(
            answers,
            questions,
            marksPerQuestion,
            negativeMarkingRatio,
            passingMarks
          );

          // Build a lookup to compute expected counts
          const questionMap = new Map<string, number>();
          for (const q of questions) {
            questionMap.set(q.id, q.correct_option);
          }

          let expectedCorrect = 0;
          let expectedWrong = 0;
          let expectedSkipped = 0;

          for (const answer of answers) {
            if (answer.selected_option === null) {
              expectedSkipped++;
            } else if (answer.selected_option === questionMap.get(answer.question_id)) {
              expectedCorrect++;
            } else {
              expectedWrong++;
            }
          }

          // Verify counts sum to total
          expect(result.correctCount + result.wrongCount + result.skippedCount).toBe(
            answers.length
          );

          // Verify individual counts
          expect(result.correctCount).toBe(expectedCorrect);
          expect(result.wrongCount).toBe(expectedWrong);
          expect(result.skippedCount).toBe(expectedSkipped);

          // Verify score formula
          const expectedScore =
            expectedCorrect * marksPerQuestion -
            expectedWrong * marksPerQuestion * negativeMarkingRatio;
          expect(result.totalScore).toBeCloseTo(expectedScore, 8);

          // Verify maxScore
          const expectedMaxScore = answers.length * marksPerQuestion;
          expect(result.maxScore).toBeCloseTo(expectedMaxScore, 8);

          // Verify percentage
          if (expectedMaxScore > 0) {
            const expectedPercentage = (expectedScore / expectedMaxScore) * 100;
            expect(result.percentage).toBeCloseTo(expectedPercentage, 8);
          } else {
            expect(result.percentage).toBe(0);
          }

          // Verify passed flag
          expect(result.passed).toBe(result.totalScore >= passingMarks);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Subject Breakdown - Property Tests', () => {
  /**
   * Property 2: Subject breakdown consistency
   *
   * For any set of attempt answers and questions, the sum of
   * (correct + wrong + skipped) across ALL subject breakdowns SHALL equal
   * the total number of answers that have matching questions.
   *
   * Additionally, each answer's classification (correct/wrong/skipped)
   * in the breakdown matches what calculateScore would compute for the
   * same answer set.
   *
   * **Validates: Requirements 5.3**
   */
  it('sum of breakdowns equals total counts for matched answers', () => {
    fc.assert(
      fc.property(
        questionsAndAnswersArb(),
        (data) => {
          const { questions, answers } = data;

          const breakdowns = calculateSubjectBreakdown(answers, questions);

          // Build question lookup to determine which answers have matching questions
          const questionMap = new Map<string, Question>();
          for (const q of questions) {
            questionMap.set(q.id, q);
          }

          // Count how many answers have a matching question
          const matchedAnswerCount = answers.filter(
            (a) => questionMap.has(a.question_id)
          ).length;

          // Sum of all breakdown totals should equal matched answer count
          const breakdownTotalSum = breakdowns.reduce(
            (sum, b) => sum + b.total,
            0
          );
          expect(breakdownTotalSum).toBe(matchedAnswerCount);

          // Sum of correct + wrong + skipped across breakdowns should also equal matched count
          const correctSum = breakdowns.reduce((sum, b) => sum + b.correct, 0);
          const wrongSum = breakdowns.reduce((sum, b) => sum + b.wrong, 0);
          const skippedSum = breakdowns.reduce((sum, b) => sum + b.skipped, 0);
          expect(correctSum + wrongSum + skippedSum).toBe(matchedAnswerCount);

          // Each breakdown's total should equal its own correct + wrong + skipped
          for (const breakdown of breakdowns) {
            expect(breakdown.correct + breakdown.wrong + breakdown.skipped).toBe(
              breakdown.total
            );
          }

          // Verify breakdown classifications match calculateScore logic
          const scoreResult = calculateScore(answers, questions, 1, 0, 0);
          expect(correctSum).toBe(scoreResult.correctCount);
          expect(wrongSum).toBe(scoreResult.wrongCount);
          expect(skippedSum).toBe(scoreResult.skippedCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Percentile Calculation - Property Tests', () => {
  /**
   * Property 3: Percentile calculation
   *
   * For any score and array of all scores, the calculated percentile SHALL
   * equal (count of scores <= target score / total scores) × 100.
   *
   * Additionally:
   * - Percentile is always between 0 and 100 (inclusive)
   * - If the score is the maximum in allScores, percentile = 100
   * - If allScores is empty, percentile = 100
   * - The highest score always gets 100% percentile
   *
   * **Validates: Requirements 5.2**
   */
  it('percentile is always between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50, max: 200 }), { minLength: 0, maxLength: 100 }),
        fc.integer({ min: -50, max: 200 }),
        (allScores, score) => {
          const percentile = calculatePercentileFromScores(score, allScores);
          expect(percentile).toBeGreaterThanOrEqual(0);
          expect(percentile).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('percentile equals (count of scores <= target score / total scores) × 100', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50, max: 200 }), { minLength: 1, maxLength: 100 }),
        fc.integer({ min: -50, max: 200 }),
        (allScores, score) => {
          const percentile = calculatePercentileFromScores(score, allScores);
          const countBelow = allScores.filter((s) => s <= score).length;
          const expectedPercentile = (countBelow / allScores.length) * 100;
          expect(percentile).toBeCloseTo(expectedPercentile, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if score is the maximum in allScores, percentile equals 100', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50, max: 200 }), { minLength: 1, maxLength: 100 }),
        (allScores) => {
          const maxScore = Math.max(...allScores);
          const percentile = calculatePercentileFromScores(maxScore, allScores);
          expect(percentile).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('if allScores is empty, percentile equals 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -50, max: 200 }),
        (score) => {
          const percentile = calculatePercentileFromScores(score, []);
          expect(percentile).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the highest score in allScores always gets 100% percentile', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -50, max: 200 }), { minLength: 1, maxLength: 100 }),
        (allScores) => {
          const highestScore = Math.max(...allScores);
          const percentile = calculatePercentileFromScores(highestScore, allScores);
          expect(percentile).toBe(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});
