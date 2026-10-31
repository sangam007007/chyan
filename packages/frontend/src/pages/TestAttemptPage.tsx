import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { questionLanguage, pick } from '@/i18n/localize';
import { negativeLabel } from '@/components/test/MarkingInfo';
import { QuestionNavigationPanel } from '@/components/test/QuestionNavigationPanel';

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

interface AnswerState {
  selectedOption: number | null;
  markedForReview: boolean;
}

interface AttemptData {
  id: string;
  testId: string;
  endsAt: string;
  questions: Question[];
}

// --- Component ---

/**
 * TestAttemptPage — Timed test-taking experience.
 *
 * Features:
 * - Starts or resumes a test attempt on mount
 * - Countdown timer (MM:SS) that auto-submits at 0
 * - Bilingual question display with 4 radio options
 * - Mark-for-review checkbox
 * - Immediate answer persistence on option select
 *
 * Requirements: 4.1, 4.2, 4.4, 4.7
 */
export function TestAttemptPage() {
  const { testId } = useParams<{ testId: string }>();
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Marking scheme of this test (shown so students know a wrong answer can cost marks)
  const [marking, setMarking] = useState<{ ratio: number; mpq: number } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptIdRef = useRef<string | null>(null);

  // --- Abandon attempt on navigate away (unmount) ---
  useEffect(() => {
    return () => {
      // When component unmounts and attempt was NOT submitted, abandon it
      const id = attemptIdRef.current;
      if (id && !isSubmitted) {
        // Fire-and-forget — don't await
        api.delete(`/api/attempts/${id}/abandon`).catch(() => {});
      }
    };
  }, [isSubmitted]);

  // Marking scheme (negative marking) of this test, shown to the student during the exam
  useEffect(() => {
    if (!testId) return;
    let cancelled = false;
    api.get(`/api/tests/${testId}`)
      .then((res) => {
        const d = res.data?.data;
        if (!cancelled && d) setMarking({ ratio: Number(d.negativeMarkingRatio ?? 0), mpq: Number(d.marksPerQuestion ?? 1) });
      })
      .catch(() => { /* notice is optional */ });
    return () => { cancelled = true; };
  }, [testId]);

  // --- Start or resume attempt ---

  const initAttempt = useCallback(async () => {
    if (!testId) return;
    setIsLoading(true);
    setError(null);

    try {
      // Try to get current in-progress attempt first
      let attemptData: AttemptData;
      let savedAnswers: AnswerState[] = [];

      try {
        const res = await api.get(`/api/tests/${testId}/attempts/current`);
        const data = res.data?.data;
        const attempt = data?.attempt;
        const rawAnswers = data?.answers ?? [];

        // Fetch test questions for the attempt
        const questionsRes = await api.get(`/api/tests/${testId}/questions`);
        const questions: Question[] = questionsRes.data?.data ?? [];

        attemptData = {
          id: attempt.id,
          testId: testId!,
          endsAt: attempt.ends_at,
          questions,
        };
        savedAnswers = rawAnswers.map((a: { selected_option?: number | null; selectedOption?: number | null; marked_for_review?: boolean; markedForReview?: boolean }) => ({
          selectedOption: a.selected_option ?? a.selectedOption ?? null,
          markedForReview: a.marked_for_review ?? a.markedForReview ?? false,
        }));
      } catch (attemptError: unknown) {
        // No current attempt — try to start a new one
        try {
          const res = await api.post(`/api/tests/${testId}/attempts`);
          const attempt = res.data?.data;

          // Fetch test questions
          const questionsRes = await api.get(`/api/tests/${testId}/questions`);
          const questions: Question[] = questionsRes.data?.data ?? [];

          attemptData = {
            id: attempt.id,
            testId: testId!,
            endsAt: attempt.ends_at,
            questions,
          };
          savedAnswers = [];
        } catch (startError: unknown) {
          // Check if it's a cooldown or max attempts error
          const axiosErr = startError as { response?: { status?: number; data?: { error?: { code?: string; message?: string } } } };
          const errCode = axiosErr?.response?.data?.error?.code;
          const errMsg = axiosErr?.response?.data?.error?.message;

          if (errCode === 'COOLDOWN_ACTIVE') {
            setError(errMsg || t('testAttempt.cooldownError'));
            setIsLoading(false);
            return;
          }
          if (errCode === 'MAX_ATTEMPTS_REACHED') {
            setError(errMsg || t('testAttempt.maxAttemptsError'));
            setIsLoading(false);
            return;
          }
          throw startError;
        }
      }

      setAttempt(attemptData);
      attemptIdRef.current = attemptData.id;

      // Initialize answers array
      const totalQuestions = attemptData.questions.length;
      const initialAnswers: AnswerState[] = Array.from({ length: totalQuestions }, (_, i) => ({
        selectedOption: savedAnswers[i]?.selectedOption ?? null,
        markedForReview: savedAnswers[i]?.markedForReview ?? false,
      }));
      setAnswers(initialAnswers);

      // Calculate remaining time
      const endsAt = new Date(attemptData.endsAt).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((endsAt - now) / 1000));
      setRemainingSeconds(diffSeconds);
    } catch {
      setError(t('testAttempt.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [testId, t]);

  useEffect(() => {
    initAttempt();
  }, [initAttempt]);

  // --- Timer countdown ---

  const handleAutoSubmit = useCallback(async () => {
    if (!attemptIdRef.current || isSubmitted) return;
    setIsSubmitted(true);
    try {
      await api.post(`/api/attempts/${attemptIdRef.current}/submit`);
      navigate(`/tests/${testId}/results/${attemptIdRef.current}`, { replace: true });
    } catch {
      // Auto-submit failed — still mark as submitted on client
    }
  }, [isSubmitted, navigate, testId]);

  const handleManualSubmit = useCallback(async () => {
    if (!attemptIdRef.current || isSubmitted) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/attempts/${attemptIdRef.current}/submit`);
      setIsSubmitted(true);
      setShowConfirmDialog(false);
      navigate(`/tests/${testId}/results/${attemptIdRef.current}`, { replace: true });
    } catch {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
    }
  }, [isSubmitted, navigate, testId]);

  useEffect(() => {
    if (isLoading || !attempt || isSubmitted) return;

    if (remainingSeconds <= 0) {
      handleAutoSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading, attempt, isSubmitted, handleAutoSubmit, remainingSeconds]);

  // --- Save answer ---

  const saveAnswer = useCallback(
    async (questionIndex: number, selectedOption: number | null, markedForReview: boolean) => {
      if (!attemptIdRef.current) return;
      try {
        // Backend question_order is 1-based
        const questionOrder = questionIndex + 1;
        await api.put(`/api/attempts/${attemptIdRef.current}/answers/${questionOrder}`, {
          selectedOption,
          markedForReview,
        });
      } catch {
        // Silently fail — answer is stored locally; will retry on next interaction
      }
    },
    []
  );

  const handleOptionSelect = useCallback(
    (optionIndex: number) => {
      setAnswers((prev) => {
        const updated = [...prev];
        updated[currentQuestionIndex] = {
          ...updated[currentQuestionIndex],
          selectedOption: optionIndex,
        };
        return updated;
      });
      saveAnswer(currentQuestionIndex, optionIndex, answers[currentQuestionIndex]?.markedForReview ?? false);
    },
    [currentQuestionIndex, answers, saveAnswer]
  );

  const handleMarkForReview = useCallback(
    (checked: boolean) => {
      setAnswers((prev) => {
        const updated = [...prev];
        updated[currentQuestionIndex] = {
          ...updated[currentQuestionIndex],
          markedForReview: checked,
        };
        return updated;
      });
      saveAnswer(currentQuestionIndex, answers[currentQuestionIndex]?.selectedOption ?? null, checked);
    },
    [currentQuestionIndex, answers, saveAnswer]
  );

  // --- Navigation ---

  const goToQuestion = useCallback(
    (index: number) => {
      if (attempt && index >= 0 && index < attempt.questions.length) {
        setCurrentQuestionIndex(index);
      }
    },
    [attempt]
  );

  // --- Timer display ---

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // --- Render ---

  if (isLoading) {
    return (
      <div className="px-4 pt-6 pb-28 space-y-4 animate-pulse">
        <div className="h-24 rounded-3xl bg-primary-100/60" />
        <div className="h-56 rounded-3xl bg-white" />
        <p className="text-center text-primary-300 text-sm">{t('common.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 pt-16 pb-28">
        <div className="p-card flex flex-col items-center justify-center py-12 px-6 gap-3 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-sm text-accent-600">{error}</p>
          <button onClick={initAttempt} className="p-btn-navy">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="px-4 pt-16 pb-28">
        <div className="p-card flex flex-col items-center justify-center py-12 px-6 gap-3 text-center">
          <span className="w-14 h-14 rounded-full bg-success text-white text-2xl font-bold flex items-center justify-center shadow-lg">✓</span>
          <p className="text-lg font-extrabold text-primary">{t('testAttempt.submitted')}</p>
          <p className="text-sm text-gray-500">{t('testAttempt.submittedMessage')}</p>
        </div>
      </div>
    );
  }

  if (!attempt) return null;

  const currentQuestion = attempt.questions[currentQuestionIndex];
  const currentAnswer = answers[currentQuestionIndex];
  // Hindi-subject questions stay in Hindi even when the app is in English
  const qHi = questionLanguage(language, currentQuestion.subject) === 'hi';
  const questionText = qHi ? currentQuestion.textHi : currentQuestion.textEn;

  const options = [
    { label: 'A', text: qHi ? currentQuestion.optionAHi : currentQuestion.optionAEn },
    { label: 'B', text: qHi ? currentQuestion.optionBHi : currentQuestion.optionBEn },
    { label: 'C', text: qHi ? currentQuestion.optionCHi : currentQuestion.optionCEn },
    { label: 'D', text: qHi ? currentQuestion.optionDHi : currentQuestion.optionDEn },
  ];

  const totalQuestions = attempt.questions.length;
  const answeredCount = answers.filter((a) => a.selectedOption !== null).length;
  const unansweredCount = totalQuestions - answeredCount;
  const markedCount = answers.filter((a) => a.markedForReview).length;
  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const lowTime = remainingSeconds <= 60;

  return (
    <div className="pb-28 xl:max-w-[1500px] xl:mx-auto">
      {/* Header: Timer + Question counter + Submit */}
      <div className="sticky top-0 z-40 p-hero rounded-b-[28px] lg:rounded-3xl lg:mt-6 px-4 lg:px-8 pt-4 pb-4">
        <div className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-secondary/25 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold leading-snug">
              {t('testAttempt.questionOf', {
                current: String(currentQuestionIndex + 1),
                total: String(totalQuestions),
              })}
            </p>
            <p className="text-[10px] text-secondary-200 font-semibold mt-0.5">
              {answeredCount}/{totalQuestions} {t('testAttempt.legendAnswered')}
            </p>
          </div>
          <div
            className={`px-3 py-1.5 rounded-2xl border text-base font-mono font-black tabular-nums whitespace-nowrap ${
              lowTime ? 'bg-accent border-accent-300 text-white animate-pulse' : 'bg-white/10 border-white/15 text-white'
            }`}
            aria-live="polite"
            aria-label={t('testAttempt.timeRemaining')}
          >
            ⏱ {formatTime(remainingSeconds)}
          </div>
          <button
            onClick={() => setShowConfirmDialog(true)}
            className="p-btn shrink-0"
          >
            {t('testAttempt.submitTest')}
          </button>
        </div>
        <div className="relative mt-3 h-1.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-secondary-400 to-secondary-200 transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-x-5 lg:gap-y-4 lg:items-start">
        {/* Marking scheme notice */}
        {marking && (
          <div
            role="note"
            className={`lg:col-span-2 lg:col-start-1 flex items-start gap-2 rounded-2xl border px-3 py-2 text-[11px] leading-snug ${
              marking.ratio > 0 ? 'bg-accent-50 border-accent-100 text-accent-700' : 'bg-green-50 border-green-100 text-green-700'
            }`}
          >
            <span className="text-sm leading-none mt-0.5">{marking.ratio > 0 ? '⚠️' : '✅'}</span>
            <p>
              <span className="font-bold">
                {language === 'hi' ? 'नेगेटिव मार्किंग: ' : 'Negative marking: '}
                {negativeLabel(marking.ratio, language === 'hi', marking.mpq)}
              </span>
              {marking.ratio > 0 && (
                <span className="font-medium">
                  {language === 'hi'
                    ? '। जवाब छोड़ने पर कोई अंक नहीं कटते।'
                    : '. Skipping a question costs nothing.'}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Question Card */}
        <div className="p-card p-5 lg:p-8 space-y-5 lg:col-span-2 lg:col-start-1">
          {/* Question Text */}
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 shrink-0 rounded-xl bg-primary text-secondary-200 text-sm font-extrabold flex items-center justify-center shadow">
              {currentQuestionIndex + 1}
            </span>
            <p className="text-[15px] lg:text-lg font-semibold text-primary leading-relaxed">{questionText}</p>
          </div>

          {/* Options */}
          <fieldset className="space-y-2.5">
            <legend className="sr-only">{t('testAttempt.selectAnswer')}</legend>
            {options.map((option, idx) => {
              const selected = currentAnswer?.selectedOption === idx;
              return (
                <label
                  key={idx}
                  className={`flex items-center gap-3 p-3 lg:p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-[0.99] ${
                    selected
                      ? 'border-secondary bg-secondary-50 shadow-[0_6px_18px_-10px_rgba(197,160,40,0.9)]'
                      : 'border-primary-100 bg-white hover:border-primary-200'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestionIndex}`}
                    value={idx}
                    checked={selected}
                    onChange={() => handleOptionSelect(idx)}
                    className="sr-only"
                  />
                  <span
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-extrabold ${
                      selected ? 'bg-secondary text-primary-800' : 'bg-primary-50 text-primary-400'
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className={`text-sm lg:text-base leading-snug ${selected ? 'text-primary font-semibold' : 'text-primary-700'}`}>{option.text}</span>
                  {selected && <span className="ml-auto text-secondary-600 font-bold">✓</span>}
                </label>
              );
            })}
          </fieldset>

          {/* Mark for Review */}
          <label
            className={`inline-flex items-center gap-2 cursor-pointer rounded-full px-3.5 py-2 text-xs font-semibold border transition-colors ${
              currentAnswer?.markedForReview
                ? 'bg-secondary-100 border-secondary-300 text-secondary-700'
                : 'bg-primary-50 border-primary-100 text-primary-400'
            }`}
          >
            <input
              type="checkbox"
              checked={currentAnswer?.markedForReview ?? false}
              onChange={(e) => handleMarkForReview(e.target.checked)}
              className="sr-only"
            />
            <span>🔖</span>
            <span>{t('testAttempt.markForReview')}</span>
          </label>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:col-start-1">
          <button
            onClick={() => goToQuestion(currentQuestionIndex - 1)}
            disabled={currentQuestionIndex === 0}
            className="p-btn-ghost py-3"
          >
            ← {t('common.back')}
          </button>
          <button
            onClick={() => goToQuestion(currentQuestionIndex + 1)}
            disabled={currentQuestionIndex === attempt.questions.length - 1}
            className="p-btn-navy py-3"
          >
            {t('common.next')} →
          </button>
        </div>

        {/* Question Navigation Grid */}
        <div className="lg:col-start-3 lg:row-start-1 lg:row-span-3 lg:sticky lg:top-28">
          <QuestionNavigationPanel
            totalQuestions={attempt.questions.length}
            answers={answers}
            currentQuestionIndex={currentQuestionIndex}
            onNavigate={goToQuestion}
          />
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-primary-900/60 backdrop-blur-sm px-4 pb-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-title"
        >
          <div className="p-card w-full max-w-md p-6 space-y-4">
            <h2 id="confirm-submit-title" className="text-lg font-extrabold text-primary">
              {t('testAttempt.confirmSubmit')}
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-success/15 py-2.5">
                <p className="text-lg font-black text-green-700 tabular-nums">{answeredCount}</p>
                <p className="text-[9px] text-green-700">{t('testAttempt.legendAnswered')}</p>
              </div>
              <div className="rounded-2xl bg-primary-50 py-2.5">
                <p className="text-lg font-black text-primary tabular-nums">{unansweredCount}</p>
                <p className="text-[9px] text-primary-400">{t('testAttempt.legendUnanswered')}</p>
              </div>
              <div className="rounded-2xl bg-secondary-100 py-2.5">
                <p className="text-lg font-black text-secondary-700 tabular-nums">{markedCount}</p>
                <p className="text-[9px] text-secondary-700">{t('testAttempt.legendMarkedForReview')}</p>
              </div>
            </div>
            {marking && marking.ratio > 0 && (
              <p className="rounded-xl bg-accent-50 border border-accent-100 px-3 py-2 text-[11px] text-accent-700">
                ⚠️ {language === 'hi'
                  ? `नेगेटिव मार्किंग: हर गलत जवाब पर −${negativeLabel(marking.ratio, false, marking.mpq).match(/[\d.]+/)?.[0] ?? ''}। भरोसा न हो तो जवाब छोड़ दें।`
                  : `Negative marking: ${negativeLabel(marking.ratio, false, marking.mpq)}. Leave a question blank if you are unsure.`}
              </p>
            )}
            <div className="space-y-1 text-sm text-primary-600">
              <p>
                {t('testAttempt.unansweredCount', {
                  count: String(answers.filter((a) => a.selectedOption === null).length),
                })}
              </p>
              <p>
                {t('testAttempt.markedForReviewCount', {
                  count: String(answers.filter((a) => a.markedForReview).length),
                })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={isSubmitting}
                className="p-btn-ghost py-3"
              >
                {t('testAttempt.cancelButton')}
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="p-btn py-3"
              >
                {isSubmitting ? t('common.loading') : t('testAttempt.confirmSubmitButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
