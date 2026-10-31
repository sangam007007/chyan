# Implementation Plan: Test Series Module

## Overview

Implements the complete test series workflow for the UP Police Test Series platform. Builds on existing Express/PostgreSQL/Redis backend and React/Tailwind frontend. Uses TypeScript throughout, Zod for validation, fast-check for property tests, and Vitest as the test runner.

## Tasks

- [x] 1. Database migrations for test series tables
  - [x] 1.1 Create migration for questions and question_exams tables
    - Add `questions` table with bilingual text fields, options, correct_option, subject, topic, difficulty, image_url
    - Add `question_exams` junction table with composite primary key
    - Add CHECK constraints for correct_option (0-3), subject enum, difficulty enum
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 1.2 Create migration for tests and test_questions tables
    - Add `tests` table with bilingual title, duration, marks, negative_marking_ratio, pricing_type, status, schedule dates
    - Add `test_questions` ordered junction table with UNIQUE constraint on (test_id, question_order)
    - Add CHECK constraints for pricing_type, status, positive duration/marks
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 1.3 Create migration for test_attempts, attempt_answers, and revision_marks tables
    - Add `test_attempts` table with user_id, test_id, timing fields, score fields, status
    - Add `attempt_answers` table with selected_option, marked_for_review, UNIQUE on (attempt_id, question_order)
    - Add `revision_marks` table with UNIQUE on (user_id, question_id)
    - Add index on test_attempts(user_id, test_id)
    - _Requirements: 4.1, 4.7, 5.5_

- [x] 2. Score Calculator service
  - [x] 2.1 Implement calculateScore function
    - Input: answers array, questions array, marksPerQuestion, negativeMarkingRatio, passingMarks
    - Compute correct/wrong/skipped counts, apply formula, derive percentage and passed flag
    - Return ScoreResult interface
    - _Requirements: 4.5, 5.1_
  - [x] 2.2 Write property test for score calculation
    - **Property 1: Score calculation correctness**
    - Generate random answer arrays with mixed correct/wrong/skipped, random marks and negative ratio
    - Verify: score = (correct × marks) - (wrong × marks × ratio), counts sum = total, percentage = score/max × 100
    - **Validates: Requirements 4.5, 5.1**
  - [x] 2.3 Implement calculateSubjectBreakdown function
    - Group questions by subject, count correct/wrong/skipped per group
    - Return SubjectBreakdown array
    - _Requirements: 5.3_
  - [x] 2.4 Write property test for subject breakdown consistency
    - **Property 2: Subject breakdown consistency**
    - Generate random multi-subject answer sets, verify sum of breakdowns equals total counts
    - **Validates: Requirements 5.3**
  - [x] 2.5 Implement calculatePercentile function
    - Query all scores for a test, compute percentage of scores <= current score
    - _Requirements: 5.2_
  - [x] 2.6 Write property test for percentile calculation
    - **Property 3: Percentile calculation**
    - Generate random score arrays and target score, verify percentile formula
    - **Validates: Requirements 5.2**

- [x] 3. Checkpoint - Run migrations and verify score calculator
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Question Bank backend
  - [x] 4.1 Create Zod schemas for question validation
    - createQuestionSchema with bilingual fields, options array length 4, correctOption 0-3, subject enum, difficulty enum, examIds
    - updateQuestionSchema (partial)
    - _Requirements: 1.1, 1.2, 1.5_
  - [x] 4.2 Write property test for question validation
    - **Property 7: Question validation invariant**
    - Generate random option counts (1-6) and correctOption values (-1 to 5), verify validation accepts only 4 options with correctOption 0-3
    - **Validates: Requirements 1.5**
  - [x] 4.3 Implement questions controller (CRUD routes)
    - POST /api/questions — create with exam associations
    - GET /api/questions — list with subject/difficulty/exam filters
    - GET /api/questions/:id — get single
    - PUT /api/questions/:id — update
    - DELETE /api/questions/:id — soft delete (set is_active=false)
    - Apply jwtAuth middleware to all routes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 5. Test management backend
  - [x] 5.1 Create Zod schemas for test creation/update
    - createTestSchema with bilingual title, duration, marks, negativeMarkingRatio, passingMarks, pricingType, status, schedule dates, questionIds
    - updateTestSchema (partial)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [x] 5.2 Implement tests controller (admin CRUD + user listing)
    - POST /api/tests — create test with ordered question associations
    - PUT /api/tests/:id — update test
    - GET /api/tests/:id — get test details
    - Apply jwtAuth middleware
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6. Test Listing service
  - [x] 6.1 Implement getTestsForUser function
    - Query tests filtered by: status='published', exam_id matches user's selected exam, within schedule window
    - Join with test_attempts to derive attempt_status per test
    - Join with test_questions for question count
    - Support sort by newest (created_at DESC), popular (attempt_count DESC), difficulty (avg question difficulty)
    - Paginated response
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.2 Add GET /api/tests route for user-facing test listing
    - Query params: sort, page, limit
    - Uses user's selected_exam_id from JWT user context
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 6.3 Write property test for schedule filtering
    - **Property 4: Test listing schedule filtering**
    - Generate random (available_from, available_until, now) triples, verify inclusion/exclusion logic
    - **Validates: Requirements 2.5, 3.5**
  - [x] 6.4 Write property test for test listing filtering
    - **Property 5: Test listing exam and status filtering**
    - Generate random test sets with mixed statuses and exam IDs, verify only published + matching exam returned
    - **Validates: Requirements 3.1**

- [x] 7. Checkpoint - Verify question bank and test listing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Test Attempt service
  - [x] 8.1 Implement startAttempt function
    - Check cooldown (24h since last submission for same test)
    - Create test_attempts record with started_at and ends_at = started_at + duration
    - Pre-create attempt_answers rows for all questions (selected_option=null)
    - Cache timer key in Redis with TTL
    - _Requirements: 4.1, 4.6_
  - [x] 8.2 Write property test for cooldown enforcement
    - **Property 6: Cooldown enforcement**
    - Generate random (submission_time, now) pairs, verify rejection when diff < 24h, acceptance when >= 24h
    - **Validates: Requirements 4.6**
  - [x] 8.3 Implement saveAnswer function
    - Upsert attempt_answers row for given question_order
    - Validate attempt is still in_progress and within time window
    - _Requirements: 4.7_
  - [x] 8.4 Write property test for answer persistence
    - **Property 5: Answer persistence completeness**
    - Generate random (questionIndex, selectedOption, markedForReview) values, save and retrieve, verify equality
    - **Validates: Requirements 4.7**
  - [x] 8.5 Implement submitAttempt function
    - Validate attempt exists and belongs to user, is still in_progress
    - Call calculateScore with attempt answers and test questions
    - Update test_attempts with score, counts, percentage, time_taken, status='submitted'
    - Increment test.attempt_count
    - _Requirements: 4.5, 5.1_
  - [x] 8.6 Implement auto-submit logic
    - On answer save or status check, if current time > ends_at, trigger submitAttempt with status='auto_submitted'
    - _Requirements: 4.4_

- [x] 9. Attempts controller (API routes)
  - [x] 9.1 Wire attempt routes
    - POST /api/tests/:testId/attempts — startAttempt
    - GET /api/tests/:testId/attempts/current — get current in-progress attempt
    - PUT /api/attempts/:attemptId/answers/:questionIndex — saveAnswer
    - POST /api/attempts/:attemptId/submit — submitAttempt
    - GET /api/attempts/:attemptId/results — getResults (score + breakdown + percentile)
    - GET /api/attempts/:attemptId/review — getReview (questions + answers + explanations)
    - POST /api/attempts/:attemptId/review/:questionIndex/revision — markForRevision
    - Apply jwtAuth to all routes
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 10. Register all new routes in main router
  - Add questions, tests, and attempts routes to src/routes/index.ts
  - _Requirements: all_

- [x] 11. Checkpoint - Full backend flow verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Seed data migration
  - [x] 12.1 Create seed migration with sample UP Police Constable test data
    - Insert 30-40 bilingual questions across GK, Math, Reasoning, Hindi with varied difficulty
    - Create 2-3 tests (one free, one premium) with 10-20 questions each, linked to UP Police Constable exam
    - Include realistic bilingual content (Hindi and English) for questions, options, and explanations
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 13. Frontend - Test Listing page
  - [x] 13.1 Create TestListPage component
    - Fetch tests from GET /api/tests with sort parameter
    - Display test cards with: title (bilingual), duration, questions count, marks, free/premium badge
    - Show attempt status badge (not attempted / in progress / completed with score)
    - Add sort dropdown (newest, popular, difficulty)
    - Add i18n translations for all static text
    - Use Tailwind for responsive card layout
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 13.2 Add /tests route to frontend router
    - Protected route inside AuthGuard + AppLayout
    - _Requirements: 3.1_

- [x] 14. Frontend - Test Attempt page
  - [x] 14.1 Create TestAttemptPage with timer and question display
    - Fetch attempt data on mount (or start new attempt)
    - Timer countdown component (display MM:SS, auto-submit at 0)
    - Question display: bilingual text, 4 radio options, mark-for-review checkbox
    - Save answer on option select (PUT to backend immediately)
    - _Requirements: 4.1, 4.2, 4.4, 4.7_
  - [x] 14.2 Create QuestionNavigationPanel component
    - Numbered grid showing question states: answered (green), unanswered (gray), marked-for-review (orange)
    - Click to navigate to specific question
    - Current question highlighted
    - _Requirements: 4.3_
  - [x] 14.3 Add submit confirmation and navigation
    - Submit button with confirmation dialog (show unanswered count)
    - Previous/Next navigation buttons
    - Add /tests/:testId/attempt route
    - _Requirements: 4.5_

- [x] 15. Frontend - Results and Review pages
  - [x] 15.1 Create TestResultsPage
    - Display score card: marks obtained/total, percentage, pass/fail badge
    - Rank percentile display
    - Subject-wise breakdown table (correct/wrong/skipped per subject)
    - Time taken display
    - Link to full answer review
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 15.2 Create AnswerReviewPage
    - List all questions with user's answer, correct answer, explanation
    - Color code: green (correct), red (wrong), gray (skipped)
    - Mark for revision button per question
    - Display in user's preferred language
    - Add routes: /tests/:testId/results/:attemptId, /tests/:testId/review/:attemptId
    - _Requirements: 5.4, 5.5_

- [x] 16. Frontend i18n translations
  - Add Hindi and English translations for all test series UI strings
  - Labels: test listing, attempt flow, results, review, navigation, status badges
  - _Requirements: all (bilingual support)_

- [x] 17. Final checkpoint - End-to-end verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based test tasks that can be skipped for faster MVP
- All backend routes use existing jwtAuth middleware and validate middleware patterns
- Frontend uses existing AuthGuard, AppLayout, useTranslation patterns
- Database migrations use existing node-pg-migrate setup
- Property tests use fast-check (already in devDependencies) with minimum 100 iterations
