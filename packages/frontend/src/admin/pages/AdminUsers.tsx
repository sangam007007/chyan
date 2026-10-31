import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface UserItem {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const ROLES = ['student', 'admin', 'super_admin'];
const PAGE_LIMIT = 20;

// ─── Skeleton Loader ──────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="pb-3 pr-4"><div className="h-4 w-32 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-24 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-36 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
              <th className="pb-3"><div className="h-4 w-16 bg-gray-200 rounded" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-3 pr-4"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                <td className="py-3"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Role Badge ───────────────────────────────────────────────────────

function getRoleBadge(role: string) {
  const styles: Record<string, string> = {
    student: 'bg-gray-100 text-gray-700',
    admin: 'bg-blue-100 text-blue-700',
    super_admin: 'bg-purple-100 text-purple-700',
  };
  const labels: Record<string, string> = {
    student: 'Student',
    admin: 'Admin',
    super_admin: 'Super Admin',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles[role] || 'bg-gray-100 text-gray-700'}`}>
      {labels[role] || role}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminUsers() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = (user as { role?: string } | null)?.role;
  const isSuperAdmin = userRole === 'super_admin';

  // State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Fetch Users ────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', String(PAGE_LIMIT));
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (roleFilter) params.set('role', roleFilter);

      const response = await api.get(`/api/admin/users?${params.toString()}`);
      const data = response.data.data;

      setUsers(data.users);
      setPagination({ page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError('Access denied. Super Admin role required.');
      } else {
        setError('Failed to load users. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, roleFilter, isSuperAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter]);

  // ─── Access Check ───────────────────────────────────────────────────

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="text-4xl mb-4">🔒</span>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Super Admin Access Required</h1>
        <p className="text-sm text-gray-500">Only super admins can manage users.</p>
      </div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────

  if (error && !loading && users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={fetchUsers}
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
      <h1 className="text-xl font-bold text-gray-900">Users</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r === 'super_admin' ? 'Super Admin' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {loading ? (
          <TableSkeleton />
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-3xl mb-3">📭</span>
            <p className="text-sm text-gray-500">No users found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Phone</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Role</th>
                    <th className="pb-3 pr-4 font-medium">Joined</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="py-3 pr-4 text-gray-900">{u.full_name || '—'}</td>
                      <td className="py-3 pr-4 text-gray-600">{u.phone}</td>
                      <td className="py-3 pr-4 text-gray-600">{u.email || '—'}</td>
                      <td className="py-3 pr-4">{getRoleBadge(u.role)}</td>
                      <td className="py-3 pr-4 text-gray-500">
                        {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          View
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
