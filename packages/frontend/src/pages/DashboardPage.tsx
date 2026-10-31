import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n';
import { useStreak } from '@/hooks/useStreak';
import { useCoins } from '@/hooks/useCoins';
import { useDaysLeft } from '@/hooks/useDaysLeft';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { GreetingRow } from '@/components/dashboard/GreetingRow';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { TodaysPlan } from '@/components/dashboard/TodaysPlan';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { PerformanceCard } from '@/components/dashboard/PerformanceCard';
import { WeakAreas } from '@/components/dashboard/WeakAreas';
import { QuickLinks } from '@/components/dashboard/QuickLinks';
import { DailyChallengeBar } from '@/components/dashboard/DailyChallengeBar';
import { RecentResults } from '@/components/dashboard/RecentResults';
import { PageHero } from '@/components/ui/premium';
import api from '@/services/api';

/**
 * Dashboard — Comprehensive exam prep app layout.
 * Mobile-first with two-column layout on tablet+.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();

  // Dynamic data hooks
  const streak = useStreak();
  const coins = useCoins();
  const daysLeft = useDaysLeft();

  // Fire-and-forget activity recording (once per mount), then refresh streak
  const activityRecordedRef = useRef(false);
  useEffect(() => {
    if (activityRecordedRef.current) return;
    activityRecordedRef.current = true;

    api.post('/api/dashboard/activity', {}, { timeout: 15_000 })
      .then(() => {
        streak.retry();
      })
      .catch(() => {});
  }, []);

  const currentStreak = streak.data?.currentStreak ?? 0;
  const bestStreak = streak.data?.bestStreak ?? 0;
  const userName = user?.fullName || 'Student';

  // Daily login coin earning — fire once on mount, show popup if awarded
  const [showCoinPopup, setShowCoinPopup] = useState(false);
  const dailyLoginFiredRef = useRef(false);
  useEffect(() => {
    if (dailyLoginFiredRef.current) return;
    dailyLoginFiredRef.current = true;
    api.post('/api/coins/earn', { type: 'daily_login' }, { timeout: 15_000 })
      .then((res) => {
        if (res.data?.data?.awarded) {
          setShowCoinPopup(true);
          setTimeout(() => setShowCoinPopup(false), 3000);
          // Refresh coin balance after earning
          coins.refetch();
        }
      })
      .catch(() => {
        // silent — non-critical
      });
  }, []);

  return (
    <div className="pb-6">
      {/* Coin Earn Popup */}
      {showCoinPopup && (
        <div className="fixed top-6 md:top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-secondary-300 to-secondary text-primary-800 px-5 py-3 rounded-2xl shadow-[0_12px_30px_-10px_rgba(197,160,40,0.8)] border border-secondary-200 animate-bounce">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪙</span>
            <span className="text-sm font-extrabold">{language === 'hi' ? '+10 कॉइन! दैनिक लॉगिन इनाम' : '+10 Coins! Daily Login Reward'}</span>
          </div>
        </div>
      )}

      {/* Navy hero: brand, greeting + exam switch, glass stat chips */}
      <PageHero className="pb-6">
        <div className="space-y-4">
          {/* 1. Top Header Bar */}
          <DashboardHeader language={language} />

          {/* 2. Greeting Row */}
          <GreetingRow userName={userName} language={language} />

          {/* 3. Stats Row (3 glass chips) */}
          <StatsRow
            language={language}
            currentStreak={currentStreak}
            bestStreak={bestStreak}
            daysLeft={daysLeft.daysLeft}
            examDateFormatted={daysLeft.examDateFormatted}
            coinBalance={coins.balance}
            onCoinsClick={() => {
              navigate('/profile');
            }}
          />
        </div>
      </PageHero>

      {/* Phones: one column in this order. Desktop: a 3-column grid (main content left, side cards right). */}
      <div className="px-4 lg:px-0 mt-4 lg:mt-5 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 lg:grid-rows-[auto_1fr_auto_auto] gap-4 lg:gap-5 items-start">
        {/* 4. Today's Plan + Continue Learning */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <TodaysPlan language={language} />
          <ContinueLearning language={language} />
        </div>

        {/* 5. Daily Challenge + Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4 lg:col-start-3 lg:row-start-1 lg:row-span-2">
          <DailyChallengeBar language={language} />
          <PerformanceCard language={language} />
        </div>

        {/* 6. Recent Results */}
        <div className="lg:col-span-2 lg:col-start-1 lg:row-start-2">
          <RecentResults language={language} />
        </div>

        {/* 7. Weak Areas */}
        <div className="lg:col-span-3 lg:row-start-3 xl:col-span-1 xl:col-start-4 xl:row-start-1 xl:row-span-2">
          <WeakAreas language={language} />
        </div>

        {/* 8. Quick Links */}
        <div className="lg:col-span-3 xl:col-span-4 lg:row-start-4 xl:row-start-3">
          <QuickLinks language={language} />
        </div>
      </div>
    </div>
  );
}
