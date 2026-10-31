/** Shield + star mark, drawn inline so the page needs no image files. */
export function BrandMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#EFD783" />
          <stop offset="1" stopColor="#C5A028" />
        </linearGradient>
      </defs>
      <path d="M24 3 6 9.5v13.2C6 33.6 13.4 42.2 24 45c10.6-2.8 18-11.4 18-22.3V9.5L24 3Z" fill="url(#bm-g)" />
      <path d="M24 12.5l3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1 3.1-6.3Z" fill="#1B3A5C" />
    </svg>
  );
}
