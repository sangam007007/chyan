import { useState, useCallback, useRef } from 'react';
import { fetchRankEstimate, parseRankEstimateError } from '@/services/dashboard.service';
import type { RankEstimateResponse, ValidationResult } from '@/services/dashboard.types';
import type { RankEstimateError } from '@/services/dashboard.service';

export interface UseRankEstimateResult {
  data: RankEstimateResponse | null;
  isLoading: boolean;
  error: RankEstimateError | null;
  calculate: (marks: number) => void;
}

/**
 * Validates marks input before sending to API.
 * Rules: numeric, 0–150 inclusive, up to 2 decimal places.
 */
export function validateMarks(input: string): ValidationResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { valid: false, error: 'Please enter marks' };
  }

  const num = Number(trimmed);
  if (isNaN(num)) {
    return { valid: false, error: 'Marks must be a number' };
  }
  if (num < 0 || num > 150) {
    return { valid: false, error: 'Marks must be between 0 and 150' };
  }

  // Check up to 2 decimal places
  const decimalPart = trimmed.split('.')[1];
  if (decimalPart && decimalPart.length > 2) {
    return { valid: false, error: 'Up to 2 decimal places allowed' };
  }

  return { valid: true };
}

export function useRankEstimate(): UseRankEstimateResult {
  const [data, setData] = useState<RankEstimateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<RankEstimateError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const calculate = useCallback(async (marks: number) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await fetchRankEstimate(marks, controller.signal);
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setError(parseRankEstimateError(err));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  return { data, isLoading, error, calculate };
}
