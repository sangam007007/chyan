import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface UseDaysLeftResult {
  daysLeft: number | null;
  examDateFormatted: string | null;
  isLoading: boolean;
}

export function useDaysLeft(): UseDaysLeftResult {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [examDateFormatted, setExamDateFormatted] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    try {
      const response = await api.get('/api/dashboard/home', {
        signal: controller.signal,
        timeout: 15_000,
      });
      if (!controller.signal.aborted) {
        const data = response.data.data;
        setDaysLeft(data.daysLeft ?? null);
        setExamDateFormatted(data.examDateFormatted ?? null);
      }
    } catch {
      if (!controller.signal.aborted) {
        setDaysLeft(null);
        setExamDateFormatted(null);
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

  return { daysLeft, examDateFormatted, isLoading };
}
