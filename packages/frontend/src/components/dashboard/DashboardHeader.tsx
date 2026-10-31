import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';

interface DashboardHeaderProps {
  language: 'hi' | 'en';
}

/**
 * DashboardHeader — Top header bar with app branding, notification bell, and trophy.
 */
export function DashboardHeader({ language }: DashboardHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      {/* Left: App logo */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-secondary-300 to-secondary flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(197,160,40,0.9)] shrink-0">
          <span className="text-lg">🎯</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-white leading-tight tracking-tight truncate">{language === 'hi' ? 'परीक्षा तैयारी' : 'Exam Prep'}</h1>
          <p className="text-[10px] text-secondary-200 tracking-wide truncate">
            {language === 'hi' ? 'सफलता आपका लक्ष्य' : 'Success Your Goal'}
          </p>
        </div>
      </div>

      {/* Right: Notification + Trophy */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        {/* Notification Bell */}
        <button
          title={language === 'hi' ? 'जल्द आ रहा है' : 'Coming Soon'}
          className="relative w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 border border-white/15 backdrop-blur opacity-70 cursor-not-allowed"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-primary">
            3
          </span>
        </button>

        {/* Trophy */}
        <button
          onClick={() => navigate('/progress')}
          className="w-10 h-10 flex items-center justify-center rounded-2xl bg-gradient-to-br from-secondary-200 to-secondary shadow-md active:scale-95 transition-transform"
        >
          <span className="text-lg">🏆</span>
        </button>
      </div>
    </div>
  );
}
