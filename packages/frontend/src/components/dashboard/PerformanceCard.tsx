import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

interface PerformanceCardProps {
  language: 'hi' | 'en';
}

const PERIODS = ['This Week', 'Last Week', 'Last Month', '6 Months', 'All Time'] as const;
const PERIODS_HI = ['इस सप्ताह', 'पिछला सप्ताह', 'पिछला महीना', '6 महीने', 'सभी'] as const;
const PERIOD_PARAMS = ['week', 'last_week', 'month', '6months', 'all'] as const;

// What each period is compared with (always the window right before it, of the same length)
const COMPARE_LABEL_EN = ['vs last week (same days)', 'vs the week before', 'vs the previous 30 days', 'vs the previous 6 months', ''] as const;
const COMPARE_LABEL_HI = ['पिछले सप्ताह के उन्हीं दिनों से', 'उससे पहले के सप्ताह से', 'पिछले 30 दिनों से', 'पिछले 6 महीनों से', ''] as const;

interface Bucket { start: string; accuracy: number | null; attempted: number }

interface PerfData {
  attempted: number;
  correct: number;
  wrong: number;
  accuracy: number;
  comparison: {
    previous: { attempted: number; correct: number; accuracy: number } | null;
    delta: number | null;
    attemptedDelta: number | null;
    minQuestions: number;
  };
  chart: { kind: 'day' | 'bucket' | 'month'; buckets: Bucket[] };
  weakestSubject: { subjectId: string; nameEn: string; nameHi: string; accuracy: number } | null;
  bestWeek: { weekStart: string; accuracy: number; attempted: number } | null;
}

const STEADY = 2; // changes of up to 2 points are noise

const barColor = (a: number) => (a >= 70 ? 'bg-success' : a >= 40 ? 'bg-secondary' : 'bg-accent-400');

/**
 * PerformanceCard — accuracy for the chosen period, compared with the period right before it.
 * One arrow only, and it always follows the dropdown.
 */
export function PerformanceCard({ language }: PerformanceCardProps) {
  const navigate = useNavigate();
  const hi = language === 'hi';
  const locale = hi ? 'hi-IN' : 'en-IN';
  const [activePeriod, setActivePeriod] = useState(0); // default: This Week
  const [cache, setCache] = useState<Record<string, PerfData>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const periodKey = PERIOD_PARAMS[activePeriod];
  const data = cache[periodKey] ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    api.get(`/api/dashboard/performance?period=${periodKey}`)
      .then((res) => {
        const d = res.data?.data;
        if (!cancelled && d) setCache((c) => ({ ...c, [periodKey]: d }));
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodKey]);

  if (!data && loading) {
    return (
      <div className="p-card p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-primary-50 rounded-full w-1/3" />
          <div className="h-16 bg-primary-50 rounded-full w-16 mx-auto" />
          <div className="h-3 bg-primary-50 rounded-full w-full" />
          <div className="h-3 bg-primary-50 rounded-full w-3/4" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-card p-4">
        <h3 className="p-title text-[14px] mb-2">{hi ? 'प्रदर्शन' : 'Performance'}</h3>
        <p className="text-xs text-gray-500">
          {failed
            ? (hi ? 'लोड करने में विफल' : 'Failed to load')
            : (hi ? 'डेटा देखने के लिए टेस्ट दें' : 'Take tests to see data')}
        </p>
      </div>
    );
  }

  const { comparison: cmp, chart } = data;
  const isAll = periodKey === 'all';
  const accuracy = data.accuracy;
  const ringColor = accuracy >= 70 ? '#2ECC71' : accuracy >= 40 ? '#C5A028' : '#E63946';
  const compareLabel = (hi ? COMPARE_LABEL_HI : COMPARE_LABEL_EN)[activePeriod];
  // What the numbers above the bars mean (written once, so it is clear they are accuracy %)
  const chartTitle = chart.kind === 'day'
    ? (hi ? 'दिन के हिसाब से सटीकता (%)' : 'Accuracy per day (%)')
    : periodKey === 'month'
      ? (hi ? 'हर 6 दिन की सटीकता (%)' : 'Accuracy per 6 days (%)')
      : periodKey === '6months'
        ? (hi ? 'हर 30 दिन की सटीकता (%)' : 'Accuracy per 30 days (%)')
        : (hi ? 'महीने के हिसाब से सटीकता (%)' : 'Accuracy per month (%)');
  const subjectName = data.weakestSubject ? (hi ? data.weakestSubject.nameHi : data.weakestSubject.nameEn) : '';

  const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });
  const bucketLabel = (b: Bucket) =>
    chart.kind === 'day' ? fmtDay(b.start, { weekday: 'short' })
      : chart.kind === 'month' ? fmtDay(b.start, { month: 'short' })
        : fmtDay(b.start, { day: 'numeric', month: 'short' });

  // ── the single comparison pill ──
  let pill: { cls: string; text: string } | null = null;
  if (!isAll) {
    if (cmp.delta === null) {
      pill = {
        cls: 'bg-primary-50 text-primary-400',
        text: hi ? 'तुलना के लिए अभी पर्याप्त डेटा नहीं' : 'Not enough data to compare yet',
      };
    } else if (Math.abs(cmp.delta) <= STEADY) {
      pill = { cls: 'bg-primary-50 text-primary-500', text: `→ ${hi ? 'स्थिर' : 'Steady'} ${compareLabel}` };
    } else if (cmp.delta > 0) {
      pill = { cls: 'bg-success/10 text-green-700', text: `↑ +${cmp.delta} ${hi ? 'अंक' : 'pts'} ${compareLabel}` };
    } else {
      pill = { cls: 'bg-accent-50 text-accent-600', text: `↓ ${cmp.delta} ${hi ? 'अंक' : 'pts'} ${compareLabel}` };
    }
  } else if (data.bestWeek) {
    pill = {
      cls: 'bg-secondary-50 text-secondary-700',
      text: `🏆 ${hi ? 'सर्वश्रेष्ठ सप्ताह' : 'Best week'}: ${fmtDay(data.bestWeek.weekStart, { day: 'numeric', month: 'short' })} · ${data.bestWeek.accuracy}%`,
    };
  }

  // effort: did the student practise more or less than before?
  const effort = cmp.attemptedDelta !== null && cmp.previous && cmp.previous.attempted > 0 && cmp.attemptedDelta !== 0
    ? `${cmp.attemptedDelta > 0 ? '+' : '−'}${Math.abs(cmp.attemptedDelta)} ${hi ? 'प्रश्न' : 'questions'}`
    : null;

  // ── one sentence of advice ──
  let insight: string;
  const d = cmp.delta;
  if (data.attempted === 0) {
    insight = hi ? 'इस अवधि में कोई टेस्ट नहीं दिया। आज एक टेस्ट दें!' : 'No tests in this period. Take one today!';
  } else if (isAll) {
    insight = data.weakestSubject
      ? (hi ? `${subjectName} सबसे कमज़ोर है (${data.weakestSubject.accuracy}%)।` : `${subjectName} is your weakest subject (${data.weakestSubject.accuracy}%).`)
      : (hi ? 'सभी विषयों में अच्छा संतुलन है। बने रहें!' : 'Nicely balanced across subjects. Keep going!');
  } else if (d === null) {
    insight = hi ? 'ट्रेंड देखने के लिए और टेस्ट दें।' : 'Take a few more tests to see your trend.';
  } else if (d > STEADY) {
    insight = (cmp.attemptedDelta ?? 0) >= 0
      ? (hi ? `सटीकता ${d} अंक बढ़ी और आपने ज़्यादा अभ्यास किया। शाबाश! 🎉` : `Accuracy is up ${d} pts and you practised more. Keep it up! 🎉`)
      : (hi ? `सटीकता ${d} अंक बढ़ी, पर प्रश्न कम हल हुए। थोड़ा और अभ्यास करें।` : `Accuracy is up ${d} pts, but you answered fewer questions. Practise a little more.`);
  } else if (d < -STEADY) {
    insight = data.weakestSubject
      ? (hi ? `सटीकता ${Math.abs(d)} अंक गिरी। ${subjectName} पर ध्यान दें।` : `Accuracy dipped ${Math.abs(d)} pts. ${subjectName} needs attention.`)
      : (hi ? `सटीकता ${Math.abs(d)} अंक गिरी। कमज़ोर टॉपिक दोहराएं।` : `Accuracy dipped ${Math.abs(d)} pts. Revise your weak topics.`);
  } else {
    insight = data.weakestSubject
      ? (hi ? `स्थिर है। ${subjectName} पर थोड़ा ज़ोर दें।` : `Holding steady. Give ${subjectName} a little extra time.`)
      : (hi ? 'स्थिर है। अगले स्तर के लिए और प्रश्न हल करें।' : 'Holding steady. Answer more questions to move up.');
  }

  return (
    <div
      className="p-card p-4 cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => navigate('/progress')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/progress'); }}
    >
      {/* Header with Period Dropdown */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="p-title text-[14px]">{hi ? 'प्रदर्शन' : 'Performance'}</h3>
        <select
          value={activePeriod}
          onChange={(e) => { e.stopPropagation(); setActivePeriod(Number(e.target.value)); }}
          onClick={(e) => e.stopPropagation()}
          aria-label={hi ? 'अवधि चुनें' : 'Choose period'}
          className="text-[10px] pl-2.5 pr-6 py-1.5 rounded-xl border border-primary-100 bg-primary-50/70 text-primary font-semibold focus:outline-none focus:ring-2 focus:ring-secondary appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%231B3A5C' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
        >
          {(hi ? PERIODS_HI : PERIODS).map((p, i) => (
            <option key={i} value={i}>{p}</option>
          ))}
        </select>
      </div>

      <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        {/* The one comparison pill (+ effort) */}
        {(pill || effort) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {pill && <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${pill.cls}`}>{pill.text}</span>}
            {effort && <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary-50 text-primary-500 tabular-nums">{effort}</span>}
          </div>
        )}

        {/* Accuracy Circle + Stats */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="27" fill="none" stroke="#E8EDF3" strokeWidth="6" />
              <circle cx="32" cy="32" r="27" fill="none" stroke={ringColor} strokeWidth="6"
                strokeDasharray={`${(accuracy / 100) * 169.6} 169.6`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base font-black text-primary tabular-nums leading-none">{accuracy}%</span>
              <span className="text-[8px] text-gray-400 mt-0.5">{hi ? 'सटीकता' : 'Accuracy'}</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-1.5">
            <div className="bg-success/10 rounded-2xl px-2 py-2 text-center">
              <p className="text-base font-extrabold text-green-700 tabular-nums leading-tight">{data.correct}</p>
              <p className="text-[9px] text-green-600">{hi ? 'सही' : 'Correct'}</p>
            </div>
            <div className="bg-accent-50 rounded-2xl px-2 py-2 text-center">
              <p className="text-base font-extrabold text-accent-600 tabular-nums leading-tight">{data.wrong}</p>
              <p className="text-[9px] text-accent-500">{hi ? 'गलत' : 'Wrong'}</p>
            </div>
            <div className="bg-primary-50 rounded-2xl px-2 py-2 text-center col-span-2">
              <p className="text-base font-extrabold text-primary tabular-nums leading-tight">{data.attempted}</p>
              <p className="text-[9px] text-primary-400">{hi ? 'कुल प्रयास' : 'Total Attempted'}</p>
            </div>
          </div>
        </div>

        {/* Chart that follows the dropdown */}
        <div className="mt-4">
          <p className="text-[10px] font-semibold text-gray-500 mb-1.5">{chartTitle}</p>
          <div className="flex items-end gap-1.5 h-14" aria-hidden="true">
            {chart.buckets.map((b) => (
              <div key={b.start} className="flex-1 h-full flex flex-col items-center justify-end">
                {b.accuracy !== null ? (
                  <>
                    {chart.buckets.length <= 8 && <span className="text-[8px] font-bold text-gray-500 tabular-nums mb-0.5">{b.accuracy}</span>}
                    <div className={`w-full rounded-t-md ${barColor(b.accuracy)}`} style={{ height: `${Math.max(6, b.accuracy)}%` }} />
                  </>
                ) : (
                  <div className="w-full h-1 rounded-full bg-primary-100" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1">
            {chart.buckets.map((b) => (
              <span key={b.start} className="flex-1 text-center text-[8px] text-gray-400 truncate">{bucketLabel(b)}</span>
            ))}
          </div>
        </div>

        {/* One sentence of advice */}
        <div className="mt-3 flex items-start justify-between gap-2 rounded-2xl bg-primary-50/60 px-3 py-2">
          <p className="text-[11px] leading-snug text-gray-700">{insight}</p>
          {data.weakestSubject && !isAll && (cmp.delta === null || cmp.delta <= STEADY) && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/study-plan/subject/${data.weakestSubject!.subjectId}`); }}
              className="shrink-0 px-2.5 py-1 rounded-xl bg-primary text-white text-[10px] font-semibold active:scale-95 transition-transform"
            >
              {hi ? 'सुधारें' : 'Fix'} ›
            </button>
          )}
        </div>
      </div>

      {/* View Details link */}
      <div className="mt-3 pt-2.5 border-t border-primary-50 flex justify-end">
        <span className="text-[11px] font-semibold text-primary-400">
          {hi ? 'विस्तार देखें →' : 'View Details →'}
        </span>
      </div>
    </div>
  );
}
