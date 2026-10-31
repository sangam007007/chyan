import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { PageHero } from '@/components/ui/premium';

// ─── Types ────────────────────────────────────────────────────────────

interface TopicInfo {
  id: string;
  nameEn: string;
  nameHi: string;
  subjectId: string;
}

interface PartItem {
  id: string;
  partNumber: number;
  titleEn: string;
  titleHi: string;
  status: string;
  testId: string | null;
  testStatus: string;
  completedAt: string | null;
}

interface TopicPartsStats {
  totalParts: number;
  completedParts: number;
  totalTests: number;
  completedTests: number;
  allPartsCompleted: boolean;
  progressPercent: number;
}

interface TopicTest {
  id: string;
  titleEn: string;
  titleHi: string;
  attemptStatus: string;
  attemptId: string | null;
  passed: boolean;
  attemptCount: number;
  bestPercentage: number | null;
}

interface TopicPartsData {
  topic: TopicInfo;
  parts: PartItem[];
  tests: TopicTest[];
  stats: TopicPartsStats;
}

// ─── Progress Ring Component ──────────────────────────────────────────

function ProgressRing({
  percent,
  size = 80,
  strokeWidth = 6,
  color = '#E7C345',
  bgColor = '#E8EDF3',
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
}) {
  const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safePercent / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-500"
      />
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function TopicDetailPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { language } = useTranslation();
  const isHi = language === 'hi';

  const [data, setData] = useState<TopicPartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completingPartId, setCompletingPartId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'parts' | 'test'>('parts');

  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;
    setLoading(true);

    api.get(`/api/study-plan/topic-parts/${topicId}`)
      .then((res) => {
        if (!cancelled) setData(res.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [topicId]);

  // ─── Complete a part ──────────────────────────────────────────────────

  const handleCompletePart = async (partId: string) => {
    setCompletingPartId(partId);
    try {
      await api.post(`/api/study-plan/part/${partId}/complete`);
      // Update local state
      setData((prev) => {
        if (!prev) return prev;
        const updatedParts = prev.parts.map((p) =>
          p.id === partId
            ? { ...p, status: 'completed', completedAt: new Date().toISOString(), testStatus: p.testId ? 'unlocked' : 'no_test' }
            : p
        );
        const completedParts = updatedParts.filter((p) => p.status === 'completed').length;
        const totalItems = prev.stats.totalParts + (prev.stats.totalTests ?? 0);
        const doneItems = completedParts + (prev.stats.completedTests ?? 0);
        return {
          ...prev,
          parts: updatedParts,
          stats: {
            ...prev.stats,
            completedParts,
            allPartsCompleted: prev.stats.totalParts > 0 && completedParts >= prev.stats.totalParts,
            progressPercent: totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0,
          },
        };
      });
    } catch {
      // silently fail
    } finally {
      setCompletingPartId(null);
    }
  };

  // ─── Loading skeleton ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen pb-28">
        <div className="p-hero rounded-b-[32px] px-4 pt-5 pb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 bg-white/20 rounded-full animate-pulse" />
            <div className="w-48 h-6 bg-white/20 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="w-32 h-5 bg-white/20 rounded animate-pulse" />
              <div className="w-48 h-3 bg-white/20 rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 bg-white/20 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="px-4 mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-3xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-card text-center px-8 py-8 mx-4">
          <p className="text-gray-500 text-sm">{isHi ? 'टॉपिक नहीं मिला' : 'Topic not found'}</p>
          <button onClick={() => navigate(-1)} className="p-btn-navy mt-4">
            {isHi ? 'वापस जाएं' : 'Go back'}
          </button>
        </div>
      </div>
    );
  }

  const { topic, parts, tests: topicTests = [], stats } = data;
  const safeProgress = isNaN(stats.progressPercent) ? 0 : stats.progressPercent;
  const allPartsCompleted = stats.allPartsCompleted ?? (stats.totalParts > 0 && stats.completedParts >= stats.totalParts);
  const doneItems = stats.completedParts + (stats.completedTests ?? 0);
  const totalItems = stats.totalParts + (stats.totalTests ?? 0);

  return (
    <div className="min-h-screen pb-28">
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <PageHero
        title={isHi ? topic.nameHi : topic.nameEn}
        left={
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white/15 backdrop-blur border border-white/10 active:scale-95 transition-transform"
            aria-label={isHi ? 'वापस' : 'Back'}
          >
            <span className="text-white text-lg leading-none">←</span>
          </button>
        }
        className="pb-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-[11px] font-semibold text-white bg-white/15 border border-white/10 backdrop-blur px-2.5 py-1 rounded-full">📖 {isHi ? 'भाग' : 'Parts'} {stats.completedParts}/{stats.totalParts}</span>
              <span className="text-[11px] font-semibold text-white bg-white/15 border border-white/10 backdrop-blur px-2.5 py-1 rounded-full">📝 {isHi ? 'टेस्ट' : 'Test'} {stats.completedTests ?? 0}/{stats.totalTests ?? 0}</span>
            </div>
            <p className="text-2xl font-black tabular-nums leading-none">
              {doneItems}<span className="text-base font-semibold text-white/60"> / {totalItems}</span>
            </p>
            <p className="text-[11px] text-white/70 mt-1">{isHi ? 'पूर्ण' : 'done'}</p>
            <div className="mt-3 w-full max-w-[11rem]">
              <div className="h-2 bg-white/15 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-secondary-400 to-secondary-200 transition-all duration-500" style={{ width: `${safeProgress}%` }} />
              </div>
            </div>
          </div>

          <div className="relative flex-shrink-0">
            <ProgressRing
              percent={safeProgress}
              size={88}
              strokeWidth={8}
              color={safeProgress >= 100 ? '#2ECC71' : '#E7C345'}
              bgColor="rgba(255,255,255,0.18)"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-white text-lg font-black tabular-nums leading-none">{safeProgress}%</span>
              <span className="text-[8px] text-white/60 mt-0.5 uppercase tracking-wide">{isHi ? 'पूर्ण' : 'Complete'}</span>
            </div>
          </div>
        </div>
      </PageHero>

      {/* ─── Tabs (Parts | Test) ──────────────────────────────────────── */}
      <div className="px-4 lg:px-0 lg:max-w-xl mt-4 lg:mt-5">
        <div className="flex bg-white rounded-2xl p-1 shadow-[0_8px_30px_-12px_rgba(27,58,92,0.25)] border border-primary-50">
          <button
            onClick={() => setActiveTab('parts')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'parts' ? 'bg-primary text-white shadow-md' : 'text-primary-400'
            }`}
          >
            📖 {isHi ? 'भाग' : 'Parts'} ({stats.completedParts}/{stats.totalParts})
          </button>
          <button
            onClick={() => { if (allPartsCompleted) setActiveTab('test'); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
              activeTab === 'test' ? 'bg-primary text-white shadow-md' :
              allPartsCompleted ? 'text-primary-400' : 'text-gray-300 cursor-not-allowed'
            }`}
          >
            {allPartsCompleted ? '📝' : '🔒'} {isHi ? 'टेस्ट' : 'Test'} ({stats.completedTests ?? 0}/{stats.totalTests ?? 0})
          </button>
        </div>
      </div>

      {/* ─── Tab Content ──────────────────────────────────────────────── */}
      {activeTab === 'parts' ? (
      <div className="px-4 lg:px-0 mt-5 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:items-start">
        <div className="flex items-end justify-between px-1 lg:col-span-full">
          <h2 className="p-title text-[14px]">{isHi ? 'सभी भाग' : 'All Parts'}</h2>
          <span className="p-sub tabular-nums">{stats.completedParts}/{stats.totalParts}</span>
        </div>

        {parts.length === 0 ? (
          <div className="py-10 text-center p-card">
            <p className="text-sm text-gray-400">
              {isHi ? 'कोई भाग नहीं मिला' : 'No parts found'}
            </p>
          </div>
        ) : (
          parts.map((part) => {
            const isCompleted = part.status === 'completed';
            const isCompleting = completingPartId === part.id;

            return (
              <div
                key={part.id}
                className={`perf-fade relative overflow-hidden p-card p-4 transition-all ${
                  isCompleted ? 'border-success/40' : ''
                }`}
              >
                <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${isCompleted ? 'bg-success' : 'bg-gradient-to-b from-secondary-300 to-secondary-500'}`} />
                <div className="flex items-center gap-3 pl-1.5">
                  {/* Part Number Circle */}
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                    isCompleted ? 'bg-success/15' : 'bg-gradient-to-br from-primary-50 to-primary-100'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <span className="text-primary text-base font-extrabold tabular-nums">{part.partNumber}</span>
                    )}
                  </div>

                  {/* Part Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-primary truncate">
                      {isHi ? part.titleHi : part.titleEn}
                    </h4>
                    <p className={`text-[11px] mt-0.5 ${isCompleted ? 'text-green-700 font-semibold' : 'text-gray-400'}`}>
                      {isCompleted
                        ? (isHi ? '✅ पूर्ण' : '✅ Completed')
                        : (isHi ? 'शुरू नहीं' : 'Not started')}
                    </p>
                  </div>

                  {/* Action Button */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <span className="inline-flex px-3 py-1.5 bg-success/15 text-green-700 text-[11px] font-bold rounded-full">
                        {isHi ? 'पूर्ण ✅' : 'Done ✅'}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCompletePart(part.id)}
                        disabled={isCompleting}
                        className="p-btn !px-4 !py-2"
                      >
                        {isCompleting
                          ? '...'
                          : (isHi ? 'पूरा करें' : 'Complete')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Test Section removed - now in separate Test tab */}
              </div>
            );
          })
        )}
      </div>
      ) : (
      /* ─── Test Tab Content ──────────────────────────────────────────── */
      <div className="px-4 lg:px-0 mt-5 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:items-start">
        <h2 className="p-title text-[14px] px-1 lg:col-span-full">{isHi ? 'टॉपिक टेस्ट' : 'Topic Tests'}</h2>
        {!allPartsCompleted ? (
          <div className="p-card p-7 text-center lg:col-span-full">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center text-2xl">🔒</div>
            <p className="text-sm font-bold text-primary mt-3">
              {isHi ? 'पहले सभी भाग पूरे करें' : 'Complete all parts first'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {isHi
                ? `${stats.completedParts}/${stats.totalParts} भाग पूर्ण`
                : `${stats.completedParts}/${stats.totalParts} parts completed`}
            </p>
          </div>
        ) : topicTests.length === 0 ? (
          <div className="p-card p-7 text-center">
            <span className="text-3xl">⏳</span>
            <p className="text-sm font-semibold text-primary mt-2">
              {isHi ? 'इस टॉपिक के टेस्ट जल्द आ रहे हैं' : 'Tests for this topic are coming soon'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {isHi ? 'टेस्ट आने के बाद ही यह टॉपिक 100% पूरा गिना जाएगा।' : 'This topic counts as 100% only once its tests are added and done.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {topicTests.map((test) => (
              <div key={test.id} className="perf-fade p-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-secondary-100 to-secondary-200 flex items-center justify-center">
                      <span className="text-lg">📝</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-bold text-primary truncate">
                        {isHi ? test.titleHi : test.titleEn}
                      </h4>
                      <p className="text-[11px] text-gray-400">
                        {test.attemptStatus === 'completed'
                          ? (test.passed
                              ? (isHi ? '✅ पास' : '✅ Passed')
                              : (isHi ? '❌ फेल' : '❌ Failed'))
                          : (isHi ? 'उपलब्ध' : 'Available')}
                        {test.bestPercentage != null && (
                          <span className={`ml-1.5 font-extrabold tabular-nums ${test.passed ? 'text-green-700' : 'text-accent-600'}`}>
                            {test.bestPercentage}%
                          </span>
                        )}
                      </p>
                      {test.attemptCount > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                          {isHi ? `प्रयास ${test.attemptCount}/5` : `Attempt ${test.attemptCount}/5`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                  {test.attemptStatus === 'completed' && test.passed ? (
                    <div className="flex flex-col items-end gap-1.5">
                      {test.attemptCount < 5 && (
                        <button
                          onClick={() => navigate(`/tests/${test.id}/attempt`)}
                          className="p-btn-ghost !px-3 !py-1.5 !text-[10px]"
                        >
                          {isHi ? 'पुनः प्रयास' : 'Reattempt'}
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/tests/${test.id}/results/${test.attemptId}`)}
                        className="px-3 py-1.5 bg-success/15 text-green-700 text-[10px] font-bold rounded-2xl active:scale-95 transition-transform"
                      >
                        {isHi ? 'परिणाम →' : 'Results →'}
                      </button>
                    </div>
                  ) : test.attemptStatus === 'completed' && !test.passed ? (
                    test.attemptCount >= 5 ? (
                      <span className="inline-flex px-3 py-1.5 bg-gray-100 text-gray-500 text-[11px] font-semibold rounded-full">
                        {isHi ? '5/5 प्रयास उपयोग' : '5/5 attempts used'}
                      </span>
                    ) : (
                      <button
                        onClick={() => navigate(`/tests/${test.id}/attempt`)}
                        className="p-btn"
                      >
                        {isHi ? 'पुनः प्रयास →' : 'Reattempt →'}
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => navigate(`/tests/${test.id}/attempt`)}
                      className="p-btn"
                    >
                      {isHi ? 'टेस्ट दें' : 'Start Test'}
                    </button>
                  )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// End of file
