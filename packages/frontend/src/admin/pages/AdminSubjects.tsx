import { useEffect, useState } from 'react';
import api from '@/services/api';

// ─── Types ────────────────────────────────────────────────────────────

interface Topic {
  id: string;
  name: string;
  name_hi?: string;
  display_order?: number;
}

interface Subject {
  id: string;
  name: string;
  name_hi?: string;
  display_order?: number;
}

interface SubjectWithTopics extends Subject {
  topics: Topic[];
  topicsLoading: boolean;
  topicsError: string | null;
  expanded: boolean;
}

// ─── Skeleton Loader ──────────────────────────────────────────────────

function TreeSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="h-5 w-40 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export function AdminSubjects() {
  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchSubjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/subjects');
      const data = response.data.data;
      const subjectList: Subject[] = Array.isArray(data) ? data : data.subjects || [];
      setSubjects(
        subjectList.map((s) => ({
          ...s,
          topics: [],
          topicsLoading: false,
          topicsError: null,
          expanded: false,
        }))
      );
    } catch {
      setError('Failed to load subjects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const toggleSubject = async (subjectId: string) => {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        if (s.expanded) return { ...s, expanded: false };
        // If already loaded topics, just expand
        if (s.topics.length > 0) return { ...s, expanded: true };
        // Otherwise mark for loading
        return { ...s, expanded: true, topicsLoading: true };
      })
    );

    // Load topics if not already loaded
    const subject = subjects.find((s) => s.id === subjectId);
    if (subject && !subject.expanded && subject.topics.length === 0) {
      try {
        const response = await api.get(`/api/subjects/${subjectId}/topics`);
        const data = response.data.data;
        const topicList: Topic[] = Array.isArray(data) ? data : data.topics || [];
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === subjectId
              ? { ...s, topics: topicList, topicsLoading: false, topicsError: null }
              : s
          )
        );
      } catch {
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === subjectId
              ? { ...s, topicsLoading: false, topicsError: 'Failed to load topics' }
              : s
          )
        );
      }
    }
  };

  const showComingSoon = () => {
    setToast('Coming Soon — API endpoint needed');
    setTimeout(() => setToast(null), 3000);
  };

  if (error && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={fetchSubjects}
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
        <h1 className="text-xl font-bold text-gray-900">Subjects & Topics</h1>
        <button
          onClick={showComingSoon}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
        >
          <span>+</span>
          <span>Create Subject</span>
        </button>
      </div>

      {/* Tree View */}
      <div className="space-y-2">
        {loading ? (
          <TreeSkeleton />
        ) : subjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center">
            <span className="text-3xl mb-3">📚</span>
            <p className="text-sm text-gray-500">No subjects found.</p>
          </div>
        ) : (
          subjects.map((subject) => (
            <div key={subject.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Subject Row */}
              <button
                onClick={() => toggleSubject(subject.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">{subject.expanded ? '▼' : '▶'}</span>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{subject.name}</span>
                    {subject.name_hi && (
                      <span className="text-sm text-gray-500 ml-2">({subject.name_hi})</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {subject.display_order !== undefined && (
                    <span className="text-xs text-gray-400">Order: {subject.display_order}</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); showComingSoon(); }}
                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </button>

              {/* Topics List */}
              {subject.expanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                  {subject.topicsLoading ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
                      <span className="text-sm text-gray-500">Loading topics...</span>
                    </div>
                  ) : subject.topicsError ? (
                    <p className="text-sm text-red-600 py-2">{subject.topicsError}</p>
                  ) : subject.topics.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No topics found for this subject.</p>
                  ) : (
                    <div className="space-y-1">
                      {subject.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300 text-xs">•</span>
                            <span className="text-sm text-gray-700">{topic.name}</span>
                            {topic.name_hi && (
                              <span className="text-xs text-gray-400">({topic.name_hi})</span>
                            )}
                          </div>
                          {topic.display_order !== undefined && (
                            <span className="text-xs text-gray-400">#{topic.display_order}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
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
