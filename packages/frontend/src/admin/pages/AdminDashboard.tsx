import { useEffect, useState } from 'react';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface RecentUser {
  id: string;
  full_name: string;
  phone: string;
  created_at: string;
}

interface RecentTest {
  id: string;
  title_en: string;
  status: string;
  created_at: string;
}

interface TopExam {
  exam_id: string;
  exam_name: string;
  user_count: string;
}

interface AdminStats {
  totalUsers: number;
  activeToday: number;
  totalQuestions: number;
  totalTests: number;
  draftTests: number;
  attemptsToday: number;
  recentUsers: RecentUser[];
  recentTests: RecentTest[];
  topExams: TopExam[];
}

// ─── Stat Card Component ──────────────────────────────────────────────

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded" />
              <div className="space-y-2">
                <div className="h-6 w-16 bg-gray-200 rounded" />
                <div className="h-4 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tables skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 bg-gray-200 rounded w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/admin/stats');
      setStats(response.data.data);
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon="👥" label="Total Users" value={stats.totalUsers} />
        <StatCard icon="🟢" label="Active Today" value={stats.activeToday} />
        <StatCard icon="❓" label="Total Questions" value={stats.totalQuestions} />
        <StatCard icon="📝" label="Total Tests" value={stats.totalTests} />
        <StatCard icon="📋" label="Draft Tests" value={stats.draftTests} />
        <StatCard icon="🎯" label="Attempts Today" value={stats.attemptsToday} />
      </div>

      {/* Tables section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Users</h2>
          {stats.recentUsers.length === 0 ? (
            <p className="text-sm text-gray-500">No users yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Phone</th>
                    <th className="pb-2 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="py-2 text-gray-900">{user.full_name || '—'}</td>
                      <td className="py-2 text-gray-600">{user.phone}</td>
                      <td className="py-2 text-gray-500">
                        {new Date(user.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Tests */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Tests</h2>
          {stats.recentTests.length === 0 ? (
            <p className="text-sm text-gray-500">No tests yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.recentTests.map((test) => (
                    <tr key={test.id}>
                      <td className="py-2 text-gray-900 max-w-[180px] truncate">{test.title_en}</td>
                      <td className="py-2">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                            test.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {test.status}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">
                        {new Date(test.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Top Exams */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Top Exams by Users</h2>
        {stats.topExams.length === 0 ? (
          <p className="text-sm text-gray-500">No exam data yet</p>
        ) : (
          <div className="space-y-3">
            {stats.topExams.map((exam) => (
              <div key={exam.exam_id} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{exam.exam_name}</span>
                <span className="text-sm font-medium text-gray-900">
                  {parseInt(exam.user_count, 10).toLocaleString()} users
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
