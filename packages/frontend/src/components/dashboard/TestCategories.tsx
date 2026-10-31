import { Link } from 'react-router-dom';

interface TestCategoriesProps {
  language: 'hi' | 'en';
}

export function TestCategories({ language }: TestCategoriesProps) {
  const categories = [
    { key: 'full_mock', labelEn: 'Full Mock Test', labelHi: 'पूर्ण मॉक टेस्ट', icon: '📝', color: 'from-blue-500 to-blue-600' },
    { key: 'subject_wise', labelEn: 'Subject-wise Test', labelHi: 'विषयवार टेस्ट', icon: '📚', color: 'from-pink-500 to-red-500' },
    { key: 'previous_year', labelEn: 'Previous Year', labelHi: 'पिछले वर्ष के प्रश्न', icon: '📅', color: 'from-amber-500 to-amber-600' },
    { key: 'daily_practice', labelEn: 'Daily Practice', labelHi: 'दैनिक अभ्यास', icon: '⚡', color: 'from-purple-500 to-purple-600' },
  ];

  return (
    <div>
      <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-1.5">
        <span>📂</span>
        {language === 'hi' ? 'टेस्ट श्रेणियां' : 'Test Categories'}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.key}
            to={`/tests?category=${cat.key}`}
            className={`flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl bg-gradient-to-br ${cat.color} text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all`}
          >
            <span className="text-2xl sm:text-3xl mb-1.5">{cat.icon}</span>
            <span className="text-[11px] sm:text-sm font-semibold text-center leading-tight">
              {language === 'hi' ? cat.labelHi : cat.labelEn}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
