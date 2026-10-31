# Technical Debt — UP Police Test Series

## Critical (Fix Before Production)

### 1. Redis Connection Crash (No Retry Strategy)

**Impact:** Backend crashes entirely if Redis connection drops  
**Location:** `packages/backend/src/` (Redis client initialization)  
**Problem:** No `maxRetriesPerRequest`, no `retryStrategy`, no graceful degradation. A momentary Redis outage takes down the entire API server.  
**Fix:**
```typescript
const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 200, 5000),
  enableOfflineQueue: false, // Fail fast instead of queuing
});
redis.on('error', (err) => logger.error('Redis error', err));
```
**Effort:** 1 hour  
**Priority:** 🔴 Critical

---

### 2. No React Error Boundary

**Impact:** Unhandled React errors show blank white screen to users  
**Location:** `packages/frontend/src/`  
**Problem:** No `ErrorBoundary` component wrapping the app. Any uncaught render error in any component crashes the entire SPA with no recovery option.  
**Fix:** Add a root `<ErrorBoundary>` with a "Something went wrong" fallback UI and a retry button.  
**Effort:** 2 hours  
**Priority:** 🔴 Critical

---

### 3. CSRF Disabled in Development Mode

**Impact:** Security middleware conditionally skipped, easy to forget to re-enable  
**Location:** `packages/backend/src/middleware/csrf.ts`  
**Problem:** CSRF validation is bypassed when `NODE_ENV !== 'production'`. This means testing never covers CSRF behavior, and misconfigured production env could skip it.  
**Fix:** Always validate CSRF. Use a test helper to attach valid CSRF tokens in tests.  
**Effort:** 3 hours  
**Priority:** 🔴 Critical (security)

---

## High Priority (Fix in Phase 1–2)

### 4. Dashboard — 8 Hardcoded Components

**Impact:** Users see fake data that doesn't reflect their actual progress  
**Components:**
1. `TodaysPlan` — static plan items
2. `ContinueLearning` — fake "resume" data
3. `PerformanceCard` — hardcoded accuracy/score
4. `WeakAreas` — static topic list
5. `RevisionDueToday` — fake revision count
6. `QuickLinks` — static (acceptable for now)
7. `RecommendedForYou` — hardcoded test suggestions
8. `DailyChallengeBar` — static challenge info

**Location:** `packages/frontend/src/components/dashboard/`  
**Fix:** Create backend APIs (Phase 2 roadmap) and wire each component.  
**Effort:** 2–3 weeks  
**Priority:** 🟠 High

---

### 5. TestListPage Not Connected to API

**Impact:** Users see hardcoded test list instead of real tests from database  
**Location:** `packages/frontend/src/pages/TestListPage.tsx`  
**Problem:** The backend endpoint `GET /api/tests` exists and works, but the frontend page uses entirely hardcoded mock data. The API supports filtering by category, subject, topic, and pagination — none of this is wired.  
**Fix:** Create `useTests` hook, replace mock data, wire filters.  
**Effort:** 1 week  
**Priority:** 🟠 High

---

### 6. ProfileSettingsPage Stats Hardcoded

**Impact:** Profile shows fake stats (tests taken, accuracy, rank)  
**Location:** `packages/frontend/src/pages/ProfileSettingsPage.tsx`  
**Problem:** User data (name, email, language) is real from API, but the stats/achievements section shows hardcoded numbers.  
**Fix:** Create `/api/profile/stats` endpoint that aggregates from test_attempts, then wire to the page.  
**Effort:** 2 days  
**Priority:** 🟠 High

---

## Medium Priority (Fix in Phase 2–4)

### 7. Community Page is a Placeholder

**Impact:** Navigation item leads to empty/redirect page  
**Location:** `packages/frontend/src/pages/` (Community route)  
**Problem:** The Community page exists in navigation but redirects to Dashboard or shows a "Coming Soon" placeholder. No community features are planned in the near term.  
**Fix:** Either remove from navigation until ready, or build a simple discussion feature.  
**Effort:** Remove: 30 min | Build: 2–3 weeks  
**Priority:** 🟡 Medium

---

### 8. No Admin Panel

**Impact:** Content management (questions, tests) requires direct DB access  
**Problem:** To create tests or add questions, developers must use raw SQL or API calls via Postman. No UI exists for content administration.  
**Fix:** Build admin panel (Phase 6 roadmap).  
**Effort:** 4–5 weeks  
**Priority:** 🟡 Medium

---

### 9. No Payment System

**Impact:** Cannot monetize premium tests  
**Problem:** `pricing_type` column exists on tests table ('free'/'premium'), but no payment flow exists. All tests are effectively free.  
**Fix:** Integrate Razorpay, build purchase flow (Phase 5 roadmap).  
**Effort:** 3–4 weeks  
**Priority:** 🟡 Medium

---

### 10. No Push Notifications

**Impact:** No re-engagement mechanism for inactive users  
**Problem:** No FCM integration, no notification service, no way to remind users about streaks, new tests, or exam dates.  
**Fix:** Phase 6 roadmap.  
**Effort:** 2 weeks  
**Priority:** 🟡 Medium

---

### 11. No Analytics/Reporting Backend

**Impact:** ProgressPage shows entirely fake data  
**Problem:** No endpoints exist for subject-wise accuracy, score trends, time analysis, or improvement metrics. The ProgressPage has UI shells but zero real data.  
**Fix:** Create analytics service with aggregation queries (Phase 4 roadmap).  
**Effort:** 2–3 weeks  
**Priority:** 🟡 Medium

---

## Low Priority (Fix When Scaling)

### 12. No Service Worker (PWA Incomplete)

**Impact:** App cannot work offline, no "Add to Home Screen" prompt  
**Location:** `packages/frontend/`  
**Problem:** The app is designed mobile-first but lacks a service worker for offline caching, push notification handling, or install prompt.  
**Fix:** Add Vite PWA plugin, configure workbox for static asset caching and API request strategies.  
**Effort:** 3–4 days  
**Priority:** 🟢 Low

---

### 13. No Image Optimization / CDN Strategy

**Impact:** Question images and avatars served directly from origin  
**Problem:** No image resizing, no WebP conversion, no CDN configuration. As question count grows, image loading will be a bottleneck.  
**Fix:** 
- Upload to S3 with CloudFront CDN
- Use sharp for server-side resizing
- Serve multiple sizes with srcset
- Consider Cloudinary or imgproxy

**Effort:** 1 week  
**Priority:** 🟢 Low

---

### 14. No Structured Logging

**Impact:** Debugging production issues relies on `console.log`  
**Problem:** No structured logging library. Log output is unstructured, not JSON-formatted, and doesn't include correlation IDs or request metadata.  
**Fix:** Add pino or winston with JSON output, request ID middleware, log levels.  
**Effort:** 4 hours  
**Priority:** 🟢 Low

---

### 15. Account Deletion Cron Missing

**Impact:** `deletion_scheduled_at` is set but never acted on  
**Location:** `users.deletion_scheduled_at` column  
**Problem:** Users can schedule account deletion (sets a future date), but no background job processes these deletions. Data persists indefinitely.  
**Fix:** Add a cron job (node-cron or external scheduler) that runs daily, finds users past their deletion date, and removes their data.  
**Effort:** 3 hours  
**Priority:** 🟢 Low

---

### 16. No Database Indexes on Hot Queries

**Impact:** Performance degradation at scale  
**Problem:** Some frequently-run queries (leaderboard aggregation, user attempt history) don't have optimized composite indexes.  
**Fix:** Analyze slow query log, add composite indexes:
- `(user_id, test_id, status)` on test_attempts
- `(exam_id, status, created_at)` on tests
- `(user_id, created_at)` on coin_transactions

**Effort:** 2 hours (+ testing)  
**Priority:** 🟢 Low

---

## Debt Tracking Summary

| Priority | Count | Total Effort |
|----------|-------|-------------|
| 🔴 Critical | 3 | ~6 hours |
| 🟠 High | 3 | ~4 weeks |
| 🟡 Medium | 5 | ~12 weeks |
| 🟢 Low | 5 | ~2 weeks |
| **Total** | **16** | — |

---

## Quick Wins (< 2 hours each)

1. ✅ Add Redis `maxRetriesPerRequest` config
2. ✅ Add basic `ErrorBoundary` component
3. ✅ Add `/api/health` endpoint
4. ✅ Remove Community from bottom nav (or add "Coming Soon" badge)
5. ✅ Add `robots.txt` and basic SEO meta tags
6. ✅ Set `sameSite: 'strict'` on all cookies in production
