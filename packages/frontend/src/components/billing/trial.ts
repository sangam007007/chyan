import type { BillingStatus } from './Paywall';

/**
 * Words for the free-trial countdown: 3 days left → 2 days left → last day (with the exact time it ends).
 * The same text is used by the phone popup and the desktop banner.
 */
export type TrialLevel = 'three' | 'two' | 'last';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export function trialLevel(remainingMs: number): TrialLevel {
  return remainingMs > 2 * DAY ? 'three' : remainingMs > DAY ? 'two' : 'last';
}

const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** "आज रात 10:42 बजे" / "tomorrow at 10:42 PM" / "3 Nov, 10:42 AM" */
export function endLabel(endMs: number, nowMs: number, isHi: boolean): string {
  const end = new Date(endMs);
  const days = Math.round((startOfDay(endMs) - startOfDay(nowMs)) / DAY);
  const h24 = end.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(end.getMinutes()).padStart(2, '0');
  if (isHi) {
    const part = h24 < 12 ? 'सुबह' : h24 < 16 ? 'दोपहर' : h24 < 20 ? 'शाम' : 'रात';
    const day = days <= 0 ? 'आज' : days === 1 ? 'कल' : end.toLocaleDateString('hi-IN', { day: 'numeric', month: 'long' }) + ',';
    return `${day} ${part} ${h12}:${mm} बजे`;
  }
  const day = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ',';
  return `${day} at ${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "5 घंटे 12 मिनट" / "2h 5m" */
export function remainingLabel(ms: number, isHi: boolean): string {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (isHi) {
    if (d > 0) return `${d} दिन ${h} घंटे`;
    if (h > 0) return `${h} घंटे ${m} मिनट`;
    return `${m} मिनट`;
  }
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export interface TrialNotice {
  level: TrialLevel;
  title: string;
  body: string;
  /** short line for the thin strip / countdown, e.g. "5 घंटे 12 मिनट बाकी" */
  short: string;
  cta: string;
}

export function trialNotice(status: BillingStatus, nowMs: number, isHi: boolean): TrialNotice {
  const endMs = new Date(status.trialEndsAt).getTime();
  const remaining = Math.max(0, endMs - nowMs);
  const level = trialLevel(remaining);
  const ends = endLabel(endMs, nowMs, isHi);
  const price = `₹${status.plan.priceRupees}`;
  const months = status.plan.months;
  const left = remainingLabel(remaining, isHi);
  const cta = isHi ? `${price} में जारी रखें` : `Continue for ${price}`;

  if (level === 'three') {
    return {
      level, cta,
      title: isHi ? '🎁 आपका फ्री ट्रायल चालू है · 3 दिन बाकी' : '🎁 Your free trial is on · 3 days left',
      body: isHi ? `सब कुछ फ्री है। ट्रायल ${ends} खत्म होगा, फिर ${price} में ${months} महीने।` : `Everything is free. The trial ends ${ends}, then ${price} for ${months} months.`,
      short: isHi ? `3 दिन बाकी · ${ends} तक` : `3 days left · until ${ends}`,
    };
  }
  if (level === 'two') {
    return {
      level, cta,
      title: isHi ? '⏳ सिर्फ़ 2 दिन बाकी हैं' : '⏳ Only 2 days left',
      body: isHi ? `ट्रायल ${ends} खत्म होगा। पढ़ाई न रुके, इसलिए पहले से प्लान ले लें।` : `The trial ends ${ends}. Get your plan now so your preparation does not stop.`,
      short: isHi ? `2 दिन बाकी · ${ends} तक` : `2 days left · until ${ends}`,
    };
  }
  const isToday = Math.round((startOfDay(endMs) - startOfDay(nowMs)) / DAY) <= 0;
  return {
    level, cta,
    title: isHi ? (isToday ? '🔥 आज आख़िरी दिन है!' : '🔥 आख़िरी दिन है!') : (isToday ? '🔥 Last day today!' : '🔥 Last day!'),
    body: isHi ? `आपका फ्री ट्रायल ${ends} खत्म हो जाएगा (${left} बाकी)। उसके बाद ऐप लॉक हो जाएगा।` : `Your free trial ends ${ends} (${left} left). After that the app locks.`,
    short: isHi ? `${ends} खत्म · ${left} बाकी` : `Ends ${ends} · ${left} left`,
  };
}
