# Requirements Document

## Introduction

This document defines the requirements for Module 2: Dashboard of the UP Police Test Series platform. The Dashboard is the primary home screen for authenticated users, providing at-a-glance performance statistics, daily practice access, progress tracking, test category navigation, and a leaderboard preview. It serves as the central hub from which users navigate to all test-taking and analytics features. The Dashboard is mobile-first (PWA optimized), bilingual (Hindi/English), and follows the police-themed UI design system (Navy Blue, Gold, Red accent).

## Glossary

- **Dashboard_System**: The main dashboard module responsible for aggregating and displaying user statistics, progress data, daily quiz, test categories, and leaderboard information
- **Stats_Service**: The backend service responsible for computing and returning user performance statistics (tests taken, average score, current rank)
- **Daily_Quiz_Service**: The backend service responsible for selecting and serving the daily quiz (one quiz per day, refreshed at midnight IST)
- **Progress_Service**: The backend service responsible for computing weekly and monthly progress trends from test attempt history
- **Leaderboard_Service**: The backend service responsible for computing and returning ranked user scores for the leaderboard
- **Category_Navigator**: The UI component that displays test categories (Topic-wise, Sectional, Full Mock, Previous Year) and navigates users to filtered test listings
- **Quick_Stats_Card**: The UI component displaying key metrics — tests completed, average score percentage, and current rank
- **Progress_Chart**: The UI component rendering weekly and monthly score trend data as a visual chart
- **Streak_Indicator**: The UI component showing the user's current daily practice streak count
- **Language_Toggle**: The UI component allowing users to switch the dashboard interface between Hindi and English

## Requirements

### Requirement 1: Dashboard Page Load and Data Aggregation

**User Story:** As an authenticated user, I want the dashboard to load quickly with my personalized stats, so that I can immediately see my preparation status.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the Dashboard, THE Dashboard_System SHALL fetch and display the following sections within 3 seconds of page load: quick stats (total tests attempted, average score percentage, current rank, and daily streak count), today's quiz card (a single recommended test with title, duration, and question count), progress summary (tests completed this week and accuracy trend), test categories (subjects for the selected exam with test counts per subject), and leaderboard preview (top 5 users by score for the selected exam)
2. IF the user's session token (JWT) is missing, invalid, or expired, THEN THE Dashboard_System SHALL redirect the user to the login screen without loading any dashboard data
3. WHEN the Dashboard loads, THE Dashboard_System SHALL filter all displayed content (test categories, leaderboard, today's quiz card, and progress summary) to show only data associated with the user's currently selected exam as stored in their profile
4. IF any individual dashboard section (stats, quiz, progress, categories, leaderboard) fails to load due to a backend error, THEN THE Dashboard_System SHALL display an inline error message indicating the failure within that section along with a retry button, without blocking other sections from loading
5. WHEN the user pulls down on the Dashboard screen (mobile) or clicks a refresh control (desktop), THE Dashboard_System SHALL refetch all dashboard data and update the displayed content within 3 seconds
6. THE Dashboard_System SHALL serve cached dashboard data for repeated requests from the same user within a 60-second window to reduce database load
7. IF the user has no test attempts recorded, THEN THE Dashboard_System SHALL display each section in an empty state showing zero values for numeric stats and a prompt to start the first test in place of the today's quiz card
8. IF the user has no exam selected in their profile, THEN THE Dashboard_System SHALL redirect the user to the exam selection screen before loading dashboard content

### Requirement 2: Quick Stats Display

**User Story:** As a user, I want to see my key performance stats at a glance, so that I can track my overall preparation progress.

#### Acceptance Criteria

1. THE Quick_Stats_Card SHALL display three metrics: total tests completed (integer count, minimum 0), average score (percentage with one decimal place, range 0.0% to 100.0%), and current rank (integer position among all users for the same exam)
2. IF the user has not attempted any tests for the selected exam, THEN THE Quick_Stats_Card SHALL display "0" for tests completed, "—" for average score, and "—" for rank
3. THE Stats_Service SHALL compute average score as the arithmetic mean of percentage scores across all submitted (not in-progress) test attempts for the user's selected exam
4. THE Stats_Service SHALL compute rank by ordering all users of the same exam by their average score in descending order, breaking ties by the earlier date of most recent test submission, and assigning the user's 1-based position (1 = highest average score)
5. WHEN the user completes a new test, THE Stats_Service SHALL update the cached stats within 60 seconds of test submission
6. THE Quick_Stats_Card SHALL display a rank badge icon corresponding to the user's gamification rank (Constable, Head Constable, SI, Inspector) adjacent to the rank number
7. IF the Stats_Service fails to retrieve stats within 5 seconds, THEN THE Quick_Stats_Card SHALL display the last successfully retrieved values and show a non-blocking indicator that data may be stale

### Requirement 3: Today's Quiz Card

**User Story:** As a user, I want to see a daily quiz on my dashboard, so that I can maintain a daily practice habit.

#### Acceptance Criteria

1. THE Daily_Quiz_Service SHALL select one quiz (10 questions from the user's selected exam subjects) per day, refreshing at 00:00 IST each day
2. THE Dashboard_System SHALL display a Today's Quiz card showing the quiz title (bilingual), subject tags, question count (10), estimated duration (10 minutes), and a "Start Quiz" action button
3. WHEN the user has already completed today's quiz, THE Dashboard_System SHALL replace the "Start Quiz" button with a "View Score" button displaying the achieved score as a rounded integer percentage
4. WHEN the user taps "Start Quiz" and an in-progress attempt exists for today's quiz, THE Dashboard_System SHALL navigate the user to the test attempt screen resuming from the last answered question
5. WHEN the user taps "Start Quiz" and no in-progress attempt exists, THE Dashboard_System SHALL navigate the user to the test attempt screen starting a new attempt for today's quiz
6. IF today's quiz is not yet available (server has not generated the quiz for the current day), THEN THE Dashboard_System SHALL display a placeholder card with a message indicating the quiz will be available soon
7. THE Daily_Quiz_Service SHALL rotate quiz content across all 4 subjects (Hindi, GK/GS, Math, Reasoning) throughout the week, ensuring each subject appears at least once per 7-day cycle, with remaining days using a multi-subject mix containing questions from at least 2 subjects

### Requirement 4: Progress Summary

**User Story:** As a user, I want to see my score trends over time, so that I can understand whether my preparation is improving.

#### Acceptance Criteria

1. THE Progress_Chart SHALL display the user's score trend for the selected time period: weekly (last 7 days, day-by-day) or monthly (last 30 days, week-by-week)
2. THE Progress_Service SHALL compute daily average scores by averaging all test attempt percentage scores for each day within the selected period, rounding to the nearest integer, and treating days with no attempts as having no data point (omitted from the chart line rather than plotted as zero)
3. IF the user has fewer than 2 data points in the selected period, THEN THE Progress_Chart SHALL display a message encouraging the user to attempt more tests to see their progress trend, in place of the line chart
4. THE Dashboard_System SHALL provide a toggle allowing the user to switch between weekly and monthly views; the default view SHALL be weekly
5. THE Progress_Chart SHALL display the data as a line chart with the x-axis showing day labels (e.g., "Mon", "Tue") for weekly view or week-start dates for monthly view, and the y-axis showing score percentage from 0 to 100
6. WHEN the user taps on the Progress_Chart section, THE Dashboard_System SHALL navigate to the full Analytics page for detailed performance analysis
7. IF the Progress_Service fails to retrieve score data, THEN THE Progress_Chart SHALL display an error message indicating data is temporarily unavailable and provide a retry option

### Requirement 5: Test Category Navigation

**User Story:** As a user, I want to quickly navigate to different types of tests, so that I can choose the practice format that suits my preparation needs.

#### Acceptance Criteria

1. THE Category_Navigator SHALL display four test category options: Topic-wise Practice, Sectional Tests, Full Mock Tests, and Previous Year Papers
2. WHEN a user taps on an enabled test category, THE Category_Navigator SHALL navigate to the Test Listing page with the selected category applied as a filter
3. THE Category_Navigator SHALL display the count of published tests within their active schedule window in each category for the user's selected exam, including both free and premium tests
4. THE Category_Navigator SHALL display each category with a distinct icon, title in the user's selected language (Hindi or English), and the available test count
5. IF a category has zero published tests for the user's selected exam, THEN THE Category_Navigator SHALL display the category in a non-interactive disabled state with reduced visual opacity and a "Coming Soon" label in the user's selected language
6. THE Category_Navigator SHALL arrange the four categories in a 2x2 grid layout on screens narrower than 768px and in a single horizontal row on screens 768px or wider
7. IF the category test counts fail to load, THEN THE Category_Navigator SHALL display each category without a count and show a retry option to reload the counts

### Requirement 6: Leaderboard Preview

**User Story:** As a user, I want to see top performers on my dashboard, so that I can stay motivated and know where I stand.

#### Acceptance Criteria

1. THE Dashboard_System SHALL display a leaderboard preview showing the top 5 users by average score for the user's selected exam
2. THE Leaderboard_Service SHALL compute rankings based on average percentage score (rounded to one decimal place) across all submitted test attempts (including auto-submitted), with ties broken by total number of tests completed (more tests ranked higher)
3. WHEN the current user is within the top 5, THE Dashboard_System SHALL highlight their entry with a visually distinct gold background
4. WHEN the current user is not in the top 5, THE Dashboard_System SHALL display a 6th row showing the user's own rank and average score below the top 5
5. THE Dashboard_System SHALL display each leaderboard entry with: rank number, user name (truncated to 15 characters with ellipsis if longer), avatar, and average score percentage rounded to one decimal place
6. WHEN a user taps on the leaderboard preview section, THE Dashboard_System SHALL navigate to the full Leaderboard page with complete rankings
7. THE Leaderboard_Service SHALL update rankings every 5 minutes and serve cached results to all users
8. IF fewer than 5 users have completed at least one test for the selected exam, THEN THE Dashboard_System SHALL display only the available ranked users without empty rows
9. IF the Leaderboard_Service fails to return data or the cached data is unavailable, THEN THE Dashboard_System SHALL display a non-blocking error message indicating that leaderboard data is temporarily unavailable and hide the leaderboard section

### Requirement 7: Daily Streak Tracking

**User Story:** As a user, I want to see my daily practice streak, so that I am motivated to practice every day without breaking the chain.

#### Acceptance Criteria

1. THE Streak_Indicator SHALL display the user's current consecutive days of practice as an integer (0 to 9999), where any calendar day (IST) with at least one submitted test attempt (including the daily quiz) counts as a practice day
2. THE Dashboard_System SHALL define a streak day as any calendar day (IST, midnight-to-midnight 00:00:00 to 23:59:59) in which the user submitted at least one test attempt (including the daily quiz), using the submission timestamp to determine the calendar day
3. IF the user has a streak of 7 or more consecutive days, THEN THE Streak_Indicator SHALL display a flame icon adjacent to the streak count
4. IF the user has not submitted any test attempt on the current calendar day (IST) and has an active streak of 1 or more, THEN THE Streak_Indicator SHALL display a visually distinct warning icon alongside the streak count and a localized message indicating the user should practice today to maintain their streak
5. IF the user missed the previous calendar day (IST) with no test submitted, THEN THE Dashboard_System SHALL reset the streak count to 0 on the user's next page load, and the streak SHALL become 1 once the user submits a test attempt on the current day
6. THE Dashboard_System SHALL persist the streak data (current count and last practice date as IST calendar date) in the user's profile record
7. WHEN a user completes their first-ever test attempt, THE Dashboard_System SHALL initialize the streak count to 1 and record the current calendar day (IST) as the last practice date

### Requirement 8: Bilingual Dashboard Support

**User Story:** As a Hindi-speaking user, I want the dashboard to display all content in Hindi, so that I can navigate and understand everything without language barriers.

#### Acceptance Criteria

1. THE Dashboard_System SHALL display all static UI text — section titles, button labels, empty-state messages, and navigation labels — in the user's preferred language (Hindi or English) as stored in their profile, defaulting to Hindi for users who have not yet set a preference
2. THE Language_Toggle SHALL be visible in the Dashboard header on every dashboard page, operable via mouse click and keyboard, and allow the user to switch between Hindi and English without a full page reload
3. WHEN the user changes the language on the Dashboard, THE Dashboard_System SHALL persist the new preference in the User_Profile and render all dashboard content in the newly selected language within 1 second of the toggle action
4. THE Dashboard_System SHALL display dynamic content (quiz titles, category names, exam names) in the user's preferred language using the bilingual fields stored in the database
5. IF a bilingual field does not have a translation in the user's preferred language, THEN THE Dashboard_System SHALL display the English version of that field as a fallback without any visible error to the user
6. THE Dashboard_System SHALL format dates in DD/MM/YYYY format, times in HH:MM format, and numbers using the standard Arabic numeral digits (0-9) with Hindi locale grouping (e.g., 1,00,000) when the preferred language is Hindi, and international grouping (e.g., 100,000) when the preferred language is English
7. IF the language preference cannot be retrieved from the User_Profile due to a network or service error, THEN THE Dashboard_System SHALL default to Hindi and display the dashboard without blocking the user

### Requirement 9: Mobile-First Responsive Layout

**User Story:** As a user primarily accessing the platform on my mobile phone, I want the dashboard to be optimized for small screens, so that I can comfortably use it on my phone.

#### Acceptance Criteria

1. THE Dashboard_System SHALL render a single-column vertical layout on screens narrower than 768px, stacking sections in order: Quick Stats, Today's Quiz, Streak Indicator, Test Categories, Progress Chart, Leaderboard Preview
2. THE Dashboard_System SHALL render a multi-column layout on screens 768px and wider, placing Quick Stats and Today's Quiz side by side and utilizing available horizontal space
3. THE Dashboard_System SHALL ensure all interactive elements (buttons, cards, category tiles) have a minimum tap target size of 44x44 pixels on mobile screens
4. THE Dashboard_System SHALL support pull-to-refresh gesture on mobile devices to reload dashboard data; WHILE the refresh is in progress, THE Dashboard_System SHALL display a loading spinner at the top of the page
5. THE Dashboard_System SHALL use the police-themed color palette: primary background #F0F4F8, card backgrounds white, primary text and headers in Navy Blue #1B3A5C, accent elements in Gold #C5A028, and urgent indicators in Red #E63946
6. THE Dashboard_System SHALL render all dashboard content within the viewport without requiring horizontal scrolling on any screen width from 320px upward
7. IF the pull-to-refresh operation does not complete within 10 seconds, THEN THE Dashboard_System SHALL dismiss the loading spinner and display an error toast indicating the refresh failed

### Requirement 10: Navigation and App Shell Integration

**User Story:** As a user, I want the dashboard to be the home screen with clear navigation to all other sections, so that I can easily access any part of the platform.

#### Acceptance Criteria

1. THE Dashboard_System SHALL be rendered within the existing AppLayout shell that includes a bottom navigation bar (mobile) or side navigation (desktop)
2. WHILE the user is on the Dashboard page, THE Dashboard_System SHALL visually distinguish the Home/Dashboard icon in the navigation bar as the active item using a filled icon variant and highlighted label
3. WHEN an authenticated user with a complete profile opens the app root URL, THE Dashboard_System SHALL render the Dashboard page as the default landing page
4. THE Dashboard_System SHALL display the user's avatar and name (truncated to 20 characters with ellipsis if longer) in the header area, linking to the Profile Settings page on tap; IF the user has no avatar set, THEN THE Dashboard_System SHALL display a default placeholder icon containing the first letter of the user's name
5. THE Dashboard_System SHALL display a notification bell icon in the header area
6. WHEN the user taps the notification bell icon, THE Dashboard_System SHALL navigate to the Notifications screen
7. IF the user has unread notifications, THEN THE Dashboard_System SHALL display a numeric badge (count of unread notifications, maximum display "9+") on the notification bell icon

### Requirement 11: Loading States and Error Handling

**User Story:** As a user, I want to see clear loading indicators and helpful error messages, so that I know the system status at all times.

#### Acceptance Criteria

1. WHILE dashboard data is being fetched on initial page load, THE Dashboard_System SHALL display skeleton loading placeholders (shimmer effect) for each section matching the expected layout dimensions
2. IF a section's API call does not respond within 15 seconds or returns an error, THEN THE Dashboard_System SHALL display an error card within that section containing an error message in the user's selected language and a "Retry" button
3. WHEN the user taps "Retry" on a failed section, THE Dashboard_System SHALL display a loading indicator within that section and refetch only that section's data without reloading the entire page
4. IF the user has retried a failed section 3 times consecutively without success, THEN THE Dashboard_System SHALL disable the "Retry" button for that section and display a message indicating the user should try again later
5. IF all dashboard API calls fail within the same page load (indicating total network failure), THEN THE Dashboard_System SHALL display a full-page error state with an offline indicator, an error message in the user's selected language, and a "Retry" button to refetch all data
6. WHEN the device transitions from offline to online, THE Dashboard_System SHALL automatically attempt to reload failed sections within 3 seconds of connectivity restoration
7. IF the automatic reload triggered by connectivity restoration fails, THEN THE Dashboard_System SHALL retain the error card with the "Retry" button and not attempt further automatic reloads until the next offline-to-online transition
8. THE Dashboard_System SHALL display all loading and error state messages in the user's selected language (Hindi or English)

### Requirement 12: Performance and Caching

**User Story:** As a user on a slow mobile connection, I want the dashboard to load quickly even with limited bandwidth, so that I do not wait long to see my stats.

#### Acceptance Criteria

1. THE Stats_Service SHALL cache computed user stats (tests taken, average score, rank) in Redis with a key per user per exam and a TTL of 60 seconds
2. THE Leaderboard_Service SHALL cache the top 100 leaderboard entries in Redis per exam with a TTL of 300 seconds (5 minutes)
3. THE Daily_Quiz_Service SHALL cache the daily quiz selection per exam in Redis with a TTL that expires at 00:00 IST the next day
4. WHEN the dashboard page loads, THE Dashboard_System SHALL serve stale cached API response data immediately (max-stale age of 10 minutes) while fetching fresh data in the background using the stale-while-revalidate pattern, and SHALL discard cached data older than 10 minutes and show a loading state instead
5. THE Dashboard_System SHALL limit the total API payload for the initial dashboard load to no more than 50KB (uncompressed JSON) across all sections combined
6. WHEN the backend receives a dashboard data request and a valid (non-expired) cache entry exists in Redis, THE Dashboard_System SHALL serve the cached response without querying the database
7. WHEN a user completes a test attempt or a new score is computed, THE Stats_Service SHALL invalidate the cached stats entry for that user and exam so that the next request retrieves fresh data
8. IF Redis is unavailable or a cache miss occurs, THEN THE Dashboard_System SHALL fall back to querying the database directly and return the response within 3 seconds
9. IF the database query on cache miss takes longer than 3 seconds, THEN THE Dashboard_System SHALL return an error indication to the client and allow the user to retry
