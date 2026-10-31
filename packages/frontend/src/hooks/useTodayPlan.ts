import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface TodayPlanItem {
  id: string;
  subjectNameEn: string;
  subjectNameHi: string;
  durationMinutes: number;
  /** About how long this subject takes, and how much of it is done today */
  estimatedMinutes?: number;
  doneMinutes?: number;
  completed: boolean;
  topicCount: number;
  testCount: number;
  tasksTotal?: number;
  tasksDone?: number;
}

export interface TodayPlanData {
  planId: string;
  planName: string;
  items: TodayPlanItem[];
  completedCount: number;
  totalCount: number;
  /** Topics + tests done today across the whole plan (the one "today's progress") */
  tasksDone?: number;
  tasksTotal?: number;
  progressPercent: number;
  /** About how long the whole plan takes, how much is done and how much is left (minutes) */
  estimatedMinutes?: number;
  doneMinutes?: number;
  remainingMinutes?: number;
}

export interface UseTodayPlanResult {
  data: TodayPlanData | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
}

export function useTodayPlan(): UseTodayPlanResult {
  const [data, setData] = useState<TodayPlanData | null>(null);
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
      const response = await api.get('/api/dashboard/today-plan', {
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

  return { data, isLoading, error, refetch: fetchData };
}
