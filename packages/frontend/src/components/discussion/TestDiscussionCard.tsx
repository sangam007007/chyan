import { useEffect, useState } from 'react';
import api from '@/services/api';
import { DiscussionThread } from './DiscussionThread';

/**
 * "Discussion" card under a test result. It asks the server which room belongs to the test
 * (a fixed test has its own room; generated subject full tests share one room per subject)
 * and stays hidden if the student cannot join.
 */
export function TestDiscussionCard({ testId, isHi }: { testId: string; isHi: boolean }) {
  const [info, setInfo] = useState<{ room: string; titleEn: string; titleHi: string; messageCount: number } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/discussions/room', { params: { testId } })
      .then((res) => { if (!cancelled) setInfo(res.data.data); })
      .catch(() => { if (!cancelled) setInfo(null); });
    return () => { cancelled = true; };
  }, [testId]);

  if (!info) return null;

  return (
    <div className="p-card p-4 lg:col-span-3 xl:col-span-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="p-title">💬 {isHi ? 'चर्चा' : 'Discussion'} · <span className="font-semibold">{isHi ? info.titleHi : info.titleEn}</span></p>
          <p className="p-sub mt-0.5">
            {isHi ? 'इस टेस्ट के बारे में बाकी छात्रों से बात करें, अपने जवाब और तरीके साझा करें।' : 'Talk to other students about this test: share answers and approaches.'}
            {info.messageCount > 0 && <> · {isHi ? `${info.messageCount} मैसेज` : `${info.messageCount} message${info.messageCount === 1 ? '' : 's'}`}</>}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className="p-btn-navy shrink-0">
          {open ? (isHi ? 'बंद करें' : 'Close') : (isHi ? 'चर्चा खोलें' : 'Open chat')}
        </button>
      </div>
      {open && <div className="mt-3"><DiscussionThread room={info.room} isHi={isHi} /></div>}
    </div>
  );
}
