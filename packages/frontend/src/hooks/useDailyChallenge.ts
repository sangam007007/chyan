import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface DailyChallengeData {
  solved: number;
  target: number;
}

export interface UseDailyChallengeResult {
  data: DailyChallengeData | null;
  isLoading: boolean;
  error: boolean;
}

export function useDailyChallenge(): UseDailyChallengeResult {
  const [data, setData] = useState<DailyChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(false);

    try {
      const response = await api.get('/api/dashboard/daily-challenge', {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setData(response.data.data);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchData]);

  return { data, isLoading, error };
}
