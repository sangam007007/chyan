import { useNavigate } from 'react-router-dom';
import { useRecommendations } from '@/hooks/useRecommendations';

interface RecommendedForYouProps {
  language: 'hi' | 'en';
}

const GRADIENT_PRESETS = [
  'from-indigo-500 to-blue-500',
  'from-purple-500 to-pink-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-red-500',
  'from-cyan-500 to-sky-500',
];

/**
 * RecommendedForYou — Horizontal scroll cards for recommended practice.
 */
export function RecommendedForYou({ language }: RecommendedForYouProps) {
  const { data, isLoading } = useRecommendations();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[150px] flex-shrink-0 rounded-xl bg-gray-200 p-4 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800">
            {language === 'hi' ? 'आपके लिए अनुशंसित' : 'Recommended For You'}
          </h3>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">
            {language === 'hi'
              ? 'अनुशंसाएं पाने के लिए और टेस्ट दें'
              : 'Complete more tests to get recommendations'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-800">
          {language === 'hi' ? 'आपके लिए अनुशंसित' : 'Recommended For You'}
        </h3>
        <button
          onClick={() => navigate('/tests')}
          className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
        >
          {language === 'hi' ? 'सभी देखें' : 'View All'}
        </button>
      </div>

      {/* Horizontal scroll cards */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {data.map((item, i) => (
          <div
            key={item.testId}
            className={`min-w-[150px] flex-shrink-0 rounded-xl bg-gradient-to-br ${GRADIENT_PRESETS[i % GRADIENT_PRESETS.length]} p-4 text-white shadow-sm`}
          >
            <p className="text-sm font-bold mb-0.5">
              {language === 'hi' ? item.titleHi : item.titleEn}
            </p>
            <p className="text-[10px] text-white/80 mb-3">
              {item.questionCount} {language === 'hi' ? 'प्रश्न' : 'Questions'}
            </p>
            <button
              onClick={() => navigate(`/tests/${item.testId}/attempt`)}
              className="px-3 py-1 text-[10px] font-semibold bg-white/20 backdrop-blur-sm rounded border border-white/30 hover:bg-white/30 transition-colors"
            >
              {language === 'hi' ? 'अभ्यास' : 'Practice'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
