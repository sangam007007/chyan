import { Link } from 'react-router-dom';

interface MotivationalBannersProps {
  language: 'hi' | 'en';
}

export function MotivationalBanners({ language }: MotivationalBannersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl bg-gradient-to-r from-slate-700 to-slate-900 p-6 text-white relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">UP Police 2025</span>
          <h3 className="text-lg font-bold mt-1 mb-2">
            {language === 'hi' ? 'UP Police Constable भर्ती' : 'UP Police Constable Recruitment'}
          </h3>
          <p className="text-sm text-slate-300 mb-3">
            {language === 'hi'
              ? '60,244 पदों के लिए तैयारी करें। सम्पूर्ण सिलेबस कवर।'
              : 'Prepare for 60,244 vacancies. Complete syllabus covered.'}
          </p>
          <Link to="/tests" className="inline-flex items-center text-sm font-semibold text-amber-300 hover:text-amber-200">
            {language === 'hi' ? 'अभी शुरू करें →' : 'Start Now →'}
          </Link>
        </div>
        <div className="absolute right-4 top-4 text-5xl opacity-20">🚔</div>
      </div>
      <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-6 relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
            {language === 'hi' ? '💡 स्टडी टिप' : '💡 Study Tip'}
          </span>
          <h3 className="text-lg font-bold text-gray-800 mt-1 mb-2">
            {language === 'hi' ? 'रोज़ाना 5 टेस्ट दें' : 'Attempt 5 Tests Daily'}
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {language === 'hi'
              ? 'नियमित अभ्यास से आपकी accuracy और speed दोनों बढ़ेगी।'
              : 'Regular practice improves both accuracy and speed.'}
          </p>
          <Link to="/tests?category=daily_practice" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-500">
            {language === 'hi' ? 'दैनिक अभ्यास शुरू करें →' : 'Start Daily Practice →'}
          </Link>
        </div>
        <div className="absolute right-4 top-4 text-5xl opacity-20">📖</div>
      </div>
    </div>
  );
}
