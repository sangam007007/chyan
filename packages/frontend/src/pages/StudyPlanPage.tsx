import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useTodayPlan } from '@/hooks/useTodayPlan';
import api from '@/services/api';
import { PageHero } from '@/components/ui/premium';
import { EditPlanSheet } from '@/components/study/EditPlanSheet';
import { fmtMin, finishTime } from '@/components/study/planTime';

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function StudyPlanPage() {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan, isLoading: planLoading, initialize } = useStudyPlan();
  const { data: todayData, isLoading: todayLoading, refetch } = useTodayPlan();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showViewModal, setShowViewModal] = useState(searchParams.get('view') === 'true');
  const [planRefreshKey, setPlanRefreshKey] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Clear URL param after modal opens + scroll to hash
  useEffect(() => {
    if (searchParams.get('view') === 'true') {
      setShowViewModal(true);
      setSearchParams({}, { replace: true });
    }
    // Scroll to subjects section if hash is present
    if (window.location.hash === '#subjects') {
      setTimeout(() => {
        document.getElementById('subjects')?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, [searchParams, setSearchParams]);

  const isHi = language === 'hi';
  const weekDates = useMemo(getWeekDates, []);
  const today = new Date();

  // Fetch weekly plan progress for date strip
  const [weeklyData, setWeeklyData] = useState<Record<string, { totalItems: number; completedItems: number; pct: number }>>({});
  useEffect(() => {
    let cancelled = false;
    // First update today's progress, then fetch weekly strip
    api.post('/api/study-plan/update-daily-progress', {}).catch(() => {});
    api.get('/api/study-plan/weekly-strip').then((res) => {
      if (cancelled) return;
      setWeeklyData(res.data?.data ?? {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const toggleComplete = useCallback(async (itemId: string, completed: boolean) => {
    try {
      if (completed) {
        await api.delete(`/api/study-plan/today/items/${itemId}/complete`);
      } else {
        await api.post(`/api/study-plan/today/items/${itemId}/complete`);
      }
      await refetch();
      // Update daily progress for the strip
      api.post('/api/study-plan/update-daily-progress', {}).catch(() => {});
    } catch { /* silent */ }
  }, [refetch]);

  const handleInitialize = useCallback(async () => {
    if (!user?.selectedExamId) return;
    setInitializing(true);
    try { await initialize(user.selectedExamId); } catch {}
    setInitializing(false);
  }, [initialize, user?.selectedExamId]);

  const isLoading = planLoading || todayLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen pb-28">
        <div className="p-hero rounded-b-[32px] px-4 pt-5 pb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-white/20 rounded-full animate-pulse" />
            <div className="w-36 h-6 bg-white/20 rounded-lg animate-pulse" />
          </div>
          <div className="h-14 bg-white/15 rounded-2xl animate-pulse mb-3" />
          <div className="grid grid-cols-7 gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-14 bg-white/15 rounded-2xl animate-pulse" />)}
          </div>
        </div>
        <div className="px-4 mt-4 space-y-4">
          <div className="h-44 bg-white rounded-3xl animate-pulse" />
          <div className="h-48 bg-white rounded-3xl animate-pulse" />
          <div className="h-32 bg-white rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen pb-28">
        <HeaderBar isHi={isHi} navigate={navigate} />
        <div className="px-4 mt-6">
          <div className="p-card flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-secondary-100 to-secondary-200 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <span className="text-3xl">📚</span>
            </div>
            <h2 className="text-lg font-extrabold text-primary mb-2">{isHi ? 'अध्ययन योजना शुरू करें' : 'Start Your Study Plan'}</h2>
            <p className="text-sm text-gray-500 mb-6">{isHi ? 'व्यक्तिगत योजना बनाएं' : 'Create a personalized plan for your exam'}</p>
            <button onClick={handleInitialize} disabled={initializing || !user?.selectedExamId} className="p-btn !px-7 !py-3 !text-sm">
              {initializing ? (isHi ? 'बना रहे हैं...' : 'Initializing...') : (isHi ? 'अध्ययन योजना बनाएं' : 'Initialize Study Plan')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const progress = plan.overallProgress;
  // About how long: from the topics and tests picked (server-side), not a typed-in number
  const totalMin = todayData?.estimatedMinutes ?? todayData?.items.reduce((s, i) => s + i.durationMinutes, 0) ?? 0;
  const remainingMin = todayData?.remainingMinutes ?? totalMin;
  // Same number as the Dashboard card: topics + tests done today across the plan
  const todayPct = todayData?.progressPercent ?? 0;

  return (
    <div className="min-h-screen pb-28">
      {/* ─── Hero: today's progress + week strip ─────────────────────── */}
      <PageHero
        title={isHi ? 'अध्ययन योजना' : 'Study Plan'}
        subtitle={isHi ? 'आज का लक्ष्य पूरा करें' : "Finish today's goal"}
        left={
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white/15 backdrop-blur border border-white/10 active:scale-95 transition-transform"
            aria-label={isHi ? 'वापस' : 'Back'}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        }
      >
        {/* Today's progress */}
        <div className="flex items-center justify-between gap-4 rounded-3xl bg-white/10 border border-white/10 backdrop-blur px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] text-secondary-200 font-semibold">{isHi ? 'आज की प्रगति' : "Today's progress"}</p>
            <p className="text-3xl font-black tabular-nums leading-tight">{todayPct}<span className="text-lg text-white/60">%</span></p>
            <p className="text-[11px] text-white/70 tabular-nums">
              {totalMin > 0
                ? <>{isHi ? 'कुल' : 'Total'} ~{fmtMin(totalMin, isHi)} · {remainingMin > 0 ? (isHi ? `${fmtMin(remainingMin, true)} बाकी` : `${fmtMin(remainingMin, false)} left`) : (isHi ? 'पूर्ण 🎉' : 'done 🎉')}</>
                : (isHi ? 'आज कोई योजना नहीं' : 'No plan set for today')}
            </p>
            {remainingMin > 0 && totalMin > 0 && (
              <p className="text-[10px] text-secondary-200 mt-0.5">
                ⏱ {isHi ? `अभी शुरू करें तो ${finishTime(remainingMin, true)} तक पूरा` : `Start now and finish by ${finishTime(remainingMin, false)}`}
              </p>
            )}
          </div>
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
              <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="6" />
              <circle cx="32" cy="32" r="27" fill="none" stroke={todayPct >= 100 ? '#2ECC71' : '#E7C345'} strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(todayPct / 100) * 169.6} 169.6`} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl">🎯</span>
          </div>
        </div>

        {/* Weekly Progress Strip */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <h3 className="text-xs font-bold text-white">{isHi ? 'साप्ताहिक प्रगति' : 'Weekly Progress'}</h3>
            <span className="text-[9px] text-white/60">{isHi ? 'दैनिक योजना पूर्णता %' : 'Daily plan completion %'}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === today.toDateString();
              const dateStr = d.toISOString().split('T')[0];
              const dayData = weeklyData[dateStr];
              const isPast = d < today && !isToday;
              const isFuture = d > today;

              // Percentage: for today use live progress, for past use stored data
              let pct = 0;
              if (isToday && todayData && totalMin > 0) {
                pct = todayPct;
              } else if (isPast && dayData) {
                pct = dayData.pct;
              }

              return (
                <div key={i} className={`relative flex flex-col items-center rounded-2xl overflow-hidden ${isToday ? 'bg-secondary shadow-lg' : 'bg-white/10 border border-white/10'}`}>
                  {/* Background fill from bottom */}
                  {pct > 0 && !isFuture && (
                    <div
                      className={`absolute bottom-0 left-0 right-0 transition-all ${isToday ? 'bg-primary-800 opacity-15' : 'bg-secondary opacity-25'}`}
                      style={{ height: `${pct}%` }}
                    />
                  )}
                  <div className="relative z-10 flex flex-col items-center py-1.5 px-0.5 pb-2">
                    <span className={`text-[9px] font-bold tabular-nums ${isToday ? 'text-primary-800' : pct >= 100 ? 'text-secondary-200' : pct > 0 ? 'text-white' : 'text-white/35'}`}>
                      {isFuture ? '—' : `${pct}%`}
                    </span>
                    <span className={`text-[10px] font-medium ${isToday ? 'text-primary-700' : 'text-white/60'}`}>
                      {d.toLocaleDateString(isHi ? 'hi-IN' : 'en-US', { weekday: 'short' })}
                    </span>
                    <span className={`text-sm font-extrabold ${isToday ? 'text-primary-800' : 'text-white'}`}>{d.getDate()}</span>
                  </div>
                  {/* Bottom progress bar */}
                  {!isFuture && (
                    <div className={`absolute bottom-0 left-0 right-0 h-1 ${isToday ? 'bg-primary-800/20' : 'bg-white/10'}`}>
                      <div className={`h-full ${isToday ? 'bg-primary-800' : pct >= 100 ? 'bg-success' : 'bg-secondary-300'} transition-all rounded-r-full`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </PageHero>

      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-5 lg:items-start">
        <div className="space-y-4 lg:col-span-1 lg:sticky lg:top-20">
        {/* Exam Readiness Meter */}
        <ExamReadinessMeter isHi={isHi} />

        {/* Today's Study Plan */}
        <div className="p-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="p-title text-[14px]">{isHi ? 'आज की अध्ययन योजना' : "Today's Study Plan"}</h2>
            <button onClick={() => setShowEditModal(true)} className="p-chip !px-3 !py-1.5 active:scale-95 transition-transform">✏️ {isHi ? 'संपादित करें' : 'Edit'}</button>
          </div>
          {todayData?.items.length ? (
            <>
              <div className="space-y-3">
                {todayData.items.map((item, idx) => (
                  <TodayPlanItem
                    key={item.id}
                    item={item}
                    isHi={isHi}
                    onToggle={toggleComplete}
                    refreshKey={planRefreshKey}
                    index={idx}
                  />
                ))}
              </div>
              {/* Motivational line */}
              {(() => {
                const totalSubjects = todayData.items.length;
                const completedSubjects = todayData.items.filter((i) => i.completed).length;
                const remaining = totalSubjects - completedSubjects;
                if (remaining === 0) {
                  return <p className="text-[11px] text-green-700 text-center mt-3 font-semibold bg-success/10 rounded-2xl py-2">🎉 {isHi ? 'आज का प्लान पूरा!' : "Today's plan complete!"}</p>;
                }
                return <p className="text-[11px] text-primary-400 text-center mt-3 bg-primary-50/70 rounded-2xl py-2">{isHi ? `🎯 ${remaining} और विषय बाकी — जारी रखो!` : `🎯 ${remaining} more subject${remaining > 1 ? 's' : ''} to go — keep it up!`}</p>;
              })()}
            </>
          ) : (
            <p className="text-xs text-gray-400 text-center py-5">{isHi ? 'आज के लिए कोई कार्य नहीं' : 'No tasks for today'}</p>
          )}
        </div>
        </div>

        {/* Study Screen Section */}
        <div id="subjects" className="lg:col-span-2 xl:col-span-3 space-y-4">
          <StudyScreenSection isHi={isHi} />

          {/* Common discussion of the student's exam */}
          <button
            type="button"
            onClick={() => navigate('/community')}
            className="w-full p-card p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
          >
            <span className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-secondary-100 to-secondary-300 flex items-center justify-center text-2xl shadow-[0_8px_18px_-8px_rgba(197,160,40,0.9)]">💬</span>
            <span className="flex-1 min-w-0">
              <span className="block p-title">{isHi ? 'सबकी चर्चा (कम्युनिटी)' : 'Community discussion'}</span>
              <span className="block p-sub mt-0.5">{isHi ? 'अपने एग्ज़ाम के बाकी छात्रों से सवाल पूछें, नोट्स और तरीके साझा करें।' : 'Ask other students of your exam, share notes and approaches.'}</span>
            </span>
            <span className="text-primary-300 text-lg">›</span>
          </button>
        </div>
      </div>

      {/* Edit Plan Modal */}
      {showEditModal && (
        <EditPlanSheet
          isHi={isHi}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => {
            setShowEditModal(false);
            await refetch();
          }}
        />
      )}

      {/* View Plan Modal (read-only) */}
      {showViewModal && (
        <ViewPlanModal
          isHi={isHi}
          onClose={() => { setShowViewModal(false); setPlanRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

const SUBJECT_COLORS = [
  { border: 'border-l-primary', bg: 'bg-primary-50', accent: 'text-primary' },
  { border: 'border-l-secondary', bg: 'bg-secondary-50', accent: 'text-secondary-700' },
  { border: 'border-l-success', bg: 'bg-success/10', accent: 'text-green-700' },
  { border: 'border-l-accent-400', bg: 'bg-accent-50', accent: 'text-accent-600' },
  { border: 'border-l-primary-300', bg: 'bg-primary-100/50', accent: 'text-primary-500' },
];

function TodayPlanItem({ item, isHi, onToggle, refreshKey, index }: {
  item: { id: string; subjectNameEn: string; subjectNameHi: string; durationMinutes: number; estimatedMinutes?: number; completed: boolean; topicCount: number; testCount: number; tasksTotal?: number };
  isHi: boolean;
  onToggle: (id: string, completed: boolean) => void;
  refreshKey: number;
  index: number;
}) {
  const navigate = useNavigate();
  const [done, setDone] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState<{ topics: any[]; tests: any[] }>({ topics: [], tests: [] });
  const total = item.topicCount + item.testCount;
  const colors = SUBJECT_COLORS[index % SUBJECT_COLORS.length];

  useEffect(() => { setLoaded(false); }, [refreshKey]);

  useEffect(() => {
    if (loaded || total === 0) return;
    let cancelled = false;

    api.get('/api/study-plan/today-selections').then((res) => {
      if (cancelled) return;
      const items = res.data?.data?.items ?? [];
      const match = items.find((s: any) => s.subjectNameEn === item.subjectNameEn);
      if (match) {
        const topicsDone = (match.topics ?? []).filter((t: any) => t.status === 'completed').length;
        const testsDone = (match.tests ?? []).filter((t: any) => t.attemptStatus === 'completed').length;
        setDone(topicsDone + testsDone);
        setDetails({ topics: match.topics ?? [], tests: match.tests ?? [] });
      }
      setLoaded(true);
    }).catch(() => { if (!cancelled) setLoaded(true); });

    return () => { cancelled = true; };
  }, [loaded, total, item.subjectNameEn]);

  const cappedDone = Math.min(done, total);
  const pct = total > 0 ? Math.round((cappedDone / total) * 100) : 0;
  // Only mark subject as done when user manually toggles it (item.completed)
  // Don't auto-mark based on individual completions — user decides when they're done
  const subjectDone = item.completed;

  return (
    <div className={`rounded-2xl border-l-4 ${colors.border} bg-white border border-primary-50 shadow-[0_4px_18px_-10px_rgba(27,58,92,0.3)] overflow-hidden`}>
      {/* Main row — clickable to expand */}
      <div
        className={`flex items-center gap-3 p-3 cursor-pointer ${subjectDone ? 'bg-success/10' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Check circle */}
        {/* With topics/tests picked, a subject is done only when they are really done: no hand tick. (Old plans with nothing picked can still be ticked.) */}
        <button onClick={(e) => { e.stopPropagation(); if ((item.tasksTotal ?? 0) > 0) { setExpanded((v) => !v); return; } onToggle(item.id, item.completed); }} className="flex-shrink-0">
          {subjectDone ? (
            <div className="w-7 h-7 bg-success rounded-full flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
          ) : (
            <div className={`w-7 h-7 rounded-full border-2 border-primary-200 ${colors.bg}`} />
          )}
        </button>

        {/* Subject info */}
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-bold ${subjectDone ? 'text-green-700' : 'text-primary'}`}>
            {isHi ? item.subjectNameHi : item.subjectNameEn}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-400 tabular-nums">{cappedDone}/{total} {isHi ? 'पूरा' : 'done'}</span>
            <span className={`text-[9px] font-bold ${subjectDone ? 'text-green-600' : colors.accent}`}>{pct}%</span>
            {(item.estimatedMinutes ?? item.durationMinutes) > 0 && (
              <span className="text-[10px] text-primary-400 font-semibold tabular-nums">⏱ ~{fmtMin(item.estimatedMinutes ?? item.durationMinutes, isHi)}</span>
            )}
          </div>
        </div>

        {/* Expand arrow */}
        <span className={`text-sm text-primary-300 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-3 pb-2">
          <div className="w-full h-1.5 bg-primary-50 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${subjectDone ? 'bg-success' : 'bg-gradient-to-r from-secondary-400 to-secondary-200'}`} style={{ width: `${subjectDone ? 100 : pct}%` }} />
          </div>
        </div>
      )}

      {/* Expanded — Topics with their Tests */}
      {expanded && loaded && (
        <div className={`border-t border-primary-50 px-3 py-3 space-y-2 ${colors.bg}`}>
          {/* Topics with mapped tests */}
          {details.topics.map((topic: any) => {
            // Find tests that belong to this topic
            const topicTests = details.tests.filter((t: any) => t.topicId === topic.id);

            return (
              <div key={topic.id}>
                {/* Topic row */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {topic.status === 'completed' ? (
                      <span className="w-4 h-4 bg-success rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </span>
                    ) : (
                      <span className="w-4 h-4 border-2 border-gray-300 rounded flex-shrink-0" />
                    )}
                    <span className={`text-[10px] truncate ${topic.status === 'completed' ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                      📚 {isHi ? topic.nameHi : topic.nameEn}
                    </span>
                  </div>
                  {topic.status !== 'completed' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/study-plan/topic/${topic.id}`); }}
                      className="text-[10px] font-bold text-primary-800 bg-secondary px-2.5 py-1 rounded-xl shadow-sm active:scale-95 transition-transform"
                    >
                      {isHi ? 'शुरू' : 'Start'}
                    </button>
                  )}
                </div>

                {/* Tests under this topic */}
                {topicTests.length > 0 && (
                  <div className="ml-6 space-y-1 mt-1">
                    {topicTests.map((test: any) => {
                      const isCompleted = test.attemptStatus === 'completed';
                      const allUsed = test.attemptCount >= 5;

                      return (
                        <div key={test.id} className={`flex items-center justify-between py-1 px-2 rounded-md ${isCompleted ? 'bg-success/10' : ''}`}>
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            {isCompleted ? (
                              <span className="w-3.5 h-3.5 bg-success rounded flex items-center justify-center flex-shrink-0">
                                <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                              </span>
                            ) : (
                              <span className="w-3.5 h-3.5 border-2 border-gray-300 rounded flex-shrink-0" />
                            )}
                            <span className={`text-[9px] truncate ${isCompleted ? 'text-green-700' : 'text-gray-600'}`}>
                              📝 {isHi ? test.titleHi : test.titleEn}
                            </span>
                            {isCompleted && test.bestPercentage != null && (
                              <span className={`text-[8px] font-bold ml-1 ${test.passed ? 'text-green-700' : 'text-accent-600'}`}>
                                {test.bestPercentage}%
                              </span>
                            )}
                            {test.attemptCount > 0 && (
                              <span className="text-[8px] text-gray-400 ml-1">({test.attemptCount}/5)</span>
                            )}
                          </div>
                          <div className="shrink-0 ml-1">
                            {!isCompleted && !allUsed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/tests/${test.id}/attempt`); }}
                                className="text-[9px] font-bold text-primary-800 bg-secondary px-2 py-0.5 rounded-lg shadow-sm active:scale-95 transition-transform"
                              >
                                {isHi ? 'टेस्ट' : 'Test'}
                              </button>
                            )}
                            {isCompleted && !test.passed && !allUsed && (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/tests/${test.id}/attempt`); }}
                                className="text-[9px] font-bold text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded-lg active:scale-95 transition-transform"
                              >
                                {isHi ? 'पुनः' : 'Retry'}
                              </button>
                            )}
                            {allUsed && (
                              <span className="text-[9px] font-semibold text-primary-300">{isHi ? 'समाप्त' : 'Done'}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* All selected tests shown below topics */}
          {details.tests.length > 0 && (
            <div className="mt-2 pt-1 border-t border-gray-200/50">
              <p className="text-[9px] text-gray-500 font-medium mb-1">📝 {isHi ? 'टेस्ट' : 'Tests'}</p>
              <div className="space-y-1">
                {details.tests.map((test: any) => {
                  const isCompleted = test.attemptStatus === 'completed';
                  const allUsed = test.attemptCount >= 5;
                  return (
                    <div key={test.id} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${isCompleted ? 'bg-success/10' : ''}`}>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {isCompleted ? (
                          <span className="w-3.5 h-3.5 bg-success rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          </span>
                        ) : (
                          <span className="w-3.5 h-3.5 border-2 border-gray-300 rounded flex-shrink-0" />
                        )}
                        <span className={`text-[9px] truncate ${isCompleted ? 'text-green-700' : 'text-gray-600'}`}>
                          {isHi ? test.titleHi : test.titleEn}
                        </span>
                        {isCompleted && test.bestPercentage != null && (
                          <span className={`text-[8px] font-bold ml-1 ${test.passed ? 'text-green-700' : 'text-accent-600'}`}>
                            {test.bestPercentage}%
                          </span>
                        )}
                        {test.attemptCount > 0 && (
                          <span className="text-[8px] text-gray-400 ml-1">({test.attemptCount}/5)</span>
                        )}
                      </div>
                      <div className="shrink-0 ml-1">
                        {!isCompleted && !allUsed && (
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/tests/${test.id}/attempt`); }} className="text-[9px] font-bold text-primary-800 bg-secondary px-2 py-0.5 rounded-lg shadow-sm active:scale-95 transition-transform">
                            {isHi ? 'टेस्ट' : 'Test'}
                          </button>
                        )}
                        {isCompleted && !test.passed && !allUsed && (
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/tests/${test.id}/attempt`); }} className="text-[9px] font-bold text-secondary-700 bg-secondary-100 px-2 py-0.5 rounded-lg active:scale-95 transition-transform">
                            {isHi ? 'पुनः' : 'Retry'}
                          </button>
                        )}
                        {allUsed && <span className="text-[9px] font-semibold text-primary-300">{isHi ? 'समाप्त' : 'Done'}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Study Screen Section ─────────────────────────────────────────────

interface StudyScreenData {
  /** false while the selected exam has no published test yet */
  examHasTests?: boolean;
  continueLearning: {
    subjectNameEn: string;
    subjectNameHi: string;
    topicNameEn: string;
    topicNameHi: string;
    completedTopics: number;
    totalTopics: number;
    progressPercent: number;
    topicId: string;
  } | null;
  subjects: {
    id: string;
    nameEn: string;
    nameHi: string;
    description: string;
    badge: string | null;
    completedTopics: number;
    totalTopics: number;
    completedTests: number;
    progressPercent: number;
    topicCount: number;
    pdfCount: number;
    videoCount: number;
    testCount: number;
    lastStudied: string | null;
    accuracy: number | null;
    status: string;
  }[];
  dailyGoal: { completed: number; target: number; remaining: number };
}

const PROGRESS_COLORS = ['bg-success', 'bg-primary-500', 'bg-primary-500', 'bg-secondary-500'];
const SUBJECT_EMOJIS = ['📘', '📗', '📙', '📕', '📒', '📓', '🔬', '🌍', '⚖️', '🧮'];

function getRelativeTime(isoDate: string | null, isHi: boolean): string {
  if (!isoDate) return '';
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return isHi ? 'अभी' : 'just now';
  if (diffMin < 60) return isHi ? `${diffMin} मिनट पहले` : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return isHi ? `${diffHr} घंटे पहले` : `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return isHi ? `${diffDay} दिन पहले` : `${diffDay}d ago`;
  const diffWeek = Math.floor(diffDay / 7);
  return isHi ? `${diffWeek} सप्ताह पहले` : `${diffWeek}w ago`;
}

function StudyScreenSection({ isHi }: { isHi: boolean }) {
  const navigate = useNavigate();
  const [data, setData] = useState<StudyScreenData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/study-plan/study-screen')
      .then((res) => {
        if (cancelled) return;
        setData(res.data?.data ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-28 bg-white rounded-3xl animate-pulse" />
        <div className="h-36 bg-white rounded-3xl animate-pulse" />
        <div className="h-36 bg-white rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!data || data.subjects.length === 0) return null;

  const { continueLearning, subjects, dailyGoal } = data;

  return (
    <div className="space-y-4">
      {data.examHasTests === false && (
        <div role="note" className="rounded-2xl border border-secondary-200 bg-secondary-50 px-4 py-3 flex gap-3">
          <span className="text-2xl leading-none">⏳</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary">{isHi ? 'इस परीक्षा के टेस्ट जल्द आ रहे हैं' : 'Tests for this exam are coming soon'}</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-snug">
              {isHi ? 'तब तक आप टॉपिक पढ़ सकते हैं। टेस्ट आने के बाद ही टॉपिक और विषय 100% गिने जाएंगे, इसलिए प्रतिशत अभी कम दिखेगा।' : 'Until then you can study the topics. Topics and subjects count as 100% only once their tests are added and done, so percentages stay low for now.'}
            </p>
          </div>
        </div>
      )}

      {/* Continue Learning Card */}
      {continueLearning && (
        <div className="p-hero rounded-3xl p-4">
          <div className="pointer-events-none absolute -right-8 -bottom-10 w-36 h-36 rounded-full bg-secondary/25 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/10 backdrop-blur flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">📚</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-secondary-200 uppercase tracking-[0.15em]">
                {isHi ? 'जारी रखें' : 'Continue Learning'}
              </p>
              <p className="text-[15px] font-extrabold text-white mt-0.5 truncate">
                {isHi ? continueLearning.subjectNameHi : continueLearning.subjectNameEn}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-2 bg-white/15 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-secondary-400 to-secondary-200 rounded-full transition-all" style={{ width: `${continueLearning.progressPercent}%` }} />
                </div>
                <span className="text-[11px] font-bold text-white tabular-nums">{continueLearning.progressPercent}%</span>
              </div>
              <p className="text-[10px] text-white/60 mt-1 tabular-nums">
                {continueLearning.completedTopics} {isHi ? 'का' : 'of'} {continueLearning.totalTopics} {isHi ? 'टॉपिक' : 'Topics'}
              </p>
            </div>
          </div>
          <div className="relative mt-3 flex justify-end">
            <button
              onClick={() => navigate(`/study-plan/subject/${continueLearning.topicId}`)}
              className="p-btn"
            >
              {isHi ? 'जारी →' : 'Continue →'}
            </button>
          </div>
        </div>
      )}

      {/* Subjects Heading */}
      <div className="flex items-center justify-between pt-1 px-1">
        <h2 className="p-title text-[14px]">{isHi ? 'विषय' : 'Subjects'}</h2>
        <span className="p-chip tabular-nums">{subjects.length} {isHi ? 'विषय' : 'total'}</span>
      </div>

      {/* Subject Cards */}
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:items-start">
        {subjects.map((subject, idx) => {
          const emoji = SUBJECT_EMOJIS[idx % SUBJECT_EMOJIS.length];
          const badgeColor = subject.badge === 'HOT' ? 'bg-accent text-white' : subject.badge === 'NEW' ? 'bg-primary text-white' : subject.badge === 'TRENDING' ? 'bg-secondary text-primary-800' : 'bg-primary-400 text-white';
          const done = subject.progressPercent >= 100;

          return (
            <div key={subject.id} className="perf-fade relative p-card overflow-hidden">
              {/* Badge ribbon */}
              {subject.badge && (
                <span className={`absolute top-0 right-0 rounded-bl-2xl px-3 py-1 text-[9px] font-extrabold uppercase tracking-wide ${badgeColor}`}>
                  {subject.badge}
                </span>
              )}

              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon with Progress Ring Arc */}
                  <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
                    <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="#E8EDF3" strokeWidth="4" />
                      <circle cx="28" cy="28" r="24" fill="none" stroke={done ? '#2ECC71' : '#C5A028'} strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${(Math.min(subject.progressPercent, 100) / 100) * 150.8} 150.8`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">
                      {emoji}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-[14px] font-extrabold text-primary leading-tight">{isHi ? subject.nameHi : subject.nameEn}</p>

                    {/* Stats line */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[11px] font-extrabold text-secondary-700 tabular-nums">{subject.progressPercent}%</span>
                      <span className="text-[10px] text-gray-400 tabular-nums">• {subject.completedTopics + subject.completedTests}/{subject.totalTopics + Math.max(subject.testCount, subject.totalTopics * 5)} {isHi ? 'पूरा' : 'done'}</span>
                    </div>

                    {/* Content counts + accuracy */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full tabular-nums">{isHi ? 'टॉपिक' : 'Topic'} {subject.completedTopics}/{subject.topicCount}</span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary-500 bg-primary-50 px-2 py-0.5 rounded-full tabular-nums">{isHi ? 'टेस्ट' : 'Test'} {subject.completedTests}/{subject.testCount}</span>
                      {subject.accuracy !== null && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-success/15 px-2 py-0.5 rounded-full tabular-nums">{isHi ? 'सटीकता' : 'Accuracy'} {subject.accuracy}%</span>
                      )}
                      {subject.lastStudied && (
                        <span className="text-[10px] text-gray-400">
                          {getRelativeTime(subject.lastStudied, isHi)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress + action */}
                <div className="mt-3.5 flex items-center gap-3">
                  <div className="flex-1 h-2 bg-primary-50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${done ? 'bg-success' : 'bg-gradient-to-r from-secondary-500 to-secondary-200'}`} style={{ width: `${Math.min(subject.progressPercent, 100)}%` }} />
                  </div>
                  <button
                    onClick={async () => { api.post('/api/study-plan/visit-subject', { subjectId: subject.id }).catch(() => {}); navigate(`/study-plan/subject/${subject.id}`); }}
                    className={done ? 'p-btn-ghost !px-4 !py-2 !text-[11px] shrink-0' : subject.progressPercent > 0 ? 'p-btn-navy !px-4 !py-2 !text-[11px] shrink-0' : 'p-btn !px-4 !py-2 !text-[11px] shrink-0'}
                  >
                    {done
                      ? (isHi ? 'पूर्ण ✓' : 'Completed ✓')
                      : subject.progressPercent > 0
                        ? (isHi ? 'जारी →' : 'Continue →')
                        : (isHi ? 'शुरू →' : 'Start →')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Daily Study Goal */}
      <div className="rounded-3xl bg-gradient-to-r from-secondary-100 via-secondary-50 to-white border border-secondary-100 shadow-[0_8px_30px_-14px_rgba(197,160,40,0.6)] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-secondary/20 flex items-center justify-center text-xl">🎯</span>
          <div>
            <p className="text-[13px] font-bold text-primary">{isHi ? 'दैनिक लक्ष्य' : 'Daily Study Goal'}</p>
            <p className="text-[11px] text-primary-400 mt-0.5">
              {dailyGoal.remaining > 0
                ? (isHi ? `${dailyGoal.remaining} और टॉपिक बाकी` : `${dailyGoal.remaining} more to go`)
                : (isHi ? '🎉 लक्ष्य पूरा!' : '🎉 Goal achieved!')}
            </p>
          </div>
        </div>
        <span className="text-sm font-extrabold text-primary-800 bg-secondary px-3 py-1.5 rounded-full shadow tabular-nums">
          {dailyGoal.completed}/{dailyGoal.target}
        </span>
      </div>
    </div>
  );
}

function HeaderBar({ isHi, navigate }: { isHi: boolean; navigate: ReturnType<typeof useNavigate> }) {
  return (
    <PageHero
      title={isHi ? 'अध्ययन योजना' : 'Study Plan'}
      left={
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white/15 backdrop-blur border border-white/10 active:scale-95 transition-transform"
          aria-label={isHi ? 'वापस' : 'Back'}
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      }
    />
  );
}

// ─── Quick Stats Bar ──────────────────────────────────────────────────

function QuickStatsBar({ isHi }: { isHi: boolean }) {
  const [stats, setStats] = useState<{ totalTopics: number; completedTopics: number; totalTests: number; passedTests: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/study-plan/study-screen')
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        if (data?.subjects) {
          let totalTopics = 0, completedTopics = 0, totalTests = 0, passedTests = 0;
          for (const s of data.subjects) {
            totalTopics += s.topicCount ?? 0;
            completedTopics += s.completedTopics ?? 0;
            totalTests += s.testCount ?? 0;
            passedTests += s.completedTests ?? 0;
          }
          setStats({ totalTopics, completedTopics, totalTests, passedTests });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2.5 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs">📚</span>
        <span className="text-[11px] font-semibold text-gray-700">{stats.completedTopics}/{stats.totalTopics}</span>
        <span className="text-[10px] text-gray-400">{isHi ? 'टॉपिक' : 'Topics'}</span>
      </div>
      <div className="w-px h-4 bg-gray-200 shrink-0" />
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-xs">📝</span>
        <span className="text-[11px] font-semibold text-gray-700">{stats.passedTests}/{stats.totalTests}</span>
        <span className="text-[10px] text-gray-400">{isHi ? 'टेस्ट' : 'Tests'}</span>
      </div>
    </div>
  );
}


// ─── Exam Readiness Meter ─────────────────────────────────────────────

function ExamReadinessMeter({ isHi }: { isHi: boolean }) {
  const [data, setData] = useState<{
    readinessPct: number;
    totalTopics: number;
    completedTopics: number;
    totalTests: number;
    passedTests: number;
    accuracy: number;
    daysLeft: number | null;
    examName: string;
    weakestSubject: string | null;
    weakestSubjectAccuracy: number;
    milestone: string | null;
    level: string;
    levelEmoji: string;
    focusMessage: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get('/api/study-plan/study-screen'),
      api.get('/api/dashboard/performance?period=all'),
      api.get('/api/dashboard/home'),
      api.get('/api/profile').catch(() => ({ data: { data: null } })),
    ]).then(([studyRes, perfRes, homeRes, profileRes]) => {
      if (cancelled) return;

      const studyData = studyRes.data?.data;
      const perfData = perfRes.data?.data;
      const homeData = homeRes.data?.data;
      const profileData = profileRes.data?.data;

      if (!studyData?.subjects) return;

      let totalTopics = 0, completedTopics = 0, totalTests = 0, passedTests = 0;
      let worstSubject = '', worstPct = 101, worstAccuracy = 0;
      let untouchedSubject = '';

      for (const s of studyData.subjects) {
        totalTopics += s.topicCount ?? 0;
        completedTopics += s.completedTopics ?? 0;
        totalTests += s.testCount ?? 0;
        passedTests += s.completedTests ?? 0;
        if (s.progressPercent < worstPct) {
          worstPct = s.progressPercent;
          worstSubject = isHi ? s.nameHi : s.nameEn;
          worstAccuracy = s.progressPercent;
        }
        if (s.progressPercent === 0 && !untouchedSubject) {
          untouchedSubject = isHi ? s.nameHi : s.nameEn;
        }
      }

      const totalItems = totalTopics + totalTests;
      const completedItems = completedTopics + passedTests;
      const readinessPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      const accuracy = perfData?.accuracy ?? 0;

      // Exam name
      const examObj = profileData?.exam;
      const examName = examObj
        ? (isHi ? (examObj.name_hi || examObj.nameHi || examObj.name_en || examObj.nameEn) : (examObj.name_en || examObj.nameEn)) || ''
        : '';

      // Generate two-line focus message about 2 subjects
      let focusMessage: string;
      const remaining = totalTopics - completedTopics;
      const sortedSubjects = [...(studyData.subjects || [])].sort((a: any, b: any) => a.progressPercent - b.progressPercent);
      const worst1 = sortedSubjects[0];
      const worst2 = sortedSubjects[1];

      if (totalItems === 0) {
        focusMessage = isHi
          ? 'कोई topic शुरू करो\ndaily 2-3 topics से शुरुआत करो'
          : 'Start any topic to begin\nAim for 2-3 topics daily';
      } else if (worst1 && worst2 && worst1.progressPercent < 50 && worst2.progressPercent < 50) {
        const n1 = isHi ? worst1.nameHi : worst1.nameEn;
        const n2 = isHi ? worst2.nameHi : worst2.nameEn;
        focusMessage = isHi
          ? `"${n1}" (${worst1.progressPercent}%) और "${n2}" (${worst2.progressPercent}%) सबसे कम progress\nइन दोनों पर daily focus करो`
          : `"${n1}" (${worst1.progressPercent}%) & "${n2}" (${worst2.progressPercent}%) need most work\nFocus on these two daily`;
      } else if (accuracy > 0 && accuracy < 45 && readinessPct > 30) {
        const n1 = worst1 ? (isHi ? worst1.nameHi : worst1.nameEn) : '';
        focusMessage = isHi
          ? `Accuracy सिर्फ ${accuracy}% — revision ज़रूरी है\n"${n1}" से revision शुरू करो`
          : `Accuracy only ${accuracy}% — revision needed\nStart revising "${n1}"`;
      } else if (remaining > 0 && remaining <= 5) {
        focusMessage = isHi
          ? `बस ${remaining} topics बाकी — finish line पास है!\nआज 2 topics complete करो 💪`
          : `Just ${remaining} topics left — almost there!\nComplete 2 topics today 💪`;
      } else if (worst1) {
        const n1 = isHi ? worst1.nameHi : worst1.nameEn;
        const n2 = worst2 ? (isHi ? worst2.nameHi : worst2.nameEn) : '';
        focusMessage = isHi
          ? `"${n1}" (${worst1.progressPercent}%) सबसे कमज़ोर\n${n2 ? `"${n2}" पर भी ध्यान दो` : 'इसे daily practice करो'}`
          : `"${n1}" (${worst1.progressPercent}%) is weakest\n${n2 ? `Also work on "${n2}"` : 'Practice it daily'}`;
      } else {
        focusMessage = isHi ? 'बढ़िया चल रहा है!\nconsistent रहो 🔥' : 'Going great!\nStay consistent 🔥';
      }

      // Level
      let level: string, levelEmoji: string;
      if (readinessPct >= 90) { level = isHi ? 'मास्टर' : 'Master'; levelEmoji = '👑'; }
      else if (readinessPct >= 75) { level = isHi ? 'एडवांस्ड' : 'Advanced'; levelEmoji = '🎓'; }
      else if (readinessPct >= 50) { level = isHi ? 'इंटरमीडिएट' : 'Intermediate'; levelEmoji = '⚡'; }
      else if (readinessPct >= 25) { level = isHi ? 'बिगिनर' : 'Beginner'; levelEmoji = '🌱'; }
      else { level = isHi ? 'स्टार्टर' : 'Starter'; levelEmoji = '🔰'; }

      // Milestone
      let milestone: string | null = null;
      if (remaining > 0 && remaining <= 5) {
        milestone = isHi ? `${remaining} और → पूरा!` : `${remaining} more → Done!`;
      } else if (readinessPct < 25) {
        milestone = isHi ? 'Next: 25% → बिगिनर 🌱' : 'Next: 25% → Beginner 🌱';
      } else if (readinessPct < 50) {
        milestone = isHi ? 'Next: 50% → इंटरमीडिएट ⚡' : 'Next: 50% → Intermediate ⚡';
      } else if (readinessPct < 75) {
        milestone = isHi ? 'Next: 75% → एडवांस्ड 🎓' : 'Next: 75% → Advanced 🎓';
      } else if (readinessPct < 90) {
        milestone = isHi ? 'Next: 90% → मास्टर 👑' : 'Next: 90% → Master 👑';
      }

      setData({
        readinessPct, totalTopics, completedTopics, totalTests, passedTests,
        accuracy, daysLeft: homeData?.daysLeft ?? null, examName,
        weakestSubject: worstSubject || null, weakestSubjectAccuracy: worstAccuracy,
        milestone, level, levelEmoji, focusMessage,
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isHi]);

  if (!data) {
    return (
      <div className="p-hero rounded-3xl p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/20 rounded w-1/3" />
          <div className="h-16 bg-white/20 rounded-full w-16" />
        </div>
      </div>
    );
  }

  const ringColor = data.readinessPct >= 75 ? '#2ECC71' : data.readinessPct >= 50 ? '#E7C345' : data.readinessPct >= 25 ? '#C5A028' : '#EF5F67';

  return (
    <div className="p-hero rounded-3xl p-5">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-secondary/25 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

      {/* Header: Title + Level */}
      <div className="flex items-center justify-between mb-1 relative z-10 gap-2">
        <h3 className="text-sm font-extrabold tracking-tight">{isHi ? 'परीक्षा तैयारी' : 'Exam Readiness'}</h3>
        <span className="text-[10px] font-bold bg-secondary text-primary-800 px-2.5 py-1 rounded-full shadow shrink-0">
          {data.levelEmoji} {data.level}
        </span>
      </div>

      {/* Exam name + Days left in text */}
      <p className="text-[11px] text-white/60 mb-4 relative z-10">
        {data.examName && <span>{data.examName}</span>}
        {data.examName && data.daysLeft !== null && <span> • </span>}
        {data.daysLeft !== null && (
          <span className="text-secondary-200 font-semibold">{data.daysLeft} {isHi ? 'दिन शेष' : 'days remaining'}</span>
        )}
      </p>

      {/* Ring + Stats */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="relative flex-shrink-0" style={{ width: 92, height: 92 }}>
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={ringColor} strokeWidth="7"
              strokeDasharray={`${(data.readinessPct / 100) * 213.6} 213.6`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black tabular-nums leading-none">{data.readinessPct}%</span>
            <span className="text-[8px] text-white/60 uppercase tracking-wider mt-0.5">{isHi ? 'तैयार' : 'ready'}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 border border-white/10 backdrop-blur rounded-2xl px-1.5 py-2 text-center">
              <p className="text-sm font-extrabold text-white tabular-nums">{data.completedTopics}/{data.totalTopics}</p>
              <p className="text-[8px] text-white/60 uppercase font-semibold tracking-wide mt-0.5">{isHi ? 'टॉपिक' : 'Topics'}</p>
            </div>
            <div className="bg-white/10 border border-white/10 backdrop-blur rounded-2xl px-1.5 py-2 text-center">
              <p className="text-sm font-extrabold text-white tabular-nums">{data.passedTests}/{data.totalTests}</p>
              <p className="text-[8px] text-white/60 uppercase font-semibold tracking-wide mt-0.5">{isHi ? 'टेस्ट' : 'Tests'}</p>
            </div>
            <div className="bg-secondary/20 border border-secondary/40 rounded-2xl px-1.5 py-2 text-center">
              <p className="text-sm font-extrabold text-secondary-200 tabular-nums">{data.accuracy}%</p>
              <p className="text-[8px] text-secondary-200/70 uppercase font-semibold tracking-wide mt-0.5">{isHi ? 'सटीकता' : 'Accuracy'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Focus Message — 2 lines */}
      <div className="mt-4 bg-white/10 border border-white/10 rounded-2xl px-3 py-2.5 relative z-10">
        {data.focusMessage.split('\n').map((line, i) => (
          <p key={i} className="text-[10px] text-white/80 leading-relaxed">
            {i === 0 && '💡 '}{line}
          </p>
        ))}
      </div>

      {/* Milestone */}
      {data.milestone && (
        <div className="mt-3 flex items-center gap-2 relative z-10">
          <span className="text-xs">🏆</span>
          <span className="text-[11px] text-secondary-200 font-medium">{data.milestone}</span>
        </div>
      )}
    </div>
  );
}


// ─── View Plan Modal (with Start/Done actions) ──────────────────────

function ViewPlanModal({ isHi, onClose }: { isHi: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<{ subjectId: string; subjectNameEn: string; subjectNameHi: string; durationMinutes: number; topics: { id: string; nameEn: string; nameHi: string; status: string }[]; tests: { id: string; titleEn: string; titleHi: string; attemptStatus: string; passed?: boolean; attemptCount?: number; attemptId?: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get('/api/study-plan/today-selections');
      setSubjects(res.data?.data?.items ?? []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Mark topic as completed
  const handleTopicDone = async (topicId: string) => {
    setCompleting(topicId);
    try {
      await api.post('/api/study-plan/mark-topic-done', { topicId });
      // Update local state
      setSubjects((prev) => prev.map((sub) => ({
        ...sub,
        topics: sub.topics.map((t) => t.id === topicId ? { ...t, status: 'completed' } : t),
      })));
    } catch {}
    setCompleting(null);
  };

  const totalMin = subjects.reduce((s, sub) => s + sub.durationMinutes, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-primary-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-full h-[85vh] sm:h-auto sm:max-h-[90vh] sm:max-w-lg rounded-t-[28px] sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0 sm:hidden"><span className="w-10 h-1.5 rounded-full bg-primary-100" /></div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-primary-50 flex-shrink-0">
          <h2 className="text-base font-extrabold text-primary">{isHi ? 'आज की योजना' : "Today's Plan"}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-50 active:scale-95 transition-transform" aria-label={isHi ? 'बंद करें' : 'Close'}>
            <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="px-5 py-2.5 bg-primary-50/60 border-b border-primary-50 flex items-center justify-between text-xs flex-shrink-0">
          <span className="text-gray-600">{subjects.length} {isHi ? 'विषय' : 'subjects'}</span>
          <span className="text-primary font-semibold">{Math.floor(totalMin / 60)}h {String(totalMin % 60).padStart(2, '0')}m {isHi ? 'कुल' : 'total'}</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">{isHi ? 'कोई योजना नहीं' : 'No plan created yet'}</p>
          ) : (
            <div className="space-y-3">
              {subjects.map((sub) => (
                <div key={sub.subjectId} className="rounded-2xl border border-primary-50 bg-white p-3.5 shadow-[0_4px_18px_-10px_rgba(27,58,92,0.3)]">
                  {/* Subject */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[13px] font-bold text-primary">📖 {isHi ? sub.subjectNameHi : sub.subjectNameEn}</p>
                    <span className="text-[10px] font-semibold text-secondary-700 bg-secondary-100 px-2.5 py-0.5 rounded-full tabular-nums">{sub.durationMinutes} {isHi ? 'मि' : 'min'}</span>
                  </div>

                  {/* Topics */}
                  {sub.topics.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase mb-1">{isHi ? 'टॉपिक' : 'Topics'}</p>
                      <div className="space-y-1.5">
                        {sub.topics.map((t) => (
                          <div key={t.id} className="flex items-center justify-between">
                            <span className={`text-[11px] ${t.status === 'completed' ? 'text-green-700' : 'text-gray-700'}`}>
                              {t.status === 'completed' ? '✓' : '•'} {isHi ? t.nameHi : t.nameEn}
                            </span>
                            {t.status === 'completed' ? (
                              <span className="text-[9px] bg-success/15 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                {isHi ? 'पूर्ण' : 'Done'}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleTopicDone(t.id)}
                                disabled={completing === t.id}
                                className="text-[9px] bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full font-medium disabled:opacity-50"
                              >
                                {completing === t.id ? '...' : (isHi ? 'शुरू करें' : 'Start')}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tests */}
                  {sub.tests.length > 0 && (
                    <div>
                      <p className="text-[9px] font-semibold text-gray-400 uppercase mb-1">{isHi ? 'टेस्ट' : 'Tests'}</p>
                      <div className="space-y-1.5">
                        {sub.tests.map((t) => (
                          <div key={t.id}>
                            <div className="flex items-center justify-between">
                              <span className={`text-[11px] ${t.attemptStatus === 'completed' ? (t.passed ? 'text-green-700' : 'text-accent-600') : 'text-gray-700'}`}>
                                {t.attemptStatus === 'completed' ? (t.passed ? '✅' : '❌') : '📝'} {isHi ? t.titleHi : t.titleEn}
                              </span>
                              {t.attemptStatus === 'completed' && t.passed ? (
                                <button
                                  onClick={() => { onClose(); navigate(`/tests/${t.id}/results/${t.attemptId}`); }}
                                  className="text-[9px] bg-success/15 text-green-700 px-2 py-0.5 rounded-full font-medium"
                                >
                                  {isHi ? 'परिणाम देखें' : 'View Result'}
                                </button>
                              ) : t.attemptStatus === 'completed' && !t.passed ? (
                                (t.attemptCount ?? 0) >= 5 ? (
                                  <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                                    {isHi ? 'सभी प्रयास उपयोग (5/5)' : 'All attempts used (5/5)'}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => { onClose(); navigate(`/tests/${t.id}/attempt`); }}
                                    className="text-[9px] bg-secondary-100 text-secondary-700 px-2 py-0.5 rounded-full font-medium"
                                  >
                                    {isHi ? `पुनः प्रयास (${t.attemptCount ?? 0}/5)` : `Reattempt (${t.attemptCount ?? 0}/5)`}
                                  </button>
                                )
                              ) : (
                                <button
                                  onClick={() => { onClose(); navigate(`/tests/${t.id}/attempt`); }}
                                  className="text-[9px] bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full font-medium"
                                >
                                  {isHi ? 'शुरू करें' : 'Start'}
                                </button>
                              )}
                            </div>
                            {t.attemptStatus === 'completed' && t.passed && (
                              <span className="text-[9px] text-green-700 ml-4 mt-0.5">
                                {isHi ? '✅ पास' : '✅ Passed'}
                              </span>
                            )}
                            {t.attemptStatus === 'completed' && !t.passed && (
                              <span className="text-[9px] text-accent-600 ml-4 mt-0.5">
                                {isHi ? '❌ फेल' : '❌ Failed'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
