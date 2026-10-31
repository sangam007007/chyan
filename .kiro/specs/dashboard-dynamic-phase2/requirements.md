# Requirements Document

## Introduction

Dashboard Dynamic Phase 2 replaces the remaining hardcoded dashboard components with real backend-driven data. This phase covers four feature areas: Study Plan CRUD (create, edit, delete daily study plans with subject-time allocations), Today's Plan dynamic rendering (showing today's plan items with real-time completion tracking), Continue Learning (displaying the user's latest incomplete topic with progress), and Performance Stats (showing real attempted/correct/wrong counts computed from the `test_attempts` and `attempt_answers` tables). All features build on the existing dashboard infrastructure from Phase 1 and use IST timezone calculations where applicable.

## Glossary

- **Study_Plan_Service**: The backend service responsible for creating, updating, deleting, and retrieving user study plans with their associated items
- **Study_Plan**: A named collection of study items (subject + duration or question count) that a user creates to structure their daily preparation
- **Plan_Item**: A single entry within a Study Plan, linking a subject or activity type with a target duration or question count
- **TodaysPlan_Component**: The frontend component that displays the user's active plan for the current IST day with completion checkboxes and progress bar
- **ContinueLearning_Component**: The frontend component showing the user's most recently accessed incomplete topic with progress percentage and a "Continue" action
- **PerformanceCard_Component**: The frontend component displaying real performance statistics (attempted, correct, wrong, accuracy) computed from the database
- **Performance_Service**: The backend service that computes aggregated performance statistics from `test_attempts` and `attempt_answers` tables
- **Topic_Progress**: The percentage of questions answered correctly for a given topic, computed from the user's attempt history
- **IST_Day**: A calendar day bounded by midnight-to-midnight in Asia/Kolkata timezone (UTC+5:30)
- **Active_Plan**: The study plan assigned to the current IST day for a user; a user has at most one active plan per day

## Requirements

### Requirement 1: Study Plan Creation

**User Story:** As a student, I want to create a study plan with subjects and time allocations, so that I can organize my daily preparation schedule.

#### Acceptance Criteria

1. WHEN the user submits a new study plan, THE Study_Plan_Service SHALL create a plan with a name (1 to 100 characters), a list of plan items, and an optional day-of-week assignment selected from the set {monday, tuesday, wednesday, thursday, friday, saturday, sunday}
2. THE Study_Plan_Service SHALL validate that each plan item contains a subject_id (referencing the `subjects` table) and a target duration in minutes (minimum 5, maximum 480), and that no two plan items reference the same subject_id
3. THE Study_Plan_Service SHALL validate that a plan contains between 1 and 10 plan items
4. THE Study_Plan_Service SHALL store the plan associated with the authenticated user's ID
5. IF the user provides a subject_id that does not exist or does not belong to the user's selected exam, THEN THE Study_Plan_Service SHALL return a validation error indicating the invalid subject reference
6. IF the authenticated user has no selected exam, THEN THE Study_Plan_Service SHALL return a validation error indicating that an exam must be selected before creating a study plan
7. THE Study_Plan_Service SHALL provide a POST /api/study-plans endpoint that accepts plan name and items array and returns the created plan with its generated ID, plan name, items, and day-of-week assignment
8. IF the plan name is empty or exceeds 100 characters, THEN THE Study_Plan_Service SHALL return a validation error indicating the name length constraint

### Requirement 2: Study Plan Editing

**User Story:** As a student, I want to edit my existing study plans, so that I can adjust my preparation schedule as my needs change.

#### Acceptance Criteria

1. WHEN the user updates a study plan, THE Study_Plan_Service SHALL atomically replace the plan's name and all plan items with the new values provided, removing all previous items and inserting the new items
2. THE Study_Plan_Service SHALL validate the updated plan using the same rules as creation: plan name between 1 and 100 characters, 1 to 10 plan items, each item containing a valid subject_id belonging to the user's selected exam, and a duration between 5 and 480 minutes
3. IF the user attempts to edit a plan that does not belong to the user, THEN THE Study_Plan_Service SHALL return a 403 forbidden error
4. IF the user attempts to edit a plan that does not exist, THEN THE Study_Plan_Service SHALL return a 404 not found error
5. THE Study_Plan_Service SHALL provide a PUT /api/study-plans/:planId endpoint that accepts updated plan name and items array and returns the updated plan with its id, name, and full list of items
6. IF the planId path parameter is not a valid UUID, THEN THE Study_Plan_Service SHALL return a 400 validation error indicating an invalid plan identifier
7. IF any plan item fails validation, THEN THE Study_Plan_Service SHALL reject the entire update and return a 400 validation error indicating which constraint was violated

### Requirement 3: Study Plan Deletion

**User Story:** As a student, I want to delete study plans I no longer need, so that I can keep my plan list clean and relevant.

#### Acceptance Criteria

1. WHEN the user deletes a study plan, THE Study_Plan_Service SHALL remove the plan, all associated plan items, all related records in user_active_plans, and all related records in plan_item_completions from the database within a single transaction
2. WHEN the deletion is successful, THE Study_Plan_Service SHALL return a success response confirming the plan has been deleted
3. IF the user attempts to delete a plan that does not belong to the user, THEN THE Study_Plan_Service SHALL return a 403 forbidden error without modifying any data
4. IF the user attempts to delete a plan that does not exist, THEN THE Study_Plan_Service SHALL return a 404 not found error
5. IF the user provides a planId that is not a valid UUID, THEN THE Study_Plan_Service SHALL return a 400 validation error indicating the identifier format is invalid
6. THE Study_Plan_Service SHALL require authentication before processing any delete request
7. THE Study_Plan_Service SHALL provide a DELETE /api/study-plans/:planId endpoint

### Requirement 4: Study Plan Listing and Retrieval

**User Story:** As a student, I want to view all my study plans and see the details of a specific plan, so that I can choose which one to follow today.

#### Acceptance Criteria

1. THE Study_Plan_Service SHALL provide a GET /api/study-plans endpoint returning all plans for the authenticated user, ordered by creation date descending, limited to a maximum of 100 plans per response
2. THE Study_Plan_Service SHALL provide a GET /api/study-plans/:planId endpoint returning the full plan with all its items, where each item includes: id, subject name in English (name_en) and Hindi (name_hi), topic name (bilingual), and duration in minutes
3. WHEN listing plans, THE Study_Plan_Service SHALL include for each plan: id, name, item count, total duration in minutes, and created_at timestamp
4. IF the user has no plans, THEN THE Study_Plan_Service SHALL return an empty array
5. IF the requested planId does not exist or does not belong to the authenticated user, THEN THE Study_Plan_Service SHALL return a 404 error response indicating the plan was not found
6. IF the planId path parameter is not a valid UUID, THEN THE Study_Plan_Service SHALL return a 400 error response indicating an invalid identifier format

### Requirement 5: Today's Plan — Active Plan Selection

**User Story:** As a student, I want to set a plan as today's active plan, so that the dashboard shows my tasks for the day.

#### Acceptance Criteria

1. WHEN the user sets a plan as active for today, THE Study_Plan_Service SHALL record the plan_id as the active plan for the current IST day and return the activated plan_id and plan_date in the response
2. THE Study_Plan_Service SHALL allow only one active plan per user per IST day, enforced by the UNIQUE constraint on (user_id, plan_date)
3. IF the user sets a new active plan for today, THEN THE Study_Plan_Service SHALL replace the previous active plan assignment for that day
4. THE Study_Plan_Service SHALL provide a POST /api/study-plans/:planId/activate endpoint that sets the plan as today's active plan
5. IF the plan does not belong to the user, THEN THE Study_Plan_Service SHALL return a 403 forbidden error
6. IF the planId does not correspond to an existing plan, THEN THE Study_Plan_Service SHALL return a 404 not found error
7. IF the planId is not a valid UUID, THEN THE Study_Plan_Service SHALL return a 400 validation error indicating an invalid plan identifier

### Requirement 6: Today's Plan — Completion Tracking

**User Story:** As a student, I want to mark plan items as done during the day, so that I can track my progress against today's plan.

#### Acceptance Criteria

1. WHEN the user marks a plan item as completed, THE Study_Plan_Service SHALL record the completion for the current IST day by inserting a row into plan_item_completions with the user_id, item_id, and current IST date
2. THE Study_Plan_Service SHALL allow each item to be marked completed only once per IST day; if a completion record already exists for the (user_id, item_id, completion_date) tuple, the endpoint SHALL return success without creating a duplicate (idempotent)
3. WHEN the user un-marks a completed item, THE Study_Plan_Service SHALL remove the completion record for that item for the current IST day
4. IF the item does not belong to the user's active plan for the current IST day, THEN THE Study_Plan_Service SHALL return a 403 forbidden error
5. IF the itemId does not exist, THEN THE Study_Plan_Service SHALL return a 404 not found error
6. THE Study_Plan_Service SHALL provide a POST /api/study-plans/today/items/:itemId/complete endpoint to mark an item complete
7. THE Study_Plan_Service SHALL provide a DELETE /api/study-plans/today/items/:itemId/complete endpoint to un-mark an item
8. THE Study_Plan_Service SHALL provide a GET /api/study-plans/today endpoint returning the active plan with item completion states for the current IST day, including plan name, items with subject names (bilingual), durations, and a boolean completed flag per item

### Requirement 7: Today's Plan — Dashboard Display

**User Story:** As a student, I want the dashboard to show my today's plan with real completion status, so that I can see what I still need to do at a glance.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE TodaysPlan_Component SHALL fetch the active plan for the current IST day from the GET /api/study-plans/today endpoint and display the plan items within 5 seconds of the request initiation
2. THE TodaysPlan_Component SHALL display each plan item with the subject name in the user's selected language (using name_en or name_hi fields), target duration in minutes (e.g., "20 min"), and a completion checkbox reflecting the item's current completion state for the current IST day
3. THE TodaysPlan_Component SHALL display a progress bar showing the percentage of items completed (completed count / total items × 100), rounded to the nearest integer, and SHALL update this percentage immediately when any item's completion state changes
4. WHEN the user toggles a plan item checkbox, THE TodaysPlan_Component SHALL immediately update the checkbox state and progress bar in the UI, then call the POST (complete) or DELETE (uncomplete) /api/study-plans/today/items/:itemId/complete endpoint to persist the change
5. IF the API call to complete or uncomplete a plan item fails, THEN THE TodaysPlan_Component SHALL revert the checkbox and progress bar to the previous state and display an error message indicating the action could not be saved
6. IF no active plan is set for today, THEN THE TodaysPlan_Component SHALL display a message prompting the user to select or create a plan, along with an "Edit" button that navigates to the /study-plan page
7. THE TodaysPlan_Component SHALL display an "Edit" button that navigates to the /study-plan page for plan management
8. IF the API call to fetch today's plan fails, THEN THE TodaysPlan_Component SHALL display an error message indicating the plan could not be loaded and a "Retry" button that re-initiates the fetch request when tapped

### Requirement 8: Continue Learning — Latest Incomplete Topic

**User Story:** As a student, I want to see my last studied topic on the dashboard, so that I can quickly resume where I left off.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE ContinueLearning_Component SHALL fetch the user's most recently accessed topic that has incomplete progress from the GET /api/dashboard/continue-learning endpoint
2. THE Performance_Service SHALL determine the latest incomplete topic by finding the most recent `test_attempt` with status "submitted" or "auto_submitted" for a test where category is "subject_wise" and topic_id is not null, then selecting the topic of that test where the user's accuracy (correct answers divided by total questions, expressed as a percentage) is below 80%
3. THE ContinueLearning_Component SHALL display the subject name and topic name in the user's current locale language, and the accuracy percentage (rounded to the nearest whole number, ranging from 0 to 100) as the progress indicator
4. THE ContinueLearning_Component SHALL display a "Continue" button that navigates to the test listing page filtered by that topic
5. IF the user has no test attempts with status "submitted" or "auto_submitted" for any subject-wise test, THEN THE ContinueLearning_Component SHALL display a prompt to start their first subject-wise test
6. IF the user has completed test attempts but all attempted topics have accuracy at or above 80%, THEN THE ContinueLearning_Component SHALL display a prompt to start their first subject-wise test
7. THE ContinueLearning_Component SHALL display a "View All" button that navigates to the full subjects listing page
8. THE Performance_Service SHALL provide a GET /api/dashboard/continue-learning endpoint returning the topic data including subject_name_en, subject_name_hi, topic_name_en, topic_name_hi, accuracy_percentage, topic_id, and subject_id
9. WHEN the GET /api/dashboard/continue-learning endpoint is called, THE Performance_Service SHALL respond within 2 seconds

### Requirement 9: Performance Stats — Real Data Computation

**User Story:** As a student, I want to see my real performance numbers on the dashboard, so that I know my actual accuracy and progress.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Performance_Service SHALL compute the total number of questions attempted by counting all `attempt_answers` where `selected_option` is not null, across all test_attempts with status "submitted" or "auto_submitted" (including daily quiz attempts) for the authenticated user
2. THE Performance_Service SHALL compute the total correct answers by counting `attempt_answers` where `selected_option` equals the question's `correct_option` across all submitted or auto_submitted attempts for the user
3. THE Performance_Service SHALL compute the total wrong answers by counting `attempt_answers` where `selected_option` is not null and does not equal the question's `correct_option` across all submitted or auto_submitted attempts for the user
4. THE Performance_Service SHALL compute accuracy as (correct / attempted × 100) rounded to the nearest integer, returning 0 when no questions have been attempted
5. THE Performance_Service SHALL provide a GET /api/dashboard/performance endpoint returning attempted, correct, wrong, and accuracy values
6. THE Performance_Service SHALL cache the computed performance stats in Redis with a key per user (format: `perf:{userId}`) and a TTL of 120 seconds; if Redis is unavailable, the service SHALL compute stats directly from the database without failing

### Requirement 10: Performance Stats — Weekly Chart Data

**User Story:** As a student, I want to see my performance trend for the current week, so that I can understand how my accuracy is changing day by day.

#### Acceptance Criteria

1. THE Performance_Service SHALL compute daily accuracy percentages for the last 7 IST calendar days (today and the 6 preceding days), considering only answers from test_attempts with status 'submitted' or 'auto_submitted'
2. THE Performance_Service SHALL compute each day's accuracy as (correct answers that day / total answers that day × 100) rounded to the nearest integer (0–100), returning null for days with no qualifying attempts
3. THE PerformanceCard_Component SHALL display the weekly accuracy data as a mini line chart with data points for each day
4. THE PerformanceCard_Component SHALL omit days with null accuracy from the chart line (gap in the chart with no data point rendered for that day)
5. THE Performance_Service SHALL include the weekly chart data in the GET /api/dashboard/performance endpoint response as an ordered array of 7 entries from oldest to newest, each entry containing the IST calendar date and the accuracy value (integer or null)
6. IF the user has no qualifying attempts in the last 7 days, THEN THE PerformanceCard_Component SHALL display 0 for all stat values and render an empty chart with no data points
7. THE Performance_Service SHALL count answers from both test series attempts and daily quiz attempts when computing daily accuracy

### Requirement 11: Performance Stats — Dashboard Display

**User Story:** As a student, I want the performance card to show real numbers instead of mock data, so that I can trust what the dashboard displays.

#### Acceptance Criteria

1. WHEN the dashboard mounts, THE PerformanceCard_Component SHALL fetch data from GET /api/dashboard/performance and display four stats: total attempted, correct count, wrong count, and accuracy percentage (rendered as an integer followed by "%")
2. WHILE the performance API request is in progress, THE PerformanceCard_Component SHALL display a loading indicator in place of the stat values and chart
3. THE PerformanceCard_Component SHALL display a "This Week" label indicating the time period for the chart data
4. IF the performance API call fails, THEN THE PerformanceCard_Component SHALL display "--" for all four stat values and hide the chart
5. WHEN the user navigates to the dashboard after completing a test, THE PerformanceCard_Component SHALL refetch the performance data from the API to display updated values
6. IF the API returns 0 for total attempted, THEN THE PerformanceCard_Component SHALL display 0 for attempted, correct, and wrong, and display "0%" for accuracy

### Requirement 12: Study Plan Data Model

**User Story:** As a developer, I want a well-structured database schema for study plans, so that the data layer supports all CRUD and completion tracking features.

#### Acceptance Criteria

1. THE database SHALL store study plans in a `study_plans` table with columns: id (UUID PK, default gen_random_uuid()), user_id (UUID FK → users ON DELETE CASCADE, NOT NULL), name (VARCHAR(100), NOT NULL), created_at (TIMESTAMPTZ, NOT NULL, default NOW()), updated_at (TIMESTAMPTZ, NOT NULL, default NOW())
2. THE database SHALL store plan items in a `study_plan_items` table with columns: id (UUID PK, default gen_random_uuid()), plan_id (UUID FK → study_plans ON DELETE CASCADE, NOT NULL), subject_id (UUID FK → subjects, NOT NULL), duration_minutes (INTEGER, NOT NULL), display_order (INTEGER, NOT NULL), created_at (TIMESTAMPTZ, NOT NULL, default NOW())
3. THE database SHALL store active plan assignments in a `user_active_plans` table with columns: id (UUID PK, default gen_random_uuid()), user_id (UUID FK → users ON DELETE CASCADE, NOT NULL), plan_id (UUID FK → study_plans ON DELETE CASCADE, NOT NULL), plan_date (DATE, NOT NULL), created_at (TIMESTAMPTZ, NOT NULL, default NOW()) with a UNIQUE constraint on (user_id, plan_date)
4. THE database SHALL store item completions in a `plan_item_completions` table with columns: id (UUID PK, default gen_random_uuid()), user_id (UUID FK → users ON DELETE CASCADE, NOT NULL), item_id (UUID FK → study_plan_items ON DELETE CASCADE, NOT NULL), completion_date (DATE, NOT NULL), completed_at (TIMESTAMPTZ, NOT NULL, default NOW()) with a UNIQUE constraint on (user_id, item_id, completion_date)
5. THE `study_plan_items` table SHALL enforce a CHECK constraint that duration_minutes is between 5 and 480 inclusive, and a CHECK constraint that display_order is between 0 and 100 inclusive
6. THE database SHALL create an index on study_plans (user_id, created_at DESC) for efficient listing
7. IF a referenced user row is deleted, THEN THE database SHALL cascade the deletion to all related rows in study_plans, user_active_plans, and plan_item_completions owned by that user
