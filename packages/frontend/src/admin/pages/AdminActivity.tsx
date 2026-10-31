import { useEffect, useState, useCallback } from 'react';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;

// ─── Skeleton Loader ──────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="pb-3 pr-4"><div className="h-4 w-28 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
              <th className="pb-3"><div className="h-4 w-28 bg-gray-200 rounded" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-3 pr-4"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                <td className="py-3"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Action Badge ─────────────────────────────────────────────────────

function getActionBadge(action: string) {
  const styles: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    publish: 'bg-purple-100 text-purple-700',
    role_change: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles[action] || 'bg-gray-100 text-gray-700'}`}>
      {action.replace('_', ' ')}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(PAGE_LIMIT));

      const response = await api.get(`/api/admin/activity?${params.toString()}`);
      const data = response.data.data;

      setActivities(data.activities);
      setPagination({ page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages });
    } catch {
      setError('Failed to load activity log. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // ─── Error State ──────────────────────────────────────────────────

  if (error && !loading && activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={fetchActivities}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {loading ? (
          <TableSkeleton />
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-3xl mb-3">📋</span>
            <p className="text-sm text-gray-500">No activity recorded yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-3 pr-4 font-medium">Admin</th>
                    <th className="pb-3 pr-4 font-medium">Action</th>
                    <th className="pb-3 pr-4 font-medium">Entity Type</th>
                    <th className="pb-3 pr-4 font-medium">Entity ID</th>
                    <th className="pb-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {activities.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 text-gray-900">{a.admin_name || '—'}</td>
                      <td className="py-3 pr-4">{getActionBadge(a.action)}</td>
                      <td className="py-3 pr-4 text-gray-700 capitalize">{a.entity_type}</td>
                      <td className="py-3 pr-4 text-gray-500 font-mono text-xs" title={a.entity_id}>
                        {a.entity_id ? a.entity_id.substring(0, 8) + '...' : '—'}
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(a.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
