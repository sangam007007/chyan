import { useState, useEffect } from 'react';
import { questionLanguage, pick } from '@/i18n/localize';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';

// --- Types ---

interface QuestionHistory {
  correctCount: number;
  wrongCount: number;
  totalCount: number;
}

interface ReviewQuestion {
  question_order: number;
  question_id: string;
  text_en: string;
  text_hi: string;
  option_a_en: string;
  option_a_hi: string;
  option_b_en: string;
  option_b_hi: string;
  option_c_en: string;
  option_c_hi: string;
  option_d_en: string;
  option_d_hi: string;
  correct_option: number;
  explanation_en: string | null;
  explanation_hi: string | null;
  subject: string;
  selected_option: number | null;
  marked_for_review: boolean;
  time_spent_seconds: number | null;
  history: QuestionHistory;
  topicNameEn: string;
  topicNameHi: string;
  /** What other students picked the first time they answered this question (anonymous) */
  peer: QuestionPeer | null;
}

interface QuestionPeer {
  total: number;
  optionPercents: [number, number, number, number];
  skippedPercent: number;
  correctPercent: number;
}

interface ReviewData {
  attemptId: string;
  testId: string;
  avgTimePerQuestion: number;
  questions: ReviewQuestion[];
}

interface SimilarQuestion {
  id: string;
  text_en: string;
  text_hi: string;
  option_a_en: string; option_a_hi: string;
  option_b_en: string; option_b_hi: string;
  option_c_en: string; option_c_hi: string;
  option_d_en: string; option_d_hi: string;
  correct_option: number;
  explanation_en: string | null;
  explanation_hi: string | null;
  subject?: string;
}

// --- Helpers ---

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
type FilterTab = 'all' | 'correct' | 'wrong' | 'skipped';

function getOptionText(question: any, index: number, language: string): string {
  const key = `option_${['a', 'b', 'c', 'd'][index]}_${language === 'hi' ? 'hi' : 'en'}`;
  return question[key] as string;
}

function getStatus(q: ReviewQuestion): 'correct' | 'wrong' | 'skipped' {
  if (q.selected_option === null || q.selected_option === undefined) return 'skipped';
  return q.selected_option === q.correct_option ? 'correct' : 'wrong';
}

// --- Component ---

export function AnswerReviewPage() {
  const { language } = useTranslation();
  const isHi = language === 'hi';
  const { testId, attemptId } = useParams<{ testId: string; attemptId: string }>();
  const navigate = useNavigate();

  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedPractice, setExpandedPractice] = useState<string | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<SimilarQuestion[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number | null>>({});
  const [practiceRevealed, setPracticeRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchReview() {
      setIsLoading(true);
      try {
        const res = await api.get(`/api/attempts/${attemptId}/review`);
        setReviewData(res.data?.data ?? null);
      } catch {
        setError(isHi ? 'लोड करने में विफल' : 'Failed to load');
      } finally {
        setIsLoading(false);
      }
    }
    if (attemptId) fetchReview();
  }, [attemptId, isHi]);

  const handlePracticeSimilar = async (questionId: string) => {
    if (expandedPractice === questionId) {
      setExpandedPractice(null);
      return;
    }
    setExpandedPractice(questionId);
    setPracticeLoading(true);
    setPracticeQuestions([]);
    setPracticeAnswers({});
    setPracticeRevealed(new Set());
    try {
      const res = await api.get(`/api/attempts/${attemptId}/similar/${questionId}`);
      setPracticeQuestions(res.data?.data ?? []);
    } catch { /* silent */ }
    finally { setPracticeLoading(false); }
  };

  if (isLoading) {
    return (
      <div className="px-4 pt-24 pb-28 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-100 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !reviewData) {
    return (
      <div className="px-4 pt-24 pb-28">
        <div className="p-card py-12 px-6 text-center space-y-3">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-accent-600">{error}</p>
          <button onClick={() => navigate(-1)} className="p-btn-navy">{isHi ? 'वापस' : 'Back'}</button>
        </div>
      </div>
    );
  }

  const questions = reviewData.questions;
  const correctQs = questions.filter((q) => getStatus(q) === 'correct');
  const wrongQs = questions.filter((q) => getStatus(q) === 'wrong');
  const skippedQs = questions.filter((q) => getStatus(q) === 'skipped');

  const filtered = activeFilter === 'all' ? questions
    : activeFilter === 'correct' ? correctQs
    : activeFilter === 'wrong' ? wrongQs
    : skippedQs;

  const avgTime = reviewData.avgTimePerQuestion || 60;

  return (
    <div className="pb-28">
      {/* Header + filter tabs */}
      <div className="sticky top-0 z-40 p-hero rounded-b-[28px] lg:rounded-3xl lg:mt-6 px-4 pt-4 pb-4">
        <div className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-secondary/25 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label={isHi ? 'वापस' : 'Back'}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 border border-white/10 text-white text-lg"
          >←</button>
          <h1 className="text-base font-extrabold">{isHi ? 'उत्तर विश्लेषण' : 'Answer Analysis'}</h1>
          <div className="w-9" />
        </div>

        <div className="relative flex gap-1.5 bg-white/10 rounded-2xl p-1 mt-3.5">
          {([
            { key: 'all' as FilterTab, label: isHi ? 'सभी' : 'All', count: questions.length },
            { key: 'correct' as FilterTab, label: '✅', count: correctQs.length },
            { key: 'wrong' as FilterTab, label: '❌', count: wrongQs.length },
            { key: 'skipped' as FilterTab, label: '⏭️', count: skippedQs.length },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition-all ${
                activeFilter === tab.key ? 'bg-secondary text-primary-800 shadow' : 'text-white/75'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Questions */}
      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-3.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        {filtered.length === 0 && (
          <div className="p-card py-12 text-center lg:col-span-2">
            <p className="text-sm text-gray-400">{isHi ? 'कोई प्रश्न नहीं' : 'No questions'}</p>
          </div>
        )}

        {filtered.map((question) => {
          const status = getStatus(question);
          // Hindi-subject questions stay in Hindi even when the app is in English
          const qLang = questionLanguage(language, question.subject);
          const qText = qLang === 'hi' ? question.text_hi : question.text_en;
          const explanation = pick(language, question.explanation_en, question.explanation_hi);
          const topicName = isHi ? question.topicNameHi : question.topicNameEn;
          const timeSpent = question.time_spent_seconds;
          const isWeak = question.history.wrongCount >= 2;

          // Time emoji
          let timeEmoji = '';
          let timeBg = '';
          if (timeSpent !== null) {
            if (timeSpent > avgTime) { timeEmoji = '😢'; timeBg = 'bg-accent-50 text-accent-600'; }
            else { timeEmoji = '😊'; timeBg = 'bg-success/15 text-green-700'; }
          }

          const borderColor = status === 'correct' ? 'bg-success' : status === 'wrong' ? 'bg-accent-400' : 'bg-primary-200';

          return (
            <div key={question.question_id} className="p-card relative overflow-hidden">
              <span className={`absolute left-0 top-5 bottom-5 w-1 rounded-r-full ${borderColor}`} />
              <div className="p-4 pl-5">
                {/* Header row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-7 h-7 rounded-lg bg-primary text-secondary-200 text-[10px] font-extrabold flex items-center justify-center">Q{question.question_order + 1}</span>
                    {status === 'correct' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-green-700 font-bold">✅ {isHi ? 'सही' : 'Correct'}</span>}
                    {status === 'wrong' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-50 text-accent-600 font-bold">❌ {isHi ? 'गलत' : 'Wrong'}</span>}
                    {status === 'skipped' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-400 font-bold">⏭️ {isHi ? 'छोड़ा' : 'Skipped'}</span>}
                    {timeSpent !== null && <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${timeBg}`}>{timeEmoji} {timeSpent}s</span>}
                  </div>
                  <span className="text-[9px] text-primary-400 bg-primary-50 px-2 py-0.5 rounded-full max-w-[40%] truncate">{topicName}</span>
                </div>

                {/* Weak topic warning */}
                {isWeak && (status === 'wrong' || status === 'skipped') && (
                  <div className="mb-2 px-3 py-2 bg-secondary-50 border border-secondary-200 rounded-xl">
                    <p className="text-[10px] text-secondary-700 font-semibold">
                      ⚠️ {isHi ? `यह टॉपिक कमजोर है — ${question.history.wrongCount} बार गलत` : `Weak topic — wrong ${question.history.wrongCount} times`}
                    </p>
                  </div>
                )}

                {/* Question History Badge */}
                {question.history.totalCount > 1 && (
                  <div className="mb-2">
                    <span className="text-[9px] text-gray-400">
                      {isHi ? `इतिहास: ${question.history.correctCount}✓ ${question.history.wrongCount}✗ (${question.history.totalCount} बार)` : `History: ${question.history.correctCount}✓ ${question.history.wrongCount}✗ (${question.history.totalCount} times)`}
                    </span>
                  </div>
                )}

                {/* Question Text */}
                <p className="text-sm font-semibold text-primary mb-3 leading-relaxed">{qText}</p>

                {/* What other students chose (first attempt only) */}
                {question.peer && question.peer.total > 0 && (
                  <p className="mb-2 text-[10px] lg:text-xs text-gray-500 leading-snug">
                    👥 {isHi
                      ? `${question.peer.total} छात्रों के पहले प्रयास में ${question.peer.correctPercent}% ने सही किया${question.peer.skippedPercent > 0 ? `, ${question.peer.skippedPercent}% ने छोड़ा` : ''}`
                      : `In the first attempt of ${question.peer.total} student${question.peer.total === 1 ? '' : 's'}, ${question.peer.correctPercent}% got it right${question.peer.skippedPercent > 0 ? `, ${question.peer.skippedPercent}% skipped` : ''}`}
                  </p>
                )}

                {/* Options */}
                <div className="space-y-1.5 mb-3">
                  {[0, 1, 2, 3].map((optIdx) => {
                    const optText = getOptionText(question, optIdx, qLang);
                    const isSelected = question.selected_option === optIdx;
                    const isCorrect = question.correct_option === optIdx;
                    const peerPct = question.peer && question.peer.total > 0 ? question.peer.optionPercents[optIdx] : null;

                    let classes = 'border-primary-100 bg-white';
                    if (isCorrect) classes = 'border-success bg-success/10';
                    else if (isSelected && !isCorrect) classes = 'border-accent-400 bg-accent-50';

                    return (
                      <div key={optIdx} className={`relative overflow-hidden flex items-center gap-2.5 p-2.5 rounded-2xl border-2 ${classes}`}>
                        {peerPct != null && (
                          <span
                            aria-hidden="true"
                            className={`absolute inset-y-0 left-0 ${isCorrect ? 'bg-success/15' : 'bg-primary/[0.07]'}`}
                            style={{ width: `${peerPct}%` }}
                          />
                        )}
                        <span className={`relative w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-[10px] font-extrabold ${isCorrect ? 'bg-success text-white' : isSelected ? 'bg-accent-400 text-white' : 'bg-primary-50 text-primary-400'}`}>
                          {OPTION_LABELS[optIdx]}
                        </span>
                        <span className={`relative flex-1 text-xs leading-snug ${isCorrect ? 'text-green-800 font-semibold' : isSelected && !isCorrect ? 'text-accent-700' : 'text-primary-700'}`}>{optText}</span>
                        {peerPct != null && (
                          <span className="relative text-[10px] lg:text-xs font-bold tabular-nums text-gray-500" title={isHi ? 'दूसरे छात्रों ने यह चुना' : 'Chosen by other students'}>{peerPct}%</span>
                        )}
                        {isCorrect && <span className="relative text-green-600 text-xs font-bold">✓</span>}
                        {isSelected && !isCorrect && <span className="relative text-accent-500 text-xs font-bold">✗</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Wrong answer detail */}
                {status === 'wrong' && (
                  <div className="mb-3 p-3 bg-accent-50 border border-accent-100 rounded-2xl">
                    <p className="text-[10px] text-accent-700 font-medium">
                      {isHi
                        ? `❌ आपने विकल्प ${OPTION_LABELS[question.selected_option!]} चुना (गलत) → सही उत्तर: विकल्प ${OPTION_LABELS[question.correct_option]}`
                        : `❌ You chose Option ${OPTION_LABELS[question.selected_option!]} (wrong) → Correct: Option ${OPTION_LABELS[question.correct_option]}`}
                    </p>
                  </div>
                )}

                {/* Explanation */}
                {explanation && (
                  <div className="p-3.5 bg-primary-50/70 border border-primary-100 rounded-2xl">
                    <p className="text-[10px] font-bold text-secondary-700 mb-1">💡 {isHi ? 'व्याख्या' : 'Explanation'}</p>
                    <p className="text-xs text-primary-700 leading-relaxed">{explanation}</p>
                  </div>
                )}

                {/* Practice Similar Button (for wrong/skipped) */}
                {(status === 'wrong' || status === 'skipped') && (
                  <button
                    onClick={() => handlePracticeSimilar(question.question_id)}
                    className="mt-3 w-full py-2.5 text-xs font-bold text-primary bg-secondary-50 rounded-2xl border border-secondary-200 active:scale-[0.99] transition-transform"
                  >
                    {expandedPractice === question.question_id
                      ? (isHi ? '▲ बंद करें' : '▲ Close Practice')
                      : (isHi ? '🎯 इस टॉपिक के 5 प्रश्न अभ्यास करें' : '🎯 Practice 5 Similar Questions')}
                  </button>
                )}

                {/* Practice Questions Panel */}
                {expandedPractice === question.question_id && (
                  <div className="mt-3 border-t border-primary-50 pt-3 space-y-3">
                    {practiceLoading ? (
                      <p className="text-center text-xs text-gray-400">{isHi ? 'लोड हो रहा है...' : 'Loading...'}</p>
                    ) : practiceQuestions.length === 0 ? (
                      <p className="text-center text-xs text-gray-400">{isHi ? 'कोई समान प्रश्न नहीं मिला' : 'No similar questions found'}</p>
                    ) : (
                      practiceQuestions.map((pq, pIdx) => {
                        const revealed = practiceRevealed.has(pq.id);
                        const userAnswer = practiceAnswers[pq.id];
                        const pqLang = questionLanguage(language, pq.subject);
                        return (
                          <div key={pq.id} className="bg-primary-50/50 rounded-2xl p-3.5 border border-primary-100">
                            <p className="text-[10px] font-extrabold text-secondary-600 mb-1 uppercase tracking-wide">{isHi ? 'अभ्यास' : 'Practice'} #{pIdx + 1}</p>
                            <p className="text-xs font-semibold text-primary mb-2">{pqLang === 'hi' ? pq.text_hi : pq.text_en}</p>
                            <div className="space-y-1">
                              {[0, 1, 2, 3].map((oi) => {
                                const oText = getOptionText(pq, oi, pqLang);
                                let cls = 'border-primary-100 bg-white';
                                if (revealed) {
                                  if (oi === pq.correct_option) cls = 'border-success bg-success/10';
                                  else if (oi === userAnswer && oi !== pq.correct_option) cls = 'border-accent-400 bg-accent-50';
                                } else if (oi === userAnswer) {
                                  cls = 'border-secondary bg-secondary-50';
                                }
                                return (
                                  <button
                                    key={oi}
                                    onClick={() => { if (!revealed) setPracticeAnswers((p) => ({ ...p, [pq.id]: oi })); }}
                                    disabled={revealed}
                                    className={`w-full flex items-center gap-2 p-2.5 rounded-xl border-2 text-left ${cls}`}
                                  >
                                    <span className="text-[10px] font-extrabold text-primary-400">{OPTION_LABELS[oi]}</span>
                                    <span className="text-[11px] text-primary-700">{oText}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {userAnswer !== undefined && userAnswer !== null && !revealed && (
                              <button
                                onClick={() => setPracticeRevealed((s) => new Set(s).add(pq.id))}
                                className="mt-2 w-full py-2 text-[11px] font-bold text-primary-800 bg-secondary rounded-xl shadow active:scale-95 transition-transform"
                              >
                                {isHi ? 'उत्तर देखें' : 'Check Answer'}
                              </button>
                            )}
                            {revealed && (
                              <div className="mt-2 p-2.5 bg-white border border-primary-100 rounded-xl">
                                <p className="text-[10px] font-semibold text-primary">
                                  {userAnswer === pq.correct_option ? '✅ ' + (isHi ? 'सही!' : 'Correct!') : '❌ ' + (isHi ? `सही: ${OPTION_LABELS[pq.correct_option]}` : `Correct: ${OPTION_LABELS[pq.correct_option]}`)}
                                </p>
                                {pick(language, pq.explanation_en, pq.explanation_hi) && (
                                  <p className="text-[10px] text-primary-500 mt-1">{pick(language, pq.explanation_en, pq.explanation_hi)}</p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
