# Changelog — UP Police Test Series

## [2026-08-06] — StudyPlanPage: Inline Topics & Tests in Today's Plan

### Frontend Changes
- **MODIFIED** `packages/frontend/src/pages/StudyPlanPage.tsx`
  - `TodayPlanItem` component redesigned: topics and tests now shown inline below subject (no expand needed)
  - Topics load automatically on mount (no click required)
  - Tests shown with 📝 icon below topics
  - Green tick (✓) for completed topics and attempted tests
  - Subject marked green only when ALL topics completed AND all tests attempted
  - Progress bar shows actual completion percentage (topics + tests combined)
  - Removed dropdown/expand button — content always visible in compact form
  - Better UX: user can see full plan status at a glance

### No Backend Changes


---

## [2026-08-05] — RBAC (Role-Based Access Control)

### Backend Changes
- **NEW** `packages/backend/migrations/019_add-role-to-users.ts` — Adds `role` column (VARCHAR(20), NOT NULL, DEFAULT 'student') with CHECK constraint and index
- **NEW** `packages/backend/src/middleware/require-role.ts` — Factory middleware `requireRole(...roles)` for route protection
- **NEW** `packages/backend/src/middleware/require-role.test.ts` — 7 unit tests (pass, deny, multi-role, no-auth, undefined role)
- **MODIFIED** `packages/backend/src/middleware/jwt-auth.ts` — Added `role?: string` to Express type augmentation + JWT extraction
- **MODIFIED** `packages/backend/src/services/session.service.ts` — `role` included in JWT payload, queried from DB on create/refresh
- **MODIFIED** `packages/backend/src/controllers/questions.controller.ts` — POST, PUT, DELETE now require `admin` or `super_admin` role
- **MODIFIED** `packages/backend/src/controllers/tests.controller.ts` — POST, PUT now require `admin` or `super_admin` role

### Frontend Changes
- None (no frontend modifications)

### Database Changes
- Added `role` column to `users` table: VARCHAR(20), NOT NULL, DEFAULT 'student'
- Added CHECK constraint: `role IN ('student', 'admin', 'super_admin')`
- Added index: `idx_users_role` on (role)

### API Changes
- POST `/api/questions` — Now returns 403 for non-admin users
- PUT `/api/questions/:id` — Now returns 403 for non-admin users
- DELETE `/api/questions/:id` — Now returns 403 for non-admin users
- POST `/api/tests` — Now returns 403 for non-admin users
- PUT `/api/tests/:id` — Now returns 403 for non-admin users
- GET endpoints remain unchanged (accessible to all authenticated users)
- JWT payload now includes `role` field

### Documentation
- **NEW** `docs/RBAC.md` — Complete RBAC documentation (roles, endpoints, promotion SQL, middleware chain)


---

## [2026-08-05] — Admin Panel Planning

### Documentation Changes
- **NEW** `docs/ADMIN_PLAN.md` — Complete enhanced admin implementation plan
  - 12 admin pages defined
  - 5-step test wizard designed
  - Full bilingual question editor spec
  - CSV/Excel bulk import flow
  - Admin activity log table design
  - 13 new API endpoints planned
  - 15 existing endpoints marked for reuse
  - Permission matrix (admin vs super_admin)
  - Implementation order (5 sprints, 13 days total)

### Backend Changes
- None (planning only)

### Frontend Changes
- None (planning only)

### Database Changes (Planned)
- Migration 020: `admin_activity_log` table (planned, not yet created)

### API Changes (Planned)
- 13 new admin endpoints planned at `/api/admin/*`
- Zero changes to existing student-facing APIs


---

## [2026-08-05] — Admin Panel Phase 1

### Backend Changes
- **NEW** `packages/backend/migrations/020_create-admin-activity-log.ts` — admin_activity_log table
- **NEW** `packages/backend/src/services/admin-activity.service.ts` — logActivity(), getActivityLog()
- **NEW** `packages/backend/src/controllers/admin.controller.ts` — 5 endpoints (stats, activity, users, user detail, role change)
- **MODIFIED** `packages/backend/src/routes/index.ts` — Added `router.use("/api/admin", adminRouter)`

### Frontend Changes
- **NEW** `packages/frontend/src/admin/components/AdminGuard.tsx` — Role-based route guard
- **NEW** `packages/frontend/src/admin/components/AdminLayout.tsx` — Sidebar + header (responsive)
- **NEW** `packages/frontend/src/admin/pages/AdminDashboard.tsx` — Stats cards, tables, skeleton, error state
- **NEW** `packages/frontend/src/admin/pages/` — 7 placeholder pages
- **MODIFIED** `packages/frontend/src/router.tsx` — Admin route group added

### Database Changes
- New table: `admin_activity_log` (id, admin_id, action, entity_type, entity_id, details, created_at)
- CHECK constraint: action IN (create, update, delete, publish, unpublish, role_change, bulk_import)
- Indexes: admin_id + created_at DESC, entity_type + entity_id

### API Changes (5 new endpoints)
- `GET /api/admin/stats` — Dashboard metrics (admin, super_admin)
- `GET /api/admin/activity` — Paginated activity log (admin, super_admin)
- `GET /api/admin/users` — User list with search/filter (super_admin)
- `GET /api/admin/users/:id` — User detail + stats (super_admin)
- `PATCH /api/admin/users/:id/role` — Role change + audit log (super_admin)


---

## [2026-08-05] — Admin Panel Phase 2 (Question Management)

### Frontend Changes
- **REPLACED** `packages/frontend/src/admin/pages/AdminQuestions.tsx` — Full question list with search, filter, pagination, delete modal, skeleton, empty/error states
- **NEW** `packages/frontend/src/admin/pages/QuestionEditor.tsx` — Full bilingual create/edit form (two-column layout, all fields, exam multi-select, validation, sticky save bar)
- **MODIFIED** `packages/frontend/src/router.tsx` — Added `/admin/questions/new` and `/admin/questions/:id/edit` routes

### Backend Changes
- None (all APIs already existed)

### APIs Consumed (existing, now used by admin UI)
- `GET /api/questions` — Question list with filters
- `GET /api/questions/:id` — Single question (for edit)
- `POST /api/questions` — Create question
- `PUT /api/questions/:id` — Update question
- `DELETE /api/questions/:id` — Soft delete
- `GET /api/onboarding/exams` — Exam list for multi-select


---

## [2026-08-05] — Admin Panel Phase 3 (Test Management)

### Frontend Changes
- **REPLACED** `packages/frontend/src/admin/pages/AdminTests.tsx` — Full test list with status/category filters, pagination, edit navigation
- **NEW** `packages/frontend/src/admin/pages/TestWizard.tsx` — 5-step wizard (create + edit mode)
- **NEW** `packages/frontend/src/admin/components/wizard/StepDetails.tsx` — Step 1: Basic Details
- **NEW** `packages/frontend/src/admin/components/wizard/StepConfig.tsx` — Step 2: Configuration
- **NEW** `packages/frontend/src/admin/components/wizard/StepQuestions.tsx` — Step 3: Question Selection (search, filter, reorder)
- **NEW** `packages/frontend/src/admin/components/wizard/StepPreview.tsx` — Step 4: Preview with edit links
- **NEW** `packages/frontend/src/admin/components/wizard/StepPublish.tsx` — Step 5: Publish settings
- **MODIFIED** `packages/frontend/src/router.tsx` — Added `/admin/tests/new` and `/admin/tests/:id/edit`

### Backend Changes
- None (all APIs already existed)

### APIs Consumed (existing, now used by admin UI)
- `GET /api/tests` — Test listing
- `GET /api/tests/:id` — Test detail (for edit pre-fill)
- `POST /api/tests` — Create test
- `PUT /api/tests/:id` — Update test
- `GET /api/questions` — Question selection in wizard
- `GET /api/onboarding/exams` — Exam dropdown


---

## [2026-08-05] — Admin Panel Phases 4 & 5 (Users + Remaining Pages)

### Frontend Changes
- **REPLACED** `packages/frontend/src/admin/pages/AdminUsers.tsx` — Full user list with debounced search, role filter, pagination, super_admin gate
- **NEW** `packages/frontend/src/admin/pages/AdminUserDetail.tsx` — User detail view with stats, role change with confirmation modal
- **REPLACED** `packages/frontend/src/admin/pages/AdminActivity.tsx` — Activity log table with action badges, pagination
- **REPLACED** `packages/frontend/src/admin/pages/AdminExams.tsx` — Read-only exam table from API
- **REPLACED** `packages/frontend/src/admin/pages/AdminSubjects.tsx` — Collapsible subject/topic tree with lazy-loaded topics
- **REPLACED** `packages/frontend/src/admin/pages/AdminImport.tsx` — Drag-drop CSV upload, parse, validate, preview, sequential import with progress
- **MODIFIED** `packages/frontend/src/router.tsx` — Added `/admin/users/:id` route

### Backend Changes
- None

### APIs Consumed (existing, now used by admin)
- `GET /api/admin/users` — User list (AdminUsers page)
- `GET /api/admin/users/:id` — User detail (AdminUserDetail page)
- `PATCH /api/admin/users/:id/role` — Role change (AdminUserDetail page)
- `GET /api/admin/activity` — Activity log (AdminActivity page)
- `GET /api/onboarding/exams` — Exam list (AdminExams page)
- `GET /api/subjects` — Subject list (AdminSubjects page)
- `GET /api/subjects/:id/topics` — Topics (AdminSubjects page)
- `POST /api/questions` — Sequential import (AdminImport page)


---

## [2026-08-05] — STEP 20: Dashboard Fully Dynamic

### Database Changes
- **NEW** `packages/backend/migrations/021_create-study-plans-tables.ts` — 4 tables: study_plans, study_plan_items, user_active_plans, plan_item_completions (with constraints, indexes, cascading deletes)

### Backend Changes
- **NEW** `packages/backend/src/services/dashboard-dynamic.service.ts` — 7 service functions (getTodayPlan, getContinueLearning, getPerformanceStats, getWeakAreas, getRevisionDue, getRecommendations, getDailyChallenge)
- **MODIFIED** `packages/backend/src/controllers/dashboard.controller.ts` — Added 7 GET route handlers (appended, existing routes untouched)

### Frontend Changes — Hooks (7 new)
- **NEW** `packages/frontend/src/hooks/useTodayPlan.ts`
- **NEW** `packages/frontend/src/hooks/useContinueLearning.ts`
- **NEW** `packages/frontend/src/hooks/usePerformance.ts`
- **NEW** `packages/frontend/src/hooks/useWeakAreas.ts`
- **NEW** `packages/frontend/src/hooks/useRevisionDue.ts`
- **NEW** `packages/frontend/src/hooks/useRecommendations.ts`
- **NEW** `packages/frontend/src/hooks/useDailyChallenge.ts`

### Frontend Changes — Components (7 modified)
- **MODIFIED** `TodaysPlan.tsx` — Removed MOCK_PLAN, uses useTodayPlan hook
- **MODIFIED** `ContinueLearning.tsx` — Removed static values, uses useContinueLearning hook
- **MODIFIED** `PerformanceCard.tsx` — Removed MOCK_STATS/MOCK_CHART_DATA, uses usePerformance hook
- **MODIFIED** `WeakAreas.tsx` — Removed MOCK_WEAK_AREAS, uses useWeakAreas hook
- **MODIFIED** `RevisionDueToday.tsx` — Removed MOCK_REVISIONS, uses useRevisionDue hook
- **MODIFIED** `RecommendedForYou.tsx` — Removed MOCK_ITEMS, uses useRecommendations hook
- **MODIFIED** `DailyChallengeBar.tsx` — Removed hardcoded 20/50, uses useDailyChallenge hook

### API Endpoints Added (7 new)
- `GET /api/dashboard/today-plan`
- `GET /api/dashboard/continue-learning`
- `GET /api/dashboard/performance`
- `GET /api/dashboard/weak-areas`
- `GET /api/dashboard/revision-due`
- `GET /api/dashboard/recommendations`
- `GET /api/dashboard/daily-challenge`


---

## [2026-08-05] — STEP 21: Learning Engine + Study Plan System

### Database Changes
- **NEW** `packages/backend/migrations/022_create-topic-progress.ts` — topic_progress table (user_id, subject_id, topic_id, status, best_accuracy, attempts_count, completed_at, unlocked_at)

### Backend Changes
- **NEW** `packages/backend/src/services/learning-engine.service.ts` — Core learning engine (9 functions: initializePlan, getStudyPlan, getCurrentTopic, startTopic, completeTopic, getProgressSummary, getSubjectsWithProgress, getTopicsForSubject, canTakeTopicTest)
- **NEW** `packages/backend/src/controllers/study-plan.controller.ts` — 8 endpoints (GET /, GET /current, GET /subjects, GET /topics/:subjectId, GET /progress, POST /initialize, POST /topic/:id/start, POST /topic/:id/complete)
- **MODIFIED** `packages/backend/src/routes/index.ts` — Added `/api/study-plan` route

### Frontend Changes
- **NEW** `packages/frontend/src/hooks/useStudyPlan.ts` — Study plan hook with API integration
- **REPLACED** `packages/frontend/src/pages/StudyPlanPage.tsx` — Full sequential learning UI (was 100% hardcoded, now fully dynamic)

### API Endpoints Added (8)
- `GET /api/study-plan` — Full plan overview with subjects
- `GET /api/study-plan/current` — Resume position
- `GET /api/study-plan/subjects` — Subjects with progress
- `GET /api/study-plan/topics/:subjectId` — Topics for a subject
- `GET /api/study-plan/progress` — Progress summary
- `POST /api/study-plan/initialize` — Initialize study plan
- `POST /api/study-plan/topic/:topicId/start` — Start a topic
- `POST /api/study-plan/topic/:topicId/complete` — Complete with accuracy check

### Key Features
- Sequential unlock (Topic 1 → Topic 2 → ... → Subject Complete → Next Subject)
- 80% pass threshold for topic tests
- Automatic coin award (10 per completion)
- Transactional unlock (atomic, no race conditions)
- Idempotent initialization (safe to call multiple times)
- Lazy-loaded topics (per subject)
- Full bilingual UI


---

## [2026-08-05] — Performance Analytics Engine

### Backend Changes
- **NEW** `packages/backend/src/services/performance-analytics.service.ts` — 10 functions: getOverview, getSubjectAnalytics, getTopicAnalytics, getWeeklyAnalytics, getMonthlyAnalytics, getTimeAnalytics, getWeakAreas, getStrongAreas, getRecommendations, getRankAnalytics
- **NEW** `packages/backend/src/controllers/performance.controller.ts` — 9 endpoints all behind jwtAuth
- **MODIFIED** `packages/backend/src/routes/index.ts` — Added performanceRouter

### Frontend Changes
- **NEW** `packages/frontend/src/hooks/usePerformanceAnalytics.ts` — Parallel fetch of 4 endpoints
- **REPLACED** `packages/frontend/src/pages/ProgressPage.tsx` — Full rewrite with stats grid, weekly chart, subject bars, weak/strong areas

### APIs Added (9)
- GET /api/performance/overview
- GET /api/performance/subjects
- GET /api/performance/topics
- GET /api/performance/weekly
- GET /api/performance/monthly
- GET /api/performance/time
- GET /api/performance/weak-strong
- GET /api/performance/recommendations
- GET /api/performance/rank

### Database Changes: None (all computed from existing tables)


---

## [2026-08-05] — Progress Tracking & Learning Journey Engine

### Backend Changes
- **NEW** `packages/backend/src/services/progress-engine.service.ts` — 9 functions (getProgressOverview, getSubjectProgress, getTopicProgress, getTimeline, getDailyGoals, getHeatmap, getMilestones, getXPDetails, getProgressHistory)
- **NEW** `packages/backend/src/controllers/progress.controller.ts` — 9 GET endpoints
- **MODIFIED** `packages/backend/src/routes/index.ts` — Added progressRouter

### Frontend Changes
- **NEW** `packages/frontend/src/hooks/useProgressEngine.ts` — Hook for learning journey data
- **MODIFIED** `packages/frontend/src/pages/ProgressPage.tsx` — Added tabbed UI (Analytics | Learning Journey)

### Features
- XP system (1 coin = 1 XP, 100 XP = 1 level)
- 12 dynamic milestones (completion %, tests, questions, streaks)
- Daily goals with streak tracking
- 365-day activity heatmap
- Chronological timeline (topics, tests, coins)
- Syllabus completion estimation
- Weekly/monthly progress history

### Database: None (all from existing tables)
### APIs Added: 9 (at /api/progress/*)


---

## [2026-08-05] — Full Documentation Synchronization

### Documentation Changes
- **NEW** `docs/PROJECT_REPORT.md` — Comprehensive master report (overall completion, API summary, database summary, frontend summary, pending features, risks, tech debt, production readiness by module)
- **UPDATED** `docs/NEXT_TASK.md` — Reflects current priority (soft launch prep: Redis fix, ErrorBoundary, TestListPage wire, deployment)
- **VERIFIED** All docs files reflect actual implementation state

### No Code Changes
This was a documentation-only synchronization pass.

### Current Project State Summary
- 90% overall completion
- 72+ backend API endpoints
- 23 frontend pages (12 student + 11 admin)
- 22 database tables
- 18 reusable hooks
- 18 backend services
- 75% production readiness
- 3 critical fixes needed before deployment


---

## [2026-08-05] — Dashboard Functional Completion

### Files Modified (13)
- `packages/frontend/src/hooks/useTodayPlan.ts` — Exposed refetch
- `packages/frontend/src/pages/DashboardPage.tsx` — Added navigate, fixed handlers
- `packages/frontend/src/components/dashboard/DashboardHeader.tsx` — Navigation + disabled state
- `packages/frontend/src/components/dashboard/StatsRow.tsx` — Removed hardcoded Daily Target
- `packages/frontend/src/components/dashboard/TodaysPlan.tsx` — Edit nav + checkbox toggle via API
- `packages/frontend/src/components/dashboard/ContinueLearning.tsx` — Continue/View All navigation
- `packages/frontend/src/components/dashboard/PerformanceCard.tsx` — Card clickable → /progress
- `packages/frontend/src/components/dashboard/RevisionDueToday.tsx` — View All → /progress
- `packages/frontend/src/components/dashboard/WeakAreas.tsx` — Practice → /tests, Analysis → /progress
- `packages/frontend/src/components/dashboard/QuickLinks.tsx` — Wired routes, disabled gracefully
- `packages/frontend/src/components/dashboard/DailyChallengeBar.tsx` — Start Now → /tests
- `packages/frontend/src/components/dashboard/RecommendedForYou.tsx` — Practice → test, View All → /tests

### No backend/database changes
### 0 new APIs created (all existing reused)
### 18 dead buttons → 0 dead buttons


---

## [2026-08-05] — STEP 23: End-to-End Integration & Production Readiness

### Frontend Changes
- **NEW** `packages/frontend/src/components/common/ErrorBoundary.tsx` — Global error boundary (bilingual, Retry + Go Home)
- **MODIFIED** `packages/frontend/src/App.tsx` — Wrapped app tree with ErrorBoundary
- **REPLACED** `packages/frontend/src/pages/TestListPage.tsx` — Fully wired to GET /api/tests (filter tabs, pagination, loading/error/empty states)
- **MODIFIED** `packages/frontend/src/pages/ProfileSettingsPage.tsx` — Stats section now calls GET /api/performance/overview

### Backend Changes
- **MODIFIED** `packages/backend/src/redis/client.ts` — Added maxRetriesPerRequest:3, retryStrategy (exponential backoff, max 10 attempts), enableOfflineQueue:false

### Critical Bugs Fixed
- App no longer crashes on Redis disconnect
- Unhandled React render errors no longer show white screen
- TestListPage no longer shows fake data
- Profile stats no longer hardcoded
