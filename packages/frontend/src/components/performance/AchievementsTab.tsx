import { useEffect, useState } from 'react';
import api from '@/services/api';
import { PremiumCard } from './charts';

export interface AchievementItem {
  key: string;
  category: 'tests' | 'streak' | 'practice' | 'special';
  icon: string;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  current: number;
  target: number;
  unlocked: boolean;
}

export interface AchievementsData {
  xp: { xp: number; level: number; xpIntoLevel: number; xpForLevel: number };
  achievements: AchievementItem[];
  unlockedCount: number;
  totalCount: number;
}

const CATEGORIES: { key: AchievementItem['category']; en: string; hi: string }[] = [
  { key: 'tests', en: '📝 Test Milestones', hi: '📝 टेस्ट मील के पत्थर' },
  { key: 'streak', en: '🔥 Consistency', hi: '🔥 निरंतरता' },
  { key: 'practice', en: '🧠 Practice & Mastery', hi: '🧠 अभ्यास और महारत' },
  { key: 'special', en: '🌟 Special', hi: '🌟 खास' },
];

/** Level + XP bar, shared by the Achievements tab and the Profile hero. */
export function XpBar({ xp, isHi, dark = false }: { xp: AchievementsData['xp']; isHi: boolean; dark?: boolean }) {
  const pct = Math.min(100, Math.round((xp.xpIntoLevel / xp.xpForLevel) * 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] font-bold ${dark ? 'text-secondary-200' : 'text-primary'}`}>
          {isHi ? `लेवल ${xp.level}` : `Level ${xp.level}`}
        </span>
        <span className={`text-[10px] tabular-nums ${dark ? 'text-white/70' : 'text-gray-500'}`}>
          {xp.xpIntoLevel} / {xp.xpForLevel} XP
        </span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${dark ? 'bg-white/15' : 'bg-primary-50'}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-secondary-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Badge({ a, isHi }: { a: AchievementItem; isHi: boolean }) {
  const pct = Math.round((a.current / a.target) * 100);
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={`relative w-16 h-16 rounded-full flex items-center justify-center ${
          a.unlocked
            ? 'bg-gradient-to-br from-secondary-100 to-secondary-300 ring-2 ring-secondary shadow-[0_8px_20px_-8px_rgba(197,160,40,0.9)]'
            : 'bg-primary-50 ring-1 ring-primary-100'
        }`}
      >
        <span className={`text-2xl ${a.unlocked ? '' : 'grayscale opacity-40'}`}>{a.icon}</span>
        {a.unlocked && (
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-success text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">✓</span>
        )}
      </div>
      <p className={`text-[10px] font-semibold mt-1.5 leading-tight ${a.unlocked ? 'text-primary' : 'text-gray-500'}`}>{isHi ? a.titleHi : a.titleEn}</p>
      {a.unlocked ? (
        <p className="text-[9px] text-green-600 mt-0.5">{isHi ? 'हासिल' : 'Unlocked'}</p>
      ) : (
        <div className="w-14 mt-1">
          <div className="h-1 bg-primary-50 rounded-full overflow-hidden">
            <div className="h-full bg-primary-300 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[9px] text-gray-400 mt-0.5 tabular-nums">{a.current}/{a.target}</p>
        </div>
      )}
    </div>
  );
}

export function AchievementsTab({ isHi }: { isHi: boolean }) {
  const [data, setData] = useState<AchievementsData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/performance/achievements')
      .then((res) => { if (!cancelled) { setData(res.data?.data ?? null); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, []);

  if (state === 'loading') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-36 bg-white rounded-3xl" />
        <div className="h-48 bg-white rounded-3xl" />
      </div>
    );
  }
  if (state === 'error' || !data) {
    return <p className="text-center text-xs text-gray-500 py-16">{isHi ? 'अचीवमेंट्स लोड नहीं हो सके' : 'Could not load achievements'}</p>;
  }

  const next = data.achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];

  return (
    <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start lg:[&>*:nth-child(-n+2)]:col-span-2">
      {/* Level hero */}
      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)] bg-gradient-to-br from-primary-700 via-primary to-primary-400">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-secondary/25 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] text-secondary-200 uppercase tracking-[0.18em] font-semibold">{isHi ? 'आपका लेवल' : 'Your level'}</p>
            <p className="text-5xl font-black leading-none mt-1 tabular-nums">{data.xp.level}</p>
            <p className="text-[11px] text-white/70 mt-1.5 tabular-nums">{data.xp.xp} XP {isHi ? 'कुल' : 'total'}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-secondary-200 tabular-nums">{data.unlockedCount}<span className="text-base text-white/50">/{data.totalCount}</span></p>
            <p className="text-[10px] text-white/70">{isHi ? 'बैज हासिल' : 'badges unlocked'}</p>
          </div>
        </div>
        <div className="relative mt-4"><XpBar xp={data.xp} isHi={isHi} dark /></div>
        <p className="relative text-[9px] text-white/50 mt-2">
          {isHi ? 'XP: हर हल किया प्रश्न 2, हर टेस्ट 20, हर सक्रिय दिन 10' : 'XP: 2 per answered question, 20 per test, 10 per active day'}
        </p>
      </div>

      {/* Next up */}
      {next && (
        <PremiumCard title={`🎯 ${isHi ? 'अगला लक्ष्य' : 'Next up'}`}>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 shrink-0 rounded-full bg-primary-50 ring-1 ring-primary-100 flex items-center justify-center text-2xl">{next.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-primary">{isHi ? next.titleHi : next.titleEn}</p>
              <p className="text-[10px] text-gray-500">{isHi ? next.descHi : next.descEn}</p>
              <div className="h-2 bg-primary-50 rounded-full overflow-hidden mt-2">
                <div className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-secondary-200" style={{ width: `${Math.round((next.current / next.target) * 100)}%` }} />
              </div>
              <p className="text-[10px] text-gray-500 mt-1 tabular-nums">{next.current} / {next.target}</p>
            </div>
          </div>
        </PremiumCard>
      )}

      {/* Badges by category */}
      {CATEGORIES.map((c) => {
        const list = data.achievements.filter((a) => a.category === c.key);
        if (list.length === 0) return null;
        return (
          <PremiumCard key={c.key} title={isHi ? c.hi : c.en} subtitle={`${list.filter((a) => a.unlocked).length}/${list.length} ${isHi ? 'हासिल' : 'unlocked'}`}>
            <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-y-5 gap-x-2">
              {list.map((a) => <Badge key={a.key} a={a} isHi={isHi} />)}
            </div>
          </PremiumCard>
        );
      })}
    </div>
  );
}
