# Requirements Document

## Introduction

This document specifies the backend APIs for the Dashboard feature of the UP Police Test Series app. The dashboard provides three core capabilities: a leaderboard system that ranks users by their total test scores (state-wise and national), a streak tracking system that monitors daily user engagement and triggers rewards at 7-day milestones, and a rank estimator that predicts a user's potential exam rank based on their marks and historical cutoff data.

## Glossary

- **Dashboard_Service**: The backend service module responsible for handling all dashboard-related API endpoints and business logic.
- **Leaderboard_Service**: The service component that computes and returns user rankings based on aggregated test attempt scores.
- **Streak_Service**: The service component that tracks daily user activity (app opens and test attempts) and computes consecutive day streaks.
- **Rank_Estimator**: The service component that calculates an estimated exam rank given a marks input, using historical cutoff data and total applicant count.
- **Activity_Record**: A database entry representing a user's activity on a specific date, used for streak computation.
- **Streak**: The count of consecutive days a user has been active (opened the app or attempted a test).
- **Total_Score**: The sum of `total_score` values from all completed (submitted/auto_submitted) test attempts for a user.
- **Authenticated_User**: A user whose JWT token has been validated and whose `userId` is available in the request context.

## Requirements

### Requirement 1: Leaderboard Retrieval

**User Story:** As a student, I want to see a leaderboard showing top-ranked users by their total test scores, so that I can compare my performance with others.

#### Acceptance Criteria

1. WHEN an Authenticated_User sends a GET request to `/api/dashboard/leaderboard` with query parameter `type=state`, THE Leaderboard_Service SHALL return a list of users ranked by Total_Score in descending order, filtered to users sharing the same `selected_exam_id` as the requesting user. IF the requesting user has no `selected_exam_id` set, THEN THE Leaderboard_Service SHALL return a 400 validation error indicating that an exam must be selected before viewing the state leaderboard.
2. WHEN an Authenticated_User sends a GET request to `/api/dashboard/leaderboard` with query parameter `type=national`, THE Leaderboard_Service SHALL return a list of users ranked by Total_Score in descending order across all users regardless of `selected_exam_id`.
3. THE Leaderboard_Service SHALL include for each ranked user: rank position (integer starting at 1), user ID, full name, avatar URL, and total score.
4. THE Leaderboard_Service SHALL include the requesting user's own rank position and total score in the response, even when the user is not within the top 50 returned entries.
5. THE Leaderboard_Service SHALL limit the leaderboard response to a maximum of 50 entries.
6. WHEN an Authenticated_User sends a GET request to `/api/dashboard/leaderboard` with a `type` query parameter value other than `state` or `national`, or with the `type` parameter missing, THE Dashboard_Service SHALL return a 400 validation error with a message indicating the allowed values.
7. THE Leaderboard_Service SHALL compute Total_Score by summing `total_score` from all test_attempts with status `submitted` or `auto_submitted` for each user.
8. THE Leaderboard_Service SHALL cache leaderboard results in Redis with a TTL of 5 minutes to reduce database load.
9. IF two or more users have the same Total_Score, THEN THE Leaderboard_Service SHALL assign them the same rank position and order them by earliest test attempt submission date (ascending).
10. THE Leaderboard_Service SHALL exclude users who have zero completed test attempts (no test_attempts with status `submitted` or `auto_submitted`) from the leaderboard rankings.

### Requirement 2: Streak Tracking

**User Story:** As a student, I want my daily engagement streak tracked, so that I stay motivated to study consistently.

#### Acceptance Criteria

1. WHEN an Authenticated_User sends a POST request to `/api/dashboard/activity`, THE Streak_Service SHALL record an Activity_Record for the current date (IST timezone) for that user.
2. WHILE an Activity_Record already exists for the user on the current date, THE Streak_Service SHALL not create a duplicate record and SHALL return success.
3. WHEN an Authenticated_User sends a GET request to `/api/dashboard/streak`, THE Streak_Service SHALL return the current consecutive day streak count, the list of active streak dates, and whether today has been recorded.
4. THE Streak_Service SHALL compute the streak by counting consecutive calendar days (IST) backwards from today where an Activity_Record exists.
5. WHEN the streak count reaches exactly 7 consecutive days, THE Streak_Service SHALL include a `milestone_reached: true` flag in the streak response to trigger a congratulations popup on the frontend.
6. IF a gap of one or more days occurs in Activity_Records, THEN THE Streak_Service SHALL reset the streak count to start from the most recent unbroken sequence of consecutive days.
7. THE Streak_Service SHALL use IST (UTC+5:30) as the timezone for determining calendar day boundaries.

### Requirement 3: Rank Estimation

**User Story:** As a student, I want to know my estimated rank based on my test marks, so that I can gauge my standing relative to other exam aspirants.

#### Acceptance Criteria

1. WHEN an Authenticated_User sends a GET request to `/api/dashboard/rank-estimate` with query parameter `marks` (a numeric value between 0 and 150 inclusive, accepting up to 2 decimal places), THE Rank_Estimator SHALL return an estimated rank within 2 seconds.
2. THE Rank_Estimator SHALL compute the estimated rank using the formula: `estimated_rank = total_applicants × (1 - marks / total_marks)`, where `total_marks` is 150 and `total_applicants` is a configurable value stored in application configuration.
3. THE Rank_Estimator SHALL return the estimated rank rounded to the nearest integer with a minimum value of 1.
4. THE Rank_Estimator SHALL include in the response: the estimated rank (integer), total applicants count (integer), marks provided (number as submitted), and the percentile (marks / total_marks × 100, rounded to 2 decimal places).
5. WHEN the `marks` query parameter is missing, non-numeric, less than 0, or greater than 150, THE Dashboard_Service SHALL return a 400 validation error with a message indicating which validation constraint was violated.
6. THE Rank_Estimator SHALL read `total_applicants` and `total_marks` from a configuration source, allowing values to be updated without code changes.
7. IF the configured `total_applicants` value is missing or not a positive integer, THEN THE Rank_Estimator SHALL return a 500 error indicating a configuration issue and SHALL log the details internally.

### Requirement 4: Authentication and Error Handling

**User Story:** As a system administrator, I want all dashboard endpoints to be secured and to return consistent error responses, so that unauthorized access is prevented and debugging is straightforward.

#### Acceptance Criteria

1. THE Dashboard_Service SHALL require a valid JWT token (verified signature, non-expired, active session) for all dashboard endpoints (`/api/dashboard/*`) by applying the existing `jwtAuth` middleware.
2. IF a request to any dashboard endpoint lacks a valid JWT token, THEN THE Dashboard_Service SHALL return a 401 response with an error code distinguishing the failure reason: `TOKEN_INVALID` for missing or malformed tokens, `TOKEN_EXPIRED` for expired tokens, and `SESSION_TERMINATED` for tokens with inactive sessions.
3. IF an unexpected error occurs during request processing, THEN THE Dashboard_Service SHALL return a 500 response with error code `SERVER_ERROR` and a message that does not expose internal details, and SHALL log the original error to the server console.
4. THE Dashboard_Service SHALL return all error responses in the standard format: `{ success: false, error: { code: string, message: string, details?: object } }`.
5. IF a known application error occurs (validation failure, resource not found), THEN THE Dashboard_Service SHALL return the corresponding HTTP status code (400, 404, 422) using the same standard error response format with an appropriate error code and message.
