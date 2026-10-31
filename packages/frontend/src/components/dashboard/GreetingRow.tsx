import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/services/api';

interface GreetingRowProps {
  userName: string;
  language: 'hi' | 'en';
}

/**
 * GreetingRow — Greeting message with dynamic exam selector dropdown.
 */
export function GreetingRow({ userName, language }: GreetingRowProps) {
  const firstName = userName.split(' ')[0] || (language === 'hi' ? 'छात्र' : 'Student');
  const { user } = useAuth();
  const [exams, setExams] = useState<{ id: string; name_en: string; name_hi?: string }[]>([]);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    api.get('/api/profile/exams').then((res) => {
      setExams(res.data?.data?.map((e: any) => ({ id: e.exam_id, name_en: e.name_en, name_hi: e.name_hi })) ?? []);
    }).catch(() => {
      // Fallback: fetch all exams if enrolled list fails
      api.get('/api/onboarding/exams').then((res) => {
        const data = res.data?.data;
        setExams([...(data?.state || []), ...(data?.central || [])]);
      }).catch(() => {});
    });
  }, []);

  const handleExamChange = async (examId: string) => {
    if (!examId || examId === user?.selectedExamId) return;
    setChanging(true);
    try {
      await api.post('/api/profile/exam', { exam_id: examId });
      window.location.reload();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message;
      alert(msg || 'Failed to change exam. Try again later.');
    }
    setChanging(false);
  };

  const selectedExam = exams.find((e) => e.id === user?.selectedExamId);

  return (
    <div className="flex items-end justify-between gap-3">
      {/* Left: Greeting */}
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold text-white leading-tight truncate">
          {language === 'hi' ? `नमस्ते, ${firstName} 👋` : `Hello, ${firstName} 👋`}
        </h2>
        <p className="text-[11px] text-white/70 mt-0.5">
          {language === 'hi' ? 'सीखते रहो, बढ़ते रहो!' : 'Keep learning, keep growing!'}
        </p>
      </div>

      {/* Right: Exam selector dropdown */}
      <div className="relative shrink-0">
        <select
          value={user?.selectedExamId || ''}
          onChange={(e) => handleExamChange(e.target.value)}
          disabled={changing}
          className="appearance-none pl-3 pr-8 py-2 bg-white/10 backdrop-blur rounded-2xl border border-white/20 text-[11px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer disabled:opacity-50 max-w-[150px] truncate [&>option]:text-primary"
        >
          {exams.length === 0 && <option value="">{selectedExam?.name_en || (language === 'hi' ? 'लोड हो रहा है...' : 'Loading...')}</option>}
          {exams.map((e) => (
            <option key={e.id} value={e.id}>{language === 'hi' ? (e.name_hi || e.name_en) : e.name_en}</option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-200 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
