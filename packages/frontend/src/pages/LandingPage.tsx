import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n';
import { BrandMark } from '@/components/common/BrandMark';
import { BRAND } from '@/brand';
import { POPULAR_EXAMS, EXAM_REGIONS, type ExamRegion } from '@/data/exams';
import { LanguageToggle } from '@/components/common/LanguageToggle';
import { InstallApp } from '@/components/common/InstallApp';

interface Overview {
  exams: { id: string; nameEn: string; nameHi: string; category: string | null }[];
  counts: { exams: number; subjects: number; topics: number; tests: number; freeTests: number };
}

/** Approximate number of students already using the app, as stated by the product owner. */
const STUDENTS = 500;

const PRICE = 99;
const TRIAL_DAYS = 3;
const PLAN_MONTHS = 3;

const STEPS = [
  { icon: '📱', en: 'Sign up in 30 seconds', hi: '30 सेकंड में साइन अप', dEn: 'Enter your phone number, verify with an OTP. No password to remember.', dHi: 'फ़ोन नंबर डालें और OTP से वेरिफ़ाई करें। कोई पासवर्ड याद रखने की ज़रूरत नहीं।' },
  { icon: '🎯', en: 'Pick your exam', hi: 'अपना एग्ज़ाम चुनें', dEn: 'Choose the exam you are preparing for. Your plan, tests and progress follow it.', dHi: 'जिस परीक्षा की तैयारी कर रहे हैं उसे चुनें। आपका प्लान, टेस्ट और प्रोग्रेस उसी के हिसाब से चलेंगे।' },
  { icon: '🚀', en: 'Study, test, improve', hi: 'पढ़ें, टेस्ट दें, सुधरें', dEn: 'Follow the daily plan, take tests and see exactly which topics need work.', dHi: 'डेली प्लान फ़ॉलो करें, टेस्ट दें और देखें कि किन टॉपिक पर मेहनत चाहिए।' },
];

const FAQ = [
  { qEn: 'How much does it cost?', qHi: 'इसकी कीमत क्या है?', aEn: `Start with a ${TRIAL_DAYS}-day free trial where everything is unlocked. After that, it is ₹${PRICE} for ${PLAN_MONTHS} months.`, aHi: `${TRIAL_DAYS} दिन के फ़्री ट्रायल से शुरू करें जिसमें सब कुछ अनलॉक रहता है। उसके बाद ${PLAN_MONTHS} महीने के सिर्फ़ ₹${PRICE}।` },
  { qEn: 'Do I need a password?', qHi: 'क्या पासवर्ड चाहिए?', aEn: 'No. You log in with your phone number and a one-time password (OTP). You can also continue with Google.', aHi: 'नहीं। आप फ़ोन नंबर और वन-टाइम पासवर्ड (OTP) से लॉगिन करते हैं। चाहें तो Google से भी जारी रख सकते हैं।' },
  { qEn: 'Hindi or English?', qHi: 'हिंदी या अंग्रेज़ी?', aEn: 'Both. Switch the app language any time. Hindi-subject questions are always shown in Hindi.', aHi: 'दोनों। ऐप की भाषा कभी भी बदल सकते हैं। हिंदी विषय के प्रश्न हमेशा हिंदी में दिखते हैं।' },
  { qEn: 'Is there negative marking?', qHi: 'क्या नेगेटिव मार्किंग है?', aEn: 'Topic and subject practice tests have no negative marking. Mock, previous-year and daily tests show their marking rule before you start.', aHi: 'टॉपिक और सब्जेक्ट प्रैक्टिस टेस्ट में नेगेटिव मार्किंग नहीं है। मॉक, पिछले वर्ष और डेली टेस्ट में शुरू करने से पहले मार्किंग नियम दिखता है।' },
  { qEn: 'Can I retake a test?', qHi: 'क्या टेस्ट दोबारा दे सकते हैं?', aEn: 'Yes. Every test allows several attempts, and My Results keeps all of them so you can see your improvement.', aHi: 'हाँ। हर टेस्ट में कई प्रयास मिलते हैं, और My Results में सभी प्रयास सेव रहते हैं ताकि आप अपना सुधार देख सकें।' },
  { qEn: 'Does it work on my phone?', qHi: 'क्या यह फ़ोन पर चलता है?', aEn: 'Yes. It is built mobile-first, so it works smoothly on any phone browser.', aHi: 'हाँ। यह मोबाइल-फ़र्स्ट बना है, इसलिए किसी भी फ़ोन ब्राउज़र पर आराम से चलता है।' },
];

const EXAMS_COLLAPSED = 24;

/** "Prepare for" explorer: every popular exam, with the ones that have content today marked available. */
function ExamExplorer({ live, hi }: { live: Overview['exams']; hi: boolean }) {
  const [region, setRegion] = useState<'all' | ExamRegion>('all');
  const [expanded, setExpanded] = useState(false);
  const L = (en: string, hindi: string) => (hi ? hindi : en);

  const liveNames = new Set(live.map((x) => x.nameEn.trim().toLowerCase()));
  const known = new Set(POPULAR_EXAMS.map((x) => x.en.trim().toLowerCase()));
  const all = [
    ...POPULAR_EXAMS.map((x) => ({ ...x, live: liveNames.has(x.en.trim().toLowerCase()) })),
    // exams an admin added that are not in the curated list
    ...live.filter((x) => !known.has(x.nameEn.trim().toLowerCase())).map((x) => ({ en: x.nameEn, hi: x.nameHi, region: 'other' as ExamRegion, live: true })),
  ].sort((x, y) => Number(y.live) - Number(x.live));

  const total = all.length;
  const liveCount = all.filter((x) => x.live).length;
  const inRegion = region === 'all' ? all : all.filter((x) => x.region === region);
  const shown = region === 'all' && !expanded ? inRegion.slice(0, EXAMS_COLLAPSED) : inRegion;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 md:pt-14">
      <h2 className="text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold text-primary font-[Poppins]">
        {Math.floor(total / 10) * 10}+ {L('government exams', 'सरकारी परीक्षाएं')}
      </h2>
      <p className="text-center text-sm md:text-base text-gray-500 mt-2">
        {L('UP, Bihar, Uttarakhand, Rajasthan, MP and central exams, one app.', 'यूपी, बिहार, उत्तराखंड, राजस्थान, एमपी और केंद्रीय परीक्षाएं, एक ही ऐप में।')}
      </p>
      <p className="text-center text-[11px] md:text-sm mt-3 text-gray-500">
        <span className="font-bold text-secondary-700">✓ {L(`${liveCount} available now`, `${liveCount} अभी उपलब्ध`)}</span>
        <span className="mx-2 text-gray-300">·</span>
        {L(`${total - liveCount} coming soon`, `${total - liveCount} जल्द आ रहे हैं`)}
      </p>

      <div className="mt-5 flex gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:justify-center -mx-4 px-4 md:mx-0 md:px-0">
        {[{ id: 'all' as const, en: 'All', hi: 'सभी' }, ...EXAM_REGIONS].map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => { setRegion(r.id); setExpanded(false); }}
            className={`shrink-0 px-3.5 py-1.5 md:px-5 md:py-2 rounded-full text-[11px] md:text-sm font-semibold transition-colors ${
              region === r.id ? 'bg-primary text-white shadow' : 'bg-white text-primary-400 border border-primary-100'
            }`}
          >
            {hi ? r.hi : r.en}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {shown.map((x) => (
          <span
            key={x.en}
            className={`px-3 py-1.5 md:px-5 md:py-2.5 rounded-full text-[11px] md:text-sm font-semibold ${
              x.live
                ? 'bg-white border border-secondary text-primary shadow-sm ring-1 ring-secondary-100'
                : 'bg-white/60 border border-dashed border-primary-100 text-gray-500'
            }`}
          >
            {x.live && <span className="text-secondary-600 mr-1">✓</span>}
            {hi ? x.hi : x.en}
          </span>
        ))}
      </div>

      {region === 'all' && !expanded && inRegion.length > EXAMS_COLLAPSED && (
        <div className="mt-5 text-center">
          <button type="button" onClick={() => setExpanded(true)} className="rounded-full bg-primary-50 text-primary text-xs md:text-sm font-semibold px-5 py-2.5 active:scale-95 transition-transform">
            {L(`Show all ${total} exams`, `सभी ${total} परीक्षाएं देखें`)} ↓
          </button>
        </div>
      )}
    </section>
  );
}

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { language } = useTranslation();
  const hi = language === 'hi';
  const L = (en: string, hindi: string) => (hi ? hindi : en);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/public/overview')
      .then((res) => { if (!cancelled) setOverview(res.data?.data ?? null); })
      .catch(() => { /* the page works without live numbers */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-800">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-secondary border-t-transparent" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const c = overview?.counts;
  const stats = [
    { v: STUDENTS, l: L('Students learning', 'छात्र पढ़ रहे हैं'), i: '👥' },
    ...(c
      ? [
          { v: c.exams, l: L('Exams ready now', 'अभी उपलब्ध परीक्षाएं'), i: '🎯' },
          { v: c.topics, l: L('Topics', 'टॉपिक'), i: '🧩' },
          { v: c.tests, l: L('Practice tests', 'प्रैक्टिस टेस्ट'), i: '📝' },
        ].filter((x) => x.v > 0)
      : []),
  ];

  const features = [
    { i: '🧭', en: 'Guided study path', hi: 'गाइडेड स्टडी पाथ', dEn: 'Every subject broken into topics, with parts and a practice test after each. You always know what is next.', dHi: 'हर विषय टॉपिक में बंटा है, हर टॉपिक के बाद प्रैक्टिस टेस्ट। आपको हमेशा पता रहता है आगे क्या करना है।' },
    { i: '📝', en: 'Mocks, PYQ & daily tests', hi: 'मॉक, PYQ और डेली टेस्ट', dEn: 'Full-length mocks, previous-year papers and daily practice, all in one Test tab.', dHi: 'फ़ुल-लेंथ मॉक, पिछले वर्ष के पेपर और डेली प्रैक्टिस, सब एक ही Test टैब में।' },
    { i: '📊', en: 'See where you stand', hi: 'अपनी स्थिति जानें', dEn: 'Rank, readiness score, subject and topic accuracy, and a trend that shows if you are improving.', dHi: 'रैंक, रेडीनेस स्कोर, विषय और टॉपिक की सटीकता, और ट्रेंड जो बताता है कि आप सुधर रहे हैं या नहीं।' },
    { i: '🔥', en: 'Streaks & 60 badges', hi: 'स्ट्रीक और 60 बैज', dEn: 'Daily streaks, XP levels and 60 badges keep you motivated to show up every day.', dHi: 'डेली स्ट्रीक, XP लेवल और 60 बैज आपको रोज़ पढ़ने के लिए प्रेरित रखते हैं।' },
    { i: '⚡', en: 'Daily challenge', hi: 'डेली चैलेंज', dEn: 'A short quiz every day, a quick win that builds the habit and earns coins.', dHi: 'हर दिन एक छोटा क्विज़, जल्दी जीत जो आदत बनाती है और कॉइन दिलाती है।' },
    { i: '🌐', en: 'Hindi + English', hi: 'हिंदी + अंग्रेज़ी', dEn: 'Switch language any time. Study the way you think best.', dHi: 'भाषा कभी भी बदलें। जिस भाषा में आसान लगे उसी में पढ़ें।' },
  ];

  const cta = L(`Start ${TRIAL_DAYS}-day free trial`, `${TRIAL_DAYS} दिन फ़्री ट्रायल शुरू करें`);

  return (
    <div className="min-h-screen bg-background text-gray-800 overflow-x-hidden">
      {/* ── Top bar */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 md:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <BrandMark className="w-8 h-8 shrink-0" />
            <span className="text-white font-extrabold text-lg md:text-2xl leading-none truncate font-[Poppins]">{BRAND.name} <span className="text-secondary-200 text-sm font-bold">{BRAND.nameHi}</span></span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle />
            <Link to="/login" className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white text-xs font-semibold backdrop-blur active:scale-95 transition-transform">
              {L('Login', 'लॉगिन')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-800 via-primary to-primary-400 text-white pt-24 pb-14 md:pt-36 md:pb-28">
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-secondary/25 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-primary-300/30 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 grid md:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 md:px-4 md:py-1.5 text-[11px] md:text-sm font-semibold text-secondary-200">
              👥 {L(`${STUDENTS}+ students already practising`, `${STUDENTS}+ छात्र पहले से तैयारी कर रहे हैं`)}
            </span>
            <h1 className={`mt-4 md:mt-6 text-[32px] sm:text-5xl lg:text-[54px] font-extrabold font-[Poppins] ${hi ? 'leading-[1.4] sm:leading-[1.4] lg:leading-[1.4]' : 'leading-[1.12] sm:leading-[1.12] lg:leading-[1.1] tracking-tight'}`}>
              {hi ? (
                <>सरकारी भर्ती की तैयारी, <span className="text-secondary-200">स्मार्ट तरीके से</span></>
              ) : (
                <>Crack your government exam with <span className="text-secondary-200">smart daily practice</span></>
              )}
            </h1>
            <p className="mt-4 md:mt-6 text-sm sm:text-base lg:text-lg text-white/75 max-w-md lg:max-w-xl leading-relaxed">
              {L(
                'Topic-wise study, mock tests and previous-year papers, with an AI study partner that finds your weak topics and shows how close you are to clearing the exam.',
                'टॉपिक-वाइज़ पढ़ाई, मॉक टेस्ट और पिछले वर्ष के पेपर, साथ में AI स्टडी पार्टनर जो आपके कमज़ोर टॉपिक पकड़ता है और बताता है कि एग्ज़ाम क्लियर करने से आप कितना दूर हैं।',
              )}
            </p>
            <div className="mt-6 md:mt-9 flex flex-wrap items-center gap-3">
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary text-primary-800 font-extrabold text-sm md:text-base px-6 md:px-8 py-3.5 md:py-4 shadow-[0_14px_30px_-10px_rgba(197,160,40,0.9)] active:scale-95 transition-transform">
                {cta} <span aria-hidden>→</span>
              </Link>
              <a href="#how" className="inline-flex items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm md:text-base px-5 md:px-7 py-3.5 md:py-4 active:scale-95 transition-transform">
                {L('How it works', 'यह कैसे काम करता है')}
              </a>
            </div>
            <p className="mt-3 text-[11px] md:text-sm text-white/55">🎁 {L(`${TRIAL_DAYS} days everything free, then just ₹${PRICE} for ${PLAN_MONTHS} months`, `${TRIAL_DAYS} दिन सब कुछ फ़्री, फिर ${PLAN_MONTHS} महीने के सिर्फ़ ₹${PRICE}`)}</p>
            <div className="mt-4 md:hidden"><InstallApp variant="pill" /></div>
          </div>

          {/* Product preview (illustration of the real screens) */}
          <div className="relative mx-auto w-full max-w-[300px] lg:max-w-[360px]" aria-hidden="true">
            <div className="rounded-[2rem] bg-white/10 border border-white/20 p-3 backdrop-blur shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
              <div className="rounded-[1.5rem] bg-background p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-gray-400">{L('Today', 'आज')}</p>
                    <p className="text-[12px] font-bold text-primary">{L('Your daily plan', 'आपका डेली प्लान')}</p>
                  </div>
                  <span className="p-chip-gold">🔥 {L('Streak', 'स्ट्रीक')}</span>
                </div>
                <div className="p-card p-3 flex items-center gap-3">
                  <svg viewBox="0 0 36 36" className="w-14 h-14 shrink-0 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E8EDF3" strokeWidth="4" />
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#C5A028" strokeWidth="4" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="29" />
                  </svg>
                  <div>
                    <p className="text-[11px] font-bold text-primary">{L('Readiness score', 'रेडीनेस स्कोर')}</p>
                    <p className="text-[9px] text-gray-400 leading-snug">{L('Updates after every test', 'हर टेस्ट के बाद अपडेट')}</p>
                  </div>
                </div>
                {[
                  [L('Number System', 'संख्या पद्धति'), 'w-4/5', 'from-success to-green-300'],
                  [L('Indian Polity', 'भारतीय राजव्यवस्था'), 'w-3/5', 'from-secondary-500 to-secondary-200'],
                  [L('Reasoning', 'तर्कशक्ति'), 'w-2/5', 'from-accent-500 to-accent-200'],
                ].map(([n, w, g]) => (
                  <div key={n} className="p-card p-2.5">
                    <div className="flex justify-between text-[10px] mb-1"><span className="font-semibold text-gray-700">{n}</span></div>
                    <div className="h-2 rounded-full bg-primary-50 overflow-hidden"><div className={`h-full rounded-full bg-gradient-to-r ${g} ${w}`} /></div>
                  </div>
                ))}
              </div>
            </div>
            <span className="absolute -top-3 -right-2 rotate-6 rounded-xl bg-secondary text-primary-800 text-[10px] font-extrabold px-2.5 py-1 shadow-lg">🏅 60 {L('badges', 'बैज')}</span>
            <p className="text-center text-[9px] text-white/40 mt-2">{L('Sample preview', 'सैंपल प्रीव्यू')}</p>
          </div>
        </div>
      </section>

      {/* ── Live numbers */}
      {stats.length > 1 && (
        <section className="relative z-10 -mt-7 max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
          <div className="p-card grid grid-cols-2 sm:grid-cols-4 gap-px bg-primary-50 overflow-hidden">
            {stats.map((s) => (
              <div key={s.l} className="bg-white py-4 md:py-7 text-center">
                <p className="text-2xl md:text-4xl font-black text-primary tabular-nums leading-none">{s.v}<span className="text-secondary">+</span></p>
                <p className="text-[11px] md:text-sm text-gray-500 mt-1.5 md:mt-2">{s.i} {s.l}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Exams */}
      {overview && overview.exams.length > 0 && <ExamExplorer live={overview.exams} hi={hi} />}

      {/* ── Slogans */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-12">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-100 via-secondary-50 to-white border border-secondary-200 px-5 py-7 md:py-12 text-center shadow-[0_14px_34px_-18px_rgba(197,160,40,0.7)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-700">{BRAND.name} · {BRAND.nameHi}</p>
          <div className="mt-3 md:mt-5 space-y-2 md:space-y-3">
            {BRAND.slogans.map((x, i) => (
              <p key={x.hi} className={`font-extrabold text-primary ${i === 0 ? 'text-xl sm:text-2xl lg:text-4xl' : 'text-base sm:text-lg lg:text-2xl text-primary-400'}`}>{hi ? x.hi : x.en}</p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 md:pt-20">
        <h2 className="text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold text-primary font-[Poppins]">{L('Everything you need to prepare', 'तैयारी के लिए सब कुछ')}</h2>
        <p className="text-center text-sm md:text-base text-gray-500 mt-2">{L('One app. No juggling between notes, tests and trackers.', 'एक ऐप। नोट्स, टेस्ट और ट्रैकर के बीच भटकना नहीं।')}</p>
        <div className="mt-8 md:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f) => (
            <div key={f.en} className="p-card p-4 md:p-7">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-secondary-100 to-secondary-300 flex items-center justify-center text-xl md:text-2xl shadow-[0_8px_18px_-8px_rgba(197,160,40,0.9)]">{f.i}</div>
              <h3 className="mt-3 md:mt-5 text-sm md:text-lg font-bold text-primary">{hi ? f.hi : f.en}</h3>
              <p className="mt-1 md:mt-2 text-xs md:text-sm text-gray-500 leading-relaxed">{hi ? f.dHi : f.dEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── AI study partner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 md:pt-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary to-primary-400 text-white px-5 py-8 md:px-12 md:py-14 shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)]">
          <div className="absolute -top-14 -right-10 w-56 h-56 rounded-full bg-secondary/25 blur-3xl" />
          <div className="relative text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[11px] font-bold text-secondary-200">🤖 AI</span>
            <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold font-[Poppins]">{L('Your AI study partner', 'आपका AI स्टडी पार्टनर')}</h2>
            <p className="mt-2 text-sm md:text-lg text-white/75 max-w-2xl mx-auto">
              {L('Chayan tracks every answer you give and tells you what to do next, so you never study blindly.', 'चयन आपका हर जवाब ट्रैक करता है और बताता है कि आगे क्या करना है, ताकि आप अंधेरे में न पढ़ें।')}
            </p>
          </div>
          <div className="relative mt-6 md:mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-4">
            {[
              { i: '🎯', en: 'Spots your weak topics', hi: 'कमज़ोर टॉपिक पकड़ता है', dEn: 'Finds exactly where you lose marks, weakest topic first.', dHi: 'ठीक वही टॉपिक बताता है जहां आपके नंबर कटते हैं, सबसे कमज़ोर सबसे पहले।' },
              { i: '💪', en: 'Shows where to work harder', hi: 'कहां ज़्यादा मेहनत चाहिए', dEn: 'Tells you which subjects and topics need the most effort.', dHi: 'बताता है कि किन विषयों और टॉपिक पर सबसे ज़्यादा मेहनत चाहिए।' },
              { i: '🚨', en: 'Catches where you keep failing', hi: 'कहां फ़ेल हो रहे हैं', dEn: 'Flags topics you have not cleared yet, and ones where your score is slipping.', dHi: 'वे टॉपिक दिखाता है जो अभी क्लियर नहीं हुए, और जहां आपका स्कोर गिर रहा है।' },
              { i: '📏', en: 'Measures how far you are from the exam', hi: 'एग्ज़ाम से कितना पीछे हैं', dEn: 'A readiness score and estimated marks show how close you are to clearing it.', dHi: 'रेडीनेस स्कोर और अनुमानित अंक बताते हैं कि क्लियर करने से आप कितना दूर हैं।' },
              { i: '🏆', en: 'Compares you and pushes you up', hi: 'तुलना करके आगे बढ़ाता है', dEn: 'See your rank among other students and your own progress week by week.', dHi: 'दूसरे छात्रों के बीच अपनी रैंक और हफ़्ते-दर-हफ़्ते अपनी प्रगति देखें।' },
              { i: '🛠️', en: 'Gives you the fix', hi: 'समाधान भी बताता है', dEn: 'One tap takes you to the topic to practise, so every session fixes something.', dHi: 'एक टैप में उसी टॉपिक की प्रैक्टिस पर पहुंचें, हर सेशन में कुछ न कुछ सुधरे।' },
            ].map((f) => (
              <div key={f.en} className="rounded-2xl bg-white/10 border border-white/15 backdrop-blur p-4 md:p-6">
                <div className="text-2xl">{f.i}</div>
                <h3 className="mt-2 md:mt-3 text-sm md:text-base font-bold">{hi ? f.hi : f.en}</h3>
                <p className="mt-1 md:mt-1.5 text-xs md:text-sm text-white/70 leading-relaxed">{hi ? f.dHi : f.dEn}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-5 md:mt-8 mx-auto max-w-md md:max-w-lg rounded-2xl bg-white text-gray-800 p-3.5 flex items-center gap-3" aria-hidden="true">
            <div className="w-11 h-11 shrink-0 rounded-full border-2 border-accent-300 flex items-center justify-center text-[11px] font-bold text-accent-600">40%</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-accent-700">🤖 {L('AI insight', 'AI सुझाव')}</p>
              <p className="text-[11px] text-gray-600 leading-snug">{L('Indian Polity needs more work. Practise it next.', 'भारतीय राजव्यवस्था पर और मेहनत चाहिए। इसकी प्रैक्टिस अगली करें।')}</p>
            </div>
            <span className="shrink-0 rounded-xl bg-primary text-white text-[10px] font-semibold px-3 py-2">{L('Practice', 'अभ्यास')}</span>
          </div>
          <p className="relative text-center text-[9px] text-white/40 mt-2">{L('Sample insight', 'सैंपल सुझाव')}</p>
        </div>
      </section>

      {/* ── How it works */}
      <section id="how" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 scroll-mt-4">
        <h2 className="text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold text-primary font-[Poppins]">{L('Start in 3 simple steps', '3 आसान स्टेप में शुरू करें')}</h2>
        <div className="mt-8 md:mt-12 grid md:grid-cols-3 gap-3">
          {STEPS.map((s, i) => (
            <div key={s.en} className="p-card p-5 md:p-8 relative">
              <span className="absolute top-4 right-4 text-4xl font-black text-primary-50">{i + 1}</span>
              <div className="text-3xl md:text-4xl">{s.icon}</div>
              <h3 className="mt-3 md:mt-5 text-sm md:text-lg font-bold text-primary">{hi ? s.hi : s.en}</h3>
              <p className="mt-1 md:mt-2 text-xs md:text-sm text-gray-500 leading-relaxed">{hi ? s.dHi : s.dEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Price */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-14 md:pt-20">
        <h2 className="text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold text-primary font-[Poppins]">{L('One simple price', 'एक सीधी-सादी कीमत')}</h2>
        <div className="relative mt-8 overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary to-primary-400 text-white shadow-[0_24px_50px_-18px_rgba(27,58,92,0.8)]">
          <div className="absolute -top-16 -right-12 w-56 h-56 rounded-full bg-secondary/30 blur-3xl" />
          <span className="absolute top-4 right-4 rotate-3 rounded-xl bg-secondary text-primary-800 text-[10px] font-extrabold px-3 py-1 shadow-lg">🎁 {L(`${TRIAL_DAYS}-DAY FREE TRIAL`, `${TRIAL_DAYS} दिन फ़्री ट्रायल`)}</span>
          <div className="relative px-6 pt-9 pb-6 md:px-12 md:pt-14 md:pb-10 sm:flex sm:items-center sm:gap-8 md:gap-14">
            <div className="sm:flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-secondary-200">{L('Premium access', 'प्रीमियम एक्सेस')}</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-6xl md:text-7xl font-black leading-none font-[Poppins] tabular-nums">₹{PRICE}</span>
                <span className="pb-1.5 text-sm text-white/70">/ {L(`${PLAN_MONTHS} months`, `${PLAN_MONTHS} महीने`)}</span>
              </div>
              <p className="mt-2 text-xs text-white/70">
                {L(`That is about ₹${Math.round(PRICE / PLAN_MONTHS)} a month, roughly ₹${(PRICE / (PLAN_MONTHS * 30)).toFixed(1)} a day.`, `यानी करीब ₹${Math.round(PRICE / PLAN_MONTHS)} महीना, लगभग ₹${(PRICE / (PLAN_MONTHS * 30)).toFixed(1)} रोज़।`)}
              </p>
              <ul className="mt-4 md:mt-6 space-y-2 md:space-y-3 text-xs md:text-base text-white/90">
                {[
                  c && c.tests > 0 ? L(`All ${c.tests} tests, every exam`, `सभी ${c.tests} टेस्ट, हर परीक्षा`) : L('All tests, every exam', 'सभी टेस्ट, हर परीक्षा'),
                  L('Guided daily study plan', 'गाइडेड डेली स्टडी प्लान'),
                  L('Rank, readiness & topic analytics', 'रैंक, रेडीनेस और टॉपिक एनालिटिक्स'),
                  L('Streaks, XP & 60 badges', 'स्ट्रीक, XP और 60 बैज'),
                  L('Live classes & PDF notes (coming soon)', 'लाइव क्लास और PDF नोट्स (जल्द आ रहा है)'),
                ].map((x) => (
                  <li key={x} className="flex gap-2"><span className="text-secondary-200 font-bold">✓</span>{x}</li>
                ))}
              </ul>
            </div>
            <div className="mt-6 sm:mt-0 sm:w-64 md:w-80 rounded-2xl md:p-6 bg-white/10 border border-white/15 backdrop-blur p-4 md:p-6">
              <p className="text-sm font-bold">{L(`Try it free for ${TRIAL_DAYS} days`, `${TRIAL_DAYS} दिन फ़्री में आज़माएं`)}</p>
              <p className="mt-1 text-[11px] text-white/70 leading-relaxed">{L('Everything is unlocked during the trial. Like it? Continue for ₹' + PRICE + '.', 'ट्रायल में सब कुछ अनलॉक रहता है। पसंद आए तो ₹' + PRICE + ' में आगे बढ़ें।')}</p>
              <Link to="/login" className="mt-4 w-full inline-flex items-center justify-center rounded-2xl bg-secondary text-primary-800 font-extrabold text-sm py-3 shadow-[0_14px_30px_-10px_rgba(197,160,40,0.9)] active:scale-95 transition-transform">{cta} →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-14 md:pt-20">
        <h2 className="text-center text-2xl sm:text-3xl lg:text-4xl font-extrabold text-primary font-[Poppins]">{L('Questions you may have', 'आपके मन के सवाल')}</h2>
        <div className="mt-6 space-y-2">
          {FAQ.map((f) => (
            <details key={f.qEn} className="group p-card-soft px-4 py-3 md:px-6 md:py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] md:text-base font-semibold text-primary">
                {hi ? f.qHi : f.qEn}
                <span className="text-primary-300 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <p className="mt-2 text-xs md:text-sm text-gray-500 leading-relaxed">{hi ? f.aHi : f.aEn}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Final CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-14 pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary to-primary-400 text-white text-center px-6 py-10 md:py-16 shadow-[0_18px_40px_-16px_rgba(27,58,92,0.7)]">
          <div className="absolute -top-12 -right-10 w-48 h-48 rounded-full bg-secondary/25 blur-3xl" />
          <h2 className="relative text-2xl md:text-4xl font-extrabold font-[Poppins]">{L('Your first test is one minute away', 'आपका पहला टेस्ट बस एक मिनट दूर है')}</h2>
          <p className="relative mt-2 text-sm md:text-lg text-white/70">{L(`Start your ${TRIAL_DAYS}-day free trial and see where you stand today.`, `${TRIAL_DAYS} दिन का फ़्री ट्रायल शुरू करें और देखें आज आप कहां खड़े हैं।`)}</p>
          <Link to="/login" className="relative mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary text-primary-800 font-extrabold text-sm px-8 py-3.5 shadow-[0_14px_30px_-10px_rgba(197,160,40,0.9)] active:scale-95 transition-transform">
            {cta} →
          </Link>
        </div>
        <footer className="mt-8 flex flex-col items-center gap-2 text-[11px] text-gray-400">
          <div className="flex items-center gap-2"><BrandMark className="w-5 h-5" /><span className="font-semibold text-primary-400">{BRAND.name} · {BRAND.nameHi}</span></div>
          <p>© {new Date().getFullYear()} {BRAND.name}</p>
        </footer>
      </section>

      {/* ── Sticky mobile CTA */}
      <div className={`fixed inset-x-0 bottom-0 z-30 p-3 sm:hidden transition-transform duration-300 ${showSticky ? 'translate-y-0' : 'translate-y-full'}`}>
        <Link to="/login" className="flex items-center justify-between rounded-2xl bg-primary-800/95 backdrop-blur px-4 py-3 shadow-[0_-8px_30px_-8px_rgba(0,0,0,0.5)]">
          <span className="text-xs text-white/80">{L(`${TRIAL_DAYS} days free, then ₹${PRICE}`, `${TRIAL_DAYS} दिन फ़्री, फिर ₹${PRICE}`)}</span>
          <span className="rounded-xl bg-secondary text-primary-800 text-xs font-extrabold px-4 py-2">{L('Start free', 'फ़्री शुरू करें')} →</span>
        </Link>
      </div>
    </div>
  );
}
