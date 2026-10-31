import { useState } from 'react';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import type { LeaderboardEntry } from '@/services/dashboard.types';

interface LeaderboardSectionProps {
  language: 'hi' | 'en';
}

/**
 * LeaderboardSection — A round green button that opens a full leaderboard view.
 * Top 3 get gold/silver/bronze styling, user is highlighted.
 */
export function LeaderboardSection({ language }: LeaderboardSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'state' | 'national'>('state');
  const { data, isLoading, error, retry } = useLeaderboard(activeTab);

  return (
    <>
      {/* Round Green Button */}
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 px-6 py-3 bg-emerald-50 border-2 border-emerald-400 rounded-full hover:bg-emerald-100 hover:border-emerald-500 transition-all shadow-sm hover:shadow-md"
        >
          <span className="text-2xl">🏆</span>
          <span className="text-sm font-bold text-emerald-700">
            {language === 'hi' ? 'लीडरबोर्ड देखें' : 'View Leaderboard'}
          </span>
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Leaderboard Modal/Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white w-full sm:w-[420px] sm:max-h-[85vh] max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                🏆 {language === 'hi' ? 'लीडरबोर्ड' : 'Leaderboard'}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="px-4 pt-3 pb-2 flex justify-center">
              <div className="flex bg-gray-100 rounded-full p-1">
                <button
                  onClick={() => setActiveTab('state')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    activeTab === 'state' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {language === 'hi' ? '🏛️ राज्य' : '🏛️ State'}
                </button>
                <button
                  onClick={() => setActiveTab('national')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    activeTab === 'national' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {language === 'hi' ? '🇮🇳 राष्ट्रीय' : '🇮🇳 National'}
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {isLoading && <LoadingSkeleton />}
              {error && !isLoading && <ErrorState error={error} language={language} onRetry={retry} />}
              {!isLoading && !error && data && data.entries.length === 0 && <EmptyState language={language} />}
              {!isLoading && !error && data && data.entries.length > 0 && (
                <LeaderboardList entries={data.entries} userRank={data.userRank} language={language} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Leaderboard List with Top 3 special styling ---
function LeaderboardList({
  entries,
  userRank,
  language,
}: {
  entries: LeaderboardEntry[];
  userRank: LeaderboardEntry | null;
  language: 'hi' | 'en';
}) {
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const userInList = userRank ? entries.some((e) => e.userId === userRank.userId) : false;

  return (
    <div className="space-y-3 mt-2">
      {/* Top 3 — Podium cards */}
      {top3.length > 0 && (
        <div className="space-y-2">
          {top3.map((entry) => {
            const isUser = userRank?.userId === entry.userId;
            const bgColor =
              entry.rank === 1
                ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300'
                : entry.rank === 2
                ? 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300'
                : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200';
            const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';

            return (
              <div
                key={entry.userId}
                className={`flex items-center p-3 rounded-xl border-2 ${bgColor} ${
                  isUser ? 'ring-2 ring-emerald-400 ring-offset-1' : ''
                }`}
              >
                <span className="text-2xl mr-3">{medal}</span>
                <div className="flex items-center flex-1 gap-2">
                  {entry.avatarUrl ? (
                    <img src={entry.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                      {entry.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className={`text-sm font-semibold ${isUser ? 'text-emerald-700' : 'text-gray-800'}`}>
                      {entry.fullName} {isUser && <span className="text-xs text-emerald-600">{language === 'hi' ? '(आप)' : '(You)'}</span>}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold text-gray-800">{entry.totalScore}</p>
                  <p className="text-[10px] text-gray-400">{language === 'hi' ? 'अंक' : 'pts'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of entries */}
      {rest.length > 0 && (
        <div className="bg-gray-50 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {rest.map((entry) => {
            const isUser = userRank?.userId === entry.userId;
            return (
              <div
                key={entry.userId}
                className={`flex items-center px-3 py-2.5 ${isUser ? 'bg-emerald-50 border-l-3 border-emerald-500' : ''}`}
              >
                <span className="w-7 text-center text-xs font-bold text-gray-400">#{entry.rank}</span>
                <div className="flex items-center flex-1 ml-2 gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    {entry.fullName.charAt(0).toUpperCase()}
                  </div>
                  <p className={`text-xs font-medium ${isUser ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {entry.fullName} {isUser && <span className="text-emerald-600">{language === 'hi' ? '(आप)' : '(You)'}</span>}
                  </p>
                </div>
                <p className="text-xs font-bold text-gray-600">{entry.totalScore}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* User not in list — show at bottom */}
      {userRank && !userInList && (
        <div className="bg-emerald-50 rounded-xl p-3 border-2 border-emerald-300 flex items-center">
          <span className="w-7 text-center text-xs font-bold text-emerald-600">#{userRank.rank}</span>
          <div className="flex items-center flex-1 ml-2 gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-xs font-bold text-emerald-700">
              {userRank.fullName.charAt(0).toUpperCase()}
            </div>
            <p className="text-sm font-semibold text-emerald-700">
              {userRank.fullName} <span className="text-xs">{language === 'hi' ? '(आप)' : '(You)'}</span>
            </p>
          </div>
          <p className="text-sm font-bold text-emerald-700">{userRank.totalScore}</p>
        </div>
      )}
    </div>
  );
}

// --- Loading ---
function LoadingSkeleton() {
  return (
    <div className="space-y-3 mt-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center p-3 rounded-xl bg-gray-100">
          <div className="w-8 h-8 rounded-full bg-gray-200" />
          <div className="flex-1 ml-3 space-y-1">
            <div className="h-4 bg-gray-200 rounded w-28" />
          </div>
          <div className="w-10 h-4 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// --- Error ---
function ErrorState({ error, language, onRetry }: { error: { message: string; code?: string }; language: 'hi' | 'en'; onRetry: () => void }) {
  if (error.code === 'NO_EXAM_SELECTED') {
    return (
      <div className="p-6 text-center">
        <p className="text-3xl mb-2">📋</p>
        <p className="text-sm text-gray-600">
          {language === 'hi' ? 'पहले एक परीक्षा चुनें।' : 'Please select an exam first.'}
        </p>
      </div>
    );
  }
  return (
    <div className="p-6 text-center">
      <p className="text-3xl mb-2">⚠️</p>
      <p className="text-sm text-gray-600 mb-3">{error.message || 'Failed to load'}</p>
      <button onClick={onRetry} className="px-4 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-full hover:bg-emerald-700">
        {language === 'hi' ? 'पुनः प्रयास' : 'Retry'}
      </button>
    </div>
  );
}

// --- Empty ---
function EmptyState({ language }: { language: 'hi' | 'en' }) {
  return (
    <div className="p-6 text-center">
      <p className="text-3xl mb-2">🏆</p>
      <p className="text-sm text-gray-500">
        {language === 'hi' ? 'अभी तक कोई रैंकिंग नहीं।' : 'No rankings yet.'}
      </p>
    </div>
  );
}
