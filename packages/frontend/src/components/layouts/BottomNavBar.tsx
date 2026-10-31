import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { BrandMark } from '@/components/common/BrandMark';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { BRAND } from '@/brand';

/**
 * BottomNavBar — Fixed bottom navigation for mobile.
 * 5 tabs: Home, Study Plan, Test, Progress, Profile.
 */
const tabs = [
  { path: '/dashboard', labelHi: 'डैशबोर्ड', labelEn: 'Dashboard', icon: HomeIcon },
  { path: '/study-plan', labelHi: 'अध्ययन', labelEn: 'Study', icon: StudyIcon },
  { path: '/tests', labelHi: 'टेस्ट', labelEn: 'Test', icon: TestIcon },
  { path: '/progress', labelHi: 'प्रदर्शन', labelEn: 'Performance', icon: ProgressIcon },
  { path: '/profile', labelHi: 'प्रोफ़ाइल', labelEn: 'Profile', icon: ProfileIcon },
];

/**
 * DesktopNavBar — top navigation for md+ screens (the bottom bar is mobile only).
 * Same 5 tabs, hidden during a timed test like the bottom bar.
 */
export function DesktopNavBar() {
  const location = useLocation();
  const { language } = useTranslation();
  if (/^\/tests\/[^/]+\/attempt/.test(location.pathname)) return null;
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <header className="hidden md:block sticky top-0 z-50 bg-white/85 backdrop-blur-xl border-b border-primary-50 shadow-[0_8px_30px_-18px_rgba(27,58,92,0.45)]">
      <div className="max-w-[1760px] mx-auto px-6 lg:px-8 xl:px-12 h-16 flex items-center justify-between gap-6">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <BrandMark className="w-8 h-8" />
          <span className="text-lg font-extrabold text-primary font-[Poppins]">{BRAND.name} <span className="text-secondary-600 text-sm font-bold">{BRAND.nameHi}</span></span>
        </Link>
        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = isActive(tab.path);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                title={language === 'hi' ? tab.labelHi : tab.labelEn}
                aria-label={language === 'hi' ? tab.labelHi : tab.labelEn}
                className={`flex items-center gap-2 rounded-2xl px-3 lg:px-4 py-2 text-sm transition-all ${
                  active ? 'bg-secondary text-primary-800 font-bold shadow-md' : 'text-gray-500 font-medium hover:bg-primary-50 hover:text-primary'
                }`}
              >
                <Icon active={active} />
                <span className="hidden lg:inline">{language === 'hi' ? tab.labelHi : tab.labelEn}</span>
              </Link>
            );
          })}
        </nav>
        <LanguageToggle />
      </div>
    </header>
  );
}

export function BottomNavBar() {
  const location = useLocation();
  const { language } = useTranslation();

  // Hide the nav during a timed test so it can't cover Submit or be tapped by accident.
  if (/^\/tests\/[^/]+\/attempt/.test(location.pathname)) return null;

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="fixed bottom-3 left-3 right-3 z-50 md:hidden rounded-[28px] bg-white/90 backdrop-blur-xl border border-primary-50 shadow-[0_16px_40px_-12px_rgba(27,58,92,0.45)]">
      <div className="flex items-center justify-around h-16 px-1.5">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          const label = language === 'hi' ? tab.labelHi : tab.labelEn;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex-1 flex items-center justify-center h-full"
              aria-label={label}
            >
              <span
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 py-1.5 transition-all ${
                  active ? 'bg-secondary text-primary-800 shadow-md scale-105' : 'text-gray-400'
                }`}
              >
                <Icon active={active} />
                <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// --- Icons ---

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function StudyIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

function TestIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={active ? 0 : 2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}
