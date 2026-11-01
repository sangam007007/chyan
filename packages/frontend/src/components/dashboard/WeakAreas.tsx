import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeakAreas } from '@/hooks/useWeakAreas';

interface WeakAreasProps {
  language: 'hi' | 'en';
}

/**
 * WeakAreas — Subject + Topic level weak areas with practice buttons & improvement tracking.
 * Priority: 🔴 <50%, 🟡 50-70%
 */
export function WeakAreas({ language }: WeakAreasProps) {
  const { data, isLoading } = useWeakAreas();
  const navigate = useNavigate();
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="p-card p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-primary-50 rounded-full w-1/3" />
          <div className="h-3 bg-primary-50 rounded-full w-full" />
          <div className="h-3 bg-primary-50 rounded-full w-3/4" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-card p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="p-title text-[14px]">
            {language === 'hi' ? 'कमज़ोर क्षेत्र' : 'Weak Areas'}
          </h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <span className="text-2xl mb-2 block">🎉</span>
          <p className="text-xs text-primary font-semibold">
            {language === 'hi' ? 'शानदार! कोई कमज़ोर क्षेत्र नहीं।' : 'Great job! No weak areas detected.'}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {language === 'hi' ? 'सभी विषयों में 70%+ सटीकता' : 'All subjects above 70% accuracy'}
          </p>
        </div>
      </div>
    );
  }

  const getPriorityColor = (accuracy: number) => {
    if (accuracy < 50) return { dot: 'bg-accent', bg: 'bg-gradient-to-r from-accent-50 to-white', border: 'border-accent-100', bar: 'bg-gradient-to-r from-accent-500 to-accent-200', text: 'text-accent-600' };
    return { dot: 'bg-secondary', bg: 'bg-gradient-to-r from-secondary-50 to-white', border: 'border-secondary-100', bar: 'bg-gradient-to-r from-secondary-500 to-secondary-200', text: 'text-secondary-600' };
  };

  return (
    <div className="p-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="p-title text-[14px]">
          {language === 'hi' ? 'कमज़ोर क्षेत्र' : 'Weak Areas'}
        </h3>
        <button
          onClick={() => navigate('/progress')}
          className="text-[11px] font-semibold text-primary-400"
        >
          {language === 'hi' ? 'विश्लेषण' : 'Analysis'} ›
        </button>
      </div>
      <p className="p-sub mb-3">
        {language === 'hi' ? 'विषय और टॉपिक जिनमें सटीकता 70% से कम है' : 'Subjects & topics where accuracy is below 70%'}
      </p>

      {/* Subject items */}
      <div className="space-y-3">
        {data.map((area, i) => {
          const colors = getPriorityColor(area.accuracy);
          const isExpanded = expandedSubject === i;
          const topics = area.topics || [];

          return (
            <div key={i} className={`rounded-2xl border ${colors.border} ${colors.bg} p-3`}>
              {/* Subject row */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedSubject(isExpanded ? null : i)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`} />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-primary">
                      {language === 'hi' ? area.subjectHi : area.subjectEn}
                    </span>
                    <p className="text-[10px] text-gray-500">
                      {language === 'hi'
                        ? `${area.incorrectCount} गलत / ${area.totalQuestions} प्रश्न`
                        : `${area.incorrectCount} wrong / ${area.totalQuestions} questions`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-extrabold tabular-nums ${colors.text}`}>{area.accuracy}%</span>
                  {topics.length > 0 && (
                    <span className="text-[9px] text-primary-300">{isExpanded ? '▲' : '▼'}</span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-2 bg-white rounded-full overflow-hidden border border-primary-50">
                <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${area.accuracy}%` }} />
              </div>

              {/* Expanded topics */}
              {isExpanded && topics.length > 0 && (
                <div className="mt-3 space-y-2.5 pl-3 border-l-2 border-primary-100 ml-1">
                  {topics.map((topic) => {
                    const topicColors = getPriorityColor(topic.accuracy);
                    const diff = topic.previousAccuracy !== null ? topic.accuracy - topic.previousAccuracy : null;

                    return (
                      <div key={topic.topicId} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${topicColors.dot}`} />
                          <div className="truncate">
                            <span className="text-[11px] font-medium text-gray-700 truncate">
                              {language === 'hi' ? topic.topicHi : topic.topicEn}
                            </span>
                            <span className="text-[9px] text-accent-400 ml-1">
                              {topic.incorrectCount}/{topic.totalQuestions}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[11px] font-bold tabular-nums ${topicColors.text}`}>{topic.accuracy}%</span>
                          {/* Improvement indicator */}
                          {diff !== null && (
                            <span className={`text-[9px] font-bold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-accent-500' : 'text-gray-400'}`}>
                              {diff > 0 ? `↑${diff}` : diff < 0 ? `↓${Math.abs(diff)}` : '→'}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/study-plan/topic/${topic.topicId}`); }}
                            className="px-2.5 py-1 text-[9px] font-bold text-white bg-primary rounded-lg shadow-sm active:scale-95 transition-transform"
                          >
                            {language === 'hi' ? 'अभ्यास' : 'Practice'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* If no topics, show practice at subject level */}
              {topics.length === 0 && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate('/tests'); }}
                    className="px-3 py-1.5 text-[10px] font-bold text-white bg-primary rounded-xl shadow-sm active:scale-95 transition-transform"
                  >
                    {language === 'hi' ? 'अभ्यास करें' : 'Practice'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
