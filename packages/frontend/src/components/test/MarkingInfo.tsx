/**
 * Marking-scheme helpers shared by the test list, the test screen, the results page
 * and the dashboard, so every screen explains scores the same way.
 *
 * marks = correct x marksPerQuestion - wrong x marksPerQuestion x negativeMarkingRatio
 * percentage = marks / (questions x marksPerQuestion) x 100
 */

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

/** Marks lost per wrong answer, e.g. 0.25 */
export const deductionPerWrong = (ratio: number, marksPerQuestion = 1): number => ratio * marksPerQuestion;

/** "−0.25 per wrong answer" / "No negative marking" */
export function negativeLabel(ratio: number | undefined | null, isHi: boolean, marksPerQuestion = 1): string {
  const r = Number(ratio ?? 0);
  if (!(r > 0)) return isHi ? 'कोई नेगेटिव मार्किंग नहीं' : 'No negative marking';
  const d = fmt(deductionPerWrong(r, marksPerQuestion));
  return isHi ? `हर गलत जवाब पर −${d}` : `−${d} per wrong answer`;
}

/** Small pill: ⚠ −0.25 / wrong   or   ✓ No negative marking */
export function NegativeMarkingChip({
  ratio,
  isHi,
  marksPerQuestion = 1,
  tone = 'light',
}: {
  ratio: number | undefined | null;
  isHi: boolean;
  marksPerQuestion?: number;
  tone?: 'light' | 'dark';
}) {
  const has = Number(ratio ?? 0) > 0;
  const cls = has
    ? tone === 'dark' ? 'bg-accent/30 text-red-100' : 'bg-accent-50 text-accent-700'
    : tone === 'dark' ? 'bg-success/25 text-green-100' : 'bg-green-50 text-green-700';
  const text = has
    ? (isHi ? `−${fmt(deductionPerWrong(Number(ratio), marksPerQuestion))} / गलत` : `−${fmt(deductionPerWrong(Number(ratio), marksPerQuestion))} / wrong`)
    : (isHi ? 'नेगेटिव नहीं' : 'No negative');
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${cls}`}>
      {has ? '⚠' : '✓'} {text}
    </span>
  );
}

/** One-line worked example: "3 correct − 2 wrong × 0.25 = 2.5 of 5 marks → 50%". */
export function marksFormula({
  correct,
  wrong,
  ratio,
  marksPerQuestion = 1,
  totalQuestions,
  percentage,
  isHi,
}: {
  correct: number;
  wrong: number;
  ratio: number | undefined | null;
  marksPerQuestion?: number;
  totalQuestions: number;
  percentage: number;
  isHi: boolean;
}): string {
  const r = Number(ratio ?? 0);
  const max = totalQuestions * marksPerQuestion;
  const gained = correct * marksPerQuestion;
  const lost = wrong * deductionPerWrong(r, marksPerQuestion);
  const marks = Math.max(0, gained - lost);
  if (!(r > 0)) {
    return isHi
      ? `${correct} सही = ${fmt(marks)} / ${fmt(max)} अंक → ${percentage}% (कोई नेगेटिव मार्किंग नहीं)`
      : `${correct} correct = ${fmt(marks)} of ${fmt(max)} marks → ${percentage}% (no negative marking)`;
  }
  const d = fmt(deductionPerWrong(r, marksPerQuestion));
  return isHi
    ? `${fmt(gained)} (${correct} सही) − ${fmt(lost)} (${wrong} गलत × ${d}) = ${fmt(marks)} / ${fmt(max)} अंक → ${percentage}%`
    : `${fmt(gained)} (${correct} correct) − ${fmt(lost)} (${wrong} wrong × ${d}) = ${fmt(marks)} of ${fmt(max)} marks → ${percentage}%`;
}
