import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface HeroBannerProps {
  user: { fullName?: string } | null;
  language: 'hi' | 'en';
}

/**
 * HeroBanner — Scrollable carousel with multiple banners.
 * Auto-scrolls every 4 seconds. Swipeable on mobile.
 */
export function HeroBanner({ user, language }: HeroBannerProps) {
  const firstName = user?.fullName?.split(' ')[0] || 'Student';
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const banners = [
    // Banner 1: Welcome/Greeting
    {
      id: 'welcome',
      gradient: 'from-indigo-500 via-blue-500 to-cyan-400',
      emoji: '👋',
      title: language === 'hi' ? `नमस्ते, ${firstName}` : `Hello, ${firstName}`,
      subtitle: language === 'hi'
        ? 'UP Police परीक्षा की तैयारी शुरू करें'
        : 'Start your UP Police exam preparation',
      cta: language === 'hi' ? 'अभी टेस्ट दें →' : 'Start Test →',
      link: '/tests',
    },
    // Banner 2: Teachers — UPTET/SUPERTET
    {
      id: 'teacher',
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      emoji: '👨‍🏫',
      title: language === 'hi' ? 'शिक्षक भर्ती 2025' : 'Teacher Recruitment 2025',
      subtitle: language === 'hi'
        ? 'UPTET, SUPERTET, CTET — सभी परीक्षाओं की तैयारी एक जगह'
        : 'UPTET, SUPERTET, CTET — All exams at one place',
      cta: language === 'hi' ? 'शिक्षक टेस्ट →' : 'Teacher Tests →',
      link: '/tests?category=full_mock',
    },
    // Banner 3: CTET Central
    {
      id: 'ctet',
      gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
      emoji: '📝',
      title: language === 'hi' ? 'CTET 2025' : 'CTET 2025',
      subtitle: language === 'hi'
        ? 'केंद्रीय शिक्षक पात्रता परीक्षा — Paper 1 & 2 Mock Tests'
        : 'Central Teacher Eligibility Test — Paper 1 & 2 Mocks',
      cta: language === 'hi' ? 'CTET अभ्यास →' : 'CTET Practice →',
      link: '/tests?category=full_mock',
    },
    // Banner 4: SUPERTET
    {
      id: 'supertet',
      gradient: 'from-amber-500 via-orange-500 to-red-500',
      emoji: '🏅',
      title: language === 'hi' ? 'SUPER TET 2025' : 'SUPER TET 2025',
      subtitle: language === 'hi'
        ? 'UP सहायक अध्यापक भर्ती — 17,000+ पदों के लिए तैयारी करें'
        : 'UP Assistant Teacher — Prepare for 17,000+ posts',
      cta: language === 'hi' ? 'SUPERTET टेस्ट →' : 'SUPERTET Tests →',
      link: '/tests?category=full_mock',
    },
  ];

  // Auto-scroll every 4 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 4000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length]);

  // Scroll to active banner
  useEffect(() => {
    if (scrollRef.current) {
      const child = scrollRef.current.children[activeIndex] as HTMLElement;
      if (child) {
        scrollRef.current.scrollTo({
          left: child.offsetLeft,
          behavior: 'smooth',
        });
      }
    }
  }, [activeIndex]);

  // Handle manual scroll (snap detection)
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const width = scrollRef.current.offsetWidth;
    const newIndex = Math.round(scrollLeft / width);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < banners.length) {
      setActiveIndex(newIndex);
      // Reset auto-scroll timer on manual interaction
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % banners.length);
      }, 4000);
    }
  };

  return (
    <div className="relative">
      {/* Scrollable banner container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-0 rounded-2xl"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            className={`min-w-full snap-center rounded-2xl bg-gradient-to-r ${banner.gradient} p-6 sm:p-8 text-white relative overflow-hidden`}
          >
            <div className="relative z-10 max-w-md">
              <div className="text-3xl mb-2">{banner.emoji}</div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">{banner.title}</h2>
              <p className="text-sm sm:text-base text-white/80 mb-4">{banner.subtitle}</p>
              <Link
                to={banner.link}
                className="inline-flex items-center px-5 py-2.5 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-lg border border-white/30 hover:bg-white/30 transition-colors text-sm"
              >
                {banner.cta}
              </Link>
            </div>
            {/* Decorative circles */}
            <div className="absolute right-4 top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute right-12 bottom-4 w-14 h-14 rounded-full bg-white/5" />
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {banners.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`rounded-full transition-all ${
              i === activeIndex
                ? 'w-6 h-2 bg-indigo-500'
                : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Banner ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
