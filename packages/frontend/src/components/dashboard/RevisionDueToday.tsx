import { useNavigate } from 'react-router-dom';
import { useRevisionDue } from '@/hooks/useRevisionDue';

interface RevisionDueTodayProps {
  language: 'hi' | 'en';
}

/**
 * RevisionDueToday — List of revision items due today.
 */
export function RevisionDueToday({ language }: RevisionDueTodayProps) {
  const { data, isLoading } = useRevisionDue();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">
            {language === 'hi' ? 'आज का रिवीजन' : 'Revision Due Today'}
          </h3>
        </div>
        <p className="text-xs text-gray-500">
          {language === 'hi' ? 'कोई रिवीजन बाकी नहीं' : 'No revisions due'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">
          {language === 'hi' ? 'आज का रिवीजन' : 'Revision Due Today'}
        </h3>
      </div>

      {/* List */}
      <div className="space-y-2 mb-3">
        {data.map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <span className="text-xs text-gray-700 truncate max-w-[70%]">
              {item.questionText}
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-100 text-indigo-700">
              {item.subject}
            </span>
          </div>
        ))}
      </div>

      {/* View All */}
      <button
        onClick={() => navigate('/progress')}
        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
      >
        {language === 'hi' ? 'सभी देखें' : 'View All'}
      </button>
    </div>
  );
}
