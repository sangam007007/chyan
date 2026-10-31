import type { StreakResponse } from '@/services/dashboard.types';

interface StreakSectionProps {
  data: StreakResponse | null;
  isLoading: boolean;
  error: boolean;
  retry: () => void;
  language: 'hi' | 'en';
}

/**
 * StreakSection — Compact streak display with connected day circles.
 * Small circles with day names connected by a line, active days highlighted green.
 */
export function StreakSection({ data, isLoading, error, retry, language }: StreakSectionProps) {
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return <ErrorFallback language={language} onRetry={retry} />;
  }

  const dayIndicators = getLast7DaysIndicators(data.streakDates);

  return (
    <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-gray-100">
      {/* Single row: streak text on left, day circles on right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-base">🔥</span>
          <span className="text-xs sm:text-sm font-bold text-gray-800 whitespace-nowrap">
            {data.currentStreak} {language === 'hi' ? 'दिनों की निरंतरता!' : 'day streak!'}
          </span>
        </div>

        {/* Inline day circles */}
        <div className="flex items-center gap-1">
          {dayIndicators.map((day, i) => (
            <div
              key={i}
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[9px] sm:text-[10px] font-bold transition-all ${
                day.active
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                  : 'bg-white border-2 border-gray-200 text-gray-400'
              }`}
            >
              {day.dayName}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Loading Skeleton ---

interface DayIndicatorData {
  active: boolean;
  dayName: string;
}
function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </div>
      <div className="flex items-center justify-between px-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-7 h-7 rounded-full bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

// --- Error Fallback ---
function ErrorFallback({ language, onRetry }: { language: 'hi' | 'en'; onRetry: () => void }) {
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <span className="text-sm font-bold text-gray-800">0 {language === 'hi' ? 'दिन' : 'days'}</span>
        </div>
        <button
          onClick={onRetry}
          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
        >
          {language === 'hi' ? 'पुनः प्रयास' : 'Retry'}
        </button>
      </div>
      <div className="relative flex items-center justify-between px-1">
        <div className="absolute top-[14px] left-[16px] right-[16px] h-[2px] bg-gray-200 z-0" />
        {dayNames.map((day, i) => (
          <div key={i} className="relative z-10 flex flex-col items-center">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-white border-2 border-gray-200 text-gray-400">
              {day}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Utility ---
function getLast7DaysIndicators(streakDates: string[]): DayIndicatorData[] {
  const today = new Date();
  const streakSet = new Set(streakDates);
  const indicators: DayIndicatorData[] = [];
  const dayNamesShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const isoDate = date.toISOString().split('T')[0];
    indicators.push({
      active: streakSet.has(isoDate),
      dayName: dayNamesShort[date.getDay()],
    });
  }

  return indicators;
}
