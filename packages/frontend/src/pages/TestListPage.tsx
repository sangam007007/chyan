import { useState, useEffect, useCallback } from 'react';
import { NegativeMarkingChip } from '@/components/test/MarkingInfo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { PageHero } from '@/components/ui/premium';

// ─── Types ───────────────────────────────────────────────────────────────

interface Test {
  id: string;
  titleEn: string;
  titleHi: string;
  category: string;
  duration: number;
  totalMarks: number;
  totalQuestions: number;
  negativeMarkingRatio?: number;
  marksPerQuestion?: number;
  pricingType: string;
  attemptStatus: string;
  attemptCount: number;
  maxAttempts: number;
  lastScore?: number;
  lastAttemptId?: string;
  subjectNameEn?: string | null;
  subjectNameHi?: string | null;
  topicNameEn?: string | null;
  topicNameHi?: string | null;
  lastAttemptedAt?: string | null;
  bestPercentage?: number | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Subject tree types
interface SubjectTreeTest {
  id: string;
  titleEn: string;
  titleHi: string;
  questionCount: number;
  duration: number;
  totalMarks: number;
  negativeMarkingRatio?: number;
  marksPerQuestion?: number;
  attemptStatus: 'completed' | 'in_progress' | 'not_attempted';
  passed: boolean | null;
  bestPercentage: number | null;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptId: string | null;
}

interface SubjectTreeTopic {
  id: string;
  nameEn: string;
  nameHi: string;
  tests: SubjectTreeTest[];
}

interface SubjectTreeSubject {
  id: string;
  nameEn: string;
  nameHi: string;
  accuracy: number | null;
  totalTests: number;
  completedTests: number;
  fullSubjectTests: SubjectTreeTest[];
  topics: SubjectTreeTopic[];
}

// ─── Constants ───────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: 'all', labelEn: 'All', labelHi: 'सभी' },
  { id: 'full_mock', labelEn: 'Full Mock', labelHi: 'फुल मॉक' },
  { id: 'subject_wise', labelEn: 'Subject', labelHi: 'विषयवार' },
  { id: 'previous_year', labelEn: 'PYQ', labelHi: 'पिछले वर्ष' },
  { id: 'daily_practice', labelEn: 'Practice', labelHi: 'अभ्यास' },
];

const CATEGORY_CONFIG: Record<string, { en: string; hi: string; color: string; tile: string; icon: string }> = {
  full_mock: { en: 'Full Mock', hi: 'फुल मॉक', color: 'bg-primary-50 text-primary', tile: 'from-primary-100 to-primary-50', icon: '🏆' },
  subject_wise: { en: 'Subject', hi: 'विषयवार', color: 'bg-success/15 text-green-700', tile: 'from-green-100 to-green-50', icon: '📚' },
  previous_year: { en: 'PYQ', hi: 'पिछला वर्ष', color: 'bg-secondary-100 text-secondary-700', tile: 'from-secondary-100 to-secondary-50', icon: '🕘' },
  daily_practice: { en: 'Practice', hi: 'अभ्यास', color: 'bg-accent-50 text-accent-600', tile: 'from-accent-100 to-accent-50', icon: '⚡' },
};

const SUBJECT_ICONS: Record<string, string> = {
  Hindi: '📖',
  'General Knowledge': '🌍',
  'Numerical Ability': '🧮',
  'Mental Ability/Reasoning': '🧠',
};

function getSubjectIcon(nameEn: string): string {
  return SUBJECT_ICONS[nameEn] || '📘';
}

// ─── Small visual helpers ────────────────────────────────────────────────

/** Circular % ring. `tone` picks the arc colour. */
function MiniRing({ pct, size = 44, tone = 'gold', label }: { pct: number; size?: number; tone?: 'gold' | 'light' | 'pass'; label?: string }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, pct));
  const stroke = tone === 'gold' ? '#E7C345' : tone === 'pass' ? '#2ECC71' : '#FFFFFF';
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(safe / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="800">
          {Math.round(safe)}%
        </text>
      </svg>
      {label && <span className="text-[9px] text-white/60 mt-0.5">{label}</span>}
    </div>
  );
}

/** Score badge on a light card: green at 50%+, red below. */
function ScorePill({ pct }: { pct: number }) {
  const pass = pct >= 50;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${pass ? 'bg-success/15 text-green-700' : 'bg-accent-50 text-accent-600'}`}>
      {pass ? '✓' : '✕'} {Math.round(pct)}%
    </span>
  );
}

function StatusDot({ completed, passed }: { completed: boolean; passed: boolean | null }) {
  if (completed && passed === true) {
    return <span className="w-5 h-5 shrink-0 rounded-full bg-success text-white text-[10px] font-bold flex items-center justify-center">✓</span>;
  }
  if (completed && passed === false) {
    return <span className="w-5 h-5 shrink-0 rounded-full bg-accent-400 text-white text-[10px] font-bold flex items-center justify-center">✕</span>;
  }
  if (completed) {
    return <span className="w-5 h-5 shrink-0 rounded-full bg-primary-200 text-white text-[10px] font-bold flex items-center justify-center">•</span>;
  }
  return <span className="w-5 h-5 shrink-0 rounded-full border-2 border-primary-100 bg-white" />;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-primary-50/70 rounded-full px-2 py-0.5">{children}</span>;
}

/** Start / Reattempt / Max attempts / View result — same actions as before. */
function TestActions({
  isHi,
  completed,
  allUsed,
  onStart,
  resultPath,
  navigate,
  disabled,
  busyLabel,
  inline = false,
}: {
  inline?: boolean;
  isHi: boolean;
  completed: boolean;
  allUsed: boolean;
  onStart: () => void;
  resultPath: string | null;
  navigate: ReturnType<typeof useNavigate>;
  disabled?: boolean;
  busyLabel?: string | null;
}) {
  const resultLink = completed && resultPath && (
    <button onClick={() => navigate(resultPath)} className="text-[10px] text-primary-400 font-semibold underline underline-offset-2 whitespace-nowrap">
      {isHi ? 'परिणाम देखें' : 'View Result'}
    </button>
  );
  return (
    <div className={inline ? 'flex flex-row-reverse items-center gap-3 shrink-0' : 'flex flex-col items-end gap-1 shrink-0'}>
      {!completed && (
        <button
          onClick={onStart}
          disabled={disabled}
          className="px-3.5 py-1.5 text-[11px] font-extrabold text-primary-800 bg-secondary rounded-xl shadow-md active:scale-95 transition-transform disabled:opacity-50"
        >
          {busyLabel ?? (isHi ? 'शुरू करें' : 'Start')}
        </button>
      )}
      {completed && !allUsed && (
        <button
          onClick={onStart}
          disabled={disabled}
          className="px-3.5 py-1.5 text-[11px] font-bold text-primary bg-secondary-50 border border-secondary-200 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {busyLabel ?? (isHi ? 'पुनः प्रयास' : 'Reattempt')}
        </button>
      )}
      {completed && allUsed && (
        <span className="text-[9px] text-accent-500 font-medium">{isHi ? 'प्रयास समाप्त' : 'Max attempts'}</span>
      )}
      {resultLink}
    </div>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="p-card p-4 space-y-3 animate-pulse">
          <div className="h-4 bg-primary-50 rounded-full w-2/3" />
          <div className="h-3 bg-primary-50/70 rounded-full w-1/2" />
        </div>
      ))}
    </div>
  );
}

function StateCard({ icon, text, action }: { icon: string; text: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="p-card flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm text-gray-600">{text}</p>
      {action && (
        <button onClick={action.onClick} className="p-btn-navy">
          {action.label}
        </button>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────

export function TestListPage() {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHi = language === 'hi';

  const [tests, setTests] = useState<Test[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'subject_wise');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subject tree state
  const [subjectTree, setSubjectTree] = useState<SubjectTreeSubject[]>([]);
  const [subjectTreeLoading, setSubjectTreeLoading] = useState(false);
  const [subjectTreeError, setSubjectTreeError] = useState<string | null>(null);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [subjectSubTab, setSubjectSubTab] = useState<Record<string, 'full' | 'topic'>>({});

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (activeTab !== 'all') params.category = activeTab;
      const res = await api.get('/api/tests', { params });
      setTests(res.data.data);
      setPagination(res.data.pagination);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'NO_EXAM_SELECTED') {
        setError(isHi ? 'कृपया पहले एक परीक्षा चुनें' : 'Please select an exam first');
      } else {
        setError(isHi ? 'टेस्ट लोड करने में विफल' : 'Failed to load tests');
      }
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, isHi]);

  const fetchSubjectTree = useCallback(async () => {
    setSubjectTreeLoading(true);
    setSubjectTreeError(null);
    try {
      const res = await api.get('/api/tests/subject-tree');
      setSubjectTree(res.data.subjects);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'NO_EXAM_SELECTED') {
        setSubjectTreeError(isHi ? 'कृपया पहले एक परीक्षा चुनें' : 'Please select an exam first');
      } else {
        setSubjectTreeError(isHi ? 'विषय लोड करने में विफल' : 'Failed to load subjects');
      }
    } finally {
      setSubjectTreeLoading(false);
    }
  }, [isHi]);

  useEffect(() => {
    if (activeTab === 'subject_wise') {
      fetchSubjectTree();
    } else {
      fetchTests();
    }
  }, [activeTab, fetchTests, fetchSubjectTree]);

  // Refetch data when user navigates back to this page (e.g., after completing a test)
  useEffect(() => {
    const handleFocus = () => {
      if (activeTab === 'subject_wise') {
        fetchSubjectTree();
      } else {
        fetchTests();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeTab, fetchSubjectTree, fetchTests]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setPage(1);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) {
        next.delete(subjectId);
      } else {
        next.add(subjectId);
      }
      return next;
    });
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  };

  // Quick stats (subject view uses the tree, other tabs use the list)
  const isSubjectTab = activeTab === 'subject_wise';
  const attempted = isSubjectTab
    ? subjectTree.reduce((s, x) => s + (x.completedTests ?? 0), 0)
    : tests.filter((t) => t.attemptStatus === 'completed').length;
  const totalTests = isSubjectTab
    ? subjectTree.reduce((s, x) => s + (x.totalTests ?? 0), 0)
    : pagination?.total ?? tests.length;
  const donePct = totalTests > 0 ? Math.min(100, Math.round((attempted / totalTests) * 100)) : 0;

  return (
    <div className="pb-28">
      <PageHero
        title={isHi ? 'टेस्ट' : 'Tests'}
        subtitle={isHi ? 'अभ्यास करें, परखें, आगे बढ़ें' : 'Practise, measure, level up'}
        left={<div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/15 flex items-center justify-center text-xl backdrop-blur">📝</div>}
        right={
          <div className="text-right">
            <p className="text-xl font-black leading-none tabular-nums text-secondary-200">{attempted}<span className="text-xs text-white/60 font-semibold">/{totalTests}</span></p>
            <p className="text-[10px] text-white/60 mt-0.5">{isHi ? 'पूर्ण' : 'attempted'}</p>
          </div>
        }
      >
        {/* progress */}
        <div className="h-1.5 rounded-full bg-white/15 overflow-hidden mb-3">
          <div className="h-full rounded-full bg-gradient-to-r from-secondary-400 to-secondary-200" style={{ width: `${donePct}%` }} />
        </div>

        {/* Every finished attempt, one row per attempt */}
        <button
          onClick={() => navigate('/tests/my-results')}
          className="w-full mb-3 flex items-center justify-between rounded-2xl bg-white/10 border border-white/15 px-3 py-2 backdrop-blur active:scale-[0.99] transition-transform"
        >
          <span className="text-[12px] font-bold">🧾 {isHi ? 'मेरे परिणाम' : 'My Results'}</span>
          <span className="text-[11px] text-secondary-200 font-semibold">{isHi ? 'सभी प्रयास देखें' : 'See every attempt'} ›</span>
        </button>

        {/* Filter pills */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-1.5 w-max">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-secondary text-primary-800 shadow-md'
                    : 'bg-white/10 text-white/80 border border-white/10'
                }`}
              >
                {isHi ? tab.labelHi : tab.labelEn}
              </button>
            ))}
          </div>
        </div>
      </PageHero>

      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-4">
        {/* Subject Tree View */}
        {activeTab === 'subject_wise' && (
          <SubjectTreeView
            subjects={subjectTree}
            loading={subjectTreeLoading}
            error={subjectTreeError}
            expandedSubjects={expandedSubjects}
            expandedTopics={expandedTopics}
            toggleSubject={toggleSubject}
            toggleTopic={toggleTopic}
            subjectSubTab={subjectSubTab}
            setSubjectSubTab={setSubjectSubTab}
            isHi={isHi}
            navigate={navigate}
            onRetry={fetchSubjectTree}
          />
        )}

        {/* Flat List View for other tabs */}
        {activeTab !== 'subject_wise' && (
          <>
            {loading && <ListSkeleton />}

            {!loading && error && (
              <StateCard icon="⚠️" text={error} action={{ label: isHi ? 'पुनः प्रयास' : 'Retry', onClick: fetchTests }} />
            )}

            {/* Empty state */}
            {!loading && !error && tests.length === 0 && (
              <StateCard icon="📭" text={isHi ? 'कोई टेस्ट उपलब्ध नहीं' : 'No tests available'} />
            )}

            {/* Test Cards */}
            {!loading && !error && (
              <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:items-start">
                {tests.map((test) => {
                  const cat = CATEGORY_CONFIG[test.category] || { en: test.category, hi: test.category, color: 'bg-primary-50 text-primary', tile: 'from-primary-100 to-primary-50', icon: '📝' };
                  const isAttempted = test.attemptStatus === 'completed';
                  const allUsed = test.attemptCount >= test.maxAttempts;
                  const bestPct = test.bestPercentage ?? (test.lastScore != null && test.totalMarks > 0
                    ? Math.round((test.lastScore / test.totalMarks) * 100)
                    : null);

                  return (
                    <div key={test.id} className="p-card p-3.5 perf-fade">
                      <div className="flex items-start gap-3">
                        <div className={`w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br ${cat.tile} flex items-center justify-center text-xl`}>
                          {cat.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Category + Status */}
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${cat.color}`}>
                              {isHi ? cat.hi : cat.en}
                            </span>
                            {test.pricingType === 'free' && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-secondary-100 text-secondary-700">{isHi ? 'फ्री' : 'FREE'}</span>
                            )}
                            {isAttempted && bestPct !== null && <ScorePill pct={bestPct} />}
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-bold text-primary leading-snug line-clamp-2">
                            {isHi ? test.titleHi : test.titleEn}
                          </h3>

                          {/* Subject / Topic info */}
                          {(test.subjectNameEn || test.topicNameEn) && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">
                              {isHi ? (test.subjectNameHi || '') : (test.subjectNameEn || '')}
                              {test.topicNameEn && <span className="text-gray-300"> › </span>}
                              {isHi ? (test.topicNameHi || '') : (test.topicNameEn || '')}
                            </p>
                          )}

                          {/* Meta */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Meta>❓ {test.totalQuestions} {isHi ? 'प्रश्न' : 'Qs'}</Meta>
                            <Meta>⏱ {test.duration} {isHi ? 'मिनट' : 'min'}</Meta>
                            <Meta>⭐ {test.totalQuestions * (test.marksPerQuestion ?? 1)} {isHi ? 'अंक' : 'marks'}</Meta>
                            {test.negativeMarkingRatio !== undefined && (
                              <NegativeMarkingChip ratio={test.negativeMarkingRatio} isHi={isHi} marksPerQuestion={test.marksPerQuestion ?? 1} />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-primary-50">
                        <span className="text-[10px] text-primary-400 font-semibold">
                          {isAttempted ? `${test.attemptCount}/${test.maxAttempts} ${isHi ? 'प्रयास' : 'attempts'}` : (isHi ? 'अभी शुरू नहीं' : 'Not started')}
                        </span>
                        <TestActions
                          inline
                          isHi={isHi}
                          completed={isAttempted}
                          allUsed={allUsed}
                          onStart={() => navigate(`/tests/${test.id}/attempt`)}
                          resultPath={test.lastAttemptId ? `/tests/${test.id}/results/${test.lastAttemptId}` : null}
                          navigate={navigate}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-btn-ghost"
                >
                  {isHi ? '← पिछला' : '← Prev'}
                </button>
                <span className="text-xs font-semibold text-primary tabular-nums">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-btn-ghost"
                >
                  {isHi ? 'अगला →' : 'Next →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Subject Tree View Component ─────────────────────────────────────────

interface SubjectTreeViewProps {
  subjects: SubjectTreeSubject[];
  loading: boolean;
  error: string | null;
  expandedSubjects: Set<string>;
  expandedTopics: Set<string>;
  toggleSubject: (id: string) => void;
  toggleTopic: (id: string) => void;
  subjectSubTab: Record<string, 'full' | 'topic'>;
  setSubjectSubTab: (val: Record<string, 'full' | 'topic'>) => void;
  isHi: boolean;
  navigate: ReturnType<typeof useNavigate>;
  onRetry: () => void;
}

function SubjectTreeView({
  subjects,
  loading,
  error,
  expandedSubjects,
  expandedTopics,
  toggleSubject,
  toggleTopic,
  subjectSubTab,
  setSubjectSubTab,
  isHi,
  navigate,
  onRetry,
}: SubjectTreeViewProps) {
  if (loading) return <ListSkeleton rows={4} />;

  if (error) {
    return <StateCard icon="⚠️" text={error} action={{ label: isHi ? 'पुनः प्रयास' : 'Retry', onClick: onRetry }} />;
  }

  if (subjects.length === 0) {
    return <StateCard icon="📭" text={isHi ? 'कोई विषय उपलब्ध नहीं' : 'No subjects available'} />;
  }

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5 lg:items-start">
      {subjects.map((subject) => {
        const isExpanded = expandedSubjects.has(subject.id);
        const activeSub = subjectSubTab[subject.id] || 'topic';

        // progress numbers (same maths as before)
        const topicPassed = subject.topics.reduce((sum: number, t: any) =>
          sum + t.tests.filter((test: any) => test.passed === true).length, 0);
        const fullPassed = (subject.fullSubjectTests || []).filter((t: any) => t.passed === true).length;
        const overallTotal = subject.totalTests + 2; // + 2 full length
        const overallPct = overallTotal > 0 ? Math.round(((topicPassed + fullPassed) / overallTotal) * 100) : 0;
        const topicPct = subject.totalTests > 0 ? Math.round((topicPassed / subject.totalTests) * 100) : 0;

        const topicAccuracies: { name: string; pct: number }[] = [];
        for (const topic of subject.topics) {
          const completed = topic.tests.filter((t: any) => t.attemptStatus === 'completed');
          if (completed.length > 0) {
            const avgPct = completed.reduce((sum: number, t: any) => sum + (t.bestPercentage ?? 0), 0) / completed.length;
            topicAccuracies.push({ name: isHi ? topic.nameHi : topic.nameEn, pct: Math.round(avgPct) });
          }
        }
        const weak = topicAccuracies.filter((t) => t.pct < 40).sort((a, b) => a.pct - b.pct).slice(0, 2);
        const strong = topicAccuracies.filter((t) => t.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 2);

        return (
          <div key={subject.id} className="rounded-3xl overflow-hidden shadow-[0_14px_34px_-16px_rgba(27,58,92,0.55)] bg-white border border-primary-50 perf-fade">
            {/* Subject Header — navy card */}
            <button
              onClick={() => toggleSubject(subject.id)}
              className="w-full text-left relative overflow-hidden p-hero p-4"
              aria-expanded={isExpanded}
            >
              <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-secondary/20 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-10 -left-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />

              <div className="relative">
                {/* Top row: Icon + Name + Expand */}
                <div className="flex items-center justify-between gap-3 mb-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-2xl bg-white/15 border border-white/15 flex items-center justify-center text-lg">
                      {getSubjectIcon(subject.nameEn)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold text-white leading-tight truncate">
                        {isHi ? subject.nameHi : subject.nameEn}
                      </h3>
                      <p className="text-[10px] text-white/60 mt-0.5">
                        {subject.completedTests}/{subject.totalTests} {isHi ? 'टेस्ट पूर्ण' : 'tests done'}
                      </p>
                    </div>
                  </div>
                  <span className={`w-7 h-7 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white/80 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                </div>

                {/* Progress Rings Row */}
                <div className="flex items-center gap-4 mb-3.5">
                  <MiniRing pct={overallPct} tone="gold" label={isHi ? 'कुल' : 'Overall'} />
                  <MiniRing pct={subject.accuracy ?? 0} tone="light" label={isHi ? 'सटीकता' : 'Accuracy'} />

                  {/* Weak/Strong Topics */}
                  <div className="flex-1 min-w-0 space-y-1.5 ml-1">
                    {weak.length > 0 && (
                      <div className="bg-accent/20 border border-accent-300/30 rounded-xl px-2.5 py-1">
                        <span className="text-[9px] text-red-200 font-bold">{isHi ? '⚠️ कमज़ोर' : '⚠️ Weak'}</span>
                        <p className="text-[10px] text-white/85 truncate">{weak.map((t) => `${t.name} (${t.pct}%)`).join(', ')}</p>
                      </div>
                    )}
                    {strong.length > 0 && (
                      <div className="bg-success/20 border border-success/30 rounded-xl px-2.5 py-1">
                        <span className="text-[9px] text-green-200 font-bold">{isHi ? '💪 मज़बूत' : '💪 Strong'}</span>
                        <p className="text-[10px] text-white/85 truncate">{strong.map((t) => `${t.name} (${t.pct}%)`).join(', ')}</p>
                      </div>
                    )}
                    {weak.length === 0 && strong.length === 0 && (
                      <div className="bg-white/10 rounded-xl px-2.5 py-1.5">
                        <span className="text-[10px] text-white/60">{isHi ? 'टेस्ट दें डेटा देखने' : 'Take tests to see stats'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Separate progress */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/70 w-14 shrink-0">{isHi ? 'टॉपिक' : 'Topic'}</span>
                    <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-secondary-400 to-secondary-200 rounded-full" style={{ width: `${topicPct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-secondary-200 w-10 text-right tabular-nums">{topicPassed}/{subject.totalTests}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/70 w-14 shrink-0">{isHi ? 'फुल' : 'Full'}</span>
                    <div className="flex-1 h-1.5 bg-white/15 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-white/80 to-white rounded-full" style={{ width: `${(fullPassed / 2) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-white w-10 text-right tabular-nums">{fullPassed}/2</span>
                  </div>
                </div>

                {!isExpanded && <p className="text-[10px] text-white/45 mt-3">{isHi ? 'विस्तार करने के लिए टैप करें' : 'Tap to expand'}</p>}
              </div>
            </button>

            {/* Expanded Content — Sub-tabs: Full Length vs Topic Wise */}
            {isExpanded && (
              <div className="bg-white">
                {/* Sub-tab buttons */}
                <div className="p-3">
                  <div className="flex bg-primary-50 rounded-2xl p-1 gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubjectSubTab({ ...subjectSubTab, [subject.id]: 'full' }); }}
                      className={`flex-1 px-3 py-2 text-[11px] font-bold rounded-xl transition-all ${
                        activeSub === 'full' ? 'bg-primary text-white shadow-md' : 'text-primary-400'
                      }`}
                    >
                      {isHi ? 'पूर्ण टेस्ट' : 'Full Length'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSubjectSubTab({ ...subjectSubTab, [subject.id]: 'topic' }); }}
                      className={`flex-1 px-3 py-2 text-[11px] font-bold rounded-xl transition-all ${
                        activeSub === 'topic' ? 'bg-primary text-white shadow-md' : 'text-primary-400'
                      }`}
                    >
                      {isHi ? 'टॉपिक वाइज' : 'Topic Wise'}
                    </button>
                  </div>
                </div>

                {/* Full Length Content */}
                {activeSub === 'full' && (
                  <FullSubjectTestsSection subjectId={subject.id} isHi={isHi} navigate={navigate} isExpanded={true} />
                )}

                {/* Topic Wise Content */}
                {activeSub === 'topic' && (
                  <div className="px-3 pb-3 space-y-2">
                    {subject.topics.map((topic) => {
                      const isTopicExpanded = expandedTopics.has(topic.id);
                      const passedCount = topic.tests.filter((t: any) => t.passed === true).length;
                      const totalCount = topic.tests.length;
                      const completedTests = topic.tests.filter((t: any) => t.attemptStatus === 'completed');
                      const topicAccuracy = completedTests.length > 0
                        ? Math.round(completedTests.reduce((s: number, t: any) => s + (t.bestPercentage ?? 0), 0) / completedTests.length)
                        : null;

                      return (
                        <div key={topic.id} className="rounded-2xl border border-primary-50 bg-primary-50/40 overflow-hidden">
                          {/* Topic Header */}
                          <button
                            onClick={() => toggleTopic(topic.id)}
                            className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left"
                            aria-expanded={isTopicExpanded}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-[9px] text-primary-300 transition-transform ${isTopicExpanded ? 'rotate-90' : ''}`}>▶</span>
                              <span className="text-xs font-bold text-primary truncate">
                                {isHi ? topic.nameHi : topic.nameEn}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold text-primary-400 tabular-nums">{passedCount}/{totalCount} {isHi ? 'पास' : 'done'}</span>
                              {topicAccuracy !== null && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${topicAccuracy >= 70 ? 'bg-success/15 text-green-700' : topicAccuracy >= 40 ? 'bg-secondary-100 text-secondary-700' : 'bg-accent-50 text-accent-600'}`}>
                                  {topicAccuracy}%
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Tests List */}
                          {isTopicExpanded && (
                            <div className="px-2.5 pb-2.5 space-y-1.5">
                              {topic.tests.map((test) => {
                                const isCompleted = test.attemptStatus === 'completed';
                                const allUsed = test.attemptCount >= test.maxAttempts;

                                return (
                                  <div key={test.id} className="flex items-center justify-between gap-2 py-2.5 px-3 rounded-2xl bg-white border border-primary-50 shadow-sm">
                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                      <div className="mt-0.5"><StatusDot completed={isCompleted} passed={test.passed} /></div>
                                      <div className="min-w-0">
                                        <span className="block text-[12px] font-semibold text-primary leading-snug">
                                          {isHi ? test.titleHi : test.titleEn}
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                          <Meta>❓ {test.questionCount} {isHi ? 'प्रश्न' : 'Qs'}</Meta>
                                          <Meta>⏱ {test.duration} {isHi ? 'मिनट' : 'min'}</Meta>
                                          {test.negativeMarkingRatio !== undefined && (
                                            <NegativeMarkingChip ratio={test.negativeMarkingRatio} isHi={isHi} marksPerQuestion={test.marksPerQuestion ?? 1} />
                                          )}
                                          {isCompleted && (
                                            <span className="text-[10px] text-primary-400 font-semibold tabular-nums">{test.attemptCount}/{test.maxAttempts}</span>
                                          )}
                                          {isCompleted && test.bestPercentage !== null && (
                                            <span className={`text-[10px] font-extrabold ${test.bestPercentage >= 50 ? 'text-green-600' : 'text-accent-500'}`}>
                                              {isHi ? 'सर्वश्रेष्ठ' : 'Best'}: {Math.round(test.bestPercentage)}%
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <TestActions
                                      isHi={isHi}
                                      completed={isCompleted}
                                      allUsed={allUsed}
                                      onStart={() => navigate(`/tests/${test.id}/attempt`)}
                                      resultPath={test.lastAttemptId ? `/tests/${test.id}/results/${test.lastAttemptId}` : null}
                                      navigate={navigate}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─── Full Subject Tests (Dynamic Slots) ──────────────────────────────

interface FullTestSlot {
  slotNumber: number;
  status: 'not_started' | 'generated' | 'completed';
  questionCount: number;
  attemptCount: number;
  maxAttempts: number;
  bestPercentage: number | null;
  passed: boolean | null;
  lastAttemptId: string | null;
}

function FullSubjectTestsSection({ subjectId, isHi, navigate, isExpanded }: {
  subjectId: string;
  isHi: boolean;
  navigate: ReturnType<typeof useNavigate>;
  isExpanded: boolean;
}) {
  const [slots, setSlots] = useState<FullTestSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);

  useEffect(() => {
    if (!isExpanded || loaded) return;
    setLoading(true);
    api.get(`/api/tests/full-test-slots/${subjectId}`)
      .then((res) => {
        setSlots(res.data?.data ?? []);
        setLoaded(true);
      })
      .catch(() => { setLoaded(true); })
      .finally(() => setLoading(false));
  }, [isExpanded, subjectId, loaded]);

  const handleStart = async (slotNumber: number) => {
    setGenerating(slotNumber);
    try {
      const res = await api.post('/api/tests/full-test-generate', { subjectId, slotNumber });
      const testId = res.data?.data?.testId;
      if (testId) {
        navigate(`/tests/${testId}/attempt`);
      }
    } catch (err: any) {
      console.error('Full test generate error:', err?.response?.data || err);
      alert(err?.response?.data?.error?.message || 'Failed to generate test');
    } finally {
      setGenerating(null);
    }
  };

  if (!isExpanded) return null;
  if (loading) return (
    <div className="px-3 pb-3">
      <div className="h-14 bg-primary-50 rounded-2xl animate-pulse" />
    </div>
  );

  return (
    <div className="px-3 pb-3 space-y-2">
      {slots.map((slot) => {
        const isCompleted = slot.status === 'completed';
        const allUsed = slot.attemptCount >= slot.maxAttempts;
        const isGenerating = generating === slot.slotNumber;

        return (
          <div key={slot.slotNumber} className="flex items-center justify-between gap-2 py-3 px-3.5 rounded-2xl bg-gradient-to-r from-primary-50/70 to-white border border-primary-50 shadow-sm">
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <div className="mt-0.5"><StatusDot completed={isCompleted} passed={slot.passed} /></div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-bold text-primary">
                    {isHi ? `पूर्ण टेस्ट ${slot.slotNumber}` : `Full Test ${slot.slotNumber}`}
                  </span>
                  {isCompleted && slot.bestPercentage !== null && <ScorePill pct={slot.bestPercentage} />}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {slot.questionCount > 0 && <Meta>❓ {slot.questionCount} {isHi ? 'प्रश्न' : 'Qs'}</Meta>}
                  {isCompleted && (
                    <span className="text-[10px] text-primary-400 font-semibold tabular-nums">{slot.attemptCount}/{slot.maxAttempts}</span>
                  )}
                </div>
              </div>
            </div>
            <TestActions
              isHi={isHi}
              completed={isCompleted}
              allUsed={allUsed}
              onStart={() => handleStart(slot.slotNumber)}
              resultPath={slot.lastAttemptId ? `/tests/${subjectId}/results/${slot.lastAttemptId}` : null}
              navigate={navigate}
              disabled={isGenerating}
              busyLabel={isGenerating ? '...' : null}
            />
          </div>
        );
      })}
    </div>
  );
}
