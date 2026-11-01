import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { ResultRow } from '@/components/test/ResultRow';

interface RecentResultsProps {
  language: 'hi' | 'en';
}

interface ResultItem {
  attemptId: string;
  testId: string;
  testTitleEn: string;
  testTitleHi: string;
  score: number;
  totalQuestions: number;
  correctCount?: number;
  wrongCount?: number;
  marks?: number;
  maxMarks?: number;
  negativeMarkingRatio?: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

/**
 * RecentResults — Last 3 test results with score, pass/fail, time ago.
 */
export function RecentResults({ language }: RecentResultsProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<ResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    api.get('/api/dashboard/recent-results', { signal: controller.signal })
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res.data?.data ?? []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => { controller.abort(); };
  }, []);

  if (isLoading) {
    return (
      <div className="p-card p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-primary-50 rounded-full w-1/3" />
          <div className="h-12 bg-primary-50 rounded-2xl w-full" />
          <div className="h-12 bg-primary-50 rounded-2xl w-full" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-card p-4 flex flex-col">
        <h3 className="p-title text-[14px] mb-2">
          {language === 'hi' ? 'हाल के परिणाम' : 'Recent Results'}
        </h3>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
          <span className="text-3xl" aria-hidden="true">📝</span>
          <p className="text-xs text-gray-500">
            {language === 'hi' ? 'अभी तक कोई टेस्ट पूरा नहीं किया' : 'No tests completed yet'}
          </p>
          <button
            onClick={() => navigate('/tests')}
            className="mt-1 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold"
          >
            {language === 'hi' ? 'पहला टेस्ट दें' : 'Take your first test'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="p-title text-[14px]">
          {language === 'hi' ? 'हाल के परिणाम' : 'Recent Results'}
        </h3>
        <button
          onClick={() => navigate('/tests/my-results?sort=recent')}
          className="text-[11px] font-semibold text-primary-400"
        >
          {language === 'hi' ? 'सभी देखें' : 'View All'} ›
        </button>
      </div>

      {/* Results list */}
      <div className="space-y-2">
        {data.map((item) => (
          <ResultRow key={item.attemptId} item={item} language={language} />
        ))}
      </div>
    </div>
  );
}
