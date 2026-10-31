import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import {
  CountUp,
  DailyBars,
  PremiumCard,
  Radar,
} from '@/components/performance/charts';
import { AchievementsTab } from '@/components/performance/AchievementsTab';

type Tab = 'performance' | 'readiness' | 'achievements';

export function ProgressPage() {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const isHi = language === 'hi';
  const [params] = useSearchParams();
  const initial = params.get('tab');
  const [activeTab, setActiveTab] = useState<Tab>(initial === 'achievements' || initial === 'readiness' ? initial : 'performance');

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 via-background to-background pb-24">
      {/* Header */}
      <div className="sticky top-0 md:top-16 lg:top-20 z-40 bg-primary/95 backdrop-blur text-white px-4 lg:px-8 pt-3 pb-4 rounded-b-3xl lg:rounded-3xl lg:mt-6 shadow-lg">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm">←</button>
          <h1 className="text-sm font-bold tracking-wide">{isHi ? 'प्रगति' : 'Progress'}</h1>
          <div className="w-8" />
        </div>
        <div className="flex bg-white/10 rounded-2xl p-1 mt-3">
          {([
            ['performance', `📊 ${isHi ? 'प्रदर्शन' : 'Performance'}`],
            ['readiness', `🎯 ${isHi ? 'तैयारी' : 'Readiness'}`],
            ['achievements', `🏅 ${isHi ? 'उपलब्धियां' : 'Badges'}`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 text-[11px] font-semibold rounded-xl transition-all whitespace-nowrap ${activeTab === key ? 'bg-secondary text-primary-800 shadow' : 'text-white/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-0 mt-4 lg:mt-5">
        {activeTab === 'performance' && <PerformanceTab isHi={isHi} navigate={navigate} />}
        {activeTab === 'readiness' && <ReadinessTab isHi={isHi} navigate={navigate} />}
        {activeTab === 'achievements' && <AchievementsTab isHi={isHi} />}
      </div>
    </div>
  );
}

// ─── Performance Tab ───────────────────────────────────────────────────────────

const TIERS = [1, 5, 10, 25, 50];

function PerformanceTab({ isHi, navigate }: { isHi: boolean; navigate: ReturnType<typeof useNavigate> }) {
  const [rank, setRank] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [monthly, setMonthly] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [rankRes, overviewRes, subjectsRes, monthlyRes, activityRes, topicsRes] = await Promise.allSettled([
          api.get('/api/performance/rank'),
          api.get('/api/performance/overview'),
          api.get('/api/performance/subjects'),
          api.get('/api/performance/monthly'),
          api.get('/api/performance/activity'),
          api.get('/api/performance/topics'),
        ]);
        if (cancelled) return;
        if (rankRes.status === 'fulfilled') setRank(rankRes.value.data?.data);
        if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data?.data);
        if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data?.data ?? []);
        if (monthlyRes.status === 'fulfilled') setMonthly(monthlyRes.value.data?.data);
        if (activityRes.status === 'fulfilled') setActivity(activityRes.value.data?.data);
        if (topicsRes.status === 'fulfilled') setTopics(topicsRes.value.data?.data ?? []);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSkeleton />;

  if (!overview || overview.totalTestsAttempted === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-5xl mb-4">📊</span>
        <p className="text-sm font-medium text-gray-700 mb-2">{isHi ? 'अभी तक कोई डेटा नहीं' : 'No data yet'}</p>
        <p className="text-xs text-gray-500 mb-4">{isHi ? 'टेस्ट देकर शुरू करें' : 'Start taking tests'}</p>
        <button onClick={() => navigate('/tests')} className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg">
          {isHi ? 'टेस्ट दें' : 'Take a Test'}
        </button>
      </div>
    );
  }

  const topPct = rank ? Math.max(1, 100 - rank.percentile) : null;
  const nextTier = topPct != null ? [...TIERS].reverse().find((t) => t < topPct) : undefined;
  const ranksToNext = rank && nextTier != null
    ? rank.currentRank - Math.max(1, Math.ceil((rank.totalUsers * nextTier) / 100))
    : null;

  // "Fix" = never cleared (best below 60%). "Revise" = cleared once but the latest attempt dipped below 60%.
  // Same 60% line the Study tab uses for a topic being done, so both screens agree.
  const bestOf = (t: any): number => t.bestAccuracy ?? t.latestAccuracy ?? 0;
  const tried = topics.filter((t: any) => t.attempts > 0);
  const fixTopics = [
    ...tried
      .filter((t: any) => bestOf(t) < 60)
      .sort((a: any, b: any) => bestOf(a) - bestOf(b))
      .map((t: any) => ({ ...t, revise: false })),
    ...tried
      .filter((t: any) => bestOf(t) >= 60 && (t.latestAccuracy ?? 100) < 60)
      .sort((a: any, b: any) => (a.latestAccuracy ?? 0) - (b.latestAccuracy ?? 0))
      .map((t: any) => ({ ...t, revise: true })),
  ].slice(0, 4);

  const improvement: number | null = monthly && monthly.totalTests > 0 ? monthly.improvementPercent : null;

  // Same subject numbers and 70% line as the "Subject performance" bars below (green from 70%)
  const strongList: any[] = [...subjects].filter((x: any) => x.accuracy >= 70).sort((x: any, y: any) => y.accuracy - x.accuracy);
  const weakList: any[] = [...subjects].filter((x: any) => x.accuracy < 70).sort((x: any, y: any) => x.accuracy - y.accuracy);
  const sortedSubjects = [...subjects].sort((a: any, b: any) => b.accuracy - a.accuracy);
  const best = sortedSubjects[0];
  const worst = sortedSubjects.length > 1 ? sortedSubjects[sortedSubjects.length - 1] : null;
  const name = (x: any) => (isHi ? x.nameHi : x.nameEn);

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5 lg:items-start">
      {/* Rank Hero */}
      {rank && !rank.ranked && (
        <div className="rounded-3xl p-5 bg-white border border-primary-50 shadow-sm text-center">
          <p className="text-3xl">🏁</p>
          <p className="mt-1 text-sm font-bold text-primary">{isHi ? 'अभी रैंक नहीं है' : 'No rank yet'}</p>
          <p className="text-xs text-gray-500 mt-0.5">{isHi ? 'इस परीक्षा का कोई टेस्ट दें, फिर आपकी रैंक यहां दिखेगी।' : 'Take a test of this exam and your rank will show up here.'}</p>
        </div>
      )}

      {rank && rank.ranked !== false && (
        <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)] bg-gradient-to-br from-primary-600 via-primary to-primary-400">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-secondary/25 blur-2xl" />
          <div className="absolute -left-12 -bottom-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-[10px] text-secondary-200 uppercase tracking-[0.18em] font-semibold">{isHi ? 'आपकी रैंक' : 'Your Rank'}</p>
              <div className="flex items-end gap-2 mt-1">
                <p className="text-5xl font-black leading-none tabular-nums">#<CountUp value={rank.currentRank} /></p>
                {rank.rankChange != null && rank.rankChange !== 0 && (
                  <span className={`mb-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur ${rank.rankChange > 0 ? 'bg-success/30 text-green-100' : 'bg-accent/40 text-red-100'}`}>
                    {rank.rankChange > 0 ? '▲' : '▼'} {Math.abs(rank.rankChange)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/70 mt-1.5">{isHi ? `${rank.totalUsers} छात्रों में से` : `of ${rank.totalUsers} students`}
                {rank.rankChange != null && rank.rankChange !== 0 && <span className="text-white/50"> · {isHi ? 'इस सप्ताह' : 'this week'}</span>}
              </p>
            </div>
            <div className="relative w-[86px] h-[86px]">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E7C345" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(rank.percentile / 100) * 264} 264`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[8px] text-white/70 uppercase">{isHi ? 'शीर्ष' : 'Top'}</span>
                <span className="text-lg font-extrabold text-secondary-200 leading-none">{topPct}%</span>
              </div>
            </div>
          </div>
          {ranksToNext != null && ranksToNext > 0 && (
            <div className="relative mt-4 bg-white/10 backdrop-blur rounded-2xl px-3 py-2 text-[11px] text-white/90 border border-white/10">
              🎯 {isHi
                ? `शीर्ष ${nextTier}% में आने के लिए ${ranksToNext} रैंक और ऊपर जाएं`
                : `Climb ${ranksToNext} more ${ranksToNext === 1 ? 'rank' : 'ranks'} to reach the Top ${nextTier}%`}
            </div>
          )}
        </div>
      )}

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile icon="📝" value={<CountUp value={overview.totalTestsAttempted} />} label={isHi ? 'टेस्ट' : 'Tests'} tone="from-primary-50 to-white" />
        <StatTile icon="🎯" value={<CountUp value={overview.overallAccuracy} suffix="%" />} label={isHi ? 'सटीकता' : 'Accuracy'} tone="from-secondary-50 to-white" />
        <StatTile icon="🔥" value={<CountUp value={activity?.currentStreak ?? overview.currentStreak} />} label={isHi ? 'स्ट्रीक' : 'Streak'} tone="from-accent-50 to-white" />
      </div>

      {/* Overall per-day graph */}
      <div className="lg:col-span-2 xl:col-span-3">
        <DailyProgress isHi={isHi} />
      </div>

      {/* Insights */}
      {(best || improvement != null) && (
        <PremiumCard title={`✨ ${isHi ? 'आपके लिए इनसाइट' : 'Smart insights'}`}>
          <div className="space-y-2">
            {best && <Insight tone="success" text={isHi ? `${name(best)} आपका सबसे मजबूत विषय है (${best.accuracy}%)` : `${name(best)} is your strongest subject (${best.accuracy}%)`} />}
            {worst && worst.accuracy < 70 && <Insight tone="accent" text={isHi ? `${name(worst)} पर ध्यान दें, सिर्फ ${worst.accuracy}% सटीकता` : `Focus on ${name(worst)}, only ${worst.accuracy}% accuracy`} />}
            {improvement != null && improvement !== 0 && <Insight tone={improvement > 0 ? 'success' : 'accent'} text={improvement > 0 ? (isHi ? `पिछले 15 दिनों में सटीकता ${improvement}% बढ़ी` : `Accuracy up ${improvement}% over the last 15 days`) : (isHi ? `सटीकता ${Math.abs(improvement)}% गिरी, वापसी करें` : `Accuracy down ${Math.abs(improvement)}%, time to bounce back`)} />}
            {activity?.bestStreak > 0 && activity.currentStreak < activity.bestStreak && <Insight tone="gold" text={isHi ? `आपकी सर्वश्रेष्ठ स्ट्रीक ${activity.bestStreak} दिन है, उसे तोड़ने के लिए ${activity.bestStreak - activity.currentStreak + 1} दिन और` : `Your best streak is ${activity.bestStreak} days. ${activity.bestStreak - activity.currentStreak + 1} more days to beat it`} />}
          </div>
        </PremiumCard>
      )}

      {/* Subject radar */}
      {subjects.length >= 3 && (
        <PremiumCard title={isHi ? 'विषय संतुलन' : 'Subject balance'} subtitle={isHi ? 'हर विषय में आपकी सटीकता' : 'Your accuracy across every subject'}>
          <Radar axes={subjects.map((s: any) => ({ label: name(s), value: s.accuracy }))} />
        </PremiumCard>
      )}

      {/* Activity Heatmap */}
      {activity && <ActivityHeatmap activity={activity} isHi={isHi} />}

      {/* Fix It — weak topics */}
      {fixTopics.length > 0 && (
        <PremiumCard title={`🛠️ ${isHi ? 'इन्हें ठीक करें' : 'Fix these topics'}`} subtitle={isHi ? 'जो टॉपिक अभी 60% तक नहीं पहुंचे, या हाल में गिरे हैं' : 'Topics not yet at 60%, or that dipped recently'}>
          <div className="space-y-2">
            {fixTopics.map((t: any) => {
              const acc = bestOf(t);
              const last: number | null = t.latestAccuracy;
              return (
                <div key={t.topicId} className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-accent-50 to-white border border-accent-100">
                  <div className={`w-11 h-11 shrink-0 rounded-full bg-white border-2 flex items-center justify-center text-[11px] font-bold ${t.revise ? 'border-secondary-300 text-secondary-700' : 'border-accent-300 text-accent-600'}`}>{acc}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{isHi ? t.nameHi : t.nameEn}</p>
                    <p className="text-[9px] text-gray-500 truncate">{isHi ? (t.subjectNameHi || t.subjectNameEn) : t.subjectNameEn}</p>
                    <p className="text-[9px] text-gray-400 tabular-nums truncate">
                      <span className={`mr-1 px-1 py-px rounded font-bold ${t.revise ? 'bg-secondary-100 text-secondary-700' : 'bg-accent-100 text-accent-700'}`}>{t.revise ? (isHi ? 'दोहराएं' : 'Revise') : (isHi ? 'ठीक करें' : 'Fix')}</span>
                      {isHi ? `सबसे अच्छा ${acc}%` : `Best ${acc}%`}{last != null ? ` · ${isHi ? 'पिछला' : 'Last'} ${last}%` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/study-plan/topic/${t.topicId}`)}
                    className="px-3.5 py-2 bg-primary text-white text-[10px] font-semibold rounded-xl shadow active:scale-95 transition-transform"
                  >
                    {isHi ? 'अभ्यास' : 'Practice'}
                  </button>
                </div>
              );
            })}
          </div>
        </PremiumCard>
      )}

      {/* Subject Performance */}
      {subjects.length > 0 && (
        <PremiumCard title={isHi ? 'विषयवार प्रदर्शन' : 'Subject performance'}>
          <div className="space-y-3">
            {subjects.map((s: any) => (
              <div key={s.subjectId} className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-[11px] text-gray-700">{name(s)}</span>
                  <span className="text-[11px] font-bold text-primary tabular-nums">{s.accuracy}%</span>
                </div>
                <div className="h-2.5 bg-primary-50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${s.accuracy >= 70 ? 'from-success to-green-300' : s.accuracy >= 50 ? 'from-secondary-500 to-secondary-200' : 'from-accent-500 to-accent-200'}`} style={{ width: `${s.accuracy}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}

      {/* Strong & Improve — ranked from the same subject accuracies as the bars above */}
      {subjects.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-gradient-to-br from-green-50 to-white rounded-3xl p-3.5 border border-green-100">
            <p className="text-[10px] font-bold text-green-700">💪 {isHi ? 'मजबूत' : 'Strong'}</p>
            <p className="text-[9px] text-green-700/60 mb-2">{isHi ? '70% या ज़्यादा' : '70% and above'}</p>
            {strongList.slice(0, 3).map((s: any) => (
              <p key={s.subjectId} className="text-[10px] text-green-800 truncate">{name(s)} ({s.accuracy}%)</p>
            ))}
            {strongList.length === 0 && (
              <p className="text-[9px] text-gray-500 leading-snug">{isHi ? 'किसी विषय में 70% लाएं, वह यहां दिखेगा' : 'Reach 70% in a subject and it shows up here'}</p>
            )}
          </div>
          <div className="bg-gradient-to-br from-accent-50 to-white rounded-3xl p-3.5 border border-accent-100">
            <p className="text-[10px] font-bold text-accent-700">📈 {isHi ? 'सुधारें' : 'Improve'}</p>
            <p className="text-[9px] text-accent-700/60 mb-2">{isHi ? '70% से कम' : 'Below 70%'}</p>
            {weakList.slice(0, 3).map((s: any) => (
              <p key={s.subjectId} className="text-[10px] text-accent-800 truncate">{name(s)} ({s.accuracy}%)</p>
            ))}
            {weakList.length === 0 && (
              <p className="text-[9px] text-gray-500 leading-snug">{isHi ? 'सभी विषय 70%+ हैं, शानदार! 🎉' : 'All subjects are 70%+. Great work! 🎉'}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Daily overall progress ────────────────────────────────────────────────────

const RANGES = [
  { days: 7, en: 'Last 7 days', hi: 'पिछले 7 दिन' },
  { days: 30, en: 'Last 30 days', hi: 'पिछले 30 दिन' },
  { days: 90, en: 'Last 3 months', hi: 'पिछले 3 महीने' },
  { days: 180, en: 'Last 6 months', hi: 'पिछले 6 महीने' },
];

function DailyProgress({ isHi }: { isHi: boolean }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    api.get(`/api/performance/daily?days=${days}`)
      .then((res) => { if (!cancelled) setData(res.data?.data ?? null); })
      .catch(() => { /* keep previous */ })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [days]);

  const sum = data?.summary;
  const passMark: number = data?.passMark ?? 60;
  const locale = isHi ? 'hi-IN' : 'en-IN';
  const best = sum?.bestDay;
  const bars = (data?.series ?? []).map((d: any) => ({ date: d.date, value: d.score, tests: d.tests }));

  return (
    <PremiumCard
      title={`📈 ${isHi ? 'रोज़ की प्रगति' : 'Daily progress'}`}
      subtitle={isHi ? 'हर दिन के सभी टेस्ट का औसत स्कोर' : "Average score of all tests taken each day"}
      right={
        <div className="relative shrink-0">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="appearance-none bg-primary-50/70 border border-primary-100 text-primary text-[10px] font-semibold rounded-xl pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            {RANGES.map((r) => <option key={r.days} value={r.days}>{isHi ? r.hi : r.en}</option>)}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] text-primary-400">▼</span>
        </div>
      }
    >
      <div className={`transition-opacity ${busy ? 'opacity-50' : 'opacity-100'}`}>
        <DailyBars
          key={days}
          bars={bars}
          days={days}
          passMark={passMark}
          locale={locale}
          testsLabel={(n: number) => (isHi ? `${n} टेस्ट` : `${n} test${n === 1 ? '' : 's'}`)}
          emptyText={isHi ? 'इस अवधि में कोई टेस्ट नहीं' : 'No tests in this period'}
        />

        <div className="flex items-center justify-center gap-4 mt-2 text-[9px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[3px] bg-success" />{isHi ? `${passMark}% या ज़्यादा` : `${passMark}% or above`}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-[3px] bg-accent" />{isHi ? `${passMark}% से कम` : `Below ${passMark}%`}</span>
        </div>

        {sum && sum.activeDays > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <MiniStat label={isHi ? 'औसत स्कोर' : 'Avg score'} value={`${sum.avgScore}%`} />
            <MiniStat
              label={isHi ? 'सबसे अच्छा दिन' : 'Best day'}
              value={`${best.score}%`}
              gold
            />
            <MiniStat
              label={isHi ? `${passMark}% से कम दिन` : `Days below ${passMark}%`}
              value={`${sum.redDays}/${sum.activeDays}`}
            />
          </div>
        )}
      </div>
    </PremiumCard>
  );
}

function MiniStat({ label, value, gold, tone }: { label: string; value: string; gold?: boolean; tone?: 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-green-600' : tone === 'down' ? 'text-accent-500' : gold ? 'text-secondary-500' : 'text-primary';
  return (
    <div className="bg-primary-50/60 rounded-2xl py-2 text-center">
      <p className={`text-[13px] font-extrabold tabular-nums ${color}`}>{tone === 'up' ? '▲ ' : tone === 'down' ? '▼ ' : ''}{value.replace('-', '')}</p>
      <p className="text-[8px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function Insight({ text, tone }: { text: string; tone: 'success' | 'accent' | 'gold' }) {
  const styles = {
    success: 'bg-green-50 border-green-100 text-green-800',
    accent: 'bg-accent-50 border-accent-100 text-accent-700',
    gold: 'bg-secondary-50 border-secondary-100 text-secondary-700',
  }[tone];
  const icon = { success: '✅', accent: '⚠️', gold: '🏅' }[tone];
  return <div className={`flex gap-2 items-start rounded-2xl border px-3 py-2 text-[11px] leading-snug ${styles}`}><span>{icon}</span><span>{text}</span></div>;
}

function StatTile({ icon, value, label, tone }: { icon: string; value: React.ReactNode; label: string; tone: string }) {
  return (
    <div className={`bg-gradient-to-b ${tone} rounded-3xl py-3 border border-primary-50 shadow-[0_8px_24px_-14px_rgba(27,58,92,0.35)] text-center`}>
      <p className="text-base">{icon}</p>
      <p className="text-xl font-extrabold text-primary tabular-nums leading-tight">{value}</p>
      <p className="text-[9px] text-gray-500">{label}</p>
    </div>
  );
}

function ActivityHeatmap({ activity, isHi }: { activity: any; isHi: boolean }) {
  const WEEKS = 12;
  const byDate = new Map<string, number>((activity.days ?? []).map((d: any) => [d.date, d.testsCompleted]));
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const todayMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const dow = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const startMs = todayMs - (dow + (WEEKS - 1) * 7) * 86400000;

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const ms = startMs + (w * 7 + d) * 86400000;
      const key = new Date(ms).toISOString().slice(0, 10);
      return { key, future: ms > todayMs, tests: byDate.get(key), isToday: ms === todayMs };
    }),
  );

  const shade = (tests: number | undefined) =>
    tests === undefined ? 'bg-primary-50'
      : tests >= 3 ? 'bg-primary'
        : tests === 2 ? 'bg-primary-400'
          : tests === 1 ? 'bg-primary-200'
            : 'bg-primary-100';

  return (
    <PremiumCard title={`🔥 ${isHi ? 'आपकी निरंतरता' : 'Your consistency'}`} subtitle={isHi ? 'पिछले 12 सप्ताह' : 'Last 12 weeks'}>
      <div className="flex gap-[3px] justify-between max-w-[420px] mx-auto w-full">
        {columns.map((col, w) => (
          <div key={w} className="flex-1 flex flex-col gap-[3px]">
            {col.map((c) => (
              <div
                key={c.key}
                title={c.key}
                className={`aspect-square rounded-[4px] ${c.future ? 'opacity-0' : shade(c.tests)} ${c.isToday ? 'ring-2 ring-secondary' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-1 mt-2 text-[8px] text-gray-400">
        {isHi ? 'कम' : 'Less'}
        {['bg-primary-50', 'bg-primary-100', 'bg-primary-200', 'bg-primary-400', 'bg-primary'].map((c) => <span key={c} className={`w-2.5 h-2.5 rounded-[3px] ${c}`} />)}
        {isHi ? 'ज़्यादा' : 'More'}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <MiniStat label={isHi ? 'मौजूदा स्ट्रीक' : 'Current streak'} value={`${activity.currentStreak}`} />
        <MiniStat label={isHi ? 'सर्वश्रेष्ठ' : 'Best streak'} value={`${activity.bestStreak}`} gold />
        <MiniStat label={isHi ? 'इस सप्ताह' : 'This week'} value={`${activity.thisWeekActiveDays}/7`} />
      </div>
    </PremiumCard>
  );
}

// ─── Readiness Tab ─────────────────────────────────────────────────────────────

function ReadinessTab({ isHi, navigate }: { isHi: boolean; navigate: ReturnType<typeof useNavigate> }) {
  const [data, setData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [rRes, lRes, cRes] = await Promise.allSettled([
        api.get('/api/performance/readiness'),
        api.get('/api/performance/leaderboard'),
        api.get('/api/performance/recommendations'),
      ]);
      if (cancelled) return;
      if (rRes.status === 'fulfilled') setData(rRes.value.data?.data);
      if (lRes.status === 'fulfilled') setLeaderboard(lRes.value.data?.data);
      if (cRes.status === 'fulfilled') setRecs(cRes.value.data?.data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingSkeleton />;

  if (!data || data.testsTaken === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="text-5xl mb-4">🎯</span>
        <p className="text-sm font-medium text-gray-700 mb-2">{isHi ? 'तैयारी स्कोर के लिए टेस्ट दें' : 'Take a test to see your readiness'}</p>
        <button onClick={() => navigate('/tests')} className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-lg">{isHi ? 'टेस्ट दें' : 'Take a Test'}</button>
      </div>
    );
  }

  const name = (x: any) => (isHi ? x.nameHi : x.nameEn);
  const tier = data.score >= 80 ? [isHi ? 'परीक्षा के लिए तैयार' : 'Exam ready', '🏆']
    : data.score >= 60 ? [isHi ? 'लगभग तैयार' : 'Almost there', '🚀']
      : data.score >= 40 ? [isHi ? 'अच्छी प्रगति' : 'Building up', '📈']
        : [isHi ? 'शुरुआत' : 'Getting started', '🌱'];
  const ring = 2 * Math.PI * 52;
  const compMeta: Record<string, [string, string, string]> = {
    accuracy: ['🎯', isHi ? 'सटीकता' : 'Accuracy', isHi ? 'आपके सही उत्तरों का प्रतिशत' : 'Share of attempted answers that are right'],
    coverage: ['📚', isHi ? 'सिलेबस महारत' : 'Syllabus mastery', isHi ? `${data.topicsDone}/${data.topicsTotal} टॉपिक में 60%+` : `${data.topicsDone}/${data.topicsTotal} topics at 60%+`],
    consistency: ['🔥', isHi ? 'निरंतरता' : 'Consistency', isHi ? 'पिछले 14 दिनों में सक्रिय दिन' : 'Active days in the last 14'],
    volume: ['📝', isHi ? 'अभ्यास' : 'Practice volume', isHi ? `${Math.min(data.testsTaken, 20)}/20 अलग टेस्ट` : `${Math.min(data.testsTaken, 20)}/20 different tests`],
  };
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const goRec = (r: any) => {
    if (r.type === 'mock' || !r.targetId) return navigate('/tests');
    return navigate(r.type === 'practice' ? `/study-plan/subject/${r.targetId}` : `/study-plan/topic/${r.targetId}`);
  };
  const barTone = (v: number) => (v >= 70 ? 'from-success to-green-300' : v >= 50 ? 'from-secondary-500 to-secondary-200' : 'from-accent-500 to-accent-200');

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5 lg:items-start lg:[&>*:first-child]:col-span-2 xl:[&>*:first-child]:col-span-3 lg:[&>*:last-child]:col-span-2">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)] bg-gradient-to-br from-primary-700 via-primary to-primary-400">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-secondary/25 blur-2xl" />
        <p className="relative text-[10px] text-secondary-200 uppercase tracking-[0.18em] font-semibold">{isHi ? 'परीक्षा तैयारी स्कोर' : 'Exam readiness score'}</p>
        <div className="relative flex items-center gap-5 mt-3">
          <div className="relative w-[124px] h-[124px] shrink-0">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#E7C345" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(data.score / 100) * ring} ${ring}`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black leading-none tabular-nums">{data.score}</span>
              <span className="text-[9px] text-white/60">/ 100</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight">{tier[1]} {tier[0]}</p>
            {data.exam && <p className="text-[11px] text-white/70 mt-1 truncate">{name(data.exam)}</p>}
            {data.exam?.daysLeft != null ? (
              <div className="inline-flex items-center gap-1.5 mt-2 bg-white/10 border border-white/15 rounded-full px-3 py-1">
                <span className="text-sm font-extrabold text-secondary-200 tabular-nums">{data.exam.daysLeft}</span>
                <span className="text-[10px] text-white/80">{isHi ? 'दिन बाकी' : 'days left'} · {fmtDate(data.exam.examDate)}</span>
              </div>
            ) : (
              <p className="text-[10px] text-white/50 mt-2">{isHi ? 'परीक्षा तिथि घोषित नहीं' : 'Exam date not announced yet'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Estimated marks */}
      <PremiumCard
        title={isHi ? 'अनुमानित अंक' : 'Estimated marks'}
        subtitle={isHi ? `${data.negativeMarking} नेगेटिव मार्किंग के बाद, ${data.testsTaken} टेस्ट के आधार पर` : `After ${data.negativeMarking} negative marking, based on ${data.testsTaken} tests`}
      >
        <div className="flex items-end justify-between">
          <p className="text-4xl font-black text-primary tabular-nums leading-none">{data.estimatedMarks}<span className="text-base font-semibold text-gray-400"> / {data.totalMarks}</span></p>
          <p className="text-sm font-bold text-secondary-500 tabular-nums">{Math.round((data.estimatedMarks / data.totalMarks) * 100)}%</p>
        </div>
        <div className="h-3 bg-primary-50 rounded-full overflow-hidden mt-3">
          <div className={`h-full rounded-full bg-gradient-to-r ${barTone((data.estimatedMarks / data.totalMarks) * 100)}`} style={{ width: `${Math.min(100, (data.estimatedMarks / data.totalMarks) * 100)}%` }} />
        </div>
      </PremiumCard>

      {/* Breakdown */}
      <PremiumCard title={isHi ? 'स्कोर कैसे बना' : 'How your score is built'} subtitle={isHi ? 'हर हिस्से का वज़न साथ में' : 'Each part with its weight'}>
        <div className="space-y-3.5">
          {data.components.map((c: any) => {
            const [icon, label, hint] = compMeta[c.key];
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-700">{icon} {label} <span className="text-gray-400 font-normal">· {c.weight}%</span></span>
                  <span className="text-[11px] font-bold text-primary tabular-nums">{c.value}%</span>
                </div>
                <div className="h-2.5 bg-primary-50 rounded-full overflow-hidden mt-1">
                  <div className={`h-full rounded-full bg-gradient-to-r ${barTone(c.value)}`} style={{ width: `${c.value}%` }} />
                </div>
                <p className="text-[9px] text-gray-400 mt-0.5">{hint}</p>
              </div>
            );
          })}
        </div>
      </PremiumCard>

      {/* Subject readiness */}
      {data.subjects?.length > 0 && (
        <PremiumCard title={isHi ? 'विषयवार तैयारी' : 'Subject readiness'}>
          <div className="space-y-3">
            {data.subjects.map((s: any) => (
              <div key={s.subjectId} className="rounded-2xl bg-primary-50/50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-gray-800">{name(s)}</p>
                  <p className="text-[11px] font-bold text-primary tabular-nums">{s.accuracy == null ? (isHi ? 'शुरू नहीं' : 'Not started') : `${s.accuracy}%`}</p>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden mt-1.5">
                  <div className={`h-full rounded-full bg-gradient-to-r ${barTone(s.accuracy ?? 0)}`} style={{ width: `${s.accuracy ?? 0}%` }} />
                </div>
                <p className="text-[9px] text-gray-500 mt-1">
                  {isHi ? `${s.topicsDone}/${s.topicsTotal} टॉपिक में महारत · ${s.questionsSolved} प्रश्न हल` : `${s.topicsDone}/${s.topicsTotal} topics mastered · ${s.questionsSolved} questions solved`}
                </p>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}

      {/* Next best action */}
      {recs.length > 0 && (
        <PremiumCard title={`⚡ ${isHi ? 'आगे क्या करें' : 'What to do next'}`}>
          <div className="space-y-2">
            {recs.map((r: any, i: number) => (
              <button key={i} onClick={() => goRec(r)} className="w-full text-left flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-secondary-50 to-white border border-secondary-100 active:scale-[0.99] transition-transform">
                <span className="text-lg">{r.type === 'mock' ? '🏁' : r.type === 'retry' ? '🔁' : r.type === 'continue' ? '▶️' : '💡'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[11px] font-semibold text-gray-800 truncate">{isHi ? (r.titleHi || r.title) : r.title}</span>
                  <span className="block text-[9px] text-gray-500">{isHi ? (r.descriptionHi || r.description) : r.description}</span>
                </span>
                <span className="text-primary-300">›</span>
              </button>
            ))}
          </div>
        </PremiumCard>
      )}

      {/* Leaderboard */}
      {leaderboard?.leaderboard?.length > 0 && (
        <PremiumCard
          title={`🏆 ${isHi ? 'लीडरबोर्ड' : 'Leaderboard'}`}
          subtitle={isHi ? 'हर टेस्ट के सर्वश्रेष्ठ स्कोर का औसत (कम से कम 2 टेस्ट)' : 'Average of best score per test (min 2 tests)'}
          right={leaderboard.userRank && <span className="px-2.5 py-1 rounded-full bg-primary text-white text-[10px] font-bold">#{leaderboard.userRank.rank} · {leaderboard.userRank.avgPercentage}%</span>}
        >
          <div className="space-y-1.5">
            {leaderboard.leaderboard.map((e: any) => (
              <div key={e.userId} className={`flex items-center justify-between px-3 py-2 rounded-2xl ${e.isCurrentUser ? 'bg-gradient-to-r from-secondary-100 to-secondary-50 border border-secondary-200' : 'bg-primary-50/50'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[11px] font-bold text-primary shadow-sm">{e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span>
                  <span className={`text-xs ${e.isCurrentUser ? 'font-bold text-primary' : 'text-gray-700'}`}>{e.isCurrentUser ? (isHi ? 'आप' : 'You') : e.name}</span>
                </div>
                <span className="text-xs font-bold text-primary tabular-nums">{e.avgPercentage}%</span>
              </div>
            ))}
          </div>
        </PremiumCard>
      )}
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 bg-gray-200 rounded-xl" />
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="h-16 bg-gray-200 rounded-xl" />
        <div className="h-16 bg-gray-200 rounded-xl" />
      </div>
      <div className="h-28 bg-gray-200 rounded-xl" />
      <div className="h-36 bg-gray-200 rounded-xl" />
    </div>
  );
}
