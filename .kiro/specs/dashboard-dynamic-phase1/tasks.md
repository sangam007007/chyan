# Implementation Plan: Dashboard Dynamic Phase 1

## Overview

Replace all hardcoded dashboard data with real backend-driven data across four feature areas: Dynamic Streak (with best streak), Days Left countdown, Coins gamification system, and functional Daily Quiz. Implementation follows a bottom-up approach — database migrations first, then services, controllers, route registration, and finally frontend hooks and component updates.

## Tasks

- [x] 1. Database migrations
  - [x] 1.1 Create migration 015 — add `best_streak` column to `users` table
    - Add `best_streak INTEGER NOT NULL DEFAULT 0` to the `users` table
    - Use `ALTER TABLE users ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0`
    - _Requirements: 2.2, 2.4_

  - [x] 1.2 Create migration 016 — add `exam_date` column to `exams` table
    - Add `exam_date DATE` (nullable) to the `exams` table
    - Use `ALTER TABLE exams ADD COLUMN exam_date DATE`
    - _Requirements: 3.6_

  - [x] 1.3 Create migration 017 — create `coin_transactions` table
    - Create `coin_transactions` table with columns: id (UUID PK), user_id (UUID FK → users), type (VARCHAR(20)), amount (INTEGER), reference_id (VARCHAR(255) nullable), created_at (TIMESTAMPTZ)
    - Add CHECK constraint for type IN ('daily_login', 'streak_bonus_7', 'referral', 'quiz_complete', 'test_complete')
    - Add CHECK constraint for amount > 0
    - Create unique partial indexes: `uq_coin_daily_login` (daily login per IST day), `uq_coin_quiz_daily` (quiz complete per IST day), `uq_coin_test_attempt` (test complete per reference_id), `uq_coin_referral` (referral per reference_id)
    - Create index `idx_coin_transactions_user` on (user_id, created_at DESC)
    - _Requirements: 4.1, 5.3, 6.3_

  - [x] 1.4 Create migration 018 — create `daily_quiz_attempts` table
    - Create `daily_quiz_attempts` table with columns: id (UUID PK), user_id (UUID FK → users), quiz_date (DATE), question_ids (UUID[]), answers (SMALLINT[]), score (SMALLINT nullable), time_taken_seconds (INTEGER nullable), status (VARCHAR(15) DEFAULT 'in_progress'), created_at (TIMESTAMPTZ), submitted_at (TIMESTAMPTZ nullable)
    - Add CHECK constraint for status IN ('in_progress', 'submitted')
    - Add UNIQUE constraint on (user_id, quiz_date)
    - Create index `idx_daily_quiz_user_date` on (user_id, quiz_date DESC)
    - _Requirements: 10.4, 10.5_

- [x] 2. Checkpoint — Verify migrations
  - Ensure all migrations run cleanly with `npm run migrate`, ask the user if questions arise.

- [x] 3. Backend — Coins Service
  - [x] 3.1 Create `packages/backend/src/services/coins.service.ts`
    - Implement `getBalance(userId)` — query SUM of amounts from `coin_transactions` for user, with Redis cache (key `coins:balance:{userId}`, TTL 60s)
    - Implement `getHistory(userId, limit, offset)` — query coin_transactions ordered by created_at DESC with pagination
    - Implement `earnCoins(userId, type, referenceId?)` — validate eligibility based on type then INSERT transaction; invalidate Redis cache on success
    - Implement internal validators: `validateDailyLogin`, `validateStreakBonus`, `validateQuizComplete`, `validateTestComplete`, `validateReferral`
    - Use `withTransaction` for atomic validation + insert
    - Catch unique constraint violations and return `{ awarded: false }` for race conditions
    - Coin amounts: daily_login=10, streak_bonus_7=50, referral=200, quiz_complete=5, test_complete=10
    - _Requirements: 4.1, 4.4, 4.5, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 3.2 Write property tests for Coins Service — coin balance correctness
    - **Property 5: Coin balance equals sum of transactions**
    - **Validates: Requirements 4.1**

  - [ ]* 3.3 Write property tests for Coins Service — daily login idempotency
    - **Property 6: Daily login earning idempotency**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 3.4 Write property tests for Coins Service — streak bonus once per cycle
    - **Property 7: Seven-day streak bonus — once per cycle**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 3.5 Write property tests for Coins Service — referral uniqueness
    - **Property 8: Referral earning uniqueness**
    - **Validates: Requirements 7.1, 7.2, 7.3**

  - [ ]* 3.6 Write property tests for Coins Service — quiz completion idempotency
    - **Property 9: Quiz completion earning idempotency**
    - **Validates: Requirements 8.1, 8.3**

  - [ ]* 3.7 Write property tests for Coins Service — test completion idempotency
    - **Property 10: Test completion earning idempotency**
    - **Validates: Requirements 8.2, 8.4**

- [x] 4. Backend — Daily Quiz Service
  - [x] 4.1 Create `packages/backend/src/services/daily-quiz.service.ts`
    - Implement `getQuizStatus(userId)` — check `daily_quiz_attempts` for today's IST date, return status ('not_started' | 'in_progress' | 'completed') with Redis cache (key `daily-quiz:status:{userId}:{date}`, TTL 300s)
    - Implement `startQuiz(userId)` — enforce one-per-day constraint (return existing if found), select 10 random questions from user's exam subjects where is_active=true, excluding questions answered in last 30 days (fallback to seen questions if < 10 fresh), INSERT attempt record
    - Implement `submitQuiz(userId, attemptId, answers)` — validate attempt belongs to user and is 'in_progress', compute score by comparing answers to correct_option, update attempt with score + status='submitted' + submitted_at + time_taken_seconds, invalidate Redis cache
    - Implement `getQuizResult(userId, attemptId)` — return full attempt with correct options and explanations
    - Use `withTransaction` for submission flow
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 12.1_

  - [ ]* 4.2 Write property tests for Daily Quiz Service — exactly 10 questions
    - **Property 11: Quiz generation — exactly 10 questions**
    - **Validates: Requirements 9.1**

  - [ ]* 4.3 Write property tests for Daily Quiz Service — correct subjects only
    - **Property 12: Quiz generation — correct subjects only**
    - **Validates: Requirements 9.2**

  - [ ]* 4.4 Write property tests for Daily Quiz Service — active questions only
    - **Property 13: Quiz generation — active questions only**
    - **Validates: Requirements 9.3**

  - [ ]* 4.5 Write property tests for Daily Quiz Service — no 30-day repeats
    - **Property 14: Quiz generation — no 30-day repeats**
    - **Validates: Requirements 9.4**

  - [ ]* 4.6 Write property tests for Daily Quiz Service — scoring correctness
    - **Property 15: Quiz scoring correctness**
    - **Validates: Requirements 10.3**

  - [ ]* 4.7 Write property tests for Daily Quiz Service — one attempt per day
    - **Property 16: One quiz attempt per user per day**
    - **Validates: Requirements 10.5, 10.6**

- [x] 5. Backend — Enhanced Streak Service
  - [x] 5.1 Enhance `packages/backend/src/services/streak.service.ts`
    - Update `StreakResult` interface to add `bestStreak: number`
    - Implement `getStreakWithBest(userId)` — call existing streak computation, then query `users.best_streak`, return combined result
    - Update `recordActivity(userId)` — after INSERT, compute current streak and use `UPDATE users SET best_streak = GREATEST(best_streak, $1) WHERE id = $2` to persist best streak
    - Keep existing `getStreak` function for backward compatibility, but have the controller use `getStreakWithBest`
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.2 Write property tests for enhanced Streak Service — streak computation
    - **Property 1: Streak computation correctness**
    - **Validates: Requirements 1.1**

  - [ ]* 5.3 Write property tests for enhanced Streak Service — best streak monotonicity
    - **Property 2: Best streak monotonicity**
    - **Validates: Requirements 2.1, 2.3**

  - [ ]* 5.4 Write property tests for enhanced Streak Service — activity idempotency
    - **Property 3: Activity recording idempotency**
    - **Validates: Requirements 1.5**

- [x] 6. Checkpoint — Verify backend services compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Backend — API Controllers
  - [x] 7.1 Create `packages/backend/src/controllers/coins.controller.ts`
    - `GET /balance` — call `getBalance(userId)`, return `{ success: true, data: { balance, lastEarnedAt } }`
    - `GET /history` — accept query params `limit` (default 20, max 50) and `offset` (default 0), call `getHistory`, return `{ success: true, data: { transactions, total } }`
    - `POST /earn` — accept body `{ type: CoinEventType, referenceId?: string }`, validate with Zod, call `earnCoins`, return `{ success: true, data: { awarded, amount, newBalance } }`
    - All routes require `jwtAuth` middleware
    - Export as `coinsRouter`
    - _Requirements: 4.4, 4.5, 8.5_

  - [x] 7.2 Create `packages/backend/src/controllers/daily-quiz.controller.ts`
    - `GET /status` — call `getQuizStatus(userId)`, return `{ success: true, data: { status, attempt? } }`
    - `POST /start` — call `startQuiz(userId)`, return attempt without correct answers
    - `POST /submit` — accept body `{ attemptId: string, answers: (number|null)[] }`, validate with Zod, call `submitQuiz`, trigger coin earning for quiz_complete, return `{ success: true, data: { score, correctAnswers } }`
    - `GET /result/:id` — call `getQuizResult(userId, id)`, return full attempt with explanations
    - All routes require `jwtAuth` middleware
    - Export as `dailyQuizRouter`
    - _Requirements: 9.1, 10.1, 10.2, 10.3, 10.5, 10.6, 11.1, 11.2, 12.1_

  - [x] 7.3 Enhance `packages/backend/src/controllers/dashboard.controller.ts`
    - Update `GET /streak` handler to use `getStreakWithBest` and return `{ currentStreak, bestStreak, streakDates, todayRecorded }`
    - Add `GET /home` endpoint that returns combined: streak data, days_left (computed from user's selected exam's exam_date using IST day diff), exam_date formatted, and coin balance
    - Days-left logic: query user's selected_exam_id → get exam_date → compute `max(0, diffInCalendarDays(examDate, todayIST))`, return null if no exam or no exam_date
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1_

  - [ ]* 7.4 Write property test for days-left computation
    - **Property 4: Days-left computation**
    - **Validates: Requirements 3.1, 3.5**

- [x] 8. Backend — Route Registration
  - [x] 8.1 Register new routers in `packages/backend/src/routes/index.ts`
    - Import `coinsRouter` from `@/controllers/coins.controller.js`
    - Import `dailyQuizRouter` from `@/controllers/daily-quiz.controller.js`
    - Mount: `router.use("/api/coins", coinsRouter)` and `router.use("/api/daily-quiz", dailyQuizRouter)`
    - _Requirements: 4.4, 4.5, 8.5_

- [x] 9. Checkpoint — Verify backend compiles and routes resolve
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Frontend — Hooks
  - [x] 10.1 Create `packages/frontend/src/hooks/useCoins.ts`
    - Fetch from `GET /api/coins/balance`
    - Return `{ balance: number | null, isLoading: boolean, error: boolean, refetch: () => void }`
    - Follow same pattern as existing `useStreak` hook (AbortController, state management)
    - _Requirements: 4.1, 4.2_

  - [x] 10.2 Create `packages/frontend/src/hooks/useDaysLeft.ts`
    - Fetch from `GET /api/dashboard/home` and extract daysLeft + examDateFormatted
    - Return `{ daysLeft: number | null, examDateFormatted: string | null, isLoading: boolean }`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 10.3 Create `packages/frontend/src/hooks/useDailyQuiz.ts`
    - Fetch quiz status from `GET /api/daily-quiz/status`
    - Expose `startQuiz()` → POST /api/daily-quiz/start
    - Expose `submitQuiz(answers)` → POST /api/daily-quiz/submit
    - Return `{ status: QuizStatus | null, isLoading: boolean, startQuiz, submitQuiz }`
    - _Requirements: 10.5, 10.6, 11.1, 11.2_

  - [x] 10.4 Enhance `packages/frontend/src/hooks/useStreak.ts`
    - Update the `StreakResponse` type to include `bestStreak: number`
    - Ensure the hook returns `bestStreak` from the API response (response now comes from `/api/dashboard/streak` with the additional field)
    - _Requirements: 1.2, 1.3, 1.4_

- [x] 11. Frontend — Component Updates
  - [x] 11.1 Update `packages/frontend/src/components/dashboard/StatsRow.tsx`
    - Add props: `bestStreak: number`, `daysLeft: number | null`, `examDateFormatted: string | null`, `coinBalance: number | null`, `onCoinsClick: () => void`
    - Replace hardcoded "Best" sub-text with actual `bestStreak` value
    - Replace hardcoded "72" days left with `daysLeft` (display "--" if null)
    - Replace hardcoded "Exam: 13 Oct" with `examDateFormatted` (display "--" if null)
    - Replace hardcoded "1250" coins with `coinBalance` (display "--" if null)
    - Attach `onCoinsClick` handler to the Coins card
    - _Requirements: 1.3, 1.4, 3.2, 3.3, 3.4, 4.2_

  - [x] 11.2 Update `packages/frontend/src/components/dashboard/DailyQuizCard.tsx`
    - Add props: `quizStatus: QuizStatus`, `onStart: () => void`, `onReattempt: () => void`, `onViewResult: () => void`
    - Show "Start Quiz" button when status is 'not_started' → calls `onStart`
    - Show score + "Reattempt" + "View Result" buttons when status is 'completed'
    - Show progress indicator when status is 'in_progress'
    - Maintain bilingual support using `language` prop
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 12.2_

  - [x] 11.3 Update `packages/frontend/src/pages/DashboardPage.tsx`
    - Import and use `useCoins`, `useDaysLeft`, `useDailyQuiz` hooks
    - Pass dynamic props to `StatsRow`: bestStreak, daysLeft, examDateFormatted, coinBalance, onCoinsClick
    - Pass dynamic props to `DailyQuizCard`: quizStatus, onStart, onReattempt, onViewResult
    - Add CoinsModal state and toggle via onCoinsClick
    - _Requirements: 1.3, 1.4, 3.2, 4.2, 4.3, 11.1, 11.2_

- [ ] 12. Frontend — Bilingual quiz support and midnight refresh
  - [x] 12.1 Add bilingual rendering logic to DailyQuizCard
    - Display quiz questions using `text_en`/`text_hi` based on current language
    - Display options using `option_a_en`/`option_a_hi` etc. based on current language
    - Support language toggle during quiz without restarting timer
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 12.2 Add midnight IST refresh to DailyQuizCard
    - Calculate time until next IST midnight
    - Set a timeout to re-fetch quiz status at midnight IST
    - Ensure the card shows "Start Quiz" for the new day automatically
    - _Requirements: 11.5_

- [x] 13. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses `fast-check` v3.22.0 for property-based testing and `vitest` for unit tests
- Redis caching is optional graceful degradation — services must work without Redis (fallback to DB)
- All IST day boundaries use `(NOW() AT TIME ZONE 'Asia/Kolkata')::date` at the DB level

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 4, "tasks": ["7.4", "8.1"] },
    { "id": 5, "tasks": ["10.1", "10.2", "10.3", "10.4"] },
    { "id": 6, "tasks": ["11.1", "11.2"] },
    { "id": 7, "tasks": ["11.3", "12.1", "12.2"] }
  ]
}
```
