import api from '@/services/api';
import type {
  LeaderboardResponse,
  StreakResponse,
  RankEstimateResponse,
  ApiErrorResponse,
} from '@/services/dashboard.types';
import { AxiosError } from 'axios';

export interface LeaderboardError {
  message: string;
  code?: string; // e.g. 'NO_EXAM_SELECTED'
}

export interface RankEstimateError {
  message: string;
  isValidationError: boolean; // true for 400s
}

export async function fetchLeaderboard(
  type: 'state' | 'national',
  signal?: AbortSignal
): Promise<LeaderboardResponse> {
  const response = await api.get('/api/dashboard/leaderboard', {
    params: { type },
    signal,
    timeout: 15_000,
  });
  return response.data.data;
}

export async function fetchStreak(signal?: AbortSignal): Promise<StreakResponse> {
  const response = await api.get('/api/dashboard/streak', {
    signal,
    timeout: 15_000,
  });
  return response.data.data;
}

export async function fetchRankEstimate(
  marks: number,
  signal?: AbortSignal
): Promise<RankEstimateResponse> {
  const response = await api.get('/api/dashboard/rank-estimate', {
    params: { marks },
    signal,
    timeout: 15_000,
  });
  return response.data.data;
}

export async function recordActivity(signal?: AbortSignal): Promise<void> {
  await api.post('/api/dashboard/activity', null, {
    signal,
    timeout: 15_000,
  });
}

export function parseLeaderboardError(err: unknown): LeaderboardError {
  if (err instanceof AxiosError && err.response?.data) {
    const data = err.response.data as ApiErrorResponse;
    return {
      message: data.error?.message || 'Failed to load leaderboard',
      code: data.error?.code,
    };
  }
  return { message: 'Failed to load leaderboard. Please try again.' };
}

export function parseRankEstimateError(err: unknown): RankEstimateError {
  if (err instanceof AxiosError && err.response?.status === 400) {
    const data = err.response.data as ApiErrorResponse;
    return {
      message: data.error?.message || 'Invalid input',
      isValidationError: true,
    };
  }
  return {
    message: 'Could not calculate rank. Please try again.',
    isValidationError: false,
  };
}
