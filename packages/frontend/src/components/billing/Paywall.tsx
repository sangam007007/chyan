import { useState } from 'react';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n';
import { BrandMark } from '@/components/common/BrandMark';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { BRAND } from '@/brand';

export interface BillingStatus {
  status: 'trial' | 'paid' | 'expired';
  staff: boolean;
  trialEndsAt: string;
  paidUntil: string | null;
  daysLeft: number;
  plan: { trialDays: number; priceRupees: number; months: number };
  /** server time when the status was read; lets the countdown ignore a wrong phone clock */
  serverNow?: string;
}

const SUPPORT = import.meta.env.VITE_SUPPORT_CONTACT as string | undefined;

/**
 * Full-screen plan popup.
 * Without `onClose` it is the "your trial / plan has ended" wall: it cannot be closed and stays over the
 * app until the plan is paid (the student can only buy, re-check after paying, or log out).
 * With `onClose` it is the same screen opened on purpose during the trial, with a close button.
 */
export function Paywall({ status, onRecheck, onClose }: { status: BillingStatus | null; onRecheck: () => Promise<void>; onClose?: () => void }) {
  const { language } = useTranslation();
  const { logout } = useAuth();
  const isHi = language === 'hi';
  const L = (en: string, hi: string) => (isHi ? hi : en);
  const plan = status?.plan ?? { trialDays: 3, priceRupees: 99, months: 3 };
  const hadPlan = !!status?.paidUntil;
  const optional = !!onClose;

  const [busy, setBusy] = useState<'buy' | 'check' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const buy = async () => {
    setBusy('buy');
    setNote(null);
    try {
      await api.post('/api/billing/checkout');
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      setNote(
        code === 'PAYMENTS_NOT_ENABLED'
          ? L(`Online payment is not switched on yet. To activate your plan${SUPPORT ? `, contact ${SUPPORT}` : ', please contact us'} and then tap "I have paid".`, `ऑनलाइन पेमेंट अभी शुरू नहीं हुआ है। प्लान चालू करवाने के लिए${SUPPORT ? ` ${SUPPORT} पर` : ''} हमसे संपर्क करें, फिर "भुगतान हो गया" दबाएं।`)
          : L('Something went wrong. Please try again.', 'कुछ गड़बड़ हुई, फिर कोशिश करें।'),
      );
    } finally {
      setBusy(null);
    }
  };

  const recheck = async () => {
    setBusy('check');
    setNote(null);
    try {
      await onRecheck();
      setNote(L('Your plan is not active yet.', 'आपका प्लान अभी चालू नहीं हुआ है।'));
    } finally {
      setBusy(null);
    }
  };

  const perks = [
    L('All tests, every exam', 'सभी टेस्ट, हर परीक्षा'),
    L('Daily study plan, rank and AI analysis', 'डेली प्लान, रैंक और AI एनालिसिस'),
    L('Discussion with other students', 'दूसरे छात्रों से चर्चा'),
    L('Streaks, XP and 60 badges', 'स्ट्रीक, XP और 60 बैज'),
  ];

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="paywall-title" className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-primary-800 via-primary to-primary-400">
      {optional && (
        <button type="button" onClick={onClose} aria-label={L('Close', 'बंद करें')} className="fixed top-4 left-4 z-10 w-10 h-10 rounded-full bg-white/15 border border-white/20 text-white text-xl leading-none backdrop-blur active:scale-95">×</button>
      )}
      <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-secondary/25 blur-3xl pointer-events-none" />
      <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-8">
        <div className="absolute top-4 right-4"><LanguageToggle /></div>
        <BrandMark className="w-14 h-14 drop-shadow-[0_8px_18px_rgba(197,160,40,0.55)]" />
        <p className="mt-2 text-white font-extrabold text-xl font-[Poppins]">{BRAND.name} <span className="text-secondary-200">{BRAND.nameHi}</span></p>

        <div className="mt-6 w-full max-w-md rounded-3xl bg-white p-6 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] text-center">
          <p className="text-4xl">{optional ? '🚀' : hadPlan ? '⏰' : '🎁'}</p>
          <h1 id="paywall-title" className="mt-2 text-xl font-extrabold text-primary">
            {optional
              ? L('Get your plan before the trial ends', 'ट्रायल खत्म होने से पहले प्लान ले लें')
              : hadPlan ? L('Your plan has ended', 'आपका प्लान खत्म हो गया') : L(`Your ${plan.trialDays}-day free trial has ended`, `आपका ${plan.trialDays} दिन का फ्री ट्रायल खत्म हो गया`)}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {optional
              ? L('Keep learning without a break. Your progress carries over.', 'बिना रुके पढ़ाई जारी रखें। आपकी प्रोग्रेस साथ रहेगी।')
              : L('Buy a plan to continue learning. Your progress is saved and will be waiting for you.', 'पढ़ाई जारी रखने के लिए प्लान खरीदें। आपकी प्रोग्रेस सुरक्षित है, वहीं मिलेगी।')}
          </p>

          <div className="mt-5 rounded-2xl bg-gradient-to-br from-primary-800 to-primary text-white p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-200">{L('Premium access', 'प्रीमियम एक्सेस')}</p>
            <p className="mt-1 flex items-end justify-center gap-2">
              <span className="text-5xl font-black font-[Poppins] tabular-nums">₹{plan.priceRupees}</span>
              <span className="pb-1 text-sm text-white/70">/ {L(`${plan.months} months`, `${plan.months} महीने`)}</span>
            </p>
            <ul className="mt-4 space-y-1.5 text-left text-sm text-white/90">
              {perks.map((x) => <li key={x} className="flex gap-2"><span className="text-secondary-200 font-bold">✓</span>{x}</li>)}
            </ul>
          </div>

          <button type="button" onClick={buy} disabled={busy !== null} className="mt-5 w-full rounded-2xl bg-secondary text-primary-800 font-extrabold text-base py-3.5 shadow-[0_14px_30px_-10px_rgba(197,160,40,0.9)] active:scale-95 transition-transform disabled:opacity-60">
            {busy === 'buy' ? '…' : L(`Continue for ₹${plan.priceRupees}`, `₹${plan.priceRupees} में जारी रखें`)}
          </button>
          {note && <p role="status" className="mt-3 rounded-xl bg-secondary-50 border border-secondary-100 px-3 py-2 text-xs text-secondary-700 leading-snug">{note}</p>}

          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <button type="button" onClick={recheck} disabled={busy !== null} className="font-semibold text-primary-400 disabled:opacity-60">
              {busy === 'check' ? '…' : L('I have paid, check again', 'भुगतान हो गया, फिर जांचें')}
            </button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={() => void logout()} className="font-semibold text-gray-500">{L('Log out', 'लॉगआउट')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
