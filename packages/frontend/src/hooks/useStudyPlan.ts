import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';

export interface StudyPlanSubject {
  id: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
  status: 'locked' | 'active' | 'completed';
  topicCount: number;
  completedTopicCount: number;
  progress: number;
}

export interface StudyPlanTopic {
  id: string;
  nameEn: string;
  nameHi: string;
  displayOrder: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  bestAccuracy: number | null;
  attemptsCount: number;
  completedAt: string | null;
}

export interface StudyPlan {
  examId: string;
  examName: string;
  totalSubjects: number;
  completedSubjects: number;
  totalTopics: number;
  completedTopics: number;
  overallProgress: number;
  subjects: StudyPlanSubject[];
}

export interface UseStudyPlanResult {
  plan: StudyPlan | null;
  isLoading: boolean;
  error: boolean;
  initialize: (examId: string) => Promise<void>;
  startTopic: (topicId: string) => Promise<void>;
  completeTopic: (topicId: string, accuracy: number) => Promise<void>;
  refetch: () => void;
  fetchTopics: (subjectId: string) => Promise<StudyPlanTopic[]>;
}

export function useStudyPlan(): UseStudyPlanResult {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
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
      const response = await api.get('/api/study-plan', {
        signal: controller.signal,
        timeout: 15_000,
      });
      if (!controller.signal.aborted) {
        setPlan(response.data.data ?? null);
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

  const initialize = useCallback(async (examId: string) => {
    await api.post('/api/study-plan/initialize', { examId });
    fetch();
  }, [fetch]);

  const startTopic = useCallback(async (topicId: string) => {
    await api.post(`/api/study-plan/topic/${topicId}/start`);
    fetch();
  }, [fetch]);

  const completeTopic = useCallback(async (topicId: string, accuracy: number) => {
    await api.post(`/api/study-plan/topic/${topicId}/complete`, { accuracy });
    fetch();
  }, [fetch]);

  const fetchTopics = useCallback(async (subjectId: string): Promise<StudyPlanTopic[]> => {
    const response = await api.get(`/api/study-plan/topics/${subjectId}`, {
      timeout: 15_000,
    });
    return response.data.data ?? [];
  }, []);

  return { plan, isLoading, error, initialize, startTopic, completeTopic, refetch: fetch, fetchTopics };
}
