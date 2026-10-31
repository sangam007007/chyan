/**
 * A day counts as active if the student has an activity row or submitted a test that day
 * (same definition as the Performance heatmap).
 *
 * Achievements & XP — computed on the fly from existing tables
 * (test_attempts, attempt_answers, user_activities, coin_transactions, topic_progress).
 * Nothing is stored: unlocking is derived, so it can never drift from the real data.
 */

import { queryOne } from "@/db/index.js";
import { getStreakWithBest } from "@/services/streak.service.js";

export type AchievementCategory = "tests" | "streak" | "practice" | "special";

export interface Achievement {
  key: string;
  category: AchievementCategory;
  icon: string;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  current: number;
  target: number;
  unlocked: boolean;
}

export interface XpLevel {
  xp: number;
  level: number;
  /** XP earned inside the current level */
  xpIntoLevel: number;
  /** XP needed to complete the current level */
  xpForLevel: number;
}

export interface AchievementsResult {
  xp: XpLevel;
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
}

/** Cumulative XP needed to *reach* level L (level 1 starts at 0). */
const xpToReach = (level: number): number => 100 * (level - 1) * (level - 1);

export function computeXpLevel(xp: number): XpLevel {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  return {
    xp,
    level,
    xpIntoLevel: xp - xpToReach(level),
    xpForLevel: xpToReach(level + 1) - xpToReach(level),
  };
}

interface Raw {
  tests: string;
  questions: string;
  best_score: string;
  early: string;
  active_days: string;
  best_streak: string;
  coins: string;
  subjects_mastered: string;
  correct: string;
  wrong: string;
  good60: string;
  good80: string;
  perfect_tests: string;
  night: string;
  weekend: string;
  max_day: string;
  topics_done: string;
}

export async function getAchievements(userId: string): Promise<AchievementsResult> {
  const r = await queryOne<Raw>(
    `WITH att AS (
       SELECT id, percentage, submitted_at,
              COALESCE(correct_count, 0) + COALESCE(wrong_count, 0) + COALESCE(skipped_count, 0) AS qn
       FROM test_attempts
       WHERE user_id = $1 AND status IN ('submitted', 'auto_submitted') AND submitted_at IS NOT NULL
     ),
     active AS (
       SELECT activity_date AS d FROM user_activities WHERE user_id = $1
       UNION
       SELECT (submitted_at AT TIME ZONE 'Asia/Kolkata')::date FROM att
     ),
     runs AS (
       SELECT COUNT(*) AS len
       FROM (SELECT d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM active) g
       GROUP BY grp
     ),
     mastered AS (
       SELECT s.id,
              (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id) AS total,
              (SELECT COUNT(*) FROM topic_progress tp
                 WHERE tp.user_id = $1 AND tp.subject_id = s.id
                   AND tp.status = 'completed' AND COALESCE(tp.best_accuracy, 0) >= 60) AS done
       FROM subjects s
     )
     SELECT
       (SELECT COUNT(*) FROM att) AS tests,
       (SELECT COUNT(*) FROM attempt_answers aa INNER JOIN att ON att.id = aa.attempt_id
          WHERE aa.selected_option IS NOT NULL) AS questions,
       COALESCE((SELECT MAX(percentage) FROM att WHERE qn >= 5), 0) AS best_score,
       (SELECT COUNT(*) FROM att
          WHERE EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'Asia/Kolkata') < 7) AS early,
       (SELECT COUNT(*) FROM active) AS active_days,
       GREATEST(COALESCE((SELECT MAX(len) FROM runs), 0),
                COALESCE((SELECT best_streak FROM users WHERE id = $1), 0)) AS best_streak,
       COALESCE((SELECT SUM(amount) FROM coin_transactions WHERE user_id = $1), 0) AS coins,
       (SELECT COUNT(*) FROM mastered WHERE total > 0 AND done >= total) AS subjects_mastered,
       COALESCE((SELECT SUM(correct_count) FROM test_attempts
          WHERE user_id = $1 AND status IN ('submitted', 'auto_submitted') AND submitted_at IS NOT NULL), 0) AS correct,
       COALESCE((SELECT SUM(wrong_count) FROM test_attempts
          WHERE user_id = $1 AND status IN ('submitted', 'auto_submitted') AND submitted_at IS NOT NULL), 0) AS wrong,
       (SELECT COUNT(*) FROM att WHERE qn >= 5 AND percentage >= 60) AS good60,
       (SELECT COUNT(*) FROM att WHERE qn >= 5 AND percentage >= 80) AS good80,
       (SELECT COUNT(*) FROM att WHERE qn >= 5 AND percentage >= 100) AS perfect_tests,
       (SELECT COUNT(*) FROM att
          WHERE EXTRACT(HOUR FROM submitted_at AT TIME ZONE 'Asia/Kolkata') >= 22) AS night,
       (SELECT COUNT(*) FROM att
          WHERE EXTRACT(ISODOW FROM submitted_at AT TIME ZONE 'Asia/Kolkata') >= 6) AS weekend,
       COALESCE((SELECT MAX(c) FROM (
          SELECT COUNT(*) AS c FROM att GROUP BY (submitted_at AT TIME ZONE 'Asia/Kolkata')::date) x), 0) AS max_day,
       (SELECT COUNT(*) FROM topic_progress WHERE user_id = $1 AND status = 'completed') AS topics_done`,
    [userId],
  );

  const tests = Number(r?.tests ?? 0);
  const questions = Number(r?.questions ?? 0);
  const bestScore = Math.round(Number(r?.best_score ?? 0));
  const early = Number(r?.early ?? 0);
  const activeDays = Number(r?.active_days ?? 0);
  // Same streak definition as the Dashboard and Profile
  const bestStreak = (await getStreakWithBest(userId)).bestStreak;
  const coins = Number(r?.coins ?? 0);
  const subjectsMastered = Number(r?.subjects_mastered ?? 0);
  const correct = Number(r?.correct ?? 0);
  const wrong = Number(r?.wrong ?? 0);
  const good60 = Number(r?.good60 ?? 0);
  const good80 = Number(r?.good80 ?? 0);
  const perfectTests = Number(r?.perfect_tests ?? 0);
  const night = Number(r?.night ?? 0);
  const weekend = Number(r?.weekend ?? 0);
  const maxDay = Number(r?.max_day ?? 0);
  const topicsDone = Number(r?.topics_done ?? 0);
  const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;
  // Accuracy badges need enough answers behind them to mean something
  const accuracyWhen = (minAnswers: number) => (correct + wrong >= minAnswers ? accuracy : 0);

  type Def = Omit<Achievement, "unlocked" | "current"> & { value: number };
  const n = (v: number) => v.toLocaleString("en-IN");
  const def = (
    key: string, category: AchievementCategory, icon: string, value: number, target: number,
    titleEn: string, titleHi: string, descEn: string, descHi: string,
  ): Def => ({ key, category, icon, titleEn, titleHi, descEn, descHi, value, target });

  // 60 badges: Tests 20 · Consistency 10 · Practice 20 · Special 10 (each group ordered easiest → hardest)
  const testMilestones: [number, string, string][] = [
    [1, "🚀", "first_test"], [3, "🌱", "tests_3"], [5, "🖐️", "tests_5"], [10, "📝", "tests_10"], [15, "📚", "tests_15"],
    [20, "🎒", "tests_20"], [30, "✏️", "tests_30"], [40, "🧩", "tests_40"], [50, "🎯", "tests_50"], [75, "🏹", "tests_75"],
    [100, "💯", "tests_100"], [150, "🛡️", "tests_150"], [200, "⚔️", "tests_200"], [300, "👑", "tests_300"],
  ];
  const defs: Def[] = [
    // ── Tests (20)
    ...testMilestones.map(([t, icon, key]) => t === 1
      ? def(key, "tests", icon, tests, 1, "First Step", "पहला कदम", "Complete your first test", "अपना पहला टेस्ट पूरा करें")
      : def(key, "tests", icon, tests, t, `${t} Tests`, `${t} टेस्ट`, `Complete ${t} tests`, `${t} टेस्ट पूरे करें`)),
    ...[[5, "🌤️"], [25, "☀️"], [50, "🌟"]].map(([t, icon]) =>
      def(`pass_${t}`, "tests", icon as string, good60, t as number, `${t} Good Tests`, `${t} अच्छे टेस्ट`, `Score 60%+ in ${t} tests`, `${t} टेस्ट में 60%+ स्कोर करें`)),
    ...[[5, "🔆"], [25, "💎"]].map(([t, icon]) =>
      def(`ace_${t}`, "tests", icon as string, good80, t as number, `${t} Ace Tests`, `${t} शानदार टेस्ट`, `Score 80%+ in ${t} tests`, `${t} टेस्ट में 80%+ स्कोर करें`)),
    def("marathon_day", "tests", "🏃", maxDay, 3, "Test Marathon", "टेस्ट मैराथन", "Finish 3 tests in a single day", "एक ही दिन में 3 टेस्ट पूरे करें"),

    // ── Consistency (10)
    ...[[3, "🔥", "streak_3"], [7, "⚡", "streak_7"], [14, "🌟", "streak_14"], [21, "🚄", "streak_21"], [30, "🌋", "streak_30"], [60, "🏔️", "streak_60"], [100, "🏆", "streak_100"]].map(([t, icon, key]) =>
      def(key as string, "streak", icon as string, bestStreak, t as number, `${t} Day Streak`, `${t} दिन की स्ट्रीक`, `Study ${t} days in a row`, `लगातार ${t} दिन पढ़ाई करें`)),
    def("regular_15", "streak", "🗓️", activeDays, 15, "Getting Regular", "आदत बन रही है", "Be active on 15 different days", "15 अलग-अलग दिन सक्रिय रहें"),
    def("regular_30", "streak", "📅", activeDays, 30, "Regular", "नियमित", "Be active on 30 different days", "30 अलग-अलग दिन सक्रिय रहें"),
    def("regular_60", "streak", "🧘", activeDays, 60, "Dedicated", "समर्पित", "Be active on 60 different days", "60 अलग-अलग दिन सक्रिय रहें"),

    // ── Practice (20)
    ...[[100, "✅", "questions_100"], [250, "📖", "questions_250"], [500, "🧠", "questions_500"], [1000, "🔭", "questions_1000"], [2500, "🚀", "questions_2500"], [5000, "🌌", "questions_5000"], [10000, "🏅", "questions_10000"]].map(([t, icon, key]) =>
      def(key as string, "practice", icon as string, questions, t as number, `${n(t as number)} Questions`, `${n(t as number)} प्रश्न`, `Answer ${n(t as number)} questions`, `${n(t as number)} प्रश्न हल करें`)),
    ...[[100, "🎯", 100], [500, "🏹", 500], [1000, "💡", 1000], [2500, "🔱", 2500]].map(([t, icon]) =>
      def(`correct_${t}`, "practice", icon as string, correct, t as number, `${n(t as number)} Correct`, `${n(t as number)} सही`, `Get ${n(t as number)} answers right`, `${n(t as number)} उत्तर सही दें`)),
    ...[[1, "📗"], [5, "📘"], [10, "📙"], [25, "📕"]].map(([t, icon]) =>
      def(`topics_${t}`, "practice", icon as string, topicsDone, t as number, t === 1 ? "Topic Done" : `${t} Topics`, t === 1 ? "पहला टॉपिक" : `${t} टॉपिक`, `Complete ${t} topic${t === 1 ? "" : "s"}`, `${t} टॉपिक पूरे करें`)),
    def("subject_master", "practice", "🏆", subjectsMastered, 1, "Subject Master", "विषय विशेषज्ञ", "Master every topic of a subject (60%+)", "किसी विषय के सभी टॉपिक में 60%+ लाएं"),
    def("subject_master_2", "practice", "🥈", subjectsMastered, 2, "Double Master", "दो विषयों के मास्टर", "Master 2 subjects (60%+ in every topic)", "2 विषयों में महारत पाएं (हर टॉपिक में 60%+)"),
    def("subject_master_3", "practice", "🥇", subjectsMastered, 3, "Triple Master", "तीन विषयों के मास्टर", "Master 3 subjects (60%+ in every topic)", "3 विषयों में महारत पाएं (हर टॉपिक में 60%+)"),
    def("accuracy_70", "practice", "🎖️", accuracyWhen(200), 70, "Sharp Shooter", "सटीक निशाना", "Keep 70%+ accuracy over 200+ answers", "200+ उत्तरों पर 70%+ सटीकता रखें"),
    def("accuracy_80", "practice", "🦅", accuracyWhen(500), 80, "Eagle Eye", "बाज़ की नज़र", "Keep 80%+ accuracy over 500+ answers", "500+ उत्तरों पर 80%+ सटीकता रखें"),

    // ── Special (10)
    def("high_score", "special", "🎖️", bestScore, 80, "High Scorer", "हाई स्कोरर", "Score 80%+ in a test", "किसी टेस्ट में 80%+ स्कोर करें"),
    def("score_90", "special", "🌠", bestScore, 90, "Top Scorer", "टॉप स्कोरर", "Score 90%+ in a test", "किसी टेस्ट में 90%+ स्कोर करें"),
    def("perfect", "special", "⭐", bestScore, 100, "Perfect Score", "परफेक्ट स्कोर", "Score 100% in a test", "किसी टेस्ट में 100% स्कोर करें"),
    def("perfect_3", "special", "💫", perfectTests, 3, "Perfectionist", "परफेक्शनिस्ट", "Score 100% in 3 tests", "3 टेस्ट में 100% स्कोर करें"),
    def("early_bird", "special", "🐦", early, 1, "Early Bird", "अर्ली बर्ड", "Finish a test before 7 AM", "सुबह 7 बजे से पहले टेस्ट पूरा करें"),
    def("night_owl", "special", "🦉", night, 1, "Night Owl", "नाइट आउल", "Finish a test after 10 PM", "रात 10 बजे के बाद टेस्ट पूरा करें"),
    def("weekend_5", "special", "🎉", weekend, 5, "Weekend Warrior", "वीकेंड वॉरियर", "Finish 5 tests on weekends", "वीकेंड पर 5 टेस्ट पूरे करें"),
    def("coins_100", "special", "🪙", coins, 100, "Coin Collector", "सिक्का संग्रहकर्ता", "Earn 100 coins", "100 कॉइन कमाएं"),
    def("coins_500", "special", "💰", coins, 500, "Coin Hoarder", "सिक्कों का खज़ाना", "Earn 500 coins", "500 कॉइन कमाएं"),
    def("coins_1000", "special", "🏦", coins, 1000, "Coin Tycoon", "कॉइन टाइकून", "Earn 1,000 coins", "1,000 कॉइन कमाएं"),
  ];

  const achievements: Achievement[] = defs.map(({ value, ...d }) => ({
    ...d,
    current: Math.min(value, d.target),
    unlocked: value >= d.target,
  }));

  // XP: every answered question, every test, every active day counts
  const xp = questions * 2 + tests * 20 + activeDays * 10;

  return {
    xp: computeXpLevel(xp),
    achievements,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
    totalCount: achievements.length,
  };
}
