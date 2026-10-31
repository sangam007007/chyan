# Requirements Document

## Introduction

Dashboard Dynamic Phase 1 replaces all hardcoded data in the UP Police Test Series dashboard with real, backend-driven data. This phase covers four features: Dynamic Streak (with best streak tracking), Days Left Until Exam countdown, a complete Coins gamification system, and a functional Daily Quiz. All features use IST timezone calculations and support bilingual (Hindi + English) display.

## Glossary

- **Dashboard**: The authenticated user's home screen showing stats, quiz, and navigation cards
- **Streak_Service**: The backend service that computes consecutive-day engagement streaks from the `user_activities` table using IST calendar boundaries
- **Coins_Service**: The backend service that manages per-user coin balance, earning events, and transaction history
- **Daily_Quiz_Service**: The backend service that generates, manages, and scores one 10-question quiz per user per IST calendar day
- **StatsRow**: The frontend component displaying four horizontal scrollable stat cards (Streak, Days Left, Daily Target, Coins)
- **DailyQuizCard**: The frontend component showing quiz status, start/reattempt buttons, and score
- **IST_Day**: A calendar day bounded by midnight-to-midnight in Asia/Kolkata timezone (UTC+5:30)
- **Current_Streak**: The number of consecutive IST calendar days the user has recorded activity, counting backward from today
- **Best_Streak**: The longest consecutive-day streak the user has ever achieved
- **Coin_Balance**: The total accumulated coins for a user (sum of all earned minus spent)
- **Earning_Event**: A specific action that awards coins to a user (login, streak milestone, referral, quiz complete, test complete)
- **Quiz_Attempt**: A record of one user's submission of a daily quiz including answers, score, and timestamp

## Requirements

### Requirement 1: Dynamic Streak Display

**User Story:** As a student, I want to see my real streak data on the dashboard, so that I am motivated by accurate progress tracking.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Streak_Service SHALL compute the Current_Streak by counting consecutive IST calendar days of activity backward from today
2. WHEN the dashboard loads, THE Streak_Service SHALL return the Best_Streak representing the longest consecutive-day streak ever achieved by the user
3. THE StatsRow SHALL display the Current_Streak value in the streak card
4. THE StatsRow SHALL display the Best_Streak value as the "Best" sub-text in the streak card
5. WHEN the user opens the dashboard, THE Streak_Service SHALL record today's activity in the `user_activities` table (idempotent, once per IST day)
6. THE StatsRow SHALL display day circles representing the last 7 IST calendar days with active/inactive state from real activity data
7. IF the user has zero activity records, THEN THE StatsRow SHALL display Current_Streak as 0 and Best_Streak as 0

### Requirement 2: Best Streak Tracking

**User Story:** As a student, I want the system to persistently track my best ever streak, so that I can see my personal record even after a streak break.

#### Acceptance Criteria

1. WHEN a new streak value is computed that exceeds the stored Best_Streak, THE Streak_Service SHALL update the Best_Streak for that user
2. THE Streak_Service SHALL store the Best_Streak persistently in the database per user
3. WHEN the user's streak resets to zero, THE Streak_Service SHALL retain the previously stored Best_Streak value unchanged
4. THE Streak_Service SHALL initialize Best_Streak to 0 for new users with no activity history

### Requirement 3: Days Left Until Exam

**User Story:** As a student, I want to see how many days are left until my selected exam, so that I can plan my preparation accordingly.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Dashboard SHALL compute days_left as the number of calendar days between today (IST) and the exam_date of the user's selected exam
2. THE StatsRow SHALL display the computed days_left value in the "Days Left" card
3. THE StatsRow SHALL display the exam date formatted as "Exam: DD Mon" in the sub-text of the Days Left card
4. IF the user has not selected an exam, THEN THE Dashboard SHALL display "--" as the days_left value
5. IF the exam_date is in the past, THEN THE Dashboard SHALL display 0 as the days_left value
6. THE `exams` table SHALL store an `exam_date` field of type DATE for each exam

### Requirement 4: Coins Balance Display

**User Story:** As a student, I want to see my coin balance on the dashboard, so that I am motivated to earn more through consistent engagement.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Coins_Service SHALL return the current Coin_Balance for the authenticated user
2. THE StatsRow SHALL display the Coin_Balance value in the Coins stat card
3. WHEN the user taps the Coins card, THE Dashboard SHALL display a modal showing all earning conditions and their coin values
4. THE Coins_Service SHALL provide a GET /api/coins/balance endpoint returning the user's current balance
5. THE Coins_Service SHALL provide a GET /api/coins/history endpoint returning the user's coin transaction history ordered by most recent first

### Requirement 5: Coins Earning — Daily Login

**User Story:** As a student, I want to earn coins for opening the app daily, so that I am rewarded for consistency.

#### Acceptance Criteria

1. WHEN the user opens the dashboard for the first time in an IST calendar day, THE Coins_Service SHALL award 10 coins for the daily login event
2. IF the user has already received a daily login coin award for the current IST day, THEN THE Coins_Service SHALL not award additional login coins
3. THE Coins_Service SHALL record each earning event with a type, amount, and timestamp

### Requirement 6: Coins Earning — 7-Day Streak Bonus

**User Story:** As a student, I want to earn a bonus when I maintain a 7-day streak, so that I have an extra incentive for consistency.

#### Acceptance Criteria

1. WHEN the user's Current_Streak reaches exactly 7, THE Coins_Service SHALL award 50 bonus coins
2. THE Coins_Service SHALL award the 7-day streak bonus only once per streak cycle (not again until streak resets and reaches 7 again)
3. THE Coins_Service SHALL record the streak bonus as a distinct earning event type

### Requirement 7: Coins Earning — Referral

**User Story:** As a student, I want to earn coins when someone I referred completes signup, so that I am incentivized to invite friends.

#### Acceptance Criteria

1. WHEN a referred user completes signup, THE Coins_Service SHALL award 200 coins to the referring user
2. THE Coins_Service SHALL validate that the referral relationship exists before awarding coins
3. THE Coins_Service SHALL award referral coins only once per unique referred user

### Requirement 8: Coins Earning — Quiz and Test Completion

**User Story:** As a student, I want to earn coins for completing quizzes and tests, so that I am motivated to practice regularly.

#### Acceptance Criteria

1. WHEN the user completes a daily quiz, THE Coins_Service SHALL award 5 coins
2. WHEN the user submits a full test, THE Coins_Service SHALL award 10 coins
3. THE Coins_Service SHALL award quiz completion coins only once per daily quiz per IST day
4. THE Coins_Service SHALL award test completion coins once per submitted test attempt
5. THE Coins_Service SHALL provide a POST /api/coins/earn endpoint that accepts an earning event type and validates eligibility before awarding

### Requirement 9: Daily Quiz — Quiz Generation

**User Story:** As a student, I want to attempt a fresh 10-question quiz each day, so that I can practice with varied questions daily.

#### Acceptance Criteria

1. WHEN the user starts the daily quiz, THE Daily_Quiz_Service SHALL generate a quiz with exactly 10 questions
2. THE Daily_Quiz_Service SHALL select questions randomly from subjects associated with the user's selected exam
3. THE Daily_Quiz_Service SHALL select only active questions (is_active = true)
4. THE Daily_Quiz_Service SHALL not repeat questions the user has answered in the last 30 days
5. IF fewer than 10 eligible questions are available, THEN THE Daily_Quiz_Service SHALL fill the quiz with previously seen questions to reach 10

### Requirement 10: Daily Quiz — Attempt and Scoring

**User Story:** As a student, I want to take the daily quiz with a timer and see my score immediately, so that I can track daily performance.

#### Acceptance Criteria

1. WHEN the daily quiz starts, THE Daily_Quiz_Service SHALL set a timer of 8 minutes (480 seconds)
2. WHEN the timer reaches zero, THE Daily_Quiz_Service SHALL auto-submit the quiz with current answers
3. WHEN the user submits the quiz, THE Daily_Quiz_Service SHALL compute and return the score immediately (correct count out of 10)
4. THE Daily_Quiz_Service SHALL store the quiz attempt with questions, answers, score, and time taken
5. THE Daily_Quiz_Service SHALL allow only one quiz attempt per user per IST calendar day
6. IF the user has already completed today's quiz, THEN THE Daily_Quiz_Service SHALL return the existing attempt result instead of allowing a new attempt

### Requirement 11: Daily Quiz — Dashboard Card State

**User Story:** As a student, I want the quiz card to show my completion status, so that I know if I have already taken today's quiz.

#### Acceptance Criteria

1. WHEN today's quiz has not been attempted, THE DailyQuizCard SHALL display a "Start Quiz" button
2. WHEN today's quiz has been completed, THE DailyQuizCard SHALL display the score and "Reattempt" and "View Result" buttons
3. WHEN the user clicks "Reattempt", THE DailyQuizCard SHALL start the same quiz (same questions) for review without awarding additional coins
4. WHEN the user clicks "View Result", THE DailyQuizCard SHALL navigate to a result screen showing correct/incorrect answers with explanations
5. THE DailyQuizCard SHALL refresh its state at midnight IST to show "Start Quiz" for the new day

### Requirement 12: Daily Quiz — Bilingual Support

**User Story:** As a student, I want to see quiz questions in my preferred language, so that I can understand questions clearly.

#### Acceptance Criteria

1. THE Daily_Quiz_Service SHALL return questions with both Hindi and English text (text_en, text_hi, options in both languages)
2. THE DailyQuizCard SHALL display questions and options in the user's currently selected language
3. WHEN the user toggles language during the quiz, THE DailyQuizCard SHALL switch all question and option text to the newly selected language without restarting the timer
