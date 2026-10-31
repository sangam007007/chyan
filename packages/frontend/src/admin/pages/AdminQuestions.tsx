import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface Question {
  id: string;
  textEn: string;
  textHi: string;
  subject: string;
  topic: string | null;
  difficulty: string;
  isActive: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const SUBJECTS = ['gk', 'math', 'reasoning', 'hindi'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const PAGE_LIMIT = 20;

// ─── Skeleton Loader ──────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="pb-3 pr-4"><div className="h-4 w-10 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-48 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
              <th className="pb-3"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-64 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
                <td className="py-3"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────

interface DeleteModalProps {
  questionText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteModal({ questionText, onConfirm, onCancel, isDeleting }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Question</h3>
        <p className="text-sm text-gray-600 mb-1">
          Are you sure you want to delete this question? This action can be undone.
        </p>
        <p className="text-sm text-gray-500 italic mb-6 truncate">
          &ldquo;{questionText}&rdquo;
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminQuestions() {
  const navigate = useNavigate();

  // State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('active');
  const [currentPage, setCurrentPage] = useState(1);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ─── Fetch Questions ──────────────────────────────────────────────

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(PAGE_LIMIT));

      if (subjectFilter) params.set('subject', subjectFilter);
      if (difficultyFilter) params.set('difficulty', difficultyFilter);

      const response = await api.get(`/api/questions?${params.toString()}`);
      const data = response.data.data;

      let filteredQuestions: Question[] = data.questions;

      // Client-side filters: search text and status
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        filteredQuestions = filteredQuestions.filter((q: Question) =>
          q.textEn.toLowerCase().includes(term)
        );
      }

      if (statusFilter === 'active') {
        filteredQuestions = filteredQuestions.filter((q: Question) => q.isActive);
      } else if (statusFilter === 'deleted') {
        filteredQuestions = filteredQuestions.filter((q: Question) => !q.isActive);
      }

      setQuestions(filteredQuestions);
      setPagination(data.pagination);
    } catch {
      setError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, subjectFilter, difficultyFilter, search, statusFilter]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [subjectFilter, difficultyFilter, statusFilter, search]);

  // ─── Delete Handler ───────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.delete(`/api/questions/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchQuestions();
    } catch {
      setDeleteError('Failed to delete question. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Difficulty Badge ─────────────────────────────────────────────

  function getDifficultyBadge(difficulty: string) {
    const styles: Record<string, string> = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      hard: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles[difficulty] || 'bg-gray-100 text-gray-700'}`}>
        {difficulty}
      </span>
    );
  }

  function getStatusBadge(isActive: boolean) {
    return isActive ? (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Active</span>
    ) : (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Deleted</span>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────

  if (error && !loading && questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={fetchQuestions}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Questions</h1>
        <button
          onClick={() => navigate('/admin/questions/new')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <span>+</span>
          <span>Create Question</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search question text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Subject filter */}
          <div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Subjects</option>
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Difficulty filter */}
          <div>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'deleted')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {loading ? (
          <TableSkeleton />
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-3xl mb-3">📭</span>
            <p className="text-sm text-gray-500">No questions found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-3 pr-4 font-medium">ID</th>
                    <th className="pb-3 pr-4 font-medium">Question</th>
                    <th className="pb-3 pr-4 font-medium">Subject</th>
                    <th className="pb-3 pr-4 font-medium">Difficulty</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {questions.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 text-gray-500 font-mono text-xs">
                        {q.id.substring(0, 8)}...
                      </td>
                      <td className="py-3 pr-4 text-gray-900 max-w-xs">
                        <span className="block truncate" title={q.textEn}>
                          {q.textEn.length > 80 ? q.textEn.substring(0, 80) + '...' : q.textEn}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-700 capitalize">{q.subject}</td>
                      <td className="py-3 pr-4">{getDifficultyBadge(q.difficulty)}</td>
                      <td className="py-3 pr-4">{getStatusBadge(q.isActive)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate(`/admin/questions/${q.id}/edit`)}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            Edit
                          </button>
                          {q.isActive && (
                            <button
                              onClick={() => setDeleteTarget(q)}
                              className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage >= pagination.totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          questionText={deleteTarget.textEn}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
          isDeleting={isDeleting}
        />
      )}

      {/* Delete error toast */}
      {deleteError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm z-50">
          {deleteError}
          <button onClick={() => setDeleteError(null)} className="ml-3 font-bold">✕</button>
        </div>
      )}
    </div>
  );
}
