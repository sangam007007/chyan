import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchLeaderboard, parseLeaderboardError } from '@/services/dashboard.service';
import type { LeaderboardResponse } from '@/services/dashboard.types';
import type { LeaderboardError } from '@/services/dashboard.service';

export interface UseLeaderboardResult {
  data: LeaderboardResponse | null;
  isLoading: boolean;
  error: LeaderboardError | null;
  retry: () => void;
}

export function useLeaderboard(type: 'state' | 'national'): UseLeaderboardResult {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<LeaderboardError | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Cancel previous in-flight request (for tab switches)
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setData(null); // Clear stale data on tab switch

    try {
      const result = await fetchLeaderboard(type, controller.signal);
      if (!controller.signal.aborted) {
        setData(result);
      }
    } catch (err: unknown) {
      if (!controller.signal.aborted) {
        setError(parseLeaderboardError(err));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [type]);

  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  return { data, isLoading, error, retry: fetchData };
}
