import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface Exam {
  id: string;
  name_en: string;
  name_hi: string;
  category: string;
}

interface FormData {
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
  correctOption: number;
  explanationEn: string;
  explanationHi: string;
  subject: string;
  topic: string;
  difficulty: string;
  imageUrl: string;
  examIds: string[];
}

interface FormErrors {
  [key: string]: string;
}

// ─── Constants ────────────────────────────────────────────────────────

const SUBJECTS = ['gk', 'math', 'reasoning', 'hindi'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const INITIAL_FORM: FormData = {
  textEn: '',
  textHi: '',
  optionAEn: '',
  optionAHi: '',
  optionBEn: '',
  optionBHi: '',
  optionCEn: '',
  optionCHi: '',
  optionDEn: '',
  optionDHi: '',
  correctOption: 0,
  explanationEn: '',
  explanationHi: '',
  subject: '',
  topic: '',
  difficulty: '',
  imageUrl: '',
  examIds: [],
};

// ─── Main Component ───────────────────────────────────────────────────

export function QuestionEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // State
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; nameEn: string }[]>([]);
  const [topics, setTopics] = useState<{ id: string; nameEn: string; nameHi: string }[]>([]);
  const [showAddTopic, setShowAddTopic] = useState(false);

  // ─── Load Exams ───────────────────────────────────────────────────

  useEffect(() => {
    async function loadExams() {
      try {
        const response = await api.get('/api/onboarding/exams');
        const data = response.data.data;
        // Flatten grouped exams (state + central)
        const all: Exam[] = [
          ...(data.state || []),
          ...(data.central || []),
        ];
        setExams(all);
      } catch {
        // Non-critical, the user can still submit with empty exam selection
      }
    }
    loadExams();
  }, []);

  // ─── Load Subjects ─────────────────────────────────────────────────

  useEffect(() => {
    api.get('/api/subjects')
      .then((res) => setSubjects(res.data?.data ?? []))
      .catch(() => {});
  }, []);

  // ─── Load Topics when Subject Changes ─────────────────────────────

  useEffect(() => {
    if (!form.subject) {
      setTopics([]);
      return;
    }
    // Map form enum to DB subject name
    const subjectMap: Record<string, string[]> = {
      'gk': ['general knowledge', 'gk', 'general'],
      'math': ['numerical ability', 'math', 'numerical'],
      'reasoning': ['mental ability', 'reasoning', 'mental'],
      'hindi': ['hindi'],
    };
    const keywords = subjectMap[form.subject] || [form.subject];
    const matchedSubject = subjects.find((s) =>
      keywords.some((kw) => s.nameEn.toLowerCase().includes(kw))
    );
    if (matchedSubject) {
      api.get(`/api/subjects/${matchedSubject.id}/topics`)
        .then((res) => {
          setTopics(res.data?.data ?? []);
        })
        .catch(() => setTopics([]));
    } else {
      setTopics([]);
    }
  }, [form.subject, subjects]);

  // ─── Load Question for Edit Mode ─────────────────────────────────

  useEffect(() => {
    if (!isEditMode || !id) return;

    async function loadQuestion() {
      setLoading(true);
      setFetchError(null);
      try {
        const response = await api.get(`/api/questions/${id}`);
        const q = response.data.data;

        setForm({
          textEn: q.textEn || '',
          textHi: q.textHi || '',
          optionAEn: q.options[0]?.en || '',
          optionAHi: q.options[0]?.hi || '',
          optionBEn: q.options[1]?.en || '',
          optionBHi: q.options[1]?.hi || '',
          optionCEn: q.options[2]?.en || '',
          optionCHi: q.options[2]?.hi || '',
          optionDEn: q.options[3]?.en || '',
          optionDHi: q.options[3]?.hi || '',
          correctOption: q.correctOption ?? 0,
          explanationEn: q.explanationEn || '',
          explanationHi: q.explanationHi || '',
          subject: q.subject || '',
          topic: q.topic || '',
          difficulty: q.difficulty || '',
          imageUrl: q.imageUrl || '',
          examIds: q.examIds || [],
        });
      } catch {
        setFetchError('Failed to load question. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadQuestion();
  }, [id, isEditMode]);

  // ─── Form Helpers ─────────────────────────────────────────────────

  function updateField(field: keyof FormData, value: string | number | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error for that field
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  }

  function toggleExamId(examId: string) {
    setForm((prev) => {
      const current = prev.examIds;
      const updated = current.includes(examId)
        ? current.filter((id) => id !== examId)
        : [...current, examId];
      return { ...prev, examIds: updated };
    });
    if (errors.examIds) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.examIds;
        return copy;
      });
    }
  }

  // ─── Validation ───────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!form.textEn.trim()) newErrors.textEn = 'English question text is required';
    if (!form.textHi.trim()) newErrors.textHi = 'Hindi question text is required';
    if (!form.optionAEn.trim()) newErrors.optionAEn = 'Option A (English) is required';
    if (!form.optionAHi.trim()) newErrors.optionAHi = 'Option A (Hindi) is required';
    if (!form.optionBEn.trim()) newErrors.optionBEn = 'Option B (English) is required';
    if (!form.optionBHi.trim()) newErrors.optionBHi = 'Option B (Hindi) is required';
    if (!form.optionCEn.trim()) newErrors.optionCEn = 'Option C (English) is required';
    if (!form.optionCHi.trim()) newErrors.optionCHi = 'Option C (Hindi) is required';
    if (!form.optionDEn.trim()) newErrors.optionDEn = 'Option D (English) is required';
    if (!form.optionDHi.trim()) newErrors.optionDHi = 'Option D (Hindi) is required';
    if (!form.subject) newErrors.subject = 'Subject is required';
    if (!form.difficulty) newErrors.difficulty = 'Difficulty is required';
    if (form.examIds.length === 0) newErrors.examIds = 'Select at least one exam';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── Submit ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    setSaveError(null);
    setSuccessMessage(null);

    const payload = {
      textEn: form.textEn.trim(),
      textHi: form.textHi.trim(),
      options: [
        { en: form.optionAEn.trim(), hi: form.optionAHi.trim() },
        { en: form.optionBEn.trim(), hi: form.optionBHi.trim() },
        { en: form.optionCEn.trim(), hi: form.optionCHi.trim() },
        { en: form.optionDEn.trim(), hi: form.optionDHi.trim() },
      ],
      correctOption: form.correctOption,
      ...(form.explanationEn.trim() && { explanationEn: form.explanationEn.trim() }),
      ...(form.explanationHi.trim() && { explanationHi: form.explanationHi.trim() }),
      subject: form.subject,
      ...(form.topic.trim() && { topic: form.topic.trim() }),
      difficulty: form.difficulty,
      ...(form.imageUrl.trim() && { imageUrl: form.imageUrl.trim() }),
      examIds: form.examIds.length > 0 ? form.examIds : undefined,
    };

    try {
      if (isEditMode && id) {
        await api.put(`/api/questions/${id}`, payload);
        setSuccessMessage('Question updated successfully!');
      } else {
        await api.post('/api/questions', payload);
        setSuccessMessage('Question created successfully!');
      }

      // Navigate back after short delay so user sees success message
      setTimeout(() => navigate('/admin/questions'), 1500);
    } catch {
      setSaveError('Failed to save question. Please check your input and try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading State ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Fetch Error State ────────────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {isEditMode ? 'Edit Question' : 'Create Question'}
        </h1>
        <button
          onClick={() => navigate('/admin/questions')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section: Question Text */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Question Text</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">English *</label>
              <textarea
                value={form.textEn}
                onChange={(e) => updateField('textEn', e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${errors.textEn ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Enter question text in English..."
              />
              {errors.textEn && <p className="text-xs text-red-600 mt-1">{errors.textEn}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hindi *</label>
              <textarea
                value={form.textHi}
                onChange={(e) => updateField('textHi', e.target.value)}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y ${errors.textHi ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="प्रश्न का पाठ हिंदी में दर्ज करें..."
              />
              {errors.textHi && <p className="text-xs text-red-600 mt-1">{errors.textHi}</p>}
            </div>
          </div>
        </section>

        {/* Section: Options */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Options</h2>
          <div className="space-y-4">
            {(['A', 'B', 'C', 'D'] as const).map((letter) => {
              const enField = `option${letter}En` as keyof FormData;
              const hiField = `option${letter}Hi` as keyof FormData;
              return (
                <div key={letter} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Option {letter} (English) *
                    </label>
                    <input
                      type="text"
                      value={form[enField] as string}
                      onChange={(e) => updateField(enField, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[enField] ? 'border-red-300' : 'border-gray-300'}`}
                      placeholder={`Option ${letter} in English`}
                    />
                    {errors[enField] && <p className="text-xs text-red-600 mt-1">{errors[enField]}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Option {letter} (Hindi) *
                    </label>
                    <input
                      type="text"
                      value={form[hiField] as string}
                      onChange={(e) => updateField(hiField, e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors[hiField] ? 'border-red-300' : 'border-gray-300'}`}
                      placeholder={`विकल्प ${letter} हिंदी में`}
                    />
                    {errors[hiField] && <p className="text-xs text-red-600 mt-1">{errors[hiField]}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section: Answer & Explanation */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Answer & Explanation</h2>

          {/* Correct Option */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">Correct Answer *</label>
            <div className="flex flex-wrap gap-4">
              {(['A', 'B', 'C', 'D'] as const).map((letter, index) => (
                <label key={letter} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={form.correctOption === index}
                    onChange={() => updateField('correctOption', index)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Option {letter}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Explanation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Explanation (English)</label>
              <textarea
                value={form.explanationEn}
                onChange={(e) => updateField('explanationEn', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="Explanation in English (optional)..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Explanation (Hindi)</label>
              <textarea
                value={form.explanationHi}
                onChange={(e) => updateField('explanationHi', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="हिंदी में व्याख्या (वैकल्पिक)..."
              />
            </div>
          </div>
        </section>

        {/* Section: Metadata */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Metadata</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label>
              <select
                value={form.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${errors.subject ? 'border-red-300' : 'border-gray-300'}`}
              >
                <option value="">Select subject...</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              {errors.subject && <p className="text-xs text-red-600 mt-1">{errors.subject}</p>}
            </div>

            {/* Topic */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
              {showAddTopic ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.topic}
                    onChange={(e) => updateField('topic', e.target.value)}
                    placeholder="Enter new topic name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddTopic(false)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <select
                    value={form.topic}
                    onChange={(e) => updateField('topic', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select topic</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.nameEn}>{t.nameEn}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddTopic(true)}
                    className="mt-1 text-xs text-indigo-600 font-medium hover:text-indigo-700"
                  >
                    + Add New Topic
                  </button>
                </div>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Difficulty *</label>
              <div className="flex gap-4">
                {DIFFICULTIES.map((d) => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="difficulty"
                      checked={form.difficulty === d}
                      onChange={() => updateField('difficulty', d)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{d}</span>
                  </label>
                ))}
              </div>
              {errors.difficulty && <p className="text-xs text-red-600 mt-1">{errors.difficulty}</p>}
            </div>
          </div>

          {/* Image URL */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Image URL (optional)</label>
            <input
              type="text"
              value={form.imageUrl}
              onChange={(e) => updateField('imageUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://... (image upload coming soon)"
            />
          </div>

          {/* Exam Selection */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Exams * <span className="text-gray-400 font-normal">(select at least one)</span>
            </label>
            {exams.length === 0 ? (
              <p className="text-sm text-gray-400">Loading exams...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {exams.map((exam) => (
                  <label key={exam.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={form.examIds.includes(exam.id)}
                      onChange={() => toggleExamId(exam.id)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 truncate" title={exam.name_en}>
                      {exam.name_en}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {errors.examIds && <p className="text-xs text-red-600 mt-1">{errors.examIds}</p>}
          </div>
        </section>

        {/* Sticky Save Bar */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/questions')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : isEditMode ? 'Update Question' : 'Create Question'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
