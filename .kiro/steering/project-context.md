---
inclusion: auto
---

# UP Police Test Series — Project Context

## Project Overview
- **Name:** UP Police Test Series (Expandable to all States + Central exams)
- **Type:** SaaS Web App (PWA — mobile app jaisa feel)
- **Target Audience:** Government exam aspirants (Starting with UP Police Constable)
- **Languages:** Hindi + English (Bilingual toggle)
- **Monetization:** Freemium (Free tests + Paid subscription plans)

## Scope
- Phase 1: UP Police Constable Test Series
- Future: Other UP exams (SI, Jail Warder), Other States (MP, Rajasthan, Bihar), Central exams (SSC GD, CISF, BSF, Delhi Police)

## Platform Structure
```
Home
├── Central Exams (SSC GD, CISF/BSF/CRPF, Delhi Police, NIA/IB)
├── State Exams
│   ├── Uttar Pradesh (Constable, SI, Jail Warder, Home Guard)
│   ├── Madhya Pradesh (Constable, SI)
│   ├── Rajasthan (Constable, SI)
│   ├── Bihar (Constable, SI - BPSSC)
│   └── ... (more states later)
└── Free Section (Daily Quiz, PYQ, Topic Practice)
```

## Tech Stack
- **Frontend:** React + Tailwind CSS (PWA)
- **Backend:** Node.js + Express (Dockerized)
- **Database:** PostgreSQL
- **Cache:** Redis
- **Auth:** Firebase Auth (OTP) or custom JWT
- **Payment:** Razorpay (UPI + Cards)
- **AI:** OpenAI API

## Deployment Strategy (Portable — Zero Rework on Migration)

### Phase 1 (0-500 users) — FREE
- Frontend: Vercel
- Backend: Railway/Render (Docker)
- Database: Supabase (PostgreSQL)
- Redis: Upstash (free tier)

### Phase 2 (500+ users) — AWS
- Frontend: AWS S3 + CloudFront
- Backend: AWS ECS Fargate (same Docker image)
- Database: AWS RDS PostgreSQL (pg_dump migration)
- Redis: AWS ElastiCache

### Migration Effort: 2-3 hours, ZERO code changes, ZERO data loss
### Key Rule: Use environment variables everywhere, no hardcoded URLs

## Theme & UI
- **Vibe:** Police-inspired, authoritative, disciplined
- **Primary Color:** #1B3A5C (Dark Navy Blue — Police uniform)
- **Secondary Color:** #C5A028 (Gold/Khaki — Badge)
- **Accent:** #E63946 (Red — Urgency)
- **Background:** #F0F4F8 (Light grey-blue)
- **Success:** #2ECC71 (Green — Correct)
- **Error:** #E74C3C (Red — Wrong)
- **Typography:** Inter or Poppins (bold headings, clean body)
- **UI Elements:** Badge icons, shield shapes, rank-based gamification

## Modules (Total: 10)

### Module 1: 🔐 AUTH (Priority: HIGH)
- Phone OTP login (primary)
- Google OAuth login
- User profile management
- Exam selection during onboarding

### Module 2: 🏠 DASHBOARD (Priority: HIGH)
- Home page with quick stats
- Today's quiz card
- Progress summary
- Test category navigation
- Leaderboard preview

### Module 3: 📝 TEST ENGINE (Priority: HIGH)
- Question display (MCQ — single correct)
- Timer with auto-submit
- Question palette (Answered/Unanswered/Marked/Skipped)
- Mark for review
- Previous/Next navigation
- Submit confirmation
- Bilingual question toggle (Hindi/English)
- Test types: Topic-wise, Sectional, Full Mock, Previous Year

### Module 4: 📊 ANALYTICS (Priority: HIGH)
- **Per-test analysis:** Score card, subject breakdown, comparison (vs average/topper/previous), difficulty analysis, time per question
- **Progress Charts:** Weekly (day-by-day), Monthly (week-by-week), 6-month, 1-year views
- **Subject-wise Analysis:** Accuracy, avg time, trend, status per subject
- **Chapter-wise Breakdown:** Per subject → chapters → topics with accuracy & trend
- **Strong & Weak Areas:** Top performing topics, weak topics, improvement tracker
- **Test History:** Filter by type/time, sort, detailed view per test
- **Time Analysis:** Speed per subject/topic, Speed vs Accuracy matrix
- **Overall Summary:** Journey stats, monthly snapshots, exam readiness score, predicted score

### Module 5: 💰 PAYMENT (Priority: MEDIUM)
- Razorpay integration (UPI, Cards, Net Banking)
- Plans: Free / ₹149 per month (single exam) / ₹299 per month (state all) / ₹499 per month (all) / ₹999 per year
- Subscription management
- Coupon/discount system
- Referral rewards

### Module 6: 🌐 LANGUAGE (Priority: MEDIUM)
- Hindi/English toggle (global + per question)
- All UI elements bilingual
- Questions stored in both languages in DB
- User preference saved

### Module 7: 🏆 GAMIFICATION (Priority: MEDIUM)
- Rank system: Constable → Head Constable → SI → Inspector
- Badges: "100 Tests", "Speed King", "Accuracy Master", etc.
- Daily streak tracking (7-day bonus)
- Weekly + All-time leaderboard
- Challenge a friend
- Share score card (WhatsApp/Instagram)

### Module 8: 👨‍💼 ADMIN PANEL (Priority: MEDIUM)
- Add/edit/delete questions (bulk upload CSV)
- Create/manage tests
- User analytics dashboard
- Revenue reports
- Content management

### Module 9: 🔔 NOTIFICATIONS (Priority: LOW)
- Push notifications (daily reminder, streak warning)
- Email notifications (new test, results)
- In-app notification center
- WhatsApp/Telegram quiz integration

### Module 10: 🤖 AI FEATURES (Priority: LOW)
- Weak area detection (auto-analyze performance)
- Personalized test generation (focus on weak topics)
- AI doubt solver (explain any question)
- Exam pattern prediction

## Build Order

### Phase 1 — MVP (Week 1-4)
1. Module 1: Auth
2. Module 2: Dashboard
3. Module 3: Test Engine
4. Module 4: Analytics (Basic — score card + subject wise)

### Phase 2 — Monetization (Week 5-6)
5. Module 5: Payment
6. Module 6: Language

### Phase 3 — Engagement (Week 7-8)
7. Module 7: Gamification
8. Module 8: Admin Panel

### Phase 4 — Growth (Week 9-10)
9. Module 9: Notifications
10. Module 10: AI Features

## Module Dependencies
```
Auth → Dashboard → Test Engine → Analytics
                      │
                      ▼
                   Payment
                      │
                      ▼
                 Gamification → Notifications
                      │
                      ▼
                  AI Features

Language = Parallel (integrated across all modules)
Admin Panel = Parallel (independent)
```

## Revenue Model
- Free tier: 2-3 tests per exam + daily quiz
- Paid conversion target: 10-20%
- 1000 users × 20% conversion × ₹299/month = ₹59,800/month revenue
- AWS cost at 1000 users: ₹8,000-10,000/month
- Net profit: ~₹46,500/month

## Pricing Plans
| Plan | Price | Access |
|------|-------|--------|
| Free | ₹0 | 3 full mocks + unlimited topic tests |
| Single Exam | ₹149/month | One exam all tests |
| State Pack | ₹299/month | Single state all exams |
| All Access | ₹499/month | All states + central |
| Annual | ₹999/year | Everything unlimited |

## UP Police Constable Exam Details
- **Subjects:** Hindi, GK/GS, Numerical Ability (Math), Mental Ability (Reasoning)
- **Total Questions:** 150
- **Total Marks:** 300
- **Duration:** 2 hours
- **Negative Marking:** 1/4th (0.5 marks deducted per wrong answer)
- **Language:** Hindi + English

## Key Design Decisions
1. PWA for mobile-first experience (no app store needed)
2. Docker for backend (portable across hosts)
3. PostgreSQL (standard, no vendor lock-in)
4. Environment variables for all configs (zero rework migration)
5. S3-compatible storage for files
6. Standard REST API (no platform-specific features)
