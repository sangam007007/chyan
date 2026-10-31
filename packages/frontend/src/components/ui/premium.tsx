import type { ReactNode } from 'react';

export { PremiumCard } from '@/components/performance/charts';

/**
 * Full-bleed navy hero used at the top of every main tab.
 * `children` render under the title row (chips, progress, stats…).
 */
export function PageHero({
  title,
  subtitle,
  left,
  right,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`p-hero rounded-b-[32px] lg:rounded-3xl lg:mt-6 px-4 lg:px-8 pt-5 lg:pt-7 pb-5 lg:pb-7 ${className}`}>
      <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-secondary/25 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-14 w-44 h-44 rounded-full bg-white/10 blur-2xl" />
      {(title || left || right) && (
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {left}
            <div className="min-w-0">
              {title && <h1 className="text-lg lg:text-2xl font-extrabold leading-tight truncate">{title}</h1>}
              {subtitle && <p className="text-[11px] text-white/70 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          {right}
        </div>
      )}
      {children && <div className="relative mt-4">{children}</div>}
    </header>
  );
}

/** Section heading with an optional action link on the right. */
export function SectionHeader({ title, action, onAction }: { title: ReactNode; action?: ReactNode; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2.5 px-1">
      <h2 className="p-title text-[14px]">{title}</h2>
      {action && (
        <button onClick={onAction} className="text-[11px] font-semibold text-primary-400">
          {action} ›
        </button>
      )}
    </div>
  );
}
