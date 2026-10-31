# Reuse Rules — UP Police Test Series

> **Rule:** Before creating any new file, check this list. If functionality already exists, USE IT. Do not recreate utilities, hooks, components, middleware, or services that are already implemented.

---

## Backend — Middleware

| File | Purpose | Usage |
|------|---------|-------|
| `src/middleware/jwt-auth.ts` | Extracts and validates JWT from Authorization header. Attaches `req.user` | Apply to any protected route: `router.get('/path', jwtAuth, handler)` |
| `src/middleware/rate-limiter.ts` | Redis-backed rate limiting per IP | `rateLimiter({ windowMs: 60000, max: 10 })` — configurable per route |
| `src/middleware/csrf.ts` | CSRF token validation (double-submit cookie) | Applied globally to POST/PUT/PATCH/DELETE. Get token from `GET /auth/csrf` |
| `src/middleware/captcha.ts` | Cloudflare Turnstile CAPTCHA verification | `captchaMiddleware` — apply to endpoints needing bot protection |
| `src/middleware/error-handler.ts` | Global error handler, formats AppError to JSON | Already mounted — just `throw new AppError(...)` from anywhere |
| `src/middleware/validate.ts` | Zod schema validation for req.body/params/query | `validate(schema)` — pass a Zod schema object |

### ❌ DO NOT:
- Create a new auth middleware — use `jwt-auth.ts`
- Write custom rate limiting logic — use `rate-limiter.ts`
- Handle errors in controllers with try/catch returning res.json — let errors propagate to `error-handler.ts`
- Create a new validation approach — use `validate.ts` with Zod

---

## Backend — Error Classes

| File | Class | HTTP Status | Usage |
|------|-------|-------------|-------|
| `src/errors/app-error.ts` | `AppError` | Any | Base class: `new AppError(message, statusCode, code)` |
| `src/errors/app-error.ts` | `ValidationError` | 400 | `new ValidationError('Invalid input', details)` |
| `src/errors/app-error.ts` | `NotFoundError` | 404 | `new NotFoundError('Test not found')` |
| `src/errors/app-error.ts` | `AuthenticationError` | 401 | `new AuthenticationError('Token expired')` |
| `src/errors/app-error.ts` | `AuthorizationError` | 403 | `new AuthorizationError('Insufficient permissions')` |
| `src/errors/app-error.ts` | `ConflictError` | 409 | `new ConflictError('Already exists')` |
| `src/errors/app-error.ts` | `RateLimitError` | 429 | `new RateLimitError('Too many requests')` |
| `src/errors/otp.errors.ts` | OTP-specific errors | Various | `OtpExpiredError`, `OtpInvalidError`, `OtpMaxAttemptsError` |
| `src/errors/session.errors.ts` | Session errors | Various | `SessionNotFoundError`, `SessionExpiredError` |
| `src/errors/profile.errors.ts` | Profile errors | Various | `ExamChangeLimitError`, `InvalidLanguageError` |

### ❌ DO NOT:
- Return raw `res.status(4xx).json(...)` for errors — always throw an AppError subclass
- Create new error classes without extending `AppError`
- Duplicate error codes that already exist

---

## Backend — Services

| File | Purpose | Key Methods |
|------|---------|-------------|
| `src/services/otp.service.ts` | OTP generation, storage (Redis), verification | `sendOtp(phone)`, `verifyOtp(phone, code)`, `resendOtp(phone)` |
| `src/services/oauth.service.ts` | Google OAuth token verification | `verifyGoogleToken(idToken)` |
| `src/services/session.service.ts` | Session CRUD, token generation, rotation | `createSession(userId, device)`, `refreshTokens(refreshToken)`, `terminateSession(id)` |
| `src/services/profile.service.ts` | Profile read/update, avatar management | `getProfile(userId)`, `updateProfile(userId, data)`, `changeExam(userId, examId)` |
| `src/services/account-link.service.ts` | Link/unlink auth providers | `linkProvider(userId, provider, providerId)` |
| `src/services/test-listing.service.ts` | Fetch tests with filters and pagination | `getTests(filters)`, `getTestById(id)` |
| `src/services/attempt.service.ts` | Test attempt lifecycle management | `startAttempt(userId, testId)`, `saveAnswers(attemptId, answers)`, `submitAttempt(attemptId)` |
| `src/services/score-calculator.service.ts` | Calculate test scores with negative marking | `calculateScore(attempt)` |
| `src/services/leaderboard.service.ts` | Leaderboard queries | `getLeaderboard(examId, period)` |
| `src/services/streak.service.ts` | Streak calculation and activity recording | `getCurrentStreak(userId)`, `recordActivity(userId)` |
| `src/services/rank-estimator.service.ts` | Rank estimation based on scores | `estimateRank(userId, examId)` |
| `src/services/subjects.service.ts` | Subject/topic listing | `getSubjectsByExam(examId)`, `getTopicsBySubject(subjectId)` |
| `src/services/coins.service.ts` | Coin balance, history, earning logic | `getBalance(userId)`, `earnCoins(userId, type, refId)` |
| `src/services/daily-quiz.service.ts` | Daily quiz generation and management | `getStatus(userId)`, `startQuiz(userId)`, `submitQuiz(userId, answers)` |

### ❌ DO NOT:
- Write SQL queries directly in controllers — use or extend services
- Create a new score calculation — use `score-calculator.service.ts`
- Build new streak logic — use `streak.service.ts`
- Implement token logic outside `session.service.ts`

---

## Backend — Database Layer

| File | Purpose | Usage |
|------|---------|-------|
| `src/db/pool.ts` | PostgreSQL connection pool (pg) | Import `pool` for direct access (rarely needed) |
| `src/db/query.ts` | Query helper with logging | `query(sql, params)` — use this for all DB queries |
| `src/db/transaction.ts` | Transaction wrapper | `withTransaction(async (client) => { ... })` |
| `src/db/index.ts` | Re-exports all DB utilities | `import { query, withTransaction } from '@/db'` |

### ❌ DO NOT:
- Create new `pg.Pool()` instances
- Write transactions without the `withTransaction` wrapper
- Use string interpolation in SQL (always parameterized)

---

## Backend — Utilities

| File | Purpose |
|------|---------|
| `src/utils/token.ts` | JWT sign/verify helpers |
| `src/utils/hash.ts` | bcrypt/crypto hashing for tokens |
| `src/utils/date.ts` | Date formatting, streak calculation helpers |
| `src/config/env.ts` | Zod-validated environment variables |

---

## Backend — i18n

| File | Purpose |
|------|---------|
| `src/i18n/index.ts` | Translation function `t(key, lang)` |
| `src/i18n/get-language.ts` | Extract language from request |
| `src/i18n/en.json` | English system messages |
| `src/i18n/hi.json` | Hindi system messages |

### ❌ DO NOT:
- Hardcode error messages in English — use `t('error.key', lang)`
- Create a new i18n system

---

## Frontend — Hooks

| File | Purpose | Returns |
|------|---------|---------|
| `hooks/useAuth.ts` | Auth state, login, logout, token refresh | `{ user, isAuthenticated, login, logout, refreshToken }` |
| `hooks/useStreak.ts` | Fetch and display streak data | `{ currentStreak, bestStreak, isLoading }` |
| `hooks/useCoins.ts` | Coin balance and earning | `{ balance, history, earnCoins, isLoading }` |
| `hooks/useDailyQuiz.ts` | Daily quiz status and actions | `{ status, startQuiz, submitQuiz, result }` |
| `hooks/useDaysLeft.ts` | Days until selected exam | `{ daysLeft, examDate, examName }` |
| `hooks/useLeaderboard.ts` | Leaderboard data fetching | `{ leaderboard, userRank, period, setPeriod }` |
| `hooks/useOnlineStatus.ts` | Network connectivity detection | `{ isOnline }` |
| `hooks/useRankEstimate.ts` | Estimated rank display | `{ estimatedRank, totalCandidates }` |
| `hooks/useActivityRecording.ts` | Record daily user activity | Auto-records on page visit |

### ❌ DO NOT:
- Create a new auth hook — use `useAuth`
- Duplicate streak logic — use `useStreak`
- Build a new network detection — use `useOnlineStatus`
- Manually call activity API — use `useActivityRecording`

---

## Frontend — Context

| File | Purpose |
|------|---------|
| `contexts/AuthContext.tsx` | Global auth state provider |

### ❌ DO NOT:
- Create additional context providers for auth
- Use Redux, Zustand, or Jotai — project uses React Context + local state

---

## Frontend — API Layer

| File | Purpose |
|------|---------|
| `api/axios.ts` or `api/client.ts` | Configured Axios instance with interceptors (auto-refresh, CSRF) |
| `api/auth.ts` | Auth API calls |
| `api/tests.ts` | Test-related API calls |
| `api/dashboard.ts` | Dashboard API calls |

### ❌ DO NOT:
- Create new Axios instances — use the shared instance
- Skip the interceptor (token refresh) by using raw fetch

---

## Frontend — Components (Reusable)

| Component | Location | Purpose |
|-----------|----------|---------|
| Button | `components/common/Button.tsx` | Standard button with variants |
| Input | `components/common/Input.tsx` | Form input with validation display |
| Modal | `components/common/Modal.tsx` | Overlay modal |
| Card | `components/common/Card.tsx` | Content card wrapper |
| Spinner/Loader | `components/common/Loader.tsx` | Loading indicator |
| BottomNav | `components/layout/BottomNav.tsx` | Mobile bottom navigation |
| Header | `components/layout/Header.tsx` | Top header/app bar |

### ❌ DO NOT:
- Create new button components — use the existing Button with props
- Build a custom modal — use the existing Modal component
- Create a new loading spinner

---

## Frontend — Pages

All 12 pages already exist at `src/pages/`. When adding features:
- Add logic to the existing page component
- Extract new hooks if logic is reusable
- Use existing common components

### ❌ DO NOT:
- Create duplicate page files
- Add routing outside of the main App.tsx router

---

## General Rules

1. **Check before creating** — search for existing implementations first
2. **Extend, don't duplicate** — if something almost works, modify it
3. **Follow the pattern** — look at adjacent files for the established pattern
4. **Import from index** — use barrel exports where available (`@/errors`, `@/db`)
5. **Keep services thin in controllers** — controllers call services, services call DB

---

## 🔒 Files That Should NEVER Be Modified

These files are foundational. Modifying them risks breaking the entire application. Only touch them for critical bug fixes with full understanding of downstream impact.

### Backend — Core Infrastructure

| File | Reason |
|------|--------|
| `packages/backend/src/index.ts` | App bootstrap — middleware order matters. Add routes via `routes/index.ts` instead. |
| `packages/backend/src/config/env.ts` | Env validation. Only ADD new vars (never rename/remove existing ones). |
| `packages/backend/src/db/pool.ts` | Singleton pool. Changing config affects all queries. |
| `packages/backend/src/db/query.ts` | Core query helpers used by every service. |
| `packages/backend/src/db/transaction.ts` | Transaction wrapper used everywhere. |
| `packages/backend/src/middleware/jwt-auth.ts` | Auth foundation. All protected routes depend on `req.user` shape. |
| `packages/backend/src/middleware/error-handler.ts` | Error response format contract. Frontend depends on this shape. |
| `packages/backend/src/errors/app-error.ts` | Base error class. All other errors extend this. |
| `packages/backend/src/errors/index.ts` | Barrel export. Don't restructure. |

### Backend — Auth (Security Critical)

| File | Reason |
|------|--------|
| `packages/backend/src/controllers/auth.controller.ts` | Complex auth flows (OTP, OAuth, token rotation). Heavily tested. |
| `packages/backend/src/services/session.service.ts` | Token rotation, family tracking, reuse detection. Security-critical. |
| `packages/backend/src/services/otp.service.ts` | OTP lifecycle with Redis. Rate limits depend on this. |
| `packages/backend/src/middleware/csrf.ts` | CSRF protection. Breaking this = security vulnerability. |
| `packages/backend/src/middleware/rate-limiter.ts` | Abuse prevention. Breaking this = DDoS vulnerability. |

### Frontend — Core Infrastructure

| File | Reason |
|------|--------|
| `packages/frontend/src/main.tsx` | App entry point. |
| `packages/frontend/src/App.tsx` | Provider hierarchy (Auth → I18n → Router). Order matters. |
| `packages/frontend/src/context/AuthContext.tsx` | Global auth state. Every protected page depends on this. |
| `packages/frontend/src/services/api.ts` | Axios instance with interceptors. Token refresh, CSRF, offline detection all here. |
| `packages/frontend/src/router.tsx` | Route definitions + guard wrappers. Add routes here, don't create separate routers. |
| `packages/frontend/src/hooks/useAuth.ts` | Context consumer. Changing the interface breaks all pages. |
| `packages/frontend/src/i18n/I18nProvider.tsx` | Language context with localStorage + profile sync. |

### Configuration Files

| File | Reason |
|------|--------|
| `package.json` (root) | Workspace config. Changing workspace structure breaks everything. |
| `docker-compose.yml` | Infrastructure definition. Port/volume changes affect dev env. |
| `Dockerfile` | Multi-stage build. Incorrect changes break deployment. |
| `.eslintrc.json` | Shared linting rules. |
| `.prettierrc` | Code formatting standard. |
| `tailwind.config.js` | Theme/color tokens. Changing these affects all components. |

### Migrations (NEVER modify applied migrations)

| Rule | Reason |
|------|--------|
| Never edit ANY file in `migrations/001_*` through `migrations/018_*` | Applied migrations are immutable. The database state depends on them being unchanged. |
| Only CREATE new numbered migrations (019+) | Additive changes via new migration files. Never ALTER existing ones. |

---

## ✅ Files That Are SAFE to Modify

These files are designed to be extended, updated, or modified as features grow.

### Backend — Add/Extend Freely

| File / Pattern | Safe Operation |
|---------------|----------------|
| `packages/backend/src/routes/index.ts` | Add new `router.use('/api/new-path', newRouter)` lines |
| `packages/backend/src/controllers/*.controller.ts` (existing) | Add new route handlers to existing controllers (append to router) |
| `packages/backend/src/controllers/*.controller.ts` (new) | Create entirely new controller files for new features |
| `packages/backend/src/services/*.service.ts` (new) | Create new service files |
| `packages/backend/src/services/*.service.ts` (existing) | Add new exported functions (don't modify existing function signatures) |
| `packages/backend/migrations/019_*.ts` (and higher) | Create new migration files (sequential numbering) |
| `packages/backend/src/i18n/en.json` | Add new error code keys (don't rename existing ones) |
| `packages/backend/src/i18n/hi.json` | Add new error code keys (mirror en.json additions) |
| `packages/backend/src/errors/*.errors.ts` (new) | Create new domain error files (extend AppError) |
| `packages/backend/src/*.test.ts` (new) | Create new test files |

### Frontend — Add/Extend Freely

| File / Pattern | Safe Operation |
|---------------|----------------|
| `packages/frontend/src/hooks/use*.ts` (new) | Create new custom hooks (follow existing pattern) |
| `packages/frontend/src/components/dashboard/*.tsx` | Modify to replace hardcoded data with hook calls |
| `packages/frontend/src/components/common/*.tsx` (new) | Add new reusable components |
| `packages/frontend/src/pages/*.tsx` | Modify page internals (add hook usage, remove mock data) |
| `packages/frontend/src/services/dashboard.service.ts` | Add new API fetch functions |
| `packages/frontend/src/services/dashboard.types.ts` | Add new TypeScript interfaces |
| `packages/frontend/src/router.tsx` | Add new route entries (within the existing structure) |
| `packages/frontend/src/i18n/en.json` | Add new translation keys |
| `packages/frontend/src/i18n/hi.json` | Add new translation keys |

### Dashboard Components — Safe to Wire (Replace Mock → Real)

These are specifically designed to be modified (replace `MOCK_*` with hook data):

| Component | Safe Change |
|-----------|-------------|
| `components/dashboard/TodaysPlan.tsx` | Replace `MOCK_PLAN` with `useTodayPlan()` hook |
| `components/dashboard/ContinueLearning.tsx` | Replace inline data with `useContinueLearning()` hook |
| `components/dashboard/PerformanceCard.tsx` | Replace `MOCK_STATS`/`MOCK_CHART_DATA` with `usePerformance()` hook |
| `components/dashboard/WeakAreas.tsx` | Replace `MOCK_WEAK_AREAS` with API data |
| `components/dashboard/RevisionDueToday.tsx` | Replace `MOCK_REVISIONS` with API data |
| `components/dashboard/RecommendedForYou.tsx` | Replace `MOCK_ITEMS` with API data |
| `components/dashboard/DailyChallengeBar.tsx` | Replace inline 20/50 with API data |

### Pages — Safe to Wire (Replace Mock → Real)

| Page | Safe Change |
|------|-------------|
| `pages/TestListPage.tsx` | Replace all `MOCK_*` arrays with `useTests()` hook calling `GET /api/tests` |
| `pages/StudyPlanPage.tsx` | Replace all mock data with study plan API hooks (after backend exists) |
| `pages/ProgressPage.tsx` | Replace all mock data with progress API hooks (after backend exists) |
| `pages/ProfileSettingsPage.tsx` | Replace `MOCK_STATS`/`ACHIEVEMENTS` with profile stats hook |

---

## Summary Decision Matrix

| Action | Decision |
|--------|----------|
| Need a new API endpoint? | Create new controller file OR append handler to existing controller |
| Need new business logic? | Create new service file in `src/services/` |
| Need new database table? | Create new migration file `migrations/019_*.ts` |
| Need new frontend data? | Create new hook in `src/hooks/` |
| Need new reusable UI? | Create new component in `src/components/common/` |
| Need to modify auth flow? | ⚠️ STOP — discuss with team first |
| Need to change error format? | ⚠️ STOP — frontend depends on current shape |
| Need to add env variable? | Add to `.env.example` + `config/env.ts` Zod schema |
| Need to change DB schema? | NEVER edit existing migration. Create new one. |
| Need to fix a hardcoded component? | Replace `MOCK_*` with hook call. Keep JSX unchanged. |
