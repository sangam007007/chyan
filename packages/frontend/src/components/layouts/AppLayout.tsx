import { Outlet } from 'react-router-dom';
import { BottomNavBar, DesktopNavBar } from './BottomNavBar';
import { AccessGate } from '@/components/billing/AccessGate';

/**
 * Main application layout for authenticated screens.
 * No top header — the DashboardPage has its own header.
 * Phones: main content + bottom navigation. Desktop: top navigation + a centered column.
 */
export function AppLayout() {
  return (
    <AccessGate>
      <div className="min-h-screen bg-gradient-to-b from-primary-50 via-background to-background">
        {/* Desktop top navigation (md+) */}
        <DesktopNavBar />

        {/* Main content area: full width on phones, a centered reading column on tablets and a full desktop width on large screens */}
        <main className="pb-28 md:pb-10 md:max-w-3xl md:mx-auto md:w-full lg:max-w-[1760px] lg:px-8 xl:px-12">
          <Outlet />
        </main>

        {/* Bottom navigation — mobile only */}
        <BottomNavBar />
      </div>
    </AccessGate>
  );
}
