import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProgressOverview {
  syllabusCompletion: number;
  subjectsCompleted: number;
  totalSubjects: number;
  topicsCompleted: number;
  totalTopics: number;
  currentStreak: number;
  currentLevel: number;
  currentXP: number;
  nextLevelXP: number;
  xpProgress: number;
  estimatedCompletionDays: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  achieved: boolean;
  progress: number;
}

export interface DailyGoals {
  target: number;
  completed: number;
  remaining: number;
  streakDays: number;
}

export interface XPDetails {
  totalXP: number;
  currentLevel: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  recentXPGains: { amount: number; reason: string; date: string }[];
}

export interface UseProgressEngineResult {
  overview: ProgressOverview | null;
  milestones: Milestone[] | null;
  goals: DailyGoals | null;
  xp: XPDetails | null;
  isLoading: boolean;
  error: boolean;
  refetch: () => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useProgressEngine(): UseProgressEngineResult {
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [xp, setXP] = useState<XPDetails | null>(null);
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
      const [overviewRes, milestonesRes, goalsRes, xpRes] = await Promise.all([
        api.get('/api/progress/overview', { signal: controller.signal }),
        api.get('/api/progress/milestones', { signal: controller.signal }),
        api.get('/api/progress/goals', { signal: controller.signal }),
        api.get('/api/progress/xp', { signal: controller.signal }),
      ]);

      if (!controller.signal.aborted) {
        setOverview(overviewRes.data.data);
        setMilestones(milestonesRes.data.data);
        setGoals(goalsRes.data.data);
        setXP(xpRes.data.data);
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

  return { overview, milestones, goals, xp, isLoading, error, refetch: fetchAll };
}
