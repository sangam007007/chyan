import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Renders the real value immediately. Entrance motion is pure CSS (see index.css), so a stalled animation can never leave a chart showing 0. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  return <span className="perf-pop">{value}{suffix}</span>;
}

export function PremiumCard({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-3xl p-4 border border-primary-50 shadow-[0_8px_30px_-12px_rgba(27,58,92,0.25)] ${className}`}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {title && <h3 className="text-[13px] font-bold text-primary tracking-tight">{title}</h3>}
            {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Daily bar chart ───────────────────────────────────────────────────────────

export interface DayBar {
  /** YYYY-MM-DD */
  date: string;
  value: number;
  tests: number;
}

const W = 320;
const H = 176;
const PAD = { l: 28, r: 8, t: 12, b: 22 };
const DAY_MS = 86400000;

/**
 * One bar per calendar day in the range (days without tests stay empty).
 * Bars under `passMark` are red, the rest green. Tap/drag to inspect a day.
 */
export function DailyBars({
  bars,
  days,
  passMark,
  locale,
  testsLabel,
  emptyText,
}: {
  bars: DayBar[];
  days: number;
  passMark: number;
  locale: string;
  testsLabel: (n: number) => string;
  emptyText: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => { setActive(null); }, [bars, days]);

  // IST "today" as a UTC-midnight timestamp
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const todayMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const startMs = todayMs - (days - 1) * DAY_MS;
  const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const fmt = (ms: number, long = false) =>
    new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(long ? { year: 'numeric' } : {}), timeZone: 'UTC' });

  if (bars.length === 0) {
    return (
      <div className="h-[176px] flex items-center justify-center text-[11px] text-gray-400 bg-primary-50/40 rounded-2xl">
        {emptyText}
      </div>
    );
  }

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const slot = innerW / days;
  const barW = Math.max(1.4, Math.min(16, slot * 0.68));
  const xOf = (ms: number) => PAD.l + ((ms - startMs) / DAY_MS) * slot + slot / 2;
  const yOf = (v: number) => PAD.t + (1 - Math.min(100, Math.max(0, v)) / 100) * innerH;

  const byDate = new Map(bars.map((b) => [b.date, b]));
  const shownBar = (active && byDate.get(active)) || bars[bars.length - 1];
  const shownX = xOf(toMs(shownBar.date));

  const pick = (clientX: number) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((clientX - r.left) / r.width) * W;
    let best = bars[0];
    for (const b of bars) if (Math.abs(xOf(toMs(b.date)) - x) < Math.abs(xOf(toMs(best.date)) - x)) best = b;
    setActive(best.date);
  };

  const tickDays = days <= 7 ? [0, 3, 6] : [0, Math.floor((days - 1) / 2), days - 1];
  const red = shownBar.value < passMark;

  return (
    <div
      ref={boxRef}
      className="relative select-none touch-pan-y"
      onPointerDown={(e) => pick(e.clientX)}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') pick(e.clientX); }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
        {[0, 50, 100].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(g)} y2={yOf(g)} stroke="#E8EDF3" strokeDasharray={g === 0 ? undefined : '3 4'} />
            <text x={PAD.l - 5} y={yOf(g) + 3} textAnchor="end" fontSize="8" fill="#94a3b8">{g}</text>
          </g>
        ))}

        {/* pass-mark line */}
        <line x1={PAD.l} x2={W - PAD.r} y1={yOf(passMark)} y2={yOf(passMark)} stroke="#E63946" strokeWidth="1" strokeDasharray="4 3" opacity="0.8" />
        <text x={W - PAD.r} y={yOf(passMark) - 3} textAnchor="end" fontSize="8" fontWeight="700" fill="#E63946">{passMark}%</text>

        {shownBar && <rect x={shownX - slot / 2} y={PAD.t} width={slot} height={innerH} fill="#1B3A5C" opacity="0.06" rx="2" />}

        {bars.map((b) => {
          const h = Math.max(2, H - PAD.b - yOf(b.value));
          const isRed = b.value < passMark;
          return (
            <rect
              key={b.date}
              className="perf-grow"
              x={xOf(toMs(b.date)) - barW / 2}
              y={H - PAD.b - h}
              width={barW}
              height={h}
              rx={Math.min(3, barW / 2)}
              fill={isRed ? '#E63946' : '#2ECC71'}
              opacity={active && b.date !== shownBar.date ? 0.45 : 1}
            />
          );
        })}

        {tickDays.map((d, i) => (
          <text key={d} x={PAD.l + (d + 0.5) * slot} y={H - 6} fontSize="8" fill="#94a3b8" textAnchor={i === 0 ? 'start' : i === tickDays.length - 1 ? 'end' : 'middle'}>
            {fmt(startMs + d * DAY_MS)}
          </text>
        ))}
      </svg>

      <div
        className="absolute -top-1 pointer-events-none -translate-x-1/2 rounded-xl px-2.5 py-1 shadow-lg text-center whitespace-nowrap text-white"
        style={{ left: `${Math.min(80, Math.max(20, (shownX / W) * 100))}%`, background: red ? '#C4202D' : '#1B3A5C' }}
      >
        <p className="text-[12px] font-bold leading-tight">{shownBar.value}%</p>
        <p className="text-[8px] text-white/75 leading-tight">{fmt(toMs(shownBar.date), true)} · {testsLabel(shownBar.tests)}</p>
      </div>
    </div>
  );
}

// ─── Radar ─────────────────────────────────────────────────────────────────────

export function Radar({ axes }: { axes: { label: string; value: number }[] }) {
  const n = axes.length;
  if (n < 3) return null;

  const cx = 130;
  const cy = 112;
  const R = 74;
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i: number, r: number) => ({ x: cx + Math.cos(angle(i)) * r, y: cy + Math.sin(angle(i)) * r });
  const ring = (f: number) => axes.map((_, i) => pt(i, R * f)).map((p) => `${p.x},${p.y}`).join(' ');
  const shape = axes.map((a, i) => pt(i, R * (Math.min(100, a.value) / 100))).map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <svg viewBox="0 0 260 226" className="w-full h-auto max-w-[360px] mx-auto block">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill={f === 1 ? '#F4F7FB' : 'none'} stroke="#DCE4EE" strokeWidth="1" />
      ))}
      {axes.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#DCE4EE" />;
      })}
      <polygon
        points={shape}
        fill="#C5A028"
        fillOpacity="0.28"
        stroke="#C5A028"
        strokeWidth="2"
        strokeLinejoin="round"
        className="perf-fade"
      />
      {axes.map((a, i) => {
        const p = pt(i, R * (Math.min(100, a.value) / 100));
        const l = pt(i, R + 16);
        const label = a.label.length > 11 ? `${a.label.slice(0, 10)}…` : a.label;
        return (
          <g key={a.label}>
            <circle cx={p.x} cy={p.y} r="3" fill="#1B3A5C" />
            <text x={l.x} y={l.y} fontSize="8.5" fill="#1B3A5C" fontWeight="600" textAnchor={l.x < cx - 4 ? 'end' : l.x > cx + 4 ? 'start' : 'middle'}>
              {label}
            </text>
            <text x={l.x} y={l.y + 10} fontSize="8" fill="#94a3b8" textAnchor={l.x < cx - 4 ? 'end' : l.x > cx + 4 ? 'start' : 'middle'}>
              {a.value}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
