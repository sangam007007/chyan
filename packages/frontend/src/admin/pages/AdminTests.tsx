import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface Test {
  id: string;
  titleEn: string;
  category: string;
  status: string;
  questionCount: number;
  durationMinutes: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const CATEGORIES = ['full_mock', 'subject_wise', 'previous_year', 'daily_practice'];
const PAGE_LIMIT = 20;

// ─── Skeleton Loader ──────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200">
            <th className="pb-3 pr-4"><div className="h-4 w-40 bg-gray-200 rounded" /></th>
            <th className="pb-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
            <th className="pb-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
            <th className="pb-3 pr-4"><div className="h-4 w-12 bg-gray-200 rounded" /></th>
            <th className="pb-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
            <th className="pb-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
            <th className="pb-3"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-3 pr-4"><div className="h-4 w-48 bg-gray-200 rounded" /></td>
              <td className="py-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
              <td className="py-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
              <td className="py-3 pr-4"><div className="h-4 w-8 bg-gray-200 rounded" /></td>
              <td className="py-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
              <td className="py-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></td>
              <td className="py-3"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminTests() {
  const navigate = useNavigate();

  const [tests, setTests] = useState<Test[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Fetch Tests ──────────────────────────────────────────────────

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(PAGE_LIMIT));
      params.set('sort', 'newest');

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const response = await api.get(`/api/tests?${params.toString()}`);
      const data = response.data.data;

      setTests(data.tests || []);
      setPagination(data.pagination || { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { code?: string } } } };
      if (axiosErr.response?.data?.error?.code === 'NO_EXAM_SELECTED') {
        setError('No exam selected. Please select an exam in your profile settings first.');
      } else {
        setError('Failed to load tests. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter]);

  // ─── Helpers ──────────────────────────────────────────────────────

  function getCategoryBadge(category: string) {
    const styles: Record<string, string> = {
      full_mock: 'bg-purple-100 text-purple-700',
      subject_wise: 'bg-blue-100 text-blue-700',
      previous_year: 'bg-orange-100 text-orange-700',
      daily_practice: 'bg-teal-100 text-teal-700',
    };
    const labels: Record<string, string> = {
      full_mock: 'Full Mock',
      subject_wise: 'Subject',
      previous_year: 'Prev Year',
      daily_practice: 'Daily',
    };
    return (
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles[category] || 'bg-gray-100 text-gray-700'}`}>
        {labels[category] || category}
      </span>
    );
  }

  function getStatusBadge(status: string) {
    if (status === 'published') {
      return <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">Published</span>;
    }
    return <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">Draft</span>;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ─── Error State ──────────────────────────────────────────────────

  if (error && !loading && tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={fetchTests}
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
        <h1 className="text-xl font-bold text-gray-900">Tests</h1>
        <button
          onClick={() => navigate('/admin/tests/new')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <span>+</span>
          <span>Create Test</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'draft' | 'published')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {loading ? (
          <TableSkeleton />
        ) : tests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-3xl mb-3">📝</span>
            <p className="text-sm text-gray-500">No tests found. Create your first test to get started.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-3 pr-4 font-medium">Title</th>
                    <th className="pb-3 pr-4 font-medium">Category</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Questions</th>
                    <th className="pb-3 pr-4 font-medium">Duration</th>
                    <th className="pb-3 pr-4 font-medium">Created</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tests.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 text-gray-900 max-w-xs">
                        <span className="block truncate" title={t.titleEn}>
                          {t.titleEn.length > 50 ? t.titleEn.substring(0, 50) + '...' : t.titleEn}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{getCategoryBadge(t.category)}</td>
                      <td className="py-3 pr-4">{getStatusBadge(t.status)}</td>
                      <td className="py-3 pr-4 text-gray-700">{t.questionCount}</td>
                      <td className="py-3 pr-4 text-gray-700">{t.durationMinutes} min</td>
                      <td className="py-3 pr-4 text-gray-500 text-xs">{formatDate(t.createdAt)}</td>
                      <td className="py-3">
                        <button
                          onClick={() => navigate(`/admin/tests/${t.id}/edit`)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Edit
                        </button>
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
    </div>
  );
}
