import { Link } from 'react-router-dom';

interface ContinueSectionProps {
  language: 'hi' | 'en';
}

interface InProgressTest {
  testId: string;
  attemptId: string;
  title: string;
  progress: number; // 0–100
}

// Mock data — will be connected to API later
const MOCK_IN_PROGRESS: InProgressTest = {
  testId: 'test-5',
  attemptId: 'attempt-1',
  title: 'CTET पूर्ण मॉक टेस्ट - 5',
  progress: 45,
};

/**
 * ContinueSection — Shows the last incomplete test with progress bar.
 * Only renders if there's an in-progress test attempt.
 */
export function ContinueSection({ language }: ContinueSectionProps) {
  // In the future, this will come from an API hook
  const inProgressTest: InProgressTest | null = MOCK_IN_PROGRESS;

  if (!inProgressTest) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
        <span className="text-base">▶️</span>
        {language === 'hi' ? 'कंटिन्यू करें' : 'Continue'}
      </h3>

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 truncate mb-2">
            {inProgressTest.title}
          </p>
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${inProgressTest.progress}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {inProgressTest.progress}% {language === 'hi' ? 'पूर्ण' : 'complete'}
          </p>
        </div>

        <Link
          to={`/tests/${inProgressTest.testId}/attempt`}
          className="shrink-0 px-3 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
        >
          {language === 'hi' ? 'रिज्यूम करें →' : 'Resume →'}
        </Link>
      </div>
    </div>
  );
}
