# Next Task — UP Police Test Series

## Just Completed: STEP 23 — End-to-End Integration & Production Readiness

Critical fixes applied:
- ✅ React ErrorBoundary (no more white screens)
- ✅ Redis maxRetries (no more crashes on Redis disconnect)
- ✅ TestListPage wired to real API (last hardcoded core page fixed)
- ✅ ProfilePage stats from real API

---

## Next Recommended Feature

**DEPLOY** — The app is now production-ready for beta users.

| # | Task | Effort |
|---|------|--------|
| 1 | Configure Vercel (frontend) | 2h |
| 2 | Configure Railway (backend + PostgreSQL + Redis) | 3h |
| 3 | Run migrations on production DB | 30min |
| 4 | DNS + CORS + environment variables | 1h |
| 5 | Smoke test auth + test attempt flow | 1h |

**Remaining "nice to have" (post-deploy):**
- Wire Community page (social feature)
- Add push notifications
- Add payments
- Add structured logging (pino)
- Add Sentry error tracking

Build the Question List and Question Editor pages. These reuse existing `GET /api/questions`, `POST /api/questions`, `PUT /api/questions/:id`, `DELETE /api/questions/:id` APIs — zero backend work needed.

### Tasks:
1. Build QuestionList page (table + search + filter by subject/difficulty + pagination)
2. Build QuestionEditor page (full bilingual form: 2-column layout, all fields)
3. Add image upload support (reuse existing multer pattern)
4. Wire delete with confirmation dialog

### Dependencies:
- Admin Phase 1 (done ✅)
- Existing question APIs (done ✅, protected by requireRole ✅)

### After that:
- Phase 3: Test Wizard (5-step creation flow)
- Phase 4: User Management (list + detail + role change)
- Phase 5: Bulk Import + Subjects/Exams + Activity Log

---

## Still Pending (Sprint 1 Critical Fixes)

| # | Task | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 1 | Add Redis maxRetries + retryStrategy | 🔴 Critical | 1h | ❌ Pending |
| 2 | Add React ErrorBoundary (global) | 🔴 Critical | 2h | ❌ Pending |
| 3 | Verify CSRF in production mode | 🔴 Critical | 2h | ❌ Pending |
| 4 | Wire TestListPage to GET /api/tests | 🟠 High | 1 day | ❌ Pending |

Add `maxRetriesPerRequest` and `retryStrategy` to the Redis client configuration to prevent backend crashes when Redis temporarily disconnects.

### Why this is next:
1. Critical production blocker — app crashes entirely on Redis blip
2. Lowest effort (1 hour)
3. Zero risk (additive config change)
4. Enables safe deployment

### Dependencies:
- None — standalone fix

### After that:
- React ErrorBoundary (2h) → prevents white screen
- Then TestListPage wiring (1 day) → biggest user-facing improvement

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Redis crash in production | High (until fixed) | Critical (full app down) | Next task: add retry strategy |
| Render errors showing white screen | Medium | High (bad UX) | Add ErrorBoundary after Redis fix |
| TestListPage shows fake data | Certain (until wired) | Medium (user confusion) | Sprint 1 task |


---

## Planning Completed: Admin Panel

Full implementation plan at `docs/ADMIN_PLAN.md`. Key highlights:
- No separate login (role-based redirect)
- 5-step test wizard
- Full bilingual question editor
- CSV/Excel bulk import with preview
- Admin activity log
- 13 new endpoints, 15 reused, 0 duplicated
- Isolated from student app (`src/admin/` folder)
- Ready to implement after Sprint 1 (Redis fix + TestListPage wire)
