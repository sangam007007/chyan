# Design Document: Test Series Module

## Overview

The Test Series module adds question bank management, test creation, test-taking, and result review capabilities to the UP Police Test Series platform. It builds on the existing Express/PostgreSQL/Redis backend and React frontend with bilingual support.

The module introduces six new database tables (questions, tests, test_questions, test_attempts, attempt_answers, revision_marks), backend services for scoring and listing, and frontend pages for test browsing, test-taking, and result review.

## Architecture

```mermaid
graph TB
    subgraph Frontend
        TL[Test Listing Page]
        TA[Test Attempt Page]
        TR[Test Results Page]
        AR[Answer Review Page]
    end

    subgraph Backend API
        QC[Questions Controller]
        TC[Tests Controller]
        AC[Attempts Controller]
        RC[Results Controller]
    end

    subgraph Services
        TLS[Test Listing Service]
        SC[Score Calculator]
        ATS[Attempt Service]
    end

    subgraph Data Layer
        PG[(PostgreSQL)]
        RD[(Redis)]
    end

    TL --> TC
    TA --> AC
    TR --> RC
    AR --> RC

    TC --> TLS
    AC --> ATS
    RC --> SC

    TLS --> PG
    ATS --> PG
    ATS --> RD
    SC --> PG
end
```

### Request Flow

1. **Test Listing**: Frontend → GET /api/tests → Test Listing Service → PostgreSQL (joins tests, test_attempts, questions)
2. **Start Attempt**: Frontend → POST /api/tests/:testId/attempts → Attempt Service → creates attempt record, caches timer in Redis
3. **Save Answer**: Frontend → PUT /api/attempts/:attemptId/answers/:questionIndex → Attempt Service → upserts answer row
4. **Submit Test**: Frontend → POST /api/attempts/:attemptId/submit → Score Calculator → updates attempt with score
5. **View Results**: Frontend → GET /api/attempts/:attemptId/results → Results from attempt record + subject breakdown query

## Components and Interfaces

### Backend Controllers

**Questions Controller** (`/api/questions`)
- `POST /` — Create question (admin)
- `GET /` — List questions with filters (admin)
- `GET /:id` — Get single question (admin)
- `PUT /:id` — Update question (admin)
- `DELETE /:id` — Soft delete question (admin)

**Tests Controller** (`/api/tests`)
- `POST /` — Create test (admin)
- `GET /` — List tests for user (authenticated, filterable by exam)
- `GET /:id` — Get test details (authenticated)
- `PUT /:id` — Update test (admin)

**Attempts Controller** (`/api/tests/:testId/attempts`)
- `POST /` — Start a test attempt
- `GET /current` — Get user's current in-progress attempt for this test
- `PUT /:attemptId/answers/:questionIndex` — Save/update answer for a question
- `POST /:attemptId/submit` — Submit test attempt
- `GET /:attemptId/results` — Get attempt results with breakdown
- `GET /:attemptId/review` — Get full answer review with explanations
- `POST /:attemptId/review/:questionIndex/revision` — Mark question for revision

### Backend Services

**Score Calculator** (`src/services/score-calculator.service.ts`)
```typescript
interface ScoreResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeTakenSeconds: number;
  passed: boolean;
}

interface SubjectBreakdown {
  subject: string;
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
}

function calculateScore(
  answers: AttemptAnswer[],
  questions: Question[],
  marksPerQuestion: number,
  negativeMarkingRatio: number
): ScoreResult;

function calculateSubjectBreakdown(
  answers: AttemptAnswer[],
  questions: Question[]
): SubjectBreakdown[];

function calculatePercentile(
  score: number,
  testId: string
): Promise<number>;
```

**Test Listing Service** (`src/services/test-listing.service.ts`)
```typescript
interface TestListItem {
  id: string;
  titleEn: string;
  titleHi: string;
  duration: number;
  totalQuestions: number;
  totalMarks: number;
  pricingType: 'free' | 'premium';
  attemptStatus: 'not_attempted' | 'in_progress' | 'completed';
  lastScore?: number;
  createdAt: Date;
}

type SortOption = 'newest' | 'popular' | 'difficulty';

function getTestsForUser(
  userId: string,
  examId: string,
  sort: SortOption,
  page: number,
  limit: number
): Promise<{ tests: TestListItem[]; total: number }>;
```

**Attempt Service** (`src/services/attempt.service.ts`)
```typescript
function startAttempt(userId: string, testId: string): Promise<TestAttempt>;
function saveAnswer(attemptId: string, questionIndex: number, selectedOption: number | null, markedForReview: boolean): Promise<void>;
function submitAttempt(attemptId: string): Promise<ScoreResult>;
function getAttemptStatus(userId: string, testId: string): Promise<AttemptStatus>;
```

### Frontend Pages

**TestListPage** (`/tests`)
- Fetches tests filtered by user's selected exam
- Displays cards with test info, free/premium badge, attempt status
- Sort controls (newest, popular, difficulty)
- Navigate to test details or start attempt

**TestAttemptPage** (`/tests/:testId/attempt`)
- Timer countdown component
- Question display with 4 radio options
- Mark for review checkbox
- Question navigation panel (numbered grid)
- Auto-submit on timer expiry
- Submit button with confirmation dialog

**TestResultsPage** (`/tests/:testId/results/:attemptId`)
- Score card (marks, percentage, pass/fail)
- Percentile rank display
- Subject-wise breakdown chart/table
- Link to full answer review

**AnswerReviewPage** (`/tests/:testId/review/:attemptId`)
- Question list with user's answer vs correct answer
- Color-coded (green correct, red wrong, gray skipped)
- Explanation text
- Mark for revision button

## Data Models

### PostgreSQL Tables

```sql
-- Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text_en TEXT NOT NULL,
    text_hi TEXT NOT NULL,
    option_a_en VARCHAR(500) NOT NULL,
    option_a_hi VARCHAR(500) NOT NULL,
    option_b_en VARCHAR(500) NOT NULL,
    option_b_hi VARCHAR(500) NOT NULL,
    option_c_en VARCHAR(500) NOT NULL,
    option_c_hi VARCHAR(500) NOT NULL,
    option_d_en VARCHAR(500) NOT NULL,
    option_d_hi VARCHAR(500) NOT NULL,
    correct_option SMALLINT NOT NULL CHECK (correct_option BETWEEN 0 AND 3),
    explanation_en TEXT,
    explanation_hi TEXT,
    subject VARCHAR(20) NOT NULL CHECK (subject IN ('gk', 'math', 'reasoning', 'hindi')),
    topic VARCHAR(100),
    difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Question-exam association (many-to-many)
CREATE TABLE question_exams (
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, exam_id)
);

-- Tests table
CREATE TABLE tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title_en VARCHAR(200) NOT NULL,
    title_hi VARCHAR(200) NOT NULL,
    description_en TEXT,
    description_hi TEXT,
    exam_id UUID NOT NULL REFERENCES exams(id),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    total_marks INTEGER NOT NULL CHECK (total_marks > 0),
    marks_per_question NUMERIC(4,2) NOT NULL DEFAULT 1,
    negative_marking_ratio NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (negative_marking_ratio >= 0 AND negative_marking_ratio <= 1),
    passing_marks INTEGER NOT NULL CHECK (passing_marks >= 0),
    pricing_type VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (pricing_type IN ('free', 'premium')),
    status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    available_from TIMESTAMPTZ,
    available_until TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test-question ordered association
CREATE TABLE test_questions (
    test_id UUID NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    question_order SMALLINT NOT NULL,
    PRIMARY KEY (test_id, question_id),
    UNIQUE (test_id, question_order)
);

-- Test attempts
CREATE TABLE test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    test_id UUID NOT NULL REFERENCES tests(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    status VARCHAR(15) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'auto_submitted')),
    total_score NUMERIC(6,2),
    correct_count SMALLINT,
    wrong_count SMALLINT,
    skipped_count SMALLINT,
    percentage NUMERIC(5,2),
    time_taken_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_attempts_user_test ON test_attempts(user_id, test_id);

-- Individual answers within an attempt
CREATE TABLE attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id),
    question_order SMALLINT NOT NULL,
    selected_option SMALLINT CHECK (selected_option BETWEEN 0 AND 3),
    marked_for_review BOOLEAN NOT NULL DEFAULT false,
    answered_at TIMESTAMPTZ,
    UNIQUE (attempt_id, question_order)
);

-- Revision marks
CREATE TABLE revision_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    question_id UUID NOT NULL REFERENCES questions(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, question_id)
);
```

### Redis Keys

- `attempt:{attemptId}:timer` — TTL-based timer tracking (value: ends_at timestamp)
- `test:{testId}:attempt_count` — Cached attempt count for popularity sort

### Zod Validation Schemas

```typescript
// Question creation
const createQuestionSchema = z.object({
  textEn: z.string().min(1).max(2000),
  textHi: z.string().min(1).max(2000),
  options: z.array(z.object({
    en: z.string().min(1).max(500),
    hi: z.string().min(1).max(500),
  })).length(4),
  correctOption: z.number().int().min(0).max(3),
  explanationEn: z.string().max(2000).optional(),
  explanationHi: z.string().max(2000).optional(),
  subject: z.enum(['gk', 'math', 'reasoning', 'hindi']),
  topic: z.string().max(100).optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  imageUrl: z.string().url().optional(),
  examIds: z.array(z.string().uuid()).min(1),
});

// Test creation
const createTestSchema = z.object({
  titleEn: z.string().min(1).max(200),
  titleHi: z.string().min(1).max(200),
  descriptionEn: z.string().max(1000).optional(),
  descriptionHi: z.string().max(1000).optional(),
  examId: z.string().uuid(),
  durationMinutes: z.number().int().positive(),
  totalMarks: z.number().int().positive(),
  marksPerQuestion: z.number().positive().default(1),
  negativeMarkingRatio: z.number().min(0).max(1).default(0),
  passingMarks: z.number().int().nonnegative(),
  pricingType: z.enum(['free', 'premium']).default('free'),
  status: z.enum(['draft', 'published']).default('draft'),
  availableFrom: z.string().datetime().optional(),
  availableUntil: z.string().datetime().optional(),
  questionIds: z.array(z.string().uuid()).min(1),
});

// Save answer
const saveAnswerSchema = z.object({
  selectedOption: z.number().int().min(0).max(3).nullable(),
  markedForReview: z.boolean().default(false),
});
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Score calculation correctness

*For any* set of attempt answers and a test configuration (marks_per_question, negative_marking_ratio), the calculated total score SHALL equal (correct_count × marks_per_question) - (wrong_count × marks_per_question × negative_marking_ratio), and correct_count + wrong_count + skipped_count SHALL equal the total number of questions.

**Validates: Requirements 4.5**

### Property 2: Score component invariant

*For any* score result, the percentage SHALL equal (totalScore / maxScore) × 100, and the passed flag SHALL equal (totalScore >= passingMarks).

**Validates: Requirements 5.1**

### Property 3: Subject breakdown consistency

*For any* set of attempt answers, the sum of correct + wrong + skipped across all subject breakdowns SHALL equal the total number of questions in the test.

**Validates: Requirements 5.3**

### Property 4: Test listing schedule filtering

*For any* test with schedule dates, the test SHALL appear in listings only when the current time is between available_from and available_until (inclusive). Tests outside this window SHALL be excluded.

**Validates: Requirements 2.5, 3.5**

### Property 5: Answer persistence completeness

*For any* test attempt, saving an answer for question index N and then retrieving the attempt state SHALL return the saved selected_option and marked_for_review values for that index unchanged.

**Validates: Requirements 4.7**

### Property 6: Cooldown enforcement

*For any* user who completed a test, attempting to start the same test within 24 hours of submission SHALL be rejected. After 24 hours have elapsed, the attempt SHALL be allowed.

**Validates: Requirements 4.6**

### Property 7: Question validation invariant

*For any* question created in the Question_Bank, the correct_option value SHALL be between 0 and 3 inclusive, and exactly 4 options SHALL exist.

**Validates: Requirements 1.5**

## Error Handling

| Scenario | HTTP Status | Error Code | Message |
|----------|-------------|------------|---------|
| Test not found | 404 | TEST_NOT_FOUND | Test does not exist |
| Test not published | 403 | TEST_NOT_AVAILABLE | Test is not currently available |
| Test outside schedule | 403 | TEST_NOT_IN_SCHEDULE | Test is not within the available time window |
| Cooldown active | 429 | COOLDOWN_ACTIVE | Cannot re-attempt test, wait {remainingTime} |
| Attempt not found | 404 | ATTEMPT_NOT_FOUND | Attempt does not exist |
| Attempt already submitted | 409 | ATTEMPT_ALREADY_SUBMITTED | Test has already been submitted |
| Invalid question index | 400 | INVALID_QUESTION_INDEX | Question index out of range |
| Question validation failed | 422 | VALIDATION_ERROR | Field-level errors from Zod |

## Testing Strategy

### Property-Based Tests (fast-check)

Each correctness property maps to a property-based test with minimum 100 iterations:

1. **Score calculation** — Generate random answer arrays with varying correct/wrong/skipped distributions, verify formula correctness
2. **Score component invariant** — Generate random score values, verify percentage and pass/fail derivation
3. **Subject breakdown consistency** — Generate multi-subject answer sets, verify partition sums
4. **Schedule filtering** — Generate random date windows and current times, verify inclusion/exclusion logic
5. **Answer persistence** — Generate random answers, save and retrieve, verify round-trip
6. **Cooldown enforcement** — Generate random submission timestamps, verify 24h boundary
7. **Question validation** — Generate random question payloads, verify constraint enforcement

### Unit Tests (Vitest)

- Score calculator with known inputs (edge cases: all correct, all wrong, all skipped, zero negative marking)
- Test listing filters (exam mismatch, draft exclusion, schedule edge dates)
- Attempt service (timer calculation, duplicate attempt detection)
- Zod schema validation (valid/invalid payloads)

### Integration Tests

- Full attempt flow: start → answer → submit → results
- Test listing with user's exam and attempt status joins
- Seed data migration runs without errors

### Frontend Tests

- Test listing page renders cards with correct badges
- Timer countdown component decrements and auto-submits
- Question navigation panel reflects answer state correctly
