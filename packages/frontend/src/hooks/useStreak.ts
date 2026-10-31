import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchStreak } from '@/services/dashboard.service';
import type { StreakResponse } from '@/services/dashboard.types';

export interface UseStreakResult {
  data: StreakResponse | null;
  isLoading: boolean;
  error: boolean;
  retry: () => void;
}

export function useStreak(): UseStreakResult {
  const [data, setData] = useState<StreakResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(false);

    try {
      const result = await fetchStreak(controller.signal);
      if (!controller.signal.aborted) {
        setData(result);
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
    fetch();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetch]);

  return { data, isLoading, error, retry: fetch };
}
