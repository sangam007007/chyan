import { useState, useEffect } from 'react';
import { NegativeMarkingChip, marksFormula } from '@/components/test/MarkingInfo';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { TestDiscussionCard } from '@/components/discussion/TestDiscussionCard';
import { COMMENTS, commentBand, type CommentBand } from '@/data/resultComments';

// --- Types ---

interface SubjectBreakdown {
  subject: string;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
}

interface TestResults {
  attemptId: string;
  testId: string;
  status: string;
  totalScore: number;
  maxScore: number;
  marksPerQuestion?: number;
  negativeMarkingRatio?: number;
  passPercentage?: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number;
  startedAt: string;
  submittedAt: string;
  percentile: number;
  subjectBreakdown: SubjectBreakdown[];
  peer: PeerStat | null;
  /** The comment picked for this attempt (saved on the server, so it never changes) */
  comment: { band: CommentBand; index: number } | null;
}

/** How other students did on their first attempt (anonymous aggregate). */
interface PeerStat {
  scope: 'test' | 'subject';
  participants: number;
  topicParticipants: number | null;
  avgScore: number;
  avgPercentage: number;
  avgCorrect: number;
  yourFirstPercentage: number | null;
  yourFirstScore: number | null;
}

interface AttemptHistoryItem {
  id: string;
  attemptNumber: number;
  submittedAt: string;
  totalScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number;
}

// --- Helpers ---

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${String(remMins).padStart(2, '0')}m`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDate(dateStr: string, isHi: boolean): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// --- Progress Ring ---

function ScoreRing({ percent, size = 120, passed, label = 'Score' }: { percent: number; size?: number; passed: boolean; label?: string }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercent = isNaN(percent) ? 0 : Math.min(100, Math.max(0, percent));
  const offset = circumference - (safePercent / 100) * circumference;
  const color = passed ? '#E7C345' : safePercent >= 40 ? '#F3B65B' : '#EF5F67';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white tabular-nums leading-none">{Math.round(safePercent)}%</span>
        <span className="text-[10px] lg:text-sm text-white/60 mt-1">{label}</span>
      </div>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="p-card p-3.5 text-center">
      <span className="text-base">{icon}</span>
      <p className="p-num text-lg leading-tight mt-0.5">{value}</p>
      <p className="text-[10px] lg:text-sm text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

// --- Peer comparison ---

function PeerCard({ peer, results, isHi }: { peer: PeerStat; results: TestResults; isHi: boolean }) {
  const mine = peer.yourFirstPercentage;
  const diff = mine == null ? null : mine - peer.avgPercentage;
  const early = peer.participants < 5;
  const Bar = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
    <div>
      <div className="flex items-center justify-between text-xs lg:text-sm mb-1">
        <span className="font-semibold text-gray-600">{label}</span>
        <span className="font-extrabold tabular-nums text-primary">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-primary-50 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );

  return (
    <div className="p-card p-4">
      <p className="p-title mb-1">👥 {isHi ? 'दूसरे छात्रों से तुलना' : 'How other students did'}</p>
      <p className="text-xs lg:text-sm text-gray-500 leading-snug">
        {peer.scope === 'subject'
          ? (isHi ? `${peer.participants} छात्रों ने इस विषय के फुल टेस्ट दिए` : `${peer.participants} student${peer.participants === 1 ? '' : 's'} took the full tests of this subject`)
          : (isHi ? `${peer.participants} छात्रों ने यह टेस्ट दिया` : `${peer.participants} student${peer.participants === 1 ? '' : 's'} took this test`)}
        {peer.topicParticipants != null && peer.topicParticipants > 0 && (
          <> · {isHi ? `इस टॉपिक को ${peer.topicParticipants} छात्रों ने कवर किया` : `${peer.topicParticipants} covered this topic`}</>
        )}
      </p>

      <div className="mt-3 space-y-3">
        <Bar
          label={isHi ? 'सबका औसत' : 'Everyone\'s average'}
          value={peer.avgPercentage}
          tone="bg-gradient-to-r from-primary-300 to-primary-200"
        />
        {mine != null && (
          <Bar
            label={isHi ? 'आपका पहला प्रयास' : 'Your first attempt'}
            value={mine}
            tone={diff != null && diff >= 0 ? 'bg-gradient-to-r from-success to-green-300' : 'bg-gradient-to-r from-accent-500 to-accent-200'}
          />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-primary-50/70 py-2">
          <p className="p-num text-base tabular-nums">
            {peer.scope === 'test' ? `${peer.avgScore}/${results.maxScore}` : `${peer.avgCorrect}/${results.totalQuestions}`}
          </p>
          <p className="text-[10px] lg:text-sm text-gray-500">{peer.scope === 'test' ? (isHi ? 'औसत अंक' : 'Average marks') : (isHi ? 'औसत सही उत्तर' : 'Average correct')}</p>
        </div>
        <div className={`rounded-2xl py-2 ${diff == null ? 'bg-primary-50/70' : diff >= 0 ? 'bg-green-50' : 'bg-accent-50'}`}>
          <p className={`p-num text-base tabular-nums ${diff == null ? '' : diff >= 0 ? '!text-green-700' : '!text-accent-600'}`}>
            {diff == null ? '–' : `${diff >= 0 ? '+' : ''}${diff}%`}
          </p>
          <p className="text-[10px] lg:text-sm text-gray-500">{isHi ? 'औसत से अंतर' : 'Vs average'}</p>
        </div>
      </div>

      <p className="mt-3 text-[10px] lg:text-xs text-gray-400 leading-snug">
        {isHi ? 'हर छात्र का सिर्फ़ पहला प्रयास गिना जाता है, इसलिए दोबारा देने से यह औसत नहीं बदलता।' : "Only each student's first attempt is counted, so retaking never changes this average."}
        {early && <> {isHi ? 'अभी कम छात्र हैं, इसलिए ये शुरुआती आंकड़े हैं।' : 'Few students so far, so these are early numbers.'}</>}
      </p>
    </div>
  );
}

// --- Funny comment next to the score ---

/** Stable fallback when the server did not send one (e.g. looking at an attempt that is not yours). */
function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function ScoreComment({ results, passed, percentage, attemptNumber, isHi }: { results: TestResults; passed: boolean; percentage: number; attemptNumber: number; isHi: boolean }) {
  const saved = results.comment;
  const band = saved?.band ?? commentBand(passed, percentage, attemptNumber);
  const list = COMMENTS[band] ?? [];
  if (list.length === 0) return null;
  const index = saved ? saved.index : hashOf(results.attemptId);
  const comment = list[index % list.length];
  return (
    <div className="relative mx-auto mt-5 flex max-w-xl items-start gap-3 rounded-2xl bg-white/12 border border-white/20 backdrop-blur px-4 py-3 text-left">
      <span className="text-2xl leading-none mt-0.5">{passed ? '😎' : '🤦'}</span>
      <p className="flex-1 text-[13px] lg:text-base font-semibold text-white leading-snug">{isHi ? comment.hi : comment.en}</p>
    </div>
  );
}

// --- Component ---

export function TestResultsPage() {
  const { language } = useTranslation();
  const isHi = language === 'hi';
  const { testId, attemptId } = useParams<{ testId: string; attemptId: string }>();
  const navigate = useNavigate();

  const [results, setResults] = useState<TestResults | null>(null);
  const [history, setHistory] = useState<AttemptHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchResults() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await api.get(`/api/attempts/${attemptId}/results`);
        const data = res.data?.data;
        if (data) {
          data.totalScore = Number(data.totalScore);
          data.maxScore = Number(data.maxScore);
          data.totalQuestions = Number(data.totalQuestions ?? data.correctCount + data.wrongCount + data.skippedCount);
          data.percentage = Number(data.percentage);
          data.percentile = Number(data.percentile);
          data.correctCount = Number(data.correctCount);
          data.wrongCount = Number(data.wrongCount);
          data.skippedCount = Number(data.skippedCount);
          data.timeTakenSeconds = Number(data.timeTakenSeconds);
        }
        setResults(data ?? null);
      } catch {
        setError(isHi ? 'परिणाम लोड करने में विफल' : 'Failed to load results');
      } finally {
        setIsLoading(false);
      }
    }
    if (attemptId) fetchResults();
  }, [attemptId, isHi]);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await api.get(`/api/tests/${testId}/attempts/history`);
        setHistory(res.data?.data ?? []);
      } catch { /* silent */ }
    }
    if (testId) fetchHistory();
  }, [testId]);

  if (isLoading) {
    return (
      <div className="px-4 pt-20 pb-28">
        <div className="p-card py-12 text-center space-y-3">
          <div className="w-14 h-14 border-4 border-primary-100 border-t-secondary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">{isHi ? 'परिणाम लोड हो रहे हैं...' : 'Loading results...'}</p>
        </div>
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className="px-4 pt-20 pb-28">
        <div className="p-card py-12 px-6 text-center space-y-3">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-accent-600">{error ?? (isHi ? 'कुछ गलत हो गया' : 'Something went wrong')}</p>
          <button onClick={() => navigate(-1)} className="p-btn-navy">
            {isHi ? 'वापस जाएं' : 'Go back'}
          </button>
        </div>
      </div>
    );
  }

  const totalQs = results.totalQuestions || (results.correctCount + results.wrongCount + results.skippedCount);
  // Percentage = marks after negative marking; pass/fail comes from the server so every screen agrees.
  const scorePercent = Math.max(0, Math.round(Number(results.percentage ?? 0)));
  const attempted = results.correctCount + results.wrongCount;
  const accuracyPercent = attempted > 0 ? Math.round((results.correctCount / attempted) * 100) : 0;
  const isPassed = results.passed ?? scorePercent >= (results.passPercentage ?? 60);
  const negRatio = Number(results.negativeMarkingRatio ?? 0);
  const mpq = Number(results.marksPerQuestion ?? 1);
  const avgTimePerQ = totalQs > 0 ? Math.round(results.timeTakenSeconds / totalQs) : 0;
  const currentAttemptIdx = history.findIndex((h) => h.id === attemptId);
  const prevAttempt = currentAttemptIdx > 0 ? history[currentAttemptIdx - 1] : null;
  const improvement = prevAttempt ? Math.round(results.percentage - prevAttempt.percentage) : null;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="p-hero rounded-b-[32px] lg:rounded-3xl lg:mt-6 px-4 pt-4 pb-14">
        <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-secondary/30 blur-2xl" />
        <div className="pointer-events-none absolute -left-12 bottom-0 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            aria-label={isHi ? 'वापस' : 'Back'}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 border border-white/10 backdrop-blur"
          >
            <span className="text-white text-lg">←</span>
          </button>
          {history.length > 1 && (
            <select
              value={attemptId}
              onChange={(e) => navigate(`/tests/${testId}/results/${e.target.value}`, { replace: true })}
              className="px-3 py-1.5 text-[11px] lg:text-[15px] font-semibold bg-white/15 backdrop-blur text-white rounded-xl border border-white/20 focus:outline-none"
            >
              {history.map((item) => (
                <option key={item.id} value={item.id} className="text-gray-900">
                  #{item.attemptNumber} — {Math.round(item.percentage)}%
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Result Message */}
        <div className="relative text-center mb-5">
          <span className="text-4xl">{isPassed ? '🏆' : '💪'}</span>
          <h1 className="text-xl font-extrabold text-white mt-2 leading-snug">
            {isPassed
              ? (isHi ? 'बधाई हो! आपने पास किया!' : 'Congratulations! You Passed!')
              : (isHi ? 'अगली बार बेहतर करें!' : 'Better luck next time!')}
          </h1>
          {improvement !== null && improvement !== 0 && (
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-[11px] lg:text-[15px] font-bold ${improvement > 0 ? 'bg-success/25 text-green-100' : 'bg-accent/30 text-red-100'}`}>
              {improvement > 0 ? `↑ ${improvement}%` : `↓ ${Math.abs(improvement)}%`} {isHi ? 'पिछले प्रयास से' : 'vs last attempt'}
            </span>
          )}
        </div>

        {/* Score Ring + Quick Stats */}
        <div className="relative flex items-center justify-center gap-6">
          <ScoreRing percent={scorePercent} size={118} passed={isPassed} label={isHi ? 'स्कोर' : 'Score'} />
          <div className="space-y-2">
            <div>
              <p className="text-white/70 text-[10px] lg:text-sm">{isHi ? 'सही उत्तर' : 'Correct'}</p>
              <p className="text-white text-2xl font-black tabular-nums leading-tight">{results.correctCount}<span className="text-sm text-white/60 font-semibold">/{totalQs}</span></p>
            </div>
            <span className={`inline-block px-3 py-1 rounded-full text-xs lg:text-[15px] font-extrabold ${isPassed ? 'bg-secondary text-primary-800' : 'bg-white/15 text-white border border-white/20'}`}>
              {isPassed ? (isHi ? '✓ पास' : '✓ Passed') : (isHi ? '✕ फेल' : '✕ Failed')}
            </span>
            <p className="text-white/55 text-[10px] lg:text-sm">{isHi ? `${results.passPercentage ?? 60}% पर पास` : `${results.passPercentage ?? 60}% to pass`}</p>
          </div>
        </div>
        <ScoreComment
          results={results}
          passed={isPassed}
          percentage={scorePercent}
          attemptNumber={history.find((h) => h.id === attemptId)?.attemptNumber ?? 1}
          isHi={isHi}
        />
      </div>

      {/* Content */}
      <div className="px-4 lg:px-0 -mt-8 space-y-4 relative lg:space-y-0 lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-5 lg:items-start">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-3 xl:col-span-4 lg:grid-cols-4">
          <StatTile icon="✅" label={isHi ? 'अंक' : 'Marks'} value={`${Number(results.totalScore)}/${Number(results.maxScore)}`} />
          <StatTile icon="🎯" label={isHi ? 'सटीकता (किए गए में)' : 'Accuracy (of attempted)'} value={`${accuracyPercent}%`} />
          <StatTile icon="⏱" label={isHi ? 'समय' : 'Time'} value={formatTime(results.timeTakenSeconds)} />
          <StatTile icon="⚡" label={isHi ? 'प्रति प्रश्न' : 'Per Question'} value={`${avgTimePerQ}s`} />
        </div>

        {/* How the score was calculated */}
        <div className="p-card p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="p-title">{isHi ? 'अंक कैसे बने' : 'How your marks were calculated'}</p>
            <NegativeMarkingChip ratio={negRatio} isHi={isHi} marksPerQuestion={mpq} />
          </div>
          <p className="text-[12px] leading-relaxed text-gray-700 rounded-2xl bg-primary-50/60 px-3 py-2.5">
            {marksFormula({
              correct: results.correctCount,
              wrong: results.wrongCount,
              ratio: negRatio,
              marksPerQuestion: mpq,
              totalQuestions: totalQs,
              percentage: scorePercent,
              isHi,
            })}
          </p>
          <p className="text-[10px] lg:text-sm text-gray-400 mt-2">
            {negRatio > 0
              ? (isHi ? 'छोड़े गए प्रश्नों के अंक नहीं कटते।' : 'Skipped questions are not penalised.')
              : (isHi ? 'इस टेस्ट में गलत जवाब पर अंक नहीं कटते।' : 'Wrong answers do not cost marks in this test.')}
          </p>
        </div>

        {/* Answer Breakdown Bar */}
        <div className="p-card p-4">
          <p className="p-title mb-3">{isHi ? 'उत्तर विश्लेषण' : 'Answer Analysis'}</p>
          <div className="flex h-3.5 rounded-full overflow-hidden bg-primary-50">
            {results.correctCount > 0 && (
              <div className="bg-success" style={{ width: `${(results.correctCount / totalQs) * 100}%` }} />
            )}
            {results.wrongCount > 0 && (
              <div className="bg-accent-400" style={{ width: `${(results.wrongCount / totalQs) * 100}%` }} />
            )}
            {results.skippedCount > 0 && (
              <div className="bg-primary-200" style={{ width: `${(results.skippedCount / totalQs) * 100}%` }} />
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="rounded-2xl bg-success/10 py-2">
              <p className="text-base font-black text-green-700 tabular-nums">{results.correctCount}</p>
              <p className="text-[10px] lg:text-sm text-green-700">{isHi ? 'सही' : 'Correct'}</p>
            </div>
            <div className="rounded-2xl bg-accent-50 py-2">
              <p className="text-base font-black text-accent-600 tabular-nums">{results.wrongCount}</p>
              <p className="text-[10px] lg:text-sm text-accent-600">{isHi ? 'गलत' : 'Wrong'}</p>
            </div>
            <div className="rounded-2xl bg-primary-50 py-2">
              <p className="text-base font-black text-primary-400 tabular-nums">{results.skippedCount}</p>
              <p className="text-[10px] lg:text-sm text-primary-400">{isHi ? 'छोड़े' : 'Skipped'}</p>
            </div>
          </div>
        </div>

        {/* Other students */}
        {results.peer && <PeerCard peer={results.peer} results={results} isHi={isHi} />}

        {/* Subject Breakdown */}
        {results.subjectBreakdown.length > 0 && (
          <div className="p-card p-4">
            <p className="p-title mb-3">{isHi ? 'विषय विश्लेषण' : 'Subject Breakdown'}</p>
            <div className="space-y-3">
              {results.subjectBreakdown.map((row) => {
                const rowPct = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
                return (
                  <div key={row.subject}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs lg:text-[15px] text-primary font-semibold capitalize">{row.subject}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] lg:text-sm text-green-600">{row.correct}✓</span>
                        <span className="text-[10px] lg:text-sm text-accent-500">{row.wrong}✗</span>
                        <span className={`text-[10px] lg:text-sm font-extrabold px-2 py-0.5 rounded-full ${rowPct >= 60 ? 'bg-success/15 text-green-700' : 'bg-accent-50 text-accent-600'}`}>
                          {rowPct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-primary-50 overflow-hidden mt-1.5">
                      <div className={`h-full rounded-full ${rowPct >= 60 ? 'bg-success' : 'bg-accent-400'}`} style={{ width: `${rowPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Attempt History */}
        {history.length > 1 && (
          <div className="p-card p-4 lg:col-span-2">
            <p className="p-title mb-3">{isHi ? 'प्रयास इतिहास' : 'Attempt History'}</p>
            <div className="space-y-1.5">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => navigate(`/tests/${testId}/results/${h.id}`, { replace: true })}
                  className={`w-full px-3.5 py-2.5 rounded-2xl flex items-center justify-between text-left border ${h.id === attemptId ? 'bg-secondary-50 border-secondary-200' : 'bg-primary-50/50 border-primary-50'}`}
                >
                  <div>
                    <span className="text-xs lg:text-[15px] font-bold text-primary">#{h.attemptNumber}</span>
                    <span className="text-[10px] lg:text-sm text-gray-400 ml-2">{formatDate(h.submittedAt, isHi)}</span>
                  </div>
                  <span className={`text-xs lg:text-[15px] font-extrabold ${Math.round(h.percentage) >= 60 ? 'text-green-600' : 'text-accent-500'}`}>
                    {Math.round(h.percentage)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Discussion with other students */}
        {testId && <TestDiscussionCard testId={testId} isHi={isHi} />}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1 lg:col-span-3 xl:col-span-4 lg:max-w-2xl lg:mx-auto lg:w-full">
          <Link
            to={`/tests/${testId}/review/${attemptId}`}
            className="p-btn py-3.5 text-sm"
          >
            {isHi ? '📋 उत्तर देखें' : '📋 Review Answers'}
          </Link>
          {history.length >= 5 ? (
            <div className="py-3.5 bg-primary-50 text-primary-300 text-sm font-semibold rounded-2xl text-center border border-primary-100 cursor-not-allowed">
              {isHi ? '5/5 प्रयास पूर्ण' : '5/5 Attempts Used'}
            </div>
          ) : (
            <button
              onClick={() => navigate(`/tests/${testId}/attempt`)}
              className="p-btn-navy py-3.5 text-sm"
            >
              {isHi ? '🔄 पुनः प्रयास' : '🔄 Reattempt'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
