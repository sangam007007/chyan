import { useState, useEffect, useCallback, useRef } from 'react';
import { questionLanguage, pick } from '@/i18n/localize';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';

// --- Types ---

interface Question {
  id: string;
  subject?: string;
  textEn: string;
  textHi: string;
  optionAEn: string;
  optionAHi: string;
  optionBEn: string;
  optionBHi: string;
  optionCEn: string;
  optionCHi: string;
  optionDEn: string;
  optionDHi: string;
}

interface QuestionWithAnswer extends Question {
  correctOption?: number;
  explanationEn?: string;
  explanationHi?: string;
}

type PageState = 'loading' | 'quiz' | 'result';

// --- Component ---

/**
 * DailyChallengePage — 10 questions, 5 min timer, submit, show result.
 * Pass criteria: ≥60% (6/10) = 20 coins.
 * 1 attempt per day.
 */
export function DailyChallengePage() {
  const { language } = useTranslation();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(300); // 5 minutes
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Result state
  const [resultScore, setResultScore] = useState<number | null>(null);
  const [resultPassed, setResultPassed] = useState(false);
  const [resultQuestions, setResultQuestions] = useState<QuestionWithAnswer[]>([]);
  const [resultAnswers, setResultAnswers] = useState<(number | null)[]>([]);
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);

  // --- Initialize ---
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      setPageState('loading');

      try {
        // Check existing status
        const statusRes = await api.get('/api/daily-quiz/status', { timeout: 15_000 });
        const statusData = statusRes.data.data;

        if (statusData.status === 'completed') {
          // Already completed today — show result
          const attempt = statusData.attempt;
          const resultRes = await api.get(`/api/daily-quiz/result/${attempt.id}`, { timeout: 15_000 });
          const resultData = resultRes.data.data;

          setResultScore(resultData.attempt.score);
          setResultPassed(resultData.attempt.score >= 6);
          setResultQuestions(resultData.questions);
          setResultAnswers(resultData.attempt.answers || []);
          setCorrectAnswers(resultData.questions.map((q: QuestionWithAnswer) => q.correctOption ?? -1));
          setPageState('result');
          return;
        }

        // Start or resume quiz
        const startRes = await api.post('/api/daily-quiz/start', {}, { timeout: 15_000 });
        const attempt = startRes.data.data.attempt ?? startRes.data.data;
        setAttemptId(attempt.id);

        // Questions come from the start response
        const qs: Question[] = attempt.questions || [];
        setQuestions(qs);
        setAnswers(Array(qs.length).fill(null));

        // Calculate remaining time (5 min from creation)
        const createdAt = new Date(attempt.createdAt).getTime();
        const elapsed = Math.floor((Date.now() - createdAt) / 1000);
        const remaining = Math.max(0, 300 - elapsed);
        setRemainingSeconds(remaining);

        if (remaining <= 0) {
          // Time already expired — auto-submit
          submittedRef.current = true;
          setIsSubmitting(true);
          try {
            const result = await api.post('/api/daily-quiz/submit', {
              attemptId: attempt.id,
              answers: Array(qs.length).fill(null),
            }, { timeout: 15_000 });
            const data = result.data.data;
            const resRes = await api.get(`/api/daily-quiz/result/${attempt.id}`, { timeout: 15_000 });
            const resData = resRes.data.data;
            setResultScore(data.score);
            setResultPassed(data.score >= 6);
            setResultQuestions(resData.questions);
            setResultAnswers(resData.attempt.answers || []);
            setCorrectAnswers(resData.questions.map((q: QuestionWithAnswer) => q.correctOption ?? -1));
            setPageState('result');
          } catch {
            navigate('/dashboard');
          }
        } else {
          setPageState('quiz');
        }
      } catch (err) {
        console.error('Daily challenge init error:', err);
        navigate('/dashboard');
      }
    }

    init();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [navigate]);

  // --- Timer ---
  useEffect(() => {
    if (pageState !== 'quiz') return;

    if (remainingSeconds <= 0) {
      handleAutoSubmit(attemptId!, answers);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit(attemptId!, answers);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pageState, attemptId]);

  // --- Submit ---
  const handleAutoSubmit = useCallback(async (id: string, ans: (number | null)[]) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await api.post('/api/daily-quiz/submit', {
        attemptId: id,
        answers: ans,
      }, { timeout: 15_000 });
      const data = response.data.data;
      await showResult(id, data.score, data.score >= 6);
    } catch {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleManualSubmit = useCallback(async () => {
    if (submittedRef.current || !attemptId) return;
    submittedRef.current = true;
    setIsSubmitting(true);
    setShowConfirm(false);
    setSubmitError(null);

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const response = await api.post('/api/daily-quiz/submit', {
        attemptId,
        answers,
      }, { timeout: 15_000 });
      const data = response.data.data;
      await showResult(attemptId, data.score, data.score >= 6);
    } catch (err: any) {
      // Already saved earlier (e.g. a double tap): just show the saved result.
      if (err?.response?.data?.error?.code === 'QUIZ_ALREADY_SUBMITTED') {
        try {
          const saved = await api.get(`/api/daily-quiz/result/${attemptId}`, { timeout: 15_000 });
          const score = saved.data.data.attempt.score ?? 0;
          await showResult(attemptId, score, score >= 6);
          return;
        } catch { /* fall through to the error message */ }
      }
      submittedRef.current = false;
      setIsSubmitting(false);
      setSubmitError(
        language === 'hi'
          ? 'जमा नहीं हो सका। इंटरनेट जांचें और फिर कोशिश करें।'
          : (err?.response?.data?.error?.message ?? 'Could not submit. Check your connection and try again.'),
      );
    }
  }, [attemptId, answers, navigate, language]);

  const showResult = useCallback(async (id: string, score: number, passed: boolean) => {
    try {
      const resultRes = await api.get(`/api/daily-quiz/result/${id}`, { timeout: 15_000 });
      const resultData = resultRes.data.data;

      setResultScore(score);
      setResultPassed(passed);
      setResultQuestions(resultData.questions);
      setResultAnswers(resultData.attempt.answers || []);
      setCorrectAnswers(resultData.questions.map((q: QuestionWithAnswer) => q.correctOption ?? -1));
    } catch {
      setResultScore(score);
      setResultPassed(passed);
    }
    setPageState('result');
    setIsSubmitting(false);
  }, []);

  // --- Handlers ---
  const handleOptionSelect = (optionIndex: number) => {
    setAnswers((prev) => {
      const updated = [...prev];
      updated[currentIndex] = optionIndex;
      return updated;
    });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // --- Loading ---
  if (pageState === 'loading') {
    return (
      <div className="px-4 pt-24 pb-28">
        <div className="p-card py-12 text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary-100 border-t-secondary rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">
            {language === 'hi' ? 'चुनौती लोड हो रही है...' : 'Loading challenge...'}
          </p>
        </div>
      </div>
    );
  }

  // --- Result ---
  if (pageState === 'result') {
    return (
      <div className="pb-28 space-y-5">
        {/* Result Header */}
        <div className="p-hero rounded-b-[32px] lg:rounded-3xl lg:mt-6 px-4 pt-8 pb-8 text-center">
          <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-secondary/30 blur-2xl" />
          <div className="pointer-events-none absolute -left-12 bottom-0 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <div className="text-5xl mb-3">{resultPassed ? '🏆' : '💪'}</div>
            <h2 className="text-xl font-extrabold leading-snug">
              {resultPassed
                ? (language === 'hi' ? 'बधाई! आपने पास किया' : 'Congratulations! You Passed')
                : (language === 'hi' ? 'अगली बार बेहतर करें' : 'Better Luck Next Time')}
            </h2>
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="min-w-[96px] rounded-2xl bg-white/10 border border-white/15 px-4 py-3 backdrop-blur">
                <p className="text-3xl font-black tabular-nums">{resultScore}<span className="text-base text-white/60 font-semibold">/10</span></p>
                <p className="text-[11px] text-white/70">{language === 'hi' ? 'स्कोर' : 'Score'}</p>
              </div>
              {resultPassed && (
                <div className="min-w-[96px] rounded-2xl bg-secondary/25 border border-secondary-300/40 px-4 py-3">
                  <p className="text-3xl font-black text-secondary-200 tabular-nums">+20</p>
                  <p className="text-[11px] text-white/80">🪙 {language === 'hi' ? 'कॉइन्स' : 'Coins'}</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-white/60 mt-3">
              {language === 'hi' ? 'पास: 6/10 (60%) • कल फिर कोशिश करें' : 'Pass: 6/10 (60%) • Try again tomorrow'}
            </p>
          </div>
        </div>

        {/* Answer Review */}
        {resultQuestions.length > 0 && (
          <div className="px-4 lg:px-0 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
            <h3 className="p-title text-[14px]">
              {language === 'hi' ? 'उत्तर समीक्षा' : 'Answer Review'}
            </h3>
            {resultQuestions.map((q, idx) => {
              const userAnswer = resultAnswers[idx];
              const correct = correctAnswers[idx];
              const isCorrect = userAnswer === correct;
              const optionLabels = ['A', 'B', 'C', 'D'];

              const qHi = questionLanguage(language, q.subject) === 'hi';
              const getOptionText = (optIdx: number) => {
                const opts = qHi
                  ? [q.optionAHi, q.optionBHi, q.optionCHi, q.optionDHi]
                  : [q.optionAEn, q.optionBEn, q.optionCEn, q.optionDEn];
                return opts[optIdx] || '';
              };

              return (
                <div key={q.id} className={`p-card p-3.5 border-2 ${isCorrect ? 'border-success/40' : 'border-accent-200'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`text-xs font-extrabold px-2 py-0.5 rounded-lg ${isCorrect ? 'bg-success/15 text-green-700' : 'bg-accent-50 text-accent-600'}`}>
                      Q{idx + 1}
                    </span>
                    <p className="text-xs font-semibold text-primary flex-1">
                      {qHi ? q.textHi : q.textEn}
                    </p>
                  </div>

                  <div className="ml-7 space-y-1">
                    {userAnswer !== null && userAnswer !== correct && (
                      <p className="text-[10px] text-accent-600">
                        ❌ {language === 'hi' ? 'आपका उत्तर' : 'Your answer'}: {optionLabels[userAnswer]} - {getOptionText(userAnswer)}
                      </p>
                    )}
                    <p className="text-[10px] text-green-700 font-medium">
                      ✅ {language === 'hi' ? 'सही उत्तर' : 'Correct'}: {optionLabels[correct]} - {getOptionText(correct)}
                    </p>
                    {pick(language, q.explanationEn, q.explanationHi) && (
                      <p className="text-[10px] text-primary-500 mt-1">
                        💡 {pick(language, q.explanationEn, q.explanationHi)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="px-4 lg:px-0 lg:max-w-xl lg:mx-auto">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-btn w-full py-3.5 text-sm"
          >
            {language === 'hi' ? 'डैशबोर्ड पर वापस जाएं' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  // --- Quiz ---
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  const qHi = questionLanguage(language, currentQuestion.subject) === 'hi';
  const questionText = qHi ? currentQuestion.textHi : currentQuestion.textEn;
  const options = [
    { label: 'A', text: qHi ? currentQuestion.optionAHi : currentQuestion.optionAEn },
    { label: 'B', text: qHi ? currentQuestion.optionBHi : currentQuestion.optionBEn },
    { label: 'C', text: qHi ? currentQuestion.optionCHi : currentQuestion.optionCEn },
    { label: 'D', text: qHi ? currentQuestion.optionDHi : currentQuestion.optionDEn },
  ];

  const answeredCount = answers.filter((a) => a !== null).length;

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 p-hero rounded-b-[28px] lg:rounded-3xl lg:mt-6 px-4 pt-4 pb-4">
        <div className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-secondary/25 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-white/15 border border-white/10 flex items-center justify-center text-lg">🎯</span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold truncate">{language === 'hi' ? 'दैनिक चुनौती' : 'Daily Challenge'}</p>
              <p className="text-[10px] text-secondary-200 font-semibold">{currentIndex + 1}/{questions.length}</p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-2xl border text-base font-mono font-black tabular-nums whitespace-nowrap ${remainingSeconds <= 60 ? 'bg-accent border-accent-300 text-white animate-pulse' : 'bg-white/10 border-white/15 text-white'}`}>
            ⏱ {formatTime(remainingSeconds)}
          </div>
        </div>
        {/* Progress */}
        <div className="relative mt-3 h-1.5 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-secondary-400 to-secondary-200 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-4 lg:max-w-4xl lg:mx-auto">
        {/* Question Card */}
        <div className="p-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 shrink-0 rounded-xl bg-primary text-secondary-200 text-sm font-extrabold flex items-center justify-center shadow">{currentIndex + 1}</span>
            <p className="text-[15px] lg:text-lg text-primary leading-relaxed font-semibold">{questionText}</p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {options.map((option, idx) => {
              const selected = answers[currentIndex] === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleOptionSelect(idx)}
                  className={`w-full flex items-center gap-3 p-3 lg:p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.99] ${
                    selected
                      ? 'border-secondary bg-secondary-50 shadow-[0_6px_18px_-10px_rgba(197,160,40,0.9)]'
                      : 'border-primary-100 bg-white hover:border-primary-200'
                  }`}
                >
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-extrabold shrink-0 ${
                    selected ? 'bg-secondary text-primary-800' : 'bg-primary-50 text-primary-400'
                  }`}>
                    {option.label}
                  </span>
                  <span className={`text-sm lg:text-base leading-snug ${selected ? 'text-primary font-semibold' : 'text-primary-700'}`}>{option.text}</span>
                  {selected && <span className="ml-auto text-secondary-600 font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="p-btn-ghost py-3"
          >
            ← {language === 'hi' ? 'पिछला' : 'Previous'}
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              className="p-btn-navy py-3"
            >
              {language === 'hi' ? 'अगला' : 'Next'} →
            </button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={isSubmitting}
              className="p-btn py-3"
            >
              {language === 'hi' ? 'जमा करें' : 'Submit'}
            </button>
          )}
        </div>

        {submitError && (
          <div role="alert" className="rounded-2xl bg-accent-50 border border-accent-200 px-4 py-3 text-xs font-semibold text-accent-700">
            ⚠️ {submitError}
          </div>
        )}

        {/* Question dots */}
        <div className="p-card p-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {questions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all ${
                  currentIndex === idx
                    ? 'bg-primary text-secondary-200 border-primary shadow-md scale-105'
                    : answers[idx] !== null
                    ? 'bg-success/15 text-green-700 border-success/40'
                    : 'bg-primary-50 text-primary-400 border-primary-100'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {/* Answered count */}
          <p className="text-center text-[11px] text-gray-400 mt-3">
            {language === 'hi'
              ? `${answeredCount}/${questions.length} प्रश्नों के उत्तर दिए`
              : `${answeredCount}/${questions.length} questions answered`}
          </p>
        </div>
      </div>

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-primary-900/60 backdrop-blur-sm px-4 pb-6" role="dialog" aria-modal="true">
          <div className="p-card w-full max-w-sm p-6 space-y-4">
            <h2 className="text-base font-extrabold text-primary text-center">
              {language === 'hi' ? 'जमा करें?' : 'Submit Challenge?'}
            </h2>
            <div className="text-center space-y-1">
              <p className="text-xs text-gray-500">
                {language === 'hi'
                  ? `${answeredCount}/${questions.length} प्रश्नों के उत्तर दिए`
                  : `${answeredCount}/${questions.length} questions answered`}
              </p>
              {answeredCount < questions.length && (
                <p className="text-xs text-secondary-700 font-semibold">
                  {language === 'hi'
                    ? `${questions.length - answeredCount} प्रश्न अनुत्तरित हैं`
                    : `${questions.length - answeredCount} questions unanswered`}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                className="p-btn-ghost py-3"
              >
                {language === 'hi' ? 'वापस जाएं' : 'Go Back'}
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="p-btn py-3"
              >
                {isSubmitting
                  ? (language === 'hi' ? 'जमा हो रहा...' : 'Submitting...')
                  : (language === 'hi' ? 'हाँ, जमा करें' : 'Yes, Submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
