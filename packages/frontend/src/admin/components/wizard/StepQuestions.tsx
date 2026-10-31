import { useEffect, useState, useCallback } from 'react';
import api from '@/services/api';
import type { WizardData, QuestionItem } from '../../pages/TestWizard';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
  allQuestions: QuestionItem[];
  setAllQuestions: (q: QuestionItem[]) => void;
}

const SUBJECTS = ['gk', 'math', 'reasoning', 'hindi'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

export function StepQuestions({ data, onChange, allQuestions, setAllQuestions }: Props) {
  const [loading, setLoading] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '50');
      if (subjectFilter) params.set('subject', subjectFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);

      const response = await api.get(`/api/questions?${params.toString()}`);
      const questions: QuestionItem[] = (response.data.data.questions || []).map(
        (q: { id: string; textEn: string; subject: string; difficulty: string }) => ({
          id: q.id,
          textEn: q.textEn,
          subject: q.subject,
          difficulty: q.difficulty,
        })
      );
      setAllQuestions(questions);
    } catch {
      // Keep existing list on error
    } finally {
      setLoading(false);
    }
  }, [subjectFilter, difficultyFilter, setAllQuestions]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Filter client-side by search
  const filteredQuestions = allQuestions.filter((q) => {
    if (!searchText.trim()) return true;
    return q.textEn.toLowerCase().includes(searchText.toLowerCase());
  });

  const selectedSet = new Set(data.questionIds);

  function toggleQuestion(qId: string) {
    if (selectedSet.has(qId)) {
      onChange({ questionIds: data.questionIds.filter((id) => id !== qId) });
    } else {
      onChange({ questionIds: [...data.questionIds, qId] });
    }
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const ids = [...data.questionIds];
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    onChange({ questionIds: ids });
  }

  function moveDown(index: number) {
    if (index === data.questionIds.length - 1) return;
    const ids = [...data.questionIds];
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    onChange({ questionIds: ids });
  }

  function removeQuestion(qId: string) {
    onChange({ questionIds: data.questionIds.filter((id) => id !== qId) });
  }

  const totalMarksCalc = data.questionIds.length * data.marksPerQuestion;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Select Questions</h2>

      <p className="text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
        {data.questionIds.length} questions selected ({totalMarksCalc} marks total)
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Available questions */}
        <div className="border border-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Available Questions</h3>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input
              type="text"
              placeholder="Search..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Subjects</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Difficulty</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto space-y-1">
            {loading ? (
              <div className="animate-pulse space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded" />
                ))}
              </div>
            ) : filteredQuestions.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No questions found.</p>
            ) : (
              filteredQuestions.map((q) => (
                <label
                  key={q.id}
                  className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${selectedSet.has(q.id) ? 'bg-blue-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSet.has(q.id)}
                    onChange={() => toggleQuestion(q.id)}
                    className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 truncate">{q.textEn}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{q.subject} · {q.difficulty}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        {/* Right: Selected questions (ordered) */}
        <div className="border border-gray-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            Selected ({data.questionIds.length})
          </h3>

          <div className="max-h-72 overflow-y-auto space-y-1">
            {data.questionIds.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No questions selected yet.</p>
            ) : (
              data.questionIds.map((qId, idx) => {
                const q = allQuestions.find((x) => x.id === qId);
                return (
                  <div key={qId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <span className="text-[10px] text-gray-400 font-mono w-5">{idx + 1}.</span>
                    <p className="flex-1 text-xs text-gray-800 truncate">
                      {q?.textEn || qId.substring(0, 8) + '...'}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        disabled={idx === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        disabled={idx === data.questionIds.length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(qId)}
                        className="text-red-400 hover:text-red-600 text-xs ml-1"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {data.questionIds.length === 0 && (
        <p className="text-xs text-red-500">Select at least 1 question to proceed.</p>
      )}
    </div>
  );
}
