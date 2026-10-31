import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { PageHero } from '@/components/ui/premium';

// ─── Types ────────────────────────────────────────────────────────────

interface SubjectInfo {
  id: string;
  nameEn: string;
  nameHi: string;
}

interface ContinueLearning {
  topicId: string;
  topicNameEn: string;
  topicNameHi: string;
  completedParts: number;
  totalParts: number;
  completedTests: number;
  testCount: number;
  completedTopics: number;
  totalTopics: number;
  lastActivity: string | null;
  progressPercent: number;
}

interface TopicItem {
  id: string;
  nameEn: string;
  nameHi: string;
  status: string;
  testCount: number;
  completedTests: number;
  totalParts: number;
  completedParts: number;
  progressPercent: number;
}

interface Stats {
  totalTopics: number;
  completedTopics: number;
  totalTests: number;
  completedTests: number;
}

interface DailyGoal {
  completed: number;
  target: number;
  remaining: number;
}

interface SubjectDetailData {
  subject: SubjectInfo;
  continueLearning: ContinueLearning | null;
  topics: TopicItem[];
  stats: Stats;
  dailyGoal: DailyGoal;
}

type FilterTab = 'all' | 'ongoing' | 'completed' | 'not_started';

const TOPIC_EMOJIS = ['📖', '📚', '📜', '🏛️', '⚔️', '🌍', '🗺️', '🎭', '🏺', '📿', '🕌', '⛩️'];

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

// ─── Progress Ring Component ──────────────────────────────────────────

function ProgressRing({
  percent,
  size = 80,
  strokeWidth = 6,
  color = '#C5A028',
  bgColor = '#E8EDF3',
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

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

export function SubjectDetailPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { language } = useTranslation();
  const isHi = language === 'hi';

  const [data, setData] = useState<SubjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showAllTopics, setShowAllTopics] = useState(false);


  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    setLoading(true);

    api.get(`/api/study-plan/subject-detail/${subjectId}`).then((subjectRes) => {
      if (cancelled) return;
      setData(subjectRes.data?.data ?? null);
    }).catch(() => {
      if (!cancelled) setData(null);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [subjectId]);

  // ─── Filtered topics ─────────────────────────────────────────────────

  const filteredTopics = useMemo(() => {
    if (!data) return [];
    let topics = data.topics;

    if (activeFilter === 'ongoing') {
      topics = topics.filter((t) => t.status === 'in_progress' || t.status === 'unlocked');
    } else if (activeFilter === 'completed') {
      topics = topics.filter((t) => t.status === 'completed');
    } else if (activeFilter === 'not_started') {
      topics = topics.filter((t) => t.status === 'not_started' || t.status === 'locked');
    }

    return topics;
  }, [data, activeFilter]);

  const displayedTopics = showAllTopics ? filteredTopics : filteredTopics.slice(0, 5);

  // ─── Loading skeleton ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen pb-28">
        <div className="p-hero rounded-b-[32px] px-4 pt-5 pb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-white/20 rounded-full animate-pulse" />
            <div className="w-40 h-6 bg-white/20 rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="w-48 h-5 bg-white/20 rounded animate-pulse" />
              <div className="w-32 h-4 bg-white/20 rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 bg-white/20 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="px-4 mt-4 space-y-4">
          <div className="h-36 bg-white rounded-3xl animate-pulse" />
          <div className="h-10 bg-white rounded-2xl animate-pulse" />
          <div className="h-56 bg-white rounded-3xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="p-card text-center px-8 py-8 mx-4">
          <p className="text-gray-500 text-sm">{isHi ? 'विषय नहीं मिला' : 'Subject not found'}</p>
          <button onClick={() => navigate(-1)} className="p-btn-navy mt-4">
            {isHi ? 'वापस जाएं' : 'Go back'}
          </button>
        </div>
      </div>
    );
  }

  const { subject, continueLearning, stats } = data;
  const totalItems = stats.totalTopics + stats.totalTests;
  const completedItems = stats.completedTopics + stats.completedTests;
  const completionPercent = totalItems > 0
    ? Math.min(100, Math.round((completedItems / totalItems) * 100)) : 0;

  const filterTabs: { key: FilterTab; icon: string; labelEn: string; labelHi: string }[] = [
    { key: 'all', icon: '📋', labelEn: 'All Topics', labelHi: 'सभी टॉपिक' },
    { key: 'ongoing', icon: '⏰', labelEn: 'Ongoing', labelHi: 'जारी' },
    { key: 'completed', icon: '✅', labelEn: 'Completed', labelHi: 'पूर्ण' },
    { key: 'not_started', icon: '▶️', labelEn: 'Not Started', labelHi: 'शुरू नहीं' },
  ];

  const levelLabel = completionPercent >= 90 ? '👑 ' + (isHi ? 'मास्टर' : 'Master')
    : completionPercent >= 75 ? '🎓 ' + (isHi ? 'विशेषज्ञ' : 'Expert')
    : completionPercent >= 50 ? '⚡ ' + (isHi ? 'मध्यम' : 'Intermediate')
    : completionPercent >= 25 ? '🌱 ' + (isHi ? 'सीखना' : 'Learning')
    : '🔰 ' + (isHi ? 'शुरुआत' : 'Beginner');

  return (
    <div className="min-h-screen pb-28">
      {/* ─── Subject Hero ───────────────────────────────────────────── */}
      <PageHero
        title={isHi ? subject.nameHi : subject.nameEn}
        left={
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white/15 backdrop-blur border border-white/10 active:scale-95 transition-transform"
            aria-label={isHi ? 'वापस' : 'Back'}
          >
            <span className="text-white text-lg leading-none">←</span>
          </button>
        }
        right={
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-secondary text-primary-800 font-bold flex-shrink-0 shadow">
            {levelLabel}
          </span>
        }
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-white bg-white/15 border border-white/10 backdrop-blur px-2.5 py-1 rounded-full">📖 {isHi ? 'टॉपिक' : 'Topic'} {stats.completedTopics}/{stats.totalTopics}</span>
              <span className="text-[11px] font-semibold text-white bg-white/15 border border-white/10 backdrop-blur px-2.5 py-1 rounded-full">📝 {isHi ? 'टेस्ट' : 'Test'} {stats.completedTests}/{stats.totalTests}</span>
            </div>
            <p className="text-2xl font-black tabular-nums leading-none mt-3">
              {completedItems}<span className="text-base font-semibold text-white/60"> / {totalItems}</span>
            </p>
            <p className="text-[11px] text-white/70 mt-1">{isHi ? 'पूर्ण' : 'completed'}</p>
          </div>

          <div className="relative flex-shrink-0">
            <ProgressRing
              percent={completionPercent}
              size={88}
              strokeWidth={8}
              color={completionPercent >= 100 ? '#2ECC71' : '#E7C345'}
              bgColor="rgba(255,255,255,0.18)"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white text-lg font-black tabular-nums">{completionPercent}%</span>
            </div>
          </div>
        </div>
      </PageHero>

      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-4">
        {/* ─── Continue Learning Card ───────────────────────────────────── */}
        {continueLearning && (
          <div className="p-hero rounded-3xl p-4">
            <div className="pointer-events-none absolute -right-8 -bottom-10 w-32 h-32 rounded-full bg-secondary/25 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                📖
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-secondary-200 uppercase tracking-[0.15em] mb-1">
                  ✨ {isHi ? 'पढ़ाई जारी रखें' : 'Continue Learning'}
                </p>
                <h3 className="text-white text-[15px] font-extrabold mb-1 truncate">
                  {isHi ? continueLearning.topicNameHi : continueLearning.topicNameEn}
                </h3>
                <p className="text-white/70 text-[11px] mb-2.5">
                  {isHi ? 'भाग' : 'Parts'} {continueLearning.completedParts}/{continueLearning.totalParts} • {isHi ? 'टेस्ट' : 'Test'} {continueLearning.completedTests ?? 0}/{continueLearning.testCount ?? 0}
                  {continueLearning.lastActivity && (
                    <span className="text-white/50 ml-2">• {getRelativeTime(continueLearning.lastActivity, isHi)}</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-secondary-400 to-secondary-200 rounded-full transition-all duration-300"
                      style={{ width: `${continueLearning.progressPercent}%` }}
                    />
                  </div>
                  <span className="text-white/80 text-[11px] font-bold tabular-nums">{continueLearning.progressPercent}%</span>
                </div>
              </div>
            </div>
            <div className="relative mt-3 flex justify-end">
              <button
                onClick={() => navigate(`/study-plan/topic/${continueLearning.topicId}`)}
                className="p-btn"
              >
                {isHi ? 'जारी रखें →' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Filter Tabs ──────────────────────────────────────────────── */}
        <div className="-mx-4 px-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveFilter(tab.key); setShowAllTopics(false); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap rounded-full transition-all ${
                activeFilter === tab.key
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-white text-primary-400 border border-primary-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{isHi ? tab.labelHi : tab.labelEn}</span>
            </button>
          ))}
        </div>

        {/* ─── Topics Section ───────────────────────────────────────────── */}
        <div>
          <div className="mb-3 px-1">
            <h2 className="p-title text-[14px]">
              {isHi ? `टॉपिक (${stats.totalTopics})` : `Topics (${stats.totalTopics})`}
            </h2>
            <p className="p-sub mt-0.5">
              {isHi ? 'आपकी सीखने की यात्रा' : 'Your learning journey'}
            </p>
          </div>

          <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:items-start">
            {displayedTopics.length === 0 ? (
              <div className="py-10 text-center p-card">
                <p className="text-sm text-gray-400">
                  {isHi ? 'कोई टॉपिक नहीं मिला' : 'No topics found'}
                </p>
              </div>
            ) : (
              displayedTopics.map((topic, index) => {
                const isInProgress = topic.status === 'in_progress' || topic.status === 'unlocked';
                const isCompleted = topic.status === 'completed';
                const isLocked = topic.status === 'locked';
                const topicEmoji = TOPIC_EMOJIS[index % TOPIC_EMOJIS.length];
                const topicPercent = topic.progressPercent;

                return (
                  <div
                    key={topic.id}
                    className={`perf-fade relative overflow-hidden p-card p-4 transition-all ${
                      isInProgress ? '!border-secondary shadow-[0_10px_30px_-10px_rgba(197,160,40,0.55)]' : ''
                    } ${isLocked ? 'opacity-80' : ''}`}
                  >
                    <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isCompleted ? 'bg-success' : isInProgress ? 'bg-gradient-to-b from-secondary-300 to-secondary-500' : 'bg-primary-100'
                    }`} />
                    <div className="flex items-center gap-3 pl-1.5">
                      {/* Topic tile with status badge */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                          isCompleted ? 'bg-success/15' : isInProgress ? 'bg-secondary-100' : 'bg-primary-50'
                        } ${isLocked ? 'grayscale opacity-60' : ''}`}>
                          {topicEmoji}
                        </div>
                        <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] ${
                          isCompleted ? 'bg-success text-white' : isInProgress ? 'bg-secondary text-primary-800' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {isCompleted ? '✓' : isInProgress ? '▶' : isLocked ? '🔒' : '○'}
                        </span>
                      </div>

                      {/* Topic Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-[13px] font-bold truncate ${isLocked ? 'text-gray-400' : 'text-primary'}`}>
                          {index + 1}. {isHi ? topic.nameHi : topic.nameEn}
                        </h4>
                        <div className="mt-1">
                          <StatusBadge status={topic.status} isHi={isHi} />
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 tabular-nums">
                          <span>📖 {topic.completedParts}/{topic.totalParts} {isHi ? 'भाग' : 'Parts'}</span>
                          <span>📝 {topic.testCount === 0 ? (isHi ? 'टेस्ट जल्द आ रहे हैं' : 'Tests coming soon') : <>{topic.completedTests}/{topic.testCount} {isHi ? 'टेस्ट' : 'Tests'}</>}</span>
                        </div>
                      </div>

                      {/* Right: Progress Ring or Lock */}
                      <div className="flex items-center flex-shrink-0">
                        {isLocked ? (
                          <div className="w-11 h-11 rounded-full bg-primary-50 flex items-center justify-center">
                            <span className="text-gray-400 text-lg">🔒</span>
                          </div>
                        ) : (
                          <div className="relative">
                            <ProgressRing
                              percent={topicPercent}
                              size={44}
                              strokeWidth={5}
                              color={isCompleted ? '#2ECC71' : '#C5A028'}
                              bgColor="#E8EDF3"
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-[10px] font-extrabold tabular-nums ${isCompleted ? 'text-green-700' : 'text-primary'}`}>
                                {topicPercent}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action button for all non-locked topics */}
                    {!isLocked && (
                      <div className="mt-3 pt-3 border-t border-primary-50 flex justify-end">
                        <button
                          onClick={() => navigate(`/study-plan/topic/${topic.id}`)}
                          className={topic.progressPercent >= 100 ? 'p-btn-ghost !px-4 !py-2' : 'p-btn !px-5 !py-2'}
                        >
                          {topic.progressPercent >= 100
                            ? (isHi ? 'पूर्ण ✓' : 'Completed ✓')
                            : topic.completedParts > 0
                              ? (isHi ? 'जारी रखें →' : 'Continue →')
                              : (isHi ? 'शुरू करें →' : 'Start →')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* View All Button */}
          {filteredTopics.length > 5 && !showAllTopics && (
            <button
              onClick={() => setShowAllTopics(true)}
              className="p-btn-ghost w-full mt-3 !py-3 !text-sm"
            >
              {isHi
                ? `सभी ${stats.totalTopics} टॉपिक देखें ∨`
                : `View All ${stats.totalTopics} Topics ∨`}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Status Badge Component ───────────────────────────────────────────

function StatusBadge({ status, isHi }: { status: string; isHi: boolean }) {
  const config: Record<string, { bg: string; text: string; labelEn: string; labelHi: string }> = {
    completed: { bg: 'bg-success/15', text: 'text-green-700', labelEn: 'Completed', labelHi: 'पूर्ण' },
    in_progress: { bg: 'bg-secondary-100', text: 'text-secondary-700', labelEn: 'In Progress', labelHi: 'जारी' },
    unlocked: { bg: 'bg-secondary-100', text: 'text-secondary-700', labelEn: 'In Progress', labelHi: 'जारी' },
    not_started: { bg: 'bg-primary-50', text: 'text-primary-400', labelEn: 'Not Started', labelHi: 'शुरू नहीं' },
    locked: { bg: 'bg-gray-100', text: 'text-gray-500', labelEn: 'Locked', labelHi: 'लॉक' },
  };

  const c = config[status] || config.not_started;

  return (
    <span className={`inline-flex text-[10px] px-2 py-0.5 rounded-full font-bold ${c.bg} ${c.text}`}>
      {isHi ? c.labelHi : c.labelEn}
    </span>
  );
}
