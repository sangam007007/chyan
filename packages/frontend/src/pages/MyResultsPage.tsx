import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { PageHero } from '@/components/ui/premium';
import { timeAgo } from '@/components/test/ResultRow';
import { PageErrorBoundary } from '@/components/common/PageErrorBoundary';

type Status = 'all' | 'passed' | 'failed' | 'not_attempted';
type Kind = 'all' | 'topic' | 'subject_full' | 'mock';
type RealKind = Exclude<Kind, 'all'>;
/** The two worlds: topic tests (Study tab / Subject section) vs the other Test-tab tests (Subject Full + Mocks) */
type Group = 'topic' | 'test';

interface AttemptRow {
  attemptId: string;
  attemptNumber: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  wrongCount: number;
  submittedAt: string;
}

interface TestItem {
  testId: string | null;
  slotNumber: number | null;
  titleEn: string;
  titleHi: string;
  kind: RealKind;
  subjectId: string | null;
  subjectNameEn: string | null;
  subjectNameHi: string | null;
  topicId: string | null;
  topicNameEn: string | null;
  topicNameHi: string | null;
  status: Exclude<Status, 'all'>;
  attemptCount: number;
  maxAttempts: number;
  bestPercentage: number | null;
  passedOnAttempt: number | null;
  bestAttemptNumber: number | null;
  attempts: AttemptRow[];
}

interface Stats { total: number; attempted: number; notAttempted: number; passed: number; failed: number; attempts: number }
interface Facets { status: Record<Exclude<Status, 'all'>, number> & { all: number }; kinds: Record<RealKind, number> }
interface Opt { id: string; nameEn: string; nameHi: string; count?: number }

const KINDS: { id: RealKind; en: string; hi: string; cls: string }[] = [
  { id: 'topic', en: 'Topic', hi: 'टॉपिक', cls: 'bg-primary-100 text-primary-600' },
  { id: 'subject_full', en: 'Subject Full', hi: 'विषय पूर्ण', cls: 'bg-secondary-100 text-secondary-700' },
  { id: 'mock', en: 'Mock', hi: 'मॉक', cls: 'bg-primary text-white' },
];

/**
 * MyResultsPage — progress through the Test tab's tests (the Subject section is the very same set of tests
 * as the Study tab's topic tests, plus Subject Full tests and Full Mocks): one row per test with its attempts
 * inside, including the tests not attempted yet, which can be started from here.
 */
function MyResultsContent() {
  const { language } = useTranslation();
  const hi = language === 'hi';
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [group, setGroup] = useState<Group>(params.get('group') === 'test' ? 'test' : 'topic');
  const [groupCounts, setGroupCounts] = useState<Record<Group, number> | null>(null);
  const [status, setStatus] = useState<Status>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [sort, setSort] = useState<'sequence' | 'recent'>(params.get('sort') === 'recent' ? 'recent' : 'sequence');

  const [items, setItems] = useState<TestItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [overall, setOverall] = useState<Stats | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [topics, setTopics] = useState<Opt[]>([]);
  // Names seen so far, so a selected subject/topic stays selectable even when it has 0 tests under the other filters
  const [known, setKnown] = useState<Record<string, Opt>>({});
  const [loading, setLoading] = useState(true);
  // Filters the numbers on screen were calculated for; while it differs from the current filters they are stale
  const [dataKey, setDataKey] = useState('');
  const filterKey = [group, status, kind, subjectId, topicId].join('|');
  const stale = dataKey !== filterKey;
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const qs = new URLSearchParams({ sort, group });
    if (status !== 'all') qs.set('status', status);
    if (kind !== 'all') qs.set('kind', kind);
    if (subjectId) qs.set('subjectId', subjectId);
    if (topicId) qs.set('topicId', topicId);
    api.get(`/api/attempts/mine?${qs.toString()}`)
      .then((res) => {
        if (cancelled) return;
        const d = res.data?.data;
        setDataKey([group, status, kind, subjectId, topicId].join('|'));
        setItems(d.items);
        setStats(d.stats);
        setOverall(d.overall);
        setGroupCounts(d.groupCounts);
        setFacets(d.facets);
        setSubjects(d.subjects ?? []);
        setTopics(d.topics ?? []);
        setKnown((k) => {
          const next = { ...k };
          for (const o of [...(d.subjects ?? []), ...(d.topics ?? [])] as Opt[]) next[o.id] = o;
          return next;
        });
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [group, status, kind, subjectId, topicId, sort]);

  // The status pills are sections of the chosen toggle: their counts stay the group's totals
  // (same numbers as the top card) whatever subject / topic / type is picked below.
  const pillCount = (id: Status): number | undefined =>
    !overall ? undefined : id === 'all' ? overall.total : id === 'passed' ? overall.passed : id === 'failed' ? overall.failed : overall.notAttempted;

  const optName = (o: Opt) => (hi ? o.nameHi : o.nameEn);
  const withSelected = (list: Opt[], id: string): Opt[] =>
    id && !list.some((o) => o.id === id) && known[id] ? [...list, { ...known[id], count: 0 }] : list;
  const subjectOptions = withSelected(subjects, subjectId);
  const topicOptions = withSelected(topics, topicId);
  const showTopicFilter = !!subjectId && (kind === 'all' || kind === 'topic') && topicOptions.length > 0;
  const availableKinds = facets ? KINDS.filter((k) => facets.kinds[k.id] > 0 || kind === k.id) : [];
  const kindsTotal = facets ? facets.kinds.topic + facets.kinds.subject_full + facets.kinds.mock : 0;
  const kindInfo = (id: RealKind) => KINDS.find((k) => k.id === id) ?? KINDS[0];

  // Switching between topic tests and Test-tab tests starts a clean view
  const pickGroup = (g: Group) => {
    if (g === group) return;
    setGroup(g);
    setStatus('all'); setKind('all'); setSubjectId(''); setTopicId(''); setOpen(null);
    // Never keep showing the other group's numbers while the new ones load
    setItems([]); setStats(null); setOverall(null); setFacets(null); setSubjects([]); setTopics([]);
    setLoading(true);
  };

  const pickSubject = (id: string) => { setSubjectId(id); setTopicId(''); setOpen(null); };
  const pickKind = (k: Kind) => { setKind(k); if (k === 'subject_full' || k === 'mock') setTopicId(''); setOpen(null); };

  // What the numbers in the header are about
  const scopeLabel = (() => {
    if (kind === 'mock') return hi ? 'मॉक टेस्ट' : 'Mock tests';
    const sj = subjectId ? known[subjectId] : null;
    const tp = topicId ? known[topicId] : null;
    if (sj && tp) return `${optName(sj)} › ${optName(tp)}`;
    if (sj) return `${optName(sj)}${kind === 'subject_full' ? (hi ? ' · विषय पूर्ण' : ' · Full tests') : ''}`;
    if (kind === 'subject_full') return hi ? 'विषय पूर्ण टेस्ट' : 'Subject Full tests';
    return hi ? 'सभी टेस्ट' : 'All tests';
  })();

  const start = async (t: TestItem) => {
    const key = t.testId ?? `${t.subjectId}:${t.slotNumber}`;
    if (t.testId) { navigate(`/tests/${t.testId}/attempt`); return; }
    setStarting(key);
    try {
      const res = await api.post('/api/tests/full-test-generate', { subjectId: t.subjectId, slotNumber: t.slotNumber });
      const id = res.data?.data?.testId;
      if (id) navigate(`/tests/${id}/attempt`);
    } catch { setError(true); }
    setStarting(null);
  };

  const STATUS_PILLS: { id: Status; en: string; hi: string }[] = [
    { id: 'all', en: 'All', hi: 'सभी' },
    { id: 'passed', en: 'Passed', hi: 'पास' },
    { id: 'failed', en: 'Failed', hi: 'फेल' },
    { id: 'not_attempted', en: 'Left', hi: 'बाकी' },
  ];

  const tileSet = (st: Stats, light = true) => [
    { id: 'all' as Status, v: st.total, l: hi ? 'कुल टेस्ट' : 'Total tests', tone: light ? 'text-white' : 'text-primary' },
    { id: 'passed' as Status, v: st.passed, l: hi ? 'पास' : 'Passed', tone: light ? 'text-green-200' : 'text-green-600' },
    { id: 'failed' as Status, v: st.failed, l: hi ? 'फेल' : 'Failed', tone: light ? 'text-red-200' : 'text-accent-600' },
    { id: 'not_attempted' as Status, v: st.notAttempted, l: hi ? 'बाकी' : 'Left', tone: light ? 'text-secondary-200' : 'text-secondary-600' },
  ];
  const showScope = !!(subjectId || topicId || kind !== 'all');

  // Group headers only in sequence order (in "recent" order the rows are a flat timeline)
  const groupKey = (t: TestItem) => (t.kind === 'mock' ? 'mock' : `${t.subjectId}|${t.kind === 'topic' ? t.topicId : 'full'}`);
  const groupLabel = (t: TestItem) => {
    if (t.kind === 'mock') return hi ? 'फुल मॉक टेस्ट' : 'Full mock tests';
    const sj = hi ? t.subjectNameHi : t.subjectNameEn;
    if (t.kind === 'subject_full') return `${sj} · ${hi ? 'विषय पूर्ण' : 'Full tests'}`;
    const tp = hi ? t.topicNameHi : t.topicNameEn;
    return subjectId ? `${tp}` : `${sj} › ${tp}`;
  };

  return (
    <div className="pb-28">
      <PageHero
        title={hi ? 'मेरे परिणाम' : 'My Results'}
        subtitle={overall
          ? (group === 'topic'
            ? (hi ? `सभी विषय · ${overall.attempts} प्रयास` : `All subjects · ${overall.attempts} attempts`)
            : (hi ? `विषय पूर्ण और मॉक · ${overall.attempts} प्रयास` : `Subject Full & Mocks · ${overall.attempts} attempts`))
          : undefined}
        left={
          <button
            onClick={() => navigate('/tests')}
            aria-label={hi ? 'वापस' : 'Back'}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 border border-white/10 backdrop-blur"
          >
            <span className="text-white text-lg">←</span>
          </button>
        }
      >
        {/* Which tests are we looking at? Everything below follows this toggle. */}
        <div className="flex bg-white/10 border border-white/10 rounded-2xl p-1 mb-3 backdrop-blur" role="tablist">
          {([
            { id: 'topic' as Group, icon: '🧩', en: 'Topic tests', hi: 'टॉपिक टेस्ट' },
            { id: 'test' as Group, icon: '📝', en: 'Test tab tests', hi: 'टेस्ट टैब के टेस्ट' },
          ]).map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={group === g.id}
              onClick={() => pickGroup(g.id)}
              className={`flex-1 py-2 text-[11px] font-semibold rounded-xl transition-all whitespace-nowrap ${group === g.id ? 'bg-secondary text-primary-800 shadow' : 'text-white/70'}`}
            >
              {g.icon} {hi ? g.hi : g.en}{groupCounts && <span className="opacity-70 tabular-nums"> {groupCounts[g.id]}</span>}
            </button>
          ))}
        </div>

        {(
          <div className={`grid grid-cols-4 gap-2 ${loading && overall ? 'opacity-50' : ''}`}>
            {tileSet(overall ?? { total: 0, passed: 0, failed: 0, notAttempted: 0, attempted: 0, attempts: 0 }).map((x) => (
              <div key={x.l} className="rounded-2xl bg-white/10 border border-white/10 py-2.5 text-center backdrop-blur">
                <p className={`text-lg font-extrabold tabular-nums leading-tight ${x.tone}`}>{overall ? x.v : '–'}</p>
                <p className="text-[9px] text-white/65 leading-tight px-0.5">{x.l}</p>
              </div>
            ))}
          </div>
        )}
      </PageHero>

      <div className="px-4 lg:px-0 mt-4 lg:mt-5 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[340px_1fr] xl:grid-cols-[400px_1fr] lg:gap-5 lg:items-start">
        {/* Filters + summary: a side panel on desktop */}
        <div className="space-y-3 lg:sticky lg:top-20">
        {/* Status + subject */}
        <div className="flex items-center gap-2 lg:flex-wrap">
          <div className="flex bg-primary-50 rounded-full p-0.5 shrink-0">
            {STATUS_PILLS.map((f) => (
              <button
                key={f.id}
                onClick={() => { setStatus(f.id); setOpen(null); }}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-full transition-all whitespace-nowrap ${status === f.id ? 'bg-primary text-white shadow' : 'text-primary-400'}`}
              >
                {hi ? f.hi : f.en}{overall && <span className={`tabular-nums ${loading ? 'opacity-30' : 'opacity-60'}`}> {pillCount(f.id)}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subjectOptions.length > 0 && (
            <select
              value={subjectId}
              onChange={(e) => pickSubject(e.target.value)}
              aria-label={hi ? 'विषय चुनें' : 'Choose subject'}
              className="p-select !py-1.5 !text-[11px] flex-1 min-w-0"
            >
              <option value="">{hi ? 'सभी विषय' : 'All subjects'}</option>
              {subjectOptions.map((s) => <option key={s.id} value={s.id}>{optName(s)}{stale ? '' : ` (${s.count ?? 0})`}</option>)}
            </select>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as 'sequence' | 'recent')}
            aria-label={hi ? 'क्रम' : 'Order'}
            className="p-select !py-1.5 !text-[11px] shrink-0"
          >
            <option value="sequence">{hi ? 'क्रम से' : 'In order'}</option>
            <option value="recent">{hi ? 'हाल का पहले' : 'Recent first'}</option>
          </select>
        </div>

        {showTopicFilter && (
          <select
            value={topicId}
            onChange={(e) => { setTopicId(e.target.value); setOpen(null); }}
            aria-label={hi ? 'टॉपिक चुनें' : 'Choose topic'}
            className="p-select !py-1.5 !text-[11px] w-full"
          >
            <option value="">{hi ? 'सभी टॉपिक' : 'All topics'}</option>
            {topicOptions.map((t) => <option key={t.id} value={t.id}>{optName(t)}{stale ? '' : ` (${t.count ?? 0})`}</option>)}
          </select>
        )}

        {/* Type of test (hidden when there is only one kind to choose) */}
        {(availableKinds.length > 1 || kind !== 'all') && (
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex gap-1.5 w-max">
              {[{ id: 'all' as Kind, en: 'All types', hi: 'सभी प्रकार', n: kindsTotal }, ...availableKinds.map((k) => ({ id: k.id as Kind, en: k.en, hi: k.hi, n: facets!.kinds[k.id] }))].map((k) => (
                <button
                  key={k.id}
                  onClick={() => pickKind(k.id)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-all ${kind === k.id ? 'bg-secondary text-primary-800 border-secondary shadow' : 'bg-white text-primary-500 border-primary-100'}`}
                >
                  {hi ? k.hi : k.en} {!stale && <span className="opacity-60 tabular-nums">{k.n}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary of what is selected (subject / topic / type).
            With All it shows the four numbers; inside Passed / Failed / Left it shows only that section's count. */}
        {showScope && stale && (
          <div className="p-card p-3 animate-pulse">
            <div className="h-3 w-1/3 rounded-full bg-primary-50 mb-3" />
            <div className="h-10 rounded-2xl bg-primary-50" />
          </div>
        )}
        {showScope && stats && !stale && (
          <div className="p-card p-3">
            {status === 'all' ? (
              <>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] font-bold text-primary truncate">{scopeLabel}</p>
                  <p className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                    {hi ? `${stats.attempted}/${stats.total} दिए · ${stats.attempts} प्रयास` : `${stats.attempted}/${stats.total} attempted · ${stats.attempts} attempts`}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {tileSet(stats, false).map((x) => (
                    <div key={x.l} className="rounded-2xl bg-primary-50/70 py-2 text-center">
                      <p className={`text-base font-extrabold tabular-nums leading-tight ${x.tone}`}>{x.v}</p>
                      <p className="text-[9px] text-gray-500 leading-tight">{x.l}</p>
                    </div>
                  ))}
                </div>
                <div className="h-1.5 rounded-full bg-primary-50 overflow-hidden mt-2.5">
                  <div className="h-full rounded-full bg-gradient-to-r from-secondary-500 to-secondary-200" style={{ width: `${stats.total ? Math.round((stats.attempted / stats.total) * 100) : 0}%` }} />
                </div>
              </>
            ) : (
              (() => {
                const t = tileSet(stats, false).find((x) => x.id === status)!;
                return (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold text-primary truncate">{scopeLabel}</p>
                    <div className="shrink-0 flex items-baseline gap-2 rounded-2xl bg-primary-50 ring-2 ring-secondary px-4 py-1.5">
                      <span className={`text-xl font-extrabold tabular-nums leading-none ${t.tone}`}>{t.v}</span>
                      <span className="text-[11px] font-semibold text-gray-600">{t.l}</span>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        </div>

        {/* List */}
        <div className="p-card p-3">
          {stale || (loading && items.length === 0) ? (
            <div className="animate-pulse space-y-2">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-primary-50" />)}
            </div>
          ) : error && items.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-8">{hi ? 'लोड करने में विफल' : 'Failed to load'}</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-xs text-gray-500">{hi ? 'इस फ़िल्टर में कोई टेस्ट नहीं' : 'No tests match this filter'}</p>
            </div>
          ) : (
            <div className={`space-y-2 ${loading ? 'opacity-50 transition-opacity' : ''}`}>
              {items.map((t, idx) => {
                const key = t.testId ?? `${t.subjectId}:${t.slotNumber}`;
                const isOpen = open === key;
                const header = sort === 'sequence' && (idx === 0 || groupKey(items[idx - 1]) !== groupKey(t));
                const sectionSize = items.filter((x) => groupKey(x) === groupKey(t)).length;
                const canStart = t.attemptCount < t.maxAttempts;
                const title = hi ? t.titleHi : t.titleEn;
                const tile = t.status === 'passed'
                  ? { cls: 'bg-gradient-to-br from-success to-green-400 text-white', ch: '✓' }
                  : t.status === 'failed'
                    ? { cls: 'bg-gradient-to-br from-accent to-accent-300 text-white', ch: '✗' }
                    : { cls: 'bg-primary-100 text-primary-300', ch: '○' };
                const line = t.status === 'passed'
                  ? (hi ? `पहली बार प्रयास ${t.passedOnAttempt} में पास` : `First passed on attempt ${t.passedOnAttempt}`)
                  : t.status === 'failed'
                    ? (hi ? 'अभी पास नहीं हुआ' : 'Not passed yet')
                    : (hi ? 'अभी नहीं दिया' : 'Not attempted yet');
                return (
                  <div key={key}>
                    {header && (
                      <p className="px-1 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-primary-400 truncate">
                        {groupLabel(t)} <span className="opacity-60 normal-case tabular-nums">· {sectionSize} {hi ? 'टेस्ट' : sectionSize === 1 ? 'test' : 'tests'}</span>
                      </p>
                    )}
                    <div className="rounded-2xl bg-primary-50/50 overflow-hidden">
                      <div
                        className={`flex items-center justify-between p-2.5 ${t.attemptCount > 0 ? 'cursor-pointer active:bg-primary-50' : ''}`}
                        onClick={() => t.attemptCount > 0 && setOpen(isOpen ? null : key)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`w-10 h-10 flex items-center justify-center rounded-2xl text-sm font-extrabold shrink-0 shadow-sm ${tile.cls}`}>{tile.ch}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{title}</p>
                            <p className="flex items-center gap-1.5 text-[10px] text-gray-400 min-w-0">
                              <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[8px] font-bold ${kindInfo(t.kind).cls}`}>{hi ? kindInfo(t.kind).hi : kindInfo(t.kind).en}</span>
                              <span className="truncate">{line}{t.attemptCount > 0 ? ` · ${t.attemptCount}/${t.maxAttempts}` : ''}</span>
                            </p>
                            {t.attemptCount > 0 && t.bestAttemptNumber && (
                              <p className="text-[10px] text-primary-400 font-semibold mt-0.5 truncate">
                                ★ {hi ? `सबसे अच्छा: प्रयास ${t.bestAttemptNumber} · ${t.bestPercentage}%` : `Highest: attempt ${t.bestAttemptNumber} · ${t.bestPercentage}%`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          {t.attemptCount > 0 ? (
                            <>
                              <p className={`text-sm font-extrabold tabular-nums ${t.status === 'passed' ? 'text-green-600' : 'text-accent-600'}`}>{t.bestPercentage}%</p>
                              <p className="text-[9px] text-gray-400">{isOpen ? '▲' : '▼'} {hi ? 'प्रयास' : 'attempts'}</p>
                            </>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); start(t); }}
                              disabled={starting === key}
                              className="p-btn !py-1.5 !px-3 !text-[11px]"
                            >
                              {starting === key ? '…' : (hi ? 'शुरू करें' : 'Start')}
                            </button>
                          )}
                        </div>
                      </div>

                      {isOpen && (
                        <div className="mx-2.5 mb-2.5 space-y-1.5">
                          {t.attempts.map((a) => (
                            <button
                              key={a.attemptId}
                              onClick={() => navigate(`/tests/${t.testId}/results/${a.attemptId}`)}
                              className="w-full flex items-center justify-between rounded-xl bg-white border border-primary-100 px-3 py-2 text-left active:bg-primary-50"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${a.passed ? 'bg-success' : 'bg-accent'}`} />
                                <span className="text-[11px] font-semibold text-primary">{hi ? `प्रयास ${a.attemptNumber}` : `Attempt ${a.attemptNumber}`}</span>
                                <span className="text-[10px] text-gray-400 truncate">{timeAgo(a.submittedAt, language)}</span>
                                {a.attemptNumber === t.passedOnAttempt && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-success/15 text-green-700 text-[8px] font-bold">{hi ? 'पहली बार पास' : 'First pass'}</span>
                                )}
                                {a.attemptNumber === t.bestAttemptNumber && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-secondary-100 text-secondary-700 text-[8px] font-bold">★ {hi ? 'सबसे अच्छा' : 'Highest'}</span>
                                )}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] tabular-nums"><span className="text-green-600">{a.correctCount}✓</span> <span className="text-accent-600">{a.wrongCount}✗</span></span>
                                <span className={`text-xs font-extrabold tabular-nums ${a.passed ? 'text-green-600' : 'text-accent-600'}`}>{a.percentage}%</span>
                                <span className="text-primary-300">›</span>
                              </span>
                            </button>
                          ))}
                          {canStart ? (
                            <button onClick={() => start(t)} className="p-btn-navy w-full !py-2">{hi ? 'फिर से दें' : 'Reattempt'} ▸</button>
                          ) : (
                            <p className="text-center text-[10px] text-gray-400 py-1">{hi ? 'सभी प्रयास पूरे हो चुके हैं' : 'All attempts used'}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The screen, wrapped so a crash shows its message with a Retry button instead of a generic error page. */
export function MyResultsPage() {
  const [attempt, setAttempt] = useState(0);
  return (
    <PageErrorBoundary onRetry={() => setAttempt((n) => n + 1)}>
      <MyResultsContent key={attempt} />
    </PageErrorBoundary>
  );
}
