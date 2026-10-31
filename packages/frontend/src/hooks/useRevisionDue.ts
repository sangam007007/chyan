import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface RevisionDueItem {
  id: string;
  questionText: string;
  subject: string;
  createdAt: string;
}

export interface UseRevisionDueResult {
  data: RevisionDueItem[];
  isLoading: boolean;
  error: boolean;
}

export function useRevisionDue(): UseRevisionDueResult {
  const [data, setData] = useState<RevisionDueItem[]>([]);
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
      const response = await api.get('/api/dashboard/revision-due', {
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
