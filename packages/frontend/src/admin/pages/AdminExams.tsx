import { useEffect, useState } from 'react';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface Exam {
  id: string;
  name: string;
  name_hi?: string;
  category?: string;
  is_active?: boolean;
  display_order?: number;
  exam_date?: string | null;
}

// ─── Skeleton Loader ──────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200">
              <th className="pb-3 pr-4"><div className="h-4 w-36 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-36 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-20 bg-gray-200 rounded" /></th>
              <th className="pb-3 pr-4"><div className="h-4 w-14 bg-gray-200 rounded" /></th>
              <th className="pb-3"><div className="h-4 w-14 bg-gray-200 rounded" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-3 pr-4"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-32 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                <td className="py-3 pr-4"><div className="h-4 w-10 bg-gray-200 rounded" /></td>
                <td className="py-3"><div className="h-4 w-14 bg-gray-200 rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminExams() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState('');

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/onboarding/exams');
      const data = response.data.data;
      // API returns { state: [...], central: [...] } or a flat array
      if (Array.isArray(data)) {
        setExams(data);
      } else if (data.exams) {
        setExams(data.exams);
      } else {
        // Flatten grouped categories
        const flat: Exam[] = [];
        for (const category of Object.values(data)) {
          if (Array.isArray(category)) {
            for (const exam of category) {
              flat.push({
                id: (exam as Record<string, unknown>).id as string,
                name: ((exam as Record<string, unknown>).name_en || (exam as Record<string, unknown>).name || '') as string,
                name_hi: ((exam as Record<string, unknown>).name_hi || '') as string,
                category: ((exam as Record<string, unknown>).category || '') as string,
                is_active: true,
                display_order: (exam as Record<string, unknown>).display_order as number | undefined,
                exam_date: ((exam as Record<string, unknown>).exam_date || null) as string | null,
              });
            }
          }
        }
        setExams(flat);
      }
    } catch {
      setError('Failed to load exams. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const showComingSoon = () => {
    setToast('Coming Soon — API endpoint needed');
    setTimeout(() => setToast(null), 3000);
  };

  const handleEditDate = (exam: Exam) => {
    setEditingDateId(exam.id);
    setEditDateValue(exam.exam_date ? exam.exam_date.slice(0, 10) : '');
  };

  const handleSaveDate = async (examId: string) => {
    try {
      await api.patch(`/api/admin/exams/${examId}/date`, {
        examDate: editDateValue || null,
      });
      setExams((prev) =>
        prev.map((e) => (e.id === examId ? { ...e, exam_date: editDateValue || null } : e))
      );
      setEditingDateId(null);
      setToast('Exam date updated successfully');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to update exam date');
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={fetchExams}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Exams</h1>
        <button
          onClick={showComingSoon}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <span>+</span>
          <span>Create Exam</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        {loading ? (
          <TableSkeleton />
        ) : exams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <span className="text-3xl mb-3">🎓</span>
            <p className="text-sm text-gray-500">No exams found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="pb-3 pr-4 font-medium">Name (EN)</th>
                  <th className="pb-3 pr-4 font-medium">Name (HI)</th>
                  <th className="pb-3 pr-4 font-medium">Category</th>
                  <th className="pb-3 pr-4 font-medium">Exam Date</th>
                  <th className="pb-3 pr-4 font-medium">Active</th>
                  <th className="pb-3 pr-4 font-medium">Order</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 text-gray-900">{exam.name}</td>
                    <td className="py-3 pr-4 text-gray-700">{exam.name_hi || '—'}</td>
                    <td className="py-3 pr-4 text-gray-700 capitalize">{exam.category || '—'}</td>
                    <td className="py-3 pr-4 text-gray-700">
                      {editingDateId === exam.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={editDateValue}
                            onChange={(e) => setEditDateValue(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => handleSaveDate(exam.id)}
                            className="px-2 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingDateId(null)}
                            className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{exam.exam_date ? exam.exam_date.slice(0, 10) : '—'}</span>
                          <button
                            onClick={() => handleEditDate(exam)}
                            className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded hover:bg-purple-100"
                          >
                            Edit Date
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {exam.is_active !== undefined ? (
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${exam.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {exam.is_active ? 'Yes' : 'No'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-500">{exam.display_order ?? '—'}</td>
                    <td className="py-3">
                      <button
                        onClick={showComingSoon}
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
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-yellow-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm z-50">
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 font-bold">✕</button>
        </div>
      )}
    </div>
  );
}
