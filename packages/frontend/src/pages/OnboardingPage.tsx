import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { AxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n';
import { LoadingButton } from '@/components/common/LoadingButton';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import api from '@/services/api';
import type { Language } from '@/i18n';

// --- Types ---

interface Exam {
  id: string;
  name_en: string;
  name_hi: string;
  description_en?: string;
  description_hi?: string;
  category: 'state' | 'central';
  icon_url?: string;
}

interface ExamsResponse {
  state: Exam[];
  central: Exam[];
}

type OnboardingStep = 'exam_selection' | 'profile_setup';

// --- Name validation (Requirements 10.3, 12.2) ---

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const NAME_PATTERN = /^[\p{L}\s\-\.]+$/u;

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'nameRequired';
  if (trimmed.length < NAME_MIN_LENGTH) return 'nameTooShort';
  if (trimmed.length > NAME_MAX_LENGTH) return 'nameTooLong';
  if (!NAME_PATTERN.test(trimmed)) return 'nameInvalidChars';
  return null;
}

// --- ExamSelector Component ---

interface ExamSelectorProps {
  onConfirm: (examId: string, examIds: string[]) => void;
  isLoading: boolean;
  error: string | null;
  onRetryLoad: () => void;
  exams: ExamsResponse | null;
  examsLoading: boolean;
}

function ExamSelector({ onConfirm, isLoading, error, onRetryLoad, exams, examsLoading }: ExamSelectorProps) {
  const { t, language } = useTranslation();
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);

  const getExamName = (exam: Exam) => language === 'hi' ? exam.name_hi : exam.name_en;
  const getExamDescription = (exam: Exam) => language === 'hi' ? exam.description_hi : exam.description_en;

  const handleConfirm = () => {
    if (selectedExamIds.length > 0) {
      onConfirm(selectedExamIds[0], selectedExamIds);
    }
  };

  const toggleExam = (examId: string) => {
    setSelectedExamIds((prev) =>
      prev.includes(examId) ? prev.filter((id) => id !== examId) : [...prev, examId]
    );
  };

  // Loading state for exam list
  if (examsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="mt-3 text-sm text-primary-300">{t('common.loading')}</p>
      </div>
    );
  }

  // Error state for exam list load failure
  if (!exams && error) {
    return (
      <div className="text-center py-8">
        <div className="p-3 rounded-md bg-accent-50 border border-accent-200 text-sm text-accent-700 mb-4" role="alert">
          {t('onboarding.examSelection.loadFailed')}
        </div>
        <LoadingButton onClick={onRetryLoad} variant="secondary">
          {t('onboarding.examSelection.retry')}
        </LoadingButton>
      </div>
    );
  }

  if (!exams) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">{t('onboarding.examSelection.title')}</h2>
        <p className="mt-1 text-sm text-primary-300">{t('onboarding.examSelection.subtitle')}</p>
      </div>

      {/* Error display for save failures */}
      {error && exams && (
        <div className="p-3 rounded-md bg-accent-50 border border-accent-200 text-sm text-accent-700" role="alert">
          {error}
        </div>
      )}

      {/* State Exams Category */}
      {exams.state.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-3">
            {t('onboarding.examSelection.stateExams')}
          </h3>
          <div className="grid gap-3">
            {exams.state.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                name={getExamName(exam)}
                description={getExamDescription(exam)}
                selected={selectedExamIds.includes(exam.id)}
                onSelect={() => toggleExam(exam.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Central Exams Category */}
      {exams.central.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary-600 uppercase tracking-wide mb-3">
            {t('onboarding.examSelection.centralExams')}
          </h3>
          <div className="grid gap-3">
            {exams.central.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                name={getExamName(exam)}
                description={getExamDescription(exam)}
                selected={selectedExamIds.includes(exam.id)}
                onSelect={() => toggleExam(exam.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Confirm button */}
      <LoadingButton
        onClick={handleConfirm}
        loading={isLoading}
        disabled={selectedExamIds.length === 0}
        type="button"
      >
        {t('onboarding.examSelection.confirm')}
      </LoadingButton>

      {/* Required hint when nothing selected */}
      {selectedExamIds.length === 0 && (
        <p className="text-xs text-primary-300 text-center">{t('onboarding.examSelection.required')}</p>
      )}
    </div>
  );
}

// --- ExamCard Component ---

interface ExamCardProps {
  exam: Exam;
  name: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}

function ExamCard({ exam, name, description, selected, onSelect }: ExamCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full text-left p-4 rounded-lg border-2 transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
        ${selected
          ? 'border-primary bg-primary-50'
          : 'border-primary-100 hover:border-primary-200 bg-white'
        }
      `.trim()}
      aria-pressed={selected}
    >
      <div className="flex items-center gap-3">
        {exam.icon_url && (
          <img src={exam.icon_url} alt="" className="w-10 h-10 rounded-md object-cover" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${selected ? 'text-primary' : 'text-primary-700'}`}>
            {name}
          </p>
          {description && (
            <p className="text-xs text-primary-300 mt-0.5 truncate">{description}</p>
          )}
        </div>
        {selected && (
          <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}

// --- ProfileSetupForm Component ---

interface ProfileSetupFormProps {
  onSubmit: (data: { fullName: string; preferredLanguage: Language }) => void;
  isLoading: boolean;
  error: string | null;
  initialName: string;
}

function ProfileSetupForm({ onSubmit, isLoading, error, initialName }: ProfileSetupFormProps) {
  const { t, language } = useTranslation();
  const [fullName, setFullName] = useState(initialName);
  const [preferredLanguage, setPreferredLanguage] = useState<Language>(language);
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    const validationError = validateName(fullName);
    if (validationError) {
      setNameError(t(`onboarding.profileSetup.${validationError}`));
      return;
    }

    setNameError(null);
    onSubmit({ fullName: fullName.trim(), preferredLanguage });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
    // Clear error on input change
    if (nameError) {
      setNameError(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary">{t('onboarding.profileSetup.title')}</h2>
        <p className="mt-1 text-sm text-primary-300">{t('onboarding.profileSetup.subtitle')}</p>
      </div>

      {/* Error display for save failures */}
      {error && (
        <div className="p-3 rounded-md bg-accent-50 border border-accent-200 text-sm text-accent-700" role="alert">
          {error}
        </div>
      )}

      {/* Full Name input */}
      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-primary-700 mb-1">
          {t('onboarding.profileSetup.nameLabel')}
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={handleNameChange}
          placeholder={t('onboarding.profileSetup.namePlaceholder')}
          maxLength={NAME_MAX_LENGTH}
          className={`
            w-full px-3 py-2.5 rounded-md border text-sm
            focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary
            ${nameError ? 'border-accent-400' : 'border-primary-200'}
          `.trim()}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'name-error' : undefined}
        />
        {nameError && (
          <p id="name-error" className="mt-1 text-xs text-accent-600" role="alert">
            {nameError}
          </p>
        )}
      </div>

      {/* Preferred Language select */}
      <div>
        <label htmlFor="preferredLanguage" className="block text-sm font-medium text-primary-700 mb-1">
          {t('onboarding.profileSetup.languageLabel')}
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPreferredLanguage('hi')}
            className={`
              flex-1 py-2.5 px-4 rounded-md text-sm font-medium border-2 transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
              ${preferredLanguage === 'hi'
                ? 'border-primary bg-primary-50 text-primary'
                : 'border-primary-100 text-primary-600 hover:border-primary-200'
              }
            `.trim()}
            aria-pressed={preferredLanguage === 'hi'}
          >
            {t('onboarding.profileSetup.languageHindi')}
          </button>
          <button
            type="button"
            onClick={() => setPreferredLanguage('en')}
            className={`
              flex-1 py-2.5 px-4 rounded-md text-sm font-medium border-2 transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300
              ${preferredLanguage === 'en'
                ? 'border-primary bg-primary-50 text-primary'
                : 'border-primary-100 text-primary-600 hover:border-primary-200'
              }
            `.trim()}
            aria-pressed={preferredLanguage === 'en'}
          >
            {t('onboarding.profileSetup.languageEnglish')}
          </button>
        </div>
      </div>

      {/* Avatar upload (optional) */}
      <div>
        <label className="block text-sm font-medium text-primary-700 mb-1">
          {t('onboarding.profileSetup.avatarLabel')}
        </label>
        <p className="text-xs text-primary-300">
          {t('onboarding.profileSetup.avatarUpload')}
        </p>
        {/* Avatar upload is optional — simplified for onboarding. Full upload available in profile settings. */}
      </div>

      {/* Submit button */}
      <LoadingButton
        type="submit"
        loading={isLoading}
      >
        {isLoading ? t('onboarding.profileSetup.saving') : t('onboarding.profileSetup.save')}
      </LoadingButton>
    </form>
  );
}

// --- NavigationBlockerModal Component ---

interface NavigationBlockerModalProps {
  message: string;
  onStay: () => void;
  onLeave: () => void;
}

function NavigationBlockerModal({ message, onStay, onLeave }: NavigationBlockerModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
        <p className="text-sm text-primary-700 mb-6">{message}</p>
        <div className="flex gap-3">
          <LoadingButton onClick={onStay} variant="primary" className="flex-1">
            {t('common.ok')}
          </LoadingButton>
          <LoadingButton onClick={onLeave} variant="secondary" className="flex-1">
            {t('common.cancel')}
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}

// --- Main OnboardingPage Component ---

/**
 * OnboardingPage — Two-step onboarding flow: Exam Selection → Profile Setup.
 *
 * - Step 1: ExamSelector — fetches exams from API, single selection, confirm
 * - Step 2: ProfileSetupForm — name (pre-filled from Google), language select, optional avatar
 * - Blocks navigation until onboarding is complete
 * - Handles network errors with retry
 * - Routes to /dashboard on completion
 *
 * Requirements: 9.1–9.7, 10.1–10.7
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const { t } = useTranslation();

  const [step, setStep] = useState<OnboardingStep>('exam_selection');
  const [exams, setExams] = useState<ExamsResponse | null>(null);
  const [examsLoading, setExamsLoading] = useState(true);
  const [examError, setExamError] = useState<string | null>(null);
  const [examSaving, setExamSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Block navigation away from onboarding (Requirement 9.5)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !onboardingComplete && currentLocation.pathname !== nextLocation.pathname
  );

  // Fetch exams on mount
  const fetchExams = useCallback(async () => {
    setExamsLoading(true);
    setExamError(null);

    try {
      const response = await api.get('/api/onboarding/exams');
      const data = response.data?.data;
      setExams(data ?? { state: [], central: [] });
    } catch (err) {
      const axiosError = err as AxiosError;
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ERR_CANCELED') {
        setExamError(t('errors.timeout'));
      } else if (!axiosError.response) {
        setExamError(t('errors.network'));
      } else {
        setExamError(t('onboarding.examSelection.loadFailed'));
      }
    } finally {
      setExamsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // Handle exam selection confirmation (Requirement 9.4)
  const handleExamConfirm = useCallback(async (examId: string, examIds: string[]) => {
    setExamSaving(true);
    setExamError(null);

    try {
      await api.post('/api/onboarding/exam-selection', { examId, examIds });
      // Move to profile setup step (exam already saved by API)
      setStep('profile_setup');
    } catch (err) {
      const axiosError = err as AxiosError;
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ERR_CANCELED') {
        setExamError(t('errors.timeout'));
      } else if (!axiosError.response) {
        setExamError(t('errors.network'));
      } else {
        setExamError(t('onboarding.examSelection.saveFailed'));
      }
    } finally {
      setExamSaving(false);
    }
  }, [t]);

  // Handle profile setup submission (Requirement 10.5)
  const handleProfileSubmit = useCallback(async (data: { fullName: string; preferredLanguage: Language }) => {
    setProfileSaving(true);
    setProfileError(null);

    try {
      await api.post('/api/onboarding/profile-setup', {
        full_name: data.fullName,
        preferred_language: data.preferredLanguage,
      });
      // Mark onboarding as complete (unblock navigation)
      setOnboardingComplete(true);
      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const axiosError = err as AxiosError;
      if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ERR_CANCELED') {
        setProfileError(t('errors.timeout'));
      } else if (!axiosError.response) {
        setProfileError(t('errors.network'));
      } else {
        setProfileError(t('onboarding.profileSetup.saveFailed'));
      }
    } finally {
      setProfileSaving(false);
    }
  }, [t, updateProfile, navigate]);

  return (
    <div className="space-y-6">
      {/* Language toggle */}
      <div className="flex justify-end">
        <LanguageToggle />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className={`w-2.5 h-2.5 rounded-full ${step === 'exam_selection' ? 'bg-primary' : 'bg-primary-200'}`} />
        <div className={`w-8 h-0.5 ${step === 'profile_setup' ? 'bg-primary' : 'bg-primary-200'}`} />
        <div className={`w-2.5 h-2.5 rounded-full ${step === 'profile_setup' ? 'bg-primary' : 'bg-primary-200'}`} />
      </div>

      {/* Step content */}
      {step === 'exam_selection' && (
        <ExamSelector
          onConfirm={handleExamConfirm}
          isLoading={examSaving}
          error={examError}
          onRetryLoad={fetchExams}
          exams={exams}
          examsLoading={examsLoading}
        />
      )}

      {step === 'profile_setup' && (
        <ProfileSetupForm
          onSubmit={handleProfileSubmit}
          isLoading={profileSaving}
          error={profileError}
          initialName={user?.fullName ?? ''}
        />
      )}

      {/* Navigation blocker modal */}
      {blocker.state === 'blocked' && (
        <NavigationBlockerModal
          message={t('onboarding.navigationPrompt')}
          onStay={() => blocker.reset()}
          onLeave={() => blocker.proceed()}
        />
      )}
    </div>
  );
}
