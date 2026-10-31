interface StatsSectionProps {
  language: 'hi' | 'en';
}

function StatCard({ icon, label, value, sublabel }: { icon: string; label: string; value: string; sublabel: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-800">{value}</p>
          <p className="text-[10px] text-gray-400">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}

export function StatsSection({ language }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <StatCard icon="📊" label={language === 'hi' ? 'कुल टेस्ट' : 'Total Tests'} value="80+" sublabel={language === 'hi' ? 'उपलब्ध' : 'Available'} />
      <StatCard icon="📖" label={language === 'hi' ? 'विषय' : 'Subjects'} value="4" sublabel={language === 'hi' ? 'बाल विकास, हिंदी, ई.वी.एस...' : 'CDP, Hindi, EVS...'} />
      <StatCard icon="🎯" label={language === 'hi' ? 'अभ्यास प्रश्न' : 'Practice Questions'} value="500+" sublabel={language === 'hi' ? 'प्रैक्टिस के लिए' : 'For practice'} />
      <StatCard icon="🏆" label={language === 'hi' ? 'नि:शुल्क टेस्ट' : 'Free Tests'} value="25" sublabel={language === 'hi' ? 'औसत स्कोर' : 'Avg Score'} />
    </div>
  );
}
