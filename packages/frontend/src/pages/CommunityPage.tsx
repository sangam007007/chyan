import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import api from '@/services/api';
import { PageHero } from '@/components/ui/premium';
import { DiscussionThread } from '@/components/discussion/DiscussionThread';

/** The common community of the student's exam (opened from the Study tab). */
export function CommunityPage() {
  const { language } = useTranslation();
  const isHi = language === 'hi';
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ room: string; titleEn: string; titleHi: string } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'none'>('loading');

  useEffect(() => {
    let cancelled = false;
    api.get('/api/discussions/room', { params: { scope: 'exam' } })
      .then((res) => { if (!cancelled) { setInfo(res.data.data); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('none'); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="pb-28">
      <PageHero
        title={`💬 ${isHi ? 'कम्युनिटी' : 'Community'}`}
        subtitle={info ? (isHi ? info.titleHi : info.titleEn) : (isHi ? 'सभी छात्रों की साझा चर्चा' : 'One place for every student')}
        left={
          <button
            onClick={() => navigate(-1)}
            aria-label={isHi ? 'वापस' : 'Back'}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-white/15 backdrop-blur border border-white/10 active:scale-95 transition-transform"
          >
            <span className="text-white text-lg">←</span>
          </button>
        }
      />
      <div className="px-4 lg:px-0 mt-4 lg:mt-5 lg:max-w-4xl lg:mx-auto">
        {state === 'loading' && <div className="p-card h-48 animate-pulse" />}
        {state === 'none' && (
          <div className="p-card p-8 text-center">
            <p className="text-3xl mb-2">🎯</p>
            <p className="text-sm text-gray-500">{isHi ? 'कम्युनिटी में आने के लिए पहले अपना एग्ज़ाम चुनें।' : 'Pick your exam first to join its community.'}</p>
          </div>
        )}
        {state === 'ready' && info && (
          <>
            <p className="mb-3 text-xs lg:text-sm text-gray-500">
              {isHi
                ? 'अपने एग्ज़ाम के बाकी छात्रों से सवाल पूछें, नोट्स और तरीके साझा करें। एग्ज़ाम बदलने पर आपको नए एग्ज़ाम की कम्युनिटी दिखेगी।'
                : 'Ask other students of your exam, share notes and approaches. If you change your exam you will see that exam\'s community instead.'}
            </p>
            <DiscussionThread room={info.room} isHi={isHi} />
          </>
        )}
      </div>
    </div>
  );
}
