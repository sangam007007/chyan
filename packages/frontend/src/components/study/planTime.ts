/** "35 मि" / "1 घंटा 35 मि" and "35 min" / "1h 35m" */
export function fmtMin(m: number, isHi: boolean): string {
  const mins = Math.max(0, Math.round(m));
  if (mins < 60) return isHi ? `${mins} मि` : `${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  if (isHi) return r ? `${h} घंटा ${r} मि` : `${h} घंटा`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** When you would finish if you started now, e.g. "7:40 PM" */
export function finishTime(remainingMin: number, isHi: boolean): string {
  const d = new Date(Date.now() + remainingMin * 60000);
  return d.toLocaleTimeString(isHi ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}
