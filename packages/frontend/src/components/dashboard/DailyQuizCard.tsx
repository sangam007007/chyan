import { useEffect, useRef } from 'react';
import type { QuizStatus } from '@/hooks/useDailyQuiz';

interface DailyQuizCardProps {
  language: 'hi' | 'en';
  quizStatus: QuizStatus;
  score?: number;
  onStart: () => void;
  onReattempt: () => void;
  onViewResult: () => void;
  onMidnightRefresh?: () => void;
}

function getTimeUntilMidnightIST(): number {
  const now = new Date();
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const midnight = new Date(istNow);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - istNow.getTime();
}

/**
 * DailyQuizCard — Dynamic daily quiz CTA based on quiz status.
 * Supports bilingual rendering via `language` prop.
 * Auto-refreshes at IST midnight for new day quiz.
 */
export function DailyQuizCard({
  language,
  quizStatus,
  score,
  onStart,
  onReattempt,
  onViewResult,
  onMidnightRefresh,
}: DailyQuizCardProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Task 12.2: Midnight IST refresh
  useEffect(() => {
    if (!onMidnightRefresh) return;

    const ms = getTimeUntilMidnightIST();
    timeoutRef.current = setTimeout(() => {
      onMidnightRefresh();
    }, ms);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onMidnightRefresh]);

  const renderContent = () => {
    switch (quizStatus) {
      case 'not_started':
        return (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-gray-800">
                  {language === 'hi' ? 'दैनिक क्विज़' : 'Daily Quiz'}
                </h3>
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-100 text-red-600 rounded">
                  {language === 'hi' ? 'नया' : 'New'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                {language === 'hi' ? '10 प्रश्न, 8 मिनट' : '10 Questions, 8 Minutes'}
              </p>
            </div>
            <button
              onClick={onStart}
              className="w-full py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {language === 'hi' ? 'क्विज़ शुरू करें' : 'Start Quiz'}
            </button>
          </>
        );

      case 'in_progress':
        return (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-gray-800">
                  {language === 'hi' ? 'दैनिक क्विज़' : 'Daily Quiz'}
                </h3>
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-700 rounded">
                  {language === 'hi' ? 'जारी' : 'In Progress'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                {language === 'hi' ? 'आपकी क्विज़ जारी है' : 'Your quiz is in progress'}
              </p>
            </div>
            <button
              onClick={onStart}
              className="w-full py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {language === 'hi' ? 'क्विज़ जारी रखें' : 'Continue Quiz'}
            </button>
          </>
        );

      case 'completed':
        return (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-gray-800">
                  {language === 'hi' ? 'दैनिक क्विज़' : 'Daily Quiz'}
                </h3>
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-green-100 text-green-700 rounded">
                  {language === 'hi' ? 'पूर्ण' : 'Done'}
                </span>
              </div>
              {score != null && (
                <p className="text-xs text-gray-600 mb-4 font-semibold">
                  {language === 'hi' ? `स्कोर: ${score}/10` : `Score: ${score}/10`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onReattempt}
                className="flex-1 py-2 text-xs font-semibold border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                {language === 'hi' ? 'पुनः प्रयास' : 'Reattempt'}
              </button>
              <button
                onClick={onViewResult}
                className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {language === 'hi' ? 'परिणाम देखें' : 'View Result'}
              </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col justify-between">
      {renderContent()}
    </div>
  );
}
