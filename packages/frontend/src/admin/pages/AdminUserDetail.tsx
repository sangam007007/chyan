import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface UserDetail {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  role: string;
  preferred_language: string;
  selected_exam_id: string | null;
  onboarding_completed: boolean;
  created_at: string;
  trial_ends_at: string;
  paid_until: string | null;
  stats: {
    attemptCount: number;
    coinBalance: number;
    lastActive: string | null;
  };
}

const ROLES = ['student', 'admin', 'super_admin'] as const;

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

// ─── Plan access (trial / paid) ─────────────────────────

function PlanAccess({ user, onGranted }: { user: UserDetail; onGranted: (paidUntil: string) => void }) {
  const [months, setMonths] = useState(3);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const now = Date.now();
  const paid = user.paid_until && new Date(user.paid_until).getTime() > now;
  const inTrial = new Date(user.trial_ends_at).getTime() > now;
  const status = user.role !== 'student' ? 'Team member (never blocked)' : paid ? `Paid until ${day(user.paid_until!)}` : inTrial ? `Free trial until ${day(user.trial_ends_at)}` : 'Expired (app is locked for this student)';

  const grant = async () => {
    if (!window.confirm(`Give ${months} month${months === 1 ? '' : 's'} of paid access to ${user.full_name || user.phone}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/api/billing/admin/grant', { phone: user.phone, months, note: note.trim() || undefined });
      onGranted(res.data.data.paidUntil);
      setMsg({ ok: true, text: `Done. Paid access until ${day(res.data.data.paidUntil)}.` });
      setNote('');
    } catch {
      setMsg({ ok: false, text: 'Could not grant access.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Plan access</h2>
      <p className="text-sm text-gray-600 mb-4">Status: <span className="font-medium">{status}</span></p>
      {user.role === 'student' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} month{m === 1 ? '' : 's'}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (e.g. UPI ref no.)" className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={grant} disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
            {busy ? 'Saving…' : 'Give access'}
          </button>
        </div>
      )}
      {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-48 bg-gray-200 rounded" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-48 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Confirmation Modal ───────────────────────────────────────────────

interface ConfirmModalProps {
  currentRole: string;
  newRole: string;
  userName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}

function ConfirmModal({ currentRole, newRole, userName, onConfirm, onCancel, isUpdating }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Role Change</h3>
        <p className="text-sm text-gray-600 mb-4">
          Change <strong>{userName}</strong>&apos;s role from{' '}
          <span className="font-medium">{currentRole}</span> to{' '}
          <span className="font-medium">{newRole}</span>?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isUpdating}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isUpdating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role change state
  const [selectedRole, setSelectedRole] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/admin/users/${id}`);
      const data = response.data.data;
      setUserDetail(data);
      setSelectedRole(data.role);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setError('User not found.');
      } else if (status === 403) {
        setError('Access denied. Super Admin role required.');
      } else {
        setError('Failed to load user details. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchUser();
  }, [id]);

  const handleRoleChange = () => {
    if (selectedRole !== userDetail?.role) {
      setShowConfirm(true);
    }
  };

  const confirmRoleChange = async () => {
    if (!userDetail || !id) return;
    setIsUpdating(true);
    setUpdateError(null);

    try {
      await api.patch(`/api/admin/users/${id}/role`, { role: selectedRole });
      setUserDetail({ ...userDetail, role: selectedRole });
      setShowConfirm(false);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setUpdateError(message || 'Failed to update role. Please try again.');
      setShowConfirm(false);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/admin/users')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Back to Users
          </button>
          <button
            onClick={fetchUser}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!userDetail) return null;

  return (
    <div className="space-y-4">
      {/* Back button + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/users')}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-gray-900">User Detail</h1>
      </div>

      {/* User Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow label="Name" value={userDetail.full_name || '—'} />
          <InfoRow label="Phone" value={userDetail.phone} />
          <InfoRow label="Email" value={userDetail.email || '—'} />
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium text-gray-500 w-32">Role</span>
            {getRoleBadge(userDetail.role)}
          </div>
          <InfoRow label="Language" value={userDetail.preferred_language === 'hi' ? 'Hindi' : 'English'} />
          <InfoRow label="Exam ID" value={userDetail.selected_exam_id || '—'} />
          <InfoRow label="Onboarding" value={userDetail.onboarding_completed ? 'Completed' : 'Pending'} />
          <InfoRow label="Created" value={new Date(userDetail.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatBox label="Test Attempts" value={String(userDetail.stats.attemptCount)} />
          <StatBox label="Coin Balance" value={String(userDetail.stats.coinBalance)} />
          <StatBox label="Last Active" value={userDetail.stats.lastActive ? new Date(userDetail.stats.lastActive).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'} />
        </div>
      </div>

      {/* Plan access */}
      <PlanAccess user={userDetail} onGranted={(paidUntil) => setUserDetail({ ...userDetail, paid_until: paidUntil })} />

      {/* Role Change */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Change Role</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === 'super_admin' ? 'Super Admin' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          <button
            onClick={handleRoleChange}
            disabled={selectedRole === userDetail.role}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Update Role
          </button>
        </div>
        {updateError && (
          <p className="text-red-600 text-sm mt-2">{updateError}</p>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmModal
          currentRole={userDetail.role}
          newRole={selectedRole}
          userName={userDetail.full_name || 'this user'}
          onConfirm={confirmRoleChange}
          onCancel={() => setShowConfirm(false)}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
}

// ─── Helper Components ────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-sm font-medium text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}
