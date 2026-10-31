import { useNavigate } from 'react-router-dom';

interface QuickLinksProps {
  language: 'hi' | 'en';
}

interface QuickLinkItem {
  icon: string;
  labelEn: string;
  labelHi: string;
  ctaEn: string;
  ctaHi: string;
  route: string | null; // null means "Coming Soon"
}

const MOCK_LINKS: QuickLinkItem[] = [
  { icon: '🎓', labelEn: 'Live Classes', labelHi: 'लाइव क्लास', ctaEn: 'Join Now >', ctaHi: 'जुड़ें >', route: null },
  { icon: '📝', labelEn: 'Test Series', labelHi: 'टेस्ट सीरीज', ctaEn: 'Start Test >', ctaHi: 'टेस्ट दें >', route: '/tests' },
  { icon: '📄', labelEn: 'PDF Notes', labelHi: 'PDF नोट्स', ctaEn: 'Download >', ctaHi: 'डाउनलोड >', route: null },
  { icon: '📅', labelEn: 'Previous Papers', labelHi: 'पिछले पेपर', ctaEn: 'Practice >', ctaHi: 'अभ्यास >', route: '/tests?tab=previous_year' },
];

/**
 * QuickLinks — 4 horizontal quick action cards.
 */
export function QuickLinks({ language }: QuickLinksProps) {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {MOCK_LINKS.map((link, i) => {
        const soon = link.route === null;
        return (
          <button
            key={i}
            type="button"
            disabled={soon}
            aria-disabled={soon}
            title={soon ? (language === 'hi' ? 'जल्द आ रहा है' : 'Coming Soon') : undefined}
            onClick={link.route ? () => navigate(link.route!) : undefined}
            className={`p-card relative overflow-hidden p-3.5 text-left flex items-center gap-3 ${
              soon ? 'opacity-60 cursor-not-allowed pointer-events-none select-none' : 'active:scale-95 transition-transform'
            }`}
          >
            <span className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-xl ${
              soon ? 'bg-primary-50' : 'bg-gradient-to-br from-secondary-100 to-secondary-300 shadow-[0_8px_18px_-8px_rgba(197,160,40,0.9)]'
            }`}>{link.icon}</span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-primary leading-tight">
                {language === 'hi' ? link.labelHi : link.labelEn}
              </span>
              <span className={`block text-[10px] font-semibold mt-0.5 ${soon ? 'text-gray-400' : 'text-secondary-600'}`}>
                {soon ? (language === 'hi' ? 'जल्द आ रहा है' : 'Coming Soon') : language === 'hi' ? link.ctaHi : link.ctaEn}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
