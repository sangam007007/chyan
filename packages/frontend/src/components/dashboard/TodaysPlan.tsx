import { useNavigate } from 'react-router-dom';
import { useTodayPlan } from '@/hooks/useTodayPlan';

interface TodaysPlanProps {
  language: 'hi' | 'en';
}

/**
 * TodaysPlan — Study plan checklist with progress bar.
 */
export function TodaysPlan({ language }: TodaysPlanProps) {
  const { data, isLoading, error } = useTodayPlan();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-card p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-primary-50 rounded-full w-1/3" />
          <div className="h-3 bg-primary-50 rounded-full w-3/4" />
          <div className="h-3 bg-primary-50 rounded-full w-2/3" />
          <div className="h-2 bg-primary-50 rounded-full w-full mt-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-card p-4">
        <p className="text-xs text-accent-600">
          {language === 'hi' ? 'लोड करने में विफल' : 'Failed to load'}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="p-title text-[14px]">
            {language === 'hi' ? "आज की योजना" : "Today's Plan"}
          </h3>
          <button
            onClick={() => navigate('/study-plan')}
            className="text-[11px] font-semibold text-primary-400"
          >
            {language === 'hi' ? 'संपादित करें' : 'Edit'} ›
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary-50 to-white border border-primary-100 p-3">
          <div className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-xl">🗓️</div>
          <p className="text-xs text-gray-500 flex-1">
            {language === 'hi' ? 'आज के लिए कोई योजना सेट नहीं है' : 'No plan set for today'}
          </p>
        </div>
      </div>
    );
  }

  // One source of truth: the same numbers the Study tab shows (topics + tests done today)
  const totalItems = data.tasksTotal ?? data.totalCount;
  const completedItems = data.tasksDone ?? data.completedCount;
  const progressPct = data.progressPercent;

  return (
    <div className="p-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="p-title text-[14px]">
          {language === 'hi' ? "आज की योजना" : "Today's Plan"}
        </h3>
        <button
          onClick={() => navigate('/study-plan?view=true')}
          className="text-[11px] font-semibold text-primary-400"
        >
          {language === 'hi' ? 'देखें' : 'View Plan'} ›
        </button>
      </div>

      {/* Content: Subjects list LEFT + Progress circle RIGHT */}
      <div className="flex items-center gap-4">
        {/* Left: Checklist */}
        <div className="flex-1 min-w-0 space-y-2">
          {data.items.map((item) => {
            const isDone = item.completed;
            return (
              <div key={item.id} className={`flex items-center gap-2.5 rounded-2xl px-3 py-2 ${isDone ? 'bg-success/10' : 'bg-primary-50/60'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                  isDone ? 'bg-success text-white' : 'border-2 border-primary-200 bg-white'
                }`}>
                  {isDone ? '✓' : ''}
                </div>
                <span className={`text-[11px] truncate ${isDone ? 'text-green-700 font-semibold' : 'text-gray-700 font-medium'}`}>
                  {language === 'hi' ? item.subjectNameHi : item.subjectNameEn}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right: Progress circle */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="#E8EDF3" strokeWidth="5" />
              <circle cx="28" cy="28" r="24" fill="none" stroke="#C5A028" strokeWidth="5"
                strokeDasharray={`${(progressPct / 100) * 150.8} 150.8`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[12px] font-extrabold text-primary tabular-nums">{progressPct}%</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-1 tabular-nums">{completedItems}/{totalItems}</p>
        </div>
      </div>
    </div>
  );
}
