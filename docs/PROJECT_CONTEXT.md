# Project Context — UP Police Test Series

## Overview

UP Police Test Series is a government exam preparation SaaS platform built for aspirants preparing for Uttar Pradesh Police recruitment exams. The platform provides mock tests, daily quizzes, performance analytics, and gamification to keep students engaged throughout their preparation journey.

## Target Audience

- Government exam aspirants (primarily UP Police — Constable, SI, ASI)
- Hindi-medium and English-medium students (bilingual support required)
- Mobile-first users (80%+ traffic expected from smartphones)
- Tier-2/Tier-3 city students with variable internet connectivity
- Age group: 18–30, mostly on Android devices

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Tailwind CSS, Vite, Axios |
| Backend | Express 4, Node.js |
| Database | PostgreSQL 16 (via `pg`) |
| Cache | Redis 7 (via `ioredis`) |
| Validation | Zod |
| Auth | JWT (access + refresh tokens), OTP, Google OAuth |
| Migrations | node-pg-migrate |
| Testing | Vitest, fast-check (property-based), Playwright (e2e) |
| Infrastructure | Docker multi-stage builds, docker-compose |
| CI/CD | GitHub Actions (planned) |

## Monorepo Structure

```
project/
├── packages/
│   ├── backend/       # Express API server
│   └── frontend/      # React SPA (Vite)
├── e2e/               # Playwright end-to-end tests
├── docs/              # Project documentation (this folder)
├── docker-compose.yml # Local dev environment
├── Dockerfile         # Multi-stage production build
└── package.json       # Root workspace config (npm workspaces)
```

Managed via **npm workspaces** — all packages share a single `node_modules` at the root level.

## Bilingual Requirements

- All user-facing content stored in dual columns (`*_en`, `*_hi`)
- Backend returns content in user's `preferred_language` (set during onboarding)
- Frontend renders based on language preference from user profile
- i18n files at `packages/backend/src/i18n/` (en.json, hi.json) for system messages
- Questions, test titles, subjects, and topics all bilingual

## Mobile-First PWA Approach

- Tailwind CSS with mobile-first breakpoints
- Touch-optimized UI components
- Planned: Service worker for offline caching (not yet implemented)
- Planned: Web App Manifest for "Add to Home Screen"
- Responsive design targeting 360px–428px primary viewport

## Deployment Strategy

### Phase 1 (Current Target)
- **Frontend:** Vercel (static SPA deployment)
- **Backend:** Railway (containerized Express)
- **Database:** Railway PostgreSQL add-on or Supabase
- **Redis:** Railway Redis or Upstash

### Phase 2 (Scale)
- **Frontend:** AWS CloudFront + S3
- **Backend:** AWS ECS (Fargate) or EC2 with auto-scaling
- **Database:** AWS RDS PostgreSQL
- **Cache:** AWS ElastiCache (Redis)
- **Storage:** AWS S3 (avatars, question images)
- **CDN:** CloudFront for static assets and images

## Team Context

- Small team (1–3 developers)
- Full-stack development approach
- AI-assisted development workflow (Kiro specs)
- Rapid iteration with feature-flag approach planned

## Key Design Decisions

1. **No Redux/Zustand** — React Context + local state is sufficient for current scale
2. **PostgreSQL over MongoDB** — Relational data (exams→subjects→topics→questions) fits SQL naturally
3. **JWT with refresh token rotation** — Secure session management without server-side session store for access tokens
4. **Redis for ephemeral data** — OTP codes, rate limits, CSRF tokens, session blacklist
5. **Zod everywhere** — Runtime validation on both request bodies and environment variables
6. **Property-based testing** — Critical business logic (scoring, streaks, coins) tested with fast-check
7. **Bilingual from day one** — Dual-column approach avoids costly refactors later
8. **RBAC with role in JWT** — `requireRole()` middleware protects admin endpoints; roles stored in users table, included in JWT payload, extracted by jwtAuth middleware
9. **Admin isolated from student** — All admin code in separate `src/admin/` folder, separate routes under `/admin/*`, role-based redirect after login (no separate login page)
