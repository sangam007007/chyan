import { useTranslation } from '@/i18n';

// --- Types ---

export interface QuestionNavigationPanelProps {
  totalQuestions: number;
  answers: { selectedOption: number | null; markedForReview: boolean }[];
  currentQuestionIndex: number;
  onNavigate: (index: number) => void;
}

/**
 * QuestionNavigationPanel — Numbered grid showing question states.
 *
 * Color coding:
 * - Answered: green tint
 * - Unanswered: navy tint
 * - Marked for review: gold tint
 * - Current question: solid navy
 *
 * Includes a legend explaining each color.
 *
 * Requirements: 4.3
 */
export function QuestionNavigationPanel({
  totalQuestions,
  answers,
  currentQuestionIndex,
  onNavigate,
}: QuestionNavigationPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="p-card p-4">
      <p className="p-title mb-3">
        {t('testAttempt.questionNav')}
      </p>

      {/* Question Grid */}
      <div className="grid grid-cols-8 gap-2">
        {Array.from({ length: totalQuestions }, (_, idx) => {
          const answer = answers[idx];
          let bgClass = 'bg-primary-50 text-primary-400 border-primary-100'; // unanswered
          if (answer?.markedForReview) {
            bgClass = 'bg-secondary-100 text-secondary-700 border-secondary-300'; // marked for review
          } else if (answer?.selectedOption !== null && answer?.selectedOption !== undefined) {
            bgClass = 'bg-success/15 text-green-700 border-success/40'; // answered
          }
          if (idx === currentQuestionIndex) {
            bgClass = 'bg-primary text-secondary-200 border-primary shadow-md scale-105';
          }
          return (
            <button
              key={idx}
              onClick={() => onNavigate(idx)}
              className={`aspect-square rounded-xl border text-xs font-bold transition-transform ${bgClass}`}
              aria-label={t('testAttempt.goToQuestion', { number: String(idx + 1) })}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-primary-50">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-success/15 border border-success/40" />
          <span className="text-[11px] text-primary-500">{t('testAttempt.legendAnswered')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-primary-50 border border-primary-100" />
          <span className="text-[11px] text-primary-500">{t('testAttempt.legendUnanswered')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-secondary-100 border border-secondary-300" />
          <span className="text-[11px] text-primary-500">{t('testAttempt.legendMarkedForReview')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-md bg-primary" />
          <span className="text-[11px] text-primary-500">{t('testAttempt.legendCurrent')}</span>
        </div>
      </div>
    </div>
  );
}
