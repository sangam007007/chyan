import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/services/api';
import { StepDetails } from '../components/wizard/StepDetails';
import { StepConfig } from '../components/wizard/StepConfig';
import { StepQuestions } from '../components/wizard/StepQuestions';
import { StepPreview } from '../components/wizard/StepPreview';
import { StepPublish } from '../components/wizard/StepPublish';

// ─── Types ────────────────────────────────────────────────────────────

export interface Exam {
  id: string;
  name_en: string;
  name_hi: string;
  category: string;
}

export interface QuestionItem {
  id: string;
  textEn: string;
  subject: string;
  difficulty: string;
}

export interface WizardData {
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
  examId: string;
  category: string;
  durationMinutes: number;
  totalMarks: number;
  marksPerQuestion: number;
  negativeMarkingRatio: number;
  passingMarks: number;
  pricingType: 'free' | 'premium';
  questionIds: string[];
  status: 'draft' | 'published';
  availableFrom: string;
  availableUntil: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const STEPS = ['Details', 'Config', 'Questions', 'Preview', 'Publish'] as const;

const INITIAL_DATA: WizardData = {
  titleEn: '',
  titleHi: '',
  descriptionEn: '',
  descriptionHi: '',
  examId: '',
  category: '',
  durationMinutes: 120,
  totalMarks: 300,
  marksPerQuestion: 2,
  negativeMarkingRatio: 0.25,
  passingMarks: 150,
  pricingType: 'free',
  questionIds: [],
  status: 'draft',
  availableFrom: '',
  availableUntil: '',
};

// ─── Progress Bar ─────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((label, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        return (
          <div key={label} className="flex-1 flex flex-col items-center relative">
            {idx > 0 && (
              <div className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${isCompleted ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isActive
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : isCompleted
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-400'
              }`}
            >
              {isCompleted ? '✓' : idx + 1}
            </div>
            <span className={`mt-1 text-xs font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-blue-600' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────

export function TestWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [exams, setExams] = useState<Exam[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Load Exams ───────────────────────────────────────────────────

  useEffect(() => {
    async function loadExams() {
      try {
        const response = await api.get('/api/onboarding/exams');
        const d = response.data.data;
        const all: Exam[] = [...(d.state || []), ...(d.central || [])];
        setExams(all);
      } catch {
        // Non-critical
      }
    }
    loadExams();
  }, []);

  // ─── Load Test for Edit Mode ──────────────────────────────────────

  useEffect(() => {
    if (!isEditMode || !id) return;

    async function loadTest() {
      setLoading(true);
      setFetchError(null);
      try {
        const response = await api.get(`/api/tests/${id}`);
        const t = response.data.data;
        setData({
          titleEn: t.titleEn || '',
          titleHi: t.titleHi || '',
          descriptionEn: t.descriptionEn || '',
          descriptionHi: t.descriptionHi || '',
          examId: t.examId || '',
          category: t.category || '',
          durationMinutes: t.durationMinutes || 120,
          totalMarks: t.totalMarks || 300,
          marksPerQuestion: t.marksPerQuestion || 2,
          negativeMarkingRatio: t.negativeMarkingRatio ?? 0.25,
          passingMarks: t.passingMarks || 150,
          pricingType: t.pricingType || 'free',
          questionIds: t.questionIds || [],
          status: t.status || 'draft',
          availableFrom: t.availableFrom ? t.availableFrom.split('T')[0] : '',
          availableUntil: t.availableUntil ? t.availableUntil.split('T')[0] : '',
        });
      } catch {
        setFetchError('Failed to load test details. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadTest();
  }, [id, isEditMode]);

  // ─── Update Handler ───────────────────────────────────────────────

  function updateData(partial: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  // ─── Step Validation ──────────────────────────────────────────────

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!(data.titleEn.trim() && data.titleHi.trim() && data.examId && data.category);
      case 1:
        return data.durationMinutes > 0 && data.totalMarks > 0 && data.passingMarks > 0;
      case 2:
        return data.questionIds.length > 0;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────

  async function handleSubmit() {
    setSaving(true);
    setSaveError(null);

    const payload = {
      titleEn: data.titleEn.trim(),
      titleHi: data.titleHi.trim(),
      descriptionEn: data.descriptionEn.trim() || null,
      descriptionHi: data.descriptionHi.trim() || null,
      examId: data.examId,
      durationMinutes: data.durationMinutes,
      totalMarks: data.totalMarks,
      marksPerQuestion: data.marksPerQuestion,
      negativeMarkingRatio: ['subject_wise', 'topic_wise'].includes(data.category) ? 0 : data.negativeMarkingRatio,
      passingMarks: data.passingMarks,
      pricingType: data.pricingType,
      status: data.status,
      availableFrom: data.availableFrom ? new Date(data.availableFrom).toISOString() : null,
      availableUntil: data.availableUntil ? new Date(data.availableUntil).toISOString() : null,
      category: data.category,
      questionIds: data.questionIds,
    };

    try {
      if (isEditMode && id) {
        await api.put(`/api/tests/${id}`, payload);
      } else {
        await api.post('/api/tests', payload);
      }
      navigate('/admin/tests');
    } catch {
      setSaveError('Failed to save test. Please check your input and try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading / Error States ───────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{fetchError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Render Step ──────────────────────────────────────────────────

  function renderStep() {
    switch (step) {
      case 0:
        return <StepDetails data={data} exams={exams} onChange={updateData} />;
      case 1:
        return <StepConfig data={data} onChange={updateData} />;
      case 2:
        return (
          <StepQuestions
            data={data}
            onChange={updateData}
            allQuestions={allQuestions}
            setAllQuestions={setAllQuestions}
          />
        );
      case 3:
        return <StepPreview data={data} exams={exams} allQuestions={allQuestions} onGoToStep={setStep} />;
      case 4:
        return <StepPublish data={data} onChange={updateData} saving={saving} saveError={saveError} />;
      default:
        return null;
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {isEditMode ? 'Edit Test' : 'Create Test'}
        </h1>
        <button
          onClick={() => navigate('/admin/tests')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Progress */}
      <ProgressBar currentStep={step} />

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {isEditMode && step === 2 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              ⚠️ Question selection will replace existing questions linked to this test.
            </p>
          </div>
        )}
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEditMode ? 'Update Test' : 'Create Test'}
          </button>
        )}
      </div>
    </div>
  );
}
