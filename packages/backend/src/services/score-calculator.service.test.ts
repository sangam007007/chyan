import { describe, it, expect } from "vitest";

import {
  calculateScore,
  calculateSubjectBreakdown,
  type AttemptAnswer,
  type Question,
  type ScoreResult,
  type SubjectBreakdown,
} from "./score-calculator.service.js";

// ─── Test Fixtures ────────────────────────────────────────────────────

function makeQuestion(id: string, correctOption: number, subject = "gk"): Question {
  return { id, correct_option: correctOption, subject };
}

function makeAnswer(questionId: string, selectedOption: number | null): AttemptAnswer {
  return {
    question_id: questionId,
    question_order: 0,
    selected_option: selectedOption,
    marked_for_review: false,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe("calculateScore", () => {
  const questions: Question[] = [
    makeQuestion("q1", 0),
    makeQuestion("q2", 1),
    makeQuestion("q3", 2),
    makeQuestion("q4", 3),
    makeQuestion("q5", 0),
  ];

  describe("basic scoring", () => {
    it("should score all correct answers", () => {
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0),
        makeAnswer("q2", 1),
        makeAnswer("q3", 2),
        makeAnswer("q4", 3),
        makeAnswer("q5", 0),
      ];

      const result = calculateScore(answers, questions, 2, 0.25, 5, 300);

      expect(result.correctCount).toBe(5);
      expect(result.wrongCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.totalScore).toBe(10); // 5 * 2
      expect(result.maxScore).toBe(10); // 5 * 2
      expect(result.percentage).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.timeTakenSeconds).toBe(300);
    });

    it("should score all wrong answers with negative marking", () => {
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 1), // wrong (correct is 0)
        makeAnswer("q2", 0), // wrong (correct is 1)
        makeAnswer("q3", 0), // wrong (correct is 2)
        makeAnswer("q4", 0), // wrong (correct is 3)
        makeAnswer("q5", 1), // wrong (correct is 0)
      ];

      const result = calculateScore(answers, questions, 2, 0.25, 5, 600);

      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(5);
      expect(result.skippedCount).toBe(0);
      // totalScore = 0 - (5 * 2 * 0.25) = -2.5
      expect(result.totalScore).toBe(-2.5);
      expect(result.maxScore).toBe(10);
      expect(result.percentage).toBe(-25);
      expect(result.passed).toBe(false);
    });

    it("should score all skipped answers", () => {
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", null),
        makeAnswer("q2", null),
        makeAnswer("q3", null),
        makeAnswer("q4", null),
        makeAnswer("q5", null),
      ];

      const result = calculateScore(answers, questions, 2, 0.25, 5, 120);

      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(0);
      expect(result.skippedCount).toBe(5);
      expect(result.totalScore).toBe(0);
      expect(result.maxScore).toBe(10);
      expect(result.percentage).toBe(0);
      expect(result.passed).toBe(false);
    });

    it("should score a mixed set of correct, wrong, and skipped", () => {
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0),    // correct
        makeAnswer("q2", 0),    // wrong (correct is 1)
        makeAnswer("q3", null), // skipped
        makeAnswer("q4", 3),    // correct
        makeAnswer("q5", 2),    // wrong (correct is 0)
      ];

      const result = calculateScore(answers, questions, 4, 0.25, 10, 450);

      expect(result.correctCount).toBe(2);
      expect(result.wrongCount).toBe(2);
      expect(result.skippedCount).toBe(1);
      // totalScore = (2 * 4) - (2 * 4 * 0.25) = 8 - 2 = 6
      expect(result.totalScore).toBe(6);
      expect(result.maxScore).toBe(20); // 5 * 4
      expect(result.percentage).toBe(30); // (6/20) * 100
      expect(result.passed).toBe(false); // 6 < 10
    });
  });

  describe("passing threshold", () => {
    it("should pass when totalScore equals passingMarks", () => {
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0), // correct
        makeAnswer("q2", 1), // correct
        makeAnswer("q3", null),
        makeAnswer("q4", null),
        makeAnswer("q5", null),
      ];

      // totalScore = 2 * 2 = 4, passingMarks = 4
      const result = calculateScore(answers, questions, 2, 0.25, 4, 200);

      expect(result.totalScore).toBe(4);
      expect(result.passed).toBe(true);
    });

    it("should fail when totalScore is just below passingMarks", () => {
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0), // correct
        makeAnswer("q2", null),
        makeAnswer("q3", null),
        makeAnswer("q4", null),
        makeAnswer("q5", null),
      ];

      // totalScore = 1 * 2 = 2, passingMarks = 3
      const result = calculateScore(answers, questions, 2, 0.25, 3, 100);

      expect(result.totalScore).toBe(2);
      expect(result.passed).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle zero negative marking ratio", () => {
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 1), // wrong
        makeAnswer("q2", 0), // wrong
        makeAnswer("q3", 0), // wrong
        makeAnswer("q4", 0), // wrong
        makeAnswer("q5", 1), // wrong
      ];

      const result = calculateScore(answers, questions, 2, 0, 5, 500);

      expect(result.wrongCount).toBe(5);
      // No penalty: totalScore = 0 - (5 * 2 * 0) = 0
      expect(result.totalScore).toBe(0);
    });

    it("should handle empty answers array", () => {
      const result = calculateScore([], questions, 2, 0.25, 5, 0);

      expect(result.correctCount).toBe(0);
      expect(result.wrongCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.totalScore).toBe(0);
      expect(result.maxScore).toBe(0);
      expect(result.percentage).toBe(0);
      expect(result.passed).toBe(false);
    });

    it("should default timeTakenSeconds to 0 when not provided", () => {
      const answers: AttemptAnswer[] = [makeAnswer("q1", 0)];

      const result = calculateScore(answers, questions, 1, 0, 0);

      expect(result.timeTakenSeconds).toBe(0);
    });

    it("should pass with zero passingMarks and zero score", () => {
      const answers: AttemptAnswer[] = [makeAnswer("q1", null)];

      const result = calculateScore(answers, questions, 1, 0, 0, 10);

      expect(result.totalScore).toBe(0);
      expect(result.passed).toBe(true); // 0 >= 0
    });
  });
});

describe("calculateSubjectBreakdown", () => {
  describe("basic breakdown", () => {
    it("should group answers by subject and count correct/wrong/skipped", () => {
      const questions: Question[] = [
        makeQuestion("q1", 0, "gk"),
        makeQuestion("q2", 1, "math"),
        makeQuestion("q3", 2, "gk"),
        makeQuestion("q4", 3, "math"),
        makeQuestion("q5", 0, "reasoning"),
      ];

      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0),    // gk - correct
        makeAnswer("q2", 1),    // math - correct
        makeAnswer("q3", null), // gk - skipped
        makeAnswer("q4", 0),    // math - wrong
        makeAnswer("q5", 0),    // reasoning - correct
      ];

      const result = calculateSubjectBreakdown(answers, questions);

      const gk = result.find((b) => b.subject === "gk")!;
      expect(gk.correct).toBe(1);
      expect(gk.wrong).toBe(0);
      expect(gk.skipped).toBe(1);
      expect(gk.total).toBe(2);

      const math = result.find((b) => b.subject === "math")!;
      expect(math.correct).toBe(1);
      expect(math.wrong).toBe(1);
      expect(math.skipped).toBe(0);
      expect(math.total).toBe(2);

      const reasoning = result.find((b) => b.subject === "reasoning")!;
      expect(reasoning.correct).toBe(1);
      expect(reasoning.wrong).toBe(0);
      expect(reasoning.skipped).toBe(0);
      expect(reasoning.total).toBe(1);
    });

    it("should return all four subjects when present", () => {
      const questions: Question[] = [
        makeQuestion("q1", 0, "gk"),
        makeQuestion("q2", 1, "math"),
        makeQuestion("q3", 2, "reasoning"),
        makeQuestion("q4", 3, "hindi"),
      ];

      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0),
        makeAnswer("q2", 1),
        makeAnswer("q3", 2),
        makeAnswer("q4", 3),
      ];

      const result = calculateSubjectBreakdown(answers, questions);

      expect(result).toHaveLength(4);
      for (const breakdown of result) {
        expect(breakdown.correct).toBe(1);
        expect(breakdown.wrong).toBe(0);
        expect(breakdown.skipped).toBe(0);
        expect(breakdown.total).toBe(1);
      }
    });
  });

  describe("edge cases", () => {
    it("should return empty array for empty answers", () => {
      const questions: Question[] = [makeQuestion("q1", 0, "gk")];
      const result = calculateSubjectBreakdown([], questions);
      expect(result).toHaveLength(0);
    });

    it("should skip answers with no matching question", () => {
      const questions: Question[] = [makeQuestion("q1", 0, "gk")];
      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0),
        makeAnswer("q999", 1), // no matching question
      ];

      const result = calculateSubjectBreakdown(answers, questions);

      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe("gk");
      expect(result[0].total).toBe(1);
    });

    it("should handle all skipped answers in one subject", () => {
      const questions: Question[] = [
        makeQuestion("q1", 0, "math"),
        makeQuestion("q2", 1, "math"),
        makeQuestion("q3", 2, "math"),
      ];

      const answers: AttemptAnswer[] = [
        makeAnswer("q1", null),
        makeAnswer("q2", null),
        makeAnswer("q3", null),
      ];

      const result = calculateSubjectBreakdown(answers, questions);

      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe("math");
      expect(result[0].correct).toBe(0);
      expect(result[0].wrong).toBe(0);
      expect(result[0].skipped).toBe(3);
      expect(result[0].total).toBe(3);
    });

    it("should handle all wrong answers across subjects", () => {
      const questions: Question[] = [
        makeQuestion("q1", 0, "gk"),
        makeQuestion("q2", 1, "hindi"),
      ];

      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 2), // wrong
        makeAnswer("q2", 3), // wrong
      ];

      const result = calculateSubjectBreakdown(answers, questions);

      const gk = result.find((b) => b.subject === "gk")!;
      expect(gk.correct).toBe(0);
      expect(gk.wrong).toBe(1);
      expect(gk.skipped).toBe(0);

      const hindi = result.find((b) => b.subject === "hindi")!;
      expect(hindi.correct).toBe(0);
      expect(hindi.wrong).toBe(1);
      expect(hindi.skipped).toBe(0);
    });
  });

  describe("consistency check", () => {
    it("sum of all breakdowns should equal total answers count", () => {
      const questions: Question[] = [
        makeQuestion("q1", 0, "gk"),
        makeQuestion("q2", 1, "math"),
        makeQuestion("q3", 2, "reasoning"),
        makeQuestion("q4", 3, "hindi"),
        makeQuestion("q5", 0, "gk"),
        makeQuestion("q6", 1, "math"),
      ];

      const answers: AttemptAnswer[] = [
        makeAnswer("q1", 0),    // gk - correct
        makeAnswer("q2", 0),    // math - wrong
        makeAnswer("q3", null), // reasoning - skipped
        makeAnswer("q4", 3),    // hindi - correct
        makeAnswer("q5", 1),    // gk - wrong
        makeAnswer("q6", null), // math - skipped
      ];

      const result = calculateSubjectBreakdown(answers, questions);

      const totalFromBreakdown = result.reduce((sum, b) => sum + b.total, 0);
      expect(totalFromBreakdown).toBe(answers.length);

      const totalCorrect = result.reduce((sum, b) => sum + b.correct, 0);
      const totalWrong = result.reduce((sum, b) => sum + b.wrong, 0);
      const totalSkipped = result.reduce((sum, b) => sum + b.skipped, 0);
      expect(totalCorrect + totalWrong + totalSkipped).toBe(answers.length);
    });
  });
});
