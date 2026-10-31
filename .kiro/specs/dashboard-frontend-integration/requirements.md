# Requirements Document

## Introduction

This document specifies the requirements for integrating the DashboardPage frontend component with the existing backend dashboard APIs. The frontend currently uses hardcoded mock data for leaderboard rankings, streak tracking, and rank estimation. This feature replaces all mock data with real API calls to the authenticated `/api/dashboard/*` endpoints, adds proper loading and error states, and triggers the congratulations popup based on actual streak milestone data from the backend.

## Glossary

- **Dashboard_Page**: The React component (`DashboardPage.tsx`) that renders the main authenticated user dashboard, including leaderboard, streak, and rank calculator sections.
- **API_Client**: The existing Axios-based HTTP client (`services/api.ts`) that handles JWT token attachment, CSRF headers, token refresh, and request/response interception.
- **Leaderboard_Section**: The UI section of the Dashboard_Page that displays a ranked list of users by total test scores, with state and national tabs.
- **Streak_Section**: The UI section of the Dashboard_Page that displays the user's current consecutive-day engagement streak and day indicators.
- **Rank_Calculator**: The UI component within the Dashboard_Page that accepts marks input and displays an estimated exam rank.
- **Loading_State**: A visual indicator (spinner, skeleton, or placeholder) shown while an API request is in progress.
- **Error_State**: A visual indicator (message, retry button) shown when an API request fails.
- **Milestone_Popup**: The congratulations overlay displayed when the user achieves a 7-day streak milestone.

## Requirements

### Requirement 1: Leaderboard API Integration

**User Story:** As a student, I want the leaderboard to show real rankings from the backend, so that I can see my actual standing compared to other students.

#### Acceptance Criteria

1. WHEN the Dashboard_Page mounts, THE Leaderboard_Section SHALL fetch leaderboard data from `GET /api/dashboard/leaderboard?type=state` using the API_Client.
2. WHEN the user switches the leaderboard tab to "national", THE Leaderboard_Section SHALL fetch leaderboard data from `GET /api/dashboard/leaderboard?type=national` using the API_Client.
3. WHEN the user switches the leaderboard tab to "state", THE Leaderboard_Section SHALL fetch leaderboard data from `GET /api/dashboard/leaderboard?type=state` using the API_Client.
4. WHEN a leaderboard API response is received successfully, THE Leaderboard_Section SHALL render up to 50 entries from the `entries` array, showing rank, full name, avatar, and total score for each entry.
5. WHEN a leaderboard API response includes a non-null `userRank`, THE Leaderboard_Section SHALL highlight the current user's entry with distinct styling. IF `userRank` is null, THEN THE Leaderboard_Section SHALL not display any highlighted user entry.
6. WHILE leaderboard data is being fetched, THE Leaderboard_Section SHALL display a Loading_State indicator and SHALL NOT render stale data from a previous tab selection.
7. IF the leaderboard API request fails, THEN THE Leaderboard_Section SHALL display an Error_State with a descriptive message and a retry button.
8. WHEN the user clicks the retry button in the leaderboard Error_State, THE Leaderboard_Section SHALL re-fetch leaderboard data for the currently selected tab.
9. IF the leaderboard API response returns an empty `entries` array, THEN THE Leaderboard_Section SHALL display an empty state message indicating no rankings are available yet.
10. IF the state leaderboard API request fails with a "NO_EXAM_SELECTED" error, THEN THE Leaderboard_Section SHALL display a message indicating the user must select an exam before viewing state rankings.

### Requirement 2: Streak API Integration

**User Story:** As a student, I want to see my real daily streak data, so that I know my actual consecutive-day engagement progress.

#### Acceptance Criteria

1. WHEN the Dashboard_Page mounts, THE Streak_Section SHALL fetch streak data from `GET /api/dashboard/streak` using the API_Client.
2. WHEN the streak API response is received successfully, THE Streak_Section SHALL display the `currentStreak` value as the numeric streak day count.
3. WHEN the streak API response is received successfully, THE Streak_Section SHALL render exactly 7 day indicators representing the last 7 calendar days, marking each day whose date appears in the `streakDates` array as visually active and all other days as inactive.
4. WHILE streak data is being fetched, THE Streak_Section SHALL display a Loading_State indicator.
5. IF the streak API request fails, THEN THE Streak_Section SHALL display a fallback state showing a streak count of zero, all day indicators as inactive, and a retry button.
6. WHEN the user clicks the retry button in the Streak_Section fallback state, THE Streak_Section SHALL re-fetch streak data from `GET /api/dashboard/streak` using the API_Client.

### Requirement 3: Activity Recording on Page Load

**User Story:** As a student, I want my daily activity recorded when I visit the dashboard, so that my streak is tracked without extra effort.

#### Acceptance Criteria

1. WHEN the Dashboard_Page mounts and the user is authenticated, THE Dashboard_Page SHALL send a POST request to `/api/dashboard/activity` with no request body using the API_Client to record the daily activity.
2. WHEN the Dashboard_Page mounts, THE Dashboard_Page SHALL send the activity recording request exactly once per mount lifecycle, regardless of component re-renders.
3. WHEN the activity recording request succeeds, THE Dashboard_Page SHALL not display any confirmation or feedback to the user.
4. IF the activity recording request fails, THEN THE Dashboard_Page SHALL silently ignore the error without displaying any Error_State to the user and without retrying the request.
5. WHILE the activity recording request is in progress, THE Dashboard_Page SHALL continue rendering all other sections (Leaderboard_Section, Streak_Section, Rank_Calculator) without delay.

### Requirement 4: Rank Calculator API Integration

**User Story:** As a student, I want to calculate my estimated rank using real backend data, so that my rank prediction is accurate and consistent.

#### Acceptance Criteria

1. WHEN the user enters marks and clicks the calculate button, THE Rank_Calculator SHALL send a GET request to `/api/dashboard/rank-estimate?marks=<value>` using the API_Client.
2. WHEN the rank estimate API response is received successfully, THE Rank_Calculator SHALL display the `estimatedRank`, `totalApplicants`, `marks`, and `percentile` (rounded to 2 decimal places) values from the response.
3. WHILE the rank estimate API request is in progress, THE Rank_Calculator SHALL display a Loading_State indicator in the result area and SHALL disable the calculate button to prevent duplicate submissions.
4. IF the rank estimate API request fails with a 400 validation error, THEN THE Rank_Calculator SHALL display the validation error message from the response to the user in the result area.
5. IF the rank estimate API request fails with a non-400 error, THEN THE Rank_Calculator SHALL display an error message indicating the rank calculation could not be completed and SHALL offer a way to retry.
6. THE Rank_Calculator SHALL validate that the marks input is a numeric value between 0 and 150 (inclusive) with up to 2 decimal places before sending the API request.
7. IF the client-side marks validation fails, THEN THE Rank_Calculator SHALL display an inline error message indicating the valid input range (0 to 150, up to 2 decimal places) and SHALL NOT send the API request.

### Requirement 5: Milestone Congratulations Popup

**User Story:** As a student, I want to see a congratulations popup when I reach a 7-day streak milestone, so that I feel rewarded for consistent engagement.

#### Acceptance Criteria

1. WHEN the streak API response contains `milestoneReached: true`, THE Dashboard_Page SHALL display the Milestone_Popup within 500 milliseconds of receiving the response, showing the current streak count and a congratulatory message indicating the 7-day milestone achievement.
2. WHEN the streak API response contains `milestoneReached: false` or the field is absent, THE Dashboard_Page SHALL not display the Milestone_Popup.
3. WHEN the user dismisses the Milestone_Popup by clicking the close button or clicking outside the popup overlay, THE Dashboard_Page SHALL hide the popup and not show it again until the Dashboard_Page component unmounts and remounts (e.g., navigating away and returning).
4. WHEN the Milestone_Popup is displayed, THE Dashboard_Page SHALL trap keyboard focus within the popup and allow dismissal via the Escape key.

### Requirement 6: Error Recovery and Network Resilience

**User Story:** As a student, I want the dashboard to handle API failures gracefully, so that a single failed request does not break the entire page.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL fetch leaderboard, streak, and activity data as independent requests, so that a non-2xx response or network error in one request does not prevent other sections from rendering.
2. IF multiple API requests fail during the same page load, THEN THE Dashboard_Page SHALL display individual Error_State indicators for each failed section without affecting sections that succeeded.
3. WHEN a 401 error is returned from any dashboard API request, THE API_Client SHALL handle token refresh and request retry automatically using the existing interceptor logic.
4. THE Dashboard_Page SHALL not implement additional 401 handling beyond the API_Client interceptor.
5. WHEN the Dashboard_Page component unmounts, THE Dashboard_Page SHALL cancel all in-flight API requests to prevent state updates on unmounted components.
6. IF a dashboard API request does not receive a response within 15 seconds, THEN THE Dashboard_Page SHALL treat the request as failed and display the Error_State for the affected section.
