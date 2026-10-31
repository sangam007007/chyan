import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PerformanceOverview {
  totalTestsAttempted: number;
  totalQuestionsSolved: number;
  totalCorrect: number;
  totalWrong: number;
  overallAccuracy: number;
  averageScore: number;
  averagePercentage: number;
  totalCoinsEarned: number;
  totalStudyTimeMinutes: number;
  currentStreak: number;
  bestStreak: number;
}

export interface WeeklyEntry {
  date: string;
  studyTimeMinutes: number;
  testsCompleted: number;
  questionsSolved: number;
  accuracy: number | null;
}

export interface SubjectAnalytics {
  subjectId: string;
  nameEn: string;
  nameHi: string;
  accuracy: number;
  totalAttempts: number;
  questionsSolved: number;
  averageScore: number;
  completionPercentage: number;
}

export interface WeakStrongAreas {
  weak: SubjectAnalytics[];
  strong: SubjectAnalytics[];
}

export interface UsePerformanceAnalyticsResult {
  overview: PerformanceOverview | null;
  weekly: WeeklyEntry[] | null;
  subjects: SubjectAnalytics[] | null;
  weakStrong: WeakStrongAreas | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function usePerformanceAnalytics(): UsePerformanceAnalyticsResult {
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [weekly, setWeekly] = useState<WeeklyEntry[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectAnalytics[] | null>(null);
  const [weakStrong, setWeakStrong] = useState<WeakStrongAreas | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAll = useCallback(async () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(false);

    try {
      const [overviewRes, weeklyRes, subjectsRes, weakStrongRes] = await Promise.all([
        api.get('/api/performance/overview', { signal: controller.signal }),
        api.get('/api/performance/weekly', { signal: controller.signal }),
        api.get('/api/performance/subjects', { signal: controller.signal }),
        api.get('/api/performance/weak-strong', { signal: controller.signal }),
      ]);

      if (!controller.signal.aborted) {
        setOverview(overviewRes.data.data);
        setWeekly(weeklyRes.data.data);
        setSubjects(subjectsRes.data.data);
        setWeakStrong(weakStrongRes.data.data);
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
    fetchAll();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchAll]);

  return { overview, weekly, subjects, weakStrong, isLoading, error, refetch: fetchAll };
}
