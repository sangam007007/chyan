import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND } from '@/brand';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Layout for authentication screens (login, OTP verification, etc.)
 * Navy + gold brand header, the form on a white card, and a few reasons to join underneath.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  const { language } = useTranslation();
  const hi = language === 'hi';

  const perks = [
    { i: '🧭', t: hi ? 'गाइडेड डेली प्लान' : 'Guided daily plan' },
    { i: '📝', t: hi ? 'मॉक, PYQ और टॉपिक टेस्ट' : 'Mocks, PYQ & topic tests' },
    { i: '📊', t: hi ? 'रैंक और प्रोग्रेस ट्रैकर' : 'Rank & progress tracker' },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-primary-800 via-primary to-primary-400 flex flex-col items-center px-4 pt-8 pb-8">
      <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-secondary/25 blur-3xl" />
      <div className="absolute -bottom-28 -left-20 w-72 h-72 rounded-full bg-primary-300/30 blur-3xl" />

      {/* Branding header */}
      <Link to="/" className="relative mb-6 flex flex-col items-center text-center">
        <BrandMark className="w-14 h-14 drop-shadow-[0_8px_18px_rgba(197,160,40,0.55)]" />
        <h1 className="mt-3 text-2xl font-extrabold text-white font-[Poppins]">{BRAND.name} <span className="text-secondary-200">{BRAND.nameHi}</span></h1>
        <p className="text-sm font-semibold text-secondary-200 mt-1">{hi ? BRAND.slogans[0].hi : BRAND.slogans[0].en}</p>
      </Link>

      {/* Auth card */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] p-6 sm:p-8">
        {children}
      </div>

      {/* Reasons to join */}
      <div className="relative mt-6 w-full max-w-md grid grid-cols-3 gap-2">
        {perks.map((p) => (
          <div key={p.t} className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur px-2 py-3 text-center">
            <div className="text-lg">{p.i}</div>
            <p className="mt-1 text-[10px] font-semibold text-white/85 leading-tight">{p.t}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="relative mt-6 flex flex-col items-center gap-1">
        <Link to="/" className="text-xs font-semibold text-secondary-200">← {hi ? 'होम पर वापस' : 'Back to home'}</Link>
        <p className="text-[11px] text-white/50">© {new Date().getFullYear()} {BRAND.name}</p>
      </div>
    </div>
  );
}
