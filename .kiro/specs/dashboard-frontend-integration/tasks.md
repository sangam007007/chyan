# Implementation Plan: Dashboard Frontend Integration

## Overview

Replace all hardcoded mock data in `DashboardPage.tsx` with real API calls to `/api/dashboard/*` endpoints. This involves creating a typed service layer, custom React hooks with AbortController-based cancellation, extracting sub-components for each dashboard section, and wiring everything together with proper loading/error states.

## Tasks

- [x] 1. Create TypeScript interfaces and service layer
  - [x] 1.1 Create `dashboard.types.ts` with all TypeScript interfaces
    - Create `/packages/frontend/src/services/dashboard.types.ts`
    - Define `LeaderboardEntry`, `LeaderboardResponse`, `StreakResponse`, `RankEstimateResponse`, `ApiResponse<T>`, `ApiErrorResponse`, and `ValidationResult` interfaces
    - _Requirements: 1.4, 2.2, 2.3, 4.2_

  - [x] 1.2 Create `dashboard.service.ts` with API call functions and error parsers
    - Create `/packages/frontend/src/services/dashboard.service.ts`
    - Implement `fetchLeaderboard(type, signal)`, `fetchStreak(signal)`, `fetchRankEstimate(marks, signal)`, `recordActivity(signal)`
    - Implement `parseLeaderboardError` and `parseRankEstimateError` helper functions
    - All requests use 15-second timeout override
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 6.6_

- [x] 2. Implement custom hooks
  - [x] 2.1 Implement `useLeaderboard` hook
    - Create `/packages/frontend/src/hooks/useLeaderboard.ts`
    - Manage `data`, `isLoading`, `error` state with AbortController cancellation
    - Re-fetch on `type` parameter change (tab switching), clear stale data
    - Expose `retry` function for error recovery
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 1.8, 6.5_

  - [x] 2.2 Implement `useStreak` hook
    - Create `/packages/frontend/src/hooks/useStreak.ts`
    - Manage `data`, `isLoading`, `error` state with AbortController cancellation
    - Fetch once on mount, expose `retry` function
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 6.5_

  - [x] 2.3 Implement `useRankEstimate` hook with `validateMarks` function
    - Create `/packages/frontend/src/hooks/useRankEstimate.ts`
    - Implement `validateMarks(input)` function: numeric, 0–150 inclusive, ≤2 decimal places
    - Manage `data`, `isLoading`, `error` state with AbortController cancellation
    - Expose `calculate(marks)` function triggered by user action
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7, 6.5_

  - [x] 2.4 Implement `useActivityRecording` hook
    - Create `/packages/frontend/src/hooks/useActivityRecording.ts`
    - Fire-and-forget POST on mount (once per mount lifecycle via ref guard)
    - Silently ignore errors, cancel on unmount
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Checkpoint - Ensure hooks and service layer compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extract sub-components from DashboardPage
  - [x] 4.1 Create `LeaderboardSection` component
    - Create `/packages/frontend/src/components/dashboard/LeaderboardSection.tsx`
    - Use `useLeaderboard` hook internally
    - Render state/national tab switcher, entry list, loading skeleton, error state with retry, empty state, and NO_EXAM_SELECTED message
    - Highlight current user entry when `userRank` is non-null
    - _Requirements: 1.1–1.10_

  - [x] 4.2 Create `StreakSection` component
    - Create `/packages/frontend/src/components/dashboard/StreakSection.tsx`
    - Accept streak hook result as props
    - Render 7 day indicators (active/inactive based on `streakDates`), current streak count, loading state, and fallback error state with retry
    - _Requirements: 2.1–2.6_

  - [x] 4.3 Create `RankCalculatorSection` component
    - Create `/packages/frontend/src/components/dashboard/RankCalculatorSection.tsx`
    - Use `useRankEstimate` hook internally
    - Render marks input with client-side validation, calculate button (disabled during loading), result display (rank, totalApplicants, marks, percentile), and error messages
    - _Requirements: 4.1–4.7_

  - [x] 4.4 Create `MilestonePopup` component
    - Create `/packages/frontend/src/components/dashboard/MilestonePopup.tsx`
    - Render congratulatory overlay with streak count
    - Implement focus trap and Escape key dismissal
    - Dismiss via close button or overlay click
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 4.5 Extract `HeroBanner`, `StatsSection`, `TestCategories`, and `MotivationalBanners` components
    - Create `/packages/frontend/src/components/dashboard/HeroBanner.tsx`
    - Create `/packages/frontend/src/components/dashboard/StatsSection.tsx`
    - Create `/packages/frontend/src/components/dashboard/TestCategories.tsx`
    - Create `/packages/frontend/src/components/dashboard/MotivationalBanners.tsx`
    - Move existing JSX from DashboardPage into these components unchanged
    - _Requirements: 3.5_

- [x] 5. Refactor DashboardPage to use hooks and sub-components
  - [x] 5.1 Refactor `DashboardPage.tsx` to integrate all hooks and components
    - Replace all hardcoded mock data with hook usage
    - Use `useActivityRecording()` for fire-and-forget recording
    - Use `useStreak()` and drive `MilestonePopup` visibility from `milestoneReached`
    - Compose page from extracted sub-components: `HeroBanner`, `StreakSection`, `StatsSection`, `RankCalculatorSection`, `LeaderboardSection`, `TestCategories`, `MotivationalBanners`
    - Ensure independent section rendering (one failure doesn't block others)
    - _Requirements: 1.1, 2.1, 3.1, 5.1, 5.2, 6.1, 6.2, 6.5_

- [x] 6. Checkpoint - Ensure components render and page compiles
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Property-based tests
  - [ ]* 7.1 Write property test for leaderboard entry rendering
    - Create `/packages/frontend/src/components/dashboard/LeaderboardSection.test.tsx`
    - **Property 1: Leaderboard renders all entry fields**
    - Generate random LeaderboardEntry arrays (0–50 entries), verify all entries rendered with rank, fullName, and totalScore
    - Use `fast-check` with `fc.assert(..., { numRuns: 100 })`
    - **Validates: Requirements 1.4**

  - [ ]* 7.2 Write property test for streak day indicators
    - Create `/packages/frontend/src/components/dashboard/StreakSection.test.tsx`
    - **Property 2: Streak day indicators match streakDates**
    - Generate random subsets of last 7 calendar days, verify exactly 7 indicators rendered with correct active/inactive state
    - Use `fast-check` with `fc.assert(..., { numRuns: 100 })`
    - **Validates: Requirements 2.3**

  - [ ]* 7.3 Write property test for rank estimate display
    - Create `/packages/frontend/src/components/dashboard/RankCalculator.test.tsx`
    - **Property 3: Rank estimate displays all response fields**
    - Generate random RankEstimateResponse objects, verify estimatedRank, totalApplicants, marks, and percentile (2 decimal places) are displayed
    - Use `fast-check` with `fc.assert(..., { numRuns: 100 })`
    - **Validates: Requirements 4.2**

  - [ ]* 7.4 Write property test for marks validation
    - Create `/packages/frontend/src/hooks/useRankEstimate.test.ts`
    - **Property 4: Marks validation correctness**
    - Generate valid inputs (numeric 0–150, ≤2dp) and invalid inputs (non-numeric, out of range, >2dp), verify `validateMarks` returns correct `valid` boolean and error messages
    - Use `fast-check` with `fc.assert(..., { numRuns: 100 })`
    - **Validates: Requirements 4.6, 4.7**

  - [ ]* 7.5 Write property test for independent section error isolation
    - Create `/packages/frontend/src/pages/DashboardPage.test.tsx`
    - **Property 5: Independent section error isolation**
    - Generate random success/failure combinations for leaderboard, streak, and activity APIs; verify successful sections render data and failed sections render Error_State independently
    - Use `fast-check` with `fc.assert(..., { numRuns: 100 })`
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 7.6 Write property test for request cancellation on unmount
    - Add to `/packages/frontend/src/pages/DashboardPage.test.tsx`
    - **Property 6: Request cancellation on unmount**
    - Verify that unmounting DashboardPage calls `abort()` on all active AbortControllers, preventing state updates
    - Use `fast-check` with `fc.assert(..., { numRuns: 100 })`
    - **Validates: Requirements 6.5**

- [ ] 8. Unit tests for hooks and service layer
  - [ ]* 8.1 Write unit tests for `dashboard.service.ts`
    - Create `/packages/frontend/src/services/dashboard.service.test.ts`
    - Test each service function with mocked API responses
    - Test error parsing utilities with various error shapes
    - Test 15-second timeout configuration
    - _Requirements: 1.1, 2.1, 4.1, 6.6_

  - [ ]* 8.2 Write unit tests for `useLeaderboard` hook
    - Create `/packages/frontend/src/hooks/useLeaderboard.test.ts`
    - Test mount fetch with `type=state`, tab switching re-fetch, loading state, retry, empty state, NO_EXAM_SELECTED error, user highlight
    - _Requirements: 1.1–1.10_

  - [ ]* 8.3 Write unit tests for `useStreak` and `useActivityRecording` hooks
    - Create `/packages/frontend/src/hooks/useStreak.test.ts`
    - Test mount fetch, retry, error fallback for useStreak
    - Test fire-and-forget behavior, single call per mount, silent error handling for useActivityRecording
    - _Requirements: 2.1–2.6, 3.1–3.5_

  - [ ]* 8.4 Write unit tests for MilestonePopup and focus trap behavior
    - Add tests to `/packages/frontend/src/components/dashboard/MilestonePopup.test.tsx`
    - Test display on `milestoneReached: true`, dismiss via button/overlay/Escape, focus trap
    - _Requirements: 5.1–5.4_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `api.ts` client handles 401 refresh and CSRF automatically — no additional auth handling needed in dashboard code
- All hooks use AbortController for unmount cancellation per Requirement 6.5

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6"] },
    { "id": 6, "tasks": ["8.1", "8.2", "8.3", "8.4"] }
  ]
}
```
