# Requirements Document

## Introduction

Module 2 of the UP Police Test Series platform covers the complete test series workflow — from question bank management and test creation to test-taking, scoring, and result review. The module enables administrators to manage bilingual (Hindi/English) MCQ question banks and create mock tests mapped to specific exams, while users can browse available tests, attempt them under timed conditions, and review detailed performance breakdowns after submission.

## Glossary

- **Question_Bank**: The persistent store of MCQ questions with bilingual content, tagging, and metadata
- **Test**: A collection of questions drawn from the Question_Bank with rules for duration, marking, and availability
- **Test_Attempt**: A record of a user taking a specific test, tracking answers, timing, and score
- **Question_Navigation_Panel**: A numbered grid UI component showing answered, unanswered, and review-marked question states
- **Score_Calculator**: The service that computes marks using correct answers, negative marking ratio, and skipped questions
- **Test_Listing_Service**: The service responsible for filtering and sorting available tests for a user
- **Seed_Service**: The service that populates sample tests and questions for initial platform content

## Requirements

### Requirement 1: Question Bank Storage

**User Story:** As an administrator, I want to store MCQ questions with bilingual content and metadata, so that questions can be reused across multiple tests.

#### Acceptance Criteria

1. THE Question_Bank SHALL store each question with text in both Hindi and English, four options in both languages, the correct answer index (0-3), and an explanation in both languages
2. THE Question_Bank SHALL associate each question with a subject tag (GK, Math, Reasoning, Hindi), a topic string, and a difficulty level (easy, medium, hard)
3. THE Question_Bank SHALL associate each question with one or more exams via exam identifiers
4. THE Question_Bank SHALL support an optional image URL field for questions that include visual content
5. WHEN a question is created, THE Question_Bank SHALL validate that exactly four options exist and the correct answer index is within range 0-3

### Requirement 2: Test Creation and Configuration

**User Story:** As an administrator, I want to create mock tests from the question bank with configurable rules, so that tests match the actual exam pattern.

#### Acceptance Criteria

1. WHEN a test is created, THE Test SHALL have a bilingual title (Hindi and English), duration in minutes, total marks, negative marking ratio (0 to 1), and passing marks
2. WHEN a test is created, THE Test SHALL be associated with a specific exam identifier
3. THE Test SHALL have a pricing type of either free or premium
4. THE Test SHALL have a publication status of either draft or published
5. WHEN a test has schedule dates configured, THE Test_Listing_Service SHALL only show the test between the available_from and available_until dates
6. THE Test SHALL reference an ordered list of question identifiers drawn from the Question_Bank

### Requirement 3: Test Listing and Discovery

**User Story:** As a user, I want to see available tests filtered by my selected exam, so that I only see relevant tests.

#### Acceptance Criteria

1. WHEN a user views the test listing, THE Test_Listing_Service SHALL return only published tests associated with the user's currently selected exam
2. WHEN returning test listings, THE Test_Listing_Service SHALL include test title (in user's preferred language), duration, total questions count, total marks, and free/premium indicator
3. WHEN returning test listings, THE Test_Listing_Service SHALL include the user's attempt status for each test (not_attempted, in_progress, completed with score)
4. WHEN a user requests sorting, THE Test_Listing_Service SHALL support sorting by newest (creation date), popularity (attempt count), and difficulty (average difficulty of questions)
5. WHILE a test's schedule window has not started or has ended, THE Test_Listing_Service SHALL exclude that test from listings

### Requirement 4: Test Attempt Flow

**User Story:** As a user, I want to take a timed test with question navigation, so that I can simulate the real exam experience.

#### Acceptance Criteria

1. WHEN a user starts a test, THE Test_Attempt SHALL create an attempt record with a start timestamp and calculate the end time based on test duration
2. WHEN a user views a question during an attempt, THE Test_Attempt SHALL display the question text, four options as radio buttons, and a mark-for-review checkbox
3. WHEN a user navigates between questions, THE Question_Navigation_Panel SHALL display a numbered grid indicating answered (green), unanswered (gray), and marked-for-review (orange) states
4. WHEN the timer reaches zero, THE Test_Attempt SHALL auto-submit the test with all answers recorded up to that point
5. WHEN a user submits a test, THE Score_Calculator SHALL compute the total score using the formula: (correct_count × marks_per_question) - (wrong_count × marks_per_question × negative_marking_ratio)
6. WHEN a user attempts a test they completed within the last 24 hours, THE Test_Attempt SHALL reject the attempt and return a cooldown error with the remaining wait time
7. WHEN a user selects an answer, THE Test_Attempt SHALL persist that answer immediately so that no data is lost on unexpected disconnection

### Requirement 5: Results and Performance Review

**User Story:** As a user, I want to see detailed results after completing a test, so that I can identify my strengths and weaknesses.

#### Acceptance Criteria

1. WHEN a test is submitted, THE Score_Calculator SHALL return the total score, percentage, correct count, wrong count, skipped count, and time taken
2. WHEN displaying results, THE Score_Calculator SHALL compute a rank percentile based on all attempts for that test
3. WHEN displaying results, THE Score_Calculator SHALL provide a subject-wise breakdown showing correct, wrong, and skipped counts per subject
4. WHEN a user reviews answers, THE Test_Attempt SHALL display each question with the user's selected answer, the correct answer, and the explanation in the user's preferred language
5. WHEN a user marks a question for revision during review, THE Test_Attempt SHALL persist that marking to the user's revision list

### Requirement 6: Seed Data

**User Story:** As a developer, I want sample tests pre-populated for the UP Police Constable exam, so that the platform has initial content for testing and demonstration.

#### Acceptance Criteria

1. WHEN the seed migration runs, THE Seed_Service SHALL create at least 2 sample tests for the UP Police Constable exam with 10-20 questions each
2. WHEN seeding questions, THE Seed_Service SHALL include questions across all four subjects (GK, Math, Reasoning, Hindi) with varied difficulty levels
3. THE Seed_Service SHALL create questions with complete bilingual content (Hindi and English) for question text, options, and explanations
