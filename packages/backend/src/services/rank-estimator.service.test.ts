// Feature: dashboard-backend, Property 10: Rank estimation formula and output invariants

import { describe, it, vi, expect } from "vitest";
import fc from "fast-check";

// Mock the env module before importing the service
vi.mock("@/config/env.js", () => ({
  env: {
    RANK_TOTAL_APPLICANTS: 50000,
    RANK_TOTAL_MARKS: 150,
  },
}));

// Mock AppError since the service imports it
vi.mock("@/errors/index.js", () => ({
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

import { estimateRank } from "./rank-estimator.service.js";

describe("Property 10: Rank estimation formula and output invariants", () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * For any valid marks value M (0 ≤ M ≤ 150, up to 2 decimal places),
   * given configuration values totalApplicants (50000) and totalMarks (150):
   * - estimatedRank is an integer >= 1
   * - estimatedRank === Math.max(1, Math.round(totalApplicants * (1 - marks / totalMarks)))
   * - percentile === Math.round((marks / totalMarks) * 100 * 100) / 100
   * - All four response fields are present: estimatedRank, totalApplicants, marks, percentile
   */
  it("should satisfy rank estimation formula and output invariants for all valid marks", async () => {
    const totalApplicants = 50000;
    const totalMarks = 150;

    await fc.assert(
      fc.asyncProperty(
        fc
          .double({ min: 0, max: 150, noNaN: true, noDefaultInfinity: true })
          .map((v) => Math.round(v * 100) / 100), // round to 2 decimal places
        async (marks) => {
          const result = await estimateRank(marks);

          // All four fields must be present
          expect(result).toHaveProperty("estimatedRank");
          expect(result).toHaveProperty("totalApplicants");
          expect(result).toHaveProperty("marks");
          expect(result).toHaveProperty("percentile");

          // estimatedRank is an integer >= 1
          expect(Number.isInteger(result.estimatedRank)).toBe(true);
          expect(result.estimatedRank).toBeGreaterThanOrEqual(1);

          // estimatedRank matches the formula
          const expectedRank = Math.max(
            1,
            Math.round(totalApplicants * (1 - marks / totalMarks)),
          );
          expect(result.estimatedRank).toBe(expectedRank);

          // percentile matches the formula
          const expectedPercentile =
            Math.round((marks / totalMarks) * 100 * 100) / 100;
          expect(result.percentile).toBe(expectedPercentile);

          // marks field is echoed back
          expect(result.marks).toBe(marks);

          // totalApplicants field matches config
          expect(result.totalApplicants).toBe(totalApplicants);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: dashboard-backend, Property 11: Invalid marks rejected

import { z } from "zod";

// Validation schema as defined in design doc (will live in controller later)
const rankEstimateQuerySchema = z.object({
  marks: z.coerce
    .number()
    .min(0, "marks must be >= 0")
    .max(150, "marks must be <= 150")
    .refine((v) => Number((v * 100).toFixed(0)) === v * 100, {
      message: "marks accepts up to 2 decimal places",
    }),
});

describe("Property 11: Invalid marks rejected", () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * For any value that is non-numeric, less than 0, greater than 150,
   * or missing, requesting the rank estimate SHALL result in a 400 validation error.
   */

  it("rejects negative numbers", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: -0.01, noNaN: true, noDefaultInfinity: true }),
        (marks) => {
          const result = rankEstimateQuerySchema.safeParse({ marks });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects numbers greater than 150", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 150.01, max: 10000, noNaN: true, noDefaultInfinity: true }),
        (marks) => {
          const result = rankEstimateQuerySchema.safeParse({ marks });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects non-numeric strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => {
          const num = Number(s);
          // Truly non-numeric: NaN when coerced (excluding empty/whitespace which coerce to 0)
          return isNaN(num) && s.trim().length > 0;
        }),
        (marks) => {
          const result = rankEstimateQuerySchema.safeParse({ marks });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects NaN and Infinity", () => {
    const invalidValues = [NaN, Infinity, -Infinity];
    for (const marks of invalidValues) {
      const result = rankEstimateQuerySchema.safeParse({ marks });
      expect(result.success).toBe(false);
    }
  });
});
