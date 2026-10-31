# Coding Standards — UP Police Test Series

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Database columns | snake_case | `created_at`, `user_id`, `full_name` |
| API response keys | camelCase | `createdAt`, `userId`, `fullName` |
| TypeScript variables | camelCase | `const userId = ...` |
| TypeScript types/interfaces | PascalCase | `interface UserProfile {}` |
| React components | PascalCase | `TestAttemptPage`, `DailyChallengeBar` |
| Custom hooks | camelCase with `use` prefix | `useStreak`, `useDailyQuiz` |
| Backend services | kebab-case files, PascalCase class/export | `streak.service.ts` → `streakService` |
| Controllers | kebab-case files | `daily-quiz.controller.ts` |
| Middleware | kebab-case files | `rate-limiter.ts`, `jwt-auth.ts` |
| Migrations | numbered + kebab-case | `012_add-subjects-topics-tables.ts` |
| Test files | `.test.ts` suffix (unit), `.spec.ts` (e2e) | `auth.controller.test.ts`, `login.spec.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_OTP_ATTEMPTS`, `TOKEN_EXPIRY` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL`, `JWT_SECRET` |

---

## Backend Patterns

### Controller Structure

Controllers are thin — they parse input, call services, and format output.

```typescript
// Good: Thin controller
export const getTests = async (req: Request, res: Response) => {
  const filters = testFilterSchema.parse(req.query);
  const userId = req.user!.id;

  const result = await testListingService.getTests(filters, userId);

  res.json({ success: true, data: result });
};

// Bad: Fat controller with business logic
export const getTests = async (req: Request, res: Response) => {
  const { rows } = await pool.query('SELECT * FROM tests WHERE...'); // ❌ Direct DB
  const filtered = rows.filter(t => t.status === 'published'); // ❌ Logic in controller
  res.json(filtered);
};
```

### Service Pattern

Services contain business logic and database interaction.

```typescript
// services/test-listing.service.ts
export const testListingService = {
  async getTests(filters: TestFilters, userId: string) {
    const { rows } = await query(
      `SELECT t.*, 
        (SELECT COUNT(*) FROM test_attempts WHERE test_id = t.id AND user_id = $1) as user_attempts
       FROM tests t
       WHERE t.status = 'published' AND t.exam_id = $2
       ORDER BY t.created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, filters.examId, filters.limit, filters.offset]
    );
    return { tests: rows.map(mapTestRow), pagination: { ... } };
  },
};
```

### Zod Validation Pattern

Every endpoint has a Zod schema. Validation happens in middleware before the controller runs.

```typescript
// validators/tests.validator.ts
import { z } from 'zod';

export const testFilterSchema = z.object({
  examId: z.string().uuid().optional(),
  category: z.enum(['full_mock', 'subject', 'topic', 'pyq']).optional(),
  subjectId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type TestFilters = z.infer<typeof testFilterSchema>;

// routes/tests.routes.ts
router.get('/tests', jwtAuth, validate(testFilterSchema, 'query'), getTests);
```

### Error Handling Pattern

Never catch errors in controllers unless you need to transform them. Let errors propagate to the global error handler.

```typescript
// Good: Let error propagate
export const startAttempt = async (req: Request, res: Response) => {
  const { testId } = req.params;
  const attempt = await attemptService.startAttempt(req.user!.id, testId);
  res.status(201).json({ success: true, data: attempt });
};

// In service — throw typed errors
async startAttempt(userId: string, testId: string) {
  const test = await this.getTestById(testId);
  if (!test) throw new NotFoundError('Test not found');
  if (test.status !== 'published') throw new ValidationError('Test is not available');
  
  const existing = await this.getInProgressAttempt(userId, testId);
  if (existing) throw new ConflictError('Attempt already in progress');
  
  // ... create attempt
}
```

### Database Query Pattern

Always use parameterized queries. Never interpolate values.

```typescript
// Good
const { rows } = await query(
  'SELECT * FROM users WHERE id = $1 AND is_active = $2',
  [userId, true]
);

// Bad ❌
const { rows } = await query(`SELECT * FROM users WHERE id = '${userId}'`);
```

### Transaction Pattern

```typescript
import { withTransaction } from '@/db';

const result = await withTransaction(async (client) => {
  await client.query('UPDATE users SET coins = coins + $1 WHERE id = $2', [amount, userId]);
  await client.query(
    'INSERT INTO coin_transactions (user_id, type, amount) VALUES ($1, $2, $3)',
    [userId, type, amount]
  );
  return { success: true };
});
```

---

## Frontend Patterns

### Hook Pattern

Custom hooks encapsulate data fetching and state management.

```typescript
// hooks/useStreak.ts
export function useStreak() {
  const [data, setData] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStreak = async () => {
      try {
        const response = await api.get('/dashboard/streak');
        setData(response.data.data);
      } catch (err) {
        setError('Failed to load streak');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStreak();
  }, []);

  return { ...data, isLoading, error };
}
```

### Component Pattern

```tsx
// components/dashboard/StreakCard.tsx
interface StreakCardProps {
  currentStreak: number;
  bestStreak: number;
  isLoading?: boolean;
}

export function StreakCard({ currentStreak, bestStreak, isLoading }: StreakCardProps) {
  if (isLoading) return <CardSkeleton />;

  return (
    <Card>
      <h3 className="text-lg font-semibold">🔥 Streak</h3>
      <p className="text-3xl font-bold">{currentStreak} days</p>
      <p className="text-sm text-gray-500">Best: {bestStreak} days</p>
    </Card>
  );
}
```

### API Call Pattern

```typescript
// api/client.ts — shared instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

// Interceptor handles token refresh automatically
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await refreshAccessToken();
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

---

## TypeScript Strictness

```json
// tsconfig.json settings
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": false
  }
}
```

- All function parameters must be typed
- Return types encouraged on service methods
- `any` is banned — use `unknown` and narrow
- Non-null assertions (`!`) allowed only for `req.user!` after auth middleware

---

## Import Aliases

```typescript
// Backend uses @/ alias
import { query } from '@/db';
import { AppError, NotFoundError } from '@/errors';
import { jwtAuth } from '@/middleware/jwt-auth';

// Frontend uses @/ alias (via Vite)
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/common/Button';
import { api } from '@/api/client';
```

---

## i18n Key Structure

```json
// en.json structure
{
  "auth": {
    "otp_sent": "OTP sent to {phone}",
    "otp_expired": "OTP has expired",
    "otp_invalid": "Invalid OTP code"
  },
  "profile": {
    "updated": "Profile updated successfully",
    "exam_change_limit": "You can only change exam 3 times per month"
  },
  "test": {
    "not_found": "Test not found",
    "already_submitted": "This attempt has already been submitted"
  },
  "general": {
    "server_error": "Something went wrong. Please try again.",
    "unauthorized": "Please login to continue"
  }
}
```

---

## CSS / Styling

- **Framework:** Tailwind CSS (utility-first)
- **Approach:** Mobile-first (`sm:`, `md:`, `lg:` breakpoints)
- **No CSS modules** — Tailwind classes inline
- **Custom theme** via `tailwind.config.js` (colors, fonts)
- **Spacing:** Use Tailwind's scale (p-4, m-2, gap-3)
- **Colors:** Define in config, reference as `text-primary`, `bg-surface`

```tsx
// Good: Tailwind utilities
<div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-6">

// Bad: Inline styles or custom CSS
<div style={{ display: 'flex', padding: '16px' }}>
```

---

## Test File Organization

```
packages/backend/src/
├── controllers/
│   ├── auth.controller.ts
│   └── auth.controller.test.ts      # Unit tests co-located
├── services/
│   ├── streak.service.ts
│   └── streak.service.test.ts
└── ...

e2e/tests/
├── auth/
│   └── login.spec.ts                 # E2E tests in e2e folder
└── test-attempt/
    └── full-flow.spec.ts
```

### Test Naming

```typescript
// Unit test pattern
describe('ScoreCalculatorService', () => {
  describe('calculateScore', () => {
    it('should apply negative marking for wrong answers', () => { ... });
    it('should not deduct marks for skipped questions', () => { ... });
  });
});

// Property-based test pattern
describe('ScoreCalculator properties', () => {
  it('score is always between 0 and totalMarks', () => {
    fc.assert(fc.property(
      fc.array(fc.integer({ min: -1, max: 3 })),
      (answers) => { ... }
    ));
  });
});
```

---

## Git Conventions

- **Branch naming:** `feature/test-listing-api`, `fix/csrf-token-expiry`, `refactor/dashboard-hooks`
- **Commit messages:** Conventional commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- **PR size:** Prefer small, focused PRs (< 300 lines changed)

---

## Environment Variables

All environment variables are validated at startup via Zod in `src/config/env.ts`.

```typescript
// Adding a new env var:
// 1. Add to .env.example
// 2. Add to Zod schema in src/config/env.ts
// 3. Access via env.VARIABLE_NAME (type-safe)

import { env } from '@/config/env';
const secret = env.JWT_SECRET; // string (guaranteed at startup)
```
