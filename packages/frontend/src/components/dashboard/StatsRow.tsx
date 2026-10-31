interface StatsRowProps {
  language: 'hi' | 'en';
  currentStreak: number;
  bestStreak: number;
  daysLeft: number | null;
  examDateFormatted: string | null;
  coinBalance: number | null;
  onCoinsClick?: () => void;
  dailyTarget?: { completed: number; target: number };
}

interface StatItem {
  icon: string;
  value: string;
  labelEn: string;
  labelHi: string;
  subEn: string;
  subHi: string;
  glow: string;
  bar?: number;
  onClick?: () => void;
}

/**
 * StatsRow — 4 horizontal scrollable stat cards with colored accents.
 */
export function StatsRow({
  language,
  currentStreak,
  bestStreak,
  daysLeft,
  examDateFormatted,
  coinBalance,
  onCoinsClick,
  dailyTarget,
}: StatsRowProps) {
  const streakGoal = 7;
  const streakPct = Math.min(100, Math.round((currentStreak / streakGoal) * 100));
  const dailyCompleted = dailyTarget?.completed ?? currentStreak;
  const dailyGoal = dailyTarget?.target ?? streakGoal;
  const dailyPct = dailyGoal > 0 ? Math.min(100, Math.round((dailyCompleted / dailyGoal) * 100)) : 0;

  const stats: StatItem[] = [
    {
      icon: '🔥',
      value: String(currentStreak),
      labelEn: 'Day Streak',
      labelHi: 'दिन की स्ट्रीक',
      subEn: `Best: ${bestStreak} 🏆`,
      subHi: `सर्वश्रेष्ठ: ${bestStreak} 🏆`,
      glow: 'from-accent-300/40',
      bar: streakPct,
    },
    {
      icon: '📅',
      value: daysLeft != null ? String(daysLeft) : '--',
      labelEn: 'Days Left',
      labelHi: 'दिन शेष',
      subEn: examDateFormatted ? `Exam: ${examDateFormatted}` : '--',
      subHi: examDateFormatted ? `परीक्षा: ${examDateFormatted}` : '--',
      glow: 'from-white/30',
    },
    {
      icon: '🪙',
      value: coinBalance != null ? String(coinBalance) : '--',
      labelEn: 'Coins',
      labelHi: 'सिक्के',
      subEn: 'Redeem >',
      subHi: 'रिडीम >',
      glow: 'from-secondary-300/50',
      onClick: onCoinsClick,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {stats.map((stat, i) => (
        <div
          key={i}
          className={`relative overflow-hidden min-w-0 rounded-2xl border border-white/15 bg-white/10 backdrop-blur p-3 ${stat.onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
          onClick={stat.onClick}
          role={stat.onClick ? 'button' : undefined}
          tabIndex={stat.onClick ? 0 : undefined}
          onKeyDown={stat.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') stat.onClick!(); } : undefined}
        >
          <div className={`pointer-events-none absolute -right-5 -top-5 w-14 h-14 rounded-full bg-gradient-to-br ${stat.glow} to-transparent blur-xl`} />
          <div className="relative flex items-center gap-1.5">
            <span className="text-base leading-none">{stat.icon}</span>
            <span className="text-xl font-black text-white tabular-nums leading-none">{stat.value}</span>
          </div>
          <p className="relative text-[10px] font-semibold text-white/90 mt-1.5 truncate">
            {language === 'hi' ? stat.labelHi : stat.labelEn}
          </p>
          {stat.bar !== undefined ? (
            <div className="relative h-1 rounded-full bg-white/15 mt-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-secondary-300 to-secondary" style={{ width: `${Math.max(4, stat.bar)}%` }} />
            </div>
          ) : null}
          <p className="relative text-[9px] text-secondary-200 mt-1 truncate">
            {language === 'hi' ? stat.subHi : stat.subEn}
          </p>
        </div>
      ))}
    </div>
  );
}
