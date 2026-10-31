import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { PremiumCard } from '@/components/performance/charts';
import { Badge, XpBar } from '@/components/performance/AchievementsTab';
import type { BillingStatus } from '@/components/billing/Paywall';
import { InstallApp } from '@/components/common/InstallApp';
import type { AchievementsData } from '@/components/performance/AchievementsTab';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  phone: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  google_avatar_url: string | null;
  preferred_language: string;
  selected_exam_id: string | null;
  deletion_scheduled_at: string | null;
  created_at: string;
  role?: string;
  exam?: { id: string; name_en: string; name_hi: string } | null;
}

interface EnrolledExam { id: string; exam_id: string; name_en: string; name_hi: string }
interface AllExam { id: string; name_en: string; name_hi: string }
interface SessionRow {
  id: string;
  deviceType: string | null;
  deviceInfo: { userAgent?: string } | null;
  city: string | null;
  lastActiveAt: string;
  isCurrent: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

// Server messages are English-only, so in Hindi we always show our own Hindi fallback.
const errMsg = (e: any, fallback: string, isHi = false): string => (isHi ? fallback : e?.response?.data?.error?.message ?? fallback);

function maskPhone(p: string | null): string | null {
  return p && p.length >= 8 ? `+91 ${p.slice(0, 2)}••••${p.slice(-4)}` : p ? `+91 ${p}` : null;
}

function describeDevice(s: SessionRow): string {
  const ua = s.deviceInfo?.userAgent ?? '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return [browser, os].filter(Boolean).join(' · ') || s.deviceType || 'Unknown device';
}

function ago(iso: string, isHi: boolean): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return isHi ? 'अभी' : 'just now';
  if (mins < 60) return isHi ? `${mins} मिनट पहले` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return isHi ? `${hrs} घंटे पहले` : `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return isHi ? `${days} दिन पहले` : `${days} d ago`;
}

function Chip({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl py-2 text-center backdrop-blur">
      <p className="text-sm font-extrabold tabular-nums">{icon} {value}</p>
      <p className="text-[9px] text-white/60">{label}</p>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="bg-primary-50/60 rounded-2xl p-3">
      <span className="text-lg">{icon}</span>
      <p className="text-xl font-extrabold text-primary tabular-nums leading-tight mt-1">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function ProfileSettingsPage() {
  const { language } = useTranslation();
  const isHi = language === 'hi';
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [enrolled, setEnrolled] = useState<EnrolledExam[]>([]);
  const [coins, setCoins] = useState<number | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [rank, setRank] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [ach, setAch] = useState<AchievementsData | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const loadProfile = async () => {
    const res = await api.get('/api/profile');
    setProfile(res.data?.data ?? null);
  };
  const loadEnrolled = async () => {
    const res = await api.get('/api/profile/exams');
    setEnrolled(res.data?.data ?? []);
  };
  const loadReadiness = async () => {
    const res = await api.get('/api/performance/readiness');
    setReadiness(res.data?.data ?? null);
  };
  const loadSessions = async () => {
    const res = await api.get('/api/sessions');
    setSessions(res.data?.data?.sessions ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [p, e, c, o, r, a, rd, ac, s, b] = await Promise.allSettled([
        api.get('/api/profile'),
        api.get('/api/profile/exams'),
        api.get('/api/coins/balance'),
        api.get('/api/performance/overview'),
        api.get('/api/performance/rank'),
        api.get('/api/performance/activity'),
        api.get('/api/performance/readiness'),
        api.get('/api/performance/achievements'),
        api.get('/api/sessions'),
        api.get('/api/billing/status'),
      ]);
      if (cancelled) return;
      if (p.status === 'fulfilled') setProfile(p.value.data?.data ?? null);
      if (e.status === 'fulfilled') setEnrolled(e.value.data?.data ?? []);
      if (c.status === 'fulfilled') setCoins(c.value.data?.data?.balance ?? 0);
      if (o.status === 'fulfilled') setOverview(o.value.data?.data);
      if (r.status === 'fulfilled') setRank(r.value.data?.data);
      if (a.status === 'fulfilled') setActivity(a.value.data?.data);
      if (rd.status === 'fulfilled') setReadiness(rd.value.data?.data);
      if (ac.status === 'fulfilled') setAch(ac.value.data?.data);
      if (s.status === 'fulfilled') setSessions(s.value.data?.data?.sessions ?? []);
      if (b.status === 'fulfilled') setBilling(b.value.data?.data ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background px-4 pt-6 space-y-4 animate-pulse">
        <div className="h-56 bg-white rounded-3xl" />
        <div className="h-40 bg-white rounded-3xl" />
        <div className="h-40 bg-white rounded-3xl" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-center text-sm text-gray-500 py-24">{isHi ? 'प्रोफ़ाइल लोड नहीं हो सकी' : 'Could not load your profile'}</p>;
  }

  const name = (x: { name_en: string; name_hi: string }) => (isHi ? x.name_hi : x.name_en);
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const studyMins = overview?.totalStudyTimeMinutes ?? 0;
  const studyText = studyMins >= 60 ? `${Math.floor(studyMins / 60)}h ${studyMins % 60}m` : `${studyMins}m`;
  const preview = ach
    ? [...ach.achievements.filter((a) => a.unlocked).slice(-3), ...ach.achievements.filter((a) => !a.unlocked).sort((a, b) => b.current / b.target - a.current / a.target).slice(0, 1)]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 via-background to-background pb-28">
      {notice && (
        <div className={`fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[90%] px-4 py-2 rounded-2xl text-xs font-semibold shadow-lg ${notice.kind === 'ok' ? 'bg-success text-white' : 'bg-accent text-white'}`}>
          {notice.text}
        </div>
      )}

      <ProfileHero
        profile={profile}
        isHi={isHi}
        coins={coins}
        streak={activity?.currentStreak ?? overview?.currentStreak ?? 0}
        rank={rank}
        xp={ach?.xp ?? null}
        onChanged={loadProfile}
        flash={flash}
      />

      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5 lg:items-start lg:[&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-3">
        {isAdmin && (
          <button onClick={() => navigate('/admin/dashboard')} className="lg:col-span-2 xl:col-span-3 w-full flex items-center justify-between rounded-2xl bg-gradient-to-r from-primary-600 to-primary-400 text-white px-4 py-3 shadow">
            <span className="text-sm font-semibold">⚙️ {isHi ? 'एडमिन पैनल' : 'Admin Panel'}</span>
            <span>›</span>
          </button>
        )}

        {/* Plan */}
        <div className="lg:col-span-2 xl:col-span-3 rounded-3xl border border-secondary-100 bg-gradient-to-r from-secondary-50 to-white p-4 flex items-center gap-3 shadow-sm">
          <div className="w-11 h-11 rounded-full bg-secondary-100 flex items-center justify-center text-xl">👑</div>
          <div className="flex-1">
            <p className="text-sm font-bold text-primary">
              {billing?.staff ? (isHi ? 'टीम एक्सेस' : 'Team access')
                : billing?.status === 'paid' ? (isHi ? 'प्रीमियम' : 'Premium')
                : (isHi ? 'फ्री ट्रायल' : 'Free trial')}
            </p>
            <p className="text-[11px] text-gray-500">
              {billing?.staff ? (isHi ? 'टीम सदस्य, कोई सीमा नहीं' : 'Team member, no limits')
                : billing?.status === 'paid' && billing.paidUntil
                  ? (isHi ? `${new Date(billing.paidUntil).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short', year: 'numeric' })} तक चालू · ${billing.daysLeft} दिन बाकी` : `Active until ${new Date(billing.paidUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${billing.daysLeft} days left`)
                  : billing?.status === 'trial'
                    ? (isHi ? `${billing.daysLeft} दिन बाकी · फिर ₹${billing.plan.priceRupees} में ${billing.plan.months} महीने` : `${billing.daysLeft} day${billing.daysLeft === 1 ? '' : 's'} left · then ₹${billing.plan.priceRupees} for ${billing.plan.months} months`)
                    : ''}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-primary-50 text-primary text-[10px] font-bold">{isHi ? 'सक्रिय' : 'Active'}</span>
        </div>

        <div className="lg:col-span-2 xl:col-span-3 empty:hidden"><InstallApp /></div>

        <ExamGoal
          profile={profile}
          enrolled={enrolled}
          readiness={readiness}
          isHi={isHi}
          name={name}
          onChanged={async () => { await Promise.allSettled([loadProfile(), loadEnrolled(), loadReadiness()]); }}
          flash={flash}
          goReadiness={() => navigate('/progress?tab=readiness')}
        />

        {/* Stats */}
        <PremiumCard
          title={`📊 ${isHi ? 'मेरे आंकड़े' : 'My statistics'}`}
          right={<button onClick={() => navigate('/progress')} className="text-[11px] font-semibold text-primary-400">{isHi ? 'विस्तार से' : 'Details'} ›</button>}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <Stat icon="📝" value={String(overview?.totalTestsAttempted ?? 0)} label={isHi ? 'टेस्ट दिए' : 'Tests taken'} />
            <Stat icon="🎯" value={`${overview?.overallAccuracy ?? 0}%`} label={isHi ? 'सटीकता' : 'Accuracy'} />
            <Stat icon="⏱" value={studyText} label={isHi ? 'पढ़ाई का समय' : 'Study time'} />
            <Stat icon="🔥" value={String(activity?.bestStreak ?? overview?.bestStreak ?? 0)} label={isHi ? 'सर्वश्रेष्ठ स्ट्रीक' : 'Best streak'} />
          </div>
        </PremiumCard>

        {/* Achievements preview */}
        {ach && (
          <PremiumCard
            title={`🏅 ${isHi ? 'मेरी उपलब्धियां' : 'My achievements'}`}
            subtitle={`${ach.unlockedCount}/${ach.totalCount} ${isHi ? 'हासिल' : 'unlocked'}`}
            right={<button onClick={() => navigate('/progress?tab=achievements')} className="text-[11px] font-semibold text-primary-400">{isHi ? 'सभी देखें' : 'View all'} ›</button>}
          >
            <div className="grid grid-cols-4 gap-2">
              {preview.map((a) => <Badge key={a.key} a={a} isHi={isHi} />)}
            </div>
          </PremiumCard>
        )}

        <Settings
          profile={profile}
          sessions={sessions}
          isHi={isHi}
          reloadSessions={loadSessions}
          reloadProfile={loadProfile}
          flash={flash}
          onLogout={async () => {
            try { await logout(); } catch { /* fall through to redirect */ }
            window.location.href = '/login';
          }}
        />
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function ProfileHero({
  profile, isHi, coins, streak, rank, xp, onChanged, flash,
}: {
  profile: ProfileData;
  isHi: boolean;
  coins: number | null;
  streak: number;
  rank: any;
  xp: AchievementsData['xp'] | null;
  onChanged: () => Promise<void>;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(profile.full_name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const shownName = profile.full_name?.trim() || (isHi ? 'अपना नाम जोड़ें' : 'Add your name');
  const photo = profile.avatar_url || profile.google_avatar_url;
  const memberSince = new Date(profile.created_at).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { month: 'short', year: 'numeric' });

  const saveName = async () => {
    setSaving(true);
    try {
      await api.patch('/api/profile', { full_name: draft.trim() });
      await onChanged();
      setEditing(false);
      flash('ok', isHi ? 'नाम अपडेट हो गया' : 'Name updated');
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'नाम सेव नहीं हो सका' : 'Could not save name', isHi));
    }
    setSaving(false);
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      await api.post('/api/profile/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImgBroken(false);
      await onChanged();
      flash('ok', isHi ? 'फ़ोटो अपडेट हो गई' : 'Photo updated');
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'फ़ोटो अपलोड नहीं हो सकी (अधिकतम 2MB)' : 'Upload failed (max 2MB)', isHi));
    }
    setUploading(false);
  };

  const removePhoto = async () => {
    try {
      await api.delete('/api/profile/avatar');
      await onChanged();
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'फ़ोटो हटाई नहीं जा सकी' : 'Could not remove photo', isHi));
    }
  };

  return (
    <div className="relative overflow-hidden rounded-b-[32px] lg:rounded-3xl lg:mt-6 bg-gradient-to-br from-primary-700 via-primary to-primary-400 text-white px-4 lg:px-8 pt-6 lg:pt-8 pb-5 lg:pb-7 shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)]">
      <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-secondary/25 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-20 h-20 rounded-full bg-white/15 ring-2 ring-secondary overflow-hidden flex items-center justify-center">
            {photo && !imgBroken ? (
              <img src={photo} alt="" className="w-full h-full object-cover" onError={() => setImgBroken(true)} />
            ) : (
              <span className="text-3xl font-black text-secondary-200">{(profile.full_name?.trim()?.[0] ?? '?').toUpperCase()}</span>
            )}
            {uploading && <div className="absolute inset-0 bg-primary/60 flex items-center justify-center text-[10px]">…</div>}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            aria-label={isHi ? 'फ़ोटो बदलें' : 'Change photo'}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-secondary text-primary-800 flex items-center justify-center border-2 border-primary text-xs"
          >📷</button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={50}
                autoFocus
                className="min-w-0 flex-1 rounded-xl bg-white/15 border border-white/20 px-3 py-1.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <button onClick={saveName} disabled={saving || draft.trim().length < 2} className="px-2.5 py-1.5 rounded-xl bg-secondary text-primary-800 text-xs font-bold disabled:opacity-50">{saving ? '…' : '✓'}</button>
              <button onClick={() => { setEditing(false); setDraft(profile.full_name ?? ''); }} className="px-2.5 py-1.5 rounded-xl bg-white/15 text-xs">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold truncate">{shownName}</h2>
              <button onClick={() => { setDraft(profile.full_name ?? ''); setEditing(true); }} aria-label={isHi ? 'नाम बदलें' : 'Edit name'} className="text-white/70 text-xs">✏️</button>
            </div>
          )}
          {maskPhone(profile.phone) && <p className="text-[11px] text-white/70 mt-0.5">{maskPhone(profile.phone)}</p>}
          {profile.email && <p className="text-[11px] text-white/70 truncate">✉ {profile.email}</p>}
          <p className="text-[10px] text-white/50 mt-0.5">
            {isHi ? `सदस्य: ${memberSince}` : `Member since ${memberSince}`}
            {photo && !imgBroken && profile.avatar_url && (
              <button onClick={removePhoto} className="ml-2 underline text-white/60">{isHi ? 'फ़ोटो हटाएं' : 'Remove photo'}</button>
            )}
          </p>
        </div>
      </div>

      <div className="relative flex gap-2 mt-5">
        <Chip icon="🔥" value={streak} label={isHi ? 'दिन स्ट्रीक' : 'Day streak'} />
        <Chip icon="🪙" value={coins ?? 0} label={isHi ? 'कॉइन' : 'Coins'} />
        <Chip icon="🏆" value={rank && rank.ranked !== false ? `#${rank.currentRank}` : '–'} label={rank && rank.ranked !== false ? (isHi ? `${rank.totalUsers} में` : `of ${rank.totalUsers}`) : (isHi ? 'रैंक' : 'Rank')} />
      </div>

      {xp && <div className="relative mt-4"><XpBar xp={xp} isHi={isHi} dark /></div>}
    </div>
  );
}

// ─── Exam goal ─────────────────────────────────────────────────────────────────

function ExamGoal({
  profile, enrolled, readiness, isHi, name, onChanged, flash, goReadiness,
}: {
  profile: ProfileData;
  enrolled: EnrolledExam[];
  readiness: any;
  isHi: boolean;
  name: (x: { name_en: string; name_hi: string }) => string;
  onChanged: () => Promise<void>;
  flash: (k: 'ok' | 'err', t: string) => void;
  goReadiness: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [allExams, setAllExams] = useState<AllExam[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  const primary = profile.exam;
  const exam = readiness?.exam;
  const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const makePrimary = async (examId: string) => {
    setBusyId(examId);
    try {
      await api.post('/api/profile/exam', { exam_id: examId });
      await onChanged();
      flash('ok', isHi ? 'मुख्य परीक्षा बदल गई' : 'Primary exam updated');
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'परीक्षा बदली नहीं जा सकी' : 'Could not change exam', isHi));
    }
    setBusyId(null);
  };

  const openAdd = async () => {
    setAdding(true);
    setPicked([]);
    try {
      const res = await api.get('/api/onboarding/exams');
      const d = res.data?.data;
      setAllExams([...(d?.state ?? []), ...(d?.central ?? [])]);
    } catch { setAllExams([]); }
  };

  const enroll = async () => {
    setEnrolling(true);
    try {
      await api.post('/api/profile/exams/enroll', { examIds: picked });
      await onChanged();
      setAdding(false);
      flash('ok', isHi ? 'परीक्षाएं जोड़ दी गईं' : 'Exams added');
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'जोड़ नहीं सके' : 'Could not add exams', isHi));
    }
    setEnrolling(false);
  };

  const available = allExams.filter((x) => !enrolled.some((e) => e.exam_id === x.id));

  return (
    <PremiumCard
      title={`🎯 ${isHi ? 'मेरा लक्ष्य' : 'My exam goal'}`}
      right={<button onClick={openAdd} className="text-[11px] font-semibold text-primary-400">+ {isHi ? 'जोड़ें' : 'Add'}</button>}
    >
      {primary ? (
        <div className="rounded-2xl bg-gradient-to-br from-primary-50 to-white border border-primary-100 p-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{isHi ? 'मुख्य परीक्षा' : 'Primary exam'}</p>
          <p className="text-sm font-extrabold text-primary mt-0.5">{name(primary)}</p>
          <div className="flex items-center justify-between mt-2">
            {exam?.daysLeft != null ? (
              <span className="px-2.5 py-1 rounded-full bg-secondary-100 text-secondary-700 text-[10px] font-bold">⏳ {exam.daysLeft} {isHi ? 'दिन बाकी' : 'days left'} · {fmtDate(exam.examDate)}</span>
            ) : (
              <span className="text-[10px] text-gray-400">{isHi ? 'परीक्षा तिथि घोषित नहीं' : 'Exam date not announced'}</span>
            )}
            {readiness && (
              <button onClick={goReadiness} className="text-[11px] font-bold text-primary">
                {isHi ? 'तैयारी' : 'Readiness'} {readiness.score}/100 ›
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">{isHi ? 'अभी कोई मुख्य परीक्षा चुनी नहीं गई' : 'No primary exam selected yet'}</p>
      )}

      {enrolled.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{isHi ? 'मेरी परीक्षाएं' : 'Enrolled exams'}</p>
          {enrolled.map((e) => {
            const isPrimary = e.exam_id === profile.selected_exam_id;
            return (
              <div key={e.id} className="flex items-center justify-between rounded-2xl bg-primary-50/50 px-3 py-2">
                <span className="text-[11px] font-medium text-gray-800 truncate">{isPrimary && '⭐ '}{name(e)}</span>
                {isPrimary ? (
                  <span className="text-[10px] font-bold text-secondary-600">{isHi ? 'मुख्य' : 'Primary'}</span>
                ) : (
                  <button onClick={() => makePrimary(e.exam_id)} disabled={busyId === e.exam_id} className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-primary text-white disabled:opacity-50">
                    {busyId === e.exam_id ? '…' : isHi ? 'मुख्य बनाएं' : 'Make primary'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="mt-3 pt-3 border-t border-primary-50">
          <p className="text-[11px] text-gray-500 mb-2">{isHi ? 'जोड़ने के लिए परीक्षाएं चुनें' : 'Select exams to add'}</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {available.map((x) => (
              <label key={x.id} className="flex items-center gap-2 rounded-xl border border-primary-50 px-3 py-2 text-xs text-gray-700">
                <input type="checkbox" checked={picked.includes(x.id)} onChange={() => setPicked((p) => (p.includes(x.id) ? p.filter((i) => i !== x.id) : [...p, x.id]))} />
                {name(x)}
              </label>
            ))}
            {available.length === 0 && <p className="text-xs text-gray-400">{isHi ? 'सभी परीक्षाएं पहले से जुड़ी हैं' : 'You are enrolled in every exam'}</p>}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={enroll} disabled={picked.length === 0 || enrolling} className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-50">
              {enrolling ? '…' : `${isHi ? 'जोड़ें' : 'Add'} (${picked.length})`}
            </button>
            <button onClick={() => setAdding(false)} className="flex-1 py-2 rounded-xl bg-primary-50 text-primary text-xs font-semibold">{isHi ? 'रद्द करें' : 'Cancel'}</button>
          </div>
        </div>
      )}
    </PremiumCard>
  );
}

// ─── Settings: language, devices, delete account, logout ───────────────────────

function Settings({
  profile, sessions, isHi, reloadSessions, reloadProfile, flash, onLogout,
}: {
  profile: ProfileData;
  sessions: SessionRow[];
  isHi: boolean;
  reloadSessions: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  flash: (k: 'ok' | 'err', t: string) => void;
  onLogout: () => Promise<void>;
}) {
  const { language, setLanguage } = useTranslation();
  const [showDevices, setShowDevices] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [del, setDel] = useState<'idle' | 'ask' | 'otp'>('idle');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  // Switches instantly (no reload) and saves to the profile through the auth context.
  const setLang = (lang: 'hi' | 'en') => {
    if (lang !== language) setLanguage(lang);
  };

  const signOutDevice = async (id: string) => {
    try {
      await api.delete(`/api/sessions/${id}`);
      await reloadSessions();
      flash('ok', isHi ? 'डिवाइस साइन-आउट हो गया' : 'Device signed out');
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'डिवाइस साइन-आउट नहीं हो सका' : 'Could not sign out that device', isHi));
    }
  };

  const requestDeletion = async () => {
    setBusy(true);
    try {
      await api.post('/api/account/delete/request');
      setDel('otp');
      flash('ok', isHi ? 'आपके फ़ोन पर OTP भेजा गया' : 'OTP sent to your phone');
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'डिलीशन शुरू नहीं हो सका' : 'Could not start deletion', isHi));
    }
    setBusy(false);
  };

  const confirmDeletion = async () => {
    setBusy(true);
    try {
      await api.post('/api/account/delete/confirm', { otp });
      window.location.href = '/login';
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'OTP गलत है' : 'Invalid OTP', isHi));
      setBusy(false);
    }
  };

  const cancelDeletion = async () => {
    try {
      await api.post('/api/account/delete/cancel');
      await reloadProfile();
      flash('ok', isHi ? 'डिलीशन रद्द कर दिया गया' : 'Account deletion cancelled');
    } catch (e) {
      flash('err', errMsg(e, isHi ? 'डिलीशन रद्द नहीं हो सका' : 'Could not cancel deletion', isHi));
    }
  };

  const scheduled = profile.deletion_scheduled_at
    ? new Date(profile.deletion_scheduled_at).toLocaleDateString(isHi ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <>
      <PremiumCard title={`⚙️ ${isHi ? 'सेटिंग्स' : 'Settings'}`}>
        {/* Language */}
        <div className="flex items-center justify-between py-1">
          <span className="text-xs font-semibold text-gray-800">🌐 {isHi ? 'भाषा' : 'Language'}</span>
          <div className="flex bg-primary-50 rounded-full p-0.5">
            {([['hi', 'हिंदी'], ['en', 'English']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setLang(k)} className={`px-3 py-1.5 text-[11px] font-semibold rounded-full ${language === k ? 'bg-primary text-white shadow' : 'text-primary-400'}`}>{l}</button>
            ))}
          </div>
        </div>

        {/* Devices */}
        <div className="border-t border-primary-50 mt-2 pt-2">
          <button onClick={() => setShowDevices((v) => !v)} className="w-full flex items-center justify-between py-1.5">
            <span className="text-xs font-semibold text-gray-800">📱 {isHi ? 'लॉग-इन डिवाइस' : 'Logged-in devices'} <span className="text-gray-400 font-normal">({sessions.length})</span></span>
            <span className="text-primary-300">{showDevices ? '⌃' : '⌄'}</span>
          </button>
          {showDevices && (
            <div className="space-y-1.5 mt-1">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-2xl bg-primary-50/50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{describeDevice(s)} {s.isCurrent && <span className="ml-1 text-[9px] text-green-600 font-bold">{isHi ? 'यह डिवाइस' : 'This device'}</span>}</p>
                    <p className="text-[9px] text-gray-500">{s.city ? `${s.city} · ` : ''}{ago(s.lastActiveAt, isHi)}</p>
                  </div>
                  {!s.isCurrent && (
                    <button onClick={() => signOutDevice(s.id)} className="text-[10px] font-semibold text-accent-600 px-2 py-1">{isHi ? 'साइन-आउट' : 'Sign out'}</button>
                  )}
                </div>
              ))}
              {sessions.length === 0 && <p className="text-[11px] text-gray-400">{isHi ? 'कोई सक्रिय डिवाइस नहीं' : 'No active devices'}</p>}
            </div>
          )}
        </div>
      </PremiumCard>

      {/* Danger zone */}
      <PremiumCard title={`🗑️ ${isHi ? 'अकाउंट' : 'Account'}`}>
        {scheduled ? (
          <div className="rounded-2xl bg-accent-50 border border-accent-100 p-3">
            <p className="text-xs font-semibold text-accent-700">{isHi ? `आपका अकाउंट ${scheduled} को हटा दिया जाएगा` : `Your account will be deleted on ${scheduled}`}</p>
            <button onClick={cancelDeletion} className="mt-2 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold">{isHi ? 'डिलीशन रद्द करें' : 'Cancel deletion'}</button>
          </div>
        ) : del === 'idle' ? (
          <button onClick={() => setDel('ask')} className="text-xs font-semibold text-accent-600">{isHi ? 'मेरा अकाउंट डिलीट करें' : 'Delete my account'}</button>
        ) : del === 'ask' ? (
          <div className="rounded-2xl bg-accent-50 border border-accent-100 p-3">
            <p className="text-xs text-accent-700">{isHi ? 'आपके फ़ोन पर OTP आएगा। पुष्टि के बाद अकाउंट 7 दिन में हट जाएगा, इस बीच आप रद्द कर सकते हैं।' : 'We will send an OTP to your phone. After you confirm, your account is deleted in 7 days. You can cancel before then.'}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={requestDeletion} disabled={busy} className="flex-1 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50">{busy ? '…' : isHi ? 'OTP भेजें' : 'Send OTP'}</button>
              <button onClick={() => setDel('idle')} className="flex-1 py-2 rounded-xl bg-white text-primary text-xs font-semibold border border-primary-100">{isHi ? 'रहने दें' : 'Keep account'}</button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-accent-50 border border-accent-100 p-3">
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="000000"
              className="w-full text-center tracking-[0.4em] text-lg font-bold rounded-xl border border-accent-200 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={confirmDeletion} disabled={busy || otp.length !== 6} className="flex-1 py-2 rounded-xl bg-accent text-white text-xs font-semibold disabled:opacity-50">{busy ? '…' : isHi ? 'डिलीट की पुष्टि करें' : 'Confirm deletion'}</button>
              <button onClick={() => { setDel('idle'); setOtp(''); }} className="flex-1 py-2 rounded-xl bg-white text-primary text-xs font-semibold border border-primary-100">{isHi ? 'रद्द करें' : 'Cancel'}</button>
            </div>
          </div>
        )}
      </PremiumCard>

      {/* Logout */}
      {confirmLogout ? (
        <div className="flex gap-2">
          <button onClick={onLogout} className="flex-1 py-3 rounded-2xl bg-accent text-white text-sm font-semibold">{isHi ? 'हाँ, लॉगआउट' : 'Yes, log out'}</button>
          <button onClick={() => setConfirmLogout(false)} className="flex-1 py-3 rounded-2xl bg-white border border-primary-100 text-primary text-sm font-semibold">{isHi ? 'रद्द करें' : 'Cancel'}</button>
        </div>
      ) : (
        <button onClick={() => setConfirmLogout(true)} className="w-full py-3 rounded-2xl bg-white border border-accent-200 text-accent-600 text-sm font-semibold shadow-sm">🚪 {isHi ? 'लॉगआउट' : 'Log out'}</button>
      )}
    </>
  );
}
