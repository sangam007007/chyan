import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { BillingStatus } from './Paywall';
import { trialNotice } from './trial';

const store = {
  get: (k: string, session = false) => { try { return (session ? sessionStorage : localStorage).getItem(k); } catch { return null; } },
  set: (k: string, v: string, session = false) => { try { (session ? sessionStorage : localStorage).setItem(k, v); } catch { /* private mode */ } },
};
const todayKey = () => new Date().toDateString();

/** Re-renders every `ms`, returning the current time corrected by the server offset */
function useNow(offsetMs: number, ms: number): number {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    setNow(Date.now() + offsetMs);
    const t = window.setInterval(() => setNow(Date.now() + offsetMs), ms);
    return () => window.clearInterval(t);
  }, [offsetMs, ms]);
  return now;
}

/**
 * The free-trial countdown, handled differently per screen:
 * - Phone / app: a bottom-sheet popup (once a day; on the last day once every time the app is opened),
 *   plus a thin strip on the last day. Never shown during a timed test.
 * - Desktop / tablet: a banner at the top of the page every day (can be dismissed for the day, except
 *   on the last day).
 */
export function TrialNotice({ status, offsetMs, onBuy }: { status: BillingStatus; offsetMs: number; onBuy: () => void }) {
  const { language } = useTranslation();
  const isHi = language === 'hi';
  const wide = useMediaQuery('(min-width: 768px)');
  const { pathname } = useLocation();
  const now = useNow(offsetMs, 30_000);
  const n = trialNotice(status, now, isHi);
  const inTest = /^\/tests\/[^/]+\/attempt/.test(pathname) || pathname.startsWith('/daily-challenge');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(() => store.get('chayan.trial.banner') === todayKey());

  // Phone: decide once per app open whether to pop the sheet up
  useEffect(() => {
    if (wide || inTest) return;
    const last = n.level === 'last';
    const seen = last ? store.get('chayan.trial.sheet.session', true) === '1' : store.get('chayan.trial.sheet') === todayKey();
    if (!seen) setSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide, inTest, n.level]);

  const closeSheet = () => {
    setSheetOpen(false);
    if (n.level === 'last') store.set('chayan.trial.sheet.session', '1', true);
    else store.set('chayan.trial.sheet', todayKey());
  };

  if (inTest) return null;

  // ── Desktop / tablet: top banner
  if (wide) {
    if (n.level !== 'last' && bannerHidden) return null;
    const urgent = n.level === 'last';
    return (
      <div role="status" className={`flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-semibold ${urgent ? 'bg-accent-50 text-accent-700 border-b border-accent-100' : 'bg-secondary-100 text-secondary-800'}`}>
        <span className="min-w-0 truncate"><span className="font-extrabold">{n.title}</span><span className="hidden lg:inline font-medium"> · {n.body}</span></span>
        <button type="button" onClick={onBuy} className="shrink-0 rounded-xl bg-primary text-white text-xs font-bold px-3.5 py-1.5 active:scale-95 transition-transform">{n.cta}</button>
        {!urgent && (
          <button type="button" aria-label={isHi ? 'आज के लिए बंद करें' : 'Hide for today'} onClick={() => { store.set('chayan.trial.banner', todayKey()); setBannerHidden(true); }} className="shrink-0 text-lg leading-none opacity-60 hover:opacity-100">×</button>
        )}
      </div>
    );
  }

  // ── Phone / app: thin strip on the last day + bottom-sheet popup
  return (
    <>
      {n.level === 'last' && (
        <button type="button" onClick={onBuy} className="w-full bg-accent text-white text-center text-xs font-bold px-3 py-2 active:opacity-90">
          🔥 {n.short}
        </button>
      )}
      {sheetOpen && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/50" onClick={closeSheet} role="dialog" aria-modal="true" aria-label={n.title}>
          <div className="w-full rounded-t-3xl bg-white px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.4)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" />
            <p className="text-lg font-extrabold text-primary leading-snug">{n.title}</p>
            <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{n.body}</p>
            {n.level === 'last' && (
              <p className="mt-3 rounded-2xl bg-accent-50 border border-accent-100 px-3 py-2 text-center text-sm font-extrabold text-accent-700 tabular-nums">⏱ {n.short}</p>
            )}
            <button type="button" onClick={() => { closeSheet(); onBuy(); }} className="mt-4 w-full rounded-2xl bg-secondary text-primary-800 font-extrabold text-base py-3.5 shadow-[0_14px_30px_-10px_rgba(197,160,40,0.9)] active:scale-95 transition-transform">{n.cta}</button>
            <button type="button" onClick={closeSheet} className="mt-2 w-full py-2.5 text-sm font-semibold text-gray-500">{isHi ? 'बाद में' : 'Later'}</button>
          </div>
        </div>
      )}
    </>
  );
}
