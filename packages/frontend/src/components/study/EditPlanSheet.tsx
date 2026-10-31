import { useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { fmtMin } from './planTime';

interface BTest {
  id: string; titleEn: string; titleHi: string; topicId: string | null;
  questionCount: number; durationMinutes: number; estimatedMinutes: number;
  attemptCount: number; bestPercentage: number | null; passed: boolean; locked: boolean;
}
interface BTopic { id: string; nameEn: string; nameHi: string; done: boolean; estimatedMinutes: number; accuracy: number | null; attempted: boolean }
interface BSubject { id: string; nameEn: string; nameHi: string; accuracy: number | null; topicsDone: number; topicsTotal: number; topics: BTopic[]; tests: BTest[] }
type Reason = 'weak' | 'retake' | 'continue' | 'next' | 'practice';

const BUDGETS = [30, 60, 90, 120, 180, 240];
const WEAK_BELOW = 60;

const REASON: Record<Reason, { en: string; hi: string; cls: string }> = {
  weak: { en: 'Weak, revise', hi: 'कमज़ोर, दोहराएं', cls: 'bg-accent-100 text-accent-700' },
  retake: { en: 'Retake', hi: 'फिर से दें', cls: 'bg-accent-50 text-accent-600' },
  continue: { en: 'Continue', hi: 'जारी रखें', cls: 'bg-secondary-100 text-secondary-700' },
  next: { en: 'Next up', hi: 'अगला', cls: 'bg-primary-50 text-primary' },
  practice: { en: 'Practice', hi: 'प्रैक्टिस', cls: 'bg-green-50 text-green-700' },
};

/**
 * "Edit today's plan": pick topics and tests, see the total time as you go, or let the app fill the
 * time you have with what helps most (weak topics first). Starts from today's saved plan.
 */
export function EditPlanSheet({ isHi, onClose, onSaved }: { isHi: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const L = (en: string, hi: string) => (isHi ? hi : en);
  const [subjects, setSubjects] = useState<BSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [topicSel, setTopicSel] = useState<Set<string>>(new Set());
  const [testSel, setTestSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, Reason>>({});
  const [budget, setBudget] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/study-plan/builder')
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data as { subjects: BSubject[]; todaySelected: { topicIds: string[]; testIds: string[] } };
        setSubjects(data.subjects);
        // start from what is already planned for today
        const topics = new Set(data.todaySelected.topicIds);
        const tests = new Set(data.todaySelected.testIds);
        setTopicSel(topics);
        setTestSel(tests);
        setOpen(new Set(data.subjects.filter((s) => s.topics.some((t) => topics.has(t.id)) || s.tests.some((t) => tests.has(t.id))).map((s) => s.id)));
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const topicMin = useMemo(() => new Map(subjects.flatMap((s) => s.topics.map((t) => [t.id, t.estimatedMinutes] as const))), [subjects]);
  const testMin = useMemo(() => new Map(subjects.flatMap((s) => s.tests.map((t) => [t.id, t.estimatedMinutes] as const))), [subjects]);
  const totalMinutes = [...topicSel].reduce((a, id) => a + (topicMin.get(id) ?? 0), 0) + [...testSel].reduce((a, id) => a + (testMin.get(id) ?? 0), 0);
  const picked = topicSel.size + testSel.size;
  const over = budget != null && totalMinutes > budget;

  const flip = (set: Set<string>, id: string) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); return n; };
  const pickedIn = (s: BSubject) => s.topics.filter((t) => topicSel.has(t.id)).length + s.tests.filter((t) => testSel.has(t.id)).length;
  const selectable = (t: BTopic) => !t.done || (t.accuracy != null && t.accuracy < WEAK_BELOW);

  const toggleAllTopics = (s: BSubject) => {
    const ids = s.topics.filter(selectable).map((t) => t.id);
    const all = ids.length > 0 && ids.every((id) => topicSel.has(id));
    setTopicSel((prev) => { const n = new Set(prev); ids.forEach((id) => (all ? n.delete(id) : n.add(id))); return n; });
    if (!all) setOpen((prev) => new Set(prev).add(s.id));
  };

  const autoPlan = async () => {
    if (budget == null) return;
    setSuggesting(true);
    setNote(null);
    setError('');
    try {
      const res = await api.get('/api/study-plan/suggest', { params: { minutes: budget } });
      const d = res.data.data as { minutes: number; topicIds: string[]; testIds: string[]; reasons: Record<string, Reason> };
      setTopicSel(new Set(d.topicIds));
      setTestSel(new Set(d.testIds));
      setReasons(d.reasons);
      const weak = d.topicIds.filter((id) => d.reasons[id] === 'weak').length;
      setOpen(new Set(subjects.filter((s) => s.topics.some((t) => d.topicIds.includes(t.id)) || s.tests.some((t) => d.testIds.includes(t.id))).map((s) => s.id)));
      setNote(d.topicIds.length + d.testIds.length === 0
        ? L('Nothing fits in this time. Try a longer time.', 'इतने समय में कुछ नहीं आ पाया। थोड़ा ज़्यादा समय चुनें।')
        : L(`Plan ready: ${d.topicIds.length} topics + ${d.testIds.length} tests, about ${fmtMin(d.minutes, false)}${weak ? `. ${weak} weak topic${weak > 1 ? 's' : ''} first.` : '.'} You can change anything.`,
            `प्लान तैयार: ${d.topicIds.length} टॉपिक + ${d.testIds.length} टेस्ट, लगभग ${fmtMin(d.minutes, true)}${weak ? `। पहले ${weak} कमज़ोर टॉपिक।` : '।'} आप कुछ भी बदल सकते हैं।`));
    } catch {
      setError(L('Could not make a plan. Try again.', 'प्लान नहीं बन सका, फिर कोशिश करें।'));
    } finally {
      setSuggesting(false);
    }
  };

  const clearAll = () => { setTopicSel(new Set()); setTestSel(new Set()); setReasons({}); setNote(null); };

  const save = async () => {
    const items = subjects
      .map((s) => ({
        subjectId: s.id,
        topicIds: s.topics.filter((t) => topicSel.has(t.id)).map((t) => t.id),
        testIds: s.tests.filter((t) => testSel.has(t.id)).map((t) => t.id),
      }))
      .filter((i) => i.topicIds.length + i.testIds.length > 0)
      .map((i) => ({ ...i, durationMinutes: 1 })); // the server works out the real time
    if (items.length === 0) { setError(L('Pick at least one topic or test', 'कम से कम एक टॉपिक या टेस्ट चुनें')); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/api/study-plan/create-today', { items });
      await onSaved();
    } catch {
      setError(L('Could not save the plan', 'योजना सहेजने में विफल'));
      setSaving(false);
    }
  };

  const Tag = ({ id }: { id: string }) => {
    const r = reasons[id];
    return r ? <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] lg:text-[11px] font-bold ${REASON[r].cls}`}>{isHi ? REASON[r].hi : REASON[r].en}</span> : null;
  };

  const testRow = (s: BSubject, t: BTest) => (
    <label key={t.id} className={`flex items-center gap-2 py-1.5 px-1 rounded-lg ${t.locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-primary-50/60'}`}>
      <input type="checkbox" disabled={t.locked} checked={testSel.has(t.id)} onChange={() => setTestSel(flip(testSel, t.id))} className="w-4 h-4 rounded accent-primary shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] lg:text-sm text-gray-700 truncate">📝 {isHi ? t.titleHi : t.titleEn}</span>
        <span className="block text-[9px] lg:text-xs text-gray-400 tabular-nums">
          {t.questionCount} {L('Q', 'प्रश्न')} · {t.durationMinutes} {L('min', 'मि')}
          {t.attemptCount > 0 && <> · {t.bestPercentage != null ? `${t.bestPercentage}% · ` : ''}{t.attemptCount}/5 {L('tries', 'प्रयास')}</>}
        </span>
      </span>
      <Tag id={t.id} />
      {t.locked
        ? <span className="text-[9px] lg:text-[11px] text-gray-400 font-semibold shrink-0">{L('5/5 used', '5/5 पूरे')}</span>
        : t.attemptCount > 0 && !t.passed && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-accent-50 text-accent-600 text-[9px] lg:text-[11px] font-bold">{L('not passed', 'पास नहीं')}</span>}
      <span className="shrink-0 text-[10px] lg:text-xs font-semibold text-primary-400 tabular-nums w-12 text-right">~{fmtMin(t.estimatedMinutes, isHi)}</span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-primary-900/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label={L('Edit today\'s plan', 'आज की योजना बनाएं')}>
      <div className="bg-white w-full h-[94vh] sm:h-auto sm:max-h-[92vh] sm:max-w-2xl rounded-t-[28px] sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-2.5 pb-1 shrink-0 sm:hidden"><span className="w-10 h-1.5 rounded-full bg-primary-100" /></div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-1 pb-3 border-b border-primary-50 shrink-0">
          <div>
            <h2 className="text-base lg:text-lg font-extrabold text-primary">{L("Plan today's study", 'आज की योजना बनाएं')}</h2>
            <p className="text-[11px] lg:text-sm text-gray-400">{L('Pick what you will do, or let the app plan it for you', 'खुद चुनें, या ऐप से प्लान बनवाएं')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-50 active:scale-95 transition-transform text-primary-400 text-lg leading-none" aria-label={L('Close', 'बंद करें')}>×</button>
        </div>

        {/* Time budget + auto plan */}
        <div className="px-4 pt-3 pb-3 bg-secondary-50/60 border-b border-secondary-100 shrink-0 space-y-2.5">
          <p className="text-xs lg:text-sm font-bold text-primary">⏱ {L('How much time do you have today?', 'आज कितना समय है?')}</p>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
            {BUDGETS.map((m) => (
              <button key={m} type="button" onClick={() => setBudget(budget === m ? null : m)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs lg:text-sm font-bold border transition-colors ${budget === m ? 'bg-primary text-white border-primary' : 'bg-white text-primary-400 border-primary-100'}`}>
                {fmtMin(m, isHi)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={autoPlan} disabled={budget == null || suggesting || loading}
              className="flex-1 p-btn !py-2.5 disabled:opacity-40">
              {suggesting ? '…' : `✨ ${L('Auto-plan for me', 'मेरे लिए प्लान बनाओ')}`}
            </button>
            {picked > 0 && <button type="button" onClick={clearAll} className="p-btn-ghost !px-3">{L('Clear', 'हटाएं')}</button>}
          </div>
          {budget == null && <p className="text-[10px] lg:text-xs text-gray-500">{L('Pick your time, then tap Auto-plan: weak topics first, then tests you can improve.', 'समय चुनें, फिर ऑटो-प्लान दबाएं: पहले कमज़ोर टॉपिक, फिर वे टेस्ट जिनमें सुधार हो सकता है।')}</p>}
          {note && <p className="text-[11px] lg:text-sm text-primary-700 bg-white rounded-xl border border-secondary-100 px-3 py-2 leading-snug">{note}</p>}
        </div>

        {/* Live total */}
        <div className={`px-4 py-2 flex items-center justify-between gap-3 text-xs lg:text-sm shrink-0 border-b ${over ? 'bg-accent-50 border-accent-100' : 'bg-white border-primary-50'}`}>
          <span className="font-bold text-primary tabular-nums">
            📚 {topicSel.size} {L('topics', 'टॉपिक')} · 📝 {testSel.size} {L('tests', 'टेस्ट')}
          </span>
          <span className={`font-extrabold tabular-nums ${over ? 'text-accent-600' : 'text-secondary-700'}`}>
            ⏱ ~{fmtMin(totalMinutes, isHi)}{budget != null && <span className="font-semibold text-gray-400"> / {fmtMin(budget, isHi)}</span>}
          </span>
        </div>
        {over && <p className="px-4 py-1.5 text-[11px] lg:text-xs text-accent-600 bg-accent-50 shrink-0">{L(`This is ${fmtMin(totalMinutes - (budget ?? 0), false)} more than your time. Remove something or pick a longer time.`, `यह आपके समय से ${fmtMin(totalMinutes - (budget ?? 0), true)} ज़्यादा है। कुछ हटाएं या ज़्यादा समय चुनें।`)}</p>}

        {/* Subjects */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
          ) : loadError ? (
            <p className="text-sm text-accent-600 text-center py-8">{L('Could not load subjects', 'विषय लोड नहीं हो सके')}</p>
          ) : subjects.map((s) => {
            const n = pickedIn(s);
            const isOpen = open.has(s.id);
            const weakSubject = s.accuracy != null && s.accuracy < WEAK_BELOW;
            const looseTests = s.tests.filter((t) => !t.topicId || !s.topics.some((tp) => tp.id === t.topicId));
            const ids = s.topics.filter(selectable).map((t) => t.id);
            const allPicked = ids.length > 0 && ids.every((id) => topicSel.has(id));
            return (
              <div key={s.id} className={`rounded-2xl border overflow-hidden transition-colors ${n > 0 ? 'border-secondary bg-secondary-50/40' : 'border-primary-50 bg-white shadow-sm'}`}>
                <button type="button" className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setOpen(flip(open, s.id))} aria-expanded={isOpen}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm lg:text-base font-bold text-gray-900 truncate">{isHi ? s.nameHi : s.nameEn}</span>
                    <span className="block text-[10px] lg:text-xs text-gray-400 tabular-nums">
                      {s.topicsDone}/{s.topicsTotal} {L('topics done', 'टॉपिक पूरे')}
                      {s.accuracy != null && <> · <span className={weakSubject ? 'text-accent-600 font-bold' : 'text-green-700 font-semibold'}>{s.accuracy}% {L('score', 'स्कोर')}</span></>}
                    </span>
                  </span>
                  {n > 0 && <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] lg:text-xs font-bold">{n} {L('picked', 'चुने')}</span>}
                  <span className={`text-primary-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {isOpen && (
                  <div className="border-t border-primary-50 bg-white px-3 py-2 space-y-1">
                    {ids.length > 0 && (
                      <button type="button" onClick={() => toggleAllTopics(s)} className="text-[11px] lg:text-xs font-bold text-primary-400 underline underline-offset-2">
                        {allPicked ? L('Remove all topics', 'सभी टॉपिक हटाएं') : L('Select all topics', 'सभी टॉपिक चुनें')}
                      </button>
                    )}
                    {s.topics.map((t) => {
                      const weak = t.accuracy != null && t.accuracy < WEAK_BELOW;
                      const ok = selectable(t);
                      const myTests = s.tests.filter((x) => x.topicId === t.id);
                      return (
                        <div key={t.id} className="pt-1">
                          <label className={`flex items-center gap-2 py-1 px-1 rounded-lg ${ok ? 'cursor-pointer hover:bg-primary-50/60' : 'cursor-default'}`}>
                            {ok
                              ? <input type="checkbox" checked={topicSel.has(t.id)} onChange={() => setTopicSel(flip(topicSel, t.id))} className="w-4 h-4 rounded accent-primary shrink-0" />
                              : <span className="w-4 h-4 rounded bg-success flex items-center justify-center shrink-0 text-white text-[10px]">✓</span>}
                            <span className={`flex-1 min-w-0 text-xs lg:text-sm font-semibold truncate ${ok ? 'text-gray-800' : 'text-green-700'}`}>📚 {isHi ? t.nameHi : t.nameEn}</span>
                            <Tag id={t.id} />
                            {weak && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-accent-50 text-accent-600 text-[9px] lg:text-[11px] font-bold">{L('weak', 'कमज़ोर')} {t.accuracy}%</span>}
                            {t.done && !weak && <span className="shrink-0 text-[9px] lg:text-[11px] text-green-700 font-semibold">{L('Done', 'पूर्ण')}</span>}
                            {ok && <span className="shrink-0 text-[10px] lg:text-xs font-semibold text-primary-400 tabular-nums w-12 text-right">~{fmtMin(t.estimatedMinutes, isHi)}</span>}
                          </label>
                          {myTests.length > 0 && <div className="ml-6 border-l border-primary-50 pl-2">{myTests.map((x) => testRow(s, x))}</div>}
                        </div>
                      );
                    })}
                    {looseTests.length > 0 && (
                      <div className="pt-2 border-t border-primary-50">
                        <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase mb-1">{L('Other tests', 'अन्य टेस्ट')}</p>
                        {looseTests.map((x) => testRow(s, x))}
                      </div>
                    )}
                    {s.topics.length === 0 && s.tests.length === 0 && <p className="text-[11px] text-gray-400 py-2">{L('No topics or tests yet', 'अभी कोई टॉपिक/टेस्ट नहीं')}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Save (always visible) */}
        <div className="px-4 py-3 border-t border-primary-50 bg-white shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {error && <p role="alert" className="text-xs text-accent-600 mb-2 text-center">{error}</p>}
          <button onClick={save} disabled={saving || loading || picked === 0} className="p-btn w-full !py-3.5 !text-sm !rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? L('Saving…', 'सहेज रहे हैं…') : picked === 0 ? L('Pick something to save', 'सहेजने के लिए कुछ चुनें') : `${L('Save plan', 'योजना सहेजें')} · ~${fmtMin(totalMinutes, isHi)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
