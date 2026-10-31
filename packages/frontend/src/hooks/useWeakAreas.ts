import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface WeakTopicItem {
  topicId: string;
  topicEn: string;
  topicHi: string;
  accuracy: number;
  totalQuestions: number;
  incorrectCount: number;
  previousAccuracy: number | null;
}

export interface WeakAreaItem {
  subjectEn: string;
  subjectHi: string;
  accuracy: number;
  totalQuestions: number;
  incorrectCount: number;
  topics: WeakTopicItem[];
}

export interface UseWeakAreasResult {
  data: WeakAreaItem[];
  isLoading: boolean;
  error: boolean;
}

export function useWeakAreas(): UseWeakAreasResult {
  const [data, setData] = useState<WeakAreaItem[]>([]);
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
      const response = await api.get('/api/dashboard/weak-areas', {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setData(response.data.data ?? []);
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
