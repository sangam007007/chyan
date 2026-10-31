# Implementation Plan: Dashboard Backend

## Overview

Implement the dashboard backend feature with three core services (leaderboard, streak tracking, rank estimation) under `/api/dashboard/*`. The implementation uses TypeScript with the existing Express + PostgreSQL + Redis stack, following established project patterns for controllers, services, middleware, and error handling.

## Tasks

- [x] 1. Database migration and configuration setup
  - [x] 1.1 Create migration `014_create-user-activities-table.ts`
    - Create `user_activities` table with columns: `id` (UUID, PK), `user_id` (UUID, FK to users), `activity_date` (DATE), `created_at` (TIMESTAMPTZ)
    - Add unique constraint on `(user_id, activity_date)` for idempotency
    - Add descending index on `(user_id, activity_date DESC)` for streak queries
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Add environment variables to `config/env.ts`
    - Add `RANK_TOTAL_APPLICANTS: z.coerce.number().int().positive()` to the env schema
    - Add `RANK_TOTAL_MARKS: z.coerce.number().positive().default(150)` to the env schema
    - _Requirements: 3.6_

- [x] 2. Implement rank estimator service
  - [x] 2.1 Create `src/services/rank-estimator.service.ts`
    - Export `RankEstimateResult` interface with fields: `estimatedRank`, `totalApplicants`, `marks`, `percentile`
    - Implement `estimateRank(marks: number): Promise<RankEstimateResult>` function
    - Formula: `rank = max(1, round(totalApplicants × (1 - marks / totalMarks)))`
    - Percentile: `round(marks / totalMarks × 100, 2)`
    - Read `RANK_TOTAL_APPLICANTS` and `RANK_TOTAL_MARKS` from env config
    - Throw `AppError` with code `CONFIG_ERROR` and status 500 if config is invalid/missing
    - Log configuration errors via `console.error`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

  - [x] 2.2 Write property test for rank estimation formula (Property 10)
    - **Property 10: Rank estimation formula and output invariants**
    - Generate random marks values (0–150, up to 2 decimal places) and verify: estimatedRank is integer ≥ 1, percentile = round(marks/150×100, 2), all four response fields present
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 2.3 Write property test for invalid marks rejection (Property 11)
    - **Property 11: Invalid marks rejected**
    - Generate random non-numeric, negative, > 150, or missing values and verify 400 validation error
    - **Validates: Requirements 3.5**

- [x] 3. Implement streak service
  - [x] 3.1 Create `src/services/streak.service.ts`
    - Export `StreakResult` interface with fields: `currentStreak`, `streakDates`, `todayRecorded`, `milestoneReached`
    - Implement `recordActivity(userId: string): Promise<void>` — insert into `user_activities` using `ON CONFLICT DO NOTHING` for idempotency; use `(NOW() AT TIME ZONE 'Asia/Kolkata')::date` for activity_date
    - Implement `getStreak(userId: string): Promise<StreakResult>` — query activity dates descending, iterate from today (IST) backward counting consecutive days, set `milestoneReached = (currentStreak === 7)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.2 Write property test for activity recording idempotency (Property 8)
    - **Property 8: Activity recording idempotency**
    - Generate random user IDs and dates, call recordActivity N times (N >= 1), verify exactly one DB record exists for that (user_id, activity_date)
    - **Validates: Requirements 2.2**

  - [x] 3.3 Write property test for streak computation correctness (Property 9)
    - **Property 9: Streak computation correctness**
    - Generate random sets of activity dates, verify streak count equals length of longest unbroken consecutive day sequence counting backward from today; if today has no record, streak is 0
    - **Validates: Requirements 2.3, 2.4, 2.6**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement leaderboard service
  - [x] 5.1 Create `src/services/leaderboard.service.ts`
    - Export `LeaderboardEntry` interface with fields: `rank`, `userId`, `fullName`, `avatarUrl`, `totalScore`
    - Export `LeaderboardResult` interface with fields: `entries` (max 50), `userRank`, `type`
    - Implement `getLeaderboard(userId: string, type: "state" | "national", examId: string | null): Promise<LeaderboardResult>`
    - State query: use DENSE_RANK with ORDER BY total_score DESC, earliest_submission ASC, filter by `selected_exam_id`
    - National query: same ranking but no exam filter
    - Exclude users with zero completed attempts (HAVING clause)
    - Limit results to 50 entries
    - Include requesting user's rank even if outside top 50 (separate query if needed)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.9, 1.10_

  - [x] 5.2 Add Redis caching to leaderboard service
    - Check Redis cache first using keys: `leaderboard:state:{examId}` or `leaderboard:national`
    - On cache miss: query DB, store result in Redis with TTL 300 seconds
    - On Redis failure: log error, fall through to DB query, skip caching
    - _Requirements: 1.8_

  - [x] 5.3 Write property test for state leaderboard filtering (Property 1)
    - **Property 1: State leaderboard filtering**
    - Generate random user sets with various exam IDs and scores, verify state leaderboard only contains users matching the specified exam and entries are sorted by total score descending
    - **Validates: Requirements 1.1**

  - [x] 5.4 Write property test for national leaderboard inclusion (Property 2)
    - **Property 2: National leaderboard includes all eligible users**
    - Generate random user sets across exams, verify national leaderboard includes all eligible users regardless of exam and entries are sorted descending by total score
    - **Validates: Requirements 1.2**

  - [x] 5.5 Write property test for leaderboard max size (Property 3)
    - **Property 3: Leaderboard max size invariant**
    - Generate datasets of 0–200 eligible users, verify entries array never exceeds 50 items
    - **Validates: Requirements 1.5**

  - [x] 5.6 Write property test for score aggregation (Property 5)
    - **Property 5: Score aggregation correctness**
    - Generate users with mixed-status test attempts, verify total score equals sum of only submitted/auto_submitted attempts
    - **Validates: Requirements 1.7**

  - [x] 5.7 Write property test for tie-breaking determinism (Property 6)
    - **Property 6: Tie-breaking determinism**
    - Generate users with identical total scores but different submission dates, verify same rank assigned and earlier submission appears first
    - **Validates: Requirements 1.9**

  - [x] 5.8 Write property test for zero-attempt exclusion (Property 7)
    - **Property 7: Zero-attempt users excluded**
    - Generate datasets including zero-score users, verify no entry has total_score of 0 and no user without eligible attempts appears
    - **Validates: Requirements 1.10**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement dashboard controller and route wiring
  - [x] 7.1 Create `src/controllers/dashboard.controller.ts`
    - Create Express Router with `jwtAuth` middleware applied to all routes
    - Implement `GET /leaderboard` handler: validate `type` query param with Zod (`z.enum(["state", "national"])`), fetch user's `selected_exam_id` from DB for state type, call `getLeaderboard`, return JSON response
    - Return 400 with `NO_EXAM_SELECTED` if state type requested and user has no exam selected
    - Implement `POST /activity` handler: call `recordActivity(userId)`, return `{ success: true }`
    - Implement `GET /streak` handler: call `getStreak(userId)`, return JSON response
    - Implement `GET /rank-estimate` handler: validate `marks` query param with Zod (number, 0–150, max 2 decimal places), call `estimateRank`, return JSON response
    - All validation errors return 400 with `VALIDATION_ERROR` code in standard error format
    - _Requirements: 1.1, 1.6, 2.1, 2.3, 3.1, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 7.2 Register dashboard routes in `src/routes/index.ts`
    - Import `dashboardRouter` from `@/controllers/dashboard.controller.js`
    - Add `router.use("/api/dashboard", dashboardRouter)` to the central router
    - _Requirements: 4.1_

  - [x] 7.3 Write property test for invalid leaderboard type (Property 4)
    - **Property 4: Invalid leaderboard type rejected**
    - Generate random strings that are not "state" or "national", verify 400 validation error returned
    - **Validates: Requirements 1.6**

  - [x] 7.4 Write unit tests for dashboard controller
    - Test milestone flag: streak of exactly 7 → `milestone_reached: true`; 6 and 8 → false
    - Test config error: invalid `RANK_TOTAL_APPLICANTS` → 500 with `CONFIG_ERROR`
    - Test self-rank inclusion: user at rank 51 still appears in response
    - Test IST boundary: activity at 23:59 IST and 00:01 IST next day produce correct dates
    - Test all endpoints return 401 without valid JWT
    - _Requirements: 2.5, 3.7, 1.4, 2.7, 4.1, 4.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design specifies TypeScript throughout, matching the project's existing stack
- Redis caching is a performance optimization; the leaderboard should gracefully degrade when Redis is unavailable
- All date operations use IST (UTC+5:30) via `AT TIME ZONE 'Asia/Kolkata'` in SQL

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "5.1"] },
    { "id": 3, "tasks": ["5.2"] },
    { "id": 4, "tasks": ["5.3", "5.4", "5.5", "5.6", "5.7", "5.8"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "7.4"] }
  ]
}
```
