# Requirements Document

## Introduction

This document defines the requirements for Module 1: Authentication & User Management of the UP Police Test Series platform. The Auth Module is the foundational module that enables user registration, login, profile management, and session handling. It supports Phone OTP-based login (primary) and Google OAuth login as authentication methods, with bilingual (Hindi/English) support throughout. The module handles the complete onboarding flow from first-time user registration through exam selection to profile setup, as well as session management for returning users.

## Glossary

- **Auth_System**: The authentication and user management system responsible for login, registration, session management, and profile operations
- **OTP_Service**: The service responsible for generating, sending, and verifying One-Time Passwords via SMS
- **OAuth_Provider**: The external Google OAuth service used for social login
- **User_Profile**: The data entity containing user information including name, phone number, email, selected exam, preferred language, and avatar
- **Session_Manager**: The component responsible for JWT token issuance, refresh, validation, and revocation
- **Onboarding_Flow**: The sequence of steps a new user must complete after first login (exam selection → profile setup)
- **Rate_Limiter**: The component that restricts the frequency of authentication attempts to prevent abuse
- **Language_Toggle**: The UI component allowing users to switch between Hindi and English interface language
- **Exam_Selector**: The component that presents available exams and captures user selection during onboarding
- **Account_Linker**: The component responsible for merging Google OAuth accounts with existing phone-based accounts

## Requirements

### Requirement 1: Phone Number Input and Validation

**User Story:** As a new or returning user, I want to enter my phone number to receive an OTP, so that I can authenticate securely using my mobile number.

#### Acceptance Criteria

1. THE Auth_System SHALL accept a 10-digit Indian mobile number (starting with 6, 7, 8, or 9) as valid input for OTP-based authentication
2. WHEN a user submits a phone number with fewer or more than 10 digits, THE Auth_System SHALL display an inline validation error below the input field in the user's selected language indicating the required digit count
3. WHEN a user submits a phone number not starting with 6, 7, 8, or 9, THE Auth_System SHALL reject the input and display an error message indicating an invalid mobile number format
4. THE Auth_System SHALL strip all spaces, dashes, and country code prefixes (+91) from the phone number input before validation
5. THE Auth_System SHALL display the +91 country code prefix as a non-editable label adjacent to the phone number input field at all times
6. THE Auth_System SHALL restrict the phone number input field to numeric characters only (0-9) and limit the field to a maximum length of 10 characters
7. IF the user submits the phone number input field while it is empty, THEN THE Auth_System SHALL display an inline validation error below the input field indicating that a phone number is required

### Requirement 2: OTP Generation and Delivery

**User Story:** As a user, I want to receive an OTP on my phone number, so that I can verify my identity and complete login.

#### Acceptance Criteria

1. WHEN a valid phone number is submitted, THE OTP_Service SHALL generate a 6-digit numeric OTP (range 000000–999999) and send it via SMS within 10 seconds of the request
2. THE OTP_Service SHALL set each generated OTP to expire after 300 seconds (5 minutes) from the time of generation
3. WHEN a new OTP is generated for the same phone number, THE OTP_Service SHALL invalidate all previously generated unexpired OTPs for that phone number
4. IF the SMS delivery fails (provider returns an error or no delivery confirmation is received within 10 seconds), THEN THE Auth_System SHALL display an error message indicating SMS delivery failure and prompting the user to retry after 30 seconds
5. THE OTP_Service SHALL log each OTP generation event with a timestamp, phone number hash, and delivery status (sent, failed, or pending) for audit purposes
6. IF a phone number has received 5 OTP generation requests within a 15-minute window, THEN THE OTP_Service SHALL reject further OTP requests for that phone number and THE Auth_System SHALL display an error message indicating the rate limit has been exceeded
7. IF the submitted phone number does not match the valid format, THEN THE Auth_System SHALL display an error message indicating the phone number format is invalid and SHALL NOT trigger OTP generation

### Requirement 3: OTP Verification

**User Story:** As a user, I want to verify my identity by entering the OTP I received, so that I can access my account securely.

#### Acceptance Criteria

1. WHEN a user submits a valid 6-digit numeric OTP that matches the issued code and is within the 300-second expiry window, THE Auth_System SHALL authenticate the user, issue a session token, and invalidate the OTP so it cannot be reused
2. WHEN a user submits an OTP that does not match the issued code, THE Auth_System SHALL display an error message indicating the OTP is invalid, display the number of remaining attempts out of 5, and allow the user to re-enter an OTP
3. WHEN a user submits an OTP after the 300-second expiry window, THE Auth_System SHALL display an error message indicating the OTP has expired and offer a resend option
4. WHEN a user fails OTP verification 5 consecutive times for the same phone number, THE Auth_System SHALL block further OTP verification attempts for that phone number for 15 minutes and display a message indicating the remaining lockout duration
5. IF a user attempts OTP verification for a phone number that is currently within its 15-minute lockout period, THEN THE Auth_System SHALL reject the attempt and display a message indicating the remaining lockout duration
6. WHERE the device supports the Web OTP API, THE Auth_System SHALL auto-read the OTP from SMS and populate the input field without requiring manual entry

### Requirement 4: OTP Resend and Rate Limiting

**User Story:** As a user, I want to resend the OTP if I did not receive it, so that I can complete my login without being stuck.

#### Acceptance Criteria

1. WHEN a user requests an OTP resend, THE OTP_Service SHALL enforce a minimum 30-second cooldown between consecutive resend requests for the same phone number and reject any resend request made before the cooldown expires
2. THE Rate_Limiter SHALL restrict OTP generation to a maximum of 5 OTPs per phone number within a 1-hour rolling window
3. WHEN the hourly OTP limit is reached, THE Auth_System SHALL disable the resend option, display a message indicating the user must wait before requesting another OTP, and show the remaining wait time in minutes and seconds until the rolling window allows a new request
4. WHILE the 30-second cooldown is active, THE Auth_System SHALL display a visible countdown timer showing the remaining seconds until the next resend is available and disable the resend button until the countdown reaches zero
5. WHEN a user requests a resend, THE OTP_Service SHALL invalidate the previous OTP immediately and generate a new OTP with a fresh validity period
6. IF a user submits a previously invalidated OTP after a resend has been requested, THEN THE Auth_System SHALL reject the submission and display an error message indicating the OTP is no longer valid

### Requirement 5: Google OAuth Login

**User Story:** As a user, I want to log in using my Google account, so that I can authenticate quickly without waiting for an OTP.

#### Acceptance Criteria

1. WHEN a user initiates Google OAuth login, THE Auth_System SHALL redirect to the Google consent screen and request email and profile scope
2. WHEN Google OAuth returns a valid authorization code, THE Auth_System SHALL exchange the code for user information within 10 seconds, create or retrieve the corresponding user account, and issue an authenticated session to the user
3. IF Google OAuth returns an error or the user cancels the consent screen, THEN THE Auth_System SHALL display an error message indicating that authentication was not completed and return the user to the login screen
4. IF the Google OAuth token exchange fails due to network issues or does not complete within 10 seconds, THEN THE Auth_System SHALL display an error message indicating a connection problem and offer the user the option to retry or use phone OTP login instead
5. THE Auth_System SHALL extract the user's name, email, and profile picture from the Google OAuth response and store them in the User_Profile; IF the profile picture or name is not provided by Google, THEN THE Auth_System SHALL store the email and leave the missing fields empty in the User_Profile
6. IF the email returned by Google OAuth matches an existing account registered via a different login method, THEN THE Auth_System SHALL link the Google identity to the existing account and authenticate the user into that account

### Requirement 6: Account Linking (Google + Phone)

**User Story:** As a user who registered with my phone number, I want to link my Google account, so that I can log in using either method in the future.

#### Acceptance Criteria

1. WHEN a user logs in via Google OAuth and an account with the same email already exists (registered via phone), THE Account_Linker SHALL prompt the user to confirm linking the two accounts, displaying the existing account's phone number (partially masked) for identification
2. WHEN the user confirms account linking, THE Account_Linker SHALL merge the Google OAuth credentials with the existing phone-based account, preserving the existing account's profile data (name, exam selection, test history) and adding the Google profile picture only if no avatar was previously set
3. WHEN a user logs in via phone OTP and an account with the same phone number already exists (registered via Google), THE Account_Linker SHALL prompt the user to confirm linking the phone number to the existing Google-registered account
4. IF a user declines account linking, THEN THE Auth_System SHALL create a separate new account using the Google OAuth credentials and route the user through the standard onboarding flow
5. WHEN the account linking confirmation prompt is displayed and the user does not respond within 120 seconds, THE Account_Linker SHALL treat the inaction as a decline and create a separate new account
6. THE Account_Linker SHALL check both phone number and email against existing accounts during every login attempt, and if a match is found, trigger the account linking confirmation prompt instead of creating a duplicate account

### Requirement 7: Session Management and Token Handling

**User Story:** As an authenticated user, I want my session to persist across browser sessions, so that I do not have to log in every time I open the app.

#### Acceptance Criteria

1. WHEN a user successfully authenticates, THE Session_Manager SHALL issue a JWT access token with a 1-hour expiry and a refresh token with a 30-day expiry
2. WHEN an API request returns an authentication failure due to an expired access token and a valid refresh token exists, THE Session_Manager SHALL issue a new access token within 2 seconds without requiring re-authentication and retry the failed request
3. IF the refresh token is expired, revoked, or invalid, THEN THE Session_Manager SHALL clear all client-side token storage and redirect the user to the login screen
4. THE Session_Manager SHALL store the refresh token in an HTTP-only secure cookie and store the access token only in memory (not in localStorage or sessionStorage) to prevent XSS-based token theft
5. WHEN a user logs out, THE Session_Manager SHALL invalidate both the access token and refresh token on the server and clear all client-side token storage
6. THE Session_Manager SHALL allow a maximum of 3 concurrent active sessions per user account

### Requirement 8: Multi-Device Session Control

**User Story:** As a user, I want to manage my active sessions across devices, so that I can ensure my account is not being used without my knowledge.

#### Acceptance Criteria

1. WHEN a user logs in on a 4th device (exceeding the 3-session limit), THE Session_Manager SHALL terminate the session with the earliest login time and display a message on that device indicating the session was ended due to a login on another device
2. THE Auth_System SHALL provide a list of all active sessions in the user's profile settings, showing device type (Mobile, Desktop, or Tablet), location (city-level), last active timestamp with minute precision, and a visual indicator identifying the current session
3. WHEN a user requests to terminate a specific remote session, THE Session_Manager SHALL invalidate that session's tokens within 5 seconds and remove the session from the active sessions list
4. WHEN a user selects "Logout from all devices", THE Session_Manager SHALL invalidate all active sessions except the current one within 5 seconds and update the active sessions list to show only the current session
5. IF a user attempts to terminate their own current session from the active sessions list, THEN THE Auth_System SHALL prevent the action and display a message indicating the current session cannot be remotely terminated

### Requirement 9: New User Onboarding — Exam Selection

**User Story:** As a new user, I want to select the exam I am preparing for during onboarding, so that the platform can show me relevant content.

#### Acceptance Criteria

1. WHEN a new user completes authentication for the first time, THE Onboarding_Flow SHALL redirect the user to the Exam Selection screen before granting access to the dashboard
2. THE Exam_Selector SHALL display available exams organized by category (State Exams, Central Exams) with exam name, a description of no more than 100 characters, and icon
3. THE Exam_Selector SHALL allow the user to select exactly one primary exam during onboarding
4. WHEN the user selects an exam and confirms, THE Auth_System SHALL store the selected exam in the User_Profile and proceed to the Profile Setup screen
5. IF the user attempts to navigate away from Exam Selection without making a selection, THEN THE Onboarding_Flow SHALL display a prompt explaining that exam selection is required to proceed
6. IF the exam list fails to load due to a network or server error, THEN THE Exam_Selector SHALL display an error message indicating the exams could not be loaded and provide a retry button
7. IF saving the selected exam to the User_Profile fails, THEN THE Auth_System SHALL display an error message indicating the selection could not be saved, preserve the user's selection on screen, and allow the user to retry

### Requirement 10: New User Onboarding — Profile Setup

**User Story:** As a new user, I want to set up my profile with my name and preferences, so that my experience is personalized.

#### Acceptance Criteria

1. WHEN a new user completes exam selection, THE Onboarding_Flow SHALL display the Profile Setup screen with fields for full name, preferred language (Hindi or English), and optional avatar upload
2. IF the user authenticated via Google OAuth and Google profile data includes name or profile picture, THEN THE Auth_System SHALL pre-fill the full name and avatar fields with the corresponding Google OAuth data
3. THE Auth_System SHALL require the full name field to contain at least 2 characters and no more than 50 characters, consisting only of letters, spaces, hyphens, and periods
4. THE Auth_System SHALL require the user to select a preferred language (Hindi or English) before submission, defaulting to Hindi if no prior selection exists
5. WHEN the user has provided a valid full name and selected a preferred language and submits the form, THE Auth_System SHALL save the profile data and redirect to the Dashboard within 5 seconds
6. IF the profile save operation fails due to network or server error, THEN THE Auth_System SHALL display an error message indicating the failure and allow the user to retry submission without re-entering data
7. IF the user closes the app during profile setup without submitting, THEN THE Auth_System SHALL mark the profile as incomplete and redirect back to Profile Setup on next login

### Requirement 11: Returning User Login Flow

**User Story:** As a returning user with a complete profile, I want to be taken directly to the Dashboard after login, so that I can start using the platform immediately.

#### Acceptance Criteria

1. WHEN a returning user with a complete profile authenticates successfully, THE Auth_System SHALL redirect the user to the Dashboard within 2 seconds of successful authentication
2. WHEN a returning user with an incomplete profile authenticates, THE Auth_System SHALL redirect the user to the first incomplete onboarding step in sequence: Exam Selection if no exam is selected, otherwise Profile Setup if full name or preferred language is missing
3. WHEN a user opens the app with a valid non-expired session, THE Auth_System SHALL validate the session token and display the Dashboard directly, bypassing the login screen
4. IF a user opens the app with an invalid, expired, or revoked session token, THEN THE Auth_System SHALL clear the stored session and redirect the user to the login screen
5. THE Auth_System SHALL determine profile completeness by verifying that all of the following fields contain non-empty values: full name (at least 2 characters), selected exam, and preferred language

### Requirement 12: User Profile Management

**User Story:** As a registered user, I want to view and edit my profile information, so that I can keep my details up to date.

#### Acceptance Criteria

1. THE Auth_System SHALL provide a Profile Settings screen accessible from the Dashboard navigation showing name, phone number, email, selected exam, preferred language, and avatar
2. WHEN a user edits their full name, THE Auth_System SHALL validate the input (2-50 characters, allowing letters, spaces, and periods only) and persist the change within 3 seconds, displaying a success confirmation upon save
3. IF a user submits a full name that fails validation, THEN THE Auth_System SHALL display an inline error message indicating the validation rule that was violated and retain the previously saved name
4. WHEN a user changes their preferred language, THE Language_Toggle SHALL update the entire UI to the selected language (Hindi or English) without requiring a page reload
5. THE Auth_System SHALL display the user's phone number and email as read-only fields (non-editable after registration), showing the email field only if one is associated with the account
6. WHEN a user uploads a new avatar image, THE Auth_System SHALL accept JPEG and PNG formats with a file size no greater than 2MB and minimum dimensions of 200x200 pixels, and present a square crop selection before saving
7. IF a user uploads an avatar file that exceeds 2MB, is not in JPEG or PNG format, or is below 200x200 pixels, THEN THE Auth_System SHALL reject the upload and display an error message indicating which constraint was violated

### Requirement 13: Exam Selection Change

**User Story:** As a user, I want to change my selected exam after onboarding, so that I can switch my preparation focus if my exam preference changes.

#### Acceptance Criteria

1. THE Auth_System SHALL provide an option to change the selected exam from the Profile Settings screen
2. WHEN a user initiates an exam change, THE Exam_Selector SHALL display the full list of available exams organized by category (State Exams, Central Exams) with the current selection highlighted and the confirm action disabled until a different exam is selected
3. WHEN the user confirms a new exam selection, THE Auth_System SHALL update the User_Profile and redirect the user to the Dashboard displaying content for the newly selected exam
4. WHEN the user changes their exam, THE Auth_System SHALL preserve all previous test history and analytics data without deletion
5. THE Auth_System SHALL allow a maximum of 3 exam changes per calendar month to prevent abuse
6. IF a user attempts to change their exam after reaching the 3-change monthly limit, THEN THE Auth_System SHALL display an error message indicating the limit has been reached and show the date when the next calendar month begins
7. WHEN a user initiates an exam change, THE Exam_Selector SHALL disable the confirm action if the user selects the same exam that is already active in their profile

### Requirement 14: Bilingual Interface Support

**User Story:** As a Hindi-speaking user, I want to use the authentication and profile screens in Hindi, so that I can understand all prompts and messages clearly.

#### Acceptance Criteria

1. THE Auth_System SHALL display all authentication screen content — including field labels, button text, placeholder text, screen titles, and navigation items on login, OTP input, and Google OAuth prompts — in the user's selected language (Hindi or English)
2. THE Language_Toggle SHALL be accessible on the login screen before authentication, allowing new users to select their preferred language
3. WHEN a user changes language via the Language_Toggle, THE Auth_System SHALL persist the selection in local storage for unauthenticated users and in the User_Profile for authenticated users, and update the entire displayed UI to the newly selected language without requiring a page reload
4. IF no language preference has been set (new visitor with no local storage value and no User_Profile preference), THEN THE Auth_System SHALL default to Hindi as the display language
5. THE Auth_System SHALL display all error messages, validation messages, and success messages in the user's selected language
6. IF a translation is unavailable for a UI string in the selected language, THEN THE Auth_System SHALL display the English version of that string as a fallback

### Requirement 15: Account Deactivation and Deletion

**User Story:** As a user, I want the ability to delete my account and data, so that I can exercise my right to data removal.

#### Acceptance Criteria

1. THE Auth_System SHALL provide a "Delete Account" option in the Profile Settings screen
2. WHEN a user requests account deletion, THE Auth_System SHALL require re-authentication (OTP verification to the registered phone number) before proceeding
3. IF re-authentication fails during account deletion (incorrect OTP or maximum OTP attempts exceeded), THEN THE Auth_System SHALL cancel the deletion request and display an error message indicating the deletion could not be processed
4. WHEN a user confirms account deletion after successful re-authentication, THE Auth_System SHALL schedule the account for permanent deletion after a 7-day grace period and display a confirmation message indicating the scheduled deletion date
5. WHILE the 7-day grace period is active, THE Auth_System SHALL maintain full account functionality and display a persistent banner indicating the pending deletion date and an option to cancel
6. WHILE the 7-day grace period is active, THE Auth_System SHALL allow the user to cancel the deletion request by logging in and confirming cancellation
7. WHEN the 7-day grace period expires, THE Auth_System SHALL permanently delete all user data including profile, test history, analytics, and linked OAuth credentials from the database
8. WHEN a user confirms account deletion after re-authentication, THE Auth_System SHALL immediately terminate all active sessions except the current one, and terminate the current session after displaying the deletion confirmation

### Requirement 16: Network Failure Handling

**User Story:** As a user with an unstable internet connection, I want clear feedback when network issues occur during authentication, so that I know what action to take.

#### Acceptance Criteria

1. IF a network request fails during OTP sending, THEN THE Auth_System SHALL display an error message indicating connectivity issues and provide a retry button that allows the user to reattempt up to 3 consecutive retries before displaying a message advising the user to check their connection and try again later
2. IF a network request fails during OTP verification, THEN THE Auth_System SHALL preserve the entered OTP in the input field and allow the user to retry without re-entering the code, provided the OTP has not exceeded its 300-second expiry window; IF the OTP has expired during the network outage, THEN THE Auth_System SHALL clear the input field and prompt the user to request a new OTP
3. IF a network request fails during Google OAuth flow, THEN THE Auth_System SHALL return the user to the login screen with an error message suggesting to check connectivity
4. WHEN network connectivity is lost during any authentication step, THE Auth_System SHALL detect the offline state within 5 seconds and display an offline indicator banner at the top of the screen that persists until connectivity is restored
5. WHEN network connectivity is restored after a failure, THE Auth_System SHALL automatically retry the failed request once without user intervention; IF the automatic retry also fails, THEN THE Auth_System SHALL display an error message indicating the issue persists and present a manual retry button
6. WHEN network connectivity is restored, THE Auth_System SHALL dismiss the offline indicator banner within 3 seconds and display a brief confirmation that connectivity has been re-established

### Requirement 17: Security and Abuse Prevention

**User Story:** As a platform operator, I want the authentication system to prevent brute-force attacks and abuse, so that user accounts remain secure.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL restrict login attempts (OTP requests) to a maximum of 10 per IP address within a 1-hour rolling window
2. WHEN an IP address exceeds the rate limit, THE Auth_System SHALL return a 429 HTTP response with a Retry-After header indicating the remaining seconds until the rolling window resets, and display a user-facing error message in the selected language stating that the request limit has been reached
3. WHEN a user fails OTP verification 3 times from the same session, THE Auth_System SHALL require the user to complete a CAPTCHA challenge before allowing any subsequent OTP verification submission in that session
4. THE OTP_Service SHALL generate OTPs using a cryptographically secure random number generator
5. IF an API request for a state-changing operation (login, profile update, account deletion, session termination, or exam change) does not include a valid CSRF token, THEN THE Auth_System SHALL reject the request and return an error response indicating an invalid or missing security token
6. WHEN the Session_Manager detects reuse of a previously consumed refresh token, THE Session_Manager SHALL invalidate all refresh tokens in that token family and terminate all active sessions for the affected user, requiring re-authentication

### Requirement 18: Loading States and User Feedback

**User Story:** As a user, I want clear visual feedback during authentication operations, so that I know the system is processing my request.

#### Acceptance Criteria

1. WHEN an OTP is being sent, THE Auth_System SHALL display a loading indicator on the submit button, disable the button to prevent duplicate submissions, and re-enable the button upon receiving a success or error response
2. WHEN OTP verification is in progress, THE Auth_System SHALL display a loading indicator on the verify button, disable the verify button, and re-enable the button upon receiving a success or error response
3. WHEN Google OAuth redirect is in progress, THE Auth_System SHALL display a full-screen loading indicator with a message informing the user they are being redirected to Google for authentication
4. WHEN any authentication operation succeeds, THE Auth_System SHALL display a success indicator for 1.5 seconds before navigating to the next screen
5. IF any authentication API call does not receive a response within 30 seconds, THEN THE Auth_System SHALL cancel the request, display an error message indicating a timeout occurred, re-enable all disabled inputs, and provide a retry option to repeat the failed operation
6. WHILE any authentication operation is in progress, THE Auth_System SHALL display all loading and feedback messages in the user's selected language
