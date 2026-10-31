import { useNavigate } from 'react-router-dom';
import { useDailyQuiz } from '@/hooks/useDailyQuiz';

interface DailyChallengeBarProps {
  language: 'hi' | 'en';
}

/**
 * DailyChallengeBar — Shows daily challenge quiz status on dashboard.
 * States: Not Started → Start Challenge, In Progress → Continue, Completed → Score
 */
export function DailyChallengeBar({ language }: DailyChallengeBarProps) {
  const { status, isLoading } = useDailyQuiz();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-card p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-primary-50 rounded-full w-1/3" />
          <div className="h-2.5 bg-primary-50 rounded-full w-full" />
        </div>
      </div>
    );
  }

  const quizStatus = status?.status ?? 'not_started';
  const score = status?.attempt?.score ?? status?.score ?? null;
  const passed = score !== null ? score >= 6 : false;

  return (
    <div className="p-card p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full bg-secondary/15 blur-2xl" />
      <div className="relative flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-secondary-200 to-secondary flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(197,160,40,0.9)]">
            <span className="text-xl">🎯</span>
          </div>
          <div className="min-w-0">
            <h3 className="p-title text-[14px] truncate">
              {language === 'hi' ? 'दैनिक चुनौती' : 'Daily Challenge'}
            </h3>
            <p className="p-sub truncate">
              {language === 'hi'
                ? '10 प्रश्न • 5 मिनट • 60% पास'
                : '10 Questions • 5 Min • 60% to Pass'}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        {quizStatus === 'not_started' && (
          <span className="p-chip-gold shrink-0">
            {language === 'hi' ? 'पुरस्कार: 🪙 20' : 'Reward: 🪙 20'}
          </span>
        )}
        {quizStatus === 'in_progress' && (
          <span className="p-chip shrink-0">
            {language === 'hi' ? 'जारी' : 'In Progress'}
          </span>
        )}
        {quizStatus === 'completed' && (
          <span className={`inline-flex items-center rounded-full text-[10px] font-bold px-2.5 py-1 shrink-0 ${
            passed ? 'text-green-700 bg-success/15' : 'text-accent-600 bg-accent-50'
          }`}>
            {passed
              ? (language === 'hi' ? '✅ पास' : '✅ Passed')
              : (language === 'hi' ? '❌ फेल' : '❌ Failed')}
          </span>
        )}
      </div>

      {/* Content based on status */}
      {quizStatus === 'not_started' && (
        <button
          onClick={() => navigate('/daily-challenge')}
          className="p-btn w-full !py-3"
        >
          {language === 'hi' ? 'चुनौती शुरू करें' : 'Start Challenge'}
        </button>
      )}

      {quizStatus === 'in_progress' && (
        <button
          onClick={() => navigate('/daily-challenge')}
          className="p-btn w-full !py-3"
        >
          {language === 'hi' ? 'जारी रखें' : 'Continue'}
        </button>
      )}

      {quizStatus === 'completed' && score !== null && (
        <div className="relative">
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary tabular-nums leading-none">{score}<span className="text-base text-gray-400 font-bold">/10</span></span>
              {passed && (
                <span className="p-chip-gold">+🪙 20</span>
              )}
            </div>
            <button
              onClick={() => navigate('/daily-challenge')}
              className="p-btn-ghost !py-2"
            >
              {language === 'hi' ? 'परिणाम देखें' : 'View Result'}
            </button>
          </div>
          <div className="h-2 rounded-full bg-primary-50 mt-3 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${passed ? 'from-success to-green-300' : 'from-accent-500 to-accent-200'}`} style={{ width: `${Math.min(100, score * 10)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
