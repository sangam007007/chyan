# Implementation Plan: Auth Module

## Overview

End-to-end implementation of the authentication and user management module for the UP Police Test Series platform. The module covers Phone OTP login, Google OAuth, JWT session management, multi-device control, onboarding flow, profile management, account linking, bilingual (Hindi/English) support, and security middleware. Built with Node.js + Express backend and React + Tailwind frontend, backed by PostgreSQL and Redis.

## Tasks

- [x] 1. Project setup and infrastructure
  - [x] 1.1 Initialize monorepo structure with backend and frontend packages
    - Create root `package.json` with workspaces for `packages/backend` and `packages/frontend`
    - Initialize `packages/backend` with TypeScript, Express, and required dependencies (jsonwebtoken, bcrypt, ioredis, pg, zod, helmet, cors, cookie-parser, multer, sharp, axios)
    - Initialize `packages/frontend` with Vite + React + TypeScript + Tailwind CSS
    - Set up shared TypeScript config and ESLint
    - _Requirements: Project Context (Tech Stack)_

  - [x] 1.2 Create Docker and environment configuration
    - Create `Dockerfile` for backend (Node.js 20 Alpine)
    - Create `docker-compose.yml` with PostgreSQL 16, Redis 7, and backend services
    - Create `.env.example` with all required environment variables (DB_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, SMS_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CAPTCHA_SECRET)
    - Create `packages/backend/src/config/env.ts` for typed environment variable loading with validation
    - _Requirements: Project Context (Deployment Strategy, Key Design Decisions)_

  - [x] 1.3 Set up testing infrastructure
    - Install and configure Vitest for backend unit and property tests
    - Install fast-check for property-based testing
    - Install testcontainers for PostgreSQL and Redis integration tests
    - Install Playwright for E2E tests
    - Create test utility helpers and shared fixtures directory
    - _Requirements: Design (Testing Strategy)_

- [x] 2. Database schema and migrations
  - [x] 2.1 Create database migration system and initial schema
    - Set up a migration runner (using node-pg-migrate or custom runner)
    - Create migration for `users` table with all columns (id, phone, email, full_name, avatar_url, preferred_language, selected_exam_id, google_id, google_avatar_url, onboarding_completed, exam_change_count_this_month, exam_change_month, deletion_scheduled_at, timestamps)
    - Create migration for `exams` table with bilingual name/description, category, state, icon_url, is_active, display_order
    - Create migration for `sessions` table with refresh_token_hash, token_family, device_info, ip_address, city, is_active, expires_at, and indexes
    - Create migration for `account_links` table
    - Create migration for `auth_audit_log` table with indexes
    - Add seed data for exams (UP Police Constable, SI, SSC GD, etc.)
    - _Requirements: 9.2, 13.1, Design (PostgreSQL Schema)_

  - [x] 2.2 Create database connection pool and query utilities
    - Create `packages/backend/src/db/pool.ts` with pg Pool configuration
    - Create typed query helper functions with error handling
    - Create transaction helper utility
    - _Requirements: Design (Data Layer)_

- [x] 3. Redis setup and utilities
  - [x] 3.1 Create Redis client and utility functions
    - Create `packages/backend/src/redis/client.ts` with ioredis connection
    - Create typed helpers for OTP storage/retrieval with TTL (300s)
    - Create helpers for rate limiting sorted sets (sliding window)
    - Create helpers for session metadata storage and user session sets
    - Create helpers for lockout tracking and resend cooldown
    - Implement CSRF token storage with TTL (24h)
    - _Requirements: Design (Redis Data Structures)_

- [x] 4. Backend services — Core authentication
  - [x] 4.1 Implement OTP Service
    - Create `packages/backend/src/services/otp.service.ts`
    - Implement `generate(phone)`: crypto-random 6-digit OTP, store in Redis with TTL 300s, invalidate previous OTP for same phone
    - Implement `verify(phone, code)`: validate against Redis, track attempts, enforce lockout after 5 failures (15-min TTL)
    - Implement `invalidate(phone)`: remove OTP from Redis
    - Implement rate limiting check: max 5 OTPs per phone per hour (sorted set)
    - Implement resend cooldown check: 30-second minimum between resends
    - Integrate SMS gateway call (abstract via interface for testability)
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.1, 3.2, 3.4, 4.1, 4.2, 4.5_

  - [x]* 4.2 Write property tests for OTP Service
    - **Property 3: OTP Generation Format** — verify output is always exactly 6 numeric digits (000000–999999)
    - **Property 4: OTP Single-Use and Latest-Only Validity** — verify only most recent OTP passes verification
    - **Property 5: OTP Rate Limiting** — verify requests exceeding 5 per hour are rejected
    - **Property 6: OTP Resend Cooldown** — verify 30-second cooldown enforcement
    - **Property 7: OTP Verification Lockout** — verify lockout after 5 failed attempts for 15 minutes
    - **Validates: Requirements 2.1, 2.3, 2.6, 3.2, 3.4, 4.1, 4.2**

  - [x] 4.3 Implement OAuth Service
    - Create `packages/backend/src/services/oauth.service.ts`
    - Implement `getAuthUrl()`: construct Google OAuth consent URL with email+profile scopes
    - Implement `exchangeCode(code)`: exchange authorization code for tokens, extract user profile
    - Implement `validateToken(idToken)`: verify Google ID token signature and claims
    - Handle error cases: cancelled consent, network failure, invalid code
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 4.4 Write property test for Google Profile Data Mapping
    - **Property 20: Google Profile Data Mapping** — verify correct extraction of name/email/picture with optional fields handled as null
    - **Validates: Requirements 5.5, 10.2**

  - [x] 4.5 Implement Session Service
    - Create `packages/backend/src/services/session.service.ts`
    - Implement `create(userId, deviceInfo)`: generate token family UUID, hash refresh token, store in DB + Redis, enforce 3-session limit (evict oldest)
    - Implement `refresh(refreshToken)`: validate token family, rotate refresh token (invalidate old, issue new), detect reuse (invalidate family + all sessions)
    - Implement `revoke(sessionId)`: mark session inactive, remove from Redis
    - Implement `revokeAll(userId, exceptSessionId?)`: batch revocation
    - Implement `listActive(userId)`: return active sessions with device info
    - JWT token generation: access token (1h expiry, sub + sessionId claims), refresh token (30d expiry)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1, 8.3, 8.4_

  - [x]* 4.6 Write property tests for Session Service
    - **Property 10: JWT Token Structure and Expiry** — verify access token has correct claims and exp-iat=3600
    - **Property 11: Refresh Token Rotation** — verify new tokens issued and old marked consumed
    - **Property 12: Refresh Token Reuse Detection** — verify family invalidation on reuse
    - **Property 13: Session Limit Invariant** — verify active sessions never exceed 3
    - **Property 14: Session Termination Rules** — verify remote termination and logout-all behavior
    - **Property 15: Logout Invalidates Session** — verify complete session cleanup
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.3, 8.4, 8.5, 17.6**

  - [x] 4.7 Implement Profile Service
    - Create `packages/backend/src/services/profile.service.ts`
    - Implement `getProfile(userId)`: fetch user with exam join
    - Implement `updateProfile(userId, data)`: validate and update name/language
    - Implement `uploadAvatar(userId, file)`: validate MIME (JPEG/PNG), size (≤2MB), dimensions (≥200×200), resize/crop with sharp, store file, update avatar_url
    - Implement `deleteAvatar(userId)`: remove file, clear avatar_url
    - Implement `changeExam(userId, examId)`: enforce 3-change monthly limit with calendar month reset
    - Implement `deleteAccount(userId)`: schedule deletion (7-day grace), revoke sessions
    - Implement `cancelDeletion(userId)`: clear deletion_scheduled_at
    - _Requirements: 10.3, 10.5, 12.1, 12.2, 12.6, 12.7, 13.3, 13.4, 13.5, 13.6, 15.4, 15.6_

  - [x]* 4.8 Write property tests for Profile Service
    - **Property 18: Name Validation** — verify acceptance of 2-50 char strings with letters/spaces/hyphens/periods only
    - **Property 19: Avatar File Validation** — verify MIME, size, dimension constraints and specific error reporting
    - **Property 21: Exam Change Monthly Limit** — verify max 3 changes per calendar month with reset
    - **Validates: Requirements 10.3, 12.2, 12.6, 12.7, 13.5, 13.6**

  - [x] 4.9 Implement Account Linking Service
    - Create `packages/backend/src/services/account-link.service.ts`
    - Implement `checkExisting(email, phone)`: check both identifiers against users table
    - Implement `linkAccounts(primaryId, secondaryId)`: merge Google credentials into phone account (or vice versa), preserve primary profile data, apply Google avatar only if no existing avatar
    - Implement `createSeparate(profile)`: create new account from Google data, mark for onboarding
    - Handle 120-second linking timeout (treat as decline)
    - Log linking events to account_links table
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x]* 4.10 Write property tests for Account Linking
    - **Property 8: Account Linking Decision** — verify linking prompt triggered on email/phone match across providers
    - **Property 9: Account Merge Data Preservation** — verify primary profile data preserved and Google avatar applied only when no existing avatar
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.6**

- [x] 5. Checkpoint — Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Backend middleware
  - [x] 6.1 Implement Rate Limiter middleware
    - Create `packages/backend/src/middleware/rate-limiter.ts`
    - Implement IP-based sliding window rate limiting (10 requests/hour for login endpoints)
    - Implement phone-based OTP generation rate limiting (5 per hour)
    - Return 429 with Retry-After header and localized error message
    - Use Redis sorted sets for sliding window tracking
    - _Requirements: 17.1, 17.2, Design (Middleware Stack)_

  - [x]* 6.2 Write property test for IP Rate Limiting
    - **Property 24: IP Rate Limiting** — verify rejection after 10 requests/hour with correct Retry-After value
    - **Validates: Requirements 17.1, 17.2**

  - [x] 6.3 Implement CSRF Protection middleware
    - Create `packages/backend/src/middleware/csrf.ts`
    - Generate CSRF tokens stored in Redis with 24h TTL
    - Validate CSRF token on all state-changing requests (POST, PATCH, DELETE)
    - Provide endpoint to fetch fresh CSRF token
    - _Requirements: 17.5, Design (Middleware Stack)_

  - [x]* 6.4 Write property test for CSRF Enforcement
    - **Property 26: CSRF Token Enforcement** — verify rejection of state-changing requests without valid CSRF token
    - **Validates: Requirements 17.5**

  - [x] 6.5 Implement JWT Auth middleware
    - Create `packages/backend/src/middleware/jwt-auth.ts`
    - Validate access token signature and expiry
    - Attach user context (userId, sessionId) to request object
    - Return 401 with appropriate error code (TOKEN_EXPIRED vs TOKEN_INVALID)
    - Check session is still active in Redis
    - _Requirements: 7.2, 7.3, 11.3, 11.4, Design (Middleware Stack)_

  - [x] 6.6 Implement CAPTCHA Verifier middleware
    - Create `packages/backend/src/middleware/captcha.ts`
    - Track failed OTP attempts per session in Redis
    - After 3 failures, require CAPTCHA token on subsequent OTP verify requests
    - Validate CAPTCHA token against external CAPTCHA service
    - Return 403 CAPTCHA_REQUIRED or CAPTCHA_INVALID errors
    - _Requirements: 17.3, Design (Middleware Stack)_

  - [x]* 6.7 Write property test for CAPTCHA Trigger
    - **Property 25: CAPTCHA Trigger After Failed Attempts** — verify CAPTCHA required after 3 failed OTP verifications
    - **Validates: Requirements 17.3**

- [x] 7. Backend controllers and API routes
  - [x] 7.1 Implement Auth Controller and routes
    - Create `packages/backend/src/controllers/auth.controller.ts`
    - `POST /api/auth/otp/send`: validate phone (Zod), check rate limits, call OTPService.generate, return success with expiresIn/resendAfter
    - `POST /api/auth/otp/verify`: validate OTP, check lockout/CAPTCHA, call OTPService.verify, find/create user, create session, return access token + set refresh cookie
    - `POST /api/auth/otp/resend`: check cooldown, invalidate old OTP, generate new
    - `GET /api/auth/google`: return Google OAuth consent URL
    - `POST /api/auth/google/callback`: exchange code, find/create/link user, create session
    - `POST /api/auth/token/refresh`: validate refresh cookie, rotate tokens
    - `POST /api/auth/logout`: revoke current session
    - `POST /api/auth/logout-all`: revoke all sessions except current
    - `POST /api/auth/link/confirm`: merge accounts
    - `POST /api/auth/link/decline`: create separate account
    - Wire Zod request validation schemas for each endpoint
    - _Requirements: 1.1–1.7, 2.1–2.7, 3.1–3.6, 4.1–4.6, 5.1–5.6, 6.1–6.6, 7.1–7.6_

  - [x] 7.2 Implement Session Controller and routes
    - Create `packages/backend/src/controllers/session.controller.ts`
    - `GET /api/sessions`: list active sessions with device info
    - `DELETE /api/sessions/:sessionId`: terminate specific session (block self-termination)
    - _Requirements: 8.1–8.5_

  - [x] 7.3 Implement Profile Controller and routes
    - Create `packages/backend/src/controllers/profile.controller.ts`
    - `GET /api/profile`: return user profile with exam info
    - `PATCH /api/profile`: update name/language with validation
    - `POST /api/profile/avatar`: handle multipart upload, validate, crop, store
    - `DELETE /api/profile/avatar`: remove avatar
    - `POST /api/profile/exam`: change exam with monthly limit enforcement
    - _Requirements: 12.1–12.7, 13.1–13.7_

  - [x] 7.4 Implement Onboarding Controller and routes
    - Create `packages/backend/src/controllers/onboarding.controller.ts`
    - `GET /api/onboarding/exams`: return exams grouped by category with bilingual names
    - `POST /api/onboarding/exam-selection`: save selected exam
    - `POST /api/onboarding/profile-setup`: validate and save name + language + avatar, mark onboarding complete
    - _Requirements: 9.1–9.7, 10.1–10.7_

  - [x] 7.5 Implement Account Lifecycle Controller and routes
    - Create `packages/backend/src/controllers/account.controller.ts`
    - `POST /api/account/delete/request`: initiate deletion (send OTP for re-auth)
    - `POST /api/account/delete/confirm`: verify OTP, schedule 7-day deletion, terminate sessions
    - `POST /api/account/delete/cancel`: cancel pending deletion
    - _Requirements: 15.1–15.8_

  - [x] 7.6 Implement error handling infrastructure
    - Create `packages/backend/src/errors/` with AppError, ValidationError, AuthenticationError, RateLimitError, ExternalServiceError classes
    - Create global Express error handler middleware
    - Create Zod schema validation middleware wrapper
    - Implement consistent error response format with localized messages
    - Create audit logging utility for sensitive operations
    - _Requirements: 18.5, Design (Error Handling)_

  - [x] 7.7 Implement backend i18n for error messages
    - Create `packages/backend/src/i18n/en.json` and `hi.json` with all error message keys
    - Create message resolver that reads `Accept-Language` header or user profile preference
    - Integrate with error handler to return localized messages
    - _Requirements: 14.1, 14.5, 14.6, Design (Bilingual / i18n Approach)_

- [x] 8. Checkpoint — Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Frontend setup and infrastructure
  - [x] 9.1 Configure frontend project with routing and Tailwind
    - Set up React Router with auth-guarded routes
    - Configure Tailwind CSS with project theme colors (navy #1B3A5C, gold #C5A028, red #E63946, etc.)
    - Create base layout components (AuthLayout for login screens, AppLayout for authenticated)
    - Set up path aliases and project structure (components/, pages/, context/, hooks/, services/, i18n/)
    - _Requirements: Project Context (Theme & UI)_

  - [x] 9.2 Implement i18n system
    - Create `packages/frontend/src/i18n/en.json` with all auth screen translation keys
    - Create `packages/frontend/src/i18n/hi.json` with Hindi translations
    - Create `I18nProvider` context with `useTranslation()` hook
    - Implement `t(key, params?)` function with interpolation support
    - Implement language resolution: User Profile → localStorage → default 'hi'
    - Implement fallback: missing Hindi key → English value → key itself
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, Design (Bilingual / i18n Approach)_

  - [x]* 9.3 Write property tests for translation system
    - **Property 22: Translation Completeness and Fallback** — verify both languages have translations and fallback to English works
    - **Property 23: Language Preference Persistence** — verify authenticated saves to profile, unauthenticated saves to localStorage
    - **Validates: Requirements 14.1, 14.3, 14.5, 14.6**

  - [x] 9.4 Implement Auth Context and HTTP client
    - Create `packages/frontend/src/context/AuthContext.tsx` with AuthProvider
    - Implement AuthContextValue interface: user, isAuthenticated, isLoading, login, verifyOTP, loginWithGoogle, logout, refreshToken, updateProfile
    - Create Axios instance with request interceptor (attach access token from memory, attach CSRF token)
    - Create response interceptor: on 401 queue request → call /token/refresh → retry with new token
    - Implement offline detection (navigator.onLine + periodic ping) and offline banner event
    - Implement 30-second request timeout with auto-cancel
    - _Requirements: 7.2, 7.4, 16.4, 16.5, 16.6, 18.5, Design (HTTP Client)_

  - [x]* 9.5 Write property tests for HTTP client retry logic
    - **Property 27: Network Retry Limit** — verify max 3 retries then final error
    - **Property 28: Request Timeout** — verify 30-second timeout cancels request and re-enables UI
    - **Validates: Requirements 16.1, 18.5**

- [x] 10. Frontend components — Auth UI
  - [x] 10.1 Implement PhoneInput component
    - Create `packages/frontend/src/components/auth/PhoneInput.tsx`
    - Display non-editable +91 prefix label
    - Restrict input to numeric only, max 10 characters
    - Inline validation: empty field, wrong digit count, invalid starting digit
    - Display validation errors in selected language below input
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 1.7_

  - [x]* 10.2 Write property tests for phone validation
    - **Property 1: Phone Number Validation** — verify acceptance of exactly 10 digits starting with 6-9 after stripping spaces/dashes/+91
    - **Property 2: Phone Number Normalization Idempotence** — verify normalization produces same result regardless of formatting and is idempotent
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 1.7**

  - [x] 10.3 Implement OTPInput component
    - Create `packages/frontend/src/components/auth/OTPInput.tsx`
    - 6-cell input with auto-advance on digit entry
    - Backspace handling to move to previous cell
    - Paste support for full 6-digit code
    - Web OTP API integration for auto-fill (where supported)
    - Error display with remaining attempts count
    - _Requirements: 3.1, 3.2, 3.6_

  - [x] 10.4 Implement ResendTimer component
    - Create `packages/frontend/src/components/auth/ResendTimer.tsx`
    - 30-second countdown display
    - Disable resend button during countdown
    - Enable resend after countdown reaches zero
    - Call onResend callback and restart timer
    - _Requirements: 4.1, 4.4_

  - [x] 10.5 Implement GoogleLoginButton component
    - Create `packages/frontend/src/components/auth/GoogleLoginButton.tsx`
    - Styled Google sign-in button with bilingual text
    - Handle OAuth redirect initiation
    - Full-screen loading state during redirect
    - _Requirements: 5.1, 5.3, 18.3_

  - [x] 10.6 Implement LanguageToggle component
    - Create `packages/frontend/src/components/common/LanguageToggle.tsx`
    - Toggle between Hindi and English
    - Accessible on login screen (before auth)
    - Persist to localStorage (unauthenticated) or profile (authenticated)
    - Trigger full UI re-render on switch without page reload
    - _Requirements: 14.2, 14.3, 12.4_

  - [x] 10.7 Implement LoadingButton and CaptchaWidget components
    - Create `packages/frontend/src/components/common/LoadingButton.tsx` with spinner and auto-disable
    - Create `packages/frontend/src/components/auth/CaptchaWidget.tsx` for CAPTCHA challenge integration
    - _Requirements: 17.3, 18.1, 18.2_

  - [x] 10.8 Implement AccountLinkPrompt component
    - Create `packages/frontend/src/components/auth/AccountLinkPrompt.tsx`
    - Display existing account info (masked phone/email)
    - Confirm/Decline buttons
    - 120-second auto-decline timeout with countdown
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [x] 11. Frontend pages — Auth flows
  - [x] 11.1 Implement LoginPage
    - Create `packages/frontend/src/pages/LoginPage.tsx`
    - Compose PhoneInput + GoogleLoginButton + LanguageToggle
    - Handle form submission → call POST /api/auth/otp/send
    - Loading state on send button, disable on submit
    - Error handling: network errors, rate limiting, validation errors
    - Navigate to OTP verify page on success
    - _Requirements: 1.1–1.7, 5.1, 14.2, 18.1_

  - [x] 11.2 Implement OTPVerifyPage
    - Create `packages/frontend/src/pages/OTPVerifyPage.tsx`
    - Compose OTPInput + ResendTimer + CaptchaWidget (conditional)
    - Display "OTP sent to +91 XXXXX" message
    - Handle verify submission → call POST /api/auth/otp/verify
    - Show remaining attempts on failure
    - Show lockout duration when locked
    - Show CAPTCHA after 3 failures
    - Preserve OTP input on network failure (if not expired)
    - Route to onboarding or dashboard based on response.nextStep
    - _Requirements: 3.1–3.6, 4.1–4.6, 16.2, 17.3, 18.2_

  - [x] 11.3 Implement OnboardingPage (Exam Selection + Profile Setup)
    - Create `packages/frontend/src/pages/OnboardingPage.tsx`
    - Step 1: ExamSelector — display exams by category, single selection, confirm button
    - Step 2: ProfileSetupForm — full name input (pre-filled from Google), language select (default Hindi), optional avatar upload with crop
    - Block navigation away without completion (show prompt)
    - Handle network errors with retry
    - Route to Dashboard on completion
    - _Requirements: 9.1–9.7, 10.1–10.7_

  - [x]* 11.4 Write property tests for user routing logic
    - **Property 16: User Routing Decision** — verify deterministic routing based on onboarding_completed, exam selection, and profile fields
    - **Property 17: Profile Completeness Check** — verify completeness returns true iff name≥2 chars, exam non-null, language set
    - **Validates: Requirements 9.1, 11.1, 11.2, 11.3, 11.5**

  - [x] 11.5 Implement ProfileSettingsPage
    - Create `packages/frontend/src/pages/ProfileSettingsPage.tsx`
    - Display: name (editable), phone (read-only), email (read-only, if exists), selected exam, language, avatar
    - Name edit with inline validation and save
    - Avatar upload with crop preview, validation error messages
    - Exam change with monthly limit display
    - Active sessions list with device info, current session indicator, terminate buttons
    - "Logout from all devices" button
    - "Delete Account" section with re-auth flow
    - Deletion grace period banner with cancel option
    - _Requirements: 8.2–8.5, 12.1–12.7, 13.1–13.7, 15.1–15.6_

- [x] 12. Checkpoint — Frontend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Integration tests
  - [x] 13.1 Write integration tests for OTP lifecycle
    - Test full flow: generate OTP → verify → invalidate (with real Redis via testcontainers)
    - Test rate limiting with actual sliding window
    - Test lockout and recovery after timeout
    - Test resend cooldown enforcement
    - _Requirements: 2.1–2.6, 3.1–3.5, 4.1–4.6_

  - [x] 13.2 Write integration tests for session lifecycle
    - Test: create session → refresh token → rotate → revoke (with PostgreSQL + Redis via testcontainers)
    - Test 3-session limit enforcement with oldest eviction
    - Test token reuse detection and family invalidation
    - Test logout-all preserving current session
    - _Requirements: 7.1–7.6, 8.1–8.5, 17.6_

  - [x] 13.3 Write integration tests for account linking
    - Test: Google login → detect existing phone account → prompt → confirm merge
    - Test: Phone login → detect existing Google account → prompt → confirm merge
    - Test: Decline linking → create separate account
    - Test: 120-second timeout → auto-decline
    - _Requirements: 6.1–6.6_

  - [x] 13.4 Write integration tests for profile and onboarding
    - Test: New user → exam selection → profile setup → onboarding complete
    - Test: Returning user with incomplete profile → redirect to correct step
    - Test: Avatar upload with valid/invalid files
    - Test: Exam change with monthly limit
    - Test: Account deletion → grace period → cancel/expire
    - _Requirements: 9.1–9.7, 10.1–10.7, 11.1–11.5, 12.1–12.7, 13.1–13.7, 15.1–15.8_

- [x] 14. End-to-end tests
  - [x] 14.1 Write E2E tests for login and onboarding flows
    - Phone OTP login (new user → exam selection → profile setup → dashboard)
    - Phone OTP login (returning user → dashboard)
    - Google OAuth login (new user → onboarding)
    - Google OAuth login (existing user → account linking prompt)
    - Language switching before and after login
    - _Requirements: 1.1–1.7, 2.1–2.7, 3.1–3.6, 5.1–5.6, 9.1–9.7, 10.1–10.7, 11.1–11.5, 14.1–14.6_

  - [x] 14.2 Write E2E tests for session and profile management
    - View active sessions with device info
    - Terminate remote session
    - Logout from all devices
    - Update profile name and avatar
    - Change exam with limit enforcement
    - Account deletion request → grace period banner → cancel
    - _Requirements: 8.1–8.5, 12.1–12.7, 13.1–13.7, 15.1–15.8_

  - [x] 14.3 Write E2E tests for error and edge cases
    - Offline detection and banner display
    - Network failure during OTP send → retry
    - OTP expiry during verification
    - Rate limiting display
    - CAPTCHA trigger after failures
    - Request timeout handling
    - _Requirements: 16.1–16.6, 17.1–17.3, 18.1–18.6_

- [x] 15. Deployment configuration
  - [x] 15.1 Create production deployment files
    - Create multi-stage Dockerfile for optimized production build
    - Create `docker-compose.prod.yml` with health checks
    - Create GitHub Actions CI workflow: lint → type-check → unit tests → integration tests → build
    - Create database migration script for production runs
    - Document environment variables required for each deployment phase
    - _Requirements: Project Context (Deployment Strategy)_

- [x] 16. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 28 universal correctness properties defined in the design using fast-check
- Unit tests validate specific examples and edge cases (complementary to property tests)
- Integration tests use testcontainers for real PostgreSQL and Redis instances
- E2E tests use Playwright with mocked external services (SMS gateway, Google OAuth)
- The backend uses TypeScript throughout with Zod for runtime validation
- Frontend uses React + TypeScript with Tailwind CSS for styling
- All UI strings must be present in both en.json and hi.json translation files

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["4.1", "4.3", "9.1"] },
    { "id": 3, "tasks": ["4.2", "4.4", "4.5", "9.2"] },
    { "id": 4, "tasks": ["4.6", "4.7", "4.9", "9.3", "9.4"] },
    { "id": 5, "tasks": ["4.8", "4.10", "6.1", "6.3", "6.5", "6.6", "9.5"] },
    { "id": 6, "tasks": ["6.2", "6.4", "6.7", "7.1", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 7, "tasks": ["7.6", "7.7", "10.1", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8"] },
    { "id": 8, "tasks": ["10.2", "11.1", "11.2", "11.3", "11.5"] },
    { "id": 9, "tasks": ["11.4", "13.1", "13.2", "13.3", "13.4"] },
    { "id": 10, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 11, "tasks": ["15.1"] }
  ]
}
```
