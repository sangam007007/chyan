import { useNavigate } from 'react-router-dom';
import { useContinueLearning } from '@/hooks/useContinueLearning';

interface ContinueLearningProps {
  language: 'hi' | 'en';
}

/**
 * ContinueLearning — Card showing current topic with progress and continue button.
 * Green gradient background with decorative elements.
 */
export function ContinueLearning({ language }: ContinueLearningProps) {
  const { data, isLoading } = useContinueLearning();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-3xl p-4 text-white bg-gradient-to-br from-primary-700 via-primary to-primary-400 shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)]">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/20 rounded w-1/3" />
          <div className="h-3 bg-white/20 rounded w-1/2" />
          <div className="h-1.5 bg-white/20 rounded w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="relative overflow-hidden rounded-3xl p-4 text-white bg-gradient-to-br from-primary-700 via-primary to-primary-400 shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)]">
        <div className="pointer-events-none absolute -right-8 -top-8 w-32 h-32 rounded-full bg-secondary/25 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-12 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <h3 className="text-[14px] font-extrabold mb-2 tracking-tight">
            {language === 'hi' ? 'पढ़ाई जारी रखें' : 'Continue Learning'}
          </h3>
          <p className="text-xs text-white/80">
            {language === 'hi'
              ? 'प्रगति देखने के लिए विषय परीक्षा शुरू करें'
              : 'Start a subject test to see progress here'}
          </p>
        </div>
      </div>
    );
  }

  // The ring shows how much of the topic is done (matches the topic page), not the last test's score.
  const progressPct = data.progressPercent ?? data.accuracyPercent;
  const hi = language === 'hi';

  return (
    <div className="relative overflow-hidden rounded-3xl p-4 text-white bg-gradient-to-br from-primary-700 via-primary to-primary-400 shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)]">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-8 -top-8 w-32 h-32 rounded-full bg-secondary/25 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-12 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <h3 className="text-[14px] font-extrabold tracking-tight">
          {language === 'hi' ? 'पढ़ाई जारी रखें' : 'Continue Learning'}
        </h3>
        <button
          onClick={() => navigate('/study-plan#subjects')}
          className="text-[11px] font-semibold text-secondary-200"
        >
          {language === 'hi' ? 'सभी देखें' : 'View All'} ›
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex items-center gap-3">
        {/* Left: Subject + Topic info */}
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-semibold text-secondary-200 mb-1 ${language === 'hi' ? '' : 'uppercase tracking-[0.14em]'}`}>
            {language === 'hi' ? data.subjectNameHi : data.subjectNameEn}
          </p>
          <p className="text-[15px] font-bold text-white leading-tight mb-1 truncate">
            {language === 'hi' ? data.topicNameHi : data.topicNameEn}
          </p>
          {data.totalParts !== undefined && (
            <p className="text-[10px] text-white/70 mb-3 tabular-nums">
              {hi ? 'भाग' : 'Parts'} {data.completedParts ?? 0}/{data.totalParts}
              {' · '}
              {hi ? 'टेस्ट' : 'Tests'} {data.completedTests ?? 0}/{data.totalTests ?? 0}
              {' · '}
              {hi ? 'पिछला टेस्ट' : 'Last test'} {data.lastScorePercent ?? data.accuracyPercent}%
            </p>
          )}
          <button
            onClick={() => navigate(`/study-plan/topic/${data.topicId}`)}
            className="p-btn !py-2 !px-4"
          >
            {language === 'hi' ? 'जारी रखें' : 'Continue'}
          </button>
        </div>

        {/* Right: Circular progress */}
        <div className="flex-shrink-0 relative w-[72px] h-[72px]">
          <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <circle cx="28" cy="28" r="24" fill="none" stroke="#E7C345" strokeWidth="5"
              strokeDasharray={`${(progressPct / 100) * 150.8} 150.8`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[13px] font-extrabold text-white tabular-nums">{progressPct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
