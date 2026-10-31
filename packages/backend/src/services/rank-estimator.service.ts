/**
 * Rank Estimator Service — Calculates an estimated exam rank
 * using a configurable formula based on marks input.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7
 */

import { env } from "@/config/env.js";
import { AppError } from "@/errors/index.js";

// ─── Types ────────────────────────────────────────────────────────────

export interface RankEstimateResult {
  estimatedRank: number;
  totalApplicants: number;
  marks: number;
  percentile: number;
}

// ─── Service ──────────────────────────────────────────────────────────

/**
 * Compute estimated rank given marks.
 *
 * Formula: rank = max(1, round(totalApplicants × (1 - marks / totalMarks)))
 * Percentile: round(marks / totalMarks × 100, 2)
 *
 * @param marks - The marks scored (0 to totalMarks)
 * @returns The estimated rank result
 * @throws AppError with code CONFIG_ERROR if configuration is invalid/missing
 */
export async function estimateRank(marks: number): Promise<RankEstimateResult> {
  const totalApplicants = env.RANK_TOTAL_APPLICANTS;
  const totalMarks = env.RANK_TOTAL_MARKS;

  // Validate configuration at request time
  if (
    !totalApplicants ||
    !Number.isInteger(totalApplicants) ||
    totalApplicants <= 0
  ) {
    console.error(
      "Rank estimation configuration error: RANK_TOTAL_APPLICANTS is invalid or missing",
      { totalApplicants },
    );
    throw new AppError(
      "Rank estimation configuration error",
      "CONFIG_ERROR",
      500,
    );
  }

  if (!totalMarks || totalMarks <= 0) {
    console.error(
      "Rank estimation configuration error: RANK_TOTAL_MARKS is invalid or missing",
      { totalMarks },
    );
    throw new AppError(
      "Rank estimation configuration error",
      "CONFIG_ERROR",
      500,
    );
  }

  // Compute estimated rank
  const estimatedRank = Math.max(
    1,
    Math.round(totalApplicants * (1 - marks / totalMarks)),
  );

  // Compute percentile rounded to 2 decimal places
  const percentile =
    Math.round((marks / totalMarks) * 100 * 100) / 100;

  return {
    estimatedRank,
    totalApplicants,
    marks,
    percentile,
  };
}
