# API Contracts — UP Police Test Series

## Base URL

```
Development: http://localhost:3000/api
Production:  https://api.upptestseries.com/api
```

## Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| Authorization | Conditional | `Bearer <accessToken>` (on protected routes) |
| Content-Type | Yes (POST/PATCH) | `application/json` |
| X-CSRF-Token | Conditional | CSRF token (on state-changing requests) |
| Accept-Language | Optional | `en` or `hi` (defaults to user preference) |

## Common Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Phone number is required",
    "details": [{ "field": "phone", "message": "Required" }]
  }
}
```

## Rate Limits

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| /auth/otp/send | 3 requests | 15 minutes |
| /auth/otp/verify | 5 requests | 15 minutes |
| /auth/* (other) | 10 requests | 1 minute |
| /api/* (general) | 100 requests | 1 minute |
| /api/tests (listing) | 30 requests | 1 minute |

---

## Auth Controller (`/api/auth`)

### POST /auth/otp/send

Send OTP to phone number for login/registration.

- **Auth:** None
- **CSRF:** Required
- **CAPTCHA:** Required after 3 failed attempts

**Request:**
```json
{
  "phone": "+919876543210",
  "captchaToken": "turnstile-token" // optional, required after failures
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "expiresIn": 300,
    "retryAfter": 60
  }
}
```

**Errors:** `400` Invalid phone, `429` Rate limited

---

### POST /auth/otp/verify

Verify OTP and authenticate user.

- **Auth:** None
- **CSRF:** Required

**Request:**
```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": {
      "id": "uuid",
      "phone": "+919876543210",
      "fullName": "Rahul Kumar",
      "preferredLanguage": "hi",
      "onboardingCompleted": true,
      "selectedExamId": "uuid"
    },
    "isNewUser": false
  }
}
```

**Errors:** `400` Invalid OTP, `410` OTP expired, `429` Too many attempts

---

### POST /auth/otp/resend

Resend OTP to the same phone number.

- **Auth:** None
- **CSRF:** Required

**Request:**
```json
{
  "phone": "+919876543210"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "message": "OTP resent", "expiresIn": 300, "retryAfter": 60 }
}
```

---

### POST /auth/google

Authenticate via Google OAuth.

- **Auth:** None
- **CSRF:** Required

**Request:**
```json
{
  "idToken": "google-id-token"
}
```

**Response (200):** Same shape as OTP verify response.

---

### POST /auth/token/refresh

Refresh access token using refresh token.

- **Auth:** None (refresh token in body)

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Errors:** `401` Invalid/expired refresh token, `403` Token family compromised (all sessions revoked)

---

### POST /auth/logout

Logout current session.

- **Auth:** Required
- **CSRF:** Required

**Response (200):**
```json
{ "success": true, "data": { "message": "Logged out successfully" } }
```

---

### POST /auth/link

Link additional auth provider to existing account.

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{
  "provider": "google",
  "idToken": "google-id-token"
}
```

**Response (200):**
```json
{ "success": true, "data": { "message": "Account linked" } }
```

---

### GET /auth/csrf

Get CSRF token.

- **Auth:** None

**Response (200):**
```json
{ "success": true, "data": { "csrfToken": "token-string" } }
```

---

## Session Controller (`/api/sessions`)

### GET /sessions

List all active sessions for current user.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "deviceType": "mobile",
        "deviceInfo": { "browser": "Chrome", "os": "Android" },
        "city": "Lucknow",
        "lastActiveAt": "2024-01-15T10:30:00Z",
        "isCurrent": true,
        "createdAt": "2024-01-10T08:00:00Z"
      }
    ]
  }
}
```

---

### DELETE /sessions/:sessionId

Terminate a specific session.

- **Auth:** Required
- **CSRF:** Required

**Response (200):**
```json
{ "success": true, "data": { "message": "Session terminated" } }
```

**Errors:** `404` Session not found, `403` Cannot terminate other user's session

---

## Profile Controller (`/api/profile`)

### GET /profile

Get current user profile.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "+919876543210",
    "email": "user@example.com",
    "fullName": "Rahul Kumar",
    "avatarUrl": "https://...",
    "preferredLanguage": "hi",
    "selectedExamId": "uuid",
    "onboardingCompleted": true,
    "bestStreak": 15,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

---

### PATCH /profile

Update user profile fields.

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{
  "fullName": "New Name",
  "email": "new@email.com",
  "preferredLanguage": "en"
}
```

**Response (200):** Updated user object.

---

### POST /profile/avatar

Upload profile avatar.

- **Auth:** Required
- **CSRF:** Required
- **Content-Type:** `multipart/form-data`

**Request:** Form data with `avatar` file field (max 5MB, JPEG/PNG/WebP)

**Response (200):**
```json
{ "success": true, "data": { "avatarUrl": "https://..." } }
```

---

### DELETE /profile/avatar

Remove profile avatar.

- **Auth:** Required
- **CSRF:** Required

**Response (200):**
```json
{ "success": true, "data": { "message": "Avatar removed" } }
```

---

### POST /profile/exam-change

Change selected exam (limited to 3/month).

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{ "examId": "uuid" }
```

**Response (200):** Updated user object.

**Errors:** `400` Same exam, `429` Monthly limit reached (3 changes)

---

## Onboarding Controller (`/api/onboarding`)

### GET /onboarding/exams

List available exams for selection.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "exams": [
      { "id": "uuid", "name": "UP Police Constable", "icon_url": "...", "category": "police" }
    ]
  }
}
```

---

### POST /onboarding/exam-selection

Select exam during onboarding.

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{ "examId": "uuid" }
```

---

### POST /onboarding/profile-setup

Complete profile during onboarding.

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{
  "fullName": "Rahul Kumar",
  "preferredLanguage": "hi"
}
```

---

## Questions Controller (`/api/questions`)

### GET /questions

List questions with filters.

- **Auth:** Required

**Query Params:** `subject`, `topic`, `difficulty`, `examId`, `page`, `limit`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": "uuid",
        "text": "What is the capital of UP?",
        "optionA": "Lucknow",
        "optionB": "Kanpur",
        "optionC": "Agra",
        "optionD": "Varanasi",
        "correctOption": 0,
        "explanation": "Lucknow is the capital...",
        "subject": "General Knowledge",
        "topic": "Geography",
        "difficulty": "easy"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 150 }
  }
}
```

---

### POST /questions

Create a new question (admin).

- **Auth:** Required (Admin)
- **CSRF:** Required

---

### PATCH /questions/:id

Update a question.

- **Auth:** Required (Admin)
- **CSRF:** Required

---

### DELETE /questions/:id

Delete a question.

- **Auth:** Required (Admin)
- **CSRF:** Required

---

## Subjects Controller (`/api/subjects`)

### GET /subjects

List subjects for an exam.

- **Auth:** Required

**Query Params:** `examId` (required)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "subjects": [
      { "id": "uuid", "name": "General Knowledge", "displayOrder": 1 }
    ]
  }
}
```

---

### GET /subjects/:subjectId/topics

List topics for a subject.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "topics": [
      { "id": "uuid", "name": "Indian History", "displayOrder": 1 }
    ]
  }
}
```

---

## Tests Controller (`/api/tests`)

### GET /tests

List published tests with filters.

- **Auth:** Required

**Query Params:** `examId`, `category`, `subjectId`, `topicId`, `pricingType`, `page`, `limit`, `search`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "tests": [
      {
        "id": "uuid",
        "title": "UP Police Full Mock #1",
        "description": "Complete mock test...",
        "durationMinutes": 120,
        "totalMarks": 300,
        "totalQuestions": 150,
        "category": "full_mock",
        "pricingType": "free",
        "attemptCount": 1250,
        "userAttempted": true,
        "userBestScore": 78.5
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 45 }
  }
}
```

---

### GET /tests/:testId

Get test details.

- **Auth:** Required

---

### POST /tests

Create a test (admin).

- **Auth:** Required (Admin)
- **CSRF:** Required

---

## Attempts Controller (`/api/tests/:testId/attempts` & `/api/attempts/:id`)

### POST /tests/:testId/attempts/start

Start a new test attempt.

- **Auth:** Required
- **CSRF:** Required

**Response (201):**
```json
{
  "success": true,
  "data": {
    "attemptId": "uuid",
    "testId": "uuid",
    "startedAt": "2024-01-15T10:00:00Z",
    "endsAt": "2024-01-15T12:00:00Z",
    "questions": [
      {
        "id": "uuid",
        "order": 1,
        "text": "Question text...",
        "optionA": "...",
        "optionB": "...",
        "optionC": "...",
        "optionD": "..."
      }
    ]
  }
}
```

---

### GET /tests/:testId/attempts/current

Get user's in-progress attempt for a test.

- **Auth:** Required

---

### GET /tests/:testId/attempts/history

Get user's attempt history for a test.

- **Auth:** Required

---

### POST /attempts/:attemptId/answers

Save/update answers during attempt.

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{
  "answers": [
    { "questionId": "uuid", "selectedOption": 2, "markedForReview": false }
  ]
}
```

**Response (200):**
```json
{ "success": true, "data": { "saved": 5 } }
```

---

### POST /attempts/:attemptId/submit

Submit a test attempt for scoring.

- **Auth:** Required
- **CSRF:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalScore": 185.5,
    "percentage": 61.83,
    "correctCount": 95,
    "wrongCount": 38,
    "skippedCount": 17,
    "timeTakenSeconds": 6543,
    "rank": 45,
    "totalAttempts": 1250
  }
}
```

---

### GET /attempts/:attemptId/results

Get detailed results of a submitted attempt.

- **Auth:** Required

---

### GET /attempts/:attemptId/review

Get answer review with explanations.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "answers": [
      {
        "questionId": "uuid",
        "questionOrder": 1,
        "text": "...",
        "options": ["A", "B", "C", "D"],
        "selectedOption": 2,
        "correctOption": 0,
        "isCorrect": false,
        "explanation": "...",
        "markedForRevision": false
      }
    ]
  }
}
```

---

### POST /attempts/:attemptId/revision/:questionId

Mark/unmark a question for revision.

- **Auth:** Required
- **CSRF:** Required

---

## Dashboard Controller (`/api/dashboard`)

### GET /dashboard/home

Get dashboard home data.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "streak": { "current": 7, "best": 15 },
    "coins": { "balance": 450 },
    "recentActivity": [...],
    "examInfo": { "name": "UP Police Constable", "examDate": "2024-06-15" }
  }
}
```

---

### GET /dashboard/leaderboard

Get leaderboard data.

- **Auth:** Required

**Query Params:** `period` (weekly/monthly/allTime), `examId`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      { "rank": 1, "userId": "uuid", "fullName": "Priya S.", "score": 2450, "avatarUrl": "..." }
    ],
    "userRank": 45,
    "totalUsers": 1200
  }
}
```

---

### GET /dashboard/activity

Get user activity heatmap data.

- **Auth:** Required

**Query Params:** `months` (default: 6)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "activities": [
      { "date": "2024-01-15", "count": 1 },
      { "date": "2024-01-14", "count": 1 }
    ]
  }
}
```

---

### GET /dashboard/streak

Get current streak info.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "currentStreak": 7,
    "bestStreak": 15,
    "lastActivityDate": "2024-01-15"
  }
}
```

---

### GET /dashboard/rank-estimate

Get estimated rank based on performance.

- **Auth:** Required

---

## Coins Controller (`/api/coins`)

### GET /coins/balance

Get user's coin balance.

- **Auth:** Required

**Response (200):**
```json
{ "success": true, "data": { "balance": 450 } }
```

---

### GET /coins/history

Get coin transaction history.

- **Auth:** Required

**Query Params:** `page`, `limit`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactions": [
      { "id": "uuid", "type": "daily_login", "amount": 5, "createdAt": "..." },
      { "id": "uuid", "type": "streak_bonus_7", "amount": 50, "createdAt": "..." }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 35 }
  }
}
```

---

### POST /coins/earn

Record a coin-earning event.

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{
  "type": "daily_login",
  "referenceId": "uuid" // optional
}
```

---

## Daily Quiz Controller (`/api/daily-quiz`)

### GET /daily-quiz/status

Check today's quiz status.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "available": true,
    "attempted": false,
    "questionCount": 10,
    "timeLimit": 300
  }
}
```

---

### POST /daily-quiz/start

Start today's daily quiz.

- **Auth:** Required
- **CSRF:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "attemptId": "uuid",
    "questions": [...],
    "timeLimit": 300
  }
}
```

**Errors:** `409` Already attempted today

---

### POST /daily-quiz/submit

Submit daily quiz answers.

- **Auth:** Required
- **CSRF:** Required

**Request:**
```json
{
  "attemptId": "uuid",
  "answers": [0, 2, 1, 3, 0, 1, 2, 3, 0, 1]
}
```

---

### GET /daily-quiz/result

Get today's quiz result.

- **Auth:** Required

**Response (200):**
```json
{
  "success": true,
  "data": {
    "score": 8,
    "totalQuestions": 10,
    "timeTakenSeconds": 180,
    "coinsEarned": 10,
    "answers": [...]
  }
}
```

---

## Validation Strategy

### Framework

All request validation uses **Zod** schemas. Validation runs as middleware BEFORE the controller handler executes.

### Validation Layers

| Layer | Tool | Scope | HTTP Status on Failure |
|-------|------|-------|----------------------|
| Request body | Zod schema via `validate()` middleware | req.body | 422 |
| Query params | Zod `z.coerce` in controller | req.query | 400 |
| Path params | UUID regex or Zod in controller | req.params | 400 |
| File uploads | Multer (size) + sharp (dimensions) | req.file | 422 |
| Environment | Zod schema at startup | process.env | Crashes with error log |

### Validation Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fieldErrors": {
        "phone": ["Phone number must be exactly 10 digits"],
        "otp": ["OTP must be exactly 6 digits"]
      }
    }
  }
}
```

### Key Validation Rules by Endpoint

| Endpoint | Field | Rule |
|----------|-------|------|
| POST /auth/otp/send | phone | 10 digits, starts with 6-9, strips +91 and spaces |
| POST /auth/otp/verify | otp | Exactly 6 numeric digits |
| POST /onboarding/exam-selection | examId | Valid UUID format |
| POST /onboarding/profile-setup | full_name | 2-50 chars, letters/spaces/hyphens/periods (Unicode) |
| POST /onboarding/profile-setup | preferred_language | Enum: 'hi' or 'en' |
| PATCH /profile | full_name | Optional, 2-50 chars if provided |
| POST /profile/avatar | file | Max 2MB, JPEG/PNG, min 200x200px |
| POST /profile/exam | exam_id | Valid UUID |
| GET /tests | category | Enum: full_mock, subject_wise, previous_year, daily_practice |
| GET /tests | sort | Enum: newest, popular, difficulty |
| GET /tests | page/limit | Integer, page ≥ 1, limit 1-50 |
| PUT /attempts/:id/answers/:index | selectedOption | Integer 0-3 or null |
| PUT /attempts/:id/answers/:index | markedForReview | Boolean |
| POST /coins/earn | type | Enum: daily_login, streak_bonus_7, referral, quiz_complete, test_complete |
| POST /daily-quiz/submit | answers | Array of exactly 10 items, each integer 0-3 or null |
| GET /dashboard/leaderboard | type | Enum: state, national |
| GET /dashboard/rank-estimate | marks | Number 0-150, max 2 decimal places |

### No Swagger/OpenAPI

This project does NOT have a Swagger/OpenAPI spec file. API documentation is maintained manually. Consider generating one from Zod schemas in the future.

---

## Authentication on Endpoints

### Public Endpoints (No Auth)

| Method | Path | Notes |
|--------|------|-------|
| POST | /api/auth/otp/send | Rate limited (IP + phone) |
| POST | /api/auth/otp/verify | Rate limited |
| POST | /api/auth/otp/resend | Rate limited |
| GET | /api/auth/google | Returns OAuth URL |
| POST | /api/auth/google/callback | Exchanges code |
| POST | /api/auth/token/refresh | Uses HTTP-only cookie |
| GET | /api/auth/csrf-token | Returns CSRF token |
| GET | /api/health | Health check |

### Protected Endpoints (JWT Required)

All other endpoints require `Authorization: Bearer <accessToken>` header. The `jwtAuth` middleware:
1. Extracts token from header
2. Verifies JWT signature + expiry
3. Checks session is active in Redis
4. Attaches `req.user = { userId, sessionId }` to request

### CSRF-Protected Endpoints (State-Changing)

All POST, PUT, PATCH, DELETE requests to protected routes also require `X-CSRF-Token` header. Exception: CSRF is currently **disabled in development** mode (tech debt item).

---

## Pending APIs (Not Yet Built)

These APIs are needed by frontend pages that currently use hardcoded data.

### Dashboard Phase 2 (Study Plan + Performance)

| Method | Path | Purpose | Spec |
|--------|------|---------|------|
| POST | /api/study-plans | Create study plan | dashboard-dynamic-phase2 |
| GET | /api/study-plans | List user's plans | dashboard-dynamic-phase2 |
| GET | /api/study-plans/:planId | Get plan details | dashboard-dynamic-phase2 |
| PUT | /api/study-plans/:planId | Update plan | dashboard-dynamic-phase2 |
| DELETE | /api/study-plans/:planId | Delete plan | dashboard-dynamic-phase2 |
| POST | /api/study-plans/:planId/activate | Set as today's plan | dashboard-dynamic-phase2 |
| GET | /api/study-plans/today | Get today's active plan + completions | dashboard-dynamic-phase2 |
| POST | /api/study-plans/today/items/:itemId/complete | Mark item done | dashboard-dynamic-phase2 |
| DELETE | /api/study-plans/today/items/:itemId/complete | Unmark item | dashboard-dynamic-phase2 |
| GET | /api/dashboard/performance | Real performance stats + weekly chart | dashboard-dynamic-phase2 |
| GET | /api/dashboard/continue-learning | Latest incomplete topic | dashboard-dynamic-phase2 |

### Analytics / Progress Page

| Method | Path | Purpose | Spec |
|--------|------|---------|------|
| GET | /api/dashboard/weak-areas | Subjects with accuracy < threshold | None |
| GET | /api/dashboard/revision-due | Revision items due today (from revision_marks) | None |
| GET | /api/dashboard/recommendations | Recommended tests based on weak areas | None |
| GET | /api/progress/overview | Overall stats (total tests, accuracy, time) | None |
| GET | /api/progress/subjects | Subject-wise accuracy breakdown | None |
| GET | /api/progress/weekly | Weekly activity/accuracy chart | None |
| GET | /api/progress/trends | Score improvement over time | None |

### Profile

| Method | Path | Purpose | Spec |
|--------|------|---------|------|
| GET | /api/profile/stats | Aggregated user statistics (tests, accuracy, score, time) | None |
| GET | /api/profile/achievements | Earned badges/achievements | None |

### Payments (Future)

| Method | Path | Purpose | Spec |
|--------|------|---------|------|
| POST | /api/payments/create-order | Create Razorpay order | None |
| POST | /api/payments/verify | Verify payment signature | None |
| GET | /api/subscriptions/current | Get active subscription | None |
| POST | /api/coupons/validate | Validate coupon code | None |

### Notifications (Future)

| Method | Path | Purpose | Spec |
|--------|------|---------|------|
| GET | /api/notifications | List user notifications | None |
| PATCH | /api/notifications/:id/read | Mark as read | None |
| POST | /api/push-tokens | Register FCM token | None |

---

## Deprecated APIs

**None.** The project is new — no APIs have been deprecated yet.

Future deprecation strategy:
- Add `X-Deprecated: true` response header
- Include `deprecatedAt` and `sunsetDate` in error response
- Provide migration path in docs
- Remove after 90-day sunset period

---

## Duplicate APIs

### Identified Duplicates / Overlaps

| API 1 | API 2 | Issue | Resolution |
|--------|--------|-------|------------|
| `POST /auth/otp/send` | `POST /auth/otp/resend` | Both generate and send OTP to phone. Resend additionally invalidates the old OTP first. | **Acceptable** — different intent (first send vs retry). Keep both. |
| `GET /dashboard/streak` | `GET /dashboard/home` (includes streak) | `/home` returns streak + daysLeft + examDate + coinBalance. `/streak` returns streak only. | **Acceptable** — `/home` is aggregated for dashboard mount; `/streak` is standalone for refresh. |
| `POST /auth/logout` | `POST /auth/logout-all` | Both logout, one is current session only, other is all-except-current. | **Acceptable** — different scope. |

### APIs That Could Be Consolidated (Not Critical)

| Current | Suggestion | Reason |
|---------|-----------|--------|
| `GET /dashboard/streak` + `GET /dashboard/home` | Single `/dashboard/home` includes streak | The frontend `useStreak` hook calls `/streak` separately, but `/home` already returns it. Could eliminate one network call. |
| `GET /coins/balance` (standalone) + dashboard `/home` includes coinBalance | Let dashboard use `/home`, profile use `/coins/balance` | Currently both are called on dashboard mount — redundant fetch. |

### No True Duplicates

There are NO cases where two different endpoints do the exact same thing. All "overlaps" are intentional for different use cases (aggregated dashboard load vs standalone refresh).

---

## Response Format Standard

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Success with Pagination

```json
{
  "success": true,
  "data": { "tests": [...] },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message (bilingual)",
    "details": { ... },
    "retryAfter": 60
  }
}
```

### Error Codes Registry

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| INVALID_PHONE | 400 | Phone number format invalid |
| INVALID_OTP | 400 | Wrong OTP code |
| OTP_EXPIRED | 400 | OTP past 5-minute window |
| OTP_MAX_ATTEMPTS | 429 | 5 failed verifications, locked 15 min |
| RATE_LIMITED | 429 | Too many requests (with retryAfter) |
| RESEND_COOLDOWN | 429 | 30-second cooldown between resends |
| SMS_DELIVERY_FAILED | 502 | SMS gateway error |
| OAUTH_FAILED | 502 | Google OAuth exchange failed |
| TOKEN_EXPIRED | 401 | Access token expired (refresh needed) |
| TOKEN_INVALID | 401 | Malformed or tampered token |
| REFRESH_DENIED | 401 | Refresh token invalid/revoked |
| SESSION_TERMINATED | 401 | Session remotely terminated |
| CSRF_INVALID | 403 | Missing or invalid CSRF token |
| CAPTCHA_REQUIRED | 403 | CAPTCHA needed after failures |
| CAPTCHA_INVALID | 403 | CAPTCHA validation failed |
| VALIDATION_ERROR | 422 | Zod validation failure (with fieldErrors) |
| NAME_INVALID | 422 | Name doesn't meet 2-50 char rule |
| AVATAR_TOO_LARGE | 422 | File > 2MB |
| AVATAR_INVALID_FORMAT | 422 | Not JPEG/PNG |
| AVATAR_TOO_SMALL | 422 | < 200x200px |
| EXAM_CHANGE_LIMIT | 429 | 3 exam changes/month exceeded |
| NO_EXAM_SELECTED | 400 | User hasn't selected an exam (required for subjects/tests) |
| ATTEMPT_NOT_FOUND | 404 | Test attempt doesn't exist |
| ATTEMPT_NOT_SUBMITTED | 400 | Can't get results for in-progress attempt |
| TEST_NOT_FOUND | 404 | Test doesn't exist |
| QUESTION_NOT_FOUND | 404 | Question doesn't exist |
| SERVER_ERROR | 500 | Unexpected internal error (no details leaked) |
