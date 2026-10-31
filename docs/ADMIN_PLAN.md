# Admin Panel — Enhanced Implementation Plan

> **Rules:** No separate login, no code duplication, reuse all existing APIs/services, admin isolated from student app.

---

## 1. Authentication & Role-Based Redirect

**No separate admin login page.** Reuse existing auth flow.

| Step | Behavior |
|------|----------|
| User logs in via existing `/login` → `/verify-otp` flow | Same as today |
| After OTP verify, backend returns `user.role` in response | Already done (JWT includes role) |
| Frontend checks `user.role` after login | NEW: add role check in AuthContext |
| If role = `admin` or `super_admin` → redirect to `/admin/dashboard` | NEW: conditional redirect |
| If role = `student` → redirect to `/dashboard` (unchanged) | Existing behavior |
| `/admin/*` routes have role-guard → redirects students to `/dashboard` | NEW: AdminGuard component |

**Reuses:** Existing `POST /api/auth/otp/send`, `POST /api/auth/otp/verify`, AuthContext, jwtAuth middleware.

---

## 2. Admin Isolation Strategy

```
packages/frontend/src/
├── pages/                    # Student pages (unchanged)
├── components/               # Student components (unchanged)
├── admin/                    # ← NEW: All admin code here
│   ├── components/           # Admin-specific components
│   │   ├── AdminLayout.tsx   # Sidebar + top bar
│   │   ├── AdminGuard.tsx    # Role check redirect
│   │   ├── AdminSidebar.tsx  # Navigation
│   │   └── ...
│   ├── pages/                # Admin pages
│   │   ├── AdminDashboard.tsx
│   │   ├── QuestionList.tsx
│   │   ├── QuestionEditor.tsx
│   │   ├── TestList.tsx
│   │   ├── TestWizard.tsx
│   │   ├── UserList.tsx
│   │   ├── UserDetail.tsx
│   │   ├── ExamManagement.tsx
│   │   ├── SubjectManagement.tsx
│   │   ├── BulkImport.tsx
│   │   └── ActivityLog.tsx
│   └── hooks/                # Admin-specific hooks
│       ├── useAdminStats.ts
│       ├── useAdminUsers.ts
│       └── useActivityLog.ts
```

**Student app completely untouched.** Admin routes added to `router.tsx` under `/admin/*` path.

---

## 3. Admin Navigation

```
/admin
├── /admin/dashboard              → Operational metrics
├── /admin/questions              → Question list (filter, search)
│   ├── /admin/questions/new      → Question editor (create)
│   └── /admin/questions/:id/edit → Question editor (edit)
├── /admin/tests                  → Test list
│   ├── /admin/tests/new          → Test wizard (5 steps)
│   └── /admin/tests/:id/edit     → Test wizard (edit mode)
├── /admin/users                  → User list
│   └── /admin/users/:id          → User detail + role
├── /admin/exams                  → Exam CRUD
├── /admin/subjects               → Subject/Topic tree
├── /admin/import                 → Bulk import (CSV/Excel)
└── /admin/activity               → Admin activity log
```

**Sidebar navigation items:**
1. 📊 Dashboard
2. ❓ Questions
3. 📝 Tests
4. 👥 Users (super_admin only)
5. 🎓 Exams
6. 📚 Subjects
7. 📥 Import
8. 📋 Activity Log

---

## 4. Test Creation Wizard (5 Steps)

| Step | Name | Fields | Validation |
|------|------|--------|-----------|
| 1 | Basic Details | title_en, title_hi, description_en, description_hi, exam_id (dropdown) | Required: title_en, title_hi, exam_id |
| 2 | Pattern & Configuration | duration_minutes, total_marks, marks_per_question, negative_marking_ratio, passing_marks, pricing_type, category, subject_id, topic_id | Required: duration, total_marks, category |
| 3 | Question Selection | Filter questions by subject/topic/difficulty → select + reorder | Min 1 question, max matches total_marks/marks_per_question |
| 4 | Preview | Summary card: test config + question count + estimated difficulty | Read-only review |
| 5 | Publish | Status selection (draft/published), available_from, available_until, confirm | Final confirmation |

**APIs Used:**
- Step 1-2: Form state only (no API call)
- Step 3: `GET /api/questions?subject=X&difficulty=Y` (existing)
- Step 3: `GET /api/subjects` + `GET /api/subjects/:id/topics` (existing)
- Step 5 (Save): `POST /api/tests` (existing) — sends all config + questionIds array
- Step 5 (Edit): `PUT /api/tests/:id` (existing)

**No new API needed for the wizard.**

---

## 5. Question Editor (Full Bilingual)

### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| text_en | Rich text / textarea | YES | Question text in English |
| text_hi | Rich text / textarea | YES | Question text in Hindi |
| option_a_en | Text input | YES | Option A English |
| option_a_hi | Text input | YES | Option A Hindi |
| option_b_en | Text input | YES | Option B English |
| option_b_hi | Text input | YES | Option B Hindi |
| option_c_en | Text input | YES | Option C English |
| option_c_hi | Text input | YES | Option C Hindi |
| option_d_en | Text input | YES | Option D English |
| option_d_hi | Text input | YES | Option D Hindi |
| correct_option | Radio (A/B/C/D) | YES | Maps to 0/1/2/3 |
| explanation_en | Textarea | NO | Why this answer is correct (English) |
| explanation_hi | Textarea | NO | Why this answer is correct (Hindi) |
| subject | Dropdown (from subjects API) | YES | Subject category |
| topic | Dropdown (from topics API) | NO | Topic within subject |
| difficulty | Radio (easy/medium/hard) | YES | Difficulty level |
| image_url | File upload | NO | Optional question image |
| examIds | Multi-select checkboxes | YES (min 1) | Which exams this question belongs to |

**UI Layout:** Two-column (English left, Hindi right) for bilingual fields.

**APIs Used:**
- Create: `POST /api/questions` (existing)
- Edit: `GET /api/questions/:id` + `PUT /api/questions/:id` (existing)
- Subject dropdown: `GET /api/subjects` (existing)
- Topic dropdown: `GET /api/subjects/:id/topics` (existing)
- Exam list: `GET /api/onboarding/exams` (existing)
- Image upload: `POST /api/profile/avatar` pattern (reuse multer setup) → NEW: `POST /api/admin/upload`

---

## 6. Bulk Import (CSV + Excel)

### Flow

```
Upload File → Parse → Validate → Preview (table) → Show Errors → Confirm Import → Results
```

| Step | UI | Details |
|------|-----|---------|
| 1. Upload | File picker (drag-drop) | Accept .csv, .xlsx, .xls (max 5MB) |
| 2. Parse | Loading spinner | Client-side CSV parse (Papa Parse) or send to backend |
| 3. Validate | Auto | Check required fields, correct_option range, subject valid, etc. |
| 4. Preview | Table view | Show first 10 rows with parsed data |
| 5. Errors | Error panel | Red rows with specific field errors (row #, column, message) |
| 6. Confirm | Button | "Import X valid questions (Y errors skipped)" |
| 7. Results | Summary card | "Successfully imported 45/50 questions. 5 skipped." |

### CSV Format

```csv
text_en,text_hi,option_a_en,option_a_hi,option_b_en,option_b_hi,option_c_en,option_c_hi,option_d_en,option_d_hi,correct_option,explanation_en,explanation_hi,subject,topic,difficulty,exam_ids
"What is...","क्या है...","Opt A","विकल्प A","Opt B","विकल्प B","Opt C","विकल्प C","Opt D","विकल्प D",0,"Because...","क्योंकि...","gk","history","easy","exam-uuid-1,exam-uuid-2"
```

**New API:** `POST /api/admin/questions/bulk`
- Accepts: JSON array of validated questions (client parses CSV, sends JSON)
- Validates each row server-side
- Uses existing `withTransaction` for atomic insert
- Returns: `{ imported: number, errors: { row: number, message: string }[] }`

---

## 7. Admin Dashboard (Operational Metrics)

| Widget | Data Source | API |
|--------|------------|-----|
| Total Users | COUNT from users | `GET /api/admin/stats` (new) |
| Active Today | COUNT from user_activities WHERE date = today (IST) | Same endpoint |
| Total Questions | COUNT from questions WHERE is_active = true | Same endpoint |
| Total Tests Published | COUNT from tests WHERE status = 'published' | Same endpoint |
| Attempts Today | COUNT from test_attempts WHERE created_at = today | Same endpoint |
| Draft Tests | COUNT from tests WHERE status = 'draft' | Same endpoint |
| Recent Registrations | Last 10 users by created_at | `GET /api/admin/stats` (include in response) |
| Top Exams | GROUP BY exam_id from users, COUNT | Same endpoint |
| Revenue (placeholder) | Static "Coming Soon" | N/A |
| Server Health | Redis ping + DB ping | `GET /api/health` (existing) |
| Activity Feed | Last 20 admin actions | `GET /api/admin/activity` (new) |
| Recent Tests | Last 5 tests created/published | Same stats endpoint |

**Single API call:** `GET /api/admin/stats` returns all metrics in one response (avoids multiple requests on dashboard load).

---

## 8. Admin Activity Log

### New Table: `admin_activity_log`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| admin_id | UUID | FK → users, NOT NULL |
| action | VARCHAR(50) | NOT NULL |
| entity_type | VARCHAR(50) | NOT NULL |
| entity_id | UUID | NULLABLE |
| details | JSONB | NULLABLE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**Actions tracked:**

| Action | Entity Type | When |
|--------|------------|------|
| `create` | question | Admin creates a question |
| `update` | question | Admin edits a question |
| `delete` | question | Admin soft-deletes a question |
| `create` | test | Admin creates a test |
| `update` | test | Admin edits a test |
| `publish` | test | Admin changes test status to 'published' |
| `unpublish` | test | Admin changes test status to 'draft' |
| `role_change` | user | Super_admin changes a user's role |
| `bulk_import` | question | Admin imports questions via CSV |
| `create` | exam | Admin creates an exam |
| `create` | subject | Admin creates a subject/topic |

**API:** `GET /api/admin/activity?page=1&limit=20` — returns paginated activity log with admin name + action details.

**Integration:** Activity is logged inside existing controllers (questions, tests) by adding a single service call after successful operations. Minimal change — 1 line per handler.

---

## 9. Permissions Matrix (Updated)

| Page | admin | super_admin |
|------|-------|-------------|
| Admin Dashboard | ✅ | ✅ |
| Question List/Create/Edit/Delete | ✅ | ✅ |
| Test List/Create/Edit/Publish | ✅ | ✅ |
| Bulk Import | ✅ | ✅ |
| Subject/Topic Management | ✅ | ✅ |
| Activity Log (view) | ✅ | ✅ |
| User List | ❌ | ✅ |
| User Role Change | ❌ | ✅ |
| Exam Create/Edit | ❌ | ✅ |

---

## 10. New APIs Summary

| # | Method | Path | Purpose | Role Required |
|---|--------|------|---------|---------------|
| 1 | GET | `/api/admin/stats` | Dashboard metrics (all-in-one) | admin, super_admin |
| 2 | GET | `/api/admin/users` | User list (paginated, searchable) | super_admin |
| 3 | GET | `/api/admin/users/:id` | User detail + stats | super_admin |
| 4 | PATCH | `/api/admin/users/:id/role` | Change role + audit log | super_admin |
| 5 | POST | `/api/admin/exams` | Create exam | super_admin |
| 6 | PUT | `/api/admin/exams/:id` | Update exam | super_admin |
| 7 | POST | `/api/admin/subjects` | Create subject | admin, super_admin |
| 8 | PUT | `/api/admin/subjects/:id` | Update subject | admin, super_admin |
| 9 | POST | `/api/admin/subjects/:id/topics` | Create topic | admin, super_admin |
| 10 | PUT | `/api/admin/topics/:id` | Update topic | admin, super_admin |
| 11 | POST | `/api/admin/questions/bulk` | Bulk CSV import | admin, super_admin |
| 12 | POST | `/api/admin/upload` | File upload (question images) | admin, super_admin |
| 13 | GET | `/api/admin/activity` | Activity log (paginated) | admin, super_admin |

**Existing APIs reused without changes: 15 endpoints**
**New admin-specific endpoints: 13**
**Total duplicated: ZERO**

---

## 11. Database Changes

### New Table (1 only)

- `admin_activity_log` — activity tracking (migration 020)

### No Changes to Existing Tables

All existing tables remain untouched. Admin reads/writes to the same questions, tests, users, subjects, topics tables through existing service layer.

---

## 12. Implementation Order (Sprints)

### Sprint A: Backend Foundation (2 days)

| # | Task | Effort |
|---|------|--------|
| 1 | Create migration 020: admin_activity_log table | 1h |
| 2 | Create admin-activity.service.ts (log + list) | 2h |
| 3 | Create admin.controller.ts (GET /stats, GET /activity) | 3h |
| 4 | Create admin-users.controller.ts (list, detail, role-change) | 4h |
| 5 | Create admin-content.controller.ts (exams CRUD, subjects CRUD, bulk import) | 4h |
| 6 | Create admin-upload.controller.ts (file upload) | 2h |
| 7 | Register all admin routes in routes/index.ts | 30min |
| 8 | Add activity logging calls to questions/tests controllers | 1h |

### Sprint B: Admin Shell + Dashboard (2 days)

| # | Task | Effort |
|---|------|--------|
| 9 | Create AdminGuard component (role check + redirect) | 1h |
| 10 | Create AdminLayout (sidebar + top bar) | 3h |
| 11 | Add /admin/* routes to router.tsx | 1h |
| 12 | Add role-based redirect after login in AuthContext | 1h |
| 13 | Build AdminDashboard page (metrics cards + activity feed) | 4h |

### Sprint C: Question Management (3 days)

| # | Task | Effort |
|---|------|--------|
| 14 | Build QuestionList page (table + filters + pagination) | 4h |
| 15 | Build QuestionEditor page (full bilingual form) | 8h |
| 16 | Add image upload to question editor | 2h |
| 17 | Build BulkImport page (CSV/Excel parse + preview + error table) | 6h |

### Sprint D: Test Management (2 days)

| # | Task | Effort |
|---|------|--------|
| 18 | Build TestList page (status badges, draft/published filter) | 3h |
| 19 | Build TestWizard Step 1: Basic Details | 2h |
| 20 | Build TestWizard Step 2: Pattern & Configuration | 2h |
| 21 | Build TestWizard Step 3: Question Selection (search + drag-reorder) | 5h |
| 22 | Build TestWizard Step 4: Preview | 2h |
| 23 | Build TestWizard Step 5: Publish | 2h |

### Sprint E: User + Content Management (1.5 days)

| # | Task | Effort |
|---|------|--------|
| 24 | Build UserList page (search + role filter) | 3h |
| 25 | Build UserDetail page (stats + role dropdown + confirm) | 3h |
| 26 | Build ExamManagement page | 2h |
| 27 | Build SubjectManagement page (tree view) | 3h |
| 28 | Build ActivityLog page (table + filters) | 2h |

---

## 13. Total Effort Summary

| Category | Effort |
|----------|--------|
| Backend (new endpoints + migration) | 3 days |
| Frontend (admin pages + components) | 8 days |
| Testing | 2 days |
| **Total** | **13 days** |

| Metric | Value |
|--------|-------|
| New backend files | 5 (controllers + service + migration) |
| Modified backend files | 3 (questions.controller, tests.controller, routes/index.ts — add 1 activity log line each) |
| New frontend files | ~20 (admin pages + components + hooks) |
| Modified frontend files | 2 (router.tsx + AuthContext.tsx — add redirect logic) |
| New database tables | 1 (admin_activity_log) |
| Existing APIs reused | 15 |
| New APIs created | 13 |
| Code duplicated | 0 |
