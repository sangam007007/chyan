import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export type QuizStatus = 'not_started' | 'in_progress' | 'completed';

export interface QuizStatusData {
  status: QuizStatus;
  attempt?: any;
  score?: number;
}

export interface UseDailyQuizResult {
  status: QuizStatusData | null;
  isLoading: boolean;
  startQuiz: () => Promise<any>;
  submitQuiz: (attemptId: string, answers: (number | null)[]) => Promise<any>;
  refetch: () => void;
}

export function useDailyQuiz(): UseDailyQuizResult {
  const [status, setStatus] = useState<QuizStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);

    try {
      const response = await api.get('/api/daily-quiz/status', {
        signal: controller.signal,
        timeout: 15_000,
      });
      if (!controller.signal.aborted) {
        const data = response.data.data;
        setStatus({
          status: data.status,
          attempt: data.attempt,
          score: data.attempt?.score ?? undefined,
        });
      }
    } catch {
      if (!controller.signal.aborted) {
        setStatus(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchStatus]);

  const startQuiz = useCallback(async () => {
    const response = await api.post('/api/daily-quiz/start', {}, {
      timeout: 15_000,
    });
    const attempt = response.data.data.attempt ?? response.data.data;
    setStatus({ status: 'in_progress', attempt });
    return attempt;
  }, []);

  const submitQuiz = useCallback(async (attemptId: string, answers: (number | null)[]) => {
    const response = await api.post('/api/daily-quiz/submit', {
      attemptId,
      answers,
    }, {
      timeout: 15_000,
    });
    const result = response.data.data;
    setStatus({ status: 'completed', score: result.score, attempt: result });
    return result;
  }, []);

  return { status, isLoading, startQuiz, submitQuiz, refetch: fetchStatus };
}
