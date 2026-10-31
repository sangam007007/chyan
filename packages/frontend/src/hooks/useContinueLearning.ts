import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface ContinueLearningData {
  subjectNameEn: string;
  subjectNameHi: string;
  topicNameEn: string;
  topicNameHi: string;
  /** Accuracy of the latest attempt on this topic */
  accuracyPercent: number;
  /** Score % of the latest test on this topic (same as the test result) */
  lastScorePercent?: number;
  /** Topic completion — same number as the topic page */
  progressPercent?: number;
  completedParts?: number;
  totalParts?: number;
  completedTests?: number;
  totalTests?: number;
  topicId: string;
  subjectId: string;
}

export interface UseContinueLearningResult {
  data: ContinueLearningData | null;
  isLoading: boolean;
  error: boolean;
}

export function useContinueLearning(): UseContinueLearningResult {
  const [data, setData] = useState<ContinueLearningData | null>(null);
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
      const response = await api.get('/api/dashboard/continue-learning', {
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
