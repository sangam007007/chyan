import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { marksFormula } from '@/components/test/MarkingInfo';

export interface ResultRowItem {
  attemptId: string;
  testId: string;
  testTitleEn: string;
  testTitleHi: string;
  totalQuestions: number;
  correctCount?: number;
  wrongCount?: number;
  negativeMarkingRatio?: number;
  score?: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

export function timeAgo(dateStr: string, language: 'hi' | 'en'): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return language === 'hi' ? 'अभी' : 'Just now';
  if (diffMin < 60) return language === 'hi' ? `${diffMin} मिनट पहले` : `${diffMin}m ago`;
  if (diffHr < 24) return language === 'hi' ? `${diffHr} घंटे पहले` : `${diffHr}h ago`;
  if (diffDay === 1) return language === 'hi' ? 'कल' : 'Yesterday';
  return language === 'hi' ? `${diffDay} दिन पहले` : `${diffDay}d ago`;
}

/**
 * One finished attempt: pass/fail tile, title, percentage, correct/wrong and an ⓘ that explains how the
 * percentage was calculated. Shared by Dashboard > Recent Results and Test > My Results.
 */
export function ResultRow({
  item,
  language,
  subtitle,
  tag,
}: {
  item: ResultRowItem;
  language: 'hi' | 'en';
  /** Second line under the title; defaults to "time ago" */
  subtitle?: string;
  /** Small pill before the subtitle, e.g. the kind of test */
  tag?: { label: string; cls: string };
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const hi = language === 'hi';
  const hasBreakdown = item.correctCount !== undefined && item.wrongCount !== undefined;

  return (
    <div className="rounded-2xl bg-primary-50/50 overflow-hidden">
      <div
        className="flex items-center justify-between p-2.5 cursor-pointer active:bg-primary-50 transition-colors"
        onClick={() => navigate(`/tests/${item.testId}/results/${item.attemptId}`)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`w-10 h-10 flex items-center justify-center rounded-2xl text-sm font-extrabold shrink-0 text-white shadow-sm ${
            item.passed ? 'bg-gradient-to-br from-success to-green-400' : 'bg-gradient-to-br from-accent to-accent-300'
          }`}>
            {item.passed ? '✓' : '✗'}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{hi ? item.testTitleHi : item.testTitleEn}</p>
            <p className="flex items-center gap-1.5 text-[10px] text-gray-400 min-w-0">
              {tag && <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${tag.cls}`}>{tag.label}</span>}
              <span className="truncate">{subtitle ?? timeAgo(item.submittedAt, language)}</span>
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2">
          <p className={`text-sm font-extrabold tabular-nums ${item.passed ? 'text-green-600' : 'text-accent-600'}`}>
            {item.percentage}%
          </p>
          {hasBreakdown ? (
            <button
              type="button"
              aria-expanded={open}
              aria-label={hi ? 'यह प्रतिशत कैसे बना' : 'How this percentage is calculated'}
              onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
              className="text-[10px] text-gray-500 tabular-nums inline-flex items-center gap-1"
            >
              <span className="text-green-600">{item.correctCount}✓</span>
              <span className="text-accent-600">{item.wrongCount}✗</span>
              <span className={`w-3.5 h-3.5 rounded-full border text-[8px] font-bold flex items-center justify-center ${open ? 'bg-primary text-white border-primary' : 'border-primary-300 text-primary-400'}`}>i</span>
            </button>
          ) : (
            <p className="text-[10px] text-gray-400 tabular-nums">{item.score ?? 0}/{item.totalQuestions}</p>
          )}
        </div>
      </div>
      {open && hasBreakdown && (
        <div className="mx-2.5 mb-2.5 rounded-xl bg-white border border-primary-100 px-3 py-2 text-[10px] leading-snug text-gray-600">
          <p className="font-bold text-primary mb-0.5">{hi ? 'यह % कैसे बना?' : 'How is this % calculated?'}</p>
          <p>
            {marksFormula({
              correct: item.correctCount ?? 0,
              wrong: item.wrongCount ?? 0,
              ratio: item.negativeMarkingRatio,
              totalQuestions: item.totalQuestions,
              percentage: item.percentage,
              isHi: hi,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
