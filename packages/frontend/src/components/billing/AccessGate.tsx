import { useCallback, useEffect, useState, type ReactNode } from 'react';
import api from '@/services/api';
import { onPaywall } from '@/services/paywall';
import { Paywall, type BillingStatus } from './Paywall';
import { TrialNotice } from './TrialNotice';

/**
 * Wraps the whole signed-in app. While the free trial or paid plan runs it shows the app (with a small
 * reminder on the last day). When it has ended, or any API call answers 402, it shows the paywall instead
 * of the app, every time, on every screen.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [offsetMs, setOffsetMs] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/billing/status');
      const s: BillingStatus = res.data.data;
      setStatus(s);
      setBlocked(s.status === 'expired');
      // server time minus phone time, so countdowns are right even if the phone clock is wrong
      if (s.serverNow) setOffsetMs(Date.parse(s.serverNow) - Date.now());
    } catch {
      // If status cannot be read, the server still enforces the paywall on every content request.
    } finally {
      setChecked(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The moment the trial / plan runs out, lock the app without waiting for the next request
  useEffect(() => {
    if (!status || status.staff || status.status === 'expired') return;
    const end = Date.parse(status.status === 'trial' ? status.trialEndsAt : (status.paidUntil ?? ''));
    if (Number.isNaN(end)) return;
    const wait = end - (Date.now() + offsetMs) + 1000;
    if (wait <= 0 || wait > 2_000_000_000) return;
    const t = window.setTimeout(() => void load(), wait);
    return () => window.clearTimeout(t);
  }, [status, offsetMs, load]);

  // Any 402 from the API, from any screen
  useEffect(() => onPaywall(() => setBlocked(true)), []);

  // Re-check when the student comes back to the tab, so an expiry is noticed without a reload
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (blocked) return <Paywall status={status} onRecheck={load} />;

  return (
    <>
      {status?.status === 'trial' && !status.staff && (
        <TrialNotice status={status} offsetMs={offsetMs} onBuy={() => setPlanOpen(true)} />
      )}
      {children}
      {planOpen && <Paywall status={status} onRecheck={load} onClose={() => setPlanOpen(false)} />}
    </>
  );
}
