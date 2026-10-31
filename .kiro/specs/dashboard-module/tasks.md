# Implementation Plan: Dashboard Module

## Overview

Implement the Dashboard module as the primary home screen for authenticated users. The implementation follows a bottom-up approach: database migrations first, then backend services with Redis caching, followed by the dashboard controller/routes, and finally frontend components with the useDashboard hook and responsive layout. All code is TypeScript, using the existing Express + React + Vitest + fast-check stack.

## Tasks

- [ ] 1. Database migrations and schema setup
  - [ ] 1.1 Create migration to add streak columns to users table
    - Add `streak_count INTEGER NOT NULL DEFAULT 0` and `last_practice_date DATE` columns to the existing `users` table
    - File: `packages/backend/migrations/007_add-streak-columns-to-users.ts`
    - _Requirements: 7.6_

  - [ ] 1.2 Create migration for daily_quizzes table
    - Create `daily_quizzes` table with columns: id (UUID PK), exam_id (FK to exams), test_id (FK to tests), quiz_date (DATE), subject_focus (VARCHAR(50)), created_at (TIMESTAMPTZ)
    - Add UNIQUE constraint on (exam_id, quiz_date)
    - Add index on (exam_id, quiz_date)
    - File: `packages/backend/migrations/008_create-daily-quizzes-table.ts`
    - _Requirements: 3.1, 3.7_

- [ ] 2. Backend services — StatsService and StreakService
  - [ ] 2.1 Implement StatsService
    - Create `packages/backend/src/services/dashboard/stats.service.ts`
    - Implement `getUserStats(userId, examId)` computing tests completed, average score (1 decimal), rank
    - Implement `computeRank(userId, examId)` with tie-breaking by most recent submission date
    - Implement `invalidateStats(userId, examId)` to delete Redis cache key
    - Implement rank badge mapping: constable / head_constable / si / inspector based on rank thresholds
    - Use Redis cache key `dashboard:stats:{userId}:{examId}` with TTL 60s
    - Fall back to DB query if Redis unavailable
    - _Requirements: 2.1, 2.3, 2.4, 2.5, 2.6, 2.7, 12.1, 12.6, 12.7, 12.8_

  - [ ]* 2.2 Write property tests for StatsService (Properties 2, 3, 4)
    - **Property 2: Average score computation** — For any non-empty array of scores [0.0, 100.0], computed average equals arithmetic mean rounded to 1 decimal
    - **Property 3: Rank ordering** — For any set of users with scores, higher average → lower rank number; ties broken by earlier recent submission
    - **Property 4: Rank badge mapping** — For any valid rank, returns exactly one badge; mapping is deterministic and monotonically non-decreasing
    - **Validates: Requirements 2.3, 2.4, 2.6**

  - [ ] 2.3 Implement StreakService
    - Create `packages/backend/src/services/dashboard/streak.service.ts`
    - Implement `getUserStreak(userId)` that checks last_practice_date vs current IST date and computes streak count
    - Reset streak to 0 if previous IST calendar day was missed
    - Implement `recordPracticeDay(userId)` that updates streak_count and last_practice_date
    - Compute `showWarning` (active streak + not practiced today) and `showFlame` (count >= 7)
    - All date logic uses UTC+5:30 calendar day boundaries
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 2.4 Write property tests for StreakService (Property 11)
    - **Property 11: Streak computation** — For any sequence of submission timestamps and reference date, streak equals longest consecutive IST calendar day sequence ending on today/yesterday with at least one submission per day
    - **Validates: Requirements 7.1, 7.2, 7.5**

- [ ] 3. Backend services — DailyQuizService and ProgressService
  - [ ] 3.1 Implement DailyQuizService
    - Create `packages/backend/src/services/dashboard/daily-quiz.service.ts`
    - Implement `getTodayQuiz(examId)` selecting a 10-question quiz, rotating subjects across the week
    - Implement `getUserQuizStatus(userId, quizTestId)` returning not_started | in_progress | completed | unavailable
    - Cache daily quiz in Redis key `dashboard:quiz:{examId}:{YYYY-MM-DD}` with TTL computed as seconds until next midnight IST
    - Implement helper `computeTtlUntilMidnightIST()` returning seconds remaining until 00:00 IST
    - Subject rotation: ensure each of 4 subjects (GK, Math, Reasoning, Hindi) appears at least once per 7-day cycle
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 12.3_

  - [ ]* 3.2 Write property tests for DailyQuizService (Properties 5, 6, 15)
    - **Property 5: Daily quiz uniqueness** — For any exam and date, at most one quiz selection; same (exam, date) always resolves to same quiz
    - **Property 6: Subject rotation coverage** — For any 7-day window, all 4 subjects appear as primary focus at least once
    - **Property 15: Cache TTL until midnight IST** — For any timestamp, computed TTL is positive integer between 1 and 86400
    - **Validates: Requirements 3.1, 3.7, 12.3**

  - [ ] 3.3 Implement ProgressService
    - Create `packages/backend/src/services/dashboard/progress.service.ts`
    - Implement `getProgressData(userId, examId, period)` computing daily/weekly average scores
    - For weekly: last 7 days with day-by-day averages; for monthly: last 30 days with week-by-week averages
    - Omit days with zero attempts (no data point for those days)
    - Round averages to nearest integer
    - Return `hasEnoughData: false` if fewer than 2 data points
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ]* 3.4 Write property tests for ProgressService (Property 7)
    - **Property 7: Progress daily average with empty day omission** — For any set of attempts within a date range, returns one point per day with attempts (mean rounded to integer), no points for empty days
    - **Validates: Requirements 4.2**

- [ ] 4. Checkpoint — Verify backend services
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Backend services — LeaderboardService and CategoryService
  - [ ] 5.1 Implement LeaderboardService
    - Create `packages/backend/src/services/dashboard/leaderboard.service.ts`
    - Implement `getLeaderboardPreview(examId, userId, limit=5)` returning top N users
    - Ranking: average score descending (1 decimal), ties broken by total tests completed descending
    - Include current user's entry if not in top N
    - Truncate user names to 15 chars with ellipsis
    - Cache in Redis key `dashboard:leaderboard:{examId}` with TTL 300s
    - Handle fewer than 5 users gracefully
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8, 6.9, 12.2_

  - [ ]* 5.2 Write property tests for LeaderboardService (Properties 9, 10)
    - **Property 9: Leaderboard ranking** — For any set of users with scores and test counts, ordering is by score desc then tests desc
    - **Property 10: Name truncation** — For any string, display name is original if ≤15 chars, or first 15 + "…" if longer
    - **Validates: Requirements 6.2, 6.5**

  - [ ] 5.3 Implement CategoryService
    - Create `packages/backend/src/services/dashboard/category.service.ts`
    - Implement `getCategoryCounts(examId)` returning counts for topic_wise, sectional, full_mock, previous_year
    - Count only published tests within active schedule window
    - Set `enabled: false` for categories with zero tests
    - Include bilingual titles (titleHi, titleEn) and icon identifiers
    - Cache in Redis key `dashboard:categories:{examId}` with TTL 300s
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.7, 12.6_

  - [ ]* 5.4 Write property tests for CategoryService (Property 8)
    - **Property 8: Category count correctness** — For any set of tests with an exam, category count equals number of published tests with active schedule in that category
    - **Validates: Requirements 5.3**

- [ ] 6. Dashboard controller and routes
  - [ ] 6.1 Implement DashboardController
    - Create `packages/backend/src/controllers/dashboard.controller.ts`
    - Implement `getDashboard` handler: validate JWT user, get user's selected examId from profile, run all 6 service calls in parallel using `Promise.allSettled`
    - Return partial success: sections that succeed as data, sections that fail as null with error messages in `errors` map
    - Return 400 with code `EXAM_NOT_SELECTED` if user has no selected exam
    - Return 503 if all sections fail
    - Implement `refreshDashboard` handler: same as getDashboard but passes `forceRefresh: true` to bypass Redis cache
    - Apply Zod validation for query params (period, forceRefresh)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.7, 1.8, 11.5, 12.4, 12.5_

  - [ ] 6.2 Register dashboard routes
    - Create route definitions: `GET /api/dashboard` and `POST /api/dashboard/refresh`, both protected by `jwtAuth` middleware
    - Register in `packages/backend/src/routes/index.ts`
    - _Requirements: 1.1, 1.2_

- [ ] 7. Checkpoint — Verify backend API
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Frontend utilities (formatters, i18n-utils)
  - [ ] 8.1 Implement formatter utilities
    - Create `packages/frontend/src/utils/formatters.ts`
    - Implement `truncateName(name: string, maxLength: number): string` — truncate to maxLength with ellipsis
    - Implement `formatNumber(value: number, locale: 'hi' | 'en'): string` — Indian grouping for Hindi, international for English
    - Implement `formatScore(score: number | null): string` — display "—" for null, "X.Y%" for numbers
    - Implement `formatDate(date: string, locale: 'hi' | 'en'): string` — DD/MM/YYYY format
    - _Requirements: 6.5, 8.6_

  - [ ]* 8.2 Write property tests for formatters (Properties 10, 13)
    - **Property 10: Name truncation** — For any string, result is original if ≤15 chars or first 15 + "…" if longer
    - **Property 13: Number formatting by locale** — Hindi uses X,XX,XXX grouping; English uses XXX,XXX grouping; both use Arabic digits
    - **Validates: Requirements 6.5, 8.6**

  - [ ] 8.3 Implement i18n-utils
    - Create `packages/frontend/src/utils/i18n-utils.ts`
    - Implement `selectBilingualField(obj: {hi?: string, en?: string}, lang: 'hi' | 'en'): string` — select preferred language with English fallback
    - Implement `getDashboardLabels(lang: 'hi' | 'en')` — return all static UI labels in chosen language
    - _Requirements: 8.1, 8.4, 8.5_

  - [ ]* 8.4 Write property tests for i18n-utils (Property 12)
    - **Property 12: Bilingual field selection with fallback** — Returns preferred language field if non-empty, falls back to English if preferred is empty/missing
    - **Validates: Requirements 8.4, 8.5**

- [ ] 9. Frontend hook and dashboard service
  - [ ] 9.1 Implement dashboard API service
    - Create `packages/frontend/src/services/dashboard.service.ts`
    - Implement `fetchDashboard(period, forceRefresh)` calling `GET /api/dashboard`
    - Implement `refreshDashboard()` calling `POST /api/dashboard/refresh`
    - Handle auth errors (redirect to login) and exam-not-selected (redirect to exam selection)
    - _Requirements: 1.1, 1.2, 1.8_

  - [ ] 9.2 Implement useDashboard hook
    - Create `packages/frontend/src/hooks/useDashboard.ts`
    - Return `{data, isLoading, error, sectionErrors, refetch, retrySection, retryCounts}`
    - Implement stale-while-revalidate: show cached data immediately, fetch fresh in background, discard data > 10 min stale
    - Track per-section retry counts; disable retry after 3 consecutive failures (state = 'exhausted')
    - Auto-retry failed sections on online event (not exhausted sections)
    - Filter all data by user's selected examId from AuthContext
    - _Requirements: 1.4, 1.6, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 12.4_

  - [ ]* 9.3 Write property tests for useDashboard (Properties 1, 14)
    - **Property 1: Exam-scoped data filtering** — For any user with selected exam, all returned data is scoped to that exam
    - **Property 14: Retry limit enforcement** — After 3 consecutive failures, section marked as exhausted; no further auto-retries until page reload
    - **Validates: Requirements 1.3, 11.4**

- [ ] 10. Frontend components — QuickStatsCard, TodayQuizCard, StreakIndicator
  - [ ] 10.1 Implement QuickStatsCard component
    - Create `packages/frontend/src/components/dashboard/QuickStatsCard.tsx`
    - Display tests completed, average score (formatted), rank with badge icon
    - Handle loading state (skeleton shimmer), error state (error card + retry), empty state (zeros + dashes)
    - Use bilingual labels from i18n-utils
    - Minimum tap target 44x44px for interactive elements
    - _Requirements: 2.1, 2.2, 2.6, 2.7, 9.3, 11.1, 11.2, 11.8_

  - [ ] 10.2 Implement TodayQuizCard component
    - Create `packages/frontend/src/components/dashboard/TodayQuizCard.tsx`
    - Display quiz title (bilingual), subjects, question count, duration, action button
    - Button states: "Start Quiz" (not_started), "Resume" (in_progress), "View Score" (completed), placeholder (unavailable)
    - Navigate to test attempt on start/resume, show score on view
    - Handle loading/error/empty states
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 9.3, 11.1, 11.2_

  - [ ] 10.3 Implement StreakIndicator component
    - Create `packages/frontend/src/components/dashboard/StreakIndicator.tsx`
    - Display streak count with flame icon (≥7 days) or warning icon (active streak + not practiced today)
    - Show localized warning message when applicable
    - Handle loading/error states
    - _Requirements: 7.1, 7.3, 7.4, 9.3, 11.1_

- [ ] 11. Frontend components — ProgressChart, CategoryNavigator, LeaderboardPreview
  - [ ] 11.1 Implement ProgressChart component
    - Create `packages/frontend/src/components/dashboard/ProgressChart.tsx`
    - Render line chart with x-axis (day labels or week dates) and y-axis (0–100% score)
    - Provide weekly/monthly toggle (default: weekly)
    - Show "attempt more tests" message if hasEnoughData is false
    - Tap navigates to full Analytics page
    - Handle loading/error states with skeleton and retry
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 9.3, 11.1, 11.2_

  - [ ] 11.2 Implement CategoryNavigator component
    - Create `packages/frontend/src/components/dashboard/CategoryNavigator.tsx`
    - Display 4 categories (Topic-wise, Sectional, Full Mock, Previous Year) with icons, bilingual titles, test counts
    - 2x2 grid on mobile (<768px), horizontal row on desktop (≥768px)
    - Disabled state (reduced opacity + "Coming Soon") for categories with zero tests
    - Tap navigates to test listing with category filter
    - Handle loading/error states
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.3, 11.1, 11.2_

  - [ ] 11.3 Implement LeaderboardPreview component
    - Create `packages/frontend/src/components/dashboard/LeaderboardPreview.tsx`
    - Display top 5 entries with rank, truncated name, avatar, average score
    - Highlight current user's entry with gold background if in top 5
    - Show 6th row with user's own rank if not in top 5
    - Tap navigates to full Leaderboard page
    - Handle loading/error/empty states
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 9.3, 11.1, 11.2_

- [ ] 12. Checkpoint — Verify frontend components
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. DashboardPage container and integration
  - [ ] 13.1 Implement DashboardPage with responsive layout
    - Update `packages/frontend/src/pages/DashboardPage.tsx`
    - Use useDashboard hook for data fetching
    - Single-column layout on mobile (<768px): Quick Stats → Today's Quiz → Streak → Categories → Progress → Leaderboard
    - Multi-column layout on desktop (≥768px): Quick Stats + Today's Quiz side-by-side, rest flows responsively
    - Implement pull-to-refresh (touch gesture on mobile, refresh button on desktop)
    - Show full-page error state when all sections fail
    - Apply police-themed colors: background #F0F4F8, cards white, text Navy #1B3A5C, accent Gold #C5A028, urgent Red #E63946
    - No horizontal scrolling on any screen ≥320px
    - Display user avatar + name in header area (linking to Profile)
    - Display notification bell icon with unread badge
    - _Requirements: 1.1, 1.4, 1.5, 1.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.3, 10.4, 10.5, 10.6, 10.7, 11.1, 11.5_

  - [ ] 13.2 Add i18n translations for dashboard
    - Add dashboard section labels, button text, error messages, empty states to `packages/frontend/src/i18n/` translation files (English + Hindi)
    - Add backend i18n entries to `packages/backend/src/i18n/en.json` and `packages/backend/src/i18n/hi.json` for error messages
    - _Requirements: 8.1, 8.2, 8.3, 8.7_

  - [ ] 13.3 Wire language toggle for dashboard
    - Ensure the Language_Toggle in the header triggers re-render of all dashboard content in the newly selected language
    - Persist language preference via existing profile update mechanism
    - Apply within 1 second without full page reload
    - _Requirements: 8.2, 8.3_

- [ ] 14. Final integration and wiring
  - [ ] 14.1 Verify router integration
    - Confirm DashboardPage renders at `/dashboard` route within AuthGuard + AppLayout
    - Confirm root `/` redirects to `/dashboard`
    - Confirm unauthenticated users are redirected to login
    - Confirm users without selected exam are redirected to exam selection
    - _Requirements: 1.2, 1.8, 10.1, 10.2, 10.3_

  - [ ]* 14.2 Write integration tests for dashboard endpoint
    - Test full GET /api/dashboard with seeded DB data returns all sections
    - Test partial failure (mock one service to throw) returns partial response
    - Test Redis cache hit/miss behavior and TTL
    - Test cache invalidation on force-refresh
    - Test 401 for unauthenticated requests
    - Test 400 for users without selected exam
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.8, 12.6, 12.7_

- [ ] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All services follow the existing pattern: Redis cache check → DB fallback → compute → cache result
- The frontend follows existing patterns: hooks for data, context for auth state, i18n provider for translations
- Backend services are placed in `packages/backend/src/services/dashboard/` subdirectory per the design's file organization

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3", "8.1", "8.3"] },
    { "id": 2, "tasks": ["2.2", "2.4", "3.1", "3.3", "8.2", "8.4"] },
    { "id": 3, "tasks": ["3.2", "3.4", "5.1", "5.3"] },
    { "id": 4, "tasks": ["5.2", "5.4", "6.1"] },
    { "id": 5, "tasks": ["6.2", "9.1"] },
    { "id": 6, "tasks": ["9.2"] },
    { "id": 7, "tasks": ["9.3", "10.1", "10.2", "10.3"] },
    { "id": 8, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 9, "tasks": ["13.1", "13.2"] },
    { "id": 10, "tasks": ["13.3", "14.1"] },
    { "id": 11, "tasks": ["14.2"] }
  ]
}
```
